// Kie AI adapter with a mocked network: request shapes (market / Veo / Suno), polling states, error codes,
// routing (per-model Kie id, default model fallback) and the health probe. Run: node tests/kie_mock.mjs
import path from "path"; import url from "url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."); process.chdir(ROOT);
process.env.SECRET_KEY = process.env.SECRET_KEY || "t".repeat(40);
const KEY = "kie_test_key_123";
const st = await import(ROOT + "/lib/settings.js");
delete st.S().providers.kie;  // start clean even if an earlier run stopped half-way
st.saveCfg("providers", "kie", { apiKey: KEY, inputs: JSON.stringify({ "kling-3.0/video": { mode: "pro" } }) });
const { kie, kieInput } = await import(ROOT + "/providers/kie.js");
const { adapterFor, adapterByKey } = await import(ROOT + "/providers/extra.js");
const { PROVIDERS } = await import(ROOT + "/providers/index.js");
const { classify } = await import(ROOT + "/lib/errors.js");
const { testProvider } = await import(ROOT + "/lib/health.js");

let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const resp = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });
let queue = []; const seen = [];
globalThis.fetch = async (u, o = {}) => { seen.push({ u: String(u), method: o.method || "GET", h: o.headers || {}, body: o.body ? JSON.parse(o.body) : null }); const f = queue.shift(); if (!f) throw new Error("no mock for " + u); return f; };
const created = (id) => resp(200, { code: 200, msg: "success", data: { taskId: id } });
const record = (data) => resp(200, { code: 200, msg: "success", data });

// ── market video (Kling 3.0): image → video, 10 s, admin extra input merged ──
const K = kie("kling-3.0/video");
queue = [created("t1")];
const r1 = await K.submit({ kind: "video", prompt: "a ship in a storm", dur: 10, aspect: "16:9", inputs: { startImage: "https://x/frame.png" }, meta: { audio: true } });
let s = seen.at(-1);
ok(r1.remoteId === "m:t1" && s.u === "https://api.kie.ai/api/v1/jobs/createTask" && s.method === "POST", "market: POST /api/v1/jobs/createTask, task id kept");
ok(s.h.Authorization === "Bearer " + KEY, "market: Bearer key sent server → Kie only");
ok(s.body.model === "kling-3.0/video" && s.body.input.duration === "10" && s.body.input.image_urls[0] === "https://x/frame.png" && s.body.input.sound === true, "market: Kling input uses duration \"10\", image_urls, sound");
ok(s.body.input.mode === "pro", "market: admin's extra inputs for this model id are merged");
for (const [state, want] of [["waiting", "queued"], ["queuing", "queued"], ["generating", "rendering"]]) { queue = [record({ state })]; ok((await K.poll("m:t1")).status === want, `poll: state ${state} → ${want}`); }
queue = [record({ state: "success", resultJson: JSON.stringify({ resultUrls: ["https://cdn/out.mp4"] }) })];
let p = await K.poll("m:t1"); ok(p.status === "done" && p.url === "https://cdn/out.mp4" && /recordInfo\?taskId=t1$/.test(seen.at(-1).u), "poll: success → first resultUrls entry");
queue = [record({ state: "fail", failMsg: "content policy", failCode: "500" })];
p = await K.poll("m:t1"); ok(p.status === "failed" && /content policy/.test(p.error), "poll: fail → failed with Kie's message (credits get refunded by the job runner)");
queue = [record({ state: "success", resultJson: "{}" })];
ok((await K.poll("m:t1")).status === "failed", "poll: success without any URL is treated as a failure, not a blank result");

