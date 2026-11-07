// v251 — "no sound in the MiniMax videos": with "Everything on MiniMax" on, a video that asks for sound goes to Seedance (it makes
// sound itself), one without sound stays on MiniMax. Run: node tests/v251_route.mjs
import fs from "fs"; import os from "os"; import path from "path";
const D = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v251r-")); process.chdir(D); fs.mkdirSync("data"); fs.mkdirSync("media"); fs.writeFileSync("data/db.json", JSON.stringify({ users: {} }));
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
process.env.SEEDANCE_API_KEY = "bd"; process.env.MINIMAX_API_KEY = "mm"; process.env.MINIMAX_ALL = "1"; process.env.SECRET_KEY = "f".repeat(40);
const { adapterFor } = await import(ROOT + "/providers/extra.js"); const { PROVIDERS } = await import(ROOT + "/providers/index.js").catch(() => ({ PROVIDERS: {} }));
const k = (b) => adapterFor("video", { kind: "video", model: "auto", prompt: "a horse runs", dur: 5, ...b }, PROVIDERS || {}).key;
let bad = 0; const ok = (c, m, i) => { if (!c) { bad++; console.log("✗ " + m + " · " + JSON.stringify(i)); } };
ok(String(k({ meta: { audio: true } })).startsWith("bd@"), "a video with sound → Seedance (ByteDance)", k({ meta: { audio: true } }));
ok(String(k({ meta: {} })).startsWith("mm183"), "a silent video → MiniMax (Everything on MiniMax)", k({ meta: {} }));
fs.rmSync(D, { recursive: true, force: true }); if (bad) { console.log("v251 route FAIL"); process.exit(1); } console.log("v251 route OK");
