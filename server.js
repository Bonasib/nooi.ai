import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireUser, firebaseWebConfig } from "./lib/auth.js";
import { user, save, uid } from "./lib/store.js";
import { createJob, publicJob } from "./lib/jobs.js";
import { analyzeSite } from "./lib/site.js";
import { MEDIA_DIR, publicUrl } from "./lib/media.js";
import { PROVIDERS } from "./providers/index.js";
import { kieDefault, kieAuto, KIE_BUILTIN } from "./providers/kie.js";
import { adapterFor } from "./providers/extra.js";
// which studio models currently run on Kie AI, and on which Kie model (shown on the model tiles)
function kieRoutes() { const o = {}; if (!configured("kie")) return o; for (const [cap, map] of Object.entries(KIE_BUILTIN)) for (const id of Object.keys(map)) { try { const r = adapterFor(cap, { kind: cap, model: id }, PROVIDERS); if (r && String(r.key).startsWith("kie@")) o[id] = r.key.slice(4); } catch {} } return o; }
import { llmConfigured, llmJson, llm, llmInfo } from "./providers/anthropic.js";
import { OAUTH, pkcePair } from "./social/oauth.js";
import { runPost } from "./lib/scheduler.js";
import { balance, charge, TEXT_PRICE, startCheckout, finishCheckout, findPayment, provider, providerName, enabledPayments, CATALOG } from "./lib/billing.js";
import { registerAdmin } from "./lib/admin.js";
import { streamTTS } from "./providers/elevenlabs.js";
import { testAll } from "./lib/health.js";
import { spawn } from "child_process";
import { saveBuffer } from "./lib/media.js";
import { LIMITS, planOf } from "./lib/plans.js";
import { refillPlans, priceTable, ENGINE_COST, engineCost, basePrice, CREDIT_FLOOR_USD, priceFactor } from "./lib/billing.js";
import { S as platform, featureOn, configured } from "./lib/settings.js";
import { createToken, listTokens, revokeToken, userFromToken } from "./lib/tokens.js";
import { handleMcp } from "./lib/mcp.js";
import { verify, canSendSignInLinks, signInLink, customTokenForEmail } from "./lib/auth.js";
import { newCode, checkCode } from "./lib/otp.js";
import { isStaff } from "./lib/admin.js";
import { registerShowcase } from "./lib/showcase.js";
import { registerScenes } from "./lib/scenes.js";
import { registerLearn } from "./lib/learn.js";
import { cbSig, findJob, pollOne } from "./lib/jobs.js";
import { registerGifts } from "./lib/gifts.js";
import { registerInvoices } from "./lib/invoices.js";
import { registerExplore } from "./lib/explore.js";
import { sendEmail, emailConfigured } from "./lib/email.js";
import { renderEmail } from "./public/email-templates.js";
import { uiLang, uiDict, uiTranslate, rateOk } from "./lib/uit.js";

const app = express();
app.use(cors({ origin: process.env.PUBLIC_BASE_URL || true }));
app.use(express.json({ limit: "12mb" }));
// The browser never sees which AI provider runs the models: every JSON answer says "engine" instead
// (keys kie/kieModel/kieRoutes → engine/engineModel/engineRoutes, "kie@model" → "engine@model"), and the admin
// may address the provider as "engine" (/v1/admin/providers/engine, modelCat[id].engineModel).
const ENG_KEY = /(^|_)kie(?=[A-Z_]|$)/;
const engStr = (s) => s.replace(/Kie AI/g, "AI engine").replace(/KIE AI/g, "AI ENGINE").replace(/(https?:\/\/)?(api\.|docs\.)?kie\.ai/gi, "the engine").replace(/\bkie@/g, "engine@").replace(/^kie$/, "engine").replace(/\bKie\b/g, "Engine");
const engOut = (v, d = 0) => d > 14 ? v : typeof v === "string" ? (/kie/i.test(v) ? engStr(v) : v) : Array.isArray(v) ? v.map((x) => engOut(x, d + 1))
  : v && typeof v === "object" && !(v instanceof Date) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [ENG_KEY.test(k) ? k.replace(ENG_KEY, "$1engine") : k, engOut(x, d + 1)])) : v;
