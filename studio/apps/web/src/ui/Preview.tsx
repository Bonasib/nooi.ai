import { useTranslation } from "react-i18next";
import { SafeArea } from "./Smart";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Btn } from "@nooi/ui";
import { duration, findClip, propAt, LOOKS, color0, effectAmount } from "@nooi/editor-core";
import type { MediaClip, Project } from "@nooi/editor-core";
import { Player } from "../engine/player";
import { editor, playerRef, toast, ui, useProject, useUI, autosave } from "../state";
import * as A from "../actions";
import { onCode } from "../motion/code";

export const tc = (s: number, fps = 30) => { const f = Math.floor((s % 1) * fps); const x = Math.floor(s); return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0") + ":" + String(f).padStart(2, "0"); };
// the project as it would look with the pointed-at effect / look (drawn only)
function previewOf(id: string): ((p: Project) => Project) | null {
  const [kind, v] = id.split(":"); const sel = new Set(editor.selection);
  return (p) => {
    const q: Project = { ...p, tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => {
      if (c.type !== "media" || (sel.size && !sel.has(c.id))) return c;
      const m = { ...c } as MediaClip;
      if (kind === "fx" && !m.effects.some((e) => e.type === v)) m.effects = [...m.effects, { id: "pv", type: v, enabled: true, params: { amount: effectAmount(v) } }];
      if (kind === "look") { const l = LOOKS.find((x) => x.id === v); if (l) m.color = { ...color0(), ...l.set }; }
      return m; }) })) };
    return q;
  };
}
export function Preview() {
  const { t } = useTranslation(); const p = useProject(); const ref = useRef<HTMLCanvasElement>(null); const box = useRef<HTMLDivElement>(null);
  const [, force] = useState(0); const pv = useUI((s) => s.preview); const safe = useUI((s) => s.safe); const loop = useUI((s) => s.loop);
  const [size, setSize] = useState({ w: 320, h: 180 }); const [held, setHeld] = useState(false);
  useEffect(() => {
    const pl = new Player(editor, ref.current!); playerRef.current = pl; force((x) => x + 1);
    // (v226) while it plays, the time is drawn by <Timecode> on its own; the rest of the preview redraws when it stops, starts or seeks
    let was = false; const off = pl.onClock(() => { const now = pl.clock.playing; if (!now || now !== was) force((x) => x + 1); was = now; });
    const offCode = onCode(() => pl.redraw());   // (v227) a Motion code picture arrived
    return () => { off(); offCode(); pl.dispose(); playerRef.current = null; };
  }, []);
  useEffect(() => { playerRef.current?.setOverride(pv && !pv.startsWith("tr:") ? previewOf(pv) : null); }, [pv]);
  useEffect(() => { const pl = playerRef.current; if (pl) pl.loop = loop; }, [loop]);
  useEffect(() => { playerRef.current?.resize(); }, [p.width, p.height]);
  useEffect(() => { playerRef.current?.fitTo(size.w, size.h); }, [size.w, size.h]);
  useEffect(() => {
    const el = box.current!; const fit = () => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom); const k = Math.min((r.width - padX) / p.width, (r.height - padY) / p.height); setSize({ w: Math.max(40, Math.floor(p.width * k)), h: Math.max(40, Math.floor(p.height * k)) }); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, [p.width, p.height]);
  const pl = playerRef.current; const clock = pl?.clock || { t: 0, playing: false, buffering: false }; const d = duration(p);
  // drag the picked clip on the picture (move), its corner (size)
  const sel = editor.selection.length === 1 ? findClip(p, editor.selection[0])?.clip : null;
  const local = sel ? clock.t - sel.start : 0; const on = !!sel && local >= 0 && local <= sel.dur;
  // a finger must rest on the clip for a moment before it moves it (a swipe across the picture changes nothing); a tap without a
  // move leaves no undo step; the centre lines pull the clip in
  const drag = (mode: "move" | "scale") => (e: React.PointerEvent) => {
    if (!sel) return; e.preventDefault(); e.stopPropagation(); const x0 = e.clientX, y0 = e.clientY; const T = { ...sel.transform }; const s0 = propAt(sel, "scale", local);
    const touch = e.pointerType !== "mouse"; let live = !touch, gone = false, moved = false;
    // (v225: a deliberate hold — half a second, the finger still — before a touch moves the clip; it shows while it is held)
    const timer = touch ? setTimeout(() => { if (!gone) { live = true; setHeld(true); editor.begin(mode); try { navigator.vibrate?.(12); } catch { /* */ } } }, 500) : 0;
    if (!touch) editor.begin(mode);
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* (the pointer is already gone) */ }
    const snapC = (v: number) => (Math.abs(v) < 0.015 ? 0 : v);
    const mv = (ev: PointerEvent) => { const dx = (ev.clientX - x0) / size.w, dy = (ev.clientY - y0) / size.h;
      if (!live) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) { gone = true; clearTimeout(timer); } return; }
      moved = true;
      editor.live((q) => { const f = findClip(q, sel.id); if (!f) return; if (mode === "move") { f.clip.transform.x = snapC(T.x + dx); f.clip.transform.y = snapC(T.y + dy); } else f.clip.transform.scale = Math.max(0.05, s0 * (1 + (dx + dy))); }); };
    const up = () => { clearTimeout(timer); setHeld(false); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      if (live) { if (moved) { editor.commit(); autosave(); } else editor.cancel(); } };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };
  // the picked clip's outline: where its picture really is (fitted, cropped, sized, moved and turned)
  const bx = sel ? A.pictureBox(p, sel, Math.max(0, Math.min(sel.dur, local))) : null; const rot = sel ? propAt(sel, "rotation", Math.max(0, Math.min(sel.dur, local))) : 0;
  // a clip whose picture sits mostly outside the frame (moved there by mistake): say so, with one tap to put it back
  const lost = !clock.playing ? p.tracks.filter((tr) => tr.kind !== "audio" && !tr.hidden).flatMap((tr) => tr.clips).find((c) => {
    if (clock.t < c.start || clock.t > c.start + c.dur || c.keyframes.x?.length || c.keyframes.y?.length || (c.type === "media" && p.assets[c.asset]?.kind === "audio")) return false;
    const b = A.pictureBox(p, c, 0), ox = Math.max(0, Math.min(1, b.cx + b.w / 2) - Math.max(0, b.cx - b.w / 2)), oy = Math.max(0, Math.min(1, b.cy + b.h / 2) - Math.max(0, b.cy - b.h / 2));
    return b.w * b.h > 1e-4 && (ox * oy) / (b.w * b.h) < 0.5; }) : undefined;
  const putBack = (id: string) => A.run("put back", (q) => { const f = findClip(q, id); if (!f) return; f.clip.transform.x = 0; f.clip.transform.y = 0; if (f.clip.transform.scale < 0.1) f.clip.transform.scale = 1; });
  return (
    <section className="player" aria-label={t("preview.label")}>
      <div className="stagebox" ref={box} onClick={(e) => { if (e.target === box.current) editor.select([]); }}>
        <div className="stage" style={{ width: size.w, height: size.h }}>
          <canvas ref={ref} style={{ width: size.w, height: size.h }} aria-label={t("preview.canvas")} role="img" data-testid="preview" />
          {safe && <div className="safe" aria-hidden="true" />}<SafeArea />
          {on && sel && bx && <div className={"handle" + (held ? " held" : "")} style={{ left: bx.cx * 100 + "%", top: bx.cy * 100 + "%", width: Math.min(300, bx.w * 100) + "%", height: Math.min(300, bx.h * 100) + "%", transform: "translate(-50%, -50%) rotate(" + rot + "deg)" }} onPointerDown={drag("move")} aria-label={t("preview.move")} role="button" tabIndex={-1} data-testid="handle">
            <span className="corner" onPointerDown={drag("scale")} aria-label={t("preview.scale")} role="button" tabIndex={-1} />
          </div>}
          {pv && !pv.startsWith("tr:") && <div className="pvtag" role="status">{t("preview.previewing")}</div>}
          {clock.buffering && <div className="pvtag buf">{t("preview.loading")}</div>}
          {lost && <div className="lost" role="status" data-testid="offframe"><span>{t("preview.outside", { name: lost.name || (lost.type === "text" ? lost.text : "") })}</span><Btn icon="fit" primary onClick={() => putBack(lost.id)} testid="put-back">{t("preview.putBack")}</Btn></div>}
        </div>
      </div>
      <div className="transport" dir="ltr">
        <Btn icon="prev" label={t("preview.back")} kbd="←" onClick={() => playerRef.current?.step(-1)} />
        <Btn icon={clock.playing ? "pause" : "play"} label={clock.playing ? t("preview.pause") : t("preview.play")} kbd="Space" onClick={() => { const q = playerRef.current; if (q) { q.toggle(); if (!editor.project.tracks.some((x) => x.clips.length)) toast(t("preview.empty"), "info"); } }} primary testid="play" />
        <Btn icon="next" label={t("preview.fwd")} kbd="→" onClick={() => playerRef.current?.step(1)} />
        <Timecode fps={p.fps} d={d} />
        <span className="sp" />
        <Btn icon="reverse" label={t("preview.loop")} pressed={loop} onClick={() => ui.set({ loop: !loop })} />
        <Btn icon="fit" label={t("preview.safe")} pressed={safe} onClick={() => ui.set({ safe: !safe })} />
        <Btn icon="fit" label={t("preview.full")} onClick={() => box.current?.requestFullscreen?.()} />
      </div>
    </section>
  );
}
export const seekTo = (t: number) => { playerRef.current?.seek(t); };
function Timecode({ fps, d }: { fps: number; d: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { const pl = playerRef.current; if (!pl) return; const put = () => { if (ref.current) ref.current.firstChild!.textContent = tc(pl.clock.t, fps) + " "; }; put(); return pl.onClock(put); }, [playerRef.current, fps]);
  return <span className="tc" data-testid="tc" ref={ref}>{tc(playerRef.current?.clock.t ?? 0, fps) + " "}<span className="dim">/ {tc(d, fps)}</span></span>;
}
export const _a = A;
