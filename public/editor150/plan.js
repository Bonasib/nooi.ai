// v150: the plan of a motion ad — which animated scenes, in what order, how long, with which words. The page draws the
// scenes (public/index.html, mgDraw150); the server's text AI may write the plan (lib/motion150.js); both clean it with
// clean150() below, so every scene is one the page knows and every word and number stays in range. plan150() reads a brief in
// English or Arabic without any AI (free, instant) — an ad can always be made.
export const KINDS150 = ["logo", "trail", "phone", "counter", "board", "call", "nodes", "words", "end"];
// how long each scene likes to be (seconds) — scaled to the ad's length
const W150 = { logo: 2.6, trail: 1.4, phone: 3.4, counter: 3, board: 3.4, call: 3.2, nodes: 3.4, words: 2.4, end: 2.8 };
// icons the page can draw (Material Symbols in public/editor131/icons.json)
export const ICONS150 = ["public", "school", "music_note", "trophy", "sports_soccer", "fitness_center", "restaurant", "local_cafe", "flight", "storefront",
  "directions_car", "pets", "photo_camera", "videocam", "work", "payments", "local_shipping", "favorite", "lightbulb", "bolt", "rocket_launch", "star",
  "local_fire_department", "whatshot", "trending_up", "diamond", "mood", "sentiment_very_satisfied", "military_tech", "workspace_premium", "verified",
  "shopping_bag", "shopping_cart", "celebration", "schedule", "timer", "mic", "chat_bubble", "forum", "group", "home", "beach_access", "cake", "percent", "check_circle"];
const KEYS150 = [[/language|lingu|spanish|english|french|لغ|لسان|إنجليز|فرنس/i, "public"], [/math|algebra|رياضيات|حساب/i, "percent"], [/music|song|piano|guitar|موسيق|غناء|بيانو|عود/i, "music_note"],
  [/chess|شطرنج/i, "military_tech"], [/sport|football|soccer|رياض[ةه]|كرة/i, "sports_soccer"], [/fit|gym|workout|لياقة|تمرين/i, "fitness_center"], [/food|meal|eat|طعام|أكل|وجب/i, "restaurant"],
  [/coffee|cafe|قهوة|مقهى/i, "local_cafe"], [/travel|trip|flight|سفر|رحل|طيران/i, "flight"], [/shop|store|buy|متجر|تسوق|شراء/i, "storefront"], [/car|drive|سيار|قيادة/i, "directions_car"],
  [/pet|dog|cat|حيوان|قط|كلب/i, "pets"], [/photo|camera|صور/i, "photo_camera"], [/video|film|فيديو|فيلم/i, "videocam"], [/work|job|career|عمل|وظيف/i, "work"],
  [/money|pay|price|مال|دفع|سعر/i, "payments"], [/deliver|ship|توصيل|شحن/i, "local_shipping"], [/love|heart|حب|قلب/i, "favorite"], [/idea|learn|study|فكر|تعلم|تعلّم|دراس/i, "lightbulb"],
  [/fast|quick|speed|سريع|سرعة/i, "bolt"], [/launch|grow|rocket|انطلق|نمو/i, "rocket_launch"], [/school|class|course|مدرس|صف|دورة/i, "school"], [/streak|fire|متتال|نار|يوم/i, "local_fire_department"],
  [/win|prize|trophy|league|فوز|جائز|كأس|دوري/i, "trophy"], [/time|minute|hour|وقت|دقيق|ساع/i, "timer"], [/talk|speak|call|chat|تحدث|كلام|مكالم|محادث/i, "forum"], [/friend|team|people|صديق|أصدقاء|فريق|ناس/i, "group"]];
const DEF150 = ["star", "bolt", "lightbulb", "favorite", "rocket_launch", "trophy"];
export function iconFor150(label, i = 0) { const s = String(label || ""); for (const [re, ic] of KEYS150) if (re.test(s)) return ic; return DEF150[i % DEF150.length]; }
const str = (x, n) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, n);
const isAr = (s) => /[؀-ۿ]/.test(s || "");

// any list of scenes (from the AI or the page) → only known scenes, short words, numbers in range, lengths that add up to len
export function clean150(list, len) {
  const L = Math.max(6, Math.min(60, +len || 20));
  const out = [];
  for (const s of Array.isArray(list) ? list : []) {
    if (!s || typeof s !== "object") continue;
    const sc = KINDS150.includes(s.sc) ? s.sc : KINDS150.includes(s.kind) ? s.kind : null; if (!sc) continue;
    let items = Array.isArray(s.items) ? s.items : String(s.items || "").split(/\s*\|\s*/);
    items = items.map((x) => str(x, 32)).filter(Boolean).slice(0, 6);
    const v = +String(s.val ?? s.number ?? "").replace(/[^\d.]/g, "");
    const ic = ICONS150.includes(s.ic) ? s.ic : ICONS150.includes(s.icon) ? s.icon : null;
    const d = +(s.dur ?? s.seconds);
    out.push({ sc, t1: str(s.t1 ?? s.title, 60), t2: str(s.t2 ?? s.subtitle, 80), items, val: isFinite(v) && v > 0 ? Math.min(v, 1e9) : null, ic, dur: isFinite(d) && d > 0 ? d : W150[sc] });
    if (out.length >= 12) break;
  }
  // (scaled to the length; a scene is at least 1.1 s, the others give the time back; the sum is exactly the length)
  const sum = out.reduce((a, s) => a + Math.max(1, s.dur), 0) || 1;
  out.forEach((s) => { s.dur = Math.max(1.1, (Math.max(1, s.dur) * L) / sum); });
  const over = out.reduce((a, s) => a + s.dur, 0) - L, free = out.filter((s) => s.dur > 1.2), room = free.reduce((a, s) => a + s.dur - 1.1, 0);
  if (over > 0 && room > 0) free.forEach((s) => { s.dur -= (over * (s.dur - 1.1)) / room; });
  out.forEach((s) => { s.dur = +s.dur.toFixed(2); });
  if (out.length) { const last = out[out.length - 1], d = +(L - out.reduce((a, s) => a + s.dur, 0)).toFixed(2); if (Math.abs(d) < 0.5 && last.dur + d >= 1.1) last.dur = +(last.dur + d).toFixed(2); }
  return out;
}

