// Live AI sketch (hypersketch-style): while the client draws, a fast image model re-renders the sketch, and the
// client pays only for what it uses — credits per rendered frame, counted here on the server (never trusted from
// the browser). Engines, in order:
//   · REALTIME_API_URL — your own realtime endpoint: POST {image, prompt, strength} → {image | images[0].url | url}
//   · fal.ai (FAL_KEY) — a few-step image-to-image model (FAL_SKETCH_MODEL, default fal-ai/fast-lightning-sdxl/image-to-image)
// Without one, the studio shows a free on-device preview, and "When I pause" sends the sketch to the platform's
// picture engines (NVIDIA FLUX, Kie, …) as ordinary image jobs at their listed price.
//   GET  /v1/realtime/sketch → {ready, engine, framesPerCredit, frames}
//   POST /v1/realtime/sketch {image, prompt, style, target, strength} → {image, frames, charged, credits}
//   POST /v1/sketch/see {image, lang} → {ready, subject, objects[], target, label}   — what the drawing shows (free), so a sketch of
//   "a car and a snake" becomes a picture of a car and a snake even when nothing was typed
import { requireUser } from "./auth.js";
import { isStaff } from "./admin.js";
import { charge, credit, balance } from "./billing.js";
import { user, save } from "./store.js";
import { cfg } from "./settings.js";
import { visionJson, visionReady } from "./vss.js";
import { langName } from "./voice.js";

export const framesPerCredit = () => Math.max(1, Math.min(50, Math.round(+process.env.REALTIME_FRAMES_PER_CREDIT || 4)));
// keys from Admin → AI providers ("realtime", "fal") or .env (REALTIME_API_URL/KEY, FAL_KEY, FAL_SKETCH_MODEL, FAL_BASE_URL)
export const rtEngine = () => (cfg("realtime").baseUrl ? "custom" : cfg("fal").apiKey ? "fal" : null);
const falModel = () => String(cfg("fal").model || "fal-ai/fast-lightning-sdxl/image-to-image").replace(/^\/+/, "");
const falBase = () => (cfg("fal").baseUrl || "https://fal.run").replace(/\/$/, "");
const LOOK = { realistic: "photorealistic, detailed, natural light, sharp focus", anim3d: "3D animated film style, soft studio lighting", anime: "anime style, clean line art, vibrant colours", concept: "concept art, painterly, cinematic lighting", clay: "claymation, soft clay texture, studio light" };
const NOUN = { character: "a character", animal: "an animal", vehicle: "a vehicle", prop: "an object", environment: "a place, wide view" };
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const last = new Map();

async function render(b) {
  const prompt = [clean(b.prompt, 300) || NOUN[b.target] || "the sketch", LOOK[b.style] || LOOK.realistic].join(", "), strength = Math.max(.2, Math.min(.95, +b.strength || .65));
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);
  try {
    if (rtEngine() === "custom") {
      const c = cfg("realtime"), r = await fetch(c.baseUrl, { method: "POST", signal: ac.signal, headers: { Authorization: "Bearer " + (c.apiKey || ""), "Content-Type": "application/json" }, body: JSON.stringify({ image: b.image, prompt, target: b.target, style: b.style, strength }) });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(d.error || d.detail || "The realtime model refused the frame (" + r.status + ")"), { code: 502 });
      return d.image || d.output?.[0] || d.images?.[0]?.url || d.images?.[0] || d.url;
    }
    // fal.ai: synchronous run; sync_mode returns the picture inline (no storage round trip)
    const r = await fetch(falBase() + "/" + falModel(), { method: "POST", signal: ac.signal, headers: { Authorization: "Key " + cfg("fal").apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: b.image, prompt, strength, num_inference_steps: 4, num_images: 1, image_size: "square", sync_mode: true, enable_safety_checker: true }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error((d.detail && (d.detail[0]?.msg || d.detail)) || d.error || "fal.ai refused the frame (" + r.status + ")"), { code: 502 });
    if (d.has_nsfw_concepts && d.has_nsfw_concepts[0]) throw Object.assign(new Error("This frame was blocked by the safety filter"), { code: 422 });
    return d.images?.[0]?.url || d.image?.url || d.url;
  } catch (e) { if (e.name === "AbortError") throw Object.assign(new Error("The realtime model took too long"), { code: 504 }); throw e; }
  finally { clearTimeout(to); }
}

