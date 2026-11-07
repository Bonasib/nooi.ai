// (v243) Smart cut by the words said, the person followed when the shape changes, and the check before posting.
//  · Smart cut: the words are heard once on the server (the price shows first; the same words then serve captions and beat cuts);
//    the long pauses, the filler sounds (um, uh, امم, إيه…), the leaned-on words when asked (like, basically, يعني, طيب…) and the
//    retakes (the same opening said again — the earlier take goes) are listed for a look first; nothing is cut until you say so,
//    and the music keeps playing under the cuts.
//  · Follow the person: the person is found in each clip (on this device, MediaPipe's selfie segmenter) and the picture moves with
//    them — a steady move (a median, a dead zone, eased keyframes), never a jitter.
//  · Check before posting: the platform's shape, length, frame rate, its safe area (where its buttons and words sit) and the
//    loudness (−14 LUFS on the social platforms), each with its fix.
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { Btn, Icon } from "@nooi/ui";
import * as C from "@nooi/editor-core";
import type { Aspect, MediaClip, Project, Word } from "@nooi/editor-core";
import { api } from "../api";
import { editor, toast, ui, useProject, useUI, playerRef } from "../state";
import * as A from "../actions";
import { urlOf } from "../media/library";
import { mixSound } from "../engine/export";
import { encodeWav } from "../engine/wav";
import { finder, personConf } from "../media/cutout";

type Say = (k: string, o?: Record<string, unknown>) => string;
const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (s: number) => { const m = Math.floor(s / 60), x = s - m * 60; return m + ":" + (x < 10 ? "0" : "") + x.toFixed(1); };

// ---- the words of this edit (timeline seconds), heard once and kept while the edit is open
let WORDS: Word[] | null = null; const subs = new Set<() => void>();
export const words243 = () => WORDS;
export function setWords243(w: Word[] | null) { WORDS = w; subs.forEach((f) => f()); }
export function useWords() { const [, f] = useState(0); useEffect(() => { const g = () => f((x) => x + 1); subs.add(g); return () => { subs.delete(g); }; }, []); return WORDS; }
/** the edit's sound mixed, made small (16 kHz mono) and sent to be heard; the words and lines come back (charged only when words come back) */
export async function hearEdit(p: Project, lang: string): Promise<{ words: Word[]; lines: { s: number; e: number; text: string }[] }> {
  const d = C.duration(p); const ab = await mixSound(p, 0, d); const rate = 16000, n = Math.ceil(ab.duration * rate), off = new OfflineAudioContext(1, n, rate), s = off.createBufferSource(); s.buffer = ab; s.connect(off.destination); s.start();
  const small = await off.startRendering(); const url = await api.upload(encodeWav(small), "words.wav");
  const r = await api.req<{ words?: Word[]; lines?: { s: number; e: number; text: string }[] }>("/v1/captions169", { json: { url, lang } });
  const words = (r.words || []).filter((w) => w.w && w.e > w.s); setWords243(words); api.refresh(); return { words, lines: r.lines || [] };
}

