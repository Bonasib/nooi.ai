// v239 — Replace faces (server side): the analysis gives every person a face picture (from the face box the agents gave, or guessed
// from the top of the person's box), a list made before v239 gets its faces without asking the agents again, a face-only change
// says only the face changes, and why MiniMax didn't take over a job the engine refused for its balance (staff line).
// A mocked vision AI, no real key. Run: node tests/v239_faces.mjs
import fs from "fs"; import os from "os"; import path from "path"; import url from "url"; import { execFileSync } from "child_process";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const D = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v239-")); fs.mkdirSync(D + "/data"); fs.mkdirSync(D + "/media"); fs.writeFileSync(D + "/data/db.json", '{"users":{}}'); process.chdir(D);
for (const k of Object.keys(process.env)) if (/^(LLM_|ANTHROPIC_|NVIDIA_|KIE_|FAL_|MINIMAX_|OPENAI_)/.test(k)) delete process.env[k];
process.env.SECRET_KEY = "t".repeat(40); process.env.LLM_API_KEY = "sk-other-test"; process.env.PUBLIC_BASE_URL = "https://nooi.test"; process.env.NV_AUTOCHECK = "false";
let pass = 0, fail = 0; const ok = (c, m, info) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || info === undefined ? "" : " · " + JSON.stringify(info).slice(0, 500))); };
const MEDIA = path.join(D, "media");
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k", MEDIA + "/two.webm"]);
const S = await import(ROOT + "/lib/scan136.js");
const R = await import(ROOT + "/lib/replace136.js");
const MM = await import(ROOT + "/providers/minimax183.js");
const st = await import(ROOT + "/lib/settings.js");

// ---- the face box
const g = S.faceBox239({ face: [0.2, 0.1, 0.1, 0.15] }, [0.1, 0.05, 0.3, 0.9]);
ok(g && !g.guess && g.box.join() === "0.2,0.1,0.1,0.15", "the agents' face box is used", g);
const g2 = S.faceBox239({ face_2d: [100, 200, 250, 300] }, null);
ok(g2 && !g2.guess && Math.abs(g2.box[0] - 0.2) < 0.01 && Math.abs(g2.box[1] - 0.1) < 0.01, "a Gemini-style face_2d box is read too", g2);
const g3 = S.faceBox239({}, [0.5, 0.1, 0.2, 0.8]);
ok(g3 && g3.guess && g3.box[1] < 0.2 && g3.box[0] > 0.5 && g3.box[0] < 0.6, "no face box → guessed from the top of the person", g3);
ok(S.faceBox239({}, null) === null, "no box at all → no face");

// ---- the analysis with faces (a mocked vision AI)
let asked = "";
globalThis.fetch = async (u, o = {}) => { const b = o.body ? JSON.parse(o.body) : {}; asked = JSON.stringify(b);
  const items = [{ kind: "person", name: "the man on the left", en: "a man in a grey shirt", frames: [0, 1, 2, 3], best: 1, box: [0.05, 0.1, 0.3, 0.85], face: [0.12, 0.12, 0.12, 0.2] },
    { kind: "person", name: "the woman on the right", en: "a woman in a red coat", frames: [1, 2], best: 2, box: [0.6, 0.15, 0.3, 0.8] },
    { kind: "object", name: "a cup", en: "a white cup", frames: [0], best: 0, box: [0.45, 0.6, 0.1, 0.1] }];
  const body = { content: [{ type: "text", text: JSON.stringify({ scene: "two people", items }) }] };
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body }; };
const sc = await S.scan136(MEDIA + "/two.webm", { lang: "en" });
const ppl = sc.items.filter((i) => i.kind === "person");
ok(/face/.test(asked) && /Two different people are two items/.test(asked), "the agents are asked for every person's face box");
ok(ppl.length === 2 && ppl.every((i) => i.face && fs.existsSync(path.join(MEDIA, path.basename(i.face)))), "every person has a face picture on the server", ppl.map((i) => i.face));
ok(!ppl[0].faceGuess && ppl[1].faceGuess === true, "the first from the agents' face box, the second guessed", ppl.map((i) => i.faceGuess));
const dims = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path.join(MEDIA, path.basename(ppl[0].face))]).toString().trim();
ok(dims === "192,192", "a face picture is square, 192 px", dims);
ok(!sc.items.find((i) => i.kind === "object").face, "things have no face");
// ---- a list made before v239: its faces are added from the frames already on the server, the agents aren't asked again
const cache = S.scanCache136(MEDIA + "/two.webm", "en"), old = JSON.parse(fs.readFileSync(cache, "utf8"));
for (const i of old.items) { delete i.face; delete i.faceBox; delete i.faceGuess; } fs.writeFileSync(cache, JSON.stringify(old));
for (const f of fs.readdirSync(MEDIA)) if (/\.face\.jpg$/.test(f)) fs.unlinkSync(path.join(MEDIA, f));
let calls = 0; globalThis.fetch = async () => { calls++; throw new Error("not asked"); };
const sc2 = await S.scan136(MEDIA + "/two.webm", { lang: "en" });
ok(calls === 0 && sc2.items.filter((i) => i.kind === "person").every((i) => i.face && fs.existsSync(path.join(MEDIA, path.basename(i.face)))), "an older list gets its faces without asking the agents again", { calls });
ok(JSON.parse(fs.readFileSync(cache, "utf8")).items.filter((i) => i.face).length === 2, "…and they are kept with the list");

// ---- the words: only the face changes
const man = ppl[0], w = R.visualWords136({ changes: [{ it: man, c: { face: true, pic: "/media/f.jpg" }, pic: 1 }, { it: ppl[1], c: { face: true, pic: "/media/g.jpg", char: { name: "Sara", look: "" } }, pic: 2 }] });
ok(/Give a man in a grey shirt.*the face of the person in @Image1/.test(w) && /Only the face changes/.test(w) && /lip movement/.test(w) && /Every other person keeps their own face/.test(w), "a face-only change says only the face changes, the movement and lips stay", w.slice(0, 400));
ok(/@Image2 \(Sara\)/.test(w), "a character's face is named with its picture");
const wi = R.visualWords136({ changes: [{ it: man, c: { face: true, pic: "/media/f.jpg" }, pic: 2 }], image: true });
ok(/picture 2/.test(wi) && /same head position/.test(wi), "in a picture: the face from picture 2, the same head position");

// ---- why MiniMax didn't take over (staff)
ok(/no MiniMax key/.test(MM.mmWhyNot239("video", { kind: "video", model: "seedance" })), "no key → said");
process.env.MINIMAX_API_KEY = "mm-test-key-000";
ok(MM.mmWhyNot239("video", { kind: "video", model: "seedance" }) === "", "a plain video with the key → nothing to explain (MiniMax takes it)");
ok(/Replace things/.test(MM.mmWhyNot239("video", { kind: "video", meta: { replace136: {} } })), "Replace things → it needs the AI engine's balance");
ok(/Character Swap/.test(MM.mmWhyNot239("video", { kind: "video", model: "mcswap" })), "a Character Swap → it needs the AI engine's balance");
ok(/starts from a video/.test(MM.mmWhyNot239("video", { kind: "video", inputs: { vIn: "/media/a.mp4" } })), "a job from a video → said");
MM.mmState183().video = false; ok(/video switch is off/.test(MM.mmWhyNot239("video", { kind: "video", model: "kling30" })), "the video switch off → said");
MM.mmState183().video = true; delete process.env.MINIMAX_API_KEY; void st;

fs.rmSync(D, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log("v239 faces FAIL"); process.exit(1); } console.log("v239 faces OK");
