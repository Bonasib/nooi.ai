// Your own text AI (any OpenAI-compatible chat endpoint): Gemma on your server with Ollama
//   LOCAL_LLM_URL=http://127.0.0.1:11434/v1  LOCAL_LLM_MODEL=gemma4:e4b
// or Gemma through Google's OpenAI-compatible API (LOCAL_LLM_URL=https://generativelanguage.googleapis.com/v1beta/openai,
// LOCAL_LLM_KEY=<key>, LOCAL_LLM_MODEL=<the Gemma model id>). Also settable in Admin → AI providers. When it is set the
// site's text tasks run on it first, and Claude / Qwen / NVIDIA take over if it fails. Admin → AI providers →
// "Compare text AIs" (lib/llmcheck.js) scores it against the current text AI on nooi's own tasks before you rely on it.
import { cfg, configured } from "../lib/settings.js";
export const localOn = () => configured("localtext");
export const localInfo = () => { const c = cfg("localtext"); return { provider: "local", model: c.model || "", base: String(c.baseUrl || "").replace(/\/+$/, "") }; };
export async function localChat(prompt, { system, maxTokens = 2000, timeoutMs = 120000, images } = {}) {
  const c = cfg("localtext"), base = String(c.baseUrl || "").replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  const content = images && images.length ? [{ type: "text", text: prompt }, ...images.map((u) => ({ type: "image_url", image_url: { url: u } }))] : prompt;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(base + "/chat/completions", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json", ...(c.apiKey ? { Authorization: "Bearer " + c.apiKey } : {}) },
      body: JSON.stringify({ model: c.model, messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content }], max_tokens: maxTokens, temperature: 0.3, stream: false }) });
    const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch { d = { raw: txt }; }
    if (!r.ok) throw new Error(`Local text AI ${r.status}: ${d.error?.message || d.message || txt.slice(0, 200)}`);
    const out = d.choices?.[0]?.message?.content;
    if (!out) throw new Error("Local text AI returned no text");
    return String(out).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  } finally { clearTimeout(t); }
}
