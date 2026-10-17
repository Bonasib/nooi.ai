import crypto from "crypto";
import os from "os";
import { user, allUsers, save, uid, col, SAVES } from "./store.js";
import { PROVIDERS, capFor } from "../providers/index.js";
import { adapterFor, adapterByKey } from "../providers/extra.js";
import { kieAuto, kieDur } from "../providers/kie.js";
import { nvRoute } from "../providers/nvidia.js";
import { gen3dRoute } from "../providers/gen3d.js";
import { featureOn, modelOn, cfg, saveCfg } from "./settings.js";
import { checkEntitlement } from "./plans.js";
import { isStaff } from "./admin.js";
const FEATURE = { video: "video", chapter: "story", image: "image", look: "chars", sheet: "chars", edit: "edit", bg: "fx", mocap: "fx", voice: "voice", voiceclone: "voice", voiceconvert: "voice", world: "world", lipsync: "voice", music: "voice", sfx: "voice", finish: "finish", transcribe: "subs", dub: "subs", "3d": "studio3d", track3d: "studio3d", view3d: "studio3d", place3d: "studio3d" };
import { download, lastFrame, MEDIA_DIR, localPath } from "./media.js";
import fs from "fs";
import path from "path";
import { priceOf, credit, hold, settle, release, lowerHold, raiseHold } from "./billing.js";
import { moderate } from "./moderation.js";
import { withRetry, classify, USER_MSG } from "./errors.js";
import { cleanChain } from "./recipes.js";
import { tokenCheck, tokenSpend } from "./tokens.js";
import { piperOn, backupVoiceFile } from "../providers/piper.js";
import { prepMotion, engineReason, ENGINE_BUSY, keepSound, joinSwap, mcBest } from "./mcprep.js";
import { smoothFps, FPS_EXTRA } from "./fps96.js";

