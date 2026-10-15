// nooi physics (v85) — the server side. MuJoCo (Google DeepMind, Apache-2.0; npm @mujoco/mujoco) runs in a worker thread so the
// site never waits on it; the page sends a scene and a few numbers and gets back the motion (30 frames a second), what happened,
// the measured facts and a sentence for video prompts (lib/physics-scenes.js). Free: no engine, no credits — one run at a time
// per person, 60 runs per 10 minutes, at most 20 s of computing per run (the worker is restarted if a run takes longer).
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve("node_modules/@mujoco/mujoco/mujoco.js");
export const physicsReady = () => fs.existsSync(PKG);
let worker = null, seq = 0; const waiting = new Map();
function start() {
  worker = new Worker(path.join(HERE, "physics-worker.js"), { workerData: { pkg: PKG } });
  worker.on("message", (msg) => { const w = waiting.get(msg.id); if (!w) return; waiting.delete(msg.id); clearTimeout(w.timer); msg.error ? w.reject(Object.assign(new Error(msg.error), { code: msg.code || 500 })) : w.resolve(msg.result); });
  worker.on("error", (e) => { for (const w of waiting.values()) { clearTimeout(w.timer); w.reject(Object.assign(new Error("Physics stopped: " + e.message), { code: 500 })); } waiting.clear(); worker = null; });
  worker.on("exit", () => { worker = null; });
  worker.unref();
}
export function simulateAsync(scene, opts, ms = 20000) {
  if (!physicsReady()) return Promise.reject(Object.assign(new Error("Physics isn't installed on this server yet."), { code: 503 }));
  if (!worker) start();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(id); try { worker && worker.terminate(); } catch (e) {} worker = null;
      reject(Object.assign(new Error("That took too long — try fewer things or a shorter scene."), { code: 422 })); }, ms);
    waiting.set(id, { resolve, reject, timer });
    worker.postMessage({ id, scene, opts });
  });
}
// the same rules for the page and for ChatGPT / Claude (lib/mcp.js): a known scene, small options, one run at a time per
// person, 60 runs per 10 minutes
const busy = new Set(), runs = new Map(), SCENES = ["objects", "water", "air", "car", "body"];
const fail = (code, msg) => Object.assign(new Error(msg), { code });
export async function simulateFor(uid, scene, opts) {
  if (!SCENES.includes(scene)) throw fail(400, "Pick a scene: objects, water, air, car or body.");
  const o = opts && typeof opts === "object" && !Array.isArray(opts) ? opts : {};
  if (JSON.stringify(o).length > 2000) throw fail(400, "Too many options for one simulation.");
  if (busy.has(uid)) throw fail(429, "One simulation at a time — the last one is still running.");
  const now = Date.now(), list = (runs.get(uid) || []).filter((t) => now - t < 600000);
  if (list.length >= 60) throw fail(429, "That's a lot of simulations — try again in a few minutes.");
  list.push(now); runs.set(uid, list); busy.add(uid);
  try { return await simulateAsync(scene, JSON.parse(JSON.stringify(o))); }
  catch (e) { if (!(e.code >= 400 && e.code < 500) && e.code !== 503) { console.warn("physics:", e.message); throw fail(500, "The simulation couldn't run — try other numbers."); } throw e; }
  finally { busy.delete(uid); }
}
export function registerPhysics(app, requireUser) {
  app.get("/v1/physics", requireUser, (req, res) => res.json({ ready: physicsReady(), engine: "MuJoCo", license: "Apache-2.0" }));
  app.post("/v1/physics/simulate", requireUser, async (req, res) => {
    const b = req.body || {};
    try { res.json(await simulateFor(req.user.uid, b.scene, b.opts)); }
    catch (e) { res.status(e.code >= 400 && e.code < 600 ? e.code : 500).json({ error: e.message }); }
  });
}
