// Credits ledger + checkout (Moyasar · Tap · Stripe). Server is the source of truth for balances.
import { user, save, uid, allUsers, col } from "./store.js";
import { cfg, S as settings, price as priceOverride } from "./settings.js";
import { PLANS } from "./plans.js";
export const FREE_CREDITS = +(process.env.FREE_CREDITS || 100);
// One price table for every tool (credits). Keep in sync with the studio UI.
const VIDEO = { ltxfast: 5, wan22: 12, wan30: 14, hunyuan: 18, ltx23: 28, seedance: 16, kling: 20, qwenwan: 10, hailuo: 15, kling40: 30, kling30: 24, seedance25: 22, seedance20: 16, hailuoh3: 20 };
const DUR = (d) => ({ 3: .6, 5: 1, 8: 1.6, 10: 2, 15: 3 }[d] || (d || 5) / 5);
const IMAGE = { sdxl: 1, dotimg: 2, flux: 3 };
const FIXED = { world: 40, voiceclone: 20, voiceconvert: 6, look: 2, sheet: 6, edit: 10, bg: 6, mocap: 20, voice: 3, lipsync: 12, music: 4, sfx: 1, transcribe: 2, dub: 9, "3d": 12, track3d: 8, view3d: 10, place3d: 12, finish: 8 };
const IMG_PRICE = { nano: 2, nanopro: 4, img20: 2, img25: 3, qwen2: 2, mj: 6 };
const EL_PRICE = { el_flash: 3, el_turbo: 3, el_multi: 4, el_v3: 6 };
export function priceOf(kind, b) {
  b = b || {};
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
Object.keys(PROVIDERS).forEach((k) => { const c = PROVIDERS[k].configured; if (typeof c === "function") PROVIDERS[k].configured = c.bind(PROVIDERS[k]); });
export const enabledPayments = () => Object.keys(PROVIDERS).filter((k) => (settings().payments[k]?.enabled ?? (process.env.PAYMENT_PROVIDER === k)) && PROVIDERS[k].configured());
export const provider = (k) => { const list = enabledPayments(); return PROVIDERS[k && list.includes(k) ? k : list[0]] || null; };
export const providerName = (k) => { const list = enabledPayments(); return k && list.includes(k) ? k : list[0]; };
// pending checkouts: ref -> {uid, item, id, amount, currency, done}
export function startCheckout(uidv, item, currency, coupon) {
  const c = CATALOG[item]; if (!c) throw Object.assign(new Error("Unknown item"), { code: 400 });
  const cur = currency === "USD" ? "USD" : "SAR"; const u = acct(uidv); u.payments = u.payments || {};
  let amount = c[cur], applied = null;
  if (coupon) { const k = col("coupons", {})[String(coupon).trim().toUpperCase()]; const ok = k && k.expires > Date.now() && (!k.allow?.length || k.allow.includes(uidv)) && !k.used.includes(uidv) && (k.scope === "all" || (k.scope === "plans") === !!c.plan);
    if (!ok) throw Object.assign(new Error("This discount code isn't valid for this purchase"), { code: 400 }); amount = Math.round(amount * (100 - k.pct) / 100); applied = k.code; }
  const ref = uid(); u.payments[ref] = { ref, item, amount, currency: cur, coupon: applied, status: "pending", created: Date.now() }; save();
  return { ref, amount, currency: cur, description: "nooi.ai · " + c.label + (applied ? ` (${applied})` : "") };
}
export async function finishCheckout(uidv, ref, providerId) {
  const u = acct(uidv); const p = u.payments?.[ref]; if (!p) throw new Error("Unknown payment");
  if (p.status === "paid") return p;                      // idempotent
  const v = await PROVIDERS[p.provider || providerName()].verify(providerId || p.providerId);
  if (!v.paid) return p;
  if (v.amount !== p.amount || String(v.currency).toUpperCase() !== p.currency) throw new Error("Amount mismatch");
  p.status = "paid"; p.paidAt = Date.now(); const c = CATALOG[p.item]; if (p.coupon) { const k = col("coupons", {})[p.coupon]; if (k && !k.used.includes(uidv)) k.used.push(uidv); }
  credit(uidv, c.credits, "Purchase · " + c.label, ref); if (c.plan) { u.plan = c.plan; u.planUntil = Date.now() + (c.months || 1) * 30 * 864e5; u.planRefill = Date.now(); u.planYearly = (c.months || 1) > 1; } save(); return p;
}
export function findPayment(ref) { for (const [id, u] of allUsers()) if (u.payments?.[ref]) return id; return null; }

// Yearly plans: add the monthly credits every 30 days while the plan is active
export function refillPlans() { const now = Date.now(); for (const [id, u] of allUsers()) { if (!u.planYearly || !u.plan || (u.planUntil || 0) < now) continue; if (now - (u.planRefill || 0) >= 30 * 864e5) { const c = PLANS[u.plan]; if (c) credit(id, c.credits, "Monthly credits · " + u.plan + " (yearly)"); u.planRefill = now; save(); } } }
