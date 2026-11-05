// (v234) Background: 1 · separate the person — a colour key for a green / blue screen (its colour found by itself), or a cut-out
// made on this device when there is no screen (free, nothing uploaded); 2 · a new background under them — moving scenes (each tile
// plays), drawn pictures, your own video or picture, or AI (the server, price first) — with the light on the person matched to it.
// (v235) a library of high-quality pictures and studio sets by group (studios, technology, nature, business & finance), each still or
// moving, and backgrounds made with AI; with no clip picked a background goes on the main track.
// Picking a background first separates the person by itself: a real studio screen is keyed, anything else is cut out.
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Btn, Icon, Seg, Slider } from "@nooi/ui";
import * as C from "@nooi/editor-core";
import type { Asset, MediaClip } from "@nooi/editor-core";
import { api } from "../api";
import type { Job } from "../api";
import { at } from "../site";
import { assetFromJob } from "../media/library";
import { waitJob } from "./AIPanel";
import { AI_CATS, AI_MOVE, CATS, PHOTOS, SCENE_CAT, aiWords, photoUrl, type Cat, type Photo } from "../media/photos";
import { editor, toast, ui, useEditorVersion, useUI } from "../state";
import * as A from "../actions";
import { importFiles } from "../media/library";
import { cutoutImage, cutoutVideo } from "../media/cutout";
import { applyLight, backdropClips, backdropLight, lightShift, personLight, screenOfClip, svgPng, type Backdrop, type BackdropLook } from "../media/backdrop";
import { BACKGROUNDS } from "../motion/templates4";
import { defaultsOf } from "../motion/templates";
import { drawTemplate } from "../motion/render";
import { BACKDROPS, BackgroundPanel } from "./Replace";

type Say = (k: string, o?: Record<string, unknown>) => string;
// ---- one cut-out at a time, seen by the panel and the clip settings
let busy: { clip: string; k: number; ctrl: AbortController } | null = null; const subs = new Set<() => void>();
const setBusy = (b: typeof busy) => { busy = b; subs.forEach((f) => f()); };
const useBusy = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => busy);
export function usePickedMedia() { useEditorVersion(); const c = A.sel1(); const a = c?.type === "media" ? editor.project.assets[(c as MediaClip).asset] : null; return a && (a.kind === "video" || a.kind === "image") ? { clip: c as MediaClip, asset: a } : null; }
export const separated = (c: MediaClip) => { const a = editor.project.assets[c.asset]; return !!C.keyOf(c) || a?.alpha === "stacked" || a?.alpha === "own"; };

/** a green / blue screen: its colour found around the picture's edges, keyed */
export async function keyClip(t: Say, c: MediaClip): Promise<boolean> {
  const s = await screenOfClip(editor.project, c);
  if (!s) { toast(t("bk.noScreen"), "info"); return false; }
  A.run("colour key", (p) => { const f = C.findClip(p, c.id); if (f?.clip.type === "media") C.setKey(f.clip, { ...C.KEY0, color: s.color }); }); toast(t("bk.keyed"), "ok"); return true;
}
/** no screen: the person found on this device in every frame; the clip shows the cut-out (its sound stays, detached) */
export async function cutClip(t: Say, c: MediaClip): Promise<boolean> {
  const a = editor.project.assets[c.asset]; if (!a || busy) return false;
  if (a.alpha === "stacked" || a.alpha === "own") { toast(t("bk.already"), "info"); return true; }
  const ctrl = new AbortController(); setBusy({ clip: c.id, k: 0.01, ctrl });
  try {
    if (a.kind === "image") { const n = { ...(await cutoutImage(a)), alpha: "own" as const };
      A.run("cut out", (p) => { p.assets[n.id] = n; const f = C.findClip(p, c.id); if (f?.clip.type === "media") { f.clip.asset = n.id; C.setKey(f.clip, null); } }); }
    else {
      const from = c.freeze ?? c.in, to = c.freeze != null ? c.freeze + 0.2 : c.in + c.dur * c.speed;
      const r = await cutoutVideo(a, from, to, { signal: ctrl.signal, onProgress: (k) => setBusy({ clip: c.id, k: Math.max(0.01, k), ctrl }) });
      A.run("cut out", (p) => { p.assets[r.asset.id] = r.asset; const f = C.findClip(p, c.id); if (f?.clip.type !== "media") return; const m = f.clip;
        if (p.assets[m.asset]?.hasAudio !== false && !m.muted) C.detachAudio(p, m.id);
        m.asset = r.asset.id; m.in = Math.max(0, m.in - r.from); if (m.freeze != null) m.freeze = Math.max(0, m.freeze - r.from); C.setKey(m, null); });
    }
    setBusy(null); toast(t("bk.cutDone"), "ok"); return true;
  } catch (e) { setBusy(null); if ((e as Error).name !== "AbortError") toast(t("bk.cutFail"), "warn"); return false; }
}

