// nooi.ai · 3D Studio — on-device AI & 3D reconstruction. NOTHING leaves the device:
//   • detectDevice()      WebGPU adapter / limits / fp16, WebGL2, cores, memory → a plan (input size, mesh resolution, precision)
//   • IDBModelCache       model weights are downloaded once, then served from IndexedDB (works offline afterwards)
//   • LocalInference      a module Worker (this same file) running ONNX models with transformers.js on WebGPU (CPU/WASM fallback):
//                           Depth Anything V2 (small) → per-pixel depth · SlimSAM → tap-to-select any object · MODNet → people
//   • reconstruct()       depth + subject mask → closed textured mesh. The surface is computed by a WebGPU compute shader
//                         (RECON_WGSL) in GPU storage buffers — every buffer is destroyed right after — with an identical CPU path.
//                         shape "pillow" (people, animals, plants: a smooth rounded back) or "solid" (cars, furniture, buildings:
//                         the silhouette carried back to a real depth, sides and back painted from the object's own colours).
//   • PBR maps            albedo from the photo, normal map from the depth relief, roughness from the photo's tone.
// Honest scope: one photo shows one side; the hidden sides are estimated (shape + colours), not seen. For a fully generated
// object use a cloud engine (NVIDIA TRELLIS, AI views, Tripo3D, Meshy) from the 3D Studio's plan.
const IS_WORKER = typeof window === "undefined" && typeof document === "undefined";
export const MODELS = { depth: "onnx-community/depth-anything-v2-small", matte: "Xenova/modnet", sam: "Xenova/slimsam-77-uniform" };
const TF_URLS = ["/vendor/transformers/transformers.min.js", "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js"];

// ───────────────────────── IndexedDB model cache (transformers.js "custom cache": match / put) ─────────────────────────
export class IDBModelCache {
  constructor(name = "nooi-local3d-models") { this.name = name; this.db = null; }
  open() { if (this.db) return this.db; return (this.db = new Promise((ok, no) => { const r = indexedDB.open(this.name, 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); })); }
  async tx(mode, fn) { const db = await this.open(); return new Promise((ok, no) => { const t = db.transaction("files", mode), st = t.objectStore("files"); let out; Promise.resolve(fn(st)).then((v) => (out = v)); t.oncomplete = () => ok(out); t.onerror = () => no(t.error); t.onabort = () => no(t.error); }); }
  key(req) { return typeof req === "string" ? req : req.url; }
  async match(req) { const k = this.key(req); const rec = await this.tx("readonly", (st) => new Promise((ok) => { const g = st.get(k); g.onsuccess = () => ok(g.result || null); g.onerror = () => ok(null); }));
    if (!rec) return undefined; return new Response(rec.body, { status: 200, headers: { "content-type": rec.type || "application/octet-stream", "content-length": String(rec.body.byteLength) } }); }
  async put(req, res) { const body = await res.arrayBuffer(); if (!body.byteLength) return; await this.tx("readwrite", (st) => { st.put({ body, type: res.headers.get("content-type") || "", t: Date.now() }, this.key(req)); }); }
  async usage() { return this.tx("readonly", (st) => new Promise((ok) => { let n = 0, bytes = 0; const c = st.openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return ok({ files: n, bytes }); n++; bytes += cur.value.body.byteLength; cur.continue(); }; c.onerror = () => ok({ files: n, bytes }); })); }
  async clear() { await this.tx("readwrite", (st) => { st.clear(); }); }
}

// ───────────────────────── device detection ─────────────────────────
export async function detectDevice() {
  const ua = navigator.userAgent || "", ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1), mobile = ios || /Android|Mobile/i.test(ua);
  const out = { webgpu: false, adapter: null, fallbackAdapter: false, f16: false, limits: null, webgl2: false, cores: navigator.hardwareConcurrency || 2, memoryGB: navigator.deviceMemory || null, mobile, ios, advice: [] };
  try { const c = document.createElement("canvas"), gl = c.getContext("webgl2"); out.webgl2 = !!gl; if (gl) { const ext = gl.getExtension("WEBGL_debug_renderer_info"); out.webglRenderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); gl.getExtension("WEBGL_lose_context")?.loseContext(); } } catch (e) {}
  if (navigator.gpu) {
    try { const a = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (a) { const info = a.info || (a.requestAdapterInfo ? await a.requestAdapterInfo() : {}) || {};
        out.adapter = [info.vendor, info.architecture, info.description].filter(Boolean).join(" ") || "WebGPU adapter";
        out.fallbackAdapter = !!(a.isFallbackAdapter || info.isFallbackAdapter || /swiftshader/i.test(out.adapter));
        out.f16 = a.features.has("shader-f16"); out.limits = { maxBufferSize: a.limits.maxBufferSize, maxStorageBufferBindingSize: a.limits.maxStorageBufferBindingSize };
        out.webgpu = !out.fallbackAdapter; } } catch (e) {}
  }
  const low = mobile || (out.memoryGB && out.memoryGB <= 4);
  out.plan = { device: out.webgpu ? "webgpu" : "wasm", dtype: out.webgpu ? (out.f16 ? "fp16" : "fp32") : "q8", meshRes: low ? 160 : 256, texSize: low ? 1024 : 2048, disposeAfterRun: !!mobile };
  if (!out.webgpu) {
    out.advice.push(out.webgl2 ? "WebGPU isn't on in this browser — the AI runs on the CPU (slower) and 3D uses WebGL2." : "Neither WebGPU nor WebGL2 is available — try an up-to-date Chrome, Edge or Safari.");
    if (ios) out.advice.push("iPhone / iPad: Settings → Apps → Safari → Advanced → Feature Flags → turn on WebGPU (iOS 17/18), or update to iOS 26 where it is on.");
    else if (/Android/i.test(ua)) out.advice.push("Android: use Chrome 121 or newer (WebGPU is on by default on most Adreno / Mali GPUs).");
    else out.advice.push("Desktop: Chrome / Edge 113+, or Safari 26+. In Chrome you can also check chrome://gpu.");
  }
  return out;
}

