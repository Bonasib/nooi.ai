// Explore: a public feed of generations people chose to share (Higgsfield-style), plus admin "featured" picks.
// GET /v1/explore (public) · POST /v1/explore (share) · POST /v1/explore/:id/like · POST /v1/explore/:id/feature (staff)
// DELETE /v1/explore/:id (owner or staff)
import { col, save, user, uid } from "./store.js";
import { requireUser } from "./auth.js";
import { isStaff } from "./admin.js";
import { moderate } from "./moderation.js";
import { credit } from "./billing.js";

const AUDIO157 = ["voice", "music", "sfx", "dub", "tts"];
export const EXPLORE_CATS = ["films", "motion", "anime", "vfx", "pixel", "marketing", "design", "ecommerce", "ugc", "music", "other"];
const items = () => col("explore", []);
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(e.code || 500).json({ error: e.message, ...(e.errorAr ? { errorAr: e.errorAr } : {}) }));
// v157: the creator program — a share can join it: the prompt is open for others to use (each new person who uses it earns the
// creator credits, within a daily cap), people follow the creator, write to them and ask to work together; a featured post and
// follower milestones earn more. Creators are known to others only by a public id (pid), never by their account id.
const CR157 = { use: 2, dayCap: 100, featured: 50, miles: [[10, 20], [100, 100], [1000, 500]], msgDay: 20 };
const creators = () => col("creators157", {}), inbox = () => col("inbox157", {});
const day = () => new Date().toISOString().slice(0, 10);
function creatorOf(uidv, make) { const C = creators(); if (!C[uidv] && make) { C[uidv] = { pid: "c" + uid(), joined: Date.now(), followers: [], earned: 0, day: "", dayEarned: 0 }; save(); } return C[uidv] || null; }
const byPid = (pid) => Object.entries(creators()).find(([, c]) => c.pid === pid) || [null, null];
const nameOf = (uidv) => { const U = user(uidv); return String(U.profile?.name || (U.profile?.email || "").split("@")[0] || "Creator").slice(0, 40); };
// credits for the creator, at most CR157.dayCap a day from uses (featured and milestones are not capped)
function reward157(uidv, n, why, ref, capped) { const c = creatorOf(uidv, true); if (c.day !== day()) { c.day = day(); c.dayEarned = 0; }
  if (capped) { n = Math.min(n, CR157.dayCap - c.dayEarned); if (n <= 0) return 0; c.dayEarned += n; }
  c.earned += n; credit(uidv, n, why, ref); save(); return n; }
