// The studio's frame (spec §4.1, §4.3): the File menu and project settings, the workspaces, Nooi Mate, the cloud state, the AI Hub,
// and the toolbar's menus — speed, crop & reframe, the history list and the voice-over with its 3-2-1.
import { useTranslation } from "react-i18next";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Btn, Icon, Seg, Slider } from "@nooi/ui";
import * as C from "@nooi/editor-core";
import type { Aspect, MediaClip } from "@nooi/editor-core";
import { editor, ui, useProject, useUI, autosave, openProject, saveCloud, toast, playerRef } from "../state";
import type { Rail, UI, Workspace } from "../state";
import { api } from "../api";
import * as A from "../actions";
import i18n from "../i18n";
import { importFiles } from "../media/library";
import { saveFile } from "../engine/native";
import { NATIVE, at } from "../site";
import { Modal } from "./Dialogs";
import { understand } from "../mate";
import type { Card } from "../mate";

const tr = (k: string, o?: Record<string, unknown>) => i18n.t(k, o) as string;

// ---- a small window that opens next to its button (fixed, so a scrolling bar never cuts it); a tap outside or Esc closes it
export function Pop({ open, onClose, className, label, children, w = 260 }: { open: boolean; onClose: () => void; className?: string; label: string; children: ReactNode; w?: number }) {
  const ref = useRef<HTMLDivElement>(null); const [pos, setPos] = useState<{ left: number; top: number } | null>(null); const close = useRef(onClose); close.current = onClose;
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; } const el = ref.current, anchor = el?.parentElement; if (!el || !anchor) return;
    const r = anchor.getBoundingClientRect(), h = el.offsetHeight, ww = Math.min(w, innerWidth - 16);
    const rtl = document.documentElement.dir === "rtl"; let left = rtl ? r.right - ww : r.left; left = Math.max(8, Math.min(innerWidth - ww - 8, left));
    let top = r.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
    setPos({ left, top });
  }, [open, w]);
  useEffect(() => {
    if (!open) return; const anchor = ref.current?.parentElement;
    const d = (e: PointerEvent) => { if (anchor && !anchor.contains(e.target as Node)) close.current(); }; const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close.current(); } };   // (Esc closes this only — the picked clip stays picked)
    const id = setTimeout(() => window.addEventListener("pointerdown", d)); window.addEventListener("keydown", k, true);
    return () => { clearTimeout(id); window.removeEventListener("pointerdown", d); window.removeEventListener("keydown", k, true); };
  }, [open]);
  if (!open) return null;
  return <div ref={ref} className={"pop " + (className || "")} role="dialog" aria-label={label} style={{ width: Math.min(w, innerWidth - 16), ...(pos || { visibility: "hidden", left: 0, top: 0 }) }}>{children}</div>;
}
function MenuItem({ icon, label, kbd, onClick, testid, disabled }: { icon: string; label: string; kbd?: string; onClick: () => void; testid?: string; disabled?: boolean }) {
  return <button type="button" className="mitem" role="menuitem" onClick={onClick} data-testid={testid} disabled={disabled}><Icon name={icon} size={16} /><span>{label}</span>{kbd && <kbd>{kbd}</kbd>}</button>;
}

// ---------------- .nooi files: the whole project as one file (the media stays where it is: the account or this device)
export async function saveNooi() {
  const p = editor.project; const doc = { nooiVersion: 1, app: "nooi Studio", saved: new Date().toISOString(), project: p };
  const blob = new Blob([JSON.stringify(doc)], { type: "application/json" });
  const name = ((p.name || "project").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60) || "project") + ".nooi";
  try { if (await saveFile(blob, name)) return; } catch { /* the browser's download below */ }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(tr("file.saved", { name }), "ok");
}
export async function openNooi(f: File) {
  try {
    const j = JSON.parse(await f.text()); const p = j && typeof j === "object" && j.project ? j.project : j;
    if (!p || !Array.isArray(p.tracks)) throw new Error("not a project");
    await openProject(p); autosave(); toast(tr("file.opened", { name: editor.project.name }), "ok");
  } catch { toast(tr("file.bad"), "warn"); }
}

