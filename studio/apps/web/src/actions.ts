// What the buttons, the keys and ⌘K do — one place, so every way of asking does the same thing (and is one undo step).
import * as C from "@nooi/editor-core";
import type { Asset, Clip, MediaClip, Project, TextClip } from "@nooi/editor-core";
import i18n from "./i18n";
import { autosave, editor, playerRef, toast, ui } from "./state";

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
  editor.select([c.id]); ui.set({ inspector: "text" }); return c;
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
  run("effect", (p) => { const m = C.findClip(p, c.id)!.clip as MediaClip; if (!m.effects.some((e) => e.type === type)) m.effects.push({ id: C.uid("e"), type, enabled: true, params: { amount: C.effectAmount(type) } }); });
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
