// Tiny JSON-file store. Swap for Postgres/Firestore when you scale.
import fs from "fs";
import path from "path";
const FILE = path.resolve("data/db.json");
let db = { users: {} };
try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
let t = null;
export function save() { clearTimeout(t); t = setTimeout(() => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE + ".tmp", JSON.stringify(db)); fs.renameSync(FILE + ".tmp", FILE); }, 200); }
// every account gets a permanent client ID (N-100001, N-100002…) the first time it is used
export function user(uid) { if (!db.users[uid]) db.users[uid] = { jobs: {}, posts: {}, accounts: {} }; const u = db.users[uid];
  if (!u.cid) { db.cidSeq = (db.cidSeq || 100000) + 1; u.cid = "N-" + db.cidSeq; save(); } return u; }
export function allUsers() { return Object.entries(db.users); }
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Platform-wide collections (settings, support tickets, audit log, sent emails)
export function col(key, def) { if (db[key] === undefined) db[key] = def; return db[key]; }
