// Scenes: keep photos and videos inside one world.
// A scene has a "bible" (place, time, light, palette, characters, style) and pictures: the anchor (first result) and the
// latest frame (last image, or the last frame of the last video). Every job sent with meta.scene:
//   • gets the bible added to its prompt with a strict "same world" instruction,
//   • starts from the scene's latest picture (images: reference image · videos: start frame) unless the user gave one,
// and after it finishes it is checked against the anchor (vision model when the text AI is connected, otherwise a colour
// comparison). A result that left the scene is made again once with the differences spelled out.
// GET /v1/scenes · POST /v1/scenes {name, bible?} · PATCH /v1/scenes/:id · DELETE /v1/scenes/:id
import fs from "fs";
import { spawn } from "child_process";
import { user, save, uid } from "./store.js";
import { requireUser } from "./auth.js";
import { localPath, download, lastFrame } from "./media.js";
import { jobHooks, findJob } from "./jobs.js";
import { llmConfigured, llmJson } from "../providers/anthropic.js";

const SCENE_RULE = "Scene lock — this shot belongs to an existing scene. Keep exactly the same world: the same location and architecture, the same time of day and weather, the same lighting and colour palette, the same characters with the same faces, hair and clothes, and the same visual style and lens. Do not move to another place, do not change the era, do not add new locations.";
const PASS = 62;   // below this the result is treated as having left the scene
const scenes = (uidv) => { const u = user(uidv); u.scenes = u.scenes || {}; return u.scenes; };
const pub = (s) => ({ id: s.id, name: s.name, bible: s.bible || "", anchor: s.anchor || null, latest: s.latest || null, count: s.count || 0, created: s.created, updated: s.updated || s.created });

// before routing: add the scene's look and picture to the job
jobHooks.before.push(async (u, body) => {
  const id = body.meta?.scene; if (!id) return; const sc = scenes(u.uid)[id]; if (!sc) { delete body.meta.scene; return; }
  if (!["image", "video", "look"].includes(body.kind)) return;
  if (!sc.bible) sc.bible = String(body.prompt || "").slice(0, 600);   // a new scene is defined by its first prompt
  body.prompt = `${body.prompt}\n\n${SCENE_RULE}\nScene: ${sc.bible}`;
  body.inputs = body.inputs || {};
  const pic = sc.latest || sc.anchor;
  if (pic) {
    if (body.kind === "video" && !body.inputs.startImage && !body.inputs.vStart && !body.chainFrom && !(+body.meta?.part > 1)) body.inputs.startImage = pic;
    if (body.kind !== "video" && !body.inputs.iRef) body.inputs.iRef = pic;
  }
  body.meta.sceneAnchor = sc.anchor || null;
});

