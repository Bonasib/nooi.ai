// nooi.ai · 3D Studio — the organiser. It reads what you ask for (English or Arabic), splits it into steps and, for every step,
// lists each technique that can do it with WHERE it runs (this device's GPU / CPU, NVIDIA's cloud, nooi credits) and what it
// costs — then picks the best one this device and this account can use. The steps feed each other: the selection mask goes to
// the depth model AND to the cloud engines as a clean cut-out; the world's sky lights the object; the walk becomes a video.
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩", toLatin = (s) => s.replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d)).replace(/[،]/g, ",");
const has = (t, re) => re.test(t);
export const SUBJECTS = [
  ["suv", /\b(suv|escalade|jeep|truck|pick-?up|land ?cruiser|g-?class|4x4)\b|جيب|دفع رباعي|شاحنة|إسكاليد|اسكاليد/i, "car"],
  ["vehicle", /\b(car|vehicle|sedan|coupe|automobile|taxi|motor ?bike|motorcycle|bike|van|bus)\b|سيار|عربي|مركبة|دراجة/i, "car"],
  ["person", /\b(person|man|woman|girl|boy|people|kid|child|me|myself|model)\b|شخص|رجل|امرأة|إمرأة|ولد|بنت|طفل|صورتي/i, "person"],
  ["animal", /\b(dog|cat|horse|camel|bird|animal|lion|tiger|cow|sheep)\b|كلب|قط|حصان|جمل|طائر|حيوان|أسد|نمر|بقرة|خروف/i, "animal"],
  ["chair", /\b(chair|stool|armchair)\b|كرسي/i, "chair"], ["table", /\b(table|desk)\b|طاولة|مكتب/i, "table"], ["sofa", /\b(sofa|couch)\b|كنبة|أريكة/i, "sofa"],
  ["plant", /\b(plant|flower|pot|cactus)\b|نبتة|نبات|زهرة|وردة|صبار/i, "plant"], ["tree", /\b(tree)\b|شجرة/i, "tree"], ["statue", /\b(statue|sculpture)\b|تمثال|منحوتة/i, "statue"],
  ["building", /\b(building|house|villa|tower|tent|kiosk)\b|مبنى|بيت|منزل|فيلا|برج|خيمة|كشك/i, "building"],
  ["product", /\b(bottle|shoe|sneaker|bag|perfume|watch|phone|product|cup|mug|box)\b|زجاجة|حذاء|حقيبة|عطر|ساعة|هاتف|منتج|كوب|علبة/i, "product"],
];
export const BIOME_WORDS = [
  ["rainforest", /\b(rain ?forest|jungle|tropical|amazon)\b|مطير|أدغال|ادغال|استوائي|الأمازون/i], ["snow", /\b(snow|snowy|winter|arctic|alps)\b|ثلج|ثلوج|شتاء|جليد/i],
  ["desert", /\b(desert|dune|dunes|sahara|sand)\b|صحراء|كثبان|رمال/i], ["beach", /\b(beach|sea|ocean|shore|coast|island)\b|شاطئ|بحر|ساحل|جزيرة/i],
  ["meadow", /\b(meadow|field|grass|park|garden|prairie)\b|مرج|حقل|عشب|حديقة|منتزه/i], ["studio", /\b(showroom|studio|garage|gallery|exhibition)\b|صالة عرض|معرض|استوديو|كراج/i],
  ["forest", /\b(forest|woods|woodland|pines?)\b|غابة|غابات|صنوبر/i],
];
// what the person asked for → intent
export function parsePrompt(text) {
  const t = toLatin(String(text || "")), o = { text: t, subject: null, category: null, biome: null, size: null, tod: null, fx: {}, walk: false, record: false, place: "center" };
  for (const [cat, re, label] of SUBJECTS) if (has(t, re)) { o.category = cat; const m = t.match(re); // the whole word the match sits in ("سيار" → "السيارة")
    let a = m.index, b = m.index + m[0].length; while (a > 0 && !/\s/.test(t[a - 1])) a--; while (b < t.length && !/[\s،,.]/.test(t[b])) b++; o.subject = (t.slice(a, b).trim().toLowerCase() || label).replace(/^(the|a|an)\s+/, ""); break; }
  for (const [b, re] of BIOME_WORDS) if (has(t, re)) { o.biome = b; break; }
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?|متر|م)?\s*(?:x|×|\*|✕|by|في|ب)\s*(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?|متر|م)?/i);
  if (m) o.size = [+m[1], +m[2]]; else { const one = t.match(/(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?|متر)\b/i); if (one) o.size = [+one[1], +one[1]]; }
  if (o.size) o.size = o.size.map((v) => Math.min(200, Math.max(2, v)));
  if (has(t, /\b(sunset|dusk|golden hour)\b|غروب|مغيب/i)) o.tod = "sunset"; else if (has(t, /\b(night|midnight|moon)\b|ليل|ليلي|منتصف الليل|قمر/i)) o.tod = "night"; else if (has(t, /\b(dawn|sunrise|morning)\b|فجر|شروق|صباح/i)) o.tod = "dawn"; else if (has(t, /\b(day|noon|sunny)\b|نهار|ظهر|مشمس/i)) o.tod = "day";
  const noRF = t.replace(/rain ?forests?/gi, " ").replace(/غابات? مطيرة|الغابات? المطيرة/g, " ");
  if (has(noRF, /\b(rain|rainy|raining|storm|drizzle)\b|مطر|ماطر|أمطار|عاصفة/i)) o.fx.rain = 0.75;
  if (has(t, /\b(fog|foggy|mist|misty|haze)\b|ضباب|ضبابي|شبورة/i)) o.fx.mist = 1;
  if (has(t, /\b(snow|snowing|snowfall)\b|ثلج|تساقط الثلوج/i) && o.biome !== "snow") o.fx.snow = 0.7;
  if (has(t, /\b(fireflies|firefly|glow ?worms)\b|يراع|حباحب/i)) o.fx.fireflies = 1;
  if (has(t, /\b(wind|windy|breeze)\b|رياح|ريح|نسيم/i)) o.fx.wind = 0.9;
  if (has(t, /\b(sun ?rays|light rays|god ?rays|sunbeams)\b|أشعة/i)) o.fx.rays = 1;
  if (has(t, /\b(walk|walking|walkthrough|walk-through|tour|explore|stroll|wander)\b|تجول|تمشى|تمشي|مشي|المشي|جولة|استكشاف/i)) o.walk = true;
  if (has(t, /\b(record|video|film|clip|movie)\b|سجل|سجّل|فيديو|مقطع|فلم|فيلم/i)) o.record = true;
  if (has(t, /\b(left|right|corner|side)\b|يسار|يمين|زاوية|جانب/i)) o.place = "side";
  return o;
}
// every technique the studio knows, per step: id, step, name, where it runs, cost function, availability
export function techniques(cap) {
  const C = cap.cost || {}, inNooi = !!cap.nooi, signed = !!cap.signedIn, srv = !!cap.server, cr = (n) => (n ? n + " cr" : "");
  const dev = cap.webgpu ? "WebGPU" : cap.webgl2 ? "CPU + WebGL2" : "CPU";
  return [
    { id: "sam", step: "select", en: "SAM — tap to select (on this device)", ar: "SAM — اضغط لتحديد العنصر (على جهازك)", where: dev, cost: 0, ok: cap.ai !== false, note: cap.ai === false ? "AI library unavailable" : "" },
    { id: "classic", step: "select", en: "Instant select — colour & depth edges", ar: "تحديد فوري — حواف اللون والعمق", where: "CPU", cost: 0, ok: true },
    { id: "vision", step: "select", en: "AI vision finds it by name", ar: "رؤية الذكاء تجده بالاسم", where: "nooi AI", cost: C.vision || 1, ok: inNooi && signed && srv && !!cap.vision },
    { id: "device", step: "asset", en: "On-device 3D — depth + estimated hidden sides", ar: "3D على جهازك — العمق + تقدير الجوانب المخفية", where: dev, cost: 0, ok: true },
    { id: "trellis", step: "asset", en: "NVIDIA TRELLIS — AI generates the missing parts", ar: "NVIDIA TRELLIS — الذكاء يولّد الأجزاء الناقصة", where: "NVIDIA cloud", cost: C.trellis || 12, ok: inNooi && signed && srv && !!cap.trellis },
    { id: "views", step: "asset", en: "AI views — front, side & back pictures → mesh", ar: "زوايا الذكاء — صور أمامية وجانبية وخلفية ← مجسّم", where: "nooi credits", cost: C.views || 6, ok: inNooi && signed && !!cap.views },
    { id: "tripo", step: "asset", en: "Tripo3D — image → 3D", ar: "Tripo3D — صورة ← 3D", where: "Tripo cloud", cost: C.tripo || 12, ok: inNooi && signed && srv && !!cap.tripo },
    { id: "meshy", step: "asset", en: "Meshy — image → 3D", ar: "Meshy — صورة ← 3D", where: "Meshy cloud", cost: C.meshy || 12, ok: inNooi && signed && srv && !!cap.meshy },
    { id: "sam3d", step: "asset", en: "SAM 3D (GPU server)", ar: "SAM 3D (خادم GPU)", where: "nooi GPU", cost: C.sam3d || 12, ok: inNooi && signed && srv && !!cap.sam3d },
    { id: "procedural", step: "world", en: "Procedural world — built on your GPU", ar: "عالم إجرائي — يُبنى على معالجك الرسومي", where: "WebGL2", cost: 0, ok: true },
    { id: "pano", step: "world", en: "AI 360° sky painted for your prompt", ar: "سماء 360° يرسمها الذكاء لطلبك", where: "nooi credits", cost: C.pano || 4, ok: inNooi && signed && !!cap.pano },
    { id: "skybox", step: "world", en: "Blockade Labs Skybox (360° + depth)", ar: "Blockade Labs Skybox (‏360° + عمق)", where: "Blockade cloud", cost: C.skybox || 40, ok: inNooi && signed && srv && !!cap.skybox },
    { id: "fx", step: "fx", en: "Rain · mist · light rays · fireflies · leaves · snow · wind", ar: "مطر · ضباب · أشعة · يراعات · أوراق · ثلج · رياح", where: "GPU shaders", cost: 0, ok: true },
    { id: "walk", step: "explore", en: "Walk through it (first person) · guided tour", ar: "تجوّل داخله (منظور الشخص) · جولة موجّهة", where: "WebGL2", cost: 0, ok: true },
    { id: "video", step: "capture", en: "Record the walk-through as a video (+ ambience)", ar: "سجّل الجولة فيديو (+ الأصوات)", where: "this device", cost: 0, ok: true },
    { id: "editor", step: "capture", en: "Send the video to the nooi editor", ar: "أرسل الفيديو إلى محرر nooi", where: "nooi", cost: 0, ok: inNooi },
    { id: "glb", step: "capture", en: "Export .glb (Blender, Unity) / .usdz (iPhone AR)", ar: "تصدير ‎.glb (Blender و Unity) / ‎.usdz (واقع معزز)", where: "this device", cost: 0, ok: true },
  ];
}
export const STEPS = [
  ["select", "Pick the subject in your photo", "حدّد العنصر في صورتك"], ["asset", "Turn it into a 3D object", "حوّله إلى مجسّم ثلاثي الأبعاد"],
  ["world", "Build the world around it", "ابنِ العالم من حوله"], ["fx", "Add life & weather", "أضف الحياة والطقس"],
  ["explore", "Walk through it", "تجوّل داخله"], ["capture", "Capture & share", "التقط وشارك"],
];
// a plan: for each step, the chosen technique (+ the alternatives), settings, a total cost, and notes about conflicts
export function makePlan(intent, cap, prev = {}) {
  const T = techniques(cap), pick = (step, order) => { for (const id of order) { const t = T.find((x) => x.id === id && x.step === step && x.ok); if (t) return t.id; } return T.find((x) => x.step === step && x.ok)?.id || null; };
  const hasPhoto = !!cap.photo, cloud = pick("asset", ["trellis", "tripo", "meshy", "views", "sam3d"]), useCloud = prev.cloud ?? (cloud && cloud !== "device" && cap.autoCloud !== false);
  const steps = STEPS.map(([id, en, ar]) => ({ id, en, ar, options: T.filter((t) => t.step === id), choice: null, on: true, status: "todo" }));
  const S = Object.fromEntries(steps.map((s) => [s.id, s]));
  S.select.choice = pick("select", cap.ai === false ? ["classic"] : ["sam", "classic"]); S.select.on = hasPhoto;
  S.asset.choice = "device"; S.asset.upgrade = useCloud ? cloud : null; S.asset.on = hasPhoto;
  S.world.choice = "procedural"; S.world.sky = prev.sky || null; S.fx.choice = "fx"; S.explore.choice = "walk"; S.explore.on = true;
  S.capture.choice = intent.record ? "video" : "glb"; S.capture.on = !!intent.record;
  const plan = { intent, steps, biome: intent.biome || prev.biome || "rainforest", size: intent.size || prev.size || [8, 8], tod: intent.tod || prev.tod || "day", fx: Object.assign({}, intent.fx),
    subject: intent.subject || (hasPhoto ? "subject" : null), category: intent.category || "object", walk: intent.walk || !intent.record, notes: [] };
  plan.cost = (S.asset.upgrade ? (T.find((t) => t.id === S.asset.upgrade) || {}).cost || 0 : 0) + (S.world.sky ? (T.find((t) => t.id === S.world.sky) || {}).cost || 0 : 0);
  if (!hasPhoto && intent.subject) plan.notes.push({ k: "photo", en: "Add a photo of the " + intent.subject + " (or describe it and let AI views draw it).", ar: "أضف صورة " + intent.subject + " (أو صِفه وسترسمه زوايا الذكاء)." });
  if (!cloud && hasPhoto) plan.notes.push({ k: "cloud", en: "The hidden sides are estimated on this device. Sign in on nooi.ai to let AI generate them (credits).", ar: "تُقدَّر الجوانب المخفية على جهازك. سجّل الدخول في nooi.ai ليولّدها الذكاء (برصيد)." });
  return plan;
}
// a real-size object that doesn't fit the plot → say so, and how to fix it
export function fitNote(asset, plot) { if (!asset || asset.fits) return null; const need = Math.ceil(Math.max(asset.size[0], asset.size[2]) + 2.4);
  return { en: `The ${asset.name} is ${asset.size[0]} × ${asset.size[2]} m — bigger than the ${plot.w} × ${plot.d} m area. Shrink it to fit, or make the area ${need} × ${need} m.`, ar: `${asset.name} أبعاده ${asset.size[0]} × ${asset.size[2]} م — أكبر من المساحة ${plot.w} × ${plot.d} م. صغّره ليناسبها، أو اجعل المساحة ${need} × ${need} م.`, need }; }
