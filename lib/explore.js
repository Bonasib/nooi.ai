// Explore: a public feed of generations people chose to share (Higgsfield-style), plus admin "featured" picks.
// GET /v1/explore (public) · POST /v1/explore (share) · POST /v1/explore/:id/like · POST /v1/explore/:id/feature (staff)
// DELETE /v1/explore/:id (owner or staff)
import { col, save, user, uid } from "./store.js";
import { requireUser } from "./auth.js";
import { isStaff } from "./admin.js";
import { moderate } from "./moderation.js";

export const EXPLORE_CATS = ["films", "motion", "anime", "vfx", "pixel", "marketing", "design", "ecommerce", "ugc", "music", "other"];
const items = () => col("explore", []);
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(e.code || 500).json({ error: e.message }));
const pub = (x, me) => ({ id: x.id, url: x.url, poster: x.poster || null, kind: x.kind, prompt: x.prompt, model: x.model || null, aspect: x.aspect || null, cat: x.cat, title: x.title || "",
  author: x.author || "Creator", created: x.created, likes: (x.likedBy || []).length, liked: !!(me && (x.likedBy || []).includes(me)), featured: !!x.featured, mine: !!(me && x.uid === me) });
const mediaOk = (u) => /^(https?:\/\/[^/]+)?\/media\/[A-Za-z0-9._-]+$/.test(String(u || ""));

export function registerExplore(app) {
  app.get("/v1/explore", (req, res) => {
    const { cat, type, sort } = req.query, me = null;
    let list = items().filter((x) => !x.hidden && (!cat || cat === "all" || x.cat === cat) && (!type || type === "all" || x.kind === type));
    if (sort === "trending") list = list.slice().sort((a, b) => (b.likedBy || []).length - (a.likedBy || []).length || b.created - a.created);
    else list = list.slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.created - a.created);
    res.json({ items: list.slice(0, 120).map((x) => pub(x, me)) });
  });
  app.get("/v1/explore/mine", requireUser, (req, res) => res.json({ items: items().filter((x) => x.uid === req.user.uid).map((x) => pub(x, req.user.uid)) }));
  app.post("/v1/explore", requireUser, wrap(async (req, res) => {
    const b = req.body || {}, U = user(req.user.uid);
    let url = null, kind = null, prompt = String(b.prompt || "").slice(0, 2000), model = b.model || null, aspect = b.aspect || null;
    if (b.jobId) { const j = U.jobs[b.jobId]; if (!j || j.status !== "done" || !j.url) throw Object.assign(new Error("Only finished generations can be shared"), { code: 400 }); url = j.url; kind = j.kind === "image" ? "image" : "video"; prompt = prompt || String(j.payload?.prompt || ""); model = model || j.payload?.model || null; aspect = aspect || j.payload?.aspect || null; }
    else if (mediaOk(b.url)) { url = b.url; kind = b.kind === "image" ? "image" : "video"; }
    else throw Object.assign(new Error("Nothing to share"), { code: 400 });
    if (!["video", "image"].includes(kind)) throw Object.assign(new Error("Only videos and images can be shared"), { code: 400 });
    const flag = moderate(prompt + " " + (b.title || "")); if (flag) throw Object.assign(new Error("Blocked by the Acceptable Use Policy (" + flag + ")"), { code: 422 });
    const mineToday = items().filter((x) => x.uid === req.user.uid && Date.now() - x.created < 864e5).length; if (mineToday >= 30) throw Object.assign(new Error("You can share 30 items a day"), { code: 429 });
    if (items().some((x) => x.uid === req.user.uid && x.url === url)) throw Object.assign(new Error("Already shared"), { code: 409 });
    const x = { id: uid(), uid: req.user.uid, url, kind, prompt, model, aspect, cat: EXPLORE_CATS.includes(b.cat) ? b.cat : "other", title: String(b.title || "").slice(0, 80),
      author: String(U.profile?.name || (U.profile?.email || "").split("@")[0] || "Creator").slice(0, 40), created: Date.now(), likedBy: [], featured: false };
    items().unshift(x); if (items().length > 5000) items().length = 5000; save(); res.json(pub(x, req.user.uid));
  }));
  app.post("/v1/explore/:id/like", requireUser, (req, res) => { const x = items().find((i) => i.id === req.params.id); if (!x) return res.status(404).json({ error: "Not found" }); x.likedBy = x.likedBy || []; const k = x.likedBy.indexOf(req.user.uid); k >= 0 ? x.likedBy.splice(k, 1) : x.likedBy.push(req.user.uid); save(); res.json(pub(x, req.user.uid)); });
  app.post("/v1/explore/:id/feature", requireUser, (req, res) => { if (!isStaff(req.user)) return res.status(403).json({ error: "Not allowed" }); const x = items().find((i) => i.id === req.params.id); if (!x) return res.status(404).json({ error: "Not found" }); x.featured = !x.featured; save(); res.json(pub(x, req.user.uid)); });
  app.delete("/v1/explore/:id", requireUser, (req, res) => { const list = items(), k = list.findIndex((i) => i.id === req.params.id); if (k < 0) return res.status(404).json({ error: "Not found" }); if (list[k].uid !== req.user.uid && !isStaff(req.user)) return res.status(403).json({ error: "Not allowed" }); list.splice(k, 1); save(); res.json({ ok: true }); });
}
