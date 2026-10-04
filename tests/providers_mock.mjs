// Provider protocol tests with a mocked network: auth / rate limit / outage / success, retries, health states,
// streaming proxy (no key leaks), and plan duration limits. Run: node tests/providers_mock.mjs
import fs from "fs"; import path from "path"; import url from "url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."); process.chdir(ROOT);
process.env.SECRET_KEY = "t".repeat(40); const KEY = "sk_test_ELEVEN_1234567890";
const st = await import(ROOT + "/lib/settings.js"); st.saveCfg("providers", "elevenlabs", { apiKey: KEY });
const { elevenlabs, streamTTS } = await import(ROOT + "/providers/elevenlabs.js");
const { withRetry, classify } = await import(ROOT + "/lib/errors.js");
const { testProvider } = await import(ROOT + "/lib/health.js");
const P = await import(ROOT + "/lib/plans.js");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const resp = (status, body, headers = {}) => { const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body; return { ok: status < 400, status, headers: new Map(Object.entries(headers)), text: async () => new TextDecoder().decode(bytes), json: async () => JSON.parse(new TextDecoder().decode(bytes)), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), body: { getReader() { let sent = false; return { read: async () => sent ? { done: true } : (sent = true, { done: false, value: bytes }) }; } } }; };
let queue = []; const seen = []; globalThis.fetch = async (u, o = {}) => { seen.push({ u: String(u), h: o.headers || {}, body: o.body }); const f = queue.shift(); if (!f) throw new Error("no mock"); return typeof f === "function" ? f(u, o) : f; };
const EL = elevenlabs();
for (const [code, type, retry] of [[401, "auth", false], [429, "rate", true], [503, "provider", true], [402, "quota", false]]) {
  queue = [resp(code, JSON.stringify({ detail: "x" }))]; try { await EL.submit({ prompt: "hi", meta: {} }); ok(false, code + " should throw"); } catch (e) { ok(e.type === type && e.retryable === retry, `ElevenLabs ${code} → ${e.type}, retryable=${e.retryable}`); } }
