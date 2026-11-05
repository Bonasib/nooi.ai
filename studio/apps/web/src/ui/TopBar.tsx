import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Btn, Icon } from "@nooi/ui";
import { ASPECTS, aspectOf, duration } from "@nooi/editor-core";
import type { Aspect } from "@nooi/editor-core";
import { editor, ui, useProject, useUI, autosave } from "../state";
import { api } from "../api";
import * as A from "../actions";
import { at } from "../site";
import { CloudButton, FileMenu, WorkspaceSwitch } from "./Shell";
import { SiteMenu, useSiteBar } from "./SiteBar";

const LOGO = <svg viewBox="405 600 690 270" aria-hidden="true"><path d="M443.3 783.6V726A77.5 77.5 0 0 1 598.3 726V805.6A76.7 76.7 0 0 0 751.7 805.6V771.6A76.1 76.1 0 0 1 903.9 771.6V795.7A76.6 76.6 0 0 0 1057.1 795.7V706.3" fill="none" stroke="#c1ff72" strokeWidth="59.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="1056.6" cy="663.9" r="29.5" fill="#c1ff72" /></svg>;
const CREW = [["PR", "#2dd4a8"], ["WR", "#4dc3ff"], ["DR", "#f5a524"], ["CI", "#d9f43b"], ["AD", "#ff6b9a"], ["ED", "#c38bff"], ["SD", "#ff8a4d"], ["CL", "#7df9ff"], ["RV", "#a3a7b0"]];
export function TopBar() {
  const { t } = useTranslation(); const p = useProject(); const mate = useUI((s) => s.mate); const theme = useUI((s) => s.theme); const lang = useUI((s) => s.lang);
  const [me, setMe] = useState(api.me); useEffect(() => api.on(() => setMe({ ...api.me })), []);
  const aspect = aspectOf(p.width, p.height); const narrow = typeof matchMedia !== "undefined" && matchMedia("(max-width: 767px)").matches; const bar = useSiteBar();   // (a phone: just the ratio)
  return (
    <header className="topbar" role="banner">
      {narrow || !bar ? <SiteMenu /> : <a className="logo" href={at("/?view=home")} aria-label={t("top.home")} title={t("top.home")}>{LOGO}</a>}
      <h1 className="sr-only">{t("app.title")}</h1>
      <input className="pname" value={p.name} aria-label={t("top.name")} onChange={(e) => { editor.run("rename", (d) => { d.name = e.target.value.slice(0, 80); }); autosave(); }} />
      <FileMenu />
      <CloudButton />
      <div className="tgroup">
        <WorkspaceSwitch />
        <button type="button" className={"matebtn" + (mate ? " on" : "")} aria-pressed={mate} onClick={() => ui.set({ mate: !mate })} data-testid="mate-open" title={t("mate.title")}><Icon name="sparkle" size={16} /><span>{t("mate.title")}</span></button>
        <button type="button" className="ns-btn kbtn" onClick={() => ui.set({ paletteOpen: true })} aria-label={t("palette.open")} title={t("palette.open") + " (Ctrl+K)"}><Icon name="search" size={14} /><span className="kword">{t("palette.search")}</span><kbd>⌘K</kbd></button>
        <a className="crew" href={at("/#crew")} title={t("top.crew")} aria-label={t("top.crew")}>{CREW.slice(0, 4).map(([n, c]) => <i key={n} style={{ background: c }}>{n}</i>)}<b>9</b></a>
      </div>
      <div className="tright">
        <label className="fmt" title={t("top.format")}>
          <span className="sr-only">{t("top.format")}</span>
          <select value={aspect} onChange={(e) => A.format(e.target.value as Aspect)} aria-label={t("top.format")}>{ASPECTS.map((a) => <option key={a} value={a}>{narrow ? a : a + " · " + t("aspect." + a.replace(":", "x"))}</option>)}</select>
          <small dir="ltr">{p.width}×{p.height} · {duration(p).toFixed(1)}s</small>
        </label>
        {me.free ? <span className="credits" title={t("top.free")} data-testid="top-free"><Icon name="sparkle" size={14} />{t("top.freeShort")}</span> : me.credits != null && <span className="credits" title={t("top.credits")}><Icon name="sparkle" size={14} />{me.credits}</span>}
        <Btn icon={theme === "dark" ? "sun" : "moon"} label={t("top.theme")} onClick={() => ui.set({ theme: theme === "dark" ? "light" : "dark" })} />
        <Btn icon="globe" label={lang === "ar" ? "English" : "العربية"} onClick={() => ui.set({ lang: lang === "ar" ? "en" : "ar" })} testid="lang" />
        <Btn icon="folder" label={t("top.projects")} onClick={() => ui.set({ projectsOpen: true })} testid="projects" />
        <Btn icon="export" primary onClick={() => ui.set({ exportOpen: true })} testid="export">{t("top.export")}</Btn>
      </div>
    </header>
  );
}
