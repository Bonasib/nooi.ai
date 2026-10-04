// ElevenLabs text-to-speech (+ streaming, voice cloning). Keys stay on the server.
// ⚠ Model ids / default voice can change — the admin can override them (Admin → Models / AI providers).
import { cfg } from "../lib/settings.js";
import { S as settingsS } from "../lib/settings.js";
import { saveBuffer } from "../lib/media.js";
import { providerError } from "../lib/errors.js";
export const EL_MODELS = { el_flash: "eleven_flash_v2_5", el_turbo: "eleven_turbo_v2_5", el_multi: "eleven_multilingual_v2", el_v3: "eleven_v3" };
const base = () => (cfg("elevenlabs").baseUrl || "https://api.elevenlabs.io").replace(/\/$/, "");
const modelId = (k) => (settingsS().modelCat || {})[k]?.apiModel || EL_MODELS[k] || "eleven_multilingual_v2";
function wav(pcm, rate = 44100) { const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); }
export const elevenlabs = () => { const c = cfg("elevenlabs");
  return { name: "ElevenLabs", configured: !!c.apiKey,
    async submit(p) {
      const voice = p.meta?.elVoice || c.voiceId || "21m00Tcm4TlvDq8ikWAM", fmt = p.meta?.format === "wav" ? "pcm_44100" : "mp3_44100_128";
      const r = await fetch(`${base()}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${fmt}`, { method: "POST", headers: { "xi-api-key": c.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ text: String(p.prompt || "").slice(0, 5000), model_id: modelId(p.meta?.elModel), voice_settings: { stability: 0.5, similarity_boost: 0.75 } }) });
      if (!r.ok) throw providerError("ElevenLabs", r.status, await r.text());
      const buf = Buffer.from(await r.arrayBuffer()); const saved = fmt.startsWith("pcm") ? saveBuffer(wav(buf), ".wav") : saveBuffer(buf, ".mp3");
      return { done: true, url: saved.url };
    },
    async poll() { return { status: "done" }; } }; };
// Low-latency preview: pipe the provider's audio stream straight to the browser.
export async function streamTTS(res, { text, voice, model }) {
  const c = cfg("elevenlabs"); if (!c.apiKey) { res.status(501).json({ error: "ElevenLabs is not connected" }); return; }
  const r = await fetch(`${base()}/v1/text-to-speech/${encodeURIComponent(voice || c.voiceId || "21m00Tcm4TlvDq8ikWAM")}/stream?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": c.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ text: String(text || "").slice(0, 2500), model_id: modelId(model || "el_flash") }) });
  if (!r.ok || !r.body) { const e = providerError("ElevenLabs", r.status, await r.text().catch(() => "")); res.status(e.type === "rate" ? 429 : 502).json({ error: e.type === "auth" ? "The voice provider rejected the platform key" : e.message, type: e.type }); return; }
  res.setHeader("Content-Type", "audio/mpeg"); res.setHeader("Cache-Control", "no-store");
  const reader = r.body.getReader(); for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(Buffer.from(value)); } res.end();
}
export async function elClone(name, audioBuf, filename) {
  const c = cfg("elevenlabs"); const fd = new FormData(); fd.append("name", name || "nooi voice"); fd.append("files", new Blob([audioBuf]), filename || "sample.webm");
  const r = await fetch(`${base()}/v1/voices/add`, { method: "POST", headers: { "xi-api-key": c.apiKey }, body: fd }); if (!r.ok) throw providerError("ElevenLabs", r.status, await r.text());
  return (await r.json()).voice_id;
}
