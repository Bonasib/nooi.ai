// (v238) Recast — change a filmed video two ways, on the site's own engines (the price first, credits only when it works):
//  · Keep the motion: the movement, the camera and the timing stay exactly as filmed; everything performing it is rebuilt from your
//    references (characters, outfits, props, places, products, a look). A new first frame is made from the references in the pose
//    and framing of the original, then Motion Control carries the whole take's motion onto it.
//  · Swap elements: say what should be different — a person, a product, the text — and the rest of the shot stays untouched
//    (Replace things: only the seconds the change is seen in are made again).
// References show up in every version; run up to 4 versions from one setup, then "More like this" on the one that works; drag the
// handle to compare the original and the new version, played in sync. Our own design.
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Btn, Icon, Seg } from "@nooi/ui";
import * as C from "@nooi/editor-core";
import type { Asset, MediaClip } from "@nooi/editor-core";
import { api } from "../api";
import type { Job } from "../api";
import { editor, toast, useEditorVersion, useUI } from "../state";
import * as A from "../actions";
import { at } from "../site";
import { assetFromJob, serverPath, urlOf } from "../media/library";
import { ensureOnServer, waitJob } from "./AIPanel";
import { charsNow, type Char } from "./Mentions";
import { charPic, place } from "./Replace";
import { frameOf } from "./Restyle";

type Mode = "motion" | "swap";
export type RefKind = "character" | "outfit" | "prop" | "place" | "product" | "look";
export const REF_KINDS: RefKind[] = ["character", "outfit", "prop", "place", "product", "look"];
export interface Ref { id: string; kind: RefKind; label: string; url?: string; thumb?: string }
export interface Row { id: string; what: string; to: string; ref?: string }
interface Setup { mode: Mode; clip: string; asset: string; words: string; keepPlace: boolean; refs: Ref[]; rows: Row[]; aspect: string; dur: number; name: string; lang: string }
interface Run { id: string; setup: Setup; i: number; status: "making" | "done" | "failed"; k: number; step: string; job?: Job; asset?: Asset; error?: string }
const rel = (u: string) => serverPath(u) || u;
const uid = () => Math.random().toString(36).slice(2, 9);

// ---- the runs (kept while the editor is open; the panel can close and come back)
let runs: Run[] = []; const subs = new Set<() => void>();
const set = (f: (r: Run[]) => Run[]) => { runs = f(runs); subs.forEach((x) => x()); };
const upd = (id: string, o: Partial<Run>) => set((r) => r.map((x) => (x.id === id ? { ...x, ...o } : x)));
const useRuns = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => runs);

/** the words for the new first frame: picture 1 is the original frame; the references follow as pictures 2… (at most 4 in all) */
export function frameWords(s: Pick<Setup, "words" | "refs" | "keepPlace">, n: Record<string, number>): string {
  const line = (r: Ref) => { const p = n[r.id] ? ` (picture ${n[r.id]})` : ""; const l = r.label ? `“${r.label}”` : "";
    return r.kind === "character" ? `The person becomes ${l || "the character"}${p} — keep that face and identity exactly.` : r.kind === "outfit" ? `They wear the outfit ${l}${p}.`
      : r.kind === "prop" ? `Add the prop ${l}${p} where it fits the action.` : r.kind === "place" ? `The place becomes ${l || "the location"}${p}.`
      : r.kind === "product" ? `The product ${l}${p} replaces the object being shown or held, with its exact shape, colours and label.` : `Look and grade: ${l}${p}.`; };
  return [`Picture 1 is a frame from a video. Make a new version of exactly this frame: the same framing, camera angle and lens, the same pose and position of every person, the same composition and action.`,
    ...s.refs.map(line), s.keepPlace ? "Keep the place, the background and the light of picture 1." : "", s.words.trim() ? `Also: ${s.words.trim()}.` : "",
    "Photorealistic, natural light that matches the place. No text, no watermark, no extra people."].filter(Boolean).join(" ");
}
/** the changes for Replace things: each line is something to find (in words) and what it becomes (words, a reference picture, a character) */
export function swapChanges(s: Pick<Setup, "rows" | "refs">, pics: Record<string, string>, chars: Char[]) {
  return s.rows.filter((r) => r.what.trim() && (r.to.trim() || r.ref)).map((r, i) => { const ref = s.refs.find((x) => x.id === r.ref), ch = ref?.kind === "character" ? chars.find((c) => c.name === ref.label) : null;
    return { id: "x" + (i + 1), what: r.what.trim().slice(0, 200), ...(r.to.trim() ? { to: r.to.trim().slice(0, 300) } : {}), ...(ref && pics[ref.id] ? { pic: pics[ref.id] } : {}), ...(ch ? { char: { name: ch.name, look: ch.look || "" } } : {}) }; });
}

