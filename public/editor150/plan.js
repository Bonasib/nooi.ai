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

// v162: a line in two parts at its natural break — a comma, or a joining word near the middle ("…turns one sentence | into a
// finished video"), else before "their / the / your…" — never just after the second word ("nooi.ai turns | one sentence into…")
const JOIN162 = /^(into|to|for|with|at|in|on|from|and|but|so|that|which|while|when|because|في|إلى|الى|من|على|مع|لكي|حتى|ثم|و|لأن|عندما)$/i;
const DET162 = /^(their|the|a|an|your|my|our|his|her|its|every|any|all|this|that|these|those|كل|هذا|هذه)$/i;
export function split150(line) {
  const w = String(line || "").split(/\s+/).filter(Boolean), n = w.length; if (n <= 3) return [w.join(" "), ""];
  const lo = Math.max(2, Math.ceil(n * 0.3)), hi = Math.min(5, n - Math.max(2, Math.ceil(n * 0.3))); let at = -1, best = 1e9;
  for (let i = lo; i <= hi; i++) { const comma = /[,،:]$/.test(w[i - 1]), join = JOIN162.test(w[i].replace(/[,،.:]/g, "")), det = DET162.test(w[i]);
    if (!comma && !join && !det) continue; const sc = Math.abs(i - n / 2) - (comma ? 1.5 : 0) + (join || comma ? 0 : 0.75); if (sc < best) { best = sc; at = i; } }
  if (at < 0) at = Math.max(2, Math.min(5, Math.floor(n / 2)));
  return [w.slice(0, at).join(" ").replace(/[,،:]$/, ""), w.slice(at).join(" ")];
}
// v162: the last line asks the viewer to act ("Start free at nooi.ai", "ابدأ الآن") — it goes on the end card, not on a scene of its own
const CTA162 = /^(start|try|get|download|join|sign\s*up|visit|book|order|shop|buy|subscribe|ابدأ|ابدا|جرّب|جرب|حمّل|حمل|انضم|اطلب|زُر|زر|سجّل|سجل|اشترك|احجز)/i;
// a brief → a plan, with no AI: the brand's reveal, light, the main line in big words, then every other line of the brief in its
// order — as the scene that shows it (an app, a number, a leaderboard, a call, a list of things, or big words) — the last line,
// and the end card (v162: every line gets a scene; before, lines with no number, list, app or call were left out)
export function plan150(b) {
  const brand = str(b && b.brand, 40) || "nooi", msg = str(b && b.msg, 600), ar = isAr(msg + brand), L = Math.max(6, Math.min(60, +(b && b.len) || 20));
  const sents = msg.split(/(?<=[.!?؟])\s+|\n+/).map((s) => s.trim().replace(/[.!؟?]+$/, "")).filter(Boolean);
  const has = (re) => re.test(msg), mid = [], sIdx = (re) => Math.max(0, sents.findIndex((x) => re.test(x)));
  const first = sents[0] || brand, used = new Set([0]);
  const out = [{ sc: "logo", t1: brand, t2: "" }, { sc: "trail" }];
  { const [a, c] = split150(first); out.push({ sc: "words", t1: a, t2: c }); }
  // the closing: a call to action goes on the end card; two short lines together ("One app." "Every skill."), else the last line
  let last = sents.length > 1 ? sents[sents.length - 1] : "", cta = "";
  if (last && CTA162.test(last) && last.split(" ").length <= 7) { cta = last.slice(0, 40); used.add(sents.length - 1); last = sents.length > 2 ? sents[sents.length - 2] : ""; }
  const li = last ? sents.lastIndexOf(last) : -1, prev = li > 1 ? sents[li - 1] : "", short = (x) => x && x.split(" ").length <= 3;
  let closing = null;
  if (short(last) && short(prev) && prev !== first) { closing = { sc: "words", t1: prev, t2: last }; used.add(li); used.add(li - 1); }
  if (has(/\bapp\b|lesson|learn|screen|تطبيق|درس|تعلم|تعلّم|شاشة/i)) {
    const lang = has(/language|lingu|لغ/i), stop = /^(the|a|an|to|of|in|on|and|for|any|with|a|في|من|على|إلى|و|أي)$/i;
    mid.push({ i: 0.5, k: 0, s: { sc: "phone", t1: lang ? (ar ? "ترجم هذه الجملة" : "Translate this sentence") : first.length > 34 ? first.slice(0, 34) + "…" : first,
      items: first.split(" ").map((w) => w.replace(/[,،.]/g, "")).filter((w) => w.length > 1 && !stop.test(w)).slice(0, 5) } });
  }
  // the numbers: the biggest one ("369 day streak", not "5 minutes"), and (v162) one more from another line — not a version
  // in a name ("Kling 4.0", "Veo 3.1")
  const dig = msg.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/٬/g, ",");   // (v162: ١٢٠٠٠٠ is a number too — same length, so the places match)
  const nms = [...dig.matchAll(/(\d[\d,.]*)\s*[-–]?\s*([^\d.,!?؟\n]{0,28})/g)].filter((m) => !(/\./.test(m[1].replace(/\.$/, "")) && /[A-Za-z][\w-]*\s?$/.test(dig.slice(0, m.index))))
    .sort((x, y) => +y[1].replace(/,/g, "") - +x[1].replace(/,/g, ""));
  const lineOf = (m) => { let at = 0; for (let i = 0; i < sents.length; i++) { const p = msg.indexOf(sents[i], at); if (p >= 0 && m.index >= p && m.index < p + sents[i].length + 1) return i; if (p >= 0) at = p + sents[i].length; } return 0; };
  const counter = (nm) => { const lab = nm[2].trim().split(/\s+(?:and|or|و|أو)\s+/i)[0].split(" ").reduce((o, w, i) => (o.stop || (i > 0 && /^و../.test(w)) ? { ...o, stop: true } : { ...o, w: o.w.concat(w) }), { w: [] }).w.slice(0, 2).join(" ").replace(/[,،:]$/, "");
    return { sc: "counter", val: +nm[1].replace(/,/g, ""), t1: lab || (ar ? "يوماً متتالياً" : "day streak"), ic: iconFor150(lab || "streak") }; };
  if (nms[0]) { const i = lineOf(nms[0]); mid.push({ i, k: 1, s: counter(nms[0]) }); used.add(i);
    const n2 = nms.slice(1).find((m) => { const j = lineOf(m); return j !== i && j !== 0 && !used.has(j) && +m[1].replace(/,/g, "") >= 2; });
    if (n2 && L >= 15) { const j = lineOf(n2); mid.push({ i: j, k: 1, s: counter(n2) }); used.add(j); } }
  if (has(/league|rank|leader|top|compete|friends|دوري|ترتيب|منافس|الأول|أصدقاء/i)) {
    const nms = ar ? ["مايا", "عمر", "لوسيا", "كينجي", "صوفيا", "أنت"] : ["Maya", "Omar", "Lucia", "Kenji", "Sofia", "You"], i = sIdx(/league|rank|leader|top|compete|friends|دوري|ترتيب|منافس|الأول|أصدقاء/i);
    mid.push({ i, k: 2, s: { sc: "board", t1: ar ? "الدوري الماسي" : "Diamond League", t2: ar ? "أفضل ثلاثة يفوزون بكأس" : "Top 3 win a trophy", items: nms.map((n, i) => n + ":" + (1340 - i * 70)), ic: "diamond" } }); used.add(i);
  }
  const CALL = /call|talk|speak|chat|tutor|conversation|مكالم|محادث|تحدث|تحدّث|مدرس|معلم/i;
  if (has(CALL)) { const i = sIdx(CALL); mid.push({ i, k: 3, s: { sc: "call", t1: ar ? "مرحباً! كيف كان يومك؟" : "Hi! How was your day?", t2: ar ? "رائع، شكراً!" : "Great, thanks!", ic: "mood" } }); used.add(i); }
  // a list: after a colon, a line with two commas, or (v162) "A, B and C" — a line not shown already, one that doesn't start with a
  // number first ("8 agents plan, film and edit" is a number); the last item loses its tail ("Seedance in one studio" → "Seedance")
  const lm = /[:：]\s*([^.!?؟\n]+)/.exec(msg), isList = (x) => (x.match(/[,،]/g) || []).length >= 2 || ((x.match(/[,،]/g) || []).length >= 1 && /\s(and|و)\s/i.test(x)) || (x.match(/\s(and|و)\s/gi) || []).length >= 2;   // (v162: "A و B و C")
  const lsI = lm ? sIdx(new RegExp(lm[1].slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) : [...sents.keys()].filter((i) => i > 0 && !used.has(i) && isList(sents[i])).sort((x, y) => /^\d/.test(sents[x]) - /^\d/.test(sents[y]))[0] ?? sents.findIndex((x) => (x.match(/[,،]/g) || []).length >= 2);
  const lsrc = lm ? lm[1] : lsI >= 0 ? sents[lsI] : "";
  // (v162: "و" alone, or joined to "ال…" — "والموسيقى"; a word that just starts with و — "واحد", "وقت" — is not cut)
  let list = lsrc.split(/\s*(?:[,،]|\band\b|\sو\s|\sو(?=ال))\s*/).map((x) => x.trim().replace(/^(and|و)\s+/i, "")).filter((x) => x && x.length <= 24);
  if (list.length >= 3) { const lw = list[list.length - 1].split(" "), cut = lw.findIndex((w, i) => i > 0 && /^(in|on|at|for|with|from|to|of|في|على|من|مع|إلى)$/i.test(w)); if (cut > 0) list[list.length - 1] = lw.slice(0, cut).join(" "); }
  if (list.length >= 2) { mid.push({ i: Math.max(0, lsI), k: 4, s: { sc: "nodes", items: list.slice(0, 6) } }); if (lsI >= 0) used.add(lsI); }
  // (v162) every other line of the brief: big words, in two parts
  sents.forEach((x, i) => { if (used.has(i) || i === li || (closing && i === li - 1)) return; const [a, c] = split150(x); mid.push({ i, k: 5, s: { sc: "words", t1: a, t2: c } }); });
  if (!closing && last && last !== first && !(lm && last.includes(lm[1])) && !mid.some((m) => m.i === li)) { const [a, c] = split150(last); closing = { sc: "words", t1: a, t2: c }; }
  // (as many scenes as the length holds — about one every two seconds; the lines that don't fit are the last of the middle ones)
  const room = Math.max(1, Math.round(L / 2.2) - 3 - (closing ? 1 : 0));
  mid.sort((x, y) => x.i - y.i || x.k - y.k); const keep = mid.filter((m) => m.k < 5).length >= room ? mid.filter((m) => m.k < 5) : mid;
  let words = room - keep.filter((m) => m.k < 5).length; out.push(...keep.filter((m) => m.k < 5 || words-- > 0).map((m) => m.s));
  if (closing) out.push(closing);
  out.push({ sc: "end", t1: brand, t2: cta || (ar ? "ابدأ اليوم" : "Start today") });
  return clean150(out, b && b.len);
}
