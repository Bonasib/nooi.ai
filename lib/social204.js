// v204: the social layer the owner asked for, on top of Explore (lib/explore.js, lib/explore200.js).
//  · Profiles: a public page per creator (name, @handle, bio, picture, posts, followers, following, likes) found by public id or handle
//    — never by account id. The owner of a profile sets three permissions that the server enforces for everyone else:
//      download (the Download button / GET …/download), reuse (the prompt is shown and "Use this prompt" works) and
//      share (the share link carries "@handle on nooi.ai"; off = no share button for others).
//  · Stories: a finished picture or video on your story for 24 hours (10 at a time); a row of rings on Explore, the viewer marks seen.
//  · Views: each post counts one view per person (or browser) a day.
//  · Community: approved posts in four shelves — most prompt reuse, most liked, most viewed, nooi rewards picks. Staff approve posts
//    (or switch auto-approve on) and pick nooi rewards (the creator is credited once).
import crypto from "crypto";
import { col, save, user, uid } from "./store.js";
import { requireUser } from "./auth.js";
import { isStaff } from "./admin.js";
import { credit } from "./billing.js";
import { moderate } from "./moderation.js";
import { devMode } from "./safeurl.js";
import { S as settings } from "./settings.js";
import { hooks204 } from "./explore.js";
import fs from "fs";
import path from "path";
import { MEDIA_DIR } from "./media.js";

const items = () => col("explore", []), creators = () => col("creators157", {}), stories = () => col("stories204", {});
const views = () => col("views204", {});
const SOC = { storyTtl: 864e5, storyMax: 10, pickReward: 100, handle: /^[a-z0-9_.]{3,24}$/ };
const cfg = () => settings().community204 || (settings().community204 = { auto: false });
const mediaOk = (u) => /^(https?:\/\/[^/]+)?\/media\/[A-Za-z0-9._-]+$/.test(String(u || ""));
const soft = (req, res, next) => (req.headers.authorization || req.headers["x-dev-user"] || devMode() ? requireUser(req, res, next) : next());
const err = (res, code, en, ar) => res.status(code).json({ error: en, errorAr: ar });

function creatorOf(uidv) { const C = creators(); if (!C[uidv]) { C[uidv] = { pid: "c" + uid(), joined: Date.now(), followers: [], earned: 0, day: "", dayEarned: 0 }; save(); } return C[uidv]; }
const nameOf = (uidv) => { const U = user(uidv); return String(U.profile?.name || (U.profile?.email || "").split("@")[0] || "Creator").slice(0, 40); };
export function prof204(uidv) {
  const U = user(uidv); if (!U.profile204) U.profile204 = {};
  const p = U.profile204; p.perm = Object.assign({ download: true, reuse: true, share: true }, p.perm || {});
  if (!p.handle) { const base = nameOf(uidv).toLowerCase().normalize("NFKD").replace(/[^a-z0-9_.]+/g, "").slice(0, 16) || "creator"; let h = base.length >= 3 ? base : base + "_ai", n = 0;
    while (handleTaken(h, uidv)) h = base.slice(0, 16) + "_" + (++n + Math.floor(Math.random() * 90 + 10)); p.handle = h; save(); }
  return p;
}
function handleTaken(h, me) { const C = creators(); for (const u of Object.keys(C)) { if (u === me) continue; const p = user(u).profile204; if (p && p.handle === h) return true; } return false; }
const byPid = (pid) => Object.entries(creators()).find(([, c]) => c.pid === pid) || [null, null];
function find(who) { who = String(who || "").replace(/^@/, "").toLowerCase(); let [u, c] = byPid(who); if (c) return [u, c];
  for (const [uu, cc] of Object.entries(creators())) { const p = user(uu).profile204; if (p && p.handle === who) return [uu, cc]; } return [null, null]; }
const activeStories = (uidv) => (stories()[uidv] || []).filter((s) => s.until > Date.now());
const card = (uidv) => { const p = prof204(uidv), c = creatorOf(uidv); return { pid: c.pid, handle: p.handle, name: nameOf(uidv), avatar: p.avatar || null, story: activeStories(uidv).length > 0 }; };

