// v242: Extend with AI — the picked video clip goes on. The frame where the clip ends (its own end, so a trimmed clip goes on from
// where it was cut) starts a new shot that continues it: the same people, place, light and camera, no cut, the action simply goes
// on (and what happens next, if the customer says). The new shot lands right after the clip on the same track and the clips after
// it move along. The price shows first; credits are taken only when it works (the server's own rule) — if it fails the timeline
// stays as it was.
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Btn, Icon, Seg } from "@nooi/ui";
import * as C from "@nooi/editor-core";
import type { MediaClip } from "@nooi/editor-core";
import { api } from "../api";
import type { Job } from "../api";
import { editor, toast, useEditorVersion, useUI } from "../state";
import { assetFromJob, serverPath } from "../media/library";
import * as A from "../actions";
import { waitJob } from "./AIPanel";
import { frameOf } from "./Restyle";
import { at } from "../site";

const MODELS: [string, string][] = [["auto", "nooi Auto"], ["seedance", "Seedance 2.0 Fast"], ["seedance20", "Seedance 2.0"], ["hailuoh3", "MiniMax H3"], ["kling30", "Kling 3.0"], ["wan30", "WAN 3.0"]];
export const extendWords242 = (n: number, next: string) =>
  `Continue this exact shot for ${n} more seconds${next.trim() ? ": " + next.trim().replace(/[.\s]+$/, "") : ""}. It begins exactly on this frame — the same people (faces, hair, clothes), place, time of day, light, colours and camera style; no cut, no new scene, no text; the movement simply goes on naturally.`;
// where the clip ends in its own file (seconds)
export const clipEndAt = (c: MediaClip) => Math.max(0.05, (c.in || 0) + c.dur * (c.speed || 1) - 0.06);

export function ExtendPanel() {
  const { t } = useTranslation(); useEditorVersion(); const lang = useUI((s) => s.lang);
  const [me, setMe] = useState(api.me); const [len, setLen] = useState("5"); const [model, setModel] = useState("auto"); const [next, setNext] = useState("");
  const [cost, setCost] = useState<number | null>(null); const [why, setWhy] = useState(""); const [busy, setBusy] = useState<{ step: string; k: number } | null>(null);
  useEffect(() => { void api.init().then(() => setMe({ ...api.me })); return api.on(() => setMe({ ...api.me })); }, []);
  const c = A.sel1(); const clip = c?.type === "media" && editor.project.assets[c.asset]?.kind === "video" ? (c as MediaClip) : null; const asset = clip ? editor.project.assets[clip.asset] : null;
  const reg = (api.cfg.registry || {}) as Record<string, { name?: string }>;
  const models = MODELS.filter(([m]) => m === "auto" || !Object.keys(reg).length || reg[m]).map(([v, label]) => ({ v, label: reg[v]?.name || label }));
  const aspect = C.aspectOf(editor.project.width, editor.project.height), dur = +len;
  useEffect(() => { if (!api.online || !me.signedIn || !clip) { setCost(null); return; } let live = true; setCost(null); setWhy("");
    const tm = setTimeout(() => { api.quote({ kind: "video", model, dur, aspect, inputs: { vStart: "frame" } }).then((r) => live && setCost(r.cost)).catch((e: { message?: string; errorAr?: string }) => live && setWhy((lang === "ar" && e.errorAr) || e.message || "")); }, 250);
    return () => { live = false; clearTimeout(tm); }; }, [clip?.id, model, dur, me.signedIn]);
  if (!api.online) return <p className="hint">{t("ai.offline")}</p>;
  if (!me.signedIn) return <div className="empty"><Icon name="ai" size={20} /><p>{t("ai.signIn")}</p><a className="ns-btn primary" href={at("/?signin=1")}>{t("ai.signInBtn")}</a></div>;
  const go = async () => {
    if (!clip || !asset) return; const id = clip.id, endAt = clip.start + clip.dur;
    try {
      setBusy({ step: t("ex.frame"), k: 0.05 }); const fr = await frameOf(clip, clipEndAt(clip)); const up = await api.upload(fr, "extend-frame.jpg"); const vStart = serverPath(up) || up;
      setBusy({ step: t("ex.making"), k: 0.12 });
      const j = await api.startJob({ kind: "video", model, prompt: extendWords242(dur, next), dur, aspect, inputs: { vStart }, title: asset.name + " · " + t("ex.more"), meta: { extend242: 1 } });
      const r = await waitJob(j.id, (x: Job) => setBusy({ step: t("ex.making"), k: 0.12 + 0.85 * (x.progress || 0.1) })); if (r.status !== "done") throw new Error(r.error || t("ai.failed"));
      const a = assetFromJob({ ...(r as unknown as { id: string; kind: string; resultUrl?: string; dur?: number }), resultUrl: (r as unknown as { url?: string }).url || r.resultUrl, title: asset.name + " · " + t("ex.more") }); if (!a) throw new Error(t("ai.failed"));
      A.run("extend with AI", (p) => { p.assets[a.id] = a; const f = C.findClip(p, id); if (!f) return; const n = C.addAssetClip(p, a, endAt, f.track.id, "insert"); n.name = a.name; });
      setBusy(null); toast(t("ex.done"), "ok"); api.refresh();
    } catch (e) { setBusy(null); const er = e as { message?: string; errorAr?: string }; toast((lang === "ar" && er.errorAr) || er.message || t("ai.failed"), "warn"); }
  };
  return (<div className="rp" data-testid="extend-panel">
    <p className="hint">{t("ex.hint")}</p>
    {!clip ? <p className="hint warnline">{t("ex.pick")}</p> : <div className="aicard" data-testid="ex-form">
      <Seg label={t("ex.len")} value={len} onChange={setLen} options={["3", "5", "8", "10"].map((v) => ({ v, label: t("ex.secs", { n: v }) }))} />
      <label className="ns-field"><span>{t("ex.model")}</span><select className="ns-input" value={model} onChange={(e) => setModel(e.target.value)} data-testid="ex-model">{models.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select></label>
      <label className="ns-field"><span>{t("ex.next")}</span><textarea className="ns-input" rows={2} dir="auto" value={next} onChange={(e) => setNext(e.target.value)} placeholder={t("ex.nextPh")} data-testid="ex-next" /></label>
      <p className="hint" data-testid="ex-price">{why ? why : cost == null ? t("rs2.pricing") : cost === 0 ? t("ai.free") : t("ai.credits", { n: cost })}</p>
      {busy ? <div className="aibusy" role="status"><span>{busy.step}</span><i style={{ width: Math.round(busy.k * 100) + "%" }} /></div>
        : <Btn icon="sparkle" primary disabled={cost == null || !!why || (!me.free && me.credits != null && cost > me.credits)} onClick={() => void go()} testid="ex-go">{t("ex.go")}{cost ? " · " + t("ai.credits", { n: cost }) : ""}</Btn>}
    </div>}
  </div>);
}
