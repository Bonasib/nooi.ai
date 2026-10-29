// v186: how full the server's disk is. Staff see a red line at the top of Admin from 85 % (DISK_WARN_PCT), and the owners
// (ADMIN_EMAILS) get one email a day from 90 % when email is set up (never from the preview copy). When the disk fills, new videos,
// pictures and saves fail. (The backups used to pack all the media again at every update and filled a 100 GB disk —
// deploy/backup.sh now keeps the media once; deploy/space.sh shows what fills the disk and clears what nooi doesn't need.)
import fs from "fs";
import { S } from "./settings.js";
import { save } from "./store.js";

let last = null, at = 0;
export function disk186() {
  if (at && Date.now() - at < 60000) return last;
  at = Date.now();
  try {
    const s = fs.statfsSync(process.cwd()), used = (s.blocks - s.bfree) * s.bsize, avail = s.bavail * s.bsize;
    last = used + avail > 0 ? { pct: Math.round(used / (used + avail) * 100), freeGb: Math.round(avail / 1e8) / 10, totalGb: Math.round((s.blocks * s.bsize) / 1e9) } : null;
  } catch { last = null; }
  return last;
}
const warnAt = () => +process.env.DISK_WARN_PCT || 85;
// what GET /v1/me gives owners and admins (null while the disk is fine)
export function staffDisk186() { const d = disk186(); return d && d.pct >= warnAt() ? d : null; }

async function mail186(d) {
  const to = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean), st = S();
  if (!to.length || process.env.NOOI_STAGE === "1" || (st.disk186mailed && Date.now() - st.disk186mailed < 24 * 3600e3)) return;
  const { emailConfigured, sendEmail } = await import("./email.js"); if (!emailConfigured()) return;
  st.disk186mailed = Date.now(); save();
  for (const t of to) await sendEmail({ to: t, subject: `nooi: the server's disk is ${d.pct}% full`,
    text: `The server's disk is ${d.pct}% full — ${d.freeGb} GB free of ${d.totalGb} GB. When it fills, new videos, pictures and saves fail.\n\n1. See what fills it — on the server: bash /opt/nooi/deploy/space.sh\n2. Clear what nooi doesn't need: bash /opt/nooi/deploy/space.sh --free\n\n(Customers' data and media are never touched by it.)` });
}
setInterval(() => { const d = disk186(); if (d && d.pct >= Math.max(90, warnAt())) mail186(d).catch((e) => console.warn("disk email:", e.message)); }, 30 * 60e3).unref();
