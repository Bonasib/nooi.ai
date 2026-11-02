// The preview: a clock, a pool of media elements that follow it, the sound through Web Audio (volume, fades, keyframes,
// mute/solo, ducking), and the compositor drawing at the preview's size (a proxy size — smooth on ordinary devices, no GPU needed).
import { clipEnd, duckGain, duration, findClip, gainAt, layersAt, soundsAt, sourceTime, srcLimit } from "@nooi/editor-core";
import type { Asset, Editor, MediaClip, Project } from "@nooi/editor-core";
import { Compositor, parseCube } from "./compositor";
import { drawMoment, type Frame } from "./render";
import { fileOf, urlOf } from "../media/library";

type El = HTMLVideoElement | HTMLAudioElement;
export interface ClockState { t: number; playing: boolean; buffering: boolean }

export class Player {
  comp: Compositor; clock: ClockState = { t: 0, playing: false, buffering: false };
  private els = new Map<string, { el: El; asset: string; node?: MediaElementAudioSourceNode; gain?: GainNode; url?: string }>();
  private imgs = new Map<string, HTMLImageElement>();
  private luts = new Map<string, { tex: WebGLTexture; size: number } | "loading" | "bad">();
  private actx: AudioContext | null = null; private master: GainNode | null = null;
  private ls = new Set<() => void>(); private raf = 0; private last = 0; private drawnV = -1; private drawnT = -1; private settle = 0;
  private duckSpans: [number, number][] = []; private duckKey = "";
  volume = 1; loop = false; maxW = 1280;
  /** a look at something before it is added (an effect, a look): the project as it would be — drawn only, never saved */
  override: ((p: Project) => Project) | null = null;

  constructor(public editor: Editor, canvas: HTMLCanvasElement) {
    this.comp = new Compositor(canvas);
    this.resize(); this.tick = this.tick.bind(this); this.raf = requestAnimationFrame(this.tick);
  }
  setOverride(f: ((p: Project) => Project) | null) { this.override = f; this.drawnV = -1; }
  onClock(f: () => void) { this.ls.add(f); return () => { this.ls.delete(f); }; }
  private emitClock() { this.ls.forEach((f) => f()); }
  get project(): Project { return this.editor.project; }
  // the drawing size: the project's frame scaled to fit `maxW` (the preview is a smaller copy; the export uses the full size)
  resize() { const p = this.project, k = Math.min(1, this.maxW / Math.max(p.width, p.height)); this.comp.resize(Math.round(p.width * k / 2) * 2, Math.round(p.height * k / 2) * 2); this.drawnV = -1; }

  async audio(): Promise<AudioContext | null> {
    if (!this.actx) { try { this.actx = new AudioContext({ latencyHint: "interactive" }); this.master = this.actx.createGain(); this.master.connect(this.actx.destination); } catch { return null; } }
    if (this.actx.state === "suspended") await this.actx.resume().catch(() => undefined);
    for (const e of this.els.values()) if (!e.node && this.master) { try { e.node = this.actx.createMediaElementSource(e.el); e.gain = this.actx.createGain(); e.node.connect(e.gain).connect(this.master); } catch { /* */ } }
    return this.actx;
  }
  async play() { if (this.clock.playing) return; await this.audio(); const d = duration(this.project); if (this.clock.t >= d - 0.02) this.clock.t = 0; this.clock.playing = true; this.last = performance.now(); this.emitClock(); }
  pause() { if (!this.clock.playing) return; this.clock.playing = false; for (const e of this.els.values()) e.el.pause(); this.editor.playhead = this.clock.t; this.emitClock(); this.drawnT = -1; }
  toggle() { this.clock.playing ? this.pause() : void this.play(); }
  seek(t: number) { this.clock.t = Math.max(0, Math.min(duration(this.project) || 0, t)); this.editor.playhead = this.clock.t; this.settle = performance.now() + 600; this.emitClock(); }
  step(frames: number) { this.pause(); this.seek(this.clock.t + frames / this.project.fps); }

