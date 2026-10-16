// v89 on the server and in the page's code:
//  A) a file from another server: a busy server (503) is tried again, a server that hangs gives up after the time limit, a
//     missing file (404) isn't asked for again
//  B) results that still point at an engine's (expiring) link are copied to this server — the recent ones, three tries each;
//     old ones and ones already here are left alone
//  C) a real server: the public config says the text AI is on, never which provider or model; the text AI test is the
//     owner's only (a signed-out request is refused) and its "not connected" message names no provider
//  D) the page's code: no function nothing calls, no logo picture set twice, no old loader parts (spinner, percent, timer)
// Run: node tests/v89_api.mjs
import http from "http"; import { spawn } from "child_process"; import path from "path"; import url from "url"; import fs from "fs"; import os from "os";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };

// ---------- A + B) in a clean folder ----------
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v89-")); fs.mkdirSync(DIR + "/data"); fs.mkdirSync(DIR + "/media"); process.chdir(DIR);
process.env.PUBLIC_BASE_URL = "https://nooi.test"; delete process.env.MIRROR_MEDIA;
const DAY = 24 * 3600 * 1000, now = Date.now();
fs.writeFileSync(DIR + "/data/db.json", JSON.stringify({ users: { u1: { jobs: {} } } }));
let hits = {}; const files = http.createServer((req, res) => { hits[req.url] = (hits[req.url] || 0) + 1;
  if (req.url === "/busy" && hits[req.url] < 3) { res.writeHead(503); return res.end(); }
  if (req.url === "/hang") return;
  if (req.url.startsWith("/gone")) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": "video/mp4" }); res.end(Buffer.alloc(2048, 1)); });
await new Promise((r) => files.listen(0, "127.0.0.1", r)); const F = `http://127.0.0.1:${files.address().port}`;
try {
  const { download } = await import(ROOT + "/lib/media.js");
  const a = await download(F + "/busy"); ok(/^https:\/\/nooi\.test\/media\/\w+\.mp4$/.test(a.url) && hits["/busy"] === 3 && fs.statSync(a.file).size === 2048, "a busy server (503) is tried again and the file is kept here");
  let t0 = Date.now(), e1 = null; try { await download(F + "/hang", null, { timeoutMs: 300, tries: 2 }); } catch (e) { e1 = e.message; }
  ok(e1 === "Download timed out" && Date.now() - t0 < 4000, "a server that hangs gives up after the time limit (" + (Date.now() - t0) + " ms) — a job is never held forever");
  let e2 = null; try { await download(F + "/gone-a"); } catch (e) { e2 = e.message; } ok(/404/.test(e2) && hits["/gone-a"] === 1, "a missing file (404) isn't asked for again");

  const store = await import(ROOT + "/lib/store.js"); const U = store.user("u1");
  U.jobs = { j1: { id: "j1", status: "done", url: F + "/fresh.mp4", created: now - 3600e3 },
             j2: { id: "j2", status: "done", url: F + "/gone-b.mp4", created: now - 3600e3 },
             j3: { id: "j3", status: "done", url: F + "/old.mp4", created: now - 3 * DAY },
             j4: { id: "j4", status: "done", url: "https://nooi.test/media/here.mp4", created: now },
             j5: { id: "j5", status: "rendering", url: null, created: now } };
  const { keepMedia } = await import(ROOT + "/lib/v89.js");
  const n1 = await keepMedia({ now });
  ok(/^https:\/\/nooi\.test\/media\/\w+\.mp4$/.test(U.jobs.j1.url) && !U.jobs.j1.keepTried, "a recent result on the engine's link is copied here (" + U.jobs.j1.url.slice(-20) + ")");
  ok(U.jobs.j2.url.endsWith("/gone-b.mp4") && U.jobs.j2.keepTried === 1, "an expired link stays as it is (tried once so far)");
  ok(U.jobs.j3.url.endsWith("/old.mp4") && !hits["/old.mp4"] && U.jobs.j4.url.endsWith("/here.mp4") && n1 === 2, "older than two days, already here, or not finished: left alone");
  await keepMedia({ now }); await keepMedia({ now }); const before = hits["/gone-b.mp4"]; await keepMedia({ now });
  ok(U.jobs.j2.keepTried === 3 && hits["/gone-b.mp4"] === before && before === 3, "an expired link is tried three times, then left");
  process.env.MIRROR_MEDIA = "false"; U.jobs.j6 = { id: "j6", status: "done", url: F + "/x.mp4", created: now }; ok((await keepMedia({ now })) === 0 && U.jobs.j6.url.endsWith("/x.mp4"), "MIRROR_MEDIA=false: nothing is copied"); delete process.env.MIRROR_MEDIA;
} catch (e) { ok(false, "units crashed: " + (e.stack || e.message)); }
files.close();

// ---------- C) a real server ----------
const boot = async (port, extra) => {
  const SD = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v89s-")); fs.mkdirSync(SD + "/data"); fs.mkdirSync(SD + "/media"); fs.symlinkSync(ROOT + "/public", SD + "/public"); fs.symlinkSync(ROOT + "/node_modules", SD + "/node_modules");
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(LLM_|ANTHROPIC_|NVIDIA_|LOCAL_LLM|GEMMA_|GOOGLE_|DASHSCOPE_|KIE_|FIREBASE_)/.test(k)));
  const srv = spawn("node", [ROOT + "/server.js"], { cwd: SD, env: { ...env, PORT: String(port), SECRET_KEY: "w".repeat(40), PUBLIC_BASE_URL: `http://localhost:${port}`, AGENTS_AUTO_LEARN: "false", FREE_PERIOD: "false", ...extra }, stdio: ["ignore", "ignore", "pipe"] });
  for (let i = 0; i < 80; i++) { try { await fetch(`http://localhost:${port}/v1/config`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  return srv;
};
const get = async (port, p) => { const r = await fetch(`http://localhost:${port}${p}`); let d = null; try { d = await r.json(); } catch {} return { status: r.status, d }; };
let s1 = null, s2 = null;
try {
  // signed-in site with a text AI: the public config shows on/off only, the test needs the owner
  s1 = await boot(8194, { FIREBASE_PROJECT_ID: "demo-nooi", LLM_API_KEY: "x", LLM_BASE_URL: "https://text-ai.invalid/apps/anthropic", LLM_MODEL: "some-model" });
  const c = (await get(8194, "/v1/config")).d;
  ok(c && c.llm && c.llm.on === true && !("provider" in c.llm) && !("model" in c.llm) && !JSON.stringify(c).includes("some-model") && !JSON.stringify(c).includes("text-ai.invalid"), "the public config says the text AI is on — not which provider, model or address");
  const t = await get(8194, "/v1/llm/test"); ok(t.status === 401 || t.status === 403, "the text AI test refuses a signed-out request (" + t.status + ")");
  // the local single-user site (the owner): no text AI → a plain message without provider names
  s2 = await boot(8195, { FIREBASE_PROJECT_ID: "" });
  const t2 = await get(8195, "/v1/llm/test"); ok(t2.status === 501 && /isn't connected yet/.test(t2.d.error) && !/qwen|anthropic|claude/i.test(t2.d.error), "not connected: \"" + (t2.d && t2.d.error) + "\"");
  ok((await get(8195, "/v1/config")).d.llm === null, "no text AI: the config says so (null)");
} catch (e) { ok(false, "server checks crashed: " + (e.stack || e.message)); }
finally { s1 && s1.kill(); s2 && s2.kill(); }

// ---------- D) the page's code ----------
const html = fs.readFileSync(ROOT + "/public/index.html", "utf8");
const script = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const decl = [...new Set([...script.matchAll(/(?:^|[;\s}])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
const count = (n) => (html.match(new RegExp("(?<![\\w$.])" + n.replace(/\$/g, "\\$") + "(?![\\w$])", "g")) || []).length;
const unused = decl.filter((n) => count(n) <= 1); ok(unused.length === 0, "no function in the page that nothing calls (" + decl.length + " functions" + (unused.length ? "; unused: " + unused.join(" ") : "") + ")");
const keys = {}; for (const m of html.matchAll(/(?:LOGO_SRC=\{|Object\.assign\(LOGO_SRC,\{)([\s\S]*?)\}\)?;/g)) for (const k of m[1].matchAll(/"?([a-z0-9_]+)"?:"data:/g)) keys[k[1]] = (keys[k[1]] || 0) + 1;
const twice = Object.entries(keys).filter(([, v]) => v > 1).map(([k]) => k); ok(Object.keys(keys).length > 10 && !twice.length, "every model logo picture is set once (" + Object.keys(keys).length + " logos" + (twice.length ? "; twice: " + twice.join(" ") : "") + ")");
ok(!/class="hfspin"|data-pct=|class="hfel"|hfExpect|Usually 1–3 minutes/.test(html), "no old loader parts left (spinner, percent, timer, \"Usually 1–3 minutes\")");
ok(!/'<span class="sjobs">'\+\(n\?n:/.test(html) && !/'\+\(i\+1\)\+"<\/span>"\}\)/.test(html), "no numbers on the crew or on the model list");
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
