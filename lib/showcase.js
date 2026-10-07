// Showcase: nooi's own marketing videos & pictures, made with the site's AI providers (Kie AI) from the prompts below.
// Admin → AI providers → "Showcase" starts them (staff jobs, no credits). Each finished item replaces a demo preview
// (slot 0–5 = the animated demo tiles on the home cards, landing page and Explore) and is published to Explore as
// a featured post by "nooi", with its prompt so anyone can Recreate it.
// GET /v1/showcase (public) · GET /v1/admin/showcase · POST /v1/admin/showcase {ids?, force?}
import { col, save, user, uid } from "./store.js";
import { requireUser } from "./auth.js";
import { isStaff } from "./admin.js";
import { createJob } from "./jobs.js";

const V = (id, cat, model, aspect, slot, title, prompt) => ({ id, cat, kind: "video", model, aspect, dur: 5, slot, title, prompt });
const I = (id, cat, model, aspect, slot, title, prompt) => ({ id, cat, kind: "image", model, aspect, slot, title, prompt });
export const SHOWCASE = [
  // motion
  V("desert-rider", "motion", "kling", "16:9", 0, ["Desert city flyover", "تحليق فوق مدينة صحراوية"],
    ["Cinematic drone shot gliding over a desert city at golden hour, long shadows, dust in the air, a lone rider on horseback crossing the dunes below, anamorphic lens flare, epic film look",
     "لقطة درون سينمائية تحلّق فوق مدينة صحراوية في الساعة الذهبية، ظلال طويلة وغبار في الهواء، فارس وحيد على حصان يعبر الكثبان، توهج عدسة أنامورفيك ومظهر فيلم ملحمي"]),
  V("ugc-perfume", "ugc", "kling", "9:16", 2, ["Perfume UGC ad", "إعلان عطر UGC"],
    ["A smiling young woman in a bright modern studio holds a gold perfume bottle up to the camera and sprays it, natural handheld UGC selfie style, soft daylight, authentic social-media ad",
     "شابة مبتسمة في استوديو حديث مضيء ترفع زجاجة عطر ذهبية أمام الكاميرا وترشّها، أسلوب UGC سيلفي محمول، ضوء نهار ناعم، إعلان طبيعي لوسائل التواصل"]),
  V("neon-drift", "motion", "hailuo", "16:9", null, ["Neon drift", "انجراف النيون"],
    ["A sports car drifts around a rain-soaked neon corner at night, sparks and water spray, low tracking shot, motion blur, high-energy car commercial",
     "سيارة رياضية تنجرف حول منعطف مبلل بالمطر تحت أضواء النيون ليلاً، شرر ورذاذ ماء، لقطة تتبّع منخفضة، ضبابية حركة، إعلان سيارات حماسي"]),
  V("coffee-pour", "motion", "seedance20", "9:16", null, ["Coffee pour", "سكب القهوة"],
    ["Slow-motion macro of cold brew coffee poured over ice in a glass, cream swirling, warm morning light, shallow depth of field, premium café commercial",
     "لقطة ماكرو بالحركة البطيئة لقهوة باردة تُسكب فوق الثلج في كوب زجاجي، الكريمة تدور، ضوء صباحي دافئ، عمق ميدان ضحل، إعلان مقهى فاخر"]),
  V("volcanic-waves", "motion", "wan27", "16:9", null, ["Volcanic shore", "شاطئ بركاني"],
    ["Waves crash against black volcanic rocks in slow motion, mist catching the sunrise, aerial pull-back revealing a wild coastline, nature documentary",
     "أمواج تتكسر على صخور بركانية سوداء بالحركة البطيئة، رذاذ يلتقط شروق الشمس، الكاميرا تبتعد جواً لتكشف ساحلاً برياً، فيلم وثائقي طبيعي"]),
  // anime
  V("rooftop-run", "anime", "kling", "16:9", 5, ["Rooftop run", "ركض على الأسطح"],
    ["Anime style: a girl with a red scarf runs across city rooftops at sunset, wind in her hair, painterly hand-drawn background, dynamic tracking camera, Studio Ghibli inspired",
     "أسلوب أنمي: فتاة بوشاح أحمر تركض فوق أسطح المدينة عند الغروب، الريح في شعرها، خلفية مرسومة يدوياً، كاميرا تتبّع ديناميكية، مستوحى من استوديو جيبلي"]),
  V("sakura-samurai", "anime", "seedance20", "9:16", null, ["Sakura samurai", "ساموراي الكرز"],
    ["Anime battle scene: a samurai draws a glowing katana under falling cherry blossoms, petals swirl around him, dramatic speed lines, cel-shaded, intense close-up",
     "مشهد قتال أنمي: ساموراي يسحب سيفاً متوهجاً تحت أزهار الكرز المتساقطة، البتلات تدور حوله، خطوط سرعة درامية، تظليل كرتوني، لقطة قريبة مشوّقة"]),
  V("rainy-cat", "anime", "wan27", "16:9", null, ["Rainy window", "نافذة ممطرة"],
    ["Cozy anime scene: a cat sleeps on a windowsill while rain falls on a quiet Tokyo street at dusk, warm lamp light, soft lo-fi colors, gentle camera push-in",
     "مشهد أنمي دافئ: قطة نائمة على حافة النافذة والمطر يهطل على شارع هادئ في طوكيو عند الغسق، ضوء مصباح دافئ، ألوان لو-فاي ناعمة، تقدّم بطيء للكاميرا"]),
  V("fox-chef", "anime", "pixverse6", "1:1", null, ["Fox chef", "الثعلب الطاهي"],
    ["3D cartoon: a chubby fox chef flips a giant pancake in a tiny cozy kitchen, bouncy squash-and-stretch animation, bright colors, Pixar-like charm",
     "كرتون ثلاثي الأبعاد: ثعلب طاهٍ ممتلئ يقلب فطيرة ضخمة في مطبخ صغير دافئ، حركة مرنة ونطّاطة، ألوان زاهية وسحر يشبه بيكسار"]),
  // VFX
  V("crystal-city", "vfx", "veo31f", "16:9", 3, ["Shattering tower", "برج يتحطم"],
    ["VFX shot: a glass skyscraper shatters into thousands of floating cubes that spin and reassemble into a giant glowing crystal sphere above the city, photoreal, volumetric light",
     "لقطة مؤثرات: ناطحة سحاب زجاجية تتحطم إلى آلاف المكعبات العائمة التي تدور ثم تتجمع في كرة كريستالية متوهجة عملاقة فوق المدينة، واقعية، إضاءة حجمية"]),
  V("fire-portal", "vfx", "kling", "16:9", 4, ["Fire portal", "بوابة النار"],
    ["VFX: a portal of swirling blue fire opens in a dark misty forest, embers and particles fly, a hooded traveler steps through, cinematic slow push-in",
     "مؤثرات: بوابة من نار زرقاء دوّارة تنفتح في غابة مظلمة ضبابية، جمرات وجسيمات تتطاير، ومسافر بقلنسوة يعبر منها، تقدّم سينمائي بطيء"]),
  V("chrome-watch", "vfx", "seedance20", "9:16", null, ["Liquid chrome", "كروم سائل"],
    ["Product VFX: liquid chrome flows and morphs into a sleek luxury wristwatch on a black background, mirror reflections, macro lens, high-end commercial",
     "مؤثرات منتج: كروم سائل يتدفق ويتحول إلى ساعة يد فاخرة أنيقة على خلفية سوداء، انعكاسات كالمرآة، عدسة ماكرو، إعلان راقٍ"]),
  V("time-freeze", "vfx", "hailuo", "16:9", null, ["Time freeze", "تجميد الزمن"],
    ["A man snaps his fingers and the whole rainy street freezes in time, raindrops hang in the air, people stop mid-step, bullet-time camera orbit around him",
     "رجل يطقطق أصابعه فيتجمد الشارع الممطر بأكمله، قطرات المطر معلّقة في الهواء والناس متوقفون في منتصف الخطوة، الكاميرا تدور حوله بأسلوب الزمن الرصاصي"]),
  // pixel-art animation
  V("pixel-knight", "pixel", "wan27", "16:9", null, ["Pixel knight", "فارس البكسل"],
    ["Pixel art animation: a small knight walks through a 16-bit forest with parallax scrolling layers, fireflies glowing, retro video game style, crisp pixels, side view",
     "رسوم متحركة بفن البكسل: فارس صغير يمشي في غابة 16-بت بطبقات تمرير متوازية، يراعات متوهجة، أسلوب ألعاب الفيديو القديمة، بكسلات حادة، منظر جانبي"]),
  V("pixel-city", "pixel", "kling", "9:16", null, ["Pixel night city", "مدينة البكسل ليلاً"],
    ["Pixel art animation of a cozy city street at night, neon shop signs flicker, rain falls, a cat crosses under a lamp post, 32-bit retro style, seamless loop",
     "رسوم متحركة بفن البكسل لشارع مدينة دافئ ليلاً، لافتات نيون تومض، مطر يهطل، قطة تعبر تحت عمود إنارة، أسلوب 32-بت قديم، حلقة متواصلة"]),
  V("pixel-island", "pixel", "seedance20", "1:1", null, ["Pixel island", "جزيرة البكسل"],
    ["Isometric pixel art island with a tiny village and windmill, day turns into night, lights turn on in the windows, gentle waves, retro game animation",
     "جزيرة بفن البكسل بمنظور متساوي القياس مع قرية صغيرة وطاحونة هواء، النهار يتحول إلى ليل، تُضاء النوافذ، أمواج هادئة، رسوم ألعاب قديمة"]),
  // pictures
  I("abaya-portrait", "design", "nanopro", "4:5", 1, ["Editorial portrait", "بورتريه تحريري"],
    ["Editorial portrait of a confident young Saudi woman in a modern black abaya with gold details, soft window light, neutral studio backdrop, fashion magazine look, 85mm lens",
     "بورتريه تحريري لشابة سعودية واثقة بعباءة سوداء عصرية بتفاصيل ذهبية، ضوء نافذة ناعم، خلفية استوديو محايدة، مظهر مجلات الأزياء، عدسة 85 مم"]),
  I("perfume-stone", "ecommerce", "seedream5", "16:9", null, ["Perfume on stone", "عطر على الحجر"],
    ["Luxury perfume bottle on wet black stone, gold reflections, water droplets, dramatic rim light, studio product photography, ultra detailed",
     "زجاجة عطر فاخرة على حجر أسود مبلل، انعكاسات ذهبية وقطرات ماء، إضاءة حافة درامية، تصوير منتجات احترافي بتفاصيل عالية"]),
  I("riyadh-poster", "design", "mj", "3:4", null, ["Future Riyadh", "الرياض المستقبلية"],
    ["Poster of a futuristic Riyadh skyline at night, neon teal and gold light trails, cinematic composition, ultra detailed, sci-fi movie poster style",
     "ملصق لأفق الرياض المستقبلي ليلاً، مسارات ضوء نيون فيروزية وذهبية، تكوين سينمائي، تفاصيل عالية، أسلوب ملصقات أفلام الخيال العلمي"]),
  I("cafe-illustration", "marketing", "img20", "1:1", null, ["Café illustration", "رسم مقهى"],
    ["Minimal flat illustration of a cozy coffee shop storefront with plants and a striped awning, pastel palette, clean poster design, soft shadows",
     "رسم مسطح بسيط لواجهة مقهى دافئ مع نباتات ومظلة مخططة، ألوان باستيل، تصميم ملصق نظيف، ظلال ناعمة"]),
  I("lagoon-aerial", "marketing", "imagen4", "16:9", null, ["Turquoise lagoon", "البحيرة الفيروزية"],
    ["Aerial photo of a turquoise lagoon with a long wooden pier at sunrise, crystal clear water, travel advertising, crisp and vibrant",
     "صورة جوية لبحيرة فيروزية مع رصيف خشبي طويل عند الشروق، مياه صافية كالكريستال، إعلان سياحي، ألوان حادة وحيوية"]),
];

