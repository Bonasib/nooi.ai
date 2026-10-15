import crypto from "crypto";
import { user, allUsers, save, uid } from "./store.js";
import { PROVIDERS, capFor } from "../providers/index.js";
import { adapterFor, adapterByKey } from "../providers/extra.js";
import { kieAuto, kieDur } from "../providers/kie.js";
import { nvRoute } from "../providers/nvidia.js";
import { gen3dRoute } from "../providers/gen3d.js";
import { featureOn, modelOn } from "./settings.js";
import { checkEntitlement } from "./plans.js";
import { isStaff } from "./admin.js";
const FEATURE = { video: "video", chapter: "story", image: "image", look: "chars", sheet: "chars", edit: "edit", bg: "fx", mocap: "fx", voice: "voice", voiceclone: "voice", voiceconvert: "voice", world: "world", lipsync: "voice", music: "voice", sfx: "voice", finish: "finish", transcribe: "subs", dub: "subs", "3d": "studio3d", track3d: "studio3d", view3d: "studio3d", place3d: "studio3d" };
import { download, lastFrame, MEDIA_DIR, localPath } from "./media.js";
import fs from "fs";
import path from "path";
import { priceOf, credit, hold, settle, release } from "./billing.js";
import { moderate } from "./moderation.js";
import { withRetry, classify, USER_MSG } from "./errors.js";
import { cleanChain } from "./recipes.js";
import { tokenCheck, tokenSpend } from "./tokens.js";
import { piperOn, backupVoiceFile } from "../providers/piper.js";