/** the key's colour and how it cuts (slides move as one undo step) */
export function KeyControls({ c }: { c: MediaClip }) {
  const { t } = useTranslation(); const k = C.keyOf(c); const i = c.effects.findIndex((e) => e.type === "key");
  if (!k || i < 0) return null; const p = (n: string) => "effects." + i + ".params." + n, pct = (v: number) => Math.round(v * 100) + "%";
  return (<div className="bkkey" data-testid="bk-keyctl">
    <label className="ns-field bkcol"><span>{t("bk.color")}</span><span className="row"><input type="color" value={k.color} onChange={(e) => A.run("colour key", (q) => { const f = C.findClip(q, c.id); if (f?.clip.type === "media") C.setKey(f.clip, { color: e.target.value }); })} data-testid="bk-color" />
      <Btn ghost icon="wand" onClick={() => void keyClip(t, c)} testid="bk-auto">{t("bk.auto")}</Btn></span></label>
    <Slider label={t("bk.sim")} value={k.sim} min={0.01} max={0.5} step={0.005} fmt={pct} onChange={(v) => A.live.set(p("sim"), v)} onCommit={A.live.end} testid="bk-sim" />
    <Slider label={t("bk.soft")} value={k.soft} min={0} max={0.5} step={0.005} fmt={pct} onChange={(v) => A.live.set(p("soft"), v)} onCommit={A.live.end} testid="bk-soft" />
    <Slider label={t("bk.spill")} value={k.spill} min={0} max={1} step={0.01} fmt={pct} onChange={(v) => A.live.set(p("spill"), v)} onCommit={A.live.end} testid="bk-spill" />
    <Btn ghost danger icon="trash" onClick={() => A.run("colour key", (q) => { const f = C.findClip(q, c.id); if (f?.clip.type === "media") C.setKey(f.clip, null); })} testid="bk-unkey">{t("bk.unkey")}</Btn>
  </div>);
}
/** step 1, also in the clip's settings */
export function Separate({ c, compact }: { c: MediaClip; compact?: boolean }) {
  const { t } = useTranslation(); useEditorVersion(); const b = useBusy(); const a = editor.project.assets[c.asset];
  const state = C.keyOf(c) ? "key" : a?.alpha ? "cut" : "none";
  return (<div className="bksep">
    <p className={"hint bkstate " + state} data-testid="bk-state" data-state={state}><Icon name={state === "none" ? "users" : "check"} size={14} />{t("bk.state." + state)}</p>
    {b && b.clip === c.id ? <div className="aibusy" role="status" data-testid="bk-busy"><span>{t("bk.cutting", { n: Math.round(b.k * 100) })}</span><i style={{ width: Math.round(b.k * 100) + "%" }} />
      <Btn ghost icon="close" onClick={() => b.ctrl.abort()} testid="bk-cancel">{t("bk.cancel")}</Btn></div>
      : <div className="bkrow">
        <Btn icon="color" pressed={state === "key"} onClick={() => void keyClip(t, c)} testid="bk-key">{t("bk.key")}</Btn>
        <Btn icon="cutout" primary={state === "none"} pressed={state === "cut"} disabled={!!b} onClick={() => void cutClip(t, c)} testid="bk-cut">{t("bk.cut")}</Btn></div>}
    {!compact && <p className="hint">{t("bk.sepHint")}</p>}
    <KeyControls c={c} />
  </div>);
}

