// Fonts by language and text effects, each shown before it is chosen: a font tile writes a sample in that font (the clip's own words
// when they are in that script); an effect tile is drawn by the same text engine the preview and the export use.
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { FONT_LIST, SCRIPTS, TEXT_FX, scriptOf, textClip, textStyle0 } from "@nooi/editor-core";
import type { Script, TextClip, TextStyle } from "@nooi/editor-core";
import { useUI, playerRef, editor } from "../state";
import * as A from "../actions";
import { loadFont, textCanvas } from "../engine/text";

// a font's tile loads the font only when it comes into view
function FontTile({ name, sample, on, onPick }: { name: string; sample: string; on: boolean; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null); const [ready, setReady] = useState(false);
  useEffect(() => { const el = ref.current; if (!el) return; const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); loadFont(name).then(() => setReady(true)); } }, { rootMargin: "120px" }); io.observe(el); return () => io.disconnect(); }, [name]);
  return <button ref={ref} type="button" className={"ns-tile fontt" + (ready ? " ready" : "")} aria-pressed={on} onClick={onPick} data-testid={"font-" + name.replace(/\s+/g, "_")}>
    <b dir="auto" style={{ fontFamily: `"${name}",var(--f)` }}>{sample}</b><span>{name}</span></button>;
}
export function FontPicker({ c }: { c: TextClip }) {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const [sc, setSc] = useState<Script>(scriptOf(c.text));
  const written = scriptOf(c.text); useEffect(() => setSc(written), [c.id, written]);   // (the picker follows the words as they are written)
  const meta = SCRIPTS.find((x) => x.id === sc)!; const own = scriptOf(c.text) === sc && c.text.trim() ? c.text.trim().split("\n")[0].slice(0, 16) : meta.sample.split(" · ")[0];
  const pick = (name: string) => { loadFont(name).then(() => { if (playerRef.current) (playerRef.current as unknown as { drawnV: number }).drawnV = -1; }); A.setProp("style.font", name, "text"); };
  return (<>
    <span className="ns-lbl">{t("text.font")}</span>
    <div className="chips scripts" role="tablist">{SCRIPTS.map((x) => <button key={x.id} type="button" role="tab" className="chip" aria-selected={sc === x.id} aria-pressed={sc === x.id} onClick={() => setSc(x.id)} data-testid={"script-" + x.id}>{lang === "ar" ? x.ar : x.en}</button>)}</div>
    <div className="fontpick" data-testid="fontpick">{FONT_LIST.filter((f) => f.scripts.includes(sc)).map((f) => <FontTile key={f.name} name={f.name} sample={own} on={c.style.font === f.name} onPick={() => pick(f.name)} />)}</div>
  </>);
}

// ---- text effects: the example is drawn by the text engine (the font first)
const shots = new Map<string, string>();
function FxTile({ id, sample, onPick }: { id: string; sample: string; onPick: () => void }) {
  const fx = TEXT_FX.find((x) => x.id === id)!; const lang = useUI((s) => s.lang); const [url, setUrl] = useState(shots.get(id + sample) || "");
  useEffect(() => {
    if (url) return; let live = true; const font = fx.font && FONT_LIST.find((f) => f.name === fx.font)?.scripts.includes(scriptOf(sample)) ? fx.font : scriptOf(sample) === "arabic" ? "Cairo" : "Inter";
    loadFont(font).then(() => {
      if (!live) return; const c = textClip(sample, 0, { id: "fx:" + id + ":" + sample, dur: 3, style: { ...textStyle0({ font, size: 0.34, weight: 800, shadow: null }), ...(fx.style as Partial<TextStyle>) }, animIn: { type: "none", dur: 0 }, animOut: { type: "none", dur: 0 } });
      const r = textCanvas(c, 1, 320, 180); const cv = Object.assign(document.createElement("canvas"), { width: 320, height: 180 }); cv.getContext("2d")!.drawImage(r.cv as CanvasImageSource, 0, 0);
      const u = cv.toDataURL("image/png"); shots.set(id + sample, u); setUrl(u);
    });
    return () => { live = false; };
  }, [id, sample]);
  return <button type="button" className="ns-tile fxt" onClick={onPick} data-testid={"tfx-" + id} title={lang === "ar" ? fx.ar : fx.en}>
    <span className="fxbg">{url ? <img src={url} alt="" draggable={false} /> : <i className="ld" />}</span><span>{lang === "ar" ? fx.ar : fx.en}</span></button>;
}
/** a text effect on the picked title, or a new title with it */
export function applyTextFx(id: string) {
  const fx = TEXT_FX.find((x) => x.id === id); if (!fx) return;
  let c = A.sel1(); if (!c || c.type !== "text") { A.addText("title"); c = A.sel1(); } if (!c || c.type !== "text") return; const tc = c;
  const font = fx.font && FONT_LIST.find((f) => f.name === fx.font)?.scripts.includes(scriptOf(tc.text)) ? fx.font : undefined;
  if (font) void loadFont(font);
  A.run("text effect", (p) => { for (const tr of p.tracks) for (const k of tr.clips) if (k.id === tc.id && k.type === "text") k.style = { ...k.style, gradient: null, extrude: null, glow: null, outline2: null, ...(fx.style as Partial<TextStyle>), ...(font ? { font } : {}) }; });
  editor.select([tc.id]);
}
export function TextFxGrid() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const sel = A.sel1(); const sample = sel?.type === "text" && sel.text.trim() ? sel.text.trim().split("\n")[0].slice(0, 10) : lang === "ar" ? "نوي" : "nooi";
  return (<>
    <span className="ns-lbl">{t("text.effects")}</span>
    <div className="ns-grid fxg" data-testid="textfx">{TEXT_FX.map((x) => <FxTile key={x.id} id={x.id} sample={sample} onPick={() => applyTextFx(x.id)} />)}</div>
  </>);
}
