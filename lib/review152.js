// v152: the editor's agents for AI agents (Claude, ChatGPT, any MCP client) — the same review, fixes, sound pass and looks the
// editor page has (public/editor152/studio.js, shared), as tools on a saved project:
//   nooi_editor_guide  — how a good edit goes: the director's order (story → design → editing → sound), then a review;
//   nooi_review        — a critic's read of the timeline, by an expert role, with what matters most first (read-only);
//   nooi_review_fix    — make the one-step fixes of chosen findings (or all of them);
//   nooi_sound_pass    — sounds on the film's own moments by a preset (calm · crisp · minimal);
//   nooi_style_set     — one transition, a creative filter, a frame for the whole video.
// All free: nothing here calls an engine. Ideas from cinetic (MIT) and Cutia (MIT); our own code.
import { uid } from "./store.js";
import { OPS148, EXT148, TOOLS148, WRITE148, FORMATS148 } from "./edit148.js";
import { ROLES152, review152, forRole152, applyFix152, soundPass152, applyStyle152, isArText152, FRAMES152, FILTERS152, TRANS152, PRESETS152, KITS153 } from "../public/editor152/studio.js";

const bad = (en, ar, code = 400) => Object.assign(new Error(en), { code, errorAr: ar });
const txt = (o) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });

// the operations, the same as op148 in the page (the page applies them live when the project is open)
OPS148.review_fix = (ed, a) => { for (const f of a.fixes || []) applyFix152(ed, f); };
OPS148.sound_pass = (ed, a) => { applyFix152(ed, { op: "sound_pass", args: a }); };
OPS148.style_set = (ed, a) => { applyStyle152(ed, a); };

// what the review needs to know besides the timeline: the size, what plays under it, the language of its words
function opts152(p, lang) {
  const ed = p.doc.ed || {}, f = FORMATS148[ed.format] || [1080, 1920], media = p.doc.media || {};
  const words = (ed.texts || []).map((t) => t.text).join(" ") + " " + (p.name || "");
  const pics = (ed.clips || []).filter((c) => (media["c_" + c.id] || {}).type === "image").length;   // (v153: the slideshow check)
  return { pics, w: f[0], h: f[1], music: !!media.edMusic, voice: !!media.edVoice || (ed.sfx || []).some((x) => x.voice), lang: lang === "ar" || lang === "en" ? lang : isArText152(words) ? "ar" : "en", name: p.name || "" };
}
const clipRef = (ed, ref) => { const cl = ed.clips || [], c = cl.find((x) => x.id === String(ref)) || (/^\d+$/.test(String(ref)) ? cl[+ref - 1] : null);
  if (!c) throw bad("There's no clip " + ref + " — the timeline has " + cl.length + ".", "لا يوجد مقطع " + ref + "."); return c.id; };
const view = (x) => ({ issue_id: x.id, expert: x.lens, severity: x.sev, time: x.t, problem: x.en, ...(x.fix ? x.fix.op === "open" ? { fix_in_editor: x.fix.en } : { fix: x.fix.en } : {}) });

export function guide152() {
  return {
    how_to_edit: [
      "1. Read the project: nooi_timeline_read (and nooi_preview_frame to see a moment).",
      "2. Work as the director: story first (a hook on screen in the first 2 seconds, a last line or call to action at the end, a length that suits the platform), then design (words on screen long enough to read, nothing on top of each other, one or two fonts), then editing (no long still holds, no clips that flash by, one or two kinds of transition), then sound (music under the voice, a sound on the cuts, captions when someone speaks).",
      "3. Make the changes with the editing tools (nooi_clip_*, nooi_text_*, nooi_clip_split_scenes, nooi_style_kit for one whole look, nooi_style_set, nooi_sound_pass, nooi_motion_ad).",
      "4. Review before you say it is done: nooi_review (role director). Fix what it marks P0 and P1 — nooi_review_fix makes the one-step fixes; the others need the editor (music, captions) and you tell the user.",
      "5. Say what you changed in plain words. The user sees every change at once in the open editor and can undo it.",
    ],
    experts: { director: "runs every expert in order: story, design, editing, sound", story: "the hook, the last line, the length", design: "readable words, nothing overlapping, sizes and fonts", editing: "still holds, flashes, too many kinds of cut", audio: "music, the voice over it, sounds at the cuts, captions" },
    severity: { P0: "breaks the video — must be fixed", P1: "everyone notices — fix before sharing", P2: "polish" },
    looks: { style_kits: KITS153.map((k) => ({ kit: k.id, name: k.en })), transitions: TRANS152, filters: FILTERS152, frames: FRAMES152, sound_pass_presets: Object.keys(PRESETS152) },
    rules: ["Everything here is free. Tools that make video or images with the AI engine cost credits — say the price before you use one.", "Don't remove the user's own clips, texts or sounds unless they asked.", "Keep the user's language for any words you add."],
  };
}

