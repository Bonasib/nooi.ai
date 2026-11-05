import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Icon, Seg } from "@nooi/ui";
import { PRESETS, duration, frameSize, aspectOf, emptyProject, COMMANDS } from "@nooi/editor-core";
import type { ExportSettings } from "@nooi/editor-core";
import { editor, toast, toasts, ui, useProject, useUI, openProject, cloudId, autosave, playerRef } from "../state";
import { exportProject } from "../engine/export";
import { exportOnServer } from "../engine/server";
import { api } from "../api";
import { getJSON } from "../media/idb";
import * as A from "../actions";
import { NATIVE, TAURI, at } from "../site";
import { exportDesktop, saveFile } from "../engine/native";

export function Modal({ title, onClose, children, wide, cls }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; cls?: string }) {
  const ref = useRef<HTMLDivElement>(null); const close = useRef(onClose); close.current = onClose;
  // focus moves in once, when the dialog opens (a field first) — never again while you type
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); }; window.addEventListener("keydown", k); const r = ref.current; (r?.querySelector<HTMLElement>("input,select,textarea") || r?.querySelector<HTMLElement>(".mhead ~ * button, button"))?.focus(); return () => window.removeEventListener("keydown", k); }, []);
  return <div className="modal" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className={"sheet" + (wide ? " wide" : "") + (cls ? " " + cls : "")} role="dialog" aria-modal="true" aria-label={title} ref={ref}><div className="mhead"><h2 className="ns-h2">{title}</h2><Btn icon="close" ghost label="×" onClick={onClose} /></div>{children}</div></div>;
}

