// v124: the site's own text files (the page is 2.7 MB) leave this server compressed — brotli (the page: about 650 KB) or gzip
// (about 920 KB) — made once in the background and kept in memory (all of them: about 3.6 MB), each with an ETag, so a returning
// visitor downloads nothing (304) and a new one gets the smallest copy their browser reads. Nginx passes an answer that is
// already compressed on as it is (before, it compressed the page itself at its lightest level, about 1 MB, on every visit).
// A changed file (an update) is read again by itself; the first visitor after a change gets it plain while it is compressed.
import zlib from "zlib";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
// v279: the page's own script and styles are sent minified (comments and spaces out, ~11 % fewer bytes after brotli; names
// are kept, so nothing that reads a function by name changes). NOOI_MINIFY=false sends the page as it is written.
let ES = null; try { ES = process.env.NOOI_MINIFY === "false" ? null : createRequire(import.meta.url)("esbuild"); } catch { ES = null; }
export function minifyPage(raw) {
  if (!ES) return raw;
  try {
    let s = raw.toString("utf8");
    s = s.replace(/<script>([\s\S]*?)<\/script>/g, (m, c) => c.length < 5000 ? m : "<script>" + ES.transformSync(c, { minifyWhitespace: true, minifySyntax: true, legalComments: "none", target: "es2020", charset: "utf8" }).code.replace(/<\/script/gi, "<\\/script") + "</script>");
    s = s.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (m, a, c) => { if (c.length < 2000) return m; try { return "<style" + a + ">" + ES.transformSync(c, { loader: "css", minify: true, charset: "utf8" }).code + "</style>"; } catch { return m; } });
    return Buffer.from(s, "utf8");
  } catch (e) { console.warn("v279 minify skipped:", e.message); return raw; }
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
const CACHE = new Map();
export const STATIC124 = { hits: 0, br: 0, gz: 0, notModified: 0 };

function load(f, st, ext) {
  let raw = fs.readFileSync(f); if (ext === ".html" && raw.length > 500000) raw = minifyPage(raw);
  const c = { mtime: st.mtimeMs, size: st.size, type: TYPES[ext], raw, gz: null, br: null,
    etag: '"' + crypto.createHash("sha1").update(raw).digest("base64url").slice(0, 27) + '"' };
  CACHE.set(f, c);
  zlib.gzip(raw, { level: 9 }, (e, out) => { if (!e && out.length < raw.length) c.gz = out; });
  zlib.brotliCompress(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } }, (e, out) => { if (!e && out.length < raw.length) c.br = out; });
  return c;
}
export function fastFiles(dir) {
  dir = path.resolve(dir);
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    let p; try { p = decodeURIComponent(req.path); } catch { return next(); }
    if (p.endsWith("/")) p += "index.html";
    if (p.split("/").some((x) => x.startsWith("."))) return next();   // (hidden files: as the static server, never served)
    const ext = path.extname(p).toLowerCase(); if (!TYPES[ext]) return next();
    const f = path.join(dir, p); if (!f.startsWith(dir + path.sep)) return next();
    let st; try { st = fs.statSync(f); } catch { return next(); }
    if (!st.isFile() || st.size < 2048 || st.size > 20e6) return next();
    let c = CACHE.get(f); if (!c || c.mtime !== st.mtimeMs || c.size !== st.size) c = load(f, st, ext);
    STATIC124.hits++;
    res.setHeader("ETag", c.etag); res.setHeader("Vary", "Accept-Encoding"); res.setHeader("Content-Type", c.type);
    res.setHeader("Cache-Control", p.startsWith("/studio/assets/") ? "public, max-age=31536000, immutable" : "no-cache");   // (asked again each visit — answered "not changed" with nothing to download; v219: the studio's built files carry their content in their names — kept a year)
    const inm = String(req.headers["if-none-match"] || ""); if (inm && inm.split(/\s*,\s*/).some((t) => t.replace(/^W\//, "") === c.etag)) { STATIC124.notModified++; res.statusCode = 304; return res.end(); }
    const ae = String(req.headers["accept-encoding"] || ""); let body = c.raw;
    if (c.br && /\bbr\b/.test(ae)) { body = c.br; res.setHeader("Content-Encoding", "br"); STATIC124.br++; }
    else if (c.gz && /\bgzip\b/.test(ae)) { body = c.gz; res.setHeader("Content-Encoding", "gzip"); STATIC124.gz++; }
    res.setHeader("Content-Length", body.length); res.statusCode = 200; return req.method === "HEAD" ? res.end() : res.end(body);
  };
}
// read and compress the page at start, so the first visitor already gets it small
export function warm(dir, files) { for (const n of files) { const f = path.join(path.resolve(dir), n); try { const st = fs.statSync(f); load(f, st, path.extname(f).toLowerCase()); } catch {} } }
