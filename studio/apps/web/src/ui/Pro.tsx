// (v277) Filmora-16-class tools in the Inspector: motion blur, track matte, tracking (follow / lock), 360° camera, colour mask —
// and the preview overlay that picks the box to follow or the colour to mask. Everything is drawn by the device's compositor.
import { useTranslation } from "react-i18next";
import { Btn, Seg, Slider } from "@nooi/ui";
import { CMASK_DEFAULT, PANO_DEFAULT, findClip, hueOf } from "@nooi/editor-core";
import type { Clip, ColorMask, MediaClip, Pano } from "@nooi/editor-core";
import { useRef, useState } from "react";
import { editor, playerRef, toast, ui, useProject, useUI, autosave } from "../state";
import * as A from "../actions";
import { trackClip } from "../media/track";

const set = (id: string, label: string, fn: (c: Clip) => void) => A.run(label, (p) => { const f = findClip(p, id); if (f) fn(f.clip); });
const slide = (path: string, v: number) => A.live.set(path, v);

export function MotionBlurRow({ c }: { c: Clip }) {
  const { t } = useTranslation();
  return (<div className="pro277" data-testid="mblur">
    <Slider label={t("pro.mblur")} value={c.mblur || 0} min={0} max={1} step={0.05} fmt={(v) => (v ? Math.round(v * 360) + "°" : t("pro.off"))} onChange={(v) => slide("mblur", v)} onCommit={A.live.end} />
    <p className="hint">{t("pro.mblurHint")}</p>
  </div>);
}

export function MatteRow({ c }: { c: MediaClip }) {
  const { t } = useTranslation(); const m = c.matte;
  return (<div className="pro277" data-testid="matte">
    <Seg label={t("pro.matte")} value={m ? m.mode : "none"} options={[{ v: "none", label: t("pro.off") }, { v: "alpha", label: t("pro.alpha") }, { v: "luma", label: t("pro.luma") }]}
      onChange={(v) => set(c.id, "track matte", (x) => { const mc = x as MediaClip; mc.matte = v === "none" ? null : { mode: v as "alpha" | "luma", invert: mc.matte?.invert || false }; })} />
    {m && <label className="chk"><input type="checkbox" checked={m.invert} onChange={(e) => set(c.id, "invert matte", (x) => { (x as MediaClip).matte!.invert = e.target.checked; })} /> {t("pro.invert")}</label>}
    <p className="hint">{t("pro.matteHint")}</p>
  </div>);
}

export function TrackRow({ c }: { c: Clip }) {
  const { t } = useTranslation(); const p = useProject(); const busy = useUI((s) => s.tracking); const pick = useUI((s) => s.pick);
  const tracked = p.tracks.flatMap((tr) => tr.clips).filter((x) => x.type === "media" && x.track && x.id !== c.id) as MediaClip[];
  const isVid = c.type === "media" && p.assets[(c as MediaClip).asset]?.kind === "video"; const tr = c.type === "media" ? (c as MediaClip).track : null;
  return (<div className="pro277" data-testid="tracking">
    {isVid && <>
      <div className="row277">
        <Btn icon="target" primary={!tr} pressed={pick?.kind === "track" && pick.clip === c.id} onClick={() => ui.set({ pick: pick?.kind === "track" ? null : { kind: "track", clip: c.id } })} testid="track-pick">{tr ? t("pro.retrack") : t("pro.track")}</Btn>
        {tr && <Btn icon="trash" ghost onClick={() => set(c.id, "remove tracking", (x) => { (x as MediaClip).track = null; })} testid="track-off">{t("pro.trackOff")}</Btn>}
      </div>
      {busy?.clip === c.id && <div className="bar277" role="progressbar" aria-valuenow={Math.round(busy.k * 100)}><i style={{ width: busy.k * 100 + "%" }} /></div>}
      {pick?.kind === "track" && pick.clip === c.id && <p className="hint">{t("pro.trackHow")}</p>}
      {tr && <>
        <p className="hint ok277" data-testid="track-done">{t("pro.tracked", { n: tr.pts.length })}</p>
        <Slider label={t("pro.lock")} value={tr.lock || 0} min={0} max={1} step={0.05} fmt={(v) => (v ? Math.round(v * 100) + "%" : t("pro.off"))} onChange={(v) => slide("track.lock", v)} onCommit={A.live.end} />
        <p className="hint">{t("pro.lockHint")}</p>
      </>}
    </>}
    <label className="lbl277">{t("pro.follow")}</label>
    <select value={c.follow?.clip || ""} data-native onChange={(e) => set(c.id, "follow", (x) => { x.follow = e.target.value ? { clip: e.target.value } : null; })} data-testid="follow">
      <option value="">{t("pro.followNone")}</option>
      {tracked.map((x) => <option key={x.id} value={x.id}>{x.name || p.assets[x.asset]?.name || x.id}</option>)}
    </select>
    <p className="hint">{tracked.length ? t("pro.followHint") : t("pro.followFirst")}</p>
  </div>);
}

