// nooi.ai · On-device 3D — local AI inference & 3D reconstruction. NOTHING leaves the device:
//   • detectDevice()      WebGPU adapter / limits / fp16, WebGL2, cores, memory → a plan (input size, mesh resolution, precision)
//   • IDBModelCache       model weights are downloaded once, then served from IndexedDB (works offline afterwards)
//   • LocalInference      a module Worker (this same file) running ONNX models with transformers.js on WebGPU (CPU/WASM fallback):
//                           Depth Anything V2 (small) → per-pixel depth · MODNet → cut-out matte (people, optional)
//   • reconstruct()       depth + subject mask → closed textured mesh. The surface is computed by a WebGPU compute shader
//                         (RECON_WGSL) in GPU storage buffers — every buffer is destroyed right after — with an identical CPU path.
//   • PBR maps            albedo from the photo, normal map from the depth relief, roughness from the photo's tone.
// Honest scope: one photo gives the visible side; the hidden side is a smooth closed shell, not an invented back.
const IS_WORKER = typeof window === "undefined" && typeof document === "undefined";
export const MODELS = { depth: "onnx-community/depth-anything-v2-small", matte: "Xenova/modnet" };
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
      if (op === "dispose") { for (const p of pipes.values()) { try { (await p).dispose?.(); } catch (e) {} } pipes.clear(); return send({ id, type: "result", result: true }); }
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
  const cell = 2 / Math.max(gw, gh), P = { thickness: (opts.depthScale ?? 0.35) * Math.max(gw, gh), relief: relief ? 1 : 0.7, round: relief ? 1 : Math.max(2, maxd * 0.45), maxd, cell, back: relief ? 0 : (opts.back ?? 0.45) };
  // 4. the surface — WebGPU compute when possible
  let S, on = "cpu"; const t0 = performance.now();
  if (navigator.gpu && WGSL && opts.gpu !== false) { try { S = await surfaceGPU(D, dist, gw, gh, P, WGSL); on = "webgpu"; } catch (e) { S = null; } }
  if (!S) S = surfaceCPU(D, dist, gw, gh, P);
  onStep("surface", on + " · " + Math.round(performance.now() - t0) + " ms");
  // 5. triangles (front, and the closing back unless it's a relief), UVs
  const vid = new Int32Array(n).fill(-1), pos = [], uv = [], nor = []; let nv = 0;
  for (let i = 0; i < n; i++) if (mask[i]) { vid[i] = nv++; const o = i * 4; pos.push(S.front[o], S.front[o + 1], S.front[o + 2]); nor.push(S.normal[o], S.normal[o + 1], S.normal[o + 2]); uv.push(((i % gw) + 0.5) / gw, 1 - (((i / gw) | 0) + 0.5) / gh); }
  const tri = []; for (let y = 0; y < gh - 1; y++) for (let x = 0; x < gw - 1; x++) { const a = vid[y * gw + x], b = vid[y * gw + x + 1], c = vid[(y + 1) * gw + x], d = vid[(y + 1) * gw + x + 1], k4 = (a >= 0) + (b >= 0) + (c >= 0) + (d >= 0);
    if (k4 === 4) tri.push(a, c, b, b, c, d); else if (k4 === 3) { if (a < 0) tri.push(b, c, d); else if (b < 0) tri.push(a, c, d); else if (c < 0) tri.push(a, d, b); else tri.push(a, c, b); } }
  const mkGeo = (P3, N3, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P3, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); if (N3) g.setAttribute("normal", new THREE.Float32BufferAttribute(N3, 3)); g.setIndex(idx); if (!N3) g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g; };
  const frontGeo = mkGeo(pos, nor, tri); let backGeo = null;
  if (!relief) { const bp = []; for (let i = 0; i < n; i++) if (mask[i]) { const o = i * 4; bp.push(S.back[o], S.back[o + 1], S.back[o + 2]); } const bt = tri.slice(); for (let i = 0; i < bt.length; i += 3) { const t = bt[i + 1]; bt[i + 1] = bt[i + 2]; bt[i + 2] = t; } backGeo = mkGeo(bp, null, bt); }
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
  if (backGeo) { const bc = document.createElement("canvas"); bc.width = tw; bc.height = th; const bx = bc.getContext("2d"); bx.filter = "blur(10px) brightness(0.85)"; bx.drawImage(albedo, 0, 0); const bm = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({ map: tex(bc, true), roughness: 0.8, metalness: 0 })); bm.name = "back"; bm.castShadow = bm.receiveShadow = true; group.add(bm); }
  onStep("maps", "albedo · normal · roughness");
  return { group, stats: { grid: [gw, gh], vertices: nv * (backGeo ? 2 : 1), triangles: (tri.length / 3) * (backGeo ? 2 : 1), surface: on, subject: how }, maps: { albedo, normal: nmC, roughness: rgC } };
}

// strict cleanup — geometry, materials and every texture on them
export function disposeObject(o) { if (!o) return; o.traverse((n) => { if (n.geometry) n.geometry.dispose(); const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : []; for (const m of ms) { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); } }); }
