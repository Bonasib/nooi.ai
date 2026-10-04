// Personal API tokens (for MCP, Blender, Unity, scripts). Only a hash is stored.
import crypto from "crypto";
import { user, allUsers, save, uid } from "./store.js";
const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");
export function createToken(uidv, name) { const t = "nooi_" + crypto.randomBytes(24).toString("base64url"); const u = user(uidv); u.tokens = u.tokens || []; u.tokens.push({ id: uid(), name: name || "token", hash: hash(t), last4: t.slice(-4), created: Date.now() }); save(); return t; }
export function listTokens(uidv) { return (user(uidv).tokens || []).map(({ id, name, last4, created, used }) => ({ id, name, last4, created, used })); }
export function revokeToken(uidv, id) { const u = user(uidv); u.tokens = (u.tokens || []).filter((t) => t.id !== id); save(); }
export function userFromToken(t) { if (!t || !t.startsWith("nooi_")) return null; const h = hash(t); for (const [id, u] of allUsers()) { const k = (u.tokens || []).find((x) => x.hash === h); if (k) { k.used = Date.now(); return { uid: id, viaToken: true }; } } return null; }
