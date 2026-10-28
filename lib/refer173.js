// v173 (the member dashboard, planned as v166): invite friends and earn. Every member has a code (R-XXXXXX) and a link
// (https://nooi.ai/?ref=CODE); shared with the link, or without it (just the code to type in, for places that hide links).
// A friend who signs up with it is counted as joined; when that friend buys a plan (a paid checkout, not a gift or a promo),
// they count as subscribed — once. Every 10 subscribed friends → bonus credits for the member (1,500 by default: a Basic
// month; the owner can change it in the settings as refer173.bonus / refer173.every). Guards: a code can't be your own, a
// friend is counted for one member only, only an account made in the last 14 days (that hasn't bought a plan yet) can take
// a code, and a friend who later deletes their account stays counted (the bonus was earned).
// GET /v1/refer · POST /v1/refer/claim {code} · GET/POST /v1/me/links (the member's own social links, shown on their creator page)
import crypto from "crypto";
import { col, save, user, hasUser } from "./store.js";
import { requireUser } from "./auth.js";
import { credit } from "./billing.js";
import { S } from "./settings.js";

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codes = () => col("refcodes173", {});
const base = () => (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") || "https://nooi.ai";
export const REFER173 = () => { const s = (S().refer173 || {}); return { bonus: Math.max(0, Math.round(+s.bonus || 1500)), every: Math.max(1, Math.round(+s.every || 10)), days: 14 }; };
const norm = (c) => { const s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^R(?=[A-Z0-9]{6}$)/, ""); return s.length === 6 ? "R-" + s : null; };
export const LINKS173 = ["instagram", "tiktok", "youtube", "x", "snapchat", "facebook", "linkedin", "website"];

function mine(uidv) { const u = user(uidv); if (!u.ref173) u.ref173 = { code: null, joined: [], subs: [], paid: 0, earned: 0 };
  if (!u.ref173.code) { let c; do { const b = crypto.randomBytes(6); c = "R-" + [...b].map((x) => ALPH[x % 32]).join(""); } while (codes()[c]); u.ref173.code = c; codes()[c] = uidv; save(); }
  return u.ref173; }
// (the next bonus is due at a fixed count — r.next — so a later change of "every" applies from the next bonus on, not backwards)
const nextAt = (r, R) => r.next || (r.paid + 1) * R.every;
export const view173 = (uidv) => { const r = mine(uidv), R = REFER173(), u = user(uidv), n = r.subs.length, toNext = Math.max(1, nextAt(r, R) - n);
  return { code: r.code, link: base() + "/?ref=" + encodeURIComponent(r.code), joined: r.joined.length, subscribed: n, every: R.every, bonus: R.bonus,
    toNext, progress: Math.max(0, R.every - toNext), earned: r.earned, bonuses: r.paid, invitedBy: !!u.ref173By, canJoin: canJoin(u) }; };
const view = view173;

// (an account can take a code while it is new — made in the last 14 days — and before it bought a plan)
const canJoin = (u) => { const made = u.profile?.created || 0; return !u.ref173By && !Object.values(u.payments || {}).some((p) => p.status === "paid" && p.snap?.plan && !p.snap?.gift) && !(made && Date.now() - made > REFER173().days * 864e5); };
// a friend signs up with a code
export function claim173(uidv, code) {
  const c = norm(code), owner = c && codes()[c], u = user(uidv), fail = (m, ar, k = 400) => Object.assign(new Error(m), { code: k, errorAr: ar });
  if (!owner || !hasUser(owner)) throw fail("This invite code doesn't exist", "رمز الدعوة هذا غير موجود", 404);
  if (owner === uidv) throw fail("That's your own code", "هذا رمزك أنت");
  if (u.ref173By) { if (u.ref173By === owner) return { ok: true, already: true }; throw fail("You already joined with another invite", "انضممت بدعوة أخرى من قبل", 409); }
  if (!canJoin(u)) throw fail("Invite codes are for new accounts", "رموز الدعوة للحسابات الجديدة", 409);
  if (user(owner).ref173By === uidv) throw fail("You invited this member yourself", "أنت من دعا هذا العضو", 409);
  u.ref173By = owner; u.ref173At = Date.now(); const r = mine(owner); if (!r.joined.includes(uidv)) r.joined.push(uidv); save();
  return { ok: true };
}
// the friend bought a plan: counted once; every R.every subscribed friends → the bonus
export function subscribed173(uidv) {
  const u = user(uidv), owner = u.ref173By; if (!owner || u.ref173Sub || !hasUser(owner)) return null;
  u.ref173Sub = Date.now(); const r = mine(owner), R = REFER173(); if (!r.subs.includes(uidv)) r.subs.push(uidv);
  let given = 0; r.next = nextAt(r, R);
  while (r.subs.length >= r.next) { r.paid++; if (R.bonus > 0) { credit(owner, R.bonus, `Invite bonus · ${r.subs.length} friends subscribed`, "ref173-" + r.paid); r.earned += R.bonus; given += R.bonus; } r.next += R.every; }
  save(); return { owner, given };
}

export function registerRefer173(app) {
  const wrap = (fn) => (req, res) => { try { res.json(fn(req)); } catch (e) { res.status(e.code || 500).json({ error: e.message, ...(e.errorAr ? { errorAr: e.errorAr } : {}) }); } };
  app.get("/v1/refer", requireUser, wrap((req) => view(req.user.uid)));
  const tries = new Map();
  app.post("/v1/refer/claim", requireUser, wrap((req) => { if (req.user.viaToken) throw Object.assign(new Error("Invites are taken on the site"), { code: 403 });
    const now = Date.now(), t = (tries.get(req.user.uid) || []).filter((x) => now - x < 600e3); if (t.length >= 10) throw Object.assign(new Error("Too many tries — wait a few minutes"), { code: 429, errorAr: "محاولات كثيرة — انتظر دقائق" });
    t.push(now); tries.set(req.user.uid, t); return { ...claim173(req.user.uid, req.body?.code), ...view(req.user.uid) }; }));
  app.get("/v1/me/links", requireUser, wrap((req) => ({ links: user(req.user.uid).links173 || {}, kinds: LINKS173 })));
  app.post("/v1/me/links", requireUser, wrap((req) => { const b = req.body?.links || {}, out = {};
    for (const k of LINKS173) { let v = String(b[k] || "").trim().slice(0, 200); if (!v) continue;
      if (k !== "website" && /^@?[A-Za-z0-9._-]{1,60}$/.test(v)) v = "@" + v.replace(/^@/, "");                   // a handle
      else if (!/^https?:\/\/[^\s<>"']+$/i.test(v)) { if (/^[^\s<>"']+\.[a-z]{2,}(\/[^\s<>"']*)?$/i.test(v)) v = "https://" + v; else throw Object.assign(new Error("Check the " + k + " link"), { code: 400, errorAr: "تحقق من رابط " + k }); }
      out[k] = v; }
    user(req.user.uid).links173 = out; save(); return { links: out }; }));
}
