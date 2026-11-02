// The rail and its panels: Media (the library), Audio, Text, Captions, Effects (+ transitions), Color, AI.
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Btn, Icon } from "@nooi/ui";
import { EFFECTS, FONTS, LOOKS, TEXT_TEMPLATES, TRANSITIONS, beats, uid } from "@nooi/editor-core";
import type { Asset } from "@nooi/editor-core";
import { editor, toast, ui, useProject, useUI, playerRef, autosave } from "../state";
import type { Rail } from "../state";
import { assetFromJob, decodeSound, fileOf, importFiles, monoOf, uploadAsset } from "../media/library";
import { api } from "../api";
import * as A from "../actions";
import { AIPanel } from "./AIPanel";
import { CaptionsPanel } from "./Captions";

export const RAILS: [Rail, string][] = [["media", "media"], ["audio", "audio"], ["text", "text"], ["captions", "captions"], ["effects", "effects"], ["color", "color"], ["ai", "ai"]];
export function RailBar({ mobile }: { mobile?: boolean }) {
  const { t } = useTranslation(); const rail = useUI((s) => s.rail); const open = useUI((s) => s.panelOpen);
  return (
    <nav className={mobile ? "mrail" : "rail"} aria-label={t("rail.label")}>
      {RAILS.map(([k, ic]) => (
        <button key={k} type="button" aria-pressed={rail === k && (!mobile || open)} onClick={() => ui.set({ rail: k, panelOpen: mobile ? !(rail === k && open) : true })} data-testid={"rail-" + k}>
          <Icon name={ic} size={20} /><span>{t("rail." + k)}</span>
        </button>
      ))}
    </nav>
  );
}
export function Panel() {
  const rail = useUI((s) => s.rail); const { t } = useTranslation();
  return (
    <section className="panel" aria-label={t("rail." + rail)}>
      <h2 className="ns-h2 phead">{t("rail." + rail)}</h2>
      <div className="pbody">
        {rail === "media" && <MediaPanel />}{rail === "audio" && <AudioPanel />}{rail === "text" && <TextPanel />}
        {rail === "captions" && <CaptionsPanel />}{rail === "effects" && <EffectsPanel />}{rail === "color" && <ColorPanel />}{rail === "ai" && <AIPanel />}
      </div>
    </section>
  );
}
function Sub({ rail, tabs }: { rail: Rail; tabs: string[] }) {
  const { t } = useTranslation(); const cur = useUI((s) => s.sub[rail]) || tabs[0];
  return <div className="subtabs" role="tablist">{tabs.map((x) => <button key={x} role="tab" type="button" aria-selected={cur === x} onClick={() => ui.set((s) => ({ sub: { ...s.sub, [rail]: x } }))}>{t("sub." + x)}</button>)}</div>;
}
export const dragAsset = (e: DragEvent, a: Asset) => { e.dataTransfer.setData("application/x-nooi-asset", a.id); e.dataTransfer.effectAllowed = "copy"; };