const pub = (x, me) => { const c = x.program157 ? creators()[x.uid] : null;
  return { id: x.id, url: x.url, poster: x.poster || null, kind: x.kind, sub: x.sub || null, prompt: x.prompt, model: x.model || null, aspect: x.aspect || null, cat: x.cat, title: x.title || "",
    author: x.author || "Creator", created: x.created, likes: (x.likedBy || []).length, liked: !!(me && (x.likedBy || []).includes(me)), featured: !!x.featured, mine: !!(me && x.uid === me),
    program: !!x.program157, creator: c ? c.pid : null, followers: c ? c.followers.length : 0, following: !!(c && me && c.followers.includes(me)), uses: x.uses157 || 0 }; };
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
    // v156: the publisher confirms the content is theirs and their responsibility (the Publishing & Content Policy); when is kept
    if (b.agree !== true) throw Object.assign(new Error("Please confirm the content is yours and your responsibility (Publishing policy)"), { code: 400, errorAr: "يرجى تأكيد أن المحتوى لك وعلى مسؤوليتك (سياسة النشر)" });
    let url = null, kind = null, prompt = String(b.prompt || "").slice(0, 2000), model = b.model || null, aspect = b.aspect || null;
    let sub = null;   // (v157: voices, music and sounds can be shared too)
    if (b.jobId) { const j = U.jobs[b.jobId]; if (!j || j.status !== "done" || !j.url) throw Object.assign(new Error("Only finished generations can be shared"), { code: 400 }); url = j.url;
      kind = j.kind === "image" ? "image" : AUDIO157.includes(j.kind) ? "audio" : "video"; sub = j.kind; prompt = prompt || String(j.payload?.prompt || ""); model = model || j.payload?.model || null; aspect = aspect || j.payload?.aspect || null; }
    else if (mediaOk(b.url)) { url = b.url; kind = ["image", "audio"].includes(b.kind) ? b.kind : "video"; }
    else throw Object.assign(new Error("Nothing to share"), { code: 400 });
    if (!["video", "image", "audio"].includes(kind)) throw Object.assign(new Error("Only videos, images and sounds can be shared"), { code: 400 });
    const flag = moderate(prompt + " " + (b.title || "")); if (flag) throw Object.assign(new Error("Blocked by the Acceptable Use Policy (" + flag + ")"), { code: 422 });
    const mineToday = items().filter((x) => x.uid === req.user.uid && Date.now() - x.created < 864e5).length; if (mineToday >= 30) throw Object.assign(new Error("You can share 30 items a day"), { code: 429 });
    if (items().some((x) => x.uid === req.user.uid && x.url === url)) throw Object.assign(new Error("Already shared"), { code: 409 });
    const x = { id: uid(), uid: req.user.uid, url, kind, prompt, model, aspect, cat: EXPLORE_CATS.includes(b.cat) ? b.cat : "other", title: String(b.title || "").slice(0, 80),
      author: String(U.profile?.name || (U.profile?.email || "").split("@")[0] || "Creator").slice(0, 40), created: Date.now(), likedBy: [], featured: false, agreed156: Date.now(), sub,
      ...(b.program === true ? { program157: true, pid: creatorOf(req.user.uid, true).pid, uses157: 0, usedBy157: [] } : {}) };
    items().unshift(x); if (items().length > 5000) items().length = 5000; save(); res.json(pub(x, req.user.uid));
  }));
  app.post("/v1/explore/:id/like", requireUser, (req, res) => { const x = items().find((i) => i.id === req.params.id); if (!x) return res.status(404).json({ error: "Not found" }); x.likedBy = x.likedBy || []; const k = x.likedBy.indexOf(req.user.uid); k >= 0 ? x.likedBy.splice(k, 1) : x.likedBy.push(req.user.uid); save(); res.json(pub(x, req.user.uid)); });
  app.post("/v1/explore/:id/feature", requireUser, (req, res) => { if (!isStaff(req.user)) return res.status(403).json({ error: "Not allowed" }); const x = items().find((i) => i.id === req.params.id); if (!x) return res.status(404).json({ error: "Not found" }); x.featured = !x.featured;
    if (x.featured && x.program157 && !x.featBonus157) { x.featBonus157 = Date.now(); reward157(x.uid, CR157.featured, "Creator program: your post was featured", x.id, false); }
    save(); res.json(pub(x, req.user.uid)); });
  app.delete("/v1/explore/:id", requireUser, (req, res) => { const list = items(), k = list.findIndex((i) => i.id === req.params.id); if (k < 0) return res.status(404).json({ error: "Not found" }); if (list[k].uid !== req.user.uid && !isStaff(req.user)) return res.status(403).json({ error: "Not allowed" }); list.splice(k, 1); save(); res.json({ ok: true }); });
  // v157: someone uses a prompt (Recreate / Use this prompt): counted; a creator-program post earns its creator credits once per person
  app.post("/v1/explore/:id/use", requireUser, (req, res) => { const x = items().find((i) => i.id === req.params.id); if (!x) return res.status(404).json({ error: "Not found" });
    let earned = 0; if (x.program157 && x.uid !== req.user.uid && !(x.usedBy157 || []).includes(req.user.uid)) { x.usedBy157 = (x.usedBy157 || []).concat(req.user.uid).slice(-5000); x.uses157 = (x.uses157 || 0) + 1;
      earned = reward157(x.uid, CR157.use, "Creator program: someone used your prompt", x.id, true); }
    save(); res.json({ ...pub(x, req.user.uid), earned }); });
  // a creator's page: name, followers, their posts
  app.get("/v1/creators/me", requireUser, (req, res) => { const c = creatorOf(req.user.uid, false), m = inbox()[req.user.uid] || [];
    res.json({ creator: c ? { pid: c.pid, followers: c.followers.length, earned: c.earned, posts: items().filter((x) => x.uid === req.user.uid && x.program157).length } : null, unread: m.filter((x) => !x.read).length, rewards: CR157 }); });
  app.get("/v1/creators/:pid", requireUser, (req, res) => { const [uidv, c] = byPid(req.params.pid); if (!c) return res.status(404).json({ error: "Not found" });
    res.json({ pid: c.pid, name: nameOf(uidv), links: user(uidv).links173 || {}, followers: c.followers.length, following: c.followers.includes(req.user.uid), me: uidv === req.user.uid, open: c.open !== false,
      items: items().filter((x) => x.uid === uidv && x.program157 && !x.hidden).slice(0, 60).map((x) => pub(x, req.user.uid)) }); });
  app.post("/v1/creators/:pid/follow", requireUser, (req, res) => { const [uidv, c] = byPid(req.params.pid); if (!c) return res.status(404).json({ error: "Not found" });
    if (uidv === req.user.uid) return res.status(400).json({ error: "You can't follow yourself", errorAr: "لا يمكنك متابعة نفسك" });
    const k = c.followers.indexOf(req.user.uid); if (k >= 0) c.followers.splice(k, 1); else { c.followers.push(req.user.uid);
      c.miles = c.miles || []; for (const [n, cr] of CR157.miles) if (c.followers.length >= n && !c.miles.includes(n)) { c.miles.push(n); reward157(uidv, cr, `Creator program: ${n} followers`, c.pid + "-" + n, false); } }
    save(); res.json({ followers: c.followers.length, following: k < 0 }); });
  // a message or a request to work together (moderated; 20 a day; the reply goes back the same way)
  app.post("/v1/creators/:pid/message", requireUser, (req, res) => { const [uidv, c] = byPid(req.params.pid), b = req.body || {}; if (!c) return res.status(404).json({ error: "Not found" });
    if (uidv === req.user.uid) return res.status(400).json({ error: "That's you", errorAr: "هذا أنت" });
    const text = String(b.text || "").trim().slice(0, 1000); if (text.length < 2) return res.status(400).json({ error: "Write a message first", errorAr: "اكتب رسالة أولاً" });
    if (moderate(text)) return res.status(422).json({ error: "This message isn't allowed (Acceptable Use Policy)", errorAr: "هذه الرسالة غير مسموحة (سياسة الاستخدام المقبول)" });
    const me = creatorOf(req.user.uid, true), d = day(); me.msgDay = me.msgDay === d ? d : (me.msgN = 0, d); me.msgDay = d; if ((me.msgN || 0) >= CR157.msgDay) return res.status(429).json({ error: "You can send 20 messages a day", errorAr: "يمكنك إرسال 20 رسالة في اليوم" });
    me.msgN = (me.msgN || 0) + 1; const box = (inbox()[uidv] = inbox()[uidv] || []), item = b.item ? items().find((x) => x.id === String(b.item) && x.uid === uidv) : null;
    box.unshift({ id: uid(), from: me.pid, fromName: nameOf(req.user.uid), kind: b.kind === "collab" ? "collab" : "message", text, item: item ? { id: item.id, title: item.title || String(item.prompt || "").slice(0, 60) } : null, t: Date.now(), read: false });
    if (box.length > 200) box.length = 200; save(); res.json({ ok: true }); });
  app.get("/v1/inbox", requireUser, (req, res) => res.json({ items: inbox()[req.user.uid] || [] }));
  app.post("/v1/inbox/read", requireUser, (req, res) => { (inbox()[req.user.uid] || []).forEach((m) => { m.read = true; }); save(); res.json({ ok: true }); });
}
