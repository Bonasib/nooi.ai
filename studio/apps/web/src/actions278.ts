// (v278) the pro actions: adjustment layers, curves & colour wheels, the clip's sound (EQ · voice · compressor), per-track
// ducking, preview proxies and quality, stabilise (on the server's processor, no GPU), and nest / un-nest.
import * as C from "@nooi/editor-core";
import type { Asset, AudioFx, Curves, MediaClip, Wheels } from "@nooi/editor-core";
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, QUALITY_MEDIUM, WebMOutputFormat, getFirstEncodableVideoCodec } from "mediabunny";
import { editor, playerRef, toast, ui } from "./state";
import * as A from "./actions";
import i18n from "./i18n";
const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, o) as string;
import { api } from "./api";
import { fileOf, importFiles, uploadAsset, serverPath } from "./media/library";
import { putFile } from "./media/idb";
import { exportProject } from "./engine/export";

const clipOf = (id: string) => { const f = C.findClip(editor.project, id); return f && f.clip.type === "media" ? (f.clip as MediaClip) : null; };
const sel = () => { const c = A.sel1(); if (c?.type !== "media") { toast(t("toast.pickClip"), "info"); return null; } return c as MediaClip; };

// ---- adjustment layer: a see-through clip on a track above; its colour and effects change everything under it
export async function addAdjust() {
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 36; const x = cv.getContext("2d")!; x.clearRect(0, 0, 64, 36);
  const b = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/png")); if (!b) return;
  const c = await A.addMade(new File([b], t("pro2.adjust") + ".png", { type: "image/png" }), { kind: "overlay", dur: 5 }); if (!c) return;
  A.run("adjustment layer", (p) => { const f = C.findClip(p, c.id); if (f && f.clip.type === "media") { (f.clip as MediaClip).adjust = true; f.clip.name = t("pro2.adjust"); } });
  ui.set({ inspector: "color" }); toast(t("pro2.adjustAdded"), "ok");
}

// ---- curves & wheels
export const CURVE0 = (): Curves => ({ l: [0, 0.25, 0.5, 0.75, 1], r: [0, 0.25, 0.5, 0.75, 1], g: [0, 0.25, 0.5, 0.75, 1], b: [0, 0.25, 0.5, 0.75, 1] });
export const WHEEL0 = (): Wheels => ({ lift: [0, 0, 0], gamma: [0, 0, 0], gain: [0, 0, 0] });
export function resetCurves(id: string) { A.run("curves", (p) => { const f = C.findClip(p, id); if (f && f.clip.type === "media") f.clip.color.curves = null; }); }
export function resetWheels(id: string) { A.run("wheels", (p) => { const f = C.findClip(p, id); if (f && f.clip.type === "media") f.clip.color.wheels = null; }); }

// ---- the clip's sound
export const AFX0 = (): AudioFx => ({ eq: [0, 0, 0], voice: "none", comp: false });
export function setAfx(id: string, f: (x: AudioFx) => void, label = "sound") { A.run(label, (p) => { const g = C.findClip(p, id); if (g && g.clip.type === "media") { const m = g.clip as MediaClip; const x = m.afx ? { ...m.afx, eq: [...m.afx.eq] as [number, number, number] } : AFX0(); f(x); m.afx = x; } }); }
export function setTrackDuck(trackId: string, v: number | null) { A.run("duck", (p) => { const tr = p.tracks.find((x) => x.id === trackId); if (tr) tr.duck = v; }); }

// ---- proxies: a small copy (540p) made on this device for smooth preview; the export and the server keep the original
const busy = new Set<string>();
export const proxyBusy = (id: string) => busy.has(id);
export async function makeProxy(assetId: string, onProgress?: (k: number) => void): Promise<boolean> {
  const a = editor.project.assets[assetId]; if (!a || a.kind !== "video" || busy.has(assetId)) return false; busy.add(assetId); ui.set({});
  try {
    const f = await fileOf(a); if (!f) throw new Error("file");
    const input = new Input({ source: new BlobSource(f), formats: ALL_FORMATS }); const vt = await input.getPrimaryVideoTrack(); if (!vt) throw new Error("video");
    const k = Math.min(1, 540 / Math.min(vt.displayWidth, vt.displayHeight)), w = Math.round((vt.displayWidth * k) / 2) * 2, h = Math.round((vt.displayHeight * k) / 2) * 2;
    let format: WebMOutputFormat | Mp4OutputFormat = new WebMOutputFormat(); let codec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: w, height: h });
    if (!codec) { format = new Mp4OutputFormat({ fastStart: "in-memory" }); codec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: w, height: h }); }
    if (!codec) throw new Error("encoder");
    const out = new Output({ format, target: new BufferTarget() });
    const conv = await Conversion.init({ input, output: out, showWarnings: false, video: { codec, width: w, height: h, fit: "fill", bitrate: QUALITY_MEDIUM, keyFrameInterval: 1, forceTranscode: true } });
    if (!conv.isValid) throw new Error("read");
    conv.onProgress = (q) => onProgress?.(q); await conv.execute();
    const blob = new Blob([(out.target as BufferTarget).buffer!], { type: format instanceof WebMOutputFormat ? "video/webm" : "video/mp4" });
    const key = "p_" + a.id; await putFile(key, blob);
    A.run("proxy", (p) => { const x = p.assets[a.id]; if (x) x.proxy = "local:" + key; });
    playerRef.current?.redraw(); toast(t("pro2.proxyMade"), "ok"); return true;
  } catch (e) { toast(t("pro2.proxyFail") + (e instanceof Error && e.message ? " (" + e.message + ")" : ""), "warn"); return false; }
  finally { busy.delete(assetId); ui.set({}); }
}
export function dropProxy(assetId: string) { A.run("proxy", (p) => { const x = p.assets[assetId]; if (x) delete x.proxy; }); playerRef.current?.redraw(); }

