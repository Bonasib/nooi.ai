import { useTranslation } from "react-i18next";
import { memo, useEffect, useRef, useState } from "react";
import type { DragEvent, PointerEvent as RPE } from "react";
import { Btn, Icon, Seg } from "@nooi/ui";
import * as C from "@nooi/editor-core";
import type { Clip, MediaClip, Project, Track } from "@nooi/editor-core";
import { editor, playerRef, toast, ui, useProject, useUI, autosave, markPick } from "../state";
import type { Tool } from "../state";
import * as A from "../actions";

const HEAD = 150, RULER = 26, LANE: Record<Track["kind"], number> = { video: 56, audio: 44, text: 34 };
export function Timeline() {
  const { t } = useTranslation(); const p = useProject(); const zoom = useUI((s) => s.zoom); const tool = useUI((s) => s.tool); const snapOn = useUI((s) => s.snap);
  const scroll = useRef<HTMLDivElement>(null); const [snapAt, setSnapAt] = useState<number | null>(null); const [dropX, setDropX] = useState<number | null>(null);
  const dur = C.duration(p), width = Math.max((dur + 30) * zoom, 800);
  const xToT = (clientX: number) => { const r = scroll.current!.getBoundingClientRect(); return Math.max(0, (clientX - r.left + scroll.current!.scrollLeft) / zoom); };
  const laneAt = (clientY: number): string | null => { const el = document.elementsFromPoint(scroll.current!.getBoundingClientRect().left + 4, clientY).find((e) => (e as HTMLElement).dataset?.lane) as HTMLElement | undefined; return el?.dataset.lane || null; };
  const snapT = (t0: number, skip: Set<string>) => { if (!snapOn) { setSnapAt(null); return t0; } const pts = C.snapPoints(editor.project, { skip, playhead: playerRef.current?.clock.t }); const s = C.snap(t0, pts, 9 / zoom); setSnapAt(s.snapped ? s.t : null); return s.t; };
  // ---- dragging a clip (move / trim / ripple / roll / slip / slide)
  const startDrag = (e: RPE, c: Clip, part: "body" | "l" | "r") => {
    if (e.button > 0) return; e.stopPropagation();
    const f = C.findClip(editor.project, c.id); if (!f) return;
    if (f.track.locked) { toast(t("tl.locked"), "info"); return; }
    if (e.shiftKey || e.metaKey || e.ctrlKey) { editor.select(editor.selection.includes(c.id) ? editor.selection.filter((x) => x !== c.id) : [...editor.selection, c.id]); return; }
    markPick(); if (!editor.selection.includes(c.id)) editor.select([c.id]);
    const x0 = e.clientX, s0 = c.start, e0 = C.clipEnd(c); let moved = false; const skip = new Set([c.id]); const tl = tool as Tool;
    const target = e.currentTarget as HTMLElement; target.setPointerCapture?.(e.pointerId);
    const mode = part === "body" ? (tl === "slip" ? "slip" : tl === "slide" ? "slide" : "move") : tl === "roll" ? "roll" : "trim";
    const mv = (ev: PointerEvent) => {
      const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 3 && Math.abs(ev.clientY - e.clientY) < 3) return;
      if (!moved) { moved = true; editor.begin(mode); }
      const dt = dx / zoom;
      editor.live((q) => {
        if (mode === "move") { let ns = s0 + dt; const a = snapT(ns, skip), b = snapT(ns + c.dur, skip) - c.dur; ns = Math.abs(a - ns) <= Math.abs(b - ns) ? a : b; C.moveClip(q, c.id, ns, laneAt(ev.clientY)); }
        else if (mode === "trim") { const edge = part === "l" ? "start" : "end"; const tt = snapT((part === "l" ? s0 : e0) + dt, skip); C.trim(q, c.id, edge, tt, tl === "ripple"); }
        else if (mode === "roll") { const a = part === "r" ? c.id : C.neighbours(q, c.id)?.prev?.id; if (a) C.roll(q, a, snapT((part === "r" ? e0 : s0) + dt, skip)); }
        else if (mode === "slip") C.slip(q, c.id, -dt * (c.type === "media" ? c.speed : 1));
        else if (mode === "slide") C.slide(q, c.id, dt);
      });
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); setSnapAt(null); if (moved) { editor.commit(); autosave(); } };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  // ---- the ruler: scrub
  const scrub = (e: RPE) => {
    if (e.button > 0) return; const seek = (x: number) => playerRef.current?.seek(snapOn ? C.snap(xToT(x), C.snapPoints(editor.project, {}), 6 / zoom).t : xToT(x));
    playerRef.current?.pause(); seek(e.clientX);
    const mv = (ev: PointerEvent) => seek(ev.clientX); const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  // ---- drops from the panels: media, a text template, a transition
  const onDrop = (e: DragEvent, laneId: string | null) => {
    e.preventDefault(); setDropX(null); const at = snapT(xToT(e.clientX), new Set()); setSnapAt(null);
    const asset = e.dataTransfer.getData("application/x-nooi-asset"), tpl = e.dataTransfer.getData("application/x-nooi-text"), tr = e.dataTransfer.getData("application/x-nooi-transition");
    if (asset) { const a = editor.project.assets[asset]; if (a) A.addAsset(a, at, laneId); }
    else if (tpl) { playerRef.current?.seek(at); A.addText(tpl); }
    else if (tr) { const lane = editor.project.tracks.find((x) => x.id === laneId); const cut = lane?.clips.find((c) => Math.abs(C.clipEnd(c) - at) < 1.5 / Math.max(0.1, zoom / 60)) || lane?.clips.find((c) => at >= c.start && at < C.clipEnd(c)); if (cut) A.applyTransition(tr, cut.id); }
    else if (e.dataTransfer.files.length) toast(t("tl.dropToLibrary"), "info");
  };
  const allow = (e: DragEvent) => { const ty = e.dataTransfer.types; if (ty.includes("application/x-nooi-asset") || ty.includes("application/x-nooi-text") || ty.includes("application/x-nooi-transition")) { e.preventDefault(); setDropX(xToT(e.clientX) * zoom); } };
  // ---- zoom: ctrl/⌘ + wheel, pinch
  useEffect(() => {
    const el = scroll.current!; const pts = new Map<number, number>(); let d0 = 0, z0 = 60;
    const wheel = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); A.zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); } };
    const down = (e: PointerEvent) => { if (e.pointerType === "touch") { pts.set(e.pointerId, e.clientX); if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.abs(a - b); z0 = ui.get().zoom; } } };
    const move = (e: PointerEvent) => { if (pts.has(e.pointerId)) { pts.set(e.pointerId, e.clientX); if (pts.size === 2 && d0 > 10) { const [a, b] = [...pts.values()]; ui.set({ zoom: Math.max(4, Math.min(600, (z0 * Math.abs(a - b)) / d0)) }); } } };
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); };
    el.addEventListener("wheel", wheel, { passive: false }); el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    return () => { el.removeEventListener("wheel", wheel); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
  }, []);
  // keep the playhead in view while playing
  useEffect(() => playerRef.current?.onClock(() => { const pl = playerRef.current!, el = scroll.current; if (!el || !pl.clock.playing) return; const x = pl.clock.t * ui.get().zoom; if (x > el.scrollLeft + el.clientWidth - 60 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 80); }), [playerRef.current]);
  const tools: { v: Tool; label: string }[] = [{ v: "select", label: t("tool.select") }, { v: "ripple", label: t("tool.ripple") }, { v: "roll", label: t("tool.roll") }, { v: "slip", label: t("tool.slip") }, { v: "slide", label: t("tool.slide") }];
  return (
    <section className="timeline" aria-label={t("tl.label")}>
      <div className="tlbar">
        <Btn icon="split" label={t("act.split")} kbd="S" onClick={A.split} testid="split" />
        <Btn icon="trash" label={t("act.delete")} kbd="Del" onClick={() => A.del(false)} disabled={!editor.selection.length} testid="delete" />
        <Btn icon="ripple" label={t("act.rippleDelete")} kbd="Shift+Del" onClick={() => A.del(true)} disabled={!editor.selection.length} testid="ripple-delete" />
        <Btn icon="copy" label={t("act.duplicate")} kbd="Ctrl+D" onClick={A.duplicate} disabled={!editor.selection.length} />
        <Btn icon="freeze" label={t("insp.freeze")} onClick={A.freeze} disabled={!editor.selection.length} />
        <Btn icon="detach" label={t("insp.detach")} onClick={A.detach} disabled={!editor.selection.length} />
        <Btn icon="marker" label={t("act.marker")} kbd="M" onClick={A.marker} testid="marker" />
        <span className="sep" />
        <Seg label={t("tool.label")} value={tool} onChange={(v) => ui.set({ tool: v })} options={tools} />
        <Btn icon="magnet" label={t("tl.snap")} pressed={snapOn} onClick={() => ui.set({ snap: !snapOn })} testid="snap" />
        <span className="sp" />
        <Btn icon="plus" label={t("tl.addVideo")} onClick={() => A.run("track", (q) => C.addTrack(q, "video"))}>V</Btn>
        <Btn icon="plus" label={t("tl.addAudio")} onClick={() => A.run("track", (q) => C.addTrack(q, "audio"))}>A</Btn>
        <Btn icon="plus" label={t("tl.addText")} onClick={() => A.run("track", (q) => C.addTrack(q, "text", 0))}>T</Btn>
        <input className="zoomr" type="range" min={4} max={600} value={zoom} onChange={(e) => ui.set({ zoom: +e.target.value })} aria-label={t("tl.zoom")} />
      </div>
      <div className="tlgrid" dir="ltr">
        <div className="theads" style={{ width: HEAD }}>
          <div style={{ height: RULER }} className="rulerpad" />
          {p.tracks.map((tr) => <Head key={tr.id} tr={tr} p={p} />)}
        </div>
        <div className="tlscroll" ref={scroll} onDragOver={allow} onDragLeave={() => setDropX(null)} onDrop={(e) => onDrop(e, laneAt(e.clientY))}
          onPointerDown={(e) => { if ((e.target as HTMLElement).closest(".clip,.trb,.mk")) return; if ((e.target as HTMLElement).dataset.lane) { editor.select([]); playerRef.current?.seek(xToT(e.clientX)); } }}>
          <div className="tlcontent" style={{ width }}>
            <Ruler p={p} zoom={zoom} width={width} onDown={scrub} />
            {p.tracks.map((tr) => (
              <div key={tr.id} className={"lane " + tr.kind + (tr.locked ? " locked" : "") + (tr.hidden ? " hidden" : "")} data-lane={tr.id} style={{ height: LANE[tr.kind] }}>
                {tr.clips.map((c) => <ClipView key={c.id} c={c} p={p} zoom={zoom} sel={editor.selection.includes(c.id)} kind={tr.kind} onDown={startDrag} />)}
                {p.transitions.filter((x) => x.track === tr.id).map((x) => { const b = tr.clips.find((c) => c.id === x.b); return b ? <TransBadge key={x.id} id={x.id} at={b.start * zoom} w={x.dur * zoom} type={x.type} /> : null; })}
              </div>
            ))}
            <Playhead zoom={zoom} />
            {snapAt != null && <div className="snapline" style={{ left: snapAt * zoom }} />}
            {dropX != null && <div className="dropline" style={{ left: dropX }} />}
          </div>
        </div>
      </div>
    </section>
  );
}
function Head({ tr, p }: { tr: Track; p: Project }) {
  const { t } = useTranslation(); const set = (k: string, v: boolean) => A.run("track", (q) => C.COMMANDS.track.run(q, { id: tr.id, [k]: v }));
  return (
    <div className={"thead " + tr.kind} style={{ height: LANE[tr.kind] }} data-head={tr.id}>
      <Icon name={tr.kind === "audio" ? "audio" : tr.kind === "text" ? "text" : "film"} size={14} />
      <b title={tr.name}>{tr.name}</b>
      <span className="hb">
        <button type="button" aria-pressed={tr.locked} onClick={() => set("locked", !tr.locked)} aria-label={t("tl.lock", { n: tr.name })} title={t("tl.lock", { n: tr.name })}><Icon name={tr.locked ? "lock" : "unlock"} size={14} /></button>
        {tr.kind !== "audio" && <button type="button" aria-pressed={tr.hidden} onClick={() => set("hidden", !tr.hidden)} aria-label={t("tl.hide", { n: tr.name })} title={t("tl.hide", { n: tr.name })}><Icon name={tr.hidden ? "eyeoff" : "eye"} size={14} /></button>}
        {tr.kind !== "text" && <button type="button" aria-pressed={tr.muted} onClick={() => set("muted", !tr.muted)} aria-label={t("tl.mute", { n: tr.name })} title={t("tl.mute", { n: tr.name })}>M</button>}
        {tr.kind !== "text" && <button type="button" aria-pressed={tr.solo} onClick={() => set("solo", !tr.solo)} aria-label={t("tl.solo", { n: tr.name })} title={t("tl.solo", { n: tr.name })}>S</button>}
        {!tr.clips.length && p.tracks.filter((x) => x.kind === tr.kind).length > 1 && <button type="button" onClick={() => A.run("remove track", (q) => C.removeTrack(q, tr.id))} aria-label={t("tl.removeTrack", { n: tr.name })} title={t("tl.removeTrack", { n: tr.name })}><Icon name="close" size={14} /></button>}
      </span>
    </div>
  );
}
function Ruler({ p, zoom, width, onDown }: { p: Project; zoom: number; width: number; onDown: (e: RPE) => void }) {
  const step = zoom > 150 ? 0.5 : zoom > 60 ? 1 : zoom > 25 ? 2 : zoom > 10 ? 5 : 10; const ticks: number[] = []; for (let x = 0; x * zoom < width; x += step) ticks.push(x);
  return (
    <div className="ruler" style={{ height: RULER }} onPointerDown={onDown} data-testid="ruler">
      {ticks.map((x) => <span key={x} style={{ left: x * zoom }}>{Number.isInteger(x) ? (x >= 60 ? Math.floor(x / 60) + ":" + String(x % 60).padStart(2, "0") : x + "s") : ""}</span>)}
      {p.beats.map((b, i) => <i key={"b" + i} className="beat" style={{ left: b * zoom }} />)}
      {p.markers.map((m) => <button key={m.id} type="button" className="mk" style={{ left: m.t * zoom, background: m.color }} title={m.name || C.uid("").slice(0, 0) + m.t.toFixed(2) + "s"}
        onPointerDown={(e) => { e.stopPropagation(); const x0 = e.clientX, t0 = m.t; let mv0 = false; editor.begin("marker");
          const mv = (ev: PointerEvent) => { mv0 = true; editor.live((q) => { const k = q.markers.find((y) => y.id === m.id); if (k) k.t = Math.max(0, t0 + (ev.clientX - x0) / zoom); }); };
          const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); if (mv0) { editor.commit(); autosave(); } else { editor.cancel(); playerRef.current?.seek(m.t); } };
          window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); }}
        onDoubleClick={() => { const n = prompt("", m.name); if (n != null) A.run("marker", (q) => { const k = q.markers.find((y) => y.id === m.id); if (k) k.name = n.slice(0, 40); }); }}
        onContextMenu={(e) => { e.preventDefault(); A.run("marker", (q) => { q.markers = q.markers.filter((y) => y.id !== m.id); }); }} aria-label={m.name || "marker"} />)}
    </div>
  );
}
const ClipView = memo(function ClipView({ c, p, zoom, sel, kind, onDown }: { c: Clip; p: Project; zoom: number; sel: boolean; kind: Track["kind"]; onDown: (e: RPE, c: Clip, part: "body" | "l" | "r") => void }) {
  const a = c.type === "media" ? p.assets[c.asset] : null; const w = Math.max(2, c.dur * zoom);
  const isAudio = kind === "audio" || a?.kind === "audio";
  const style: React.CSSProperties = { left: c.start * zoom, width: w };
  if (a?.thumb && !isAudio) { style.backgroundImage = `url(${a.thumb})`; }
  const kfs = Object.values(c.keyframes).flatMap((l) => (l || []).map((k) => k.t));
  return (
    <div className={"clip " + (c.type === "text" ? "text" : isAudio ? "audio" : "video") + (sel ? " sel" : "")} style={style} onPointerDown={(e) => onDown(e, c, "body")} data-clip={c.id} title={c.name} role="button" aria-pressed={sel} aria-label={c.name || (c.type === "text" ? c.text : a?.name)}>
      {isAudio && a?.waveform && <ClipWave c={c as MediaClip} peaks={a.waveform} dur={a.duration || 1} />}
      <span className="cn" dir="auto">{c.type === "text" ? c.text : c.name || a?.name}</span>
      {c.type === "media" && c.speed !== 1 && <span className="badge">{c.speed.toFixed(2).replace(/\.?0+$/, "")}×</span>}
      {c.type === "media" && c.reverse && <span className="badge">↺</span>}
      {c.type === "media" && c.effects.length > 0 && <span className="badge">fx</span>}
      {c.type === "media" && c.freeze != null && <span className="badge">❄</span>}
      {kfs.map((x, i) => <i key={i} className="kfm" style={{ left: x * zoom }} />)}
      {c.type === "media" && c.fadeIn > 0 && <i className="fade l" style={{ width: c.fadeIn * zoom }} />}
      {c.type === "media" && c.fadeOut > 0 && <i className="fade r" style={{ width: c.fadeOut * zoom }} />}
      <span className="eh l" onPointerDown={(e) => onDown(e, c, "l")} aria-hidden="true" />
      <span className="eh r" onPointerDown={(e) => onDown(e, c, "r")} aria-hidden="true" />
    </div>
  );
});
function ClipWave({ c, peaks, dur }: { c: MediaClip; peaks: number[]; dur: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const cv = ref.current; if (!cv) return; const W = (cv.width = Math.min(4000, cv.clientWidth)), H = (cv.height = cv.clientHeight); const x = cv.getContext("2d")!; x.clearRect(0, 0, W, H); x.fillStyle = "rgba(255,255,255,.55)";
    const a0 = c.in / dur, a1 = (c.in + c.dur * c.speed) / dur, n = peaks.length;
    for (let i = 0; i < W; i++) { const k = c.reverse ? 1 - i / W : i / W; const v = peaks[Math.floor((a0 + (a1 - a0) * k) * n)] || 0; const h = Math.max(1, v * H * 0.85 * Math.min(2, c.volume)); x.fillRect(i, (H - h) / 2, 1, h); } }, [c.in, c.dur, c.speed, c.volume, c.reverse, peaks, dur]);
  return <canvas ref={ref} className="cwave" aria-hidden="true" />;
}
function TransBadge({ id, at, w, type }: { id: string; at: number; w: number; type: string }) {
  const { t } = useTranslation(); const [open, setOpen] = useState(false); const tr = editor.project.transitions.find((x) => x.id === id);
  return (<>
    <button type="button" className="trb" style={{ left: at - Math.max(10, w) / 2, width: Math.max(10, w) }} onClick={() => setOpen(!open)} title={type} aria-label={t("tl.transition", { n: type })}><Icon name="transitions" size={14} /></button>
    {open && tr && <div className="trpop" style={{ left: at }} role="dialog">
      <label className="ns-field"><span>{t("tl.transDur")}<b>{tr.dur.toFixed(2)}s</b></span><input className="ns-range" type="range" min={0.1} max={3} step={0.05} value={tr.dur} onChange={(e) => A.run("transition", (q) => { const x = q.transitions.find((y) => y.id === id); if (x) x.dur = +e.target.value; })} /></label>
      <div className="row"><Btn icon="trash" danger onClick={() => { A.run("transition", (q) => { q.transitions = q.transitions.filter((y) => y.id !== id); }); setOpen(false); }}>{t("act.delete")}</Btn><Btn icon="check" onClick={() => setOpen(false)}>{t("act.done")}</Btn></div>
    </div>}
  </>);
}
function Playhead({ zoom }: { zoom: number }) {
  const [, f] = useState(0); useEffect(() => playerRef.current?.onClock(() => f((x) => x + 1)), [playerRef.current]);
  const tt = playerRef.current?.clock.t ?? 0; return <div className="playhead" style={{ left: tt * zoom }} data-testid="playhead"><i /></div>;
}