  private tick(now: number) {
    this.raf = requestAnimationFrame(this.tick);
    const p = this.project, d = duration(p);
    if (this.clock.playing) {
      const waiting = this.syncMedia(true);
      const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
      this.clock.buffering = waiting;
      if (!waiting) this.clock.t += dt;
      if (this.clock.t >= d) { if (this.loop && d > 0) this.clock.t = 0; else { this.clock.t = d; this.pause(); } }
      this.emitClock();
    } else this.syncMedia(false);
    const changed = this.editor.version !== this.drawnV || Math.abs(this.clock.t - this.drawnT) > 1e-6;
    if (this.clock.playing || changed || now < this.settle || this.override) {
      this.drawnV = this.editor.version; this.drawnT = this.clock.t;
      const shown = this.override ? this.override(p) : p;
      try { drawMoment(this.comp, shown, this.clock.t, (c, a, s) => this.frame(c, a, s), (id) => this.lut(id)); } catch (e) { console.warn("draw", e); }
    }
  }
  // keep each media element at the clock; returns true while one is still loading (the clock waits)
  private syncMedia(playing: boolean): boolean {
    const p = this.project, t = this.clock.t; let waiting = false; const active = new Set<string>();
    const ducking = p.ducking.enabled ? this.spans(p) : null;
    for (const L of soundsAt(p, t).concat(this.visibleVideos(p, t))) {
      const c = L.clip as MediaClip; if (active.has(c.id)) continue; active.add(c.id);
      const a = p.assets[c.asset]; if (!a || a.kind === "image") continue;
      const e = this.element(c, a); if (!e) { waiting = playing; continue; }
      const el = e.el, src = sourceTime(c, L.local, srcLimit(p, c));
      const audible = !L.track.muted && soundsAt(p, t).some((x) => x.clip.id === c.id);
      let g = audible ? gainAt(c, Math.max(0, Math.min(c.dur, L.local))) : 0;
      if (ducking && !p.ducking.voiceTracks.includes(L.track.id)) g *= duckGain(ducking, t, p.ducking.amount);
      if (e.gain) e.gain.gain.value = Math.max(0, Math.min(4, g * this.volume)); else el.volume = Math.max(0, Math.min(1, g * this.volume));
      if (playing && !c.reverse && c.freeze == null) {
        const rate = Math.max(0.0625, Math.min(16, c.speed));
        if (Math.abs(el.playbackRate - rate) > 1e-3) el.playbackRate = rate;
        if (Math.abs(el.currentTime - src) > 0.25 || el.paused) { if (Math.abs(el.currentTime - src) > 0.05) el.currentTime = src; el.play().catch(() => undefined); }
        if (el.readyState < 3 && !el.ended) waiting = true;
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - src) > 0.5 / p.fps && !el.seeking) el.currentTime = src;
      }
    }
    for (const [id, e] of this.els) if (!active.has(id) && !e.el.paused) e.el.pause();
    return waiting;
  }
  private visibleVideos(p: Project, t: number) { return layersAt(p, t, ["video"]).filter((l) => l.clip.type === "media"); }
  private element(c: MediaClip, a: Asset) {
    let e = this.els.get(c.id);
    if (e && e.asset !== a.id) { e.el.pause(); this.els.delete(c.id); e = undefined; }
    if (!e) {
      const el = (a.kind === "audio" ? new Audio() : document.createElement("video")) as El;
      el.preload = "auto"; el.crossOrigin = "anonymous"; (el as HTMLVideoElement).playsInline = true; el.muted = false;
      e = { el, asset: a.id }; this.els.set(c.id, e); const rec = e;
      urlOf(a).then((u) => { if (u) { el.src = u; rec.url = u; } });
      if (this.actx && this.master) { try { rec.node = this.actx.createMediaElementSource(el); rec.gain = this.actx.createGain(); rec.node.connect(rec.gain).connect(this.master); } catch { /* the element plays on its own */ } }
      el.addEventListener("seeked", () => { this.settle = performance.now() + 120; this.drawnT = -1; });
      el.addEventListener("loadeddata", () => { this.drawnT = -1; });
    }
    return e.el.src ? e : null;
  }
  private frame(c: MediaClip, a: Asset, _s: number): Frame | null {
    if (a.kind === "image") {
      let im = this.imgs.get(a.id);
      if (!im) { im = new Image(); im.crossOrigin = "anonymous"; this.imgs.set(a.id, im); const I = im; urlOf(a).then((u) => { if (u) { I.onload = () => { this.drawnV = -1; }; I.src = u; } }); }
      return im.complete && im.naturalWidth ? { src: im, w: im.naturalWidth, h: im.naturalHeight, key: "i:" + a.id, dynamic: false } : null;
    }
    const e = this.els.get(c.id); const v = e?.el as HTMLVideoElement | undefined;
    if (!v || v.readyState < 2 || !v.videoWidth) { if (!e) this.element(c, a); return null; }
    return { src: v, w: v.videoWidth, h: v.videoHeight, key: "v:" + c.id, dynamic: true };
  }
  private lut(id: string) {
    const L = this.luts.get(id); if (L && L !== "loading" && L !== "bad") return L; if (L) return null;
    const a = this.project.assets[id]; if (!a) return null; this.luts.set(id, "loading");
    fileOf(a).then(async (b) => { try { const { size, data } = parseCube(await b!.text()); this.luts.set(id, { tex: this.comp.makeLut(data, size), size }); this.drawnV = -1; } catch { this.luts.set(id, "bad"); } });
    return null;
  }
  // the voice tracks' speech spans on the timeline (from their waveforms) — the music is lowered under them
  private spans(p: Project): [number, number][] {
    const key = p.ducking.voiceTracks.join() + ":" + this.editor.version; if (key === this.duckKey) return this.duckSpans;
    const out: [number, number][] = [];
    for (const t of p.tracks) {
      if (!p.ducking.voiceTracks.includes(t.id)) continue;
      for (const c of t.clips) {
        if (c.type !== "media") continue; const a = p.assets[c.asset]; if (!a?.waveform || !a.duration) continue;
        const per = a.duration / a.waveform.length; let on = -1;
        for (let i = 0; i <= a.waveform.length; i++) {
          const loud = i < a.waveform.length && a.waveform[i] > 0.08, st = i * per;
          const tl = c.start + (st - c.in) / c.speed;
          if (loud && on < 0) on = tl; if (!loud && on >= 0) { if (tl > c.start && on < clipEnd(c)) out.push([Math.max(c.start, on), Math.min(clipEnd(c), tl)]); on = -1; }
        }
      }
    }
    this.duckKey = key; this.duckSpans = out; return out;
  }
  forgetClip(id: string) { const e = this.els.get(id); if (e) { e.el.pause(); e.el.removeAttribute("src"); this.els.delete(id); } }
  prune() { for (const id of [...this.els.keys()]) if (!findClip(this.project, id)) this.forgetClip(id); }
  dispose() { cancelAnimationFrame(this.raf); for (const id of [...this.els.keys()]) this.forgetClip(id); this.comp.dispose(); this.actx?.close().catch(() => undefined); }
}
