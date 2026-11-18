// v200: Explore, the social layer — comments under a shared video / picture / sound, the comment counts for the feed in one call,
// and the public creators list (names and public ids only, never account ids). Sits beside lib/explore.js (same "explore" store).
// GET /v1/explore/comments-count · GET /v1/explore/creators · GET /v1/explore/:id/comments · POST /v1/explore/:id/comments
// DELETE /v1/explore/:id/comments/:cid (author or staff)
import { col, save, user, uid } from "./store.js";
import { requireUser } from "./auth.js";
import { isStaff } from "./admin.js";
import { moderate } from "./moderation.js";
import { devMode } from "./safeurl.js";

const items = () => col("explore", []);
const comments = () => col("xpcomments200", {});
const creators = () => col("creators157", {});
const nameOf = (uidv) => { const U = user(uidv); return String(U.profile?.name || (U.profile?.email || "").split("@")[0] || "Creator").slice(0, 40); };
const pubC = (c, me) => ({ id: c.id, name: c.name, text: c.text, t: c.t, mine: !!(me && c.uid === me) });
const LIM200 = { day: 30, len: 500, keep: 500 };

export function registerExplore200(app) {
  // one call for the whole feed: how many comments each item has
  app.get("/v1/explore/comments-count", (req, res) => { const C = comments(), o = {}; for (const k of Object.keys(C)) if (C[k].length) o[k] = C[k].length; res.json({ counts: o }); });
  // creators people can follow: public id, name, followers, posts (everyone with at least one visible post — v204: every sharer has a public id)
  app.get("/v1/explore/creators", (req, res) => {
    const list = Object.entries(creators()).map(([u, c]) => ({ pid: c.pid, name: nameOf(u), followers: (c.followers || []).length, posts: items().filter((x) => x.uid === u && !x.hidden).length }))
      .filter((c) => c.posts > 0).sort((a, b) => b.followers - a.followers || b.posts - a.posts).slice(0, 12);
    res.json({ items: list });
  });
  // signed-in readers get their own comments marked; everyone else reads anonymously
  const soft = (req, res, next) => (req.headers.authorization || req.headers["x-dev-user"] || devMode() ? requireUser(req, res, next) : next());
  app.get("/v1/explore/:id/comments", soft, (req, res) => { const x = items().find((i) => i.id === req.params.id); if (!x || x.hidden) return res.status(404).json({ error: "Not found" });
    const me = req.user ? req.user.uid : null; res.json({ items: (comments()[x.id] || []).slice(-200).map((c) => pubC(c, me)) }); });
  app.post("/v1/explore/:id/comments", requireUser, (req, res) => {
    const x = items().find((i) => i.id === req.params.id); if (!x || x.hidden) return res.status(404).json({ error: "Not found" });
    const text = String((req.body || {}).text || "").trim().slice(0, LIM200.len);
    if (text.length < 2) return res.status(400).json({ error: "Write a comment first", errorAr: "اكتب تعليقاً أولاً" });
    const flag = moderate(text); if (flag) return res.status(422).json({ error: "Blocked by the Acceptable Use Policy (" + flag + ")", errorAr: "محظور بموجب سياسة الاستخدام المقبول" });
    const C = comments(), all = Object.values(C).flat(), today = all.filter((c) => c.uid === req.user.uid && Date.now() - c.t < 864e5).length;
    if (today >= LIM200.day) return res.status(429).json({ error: "You can write " + LIM200.day + " comments a day", errorAr: "يمكنك كتابة " + LIM200.day + " تعليقاً في اليوم" });
    const c = { id: uid(), uid: req.user.uid, name: nameOf(req.user.uid), text, t: Date.now() };
    C[x.id] = (C[x.id] || []).concat(c).slice(-LIM200.keep); save(); res.json({ item: pubC(c, req.user.uid), count: C[x.id].length });
  });
  app.delete("/v1/explore/:id/comments/:cid", requireUser, (req, res) => {
    const C = comments(), list = C[req.params.id] || [], k = list.findIndex((c) => c.id === req.params.cid); if (k < 0) return res.status(404).json({ error: "Not found" });
    if (list[k].uid !== req.user.uid && !isStaff(req.user)) return res.status(403).json({ error: "Not allowed" });
    list.splice(k, 1); save(); res.json({ ok: true, count: list.length });
  });
}
