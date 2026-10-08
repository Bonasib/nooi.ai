// Credits ledger + checkout (Moyasar · Tap · Stripe). Server is the source of truth for balances.
import { user, save, uid, allUsers, col } from "./store.js";
import { cfg, S as settings, price as priceOverride } from "./settings.js";
import { PLANS } from "./plans.js";
export const FREE_CREDITS = +(process.env.FREE_CREDITS || 100);
// One price table for every tool (credits). Keep in sync with the studio UI.
const VIDEO = { ltxfast: 5, wan22: 12, wan30: 14, hunyuan: 18, ltx23: 28, seedance: 16, kling: 20, qwenwan: 10, hailuo: 15, kling40: 30, kling30: 24, seedance25: 22, seedance20: 16, hailuoh3: 20, veo31: 40, veo31f: 20, grok: 14, pixverse6: 12, kling26: 18, wan27: 12 };
const DUR = (d) => ({ 3: .6, 5: 1, 8: 1.6, 10: 2, 15: 3 }[d] || (d || 5) / 5);
const IMAGE = { sdxl: 1, dotimg: 2, flux: 3 };
const FIXED = { world: 40, voiceclone: 20, voiceconvert: 6, look: 2, sheet: 6, edit: 10, bg: 6, mocap: 20, voice: 3, lipsync: 12, music: 4, sfx: 1, transcribe: 2, dub: 9, "3d": 12, track3d: 8, view3d: 10, place3d: 12, finish: 8 };
const IMG_PRICE = { nano: 2, nanopro: 4, img20: 2, img25: 3, qwen2: 2, mj: 6, seedream5: 3, imagen4: 4, ideogram3: 3, grokimg: 2, flux2: 3 };
const EL_PRICE = { el_flash: 3, el_turbo: 3, el_multi: 4, el_v3: 6 };
// ---- prices follow what each model costs on the AI engine
// Older studio model ids now run as aliases of the engine model they always used.
export const ALIAS = { ltxfast: "seedance", wan22: "wan27", qwenwan: "wan27", hunyuan: "wan27", ltx23: "veo31f", kling40: "kling30", hailuo: "hailuo", sdxl: "img25", flux: "flux2", qwen2: "qwen" };
// What one run costs on the engine in USD — 5 s of 720p video, one image, or one audio/tool job. These are
// estimates: put the real numbers from the engine dashboard in Admin → AI providers → Pricing and prices follow.
export const ENGINE_COST = {
  // engine cost in USD per 5 s of video / per picture / per run, from the engine's published price list (1 engine credit = $0.005):
  // Veo 3.1 Quality $1.275 per 8 s · Veo 3.1 Fast $0.325 per 8 s · Seedance 2.5 $0.085/s · Kling 3.0 $0.07/s · Seedance 2.0 $0.057/s
  // Kling 2.6 $0.28 per 5 s · Hailuo $0.15 per 6 s · Grok Imagine 720p $0.0225/s · Nano Banana Pro $0.09 · GPT Image 2 (2K) $0.05
  // Seedream 5.0 $0.035 · Suno $0.06. The rest are estimates — admins can type the real cost in Admin → AI providers.
  video: { nvcosmos: 0.25, veo31: 0.8, seedance25: 0.425, kling30: 0.35, wan30: 0.3, seedance20: 0.285, kling: 0.28, kling26: 0.28, hailuoh3: 0.25, veo31f: 0.2, wan27: 0.2, pixverse6: 0.2, hailuo: 0.125, grok: 0.1125, seedance: 0.08 },
  image: { nvkontext: 0.03, nvsd35: 0.03, nvflux: 0.02, nanopro: 0.09, imagen4: 0.06, mj: 0.05, img20: 0.05, ideogram3: 0.045, seedream5: 0.035, flux2: 0.035, img25: 0.025, nano: 0.02, dotimg: 0.02, qwen: 0.02, grokimg: 0.02 },
  fixed: { lipsync: 0.38, finish: 0.07, music: 0.06, voice: 0.03, sfx: 0.02, bg: 0.01 }
};
// the cheapest credit we sell (Studio plan: $53 for 10,000 credits); margin = how many times the engine cost we charge (1.25 = 25% profit)
export const CREDIT_FLOOR_USD = 0.0053;
export const priceFactor = () => +(settings().priceFactor || 1.25);
export const engineCost = (group, id) => { const c = (settings().costs || {})[id]; return c != null ? +c : ENGINE_COST[group][id]; };
export function basePrice(group, id) { id = ALIAS[id] || id; const c = engineCost(group, id); if (c == null) return null; return priceOverride(id, Math.max(1, Math.ceil((c * priceFactor()) / CREDIT_FLOOR_USD))); }
export function priceTable() { const out = { video: {}, image: {}, fixed: {} }; for (const g of Object.keys(out)) { for (const id of Object.keys(ENGINE_COST[g])) out[g][id] = basePrice(g, id); }
  for (const [a, t] of Object.entries(ALIAS)) { if (ENGINE_COST.video[t]) out.video[a] = out.video[t]; if (ENGINE_COST.image[t]) out.image[a] = out.image[t]; } return out; }
