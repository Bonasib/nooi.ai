// End to end with Kie AI: a mock Kie server + the real nooi server (key from KIE_API_KEY / KIE_BASE_URL).
// Jobs go through POST /v1/jobs → routing → Kie request → polling → result mirrored to /media.
// Covers image (Nano Banana, Nano Banana Pro, GPT Image, Flux edit with a reference, Midjourney),
// video (Kling image→video, Seedance 2.0 flagship, WAN 3.0) and music (Suno). Run: node tests/kie_e2e.mjs
import http from "http"; import { spawn } from "child_process"; import path from "path"; import url from "url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const KPORT = 8098, NPORT = 8096, KEY = "kie_e2e_key";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const seen = []; let n = 0; const tasks = {};
const kieSrv = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const u = new URL(req.url, "http://x"), body = b ? JSON.parse(b) : null, send = (d) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ code: 200, msg: "success", data: d })); };
    if (u.pathname.startsWith("/out.")) { res.setHeader("content-type", u.pathname.endsWith(".png") ? "image/png" : u.pathname.endsWith(".mp3") ? "audio/mpeg" : "video/mp4"); return res.end(PNG); }
    if (req.headers.authorization !== "Bearer " + KEY) { return send(null), undefined; }
    if (u.pathname === "/api/v1/chat/credit") return send(777);
    if (["/api/v1/jobs/createTask", "/api/v1/veo/generate", "/api/v1/mj/generate"].includes(u.pathname)) { const id = "t" + ++n; tasks[id] = { path: u.pathname, body, polls: 0 }; seen.push({ path: u.pathname, body }); return send({ taskId: id }); }
    const id = u.searchParams.get("taskId"), t = tasks[id]; if (!t) return send(null);
    const done = ++t.polls >= 2;
    if (u.pathname === "/api/v1/jobs/recordInfo") { const music = t.body.model === "ai-music-api/generate", img = !music && !/video/.test(t.body.model) && !/seedance|kling|wan\//.test(t.body.model);
      return send(done ? { state: "success", resultJson: JSON.stringify(music ? { data: [{ audio_url: `http://localhost:${KPORT}/out.mp3` }] } : { resultUrls: [`http://localhost:${KPORT}/out.${img ? "png" : "mp4"}`] }) } : { state: "generating", progress: 40 }); }
    if (u.pathname === "/api/v1/veo/record-info") return send(done ? { successFlag: 1, response: { resultUrls: [`http://localhost:${KPORT}/out.mp4`] } } : { successFlag: 0 });
    if (u.pathname === "/api/v1/mj/record-info") return send(done ? { successFlag: 1, resultInfoJson: { resultUrls: [{ resultUrl: `http://localhost:${KPORT}/out.png` }] } } : { successFlag: 0 });
    res.statusCode = 404; res.end("{}");
  });
}).listen(KPORT);
const srv = spawn("node", ["server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(NPORT), SECRET_KEY: "e".repeat(40), KIE_API_KEY: KEY, KIE_BASE_URL: `http://localhost:${KPORT}`, FIREBASE_PROJECT_ID: "" }, stdio: "ignore" });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const api = async (p, o = {}) => { const r = await fetch(`http://localhost:${NPORT}${p}`, { method: o.json ? "POST" : "GET", headers: { "content-type": "application/json" }, body: o.json ? JSON.stringify(o.json) : undefined }); return { status: r.status, d: await r.json().catch(() => ({})) }; };
try {
  for (let i = 0; i < 80; i++) { try { await api("/v1/config"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const cfg = (await api("/v1/config")).d;
  ok(cfg.providers && cfg.providers.video && cfg.providers.image && cfg.providers.music, "config: with only the Kie key saved, video, image and music show as connected");
  const ref = `http://localhost:${KPORT}/out.png`;
  const JOBS = [
    ["image · Nano Banana", { kind: "image", model: "nano", prompt: "a red apple", aspect: "1:1" }, "nano-banana-2"],
    ["image · Nano Banana Pro", { kind: "image", model: "nanopro", prompt: "a red apple", aspect: "1:1" }, "nano-banana-pro"],
    ["image · GPT Image 2.0", { kind: "image", model: "img20", prompt: "a poster", aspect: "4:5" }, "gpt-image-2-text-to-image"],
    ["image · Flux edit with a reference", { kind: "image", model: "flux", prompt: "make it blue", aspect: "1:1", inputs: { iRef: ref } }, "flux-2/pro-image-to-image"],
    ["image · Midjourney", { kind: "image", model: "mj", prompt: "a fox in snow", aspect: "16:9" }, "mj"],
    ["video · Kling image → video", { kind: "video", model: "kling", prompt: "the fox runs", dur: 5, aspect: "16:9", inputs: { startImage: ref } }, "kling-2.6/image-to-video"],
    ["video · Seedance 2.0 (flagship)", { kind: "video", model: "seedance20", prompt: "a boat", dur: 5, aspect: "9:16" }, "bytedance/seedance-2"],
    ["video · WAN 3.0", { kind: "video", model: "wan30", prompt: "a city", dur: 5, aspect: "16:9" }, "wan/3-0-video"],
    ["music · Suno", { kind: "music", prompt: "calm piano", dur: 30 }, "ai-music-api/generate"],
  ];
  const made = [];
  for (const [name, body, want] of JOBS) { const r = await api("/v1/jobs", { json: body }); ok(r.status === 200 && r.d.id, name + ": accepted (" + (r.d.error || r.status) + ")"); made.push([name, r.d.id, want]); }
  const t0 = Date.now(); let jobs = [];
  while (Date.now() - t0 < 60000) { jobs = await Promise.all(made.map(([, id]) => api("/v1/jobs/" + id).then((r) => r.d))); if (jobs.every((j) => j.status === "done" || j.status === "failed")) break; await new Promise((r) => setTimeout(r, 1500)); }
  made.forEach(([name, , want], i) => { const j = jobs[i] || {}; const sent = seen.find((s) => (want === "mj" ? s.path === "/api/v1/mj/generate" : s.body && s.body.model === want));
    ok(!!sent, name + ": Kie received model " + want);
    ok(j.status === "done" && /^\/media\//.test(j.url || ""), name + ": finished and saved to /media (" + j.status + (j.error ? " · " + j.error : "") + ")"); });
  const mj = seen.find((s) => s.path === "/api/v1/mj/generate"); ok(mj && mj.body.taskType === "mj_txt2img" && mj.body.aspectRatio === "16:9", "Midjourney request shape");
  const kl = seen.find((s) => s.body && s.body.model === "kling-2.6/image-to-video"); ok(kl && kl.body.input.image_urls && kl.body.input.image_urls[0] === ref, "Kling gets the start frame as image_urls");
} catch (e) { ok(false, "crashed: " + e.message); }
finally { srv.kill(); kieSrv.close(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
