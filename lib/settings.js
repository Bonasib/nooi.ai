// Admin-controlled platform settings: features, models, prices, provider keys (encrypted), payments, roles.
import { col, save } from "./store.js";
import { encrypt, decrypt, mask } from "./secrets.js";
export const S = () => col("settings", { features: {}, models: {}, prices: {}, providers: {}, payments: {}, roles: {}, team: [], modelLogos: {}, status: {}, maintenance: {} });
// the company behind the site — one copy on the server (Admin → Legal & payments → Business details); every policy, the footer
// and every invoice read it. Public information: it is shown on the website. .env COMPANY_* fill any field not saved yet.
export const BIZ_KEYS = ["name", "cr", "vat", "email", "phone", "address", "city", "country"];
const ENV_BIZ = { name: "COMPANY_NAME", cr: "COMPANY_CR", vat: "COMPANY_VAT", address: "COMPANY_ADDRESS", email: "COMPANY_EMAIL", phone: "COMPANY_PHONE", city: "COMPANY_CITY", country: "COMPANY_COUNTRY" };
export const biz = () => { const b = S().biz || {}; return Object.fromEntries(BIZ_KEYS.map((k) => [k, String(b[k] || process.env[ENV_BIZ[k]] || "").slice(0, 300)])); };
export function saveBiz(input) { const st = S(), cur = st.biz || {}; for (const k of BIZ_KEYS) if (typeof (input || {})[k] === "string") cur[k] = input[k].trim().slice(0, 300); st.biz = cur; return biz(); }
// Environment fallbacks so .env keeps working
const ENV = {
  seedance: () => ({ apiKey: process.env.SEEDANCE_API_KEY, model: process.env.SEEDANCE_MODEL, baseUrl: process.env.SEEDANCE_BASE_URL }),
  world: () => ({ apiKey: process.env.WORLD_API_KEY, baseUrl: process.env.WORLD_API_URL, model: process.env.WORLD_ENGINE }),
  elevenlabs: () => ({ apiKey: process.env.ELEVENLABS_API_KEY, voiceId: process.env.ELEVENLABS_VOICE_ID, baseUrl: process.env.ELEVENLABS_BASE_URL }),
  google: () => ({ apiKey: process.env.GOOGLE_API_KEY, baseUrl: process.env.GOOGLE_BASE_URL }),
  openai: () => ({ apiKey: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_BASE_URL }),
  midjourney: () => ({ apiKey: process.env.MIDJOURNEY_API_KEY, baseUrl: process.env.MIDJOURNEY_BASE_URL }),
  minimax: () => ({ apiKey: process.env.MINIMAX_API_KEY, model: process.env.MINIMAX_MODEL, baseUrl: process.env.MINIMAX_BASE_URL,   // (v183: + voices, pictures, music — providers/minimax183.js)
    speechModel: process.env.MINIMAX_SPEECH_MODEL, imageModel: process.env.MINIMAX_IMAGE_MODEL, musicModel: process.env.MINIMAX_MUSIC_MODEL,
    videoModel: process.env.MINIMAX_VIDEO_MODEL, videoResolution: process.env.MINIMAX_VIDEO_RESOLUTION }),   // (v185: videos — Hailuo)
  kling: () => ({ accessKey: process.env.KLING_ACCESS_KEY, secretKey: process.env.KLING_SECRET_KEY, baseUrl: process.env.KLING_BASE_URL, model: process.env.KLING_MODEL }),
  qwen: () => ({ apiKey: process.env.DASHSCOPE_API_KEY, videoModel: process.env.DASHSCOPE_VIDEO_MODEL, imageModel: process.env.DASHSCOPE_IMAGE_MODEL, baseUrl: process.env.DASHSCOPE_BASE_URL,
    model3d: process.env.DASHSCOPE_3D_MODEL, url3d: process.env.DASHSCOPE_3D_URL }),   // model3d: Model Studio 3D (providers/gen3d.js ms3d) — empty = Tripo/Tripo-P1.0, "off" = not used
  qwentext: () => ({}), claude: () => ({}),
  piper: () => ({ baseUrl: process.env.PIPER_URLS }),   // backup voice on your own server (providers/piper.js)
  localtext: () => ({ baseUrl: process.env.LOCAL_LLM_URL, model: process.env.LOCAL_LLM_MODEL, apiKey: process.env.LOCAL_LLM_KEY }),   // your own text AI (Gemma …), OpenAI-compatible
  gemma: () => ({ apiKey: process.env.GEMMA_API_KEY, model: process.env.GEMMA_MODEL, thinking: process.env.GEMMA_THINKING, use: process.env.GEMMA_USE, baseUrl: process.env.GEMMA_BASE_URL }),   // Gemma 4 on Google's Gemini API (providers/localtext.js)
  wan: () => ({ apiKey: process.env.WAN_API_KEY, baseUrl: process.env.WAN_API_URL }),
  kie: () => ({ apiKey: process.env.KIE_API_KEY, baseUrl: process.env.KIE_BASE_URL, videoModel: process.env.KIE_VIDEO_MODEL, imageModel: process.env.KIE_IMAGE_MODEL, musicModel: process.env.KIE_MUSIC_MODEL }),
  tts: () => ({ apiKey: process.env.TTS_API_KEY, baseUrl: process.env.TTS_API_URL }),
  sam3d: () => ({ apiKey: process.env.SAM3D_API_KEY, baseUrl: process.env.SAM3D_API_URL }),
  realtime: () => ({ apiKey: process.env.REALTIME_API_KEY, baseUrl: process.env.REALTIME_API_URL }),
  fal: () => ({ apiKey: process.env.FAL_KEY, baseUrl: process.env.FAL_BASE_URL, model: process.env.FAL_SKETCH_MODEL }),   // live AI sketch (fal.ai few-step image-to-image)
  nvidia: () => ({ apiKey: process.env.NVIDIA_API_KEY, baseUrl: process.env.NVIDIA_BASE_URL, model: process.env.NVIDIA_VLM_MODEL, textModel: process.env.NVIDIA_TEXT_MODEL }),
  tripo: () => ({ apiKey: process.env.TRIPO_API_KEY, baseUrl: process.env.TRIPO_BASE_URL }),
  meshy: () => ({ apiKey: process.env.MESHY_API_KEY, baseUrl: process.env.MESHY_BASE_URL }),
  blockade: () => ({ apiKey: process.env.BLOCKADE_API_KEY, baseUrl: process.env.BLOCKADE_BASE_URL, model: process.env.BLOCKADE_STYLE_ID }),
  worldlabs: () => ({ apiKey: process.env.WORLDLABS_API_KEY, baseUrl: process.env.WORLDLABS_BASE_URL, model: process.env.WORLDLABS_MODEL }),   // World Labs Marble: words / a picture → a walkable 3D world
  vss: () => ({ apiKey: process.env.VSS_API_KEY, baseUrl: process.env.VSS_API_URL, model: process.env.VSS_MODEL }),
  // content localization: CAMB.AI dubbing, and your own deployment of NVIDIA's Content Localization blueprint (controller gRPC address;
  // model = "elevenlabs" | "camb" (the S2S engine it runs) or "lipsync" (nooi makes the voices, the server syncs the lips))
  camb: () => ({ apiKey: process.env.CAMB_API_KEY, baseUrl: process.env.CAMB_BASE_URL }),
  nvloc: () => ({ baseUrl: process.env.NV_LOCALIZE_URL, apiKey: process.env.NV_LOCALIZE_TOKEN, model: process.env.NV_LOCALIZE_MODE }),
  email: () => ({ provider: process.env.EMAIL_PROVIDER, apiKey: process.env.EMAIL_API_KEY, from: process.env.EMAIL_FROM }),
  stripe: () => ({ secretKey: process.env.STRIPE_SECRET_KEY }), paypal: () => ({ clientId: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_SECRET, mode: process.env.PAYPAL_MODE }),
  airwallex: () => ({ clientId: process.env.AIRWALLEX_CLIENT_ID, apiKey: process.env.AIRWALLEX_API_KEY, env: process.env.AIRWALLEX_ENV }),
  moyasar: () => ({ secretKey: process.env.MOYASAR_SECRET_KEY }), tap: () => ({ secretKey: process.env.TAP_SECRET_KEY })
};
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));
export function cfg(key) { const st = S(); const saved = decrypt(st.providers[key]?.enc || st.payments[key]?.enc); return { ...clean((ENV[key] || (() => ({})))()), ...clean(saved) }; }
export const configured = (key) => { const c = cfg(key); if (key === "localtext") return !!(c.baseUrl && c.model); if (key === "gemma") return !!((c.apiKey || cfg("google").apiKey) && (c.apiKey || c.model)); if (key === "piper") return !!c.baseUrl; return !!(c.apiKey || c.secretKey || c.accessKey || c.clientId); };
export function saveCfg(group, key, vals) { const st = S(); const cur = decrypt(st[group][key]?.enc); st[group][key] = { ...(st[group][key] || {}), enc: encrypt({ ...cur, ...clean(vals) }), updated: Date.now() }; save(); }
export function publicProviders() { return Object.fromEntries(Object.keys(ENV).filter((k) => !["stripe", "paypal", "airwallex", "moyasar", "tap"].includes(k)).map((k) => { const c = cfg(k); return [k, { configured: configured(k) || (["vss", "nvloc"].includes(k) && !!c.baseUrl), ...Object.fromEntries(Object.entries(c).map(([f, v]) => [f + "Mask", /key|secret/i.test(f) ? mask(v) : v])) }]; })); }
export function publicPayments() { const st = S(); return Object.fromEntries(["stripe", "paypal", "airwallex", "moyasar", "tap"].map((k) => [k, { enabled: st.payments[k]?.enabled ?? (process.env.PAYMENT_PROVIDER === k), configured: configured(k) }])); }
export const featureOn = (k) => S().features[k] !== false;
export const modelOn = (k) => S().models[k] !== false;
export const price = (k, def) => S().prices[k] ?? def;
