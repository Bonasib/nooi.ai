// v124 — many customers at once, with a mock AI engine as strict as Kie (it takes N new tasks a window and answers the rest
// "429", dropping them) and the real nooi server:
//  · 60 jobs sent at once all finish — none fails with "High demand"; the engine never gets more than its limit; the jobs
//    that waited said where they were in the line ("ahead", seconds)
//  · the engine also says "too many" now and then by itself (another app on the key): the job keeps its place, and still finishes
//  · one request for many jobs (/v1/jobs/live); a job it doesn't know is null
//  · the page leaves compressed (brotli / gzip, smaller than half), with an ETag — a returning visitor gets 304 and nothing more
//  · Admin → Speed shows the line; the owner sets the engine's limit (and a wrong one is refused)
//  · the line itself (no server): fair between customers, a 429 keeps the task at the front, too long a wait → given back with
//    its reason in English and Arabic
// Run: node tests/v124.mjs
import http from "http"; import { spawn } from "child_process"; import path from "path"; import url from "url"; import fs from "fs"; import os from "os"; import zlib from "zlib";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const KPORT = 8341, NPORT = 8342, KEY = "kie_v124", LIMIT = 6, WIN = 1000;   // the mock engine: 6 new tasks a second
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const hits = [], tasks = {}; let n = 0, r429 = 0, over = 0, chaos = 0, maxInWin = 0;
const kie = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const u = new URL(req.url, "http://x"), send = (d, code = 200, msg = "success") => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ code, msg, data: d })); };
    if (u.pathname.startsWith("/out.")) { res.setHeader("content-type", "image/png"); return res.end(PNG); }
    if (u.pathname === "/api/v1/jobs/createTask") {
      const now = Date.now(); while (hits.length && now - hits[0] >= WIN) hits.shift();
      if (chaos > 0) { chaos--; r429++; return send(null, 429, "Too many requests"); }   // another app on the same key
      if (hits.length >= LIMIT) { r429++; over++; return send(null, 429, "Too many requests"); }
      hits.push(now); maxInWin = Math.max(maxInWin, hits.length); const id = "t" + ++n; tasks[id] = { polls: 0 }; return send({ taskId: id }); }
    if (u.pathname === "/api/v1/jobs/recordInfo") { const t = tasks[u.searchParams.get("taskId")]; if (!t) return send(null, 404, "no task");
      return send(++t.polls >= 2 ? { state: "success", resultJson: JSON.stringify({ resultUrls: [`http://localhost:${KPORT}/out.png`] }) } : { state: "generating" }); }
    res.statusCode = 404; res.end("{}");
  });
}).listen(KPORT);
const D = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v124-")); fs.mkdirSync(D + "/data"); fs.mkdirSync(D + "/media"); fs.symlinkSync(ROOT + "/public", D + "/public"); fs.symlinkSync(ROOT + "/node_modules", D + "/node_modules");
fs.writeFileSync(D + "/data/db.json", JSON.stringify({ users: { local: { plan: "studio", credits: 5000, ledger: [], posts: {}, accounts: {}, jobs: {} } } }));
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(LLM_|ANTHROPIC_|NVIDIA_|ELEVENLABS_|OPENAI_|KIE_|FAL_|GOOGLE_|DASHSCOPE_|FIREBASE_)/.test(k)));
const srv = spawn("node", [ROOT + "/server.js"], { cwd: D, env: { ...env, PORT: String(NPORT), SECRET_KEY: "e".repeat(40), KIE_API_KEY: KEY, KIE_BASE_URL: `http://localhost:${KPORT}`, KIE_RATE: `${LIMIT}/1`, FIREBASE_PROJECT_ID: "",
  PUBLIC_BASE_URL: `http://localhost:${NPORT}`, MIRROR_MEDIA: "false", FREE_PERIOD: "false", AGENTS_AUTO_LEARN: "false", RECOVER_MS: "999999" }, stdio: ["ignore", "ignore", "pipe"] });
