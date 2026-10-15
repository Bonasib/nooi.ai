// v88 on the server:
//  · prompts reach the picture / video engines in English: a prompt written in Arabic (or another non-Latin script) is put
//    into English by the site's text AI before the job is routed (names, numbers, anything "in quotes" and words someone says
//    aloud stay as written); if the text AI is busy or down the prompt goes as it is. Video prompts also ask
//    for no on-screen text unless the words ask for text, so the engine never paints the prompt onto the picture.
//  · GET /v1/poster/<file> — one clear frame from a video on this server (from its middle, the most typical frame of a
//    short stretch), made once and kept next to it: every thumbnail shows what the video is, on every phone.
//  · DELETE /v1/jobs/:id — a finished or failed result leaves the account (the file itself stays: it may be in an edit).
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { jobHooks } from "./jobs.js";
import { MEDIA_DIR } from "./media.js";
import { user, save } from "./store.js";
import { llm, llmConfigured } from "../providers/anthropic.js";

// ---------- prompts in English ----------
const NONLATIN = /[֐-ࣿЀ-ӿ฀-๿஀-௿ऀ-ॿ぀-ヿ一-鿿가-힯]/;
const KINDS = new Set(["video", "chapter", "image", "look", "sheet", "3d"]);
const memo = new Map();
// the parts in quotes stay exactly as written: they are words someone says or text that is meant to be shown
const quoted = (s) => (String(s).match(/"[^"\n]{1,400}"|“[^”\n]{1,400}”|«[^»\n]{1,400}»/g) || []);
export async function toEnglish(text, { timeoutMs = 6000, ask = llm } = {}) {
  const t = String(text || "").trim(); if (!t || !NONLATIN.test(t.replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/g, ""))) return t;
  if (memo.has(t)) return memo.get(t);
  if (asking.has(t)) return asking.get(t);                    // the same words sent twice at once (a network retry) wait for one answer
  const p = put(t, timeoutMs, ask).finally(() => asking.delete(t)); asking.set(t, p); return p;
}
const asking = new Map();
async function put(t, timeoutMs, ask) {
  const keep = quoted(t);
  const job = ask("Put this prompt for an AI picture / video generator into natural English. Keep every name, brand and number. Keep any text inside quotation marks exactly as written, in its own language and inside the same quotation marks. Words that someone in the video says aloud (dialogue, a line of speech, a song) stay exactly as written in their own language, inside quotation marks. Do not add anything. Reply with the English prompt only.\n\n" + t,
    { tier: "quick", maxTokens: 900, timeoutMs, system: "You translate prompts for image and video generation into English." });
  const out = await Promise.race([job, new Promise((ok) => setTimeout(() => ok(null), timeoutMs + 500))]).catch(() => null);
  let en = String(out || "").trim(); const w = /^(["'`])([\s\S]*)\1$/.exec(en); if (w && !w[2].includes(w[1])) en = w[2].trim();   // the whole answer in quotes → without them
  if (!en || NONLATIN.test(en.replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/g, ""))) return t;      // not put into English: as it was
  for (const q of keep) if (!en.includes(q)) en += " " + q;                                                     // the quoted words never get lost
  memo.set(t, en); if (memo.size > 400) memo.delete(memo.keys().next().value);
  return en;
}
// a video never shows its prompt as text, unless the words ask for text (a title, a sign, a caption, a logo …)
const WANTS_TEXT = /\b(text|title|caption|subtitle|sign|logo|words?|letters?|written|lettering|headline|banner|label)\b|نص|عنوان|كتابة|شعار|لافتة|ترجمة|مكتوب/i;
export const NO_TEXT = "No on-screen text, captions, subtitles or watermarks.";
export function noTextLine(prompt) { const p = String(prompt || ""); return !p.trim() || WANTS_TEXT.test(p) || p.includes(NO_TEXT) ? p : (p.replace(/\s*$/, "") + (p.trim() ? " " : "") + NO_TEXT); }

jobHooks.before.push(async (u, body) => {
  if (!body || !KINDS.has(body.kind) || body.meta?.keepWords) return;
  const said = String(body.prompt || "");
  if (said.trim() && !body.title) body.title = said.trim().slice(0, 300);   // the library keeps the client's own words as the title
  if (said && llmConfigured()) { try { const en = await toEnglish(said); if (en && en !== said) { body.meta = { ...(body.meta || {}), said: said.slice(0, 2000) }; body.prompt = en; } } catch { /* as it was */ } }
  // (an empty request stays empty: it is refused further on, with nothing charged)
  if (["video", "chapter"].includes(body.kind) && !body.meta?.motion83 && String(body.prompt || "").trim()) body.prompt = noTextLine(body.prompt);
});

// ---------- poster frames ----------
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;
const making = new Map(); let running = 0; const waiting = [];
const slot = () => new Promise((ok) => { if (running < 2) { running++; ok(); } else waiting.push(ok); });
const free = () => { const n = waiting.shift(); if (n) n(); else running--; };
const run = (bin, args, ms = 20000) => new Promise((ok, bad) => { const p = spawn(bin, args); let out = ""; const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error("timed out")); }, ms);
  p.stdout.on("data", (d) => (out += d)); p.on("error", (e) => { clearTimeout(t); bad(e); }); p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(out) : bad(new Error(bin + " exited " + c)); }); });
export async function makePoster(src, out) {
  let dur = 0; try { dur = +(await run(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", src])) || 0; } catch {}
  const at = dur > 0 ? Math.max(0, Math.min(dur * 0.4, dur - 0.2)) : 0.5;
  await run(process.env.FFMPEG_PATH || "ffmpeg", ["-y", "-v", "error", "-ss", at.toFixed(2), "-i", src, "-vf", "thumbnail=24,scale='min(720,iw)':-2", "-frames:v", "1", "-q:v", "4", out]);
  if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error("no frame");
  return out;
}
export function registerV88(app, requireUser) {
  app.get("/v1/poster/:name", async (req, res) => {
    const name = path.basename(String(req.params.name || "")); if (!VIDEO.test(name)) return res.status(404).end();
    const src = path.join(MEDIA_DIR, name), out = path.join(MEDIA_DIR, name + ".poster.jpg");
    if (!fs.existsSync(src)) return res.status(404).end();
    try {
      if (!fs.existsSync(out)) {
        if (!making.has(name)) making.set(name, (async () => { await slot(); try { return await makePoster(src, out); } finally { free(); } })().finally(() => setTimeout(() => making.delete(name), 60000)));
        await making.get(name);
      }
      res.set("Cache-Control", "public, max-age=31536000, immutable"); res.type("jpg"); fs.createReadStream(out).pipe(res);
    } catch (e) { res.status(404).end(); }
  });
  app.delete("/v1/jobs/:id", requireUser, (req, res) => {
    const U = user(req.user.uid), j = U.jobs[req.params.id];
    if (!j) return res.json({ ok: true, gone: true });
    if (!["done", "failed"].includes(j.status)) return res.status(409).json({ error: "It's still being made — delete it when it's ready." });
    delete U.jobs[req.params.id]; save(); res.json({ ok: true });
  });
}
