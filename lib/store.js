// Tiny JSON-file store. Swap for Postgres/Firestore when you scale.
import fs from "fs";
import path from "path";
const FILE = path.resolve("data/db.json");
let db = { users: {} };
try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
// v110: saving writes the whole file. The text is made at once (the server waits for that — the Admin speed card shows how
// long), the disk write runs in the background. Under constant changes it still saves at least every 2 s (before, every new
// change pushed the save back again). A stop (an update, a restart) saves what is in memory first.
let t = null, first = 0, writing = false, again = false;
export const SAVES = { n: 0, last: [], bytes: 0 };
function flush() {
  t = null; first = 0; if (writing) { again = true; return; }
  const t0 = Date.now(); let s; try { s = JSON.stringify(db); } catch (e) { console.warn("save:", e.message); return; }
  SAVES.n++; SAVES.bytes = s.length; SAVES.last.push(Date.now() - t0); if (SAVES.last.length > 50) SAVES.last.shift();
  writing = true;
  fs.promises.mkdir(path.dirname(FILE), { recursive: true }).then(() => fs.promises.writeFile(FILE + ".tmp", s)).then(() => fs.promises.rename(FILE + ".tmp", FILE))
    .catch((e) => console.warn("save:", e.message)).finally(() => { writing = false; if (again) { again = false; save(); } });
}
export function save() { const now = Date.now(); if (!first) first = now; clearTimeout(t); t = setTimeout(flush, now - first >= 2000 ? 0 : 200); }
export function saveNow() { if (!t && !again && !writing) return; clearTimeout(t); t = null;
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE + ".stop.tmp", JSON.stringify(db)); fs.renameSync(FILE + ".stop.tmp", FILE); } catch (e) { console.warn("save:", e.message); } }
for (const sig of ["SIGTERM", "SIGINT"]) process.once(sig, () => { saveNow(); process.exit(0); });
// every account gets a permanent client ID (N-100001, N-100002…) the first time it is used
export function user(uid) { if (!db.users[uid]) db.users[uid] = { jobs: {}, posts: {}, accounts: {} }; const u = db.users[uid];
  if (!u.cid) { db.cidSeq = (db.cidSeq || 100000) + 1; u.cid = "N-" + db.cidSeq; save(); } return u; }
export function allUsers() { return Object.entries(db.users); }
// v125: is there such a customer (without making one, as user() does) · remove a customer (Delete my account)
export const hasUser = (uid) => Object.prototype.hasOwnProperty.call(db.users, uid);
export function dropUser(uid) { delete db.users[uid]; save(); }
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Platform-wide collections (settings, support tickets, audit log, sent emails)
export function col(key, def) { if (db[key] === undefined) db[key] = def; return db[key]; }
