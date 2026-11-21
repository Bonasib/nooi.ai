// (v278) the effect, transition and look libraries: each tile is drawn by the real compositor; a search box and groups.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EFFECTS, EFFECT_GROUPS, LOOKS, TRANSITIONS, TRANSITION_GROUPS } from "@nooi/editor-core";
import { ui, useUI } from "../state";
import * as A from "../actions";
import { useThumb } from "../media/thumbs278";

export function Thumb({ k, cls }: { k: string; cls: string }) {
  const u = useThumb(k);
  return <span className={"fxsw " + cls + (u ? " has" : "")} aria-hidden="true">{u ? <img src={u} alt="" draggable={false} /> : null}</span>;
}
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[ً-ٟ]/g, "");
function Search({ q, set, testid }: { q: string; set: (s: string) => void; testid: string }) {
  const { t } = useTranslation();
  return <input className="ns-input lib278q" type="search" value={q} placeholder={t("lib.search")} aria-label={t("lib.search")} onChange={(e) => set(e.target.value)} data-testid={testid} dir="auto" />;
}
const EFFECT_ORDER = ["effects", "distort", "light", "stylize", "colorfx", "retro", "particles", "frames"];

/** the Effects tab: the effects in groups (search finds any, in English or Arabic) */
export function EffectLibrary() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const [q, setQ] = useState("");
  const hover = (id: string | null) => ui.set({ preview: id });
  const nq = norm(q.trim());
  const groups = EFFECT_ORDER.map((g) => [g, EFFECTS.filter((x) => (EFFECT_GROUPS[g] || []).includes(x.id) && (!nq || norm(x.en).includes(nq) || norm(x.ar).includes(nq)))] as const).filter(([, l]) => l.length);
  return (<>
    <Search q={q} set={setQ} testid="fx-search" />
    {groups.map(([g, list]) => (<section key={g} className="lib278s" data-group={g}>
      <span className="ns-lbl">{t("lib.fx." + g)} <small>{list.length}</small></span>
      <div className="ns-grid fxg">{list.map((x) => (
        <button key={x.id} type="button" className="ns-tile" onPointerEnter={(e) => { if (e.pointerType !== "touch") hover("fx:" + x.id); }} onPointerLeave={() => hover(null)}
          onClick={() => { hover(null); A.applyEffect(x.id); }} data-testid={"fx-" + x.id}>
          <Thumb k={"fx:" + x.id} cls={"fx-" + x.id} /><span>{lang === "ar" ? x.ar : x.en}</span>
        </button>))}</div>
    </section>))}
    {!groups.length && <p className="hint">{t("lib.none")}</p>}
  </>);
}

/** the Transitions panel: in groups, with search */
export function TransitionLibrary() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const [q, setQ] = useState("");
  const hover = (id: string | null) => ui.set({ preview: id });
  const nq = norm(q.trim());
  const groups = TRANSITION_GROUPS.map((g) => [g, TRANSITIONS.filter((x) => x.group === g && (!nq || norm(x.en).includes(nq) || norm(x.ar).includes(nq)))] as const).filter(([, l]) => l.length);
  return (<>
    <p className="hint">{t("tr.hint")}</p>
    <Search q={q} set={setQ} testid="tr-search" />
    {groups.map(([g, list]) => (<section key={g} className="lib278s" data-group={g}>
      <span className="ns-lbl">{t("lib.tr." + g)} <small>{list.length}</small></span>
      <div className="ns-grid fxg">{list.map((x) => (
        <button key={x.id} type="button" className="ns-tile" onPointerEnter={(e) => { if (e.pointerType !== "touch") hover("tr:" + x.id); }} onPointerLeave={() => hover(null)}
          onClick={() => { hover(null); A.applyTransition(x.id); }} draggable
          onDragStart={(e) => e.dataTransfer.setData("application/x-nooi-transition", x.id)} data-testid={"tr-" + x.id}>
          <Thumb k={"tr:" + x.id} cls={"tr-" + x.id} /><span>{lang === "ar" ? x.ar : x.en}</span>
        </button>))}</div>
    </section>))}
    {!groups.length && <p className="hint">{t("lib.none")}</p>}
  </>);
}

/** the looks: each tile is the sample picture in that look */
export function LookTiles() {
  const lang = useUI((s) => s.lang); const { t } = useTranslation(); const [q, setQ] = useState(""); const nq = norm(q.trim());
  const list = LOOKS.filter((x) => !nq || norm(x.en).includes(nq) || norm(x.ar).includes(nq));
  return (<>
    {LOOKS.length > 12 && <Search q={q} set={setQ} testid="look-search" />}
    <div className="ns-grid">{list.map((l) => <button key={l.id} type="button" className="ns-tile" onClick={() => A.applyLook(l.id)} onPointerEnter={(e) => { if (e.pointerType !== "touch") ui.set({ preview: "look:" + l.id }); }} onPointerLeave={() => ui.set({ preview: null })} data-testid={"look-" + l.id}><Thumb k={"look:" + l.id} cls={"look-" + l.id} /><span>{lang === "ar" ? l.ar : l.en}</span></button>)}</div>
    {!list.length && <p className="hint">{t("lib.none")}</p>}
  </>);
}