app.use((req, res, next) => {
  req.url = req.url.replace(/^\/v1\/admin\/providers\/engine(?=\/|$|\?)/, "/v1/admin/providers/kie");
  const mc = req.body && req.body.modelCat; if (mc && typeof mc === "object") for (const v of Object.values(mc)) if (v && typeof v === "object" && "engineModel" in v) { v.kieModel = v.engineModel; delete v.engineModel; }
  const j = res.json.bind(res); res.json = (d) => j(engOut(d)); next();
});
app.set("trust proxy", 1);   // behind Nginx on the VPS
app.use("/media", express.static(MEDIA_DIR, { maxAge: "7d" }));
app.use(express.static(path.resolve("public")));
// On-device AI: ONNX Runtime's WebAssembly/WebGPU files come from our own server (npm onnxruntime-web), and an
// optional local model mirror (MODELS_DIR, same layout as Hugging Face: <org>/<model>/resolve/main/…).
const ORT_DIR = path.resolve("node_modules/onnxruntime-web/dist");
const vendorHeaders = (res, f) => { if (f.endsWith(".mjs")) res.setHeader("Content-Type", "text/javascript"); if (f.endsWith(".wasm")) res.setHeader("Content-Type", "application/wasm"); };
const TF_DIR = path.resolve("node_modules/@huggingface/transformers/dist");
if (fs.existsSync(TF_DIR)) app.use("/vendor/transformers", express.static(TF_DIR, { maxAge: "30d", immutable: true, setHeaders: vendorHeaders }));
const THREE_DIR = path.resolve("node_modules/three");
if (fs.existsSync(THREE_DIR)) { app.use("/vendor/three/build", express.static(THREE_DIR + "/build", { maxAge: "30d", immutable: true })); app.use("/vendor/three/examples/js", express.static(THREE_DIR + "/examples/js", { maxAge: "30d", immutable: true })); }
app.use("/vendor/ort", express.static(ORT_DIR, { maxAge: "30d", immutable: true, setHeaders: vendorHeaders }));
if (process.env.MODELS_DIR) app.use("/models", express.static(path.resolve(process.env.MODELS_DIR), { maxAge: "30d" }));
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(e.code && e.code >= 400 && e.code < 600 ? e.code : 500).json({ error: e.message }));

app.get("/v1/health", (_, res) => res.json({ ok: true }));
app.get("/v1/config", (_, res) => res.json({
  firebase: firebaseWebConfig(), localAI: { tfUrl: fs.existsSync(TF_DIR + "/transformers.min.js") ? "/vendor/transformers/transformers.min.js" : null, ortBase: fs.existsSync(ORT_DIR) ? "/vendor/ort/" : null, modelsHost: process.env.MODELS_DIR ? "/models/" : null, models: platform().localModels || {} }, emailCode: canSendSignInLinks() && emailConfigured(), kieRoutes: kieRoutes(),
  llm: llmConfigured() ? { provider: llmInfo().provider, model: llmInfo().model } : null,
  billing: enabledPayments().length > 0, payments: enabledPayments(), modelLogos: platform().modelLogos || {}, worldEngine: !!(process.env.WORLD_API_URL || (platform().providers || {}).world), modelCat: Object.fromEntries(Object.entries(platform().modelCat || {}).map(([k, v]) => [k, { cr: v.cr, verified: !!v.verified, kie: !!v.kieModel }])), features: platform().features, models: platform().models, prices: priceTable(), support: "contact@nooi.ai",
  providers: { ...Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, p.configured || !!kieDefault(k) || !!kieAuto(k, { kind: k === "tts" ? "voice" : k })])), kie: configured("kie"), llm: llmConfigured(), auth: !!firebaseWebConfig(), social: Object.values(OAUTH).some((o) => o.configured()), realtime: !!process.env.REALTIME_API_URL, billing: enabledPayments().length > 0 }
}));

