// v196: team review on editor projects — comments on frames, versions, shared projects.
//   A project stays the owner's (data/projects139/<owner>/<id>.json); the owner invites people by email (an invite is claimed the
//   first time that person lists their projects) or with a link token. A member with the "review" role opens the project and
//   comments; one with the "edit" role also saves. Comments and versions live beside the project file (<id>.c196.json,
//   <id>.v196.json + <id>.v196.<n>.json, at most 30 versions). These routes are registered before the v139 project routes, so a
//   member's GET / PUT /v1/projects/:id reaches the owner's project; the owner's own calls fall through unchanged.
//   GET  /v1/projects                         → the v139 list + the projects shared with me (shared196: {owner, role})
//   GET  /v1/projects/:id · PUT · DELETE      → member: read (any role) · save (edit) · leave the share
//   GET  /v1/projects/:id/role196             → {role: "owner" | "edit" | "review", owner}
//   GET/POST /v1/projects/:id/comments196 · PATCH /:cid {done} · DELETE /:cid
//   GET/POST /v1/projects/:id/versions196 {name} · POST /:n/restore
//   GET/POST/DELETE /v1/projects/:id/share196 (owner) · POST …/share196/link {role|null} · POST /v1/projects196/join {token}
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { user, allUsers, save, col } from "./store.js";
import { listProjects139, getProject139, saveProject139, projDir139, HOOK139 } from "./projects139.js";

const bad = (en, ar, code = 400) => Object.assign(new Error(en), { code, errorAr: ar });
const okId = (id) => /^[a-z0-9]{6,24}$/i.test(String(id || ""));
const ROLES = ["review", "edit"];
const MAXC = 500, MAXV = 30;
const shares = () => col("share196", {});
const rec = (id) => shares()[id] || null;
const emailOf = (uidv) => String((user(uidv).profile || {}).email || "").toLowerCase();
const nameOf = (uidv) => { const e = emailOf(uidv); return e ? e.split("@")[0] : "someone"; };
const roleOf = (uidv, id) => { const s = rec(id); if (!s) return null; if (s.owner === uidv) return "owner"; const m = s.members && s.members[uidv]; return m ? m.role : null; };
const ownerOf = (uidv, id) => { const s = rec(id); if (s) return s.owner; return (user(uidv).projects139 || {})[id] ? uidv : null; };
const ensure = (ownerUid, id) => { const S = shares(); if (!S[id]) S[id] = { owner: ownerUid, members: {}, invites: {}, link: null, at: Date.now() }; return S[id]; };
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const writeJ = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(v)); fs.renameSync(f + ".tmp", f); };
const cFile = (owner, id) => path.join(projDir139(owner), id + ".c196.json"), vFile = (owner, id) => path.join(projDir139(owner), id + ".v196.json"), vDoc = (owner, id, n) => path.join(projDir139(owner), id + ".v196." + n + ".json");

// an invite by email becomes a membership the first time that person lists their projects
function claimInvites(uidv) {
  const e = emailOf(uidv); if (!e) return; let changed = false;
  for (const [id, s] of Object.entries(shares())) { const inv = s.invites && s.invites[e]; if (inv && s.owner !== uidv) { s.members[uidv] = { role: inv.role, email: e, at: Date.now(), invited: inv.at }; delete s.invites[e]; changed = true; } }
  if (changed) save();
}
// who may open this project: the owner, or a member → {owner, role}; else null
function access(uidv, id) {
  if (!okId(id)) return null;
  if ((user(uidv).projects139 || {})[id]) return { owner: uidv, role: "owner" };
  const r = roleOf(uidv, id); return r ? { owner: rec(id).owner, role: r } : null;
}
const need = (uidv, id, roles) => { const a = access(uidv, id); if (!a) throw bad("That project isn't on your account.", "هذا المشروع ليس في حسابك.", 404); if (roles && !roles.includes(a.role)) throw bad("This project is shared with you for review only.", "هذا المشروع مشارك معك للمراجعة فقط.", 403); return a; };
const sharedList = (uidv) => Object.entries(shares()).filter(([, s]) => s.members && s.members[uidv]).map(([id, s]) => { const p = (user(s.owner).projects139 || {})[id]; return p ? { id, ...p, shared196: { owner: nameOf(s.owner), role: s.members[uidv].role } } : null; }).filter(Boolean);

