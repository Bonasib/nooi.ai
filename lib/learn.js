// Bots that learn: every finished result teaches nooi Studio which engine model works best for each kind of shot.
// Feedback (from the job's owner only, read from the stored job — never trusted from the browser):
//   approve +1 good · make again / remove +0.5 bad · failed +1 bad (recorded by the server itself).
// Stats are kept per model × category; the browser turns them into a score (prior quality + what was learned + a small
// bonus for models that have been tried less) and the bots use it to pick a model for every shot.
// GET /v1/learn → { stats: { model: { cat: { g, b } } }, n } · POST /v1/learn { job, ev }
import { col, save, user } from "./store.js";
import { requireUser } from "./auth.js";
import { jobHooks } from "./jobs.js";

export const LEARN_CATS = ["people", "action", "product", "nature", "anime", "vfx", "general"];
const W = { approve: [1, 0], again: [0, 0.5], remove: [0, 0.5], fail: [0, 1] };
const data = () => col("learn", { stats: {}, n: 0, seen: {} });

export function learn(models, cat, ev, key) {
  const d = data(), w = W[ev]; if (!w) return false;
  if (key) { if (d.seen[key]) return false; d.seen[key] = Date.now();
    const ks = Object.keys(d.seen); if (ks.length > 6000) ks.sort((a, b) => d.seen[a] - d.seen[b]).slice(0, ks.length - 5000).forEach((k) => delete d.seen[k]); }
  cat = LEARN_CATS.includes(cat) ? cat : "general"; let hit = false;
  for (const m of [...new Set((models || []).map(String))].slice(0, 6)) { if (!m || m === "auto" || m.length > 40) continue;
    const s = (d.stats[m] = d.stats[m] || {}), c = (s[cat] = s[cat] || { g: 0, b: 0 }); c.g += w[0]; c.b += w[1]; hit = true; }
  if (hit) { d.n++; save(); } return hit;
}
const jobModels = (p) => (Array.isArray(p?.meta?.partModels) && p.meta.partModels.length ? p.meta.partModels : [p?.model]);

// the server learns from failures by itself
jobHooks.fail.push((uidv, job) => { if (job.parent) return; const p = job.payload || {}; if (!["video", "image"].includes(p.kind)) return; learn(jobModels(p), p.meta?.cat, "fail", "srv:" + job.id); });

export function registerLearn(app) {
  app.get("/v1/learn", (req, res) => { const d = data(); res.json({ stats: d.stats, n: d.n }); });
  app.post("/v1/learn", requireUser, (req, res) => {
    const b = req.body || {}, ev = String(b.ev || ""); if (!["approve", "again", "remove"].includes(ev)) return res.status(400).json({ error: "Unknown feedback" });
    const job = (user(req.user.uid).jobs || {})[String(b.job || "")]; if (!job || job.parent) return res.status(404).json({ error: "Not found" });
    const p = job.payload || {}; if (!["video", "image"].includes(p.kind)) return res.json({ ok: false });
    res.json({ ok: learn(jobModels(p), p.meta?.cat, ev, req.user.uid + ":" + job.id + ":" + ev) });
  });
}
