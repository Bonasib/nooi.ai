// v150: motion ads on the server. The plan of a brief with no text AI (the page's own plan, the same file), and with one (a
// stand-in text AI: a good answer is checked and kept, a scene it invents is dropped, a broken answer falls back to the plan
// made without AI); then an AI agent over /mcp builds a motion ad after a project's clip (the ad's own background clip, the
// scenes one after another, whooshes at the cuts), adds one scene, reads them back, gets a plain answer for a picture of a
// motion scene, and a read-only connection can't add any.
// Run: node tests/v150_agents.mjs
import { spawn, spawnSync } from "child_process"; import fs from "fs"; import os from "os"; import path from "path"; import url from "url"; import http from "http";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."), PORT = 8432, P2 = 8433, LP = 8434;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const dirs = [], srvs = [];
function server(port, env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v150a-")); dirs.push(dir); fs.mkdirSync(path.join(dir, "data")); fs.mkdirSync(path.join(dir, "media"));
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, "media/beach.mp4")]);
  fs.writeFileSync(path.join(dir, "data/db.json"), JSON.stringify({ users: { local: { plan: "studio", credits: 1000, ledger: [], jobs: {} } } }));
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(LLM_|ANTHROPIC_|NVIDIA_|KIE_|GOOGLE_|LOCAL_LLM|GEMMA_)/.test(k)));
  const s = spawn("node", [path.join(ROOT, "server.js")], { cwd: dir, env: { ...clean, PORT: String(port), SECRET_KEY: "a".repeat(40), FIREBASE_PROJECT_ID: "", PUBLIC_BASE_URL: "http://localhost:" + port, FREE_PERIOD: "false", AGENTS_AUTO_LEARN: "false", ...env }, stdio: "ignore" });
  srvs.push(s); return "http://localhost:" + port;
}
const req = async (B, p, opt = {}) => { const r = await fetch(B + p, { method: opt.method || "GET", headers: { "content-type": "application/json" }, body: opt.json ? JSON.stringify(opt.json) : undefined }); let d = null; try { d = await r.json(); } catch {} return { status: r.status, d }; };
let n = 10; const mcp = async (B, tk, name, args) => { const r = await req(B, "/mcp?token=" + encodeURIComponent(tk), { method: "POST", json: { jsonrpc: "2.0", id: n++, method: "tools/call", params: { name, arguments: args || {} } } }); const res = r.d && r.d.result || {}; const t = (res.content || []).find((c) => c.type === "text"); let j = null; try { j = JSON.parse(t && t.text); } catch {} return { err: !!res.isError, j, text: t && t.text, res }; };
const up = async (B) => { for (let i = 0; i < 80; i++) { try { await fetch(B + "/v1/config"); return; } catch { await new Promise((r) => setTimeout(r, 250)); } } };
// the stand-in text AI (the Anthropic Messages format): GOOD → a plan with one made-up scene, BROKEN → not JSON
let mode = "GOOD", asked = 0;
const llm = http.createServer((q, s) => { let b = ""; q.on("data", (d) => (b += d)); q.on("end", () => { asked++;
  const plan = { scenes: [{ kind: "logo", seconds: 3, title: "Lingo", subtitle: "Learn anything" }, { kind: "fireworks", seconds: 2, title: "nope" }, { kind: "counter", seconds: 3, number: "369", title: "day streak", icon: "local_fire_department" },
    { kind: "nodes", seconds: 4, items: ["Languages", "Math", "Music", "Chess", "Art", "Code", "Extra"] }, { kind: "words", seconds: 3, title: "One app.", subtitle: "Every skill." }, { kind: "end", seconds: 3, title: "Lingo", subtitle: "Start today", icon: "not_an_icon" }] };
  const text = mode === "GOOD" ? JSON.stringify(plan) : "Sorry, I can't do that.";
  s.writeHead(200, { "content-type": "application/json" }); s.end(JSON.stringify({ content: [{ type: "text", text }] })); }); });
