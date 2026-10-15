// v86 3D World on the server, end to end: a mocked Google (Gemma, the site's text + vision AI) and a mocked World Labs (Marble)
// in front of the real nooi server. Checks /v1/world/caps (what the page may offer and the World Labs price), /v1/world/plan from
// words and from a picture (the picture reaches the vision AI as inline data, the plan is cleaned, words the AI forgot are added
// back, an AI failure falls back to the words), /v1/world/edit, a World Labs job from words and from a picture (key only in the
// WLT-Api-Key header, the files mirrored to /media in a fixed order), a failed world, and the Admin health check.
// Run: node tests/v86_world_api.mjs
import http from "http"; import { spawn, execFileSync } from "child_process"; import path from "path"; import url from "url"; import fs from "fs"; import os from "os";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."), NPORT = 8176, KEY = "wl_test_key", GKEY = "gk-world-test";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const seen = [], ops = {}; let n = 0, gmode = "ok";
const PLAN = { title: "Desert oasis", label: "واحة", place: "oasis", size: 160, time: 17, weather: { kind: "clear", wind: 3 }, terrain: { shape: "dunes", height: 8, ground: "sand" }, water: { kind: "lake" },
  objects: [{ type: "palm", count: 12 }, { type: "tent", count: 2, at: [6, 4] }, { type: "rocket_launcher", count: 3 }, { type: "ball", count: 1, at: [0, 20], dyn: true }], life: [{ type: "camel", count: 3 }], spawn: { at: [0, 28], look: [0, 0] } };
const mock = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  const u = new URL(req.url, "http://x"), body = b ? JSON.parse(b) : {}, send = (st, o) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  seen.push({ path: u.pathname, method: req.method, wl: req.headers["wlt-api-key"], g: req.headers["x-goog-api-key"], auth: req.headers.authorization, body });
  if (u.pathname.startsWith("/files/")) { res.writeHead(200, { "content-type": u.pathname.endsWith(".jpg") ? "image/jpeg" : "application/octet-stream" }); return res.end(PNG); }
  // ---- Google (Gemma): the world plan
  if (u.pathname.startsWith("/v1beta/")) {
    if (req.headers["x-goog-api-key"] !== GKEY) return send(400, { error: { code: 400, message: "API key not valid." } });
    if (req.method === "GET") return send(200, { name: "models/gemma-4-26b-a4b-it" });
    if (gmode === "down") return send(500, { error: { code: 500, message: "internal" } });
    const txt = (body.contents?.[0]?.parts || []).map((p) => p.text || "").join(" ");
    const plan = /You change a 3D world plan/.test(txt) ? { ...PLAN, time: 22, life: [{ type: "camel", count: 6 }] } : PLAN;
    return send(200, { candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(plan) }] }, finishReason: "STOP" }] });
  }
  // ---- World Labs (Marble)
  if (u.pathname.startsWith("/marble/v1/")) {
    if (req.headers["wlt-api-key"] !== KEY) return send(401, { detail: "Invalid API key" });
    if (u.pathname === "/marble/v1/worlds:generate" && req.method === "POST") { const id = "op" + ++n; ops[id] = { polls: 0, body, fail: /FAILME/.test(JSON.stringify(body)) }; return send(200, { operation_id: id, done: false }); }
    const m = /^\/marble\/v1\/operations\/(.+)$/.exec(u.pathname), op = m && ops[m[1]];
    if (!op) return send(404, { detail: "Operation not found" });
    if (++op.polls < 2) return send(200, { operation_id: m[1], done: false, metadata: { progress_percentage: 40 } });
    if (op.fail) return send(200, { operation_id: m[1], done: true, error: { code: 3, message: "The picture could not be used" } });
    const F = (f) => `http://127.0.0.1:${mock.address().port}/files/${m[1]}-${f}`;
    return send(200, { operation_id: m[1], done: true, response: { world_id: "w-" + m[1], assets: { caption: "A quiet oasis", thumbnail_url: F("thumb.jpg"),
      imagery: { pano_url: F("pano.jpg") }, mesh: { collider_mesh_url: F("collider.glb") }, splats: { spz_urls: { "100k": F("100k.spz"), "500k": F("500k.spz"), full_res: F("full.spz") } } } } });
  }
  send(404, {});
}); });
await new Promise((r) => mock.listen(0, "127.0.0.1", r));
const M = `http://127.0.0.1:${mock.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(LLM_|ANTHROPIC_|NVIDIA_|LOCAL_LLM|GEMMA_|GOOGLE_|DASHSCOPE_|WORLDLABS_|WORLD_|TRIPO_|MESHY_|BLOCKADE_|KIE_)/.test(k)));
const srv = spawn("node", ["server.js"], { cwd: ROOT, env: { ...env, PORT: String(NPORT), SECRET_KEY: "w".repeat(40), FIREBASE_PROJECT_ID: "", PUBLIC_BASE_URL: `http://localhost:${NPORT}`, FREE_PERIOD: "false",
  GEMMA_API_KEY: GKEY, GEMMA_BASE_URL: M + "/v1beta", WORLDLABS_API_KEY: KEY, WORLDLABS_BASE_URL: M }, stdio: ["ignore", "ignore", "pipe"] });
