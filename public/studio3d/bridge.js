// nooi.ai · 3D Studio — the bridge to the nooi app when the studio runs inside it (an iframe on the same origin).
// The app owns everything that costs credits or needs keys (they never reach the browser): NVIDIA TRELLIS, AI views,
// 360° skies, Tripo3D, Meshy, Skybox, AI vision — plus the library and the video editor. Standalone (e.g. a static copy on
// Hostinger) the studio still works fully on the device; the cloud steps simply show as "open in nooi.ai".
const Q = new URLSearchParams(location.search);
export const EMBED = Q.get("embed") === "1" && window.parent !== window;
let n = 0; const wait = new Map();
addEventListener("message", (e) => { if (e.origin !== location.origin || !e.data || e.data.type !== "x3d-res") return; const p = wait.get(e.data.id); if (!p) return; wait.delete(e.data.id); clearTimeout(p.t); e.data.ok ? p.ok(e.data.data) : p.no(new Error(e.data.error || "nooi didn't answer")); });
export function call(op, args = {}, { transfer = [], timeout = 60000 } = {}) {
  if (!EMBED) return Promise.reject(new Error("Open the 3D Studio inside nooi.ai to use this"));
  const id = ++n; return new Promise((ok, no) => { const t = setTimeout(() => { wait.delete(id); no(new Error("nooi didn't answer in time")); }, timeout); wait.set(id, { ok, no, t }); window.parent.postMessage({ type: "x3d-req", id, op, args }, location.origin, transfer); });
}
// follow cloud jobs until they finish (the app keeps polling its server; we only ask it about our ids)
export function follow(ids, onUpdate, { every = 2500, max = 15 * 60 * 1000 } = {}) {
  const t0 = Date.now(); let stop = false; const left = new Set(ids);
  (async function tick() { if (stop || !left.size) return; try { const r = await call("jobs", { ids: [...left] }); for (const j of r) { onUpdate(j); if (j.status === "complete" || j.status === "failed" || j.gone) left.delete(j.id); } } catch (e) {}
    if (Date.now() - t0 < max && left.size) setTimeout(tick, every); })();
  return () => { stop = true; };
}