const recs = () => col("showcase", {});
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(e.code || 500).json({ error: e.message }));
const staffOnly = (req, res, next) => (isStaff(req.user) ? next() : res.status(403).json({ error: "Not allowed" }));
const view = (s) => { const r = recs()[s.id] || {}; return { id: s.id, cat: s.cat, kind: s.kind, model: s.model, aspect: s.aspect, slot: s.slot, title: s.title, prompt: s.prompt, url: r.url || null }; };
const status = () => SHOWCASE.map((s) => { const r = recs()[s.id] || {}; return { id: s.id, title: s.title, kind: s.kind, cat: s.cat, model: s.model, status: r.status || "none", url: r.url || null, error: r.error || null }; });

function publish(s, r) {
  const ex = col("explore", []);
  for (let i = ex.length - 1; i >= 0; i--) if (ex[i].showcase === s.id) ex.splice(i, 1);
  ex.unshift({ id: uid(), uid: r.uid, url: r.url, kind: s.kind, prompt: s.prompt[0], model: s.model, aspect: s.aspect, cat: s.cat, title: s.title[0],
    author: "nooi", created: Date.now(), likedBy: [], featured: true, showcase: s.id });
}
// finished jobs → showcase record + Explore post
setInterval(() => { let ch = false;
  for (const s of SHOWCASE) { const r = recs()[s.id]; if (!r || r.status !== "rendering") continue;
    const j = (user(r.uid).jobs || {})[r.jobId];
    if (!j) { r.status = "failed"; r.error = "The job was lost"; ch = true; }
    else if (j.status === "done" && j.url) { r.status = "done"; r.url = j.url; r.error = null; publish(s, r); ch = true; }
    else if (j.status === "failed") { r.status = "failed"; r.error = j.errorDetail || j.error || "failed"; ch = true; } }
  if (ch) save(); }, 4000);

