// Restyle with AI: the picked video clip made again in a style (80s synthwave, anime, 3D animation, cyberpunk…), with the video
// model the client chooses (MiniMax H3, Kling, WAN 3.0, Seedance 2.5 or nooi Auto). How: the clip's first frame is redrawn in the
// style by the picture AI, then the chosen video AI brings that frame to life with the scene's words. The price of both steps shows
// first; each step's credits are taken only when it succeeds (the server's own rule) — if the video step fails, only the picture
// made is charged, and the clip stays as it was.
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { Btn, Icon, Seg } from "@nooi/ui";
import * as C from "@nooi/editor-core";
import type { MediaClip } from "@nooi/editor-core";
import { api } from "../api";
import type { Job } from "../api";
import { editor, toast, useEditorVersion, useUI } from "../state";
import { assetFromJob, urlOf } from "../media/library";
import { STYLES, RESTYLE_MODELS, styleExample } from "../media/styles";
import type { Style } from "../media/styles";
import * as A from "../actions";
import { waitJob } from "./AIPanel";
import { at } from "../site";

const FALLBACK: Record<string, string> = { auto: "nooi Auto", hailuoh3: "MiniMax H3", kling30: "Kling 3.0", kling40: "Kling 4.0", wan30: "WAN 3.0", seedance25: "Seedance 2.5" };
const examples = new Map<string, string>(); const exampleOf = (s: Style) => { let u = examples.get(s.id); if (!u) { u = styleExample(s); examples.set(s.id, u); } return u; };
export const restyleWords = (s: Style, words: string) => ({
  picture: `Redraw this exact picture as ${s.words}. Keep exactly the same people (faces, hair, clothes), poses, place, objects, composition and camera angle — change only the visual style. No text or logos.`,
  video: `${(words.trim() || "The same scene, moving naturally as it does in the original").replace(/[.\s]+$/, "")}. Visual style: ${s.words}. Keep the look of the first frame from start to end; no cuts.`,
});

// the clip's first frame as a JPEG (at most 1280 px)
async function frameOf(c: MediaClip): Promise<Blob> {
  const a = editor.project.assets[c.asset]; const u = a && await urlOf(a, false); if (!u) throw new Error("no video");
  const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; if (!u.startsWith("blob:")) v.crossOrigin = "anonymous";
  await new Promise<void>((ok, bad) => { v.onloadeddata = () => ok(); v.onerror = () => bad(new Error("The clip's video couldn't be read (" + (v.error?.code || 0) + ")")); setTimeout(() => bad(new Error("timeout")), 20000); v.src = u; });
  await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = Math.min(Math.max(0, (v.duration || 1) - 0.05), c.in + 0.05); setTimeout(ok, 4000); });
  const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight)); const cv = Object.assign(document.createElement("canvas"), { width: Math.round(v.videoWidth * k), height: Math.round(v.videoHeight * k) });
  cv.getContext("2d")!.drawImage(v, 0, 0, cv.width, cv.height); v.removeAttribute("src"); v.load();
  return await new Promise<Blob>((ok, bad) => cv.toBlob((b) => (b ? ok(b) : bad(new Error("frame"))), "image/jpeg", 0.9));
}

