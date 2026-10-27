// v152: the editor's agents for AI agents over /mcp — the guide; a review of a saved project like an expert editor (the problems
// in order, each at its moment, by role), its one-step fixes made on the server and kept as one operation for an open editor; a
// sound pass on the film's own moments (replaced when run again, the user's own sounds kept); the look (one transition, a
// creative filter, a frame) checked against the editor's own names; nothing doubled by an editor's late save; read-only only looks.
// Run: node tests/v152_agents.mjs
import { spawn, spawnSync } from "child_process"; import fs from "fs"; import os from "os"; import path from "path"; import url from "url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."), PORT = 8436;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v152a-")); fs.mkdirSync(path.join(dir, "data")); fs.mkdirSync(path.join(dir, "media"));
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=8", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, "media/beach.mp4")]);
fs.writeFileSync(path.join(dir, "data/db.json"), JSON.stringify({ users: { local: { plan: "studio", credits: 1000, ledger: [], jobs: {} } } }));
const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(LLM_|ANTHROPIC_|NVIDIA_|KIE_|GOOGLE_|LOCAL_LLM|GEMMA_)/.test(k)));
const srv = spawn("node", [path.join(ROOT, "server.js")], { cwd: dir, env: { ...clean, PORT: String(PORT), SECRET_KEY: "a".repeat(40), FIREBASE_PROJECT_ID: "", PUBLIC_BASE_URL: "http://localhost:" + PORT, FREE_PERIOD: "false", AGENTS_AUTO_LEARN: "false" }, stdio: "ignore" });
const B = "http://localhost:" + PORT;
const req = async (p, opt = {}) => { const r = await fetch(B + p, { method: opt.method || "GET", headers: { "content-type": "application/json" }, body: opt.json ? JSON.stringify(opt.json) : undefined }); let d = null; try { d = await r.json(); } catch {} return { status: r.status, d }; };
let n = 10; const mcp = async (tk, name, args) => { const r = await req("/mcp?token=" + encodeURIComponent(tk), { method: "POST", json: { jsonrpc: "2.0", id: n++, method: "tools/call", params: { name, arguments: args || {} } } }); const res = r.d && r.d.result || {}; const t = (res.content || []).find((c) => c.type === "text"); let j = null; try { j = JSON.parse(t && t.text); } catch {} return { err: !!res.isError, j, text: t && t.text }; };
const up = async () => { for (let i = 0; i < 80; i++) { try { await fetch(B + "/v1/config"); return; } catch { await new Promise((r) => setTimeout(r, 250)); } } };
const clip = (id, out, trans) => ({ id, src: { k: "upload", name: id + ".mp4" }, in: 0, out, speed: 1, trans: trans || "cut", vol: 100 });
const get = async (id) => (await req("/v1/projects/" + id)).d.doc;
try {
  await up();
  // a vertical film: a 7 s still clip, a clip that flashes by (0.3 s), a 4 s clip; a caption too fast to read and another on top of it
  const doc = { v: 1, look: {}, media: { c_c1: { url: "/media/beach.mp4", type: "video", name: "beach.mp4" }, c_c2: { url: "/media/beach.mp4", type: "video", name: "beach.mp4" }, c_c3: { url: "/media/beach.mp4", type: "video", name: "beach.mp4" } },
    ed: { format: "reels", clips: [clip("c1", 7, "wipe"), clip("c2", 0.3, "spin"), clip("c3", 4)], sfx: [], infos: [],
      texts: [{ id: "t1", text: "Welcome to our little shop by the sea", start: 3, end: 3.6, pos: "bottom", style: "bold", size: 7, anim: "pop" }, { id: "t2", text: "Open daily", start: 3.2, end: 5, pos: "bottom", style: "bold", size: 7, anim: "pop" }] } };
  await req("/v1/projects/p152abc", { method: "PUT", json: { name: "Holiday", doc } });
  const tk = (await req("/v1/tokens", { method: "POST", json: { name: "Claude" } })).d?.token;
  const tl = (await req("/mcp?token=" + tk, { method: "POST", json: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).d?.result?.tools || [];
  ok(["nooi_editor_guide", "nooi_review", "nooi_review_fix", "nooi_sound_pass", "nooi_style_set"].every((w) => tl.some((t) => t.name === w && t.inputSchema?.type === "object")), "the agent sees the five new tools");
  const st = tl.find((t) => t.name === "nooi_style_set"); ok(st && st.inputSchema.properties.transition.enum.includes("iris") && st.inputSchema.properties.frame.enum.includes("polaroid") && st.inputSchema.properties.filter.enum.includes("duo_night"), "…the look tool lists the editor's own transitions, frames and filters");
  // ---- the guide
  const g = await mcp(tk, "nooi_editor_guide", {});
  ok(!g.err && g.j.how_to_edit.length >= 5 && /story/.test(g.j.how_to_edit[1]) && /nooi_review/.test(g.j.how_to_edit.join(" ")) && g.j.looks.sound_pass_presets.join() === "calm,crisp,minimal" && /price/.test(g.j.rules[0]), "nooi_editor_guide: the director's order, review before finishing, the looks, the price rule");
  // ---- the review
  const rv = await mcp(tk, "nooi_review", { project_id: "p152abc" }), ids = (rv.j?.issues || []).map((i) => i.issue_id);
  ok(!rv.err && rv.j.role === "director" && ["hook", "end", "text_fast:t1", "text_overlap:t2", "long_hold:c1", "flash:c2", "no_music", "no_sfx"].every((x) => ids.includes(x)), "nooi_review: the hook, the end, the caption too fast, two on one spot, the still hold, the flash, no music, silent cuts — " + ids.join(", "));
  const lensOrder = rv.j.issues.map((i) => ["story", "design", "editing", "audio"].indexOf(i.expert)); ok(lensOrder.every((v, i) => !i || v >= lensOrder[i - 1]), "…the director's order: story, design, editing, sound");
  const hook = rv.j.issues.find((i) => i.issue_id === "hook"), music = rv.j.issues.find((i) => i.issue_id === "no_music");
  ok(hook.severity === "P1" && hook.time === 0 && hook.fix && music.fix_in_editor && !music.fix && rv.j.score < 70 && rv.j.ready_to_share === false, "…each at its moment, how much it matters, a one-step fix or what the editor must do; score " + rv.j.score + ", not ready");
  const dz = await mcp(tk, "nooi_review", { project_id: "p152abc", role: "design" }); ok(!dz.err && dz.j.issues.length === 2 && dz.j.issues.every((i) => i.expert === "design"), "role design: only the designer's findings");
  ok((await req("/v1/projects/p152abc/ops?after=0")).d.seq === 0, "…and a review changes nothing");
  // ---- the fixes
  const fx = await mcp(tk, "nooi_review_fix", { project_id: "p152abc" });
  ok(!fx.err && fx.j.ok && fx.j.score_after > fx.j.score_before && fx.j.needs_the_editor?.some((x) => x.issue_id === "no_music"), "nooi_review_fix: " + fx.j?.did + " — score " + fx.j?.score_before + " → " + fx.j?.score_after + ", music left for the editor");
  const e1 = (await get("p152abc")).ed, t1 = e1.texts.find((t) => t.id === "t1"), t2 = e1.texts.find((t) => t.id === "t2"), hk = e1.texts.find((t) => t.start === 0);
  ok(hk && hk.text === "Holiday" && t1.end - t1.start >= 2.9 && t2.pos === "top" && e1.clips[0].mo?.kf?.length === 2 && e1.clips[0].mo.kf[1].s > 1, "…the project's name as the opening title, time to read the caption, the other moved up, a slow zoom on the still clip");
  const sp = (e1.sfx || []).filter((x) => x.sp152 === "crisp"); ok(sp.length >= 3 && sp.every((x) => x.id && typeof x.t === "number"), "…the silent cuts sounded (" + sp.map((x) => x.n + "@" + x.t).join(", ") + ")");
  const ops = (await req("/v1/projects/p152abc/ops?after=0")).d; ok(ops.seq === 1 && ops.ops[0].op === "review_fix" && ops.ops[0].args.fixes.find((f) => f.op === "text_add").args.id === hk.id, "an open editor gets it as one operation, with the same ids");
  const rv2 = await mcp(tk, "nooi_review", { project_id: "p152abc" }), ids2 = rv2.j.issues.map((i) => i.issue_id);
  ok(!ids2.includes("hook") && !ids2.includes("no_sfx") && !ids2.includes("text_fast:t1") && ids2.includes("flash:c2"), "the review again: those are gone; the flash (no one-step fix) stays — " + ids2.join(", "));
  const bad = await mcp(tk, "nooi_review_fix", { project_id: "p152abc", issue_ids: ["hook"] }); ok(bad.err && /aren't in the review/.test(bad.text), "fixing a finding that isn't there any more: a clear message");
  // ---- the sound pass: replaced, the user's own sound kept
  const doc2 = await get("p152abc"); doc2.ed.sfx.push({ id: "own1", n: "boom", t: 9, vol: 100 }); await req("/v1/projects/p152abc", { method: "PUT", json: { name: "Holiday", opN: 1, doc: doc2 } });
  const pc = await mcp(tk, "nooi_sound_pass", { project_id: "p152abc", preset: "calm" }), e2 = (await get("p152abc")).ed;
  ok(!pc.err && /calm/.test(pc.j.did) && e2.sfx.some((x) => x.id === "own1") && !e2.sfx.some((x) => x.sp152 === "crisp") && e2.sfx.filter((x) => x.sp152 === "calm").length >= 3 && e2.sfx.some((x) => /^pluck:\d$/.test(x.n)) && e2.sfx.some((x) => x.n === "swell"), "nooi_sound_pass calm: plucks on the words, swells at the cuts — the crisp pass replaced, the user's own boom kept");
  const pm = await mcp(tk, "nooi_sound_pass", { project_id: "p152abc", preset: "loud" }); ok(pm.err && /Unknown preset/.test(pm.text), "an unknown preset: a clear error");
  // ---- the look
  const sl = await mcp(tk, "nooi_style_set", { project_id: "p152abc", transition: "iris", transition_seconds: 0.8, filter: "duo_night", filter_amount: 60, frame: "neon", frame_color: "#ff4fa3" }), e3 = (await get("p152abc")).ed;
  ok(!sl.err && e3.clips[0].trans === "iris" && e3.clips[1].trans === "iris" && e3.clips[0].trd === 0.8 && e3.clips.every((c) => c.f152 === "duo_night" && c.f152a === 60) && e3.fr152.id === "neon" && e3.fr152.col === "#ff4fa3" && sl.j.timeline.frame === "neon" && sl.j.timeline.clips[0].filter === "duo_night", "nooi_style_set: iris between the clips (0.8 s), a night duotone at 60 %, a pink neon frame — the timeline the agent reads shows them");
  const s2 = await mcp(tk, "nooi_style_set", { project_id: "p152abc", filter: "none", clips: ["2"] }), e4 = (await get("p152abc")).ed;
  ok(!s2.err && !e4.clips[1].f152 && e4.clips[0].f152 === "duo_night" && e4.fr152.id === "neon", "…the filter off one clip (by its number), the rest as they were");
  const b1 = await mcp(tk, "nooi_style_set", { project_id: "p152abc", transition: "teleport" }), b2 = await mcp(tk, "nooi_style_set", { project_id: "p152abc", frame_color: "red" }), b3 = await mcp(tk, "nooi_style_set", { project_id: "p152abc" });
  ok(b1.err && b2.err && b3.err && /Say what to change/.test(b3.text), "a transition it doesn't have, a colour that isn't #rrggbb, nothing asked: clear errors");
  // ---- an editor's late save: nothing doubled
  const seqNow = (await req("/v1/projects/p152abc/ops?after=0")).d.seq, before = await get("p152abc");
  await req("/v1/projects/p152abc", { method: "PUT", json: { name: "Holiday", opN: 0, doc: before } });
  const e5 = (await get("p152abc")).ed; ok(seqNow === 4 && e5.texts.length === before.ed.texts.length && e5.sfx.length === before.ed.sfx.length && e5.clips.length === 3, "a save from an editor that hadn't seen the operations: applied once, nothing doubled");
  // ---- Arabic, and read-only
  const da = JSON.parse(JSON.stringify(doc)); da.ed.texts = [{ id: "a1", text: "أهلاً بكم", start: 4, end: 6, pos: "bottom", style: "bold", size: 7, anim: "pop" }];
  await req("/v1/projects/p152ar1", { method: "PUT", json: { name: "رحلة", doc: da } });
  const fa = await mcp(tk, "nooi_review_fix", { project_id: "p152ar1", issue_ids: ["hook", "end"] }), ea = (await get("p152ar1")).ed;
  ok(!fa.err && ea.texts.some((t) => t.start === 0 && t.text === "رحلة") && ea.texts.some((t) => t.text === "تابعنا للمزيد"), "an Arabic project: its name as the title, the last line in Arabic");
  const tid = (await req("/v1/tokens")).d.tokens[0].id; await req("/v1/tokens/" + tid, { method: "PUT", json: { access: "read" } });
  const r1 = await mcp(tk, "nooi_review", { project_id: "p152abc" }), r2 = await mcp(tk, "nooi_style_set", { project_id: "p152abc", frame: "tv" }), r3 = await mcp(tk, "nooi_sound_pass", { project_id: "p152abc", preset: "crisp" });
  ok(!r1.err && r2.err && /read-only/.test(r2.text) && r3.err, "a read-only connection reviews, but can't change the look or the sounds");
} catch (e) { ok(false, "crashed: " + e.message); }
finally { srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
