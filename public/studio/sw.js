// nooi Studio: the app shell works offline once opened (the media and projects live in IndexedDB on the device).
const CACHE = "nooi-studio-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/studio/", "/studio/index.html", "/studio/manifest.webmanifest", "/studio/icon.svg"]).catch(() => undefined))); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url); if (e.request.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith("/studio/")) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok && /\/studio\/(assets\/|index\.html$|$)/.test(u.pathname)) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match("/studio/index.html"))));
});