// the fields every Explore post carries (the hook in lib/explore.js calls this for each one)
hooks204.pub = (x, me, o) => {
  const p = prof204(x.uid), mine = !!(me && x.uid === me);
  o.handle = p.handle; o.avatar = p.avatar || null; o.story = activeStories(x.uid).length > 0;
  o.canDownload = mine || p.perm.download !== false; o.canReuse = mine || p.perm.reuse !== false; o.canShare = mine || p.perm.share !== false;
  if (!o.canReuse) o.prompt = "";   // the prompt itself is not sent when the creator keeps it private
  o.views = x.views204 || 0; o.reuses = x.reuse204 || 0; o.approved = !!x.approved204 || !!cfg().auto; o.pick = !!x.pick204;
  if (!o.creator) o.creator = creatorOf(x.uid).pid;
  return o;
};
hooks204.use = (x, me) => { const p = prof204(x.uid); if (x.uid !== me && p.perm.reuse === false) return { error: "The creator keeps this prompt private", errorAr: "يحتفظ المبدع بهذا الوصف خاصاً" };
  x.reuse204 = (x.reuse204 || 0) + 1; return null; };

const pubPost = (x, me) => hooks204.pub(x, me, { id: x.id, url: x.url, poster: x.poster || null, kind: x.kind, sub: x.sub || null, prompt: x.prompt, model: x.model || null, aspect: x.aspect || null, cat: x.cat,
  title: x.title || "", author: x.author || "Creator", created: x.created, likes: (x.likedBy || []).length, liked: !!(me && (x.likedBy || []).includes(me)), featured: !!x.featured, mine: !!(me && x.uid === me),
  program: !!x.program157, creator: (creators()[x.uid] || {}).pid || null, uses: x.uses157 || 0 });

