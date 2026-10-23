// v134: one engine step inside a bigger job (a sound for the soundtrack, the music, a picture of another angle, a lip sync of one
// shot): sent to the engine the site would use for that kind of job, followed until it is made, brought to this server. The bigger
// job is priced and charged as a whole (lib/sound134.js, lib/jobs.js), so these steps charge nothing on their own.
import fs from "fs";
import { PROVIDERS, capFor } from "../providers/index.js";
import { adapterFor, adapterByKey } from "../providers/extra.js";
import { download, localPath, publicUrl } from "./media.js";
import path from "path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// is there an engine for this kind of step? (the page and the price only offer what can be made)
export function engineFor134(kind, body = {}) {
  try { const r = adapterFor(capFor(kind, body.meta), { kind, prompt: "-", ...body }, PROVIDERS); return r && r.a && r.a.configured ? r.key : null; } catch { return null; }
}
// run it: { url (/media), file, key }
export async function runEngine134(kind, body, { timeoutMs = +process.env.ENGINE134_MAX_MS || 900000, every = +process.env.ENGINE134_POLL_MS || 2500 } = {}) {
  const b = { kind, ...body }, route = adapterFor(capFor(kind, b.meta), b, PROVIDERS);
  if (!route || !route.a || !route.a.configured) throw Object.assign(new Error("No engine is connected for " + kind), { code: 501 });
  const x = await route.a.submit(b); let url = x.done ? x.url : null; const t0 = Date.now();
  while (!url) {
    if (Date.now() - t0 > timeoutMs) throw new Error(kind + " took too long");
    await sleep(every);
    const q = await adapterByKey(route.key, PROVIDERS).poll(x.remoteId);
    if (q.status === "done" && q.url) url = q.url; else if (q.status === "failed") throw new Error(q.error || kind + " failed");
  }
  const lp = localPath(url); if (lp && fs.existsSync(lp)) return { url: publicUrl(path.basename(lp)), file: lp, key: route.key };
  const dl = await download(url); return { url: dl.url, file: dl.file, key: route.key };
}
