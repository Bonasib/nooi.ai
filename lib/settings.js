// Admin-controlled platform settings: features, models, prices, provider keys (encrypted), payments, roles.
import { col, save } from "./store.js";
import { encrypt, decrypt, mask } from "./secrets.js";
export const S = () => col("settings", { features: {}, models: {}, prices: {}, providers: {}, payments: {}, roles: {}, team: [], modelLogos: {}, status: {}, maintenance: {} });
// Environment fallbacks so .env keeps working
const ENV = {
  seedance: () => ({ apiKey: process.env.SEEDANCE_API_KEY, model: process.env.SEEDANCE_MODEL, baseUrl: process.env.SEEDANCE_BASE_URL }),
  world: () => ({ apiKey: process.env.WORLD_API_KEY, baseUrl: process.env.WORLD_API_URL, model: process.env.WORLD_ENGINE }),
  elevenlabs: () => ({ apiKey: process.env.ELEVENLABS_API_KEY, voiceId: process.env.ELEVENLABS_VOICE_ID, baseUrl: process.env.ELEVENLABS_BASE_URL }),
  google: () => ({ apiKey: process.env.GOOGLE_API_KEY, baseUrl: process.env.GOOGLE_BASE_URL }),
  openai: () => ({ apiKey: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_BASE_URL }),
  midjourney: () => ({ apiKey: process.env.MIDJOURNEY_API_KEY, baseUrl: process.env.MIDJOURNEY_BASE_URL }),
  minimax: () => ({ apiKey: process.env.MINIMAX_API_KEY, model: process.env.MINIMAX_MODEL, baseUrl: process.env.MINIMAX_BASE_URL }),
  kling: () => ({ accessKey: process.env.KLING_ACCESS_KEY, secretKey: process.env.KLING_SECRET_KEY, baseUrl: process.env.KLING_BASE_URL, model: process.env.KLING_MODEL }),
  qwen: () => ({ apiKey: process.env.DASHSCOPE_API_KEY, videoModel: process.env.DASHSCOPE_VIDEO_MODEL, imageModel: process.env.DASHSCOPE_IMAGE_MODEL, baseUrl: process.env.DASHSCOPE_BASE_URL }),
  qwentext: () => ({}), claude: () => ({}),
  wan: () => ({ apiKey: process.env.WAN_API_KEY, baseUrl: process.env.WAN_API_URL }),
  kie: () => ({ apiKey: process.env.KIE_API_KEY, baseUrl: process.env.KIE_BASE_URL, videoModel: process.env.KIE_VIDEO_MODEL, imageModel: process.env.KIE_IMAGE_MODEL, musicModel: process.env.KIE_MUSIC_MODEL }),
  tts: () => ({ apiKey: process.env.TTS_API_KEY, baseUrl: process.env.TTS_API_URL }),
  sam3d: () => ({ apiKey: process.env.SAM3D_API_KEY, baseUrl: process.env.SAM3D_API_URL }),
  realtime: () => ({ apiKey: process.env.REALTIME_API_KEY, baseUrl: process.env.REALTIME_API_URL }),
  email: () => ({ provider: process.env.EMAIL_PROVIDER, apiKey: process.env.EMAIL_API_KEY, from: process.env.EMAIL_FROM }),
  stripe: () => ({ secretKey: process.env.STRIPE_SECRET_KEY }), paypal: () => ({ clientId: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_SECRET, mode: process.env.PAYPAL_MODE }),
  airwallex: () => ({ clientId: process.env.AIRWALLEX_CLIENT_ID, apiKey: process.env.AIRWALLEX_API_KEY, env: process.env.AIRWALLEX_ENV }),
  moyasar: () => ({ secretKey: process.env.MOYASAR_SECRET_KEY }), tap: () => ({ secretKey: process.env.TAP_SECRET_KEY })
};
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));
export function cfg(key) { const st = S(); const saved = decrypt(st.providers[key]?.enc || st.payments[key]?.enc); return { ...clean((ENV[key] || (() => ({})))()), ...clean(saved) }; }
export const configured = (key) => { const c = cfg(key); return !!(c.apiKey || c.secretKey || c.accessKey || c.clientId); };
export function saveCfg(group, key, vals) { const st = S(); const cur = decrypt(st[group][key]?.enc); st[group][key] = { ...(st[group][key] || {}), enc: encrypt({ ...cur, ...clean(vals) }), updated: Date.now() }; save(); }
export function publicProviders() { return Object.fromEntries(Object.keys(ENV).filter((k) => !["stripe", "paypal", "airwallex", "moyasar", "tap"].includes(k)).map((k) => { const c = cfg(k); return [k, { configured: configured(k), ...Object.fromEntries(Object.entries(c).map(([f, v]) => [f + "Mask", /key|secret/i.test(f) ? mask(v) : v])) }]; })); }
export function publicPayments() { const st = S(); return Object.fromEntries(["stripe", "paypal", "airwallex", "moyasar", "tap"].map((k) => [k, { enabled: st.payments[k]?.enabled ?? (process.env.PAYMENT_PROVIDER === k), configured: configured(k) }])); }
export const featureOn = (k) => S().features[k] !== false;
export const modelOn = (k) => S().models[k] !== false;
export const price = (k, def) => S().prices[k] ?? def;