// other modules react to finished jobs (scenes keep their latest frame and check the result)
export const jobHooks = { before: [], done: [], fail: [] };
const runDone = (uidv, job) => { for (const f of jobHooks.done) Promise.resolve().then(() => f(uidv, job)).catch((e) => console.warn("job hook", e.message)); };
export async function createJob(u, body) {
  for (const f of jobHooks.before) await f(u, body);
  if (process.env.GPU_FEATURES !== "true" && ["3d", "track3d", "view3d", "place3d"].includes(body.kind) && !(body.kind === "3d" && (nvRoute("sam3d", body) || gen3dRoute("sam3d", body)))) throw Object.assign(new Error("3D generation is not available yet"), { code: 403 });
  const flag = moderate((body.prompt || "") + " " + (body.meta?.refs || []).map((r) => r.description).join(" "));
  if (flag) throw Object.assign(new Error("Blocked by the Acceptable Use Policy (" + flag + ")"), { code: 422 });
  // an avatar speaks the typed words: the "bring this picture to life" motion line is not a script (and would be spoken aloud)
  if (body.kind === "lipsync" && !(body.inputs || {}).lsA && /^\s*(bring this picture to life|حرّ?ك هذه الصورة)/i.test(String(body.prompt || ""))) throw Object.assign(new Error("Type what the avatar should say — that line moves a picture, it isn't speech"), { code: 400 });
  if (body.kind === "voiceclone" && !body.meta?.consent) throw Object.assign(new Error("Voice cloning needs the speaker's consent"), { code: 400 });
  if (FEATURE[body.kind] && !featureOn(FEATURE[body.kind])) throw Object.assign(new Error("This feature is turned off"), { code: 403 });
  if (body.model && !modelOn(body.model)) throw Object.assign(new Error("This model is turned off"), { code: 403 });
  const cap = capFor(body.kind, body.meta);
  const route = cap && adapterFor(cap, body, PROVIDERS); const prov = route && route.a;
  if (!prov) throw Object.assign(new Error("Unknown job kind: " + body.kind), { code: 400 });
  if (!prov.configured) throw Object.assign(new Error(isStaff(u) ? `${prov.name} is not connected yet — add its API URL and key to the server .env or the admin dashboard` : "This engine isn't available right now — pick another model or try again soon. Nothing was charged."), { code: 501 });
  // one request = one job: the same request sent twice (a double tap, a network retry) gets the job already made
  if (body.meta?.chain) body.meta = { ...body.meta, chain: cleanChain(body.meta.chain) };
  const key = reqKey(body), dup = dupJob(u.uid, key, body); if (dup) return dup;   // the request as sent (before the length is fitted to the engine)
  checkJob(body, route);                                              // problems we can see now are refused before anything is charged
  // a video is priced for the length the engine really makes (e.g. 5 or 10 s for Kling 2.6, 8 s for Veo)
  if (["video", "chapter"].includes(body.kind) && String(route.key || "").startsWith("kie@") && !(+body.meta?.parts > 1)) { const real = kieDur(route.key.slice(4), body.dur); if (real && real !== Math.round(+body.dur || 5)) { body.meta = { ...(body.meta || {}), durAsked: +body.dur || 5 }; body.dur = real; } }
  // owners & admins test every model on the Studio plan without spending credits
  const staff = isStaff(u);
  if (!staff) checkEntitlement(user(u.uid), body);
  // nooi Studio 2.0: a long video may use a different engine model for each part (picked by the bots)
  const partModels = body.kind === "video" && +body.meta?.parts > 1 && Array.isArray(body.meta?.partModels) ? body.meta.partModels.slice(0, 6).map(String) : null;
  if (partModels) for (const m of partModels) { if (!modelOn(m)) throw Object.assign(new Error("This model is turned off"), { code: 403 }); if (!staff) checkEntitlement(user(u.uid), { ...body, model: m, dur: 0 }); }
  const price = priceOf(body.kind, body) + (body.kind === "video" ? ({ 60: 2, 120: 4 })[+body.meta?.fps] || 0 : 0), cost = staff ? 0 : price;
  tokenCheck(u, price);                                               // a connection (API token): read-only, or over its daily limit → refused
  const jid = uid();
  if (cost) hold(u.uid, cost, (body.kind || "job") + " · " + String(body.prompt || "").slice(0, 40), jid);   // held now, charged when it finishes
  const job = { id: jid, kind: body.kind, cap, prov: route.key, status: "queued", progress: 0, created: Date.now(), payload: body, cost, title: body.title || body.prompt || "", ...(u.viaToken && u.tokenId ? { tok: u.tokenId } : {}) };
  user(u.uid).jobs[job.id] = job; rememberJob(u.uid, key, job.id); tokenSpend(u, price); save();
  const parts = body.kind === "video" ? Math.min(6, Math.max(1, +body.meta?.parts || 1)) : 1;
  // a storyboard: each part starts from its scene's picture (instead of the previous part's last frame)
  const pub0 = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""), abs = (u) => (/^\/media\//.test(u) ? pub0 + u : u);
  const pimg = body.kind === "video" && Array.isArray(body.meta?.partImages) ? body.meta.partImages.slice(0, 6).map((u) => (typeof u === "string" && /^(https?:\/\/|\/media\/)/.test(u) ? abs(u) : null)) : null;
  if (pimg && parts === 1 && pimg[0] && !(body.inputs || {}).startImage) body.inputs = { ...(body.inputs || {}), startImage: pimg[0] };
  if (parts > 1) {                      // long video: N connected parts, each continuing from the previous last frame
    const per = Math.ceil((+body.dur || 5) / parts); let prev = null; job.children = []; job.status = "rendering";
    for (let i = 0; i < parts; i++) {
      const pm = partModels && partModels[i], croute = pm && pm !== body.model ? adapterFor(cap, { ...body, model: pm }, PROVIDERS) || route : route;
      const child = { id: uid(), kind: "video", cap, prov: croute.key, status: "queued", progress: 0, created: Date.now(), parent: job.id, cost: 0, title: `${job.title} · ${i + 1}/${parts}`,
        payload: { ...body, ...(pm ? { model: pm } : {}), dur: per, chainAfter: pimg && pimg[i] ? null : prev, ...(pimg && pimg[i] ? { inputs: { ...(body.inputs || {}), startImage: pimg[i] } } : {}), meta: { ...(body.meta || {}), parts: 1, part: i + 1 }, prompt: body.meta?.shots?.[i] ? `${body.meta.shots[i]}${body.meta.bible ? "\n\nContinuity: " + body.meta.bible : ""}${i && !(pimg && pimg[i]) ? ` — continue seamlessly from the previous shot (part ${i + 1} of ${parts}), same characters, place and light` : pimg && pimg[i] ? " — bring this storyboard picture to life: same characters, place, light and style" : ""}` : i ? `${body.prompt} — continue seamlessly (part ${i + 1} of ${parts}), same characters, place and light` : body.prompt } };
      user(u.uid).jobs[child.id] = child; job.children.push(child.id); prev = child.id;
      start(child).catch((e) => fail(u.uid, child, e));
    }
    save(); return job;
  }
  start(job).catch((e) => fail(u.uid, job, e));
  return job;
}
async function start(job) {
  const p = job.payload; p.inputs = p.inputs || {};
  // Chapter Story: start this chapter from the last frame of the previous one
  // Long videos are split into parts: each part waits for the previous one, then continues from its last frame
  if (p.chainAfter) { const U = allUsers().find(([, u]) => u.jobs[p.chainAfter]); const prev = U && U[1].jobs[p.chainAfter]; const t0 = Date.now();
    while (prev && prev.status !== "done" && prev.status !== "failed" && Date.now() - t0 < 30 * 60e3) await new Promise((r) => setTimeout(r, 1500));
    if (prev && prev.status === "done") p.chainFrom = prev.url; else if (prev) throw Object.assign(new Error("The previous part failed"), { type: "input" }); }
  if (p.chainFrom) { try { p.inputs.startImage = await lastFrame(p.chainFrom); } catch (e) { console.warn("chain frame:", e.message); } }
  // the engine calls us back the moment the job is ready (we still re-check its status ourselves)
  const pub = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""); if (pub && /^https:/.test(pub)) p.callbackUrl = `${pub}/v1/engine/cb/${job.id}/${cbSig(job.id)}`;
  const r = await withRetry(() => adapterByKey(job.prov || job.cap, PROVIDERS).submit(p));
  if (r.sent) job.sent = r.sent;
  if (r.done) await finish(job, r.url, r.segments); else { job.remoteId = r.remoteId; job.status = "rendering"; save(); }
}
export const cbSig = (id) => crypto.createHmac("sha256", process.env.SECRET_KEY || "nooi").update("cb:" + id).digest("hex").slice(0, 24);
async function finish(job, url, segments) {
  job.progress = 1; if (segments) job.segments = segments;
  // keep a copy on our server (an adapter that already saved its files here — World Labs — is not downloaded twice)
  if (process.env.MIRROR_MEDIA !== "false" && url && !localPath(url)) { try { url = (await download(url)).url; } catch (e) { console.warn("mirror:", e.message); } }
  job.url = url; job.status = "done"; save();
  const owner = allUsers().find(([, U]) => U.jobs && U.jobs[job.id]); if (owner) { if (job.cost) settle(owner[0], job.id); runDone(owner[0], job); }
}
// A Kie AI model that rejects or fails a job → try the next Kie model once or twice before refunding.
// Same key, so a bad key or an empty Kie balance doesn't fall back.
const KIE_FALLBACK = { image: ["nano", "img25", "img20", "qwen"], video: ["kling", "seedance", "wan27", "hailuo"], lipsync: ["kling/ai-avatar-standard", "infinitalk/from-audio", "kling/ai-avatar-pro"] };
function fallback(uidv, job, msg) {
  const c = classify(msg instanceof Error ? msg : new Error(String(msg)));
  // a voiceover whose engine voice failed → the backup voice on our own server (free for the client)
  if (job.kind === "voice" && !job.triedBackup && piperOn() && String(job.payload?.prompt || "").trim()) {
    job.triedBackup = true; job.errors = [...(job.errors || []), `${job.prov}: ${c.message}`.slice(0, 300)]; job.status = "rendering"; save();
    backupVoiceFile(job.payload.prompt, job.payload.meta?.lang).then((url) => { if (job.cost && !job.refunded) { job.refunded = true; release(uidv, job.id); } job.cost = 0; job.backupVoice = true; job.sent = { prompt: String(job.payload.prompt).slice(0, 4000), voice: "backup" }; return finish(job, url); })
      .catch((e) => { job.errors.push("backup voice: " + String(e.message || e).slice(0, 160)); fail(uidv, job, msg); });
    return true;
  }
  // NVIDIA AI failed → the same job on the site's other engine (once)
  if (String(job.prov || "").startsWith("nv@") && !(msg && msg.noFallback) && !job.parent && !job.children) {
    let r = null; try { r = adapterFor(job.cap, { ...job.payload, noNv: true }, PROVIDERS); } catch {}
    if (r && r.a && r.a.configured) { console.warn("job", job.id, "· NVIDIA failed:", c.message.slice(0, 200), "→", r.key); job.errors = [...(job.errors || []), `${job.prov}: ${c.message}`.slice(0, 300)];
      job.prov = r.key; delete job.remoteId; job._pollErr = 0; job.status = "queued"; save(); start(job).catch((e) => fail(uidv, job, e)); return true; } return false; }
  // Model Studio 3D failed (e.g. not offered in the key's region) → the same model on the site's other 3D engine (once)
  if (job.prov === "ms3d" && !(msg && msg.noFallback) && !job.parent && !job.triedMs3d) {
    const r = gen3dRoute(job.cap, { ...job.payload, noMs3d: true });
    if (r && r.a && r.a.configured) { job.triedMs3d = true; job.errors = [...(job.errors || []), `ms3d: ${c.message}`.slice(0, 300)];
      job.prov = r.key; delete job.remoteId; job._pollErr = 0; job.status = "queued"; save(); start(job).catch((e) => fail(uidv, job, e)); return true; } }
  if (msg && msg.noFallback || /^mc(26|30)$/.test(job.payload?.model || "") || !String(job.prov || "").startsWith("kie@") || !KIE_FALLBACK[job.cap] || job.parent || job.children || ["auth", "quota"].includes(c.type) || /timed out/i.test(c.message)) return false;
  job.tried = job.tried || [job.prov.slice(4)]; if (job.tried.length >= 3) return false;
  for (const id of KIE_FALLBACK[job.cap]) {
    const km = job.cap === "lipsync" ? (/\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(String((job.payload.inputs || {}).lsV || "")) ? null : id) : kieAuto(job.cap, { ...job.payload, model: id });   // a face photo can move with any avatar model
    if (!km || job.tried.includes(km)) continue;
    console.warn("job", job.id, "·", job.prov, "failed:", c.message.slice(0, 200), "→ trying kie@" + km);
    job.errors = [...(job.errors || []), `${job.prov}: ${c.message}`.slice(0, 300)];
    job.tried.push(km); job.prov = "kie@" + km; delete job.remoteId; job._pollErr = 0; job.status = "queued"; save();
    start(job).catch((e) => fail(uidv, job, e)); return true;
  }
  return false;
}
function fail(uidv, job, msg) { if (fallback(uidv, job, msg)) return; for (const f of jobHooks.fail) { try { f(uidv, job, msg); } catch (e) { console.warn("fail hook:", e.message); } } console.warn("job", job.id, "·", job.kind, "·", job.prov, "failed:", String(msg && msg.message || msg).slice(0, 300));
  const c = classify(msg instanceof Error ? msg : new Error(String(msg))); job.status = "failed"; job.errorType = c.type; job.error = (msg && msg.userMsg) || USER_MSG[c.type] || String(msg); job.errorDetail = String(msg).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300); if (job.cost && !job.refunded) { job.refunded = true; if (!release(uidv, job.id)) credit(uidv, job.cost, "Refund · failed " + job.kind, job.id); } save(); }