// ---- stabilise: the clip's part goes to the server's processor (ffmpeg vidstab, CPU) and comes back steady
export async function stabilise(strength = 2) {
  const c = sel(); if (!c) return; const a = editor.project.assets[c.asset]; if (!a || a.kind !== "video") { toast(t("pro2.stabVideo"), "info"); return; }
  if (!api.online || !api.me.signedIn) { toast(t("pro2.stabSignin"), "info"); return; }
  ui.set({ stab278: c.id } as never);
  try {
    let url = serverPath(a.src);
    if (!url) { const up = await uploadAsset(a); url = up ? serverPath(up) || up : null; }
    if (!url) throw new Error(t("pro2.stabUpload"));
    const r = await api.req<{ id: string; url: string; dur: number }>("/v1/edit147/stabilise", { json: { url, from: c.in, to: c.in + c.dur * c.speed, strength, title: a.name } });
    const na: Asset = { id: C.uid("a"), kind: "video", name: a.name + " · " + t("pro2.steady"), src: serverPath(r.url) || r.url, duration: r.dur, w: a.w, h: a.h, hasAudio: a.hasAudio, createdAt: Date.now() };
    A.run("stabilise", (p) => { p.assets[na.id] = na; const f = C.findClip(p, c.id); if (f && f.clip.type === "media") { const m = f.clip as MediaClip; m.steadyOf = m.asset; m.asset = na.id; m.in = 0; } });
    toast(t("pro2.stabDone"), "ok");
  } catch (e) { toast(t("pro2.stabFail") + (e instanceof Error && e.message ? " — " + e.message : ""), "warn"); }
  finally { ui.set({ stab278: null } as never); }
}
export function unstabilise(id: string) { A.run("stabilise", (p) => { const f = C.findClip(p, id); if (f && f.clip.type === "media") { const m = f.clip as MediaClip; if (m.steadyOf) { m.asset = m.steadyOf; m.steadyOf = null; } } }); }

// ---- nest: the picked clips (any tracks) become one clip made from them; un-nest puts them back
export async function nest(onProgress?: (k: number) => void) {
  const ids = editor.selection.filter((id) => C.findClip(editor.project, id)); if (ids.length < 2) { toast(t("pro2.nestPick"), "info"); return; }
  const r = C.nestRange278(editor.project, ids); if (!r) return;
  ui.set({ nest278: true } as never);
  try {
    const only = C.nestOnly278(editor.project, ids);
    const res = await exportProject(only, { ...editor.project.export, format: "webm", res: "720p", quality: "high", range: [r.start, r.end], onProgress: (k) => onProgress?.(k) });
    const file = new File([res.blob], t("pro2.nested") + ".webm", { type: res.blob.type });
    const im = await importFiles([file]); const a = im.assets[0]; if (!a) throw new Error("import");
    a.name = t("pro2.nested") + " · " + ids.length;
    let nid: string | null = null;
    A.run("nest", (p) => { p.assets[a.id] = a; nid = C.nest278(p, ids, a.id, (o) => ({ ...C.mediaClip(a, r.start), ...o, name: a.name }) as MediaClip); });
    if (nid) editor.select([nid]); toast(t("pro2.nestDone"), "ok");
  } catch (e) { toast(t("pro2.nestFail") + (e instanceof Error && e.message ? " — " + e.message : ""), "warn"); }
  finally { ui.set({ nest278: false } as never); }
}
export function unnest(id: string) { let back: string[] = []; A.run("un-nest", (p) => { back = C.unnest278(p, id); }); if (back.length) editor.select(back); }
export const isNested = (id: string) => !!clipOf(id)?.nested;