const P = { project_id: { type: "string", description: "From nooi_editor_projects" } }, ROLE = { role: { type: "string", enum: ROLES152, description: "The expert whose eyes to use; director (default) runs them all in order" } };
TOOLS148.push(
  { name: "nooi_editor_guide", description: "How to edit a video well in nooi, step by step: the director's order (story → design → editing → sound), the review before finishing, the transitions, filters, frames and sound presets there are. Read it before editing a project.", inputSchema: { type: "object", properties: {} } },
  { name: "nooi_review", description: "Review a project's timeline like an expert editor: the problems in order of how much they matter (P0 breaks the video, P1 everyone notices, P2 polish), each at its moment, with a one-step fix when there is one, a score out of 100 and whether it's ready to share. Free; changes nothing.",
    inputSchema: { type: "object", properties: { ...P, ...ROLE, language: { type: "string", enum: ["en", "ar"], description: "The language of words a fix would add (default: the project's)" } }, required: ["project_id"] } },
  { name: "nooi_review_fix", description: "Make the one-step fixes of a review: give issue_ids from nooi_review, or leave them out to fix everything that has a one-step fix for that role. Fixes that need the editor (music, captions) are listed, not made. Free.",
    inputSchema: { type: "object", properties: { ...P, ...ROLE, issue_ids: { type: "array", items: { type: "string" } }, language: { type: "string", enum: ["en", "ar"] } }, required: ["project_id"] } },
  { name: "nooi_sound_pass", description: "Put sounds on the film's own moments — the cuts, each text appearing, each graphic landing, the last card — by a preset: calm (plucks, air swells, a bell), crisp (ticks, whooshes, pops, an impact) or minimal (a deep drop on the big moment and at the end). Replaces an earlier pass; the user's own sounds stay. Free.",
    inputSchema: { type: "object", properties: { ...P, preset: { type: "string", enum: Object.keys(PRESETS152) } }, required: ["project_id", "preset"] } },
  { name: "nooi_style_set", description: "Set the look: one transition between clips (and its length), a creative filter on clips (duotones, colour pop, halftone, posterize, sketch, thermal, night vision — 'none' removes it) and a frame around the whole video (polaroid, card, phone, old TV, film strip, neon, viewfinder, vintage, comic, border, double line — 'none' removes it). Leave out what shouldn't change. Free.",
    inputSchema: { type: "object", properties: { ...P, transition: { type: "string", enum: TRANS152 }, transition_seconds: { type: "number", description: "0.1–2, default 0.6" }, filter: { type: "string", enum: FILTERS152 }, filter_amount: { type: "number", description: "0–100, default 100" },
      frame: { type: "string", enum: FRAMES152 }, frame_color: { type: "string", description: "#rrggbb — for neon, border, double line and polaroid" }, clips: { type: "array", items: { type: "string" }, description: "Only these clips (clip_id or number); default every clip" } }, required: ["project_id"] } });
for (const n of ["nooi_review_fix", "nooi_sound_pass", "nooi_style_set"]) WRITE148.add(n);

