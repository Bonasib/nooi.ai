// v86: physics inside the site's workflow (lib/physicsdirector.js). A video prompt that describes something physical gets one
// measured MuJoCo sentence; everything else is left alone. Checks: what is recognised (English + Arabic, and the look-alikes that
// must not be: "falls in love", "a trip to Paris", "drifting leaves", "he pushed the cart", "معلم"), the sentence never names our
// test objects, it never contradicts the client's words, numbers are rounded, the hook only touches videos, runs once, respects
// noPhysics, keeps the client's words as the title, and the job API shows the line in both languages.
process.chdir(new URL("..", import.meta.url).pathname);
const { physicsFor, sentenceFor } = await import("../lib/physicsdirector.js");
const { jobHooks, publicJob } = await import("../lib/jobs.js");
const { physicsReady, simulateAsync } = await import("../lib/physics.js");
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };

const CASES = [
  ["A wine glass falls off the kitchen table and shatters on the tiles", "objects"], ["كأس زجاج يسقط من الطاولة وينكسر على البلاط", "objects"],
  ["A red sports car brakes hard at 120 km/h on a wet road", "car"], ["سيارة تفرمل فجأة على طريق ممطر بسرعة ١٠٠ كم", "car"],
  ["a boy jumps into the pool from 5 m", "body"], ["طفل يقفز في المسبح من ارتفاع 4 متر", "body"],
  ["a flag waving in a strong wind on a castle", "air"], ["علم يرفرف في رياح قوية فوق القلعة", "air"],
  ["a basketball bounces on the court", "objects"], ["a stone is thrown into the lake", "water"], ["a man trips on the icy sidewalk", "body"],
  ["رجل يتعثر في الشارع", "body"], ["a sheet of paper falls slowly from the balcony", "air"], ["a woman falls from the roof", "body"],
  ["a plastic bottle falls off the desk", "objects"], ["a drifting car on a mountain road at 90 km/h", "car"], ["تفحيط سيارة في الصحراء", "car"],
  ["a cat sleeping on a sofa", null], ["قطة نائمة على الكنبة", null], ["a car crashes into a wall at 60 km/h", null], ["sunset over the desert dunes", null],
  ["she falls in love in Paris", null], ["a family trip to the beach at sunset", null], ["autumn leaves drifting in the wind", null], ["a man can jump very high", null],
  ["he pushed the cart through the market", null], ["a teacher writes on the board while the wind blows", null], ["معلم يشرح الدرس والرياح تهب", null],
  ["waves splash on the rocks", null], ["a horse stops suddenly in the desert", null], ["الطفل يدفع العربة", null]
];
let recognised = 0;
for (const [p, want] of CASES) { const r = physicsFor(p); ok((r ? r.scene : null) === want, `"${p}" → ${r ? r.scene : "nothing"} (expected ${want || "nothing"})`); if (r && want) recognised++; }
ok(physicsFor("a glass falls\n\nPhysical realism: It falls 1 m") === null, "a prompt that already has the line is left alone");
ok(physicsFor("a plastic bottle falls off the desk").opts.material === "plastic", "a named material wins over the usual one (plastic bottle)");
ok(physicsFor("A red sports car brakes hard at 75 mph").opts.speed === 121, "mph is turned into km/h");

// what the hook adds (needs the MuJoCo package; the server installs it with npm install)
const out = {};
if (physicsReady()) {
  const run = async (b) => { for (const f of jobHooks.before) await f({ uid: "t" }, b); return b; };
  const glass = await run({ kind: "video", prompt: "A wine glass falls off the kitchen table and shatters on the tiles" });
  const line = glass.prompt.split("\n\nPhysical realism: ")[1] || "";
  out.glass = line;
  ok(/^It falls 0\.9 m in 0\.4 s and hits the hard floor at \d+(\.\d)? m\/s, then shatters/.test(line), "glass: measured fall + shatter, rounded numbers: " + line);
  ok(!/block|cylinder|cardboard|\d\.\d{2,}/.test(line), "glass: no test objects or long decimals in the sentence");
  ok(glass.title === "A wine glass falls off the kitchen table and shatters on the tiles", "the title keeps the client's words");
  ok(glass.meta.physics && glass.meta.physics.scene === "objects" && /يتحطم/.test(glass.meta.physics.sentence_ar), "meta keeps the scene and the Arabic sentence");
  const pj = publicJob({ id: "x", payload: glass, status: "done" });
  ok(pj.physics && pj.physics.en === line && /يتحطم/.test(pj.physics.ar), "the job API shows the line in both languages");
  const again = await run({ kind: "video", prompt: glass.prompt });
  ok((again.prompt.match(/Physical realism/g) || []).length === 1, "never added twice");
  const t0 = Date.now(); await run({ kind: "video", prompt: "A wine glass falls off the kitchen table and shatters on the tiles" }); out.cachedMs = Date.now() - t0;
  ok(out.cachedMs < 200, "the same scene again comes from memory (" + out.cachedMs + " ms)");
  const car = await run({ kind: "video", prompt: "سيارة تفرمل فجأة على طريق ممطر بسرعة ١٠٠ كم" }); out.car = car.prompt.split("\n\n")[1];
  ok(/brakes hard from 100 km\/h on wet asphalt/.test(car.prompt) && !/\d\.\d{2,}/.test(out.car), "Arabic car braking → English measured sentence for the engine");
  const cat = await run({ kind: "video", prompt: "a cat sleeping on a sofa" }); ok(cat.prompt === "a cat sleeping on a sofa" && !cat.meta, "nothing physical → untouched");
  const img = await run({ kind: "image", prompt: "a glass falls and breaks" }); ok(!/Physical realism/.test(img.prompt), "pictures are untouched");
  const off = await run({ kind: "video", prompt: "a flag waving in a strong wind", meta: { noPhysics: true } }); ok(!/Physical realism/.test(off.prompt), "noPhysics is respected");
  // never contradicts the client: "floats" but glass sinks, "without breaking" but it would break, "drifting" but the tyres hold
  for (const p of ["a bottle floats on the sea", "a glass falls on the carpet without breaking"]) { const b = await run({ kind: "video", prompt: p }); ok(!/Physical realism/.test(b.prompt), "no contradiction: " + p); }
  const pool = await run({ kind: "video", prompt: "a boy jumps into the pool from 5 m" }); out.pool = pool.prompt.split("\n\n")[1];
  ok(/coming back up/.test(pool.prompt), "a person in the pool comes back up");
  const ball = physicsFor("a basketball bounces on the court"), br = await simulateAsync(ball.scene, ball.opts), bs = sentenceFor(ball, br, "a basketball bounces on the court");
  ok(bs && /bounces (once|twice|\d+ times)/.test(bs[0]) && /rolls to a stop/.test(bs[0]), "a ball bounces and rolls: " + (bs && bs[0]));
} else out.skipped = "MuJoCo is not installed here";
console.log(JSON.stringify({ recognised, cases: CASES.length, ...out, fails }, null, 1));
process.exit(fails.length ? 1 : 0);
