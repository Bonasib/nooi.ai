// The panels the classic editor had that the studio adds in v222: stickers & graphics, logo, sound effects, effect groups
// (weather & light, erase & blur) and motion presets.
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn } from "@nooi/ui";
import { EFFECTS, EFFECT_GROUPS, MOTIONS } from "@nooi/editor-core";
import { editor, toast, ui, useProject, useUI } from "../state";
import * as A from "../actions";
import { STICKERS, stickerFile, stickerUrl } from "../media/stickers";
import { SFX, playSfx, sfxFile } from "../media/sfx";

export function StickersPanel() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const [busy, setBusy] = useState("");
  const add = async (id: string) => { setBusy(id); try { const f = await stickerFile(id); if (f) await A.addMade(f, { kind: "overlay", dur: 3, scale: 0.32 }); } finally { setBusy(""); } };
  return (<>
    <p className="hint">{t("stk.hint")}</p>
    {(["badges", "shapes", "faces", "marks"] as const).map((g) => <div key={g}>
      <span className="ns-lbl">{t("stk." + g)}</span>
      <div className="stkg">{STICKERS.filter((s) => s.group === g).map((s) => (
        <button key={s.id} type="button" className="stk" onClick={() => void add(s.id)} disabled={!!busy} title={lang === "ar" ? s.ar : s.en} aria-label={lang === "ar" ? s.ar : s.en} data-testid={"stk-" + s.id}>
          <img src={stickerUrl(s)} alt="" draggable={false} />
        </button>))}</div>
    </div>)}
  </>);
}

export function LogoPanel() {
  const { t } = useTranslation(); const ref = useRef<HTMLInputElement>(null); const p = useProject();
  const [corner, setCorner] = useState<"tl" | "tr" | "bl" | "br">("tr");
  const add = async (f: File) => {
    const end = Math.max(3, ...p.tracks.flatMap((tr) => tr.clips.map((c) => c.start + c.dur)));
    const c = await A.addMade(f, { kind: "overlay", at: 0, dur: end, scale: 0.18 });
    if (c) A.placeCorner(corner);
    toast(t("logo.added"), "ok");
  };
  return (<>
    <p className="hint">{t("logo.hint")}</p>
    <span className="ns-lbl">{t("logo.corner")}</span>
    <div className="corners" role="radiogroup" aria-label={t("logo.corner")}>
      {(["tl", "tr", "bl", "br"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={corner === k} className={"cbox " + k} onClick={() => { setCorner(k); const s = editor.selection.length === 1; if (s) A.placeCorner(k); }} aria-label={t("logo." + k)} title={t("logo." + k)} data-testid={"corner-" + k}><i /></button>)}
    </div>
    <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void add(f); e.target.value = ""; }} data-testid="logo-input" />
    <Btn icon="plus" primary onClick={() => ref.current?.click()} testid="logo-add">{t("logo.add")}</Btn>
    <p className="hint">{t("logo.tip")}</p>
  </>);
}

export function SfxPanel() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const [busy, setBusy] = useState("");
  const add = async (id: string) => { setBusy(id); try { const f = await sfxFile(id); if (f) await A.addMade(f, { kind: "sound" }); } finally { setBusy(""); } };
  return (<>
    <p className="hint">{t("sfx.hint")}</p>
    <div className="sfxl">{SFX.map((s) => (
      <div key={s.id} className="sfxi">
        <button type="button" className="ns-btn icon" onClick={() => void playSfx(s.id)} aria-label={t("sfx.listen") + ": " + (lang === "ar" ? s.ar : s.en)} title={t("sfx.listen")}>▶</button>
        <span className="sfxn">{lang === "ar" ? s.ar : s.en}<small dir="ltr">{s.sec.toFixed(1)}s</small></span>
        <Btn icon="plus" onClick={() => void add(s.id)} disabled={!!busy} testid={"sfx-" + s.id}>{t("sfx.add")}</Btn>
      </div>))}</div>
  </>);
}

// the tiles of one effect group (effects, weather & light, erase & blur); pointing shows it on the preview, a tap adds it
export function EffectTiles({ group }: { group: string }) {
  const lang = useUI((s) => s.lang); const ids = EFFECT_GROUPS[group] || [];
  const hover = (id: string | null) => ui.set({ preview: id });
  return (
    <div className="ns-grid fxg">
      {EFFECTS.filter((x) => ids.includes(x.id)).map((x) => (
        <button key={x.id} type="button" className="ns-tile" onPointerEnter={(e) => { if (e.pointerType !== "touch") hover("fx:" + x.id); }} onPointerLeave={() => hover(null)}
          onClick={() => { hover(null); A.applyEffect(x.id); }} data-testid={"fx-" + x.id}>
          <span className={"fxsw fx-" + x.id} aria-hidden="true" /><span>{lang === "ar" ? x.ar : x.en}</span>
        </button>))}
    </div>
  );
}
export function MotionTiles() {
  const lang = useUI((s) => s.lang);
  return (
    <div className="ns-grid fxg">
      {MOTIONS.map((m) => <button key={m.id} type="button" className="ns-tile" onClick={() => A.applyMotion(m.id)} data-testid={"mo-" + m.id}><span className={"fxsw mo mo-" + m.id} aria-hidden="true" /><span>{lang === "ar" ? m.ar : m.en}</span></button>)}
    </div>
  );
}