export function registerCollab196(app, requireUser) {
  const wrap = (fn) => (req, res, next) => { try { const r = fn(req, res); if (r === undefined) return next(); if (r && typeof r.then === "function") r.then((v) => (v === undefined ? next() : res.json(v))).catch((e) => fail(res, e)); else res.json(r); } catch (e) { fail(res, e); } };
  const fail = (res, e) => res.status(e.code >= 400 && e.code < 600 ? e.code : 500).json({ error: e.message, ...(e.errorAr ? { errorAr: e.errorAr } : {}) });
  const noToken = (req) => { if (req.user.viaToken) throw bad("Team review is done from the app.", "تتم مراجعة الفريق من التطبيق.", 403); };

  app.get("/v1/projects", requireUser, wrap((req) => { claimInvites(req.user.uid); return { projects: listProjects139(req.user.uid).concat(sharedList(req.user.uid)).sort((a, b) => (b.updated || 0) - (a.updated || 0)) }; }));
  app.get("/v1/projects/:id", requireUser, wrap((req) => { const a = access(req.user.uid, req.params.id); if (!a || a.role === "owner") return undefined; const p = getProject139(a.owner, req.params.id); return { ...p, shared196: { owner: nameOf(a.owner), role: a.role } }; }));
  app.put("/v1/projects/:id", requireUser, wrap((req) => { const a = access(req.user.uid, req.params.id); if (!a || a.role === "owner") return undefined; noToken(req); if (a.role !== "edit") throw bad("This project is shared with you for review only — comment, don't save.", "هذا المشروع مشارك معك للمراجعة فقط — علّق ولا تحفظ.", 403);
    const body = HOOK139.beforeSave ? HOOK139.beforeSave(a.owner, req.params.id, req.body) : req.body; return { ...saveProject139(a.owner, req.params.id, { ...body, dev: true }), shared196: { owner: nameOf(a.owner), role: a.role } }; }));
  app.delete("/v1/projects/:id", requireUser, wrap((req) => { const a = access(req.user.uid, req.params.id); if (!a || a.role === "owner") return undefined; noToken(req); delete rec(req.params.id).members[req.user.uid]; save(); return { ok: true, left: true }; }));
  app.get("/v1/projects/:id/ops", requireUser, wrap((req) => { const a = access(req.user.uid, req.params.id); if (!a || a.role === "owner") return undefined; return { seq: 0, ops: [] }; }));
  app.get("/v1/projects/:id/role196", requireUser, wrap((req) => { const a = need(req.user.uid, req.params.id); return { role: a.role, owner: nameOf(a.owner), me: nameOf(req.user.uid), uid: req.user.uid }; }));

  // comments on frames
  app.get("/v1/projects/:id/comments196", requireUser, wrap((req) => { const a = need(req.user.uid, req.params.id); return { comments: readJ(cFile(a.owner, req.params.id), []) }; }));
  app.post("/v1/projects/:id/comments196", requireUser, wrap((req) => { noToken(req); const a = need(req.user.uid, req.params.id), b = req.body || {}, text = String(b.text || "").trim().slice(0, 1000);
    if (!text) throw bad("Write the comment first.", "اكتب التعليق أولاً."); const f = cFile(a.owner, req.params.id), list = readJ(f, []); if (list.length >= MAXC) throw bad("This project has 500 comments — resolve some first.", "في هذا المشروع 500 تعليق — أنهِ بعضها أولاً.", 409);
    const c = { id: crypto.randomBytes(5).toString("hex"), t: Math.max(0, +b.t || 0), x: Math.min(1, Math.max(0, +b.x || 0)), y: Math.min(1, Math.max(0, +b.y || 0)), text, by: req.user.uid, byName: String(b.name || nameOf(req.user.uid)).slice(0, 40), at: Date.now(), done: false };
    list.push(c); writeJ(f, list); return { comment: c, comments: list }; }));
  app.patch("/v1/projects/:id/comments196/:cid", requireUser, wrap((req) => { noToken(req); const a = need(req.user.uid, req.params.id), f = cFile(a.owner, req.params.id), list = readJ(f, []), c = list.find((x) => x.id === req.params.cid);
    if (!c) throw bad("That comment is gone.", "هذا التعليق لم يعد موجوداً.", 404); if (typeof (req.body || {}).done === "boolean") c.done = req.body.done; if (typeof (req.body || {}).text === "string" && (c.by === req.user.uid || a.role === "owner")) c.text = req.body.text.trim().slice(0, 1000) || c.text; writeJ(f, list); return { comment: c, comments: list }; }));
  app.delete("/v1/projects/:id/comments196/:cid", requireUser, wrap((req) => { noToken(req); const a = need(req.user.uid, req.params.id), f = cFile(a.owner, req.params.id), list = readJ(f, []), c = list.find((x) => x.id === req.params.cid);
    if (c && c.by !== req.user.uid && a.role !== "owner") throw bad("Only its author or the owner removes a comment.", "لا يحذف التعليق إلا كاتبه أو المالك.", 403); const out = list.filter((x) => x.id !== req.params.cid); writeJ(f, out); return { comments: out }; }));

  // versions — a named snapshot of the saved project
  app.get("/v1/projects/:id/versions196", requireUser, wrap((req) => { const a = need(req.user.uid, req.params.id); return { versions: readJ(vFile(a.owner, req.params.id), []) }; }));
  app.post("/v1/projects/:id/versions196", requireUser, wrap((req) => { noToken(req); const a = need(req.user.uid, req.params.id, ["owner", "edit"]), p = getProject139(a.owner, req.params.id), f = vFile(a.owner, req.params.id), list = readJ(f, []);
    const n = (list.length ? Math.max(...list.map((v) => v.n)) : 0) + 1, name = String((req.body || {}).name || "").trim().slice(0, 60) || ("v" + n), text = JSON.stringify(p.doc);
    writeJ(vDoc(a.owner, req.params.id, n), p.doc); list.push({ n, name, at: Date.now(), by: req.user.uid, byName: nameOf(req.user.uid), bytes: text.length, clips: (p.doc.ed.clips || []).length });
    while (list.length > MAXV) { const old = list.shift(); try { fs.unlinkSync(vDoc(a.owner, req.params.id, old.n)); } catch {} } writeJ(f, list); return { version: list[list.length - 1], versions: list }; }));
  app.post("/v1/projects/:id/versions196/:n/restore", requireUser, wrap((req) => { noToken(req); const a = need(req.user.uid, req.params.id, ["owner", "edit"]), list = readJ(vFile(a.owner, req.params.id), []), v = list.find((x) => String(x.n) === String(req.params.n));
    if (!v) throw bad("That version is gone.", "هذه النسخة لم تعد موجودة.", 404); const doc = readJ(vDoc(a.owner, req.params.id, v.n), null); if (!doc) throw bad("That version couldn't be read.", "تعذّرت قراءة هذه النسخة.", 404);
    const p = getProject139(a.owner, req.params.id); return { restored: v, ...saveProject139(a.owner, req.params.id, { name: p.name, doc, dev: true }) }; }));

  // sharing — the owner's business
  const owner = (req) => { const a = need(req.user.uid, req.params.id); if (a.role !== "owner") throw bad("Only the owner shares a project.", "المالك وحده يشارك المشروع.", 403); return ensure(req.user.uid, req.params.id); };
  const view = (s) => ({ members: Object.entries(s.members || {}).map(([u, m]) => ({ uid: u, role: m.role, email: m.email || emailOf(u) || nameOf(u), at: m.at })), invites: Object.entries(s.invites || {}).map(([e, i]) => ({ email: e, role: i.role, at: i.at })), link: s.link ? { role: s.link.role, token: s.link.token } : null });
  app.get("/v1/projects/:id/share196", requireUser, wrap((req) => view(owner(req))));
  app.post("/v1/projects/:id/share196", requireUser, wrap((req) => { noToken(req); const s = owner(req), b = req.body || {}, email = String(b.email || "").trim().toLowerCase(), role = ROLES.includes(b.role) ? b.role : "review";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad("That isn't an email address.", "هذا ليس بريداً إلكترونياً."); if (email === emailOf(req.user.uid)) throw bad("That's you — the project is already yours.", "هذا أنت — المشروع لك أصلاً.");
    if (Object.keys(s.members).length + Object.keys(s.invites).length >= 50) throw bad("A project is shared with 50 people at most.", "يُشارك المشروع مع 50 شخصاً على الأكثر.", 409);
    const hit = allUsers().find(([u, U]) => u !== req.user.uid && String((U.profile || {}).email || "").toLowerCase() === email);
    if (hit) s.members[hit[0]] = { role, email, at: Date.now() }; else s.invites[email] = { role, at: Date.now() }; save(); return view(s); }));
  app.delete("/v1/projects/:id/share196/:who", requireUser, wrap((req) => { noToken(req); const s = owner(req), w = decodeURIComponent(req.params.who).toLowerCase(); delete s.members[req.params.who]; delete s.invites[w]; for (const [u, m] of Object.entries(s.members)) if ((m.email || "").toLowerCase() === w) delete s.members[u]; save(); return view(s); }));
  app.post("/v1/projects/:id/share196/link", requireUser, wrap((req) => { noToken(req); const s = owner(req), role = (req.body || {}).role; s.link = ROLES.includes(role) ? { role, token: crypto.randomBytes(18).toString("base64url"), at: Date.now() } : null; save(); return view(s); }));
  app.post("/v1/projects196/join", requireUser, wrap((req) => { noToken(req); const tok = String((req.body || {}).token || ""); if (!/^[A-Za-z0-9_-]{16,40}$/.test(tok)) throw bad("That link isn't valid.", "هذا الرابط غير صالح.");
    const hit = Object.entries(shares()).find(([, s]) => s.link && s.link.token === tok); if (!hit) throw bad("That link was removed.", "أُزيل هذا الرابط.", 404); const [id, s] = hit;
    if (s.owner !== req.user.uid && !s.members[req.user.uid]) { s.members[req.user.uid] = { role: s.link.role, email: emailOf(req.user.uid), at: Date.now(), viaLink: true }; save(); }
    const p = (user(s.owner).projects139 || {})[id]; return { id, name: p ? p.name : "", role: s.owner === req.user.uid ? "owner" : s.members[req.user.uid].role, owner: nameOf(s.owner) }; }));
}
// deleting an account removes its shares and memberships
export function dropShares196(uidv) { const S = shares(); for (const [id, s] of Object.entries(S)) { if (s.owner === uidv) delete S[id]; else if (s.members && s.members[uidv]) delete s.members[uidv]; } save(); }
