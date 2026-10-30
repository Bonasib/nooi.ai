// v200: three gaps from the owner's security checklist, in code.
//  1. A spending cap per account: the customer sets a daily credit limit (Account → Spending cap); a hold or charge that would pass
//     it is refused with a plain reason (402, cap200:true) before any engine is called. 0 = no cap.
//  2. Step-up for admins: when the owner switches it on, every admin change (anything but GET under /v1/admin) needs a 6-digit code
//     sent to the admin's own verified email, good for 12 hours on that account (428, stepup200:true until confirmed).
//  3. Security events: 401 / 403 / 429 / 5xx answers and refused step-ups are counted per hour (7 days kept); the owner sees them in
//     Admin → Security; when the last hour passes a threshold the owners are emailed once (at most every 6 hours).
import crypto from "crypto";
import { col, save, user } from "./store.js";
import { hooks200 } from "./billing.js";
import { requireUser } from "./auth.js";
import { roleOf } from "./admin.js";
import { S as settings } from "./settings.js";
import { sendEmail } from "./email.js";
import { devMode } from "./safeurl.js";

const CAP = { max: 100000 }, STEP = { ttl: 12 * 3600e3, codeTtl: 10 * 60e3, tries: 5, sendGap: 45e3 }, SEC = { keepH: 24 * 7, alertAt: 200, alertGap: 6 * 3600e3 };
const sec200 = () => settings().security200 || (settings().security200 = { stepup: false });
const grants = () => col("stepup200", {}), codes = () => col("stepcode200", {}), log = () => col("seclog200", { hours: {}, alertedAt: 0 });
const hourKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 13);
const owners = () => (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const err = (code, en, ar, extra) => Object.assign(new Error(en), { code, errorAr: ar, ...(extra || {}) });

// ---- 1. spending cap -------------------------------------------------------------------------------------------------
export function spentToday200(u) { const since = Date.now() - 864e5; return (u.ledger || []).filter((r) => r.t >= since && r.delta < 0 && r.hold !== "released").reduce((s, r) => s - r.delta, 0); }
export function capCheck200(uidv, amount) {
  const u = user(uidv), cap = Math.round(u.cap200?.day || 0); if (!cap || !amount) return;
  const spent = spentToday200(u); if (spent + amount <= cap) return;
  throw err(402, `Daily spending cap reached (${spent} of ${cap} credits today). Raise it in Account → Spending cap, or wait until tomorrow.`,
    `وصلت إلى سقف الإنفاق اليومي (${spent} من ${cap} رصيد اليوم). ارفعه من الحساب ← سقف الإنفاق، أو انتظر حتى الغد.`, { cap200: true, cap, spent });
}
hooks200.cap = capCheck200;

// ---- 2. step-up for admins ----------------------------------------------------------------------------------------------
const emailOf = (req) => { const P = user(req.user.uid).profile || {}; return ((req.user.email && req.user.emailVerified === true) ? req.user.email : (P.emailVerified ? P.email : "") || "").toLowerCase(); };
export const hasGrant200 = (uid) => { const g = grants()[uid]; return !!(g && g.until > Date.now()); };
export function stepGate200(req, res, next) {
  if (!sec200().stepup || req.method === "GET" || req.method === "HEAD" || req.path.startsWith("/stepup200")) return next();
  if (!req.user || !roleOf(req.user) || hasGrant200(req.user.uid)) return next();   // (someone who is not staff gets the route's own 403, not a code)
  count200("stepup"); res.status(428).json({ error: "Confirm it's you: a 6-digit code goes to your email, then this change is allowed for 12 hours.", errorAr: "أكّد هويتك: يصلك رمز من 6 أرقام على بريدك، ثم يُسمح بالتغييرات لمدة 12 ساعة.", stepup200: true });
}

// ---- 3. security events --------------------------------------------------------------------------------------------------
let dirty = 0;
export function count200(kind) { const L = log(), k = hourKey(); const h = L.hours[k] || (L.hours[k] = {}); h[kind] = (h[kind] || 0) + 1;
  const keys = Object.keys(L.hours).sort(); while (keys.length > SEC.keepH) delete L.hours[keys.shift()];
  if (!dirty) { dirty = setTimeout(() => { dirty = 0; save(); }, 3000); }
  maybeAlert200(L, h); }
export function secMiddleware200(req, res, next) { res.on("finish", () => { const s = res.statusCode; if (s === 401 || s === 403 || s === 429) count200(String(s)); else if (s >= 500) count200("5xx"); }); next(); }
function maybeAlert200(L, h) { const n = (h["401"] || 0) + (h["403"] || 0) + (h["429"] || 0) + (h.stepup || 0); if (n < SEC.alertAt || Date.now() - (L.alertedAt || 0) < SEC.alertGap) return; L.alertedAt = Date.now();
  const text = `nooi.ai saw ${n} refused requests in the last hour (401 ${h["401"] || 0} · 403 ${h["403"] || 0} · 429 ${h["429"] || 0} · step-up ${h.stepup || 0}). Look at Admin → Security and the Nginx access log.`;
  for (const to of owners()) sendEmail({ to, subject: "nooi.ai: unusual traffic in the last hour", text }).catch(() => {}); }
export function secSummary200() { const L = log(), now = Date.now(), out = { last1h: {}, last24h: {}, days: [] };
  const add = (into, h) => { for (const k of Object.keys(h)) into[k] = (into[k] || 0) + h[k]; };
  for (const [k, h] of Object.entries(L.hours)) { const t = Date.parse(k + ":00:00Z"); if (now - t < 3600e3 * 1.01) add(out.last1h, h); if (now - t < 864e5) add(out.last24h, h); }
  for (let d = 6; d >= 0; d--) { const day = new Date(now - d * 864e5).toISOString().slice(0, 10), tot = {}; for (const [k, h] of Object.entries(L.hours)) if (k.startsWith(day)) add(tot, h); out.days.push({ day, ...tot }); }
  return { ...out, alertedAt: L.alertedAt || 0, stepup: !!sec200().stepup, grants: Object.values(grants()).filter((g) => g.until > now).length, threshold: SEC.alertAt }; }

export function registerGuard200(app) {
  // the customer's own cap
  app.get("/v1/me/cap200", requireUser, (req, res) => { const u = user(req.user.uid); res.json({ day: Math.round(u.cap200?.day || 0), spent: spentToday200(u), max: CAP.max }); });
  app.put("/v1/me/cap200", requireUser, (req, res) => { const d = Math.round(+(req.body || {}).day || 0); if (!(d >= 0 && d <= CAP.max)) return res.status(400).json({ error: "A whole number of credits, 0 to " + CAP.max });
    const u = user(req.user.uid); u.cap200 = { day: d, at: Date.now() }; save(); res.json({ day: d, spent: spentToday200(u), max: CAP.max }); });
  // step-up codes (an admin asks for one, then confirms it); the owner switches the gate on and off
  app.post("/v1/admin/stepup200/send", requireUser, async (req, res) => {
    if (!roleOf(req.user)) return res.status(403).json({ error: "Not allowed" });
    const to = emailOf(req), C = codes(), prev = C[req.user.uid];
    if (prev && Date.now() - prev.sentAt < STEP.sendGap) return res.status(429).json({ error: "A code was just sent — look in your inbox (and spam).", errorAr: "أُرسل رمز للتو — راجع بريدك (والرسائل غير المرغوبة)." });
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0"); C[req.user.uid] = { hash: crypto.createHash("sha256").update(code).digest("hex"), until: Date.now() + STEP.codeTtl, tries: 0, sentAt: Date.now() }; save();
    if (!to && !devMode()) return res.status(400).json({ error: "Your account has no verified email — sign in with a verified address first.", errorAr: "لا يوجد بريد موثّق على حسابك — سجّل الدخول بعنوان موثّق أولاً." });
    let sent = { skipped: true }; if (to) { try { sent = await sendEmail({ to, subject: "nooi.ai admin code: " + code, text: `Your admin confirmation code is <b>${code}</b>. It works for 10 minutes. If you did not ask for it, change your account's password and tell the owner.` }); } catch (e) { return res.status(502).json({ error: "The email could not be sent: " + e.message }); } }
    // the no-sign-in mode (tests, a laptop) has no mail and never faces the internet: the code comes back in the answer there only
    res.json({ ok: true, to: to ? to.replace(/^(.).*(@.*)$/, "$1…$2") : null, ...(devMode() && sent.skipped ? { code } : {}) });
  });
  app.post("/v1/admin/stepup200/verify", requireUser, (req, res) => {
    if (!roleOf(req.user)) return res.status(403).json({ error: "Not allowed" });
    const C = codes(), c = C[req.user.uid], given = String((req.body || {}).code || "").replace(/\D/g, "");
    if (!c || c.until < Date.now()) return res.status(410).json({ error: "The code expired — ask for a new one.", errorAr: "انتهت صلاحية الرمز — اطلب رمزاً جديداً." });
    if (c.tries >= STEP.tries) { delete C[req.user.uid]; save(); count200("stepup"); return res.status(429).json({ error: "Too many tries — ask for a new code.", errorAr: "محاولات كثيرة — اطلب رمزاً جديداً." }); }
    if (crypto.createHash("sha256").update(given).digest("hex") !== c.hash) { c.tries++; save(); count200("stepup"); return res.status(401).json({ error: "That code isn't right.", errorAr: "الرمز غير صحيح." }); }
    delete C[req.user.uid]; grants()[req.user.uid] = { until: Date.now() + STEP.ttl, at: Date.now() }; save(); res.json({ ok: true, until: grants()[req.user.uid].until });
  });
  app.get("/v1/admin/security200", requireUser, (req, res) => { if (roleOf(req.user) !== "owner") return res.status(403).json({ error: "Owner only" }); res.json(secSummary200()); });
  app.put("/v1/admin/security200", requireUser, (req, res) => { if (roleOf(req.user) !== "owner") return res.status(403).json({ error: "Owner only" });
    const on = !!(req.body || {}).stepup; if (on && !emailOf(req) && !devMode()) return res.status(400).json({ error: "Switch it on from an account with a verified email, or you lock yourself out.", errorAr: "فعّله من حساب ببريد موثّق وإلا أقفلت على نفسك." });
    sec200().stepup = on; if (on) grants()[req.user.uid] = { until: Date.now() + STEP.ttl, at: Date.now() };   // the owner who switches it on is confirmed for today
    save(); res.json(secSummary200()); });
}
