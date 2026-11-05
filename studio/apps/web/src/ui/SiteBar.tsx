// (v231) The studio inside the site: the site's own sections along the top (the same ones as the site's header), each opening that
// page of nooi.ai; the editor is "Studio" (this page). On a phone the logo opens the same list as a menu. The editor is free in
// every plan — said here and on the plans page.
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@nooi/ui";
import { at } from "../site";

export const SITE_PAGES: [string, string, string][] = [["home", "Home", "الرئيسية"], ["explore", "Explore", "استكشف"], ["image", "Image", "صورة"], ["video", "Video", "فيديو"], ["audio", "Audio", "صوت"],
  ["chars", "Characters", "الشخصيات"], ["world", "3D", "ثلاثي الأبعاد"], ["studio", "Studio", "الأستوديو"], ["calendar", "Publish", "النشر"], ["apps", "Apps", "التطبيقات"], ["account", "Plans", "الباقات"]];
// the bar only where there is height to spare (computers, tablets upright and big ones sideways); elsewhere the logo opens the list
const BAR_Q = "(min-width: 768px) and (min-height: 601px)";
export const siteBarOn = () => typeof matchMedia !== "undefined" && matchMedia(BAR_Q).matches;
export function useSiteBar() { const [on, setOn] = useState(siteBarOn); useEffect(() => { const m = matchMedia(BAR_Q), f = () => setOn(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []); return on; }
export const pageHref = (id: string) => (id === "studio" ? at("/studio/") : at("/?view=" + id));   // (v232: home too — "/" alone could reopen the page the site remembered)

export function SiteBar() {
  const { i18n } = useTranslation(); const ar = i18n.language === "ar";
  return (<nav className="sitebar" aria-label={ar ? "أقسام الموقع" : "Site sections"} data-testid="sitebar">
    <div className="snav">{SITE_PAGES.map(([id, en, a]) => <a key={id} href={pageHref(id)} aria-current={id === "studio" ? "page" : undefined} data-testid={"site-" + id}>{ar ? a : en}{id === "studio" && <i>{ar ? "جديد" : "New"}</i>}</a>)}</div>
    <a className="sfree" href={pageHref("account")} data-testid="site-free" title={ar ? "محرر الأستوديو مجاني في كل الباقات" : "The Studio editor is free in every plan"}><Icon name="check" size={14} />{ar ? "المحرر مجاني في كل الباقات" : "Editor free in every plan"}</a>
  </nav>);
}
/** (v232) a phone (and a phone held sideways): a Home icon and, beside it, the menu of the site's sections */
export function SiteMenu() {
  const { i18n } = useTranslation(); const ar = i18n.language === "ar"; const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const f = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; addEventListener("pointerdown", f); return () => removeEventListener("pointerdown", f); }, [open]);
  return (<div className="smenu" ref={ref}>
    <a className="ns-btn icon shome" href={pageHref("home")} aria-label={ar ? "الرئيسية" : "Home"} title={ar ? "الرئيسية" : "Home"} data-testid="site-home"><Icon name="home" size={18} /></a>
    <button type="button" className="ns-btn icon" aria-expanded={open} aria-label={ar ? "أقسام الموقع" : "Site menu"} title={ar ? "أقسام الموقع" : "Site menu"} onClick={() => setOpen(!open)} data-testid="site-menu"><Icon name={open ? "close" : "menu"} size={18} /></button>
    {open && <div className="smenu-list" role="menu">{SITE_PAGES.map(([id, en, a]) => <a key={id} role="menuitem" href={pageHref(id)} aria-current={id === "studio" ? "page" : undefined}>{ar ? a : en}</a>)}
      <a className="sfree" role="menuitem" href={pageHref("account")}><Icon name="check" size={14} />{ar ? "المحرر مجاني في كل الباقات" : "Editor free in every plan"}</a></div>}
  </div>);
}
