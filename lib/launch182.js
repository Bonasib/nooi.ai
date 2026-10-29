// v182: nooi.ai before launch — "Coming soon". Only the team the owner adds in Admin → Admins & permissions (each with a role)
// can use the site; everyone else sees the Coming soon page and may register (the account waits until the owner gives it
// access). Each new account is told to the owners at once: an email to ADMIN_EMAILS (when email is set up; at most 40 a day;
// never from the preview copy) and a count on Admin. Nothing is deleted: a customer's credits, library and plan wait too.
// The mode: NOOI_LAUNCH=soon|open (a server setting, it wins) → Admin's switch → by default "soon" on a real web address and
// "open" on this computer (localhost), so a local copy and the tests stay open.
import { S } from "./settings.js";
import { save, allUsers } from "./store.js";
import { roleOf, requireAdmin, audit } from "./admin.js";
import { authHooks182 } from "./auth.js";

const envMode = () => { const v = String(process.env.NOOI_LAUNCH || "").trim().toLowerCase(); return v === "soon" || v === "open" ? v : ""; };
const localSite = () => { const b = String(process.env.PUBLIC_BASE_URL || "").trim(); if (!b) return true; try { return /^(localhost|127\.|0\.0\.0\.0|\[::1\]$)/.test(new URL(b).hostname); } catch { return true; } };
const L182 = () => { const st = S(); return (st.launch182 = st.launch182 || {}); };
export const launchMode182 = () => envMode() || (["soon", "open"].includes(L182().mode) ? L182().mode : (localSite() ? "open" : "soon"));
export const soon182 = () => launchMode182() === "soon";

// what someone without a role may still do while it's Coming soon: know who they are, delete their account, write to support
const FREE182 = /^\/v1\/(me|me\/delete|support(\/.*)?)$/;
export const SOON_MSG182 = { error: "nooi.ai is coming soon — only the team can use it for now. Your account is registered; we'll tell you when it opens.", errorAr: "nooi.ai قادم قريباً — يستخدمه الفريق فقط الآن. حسابك مسجّل، وسنخبرك عند الافتتاح.", soon182: true };
export function gate182(u, req) {
  if (!soon182() || !u || u.uid === "local" || FREE182.test(String((req && (req.originalUrl || req.path)) || "").split("?")[0])) return null;
  return roleOf(u) ? null : SOON_MSG182;
}

// a new account: kept in the list the owner sees, and the owners are told
function created182(u, U) {
  if (!u || u.uid === "local") return;
  const L = L182(), P = U.profile || {}, r = { uid: u.uid, email: u.email || "", phone: u.phone || "", at: Date.now(), country: P.country || "", soon: soon182() };
  L.regs = [r, ...(L.regs || []).filter((x) => x.uid !== u.uid)].slice(0, 1000); save();
  mail182(r).catch((e) => console.warn("registration email:", e.message));
}
async function mail182(r) {
  const to = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length || process.env.NOOI_STAGE === "1") return;
  const { emailConfigured, sendEmail } = await import("./email.js"); if (!emailConfigured()) return;
  const L = L182(), day = new Date().toISOString().slice(0, 10); L.mail = L.mail && L.mail.day === day ? L.mail : { day, n: 0 };
  if (L.mail.n >= 40) return; L.mail.n++; save();
  const site = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""), who = r.email || r.phone || r.uid;
  for (const t of to) await sendEmail({ to: t, subject: `nooi: new registration — ${who}`,
    text: `Someone registered on nooi.ai${r.soon ? " while it's Coming soon" : ""}.\n\nAccount: ${who}${r.country ? `\nCountry: ${r.country}` : ""}\nTime: ${new Date(r.at).toUTCString()}\n\n` +
      (r.soon ? `They see the Coming soon page until you give them access: ${site || "nooi"}/?view=admin → Admins & permissions → Registrations → choose a role → Give access.` : `${site || "nooi"}/?view=admin → Clients`) +
      `\n\n—\nسجّل شخص جديد في nooi.ai: ${who}. ${r.soon ? "يرى صفحة «قادمون قريباً» حتى تمنحه صلاحية من لوحة الإدارة ← المشرفون والصلاحيات ← التسجيلات." : ""}` });
}

function regList() {
  const L = L182(), seen = L.seen || 0, log = Object.fromEntries((L.regs || []).map((r) => [r.uid, r]));
  return allUsers().filter(([id]) => id !== "local").map(([id, U]) => {
    const P = U.profile || {}, r = log[id] || {}, email = P.emailVerified ? (P.email || "") : "";
    return { uid: id, cid: U.cid || "", email, unverified: !!(P.email && !P.emailVerified), phone: r.phone || "", name: P.name || (P.email || "").split("@")[0] || "", created: P.created || r.at || 0, lastSeen: P.lastSeen || 0, country: P.country || r.country || "", role: roleOf({ uid: id }), fresh: (r.at || 0) > seen };
  }).filter((x) => !x.role).sort((a, b) => b.created - a.created).slice(0, 300);
}

export function registerLaunch182(app, requireUser) {
  authHooks182.gate = gate182; authHooks182.created.push(created182);
  app.get("/v1/admin/launch", requireUser, requireAdmin("admins.manage"), (req, res) => res.json({ mode: launchMode182(), env: envMode() || null, local: localSite(), stored: L182().mode || null, seen: L182().seen || 0, regs: regList() }));
  app.put("/v1/admin/launch", requireUser, requireAdmin("admins.manage"), (req, res) => {
    const m = String((req.body || {}).mode || "");
    if (!["soon", "open"].includes(m)) return res.status(400).json({ error: "Invalid" });
    if (envMode() && envMode() !== m) return res.status(409).json({ error: `The server setting NOOI_LAUNCH=${envMode()} decides this — change it in the server's .env.`, errorAr: `يحدد ذلك إعداد الخادم NOOI_LAUNCH=${envMode()} — غيّره في ملف ‎.env على الخادم.` });
    L182().mode = m; save(); audit(req, m === "soon" ? "Site set to Coming soon (team only)" : "Site opened to everyone"); res.json({ ok: true, mode: launchMode182() });
  });
  app.post("/v1/admin/launch/seen", requireUser, requireAdmin("admins.manage"), (req, res) => { L182().seen = Date.now(); save(); res.json({ ok: true }); });
}
