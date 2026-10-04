// Image models added in v35. Keys stay on the server; model ids are set by the admin.
import { cfg, configured, S as settingsS } from "../lib/settings.js";
import { saveBuffer } from "../lib/media.js";
import { providerError } from "../lib/errors.js";
const apiModel = (id, def) => (settingsS().modelCat || {})[id]?.apiModel || def;
const promptOf = (p) => [p.prompt, p.meta?.style && `Style: ${p.meta.style}`, p.aspect && `Aspect ratio ${p.aspect}`].filter(Boolean).join(". ");
// Google Gemini image generation ("Nano Banana" family) — returns inline image data.
export const nanoBanana = (id) => { const c = cfg("google"); const base = (c.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  return { name: "Google · Nano Banana", configured: !!c.apiKey,
    async submit(p) { const model = apiModel(id, id === "nanopro" ? "gemini-3-pro-image-preview" : "gemini-2.5-flash-image");
      const parts = [{ text: promptOf(p) }]; const ref = p.inputs?.iRef || p.inputs?.eRef; if (ref && ref.startsWith("data:")) { const [h, b64] = ref.split(","); parts.push({ inline_data: { mime_type: h.slice(5, h.indexOf(";")), data: b64 } }); }
      const r = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "x-goog-api-key": c.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"] } }) });
      if (!r.ok) throw providerError("Google", r.status, await r.text());
      const d = await r.json(); const part = (d.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData || x.inline_data); const inl = part && (part.inlineData || part.inline_data);
      if (!inl) throw providerError("Google", 422, "no image returned"); const ext = (inl.mimeType || inl.mime_type || "image/png").includes("jpeg") ? ".jpg" : ".png";
      return { done: true, url: saveBuffer(Buffer.from(inl.data, "base64"), ext).url }; },
    async poll() { return { status: "done" }; } }; };
// Midjourney: no official public API is known — only an authorised provider set by the admin can be used.
export const midjourney = () => { const c = cfg("midjourney");
  return { name: "Midjourney", configured: !!(c.apiKey && c.baseUrl),
    async submit() { throw providerError("Midjourney", 501, "Connect an authorised Midjourney provider in Admin → AI providers (Midjourney has no official public API)."); },
    async poll() { return { status: "failed", error: "not connected" }; } }; };

// OpenAI GPT Image — Images API (/v1/images/generations, base64 result). The model id is required from Admin → Models
// (settings.modelCat.img20.apiModel); nothing is called under the "GPT Image 2.0" name until the admin sets the real id.
export const gptImage = (id) => { const c = cfg("openai"); const base = (c.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  return { name: "OpenAI · GPT Image", configured: !!c.apiKey,
    async submit(p) { const model = (settingsS().modelCat || {})[id]?.apiModel;
      if (!model) throw Object.assign(new Error("Set the API model id for GPT Image 2.0 in Admin → Models before using it"), { code: 503, type: "config", retryable: false });
      const a = String(p.aspect || "1:1"), size = /^(16:9|21:9|4:3|3:2)$/.test(a) ? "1536x1024" : /^(9:16|4:5|3:4|2:3)$/.test(a) ? "1024x1536" : "1024x1024";
      const r = await fetch(`${base}/images/generations`, { method: "POST", headers: { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt: promptOf(p).slice(0, 32000), size, n: 1 }) });
      if (!r.ok) throw providerError("OpenAI", r.status, await r.text().catch(() => ""));
      const d = await r.json(); const b64 = d.data?.[0]?.b64_json; if (!b64) throw Object.assign(new Error("OpenAI returned no image"), { type: "provider", retryable: true });
      const f = saveBuffer(Buffer.from(b64, "base64"), ".png"); return { done: true, url: f.url }; },
    async poll() { return { status: "done" }; } }; };
