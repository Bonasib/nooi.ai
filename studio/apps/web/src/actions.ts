// What the buttons, the keys and ⌘K do — one place, so every way of asking does the same thing (and is one undo step).
import * as C from "@nooi/editor-core";
import type { Asset, Clip, MediaClip, Project, TextClip } from "@nooi/editor-core";
import i18n from "./i18n";
import { autosave, editor, playerRef, toast, ui, markPick } from "./state";
import { importFiles } from "./media/library";

const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, o) as string;
export const now = () => playerRef.current?.clock.t ?? editor.playhead;
export const selected = (): Clip[] => editor.selection.map((id) => C.findClip(editor.project, id)?.clip).filter(Boolean) as Clip[];
export const sel1 = (): Clip | null => selected()[0] || null;
export function run<T>(label: string, fn: (p: Project) => T): T { const r = editor.run(label, fn); autosave(); return r; }

export function addAsset(a: Asset, at?: number, trackId?: string | null) {
  if (a.kind === "lut") { applyLut(a.id); return; }
  if (a.kind === "font") { toast(t("toast.fontReady", { name: a.name }), "ok"); return; }
  const c = run("add", (p) => { if (!p.assets[a.id]) p.assets[a.id] = a; return C.addAssetClip(p, p.assets[a.id], at ?? (a.kind === "audio" ? now() : C.mainTrackEnd(p, "video")), trackId || null); });
  editor.select([c.id]); playerRef.current?.resize();
  return c;
}
export function addAssets(list: Asset[]) { run("import", (p) => { for (const a of list) p.assets[a.id] = a; }); }
export function addText(templateId = "title", text?: string) {
  const tpl = C.TEXT_TEMPLATES.find((x) => x.id === templateId) || C.TEXT_TEMPLATES[0];
  const c = run("text", (p) => C.addClip(p, C.textClip(text || t("text.default"), now(), { style: C.textStyle0(tpl.style as Partial<C.TextStyle>), animIn: { type: tpl.animIn, dur: 0.4 }, animOut: { type: tpl.animOut, dur: 0.3 }, template: tpl.id })));
  markPick(); editor.select([c.id]); ui.set({ inspector: "text" }); return c;
}
export function split() {
  editor.prune(); const ids = editor.selection.filter((id) => { const f = C.findClip(editor.project, id); return f && now() > f.clip.start && now() < C.clipEnd(f.clip); });   // selected clips under the playhead; none → every track
  const out = run("split", (p) => C.splitAt(p, now(), new Set(ids)));
  if (!out.length) toast(t("toast.nothingToSplit"), "info");
}
export function del(ripple = false) {
  const ids = editor.selection; if (!ids.length) return;
  run(ripple ? "rippleDelete" : "delete", (p) => C.deleteClips(p, ids, ripple)); editor.select([]); playerRef.current?.prune();
}
export function duplicate() { const ids = editor.selection; if (!ids.length) return; const out = run("duplicate", (p) => C.duplicate(p, ids)); editor.select(out.map((c) => c.id)); }
let clip: Clip[] = [];
export function copy() { clip = selected().map((c) => JSON.parse(JSON.stringify(c))); if (clip.length) toast(t("toast.copied", { n: clip.length }), "info"); }
export function paste() {
  if (!clip.length) return; const at = now(), first = Math.min(...clip.map((c) => c.start));
  const out = run("paste", (p) => clip.map((c) => C.addClip(p, { ...JSON.parse(JSON.stringify(c)), id: C.uid("c"), start: at + (c.start - first) } as Clip)));
  editor.select(out.map((c) => c.id));
}
export function marker() { run("marker", (p) => C.addMarker(p, now(), "")); }
export function nextMarker(dir: 1 | -1) {
  const p = editor.project, tt = now(); const pts = [...p.markers.map((m) => m.t), ...p.tracks.flatMap((x) => x.clips.flatMap((c) => [c.start, C.clipEnd(c)]))].sort((a, b) => a - b);
  const n = dir > 0 ? pts.find((x) => x > tt + 1e-3) : [...pts].reverse().find((x) => x < tt - 1e-3); if (n != null) playerRef.current?.seek(n);
}
export function speed(v: number) { const c = sel1(); if (c?.type === "media") run("speed", (p) => C.setSpeed(p, c.id, v)); }
export function reverse() { const c = sel1(); if (c?.type === "media") run("reverse", (p) => C.COMMANDS.reverse.run(p, { id: c.id })); }
export function freeze() { const c = sel1(); if (c?.type !== "media") return; const f = run("freeze", (p) => C.freezeFrame(p, c.id, now(), 2)); if (f) { editor.select([f.id]); toast(t("toast.frozen"), "ok"); } }
export function detach() {
  const c = sel1(); if (c?.type !== "media") return; const s = run("detach", (p) => C.detachAudio(p, c.id));
  if (s) toast(t("toast.detached"), "ok"); else toast(t("toast.noSound"), "info");
}
export function setProp(path: string, value: unknown, label = "change") { const ids = editor.selection; if (!ids.length) return; run(label, (p) => { for (const id of ids) C.setPath(p, id, path, value); }); }
// a slider: one undo step for the whole drag
export const live = {
  start(label: string) { editor.begin(label); },
  set(path: string, value: unknown) { const ids = editor.selection; if (!editor.inTx) editor.begin("change"); editor.live((p) => { for (const id of ids) C.setPath(p, id, path, value); }); },
  end() { editor.commit(); autosave(); },
};
export function keyframe(prop: C.KfProp) {
  const c = sel1(); if (!c) return; const local = now() - c.start; if (local < 0 || local > c.dur) { toast(t("toast.playheadOutside"), "info"); return; }
  const has = (c.keyframes[prop] || []).some((k) => Math.abs(k.t - local) < 1e-3);
  run("keyframe", (p) => { const f = C.findClip(p, c.id)!; f.clip.keyframes = has ? C.removeKeyframe(f.clip.keyframes, prop, local) : C.setKeyframe(f.clip.keyframes, prop, local, C.propAt(f.clip, prop, local)); });
}
export function applyEffect(type: string) {
  const c = sel1(); if (c?.type !== "media") { toast(t("toast.pickClip"), "info"); return; }
  run("effect", (p) => { const m = C.findClip(p, c.id)!.clip as MediaClip; if (!m.effects.some((e) => e.type === type)) m.effects.push({ id: C.uid("e"), type, enabled: true, params: C.BOX_EFFECTS.has(type) ? { amount: 1, x: 0.35, y: 0.35, w: 0.3, h: 0.3 } : { amount: C.effectAmount(type) } }); });
  ui.set({ inspector: "effects" });
}
export function applyLook(id: string) {
  const c = sel1(); if (c?.type !== "media") { toast(t("toast.pickClip"), "info"); return; }
  const look = C.LOOKS.find((l) => l.id === id)!; run("look", (p) => { const m = C.findClip(p, c.id)!.clip as MediaClip; m.color = { ...C.color0(), ...look.set }; });
}
export function applyLut(assetId: string) {
  const c = sel1(); if (c?.type !== "media") { toast(t("toast.pickClip"), "info"); return; }
  run("lut", (p) => { const m = C.findClip(p, c.id)!.clip as MediaClip; m.lut = { asset: assetId, amount: 1 }; }); ui.set({ inspector: "color" });
}
export function applyTransition(type: string, clipId?: string) {
  const id = clipId || sel1()?.id; if (!id) { toast(t("toast.pickCut"), "info"); return; }
  const tr = run("transition", (p) => C.addTransition(p, id, type, 0.6));
  if (!tr) { editor.undo(); toast(t("toast.noNext"), "info"); } else toast(t("toast.transition"), "ok");
}
export function format(aspect: C.Aspect) {
  const { w, h } = C.frameSize(aspect, "1080p"); run("format", (p) => { p.width = w; p.height = h; }); playerRef.current?.resize();
}
export function textSet(path: string, value: unknown) { const c = sel1(); if (c?.type === "text") run("text", (p) => C.setPath(p, c.id, path, value)); }
export const isText = (c: Clip | null): c is TextClip => !!c && c.type === "text";
export function undo() { const l = editor.undo(); if (l) { autosave(); playerRef.current?.prune(); } }
export function redo() { const l = editor.redo(); if (l) autosave(); }
export function zoom(f: number) { ui.set((s) => ({ zoom: Math.max(4, Math.min(600, s.zoom * f)) })); }