// ---------------- Export
export function ExportDialog() {
  const { t } = useTranslation(); const p = useProject(); const lang = useUI((s) => s.lang);
  const [o, setO] = useState<ExportSettings>({ ...p.export }); const [prog, setProg] = useState<{ k: number; note: string } | null>(null);
  const [res, setRes] = useState<{ url: string; name: string; blob: Blob; size: number } | null>(null); const [err, setErr] = useState(""); const ab = useRef<AbortController | null>(null);
  const close = () => { ab.current?.abort(); ui.set({ exportOpen: false }); };
  // where it is made: this device (no upload) or the nooi server (FFmpeg on the VPS — for long or 4K videos and weak devices)
  const [srvOn, setSrvOn] = useState(false); const [where, setWhere] = useState<"device" | "server" | "ffmpeg">(TAURI ? "ffmpeg" : "device"); const [srv, setSrv] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => { let live = true; void api.renderOn().then((x) => live && setSrvOn(x && api.me.signedIn)); return () => { live = false; }; }, []);
  // (v227) nooi Motion graphics are drawn frame by frame, so a project with them is made here, on this device
  const moving = p.tracks.some((tr) => !tr.hidden && tr.clips.some((c) => c.type === "text" && !!c.motion)); const placeOf = moving ? "device" : where;
  const preset = PRESETS.find((x) => x.id === o.preset); const { w, h } = frameSize(aspectOf(p.width, p.height), o.res); const d = duration(p);
  const est = Math.round(((preset?.bitrate || 8e6) * (o.quality === "low" ? 0.4 : o.quality === "medium" ? 0.7 : 1) * (o.res === "4k" ? 3 : o.res === "720p" ? 0.5 : 1) * d) / 8 / 1e6);
  const pick = (id: string) => { const x = PRESETS.find((y) => y.id === id)!; const fs = frameSize(x.aspect, "1080p");
    if (aspectOf(p.width, p.height) !== x.aspect) { A.run("format", (q) => { q.width = fs.w; q.height = fs.h; }); playerRef.current?.resize(); }
    setO({ ...o, preset: id, res: x.res, fps: x.fps, format: x.format }); };
  const go = async () => {
    if (!d) { setErr(t("exp.empty")); return; }
    setErr(""); setRes(null); setSrv(null); setProg({ k: 0, note: placeOf === "server" ? "upload" : "media" }); playerRef.current?.pause(); ab.current = new AbortController();
    A.run("export settings", (q) => { q.export = { ...o }; });
    if (placeOf === "server") {
      try {
        const r = await exportOnServer(editor.project, { ...o, signal: ab.current.signal, onProgress: (k, note) => setProg({ k, note }) });
        setProg(null);
        if (r.status === "done" && r.url) setSrv({ url: r.url, name: (p.name || "nooi").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) + "." + o.format });
        else if (r.status !== "cancelled") setErr(r.error || t("exp.srvFail"));
      } catch (e) {
        setProg(null); const x = e as Error & { code?: string; status?: number };
        if (x.name !== "AbortError") setErr(x.status === 429 ? t("exp.srvBusy") : x.code === "missing" ? t("exp.srvMissing", { name: x.message }) : String(x.message || e));
      }
      return;
    }
    try {
      const r = placeOf === "ffmpeg" ? await exportDesktop(editor.project, { ...o, signal: ab.current.signal, onProgress: (k, note) => setProg({ k, note }) })
        : await exportProject(editor.project, { ...o, signal: ab.current.signal, onProgress: (k, note) => setProg({ k, note }) });
      setRes({ url: URL.createObjectURL(r.blob), name: r.name, blob: r.blob, size: r.blob.size }); setProg(null);
      if (preset?.maxSec && d > preset.maxSec) toast(t("exp.tooLong", { name: preset.name, s: preset.maxSec }), "warn");
    } catch (e) { setProg(null); if ((e as Error).name !== "AbortError") setErr((e as { code?: string }).code === "NO_ENCODER" ? t("exp.noEncoder") : String((e as Error).message || e)); }
  };
  const save = async () => { if (!res) return; try { const url = await api.upload(res.blob, res.name); toast(t("exp.saved"), "ok"); void url; } catch { toast(t("exp.saveFail"), "warn"); } };
  return (
    <Modal title={t("exp.title")} onClose={close} wide>
      <div className="expgrid">
        <div>
          <span className="ns-lbl">{t("exp.for")}</span>
          <div className="ns-grid">{PRESETS.map((x) => <button key={x.id} type="button" className="ns-tile" aria-pressed={o.preset === x.id} onClick={() => pick(x.id)} data-testid={"preset-" + x.id}><i className="ratio" style={{ aspectRatio: x.aspect.replace(":", "/") }} /><span>{lang === "ar" ? x.nameAr : x.name}</span><small dir="ltr">{x.aspect} · {x.res}</small></button>)}</div>
        </div>
        <div>
          <span className="ns-lbl">{t("exp.format")}</span>
          <Seg label={t("exp.format")} value={o.format} onChange={(v) => setO({ ...o, format: v })} options={(["mp4", "webm", "mov", "gif", "mp3", "wav"] as const).map((v) => ({ v, label: v.toUpperCase() }))} />
          {!["mp3", "wav"].includes(o.format) && <><span className="ns-lbl">{t("exp.res")}</span><Seg label={t("exp.res")} value={o.res} onChange={(v) => setO({ ...o, res: v })} options={[{ v: "720p", label: "720p" }, { v: "1080p", label: "1080p" }, { v: "4k", label: "4K" }]} />
            <span className="ns-lbl">{t("exp.fps")}</span><Seg label={t("exp.fps")} value={String(o.fps)} onChange={(v) => setO({ ...o, fps: +v })} options={["24", "25", "30", "60"].map((v) => ({ v, label: v }))} />
            <span className="ns-lbl">{t("exp.quality")}</span><Seg label={t("exp.quality")} value={o.quality} onChange={(v) => setO({ ...o, quality: v })} options={[{ v: "high", label: t("exp.high") }, { v: "medium", label: t("exp.medium") }, { v: "low", label: t("exp.low") }]} /></>}
          <p className="hint" dir="ltr">{!["mp3", "wav"].includes(o.format) ? `${w}×${h} · ` : ""}{d.toFixed(1)}s · ~{Math.max(1, est)} MB</p>
          {(srvOn || TAURI) && <><span className="ns-lbl">{t("exp.where")}</span><Seg label={t("exp.where")} value={placeOf} onChange={(v) => setWhere(v)} options={[...(TAURI ? [{ v: "ffmpeg" as const, label: t("exp.computer") }] : []), { v: "device" as const, label: TAURI ? t("exp.browser") : t("exp.device") }, ...(srvOn ? [{ v: "server" as const, label: t("exp.server") }] : [])]} /></>}
          <p className="hint">{placeOf === "server" ? t("exp.serverHint") : placeOf === "ffmpeg" ? t("exp.ffmpegHint") : t("exp.local")}</p>
          {moving && (srvOn || TAURI) && <p className="hint motionnote" data-testid="exp-motion">{t("exp.motionHere")}</p>}
          {prog && <div className="aibusy" role="status"><span>{t("exp.step." + prog.note)} · {Math.round(prog.k * 100)}%</span><i style={{ width: Math.round(prog.k * 100) + "%" }} /></div>}
          {err && <p className="err" role="alert">{err}</p>}
          {res && <div className="expdone"><Icon name="check" size={20} /><span>{res.name} · {(res.size / 1e6).toFixed(1)} MB</span>
            {NATIVE ? <Btn icon="export" primary onClick={() => void saveFile(res.blob, res.name)} testid="download">{t("exp.save")}</Btn> : <a className="ns-btn primary" href={res.url} download={res.name} data-testid="download">{t("exp.download")}</a>}
            {api.me.signedIn && <Btn icon="cloud" onClick={save}>{t("exp.toAccount")}</Btn>}</div>}
          {srv && <div className="expdone"><Icon name="check" size={20} /><span>{srv.name} · {t("exp.kept")}</span>
            {NATIVE ? <Btn icon="export" primary onClick={() => void fetch(at(srv.url)).then((r) => r.blob()).then((b) => saveFile(b, srv.name))} testid="download">{t("exp.save")}</Btn> : <a className="ns-btn primary" href={at(srv.url) + "?download=1"} download={srv.name} data-testid="download">{t("exp.download")}</a>}</div>}
          <div className="row end">{prog ? <Btn icon="close" onClick={() => ab.current?.abort()}>{t("exp.cancel")}</Btn> : <Btn icon="export" primary onClick={go} testid="export-go">{t("exp.go")}</Btn>}</div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- ⌘K: every command and panel by name
export function Palette() {
  const { t } = useTranslation(); const [q, setQ] = useState(""); const [i, setI] = useState(0);
  const items = useMemo(() => {
    const list: { title: string; run: () => void; kbd?: string }[] = [
      { title: t("act.split"), run: A.split, kbd: "S" }, { title: t("act.delete"), run: () => A.del(false), kbd: "Del" }, { title: t("act.rippleDelete"), run: () => A.del(true), kbd: "Shift+Del" },
      { title: t("act.duplicate"), run: A.duplicate, kbd: "Ctrl+D" }, { title: t("act.undo"), run: A.undo, kbd: "Ctrl+Z" }, { title: t("act.redo"), run: A.redo, kbd: "Ctrl+Shift+Z" },
      { title: t("act.marker"), run: A.marker, kbd: "M" }, { title: t("preview.play"), run: () => playerRef.current?.toggle(), kbd: "Space" }, { title: t("top.export"), run: () => ui.set({ exportOpen: true }), kbd: "Ctrl+E" },
      { title: t("insp.freeze"), run: A.freeze }, { title: t("insp.detach"), run: A.detach }, { title: t("insp.reverse"), run: A.reverse }, { title: t("text.add"), run: () => A.addText("title"), kbd: "T" },
      { title: t("tl.snap"), run: () => ui.set({ snap: !ui.get().snap }), kbd: "N" }, { title: t("top.projects"), run: () => ui.set({ projectsOpen: true }) },
      ...(["select", "ripple", "roll", "slip", "slide"] as const).map((x) => ({ title: t("tool.label") + ": " + t("tool." + x), run: () => ui.set({ tool: x }) })),
      ...(["media", "stock", "audio", "titles", "transitions", "effects", "stickers", "templates"] as const).map((x) => ({ title: t("palette.panel") + ": " + t("rail." + x), run: () => ui.set({ rail: x, panelOpen: true }) })),
      ...Object.entries(COMMANDS).slice(0, 0).map(([k]) => ({ title: k, run: () => undefined })),
    ];
    const s = q.trim().toLowerCase(); return s ? list.filter((x) => x.title.toLowerCase().includes(s)) : list;
  }, [q, t]);
  const go = (k: number) => { const x = items[k]; if (!x) return; ui.set({ paletteOpen: false }); setTimeout(x.run, 0); };
  return (
    <Modal title={t("palette.open")} onClose={() => ui.set({ paletteOpen: false })}>
      <input className="ns-input" autoFocus value={q} placeholder={t("palette.search")} onChange={(e) => { setQ(e.target.value); setI(0); }} data-testid="palette-q"
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setI(Math.min(items.length - 1, i + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setI(Math.max(0, i - 1)); } if (e.key === "Enter") go(i); }} aria-label={t("palette.search")} />
      <ul className="pal" role="listbox">{items.map((x, k) => <li key={x.title} role="option" aria-selected={k === i}><button type="button" onClick={() => go(k)}>{x.title}{x.kbd && <kbd>{x.kbd}</kbd>}</button></li>)}</ul>
    </Modal>
  );
}

