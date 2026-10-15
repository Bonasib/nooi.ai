// Backup voice on your own server (free, no engine credits): Piper voice servers (rhasspy/piper 1.2, MIT licence; each voice
// has its own licence — deploy/piper.sh installs only voices whose training data allows commercial use unless you add others).
// One server per voice, by language: PIPER_URLS="en=http://127.0.0.1:5000,ar=http://127.0.0.1:5001" (or Admin → AI providers
// → Backup voice). Used when the engine's voice fails: voiceovers (free for the client) and the avatar's voice.
import { cfg } from "../lib/settings.js";
export function piperUrls() {
  const raw = cfg("piper").baseUrl || process.env.PIPER_URLS || "";
  return Object.fromEntries(String(raw).split(/[,\s]+/).filter(Boolean).map((x) => { const m = /^([a-z]{2})=(.+)$/i.exec(x); return m ? [m[1].toLowerCase(), m[2]] : ["*", x]; }).filter(([, u]) => /^https?:\/\/[^\s]+$/.test(u)));
}
export const piperOn = () => Object.keys(piperUrls()).length > 0;
export const langOfText = (t, hint) => (/^[a-z]{2}/i.test(String(hint || "")) ? String(hint).slice(0, 2).toLowerCase() : /[؀-ۿ]/.test(String(t || "")) ? "ar" : "en");
export async function piperSpeak(text, lang) {
  const U = piperUrls(), url = U[lang] || U["*"]; if (!url) throw new Error("No backup voice for " + lang);
  const r = await fetch(url.replace(/\/+$/, "") + "/?text=" + encodeURIComponent(String(text || "").slice(0, 3000)), { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error("Backup voice " + r.status);
  const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 100 || buf.subarray(0, 4).toString() !== "RIFF") throw new Error("The backup voice returned no audio");
  return buf;
}
// the words as a WAV in /media (returns its /media address)
export async function backupVoiceFile(text, langHint) { const buf = await piperSpeak(text, langOfText(text, langHint)); const { saveBuffer } = await import("../lib/media.js"); return saveBuffer(buf, ".wav").url; }
