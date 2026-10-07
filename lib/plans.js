// Plans & entitlements — keep in sync with PLANS / LIMITS in public/index.html
export const PLANS = {
  free:   { sar: 0,     usd: 0,    credits: 100 },
  basic:  { sar: 4900,  usd: 1300, credits: 1500 },
  pro:    { sar: 9900,  usd: 2700, credits: 4000 },
  studio: { sar: 19900, usd: 5300, credits: 10000 }
};
// models each plan can use — the engine's own models (older ids are aliases, see ALIAS in billing.js)
const FREE_M = ["auto", "seedance", "wan27", "ltxfast", "wan22", "qwenwan"];
const BASIC_M = [...FREE_M, "kling", "kling26", "hailuo", "pixverse6", "grok", "wan30", "seedance20", "hunyuan"];
const PRO_M = [...BASIC_M, "kling30", "seedance25", "hailuoh3", "veo31f", "ltx23", "kling40"];
const BASIC = FREE_M;
export const LIMITS = {
  free:   { conc: 1, maxDur: 5,  fps: 30,  models: BASIC,                    clones: 0,  api: false },
  basic:  { conc: 2, maxDur: 10, fps: 60,  models: BASIC_M, clones: 1,  api: false },
  pro:    { conc: 4, maxDur: 20, fps: 120, models: PRO_M, clones: 3,  api: false },
  studio: { conc: 8, maxDur: 30, fps: 120, models: "all",                    clones: 10, api: true }
};
export function planOf(U) { const p = U.plan === "creator" ? "pro" : U.plan; if (!p || !LIMITS[p]) return "free"; if (U.planUntil && U.planUntil < Date.now()) return "free"; return p; }
// Voice: ElevenLabs standard models from Pro, the full set (v3 + ElevenLabs cloning) on Studio. Images: premium models from Pro / Studio.
const EL_TIER = { free: [], basic: [], pro: ["el_flash", "el_turbo", "el_multi"], studio: ["el_flash", "el_turbo", "el_multi", "el_v3"] };
const IMG_TIER = { nanopro: ["pro", "studio"], img20: ["pro", "studio"], img25: ["pro", "studio"], mj: ["studio"], imagen4: ["pro", "studio"] };
export function checkEntitlement(U, body) {
  { const plan = planOf(U), err2 = (m) => Object.assign(new Error(m + " — upgrade your plan"), { code: 402 });
    if (body.kind === "voice" && body.meta?.engine === "elevenlabs" && !EL_TIER[plan].includes(body.meta?.elModel || "el_multi")) throw err2("This ElevenLabs voice model is not in your plan");
    if (body.kind === "voiceclone" && body.meta?.engine === "elevenlabs" && plan !== "studio") throw err2("ElevenLabs voice cloning is part of the Studio plan");
    if (body.kind === "image" && IMG_TIER[body.model] && !IMG_TIER[body.model].includes(plan)) throw err2(`Image model ${body.model} is not in your plan`); }
  const L = LIMITS[planOf(U)], err = (m) => Object.assign(new Error(m + " — upgrade your plan"), { code: 402 });
  const video = ["video", "chapter"].includes(body.kind);
  if (video && body.model && L.models !== "all" && !L.models.includes(body.model)) throw err(`Model ${body.model} is not in your plan`);
  if (video && (+body.dur || 0) > L.maxDur) throw err(`Videos longer than ${L.maxDur}s are not in your plan`);
  const fps = +(body.meta?.fps || 0); if (fps > L.fps) throw err(`${fps} fps is not in your plan`);
  if (body.kind === "voiceclone" && Object.values(U.jobs || {}).filter((j) => j.kind === "voiceclone" && j.status !== "failed").length >= L.clones) throw err("No voice clones left in your plan");
  const running = Object.values(U.jobs || {}).filter((j) => ["queued", "rendering"].includes(j.status)).length;
  if (running >= L.conc) throw Object.assign(new Error(`Your plan runs ${L.conc} generation(s) at a time — wait for one to finish`), { code: 429 });
}