// tiny colour signature of a picture (16×16 RGB via ffmpeg) for the offline check
async function sig(url) {
  const src = localPath(url) || (await download(url)).file;
  return new Promise((res, rej) => { const out = []; const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-i", src, "-vf", "scale=16:16", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    p.stdout.on("data", (d) => out.push(d)); p.on("error", rej); p.on("close", (c) => (c === 0 ? res(Buffer.concat(out)) : rej(new Error("ffmpeg " + c)))); });
}
async function colourScore(a, b) {
  const [x, y] = await Promise.all([sig(a), sig(b)]); if (x.length < 768 || y.length < 768) return null;
  // compare 4×4 blocks of average colour (layout + palette), 0–100
  let d = 0; for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) { for (let c = 0; c < 3; c++) { let sa = 0, sb = 0; for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { const i = ((by * 4 + yy) * 16 + bx * 4 + xx) * 3 + c; sa += x[i]; sb += y[i]; } d += Math.abs(sa - sb) / 16; } }
  return Math.max(0, Math.round(100 - (d / (16 * 3)) * (100 / 90)));
}
const dataUrl = async (url) => { const f = localPath(url) || (await download(url)).file; const ext = /\.jpe?g$/i.test(f) ? "jpeg" : "png"; return `data:image/${ext};base64,${fs.readFileSync(f).toString("base64")}`; };
export async function checkScene(anchor, candidate, bible) {
  if (llmConfigured()) {
    try {
      const r = await llmJson(`Image 1 is the reference of a scene. Image 2 is a new shot that must stay in exactly the same scene.\nScene description: ${bible || "(see image 1)"}\nCompare location, architecture, time of day, weather, lighting, colour palette, characters (faces, hair, clothes) and visual style. Ignore camera angle, framing and pose changes.\nReturn {"score": 0-100 (100 = clearly the same scene and world), "same": true|false, "differences": ["short phrases of what changed, if any"]}.`,
        { images: [await dataUrl(anchor), await dataUrl(candidate)], maxTokens: 400, tier: "quick", timeoutMs: 45000 });
      const score = Math.max(0, Math.min(100, Math.round(+r.score || 0)));
      return { score, same: r.same === true || score >= PASS, differences: (r.differences || []).slice(0, 5).map(String), by: "vision" };
    } catch (e) { console.warn("scene vision:", e.message); }
  }
  const score = await colourScore(anchor, candidate).catch(() => null);
  return score == null ? null : { score, same: score >= PASS, differences: [], by: "colour" };
}

// after a job: check it, keep the scene's latest picture, or make it again once if it drifted
jobHooks.done.push(async (uidv, job) => {
  const id = job.payload?.meta?.scene; if (!id || job.parent) return; const sc = scenes(uidv)[id]; if (!sc) return;
  const pic = job.kind === "video" ? await lastFrame((job.segments && job.segments[job.segments.length - 1]) || job.url).catch(() => null) : job.url;
  if (!pic) return;
  if (sc.anchor) {
    const check = await checkScene(sc.anchor, pic, sc.bible);
    if (check) {
      job.sceneCheck = { score: check.score, same: check.same, by: check.by, differences: check.differences, retried: !!job.sceneRetry };
      if (!check.same && !job.sceneRetry && !job.children) {        // left the scene → make it again, once, with the differences named
        job.sceneRetry = 1; job.sceneCheck.retrying = true; save();
        const { restart } = await import("./jobs.js");
        const fix = check.differences.length ? `\nThe previous attempt drifted (${check.differences.join("; ")}). Correct this and stay in the scene.` : "\nThe previous attempt drifted from the scene. Stay in the scene.";
        restart(job, fix); return;
      }
    }
  } else { sc.anchor = pic; job.sceneCheck = { score: 100, same: true, by: "anchor", first: true }; }
  sc.latest = pic; sc.count = (sc.count || 0) + 1; sc.updated = Date.now(); save();
});

export function registerScenes(app) {
  app.get("/v1/scenes", requireUser, (req, res) => res.json({ items: Object.values(scenes(req.user.uid)).sort((a, b) => (b.updated || b.created) - (a.updated || a.created)).map(pub) }));
  app.post("/v1/scenes", requireUser, (req, res) => {
    const all = scenes(req.user.uid); if (Object.keys(all).length >= 200) return res.status(429).json({ error: "You have 200 scenes — delete some first" });
    const s = { id: uid(), name: String(req.body?.name || "").trim().slice(0, 60) || "Scene " + (Object.keys(all).length + 1), bible: String(req.body?.bible || "").slice(0, 600), created: Date.now(), count: 0 };
    all[s.id] = s; save(); res.json(pub(s));
  });
  app.patch("/v1/scenes/:id", requireUser, (req, res) => { const s = scenes(req.user.uid)[req.params.id]; if (!s) return res.status(404).json({ error: "Not found" });
    if (typeof req.body?.name === "string") s.name = req.body.name.trim().slice(0, 60) || s.name; if (typeof req.body?.bible === "string") s.bible = req.body.bible.slice(0, 600); save(); res.json(pub(s)); });
  app.delete("/v1/scenes/:id", requireUser, (req, res) => { const all = scenes(req.user.uid); delete all[req.params.id]; save(); res.json({ ok: true }); });
}
export { findJob };