// ── per-family input fields ──
const vid = (dur, img) => ({ kind: "video", prompt: "p", dur, aspect: "9:16", inputs: img ? { startImage: "https://i" } : {}, meta: {} });
let i = kieInput("bytedance/seedance-2", vid(20, true)); ok(i.duration === 15 && i.first_frame_url === "https://i", "Seedance: duration clamped to 15, first_frame_url");
i = kieInput("minimax-h3/image-to-video", vid(5, true)); ok(i.first_frame_url === "https://i" && i.duration === 6 && i.aspect_ratio === undefined, "MiniMax H3 I2V: first_frame_url, 6 s, no aspect_ratio");
i = kieInput("hailuo/2-3-image-to-video-pro", vid(10, true)); ok(i.image_url === "https://i" && i.duration === "10", "Hailuo: image_url and duration as text");
i = kieInput("wan/3-0-video", vid(8, false)); ok(i.duration === 8 && i.aspect_ratio === "9:16" && !i.image_urls, "Wan 3.0 text → video: numeric duration, aspect ratio");
i = kieInput("nano-banana-pro", { kind: "image", prompt: "logo", aspect: "1:1", inputs: { iRef: "https://ref" }, meta: {} }); ok(i.image_input[0] === "https://ref" && i.aspect_ratio === "1:1", "Nano Banana: reference image goes in image_input");
i = kieInput("gpt-image-2-image-to-image", { kind: "image", prompt: "x", inputs: { iRef: "https://ref" }, meta: {} }); ok(i.image_urls[0] === "https://ref", "other image models: reference in image_urls");

// ── Veo 3.1 (dedicated endpoint) ──
const V = kie("veo3_fast");
queue = [created("v1")]; const rv = await V.submit({ kind: "video", prompt: "sunrise", dur: 8, aspect: "1:1", inputs: {}, meta: {} }); s = seen.at(-1);
ok(rv.remoteId === "veo:v1" && /\/api\/v1\/veo\/generate$/.test(s.u) && s.body.model === "veo3_fast" && s.body.aspect_ratio === "Auto", "Veo: /veo/generate, model veo3_fast, unsupported 1:1 → Auto");
queue = [record({ successFlag: 0 })]; ok((await V.poll("veo:v1")).status === "rendering", "Veo poll: successFlag 0 → rendering");
queue = [record({ successFlag: 1, response: { resultUrls: ["https://cdn/veo.mp4"] } })]; p = await V.poll("veo:v1");
ok(p.status === "done" && p.url === "https://cdn/veo.mp4" && /veo\/record-info\?taskId=v1$/.test(seen.at(-1).u), "Veo poll: successFlag 1 → response.resultUrls");
queue = [record({ successFlag: 3, errorMessage: "quota" })]; ok((await V.poll("veo:v1")).status === "failed", "Veo poll: successFlag ≥ 2 → failed");

// ── Suno music via the market endpoint ──
const M = kie("suno:V5");
queue = [created("s1")]; await M.submit({ kind: "music", prompt: "calm oud", meta: {} }); s = seen.at(-1);
ok(s.body.model === "ai-music-api/generate" && s.body.input.model === "V5" && s.body.input.custom_mode === false && s.body.input.instrumental === false, "Suno: ai-music-api/generate with snake_case input and V5");
queue = [record({ state: "success", resultJson: JSON.stringify({ data: [{ audio_url: "https://cdn/a.mp3", image_url: "https://cdn/c.jpg" }] }) })];
p = await M.poll("m:s1"); ok(p.status === "done" && p.url === "https://cdn/a.mp3", "Suno: result is the track's audio_url, not its cover image");

// ── errors: Kie answers HTTP 200 with its own code ──
for (const [code, type, retry] of [[401, "auth", false], [402, "quota", false], [422, "input", false], [429, "rate", true], [433, "rate", true], [500, "provider", true]]) {
  queue = [resp(200, { code, msg: "error " + code })];
  try { await K.submit({ kind: "video", prompt: "x", dur: 5, inputs: {}, meta: {} }); ok(false, `code ${code} should throw`); }
  catch (e) { const c = classify(e); ok(c.type === type && c.retryable === retry && !String(e.message).includes(KEY), `Kie code ${code} → ${type}${retry ? " (retried)" : ""}, key never in the message`); }
}
try { await kie("").submit({ kind: "video", prompt: "x", inputs: {}, meta: {} }); ok(false, "empty model should throw"); } catch (e) { ok(e.code === 503, "no model id → clear 503 setup message, nothing sent"); }

