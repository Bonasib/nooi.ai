// v202: two export paths the big tools have and the browser alone can't make.
//  · A transparent render (titles, lower thirds, stickers over nothing) — the page draws every frame with the clips hidden and sends
//    them as WebP pictures with alpha plus the mixed sound as WAV in one body; ffmpeg here writes a WebM (VP9, yuva420p — browsers,
//    OBS, web pages) or a ProRes 4444 .mov (yuva444p10 — Premiere, After Effects, DaVinci, Final Cut). Nothing is kept but the result.
//    POST /v1/media/alpha202?fmt=webm|mov&fps=30  body (application/octet-stream):
//      [u32 LE header length][header JSON {n, fps, w, h, sizes:[…frame byte lengths…], audio: wav byte length}][frames…][wav]
//  · A part of the timeline: /v1/media/transcode takes a=<from s>&b=<to s> and cuts there (output-side seek, exact to the frame; the
//    stream-copy shortcut is skipped so the cut lands where asked).
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import express from "express";
import { requireUser } from "./auth.js";
import { saveBuffer } from "./media.js";

const FF = () => process.env.FFMPEG_PATH || "ffmpeg";
const MAXN = 60 * 60, MAXSIDE = 4096;

export function range202(q) {
  const a = +q.a, b = +q.b;
  if (!(isFinite(a) && isFinite(b) && a >= 0 && b > a + 0.04 && b < 7200)) return [];
  return ["-ss", a.toFixed(3), "-to", b.toFixed(3)];
}

function run(args, ms) {
  return new Promise((ok, bad) => {
    const p = spawn(FF(), args); let err = "";
    const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error("ffmpeg took too long")); }, ms);
    p.stderr.on("data", (d) => (err = (err + d).slice(-800))); p.on("error", (e) => { clearTimeout(t); bad(e); });
    p.on("close", (c) => { clearTimeout(t); c === 0 ? ok() : bad(new Error("ffmpeg: " + (err.trim().split("\n").slice(-1)[0] || "exit " + c).slice(0, 200))); });
  });
}

export function registerExport202(app) {
  app.post("/v1/media/alpha202", requireUser, (req, res, next) => { req.setTimeout(20 * 60e3); next(); }, express.raw({ type: "application/octet-stream", limit: "300mb" }), async (req, res) => {
    const F = req.query.fmt === "mov" ? "mov" : "webm", body = req.body;
    if (!Buffer.isBuffer(body) || body.length < 8) return res.status(400).json({ error: "Empty body" });
    let hdr; const hl = body.readUInt32LE(0);
    try { hdr = JSON.parse(body.subarray(4, 4 + hl).toString("utf8")); } catch { return res.status(400).json({ error: "Bad header" }); }
    const n = Math.round(+hdr.n || 0), fps = [12, 15, 24, 25, 30, 50, 60].includes(+hdr.fps) ? +hdr.fps : 30, sizes = Array.isArray(hdr.sizes) ? hdr.sizes.map((x) => Math.round(+x || 0)) : [];
    const W = Math.round(+hdr.w || 0), H = Math.round(+hdr.h || 0), aud = Math.round(+hdr.audio || 0);
    if (!n || n > MAXN || sizes.length !== n || !W || !H || W > MAXSIDE || H > MAXSIDE) return res.status(400).json({ error: "Bad frame list" });
    const total = sizes.reduce((s, x) => s + x, 0); if (4 + hl + total + aud !== body.length) return res.status(400).json({ error: "Body length does not match the header" });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-alpha202-")); let off = 4 + hl;
    try {
      for (let i = 0; i < n; i++) { fs.writeFileSync(path.join(dir, "f" + String(i).padStart(5, "0") + ".webp"), body.subarray(off, off + sizes[i])); off += sizes[i]; }
      let wav = null; if (aud > 44) { wav = path.join(dir, "a.wav"); fs.writeFileSync(wav, body.subarray(off, off + aud)); }
      const out = saveBuffer(Buffer.alloc(0), F === "mov" ? ".mov" : ".a.webm");
      const vid = F === "mov" ? ["-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-vendor", "apl0", ...(wav ? ["-c:a", "pcm_s24le", "-ar", "48000"] : [])]
        : ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "0", "-crf", "24", "-row-mt", "1", "-deadline", "realtime", "-cpu-used", "4", ...(wav ? ["-c:a", "libopus", "-b:a", "160k"] : [])];
      const args = ["-y", "-framerate", String(fps), "-i", path.join(dir, "f%05d.webp"), ...(wav ? ["-i", wav] : []), "-vf", `scale=${W - (W % 2)}:${H - (H % 2)},format=${F === "mov" ? "yuva444p10le" : "yuva420p"}`, "-r", String(fps), ...vid, ...(wav ? ["-shortest"] : []), out.file];
      await run(args, 15 * 60e3);
      res.json({ url: (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + "/media/" + out.name, frames: n, fps, w: W, h: H, fmt: F, alpha: true });
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) }); }
    finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  });
}
