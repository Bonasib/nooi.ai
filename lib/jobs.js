import crypto from "crypto";
import os from "os";
import { user, allUsers, save, uid, col, SAVES, hasUser } from "./store.js";
import { PROVIDERS, capFor } from "../providers/index.js";
import { adapterFor, adapterByKey } from "../providers/extra.js";
import { kieAuto, kieDur, kieVariant, swapEngine, SWAP_ENGINES, TRACK_MODEL, KIE_BUILTIN, KIE_I2V, KIE_EDIT } from "../providers/kie.js";
import { nvRoute, nvReady, nvDown176, NV_TASK176, NV_NAME176 } from "../providers/nvidia.js";
import { gen3dRoute } from "../providers/gen3d.js";
import { featureOn, modelOn, cfg, saveCfg, configured, S as platformS } from "./settings.js";
import { checkEntitlement } from "./plans.js";
import { isStaff } from "./admin.js";
const FEATURE = { video: "video", chapter: "story", image: "image", look: "chars", sheet: "chars", edit: "edit", bg: "fx", mocap: "fx", voice: "voice", voiceclone: "voice", voiceconvert: "voice", world: "world", lipsync: "voice", music: "voice", sfx: "voice", isolate: "voice", finish: "finish", transcribe: "subs", dub: "subs", "3d": "studio3d", track3d: "studio3d", view3d: "studio3d", place3d: "studio3d" };
import { download, lastFrame, MEDIA_DIR, localPath } from "./media.js";
import fs from "fs";
import path from "path";
import { priceOf, basePrice, credit, hold, settle, release, lowerHold, raiseHold, lipsPrice } from "./billing.js";
import { moderate } from "./moderation.js";
import { checkContent, wordsBlocked, WORDS_AR } from "./safety126.js";
import { labelAI } from "./label127.js";
import { lookInfo } from "./claude129.js";
import { checkRefs130, asciiTags130, refsOf130, tagWords130 } from "./refs130.js";
import { cast161, castRoute161 } from "./kling161.js";
import { read178 } from "./read178.js";
import { withRetry, classify, USER_MSG } from "./errors.js";
import { cleanChain } from "./recipes.js";
import { tokenCheck, tokenSpend } from "./tokens.js";
import { piperOn, backupVoiceFile } from "../providers/piper.js";
import { prepMotion, engineReason, ENGINE_BUSY, keepSound, joinSwap, mcBest, voiceTrack, cleanVoice, holdCheck154 } from "./mcprep.js";
import { smoothFps, FPS_EXTRA } from "./fps96.js";
import { SLOW163, slowKind163, slowmo163, SLOW_WORDS163, ownsMedia163, edSpec163 } from "./slowmo163.js";
import { XSTATS } from "./xstats.js";
import { JOBCTX, lineStats } from "./line124.js";
import { planLong132, partPrompt132, durOf132, stripFrames132, MAX_PARTS132, longPlan133, probe132, fileOf132 } from "./long132.js";
import { handoff133, adherence133, joinParts133, lockColour133, motion134, headOf134 } from "./seam133.js";
import { clean134, quote134, ready134, make134, STEPS134 } from "./sound134.js";
import { extendWords134, anglePicture134, angleOf134 } from "./extend134.js";
import { editWords135, editPlan135, editPrice135, cutClip135, fitPart135, assemble135, trim135, fpsOf135, EDIT_MAX135 } from "./edit135.js";
import { engineFor134, runEngine134 } from "./engine134.js";
import { scan136 } from "./scan136.js";
import { visualWords136, changeSpan136, soundWorks136, soundMix136, check136, VOICE_PICKS136 } from "./replace136.js";

// other modules react to finished jobs (scenes keep their latest frame and check the result)
export const jobHooks = { before: [], done: [], fail: [] };
// v163: super slow motion chosen for a video — its extra credits, and the engine is asked for real-time action with crisp frames
// (the in-between frames are made from them; lib/slowmo163.js). An unknown choice is dropped.
const slowExtra163 = (b) => { const k = slowKind163(b?.meta?.slow163); return k ? SLOW163[k].extra : 0; };
// (a slow-motion Finish job — tool "slowmo" — costs a preset's extra; the editor's own slowed clips are made free, like its Reverse:
// it is this server's work, no AI engine is paid)
const slowFinish163 = (b) => (b?.kind === "finish" && b.meta?.tool === "slowmo" ? (edSpec163(b.meta) ? 0 : SLOW163[slowKind163(b.meta.slow163) || "super"].extra) : null);
jobHooks.before.push(async (u, body) => { const m = body?.meta; if (body?.kind === "finish" && m?.tool === "slowmo" && !ownsMedia163(user(u.uid), m.sourceUrl || body.inputs?.fin))
    throw Object.assign(new Error("Only a video of yours on the server can be slowed — add it again."), { code: 404, errorAr: "يمكن إبطاء فيديوهاتك الموجودة على الخادم فقط — أضفه مرة أخرى." });
  // (v168: the editor's own slow motion with a speed it doesn't have is refused — not made, and not charged, as a preset)
  if (body?.kind === "finish" && m?.tool === "slowmo" && m.slow163 === "ed" && !edSpec163(m))
    throw Object.assign(new Error("That slow motion can't be made — pick a speed from 0.1× to 1×."), { code: 400, errorAr: "تعذّر صنع هذه الحركة البطيئة — اختر سرعة بين 0.1× و1×." });
  if (!m || m.slow163 == null || body.kind === "finish") return; const k = body.kind === "video" ? slowKind163(m.slow163) : null;
  // (parts shown one after another can't be slowed as one video)
  if (!k || (+m.parts > 1 && !m.long132)) { delete m.slow163; return; } m.slow163 = k; if (!String(body.prompt || "").includes(SLOW_WORDS163)) body.prompt = String(body.prompt || "").replace(/[.\s]*$/, "") + ". " + SLOW_WORDS163; });
