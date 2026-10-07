// nooi.ai on-device AI: runs open models in the visitor's browser with WebGPU (CPU/WASM fallback), in a worker so
// the page stays smooth. Models download once from Hugging Face (or the server's /models mirror) and are cached
// by the browser. Messages: {id, op:"probe"} · {id, op:"run", task, model, input, opts} → progress / result / error.
// The library loads from our server when it is installed there (npm i @huggingface/transformers), else from the CDN.
const TF_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js";
let pipeline = null, env = null, TF = null;
async function lib(cfg) {
  if (!pipeline) {
    let m;
    try { m = await import(cfg.tfUrl || TF_CDN); } catch (e) { if (!cfg.tfUrl) throw e; m = await import(TF_CDN); }
    pipeline = m.pipeline; env = m.env; TF = m;
  }
}

let device = null, fp16 = false;
const pipes = new Map();

async function probe(cfg = {}) {
  await lib(cfg);
  if (cfg.ortBase) {
    // self-hosted ONNX Runtime (served by the nooi server from node_modules/onnxruntime-web/dist)
    const sfx = "gpu" in navigator ? ".asyncify" : "";
    env.backends.onnx.wasm.wasmPaths = { mjs: cfg.ortBase + "ort-wasm-simd-threaded" + sfx + ".mjs", wasm: cfg.ortBase + "ort-wasm-simd-threaded" + sfx + ".wasm" };
  }
  if (cfg.modelsHost) { env.remoteHost = cfg.modelsHost; env.remotePathTemplate = "{model}/resolve/{revision}/"; }
  env.allowLocalModels = false;
  let adapter = null, info = "";
  try { adapter = "gpu" in navigator ? await navigator.gpu.requestAdapter({ powerPreference: "high-performance" }) : null; } catch {}
  if (adapter) {
    fp16 = adapter.features.has("shader-f16");
    try { const i = adapter.info || (await adapter.requestAdapterInfo?.()); info = [i?.vendor, i?.architecture || i?.description].filter(Boolean).join(" "); } catch {}
  }
  // a software "GPU" (SwiftShader / fallback adapter) is slower than the CPU path
  if (adapter && (adapter.isFallbackAdapter || adapter.info?.isFallbackAdapter || /swiftshader/i.test(info))) adapter = null;
  device = adapter ? "webgpu" : "wasm";
  return { device, fp16, gpu: info, threads: self.crossOriginIsolated ? navigator.hardwareConcurrency : 1 };
}

// precision per task: WebGPU runs fp16/fp32 (q4 decoder for Whisper), the CPU path uses 8-bit models
function dtypeFor(task) {
  if (task === "asr") return device === "webgpu" ? { encoder_model: fp16 ? "fp16" : "fp32", decoder_model_merged: "q4" } : "q8";
  if (task === "tts") return device === "webgpu" ? "fp32" : "q8";
  return device === "webgpu" ? (fp16 ? "fp16" : "fp32") : "q8";
}
const TASK = { asr: "automatic-speech-recognition", tts: "text-to-audio", bg: "background-removal", upscale: "image-to-image", depth: "depth-estimation", depthraw: "depth-estimation" };

async function getPipe(task, model, report) {
  const key = task + "|" + model;
  if (!pipes.has(key)) {
    const p = pipeline(TASK[task], model, { device, dtype: dtypeFor(task), progress_callback: report })
      .catch(async (e) => {
        // a WebGPU driver/shader problem → retry once on the CPU
        if (device !== "webgpu") throw e;
        report({ status: "fallback", message: String(e && e.message || e) });
        return pipeline(TASK[task], model, { device: "wasm", dtype: "q8", progress_callback: report });
      });
    pipes.set(key, p);
    p.catch(() => pipes.delete(key));
  }
  return pipes.get(key);
}

