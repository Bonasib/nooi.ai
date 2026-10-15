// v87 on the server, with mocked engines:
//  A) adapters (fetch mocked) and prices: Model Studio 3D (Tripo on DashScope) request/poll shapes and its routing ("off", the fallback to
//     the site's other 3D engine); a character's face reaches the picture engines — Kie (Nano Banana 2 / Pro, Seedream) with the
//     face alone or after the user's picture, Google's own Nano Banana as inline data read from /media or a web address.
//  B) a real nooi server in front of mocked Kie + DashScope: the presenters list says how many exist; "Auto" time is not midnight;
//     a plan from words has its people; the owner makes the world's people (full-body photo → 3D model, chained on the server)
//     and GET /v1/world/cast lists them; a customer can't start it.
// Run: node tests/v87_api.mjs
import http from "http"; import { spawn } from "child_process"; import path from "path"; import url from "url"; import fs from "fs"; import os from "os";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

// ---------- A) adapters, in a clean folder (its own data/ and media/) ----------
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v87-")); fs.mkdirSync(DIR + "/data"); fs.mkdirSync(DIR + "/media"); process.chdir(DIR);
process.env.SECRET_KEY = "s".repeat(40); process.env.PUBLIC_BASE_URL = "https://nooi.test";
for (const k of Object.keys(process.env)) if (/^(DASHSCOPE_|TRIPO_|MESHY_|KIE_|GOOGLE_|NVIDIA_)/.test(k)) delete process.env[k];
const resp = (status, body, type = "application/json") => ({ ok: status < 400, status, headers: { get: (h) => (h.toLowerCase() === "content-type" ? type : null) }, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => body, arrayBuffer: async () => (Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))) });
let queue = []; const seen = [], realFetch = globalThis.fetch;
globalThis.fetch = async (u, o = {}) => { seen.push({ u: String(u), method: o.method || "GET", h: o.headers || {}, body: o.body && typeof o.body === "string" ? JSON.parse(o.body) : null }); const f = queue.shift(); if (!f) throw new Error("no mock for " + u); return typeof f === "function" ? f(String(u)) : f; };
try {
  const st = await import(ROOT + "/lib/settings.js");
  st.saveCfg("providers", "qwen", { apiKey: "ds-test-key" });
  const g3 = await import(ROOT + "/providers/gen3d.js");
  ok(g3.ms3dOn(), "Model Studio 3D is on as soon as the DashScope key is there");
  let r = g3.gen3dRoute("sam3d", { kind: "3d", meta: { mode: "body", engine: "auto" } });
  ok(r && r.key === "ms3d", "a 3D job (engine auto) goes to Model Studio 3D");
  // submit: words
  const A = g3.ms3d(); queue = [resp(200, { request_id: "q1", output: { task_id: "t-1", task_status: "PENDING" } })];
  const s1 = await A.submit({ kind: "3d", prompt: "a man in a white thobe", meta: { mode: "body" } }); let s = seen.at(-1);
  ok(s1.remoteId === "t-1" && s.method === "POST" && s.u === "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/3d-generation", "words → POST …/services/aigc/video-generation/3d-generation, task id kept");
  ok(s.h.Authorization === "Bearer ds-test-key" && s.h["X-DashScope-Async"] === "enable", "the key only in the Authorization header, async mode on");
  ok(s.body.model === "Tripo/Tripo-P1.0" && s.body.input.prompt.includes("white thobe") && s.body.parameters.texture_quality === "detailed", "body: model Tripo/Tripo-P1.0, input.prompt, detailed texture");
  // submit: a picture on our server → its public address
  queue = [resp(200, { output: { task_id: "t-2" } })]; await A.submit({ kind: "3d", prompt: "", inputs: { s3dImg: "/media/body.png" }, meta: {} }); s = seen.at(-1);
  ok(s.body.input.image === "https://nooi.test/media/body.png" && !s.body.input.prompt, "a picture → input.image with the server's public address");
  // poll
  for (const [stt, want] of [["PENDING", "queued"], ["RUNNING", "rendering"]]) { queue = [resp(200, { output: { task_id: "t-1", task_status: stt } })]; ok((await A.poll("t-1")).status === want, `poll ${stt} → ${want}`); }
  queue = [resp(200, { output: { task_id: "t-1", task_status: "SUCCEEDED", results: [{ pbr_model_url: "https://cdn.test/m.glb?auth_key=x", rendered_image_url: "https://cdn.test/p.png" }] } }), resp(200, Buffer.from("glTF-bytes"), "model/gltf-binary")];
  let p = await A.poll("t-1"); ok(p.status === "done" && /^https:\/\/nooi\.test\/media\/[\w-]+\.glb$/.test(p.url) && seen.at(-2).u.endsWith("/tasks/t-1"), "SUCCEEDED → the .glb is kept on our server at once (its link expires in 2 hours)");
  queue = [resp(200, { output: { task_id: "t-1", task_status: "FAILED", code: "InvalidParameter", message: "image too small" } })];
  p = await A.poll("t-1"); ok(p.status === "failed" && /image too small/.test(p.error), "FAILED → failed with the reason");
  queue = [resp(400, { code: "InvalidParameter", message: "Model not exist." })];
  let err = null; try { await A.submit({ kind: "3d", prompt: "x", meta: {} }); } catch (e) { err = e; } ok(err && /Model not exist/.test(err.message) && err.status === 400, "a model this region doesn't have → a clear error (the job runner then tries the other 3D engine)");
  // "off", another region, the other engine as a fallback
  st.saveCfg("providers", "qwen", { apiKey: "ds-test-key", model3d: "off" }); ok(!g3.ms3dOn() && !g3.gen3dRoute("sam3d", { kind: "3d", meta: { engine: "auto" } }), "3D model \"off\" → Model Studio 3D isn't used");
  st.saveCfg("providers", "qwen", { apiKey: "ds-test-key", model3d: "Tripo/Tripo-H3.1", url3d: "https://dashscope.aliyuncs.com/api/v1" }); st.saveCfg("providers", "tripo", { apiKey: "tripo-key" });
  queue = [resp(200, { output: { task_id: "t-3" } })]; await g3.ms3d().submit({ kind: "3d", prompt: "x", meta: {} }); s = seen.at(-1);
  ok(s.u.startsWith("https://dashscope.aliyuncs.com/api/v1/") && s.body.model === "Tripo/Tripo-H3.1", "the admin's 3D model and another region's URL are used");
  r = g3.gen3dRoute("sam3d", { kind: "3d", meta: { engine: "auto" }, noMs3d: true }); ok(r && r.key === "tripo", "after Model Studio 3D fails, the same job goes to the site's other 3D engine");

  // the face reaches Kie's picture models
  st.saveCfg("providers", "kie", { apiKey: "kie-key" });
  const { kieInput } = await import(ROOT + "/providers/kie.js");
  let inp = kieInput("nano-banana-pro", { kind: "image", prompt: "Faisal on a rooftop", aspect: "1:1", inputs: { iRef2: "/media/face.png" } });
  ok(Array.isArray(inp.image_input) && inp.image_input.length === 1 && inp.image_input[0] === "https://nooi.test/media/face.png", "Nano Banana Pro: a face alone (no picture of the user's) is still the reference");
  inp = kieInput("nano-banana-2", { kind: "image", prompt: "x", aspect: "1:1", inputs: { iRef: "/media/product.png", iRef2: "/media/face.png" } });
  ok(inp.image_input.join(",") === "https://nooi.test/media/product.png,https://nooi.test/media/face.png", "Nano Banana 2: the product first, then the presenter's face");
  inp = kieInput("seedream/5-lite-text-to-image", { kind: "image", prompt: "x", aspect: "1:1", inputs: { iRef: "/media/a.png", iRef2: "/media/face.png" } });
  ok((inp.image_urls || []).length === 2, "Seedream 5 Lite gets both pictures");

  // Google's own Nano Banana: references as inline data (a file on our server, and a web address)
  st.saveCfg("providers", "google", { apiKey: "g-key" });
  fs.writeFileSync(DIR + "/media/face.png", PNG);
  const dnsMod = (await import("dns")).default; const realLookup = dnsMod.promises.lookup;   // cdn.test is a public host here; inner hosts are not
  dnsMod.promises.lookup = async (h) => (h === "cdn.test" ? [{ address: "93.184.216.34", family: 4 }] : h === "inner.test" ? [{ address: "10.0.0.7", family: 4 }] : realLookup(h, { all: true }));
  const { nanoBanana } = await import(ROOT + "/providers/images2.js");
  queue = [resp(200, PNG, "image/png"), resp(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG.toString("base64") } }] } }] })];
  const g = await nanoBanana("nanopro").submit({ kind: "image", prompt: "the presenter holds the bottle", aspect: "9:16", inputs: { iRef: "https://cdn.test/product.png", iRef2: "/media/face.png" } });
  const gs = seen.at(-1), parts = gs.body.contents[0].parts;
  ok(g.done && parts.length === 3 && parts[1].inline_data.data === PNG.toString("base64") && parts[2].inline_data.data === PNG.toString("base64") && gs.h["x-goog-api-key"] === "g-key", "Google Nano Banana gets the user's picture and the face as inline data (both, not just data: URLs)");
  // the server never fetches a picture address on its own network, a metadata address, plain http or a name that points inside
  const n0 = seen.length; queue = [resp(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG.toString("base64") } }] } }] })];
  await nanoBanana("nano").submit({ kind: "image", prompt: "x", inputs: { iRef: "https://169.254.169.254/latest/meta-data/", iRef2: "http://cdn.test/a.png", iRef3: "https://inner.test/a.png", iRef4: "https://localhost/a.png" } });
  const asked = seen.slice(n0).map((x) => x.u);
  ok(asked.length === 1 && /generateContent/.test(asked[0]) && seen.at(-1).body.contents[0].parts.length === 1, `inner, metadata, http and localhost addresses are not fetched (${asked.length - 1} fetched)`);
  dnsMod.promises.lookup = realLookup;

  // a character's real face, looks and sheet are charged what their picture engine costs (Pro face, quick looks from it)
  const bl = await import(ROOT + "/lib/billing.js");
  const pro = bl.basePrice("image", "nanopro"), nano = bl.basePrice("image", "nano");
  ok(bl.priceOf("look", { model: "nanopro" }) === pro && pro > 2, `the real face (Nano Banana Pro) costs a Pro picture (${pro} credits), not the old 2`);
  ok(bl.priceOf("look", { model: "nano" }) === Math.max(nano, 2) && bl.priceOf("sheet", { model: "nano" }) === Math.max(nano, 6), `a look / sheet from the face costs a Nano Banana picture (${bl.priceOf("look", { model: "nano" })} / ${bl.priceOf("sheet", { model: "nano" })})`);
  ok(bl.priceOf("look", {}) === 2 && bl.priceOf("sheet", {}) === 6, "a look / sheet with no engine chosen keeps its old price");
} catch (e) { ok(false, "adapters crashed: " + (e.stack || e.message)); }
globalThis.fetch = realFetch;