// ---- Smart cut
const KINDS = ["pause", "filler", "retake"] as const;
export function SmartCut({ price }: { price: number | null | undefined }) {
  const { t } = useTranslation(); const p = useProject(); const lang = useUI((s) => s.lang); const words = useWords();
  const [o, setO] = useState({ pauses: true, fillers: true, soft: false, retakes: true, keepMusic: true, pause: 0.6 });
  const [off, setOff] = useState<Set<number>>(new Set()); const [busy, setBusy] = useState(false);
  const cuts = useMemo(() => (words ? C.findCuts(words, { ...o, dur: C.contentEnd(p) }) : []), [words, o.pauses, o.fillers, o.soft, o.retakes, o.pause]);
  useEffect(() => setOff(new Set()), [cuts]);
  const chosen = cuts.filter((_, i) => !off.has(i)); const secs = chosen.reduce((s, c) => s + c.b - c.a, 0);
  const hear = async () => { setBusy(true); try { const r = await hearEdit(editor.project, lang); toast(r.words.length ? t("sc.heard", { n: r.words.length }) : t("auto.r.noWords"), r.words.length ? "ok" : "warn"); }
    catch (e) { const er = e as { message?: string; errorAr?: string }; toast((lang === "ar" && er.errorAr) || er.message || t("ai.failed"), "warn"); } finally { setBusy(false); } };
  const apply = () => { if (!chosen.length || !words) return; const s = A.run("smart cut", (q) => C.applyCuts(q, chosen, { keepMusic: o.keepMusic })); setWords243(C.wordsAfter(words, chosen)); toast(t("sc.done", { n: chosen.length, s: s.toFixed(1) }), "ok"); };
  const box = (k: keyof typeof o, label: string) => <label className="sc-opt"><input type="checkbox" checked={!!o[k]} onChange={(e) => setO({ ...o, [k]: e.target.checked })} data-testid={"sc-" + k} />{label}</label>;
  if (!words) return <>
    <Btn icon="words" disabled={busy || price === null || !api.online} onClick={() => void hear()} testid="sc-hear">{busy ? t("auto.working") : price == null ? t("auto.capOff") : price ? t("sc.hearPrice", { n: price }) : t("sc.hearFree")}</Btn>
    <p className="hint">{t("sc.once")}</p></>;
  return <div className="sc" data-testid="sc-review">
    <div className="sc-opts">{box("pauses", t("sc.k.pause"))}{box("fillers", t("sc.k.filler"))}{box("soft", t("sc.soft"))}{box("retakes", t("sc.k.retake"))}{box("keepMusic", t("sc.keepMusic"))}</div>
    {!cuts.length ? <p className="hint okline" data-testid="sc-none">{t("sc.none")}</p> : <ul className="sc-list" data-testid="sc-list">{cuts.slice(0, 200).map((c, i) => <li key={i} className={"sc-" + c.kind + (off.has(i) ? " off" : "")} data-testid={"sc-cut-" + i}>
      <input type="checkbox" checked={!off.has(i)} aria-label={t("sc.keepThis")} onChange={() => { const n = new Set(off); n.has(i) ? n.delete(i) : n.add(i); setOff(n); }} />
      <em>{t("sc.k." + c.kind)}</em><button type="button" className="linkbtn" dir="ltr" onClick={() => playerRef.current?.seek(Math.max(0, c.a - 1))}>{fmt(c.a)}</button>
      <span dir="auto">{c.text || "…" + (c.b - c.a).toFixed(1) + "s"}</span></li>)}</ul>}
    <div className="sc-go"><Btn icon="cut" primary disabled={!chosen.length} onClick={apply} testid="sc-apply">{t("sc.apply", { n: chosen.length, s: secs.toFixed(1) })}</Btn>
      <button type="button" className="linkbtn" onClick={() => setWords243(null)} data-testid="sc-forget">{t("sc.again")}</button></div>
  </div>;
}

// ---- Follow the person (the shape changes, the picture moves with them)
async function seekTo(v: HTMLVideoElement, s: number) { await new Promise<void>((ok) => { const done = () => { v.removeEventListener("seeked", done); ok(); }; v.addEventListener("seeked", done); v.currentTime = s; setTimeout(done, 3000); }); }
/** where the person is across a clip: the middle of their mask (0..1 of the source width) at even steps of its source seconds.
 *  A wide picture is looked at in overlapping squares (the finder sees a small, far person far better that way). */
