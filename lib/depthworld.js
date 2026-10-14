// Photoreal 3D worlds ("Depth worlds"). The picture engine (Kie AI) paints the place the client describes — a wide photo or
// a 360° panorama — and a depth model measures how far away every pixel is. The browser turns the photo + depth into one
// light 3D surface (a displaced grid, torn where things are in front of each other) that any phone can look and walk around in.
// Depth, in order: your own endpoint (Admin → AI providers → Depth, or DEPTH_API_URL), fal.ai Depth Anything v2 (FAL_KEY),
// otherwise the client asks the picture engine itself for the depth map (an image-edit job).
//   GET  /v1/world/depth → {ready, engine}
//   POST /v1/world/depth {url} → {depth, engine}      (free: it is part of the world's picture price)
import { requireUser } from "./auth.js";
import { cfg } from "./settings.js";

export const depthEngine = () => (cfg("depth").baseUrl ? "custom" : cfg("fal").apiKey ? "fal" : null);
const FAL_DEPTH = "fal-ai/image-preprocessors/depth-anything/v2";
const pick = (d) => d && (d.depth?.url || d.depth || d.image?.url || d.images?.[0]?.url || d.images?.[0] || d.output?.[0] || d.url || d.image);
const last = new Map();

export async function depthOf(url) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    if (depthEngine() === "custom") {
      const c = cfg("depth"), r = await fetch(c.baseUrl, { method: "POST", signal: ac.signal, headers: { Authorization: "Bearer " + (c.apiKey || ""), "Content-Type": "application/json" }, body: JSON.stringify({ image: url, image_url: url }) });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(d.error || d.detail || "The depth engine refused the picture (" + r.status + ")"), { code: 502 });
      return pick(d);
    }
    const base = (cfg("fal").baseUrl || "https://fal.run").replace(/\/$/, "");
    const r = await fetch(base + "/" + FAL_DEPTH, { method: "POST", signal: ac.signal, headers: { Authorization: "Key " + cfg("fal").apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ image_url: url }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error((d.detail && (d.detail[0]?.msg || d.detail)) || d.error || "fal.ai depth failed (" + r.status + ")"), { code: 502 });
    return pick(d);
  } catch (e) { if (e.name === "AbortError") throw Object.assign(new Error("The depth engine took too long"), { code: 504 }); throw e; }
  finally { clearTimeout(to); }
}

export function registerDepthWorld(app) {
  app.get("/v1/world/depth", requireUser, (req, res) => res.json({ ready: !!depthEngine(), engine: depthEngine() }));
  app.post("/v1/world/depth", requireUser, async (req, res) => {
    try {
      if (!depthEngine()) return res.status(501).json({ error: "No depth engine connected" });
      let url = String(req.body?.url || "");
      if (url.startsWith("/")) { const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""); if (!base) return res.status(400).json({ error: "Set PUBLIC_BASE_URL so the depth engine can read the picture" }); url = base + url; }
      if (!/^https?:\/\/\S+$/.test(url) && !/^data:image\/(png|jpeg|webp);base64,/.test(url)) return res.status(400).json({ error: "Send the picture's URL" });
      const now = Date.now(), k = req.user.uid; if (now - (last.get(k) || 0) < 1500) return res.status(429).json({ error: "slow down" }); last.set(k, now);
      const depth = await depthOf(url); if (!depth) throw Object.assign(new Error("The depth engine returned no picture"), { code: 502 });
      res.json({ depth, engine: depthEngine() });
    } catch (e) { res.status(e.code || 502).json({ error: e.message }); }
  });
}
