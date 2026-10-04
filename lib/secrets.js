// AES-256-GCM encryption for provider & payment keys saved from the admin dashboard.
import crypto from "crypto";
const key = () => { const k = process.env.SECRET_KEY; if (!k || k.length < 16) throw Object.assign(new Error("Set SECRET_KEY (32+ random characters) in .env before saving keys"), { code: 501 }); return crypto.createHash("sha256").update(k).digest(); };
export function encrypt(obj) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv("aes-256-gcm", key(), iv); const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]); return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join("."); }
export function decrypt(s) { if (!s) return {}; try { const [iv, tag, data] = s.split(".").map((b) => Buffer.from(b, "base64")); const d = crypto.createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag); return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString("utf8")); } catch { return {}; } }
export const mask = (v) => v ? "••••" + String(v).slice(-4) : "";