// Uploads (start frames, references, exports, music…)
const upload = multer({ storage: multer.diskStorage({ destination: MEDIA_DIR, filename: (_, f, cb) => cb(null, uid() + (path.extname(f.originalname) || ".bin").toLowerCase()) }), limits: { fileSize: 1024 * 1024 * 1024 } });
app.post("/v1/uploads", requireUser, upload.single("file"), (req, res) => res.json({ url: publicUrl(req.file.filename) }));

// Generation jobs → provider adapters
app.post("/v1/jobs", requireUser, wrap(async (req, res) => res.json(publicJob(await createJob(req.user, req.body), isStaff(req.user)))));
app.get("/v1/jobs/:id", requireUser, (req, res) => { const j = user(req.user.uid).jobs[req.params.id]; j ? res.json(publicJob(j, isStaff(req.user))) : res.status(404).json({ error: "Not found" }); });

// AI text
app.post("/v1/analyze-site", requireUser, wrap(async (req, res) => { if (!llmConfigured()) throw Object.assign(new Error("Add LLM_API_KEY (Claude or Qwen) to enable analysis"), { code: 501 }); res.json(await analyzeSite(req.body)); }));
app.post("/v1/llm/json", requireUser, wrap(async (req, res) => {
  if (!llmConfigured()) throw Object.assign(new Error("Add LLM_API_KEY (Claude or Qwen)"), { code: 501 });
  const tier = ["quick", "default", "complex"].includes(req.body.tier) ? req.body.tier : "default";
  const cost = TEXT_PRICE[tier]; if (cost) charge(req.user.uid, cost, "AI text · " + (req.body.task || tier));
  const images = (Array.isArray(req.body.images) ? req.body.images : []).filter((d) => typeof d === "string" && d.startsWith("data:image/") && d.length < 8e6).slice(0, 2);
  res.json(await llmJson(String(req.body.prompt || "").slice(0, 30000), { maxTokens: tier === "complex" ? 8000 : 3000, tier, images, provider: req.body.provider }));
}));

// Shared interface translations (public: the marketing page is translated before sign-in; no credits used)
app.get("/v1/ui-t/:lang", (req, res) => { const l = uiLang(req.params.lang); if (!l) return res.status(404).json({ error: "Unknown language" }); res.set("Cache-Control", "public, max-age=300"); res.json({ t: uiDict(l) }); });
app.post("/v1/ui-t/:lang", wrap(async (req, res) => {
  const l = uiLang(req.params.lang); if (!l) throw Object.assign(new Error("Unknown language"), { code: 404 });
  if (!rateOk(req.ip)) throw Object.assign(new Error("Too many translation requests — try again in a few minutes"), { code: 429 });
  res.json({ t: await uiTranslate(l, req.body && req.body.strings) });
}));

app.get("/v1/llm/test", requireUser, wrap(async (req, res) => {
  if (!llmConfigured()) throw Object.assign(new Error("Set LLM_API_KEY (and LLM_BASE_URL + LLM_MODEL for Qwen) in .env"), { code: 501 });
  const t0 = Date.now(); const reply = await llm("Reply with exactly: OK", { maxTokens: 20, timeoutMs: 30000 });
  res.json({ ok: true, reply: reply.trim(), ms: Date.now() - t0, ...llmInfo() });
}));

// ---- Billing
app.get("/v1/billing", requireUser, (req, res) => { const u = user(req.user.uid); const staff = isStaff(req.user); const plan = staff ? "studio" : planOf(u); res.json({ cid: u.cid, credits: balance(req.user.uid), plan, staff, limits: LIMITS[plan], planUntil: u.planUntil || null, ledger: (u.ledger || []).slice(0, 50) }); });