// ---------------- the File menu (next to the logo)
export function FileMenu() {
  const { t } = useTranslation(); const open = useUI((s) => s.fileOpen); const fileRef = useRef<HTMLInputElement>(null);
  const go = (f: () => void) => () => { ui.set({ fileOpen: false }); f(); };
  const fresh = () => { openProject(C.emptyProject({ name: t("proj.untitled") })); autosave(); };
  return (
    <span className="popwrap">
      <button type="button" className="filebtn" aria-expanded={open} aria-haspopup="menu" onClick={() => ui.set({ fileOpen: !open })} data-testid="file-menu"><span>{t("file.menu")}</span><Icon name="chevron" size={14} /></button>
      <Pop open={open} onClose={() => ui.set({ fileOpen: false })} label={t("file.menu")} className="menu" w={250}>
        <div role="menu">
          <MenuItem icon="plus" label={t("proj.new")} onClick={go(fresh)} testid="file-new" />
          <MenuItem icon="folder" label={t("file.open")} onClick={go(() => ui.set({ projectsOpen: true }))} testid="file-projects" />
          <MenuItem icon="settings" label={t("file.settings")} onClick={go(() => ui.set({ settingsOpen: true }))} testid="file-settings" />
          <hr />
          <MenuItem icon="download" label={t("file.save")} kbd="Ctrl+Shift+S" onClick={go(saveNooi)} testid="file-save" />
          <MenuItem icon="upload" label={t("file.load")} onClick={() => fileRef.current?.click()} testid="file-load" />
          <hr />
          <MenuItem icon="search" label={t("palette.open")} kbd="⌘K" onClick={go(() => ui.set({ paletteOpen: true }))} />
          <MenuItem icon="export" label={t("top.export")} kbd="Ctrl+E" onClick={go(() => ui.set({ exportOpen: true }))} />
          {!NATIVE && <a className="mitem" role="menuitem" href={at("/")}><Icon name="home" size={16} /><span>{t("top.home")}</span></a>}
        </div>
        <input ref={fileRef} type="file" accept=".nooi,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; ui.set({ fileOpen: false }); if (f) openNooi(f); }} data-testid="nooi-input" />
      </Pop>
    </span>
  );
}

// ---------------- Project settings (520 × 440)
const resOf = (w: number, h: number): keyof typeof C.RESOLUTIONS => { const m = Math.min(w, h); return m <= 720 ? "720p" : m >= 2000 ? "4k" : "1080p"; };
export function SettingsDialog() {
  const { t } = useTranslation(); const p = useProject(); const aspect = C.aspectOf(p.width, p.height) as Aspect; const res = resOf(p.width, p.height);
  const size = (a: Aspect, r: keyof typeof C.RESOLUTIONS) => { const { w, h } = C.frameSize(a, r); A.run("format", (q) => { q.width = w; q.height = h; q.export.res = r; }); playerRef.current?.resize(); };
  return (
    <Modal title={t("file.settings")} onClose={() => ui.set({ settingsOpen: false })} cls="settings">
      <div className="setgrid" data-testid="settings">
        <label className="ns-field"><span>{t("top.name")}</span><input className="ns-input" value={p.name} onChange={(e) => { editor.run("rename", (d) => { d.name = e.target.value.slice(0, 80); }); autosave(); }} data-testid="set-name" /></label>
        <span className="ns-lbl">{t("top.format")}</span>
        <Seg label={t("top.format")} value={C.ASPECTS.includes(aspect) ? aspect : ("16:9" as Aspect)} onChange={(v) => size(v, res)} options={C.ASPECTS.map((a) => ({ v: a, label: a }))} />
        <span className="ns-lbl">{t("set.res")}</span>
        <Seg label={t("set.res")} value={res} onChange={(v) => size(C.ASPECTS.includes(aspect) ? aspect : "16:9", v)} options={(["720p", "1080p", "4k"] as const).map((v) => ({ v, label: v === "4k" ? "4K" : v }))} />
        <span className="ns-lbl">{t("insp.fps")}</span>
        <Seg label={t("insp.fps")} value={String(p.fps)} onChange={(v) => A.run("fps", (q) => { q.fps = +v; q.export.fps = +v; })} options={["24", "25", "30", "60"].map((v) => ({ v, label: v }))} />
        <label className="ns-field row"><span>{t("insp.background")}</span><input type="color" value={p.background} onChange={(e) => A.run("background", (q) => { q.background = e.target.value; })} /></label>
        <p className="hint" dir="ltr">{p.width} × {p.height} · {p.fps} fps · {C.duration(p).toFixed(1)}s</p>
      </div>
      <div className="row end"><Btn icon="check" primary onClick={() => ui.set({ settingsOpen: false })} testid="set-done">{t("act.done")}</Btn></div>
    </Modal>
  );
}

