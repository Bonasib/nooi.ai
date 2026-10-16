// v89 on the server: every finished result is kept on this server.
// A result is copied here when it finishes (lib/jobs.js). If that copy failed (the engine's file server was slow or busy),
// the job kept the engine's own link — and those links expire after some hours, so the video stopped showing on the site.
// Here, results from the last two days that still point elsewhere are copied again (three tries each, a few at a time);
// the page picks up the new address on its next sync.
import { allUsers, save } from "./store.js";
import { download, localPath } from "./media.js";

const RECENT = 2 * 24 * 3600 * 1000;
export async function keepMedia({ max = 12, now = Date.now() } = {}) {
  if (process.env.MIRROR_MEDIA === "false") return 0;
  let n = 0;
  for (const [, U] of allUsers()) for (const j of Object.values(U.jobs || {})) {
    if (n >= max) return n;
    if (j.status !== "done" || !/^https?:\/\//.test(String(j.url || "")) || localPath(j.url) || (j.keepTried || 0) >= 3 || now - (j.created || 0) > RECENT) continue;
    j.keepTried = (j.keepTried || 0) + 1; n++;
    try { j.url = (await download(j.url, null, { tries: 1, timeoutMs: 120000 })).url; delete j.keepTried; }
    catch (e) { console.warn("keep media:", j.id, e.message); }
    save();
  }
  return n;
}
export function startKeepMedia() {
  const run = () => keepMedia().catch((e) => console.warn("keep media:", e.message));
  setTimeout(run, 30000).unref(); setInterval(run, 30 * 60000).unref();
}
