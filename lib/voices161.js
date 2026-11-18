// v161: the voices for a Kling 4.0 video, found before the job is made, so the engine makes each person's speech, lip-sync and sound
// itself in one pass (no voice step after the video, nothing extra to pay):
//  · each @character's own voice (from the library — picked in the box, on the Characters page, or read from their photo) → that
//    voice's sample clip (made once, kept for everyone, like the samples people listen to before choosing)
//  · the voice picked in the box for whoever speaks (no character) → its sample clip
//  · the customer's own voice clip ("Clone it", with their consent) → its sound (a video clip's sound taken out), at most 20 s
// A voice that can't be had never stops the job: the engine then gives the person a fitting voice of its own.
import fs from "fs";
import path from "path";
import { jobHooks } from "./jobs.js";
import { voiceSample161 } from "./localize.js";
import { isK4Job161, cleanCast161, castTags161 } from "./kling161.js";
import { speechLang } from "./speech160.js";
import { MEDIA_DIR } from "./media.js";
import { run, ffmpeg } from "./voice.js";
import { uid } from "./store.js";

const within = (p, ms) => Promise.race([Promise.resolve(p).catch(() => null), new Promise((ok) => setTimeout(() => ok(null), ms))]);
const VID = /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i, AUD = /\.(mp3|m4a|aac|wav|ogg|opus|flac|weba)(\?|$)/i;
// the customer's clip on this server → its sound alone, the first 20 s, as an mp3 next to it (another server's file stays as it is)
export async function clipVoice161(url) {
  const u = String(url || ""); if (!u) return null;
  const local = /^\/media\/[\w.-]+$/.test(u) ? path.join(MEDIA_DIR, path.basename(u)) : null;
  if (!local) return /^https?:\/\//.test(u) && AUD.test(u) ? u : null;
  if (!fs.existsSync(local)) return null;
  const name = "v161-" + uid() + ".mp3", out = path.join(MEDIA_DIR, name);
  try { await run(ffmpeg(), ["-y", "-v", "error", "-i", local, "-vn", "-t", "20", "-ac", "1", "-ar", "44100", "-b:a", "128k", out]); if (fs.existsSync(out) && fs.statSync(out).size > 1000) return "/media/" + name; } catch (e) { console.warn("voice clip (Kling 4.0):", String(e.message || e).slice(0, 160)); }
  return AUD.test(u) && !VID.test(u) ? u : null;
}
export async function voices161(body, { sample = voiceSample161, clip = clipVoice161, ms = 25000 } = {}) {
  const m = body?.meta; if (!m || !isK4Job161(body) || !(m.cast161 || m.voice161 || body.inputs?.vVoice161)) return;
  const sl = speechLang(m.said || body.title || body.prompt || "", body.prompt || ""), lang = sl ? sl.code : "en";
  // (a face that is no longer on this server is left out — the engine would fail on it; a character with none left goes too)
  const here = (u) => { const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + "/media/", f = /^\/media\//.test(u) || (base.length > 7 && u.startsWith(base)) ? path.join(MEDIA_DIR, path.basename(u)) : null; return !f || fs.existsSync(f); };
  const all = cleanCast161(m.cast161).map(({ voiceUrl, ...c }) => ({ ...c, faces: c.faces.filter(here) })), cast = all.filter((c) => c.faces.length), v = m.voice161 && typeof m.voice161 === "object" ? { ...m.voice161 } : {};
  if (cast.length < all.length) body.prompt = castTags161(body.prompt, all, (i) => (all[i].faces.length ? "#cast" + (cast.indexOf(all[i]) + 1) : all[i].name));   // (the ones left keep their tags, in order)
  const named = v.who ? cast.findIndex((c) => c.name.toLowerCase() === String(v.who).toLowerCase()) : -1, to = named >= 0 ? named : cast.length ? 0 : -1;
  let mine = null; if (v.clip && body.inputs?.vVoice161) mine = await within(clip(body.inputs.vVoice161), 30000);
  // the box's voice goes to the character it was picked for (or the first one), else to whoever speaks
  if (mine) { if (to >= 0) cast[to].voiceUrl = mine; else v.url = mine; }
  else if (v.voice) { if (to >= 0) cast[to].voice = v.voice; else { const s = await within(sample(v.voice, lang), ms); if (s) v.url = s; } }
  for (const c of cast) if (!c.voiceUrl && c.voice) { const s = await within(sample(c.voice, lang), ms); if (s) c.voiceUrl = s; }
  const { cast161: _c, ...rest } = m;
  body.meta = { ...rest, ...(cast.length ? { cast161: cast } : {}), ...(v.voice || v.clip || v.url ? { voice161: { ...(v.voice ? { voice: v.voice } : {}), ...(v.clip ? { clip: 1 } : {}), ...(v.who ? { who: v.who } : {}), ...(v.url ? { url: v.url } : {}) } } : {}) };
}
jobHooks.before.push(async (u, body) => { try { await voices161(body); } catch (e) { console.warn("voices (Kling 4.0):", e.message); } });
