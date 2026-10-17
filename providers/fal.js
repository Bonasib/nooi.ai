// v116: fal.ai — a second engine provider for Replace the person (Seedance 2.0 Fast reference-to-video), with its own queue, so
// the owner can see whether a slow swap is the engine provider's line or the model itself. The owner's fal key (Admin → AI
// providers → fal.ai — the same key the live sketch uses). fal's queue: POST https://queue.fal.run/<model> → { request_id,
// status_url, response_url }; GET status_url → { status: IN_QUEUE | IN_PROGRESS | COMPLETED }; GET response_url → { video: { url } }.
// The inputs follow fal's Seedance 2.0 reference-to-video schema (duration is a string "4"…"15", resolution 480p / 720p).
import { cfg, configured } from "../lib/settings.js";
import { seedanceSwapWords } from "./kie.js";

export const FAL_SWAP = "bytedance/seedance-2.0/fast/reference-to-video";
const QUEUE = () => (process.env.FAL_QUEUE_URL || "https://queue.fal.run").replace(/\/$/, "");
const head = () => ({ Authorization: "Key " + cfg("fal").apiKey, "Content-Type": "application/json" });
const abs = (u) => { if (!u || /^https?:\/\//i.test(u)) return u; const b = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""); if (!b) throw Object.assign(new Error("Set PUBLIC_BASE_URL so the engine can read your uploaded files"), { code: 503 }); return b + (u.startsWith("/") ? u : "/" + u); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v || a)));
async function json(r) {
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; }
  if (!r.ok) { const m = Array.isArray(d.detail) ? d.detail.map((x) => x.msg || JSON.stringify(x)).join("; ") : d.detail || d.error || d.message || t.slice(0, 200); throw Object.assign(new Error(`AI engine ${r.status}: ${String(m).slice(0, 300)}`), { status: r.status }); }
  return d;
}
export function falInput(model, p) {
  const inp = p.inputs || {}, prod = inp.mcProd ? abs(inp.mcProd) : null, target = inp.mcWho ? abs(inp.mcWho) : null;
  return { prompt: seedanceSwapWords({ keep: p.meta?.mcKeep, prod: !!prod, target: !!target, where: p.meta?.swapWhere, who: p.meta?.swapWho, scene: p.meta?.mcScene }),
    image_urls: [abs(inp.mcChar), ...(target ? [target] : []), ...(prod ? [prod] : [])], video_urls: [abs(inp.mcMove)],
    resolution: p.meta?.swapFast ? "480p" : "720p", duration: String(clamp(p.dur, 4, 15)), aspect_ratio: "auto", generate_audio: false };
}
// v117: Sync Lipsync 2 Pro — the lips of a video matched to a voice (video_url + audio_url; the video keeps its length: cut_off)
export const FAL_LIPS = "fal-ai/sync-lipsync/v2/pro";
const lipsInput = (p) => ({ video_url: abs(p.inputs?.lsV), audio_url: abs(p.inputs?.lsA), sync_mode: "cut_off" });
export const falVideo = (model) => ({
  name: "fal.ai", configured: configured("fal"),
  async submit(p) {
    const input = model === FAL_LIPS ? lipsInput(p) : falInput(model, p);
    const d = await json(await fetch(QUEUE() + "/" + model, { method: "POST", headers: head(), body: JSON.stringify(input) }));
    if (!d.request_id || !d.status_url || !d.response_url) throw new Error("AI engine: no request id");
    return { remoteId: "fal:" + JSON.stringify({ s: d.status_url, r: d.response_url }), sent: { model, input } };
  },
  async poll(rid) {
    const { s, r } = JSON.parse(String(rid).replace(/^fal:/, ""));
    const st = await json(await fetch(s, { headers: head() }));
    if (st.status !== "COMPLETED") return { status: st.status === "IN_QUEUE" ? "queued" : "rendering" };
    const res = await fetch(r, { headers: head() }), t = await res.text(); let d; try { d = JSON.parse(t); } catch { d = {}; }
    if (!res.ok || !d.video?.url) { const m = Array.isArray(d.detail) ? d.detail.map((x) => x.msg || "").join("; ") : d.detail || d.error || t.slice(0, 200); return { status: "failed", error: String(m || "the engine made no video").slice(0, 300) }; }
    return { status: "done", url: d.video.url };
  },
});
