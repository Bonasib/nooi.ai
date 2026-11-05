// (v233) Auto: the tools that edit by themselves — one tap each, one undo step each, made on this device from the edit's own
// pictures and sound (only Auto captions asks the server to hear the words; its price shows first). Each card plays a small
// example of what it does.
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Btn, Icon, Seg } from "@nooi/ui";
import * as C from "@nooi/editor-core";
import type { Aspect, MediaClip, Project, Track } from "@nooi/editor-core";
import { addTrack, textClip, textStyle0 } from "@nooi/editor-core";
import { api } from "../api";
import { editor, toast, ui, useProject, useUI } from "../state";
import * as A from "../actions";
import { quietRanges } from "../mate";
import { decodeSound, fileOf, monoOf, urlOf } from "../media/library";
import { mixSound } from "../engine/export";
import { encodeWav } from "../engine/wav";

type Say = (k: string, o?: Record<string, unknown>) => string;
const media = (p: Project) => p.tracks.flatMap((t) => t.clips.map((c) => ({ t, c }))).filter((x) => x.c.type === "media") as { t: Track; c: MediaClip }[];
export const mainTrack = (p: Project) => C.spineOf(p) || p.tracks.filter((t) => t.kind === "video").slice(-1)[0] || null;
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---- the tools (each returns what it did, in words)
/** the pauses (quiet for over half a second) taken out of the main track's clips */
export async function autoPauses(t: Say): Promise<string> {
  const r = await quietRanges(0.5); if (!r.length) return t("auto.r.noPauses");
  A.run("auto: remove pauses", (p) => { for (const [x, y] of r) C.cutRange(p, x, y); }); return t("auto.r.pauses", { n: r.length, s: r.reduce((s, [x, y]) => s + y - x, 0).toFixed(1) });
}
/** the music's beats found, and the main track's clips trimmed so every cut lands on a beat */
export async function autoBeat(t: Say): Promise<string> {
  const p = editor.project; const music = media(p).filter((x) => x.t.kind === "audio" && p.assets[x.c.asset]?.kind === "audio").sort((a, b) => b.c.dur - a.c.dur)[0];
  if (!music) return t("auto.r.noMusic");
  const a = p.assets[music.c.asset], f = await fileOf(a), ab = f && (await decodeSound(f)); if (!ab) return t("auto.r.noMusic");
  const src = C.beats(monoOf(ab), ab.sampleRate, { minGap: 0.28 }), m = music.c;
  const times = src.map((b) => m.start + (b - m.in) / m.speed).filter((x) => x >= m.start && x <= C.clipEnd(m));
  if (times.length < 2) return t("auto.r.noBeats");
  const tr = mainTrack(p); const n = tr ? tr.clips.filter((c) => c.type === "media").length : 0; if (!n) return t("auto.r.noClips");
  let cuts = 0;
  A.run("auto: cut to the beat", (q) => {
    q.beats = times.map(r2); const tk = q.tracks.find((x) => x.id === tr!.id); if (!tk) return;
    const list = [...tk.clips].sort((x, y) => x.start - y.start); let at = list[0].start;
    for (const c of list) {
      const end = [...times].reverse().find((b) => b <= at + c.dur + 1e-6 && b >= at + 0.45);   // the last beat inside the clip (it only gets shorter)
      c.start = r2(at); if (end != null) { c.dur = Math.max(0.2, end - at); cuts++; } at = c.start + c.dur;
    }
  });
  return t("auto.r.beat", { n: cuts, b: times.length });
}
/** every picture filled to the frame in a new shape (the middle kept) */
export function autoReframe(t: Say, aspect: Aspect): string {
  A.format(aspect); const p = editor.project, F = p.width / p.height; let n = 0;
  A.run("auto: reframe", (q) => { for (const { c } of media(q)) { const a = q.assets[c.asset]; if (!a || a.kind === "audio" || !a.w || !a.h) continue; const k = a.w / a.h;
    c.transform = { ...c.transform, x: 0, y: 0, scale: r2(Math.max(k / F, F / k)) }; n++; } });
  return t("auto.r.reframe", { n, a: aspect });
}
async function frameOf(src: string, video: boolean, at: number): Promise<ImageData | null> {
  const cv = Object.assign(document.createElement("canvas"), { width: 48, height: 27 }), x = cv.getContext("2d", { willReadFrequently: true })!;
  try {
    if (video) { const v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.crossOrigin = "anonymous";
      await new Promise<void>((ok, no) => { v.onloadeddata = () => ok(); v.onerror = () => no(); v.src = src; setTimeout(no, 8000); });
      await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = Math.min(at, Math.max(0, (v.duration || 1) - 0.05)); setTimeout(ok, 3000); }); x.drawImage(v, 0, 0, 48, 27); }
    else { const im = new Image(); im.crossOrigin = "anonymous"; await new Promise<void>((ok, no) => { im.onload = () => ok(); im.onerror = () => no(); im.src = src; }); x.drawImage(im, 0, 0, 48, 27); }
    return x.getImageData(0, 0, 48, 27);
  } catch { return null; }
}
/** the colour of each clip balanced from its own middle frame: brightness, contrast, colour strength and a colour cast */
export async function autoColor(t: Say): Promise<string> {
  const p = editor.project, fix: Record<string, Partial<MediaClip["color"]>> = {};
  for (const { c } of media(p).slice(0, 40)) {
    const a = p.assets[c.asset]; if (!a || a.kind === "audio") continue; const u = await urlOf(a); if (!u) continue;
    const d = await frameOf(u, a.kind === "video", c.in + (c.dur * c.speed) / 2); if (!d) continue;
    let L = 0, L2 = 0, S = 0, R = 0, B = 0; const n = d.data.length / 4;
    for (let i = 0; i < d.data.length; i += 4) { const r = d.data[i] / 255, g = d.data[i + 1] / 255, b = d.data[i + 2] / 255, l = 0.2126 * r + 0.7152 * g + 0.0722 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      L += l; L2 += l * l; S += mx ? (mx - mn) / mx : 0; R += r; B += b; }
    L /= n; S /= n; R /= n; B /= n; const sd = Math.sqrt(Math.max(0, L2 / n - L * L));
    fix[c.id] = { exposure: r2(cl((0.48 - L) * 1.3, -0.6, 0.6)), contrast: r2(cl((0.22 - sd) * 2.2, -0.4, 0.5)), saturation: r2(cl((0.32 - S) * 1.2, -0.3, 0.45)), temperature: r2(cl((R - B) * -0.9, -0.4, 0.4)) };
  }
  const ids = Object.keys(fix); if (!ids.length) return t("auto.r.noClips");
  A.run("auto: colour", (q) => { for (const { c } of media(q)) if (fix[c.id]) c.color = { ...c.color, ...fix[c.id] }; });
  return t("auto.r.color", { n: ids.length });
}
/** the music lowered under the voices: the main track's sound and the voice tracks are the voices, the longest sound is the music */
export function autoDuck(t: Say): string {
  const p = editor.project; const tr = mainTrack(p); const aud = p.tracks.filter((x) => x.kind === "audio" && x.clips.length);
  const music = media(p).filter((x) => x.t.kind === "audio").sort((a, b) => b.c.dur - a.c.dur)[0]?.t;
  const voices = [...(tr && tr.clips.some((c) => c.type === "media" && p.assets[c.asset]?.hasAudio !== false) ? [tr.id] : []), ...aud.filter((x) => x !== music).map((x) => x.id)];
  if (!music || !voices.length) return t("auto.r.noDuck");
  A.run("auto: duck the music", (q) => { q.ducking = { ...q.ducking, enabled: true, amount: q.ducking.amount || 0.7, voiceTracks: voices }; });
  return t("auto.r.duck", { n: voices.length });
}
/** every clip's sound brought to the same loudness (its loudest moment near the top, nothing clipped) */
export function autoLoud(t: Say): string {
  const p = editor.project, vol: Record<string, number> = {};
  for (const { c } of media(p)) { const a = p.assets[c.asset]; const w = a?.waveform; if (!w?.length || !a?.duration) continue;
    const i0 = Math.floor((c.in / a.duration) * w.length), i1 = Math.max(i0 + 1, Math.ceil(((c.in + c.dur * c.speed) / a.duration) * w.length)); let pk = 0; for (let i = i0; i < Math.min(i1, w.length); i++) pk = Math.max(pk, w[i]);
    if (pk > 0.01) vol[c.id] = r2(cl(0.85 / pk, 0.3, 2)); }
  const ids = Object.keys(vol); if (!ids.length) return t("auto.r.noSound");
  A.run("auto: even loudness", (q) => { for (const { c } of media(q)) if (vol[c.id] != null) c.volume = vol[c.id]; }); return t("auto.r.loud", { n: ids.length });
}
/** a soft cross-dissolve at every cut of the main track */
export function autoTransitions(t: Say): string {
  const p = editor.project; const tr = mainTrack(p); if (!tr) return t("auto.r.noClips");
  const list = [...tr.clips].sort((a, b) => a.start - b.start); let n = 0;
  A.run("auto: transitions", (q) => { for (let i = 0; i < list.length - 1; i++) { if (Math.abs(C.clipEnd(list[i]) - list[i + 1].start) > 0.05 || q.transitions.some((x) => x.a === list[i].id)) continue; if (C.addTransition(q, list[i].id, "fade", 0.5)) n++; } });
  return n ? t("auto.r.trans", { n }) : t("auto.r.noCuts");
}
/** the words said, heard on the server (the price first), placed as captions at their times */
export async function captionsPrice(dur: number) { try { const r = await api.req<{ ready: boolean; cost: number; maxMin?: number }>("/v1/captions169?dur=" + Math.ceil(dur)); return r.ready ? r.cost : null; } catch { return null; } }
export async function autoCaptions(t: Say, lang: string): Promise<string> {
  const p = editor.project, d = C.duration(p); if (!d) return t("auto.r.noClips");
  const ab = await mixSound(p, 0, d); const rate = 16000, n = Math.ceil(ab.duration * rate), off = new OfflineAudioContext(1, n, rate), s = off.createBufferSource(); s.buffer = ab; s.connect(off.destination); s.start();
  const small = await off.startRendering(); const url = await api.upload(encodeWav(small), "captions.wav");
  const r = await api.req<{ lines?: { s: number; e: number; text: string }[] }>("/v1/captions169", { json: { url, lang } }); const lines = (r.lines || []).filter((l) => l.text && l.text.trim());
  if (!lines.length) return t("auto.r.noWords");
  A.run("auto: captions", (q) => { const tr = addTrack(q, "text", 0); tr.name = t("cap.track");
    for (const l of lines) C.addClip(q, textClip(l.text.trim(), l.s, { template: "caption", dur: Math.max(0.3, l.e - l.s), style: textStyle0({ size: 0.055, box: { color: "#000000", opacity: 0.55, pad: 0.25, radius: 0.2 } }), animIn: { type: "fade", dur: 0.12 }, animOut: { type: "fade", dur: 0.12 } }), tr.id); });
  api.refresh(); return t("auto.r.captions", { n: lines.length });
}

