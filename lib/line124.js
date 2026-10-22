// v124: the engine's send line. An AI engine takes only so many NEW tasks from one account in a window — Kie: 20 new generation
// requests every 10 s; more are answered "429" and dropped, not queued (its own docs). Before, a busy moment sent everything at
// once, got 429s, tried 3 times in 4 s and failed the job ("High demand right now"). Now each engine account has a line here:
//  · new tasks leave at the pace the engine takes them (a little under its limit, so the owner's own tests still fit)
//  · a 429 anyway (another app on the same key, a lower limit, a request that arrived late) → that task goes back to the FRONT of
//    the line, the line pauses (0.5 s; 1 s, 2 s … 30 s while the engine keeps saying it, or what the engine says) and takes one
//    task less each window (never under half), then speeds up again by itself after 10 quiet seconds
//  · fair between customers: the next task is the oldest one of the customer served longest ago — one customer's 50 pictures
//    don't hold up everyone else
//  · a task that waits longer than LINE_MAX_MIN (20 min) fails with everything given back and says why
// The job shows its place ("in line · 12 ahead · about 10 s"). An engine without a pace set is not held at all.
import { AsyncLocalStorage } from "async_hooks";
import { S as platformS } from "./settings.js";
import { save } from "./store.js";

export const JOBCTX = new AsyncLocalStorage();   // the job whose task is being sent (set by jobs.js around start())
const LINES = new Map();
export const LINE_DEFAULT = { kie: "20/10" };     // (requests / seconds) — the engine's published limit
const MARGIN = 0.9;
const SKEW = (per) => Math.max(150, per * 0.1);   // a request can reach the engine a little later than it left — its window is counted that much longer
const maxWait = () => (+process.env.LINE_MAX_MIN || 20) * 60e3;

// the engine's limit: Admin (speed card) → env KIE_RATE="20/10" → the published default
export function paceOf(name) {
  const v = String((platformS().line124 || {})[name] || process.env[name.toUpperCase() + "_RATE"] || LINE_DEFAULT[name] || "").match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  return v && +v[1] > 0 && +v[2] > 0 ? { n: +v[1], per: +v[2] * 1000 } : null;
}
function lineOf(name) {
  let l = LINES.get(name);
  if (!l) { l = { name, q: [], stamps: [], pace: 0, cool: 0, back: 0, pausedAt: 0, last429: 0, served: new Map(), timer: null, sent: 0, r429: [], waits: [], expired: 0, maxAhead: 0 }; LINES.set(name, l); }
  return l;
}
const is429 = (e) => !!e && (e.status === 429 || e.status === 433 || /\b(429|433)\b/.test(String(e.message || "")));
export const LINE_MSG = { en: "So many people are creating right now that your turn didn't come within %m minutes — nothing was charged. Try again in a few minutes.",
  ar: "يصنع كثيرون الآن فلم يحن دورك خلال %m دقيقة — لم يُخصم شيء. حاول مجدداً بعد دقائق." };