export async function personTrack(url: string, from: number, to: number, step: number, onStep?: (k: number) => void): Promise<{ s: number; x: number | null }[]> {
  const seg = await finder(); const v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.crossOrigin = "anonymous"; v.playsInline = true;
  await new Promise<void>((ok, no) => { v.onloadeddata = () => ok(); v.onerror = () => no(new Error("video")); v.src = url; setTimeout(() => no(new Error("timeout")), 15000); });
  const H = 256, W = Math.max(H, Math.round((H * (v.videoWidth || 16)) / (v.videoHeight || 9))); const cv = new OffscreenCanvas(W, H), x = cv.getContext("2d", { willReadFrequently: true })!;
  const S = Math.min(W, H), xs = W > S * 1.2 ? [0, Math.round((W - S) / 2), W - S] : [0]; const tile = new OffscreenCanvas(S, S), tx = tile.getContext("2d")!;
  const out: { s: number; x: number | null }[] = []; const n = Math.max(1, Math.floor((to - from) / step) + 1); const col = new Float32Array(W);
  for (let i = 0; i < n; i++) {
    const s = Math.min(to - 0.02, from + i * step); await seekTo(v, s); x.drawImage(v, 0, 0, W, H); col.fill(0);
    let cx: number | null = null;
    try {
      const best = new Float32Array(W * H);   // the most sure of the squares at each point
      for (const x0 of xs) { tx.drawImage(cv, x0, 0, S, S, 0, 0, S, S); const m = personConf(seg, tile); if (!m) continue;
        for (let yy = 0; yy < S; yy++) { const my = Math.min(m.h - 1, Math.floor((yy * m.h) / S)); for (let xx = 0; xx < S; xx++) { const v2 = m.f[my * m.w + Math.min(m.w - 1, Math.floor((xx * m.w) / S))]; const k = yy * W + x0 + xx; if (v2 > best[k]) best[k] = v2; } } }
      let sum = 0, sx = 0; for (let k = 0; k < best.length; k++) { const w = best[k] - 0.4; if (w > 0) { sum += w; sx += w * (k % W); } }
      if (sum > W * H * 0.002) cx = sx / sum / W;
    } catch { cx = null; }
    out.push({ s, x: cx }); onStep?.((i + 1) / n);
  }
  v.removeAttribute("src"); v.load(); return out;
}
/** a steady path from the found places: gaps filled, a median of five, a dead zone (small moves ignored), then only the real moves kept */
export function steadyPath(raw: (number | null)[], dead = 0.05): number[] {
  const n = raw.length; if (!n) return []; let last = raw.find((v) => v != null) ?? 0.5; const filled = raw.map((v) => (v == null ? last : (last = v)));
  const med = filled.map((_, i) => { const w = filled.slice(Math.max(0, i - 2), Math.min(n, i + 3)).sort((a, b) => a - b); return w[w.length >> 1]; });
  const out: number[] = []; let hold = med[0]; for (const v of med) { if (Math.abs(v - hold) > dead) hold = v; out.push(hold); } return out;
}
/** the frame changed to a new shape and every video clip moved with the person in it (pictures and wide clips without one keep the middle) */
export async function followPerson(t: Say, aspect: Aspect, onStep?: (k: number) => void): Promise<string> {
  A.format(aspect); const p = editor.project, F = p.width / p.height;
  const list = p.tracks.flatMap((tr) => tr.clips).filter((c) => c.type === "media" && p.assets[(c as MediaClip).asset]?.kind === "video") as MediaClip[]; if (!list.length) return t("auto.r.noClips");
  const plan: Record<string, { scale: number; keys: C.Keyframe[] }> = {}; let found = 0, done = 0;
  for (const c of list.slice(0, 12)) {
    const a = p.assets[c.asset]; if (!a.w || !a.h) continue; const k = a.w / a.h, scale = r2(Math.max(k / F, F / k)), Wd = scale * Math.min(1, k / F);
    const url = await urlOf(a); if (!url) continue; const len = c.dur * c.speed, step = Math.max(0.25, len / 80);
    const tr = await personTrack(url, c.in, c.in + len, step, (q) => onStep?.((done + q) / Math.min(12, list.length))); done++;
    if (!tr.some((x) => x.x != null)) { plan[c.id] = { scale, keys: [] }; continue; } found++;
    const path = steadyPath(tr.map((x) => x.x)); const lim = Math.max(0, (Wd - 1) / 2); const keys: C.Keyframe[] = [];
    path.forEach((cx, i) => { const v = r2(Math.max(-lim, Math.min(lim, -(cx - 0.5) * Wd))); const tt = r2(Math.min(c.dur, (tr[i].s - c.in) / c.speed));
      if (!keys.length || Math.abs(keys[keys.length - 1].v - v) > 0.005) keys.push({ t: tt, v, ease: "easeInOut" }); });
    plan[c.id] = { scale, keys };
  }
  A.run("auto: follow the person", (q) => { for (const tr of q.tracks) for (const c of tr.clips) { const pl = plan[c.id]; if (!pl) continue;
    c.transform = { ...c.transform, x: pl.keys[0]?.v ?? 0, y: 0, scale: pl.scale }; const kf = { ...c.keyframes }; if (pl.keys.length > 1) kf.x = pl.keys; else delete kf.x; c.keyframes = kf; } });
  return t("fp.done", { n: found, a: aspect });
}

