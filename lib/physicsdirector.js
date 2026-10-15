// Physics in the site's workflow (v86): when a video prompt describes something physical — a glass that falls and breaks, a ball
// that bounces, a stone thrown into water, a car braking on a wet road, a flag in the wind, someone tripping or jumping into a
// pool — MuJoCo (lib/physics.js, the same engine and material table as the 3D World) works out what really happens and one
// sentence with the measured numbers goes to the video engine with the prompt (visible in "What the AI received"). Free, at most
// ~2.5 s, and it never stops a job: no match, a slow engine, an answer that would contradict the words or an error just leave the
// prompt as it was. The sentence talks about "it" / "the person" so the engine draws what the client wrote, not our test objects.
import { jobHooks } from "./jobs.js";
import { featureOn } from "./settings.js";
import { simulateAsync, physicsReady } from "./physics.js";

const AR = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "");
// English whole words; Arabic words with their joined prefixes (و ف ب ل ك س, ال) but never from inside another word
const W = (en, ar) => new RegExp("(?:\\b(?:" + en + ")\\b" + (ar ? "|(?:^|[^\\u0600-\\u06FF])[وفبلكس]?(?:ال)?(?:" + AR(ar) + ")" : "") + ")", "i");
const has = (t, en, ar) => W(en, ar).test(t);
const NUM = (t, re) => { const m = t.match(re); return m ? +m[1] : null; };
const f1 = (x) => Math.round(x * 10) / 10;
// what it is made of: a named material first ("a plastic bottle" is plastic), then what the thing usually is
const MADE = [["glass", "glass", "زجاج|زجاجي"], ["metal", "metal|metallic|steel|iron|aluminium|aluminum", "معدن|معدني|حديد|فولاذ|المنيوم"], ["plastic", "plastic", "بلاستيك|بلاستيكي"],
  ["wood", "wood|wooden", "خشب|خشبي"], ["stone", "stone|rock|marble|brick", "حجر|صخره|صخر|رخام|طوب"], ["rubber", "rubber", "مطاط|مطاطي"], ["foam", "foam", "اسفنج"], ["ice", "ice", "جليد"]];
const THING = [["glass", "wine glass|vase|bottle|jar|window pane|mirror|plate|mug|lamp", "كاس|كوب|مزهريه|قاروره|مرايه|صحن|فنجان"], ["rubber", "ball|basketball|football|soccer ball|tennis ball", "كره|كوره|طابه"],
  ["metal", "coin|tin can|soda can|can of|spoon|wrench|pan|helmet", "عمله|علبه معدنيه|ملعقه|خوذه"], ["stone", "pebble", "حصاه"], ["wood", "log|crate|plank|chair", "جذع|كرسي"],
  ["plastic", "toy|bucket|cup", "لعبه|دلو"], ["foam", "pillow|cushion|sponge", "مخده|وساده|اسفنجه"], ["ice", "ice cube", "مكعب ثلج"]];
const firstOf = (t, list) => { for (const [k, en, ar] of list) if (has(t, en, ar)) return k; return null; };
const materialOf = (t) => firstOf(t, MADE) || firstOf(t, THING);
const SURF = [["wet", "wet|rain|rainy|puddles?", "مبلل|ممطر|مطر"], ["snow", "snow|snowy", "ثلج|ثلوج"], ["ice", "icy|ice road|frozen road|black ice", "جليد|متجمد"], ["gravel", "gravel|dirt road|desert|dunes?|sand", "حصي|ترابي|رمل|صحراء|كثبان"]];
const VEHICLE = ["cars?|truck|suv|jeep|sedan|vehicle|taxi|bus|van|pickup|sports car|race car", "سياره|سيارات|شاحنه|جيب|مركبه|تاكسي|باص|حافله"];
const PERSON = ["person|man|woman|boy|girl|child|kid|he|she|stuntman|stuntwoman|diver|climber|runner|skater|someone|player", "رجل|امراه|شخص|طفل|ولد|بنت|فتاه|شاب|بهلوان|غواص|متسلق|عداء|لاعب|احد"];
const INTO_WATER = "(?:in)?to (?:the |a )?(?:water|pool|sea|lake|river|ocean|pond)";

