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
// v138: the engine failed on its own side ("Internal Error, Please try again later", a 5xx, busy, the connection dropped): the same
// step is asked again, twice (4 s, then 12 s later) — never when the engine account is out of credits, the key is refused, the
// request itself is wrong, or the step simply took too long
export const NO_CREDITS138 = /credits? insufficient|insufficient (credits?|balance|funds)|balance isn.t enough|top up to continue|out of (credits|quota)|\b402\b/i;
export function passing138(e) {
  const m = String((e && e.message) || e || ""), st = +((e && (e.status || e.code)) || 0);
  if (NO_CREDITS138.test(m) || /\b(400|401|403|404|422)\b|took too long|not allowed|rejected|invalid|unsafe|sensitive|policy/i.test(m) || [400, 401, 402, 403, 404, 422, 501].includes(st)) return false;
  return st >= 500 || /try again|please retry|internal (server )?error|temporar|busy|overload|\b50[0234]\b|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed|network/i.test(m);
}
export async function again138(fn, { tries = 3, waits = [4000, 12000], what = "engine step" } = {}) {
  const scale = process.env.AGAIN138_MS ? +process.env.AGAIN138_MS / 4000 : 1;
  for (let i = 0; ; i++) {
    try { return await fn(i); } catch (e) {
      if (i >= tries - 1 || !passing138(e)) throw e;
      console.warn(what + " failed on the engine's side (" + String(e && e.message || e).slice(0, 140) + ") → asked again");
      await sleep(waits[Math.min(i, waits.length - 1)] * scale); } }
}
// run it: { url (/media), file, key }
export async function runEngine134(kind, body, o = {}) { return again138(() => once134(kind, body, o), { what: kind }); }
async function once134(kind, body, { timeoutMs = +process.env.ENGINE134_MAX_MS || 900000, every = +process.env.ENGINE134_POLL_MS || 2500 } = {}) {
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