async function oneRun(run: Run, t: (k: string, o?: Record<string, unknown>) => string) {
  const s = run.setup, a = editor.project.assets[s.asset], f = C.findClip(editor.project, s.clip); if (!a || !f || f.clip.type !== "media") throw new Error(t("rc.gone"));
  const where = await ensureOnServer(a); if (!where) throw new Error(t("rp.upload"));
  const video = where.src ? rel(where.src) : rel(a.src), tag = { v238: { i: run.i, run: run.id } };
  // the references on the server (a character's own photo, or the picture you added)
  const chars = charsNow(), pics: Record<string, string> = {};
  for (const r of s.refs) { if (r.url) pics[r.id] = rel(r.url); else if (r.kind === "character") { const c = chars.find((x) => x.name === r.label); const u = c && (await charPic(c)); if (u) pics[r.id] = u; } }
  if (s.mode === "swap") {
    upd(run.id, { step: t("rc.swapping"), k: 0.08 });
    const body = { ...(where.job ? { job: where.job } : { src: where.src }), changes: swapChanges(s, pics, chars), lang: s.lang };
    const j = await api.startJob({ kind: a.kind === "image" ? "image" : "video", title: s.name + " · " + t("rc.version", { n: run.i + 1 }), meta: { replace136: body, ...tag } });
    return await waitJob(j.id, (x) => upd(run.id, { k: 0.1 + 0.88 * (x.progress || 0.1) }));
  }
  // keep the motion: a new first frame from the references, then the take's motion carried onto it
  upd(run.id, { step: t("rc.frame"), k: 0.05 });
  const frame = rel(await api.upload(await frameOf(f.clip as MediaClip, 0.05), "recast-frame.jpg"));
  const order = s.refs.filter((r) => pics[r.id]).slice(0, 3), n: Record<string, number> = {}; order.forEach((r, i) => (n[r.id] = i + 2));
  const inputs: Record<string, string> = { iRef: frame }; order.forEach((r, i) => (inputs["iRef" + (i + 2)] = pics[r.id]));
  const ij = await api.startJob({ kind: "image", model: "nano", prompt: frameWords(s, n), aspect: s.aspect, inputs, title: s.name + " · " + t("rc.frameShort"), meta: { ...tag } });
  const ir = await waitJob(ij.id, (x) => upd(run.id, { k: 0.06 + 0.24 * (x.progress || 0.2) }));
  const img = (ir as unknown as { resultUrl?: string; url?: string }).resultUrl || (ir as unknown as { url?: string }).url; if (ir.status !== "done" || !img) throw new Error(ir.error || t("ai.failed"));
  upd(run.id, { step: t("rc.motion"), k: 0.32 });
  const vj = await api.startJob({ kind: "video", model: s.keepPlace ? "mc30" : "mc26", prompt: s.words.trim(), dur: s.dur, aspect: s.aspect, inputs: { mcChar: rel(img), mcMove: video }, meta: { orient: "video", ...tag }, title: s.name + " · " + t("rc.version", { n: run.i + 1 }) });
  return await waitJob(vj.id, (x) => upd(run.id, { k: 0.34 + 0.64 * (x.progress || 0.1) }));
}
function start(setup: Setup, count: number, from: number, t: (k: string, o?: Record<string, unknown>) => string, lang: string) {
  for (let i = 0; i < count; i++) {
    const r: Run = { id: uid(), setup, i: from + i, status: "making", k: 0.02, step: t("rc.starting") }; set((x) => [r, ...x]);
    void oneRun(r, t).then((j) => { if (j.status !== "done") throw new Error(j.error || t("ai.failed"));
      const a = assetFromJob({ ...(j as unknown as { id: string; kind: string; resultUrl?: string; dur?: number }), resultUrl: (j as unknown as { url?: string }).url || j.resultUrl, title: setup.name + " · " + t("rc.version", { n: r.i + 1 }), aspect: setup.aspect });
      upd(r.id, { status: "done", k: 1, job: j, asset: a || undefined }); api.refresh(); })
      .catch((e) => { const er = e as { message?: string; errorAr?: string }; upd(r.id, { status: "failed", error: (lang === "ar" && er.errorAr) || er.message || t("ai.failed") }); });
  }
}

