// (v278) colour grading the way the big editors do it — curves, colour wheels and live scopes — plus the clip's sound
// (EQ, 12 voices, compressor), the pro clip tools (stabilise, preview copy, nest) and the timeline's pro buttons.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Icon, Slider } from "@nooi/ui";
import { VOICES278, findClip } from "@nooi/editor-core";
import type { Curves, MediaClip, Wheels } from "@nooi/editor-core";
import { editor, playerRef, useProject, useUI } from "../state";
import * as A from "../actions";
import * as P from "../actions278";
import i18n from "../i18n";
const i18nB = () => i18n.t("pro2.bright") as string;

// ---------------- curves: master + red, green, blue; five points you drag up and down
const CH: { k: keyof Curves; col: string }[] = [{ k: "l", col: "#e8e8e8" }, { k: "r", col: "#ff5a5a" }, { k: "g", col: "#4fd47a" }, { k: "b", col: "#5a9bff" }];
function cr(pts: number[], x: number) { const f = Math.min(3.999, Math.max(0, x * 4)), i = Math.floor(f), t = f - i; const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, 4)];
  return Math.max(0, Math.min(1, 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))); }
export function CurvesEditor({ c }: { c: MediaClip }) {
  const { t } = useTranslation(); const [ch, setCh] = useState<keyof Curves>("l"); const svg = useRef<SVGSVGElement>(null); const drag = useRef<number | null>(null);
  const cu = c.color.curves || P.CURVE0(); const S = 200;
  const move = (e: React.PointerEvent, i: number) => {
    const r = svg.current!.getBoundingClientRect(); const v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    const next: Curves = { l: [...cu.l], r: [...cu.r], g: [...cu.g], b: [...cu.b] }; next[ch][i] = Math.round(v * 1000) / 1000; A.live.set("color.curves", next);
  };
  const path = (pts: number[]) => { let d = ""; for (let i = 0; i <= 40; i++) { const x = i / 40; d += (i ? "L" : "M") + (x * S).toFixed(1) + " " + ((1 - cr(pts, x)) * S).toFixed(1); } return d; };
  return (<div className="crv278">
    <div className="chips" role="group" aria-label={t("pro2.channel")}>{CH.map((x) => <button key={x.k} type="button" className="chip" aria-pressed={ch === x.k} onClick={() => setCh(x.k)} data-testid={"crv-ch-" + x.k}><i style={{ background: x.col }} />{t("pro2.ch." + x.k)}</button>)}</div>
    <svg ref={svg} viewBox={`-6 -6 ${S + 12} ${S + 12}`} className="crvsvg" data-testid="curves" onPointerMove={(e) => { if (drag.current != null) move(e, drag.current); }} onPointerUp={() => { if (drag.current != null) { drag.current = null; A.live.end(); } }} onPointerLeave={() => { if (drag.current != null) { drag.current = null; A.live.end(); } }}>
      <rect x="0" y="0" width={S} height={S} className="crvbg" />
      {[1, 2, 3].map((i) => <g key={i}><line x1={(i * S) / 4} y1="0" x2={(i * S) / 4} y2={S} className="crvgrid" /><line x1="0" y1={(i * S) / 4} x2={S} y2={(i * S) / 4} className="crvgrid" /></g>)}
      <line x1="0" y1={S} x2={S} y2="0" className="crvdiag" />
      {CH.filter((x) => x.k !== ch).map((x) => <path key={x.k} d={path(cu[x.k])} stroke={x.col} className="crvoth" />)}
      <path d={path(cu[ch])} stroke={CH.find((x) => x.k === ch)!.col} className="crvcur" />
      {cu[ch].map((v, i) => <circle key={i} cx={(i * S) / 4} cy={(1 - v) * S} r="7" className="crvpt" data-testid={"crv-pt-" + i}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = i; A.live.start("curves"); move(e, i); }}
        onPointerMove={(e) => { if (drag.current === i) move(e, i); }} />)}
    </svg>
    <Btn icon="undo" ghost onClick={() => P.resetCurves(c.id)} testid="crv-reset">{t("pro2.resetCurves")}</Btn>
  </div>);
}

