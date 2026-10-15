// Personal API tokens (for MCP, Blender, Unity, scripts). Only a hash is stored.
import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import { user, allUsers, save, uid } from "./store.js";
const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");
// Each token is one connection (an AI assistant through MCP, Blender, a script). Its rules, set by the owner in Integrations:
//   access "full" | "read" (read: it can look, never spend or post) · dailyCap: credits it may spend per day (UTC) ·
//   approvePosts: posts it schedules wait until the owner approves them in nooi (a connection can never approve its own posts).
export const TOKEN_DEFAULTS = { access: "full", dailyCap: 500, approvePosts: true };
export const tokenRules = (k) => ({ access: k && k.access === "read" ? "read" : "full", dailyCap: k && Number.isFinite(+k.dailyCap) ? Math.max(0, Math.round(+k.dailyCap)) : TOKEN_DEFAULTS.dailyCap, approvePosts: !(k && k.approvePosts === false) });
const today = () => new Date().toISOString().slice(0, 10);
const spentToday = (k) => (k && k.spent && k.spent.day === today() ? k.spent.n : 0);
export function createToken(uidv, name, opts) { const t = "nooi_" + crypto.randomBytes(24).toString("base64url"); const u = user(uidv); u.tokens = u.tokens || []; u.tokens.push({ id: uid(), name: name || "token", hash: hash(t), last4: t.slice(-4), created: Date.now(), ...tokenRules({ ...TOKEN_DEFAULTS, ...(opts || {}) }) }); save(); return t; }
export const tokenOf = (uidv, id) => (user(uidv).tokens || []).find((t) => t.id === id) || null;
export function updateToken(uidv, id, patch) { const k = tokenOf(uidv, id); if (!k) return null; const r = tokenRules({ ...tokenRules(k), ...(patch || {}) }); Object.assign(k, r, patch && patch.name ? { name: String(patch.name).slice(0, 60) } : {}); save(); return k; }
// before a connection spends: read-only connections never spend; the daily limit holds (checked with the real price)
export function tokenCheck(u, price) { if (!u || !u.viaToken || !u.tokenId) return; const k = tokenOf(u.uid, u.tokenId), r = tokenRules(k);
  if (!k) throw Object.assign(new Error("This connection was removed in nooi — nothing more is made through it."), { code: 401 });
  if (r.access === "read") throw Object.assign(new Error("This connection is read-only — it can look at your library but not make or post anything."), { code: 403 });
  if (spentToday(k) + (+price || 0) > r.dailyCap) throw Object.assign(new Error(`This connection's daily limit (${r.dailyCap} credits) is reached — raise it in nooi → Integrations, or try tomorrow.`), { code: 402 }); }
export function tokenSpend(u, price) { if (!u || !u.viaToken || !u.tokenId || !price) return; const k = tokenOf(u.uid, u.tokenId); if (!k) return; const d = today(); k.spent = { day: d, n: spentToday(k) + (+price || 0) }; save(); }
// Every credit charged while a connection's request runs counts toward its daily limit (AI text, dubbing, video
// intelligence… — not only jobs, which count their price in createJob). requireUser runs a connection's request inside
// tokenCtx; billing.charge() reports here. Only charges to the connection's own account count.
export const tokenCtx = new AsyncLocalStorage();
export function tokenCharged(uidv, amount) { const u = tokenCtx.getStore(); if (u && u.uid === uidv && amount > 0) tokenSpend(u, amount); }
// a connection that has used up today's limit can only look until tomorrow (UTC)
export function tokenUsedUp(u) { const k = tokenFor(u); return !!k && spentToday(k) >= tokenRules(k).dailyCap; }
export const tokenFor = (u) => (u && u.viaToken && u.tokenId ? tokenOf(u.uid, u.tokenId) : null);
export function listTokens(uidv) { return (user(uidv).tokens || []).map((k) => ({ id: k.id, name: k.name, last4: k.last4, created: k.created, used: k.used, ...tokenRules(k), spentToday: spentToday(k) })); }
export function revokeToken(uidv, id) { const u = user(uidv); u.tokens = (u.tokens || []).filter((t) => t.id !== id); save(); }
export function userFromToken(t) { if (!t || !t.startsWith("nooi_")) return null; const h = hash(t); for (const [id, u] of allUsers()) { const k = (u.tokens || []).find((x) => x.hash === h); if (k) { k.used = Date.now(); return { uid: id, viaToken: true, tokenId: k.id }; } } return null; }