// back to the middle at full size, not turned (position, size and turn keyframes go too; crop and flips stay)
export function resetTransform() {
  const c = sel1(); if (!c) return;
  run("reset position", (p) => { const f = C.findClip(p, c.id); if (!f) return; Object.assign(f.clip.transform, { x: 0, y: 0, scale: 1, rotation: 0 }); for (const k of ["x", "y", "scale", "rotation"] as const) delete f.clip.keyframes[k]; });
}
// a motion preset: ordinary keyframes on the picked clip (its x / y / scale / turn / opacity points are replaced)
export function applyMotion(id: string) {
  const c = sel1(); if (!c) { toast(t("toast.pickClip"), "info"); return; }
  run("motion", (p) => { const f = C.findClip(p, c.id); if (!f) return; for (const k of ["x", "y", "scale", "rotation", "opacity"] as const) delete f.clip.keyframes[k]; Object.assign(f.clip.keyframes, C.motionKeyframes(id, f.clip)); });
}

// a file made in the studio (sticker, logo, sound effect) → the library, then onto the overlay video track (V2) or the second
// sound track (A2) at the playhead, with a size / place / length of its own
export async function addMade(file: File, o: { kind: "overlay" | "sound"; dur?: number; scale?: number; x?: number; y?: number; at?: number }) {
  const r = await importFiles([file]); const a = r.assets[0]; if (!a) return null;
  const c = run(o.kind === "sound" ? "sound effect" : "sticker", (p) => {
    p.assets[a.id] = a;
    // the preferred track (V2 / A2) if it is free for that time, else another free one (never the main V1 for an overlay), else a
    // new track on top — so a logo for the whole video starts at 0 even when a sticker is already there
    const at = o.at ?? now(), len = o.dur || (a.kind === "image" ? 4 : a.duration || 1);
    const vids = p.tracks.filter((t) => t.kind === "video"), auds = p.tracks.filter((t) => t.kind === "audio"), main = vids[vids.length - 1];
    const pool = o.kind === "sound" ? [...auds.filter((t) => t.name === "A2"), ...auds.filter((t) => t.name !== "A2").reverse()] : [...vids.filter((t) => t.name === "V2"), ...vids.filter((t) => t.name !== "V2" && t !== main)];
    const tr = pool.find((t) => !t.locked && !C.overlaps(t, at, at + len)) || (o.kind === "sound" ? C.addTrack(p, "audio") : C.addTrack(p, "video", 0));
    const clip = C.addAssetClip(p, p.assets[a.id], at, tr.id);
    if (o.dur) clip.dur = o.dur; if (o.scale != null) clip.transform.scale = o.scale; if (o.x != null) clip.transform.x = o.x; if (o.y != null) clip.transform.y = o.y;
    return clip;
  });
  markPick(); editor.select([c.id]); playerRef.current?.resize(); return c;
}
// a logo / picture in a corner: its place worked out from the frame and the picture's own shape
export function cornerOf(p: Project, a: { w?: number; h?: number }, corner: "tl" | "tr" | "bl" | "br", scale = 0.18, margin = 0.035) {
  const W = p.width, H = p.height, w = a.w || 512, h = a.h || 512, k = Math.min(W / w, H / h), cw = (w * k * scale) / W, ch = (h * k * scale) / H;
  const x = 0.5 - cw / 2 - margin * (H / W), y = 0.5 - ch / 2 - margin;
  return { x: corner.endsWith("l") ? -x : x, y: corner.startsWith("t") ? -y : y };
}
export function placeCorner(corner: "tl" | "tr" | "bl" | "br") {
  const c = sel1(); if (c?.type !== "media") { toast(t("toast.pickClip"), "info"); return; }
  run("corner", (p) => { const f = C.findClip(p, c.id); if (!f || f.clip.type !== "media") return; const a = p.assets[f.clip.asset]; const s = f.clip.transform.scale < 0.6 ? f.clip.transform.scale : 0.18; Object.assign(f.clip.transform, { scale: s }, cornerOf(p, a || {}, corner, s)); });
}

