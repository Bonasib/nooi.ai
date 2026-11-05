// v237 — "Everything on MiniMax": with the owner's switch (or MINIMAX_ALL=1) every job MiniMax can make goes to the owner's MiniMax
// balance whatever model was picked (videos from words or a picture, pictures, voices, music, the site's text AI on MiniMax-M3);
// what MiniMax can't make stays with its own engine; the text AI falls back when MiniMax fails. A mocked network, no real key.
// Run: node tests/v237_minimax.mjs
import fs from "fs"; import os from "os"; import path from "path"; import url from "url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const D = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v237-")); fs.mkdirSync(D + "/data"); fs.mkdirSync(D + "/media"); fs.writeFileSync(D + "/data/db.json", '{"users":{}}'); process.chdir(D);
for (const k of Object.keys(process.env)) if (/^(LLM_|ANTHROPIC_|NVIDIA_|KIE_|FAL_|MINIMAX_|OPENAI_)/.test(k)) delete process.env[k];
process.env.SECRET_KEY = "t".repeat(40); process.env.MINIMAX_API_KEY = "mm-test-key-000"; process.env.PUBLIC_BASE_URL = "https://nooi.test";
const st = await import(ROOT + "/lib/settings.js");
const MM = await import(ROOT + "/providers/minimax183.js");
const { adapterFor } = await import(ROOT + "/providers/extra.js");
const AI = await import(ROOT + "/providers/anthropic.js");
let pass = 0, fail = 0; const ok = (c, m, info) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || info === undefined ? "" : " · " + JSON.stringify(info).slice(0, 400))); };
const key = (cap, body) => { try { return adapterFor(cap, body, {}).key; } catch (e) { return "error:" + e.message.slice(0, 60); } };
const seen = []; let reply = null;
globalThis.fetch = async (u, o = {}) => { seen.push({ u: String(u), h: o.headers || {}, body: o.body ? JSON.parse(o.body) : null }); const r = typeof reply === "function" ? reply(String(u)) : reply;
  return { ok: r.status < 400, status: r.status, text: async () => JSON.stringify(r.body), json: async () => r.body }; };

// ---- off (the default): MiniMax only where it was before
ok(!MM.mmAll237() && key("video", { kind: "video", model: "kling30", prompt: "a" }) !== "mm183-video", "off: a Kling video stays with its own engine");
ok(AI.llmInfo().provider !== "minimax", "off: the text AI isn't MiniMax");
// ---- on
MM.mmState183().all = true;
ok(MM.mmAll237(), "on: the owner's switch");
for (const m of ["kling30", "seedance", "auto", "veo3", "wan30"]) ok(key("video", { kind: "video", model: m, prompt: "a", dur: 5 }) === "mm183-video", `a video picked as ${m} → MiniMax`);
ok(key("video", { kind: "video", model: "seedance", inputs: { vStart: "/media/a.jpg" } }) === "mm183-video", "a video from a picture → MiniMax (Hailuo first frame)");
ok(key("video", { kind: "video", model: "mcswap", inputs: { vRef1: "/media/a.mp4" } }) !== "mm183-video", "a Character Swap stays with its engine");
ok(key("video", { kind: "video", model: "mc30" }) !== "mm183-video", "Motion Control stays");
ok(key("video", { kind: "lipsync", model: "auto" }) !== "mm183-video", "lip-sync stays");
ok(key("video", { kind: "video", model: "auto", inputs: { vIn: "/media/x.webm" } }) !== "mm183-video", "a job that reads a video stays");
for (const m of ["nano", "dotimg", "mj", "img20", "auto"]) ok(key("image", { kind: "image", model: m, prompt: "a" }) === "mm183-image", `a picture picked as ${m} → MiniMax`);
ok(key("image", { kind: "image", model: "nano", inputs: { chRef: "/media/face.jpg" } }) === "mm183-image", "a picture with a character's photo → MiniMax (subject reference)");
ok(key("image", { kind: "image", model: "nano", inputs: { iRef: "/media/frame.jpg" } }) !== "mm183-image", "a picture edit (a picture to change) stays");
ok(key("image", { kind: "upscale" }) !== "mm183-image", "upscaling stays");
MM.mmState183().voice = false; MM.mmState183().music = false;
ok(key("tts", { kind: "voice", prompt: "hi" }) === "mm183-voice", "a voice → MiniMax (even with the voice switch off: everything is on)");
ok(key("tts", { kind: "voice", prompt: "hi", meta: { engine: "elevenlabs" } }) !== "mm183-voice", "a customer's picked ElevenLabs voice stays");
ok(key("music", { kind: "music", prompt: "calm" }) === "mm183-music", "music → MiniMax");
// ---- the text AI on MiniMax-M3 (Anthropic-compatible)
ok(AI.llmConfigured() && AI.llmInfo().provider === "minimax" && AI.llmInfo().model === "MiniMax-M3", "the text AI is MiniMax-M3", AI.llmInfo());
reply = { status: 200, body: { content: [{ type: "thinking", thinking: "…" }, { type: "text", text: "OK" }] } }; seen.length = 0;
const t1 = await AI.llm("Reply with exactly: OK", { maxTokens: 20 });
const c1 = seen[0] || {};
ok(t1 === "OK" && c1.u === "https://api.minimax.io/anthropic/v1/messages" && c1.body.model === "MiniMax-M3" && c1.h.Authorization === "Bearer mm-test-key-000", "llm() → api.minimax.io/anthropic/v1/messages, MiniMax-M3, the owner's key, its thinking left out", { t1, u: c1.u, m: c1.body && c1.body.model });
st.saveCfg("providers", "minimax", { textModel: "MiniMax-M3.1-Flash", baseUrl: "https://api.minimaxi.com" }); seen.length = 0;
await AI.llm("hi", { tier: "quick" }); ok(seen[0].u === "https://api.minimaxi.com/anthropic/v1/messages" && seen[0].body.model === "MiniMax-M3.1-Flash", "Admin's text model and region are used", seen[0] && { u: seen[0].u, m: seen[0].body.model });
const j = await AI.llmJson("give json", {}).catch((e) => e.message); ok(typeof j === "string", "(a reply with no JSON is an error, as before)");
// MiniMax fails → another text AI takes over when one is connected
process.env.LLM_API_KEY = "sk-other-test"; seen.length = 0;
reply = (u) => (u.includes("minimax") ? { status: 529, body: { error: { message: "overloaded" } } } : { status: 200, body: { content: [{ type: "text", text: "from the other AI" }] } });
const t2 = await AI.llm("hi", {}); ok(t2 === "from the other AI" && seen.length === 2 && /anthropic\.com/.test(seen[1].u), "MiniMax fails → the other connected text AI answers", { t2, u: seen.map((x) => x.u) });
delete process.env.LLM_API_KEY;
// ---- off again; MINIMAX_ALL=1 on the server turns it on whatever Admin says
MM.mmState183().all = false; ok(!MM.mmAll237() && key("video", { kind: "video", model: "kling30" }) !== "mm183-video", "switched off → back to each model's engine");
process.env.MINIMAX_ALL = "1"; ok(MM.mmAll237() && key("image", { kind: "image", model: "nano" }) === "mm183-image", "MINIMAX_ALL=1 turns it on from the server");
delete process.env.MINIMAX_API_KEY; st.saveCfg("providers", "minimax", { apiKey: "" });
ok(!MM.mmAll237() || st.configured("minimax"), "no MiniMax key → nothing goes to MiniMax");
fs.rmSync(D, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log("v237 FAIL"); process.exit(1); } console.log("v237 OK");
