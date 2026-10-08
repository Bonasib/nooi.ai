import crypto from "crypto";
import { user, allUsers, save, uid } from "./store.js";
import { PROVIDERS, capFor } from "../providers/index.js";
import { adapterFor, adapterByKey } from "../providers/extra.js";
import { kieAuto } from "../providers/kie.js";
import { nvRoute } from "../providers/nvidia.js";
import { featureOn, modelOn } from "./settings.js";
import { checkEntitlement } from "./plans.js";
import { isStaff } from "./admin.js";
const FEATURE = { video: "video", chapter: "story", image: "image", look: "chars", sheet: "chars", edit: "edit", bg: "fx", mocap: "fx", voice: "voice", voiceclone: "voice", voiceconvert: "voice", world: "world", lipsync: "voice", music: "voice", sfx: "voice", finish: "finish", transcribe: "subs", dub: "subs", "3d": "studio3d", track3d: "studio3d", view3d: "studio3d", place3d: "studio3d" };
import { download, lastFrame } from "./media.js";
import { priceOf, charge, credit } from "./billing.js";
import { moderate } from "./moderation.js";
import { withRetry, classify, USER_MSG } from "./errors.js";

// other modules react to finished jobs (scenes keep their latest frame and check the result)
export const jobHooks = { before: [], done: [], fail: [] };
const runDone = (uidv, job) => { for (const f of jobHooks.done) Promise.resolve().then(() => f(uidv, job)).catch((e) => console.warn("job hook", e.message)); };
export async function createJob(u, body) {
  for (const f of jobHooks.before) await f(u, body);
  if (process.env.GPU_FEATURES !== "true" && ["3d", "track3d", "view3d", "place3d"].includes(body.kind) && !(body.kind === "3d" && nvRoute("sam3d", body))) throw Object.assign(new Error("3D generation is not available yet"), { code: 403 });
  const flag = moderate((body.prompt || "") + " " + (body.meta?.refs || []).map((r) => r.description).join(" "));
  if (flag) throw Object.assign(new Error("Blocked by the Acceptable Use Policy (" + flag + ")"), { code: 422 });
  if (body.kind === "voiceclone" && !body.meta?.consent) throw Object.assign(new Error("Voice cloning needs the speaker's consent"), { code: 400 });
  if (FEATURE[body.kind] && !featureOn(FEATURE[body.kind])) throw Object.assign(new Error("This feature is turned off"), { code: 403 });
  if (body.model && !modelOn(body.model)) throw Object.assign(new Error("This model is turned off"), { code: 403 });
  const cap = capFor(body.kind, body.meta);
  const route = cap && adapterFor(cap, body, PROVIDERS); const prov = route && route.a;
  if (!prov) throw Object.assign(new Error("Unknown job kind: " + body.kind), { code: 400 });
  if (!prov.configured) throw Object.assign(new Error(`${prov.name} is not connected yet — add its API URL and key to the server .env or the admin dashboard`), { code: 501 });
  // owners & admins test every model on the Studio plan without spending credits
  const staff = isStaff(u);
  if (!staff) checkEntitlement(user(u.uid), body);
  // nooi Studio 2.0: a long video may use a different engine model for each part (picked by the bots)
  const partModels = body.kind === "video" && +body.meta?.parts > 1 && Array.isArray(body.meta?.partModels) ? body.meta.partModels.slice(0, 6).map(String) : null;
  if (partModels) for (const m of partModels) { if (!modelOn(m)) throw Object.assign(new Error("This model is turned off"), { code: 403 }); if (!staff) checkEntitlement(user(u.uid), { ...body, model: m, dur: 0 }); }
  const cost = staff ? 0 : priceOf(body.kind, body) + (body.kind === "video" ? ({ 60: 2, 120: 4 })[+body.meta?.fps] || 0 : 0);
  if (cost) charge(u.uid, cost, (body.kind || "job") + " · " + String(body.prompt || "").slice(0, 40));
  const job = { id: uid(), kind: body.kind, cap, prov: route.key, status: "queued", progress: 0, created: Date.now(), payload: body, cost, title: body.title || body.prompt || "" };
  user(u.uid).jobs[job.id] = job; save();
  const parts = body.kind === "video" ? Math.min(6, Math.max(1, +body.meta?.parts || 1)) : 1;
  if (parts > 1) {                      // long video: N connected parts, each continuing from the previous last frame
    const per = Math.ceil((+body.dur || 5) / parts); let prev = null; job.children = []; job.status = "rendering";
    for (let i = 0; i < parts; i++) {
      const pm = partModels && partModels[i], croute = pm && pm !== body.model ? adapterFor(cap, { ...body, model: pm }, PROVIDERS) || route : route;
      const child = { id: uid(), kind: "video", cap, prov: croute.key, status: "queued", progress: 0, created: Date.now(), parent: job.id, cost: 0, title: `${job.title} · ${i + 1}/${parts}`,
        payload: { ...body, ...(pm ? { model: pm } : {}), dur: per, chainAfter: prev, meta: { ...(body.meta || {}), parts: 1, part: i + 1 }, prompt: body.meta?.shots?.[i] ? `${body.meta.shots[i]}${body.meta.bible ? "\n\nContinuity: " + body.meta.bible : ""}${i ? ` — continue seamlessly from the previous shot (part ${i + 1} of ${parts}), same characters, place and light` : ""}` : i ? `${body.prompt} — continue seamlessly (part ${i + 1} of ${parts}), same characters, place and light` : body.prompt } };
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
  if (r.done) await finish(job, r.url, r.segments); else { job.remoteId = r.remoteId; job.status = "rendering"; save(); }
}
export const cbSig = (id) => crypto.createHmac("sha256", process.env.SECRET_KEY || "nooi").update("cb:" + id).digest("hex").slice(0, 24);
async function finish(job, url, segments) {
  job.progress = 1; if (segments) job.segments = segments;
  if (process.env.MIRROR_MEDIA !== "false" && url) { try { url = (await download(url)).url; } catch (e) { console.warn("mirror:", e.message); } }
  job.url = url; job.status = "done"; save();
  const owner = allUsers().find(([, U]) => U.jobs && U.jobs[job.id]); if (owner) runDone(owner[0], job);
}
// A Kie AI model that rejects or fails a job → try the next Kie model once or twice before refunding.
// Same key, so a bad key or an empty Kie balance doesn't fall back.
const KIE_FALLBACK = { image: ["nano", "img25", "img20", "qwen"], video: ["kling", "seedance", "wan27", "hailuo"] };
function fallback(uidv, job, msg) {
  const c = classify(msg instanceof Error ? msg : new Error(String(msg)));
  // NVIDIA AI failed → the same job on the site's other engine (once)
  if (String(job.prov || "").startsWith("nv@") && !(msg && msg.noFallback) && !job.parent && !job.children) {
    let r = null; try { r = adapterFor(job.cap, { ...job.payload, noNv: true }, PROVIDERS); } catch {}
    if (r && r.a && r.a.configured) { console.warn("job", job.id, "· NVIDIA failed:", c.message.slice(0, 200), "→", r.key); job.errors = [...(job.errors || []), `${job.prov}: ${c.message}`.slice(0, 300)];
      job.prov = r.key; delete job.remoteId; job._pollErr = 0; job.status = "queued"; save(); start(job).catch((e) => fail(uidv, job, e)); return true; } return false; }
  if (msg && msg.noFallback || !String(job.prov || "").startsWith("kie@") || !KIE_FALLBACK[job.cap] || job.parent || job.children || ["auth", "quota"].includes(c.type) || /timed out/i.test(c.message)) return false;
  job.tried = job.tried || [job.prov.slice(4)]; if (job.tried.length >= 3) return false;
  for (const id of KIE_FALLBACK[job.cap]) {
    const km = kieAuto(job.cap, { ...job.payload, model: id });
    if (!km || job.tried.includes(km)) continue;
    console.warn("job", job.id, "·", job.prov, "failed:", c.message.slice(0, 200), "→ trying kie@" + km);
    job.errors = [...(job.errors || []), `${job.prov}: ${c.message}`.slice(0, 300)];
    job.tried.push(km); job.prov = "kie@" + km; delete job.remoteId; job._pollErr = 0; job.status = "queued"; save();
    start(job).catch((e) => fail(uidv, job, e)); return true;
  }
  return false;
}
function fail(uidv, job, msg) { if (fallback(uidv, job, msg)) return; for (const f of jobHooks.fail) { try { f(uidv, job, msg); } catch (e) { console.warn("fail hook:", e.message); } } console.warn("job", job.id, "·", job.kind, "·", job.prov, "failed:", String(msg && msg.message || msg).slice(0, 300));
  const c = classify(msg instanceof Error ? msg : new Error(String(msg))); job.status = "failed"; job.errorType = c.type; job.error = USER_MSG[c.type] || String(msg); job.errorDetail = String(msg).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300); if (job.cost && !job.refunded) { job.refunded = true; credit(uidv, job.cost, "Refund · failed " + job.kind, job.id); } save(); }
export function publicJob(j, staff) { return j && { ...(j.sceneCheck ? { sceneCheck: j.sceneCheck } : {}), ...(j.payload?.meta?.scene ? { scene: j.payload.meta.scene } : {}), ...(staff ? { detail: j.status === "failed" ? [...(j.errors || []), (j.prov || "") + ": " + (j.errorDetail || "")].join(" · ").slice(0, 900) : null, via: j.prov || null } : {}), id: j.id, status: j.status, progress: j.progress, url: j.url || null, error: j.error || null, errorType: j.errorType || null, segments: j.segments || null, kind: j.kind, title: j.title || null, created: j.created }; }

// Parent of a multi-part video: done when every part is done (segments = all part URLs)
setInterval(() => { for (const [uidv, u] of allUsers()) for (const job of Object.values(u.jobs)) {
  if (!job.children || job.status !== "rendering") continue; const kids = job.children.map((id) => u.jobs[id]).filter(Boolean);
  job.progress = kids.reduce((a, k) => a + (k.status === "done" ? 1 : k.progress || 0), 0) / kids.length;
  if (kids.some((k) => k.status === "failed")) { fail(uidv, job, new Error(kids.find((k) => k.status === "failed").errorDetail || "A part failed")); }
  else if (kids.every((k) => k.status === "done")) { job.status = "done"; job.progress = 1; job.url = kids[0].url; job.segments = kids.map((k) => k.url); save(); runDone(uidv, job); }
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
  for (const [uidv, u] of allUsers()) for (const job of Object.values(u.jobs || {})) if (job.status === "rendering" && job.remoteId && !job._busy && now - (job._lastPoll || 0) >= 2000) todo.push(pollOne(uidv, job));
  Promise.allSettled(todo); }, 2500);
// make a finished job again (same id, no new charge) — used when a scene result drifted
export function restart(job, extraPrompt) { const f = findJob(job.id); if (!f) return;
  job.payload.prompt = String(job.payload.prompt || "") + (extraPrompt || ""); delete job.remoteId; job.url = null; job.status = "queued"; job.progress = 0; save();
  start(job).catch((e) => fail(f[0], job, e)); }
export function findJob(id) { for (const [uidv, u] of allUsers()) if (u.jobs && u.jobs[id]) return [uidv, u.jobs[id]]; return null; }
