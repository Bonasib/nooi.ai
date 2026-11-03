// The panels the classic editor had that the studio adds in v222: stickers & graphics, logo, sound effects, effect groups
// (weather & light, erase & blur) and motion presets.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Icon, Seg } from "@nooi/ui";
import { EFFECTS, EFFECT_GROUPS, MOTIONS, aspectOf } from "@nooi/editor-core";
import { api } from "../api";
import { at } from "../site";
import { assetFromJob } from "../media/library";
import { waitJob } from "./AIPanel";
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

// ---------------- Stock & AI Gen: a prompt → a new video or picture from nooi (price first; credits taken only when it is made)
export function AiGenPanel() {
  const { t } = useTranslation(); const p = useProject();
  const [kind, setKind] = useState<"video" | "image">("video"); const [words, setWords] = useState(""); const [dur, setDur] = useState<"5" | "10">("5");
  const [cost, setCost] = useState<number | null>(null); const [busy, setBusy] = useState(false); const [me, setMe] = useState(api.me);
  const aspect = aspectOf(p.width, p.height);
  const body = () => ({ kind, prompt: words.trim(), model: "auto", aspect, ...(kind === "video" ? { dur: +dur } : {}), title: words.trim().slice(0, 60) });
  useEffect(() => { void api.init().then(() => setMe({ ...api.me })); return api.on(() => setMe({ ...api.me })); }, []);
  useEffect(() => { if (!api.online || words.trim().length < 3) { setCost(null); return; } const k = setTimeout(() => { api.quote(body()).then((q) => setCost(q.cost)).catch(() => setCost(null)); }, 400); return () => clearTimeout(k); }, [kind, words, dur, aspect]);
  const go = async () => {
    setBusy(true);
    try {
      const j = await api.startJob(body()); toast(t("gen.started"), "ok");
      const r = await waitJob(j.id); if (r.status !== "done") throw new Error(r.error || t("ai.failed"));
      const a = assetFromJob({ ...r, resultUrl: (r as unknown as { url?: string }).url || r.resultUrl }); if (a) { A.addAssets([a]); toast(t("gen.done"), "ok"); }
      api.refresh();
    } catch (e) { toast(String((e as Error).message || e), "warn"); } finally { setBusy(false); }
  };
  if (!api.online) return <p className="hint">{t("ai.offline")}</p>;
  if (!me.signedIn) return <div className="empty"><Icon name="ai" size={20} /><p>{t("ai.signIn")}</p><a className="ns-btn primary" href={at("/?signin=1")}>{t("ai.signInBtn")}</a></div>;
  return (<>
    <p className="hint">{t("gen.hint")}</p>
    <Seg label={t("gen.kind")} value={kind} onChange={(v) => setKind(v)} options={[{ v: "video", label: t("gen.video") }, { v: "image", label: t("gen.image") }]} />
    <textarea className="ns-in gen" rows={4} value={words} onChange={(e) => setWords(e.target.value)} placeholder={t("gen.placeholder")} dir="auto" data-testid="gen-words" />
    <div className="row">{kind === "video" && <Seg label={t("gen.length")} value={dur} onChange={(v) => setDur(v)} options={[{ v: "5", label: "5s" }, { v: "10", label: "10s" }]} />}<span className="hint" dir="ltr">{aspect}</span></div>
    <Btn icon="sparkle" primary className="aibtn" onClick={go} disabled={busy || words.trim().length < 3} testid="gen-go">{busy ? t("gen.making") : t("gen.make") + (cost == null ? "" : " · " + (cost === 0 ? t("ai.free") : t("ai.credits", { n: cost })))}</Btn>
    {me.credits != null && <p className="hint">{t("ai.balance", { n: me.credits })}</p>}
  </>);
}

// ---------------- Templates: split-screen collages (2–9 panels) and an instant montage
export const LAYOUTS: { id: string; cols: number; rows: number; en: string; ar: string }[] = [
  { id: "2h", cols: 2, rows: 1, en: "2 side by side", ar: "اثنان جنباً إلى جنب" }, { id: "2v", cols: 1, rows: 2, en: "2 stacked", ar: "اثنان فوق بعض" },
  { id: "3h", cols: 3, rows: 1, en: "3 columns", ar: "3 أعمدة" }, { id: "4", cols: 2, rows: 2, en: "4 grid", ar: "شبكة 4" },
  { id: "6", cols: 3, rows: 2, en: "6 grid", ar: "شبكة 6" }, { id: "9", cols: 3, rows: 3, en: "9 grid", ar: "شبكة 9" },
];
export function TemplatesPanel() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang);
  return (<>
    <span className="ns-lbl">{t("tpl.split")}</span>
    <p className="hint">{t("tpl.splitHint")}</p>
    <div className="ns-grid lay">{LAYOUTS.map((l) => (
      <button key={l.id} type="button" className="ns-tile" onClick={() => A.splitScreen(l.cols, l.rows)} data-testid={"tpl-" + l.id}>
        <span className="laysw" style={{ gridTemplateColumns: `repeat(${l.cols}, 1fr)`, gridTemplateRows: `repeat(${l.rows}, 1fr)` }} aria-hidden="true">{Array.from({ length: l.cols * l.rows }, (_, i) => <i key={i}>{i + 1}</i>)}</span>
        <span>{lang === "ar" ? l.ar : l.en}</span>
      </button>))}</div>
    <span className="ns-lbl">{t("tpl.instant")}</span>
    <p className="hint">{t("tpl.instantHint")}</p>
    <Btn icon="sparkle" primary onClick={A.instantMontage} testid="tpl-instant">{t("tpl.instantGo")}</Btn>
  </>);
}