// ───────────────────────── the worker side (this file, loaded with new Worker(url, {type:"module"})) ─────────────────────────
if (IS_WORKER) {
  let TF = null, device = "wasm", dtype = "q8"; const pipes = new Map();
  const send = (m, t) => self.postMessage(m, t || []);
  async function lib(cfg) {
    if (TF) return; let err;
    for (const u of cfg.tfUrls || TF_URLS) { try { TF = await import(u); break; } catch (e) { err = e; } }
    if (!TF) throw new Error("Couldn't load the AI library (" + (err && err.message) + ")");
    const env = TF.env; env.allowLocalModels = false; env.useBrowserCache = false;
    env.useCustomCache = true; env.customCache = new IDBModelCache();
    if (cfg.modelsHost) { env.remoteHost = cfg.modelsHost; env.remotePathTemplate = "{model}/resolve/{revision}/"; }
    if (cfg.ortBase && env.backends?.onnx?.wasm) { const sfx = "gpu" in navigator ? ".asyncify" : ""; env.backends.onnx.wasm.wasmPaths = { mjs: cfg.ortBase + "ort-wasm-simd-threaded" + sfx + ".mjs", wasm: cfg.ortBase + "ort-wasm-simd-threaded" + sfx + ".wasm" }; }
    device = cfg.device || "wasm"; dtype = cfg.dtype || "q8";
  }
  const report = (id) => (p) => send({ id, type: "progress", stage: p.status === "progress" || p.status === "download" || p.status === "initiate" || p.status === "done" ? "download" : "gpu", file: p.file, loaded: p.loaded, total: p.total, status: p.status, message: p.message });
  async function getPipe(task, model, id) {
    const k = task + "|" + model; if (pipes.has(k)) return pipes.get(k);
    const p = TF.pipeline(task, model, { device, dtype, progress_callback: report(id) }).catch(async (e) => {
      if (device !== "webgpu") throw e; send({ id, type: "progress", stage: "gpu", status: "fallback", message: "WebGPU failed (" + (e.message || e) + ") — using the CPU" });
      device = "wasm"; dtype = "q8"; return TF.pipeline(task, model, { device, dtype, progress_callback: report(id) }); });
    pipes.set(k, p); p.catch(() => pipes.delete(k)); return p;
  }
  let sam = null;
  async function getSam(id, name) {
    if (sam && sam.name === name) return sam; const opt = (d) => ({ device: d, dtype: d === "webgpu" ? "fp32" : "q8", progress_callback: report(id) }); let m;
    try { m = await TF.SamModel.from_pretrained(name, opt(device)); }
    catch (e) { if (device !== "webgpu") throw e; send({ id, type: "progress", stage: "gpu", status: "fallback", message: "WebGPU failed (" + (e.message || e) + ") — using the CPU" }); device = "wasm"; dtype = "q8"; m = await TF.SamModel.from_pretrained(name, opt("wasm")); }
    const processor = await TF.AutoProcessor.from_pretrained(name, { progress_callback: report(id) }); return (sam = { name, model: m, processor, emb: null, inputs: null });
  }
  self.onmessage = async (ev) => {
    const { id, op, cfg, blob, model } = ev.data || {};
    try {
      if (op === "init") { await lib(cfg || {}); return send({ id, type: "result", result: { device, dtype } }); }
      if (op === "depth") {
        const pipe = await getPipe("depth-estimation", model || MODELS.depth, id); send({ id, type: "progress", stage: "infer", status: "depth" });
        const img = await TF.RawImage.fromBlob(blob), t0 = performance.now(), out = await pipe(img), pd = out.predicted_depth, dims = pd.dims, h = dims[dims.length - 2], w = dims[dims.length - 1];
        const data = new Float32Array(pd.data); // relative inverse depth: larger = nearer
        return send({ id, type: "result", result: { depth: data, w, h, ms: Math.round(performance.now() - t0), device } }, [data.buffer]);
      }
      if (op === "matte") {
        const pipe = await getPipe("background-removal", model || MODELS.matte, id); send({ id, type: "progress", stage: "infer", status: "matte" });
        const img = await TF.RawImage.fromBlob(blob), t0 = performance.now(), out = await pipe(img), r = Array.isArray(out) ? out[0] : out, c = r.channels || 4, a = new Uint8Array(r.width * r.height);
        for (let i = 0; i < a.length; i++) a[i] = c === 4 ? r.data[i * 4 + 3] : r.data[i * c];
        return send({ id, type: "result", result: { alpha: a, w: r.width, h: r.height, ms: Math.round(performance.now() - t0) } }, [a.buffer]);
      }
      if (op === "samEmbed") { // encode the picture once; every tap afterwards only runs the small decoder
        const s = await getSam(id, model || MODELS.sam); send({ id, type: "progress", stage: "infer", status: "select" });
        const img = await TF.RawImage.fromBlob(blob), t0 = performance.now(); s.inputs = await s.processor(img); s.emb = await s.model.get_image_embeddings(s.inputs);
        return send({ id, type: "result", result: { w: img.width, h: img.height, ms: Math.round(performance.now() - t0), device } });
      }
      if (op === "samMask") {
        const s = sam; if (!s || !s.emb) throw new Error("Pick the photo again"); const rs = s.inputs.reshaped_input_sizes[0], pts = ev.data.points || [];
        const input_points = new TF.Tensor("float32", Float32Array.from(pts.flatMap((p) => [p.x * rs[1], p.y * rs[0]])), [1, 1, pts.length, 2]);
        const input_labels = new TF.Tensor("int64", BigInt64Array.from(pts.map((p) => BigInt(p.label ? 1 : 0))), [1, 1, pts.length]);
        const t0 = performance.now(), out = await s.model({ ...s.emb, input_points, input_labels });
        const masks = await s.processor.post_process_masks(out.pred_masks, s.inputs.original_sizes, s.inputs.reshaped_input_sizes), m = masks[0], sc = out.iou_scores.data;
        let best = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[best]) best = i;
        const H = m.dims[m.dims.length - 2], W = m.dims[m.dims.length - 1], off = best * W * H, a = new Uint8Array(W * H); for (let i = 0; i < a.length; i++) a[i] = m.data[off + i] ? 255 : 0;
        return send({ id, type: "result", result: { alpha: a, w: W, h: H, score: +sc[best].toFixed(3), ms: Math.round(performance.now() - t0) } }, [a.buffer]);
      }
      if (op === "dispose") { sam = null; for (const p of pipes.values()) { try { (await p).dispose?.(); } catch (e) {} } pipes.clear(); return send({ id, type: "result", result: true }); }
      throw new Error("Unknown op " + op);
    } catch (e) { send({ id, type: "error", error: String((e && e.message) || e) }); }
  };
}