// ---------------- Media: upload, drop, folders, "made on nooi"
export function MediaPanel() {
  const { t } = useTranslation(); const p = useProject(); const folder = useUI((s) => s.folder); const sub = useUI((s) => s.sub.media) || "files";
  const [busy, setBusy] = useState(0); const [prog, setProg] = useState<Record<string, number>>({}); const [jobs, setJobs] = useState<Asset[] | null>(null); const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (sub === "nooi" && jobs == null) api.init().then(() => api.jobs()).then((js) => setJobs(js.filter((j) => j.status === "complete").map(assetFromJob).filter(Boolean) as Asset[])); }, [sub, jobs]);
  const add = async (files: FileList | File[]) => {
    setBusy((b) => b + 1);
    const r = await importFiles(files, folder, (a) => { A.addAssets([a]); });
    setBusy((b) => b - 1);
    if (r.skipped.length) toast(t("media.skipped", { names: r.skipped.slice(0, 3).join(", ") }), "warn");
    if (r.assets.length) toast(t("media.added", { n: r.assets.length }), "ok");
    for (const a of r.assets) if (a.kind !== "font") uploadAsset(a, (k) => setProg((s) => ({ ...s, [a.id]: k }))).then((url) => {
      setProg((s) => { const o = { ...s }; delete o[a.id]; return o; });
      if (url) { editor.run("uploaded", (d) => { if (d.assets[a.id]) d.assets[a.id] = { ...d.assets[a.id], src: url }; }); editor.past.pop(); autosave(); }
    });
  };
  const assets = Object.values(p.assets).filter((a) => (a.folder || null) === folder).sort((a, b) => b.createdAt - a.createdAt);
  const newFolder = () => { const name = prompt(t("media.folderName")) || ""; if (name.trim()) A.run("folder", (d) => { d.folders.push({ id: uid("f"), name: name.trim().slice(0, 40), parent: folder }); }); };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files); };
  return (
    <div className={"media" + (over ? " over" : "")} onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={drop}>
      <Sub rail="media" tabs={["files", "nooi"]} />
      {sub === "files" ? (<>
        <div className="addrow">
          <Btn icon="upload" primary onClick={() => fileRef.current?.click()} testid="upload">{t("media.upload")}</Btn>
          <Btn icon="folder" onClick={newFolder}>{t("media.newFolder")}</Btn>
          <input ref={fileRef} type="file" multiple hidden accept="video/*,image/*,audio/*,.cube,.ttf,.otf,.woff,.woff2" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} data-testid="file-input" />
        </div>
        <p className="hint">{t("media.hint")}</p>
        {busy > 0 && <p className="hint busy">{t("media.reading")}</p>}
        {folder && <button type="button" className="crumb" onClick={() => ui.set({ folder: p.folders.find((f) => f.id === folder)?.parent || null })}><Icon name="prev" size={14} />{p.folders.find((f) => f.id === folder)?.name}</button>}
        <div className="lib">
          {p.folders.filter((f) => (f.parent || null) === folder).map((f) => (
            <button key={f.id} type="button" className="libf" onClick={() => ui.set({ folder: f.id })}
              onDragOver={(e) => { if (e.dataTransfer.types.includes("application/x-nooi-asset")) e.preventDefault(); }}
              onDrop={(e) => { const id = e.dataTransfer.getData("application/x-nooi-asset"); if (id) { e.preventDefault(); e.stopPropagation(); A.run("move to folder", (d) => { if (d.assets[id]) d.assets[id].folder = f.id; }); } }}>
              <Icon name="folder" size={20} /><span>{f.name}</span><small>{Object.values(p.assets).filter((a) => a.folder === f.id).length}</small>
            </button>
          ))}
          {assets.map((a) => <AssetTile key={a.id} a={a} prog={prog[a.id]} />)}
        </div>
        {!assets.length && !p.folders.length && <div className="empty"><Icon name="upload" size={20} /><p>{t("media.empty")}</p></div>}
      </>) : (<>
        <p className="hint">{t("media.nooiHint")}</p>
        {jobs == null ? <p className="hint">{t("media.loading")}</p> : !jobs.length ? <p className="hint">{api.me.signedIn ? t("media.noJobs") : t("media.signIn")}</p> :
          <div className="lib">{jobs.map((a) => <AssetTile key={a.id} a={a} fromJob />)}</div>}
      </>)}
    </div>
  );
}
function AssetTile({ a, prog, fromJob }: { a: Asset; prog?: number; fromJob?: boolean }) {
  const { t } = useTranslation();
  const ic = a.kind === "audio" ? "audio" : a.kind === "lut" ? "color" : a.kind === "font" ? "text" : a.kind === "image" ? "image" : "film";
  const add = () => { if (fromJob && !editor.project.assets[a.id]) A.addAssets([a]); A.addAsset(editor.project.assets[a.id] || a); };
  return (
    <div className="libi" draggable onDragStart={(e) => { if (fromJob && !editor.project.assets[a.id]) A.addAssets([a]); dragAsset(e, a); }} data-testid="asset">
      <button type="button" className="libp" onClick={add} aria-label={t("media.addOne", { name: a.name })} title={t("media.addOne", { name: a.name })}>
        {a.thumb ? <img src={a.thumb} alt="" draggable={false} /> : a.waveform ? <Wave peaks={a.waveform} /> : <span className="libic"><Icon name={ic} size={20} /></span>}
        {a.duration ? <i dir="ltr">{fmt(a.duration)}</i> : null}
        <span className="plus" aria-hidden="true"><Icon name="plus" size={14} /></span>
        {prog != null && <span className="upl" style={{ width: Math.round(prog * 100) + "%" }} aria-label={t("media.uploading")} />}
      </button>
      <span className="libn" dir="auto">{a.name}</span>
      {!fromJob && <button type="button" className="libx" aria-label={t("media.remove", { name: a.name })} onClick={() => {
        const used = editor.project.tracks.some((tr) => tr.clips.some((c) => c.type === "media" && (c.asset === a.id || c.lut?.asset === a.id)));
        if (used && !confirm(t("media.removeUsed"))) return;
        A.run("remove asset", (d) => { for (const tr of d.tracks) tr.clips = tr.clips.filter((c) => !(c.type === "media" && c.asset === a.id)); delete d.assets[a.id]; }); playerRef.current?.prune();
      }}><Icon name="close" size={14} /></button>}
    </div>
  );
}
export function Wave({ peaks: pk, color = "var(--teal)" }: { peaks: number[]; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current; if (!c) return; const W = (c.width = c.clientWidth * devicePixelRatio || 160), H = (c.height = c.clientHeight * devicePixelRatio || 40); const x = c.getContext("2d")!; x.clearRect(0, 0, W, H); x.fillStyle = getComputedStyle(c).color || color; const n = pk.length;
    for (let i = 0; i < W; i++) { const v = pk[Math.floor((i / W) * n)] || 0; const h = Math.max(1, v * H * 0.9); x.fillRect(i, (H - h) / 2, 1, h); } }, [pk, color]);
  return <canvas ref={ref} className="wave" style={{ color }} aria-hidden="true" />;
}
export const fmt = (s: number) => { const m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ":" + String(x).padStart(2, "0"); };

