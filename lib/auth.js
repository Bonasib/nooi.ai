import admin from "firebase-admin";
import { userFromToken } from "./tokens.js";
import { user, save } from "./store.js";
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
export async function requireUser(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : req.query.token;
  const u = userFromToken(token) || (await verify(token));
  if (!u) return res.status(401).json({ error: "Sign in required" });
  const U = user(u.uid); const now = Date.now();
  if (!U.profile) U.profile = { created: now };
  if (u.email) { U.profile.email = u.email; U.profile.emailVerified = u.emailVerified === true; } U.profile.lastSeen = now;
  // Location from the CDN / proxy headers (Cloudflare, Vercel, Fastly…) — no extra lookups, no IP stored
  const H = req.headers; const cc = H["cf-ipcountry"] || H["x-vercel-ip-country"] || H["x-country-code"] || H["fastly-geo-country"];
  const city = H["cf-ipcity"] || H["x-vercel-ip-city"] || H["x-city"];
  if (cc && /^[A-Z]{2}$/i.test(cc) && cc !== "XX") U.profile.country = cc.toUpperCase(); if (city) { try { U.profile.city = decodeURIComponent(city).slice(0, 60); } catch { U.profile.city = String(city).slice(0, 60); } } if (!U._s || now - U._s > 60000) { U._s = now; save(); }
  if (U.status === "suspended" && !req.path.startsWith("/v1/support")) return res.status(403).json({ error: "This account is suspended. Contact contact@nooi.ai" });
  req.user = u; next();
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