// the words → one MuJoCo scene (or nothing)
export function physicsFor(prompt) {
  const raw = String(prompt || ""), t = AR(raw).toLowerCase();
  if (/physical realism:/i.test(raw)) return null;
  const mph = NUM(t, /(\d{2,3})\s*mph\b/), kmh = NUM(t, /(\d{2,3})\s*(?:km\/?h|kph|كم)/) || (mph ? Math.round(mph * 1.609) : null);
  const h = NUM(t, /(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?|متر|مترا|امتار)(?![a-z؀-ۿ])/);
  const person = has(t, ...PERSON), surface = firstOf(t, SURF);
  if (has(t, ...VEHICLE)) {
    if (has(t, "brak(?:e|es|ed|ing)|skids?|skidding|stops? (?:suddenly|hard|short)|emergency stop", "يكبح|تكبح|فرامل|فرمل|تفرمل|يفرمل|توقف مفاجئ|تتوقف فجاه")) return { scene: "car", opts: { action: "brake", speed: kmh || 90, surface: surface || "asphalt" } };
    if (has(t, "jumps?|jumping|ramp|airborne|flies (?:off|over)", "تقفز|يقفز|قفزه|تطير")) return { scene: "car", opts: { action: "jump", speed: kmh || 80 } };
    if (has(t, "drift(?:s|ing)?|sharp (?:turn|bend|corner)|corners? (?:fast|hard)|takes? the (?:corner|bend)|hairpin", "درفت|تفحيط|تفحط|منعطف حاد|منعطف بسرعه")) return { scene: "car", opts: { action: "turn", speed: kmh || 70, surface: surface || "asphalt" } };
    if (has(t, "accelerat(?:e|es|ing)|full throttle|launch(?:es)? from|burnout|0 to 100", "تتسارع|تسارع|تنطلق بسرعه|انطلاق")) return { scene: "car", opts: { action: "accelerate", surface: surface || "asphalt" } };
    if (has(t, "boxes", "صناديق") && has(t, "crash(?:es)?|smash(?:es)?|drives?|plows?|through", "تصطدم|تخترق|تقتحم")) return { scene: "car", opts: { action: "crash", speed: kmh || 50, surface: surface || "asphalt" } };
    return null;
  }
  if ((person && has(t, "(?:jumps?|dives?|falls?|leaps?) " + INTO_WATER, "يقفز (?:في|الي) (?:الماء|المسبح|البحر|البحيره|النهر)|تقفز (?:في|الي) (?:الماء|المسبح|البحر)|يسقط في (?:الماء|المسبح|البحر)|تسقط في (?:الماء|المسبح|البحر)")) || has(t, "cannonball|high dive|dives? " + INTO_WATER, "يغطس|تغطس")) return { scene: "body", opts: { action: "water", height: h || 3 } };
  if (person && has(t, "trips? (?:over|on)|tripping|stumbles?|stumbling|slips? (?:on|and falls)|loses (?:his|her|their) (?:footing|balance)", "يتعثر|تتعثر|يتزحلق|تتزحلق|يفقد توازنه|تفقد توازنها")) return { scene: "body", opts: { action: "trip", surface: surface === "ice" ? "ice" : "concrete" } };
  if (has(t, "(?:is|gets|was|being) (?:pushed|shoved)|(?:pushes|shoves) (?:him|her|them|the man|the woman|the boy|the girl|someone)(?: over| down| away| back)?", "يدفعه|يدفعها|تدفعه|تدفعها|يتعرض لدفعه")) return { scene: "body", opts: { action: "push", strength: has(t, "hard|strong|violent", "بقوه|قويه") ? "strong" : "medium" } };
  if ((person && has(t, "(?:falls?|tumbles?|drops?) (?:off|from|down)", "يسقط من|تسقط من|سقط من|سقطت من|يقع من|تقع من")) || has(t, "falls? (?:off|from) (?:the |a )?(?:roof|wall|ledge|building|cliff|balcony|tree|ladder|stage|bridge)", "")) return { scene: "body", opts: { action: "fall", height: h || 3 } };
  if (has(t, "flags?|banner|cloth|curtains?|sail|scarf|cape", "علم|رايه|قماش|ستاره|شراع|وشاح") && has(t, "wind|windy|breeze|waving|waves in|flutter(?:s|ing)?|storm|gusts?", "رياح|ريح|يرفرف|ترفرف|نسيم|عاصفه")) return { scene: "air", opts: { mode: "flag", wind: has(t, "strong|storm|gale|stormy", "قويه|قوي|عاصفه") ? 16 : 8 } };
  if (has(t, "paper|leaf|leaves|feather|petals?|napkin", "ورقه|ورق|ريشه|بتلات|منديل") && has(t, "falls?|falling|drops?|floats? down|drifts? down|flutters? down|glides? down", "تسقط|يسقط|تتساقط|تتطاير|يتطاير|تنزل")) return { scene: "air", opts: { mode: "paper", wind: 2, height: h || 3 } };
  const mat = materialOf(t); if (!mat) return null;
  if (has(t, "(?:thrown|tossed|dropped|drops|falls?|lands?|skims?|plunges?) " + INTO_WATER + "|sinks?|sinking|floats? (?:on|in)", "يرمي في|ترمي في|يسقط في|تسقط في|يغرق|تغرق|يطفو|تطفو")) return { scene: "water", opts: { items: [mat === "rubber" ? "foam" : mat], height: h || 1.5 } };
  if (has(t, "falls?|falling|drops?|dropped|knocked off|tips? over|shatters?|breaks?|smash(?:es)?|bounces?|bouncing|thrown|tossed|kicked", "يسقط|تسقط|يقع|تقع|ينكسر|تنكسر|يتحطم|تتحطم|يرتد|ترتد|يرمي|ترمي|يركل")) {
    const surface = has(t, "grass|lawn|field", "عشب|حشيش") ? "grass" : has(t, "wooden floor|parquet|hardwood", "ارضيه خشبيه|باركيه") ? "wood" : has(t, "sand|beach", "رمل|شاطئ") ? "sand" : has(t, "snow", "ثلج") ? "snow" : "concrete";
    const small = has(t, "wine glass|glass of|cup|mug|bottle|jar|coin|can|ice cube|egg|phone|vase", "كاس|كوب|فنجان|قاروره|عمله|مكعب ثلج|بيضه|جوال|مزهريه");
    return { scene: "objects", opts: { material: mat, shape: mat === "rubber" || mat === "stone" || mat === "metal" ? "ball" : "box", size: mat === "rubber" ? 0.11 : small ? 0.05 : 0.15,
      height: h || (has(t, "table|counter|shelf|desk", "طاوله|رف|مكتب") ? 0.9 : 1.5), throw: has(t, "thrown|tossed|kicked", "يرمي|ترمي|يركل") ? 6 : 0, surface } };
  }
  return null;
}