// ───────────────────────── the page side ─────────────────────────
export class LocalInference {
  constructor({ onProgress, modelsHost, ortBase, plan } = {}) { this.onProgress = onProgress || (() => {}); this.cfg = { modelsHost, ortBase, device: plan?.device, dtype: plan?.dtype }; this.w = null; this.n = 0; this.wait = new Map(); }
  start() { if (this.w) return; this.w = new Worker(import.meta.url, { type: "module" });
    this.w.onmessage = (ev) => { const m = ev.data, p = this.wait.get(m.id); if (!p) return; if (m.type === "progress") return this.onProgress(m); this.wait.delete(m.id); m.type === "error" ? p.no(new Error(m.error)) : p.ok(m.result); };
    this.w.onerror = (e) => { for (const p of this.wait.values()) p.no(new Error(e.message || "Worker error")); this.wait.clear(); }; }
  call(op, data, transfer) { this.start(); const id = ++this.n; return new Promise((ok, no) => { this.wait.set(id, { ok, no }); this.w.postMessage({ id, op, ...data }, transfer || []); }); }
  async init() { if (!this.ready) this.ready = this.call("init", { cfg: this.cfg }).catch((e) => { this.ready = null; throw e; }); return this.ready; }
  async depth(blob) { await this.init(); return this.call("depth", { blob }); }
  async matte(blob) { await this.init(); return this.call("matte", { blob }); }
  async samEmbed(blob) { await this.init(); return this.call("samEmbed", { blob }); }
  async samMask(points) { return this.call("samMask", { points }); }
  async dispose() { if (this.w) { try { await this.call("dispose", {}); } catch (e) {} } }
  terminate() { if (this.w) { this.w.terminate(); this.w = null; this.ready = null; for (const p of this.wait.values()) p.no(new Error("stopped")); this.wait.clear(); } }
}

// ───────────────────────── reconstruction: depth + mask → closed mesh ─────────────────────────
const sample = (src, sw, sh, u, v) => { const x = Math.min(sw - 1.001, Math.max(0, u * (sw - 1))), y = Math.min(sh - 1.001, Math.max(0, v * (sh - 1))), x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * sw + x0;
  return (src[i] * (1 - fx) + src[i + 1] * fx) * (1 - fy) + (src[i + sw] * (1 - fx) + src[i + sw + 1] * fx) * fy; };
function otsu(vals) { const h = new Float64Array(256); let n = 0; for (const v of vals) { h[Math.min(255, Math.max(0, (v * 255) | 0))]++; n++; } let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i];
  let sB = 0, wB = 0, best = 0, t = 128; for (let i = 0; i < 256; i++) { wB += h[i]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += i * h[i]; const mB = sB / wB, mF = (sum - sB) / wF, b = wB * wF * (mB - mF) ** 2; if (b > best) { best = b; t = i; } } return t / 255; }
function largest(mask, w, h) { const lab = new Int32Array(w * h).fill(-1); let best = -1, bn = 0;
  for (let s = 0; s < w * h; s++) { if (!mask[s] || lab[s] >= 0) continue; let n = 0; const q = [s]; lab[s] = s; while (q.length) { const i = q.pop(); n++; const x = i % w, y = (i / w) | 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && mask[j] && lab[j] < 0) { lab[j] = s; q.push(j); } } if (n > bn) { bn = n; best = s; } }
  const out = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) out[i] = lab[i] === best ? 1 : 0;
  // fill holes: background reachable from the border stays background
  const reach = new Uint8Array(w * h), st = []; for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) { const i = st.pop(); if (reach[i] || out[i]) continue; reach[i] = 1; const x = i % w, y = (i / w) | 0; if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w); }
  for (let i = 0; i < w * h; i++) if (!reach[i]) out[i] = 1; return { mask: out, n: bn }; }
function distance(mask, w, h) { const d = new Float32Array(w * h); for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 1e6 : 0;
  const pass = (y0, y1, dy, x0, x1, dx) => { for (let y = y0; y !== y1; y += dy) for (let x = x0; x !== x1; x += dx) { const i = y * w + x; if (!d[i]) continue; let v = d[i];
      const px = x - dx, py = y - dy; if (px >= 0 && px < w) v = Math.min(v, d[i - dx] + 1); else v = Math.min(v, 1); if (py >= 0 && py < h) v = Math.min(v, d[i - dy * w] + 1); else v = Math.min(v, 1);
      if (px >= 0 && px < w && py >= 0 && py < h) v = Math.min(v, d[i - dy * w - dx] + 1.414); const qx = x + dx; if (qx >= 0 && qx < w && py >= 0 && py < h) v = Math.min(v, d[i - dy * w + dx] + 1.414); d[i] = v; } };
  pass(0, h, 1, 0, w, 1); pass(h - 1, -1, -1, w - 1, -1, -1); return d; }

// the surface on the GPU (WebGPU compute, storage buffers, everything destroyed afterwards)
async function surfaceGPU(D, dist, gw, gh, P, WGSL) {
  const a = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" }); if (!a) throw new Error("no adapter");
  const dev = await a.requestDevice(), n = gw * gh, made = [];
  try {
    const buf = (size, usage, data) => { const b = dev.createBuffer({ size: Math.max(16, Math.ceil(size / 4) * 4), usage, mappedAtCreation: !!data }); made.push(b); if (data) { new Float32Array(b.getMappedRange()).set(data); b.unmap(); } return b; };
    const S = GPUBufferUsage, inD = buf(n * 4, S.STORAGE, D), inT = buf(n * 4, S.STORAGE, dist), outF = buf(n * 16, S.STORAGE | S.COPY_SRC), outB = buf(n * 16, S.STORAGE | S.COPY_SRC), outN = buf(n * 16, S.STORAGE | S.COPY_SRC);
    const ub = dev.createBuffer({ size: 32, usage: S.UNIFORM | S.COPY_DST }); made.push(ub);
    const pv = new ArrayBuffer(32), dv = new DataView(pv); dv.setUint32(0, gw, true); dv.setUint32(4, gh, true); [P.thickness, P.relief, P.round, P.maxd, P.cell, P.back].forEach((v, i) => dv.setFloat32(8 + i * 4, v, true)); dev.queue.writeBuffer(ub, 0, pv);
    const mod = dev.createShaderModule({ code: WGSL }), pipe = dev.createComputePipeline({ layout: "auto", compute: { module: mod, entryPoint: "main" } });
    const bg = dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [inD, inT, outF, outB, outN, ub].map((b, i) => ({ binding: i, resource: { buffer: b } })) });
    const read = [outF, outB, outN].map(() => buf(n * 16, S.MAP_READ | S.COPY_DST)), enc = dev.createCommandEncoder(), pass = enc.beginComputePass();
    pass.setPipeline(pipe); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(Math.ceil(n / 64)); pass.end();
    [outF, outB, outN].forEach((b, i) => enc.copyBufferToBuffer(b, 0, read[i], 0, n * 16)); dev.queue.submit([enc.finish()]);
    const res = []; for (const r of read) { await r.mapAsync(GPUMapMode.READ); res.push(new Float32Array(r.getMappedRange().slice(0))); r.unmap(); }
    return { front: res[0], back: res[1], normal: res[2] };
  } finally { for (const b of made) { try { b.destroy(); } catch (e) {} } try { dev.destroy(); } catch (e) {} }
}
function surfaceCPU(D, dist, gw, gh, P) {
  const n = gw * gh, front = new Float32Array(n * 4), back = new Float32Array(n * 4), normal = new Float32Array(n * 4);
  const prof = (i) => Math.sqrt(Math.min(1, Math.max(0, dist[i] / Math.max(P.round, 1))));
  const hAt = (x, y) => { x = Math.min(gw - 1, Math.max(0, x)); y = Math.min(gh - 1, Math.max(0, y)); const i = y * gw + x, d = D[i]; return d < 0 ? 0 : P.thickness * (P.relief * d + (1 - P.relief)) * prof(i); };
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x, px = (x - gw * 0.5) * P.cell, py = (gh * 0.5 - y) * P.cell, o = i * 4;
    if (D[i] < 0) { front.set([px, py, 0, 0], o); back.set([px, py, 0, 0], o); normal.set([0, 0, 1, 0], o); continue; }
    front.set([px, py, hAt(x, y) * P.cell, 1], o); back.set([px, py, -P.back * P.thickness * prof(i) * P.cell, 1], o);
    const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * 0.5, dy = (hAt(x, y - 1) - hAt(x, y + 1)) * 0.5, l = Math.hypot(dx, dy, 1); normal.set([-dx / l, -dy / l, 1 / l, 1], o); }
  return { front, back, normal };
}