// a brief → a plan, with no AI: the brand's reveal, light, the main line in big words, then the scenes the brief speaks of
// (an app, a number, a leaderboard, a call, a list of things), the last line, and the end card
export function plan150(b) {
  const brand = str(b && b.brand, 40) || "nooi", msg = str(b && b.msg, 600), ar = isAr(msg + brand);
  const sents = msg.split(/(?<=[.!?؟])\s+|\n+/).map((s) => s.trim().replace(/[.!؟?]+$/, "")).filter(Boolean);
  const has = (re) => re.test(msg), out = [];
  const first = sents[0] || brand, fw = first.split(" ");
  out.push({ sc: "logo", t1: brand, t2: "" });
  out.push({ sc: "trail" });
  out.push({ sc: "words", t1: fw.slice(0, Math.min(2, fw.length)).join(" "), t2: fw.slice(2).join(" ") });
  if (has(/\bapp\b|lesson|learn|screen|تطبيق|درس|تعلم|تعلّم|شاشة/i)) {
    const lang = has(/language|lingu|لغ/i), stop = /^(the|a|an|to|of|in|on|and|for|any|with|a|في|من|على|إلى|و|أي)$/i;
    out.push({ sc: "phone", t1: lang ? (ar ? "ترجم هذه الجملة" : "Translate this sentence") : first.length > 34 ? first.slice(0, 34) + "…" : first,
      items: first.split(" ").map((w) => w.replace(/[,،.]/g, "")).filter((w) => w.length > 1 && !stop.test(w)).slice(0, 5) });
  }
  // (the biggest number is the one to show — "369 day streak", not "5 minutes")
  const nms = [...msg.matchAll(/(\d[\d,.]*)\s*[-–]?\s*([^\d.,!?؟\n]{0,28})/g)].sort((x, y) => +y[1].replace(/,/g, "") - +x[1].replace(/,/g, ""));
  const nm = nms[0];   // (its label: up to two words, ended by "and" — or an Arabic "و" joined to the next word)
  if (nm) { const lab = nm[2].trim().split(/\s+(?:and|or|و|أو)\s+/i)[0].split(" ").reduce((o, w, i) => (o.stop || (i > 0 && /^و../.test(w)) ? { ...o, stop: true } : { ...o, w: o.w.concat(w) }), { w: [] }).w.slice(0, 2).join(" "); out.push({ sc: "counter", val: +nm[1].replace(/,/g, ""), t1: lab || (ar ? "يوماً متتالياً" : "day streak"), ic: iconFor150(lab || "streak") }); }
  if (has(/league|rank|leader|top|compete|friends|دوري|ترتيب|منافس|الأول|أصدقاء/i)) {
    const nms = ar ? ["مايا", "عمر", "لوسيا", "كينجي", "صوفيا", "أنت"] : ["Maya", "Omar", "Lucia", "Kenji", "Sofia", "You"];
    out.push({ sc: "board", t1: ar ? "الدوري الماسي" : "Diamond League", t2: ar ? "أفضل ثلاثة يفوزون بكأس" : "Top 3 win a trophy", items: nms.map((n, i) => n + ":" + (1340 - i * 70)), ic: "diamond" });
  }
  if (has(/call|talk|speak|chat|tutor|conversation|مكالم|محادث|تحدث|تحدّث|مدرس|معلم/i)) out.push({ sc: "call", t1: ar ? "مرحباً! كيف كان يومك؟" : "Hi! How was your day?", t2: ar ? "رائع، شكراً!" : "Great, thanks!", ic: "mood" });
  const lm = /[:：]\s*([^.!?؟\n]+)/.exec(msg), commas = sents.find((s) => (s.match(/[,،]/g) || []).length >= 2);
  const list = (lm ? lm[1] : commas || "").split(/\s*(?:[,،]|\band\b|\sو)\s*/).map((x) => x.trim().replace(/^(and|و)\s+/i, "")).filter((x) => x && x.length <= 24);
  if (list.length >= 2) out.push({ sc: "nodes", items: list.slice(0, 6) });
  // the closing line: two short lines together ("One app." "Every skill."), else the last line in two parts
  const last = sents.length > 1 ? sents[sents.length - 1] : "", prev = sents.length > 2 ? sents[sents.length - 2] : "", short = (x) => x && x.split(" ").length <= 3;
  if (short(last) && short(prev) && prev !== first) out.push({ sc: "words", t1: prev, t2: last });
  else if (last && last !== first && !(lm && last.includes(lm[1]))) { const lw = last.split(" "); out.push({ sc: "words", t1: lw.slice(0, Math.min(2, lw.length)).join(" "), t2: lw.slice(2).join(" ") }); }
  out.push({ sc: "end", t1: brand, t2: ar ? "ابدأ اليوم" : "Start today" });
  return clean150(out, b && b.len);
}
