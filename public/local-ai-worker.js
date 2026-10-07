// nooi.ai on-device AI: runs open models in the visitor's browser with WebGPU (CPU/WASM fallback), in a worker so
// the page stays smooth. Models download once from Hugging Face (or the server's /models mirror) and are cached
// by the browser. Messages: {id, op:"probe"} · {id, op:"run", task, model, input, opts} → progress / result / error.
// The library loads from our server when it is installed there (npm i @huggingface/transformers), else from the CDN.
const TF_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js";
let pipeline = null, env = null;
async function lib(cfg) {
  if (!pipeline) {
    let m;
    try { m = await import(cfg.tfUrl || TF_CDN); } catch (e) { if (!cfg.tfUrl) throw e; m = await import(TF_CDN); }
    pipeline = m.pipeline; env = m.env;
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
const TASK = { asr: "automatic-speech-recognition", tts: "text-to-audio", bg: "background-removal", upscale: "image-to-image", depth: "depth-estimation" };

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

async function run(task, model, input, opts, report) {
  if (!device) await probe(opts.cfg || {});
  const pipe = await getPipe(task, model, report);
  report({ status: "running" });
  if (task === "asr") {
    const out = await pipe(input.audio, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5, task: "transcribe", ...(input.language ? { language: input.language } : {}) });
    return { text: out.text, chunks: (out.chunks || []).map((c) => ({ start: c.timestamp?.[0] ?? 0, end: c.timestamp?.[1] ?? null, text: c.text })) };
  }
  if (task === "tts") { const out = await pipe(input.text); const a = Array.isArray(out) ? out[0] : out; return { blob: a.toBlob(), seconds: a.data.length / a.sampling_rate }; }
  // image tasks take a Blob; the pipeline reads it through an object URL
  const url = URL.createObjectURL(input.blob);
  try {
    if (task === "bg") { const img = await pipe(url); return { blob: await img.toBlob("image/png") }; }
    if (task === "upscale") { const img = await pipe(url); return { blob: await img.toBlob("image/png"), width: img.width, height: img.height }; }
    if (task === "depth") { const r = await pipe(url); return { blob: await r.depth.toBlob("image/png"), width: r.depth.width, height: r.depth.height }; }
  } finally { URL.revokeObjectURL(url); }
  throw new Error("Unknown task " + task);
}

self.onmessage = async ({ data: m }) => {
  const report = (p) => self.postMessage({ id: m.id, type: "progress", p: { status: p.status, file: p.file, progress: p.progress, loaded: p.loaded, total: p.total, message: p.message } });
  try {
    const result = m.op === "probe" ? await probe(m.cfg || {}) : await run(m.task, m.model, m.input || {}, m.opts || {}, report);
    self.postMessage({ id: m.id, type: "result", result });
  } catch (e) {
    self.postMessage({ id: m.id, type: "error", error: String(e && e.message || e) });
  }
};
