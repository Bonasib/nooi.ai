// v188: the disk stayed full after the update. Two reasons: on a 100 % full disk the update itself can't start (the new package can't
// even be unpacked, so the clearing that comes with it never runs), and nobody could see from the site what fills the disk. Now:
//  · the server's own timer (/etc/cron.d/nooi-space → deploy/space.sh --auto, as root, every 5 minutes) clears what nooi doesn't need
//    when the disk is 90 % full or when Admin asks, and writes what fills the disk to data/space188.json (refreshed every hour);
//  · GET /v1/admin/space188 (owners and admins) gives that report with the disk as it is now; POST /v1/admin/space188/free asks the
//    timer to clear now (a file it picks up within 5 minutes — the site itself runs without root);
//  · the site clears its own temporary files (the frames, sounds and parts its steps make) that are more than 6 hours old, every hour.
import fs from "fs";
import os from "os";
import path from "path";
import { disk186 } from "./disk186.js";

const DATA = () => path.resolve(process.env.SPACE188_DIR || "data");
const REPORT = () => path.join(DATA(), "space188.json"), FLAG = () => path.join(DATA(), "space188.free");

export function space188() {
  let r = null; try { r = JSON.parse(fs.readFileSync(REPORT(), "utf8")); } catch { /* none yet */ }
  return { report: r, now: disk186(), requested: fs.existsSync(FLAG()), at: Date.now() };
}

// the site's own temporary files (names its steps give them), older than 6 hours — never anything else in the temporary folder
const OURS = /^(nooi-|mod126-|vss-)|^[a-z0-9]{12,20}\.(jpg|jpeg|png|txt|wav|mp3|mp4|webm|m4a)$/;
export function sweepTmp188(maxAgeMs = 6 * 3600e3, dir = os.tmpdir()) {
  let n = 0, bytes = 0; const now = Date.now();
  let names = []; try { names = fs.readdirSync(dir); } catch { return { n, bytes }; }
  for (const name of names) {
    if (!OURS.test(name)) continue;
    const f = path.join(dir, name);
    try { const st = fs.statSync(f); if (now - st.mtimeMs < maxAgeMs) continue;
      bytes += st.isDirectory() ? 0 : st.size; fs.rmSync(f, { recursive: true, force: true }); n++; } catch { /* in use or gone */ }
  }
  if (n) console.log(`temporary files: ${n} old ones cleared (${Math.round(bytes / 1e6)} MB)`);
  return { n, bytes };
}
setInterval(() => sweepTmp188(), 3600e3).unref(); setTimeout(() => sweepTmp188(), 60e3).unref();

export function registerSpace188(app, requireUser, isStaff) {
  app.get("/v1/admin/space188", requireUser, (req, res) => { if (!isStaff(req.user)) return res.status(403).json({ error: "Not allowed" }); res.json(space188()); });
  app.post("/v1/admin/space188/free", requireUser, (req, res) => {
    if (!isStaff(req.user)) return res.status(403).json({ error: "Not allowed" });
    try { fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(FLAG(), String(Date.now())); }
    catch (e) { return res.status(507).json({ error: "The disk is too full to even leave the request — run on the server: bash /opt/nooi/deploy/space.sh --free", errorAr: "القرص ممتلئ لدرجة أن الطلب لم يُحفظ — شغّل على الخادم: bash /opt/nooi/deploy/space.sh --free" }); }
    res.json({ requested: true, ...space188() });
  });
}