// ---- original ↔ new, played in sync, a handle to drag
export function Compare({ a, b, onClose }: { a: string; b: string; onClose: () => void }) {
  const { t } = useTranslation(); const va = useRef<HTMLVideoElement>(null), vb = useRef<HTMLVideoElement>(null), box = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(50); const [playing, setPlaying] = useState(false);
  useEffect(() => { let raf = 0; const tick = () => { const A1 = va.current, B1 = vb.current; if (A1 && B1 && !B1.paused && Math.abs(A1.currentTime - B1.currentTime) > 0.08) A1.currentTime = B1.currentTime; raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick);
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; addEventListener("keydown", k); return () => { cancelAnimationFrame(raf); removeEventListener("keydown", k); }; }, []);
  const both = (f: (v: HTMLVideoElement) => void) => { for (const v of [va.current, vb.current]) if (v) f(v); };
  const toggle = () => { if (playing) { both((v) => v.pause()); setPlaying(false); } else { both((v) => { v.currentTime = vb.current?.currentTime || 0; void v.play().catch(() => undefined); }); setPlaying(true); } };
  const drag = (e: React.PointerEvent) => { const r = box.current!.getBoundingClientRect(); setX(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))); };
  return (<div className="rccmp" role="dialog" aria-modal="true" aria-label={t("rc.compare")} data-testid="rc-compare">
    <div className="rccmpbox" ref={box} onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag(e); }} onPointerMove={(e) => { if (e.buttons) drag(e); }}>
      <video ref={vb} src={b} muted playsInline loop crossOrigin="anonymous" data-testid="rc-new" onTimeUpdate={(e) => { const A1 = va.current; if (A1 && A1.paused && Math.abs(A1.currentTime - e.currentTarget.currentTime) > 0.08) A1.currentTime = e.currentTarget.currentTime; }} />
      <video ref={va} src={a} muted playsInline loop crossOrigin="anonymous" data-testid="rc-old" style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }} />
      <span className="rccmpline" style={{ left: x + "%" }}><i /></span><b className="rccmpl l">{t("rc.original")}</b><b className="rccmpl r">{t("rc.new")}</b>
    </div>
    <div className="rccmpbar"><Btn icon={playing ? "pause" : "play"} primary onClick={toggle} testid="rc-play">{playing ? t("rc.pause") : t("rc.play")}</Btn>
      <input type="range" min={0} max={100} value={Math.round(x)} onChange={(e) => setX(+e.target.value)} aria-label={t("rc.handle")} data-testid="rc-handle" />
      <Btn ghost icon="close" onClick={onClose} testid="rc-close">{t("rc.close")}</Btn></div>
  </div>);
}

