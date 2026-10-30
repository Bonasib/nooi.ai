// v190: the Moyasar setup steps live in Admin → Payments, each one checked by the server, not just written down:
//  1. the secret key saved (test or live, from its sk_test_/sk_live_ start)   2. the site's address is https (Moyasar sends only there)
//  3. the webhook — one tap creates it in the owner's Moyasar account through Moyasar's own API (POST /v1/webhooks with a new random
//     shared secret, the old ones to this same address removed first) and saves the secret here; set up by hand it counts once a
//     webhook with the right secret arrives   4. a test payment went through (paid orders remember test or live)
//  5. the IP whitelist — the server finds its own public address to paste in Moyasar; Moyasar has no API for it, so the owner ticks it
//  6. live — the live key saved (then step 3 asks to connect again: Moyasar keeps test and live webhooks apart).
// Keys and the secret never leave the server.
import crypto from "crypto";
import { cfg, saveCfg } from "./settings.js";
import { allUsers, col, save } from "./store.js";

const MOY = () => (process.env.MOYASAR_API || "https://api.moyasar.com").replace(/\/$/, "");
const base = () => (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const basic = (k) => "Basic " + Buffer.from(k + ":").toString("base64");
export const modeOf190 = (k) => (!k ? null : /^sk_test_/.test(k) ? "test" : /^sk_live_/.test(k) ? "live" : "unknown");
const EVENTS = ["payment_paid", "payment_failed", "payment_refunded", "payment_voided"];
const err = (code, msg, msgAr) => Object.assign(new Error(msg), { code, errorAr: msgAr });

// the webhook route tells us what arrived: the last one taken and the last one refused (a wrong secret token)
export function hookSeen190(prov, accepted, type, checked) {
  const h = col("hooks190", {}), r = (h[prov] = h[prov] || {});
  if (accepted) r.ok = { at: Date.now(), type: String(type || "").slice(0, 40), checked: !!checked, mode: modeOf190(cfg(prov).secretKey) }; else r.refused = { at: Date.now() };
  save();
}

export function setup190() {
  const c = cfg("moyasar"), mode = modeOf190(c.secretKey), url = base() + "/v1/billing/webhook/moyasar", h = col("hooks190", {}).moyasar || {};
  let testPaid = 0, livePaid = 0;
  for (const [, u] of allUsers()) for (const p of Object.values(u.payments || {})) if (p.provider === "moyasar" && p.status === "paid") { if (p.live === false) testPaid++; else if (p.live === true) livePaid++; }
  // made here: for the key now saved (Moyasar keeps test and live apart); made by hand: once a notice with the right secret came in this mode
  const hookOk = !!(c.webhookSecret && (c.webhookId ? c.webhookMode === mode : h.ok && h.ok.checked && h.ok.mode === mode));
  return {
    key: { done: !!c.secretKey, mode },
    https: { done: /^https:\/\/[^/]+/.test(base()), url: base() },
    webhook: { done: hookOk, connected: !!c.webhookId, mode: c.webhookMode || null, secret: !!c.webhookSecret, url, at: c.webhookAt || null },
    test: { done: testPaid + livePaid > 0, testPaid, livePaid, lastHook: h.ok || null, refused: h.refused && (!h.ok || h.refused.at > h.ok.at) ? h.refused : null },
    ip: { done: c.ipDone === "1", ip: c.serverIp || null },
    live: { done: mode === "live" },
  };
}

async function json(r) { try { return await r.json(); } catch { return {}; } }
export async function connect190() {
  const c = cfg("moyasar");
  if (!c.secretKey) throw err(400, "Save the Moyasar secret key first.", "احفظ المفتاح السري لميسّر أولاً.");
  const url = base() + "/v1/billing/webhook/moyasar";
  if (!/^https:\/\/[^/]+/.test(base())) throw err(400, "Moyasar sends webhooks only to an https address. Set PUBLIC_BASE_URL=https://your-domain on the server first.", "يرسل ميسّر الإشعارات إلى عنوان https فقط. اضبط PUBLIC_BASE_URL=https://نطاقك على الخادم أولاً.");
  const H = { Authorization: basic(c.secretKey), "Content-Type": "application/json" }, sig = () => AbortSignal.timeout(20000);
  // the old webhooks to this same address go first: they carry an old secret token and would be refused here
  let removed = 0;
  try {
    const l = await json(await fetch(MOY() + "/v1/webhooks", { headers: H, signal: sig() }));
    for (const w of Array.isArray(l) ? l : l.webhooks || l.data || []) if (w && w.id && w.url === url) { const r = await fetch(MOY() + "/v1/webhooks/" + encodeURIComponent(w.id), { method: "DELETE", headers: H, signal: sig() }); if (r.ok) removed++; }
  } catch { /* listing is a nicety: creating still works */ }
  const secret = crypto.randomBytes(24).toString("hex"), body = { http_method: "post", url, shared_secret: secret, events: EVENTS };
  let r = await fetch(MOY() + "/v1/webhooks", { method: "POST", headers: H, body: JSON.stringify(body), signal: sig() }), d = await json(r);
  if (!r.ok && r.status !== 401 && /event/i.test(JSON.stringify(d))) { delete body.events; r = await fetch(MOY() + "/v1/webhooks", { method: "POST", headers: H, body: JSON.stringify(body), signal: sig() }); d = await json(r); }   // an event name it doesn't take → all events
  if (r.status === 401) throw err(400, "Moyasar didn't accept the secret key. Copy it again from Moyasar → Settings → API Keys and save it.", "لم يقبل ميسّر المفتاح السري. انسخه مجدداً من ميسّر ← الإعدادات ← API Keys واحفظه.");
  if (!r.ok || !d.id) { const why = String(d.message || (d.errors && JSON.stringify(d.errors)) || r.status).slice(0, 200); throw err(502, "Moyasar refused the webhook: " + why, "رفض ميسّر إنشاء الإشعارات: " + why); }
  saveCfg("payments", "moyasar", { webhookSecret: secret, webhookId: String(d.id), webhookMode: modeOf190(c.secretKey), webhookAt: String(Date.now()) });
  return { connected: true, removed, mode: modeOf190(c.secretKey), events: d.events || "all" };
}

// the server's public address, for Moyasar's IP whitelist (asked of a public "what is my IP" service, only when the owner taps)
export async function ip190() {
  const u = process.env.IP_LOOKUP_URL || "https://api.ipify.org?format=json";
  try { const d = await json(await fetch(u, { signal: AbortSignal.timeout(8000) })); const ip = String(d.ip || "").trim();
    if (!/^[0-9a-f.:]{3,45}$/i.test(ip)) throw new Error("no address");
    saveCfg("payments", "moyasar", { serverIp: ip }); return { ip };
  } catch { throw err(502, "Couldn't find the server's address. On the server run: curl -4 ifconfig.me", "تعذّر معرفة عنوان الخادم. شغّل على الخادم: curl -4 ifconfig.me"); }
}

export function registerMoyasar190(app, requireUser, requireAdmin, audit, wrap) {
  const send = (res, e) => res.status(e.code || 500).json({ error: e.message, errorAr: e.errorAr });
  app.get("/v1/admin/pay190/moyasar", requireUser, requireAdmin("payments.manage"), (req, res) => res.json(setup190()));
  // v191: every provider's last notice taken / refused, for its row in Admin → Payments
  app.get("/v1/admin/pay191/hooks", requireUser, requireAdmin("payments.manage"), (req, res) => res.json(col("hooks190", {})));
  app.post("/v1/admin/pay190/moyasar/webhook", requireUser, requireAdmin("payments.manage"), wrap(async (req, res) => {
    try { const r = await connect190(); audit(req, "Connected the Moyasar webhook (" + r.mode + ")"); res.json({ ...r, setup: setup190() }); } catch (e) { send(res, e); }
  }));
  app.post("/v1/admin/pay190/moyasar/ip", requireUser, requireAdmin("payments.manage"), wrap(async (req, res) => { try { res.json({ ...(await ip190()), setup: setup190() }); } catch (e) { send(res, e); } }));
  app.post("/v1/admin/pay190/moyasar/mark", requireUser, requireAdmin("payments.manage"), (req, res) => {
    if ((req.body || {}).step !== "ip") return res.status(400).json({ error: "Only the IP whitelist step is ticked by hand" });
    saveCfg("payments", "moyasar", { ipDone: req.body.done ? "1" : "0" }); audit(req, "Moyasar IP whitelist " + (req.body.done ? "done" : "not done")); res.json({ setup: setup190() });
  });
}