// ---- Segment Anything (SlimSAM): embed the picture once, then each tap decodes a mask in milliseconds
const SAM = { id: null, model: null, proc: null, key: null, inputs: null, emb: null, w: 0, h: 0 };
const readImg = async (blob) => (TF.RawImage.fromBlob ? TF.RawImage.fromBlob(blob) : TF.RawImage.read(URL.createObjectURL(blob)));
async function loadModel(Cls, model, report, wasmDtype) {
  try { return await Cls.from_pretrained(model, { device, dtype: device === "webgpu" ? (fp16 ? "fp16" : "fp32") : wasmDtype, progress_callback: report }); }
  catch (e) { if (device !== "webgpu") throw e; report({ status: "fallback", message: String(e && e.message || e) }); return Cls.from_pretrained(model, { device: "wasm", dtype: wasmDtype, progress_callback: report }); }
}
async function samEmbed(model, blob, key, report) {
  if (SAM.id !== model) { SAM.model = await loadModel(TF.SamModel, model, report, "q8"); SAM.proc = await TF.AutoProcessor.from_pretrained(model); SAM.id = model; SAM.key = null; }
  if (SAM.key !== key) { report({ status: "running" }); const img = await readImg(blob); SAM.inputs = await SAM.proc(img); SAM.emb = await SAM.model.get_image_embeddings(SAM.inputs); SAM.key = key; SAM.w = img.width; SAM.h = img.height; }
  return { w: SAM.w, h: SAM.h };
}
async function samDecode(points) {
  if (!SAM.emb) throw new Error("No picture prepared");
  const rs = SAM.inputs.reshaped_input_sizes[0];
  const pts = points.map((p) => [p.x * rs[1], p.y * rs[0]]).flat();
  const input_points = new TF.Tensor("float32", Float32Array.from(pts), [1, 1, points.length, 2]);
  const input_labels = new TF.Tensor("int64", BigInt64Array.from(points.map((p) => BigInt(p.pos ? 1 : 0))), [1, 1, points.length]);
  const out = await SAM.model({ ...SAM.emb, input_points, input_labels });
  const masks = await SAM.proc.post_process_masks(out.pred_masks, SAM.inputs.original_sizes, SAM.inputs.reshaped_input_sizes);
  const m = masks[0], dims = m.dims, H = dims[dims.length - 2], W = dims[dims.length - 1], n = m.data.length / (W * H);
  const sc = out.iou_scores.data; let best = 0; for (let i = 1; i < n; i++) if (sc[i] > sc[best]) best = i;
  const k = Math.min(1, 512 / Math.max(W, H)), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k)), mask = new Uint8Array(w * h), off = best * W * H;
  for (let y = 0; y < h; y++) { const sy = Math.min(H - 1, Math.floor(y / k)) * W; for (let x = 0; x < w; x++) mask[y * w + x] = m.data[off + sy + Math.min(W - 1, Math.floor(x / k))] ? 1 : 0; }
  return { w, h, mask, score: Number(sc[best]) };
}
// ---- body pose (ViTPose, 17 COCO keypoints) inside an optional person box
const POSE = { id: null, model: null, proc: null };
async function poseRun(model, blob, box, report) {
  if (POSE.id !== model) { POSE.model = await loadModel(TF.AutoModel, model, report, "q8"); POSE.proc = await TF.AutoImageProcessor.from_pretrained(model); POSE.id = model; }
  let img = await readImg(blob); const W = img.width, H = img.height; let ox = 0, oy = 0;
  if (box) { const x0 = Math.max(0, Math.floor(box.x0 * W)), y0 = Math.max(0, Math.floor(box.y0 * H)), x1 = Math.min(W - 1, Math.ceil(box.x1 * W)), y1 = Math.min(H - 1, Math.ceil(box.y1 * H)); if (x1 - x0 > 8 && y1 - y0 > 8) { img = await img.crop([x0, y0, x1, y1]); ox = x0; oy = y0; } }
  const inputs = await POSE.proc(img); const { heatmaps } = await POSE.model(inputs);
  const r = POSE.proc.post_process_pose_estimation(heatmaps, [[[0, 0, img.width, img.height]]], { threshold: 0 })[0][0];
  return { kp: r.keypoints.map(([x, y], i) => ({ x: (x + ox) / W, y: (y + oy) / H, s: Number(r.scores[i]) })) };
}

async function run(task, model, input, opts, report) {
  if (!device) await probe(opts.cfg || {});
  if (task === "sam-embed") return samEmbed(model, input.blob, input.key, report);
  if (task === "sam-decode") { const r = await samDecode(input.points); return r; }
  if (task === "pose") return poseRun(model, input.blob, input.box, report);
  const pipe = await getPipe(task, model, report);
  report({ status: "running" });
  if (task === "asr") {
    const out = await pipe(input.audio, { return_timestamps: input.words ? "word" : true, chunk_length_s: 30, stride_length_s: 5, task: "transcribe", ...(input.language ? { language: input.language } : {}) });
    return { text: out.text, chunks: (out.chunks || []).map((c) => ({ start: c.timestamp?.[0] ?? 0, end: c.timestamp?.[1] ?? null, text: c.text })) };
  }
  if (task === "tts") { const out = await pipe(input.text); const a = Array.isArray(out) ? out[0] : out; return { blob: a.toBlob(), seconds: a.data.length / a.sampling_rate }; }
  // image tasks take a Blob; the pipeline reads it through an object URL
  const url = URL.createObjectURL(input.blob);
  try {
    if (task === "bg") { const img = await pipe(url); return { blob: await img.toBlob("image/png") }; }
    if (task === "upscale") { const img = await pipe(url); return { blob: await img.toBlob("image/png"), width: img.width, height: img.height }; }
    if (task === "depth") { const r = await pipe(url); return { blob: await r.depth.toBlob("image/png"), width: r.depth.width, height: r.depth.height }; }
    if (task === "depthraw") { const r = await pipe(url); const d = r.depth, c = d.channels || 1, px = new Uint8Array(d.width * d.height); for (let i = 0; i < px.length; i++) px[i] = d.data[i * c]; return { w: d.width, h: d.height, data: px }; }
  } finally { URL.revokeObjectURL(url); }
  throw new Error("Unknown task " + task);
}

self.onmessage = async ({ data: m }) => {
  const report = (p) => self.postMessage({ id: m.id, type: "progress", p: { status: p.status, file: p.file, progress: p.progress, loaded: p.loaded, total: p.total, message: p.message } });
  try {
    const result = m.op === "probe" ? await probe(m.cfg || {}) : await run(m.task, m.model, m.input || {}, m.opts || {}, report);
    const tr = result && result.mask ? [result.mask.buffer] : result && result.data && result.data.buffer ? [result.data.buffer] : [];
    self.postMessage({ id: m.id, type: "result", result }, tr);
  } catch (e) {
    self.postMessage({ id: m.id, type: "error", error: String(e && e.message || e) });
  }
};
