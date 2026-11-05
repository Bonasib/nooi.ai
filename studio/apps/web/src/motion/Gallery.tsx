// nooi Motion in the studio: the gallery (each tile is the template itself, drawn live — it plays when pointed at) and the picked
// graphic's props form (words, colours, numbers, choices, data, and code with Run and its errors).
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Btn, Slider } from "@nooi/ui";
import type { TextClip } from "@nooi/editor-core";
import { useUI } from "../state";
import * as A from "../actions";
import { GROUPS, TEMPLATES, defaultsOf, templateOf, type Field } from "./templates";
import { drawTemplate, propsOf, MG_ANIMS } from "./render";
import { TEXT_ANIMS } from "@nooi/editor-core";
import { codeErrors, codePicture, onCode, tryCode } from "./code";

const TW = 320, TH = 180;
function MotionTile({ id }: { id: string }) {
  const tpl = templateOf(id)!; const lang = useUI((s) => s.lang); const ref = useRef<HTMLCanvasElement>(null); const btn = useRef<HTMLButtonElement>(null);
  const [seen, setSeen] = useState(false); const [play, setPlay] = useState(false);
  useEffect(() => { const el = btn.current; if (!el) return; const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); setSeen(true); } }, { rootMargin: "160px" }); io.observe(el); return () => io.disconnect(); }, []);
  useEffect(() => {
    const cv = ref.current; if (!cv || !seen) return; const x = cv.getContext("2d")!; const props = defaultsOf(tpl, lang); let raf = 0, live = true;
    const still = Math.min(tpl.dur * 0.55, 1.8);
    if (id === "code") { void codePicture(String(props.code), TW, TH, 40).then((b) => { if (!live || !b) return; x.clearRect(0, 0, TW, TH); x.drawImage(b, 0, 0); b.close(); cv.dataset.drawn = "1"; }); return () => { live = false; }; }
    const draw = (t: number) => { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, TW, TH); if (drawTemplate(x, id, props, t, tpl.dur, TW, TH)) cv.dataset.drawn = "1"; };
    if (!play) draw(still);
    else { const t0 = performance.now(); const tick = () => { if (!live) return; draw(((performance.now() - t0) / 1000) % tpl.dur); raf = requestAnimationFrame(tick); }; tick(); }
    return () => { live = false; cancelAnimationFrame(raf); };
  }, [seen, play, lang, id]);
  return <button ref={btn} type="button" className="ns-tile mgt" onClick={() => A.addMotion(id)} onPointerEnter={() => setPlay(true)} onPointerLeave={() => setPlay(false)} onFocus={() => setPlay(true)} onBlur={() => setPlay(false)}
    data-testid={"mg-" + id} title={lang === "ar" ? tpl.ar : tpl.en}>
    <span className="mgbg"><canvas ref={ref} width={TW} height={TH} aria-hidden="true" /></span><span>{lang === "ar" ? tpl.ar : tpl.en}</span></button>;
}
export function MotionGallery() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const [g, setG] = useState<string>("all");
  return (<div className="mgal" data-testid="motion-gallery">
    <p className="hint">{t("mg.hint")}</p>
    <div className="chips" role="tablist">{[["all", t("mg.all"), t("mg.all")] as [string, string, string], ...GROUPS].map(([id, en, ar]) => <button key={id} type="button" role="tab" className="chip" aria-selected={g === id} aria-pressed={g === id} onClick={() => setG(id)} data-testid={"mgg-" + id}>{lang === "ar" ? ar : en}</button>)}</div>
    {GROUPS.filter(([id]) => g === "all" || g === id).map(([id, en, ar]) => <div key={id}><span className="ns-lbl">{lang === "ar" ? ar : en}</span>
      <div className="ns-grid fxg">{TEMPLATES.filter((x) => x.group === id).map((x) => <MotionTile key={x.id} id={x.id} />)}</div></div>)}
  </div>);
}

