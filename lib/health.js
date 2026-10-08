// Provider connection tests + live status (Online / Degraded / Maintenance / Not connected).
import crypto from "crypto";
import { cfg, configured, S } from "./settings.js";
import { save } from "./store.js";
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const klingJwt = (ak, sk) => { const now = Math.floor(Date.now() / 1000), h = b64u({ alg: "HS256", typ: "JWT" }), p = b64u({ iss: ak, exp: now + 1800, nbf: now - 5 }); return `${h}.${p}.${crypto.createHmac("sha256", sk).update(h + "." + p).digest("base64url")}`; };
// A cheap authenticated request per provider. 2xx/4xx-not-auth = reachable & key accepted.
const PROBES = { nvidia: (c) => [(c.baseUrl || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "").replace(/\/vlm\/.*$/, "") + "/models", { headers: { Authorization: "Bearer " + c.apiKey } }], vss: (c) => [c.baseUrl.replace(/\/$/, "") + "/v1/ready", { headers: c.apiKey ? { Authorization: "Bearer " + c.apiKey } : {} }],
  elevenlabs: (c) => [(c.baseUrl || "https://api.elevenlabs.io") + "/v1/models", { headers: { "xi-api-key": c.apiKey } }],
  openai: (c) => [(c.baseUrl || "https://api.openai.com/v1") + "/models", { headers: { Authorization: "Bearer " + c.apiKey } }],
  google: (c) => [(c.baseUrl || "https://generativelanguage.googleapis.com/v1beta") + "/models?pageSize=1", { headers: { "x-goog-api-key": c.apiKey } }],
  kling: (c) => [(c.baseUrl || "https://api.klingai.com") + "/v1/videos/text2video?pageNum=1&pageSize=1", { headers: { Authorization: "Bearer " + klingJwt(c.accessKey, c.secretKey) } }],
  seedance: (c) => [(c.baseUrl || "https://ark.ap-southeast.bytepluses.com/api/v3") + "/contents/generations/tasks?page_size=1", { headers: { Authorization: "Bearer " + c.apiKey } }],
  minimax: (c) => [(c.baseUrl || "https://api.minimax.io") + "/v1/query/video_generation?task_id=health", { headers: { Authorization: "Bearer " + c.apiKey } }],
  kie: (c) => [(c.baseUrl || "https://api.kie.ai").replace(/\/$/, "") + "/api/v1/chat/credit", { headers: { Authorization: "Bearer " + c.apiKey } }],
  stripe: (c) => ["https://api.stripe.com/v1/balance", { headers: { Authorization: "Bearer " + c.secretKey } }],
  email: (c) => [(c.provider === "sendgrid" ? "https://api.sendgrid.com/v3/scopes" : "https://api.resend.com/domains"), { headers: { Authorization: "Bearer " + c.apiKey } }]
};
export async function testProvider(key) {
  const st = S(); if (st.maintenance?.[key]) return record(key, { state: "maintenance", note: "Marked for maintenance by an admin" });
  if (!configured(key) && !(key === "vss" && cfg(key).baseUrl)) return record(key, { state: "unconfigured", note: "No key saved" });
  const c = cfg(key); const t0 = Date.now(); let url, opt;
  if (PROBES[key]) [url, opt] = PROBES[key](c); else if (c.baseUrl) { url = c.baseUrl; opt = { method: "HEAD", headers: c.apiKey ? { Authorization: "Bearer " + c.apiKey } : {} }; } else return record(key, { state: "online", note: "Key saved (no probe for this provider)" });
  try { const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 10000); const r = await fetch(url, { ...opt, signal: ctl.signal }); clearTimeout(to); const ms = Date.now() - t0;
    // Kie AI answers HTTP 200 and puts its real status in the body ({code, msg, data: credits})
    let st = r.status, extra = "";
    if (key === "kie" && r.ok) { const d = await r.json().catch(() => ({})); if (d.code && d.code !== 200) st = d.code === 433 ? 429 : d.code; else if (typeof d.data === "number") extra = ` · ${d.data} credits left`; }
    const type = st === 401 || st === 403 ? "auth" : st === 429 ? "rate" : st === 402 ? "quota" : st >= 500 ? "provider" : null;
    return record(key, { state: type === "auth" || type === "quota" ? "down" : type ? "degraded" : ms > 4000 ? "degraded" : "online", status: st, latency: ms, type, note: type === "auth" ? "Key rejected or expired" : type === "quota" ? "Out of credits" : type === "rate" ? "Rate limited" : type === "provider" ? "Provider error" : ms > 4000 ? "Slow response" : "OK" + extra });
  } catch (e) { return record(key, { state: "down", type: "network", note: e.name === "AbortError" ? "Timed out" : e.message.slice(0, 120), latency: Date.now() - t0 }); }
}
function record(key, r) { const st = S(); st.status = st.status || {}; st.status[key] = { ...r, checked: Date.now() }; save(); return st.status[key]; }
export const KNOWN = ["kie", "elevenlabs", "google", "kling", "seedance", "minimax", "qwen", "qwentext", "claude", "wan", "tts", "world", "midjourney", "email", "stripe"];
export async function testAll() { const out = {}; for (const k of KNOWN) out[k] = await testProvider(k); return out; }
export function publicStatus() { const st = S(), m = st.maintenance || {}; return Object.fromEntries(KNOWN.map((k) => { const s = st.status?.[k]; return [k, m[k] ? "maintenance" : !configured(k) ? "unconfigured" : s ? s.state : "online"]; })); }
