// v138: the AI engine account ran out of credits (the engine answers 402 "Credits insufficient"): every job sent to it fails until
// the owner tops it up. The site says so at once: the engine's status turns "Out of credits" in Admin (no wait for the 15-minute
// check), staff see a red line at the top of Admin with how many jobs failed and since when (and a short note once a visit), and the owners (ADMIN_EMAILS) get
// one email (at most every 6 hours, when email is set up; never from the preview copy). It clears itself when a job on that engine
// is made again, or the connection test in Admin passes. Customers get their credits back (as before) and a calm sentence.
import { jobHooks } from "./jobs.js";
import { S } from "./settings.js";
import { save } from "./store.js";
import { NO_CREDITS138 } from "./engine134.js";

// which connection a job (or one of its engine steps) went to: kie@… → kie; a job of the site's own (nooi@…) → the engine its
// message names
export function engineKey138(prov, msg) {
  const p = String(prov || ""), k = p.startsWith("mm183-") ? "minimax" : p.includes("@") ? p.split("@")[0] : p;   // (v183: MiniMax voices, pictures, music)
  if (k && k !== "nooi") return k;
  return /\bkie\b/i.test(String(msg || "")) ? "kie" : "";
}
export const alerts138 = () => { const st = S(); return (st.alerts138 = st.alerts138 || {}); };
export function noCredits138(prov, msg) {
  const key = engineKey138(prov, msg); if (!key) return null;
  const a = alerts138(), now = Date.now(), cur = a[key] && a[key].type === "quota" ? a[key] : { type: "quota", since: now, count: 0 };
  cur.count++; cur.last = now; a[key] = cur;
  const st = S(); st.status = st.status || {};
  st.status[key] = { ...(st.status[key] || {}), state: "down", type: "quota", status: 402, note: "Out of credits — top up the engine account", checked: now };
  save(); mail138(key, cur).catch((e) => console.warn("engine credits email:", e.message));
  return cur;
}
async function mail138(key, cur) {
  const to = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length || process.env.NOOI_STAGE === "1" || (cur.mailed && Date.now() - cur.mailed < 6 * 3600e3)) return;
  const { emailConfigured, sendEmail } = await import("./email.js"); if (!emailConfigured()) return;
  cur.mailed = Date.now(); save();
  const site = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  for (const t of to) await sendEmail({ to: t, subject: "nooi: the AI engine account is out of credits",
    text: `The AI engine (${key}) answered "credits insufficient" — pictures, videos and sounds sent to it fail until its account is topped up.\n\nCustomers were not charged: their credits came back.\n\n1. Top up the engine account on its website.\n2. Then open ${site || "nooi"} → Admin → Models → Connections & live status → Test all.\n\nThe red line in Admin goes away by itself once a job is made again.` });
}
export function clear138(key) { const a = alerts138(); if (a[key]) { delete a[key]; save(); } }
// (what staff see comes from GET /v1/me, lib/admin.js: { kie: { since, last, count } }, read by the browser as "engine")

// (a film's own failure isn't counted again: its parts were)
jobHooks.fail.push((uidv, job, msg) => { const m = String((msg && msg.message) || msg || ""); if (NO_CREDITS138.test(m) && !job.children) noCredits138(job.prov, m); });
jobHooks.done.push((uidv, job) => { const k = engineKey138(job.prov); if (k && alerts138()[k]) clear138(k); });
jobHooks.out185.push((prov, m) => noCredits138(prov, m));   // (v185: the job went on to MiniMax — the engine is still out of credits)