EXT148.push(async (uidv, name, a, x) => {
  const ed = x.ed || {};
  if (name === "nooi_review") {
    const role = ROLES152.includes(a.role) ? a.role : "director", rv = review152(ed, opts152(x.p, a.language)), list = forRole152(rv, role);
    return txt({ project_id: x.id, role, score: rv.score, ready_to_share: rv.ship, issues: list.map(view), ...(list.some((i) => i.fix && i.fix.op !== "open") ? { next: "nooi_review_fix makes the one-step fixes (all of them, or the issue_ids you choose)." } : {}) });
  }
  if (name === "nooi_review_fix") {
    const role = ROLES152.includes(a.role) ? a.role : "director", o = opts152(x.p, a.language), rv = review152(ed, o), list = forRole152(rv, role), want = Array.isArray(a.issue_ids) && a.issue_ids.length ? new Set(a.issue_ids.map(String)) : null;
    if (want) { const miss = [...want].filter((id) => !list.some((i) => i.id === id)); if (miss.length && !list.some((i) => i.fix && want.has(i.id))) throw bad("Those issues aren't in the review now: " + miss.join(", ") + " — run nooi_review again.", "هذه الملاحظات ليست في المراجعة الآن — أعد المراجعة."); }
    // fix, look again, fix what the fixes brought (a caption given time to read now on top of another) — up to three rounds, on a copy
    const work = JSON.parse(JSON.stringify(ed)), fixes = [], editor = [], seen = new Set();
    for (let round = 0, cur = list; round < (want ? 1 : 3); round++, cur = forRole152(review152(work, o), role)) {
      const pick = cur.filter((i) => i.fix && !seen.has(i.id) && (!want || want.has(i.id))); if (!pick.length) break;
      for (const i of pick) {
        seen.add(i.id);
        if (i.fix.op === "open") { editor.push({ issue_id: i.id, needs: i.fix.en }); continue; }
        const f = JSON.parse(JSON.stringify({ op: i.fix.op, args: i.fix.args }));
        if (f.op === "text_add") f.args.id = uid();   // (the same id on the server and in the open editor)
        if (f.op === "text_split") f.args.id2 = uid();
        if (f.op === "sound_pass") f.args.sfx = soundPass152(work, f.args.preset, () => uid());
        if (applyFix152(work, f)) fixes.push(f);
      }
    }
    if (!fixes.length) return txt({ ok: true, did: "nothing to change", ...(editor.length ? { needs_the_editor: editor } : {}), score: rv.score });
    const r = x.commit({ op: "review_fix", args: { fixes } }), after = review152(r.project.doc.ed, opts152(r.project, a.language));
    return txt({ ok: true, did: fixes.length + " fix(es): " + fixes.map((f) => f.op).join(", "), score_before: rv.score, score_after: after.score, ready_to_share: after.ship, still_open: forRole152(after, role).map(view), ...(editor.length ? { needs_the_editor: editor } : {}) });
  }
  if (name === "nooi_sound_pass") {
    if (!PRESETS152[a.preset]) throw bad("Unknown preset " + a.preset + ".", "نمط غير معروف.");
    if (!(ed.clips || []).length) throw bad("This project has no clips yet.", "لا مقاطع في هذا المشروع بعد.");
    const sfx = soundPass152(ed, a.preset, () => uid());
    return x.done(x.commit({ op: "sound_pass", args: { preset: a.preset, sfx } }), "sound pass (" + a.preset + "): " + sfx.length + " sounds — " + sfx.map((s) => s.n.split(":")[0] + "@" + s.t + "s").join(", "));
  }
  if (name === "nooi_style_set") {
    const args = {};
    if (a.transition != null) args.transition = a.transition; if (a.transition_seconds != null) args.trans_len = Math.min(2, Math.max(0.1, +a.transition_seconds || 0.6));
    if (a.filter != null) args.filter = a.filter; if (a.filter_amount != null) args.filter_amount = Math.min(100, Math.max(0, +a.filter_amount || 0));
    if (a.frame != null) args.frame = a.frame; if (a.frame_color != null) args.frame_color = String(a.frame_color);
    if (Array.isArray(a.clips) && a.clips.length) args.clips = a.clips.map((c) => clipRef(ed, c));
    if (!Object.keys(args).filter((k) => k !== "clips").length) throw bad("Say what to change: transition, filter or frame.", "حدّد ما يتغير: الانتقال أو الفلتر أو الإطار.");
    const test = applyStyle152(JSON.parse(JSON.stringify(ed)), args);
    if (!test) throw bad("Use one of the listed transitions, filters and frames (nooi_editor_guide lists them); a colour is #rrggbb.", "استخدم أحد الانتقالات أو الفلاتر أو الإطارات المذكورة.");
    return x.done(x.commit({ op: "style_set", args }), "look changed: " + test.join(", "));
  }
  return null;
});