// Branded sign-in email: the server makes the Firebase sign-in link and sends it with the nooi.ai design.
// Public (people aren't signed in yet) → rate-limited per IP and per address. 501 = not set up → the browser
// falls back to Firebase's own email.
const linkHits = new Map();
const tooMany = (key, max) => { const now = Date.now(), h = linkHits.get(key) || []; const recent = h.filter((t) => now - t < 3600e3); recent.push(now); linkHits.set(key, recent); if (linkHits.size > 5000) linkHits.clear(); return recent.length > max; };
// 6-digit email code (needs FIREBASE_SERVICE_ACCOUNT + an email provider). The code is typed on the same page,
// so sign-in never depends on which browser opens the email.
const emailOf = (req) => { const e = String(req.body?.email || "").trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 200) throw Object.assign(new Error("Enter a valid email address"), { code: 400 }); return e; };
app.post("/v1/auth/email-code", wrap(async (req, res) => {
  const email = emailOf(req), lang = req.body?.lang === "ar" ? "ar" : "en";
  if (!canSendSignInLinks() || !emailConfigured()) throw Object.assign(new Error("Email codes are not set up"), { code: 501 });
  if (tooMany("ip:" + req.ip, 10) || tooMany("em:" + email, 5)) throw Object.assign(new Error("Too many requests — try again later"), { code: 429 });
  const base = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const m = renderEmail("signin", { lang, code: newCode(email), base });
  await sendEmail({ to: email, subject: m.subject, text: m.text, html: m.html });
  res.json({ sent: true });
}));
app.post("/v1/auth/email-verify", wrap(async (req, res) => {
  const email = emailOf(req);
  if (tooMany("vip:" + req.ip, 40)) throw Object.assign(new Error("Too many requests — try again later"), { code: 429 });
  const r = checkCode(email, String(req.body?.code || "").replace(/\D/g, ""));
  if (r !== "ok") throw Object.assign(new Error({ wrong: "Wrong code", expired: "Code expired", locked: "Too many attempts" }[r]), { code: 400, reason: r });
  res.json({ token: await customTokenForEmail(email) });
}));
app.post("/v1/auth/email-link", wrap(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase(), lang = req.body?.lang === "ar" ? "ar" : "en";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) throw Object.assign(new Error("Enter a valid email address"), { code: 400 });
  if (!canSendSignInLinks() || !emailConfigured()) throw Object.assign(new Error("Branded sign-in email is not set up"), { code: 501 });
  if (tooMany("ip:" + req.ip, 10) || tooMany("em:" + email, 5)) throw Object.assign(new Error("Too many requests — try again later"), { code: 429 });
  const base = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const link = await signInLink(email, `${base}/?e=${encodeURIComponent(email)}`);
  const m = renderEmail("signin", { lang, link, base });
  await sendEmail({ to: email, subject: m.subject, text: m.text, html: m.html });
  res.json({ sent: true });
}));
app.post("/v1/billing/checkout", requireUser, wrap(async (req, res) => {
  if (!featureOn("payments")) throw Object.assign(new Error("Payments are paused"), { code: 403 });
  const name = providerName(req.body.provider); const P = provider(req.body.provider); if (!P) throw Object.assign(new Error("Payments are not connected yet"), { code: 501 });
  const c = startCheckout(req.user.uid, req.body.annual && CATALOG[req.body.item + "_y"] ? req.body.item + "_y" : req.body.item, name === "paypal" ? "USD" : req.body.currency, req.body.coupon, { gift: req.body.gift, email: req.user.email });
  const r = await P.create({ ...c, email: req.user.email });
  const pay = user(req.user.uid).payments[c.ref]; pay.providerId = r.id; pay.provider = name; save(); res.json(r.url ? { url: r.url } : { airwallex: r.airwallex });
}));
app.get("/v1/billing/return", wrap(async (req, res) => {
  const ref = String(req.query.ref || ""); const owner = findPayment(ref); if (!owner) return res.redirect("/#account");
  const p = user(owner).payments[ref]; try { await finishCheckout(owner, ref, req.query.id || p.providerId); } catch (e) { console.warn("payment", e.message); }
  const pd = user(owner).payments[ref]; res.redirect("/?paid=" + (pd.status === "paid" ? "1" : "0") + (pd.giftCode ? "&gift=" + encodeURIComponent(pd.giftCode) : "") + (pd.invoice ? "&inv=" + encodeURIComponent(pd.invoice) : "") + (pd.giftCode ? "#wallet" : "#account"));
}));
app.post("/v1/billing/webhook/:provider", wrap(async (req, res) => {
  // Never trust the webhook body: we re-fetch the payment from the provider before crediting.
  const b = req.body || {}; const id = b.id || b.data?.id || b.data?.object?.id; const ref = b.reference?.transaction || b.metadata?.ref || b.data?.metadata?.ref || b.data?.object?.client_reference_id;
  const owner = ref && findPayment(ref); if (owner) { try { await finishCheckout(owner, ref, id); } catch (e) { console.warn("webhook", e.message); } }
  res.json({ received: true });
}));
app.get("/v1/billing/catalog", (_, res) => res.json(CATALOG));

