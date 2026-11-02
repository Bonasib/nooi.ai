// Captions you write or bring (.srt / .vtt) become text clips on a captions track, in one caption style you can change.
// (Automatic captions from speech come with the AI features — Phase 2.)
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { Btn } from "@nooi/ui";
import { textClip, textStyle0, addClip, addTrack } from "@nooi/editor-core";
import * as A from "../actions";
import { toast } from "../state";
import { parseSubs } from "../subs";
export { parseSubs };

export function CaptionsPanel() {
  const { t } = useTranslation(); const [txt, setTxt] = useState(""); const [secs, setSecs] = useState(2.5); const ref = useRef<HTMLInputElement>(null);
  const place = (items: { a: number; b: number; text: string }[]) => {
    if (!items.length) { toast(t("cap.none"), "info"); return; }
    A.run("captions", (p) => {
      const tr = addTrack(p, "text", 0); tr.name = t("cap.track");
      for (const it of items) { const c = textClip(it.text, it.a, { dur: Math.max(0.3, it.b - it.a), style: textStyle0({ size: 0.055, box: { color: "#000000", opacity: 0.55, pad: 0.25, radius: 0.2 } }), animIn: { type: "fade", dur: 0.12 }, animOut: { type: "fade", dur: 0.12 } }); c.transform.y = 0.36; addClip(p, c, tr.id); }
    });
    toast(t("cap.added", { n: items.length }), "ok");
  };
  const fromLines = () => { const lines = txt.split("\n").map((l) => l.trim()).filter(Boolean); const at = A.now(); place(lines.map((l, i) => ({ a: at + i * secs, b: at + (i + 1) * secs, text: l }))); setTxt(""); };
  return (<>
    <p className="hint">{t("cap.hint")}</p>
    <textarea className="ns-input" rows={5} dir="auto" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={t("cap.placeholder")} aria-label={t("cap.lines")} />
    <label className="ns-field"><span>{t("cap.each")}<b>{secs}s</b></span><input className="ns-range" type="range" min={0.8} max={6} step={0.1} value={secs} onChange={(e) => setSecs(+e.target.value)} /></label>
    <div className="addrow"><Btn icon="captions" primary onClick={fromLines} disabled={!txt.trim()} testid="cap-add">{t("cap.place")}</Btn>
      <Btn icon="upload" onClick={() => ref.current?.click()}>{t("cap.import")}</Btn>
      <input ref={ref} type="file" accept=".srt,.vtt,text/vtt" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) place(parseSubs(await f.text())); e.target.value = ""; }} data-testid="srt-input" /></div>
    <p className="hint">{t("cap.auto")}</p>
  </>);
}