// ---- a recipe: when a step is made, the next step starts from its result (charged when it starts, like any job)
const SLOT_OF = { video: "startImage", image: "iRef", finish: "fin" };
jobHooks.done.push(async (uidv, job) => {
  const m = job.payload?.meta || {}, chain = m.chain; if (!Array.isArray(chain) || !chain.length || job.next || !job.url) return;
  const [s, ...rest] = chain, step = (m.step || 0) + 1, meta = { ...(s.meta || {}), chain: rest, recipe: m.recipe || null, step, chainOf: job.id, ...(s.kind === "finish" ? { tool: s.meta?.tool || "upscale", isVideo: job.kind !== "image" } : {}) };
  const body = { kind: s.kind, model: s.model, prompt: s.prompt || "", dur: s.dur, aspect: job.payload.aspect, meta, inputs: SLOT_OF[s.kind] ? { [SLOT_OF[s.kind]]: job.url } : {}, ...(job.payload.cid ? { cid: String(job.payload.cid).slice(0, 60) + ":" + step } : {}) };
  const who = job.tok ? { uid: uidv, viaToken: true, tokenId: job.tok } : { uid: uidv };   // a recipe a connection started stays under its rules
  try { const n = await createJob(who, body); job.next = n.id; } catch (e) { job.chainError = String((e && e.message) || e).slice(0, 200); }
  save();
});
// ---- one request = one job. The page sends its own id for each request (cid): the same cid within 10 minutes is the same job.
// Without a cid, an identical request (same words, model, length, inputs and seed) within 15 s is treated as the same job.
const RECENT = new Map();
const reqKey = (b) => b.cid ? "c:" + String(b.cid).slice(0, 80) : "p:" + crypto.createHash("sha1").update(JSON.stringify([b.kind, b.model, b.prompt, b.dur, b.aspect, b.seed, b.inputs || {}, b.meta || {}])).digest("hex");
function dupJob(uidv, key, b) { const r = RECENT.get(uidv + "|" + key); if (!r || Date.now() - r.t > (b.cid ? 600e3 : 15e3)) return null; const j = user(uidv).jobs[r.id]; return j && j.status !== "failed" ? j : null; }
function rememberJob(uidv, key, id) { RECENT.set(uidv + "|" + key, { id, t: Date.now() }); if (RECENT.size > 5000) for (const [k, v] of RECENT) { if (Date.now() - v.t > 600e3) RECENT.delete(k); } }
// ---- what can be checked before charging: the words or the picture to work from, the files still on the server, and the
// server's public address when an outside engine has to read an uploaded file
const NEEDS_WORDS = new Set(["video", "image", "look", "sheet", "chapter", "music", "sfx", "voice"]);
function checkJob(b, route) {
  const inp = b.inputs || {}, files = Object.values(inp).filter((v) => typeof v === "string"), hasRef = files.length > 0 || !!b.source || !!b.chainFrom;
  const refuse = (msg, code = 400) => { throw Object.assign(new Error(msg), { code }); };
  if (NEEDS_WORDS.has(b.kind) && !String(b.prompt || "").trim() && !hasRef) refuse("Describe what you want first.");
  if (/^mc(26|30)$/.test(b.model || "") && !b.meta?.consent) refuse("Confirm that you have the right to use this photo and this video first.");
  if (/^mc(26|30)$/.test(b.model || "")) { if (!inp.mcChar) refuse("Add a photo of the character first."); if (!inp.mcMove) refuse("Add the video with the movement first."); }
  if (b.model === "grok15" && !(inp.startImage || inp.vStart)) refuse("Grok Imagine 1.5 starts from a picture — add one first.");
  if (b.kind === "lipsync") { if (!inp.lsV) refuse("Add a face photo or a video of the person first."); if (!inp.lsA && !String(b.prompt || "").trim()) refuse("Type what they should say, or add a voice file."); }
  for (const f of files) if (/^\/media\//.test(f) && !fs.existsSync(path.join(MEDIA_DIR, path.basename(f.split("?")[0])))) refuse("A file you added is no longer on the server — add it again.");
  if (String(route.key || "").startsWith("kie@") && files.some((f) => /^\/media\//.test(f)) && !/^https?:\/\//.test(process.env.PUBLIC_BASE_URL || "")) refuse("The server's public address isn't set (PUBLIC_BASE_URL), so the engine can't read your file — nothing was charged.", 503);
}
export function publicJob(j, staff) { return j && { ...(j.sceneCheck ? { sceneCheck: j.sceneCheck } : {}), ...(j.payload?.meta?.scene ? { scene: j.payload.meta.scene } : {}), ...(j.payload?.meta?.physics?.sentence ? { physics: { en: j.payload.meta.physics.sentence, ar: j.payload.meta.physics.sentence_ar || null } } : {}), ...(staff ? { detail: j.status === "failed" ? [...(j.errors || []), (j.prov || "") + ": " + (j.errorDetail || "")].join(" · ").slice(0, 900) : null, via: j.prov || null } : {}), id: j.id, status: j.status, progress: j.progress, url: j.url || null, error: j.error || null, errorType: j.errorType || null, segments: j.segments || null, kind: j.kind, title: j.title || null, created: j.created, cost: j.cost || 0, dur: j.payload?.dur ?? null, durAsked: j.payload?.meta?.durAsked ?? null, sent: j.sent || null, next: j.next || null, chainError: j.chainError || null, step: j.payload?.meta?.step || 0 }; }

// Parent of a multi-part video: done when every part is done (segments = all part URLs)
setInterval(() => { for (const [uidv, u] of allUsers()) for (const job of Object.values(u.jobs)) {
  if (!job.children || job.status !== "rendering") continue; const kids = job.children.map((id) => u.jobs[id]).filter(Boolean);
  job.progress = kids.reduce((a, k) => a + (k.status === "done" ? 1 : k.progress || 0), 0) / kids.length;
  if (kids.some((k) => k.status === "failed")) { fail(uidv, job, new Error(kids.find((k) => k.status === "failed").errorDetail || "A part failed")); }
  else if (kids.every((k) => k.status === "done")) { job.status = "done"; job.progress = 1; job.url = kids[0].url; job.segments = kids.map((k) => k.url); if (job.cost) settle(uidv, job.id); save(); runDone(uidv, job); }
} }, 3000);
// Poll running provider jobs — all at once, every 2.5 s (and right away when the engine calls back)
export async function pollOne(uidv, job) {
  if (job.status !== "rendering" || !job.remoteId || job._busy) return;
  job._busy = true; job._lastPoll = Date.now();
  try {
    const r = await adapterByKey(job.prov || job.cap, PROVIDERS).poll(job.remoteId);
    if (r.progress != null) job.progress = r.progress;
    if (r.status === "done" && (r.url || r.segments)) await finish(job, r.url, r.segments);
    else if (r.status === "failed") fail(uidv, job, new Error(r.error || "failed"));
    else if (Date.now() - job.created > 30 * 60e3) fail(uidv, job, "Timed out after 30 minutes");
    save();
  } catch (e) { job._pollErr = (job._pollErr || 0) + 1; console.warn("poll", job.id, e.message); if (job._pollErr >= 6 || !classify(e).retryable) fail(uidv, job, e); }
  finally { delete job._busy; }
}
setInterval(() => { const now = Date.now(), todo = [];
  for (const [uidv, u] of allUsers()) for (const job of Object.values(u.jobs || {})) if (job.status === "rendering" && job.remoteId && !job._busy && now - (job._lastPoll || 0) >= (job.payload?.meta?.skLive ? 900 : 2000)) todo.push(pollOne(uidv, job));
  Promise.allSettled(todo); }, 1000);   // sketch pictures are checked about every second, everything else every 2 s
// make a finished job again (same id, no new charge) — used when a scene result drifted
export function restart(job, extraPrompt) { const f = findJob(job.id); if (!f) return;
  job.payload.prompt = String(job.payload.prompt || "") + (extraPrompt || ""); delete job.remoteId; job.url = null; job.status = "queued"; job.progress = 0; save();
  start(job).catch((e) => fail(f[0], job, e)); }
export function findJob(id) { for (const [uidv, u] of allUsers()) if (u.jobs && u.jobs[id]) return [uidv, u.jobs[id]]; return null; }