// ---------------- colour wheels: shadows (lift), midtones (gamma), highlights (gain) — drag the dot towards a colour; the slider sets how bright
const hueRgb = (h: number): [number, number, number] => { const f = (n: number) => { const k = (n + h * 6) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; };
function toDot(v: [number, number, number]) { const m = (v[0] + v[1] + v[2]) / 3; const c = [v[0] - m, v[1] - m, v[2] - m]; const x = c[0] - 0.5 * c[1] - 0.5 * c[2], y = (Math.sqrt(3) / 2) * (c[1] - c[2]); return { x, y, m }; }
function fromDot(x: number, y: number, m: number): [number, number, number] { const ang = Math.atan2(y, x), r = Math.min(1, Math.hypot(x, y)); const [R, G, B] = hueRgb(((ang / (2 * Math.PI)) + 1) % 1); const avg = (R + G + B) / 3; const k = r * 0.6;
  return [m + (R - avg) * k, m + (G - avg) * k, m + (B - avg) * k].map((q) => Math.round(q * 1000) / 1000) as [number, number, number]; }
function Wheel({ label, value, onSet, testid }: { label: string; value: [number, number, number]; onSet: (v: [number, number, number], end?: boolean) => void; testid: string }) {
  const ref = useRef<HTMLDivElement>(null); const d = toDot(value); const on = useRef(false);
  const k = 0.6; const px = Math.max(-1, Math.min(1, d.x / k)), py = Math.max(-1, Math.min(1, d.y / k));
  const set = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); let x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1); const L = Math.hypot(x, y); if (L > 1) { x /= L; y /= L; } onSet(fromDot(x, y, d.m)); };
  return (<div className="whl278" data-testid={testid}>
    <div ref={ref} className="whlc" role="slider" aria-label={label} aria-valuetext={value.map((x) => x.toFixed(2)).join(" ")}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); on.current = true; A.live.start("wheels"); set(e); }}
      onPointerMove={(e) => { if (on.current) set(e); }} onPointerUp={() => { if (on.current) { on.current = false; A.live.end(); } }}
      onDoubleClick={() => onSet([0, 0, 0], true)}>
      <i className="whld" style={{ left: `${50 + px * 50}%`, top: `${50 - py * 50}%` }} />
    </div>
    <b>{label}</b>
    <Slider label={label + " · " + i18nB()} value={d.m} min={-0.5} max={0.5} fmt={(v) => (v > 0 ? "+" : "") + Math.round(v * 100)} onChange={(v) => { const dd = toDot(value); onSet(fromDot(dd.x / 0.6, dd.y / 0.6, v)); }} onCommit={A.live.end} testid={testid + "-lum"} />
  </div>);
}
export function WheelsEditor({ c }: { c: MediaClip }) {
  const { t } = useTranslation(); const wh = c.color.wheels || P.WHEEL0();
  const set = (k: keyof Wheels) => (v: [number, number, number], end?: boolean) => { const n: Wheels = { lift: [...wh.lift], gamma: [...wh.gamma], gain: [...wh.gain] }; n[k] = v; if (end) A.setProp("color.wheels", n, "wheels"); else A.live.set("color.wheels", n); };
  return (<div className="whls278">
    <div className="whlrow"><Wheel label={t("pro2.lift")} value={wh.lift} onSet={set("lift")} testid="wh-lift" /><Wheel label={t("pro2.gamma")} value={wh.gamma} onSet={set("gamma")} testid="wh-gamma" /><Wheel label={t("pro2.gain")} value={wh.gain} onSet={set("gain")} testid="wh-gain" /></div>
    <p className="hint">{t("pro2.wheelsHint")}</p>
    <Btn icon="undo" ghost onClick={() => P.resetWheels(c.id)} testid="wh-reset">{t("pro2.resetWheels")}</Btn>
  </div>);
}