// ---------- B) a real server in front of mocked engines ----------
const NPORT = 8187, seenB = []; let kN = 0, dN = 0;
const mock = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  const u = new URL(req.url, "http://x"), body = b ? JSON.parse(b) : {}, send = (st, o) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  seenB.push({ path: u.pathname, body, auth: req.headers.authorization });
  if (u.pathname.startsWith("/files/")) { res.writeHead(200, { "content-type": u.pathname.endsWith(".glb") ? "model/gltf-binary" : "image/png" }); return res.end(PNG); }
  if (u.pathname === "/api/v1/jobs/createTask") return send(200, { code: 200, data: { taskId: "k" + ++kN } });
  if (u.pathname === "/api/v1/jobs/recordInfo") return send(200, { code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: [`http://127.0.0.1:${mock.address().port}/files/${u.searchParams.get("taskId")}.png`] }) } });
  if (u.pathname === "/api/v1/services/aigc/video-generation/3d-generation") return send(200, { output: { task_id: "d" + ++dN, task_status: "PENDING" } });
  const m = /^\/api\/v1\/tasks\/(d\d+)$/.exec(u.pathname); if (m) return send(200, { output: { task_id: m[1], task_status: "SUCCEEDED", results: [{ pbr_model_url: `http://127.0.0.1:${mock.address().port}/files/${m[1]}.glb` }] } });
  send(404, {});
}); });
await new Promise((r) => mock.listen(0, "127.0.0.1", r)); const M = `http://127.0.0.1:${mock.address().port}`;
const SD = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v87s-")); fs.mkdirSync(SD + "/data"); fs.mkdirSync(SD + "/media"); fs.symlinkSync(ROOT + "/public", SD + "/public"); fs.symlinkSync(ROOT + "/node_modules", SD + "/node_modules");
fs.writeFileSync(SD + "/data/db.json", JSON.stringify({ users: { local: { plan: "studio", credits: 5000, ledger: [], posts: {}, accounts: {}, jobs: {} } } }));
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(LLM_|ANTHROPIC_|NVIDIA_|LOCAL_LLM|GEMMA_|GOOGLE_|DASHSCOPE_|WORLDLABS_|WORLD_|TRIPO_|MESHY_|BLOCKADE_|KIE_)/.test(k)));
const srv = spawn("node", [ROOT + "/server.js"], { cwd: SD, env: { ...env, PORT: String(NPORT), SECRET_KEY: "w".repeat(40), FIREBASE_PROJECT_ID: "", PUBLIC_BASE_URL: `http://localhost:${NPORT}`, FREE_PERIOD: "false", AGENTS_AUTO_LEARN: "false",
  KIE_API_KEY: "kie-key", KIE_BASE_URL: M, DASHSCOPE_API_KEY: "ds-key", DASHSCOPE_BASE_URL: M + "/api/v1" }, stdio: ["ignore", "ignore", "pipe"] });
