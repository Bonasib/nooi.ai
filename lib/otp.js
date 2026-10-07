// 6-digit email sign-in codes: kept hashed in memory for 10 minutes, 5 tries, one-time use.
import crypto from "crypto";
const codes = new Map();
const hash = (email, code) => crypto.createHmac("sha256", process.env.SECRET_KEY || "nooi").update(email + ":" + code).digest();
export function newCode(email) {
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
  codes.set(email, { h: hash(email, code), exp: Date.now() + 10 * 60e3, tries: 0 });
  if (codes.size > 20000) for (const [k, v] of codes) if (v.exp < Date.now()) codes.delete(k);
  return code;
}
// → "ok" | "wrong" | "expired" | "locked"
export function checkCode(email, code) {
  const c = codes.get(email);
  if (!c || Date.now() > c.exp) { codes.delete(email); return "expired"; }
  if (c.tries >= 5) return "locked";
  c.tries++;
  const ok = /^\d{6}$/.test(String(code)) && crypto.timingSafeEqual(c.h, hash(email, String(code)));
  if (ok) codes.delete(email);
  return ok ? "ok" : "wrong";
}