// image (ImageBitmap | canvas), depth from the model, optional alpha matte → { group, stats } (needs THREE)
export async function reconstruct(THREE, { image, depth, alpha, plan, opts = {}, WGSL, onStep = () => {} }) {
  const res = opts.res || plan?.meshRes || 192, k = res / Math.max(image.width, image.height), gw = Math.max(16, Math.round(image.width * k)), gh = Math.max(16, Math.round(image.height * k)), n = gw * gh;
  onStep("grid", gw + "×" + gh);
  // 1. depth on the grid, robust normalisation (2nd–98th percentile)
  const Dr = new Float32Array(n); for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) Dr[y * gw + x] = sample(depth.depth, depth.w, depth.h, (x + 0.5) / gw, (y + 0.5) / gh);
  const sorted = Float32Array.from(Dr).sort(), lo = sorted[(n * 0.02) | 0], hi = sorted[(n * 0.98) | 0] || lo + 1, Dn = new Float32Array(n);
  for (let i = 0; i < n; i++) Dn[i] = Math.min(1, Math.max(0, (Dr[i] - lo) / (hi - lo || 1)));
  // 2. the subject: the AI matte when there is one, otherwise the near side of the depth (Otsu split), largest piece, holes filled
  let raw = new Uint8Array(n), how;
  if (alpha) { for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) raw[y * gw + x] = sample(alpha.alpha, alpha.w, alpha.h, (x + 0.5) / gw, (y + 0.5) / gh) > 110 ? 1 : 0; how = "matte"; }
  else { const t = otsu(Dn); for (let i = 0; i < n; i++) raw[i] = Dn[i] > t ? 1 : 0; how = "depth"; }
  let { mask, n: count } = largest(raw, gw, gh); let relief = false;
  if (opts.mode === "relief" || count < n * 0.02 || count > n * 0.93) { mask = new Uint8Array(n).fill(1); relief = true; how = "relief"; }
  onStep("mask", how + " · " + Math.round((100 * mask.reduce((a, b) => a + b, 0)) / n) + "%");
  // 3. depth inside the subject re-normalised; outside = -1
  let mn = 1, mx = 0; for (let i = 0; i < n; i++) if (mask[i]) { if (Dn[i] < mn) mn = Dn[i]; if (Dn[i] > mx) mx = Dn[i]; }
  const D = new Float32Array(n); for (let i = 0; i < n; i++) D[i] = mask[i] ? (Dn[i] - mn) / (mx - mn || 1) : -1;
  const dist = relief ? new Float32Array(n).fill(1e6) : distance(mask, gw, gh); let maxd = 1; for (let i = 0; i < n; i++) if (dist[i] < 1e5 && dist[i] > maxd) maxd = dist[i];
  // the subject's width in cells (for a "solid" object the back sits at length × width behind the front)
  let bx0 = gw, bx1 = 0; for (let i = 0; i < n; i++) if (mask[i]) { const x = i % gw; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; }
  const solid = !relief && opts.shape === "solid", subjW = Math.max(1, bx1 - bx0 + 1), thick = (opts.depthScale ?? (solid ? 0.12 : 0.35)) * Math.max(gw, gh);
  const cell = 2 / Math.max(gw, gh), P = { thickness: thick, relief: relief ? 1 : 0.7, round: relief ? 1 : Math.max(2, maxd * (solid ? 0.14 : 0.45)), maxd, cell,
    back: relief ? 0 : solid ? ((opts.length ?? 1) * subjW) / thick : (opts.back ?? 0.45) };
  // 4. the surface — WebGPU compute when possible
  let S, on = "cpu"; const t0 = performance.now();
  if (navigator.gpu && WGSL && opts.gpu !== false) { try { S = await surfaceGPU(D, dist, gw, gh, P, WGSL); on = "webgpu"; } catch (e) { S = null; } }
  if (!S) S = surfaceCPU(D, dist, gw, gh, P);
  onStep("surface", on + " · " + Math.round(performance.now() - t0) + " ms");
  // 4b. a solid object's hidden body: walls traced from its outline + a back (cars: a hood, side windows, wheels)
  const body = solid ? solidBody(THREE, { mask, D, gw, gh, cell, L: (opts.length ?? 1) * subjW * cell, vehicle: !!opts.vehicle, front: S.front }) : null;
  if (body) onStep("body", (opts.vehicle ? "vehicle · " : "") + body.walls.idx.length / 3 + " wall triangles");
  // 5. triangles (front, and the closing back unless it's a relief), UVs
  const vid = new Int32Array(n).fill(-1), pos = [], uv = [], nor = []; let nv = 0;
  for (let i = 0; i < n; i++) if (mask[i]) { vid[i] = nv++; const o = i * 4; pos.push(S.front[o], S.front[o + 1], S.front[o + 2]); nor.push(S.normal[o], S.normal[o + 1], S.normal[o + 2]); uv.push(((i % gw) + 0.5) / gw, 1 - (((i / gw) | 0) + 0.5) / gh); }
  const tri = []; for (let y = 0; y < gh - 1; y++) for (let x = 0; x < gw - 1; x++) { const a = vid[y * gw + x], b = vid[y * gw + x + 1], c = vid[(y + 1) * gw + x], d = vid[(y + 1) * gw + x + 1], k4 = (a >= 0) + (b >= 0) + (c >= 0) + (d >= 0);
    if (k4 === 4) tri.push(a, c, b, b, c, d); else if (k4 === 3) { if (a < 0) tri.push(b, c, d); else if (b < 0) tri.push(a, c, d); else if (c < 0) tri.push(a, d, b); else tri.push(a, c, b); } }
  const mkGeo = (P3, N3, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P3, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); if (N3) g.setAttribute("normal", new THREE.Float32BufferAttribute(N3, 3)); g.setIndex(idx); if (!N3) g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g; };
  const frontGeo = mkGeo(pos, body && body.vehicle ? null : nor, tri); let backGeo = null;
  if (!relief && !solid) { const bp = []; for (let i = 0; i < n; i++) if (mask[i]) { const o = i * 4; bp.push(S.back[o], S.back[o + 1], S.back[o + 2]); } const bt = tri.slice(); for (let i = 0; i < bt.length; i += 3) { const t = bt[i + 1]; bt[i + 1] = bt[i + 2]; bt[i + 2] = t; } backGeo = mkGeo(bp, null, bt); }
  // 6. PBR maps baked from the photo and the relief
  const T = Math.min(plan?.texSize || 2048, 2048), tk = T / Math.max(image.width, image.height), tw = Math.max(4, Math.round(image.width * tk)), th = Math.max(4, Math.round(image.height * tk));
  const albedo = document.createElement("canvas"); albedo.width = tw; albedo.height = th; const ax = albedo.getContext("2d"); ax.drawImage(image, 0, 0, tw, th);
  const px = ax.getImageData(0, 0, tw, th), nmC = document.createElement("canvas"), rgC = document.createElement("canvas"); nmC.width = rgC.width = gw; nmC.height = rgC.height = gh;
  const nmI = nmC.getContext("2d").createImageData(gw, gh), rgI = rgC.getContext("2d").createImageData(gw, gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x, o = i * 4, sx = Math.min(tw - 1, ((x + 0.5) / gw * tw) | 0), sy = Math.min(th - 1, ((y + 0.5) / gh * th) | 0), q = (sy * tw + sx) * 4;
    const r = px.data[q] / 255, g = px.data[q + 1] / 255, b = px.data[q + 2] / 255, mxc = Math.max(r, g, b), mnc = Math.min(r, g, b), lum = 0.2126 * r + 0.7152 * g + 0.0722 * b, sat = mxc ? (mxc - mnc) / mxc : 0;
    nmI.data[o] = (S.normal[i * 4] * 0.5 + 0.5) * 255; nmI.data[o + 1] = (S.normal[i * 4 + 1] * 0.5 + 0.5) * 255; nmI.data[o + 2] = (S.normal[i * 4 + 2] * 0.5 + 0.5) * 255; nmI.data[o + 3] = 255;
    const rough = Math.min(0.95, Math.max(0.25, 0.85 - 0.45 * Math.pow(lum, 3) - 0.15 * sat)); rgI.data[o] = rgI.data[o + 1] = rgI.data[o + 2] = rough * 255; rgI.data[o + 3] = 255; }
  nmC.getContext("2d").putImageData(nmI, 0, 0); rgC.getContext("2d").putImageData(rgI, 0, 0);
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) { if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding; } t.anisotropy = 4; return t; };
  const mat = new THREE.MeshStandardMaterial({ map: tex(albedo, true), normalMap: tex(nmC), roughnessMap: tex(rgC), roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.6, 0.6) });
  const group = new THREE.Group(); group.name = "nooi_local3d"; const fm = new THREE.Mesh(frontGeo, mat); fm.name = "front"; fm.castShadow = fm.receiveShadow = true; group.add(fm);
  if (body) addBody(THREE, group, body, { albedo, mask, gw, gh, tex });
  if (backGeo) { const bc = solid ? fillTexture(albedo, mask, gw, gh) : (() => { const c = document.createElement("canvas"); c.width = tw; c.height = th; const bx = c.getContext("2d"); bx.filter = "blur(10px) brightness(0.85)"; bx.drawImage(albedo, 0, 0); return c; })();
    const bm = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({ map: tex(bc, true), roughness: solid ? 0.55 : 0.8, metalness: solid ? 0.15 : 0 })); bm.name = "back"; bm.castShadow = bm.receiveShadow = true; group.add(bm); }
  onStep("maps", "albedo · normal · roughness");
  const extraV = body ? body.walls.pos.length / 3 + body.cap.pos.length / 3 : 0, extraT = body ? (body.walls.idx.length + body.cap.idx.length) / 3 : 0;
  return { group, stats: { grid: [gw, gh], vertices: nv * (backGeo ? 2 : 1) + extraV, triangles: (tri.length / 3) * (backGeo ? 2 : 1) + extraT, surface: on, subject: how, shape: relief ? "relief" : solid ? (opts.vehicle ? "vehicle" : "solid") : "pillow", wheels: body && body.wheels ? 4 : 0 }, maps: { albedo, normal: nmC, roughness: rgC } };
}

