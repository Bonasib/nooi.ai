// The properties of what is picked — each value with a ◆ to set a keyframe at the playhead; with nothing picked, the project's own.
import { useTranslation } from "react-i18next";
import { Btn, Icon, Seg, Slider } from "@nooi/ui";
import { BLEND_MODES, EFFECTS, FONTS, HUE_BANDS, PRESETS, TEXT_ANIMS, findClip, propAt, frameSize } from "@nooi/editor-core";
import type { Clip, KfProp, MediaClip, TextClip } from "@nooi/editor-core";
import { editor, ui, useProject, useUI, playerRef, autosave } from "../state";
import * as A from "../actions";
import { loadFont } from "../engine/text";

const KF: Partial<Record<string, KfProp>> = { "transform.x": "x", "transform.y": "y", "transform.scale": "scale", "transform.rotation": "rotation", opacity: "opacity", volume: "volume" };
function Prop({ c, path, label, min, max, step, unit, fmt }: { c: Clip; path: string; label: string; min: number; max: number; step?: number; unit?: string; fmt?: (v: number) => string }) {
  const { t } = useTranslation(); const kp = KF[path]; const local = (playerRef.current?.clock.t ?? 0) - c.start;
  const val = kp ? propAt(c, kp, Math.max(0, Math.min(c.dur, local))) : (path.split(".").reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], c) as number) ?? 0;
  const keyed = kp && (c.keyframes[kp] || []).length > 0; const here = kp && (c.keyframes[kp] || []).some((k) => Math.abs(k.t - local) < 1e-3);
  const set = (v: number) => {
    if (kp && keyed) { if (!editor.inTx) editor.begin("keyframe"); editor.live((p) => { const f = findClip(p, c.id); if (!f) return; const l = local; const list = f.clip.keyframes[kp] || []; const i = list.findIndex((k) => Math.abs(k.t - l) < 1e-3); const nl = [...list]; if (i >= 0) nl[i] = { ...nl[i], v }; else { nl.push({ t: l, v, ease: "easeInOut" }); nl.sort((a, b) => a.t - b.t); } f.clip.keyframes = { ...f.clip.keyframes, [kp]: nl }; }); }
    else A.live.set(path, v);
  };
  return (
    <div className="prop">
      <Slider label={label} value={val} min={min} max={max} step={step} unit={unit} fmt={fmt} onChange={set} onCommit={A.live.end} />
      {kp && <button type="button" className={"kf" + (here ? " on" : keyed ? " some" : "")} onClick={() => A.keyframe(kp)} aria-label={t("insp.keyframe", { p: label })} title={t("insp.keyframe", { p: label })}><Icon name="keyframe" size={14} /></button>}
    </div>
  );
}
export function Inspector() {
  const { t } = useTranslation(); const p = useProject(); const tab = useUI((s) => s.inspector); const lang = useUI((s) => s.lang);
  const clips = editor.selection.map((id) => findClip(p, id)?.clip).filter(Boolean) as Clip[]; const c = clips[0];
  if (!c) return <ProjectProps />;
  const tabs = c.type === "text" ? ["text", "video"] : p.assets[c.asset]?.kind === "audio" ? ["audio", "speed"] : ["video", "speed", "audio", "color", "effects"];
  const cur = tabs.includes(tab) ? tab : tabs[0];
  return (
    <section className="inspector" aria-label={t("insp.label")}>
      <div className="ihead"><h2 className="ns-h2">{c.type === "text" ? t("insp.text") : t("insp.clip")}</h2><span className="iname" dir="auto">{c.name || (c.type === "media" ? p.assets[c.asset]?.name : (c as TextClip).text)}</span>
        <Btn icon="close" ghost label={t("insp.close")} onClick={() => editor.select([])} /></div>
      {clips.length > 1 && <p className="hint">{t("insp.many", { n: clips.length })}</p>}
      <div className="subtabs" role="tablist">{tabs.map((x) => <button key={x} role="tab" type="button" aria-selected={cur === x} onClick={() => ui.set({ inspector: x })} data-testid={"insp-" + x}>{t("insp." + x)}</button>)}</div>
      <div className="ibody" onPointerUp={() => { if (editor.inTx) A.live.end(); }}>
        {cur === "video" && <>
          <Prop c={c} path="transform.x" label={t("insp.x")} min={-1} max={1} />
          <Prop c={c} path="transform.y" label={t("insp.y")} min={-1} max={1} />
          <Prop c={c} path="transform.scale" label={t("insp.scale")} min={0.05} max={4} fmt={(v) => Math.round(v * 100) + "%"} />
          <Prop c={c} path="transform.rotation" label={t("insp.rotation")} min={-180} max={180} step={1} unit="°" />
          <Prop c={c} path="opacity" label={t("insp.opacity")} min={0} max={1} fmt={(v) => Math.round(v * 100) + "%"} />
          <div className="row"><Btn icon="flip" pressed={c.transform.flipH} onClick={() => A.setProp("transform.flipH", !c.transform.flipH)}>{t("insp.flipH")}</Btn><Btn icon="flip" pressed={c.transform.flipV} onClick={() => A.setProp("transform.flipV", !c.transform.flipV)}>{t("insp.flipV")}</Btn>
            <Btn icon="rotate" onClick={() => A.setProp("transform.rotation", ((c.transform.rotation + 90 + 180) % 360) - 180)}>90°</Btn></div>
          {c.type === "media" && <>
            <span className="ns-lbl">{t("insp.crop")}</span>
            {(["left", "top", "right", "bottom"] as const).map((k, i) => <Slider key={k} label={t("insp." + k)} value={c.transform.crop[i]} min={0} max={0.45} fmt={(v) => Math.round(v * 100) + "%"} onChange={(v) => { const cr = [...c.transform.crop] as [number, number, number, number]; cr[i] = v; A.live.set("transform.crop", cr); }} onCommit={A.live.end} />)}
            <label className="ns-field"><span>{t("insp.blend")}</span><select className="ns-input" value={(c as MediaClip).blend} onChange={(e) => A.setProp("blend", e.target.value)}>{BLEND_MODES.map((b) => <option key={b} value={b}>{t("blend." + b)}</option>)}</select></label>
          </>}
          <KfList c={c} />
        </>}
        {cur === "speed" && c.type === "media" && <>
          <Slider label={t("insp.speed")} value={c.speed} min={0.1} max={10} step={0.05} fmt={(v) => v.toFixed(2) + "×"} onChange={(v) => { if (!editor.inTx) editor.begin("speed"); editor.live((q) => { const f = findClip(q, c.id); if (f && f.clip.type === "media") { const src = f.clip.dur * f.clip.speed; f.clip.speed = v; f.clip.dur = Math.max(0.1, src / v); } }); }} onCommit={A.live.end} testid="speed" />
          <div className="chips">{[0.25, 0.5, 1, 1.5, 2, 4].map((v) => <button type="button" key={v} className="chip" aria-pressed={Math.abs(c.speed - v) < 1e-3} onClick={() => A.speed(v)}>{v}×</button>)}</div>
          <div className="row"><Btn icon="reverse" pressed={c.reverse} onClick={A.reverse} testid="reverse">{t("insp.reverse")}</Btn><Btn icon="freeze" onClick={A.freeze} testid="freeze">{t("insp.freeze")}</Btn></div>
          <p className="hint">{t("insp.speedHint")}</p>
        </>}
        {cur === "audio" && c.type === "media" && <>
          <Prop c={c} path="volume" label={t("insp.volume")} min={0} max={2} fmt={(v) => Math.round(v * 100) + "%"} />
          <Slider label={t("insp.fadeIn")} value={c.fadeIn} min={0} max={Math.min(5, c.dur / 2)} step={0.05} unit="s" onChange={(v) => A.live.set("fadeIn", v)} onCommit={A.live.end} />
          <Slider label={t("insp.fadeOut")} value={c.fadeOut} min={0} max={Math.min(5, c.dur / 2)} step={0.05} unit="s" onChange={(v) => A.live.set("fadeOut", v)} onCommit={A.live.end} />
          <div className="row"><Btn icon={c.muted ? "mute" : "volume"} pressed={c.muted} onClick={() => A.setProp("muted", !c.muted)}>{t("insp.mute")}</Btn>
            {p.assets[c.asset]?.kind === "video" && <Btn icon="detach" onClick={A.detach} testid="detach">{t("insp.detach")}</Btn>}
            <Btn icon="denoise" pressed={!!c.denoise} onClick={() => A.setProp("denoise", !c.denoise)}>{t("insp.denoise")}</Btn></div>
          {c.denoise && <p className="hint">{t("insp.denoiseHint")}</p>}
        </>}
        {cur === "color" && c.type === "media" && <ColorProps c={c} />}
        {cur === "effects" && c.type === "media" && <>
          {!c.effects.length && <p className="hint">{t("insp.noEffects")}</p>}
          {c.effects.map((e, i) => <div key={e.id} className="fxrow">
            <label className="row"><input type="checkbox" checked={e.enabled} onChange={(ev) => A.run("effect", (q) => { const f = findClip(q, c.id); if (f && f.clip.type === "media") f.clip.effects[i].enabled = ev.target.checked; })} /> {lang === "ar" ? EFFECTS.find((x) => x.id === e.type)?.ar : EFFECTS.find((x) => x.id === e.type)?.en}</label>
            <Slider label={t("insp.amount")} value={+e.params.amount} min={0.01} max={1} fmt={(v) => Math.round(v * 100) + "%"} onChange={(v) => A.live.set("effects." + i + ".params.amount", v)} onCommit={A.live.end} />
            <Btn icon="trash" ghost danger label={t("insp.removeFx")} onClick={() => A.run("effect", (q) => { const f = findClip(q, c.id); if (f && f.clip.type === "media") f.clip.effects.splice(i, 1); })} />
          </div>)}
          <Btn icon="plus" onClick={() => ui.set({ rail: "effects", panelOpen: true })}>{t("insp.addFx")}</Btn>
        </>}
        {cur === "text" && c.type === "text" && <TextProps c={c} />}
      </div>
    </section>
  );
}
function KfList({ c }: { c: Clip }) {
  const { t } = useTranslation(); const props = Object.entries(c.keyframes).filter(([, l]) => l && l.length);
  if (!props.length) return <p className="hint">{t("insp.kfHint")}</p>;
  return (<>
    <span className="ns-lbl">{t("insp.keyframes")}</span>
    {props.map(([k, list]) => <div key={k} className="kfrow"><b>{t("kf." + k)}</b>{list!.map((x, i) => (
      <span key={i} className="kfdot"><button type="button" onClick={() => playerRef.current?.seek(c.start + x.t)} title={x.t.toFixed(2) + "s"}>◆ {x.t.toFixed(1)}s</button>
        <select aria-label={t("insp.ease")} value={typeof x.ease === "string" ? x.ease : "easeInOut"} onChange={(e) => A.run("ease", (q) => { const f = findClip(q, c.id); const l = f?.clip.keyframes[k as KfProp]; if (l) l[i] = { ...l[i], ease: e.target.value as "linear" }; })}>
          {["linear", "easeIn", "easeOut", "easeInOut", "hold"].map((e) => <option key={e} value={e}>{t("ease." + e)}</option>)}</select></span>))}</div>)}
  </>);
}
function ColorProps({ c }: { c: MediaClip }) {
  const { t } = useTranslation(); const p = useProject();
  const S = (k: keyof MediaClip["color"], label: string) => <Slider key={k} label={label} value={c.color[k] as number} min={-1} max={1} fmt={(v) => (v > 0 ? "+" : "") + Math.round(v * 100)} onChange={(v) => A.live.set("color." + k, v)} onCommit={A.live.end} testid={"color-" + k} />;
  return (<>
    {S("exposure", t("col.exposure"))}{S("contrast", t("col.contrast"))}{S("saturation", t("col.saturation"))}{S("temperature", t("col.temperature"))}{S("tint", t("col.tint"))}
    {S("highlights", t("col.highlights"))}{S("shadows", t("col.shadows"))}{S("vibrance", t("col.vibrance"))}
    <span className="ns-lbl">HSL</span>
    {HUE_BANDS.map((b) => <details key={b} className="hsl"><summary><i className={"hue " + b} />{t("hue." + b)}</summary>
      {(["hue", "sat", "lum"] as const).map((k, i) => <Slider key={k} label={t("hsl." + k)} value={c.color.hsl[b][i]} min={-1} max={1} onChange={(v) => { const arr = [...c.color.hsl[b]] as [number, number, number]; arr[i] = v; A.live.set("color.hsl." + b, arr); }} onCommit={A.live.end} />)}</details>)}
    <span className="ns-lbl">LUT</span>
    {c.lut ? <><Slider label={(p.assets[c.lut.asset]?.name || "LUT") + " · " + t("insp.amount")} value={c.lut.amount} min={0} max={1} fmt={(v) => Math.round(v * 100) + "%"} onChange={(v) => A.live.set("lut.amount", v)} onCommit={A.live.end} />
      <Btn icon="close" ghost onClick={() => A.setProp("lut", null)}>{t("col.removeLut")}</Btn></> : <p className="hint">{t("col.lutHint")}</p>}
    <Btn icon="undo" ghost onClick={() => A.run("reset color", (q) => { const f = findClip(q, c.id); if (f && f.clip.type === "media") { f.clip.color = { ...f.clip.color, exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, vibrance: 0, hsl: Object.fromEntries(HUE_BANDS.map((b) => [b, [0, 0, 0]])) as MediaClip["color"]["hsl"] }; } })}>{t("col.reset")}</Btn>
  </>);
}
function TextProps({ c }: { c: TextClip }) {
  const { t } = useTranslation(); const s = c.style; const lang = useUI((x) => x.lang);
  const set = (path: string, v: unknown) => A.setProp(path, v, "text");
  return (<>
    <label className="ns-field"><span>{t("text.words")}</span><textarea className="ns-input" rows={3} dir="auto" value={c.text} onChange={(e) => { if (!editor.inTx) editor.begin("text"); editor.live((q) => { const f = findClip(q, c.id); if (f && f.clip.type === "text") { f.clip.text = e.target.value; f.clip.name = e.target.value.slice(0, 24); } }); }} onBlur={() => { editor.commit(); autosave(); }} data-testid="text-words" /></label>
    <span className="ns-lbl">{t("text.font")}</span>
    <div className="fontpick">{FONTS.filter((f) => f.ar === /[؀-ۿ]/.test(c.text) || !/[؀-ۿ]/.test(c.text)).slice(0, 12).map((f) => <button key={f.name} type="button" className="ns-tile" aria-pressed={s.font === f.name} onClick={() => { loadFont(f.name).then(() => playerRef.current && (playerRef.current as unknown as { drawnV: number }).drawnV--); set("style.font", f.name); }} style={{ fontFamily: `"${f.name}",var(--f)` }} onMouseEnter={() => loadFont(f.name)}>
      <b dir="auto">{c.text.slice(0, 10) || "Aa"}</b><span>{f.name}</span></button>)}</div>
    <Slider label={t("text.size")} value={s.size} min={0.02} max={0.3} fmt={(v) => Math.round(v * 1000) / 10 + "%"} onChange={(v) => A.live.set("style.size", v)} onCommit={A.live.end} />
    <div className="row"><Seg label={t("text.weight")} value={String(s.weight)} onChange={(v) => set("style.weight", +v)} options={[{ v: "400", label: t("text.regular") }, { v: "700", label: t("text.bold") }, { v: "900", label: t("text.black") }]} />
      <Seg label={t("text.align")} value={s.align} onChange={(v) => set("style.align", v)} options={[{ v: "start", label: t("text.start") }, { v: "center", label: t("text.center") }, { v: "end", label: t("text.end") }]} /></div>
    <label className="ns-field row"><span>{t("text.color")}</span><input type="color" value={s.color} onChange={(e) => A.live.set("style.color", e.target.value)} onBlur={A.live.end} /></label>
    <label className="row"><input type="checkbox" checked={!!s.stroke} onChange={(e) => set("style.stroke", e.target.checked ? { color: "#000000", width: 0.004 } : null)} /> {t("text.stroke")}</label>
    {s.stroke && <div className="row"><input type="color" value={s.stroke.color} onChange={(e) => set("style.stroke.color", e.target.value)} aria-label={t("text.strokeColor")} /><Slider label={t("text.strokeWidth")} value={s.stroke.width} min={0.001} max={0.02} step={0.0005} fmt={(v) => (v * 1000).toFixed(1)} onChange={(v) => A.live.set("style.stroke.width", v)} onCommit={A.live.end} /></div>}
    <label className="row"><input type="checkbox" checked={!!s.shadow} onChange={(e) => set("style.shadow", e.target.checked ? { color: "rgba(0,0,0,0.6)", blur: 0.012, x: 0, y: 0.004 } : null)} /> {t("text.shadow")}</label>
    <label className="row"><input type="checkbox" checked={!!s.box} onChange={(e) => set("style.box", e.target.checked ? { color: "#000000", opacity: 0.55, pad: 0.25, radius: 0.2 } : null)} /> {t("text.box")}</label>
    {s.box && <div className="row"><input type="color" value={s.box.color} onChange={(e) => set("style.box.color", e.target.value)} aria-label={t("text.boxColor")} /><Slider label={t("text.boxOpacity")} value={s.box.opacity} min={0} max={1} onChange={(v) => A.live.set("style.box.opacity", v)} onCommit={A.live.end} /></div>}
    <span className="ns-lbl">{t("text.animIn")}</span>
    <select className="ns-input" value={c.animIn.type} onChange={(e) => set("animIn.type", e.target.value)} aria-label={t("text.animIn")}>{TEXT_ANIMS.map((a) => <option key={a.id} value={a.id}>{lang === "ar" ? a.ar : a.en}</option>)}</select>
    <Slider label={t("text.animDur")} value={c.animIn.dur} min={0} max={2} step={0.05} unit="s" onChange={(v) => A.live.set("animIn.dur", v)} onCommit={A.live.end} />
    <span className="ns-lbl">{t("text.animOut")}</span>
    <select className="ns-input" value={c.animOut.type} onChange={(e) => set("animOut.type", e.target.value)} aria-label={t("text.animOut")}>{TEXT_ANIMS.map((a) => <option key={a.id} value={a.id}>{lang === "ar" ? a.ar : a.en}</option>)}</select>
    <Slider label={t("text.animDur")} value={c.animOut.dur} min={0} max={2} step={0.05} unit="s" onChange={(v) => A.live.set("animOut.dur", v)} onCommit={A.live.end} />
  </>);
}
function ProjectProps() {
  const { t } = useTranslation(); const p = useProject(); const lang = useUI((s) => s.lang);
  return (
    <section className="inspector" aria-label={t("insp.project")}>
      <div className="ihead"><h2 className="ns-h2">{t("insp.project")}</h2></div>
      <div className="ibody">
        <span className="ns-lbl">{t("insp.format")}</span>
        <div className="ns-grid">{PRESETS.slice(0, 9).map((x) => { const { w, h } = frameSize(x.aspect, "1080p"); const on = p.width === w && p.height === h; return (
          <button key={x.id} type="button" className="ns-tile" aria-pressed={on} onClick={() => A.run("format", (q) => { q.width = w; q.height = h; q.export.preset = x.id; })} data-testid={"fmt-" + x.id}>
            <i className="ratio" style={{ aspectRatio: w + "/" + h }} /><span>{lang === "ar" ? x.nameAr : x.name}</span><small dir="ltr">{x.aspect}</small></button>); })}</div>
        <span className="ns-lbl">{t("insp.fps")}</span>
        <Seg label={t("insp.fps")} value={String(p.fps)} onChange={(v) => A.run("fps", (q) => { q.fps = +v; q.export.fps = +v; })} options={["24", "25", "30", "60"].map((v) => ({ v, label: v }))} />
        <label className="ns-field row"><span>{t("insp.background")}</span><input type="color" value={p.background} onChange={(e) => A.run("background", (q) => { q.background = e.target.value; })} /></label>
        <p className="hint">{t("insp.pickHint")}</p>
      </div>
    </section>
  );
}