// ---------------- workspaces: the same parts, set out for the job
const WS: [Workspace, string][] = [["classic", "layout"], ["vertical", "phone"], ["color", "color"], ["audio", "audio"]];
export function setWorkspace(w: Workspace) {
  const s: Partial<UI> = { workspace: w };
  if (w === "vertical") { const p = editor.project; if (p.height <= p.width) A.format("9:16"); }
  if (w === "color") s.inspector = "color";
  if (w === "audio") { s.inspector = "audio"; s.rail = "audio"; }
  ui.set(s);
}
export function WorkspaceSwitch() {
  const { t } = useTranslation(); const w = useUI((s) => s.workspace); const [open, setOpen] = useState(false); const ic = WS.find((x) => x[0] === w)?.[1] || "layout";
  return (
    <span className="popwrap wswrap">
      <button type="button" className="wsbtn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)} data-testid="ws" title={t("ws.label")}><Icon name={ic} size={16} /><span>{t("ws." + w)}</span><Icon name="chevron" size={14} /></button>
      <Pop open={open} onClose={() => setOpen(false)} label={t("ws.label")} className="menu" w={270}>
        <div role="menu">{WS.map(([k, i]) => <button key={k} type="button" role="menuitemradio" aria-checked={w === k} className="mitem two" onClick={() => { setWorkspace(k); setOpen(false); }} data-testid={"ws-" + k}>
          <Icon name={i} size={16} /><span><b>{t("ws." + k)}</b><small>{t("ws." + k + "Hint")}</small></span></button>)}</div>
      </Pop>
    </span>
  );
}

// ---------------- the cloud: is it saved, where, and the review link
export function CloudButton() {
  const { t } = useTranslation(); const saved = useUI((s) => s.saved); const open = useUI((s) => s.cloudOpen);
  const signed = api.online && api.me.signedIn;
  return (
    <span className="popwrap">
      <button type="button" className={"cloudbtn saved " + saved} aria-expanded={open} onClick={() => ui.set({ cloudOpen: !open })} data-testid="cloud" title={t("save." + saved)}><Icon name="cloud" size={16} /><span>{t("save." + saved)}</span></button>
      <Pop open={open} onClose={() => ui.set({ cloudOpen: false })} label={t("cloud.title")} w={290}>
        <h3 className="ns-h3">{t("cloud.title")}</h3>
        <p className="hint">{signed ? t("cloud.account") : t("cloud.device")}</p>
        <div className="row"><Btn icon="cloud" primary onClick={async () => { autosave(); if (signed) { const ok = await saveCloud(); toast(ok ? t("cloud.done") : t("save.error"), ok ? "ok" : "warn"); } }} testid="cloud-save">{t("cloud.saveNow")}</Btn>
          <Btn icon="download" onClick={() => { ui.set({ cloudOpen: false }); saveNooi(); }}>{t("file.save")}</Btn></div>
        {!signed && api.online && <a className="ns-btn" href={at("/?signin=1")}>{t("ai.signInBtn")}</a>}
        <span className="ns-lbl">{t("cloud.review")}</span>
        <p className="hint">{t("cloud.reviewHint")}</p>
      </Pop>
    </span>
  );
}