export function priceOf(kind, b) {
  b = b || {};
  if (kind === "image") { const p = basePrice("image", b.model || "dotimg"); if (p != null) return p; }
  // nooi Studio 2.0: each part priced with its own model
  if (kind === "video" && +b.meta?.parts > 1 && Array.isArray(b.meta?.partModels) && b.meta.partModels.length) { const n = Math.min(6, +b.meta.parts), per = Math.ceil((+b.dur || 5) / n);
    return Array.from({ length: n }, (_, i) => b.meta.partModels[i] || b.model).reduce((s, m) => s + Math.round((basePrice("video", m) ?? basePrice("video", "seedance")) * DUR(per)), 0); }
  if ((kind === "video" || kind === "chapter") && basePrice("video", b.model || "seedance") != null) return Math.round(basePrice("video", b.model || "seedance") * DUR(b.dur));
  if (ENGINE_COST.fixed[kind] != null && !(kind === "voice" && b.meta?.engine === "elevenlabs")) return basePrice("fixed", kind);
  if (kind === "image" && IMG_PRICE[b.model]) return priceOverride(b.model, IMG_PRICE[b.model]);
  if (kind === "voice" && b.meta?.engine === "elevenlabs") return priceOverride(b.meta.elModel || "el_multi", EL_PRICE[b.meta.elModel] || 4);
  if (kind === "video" || kind === "chapter") return Math.round(priceOverride(b.model, VIDEO[b.model] || 12) * DUR(b.dur));
  if (kind === "image") return IMAGE[b.model] || 2;
  if (kind === "3d") return ({ objects: 12, body: 15, scene: 25 })[b.meta?.mode] || 12;
  return FIXED[kind] ?? 5;
}
export const TEXT_PRICE = { quick: 0, default: 1, complex: 2 };
function acct(uidv) { const u = user(uidv); if (u.credits == null) { u.credits = FREE_CREDITS; u.ledger = [{ id: uid(), t: Date.now(), delta: FREE_CREDITS, reason: "Welcome credits" }]; } u.ledger = u.ledger || []; return u; }
export function balance(uidv) { return acct(uidv).credits; }
export function charge(uidv, amount, reason, ref) {
  const u = acct(uidv); amount = Math.max(0, Math.round(amount));
  if (u.credits < amount) throw Object.assign(new Error("Not enough credits"), { code: 402 });
  u.credits -= amount; u.ledger.unshift({ id: uid(), t: Date.now(), delta: -amount, reason, ref }); u.ledger = u.ledger.slice(0, 500); save(); return u.credits;
}
export function credit(uidv, amount, reason, ref) { const u = acct(uidv); u.credits += Math.round(amount); u.ledger.unshift({ id: uid(), t: Date.now(), delta: Math.round(amount), reason, ref }); save(); return u.credits; }

