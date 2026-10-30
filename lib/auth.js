import admin from "firebase-admin";
import { userFromToken, tokenRules, tokenFor, tokenCtx, tokenUsedUp } from "./tokens.js";
import { user, save, col } from "./store.js";
let enabled = false, canMint = false;
if (process.env.FIREBASE_PROJECT_ID) {
  try {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
    admin.initializeApp(sa ? { credential: admin.credential.cert(sa) } : { projectId: process.env.FIREBASE_PROJECT_ID });
    enabled = true; canMint = !!sa;
  } catch (e) { console.error("Firebase admin init failed:", e.message); }
} else console.warn("⚠ FIREBASE_PROJECT_ID not set — running WITHOUT sign-in (single local user). Do not expose publicly like this.");

export async function verify(token) {
  if (!enabled) return { uid: "local" };
  if (!token) return null;
  try { const d = await admin.auth().verifyIdToken(token); return { uid: d.uid, email: d.email, emailVerified: d.email_verified === true, phone: d.phone_number }; } catch { return null; }
}
// v182 (lib/launch182.js): Coming soon — who may use the site (gate → an answer to refuse with) and a new account's moment
export const authHooks182 = { gate: null, created: [] };
export async function requireUser(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : req.query.token;
  // (v196: in the no-sign-in mode — tests and development only, never public — an X-Dev-User header names another local account,
  // so shared projects and roles can be exercised; with sign-in on, the header is ignored)
  const dev = !enabled && req.headers["x-dev-user"] ? String(req.headers["x-dev-user"]).replace(/[^a-z0-9]/gi, "").slice(0, 20).toLowerCase() : "";
  const u = userFromToken(token) || (dev ? { uid: "dev_" + dev, email: dev + "@dev.local", emailVerified: true } : await verify(token));
  if (!u) return res.status(401).json({ error: "Sign in required" });
  // v125: an account deleted moments ago isn't made again by a sign-in token that is still valid (another open tab)
  if (enabled && gone125(u.uid)) return res.status(401).json({ error: "This account was deleted.", errorAr: "حُذف هذا الحساب." });
  const U = user(u.uid); const now = Date.now();
  const new182 = !U.profile; if (!U.profile) U.profile = { created: now };
  if (u.email) { U.profile.email = u.email; U.profile.emailVerified = u.emailVerified === true; } U.profile.lastSeen = now;
  // Location from the CDN / proxy headers (Cloudflare, Vercel, Fastly…) — no extra lookups, no IP stored
  const H = req.headers; const cc = H["cf-ipcountry"] || H["x-vercel-ip-country"] || H["x-country-code"] || H["fastly-geo-country"];
  const city = H["cf-ipcity"] || H["x-vercel-ip-city"] || H["x-city"];
  if (cc && /^[A-Z]{2}$/i.test(cc) && cc !== "XX") U.profile.country = cc.toUpperCase(); if (city) { try { U.profile.city = decodeURIComponent(city).slice(0, 60); } catch { U.profile.city = String(city).slice(0, 60); } } if (!U._s || now - U._s > 60000) { U._s = now; save(); }
  if (new182) for (const f of authHooks182.created) { try { f(u, U, req); } catch (e) { console.warn("new account:", e.message); } }
  if (U.status === "suspended" && !req.path.startsWith("/v1/support")) return res.status(403).json({ error: "This account is suspended. Contact contact@nooi.ai" });
  const g182 = authHooks182.gate && authHooks182.gate(u, req); if (g182) return res.status(403).json(g182);
  // a read-only connection (API token) can only look
  if (u.viaToken && req.method !== "GET" && tokenRules(tokenFor(u)).access === "read") return res.status(403).json({ error: "This connection is read-only — it can look at your library but not make or post anything." });
  if (u.viaToken && req.method !== "GET" && tokenUsedUp(u)) return res.status(402).json({ error: `This connection's daily limit (${tokenRules(tokenFor(u)).dailyCap} credits) is reached — raise it in nooi → Integrations, or try tomorrow.` });
  req.user = u; if (u.viaToken) return tokenCtx.run(u, () => next()); next();
}
export const firebaseWebConfig = () => process.env.FIREBASE_API_KEY ? {
  apiKey: process.env.FIREBASE_API_KEY, authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID, appId: process.env.FIREBASE_APP_ID
} : null;

// Branded sign-in emails: the server creates the Firebase sign-in link itself (needs FIREBASE_SERVICE_ACCOUNT)
export const canSendSignInLinks = () => enabled && canMint;
export async function signInLink(email, url) { return admin.auth().generateSignInWithEmailLink(email, { url, handleCodeInApp: true }); }

// Email-code sign-in: find (or create) the Firebase user for a proven address and mint a custom token.
// An existing unverified account (e.g. someone else made an email/password account for this address) is
// marked verified only after its password is replaced and its sessions are revoked.
export async function customTokenForEmail(email) {
  const crypto = await import("crypto"); let u;
  try {
    u = await admin.auth().getUserByEmail(email);
    if (!u.emailVerified) { await admin.auth().updateUser(u.uid, { emailVerified: true, password: crypto.randomBytes(24).toString("base64url") }); await admin.auth().revokeRefreshTokens(u.uid); }
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    u = await admin.auth().createUser({ email, emailVerified: true });
  }
  return admin.auth().createCustomToken(u.uid);
}

// v125: Delete my account — the sign-in account goes too (needs the service account; without it the data is still deleted), and
// for 2 hours a token from before can't make the account again (the time a sign-in token stays valid, with room to spare)
export async function deleteAuthUser(uid) { if (!enabled || !canMint) return false; try { await admin.auth().deleteUser(uid); return true; } catch (e) { console.warn("delete sign-in account:", e.message); return false; } }
export function markGone125(uid) { if (!enabled) return; const g = col("gone125", {}), now = Date.now(); for (const [k, t] of Object.entries(g)) if (now - t > 2 * 3600e3) delete g[k]; g[uid] = now; save(); }
const gone125 = (uid) => { const t = col("gone125", {})[uid]; return !!t && Date.now() - t < 2 * 3600e3; };