// what was measured → one sentence for the engine (and the same in Arabic for the page). null when the result would contradict
// what the client wrote ("it floats" but it sinks, "it shatters" but it held) — then the prompt stays as written.
const FLOOR = { concrete: ["the hard floor", "الأرض الصلبة"], grass: ["the grass", "العشب"], wood: ["the wooden floor", "الأرضية الخشبية"], sand: ["the sand", "الرمل"], snow: ["the snow", "الثلج"] };
const PART = { hip: ["hip", "الورك"], back: ["back", "الظهر"], head: ["head", "الرأس"], arm: ["arm", "الذراع"], hand: ["hands", "اليدان"], leg: ["leg", "الساق"] };
const times = (n) => [n === 1 ? "once" : n === 2 ? "twice" : n + " times", n === 1 ? "مرة" : n === 2 ? "مرتين" : n + " مرات"];
export function sentenceFor(want, r, prompt) {
  const f = (r && r.facts) || {}, t = AR(prompt).toLowerCase(), act = want.opts.action || want.opts.mode;
  if (want.scene === "objects") {
    const brk = has(t, "shatters?|breaks?|smash(?:es)?|cracks?", "ينكسر|تنكسر|يتحطم|تتحطم|يتكسر|تتكسر|يتهشم|تتهشم"), keep = has(t, "without breaking|doesn'?t break|does not break|survives|intact|unbroken|lands safely", "دون ان ينكسر|بدون ان ينكسر|لا ينكسر|لا تنكسر|سليم|سليمه");
    if ((brk && !f.broke) || (keep && f.broke) || !f.impact) return null;
    const S = FLOOR[f.surface] || FLOOR.concrete, n = f.bounces, cm = Math.round((f.bounceHeight || 0) * 100);
    return [`${f.throw ? `It flies through the air and hits ${S[0]}` : `It falls ${f1(f.height)} m in ${f.fallTime} s and hits ${S[0]}`} at ${f.impact} m/s${f.broke ? ", then shatters into sharp pieces that skid and spin apart" : n ? `, bounces ${times(n)[0]} (up to ${cm} cm) and then ${f.shape === "ball" ? "rolls to a stop" : "settles"}` : ", lands with a dull thud and stays down"} — real weight and momentum, nothing floats.`,
      `${f.throw ? `يطير في الهواء ويرتطم ب${S[1]}` : `يسقط ${f1(f.height)} م خلال ${f.fallTime} ث ويرتطم ب${S[1]}`} بسرعة ${f.impact} م/ث${f.broke ? "، ثم يتحطم إلى قطع حادة تنزلق وتدور متفرقة" : n ? `، ويرتد ${times(n)[1]} (حتى ${cm} سم) ثم ${f.shape === "ball" ? "يتدحرج ويتوقف" : "يستقر"}` : "، ويستقر بصوت مكتوم"} — وزن وزخم حقيقيان بلا طفو.`];
  }
  if (want.scene === "water") {
    const it = (f.items || [])[0]; if (!it) return null;
    if ((has(t, "floats?|floating|bobs?", "يطفو|تطفو|طافي|طافيه") && !it.floats) || (has(t, "sinks?|sinking|goes under|to the bottom", "يغرق|تغرق|القاع") && it.floats)) return null;
    const end = it.floats ? (it.under > 85 ? ["floats almost fully under the surface", "يطفو وهو مغمور كله تقريباً"] : [`bobs back up and floats with about ${100 - it.under}% above the water`, `يعود إلى السطح ويطفو وحوالي ${100 - it.under}% منه فوق الماء`]) : ["sinks straight down, slowing quickly in the water", "يغوص مباشرة إلى القاع ويتباطأ بسرعة في الماء"];
    return [`It hits the water at ${f.entrySpeed} m/s with a crown-shaped splash and rings spreading across the surface, then ${end[0]} — real weight and buoyancy.`, `يرتطم بالماء بسرعة ${f.entrySpeed} م/ث مع رذاذ على شكل تاج ودوائر تنتشر على السطح، ثم ${end[1]} — وزن وطفو حقيقيان.`];
  }
  if (want.scene === "car" && act === "turn" && has(t, "drift(?:s|ing)?|slides?|sliding", "درفت|تفحيط|تفحط|ينزلق|تنزلق") && !f.slid) return null;   // they asked for a slide
  if (want.scene === "air" && act === "paper") return [`It catches the air, swings from side to side and glides down slowly, taking about ${f.paper || "more than 6"} s to come down ${f1(f.height || 3)} m — light things drift, they never drop straight.`, `تمسك بالهواء وتتأرجح يميناً ويساراً وتنزل ببطء، فتستغرق نحو ${f.paper || "أكثر من 6"} ث لتنزل ${f1(f.height || 3)} م.`];
  if (want.scene === "body" && (act === "trip" || act === "fall" || act === "water")) {
    const P = PART[f.first] || ["side", "الجنب"];
    if (act === "trip") return [`The person trips mid-stride: the upper body keeps going, the hands reach out and the first thing to hit the ground is the ${P[0]}, after ${f.ground || "-"} s at ${f.impact || "-"} m/s — one real weight, the arms swing out late.`, `يتعثر الشخص أثناء المشي: يواصل الجزء العلوي حركته وتمتد اليدان، وأول ما يلمس الأرض ${P[1]} بعد ${f.ground || "-"} ث بسرعة ${f.impact || "-"} م/ث.`];
    if (act === "water") { const deep = f.deepest != null ? Math.round(-f.deepest * 10) / 10 : null;
      return [`The person drops ${f1(f.height)} m into the water, enters at ${f.splash || "-"} m/s with a big splash${deep ? `, goes about ${deep} m under` : ""} and slows fast before coming back up.`, `يسقط الشخص ${f1(f.height)} م في الماء ويدخله بسرعة ${f.splash || "-"} م/ث مع رذاذ كبير${deep ? `، ويغوص نحو ${deep} م` : ""} ويتباطأ بسرعة ثم يصعد.`]; }
    return [`The person drops ${f1(f.height)} m: ${f.fallTime} s in the air, lands at ${f.landSpeed || "-"} m/s and the knees and hips fold to soak up the hit${f.first ? `, then the ${P[0]} goes down too` : ""}.`, `يسقط الشخص ${f1(f.height)} م: ${f.fallTime} ث في الهواء، ويهبط بسرعة ${f.landSpeed || "-"} م/ث وتنثني الركبتان والوركان لامتصاص الصدمة${f.first ? `، ويلمس الأرض بعدها ${P[1]} أيضاً` : ""}.`];
  }
  return r && r.words && r.words.en ? [r.words.en, r.words.ar] : null;   // car, flag, push: the scene's own sentence
}
// a video engine needs "66 m" and "4.8 s", not "65.988 m"
const tidy = (s) => s && s.map((x) => String(x).replace(/\d+\.\d{2,}/g, (m) => String(Math.round(parseFloat(m) * 10) / 10)));