// ---- catalogue (VAT-inclusive prices; amounts in the smallest unit: halalas / cents)
export const CATALOG = {
  p1000: { credits: 1000, SAR: 3500, USD: 900, label: "1,000 credits" },
  p5000: { credits: 5000, SAR: 14900, USD: 3900, label: "5,000 credits" },
  p15000: { credits: 15000, SAR: 37500, USD: 9900, label: "15,000 credits" },
  ...Object.fromEntries(Object.entries(PLANS).filter(([k]) => k !== "free").flatMap(([k, p]) => [
    [k, { credits: p.credits, SAR: p.sar, USD: p.usd, label: k[0].toUpperCase() + k.slice(1) + " plan · 1 month", plan: k, months: 1 }],
    [k + "_y", { credits: p.credits, SAR: Math.round(p.sar * 12 * 0.8), USD: Math.round(p.usd * 12 * 0.8), label: k[0].toUpperCase() + k.slice(1) + " plan · 12 months (−20%)", plan: k, months: 12 }]
  ]))
};
// ---- top-ups & gift cards (prices in halalas / cents, VAT included)
export const TOPUPS = [200, 500, 800, 1200];
export const GIFT_CREDITS = [200, 500, 1200, 5000];
export const GIFT_MONTHS = { 1: 1, 3: 0.95, 6: 0.9, 12: 0.8 };   // price factor per month count
export const CUSTOM_MIN = 50, CUSTOM_MAX = 100000;
// fewer credits cost a little more each; the big fixed packs keep their own prices
export function creditPrice(n) { const rate = n < 500 ? 4.5 : n < 1000 ? 4 : n < 5000 ? 3.5 : 3; const SAR = Math.max(100, Math.round((n * rate) / 10) * 10); return { SAR, USD: Math.max(100, Math.round(SAR / 3.75 / 10) * 10) }; }
const planLabel = (k) => k[0].toUpperCase() + k.slice(1);
export function itemInfo(item) {
  item = String(item || "");
  if (CATALOG[item]) return CATALOG[item];
  let m = /^cr:?(\d{2,6})$/.exec(item);
  if (m) { const n = +m[1]; if (n < CUSTOM_MIN || n > CUSTOM_MAX) return null; return { credits: n, ...creditPrice(n), label: n.toLocaleString("en") + " credits" }; }
  m = /^gift:cr:(\d{2,6})$/.exec(item);
  if (m) { const n = +m[1]; if (n < CUSTOM_MIN || n > CUSTOM_MAX) return null; return { credits: n, ...creditPrice(n), label: "Gift card · " + n.toLocaleString("en") + " credits", gift: { kind: "credits", credits: n } }; }
  m = /^gift:plan:(basic|pro|studio):(1|3|6|12)$/.exec(item);
  if (m) { const p = PLANS[m[1]], mo = +m[2], f = GIFT_MONTHS[mo]; return { credits: 0, SAR: Math.round(p.sar * mo * f), USD: Math.round(p.usd * mo * f), label: `Gift card · ${planLabel(m[1])} plan · ${mo === 12 ? "1 year" : mo + (mo === 1 ? " month" : " months")}`, gift: { kind: "plan", plan: m[1], months: mo, credits: p.credits } }; }
  return null;
}
const base = () => (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const basic = (k) => "Basic " + Buffer.from(k + ":").toString("base64");
const form = (o) => new URLSearchParams(o).toString();
export const PROVIDERS = {
  moyasar: {
    configured: () => !!cfg("moyasar").secretKey,
    async create({ amount, currency, description, ref }) {
      const r = await fetch("https://api.moyasar.com/v1/invoices", { method: "POST", headers: { Authorization: basic(cfg("moyasar").secretKey), "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, description, callback_url: `${base()}/v1/billing/return?provider=moyasar&ref=${ref}`, success_url: `${base()}/v1/billing/return?provider=moyasar&ref=${ref}`, metadata: { ref } }) });
      const d = await r.json(); if (!d.url) throw new Error("Moyasar: " + JSON.stringify(d).slice(0, 200)); return { id: d.id, url: d.url };
    },
    async verify(id) { const d = await (await fetch("https://api.moyasar.com/v1/invoices/" + id, { headers: { Authorization: basic(cfg("moyasar").secretKey) } })).json(); return { paid: d.status === "paid", amount: d.amount, currency: d.currency }; }
  },
  tap: {
    configured: () => !!cfg("tap").secretKey,
    async create({ amount, currency, description, ref, email }) {
      const r = await fetch("https://api.tap.company/v2/charges", { method: "POST", headers: { Authorization: "Bearer " + cfg("tap").secretKey, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount / 100, currency, description, threeDSecure: true, customer: { first_name: "nooi", email: email || "customer@nooi.ai" }, source: { id: "src_all" }, reference: { transaction: ref }, redirect: { url: `${base()}/v1/billing/return?provider=tap&ref=${ref}` }, post: { url: `${base()}/v1/billing/webhook/tap` } }) });
      const d = await r.json(); if (!d.transaction?.url) throw new Error("Tap: " + JSON.stringify(d.errors || d).slice(0, 200)); return { id: d.id, url: d.transaction.url };
    },
    async verify(id) { const d = await (await fetch("https://api.tap.company/v2/charges/" + id, { headers: { Authorization: "Bearer " + cfg("tap").secretKey } })).json(); return { paid: d.status === "CAPTURED", amount: Math.round((d.amount || 0) * 100), currency: d.currency }; }
  },
  stripe: {
    configured: () => !!cfg("stripe").secretKey,
    async create({ amount, currency, description, ref }) {
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: "Bearer " + cfg("stripe").secretKey, "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ mode: "payment", "line_items[0][quantity]": 1, "line_items[0][price_data][currency]": currency.toLowerCase(), "line_items[0][price_data][unit_amount]": amount, "line_items[0][price_data][product_data][name]": description, client_reference_id: ref, success_url: `${base()}/v1/billing/return?provider=stripe&ref=${ref}&id={CHECKOUT_SESSION_ID}`, cancel_url: `${base()}/#account` }) });
      const d = await r.json(); if (!d.url) throw new Error("Stripe: " + (d.error?.message || "error")); return { id: d.id, url: d.url };
    },
    async verify(id) { const d = await (await fetch("https://api.stripe.com/v1/checkout/sessions/" + id, { headers: { Authorization: "Bearer " + cfg("stripe").secretKey } })).json(); return { paid: d.payment_status === "paid", amount: d.amount_total, currency: String(d.currency || "").toUpperCase() }; }
  }
};
// ---- PayPal (Orders v2). PayPal does not settle SAR, so PayPal checkouts are charged in USD.
PROVIDERS.paypal = {
  configured: () => { const c = cfg("paypal"); return !!(c.clientId && c.secret); },
  api: () => cfg("paypal").mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
  async token() { const c = cfg("paypal"); const r = await fetch(this.api() + "/v1/oauth2/token", { method: "POST", headers: { Authorization: "Basic " + Buffer.from(c.clientId + ":" + c.secret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" }); const d = await r.json(); if (!d.access_token) throw new Error("PayPal auth failed"); return d.access_token; },
  async create({ amount, currency, description, ref }) {
    const t = await this.token(); const r = await fetch(this.api() + "/v2/checkout/orders", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: ref, custom_id: ref, description, amount: { currency_code: currency, value: (amount / 100).toFixed(2) } }], application_context: { brand_name: "nooi.ai", user_action: "PAY_NOW", return_url: `${base()}/v1/billing/return?provider=paypal&ref=${ref}`, cancel_url: `${base()}/#account` } }) });
    const d = await r.json(); const link = (d.links || []).find((l) => l.rel === "approve" || l.rel === "payer-action"); if (!link) throw new Error("PayPal: " + JSON.stringify(d).slice(0, 200)); return { id: d.id, url: link.href };
  },
  async verify(id) { const t = await this.token(); let d = await (await fetch(this.api() + "/v2/checkout/orders/" + id, { headers: { Authorization: "Bearer " + t } })).json();
    if (d.status === "APPROVED") d = await (await fetch(this.api() + "/v2/checkout/orders/" + id + "/capture", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" } })).json();
    const pu = (d.purchase_units || [])[0] || {}; const amt = pu.payments?.captures?.[0]?.amount || pu.amount || {}; return { paid: d.status === "COMPLETED", amount: Math.round(parseFloat(amt.value || 0) * 100), currency: amt.currency_code }; }
};
// ---- Airwallex (Payment Intents + hosted checkout via their JS SDK)
PROVIDERS.airwallex = {
  configured: () => { const c = cfg("airwallex"); return !!(c.clientId && c.apiKey); },
  api: () => cfg("airwallex").env === "prod" ? "https://api.airwallex.com" : "https://api-demo.airwallex.com",
  async token() { const c = cfg("airwallex"); const d = await (await fetch(this.api() + "/api/v1/authentication/login", { method: "POST", headers: { "x-client-id": c.clientId, "x-api-key": c.apiKey, "Content-Type": "application/json" } })).json(); if (!d.token) throw new Error("Airwallex auth failed"); return d.token; },
  async create({ amount, currency, ref }) { const t = await this.token(); const d = await (await fetch(this.api() + "/api/v1/pa/payment_intents/create", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ request_id: ref, amount: amount / 100, currency, merchant_order_id: ref, descriptor: "NOOI.AI", return_url: `${base()}/v1/billing/return?provider=airwallex&ref=${ref}`, metadata: { ref } }) })).json();
    if (!d.id) throw new Error("Airwallex: " + JSON.stringify(d).slice(0, 200)); return { id: d.id, airwallex: { intent_id: d.id, client_secret: d.client_secret, currency, env: cfg("airwallex").env === "prod" ? "prod" : "demo", successUrl: `${base()}/v1/billing/return?provider=airwallex&ref=${ref}` } }; },
  async verify(id) { const t = await this.token(); const d = await (await fetch(this.api() + "/api/v1/pa/payment_intents/" + id, { headers: { Authorization: "Bearer " + t } })).json(); return { paid: d.status === "SUCCEEDED", amount: Math.round((d.amount || 0) * 100), currency: d.currency }; }
};
if (process.env.PAYMENT_TEST === "1") PROVIDERS.test = {
  configured: () => true,
  async create({ amount, currency, ref }) { return { id: `test_${amount}_${currency}_${ref}`, url: `${base()}/v1/billing/return?provider=test&ref=${ref}&id=test_${amount}_${currency}_${ref}` }; },
  async verify(id) { const [, a, c] = String(id).split("_"); return { paid: true, amount: +a, currency: c }; }
};
Object.keys(PROVIDERS).forEach((k) => { const c = PROVIDERS[k].configured; if (typeof c === "function") PROVIDERS[k].configured = c.bind(PROVIDERS[k]); });
export const enabledPayments = () => Object.keys(PROVIDERS).filter((k) => (settings().payments[k]?.enabled ?? (process.env.PAYMENT_PROVIDER === k)) && PROVIDERS[k].configured());
export const provider = (k) => { const list = enabledPayments(); return PROVIDERS[k && list.includes(k) ? k : list[0]] || null; };
export const providerName = (k) => { const list = enabledPayments(); return k && list.includes(k) ? k : list[0]; };
// pending checkouts: ref -> {uid, item, id, amount, currency, done}
export function startCheckout(uidv, item, currency, coupon, extra = {}) {
  const c = itemInfo(item); if (!c) throw Object.assign(new Error("Unknown item"), { code: 400 });
  const cur = currency === "USD" ? "USD" : "SAR"; const u = acct(uidv); u.payments = u.payments || {};
  let amount = c[cur], applied = null;
  if (coupon) { const k = col("coupons", {})[String(coupon).trim().toUpperCase()]; const ok = k && k.expires > Date.now() && (!k.allow?.length || k.allow.includes(uidv)) && !k.used.includes(uidv) && (k.scope === "all" || (k.scope === "plans") === !!c.plan);
    if (!ok) throw Object.assign(new Error("This discount code isn't valid for this purchase"), { code: 400 }); amount = Math.round(amount * (100 - k.pct) / 100); applied = k.code; }
  const g = c.gift && extra.gift ? Object.fromEntries(["toName", "toEmail", "fromName", "message", "design", "lang"].map((k) => [k, String(extra.gift[k] || "").slice(0, k === "message" ? 300 : 120)])) : null;
  if (g && g.toEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g.toEmail)) throw Object.assign(new Error("Enter a valid email for the gift"), { code: 400 });
  const ref = uid(); u.payments[ref] = { ref, item, amount, currency: cur, coupon: applied, status: "pending", created: Date.now(), snap: c, gift: g, email: extra.email || null }; save();
  return { ref, amount, currency: cur, description: "nooi.ai · " + c.label + (applied ? ` (${applied})` : "") };
}
const finishing = new Map();   // ref → promise: the return page and the webhook can arrive together
export function finishCheckout(uidv, ref, providerId) {
  if (finishing.has(ref)) return finishing.get(ref);
  const pr = finishOnce(uidv, ref, providerId).finally(() => finishing.delete(ref)); finishing.set(ref, pr); return pr;
}
async function finishOnce(uidv, ref, providerId) {
  const u = acct(uidv); const p = u.payments?.[ref]; if (!p) throw new Error("Unknown payment");
  if (p.status === "paid") return p;                      // idempotent
  const v = await PROVIDERS[p.provider || providerName()].verify(providerId || p.providerId);
  if (!v.paid) return p;
  if (v.amount !== p.amount || String(v.currency).toUpperCase() !== p.currency) throw new Error("Amount mismatch");
  p.status = "paid"; p.paidAt = Date.now(); const c = p.snap || itemInfo(p.item); if (p.coupon) { const k = col("coupons", {})[p.coupon]; if (k && !k.used.includes(uidv)) k.used.push(uidv); }
  if (c.gift) { const { createGift } = await import("./gifts.js"); p.giftCode = (await createGift(uidv, c, p.gift || {}, ref)).code; }
  else credit(uidv, c.credits, "Purchase · " + c.label, ref);
  try { const { makeInvoice } = await import("./invoices.js"); p.invoice = await makeInvoice(uidv, p, c); } catch (e) { console.warn("invoice", e.message); }
  if (!c.gift && c.plan) { u.plan = c.plan; u.planUntil = Date.now() + (c.months || 1) * 30 * 864e5; u.planRefill = Date.now(); u.planYearly = (c.months || 1) > 1; } save(); return p;
}
export function findPayment(ref) { for (const [id, u] of allUsers()) if (u.payments?.[ref]) return id; return null; }

// Yearly plans: add the monthly credits every 30 days while the plan is active
export function refillPlans() { const now = Date.now(); for (const [id, u] of allUsers()) { if (!u.planYearly || !u.plan || (u.planUntil || 0) < now) continue; if (now - (u.planRefill || 0) >= 30 * 864e5) { const c = PLANS[u.plan]; if (c) credit(id, c.credits, "Monthly credits · " + u.plan + " (yearly)"); u.planRefill = now; save(); } } }