export function registerShowcase(app) {
  app.get("/v1/showcase", (req, res) => res.json({ items: SHOWCASE.map(view) }));
  app.get("/v1/admin/showcase", requireUser, staffOnly, (req, res) => res.json({ items: status() }));
  // remove made items (record + Explore post); the media file stays in /media
  app.delete("/v1/admin/showcase", requireUser, staffOnly, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [], ex = col("explore", []);
    for (const id of ids) { delete recs()[id]; for (let i = ex.length - 1; i >= 0; i--) if (ex[i].showcase === id) ex.splice(i, 1); }
    save(); res.json({ items: status() });
  });
  app.post("/v1/admin/showcase", requireUser, staffOnly, wrap(async (req, res) => {
    const want = Array.isArray(req.body?.ids) && req.body.ids.length ? req.body.ids : SHOWCASE.map((s) => s.id), force = !!req.body?.force;
    for (const s of SHOWCASE) { if (!want.includes(s.id)) continue; const r = recs()[s.id] || {};
      if (r.status === "rendering" || (r.status === "done" && !force)) continue;
      try {
        const job = await createJob(req.user, { kind: s.kind, model: s.model, prompt: s.prompt[0], aspect: s.aspect, dur: s.dur, count: 1, title: "Showcase · " + s.title[0], meta: { showcase: s.id, res: s.kind === "image" ? "2K" : "720P" } });
        recs()[s.id] = { jobId: job.id, uid: req.user.uid, status: job.status === "failed" ? "failed" : "rendering", at: Date.now(), url: r.url || null, error: null };
      } catch (e) { recs()[s.id] = { ...r, status: "failed", error: e.message }; }
    }
    save(); res.json({ items: status() });
  }));
}