// ---------------- Projects: this device and the account
export function Projects() {
  const { t } = useTranslation(); const [local, setLocal] = useState<{ id: string; name: string; updated: number }[]>([]); const [cloud, setCloud] = useState<{ id: string; name: string; updated: number }[] | null>(null);
  useEffect(() => { getJSON<typeof local>("projects").then((x) => setLocal(x || [])); api.init().then(() => api.me.signedIn ? api.listProjects() : []).then((l) => setCloud(l.filter((x) => x.id.startsWith("st")))); }, []);
  const openLocal = async (id: string) => { const p = await getJSON("proj_" + id); if (p) { await openProject(p); ui.set({ projectsOpen: false }); } };
  const openCloud = async (id: string) => { try { const r = await api.getProject(id); if (r.doc && (r.doc as { studio?: unknown }).studio) { await openProject((r.doc as { studio: unknown }).studio); ui.set({ projectsOpen: false }); } } catch (e) { toast(String((e as Error).message), "warn"); } };
  const fresh = () => { openProject(emptyProject({ name: t("proj.untitled") })); ui.set({ projectsOpen: false }); autosave(); };
  const fmt = (n: number) => new Date(n).toLocaleString(document.documentElement.lang === "ar" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" });
  return (
    <Modal title={t("top.projects")} onClose={() => ui.set({ projectsOpen: false })}>
      <Btn icon="plus" primary onClick={fresh} testid="new-project">{t("proj.new")}</Btn>
      <span className="ns-lbl">{t("proj.device")}</span>
      {local.length ? <ul className="plist">{local.map((x) => <li key={x.id}><button type="button" onClick={() => openLocal(x.id)} aria-current={x.id === editor.project.id}><b dir="auto">{x.name}</b><small>{fmt(x.updated)}</small></button></li>)}</ul> : <p className="hint">{t("proj.none")}</p>}
      <span className="ns-lbl">{t("proj.account")}</span>
      {cloud == null ? <p className="hint">…</p> : !api.me.signedIn ? <p className="hint">{t("proj.signIn")}</p> : cloud.length ? <ul className="plist">{cloud.map((x) => <li key={x.id}><button type="button" onClick={() => openCloud(x.id)} aria-current={x.id === cloudId(editor.project.id)}><b dir="auto">{x.name}</b><small>{fmt(x.updated)}</small></button></li>)}</ul> : <p className="hint">{t("proj.none")}</p>}
      {!NATIVE && <p className="hint classic">{t("proj.classicHint")} <a href="/?classic=1" data-testid="classic">{t("proj.classic")}</a></p>}
    </Modal>
  );
}
export function Toasts() {
  const [s, set] = useState(toasts.get()); useEffect(() => toasts.subscribe(() => set(toasts.get())), []);
  return <div className="toasts" role="status" aria-live="polite">{s.list.map((x) => <div key={x.id} className={"toast " + x.kind}><span>{x.text}</span>{x.action && <button type="button" onClick={x.action.run}>{x.action.label}</button>}</div>)}</div>;
}
