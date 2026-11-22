// (v231) The studio inside the site: the site's own sections along the top, each opening that page of nooi.ai.
// (v282) The owner: "the menu changes between pages — Home shows one list, the editor another, though it's the same thing".
// The studio had its own lists ("Studio · New", "Apps", "Plans") and showed them only from 1100 px. Now it draws the site's own
// top menu: the sections, their tools, icons, colours and one-line descriptions are the ones nooi.ai's bar wrote to
// localStorage ("nooi.nav282", same origin) the last time it was built; before the first visit there, a fixed copy of the same
// sections is used. Same mechanism as the site: from 768 px every section by name, pointing at one (or its arrow, or ↓) opens
// its tools, what doesn't fit goes under "More"; on a phone the menu button lists the same sections. The editor is "Edit".
import { useTranslation } from "react-i18next";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Icon } from "@nooi/ui";
import { at } from "../site";
import { ui, useUI } from "../state";
import { api } from "../api";

type Tool = { v: string; en: string; ar: string; svg?: string; d?: [string, string] | null };
type Sec = { id: string; go: string; en: string; ar: string; svg?: string; hub?: string; d?: [string, string] | null; tools: Tool[] };

// the site's sections when this browser hasn't opened nooi.ai yet (the same names and order as its bar)
const FALLBACK: Sec[] = ([["home", "home", "Home", "الرئيسية"], ["explore", "discover", "Explore", "استكشف"], ["image", "image", "Image", "صورة"], ["video", "video", "Video", "فيديو"],
  ["audio", "voice", "Audio", "صوت"], ["chars", "chars", "Characters", "الشخصيات"], ["world", "world", "3D", "ثلاثي الأبعاد"], ["edit", "edit", "Edit", "تحرير"],
  ["calendar", "calendar", "Publish", "النشر"], ["auto", "crew", "Agents", "الوكلاء"], ["more", "sketch", "Extras", "إضافات"], ["apps", "apps", "All tools", "كل الأدوات"]] as const)
  .map(([id, go, en, ar]) => ({ id, go, en, ar, tools: [] }));
