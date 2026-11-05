// (v231) Replace with AI, through the site's own Replace-things engine (lib/scan136.js + lib/replace136.js — the keys stay on the server):
//  · a person, a face or a look → one of your @characters, or words; a voice → another voice (and new words if you like); or removed.
//    The picked clip is looked at first (what is seen and heard, with pictures of each thing), the price is shown, credits are
//    taken only if it works; only the seconds the change is seen in are made again, the rest of the video stays as it was.
//  · the background → nature, a studio, a market… (drawn examples) or your own picture or video (its first frame), the people
//    kept, the light on them matched to the new place.
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Btn, Icon, Seg } from "@nooi/ui";
import * as C from "@nooi/editor-core";
import type { MediaClip } from "@nooi/editor-core";
import { api } from "../api";
import type { Job } from "../api";
import { editor, toast, useEditorVersion, useUI } from "../state";
import { assetFromJob, serverPath, urlOf } from "../media/library";
import * as A from "../actions";
import { at } from "../site";
import { ensureOnServer, waitJob } from "./AIPanel";
import { VOICES231, charsNow, type Char } from "./Mentions";

interface Item { id: string; kind: string; name: string; en?: string; where?: string; thumb?: string | null; at?: number | null }
interface Sound { id: string; kind: string; from?: number; to?: number; words?: string }
interface Scan { items?: Item[]; sounds?: Sound[]; dur?: number; image?: boolean; src?: string; job?: string | null; failed?: boolean }
type Change = { id: string; what?: string; to?: string; pic?: string; char?: { name: string; look?: string }; voice?: string; say?: string; remove?: boolean };

function usePicked() { useEditorVersion(); const c = A.sel1(); const a = c?.type === "media" ? editor.project.assets[(c as MediaClip).asset] : null; return a && (a.kind === "video" || a.kind === "image") ? { clip: c as MediaClip, asset: a } : null; }
const rel = (u: string) => serverPath(u) || u;
export async function charPic(c: Char): Promise<string | undefined> { if (!c.photo) return undefined; try { return rel(await api.upload(await (await fetch(c.photo)).blob(), "char-" + c.name.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 20) + ".jpg")); } catch { return undefined; } }
export function place(clipId: string, j: Job, title: string, mode: "replace" | "above") {
  const a = assetFromJob({ ...(j as unknown as { id: string; kind: string; resultUrl?: string; dur?: number }), resultUrl: (j as unknown as { url?: string }).url || j.resultUrl, title }); if (!a) return false;
  A.run("replace with AI", (p) => { p.assets[a.id] = a; const f = C.findClip(p, clipId); if (!f || f.clip.type !== "media") return;
    if (mode === "replace") { f.clip.asset = a.id; f.clip.in = 0; f.clip.speed = 1; f.clip.reverse = false; f.clip.freeze = null; f.clip.name = a.name; if (a.duration) f.clip.dur = Math.min(f.clip.dur, a.duration); }
    else { const tr = C.addTrack(p, "video", p.tracks.indexOf(f.track)); const n = C.addAssetClip(p, a, f.clip.start, tr.id); n.dur = Math.min(n.dur, f.clip.dur); } });
  return true;
}
function useMe() { const [me, setMe] = useState(api.me); useEffect(() => { void api.init().then(() => setMe({ ...api.me })); return api.on(() => setMe({ ...api.me })); }, []); return me; }
function Gate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation(); const me = useMe();
  if (!api.online) return <p className="hint">{t("ai.offline")}</p>;
  if (!me.signedIn) return <div className="empty"><Icon name="ai" size={20} /><p>{t("ai.signIn")}</p><a className="ns-btn primary" href={at("/?signin=1")}>{t("ai.signInBtn")}</a></div>;
  return <>{children}</>;
}
/** the price first, then the job, then the clip changed */
function useRun(picked: ReturnType<typeof usePicked>, body: () => Record<string, unknown> | null, deps: unknown[]) {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const [cost, setCost] = useState<number | null>(null); const [why, setWhy] = useState(""); const [busy, setBusy] = useState<{ step: string; k: number } | null>(null);
  useEffect(() => { const b = body(); setCost(null); setWhy(""); if (!b) return; let live = true; const tm = setTimeout(() => {
    api.req<{ total: number; ready?: boolean }>("/v1/replace136/quote", { json: b }).then((q) => { if (!live) return; setCost(q.total); if (q.ready === false) setWhy(t("rp.notReady")); })
      .catch((e: { message?: string; errorAr?: string }) => live && setWhy((lang === "ar" && e.errorAr) || e.message || "")); }, 350); return () => { live = false; clearTimeout(tm); }; }, deps);
  const go = async (title: string, mode: "replace" | "above") => {
    const b = body(); if (!b || !picked) return;
    try { setBusy({ step: t("rp.starting"), k: 0.05 }); const j = await api.startJob({ kind: picked.asset.kind === "image" ? "image" : "video", title, meta: { replace136: b } });
      const r = await waitJob(j.id, (x) => setBusy({ step: t("rp.making"), k: 0.1 + 0.85 * (x.progress || 0.1) })); if (r.status !== "done") throw new Error(r.error || t("ai.failed"));
      if (!place(picked.clip.id, r, title, mode)) throw new Error(t("ai.failed")); setBusy(null); toast(t("rp.done"), "ok"); api.refresh();
    } catch (e) { setBusy(null); const er = e as { message?: string; errorAr?: string }; toast((lang === "ar" && er.errorAr) || er.message || t("ai.failed"), "warn"); }
  };
  return { cost, why, busy, go };
}

