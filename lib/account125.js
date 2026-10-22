// v125: "Delete my account" — the customer removes their account and what they made, by themselves (GDPR's right to erasure,
// the app stores' rules). Typed confirmation ("DELETE" or "حذف"). What goes:
//  · the account record: profile, credits, plan time left (plans are prepaid periods — nothing renews by itself), jobs, social
//    connections and scheduled posts, API tokens, brand kit and everything else kept with it
//  · the files: every /media file the record points to (results, uploads, voices, posters…) that no one else uses
//  · their posts on Explore (and their likes), their support tickets, the sign-in account (when the server has the
//    Firebase service account)
//  · jobs still being made are cancelled: one still waiting in the engine's line is never sent, one the engine has is no longer
//    followed and its result isn't brought here
// What stays: invoices (kept on their own; tax law requires them) and gift codes already bought. Voices cloned at the voice
// engine are listed, without any name or email, for the owner to remove there (no standard way to delete them remotely).
import fs from "fs";
import path from "path";
import { user, allUsers, col, save, dropUser, hasUser } from "./store.js";
import { MEDIA_DIR } from "./media.js";
import { deleteAuthUser, markGone125 } from "./auth.js";

export const CONFIRM125 = ["DELETE", "حذف"];
const MEDIA_RE = /\/media\/([A-Za-z0-9][A-Za-z0-9._-]{0,200})/g;
const names = (text) => { const out = new Set(); for (const m of String(text).matchAll(MEDIA_RE)) out.add(m[1]); return out; };

export async function deleteAccount(uidv, confirm) {
  const c = String(confirm || "").trim();
  if (!CONFIRM125.includes(c.toUpperCase()) && !CONFIRM125.includes(c)) throw Object.assign(new Error('Type DELETE to confirm.'), { code: 400, errorAr: "اكتب حذف للتأكيد." });
  if (!hasUser(uidv)) throw Object.assign(new Error("There is no account to delete."), { code: 404, errorAr: "لا يوجد حساب لحذفه." });
  const u = user(uidv), out = { jobs: 0, files: 0, explore: 0, tickets: 0, signIn: false, voices: 0 };
  // jobs still being made: cancelled (never sent, no longer followed)
  for (const j of Object.values(u.jobs || {})) { out.jobs++; if (j.status === "queued" || j.status === "rendering") { j.status = "cancelled"; delete j.stage; delete j.line; } }
  // their Explore posts and likes, their tickets
  const ex = col("explore", []); for (let i = ex.length - 1; i >= 0; i--) { const x = ex[i]; if (x.uid === uidv) { ex.splice(i, 1); out.explore++; } else if (Array.isArray(x.likedBy) && x.likedBy.includes(uidv)) x.likedBy = x.likedBy.filter((k) => k !== uidv); }
  const tk = col("tickets", []); for (let i = tk.length - 1; i >= 0; i--) if (tk[i].uid === uidv) { tk.splice(i, 1); out.tickets++; }
  // voices cloned at the voice engine: their ids only, for the owner to remove there
  const voices = Object.values(u.jobs || {}).filter((j) => j.kind === "voiceclone" && j.status === "done").map((j) => j.voiceId || j.remoteVoice || j.url).filter(Boolean).map(String);
  out.voices = voices.length;
  // the files: everything the record points to, except what anyone else (or a shared list) still uses
  const mine = names(JSON.stringify(u)); for (const n of u.uploads || []) mine.add(path.basename(String(n)));   // (uploads are noted by their file name)
  dropUser(uidv);
  const kept = new Set();
  for (const [, o] of allUsers()) for (const n of names(JSON.stringify(o))) kept.add(n);
  for (const k of ["explore", "showcase", "worldcast", "tplprev", "gifts", "invoices"]) for (const n of names(JSON.stringify(col(k, k === "explore" ? [] : {})))) kept.add(n);
  for (const n of mine) { if (kept.has(n)) continue; try { fs.unlinkSync(path.join(MEDIA_DIR, path.basename(n))); out.files++; } catch {} }
  out.signIn = await deleteAuthUser(uidv);
  if (uidv !== "local") markGone125(uidv);
  col("deletions125", []).unshift({ t: Date.now(), jobs: out.jobs, files: out.files, ...(voices.length ? { engineVoices: voices.slice(0, 50) } : {}) });
  const d = col("deletions125", []); if (d.length > 500) d.length = 500;
  save(); return out;
}
// the uploads a customer makes are noted on the account from now on (before, only the jobs that used them pointed to them)
export function noteUpload(uidv, name) { const u = user(uidv); u.uploads = [name, ...(u.uploads || [])].slice(0, 5000); save(); }
