// nooi.ai — the device cache ("drip" loading). Finished media — pictures, sounds, 3D files, captions — is kept on this
// device after the first view, so galleries, the editor and 3D worlds open instantly (and offline). Only files under
// /media/ (immutable: every file has a unique name) are cached; never the app itself, never an API answer, never a video
// range request (videos stream as usual). The cache is capped: the oldest files go first.
const C = "nooi-media-v1", MAX = 600, MAX_BYTES = 80e6;
const OK = /\.(png|jpe?g|webp|gif|avif|svg|glb|gltf|bin|hdr|exr|ktx2|mp3|m4a|aac|wav|ogg|opus|vtt|srt)$/i;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => { for (const k of await caches.keys()) if (k.startsWith("nooi-media-") && k !== C) await caches.delete(k); await self.clients.claim(); })()));
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET" || r.headers.has("range")) return;
  let u; try { u = new URL(r.url); } catch { return; }
  if (u.origin !== self.location.origin || !u.pathname.startsWith("/media/") || !OK.test(u.pathname)) return;
  e.respondWith((async () => {
    const c = await caches.open(C), hit = await c.match(r, { ignoreSearch: true }); if (hit) return hit;
    const res = await fetch(r); const len = +res.headers.get("content-length") || 0;
    if (res.ok && res.status === 200 && res.type === "basic" && len < MAX_BYTES) e.waitUntil(c.put(r, res.clone()).then(() => trim(c)).catch(() => {}));
    return res;
  })());
});
async function trim(c) { const k = await c.keys(); if (k.length > MAX) for (const x of k.slice(0, k.length - MAX)) await c.delete(x); }
self.addEventListener("message", (e) => { if (e.data === "clear") e.waitUntil(caches.delete(C)); });
