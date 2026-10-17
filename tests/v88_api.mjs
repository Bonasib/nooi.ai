// v88 on the server, with mocked engines:
//  A) units: Motion Control always sends the engine a prompt (Kie answered 422 "prompt is required" for an empty one); a prompt in
//     Arabic is put into English (quoted words kept, English left alone, the original when the text AI fails or answers in Arabic);
//     a video prompt asks for no on-screen text unless the words want text.
//  B) a real nooi server in front of a mocked Kie and a mocked text AI: an Arabic video prompt reaches the engine in English with the
//     no-text line, a picture prompt without it; a failing text AI sends the words as they were; GET /v1/poster/<video> gives one
//     clear frame (made once); DELETE /v1/jobs/:id refuses a job still being made and removes a finished one.
// Run: node tests/v88_api.mjs
import http from "http"; import { spawn, spawnSync } from "child_process"; import path from "path"; import url from "url"; import fs from "fs"; import os from "os";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const AR = /[؀-ۿ]/;

// ---------- A) units, in a clean folder ----------
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v88-")); fs.mkdirSync(DIR + "/data"); fs.mkdirSync(DIR + "/media"); process.chdir(DIR);
process.env.SECRET_KEY = "s".repeat(40); process.env.PUBLIC_BASE_URL = "https://nooi.test";
for (const k of Object.keys(process.env)) if (/^(LLM_|ANTHROPIC_|NVIDIA_|LOCAL_LLM|GEMMA_|KIE_|GOOGLE_|DASHSCOPE_)/.test(k)) delete process.env[k];
try {
  const { kieInput } = await import(ROOT + "/providers/kie.js");
  const mc = (prompt) => kieInput("kling-3.0/motion-control", { kind: "video", prompt, dur: 5, inputs: { mcChar: "/media/me.png", mcMove: "/media/dance.mp4" }, meta: { motion83: true } });
  let i = mc("");
  ok(/performs exactly the same movements/.test(i.prompt) && i.input_urls[0] === "https://nooi.test/media/me.png" && i.video_urls[0] === "https://nooi.test/media/dance.mp4", "Motion Control with no words still sends a prompt (no more 422 \"prompt is required\")");
  i = mc("in a red dress");
  ok(/^in a red dress\. The person in the picture performs/.test(i.prompt), "Motion Control: the client's words first, then what the tool does");

  const { toEnglish, noTextLine, NO_TEXT } = await import(ROOT + "/lib/v88.js");
  const asked = []; const ask = (answer) => async (p, o) => { asked.push({ p, o }); if (answer instanceof Error) throw answer; return answer; };
  ok(await toEnglish("A cat on a sofa", { ask: ask("x") }) === "A cat on a sofa" && asked.length === 0, "English words go as they are (the text AI isn't asked)");
  ok(await toEnglish('a sign that says "مرحبا"', { ask: ask("x") }) === 'a sign that says "مرحبا"' && asked.length === 0, "Arabic only inside quotes: nothing to put into English");
  let en = await toEnglish("قطة على أريكة حمراء", { ask: ask("A cat on a red sofa") });
  ok(en === "A cat on a red sofa" && asked.length === 1 && asked[0].o.tier === "quick" && /into natural English/.test(asked[0].p), "Arabic → English with the quick text AI");
  ok(await toEnglish("قطة على أريكة حمراء", { ask: ask("never asked") }) === "A cat on a red sofa" && asked.length === 1, "the same words twice: asked once");
  en = await toEnglish('رجل يقول "أهلاً بكم" في السوق', { ask: ask("A man in the market says hello") });
  ok(en.includes('"أهلاً بكم"') && en.startsWith("A man in the market"), "the words in quotes (spoken or shown) stay exactly as written: " + en);
  ok(await toEnglish("بيت في الغابة", { ask: ask('"A house in the forest"') }) === "A house in the forest", "an answer wrapped in quotes is unwrapped");
  ok(await toEnglish('لافتة عليها "سلام"', { ask: ask('A sign that reads "سلام"') }) === 'A sign that reads "سلام"', "an answer that ends in quoted words keeps its quotes");
  ok(await toEnglish("سيارة في الصحراء", { ask: ask(new Error("down")) }) === "سيارة في الصحراء", "the text AI fails → the words go as they were");
  ok(await toEnglish("طائرة فوق البحر", { ask: ask("طائرة فوق البحر") }) === "طائرة فوق البحر", "an answer still in Arabic → the words go as they were");
  ok(await toEnglish("قارب في النهر", { ask: () => new Promise(() => {}), timeoutMs: 50 }) === "قارب في النهر", "a text AI that never answers doesn't hold the job (as it was)");
  let n0 = asked.length; const both = await Promise.all([toEnglish("حصان يركض", { ask: async (p, o) => { asked.push({ p, o }); await new Promise((r) => setTimeout(r, 60)); return "A horse runs"; } }), toEnglish("حصان يركض", { ask: ask("asked twice") })]);
  ok(both[0] === "A horse runs" && both[1] === "A horse runs" && asked.length === n0 + 1, "the same words sent twice at once (a network retry) are put into English once");
  ok(noTextLine("A boat at sunset") === "A boat at sunset. " + NO_TEXT && noTextLine("A boat at sunset.") === "A boat at sunset. " + NO_TEXT, "a video prompt asks for no on-screen text (v96: the sentence ends first)");
  ok(noTextLine("A shop with a sign that says OPEN") === "A shop with a sign that says OPEN" && noTextLine("عنوان كبير على الشاشة") === "عنوان كبير على الشاشة", "… unless the words want text (a sign, a title)");
  ok(noTextLine('A man says "أهلاً"') === 'A man says "أهلاً" ' + NO_TEXT, "a spoken line is not text on screen: the line is still added");
  ok(noTextLine(noTextLine("A boat")) === "A boat. " + NO_TEXT && noTextLine("") === "" && noTextLine("  ") === "  ", "the line is added once, never to an empty prompt (an empty request is still refused)");
} catch (e) { ok(false, "units crashed: " + (e.stack || e.message)); }

