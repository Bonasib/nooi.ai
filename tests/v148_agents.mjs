// v148: AI agents (Claude, ChatGPT, any MCP client) edit the editor projects kept on the account. A fresh nooi server, a
// project saved as the editor saves it, a personal token, then the agent's tools over /mcp: list the projects, read the
// timeline, look at a frame (a real picture back), add one of the user's videos, trim it, move it, add a text and a marker,
// change the size, remove a clip. Each change is in the saved project and in the operations an open editor fetches; a save
// from an editor that hasn't seen them gets them applied on the way in; applying twice changes nothing; a read-only
// connection can look but not change.
// Run: node tests/v148_agents.mjs
import { spawn, spawnSync } from "child_process"; import fs from "fs"; import os from "os"; import path from "path"; import url from "url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."), PORT = 8412, B = `http://localhost:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v148a-")); fs.mkdirSync(path.join(dir, "data")); fs.mkdirSync(path.join(dir, "media"));
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, "media/beach.mp4")]);
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x2060ff:s=640x360:d=3:r=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, "media/blue.mp4")]);
const now = Date.now();
fs.writeFileSync(path.join(dir, "data/db.json"), JSON.stringify({ users: { local: { plan: "studio", credits: 1000, ledger: [], jobs: {
  j1: { id: "j1", kind: "video", status: "done", progress: 1, url: B + "/media/beach.mp4", title: "Beach at sunset", created: now - 5, dur: 4, payload: { prompt: "beach" } },
  j2: { id: "j2", kind: "video", status: "done", progress: 1, url: B + "/media/blue.mp4", title: "Blue sky", created: now, dur: 3, payload: { prompt: "sky" } } } } } }));
const srv = spawn("node", [path.join(ROOT, "server.js")], { cwd: dir, env: { ...process.env, PORT: String(PORT), SECRET_KEY: "a".repeat(40), FIREBASE_PROJECT_ID: "", PUBLIC_BASE_URL: B, FREE_PERIOD: "false", AGENTS_AUTO_LEARN: "false" }, stdio: "ignore" });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const req = async (p, opt = {}) => { const r = await fetch(B + p, { method: opt.method || "GET", headers: { "content-type": "application/json", ...(opt.headers || {}) }, body: opt.json ? JSON.stringify(opt.json) : undefined }); let d = null; try { d = await r.json(); } catch {} return { status: r.status, d }; };
let n = 10; const mcp = async (tk, name, args) => { const r = await req("/mcp?token=" + encodeURIComponent(tk), { method: "POST", json: { jsonrpc: "2.0", id: n++, method: "tools/call", params: { name, arguments: args || {} } } }); const res = r.d && r.d.result || {}; const t = (res.content || []).find((c) => c.type === "text"); let j = null; try { j = JSON.parse(t && t.text); } catch {} return { err: !!res.isError, j, text: t && t.text, res }; };
try {
  for (let i = 0; i < 80; i++) { try { await fetch(B + "/v1/config"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  // the project as the editor saves it (one clip from this device's upload, already on the server)
  const doc = { v: 1, ed: { clips: [{ id: "c1", src: { k: "upload", name: "beach.mp4" }, in: 0, out: 4, speed: 1, trans: "cut", vol: 100 }], texts: [], format: "youtube" }, look: {}, media: { c_c1: { url: "/media/beach.mp4", type: "video", name: "beach.mp4" } } };
  const sv = await req("/v1/projects/p1abc23", { method: "PUT", json: { name: "Holiday", doc } }); ok(sv.status === 200 && sv.d.clips === 1, "the editor saves a project");
  const tk = (await req("/v1/tokens", { method: "POST", json: { name: "Claude" } })).d?.token; ok(/^nooi_/.test(tk || ""), "a connection for the agent");
  const tl = (await req("/mcp?token=" + tk, { method: "POST", json: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).d?.result?.tools || [];
  const want = ["nooi_editor_projects", "nooi_timeline_read", "nooi_preview_frame", "nooi_clip_add", "nooi_clip_trim", "nooi_clip_move", "nooi_clip_remove", "nooi_text_add", "nooi_text_edit", "nooi_marker_add", "nooi_format_set"];
  ok(want.every((w) => tl.some((t) => t.name === w && t.inputSchema?.type === "object")), "the agent sees the editor tools (" + want.length + ")");
  const ps = await mcp(tk, "nooi_editor_projects"); ok(ps.j?.projects?.[0]?.project_id === "p1abc23" && ps.j.projects[0].name === "Holiday", "nooi_editor_projects lists the project");
  const rd = await mcp(tk, "nooi_timeline_read", { project_id: "p1abc23" }); ok(rd.j?.clips?.length === 1 && rd.j.size === "1920x1080" && rd.j.seconds === 4, "nooi_timeline_read: size, length and the clip");
  const fr = await mcp(tk, "nooi_preview_frame", { project_id: "p1abc23", time: 2 }); const img = (fr.res.content || []).find((c) => c.type === "image");
  ok(img && img.mimeType === "image/jpeg" && Buffer.from(img.data, "base64").slice(0, 2).toString("hex") === "ffd8" && Buffer.from(img.data, "base64").length > 2000, "nooi_preview_frame returns a real picture of that moment");
  const ad = await mcp(tk, "nooi_clip_add", { project_id: "p1abc23", asset_id: "j2", position: 1, trim_end: 2 });
  ok(!ad.err && ad.j?.timeline?.clips?.length === 2 && ad.j.timeline.clips[0].name === "Blue sky" && ad.j.timeline.clips[0].seconds === 2, "nooi_clip_add puts one of the user's videos first, trimmed to 2 s");
  const newId = ad.j.timeline.clips[0].clip_id;
  const tr = await mcp(tk, "nooi_clip_trim", { project_id: "p1abc23", clip: "2", trim_start: 1, speed: 2 }); ok(!tr.err && tr.j.timeline.clips[1].trim_start === 1 && tr.j.timeline.clips[1].speed === 2 && tr.j.timeline.clips[1].seconds === 1.5, "nooi_clip_trim: start 1 s, speed 2× (1.5 s long)");
  const mv = await mcp(tk, "nooi_clip_move", { project_id: "p1abc23", clip: newId, position: 2 }); ok(!mv.err && mv.j.timeline.clips[1].clip_id === newId, "nooi_clip_move puts it second");
  const tx = await mcp(tk, "nooi_text_add", { project_id: "p1abc23", text: "Summer 2026", start: 0.5, end: 2.5, position: "top" }); ok(!tx.err && tx.j.timeline.texts[0].text === "Summer 2026" && tx.j.timeline.texts[0].position === "top", "nooi_text_add");
  const te = await mcp(tk, "nooi_text_edit", { project_id: "p1abc23", text_id: tx.j.timeline.texts[0].text_id, text: "Summer!" }); ok(!te.err && te.j.timeline.texts[0].text === "Summer!", "nooi_text_edit");
  const mk = await mcp(tk, "nooi_marker_add", { project_id: "p1abc23", time: 1.2, name: "Drop" }); ok(!mk.err && mk.j.timeline.markers[0].name === "Drop", "nooi_marker_add");
  const fm = await mcp(tk, "nooi_format_set", { project_id: "p1abc23", format: "reels" }); ok(!fm.err && fm.j.timeline.size === "1080x1920", "nooi_format_set: 9:16");
  const bad1 = await mcp(tk, "nooi_clip_trim", { project_id: "p1abc23", clip: "9" }); ok(bad1.err && /no clip 9/.test(bad1.text), "a clip that isn't there is a clear error");
  const bad2 = await mcp(tk, "nooi_clip_add", { project_id: "p1abc23", asset_id: "nope" }); ok(bad2.err, "an asset that isn't the user's is refused");
  // the saved project has every change; the operations are there for an open editor
  const sp = await req("/v1/projects/p1abc23"); const ed = sp.d.doc.ed;
  ok(ed.clips.length === 2 && ed.format === "reels" && ed.texts[0].text === "Summer!" && ed.marks146[0].t === 1.2 && sp.d.doc.media["c_" + newId]?.url === "/media/blue.mp4", "the saved project has the agent's changes (and the new clip's file)");
  const ops = await req("/v1/projects/p1abc23/ops?after=0"); ok(ops.d.seq === 7 && ops.d.ops.length === 7 && ops.d.ops[0].op === "clip_add", "an open editor gets the 7 operations in order");
  const ops2 = await req("/v1/projects/p1abc23/ops?after=5"); ok(ops2.d.ops.length === 2 && ops2.d.ops[0].n === 6, "…and only the new ones after what it has");
  // a save from an editor that hasn't seen them: they are applied on the way in (nothing of the agent's lost)
  const stale = await req("/v1/projects/p1abc23", { method: "PUT", json: { name: "Holiday", opN: 0, doc: { ...doc, ed: { ...doc.ed, clips: [{ ...doc.ed.clips[0], vol: 40 }] } } } });
  const after = (await req("/v1/projects/p1abc23")).d.doc.ed;
  ok(stale.status === 200 && after.clips.length === 2 && after.clips.find((c) => c.id === "c1").vol === 40 && after.texts.length === 1 && after.format === "reels", "an editor's save that hadn't seen the agent's work keeps both (its volume change + the agent's clip, text, size)");
  const again = await req("/v1/projects/p1abc23", { method: "PUT", json: { name: "Holiday", opN: 0, doc: (await req("/v1/projects/p1abc23")).d.doc } });
  const twice = (await req("/v1/projects/p1abc23")).d.doc.ed; ok(again.status === 200 && twice.clips.length === 2 && twice.texts.length === 1 && twice.marks146.length === 1, "applying the operations twice changes nothing");
  const seen = await req("/v1/projects/p1abc23", { method: "PUT", json: { name: "Holiday", opN: 7, doc: { ...doc, ed: { ...doc.ed, clips: [doc.ed.clips[0]], texts: [], format: "youtube" } } } });
  const gone = (await req("/v1/projects/p1abc23")).d.doc.ed; ok(seen.status === 200 && gone.clips.length === 1 && gone.format === "youtube", "an editor that has seen them (and undid them) is not overruled");
  // a project with two timelines: the agent's change goes to the one open when it was saved, even after the editor switched
  const two = { v: 1, ed: { clips: [doc.ed.clips[0]], texts: [], format: "youtube", seq148: { cur: "tA", list: [{ id: "tA", name: "Main", data: null }, { id: "tB", name: "Short", data: { clips: [], texts: [], format: "reels" } }] } }, look: {}, media: doc.media };
  await req("/v1/projects/p2two22", { method: "PUT", json: { name: "Two", doc: two } });
  const r2 = await mcp(tk, "nooi_timeline_read", { project_id: "p2two22" }); ok(r2.j?.timeline === "Main" && r2.j?.other_timelines?.[0] === "Short", "the agent is told which timeline it edits and the others' names");
  const t2 = await mcp(tk, "nooi_text_add", { project_id: "p2two22", text: "Hello", start: 0, end: 1 }); const o2 = (await req("/v1/projects/p2two22/ops?after=0")).d.ops[0];
  ok(!t2.err && o2.tl === "tA", "the operation says which timeline it was made for");
  const sw = { ...two, ed: { clips: [], texts: [], format: "reels", seq148: { cur: "tB", list: [{ id: "tA", name: "Main", data: { clips: [doc.ed.clips[0]], texts: [], format: "youtube" } }, { id: "tB", name: "Short", data: null }] } } };
  await req("/v1/projects/p2two22", { method: "PUT", json: { name: "Two", opN: 0, doc: sw } }); const e2 = (await req("/v1/projects/p2two22")).d.doc.ed;
  ok(e2.texts.length === 0 && e2.seq148.list[0].data.texts[0]?.text === "Hello", "a save from an editor that switched to the other timeline puts the agent's text in the right one");
  // a read-only connection looks but doesn't change
  const tid = (await req("/v1/tokens")).d.tokens[0].id; await req("/v1/tokens/" + tid, { method: "PUT", json: { access: "read" } });
  const ro1 = await mcp(tk, "nooi_timeline_read", { project_id: "p1abc23" }), ro2 = await mcp(tk, "nooi_text_add", { project_id: "p1abc23", text: "x", start: 0, end: 1 });
  ok(!ro1.err && ro2.err && /read-only/.test(ro2.text), "a read-only connection can read the timeline but not change it");
  const other = await mcp(tk, "nooi_timeline_read", { project_id: "zzzzzz9" }); ok(other.err, "a project that isn't the user's is refused");
} catch (e) { ok(false, "crashed: " + e.message); }
finally { srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