registerAdmin(app, requireUser);
// admin: engine cost per model → credits charged → margin; costs and margin are editable (prices recompute)
const PR_NAMES = { seedance: "Seedance 2 Fast", wan27: "WAN 2.7", kling: "Kling", kling26: "Kling 2.6", hailuo: "MiniMax", hailuoh3: "MiniMax H3", pixverse6: "PixVerse 6", grok: "Grok Imagine", wan30: "WAN 3.0", seedance20: "Seedance 2.0", kling30: "Kling 3.0", seedance25: "Seedance 2.5", veo31f: "Veo 3.1 Fast", veo31: "Veo 3.1",
  nano: "Nano Banana", dotimg: "nooi Image", nanopro: "Nano Banana Pro", img20: "GPT Image 2", img25: "Seedream 4.5", seedream5: "Seedream 5", qwen: "Qwen Image", flux2: "FLUX.2", mj: "Midjourney", imagen4: "Imagen 4", ideogram3: "Ideogram 3", grokimg: "Grok Image", voice: "Voice", music: "Music", sfx: "Sound effect", bg: "Background removal", finish: "Upscale", lipsync: "Lip-sync avatar" };
const pricingRows = () => Object.entries(ENGINE_COST).flatMap(([g, m]) => Object.keys(m).map((id) => { const cost = engineCost(g, id), credits = basePrice(g, id), rev = credits * CREDIT_FLOOR_USD;
  return { id, group: g, name: PR_NAMES[id] || id, cost: +cost.toFixed(4), credits, override: platform().prices?.[id] != null, margin: cost ? Math.round((rev / cost - 1) * 100) : 0 }; }).sort((a, b) => b.credits - a.credits));   // strongest (most credits) first
app.get("/v1/admin/pricing", requireUser, (req, res) => { if (!isStaff(req.user)) return res.status(403).json({ error: "Not allowed" }); res.json({ rows: pricingRows(), factor: priceFactor(), floor: CREDIT_FLOOR_USD }); });
app.put("/v1/admin/pricing", requireUser, (req, res) => { if (!isStaff(req.user)) return res.status(403).json({ error: "Not allowed" });
  const st = platform(), b = req.body || {}; st.costs = st.costs || {};
  for (const [id, v] of Object.entries(b.costs || {})) { const n = +v; if (Object.values(ENGINE_COST).some((m) => id in m) && n >= 0 && n < 50) st.costs[id] = n; }
  if (b.factor != null) { const f = +b.factor; if (f >= 1 && f <= 10) st.priceFactor = f; }
  save(); res.json({ rows: pricingRows(), factor: priceFactor(), floor: CREDIT_FLOOR_USD }); });
