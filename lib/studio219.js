// v219: nooi Studio Editor — the new timeline editor (studio/ monorepo, built into public/studio) on this server.
//  · /studio/vendor: the on-device person finder (v234)
//  · /studio and /studio/ serve the app (its own index.html; the files under /studio/assets are cached for a year — their names change)
//  · POST /v1/jobs/quote → the price in credits of a job before it runs (the same rule the job itself uses) and the balance
//  · the studio's projects are kept by the v139 project store (doc.studio), so the account, sharing, versions and comments stay one
import path from "path";
import http from "http";
import net from "net";
import express from "express";
import { priceOf, balance } from "./billing.js";

export function registerStudio219(app, { requireUser, isStaff }) {
  const dir = path.resolve("public/studio");
  app.use((req, res, next) => (req.method === "GET" && req.path === "/studio" ? res.redirect(301, "/studio/" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "")) : next()));
  app.use("/studio/assets", (req, res, next) => { res.set("Cache-Control", "public, max-age=31536000, immutable"); next(); }, express.static(path.join(dir, "assets"), { fallthrough: false }));
  // (v234) the on-device person finder (MediaPipe, Apache-2.0) — a folder with its version in the name, so it is cached for good
  app.use("/studio/vendor", (req, res, next) => { res.set("Cache-Control", "public, max-age=2592000, immutable"); next(); }, express.static(path.join(dir, "vendor"), { fallthrough: false, index: false,
    setHeaders: (res, f) => { if (f.endsWith(".mjs") || f.endsWith(".js")) res.setHeader("Content-Type", "text/javascript"); if (f.endsWith(".wasm")) res.setHeader("Content-Type", "application/wasm"); if (f.endsWith(".tflite")) res.setHeader("Content-Type", "application/octet-stream"); } }));
  app.get(["/studio/", "/studio/index.html"], (req, res) => { res.set("Cache-Control", "no-cache"); res.sendFile(path.join(dir, "index.html")); });
  app.post("/v1/jobs/quote", requireUser, (req, res) => {
    const b = req.body || {}; const kind = String(b.kind || "video");
    if (!/^[a-z0-9_-]{1,24}$/i.test(kind)) return res.status(400).json({ error: "Unknown kind." });
    let cost = 0;
    try { cost = Math.max(0, Math.round(priceOf(kind, { ...b, kind }) || 0)); } catch { cost = 0; }
    if (b.meta && b.meta.merge135) cost = 0;   // merging your own videos is free
    res.json({ cost: isStaff(req.user) ? 0 : cost, price: cost, credits: balance(req.user.uid) });   // (the team's own work costs nothing — like the job itself)
  });
}

// v219 S4: /render-api/* → the nooi Studio render service (studio/services/render-api, RENDER_API_URL). Streamed both ways (big
// resumable uploads, Server-Sent Events, downloads with Range); mounted before the JSON body reader so bodies pass untouched.
// Not set up → 503 {code:"off"} and the studio exports on the device only.
export function proxyRender219(app) {
  app.use("/render-api", (req, res) => {
    const base = process.env.RENDER_API_URL; if (!base) return res.status(503).json({ error: "Server rendering is not set up.", code: "off" });
    let u; try { u = new URL(base); } catch { return res.status(503).json({ error: "Server rendering is not set up.", code: "off" }); }
    const headers = { ...req.headers, host: u.host, "x-forwarded-host": req.headers.host || "", "x-forwarded-proto": req.protocol, "x-forwarded-for": [req.headers["x-forwarded-for"], req.socket.remoteAddress].filter(Boolean).join(", ") };
    const up = http.request({ hostname: u.hostname, port: u.port || 80, method: req.method, path: (u.pathname.replace(/\/$/, "") + req.url) || "/", headers }, (r) => {
      const h = { ...r.headers }; for (const k of Object.keys(h)) if (k.startsWith("access-control-")) delete h[k];   // this site's CORS rules apply (the app origins, the exposed upload headers)
      res.writeHead(r.statusCode || 502, h); r.pipe(res);
    });
    up.on("error", () => { if (!res.headersSent) res.status(502).json({ error: "The render service is not answering.", code: "down" }); else res.end(); });
    req.on("aborted", () => up.destroy());
    req.pipe(up);
  });
}
// WebSocket status (/render-api/ws/...) passes through too: call with the HTTP server app.listen returned
export function proxyRenderUpgrade219(server) {
  server.on("upgrade", (req, sock, head) => {
    const base = process.env.RENDER_API_URL; if (!base || !String(req.url || "").startsWith("/render-api/ws/")) return;
    let u; try { u = new URL(base); } catch { return sock.destroy(); }
    const up = net.connect(+(u.port || 80), u.hostname, () => {
      const lines = [`${req.method} ${u.pathname.replace(/\/$/, "")}${String(req.url).slice("/render-api".length)} HTTP/1.1`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(req.rawHeaders[i].toLowerCase() === "host" ? `Host: ${u.host}` : `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      up.write(lines.join("\r\n") + "\r\n\r\n"); if (head && head.length) up.write(head); up.pipe(sock); sock.pipe(up);
    });
    up.on("error", () => sock.destroy()); sock.on("error", () => up.destroy());
  });
}