// ---------------- a person, a face, a look, a voice
export function ReplacePanel() { return <Gate><ReplaceInner /></Gate>; }
function ReplaceInner() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const picked = usePicked(); const me = useMe();
  const [scan, setScan] = useState<Scan | null>(null); const [looking, setLooking] = useState(false); const [sel, setSel] = useState<string>(""); const [mode, setMode] = useState<"char" | "words" | "remove">("char");
  const [to, setTo] = useState(""); const [char, setChar] = useState<string>(""); const [voice, setVoice] = useState("woman"); const [say, setSay] = useState(""); const [pic, setPic] = useState<string | undefined>(); const [placeAt, setPlaceAt] = useState<"replace" | "above">("replace");
  const chars = charsNow(); const ch = chars.find((c) => c.id === char);
  useEffect(() => { setScan(null); setSel(""); }, [picked?.clip.id]);
  useEffect(() => { let live = true; setPic(undefined); if (ch && mode === "char") void charPic(ch).then((u) => live && setPic(u)); return () => { live = false; }; }, [char, mode]);
  const look = async () => {
    if (!picked) return; setLooking(true);
    try { const at0 = await ensureOnServer(picked.asset); if (!at0) throw new Error(t("rp.upload")); setScan(await api.req<Scan>("/v1/scan136", { json: { ...at0, lang } })); }
    catch (e) { const er = e as { message?: string; errorAr?: string }; toast((lang === "ar" && er.errorAr) || er.message || t("ai.failed"), "warn"); } finally { setLooking(false); }
  };
  const isSound = !!scan?.sounds?.some((s) => s.id === sel), item = scan?.items?.find((i) => i.id === sel);
  const change = (): Change | null => { if (!sel) return null; if (mode === "remove") return { id: sel, remove: true };
    if (isSound) return { id: sel, voice, ...(say.trim() ? { say: say.trim() } : {}) };
    if (mode === "char") return ch ? { id: sel, char: { name: ch.name, look: ch.look || "" }, ...(pic ? { pic } : {}) } : null;
    return to.trim() ? { id: sel, to: to.trim() } : null; };
  const body = () => { const c = change(); return scan && c ? { ...(scan.job ? { job: scan.job } : { src: scan.src }), changes: [c], lang } : null; };
  const run = useRun(picked, body, [scan?.src, sel, mode, to, char, voice, say, pic]);
  const people = (scan?.items || []).filter((i) => i.kind === "person"), things = (scan?.items || []).filter((i) => i.kind !== "person"), speech = (scan?.sounds || []).filter((s) => s.kind === "speech" || s.kind === "music");
  return (<div className="rp" data-testid="replace-panel">
    <p className="hint">{t("rp.hint")}</p>
    {!picked ? <p className="hint warnline">{t("rp.pick")}</p> : !scan ? <Btn icon="search" primary disabled={looking} onClick={() => void look()} testid="rp-look">{looking ? t("rp.looking") : t("rp.look")}</Btn> : <>
      {scan.failed && <p className="hint warnline">{t("rp.basic")}</p>}
      {[["people", people], ["things", things]].map(([k, list]) => (list as Item[]).length > 0 && <div key={k as string}><span className="ns-lbl">{t("rp." + k)}</span>
        <div className="rpgrid">{(list as Item[]).map((i) => <button key={i.id} type="button" className="ns-tile rpt" aria-pressed={sel === i.id} onClick={() => setSel(i.id)} data-testid={"rp-" + i.id}>
          {i.thumb ? <img src={at(i.thumb)} alt="" /> : <span className="rpph"><Icon name={i.kind === "person" ? "users" : "image"} size={18} /></span>}<span dir="auto">{i.name}</span></button>)}</div></div>)}
      {speech.length > 0 && <div><span className="ns-lbl">{t("rp.sounds")}</span><div className="rpgrid">{speech.map((s) => <button key={s.id} type="button" className="ns-tile rpt" aria-pressed={sel === s.id} onClick={() => setSel(s.id)} data-testid={"rp-" + s.id}>
        <span className="rpph"><Icon name={s.kind === "speech" ? "mic" : "audio"} size={18} /></span><span dir="auto">{s.words ? "“" + s.words.slice(0, 40) + "”" : s.kind === "speech" ? t("rp.voice") : t("rp.music")}{s.from != null ? ` · ${s.from}–${s.to}s` : ""}</span></button>)}</div></div>}
      {sel && <div className="aicard" data-testid="rp-form">
        {isSound ? <>
          <label className="ns-field"><span>{t("rp.newVoice")}</span><select className="ns-input" value={voice} onChange={(e) => setVoice(e.target.value)} data-testid="rp-voice">{VOICES231.map(([k, en, ar]) => <option key={k} value={k}>{lang === "ar" ? ar : en}</option>)}</select></label>
          <label className="ns-field"><span>{t("rp.say")}</span><textarea className="ns-input" rows={2} dir="auto" value={say} onChange={(e) => setSay(e.target.value)} placeholder={t("rp.sayPh")} /></label>
          <Btn ghost icon="trash" pressed={mode === "remove"} onClick={() => setMode(mode === "remove" ? "char" : "remove")}>{t("rp.removeSound")}</Btn>
        </> : <>
          <Seg label={t("rp.with")} value={mode} onChange={setMode} options={[{ v: "char", label: t("rp.char") }, { v: "words", label: t("rp.words") }, { v: "remove", label: t("rp.remove") }]} />
          {mode === "char" && (chars.length ? <div className="rpgrid">{chars.map((c) => <button key={c.id} type="button" className="ns-tile rpt" aria-pressed={char === c.id} onClick={() => setChar(c.id)} data-testid={"rpc-" + c.name}>
            {c.photo ? <img src={c.photo} alt="" /> : <span className="rpph"><Icon name="users" size={18} /></span>}<span dir="auto">@{c.name}</span></button>)}</div>
            : <p className="hint">{t("rp.noChars")} <a href={at("/?view=chars")}>{t("mn.sitechars")}</a></p>)}
          {mode === "words" && <textarea className="ns-input" rows={2} dir="auto" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("rp.toPh")} data-testid="rp-to" />}
          {item?.where && <p className="hint" dir="auto">{item.en || item.name} · {item.where}</p>}
        </>}
        <Seg label={t("rs2.place")} value={placeAt} onChange={setPlaceAt} options={[{ v: "replace", label: t("rs2.replace") }, { v: "above", label: t("rs2.above") }]} />
        <p className="hint" data-testid="rp-price">{run.why ? run.why : run.cost == null ? t("rs2.pricing") : run.cost === 0 ? t("ai.free") : t("ai.credits", { n: run.cost })}</p>
        {run.busy ? <div className="aibusy" role="status"><span>{run.busy.step}</span><i style={{ width: Math.round(run.busy.k * 100) + "%" }} /></div>
          : <Btn icon="sparkle" primary disabled={run.cost == null || !!run.why || (!me.free && me.credits != null && run.cost > me.credits)} onClick={() => void run.go(picked.asset.name + " · " + t("rp.replaced"), placeAt)} testid="rp-go">{t("rp.go")}{run.cost ? " · " + t("ai.credits", { n: run.cost }) : ""}</Btn>}
      </div>}
    </>}
  </div>);
}

