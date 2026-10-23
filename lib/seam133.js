// v133: the seam engine — a long video's parts joined so the joins don't show, whatever engine made each part.
// Engines end a shot on a blurred, darkened or faded frame, start the next one a few frames "settling" (or still, before the motion
// picks up), drift in colour and exposure from shot to shot, and make their sound at different levels. Here, with ffmpeg and a few
// measurements on small copies of the frames:
//  1. hand-off frame: the sharpest clean frame near the end of a part (not dark, not a flash) — the next part starts from it, and the
//     part is cut right after it (handoff133);
//  1b. colour lock: that frame brought most of the way back to the first part's colours, so drift doesn't pile up part after part;
//  2. start check: the next part really starts on that frame (an engine that ignored it made a new scene — lib/jobs.js makes it again)
//     (adherence133);
//  3. seam match: where the next part's frames match the hand-off frame best (and any still frames before its motion starts) — the
//     part is joined from there, so the action goes on without a repeat or a pause;
//  4. colour match: each part starts in the colour and exposure of the part before (one contrast + a level per colour) and eases
//     into its own over a few seconds — no jump at the join, and no correction piling up from part to part;
//  5. what is left: a hard cut where the frames match, a short dissolve where they still differ a little; the sound crossfaded at every join and
//     brought to one level (joinSeamless133). Anything that can't be done this way → the plain join (lib/long132.js joinLong132).
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { MEDIA_DIR, publicUrl, localPath } from "./media.js";
import { uid } from "./store.js";
import { FF, run132, probe132, fileOf132, joinLong132 } from "./long132.js";

const TW = 160, TH = 90, FB = TW * TH * 3;                  // the small copy every measurement is made on (RGB)
const ADH = () => +process.env.SEAM_ADHERE || 0.16;         // a first frame further than this from the frame it was given = a new scene
const FADE = () => +process.env.SEAM_FADE || 0.035;         // frames that still differ more than this after the colour match → dissolve
const EASE = () => +process.env.SEAM_EASE || 2.5;           // seconds a part takes to ease from the look of the part before into its own
const MORPH = () => process.env.SEAM_MORPH !== "false";      // v135: frames worked out between two parts that don't quite meet (else a dissolve)
const NEAR136 = () => +process.env.SEAM_NEAR || 0.07;          // v136: frames this close may dissolve into each other; further apart → a clean cut
const MORPH_N = () => Math.max(2, Math.min(8, Math.round(+process.env.SEAM_MORPH_FRAMES || 4)));   // frames each side gives up to them
const runBuf = (args, ms = 60000) => new Promise((ok, bad) => { const p = spawn(FF(), args); const out = []; let err = "";
  const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error("timed out")); }, ms);
  p.stdout.on("data", (d) => out.push(d)); p.stderr.on("data", (d) => (err = (err + d).slice(-400)));
  p.on("error", (e) => { clearTimeout(t); bad(e); }); p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(Buffer.concat(out)) : bad(new Error(err.trim() || "exit " + c)); }); });
