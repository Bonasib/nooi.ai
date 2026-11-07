// (v245) The edit for another editor: Final Cut Pro / DaVinci Resolve / Premiere (FCPXML 1.10), any editor (a CMX3600 EDL of the
// main track) and Shotcut / Kdenlive (MLT XML). The cuts, the order, the tracks, the speed and the markers go across; the media is
// referred to by its file name (keep the files next to the exported file). Our own code from the formats' public descriptions.
import type { Asset, MediaClip, Project, Track } from "./schema";
import * as T from "./timeline";
import { spineOf } from "./anchors";

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const EXT: Record<string, string> = { "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
/** the file name an asset is expected under, beside the exported file */
export function fileName(a: Asset): string {
  const base = String(a.name || a.id).replace(/[\\/:*?"<>|]+/g, "_").trim() || a.id;
  if (/\.[a-z0-9]{2,4}$/i.test(base)) return base;
  const fromSrc = /\.([a-z0-9]{2,4})(?:[?#]|$)/i.exec(a.src || ""); return base + (EXT[a.mime || ""] || (fromSrc ? "." + fromSrc[1].toLowerCase() : a.kind === "audio" ? ".wav" : a.kind === "image" ? ".png" : ".mp4"));
}
const media = (p: Project, tr: Track) => tr.clips.filter((c) => c.type === "media" && p.assets[(c as MediaClip).asset] && p.assets[(c as MediaClip).asset].kind !== "lut" && p.assets[(c as MediaClip).asset].kind !== "font") as MediaClip[];
const fpsOf = (p: Project) => Math.max(1, Math.round(p.export?.fps || p.fps || 30));
const fr = (s: number, fps: number) => Math.max(0, Math.round(s * fps));
export const mainOf = (p: Project): Track | null => spineOf(p);

// ---- CMX3600 EDL (the main track's pictures and their sound)
export function tc(frames: number, fps: number) { const f = Math.max(0, Math.round(frames)), h = Math.floor(f / (3600 * fps)), m = Math.floor(f / (60 * fps)) % 60, s = Math.floor(f / fps) % 60, ff = f % fps; return [h, m, s, ff].map((v) => String(v).padStart(2, "0")).join(":"); }
export function toEDL(p: Project, title = p.name || "nooi"): string {
  const fps = fpsOf(p), tr = mainOf(p); const out = [`TITLE: ${String(title).replace(/[^\x20-\x7e]/g, "_").slice(0, 60)}`, "FCM: NON-DROP FRAME", ""];
  if (!tr) return out.join("\n"); let n = 0;
  for (const c of [...media(p, tr)].sort((a, b) => a.start - b.start)) {
    const a = p.assets[c.asset], reel = (fileName(a).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "AX").slice(0, 8);
    const sIn = fr(c.in, fps), len = fr(c.dur, fps), sOut = sIn + Math.max(1, fr(c.dur * c.speed, fps)), rIn = fr(c.start, fps);
    n++; const ch = a.kind === "image" ? "V    " : a.kind === "audio" ? "A    " : "AA/V ";
    out.push(`${String(n).padStart(3, "0")}  ${reel.padEnd(8)} ${ch} C        ${tc(sIn, fps)} ${tc(sOut, fps)} ${tc(rIn, fps)} ${tc(rIn + len, fps)}`);
    if (Math.abs(c.speed - 1) > 1e-3 || c.reverse) out.push(`M2   ${reel.padEnd(8)} ${((c.reverse ? -1 : 1) * c.speed * fps).toFixed(1).padStart(6, "0")}                ${tc(sIn, fps)}`);
    out.push(`* FROM CLIP NAME: ${fileName(a)}`, "");
  }
  for (const m of p.markers) out.push(`* MARKER ${tc(fr(m.t, fps), fps)} ${String(m.name || "").replace(/[\r\n]+/g, " ")}`);
  return out.join("\n") + "\n";
}

// ---- FCPXML 1.10 (Final Cut Pro, DaVinci Resolve, Premiere through its importer)
export function toFCPXML(p: Project, title = p.name || "nooi"): string {
  const fps = fpsOf(p), t = (s: number) => `${fr(s, fps)}/${fps}s`, used = new Map<string, string>(); let rid = 2;
  const all = p.tracks.flatMap((tr) => media(p, tr)); for (const c of all) if (!used.has(c.asset)) used.set(c.asset, "r" + rid++);
  const res = [`    <format id="r1" name="FFVideoFormat${p.height}p${fps}" frameDuration="1/${fps}s" width="${p.width}" height="${p.height}"/>`];
  for (const [id, r] of used) { const a = p.assets[id], d = a.duration || 10;
    res.push(`    <asset id="${r}" name="${esc(fileName(a))}" start="0s" duration="${t(a.kind === "image" ? 3600 : d)}" hasVideo="${a.kind !== "audio" ? 1 : 0}" hasAudio="${a.kind === "audio" || (a.kind === "video" && a.hasAudio !== false) ? 1 : 0}"${a.kind !== "audio" ? ' format="r1"' : ""}>`,
      `      <media-rep kind="original-media" src="./${esc(encodeURI(fileName(a)))}"/>`, `    </asset>`); }
  const clip = (c: MediaClip, lane?: number, offsetAt?: number) => { const a = p.assets[c.asset]; const speed = Math.abs(c.speed - 1) > 1e-3;
    const attrs = `ref="${used.get(c.asset)}"${lane ? ` lane="${lane}"` : ""} offset="${t(offsetAt ?? c.start)}" name="${esc(c.name || a.name)}" start="${t(c.in)}" duration="${t(c.dur)}"${a.kind !== "audio" ? ' format="r1"' : ""}${c.muted ? ' audioRole="dialogue" ' : ""}`;
    const inner: string[] = [];
    if (speed) inner.push(`<timeMap><timept time="0s" value="${t(c.in)}" interp="linear"/><timept time="${t(c.dur)}" value="${t(c.in + c.dur * c.speed)}" interp="linear"/></timeMap>`);
    if (Math.abs(c.volume - 1) > 1e-3) inner.push(`<adjust-volume amount="${(20 * Math.log10(Math.max(1e-4, c.volume))).toFixed(1)}dB"/>`);
    return inner.length ? `<asset-clip ${attrs}>${inner.join("")}</asset-clip>` : `<asset-clip ${attrs}/>`; };
  const main = mainOf(p); const spine: string[] = []; let at = 0;
  const lanes = p.tracks.filter((tr) => tr !== main && tr.kind !== "text"); const laneOf = new Map<Track, number>();
  lanes.forEach((tr) => { const vIdx = p.tracks.indexOf(tr), mIdx = main ? p.tracks.indexOf(main) : 0; laneOf.set(tr, tr.kind === "audio" ? -(lanes.filter((x) => x.kind === "audio").indexOf(tr) + 1) : Math.max(1, mIdx - vIdx)); });
  const connected = lanes.flatMap((tr) => media(p, tr).map((c) => ({ c, lane: laneOf.get(tr)! })));
  for (const c of main ? [...media(p, main)].sort((a, b) => a.start - b.start) : []) {
    if (c.start - at > 1 / fps / 2) { spine.push(`          <gap name="Gap" offset="${t(at)}" start="0s" duration="${t(c.start - at)}"/>`); }
    const mine = connected.filter((o) => o.c.start >= c.start - 1e-6 && o.c.start < T.clipEnd(c) - 1e-6);
    if (!mine.length) spine.push("          " + clip(c));
    else { const x = clip(c); const open = x.endsWith("/>") ? x.slice(0, -2) + ">" : x.slice(0, x.lastIndexOf("</asset-clip>"));
      spine.push("          " + open + mine.map((o) => clip(o.c, o.lane, c.in + (o.c.start - c.start) * c.speed)).join("") + "</asset-clip>"); for (const o of mine) connected.splice(connected.indexOf(o), 1); }
    at = T.clipEnd(c);
  }
  if (connected.length) { const end = Math.max(at, ...connected.map((o) => T.clipEnd(o.c))); spine.push(`          <gap name="Gap" offset="${t(at)}" start="0s" duration="${t(Math.max(1 / fps, end - at))}">` + connected.map((o) => clip(o.c, o.lane, o.c.start - at)).join("") + "</gap>"); }
  const marks = p.markers.map((m) => `<marker start="${t(m.t)}" duration="1/${fps}s" value="${esc(m.name || "Marker")}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10">\n  <resources>\n${res.join("\n")}\n  </resources>\n  <library>\n    <event name="${esc(title)}">\n      <project name="${esc(title)}">\n` +
    `        <sequence format="r1" duration="${t(T.duration(p))}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">\n          <spine>\n${spine.join("\n")}\n          </spine>${marks ? "\n          " + marks : ""}\n        </sequence>\n      </project>\n    </event>\n  </library>\n</fcpxml>\n`;
}

// ---- MLT XML (Shotcut, Kdenlive)
export function toMLT(p: Project, title = p.name || "nooi"): string {
  const fps = fpsOf(p), prods: string[] = [], lists: string[] = [], tracks: string[] = []; let k = 0;
  const order = [...p.tracks].reverse().filter((tr) => tr.kind !== "text" && media(p, tr).length);   // MLT lists the bottom track first
  order.forEach((tr, ti) => {
    const ents: string[] = []; let at = 0;
    for (const c of [...media(p, tr)].sort((a, b) => a.start - b.start)) {
      const a = p.assets[c.asset], id = "producer" + k++, len = Math.max(1, fr(c.dur * c.speed, fps)), sIn = fr(c.in, fps);
      const speed = Math.abs(c.speed - 1) > 1e-3; const res = speed ? `${c.speed.toFixed(4)}:${fileName(a)}` : fileName(a);
      prods.push(`  <producer id="${id}" in="0" out="${Math.max(len + sIn, fr(a.duration || c.in + c.dur * c.speed, fps)) - 1}">\n    <property name="resource">${esc(res)}</property>\n    <property name="mlt_service">${speed ? "timewarp" : a.kind === "image" ? "qimage" : "avformat"}</property>${speed ? `\n    <property name="warp_speed">${c.speed.toFixed(4)}</property>` : ""}\n    <property name="shotcut:caption">${esc(c.name || a.name)}</property>\n  </producer>`);
      const gap = fr(c.start - at, fps); if (gap > 0) ents.push(`    <blank length="${gap}"/>`);
      const pin = speed ? Math.round(sIn / c.speed) : sIn, pout = pin + fr(c.dur, fps) - 1;
      ents.push(`    <entry producer="${id}" in="${pin}" out="${Math.max(pin, pout)}"/>`); at = c.start + fr(c.dur, fps) / fps;
    }
    lists.push(`  <playlist id="playlist${ti}">\n    <property name="shotcut:name">${esc(tr.name)}</property>${tr.kind === "audio" ? '\n    <property name="shotcut:audio">1</property>' : '\n    <property name="shotcut:video">1</property>'}\n${ents.join("\n")}\n  </playlist>`);
    tracks.push(`    <track producer="playlist${ti}"${tr.kind === "audio" ? ' hide="video"' : ""}${tr.muted ? ' hide="audio"' : ""}/>`);
  });
  const [ax, ay] = ((): [number, number] => { const g = (a: number, b: number): number => (b ? g(b, a % b) : a); const d = g(p.width, p.height); return [p.width / d, p.height / d]; })();
  return `<?xml version="1.0" encoding="utf-8"?>\n<mlt LC_NUMERIC="C" version="7.0.0" title="${esc(title)}" producer="main_bin">\n  <profile description="${p.width}x${p.height} ${fps}fps" width="${p.width}" height="${p.height}" progressive="1" sample_aspect_num="1" sample_aspect_den="1" display_aspect_num="${ax}" display_aspect_den="${ay}" frame_rate_num="${fps}" frame_rate_den="1" colorspace="709"/>\n` +
    `${prods.join("\n")}\n${lists.join("\n")}\n  <tractor id="tractor0" title="${esc(title)}">\n${tracks.join("\n")}\n  </tractor>\n</mlt>\n`;
}