// ---------------- Nooi Mate: say what you want, then tap to do it
const EXAMPLES = ["mate.ex1", "mate.ex2", "mate.ex3", "mate.ex4"];
export function MateDrawer() {
  const { t } = useTranslation(); const open = useUI((s) => s.mate); const [q, setQ] = useState(""); const [cards, setCards] = useState<Card[] | null>(null); const [done, setDone] = useState<Record<number, boolean>>({}); const [busy, setBusy] = useState(-1);
  if (!open) return null;
  const ask = (s = q) => { setQ(s); setCards(understand(s, t)); setDone({}); };
  const apply = async (c: Card, i: number) => { setBusy(i); try { await c.run(); setDone((d) => ({ ...d, [i]: true })); toast(t("mate.applied"), "ok"); } catch { toast(t("mate.failed"), "warn"); } setBusy(-1); };
  return (
    <aside className="mate" role="complementary" aria-label={t("mate.title")} data-testid="mate">
      <div className="mhead"><span className="aibadge" aria-hidden="true"><Icon name="sparkle" size={14} /></span><h2 className="ns-h2">{t("mate.title")}</h2><span className="sp" /><Btn icon="close" ghost label={t("insp.close")} onClick={() => ui.set({ mate: false })} testid="mate-close" /></div>
      <div className="mbody">
        <p className="hint">{t("mate.hint")}</p>
        <form className="mateask" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <textarea className="ns-input" rows={2} dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("mate.placeholder")} aria-label={t("mate.placeholder")} data-testid="mate-q"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
          <Btn icon="sparkle" primary onClick={() => ask()} disabled={!q.trim()} testid="mate-go">{t("mate.go")}</Btn>
        </form>
        {cards == null && <div className="chips">{EXAMPLES.map((k) => <button key={k} type="button" className="chip" onClick={() => ask(t(k))}>{t(k)}</button>)}</div>}
        {cards != null && !cards.length && <p className="hint" data-testid="mate-none">{t("mate.none")}</p>}
        {cards?.map((c, i) => <div key={i} className={"mcard" + (done[i] ? " done" : "")} data-testid={"mate-card-" + i}>
          <span>{c.title}</span>
          <Btn icon={done[i] ? "check" : "play"} primary={!done[i]} disabled={done[i] || busy >= 0} onClick={() => apply(c, i)} testid={"mate-apply-" + i}>{done[i] ? t("mate.done") : busy === i ? t("mate.working") : t("mate.apply")}</Btn>
        </div>)}
        <p className="hint small">{t("mate.local")}</p>
        <Btn icon="ai" onClick={() => ui.set({ mate: false, hub: true })}>{t("hub.title")}</Btn>
      </div>
    </aside>
  );
}