const fpsOf = (i) => Math.min(30, Math.max(12, Math.round(i.fps) || 24));
// the frames of [from, from + len) as small RGB copies, at the frame rate f — picked by their number after the frame-rate step
// (frame k is exactly at k / f, the same numbering the hand-off picture and the join use; a seek would land a frame early or late)
async function frames(file, from, len, f, dur = Infinity) {
  const A = Math.max(0, Math.ceil(Math.max(0, from) * f - 1e-6)), B = Math.min(A + Math.max(1, Math.round(len * f)), Math.ceil(dur * f - 1e-6));
  if (B <= A) { const fr = []; fr.t0 = A / f; return fr; }
  const b = await runBuf(["-v", "error", "-i", file, "-vf", `fps=${f},trim=start_frame=${A}:end_frame=${B},scale=${TW}:${TH}:flags=area,format=rgb24`, "-vsync", "passthrough", "-f", "rawvideo", "-"]);
  const fr = Array.from({ length: Math.floor(b.length / FB) }, (_, k) => b.subarray(k * FB, (k + 1) * FB)); fr.t0 = A / f; return fr;
}
async function picture(file) { const b = await runBuf(["-v", "error", "-i", file, "-frames:v", "1", "-vf", `scale=${TW}:${TH}:flags=area,format=rgb24`, "-f", "rawvideo", "-"]); return b.length >= FB ? b.subarray(0, FB) : null; }
const luma = (f) => { let s = 0; for (let i = 0; i < FB; i += 3) s += f[i] * 0.299 + f[i + 1] * 0.587 + f[i + 2] * 0.114; return s / (TW * TH); };
function sharp(f) {   // how much fine detail (Laplacian variance of the brightness)
  const Y = new Float32Array(TW * TH); for (let i = 0, j = 0; i < FB; i += 3, j++) Y[j] = f[i] * 0.299 + f[i + 1] * 0.587 + f[i + 2] * 0.114;
  let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < TH - 1; y++) for (let x = 1; x < TW - 1; x++) { const k = y * TW + x, l = 4 * Y[k] - Y[k - 1] - Y[k + 1] - Y[k - TW] - Y[k + TW]; s += l; s2 += l * l; n++; }
  return s2 / n - (s / n) ** 2;
}
export function stats133(f) {   // mean and spread of each colour
  const m = [0, 0, 0], q = [0, 0, 0], n = TW * TH;
  for (let i = 0; i < FB; i += 3) for (let c = 0; c < 3; c++) { const v = f[i + c]; m[c] += v; q[c] += v * v; }
  return m.map((s, c) => ({ mu: s / n, sd: Math.sqrt(Math.max(1, q[c] / n - (s / n) ** 2)) }));
}
// how different two frames are, 0–1 (with norm: after each one's own colour spread is evened out — the shapes, not the grade)
export function diff133(a, b, norm) {
  let s = 0; if (!norm) { for (let i = 0; i < FB; i++) s += Math.abs(a[i] - b[i]); return s / FB / 255; }
  const A = stats133(a), B = stats133(b);
  for (let i = 0; i < FB; i++) { const c = i % 3; s += Math.abs((a[i] - A[c].mu) / A[c].sd - (b[i] - B[c].mu) / B[c].sd); }
  return s / FB / 4;   // (a spread of ±2 = the whole range)
}
const lumaSd = (f) => { let s = 0, q = 0; const n = TW * TH; for (let i = 0; i < FB; i += 3) { const y = f[i] * 0.299 + f[i + 1] * 0.587 + f[i + 2] * 0.114; s += y; q += y * y; } return Math.sqrt(Math.max(1, q / n - (s / n) ** 2)); };
const applyC = (f, C) => { const o = Buffer.alloc(FB); for (let i = 0; i < FB; i++) { const c = C[i % 3]; o[i] = Math.max(0, Math.min(255, Math.round(f[i] * c.g + c.o))); } return o; };
const IDENT = () => [{ g: 1, o: 0 }, { g: 1, o: 0 }, { g: 1, o: 0 }];
const isIdent = (C) => C.every((c) => Math.abs(c.g - 1) < 0.01 && Math.abs(c.o) < 1.5);
// 1. the hand-off frame of a part: { img (a full-size picture of it, on this server), t (the part ends right after it), at, f }
export async function handoff133(url) {
  const file = await fileOf132(url), info = await probe132(file), f = fpsOf(info), dur = info.dur || 0;
  const win = Math.min(0.7, Math.max(0.2, dur * 0.25)), from = Math.max(0, dur - win), fr = await frames(file, from, win + 0.5, f, dur);
  if (!fr.length) throw new Error("no frames at the end");
  const L = fr.map(luma), S = fr.map(sharp), ref = [...L].sort((a, b) => a - b)[Math.floor(L.length * 0.75)];
  const okIx = fr.map((_, i) => i).filter((i) => L[i] >= ref * 0.97 && L[i] <= ref * 1.3 + 15);   // not fading to black, not a flash
  const pool = okIx.length ? okIx : fr.map((_, i) => i), best = Math.max(...pool.map((i) => S[i]));
  const ix = [...pool].reverse().find((i) => S[i] >= best * 0.8) ?? pool[pool.length - 1];
  const at = fr.t0 + ix / f, N = Math.round(at * f), name = uid() + ".png";   // (the very frame measured, at full size)
  await run132(FF(), ["-y", "-v", "error", "-i", file, "-vf", `fps=${f},select=eq(n\\,${N})`, "-vsync", "passthrough", "-frames:v", "1", "-update", "1", path.join(MEDIA_DIR, name)], 60000);
  if (!fs.existsSync(path.join(MEDIA_DIR, name))) throw new Error("the hand-off frame couldn't be saved");
  return { img: publicUrl(name), at: Math.round(at * 1000) / 1000, t: Math.round(Math.min(dur, at + 0.5 / f) * 1000) / 1000, f, dur, dropped: Math.round(Math.max(0, dur - at - 1 / f) * 100) / 100 };
}
// 1b. the colour lock: engines drift a little in colour and exposure with every shot, and a part made from the part before's frame
// carries that drift on — over 8 or 15 parts it piles up. The hand-off frame is brought part of the way back to the film's first
// part (the anchor) before the next part starts from it (lib/jobs.js: firmer when the vision AI says it is the same film, not at all
// when it says the place changed).
export async function lockColour133(img, anchor, strength = +process.env.SEAM_LOCK || 0.5) {
  const fileOf = async (u) => { const l = localPath(u) || (/^\/media\//.test(String(u)) ? path.join(MEDIA_DIR, path.basename(u)) : null); return l && fs.existsSync(l) ? l : await fileOf132(u); };
  const [fi, fa] = await Promise.all([fileOf(img), fileOf(anchor)]), [A, B] = await Promise.all([picture(fa), picture(fi)]);
  if (!A || !B) return { img, moved: 0 };
  // each colour's level and spread toward the first part's (the spread too: engines creep in saturation and contrast), part of the way
  const sa = stats133(A), sb = stats133(B), M = sa.map((a, c) => { const g0 = Math.max(0.8, Math.min(1.25, a.sd / sb[c].sd)), g = 1 + (g0 - 1) * strength;
    return { g, o: Math.max(-40, Math.min(40, strength * (a.mu - g0 * sb[c].mu))) }; });
  const moved = M.reduce((t, c, k) => t + Math.abs((c.g - 1) * sb[k].mu + c.o), 0) / 3;
  if (moved < 2) return { img, moved: 0 };
  const name = uid() + ".png", lut = `lutrgb=r='clip(val*${M[0].g.toFixed(4)}+${M[0].o.toFixed(2)},0,255)':g='clip(val*${M[1].g.toFixed(4)}+${M[1].o.toFixed(2)},0,255)':b='clip(val*${M[2].g.toFixed(4)}+${M[2].o.toFixed(2)},0,255)'`;
  await run132(FF(), ["-y", "-v", "error", "-i", fi, "-vf", `format=rgb24,${lut}`, "-frames:v", "1", "-update", "1", path.join(MEDIA_DIR, name)], 60000);
  return fs.existsSync(path.join(MEDIA_DIR, name)) ? { img: publicUrl(name), moved: Math.round(moved * 10) / 10 } : { img, moved: 0 };
}
// 2. does the part start on the frame it was given? { d (0–1, the closest of its first frames), ok }
export async function adherence133(url, img) {
  const file = await fileOf132(url), info = await probe132(file), f = fpsOf(info), head = await frames(file, 0, 0.6, f);
  const src = localPath(img) || (/^\/media\//.test(String(img)) ? path.join(MEDIA_DIR, path.basename(img)) : null);
  const pic = src && fs.existsSync(src) ? await picture(src) : await picture(await fileOf132(img));
  if (!head.length || !pic) return { d: 0, ok: true, unknown: true };
  const d = Math.min(...head.map((h) => diff133(pic, h, true)));
  return { d: Math.round(d * 1000) / 1000, ok: d <= ADH() };
}
// v134: how the end of a video moves — the camera (push in / pull back / pan / tilt / still, and how fast) and how lively the action in
// the frame is — so the next part is told to carry exactly that on (the joins of an Extend or a long video stop "restarting" the
// motion). Measured on the last ~0.8 s before the cut: for frames 3 apart, the shift and the scale that best line one up on the
// other (the camera); what is left over is the action.
const lumaArr = (f) => { const Y = new Float32Array(TW * TH); for (let i = 0, j = 0; i < FB; i += 3, j++) Y[j] = f[i] * 0.299 + f[i + 1] * 0.587 + f[i + 2] * 0.114; return Y; };
function camStep(A, B) {   // B ≈ A moved by (dx, dy) and scaled by s about the centre
  const cx = TW / 2, cy = TH / 2; let best = { e: Infinity, dx: 0, dy: 0, s: 1 }, e0 = 0, n0 = 0;
  for (let y = 4; y < TH - 4; y += 2) for (let x = 4; x < TW - 4; x += 2) { e0 += Math.abs(B[y * TW + x] - A[y * TW + x]); n0++; }
  const err = (s, dx, dy) => { let e = 0, n = 0;
    for (let y = 8; y < TH - 8; y += 2) for (let x = 10; x < TW - 10; x += 2) {
      const ax = Math.round(cx + (x - cx) / s - dx), ay = Math.round(cy + (y - cy) / s - dy); if (ax < 0 || ay < 0 || ax >= TW || ay >= TH) continue;
      e += Math.abs(B[y * TW + x] - A[ay * TW + ax]); n++; }
    return e / Math.max(1, n); };
  // the simplest move that explains the change: no move, then a slide, then a slide + a zoom — each only if it clearly fits better
  const none = { e: err(1, 0, 0), dx: 0, dy: 0, s: 1 }; let slide = none;
  for (let dy = -5; dy <= 5; dy++) for (let dx = -8; dx <= 8; dx++) { if (!dx && !dy) continue; const e = err(1, dx, dy); if (e < slide.e) slide = { e, dx, dy, s: 1 }; }
  if (slide.e > none.e * 0.95) slide = none;
  best = slide;
  for (const s of [0.97, 0.98, 0.99, 1.01, 1.02, 1.03]) for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) { const e = err(s, slide.dx + dx, slide.dy + dy); if (e < best.e) best = { e, dx: slide.dx + dx, dy: slide.dy + dy, s }; }
  if (best.s !== 1 && best.e > slide.e * 0.95) best = slide;
  return { ...best, still: e0 / Math.max(1, n0) };
}
export async function motion134(url, cut) {
  const file = await fileOf132(url), info = await probe132(file), f = fpsOf(info), end = Math.min(info.dur || 0, +cut > 0 ? +cut : Infinity);
  const fr = await frames(file, Math.max(0, end - 0.8), 0.8, f, end); if (fr.length < 4) return null;
  const per = 6, Y = fr.map(lumaArr), st = []; for (let i = per; i < Y.length; i += per) st.push(camStep(Y[i - per], Y[i]));   // (frames 6 apart: a slow move is big enough to measure)
  const avg = (k) => st.reduce((t, x) => t + x[k], 0) / st.length;
  const dx = avg("dx") / per, dy = avg("dy") / per, zs = Math.pow(avg("s"), 1 / per), left = avg("e"), still = avg("still");
  // per second, as a share of the frame: the pan, the tilt, the zoom
  const px = (dx * f) / TW, py = (dy * f) / TH, pz = Math.pow(zs, f) - 1, pace = (v) => (v < 0.04 ? "slowly" : v < 0.12 ? "steadily" : "quickly");
  const moves = [];
  if (Math.abs(pz) >= 0.015) moves.push((pz > 0 ? "pushing in " : "pulling back ") + pace(Math.abs(pz)));
  if (Math.abs(px) >= 0.02) moves.push("panning " + (px < 0 ? "right" : "left") + " " + pace(Math.abs(px)));   // (the picture slides left when the camera turns right)
  if (Math.abs(py) >= 0.02) moves.push("tilting " + (py < 0 ? "down" : "up") + " " + pace(Math.abs(py)));
  const action = still < 1.2 ? "still" : left > 6 ? "lively" : left > 2.5 ? "moving" : "calm";
  const cam = moves.length ? "The camera keeps " + moves.join(" and ") + ", exactly as at the end of the shot before" : "The camera stays where it is, as at the end of the shot before";
  const act = action === "still" ? "everything holds as it was, then moves on naturally" : action === "lively" ? "the lively action in the frame goes on at the same speed and in the same direction" : "the movement in the frame carries on at the same speed and in the same direction";
  return { words: `${cam}; ${act} — no pause, no restart, no change of lens.`, cam: { px: Math.round(px * 1000) / 1000, py: Math.round(py * 1000) / 1000, pz: Math.round(pz * 1000) / 1000 }, action, moves };
}
// v134: where a new part really begins, for the editor (which places it after the clip itself): its repeat of the given frame and
// any still frames before its motion starts are skipped (seconds)
export async function headOf134(url, img) {
  const file = await fileOf132(url), info = await probe132(file), f = fpsOf(info), head = await frames(file, 0, 0.7, f, info.dur || Infinity);
  const src = localPath(img) || (/^\/media\//.test(String(img)) ? path.join(MEDIA_DIR, path.basename(img)) : null), pic = src && fs.existsSync(src) ? await picture(src) : null;
  if (!head.length || !pic) return 0;
  let j = 0, best = Infinity; head.forEach((h, i) => { const d = diff133(pic, h, true); if (d < best - 1e-4) { best = d; j = i; } });
  if (best > ADH()) return 0;
  let k = j; while (k < head.length - 2 && diff133(head[k], head[k + 1]) < 0.003 && (k - j) / f < 0.4) k++;
  return Math.round(Math.min((best <= 0.02 ? k + 1 : k) / f, (info.dur || 5) / 3) * 1000) / 1000;
}
// how loud a part is (mean volume, dB) — null when it has no sound
async function loud(file) {
  try { const err = await new Promise((ok) => { const p = spawn(FF(), ["-v", "info", "-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"]); let e = "";
    p.stderr.on("data", (d) => (e = (e + d).slice(-4000))); p.on("close", () => ok(e)); p.on("error", () => ok("")); });
    const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(err); return m && +m[1] > -70 ? +m[1] : null; } catch { return null; }
}
// 3–5. the parts as one video. parts = [{ url, cut }] (cut = where the part ends — its hand-off frame — when known)
export async function joinSeamless133(parts) {
  if (!parts || parts.length < 2) throw new Error("nothing to join");
  const files = []; for (const p of parts) files.push(await fileOf132(p.url));
  const info = []; for (const fl of files) info.push(await probe132(fl));
  const F = fpsOf(info[0]), W = Math.max(2, info[0].w - (info[0].w % 2)), H = Math.max(2, info[0].h - (info[0].h % 2)), n = parts.length;
  const end = parts.map((p, i) => { const d = info[i].dur || 5, c = +p.cut; return i < n - 1 && c > 0.5 && c <= d + 0.01 ? Math.min(d, c) : d; });
  const start = new Array(n).fill(0), C = [IDENT()], seams = [];
  for (let k = 0; k < n - 1; k++) {
    if (parts[k + 1].hard) { C.push(IDENT()); seams.push({ hard: true, same: false, fade: 0 }); continue; }   // (v134: a deliberate cut to another angle: a clean cut, nothing matched)
    const tail = (await frames(files[k], Math.max(0, end[k] - 2 / F), 2 / F + 0.001, F, info[k].dur || Infinity)).slice(-2), head = await frames(files[k + 1], 0, 0.7, F, info[k + 1].dur || Infinity);
    const A = tail[tail.length - 1];
    if (!A || !head.length) { C.push(C[k]); seams.push({ fade: 0.25, how: "unread" }); continue; }
    let j = 0, best = Infinity; head.forEach((h, i) => { const d = diff133(A, h, true); if (d < best - 1e-4) { best = d; j = i; } });
    const same = best <= ADH();
    // the motion: the part before was moving at its end, and the next one stands still at its start → those still frames are left out
    const mot = tail.length > 1 ? diff133(tail[0], tail[1], true) : 0, moving = tail.length > 1 && diff133(tail[0], tail[1]) > 0.006;
    let skip = j; const dup = best <= Math.max(0.003, 0.4 * mot);   // (dup: the very hand-off frame again — closer than one frame of motion)
    if (same && moving) while (skip < head.length - 2 && diff133(head[skip], head[skip + 1]) < 0.003 && (skip - j) / F < 0.4) skip++;
    start[k + 1] = same ? Math.min((dup ? skip + 1 : skip) / F, (info[k + 1].dur || 5) / 3) : 0;
    // the colour: the next part starts in the look of the hand-off frame and eases into its own look over a few seconds (every part
    // ends in its own look, so nothing piles up from part to part — a jump is seen at once, a slow ease is not)
    let M = IDENT();
    if (same) { const sa = stats133(A), sb = stats133(head[j]);
      // one contrast for the three colours (from the brightness), and each colour's own level — fewer knobs, nothing over-corrected
      const ya = lumaSd(A), yb = lumaSd(head[j]), g = Math.max(0.85, Math.min(1.18, ya / yb));
      M = sa.map((a, c) => ({ g, o: Math.max(-40, Math.min(40, a.mu - g * sb[c].mu)) }));
      if (isIdent(M)) M = IDENT(); }
    C.push(M);
    const left = diff133(A, applyC(head[Math.min(dup ? skip + 1 : skip, head.length - 1)], M));
    // v135: the same scene, still not quite meeting → a morph: a few frames worked out between the two (motion interpolation), not a dissolve
    const h = MORPH_N() / F, morph = same && left > FADE() && MORPH() && end[k] - start[k] > 1 + h && (info[k + 1].dur || 0) - start[k + 1] > 1 + h;
    // v136: two different shots meet at one frame — a clean cut (before, a third of a second of one dissolving into the other: seen on the owner's
    // phone as a double picture, "as if something had been added"); a dissolve only where the frames nearly meet already
    const near = left <= NEAR136(), fade = !same ? 0 : left > FADE() && !morph && near ? Math.min(0.25, 6 / F) : 0;
    seams.push({ match: Math.round(best * 1000) / 1000, same, tail: Math.round(((info[k].dur || 0) - end[k]) * 100) / 100, head: Math.round(start[k + 1] * 100) / 100,
      colour: !isIdent(M), left: Math.round(left * 1000) / 1000, fade: Math.round(fade * 100) / 100, ...(!same || (left > FADE() && !morph && !near) ? { cut: true } : {}), ...(morph ? { morph: true, h, step: tail.length > 1 ? diff133(tail[0], tail[1]) : 0 } : {}) });
  }
  // v135: a morph join takes h from the end of the part before and from the start of the next, and puts the frames in between there
  seams.forEach((sm, k) => { if (sm.morph) { end[k] -= sm.h; start[k + 1] += sm.h; } });
  const len = end.map((e, i) => Math.max(0.2, e - start[i]));
  // a dissolve never longer than a third of either side; a "cut" is one frame of overlap (the frames match there)
  const D = seams.map((s, k) => Math.max(1 / F, Math.min(s.fade || 0, len[k] / 3, len[k + 1] / 3)));
  const bridges = []; for (let k = 0; k < n - 1; k++) if (seams[k].morph) {
    try { bridges[k] = await bridge135(files[k], end[k], files[k + 1], start[k + 1], C[k + 1], { W, H, F, n: Math.round(2 * seams[k].h * F), lim: Math.max(0.05, 2.5 * seams[k].step) }); }
    catch (e) { console.warn("morph →  dissolve or cut:", String(e.message).slice(0, 120)); seams[k].morph = false; end[k] += seams[k].h; start[k + 1] -= seams[k].h; len[k] = end[k] - start[k]; len[k + 1] = end[k + 1] - start[k + 1];
      const near = seams[k].left <= NEAR136(); D[k] = near ? Math.min(0.25, 6 / F, len[k] / 3, len[k + 1] / 3) : 1 / F; seams[k].fade = near ? Math.round(D[k] * 100) / 100 : 0; if (!near) seams[k].cut = true; } }   // (v136: no double picture)
  const vol = await Promise.all(files.map((fl, i) => (info[i].audio ? loud(fl) : null))), sound = info.some((i) => i.audio);
  const heard = vol.filter((v) => v != null).sort((a, b) => a - b), ref = heard.length ? heard[Math.floor(heard.length / 2)] : 0;
  const fc = [], ins = files.slice(), bv = [];
  bridges.forEach((b, k) => { if (b) { ins.push(b); bv[k] = ins.length - 1; } });
  // each part's sound, split for the pieces of it a morph join needs (its end for the join after it, its start for the join before)
  const morphAfter = (i) => !!(seams[i] && seams[i].morph), morphBefore = (i) => !!(i > 0 && seams[i - 1] && seams[i - 1].morph);
  if (sound) info.forEach((it, i) => { const outs = ["m" + i, ...(morphAfter(i) ? ["t" + i] : []), ...(morphBefore(i) ? ["h" + i] : [])];
    fc.push(it.audio ? `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${(vol[i] == null ? 0 : Math.max(-8, Math.min(8, ref - vol[i]))).toFixed(2)}dB,asplit=${outs.length}${outs.map((o) => "[s" + o + "]").join("")}`
      : `anullsrc=r=48000:cl=stereo,atrim=duration=${((info[i].dur || 5) + 1).toFixed(3)},aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=${outs.length}${outs.map((o) => "[s" + o + "]").join("")}`); });
  info.forEach((it, i) => {
    const c = C[i], e1 = end[i] + (morphAfter(i) ? 1 / F : 0), base = `[${i}:v]fps=${F},trim=start=${start[i].toFixed(4)}:end=${e1.toFixed(4)},setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
    if (isIdent(c)) fc.push(`${base},format=yuv420p[v${i}]`);
    else { const ease = Math.max(1 / F, Math.min(EASE(), len[i] / 2)), lut = `lutrgb=r='clip(val*${c[0].g.toFixed(4)}+${c[0].o.toFixed(2)},0,255)':g='clip(val*${c[1].g.toFixed(4)}+${c[1].o.toFixed(2)},0,255)':b='clip(val*${c[2].g.toFixed(4)}+${c[2].o.toFixed(2)},0,255)'`;
      fc.push(`${base},split[p${i}a][p${i}b]`, `[p${i}a]format=rgb24,${lut},format=yuv420p[p${i}c]`, `[p${i}b]format=yuv420p[p${i}d]`,
        `[p${i}c][p${i}d]xfade=transition=fade:duration=${ease.toFixed(4)}:offset=0[v${i}]`); }
    if (sound) { fc.push(`[sm${i}]atrim=start=${start[i].toFixed(4)}:end=${e1.toFixed(4)},asetpts=PTS-STARTPTS,apad,atrim=duration=${(e1 - start[i]).toFixed(4)}[a${i}]`);
      // (the morph frames' sound: the end of the part before and the start of the next, the frames they replace — half a frame more each, for the overlaps)
      if (morphAfter(i)) { const q = seams[i].h + 0.5 / F; fc.push(`[st${i}]atrim=start=${end[i].toFixed(4)}:end=${(end[i] + q).toFixed(4)},asetpts=PTS-STARTPTS,apad,atrim=duration=${q.toFixed(4)}[bt${i}]`); }
      if (morphBefore(i)) { const q = seams[i - 1].h + 0.5 / F; fc.push(`[sh${i}]atrim=start=${Math.max(0, start[i] - q).toFixed(4)}:end=${start[i].toFixed(4)},asetpts=PTS-STARTPTS,apad,atrim=duration=${q.toFixed(4)}[bh${i - 1}]`); } }
  });
  // the pieces in order: part, (the morph frames, with the sound of the frames they replace), part…
  const segs = [];
  // (next to the morph frames the overlap is one identical frame: the part's last = the bridge's first, the bridge's last = the next part's first)
  for (let i = 0; i < n; i++) { segs.push({ v: "v" + i, a: "a" + i, len: len[i] + (morphAfter(i) ? 1 / F : 0), d: i ? (seams[i - 1].morph ? 1 / F : D[i - 1]) : 0, seam: i ? i - 1 : null });
    if (i < n - 1 && seams[i].morph) { const bl = 2 * seams[i].h + 1 / F;
      fc.push(`[${bv[i]}:v]fps=${F},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p,trim=duration=${bl.toFixed(4)},setpts=PTS-STARTPTS[bv${i}]`);
      if (sound) fc.push(`[bt${i}][bh${i}]concat=n=2:v=0:a=1[ba${i}]`);
      segs.push({ v: "bv" + i, a: "ba" + i, len: bl, d: 1 / F, bridge: i }); } }
  let L = segs[0].len, vx = segs[0].v, ax = segs[0].a;
  for (let k = 1; k < segs.length; k++) { const g = segs[k], d = g.d, off = Math.max(0, L - d), last = k === segs.length - 1, vo = last ? "v" : "x" + k, ao = last ? "a" : "y" + k;
    // (the video so far gets copies of its last frame first: a part whose last frame falls a hair before the join would end the crossfade —
    // and with it the whole picture — there; the copies are only used if its own frames run out)
    fc.push(`[${vx}]tpad=stop_mode=clone:stop_duration=${(3 / F).toFixed(4)}[${vx}p]`, `[${vx}p][${g.v}]xfade=transition=fade:duration=${d.toFixed(4)}:offset=${off.toFixed(4)}[${vo}]`);
    if (g.bridge != null) seams[g.bridge].at = Math.round((off + g.len / 2) * 100) / 100; else if (g.seam != null && !seams[g.seam].morph) seams[g.seam].at = Math.round((off + d / 2) * 100) / 100;   // (where the join is in the video)
    if (sound) fc.push(`[${ax}][${g.a}]acrossfade=d=${d.toFixed(4)}:c1=tri:c2=tri[${ao}]`);
    L = L + g.len - d; vx = vo; ax = ao; }
  const name = uid() + "-long.mp4", out = path.join(MEDIA_DIR, name);
  await run132(FF(), ["-y", "-v", "error", ...ins.flatMap((fl) => ["-i", fl]), "-filter_complex", fc.join(";"), "-map", "[v]", ...(sound ? ["-map", "[a]", "-c:a", "aac", "-b:a", "160k"] : ["-an"]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(F), "-movflags", "+faststart", out], Math.max(180000, L * 8000));
  for (const b of bridges) if (b) fs.unlink(b, () => {});
  if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error("the parts couldn't be joined");
  const r = await probe132(out);
  return { url: publicUrl(name), dur: Math.round(r.dur * 10) / 10, w: r.w, h: r.h, seams: seams.map(({ h, step, ...x }) => x) };
}
// v135: the morph frames of a join — from the frame where the part before now ends to the (colour-matched) frame where the next one now
// begins, both included, with n - 1 frames between them worked out by motion interpolation (each pixel follows its own motion from one
// picture to the other)
async function bridge135(fileA, tA, fileB, tB, M, { W, H, F, n, lim = 0.05 }) {
  const dir = path.join(MEDIA_DIR, uid() + "-mo"), out = dir + "-bridge.mp4"; fs.mkdirSync(dir, { recursive: true });
  const lut = isIdent(M) ? "" : `,format=rgb24,lutrgb=r='clip(val*${M[0].g.toFixed(4)}+${M[0].o.toFixed(2)},0,255)':g='clip(val*${M[1].g.toFixed(4)}+${M[1].o.toFixed(2)},0,255)':b='clip(val*${M[2].g.toFixed(4)}+${M[2].o.toFixed(2)},0,255)'`;
  const one = (file, t, extra, to) => run132(FF(), ["-y", "-v", "error", "-i", file, "-vf", `fps=${F},select=eq(n\\,${Math.round(t * F)}),scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1${extra}`, "-vsync", "passthrough", "-frames:v", "1", "-update", "1", to], 60000);
  try {
    const a = path.join(dir, "f0001.png"), b = path.join(dir, "f0003.png");
    await one(fileA, tA, "", a); await one(fileB, tB, lut, b);
    if (!fs.existsSync(a) || !fs.existsSync(b)) throw new Error("the frames of the join couldn't be read");
    fs.copyFileSync(a, path.join(dir, "f0002.png")); fs.copyFileSync(b, path.join(dir, "f0004.png"));   // (the interpolation needs a frame on each side to work with)
    await run132(FF(), ["-y", "-v", "error", "-framerate", `${F}/${n}`, "-i", path.join(dir, "f%04d.png"), "-vf", `minterpolate=fps=${F}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,trim=start_frame=${n}:end_frame=${2 * n + 1},setpts=PTS-STARTPTS,format=yuv420p`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-r", String(F), out], 120000);
    if (!fs.existsSync(out) || fs.statSync(out).size < 1000) throw new Error("the morph couldn't be made");
    // no step in it bigger than the video's own motion allows (a morph that tears or jumps → the dissolve)
    const fr = await frames(out, 0, (n + 1) / F + 0.01, F); let big = 0; for (let i = 1; i < fr.length; i++) big = Math.max(big, diff133(fr[i - 1], fr[i]));
    if (fr.length < n || big > lim) { fs.unlink(out, () => {}); throw new Error(`the morph jumps (${big.toFixed(3)} > ${lim.toFixed(3)})`); }
    return out;
  } finally { fs.rm(dir, { recursive: true, force: true }, () => {}); }
}
// the seamless join, else the plain one (never worse than v132)
export async function joinParts133(parts) {
  try { return await joinSeamless133(parts); }
  catch (e) { console.warn("seamless join → plain join:", String(e.message).slice(0, 200)); const r = await joinLong132(parts.map((p) => p.url));
    let t = 0; const at = []; for (const p of parts.slice(0, -1)) { try { t += (await probe132(await fileOf132(p.url))).dur; } catch {} at.push(Math.round(t * 100) / 100); }
    return { ...r, seams: null, plain: true, at }; }
}
