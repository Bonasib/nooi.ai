// v191: the payment providers' own webhook signatures, checked when the owner saved what each one needs (Admin → Payments):
//  · Stripe — the endpoint's signing secret (whsec_…): header Stripe-Signature "t=…,v1=…[,v1=…]", HMAC-SHA256 of "<t>.<raw body>",
//    any v1 may match (secret rotation), at most 5 minutes old
//  · Airwallex — the webhook's secret: x-timestamp (ms) + x-signature = HMAC-SHA256 hex of "<x-timestamp><raw body>", 5 minutes
//  · PayPal — the webhook ID: PayPal itself says yes or no (POST /v1/notifications/verify-webhook-signature with the five
//    PAYPAL-* headers, the webhook ID and the event)
//  · Moyasar — the secret token in the body (v189). Tap — nothing to save: it gets its notice address with each payment.
// Without the secret saved a notice is still taken: it only asks the server to check the order's own payment with the provider,
// so a forged one can't pay anything (v189). With it saved, a notice that fails the check is refused (401) and shown in Admin.
import crypto from "crypto";
import { cfg } from "./settings.js";

const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const hmac = (key, s) => crypto.createHmac("sha256", key).update(s).digest("hex");
const WINDOW = 5 * 60e3;

export function stripeOk191(raw, header, secret, now = Date.now()) {
  const parts = String(header || "").split(",").map((x) => x.trim().split("=")), t = (parts.find((p) => p[0] === "t") || [])[1], v1 = parts.filter((p) => p[0] === "v1").map((p) => p[1]);
  if (!t || !v1.length || Math.abs(now - +t * 1000) > WINDOW) return false;
  const want = hmac(secret, t + "." + raw); return v1.some((s) => same(s, want));
}
export function airwallexOk191(raw, ts, sig, secret, now = Date.now()) {
  if (!ts || !sig || Math.abs(now - +ts) > WINDOW) return false;
  return same(sig, hmac(secret, String(ts) + raw));
}
async function paypalOk191(req, c) {
  const { PROVIDERS } = await import("./billing.js"), P = PROVIDERS.paypal, h = (k) => req.get(k) || "";
  const t = await P.token();
  const r = await fetch(P.api() + "/v1/notifications/verify-webhook-signature", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ auth_algo: h("paypal-auth-algo"), cert_url: h("paypal-cert-url"), transmission_id: h("paypal-transmission-id"), transmission_sig: h("paypal-transmission-sig"), transmission_time: h("paypal-transmission-time"), webhook_id: c.webhookId, webhook_event: req.body }) });
  const d = await r.json().catch(() => ({})); return d.verification_status === "SUCCESS";
}

// → { ok, checked }: checked = a secret / ID was saved and the signature was looked at
export async function checkHook191(prov, req) {
  const c = cfg(prov), raw = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
  try {
    if (prov === "moyasar") { const want = String(c.webhookSecret || ""); return want ? { ok: same(String((req.body || {}).secret_token || ""), want), checked: true } : { ok: true, checked: false }; }
    if (prov === "stripe") return c.webhookSecret ? { ok: stripeOk191(raw, req.get("stripe-signature"), c.webhookSecret), checked: true } : { ok: true, checked: false };
    if (prov === "airwallex") return c.webhookSecret ? { ok: airwallexOk191(raw, req.get("x-timestamp"), req.get("x-signature"), c.webhookSecret), checked: true } : { ok: true, checked: false };
    if (prov === "paypal") return c.webhookId ? { ok: await paypalOk191(req, c), checked: true } : { ok: true, checked: false };
  } catch (e) { console.warn("webhook " + prov + " check:", e.message); return { ok: false, checked: true }; }
  return { ok: true, checked: false };
}
