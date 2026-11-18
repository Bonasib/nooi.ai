// v153: AI agents over /mcp — a clip cut at its scene changes (a real 3-scene file: ffmpeg's scene score on the server, the cuts
// kept as one operation an open editor applies with the same ids, each part pointing at the same file), a clip with one scene, a
// picture and a clip whose file is only on a phone each get a plain answer; a style kit for the whole video (the cuts, the colour,
// the frame, the titles, the sounds — the user's own kept); the new review checks (a slideshow of pictures, too many words, a
// text under a phone app's buttons, a stock phrase) and their fixes; nothing doubled by a late save; read-only only looks.
// Run: node tests/v153_agents.mjs
import { spawn, spawnSync } from "child_process"; import fs from "fs"; import os from "os"; import path from "path"; import url from "url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."), PORT = 8437;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v153a-")); fs.mkdirSync(path.join(dir, "data")); fs.mkdirSync(path.join(dir, "media"));
const ff = (...a) => spawnSync("ffmpeg", ["-v", "error", "-y", ...a]);
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=3", "-f", "lavfi", "-i", "smptebars=size=640x360:rate=25:duration=3", "-f", "lavfi", "-t", "3", "-i", "mandelbrot=size=640x360:rate=25",
  "-filter_complex", "[0][1][2]concat=n=3:v=1:a=0", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, "media/scenes.mp4"));
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, "media/one.mp4"));
ff("-f", "lavfi", "-i", "color=c=0x3366cc:size=640x360", "-frames:v", "1", path.join(dir, "media/pic.png"));
fs.writeFileSync(path.join(dir, "data/db.json"), JSON.stringify({ users: { local: { plan: "studio", credits: 1000, ledger: [], jobs: {} } } }));
const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(LLM_|ANTHROPIC_|NVIDIA_|KIE_|GOOGLE_|LOCAL_LLM|GEMMA_)/.test(k)));
const srv = spawn("node", [path.join(ROOT, "server.js")], { cwd: dir, env: { ...clean, PORT: String(PORT), SECRET_KEY: "a".repeat(40), FIREBASE_PROJECT_ID: "", PUBLIC_BASE_URL: "http://localhost:" + PORT, FREE_PERIOD: "false", AGENTS_AUTO_LEARN: "false" }, stdio: "ignore" });
const B = "http://localhost:" + PORT;
const req = async (p, opt = {}) => { const r = await fetch(B + p, { method: opt.method || "GET", headers: { "content-type": "application/json" }, body: opt.json ? JSON.stringify(opt.json) : undefined }); let d = null; try { d = await r.json(); } catch {} return { status: r.status, d }; };
let n = 10; const mcp = async (tk, name, args) => { const r = await req("/mcp?token=" + encodeURIComponent(tk), { method: "POST", json: { jsonrpc: "2.0", id: n++, method: "tools/call", params: { name, arguments: args || {} } } }); const res = r.d && r.d.result || {}; const t = (res.content || []).find((c) => c.type === "text"); let j = null; try { j = JSON.parse(t && t.text); } catch {} return { err: !!res.isError, j, text: t && t.text }; };
const up = async () => { for (let i = 0; i < 80; i++) { try { await fetch(B + "/v1/config"); return; } catch { await new Promise((r) => setTimeout(r, 250)); } } };
const clip = (id, out, extra) => Object.assign({ id, src: { k: "upload", name: id }, in: 0, out, speed: 1, trans: "cut", vol: 100 }, extra || {});
const get = async (id) => (await req("/v1/projects/" + id)).d.doc;
try {
  await up();
  const doc = { v: 1, look: {}, media: { c_s: { url: "/media/scenes.mp4", type: "video", name: "scenes.mp4" }, c_o: { url: "/media/one.mp4", type: "video", name: "one.mp4" }, c_p: { url: "/media/pic.png", type: "image", name: "pic.png" } },
    ed: { format: "youtube", clips: [clip("s", 9), clip("o", 4), clip("p", 3), clip("phone", 4)], sfx: [{ id: "own", n: "boom", t: 11, vol: 100 }], infos: [], texts: [{ id: "t1", text: "Our shop", start: 0.5, end: 3, pos: "center", style: "bold", size: 7, anim: "pop" }, { id: "sh", kind: "rect", start: 0, end: 2 }] } };
  await req("/v1/projects/p153abc", { method: "PUT", json: { name: "Scenes", doc } });
  const tk = (await req("/v1/tokens", { method: "POST", json: { name: "Claude" } })).d?.token;
  const tl = (await req("/mcp?token=" + tk, { method: "POST", json: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).d?.result?.tools || [];
  const kt = tl.find((t) => t.name === "nooi_style_kit");
  ok(kt && kt.inputSchema.properties.kit.enum.join() === "clean,flat,minimal,cinema,retro,neon,social,doc" && tl.some((t) => t.name === "nooi_clip_split_scenes"), "the agent sees the style kits (8) and the scene split");
  const g = await mcp(tk, "nooi_editor_guide", {}); ok(!g.err && g.j.looks.style_kits.length === 8 && /nooi_style_kit/.test(g.j.how_to_edit.join(" ")) && g.j.looks.transitions.includes("shutter"), "the guide lists the kits, the scene split and the new cuts");
  // ---- scenes
  const sp = await mcp(tk, "nooi_clip_split_scenes", { project_id: "p153abc", clip: "1" }), e1 = (await get("p153abc")), cl = e1.ed.clips;
  const st = sp.j?.timeline?.clips?.map((c) => c.start) || [];
  ok(!sp.err && cl.length === 6 && Math.abs(cl[0].out - 3) < 0.15 && Math.abs(cl[1].in - cl[0].out) < 0.001 && Math.abs(cl[2].in - 6) < 0.15 && cl[2].out === 9 && Math.abs(st[1] - 3) < 0.15 && Math.abs(st[2] - 6) < 0.15, "nooi_clip_split_scenes: the 9 s clip of three shots becomes three clips at " + cl.slice(0, 3).map((c) => c.in + "–" + c.out).join(", "));
  ok(e1.media["c_" + cl[1].id]?.url === "/media/scenes.mp4" && e1.media["c_" + cl[2].id]?.url === "/media/scenes.mp4" && cl[3].id === "o", "…each part points at the same file; the next clip is untouched");
  const ops = (await req("/v1/projects/p153abc/ops?after=0")).d; ok(ops.ops.at(-1).op === "clip_split" && ops.ops.at(-1).args.cuts.map((k) => k.id).sort().join() === [cl[1].id, cl[2].id].sort().join(), "an open editor gets one operation with the same new ids");
  const one = await mcp(tk, "nooi_clip_split_scenes", { project_id: "p153abc", clip: "o" }); ok(!one.err && /no scene changes/.test(one.j?.did), "a clip of one shot: no cut, said plainly");
  const pic = await mcp(tk, "nooi_clip_split_scenes", { project_id: "p153abc", clip: "p" }), ph = await mcp(tk, "nooi_clip_split_scenes", { project_id: "p153abc", clip: "phone" });
  ok(pic.err && /picture/.test(pic.text) && ph.err && /only on the device/.test(ph.text), "a picture and a clip whose file is only on a phone: plain answers");
  // ---- a style kit
  const k1 = await mcp(tk, "nooi_style_kit", { project_id: "p153abc", kit: "neon" }), e2 = (await get("p153abc")).ed;
  ok(!k1.err && e2.clips.slice(0, -1).every((c) => c.trans === "iris") && e2.clips.at(-1).trans === "cut" && e2.clips.every((c) => c.f152 === "duo_night" && c.f152a === 70) && e2.fr152.id === "neon" && e2.fr152.col === "#ff4fa3" && e2.kit153 === "neon", "nooi_style_kit neon: iris cuts, a night duotone, a pink neon frame");
  ok(e2.texts.find((t) => t.id === "t1").anim === "t152_slice" && !e2.texts.find((t) => t.id === "sh").anim && e2.sfx.some((s) => s.id === "own") && e2.sfx.filter((s) => s.sp152 === "crisp").length >= 4 && e2.sfx.some((s) => s.n === "riser"), "…glitch titles (a shape left alone), crisp sounds with a riser before the big cut, the user's own boom kept");
  const k2 = await mcp(tk, "nooi_style_kit", { project_id: "p153abc", kit: "clean" }), e3 = (await get("p153abc")).ed;
  ok(!k2.err && e3.clips[0].trans === "fade" && !e3.clips[0].f152 && e3.fr152.id === "none" && !e3.sfx.some((s) => s.sp152 === "crisp") && e3.sfx.some((s) => s.sp152 === "calm"), "another kit replaces it: fades, no filter, no frame, the crisp sounds swapped for calm ones");
  const k3 = await mcp(tk, "nooi_style_kit", { project_id: "p153abc", kit: "vaporwave" }); ok(k3.err && /Unknown kit/.test(k3.text), "an unknown kit: a clear error");
  // ---- a late save from an editor: nothing doubled
  const before = await get("p153abc"); await req("/v1/projects/p153abc", { method: "PUT", json: { name: "Scenes", opN: 0, doc: before } }); const e4 = (await get("p153abc")).ed;
  ok(e4.clips.length === before.ed.clips.length && e4.sfx.length === before.ed.sfx.length && e4.kit153 === "clean", "a save that hadn't seen the operations: applied once, nothing doubled");
  // ---- the new review checks on a vertical slideshow of pictures
  const media = {}; const pics = ["a", "b", "c", "d", "e"].map((id) => { media["c_" + id] = { url: "/media/pic.png", type: "image", name: "pic.png" }; return clip(id, 3); });
  await req("/v1/projects/p153sld", { method: "PUT", json: { name: "Menu", doc: { v: 1, look: {}, media, ed: { format: "reels", clips: pics, sfx: [], infos: [], texts: [
    { id: "w1", text: "Unlock the next level of coffee with our new grinder that makes every single morning feel easy", start: 0, end: 9, pos: "center", style: "bold", size: 7, anim: "pop" },
    { id: "w2", text: "Shop now", start: 12, end: 15, x: 0.5, y: 0.92, pos: "center", style: "bold", size: 7, anim: "pop" }] } } } });
  const rv = await mcp(tk, "nooi_review", { project_id: "p153sld" }), ids = (rv.j?.issues || []).map((i) => i.issue_id);
  ok(!rv.err && ["slideshow", "wordy:w1", "safe:w2", "cliche:w1"].every((x) => ids.includes(x)) && rv.j.issues.find((i) => i.issue_id === "slideshow").severity === "P1", "nooi_review: a slideshow, too many words at once, a text under the phone app's buttons, a stock phrase — " + ids.join(", "));
  const fx = await mcp(tk, "nooi_review_fix", { project_id: "p153sld" }), e5 = (await get("p153sld")).ed, w1 = e5.texts.find((t) => t.id === "w1"), w2 = e5.texts.find((t) => t.id === "w2"), half = e5.texts.find((t) => t.id !== "w1" && t.id !== "w2" && t.start === w1.end);
  ok(!fx.err && e5.clips.every((c) => c.mo && c.mo.kf.length === 2) && new Set(e5.clips.map((c) => JSON.stringify(c.mo.kf.map((k) => [k.s, k.x])))).size >= 3, "nooi_review_fix: a camera move on every still picture, not all the same");
  ok(half && w1.text.split(" ").length + half.text.split(" ").length === 17 && w2.y <= 0.72 && !fx.j.still_open.some((i) => /^(slideshow|wordy|safe)/.test(i.issue_id)) && fx.j.still_open.some((i) => i.issue_id === "cliche:w1"), "…the long line split in two, the button text moved up; the stock phrase left for the user to rewrite");
  // ---- read-only
  const tid = (await req("/v1/tokens")).d.tokens[0].id; await req("/v1/tokens/" + tid, { method: "PUT", json: { access: "read" } });
  const r1 = await mcp(tk, "nooi_style_kit", { project_id: "p153abc", kit: "doc" }), r2 = await mcp(tk, "nooi_clip_split_scenes", { project_id: "p153abc", clip: "o" });
  ok(r1.err && /read-only/.test(r1.text) && r2.err, "a read-only connection can't set a kit or split a clip");
} catch (e) { ok(false, "crashed: " + e.message); }
finally { srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
