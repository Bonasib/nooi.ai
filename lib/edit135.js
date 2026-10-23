// v135: edit a made video with words ("make her coat red", "it is raining now", "take the cup off the table"). The seconds chosen
// (all of it, or from–to) go to Seedance 2.0 as its reference video (@Video1) with the change in words and, when given, pictures and
// characters (@Image1…): the engine makes that same piece again with the change, and everything else as it was. A piece longer
// than the engine makes (15 s) is edited in parts, one after the other, each also given the last frame of the part before (after
// the edit) so the change looks the same all through. The edited seconds are put back into the video in their place: every part
// exactly as long as the seconds it replaces, a short dissolve where the edit begins, between parts and where it ends (the change
// fades in rather than jumping), and the video's own sound kept from start to end.
import fs from "fs";
import path from "path";
import { MEDIA_DIR, publicUrl } from "./media.js";
import { uid } from "./store.js";
import { FF, run132, probe132 } from "./long132.js";
import { castWords134 } from "./extend134.js";

export const EDIT_MIN135 = 4, EDIT_MAX135 = 120, EDIT_PART135 = 14;   // seconds: the engine's shortest piece, the most one edit changes, a part (15 s with its overlaps)
const O = 0.5;                                                          // the dissolve between parts, and where the edit begins and ends (s)
const said = (w) => String(w || "").trim().replace(/[.\s]+$/, "");
// the words for one part. pics: how many of the customer's pictures come first (@Image1…), prev: the part before's last frame comes after them
export function editWords135({ change, part = 1, parts = 1, pics = 0, prev = false, chars }) {
  const cast = castWords134(chars), lines = [
    `Edit @Video1: ${said(change)}.`,
    "Change only that. Everything else stays exactly as it is in @Video1: every person (face, hair, body, clothes) and every movement, expression, gaze and lip movement at the same moments; the place, the objects, the camera position, framing and movement; the timing, the light and the colours.",
    "The result is @Video1 itself with this one change: the same length and the same moments from its first frame to its last — nothing added before or after, no cut, no new scene. Photorealistic, the same look as @Video1. No new text, captions or watermarks.",
  ];
  if (pics) lines.push(`Use ${Array.from({ length: pics }, (_, i) => "@Image" + (i + 1)).join(", ")} for what the change brings in: ${pics > 1 ? "they look" : "it looks"} exactly like ${pics > 1 ? "their pictures" : "the picture"}.`);
  if (cast.length) lines.push(`Characters: ${cast.join("; ")} — exactly as they look.`);
  if (prev) lines.push(`This is part ${part} of ${parts} of one video edited the same way. @Image${pics + 1} is the last frame of the part before, after the edit: the change looks exactly the same here — the same colours, shapes, sizes and places.`);
  return lines.join("\n");
}
// which seconds, and the parts: [{ s, e (the seconds the part is used for, with its overlaps), a, b (what it is sent: whole seconds
// when the video has them — the engine makes whole seconds), d (the engine's length) }]
export function editPlan135(dur, from, to) {
  dur = +dur || 0; let f = Math.max(0, Math.min(dur, +from || 0)), t = to == null || to === "" ? dur : Math.max(0, Math.min(dur, +to));
  if (!(t > f)) { f = 0; t = dur; }
  if (f < 0.1) f = 0; if (dur - t < 0.1) t = dur;
  if (t - f < EDIT_MIN135) { const mid = (f + t) / 2; f = Math.max(0, Math.min(dur - EDIT_MIN135, mid - EDIT_MIN135 / 2)); t = Math.min(dur, f + EDIT_MIN135); }
  const L = t - f, n = Math.max(1, Math.ceil(L / EDIT_PART135 - 1e-9)), c = L / n, lin = f > 0 ? Math.min(O, f) : 0, lout = t < dur ? Math.min(O, dur - t) : 0, parts = [];
  for (let i = 0; i < n; i++) {
    const s = f + i * c - (i ? O / 2 : lin), e = f + (i + 1) * c + (i < n - 1 ? O / 2 : lout), d = Math.max(EDIT_MIN135, Math.min(15, Math.ceil(e - s - 0.02)));
    const a = Math.max(0, Math.min(s, dur - d)), b = Math.min(dur, a + d);
    parts.push({ s: r3(s), e: r3(e), a: r3(a), b: r3(b), d });
  }
  return { from: r3(f), to: r3(t), secs: r3(L), lin: r3(lin), lout: r3(lout), o: O, parts };
}
const r3 = (x) => Math.round(x * 1000) / 1000;
// the price: each part what the engine charges for the seconds it is sent (the cost line of a video-to-video edit on Seedance 2.0)
export const editPrice135 = (plan, per5) => plan.parts.reduce((t, p) => t + Math.round((+per5 || 0) * (p.d / 5)), 0);
// the seconds a part is sent, as a video of their own (no sound; at most 1280 px)
export async function cutClip135(file, a, b) {
  const name = uid() + "-ed.mp4", out = path.join(MEDIA_DIR, name);
  await run132(FF(), ["-y", "-v", "error", "-ss", a.toFixed(3), "-i", file, "-t", (b - a).toFixed(3), "-an", "-vf", "scale='trunc(min(1,1280/max(iw,ih))*iw/2)*2':'trunc(min(1,1280/max(iw,ih))*ih/2)*2',format=yuv420p",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-movflags", "+faststart", out], 120000);
  if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error("the piece to edit couldn't be cut");
  return { url: publicUrl(name), file: out };
}
// a made part, fitted to the seconds it replaces: its time stretched to the seconds it was sent (an engine that made a little more or
// less), the overlap it is used for taken out, the video's size and frame rate
export async function fitPart135(file, part, { W, H, F }) {
  const got = (await probe132(file)).dur || part.d, k = (part.b - part.a) / got, from = part.s - part.a, len = part.e - part.s;
  const name = uid() + "-edp.mp4", out = path.join(MEDIA_DIR, name);
  await run132(FF(), ["-y", "-v", "error", "-i", file, "-an", "-vf", `setpts=${k.toFixed(5)}*PTS,fps=${F},trim=start=${from.toFixed(4)}:duration=${len.toFixed(4)},setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-r", String(F), out], 180000);
  if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error("an edited part couldn't be fitted");
  return out;
}
// the video with its edited seconds in place, and its own sound
export async function assemble135(file, info, plan, fitted, { W, H, F }) {
  const dur = info.dur, fc = [], segs = [], scale = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`;
  if (plan.from > 0) { fc.push(`[0:v]fps=${F},trim=start=0:end=${plan.from.toFixed(4)},setpts=PTS-STARTPTS,${scale}[h]`); segs.push({ v: "h", len: plan.from }); }
  plan.parts.forEach((p, i) => { fc.push(`[${i + 1}:v]fps=${F},setpts=PTS-STARTPTS,${scale}[p${i}]`); segs.push({ v: "p" + i, len: p.e - p.s, d: i ? O : plan.lin }); });
  if (plan.to < dur) { fc.push(`[0:v]fps=${F},trim=start=${plan.to.toFixed(4)},setpts=PTS-STARTPTS,${scale}[t]`); segs.push({ v: "t", len: dur - plan.to, d: plan.lout }); }
  let L = segs[0].len, vx = segs[0].v;
  for (let k = 1; k < segs.length; k++) { const g = segs[k], d = Math.max(1 / F, g.d || 0), vo = k === segs.length - 1 ? "v" : "x" + k;
    fc.push(`[${vx}]tpad=stop_mode=clone:stop_duration=${(3 / F).toFixed(4)}[${vx}q]`, `[${vx}q][${g.v}]xfade=transition=fade:duration=${d.toFixed(4)}:offset=${Math.max(0, L - d).toFixed(4)}[${vo}]`); L = L + g.len - d; vx = vo; }   // (see lib/seam133.js: never cut short)
  if (segs.length === 1) fc.push(`[${vx}]null[v]`);
  const name = uid() + "-edit.mp4", out = path.join(MEDIA_DIR, name);
  await run132(FF(), ["-y", "-v", "error", "-i", file, ...fitted.flatMap((f) => ["-i", f]), "-filter_complex", fc.join(";"), "-map", "[v]", ...(info.audio ? ["-map", "0:a:0", "-c:a", "aac", "-b:a", "160k"] : ["-an"]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(F), "-t", dur.toFixed(3), "-movflags", "+faststart", out], Math.max(180000, dur * 8000));
  if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error("the edited video couldn't be put together");
  return { url: publicUrl(name), file: out };
}
// v135 Merge: a video's own seconds (in–out), with its sound, as a file of its own
export async function trim135(file, a, b) {
  const name = uid() + "-mg.mp4", out = path.join(MEDIA_DIR, name);
  await run132(FF(), ["-y", "-v", "error", "-ss", a.toFixed(3), "-i", file, "-t", (b - a).toFixed(3), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], 180000);
  if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error("a video couldn't be trimmed");
  return publicUrl(name);
}
export const fpsOf135 = (i) => Math.min(30, Math.max(12, Math.round(i.fps) || 24));
