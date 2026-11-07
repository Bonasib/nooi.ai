// (v231) The studio inside the site: the site's own sections along the top (the same ones as the site's header), each opening that
// page of nooi.ai; the editor is "Studio" (this page). On a phone the logo opens the same list as a menu. The editor is free in
// every plan — said here and on the plans page.
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@nooi/ui";
import { at } from "../site";
import { ui, useUI } from "../state";
import { api } from "../api";

export const SITE_PAGES: [string, string, string][] = [["home", "Home", "الرئيسية"], ["explore", "Explore", "استكشف"], ["image", "Image", "صورة"], ["video", "Video", "فيديو"], ["audio", "Audio", "صوت"],
  ["chars", "Characters", "الشخصيات"], ["world", "3D", "ثلاثي الأبعاد"], ["studio", "Studio", "الأستوديو"], ["calendar", "Publish", "النشر"], ["apps", "Apps", "التطبيقات"], ["account", "Plans", "الباقات"]];
// the bar only where there is height to spare (computers, tablets upright and big ones sideways); elsewhere the logo opens the list
const BAR_Q = "(min-width: 768px) and (min-height: 601px)";
export const siteBarOn = () => typeof matchMedia !== "undefined" && matchMedia(BAR_Q).matches;
// (v251) the site's sections show in the header only when there is room for all of them beside the account buttons
const NAV_Q = "(min-width: 1180px)";
function useNavRoom() { const [on, setOn] = useState(() => typeof matchMedia !== "undefined" && matchMedia(NAV_Q).matches); useEffect(() => { const m = matchMedia(NAV_Q), f = () => setOn(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []); return on; }
export function useSiteBar() { const [on, setOn] = useState(siteBarOn); useEffect(() => { const m = matchMedia(BAR_Q), f = () => setOn(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []); return on; }
export const pageHref = (id: string) => (id === "studio" ? at("/studio/") : at("/?view=" + id));   // (v232: home too — "/" alone could reopen the page the site remembered)

// (v251) the owner: "the editor's header must be the same as the site's". The studio now opens under the site's own header — the
// green nooi tile, the site's sections (on a computer), the theme, search, the credits, the language, the Library and the account —
// in the site's sizes and colours; on a phone the sections are behind the menu button, as on the site.
export const SITE_NAV: [string, string, string][] = [["explore", "Explore", "استكشف"], ["studio", "Studio", "الأستوديو"], ["image", "Image", "صورة"], ["video", "Video", "فيديو"], ["audio", "Audio", "صوت"],
  ["chars", "Characters", "الشخصيات"], ["world", "3D", "ثلاثي الأبعاد"], ["calendar", "Publish", "النشر"], ["apps", "All tools", "كل الأدوات"]];
const TILE = <svg viewBox="405 600 690 270" aria-hidden="true"><path d="M443.3 783.6V726A77.5 77.5 0 0 1 598.3 726V805.6A76.7 76.7 0 0 0 751.7 805.6V771.6A76.1 76.1 0 0 1 903.9 771.6V795.7A76.6 76.6 0 0 0 1057.1 795.7V706.3" fill="none" stroke="#0b0c0e" strokeWidth="59.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="1057" cy="640" r="30" fill="#0b0c0e" /></svg>;
export function SiteBar() {
  const { i18n, t } = useTranslation(); const ar = i18n.language === "ar"; const wide = useNavRoom(); const theme = useUI((s) => s.theme); const lang = useUI((s) => s.lang);
  const [me, setMe] = useState(api.me); useEffect(() => api.on(() => setMe({ ...api.me })), []);
  const initial = ([...(me.name || "").trim()][0] || "N").toUpperCase();
  return (<header className="sitebar sitehdr" data-testid="sitebar">
    <a className="shlogo" href={pageHref("home")} aria-label={ar ? "الرئيسية" : "Home"} title={ar ? "الرئيسية" : "Home"} data-testid="site-home">{TILE}</a>
    {wide ? <nav className="snav" aria-label={ar ? "أقسام الموقع" : "Site sections"}>{SITE_NAV.map(([id, en, a]) => <a key={id} href={pageHref(id)} aria-current={id === "studio" ? "page" : undefined} data-testid={"site-" + id}>{ar ? a : en}{id === "studio" && <i>{ar ? "جديد" : "New"}</i>}</a>)}</nav> : <SiteMenu />}
    <div className="shright">
      <button type="button" className="shround" onClick={() => ui.set({ theme: theme === "dark" ? "light" : "dark" })} aria-label={t("top.theme")} title={t("top.theme")} data-testid="site-theme"><Icon name={theme === "dark" ? "moon" : "sun"} size={18} /></button>
      <button type="button" className="shbtn" onClick={() => ui.set({ paletteOpen: true })} aria-label={t("palette.open")} title={t("palette.open") + " (Ctrl+K)"}><Icon name="search" size={16} /></button>
      {me.free ? <a className="shcredits credits" href={pageHref("account")} title={t("top.free")} data-testid="top-free"><Icon name="sparkle" size={14} /><span className="ctext">{t("top.freeShort")}</span></a>
        : <a className="shcredits credits" href={pageHref("account")} title={t("top.credits")} data-testid="top-credits"><Icon name="sparkle" size={14} />{me.credits ?? "—"}</a>}
      <button type="button" className="shbtn" onClick={() => ui.set({ lang: lang === "ar" ? "en" : "ar" })} aria-label={lang === "ar" ? "English" : "العربية"} title={lang === "ar" ? "English" : "العربية"} data-testid="lang"><Icon name="globe" size={16} /></button>
      {wide && <a className="shbtn shlib" href={at("/?view=library")} data-testid="site-library"><Icon name="template" size={14} /><span>{ar ? "المكتبة" : "Library"}</span></a>}
      <a className="shav" href={pageHref("account")} aria-label={ar ? "حسابي" : "My account"} title={me.name || (ar ? "حسابي" : "My account")} data-testid="site-account">{initial}</a>
    </div>
  </header>);
}
/** (v232) a phone (and a phone held sideways): a Home icon and, beside it, the menu of the site's sections */
export function SiteMenu() {
  const { i18n } = useTranslation(); const ar = i18n.language === "ar"; const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const f = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; addEventListener("pointerdown", f); return () => removeEventListener("pointerdown", f); }, [open]);
  return (<div className="smenu" ref={ref}>
    <button type="button" className="ns-btn icon" aria-expanded={open} aria-label={ar ? "أقسام الموقع" : "Site menu"} title={ar ? "أقسام الموقع" : "Site menu"} onClick={() => setOpen(!open)} data-testid="site-menu"><Icon name={open ? "close" : "menu"} size={18} /></button>
    {open && <div className="smenu-list" role="menu">{SITE_PAGES.map(([id, en, a]) => <a key={id} role="menuitem" href={pageHref(id)} aria-current={id === "studio" ? "page" : undefined}>{ar ? a : en}</a>)}
      <a className="sfree" role="menuitem" href={pageHref("account")}><Icon name="check" size={14} />{ar ? "المحرر مجاني في كل الباقات" : "Editor free in every plan"}</a></div>}
  </div>);
}