// ───────────────────────── the hidden body of a solid object ─────────────────────────
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); };
function openMask(m, w, h, r) { // erode then dilate by r: thin parts (a car's mirrors) disappear, the body stays
  const d = distance(m, w, h), er = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) er[i] = m[i] && d[i] > r ? 1 : 0;
  const inv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = er[i] ? 0 : 1; const di = distance(inv, w, h), out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = m[i] && (er[i] || di[i] <= r + 0.5) ? 1 : 0; return largest(out, w, h).mask; }
function traceContour(m, w, h) { // Moore-neighbour tracing of the outer boundary
  let s = -1; for (let i = 0; i < w * h; i++) if (m[i]) { s = i; break; } if (s < 0) return [];
  const N = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]], inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
  const sx = s % w, sy = (s / w) | 0; let b = [sx, sy], c = [sx - 1, sy]; const pts = [[sx, sy]];
  for (let it = 0; it < w * h * 2; it++) { const k = N.findIndex((d) => b[0] + d[0] === c[0] && b[1] + d[1] === c[1]); let found = false;
    for (let t = 1; t <= 8; t++) { const j = (k + t) % 8, nx = b[0] + N[j][0], ny = b[1] + N[j][1]; if (inside(nx, ny)) { const pj = (k + t + 7) % 8; c = [b[0] + N[pj][0], b[1] + N[pj][1]]; b = [nx, ny]; found = true; break; } }
    if (!found || (b[0] === sx && b[1] === sy)) break; pts.push(b.slice()); }
  return pts; }