// ---------------- Audio: the sounds you added, a voice-over, ducking, beats
function AudioPanel() {
  const { t } = useTranslation(); const p = useProject(); const [rec, setRec] = useState<MediaRecorder | null>(null);
  const sounds = Object.values(p.assets).filter((a) => a.kind === "audio");
  const record = async () => {
    if (rec) { rec.stop(); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); const mr = new MediaRecorder(s); const parts: Blob[] = []; const at = A.now();
      mr.ondataavailable = (e) => parts.push(e.data); mr.onstop = async () => { s.getTracks().forEach((x) => x.stop()); setRec(null); const f = new File(parts, t("audio.voiceName") + ".webm", { type: mr.mimeType || "audio/webm" });
        const r = await importFiles([f]); if (r.assets[0]) { A.addAssets(r.assets); A.addAsset(editor.project.assets[r.assets[0].id], at); } };
      mr.start(); setRec(mr); playerRef.current?.play();
    } catch { toast(t("audio.noMic"), "warn"); }
  };
  const findBeats = async () => {
    const c = A.sel1(); const a = c?.type === "media" ? p.assets[c.asset] : sounds[0]; if (!a) { toast(t("audio.pickMusic"), "info"); return; }
    const b = await fileOf(a); const ab = b && await decodeSound(b); if (!ab) { toast(t("audio.cantRead"), "warn"); return; }
    const raw = beats(monoOf(ab), ab.sampleRate); const off = c?.type === "media" ? c.start - c.in / c.speed : 0;
    A.run("beats", (d) => { d.beats = raw.map((x) => Math.round((off + x / (c?.type === "media" ? c.speed : 1)) * 1000) / 1000).filter((x) => x >= 0); });
    toast(t("audio.beats", { n: raw.length }), "ok");
  };
  return (<>
    <div className="addrow"><Btn icon={rec ? "pause" : "audio"} pressed={!!rec} onClick={record} testid="voiceover">{rec ? t("audio.stop") : t("audio.voiceover")}</Btn><Btn icon="beat" onClick={findBeats} testid="beats">{t("audio.findBeats")}</Btn></div>
    <span className="ns-lbl">{t("audio.ducking")}</span>
    <label className="row"><input type="checkbox" checked={p.ducking.enabled} onChange={(e) => A.run("ducking", (d) => { d.ducking.enabled = e.target.checked; if (!d.ducking.voiceTracks.length) { const v = d.tracks.filter((x) => x.kind === "audio")[1] || d.tracks.find((x) => x.kind === "audio"); if (v) d.ducking.voiceTracks = [v.id]; } })} /> {t("audio.duckOn")}</label>
    {p.ducking.enabled && <>
      <label className="ns-field"><span>{t("audio.duckAmount")}<b>{Math.round(p.ducking.amount * 100)}%</b></span><input className="ns-range" type="range" min={0.1} max={0.95} step={0.05} value={p.ducking.amount} onChange={(e) => A.run("ducking", (d) => { d.ducking.amount = +e.target.value; })} /></label>
      <span className="hint">{t("audio.voiceTracks")}</span>
      <div className="chips">{p.tracks.filter((x) => x.kind === "audio").map((tr) => <button type="button" key={tr.id} className="chip" aria-pressed={p.ducking.voiceTracks.includes(tr.id)} onClick={() => A.run("ducking", (d) => { const v = d.ducking.voiceTracks; d.ducking.voiceTracks = v.includes(tr.id) ? v.filter((x) => x !== tr.id) : [...v, tr.id]; })}>{tr.name}</button>)}</div>
    </>}
    <span className="ns-lbl">{t("audio.yours")}</span>
    {sounds.length ? <div className="lib">{sounds.map((a) => <AssetTile key={a.id} a={a} />)}</div> : <p className="hint">{t("audio.none")}</p>}
  </>);
}