try {
  await new Promise((r) => llm.listen(LP, r));
  const B = server(PORT, {}), B2 = server(P2, { LLM_BASE_URL: "http://localhost:" + LP, LLM_API_KEY: "x", LLM_MODEL: "mock" });
  await up(B); await up(B2);
  const brief = { brand: "Lingo", msg: "Learn any skill in 5 minutes a day. Keep a 369 day streak and climb the league with friends. Talk to a tutor on a video call. Pick from: languages, math, music, chess. One app. Every skill.", len: 30 };
  // ---- the plan without a text AI
  const p1 = await req(B, "/v1/motion150/plan", { method: "POST", json: brief }), sc = p1.d?.scenes || [], tot = sc.reduce((a, s) => a + s.dur, 0), K = ["logo", "trail", "phone", "counter", "board", "call", "nodes", "words", "end"];
  ok(p1.status === 200 && p1.d.by === "local" && sc.length >= 8 && sc.every((s) => K.includes(s.sc)) && Math.abs(tot - 30) < 0.1, "no text AI: a plan made on the server without AI, " + sc.length + " scenes adding up to 30 s");
  ok(sc[0].sc === "logo" && sc[sc.length - 1].sc === "end" && sc.find((s) => s.sc === "counter")?.val === 369 && sc.find((s) => s.sc === "nodes")?.items.join() === "languages,math,music,chess" && sc.some((s) => s.sc === "board") && sc.some((s) => s.sc === "call"),
    "…the logo first, the end card last, the 369-day number, the four skills, the league and the call from the brief");
  const ar = (await req(B, "/v1/motion150/plan", { method: "POST", json: { brand: "نوي", msg: "تعلّم أي مهارة في خمس دقائق يومياً. سلسلة 120 يوماً متتالياً. اختر: اللغات، الرياضيات، الموسيقى.", len: 20 } })).d;
  ok(ar?.scenes?.find((s) => s.sc === "counter")?.val === 120 && ar.scenes.find((s) => s.sc === "nodes")?.items.length === 3 && /ابدأ/.test(ar.scenes[ar.scenes.length - 1].t2), "an Arabic brief: its number, its three things and an Arabic call to action");
  const e1 = await req(B, "/v1/motion150/plan", { method: "POST", json: { brand: "", msg: "" } }); ok(e1.status === 400 && e1.d.errorAr, "an empty brief: a plain message in both languages");
  // ---- with a text AI: its plan is checked
  const p2 = (await req(B2, "/v1/motion150/plan", { method: "POST", json: { ...brief, len: 20 } })).d, s2 = p2?.scenes || [];
  ok(p2?.by === "ai" && asked >= 1 && s2.length === 5 && !s2.some((s) => s.sc === "fireworks") && Math.abs(s2.reduce((a, s) => a + s.dur, 0) - 20) < 0.1, "the text AI's plan: kept, the scene it made up dropped, the lengths fitted to 20 s");
  ok(s2.find((s) => s.sc === "counter").val === 369 && s2.find((s) => s.sc === "nodes").items.length === 6 && s2.find((s) => s.sc === "end").ic === null && s2.find((s) => s.sc === "counter").ic === "local_fire_department", "…numbers read, at most 6 things, an unknown icon removed, a known one kept");
  mode = "BROKEN"; const p3 = (await req(B2, "/v1/motion150/plan", { method: "POST", json: brief })).d;
  ok(p3?.by === "local" && p3.scenes.length >= 8, "a text AI answer that isn't a plan: the plan made without AI instead (an ad is always made)");
  // ---- an AI agent builds a motion ad
  const doc = { v: 1, ed: { clips: [{ id: "c1", src: { k: "upload", name: "beach.mp4" }, in: 0, out: 4, speed: 1, trans: "cut", vol: 100 }], texts: [], format: "reels" }, look: {}, media: { c_c1: { url: "/media/beach.mp4", type: "video", name: "beach.mp4" } } };
  await req(B, "/v1/projects/p1abc23", { method: "PUT", json: { name: "Holiday", doc } });
  const tk = (await req(B, "/v1/tokens", { method: "POST", json: { name: "Claude" } })).d?.token;
  const tl = (await req(B, "/mcp?token=" + tk, { method: "POST", json: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).d?.result?.tools || [];
  ok(["nooi_motion_ad", "nooi_motion_scene_add"].every((w) => tl.some((t) => t.name === w && t.inputSchema?.type === "object")), "the agent sees the two motion tools");
  const ma = await mcp(B, tk, "nooi_motion_ad", { project_id: "p1abc23", brand: "Lingo", brief: brief.msg, seconds: 20, colour: "#1CB0F6" });
  const ms = ma.j?.timeline?.motion_scenes || [];
  ok(!ma.err && ms.length >= 8 && ms[0].start === 4 && Math.abs(ms[ms.length - 1].end - 24) < 0.05 && ms.every((s, i) => i === 0 || Math.abs(s.start - ms[i - 1].end) < 0.01), "nooi_motion_ad: " + ms.length + " scenes one after another, from the end of the clip (4 s) to 24 s");
  const ed = (await req(B, "/v1/projects/p1abc23")).d.doc.ed, bg = ed.clips[1];
  ok(ed.clips.length === 2 && bg.src.k === "demo" && bg.src.kind === "mg150" && bg.src.ac === "#1CB0F6" && Math.abs(bg.out - 20) < 0.05 && bg.vol === 0, "…the ad's own background clip after the user's clip, 20 s, in the chosen colour");
  const wh = (ed.sfx || []).filter((x) => x.n === "whoosh");
  ok(wh.length === ms.length - 1 && ed.infos.every((x) => x.type === "mg150" && x.accent === "#1CB0F6") && ed.infos.find((x) => x.sc === "nodes").ics.join() === "public,percent,music_note,military_tech", "…a whoosh at every cut, the scenes in the colour, the skills with their icons (globe, %, note, medal)");
  const ops = (await req(B, "/v1/projects/p1abc23/ops?after=0")).d; ok(ops.seq === 1 && ops.ops[0].op === "motion_add" && ops.ops[0].args.infos.length === ms.length, "an open editor gets it as one operation");
  const one = await mcp(B, tk, "nooi_motion_scene_add", { project_id: "p1abc23", kind: "counter", start: 1, end: 3, number: 120, title: "days", background: "none", colour: "#FFC800" });
  const c1 = (one.j?.timeline?.motion_scenes || []).find((s) => s.kind === "counter" && s.start === 1);
  const it = (await req(B, "/v1/projects/p1abc23")).d.doc.ed.infos.find((x) => x.sc === "counter" && x.start === 1);
  ok(!one.err && c1 && c1.end === 3 && it.bg === "none" && it.val === "120" && it.accent === "#FFC800", "nooi_motion_scene_add: a big number over the video from 1 s to 3 s");
  const b1 = await mcp(B, tk, "nooi_motion_scene_add", { project_id: "p1abc23", kind: "hologram" }); ok(b1.err && /Unknown scene/.test(b1.text), "a scene the editor doesn't have: a clear error");
  const fr = await mcp(B, tk, "nooi_preview_frame", { project_id: "p1abc23", time: 10 }); ok(fr.err && /motion scenes/.test(fr.text), "a picture of a motion scene: the agent is told the editor draws it (nooi_timeline_read lists them)");
  const twice = (await req(B, "/v1/projects/p1abc23", { method: "PUT", json: { name: "Holiday", opN: 0, doc: (await req(B, "/v1/projects/p1abc23")).d.doc } }));
  const e3 = (await req(B, "/v1/projects/p1abc23")).d.doc.ed; ok(twice.status === 200 && e3.clips.length === 2 && e3.infos.length === ms.length + 1, "an editor's save that hadn't seen them: applied once, nothing doubled");
  const tid = (await req(B, "/v1/tokens")).d.tokens[0].id; await req(B, "/v1/tokens/" + tid, { method: "PUT", json: { access: "read" } });
  const ro = await mcp(B, tk, "nooi_motion_ad", { project_id: "p1abc23", brief: "x" }); ok(ro.err && /read-only/.test(ro.text), "a read-only connection can't add a motion ad");
} catch (e) { ok(false, "crashed: " + e.message); }
finally { srvs.forEach((s) => s.kill()); llm.close(); dirs.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