// ---------- B) a real server in front of a mocked Kie and a mocked text AI ----------
const NPORT = 8188, seen = [], llmSeen = []; let kN = 0, ready = false;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const EN = { "قطة تمشي على شاطئ عند الغروب": "A cat walks on a beach at sunset", "منظر لمدينة في الليل": "A city at night" };
const mock = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  const u = new URL(req.url, "http://x"), body = b ? JSON.parse(b) : {}, send = (st, o) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (u.pathname === "/v1/messages") {                                   // the text AI (Anthropic format)
    const p = String(body.messages?.[0]?.content || ""); llmSeen.push(p);
    const w = Object.keys(EN).find((k) => p.includes(k)); if (/into natural English/.test(p) && /جبل/.test(p)) return send(500, { error: { message: "busy" } });
    return send(200, { content: [{ type: "text", text: w && /into natural English/.test(p) ? EN[w] : "{}" }] });
  }
  if (u.pathname.startsWith("/files/")) { res.writeHead(200, { "content-type": "image/png" }); return res.end(PNG); }
  if (u.pathname === "/api/v1/jobs/createTask") { seen.push(body); return send(200, { code: 200, data: { taskId: "k" + ++kN } }); }
  if (u.pathname === "/api/v1/jobs/recordInfo") return ready ? send(200, { code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: [`http://127.0.0.1:${mock.address().port}/files/${u.searchParams.get("taskId")}.png`] }) } }) : send(200, { code: 200, data: { state: "generating" } });
  send(404, {});
}); });
await new Promise((r) => mock.listen(0, "127.0.0.1", r)); const M = `http://127.0.0.1:${mock.address().port}`;
const SD = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v88s-")); fs.mkdirSync(SD + "/data"); fs.mkdirSync(SD + "/media"); fs.symlinkSync(ROOT + "/public", SD + "/public"); fs.symlinkSync(ROOT + "/node_modules", SD + "/node_modules");
fs.writeFileSync(SD + "/data/db.json", JSON.stringify({ users: { local: { plan: "studio", credits: 5000, ledger: [], posts: {}, accounts: {}, jobs: {} } } }));
const mp4 = spawnSync(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=10", "-pix_fmt", "yuv420p", SD + "/media/clip.mp4"]);
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(LLM_|ANTHROPIC_|NVIDIA_|LOCAL_LLM|GEMMA_|GOOGLE_|DASHSCOPE_|WORLDLABS_|WORLD_|TRIPO_|MESHY_|BLOCKADE_|KIE_)/.test(k)));
const srv = spawn("node", [ROOT + "/server.js"], { cwd: SD, env: { ...env, PORT: String(NPORT), SECRET_KEY: "w".repeat(40), FIREBASE_PROJECT_ID: "", PUBLIC_BASE_URL: `http://localhost:${NPORT}`, FREE_PERIOD: "false", AGENTS_AUTO_LEARN: "false",
  KIE_API_KEY: "kie-key", KIE_BASE_URL: M, LLM_BASE_URL: M, LLM_API_KEY: "llm-key", LLM_MODEL: "mock-text" }, stdio: ["ignore", "ignore", "pipe"] });