export function registerSocial204(app) {
  // ---- your own profile
  app.get("/v1/profile204/me", requireUser, (req, res) => { const p = prof204(req.user.uid), c = creatorOf(req.user.uid);
    res.json({ pid: c.pid, name: nameOf(req.user.uid), handle: p.handle, bio: p.bio || "", avatar: p.avatar || null, perm: p.perm }); });
  app.put("/v1/profile204/me", requireUser, (req, res) => { const b = req.body || {}, p = prof204(req.user.uid), U = user(req.user.uid);
    if (b.handle != null) { const h = String(b.handle).trim().replace(/^@/, "").toLowerCase();
      if (!SOC.handle.test(h)) return err(res, 400, "A handle is 3–24 letters, numbers, _ or .", "اسم المستخدم من 3 إلى 24 حرفاً أو رقماً أو _ أو .");
      if (handleTaken(h, req.user.uid)) return err(res, 409, "That handle is taken", "اسم المستخدم مأخوذ"); p.handle = h; }
    if (b.name != null) { const n = String(b.name).trim().slice(0, 40); if (n) { if (moderate(n)) return err(res, 422, "That name isn't allowed", "هذا الاسم غير مسموح"); U.profile = Object.assign(U.profile || {}, { name: n }); } }
    if (b.bio != null) { const t = String(b.bio).trim().slice(0, 160); if (t && moderate(t)) return err(res, 422, "That bio isn't allowed", "هذه النبذة غير مسموحة"); p.bio = t; }
    if (b.avatar !== undefined) { if (b.avatar === null) delete p.avatar; else if (mediaOk(b.avatar)) p.avatar = String(b.avatar); else return err(res, 400, "Upload the picture first", "ارفع الصورة أولاً"); }
    if (b.perm && typeof b.perm === "object") for (const k of ["download", "reuse", "share"]) if (typeof b.perm[k] === "boolean") p.perm[k] = b.perm[k];
    save(); res.json({ pid: creatorOf(req.user.uid).pid, name: nameOf(req.user.uid), handle: p.handle, bio: p.bio || "", avatar: p.avatar || null, perm: p.perm }); });
  // ---- anyone's profile (by public id or @handle)
  app.get("/v1/profile204/:who", soft, (req, res) => { const [uidv, c] = find(req.params.who); if (!c) return err(res, 404, "Not found", "غير موجود");
    const me = req.user ? req.user.uid : null, p = prof204(uidv), posts = items().filter((x) => x.uid === uidv && !x.hidden);
    const following = Object.values(creators()).filter((k) => (k.followers || []).includes(uidv)).length;
    res.json({ ...card(uidv), bio: p.bio || "", me: uidv === me, following: !!(me && c.followers.includes(me)), counts: { posts: posts.length, followers: c.followers.length, following, likes: posts.reduce((s, x) => s + (x.likedBy || []).length, 0) },
      perm: p.perm, items: posts.slice(0, 90).map((x) => pubPost(x, me)), stories: activeStories(uidv).map((s) => pubStory(s, me)) }); });
  // follow works for every creator (the v157 route only knew program members' ids — it finds any public id the same way)
  // ---- views (one per person or browser a day)
  app.post("/v1/explore/:id/view", soft, (req, res) => { const x = items().find((i) => i.id === req.params.id); if (!x) return err(res, 404, "Not found", "غير موجود");
    const who = req.user ? "u" + req.user.uid : "a" + crypto.createHash("sha1").update(String(req.ip || "") + String(req.headers["user-agent"] || "")).digest("hex").slice(0, 12);
    const day = new Date().toISOString().slice(0, 10), V = views(), key = x.id + "|" + day; if (!V[key]) V[key] = [];
    if (!V[key].includes(who)) { V[key].push(who); if (V[key].length > 20000) V[key].length = 20000; x.views204 = (x.views204 || 0) + 1;
      for (const k of Object.keys(V)) if (k.split("|")[1] < new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)) delete V[k]; save(); }
    res.json({ views: x.views204 || 0 }); });
  // ---- download, only when the creator allows it (the owner always can)
  app.get("/v1/explore/:id/download", soft, (req, res) => { const x = items().find((i) => i.id === req.params.id); if (!x || x.hidden) return err(res, 404, "Not found", "غير موجود");
    const me = req.user ? req.user.uid : null, p = prof204(x.uid); if (x.uid !== me && p.perm.download === false) return err(res, 403, "The creator doesn't allow downloads", "لا يسمح المبدع بالتنزيل");
    const f = mediaOk(x.url) && path.join(MEDIA_DIR, path.basename(String(x.url))); if (!f || !fs.existsSync(f)) return err(res, 404, "The file is not on this server", "الملف ليس على هذا الخادم");
    res.download(f, "nooi-" + (p.handle || "creator") + "-" + x.id + (String(x.url).match(/\.[a-z0-9]+$/i) || [".mp4"])[0]); });
  // ---- stories
  app.post("/v1/stories", requireUser, (req, res) => { const b = req.body || {}, U = user(req.user.uid); let url = null, kind = "image", poster = null;
    if (b.jobId) { const j = U.jobs && U.jobs[b.jobId]; if (!j || j.status !== "done" || !j.url) return err(res, 400, "Only finished pictures and videos can go on your story", "يمكن إضافة الصور والفيديوهات المكتملة فقط إلى قصتك"); url = j.url; kind = j.kind === "image" ? "image" : "video"; }
    else if (b.post) { const x = items().find((i) => i.id === String(b.post) && i.uid === req.user.uid); if (!x || x.kind === "audio") return err(res, 400, "Not your post", "ليس منشورك"); url = x.url; kind = x.kind; poster = x.poster || null; }
    else if (mediaOk(b.url)) { url = b.url; kind = b.kind === "video" ? "video" : "image"; } else return err(res, 400, "Nothing to add", "لا شيء لإضافته");
    const cap = String(b.caption || "").trim().slice(0, 120); if (cap && moderate(cap)) return err(res, 422, "That caption isn't allowed", "هذا التعليق غير مسموح");
    const S = stories(), mine = (S[req.user.uid] || []).filter((s) => s.until > Date.now()); if (mine.length >= SOC.storyMax) return err(res, 429, "10 stories at a time — wait for one to end", "10 قصص في وقت واحد — انتظر انتهاء إحداها");
    const s = { id: uid(), url, kind, poster, caption: cap, t: Date.now(), until: Date.now() + SOC.storyTtl, seen: [] }; S[req.user.uid] = mine.concat(s); creatorOf(req.user.uid); save(); res.json(pubStory(s, req.user.uid)); });
  app.get("/v1/stories", soft, (req, res) => { const me = req.user ? req.user.uid : null, S = stories(), out = [];
    for (const [u, list] of Object.entries(S)) { const live = list.filter((s) => s.until > Date.now()); if (live.length !== list.length) S[u] = live; if (!live.length) continue;
      const c = creatorOf(u); out.push({ ...card(u), mine: u === me, followed: !!(me && c.followers.includes(me)), seen: !!(me && live.every((s) => s.seen.includes(me))), items: live.map((s) => pubStory(s, me)) }); }
    out.sort((a, b) => (b.mine - a.mine) || (b.followed - a.followed) || (a.seen - b.seen) || (b.items.at(-1).t - a.items.at(-1).t)); res.json({ items: out.slice(0, 60) }); });
  app.post("/v1/stories/:sid/seen", requireUser, (req, res) => { for (const list of Object.values(stories())) { const s = list.find((x) => x.id === req.params.sid); if (s) { if (!s.seen.includes(req.user.uid)) { s.seen.push(req.user.uid); if (s.seen.length > 5000) s.seen.shift(); save(); } return res.json({ ok: true, views: s.seen.length }); } } err(res, 404, "Not found", "غير موجود"); });
  app.delete("/v1/stories/:sid", requireUser, (req, res) => { const S = stories(), list = S[req.user.uid] || [], k = list.findIndex((s) => s.id === req.params.sid); if (k < 0) return err(res, 404, "Not found", "غير موجود"); list.splice(k, 1); save(); res.json({ ok: true }); });
  // ---- Community: approved posts in four shelves (+ what waits for approval, for staff)
  app.get("/v1/community204", soft, (req, res) => { const me = req.user ? req.user.uid : null, auto = !!cfg().auto, staff = !!(req.user && isStaff(req.user));
    const ok = items().filter((x) => !x.hidden && x.kind !== "audio" && (auto || x.approved204)), top = (f) => ok.slice().sort((a, b) => f(b) - f(a) || b.created - a.created).filter((x) => f(x) > 0).slice(0, 18).map((x) => pubPost(x, me));
    res.json({ auto, staff, shelves: { reuse: top((x) => (x.reuse204 || 0) + (x.uses157 || 0)), liked: top((x) => (x.likedBy || []).length), viewed: top((x) => x.views204 || 0), picks: ok.filter((x) => x.pick204).sort((a, b) => b.pick204 - a.pick204).slice(0, 18).map((x) => pubPost(x, me)) },
      waiting: staff && !auto ? items().filter((x) => !x.hidden && x.kind !== "audio" && !x.approved204).slice(0, 30).map((x) => pubPost(x, me)) : [] }); });
  app.post("/v1/explore/:id/approve204", requireUser, (req, res) => { if (!isStaff(req.user)) return err(res, 403, "Not allowed", "غير مسموح"); const x = items().find((i) => i.id === req.params.id); if (!x) return err(res, 404, "Not found", "غير موجود");
    x.approved204 = x.approved204 ? 0 : Date.now(); if (!x.approved204 && x.pick204) x.pick204 = 0; save(); res.json(pubPost(x, req.user.uid)); });
  app.post("/v1/explore/:id/pick204", requireUser, (req, res) => { if (!isStaff(req.user)) return err(res, 403, "Not allowed", "غير مسموح"); const x = items().find((i) => i.id === req.params.id); if (!x) return err(res, 404, "Not found", "غير موجود");
    x.pick204 = x.pick204 ? 0 : Date.now(); if (x.pick204) { x.approved204 = x.approved204 || Date.now(); if (!x.pickPaid204) { x.pickPaid204 = Date.now(); credit(x.uid, SOC.pickReward, "nooi rewards: your post was picked", x.id); } } save(); res.json(pubPost(x, req.user.uid)); });
  app.put("/v1/community204", requireUser, (req, res) => { if (!isStaff(req.user)) return err(res, 403, "Not allowed", "غير مسموح"); cfg().auto = !!(req.body || {}).auto; save(); res.json({ auto: cfg().auto }); });
}
const pubStory = (s, me) => ({ id: s.id, url: s.url, kind: s.kind, poster: s.poster || null, caption: s.caption || "", t: s.t, until: s.until, seen: !!(me && s.seen.includes(me)), views: s.seen.length });
export { SOC as SOC204 };
