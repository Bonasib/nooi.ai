// The phone's tool bar for a picked clip (as in the classic editor): its settings by part, and the everyday actions at once.
import { useTranslation } from "react-i18next";
import { Icon } from "@nooi/ui";
import { findClip } from "@nooi/editor-core";
import { editor, ui, useProject } from "../state";
import * as A from "../actions";

export function ClipBar({ openSettings }: { openSettings: (tab: string) => void }) {
  const { t } = useTranslation(); const p = useProject();
  const c = editor.selection.length === 1 ? findClip(p, editor.selection[0])?.clip : null; if (!c) return null;
  const media = c.type === "media", sound = media && p.assets[c.asset]?.kind === "audio";
  const panel = (rail: "effects" | "color" | "ai", sub?: string) => () => ui.set((s) => ({ rail, panelOpen: true, sub: sub ? { ...s.sub, [rail]: sub } : s.sub }));
  const items: [string, string, () => void, boolean?][] = [
    ["edit", c.type === "text" ? "text" : "select", () => openSettings(c.type === "text" ? "text" : sound ? "audio" : "video")],
    ["split", "split", A.split],
    ["speed", "speed", () => openSettings("speed"), !media],
    ["volume", "volume", () => openSettings("audio"), !media],
    ["color", "color", () => openSettings("color"), !media || sound],
    ["effects", "effects", panel("effects", "effects"), !media || sound],
    ["motion", "keyframe", panel("effects", "motion"), sound],
    ["transition", "transitions", panel("effects", "transitions"), !media || sound],
    ["freeze", "freeze", A.freeze, !media || sound],
    ["mirror", "flip", () => A.setProp("transform.flipH", !c.transform.flipH), !media || sound],
    ["reset", "undo", A.resetTransform, sound],
    ["duplicate", "copy", A.duplicate],
    ["ai", "ai", panel("ai"), !media],
    ["delete", "trash", () => A.del(false)],
  ];
  return (
    <nav className="clipbar" aria-label={t("cb.label")} data-testid="clipbar">
      <button type="button" className="cbx" onClick={() => editor.select([])} aria-label={t("insp.close")} title={t("insp.close")}><Icon name="close" size={20} /></button>
      <div className="cbs">{items.filter((x) => !x[3]).map(([k, ic, fn]) => <button key={k} type="button" onClick={fn} data-testid={"cb-" + k}><Icon name={ic} size={20} /><span>{t("cb." + k)}</span></button>)}</div>
    </nav>
  );
}