// ---- moving scene tiles: each one plays (all visible tiles share one gentle clock)
const tiles = new Set<() => void>(); let clock = 0;
function tick() { if (!tiles.size) { clock = 0; return; } tiles.forEach((f) => f()); clock = window.setTimeout(() => requestAnimationFrame(tick), 66); }
function SceneTile({ id, onPick, on }: { id: string; onPick: () => void; on: boolean }) {
  const lang = useUI((s) => s.lang); const tpl = BACKGROUNDS.find((x) => x.id === id)!; const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const cv = ref.current; if (!cv) return; const x = cv.getContext("2d")!, props = defaultsOf(tpl, lang), t0 = performance.now() - Math.random() * 4000;
    const draw = () => { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 160, 90); if (drawTemplate(x, id, props, ((performance.now() - t0) / 1000) % 600, tpl.dur, 160, 90)) cv.dataset.drawn = "1"; };
    draw(); let live = false; const io = new IntersectionObserver((es) => { const v = es.some((e) => e.isIntersecting); if (v && !live) { tiles.add(draw); live = true; if (!clock) tick(); } else if (!v && live) { tiles.delete(draw); live = false; } });
    io.observe(cv); return () => { io.disconnect(); tiles.delete(draw); }; }, [id, lang]);
  return <button type="button" className="ns-tile bgt" aria-pressed={on} onClick={onPick} data-testid={"bk-" + id} title={lang === "ar" ? tpl.ar : tpl.en}>
    <span className="bgpic"><canvas ref={ref} width={160} height={90} aria-hidden="true" /></span><span>{lang === "ar" ? tpl.ar : tpl.en}</span></button>;
}

/** (v235) a background made with AI: what it shows (a studio, technology, nature, business, finance — or your own words), where the
 *  person will stand, a picture or a moving one; the price first, credits only if it works */