// ---------------- the background
export const BACKDROPS: { id: string; en: string; ar: string; words: string; svg: string }[] = [
  ["forest", "Forest", "غابة", "a green forest with tall trees and soft sunbeams through the leaves", "<rect width='160' height='90' fill='#2f5d3a'/><rect y='60' width='160' height='30' fill='#2a4a26'/>" + [10, 34, 58, 82, 106, 130, 150].map((x, i) => `<path d='M${x} 70 l12 -${36 + (i % 3) * 8} l12 ${36 + (i % 3) * 8}z' fill='#1f4a2a'/>`).join("") + "<path d='M100 0 L70 90 L90 90 L118 0z' fill='#fff8c8' opacity='.18'/>"],
  ["beach", "Beach", "شاطئ", "a sunny tropical beach with turquoise sea and white sand", "<rect width='160' height='90' fill='#7fd3f5'/><rect y='42' width='160' height='22' fill='#1fb3c8'/><rect y='62' width='160' height='28' fill='#f2deae'/><circle cx='128' cy='18' r='9' fill='#fff3b0'/>"],
  ["desert", "Desert", "صحراء", "golden desert dunes at sunset", "<rect width='160' height='90' fill='#f6b26b'/><circle cx='40' cy='34' r='12' fill='#ffe08a'/><path d='M0 60 Q40 40 80 60 T160 56 V90 H0z' fill='#d98c3f'/><path d='M0 74 Q50 58 100 74 T160 70 V90 H0z' fill='#c27630'/>"],
  ["mountains", "Mountains", "جبال", "snowy mountains under a clear blue sky", "<rect width='160' height='90' fill='#9fd0ff'/><path d='M0 80 L40 30 L70 70 L100 24 L160 80 V90 H0z' fill='#5a6d86'/><path d='M40 30 l8 10 h-16z M100 24 l10 12 h-20z' fill='#fff'/>"],
  ["studio", "White studio", "استوديو أبيض", "a clean white photo studio with a seamless backdrop and soft even light", "<rect width='160' height='90' fill='#f4f4f2'/><rect y='62' width='160' height='28' fill='#e6e6e2'/><ellipse cx='80' cy='62' rx='70' ry='6' fill='#ecece8'/>"],
  ["studio-dark", "Dark studio", "استوديو داكن", "a dark professional studio with soft key lights and a subtle grey backdrop", "<rect width='160' height='90' fill='#1d1f24'/><radialGradient id='g' cx='.5' cy='.45' r='.5'><stop offset='0' stop-color='#4a4f5a'/><stop offset='1' stop-color='#1d1f24'/></radialGradient><rect width='160' height='90' fill='url(#g)'/><rect x='8' y='14' width='16' height='22' fill='#fff' opacity='.6'/><rect x='136' y='14' width='16' height='22' fill='#fff' opacity='.6'/>"],
  ["market", "Market", "سوق", "a busy traditional market street with colourful stalls, lanterns and shoppers", "<rect width='160' height='90' fill='#8a4b2a'/>" + [0, 32, 64, 96, 128].map((x, i) => `<rect x='${x + 2}' y='30' width='28' height='40' fill='${["#c0392b", "#e67e22", "#16a085", "#8e44ad", "#d4ac0d"][i]}'/><path d='M${x + 2} 30 l14 -10 l14 10z' fill='#f5e6c8'/>`).join("") + [20, 60, 100, 140].map((x) => `<circle cx='${x}' cy='12' r='4' fill='#ffcc55'/>`).join("") + "<rect y='70' width='160' height='20' fill='#5c3a22'/>"],
  ["city", "City at night", "مدينة ليلاً", "a modern city skyline at night with glowing windows and bokeh lights", "<rect width='160' height='90' fill='#0b1030'/>" + [[0, 40, 22], [24, 26, 18], [44, 50, 20], [66, 18, 24], [92, 34, 18], [112, 22, 22], [136, 44, 24]].map(([x, y, w]) => `<rect x='${x}' y='${y}' width='${w}' height='${90 - y}' fill='#1c2456'/>` + Array.from({ length: 6 }, (_, k) => `<rect x='${x + 4 + (k % 2) * 8}' y='${y + 6 + Math.floor(k / 2) * 10}' width='4' height='5' fill='#ffd76a'/>`).join("")).join("")],
  ["office", "Office", "مكتب", "a bright modern office with big windows, plants and wooden desks", "<rect width='160' height='90' fill='#e9eef2'/>" + [10, 60, 110].map((x) => `<rect x='${x}' y='10' width='40' height='44' fill='#b9dcf2'/><rect x='${x + 19}' y='10' width='2' height='44' fill='#fff'/>`).join("") + "<rect y='64' width='160' height='26' fill='#c9a27a'/><circle cx='150' cy='58' r='9' fill='#3a8f4c'/>"],
  ["cafe", "Café", "مقهى", "a cosy café with warm lights, brick walls and coffee cups", "<rect width='160' height='90' fill='#7a4a32'/>" + Array.from({ length: 24 }, (_, k) => `<rect x='${(k % 8) * 20 + (Math.floor(k / 8) % 2) * 10}' y='${Math.floor(k / 8) * 12}' width='18' height='10' fill='#8f573b'/>`).join("") + [30, 80, 130].map((x) => `<circle cx='${x}' cy='44' r='6' fill='#ffcf7a'/>`).join("") + "<rect y='64' width='160' height='26' fill='#4a2c1c'/>"],
  ["space", "Space", "الفضاء", "deep space with stars, a glowing nebula and a planet", "<rect width='160' height='90' fill='#050816'/><radialGradient id='n' cx='.35' cy='.45' r='.5'><stop offset='0' stop-color='#7b61ff' stop-opacity='.7'/><stop offset='1' stop-color='#050816' stop-opacity='0'/></radialGradient><rect width='160' height='90' fill='url(#n)'/><circle cx='122' cy='60' r='16' fill='#ff9d5c'/>" + Array.from({ length: 30 }, (_, k) => `<circle cx='${(k * 37) % 160}' cy='${(k * 53) % 90}' r='.8' fill='#fff'/>`).join("")],
  ["snow", "Snowy village", "قرية مثلجة", "a snowy village street with falling snow and warm windows", "<rect width='160' height='90' fill='#b8c7d9'/><rect y='62' width='160' height='28' fill='#f4f8fb'/>" + [20, 70, 120].map((x) => `<rect x='${x}' y='40' width='28' height='24' fill='#7a5a44'/><path d='M${x - 4} 40 l18 -14 l18 14z' fill='#fff'/><rect x='${x + 10}' y='48' width='8' height='8' fill='#ffd76a'/>`).join("") + Array.from({ length: 30 }, (_, k) => `<circle cx='${(k * 41) % 160}' cy='${(k * 29) % 60}' r='1.2' fill='#fff'/>`).join("")],
].map(([id, en, ar, words, inner]) => ({ id, en, ar, words, svg: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'>${inner}</svg>`) }));

async function firstFrame(f: File): Promise<Blob> {
  if (f.type.startsWith("image/")) return f;
  const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto";
  const u = URL.createObjectURL(f); await new Promise<void>((ok, no) => { v.onloadeddata = () => ok(); v.onerror = () => no(new Error("video")); v.src = u; });
  await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = Math.min(0.1, (v.duration || 1) / 2); });
  const cv = Object.assign(document.createElement("canvas"), { width: v.videoWidth, height: v.videoHeight }); cv.getContext("2d")!.drawImage(v, 0, 0); URL.revokeObjectURL(u);
  return await new Promise<Blob>((ok) => cv.toBlob((b) => ok(b!), "image/jpeg", 0.9));
}
export function BackgroundPanel() { return <Gate><BackgroundInner /></Gate>; }
function BackgroundInner() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const picked = usePicked(); const me = useMe();
  const [bg, setBg] = useState<string>(""); const [own, setOwn] = useState<{ url: string; name: string; video: boolean } | null>(null); const [words, setWords] = useState(""); const [light, setLight] = useState(true);
  const [src, setSrc] = useState<{ job?: string; src?: string } | null>(null); const [placeAt, setPlaceAt] = useState<"replace" | "above">("replace"); const [upl, setUpl] = useState(false); const [thumb, setThumb] = useState("");
  useEffect(() => { let live = true; setSrc(null); setThumb(""); if (picked) { void ensureOnServer(picked.asset).then((s) => live && setSrc(s)); void urlOf(picked.asset).then((u) => live && picked.asset.kind === "image" && setThumb(u || "")); } return () => { live = false; }; }, [picked?.clip.id]);
  const B = BACKDROPS.find((x) => x.id === bg);
  const to = () => { const place = own ? (own.video ? "the place shown in the picture (keep it moving gently, as in a video)" : "the place shown in the picture") : words.trim() || (B ? B.words : "");
    return place ? `${place}${light ? ". Relight the people so the light direction, colour and shadows on them match the new background, natural and seamless" : ""}.` : ""; };
  const body = () => { const w = to(); return src && w ? { ...src, changes: [{ id: "x1", what: "the whole background behind the people (everything except the people and what they hold)", to: w, ...(own ? { pic: own.url } : {}) }], lang } : null; };
  const run = useRun(picked, body, [src?.src, src?.job, bg, own?.url, words, light]);
  const pickOwn = async (f?: File) => { if (!f) return; setUpl(true); try { const fr = await firstFrame(f); setOwn({ url: rel(await api.upload(fr, "background.jpg")), name: f.name, video: f.type.startsWith("video/") }); setBg(""); }
    catch { toast(t("rp.upload"), "warn"); } finally { setUpl(false); } };
  return (<div className="rp" data-testid="bg-panel">
    <p className="hint">{t("bgr.hint")}</p>
    {!picked && <p className="hint warnline">{t("rp.pick")}</p>}
    <div className="bggrid" role="listbox" aria-label={t("bgr.examples")}>{BACKDROPS.map((x) => <button key={x.id} type="button" role="option" className="ns-tile bgt" aria-selected={bg === x.id && !own} onClick={() => { setBg(x.id); setOwn(null); }} title={x.words} data-testid={"bg-" + x.id}>
      <span className="bgpic"><img src={x.svg} alt="" draggable={false} />{thumb && <img className="bgme" src={thumb} alt="" />}</span><span>{lang === "ar" ? x.ar : x.en}</span></button>)}
      <label className="ns-tile bgt bgown" data-testid="bg-own"><span className="bgpic"><Icon name="upload" size={20} /></span><span>{upl ? t("bgr.uploading") : own ? own.name.slice(0, 18) : t("bgr.own")}</span>
        <input type="file" accept="image/*,video/*" hidden onChange={(e) => void pickOwn(e.target.files?.[0])} /></label></div>
    {own?.video && <p className="hint">{t("bgr.videoNote")}</p>}
    <label className="ns-field"><span>{t("bgr.words")}</span><input className="ns-input" dir="auto" value={words} onChange={(e) => setWords(e.target.value)} placeholder={B ? B.words : t("bgr.wordsPh")} data-testid="bg-words" /></label>
    <Btn icon="sun" pressed={light} onClick={() => setLight(!light)} testid="bg-light">{t("bgr.light")}</Btn>
    {picked && (bg || own || words.trim()) && <div className="aicard" data-testid="bg-form">
      <Seg label={t("rs2.place")} value={placeAt} onChange={setPlaceAt} options={[{ v: "replace", label: t("rs2.replace") }, { v: "above", label: t("rs2.above") }]} />
      <p className="hint" data-testid="bg-price">{!src ? t("rp.uploadingClip") : run.why ? run.why : run.cost == null ? t("rs2.pricing") : run.cost === 0 ? t("ai.free") : t("ai.credits", { n: run.cost })}</p>
      {run.busy ? <div className="aibusy" role="status"><span>{run.busy.step}</span><i style={{ width: Math.round(run.busy.k * 100) + "%" }} /></div>
        : <Btn icon="sparkle" primary disabled={run.cost == null || !!run.why || (!me.free && me.credits != null && run.cost > me.credits)} onClick={() => void run.go(picked.asset.name + " · " + (own ? t("bgr.own") : B ? (lang === "ar" ? B.ar : B.en) : t("bgr.newBg")), placeAt)} testid="bg-go">{t("bgr.go")}{run.cost ? " · " + t("ai.credits", { n: run.cost }) : ""}</Btn>}
    </div>}
  </div>);
}