let errs = ""; srv.stderr.on("data", (d) => (errs += d));
const sent = async (n) => { for (let i = 0; i < 60 && seen.length < n; i++) await new Promise((r) => setTimeout(r, 100)); return seen[n - 1]; };   // the engine is called just after the job is made
const api = async (p, o = {}) => { const r = await fetch(`http://localhost:${NPORT}${p}`, { method: o.method || (o.json ? "POST" : "GET"), headers: { "content-type": "application/json" }, body: o.json ? JSON.stringify(o.json) : undefined }); let d = null; try { d = await r.json(); } catch {} return { status: r.status, d }; };
try {
  for (let i = 0; i < 80; i++) { try { await api("/v1/config"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  // an Arabic video prompt reaches the engine in English, with the no-text line
  const v = await api("/v1/jobs", { json: { kind: "video", model: "seedance", prompt: "قطة تمشي على شاطئ عند الغروب", dur: 5, aspect: "9:16" } });
  const sv = await sent(1), vp = String(sv?.input?.prompt || "");
  ok(v.status === 200 && v.d.id && /A cat walks on a beach at sunset/.test(vp) && !AR.test(vp), "an Arabic video prompt reaches the video engine in English: " + vp.slice(0, 110));
  ok(vp.includes("No on-screen text"), "… and asks for no on-screen text (the prompt is never painted onto the video)");
  ok(v.d.title === "قطة تمشي على شاطئ عند الغروب", "the library keeps the client's own words as the title: " + v.d.title);
  const empty = await api("/v1/jobs", { json: { kind: "video", model: "seedance", prompt: "  ", dur: 5 } });
  ok(empty.status === 400, "an empty video request is still refused (" + empty.status + ")");
  // a picture prompt: English, no video line
  const im = await api("/v1/jobs", { json: { kind: "image", model: "nano", prompt: "منظر لمدينة في الليل", aspect: "1:1" } });
  const ip = String((await sent(2))?.input?.prompt || "");
  ok(im.status === 200 && /A city at night/.test(ip) && !AR.test(ip) && !ip.includes("No on-screen text"), "an Arabic picture prompt reaches the picture engine in English");
  // the text AI fails → the words go as they were, the job still starts
  const busy = await api("/v1/jobs", { json: { kind: "image", model: "nano", prompt: "جبل عليه ثلج", aspect: "1:1" } });
  ok(busy.status === 200 && String((await sent(3))?.input?.prompt || "").includes("جبل عليه ثلج"), "the text AI is busy → the job starts with the words as they were");
  // English words: the text AI isn't asked to translate
  const n0 = llmSeen.filter((p) => /into natural English/.test(p)).length;
  await api("/v1/jobs", { json: { kind: "image", model: "nano", prompt: "A red apple on a table", aspect: "1:1" } });
  ok(llmSeen.filter((p) => /into natural English/.test(p)).length === n0 && /A red apple on a table/.test((await sent(4))?.input?.prompt || ""), "English words go straight to the engine");
  // DELETE: still being made → refused; finished → gone
  const del1 = await api("/v1/jobs/" + v.d.id, { method: "DELETE" });
  ok(del1.status === 409 && /still being made/.test(del1.d?.error || ""), "a job still being made can't be deleted (409)");
  ready = true; let j = null; for (let i = 0; i < 80; i++) { j = (await api("/v1/jobs/" + v.d.id)).d; if (j && ["done", "failed"].includes(j.status)) break; await new Promise((r) => setTimeout(r, 400)); }
  ok(j && j.status === "done", "the video finished (" + (j && j.status) + ")");
  const del2 = await api("/v1/jobs/" + v.d.id, { method: "DELETE" });
  ok(del2.status === 200 && del2.d.ok && (await api("/v1/jobs/" + v.d.id)).status === 404 && !(await api("/v1/jobs")).d.jobs.some((x) => x.id === v.d.id), "a finished job is deleted and leaves the list");
  ok((await api("/v1/jobs/nope", { method: "DELETE" })).d?.gone === true, "deleting what isn't there is fine (already gone)");
  // poster frames
  if (mp4.status === 0) {
    const t0 = Date.now(), r = await fetch(`http://localhost:${NPORT}/v1/poster/clip.mp4`), buf = Buffer.from(await r.arrayBuffer());
    ok(r.status === 200 && /image\/jpeg/.test(r.headers.get("content-type") || "") && buf[0] === 0xff && buf[1] === 0xd8 && buf.length > 500, `GET /v1/poster/clip.mp4 → a JPEG frame (${buf.length} bytes, ${Date.now() - t0} ms)`);
    ok(fs.existsSync(SD + "/media/clip.mp4.poster.jpg") && /immutable/.test(r.headers.get("cache-control") || ""), "the frame is kept next to the video and cached by the browser");
    const r2 = await fetch(`http://localhost:${NPORT}/v1/poster/clip.mp4`); ok(r2.status === 200, "asked again: served from the kept frame");
  } else ok(false, "ffmpeg couldn't make a test video: " + String(mp4.stderr || "").slice(0, 200));
  ok((await fetch(`http://localhost:${NPORT}/v1/poster/..%2F..%2Fdata%2Fdb.json`)).status === 404 && (await fetch(`http://localhost:${NPORT}/v1/poster/missing.mp4`)).status === 404 && (await fetch(`http://localhost:${NPORT}/v1/poster/x.png`)).status === 404, "only videos in media: other paths, missing files and pictures → 404");
  ok(!/unhandled rejection|uncaught exception/.test(errs), "no stray errors in the server log");
} catch (e) { ok(false, "server checks crashed: " + (e.stack || e.message)); }
finally { srv.kill(); mock.close(); }
if (fail && errs) console.log(errs.slice(-1500));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