// other modules react to finished jobs (scenes keep their latest frame and check the result)
export const jobHooks = { before: [], done: [], fail: [] };
// v110: the preview copy (deploy/stage.sh, NOOI_STAGE=1) starts on a copy of the live data. The jobs it finds there belong to
// the live site, which is making them: the preview never sends, checks, joins or finishes them again. Before, it did the same
// work a second time on the same server (downloads, frame smoothing, sound), and since v109 it could send a job again.
// (The moment the copy was first started is kept in the copy, so a restart of the preview doesn't take its own jobs for live ones.)
const BOOT = Date.now();
const STAGE_SINCE = process.env.NOOI_STAGE === "1" ? (() => { const c = col("stage110", {}); if (!c.since) { c.since = BOOT; save(); } return c.since; })() : 0;
export const liveJob = (job) => STAGE_SINCE > 0 && (job.created || 0) < STAGE_SINCE;
const runDone = (uidv, job) => { for (const f of jobHooks.done) Promise.resolve().then(() => f(uidv, job)).catch((e) => console.warn("job hook", e.message)); };
export async function createJob(u, body) {
  const tw = Date.now(); for (const f of jobHooks.before) await f(u, body);
  const words = Math.round((Date.now() - tw) / 100) / 10;   // v110: the words steps (English, scene, physics…) before the job exists
  if (process.env.GPU_FEATURES !== "true" && ["3d", "track3d", "view3d", "place3d"].includes(body.kind) && !(body.kind === "3d" && (nvRoute("sam3d", body) || gen3dRoute("sam3d", body)))) throw Object.assign(new Error("3D generation is not available yet"), { code: 403 });
  const flag = moderate((body.prompt || "") + " " + (body.meta?.refs || []).map((r) => r.description).join(" "));
  if (flag) throw Object.assign(new Error("Blocked by the Acceptable Use Policy (" + flag + ")"), { code: 422 });
  // an avatar speaks the typed words: the "bring this picture to life" motion line is not a script (and would be spoken aloud)
  if (body.kind === "lipsync" && !(body.inputs || {}).lsA && /^\s*(bring this picture to life|حرّ?ك هذه الصورة)/i.test(String(body.prompt || ""))) throw Object.assign(new Error("Type what the avatar should say — that line moves a picture, it isn't speech"), { code: 400 });
  if (body.kind === "voiceclone" && !body.meta?.consent) throw Object.assign(new Error("Voice cloning needs the speaker's consent"), { code: 400 });
  if (FEATURE[body.kind] && !featureOn(FEATURE[body.kind])) throw Object.assign(new Error("This feature is turned off"), { code: 403 });
  if (body.model && !modelOn(body.model)) throw Object.assign(new Error("This model is turned off"), { code: 403 });
  // v94: "Extend shot" names the user's own earlier job; when Veo made it here, its engine task lets Veo continue that same video.
  // Only the server sets veoTask (a task id sent by the browser is dropped).
  if (body.meta && ("extendOf" in body.meta || "veoTask" in body.meta)) { const b = body.meta.extendOf ? (user(u.uid).jobs || {})[String(body.meta.extendOf)] : null;
    const vt = b && b.status === "done" && String(b.prov || "").startsWith("kie@") && /^veo:/.test(b.remoteId || "") ? b.remoteId.slice(4) : undefined;
    body.meta = { ...body.meta, extendOf: b ? b.id : undefined, veoTask: vt }; }
  const cap = capFor(body.kind, body.meta);
  const route = cap && adapterFor(cap, body, PROVIDERS); const prov = route && route.a;
  if (!prov) throw Object.assign(new Error("Unknown job kind: " + body.kind), { code: 400 });
  if (!prov.configured) throw Object.assign(new Error(isStaff(u) ? `${prov.name} is not connected yet — add its API URL and key to the server .env or the admin dashboard` : "This engine isn't available right now — pick another model or try again soon. Nothing was charged."), { code: 501 });
  // one request = one job: the same request sent twice (a double tap, a network retry) gets the job already made
  if (body.meta?.chain) body.meta = { ...body.meta, chain: cleanChain(body.meta.chain) };
  const key = reqKey(body), dup = dupJob(u.uid, key, body); if (dup) return dup;   // the request as sent (before the length is fitted to the engine)
  checkJob(body, route);                                              // problems we can see now are refused before anything is charged
  // v108: Motion Control / Replace the person — the job is made at once, held at the price the page showed; the files are made
  // ready, looked at and sent in the background (prepAndStart), and the page shows each step. Before, all of that ran inside this
  // one request: a long phone video kept the page loading for minutes with nothing to show.
  const mc = MC_MODEL.test(String(body.model || "")) && !!body.inputs; if (mc) mcBest(body);
  if (mc && body.model === "mcswap") body.dur = Math.max(4, Math.min(120, Math.round(+body.dur || 5)));   // (the page's length until the video is read)
  // a video is priced for the length the engine really makes (e.g. 5 or 10 s for Kling 2.6, 8 s for Veo) — a swap: the video's own length
  if (["video", "chapter"].includes(body.kind) && String(route.key || "").startsWith("kie@") && !(+body.meta?.parts > 1) && body.model !== "mcswap") { const real = kieDur(route.key.slice(4), body.dur); if (real && real !== Math.round(+body.dur || 5)) { body.meta = { ...(body.meta || {}), durAsked: +body.dur || 5 }; body.dur = real; } }
  // owners & admins test every model on the Studio plan without spending credits
  const staff = isStaff(u);
  if (!staff) checkEntitlement(user(u.uid), body);
  // nooi Studio 2.0: a long video may use a different engine model for each part (picked by the bots)
  const partModels = body.kind === "video" && +body.meta?.parts > 1 && Array.isArray(body.meta?.partModels) ? body.meta.partModels.slice(0, 6).map(String) : null;
  if (partModels) for (const m of partModels) { if (!modelOn(m)) throw Object.assign(new Error("This model is turned off"), { code: 403 }); if (!staff) checkEntitlement(user(u.uid), { ...body, model: m, dur: 0 }); }
  const price = priceOf(body.kind, body) + (body.kind === "video" ? FPS_EXTRA[+body.meta?.fps] || 0 : 0), cost = staff ? 0 : price;
  tokenCheck(u, price);                                               // a connection (API token): read-only, or over its daily limit → refused
  const jid = uid();
  if (cost) hold(u.uid, cost, (body.kind || "job") + " · " + String(body.prompt || "").slice(0, 40), jid);   // held now, charged when it finishes
  const job = { id: jid, kind: body.kind, cap, prov: route.key, status: "queued", progress: 0, created: Date.now(), payload: body, cost, title: body.title || body.prompt || "", ...(words >= 0.1 ? { times: { words } } : {}), ...(u.viaToken && u.tokenId ? { tok: u.tokenId } : {}) };
  user(u.uid).jobs[job.id] = job; rememberJob(u.uid, key, job.id); tokenSpend(u, price); save();
  if (mc) { job.stage = "prep"; job.times = job.times || {}; save(); prepAndStart(u, job, body, route).catch((e) => fail(u.uid, job, e && e.code === 400 ? Object.assign(e, { userMsg: e.message, noFallback: true }) : e)); return job; }
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
// v108: Motion Control / Replace the person, after the job is made: the files made ready and looked at (a refusal fails the job
// with its reason, nothing charged), a swap in parts priced for the seconds really swapped, then the engine. Each step is on the
// job (stage) with how long it took (times, seconds) — the page shows the step, the owner's Details show the times.
async function prepAndStart(u, job, body, route) {
  let t0 = Date.now(); const took = (k) => { job.times = { ...(job.times || {}), [k]: Math.round((Date.now() - t0) / 100) / 10 }; t0 = Date.now(); save(); };
  await prepMotion(body, (st) => { if (st === "look") took("prep"); job.stage = st; save(); });
  took("look");
  // v107: a swap in parts is priced for the seconds really swapped (a part the person isn't in is kept as it is, not charged)
  const sp = body.model === "mcswap" && Array.isArray(body.meta?.swapParts) && body.meta.swapParts.length > 1 ? body.meta.swapParts : null;
  if (sp) { if (!sp.some((p) => p.swap)) sp.forEach((p) => (p.swap = true)); const sec = sp.filter((p) => p.swap).reduce((a, p) => a + p.dur, 0);
    body.meta = { ...body.meta, durVideo: Math.round(sp.reduce((a, p) => a + p.dur, 0) * 10) / 10, durSwapped: Math.round(sec * 10) / 10 }; body.dur = Math.max(4, Math.round(sec)); }
  else if (body.model === "mcswap" && +body.meta?.mcVideo?.dur) body.dur = Math.max(4, Math.min(15, Math.round(+body.meta.mcVideo.dur)));   // one part: the clip the engine makes
  // the charge follows what the video really is: less when parts are kept as they are, more when it's longer than the page said
  if (job.cost && body.model === "mcswap") { const price = priceOf(body.kind, body);
    if (price < job.cost && lowerHold(u.uid, job.id, price)) job.cost = price; else if (price > job.cost && raiseHold(u.uid, job.id, price)) job.cost = price; }
  job.payload = body; job.stage = "engine"; job.engineAt = Date.now(); save();
  // v107: a long swap — one engine task for each part the person is in, all at once (the parent joins them when they're made)
  if (sp) {
    const cap = job.cap; job.children = []; job.status = "rendering";
    sp.forEach((p, i) => { if (!p.swap) return;
      const child = { id: uid(), kind: "video", cap, prov: route.key, status: "queued", progress: 0, created: Date.now(), parent: job.id, cost: 0, title: `${job.title} · ${i + 1}/${sp.length}`,
        payload: { ...body, dur: String(route.key || "").startsWith("kie@") ? kieDur(route.key.slice(4), p.dur) : Math.round(p.dur), inputs: { ...body.inputs, mcMove: p.url }, meta: { ...body.meta, swapParts: undefined, swapPart: i + 1, swapWhere: p.where || undefined } } };
      p.job = child.id; user(u.uid).jobs[child.id] = child; job.children.push(child.id); start(child).catch((e) => fail(u.uid, child, e));
    });
    save(); return;
  }
  await start(job);
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
  job.sentAt = Date.now();   // v109: when the engine got it (the Admin speed card: our part before it, the engine's after)
  if (r.done) await finish(job, r.url, r.segments); else { job.remoteId = r.remoteId; job.status = "rendering"; save(); }
}
export const cbSig = (id) => crypto.createHmac("sha256", process.env.SECRET_KEY || "nooi").update("cb:" + id).digest("hex").slice(0, 24);
async function finish(job, url, segments) {
  job.progress = 1; if (segments) job.segments = segments; const tf = Date.now();
  // v111: the engine's time in two: waiting in its line (when it says so) and making it
  if (job.sentAt && job.genAt) job.times = { ...(job.times || {}), queue: Math.round((job.genAt - job.sentAt) / 100) / 10, making: Math.round((tf - job.genAt) / 100) / 10 };
  // keep a copy on our server (an adapter that already saved its files here — World Labs — is not downloaded twice)
  if (process.env.MIRROR_MEDIA !== "false" && url && !localPath(url)) { try { url = (await download(url)).url; } catch (e) { console.warn("mirror:", e.message); } }
  const fetched = Math.round((Date.now() - tf) / 100) / 10;   // v110: bringing the result to this server
  // v96: 60 / 120 fps — the in-between frames are made here (lib/fps96.js); if that can't be done, the frame-rate extra is refunded
  const fps = job.kind === "video" ? +job.payload?.meta?.fps || 0 : 0;
  if (fps >= 50 && url && !job.fps96) {
    job.fps96 = "making"; job.stage = "smooth"; save();
    try { url = await smoothFps(url, Math.min(120, fps)); job.fps96 = fps; }
    catch (e) { job.fps96 = "failed"; console.warn("fps", job.id, e.message);
      const top = job.parent ? findJob(job.parent)?.[1] : job, me = findJob(job.id), extra = FPS_EXTRA[fps] || 0;
      if (top && me && top.cost && extra && !top.fpsRefund) { top.fpsRefund = extra; credit(me[0], extra, "Refund · " + fps + " fps couldn't be made", top.id); } }
    delete job.stage;
  }
  // v104: Motion Control / Character Swap come back silent — the client's own video gives its sound back (v105: the swap always
  // has the video's own sound and length)
  if (MC_MODEL.test(job.payload?.model || "") && url && job.payload?.inputs?.mcMove && !job.sound104) {
    job.sound104 = true; try { const k = await keepSound(url, job.payload.inputs.mcMove, job.payload.model === "mcswap"); if (k) url = k; } catch (e) { console.warn("sound", job.id, e.message); } }
  if (job.engineAt && job.times) { job.times.engine = Math.round((Date.now() - job.engineAt) / 100) / 10; delete job.engineAt; } if (job.stage) delete job.stage;
  const after = Math.round((Date.now() - tf) / 100) / 10; if (after >= 0.1) job.times = { ...(job.times || {}), fetch: fetched, ...(after - fetched >= 0.1 ? { after: Math.round((after - fetched) * 10) / 10 } : {}) };
  job.url = url; job.status = "done"; job.doneAt = Date.now(); save();
  const owner = allUsers().find(([, U]) => U.jobs && U.jobs[job.id]); if (owner) { if (job.cost) settle(owner[0], job.id); runDone(owner[0], job); }
}
// A Kie AI model that rejects or fails a job → try the next Kie model once or twice before refunding.
// Same key, so a bad key or an empty Kie balance doesn't fall back.
const KIE_FALLBACK = { image: ["nano", "img25", "img20", "qwen"], video: ["kling", "seedance", "wan27", "hailuo"], lipsync: ["kling/ai-avatar-standard", "infinitalk/from-audio", "kling/ai-avatar-pro"] };
const MC_MODEL = /^mc(26|30|swap)$/;
// v102: what the client reads when Motion Control / Character Swap still fails on the engine's side (no reason it gave in words)
const LOOK_PERSON = { hidden: ["in the video something in front of the person hides much of the body", "في الفيديو شيء أمام الشخص يُخفي معظم جسمه"],
  cut: ["in the video most of the person's body is out of the frame", "في الفيديو معظم جسم الشخص خارج الإطار"], none: ["no clear person in the video", "لا يظهر شخص واضح في الفيديو"] };
export const MC_FAIL = {
  swap: "The engine couldn't finish this swap — an error on its side. Nothing was charged. Try again in a few minutes; a photo that shows the whole person, standing like the person in the video, works best.",
  move: "The engine couldn't finish this — an error on its side. Nothing was charged. Try again in a few minutes; a photo that shows the whole character, standing like the person in the video, works best.",
};
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
  // v102: Motion Control / Character Swap never move to another model. When the engine took the job and then failed on its own
  // side (a 5xx, or a reason with nothing for the client: "internal error", "failed") it is asked once more, a little later,
  // before the refund — these failures are often the engine's own hiccup
  // (v113: an engine that says it is busy / "try again later" is asked twice more, 20 s and then 60 s later)
  const busy = ENGINE_BUSY.test(c.message), tries = +job.again102 || 0;
  if (MC_MODEL.test(job.payload?.model || "") && tries < (busy ? 2 : 1) && job.remoteId && String(job.prov || "").startsWith("kie@") && !(msg && msg.noFallback)
      && !["auth", "quota", "rate"].includes(c.type) && !/timed out/i.test(c.message) && (busy || c.type === "provider" || !engineReason(c.message))) {
    job.again102 = tries + 1; job.errors = [...(job.errors || []), `${job.prov}: ${c.message}`.slice(0, 300)];
    console.warn("job", job.id, "·", job.prov, "failed on the engine's side:", c.message.slice(0, 200), "→ asked once more");
    delete job.remoteId; job._pollErr = 0; job.status = "queued"; save();
    setTimeout(() => start(job).catch((e) => fail(uidv, job, e)), (+process.env.MC_AGAIN_MS || 20000) * (tries ? 3 : 1)); return true;
  }
  if (msg && msg.noFallback || MC_MODEL.test(job.payload?.model || "") || !String(job.prov || "").startsWith("kie@") || !KIE_FALLBACK[job.cap] || job.parent || job.children || ["auth", "quota"].includes(c.type) || /timed out/i.test(c.message)) return false;
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
  const c = classify(msg instanceof Error ? msg : new Error(String(msg))); job.status = "failed"; job.errorType = c.type; job.error = (msg && msg.userMsg) || USER_MSG[c.type] || String(msg);
  // v95: the engine took the job and then said why it couldn't make it ("No person found in the video"…): say that, not "try rephrasing"
  const why = ["input", "provider"].includes(c.type) && job.remoteId && !(msg && msg.userMsg) ? engineReason(c.message) : "";
  if (job.remoteId && !(msg && msg.userMsg) && ENGINE_BUSY.test(c.message)) { job.errorType = "engine"; job.reason = "busy";   // v113
    const n = +job.again102 || 0;
    job.error = `The engine was too busy to make this${n ? " — we asked it again " + (n === 1 ? "once" : n === 2 ? "twice" : n + " times") : ""}. Nothing was charged. Try again in a few minutes.`;
    job.errorAr = `كان المحرّك مشغولاً جداً فلم يصنع هذا${n ? " — طلبناه منه " + (n === 1 ? "مرة أخرى" : n === 2 ? "مرتين أخريين" : n + " مرات أخرى") : ""}. لم يُخصم شيء. حاول مجدداً بعد بضع دقائق.`; }
  else if (why) { job.errorType = "engine"; job.reason = why; job.error = "The engine couldn't make this: " + why.replace(/[.\s]*$/, ".") + " Nothing was charged."; }
  else if (MC_MODEL.test(job.payload?.model || "") && job.remoteId && ["input", "provider"].includes(c.type) && !(msg && msg.userMsg)) { job.errorType = "engine"; job.error = job.payload?.meta?.swap93 ? MC_FAIL.swap : MC_FAIL.move;
    // v103: what the text AI noticed in the video or the photo before it was sent, said in the client's words (English · Arabic)
    const lk = job.payload?.meta?.mcLook, why2 = lk && (lk.en || LOOK_PERSON[lk.person]?.[0]);
    if (why2) { const w2ar = lk.ar || LOOK_PERSON[lk.person]?.[1] || "";
      job.error = `The engine couldn't finish this. What may have stopped it: ${why2.replace(/[.\s]*$/, "")}. Nothing was charged — try a video where one person is seen clearly, with nothing in front of them, and a photo of just that one person.`;
      job.errorAr = w2ar ? `تعذّر على المحرّك إكمال هذا. ما قد يكون أوقفه: ${w2ar.replace(/[.\s]*$/, "")}. لم يُخصم شيء — جرّب فيديو يظهر فيه شخص واحد بوضوح دون شيء أمامه، وصورة لذلك الشخص وحده.` : null; } } job.errorDetail = String(msg).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300); if (job.cost && !job.refunded) { job.refunded = true; if (!release(uidv, job.id)) credit(uidv, job.cost, "Refund · failed " + job.kind, job.id); } save(); }
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
  if (/^mc(26|30|swap)$/.test(b.model || "") && !b.meta?.consent) refuse("Confirm that you have the right to use this photo and this video first.");
  if (/^mc(26|30|swap)$/.test(b.model || "")) { if (!inp.mcChar) refuse("Add a photo of the character first."); if (!inp.mcMove) refuse("Add the video with the movement first."); }
  if (b.model === "grok15" && !(inp.startImage || inp.vStart)) refuse("Grok Imagine 1.5 starts from a picture — add one first.");
  if (b.kind === "lipsync") { if (!inp.lsV) refuse("Add a face photo or a video of the person first."); if (!inp.lsA && !String(b.prompt || "").trim()) refuse("Type what they should say, or add a voice file."); }
  for (const f of files) if (/^\/media\//.test(f) && !fs.existsSync(path.join(MEDIA_DIR, path.basename(f.split("?")[0])))) refuse("A file you added is no longer on the server — add it again.");
  if (String(route.key || "").startsWith("kie@") && files.some((f) => /^\/media\//.test(f)) && !/^https?:\/\//.test(process.env.PUBLIC_BASE_URL || "")) refuse("The server's public address isn't set (PUBLIC_BASE_URL), so the engine can't read your file — nothing was charged.", 503);
}
export function publicJob(j, staff) { return j && { ...(j.sceneCheck ? { sceneCheck: j.sceneCheck } : {}), ...(j.payload?.meta?.scene ? { scene: j.payload.meta.scene } : {}), ...(j.payload?.meta?.physics?.sentence ? { physics: { en: j.payload.meta.physics.sentence, ar: j.payload.meta.physics.sentence_ar || null } } : {}), ...(staff ? { detail: j.status === "failed" ? [...(j.errors || []), (j.prov || "") + ": " + (j.errorDetail || "")].join(" · ").slice(0, 900) : null, via: j.prov || null } : {}), id: j.id, status: j.status, progress: j.progress, ...(j.stage ? { stage: j.stage } : {}), ...(j.partsTotal ? { partsDone: j.partsDone || 0, partsTotal: j.partsTotal } : {}), ...(j.status === "rendering" && j.remoteId && j.sentAt && !j.genAt ? { inLine: true } : {}), ...(staff && j.times ? { times: j.times } : {}), url: j.url || null, error: j.error || null, ...(j.errorAr ? { errorAr: j.errorAr } : {}), errorType: j.errorType || null, reason: j.reason || null, segments: j.segments || null, kind: j.kind, title: j.title || null, created: j.created, cost: j.cost || 0, dur: j.payload?.dur ?? null, durAsked: j.payload?.meta?.durAsked ?? null, sent: j.sent || null, next: j.next || null, chainError: j.chainError || null, step: j.payload?.meta?.step || 0 }; }

// Parent of a multi-part video: done when every part is done (segments = all part URLs)
setInterval(() => { for (const [uidv, u] of allUsers()) for (const job of Object.values(u.jobs)) {
  if (!job.children || job.status !== "rendering" || liveJob(job)) continue; const kids = job.children.map((id) => u.jobs[id]).filter(Boolean);
  job.progress = kids.reduce((a, k) => a + (k.status === "done" ? 1 : k.progress || 0), 0) / kids.length;
  if (job.payload?.meta?.swapParts) { job.partsDone = kids.filter((k) => k.status === "done").length; job.partsTotal = kids.length; }   // v108: "part 2 of 3 ready"
  if (kids.some((k) => k.status === "failed")) { const k = kids.find((x) => x.status === "failed"), sw = !!job.payload?.meta?.swapParts;
    // (v107: a swap part that failed → the whole swap fails with that part's own words, nothing charged)
    fail(uidv, job, sw ? Object.assign(new Error(k.errorDetail || k.error || "A part failed"), { userMsg: k.error, noFallback: true }) : new Error(k.errorDetail || "A part failed")); if (sw && k.errorAr) job.errorAr = k.errorAr; }
  else if (kids.every((k) => k.status === "done") && job.payload?.meta?.swapParts) {   // v107: the swapped parts and the kept ones, joined with the video's own sound
    if (job.joining) continue; job.joining = true; job.progress = 0.97; job.stage = "join"; const tj = Date.now();
    // v111: the parts are made at the same time — the swap's engine time is its slowest part's (and the first part's sending)
    const kt = kids.map((k) => k.times || {}), mx = (f) => (kt.some((t) => t[f] != null) ? Math.max(...kt.map((t) => +t[f] || 0)) : undefined), s0 = Math.min(...kids.map((k) => k.sentAt || Infinity));
    if (!job.sentAt && isFinite(s0)) job.sentAt = s0; job.times = { ...(job.times || {}), ...(mx("queue") != null ? { queue: mx("queue"), making: mx("making") } : {}) };
    if (job.engineAt && job.times) { job.times.engine = Math.round((tj - job.engineAt) / 100) / 10; delete job.engineAt; } save();
    const parts = job.payload.meta.swapParts.map((p) => { const k = p.job && u.jobs[p.job]; return { url: k ? k.url : p.url, dur: p.dur, swapped: !!k }; });
    joinSwap(parts, job.payload.meta.swapSrc).then((url) => { job.url = url; job.status = "done"; job.doneAt = Date.now(); job.progress = 1; delete job.joining; delete job.stage; job.times = { ...(job.times || {}), join: Math.round((Date.now() - tj) / 100) / 10 };
      if (job.cost) settle(uidv, job.id); save(); runDone(uidv, job); })
      .catch((e) => { console.warn("swap join", job.id, e.message); fail(uidv, job, Object.assign(new Error("The parts couldn't be joined: " + e.message), { noFallback: true })); });
  }
  else if (kids.every((k) => k.status === "done")) { job.status = "done"; job.doneAt = Date.now(); job.progress = 1; job.url = kids[0].url; job.segments = kids.map((k) => k.url); if (job.cost) settle(uidv, job.id); save(); runDone(uidv, job); }
} }, 3000);
// Poll running provider jobs — all at once, every 2.5 s (and right away when the engine calls back)
export async function pollOne(uidv, job) {
  if (job.status !== "rendering" || !job.remoteId || job._busy || liveJob(job)) return;
  job._busy = true; job._lastPoll = Date.now();
  try {
    const r = await adapterByKey(job.prov || job.cap, PROVIDERS).poll(job.remoteId);
    if (r.progress != null) job.progress = r.progress;
    if (r.status === "rendering" && !job.genAt) job.genAt = Date.now();   // v111: the engine started making it (until now it said "waiting in line")
    if (r.status === "done" && (r.url || r.segments)) await finish(job, r.url, r.segments);
    else if (r.status === "failed") fail(uidv, job, new Error(r.error || "failed"));
    else if (Date.now() - job.created > 30 * 60e3) fail(uidv, job, "Timed out after 30 minutes");
    save();
  } catch (e) { job._pollErr = (job._pollErr || 0) + 1; console.warn("poll", job.id, e.message); if (job._pollErr >= 6 || !classify(e).retryable) fail(uidv, job, e); }
  finally { delete job._busy; }
}
setInterval(() => { const now = Date.now(), todo = [];
  for (const [uidv, u] of allUsers()) for (const job of Object.values(u.jobs || {})) if (job.status === "rendering" && job.remoteId && !job._busy && !liveJob(job) && now - (job._lastPoll || 0) >= (job.payload?.meta?.skLive ? 900 : job.payload?.callbackUrl ? 6000 : 2000)) todo.push(pollOne(uidv, job));
  Promise.allSettled(todo); }, 1000);   // sketch pictures are checked about every second, everything else every 2 s
// make a finished job again (same id, no new charge) — used when a scene result drifted
export function restart(job, extraPrompt) { const f = findJob(job.id); if (!f) return;
  job.payload.prompt = String(job.payload.prompt || "") + (extraPrompt || ""); delete job.remoteId; job.url = null; job.status = "queued"; job.progress = 0; save();
  start(job).catch((e) => fail(f[0], job, e)); }
export function findJob(id) { for (const [uidv, u] of allUsers()) if (u.jobs && u.jobs[id]) return [uidv, u.jobs[id]]; return null; }

// ---- v109: jobs a restart left behind. A job lives only in memory between being made and reaching the engine (its files being
// made ready, waiting for the part before it, the parts being joined). After a restart — every update — nothing picked those up
// again: they stayed "queued" for ever, and every open page kept asking about them every 3 s, slowing everything else. Now, at
// start: a recent job that never reached the engine is sent again (a part waits again for the one before it), a join starts
// again; a Motion Control job still being prepared, or anything older than 2 hours, fails with the reason — nothing charged.
export const RESTART_MSG = "The server restarted while this was being prepared — nothing was charged. Make it again.";
const RESTART_AR = "أُعيد تشغيل الخادم أثناء تجهيز هذا — لم يُخصم شيء. اصنعه مرة أخرى.";
export function recoverJobs() {
  let n = 0; const now = Date.now();
  for (const [uidv, u] of allUsers()) for (const job of Object.values(u.jobs || {})) {
    if (!["queued", "rendering"].includes(job.status) || (job.created || 0) >= BOOT || liveJob(job)) continue;   // (a job made since this start is being made now; v110: on the preview copy, the live site's)
    if (job.children) { if (job.joining) { delete job.joining; n++; } continue; }   // the parent poller joins the parts again
    if (job.remoteId) continue;                                                       // the engine has it: the poll picks it up
    n++;
    const mcPrep = MC_MODEL.test(job.payload?.model || "") && job.stage && job.stage !== "engine";
    if (mcPrep || !job.payload || now - (job.created || 0) > 2 * 3600e3) { fail(uidv, job, Object.assign(new Error(RESTART_MSG), { userMsg: RESTART_MSG, noFallback: true })); job.errorAr = RESTART_AR; continue; }
    job.status = "queued"; job.restarted = (job.restarted || 0) + 1; start(job).catch((e) => fail(uidv, job, e));
  }
  if (n) { console.log("restart: picked up", n, "unfinished jobs"); save(); }
  RECOVERED.n += n; return n;
}
const RECOVERED = { n: 0 };
if (process.env.NODE_ENV !== "test") setTimeout(recoverJobs, +process.env.RECOVER_MS || 3000).unref();

// ---- v109: the Admin speed card — how busy the server is and where the time of the last jobs went
const LAG = { max: 0, sum: 0, n: 0, last: [] };
let lagT = Date.now();
setInterval(() => { const now = Date.now(), d = Math.max(0, now - lagT - 500); lagT = now; LAG.last.push(d); if (LAG.last.length > 120) LAG.last.shift(); }, 500).unref();
const med = (a) => { const b = a.filter((x) => x >= 0).sort((x, y) => x - y); return b.length ? Math.round(b[Math.floor(b.length / 2)] / 100) / 10 : null; };
export function speedReport() {
  const now = Date.now(), jobs = []; for (const [, u] of allUsers()) for (const j of Object.values(u.jobs || {})) if (!j.parent) jobs.push(j);
  const pending = jobs.filter((j) => ["queued", "rendering"].includes(j.status)), recent = jobs.filter((j) => j.status === "done" && j.doneAt && now - j.doneAt < 24 * 3600e3);
  const group = (j) => (MC_MODEL.test(j.payload?.model || "") ? (j.payload.model === "mcswap" ? "swap" : "motion") : j.kind === "image" || j.kind === "look" ? "image" : j.kind === "video" || j.kind === "chapter" ? "video" : "other");
  const kinds = {};
  // (v110: the words steps run before the job exists; bringing the result here and the sound / frames after it are ours too)
  for (const j of recent) { const g = group(j), k = (kinds[g] = kinds[g] || { n: 0, total: [], before: [], engine: [], words: [], fetch: [], queue: [], making: [], look: [] }), t = j.times || {}, w = (+t.words || 0) * 1000, f = ((+t.fetch || 0) + (+t.after || 0)) * 1000;
    k.n++; k.total.push(j.doneAt - j.created + w); if (t.words != null) k.words.push(w); if (t.fetch != null) k.fetch.push(f);   // (the words step: when it ran)
    if (t.queue != null) { k.queue.push(t.queue * 1000); k.making.push((+t.making || 0) * 1000); } if (t.look != null) k.look.push(t.look * 1000);
    if (j.sentAt) { k.before.push(j.sentAt - j.created + w); k.engine.push(Math.max(0, j.doneAt - j.sentAt - f)); } }
  let size = 0; try { size = fs.statSync(path.resolve("data/db.json")).size; } catch {}
  return {
    server: { load: os.loadavg().map((x) => Math.round(x * 100) / 100), cpus: os.cpus().length, freeMB: Math.round(os.freemem() / 1048576), totalMB: Math.round(os.totalmem() / 1048576), upMin: Math.round(process.uptime() / 60),
      lagMs: { max: Math.max(0, ...LAG.last), avg: LAG.last.length ? Math.round(LAG.last.reduce((a, b) => a + b, 0) / LAG.last.length) : 0 }, dbMB: Math.round(size / 104857.6) / 10, jobs: jobs.length, recovered: RECOVERED.n },
    pending: { n: pending.length, waiting10: pending.filter((j) => now - j.created > 10 * 60e3).length, oldestMin: pending.length ? Math.round((now - Math.min(...pending.map((j) => j.created || now))) / 60e3) : 0,
      byStage: pending.reduce((a, j) => ((a[j.stage || (j.remoteId ? "engine" : j.status)] = (a[j.stage || (j.remoteId ? "engine" : j.status)] || 0) + 1), a), {}) },
    last24h: Object.fromEntries(Object.entries(kinds).map(([g, k]) => [g, { n: k.n, total: med(k.total), before: med(k.before), engine: med(k.engine), words: med(k.words), fetch: med(k.fetch), queue: med(k.queue), making: med(k.making), look: med(k.look), slowest: Math.round(Math.max(...k.total) / 100) / 10 }])),
  };
}
// v110: the speed card also says, in plain words, what is slowing jobs down — what only the server can see: a preview copy
// left running beside the live site, saving the data file, the words step, bringing results here, the engine's own time
const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
async function previewRunning() {
  if (process.env.NOOI_STAGE === "1") return false;
  const port = +process.env.STAGE_PORT || 8090; if (port === +process.env.PORT) return false;
  try { const r = await fetch(`http://127.0.0.1:${port}/v1/health`, { signal: AbortSignal.timeout(800) }); return r.ok; } catch { return false; }
}
export async function speedAdvice() {
  const r = speedReport(), s = r.server, out = [], say = (en, ar) => out.push({ en, ar }), min = (v) => (v >= 90 ? Math.round(v / 6) / 10 + " min" : Math.round(v) + " s"), minAr = (v) => (v >= 90 ? Math.round(v / 6) / 10 + " دقيقة" : Math.round(v) + " ثانية");
  s.saveMs = { avg: avg(SAVES.last), max: Math.max(0, ...SAVES.last), n: SAVES.n }; s.preview = await previewRunning();
  if (s.preview) say("A preview copy of the site is still running on this server and uses its processor and memory too — remove it: bash /opt/nooi/deploy/stage.sh stop",
    "نسخة المعاينة من الموقع ما زالت تعمل على هذا الخادم وتستهلك معالجه وذاكرته — احذفها: bash /opt/nooi/deploy/stage.sh stop");
  if (s.saveMs.avg > 250) say(`Saving the data file (${s.dbMB} MB) stops the server for about ${s.saveMs.avg} ms each time — the file is too big.`, `حفظ ملف البيانات (${s.dbMB} ميجابايت) يوقف الخادم نحو ${s.saveMs.avg} ملّي ثانية كل مرة — الملف كبير جداً.`);
  for (const [g, k] of Object.entries(r.last24h)) {
    const nm = { video: ["Videos", "الفيديوهات"], image: ["Pictures", "الصور"], swap: ["Replace the person", "استبدال الشخص"], motion: ["Make it move", "حرّكها"], other: ["Other jobs", "مهام أخرى"] }[g] || [g, g];
    if (k.words > 4) say(`${nm[0]}: putting the words into English takes ${min(k.words)} before each job starts — the text AI answers slowly (Admin → Connections).`, `${nm[1]}: ترجمة الكلمات إلى الإنجليزية تأخذ ${minAr(k.words)} قبل بدء كل مهمة — الذكاء النصي يجيب ببطء (الإدارة ← الاتصالات).`);
    if (k.fetch > 10) say(`${nm[0]}: bringing each finished result to this server takes ${min(k.fetch)} — the server's download is slow.`, `${nm[1]}: جلب كل نتيجة منتهية إلى هذا الخادم يأخذ ${minAr(k.fetch)} — التنزيل على الخادم بطيء.`);
    // v111: the engine's line and its making, when it says which
    if (k.queue != null && k.queue > 60 && k.engine && k.queue >= 0.4 * k.engine) say(`${nm[0]}: each job waited about ${min(k.queue)} in the AI engine's line before it started being made — the engine is busy then; nothing on this server shortens that.`,
      `${nm[1]}: انتظرت كل مهمة نحو ${minAr(k.queue)} في طابور محرّك الذكاء الاصطناعي قبل أن يبدأ صنعها — المحرّك مشغول حينها؛ ولا شيء على هذا الخادم يختصر ذلك.`);
    if (g === "swap" && k.making != null && k.making > 240 && swapRes() !== "768P") say(`Replace the person: the engine takes about ${min(k.making)} to make each video at 2K, its sharpest. At 768P it may be quicker, a little less sharp, and costs the engine less — to try it, tap "Faster (768P)" below.`,
      `استبدال الشخص: يأخذ المحرّك نحو ${minAr(k.making)} لصنع كل فيديو بدقة 2K، أعلى دقة لديه. بدقة 768P قد يكون أسرع، أقل حدّة قليلاً، وأقل تكلفة على المحرّك — لتجربتها اضغط "أسرع (768P)" بالأسفل.`);
    // v112: the text AI's look before a swap / moves is sent (now at most 15 s for each look)
    if ((g === "swap" || g === "motion") && k.look != null && k.look > 10) say(`${nm[0]}: the text AI took about ${min(k.look)} to look at the photo and the video before each job was sent — it answers slowly with pictures. Each look now waits at most 15 s; a faster text AI (Admin → Connections & APIs) helps more.`,
      `${nm[1]}: أخذ الذكاء النصي نحو ${minAr(k.look)} لفحص الصورة والفيديو قبل إرسال كل مهمة — يجيب ببطء مع الصور. صار كل فحص ينتظر 15 ثانية على الأكثر؛ وذكاء نصي أسرع (الإدارة ← الربط والواجهات البرمجية) يساعد أكثر.`);
    if (k.engine != null && k.total && k.engine > 45 && k.engine >= 0.7 * k.total && k.engine <= k.total) say(`${nm[0]}: ${min(k.engine)} of the usual ${min(k.total)} is the AI engine's own time (its queue and making) — not this server. A faster model or a shorter length shortens it.`,
      `${nm[1]}: ${minAr(k.engine)} من المدة المعتادة ${minAr(k.total)} هي وقت محرّك الذكاء الاصطناعي نفسه (طابوره وصنعه) — لا هذا الخادم. نموذج أسرع أو مدة أقصر تختصرها.`);
  }
  return { ...r, advice: out, swapRes: swapRes() };
}
// v112: Replace the person at 2K (the sharpest, the default) or 768P (may be quicker) — one tap on the speed card. It is the
// engine's extra input for the model (Admin → Connections & APIs → AI engine → Extra inputs per model), kept with any others there.
const H3 = "minimax-h3/reference-to-video";
const kieExtra = () => { const v = cfg("kie").inputs; if (!v) return {}; try { const o = typeof v === "string" ? JSON.parse(v) : v; return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch { return null; } };
export const swapRes = () => (String(kieExtra()?.[H3]?.resolution || "").toUpperCase() === "768P" ? "768P" : "2K");
export function setSwapRes(res) {
  const all = kieExtra(); if (!all) throw Object.assign(new Error("The engine's extra inputs (JSON) can't be read — fix them in Admin → Connections & APIs first."), { code: 400 });
  const m = { ...(all[H3] || {}) }; if (res === "768P") m.resolution = "768P"; else delete m.resolution;
  if (Object.keys(m).length) all[H3] = m; else delete all[H3];
  saveCfg("providers", "kie", { inputs: JSON.stringify(all) }); return swapRes();
}