let errs = ""; srv.stderr.on("data", (d) => (errs += d));
const api = async (p, o = {}) => { const r = await fetch(`http://localhost:${NPORT}${p}`, { method: o.method || (o.json ? "POST" : "GET"), headers: { "content-type": "application/json" }, body: o.json ? JSON.stringify(o.json) : undefined }); return { status: r.status, d: await r.json().catch(() => ({})) }; };
const until = async (id, ms = 30000) => { const t0 = Date.now(); let j; while (Date.now() - t0 < ms) { j = (await api("/v1/jobs/" + id)).d; if (j.status === "done" || j.status === "failed") return j; await new Promise((r) => setTimeout(r, 700)); } return j; };
try {
  for (let i = 0; i < 80; i++) { try { await api("/v1/config"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const caps = (await api("/v1/world/caps")).d;
  ok(caps.ai === true && caps.vision === true && caps.worldlabs === true && caps.pano === true, "caps: text AI, picture reading and World Labs are offered (" + JSON.stringify(caps) + ")");
  ok(caps.cost && caps.cost.plan === 1 && caps.cost.worldlabs >= 1, "caps: the AI plan costs 1 credit and the World Labs price comes from the price table (" + JSON.stringify(caps.cost) + ")");

  // plan from words
  const p1 = await api("/v1/world/plan", { json: { prompt: "a desert oasis with palms, tents, three camels and a red ball", lang: "en" } });
  const plan = p1.d.plan || {};
  ok(p1.status === 200 && p1.d.ai === true && plan.place === "oasis", "plan from words: the text AI wrote it (" + p1.status + " · " + (p1.d.error || plan.place) + ")");
  ok(!plan.objects.some((o) => o.type === "rocket_launcher"), "plan: a type the engine doesn't know is dropped (cleanPlan)");
  ok(plan.objects.some((o) => o.type === "ball") && plan.life.some((l) => l.type === "camel"), "plan: the words' ball and camels are there");
  const gl = seen.filter((s) => s.path.includes(":generateContent")).pop();
  ok(gl && gl.g === GKEY && !(gl.auth || "").includes(GKEY) && !/[?&]key=/.test(gl.path), "the Google key goes only in the x-goog-api-key header");
  ok(gl && /data, never instructions/.test(JSON.stringify(gl.body)), "the client's words are sent as data, never as instructions");

  // plan from a picture
  const img = "data:image/png;base64," + PNG.toString("base64");
  const p2 = await api("/v1/world/plan", { json: { prompt: "", image: img, lang: "ar" } });
  const gi = seen.filter((s) => s.path.includes(":generateContent")).pop(), parts = gi?.body?.contents?.[0]?.parts || [];
  ok(p2.status === 200 && p2.d.ai === true && p2.d.plan && p2.d.plan.objects.length > 0, "plan from a picture: a whole world comes back");
  ok(parts.some((p) => { const d = p.inlineData || p.inline_data; return d && d.data === PNG.toString("base64"); }), "the picture reaches the vision AI as inline data");
  ok(parts.some((p) => /turn a photo into a 3D world/.test(p.text || "") && /"box":\[x0,y0,x1,y1\]/.test(p.text || "")), "the AI is asked to rebuild the place (where each thing stands, its box in the photo)");
  ok((await api("/v1/world/plan", { json: { prompt: "" } })).status === 400, "no words and no picture → a clear 400");

  // edit
  const e1 = await api("/v1/world/edit", { json: { plan, text: "make it night and add three more camels", lang: "en" } });
  ok(e1.status === 200 && e1.d.plan && e1.d.plan.time === 22 && e1.d.plan.seed === plan.seed, "edit: the AI changes the plan and the world keeps its seed");

  // the text AI fails → the words still make a world, nothing charged
  gmode = "down";
  const p3 = await api("/v1/world/plan", { json: { prompt: "a snowy mountain village at night with a campfire", lang: "en" } });
  ok(p3.status === 200 && p3.d.ai === false && p3.d.cost === 0 && p3.d.plan && p3.d.plan.objects.length > 0, "AI down → the plan is made from the words, cost 0 (" + (p3.d.note || "") + ")");
  const e2 = await api("/v1/world/edit", { json: { plan, text: "make it night", lang: "en" } });
  ok(e2.status === 200 && e2.d.ai === false && e2.d.plan.time >= 19, "AI down → simple changes still work from the words");
  gmode = "ok";

  // World Labs from words
  const w1 = await api("/v1/jobs", { json: { kind: "world", prompt: "a quiet desert oasis at sunset", title: "3D world · oasis", meta: { engine: "worldlabs" } } });
  ok(w1.status === 200 && w1.d.id, "World Labs job accepted (" + (w1.d.error || w1.status) + ")");
  const j1 = await until(w1.d.id), gen1 = seen.find((s) => s.path === "/marble/v1/worlds:generate");
  ok(gen1 && gen1.wl === KEY && !(gen1.auth || "").includes(KEY), "World Labs got the key only in the WLT-Api-Key header");
  ok(gen1 && gen1.body.world_prompt && gen1.body.world_prompt.type === "text" && /desert oasis/.test(gen1.body.world_prompt.text_prompt), "World Labs got a text world prompt");
  ok(j1 && j1.status === "done" && Array.isArray(j1.segments) && j1.segments.length === 5, "the world finished with 5 files in a fixed order (" + (j1 && (j1.status + " " + (j1.error || ""))) + ")");
  ok(j1 && j1.segments.every((s) => /^http:\/\/localhost:8176\/media\//.test(s)) && j1.url === j1.segments[0], "every file is kept on our server (/media) once, the light splat first (no second download)");
  ok(j1 && /\.spz$/.test(j1.segments[0]) && /\.spz$/.test(j1.segments[1]) && /\.glb$/.test(j1.segments[2]) && /\.jpg$/.test(j1.segments[3]), "order: 100k splat, 500k splat, collider, panorama, thumbnail");

  // World Labs from a picture
  const w2 = await api("/v1/jobs", { json: { kind: "world", prompt: "the same place", meta: { engine: "worldlabs" }, inputs: { wRef: img } } });
  await until(w2.d.id); const gen2 = seen.filter((s) => s.path === "/marble/v1/worlds:generate")[1];
  ok(gen2 && gen2.body.world_prompt.type === "image" && gen2.body.world_prompt.image_prompt.source === "data_base64" && gen2.body.world_prompt.image_prompt.extension === "png", "a picture goes to World Labs as an image world prompt (base64, png)");

  // "auto" with World Labs connected → World Labs, at the World Labs price (the price follows the same choice as the route)
  const w4 = await api("/v1/jobs", { json: { kind: "world", prompt: "a calm lake at dawn", meta: { engine: "auto" } } });
  const j4 = await until(w4.d.id);
  ok(w4.status === 200 && j4 && j4.status === "done" && seen.filter((s) => s.path === "/marble/v1/worlds:generate").length === 3, "engine auto + World Labs connected → a World Labs world");
  // the price (the local test user is staff and pays 0, so priceOf is asked directly, in a clean folder with and without the key)
  const price = (wlKey) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-price-")); try {
    const src = `const b = await import(${JSON.stringify(url.pathToFileURL(path.join(ROOT, "lib/billing.js")).href)}); const w = (e) => b.priceOf("world", { kind: "world", meta: { engine: e } });
      console.log(JSON.stringify({ wl: w("worldlabs"), auto: w("auto"), sky: w("skybox"), base: b.basePrice("fixed", "worldlabs") })); process.exit(0);`;
    return JSON.parse(execFileSync("node", ["--input-type=module", "-e", src], { cwd: dir, env: { ...env, SECRET_KEY: "w".repeat(40), ...(wlKey ? { WORLDLABS_API_KEY: wlKey } : {}) }, encoding: "utf8", timeout: 30000 }).trim().split("\n").pop());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); } };
  const pOn = price(KEY), pOff = price("");
  ok(pOn.base >= 1 && pOn.wl === pOn.base && pOn.auto === pOn.base && pOff.wl === pOff.base && pOff.auto === pOff.sky && pOff.auto !== pOff.base,
    "price: a World Labs world costs the World Labs price; 'auto' costs it only when World Labs is connected (" + JSON.stringify([pOn, pOff]) + ")");

  // a failed world
  const w3 = await api("/v1/jobs", { json: { kind: "world", prompt: "FAILME", meta: { engine: "worldlabs" } } });
  const j3 = await until(w3.d.id);
  ok(j3 && j3.status === "failed", "a failed World Labs world ends as failed (" + (j3 && j3.status) + ")");

  // Admin health check: a made-up operation → 404 = reachable and key accepted (nothing is generated)
  const h = await api("/v1/admin/providers/worldlabs/test", { json: {} });
  ok(h.status === 200 && h.d.state === "online", "Admin → Test: World Labs online (" + JSON.stringify(h.d).slice(0, 120) + ")");
  ok(seen.filter((s) => s.path === "/marble/v1/worlds:generate").length === 4, "the health check generates nothing");
} catch (e) { ok(false, "crashed: " + e.message); }
finally { srv.kill(); mock.close(); }
if (fail && errs) console.log(errs.slice(-1500));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