// a split-screen collage: the picked video / picture clips (or the newest in the library) each fill a cell — cropped to the cell's
// shape, never stretched — on tracks of their own, from the playhead, as long as the shortest
export function splitScreen(cols: number, rows: number) {
  const n = cols * rows, p0 = editor.project;
  const picked = selected().filter((c) => c.type === "media" && ["video", "image"].includes(p0.assets[c.asset]?.kind || "")) as MediaClip[];
  const assets = picked.length ? picked.map((c) => p0.assets[c.asset]) : Object.values(p0.assets).filter((a) => a.kind === "video" || a.kind === "image").sort((a, b) => b.createdAt - a.createdAt);
  const use = assets.slice(0, n); if (!use.length) { toast(t("tpl.needClips"), "info"); return; }
  const start = now(), dur = Math.max(1, Math.min(...use.map((a) => (a.kind === "image" ? 5 : a.duration || 5))));
  const ids = run("split screen", (p) => {
    if (picked.length) C.deleteClips(p, picked.map((c) => c.id), false);
    const W = p.width, H = p.height, cwF = 1 / cols, chF = 1 / rows, A = (cwF * W) / (chF * H);
    return use.map((a, i) => {
      const tr = C.addTrack(p, "video", 0); const c = C.addAssetClip(p, p.assets[a.id] || a, start, tr.id) as MediaClip; c.dur = dur;
      const w = a.w || 1920, h = a.h || 1080; let l = 0, tp = 0;
      if (w / h > A) l = (1 - (h * A) / w) / 2; else tp = (1 - w / A / h) / 2;
      const cw = w * (1 - 2 * l), ch = h * (1 - 2 * tp), k = Math.min(W / cw, H / ch);
      const col = i % cols, row = Math.floor(i / cols);
      c.transform = { ...c.transform, crop: [l, tp, l, tp], scale: (cwF * W) / (cw * k), x: (col + 0.5) * cwF - 0.5, y: (row + 0.5) * chF - 0.5 };
      return c.id;
    });
  });
  editor.select(ids); playerRef.current?.resize();
  if (use.length < n) toast(t("tpl.more", { n: n - use.length }), "info");
}
// Instant mode: the library's videos and pictures one after another on V1 (3 s each) with cross dissolves
export function instantMontage() {
  const list = Object.values(editor.project.assets).filter((a) => a.kind === "video" || a.kind === "image").sort((a, b) => a.createdAt - b.createdAt).slice(0, 20);
  if (list.length < 2) { toast(t("tpl.needClips"), "info"); return; }
  const ids = run("instant montage", (p) => {
    const at0 = C.mainTrackEnd(p, "video"); let at = at0; const out: string[] = [];
    for (const a of list) { const c = C.addAssetClip(p, p.assets[a.id], at, null) as MediaClip; c.dur = Math.min(3, a.kind === "image" ? 3 : a.duration || 3); at = c.start + c.dur; out.push(c.id); }
    for (let i = 0; i < out.length - 1; i++) C.addTransition(p, out[i], "fade", 0.5);
    return out;
  });
  editor.select([]); toast(t("tpl.montaged", { n: ids.length }), "ok");
}
