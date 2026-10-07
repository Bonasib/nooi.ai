import { user, allUsers, save, uid } from "./store.js";
import { PROVIDERS, capFor } from "../providers/index.js";
import { adapterFor, adapterByKey } from "../providers/extra.js";
import { featureOn, modelOn } from "./settings.js";
import { checkEntitlement } from "./plans.js";
import { isStaff } from "./admin.js";
const FEATURE = { video: "video", chapter: "story", image: "image", look: "chars", sheet: "chars", edit: "edit", bg: "fx", mocap: "fx", voice: "voice", voiceclone: "voice", voiceconvert: "voice", world: "world", lipsync: "voice", music: "voice", sfx: "voice", finish: "finish", transcribe: "subs", dub: "subs", "3d": "studio3d", track3d: "studio3d", view3d: "studio3d", place3d: "studio3d" };
import { download, lastFrame } from "./media.js";
import { priceOf, charge, credit } from "./billing.js";
import { moderate } from "./moderation.js";
import { withRetry, classify, USER_MSG } from "./errors.js";

export async function createJob(u, body) {
  if (process.env.GPU_FEATURES !== "true" && ["3d", "track3d", "view3d", "place3d"].includes(body.kind)) throw Object.assign(new Error("3D generation is not available yet"), { code: 403 });
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
  const cost = staff ? 0 : priceOf(body.kind, body) + (body.kind === "video" ? ({ 60: 2, 120: 4 })[+body.meta?.fps] || 0 : 0);
  if (cost) charge(u.uid, cost, (body.kind || "job") + " · " + String(body.prompt || "").slice(0, 40));
  const job = { id: uid(), kind: body.kind, cap, prov: route.key, status: "queued", progress: 0, created: Date.now(), payload: body, cost, title: body.title || body.prompt || "" };
  user(u.uid).jobs[job.id] = job; save();
  const parts = body.kind === "video" ? Math.min(6, Math.max(1, +body.meta?.parts || 1)) : 1;
  if (parts > 1) {                      // long video: N connected parts, each continuing from the previous last frame
    const per = Math.ceil((+body.dur || 5) / parts); let prev = null; job.children = []; job.status = "rendering";
    for (let i = 0; i < parts; i++) {
      const child = { id: uid(), kind: "video", cap, prov: route.key, status: "queued", progress: 0, created: Date.now(), parent: job.id, cost: 0, title: `${job.title} · ${i + 1}/${parts}`,
        payload: { ...body, dur: per, chainAfter: prev, meta: { ...(body.meta || {}), parts: 1, part: i + 1 }, prompt: i ? `${body.prompt} — continue seamlessly (part ${i + 1} of ${parts}), same characters, place and light` : body.prompt } };
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
    while (prev && prev.status !== "done" && prev.status !== "failed" && Date.now() - t0 < 30 * 60e3) await new Promise((r) => setTimeout(r, 4000));
    if (prev && prev.status === "done") p.chainFrom = prev.url; else if (prev) throw Object.assign(new Error("The previous part failed"), { type: "input" }); }
  if (p.chainFrom) { try { p.inputs.startImage = await lastFrame(p.chainFrom); } catch (e) { console.warn("chain frame:", e.message); } }
  const r = await withRetry(() => adapterByKey(job.prov || job.cap, PROVIDERS).submit(p));
  if (r.done) await finish(job, r.url, r.segments); else { job.remoteId = r.remoteId; job.status = "rendering"; save(); }
}
async function finish(job, url, segments) {
  job.progress = 1; if (segments) job.segments = segments;
  if (process.env.MIRROR_MEDIA !== "false" && url) { try { url = (await download(url)).url; } catch (e) { console.warn("mirror:", e.message); } }
  job.url = url; job.status = "done"; save();
}
function fail(uidv, job, msg) { const c = classify(msg instanceof Error ? msg : new Error(String(msg))); job.status = "failed"; job.errorType = c.type; job.error = USER_MSG[c.type] || String(msg); job.errorDetail = String(msg).slice(0, 300); if (job.cost && !job.refunded) { job.refunded = true; credit(uidv, job.cost, "Refund · failed " + job.kind, job.id); } save(); }
export function publicJob(j) { return j && { id: j.id, status: j.status, progress: j.progress, url: j.url || null, error: j.error || null, errorType: j.errorType || null, segments: j.segments || null, kind: j.kind, title: j.title || null, created: j.created }; }

// Parent of a multi-part video: done when every part is done (segments = all part URLs)
setInterval(() => { for (const [uidv, u] of allUsers()) for (const job of Object.values(u.jobs)) {
  if (!job.children || job.status !== "rendering") continue; const kids = job.children.map((id) => u.jobs[id]).filter(Boolean);
  job.progress = kids.reduce((a, k) => a + (k.status === "done" ? 1 : k.progress || 0), 0) / kids.length;
  if (kids.some((k) => k.status === "failed")) { fail(uidv, job, new Error(kids.find((k) => k.status === "failed").errorDetail || "A part failed")); }
  else if (kids.every((k) => k.status === "done")) { job.status = "done"; job.progress = 1; job.url = kids[0].url; job.segments = kids.map((k) => k.url); save(); }
} }, 3000);
// Poll all running provider jobs
setInterval(async () => {
  for (const [uidv, u] of allUsers()) for (const job of Object.values(u.jobs)) {
    if (job.status !== "rendering" || !job.remoteId || job._busy) continue;
    job._busy = true;
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
}, 5000);