// ---- Check before posting
export function CheckPost() {
  const { t } = useTranslation(); const p = useProject(); const lang = useUI((s) => s.lang); const safePl = useUI((s) => s.safePl);
  const [pid, setPid] = useState("tiktok"); const pl = C.PLATFORMS.find((x) => x.id === pid)!;
  const [snd, setSnd] = useState<{ lufs: number; peak: number } | null>(null); const [busy, setBusy] = useState(false);
  const issues = C.checkProject(p, pl, { lufs: snd?.lufs ?? null, peak: snd?.peak ?? null });
  const hearIt = async () => { setBusy(true); try { const d = C.duration(p); if (!d) return; const ab = await mixSound(editor.project, 0, d); const ch = Array.from({ length: ab.numberOfChannels }, (_, i) => ab.getChannelData(i)); setSnd({ lufs: C.lufs(ch, ab.sampleRate), peak: C.peakDb(ch) }); } finally { setBusy(false); } };
  const even = () => { if (!snd) return; const g = C.loudGain(snd.lufs, snd.peak, pl.lufs); let capped = false;
    A.run("loudness to " + pl.lufs + " LUFS", (q) => { for (const tr of q.tracks) for (const c of tr.clips) if (c.type === "media") { const v = c.volume * g; if (v > 2) capped = true; c.volume = r2(Math.max(0, Math.min(2, v))); } });
    const room = Math.round((-1 - snd.peak) * 10) / 10, want = pl.lufs - snd.lufs; setSnd(null);
    toast(capped ? t("chk.capped") : want > room + 0.2 ? t("chk.peakHeld", { n: room }) : t("chk.evened", { n: pl.lufs }), capped || want > room + 0.2 ? "warn" : "ok"); };
  const say = (i: C.Issue) => t("chk.i." + i.code, { n: i.n, p: lang === "ar" ? pl.nameAr : pl.name, l: pl.lufs });
  return <div className="chk" data-testid="chk">
    <label className="ns-field"><span>{t("chk.for")}</span><select className="ns-input" value={pid} onChange={(e) => { setPid(e.target.value); setSnd(null); if (safePl) ui.set({ safePl: e.target.value }); }} data-testid="chk-pl">{C.PLATFORMS.map((x) => <option key={x.id} value={x.id}>{lang === "ar" ? x.nameAr : x.name}</option>)}</select></label>
    <ul className="chk-list" data-testid="chk-issues">{issues.map((i, k) => <li key={k} className={"chk-" + i.level} data-testid={"chk-i-" + i.code}><Icon name={i.level === "ok" ? "check" : "marker"} size={14} /><span dir="auto">{say(i)}</span>
      {i.code === "aspect" && <button type="button" className="linkbtn" onClick={() => A.format(pl.aspect as Aspect)} data-testid="chk-fix-aspect">{t("chk.fixAspect", { a: pl.aspect })}</button>}
      {i.code === "unsafe" && i.clip && <button type="button" className="linkbtn" onClick={() => A.run("into the safe area", (q) => { const f = C.findClip(q, i.clip!); if (f) f.clip.transform = { ...f.clip.transform, x: 0, y: Math.max(-0.5 + pl.safe.top + 0.08, Math.min(0.5 - pl.safe.bottom - 0.08, 0.5 - pl.safe.bottom - 0.12)) }; })} data-testid="chk-fix-safe">{t("chk.fixSafe")}</button>}
      {(i.code === "loud" || i.code === "peak") && <button type="button" className="linkbtn" onClick={even} data-testid="chk-fix-loud">{t("chk.fixLoud", { n: pl.lufs })}</button>}
    </li>)}</ul>
    <div className="chk-go">
      <Btn icon="volume" disabled={busy || !C.duration(p)} onClick={() => void hearIt()} testid="chk-hear">{busy ? t("auto.working") : snd ? t("chk.heard", { l: snd.lufs, p: snd.peak }) : t("chk.hear")}</Btn>
      <Btn icon="fit" pressed={safePl === pid} onClick={() => ui.set({ safePl: safePl === pid ? null : pid })} testid="chk-safe">{t("chk.safe")}</Btn>
    </div>
  </div>;
}
/** the platform's safe area drawn over the preview (where its buttons, name and caption sit) */
export function SafeArea() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const id = useUI((s) => s.safePl); const pl = id ? C.PLATFORMS.find((x) => x.id === id) : null; if (!pl) return null; const s = pl.safe, pc = (v: number) => (v * 100).toFixed(1) + "%";
  return <div className="safe243" aria-hidden="true" data-testid="safe243"><i style={{ inset: `${pc(s.top)} ${pc(s.right)} ${pc(s.bottom)} ${pc(s.left)}` }} /><b style={{ height: pc(s.bottom) }}>{t("chk.under", { p: lang === "ar" ? pl.nameAr : pl.name })}</b><u style={{ width: pc(s.right), bottom: pc(s.bottom) }} /></div>;
}