// send fn() through the line of engine `name`; resolves with what fn returns
export function inLine(name, fn) {
  const conf = paceOf(name); if (!conf) return fn();
  const job = JOBCTX.getStore() || null, l = lineOf(name);
  return new Promise((resolve, reject) => {
    l.q.push({ fn, resolve, reject, t: Date.now(), owner: (job && job.owner) || "?", job, front: false });
    if (!l.timer) pump(l);   // (a pump is already due when the line is full or paused — the new task can't leave before it anyway)
  });
}
function pick(l) {
  let best = -1, bk = null;
  for (let i = 0; i < l.q.length; i++) { const e = l.q[i], k = e.front ? [0, e.t] : [1, l.served.get(e.owner) || 0, e.t];
    if (!bk || k[0] < bk[0] || (k[0] === bk[0] && (k[1] < bk[1] || (k[1] === bk[1] && k[2] < bk[2])))) { best = i; bk = k; } }
  return best;
}
function pump(l) {
  if (l.timer) { clearTimeout(l.timer); l.timer = null; }
  const conf = paceOf(l.name), now = Date.now();
  if (!conf) { const q = l.q.splice(0); q.forEach((e) => run(l, e)); return; }
  const full = Math.max(1, Math.floor(conf.n * MARGIN));
  if (!l.pace || l.pace > full) l.pace = full;
  if (l.pace < full && now - l.last429 > 10e3 && now - (l.raisedAt || 0) >= conf.per) { l.pace++; l.raisedAt = now; }   // 10 quiet seconds → one more each window
  l.stamps = l.stamps.filter((t) => now - t < conf.per + SKEW(conf.per));
  // too long in line → everything back, says why
  for (let i = l.q.length - 1; i >= 0; i--) { const e = l.q[i]; if (now - e.t > maxWait()) { l.q.splice(i, 1); l.expired++; clearMark(e); const m = Math.round(maxWait() / 60e3);
    e.reject(Object.assign(new Error("Waited too long in the engine's line"), { type: "rate", status: 429, retryable: false, noFallback: true, userMsg: LINE_MSG.en.replace("%m", m), userMsgAr: LINE_MSG.ar.replace("%m", m) })); } }
  while (l.q.length && now >= l.cool && l.stamps.length < l.pace) {
    const e = l.q.splice(pick(l), 1)[0]; l.stamps.push(now); l.served.set(e.owner, now); e.sentAt = now; run(l, e);
  }
  // the places of those still waiting (at most once a second — a long line isn't sorted on every arrival), and when the line moves next
  if (l.q.length && (now - (l.posAt || 0) >= 1000 || l.q.some((e) => e.job && !e.job.line))) {
    l.posAt = now; const per = conf.per / Math.max(1, l.pace), order = l.q.slice().sort((a, b) => (a.front !== b.front ? (a.front ? -1 : 1) : (l.served.get(a.owner) || 0) - (l.served.get(b.owner) || 0) || a.t - b.t));
    const start = Math.max(0, l.cool - now, l.stamps.length >= l.pace ? l.stamps[0] + conf.per + SKEW(conf.per) - now : 0);
    order.forEach((e, i) => { if (e.job) { if (e.job.stage !== "line") e.was = e.job.stage; e.job.stage = "line"; e.job.line = { ahead: i, sec: Math.ceil((start + i * per) / 1000) }; } });
  }
  if (l.q.length) {
    l.maxAhead = Math.max(l.maxAhead, l.q.length);
    const next = Math.max(50, l.cool - now, l.stamps.length >= l.pace ? l.stamps[0] + conf.per + SKEW(conf.per) - now + 5 : 50);
    l.timer = setTimeout(() => pump(l), next);   // (kept: while tasks wait, the process waits with them)
  }
}
// the job's own step comes back when it leaves the line (e.g. Motion Control's "the engine is making it")
function clearMark(e) { const job = e && e.job; if (!job) return; if (job.stage === "line") { if (e.was) job.stage = e.was; else delete job.stage; } delete job.line; }
function run(l, e) {
  clearMark(e);
  Promise.resolve().then(e.fn).then((v) => { l.sent++; l.back = 0; l.waits.push(Date.now() - e.t); if (l.waits.length > 200) l.waits.shift(); e.resolve(v); }, (err) => {
    if (!is429(err) || Date.now() - e.t > maxWait()) return e.reject(err);
    // the engine said "too many": back to the front, pause, slow down
    const now = Date.now(); l.r429.push(now); while (l.r429.length && now - l.r429[0] > 3600e3) l.r429.shift();
    const conf = paceOf(l.name), full = conf ? Math.max(1, Math.floor(conf.n * MARGIN)) : 1;
    l.last429 = now; l.pace = Math.max(Math.ceil(full / 2), (l.pace || full) - 1);
    const ra = +(String(err.retryAfter || "").match(/^\d+$/) || [0])[0] * 1000;
    // the pause grows only when the engine still says it after a pause — the requests already on their way when it first said it
    // (sent before that pause began) are put back in line without making the pause longer
    if (!(e.sentAt < l.pausedAt)) { l.back = Math.min(30e3, l.back ? l.back * 2 : 500); l.pausedAt = now; }   // (a send that works puts it back to 0.5 s)
    l.cool = Math.max(l.cool, now + Math.max(ra, l.back));
    e.front = true; l.q.unshift(e); pump(l);
  });
}
// the Admin speed card: how the line is doing
export function lineStats() {
  const out = {};
  for (const name of new Set([...Object.keys(LINE_DEFAULT), ...LINES.keys()])) {
    const l = lineOf(name), conf = paceOf(name), now = Date.now(), w = l.waits.slice().sort((a, b) => a - b);
    out[name] = { limit: conf ? conf.n + "/" + conf.per / 1000 : null, pace: l.pace || (conf ? Math.max(1, Math.floor(conf.n * MARGIN)) : null), waiting: l.q.length, maxWaiting: l.maxAhead,
      sent: l.sent, tooMany1h: l.r429.filter((t) => now - t < 3600e3).length, expired: l.expired, waitMedianSec: w.length ? Math.round(w[w.length >> 1] / 100) / 10 : null,
      waitMaxSec: w.length ? Math.round(w[w.length - 1] / 100) / 10 : null, pausedSec: l.cool > now ? Math.ceil((l.cool - now) / 1000) : 0 };
  }
  return out;
}
// Admin: the engine's limit (after the engine's support raises it): "40/10"
export function setPace(name, v) {
  if (name === "engine") name = "kie";   // (the browser calls the AI engine "engine")
  if (!LINE_DEFAULT[name]) throw Object.assign(new Error("Unknown engine"), { code: 400 });
  const s = String(v || "").trim(); if (s && !/^\d{1,4}\s*\/\s*\d{1,4}$/.test(s)) throw Object.assign(new Error("Write it as requests / seconds, e.g. 20/10"), { code: 400 });
  const all = (platformS().line124 = platformS().line124 || {}); if (s) all[name] = s.replace(/\s+/g, ""); else delete all[name];
  save(); const l = LINES.get(name); if (l) { l.pace = 0; pump(l); } return paceOf(name);
}
export const _lines = LINES;   // (tests)
