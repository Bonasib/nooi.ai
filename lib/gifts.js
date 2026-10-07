// Gift cards: bought with a checkout (credits or a plan for 1/3/6/12 months), or made by staff for promotions.
// A code (NOOI-XXXX-XXXX-XXXX, 60 random bits) is redeemed once by any signed-in account before it expires (1 year).
// GET /v1/gifts/catalog · GET /v1/gifts/mine · POST /v1/gifts/redeem {code} · POST /v1/gifts/:code/email {to, lang}
// Staff: GET /v1/admin/gifts · POST /v1/admin/gifts {kind, credits | plan+months, count, note}
import crypto from "crypto";
import { col, save, user } from "./store.js";
import { requireUser } from "./auth.js";
import { isStaff } from "./admin.js";
import { PLANS } from "./plans.js";
import { credit, creditPrice, TOPUPS, GIFT_CREDITS, GIFT_MONTHS, CUSTOM_MIN, CUSTOM_MAX } from "./billing.js";
import { sendEmail, emailConfigured } from "./email.js";
import { renderEmail } from "../public/email-templates.js";

export const GIFT_DESIGNS = ["aurora", "midnight", "sunset", "eid"];
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  // no 0/O, 1/I
const gifts = () => col("gifts", {});
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(e.code || 500).json({ error: e.message }));
const fail = (m, code = 400) => Object.assign(new Error(m), { code });
const norm = (c) => { const s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^NOOI/, ""); return s.length === 12 ? "NOOI-" + s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8) : null; };
const base = () => (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") || "https://nooi.ai";
const RANK = { free: 0, basic: 1, pro: 2, studio: 3 };

export function newGiftCode() { let c; do { const b = crypto.randomBytes(12); c = "NOOI-" + [0, 4, 8].map((i) => [...b.subarray(i, i + 4)].map((x) => ALPH[x % 32]).join("")).join("-"); } while (gifts()[c]); return c; }
const pub = (g, full) => ({ code: full ? g.code : g.code.slice(0, 10) + "••••-••••", kind: g.kind, credits: g.credits, plan: g.plan || null, months: g.months || null, toName: g.toName || "", fromName: g.fromName || "",
  message: g.message || "", design: g.design || "aurora", created: g.created, expires: g.expires, redeemed: !!g.redeemedBy, redeemedAt: g.redeemedAt || null, sentTo: g.sentTo || null, promo: !!g.promo });

export async function createGift(buyer, c, meta = {}, ref = null, extra = {}) {
  const g = { code: newGiftCode(), kind: c.gift.kind, credits: c.gift.credits || 0, plan: c.gift.plan || null, months: c.gift.months || null, buyer, ref,
    toName: meta.toName || "", toEmail: meta.toEmail || "", fromName: meta.fromName || "", message: meta.message || "", design: GIFT_DESIGNS.includes(meta.design) ? meta.design : "aurora", lang: meta.lang === "ar" ? "ar" : "en",
    created: Date.now(), expires: Date.now() + 365 * 864e5, redeemedBy: null, ...extra };
  gifts()[g.code] = g; const u = user(buyer); u.giftsBought = [g.code, ...(u.giftsBought || [])].slice(0, 500); save();
  if (g.toEmail) { try { await mailGift(g, g.toEmail, g.lang); } catch (e) { console.warn("gift email", e.message); } }
  return g;
}
export async function mailGift(g, to, lang) {
  const m = renderEmail("gift", { lang, code: g.code, name: g.toName, fromName: g.fromName, message: g.message, credits: g.credits, plan: g.plan, months: g.months, design: g.design, base: base(), url: base() + "/?redeem=" + encodeURIComponent(g.code) });
  await sendEmail({ to, subject: m.subject, text: m.text, html: m.html }); g.sentTo = to; g.sentAt = Date.now(); save();
}
// apply a gift to an account (credits now; a plan sets/extends the subscription and adds its monthly credits)
export function applyGift(uidv, g) {
  const u = user(uidv), now = Date.now();
  if (g.kind === "credits") { credit(uidv, g.credits, "Gift card · " + g.credits.toLocaleString("en") + " credits", g.code); return { credits: g.credits }; }
  const P = PLANS[g.plan]; if (!P) throw fail("This gift card is not valid");
  const cur = u.planUntil && u.planUntil > now ? u.plan : null;
  if (cur && RANK[cur] > RANK[g.plan]) {        // already on a bigger plan → the gift becomes its credits
    const n = P.credits * g.months; credit(uidv, n, `Gift card · ${g.plan} plan × ${g.months} (as credits)`, g.code); return { credits: n, asCredits: true };
  }
  const from = cur === g.plan ? u.planUntil : now;
  u.plan = g.plan; u.planUntil = from + g.months * 30 * 864e5; u.planYearly = g.months > 1; u.planRefill = now;
  credit(uidv, P.credits, `Gift card · ${g.plan} plan · ${g.months === 12 ? "1 year" : g.months + " month(s)"}`, g.code); save();
  return { plan: g.plan, months: g.months, planUntil: u.planUntil, credits: P.credits };
}
const tries = new Map();   // slow down guessing: 8 wrong codes per account per 10 minutes
function guard(uidv) { const now = Date.now(), t = (tries.get(uidv) || []).filter((x) => now - x < 600e3); tries.set(uidv, t); if (t.length >= 8) throw fail("Too many tries — wait a few minutes", 429); return () => { t.push(now); }; }

export function registerGifts(app) {
  app.get("/v1/gifts/catalog", (_, res) => res.json({
    topups: TOPUPS.map((n) => ({ credits: n, ...creditPrice(n) })), custom: { min: CUSTOM_MIN, max: CUSTOM_MAX, sample: [100, 1000, 3000, 10000].map((n) => ({ credits: n, ...creditPrice(n) })) },
    giftCredits: GIFT_CREDITS.map((n) => ({ credits: n, ...creditPrice(n) })),
    giftPlans: Object.entries(PLANS).filter(([k]) => k !== "free").map(([k, p]) => ({ plan: k, credits: p.credits, months: Object.entries(GIFT_MONTHS).map(([m, f]) => ({ months: +m, SAR: Math.round(p.sar * m * f), USD: Math.round(p.usd * m * f) })) })),
    designs: GIFT_DESIGNS }));
  app.get("/v1/gifts/mine", requireUser, (req, res) => { const u = user(req.user.uid), G = gifts();
    res.json({ bought: (u.giftsBought || []).map((c) => G[c]).filter(Boolean).map((g) => pub(g, true)), redeemed: Object.values(G).filter((g) => g.redeemedBy === req.user.uid).map((g) => pub(g, false)) }); });
  app.post("/v1/gifts/redeem", requireUser, wrap(async (req, res) => {
    const miss = guard(req.user.uid), code = norm(req.body?.code), g = code && gifts()[code];
    if (!g) { miss(); throw fail("This code doesn't exist — check the letters and try again", 404); }
    if (g.redeemedBy) throw fail(g.redeemedBy === req.user.uid ? "You already used this gift card" : "This gift card was already used", 409);
    if (g.expires < Date.now()) throw fail("This gift card has expired", 410);
    if (g.disabled) throw fail("This gift card was cancelled", 410);
    g.redeemedBy = req.user.uid; g.redeemedAt = Date.now(); save();     // claim first, then apply
    try { const r = applyGift(req.user.uid, g); res.json({ ok: true, ...r, gift: pub(g, false) }); }
    catch (e) { g.redeemedBy = null; g.redeemedAt = null; save(); throw e; }
  }));
  const sends = new Map();
  app.post("/v1/gifts/:code/email", requireUser, wrap(async (req, res) => {
    const code = norm(req.params.code), g = code && gifts()[code];
    if (!g || (g.buyer !== req.user.uid && !isStaff(req.user))) throw fail("Not found", 404);
    const to = String(req.body?.to || "").trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to) || to.length > 200) throw fail("Enter a valid email address");
    const now = Date.now(), t = (sends.get(req.user.uid) || []).filter((x) => now - x < 864e5); if (t.length >= 20) throw fail("You've sent a lot of gift emails today — try tomorrow", 429); t.push(now); sends.set(req.user.uid, t);
    if (!emailConfigured()) throw fail("Email isn't set up on this server yet — save the picture and share it instead", 501);
    await mailGift(g, to, req.body?.lang === "ar" ? "ar" : g.lang); res.json({ sent: true });
  }));
  // staff: promo gift codes for campaigns, giveaways and support
  app.get("/v1/admin/gifts", requireUser, (req, res) => { if (!isStaff(req.user)) return res.status(403).json({ error: "Not allowed" });
    const list = Object.values(gifts()).sort((a, b) => b.created - a.created).slice(0, 300);
    res.json({ items: list.map((g) => ({ ...pub(g, true), buyer: g.promo ? "promo" : (user(g.buyer).profile?.email || g.buyer), redeemedBy: g.redeemedBy ? (user(g.redeemedBy).profile?.email || g.redeemedBy) : null, note: g.note || "" })) }); });
  app.post("/v1/admin/gifts", requireUser, wrap(async (req, res) => { if (!isStaff(req.user)) throw fail("Not allowed", 403);
    const b = req.body || {}, count = Math.min(200, Math.max(1, +b.count || 1)); let c;
    if (b.kind === "plan") { if (!PLANS[b.plan] || b.plan === "free" || !GIFT_MONTHS[b.months]) throw fail("Choose a plan and 1, 3, 6 or 12 months"); c = { gift: { kind: "plan", plan: b.plan, months: +b.months, credits: PLANS[b.plan].credits } }; }
    else { const n = Math.round(+b.credits); if (!(n >= 10 && n <= CUSTOM_MAX)) throw fail("Choose how many credits"); c = { gift: { kind: "credits", credits: n } }; }
    const out = []; for (let i = 0; i < count; i++) out.push((await createGift(req.user.uid, c, { design: b.design, fromName: "nooi.ai", message: String(b.message || "").slice(0, 300) }, null, { promo: true, note: String(b.note || "").slice(0, 120) })).code);
    res.json({ codes: out });
  }));
}
export const giftStats = () => { const all = Object.values(gifts()); return { total: all.length, redeemed: all.filter((g) => g.redeemedBy).length }; };
