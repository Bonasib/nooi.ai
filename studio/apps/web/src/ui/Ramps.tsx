// (v244) Speed ramps in the clip's Speed tab: each tile shows its curve (the icon) and a dot that moves at its speeds (the example).
import { useTranslation } from "react-i18next";
import { RAMPS, rampAt, speedRamp } from "@nooi/editor-core";
import type { MediaClip } from "@nooi/editor-core";
import { toast, useUI } from "../state";
import * as A from "../actions";

const css = RAMPS.map((r) => `@keyframes rmp-${r.id}{${Array.from({ length: 21 }, (_, i) => `${i * 5}%{left:${(rampAt(r.curve, i / 20) * 100).toFixed(1)}%}`).join("")}}`).join("");
/** the curve as a little line: up is faster (the speeds on a log scale) */
export function RampIcon({ curve, w = 44, h = 22 }: { curve: number[]; w?: number; h?: number }) {
  const y = (k: number) => h - 2 - ((Math.log2(k) + 3) / 6) * (h - 4); const n = curve.length;
  const d = curve.map((k, i) => `${i ? "L" : "M"}${((i / (n - 1)) * (w - 4) + 2).toFixed(1)} ${y(k).toFixed(1)}`).join(" ");
  return <svg className="rmpic" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><path d={`M2 ${y(1)}H${w - 2}`} className="rmp1" /><path d={d} className="rmpc" /></svg>;
}
export function RampTiles({ clip }: { clip: MediaClip }) {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang);
  const go = (id: string) => { const r = RAMPS.find((x) => x.id === id)!; const ok = A.run("speed ramp: " + r.en, (p) => speedRamp(p, clip.id, r.curve)); toast(ok ? t("rmp.done", { name: lang === "ar" ? r.ar : r.en }) : t("rmp.cant"), ok ? "ok" : "warn"); };
  return <><style>{css}</style><div className="rmpg" data-testid="ramps">{RAMPS.map((r) => <button key={r.id} type="button" className="rmpt" onClick={() => go(r.id)} disabled={clip.reverse || clip.freeze != null} data-testid={"ramp-" + r.id}>
    <RampIcon curve={r.curve} /><span className="rmpx" aria-hidden="true"><i style={{ animation: `rmp-${r.id} 2.4s linear infinite` }} /></span><b>{lang === "ar" ? r.ar : r.en}</b></button>)}</div>
    <p className="hint">{t("rmp.hint")}</p></>;
}