// ---------------- scopes: waveform, vectorscope and histogram of the preview, a few times a second
export function Scopes() {
  const { t } = useTranslation(); const [kind, setKind] = useState<"wave" | "vector" | "hist">("wave"); const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let on = true; const small = document.createElement("canvas"); small.width = 128; small.height = 72; const sx = small.getContext("2d", { willReadFrequently: true })!;
    const draw = () => {
      if (!on) return; const src = document.querySelector<HTMLCanvasElement>("[data-testid=preview]"), cv = ref.current; if (!src || !cv || !src.width) return;
      try { sx.drawImage(src, 0, 0, 128, 72); } catch { return; }
      const d = sx.getImageData(0, 0, 128, 72).data; const g = cv.getContext("2d")!; const W = cv.width, H = cv.height; const img = g.createImageData(W, H); const o = img.data;
      const plot = (x: number, y: number, r: number, gg: number, b: number) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = ((y | 0) * W + (x | 0)) * 4; o[i] = Math.min(255, o[i] + r); o[i + 1] = Math.min(255, o[i + 1] + gg); o[i + 2] = Math.min(255, o[i + 2] + b); o[i + 3] = 255; };
      for (let i = 3; i < o.length; i += 4) o[i] = 255;
      if (kind === "wave") { for (let y = 0; y < 72; y++) for (let x = 0; x < 128; x++) { const j = (y * 128 + x) * 4, X = (x / 128) * W; plot(X, (1 - d[j] / 255) * (H - 1), 120, 0, 0); plot(X, (1 - d[j + 1] / 255) * (H - 1), 0, 120, 0); plot(X, (1 - d[j + 2] / 255) * (H - 1), 0, 0, 120); plot(X + 1, (1 - d[j] / 255) * (H - 1), 120, 0, 0); plot(X + 1, (1 - d[j + 1] / 255) * (H - 1), 0, 120, 0); plot(X + 1, (1 - d[j + 2] / 255) * (H - 1), 0, 0, 120); } }
      else if (kind === "vector") { for (let j = 0; j < d.length; j += 4) { const r = d[j] / 255, gg = d[j + 1] / 255, b = d[j + 2] / 255; const cb = -0.1687 * r - 0.3313 * gg + 0.5 * b, crr = 0.5 * r - 0.4187 * gg - 0.0813 * b; plot(W / 2 + cb * W * 0.9, H / 2 - crr * H * 0.9, 40, 70, 40); }
        g.putImageData(img, 0, 0); g.strokeStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * 0.45, 0, 7); g.stroke(); setTimeout(draw, 300); return; }
      else { const hr = new Array(64).fill(0), hg = [...hr], hb = [...hr]; for (let j = 0; j < d.length; j += 4) { hr[d[j] >> 2]++; hg[d[j + 1] >> 2]++; hb[d[j + 2] >> 2]++; } const mx = Math.max(1, ...hr, ...hg, ...hb);
        for (let i = 0; i < 64; i++) { const x0 = (i / 64) * W, x1 = ((i + 1) / 64) * W; for (const [arr, rr, gg2, bb] of [[hr, 90, 0, 0], [hg, 0, 90, 0], [hb, 0, 0, 90]] as [number[], number, number, number][]) { const h = (arr[i] / mx) * (H - 1); for (let x = x0; x < x1; x++) for (let y = H - 1; y > H - 1 - h; y--) plot(x, y, rr, gg2, bb); } } }
      g.putImageData(img, 0, 0); setTimeout(draw, 300);
    };
    draw(); return () => { on = false; };
  }, [kind]);
  return (<div className="scp278">
    <div className="chips" role="group" aria-label={t("pro2.scopes")}>{(["wave", "vector", "hist"] as const).map((k) => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)} data-testid={"scope-" + k}>{t("pro2.scope." + k)}</button>)}</div>
    <canvas ref={ref} width={256} height={128} className="scpc" data-testid="scope" aria-label={t("pro2.scope." + kind)} role="img" />
  </div>);
}

// ---------------- the clip's sound: voice changer, EQ, compressor
export function SoundFx({ c }: { c: MediaClip }) {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const fx = c.afx || P.AFX0();
  const eq = (i: number, v: number) => { const n = { ...fx, eq: [...fx.eq] as [number, number, number] }; n.eq[i] = v; A.live.set("afx", n); };
  return (<>
    <span className="ns-lbl">{t("pro2.voice")}</span>
    <div className="ns-grid vc278">{VOICES278.map((v) => <button key={v.id} type="button" className="ns-tile" aria-pressed={fx.voice === v.id} onClick={() => P.setAfx(c.id, (x) => { x.voice = v.id; }, "voice")} data-testid={"voice-" + v.id}><Icon name={v.id === "none" ? "mic" : v.id === "echo" || v.id === "hall" ? "wave" : "audio"} size={16} /><span>{lang === "ar" ? v.ar : v.en}</span></button>)}</div>
    <span className="ns-lbl">{t("pro2.eq")}</span>
    {(["low", "mid", "high"] as const).map((k, i) => <Slider key={k} label={t("pro2.eq_" + k)} value={fx.eq[i]} min={-12} max={12} step={0.5} fmt={(v) => (v > 0 ? "+" : "") + v + " dB"} onChange={(v) => eq(i, v)} onCommit={A.live.end} testid={"eq-" + k} />)}
    <label className="row"><input type="checkbox" checked={fx.comp} onChange={(e) => P.setAfx(c.id, (x) => { x.comp = e.target.checked; }, "compressor")} data-testid="comp" /> {t("pro2.comp")}</label>
    {(fx.voice !== "none" || fx.comp || fx.eq.some((x) => x)) && <Btn icon="undo" ghost onClick={() => A.setProp("afx", null, "sound")} testid="afx-reset">{t("pro2.resetSound")}</Btn>}
  </>);
}