export function PanoRow({ c }: { c: MediaClip }) {
  const { t } = useTranslation(); const v = c.pano;
  const on = (b: boolean) => set(c.id, "360", (x) => { const m = x as MediaClip; m.pano = b ? { ...PANO_DEFAULT, ...(m.pano || {}), on: true } : m.pano ? { ...m.pano, on: false } : null; });
  const S = (k: keyof Pano, label: string, min: number, max: number) => <Slider label={label} value={(v?.[k] as number) ?? 0} min={min} max={max} step={1} unit="°" onChange={(x) => slide("pano." + k, x)} onCommit={A.live.end} />;
  return (<div className="pro277" data-testid="pano">
    <label className="chk"><input type="checkbox" checked={!!v?.on} onChange={(e) => on(e.target.checked)} data-testid="pano-on" /> {t("pro.panoOn")}</label>
    {v?.on && <>{S("yaw", t("pro.yaw"), -180, 180)}{S("pitch", t("pro.pitch"), -90, 90)}{S("fov", t("pro.fov"), 20, 150)}{S("roll", t("pro.roll"), -45, 45)}
      <label className="chk"><input type="checkbox" checked={!!v.move} onChange={(e) => set(c.id, "360 move", (x) => { (x as MediaClip).pano!.move = e.target.checked; })} /> {t("pro.panoMove")}</label>
      {v.move && <>{S("yaw2", t("pro.yaw2"), -180, 180)}{S("pitch2", t("pro.pitch2"), -90, 90)}{S("fov2", t("pro.fov2"), 20, 150)}</>}</>}
    <p className="hint">{t("pro.panoHint")}</p>
  </div>);
}

const SW = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#00acc1", "#1e88e5", "#8e24aa", "#d81b60"];
export function ColorMaskSection({ c }: { c: MediaClip }) {
  const { t } = useTranslation(); const m = c.cmask; const pick = useUI((s) => s.pick);
  const put = (patch: Partial<ColorMask>, label = "colour mask") => set(c.id, label, (x) => { const mc = x as MediaClip; mc.cmask = { ...CMASK_DEFAULT, ...(mc.cmask || {}), ...patch }; });
  const S = (k: keyof ColorMask, label: string, min: number, max: number, fmt?: (v: number) => string) =>
    <Slider label={label} value={(m?.[k] as number) ?? 0} min={min} max={max} step={0.01} fmt={fmt} onChange={(x) => slide("cmask." + k, x)} onCommit={A.live.end} />;
  return (<div className="pro277" data-testid="cmask">
    <p className="hint">{t("pro.cmHint")}</p>
    <div className="sw277" role="group" aria-label={t("pro.cmColor")}>
      {SW.map((h) => <button key={h} type="button" style={{ background: h }} aria-label={h} aria-pressed={!!m?.on && Math.abs(m.hue - hueOf(h)) < 0.01} onClick={() => put({ on: true, hue: hueOf(h) })} />)}
      <Btn icon="eyedrop" pressed={pick?.kind === "color" && pick.clip === c.id} onClick={() => ui.set({ pick: pick?.kind === "color" ? null : { kind: "color", clip: c.id } })} testid="cm-pick">{t("pro.cmPick")}</Btn>
    </div>
    {m && <>
      <label className="chk"><input type="checkbox" checked={m.on} onChange={(e) => put({ on: e.target.checked })} data-testid="cm-on" /> {t("pro.cmOn")}</label>
      {S("range", t("pro.cmRange"), 0.01, 0.3)}{S("soft", t("pro.cmSoft"), 0, 0.2)}
      {S("hueShift", t("pro.cmHue"), -0.5, 0.5, (v) => Math.round(v * 360) + "°")}{S("sat", t("pro.cmSat"), -1, 1)}{S("exposure", t("pro.cmExp"), -1, 1)}
      <label className="chk"><input type="checkbox" checked={m.invert} onChange={(e) => put({ invert: e.target.checked })} /> {t("pro.cmInvert")}</label>
      <label className="chk"><input type="checkbox" checked={m.show} onChange={(e) => put({ show: e.target.checked })} data-testid="cm-show" /> {t("pro.cmShow")}</label>
      <Btn icon="trash" ghost onClick={() => set(c.id, "remove colour mask", (x) => { (x as MediaClip).cmask = null; })}>{t("pro.cmOff")}</Btn>
    </>}
  </div>);
}