// ---------------- the AI Hub: every AI tool in one grid (320 × 280)
const HUB: { id: string; icon: string; rail?: Rail; sub?: string; run?: () => void }[] = [
  { id: "gen", icon: "film", rail: "stock", sub: "aigen" }, { id: "tools", icon: "ai", rail: "stock", sub: "aitools" },
  { id: "captions", icon: "captions", rail: "titles", sub: "captions" }, { id: "mate", icon: "chat", run: () => ui.set({ mate: true }) },
  { id: "pauses", icon: "cut", run: () => ui.set({ mate: true }) }, { id: "clean", icon: "denoise", run: () => { const c = A.sel1(); if (c?.type === "media") A.setProp("denoise", true); else toast(tr("toast.pickClip"), "info"); } },
  { id: "beats", icon: "beat", rail: "audio" }, { id: "sfx", icon: "audio", rail: "audio", sub: "sfx" }, { id: "montage", icon: "template", run: () => A.instantMontage() },
];
export function AiHub() {
  const { t } = useTranslation(); const open = useUI((s) => s.hub);
  const go = (h: (typeof HUB)[number]) => { ui.set((s) => ({ hub: false, ...(h.rail ? { rail: h.rail, panelOpen: true, sub: h.sub ? { ...s.sub, [h.rail]: h.sub } : s.sub } : {}) })); h.run?.(); };
  return (
    <span className="popwrap">
      <Btn icon="ai" label={t("hub.title")} pressed={open} onClick={() => ui.set({ hub: !open })} className="aibtn" testid="hub" />
      <Pop open={open} onClose={() => ui.set({ hub: false })} label={t("hub.title")} className="hub" w={320}>
        <div className="hubhead"><span className="aibadge" aria-hidden="true"><Icon name="sparkle" size={14} /></span><b>{t("hub.title")}</b></div>
        <div className="hubgrid">{HUB.map((h) => <button key={h.id} type="button" onClick={() => go(h)} data-testid={"hub-" + h.id}><span className="hic"><Icon name={h.icon} size={20} /><i className="aibadge sm" aria-hidden="true" /></span><span>{t("hub." + h.id)}</span></button>)}</div>
      </Pop>
    </span>
  );
}

// ---------------- Speed (a menu on the toolbar)
export function SpeedMenu() {
  const { t } = useTranslation(); useProject(); const open = useUI((s) => s.speedOpen); const c = A.sel1(); const m = c?.type === "media" ? (c as MediaClip) : null;
  return (
    <span className="popwrap">
      <Btn icon="speed" label={t("insp.speed")} pressed={open} onClick={() => ui.set({ speedOpen: !open })} testid="speed-menu" />
      <Pop open={open} onClose={() => ui.set({ speedOpen: false })} label={t("insp.speed")} w={250}>
        <h3 className="ns-h3">{t("insp.speed")}{m && <b className="dim" dir="ltr"> · {m.speed.toFixed(2).replace(/\.?0+$/, "")}×</b>}</h3>
        {!m ? <p className="hint">{t("toast.pickClip")}</p> : <>
          <div className="chips">{[0.25, 0.5, 1, 1.5, 2, 4].map((v) => <button type="button" key={v} className="chip" aria-pressed={Math.abs(m.speed - v) < 1e-3} onClick={() => A.speed(v)} data-testid={"sp-" + v}>{v}×</button>)}</div>
          <div className="row"><Btn icon="reverse" pressed={m.reverse} onClick={A.reverse}>{t("insp.reverse")}</Btn><Btn icon="freeze" onClick={A.freeze}>{t("insp.freeze")}</Btn></div>
          <button type="button" className="linkbtn" onClick={() => ui.set({ speedOpen: false, inspector: "speed" })}>{t("sp.more")}</button>
        </>}
      </Pop>
    </span>
  );
}

// ---------------- History: every step back, by name
export function HistoryMenu() {
  const { t } = useTranslation(); useProject(); const open = useUI((s) => s.historyOpen); const past = editor.past.slice(-30).reverse();
  const back = (n: number) => { for (let i = 0; i < n; i++) A.undo(); ui.set({ historyOpen: false }); };
  return (
    <span className="popwrap">
      <Btn icon="history" label={t("hist.title")} pressed={open} onClick={() => ui.set({ historyOpen: !open })} testid="history" />
      <Pop open={open} onClose={() => ui.set({ historyOpen: false })} label={t("hist.title")} className="menu" w={240}>
        <h3 className="ns-h3">{t("hist.title")}</h3>
        <div className="hist" role="menu">
          <div className="mitem now"><Icon name="check" size={14} /><span>{t("hist.now")}</span></div>
          {past.map((s, i) => <button key={editor.past.length - i} type="button" className="mitem" role="menuitem" onClick={() => back(i + 1)} data-testid={"hist-" + i}><Icon name="undo" size={14} /><span>{t("hist." + s.label.replace(/\s+/g, "_"), { defaultValue: s.label })}</span></button>)}
          {!past.length && <p className="hint">{t("hist.none")}</p>}
        </div>
      </Pop>
    </span>
  );
}

