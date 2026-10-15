// nooi 3D engine — one renderer for every 3D view on the site, built to never take the browser down:
//  · WebGPU where the device has it (it runs on Vulkan, Metal or Direct3D 12 underneath), otherwise WebGL2 — the same scene on both
//    (three.js r186: three/webgpu and three share one core, so every object works with either renderer)
//  · one canvas and one GPU context for the whole site, moved between pages instead of making new ones
//  · a quality tier per device (phone memory and cores, the GPU's name; software GPUs run "low") and a resolution that follows the
//    frame time, so a slow phone draws fewer pixels instead of freezing
//  · no drawing while the tab is hidden or the view is closed; everything a world made is freed when it closes
//  · if the GPU is lost (driver reset, memory pressure) the engine starts again by itself — on WebGL2 if WebGPU was the problem
// It knows nothing about worlds: public/world/world.js builds them, the page (index.html, v86) drives it.
export const TIERS = {
  low:  { name: "low", pr: [0.7, 1.25], aa: false, shadows: 0, terrain: 88, far: 260, inst: 3200, particles: 650, life: 0.45, clouds: 7, stars: 800, lights: 2, tex: 512, fps: 30, grass: 0 },
  mid:  { name: "mid", pr: [0.85, 1.75], aa: true, shadows: 1024, terrain: 128, far: 380, inst: 8000, particles: 1300, life: 0.8, clouds: 12, stars: 1500, lights: 3, tex: 1024, fps: 45, grass: 0.6 },
  high: { name: "high", pr: [1, 2], aa: true, shadows: 2048, terrain: 176, far: 520, inst: 16000, particles: 2400, life: 1, clouds: 18, stars: 2400, lights: 4, tex: 2048, fps: 60, grass: 1 }
};
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

export function detectTier() {
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches, mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  let gpu = "";
  try { const c = document.createElement("canvas"), gl = c.getContext("webgl2") || c.getContext("webgl");
    if (gl) { const x = gl.getExtension("WEBGL_debug_renderer_info"); gpu = String(x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || ""); const lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext(); } } catch {}
  const soft = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(gpu);
  let t = coarse ? (mem <= 4 || cores <= 4 ? "low" : "mid") : soft ? "low" : /intel|mali-g[0-5]|adreno \(tm\) [3-5]|powervr/i.test(gpu) ? "mid" : "high";
  const forced = ls.get("nooiWorldTier"); if (TIERS[forced]) t = forced;
  return { tier: t, gpu, soft, coarse, mem, cores };
}

// three.js r186 always sends swizzle:"rgba" (no change) when it makes a texture view; some Chrome builds type that field
// differently and throw, which would leave a black world. Leaving out a swizzle that changes nothing is the same request.
function guardTextureViews() {
  // when the GPU drops a WebGPU device, three.js's pending error checks reject with "Instance dropped…" — the engine already
  // moves the world to WebGL2 (recover()), so these are expected and kept out of the page's error log
  if (typeof window !== "undefined" && !window.__nooiGpuQuiet) { window.__nooiGpuQuiet = 1; window.addEventListener("unhandledrejection", (e) => { const m = String((e.reason && e.reason.message) || e.reason || ""); if (/Instance dropped|valid external Instance|device (is |was )?lost|GPUDevice was destroyed/i.test(m)) e.preventDefault(); }); }
  const P = typeof GPUTexture !== "undefined" && GPUTexture.prototype; if (!P || P.__nooiViews) return;
  const createView = P.createView; P.createView = function (d) { if (d && d.swizzle === "rgba") { const { swizzle, ...rest } = d; return createView.call(this, rest); } return createView.call(this, d); };
  P.__nooiViews = true;
}
async function pickBackend(pref) {
  if (pref === "webgl") return "webgl";
  const failed = /^webgl(?::(\d+))?$/.exec(ls.get("nooiWorldBackend") || "");
  if (pref !== "webgpu" && failed && (!failed[1] || Date.now() - +failed[1] < 7 * 864e5)) return "webgl";   // WebGPU failed on this device in the last week
  if (typeof navigator === "undefined" || !navigator.gpu) return "webgl";
  try { const a = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!a) return "webgl"; if ((a.isFallbackAdapter || (a.info && a.info.isFallbackAdapter)) && pref !== "webgpu") return "webgl"; return "webgpu"; } catch { return "webgl"; }
}

// load three.js once (the page's import map points "three" and "three/webgpu" at /vendor/three186/)
const NS = {};
export async function three(backend) { if (!NS[backend]) NS[backend] = await import(backend === "webgpu" ? "three/webgpu" : "three"); return NS[backend]; }