let log = ""; srv.stderr.on("data", (d) => (log += d));
const api = async (p, o = {}) => { const r = await fetch(`http://localhost:${NPORT}${p}`, { method: o.method || (o.json ? "POST" : "GET"), headers: { "content-type": "application/json", ...(o.headers || {}) }, body: o.json ? JSON.stringify(o.json) : undefined });
  const t = o.raw ? null : await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch {} return { status: r.status, d, r }; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 80; i++) { try { await api("/v1/config"); break; } catch { await wait(250); } }
  // 1) 60 jobs at once
  const made = await Promise.all(Array.from({ length: 60 }, (_, i) => api("/v1/jobs", { json: { kind: "image", model: "nano", prompt: `a red apple number ${i}`, aspect: "1:1" } })));
  ok(made.every((m) => m.status === 200 && m.d && m.d.id), "60 jobs sent at once are all accepted " + JSON.stringify(made.filter((m) => m.status !== 200).map((m) => m.d).slice(0, 2)));
  const ids = made.map((m) => m.d.id); let seenLine = null, jobs = {}; const t0 = Date.now();
  setTimeout(() => (chaos = 3), 1500);   // another app on the same key fires a burst: three "too many" answers in a row
  while (Date.now() - t0 < 90000) {
    const r = await api("/v1/jobs/live?ids=" + ids.slice(0, 50).join(",")), r2 = await api("/v1/jobs/live?ids=" + ids.slice(50).join(","));
    jobs = { ...(r.d?.jobs || {}), ...(r2.d?.jobs || {}) };
    const w = Object.values(jobs).find((j) => j && j.stage === "line" && j.line && j.line.ahead > 0); if (w && !seenLine) seenLine = w.line;
    if (Object.values(jobs).every((j) => j && ["done", "failed"].includes(j.status))) break; await wait(400);
  }
  const all = Object.values(jobs), failed = all.filter((j) => j.status === "failed");
  ok(all.length === 60 && all.every((j) => j.status === "done"), `all 60 finished, none failed (${all.filter((j) => j.status === "done").length} done, ${failed.length} failed${failed[0] ? ": " + failed[0].error : ""}) in ${Math.round((Date.now() - t0) / 100) / 10} s`);
  ok(!!seenLine && seenLine.ahead > 0 && seenLine.sec >= 0, "a job waiting its turn said where it was in the line " + JSON.stringify(seenLine));
  ok(maxInWin <= LIMIT && over <= 6, `the engine never got more than its limit in a second (most: ${maxInWin} of ${LIMIT}; a request that arrived late and was refused: ${over} of 60)`);
  ok(r429 >= 3, `the engine's own "too many" answers were taken calmly (${r429} in all) — the jobs kept their place`);
  ok(!/High demand/.test(JSON.stringify(all)), "no job says \"High demand right now\"");
  // 2) one request for many jobs
  const lv = await api("/v1/jobs/live?ids=" + ids[0] + ",nosuchjob");
  ok(lv.status === 200 && lv.d.jobs[ids[0]]?.status === "done" && lv.d.jobs.nosuchjob === null, "one request answers for several jobs; one it doesn't know is null");
  // 3) the page, compressed, with an ETag
  const raw = fs.statSync(ROOT + "/public/index.html").size; await wait(9000);   // (brotli at its best takes a few seconds once)
  // (raw bytes: Node's fetch would unpack them by itself)
  const get = (p, h) => new Promise((ok2, no) => http.get({ host: "localhost", port: NPORT, path: p, headers: h }, (r) => { const c = []; r.on("data", (x) => c.push(x)); r.on("end", () => ok2({ status: r.statusCode, h: r.headers, body: Buffer.concat(c) })); }).on("error", no));
  const br = await get("/", { "accept-encoding": "br, gzip" }), brBody = br.body, gz = await get("/index.html", { "accept-encoding": "gzip" }), gzBody = gz.body;
  const et = br.h.etag, again = await get("/", { "accept-encoding": "br", "if-none-match": et });
  let same = false; try { same = zlib.brotliDecompressSync(brBody).length === raw && zlib.gunzipSync(gzBody).length === raw; } catch {}
  ok(br.h["content-encoding"] === "br" && brBody.length < raw * 0.4 && gz.h["content-encoding"] === "gzip" && gzBody.length < raw * 0.5 && same,
    `the page leaves compressed: ${Math.round(raw / 1024)} KB → brotli ${Math.round(brBody.length / 1024)} KB · gzip ${Math.round(gzBody.length / 1024)} KB, and opens to the same page`);
  ok(!!et && again.status === 304 && again.body.length === 0, "a returning visitor: 304, nothing downloaded");
  // 4) Admin → Speed: the line and the engine's limit
  const sp = await api("/v1/admin/speed");
  ok(sp.status === 200 && sp.d.lines?.engine?.limit === `${LIMIT}/1` && sp.d.lines.engine.sent >= 60 && sp.d.lines.engine.tooMany1h >= 3 && !JSON.stringify(sp.d).includes('"kie"'), "Admin → Speed shows the engine's line (named \"engine\", as everywhere the browser sees) " + JSON.stringify(sp.d?.lines));
  ok((sp.d.advice || []).some((a) => /new tasks every/.test(a.en) && /مهام جديدة/.test(a.ar)), "and says in words why tasks waited and how to raise the limit (English, Arabic)");
  const bad = await api("/v1/admin/speed/pace", { json: { engine: "engine", pace: "fast" } }), good = await api("/v1/admin/speed/pace", { json: { engine: "engine", pace: "40/10" } });
  ok(bad.status === 400 && good.status === 200 && good.d.pace === "40/10", "the owner sets the engine's limit after its support raised it; a wrong one is refused " + JSON.stringify([bad.d, good.d]));
} catch (e) { ok(false, "crashed: " + (e.stack || e)); }
finally { srv.kill(); kie.close(); }
// 5) the line by itself: fair, keeps its place after a 429, gives back after too long a wait
{
  process.env.KIE_RATE = "4/1"; process.env.LINE_MAX_MIN = "1";
  const cwd = process.cwd(); const T = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v124l-")); fs.mkdirSync(T + "/data"); fs.writeFileSync(T + "/data/db.json", '{"users":{}}'); process.chdir(T);
  const { inLine, JOBCTX } = await import(ROOT + "/lib/line124.js"); process.chdir(cwd);
  const order = []; let first429 = true;
  const engine = (id) => { if (id === "b:0" && first429) { first429 = false; return Promise.reject(Object.assign(new Error("Kie AI 429: too many"), { status: 429 })); } order.push(id); return Promise.resolve(id); };
  const ka = setInterval(() => {}, 1000), ps = [];
  for (const [o, k] of [["a", 12], ["b", 2], ["c", 2]]) for (let i = 0; i < k; i++) { const job = { id: o + ":" + i, owner: o }; ps.push(JOBCTX.run(job, () => inLine("kie", () => engine(job.id))).then(() => "ok", (e) => e)); }
  const res = await Promise.all(ps);
  ok(res.every((r) => r === "ok"), "the line: every task went through " + JSON.stringify(res.filter((r) => r !== "ok").map((e) => e.message)));
  const lastOther = Math.max(order.indexOf("b:1"), order.indexOf("c:1"));
  ok(lastOther >= 0 && lastOther < 10 && order.slice(-4).every((x) => x.startsWith("a:")), "fair: another customer's tasks don't wait behind one customer's 12 " + JSON.stringify(order));
  ok(order.includes("b:0"), "a task the engine answered \"too many\" kept its place and went through");
  process.env.KIE_RATE = "1/60"; process.env.LINE_MAX_MIN = "0.05";   // (3 s)
  const slow = await Promise.all(Array.from({ length: 3 }, (_, i) => JOBCTX.run({ id: "s" + i, owner: "s" }, () => inLine("kie", () => Promise.resolve(i))).then(() => null, (e) => e)));
  const ex = slow.find((e) => e);
  ok(ex && ex.userMsg && /nothing was charged/.test(ex.userMsg) && /لم يُخصم شيء/.test(ex.userMsgAr) && ex.noFallback, "too long a wait → given back, with its reason in English and Arabic " + (ex && ex.userMsg));
  clearInterval(ka);
}
console.log(`\n${pass} passed, ${fail} failed`); if (fail && log) console.log(log.slice(-1500)); process.exit(fail ? 1 : 0);
