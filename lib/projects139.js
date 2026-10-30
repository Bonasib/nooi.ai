// v139: editor projects kept on the server, per account — open them on any device. A project is the editor's own state (clips,
// texts, captions, effects, sounds, layers, the look) with every file as a /media address (a file that is only on the device is
// uploaded once, when the project is saved). The document lives in data/projects139/<account>/<id>.json; the list (name, length,
// clips, format, when) is kept in the account's record. At most 200 projects and 4 MB a project. Deleting the account deletes them.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { user, save } from "./store.js";

const ROOT = path.resolve("data/projects139"), MAX = 200, MAXB = 4 * 1024 * 1024;
const dir = (uid) => path.join(ROOT, crypto.createHash("sha1").update(String(uid)).digest("hex").slice(0, 24));
export const projDir139 = dir;   // (v196: comments and versions live beside the project file)
const okId = (id) => /^[a-z0-9]{6,24}$/i.test(String(id || ""));
const idx = (uid) => { const U = user(uid); return (U.projects139 = U.projects139 || {}); };
const bad = (en, ar, code = 400) => Object.assign(new Error(en), { code, errorAr: ar });
export const HOOK139 = { beforeSave: null };   // (v148: operations from AI agents applied to a save that hasn't seen them)

export function listProjects139(uid) {
  return Object.entries(idx(uid)).map(([id, p]) => ({ id, ...p })).sort((a, b) => (b.updated || 0) - (a.updated || 0));
}
export function getProject139(uid, id) {
  if (!okId(id) || !idx(uid)[id]) throw bad("That project isn't on your account.", "هذا المشروع ليس في حسابك.", 404);
  let doc = null; try { doc = JSON.parse(fs.readFileSync(path.join(dir(uid), id + ".json"), "utf8")); } catch {}
  if (!doc) throw bad("That project couldn't be read.", "تعذّرت قراءة هذا المشروع.", 404);
  return { id, ...idx(uid)[id], doc };
}
export function saveProject139(uid, id, body) {
  if (!okId(id)) throw bad("That isn't a project id.", "معرّف المشروع غير صالح.");
  const doc = body && body.doc, I = idx(uid);
  if (!doc || typeof doc !== "object" || !doc.ed || !Array.isArray(doc.ed.clips)) throw bad("That isn't an editor project.", "هذا ليس مشروع محرّر.");
  const text = JSON.stringify(doc);
  if (text.length > MAXB) throw bad("This project is too big to keep (over 4 MB of settings).", "هذا المشروع أكبر من أن يُحفظ (أكثر من 4 ميغابايت من الإعدادات).", 413);
  if (!I[id] && Object.keys(I).length >= MAX) throw bad("You have 200 projects — delete some to keep new ones.", "لديك 200 مشروع — احذف بعضها لحفظ مشاريع جديدة.", 409);
  // (v149: an automatic save from a device that hasn't seen another device's newer save is refused — that device asks first.
  // devAt is the last save from a device; the AI agents' changes move only "updated")
  const prev = I[id], devAt = (prev && (prev.devAt || prev.updated)) || 0;
  if (body.base != null && prev && devAt > +body.base) throw bad("This edit was changed on your other device.", "تغيّر هذا المونتاج على جهازك الآخر.", 409);
  fs.mkdirSync(dir(uid), { recursive: true });
  const f = path.join(dir(uid), id + ".json"); fs.writeFileSync(f + ".tmp", text); fs.renameSync(f + ".tmp", f);
  const now = Date.now(), cl = doc.ed.clips;
  const dur = cl.reduce((a, c) => a + Math.max(0.1, ((+c.out || 0) - (+c.in || 0)) / (+c.speed || 1)), 0);
  I[id] = { name: String(body.name || (I[id] && I[id].name) || "Edit").slice(0, 80), created: (I[id] && I[id].created) || now, updated: now, devAt: body.dev ? now : devAt || now,
    dur: Math.round(dur * 10) / 10, clips: cl.length, format: String(doc.ed.format || "").slice(0, 20), bytes: text.length };
  save(); return { id, ...I[id] };
}
export function deleteProject139(uid, id) {
  const I = idx(uid); if (!okId(id) || !I[id]) throw bad("That project isn't on your account.", "هذا المشروع ليس في حسابك.", 404);
  try { fs.unlinkSync(path.join(dir(uid), id + ".json")); } catch {}
  delete I[id]; save(); return { ok: true };
}
export function dropProjects139(uid) { try { fs.rmSync(dir(uid), { recursive: true, force: true }); } catch {} }

export function registerProjects139(app, requireUser) {
  const wrap = (fn) => (req, res) => { try { res.json(fn(req)); } catch (e) { res.status(e.code >= 400 && e.code < 600 ? e.code : 500).json({ error: e.message, ...(e.errorAr ? { errorAr: e.errorAr } : {}) }); } };
  app.get("/v1/projects", requireUser, wrap((req) => ({ projects: listProjects139(req.user.uid) })));
  app.get("/v1/projects/:id", requireUser, wrap((req) => getProject139(req.user.uid, req.params.id)));
  app.put("/v1/projects/:id", requireUser, wrap((req) => { if (req.user.viaToken) throw bad("Projects are saved from the app.", "تُحفظ المشاريع من التطبيق.", 403); return saveProject139(req.user.uid, req.params.id, { ...(HOOK139.beforeSave ? HOOK139.beforeSave(req.user.uid, req.params.id, req.body) : req.body), dev: true }); }));
  app.delete("/v1/projects/:id", requireUser, wrap((req) => { if (req.user.viaToken) throw bad("Projects are deleted from the app.", "تُحذف المشاريع من التطبيق.", 403); return deleteProject139(req.user.uid, req.params.id); }));
}