// ---- the panel
const TOOLS = ["pauses", "beat", "captions", "reframe", "color", "loud", "duck", "trans"] as const;
type Tool = (typeof TOOLS)[number];
const ICON: Record<Tool, string> = { pauses: "cut", beat: "beat", captions: "captions", reframe: "crop", color: "color", loud: "volume", duck: "audio", trans: "transitions" };
export function AutoPanel() {
  const { t } = useTranslation(); const p = useProject(); const lang = useUI((s) => s.lang); const [busy, setBusy] = useState<string>(""); const [done, setDone] = useState<Record<string, string>>({});
  const [aspect, setAspect] = useState<Aspect>("9:16"); const [capCost, setCapCost] = useState<number | null | undefined>(undefined); const d = C.duration(p);
  useEffect(() => { let live = true; if (!api.online || !api.me.signedIn || !d) { setCapCost(null); return; } void captionsPrice(d).then((c) => live && setCapCost(c)); return () => { live = false; }; }, [Math.ceil(d)]);
  const run = async (k: Tool | "all") => {
    setBusy(k);
    try {
      const say: Say = (key, o) => t(key, o);
      const one = async (x: Tool) => x === "pauses" ? autoPauses(say) : x === "beat" ? autoBeat(say) : x === "captions" ? autoCaptions(say, lang) : x === "reframe" ? autoReframe(say, aspect) : x === "color" ? autoColor(say) : x === "loud" ? autoLoud(say) : x === "duck" ? autoDuck(say) : autoTransitions(say);
      if (k === "all") { const out: Record<string, string> = {}; for (const x of ["pauses", "loud", "color", "duck", "trans"] as Tool[]) out[x] = await one(x); setDone((s) => ({ ...s, ...out })); toast(t("auto.allDone"), "ok"); }
      else { const m = await one(k); setDone((s) => ({ ...s, [k]: m })); toast(m, "ok"); }
    } catch (e) { const er = e as { message?: string; errorAr?: string }; toast((lang === "ar" && er.errorAr) || er.message || t("ai.failed"), "warn"); }
    finally { setBusy(""); }
  };
  const empty = !media(p).length;
  return (<div className="autop" data-testid="auto-panel">
    <p className="hint">{t("auto.hint")}</p>
    {empty && <p className="hint warnline">{t("auto.empty")}</p>}
    <div className="autoall"><Btn icon="wand" primary disabled={!!busy || empty} onClick={() => void run("all")} testid="auto-all">{busy === "all" ? t("auto.working") : t("auto.all")}</Btn><small>{t("auto.allSays")}</small></div>
    <div className="autogrid">{TOOLS.map((k) => <div key={k} className="autoc" data-testid={"auto-" + k}>
      <div className={"autodemo ad-" + k} aria-hidden="true"><i /><i /><i /><i /><i /><b /></div>
      <div className="autot"><Icon name={ICON[k]} size={16} /><b>{t("auto." + k)}</b></div>
      <p className="hint">{t("auto." + k + "D")}</p>
      {k === "reframe" && <Seg label={t("auto.shape")} value={aspect} onChange={(v) => setAspect(v as Aspect)} options={(["9:16", "1:1", "4:5", "16:9"] as Aspect[]).map((v) => ({ v, label: v }))} />}
      <Btn icon={ICON[k]} disabled={!!busy || empty || (k === "captions" && (capCost === null || !api.online))} onClick={() => void run(k)} testid={"auto-go-" + k}>
        {busy === k ? t("auto.working") : k === "captions" ? (capCost == null ? t("auto.capOff") : capCost ? t("auto.goPrice", { n: capCost }) : t("auto.goFree")) : t("auto.go")}</Btn>
      {done[k] && <p className="hint okline" data-testid={"auto-done-" + k}>{done[k]} · <button type="button" className="linkbtn" onClick={() => A.undo()}>{t("auto.undo")}</button></p>}
    </div>)}</div>
  </div>);
}
export const openAuto = () => ui.set({ rail: "auto" as never, panelOpen: true });