function AiBackdrop({ onMade }: { onMade: (a: Asset, name: string) => Promise<void> }) {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const [me, setMe] = useState(api.me);
  const [cat, setCat] = useState<Cat | "finance">("studio"); const [words, setWords] = useState(""); const [space, setSpace] = useState<"centre" | "left" | "right">("centre");
  const [kind, setKind] = useState<"picture" | "moving">("picture"); const [cost, setCost] = useState<{ pic: number | null; vid: number | null } | null>(null); const [busy, setBusy] = useState<{ step: string; k: number } | null>(null);
  const aspect = C.aspectOf(editor.project.width, editor.project.height);
  useEffect(() => { void api.init().then(() => setMe({ ...api.me })); return api.on(() => setMe({ ...api.me })); }, []);
  useEffect(() => { if (!api.online || !me.signedIn) { setCost(null); return; } let live = true; setCost(null);
    const tm = setTimeout(() => { void Promise.all([api.quote({ kind: "image", aspect }).then((r) => r.cost).catch(() => null),
      kind === "moving" ? api.quote({ kind: "video", model: "auto", dur: 5, aspect, inputs: { vStart: "frame" } }).then((r) => r.cost).catch(() => null) : Promise.resolve(0)]).then(([pic, vid]) => { if (live) setCost({ pic, vid }); }); }, 250);
    return () => { live = false; clearTimeout(tm); }; }, [kind, me.signedIn, aspect]);
  if (!api.online) return <p className="hint">{t("ai.offline")}</p>;
  if (!me.signedIn) return <div className="empty"><Icon name="ai" size={20} /><p>{t("ai.signIn")}</p><a className="ns-btn primary" href={at("/?signin=1")}>{t("ai.signInBtn")}</a></div>;
  const total = cost && cost.pic != null && cost.vid != null ? cost.pic + cost.vid : null, name = (words.trim() || (lang === "ar" ? AI_CATS[cat][1] : AI_CATS[cat][0])).slice(0, 40);
  const go = async () => {
    try {
      setBusy({ step: t("bk.aiPic"), k: 0.04 });
      const ij = await api.startJob({ kind: "image", prompt: aiWords(cat, words, space), aspect, title: "Background · " + name, meta: { backdrop235: { cat, space } } });
      const ir = await waitJob(ij.id, (x: Job) => setBusy({ step: t("bk.aiPic"), k: 0.05 + (kind === "moving" ? 0.3 : 0.9) * (x.progress || 0.2) }));
      const img = (ir as unknown as { resultUrl?: string; url?: string }).resultUrl || (ir as unknown as { url?: string }).url; if (ir.status !== "done" || !img) throw new Error(ir.error || t("ai.failed"));
      let res: { id: string; kind: string; resultUrl?: string; dur?: number } = { ...(ir as unknown as { id: string; kind: string }), kind: "image", resultUrl: img };
      if (kind === "moving") { setBusy({ step: t("bk.aiMove"), k: 0.4 });
        const vj = await api.startJob({ kind: "video", model: "auto", prompt: AI_MOVE, dur: 5, aspect, inputs: { vStart: img }, title: "Background · " + name });
        const vr = await waitJob(vj.id, (x: Job) => setBusy({ step: t("bk.aiMove"), k: 0.4 + 0.58 * (x.progress || 0.1) })); if (vr.status !== "done") throw new Error(vr.error || t("ai.failed"));
        res = { ...(vr as unknown as { id: string; kind: string; resultUrl?: string; dur?: number }), kind: "video", resultUrl: (vr as unknown as { resultUrl?: string; url?: string }).resultUrl || (vr as unknown as { url?: string }).url }; }
      const a = assetFromJob({ ...res, title: name, aspect }); if (!a) throw new Error(t("ai.failed")); setBusy(null); api.refresh(); await onMade(a, name);
    } catch (e) { setBusy(null); const er = e as { message?: string; errorAr?: string }; toast((lang === "ar" && er.errorAr) || er.message || t("ai.failed"), "warn"); }
  };
  return (<div className="aicard bkai" data-testid="bk-ai">
    <b>{t("bk.aiTitle")}</b><p className="hint">{t("bk.aiHint")}</p>
    <div className="chips" role="tablist">{(Object.keys(AI_CATS) as (Cat | "finance")[]).map((k) => <button key={k} type="button" className="chip" aria-pressed={cat === k} onClick={() => setCat(k)} data-testid={"bkai-" + k}>{lang === "ar" ? AI_CATS[k][1] : AI_CATS[k][0]}</button>)}</div>
    <textarea className="ns-input" rows={2} dir="auto" value={words} onChange={(e) => setWords(e.target.value)} placeholder={AI_CATS[cat][2]} data-testid="bkai-words" />
    <Seg label={t("bk.space")} value={space} onChange={setSpace} options={[{ v: "centre", label: t("bk.centre") }, { v: "left", label: t("bk.left") }, { v: "right", label: t("bk.right") }]} />
    <Seg label={t("bk.aiKind")} value={kind} onChange={setKind} options={[{ v: "picture", label: t("bk.still") }, { v: "moving", label: t("bk.movingOne") }]} />
    <p className="hint" data-testid="bkai-price">{total == null ? t("rs2.pricing") : total === 0 ? t("ai.free") : t("ai.credits", { n: total })}</p>
    {busy ? <div className="aibusy" role="status"><span>{busy.step}</span><i style={{ width: Math.round(busy.k * 100) + "%" }} /></div>
      : <Btn icon="sparkle" primary disabled={total == null || (me.credits != null && total > me.credits)} onClick={() => void go()} testid="bkai-go">{t("bk.aiGo")}{total ? " · " + t("ai.credits", { n: total }) : ""}</Btn>}
  </div>);
}

