// v241 — Seedance on the owner's own ByteDance key (BytePlus ModelArk). A mocked network, no real key.
//  · routing: a Seedance model picked (2.0 Fast, 2.0, 2.5, Mini) → ByteDance, before the AI engine and MiniMax; editing a video's
//    seconds (Edit with words, Replace things) → ByteDance; "Auto" → ByteDance unless MiniMax takes every video; a Character Swap,
//    Motion Control, lip-sync or a picture → never
//  · the model: BytePlus's ids; Admin → Models wins; a Seedance 2.x id on the card for plain Seedance; an old 1.0 id there is ignored
//  · the request in BytePlus's form: text, first frame (Base64 when the picture is on this server), reference pictures (@Image1…),
//    reference video (a public link), ratio, duration, resolution per model, sound, no watermark
//  · submit → POST …/contents/generations/tasks with the key; poll: running / succeeded (the video) / failed; a refusal of real
//    faces says so (nothing charged, no other engine)
// Run: node tests/v241_bytedance.mjs
import fs from "fs"; import os from "os"; import path from "path"; import url from "url"; import { execFileSync } from "child_process";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const D = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v241-")); fs.mkdirSync(D + "/data"); fs.mkdirSync(D + "/media"); fs.writeFileSync(D + "/data/db.json", '{"users":{}}'); process.chdir(D);
for (const k of Object.keys(process.env)) if (/^(LLM_|ANTHROPIC_|NVIDIA_|KIE_|FAL_|MINIMAX_|OPENAI_|SEEDANCE_)/.test(k)) delete process.env[k];
process.env.SECRET_KEY = "t".repeat(40); process.env.PUBLIC_BASE_URL = "https://nooi.test"; process.env.NV_AUTOCHECK = "false";
process.env.SEEDANCE_API_KEY = "bd-test-key-000"; process.env.KIE_API_KEY = "kie-test-000";
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=640x360:d=1", "-frames:v", "1", D + "/media/start.png"]);
const st = await import(ROOT + "/lib/settings.js");
const { adapterFor, adapterByKey } = await import(ROOT + "/providers/extra.js");
const BD = await import(ROOT + "/providers/bytedance241.js");
const MM = await import(ROOT + "/providers/minimax183.js");
const { shotLens133 } = await import(ROOT + "/lib/long132.js");
let pass = 0, fail = 0; const ok = (c, m, info) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || info === undefined ? "" : " · " + JSON.stringify(info).slice(0, 500))); };
const key = (cap, body) => { try { return adapterFor(cap, { prompt: "a", ...body }, {}).key; } catch (e) { return "error:" + e.message.slice(0, 80); } };

// ---- routing
ok(key("video", { kind: "video", model: "seedance" }) === "bd@dreamina-seedance-2-0-fast-260128", "Seedance 2.0 Fast → ByteDance (not the AI engine)", key("video", { kind: "video", model: "seedance" }));
ok(key("video", { kind: "video", model: "seedance20" }) === "bd@dreamina-seedance-2-0-260128", "Seedance 2.0 → ByteDance");
ok(key("video", { kind: "video", model: "seedance25" }) === "bd@dreamina-seedance-2-5-260628", "Seedance 2.5 → ByteDance");
ok(key("video", { kind: "video", model: "seedance2mini" }) === "bd@dreamina-seedance-2-0-mini-260615", "Seedance 2.0 Mini → ByteDance");
ok(key("video", { kind: "video", model: "auto" }).startsWith("bd@"), "Auto → ByteDance");
ok(key("video", { kind: "video", model: "seedance20", meta: { edit135: 1 }, inputs: { edVideo: "/media/c.mp4" } }).startsWith("bd@"), "editing a video's seconds (Edit with words / Replace things) → ByteDance");
// (v246: a Character Swap goes to ByteDance first while the swap engine is Seedance — the default; tests/v246.py)
ok(key("video", { kind: "video", model: "mcswap", meta: { swap93: true } }) === "bd@dreamina-seedance-2-0-fast-260128", "a Character Swap (Seedance swap engine) → ByteDance first (v246)");
process.env.SWAP_ENGINE = "h3"; ok(!String(key("video", { kind: "video", model: "mcswap", meta: { swap93: true } })).startsWith("bd@"), "a Character Swap on another swap engine never goes to ByteDance"); delete process.env.SWAP_ENGINE;
for (const [n, b] of [["Motion Control", { kind: "video", model: "mc30" }], ["lip-sync", { kind: "lipsync", model: "auto" }], ["Kling", { kind: "video", model: "kling30" }]])
  ok(!String(key("video", b)).startsWith("bd@"), n + " never goes to ByteDance", key("video", b));
