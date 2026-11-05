// A project → one FFmpeg command (CPU, no GPU): used by the render service on the VPS and by the desktop app's own FFmpeg.
// What it draws: media clips (trim, speed, reverse, freeze, crop, flip, scale/position/rotation, opacity, fades, exposure/contrast/
// saturation/temperature, .cube LUTs, mono/sepia/invert/blur/vignette), titles as pictures the editor drew (correct Arabic joining),
// nooi Motion graphics as videos the editor drew frame by frame (v228), colour keys and cut-outs see-through (v234),
// transitions as cross-fades at the cut, and the sound (volume, fades, speed, mute/solo, ducking by a fixed amount under voices).
// Keyframes are sampled at their values at the clip's start (animated keyframes, text animations and the other effects are drawn by
// the editor's own export — the server is the fallback when a device can't encode).
import { clipEnd, duration } from "./timeline";
import type { MediaClip, Project, TextClip } from "./schema";
import { keyOf, screenOf } from "./key";

// motions: a nooi Motion graphic drawn by the editor frame by frame into a video with its colour on top (over black) and its
// transparency as grey below it (any codec carries it); here the two halves become one see-through layer again
export interface RenderInput { project: Project; media: Record<string, string>; texts?: Record<string, string>; luts?: Record<string, string>; motions?: Record<string, string>;
  out: string; format: "mp4" | "webm" | "mov" | "gif" | "mp3" | "wav"; width: number; height: number; fps: number; quality?: "high" | "medium" | "low"; range?: [number, number] }
export interface Compiled { args: string[]; seconds: number; inputs: string[] }

const n = (x: number, d = 4) => String(Math.round(x * 10 ** d) / 10 ** d);
const even = (x: number) => Math.max(2, Math.round(x / 2) * 2);
function atempo(s: number): string { const out: string[] = []; let r = s; while (r > 2) { out.push("atempo=2"); r /= 2; } while (r < 0.5) { out.push("atempo=0.5"); r /= 0.5; } out.push("atempo=" + n(r)); return out.join(","); }