export function BackdropPanel() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const picked = usePickedMedia(); const b = useBusy();
  const [tab, setTab] = useState<"moving" | "pictures" | "own" | "ai">("moving"); const [light, setLight] = useState(true); const [work, setWork] = useState(false);
  const [cat, setCat] = useState<Cat | "all">("all"); const [sceneLook, setSceneLook] = useState<"moving" | "still">("moving"); const [picLook, setPicLook] = useState<"moving" | "still">("still");
  const has = picked ? C.backdropsOf(editor.project, picked.clip.id) : [], on = has[0]?.c;
  const onTpl = on && on.type === "text" ? on.motion?.tpl : null, onAsset = on && on.type === "media" ? editor.project.assets[on.asset]?.name : null;
  const use = async (bd: Backdrop, name: string, look: BackdropLook = {}) => {
    if (work || b) return; setWork(true);
    try {
      if (!picked) {   // no clip picked: the background goes on the main track, after what is there (5 s, or the video's length)
        A.run("background", (p) => { if (bd.kind === "asset" && !p.assets[bd.asset.id]) p.assets[bd.asset.id] = bd.asset; const sp = C.spineOf(p), at = C.mainTrackEnd(p, "video");
          const d = bd.kind === "asset" && bd.asset.kind === "video" && bd.asset.duration ? bd.asset.duration : 5;
          for (const c of backdropClips(p, bd, at, d, name, lang, look)) C.addClip(p, c, sp?.id || null); });
        toast(t("bk.added"), "ok"); return;
      }
      const c = picked.clip;
      if (!separated(c)) { const k = await screenOfClip(editor.project, c); if (k && C.isStudioScreen(k)) A.run("colour key", (p) => { const f = C.findClip(p, c.id); if (f?.clip.type === "media") C.setKey(f.clip, { ...C.KEY0, color: k.color }); });
        else if (!(await cutClip(t, c))) return; }
      const now = C.findClip(editor.project, c.id)?.clip as MediaClip | undefined; if (!now) return;
      const [pl, bl] = light ? await Promise.all([personLight(editor.project, now), backdropLight(bd, lang)]) : [null, null];
      A.run("new background", (p) => { if (bd.kind === "asset" && !p.assets[bd.asset.id]) p.assets[bd.asset.id] = bd.asset;
        C.putUnder(p, c.id, (s, d) => backdropClips(p, bd, s, d, name, lang, look));
        const f = C.findClip(p, c.id); if (f?.clip.type === "media") applyLight(f.clip, pl && bl ? lightShift(pl, bl) : null); });
      editor.select([c.id]); toast(t("bk.placed"), "ok");
    } finally { setWork(false); }
  };
  const fileAsset = async (f: File) => { setWork(true); try { return (await importFiles([f])).assets[0]; } finally { setWork(false); } };
  const own = async (f?: File) => { if (!f) return; const a = await fileAsset(f); if (a && (a.kind === "video" || a.kind === "image")) await use({ kind: "asset", asset: a }, a.name); else toast(t("bk.badFile"), "warn"); };
  const pic = async (id: string) => { const B = BACKDROPS.find((x) => x.id === id)!; const name = lang === "ar" ? B.ar : B.en; const a = await fileAsset(await svgPng(B.svg, name)); if (a) await use({ kind: "asset", asset: a }, name, { moving: picLook === "moving", fx: [["leak", 0.15]] }); };
  const photo = async (ph: Photo) => { const name = lang === "ar" ? ph.ar : ph.en;
    // (the same picture is used again from the library, not downloaded twice)
    const have = Object.values(editor.project.assets).find((a) => a.name === name && a.kind === "image" && a.mime === "image/webp");
    let a = have; if (!a) { setWork(true); try { const r = await fetch(photoUrl(ph.id)); if (!r.ok) throw new Error("photo"); a = await fileAsset(new File([await r.blob()], name + ".webp", { type: "image/webp" })); } catch { toast(t("bk.badFile"), "warn"); return; } finally { setWork(false); } }
    if (a) await use({ kind: "asset", asset: a }, name, { moving: picLook === "moving", fx: ph.fx }); };
  const cats = <div className="chips" role="tablist">{CATS.map(([k, en, ar]) => <button key={k} type="button" className="chip" aria-pressed={cat === k} onClick={() => setCat(k)} data-testid={"bkc-" + k}>{lang === "ar" ? ar : en}</button>)}</div>;
  return (<div className="bk" data-testid="bk-panel">
    <p className="hint">{t("bk.hint")}</p>
    {picked ? <><span className="ns-lbl">{t("bk.step1")}</span><Separate c={picked.clip} /><span className="ns-lbl">{t("bk.step2")}</span></> : <p className="hint warnline">{t("bk.pickOr")}</p>}
    <Seg label={t("bk.kind")} value={tab} onChange={setTab} options={[{ v: "moving", label: t("bk.moving") }, { v: "pictures", label: t("bk.pictures") }, { v: "own", label: t("bk.own") }, { v: "ai", label: t("bk.ai") }]} />
    {picked && tab !== "ai" && <div className="bkrow"><Btn icon="sun" pressed={light} onClick={() => setLight(!light)} testid="bk-light">{t("bk.light")}</Btn>
      {on && <Btn ghost danger icon="trash" onClick={() => A.run("remove background", (p) => { C.removeBackdrop(p, picked.clip.id); const f = C.findClip(p, picked.clip.id); if (f?.clip.type === "media") applyLight(f.clip, null); })} testid="bk-remove">{t("bk.remove")}</Btn>}</div>}
    {work && <p className="hint" role="status" data-testid="bk-working">{t("bk.working")}</p>}
    {tab === "moving" && <>{cats}<Seg label={t("bk.look")} value={sceneLook} onChange={setSceneLook} options={[{ v: "moving", label: t("bk.movingOne") }, { v: "still", label: t("bk.still") }]} />
      <div className="bggrid" data-testid="bk-moving">{BACKGROUNDS.filter((x) => cat === "all" || SCENE_CAT[x.id] === cat).map((x) => <SceneTile key={x.id} id={x.id} on={onTpl === x.id} onPick={() => void use({ kind: "motion", tpl: x.id }, lang === "ar" ? x.ar : x.en, { still: sceneLook === "still" })} />)}</div></>}
    {tab === "pictures" && <>{cats}<Seg label={t("bk.look")} value={picLook} onChange={setPicLook} options={[{ v: "still", label: t("bk.still") }, { v: "moving", label: t("bk.movingOne") }]} />
      <div className="bggrid bgphotos" data-testid="bk-photos">{PHOTOS.filter((x) => cat === "all" || x.cat === cat).map((x) => <button key={x.id} type="button" className="ns-tile bgt" aria-pressed={onAsset === (lang === "ar" ? x.ar : x.en)} onClick={() => void photo(x)} data-testid={"bkh-" + x.id} title={lang === "ar" ? x.ar : x.en}>
        <span className={"bgpic" + (picLook === "moving" ? " kb" : "")}><img src={photoUrl(x.id, true)} alt="" loading="lazy" draggable={false} /></span><span>{lang === "ar" ? x.ar : x.en}</span></button>)}</div>
      {cat === "all" && <><span className="ns-lbl">{t("bk.drawn")}</span><div className="bggrid">{BACKDROPS.map((x) => <button key={x.id} type="button" className="ns-tile bgt" onClick={() => void pic(x.id)} data-testid={"bkp-" + x.id} title={x.words}>
        <span className="bgpic"><img src={x.svg} alt="" draggable={false} /></span><span>{lang === "ar" ? x.ar : x.en}</span></button>)}</div></>}</>}
    {tab === "own" && <><p className="hint">{t("bk.ownHint")}</p><label className="ns-tile bgt bgown" data-testid="bk-own"><span className="bgpic"><Icon name="upload" size={20} /></span><span>{t("bk.upload")}</span>
      <input type="file" accept="video/*,image/*" hidden onChange={(e) => void own(e.target.files?.[0])} data-testid="bk-file" /></label></>}
    {tab === "ai" && <><AiBackdrop onMade={(a, name) => use({ kind: "asset", asset: a }, name)} />{picked && <><span className="ns-lbl">{t("bk.aiVideo")}</span><BackgroundPanel /></>}</>}
  </div>);
}
/** the clip settings' section: separate, the key's controls, and the way to a new background */
export function BackdropSection({ c }: { c: MediaClip }) {
  const { t } = useTranslation(); const has = C.backdropsOf(editor.project, c.id).length > 0;
  return (<><Separate c={c} compact />
    <Btn icon="backdrop" onClick={() => ui.set((s) => ({ rail: "stock", panelOpen: true, sub: { ...s.sub, stock: "background" } }))} testid="bk-open">{has ? t("bk.change") : t("bk.newBg")}</Btn></>);
}