// ---------------- pro clip tools in the Video tab: stabilise, a smooth preview copy, nest / un-nest
export function ProClip({ c }: { c: MediaClip }) {
  const { t } = useTranslation(); const p = useProject(); const a = p.assets[c.asset]; const stab = useUI((s) => (s as unknown as { stab278?: string | null }).stab278); const [pk, setPk] = useState(0); const [sv, setSv] = useState(2);
  useUI((s) => s.sub); // re-render on ui.set
  return (<>
    {c.nested ? <><p className="hint">{t("pro2.nestedHint", { n: c.nested.tracks.reduce((s, x) => s + x.clips.length, 0) })}</p><Btn icon="package" onClick={() => P.unnest(c.id)} testid="unnest">{t("pro2.unnest")}</Btn></> : null}
    {a?.kind === "video" && <>
      <span className="ns-lbl">{t("pro2.stab")}</span>
      {c.steadyOf ? <><p className="hint">{t("pro2.steadyHint")}</p><Btn icon="undo" ghost onClick={() => P.unstabilise(c.id)} testid="unstab">{t("pro2.unstab")}</Btn></> : <>
        <Slider label={t("pro2.stabStrength")} value={sv} min={1} max={3} step={1} fmt={(v) => t("pro2.stabS" + v)} onChange={setSv} testid="stab-strength" />
        <Btn icon="follow" onClick={() => void P.stabilise(sv)} disabled={!!stab} testid="stab">{stab === c.id ? t("pro2.stabbing") : t("pro2.stabGo")}</Btn>
        <p className="hint">{t("pro2.stabHint")}</p></>}
      <span className="ns-lbl">{t("pro2.proxy")}</span>
      {a.proxy ? <><p className="hint">{t("pro2.proxyOn")}</p><Btn icon="close" ghost onClick={() => P.dropProxy(a.id)} testid="proxy-drop">{t("pro2.proxyDrop")}</Btn></>
        : <><Btn icon="film" onClick={() => void P.makeProxy(a.id, (k) => setPk(k))} disabled={P.proxyBusy(a.id)} testid="proxy-make">{P.proxyBusy(a.id) ? t("pro2.proxyMaking", { n: Math.round(pk * 100) }) : t("pro2.proxyMake")}</Btn><p className="hint">{t("pro2.proxyHint")}</p></>}
    </>}
  </>);
}

// ---------------- timeline buttons: adjustment layer, nest, preview quality
export function ProButtons() {
  const { t } = useTranslation(); useProject(); const nesting = useUI((s) => (s as unknown as { nest278?: boolean }).nest278); const [q, setQ] = useState(() => playerRef.current?.quality || 1);
  const n = editor.selection.length; const one = n === 1 ? findClip(editor.project, editor.selection[0])?.clip : null;
  return (<>
    <Btn icon="backdrop" label={t("pro2.adjustAdd")} onClick={() => void P.addAdjust()} testid="adjust-add" />
    {one?.type === "media" && (one as MediaClip).nested ? <Btn icon="package" label={t("pro2.unnest")} onClick={() => P.unnest(one.id)} testid="tb-unnest" />
      : <Btn icon="package" label={nesting ? t("pro2.nesting") : t("pro2.nest")} onClick={() => void P.nest()} disabled={n < 2 || !!nesting} testid="tb-nest" />}
    <label className="pq278" title={t("pro2.pq")}><Icon name="eye" size={14} /><select aria-label={t("pro2.pq")} value={q} onChange={(e) => { const v = +e.target.value; setQ(v); playerRef.current?.setQuality(v); }} data-testid="preview-quality">
      <option value={1}>{t("pro2.pqFull")}</option><option value={0.5}>{t("pro2.pqHalf")}</option><option value={0.25}>{t("pro2.pqQuarter")}</option></select></label>
  </>);
}
export const _keep = { findClip };