export function compile(R: RenderInput): Compiled {
  const p = R.project, [t0, t1] = R.range || [0, duration(p)], secs = Math.max(0.1, t1 - t0), W = even(R.width), H = even(R.height), fps = R.fps;
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error", "-nostdin"]; const inputs: string[] = []; const fv: string[] = []; const fa: string[] = [];
  const input = (path: string, pre: string[] = []) => { args.push(...pre, "-i", path); inputs.push(path); return inputs.length - 1; };
  const bg = p.background && /^#[0-9a-f]{6}$/i.test(p.background) ? p.background.slice(1) : "000000";
  fv.push(`color=c=0x${bg}:s=${W}x${H}:r=${fps}:d=${n(secs)}[base0]`);
  let base = "base0", k = 0;
  const solo = p.tracks.some((t) => t.solo);
  const voices = p.ducking.enabled ? p.tracks.filter((t) => p.ducking.voiceTracks.includes(t.id)).flatMap((t) => t.clips.map((c) => [c.start, clipEnd(c)] as [number, number])) : [];
  // pictures: the bottom track first
  for (let ti = p.tracks.length - 1; ti >= 0; ti--) {
    const tr = p.tracks[ti]; if (tr.hidden || tr.kind === "audio") continue;
    for (const c of tr.clips) {
      const s0 = Math.max(c.start, t0), s1 = Math.min(clipEnd(c), t1); if (s1 <= s0) continue;
      const trIn = p.transitions.find((x) => x.b === c.id), trOut = p.transitions.find((x) => x.a === c.id);
      const opacity = c.keyframes.opacity?.[0]?.v ?? c.opacity, scale = c.keyframes.scale?.[0]?.v ?? c.transform.scale, rot = c.keyframes.rotation?.[0]?.v ?? c.transform.rotation;
      const x = c.keyframes.x?.[0]?.v ?? c.transform.x, y = c.keyframes.y?.[0]?.v ?? c.transform.y;
      const lbl = "v" + k++; const chain: string[] = [];
      let src: number, from = "";
      if (c.type === "text" && (c as TextClip).motion) {
        const mv = R.motions?.[c.id]; if (!mv) continue;
        src = input(mv, ["-ss", n(Math.max(0, s0 - c.start)), "-t", n(s1 - s0 + 0.05)]); const mk = "m" + k;
        fv.push(`[${src}:v]split[${mk}a][${mk}b]`, `[${mk}a]crop=iw:ih/2:0:0,format=gbrp[${mk}c]`, `[${mk}b]crop=iw:ih/2:0:ih/2,format=gray[${mk}m]`);
        fv.push(`[${mk}c][${mk}m]alphamerge,unpremultiply=inplace=1[${mk}]`); from = `[${mk}]`;
        chain.push("setpts=PTS-STARTPTS", `fps=${fps}`, `scale=${W}:${H}`, "format=rgba");
        if (scale !== 1) chain.push(`scale=iw*${n(scale)}:ih*${n(scale)}`);
      } else if (c.type === "text") {
        const png = R.texts?.[c.id]; if (!png) continue;
        src = input(png, ["-loop", "1", "-framerate", String(fps), "-t", n(s1 - s0)]);
        chain.push(`scale=${W}:${H}`, "format=rgba");
        if (scale !== 1) chain.push(`scale=iw*${n(scale)}:ih*${n(scale)}`);
        const ti0 = Math.min((c as TextClip).animIn.dur, (s1 - s0) / 2), to0 = Math.min((c as TextClip).animOut.dur, (s1 - s0) / 2);
        if (ti0 > 0 && (c as TextClip).animIn.type !== "none") chain.push(`fade=t=in:st=0:d=${n(ti0)}:alpha=1`);
        if (to0 > 0 && (c as TextClip).animOut.type !== "none") chain.push(`fade=t=out:st=${n(s1 - s0 - to0)}:d=${n(to0)}:alpha=1`);
      } else {
        const m = c as MediaClip, a = p.assets[m.asset], path = R.media[m.asset]; if (!a || !path || a.kind === "audio") continue;
        const local0 = s0 - c.start, time: string[] = [], geom: string[] = [], colour: string[] = [];
        if (a.kind === "image" || m.freeze != null) {
          src = input(path, a.kind === "image" ? ["-loop", "1", "-framerate", String(fps), "-t", n(s1 - s0)] : ["-ss", n(m.freeze ?? 0), "-t", "0.1"]);
          if (m.freeze != null) time.push("trim=end_frame=1", `loop=loop=-1:size=1`, `trim=duration=${n(s1 - s0)}`, "setpts=N/" + fps + "/TB");
        } else {
          const srcA = m.reverse ? m.in + (m.dur - (s1 - c.start)) * m.speed : m.in + local0 * m.speed, len = (s1 - s0) * m.speed;
          src = input(path, ["-ss", n(Math.max(0, srcA)), "-t", n(len + 0.05)]);
          if (m.reverse) time.push("reverse");
          time.push(`setpts=(PTS-STARTPTS)/${n(m.speed)}`, `fps=${fps}`);
        }
        const [cl, ct, cr, cb] = m.transform.crop; if (cl || ct || cr || cb) geom.push(`crop=iw*${n(1 - cl - cr)}:ih*${n(1 - ct - cb)}:iw*${n(cl)}:ih*${n(ct)}`);
        if (m.transform.flipH) geom.push("hflip"); if (m.transform.flipV) geom.push("vflip");
        geom.push(`scale=w='if(gt(iw/ih,${W}/${H}),${W},-2)':h='if(gt(iw/ih,${W}/${H}),-2,${H})'`);
        if (scale !== 1) geom.push(`scale=iw*${n(scale)}:-2`);
        const cc = m.color;
        if (cc.exposure || cc.contrast || cc.saturation) colour.push(`eq=brightness=${n(cc.exposure * 0.25)}:contrast=${n(1 + cc.contrast)}:saturation=${n(Math.max(0, 1 + cc.saturation))}`);
        if (cc.temperature) colour.push(`colortemperature=temperature=${Math.round(6500 - cc.temperature * 3000)}`);
        if (m.lut && R.luts?.[m.lut.asset]) colour.push(`lut3d=file='${R.luts[m.lut.asset].replace(/'/g, "")}'`);
        for (const e of m.effects) { if (!e.enabled) continue; const am = +(e.params.amount ?? 0.5);
          if (e.type === "mono") colour.push(`hue=s=${n(1 - am)}`); else if (e.type === "sepia") colour.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131");
          else if (e.type === "invert") colour.push("negate"); else if (e.type === "blur") colour.push(`gblur=sigma=${n(am * 12)}`); else if (e.type === "vignette") colour.push(`vignette=angle=${n(0.3 + am * 0.6)}`); }
        // (v234) a see-through part: a cut-out's mask (the bottom half), a colour key, or a picture's own transparency — made on a
        // copy of the picture beside the colour filters (which don't carry transparency), then joined back to it
        const key = keyOf(m), cut = a.alpha === "stacked" && a.kind === "video", own = a.kind === "image" && colour.length > 0;
        if (cut || key || own) {
          const mk = "k" + k;
          fv.push(`[${src}:v]${[...time, ...(own ? ["format=rgba"] : [])].join(",") || "null"},split[${mk}a][${mk}b]`);
          const spill = key && key.spill > 0 && screenOf(key.color) ? [`despill=type=${screenOf(key.color) === 1 ? "green" : "blue"}:mix=0.5:${screenOf(key.color) === 1 ? "green" : "blue"}=${n(-key.spill)}`] : [];
          fv.push(`[${mk}a]${[...(cut ? ["crop=iw:ih/2:0:0"] : []), ...geom, ...spill, ...colour, "format=rgba"].join(",")}[${mk}c]`);
          const mask = cut ?   // (a cut-out uses its own mask; a key on top of it is drawn by the editor's own export)
            ["crop=iw:ih/2:0:ih/2", ...geom, "format=gray"] : key ? [...geom, "format=yuva444p", `chromakey=0x${key.color.slice(1).toUpperCase()}:${n(key.sim)}:${n(key.soft)}`, "alphaextract"] : [...geom, "alphaextract"];
          fv.push(`[${mk}b]${mask.join(",")}[${mk}m]`, `[${mk}c][${mk}m]alphamerge[${mk}]`); from = `[${mk}]`;
        } else chain.push(...time, ...geom, ...colour, "format=rgba");
        const fi = trIn ? trIn.dur / 2 : m.fadeIn, fo = trOut ? trOut.dur / 2 : m.fadeOut;
        if (fi > 0 && s0 === c.start) chain.push(`fade=t=in:st=0:d=${n(fi)}:alpha=${trIn || from ? 1 : 0}`);
        if (fo > 0 && s1 === clipEnd(c)) chain.push(`fade=t=out:st=${n(s1 - s0 - fo)}:d=${n(fo)}:alpha=${trOut || from ? 1 : 0}`);
      }
      if (rot) chain.push(`rotate=${n((rot * Math.PI) / 180)}:c=none:ow=rotw(${n((rot * Math.PI) / 180)}):oh=roth(${n((rot * Math.PI) / 180)})`);
      if (opacity < 1) chain.push(`colorchannelmixer=aa=${n(opacity)}`);
      chain.push(`setpts=PTS-STARTPTS+${n(s0 - t0)}/TB`);
      fv.push(`${from || `[${src}:v]`}${chain.join(",")}[${lbl}]`);
      const nb = "base" + k;
      fv.push(`[${base}][${lbl}]overlay=x=(W-w)/2+${n(x * W)}:y=(H-h)/2+${n(y * H)}:eof_action=pass:enable='between(t,${n(s0 - t0)},${n(s1 - t0)})'[${nb}]`);
      base = nb;
    }
  }
  // sound
  const sounds: string[] = []; let ak = 0;
  if (R.format !== "gif") for (const tr of p.tracks) {
    if (tr.kind === "text" || tr.muted || (solo && !tr.solo)) continue;
    for (const c of tr.clips) {
      if (c.type !== "media" || c.muted || c.freeze != null) continue; const a = p.assets[c.asset], path = R.media[c.asset]; if (!a || !path || a.kind === "image" || a.hasAudio === false) continue;
      const s0 = Math.max(c.start, t0), s1 = Math.min(clipEnd(c), t1); if (s1 <= s0) continue;
      const local0 = s0 - c.start, srcA = c.reverse ? c.in + (c.dur - (s1 - c.start)) * c.speed : c.in + local0 * c.speed;
      const idx = input(path, ["-ss", n(Math.max(0, srcA)), "-t", n((s1 - s0) * c.speed + 0.05)]);
      const ch: string[] = ["aresample=48000", "aformat=channel_layouts=stereo"]; if (c.reverse) ch.push("areverse");
      if (c.speed !== 1) ch.push(atempo(c.speed));
      let vol = c.keyframes.volume?.[0]?.v ?? c.volume; if (voices.length && !p.ducking.voiceTracks.includes(tr.id)) {
        const dk = voices.filter(([va, vb]) => vb > s0 && va < s1).map(([va, vb]) => `between(t,${n(Math.max(0, va - s0))},${n(vb - s0)})`).join("+");
        ch.push(`volume=${n(vol)}`); if (dk) ch.push(`volume='if(${dk},${n(1 - p.ducking.amount)},1)':eval=frame`); vol = 1;
      } else ch.push(`volume=${n(vol)}`);
      if (c.fadeIn > 0 && s0 === c.start) ch.push(`afade=t=in:st=0:d=${n(c.fadeIn)}`);
      if (c.fadeOut > 0 && s1 === clipEnd(c)) ch.push(`afade=t=out:st=${n(s1 - s0 - c.fadeOut)}:d=${n(c.fadeOut)}`);
      ch.push(`atrim=duration=${n(s1 - s0)}`, `adelay=${Math.round((s0 - t0) * 1000)}:all=1`);
      fa.push(`[${idx}:a]${ch.join(",")}[a${ak}]`); sounds.push(`[a${ak++}]`);
    }
  }
  const graph: string[] = [...(R.format === "mp3" || R.format === "wav" ? [] : fv)];
  const vout = R.format === "gif" ? "vgif" : "vout";
  if (R.format !== "mp3" && R.format !== "wav") {
    if (R.format === "gif") graph.push(`[${base}]fps=${Math.min(15, fps)},scale=${Math.min(W, 480)}:-2:flags=lanczos,split[g1][g2]`, `[g1]palettegen=stats_mode=diff[pal]`, `[g2][pal]paletteuse=dither=bayer:bayer_scale=3[${vout}]`);
    else graph.push(`[${base}]format=yuv420p[${vout}]`);
  }
  graph.push(...fa);
  if (sounds.length) graph.push(`${sounds.join("")}amix=inputs=${sounds.length}:duration=longest:normalize=0,apad,atrim=duration=${n(secs)}[aout]`);
  else if (R.format === "mp3" || R.format === "wav" || R.format !== "gif") { graph.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${n(secs)}[aout]`); }
  args.push("-filter_complex", graph.join(";"));
  const crf = { high: [18, 30], medium: [21, 33], low: [26, 38] }[R.quality || "high"];
  if (R.format === "gif") args.push("-map", `[${vout}]`, "-loop", "0");
  else if (R.format === "mp3") args.push("-map", "[aout]", "-c:a", "libmp3lame", "-b:a", "192k");
  else if (R.format === "wav") args.push("-map", "[aout]", "-c:a", "pcm_s16le");
  else {
    args.push("-map", `[${vout}]`, "-map", "[aout]", "-r", String(fps));
    if (R.format === "webm") args.push("-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(crf[1]), "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-c:a", "libopus", "-b:a", "128k");
    else if (R.format === "mov") args.push("-c:v", "prores_ks", "-profile:v", "2", "-pix_fmt", "yuv422p10le", "-c:a", "pcm_s16le");
    else args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf[0]), "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "160k");
  }
  args.push("-t", n(secs), R.out);
  return { args, seconds: secs, inputs };
}