let errs = ""; srv.stderr.on("data", (d) => (errs += d));
const api = async (p, o = {}) => { const r = await fetch(`http://localhost:${NPORT}${p}`, { method: o.method || (o.json ? "POST" : "GET"), headers: { "content-type": "application/json" }, body: o.json ? JSON.stringify(o.json) : undefined }); let d = null; try { d = await r.json(); } catch {} return { status: r.status, d }; };
try {
  for (let i = 0; i < 80; i++) { try { await api("/v1/config"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const av = (await api("/v1/avatars")).d;
  ok(av && av.total >= 15 && Array.isArray(av.items) && av.making === 0, "presenters: the list says how many exist (" + (av && av.total) + ") and how many are being made");
  const caps = (await api("/v1/world/caps")).d; ok(caps && caps.objects3d === true, "3D World: 3D models are offered (Model Studio 3D with the DashScope key)");
  // "Auto" time: the place decides (it used to become midnight)
  const p1 = (await api("/v1/world/plan", { json: { prompt: "a park, a man walks to the bench and a woman waves", lang: "en", time: null } })).d;
  ok(p1 && p1.plan && p1.plan.time > 6 && p1.plan.time < 18, "time left on Auto is daytime for a park (" + (p1 && p1.plan && p1.plan.time) + "), not 0");
  ok(p1 && p1.plan.people.some((e) => e.act === "walk" && e.target === "bench") && p1.plan.people.some((e) => e.act === "wave"), "the plan has its people: one walks to the bench, one waves");
  ok(p1 && !p1.plan.life.some((l) => l.type === "person"), "people are not drawn as \"life\" boxes any more");
  // the world's people, made once by the owner: full-body photo (Kie) → 3D model (Model Studio 3D), chained on the server
  const c0 = (await api("/v1/world/cast")).d; ok(c0 && c0.total === 8 && c0.items.length === 0, "the world's people: 8 to make, none yet");
  const mk = await api("/v1/admin/world/cast", { json: {} }); ok(mk.status === 200 && mk.d.started.length === 8, "the owner starts them (8)");
  let c1 = null; for (let i = 0; i < 120; i++) { c1 = (await api("/v1/world/cast")).d; if (c1.items.length === 8) break; await new Promise((r) => setTimeout(r, 500)); }
  ok(c1 && c1.items.length === 8 && c1.items.every((x) => /^http:\/\/localhost:8187\/media\/[\w-]+\.glb$/.test(x.url)), "each one became a 3D model kept on our server (" + (c1 && c1.items.length) + "/8)");
  const ct = seenB.filter((x) => x.path === "/api/v1/jobs/createTask"), d3 = seenB.filter((x) => x.path === "/api/v1/services/aigc/video-generation/3d-generation");
  ok(ct.length === 8 && ct.every((x) => x.body.model === "nano-banana-pro" && /A-pose/.test(x.body.input.prompt) && /fictional person/.test(x.body.input.prompt)), "the photos: Nano Banana Pro, full body in an A-pose, fictional people");
  ok(d3.length === 8 && d3.every((x) => /^http:\/\/localhost:8187\/media\//.test(x.body.input.image) && x.auth === "Bearer ds-key"), "the 3D models start from those photos (on our server), with the DashScope key");
  const again = (await api("/v1/admin/world/cast", { json: {} })).d; ok(again && again.started.length === 0, "made once: asking again makes nothing new");
} catch (e) { ok(false, "server checks crashed: " + (e.stack || e.message)); }
finally { srv.kill(); mock.close(); }
if (fail && errs) console.log(errs.slice(-1500));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