/** the preview waits for a box (tracking) or a tap (colour) */
export function PickOverlay() {
  const { t } = useTranslation(); const pick = useUI((s) => s.pick); const box = useRef<HTMLDivElement>(null); const [r, setR] = useState<[number, number, number, number] | null>(null);
  if (!pick) return null;
  const at = (e: React.PointerEvent) => { const b = box.current!.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), Math.max(0, Math.min(1, (e.clientY - b.top) / b.height))]; };
  const down = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation(); const [x0, y0] = at(e);
    if (pick.kind === "color") { pickColor(pick.clip, x0, y0); return; }
    (e.target as Element).setPointerCapture?.(e.pointerId); setR([x0, y0, 0, 0]);
    const mv = (ev: PointerEvent) => { const b = box.current!.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (ev.clientX - b.left) / b.width)), y = Math.max(0, Math.min(1, (ev.clientY - b.top) / b.height)); setR([Math.min(x0, x), Math.min(y0, y), Math.abs(x - x0), Math.abs(y - y0)]); };
    const up = (ev: PointerEvent) => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      const b = box.current!.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (ev.clientX - b.left) / b.width)), y = Math.max(0, Math.min(1, (ev.clientY - b.top) / b.height));
      const fr: [number, number, number, number] = [Math.min(x0, x), Math.min(y0, y), Math.abs(x - x0), Math.abs(y - y0)]; setR(null);
      if (fr[2] < 0.02 || fr[3] < 0.02) { toast(t("pro.trackSmall"), "info"); return; }
      void startTrack(pick.clip, fr); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  return (<div className={"pick277 " + pick.kind} ref={box} onPointerDown={down} role="button" tabIndex={0} aria-label={pick.kind === "track" ? t("pro.trackHow") : t("pro.cmPickHow")} data-testid="pick277">
    <span className="tag277">{pick.kind === "track" ? t("pro.trackHow") : t("pro.cmPickHow")}</span>
    {r && <i className="box277" style={{ left: r[0] * 100 + "%", top: r[1] * 100 + "%", width: r[2] * 100 + "%", height: r[3] * 100 + "%" }} />}
    <button type="button" className="x277" onPointerDown={(e) => e.stopPropagation()} onClick={() => ui.set({ pick: null })}>{t("pro.cancel")}</button>
  </div>);
}

function pickColor(id: string, x: number, y: number) {
  const cv = document.querySelector<HTMLCanvasElement>('[data-testid="preview"]'); if (!cv) return;
  const o = document.createElement("canvas"); o.width = cv.width; o.height = cv.height; const g = o.getContext("2d")!; g.drawImage(cv, 0, 0);
  const d = g.getImageData(Math.round(x * (cv.width - 1)), Math.round(y * (cv.height - 1)), 1, 1).data;
  const hex = "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
  set(id, "colour mask", (c) => { const mc = c as MediaClip; mc.cmask = { ...CMASK_DEFAULT, ...(mc.cmask || {}), on: true, hue: hueOf(hex) }; });
  ui.set({ pick: null });
}

async function startTrack(id: string, fr: [number, number, number, number]) {
  ui.set({ pick: null }); const p = editor.project; const f = findClip(p, id); if (!f || f.clip.type !== "media") return; const c = f.clip;
  // the box on the frame → the same box on the clip's own picture (where it is fitted, cropped, flipped)
  const local = Math.max(0, Math.min(c.dur, (playerRef.current?.clock.t ?? c.start) - c.start)); const b = A.pictureBox(p, c, local);
  const cr = c.transform.crop; const toU = (fx: number) => { let u = (fx - (b.cx - b.w / 2)) / b.w; if (c.transform.flipH) u = 1 - u; return cr[0] + u * (1 - cr[0] - cr[2]); };
  const toV = (fy: number) => { let v = (fy - (b.cy - b.h / 2)) / b.h; if (c.transform.flipV) v = 1 - v; return cr[1] + v * (1 - cr[1] - cr[3]); };
  const u0 = toU(fr[0]), u1 = toU(fr[0] + fr[2]), v0 = toV(fr[1]), v1 = toV(fr[1] + fr[3]);
  const src: [number, number, number, number] = [Math.max(0, Math.min(u0, u1)), Math.max(0, Math.min(v0, v1)), Math.min(1, Math.abs(u1 - u0)), Math.min(1, Math.abs(v1 - v0))];
  ui.set({ tracking: { clip: id, k: 0 } });
  try {
    const tr = await trackClip(p, c, src, (k) => ui.set({ tracking: { clip: id, k } }));
    A.run("track", (q) => { const g = findClip(q, id); if (g && g.clip.type === "media") g.clip.track = tr; }); autosave();
    toast(t0("pro.trackedToast"), "ok");
  } catch (e) { toast((e as Error).message || String(e), "warn"); }
  finally { ui.set({ tracking: null }); }
}
// i18n outside React
import i18n from "../i18n";
const t0 = (k: string) => i18n.t(k);