// ── routing ──
st.S().modelCat = { kling30: { kieModel: "kling-3.0/video" } };
let rt = adapterFor("video", { kind: "video", model: "kling30" }, PROVIDERS); ok(rt.key === "kie@kling-3.0/video" && rt.a.name === "Kie AI", "routing: a model with a Kie id set in Admin → Models runs on Kie");
rt = adapterFor("video", { kind: "video", model: "kling" }, PROVIDERS); ok(rt.key === "kie@kling-2.6/text-to-video", "routing: a model whose own provider has no key runs on its built-in Kie model");
rt = adapterFor("video", { kind: "video", model: "kling", inputs: { startImage: "https://x/f.png" } }, PROVIDERS); ok(rt.key === "kie@kling-2.6/image-to-video", "routing: a start frame picks the image-to-video variant");
rt = adapterFor("video", { kind: "video", model: "seedance20" }, PROVIDERS); ok(rt.key === "kie@bytedance/seedance-2", "routing: a flagship model without its own API id runs on Kie instead of stopping");
for (const [m, k] of [["nano", "nano-banana-2"], ["nanopro", "nano-banana-pro"], ["img20", "gpt-image-2-text-to-image"], ["qwen2", "qwen3/text-to-image"], ["flux", "flux-2/pro-text-to-image"], ["mj", "mj:7"]]) { rt = adapterFor("image", { kind: "image", model: m }, PROVIDERS); ok(rt.key === "kie@" + k, "routing: image model " + m + " → Kie " + k); }
rt = adapterFor("image", { kind: "image", model: "nano", inputs: { iRef: "https://x/r.png" } }, PROVIDERS); ok(rt.key === "kie@google/nano-banana-edit", "routing: a reference image picks the edit variant");
rt = adapterFor("tts", { kind: "voice" }, PROVIDERS); ok(!String(rt.key).startsWith("kie@"), "routing: voice is not sent to Kie");
rt = adapterFor("video", { kind: "video", model: "auto" }, PROVIDERS); ok(rt.key === "kie@bytedance/seedance-2-fast", "routing: no default video model → built-in Kie video model");
st.saveCfg("providers", "kie", { videoModel: "wan/3-0-video", musicModel: "suno:V5" });
rt = adapterFor("video", { kind: "video", model: "auto" }, PROVIDERS); ok(rt.key === "kie@wan/3-0-video", "routing: direct video provider not connected → admin's default Kie video model");
rt = adapterFor("music", { kind: "music" }, PROVIDERS); ok(rt.key === "kie@suno:V5", "routing: music falls back to the default Kie music model");
ok(adapterByKey("kie@kling-3.0/video", PROVIDERS).name === "Kie AI", "poller rebuilds the Kie adapter from the stored job key");

// ── Midjourney through Kie ──
queue = [created("mj1")]; const MJ = kie("mj:7"); const rm = await MJ.submit({ kind: "image", prompt: "a fox", aspect: "16:9", inputs: {}, meta: {} }); s = seen.at(-1);
ok(rm.remoteId === "mj:mj1" && /\/api\/v1\/mj\/generate$/.test(s.u) && s.body.taskType === "mj_txt2img" && s.body.version === "7" && s.body.aspectRatio === "16:9", "midjourney: POST /api/v1/mj/generate with mj_txt2img, version 7, aspect");
queue = [record({ successFlag: 0 })]; ok((await MJ.poll("mj:mj1")).status === "rendering", "midjourney: successFlag 0 → rendering");
queue = [record({ successFlag: 1, resultInfoJson: { resultUrls: [{ resultUrl: "https://cdn/x.png" }] } })]; ok((await MJ.poll("mj:mj1")).url === "https://cdn/x.png" && /record-info\?taskId=mj1$/.test(seen.at(-1).u), "midjourney: successFlag 1 → first result URL");
queue = [record({ successFlag: 2, errorMessage: "banned prompt" })]; ok((await MJ.poll("mj:mj1")).error === "banned prompt", "midjourney: failure message passed on");

// ── health probe ──
queue = [resp(200, { code: 200, msg: "success", data: 1234 })]; let h = await testProvider("kie");
ok(h.state === "online" && /1234 credits left/.test(h.note) && /\/api\/v1\/chat\/credit$/.test(seen.at(-1).u), "health: credit balance endpoint → Online · 1234 credits left");
queue = [resp(200, { code: 401, msg: "unauthorized" })]; h = await testProvider("kie"); ok(h.state === "down" && /rejected/.test(h.note), "health: HTTP 200 with code 401 → Offline · key rejected");
queue = [resp(200, { code: 402, msg: "insufficient" })]; h = await testProvider("kie"); ok(h.state === "down" && /credits/i.test(h.note), "health: code 402 → Offline · out of credits");

delete st.S().providers.kie; st.S().modelCat = {}; (await import(ROOT + "/lib/store.js")).save();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