ok(!String(key("image", { kind: "image", model: "nano" })).startsWith("bd@"), "a picture never goes to ByteDance");
process.env.MINIMAX_API_KEY = "mm-test"; MM.mmState183().all = true;
ok(key("video", { kind: "video", model: "auto" }) === "mm183-video" && key("video", { kind: "video", model: "seedance" }).startsWith("bd@"), "Everything on MiniMax: Auto → MiniMax, a Seedance pick still → ByteDance");
MM.mmState183().all = false; delete process.env.MINIMAX_API_KEY;
// ---- the model
st.saveCfg("providers", "seedance", { model: "seedance-1-0-pro-250528" });
ok(BD.bdModel241({ model: "seedance" }) === "dreamina-seedance-2-0-fast-260128", "an old 1.0 id on the card is ignored (Seedance 2.x features need 2.x)");
st.saveCfg("providers", "seedance", { model: "dreamina-seedance-2-0-mini-260615" });
ok(BD.bdModel241({ model: "seedance" }) === "dreamina-seedance-2-0-mini-260615" && BD.bdModel241({ model: "seedance20" }) === "dreamina-seedance-2-0-260128", "a 2.x id on the card is used for plain Seedance only");
st.S().modelCat = { seedance20: { apiModel: "dreamina-seedance-2-0-999999" } };
ok(BD.bdModel241({ model: "seedance20" }) === "dreamina-seedance-2-0-999999", "Admin → Models (the model's API id) wins");
st.S().modelCat = {}; st.saveCfg("providers", "seedance", { model: "" });
// ---- the request
const b1 = BD.bdBody241("dreamina-seedance-2-0-fast-260128", { kind: "video", model: "seedance", prompt: "a cat walks on a beach at sunset", dur: 8, aspect: "9:16", meta: { res: "1080p" } });
ok(b1.model === "dreamina-seedance-2-0-fast-260128" && b1.content.length === 1 && b1.content[0].type === "text" && /cat walks/.test(b1.content[0].text) && b1.ratio === "9:16" && b1.duration === 8 && b1.resolution === "720p" && b1.watermark === false && b1.generate_audio === false,
  "words to video: text, 9:16, 8 s, 720p (Fast has no 1080p), no watermark, silent unless asked", b1);
const b2 = BD.bdBody241("dreamina-seedance-2-0-260128", { kind: "video", model: "seedance20", prompt: "she turns and smiles", dur: 5, aspect: "16:9", inputs: { vStart: "/media/start.png" }, meta: { audio: true, res: "4k" } });
const ff = b2.content.find((c) => c.role === "first_frame");
ok(ff && /^data:image\/png;base64,/.test(ff.image_url.url) && b2.generate_audio === true && b2.resolution === "4k", "a picture to video: the first frame as Base64 (ByteDance never needs to reach the server), sound on, 4K on 2.0", { ff: ff && ff.image_url.url.slice(0, 40), b2: { ...b2, content: b2.content.map((c) => c.type + ":" + (c.role || "")) } });
const b3 = BD.bdBody241("dreamina-seedance-2-0-260128", { kind: "video", model: "seedance20", prompt: "#girl drinks tea", dur: 6, inputs: { vRef1: "/media/start.png", vRef2: "https://cdn.example/x.jpg" }, meta: { refs130: [{ slot: "vRef1", tag: "girl" }, { slot: "vRef2", tag: "cup" }] } });
ok(b3.content.filter((c) => c.role === "reference_image").length === 2 && !b3.content.some((c) => c.role === "first_frame") && /@Image1/.test(b3.content[0].text) && b3.content.some((c) => c.image_url && c.image_url.url === "https://cdn.example/x.jpg"),
  "# pictures: reference images named @Image1… in the words; a picture elsewhere goes as its link", b3.content.map((c) => c.role || c.text));
