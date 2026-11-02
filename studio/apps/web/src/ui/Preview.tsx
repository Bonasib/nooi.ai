import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Btn } from "@nooi/ui";
import { duration, findClip, propAt, LOOKS, color0, effectAmount } from "@nooi/editor-core";
import type { MediaClip, Project } from "@nooi/editor-core";
import { Player } from "../engine/player";
import { editor, playerRef, toast, ui, useProject, useUI, autosave } from "../state";
import * as A from "../actions";

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
  const [size, setSize] = useState({ w: 320, h: 180 });
  useEffect(() => {
    const pl = new Player(editor, ref.current!); playerRef.current = pl; force((x) => x + 1);
    const off = pl.onClock(() => force((x) => x + 1));
    return () => { off(); pl.dispose(); playerRef.current = null; };
  }, []);
  useEffect(() => { playerRef.current?.setOverride(pv && !pv.startsWith("tr:") ? previewOf(pv) : null); }, [pv]);
  useEffect(() => { const pl = playerRef.current; if (pl) pl.loop = loop; }, [loop]);
  useEffect(() => { playerRef.current?.resize(); }, [p.width, p.height]);
  useEffect(() => {
    const el = box.current!; const fit = () => { const r = el.getBoundingClientRect(); const k = Math.min(r.width / p.width, r.height / p.height); setSize({ w: Math.max(40, Math.floor(p.width * k)), h: Math.max(40, Math.floor(p.height * k)) }); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, [p.width, p.height]);
  const pl = playerRef.current; const clock = pl?.clock || { t: 0, playing: false, buffering: false }; const d = duration(p);
  // drag the picked clip on the picture (move), its corner (size)
  const sel = editor.selection.length === 1 ? findClip(p, editor.selection[0])?.clip : null;
  const local = sel ? clock.t - sel.start : 0; const on = !!sel && local >= 0 && local <= sel.dur;
  const drag = (mode: "move" | "scale") => (e: React.PointerEvent) => {
    if (!sel) return; e.preventDefault(); e.stopPropagation(); const x0 = e.clientX, y0 = e.clientY; const T = { ...sel.transform }; const s0 = propAt(sel, "scale", local);
    editor.begin(mode); (e.target as Element).setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => { const dx = (ev.clientX - x0) / size.w, dy = (ev.clientY - y0) / size.h;
      editor.live((q) => { const f = findClip(q, sel.id); if (!f) return; if (mode === "move") { f.clip.transform.x = T.x + (document.documentElement.dir === "rtl" ? dx : dx); f.clip.transform.y = T.y + dy; } else f.clip.transform.scale = Math.max(0.05, s0 * (1 + (dx + dy))); }); };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); editor.commit(); autosave(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  const hx = sel ? 0.5 + propAt(sel, "x", local) : 0.5, hy = sel ? 0.5 + propAt(sel, "y", local) : 0.5, hs = sel ? propAt(sel, "scale", local) : 1;
  return (
    <section className="player" aria-label={t("preview.label")}>
      <div className="stagebox" ref={box} onClick={(e) => { if (e.target === box.current) editor.select([]); }}>
        <div className="stage" style={{ width: size.w, height: size.h }}>
          <canvas ref={ref} style={{ width: size.w, height: size.h }} aria-label={t("preview.canvas")} role="img" data-testid="preview" />
          {safe && <div className="safe" aria-hidden="true" />}
          {on && sel && <div className="handle" style={{ left: hx * 100 + "%", top: hy * 100 + "%", width: Math.min(100, hs * 60) + "%", height: Math.min(100, hs * 60) + "%" }} onPointerDown={drag("move")} aria-label={t("preview.move")} role="button" tabIndex={-1}>
            <span className="corner" onPointerDown={drag("scale")} aria-label={t("preview.scale")} role="button" tabIndex={-1} />
          </div>}
          {pv && !pv.startsWith("tr:") && <div className="pvtag" role="status">{t("preview.previewing")}</div>}
          {clock.buffering && <div className="pvtag buf">{t("preview.loading")}</div>}
        </div>
      </div>
      <div className="transport" dir="ltr">
        <Btn icon="prev" label={t("preview.back")} kbd="←" onClick={() => playerRef.current?.step(-1)} />
        <Btn icon={clock.playing ? "pause" : "play"} label={clock.playing ? t("preview.pause") : t("preview.play")} kbd="Space" onClick={() => { const q = playerRef.current; if (q) { q.toggle(); if (!editor.project.tracks.some((x) => x.clips.length)) toast(t("preview.empty"), "info"); } }} primary testid="play" />
        <Btn icon="next" label={t("preview.fwd")} kbd="→" onClick={() => playerRef.current?.step(1)} />
        <span className="tc" data-testid="tc">{tc(clock.t, p.fps)} <span className="dim">/ {tc(d, p.fps)}</span></span>
        <span className="sp" />
        <Btn icon="reverse" label={t("preview.loop")} pressed={loop} onClick={() => ui.set({ loop: !loop })} />
        <Btn icon="fit" label={t("preview.safe")} pressed={safe} onClick={() => ui.set({ safe: !safe })} />
        <Btn icon="fit" label={t("preview.full")} onClick={() => box.current?.requestFullscreen?.()} />
      </div>
    </section>
  );
}
export const seekTo = (t: number) => { playerRef.current?.seek(t); };
export const _a = A;
