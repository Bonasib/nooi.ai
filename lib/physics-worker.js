// the physics worker thread: loads MuJoCo once (≈0.15 s) and answers simulations one at a time (lib/physics.js)
import { parentPort, workerData } from "worker_threads";
import { pathToFileURL } from "url";
import { simulate } from "./physics-scenes.js";
let mj = null;
const ready = (async () => { const load = (await import(pathToFileURL(workerData.pkg).href)).default; mj = await load(); })();
parentPort.on("message", async ({ id, scene, opts }) => {
  try { await ready; parentPort.postMessage({ id, result: simulate(mj, scene, opts) }); }
  catch (e) { parentPort.postMessage({ id, error: String((e && e.message) || e).slice(0, 300), code: (e && e.code) || 500 }); }
});