// v110: the preview copy (deploy/stage.sh, NOOI_STAGE=1) starts on a copy of the live data. The jobs it finds there belong to
// the live site, which is making them: the preview never sends, checks, joins or finishes them again. Before, it did the same
// work a second time on the same server (downloads, frame smoothing, sound), and since v109 it could send a job again.
// (The moment the copy was first started is kept in the copy, so a restart of the preview doesn't take its own jobs for live ones.)
const BOOT = Date.now();
const STAGE_SINCE = process.env.NOOI_STAGE === "1" ? (() => { const c = col("stage110", {}); if (!c.since) { c.since = BOOT; save(); } return c.since; })() : 0;
export const liveJob = (job) => STAGE_SINCE > 0 && (job.created || 0) < STAGE_SINCE;
const runDone = (uidv, job) => { for (const f of jobHooks.done) Promise.resolve().then(() => f(uidv, job)).catch((e) => console.warn("job hook", e.message)); };
const CHECKING = new Map();   // v126: requests being checked (user|request key → the check)
export async function createJob(u, body) {
  asciiTags130(body);                                                 // v130: the pictures' # names survive the English step
  cast161(body);                                                      // v161: Kling 4.0 — the characters' @names survive it too (#cast1…)
  const tw = Date.now(); for (const f of jobHooks.before) await f(u, body);
  const words = Math.round((Date.now() - tw) / 100) / 10;   // v110: the words steps (English, scene, physics…) before the job exists
  await read178(body);                                                // v178: the pictures and people an engine can't take, read into its words
  if (process.env.GPU_FEATURES !== "true" && ["3d", "track3d", "view3d", "place3d"].includes(body.kind) && !(body.kind === "3d" && (nvRoute("sam3d", body) || gen3dRoute("sam3d", body)))) throw Object.assign(new Error("3D generation is not available yet"), { code: 403 });
  // v173: an NVIDIA engine picked by hand runs on NVIDIA or not at all (never quietly on another engine): no NVIDIA key on this
  // site, or NVIDIA's video model is known to be closed to the key → said at once, nothing charged
  // (v176: any NVIDIA engine picked by hand that the key can't run — not only Cosmos — is refused at once, nothing charged)
  if (nvPicked173(body)) { const nm = NV_NAME176[body.model] || "This NVIDIA engine", t = NV_TASK176[body.model];
    if (!nvReady()) throw Object.assign(new Error("This NVIDIA engine isn't set up on this site — nothing was charged. Pick another engine or nooi Auto."), { code: 409, errorAr: "محرك NVIDIA هذا غير مُعدّ في هذا الموقع — لم يُخصم شيء. اختر محركاً آخر أو nooi تلقائي." });
    if (t && nvDown176(t)) throw Object.assign(new Error(nm + " isn't open to this site right now — nothing was charged. Pick another engine or nooi Auto."), { code: 409, errorAr: nm + " غير متاح لهذا الموقع الآن — لم يُخصم شيء. اختر محركاً آخر أو nooi تلقائي." }); }
  const flag = moderate((body.prompt || "") + " " + (body.meta?.refs || []).map((r) => r.description).join(" "));
  if (flag) { wordsBlocked(u.uid, body.kind, flag); throw Object.assign(new Error("Blocked by the Acceptable Use Policy (" + flag + ")"), { code: 422, errorAr: WORDS_AR }); }
  // an avatar speaks the typed words: the "bring this picture to life" motion line is not a script (and would be spoken aloud)
  if (body.kind === "lipsync" && !(body.inputs || {}).lsA && /^\s*(bring this picture to life|حرّ?ك هذه الصورة)/i.test(String(body.prompt || ""))) throw Object.assign(new Error("Type what the avatar should say — that line moves a picture, it isn't speech"), { code: 400 });
  if (body.kind === "voiceclone" && !body.meta?.consent) throw Object.assign(new Error("Voice cloning needs the speaker's consent"), { code: 400 });
  if (FEATURE[body.kind] && !featureOn(FEATURE[body.kind])) throw Object.assign(new Error("This feature is turned off"), { code: 403 });
  if (body.model && !modelOn(body.model)) throw Object.assign(new Error("This engine is turned off"), { code: 403 });
  extend132(u, body);                                                 // v132: Extend continues a finished video from its last frame (v134: before the pictures' check — it picks their engine)
  checkRefs130(body);                                                 // v130: reference pictures (# names) — an engine that takes them
  if (body.kind === "video" && body.meta?.sound134) return soundJob134(u, body);   // v134: voices & sound for a made video
  if (body.kind === "video" && body.meta?.merge135) return mergeJob135(u, body);   // v135: several videos as one, joined so it can't be seen
  if (body.kind === "video" && body.meta?.edit135) return editJob135(u, body);     // v135: a made video changed with words
  if (body.meta?.replace136) return replaceJob136(u, body);                         // v136: things in a video or a picture replaced or removed
  // v94: "Extend shot" names the user's own earlier job; when Veo made it here, its engine task lets Veo continue that same video.
  // Only the server sets veoTask (a task id sent by the browser is dropped).
  if (body.meta && ("extendOf" in body.meta || "veoTask" in body.meta)) { const b = body.meta.extendOf ? (user(u.uid).jobs || {})[String(body.meta.extendOf)] : null;
    const vt = b && b.status === "done" && String(b.prov || "").startsWith("kie@") && /^veo:/.test(b.remoteId || "") ? b.remoteId.slice(4) : undefined;
    body.meta = { ...body.meta, extendOf: b ? b.id : undefined, veoTask: vt }; }
  const cap = capFor(body.kind, body.meta);
  const route = cap && adapterFor(cap, body, PROVIDERS); const prov = route && route.a;
  castRoute161(body, route && route.key);                             // v161: not on Kling 4.0 after all → the names come back
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
  if (mc && body.model === "mcswap" && swapRes() === "768P") body.meta = { ...body.meta, swapFast: true };   // v114: "Faster" on Seedance = 720p
  if (mc && body.model === "mcswap") body.dur = Math.max(4, Math.min(120, Math.round(+body.dur || 5)));   // (the page's length until the video is read)
  // v132: a video longer than its engine's shot (up to 2 minutes) is made in connected parts, planned by the agents, joined into one
  // v133: every part a length its own engine really makes (Veo 8 s, MiniMax 6/10 s, Kling 2.6 5/10 s…), on any engine or a mix of them
  if (!mc && !body.meta?.extend132 && body.kind === "video") {
    const pmods = Array.isArray(body.meta?.partModels) ? body.meta.partModels : null;
    const keyOf = (i) => { const pm = pmods && pmods[i]; if (!pm || pm === body.model) return route.key; const r = adapterFor(cap, { ...body, model: String(pm) }, PROVIDERS); return (r && r.key) || route.key; };
    const durs = longPlan133(body, keyOf);
    if (durs) body.meta = { ...(body.meta || {}), parts: durs.length, durs133: durs, long132: 1 }; }
  // a video is priced for the length the engine really makes (e.g. 5 or 10 s for Kling 2.6, 8 s for Veo) — a swap: the video's own length
  if (["video", "chapter"].includes(body.kind) && String(route.key || "").startsWith("kie@") && !(+body.meta?.parts > 1) && body.model !== "mcswap") { const real = kieDur(route.key.slice(4), body.dur); if (real && real !== Math.round(+body.dur || 5)) { body.meta = { ...(body.meta || {}), durAsked: +body.dur || 5 }; body.dur = real; } }
  // owners & admins test every model on the Studio plan without spending credits
  const staff = isStaff(u);
  if (!staff) checkEntitlement(user(u.uid), body);
  // nooi Studio 2.0: a long video may use a different engine model for each part (picked by the bots)
  const partModels = body.kind === "video" && +body.meta?.parts > 1 && Array.isArray(body.meta?.partModels) ? body.meta.partModels.slice(0, MAX_PARTS132).map(String) : null;
  if (partModels) for (const m of partModels) { if (!modelOn(m)) throw Object.assign(new Error("This engine is turned off"), { code: 403 }); if (!staff) checkEntitlement(user(u.uid), { ...body, model: m, dur: 0 }); }
  // v126: the content check in every language and on the pictures (when the owner switched it on) — a refusal charges nothing.
  // The same request sent twice while the first is being checked (a double tap) waits for it and gets the job it made.
  const ck = u.uid + "|" + key, first = CHECKING.get(ck);
  if (first) { await first.catch(() => {}); const d2 = dupJob(u.uid, key, body); if (d2) return d2; }
  const pc = checkContent(u, body); CHECKING.set(ck, pc);
  try { await pc; } finally { if (CHECKING.get(ck) === pc) CHECKING.delete(ck); }
  const price = (slowFinish163(body) ?? priceOf(body.kind, body)) + (body.kind === "video" ? (FPS_EXTRA[+body.meta?.fps] || 0) + slowExtra163(body) : 0) + (body.meta?.extMode134 === "angle" ? ANGLE_PIC134() : 0), cost = staff ? 0 : price;
  tokenCheck(u, price);                                               // a connection (API token): read-only, or over its daily limit → refused
  const jid = uid();
  if (cost) hold(u.uid, cost, (body.kind || "job") + " · " + String(body.prompt || "").slice(0, 40), jid);   // held now, charged when it finishes
  const job = { id: jid, owner: u.uid, kind: body.kind, cap, prov: route.key, status: "queued", progress: 0, created: Date.now(), payload: body, ask175: String(body.model || ""), cost, title: body.title || body.prompt || "", ...(words >= 0.1 ? { times: { words } } : {}), ...(u.viaToken && u.tokenId ? { tok: u.tokenId } : {}) };
  user(u.uid).jobs[job.id] = job; track(u.uid, job); rememberJob(u.uid, key, job.id); tokenSpend(u, price); save();
  if (mc) { job.stage = "prep"; job.times = job.times || {}; save(); prepAndStart(u, job, body, route).catch((e) => fail(u.uid, job, e && e.code === 400 ? Object.assign(e, { userMsg: e.message, noFallback: true }) : e)); return job; }
  const parts = body.kind === "video" ? Math.min(MAX_PARTS132, Math.max(1, +body.meta?.parts || 1)) : 1;
  // a storyboard: each part starts from its scene's picture (instead of the previous part's last frame)
  const pub0 = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""), abs = (u) => (/^\/media\//.test(u) ? pub0 + u : u);
  const pimg = body.kind === "video" && Array.isArray(body.meta?.partImages) ? body.meta.partImages.slice(0, MAX_PARTS132).map((u) => (typeof u === "string" && /^(https?:\/\/|\/media\/)/.test(u) ? abs(u) : null)) : null;
  if (pimg && parts === 1 && pimg[0] && !(body.inputs || {}).startImage) body.inputs = { ...(body.inputs || {}), startImage: pimg[0] };
  if (parts > 1 && body.meta?.long132) {   // v132: the agents plan the video first (in the background), then the parts are made
    job.children = []; job.status = "rendering"; job.partsTotal = parts; job.partsDone = 0;
    if (!pimg && !(Array.isArray(body.meta.shots) && body.meta.shots.length >= parts)) job.stage = "plan";
    save(); partsStart132(u.uid, job, body, route, parts, partModels, pimg).catch((e) => fail(u.uid, job, e)); return job;
  }
  if (parts > 1) {                      // long video: N connected parts, each continuing from the previous last frame
    const per = Math.ceil((+body.dur || 5) / parts); let prev = null; job.children = []; job.status = "rendering";
    for (let i = 0; i < parts; i++) {
      const pm = partModels && partModels[i], croute = pm && pm !== body.model ? adapterFor(cap, { ...body, model: pm }, PROVIDERS) || route : route;
      const child = { id: uid(), owner: u.uid, kind: "video", cap, prov: croute.key, status: "queued", progress: 0, created: Date.now(), parent: job.id, cost: 0, title: `${job.title} · ${i + 1}/${parts}`,
        payload: { ...body, ...(pm ? { model: pm } : {}), dur: per, chainAfter: pimg && pimg[i] ? null : prev, ...(pimg && pimg[i] ? { inputs: { ...(body.inputs || {}), startImage: pimg[i] } } : {}), meta: { ...(body.meta || {}), parts: 1, part: i + 1 }, prompt: body.meta?.shots?.[i] ? `${body.meta.shots[i]}${body.meta.bible ? "\n\nContinuity: " + body.meta.bible : ""}${i && !(pimg && pimg[i]) ? ` — continue seamlessly from the previous shot (part ${i + 1} of ${parts}), same characters, place and light` : pimg && pimg[i] ? " — bring this storyboard picture to life: same characters, place, light and style" : ""}` : i ? `${body.prompt} — continue seamlessly (part ${i + 1} of ${parts}), same characters, place and light` : body.prompt } };
      user(u.uid).jobs[child.id] = child; track(u.uid, child); job.children.push(child.id); prev = child.id;
      start(child).catch((e) => fail(u.uid, child, e));
    }
    save(); return job;
  }
  start(job).catch((e) => fail(u.uid, job, e));
  return job;
}
// v132: a long video's parts. The plan (lib/long132.js planLong132: the Writer, Director, Cinematographer and Continuity
// supervisor in one request to the text AI, or the offline plan) gives one shot per part and the bible; then the parts are made one
// after the other, each from the last frame of the one before (start → chainAfter), the user's first frame on part 1 only and
// the end frame on the last part only. Picked up again after a restart (recoverJobs).
async function partsStart132(uidv, job, body, route, parts, partModels, pimg) {
  const fr = { first: !!((body.inputs || {}).vStart || (body.inputs || {}).startImage), end: !!(body.inputs || {}).vEnd };
  if (body.meta?.frames113) body.prompt = stripFrames132(body.prompt);   // (the frame sentences go on the first / last part only)
  if (job.stage === "plan") { const t0 = Date.now(), pl = await planLong132(body, parts);
    body.meta = { ...body.meta, shots: pl.shots, bible: body.meta.bible || pl.bible, plan132: pl.by };
    job.plan132 = { by: pl.by, title: pl.title, shots: pl.shots }; job.times = { ...(job.times || {}), plan: Math.round((Date.now() - t0) / 100) / 10 }; delete job.stage; job.payload = body; save(); }
  if (job.status !== "rendering" || (job.children || []).length) return;   // (failed or deleted meanwhile; or already started)
  // v136: all the shots at the same time — each from its own first picture (made first, also all at once)
  if (FAST136(body, parts, pimg) && !job.kf136) { const t0 = Date.now(); job.stage = "frames"; save();
    try { job.kf136 = await keyframes136(body, parts, fr); } catch (e) { console.warn("keyframes", job.id, String(e.message).slice(0, 160)); job.kf136 = []; }
    job.times = { ...(job.times || {}), frames: Math.round((Date.now() - t0) / 100) / 10 }; delete job.stage; save();
    if (job.status !== "rendering" || (job.children || []).length) return; }
  if (!pimg && Array.isArray(job.kf136) && job.kf136.some(Boolean)) { pimg = job.kf136.map((u) => u || null); body.meta = { ...body.meta, fast136: 1 }; job.payload = body; }
  const per = Math.ceil((+body.dur || 5) / parts), cap = job.cap; let prev = null;
  for (let i = 0; i < parts; i++) {
    const pm = partModels && partModels[i], croute = pm && pm !== body.model ? adapterFor(cap, { ...body, model: pm }, PROVIDERS) || route : route, pic = pimg && pimg[i];
    const inputs = { ...(body.inputs || {}) }; if (i > 0) { delete inputs.vStart; delete inputs.startImage; } if (i < parts - 1) delete inputs.vEnd; if (pic) inputs.startImage = pic;
    const child = { id: uid(), owner: uidv, kind: "video", cap, prov: croute.key, status: "queued", progress: 0, created: Date.now(), parent: job.id, cost: 0, title: `${job.title} · ${i + 1}/${parts}`,
      payload: { ...body, ...(pm ? { model: pm } : {}), dur: +(body.meta?.durs133 || [])[i] || per, inputs, chainAfter: pic ? null : prev, meta: { ...(body.meta || {}), parts: 1, part: i + 1, long132: 1 }, prompt: partPrompt132(body, i, parts, !!pic, fr) } };
    user(uidv).jobs[child.id] = child; track(uidv, child); job.children.push(child.id); prev = child.id;
    start(child).catch((e) => fail(uidv, child, e));
  }
  save();
}
// v136: a film's shots made at the same time. Before, each part waited for the one before and started from its last frame — six
// parts were six times the engine's time (a minute of video could take over an hour), and one part that failed lost the film.
// Now the agents' shots each get their own first picture (the picture engine, all at once: the first shot's picture is the
// customer's first frame or the scene's, or made first; every other one is made from it and the customer's pictures, so the people,
// the place and the light stay the same), and every part starts at once from its picture — the film takes about as long as its
// slowest shot; the shots are joined with clean cuts. One continuous take (meta.continuous) still goes part after part.
const FAST136 = (body, parts, pimg) => parts > 1 && !pimg && body.meta?.continuous !== true && process.env.LONG_FAST !== "false" && !!engineFor134("image", { model: "nano" });
async function keyframes136(body, parts, fr) {
  const m = body.meta || {}, shots = Array.isArray(m.shots) ? m.shots : [], inp = body.inputs || {}, refs = refsOf130(body).map((r) => r.url).slice(0, 3);
  const words = (i, same) => `A film still — the first frame of shot ${i + 1} of ${parts}: ${String(shots[i] || body.prompt || "").slice(0, 900)}.${m.bible ? " The film's world: " + String(m.bible).slice(0, 500) + "." : ""}${same ? " The same film as the first picture: the same people (faces, hair, clothes), the same place, time of day, light, colours and style — only the moment and the camera change." : ""}${same || refs.length ? " In exactly the visual style of the " + (same ? "first picture" : "reference pictures") + " — the same kind of image (a photo stays a photo, a cartoon stays a cartoon, a 3D animation stays 3D), the same rendering, colours and light." : ""} A film still: no text, no borders.`;
  const pic = async (i, ref) => (await runEngine134("image", { model: "nano", prompt: words(i, !!ref), aspect: body.aspect || undefined, inputs: { ...(ref ? { iRef: ref } : {}), ...Object.fromEntries(refs.map((u, k) => [ref ? "iRef" + (k + 2) : k ? "iRef" + (k + 1) : "iRef", u])) }, meta: { kf136: 1 } })).url;
  const first = (fr && fr.first && (inp.vStart || inp.startImage)) || await pic(0, null);
  const rest = await Promise.all(Array.from({ length: parts - 1 }, (_, k) => pic(k + 1, first).catch((e) => { console.warn("keyframe", k + 2, String(e.message).slice(0, 120)); return null; })));
  return [first, ...rest];
}
// v136: the parts of a film that were made, joined (the parts after one that failed in a continuous take, or the one that failed among
// shots made at the same time, are left out); charged for the seconds made — the rest can be made again (againParts136)
async function partialFilm136(uidv, job, kids) {
  const durs = kids.map((k, i) => +(job.payload?.meta?.durs133 || [])[i] || +k.payload?.dur || 5), total = durs.reduce((a, b) => a + b, 0);
  const made = kids.map((k, i) => (k.status === "done" && k.url ? i : -1)).filter((i) => i >= 0), missing = kids.map((_, i) => i).filter((i) => !made.includes(i));
  const failed = kids.find((k) => k.status === "failed"), why = failed && failed.reason ? String(failed.reason).replace(/[.\s]*$/, "") : "";
  if (job.again136) { const a = job.again136, got = (a.parts || []).filter((n) => made.includes(n - 1)), pay = Math.round((job.full136 || 0) * got.reduce((s, n) => s + durs[n - 1], 0) / Math.max(1, total));
    if (pay > 0 && (lowerHold(uidv, a.ref, pay) || true) && settle(uidv, a.ref)) job.cost = (job.cost || 0) + Math.min(pay, a.price || pay); else release(uidv, a.ref);   // (made again: only the parts that came out are charged)
    delete job.again136; job.paid136 = true; }
  if (!made.length) return false;
  const share = made.reduce((a, i) => a + durs[i], 0) / Math.max(1, total);
  if (!job.full136) job.full136 = job.cost || 0;
  if (job.cost && !job.paid136) { const now = Math.max(0, Math.round(job.full136 * share)); if (now < job.cost && lowerHold(uidv, job.id, now)) job.cost = now; }
  job.partial136 = { made: made.length, of: kids.length, missing: missing.map((i) => i + 1), reason: why || null, secs: Math.round(made.reduce((a, i) => a + durs[i], 0)), full: job.full136 };
  job.joining = true; job.stage = "join"; job.progress = 0.97; save();
  const fast = !!job.payload?.meta?.fast136, use = made.map((i) => kids[i]);
  const r = use.length > 1 ? await joinParts133(use.map((k, j) => ({ url: k.url, cut: k.hand133 && k.hand133.t, hard: fast || made[j] - (made[j - 1] ?? made[j] - 1) > 1 }))) : { url: use[0].url, dur: null, seams: null, plain: true };
  const url = await labelAI(job, r.url, uidv);
  job.url = url; job.segments = use.map((k) => k.url); job.longDur = r.dur || null; job.status = "done"; job.doneAt = Date.now(); job.progress = 1; delete job.joining; delete job.stage;
  if (r.seams) job.seams133 = r.seams; if (job.cost && !job.paid136) { settle(uidv, job.id); job.paid136 = true; } save(); runDone(uidv, job); return true;
}
// v136: "Make the missing part again" — the parts a film is missing, made again (priced for their seconds, shown first), then the
// film joined again with them in their place
export function againQuote136(job) {
  if (!job || !job.partial136 || job.status !== "done" || !Array.isArray(job.children)) return null;
  const durs = job.children.map((_, i) => +(job.payload?.meta?.durs133 || [])[i] || 5), total = durs.reduce((a, b) => a + b, 0), miss = job.partial136.missing || [];
  const full = job.partial136.full || 0; return { parts: miss, price: full ? Math.max(1, Math.round(full * miss.reduce((a, n) => a + durs[n - 1], 0) / Math.max(1, total))) : 0 };
}
export function againParts136(u, id) {
  const U = user(u.uid), job = (U.jobs || {})[String(id)], q = againQuote136(job), staff = isStaff(u);
  if (!q) throw Object.assign(new Error("Nothing to make again for this video."), { code: 400, errorAr: "لا شيء يُعاد صنعه في هذا الفيديو." });
  const price = staff || !job.partial136.full ? 0 : q.price, ref = job.id + ".again" + Date.now().toString(36);
  if (price) hold(u.uid, price, "Make again · " + String(job.title || "").slice(0, 40), ref);
  job.again136 = { ref, price, parts: q.parts }; delete job.paid136;
  for (const n of q.parts) { const i = n - 1, old = U.jobs[job.children[i]]; if (!old) continue;
    const prevId = job.children[i - 1], prevOk = prevId && U.jobs[prevId] && U.jobs[prevId].status === "done";
    const fast = !!job.payload?.meta?.fast136, payload = { ...old.payload, chainAfter: fast ? null : prevOk ? prevId : null, inputs: { ...(old.payload.inputs || {}) } };
    const child = { id: uid(), owner: u.uid, kind: "video", cap: old.cap, prov: old.prov, status: "queued", progress: 0, created: Date.now(), parent: job.id, cost: 0, title: old.title, payload };
    U.jobs[child.id] = child; track(u.uid, child); job.children[i] = child.id; start(child).catch((e) => fail(u.uid, child, e)); }
  job.status = "rendering"; job.progress = 0.05; job.stage = "again"; job.live158 = Date.now(); delete job.doneAt; track(u.uid, job); save();
  return job;
}
// v132: Extend — a finished video goes on: a new part from its last frame (its own engine unless another is chosen), then the two
// are joined into one longer video (finish → extendJoin132). The video to extend is the caller's own job (meta.extend132 = its
// id), or — from the Finish page's "Extend video" — the caller's own job's file or a file on this server (never another address).
// Before, the Video page's "Extend +5s" made a new video from the same words, and the Finish tool sent the engine no words and no frame.
const EXT_WORDS132 = (n, w) => `Continue this exact shot for ${n} more seconds: ${w}. It begins exactly on the last frame of the video before it — the same characters, place, time of day, light and camera style; no cut, no new scene; the action simply goes on.`;
function extend132(u, body) {
  const m = body.meta || {}, fromTool = body.kind === "finish" && m.tool === "extend";
  if (!m.extend132 && !fromTool) return;
  const jobs = user(u.uid).jobs || {}; let base = null, url = null;
  if (m.extend132 && jobs[String(m.extend132)]) { base = jobs[String(m.extend132)]; url = base.url; }
  else { const src = String(body.source || (body.inputs || {}).fin || m.extend132 || "");
    base = Object.values(jobs).find((j) => j.url && (j.url === src || (j.segments || []).includes(src))) || null; url = base ? base.url : null;
    if (!base && /^\/media\/[A-Za-z0-9._-]+$/.test(src.replace((process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""), "")) && !/\.scrub\.mp4$/.test(src)) {
      const f = path.join(MEDIA_DIR, path.basename(src)); if (fs.existsSync(f)) url = src; } }
  if (base && (base.status !== "done" || !["video", "chapter", "finish"].includes(base.kind))) throw Object.assign(new Error("Only a finished video can be extended."), { code: 400, errorAr: "يمكن تمديد فيديو مكتمل فقط." });
  if (!url) throw Object.assign(new Error("That video isn't yours or isn't on the server any more."), { code: 400, errorAr: "هذا الفيديو ليس لك أو لم يعد على الخادم." });
  const n = Math.max(3, Math.min(15, Math.round(+(m.opt && m.opt.len) || +body.dur || 5))), own = String(body.prompt || "").trim(), words = own || String(base && (base.payload?.meta?.shots?.slice(-1)[0] || base.payload?.prompt || base.title) || "the action goes on naturally").slice(0, 1500);
  body.kind = "video"; body.dur = n; body.model = body.model || (base && base.payload?.model) || "auto"; body.aspect = body.aspect || (base && base.payload?.aspect) || undefined;
  // v134: same movement (default) or another angle; the customer's characters; pictures (# names) → an engine that takes them
  const mode = m.extMode134 === "angle" ? "angle" : "same", chars = Array.isArray(m.chars134) ? m.chars134.slice(0, 4).map((c) => ({ name: String(c?.name || "").slice(0, 40), look: String(c?.look || "").slice(0, 200) })) : [];
  if (Array.isArray(m.refs130) && m.refs130.length && !REF_EXT134.has(String(body.model))) body.model = "seedance20";
  body.prompt = extendWords134({ mode, n, words: words.replace(/[.\s]*$/, ""), angle: m.angle134, chars }); body.chainFrom = url; delete body.source;
  m.extMode134 = mode; m.angle134 = mode === "angle" ? angleOf134(m.angle134) : undefined; m.chars134 = chars.length ? chars : undefined; m.extWords134 = own ? own.slice(0, 1500) : undefined;
  if (body.inputs) { delete body.inputs.fin; delete body.inputs.vStart; delete body.inputs.startImage; delete body.inputs.vEnd; }   // (the page's own frames are not this video's)
  body.meta = { ...m, tool: undefined, extend132: base ? base.id : "file", extBase132: url, extend94: 1, ...(base ? { extendOf: base.id } : {}), ...(mode === "angle" ? { veoTask: undefined } : {}) };
}
// v136: an extension goes on from the video's last frame. An engine that ignored the frame makes a new shot — seen on the owner's
// phone: a wide shot from the side "extended" by a close-up from the front, which no join can hide. Checked like a long video's
// parts (lib/seam133.js adherence133): made again once from the same frame, on an engine that keeps a first frame (the same one,
// told again, when it already is one); a second miss is kept and joined with a clean cut. Not for another angle (a cut on purpose)
// or Veo's own extension (it holds the video before).
async function extendCheck136(job, url) {
  const M = job.payload?.meta || {}, given = job.payload?.inputs?.startImage, t = +job.adhAgain133 || 0;
  if (M.extMode134 === "angle" || !given || process.env.EXT_CHECK === "false" || M.extCut136) return;
  try { const [db, dn] = await Promise.all([durOf132(M.extBase132).catch(() => 0), durOf132(url)]); if (db && dn >= db + (+job.payload.dur || 5) * 0.6) return; } catch {}
  const a = await adherence133(url, given).catch(() => null); if (!a || a.unknown) return;
  job.adh133 = { d: a.d, ok: a.ok, again: t }; if (a.ok) return;
  if (t >= 1) { M.extCut136 = true; save(); return; }
  job.adhAgain133 = 1;
  const was = String(job.prov || ""), cur = String(job.payload.model || "");
  if (was.startsWith("kie@") && !FIRST_FRAME133.includes(cur)) for (const m of FIRST_FRAME133) { const km = kieAuto("video", { ...job.payload, model: m }); if (km && "kie@" + km !== was) { job.prov = "kie@" + km; job.payload.model = m; break; } }
  save(); restart(job, ADH_WORDS133); return "again";
}
const REF_EXT134 = new Set(["seedance25", "seedance20", "seedance"]);
const ANGLE_PIC134 = () => basePrice("image", "nano") ?? 5;   // the picture of the new angle (made before the video)
// the extended video: the video before + the new part, as one (Veo's own extension already holds the video before — kept as it is)
async function extendJoin132(job, url) {
  const b = job.payload?.meta?.extBase132, M = job.payload?.meta || {}; if (!b || !url || job.ext132) return url;
  try { const [db, dn] = await Promise.all([durOf132(b).catch(() => 0), durOf132(url)]), add = +job.payload.dur || 5;
    // v134: the editor places the new part itself (after the clip, cut at the hand-off frame; the new part from where it really begins)
    if (M.extNoJoin134) { let head = 0; try { if (M.extMode134 !== "angle" && job.payload.inputs?.startImage) head = await headOf134(url, job.payload.inputs.startImage); } catch {}
      job.ext132 = { part: true, dur: Math.round(dn * 10) / 10 }; job.ext134 = { cut: M.baseCut133 || null, head, mode: M.extMode134 || "same" }; return url; }
    if (dn >= db + add * 0.6) { job.ext132 = { kept: true, dur: Math.round(dn * 10) / 10 }; return url; }
    job.stage = "join"; save(); const r = await joinParts133([{ url: b, cut: M.baseCut133 }, { url, hard: M.extMode134 === "angle" || !!M.extCut136 }]);
    job.ext132 = { joined: true, dur: r.dur, part: url, seamless: !r.plain }; job.ext134 = { mode: M.extMode134 || "same", angle: M.angle134 || undefined }; return r.url; }
  catch (e) { console.warn("extend join", job.id, e.message); job.ext132 = { failed: String(e.message).slice(0, 160) }; return url; }
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
      const child = { id: uid(), owner: u.uid, kind: "video", cap, prov: route.key, status: "queued", progress: 0, created: Date.now(), parent: job.id, cost: 0, title: `${job.title} · ${i + 1}/${sp.length}`,
        payload: { ...body, dur: String(route.key || "").startsWith("kie@") ? kieDur(route.key.slice(4), p.dur) : Math.round(p.dur), inputs: { ...body.inputs, mcMove: p.url }, meta: { ...body.meta, swapParts: undefined, swapPart: i + 1, swapWhere: p.where || undefined } } };
      p.job = child.id; user(u.uid).jobs[child.id] = child; track(u.uid, child); job.children.push(child.id); start(child).catch((e) => fail(u.uid, child, e));
    });
    save(); return;
  }
  await start(job);
}
async function start(job) {
  const p = job.payload; p.inputs = p.inputs || {};
  // Chapter Story: start this chapter from the last frame of the previous one
  // Long videos are split into parts: each part waits for the previous one, then continues from its last frame
  if (p.chainAfter) { const U = findJob(p.chainAfter); const prev = U && U[1]; const t0 = Date.now();
    while (prev && prev.status !== "done" && prev.status !== "failed" && Date.now() - t0 < 30 * 60e3) await new Promise((r) => setTimeout(r, 1500));
    if (prev && prev.status === "done") { p.chainFrom = prev.url; if (prev.hand133 && prev.hand133.img) { p.handFrom133 = prev.hand133.img; if (prev.hand133.motion) p.motionFrom134 = prev.hand133.motion; } else delete p.handFrom133; }
    else if (prev) throw Object.assign(new Error("The previous part failed"), { type: "input" }); }
  // v133: a part starts on the part before's hand-off frame (its last clean, sharp frame — lib/seam133.js), an Extend on the video's
  if (p.chainFrom) { try {
      if (p.handFrom133) { p.inputs.startImage = p.handFrom133; if (p.motionFrom134 && !p.meta?.motion134) { p.meta = { ...(p.meta || {}), motion134: p.motionFrom134 }; p.prompt = String(p.prompt || "") + " " + p.motionFrom134; } }
      else if (p.meta?.extBase132 && !job.parent) { if (!p.meta.baseCut133 || !p.inputs.startImage) {
        if (/\.(png|jpe?g|webp)(\?|$)/i.test(p.chainFrom)) p.inputs.startImage = p.chainFrom;   // (v134: the editor's clip that isn't on the server: its last frame)
        else { const h = await handoff133(p.chainFrom); p.inputs.startImage = h.img; p.meta.baseCut133 = h.t;
          // v134: the same movement — the camera and the action at the end of the video go on exactly as they were
          if (p.meta.extMode134 !== "angle" && !p.meta.motion134) { try { const mo = await motion134(p.chainFrom, h.t); if (mo) { p.meta.motion134 = mo.words; p.prompt = String(p.prompt || "") + " " + mo.words; } } catch (e) { console.warn("motion", e.message); } } }
        // v134: another angle — a picture of the same moment from the new camera position starts the new part
        if (p.meta.extMode134 === "angle" && !p.meta.anglePic134) { job.stage = "angle"; save();
          p.meta.anglePic134 = await anglePicture134(p.inputs.startImage, p.meta.angle134, p.meta.extWords134, p.aspect, p.meta.chars134); p.inputs.startImage = p.meta.anglePic134; delete job.stage; save(); } } }
      else p.inputs.startImage = await lastFrame(p.chainFrom);
    } catch (e) { console.warn("chain frame:", e.message); if (!p.inputs.startImage) { try { p.inputs.startImage = await lastFrame(p.chainFrom); } catch {} } }
    // v133: a part that now starts from a picture goes to the engine's picture-to-video model (a text-to-video model ignores the frame)
    if (p.inputs.startImage && String(job.prov || "").startsWith("kie@")) { const id = job.prov.slice(4), v = kieVariant(id, "video", p); if (v && v !== id) { job.prov = "kie@" + v; save(); } } }
  // the engine calls us back the moment the job is ready (we still re-check its status ourselves)
  const pub = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""); if (pub && /^https:/.test(pub)) p.callbackUrl = `${pub}/v1/engine/cb/${job.id}/${cbSig(job.id)}`;
  const r = await JOBCTX.run(job, () => withRetry(() => adapterByKey(job.prov || job.cap, PROVIDERS).submit(p)));   // (v124: a busy engine → its send line)
  if (r.sent) job.sent = r.sent;
  job.sentAt = Date.now();   // v109: when the engine got it (the Admin speed card: our part before it, the engine's after)
  if (r.done) await finish(job, r.url, r.segments); else { job.remoteId = r.remoteId; job.status = "rendering"; save(); }
}
export const cbSig = (id) => crypto.createHmac("sha256", process.env.SECRET_KEY || "nooi").update("cb:" + id).digest("hex").slice(0, 24);
// v163: the chosen slow motion is made from the finished video (once); if it can't be made the video comes at its real speed and
// the slow-motion extra is given back
async function slowStep163(job, url) {
  const k = job.kind === "video" ? slowKind163(job.payload?.meta?.slow163) : null; if (!k || !url || job.slow163) return url;
  job.slow163 = "making"; job.stage = "slow"; save();
  try { const r = await slowmo163(url, k); job.slow163 = k; job.slowDur163 = r.dur; delete job.stage; return r.url; }
  catch (e) { job.slow163 = "failed"; delete job.stage; console.warn("slow motion", job.id, e.message);
    const me = findJob(job.id), extra = SLOW163[k].extra; if (me && job.cost && extra && !job.slowRefund163) { job.slowRefund163 = extra; credit(me[0], extra, "Refund · slow motion couldn't be made", job.id); }
    return url; }
}
async function finish(job, url, segments) {
  if (job.status === "cancelled") return;   // (v125: its account was deleted — the result isn't brought here)
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
  if (url && !job.parent) url = await slowStep163(job, url);
  // v154: a swap that doesn't hold to the end (the new person at the start, then the old one back) is made once more on the engine
  // that follows the person frame by frame
  if (url && job.payload?.model === "mcswap" && !job.payload?.meta?.swapParts && !job.check154 && hold154On() && (await hold154(job, url)) === "again") return;
  // v104: Motion Control / Character Swap come back silent — the client's own video gives its sound back (v105: the swap always
  // has the video's own sound and length)
  if (MC_MODEL.test(job.payload?.model || "") && url && job.payload?.inputs?.mcMove && !job.sound104) {
    job.sound104 = true; try { const k = await keepSound(url, job.payload.inputs.mcMove, job.payload.model === "mcswap"); if (k) url = k; } catch (e) { console.warn("sound", job.id, e.message); } }
  const ownerId = ownerOf(job);
  if (ownerId) url = await lipsOr(ownerId, job, url);   // v115: the lips follow the video's voice (Replace the person)
  if (job.engineAt && job.times) { job.times.engine = Math.round((Date.now() - job.engineAt) / 100) / 10; delete job.engineAt; } if (job.stage) delete job.stage;
  const after = Math.round((Date.now() - tf) / 100) / 10; if (after >= 0.1) job.times = { ...(job.times || {}), fetch: fetched, ...(after - fetched >= 0.1 ? { after: Math.round((after - fetched) * 10) / 10 } : {}) };
  // v132: a part of a long video — the agents' continuity check (the place, the light, the characters) before the next part starts
  if (url && job.parent && job.payload?.meta?.long132 && (await continuity132(job, url)) === "again") return;
  if (url && job.payload?.meta?.extBase132 && !job.parent && (await extendCheck136(job, url)) === "again") return;   // v136: it really goes on from the last frame
  if (url && job.payload?.meta?.extBase132 && !job.parent) url = await extendJoin132(job, url);   // v132: Extend → one longer video
  // v127: the "Made with AI" mark (always on a face swap) and the content credentials — a swap part / a long video's part waits for the joined video
  if (url && !(job.parent && (isSwapPart(job) || job.payload?.meta?.long132))) { try { url = await labelAI(job, url, ownerId); }
    catch (e) { if (ownerId) fail(ownerId, job, Object.assign(new Error(e.message), { userMsg: LABEL_MSG[0], userMsgAr: LABEL_MSG[1], noFallback: true })); return; } }
  job.url = url; job.status = "done"; job.doneAt = Date.now(); save();
  const oid = ownerOf(job); if (oid) { if (job.cost) settle(oid, job.id); runDone(oid, job); }
}
// v134: voices and sound for a made video (lib/sound134.js): the whole video, one shot or one moment. Priced before anything is
// made (the page shows it); what isn't made isn't charged (the hold is lowered to what was really used).
async function soundJob134(u, body) {
  const s = body.meta.sound134 || {}, jobs = user(u.uid).jobs || {}, staff = isStaff(u), pub0 = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const base = s.job ? jobs[String(s.job)] || null : null; let src = base ? base.url : String(s.src || "");
  const bad = (en, ar, code = 400) => { throw Object.assign(new Error(en), { code, errorAr: ar }); };
  if (s.job && !base) bad("That video isn't yours or isn't on the server any more.", "هذا الفيديو ليس لك أو لم يعد على الخادم.");
  if (base && (base.status !== "done" || !base.url || !["video", "chapter", "finish", "dub"].includes(base.kind))) bad("Only a finished video can get voices and sound.", "يمكن إضافة الأصوات لفيديو مكتمل فقط.");
  if (!base) { const loc = src.replace(pub0, ""); if (!/^\/media\/[A-Za-z0-9._-]+$/.test(loc) || /\.scrub\.mp4$/.test(loc) || !fs.existsSync(path.join(MEDIA_DIR, path.basename(loc)))) bad("That video isn't yours or isn't on the server any more.", "هذا الفيديو ليس لك أو لم يعد على الخادم."); src = loc; }
  const key = reqKey(body), dup = dupJob(u.uid, key, body); if (dup) return dup;
  const info = await probe132(await fileOf132(src)).catch(() => null);
  if (!info || !info.dur) bad("The video can't be read.", "تعذّرت قراءة الفيديو."); if (info.dur > 600) bad("Voices and sound for videos up to 10 minutes.", "الأصوات للفيديو حتى 10 دقائق.");
  // v157: the customer's own voice clip (uploaded to this server) — cloning it needs the speaker's consent
  if (s.clip) { const loc = String(s.clip).replace(pub0, "");
    if (!/^\/media\/[A-Za-z0-9._-]+$/.test(loc) || !fs.existsSync(path.join(MEDIA_DIR, path.basename(loc)))) bad("That voice clip isn't on the server any more — add it again.", "لم يعد مقطع الصوت على الخادم — أضفه من جديد.");
    s.clip = loc; if (s.clipUse === "clone" && s.consent !== true) bad("Cloning a voice needs the speaker's consent.", "استنساخ الصوت يحتاج موافقة صاحبه."); }
  const c = clean134(s, info.dur), miss = ready134(c);
  if (miss.length) bad(staff ? `Connect an engine for: ${miss.join(", ")} (Admin → AI providers)` : "This isn't available right now — nothing was charged.", "هذا غير متاح الآن — لم يُخصم شيء.", 501);
  const q = quote134(c), price = staff ? 0 : q.total; tokenCheck(u, price);
  const jid = uid(), title = `${String((base && base.title) || "Video").slice(0, 60)} · ${c.scope === "all" ? "voices & sound" : c.scope === "shot" ? "voices & sound (one shot)" : "a sound at " + c.t0 + " s"}`;
  if (price) hold(u.uid, price, title, jid);
  const job = { id: jid, owner: u.uid, kind: "video", cap: "sound", prov: "nooi@sound134", status: "rendering", stage: "look", progress: 0.03, created: Date.now(), cost: price, title,
    payload: { ...body, kind: "video", dur: Math.round(info.dur * 10) / 10, model: (base && base.payload?.model) || body.model, aspect: (base && base.payload?.aspect) || body.aspect }, snd134: { c, quote: q.total, from: base ? base.id : null } };
  user(u.uid).jobs[jid] = job; track(u.uid, job); rememberJob(u.uid, key, jid); tokenSpend(u, price); save();
  const ctx = { prompt: base ? String(base.payload?.prompt || base.title || "") : "", bible: (base && base.payload?.meta?.bible) || "" };
  make134(src, c, ctx, (st) => { job.stage = st; job.progress = Math.max(job.progress, 0.05 + (0.85 * STEPS134.indexOf(st)) / STEPS134.length); save(); })
    .then(async (r) => { let url = r.url;
      // (v149: the separate tracks for the editor — the picture is labelled only when the lips were made by the engine)
      if (!r.stems || r.lips) try { url = await labelAI(job, url, u.uid); } catch (e) { fail(u.uid, job, Object.assign(new Error(e.message), { userMsg: LABEL_MSG[0], userMsgAr: LABEL_MSG[1], noFallback: true })); return; }
      if (job.cost && r.used < job.cost && lowerHold(u.uid, jid, r.used)) job.cost = r.used;
      job.snd134 = { ...job.snd134, plan: r.plan, notes: r.notes, ...(r.stems ? { stems: r.stems, lips: !!r.lips } : {}) }; job.url = url; job.status = "done"; job.doneAt = Date.now(); job.progress = 1; delete job.stage; save();
      if (job.cost) settle(u.uid, jid); runDone(u.uid, job); })
    .catch((e) => fail(u.uid, job, Object.assign(e instanceof Error ? e : new Error(String(e)), { userMsg: (e && e.userMsg) || "The voices and sound couldn't be made — nothing was charged. Try again.", userMsgAr: (e && e.userMsgAr) || "تعذّر صنع الأصوات — لم يُخصم شيء. حاول مجدداً.", noFallback: true })));
  return job;
}
// v135: the customer's own finished video — one of their jobs, or a file on this server (as Extend and Voices & sound take it)
const VIDEO_KINDS135 = ["video", "chapter", "finish", "dub"];
function ownVideo135(u, it) {
  const jobs = user(u.uid).jobs || {}, pub0 = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""), id = it && it.job != null ? String(it.job) : "";
  const no = () => { throw Object.assign(new Error("That video isn't yours or isn't on the server any more."), { code: 400, errorAr: "هذا الفيديو ليس لك أو لم يعد على الخادم." }); };
  if (id) { const b = jobs[id]; if (!b) no();
    if (b.status !== "done" || !b.url || !VIDEO_KINDS135.includes(b.kind)) throw Object.assign(new Error("Only finished videos can be used here."), { code: 400, errorAr: "يمكن استخدام الفيديوهات المكتملة فقط." });
    return { job: b, url: b.url }; }
  const loc = String((it && it.src) || "").replace(pub0, "");
  if (!/^\/media\/[A-Za-z0-9._-]+$/.test(loc) || /\.scrub\.mp4$/.test(loc) || !fs.existsSync(path.join(MEDIA_DIR, path.basename(loc)))) no();
  return { job: Object.values(jobs).find((j) => j.url === loc) || null, url: loc };
}
// v135: Merge — several of the customer's videos (their extensions too) as one video, joined by the seam engine so the joins don't show
// (lib/seam133.js: each video cut at its last clean frame, the next one from where it really goes on, colour and sound matched, a
// morph where the frames nearly meet, a soft dissolve where they don't) — or with clean cuts. No engine: free.
const MERGE_MAX135 = 12;
async function mergeJob135(u, body) {
  const g = body.meta.merge135 || {}, jobs = user(u.uid).jobs || {}, style = g.style === "cut" ? "cut" : "seamless";
  const bad = (en, ar, code = 400) => { throw Object.assign(new Error(en), { code, errorAr: ar }); };
  const raw = Array.isArray(g.items) ? g.items : [];
  if (raw.length < 2) bad("Pick at least two videos to merge.", "اختر فيديوهين على الأقل للدمج.");
  if (raw.length > MERGE_MAX135) bad(`Up to ${MERGE_MAX135} videos in one merge.`, `حتى ${MERGE_MAX135} فيديو في الدمج الواحد.`);
  const items = raw.map((it) => { const o = ownVideo135(u, it), a = Math.max(0, +it.in || 0), b = +it.out > 0 ? +it.out : null; return { id: o.job ? o.job.id : null, job: o.job, url: o.url, in: a, out: b }; });
  // a video and its extension (the extension already holds it — Extend joins them): the video is left out, it isn't shown twice
  const holds = (j) => { const s = new Set(); for (let x = j, k = 0; x && k < 30; k++) { const b = x.payload?.meta?.extend132; if (!b || b === "file" || !(x.ext132 && (x.ext132.joined || x.ext132.kept))) break; s.add(String(b)); x = jobs[String(b)]; } return s; };
  const inside = new Set(items.flatMap((it) => (it.job ? [...holds(it.job)] : [])));
  const list = items.filter((it) => !(it.id && inside.has(it.id))), dropped = items.filter((it) => it.id && inside.has(it.id)).map((it) => it.id);
  if (list.length < 2) bad("These are already one video — the extension holds the video it extends.", "هذه فيديو واحد بالفعل — التمديد يحتوي الفيديو الذي مدّده.");
  // an extension made in the editor (the new part on its own): it goes on from where its video was cut, and starts where it really begins
  list.forEach((it, i) => { const nx = list[i + 1]; if (nx && nx.job && nx.job.ext134 && String(nx.job.payload?.meta?.extend132 || "") === String(it.id) && it.out == null && !nx.in) { if (+nx.job.ext134.cut > 0) it.out = +nx.job.ext134.cut; nx.in = +nx.job.ext134.head || 0; } });
  const key = reqKey(body), dup = dupJob(u.uid, key, body); if (dup) return dup;
  if (!isStaff(u)) checkEntitlement(user(u.uid), { kind: "merge" });
  let total = 0; for (const it of list) { const inf = await probe132(await fileOf132(it.url)).catch(() => null); if (!inf || !inf.dur) bad("One of the videos can't be read.", "تعذّرت قراءة أحد الفيديوهات."); it.dur = inf.dur; total += Math.max(0.5, Math.min(inf.dur, it.out || inf.dur) - Math.min(it.in, inf.dur)); }
  if (total > 600) bad("A merged video can be up to 10 minutes.", "يمكن أن يصل الفيديو المدمج إلى 10 دقائق.");
  const first = list[0].job, jid = uid(), title = `${String((first && first.title) || "Video").slice(0, 60)} · ${list.length} merged`;
  const job = { id: jid, owner: u.uid, kind: "video", cap: "merge", prov: "nooi@merge135", status: "rendering", stage: "ends", progress: 0.03, created: Date.now(), cost: 0, title,
    payload: { ...body, kind: "video", dur: Math.round(total * 10) / 10, model: (first && first.payload?.model) || body.model, aspect: (first && first.payload?.aspect) || body.aspect, prompt: (first && first.payload?.prompt) || body.prompt || "" },
    merge135: { n: list.length, style, of: list.map((it) => it.id).filter(Boolean), ...(dropped.length ? { dropped } : {}) } };
  user(u.uid).jobs[jid] = job; track(u.uid, job); rememberJob(u.uid, key, jid); save();
  mergeRun135(u.uid, job, list, style).catch((e) => fail(u.uid, job, Object.assign(e instanceof Error ? e : new Error(String(e)), { userMsg: "The videos couldn't be merged — try again.", userMsgAr: "تعذّر دمج الفيديوهات — حاول مجدداً.", noFallback: true })));
  return job;
}
async function mergeRun135(uidv, job, list, style) {
  const parts = [], tmp = [];
  for (let i = 0; i < list.length; i++) { const it = list[i], d = it.dur, a = Math.min(it.in, d - 0.5), b = it.out ? Math.max(a + 0.5, Math.min(d, it.out)) : d; let url = it.url;
    if (a > 0.02 || b < d - 0.02) { url = await trim135(await fileOf132(url), a, b); tmp.push(url); }
    // where it ends: the cut the customer chose, else its last clean frame (an engine's fade or blur at the end is left out)
    let cut; if (style === "seamless" && i < list.length - 1 && !it.out) { try { cut = (await handoff133(url)).t; } catch (e) { console.warn("merge hand-off", e.message); } }
    parts.push({ url, cut, hard: style === "cut" && i > 0 }); job.progress = Math.max(job.progress, 0.05 + (0.45 * (i + 1)) / list.length); save(); }
  if (job.status !== "rendering") return;
  job.stage = "join"; save();
  const r = await joinParts133(parts);
  let url = r.url; url = await labelAI(job, url, uidv);
  for (const t of tmp) fs.unlink(path.join(MEDIA_DIR, path.basename(t)), () => {});
  const sm = r.seams || [];
  job.merge135 = { ...job.merge135, dur: r.dur, seamless: !r.plain, morphs: sm.filter((x) => x && x.morph).length, cuts: sm.filter((x) => x && (x.hard || (!x.fade && !x.morph))).length, fades: sm.filter((x) => x && x.fade > 0).length };
  if (sm.length) job.seams133 = sm;
  job.url = url; job.status = "done"; job.doneAt = Date.now(); job.progress = 1; delete job.stage; job.payload.dur = r.dur; save(); runDone(uidv, job);
}
// v135: Edit with words — the seconds chosen go to Seedance 2.0 as @Video1 with the change (lib/edit135.js), in parts of up to 14 s,
// one after the other (each also sees the last frame of the part before, after the edit); then put back in their place with the
// video's own sound. Priced like Replace the person (the same engine doing the same kind of work) for the seconds sent to it; shown
// first on the page.
async function editJob135(u, body) {
  const e = body.meta.edit135 || {}, staff = isStaff(u), bad = (en, ar, code = 400) => { throw Object.assign(new Error(en), { code, errorAr: ar }); };
  const o = ownVideo135(u, e), base = o.job, src = o.url, refs = refsOf130(body);
  // (the change in the customer's words, put into English by the words step; its "no on-screen text" line is left out — the edit's own words say it)
  const change = tagWords130(String(body.prompt || "").replace("No on-screen text, captions, subtitles or watermarks.", "").trim(), refs, (i) => "@Image" + (i + 1)).replace(/[.\s]+$/, "");
  if (!change) bad("Say what to change in the video.", "اكتب ما تريد تغييره في الفيديو.");
  const key = reqKey(body), dup = dupJob(u.uid, key, body); if (dup) return dup;
  const info = await probe132(await fileOf132(src)).catch(() => null);
  if (!info || !info.dur) bad("The video can't be read.", "تعذّرت قراءة الفيديو.");
  if (info.dur < 4) bad("Edit with words needs a video of at least 4 seconds.", "التعديل بالكلمات يحتاج فيديو مدته 4 ثوانٍ على الأقل.");
  if (info.dur > 600) bad("Edit with words works on videos up to 10 minutes.", "التعديل بالكلمات للفيديو حتى 10 دقائق.");
  const plan = editPlan135(info.dur, e.from, e.to);
  if (plan.secs > EDIT_MAX135 + 0.01) bad(`One edit changes up to ${EDIT_MAX135 / 60} minutes — pick fewer seconds (from – to).`, `التعديل الواحد يغيّر حتى ${EDIT_MAX135 / 60} دقيقتين — اختر ثوانيَ أقل (من – إلى).`);
  const ek = engineFor134("video", { model: "seedance20", meta: { edit135: 1 } });
  if (!ek || !String(ek).startsWith("kie@")) bad(staff ? "Edit with words needs the AI engine connected (Admin → AI providers)." : "Edit with words isn't available right now — nothing was charged.", "التعديل بالكلمات غير متاح الآن — لم يُخصم شيء.", 501);
  if (!staff) checkEntitlement(user(u.uid), { kind: "video", model: "mcswap", dur: plan.secs });
  await checkContent(u, body);
  const price = staff ? 0 : editPrice135(plan, basePrice("video", "mcswap") ?? 30); tokenCheck(u, price);
  const jid = uid(), title = `${String((base && base.title) || "Video").slice(0, 60)} · edited`;
  if (price) hold(u.uid, price, title, jid);
  const job = { id: jid, owner: u.uid, kind: "video", cap: "edit", prov: "nooi@edit135", status: "rendering", stage: "cut", progress: 0.03, created: Date.now(), cost: price, title, partsTotal: plan.parts.length, partsDone: 0,
    payload: { ...body, kind: "video", dur: Math.round(info.dur * 10) / 10, model: (base && base.payload?.model) || body.model, aspect: (base && base.payload?.aspect) || body.aspect },
    edit135: { from: plan.from, to: plan.to, secs: plan.secs, parts: plan.parts.length, of: base ? base.id : null } };
  user(u.uid).jobs[jid] = job; track(u.uid, job); rememberJob(u.uid, key, jid); tokenSpend(u, price); save();
  editRun135(u.uid, job, src, info, plan, change, refs, body).catch((err) => fail(u.uid, job, Object.assign(err instanceof Error ? err : new Error(String(err)), { userMsg: (err && err.userMsg) || "The edit couldn't be made — nothing was charged. Try again, or say the change another way.", userMsgAr: (err && err.userMsgAr) || "تعذّر صنع التعديل — لم يُخصم شيء. حاول مجدداً أو صِف التغيير بطريقة أخرى.", noFallback: true })));
  return job;
}
async function editRun135(uidv, job, src, info, plan, change, refs, body) {
  const file = await fileOf132(src), chars = Array.isArray(body.meta?.chars134) ? body.meta.chars134.slice(0, 4) : [];
  const out = await editSeconds135(job, file, info, plan, refs, (i, n, prev) => editWords135({ change, part: i + 1, parts: n, pics: refs.length, prev, chars }));
  if (!out) return;
  let url = out.url;
  try { url = await labelAI(job, url, uidv); } catch (e) { fail(uidv, job, Object.assign(new Error(e.message), { userMsg: LABEL_MSG[0], userMsgAr: LABEL_MSG[1], noFallback: true })); return; }
  job.url = url; job.status = "done"; job.doneAt = Date.now(); job.progress = 1; delete job.stage; save();
  if (job.cost) settle(uidv, job.id); runDone(uidv, job);
}
// the seconds of a plan (lib/edit135.js) made again by Seedance 2.0 with the words wordsFor(part index, parts, after a part?) gives,
// part after part, and put back in place with the video's own sound → { url, file } (null when the job was stopped meanwhile)
async function editSeconds135(job, file, info, plan, refs, wordsFor, { p0 = 0.08, p1 = 0.88 } = {}) {
  const F = fpsOf135(info), W = Math.max(2, info.w - (info.w % 2)), H = Math.max(2, info.h - (info.h % 2)), fitted = [], made = [];
  let prev = null;
  try {
    for (let i = 0; i < plan.parts.length; i++) { const p = plan.parts[i];
      if (job.status !== "rendering") return null;
      job.stage = "cut"; save(); const clip = await cutClip135(file, p.a, p.b); made.push(clip.file);
      job.stage = "edit"; save();
      const r = await runEngine134("video", { model: "seedance20", prompt: wordsFor(i, plan.parts.length, !!prev), dur: p.d, aspect: job.payload.aspect, inputs: { ...Object.fromEntries(refs.map((x) => [x.slot, x.url])), edVideo: clip.url, ...(prev ? { edPrev: prev } : {}) }, meta: { edit135: 1, refs130: refs.map((x) => ({ slot: x.slot, tag: x.tag })) } });
      made.push(r.file);
      const fp = await fitPart135(r.file, p, { W, H, F }); fitted.push(fp);
      if (i < plan.parts.length - 1) prev = await lastFrame(r.url);
      job.partsDone = i + 1; job.progress = Math.max(job.progress, p0 + ((p1 - p0) * (i + 1)) / plan.parts.length); save(); }
    job.stage = "join"; save();
    return await assemble135(file, info, plan, fitted, { W, H, F });
  } finally { for (const f of [...fitted, ...made]) fs.unlink(f, () => {}); }   // (the pieces sent and made: only the finished video is kept)
}
// v136: Replace things — what the customer picked from the list of what is in a video or a picture (lib/scan136.js), changed or
// removed (lib/replace136.js): in a video only the seconds the changed things are seen in are made again (editSeconds135 with the
// Director's words for the list), then the sounds (a voice saying the words again in another voice, new music or sound, a sound taken
// out); in a picture, the picture engine with the same words. The price is shown first (replaceQuote136); afterwards the Continuity
// supervisor looks at each change before and after (the vision AI) and the card says what was changed.
const IMG_KINDS136 = ["image", "look", "sheet"];
export function ownMedia136(u, it) {
  const jobs = user(u.uid).jobs || {}, pub0 = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""), id = it && it.job != null ? String(it.job) : "";
  const no = () => { throw Object.assign(new Error("That video or picture isn't yours or isn't on the server any more."), { code: 400, errorAr: "هذا الفيديو أو الصورة ليس لك أو لم يعد على الخادم." }); };
  if (id) { const b = jobs[id]; if (!b) no(); const image = IMG_KINDS136.includes(b.kind);
    if (b.status !== "done" || !b.url || !(image || VIDEO_KINDS135.includes(b.kind))) throw Object.assign(new Error("Only finished videos and pictures can be used here."), { code: 400, errorAr: "يمكن استخدام الفيديوهات والصور المكتملة فقط." });
    return { job: b, url: b.url, image }; }
  const loc = String((it && it.src) || "").replace(pub0, "");
  if (!/^\/media\/[A-Za-z0-9._-]+$/.test(loc) || /\.scrub\.mp4$/.test(loc) || !fs.existsSync(path.join(MEDIA_DIR, path.basename(loc)))) no();
  return { job: Object.values(jobs).find((j) => j.url === loc) || null, url: loc, image: /\.(png|jpe?g|webp|gif|avif)$/i.test(loc) };
}
// the changes asked for, checked against the list: [{ it (the thing), c }] seen, [{ s (the sound), c }] heard
function changes136(scan, raw, image) {
  const items = new Map((scan.items || []).map((i) => [i.id, i])), sounds = new Map((scan.sounds || []).map((x) => [x.id, x])), vis = [], snd = [];
  const pub0 = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""), pic = (u) => { const v = String(u || "").replace(pub0, ""); return /^\/media\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i.test(v) && fs.existsSync(path.join(MEDIA_DIR, path.basename(v))) ? v : null; };
  for (const r of (Array.isArray(raw) ? raw : []).slice(0, 20)) {
    // v136: something the agents didn't list, described by the customer ("the dog on the left") — looked for in the whole video
    if (/^x\d{1,2}$/.test(String((r && r.id) || "")) && String(r.what || "").trim() && !items.has(r.id)) { const w = String(r.what).trim().slice(0, 200);
      items.set(r.id, { id: r.id, kind: "object", name: w, en: w, where: "", seen: [], at: scan.dur ? scan.dur / 2 : null, custom: true }); }
    const id = String((r && r.id) || ""), c = { remove: !!r.remove, to: String(r.to || "").trim().slice(0, 300), pic: pic(r.pic), char: r.char && r.char.name ? { name: String(r.char.name).slice(0, 40), look: String(r.char.look || "").slice(0, 200) } : null,
      voice: VOICE_PICKS136[r.voice] ? r.voice : "woman", say: String(r.say || "").trim().slice(0, 600) };
    if (items.has(id)) { if (c.remove || c.to || c.pic || c.char) vis.push({ it: items.get(id), c }); }
    else if (sounds.has(id) && !image) { const s = sounds.get(id); if (c.remove || c.to || c.say || s.kind === "speech") snd.push({ s, c }); }
  }
  return { vis, snd };
}
const SOUND_PRICE136 = (s, c) => (c.remove ? 0 : s.kind === "speech" ? basePrice("fixed", "voice") ?? 8 : s.kind === "music" ? basePrice("fixed", "music") ?? 15 : basePrice("fixed", "sfx") ?? 5);
async function plan136(u, body) {
  const g = body.meta?.replace136 || body, bad = (en, ar, code = 400) => { throw Object.assign(new Error(en), { code, errorAr: ar }); };
  const o = ownMedia136(u, g), file = await fileOf132(o.url), lang = String(g.lang || "en").slice(0, 5);
  const scan = await scan136(file, { lang, prompt: (o.job && (o.job.payload?.prompt || o.job.title)) || "", isImage: o.image });
  const { vis, snd } = changes136(scan, g.changes, o.image);
  if (!vis.length && !snd.length) bad("Pick at least one thing to change or remove.", "اختر شيئاً واحداً على الأقل لتغييره أو إزالته.");
  const info = o.image ? null : await probe132(file).catch(() => null);
  if (!o.image && (!info || !info.dur)) bad("The video can't be read.", "تعذّرت قراءة الفيديو.");
  let plan = null, visual = 0;
  if (vis.length && o.image) visual = basePrice("image", "nano") ?? 5;
  else if (vis.length) { if (info.dur < 2) bad("Changing what is seen needs a video of at least 2 seconds.", "تغيير ما يُرى يحتاج فيديو مدته ثانيتان على الأقل.");
    const sp = changeSpan136(vis.map((x) => x.it), info.dur); plan = editPlan135(info.dur, sp[0], sp[1]);
    if (plan.secs > EDIT_MAX135 + 0.01) bad(`One change covers up to ${EDIT_MAX135 / 60} minutes — pick things seen in fewer seconds.`, `التغيير الواحد يشمل حتى ${EDIT_MAX135 / 60} دقيقتين — اختر أشياء تظهر في ثوانٍ أقل.`);
    visual = editPrice135(plan, basePrice("video", "mcswap") ?? 30); }
  const sound = snd.reduce((t, x) => t + SOUND_PRICE136(x.s, x.c), 0), staff = isStaff(u);
  const ready = o.image ? !!engineFor134("image", { model: "nano" }) : !vis.length || String(engineFor134("video", { model: "seedance20", meta: { edit135: 1 } }) || "").startsWith("kie@");
  return { o, file, info, scan, vis, snd, plan, lang, total: staff ? 0 : visual + sound, visual: staff ? 0 : visual, sound: staff ? 0 : sound, ready };
}
export async function replaceQuote136(u, body) {
  const q = await plan136(u, body);
  return { total: q.total, visual: q.visual, sound: q.sound, image: q.o.image, ready: q.ready, things: q.vis.length, sounds: q.snd.length, ...(q.plan ? { from: q.plan.from, to: q.plan.to, secs: q.plan.secs, parts: q.plan.parts.length } : {}) };
}
async function replaceJob136(u, body) {
  const key = reqKey(body), dup = dupJob(u.uid, key, body); if (dup) return dup;
  const q = await plan136(u, body), staff = isStaff(u), { o } = q;
  if (!q.ready) throw Object.assign(new Error(staff ? "Replace things needs the AI engine connected (Admin → AI providers)." : "Replace things isn't available right now — nothing was charged."), { code: 501, errorAr: "استبدال الأشياء غير متاح الآن — لم يُخصم شيء." });
  if (!staff) checkEntitlement(user(u.uid), o.image ? { kind: "image", model: "nano" } : { kind: "video", model: "mcswap", dur: q.plan ? q.plan.secs : 1 });
  await checkContent(u, { ...body, prompt: [...q.vis.map((x) => x.c.to), ...q.snd.map((x) => x.c.to || x.c.say)].filter(Boolean).join(". ") });
  const price = q.total; tokenCheck(u, price);
  const jid = uid(), title = `${String((o.job && o.job.title) || (o.image ? "Picture" : "Video")).slice(0, 60)} · replaced`;
  if (price) hold(u.uid, price, title, jid);
  const list = [...q.vis.map((x) => ({ id: x.it.id, kind: x.it.kind, name: x.it.name, thumb: x.it.thumb || null, what: x.c.remove ? "removed" : "replaced", to: x.c.to || (x.c.char && x.c.char.name) || (x.c.pic ? "picture" : "") })),
    ...q.snd.map((x) => ({ id: x.s.id, kind: x.s.kind, name: x.s.name || x.s.kind, from: x.s.from, to: x.c.remove ? "" : x.c.say || x.c.to || "", what: x.c.remove ? "removed" : x.s.kind === "speech" ? "voice" : "replaced" }))];
  const job = { id: jid, owner: u.uid, kind: o.image ? "image" : "video", cap: "replace", prov: "nooi@replace136", status: "rendering", stage: o.image ? "picture" : q.vis.length ? "cut" : "sound", progress: 0.03, created: Date.now(), cost: price, title,
    ...(q.plan ? { partsTotal: q.plan.parts.length, partsDone: 0 } : {}),
    payload: { ...body, kind: o.image ? "image" : "video", ...(q.info ? { dur: Math.round(q.info.dur * 10) / 10 } : {}), model: (o.job && o.job.payload?.model) || body.model, aspect: (o.job && o.job.payload?.aspect) || body.aspect },
    replace136: { of: o.job ? o.job.id : null, image: o.image, list, ...(q.plan ? { from: q.plan.from, to: q.plan.to, secs: q.plan.secs } : {}) } };
  user(u.uid).jobs[jid] = job; track(u.uid, job); rememberJob(u.uid, key, jid); tokenSpend(u, price); save();
  english136(q).then(() => replaceRun136(u.uid, job, q)).catch((err) => fail(u.uid, job, Object.assign(err instanceof Error ? err : new Error(String(err)), { userMsg: (err && err.userMsg) || (err && err.code === 400 && err.message) || "The change couldn't be made — nothing was charged. Try again, or describe it another way.", userMsgAr: (err && err.userMsgAr) || (err && err.errorAr) || "تعذّر صنع التغيير — لم يُخصم شيء. حاول مجدداً أو صِفه بطريقة أخرى.", noFallback: true })));
  return job;
}
// v136: what the customer typed ("أسد", "سيارة رياضية حمراء") goes to the engines in English, as the main words do (the video engine
// follows English best — an Arabic "to what" could come back unchanged); the words a new voice says stay as they are
async function english136(q) {
  const { toEnglish } = await import("./v88.js"), en = (t) => (t ? toEnglish(t, { timeoutMs: 8000 }).catch(() => t) : t);
  await Promise.all([...q.vis.map(async (x) => { x.c.to = await en(x.c.to); if (x.c.char && x.c.char.look) x.c.char.look = await en(x.c.char.look); if (x.it.custom) x.it = { ...x.it, en: await en(x.it.en) }; }),
    ...q.snd.map(async (x) => { if (x.s.kind !== "speech") x.c.to = await en(x.c.to); })]);
}
async function replaceRun136(uidv, job, q) {
  const { o, file, info, vis, snd, plan, lang } = q, pub0 = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""), abs = (v) => (/^\/media\//.test(v) ? pub0 + v : v);
  let out = null;
  if (o.image) {   // a picture: picture 1 is the customer's, the pictures given for the changes come after it
    let n = 1; const ins = { iRef: abs(o.url) }; for (const x of vis) if (x.c.pic && n < 4) { n++; x.pic = n; ins["iRef" + n] = abs(x.c.pic); }
    const r = await runEngine134("image", { model: "nano", prompt: visualWords136({ changes: vis, image: true }), aspect: job.payload.aspect || undefined, inputs: ins, meta: { replace136: 1 } });
    out = { url: r.url, file: r.file || (await fileOf132(r.url)) }; job.progress = 0.8; save();
  } else {
    let cur = { url: o.url, file };
    if (vis.length) { const refs = []; for (const x of vis) if (x.c.pic && refs.length < 6) { refs.push({ slot: "vRef" + (refs.length + 1), url: abs(x.c.pic), tag: "image" + (refs.length + 1) }); x.pic = refs.length; }
      const r = await editSeconds135(job, file, info, plan, refs, (i, n, prev) => visualWords136({ changes: vis, part: i + 1, parts: n, pics: refs.length, prev }), { p0: 0.08, p1: snd.length ? 0.66 : 0.86 });
      if (!r) return; cur = r; }
    if (snd.length) { if (job.status !== "rendering") return; job.stage = "sound"; save();
      const w = await soundWorks136(snd, lang, (st) => { job.stage = st; save(); }); job.progress = Math.max(job.progress, 0.85); job.stage = "mix"; save();
      const i2 = await probe132(cur.file); cur = await soundMix136(cur.file, { ...i2, dur: i2.dur || info.dur }, w); }
    out = cur; }
  if (job.status !== "rendering") return;
  job.stage = "check"; save();
  try { const ck = await check136({ before: file, after: out.file, image: o.image, changes: vis, lang }); if (ck) job.replace136 = { ...job.replace136, checks: ck }; } catch (e) { console.warn("replace check", job.id, e.message); }
  let url = out.url;
  try { url = await labelAI(job, url, uidv); } catch (e) { fail(uidv, job, Object.assign(new Error(e.message), { userMsg: LABEL_MSG[0], userMsgAr: LABEL_MSG[1], noFallback: true })); return; }
  job.url = url; job.status = "done"; job.doneAt = Date.now(); job.progress = 1; delete job.stage; save();
  if (job.cost) settle(uidv, job.id); runDone(uidv, job);
}
// v132: the continuity supervisor. Part 1's last frame is the film's anchor; every later part's last frame is compared with it by the
// vision AI (when one is connected: place, architecture, time of day, light, palette, characters' faces, hair and clothes). A part
// that left the film is made again once, from the same frame, with the differences named — before the next part starts from it.
// Without a vision AI the parts still start on each other's last frame and carry the same bible; nothing is re-made on a guess.
async function continuity132(job, url) {
  const pf = findJob(job.parent), parent = pf && pf[1]; if (!parent) return;
  const i = +job.payload?.meta?.part || 1;
  try {
    // v133: the hand-off frame — the next part starts from it, and this part is cut right after it when they're joined
    let h = null; try { h = await handoff133(url); job.hand133 = { img: h.img, t: h.t, dropped: h.dropped }; } catch (e) { console.warn("hand-off", job.id, e.message); delete job.hand133; }
    if (h && i < (+parent.partsTotal || 99) && !parent.payload?.meta?.fast136) { try { const mo = await motion134(url, h.t); if (mo) job.hand133.motion = mo.words; } catch (e) { console.warn("motion", job.id, e.message); } }   // (v134: the next part carries the motion on)
    // v133: did the engine start on the frame it was given? One that ignored it made a new scene: made again (the second time on an
    // engine that keeps a first frame); a third miss is kept — the join dissolves into it instead of cutting
    const given = job.payload?.inputs?.startImage, t = +job.adhAgain133 || 0;
    if (i > 1 && given) { const a = await adherence133(url, given).catch(() => null);
      if (a && !a.unknown) { job.adh133 = { d: a.d, ok: a.ok, again: t };
        if (!a.ok && t < 2) { job.adhAgain133 = t + 1;
          if (t === 1 && String(job.prov || "").startsWith("kie@")) { const was = job.prov.slice(4);
            for (const m of FIRST_FRAME133) { const km = kieAuto("video", { ...job.payload, model: m }); if (km && km !== was) { job.prov = "kie@" + km; break; } } }
          save(); restart(job, ADH_WORDS133); return "again"; } } }
    const frame = (h && h.img) || (await lastFrame(url));
    if (i === 1) { parent.anchor132 = frame; save(); return; }
    let same = null;   // (the vision AI's word on it: the same film, or not; null = no vision AI)
    const { llmConfigured: on } = await import("../providers/anthropic.js");
    if (on() && parent.anchor132) { const { checkScene } = await import("./scenes.js"), c = await checkScene(parent.anchor132, frame, parent.payload?.meta?.bible || "");
      if (c && c.by === "vision") {
        parent.cont132 = { ...(parent.cont132 || {}), [i]: c.score }; job.contCheck132 = { score: c.score, same: c.same, differences: c.differences, retried: !!job.contAgain132 };
        if (!c.same && !job.contAgain132) { job.contAgain132 = 1; save();
          restart(job, `\n\nThe previous attempt left the film (${(c.differences || []).join("; ") || "the place, light or characters changed"}). Correct this: stay in exactly the same place, light and look, with the same characters.`);
          return "again"; }
        same = !!c.same; } }
    // v133: the colour lock — the next part starts in the film's own colours (the first part's), so the little drift of each shot
    // doesn't pile up over 8 or 15 parts; firmer when the vision AI says it is the same film, none when it says the place changed
    if (h && parent.anchor132 && same !== false) { try { const lk = await lockColour133(h.img, parent.anchor132, same ? 0.75 : 0.5); if (lk.moved) { job.hand133.img = lk.img; job.hand133.lock = lk.moved; } } catch (e) { console.warn("colour lock", job.id, e.message); } }
    save();
  } catch (e) { console.warn("continuity", job.id, e.message); }
}
// v133: engines that keep a given first frame best (a part whose engine started a new scene is made again on one of these)
const FIRST_FRAME133 = ["seedance20", "wan30", "kling30"];
const ADH_WORDS133 = "\n\nThe video must begin EXACTLY on the given first frame — the same picture, every person and thing in the same place, the same light — and only then move on. Do not start a new scene.";
const LABEL_MSG = ["The video couldn't be finished with its \"Made with AI\" mark — nothing was charged. Try again.", "تعذّر إنهاء الفيديو مع علامة \"صُنع بالذكاء الاصطناعي\" — لم يُخصم شيء. حاول مجدداً."];
const isSwapPart = (job) => { const p = findJob(job.parent); return !!(p && p[1]?.payload?.meta?.swapParts); };
// v115: lips that follow the voice (Replace the person with "Lips follow the voice" on): once the swap is ready, the new person's
// mouth is synced to the video's own voice by the engine's video lip sync. If it can't be made — or the video has no voice — the
// swap is the result as it came and that part's credits come back. After a restart the lip sync already sent is followed again.
const LIPS_MODEL = "volcengine/video-to-video-lip-sync";
const LIPS_MSG = { none: ["The video has no voice, so there were no lips to sync — that part wasn't charged.", "لا صوت في الفيديو، فلم تكن هناك شفاه لمطابقتها — لم يُخصم ذلك الجزء."],
  failed: ["The lips couldn't be matched to the voice this time — here is the swap as it came; that part wasn't charged.", "تعذّرت مطابقة الشفاه مع الصوت هذه المرة — هذا الاستبدال كما خرج؛ لم يُخصم ذلك الجزء."] };
