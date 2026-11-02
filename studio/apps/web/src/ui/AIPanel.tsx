// AI on the timeline, through the nooi.ai server (the keys stay there). Every action shows its price in credits first; credits are
// held when it starts, taken only when it succeeds and given back when it fails (the server's own rule).
//  · Extend: the clip goes on from its last frame (same people, place, light); the new part lands right after it
//  · Merge: the picked clips become one video, joined so the join can't be seen (free); it lands in the library
//  · Regenerate: the clip's shot made again from its words; it replaces the clip when it is ready
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Btn, Icon, Seg } from "@nooi/ui";
import { findClip, clipEnd, mediaClip, uid } from "@nooi/editor-core";
import type { Asset, MediaClip } from "@nooi/editor-core";
import { api } from "../api";
import type { Job } from "../api";
import { editor, toast, useEditorVersion, autosave, playerRef } from "../state";
import { uploadAsset } from "../media/library";
import * as A from "../actions";

const serverSrc = (a?: Asset) => (a && /^\/media\/[A-Za-z0-9._-]+$/.test(a.src) ? a.src : null);
async function ensureOnServer(a: Asset): Promise<{ job?: string; src?: string } | null> {
  if (a.job) return { job: a.job };
  const s = serverSrc(a); if (s) return { src: s };
  const url = await uploadAsset(a); if (!url) return null;
  editor.run("uploaded", (d) => { if (d.assets[a.id]) d.assets[a.id].src = url; }); editor.past.pop(); autosave();
  return { src: url };
}
export async function waitJob(id: string, onStep?: (j: Job) => void): Promise<Job> {
  for (let i = 0; i < 1200; i++) {
    const j = await api.job(id).catch(() => null);
    if (j) { onStep?.(j); if (j.status === "done" || j.status === "failed") return j; }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("timeout");
}
type Busy = Record<string, { label: string; k: number }>;
export function AIPanel() {
  const { t } = useTranslation(); useEditorVersion();
  const [me, setMe] = useState(api.me); const [busy, setBusy] = useState<Busy>({});
  const [extN, setExtN] = useState<"5" | "10" | "15">("5"); const [words, setWords] = useState(""); const [style, setStyle] = useState<"seamless" | "cut" | "soft">("seamless");
  const [cost, setCost] = useState<Record<string, number | null>>({});
  useEffect(() => { api.init().then(() => setMe({ ...api.me })); return api.on(() => setMe({ ...api.me })); }, []);
  const sel = A.selected().filter((c) => c.type === "media") as MediaClip[];
  const one = sel[0]; const asset = one ? editor.project.assets[one.asset] : undefined;
  const vids = sel.filter((c) => editor.project.assets[c.asset]?.kind === "video");
  // prices first
  useEffect(() => {
    if (!api.online || !one) return;
    const ask = (key: string, body: Record<string, unknown>) => api.quote(body).then((q) => setCost((s) => ({ ...s, [key]: q.cost }))).catch(() => setCost((s) => ({ ...s, [key]: null })));
    ask("extend", { kind: "video", model: "auto", dur: +extN, meta: { extend132: asset?.job || "file" } });
    if (asset?.job) ask("regen", { kind: "video", model: "auto", dur: Math.round(asset.duration || one.dur || 5) });
  }, [one?.id, extN, asset?.job]);
  const track = (key: string, label: string, k: number) => setBusy((b) => ({ ...b, [key]: { label, k } }));
  const done = (key: string) => setBusy((b) => { const o = { ...b }; delete o[key]; return o; });
  const fail = (key: string, e: unknown) => { done(key); const err = e as { message?: string; errorAr?: string; status?: number }; toast((document.documentElement.lang === "ar" && err.errorAr) || err.message || t("ai.failed"), "warn"); };
  const resultAsset = (j: Job, name: string): Asset => ({ id: "j_" + j.id, kind: "video", name, src: (j as unknown as { url: string }).url, job: j.id, createdAt: Date.now(), duration: j.dur, hasAudio: true });

  const extend = async () => {
    if (!one || !asset) return; const key = "ext:" + one.id; track(key, t("ai.extending"), 0.02);
    try {
      const where = await ensureOnServer(asset); if (!where) throw new Error(t("ai.needUpload"));
      const j = await api.startJob({ kind: "video", prompt: words.trim(), title: "Extended: " + asset.name, model: "auto", dur: +extN, meta: where.job ? { extend132: where.job } : {}, ...(where.src ? { source: where.src, meta: { extend132: where.src } } : {}) });
      const r = await waitJob(j.id, (x) => track(key, t("ai.extending"), x.progress || 0.1));
      if (r.status !== "done") throw new Error(r.error || t("ai.failed"));
      const a = resultAsset(r, asset.name + " +" + extN + "s");
      A.run("extend", (p) => { p.assets[a.id] = a; const f = findClip(p, one.id); if (!f) return; const c = mediaClip(a, clipEnd(f.clip), { dur: +extN }); for (const x of f.track.clips) if (x.start >= clipEnd(f.clip) - 1e-4) x.start += c.dur; f.track.clips.push(c); f.track.clips.sort((x, y) => x.start - y.start); });
      done(key); toast(t("ai.extended"), "ok"); api.refresh();
    } catch (e) { fail(key, e); }
  };
  const merge = async () => {
    if (vids.length < 2) return; const key = "merge"; track(key, t("ai.merging"), 0.02);
    try {
      const items = [] as Record<string, unknown>[];
      for (const c of [...vids].sort((a, b) => a.start - b.start)) { const a = editor.project.assets[c.asset]; const w = await ensureOnServer(a); if (!w) throw new Error(t("ai.needUpload")); items.push({ ...(w.job ? { job: w.job } : { src: w.src }), in: +c.in.toFixed(3), out: +(c.in + c.dur * c.speed).toFixed(3) }); }
      const j = await api.startJob({ kind: "video", prompt: "", title: "Merged", model: "auto", dur: vids.reduce((s, c) => s + c.dur, 0), meta: { merge135: { items, style }, edCmd: "merge135", noPhysics: true } });
      const r = await waitJob(j.id, (x) => track(key, t("ai.merging"), x.progress || 0.1)); if (r.status !== "done") throw new Error(r.error || t("ai.failed"));
      A.addAssets([resultAsset(r, t("ai.mergedName", { n: vids.length }))]); done(key); toast(t("ai.merged"), "ok");
    } catch (e) { fail(key, e); }
  };
  const regen = async () => {
    if (!one || !asset?.job) return; const key = "regen:" + one.id; track(key, t("ai.regenerating"), 0.02);
    try {
      const old = await api.job(asset.job); const pl = old as unknown as { prompt?: string; model?: string; aspect?: string; dur?: number; title?: string };
      const j = await api.startJob({ kind: "video", prompt: pl.prompt || asset.name, title: (pl.title || asset.name) + " · new take", model: pl.model || "auto", dur: Math.round(pl.dur || asset.duration || 5), aspect: pl.aspect });
      const r = await waitJob(j.id, (x) => track(key, t("ai.regenerating"), x.progress || 0.1)); if (r.status !== "done") throw new Error(r.error || t("ai.failed"));
      const a = resultAsset(r, asset.name + " (" + t("ai.take") + ")");
      A.run("regenerate", (p) => { p.assets[a.id] = a; const f = findClip(p, one.id); if (f && f.clip.type === "media") { f.clip.asset = a.id; f.clip.in = Math.min(f.clip.in, Math.max(0, (a.duration || 5) - f.clip.dur * f.clip.speed)); } });
      playerRef.current?.forgetClip(one.id); done(key); toast(t("ai.regenerated"), "ok"); api.refresh();
    } catch (e) { fail(key, e); }
  };
  if (!api.online) return <p className="hint">{t("ai.offline")}</p>;
  if (!me.signedIn) return <div className="empty"><Icon name="ai" size={20} /><p>{t("ai.signIn")}</p><a className="ns-btn primary" href="/?signin=1">{t("ai.signInBtn")}</a></div>;
  const price = (k: string) => (cost[k] == null ? "…" : cost[k] === 0 ? t("ai.free") : t("ai.credits", { n: cost[k] }));
  return (<>
    <p className="hint">{t("ai.hint")} {me.credits != null && <b>{t("ai.balance", { n: me.credits })}</b>}</p>
    {Object.entries(busy).map(([k, b]) => <div key={k} className="aibusy" role="status"><span>{b.label}</span><i style={{ width: Math.round(Math.max(0.03, b.k) * 100) + "%" }} /></div>)}
    <div className="aicard">
      <h3 className="ns-h3"><Icon name="next" size={16} />{t("ai.extend")}</h3><p className="hint">{t("ai.extendHint")}</p>
      <Seg label={t("ai.extend")} value={extN} onChange={setExtN} options={(["5", "10", "15"] as const).map((v) => ({ v, label: "+" + v + "s" }))} />
      <textarea className="ns-input" rows={2} dir="auto" value={words} onChange={(e) => setWords(e.target.value)} placeholder={t("ai.nextPlaceholder")} aria-label={t("ai.next")} />
      <Btn icon="sparkle" primary disabled={!one || asset?.kind !== "video" || !!busy["ext:" + one?.id]} onClick={extend} testid="ai-extend">{t("ai.extend")} · {price("extend")}</Btn>
      {!one && <p className="hint">{t("ai.pickVideo")}</p>}
    </div>
    <div className="aicard">
      <h3 className="ns-h3"><Icon name="transitions" size={16} />{t("ai.merge")}</h3><p className="hint">{t("ai.mergeHint")}</p>
      <Seg label={t("ai.merge")} value={style} onChange={setStyle} options={[{ v: "seamless", label: t("ai.seamless") }, { v: "cut", label: t("ai.cut") }, { v: "soft", label: t("ai.soft") }]} />
      <Btn icon="sparkle" primary disabled={vids.length < 2 || !!busy.merge} onClick={merge} testid="ai-merge">{t("ai.merge")} · {t("ai.free")}</Btn>
      {vids.length < 2 && <p className="hint">{t("ai.pickTwo")}</p>}
    </div>
    <div className="aicard">
      <h3 className="ns-h3"><Icon name="reverse" size={16} />{t("ai.regen")}</h3><p className="hint">{t("ai.regenHint")}</p>
      <Btn icon="sparkle" primary disabled={!asset?.job || !!busy["regen:" + one?.id]} onClick={regen} testid="ai-regen">{t("ai.regen")} · {asset?.job ? price("regen") : "—"}</Btn>
      {one && !asset?.job && <p className="hint">{t("ai.regenOnlyNooi")}</p>}
    </div>
    <span className="ns-lbl">{t("ai.next2")}</span>
    <ul className="soon">{["captions", "t2v", "prompt", "bg", "smartcut", "reframe", "voice", "music", "match"].map((k) => <li key={k}><Icon name="sparkle" size={14} />{t("ai.soon." + k)}</li>)}</ul>
  </>);
}
export const _uid = uid;