// ---------------- Crop & Reframe: fit / fill, and a slow camera move (Ken Burns) over the clip
const MOVES = ["none", "in", "out", "left", "right", "up", "down"] as const;
export function kenBurns(move: (typeof MOVES)[number], amount: number) {
  const c = A.sel1(); if (c?.type !== "media") { toast(tr("toast.pickClip"), "info"); return; }
  A.run("reframe", (p) => {
    const f = C.findClip(p, c.id); if (!f) return; const k = f.clip.keyframes; for (const x of ["x", "y", "scale"] as const) delete k[x];
    if (move === "none") return; const d = Math.max(0.2, f.clip.dur), s = f.clip.transform.scale || 1, big = s * (1 + amount), x = f.clip.transform.x || 0, y = f.clip.transform.y || 0, sh = amount / 2.5;
    const kk = (a: number, b: number) => [{ t: 0, v: a, ease: "easeInOut" as const }, { t: d, v: b, ease: "easeInOut" as const }];
    if (move === "in") k.scale = kk(s, big); else if (move === "out") k.scale = kk(big, s);
    else { k.scale = kk(big, big); if (move === "left") k.x = kk(x + sh, x - sh); if (move === "right") k.x = kk(x - sh, x + sh); if (move === "up") k.y = kk(y + sh, y - sh); if (move === "down") k.y = kk(y - sh, y + sh); }
  });
}
export function fillFrame(fill: boolean) {
  const c = A.sel1(); if (c?.type !== "media") { toast(tr("toast.pickClip"), "info"); return; } const p = editor.project; const a = p.assets[c.asset];
  const aw = a?.w || p.width, ah = a?.h || p.height; const cw = aw * (1 - c.transform.crop[0] - c.transform.crop[2]), ch = ah * (1 - c.transform.crop[1] - c.transform.crop[3]);
  const rw = p.width / cw, rh = p.height / ch; const s = fill ? Math.max(rw, rh) / Math.min(rw, rh) : 1;
  A.run("reframe", (q) => { const f = C.findClip(q, c.id); if (!f) return; Object.assign(f.clip.transform, { x: 0, y: 0, scale: Math.round(s * 1000) / 1000 }); delete f.clip.keyframes.scale; delete f.clip.keyframes.x; delete f.clip.keyframes.y; });
}
export function ReframeDialog() {
  const { t } = useTranslation(); useProject(); const c = A.sel1(); const [move, setMove] = useState<(typeof MOVES)[number]>("in"); const [amt, setAmt] = useState(0.2);
  const close = () => ui.set({ reframeOpen: false });
  return (
    <Modal title={t("rf.title")} onClose={close} cls="settings">
      {c?.type !== "media" ? <p className="hint">{t("toast.pickClip")}</p> : <div data-testid="reframe">
        <span className="ns-lbl">{t("rf.frame")}</span>
        <div className="row"><Btn icon="layout" onClick={() => fillFrame(false)} testid="rf-fit">{t("rf.fit")}</Btn><Btn icon="crop" onClick={() => fillFrame(true)} testid="rf-fill">{t("rf.fill")}</Btn>
          <Btn icon="undo" ghost onClick={A.resetTransform}>{t("insp.reset")}</Btn></div>
        <span className="ns-lbl">{t("insp.crop")}</span>
        {(["left", "top", "right", "bottom"] as const).map((k, i) => <Slider key={k} label={t("insp." + k)} value={(c as MediaClip).transform.crop[i]} min={0} max={0.45} fmt={(v) => Math.round(v * 100) + "%"} onChange={(v) => { const cr = [...(c as MediaClip).transform.crop] as [number, number, number, number]; cr[i] = v; A.live.set("transform.crop", cr); }} onCommit={A.live.end} />)}
        <span className="ns-lbl">{t("rf.move")}</span>
        <div className="chips">{MOVES.map((m) => <button key={m} type="button" className="chip" aria-pressed={move === m} onClick={() => setMove(m)} data-testid={"rf-" + m}>{t("rf." + m)}</button>)}</div>
        {move !== "none" && <Slider label={t("rf.amount")} value={amt} min={0.05} max={0.6} fmt={(v) => Math.round(v * 100) + "%"} onChange={setAmt} />}
        <p className="hint">{t("rf.hint")}</p>
        <div className="row end"><Btn onClick={close}>{t("exp.cancel")}</Btn><Btn icon="check" primary onClick={() => { kenBurns(move, amt); close(); }} testid="rf-apply">{t("rf.apply")}</Btn></div>
      </div>}
    </Modal>
  );
}