export function disposeTree(o) {
  if (!o) return;
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
    for (const m of ms) { for (const k of ["map", "normalMap", "roughnessMap", "emissiveMap", "alphaMap", "envMap"]) if (m[k] && m[k].dispose) m[k].dispose(); m.dispose(); }
    if (n.isInstancedMesh && n.dispose) n.dispose();
  });
  if (o.parent) o.parent.remove(o);
}

export async function createEngine(opts = {}) {
  const info = detectTier(), tier = { ...TIERS[opts.tier || info.tier] };
  let backend = await pickBackend(opts.prefer || ls.get("nooiWorldPrefer") || "auto");
  let T = await three(backend), renderer = null, canvas = null, host = null, ro = null;
  const fns = new Set(), state = { running: false, lost: false, destroyed: false, pr: Math.min(tier.pr[1], window.devicePixelRatio || 1), ema: 1000 / tier.fps, slow: 0, last: 0, t0: 0, sec: 0, frames: 0, fps: 0, capture: [] };
  const E = { T, tier, info, scene: null, camera: null, get backend() { return backend; }, get renderer() { return renderer; }, get canvas() { return canvas; }, get running() { return state.running; }, status: opts.onStatus || (() => {}) };

  async function make() {
    canvas = document.createElement("canvas"); canvas.className = "nw-canvas"; canvas.setAttribute("aria-label", "3D world"); canvas.tabIndex = 0;
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
    try {
      if (backend === "webgpu") { guardTextureViews(); renderer = new T.WebGPURenderer({ canvas, antialias: tier.aa, powerPreference: "high-performance" }); await renderer.init();
        renderer.onDeviceLost = (i) => { if (!state.destroyed) recover("webgpu device lost: " + ((i && i.message) || "")); }; }
      else renderer = new T.WebGLRenderer({ canvas, antialias: tier.aa, powerPreference: "high-performance", preserveDrawingBuffer: !!opts.preserve, failIfMajorPerformanceCaveat: false });
    } catch (e) {
      if (backend === "webgpu") { backend = "webgl"; ls.set("nooiWorldBackend", "webgl:" + Date.now()); T = E.T = await three("webgl"); return make(); }
      throw e;
    }
    renderer.setPixelRatio(state.pr);
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22; renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = tier.shadows > 0; renderer.shadowMap.type = T.PCFSoftShadowMap;
    if (backend === "webgl") {
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); state.lost = true; renderer.setAnimationLoop(null); E.status("lost"); }, false);
      canvas.addEventListener("webglcontextrestored", () => { state.lost = false; E.status("restored"); if (state.running) renderer.setAnimationLoop(frame); }, false);
    }
    if (host) { host.appendChild(canvas); size(); }
  }
  async function recover(why) {
    console.warn("nooi 3D:", why);
    E.status("recovering");
    const was = state.running; stop();
    try { renderer && renderer.dispose(); } catch {}
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (backend === "webgpu") { backend = "webgl"; ls.set("nooiWorldBackend", "webgl:" + Date.now()); T = E.T = await three("webgl"); }
    await make(); E.status("restored"); if (was) start();
  }
  function size() {
    if (!host || !renderer) return;
    const w = Math.max(1, host.clientWidth | 0), h = Math.max(1, host.clientHeight | 0);
    renderer.setSize(w, h, false);
    if (E.camera) { E.camera.aspect = w / h; E.camera.updateProjectionMatrix(); }
  }
  function frame() {
    const now = performance.now(); let dt = (now - (state.last || now)) / 1000; state.last = now; if (dt > 0.1) dt = 0.1;
    try { for (const f of fns) f(dt, now / 1000); if (E.scene && E.camera && !state.lost) renderer.render(E.scene, E.camera); }
    catch (e) { console.error("nooi 3D frame:", e); stop();
      // WebGPU drew nothing on this device: the same scene goes on in WebGL2 (and this device starts there next time)
      if (backend === "webgpu" && !state.fellBack) { state.fellBack = true; recover("webgpu frame failed: " + (e && e.message || e)); return; }
      E.status("error", e); return; }
    if (state.capture.length) { const cbs = state.capture.splice(0); for (const cb of cbs) { try { cb(); } catch (e) { console.warn(e); } } }
    // resolution follows the frame time (a phone that can't keep up draws fewer pixels)
    state.ema = state.ema * 0.92 + dt * 1000 * 0.08; state.frames++;
    if (now - state.sec > 1000) { state.fps = Math.round((state.frames * 1000) / (now - state.sec || 1)); state.frames = 0; state.sec = now;
      const target = 1000 / tier.fps;
      if (state.ema > target * 1.35 && state.pr > tier.pr[0] + 0.01) setPR(state.pr * 0.85);
      else if (state.ema < Math.max(17.5, target * 0.8) && state.pr < Math.min(tier.pr[1], window.devicePixelRatio || 1) - 0.01) setPR(state.pr * 1.08);
      state.slow = state.ema > 90 ? state.slow + 1 : 0; if (state.slow === 4 && E.onSlow) E.onSlow(); }
  }
  function setPR(v) { state.pr = Math.max(tier.pr[0], Math.min(tier.pr[1], v)); renderer.setPixelRatio(state.pr); size(); }
  function start() { if (state.destroyed || !renderer) return; state.running = true; state.last = 0; if (!document.hidden && !state.lost) renderer.setAnimationLoop(frame); }
  function stop() { state.running = false; if (renderer) renderer.setAnimationLoop(null); }
  const onVis = () => { if (!renderer) return; if (document.hidden) renderer.setAnimationLoop(null); else if (state.running && !state.lost) { state.last = 0; renderer.setAnimationLoop(frame); } };
  document.addEventListener("visibilitychange", onVis);

  await make();
  Object.assign(E, {
    attach(el) { if (!el) return; host = el; if (canvas.parentNode !== el) el.appendChild(canvas); if (ro) ro.disconnect(); if (typeof ResizeObserver === "function") { ro = new ResizeObserver(size); ro.observe(el); } size(); },
    detach() { stop(); if (ro) { ro.disconnect(); ro = null; } if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); host = null; },
    start, stop, size,   // (running is a live getter on E itself — Object.assign would copy its value once)
    onFrame(f) { fns.add(f); return () => fns.delete(f); },
    // the next drawn frame as a picture (taken right after it is drawn, so WebGL needs no preserved buffer)
    snapshot(maxW = 1600, type = "image/jpeg", q = 0.92) {
      return new Promise((ok, bad) => { const to = setTimeout(() => bad(new Error("The 3D view isn't drawing")), 4000);
        state.capture.push(() => { clearTimeout(to); const s = Math.min(1, maxW / canvas.width), c = document.createElement("canvas"); c.width = Math.round(canvas.width * s); c.height = Math.round(canvas.height * s);
          c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height); c.toBlob((b) => (b ? ok(b) : bad(new Error("No picture"))), type, q); });
        if (!state.running) { try { renderer.render(E.scene, E.camera); state.capture.splice(0).forEach((cb) => cb()); } catch (e) { bad(e); } } });
    },
    // a video of the canvas (MediaRecorder): returns {stop() → Promise<Blob>}
    record(fps = 30) {
      if (typeof MediaRecorder === "undefined" || !canvas.captureStream) throw new Error("This browser can't record video");
      const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"], mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const rec = new MediaRecorder(canvas.captureStream(fps), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: tier.name === "low" ? 4e6 : 8e6 }), parts = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); }; rec.start(500);
      return { mime: mime || "video/webm", stop: () => new Promise((ok) => { rec.onstop = () => ok(new Blob(parts, { type: (mime || "video/webm").split(";")[0] })); rec.stop(); }) };
    },
    stats() { const r = renderer.info || {}, rr = r.render || {}, m = r.memory || {};
      return { backend, tier: tier.name, fps: state.fps, frameMs: Math.round(state.ema * 10) / 10, pixelRatio: Math.round(state.pr * 100) / 100, calls: rr.calls ?? rr.drawCalls ?? 0, triangles: rr.triangles ?? 0, geometries: m.geometries ?? 0, textures: m.textures ?? 0, size: canvas ? [canvas.width, canvas.height] : [0, 0] }; },
    async useBackend(b) { ls.set("nooiWorldBackend", b === "webgl" ? "webgl" : null); if (b === backend) return; const was = state.running; stop(); try { renderer.dispose(); } catch {} if (canvas.parentNode) canvas.parentNode.removeChild(canvas); backend = b; T = E.T = await three(b); await make(); if (was) start(); },
    destroy() { state.destroyed = true; stop(); document.removeEventListener("visibilitychange", onVis); if (ro) ro.disconnect(); try { renderer.dispose(); if (backend === "webgl") { const gl = renderer.getContext && renderer.getContext(); const x = gl && gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); } } catch {} if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); fns.clear(); }
  });
  return E;
}