function smoothResample(P, n) { let A = P; for (let pass = 0; pass < 3; pass++) A = A.map((_, i) => { let x = 0, y = 0; for (let k = -2; k <= 2; k++) { const q = A[(i + k + A.length) % A.length]; x += q[0]; y += q[1]; } return [x / 5, y / 5]; });
  const len = [0]; for (let i = 1; i <= A.length; i++) len.push(len[i - 1] + Math.hypot(A[i % A.length][0] - A[i - 1][0], A[i % A.length][1] - A[i - 1][1])); const T = len[len.length - 1], out = []; let j = 0;
  for (let k = 0; k < n; k++) { const d = (k / n) * T; while (len[j + 1] < d) j++; const a = A[j], b = A[(j + 1) % A.length], f = (d - len[j]) / (len[j + 1] - len[j] || 1); out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); } return out; }
function solidBody(THREE, { mask, D, gw, gh, cell, L, vehicle, front }) {
  let x0 = gw, x1 = 0, y0 = gh, y1 = 0; for (let i = 0; i < gw * gh; i++) if (mask[i]) { const x = i % gw, y = (i / gw) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const body = vehicle ? openMask(mask, gw, gh, Math.max(1, Math.round((x1 - x0) * 0.045))) : mask, wy = (y) => (gh * 0.5 - y) * cell, wx = (x) => (x - gw * 0.5) * cell;
  const Ymin = wy(y1), Ymax = wy(y0), H = Math.max(cell, Ymax - Ymin); let belt = Ymin + H * 0.68, hood = 0;
  if (vehicle) { // the beltline: from the top, the first row as near as halfway between the roof rows and the nearest rows (the hood/windshield edge)
    const rm = []; for (let y = y0; y <= y1; y++) { let s = 0, c = 0; for (let x = x0; x <= x1; x++) { const i = y * gw + x; if (body[i] && D[i] >= 0) { s += D[i]; c++; } } rm.push(c ? s / c : 0); }
    const topN = Math.max(1, Math.round(rm.length * 0.08)), top = rm.slice(0, topN).reduce((a, b) => a + b, 0) / topN, mx = Math.max(...rm), thr = top + (mx - top) * 0.5; let br = Math.round(rm.length * 0.32);
    for (let k = 0; k < rm.length; k++) if (rm[k] >= thr) { br = k; break; } belt = Math.min(Ymin + H * 0.85, Math.max(Ymin + H * 0.45, wy(y0 + br))); hood = 0.26 * L; }
  // the cabin rows sit back by the hood's length, and the windshield leans back (rake) towards the roof
  const shift = (y) => (vehicle ? hood * smooth01(belt - 0.03 * H, belt + 0.03 * H, y) + 0.12 * L * Math.max(0, (y - belt) / Math.max(1e-6, Ymax - belt)) : 0), r = 0.2 * H, clear = vehicle ? r * 0.6 : 0, yc = (y) => Math.max(y, Ymin + clear);
  if (vehicle) for (let i = 0; i < gw * gh; i++) if (mask[i]) front[i * 4 + 2] -= shift(wy((i / gw) | 0));
  const raw = traceContour(body, gw, gh).map(([x, y]) => [wx(x), wy(y)]); if (raw.length < 8) return null; const pts = smoothResample(raw, Math.min(520, Math.max(64, raw.length)));
  let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; } const ccw = area > 0, N = pts.length;
  // walls
  const NZ = vehicle ? 44 : 14, pos = [], nor = [], glass = [], idx = [];
  for (let i = 0; i < N; i++) { const p = pts[(i - 1 + N) % N], q = pts[(i + 1) % N], tx = q[0] - p[0], ty = q[1] - p[1], l = Math.hypot(tx, ty) || 1, nx = (ccw ? ty : -ty) / l, ny = (ccw ? -tx : tx) / l, [x, y] = pts[i], zs = -shift(y);
    for (let k = 0; k <= NZ; k++) { const f = k / NZ, z = zs + (-L - zs) * f; pos.push(x, yc(y), z); nor.push(nx, ny * (y < Ymin + clear ? 0 : 1), 0);
      const zf = -z / L, pillar = Math.abs(zf - 0.55) < 0.025; glass.push(vehicle && y > belt + 0.05 * H && y < Ymax - 0.07 * H && zf > shift(y) / L + 0.03 && zf < 0.93 && !pillar ? 1 : 0); } }
  for (let i = 0; i < N; i++) for (let k = 0; k < NZ; k++) { const a = i * (NZ + 1) + k, b = ((i + 1) % N) * (NZ + 1) + k; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  { const A = idx[0] * 3, B = idx[1] * 3, C = idx[2] * 3, ux = pos[B] - pos[A], uy = pos[B + 1] - pos[A + 1], uz = pos[B + 2] - pos[A + 2], vx = pos[C] - pos[A], vy = pos[C + 1] - pos[A + 1], vz = pos[C + 2] - pos[A + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz; if (fx * nor[idx[0] * 3] + fy * nor[idx[0] * 3 + 1] < 0) for (let t = 0; t < idx.length; t += 3) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; } }
  // the back: the outline as a flat face at -L, facing backwards
  const shape = pts.map(([x, y]) => new THREE.Vector2(x, yc(y))), faces = THREE.ShapeUtils.triangulateShape(shape, []), cpos = [], cuv = [], cidx = [];
  for (const v of shape) { cpos.push(v.x, v.y, -L); cuv.push(0.5 + v.x / (cell * gw), 0.5 + v.y / (cell * gh)); }
  // earcut returns one fixed winding whatever the outline's direction, so measure it: the back must face away (−z)
  let fz = 0; for (const f of faces) { const a = shape[f[0]], b = shape[f[1]], c = shape[f[2]]; fz += (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
  for (const f of faces) fz > 0 ? cidx.push(f[0], f[2], f[1]) : cidx.push(f[0], f[1], f[2]);
  let wheels = null;
  if (vehicle) { let bx0 = gw, bx1 = 0; for (let y = Math.round(y1 - (y1 - y0) * 0.15); y <= y1; y++) for (let x = x0; x <= x1; x++) if (body[y * gw + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; }
    const Wb = (bx1 - bx0 + 1) * cell, cx = wx((bx0 + bx1 + 1) / 2), tw = 0.15 * Wb; wheels = { r, tw, y: Ymin + r, xs: [cx - Wb / 2 + tw * 0.42, cx + Wb / 2 - tw * 0.42], zs: [-0.18 * L, -0.76 * L] }; }
  return { vehicle, walls: { pos, nor, glass, idx }, cap: { pos: cpos, uv: cuv, idx: cidx }, wheels, belt, hood, H, L, Ymin, Ymax, clear };
}
function addBody(THREE, group, B, { albedo, mask, gw, gh, tex }) {
  // the paint: the median colour of the lower body (lights and deep shadows left out)
  const w = albedo.width, h = albedo.height, d = albedo.getContext("2d").getImageData(0, 0, w, h).data, R = [], G = [], Bl = [];
  for (let y = Math.round(h * 0.35); y < h * 0.8; y += 2) for (let x = 0; x < w; x += 2) { const gx = Math.min(gw - 1, ((x / w) * gw) | 0), gy = Math.min(gh - 1, ((y / h) * gh) | 0); if (!mask[gy * gw + gx]) continue; const i = (y * w + x) * 4, l = (d[i] + d[i + 1] + d[i + 2]) / 765; if (l < 0.03 || l > 0.75) continue; R.push(d[i]); G.push(d[i + 1]); Bl.push(d[i + 2]); }
  const med = (a) => (a.length ? a.sort((p, q) => p - q)[a.length >> 1] / 255 : 0.4), paint = new THREE.Color(med(R), med(G), med(Bl)); if (paint.convertSRGBToLinear) paint.convertSRGBToLinear();
  const glassC = new THREE.Color(0.02, 0.025, 0.03), cols = []; for (const g of B.walls.glass) { const c = g ? glassC : paint; cols.push(c.r, c.g, c.b); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(B.walls.pos, 3)); wg.setAttribute("normal", new THREE.Float32BufferAttribute(B.walls.nor, 3)); wg.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); wg.setIndex(B.walls.idx); wg.computeBoundingBox(); wg.computeBoundingSphere();
  const wm = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: B.vehicle ? 0.3 : 0.6, metalness: B.vehicle ? 0.45 : 0.08 })); wm.name = "sides"; wm.castShadow = wm.receiveShadow = true; group.add(wm);
  // the back face: a car gets a real rear painted on its own outline (glass, tail lights, plate, bumper) — never a copy of
  // its front; other solid objects get their own colours spread smoothly (no mirrored front details)
  const srgb = (a) => (a.length ? a.slice().sort((p, q) => p - q)[a.length >> 1] : 100), pc = [srgb(R), srgb(G), srgb(Bl)];
  const rc = B.vehicle ? paintRear(B, w, h, pc) : fillTexture(albedo, mask, gw, gh, 0.08);
  group.userData.rear = { B: { cap: B.cap, belt: B.belt, Ymin: B.Ymin, Ymax: B.Ymax, vehicle: B.vehicle }, w, h, rgb: pc }; // the reviewer can repaint it
  const cg = new THREE.BufferGeometry(); cg.setAttribute("position", new THREE.Float32BufferAttribute(B.cap.pos, 3)); cg.setAttribute("uv", new THREE.Float32BufferAttribute(B.cap.uv, 2)); cg.setIndex(B.cap.idx); cg.computeVertexNormals(); cg.computeBoundingBox(); cg.computeBoundingSphere();
  const cm = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: tex(rc, true), roughness: B.vehicle ? 0.32 : 0.6, metalness: B.vehicle ? 0.35 : 0.05 })); cm.name = "rear"; cm.userData.generated = B.vehicle ? "vehicle-rear" : "fill"; cm.castShadow = cm.receiveShadow = true; group.add(cm);
  if (B.wheels) { const W = B.wheels, tyre = new THREE.CylinderGeometry(W.r, W.r, W.tw, 28).rotateZ(Math.PI / 2), rim = new THREE.CylinderGeometry(W.r * 0.6, W.r * 0.6, W.tw * 1.04, 20).rotateZ(Math.PI / 2);
    const tm = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 }), rm = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.28, metalness: 0.9 });
    for (const x of W.xs) for (const z of W.zs) { const t = new THREE.Mesh(tyre, tm), m = new THREE.Mesh(rim, rm); t.position.set(x, W.y, z); m.position.set(x, W.y, z); t.name = "wheel"; m.name = "rim"; t.castShadow = m.castShadow = true; group.add(t, m); } }
}
// the hidden sides of a solid object: its own colours spread outwards from the visible pixels (a masked blur — the canvas
// blurs premultiplied colour, so reading it back gives the average of the subject's pixels only), with a little of the
// photo's detail mirrored in, slightly darker — so the sides & back look like the same object, not like smeared edges.
// a car's rear, painted on the outline of its body (the cap's UVs map the outline into this canvas):
// rear window (inset, rounded), two upright tail lights at the edges + a light bar, plate, tailgate seams, a darker bumper
export function paintRear(B, w, h, rgb) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"), uv = B.cap.uv, n = uv.length / 2;
  const P = []; for (let i = 0; i < n; i++) P.push([uv[i * 2] * w, (1 - uv[i * 2 + 1]) * h]);
  let top = h, bot = 0; for (const p of P) { if (p[1] < top) top = p[1]; if (p[1] > bot) bot = p[1]; } const Hc = Math.max(1, bot - top);
  const span = (y) => { let a = Infinity, b = -Infinity; for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) { const t = (y - p[1]) / (q[1] - p[1]), X = p[0] + (q[0] - p[0]) * t; if (X < a) a = X; if (X > b) b = X; } } return a < b ? [a, b] : null; };
  // world height → canvas row, read off the cap itself (its UVs are a linear map of its positions)
  let i0 = 0, i1 = 0; for (let i = 1; i < n; i++) { if (B.cap.pos[i * 3 + 1] < B.cap.pos[i0 * 3 + 1]) i0 = i; if (B.cap.pos[i * 3 + 1] > B.cap.pos[i1 * 3 + 1]) i1 = i; }
  const y0w = B.cap.pos[i0 * 3 + 1], y1w = B.cap.pos[i1 * 3 + 1], toY = (wy) => P[i0][1] + ((wy - y0w) / ((y1w - y0w) || 1)) * (P[i1][1] - P[i0][1]);
  const yb = Math.min(bot - Hc * 0.3, Math.max(top + Hc * 0.18, toY(B.belt))), col = (k, a = 1) => `rgba(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)},${a})`;
  x.fillStyle = col(1); x.fillRect(0, 0, w, h);
  x.save(); x.beginPath(); P.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); x.clip();
  const g = x.createLinearGradient(0, top, 0, bot); g.addColorStop(0, col(1.18)); g.addColorStop(0.5, col(1)); g.addColorStop(1, col(0.82)); x.fillStyle = g; x.fillRect(0, top, w, Hc);
  const rr = (X, Y, W, H, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); };
  // rear window
  const wt = top + Hc * 0.1, wb = yb - Hc * 0.05, st = span(wt + 2) || [0, w], sb = span(wb) || st, it = (st[1] - st[0]) * 0.12, ib = (sb[1] - sb[0]) * 0.11;
  if (wb > wt + 4) { x.beginPath(); x.moveTo(st[0] + it, wt); x.lineTo(st[1] - it, wt); x.lineTo(sb[1] - ib, wb); x.lineTo(sb[0] + ib, wb); x.closePath();
    const gg = x.createLinearGradient(0, wt, 0, wb); gg.addColorStop(0, "#0b0f13"); gg.addColorStop(0.55, "#161d24"); gg.addColorStop(1, "#0a0d10"); x.fillStyle = gg; x.fill();
    x.globalAlpha = 0.18; x.fillStyle = "#cfe3f2"; x.beginPath(); x.moveTo(st[0] + it * 1.6, wt + 3); x.lineTo(st[0] + it * 1.6 + (st[1] - st[0]) * 0.18, wt + 3); x.lineTo(sb[0] + ib * 1.6 + (sb[1] - sb[0]) * 0.05, wb - 3); x.lineTo(sb[0] + ib * 1.6, wb - 3); x.closePath(); x.fill(); x.globalAlpha = 1; }
  // tail lights (upright bars at the outer edges) + a thin light bar between them
  const ly0 = yb - Hc * 0.02, ly1 = yb + Hc * 0.3, sl = span((ly0 + ly1) / 2) || [0, w], bw = (sl[1] - sl[0]) * 0.075;
  for (const side of [0, 1]) { const X = side ? sl[1] - bw - (sl[1] - sl[0]) * 0.015 : sl[0] + (sl[1] - sl[0]) * 0.015; const lg = x.createLinearGradient(X, 0, X + bw, 0);
    lg.addColorStop(0, "#5a0508"); lg.addColorStop(0.5, "#e01b24"); lg.addColorStop(1, "#5a0508"); x.fillStyle = lg; rr(X, ly0, bw, ly1 - ly0, Math.min(bw, ly1 - ly0) * 0.25); x.fill();
    x.fillStyle = "rgba(255,190,190,.7)"; x.fillRect(X + bw * 0.42, ly0 + (ly1 - ly0) * 0.08, bw * 0.16, (ly1 - ly0) * 0.84); }
  const lb = yb + Hc * 0.07; x.fillStyle = "#a3121a"; x.fillRect(sl[0] + bw * 1.4, lb, (sl[1] - sl[0]) - bw * 2.8, Math.max(2, Hc * 0.012));
  // tailgate seams, plate, bumper
  x.strokeStyle = col(0.55); x.lineWidth = Math.max(1.5, Hc * 0.006); x.beginPath(); x.moveTo(sb[0] + ib * 0.7, wb + Hc * 0.015); x.lineTo(sb[1] - ib * 0.7, wb + Hc * 0.015); x.stroke();
  const sp = span(yb + Hc * 0.25) || sl, pw = (sp[1] - sp[0]) * 0.26, ph = Hc * 0.1, px = (sp[0] + sp[1]) / 2 - pw / 2, py = yb + Hc * 0.2; x.fillStyle = "#dfe3e6"; rr(px, py, pw, ph, ph * 0.15); x.fill(); x.strokeStyle = "#2b2f33"; x.lineWidth = Math.max(1.5, ph * 0.06); x.stroke();
  const bt = bot - Hc * 0.22, bg = x.createLinearGradient(0, bt, 0, bot); bg.addColorStop(0, col(0.62)); bg.addColorStop(0.15, col(0.9)); bg.addColorStop(1, col(0.45)); x.fillStyle = bg; x.fillRect(0, bt, w, bot - bt);
  const sbm = span(bt + Hc * 0.08) || sl; x.fillStyle = "#8d0f15"; for (const side of [0, 1]) x.fillRect(side ? sbm[1] - (sbm[1] - sbm[0]) * 0.1 : sbm[0] + (sbm[1] - sbm[0]) * 0.05, bt + Hc * 0.07, (sbm[1] - sbm[0]) * 0.05, Hc * 0.025);
  x.restore(); return c;
}
function fillTexture(albedo, mask, gw, gh, detail = 0.35) {
  const w = albedo.width, h = albedo.height, m = document.createElement("canvas"); m.width = gw; m.height = gh; const mi = m.getContext("2d").createImageData(gw, gh);
  for (let i = 0; i < gw * gh; i++) mi.data[i * 4 + 3] = mask[i] ? 255 : 0; m.getContext("2d").putImageData(mi, 0, 0);
  const cut = document.createElement("canvas"); cut.width = w; cut.height = h; const cx = cut.getContext("2d"); cx.drawImage(m, 0, 0, w, h); cx.globalCompositeOperation = "source-in"; cx.drawImage(albedo, 0, 0);
  const out = document.createElement("canvas"); out.width = w; out.height = h; const ox = out.getContext("2d"); const r = Math.max(6, Math.round(Math.max(w, h) * 0.03));
  for (const k of [4, 2, 1]) { ox.filter = "blur(" + r * k + "px)"; ox.drawImage(cut, 0, 0); } ox.filter = "none";
  const d = ox.getImageData(0, 0, w, h), a = d.data; for (let i = 0; i < a.length; i += 4) { a[i + 3] = 255; }
  ox.putImageData(d, 0, 0); if (detail > 0) { ox.globalAlpha = detail; ox.filter = "blur(2px)"; ox.drawImage(albedo, 0, 0); ox.globalAlpha = 1; ox.filter = "none"; }
  ox.globalCompositeOperation = "multiply"; ox.fillStyle = "rgb(205,205,205)"; ox.fillRect(0, 0, w, h); ox.globalCompositeOperation = "source-over"; return out;
}

// strict cleanup — geometry, materials and every texture on them
export function disposeObject(o) { if (!o) return; o.traverse((n) => { if (n.geometry) n.geometry.dispose(); const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : []; for (const m of ms) { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); } }); }