const b4 = BD.bdBody241("dreamina-seedance-2-0-260128", { kind: "video", model: "seedance20", prompt: "Edit @Video1 — replace the cup with a red mug", dur: 20, inputs: { edVideo: "/media/clip.mp4", vRef1: "/media/start.png" }, meta: { edit135: 1, refs130: [{ slot: "vRef1", tag: "image1" }] } });
const rv = b4.content.find((c) => c.role === "reference_video");
ok(rv && rv.video_url.url === "https://nooi.test/media/clip.mp4" && b4.ratio === "adaptive" && b4.duration === 15 && b4.generate_audio === false, "editing seconds: the video as a public link (reference_video), the shape kept, 4–15 s, silent (the video keeps its own sound)", b4);
const b5 = BD.bdBody241("dreamina-seedance-2-5-260628", { kind: "video", model: "seedance25", prompt: "Edit @Video1", dur: 12, inputs: { edVideo: "/media/clip.mp4" }, meta: { edit135: 1 } });
ok(b5.duration === -1 && b5.ratio === "adaptive", "Seedance 2.5 editing: its own length (-1) and shape", b5);
// ---- submit and poll (mocked BytePlus)
const seen = []; let reply = null;
globalThis.fetch = async (u, o = {}) => { seen.push({ u: String(u), m: o.method, h: o.headers || {}, body: o.body ? JSON.parse(o.body) : null }); const r = typeof reply === "function" ? reply(String(u)) : reply;
  return { ok: r.status < 400, status: r.status, text: async () => JSON.stringify(r.body), json: async () => r.body }; };
const a = adapterByKey("bd@dreamina-seedance-2-0-fast-260128", {});
reply = { status: 200, body: { id: "cgt-123" } };
const sub = await a.submit({ kind: "video", model: "seedance", prompt: "a cat", dur: 5, aspect: "16:9" });
ok(sub.remoteId === "cgt-123" && seen[0].u === "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks" && seen[0].m === "POST" && seen[0].h.Authorization === "Bearer bd-test-key-000" && seen[0].body.model === "dreamina-seedance-2-0-fast-260128",
  "submit → POST …/api/v3/contents/generations/tasks with the owner's key", seen[0] && { u: seen[0].u, m: seen[0].body && seen[0].body.model });
reply = { status: 200, body: { id: "cgt-123", status: "running" } }; ok((await a.poll("cgt-123")).status === "rendering", "running → rendering");
reply = { status: 200, body: { id: "cgt-123", status: "succeeded", content: { video_url: "https://ark-out.example/v.mp4" } } };
const done = await a.poll("cgt-123"); ok(done.status === "done" && done.url === "https://ark-out.example/v.mp4" && /\/contents\/generations\/tasks\/cgt-123$/.test(seen[seen.length - 1].u), "succeeded → the video", done);
reply = { status: 200, body: { id: "cgt-123", status: "failed", error: { code: "InputVideoSensitiveContentDetected.PrivacyInformation", message: "The input video may contain real human face" } } };
const f1 = await a.poll("cgt-123"); ok(f1.status === "failed" && /real people's faces/.test(f1.error), "a refusal of real faces says so", f1);
reply = { status: 400, body: { error: { code: "InputImageSensitiveContentDetected.PrivacyInformation", message: "The request failed because the input image may contain real person" } } };
const e1 = await a.submit({ kind: "video", model: "seedance", prompt: "x", inputs: { vStart: "/media/start.png" } }).catch((e) => e);
ok(e1 instanceof Error && /real people's faces/.test(e1.userMsg || "") && e1.noFallback === true && e1.userMsgAr, "refused at once for a real face: told why (EN + AR), no other engine", { m: e1.message, u: e1.userMsg });
reply = { status: 401, body: { error: { code: "AuthenticationError", message: "the API key is invalid" } } };
const e2 = await a.submit({ kind: "video", model: "seedance", prompt: "x" }).catch((e) => e);
ok(e2 instanceof Error && /Seedance \(ByteDance\) 401/.test(e2.message) && !e2.userMsg, "a refused key is the engine's error (the owner sees why)", e2.message);
// ---- a long video's shots on ByteDance: 4 s and up
ok(shotLens133("seedance", "bd@dreamina-seedance-2-0-fast-260128")[0] === 4, "long videos: ByteDance's shots start at 4 s", shotLens133("seedance", "bd@dreamina-seedance-2-0-fast-260128"));
// ---- no key → back to the AI engine
delete process.env.SEEDANCE_API_KEY;
ok(!String(key("video", { kind: "video", model: "seedance" })).startsWith("bd@"), "no ByteDance key → Seedance on the AI engine as before", key("video", { kind: "video", model: "seedance" }));
fs.rmSync(D, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log("v241 FAIL"); process.exit(1); } console.log("v241 OK");