// the same scene with the same numbers always gives the same answer: keep the last few (a retry or a remake is instant)
const memo = new Map(); let inflight = 0;
function measure(want) {
  const key = JSON.stringify(want); if (memo.has(key)) return Promise.resolve(memo.get(key));
  if (inflight >= 2) return Promise.resolve(null);      // busy: a video never waits in line behind other simulations
  inflight++;
  // the job waits at most 2.5 s; the run itself may finish later (it is remembered for next time) — a short limit on the run
  // would stop the shared worker and with it someone's simulation on the World page or from ChatGPT / Claude
  const run = simulateAsync(want.scene, want.opts, 20000).then((r) => { memo.set(key, r); if (memo.size > 60) memo.delete(memo.keys().next().value); return r; }).finally(() => { inflight--; });
  run.catch(() => {});
  return Promise.race([run, new Promise((ok) => setTimeout(() => ok(null), 2500))]);
}

// before routing: add what really happens to a video's prompt
jobHooks.before.push(async (u, body) => {
  if (!["video", "chapter"].includes(body.kind) || body.meta?.noPhysics || !physicsReady() || !featureOn("physics")) return;
  const want = physicsFor(body.prompt); if (!want) return;
  try {
    const r = await measure(want), s = r && tidy(sentenceFor(want, r, body.prompt));
    if (!s) return;
    if (!body.title) body.title = String(body.prompt || "").trim();   // the library keeps the client's words as the title
    body.prompt = `${String(body.prompt || "").trim()}\n\nPhysical realism: ${s[0]}`;
    body.meta = { ...(body.meta || {}), physics: { scene: want.scene, action: want.opts.action || want.opts.mode || null, facts: r.facts, sentence: s[0], sentence_ar: s[1] } };
  } catch (e) { /* the job goes ahead as it was */ }
});
// the cloth scenes take ~3 s: work out the two flag winds once, a minute after start, so the first flag video gets them too
if (physicsReady()) setTimeout(() => { simulateAsync("air", { mode: "flag", wind: 8 }, 20000).then((r) => { memo.set(JSON.stringify({ scene: "air", opts: { mode: "flag", wind: 8 } }), r); return simulateAsync("air", { mode: "flag", wind: 16 }, 20000); })
  .then((r) => memo.set(JSON.stringify({ scene: "air", opts: { mode: "flag", wind: 16 } }), r)).catch(() => {}); }, 60000).unref();