// ---- the picked graphic's props
function FieldRow({ f, v, lang }: { f: Field; v: unknown; lang: "en" | "ar" }) {
  const label = lang === "ar" ? f.ar : f.en, tid = "mgp-" + f.k;
  if (f.type === "number") return <Slider label={label} value={Number(v) || 0} min={f.min ?? 0} max={f.max ?? 100} step={f.step} onChange={(x) => A.live.set("motion.props." + f.k, x)} onCommit={A.live.end} testid={tid} />;
  if (f.type === "color") return <label className="ns-field mgcol"><span>{label}</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : "#ffffff"} onChange={(e) => A.setMotionProp(f.k, e.target.value)} data-testid={tid} /></label>;
  if (f.type === "bool") return <Btn pressed={!!v} onClick={() => A.setMotionProp(f.k, !v)} testid={tid}>{label}</Btn>;
  if (f.type === "select") return <label className="ns-field"><span>{label}</span><select className="ns-input" value={String(v)} onChange={(e) => A.setMotionProp(f.k, e.target.value)} data-testid={tid}>{(f.options || []).map(([k, en, ar]) => <option key={k} value={k}>{lang === "ar" ? ar : en}</option>)}</select></label>;
  return <label className="ns-field"><span>{label}</span><input className="ns-input" dir="auto" value={String(v ?? "")} onChange={(e) => A.live.set("motion.props." + f.k, e.target.value)} onBlur={A.live.end} data-testid={tid} />
    {f.type === "list" && <small className="hint">{lang === "ar" ? "افصل بينها بفواصل" : "separate with commas"}</small>}</label>;
}
function CodeField({ c, v }: { c: TextClip; v: string }) {
  const { t } = useTranslation(); const [draft, setDraft] = useState(v); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(v), [c.id, v]);
  const live = useSyncExternalStore(onCode, () => codeErrors.get(c.id) || "");
  const run = async () => { setBusy(true); const e = await tryCode(draft); setBusy(false); setErr(e); if (!e) A.setMotionProp("code", draft); };
  return (<div className="mgcode">
    <span className="ns-lbl">{t("mg.code")}</span>
    <textarea className="ns-in code" spellCheck={false} dir="ltr" rows={14} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void run(); } e.stopPropagation(); }} data-testid="mg-src" />
    <div className="row"><Btn icon="play" primary onClick={() => void run()} disabled={busy} testid="mg-run">{t("mg.run")}</Btn><span className="hint">{t("mg.sealed")}</span></div>
    {(err || live) && <p className="err" role="alert" dir="ltr" data-testid="mg-err">{err || live}</p>}
  </div>);
}
// (v231) its Enter and Exit: each choice plays its example; the length is a slider (one undo step)
function InOut({ c, side }: { c: TextClip; side: "animIn" | "animOut" }) {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const cur = c[side];
  return (<div className="mginout" data-testid={"mg-" + side}>
    <span className="ns-lbl">{t(side === "animIn" ? "mg.enter" : "mg.exit")}</span>
    <div className="mgio">{MG_ANIMS.map((id) => { const a = TEXT_ANIMS.find((x) => x.id === id)!; return <button key={id} type="button" className={"ns-tile mgio-t"} aria-pressed={cur.type === id}
      onClick={() => A.run("motion " + side, (p) => { for (const tr of p.tracks) for (const k of tr.clips) if (k.id === c.id && k.type === "text") k[side] = { type: id as typeof cur.type, dur: id === "none" ? 0 : cur.dur > 0 ? cur.dur : 0.5 }; })}
      data-testid={"mg-" + side + "-" + id}><span className={"mgio-x io-" + id + (side === "animOut" ? " out" : "")} aria-hidden="true"><i>Aa</i></span><span>{lang === "ar" ? a.ar : a.en}</span></button>; })}</div>
    {cur.type !== "none" && <Slider label={t("mg.length")} value={cur.dur} min={0.1} max={2.5} step={0.05} fmt={(v) => v.toFixed(2) + "s"} onChange={(v) => A.live.set(side + ".dur", v)} onCommit={A.live.end} testid={"mg-" + side + "-dur"} />}
  </div>);
}
export function MotionProps({ c }: { c: TextClip }) {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const tpl = c.motion && templateOf(c.motion.tpl); if (!tpl) return <p className="hint">{t("mg.missing")}</p>;
  const props = propsOf(c);
  return (<div className="mgprops" data-testid="mg-props">
    <p className="hint">{lang === "ar" ? tpl.ar : tpl.en} · {t("mg.frames")}</p>
    {tpl.fields.map((f) => f.type === "code" ? <CodeField key={f.k} c={c} v={String(props.code || "")} /> : <FieldRow key={f.k} f={f} v={props[f.k]} lang={lang} />)}
    <InOut c={c} side="animIn" />
    <InOut c={c} side="animOut" />
    <p className="hint">{t("mg.keys")}</p>
    <Btn icon="undo" onClick={() => A.setProp("motion.props", defaultsOf(tpl, lang), "motion graphic")} testid="mg-reset">{t("mg.reset")}</Btn>
  </div>);
}