export function RecastPanel() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); useEditorVersion(); const all = useRuns();
  const c = A.sel1(); const clip = c?.type === "media" && editor.project.assets[c.asset]?.kind === "video" ? (c as MediaClip) : null; const asset = clip ? editor.project.assets[clip.asset] : null;
  const [me, setMe] = useState(api.me); const [mode, setMode] = useState<Mode>("motion"); const [words, setWords] = useState(""); const [keepPlace, setKeepPlace] = useState(false);
  const [refs, setRefs] = useState<Ref[]>([]); const [rows, setRows] = useState<Row[]>([{ id: uid(), what: "", to: "" }]); const [count, setCount] = useState(2);
  const [kind, setKind] = useState<RefKind>("outfit"); const [busyUp, setBusyUp] = useState(false); const [cost, setCost] = useState<number | null>(null); const [why, setWhy] = useState("");
  const [cmp, setCmp] = useState<{ a: string; b: string } | null>(null);
  useEffect(() => { void api.init().then(() => setMe({ ...api.me })); return api.on(() => setMe({ ...api.me })); }, []);
  const aspect = C.aspectOf(editor.project.width, editor.project.height), dur = Math.max(3, Math.min(30, Math.round(asset?.duration || clip?.dur || 5)));
  const setup = (): Setup | null => clip && asset ? { mode, clip: clip.id, asset: asset.id, words, keepPlace, refs, rows, aspect, dur, name: asset.name, lang } : null;
  const ready = !!clip && (mode === "motion" ? refs.length > 0 || words.trim().length > 2 : rows.some((r) => r.what.trim() && (r.to.trim() || r.ref)));
  // the price of one version (the server's own rule), then × versions
  useEffect(() => { setCost(null); setWhy(""); if (!api.online || !me.signedIn || !clip || !asset || !ready) return; let live = true;
    const tm = setTimeout(async () => { try {
      if (mode === "motion") { const [p1, p2] = await Promise.all([api.quote({ kind: "image", model: "nano", aspect, inputs: { iRef: "x" } }), api.quote({ kind: "video", model: keepPlace ? "mc30" : "mc26", dur, aspect, inputs: { mcChar: "x", mcMove: "x" } })]); if (live) setCost(p1.cost + p2.cost); }
      else { const where = await ensureOnServer(asset); if (!where) throw new Error(t("rp.upload"));
        const q = await api.req<{ total: number; ready?: boolean }>("/v1/replace136/quote", { json: { ...(where.job ? { job: where.job } : { src: where.src }), changes: swapChanges({ rows, refs }, {}, charsNow()), lang } });
        if (live) { setCost(q.total); if (q.ready === false) setWhy(t("rp.notReady")); } }
    } catch (e) { const er = e as { message?: string; errorAr?: string }; if (live) setWhy((lang === "ar" && er.errorAr) || er.message || ""); } }, 400);
    return () => { live = false; clearTimeout(tm); }; }, [clip?.id, mode, keepPlace, ready, JSON.stringify(rows), refs.length, me.signedIn]);
  if (!api.online) return <p className="hint">{t("ai.offline")}</p>;
  if (!me.signedIn) return <div className="empty"><Icon name="ai" size={20} /><p>{t("ai.signIn")}</p><a className="ns-btn primary" href={at("/?signin=1")}>{t("ai.signInBtn")}</a></div>;
  const total = cost == null ? null : cost * count, short = !me.free && me.credits != null && total != null && total > me.credits;
  const addPic = async (f?: File) => { if (!f) return; setBusyUp(true); try { const u = await api.upload(f, f.name); setRefs((r) => [...r, { id: uid(), kind, label: f.name.replace(/\.\w+$/, "").slice(0, 40), url: rel(u), thumb: URL.createObjectURL(f) }]); }
    catch { toast(t("rp.upload"), "warn"); } finally { setBusyUp(false); } };
  const addChar = (ch: Char) => setRefs((r) => (r.some((x) => x.kind === "character" && x.label === ch.name) ? r : [...r, { id: uid(), kind: "character", label: ch.name, thumb: ch.photo }]));
  const go = (more?: Setup) => { const s = more || setup(); if (!s) return; const done = all.filter((r) => r.setup === s).length; start(s, more ? 2 : count, more ? done : 0, t, lang); };
  const chars = charsNow(); const mine = clip ? all.filter((r) => r.setup.clip === clip.id) : all;
  return (<div className="rc" data-testid="recast-panel">
    <p className="hint">{t("rc.hint")}</p>
    {!clip ? <p className="hint warnline">{t("rc.pick")}</p> : <>
      <Seg label={t("rc.mode")} value={mode} onChange={setMode} options={[{ v: "motion", label: t("rc.motionMode") }, { v: "swap", label: t("rc.swapMode") }]} />
      <p className="hint">{mode === "motion" ? t("rc.motionHint") : t("rc.swapHint")}</p>
      <span className="ns-lbl">{t("rc.refs")}</span>
      <div className="rcrefs" data-testid="rc-refs">{refs.map((r) => <span key={r.id} className="rcref" data-testid={"rc-ref-" + r.kind}>
        {r.thumb ? <img src={r.thumb} alt="" /> : <Icon name="image" size={14} />}<b>{t("rc.k." + r.kind)}</b><input className="ns-input" dir="auto" value={r.label} onChange={(e) => setRefs((x) => x.map((y) => (y.id === r.id ? { ...y, label: e.target.value } : y)))} aria-label={t("rc.refName")} />
        <button type="button" aria-label={t("rc.remove")} onClick={() => setRefs((x) => x.filter((y) => y.id !== r.id))}><Icon name="close" size={14} /></button></span>)}
        {!refs.length && <p className="hint">{t("rc.noRefs")}</p>}</div>
      <div className="rcadd"><select className="ns-input" value={kind} onChange={(e) => setKind(e.target.value as RefKind)} aria-label={t("rc.kind")} data-testid="rc-kind">{REF_KINDS.filter((k) => k !== "character").map((k) => <option key={k} value={k}>{t("rc.k." + k)}</option>)}</select>
        <label className="ns-btn" data-testid="rc-add"><Icon name="upload" size={14} />{busyUp ? t("rc.uploading") : t("rc.addPic")}<input type="file" accept="image/*" hidden onChange={(e) => void addPic(e.target.files?.[0])} data-testid="rc-file" /></label></div>
      {chars.length > 0 && <div className="chips">{chars.map((ch) => <button key={ch.id} type="button" className="chip" onClick={() => addChar(ch)} data-testid={"rc-char-" + ch.name}>@{ch.name}</button>)}</div>}
      {mode === "motion" ? <>
        <label className="ns-field"><span>{t("rc.words")}</span><textarea className="ns-input" rows={2} dir="auto" value={words} onChange={(e) => setWords(e.target.value)} placeholder={t("rc.wordsPh")} data-testid="rc-words" /></label>
        <Btn icon="image" pressed={keepPlace} onClick={() => setKeepPlace(!keepPlace)} testid="rc-keep">{t("rc.keepPlace")}</Btn>
      </> : <div className="rcrows" data-testid="rc-rows">{rows.map((r, i) => <div key={r.id} className="rcrow">
        <input className="ns-input" dir="auto" value={r.what} onChange={(e) => setRows((x) => x.map((y) => (y.id === r.id ? { ...y, what: e.target.value } : y)))} placeholder={t("rc.whatPh")} data-testid={"rc-what-" + i} />
        <Icon name="next" size={14} />
        <input className="ns-input" dir="auto" value={r.to} onChange={(e) => setRows((x) => x.map((y) => (y.id === r.id ? { ...y, to: e.target.value } : y)))} placeholder={t("rc.toPh")} data-testid={"rc-to-" + i} />
        <select className="ns-input" value={r.ref || ""} onChange={(e) => setRows((x) => x.map((y) => (y.id === r.id ? { ...y, ref: e.target.value || undefined } : y)))} aria-label={t("rc.useRef")} data-testid={"rc-useref-" + i}>
          <option value="">{t("rc.noRef")}</option>{refs.map((f) => <option key={f.id} value={f.id}>{t("rc.k." + f.kind)} · {f.label}</option>)}</select>
        {rows.length > 1 && <button type="button" className="rcx" aria-label={t("rc.remove")} onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))}><Icon name="close" size={14} /></button>}</div>)}
        <Btn ghost icon="plus" onClick={() => setRows((x) => [...x, { id: uid(), what: "", to: "" }])} testid="rc-addrow">{t("rc.addRow")}</Btn></div>}
      <Seg label={t("rc.versions")} value={String(count)} onChange={(v) => setCount(+v)} options={["1", "2", "3", "4"].map((v) => ({ v, label: v }))} />
      <p className="hint" data-testid="rc-price">{why || (!ready ? t("rc.needMore") : total == null ? t("rs2.pricing") : total === 0 ? t("ai.free") : t("rc.price", { n: total, each: cost }))}</p>
      {short && <p className="err">{t("rs2.short")}</p>}
      <Btn icon="sparkle" primary disabled={!ready || total == null || !!why || short} onClick={() => go()} testid="rc-go">{t("rc.go", { n: count })}</Btn>
    </>}
    {mine.length > 0 && <><span className="ns-lbl">{t("rc.results")}</span><div className="rcres" data-testid="rc-results">{mine.map((r) => <div key={r.id} className={"rccard " + r.status} data-testid={"rc-run-" + r.status}>
      <b>{t("rc.version", { n: r.i + 1 })} · {r.setup.mode === "motion" ? t("rc.motionMode") : t("rc.swapMode")}</b>
      {r.status === "making" ? <div className="aibusy" role="status"><span>{r.step}</span><i style={{ width: Math.round(r.k * 100) + "%" }} /></div>
        : r.status === "failed" ? <p className="err" dir="auto">{r.error}</p>
        : <div className="bkrow">
          <Btn icon="layout" onClick={async () => { const a0 = editor.project.assets[r.setup.asset]; const u0 = a0 && (await urlOf(a0)); if (u0 && r.asset) setCmp({ a: u0, b: at(r.asset.src) }); }} testid="rc-cmp">{t("rc.compare")}</Btn>
          <Btn icon="check" primary onClick={() => { if (r.job && place(r.setup.clip, r.job, r.setup.name + " · " + t("rc.version", { n: r.i + 1 }), "replace")) toast(t("rc.used"), "ok"); }} testid="rc-use">{t("rc.use")}</Btn>
          <Btn icon="plus" onClick={() => r.job && place(r.setup.clip, r.job, r.setup.name + " · " + t("rc.version", { n: r.i + 1 }), "above")} testid="rc-above">{t("rc.above")}</Btn>
          <Btn icon="sparkle" onClick={() => go(r.setup)} testid="rc-more">{t("rc.more")}</Btn></div>}
    </div>)}</div></>}
    {cmp && <Compare a={cmp.a} b={cmp.b} onClose={() => setCmp(null)} />}
  </div>);
}