queue = [resp(200, new Uint8Array([73, 68, 51, 4, 0, 0]))]; const r = await EL.submit({ prompt: "مرحبا", meta: { format: "mp3" } });
ok(r.done && /\.mp3$/.test(r.url) && fs.existsSync(path.join(ROOT, "media", path.basename(r.url))), "success saves an MP3 and returns its URL");
ok(seen.at(-1).h["xi-api-key"] === KEY && /output_format=mp3_44100_128/.test(seen.at(-1).u), "key sent only server→provider, MP3 format requested");
queue = [resp(200, new Uint8Array(2000))]; const w = await EL.submit({ prompt: "x", meta: { format: "wav" } }); const wb = fs.readFileSync(path.join(ROOT, "media", path.basename(w.url)));
ok(/\.wav$/.test(w.url) && wb.slice(0, 4).toString() === "RIFF" && wb.slice(8, 12).toString() === "WAVE", "WAV export wraps PCM in a valid RIFF/WAVE header");
let n = 0; const got = await withRetry(async () => { n++; if (n < 3) throw classify(new Error("ElevenLabs 429: slow down")); return "ok"; }, { tries: 3, base: 5 });
ok(got === "ok" && n === 3, "rate limit is retried with backoff and then succeeds (3 attempts)");
n = 0; try { await withRetry(async () => { n++; throw classify(new Error("x 401: bad key")); }, { tries: 3, base: 5 }); } catch (e) { ok(n === 1 && e.type === "auth", "expired key is NOT retried (fails fast, 1 attempt)"); }
queue = [resp(200, "{}")]; ok((await testProvider("elevenlabs")).state === "online", "health: 200 → Online");
queue = [resp(401, "bad")]; let h = await testProvider("elevenlabs"); ok(h.state === "down" && /rejected|expired/i.test(h.note), "health: 401 → Offline · key rejected or expired");
queue = [resp(429, "slow")]; ok((await testProvider("elevenlabs")).state === "degraded", "health: 429 → Degraded (rate limited)");
queue = [() => { const e = new Error("aborted"); e.name = "AbortError"; throw e; }]; h = await testProvider("elevenlabs"); ok(h.state === "down" && /Timed out/.test(h.note), "health: timeout → Offline · timed out");
st.S().maintenance = { elevenlabs: true }; ok((await testProvider("elevenlabs")).state === "maintenance", "health: admin maintenance flag → Maintenance"); st.S().maintenance = {};
const mkRes = () => { const o = { code: 200, hdr: {}, chunks: [], body: null, headersSent: false }; o.status = (c) => (o.code = c, o); o.json = (b) => (o.body = b, o.headersSent = true, o); o.setHeader = (k, v) => (o.hdr[k] = v); o.write = (b) => (o.headersSent = true, o.chunks.push(b)); o.end = () => {}; return o; };
let res = mkRes(); queue = [resp(401, "invalid key " + KEY)]; await streamTTS(res, { text: "hi" });
ok(res.code === 502 && res.body.type === "auth" && !JSON.stringify(res.body).includes(KEY), "stream: provider 401 → 502 for the user (not a sign-out), no key in the reply");
res = mkRes(); queue = [resp(429, "slow")]; await streamTTS(res, { text: "hi" }); ok(res.code === 429 && res.body.type === "rate", "stream: rate limit → 429 so the app can retry");
res = mkRes(); queue = [resp(200, new Uint8Array([1, 2, 3, 4]))]; await streamTTS(res, { text: "hi" });
ok(res.hdr["Content-Type"] === "audio/mpeg" && res.chunks.length && !JSON.stringify(res.hdr).includes(KEY), "stream: audio streamed through the backend, no key in headers");
const U = (plan) => ({ plan, planUntil: Date.now() + 1e8, jobs: {} }); const can = (plan, dur) => { try { P.checkEntitlement(U(plan), { kind: "video", model: "auto", dur }); return true; } catch { return false; } };
ok(can("basic", 10) && !can("basic", 20) && can("pro", 20) && !can("pro", 30) && can("studio", 30), "durations: Basic 10 s · Pro 20 s · Studio 30 s enforced on the server");

// OpenAI GPT Image: refuses without a model id, saves PNG on success, maps a rejected key
const { gptImage } = await import(ROOT + "/providers/images2.js"); st.saveCfg("providers", "openai", { apiKey: "sk-openai-test-000" });
try { await gptImage("img20").submit({ prompt: "logo", aspect: "1:1" }); ok(false, "GPT Image should need a model id"); } catch (e) { ok(e.type === "config" && /model id/i.test(e.message), "GPT Image 2.0: no model id → clear setup message, nothing called"); }
st.S().modelCat = Object.assign(st.S().modelCat || {}, { img20: { apiModel: "gpt-image-test" } });
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64"); queue = [resp(200, JSON.stringify({ data: [{ b64_json: png }] }))];
const gi = await gptImage("img20").submit({ prompt: "logo", aspect: "16:9" }); const last = seen.at(-1); const sent = JSON.parse(await (async () => last.body || "{}")());
ok(gi.done && /\.png$/.test(gi.url) && /images\/generations$/.test(last.u) && last.h.Authorization === "Bearer sk-openai-test-000", "GPT Image 2.0: image saved as PNG, key only server→OpenAI");
queue = [resp(401, "bad key")]; try { await gptImage("img20").submit({ prompt: "x" }); } catch (e) { ok(e.type === "auth" && !e.retryable, "GPT Image 2.0: rejected key → auth error, not retried"); }
ok(!can("basic", 1) || (() => { try { P.checkEntitlement(U("basic"), { kind: "image", model: "img20" }); return false; } catch { return true; } })(), "GPT Image 2.0 is Pro/Studio only on the server");

fs.readdirSync(path.join(ROOT, "media")).forEach((f) => { if (/\.(mp3|wav|png)$/.test(f)) fs.unlinkSync(path.join(ROOT, "media", f)); }); fs.rmSync(path.join(ROOT, "data"), { recursive: true, force: true }); fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
console.log(`\n${pass} passed · ${fail} failed`); process.exit(fail ? 1 : 0);
