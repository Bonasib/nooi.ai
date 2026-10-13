// Professional camera & studio media in. Browsers and phones can't play most of what cameras and studios record —
// ProRes, DNxHD/DNxHR, MXF (XDCAM, AVC-Intra), HEVC 10-bit, CineForm, AVCHD (.mts/.m2ts), MPEG-2, DV, HDV, Motion JPEG,
// camera RAW stills (CR2/CR3/NEF/ARW/RAF/ORF/RW2/PEF/SRW/DNG…), HEIC/HEIF, 16-bit TIFF, OpenEXR, DPX, PSD, TGA, HDR, and
// AIFF/CAF/24-32-bit and multichannel WAV/BWF, ALAC, AC-3/E-AC-3, DTS, WMA, AMR. So the server keeps the ORIGINAL (to
// download or hand to finishing tools) and makes an editing PROXY every browser plays — H.264 MP4 (1080p "fast" or up to
// 4K "full"), PNG/JPEG stills, MP3 audio — and reads the file's technical facts (codec, profile, bit depth, colour, HDR,
// frame rate, timecode, audio channels…). It runs in the background: POST returns at once, the page polls for progress.
//   POST /v1/media/ingest  (multipart "file", fields q=fast|full) → {id}
//   GET  /v1/media/ingest/:id → {status: "working"|"done"|"failed", progress, kind, url, original, meta, error}
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import multer from "multer";
import { requireUser } from "./auth.js";
import { uid } from "./store.js";
import { MEDIA_DIR, publicUrl } from "./media.js";

const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
export const RAW_EXT = ["cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "raf", "orf", "rw2", "rwl", "pef", "srw", "dng", "x3f", "3fr", "iiq", "erf", "kdc", "mrw", "mos", "mef"];
const IMG_EXT = ["heic", "heif", "hif", "avif", "tif", "tiff", "exr", "dpx", "psd", "psb", "tga", "hdr", "jxl", "jp2", "j2k", "bmp", "pcx", "sgi", "qoi", "pbm", "pgm", "ppm", "png", "jpg", "jpeg", "webp", "gif", ...RAW_EXT];
const AUD_EXT = ["wav", "bwf", "w64", "rf64", "aif", "aiff", "aifc", "caf", "ac3", "eac3", "ec3", "dts", "wma", "amr", "ape", "mka", "m4a", "alac", "flac", "mp3", "ogg", "opus", "au", "snd", "voc"];
const up = multer({ storage: multer.diskStorage({ destination: MEDIA_DIR, filename: (_, f, cb) => cb(null, uid() + "-orig" + (path.extname(f.originalname) || ".bin").toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8)) }), limits: { fileSize: 4 * 1024 ** 3 } });
const jobs = new Map();
let FILTERS = null;
const hasFilter = async (f) => { if (!FILTERS) { try { FILTERS = await run(FF(), ["-hide_banner", "-filters"], "text"); } catch { FILTERS = ""; } } return new RegExp("\\s" + f + "\\s").test(FILTERS); };
const which = (bin) => new Promise((res) => { const p = spawn("sh", ["-c", "command -v " + bin]); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", (c) => res(c === 0 && o.trim() ? o.trim() : null)); p.on("error", () => res(null)); });
function run(bin, args, out, onLine) {
  return new Promise((res, rej) => {
    const p = spawn(bin, args); const o = [], e = []; let buf = "";
    p.stdout.on("data", (d) => { if (onLine) { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); } } else o.push(d); });
    p.stderr.on("data", (d) => e.push(d)); p.on("error", rej);
    p.on("close", (c) => (c === 0 ? res(out === "text" ? Buffer.concat(o).toString() : null) : rej(new Error(path.basename(bin) + ": " + Buffer.concat(e).toString().trim().split("\n").slice(-2).join(" ").slice(0, 300)))));
  });
}
const num = (x) => { if (x == null) return null; if (typeof x === "string" && x.includes("/")) { const [a, b] = x.split("/").map(Number); return b ? a / b : null; } const n = +x; return isFinite(n) ? n : null; };
// bits per channel (what "10-bit" means to an editor), from the decoder or the pixel format
const bitsOf = (s) => { if (!s) return null; if (+s.bits_per_raw_sample) return +s.bits_per_raw_sample; const p = s.pix_fmt || "";
  if (/f32/.test(p)) return 32; if (/f16/.test(p)) return 16; if (/^(rgb|bgr)a?(48|64)/.test(p) || /^rgba64|^bgra64|^ya16|^gray16/.test(p)) return 16;
  const m = /(?:p|gray|gbrp|gbrap|x2rgb|x2bgr)(\d{1,2})(le|be)$/.exec(p); if (m) return +m[1]; return /^(yuvj?4\d\dp|nv12|nv21|rgb24|bgr24|rgba|bgra|argb|abgr|gray|pal8|gbrp)$/.test(p) ? 8 : null; };