export function RestylePanel() {
  const { t } = useTranslation(); useEditorVersion(); const lang = useUI((s) => s.lang);
  const [me, setMe] = useState(api.me); const [sty, setSty] = useState<Style | null>(null); const [model, setModel] = useState("auto"); const [words, setWords] = useState("");
  const [place, setPlace] = useState<"replace" | "above">("replace"); const [q, setQ] = useState(""); const [cost, setCost] = useState<{ pic: number | null; vid: number | null } | null>(null);
  const [busy, setBusy] = useState<{ step: string; k: number } | null>(null);
  useEffect(() => { api.init().then(() => setMe({ ...api.me })); return api.on(() => setMe({ ...api.me })); }, []);
  const c = A.sel1(); const clip = c?.type === "media" && editor.project.assets[c.asset]?.kind === "video" ? (c as MediaClip) : null; const asset = clip ? editor.project.assets[clip.asset] : null;
  const reg = (api.cfg.registry || {}) as Record<string, { name?: string }>;
  const models = RESTYLE_MODELS.filter((m) => !Object.keys(reg).length || reg[m]).map((m) => ({ v: m, label: reg[m]?.name || FALLBACK[m] }));
  const dur = clip ? Math.min(10, Math.max(5, Math.round(clip.dur))) : 5; const aspect = C.aspectOf(editor.project.width, editor.project.height);
  // the scene's words: a nooi result knows them already
  useEffect(() => { setWords(""); if (asset?.job) api.job(asset.job).then((j) => { const pr = (j as unknown as { prompt?: string; title?: string }).prompt || ""; if (pr) setWords(pr.slice(0, 400)); }).catch(() => undefined); }, [asset?.id]);
  // prices first: the picture in the style + the video with the chosen model
  useEffect(() => {
    if (!api.online || !me.signedIn || !clip) { setCost(null); return; } let live = true; setCost(null);
    const tm = setTimeout(() => {
      Promise.all([api.quote({ kind: "image", model: "nano", aspect }).then((r) => r.cost).catch(() => null), api.quote({ kind: "video", model, dur, aspect, inputs: { vStart: "frame" } }).then((r) => r.cost).catch(() => null)])
        .then(([pic, vid]) => { if (live) setCost({ pic, vid }); });
    }, 250);
    return () => { live = false; clearTimeout(tm); };
  }, [clip?.id, model, dur, me.signedIn]);
  const list = useMemo(() => { const s = q.trim().toLowerCase(); return s ? STYLES.filter((x) => (x.en + " " + x.ar + " " + x.words).toLowerCase().includes(s)) : STYLES; }, [q]);
  const go = async () => {
    if (!clip || !asset || !sty) return; const name = lang === "ar" ? sty.ar : sty.en; const W = restyleWords(sty, words);
    try {
      setBusy({ step: t("rs2.frame"), k: 0.03 });
      const fu = await api.upload(await frameOf(clip), "restyle-frame.jpg");
      setBusy({ step: t("rs2.picture", { name }), k: 0.1 });
      const ij = await api.startJob({ kind: "image", model: "nano", prompt: W.picture, aspect, inputs: { iRef: fu }, title: "Restyle · " + sty.en });
      const ir = await waitJob(ij.id, (x: Job) => setBusy({ step: t("rs2.picture", { name }), k: 0.1 + 0.25 * (x.progress || 0.2) }));
      const img = (ir as unknown as { resultUrl?: string; url?: string }).resultUrl || (ir as unknown as { url?: string }).url;
      if (ir.status !== "done" || !img) throw new Error(ir.error || t("ai.failed"));
      setBusy({ step: t("rs2.video", { model: models.find((m) => m.v === model)?.label || model }), k: 0.4 });
      const vj = await api.startJob({ kind: "video", model, prompt: W.video, dur, aspect, inputs: { vStart: img }, title: name + " · " + asset.name });
      const vr = await waitJob(vj.id, (x: Job) => setBusy({ step: t("rs2.video", { model: models.find((m) => m.v === model)?.label || model }), k: 0.4 + 0.58 * (x.progress || 0.1) }));
      if (vr.status !== "done") throw new Error(vr.error || t("ai.failed"));
      const a = assetFromJob({ ...(vr as unknown as { id: string; kind: string; resultUrl?: string; dur?: number }), title: name + " · " + asset.name }); if (!a) throw new Error(t("ai.failed"));
      A.run("restyle", (p) => {
        p.assets[a.id] = a; const f = C.findClip(p, clip.id); if (!f || f.clip.type !== "media") return;
        if (place === "replace") { f.clip.asset = a.id; f.clip.in = 0; f.clip.speed = 1; f.clip.reverse = false; f.clip.freeze = null; f.clip.name = a.name; f.clip.dur = Math.min(f.clip.dur, a.duration || f.clip.dur); }
        else { const tr = C.addTrack(p, "video", p.tracks.indexOf(f.track)); const n = C.addAssetClip(p, a, f.clip.start, tr.id); n.dur = Math.min(n.dur, f.clip.dur); }
      });
      setBusy(null); toast(t("rs2.done", { name }), "ok"); api.refresh();
    } catch (e) { setBusy(null); const er = e as { message?: string; errorAr?: string }; toast((lang === "ar" && er.errorAr) || er.message || t("ai.failed"), "warn"); }
  };
  if (!api.online) return <p className="hint">{t("ai.offline")}</p>;
  if (!me.signedIn) return <div className="empty"><Icon name="ai" size={20} /><p>{t("ai.signIn")}</p><a className="ns-btn primary" href={at("/?signin=1")}>{t("ai.signInBtn")}</a></div>;
  const total = cost && cost.pic != null && cost.vid != null ? cost.pic + cost.vid : null;
  return (<>
    <p className="hint">{t("rs2.hint")}</p>
    {!clip && <p className="hint warnline" data-testid="rs-pick">{t("rs2.pick")}</p>}
    <input className="ns-input" type="search" dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("rs2.search", { n: STYLES.length })} aria-label={t("rs2.search", { n: STYLES.length })} />
    <div className="stylg" role="listbox" aria-label={t("rs2.styles")}>{list.map((s) => (
      <button key={s.id} type="button" role="option" aria-selected={sty?.id === s.id} className="styt" onClick={() => setSty(s)} title={s.words} data-testid={"sty-" + s.id}>
        <img src={exampleOf(s)} alt="" loading="lazy" draggable={false} /><span>{lang === "ar" ? s.ar : s.en}</span></button>))}</div>
    {sty && <div className="aicard" data-testid="rs-form">
      <h3 className="ns-h3"><span className="aibadge" aria-hidden="true"><Icon name="sparkle" size={14} /></span>{lang === "ar" ? sty.ar : sty.en}</h3>
      <span className="ns-lbl">{t("rs2.model")}</span>
      <div className="chips">{models.map((m) => <button key={m.v} type="button" className="chip" aria-pressed={model === m.v} onClick={() => setModel(m.v)} data-testid={"rsm-" + m.v}>{m.label}</button>)}</div>
      <label className="ns-field"><span>{t("rs2.words")}</span><textarea className="ns-input" rows={2} dir="auto" value={words} onChange={(e) => setWords(e.target.value)} placeholder={t("rs2.wordsPh")} /></label>
      <Seg label={t("rs2.place")} value={place} onChange={setPlace} options={[{ v: "replace", label: t("rs2.replace") }, { v: "above", label: t("rs2.above") }]} />
      <p className="hint" data-testid="rs-price">{cost == null ? t("rs2.pricing") : total == null ? t("rs2.noPrice") : t("rs2.price", { pic: cost.pic, vid: cost.vid, total, s: dur })}</p>
      {busy ? <div className="aibusy" role="status"><span>{busy.step}</span><i style={{ width: Math.round(busy.k * 100) + "%" }} /></div>
        : <Btn icon="sparkle" primary disabled={!clip || total == null || (me.credits != null && total > me.credits)} onClick={() => void go()} testid="rs-go">{t("rs2.go")}{total != null ? " · " + t("ai.credits", { n: total }) : ""}</Btn>}
      {me.credits != null && total != null && total > me.credits && <p className="err">{t("rs2.short")}</p>}
    </div>}
  </>);
}