// the engine calls back when a job is ready → check it now (the body is never trusted; we poll the job ourselves)
app.post("/v1/engine/cb/:id/:sig", (req, res) => { if (req.params.sig === cbSig(req.params.id)) { const f = findJob(req.params.id); if (f) pollOne(f[0], f[1]); } res.json({ ok: true }); });
registerScenes(app);
registerLearn(app);
registerExplore(app); registerShowcase(app); registerGifts(app); registerInvoices(app);
// Low-latency voice preview (ElevenLabs stream, key never leaves the server)
app.post("/v1/tts/stream", requireUser, async (req, res) => { try { const { planOf } = await import("./lib/plans.js"); const plan = planOf(user(req.user.uid)); if (!["pro", "studio"].includes(plan)) return res.status(402).json({ error: "ElevenLabs voices start from the Pro plan" }); await streamTTS(res, req.body || {}); } catch (e) { if (!res.headersSent) res.status(502).json({ error: e.message }); } });
// Export: convert a browser WebM recording to MP4 (H.264/AAC) with ffmpeg
app.post("/v1/media/transcode", requireUser, express.raw({ type: ["video/webm", "application/octet-stream"], limit: "300mb" }), (req, res) => {
  const inp = saveBuffer(req.body, ".webm"), outName = inp.name.replace(/\.webm$/, ".mp4"), out = inp.file.replace(/\.webm$/, ".mp4");
  const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-y", "-i", inp.file, "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", out]);
  p.on("error", (e) => res.status(500).json({ error: "ffmpeg: " + e.message })); p.on("close", (code) => code === 0 ? res.json({ url: (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + "/media/" + outName }) : res.status(500).json({ error: "ffmpeg exited " + code }));
});
setInterval(() => testAll().catch(() => {}), 15 * 60e3);

// ---- API tokens (MCP, Blender, Unity)
app.get("/v1/tokens", requireUser, (req, res) => res.json({ tokens: listTokens(req.user.uid) }));
app.post("/v1/tokens", requireUser, (req, res) => { if (req.user.viaToken) return res.status(403).json({ error: "Create tokens from the app" }); if (!LIMITS[planOf(user(req.user.uid))].api) return res.status(402).json({ error: "API & MCP access is part of the Studio plan" }); res.json({ token: createToken(req.user.uid, req.body.name) }); });
app.delete("/v1/tokens/:id", requireUser, (req, res) => { revokeToken(req.user.uid, req.params.id); res.json({ ok: true }); });

// ---- Assets & jobs list (library sync, Blender/Unity)
app.get("/v1/jobs", requireUser, (req, res) => res.json({ jobs: Object.values(user(req.user.uid).jobs).sort((a, b) => b.created - a.created).slice(0, 100).map(publicJob) }));
app.get("/v1/assets", requireUser, (req, res) => { const k = req.query.kind; res.json({ assets: Object.values(user(req.user.uid).jobs).filter((j) => j.status === "done" && j.url && (!k || j.kind === k)).sort((a, b) => b.created - a.created).slice(0, 100).map((j) => ({ id: j.id, kind: j.kind, title: j.title, url: j.url })) }); });
app.post("/v1/assets", requireUser, (req, res) => { const U = user(req.user.uid); const id = uid(); U.jobs[id] = { id, kind: req.body.kind || "3d", status: "done", progress: 1, url: req.body.url, title: req.body.title || "Imported", created: Date.now(), payload: {} }; save(); res.json({ id }); });

// ---- Realtime sketch → image (proxy to your realtime model; throttled per user)
const lastRT = new Map();
app.post("/v1/realtime/sketch", requireUser, wrap(async (req, res) => {
  if (!process.env.REALTIME_API_URL) throw Object.assign(new Error("Realtime model not connected"), { code: 501 });
  const now = Date.now(); if (now - (lastRT.get(req.user.uid) || 0) < 300) return res.status(429).json({ error: "slow down" }); lastRT.set(req.user.uid, now);
  const r = await fetch(process.env.REALTIME_API_URL, { method: "POST", headers: { Authorization: "Bearer " + (process.env.REALTIME_API_KEY || ""), "Content-Type": "application/json" }, body: JSON.stringify({ image: req.body.image, prompt: [req.body.prompt, req.body.target, req.body.style].filter(Boolean).join(", "), strength: req.body.strength }) });
  const d = await r.json().catch(() => ({})); const image = d.image || d.output?.[0] || d.images?.[0]?.url || d.url; if (!image) throw new Error("No image from realtime model"); res.json({ image });
}));

// ---- MCP endpoint (Claude · ChatGPT · Qwen · Cursor …). Auth: Bearer nooi_… or ?token=nooi_…
app.post("/mcp", async (req, res) => {
  const h = req.headers.authorization || ""; const t = h.startsWith("Bearer ") ? h.slice(7) : req.query.token;
  const u = userFromToken(t) || (await verify(t)); if (!u) return res.status(401).set("WWW-Authenticate", "Bearer").json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid or missing nooi.ai token" } });
  const body = req.body; const msgs = Array.isArray(body) ? body : [body];
  const out = (await Promise.all(msgs.map((m) => handleMcp(u.uid, m)))).filter(Boolean);
  if (!out.length) return res.status(202).end();
  res.json(Array.isArray(body) ? out : out[0]);
});
app.get("/mcp", (_, res) => res.status(405).set("Allow", "POST").end());

// Posts & scheduling
app.get("/v1/posts", requireUser, (req, res) => res.json({ posts: Object.values(user(req.user.uid).posts).map((p) => ({ id: p.id, clientId: p.clientId, status: p.status, error: p.error || "", at: p.at })) }));
app.post("/v1/posts", requireUser, wrap(async (req, res) => {
  const u = user(req.user.uid), b = req.body;
  let post = Object.values(u.posts).find((p) => p.clientId === b.id);
  if (!post) { post = { id: uid(), clientId: b.id }; u.posts[post.id] = post; }
  Object.assign(post, { title: b.title || "", caption: b.caption || "", hashtags: b.hashtags || "", platforms: b.platforms || [], format: b.format || "post", mediaUrl: b.mediaUrl || null, at: b.at || null, status: b.publishNow ? "publishing" : b.status === "draft" ? "draft" : "scheduled", error: "" });
  save(); if (b.publishNow) runPost(u, post).catch(() => {});
  res.json({ id: post.id, status: post.status });
}));
app.delete("/v1/posts/:id", requireUser, (req, res) => { delete user(req.user.uid).posts[req.params.id]; save(); res.json({ ok: true }); });

// Connected accounts (OAuth)
const pending = new Map();
app.get("/v1/accounts", requireUser, (req, res) => { const a = user(req.user.uid).accounts; res.json({ accounts: Object.fromEntries(Object.keys(a).map((k) => [k, true])) }); });
app.get("/v1/oauth/:p/start", requireUser, (req, res) => {
  const key = OAUTH[req.params.p]?.alias || req.params.p, o = OAUTH[key];
  if (!o || !o.configured()) return res.status(501).send("This platform's app keys are not set on the server yet.");
  const state = uid(), pk = o.pkce ? pkcePair() : null;
  pending.set(state, { uid: req.user.uid, key, verifier: pk && pk.verifier, t: Date.now() });
  res.redirect(o.authUrl(state, pk && pk.challenge));
});
app.get("/v1/oauth/:p/callback", async (req, res) => {
  const st = pending.get(req.query.state); pending.delete(req.query.state);
  const done = (msg) => res.send(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#060706;color:#eee;display:grid;place-items:center;height:100vh"><p>${msg}</p><script>setTimeout(()=>window.close(),1500)</script>`);
  if (!st || Date.now() - st.t > 15 * 60e3) return done("Session expired — try again.");
  try { Object.assign(user(st.uid).accounts, await OAUTH[st.key].exchange(req.query.code, st.verifier)); save(); done("✓ Connected. You can close this window."); }
  catch (e) { done("Connection failed: " + e.message); }
});
app.delete("/v1/oauth/:p", requireUser, (req, res) => { delete user(req.user.uid).accounts[req.params.p]; save(); res.json({ ok: true }); });

const port = process.env.PORT || 8080;
setInterval(refillPlans, 6 * 3600e3); refillPlans();
app.listen(port, () => console.log(`nooi.ai Studio server → http://localhost:${port}`));