const TARGETS = ["character", "animal", "vehicle", "prop", "environment"];
export function registerSketch(app) {
  app.post("/v1/sketch/see", requireUser, async (req, res) => {
    try {
      const img = String(req.body?.image || ""), lang = String(req.body?.lang || "en").replace(/[^a-zA-Z-]/g, "").slice(0, 8) || "en";
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(img) || img.length > 3e6) return res.status(400).json({ error: "Send the drawing as a PNG/JPEG/WebP data URL" });
      if (!visionReady()) return res.json({ ready: false, subject: "", objects: [], target: null, label: "" });
      const now = Date.now(), k = "see:" + req.user.uid; if (now - (last.get(k) || 0) < 700) return res.status(429).json({ error: "slow down" }); last.set(k, now);
      const r = await visionJson(`This picture is a rough hand-drawn sketch (lines on a white background) made with a finger or a pen. Say what it shows, the way an artist would read it — even if it is crude or childlike. Name every separate thing drawn and how they are arranged.
Return only JSON: {"subject":"one short English description of everything drawn and where it is, e.g. 'a sports car on a road with a big snake coiled beside it'","objects":["car","snake"],"target":"${TARGETS.join("|")}","label":"the same subject in ${langName(lang)}, at most 8 words"}`, img, { maxTokens: 350, tier: "quick", timeoutMs: 45000 });
      const objs = (Array.isArray(r && r.objects) ? r.objects : []).map((o) => clean(o, 40)).filter(Boolean).slice(0, 8);
      res.json({ ready: true, subject: clean((r && (r.subject || r.caption)) || objs.join(" and "), 240), objects: objs, target: TARGETS.includes(r && r.target) ? r.target : null, label: clean(r && r.label, 80) });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });
  app.get("/v1/realtime/sketch", requireUser, (req, res) => { const u = user(req.user.uid); res.json({ ready: !!rtEngine(), engine: rtEngine(), framesPerCredit: framesPerCredit(), frames: u.rtFrames || 0, staff: isStaff(req.user) }); });
  app.post("/v1/realtime/sketch", requireUser, async (req, res) => {
    try {
      if (!rtEngine()) return res.status(501).json({ error: "Realtime model not connected" });
      const b = req.body || {}, img = String(b.image || "");
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(img) || img.length > 2e6) return res.status(400).json({ error: "Send the sketch as a PNG/JPEG/WebP data URL under 1.5 MB" });
      const now = Date.now(), uid = req.user.uid; if (now - (last.get(uid) || 0) < 250) return res.status(429).json({ error: "slow down" }); last.set(uid, now);
      // paid per rendered frame: every framesPerCredit frames cost 1 credit, taken with the first frame of the group
      // (before the engine runs) and given back if that frame fails
      const staff = isStaff(req.user), u = user(uid), fpc = framesPerCredit(), due = !staff && (u.rtFrames || 0) % fpc === 0;
      if (due) charge(uid, 1, "Live AI sketch · " + fpc + " frames");
      let image; try { image = await render({ ...b, image: img }); if (!image) throw Object.assign(new Error("No picture from the realtime model"), { code: 502 }); }
      catch (e) { if (due) credit(uid, 1, "Refund · live AI sketch frame failed"); throw e; }
      if (!staff) { u.rtFrames = (u.rtFrames || 0) + 1; save(); }
      res.json({ image, frames: u.rtFrames || 0, charged: due ? 1 : 0, credits: balance(uid), framesPerCredit: fpc });
    } catch (e) { res.status(e.code || 502).json({ error: e.message }); }
  });
}