// v117: better lips — three steps together. 1) The voice alone: the engine's voice isolation (ElevenLabs on Kie) takes the music
// and noise out; if it can't, the speech band of the video's sound (cleanVoice). 2) The lip sync on the owner's engine — Kie's
// Volcengine (the default) or Sync Lipsync 2 Pro on fal.ai — and the other one if it fails. 3) The video's own full sound
// (voice, music, the room) laid back over the result, so only the mouth changed.
const LIPS_ENGINES = { volc: "kie@" + LIPS_MODEL, sync: "fal@fal-ai/sync-lipsync/v2/pro" };
export const lipsEngine = () => (String(platformS().lipsEngine || process.env.LIPS_ENGINE || "volc").toLowerCase() === "sync" && cfg("fal").apiKey ? "sync" : "volc");
export function setLipsEngine(e) { if (!LIPS_ENGINES[e]) throw Object.assign(new Error("Unknown engine"), { code: 400 });
  if (e === "sync" && !cfg("fal").apiKey) throw Object.assign(new Error("Add the fal.ai key first (Admin → Connections & APIs → fal.ai)."), { code: 400 });
  platformS().lipsEngine = e; save(); return lipsEngine(); }
const keepHere = async (u) => (process.env.MIRROR_MEDIA !== "false" && u && !localPath(u) ? (await download(u)).url : u);
async function waitTask(a, rid, maxMs) {
  for (const end = Date.now() + maxMs; Date.now() < end; ) {
    await new Promise((ok) => setTimeout(ok, +process.env.LIPS_POLL_MS || 4000));
    const r = await a.poll(rid).catch(() => ({ status: "wait" }));
    if (r.status === "done" && r.url) return r.url;
    if (r.status === "failed") throw new Error(r.error || "failed");
  }
  throw new Error("took too long");
}
async function voiceAlone(job, src, mix) {
  if (job.lipsVoice) return job.lipsVoice;
  let v = null;
  if (configured("kie")) try { const a = adapterByKey("kie@elevenlabs/audio-isolation", PROVIDERS), r = await a.submit({ kind: "isolate", model: "isolate", prompt: "", inputs: { voice: mix }, meta: {} });
    v = await keepHere(r.done ? r.url : await waitTask(a, r.remoteId, 3 * 60e3)); job.lipsHow = "isolated"; } catch (e) { console.warn("voice isolation", job.id, e.message); }
  if (!v) { v = await cleanVoice(src).catch(() => null); if (v) job.lipsHow = "speech band"; }
  job.lipsVoice = v || mix; save(); return job.lipsVoice;
}
async function syncLips(job, url) {
  const src = job.payload.meta?.swapSrc || job.payload.inputs?.mcMove; if (typeof job.lipsTask === "string") job.lipsTask = { e: "volc", id: job.lipsTask };   // (a v115 task)
  const mix = job.lipsTask ? null : await voiceTrack(src); if (!job.lipsTask && !mix) throw Object.assign(new Error("no voice"), { none: true });
  const first = lipsEngine(), order = [first, ...Object.keys(LIPS_ENGINES).filter((e) => e !== first)].filter((e) => (e === "sync" ? !!cfg("fal").apiKey : configured("kie")));
  let last = null;
  for (const e of order) {
    if (job.lipsTask && job.lipsTask.e && job.lipsTask.e !== e) continue;   // (after a restart: the engine that has it)
    try {
      const a = adapterByKey(LIPS_ENGINES[e], PROVIDERS);
      if (!job.lipsTask) { const voice = await voiceAlone(job, src, mix || await voiceTrack(src));
        const r = await withRetry(() => a.submit({ kind: "lipsync", model: "lipsync", prompt: "", inputs: { lsV: url, lsA: voice }, meta: {} }));
        if (r.done) { job.lipsBy = e; return await withSound(await keepHere(r.url), src); }
        job.lipsTask = { e, id: r.remoteId }; save(); }
      const out = await waitTask(a, job.lipsTask.id, +process.env.LIPS_MAX_MS || 20 * 60e3); job.lipsBy = e; delete job.lipsTask; save();
      return await withSound(await keepHere(out), src);
    } catch (err) { last = err; console.warn("lips", job.id, e, err.message); delete job.lipsTask; save(); }
  }
  throw last || new Error("no lip-sync engine");
}
// the video's own full sound over the lip-synced picture (the result's own sound is the voice alone)
async function withSound(u, src) { const k = await keepSound(u, src, true).catch(() => null); return k || u; }
async function lipsOr(uidv, job, url) {
  if (!(job.payload?.model === "mcswap" && job.payload?.meta?.lips115 && !job.parent && !job.lipsDone && url)) return url;
  const t0 = Date.now(); job.stage = "lips"; job.urlSwap = url; save();
  try { const u = await syncLips(job, url); if (!u) throw new Error("no result"); job.lipsDone = true; return u; }
  catch (e) { job.lipsDone = "skipped"; const m = LIPS_MSG[e.none ? "none" : "failed"]; job.lipsMsg = { en: m[0], ar: m[1] }; if (!e.none) console.warn("lips", job.id, e.message);
    const back = lipsPrice(job.payload); if (job.cost && back > 0 && lowerHold(uidv, job.id, Math.max(0, job.cost - back))) job.cost = Math.max(0, job.cost - back);
    return url; }
  finally { delete job.stage; job.times = { ...(job.times || {}), lips: Math.round((Date.now() - t0) / 100) / 10 }; save(); }
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
// (v173: an NVIDIA engine named in the job that nooi Auto / the agents didn't choose — the customer chose it)
const nvPicked173 = (p) => !!(p && NV_MODELS173.has(String(p.model || "")) && !p.meta?.auto && !p.meta?.studio);
const NV_MODELS173 = new Set(["nvcosmos", "nvflux", "nvsd35", "nvkontext"]);
function fallback(uidv, job, msg) {
  const c = classify(msg instanceof Error ? msg : new Error(String(msg)));
  // a voiceover whose engine voice failed → the backup voice on our own server (free for the client)
  if (job.kind === "voice" && !job.triedBackup && piperOn() && String(job.payload?.prompt || "").trim()) {
    job.triedBackup = true; job.errors = [...(job.errors || []), `${job.prov}: ${c.message}`.slice(0, 300)]; job.status = "rendering"; save();
    backupVoiceFile(job.payload.prompt, job.payload.meta?.lang).then((url) => { if (job.cost && !job.refunded) { job.refunded = true; release(uidv, job.id); } job.cost = 0; job.backupVoice = true; job.sent = { prompt: String(job.payload.prompt).slice(0, 4000), voice: "backup" }; return finish(job, url); })
      .catch((e) => { job.errors.push("backup voice: " + String(e.message || e).slice(0, 160)); fail(uidv, job, msg); });
    return true;
  }
  // NVIDIA AI failed → the same job on the site's other engine (once) — only when nooi Auto chose NVIDIA (v173: an NVIDIA engine
  // the customer picked by hand is never swapped for another one; the job fails with NVIDIA's reason and nothing is charged)
  if (String(job.prov || "").startsWith("nv@") && !(msg && msg.noFallback) && !job.parent && !job.children && !nvPicked173(job.payload)) {
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
  if (MC_MODEL.test(job.payload?.model || "") && tries < (busy ? 2 : 1) && job.remoteId && /^(kie|fal)@/.test(String(job.prov || "")) && !(msg && msg.noFallback)
      && !["auth", "quota", "rate"].includes(c.type) && !/timed out/i.test(c.message) && (busy || c.type === "provider" || !engineReason(c.message))) {
    job.again102 = tries + 1; job.errors = [...(job.errors || []), `${job.prov}: ${c.message}`.slice(0, 300)];
    console.warn("job", job.id, "·", job.prov, "failed on the engine's side:", c.message.slice(0, 200), "→ asked once more");
    delete job.remoteId; job._pollErr = 0; job.status = "queued"; save();
    setTimeout(() => start(job).catch((e) => fail(uidv, job, e)), (+process.env.MC_AGAIN_MS || 20000) * (tries ? 3 : 1)); return true;
  }
  // v132: a part of a long video that fails is asked again once (the same engine, a few seconds later), then once on another of the
  // site's video engines — from the same frame, so the film still flows — before the whole video is given up (nothing charged then)
  if (job.parent && job.payload?.meta?.long132 && !(msg && msg.noFallback) && !["auth", "quota"].includes(c.type) && !/previous part failed/i.test(c.message)) {
    const t = +job.again132 || 0;
    if (t < 2) { job.again132 = t + 1; job.errors = [...(job.errors || []), `${job.prov}: ${c.message}`.slice(0, 300)];
      if (t === 1 && String(job.prov || "").startsWith("kie@")) { const was = job.prov.slice(4);
        for (const id of KIE_FALLBACK.video) { const km = kieAuto("video", { ...job.payload, model: id }); if (km && km !== was) { job.prov = "kie@" + km; break; } } }
      // (v175: a part the agents / nooi Auto gave to NVIDIA goes to the site's other engine at once — as a single shot does —
      // instead of being asked of NVIDIA twice more and lost from the film; one picked by hand stays NVIDIA's)
      if (String(job.prov || "").startsWith("nv@") && !nvPicked173(job.payload)) { let r = null; try { r = adapterFor(job.cap, { ...job.payload, noNv: true }, PROVIDERS); } catch {} if (r && r.a && r.a.configured) job.prov = r.key; }
      console.warn("job", job.id, "· part", job.payload.meta.part, "failed:", c.message.slice(0, 160), "→ again on", job.prov);
      delete job.remoteId; job._pollErr = 0; job.status = "queued"; save();
      setTimeout(() => start(job).catch((e) => fail(uidv, job, e)), +process.env.PART_AGAIN_MS || (t ? 6000 : 3000)); return true; }
    return false;
  }
  // v154: the remake on the tracking engine couldn't be made → the first result, as it came, with a note (it was made; nothing more is charged)
  if (job.remade154 && job.first154 && !job.back154) { job.back154 = true; job.errors = [...(job.errors || []), `${job.prov}: ${c.message}`.slice(0, 300)];
    job.note154 = { en: "The new person didn't stay to the end and making it again with frame-by-frame tracking didn't work this time — here is the first result. A photo that shows the whole person, standing like the person in the video, helps.",
      ar: "لم يبقَ الشخص الجديد حتى النهاية، ولم تنجح إعادة الصنع بالتتبع إطاراً بإطار هذه المرة — هذه النتيجة الأولى. تساعد صورة تُظهر الشخص كاملاً واقفاً كما في الفيديو." };
    finish(job, job.first154).catch((e) => console.warn("swap first", job.id, e.message)); return true; }
  if (msg && msg.noFallback || MC_MODEL.test(job.payload?.model || "") || !String(job.prov || "").startsWith("kie@") || !KIE_FALLBACK[job.cap] || job.parent || job.children || ["auth", "quota", "rate"].includes(c.type) || /timed out/i.test(c.message)) return false;
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
function fail(uidv, job, msg) { if (job.status === "cancelled" || !hasUser(uidv)) return;   // (v125: its account was deleted — nothing to refund or say)
  if (fallback(uidv, job, msg)) return; for (const f of jobHooks.fail) { try { f(uidv, job, msg); } catch (e) { console.warn("fail hook:", e.message); } } console.warn("job", job.id, "·", job.kind, "·", job.prov, "failed:", String(msg && msg.message || msg).slice(0, 300));
  const c = classify(msg instanceof Error ? msg : new Error(String(msg))); job.status = "failed"; job.errorType = c.type; job.error = (msg && msg.userMsg) || USER_MSG[c.type] || String(msg); if (msg && msg.userMsgAr) job.errorAr = msg.userMsgAr; else if (job.error === USER_MSG.quota) job.errorAr = QUOTA_AR138; delete job.line; if (job.stage === "line") delete job.stage;
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
  if (/^(kie|fal)@/.test(String(route.key || "")) && files.some((f) => /^\/media\//.test(f)) && !/^https?:\/\//.test(process.env.PUBLIC_BASE_URL || "")) refuse("The server's public address isn't set (PUBLIC_BASE_URL), so the engine can't read your file — nothing was charged.", 503);
}
// v175: the engines that really made a job, as the site's model ids — so the page names every engine that made a video, not
// the one planned: a job that moved to another engine (NVIDIA refused a shot the agents / nooi Auto gave it; a model failed and
// the next one made it; a part or an extension made again on an engine that keeps the first frame), a film whose shots the
// agents put on different engines (each part on its own), an extension joined to the video before it (that video's engines
// first). Sent only when it isn't just the engine asked for.
const PREF175 = { video: ["kling30", "kling40", "kling30t", "kling26", "seedance25", "seedance20", "seedance", "seedance2mini", "hailuoh3", "wan30", "wan27", "veo31", "veo31f", "grok", "grok15", "pixverse6", "gemomni", "happyhorse"],
  image: ["nano", "nanopro", "img20", "img25", "seedream5", "qwen", "flux2", "imagen4", "ideogram3", "grokimg", "mj", "nano2lite", "seedream5lite", "zimage"] };
const DIRECT175 = { seedance: "seedance", kling: "kling", minimax: "hailuo", "qwen-video": "qwenwan", "qwen-image": "qwen", "nano@nano": "nano", "nano@nanopro": "nanopro", midjourney: "mj", "gpt@img20": "img20" };
// one job (or one part): the engine its prov ran on — the model it asked for when that's the one (or an id we can't place)
function engine175(x) {
  const cur = String(x.payload?.model || ""), asked = String(x.ask175 || cur), prov = String(x.prov || ""), k = x.cap === "image" ? "image" : "video", nv = (m) => NV_MODELS173.has(m);
  if (prov.startsWith("nv@")) { const t = prov.slice(3); return nv(cur) ? cur : t === "video" ? "nvcosmos" : t === "edit" ? "nvkontext" : "nvflux"; }
  if (!prov.startsWith("kie@")) { if (DIRECT175[prov]) return DIRECT175[prov]; const fl = prov.split("@")[0];
    return !nv(cur) && cur !== "auto" && cur ? cur : fl === "kling" ? "kling30" : fl === "seedance" ? "seedance20" : fl === "minimax" ? "hailuoh3" : "auto"; }
  const km = prov.slice(4), tab = KIE_BUILTIN[k], cat = platformS().modelCat || {}, same = (m) => !!m && (m === km || KIE_I2V[m] === km || KIE_EDIT[m] === km);
  for (const m of [cur, asked]) if (m && m !== "auto" && (same(tab[m]) || same(cat[m]?.kieModel))) return m;
  const ids = Object.keys(tab).filter((id) => same(tab[id]));
  return PREF175[k].find((id) => ids.includes(id)) || (cur && cur !== "auto" && !nv(cur) ? cur : "auto");
}
function engines175(j, U, depth) {
  const kids = Array.isArray(j.children) && j.children.length ? j.children.map((id) => U.jobs[id]).filter((c) => c && !["failed", "cancelled"].includes(c.status)) : null;
  const out = kids ? kids.map(engine175) : [engine175(j)], base = j.ext132?.joined && j.payload?.meta?.extendOf && U.jobs[j.payload.meta.extendOf];
  return [...(base && depth < 4 ? engines175(base, U, depth + 1) : []), ...out];
}
export function madeBy175(j) {
  if (!j || j.parent || !["video", "image"].includes(j.cap) || MC_MODEL.test(String(j.payload?.model || "")) || !hasUser(j.owner)) return null;
  const list = [...new Set(engines175(j, user(j.owner), 0).filter(Boolean))], asked = String(j.ask175 || j.payload?.model || "");
  if (!list.length || (list.length === 1 && (list[0] === asked || !asked || asked === "auto" || list[0] === "auto" && !NV_MODELS173.has(asked)))) return null;
  return list.slice(0, 8);
}
// (v155: cid — the page's own id for the request, so a page that never got the server's answer finds its job again)
export function publicJob(j, staff) { return j && { ...(j.payload?.cid ? { cid: String(j.payload.cid).slice(0, 80) } : {}), ...(j.live158 ? { live158: j.live158 } : {}), ...(j.remade154 && !j.back154 ? { remade154: true } : {}), ...(j.note154 ? { note154: j.note154 } : {}), ...(j.sceneCheck ? { sceneCheck: j.sceneCheck } : {}), ...(j.payload?.meta?.scene ? { scene: j.payload.meta.scene } : {}), ...(j.payload?.meta?.physics?.sentence ? { physics: { en: j.payload.meta.physics.sentence, ar: j.payload.meta.physics.sentence_ar || null } } : {}), ...((m) => (m ? { madeBy: m } : {}))(madeBy175(j)), ...(staff ? { detail: j.status === "failed" ? [...(j.errors || []), (j.prov || "") + ": " + (j.errorDetail || "")].join(" · ").slice(0, 900) : null, via: j.prov || null } : {}), id: j.id, status: j.status, progress: j.progress, ...(j.stage ? { stage: j.stage } : {}), ...(j.partsTotal ? { partsDone: j.partsDone || 0, partsTotal: j.partsTotal } : {}), ...(j.plan132 ? { plan132: { by: j.plan132.by, shots: (j.plan132.shots || []).map((x) => String(x).slice(0, 160)) } } : {}), ...(j.longDur ? { longDur: j.longDur } : {}), ...(j.seams133 ? { seams133: { n: j.seams133.length, matched: j.seams133.filter((x) => x.same).length, fades: j.seams133.filter((x) => x.fade > 0).length, colour: j.seams133.filter((x) => x.colour).length } } : {}), ...(staff && j.seams133 ? { seamsDetail: j.seams133 } : {}), ...(j.join133 ? { join133: j.join133 } : {}), ...(j.ext132 && !j.ext132.failed ? { ext132: { joined: !!j.ext132.joined, kept: !!j.ext132.kept, dur: j.ext132.dur, ...(j.ext132.seamless ? { seamless: true } : {}) } } : {}), ...(j.ext134 ? { ext134: j.ext134 } : {}), ...(Array.isArray(j.cuts134) && j.cuts134.length ? { cuts134: j.cuts134 } : {}), ...(j.snd134 && j.snd134.plan ? { snd134: { plan: j.snd134.plan, notes: j.snd134.notes || [], ...(j.snd134.stems ? { stems: j.snd134.stems, lips: !!j.snd134.lips } : {}) } } : {}), ...(j.merge135 ? { merge135: j.merge135 } : {}), ...(j.partial136 ? { partial136: { ...j.partial136, again: againQuote136(j) } } : {}), ...(j.payload?.meta?.fast136 ? { fast136: true } : {}), ...(j.payload?.meta?.extCut136 ? { extCut136: true } : {}), ...(j.edit135 ? { edit135: j.edit135 } : {}), ...(j.replace136 ? { replace136: j.replace136 } : {}), ...(j.payload?.meta?.extend132 && j.payload.meta.extend132 !== "file" ? { extendOf: j.payload.meta.extend132 } : {}), ...(j.status === "rendering" && j.remoteId && j.sentAt && !j.genAt && j.stage !== "lips" ? { inLine: true } : {}), ...(j.lipsMsg ? { note115: j.lipsMsg } : {}), ...(j.line && j.status === "queued" ? { line: j.line } : {}), ...(staff && j.times ? { times: j.times } : {}), url: j.url || null, error: j.error || null, ...(j.errorAr ? { errorAr: j.errorAr } : {}), errorType: j.errorType || null, reason: j.reason || null, segments: j.segments || null, kind: j.kind, title: j.title || null, created: j.created, cost: j.cost || 0, dur: j.payload?.dur ?? null, durAsked: j.payload?.meta?.durAsked ?? null, sent: j.sent || null, next: j.next || null, chainError: j.chainError || null, step: j.payload?.meta?.step || 0 }; }

const QUOTA_AR138 = "لا يستطيع محرّك الذكاء قبول أعمال جديدة الآن — أُبلغ فريق الموقع. لم يُخصم شيء؛ حاول مجدداً بعد قليل.";
// Parent of a multi-part video: done when every part is done (segments = all part URLs)
setInterval(() => { for (const [uidv, job] of activeJobs()) { const u = user(uidv);
  if (!job.children || job.status !== "rendering" || liveJob(job)) continue; const kids = job.children.map((id) => u.jobs[id]).filter(Boolean);
  if (!kids.length) continue;   // (v132: the agents are still planning the parts)
  job.progress = kids.reduce((a, k) => a + (k.status === "done" ? 1 : k.progress || 0), 0) / kids.length * (job.payload?.meta?.long132 ? 0.96 : 1);
  if (job.payload?.meta?.swapParts || job.payload?.meta?.long132) { job.partsDone = kids.filter((k) => k.status === "done").length; job.partsTotal = kids.length; }   // v108: "part 2 of 3 ready"
  if (job.payload?.meta?.long132 && kids.some((k) => k.status === "failed")) { const i = kids.findIndex((x) => x.status === "failed"), k = kids[i];   // v132: which part, in the client's words
    // v136: the film isn't lost — once no part is being made any more, the parts that were made are joined and only they are charged
    if (kids.some((x) => x.status === "queued" || x.status === "rendering")) continue;
    if (kids.some((x) => x.status === "done") && !job.joining) { job.joining = true;
      partialFilm136(uidv, job, kids).then((ok) => { if (!ok) { delete job.joining; fail(uidv, job, Object.assign(new Error(k.errorDetail || k.error || "A part failed"), { userMsg: `No part of this video could be made — nothing was charged. Try again.`, userMsgAr: "تعذّر صنع أي جزء من هذا الفيديو — لم يُخصم شيء. حاول مجدداً.", noFallback: true })); } })
        .catch((e) => { console.warn("partial film", job.id, e.message); delete job.joining; fail(uidv, job, Object.assign(new Error("The parts couldn't be joined: " + e.message), { userMsg: "The parts that were made couldn't be joined — nothing was charged. Try again.", userMsgAr: "تعذّر جمع الأجزاء المصنوعة — لم يُخصم شيء. حاول مجدداً.", noFallback: true })); });
      continue; }
    if (job.joining) continue;
    const why = k.reason ? ` (${String(k.reason).replace(/[.\s]*$/, "")})` : "";
    // (v138: the engine's own account out of credits — said as that, not "part 1 couldn't be made… or a shorter video")
    if (k.errorType === "quota") { fail(uidv, job, Object.assign(new Error(k.errorDetail || k.error || "A part failed"), { userMsg: USER_MSG.quota, userMsgAr: QUOTA_AR138, noFallback: true })); continue; }
    fail(uidv, job, Object.assign(new Error(k.errorDetail || k.error || "A part failed"), { userMsg: `Part ${i + 1} of ${kids.length} couldn't be made${why} — nothing was charged. Try again, or a shorter video.`,
      userMsgAr: `تعذّر صنع الجزء ${i + 1} من ${kids.length} — لم يُخصم شيء. حاول مجدداً، أو اختر مدة أقصر.`, noFallback: true })); continue; }
  else if (kids.every((k) => k.status === "done") && job.payload?.meta?.long132) {   // v132: the parts joined into ONE video
    if (job.joining) continue; job.joining = true; job.stage = "join"; job.progress = 0.97; const tj = Date.now(); save();
    joinParts133(kids.map((k, i) => ({ url: k.url, cut: k.hand133 && k.hand133.t, hard: !!(job.payload?.meta?.fast136 && i > 0) }))).then(async (r) => ({ ...r, url: await slowStep163(job, r.url) })).then((r) => labelAI(job, r.url, uidv).then((url) => { job.url = url; job.segments = kids.map((k) => k.url); job.longDur = r.dur; job.status = "done"; job.doneAt = Date.now(); job.progress = 1;
      job.join133 = r.plain ? "plain" : "seamless"; if (r.seams) job.seams133 = r.seams; job.cuts134 = r.seams ? r.seams.map((x) => x.at).filter((x) => x > 0) : r.at || [];
      delete job.joining; delete job.stage; job.times = { ...(job.times || {}), join: Math.round((Date.now() - tj) / 100) / 10 }; if (job.cost) settle(uidv, job.id);
      if (job.again136) { if (settle(uidv, job.again136.ref)) job.cost = (job.cost || 0) + job.again136.price; delete job.again136; } delete job.partial136; save(); runDone(uidv, job); }))
      .catch((e) => { console.warn("long join", job.id, e.message); fail(uidv, job, Object.assign(new Error("The parts couldn't be joined: " + e.message), { userMsg: "Every part was made but they couldn't be joined into one video — nothing was charged. Try again.", userMsgAr: "صُنعت كل الأجزاء لكن تعذّر جمعها في فيديو واحد — لم يُخصم شيء. حاول مجدداً.", noFallback: true })); });
    continue;
  }
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
    joinSwap(parts, job.payload.meta.swapSrc).then((url) => lipsOr(uidv, job, url)).then((url) => labelAI(job, url, uidv)).then((url) => { job.url = url; job.status = "done"; job.doneAt = Date.now(); job.progress = 1; delete job.joining; delete job.stage; job.times = { ...(job.times || {}), join: Math.round((Date.now() - tj) / 100) / 10 };
      if (job.cost) settle(uidv, job.id); save(); runDone(uidv, job); })
      .catch((e) => { console.warn("swap join", job.id, e.message); fail(uidv, job, Object.assign(new Error("The parts couldn't be joined: " + e.message), { noFallback: true })); });
  }
  else if (kids.every((k) => k.status === "done")) { job.status = "done"; job.doneAt = Date.now(); job.progress = 1; job.url = kids[0].url; job.segments = kids.map((k) => k.url); if (job.cost) settle(uidv, job.id); save(); runDone(uidv, job); }
} }, 3000);
// v124: the jobs still being made, kept apart — the loops below look only at these, not at every job of every customer every
// second (with many customers that look-through alone took the server's time). A full look-through every 15 s catches a job
// added another way.
const ACTIVE = new Map();
const LIVE = (j) => !!j && (j.status === "queued" || j.status === "rendering");
export function track(uidv, job) { if (LIVE(job)) ACTIVE.set(job.id, [uidv, job]); }
function rebuildActive() { for (const [uidv, u] of allUsers()) for (const job of Object.values(u.jobs || {})) if (LIVE(job)) ACTIVE.set(job.id, [uidv, job]); }
function* activeJobs() { for (const [id, [uidv, job]] of ACTIVE) { if (!LIVE(job) || !hasUser(uidv) || user(uidv).jobs[id] !== job) { ACTIVE.delete(id); continue; } yield [uidv, job]; } }   // (v125: a deleted customer isn't made again)
export const activeCount = () => ACTIVE.size;
rebuildActive(); setInterval(rebuildActive, 15000).unref();
// how often a job's state is asked from its engine: often at first, less as it takes longer (the engine's call-back still
// brings it at once) — 2 s · 5 s after 2 min · 10 s after 10 min; with a call-back address 6 s · 15 s · 30 s; live sketch ~1 s
function pollEvery(job, now) {
  if (job.payload?.meta?.skLive) return 900;
  const age = now - (job.sentAt || job.created || now), base = age < 120e3 ? 2000 : age < 600e3 ? 5000 : 10000;
  return job.payload?.callbackUrl && !/^fal@/.test(job.prov || "") ? Math.max(6000, base * 3) : base;
}
// Poll running provider jobs (and right away when the engine calls back)
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
  } catch (e) { const c = classify(e);
    if (c.type === "rate") { job._lastPoll = Date.now() + 10000; return; }   // v124: the engine asks us to check less often — not the job's fault
    job._pollErr = (job._pollErr || 0) + 1; console.warn("poll", job.id, e.message); if (job._pollErr >= 6 || !c.retryable) fail(uidv, job, e); }
  finally { delete job._busy; }
}
setInterval(() => { const now = Date.now(), due = [];
  for (const [uidv, job] of activeJobs()) if (job.status === "rendering" && job.remoteId && !job._busy && !liveJob(job) && now - (job._lastPoll || 0) >= pollEvery(job, now)) due.push([uidv, job]);
  // v124: at most POLL_RPS checks a second for each engine (10), the longest-unchecked first
  due.sort((a, b) => (a[1]._lastPoll || 0) - (b[1]._lastPoll || 0)); const per = {}, max = +process.env.POLL_RPS || 10;
  for (const [uidv, job] of due) { const k = String(job.prov || job.cap || "").split("@")[0]; if ((per[k] = (per[k] || 0) + 1) > max) continue; pollOne(uidv, job).catch(() => {}); } }, 1000);
// v156: no job is "being made" for ever. A step that never answers (a stalled engine or download, a text AI that never replies, a
// part waiting on a part that hung) left a job "rendering" with its check locked (_busy) or with nothing to check, and every page
// kept showing it in progress — Home's agents stayed on it. Every minute: a lock older than 20 minutes is let go; a job past its
// time (75 minutes; 3 hours for a long video and its parts, a swap or Motion Control, a sound / merge / edit / replace job) fails
// with the reason, and the hold on its credits is given back as for any failed job.
const STUCK156 = ["This took far too long and was stopped — nothing was charged. Try again.", "استغرق هذا وقتاً أطول بكثير من المعتاد فأُوقف — لم يُخصم شيء. حاول مجدداً."];
// (v158: timed from when the job became active again — "live158", set when a film's missing part is made again, a job is made
// again or picked up after a restart; it keeps its first "created" time and was being stopped at once)
export function sweep156(now = Date.now()) { let n = 0;
  const lim = +process.env.STUCK_MS || 75 * 60e3, longLim = +process.env.STUCK_LONG_MS || 3 * 3600e3;
  for (const [uidv, job] of activeJobs()) {
    if (!["queued", "rendering"].includes(job.status) || liveJob(job)) continue;
    if (job._busy && now - (job._lastPoll || 0) > 20 * 60e3) delete job._busy;
    const m = job.payload?.meta || {}, long = !!(job.children || job.parent || m.long132 || MC_MODEL.test(job.payload?.model || "") || m.sound134 || m.merge135 || m.edit135 || m.replace136);
    if (now - Math.max(job.created || now, job.live158 || 0) < (long ? longLim : lim)) continue;
    console.warn("job", job.id, "·", job.kind, "·", job.prov, "· stuck since", new Date(job.created || now).toISOString(), "· stage", job.stage || "-", "→ stopped");
    n++; fail(uidv, job, Object.assign(new Error("took too long"), { userMsg: STUCK156[0], userMsgAr: STUCK156[1], noFallback: true }));
  }
  if (n) save(); return n; }
setInterval(() => { try { sweep156(); } catch (e) { console.warn("sweep:", e.message); } }, +process.env.SWEEP_MS || 60e3).unref();
// make a finished job again (same id, no new charge) — used when a scene result drifted
export function restart(job, extraPrompt) { const f = findJob(job.id); if (!f) return;
  job.payload.prompt = String(job.payload.prompt || "") + (extraPrompt || ""); delete job.remoteId; job.url = null; job.status = "queued"; job.progress = 0; job.live158 = Date.now(); save();
  start(job).catch((e) => fail(f[0], job, e)); }
export function findJob(id) { const a = ACTIVE.get(id); if (a && hasUser(a[0]) && user(a[0]).jobs[id] === a[1]) return a;   // (v124: a job being made — at once)
  for (const [uidv, u] of allUsers()) if (u.jobs && u.jobs[id]) return [uidv, u.jobs[id]]; return null; }
// the customer a job belongs to — its own note first (v124), else looked for
const ownerOf = (job) => (job.owner && hasUser(job.owner) && user(job.owner).jobs[job.id] === job ? job.owner : (findJob(job.id) || [])[0]);

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
    if (job.children && !job.children.length && job.payload?.meta?.long132 && job.payload && now - (job.created || 0) < 2 * 3600e3) {   // v132: planned again, then its parts
      let route = null; try { route = adapterFor(job.cap, job.payload, PROVIDERS); } catch {}
      if (route) { n++; job.stage = Array.isArray(job.payload.meta.shots) && job.payload.meta.shots.length >= +job.payload.meta.parts ? undefined : "plan"; if (!job.stage) delete job.stage;
        const pm = Array.isArray(job.payload.meta.partModels) ? job.payload.meta.partModels.slice(0, MAX_PARTS132).map(String) : null;
        partsStart132(uidv, job, job.payload, route, +job.payload.meta.parts, pm, null).catch((e) => fail(uidv, job, e)); continue; } }
    if (job.children) { if (job.joining) { delete job.joining; job.live158 = Date.now(); n++; } continue; }   // the parent poller joins the parts again
    if (job.remoteId) continue;                                                       // the engine has it: the poll picks it up
    n++;
    const mcPrep = MC_MODEL.test(job.payload?.model || "") && job.stage && job.stage !== "engine";
    if (mcPrep || job.payload?.meta?.sound134 || job.payload?.meta?.merge135 || job.payload?.meta?.edit135 || job.payload?.meta?.replace136 || !job.payload || now - (job.created || 0) > 2 * 3600e3) { fail(uidv, job, Object.assign(new Error(RESTART_MSG), { userMsg: RESTART_MSG, noFallback: true })); job.errorAr = RESTART_AR; continue; }
    job.status = "queued"; job.restarted = (job.restarted || 0) + 1; job.live158 = Date.now(); start(job).catch((e) => fail(uidv, job, e));
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
  for (const j of recent) { const g = group(j), k = (kinds[g] = kinds[g] || { n: 0, total: [], before: [], engine: [], words: [], fetch: [], queue: [], making: [], look: [], lips: [], own: [] }), t = j.times || {}, w = (+t.words || 0) * 1000, f = ((+t.fetch || 0) + (+t.after || 0)) * 1000;
    k.n++; k.total.push(j.doneAt - j.created + w); if (t.words != null) k.words.push(w); if (t.fetch != null) k.fetch.push(f);   // (the words step: when it ran)
    if (t.queue != null) { k.queue.push(t.queue * 1000); k.making.push((+t.making || 0) * 1000); } if (t.look != null) k.look.push(t.look * 1000);
    // (v119: the lip sync is the engine's too; the server's own work = preparing the files + after the engine: the sound, 60/120 fps, joining parts)
    if (t.lips != null) k.lips.push(t.lips * 1000); k.own.push(((+t.prep || 0) + Math.max(0, (+t.after || 0) - (+t.lips || 0)) + (+t.join || 0)) * 1000);
    if (j.sentAt) { k.before.push(j.sentAt - j.created + w); k.engine.push(Math.max(0, j.doneAt - j.sentAt - f)); } }
  let size = 0; try { size = fs.statSync(path.resolve("data/db.json")).size; } catch {}
  return {
    server: { load: os.loadavg().map((x) => Math.round(x * 100) / 100), cpus: os.cpus().length, freeMB: Math.round(os.freemem() / 1048576), totalMB: Math.round(os.totalmem() / 1048576), upMin: Math.round(process.uptime() / 60),
      lagMs: { max: Math.max(0, ...LAG.last), avg: LAG.last.length ? Math.round(LAG.last.reduce((a, b) => a + b, 0) / LAG.last.length) : 0 }, dbMB: Math.round(size / 104857.6) / 10, jobs: jobs.length, recovered: RECOVERED.n },
    pending: { n: pending.length, waiting10: pending.filter((j) => now - j.created > 10 * 60e3).length, oldestMin: pending.length ? Math.round((now - Math.min(...pending.map((j) => j.created || now))) / 60e3) : 0,
      byStage: pending.reduce((a, j) => ((a[j.stage || (j.remoteId ? "engine" : j.status)] = (a[j.stage || (j.remoteId ? "engine" : j.status)] || 0) + 1), a), {}) },
    last24h: Object.fromEntries(Object.entries(kinds).map(([g, k]) => [g, { n: k.n, total: med(k.total), before: med(k.before), engine: med(k.engine), words: med(k.words), fetch: med(k.fetch), queue: med(k.queue), making: med(k.making), look: med(k.look), lips: med(k.lips), own: med(k.own), slowest: Math.round(Math.max(...k.total) / 100) / 10 }])),
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
    if (g === "swap" && k.making != null && k.making > 240 && swapRes() !== "768P") { const e = swapEngine(), sd = e !== "h3", hi = e === "seedance" ? "1080p" : sd ? "720p" : "2K", lo = e === "seedance" ? "720p" : sd ? "480p" : "768P";
      say(`Replace the person: the engine takes about ${min(k.making)} to make each video at ${hi}, its sharpest. At ${lo} it may be quicker, a little less sharp, and costs the engine less — to try it, tap "Faster (${lo})" below.` + (sd ? "" : " Seedance 2.0 (the other engine below) is usually quicker too."),
        `استبدال الشخص: يأخذ المحرّك نحو ${minAr(k.making)} لصنع كل فيديو بدقة ${hi}، أعلى دقة لديه. بدقة ${lo} قد يكون أسرع، أقل حدّة قليلاً، وأقل تكلفة على المحرّك — لتجربتها اضغط "أسرع (${lo})" بالأسفل.` + (sd ? "" : " وSeedance 2.0 (المحرّك الآخر بالأسفل) أسرع عادةً أيضاً.")); }
    // v112: the text AI's look before a swap / moves is sent (now at most 15 s for each look)
    if ((g === "swap" || g === "motion") && k.look != null && k.look > 10) say(`${nm[0]}: the text AI took about ${min(k.look)} to look at the photo and the video before each job was sent — it answers slowly with pictures. Each look now waits at most 15 s; a faster text AI (Admin → Connections & APIs) helps more.`,
      `${nm[1]}: أخذ الذكاء النصي نحو ${minAr(k.look)} لفحص الصورة والفيديو قبل إرسال كل مهمة — يجيب ببطء مع الصور. صار كل فحص ينتظر 15 ثانية على الأكثر؛ وذكاء نصي أسرع (الإدارة ← الربط والواجهات البرمجية) يساعد أكثر.`);
    if (k.engine != null && k.total && k.engine > 45 && k.engine >= 0.7 * k.total && k.engine <= k.total) say(`${nm[0]}: ${min(k.engine)} of the usual ${min(k.total)} is the AI engine's own time (its queue and making) — not this server. A faster model or a shorter length shortens it.`,
      `${nm[1]}: ${minAr(k.engine)} من المدة المعتادة ${minAr(k.total)} هي وقت محرّك الذكاء الاصطناعي نفسه (طابوره وصنعه) — لا هذا الخادم. نموذج أسرع أو مدة أقصر تختصرها.`);
  }
  // v124: the engine's send line — when tasks had to wait their turn, how long, and what raises the limit
  const lines = lineStats(); r.lines = lines; r.active = ACTIVE.size;
  for (const l of Object.values(lines)) { if (!l.limit || !(l.tooMany1h || l.expired || (l.waitMedianSec || 0) > 20 || l.maxWaiting > 40)) continue;
    const [n, sec] = l.limit.split("/");
    say(`The AI engine takes ${n} new tasks every ${sec} s from this account. In busy moments the rest wait their turn here instead of failing (now ${l.waiting} waiting, at most ${l.maxWaiting}; a usual wait ${min(l.waitMedianSec || 0)}, the longest ${min(l.waitMaxSec || 0)})${l.tooMany1h ? `; the engine still said "too many" ${l.tooMany1h} times in the last hour` : ""}${l.expired ? `; ${l.expired} waited more than ${+process.env.LINE_MAX_MIN || 20} min and were given back` : ""}. To take more at once, ask the engine's support for a higher limit, then write it under "Engine limit" below.`,
      `يقبل محرّك الذكاء ${n} مهام جديدة كل ${sec} ثوانٍ من هذا الحساب. في أوقات الضغط تنتظر البقية دورها هنا بدل أن تفشل (الآن ${l.waiting} في الانتظار، وأقصاه ${l.maxWaiting}؛ الانتظار المعتاد ${minAr(l.waitMedianSec || 0)}، والأطول ${minAr(l.waitMaxSec || 0)})${l.tooMany1h ? `؛ وقال المحرّك "طلبات كثيرة" ${l.tooMany1h} مرة في الساعة الأخيرة` : ""}${l.expired ? `؛ و${l.expired} انتظرت أكثر من ${+process.env.LINE_MAX_MIN || 20} دقيقة فأُعيد رصيدها` : ""}. لقبول المزيد دفعة واحدة، اطلب من دعم المحرّك حدّاً أعلى ثم اكتبه تحت "حدّ المحرّك" بالأسفل.`); }
  const vps = vps119(r); r.vps = vps;
  if (vps.verdict === "no") say(`A bigger server (VPS) would not make jobs noticeably faster: ${vps.engineShare}% of their time is the AI engine's own (its line, its making and the lip sync); this server's own work is ${vps.ownShare}%.`,
    `خادم أكبر (VPS) لن يجعل المهام أسرع بشكل ملحوظ: ${vps.engineShare}% من وقتها هو وقت محرّك الذكاء الاصطناعي نفسه (طابوره وصنعه ومطابقة الشفاه)؛ وعمل هذا الخادم نفسه ${vps.ownShare}%.`);
  if (vps.verdict === "yes") say(`A bigger server (VPS) would help: ${vps.busy ? `the processor is fully busy (load ${s.load[1]} on ${s.cpus} cores)` : `${vps.ownShare}% of the jobs' time is this server's own work (preparing videos, the sound, 60/120 fps, joining parts)`} — more cores make that part faster.`,
    `خادم أكبر (VPS) سيساعد: ${vps.busy ? `المعالج مشغول بالكامل (الحِمل ${s.load[1]} على ${s.cpus} أنوية)` : `${vps.ownShare}% من وقت المهام هو عمل هذا الخادم نفسه (تجهيز الفيديوهات، الصوت، 60/120 إطاراً، ضمّ الأجزاء)`} — أنوية أكثر تجعل هذا الجزء أسرع.`);
  if (vps.exportRate != null) say(`Editor exports: converting takes about ${vps.exportRate} s for each second of video on this server's ${s.cpus} cores (${vps.exportRate > 1 ? "slower" : "faster"} than the video plays) — this part gets faster with more cores. Recordings already at the format's size are only re-packed (about a second).`,
    `تصدير المحرر: يأخذ التحويل نحو ${vps.exportRate} ثانية لكل ثانية من الفيديو على ${s.cpus} أنوية في هذا الخادم (${vps.exportRate > 1 ? "أبطأ" : "أسرع"} من مدة الفيديو) — وهذا الجزء يسرع مع أنوية أكثر. التسجيل الذي بمقاس الصيغة نفسه يُعاد تغليفه فقط (نحو ثانية).`);
  return { ...r, advice: out, swapRes: swapRes(), swapEngine: swapEngine(), hold154: hold154On(), falReady: !!cfg("fal").apiKey, lipsEngine: lipsEngine(), look: lookInfo() };   // (v129: who does the text AI look)
}
// v119: would a bigger server (more cores) make things faster? The engine's time (its line, making, the lip sync) doesn't change
// with this server; what runs here does (preparing videos, the sound, 60/120 fps — now on every core —, joining parts, exports)
export function vps119(r) {
  let eng = 0, own = 0, tot = 0;
  for (const k of Object.values(r.last24h || {})) { if (!k.n || !k.total) continue; tot += k.total * k.n; eng += ((k.engine || 0) + (k.lips || 0)) * k.n; own += (k.own || 0) * k.n; }
  const x = XSTATS.last.filter((e) => !e.copy && e.secs > 0).map((e) => e.ms / 1000 / e.secs).sort((a, b) => a - b), exportRate = x.length ? Math.round(x[x.length >> 1] * 100) / 100 : null;
  const busy = r.server.load[1] >= r.server.cpus * 0.9, engineShare = tot ? Math.min(100, Math.round((eng / tot) * 100)) : null, ownShare = tot ? Math.min(100, Math.round((own / tot) * 100)) : null;
  const verdict = busy || (ownShare != null && ownShare >= 25) ? "yes" : engineShare != null && engineShare >= 60 ? "no" : "unknown";
  return { cpus: r.server.cpus, busy, engineShare, ownShare, exportRate, exports: XSTATS.n, verdict };
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
// v114: Replace the person on Seedance 2.0 (faster, the default) or MiniMax H3 — one tap on the speed card (jobs made before keep theirs)
export function setSwapEngine(engine) { if (!SWAP_ENGINES.includes(engine)) throw Object.assign(new Error("Unknown engine"), { code: 400 });
  if (engine === "fal" && !cfg("fal").apiKey) throw Object.assign(new Error("Add the fal.ai key first (Admin → Connections & APIs → fal.ai)."), { code: 400 });   // v116
  platformS().swapEngine = engine; save(); return swapEngine(); }

// ---- v154: the swap that holds to the end (Admin → Speed: on by default; HOLD154=false turns it off on a server)
export const hold154On = () => (platformS().hold154 ?? (process.env.HOLD154 !== "false")) !== false;
export function setHold154(on) { platformS().hold154 = !!on; save(); return hold154On(); }
async function hold154(job, url) {
  job.check154 = true; job.stage = "check154"; save();
  const r = await holdCheck154(job, url).catch(() => null); if (job.stage === "check154") delete job.stage;
  if (r) job.hold154 = { frames: r.frames, sure: r.sure, held: r.held };
  // (a person picked among several: the tracking engine can't be told which one — the result stays)
  if (!r || r.held || job.remade154 || job.payload?.inputs?.mcWho || !cfg("kie").apiKey || String(job.prov) === "kie@" + TRACK_MODEL) { save(); return "ok"; }
  job.first154 = url; job.remade154 = true; job.errors = [...(job.errors || []), `${job.prov}: the new person didn't stay (${r.frames.join(", ")}) → made again on ${TRACK_MODEL}`];
  console.warn("job", job.id, "· the swap didn't hold:", r.frames.join(","), "→ again on", TRACK_MODEL);
  job.prov = "kie@" + TRACK_MODEL; delete job.remoteId; job._pollErr = 0; job.status = "queued"; job.progress = 0.05; save();
  const owner = ownerOf(job); start(job).catch((e) => { if (owner) fail(owner, job, e); }); return "again";
}
