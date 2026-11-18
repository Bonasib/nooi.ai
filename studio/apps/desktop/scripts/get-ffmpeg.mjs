// Puts FFmpeg next to the app as Tauri's "sidecar": src-tauri/binaries/ffmpeg-<target triple>[.exe]. One static build per
// platform (the ffmpeg-static project's builds, FFmpeg 6.1.1 — GPL, because H.264 needs libx264; the licence is copied beside it).
// Usage: node scripts/get-ffmpeg.mjs [--target <rust target triple>]   (default: this computer's)
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const TAG = "b6.1.1", BASE = `https://github.com/eugeneware/ffmpeg-static/releases/download/${TAG}/`;
const MAP = { "x86_64-unknown-linux-gnu": "linux-x64", "aarch64-unknown-linux-gnu": "linux-arm64", "x86_64-apple-darwin": "darwin-x64", "aarch64-apple-darwin": "darwin-arm64", "x86_64-pc-windows-msvc": "win32-x64" };
const i = process.argv.indexOf("--target");
const triple = i > 0 ? process.argv[i + 1] : /host: (\S+)/.exec(execSync("rustc -vV").toString())?.[1];
const plat = triple && MAP[triple]; if (!plat) { console.error(`No FFmpeg build for ${triple}. Known: ${Object.keys(MAP).join(", ")}`); process.exit(1); }
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "binaries");
const out = path.join(dir, `ffmpeg-${triple}${triple.includes("windows") ? ".exe" : ""}`);
if (fs.existsSync(out) && fs.statSync(out).size > 1e6) { console.log("FFmpeg is there:", path.basename(out)); process.exit(0); }
fs.mkdirSync(dir, { recursive: true });
const get = async (u) => { const r = await fetch(u, { redirect: "follow" }); if (!r.ok) throw new Error(`${u}: ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
console.log(`Getting FFmpeg for ${triple}…`);
fs.writeFileSync(out, zlib.gunzipSync(await get(BASE + `ffmpeg-${plat}.gz`))); fs.chmodSync(out, 0o755);
fs.writeFileSync(path.join(dir, "FFMPEG-LICENSE.txt"), await get(BASE + `ffmpeg-${plat}.LICENSE`).catch(() => Buffer.from("FFmpeg is free software under the GNU GPL v3. Source: https://ffmpeg.org/download.html\n")));
console.log("FFmpeg ready:", path.basename(out), Math.round(fs.statSync(out).size / 1e6), "MB");
