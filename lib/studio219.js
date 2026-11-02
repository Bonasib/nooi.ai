// v219: nooi Studio Editor — the new timeline editor (studio/ monorepo, built into public/studio) on this server.
//  · /studio and /studio/ serve the app (its own index.html; the files under /studio/assets are cached for a year — their names change)
//  · POST /v1/jobs/quote → the price in credits of a job before it runs (the same rule the job itself uses) and the balance
//  · the studio's projects are kept by the v139 project store (doc.studio), so the account, sharing, versions and comments stay one
import path from "path";
import express from "express";
import { priceOf, balance } from "./billing.js";

export function registerStudio219(app, { requireUser, isStaff }) {
  const dir = path.resolve("public/studio");
  app.use((req, res, next) => (req.method === "GET" && req.path === "/studio" ? res.redirect(301, "/studio/" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "")) : next()));
  app.use("/studio/assets", (req, res, next) => { res.set("Cache-Control", "public, max-age=31536000, immutable"); next(); }, express.static(path.join(dir, "assets"), { fallthrough: false }));
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
