// v153: two more tools for AI agents (Claude, ChatGPT, any MCP client), the same as in the editor:
//   nooi_style_kit         — one look for the whole video (the cut, the colour, a frame, how titles move, the sounds);
//   nooi_clip_split_scenes — a clip cut at its scene changes (ffmpeg's scene score on the file kept on the server).
// Ideas from OpenMontage (AGPL — its public description only: style playbooks, scene detection) and cinetic (MIT); our own code.
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { uid } from "./store.js";
import { MEDIA_DIR } from "./media.js";
import { OPS148, EXT148, TOOLS148, WRITE148 } from "./edit148.js";
import { KITS153, applyKit153 } from "../public/editor152/studio.js";

const bad = (en, ar, code = 400) => Object.assign(new Error(en), { code, errorAr: ar });
const fileOf = (u) => { const m = /\/media\/([A-Za-z0-9._-]+)(?:[?#].*)?$/.exec(String(u || "")); const f = m && path.join(MEDIA_DIR, m[1]); return f && fs.existsSync(f) ? f : null; };

// the operations, the same as op148 in the page
OPS148.kit_set = (ed, a) => { applyKit153(ed, a.kit, { sfx: a.sfx }); };
OPS148.clip_split = (ed, a, doc) => {
  const c = (ed.clips || []).find((x) => x.id === a.id); if (!c) return;
  for (const k of (a.cuts || []).slice().sort((x, y) => y.t - x.t)) {
    if (k.t <= c.in + 0.1 || k.t >= c.out - 0.1 || ed.clips.some((x) => x.id === k.id)) continue;
    const b = JSON.parse(JSON.stringify(c)), ts = (k.t - c.in) / (+c.speed || 1); b.id = k.id; b.in = k.t; c.out = k.t; b.trans = c.trans; c.trans = "cut";
    if (c.mo && Array.isArray(c.mo.kf) && c.mo.kf.length) { const kf = c.mo.kf; c.mo.kf = kf.filter((x) => x.t <= ts); if (!c.mo.kf.length) c.mo.kf = [Object.assign({}, kf[0], { t: 0 })];
      b.mo.kf = kf.filter((x) => x.t >= ts).map((x) => Object.assign({}, x, { t: +(x.t - ts).toFixed(2) })); if (!b.mo.kf.length) b.mo.kf = [Object.assign({}, kf[kf.length - 1], { t: 0 })]; }
    ed.clips.splice(ed.clips.indexOf(c) + 1, 0, b);
    if (doc && doc.media && doc.media["c_" + c.id]) doc.media["c_" + b.id] = doc.media["c_" + c.id];
  }
};

// the scene changes in a file between a0 and a1 (seconds of the file), at least 0.6 s apart and away from the ends
export function scenes153(file, a0, a1, thr) {
  return new Promise((ok, no) => {
    const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-an", "-vf", "select='gt(scene," + thr + ")',showinfo", "-f", "null", "-"]); let err = "";
    p.stderr.on("data", (d) => { err += d; if (err.length > 4e6) err = err.slice(-2e6); }); p.on("error", no);
    p.on("close", (code) => { if (code !== 0) return no(new Error("ffmpeg could not read the clip"));
      const ts = [...err.matchAll(/pts_time:\s*([\d.]+)/g)].map((m) => +m[1]).filter((t) => t > a0 + 0.3 && t < a1 - 0.3).sort((a, b) => a - b);
      ok(ts.filter((t, i, l) => !i || t - l[i - 1] > 0.6).map((t) => +t.toFixed(3))); });
  });
}

const P = { project_id: { type: "string", description: "From nooi_editor_projects" } };
TOOLS148.push(
  { name: "nooi_style_kit", description: "Give the whole video one look in one step: the cut between clips, the colour, a frame, how the titles move and a sound pass. Kits: " + KITS153.map((k) => k.id + " (" + k.en + ")").join(", ") + ". Free; the user's own clips, words and sounds stay.",
    inputSchema: { type: "object", properties: { ...P, kit: { type: "string", enum: KITS153.map((k) => k.id) } }, required: ["project_id", "kit"] } },
  { name: "nooi_clip_split_scenes", description: "Cut a clip into its scenes: where the picture changes to another shot, the clip is split so each scene is its own clip (to reorder, trim or give each its own look). Free.",
    inputSchema: { type: "object", properties: { ...P, clip: { type: "string", description: "The clip's clip_id, or its number on the timeline (1 = the first)" }, sensitivity: { type: "string", enum: ["fewer", "normal", "more"], description: "more finds softer changes" } }, required: ["project_id", "clip"] } });
WRITE148.add("nooi_style_kit"); WRITE148.add("nooi_clip_split_scenes");

EXT148.push(async (uidv, name, a, x) => {
  const ed = x.ed || {};
  if (name === "nooi_style_kit") {
    if (!KITS153.some((k) => k.id === a.kit)) throw bad("Unknown kit " + a.kit + " — one of " + KITS153.map((k) => k.id).join(", ") + ".", "نمط غير معروف.");
    if (!(ed.clips || []).length) throw bad("This project has no clips yet.", "لا مقاطع في هذا المشروع بعد.");
    const work = JSON.parse(JSON.stringify(ed)); applyKit153(work, a.kit, { mkId: () => uid() });
    const K = KITS153.find((k) => k.id === a.kit), sfx = work.sfx.filter((s) => s.sp152);
    return x.done(x.commit({ op: "kit_set", args: { kit: a.kit, sfx } }), "style kit " + K.en + ": " + K.trans + " cuts, " + (K.filter || K.look) + " colour, " + K.frame + " frame, " + K.tm + " titles, " + sfx.length + " sounds");
  }
  if (name === "nooi_clip_split_scenes") {
    const cl = ed.clips || [], c = cl.find((y) => y.id === String(a.clip)) || (/^\d+$/.test(String(a.clip)) ? cl[+a.clip - 1] : null);
    if (!c) throw bad("There's no clip " + a.clip + " — the timeline has " + cl.length + ".", "لا يوجد مقطع " + a.clip + ".");
    const m = (x.p.doc.media || {})["c_" + c.id] || {}, f = fileOf(m.url || (c.src && c.src.url139));
    if (!f || m.type === "image") throw bad(m.type === "image" ? "That clip is a picture — it has one scene." : "This clip's file is only on the device that added it — open the editor and use Split at scene changes there.", m.type === "image" ? "هذا المقطع صورة — مشهد واحد." : "ملف هذا المقطع موجود فقط على الجهاز الذي أضافه — افتح المحرر واستخدم التقسيم عند تغيّر المشهد هناك.");
    const ts = await scenes153(f, +c.in || 0, +c.out || 0, { fewer: 0.45, normal: 0.3, more: 0.18 }[a.sensitivity] || 0.3);
    if (!ts.length) return { content: [{ type: "text", text: JSON.stringify({ ok: true, did: "no scene changes found — it's one shot" }) }] };
    return x.done(x.commit({ op: "clip_split", args: { id: c.id, cuts: ts.map((t) => ({ t, id: uid() })) } }), "split at " + ts.length + " scene change(s): " + ts.map((t) => t.toFixed(2) + " s").join(", ") + " (in the clip's file)");
  }
  return null;
});