// ---------------- Text: templates (each drawn in its own style), fonts
function TextPanel() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang);
  return (<>
    <Btn icon="plus" primary onClick={() => A.addText("title")} testid="add-text">{t("text.add")}</Btn>
    <span className="ns-lbl">{t("text.templates")}</span>
    <div className="ns-grid tpl">
      {TEXT_TEMPLATES.map((x) => { const s = x.style as Record<string, unknown>; const st: React.CSSProperties = { fontFamily: `"${s.font}",var(--f)`, fontWeight: Number(s.weight) || 700, color: (s.color as string) || "#fff", WebkitTextStroke: s.stroke ? "1px #000" : undefined, textShadow: s.shadow ? "0 0 8px " + (s.shadow as { color: string }).color : undefined, background: s.box ? (s.box as { color: string }).color : undefined };
        return <button key={x.id} type="button" className="ns-tile tplt" onClick={() => A.addText(x.id)} draggable onDragStart={(e) => { e.dataTransfer.setData("application/x-nooi-text", x.id); }} data-testid={"tpl-" + x.id}><b style={st}>{lang === "ar" ? "أبجد" : "Aa"}</b><span>{lang === "ar" ? x.ar : x.en}</span></button>; })}
    </div>
    <span className="ns-lbl">{t("text.fonts")}</span>
    <p className="hint">{t("text.fontsHint")}</p>
    <div className="fontlist">{FONTS.map((f) => <span key={f.name} style={{ fontFamily: `"${f.name}",var(--f)` }}>{f.ar ? "خط " : ""}{f.name}</span>)}</div>
  </>);
}

// ---------------- Effects (+ transitions): see one on the preview by pointing at it; tap to add
function EffectsPanel() {
  const { t } = useTranslation(); const sub = useUI((s) => s.sub.effects) || "effects"; const lang = useUI((s) => s.lang);
  const hover = (id: string | null) => ui.set({ preview: id });
  return (<>
    <Sub rail="effects" tabs={["effects", "transitions"]} />
    <p className="hint">{sub === "effects" ? t("fx.hint") : t("tr.hint")}</p>
    <div className="ns-grid fxg">
      {(sub === "effects" ? EFFECTS : TRANSITIONS).map((x) => (
        <button key={x.id} type="button" className="ns-tile" onPointerEnter={(e) => { if (e.pointerType !== "touch") hover((sub === "effects" ? "fx:" : "tr:") + x.id); }} onPointerLeave={() => hover(null)}
          onClick={() => { hover(null); sub === "effects" ? A.applyEffect(x.id) : A.applyTransition(x.id); }} draggable={sub === "transitions"}
          onDragStart={(e) => e.dataTransfer.setData("application/x-nooi-transition", x.id)} data-testid={(sub === "effects" ? "fx-" : "tr-") + x.id}>
          <span className={"fxsw " + (sub === "effects" ? "fx-" : "tr-") + x.id} aria-hidden="true" /><span>{lang === "ar" ? x.ar : x.en}</span>
        </button>
      ))}
    </div>
  </>);
}

// ---------------- Color: looks, LUTs (.cube)
function ColorPanel() {
  const { t } = useTranslation(); const p = useProject(); const lang = useUI((s) => s.lang); const ref = useRef<HTMLInputElement>(null);
  const luts = Object.values(p.assets).filter((a) => a.kind === "lut");
  return (<>
    <p className="hint">{t("color.hint")}</p>
    <div className="ns-grid">{LOOKS.map((l) => <button key={l.id} type="button" className="ns-tile" onClick={() => A.applyLook(l.id)} onPointerEnter={(e) => { if (e.pointerType !== "touch") ui.set({ preview: "look:" + l.id }); }} onPointerLeave={() => ui.set({ preview: null })} data-testid={"look-" + l.id}><span className={"fxsw look-" + l.id} aria-hidden="true" /><span>{lang === "ar" ? l.ar : l.en}</span></button>)}</div>
    <span className="ns-lbl">LUT (.cube)</span>
    <div className="addrow"><Btn icon="upload" onClick={() => ref.current?.click()}>{t("color.importLut")}</Btn><input ref={ref} type="file" accept=".cube" hidden onChange={async (e) => { if (e.target.files) { const r = await importFiles(e.target.files); A.addAssets(r.assets); if (r.assets[0]) A.applyLut(r.assets[0].id); } e.target.value = ""; }} /></div>
    {luts.map((l) => <button key={l.id} type="button" className="ns-btn wide" onClick={() => A.applyLut(l.id)}><Icon name="color" size={14} />{l.name}</button>)}
    <p className="hint">{t("color.more")}</p>
  </>);
}
export function noop() { /* keeps the rail list stable for tests */ }