export function navSecs(): Sec[] {
  try { const j = JSON.parse(localStorage.getItem("nooi.nav282") || "null"); if (j && Array.isArray(j.secs) && j.secs.length) return j.secs as Sec[]; } catch { /* a private window: the fixed copy */ }
  return FALLBACK;
}
const HERE = "edit";   // this page is the site's Video editor, in the Edit section
export const SITE_PAGES: [string, string, string][] = FALLBACK.map((s) => [s.go, s.en, s.ar]);   // (kept for older callers)
// the bar only where there is height to spare (computers, tablets upright and big ones sideways); elsewhere the menu button opens the list
const BAR_Q = "(min-width: 768px) and (min-height: 601px)";
export const siteBarOn = () => typeof matchMedia !== "undefined" && matchMedia(BAR_Q).matches;
export function useSiteBar() { const [on, setOn] = useState(siteBarOn); useEffect(() => { const m = matchMedia(BAR_Q), f = () => setOn(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []); return on; }
export const pageHref = (id: string) => (id === "studio" || id === "edit" ? at("/studio/") : at("/?view=" + id));   // (v232: home too — "/" alone could reopen the page the site remembered)
const svgOf = (s?: string) => (s && s.startsWith("<svg") ? { __html: s } : undefined);

const TILE = <svg viewBox="405 600 690 270" aria-hidden="true"><path d="M443.3 783.6V726A77.5 77.5 0 0 1 598.3 726V805.6A76.7 76.7 0 0 0 751.7 805.6V771.6A76.1 76.1 0 0 1 903.9 771.6V795.7A76.6 76.6 0 0 0 1057.1 795.7V706.3" fill="none" stroke="#0b0c0e" strokeWidth="59.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="1057" cy="640" r="30" fill="#0b0c0e" /></svg>;
export function SiteBar() {
  const { i18n, t } = useTranslation(); const ar = i18n.language === "ar"; const wide = useSiteBar(); const theme = useUI((s) => s.theme); const lang = useUI((s) => s.lang);
  const [me, setMe] = useState(api.me); useEffect(() => api.on(() => setMe({ ...api.me })), []);
  const initial = ([...(me.name || "").trim()][0] || "N").toUpperCase();
  return (<header className="sitebar sitehdr" data-testid="sitebar">
    <a className="shlogo" href={pageHref("home")} aria-label={ar ? "الرئيسية" : "Home"} title={ar ? "الرئيسية" : "Home"} data-testid="site-home">{TILE}</a>
    {wide ? <TopNav ar={ar} /> : <SiteMenu />}
    <div className="shright">
      <button type="button" className="shround" onClick={() => ui.set({ theme: theme === "dark" ? "light" : "dark" })} aria-label={t("top.theme")} title={t("top.theme")} data-testid="site-theme"><Icon name={theme === "dark" ? "moon" : "sun"} size={18} /></button>
      <button type="button" className="shbtn" onClick={() => ui.set({ paletteOpen: true })} aria-label={t("palette.open")} title={t("palette.open") + " (Ctrl+K)"}><Icon name="search" size={16} /></button>
      {me.free ? <a className="shcredits credits" href={pageHref("account")} title={t("top.free")} data-testid="top-free"><Icon name="sparkle" size={14} /><span className="ctext">{t("top.freeShort")}</span></a>
        : <a className="shcredits credits" href={pageHref("account")} title={t("top.credits")} data-testid="top-credits"><Icon name="sparkle" size={14} />{me.credits ?? "—"}</a>}
      <button type="button" className="shbtn" onClick={() => ui.set({ lang: lang === "ar" ? "en" : "ar" })} aria-label={lang === "ar" ? "English" : "العربية"} title={lang === "ar" ? "English" : "العربية"} data-testid="lang"><Icon name="globe" size={16} /></button>
      {wide && <a className="shbtn shlib" href={at("/?view=library")} aria-label={ar ? "مكتبتي" : "My library"} data-testid="site-library"><Icon name="template" size={14} /><span>{ar ? "المكتبة" : "Library"}</span></a>}
      <a className="shav" href={pageHref("account")} aria-label={ar ? "حسابي" : "My account"} title={me.name || (ar ? "حسابي" : "My account")} data-testid="site-account">{initial}</a>
    </div>
  </header>);
}

/** the site's top menu: every section by name; a section's tools one point (or tap on its arrow) away; the rest under "More" */
function TopNav({ ar }: { ar: boolean }) {
  const secs = navSecs(); const L = (en: string, a: string) => (ar ? a : en);
  const row = useRef<HTMLDivElement>(null); const tmr = useRef(0);
  const [open, setOpen] = useState<{ id: string; x: number; y: number } | null>(null);
  const openRef = useRef(open); openRef.current = open;
  // what doesn't fit goes under "More" (the open section always stays in the bar) — set on the DOM, as on the site
  useLayoutEffect(() => {
    const r = row.current; if (!r) return;
    const fit = () => {
      const items = [...r.querySelectorAll<HTMLElement>(".tni282[data-sec]")], more = r.querySelector<HTMLElement>(".more282")!;
      items.forEach((x) => (x.hidden = false)); more.hidden = true; if (r.scrollWidth <= r.clientWidth + 1) return; more.hidden = false;
      for (let i = items.length - 1; i >= 0 && r.scrollWidth > r.clientWidth + 1; i--) { if (items[i].dataset.sec === HERE) continue; items[i].hidden = true; }
    };
    fit(); const ro = new ResizeObserver(fit); ro.observe(r); return () => ro.disconnect();
  }, [ar, secs.length]);
  const show = (id: string, el: Element) => {
    clearTimeout(tmr.current); const it = el.closest(".tni282") || el, b = it.getBoundingClientRect(), w = Math.min(580, innerWidth - 16);
    let x = ar ? b.right - w : b.left; x = Math.max(8, Math.min(x, innerWidth - w - 8)); setOpen({ id, x, y: Math.round(b.bottom + 6) });
  };
  const later = () => { clearTimeout(tmr.current); tmr.current = window.setTimeout(() => setOpen(null), 220); };
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { const el = e.target as Element; if (!el.closest?.(".tnp282") && !el.closest?.("[data-tn282]")) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { const b = document.querySelector<HTMLElement>('[data-tn282="' + openRef.current?.id + '"]'); setOpen(null); b?.focus(); } };
    const shut = () => setOpen(null);
    addEventListener("pointerdown", away, true); addEventListener("keydown", esc); addEventListener("scroll", shut, true); addEventListener("resize", shut);
    return () => { removeEventListener("pointerdown", away, true); removeEventListener("keydown", esc); removeEventListener("scroll", shut, true); removeEventListener("resize", shut); };
  }, [open]);
  const hover = (id: string, many: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return; clearTimeout(tmr.current);
    if (!many) { if (openRef.current) later(); return; }
    if (openRef.current?.id === id) return; const el = e.currentTarget; tmr.current = window.setTimeout(() => show(id, el), openRef.current ? 0 : 110);
  };
  const leave = (e: React.PointerEvent) => { if (e.pointerType === "mouse") later(); };
  const toggle = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); if (open?.id === id) setOpen(null); else show(id, e.currentTarget); };
  const down = (id: string) => (e: React.KeyboardEvent) => { if (e.key !== "ArrowDown") return; e.preventDefault(); show(id, e.currentTarget); requestAnimationFrame(() => document.querySelector<HTMLElement>(".tnp282 .tnt282")?.focus()); };
  const panelKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return; e.preventDefault();
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>(".tnt282")], i = all.indexOf(document.activeElement as HTMLElement);
    (all[(i + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length] || all[0])?.focus();
  };
  const sec = open && secs.find((s) => s.id === open.id);
  const hiddenSecs = () => { const ids = [...(row.current?.querySelectorAll<HTMLElement>(".tni282[hidden][data-sec]") || [])].map((x) => x.dataset.sec); return secs.filter((s) => ids.includes(s.id)); };
  const hub = (s: Sec) => (s.hub ? ({ "--hub": s.hub } as CSSProperties) : undefined);
  return (<nav className="tn282" aria-label={L("Site menu", "قائمة الموقع")} data-testid="site-nav">
    <div className="tnr282" ref={row}>
      {secs.map((s) => {
        const many = s.tools.length > 1, here = s.id === HERE;
        return (<div key={s.id} className="tni282" data-sec={s.id} style={hub(s)} onPointerEnter={hover(s.id, many)} onPointerLeave={leave}>
          <a className="tnb282" href={pageHref(s.go)} aria-current={here ? "page" : undefined} data-testid={"site-" + s.id} onKeyDown={many ? down(s.id) : undefined}>
            {s.svg && <i className="tni" aria-hidden="true" dangerouslySetInnerHTML={svgOf(s.svg)} />}<span>{L(s.en, s.ar)}</span></a>
          {many && <button type="button" className="tnc282" data-tn282={s.id} aria-haspopup="true" aria-expanded={open?.id === s.id} aria-label={L("Tools in ", "أدوات ") + L(s.en, s.ar)} onClick={toggle(s.id)}>
            <Icon name="chevron" size={14} /></button>}
        </div>);
      })}
      <div className="tni282 more282" hidden onPointerEnter={hover("__more", true)} onPointerLeave={leave}>
        <button type="button" className="tnb282 tnm282" data-tn282="__more" aria-haspopup="true" aria-expanded={open?.id === "__more"} onClick={toggle("__more")} onKeyDown={down("__more")}>
          <Icon name="menu" size={16} /><span>{L("More", "المزيد")}</span><Icon name="chevron" size={14} /></button>
      </div>
    </div>
    {open && (<div className="tnp282" role="menu" style={{ left: open.x, top: open.y, ...(sec ? hub(sec) : {}) }} onPointerEnter={() => clearTimeout(tmr.current)} onPointerLeave={leave} onKeyDown={panelKeys} data-testid="site-panel">
      {open.id === "__more" ? (<>
        <div className="tnph282"><span><b>{L("More sections", "أقسام أخرى")}</b></span></div>
        <div className="tnpg282">{hiddenSecs().map((s) => <a key={s.id} className="tnt282" role="menuitem" href={pageHref(s.go)} style={hub(s)}>
          <i className="tnti282" aria-hidden="true" dangerouslySetInnerHTML={svgOf(s.svg)} /><span><b>{L(s.en, s.ar)}</b>{s.d && <small>{L(s.d[0], s.d[1])}</small>}</span></a>)}</div>
      </>) : sec ? (<>
        <div className="tnph282"><i className="tnti282" aria-hidden="true" dangerouslySetInnerHTML={svgOf(sec.svg)} /><span><b>{L(sec.en, sec.ar)}</b>{sec.d && <small>{L(sec.d[0], sec.d[1])}</small>}</span></div>
        <div className="tnpg282">{sec.tools.map((t) => <a key={t.v} className="tnt282" role="menuitem" href={pageHref(t.v)} aria-current={t.v === HERE ? "page" : undefined}>
          <i className="tnti282" aria-hidden="true" dangerouslySetInnerHTML={svgOf(t.svg)} /><span><b>{L(t.en, t.ar)}</b>{t.d && <small>{L(t.d[0], t.d[1])}</small>}</span></a>)}</div>
      </>) : null}
    </div>)}
  </nav>);
}

/** (v232) a phone (and a phone held sideways): the menu button lists the site's sections — the same ones as the bar */
export function SiteMenu() {
  const { i18n } = useTranslation(); const ar = i18n.language === "ar"; const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const f = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; addEventListener("pointerdown", f); return () => removeEventListener("pointerdown", f); }, [open]);
  return (<div className="smenu" ref={ref}>
    <button type="button" className="ns-btn icon" aria-expanded={open} aria-label={ar ? "أقسام الموقع" : "Site menu"} title={ar ? "أقسام الموقع" : "Site menu"} onClick={() => setOpen(!open)} data-testid="site-menu"><Icon name={open ? "close" : "menu"} size={18} /></button>
    {open && <div className="smenu-list" role="menu">{navSecs().map((s) => <a key={s.id} role="menuitem" href={pageHref(s.go)} aria-current={s.id === HERE ? "page" : undefined}>{ar ? s.ar : s.en}</a>)}
      <a className="sfree" role="menuitem" href={pageHref("account")}><Icon name="check" size={14} />{ar ? "المحرر مجاني في كل الباقات" : "Editor free in every plan"}</a></div>}
  </div>);
}