// ---------------- the voice-over: 3-2-1, then it records at the playhead while the video plays; tap again to stop
let rec: MediaRecorder | null = null;
export async function voiceOver() {
  const s = ui.get();
  if (s.rec === "rec") { rec?.stop(); return; }
  if (s.rec === "count") { ui.set({ rec: "idle", count: 0 }); return; }
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { toast(tr("audio.noMic"), "warn"); return; }
  for (let n = 3; n > 0; n--) { ui.set({ rec: "count", count: n }); await new Promise((r) => setTimeout(r, 1000)); if (ui.get().rec !== "count") { stream.getTracks().forEach((x) => x.stop()); return; } }
  const mr = new MediaRecorder(stream); const parts: Blob[] = []; const start = A.now(); rec = mr;
  mr.ondataavailable = (e) => parts.push(e.data);
  mr.onstop = async () => {
    stream.getTracks().forEach((x) => x.stop()); rec = null; ui.set({ rec: "idle", count: 0 }); playerRef.current?.pause();
    const f = new File(parts, tr("audio.voiceName") + ".webm", { type: mr.mimeType || "audio/webm" });
    const r = await importFiles([f]); if (r.assets[0]) { A.addAssets(r.assets); A.addAsset(editor.project.assets[r.assets[0].id], start); toast(tr("vo.added"), "ok"); }
  };
  mr.start(); ui.set({ rec: "rec", count: 0 }); playerRef.current?.play();
}
export function VoiceButton() {
  const { t } = useTranslation(); const st = useUI((s) => s.rec);
  return <Btn icon={st === "rec" ? "pause" : "mic"} label={st === "rec" ? t("audio.stop") : t("audio.voiceover")} pressed={st !== "idle"} onClick={voiceOver} className={st === "rec" ? "recon" : undefined} testid="vo" />;
}
export function RecOverlay() {
  const { t } = useTranslation(); const st = useUI((s) => s.rec); const n = useUI((s) => s.count);
  if (st === "idle") return null;
  if (st === "rec") return <button type="button" className="recpill" onClick={voiceOver} data-testid="rec-stop"><i />{t("vo.recording")}</button>;
  return <div className="countdown" role="status" aria-live="assertive" data-testid="countdown"><b>{n}</b><span>{t("vo.ready")}</span><Btn onClick={voiceOver}>{t("exp.cancel")}</Btn></div>;
}

// ---------------- render status: how heavy the picture is to play (effects, transitions, many layers)
export function RenderStatus() {
  const { t } = useTranslation(); const p = useProject();
  const heavy = p.tracks.filter((x) => x.kind === "video").flatMap((x) => x.clips).filter((c) => c.type === "media" && (c.effects.length > 0 || !!c.lut)).length + p.transitions.length;
  const layers = p.tracks.filter((x) => x.kind === "video" && x.clips.length).length;
  const k = heavy > 6 || layers > 4 ? "red" : heavy > 0 || layers > 2 ? "amber" : "green";
  return <span className={"rstat " + k} title={t("rs." + k)} data-testid="render-status"><i />{t("rs." + k)}</span>;
}