const IMAGE_CODECS = new Set(["png", "mjpeg", "jpegls", "tiff", "exr", "dpx", "psd", "targa", "bmp", "pcx", "sgi", "webp", "gif", "jpeg2000", "hdr", "qoi", "pbm", "pgm", "ppm", "pam", "jpegxl", "photocd", "xbm", "xwd"]);
// the file's technical facts, in the words an editor or a colourist uses
export function describe(probe, ext) {
  const st = probe.streams || [], f = probe.format || {}, v = st.find((s) => s.codec_type === "video" && !(s.disposition && s.disposition.attached_pic)), a = st.find((s) => s.codec_type === "audio");
  const dur = num(f.duration) || num(v && v.duration) || num(a && a.duration) || 0, fps = v ? num(v.avg_frame_rate) || num(v.r_frame_rate) : null;
  const still = !!v && (IMAGE_CODECS.has(v.codec_name) || (v.codec_name === "hevc" && /heic|heif|hif/.test(ext))) && !a && (dur < 0.5 || !fps || +v.nb_frames <= 1);
  const tf = v && v.color_transfer, hdr = tf === "smpte2084" ? "HDR10 (PQ)" : tf === "arib-std-b67" ? "HLG" : null;
  const tc = (f.tags && (f.tags.timecode || f.tags.TIMECODE)) || (v && v.tags && v.tags.timecode) || (st.find((s) => s.tags && s.tags.timecode) || {}).tags?.timecode || null;
  return {
    kind: v && !still ? "video" : v ? "image" : a ? "audio" : null,
    container: f.format_long_name || f.format_name || ext, size: +f.size || null, dur: +dur.toFixed(3),
    video: v ? { codec: v.codec_long_name || v.codec_name, id: v.codec_name, profile: v.profile || null, w: v.width, h: v.height, sar: v.sample_aspect_ratio && v.sample_aspect_ratio !== "1:1" && v.sample_aspect_ratio !== "0:1" ? v.sample_aspect_ratio : null,
      fps: fps && !still ? +fps.toFixed(3) : null, bits: bitsOf(v), pixfmt: v.pix_fmt || null, interlaced: !!(v.field_order && !["progressive", "unknown"].includes(v.field_order)), color: { primaries: v.color_primaries || null, transfer: tf || null, space: v.color_space || null, range: v.color_range || null }, hdr, bitrate: +v.bit_rate || null } : null,
    audio: a ? { codec: a.codec_long_name || a.codec_name, id: a.codec_name, ch: a.channels || null, layout: a.channel_layout || null, sr: +a.sample_rate || null, bits: +(a.bits_per_raw_sample || a.bits_per_sample) || null, tracks: st.filter((s) => s.codec_type === "audio").length } : null,
    timecode: tc,
  };
}
// camera RAW: the biggest JPEG preview the camera embedded (every RAW format keeps one; full size on most bodies)
export function rawPreview(buf) {
  let best = null;
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] !== 0xff || buf[i + 1] !== 0xd8 || buf[i + 2] !== 0xff) continue;
    // walk the JPEG's segments to its end (skips thumbnails nested inside EXIF correctly)
    let j = i + 2, ok = false;
    while (j < buf.length - 4) {
      if (buf[j] !== 0xff) break; const m = buf[j + 1];
      if (m === 0xd9) { ok = true; j += 2; break; }
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { j += 2; continue; }
      const len = buf.readUInt16BE(j + 2); if (len < 2) break;
      if (m === 0xda) { j += 2 + len; while (j < buf.length - 1 && !(buf[j] === 0xff && buf[j + 1] !== 0 && !(buf[j + 1] >= 0xd0 && buf[j + 1] <= 0xd7))) j++; continue; }
      j += 2 + len;
    }
    if (ok && (!best || j - i > best[1] - best[0])) best = [i, j];
    if (ok) i = j - 1;
  }
  return best && best[1] - best[0] > 4096 ? buf.subarray(best[0], best[1]) : null;
}
const outName = (ext) => { const n = uid() + ext; return { name: n, file: path.join(MEDIA_DIR, n), url: publicUrl(n) }; };
async function videoProxy(J, inp, d, q) {
  const o = outName(".mp4"), maxW = q === "full" ? 3840 : 1920, V = d.video || {}, hdr = !!V.hdr, zs = hdr && (await hasFilter("zscale")) && (await hasFilter("tonemap"));
  const vf = [V.interlaced ? "yadif=deint=interlaced" : null, V.sar ? "scale=trunc(iw*sar/2)*2:ih,setsar=1" : null,
    zs ? "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv" : null,
    `scale='min(${maxW},iw)':-2:flags=lanczos`, "format=yuv420p"].filter(Boolean).join(",");
  const args = ["-v", "error", "-y", "-i", inp, "-map", "0:v:0", "-map", "0:a:0?", "-vf", vf, "-c:v", "libx264", "-preset", q === "full" ? "fast" : "veryfast", "-crf", q === "full" ? "18" : "21", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000", "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", o.file];
  await run(FF(), args, null, (l) => { const m = /^out_time_(?:us|ms)=(\d+)/.exec(l); if (m && d.dur) J.progress = Math.min(.99, +m[1] / 1e6 / d.dur); });
  return o;
}
async function imageProxy(J, inp, ext, d) {
  const o = outName(".png");
  if (RAW_EXT.includes(ext)) {   // camera RAW → its embedded preview (or ImageMagick/dcraw when the server has them)
    const pv = rawPreview(fs.readFileSync(inp)); if (pv) { const j = outName(".jpg"); fs.writeFileSync(j.file, pv);
      let w = null, h = null; try { const p = JSON.parse(await run(FP(), ["-v", "error", "-print_format", "json", "-show_streams", j.file], "text")); const s0 = (p.streams || [])[0] || {}; w = s0.width || null; h = s0.height || null; } catch {}
      d.video = { codec: "Camera RAW (" + ext.toUpperCase() + ") · the camera's full preview", id: "raw", w, h, bits: null, fps: null, color: {} }; return j; }
    const im = (await which("magick")) || (await which("convert")); if (im) { await run(im, [inp + "[0]", "-auto-orient", "-resize", "4096x4096>", o.file]); return o; }
    throw new Error("This RAW file has no preview the server can read — install ImageMagick with RAW support (apt install imagemagick)");
  }
  if (["heic", "heif", "hif"].includes(ext)) {   // iPhone / Android HEIC: libheif knows the tile grid
    const hc = await which("heif-convert"); if (hc) { try { await run(hc, ["-q", "92", inp, o.file]); if (fs.existsSync(o.file)) return o; } catch {} }
    const im = (await which("magick")) || (await which("convert")); if (im) { try { await run(im, [inp + "[0]", "-auto-orient", o.file]); if (fs.existsSync(o.file)) return o; } catch {} }
  }
  try { await run(FF(), ["-v", "error", "-y", ...(ext === "exr" ? ["-apply_trc", "iec61966_2_1"] : []), "-i", inp, "-frames:v", "1", "-vf", "scale='min(4096,iw)':-2:flags=lanczos", o.file]); if (fs.existsSync(o.file) && fs.statSync(o.file).size > 100) return o; } catch (e) { J.why = e.message; }
  const im = (await which("magick")) || (await which("convert")); if (im) { await run(im, [inp + "[0]", "-auto-orient", "-resize", "4096x4096>", o.file]); return o; }
  throw new Error("This picture format can't be read on the server" + (J.why ? " (" + J.why + ")" : ""));
}
async function audioProxy(J, inp, d) {
  const o = outName(".mp3"), sr = (d.audio && d.audio.sr) || 48000;
  await run(FF(), ["-v", "error", "-y", "-i", inp, "-map", "0:a:0", "-c:a", "libmp3lame", "-b:a", "256k", "-ar", String(sr >= 48000 ? 48000 : 44100), ...((d.audio && d.audio.ch > 2) || !(d.audio && d.audio.ch) ? ["-ac", "2"] : []), "-progress", "pipe:1", "-nostats", o.file], null,
    (l) => { const m = /^out_time_(?:us|ms)=(\d+)/.exec(l); if (m && d.dur) J.progress = Math.min(.99, +m[1] / 1e6 / d.dur); });
  return o;
}
async function process_(J, file, ext, q) {
  let d = { kind: null };
  try { d = describe(JSON.parse(await run(FP(), ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], "text")), ext); } catch (e) { J.why = e.message; }
  if (!d.kind) d.kind = RAW_EXT.includes(ext) || IMG_EXT.includes(ext) ? "image" : AUD_EXT.includes(ext) ? "audio" : null;
  if (!d.kind) throw new Error("This doesn't look like a video, picture or sound file" + (J.why ? " (" + J.why.slice(0, 160) + ")" : ""));
  J.kind = d.kind; J.meta = d;
  const o = d.kind === "video" ? await videoProxy(J, file, d, q) : d.kind === "image" ? await imageProxy(J, file, ext, d) : await audioProxy(J, file, d);
  J.url = o.url; J.status = "done"; J.progress = 1;
}
export function registerIngest(app) {
  app.post("/v1/media/ingest", requireUser, up.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Choose a file" });
    const id = uid(), ext = path.extname(req.file.originalname || "").slice(1).toLowerCase(), q = req.body && req.body.q === "full" ? "full" : "fast";
    const J = { id, uid: req.user.uid, status: "working", progress: 0, name: String(req.file.originalname || "").slice(0, 120), original: publicUrl(req.file.filename), created: Date.now() }; jobs.set(id, J);
    process_(J, req.file.path, ext, q).catch((e) => { J.status = "failed"; J.error = e.message; });
    for (const [k, v] of jobs) if (Date.now() - v.created > 6 * 3600e3) jobs.delete(k);
    res.json({ id });
  });
  app.get("/v1/media/ingest/:id", requireUser, (req, res) => {
    const J = jobs.get(req.params.id); if (!J || J.uid !== req.user.uid) return res.status(404).json({ error: "Not found — upload the file again" });
    const { uid: _u, ...pub } = J; res.json(pub);
  });
}
