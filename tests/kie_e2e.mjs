// End to end with Kie AI: a mock Kie server + the real nooi server (key from KIE_API_KEY / KIE_BASE_URL).
// Jobs go through POST /v1/jobs → routing → Kie request → polling → result mirrored to /media.
// Covers image (Nano Banana, Nano Banana Pro, GPT Image, Flux edit, Midjourney), video (Kling image→video,
// Seedance 2.0 flagship, WAN 3.0), music (Suno), voice & sound effects (ElevenLabs), background removal (Recraft),
// upscale (Topaz) and lip-sync (Kling avatar). Run: node tests/kie_e2e.mjs
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
    if (done && t.body?.model === "nano-banana-2" && /FAILME/.test(t.body?.input?.prompt || "")) return send({ state: "fail", failCode: "500", failMsg: "Internal model error" });
    if (u.pathname === "/api/v1/jobs/recordInfo") { const music = t.body.model === "ai-music-api/generate", audio = music || /^elevenlabs/.test(t.body.model), img = !audio && !/video/.test(t.body.model) && !/seedance|kling|wan\//.test(t.body.model);
      return send(done ? { state: "success", resultJson: JSON.stringify(music ? { data: [{ audio_url: `http://localhost:${KPORT}/out.mp3` }] } : { resultUrls: [`http://localhost:${KPORT}/out.${audio ? "mp3" : img ? "png" : "mp4"}`] }) } : { state: "generating", progress: 40 }); }
    if (u.pathname === "/api/v1/veo/record-info") return send(done ? { successFlag: 1, response: { resultUrls: [`http://localhost:${KPORT}/out.mp4`] } } : { successFlag: 0 });
    if (u.pathname === "/api/v1/mj/record-info") return send(done ? { successFlag: 1, resultInfoJson: { resultUrls: [{ resultUrl: `http://localhost:${KPORT}/out.png` }] } } : { successFlag: 0 });
    res.statusCode = 404; res.end("{}");
  });
}).listen(KPORT);
const srv = spawn("node", ["server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(NPORT), SECRET_KEY: "e".repeat(40), KIE_API_KEY: KEY, KIE_BASE_URL: `http://localhost:${KPORT}`, FIREBASE_PROJECT_ID: "", PUBLIC_BASE_URL: `http://localhost:${NPORT}` }, stdio: "ignore" });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const api = async (p, o = {}) => { const r = await fetch(`http://localhost:${NPORT}${p}`, { method: o.json ? "POST" : "GET", headers: { "content-type": "application/json" }, body: o.json ? JSON.stringify(o.json) : undefined }); return { status: r.status, d: await r.json().catch(() => ({})) }; };
try {
  for (let i = 0; i < 80; i++) { try { await api("/v1/config"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const cfg = (await api("/v1/config")).d;
  ok(cfg.providers && ["video", "image", "music", "tts", "matting", "enhance", "lipsync"].every((k) => cfg.providers[k]), "config: with only the Kie key saved, video, image, music, voice, background removal, upscale and lip-sync show as connected");
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
    ["voice · ElevenLabs", { kind: "voice", prompt: "Welcome to nooi", meta: { gender: "female" } }, "elevenlabs/text-to-speech-multilingual-v2"],
    ["sound effect · ElevenLabs", { kind: "sfx", prompt: "a door creaks" }, "elevenlabs/sound-effect-v2"],
    ["background removal · Recraft", { kind: "bg", prompt: "cut out", inputs: { bgFg: ref } }, "recraft/remove-background"],
    ["upscale · Topaz", { kind: "finish", prompt: "upscale", meta: { tool: "upscale", opt: { scale: "2x" } }, inputs: { fin: ref } }, "topaz/image-upscale"],
    ["lip-sync · Kling avatar", { kind: "lipsync", prompt: "", inputs: { lsV: ref, lsA: `http://localhost:${KPORT}/out.mp3` } }, "kling/ai-avatar-standard"],
    ["image · Nano Banana fails → falls back to the next Kie model", { kind: "image", model: "nano", prompt: "FAILME a pear", aspect: "1:1" }, "seedream/4.5-text-to-image"],
    ["lip-sync from a typed script (voice first)", { kind: "lipsync", prompt: "Welcome to our store", inputs: { lsV: ref } }, "kling/ai-avatar-standard"],
  ];
  const made = [];
  for (const [name, body, want] of JOBS) { const r = await api("/v1/jobs", { json: body }); ok(r.status === 200 && r.d.id, name + ": accepted (" + (r.d.error || r.status) + ")"); made.push([name, r.d.id, want]); }
  const t0 = Date.now(); let jobs = [];
  while (Date.now() - t0 < 60000) { jobs = await Promise.all(made.map(([, id]) => api("/v1/jobs/" + id).then((r) => r.d))); if (jobs.every((j) => j.status === "done" || j.status === "failed")) break; await new Promise((r) => setTimeout(r, 1500)); }
  made.forEach(([name, , want], i) => { const j = jobs[i] || {}; const sent = seen.find((s) => (want === "mj" ? s.path === "/api/v1/mj/generate" : s.body && s.body.model === want));
    ok(!!sent, name + ": Kie received model " + want);
    ok(j.status === "done" && /\/media\//.test(j.url || ""), name + ": finished and saved to /media (" + j.status + (j.error ? " · " + j.error : "") + ")"); });
  const mj = seen.find((s) => s.path === "/api/v1/mj/generate"); ok(mj && mj.body.taskType === "mj_txt2img" && mj.body.aspectRatio === "16:9", "Midjourney request shape");
  const av = seen.filter((s) => s.body && s.body.model === "kling/ai-avatar-standard").find((s) => s.body.input.prompt === ""), tts = seen.filter((s) => s.body && s.body.model === "elevenlabs/text-to-speech-multilingual-v2" && s.body.input.text === "Welcome to our store");
  ok(tts.length === 1 && av && /out\.mp3$/.test(av.body.input.audio_url), "lip-sync from a script: ElevenLabs voice first, then the avatar uses that audio");
  const fb = jobs[made.findIndex((m) => /falls back/.test(m[0]))] || {}; ok(fb.status === "done" && seen.some((s) => s.body?.model === "nano-banana-2" && /FAILME/.test(s.body.input.prompt)), "fallback: the failed Nano Banana job finished on Seedream instead of refunding");
  const dt = await api("/v1/jobs/" + made[0][1]); ok("via" in dt.d, "owners and admins see which provider ran a job (via: " + dt.d.via + ")");
  const kl = seen.find((s) => s.body && s.body.model === "kling-2.6/image-to-video"); ok(kl && kl.body.input.image_urls && kl.body.input.image_urls[0] === ref, "Kling gets the start frame as image_urls");
  // scenes: the first picture becomes the anchor; the next shot starts from it, carries the scene rules, and is checked
  const scn = await api("/v1/scenes", { json: { name: "Old town 1949" } }); ok(scn.status === 200 && scn.d.id, "scene created");
  const runJob = async (body) => { const r = await api("/v1/jobs", { json: body }); const t0 = Date.now(); let j = {}; while (Date.now() - t0 < 30000) { j = (await api("/v1/jobs/" + r.d.id)).d; if (j.status === "failed" || (j.status === "done" && j.sceneCheck)) break; await new Promise((z) => setTimeout(z, 800)); } return j; };
  const s1 = await runJob({ kind: "image", model: "nano", prompt: "a silver sci-fi car in an old town street, 1949", aspect: "16:9", meta: { scene: scn.d.id } });
  ok(s1.status === "done" && s1.sceneCheck?.first, "scene: the first result becomes the scene's anchor (" + JSON.stringify(s1.sceneCheck) + ")");
  const s2 = await runJob({ kind: "image", model: "nano", prompt: "close-up of the driver", aspect: "16:9", meta: { scene: scn.d.id } });
  const req2 = seen.filter((x) => x.body?.input?.prompt?.startsWith("close-up of the driver")).pop();
  ok(req2 && /Scene lock/.test(req2.body.input.prompt) && /old town/.test(req2.body.input.prompt) && (req2.body.input.image_input || [])[0], "scene: the next shot carries the scene rules and starts from the scene's picture");
  ok(s2.status === "done" && s2.sceneCheck && s2.sceneCheck.same && s2.sceneCheck.score >= 62, "scene: the result is checked against the anchor (" + JSON.stringify(s2.sceneCheck) + ")");
  const sl = (await api("/v1/scenes")).d.items || []; ok(sl.length >= 1 && sl[0].count >= 2 && /\/media\//.test(sl[0].anchor || ""), "scene list: count and anchor picture for the picker");
  // the browser never learns which provider runs the models
  const leak = (t) => /kie/i.test(String(t).replace(/cookie/gi, ""));
  const pages = await Promise.all(["/v1/config", "/v1/showcase", "/v1/explore", "/v1/jobs/" + made[0][1], "/v1/admin/settings"].map((p) => fetch(`http://localhost:${NPORT}${p}`).then((r) => r.text())));
  ok(pages.every((t) => !leak(t)), "no provider name in /v1/config, showcase, explore, jobs or admin settings (" + pages.map((t, i) => leak(t) ? i : "").join("") + ")");
  const fsm = await import("fs"), pub = ROOT + "/public";
  const files = ["index.html", "email-templates.js", "local-ai-worker.js", ...fsm.readdirSync(pub + "/i18n").map((f) => "i18n/" + f)];
  const bad = files.filter((f) => leak(fsm.readFileSync(pub + "/" + f, "utf8").replace(/[A-Za-z0-9+/=]{200,}/g, "").replace(/\bkies\b/g, "")));
  ok(!bad.length, "no provider name in any file the browser downloads (" + bad.join(", ") + ")");
  // showcase: the admin button makes nooi's marketing media with Kie AI and posts each one to Explore with its prompt
  const sc0 = await api("/v1/showcase"); ok(sc0.status === 200 && sc0.d.items.length >= 20 && ["motion", "anime", "vfx", "pixel"].every((c) => sc0.d.items.some((x) => x.cat === c && x.kind === "video")) && sc0.d.items.some((x) => x.kind === "image"), "showcase: motion, anime, VFX, pixel-art videos and pictures, each with a prompt");
  const pick = ["desert-rider", "pixel-knight", "abaya-portrait", "av-faisal"];
  const sg = await api("/v1/admin/showcase", { json: { ids: pick, force: true } }); ok(sg.status === 200 && pick.every((id) => sg.d.items.find((x) => x.id === id).status === "rendering"), "showcase: three items and one avatar started (" + (sg.d.error || sg.status) + ")");
  let sc = null; const t1 = Date.now(); while (Date.now() - t1 < 40000) { sc = (await api("/v1/showcase")).d; if ((await api("/v1/admin/showcase")).d.items.filter((x) => pick.includes(x.id)).every((x) => x.status === "done")) break; await new Promise((r) => setTimeout(r, 1500)); }
  ok(pick.filter((id) => !id.startsWith("av-")).every((id) => /\/media\//.test((sc.items.find((x) => x.id === id) || {}).url || "")) && !sc.items.some((x) => x.cat === "avatar"), "showcase: finished media saved to /media and served by /v1/showcase (avatars listed separately)");
  const avs = (await api("/v1/avatars")).d.items || []; ok(avs.length === 1 && avs[0].id === "av-faisal" && /\/media\//.test(avs[0].url), "avatars: a made avatar is listed with its picture for the Avatar tool");
  const sv = seen.filter((x) => x.body && x.body.model === "nano-banana-pro" && /fictional person/.test(x.body.input?.prompt || "")); ok(sv.length >= 1, "avatars: made as a photoreal portrait of a fictional person");
  const xp = (await api("/v1/explore")).d.items || []; ok(!xp.some((x) => /fictional person/.test(x.prompt || "")), "avatars are not posted to Explore");
  ok(pick.filter((id) => !id.startsWith("av-")).every((id) => xp.some((x) => x.author === "nooi" && x.featured && x.prompt === sc.items.find((s) => s.id === id).prompt[0])), "showcase: each one posted to Explore as featured, with its prompt");
  const again = await api("/v1/admin/showcase", { json: { ids: pick } }); ok(pick.every((id) => again.d.items.find((x) => x.id === id).status === "done"), "showcase: finished items are not made twice unless asked");
  const del = await fetch(`http://localhost:${NPORT}/v1/admin/showcase`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: pick }) }).then((r) => r.json());
  ok(pick.every((id) => del.items.find((x) => x.id === id).status === "none") && !((await api("/v1/explore")).d.items || []).some((x) => x.author === "nooi"), "showcase: admin can remove items (test data cleaned up)");
} catch (e) { ok(false, "crashed: " + e.message); }
finally { srv.kill(); kieSrv.close(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
