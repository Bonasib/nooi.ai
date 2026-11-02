import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Btn, Icon } from "@nooi/ui";
import { ASPECTS, aspectOf, duration } from "@nooi/editor-core";
import type { Aspect } from "@nooi/editor-core";
import { editor, ui, useProject, useUI, autosave } from "../state";
import { api } from "../api";
import * as A from "../actions";

const CREW = [["PR", "#2dd4a8"], ["WR", "#4dc3ff"], ["DR", "#f5a524"], ["CI", "#d9f43b"], ["AD", "#ff6b9a"], ["ED", "#c38bff"], ["SD", "#ff8a4d"], ["CL", "#7df9ff"], ["RV", "#a3a7b0"]];
export function TopBar() {
  const { t } = useTranslation(); const p = useProject(); const saved = useUI((s) => s.saved); const zoom = useUI((s) => s.zoom); const theme = useUI((s) => s.theme); const lang = useUI((s) => s.lang);
  const [me, setMe] = useState(api.me); useEffect(() => api.on(() => setMe({ ...api.me })), []);
  const aspect = aspectOf(p.width, p.height);
  return (
    <header className="topbar" role="banner">
      <a className="logo" href="/" aria-label={t("top.home")} title={t("top.home")}><svg viewBox="384 522 732 456" aria-hidden="true"><rect x="384.3" y="522" width="731.4" height="456" rx="75" fill="#c1ff72" /><path d="M443.3 783.6V726A77.5 77.5 0 0 1 598.3 726V805.6A76.7 76.7 0 0 0 751.7 805.6V771.6A76.1 76.1 0 0 1 903.9 771.6V795.7A76.6 76.6 0 0 0 1057.1 795.7V706.3" fill="none" stroke="#000" strokeWidth="59.5" /><circle cx="1056.6" cy="663.9" r="29.5" fill="#000" /></svg></a>
      <h1 className="sr-only">{t("app.title")}</h1>
      <input className="pname" value={p.name} aria-label={t("top.name")} onChange={(e) => { editor.run("rename", (d) => { d.name = e.target.value.slice(0, 80); }); autosave(); }} />
      <span className={"saved " + saved} title={t("save." + saved)}><Icon name="cloud" size={14} /><span>{t("save." + saved)}</span></span>
      <div className="tgroup">
        <Btn icon="undo" label={t("act.undo")} kbd="Ctrl+Z" onClick={A.undo} disabled={!editor.canUndo} testid="undo" />
        <Btn icon="redo" label={t("act.redo")} kbd="Ctrl+Shift+Z" onClick={A.redo} disabled={!editor.canRedo} testid="redo" />
        <span className="zoomgrp"><Btn icon="minus" label={t("tl.zoomOut")} onClick={() => A.zoom(1 / 1.25)} /><b dir="ltr">{Math.round((zoom / 60) * 100)}%</b><Btn icon="plus" label={t("tl.zoomIn")} onClick={() => A.zoom(1.25)} /></span>
        <button type="button" className="ns-btn kbtn" onClick={() => ui.set({ paletteOpen: true })} aria-label={t("palette.open")} title={t("palette.open") + " (Ctrl+K)"}><Icon name="search" size={14} /><span className="kword">{t("palette.search")}</span><kbd>⌘K</kbd></button>
        <a className="crew" href="/#crew" title={t("top.crew")} aria-label={t("top.crew")}>{CREW.slice(0, 4).map(([n, c]) => <i key={n} style={{ background: c }}>{n}</i>)}<b>9</b></a>
      </div>
      <div className="tright">
        <label className="fmt" title={t("top.format")}>
          <span className="sr-only">{t("top.format")}</span>
          <select value={aspect} onChange={(e) => A.format(e.target.value as Aspect)} aria-label={t("top.format")}>{ASPECTS.map((a) => <option key={a} value={a}>{a} · {t("aspect." + a.replace(":", "x"))}</option>)}</select>
          <small dir="ltr">{p.width}×{p.height} · {duration(p).toFixed(1)}s</small>
        </label>
        {me.credits != null && <span className="credits" title={t("top.credits")}><Icon name="sparkle" size={14} />{me.credits}</span>}
        <Btn icon={theme === "dark" ? "sun" : "moon"} label={t("top.theme")} onClick={() => ui.set({ theme: theme === "dark" ? "light" : "dark" })} />
        <Btn icon="globe" label={lang === "ar" ? "English" : "العربية"} onClick={() => ui.set({ lang: lang === "ar" ? "en" : "ar" })} testid="lang" />
        <Btn icon="folder" label={t("top.projects")} onClick={() => ui.set({ projectsOpen: true })} testid="projects" />
        <Btn icon="export" primary onClick={() => ui.set({ exportOpen: true })} testid="export">{t("top.export")}</Btn>
      </div>
    </header>
  );
}
