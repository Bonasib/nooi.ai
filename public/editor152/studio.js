// v152: what the editor page and the server share for the editor's own "agents":
//  - review152(ed, opts): a critic's read of a timeline, lens by lens (story, design, editing, audio — the director runs them all
//    in that order), each finding with its moment, how much it matters (P0 breaks the video, P1 is noticed by everyone, P2 is
//    polish) and, when it can be fixed in one step, the fix as plain data {op, args} — applyFix152() makes it, here and on the
//    server, the same way;
//  - soundPass152(ed, preset): sounds placed on the film's own moments — the cuts, a text appearing, a graphic landing, the
//    last card — by a preset (calm · crisp · minimal); free, made on the device, replaced when run again.
// Ideas from cinetic (MIT: sound roles per moment, presets, a critic's lenses and a ship gate) and Cutia (MIT: expert roles with a
// director that runs them in order); our own code. Plain data in, plain data out — no page or server objects.
export const ROLES152 = ["director", "story", "design", "editing", "audio"];
export const LENS152 = { story: ["hook", "end", "too_long", "empty"], design: ["text_fast", "text_overlap", "text_small", "fonts"], editing: ["long_hold", "flash", "mixed_trans"], audio: ["no_music", "music_loud", "no_sfx", "no_captions", "sfx_dupe"] };
const SEV = { P0: 0, P1: 1, P2: 2 };
const dur = (c) => Math.max(0.1, ((+c.out || 0) - (+c.in || 0)) / (+c.speed || 1));
export const starts152 = (cl) => { let s = 0; return (cl || []).map((c) => { const r = s; s += dur(c); return r; }); };
export const total152 = (ed) => (ed.clips || []).reduce((a, c) => a + dur(c), 0);
const r2 = (x) => +(+x).toFixed(2);
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
const short = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const isAr = (s) => /[؀-ۿ]/.test(s || "");

// opts: {w, h} the size · {music, voice} what plays under the film · lang "en"|"ar" for the words a fix writes · name the project's
export function review152(ed, opts = {}) {
  const cl = ed.clips || [], tx = ed.texts || [], inf = ed.infos || [], sfx = ed.sfx || [], st = starts152(cl), T = total152(ed);
  const w = +opts.w || 1080, h = +opts.h || 1920, vertical = h > w, ar = opts.lang === "ar", out = [];
  const add = (id, lens, sev, t, en, arw, fix) => out.push({ id, lens, sev, t: r2(Math.max(0, t || 0)), en, ar: arw, ...(fix ? { fix } : {}) });
  if (!cl.length) { add("empty", "story", "P0", 0, "The timeline is empty — add a video or a picture first.", "الخط الزمني فارغ — أضف فيديو أو صورة أولاً."); return finish(out); }
  const shown = [...tx.map((x) => ({ s: +x.start, e: +x.end, k: "text", x })), ...inf.map((x) => ({ s: +x.start, e: +x.end, k: "info", x }))];
  // ---- story: a hook in the first seconds, a last line at the end, a length the platform suits
  if (T > 6 && !shown.some((x) => x.s < 2.5)) {
    const name = String(opts.name || "").trim();
    add("hook", "story", "P1", 0, "Nothing on screen says what this is in the first seconds — most people decide to stay in the first 2.", "لا شيء على الشاشة يقول ما هذا في الثواني الأولى — معظم الناس يقررون البقاء خلال أول ثانيتين.",
      { op: "text_add", args: { id: "rv152-hook", text: name && name.length <= 40 ? name : ar ? "عنوانك هنا" : "Your title here", start: 0, end: Math.min(2.5, T), pos: "center", style: "bold", size: 9, anim: "pop" }, en: "Add a title at the start", ar: "أضف عنواناً في البداية" });
  }
  if (T > 8 && !shown.some((x) => x.e >= T - 0.5 && x.s >= T - 4)) add("end", "story", "P2", Math.max(0, T - 3), "It ends without a last line — a call to action or your name on the last seconds.", "ينتهي دون سطر أخير — دعوة لفعل شيء أو اسمك في الثواني الأخيرة.",
    { op: "text_add", args: { id: "rv152-end", text: ar ? "تابعنا للمزيد" : "Follow for more", start: r2(Math.max(0, T - 2.5)), end: r2(T), pos: "center", style: "bold", size: 8, anim: "pop" }, en: "Add a last line", ar: "أضف سطراً أخيراً" });
  // v153: stock phrases (cinetic's taste rules) — say what it does instead
  for (const x of tx) { const hit = stock153(x.text); if (hit) add("cliche:" + x.id, "story", "P2", x.start, "“" + hit + "” is a stock phrase — say what it really does.", "«" + hit + "» عبارة مستهلكة — قل ما يفعله فعلاً.", { op: "open", args: { tab: "text", text: x.id }, en: "Rewrite it", ar: "أعد كتابته" }); }
  if (vertical && T > 60) add("too_long", "story", "P1", 60, Math.round(T) + " s is long for a short vertical video — most are watched under 60 s.", Math.round(T) + " ث طويلة لفيديو عمودي قصير — معظمها يُشاهد في أقل من 60 ث.");
  // ---- design: time to read, texts on top of each other, size, fonts
  for (const x of tx) { const n = words(x.text), d = (+x.end) - (+x.start), need = Math.max(1.2, n / 2.6);
    if (n && d < need - 0.15) add("text_fast:" + x.id, "design", "P1", x.start, "“" + short(x.text, 32) + "” is on screen " + d.toFixed(1) + " s — " + need.toFixed(1) + " s to read it.", "«" + short(x.text, 32) + "» يظهر " + d.toFixed(1) + " ث — قراءته تحتاج " + need.toFixed(1) + " ث.",
      { op: "text_time", args: { id: x.id, end: r2((+x.start) + need) }, en: "Give it time to read", ar: "أعطه وقتاً للقراءة" });
    if (vertical && (+x.size || 7) < 4.5) add("text_small:" + x.id, "design", "P2", x.start, "“" + short(x.text, 32) + "” is small for a phone screen.", "«" + short(x.text, 32) + "» صغير على شاشة الجوال.", { op: "text_size", args: { id: x.id, size: 6.5 }, en: "Make it bigger", ar: "كبّره" }); }
  for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) { const a = tx[i], b = tx[j];
    if ((a.pos || "bottom") === (b.pos || "bottom") && Math.min(+a.end, +b.end) - Math.max(+a.start, +b.start) > 0.2) {
      add("text_overlap:" + b.id, "design", "P1", Math.max(+a.start, +b.start), "Two texts are on the same spot at once: “" + short(a.text, 20) + "” and “" + short(b.text, 20) + "”.", "نصّان في المكان نفسه في الوقت نفسه: «" + short(a.text, 20) + "» و«" + short(b.text, 20) + "».",
        { op: "text_pos", args: { id: b.id, pos: (b.pos || "bottom") === "top" ? "bottom" : "top" }, en: "Move one of them", ar: "انقل أحدهما" }); } }
  // v153: a phone app's buttons cover the top, the bottom and the right edge of a vertical video (a text placed by hand there)
  if (vertical) for (const x of tx) { if (x.x == null || x.y == null || x.kind) continue; const cx = +x.x, cy = +x.y;
    if (cy < 0.1 || cy > 0.8 || (cx > 0.84 && cy > 0.38 && cy < 0.8)) add("safe:" + x.id, "design", "P1", x.start, "“" + short(x.text, 32) + "” sits where phone apps put their buttons — it may be hidden.", "«" + short(x.text, 32) + "» في مكان أزرار تطبيقات الجوال — قد يختفي تحتها.",
      { op: "text_move", args: { id: x.id, x: r2(Math.min(0.8, Math.max(0.16, cx))), y: r2(Math.min(0.72, Math.max(0.14, cy))) }, en: "Move it into the safe area", ar: "انقله إلى المنطقة الآمنة" }); }
  // v153: too many words at once (one line = one beat)
  for (const x of tx) { const ws = String(x.text || "").trim().split(/\s+/).filter(Boolean); if (x.kind || ws.length <= 12) continue; const k = Math.ceil(ws.length / 2);
    add("wordy:" + x.id, "design", "P2", x.start, ws.length + " words on screen at once — two shorter lines are read, one long one is skipped.", ws.length + " كلمة على الشاشة دفعة واحدة — سطران قصيران يُقرآن، والسطر الطويل يُتجاوز.",
      { op: "text_split", args: { id: x.id, id2: "rv153-" + x.id, at: k }, en: "Split it in two", ar: "قسّمه إلى اثنين" }); }
  const fonts = [...new Set(tx.map((x) => x.font).filter(Boolean))];
  if (fonts.length > 3) { const cnt = {}; tx.forEach((x) => { if (x.font) cnt[x.font] = (cnt[x.font] || 0) + 1; }); const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    add("fonts", "design", "P2", 0, fonts.length + " different fonts — two at most keeps it calm.", fonts.length + " خطوط مختلفة — خطّان على الأكثر يبقيان الشكل هادئاً.", { op: "text_font", args: { font: top }, en: "Use one font", ar: "خط واحد" }); }
  // ---- editing: long still holds, clips that flash by, too many kinds of cut
  cl.forEach((c, i) => { const d = dur(c), still = !(c.mo && Array.isArray(c.mo.kf) && c.mo.kf.length > 1) && !(c.vfx && (c.vfx.shake || c.vfx.pulse));
    if (c.src && c.src.k === "demo" && c.src.kind === "mg150") return;   // (a motion ad's background: its scenes move)
    if (still && d > (vertical ? 5 : 7)) add("long_hold:" + c.id, "editing", "P2", st[i], "Clip " + (i + 1) + " holds " + d.toFixed(1) + " s with nothing moving.", "المقطع " + (i + 1) + " يبقى " + d.toFixed(1) + " ث دون أي حركة.",
      { op: "clip_mo", args: { id: c.id, kf: [{ t: 0, s: 1, x: 0, y: 0, r: 0 }, { t: r2(d), s: 1.15, x: 0, y: 0, r: 0 }], ease: "smooth" }, en: "Add a slow zoom", ar: "أضف تقريباً بطيئاً" });
    if (d < 0.4 && cl.length > 1) add("flash:" + c.id, "editing", "P2", st[i], "Clip " + (i + 1) + " is on screen for " + d.toFixed(2) + " s — it flashes by.", "المقطع " + (i + 1) + " يظهر " + d.toFixed(2) + " ث فقط — يمر كوميض."); });
  // v153: it plays like a slideshow (OpenMontage's "slideshow risk"): clips that hold still, all about one length, mostly pictures
  const real = cl.filter((c) => !(c.src && c.src.k === "demo")), still = real.filter((c) => !(c.mo && Array.isArray(c.mo.kf) && c.mo.kf.length > 1) && !(c.vfx && (c.vfx.shake || c.vfx.pulse)));
  if (real.length >= 4) { const ds = real.map(dur), m = ds.reduce((a, b) => a + b, 0) / ds.length, cv = Math.sqrt(ds.reduce((a, b) => a + (b - m) * (b - m), 0) / ds.length) / m;
    const risk = (still.length / real.length >= 0.6 ? 1 : 0) + (cv < 0.15 ? 1 : 0) + ((+opts.pics || 0) / real.length >= 0.5 ? 1 : 0);
    if (risk >= 2 && still.length) add("slideshow", "editing", "P1", 0, "It plays like a slideshow: " + still.length + " of " + real.length + " clips hold still" + (cv < 0.15 ? ", all about the same length" : "") + ".", "يبدو كعرض شرائح: " + still.length + " من " + real.length + " مقاطع ثابتة" + (cv < 0.15 ? "، وكلها بالطول نفسه تقريباً" : "") + ".",
      { op: "clips_mo", args: { items: still.map((c, i) => ({ id: c.id, kf: moveKf153(i, r2(dur(c))) })) }, en: "Add a camera move to each still clip", ar: "أضف حركة كاميرا لكل مقطع ثابت" }); }
  const tr = cl.slice(0, -1).map((c) => c.trans || "cut").filter((x) => x !== "cut"), kinds = [...new Set(tr)];
  if (kinds.length > 3) { const cnt = {}; tr.forEach((x) => (cnt[x] = (cnt[x] || 0) + 1)); const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    add("mixed_trans", "editing", "P2", 0, kinds.length + " different transitions — one or two make a film feel made with intent.", kinds.length + " انتقالات مختلفة — واحد أو اثنان يجعلان الفيلم مقصوداً.", { op: "trans_all", args: { trans: top }, en: "Use one transition", ar: "انتقال واحد" }); }
  // ---- audio: music, the voice over it, silent cuts, captions, the same sound twice
  const cuts = Math.max(0, cl.length - 1);
  if (!opts.music && T > 10) add("no_music", "audio", "P2", 0, "No music under the film.", "لا موسيقى تحت الفيلم.", { op: "open", args: { tab: "audio" }, en: "Add music", ar: "أضف موسيقى" });
  if (opts.music && opts.voice && !ed.duck144 && (ed.musicVol ?? 80) > 50) add("music_loud", "audio", "P1", 0, "The music is as loud as the voice — it competes with the words.", "الموسيقى بعلوّ الصوت نفسه — تنافس الكلام.",
    { op: "mix", args: { musicVol: 45, duck144: true }, en: "Lower it under the voice", ar: "اخفضها تحت الصوت" });
  if (cuts >= 2 && !sfx.length) add("no_sfx", "audio", "P2", st[1] || 0, "The cuts are silent — a sound on each makes them land.", "القطعات صامتة — صوت عند كل قطع يجعلها أوضح.", { op: "sound_pass", args: { preset: "crisp" }, en: "Sound the cuts", ar: "أضف أصوات القطعات" });
  if (opts.voice && !(ed.caps && ed.caps.on && ed.caps.words && ed.caps.words.length)) add("no_captions", "audio", "P1", 0, "There's a voice but no captions — most people watch with the sound off.", "هناك صوت بلا ترجمة — معظم الناس يشاهدون والصوت مغلق.", { op: "open", args: { tab: "words" }, en: "Make captions", ar: "اصنع الترجمة" });
  const dup = []; sfx.forEach((a, i) => { if (sfx.slice(0, i).some((b) => b.n === a.n && b.n !== "file" && Math.abs(+b.t - +a.t) < 0.05)) dup.push(a.id); });
  if (dup.length) add("sfx_dupe", "audio", "P2", (sfx.find((x) => x.id === dup[0]) || {}).t, dup.length + " sound(s) play twice at the same moment.", dup.length + " صوت يُشغَّل مرتين في اللحظة نفسها.", { op: "sfx_remove", args: { ids: dup }, en: "Remove the copies", ar: "احذف النسخ" });
  return finish(out);
}
function finish(out) {
  out.sort((a, b) => SEV[a.sev] - SEV[b.sev] || a.t - b.t);
  const score = Math.max(0, 100 - out.reduce((s, x) => s + (x.sev === "P0" ? 40 : x.sev === "P1" ? 12 : 5), 0));
  return { issues: out, score, ship: !out.some((x) => x.sev === "P0") && out.filter((x) => x.sev === "P1").length <= 1 };
}
// the findings a role looks at (the director: all of them, story first)
export function forRole152(rv, role) { if (!role || role === "director") return rv.issues.slice().sort((a, b) => ["story", "design", "editing", "audio"].indexOf(a.lens) - ["story", "design", "editing", "audio"].indexOf(b.lens) || SEV[a.sev] - SEV[b.sev]); return rv.issues.filter((x) => x.lens === role); }

// ---- the sound pass: which sound plays each kind of moment, by preset (null = none)
export const PRESETS152 = {
  calm: { cut: ["swell", 0.6, 55], text: ["pluck", 0.01, 60], info: ["thump", 0.01, 60], end: ["bell", 0.01, 70] },
  crisp: { cut: ["whoosh", 0.28, 60], text: ["tick", 0.005, 55], info: ["pop", 0.005, 65], end: ["impact", 0.01, 75], big: ["riser", 1.5, 45] },
  minimal: { cut: null, text: null, info: ["tick", 0.005, 40], end: ["subdrop", 0.05, 80], big: ["subdrop", 0.05, 70] } };
export function soundPass152(ed, preset, mkId) {
  const P = PRESETS152[preset] || PRESETS152.crisp, cl = ed.clips || [], st = starts152(cl), T = total152(ed), own = (ed.sfx || []).filter((x) => !x.sp152), cues = [];
  const at = (t, role, pick) => { const R = P[role]; if (!R) return; const n = pick ? pick(R[0]) : R[0], tt = r2(Math.max(0, t - R[1])); cues.push({ t: tt, at: t, n, vol: R[2], role }); };
  for (let i = 1; i < cl.length; i++) { const c = cl[i - 1], half = c.trans && c.trans !== "cut" ? 0.18 : 0; at(st[i] - half, "cut"); }
  if (P.big && cl.length > 2) { const i = Math.max(1, Math.round(cl.length * 0.6)); at(st[i], "big"); }
  let k = 0; (ed.texts || []).slice().sort((a, b) => a.start - b.start).forEach((x) => at(+x.start, "text", (n) => (TYPING153.includes(x.anim) ? "typing" : n === "pluck" ? "pluck:" + (k++ % 5) : n)));   // (v153: typed words get keys)
  (ed.infos || []).filter((x) => x.type !== "mg150").forEach((x) => at(+x.start, "info"));
  const last = [...(ed.texts || []), ...(ed.infos || [])].filter((x) => +x.start >= T - 4).sort((a, b) => b.start - a.start)[0];
  if (last) { for (let i = cues.length - 1; i >= 0; i--) if (Math.abs(cues[i].at - last.start) < 0.05) cues.splice(i, 1); at(+last.start, "end"); }
  cues.sort((a, b) => a.at - b.at);
  const kept = []; for (const q of cues) { if (q.at > T + 0.01) continue; if (kept.some((x) => Math.abs(x.at - q.at) < 0.25 && (x.role === "big") === (q.role === "big"))) continue; if (own.some((x) => Math.abs(+x.t - q.t) < 0.3)) continue; kept.push(q); }   // (a riser leading into a cut keeps both)
  return kept.map((q, i) => ({ id: mkId ? mkId(i) : "sp152-" + i + "-" + Math.round(q.t * 100), n: q.n, t: q.t, vol: q.vol, sp152: preset }));
}

// a fix made on a plain project document (the page's S.ed or the server's doc.ed) — the same everywhere
export function applyFix152(ed, fix, mkId) {
  const a = (fix && fix.args) || {}, t = (id) => (ed.texts || []).find((x) => x.id === id);
  switch (fix && fix.op) {
    case "text_add": { ed.texts = ed.texts || []; const id = mkId ? mkId() : a.id; if (ed.texts.some((x) => x.id === id)) return false; ed.texts.push({ id, text: a.text, start: a.start, end: a.end, pos: a.pos || "center", style: a.style || "bold", size: a.size || 8, anim: a.anim || "pop" }); return true; }
    case "text_time": { const x = t(a.id); if (!x) return false; x.end = a.end; return true; }
    case "text_pos": { const x = t(a.id); if (!x) return false; x.pos = a.pos; return true; }
    case "text_size": { const x = t(a.id); if (!x) return false; x.size = a.size; return true; }
    case "text_font": { (ed.texts || []).forEach((x) => { if (x.font) x.font = a.font; }); return true; }
    case "text_move": { const x = t(a.id); if (!x) return false; x.x = a.x; x.y = a.y; return true; }
    case "text_split": { const x = t(a.id), id2 = mkId ? mkId() : a.id2; if (!x || (ed.texts || []).some((y) => y.id === id2)) return false; const ws = String(x.text || "").trim().split(/\s+/), k = Math.max(1, Math.min(ws.length - 1, +a.at || Math.ceil(ws.length / 2)));
      const mid = r2((+x.start) + ((+x.end) - (+x.start)) * k / ws.length), y = JSON.parse(JSON.stringify(x)); y.id = id2; y.text = ws.slice(k).join(" "); y.start = mid; x.text = ws.slice(0, k).join(" "); x.end = mid; ed.texts.splice(ed.texts.indexOf(x) + 1, 0, y); return true; }
    case "clips_mo": { let n = 0; for (const it of a.items || []) { const c = (ed.clips || []).find((y) => y.id === it.id); if (!c) continue; c.mo = Object.assign({}, c.mo || {}, { kf: it.kf, ease: "smooth", anim: true }); n++; } return n > 0; }
    case "clip_mo": { const c = (ed.clips || []).find((x) => x.id === a.id); if (!c) return false; c.mo = Object.assign({}, c.mo || {}, { kf: a.kf, ease: a.ease || "smooth", anim: true }); return true; }
    case "trans_all": { (ed.clips || []).forEach((c, i, l) => { if (i < l.length - 1 && c.trans && c.trans !== "cut") c.trans = a.trans; }); return true; }
    case "mix": { if (a.musicVol != null) ed.musicVol = a.musicVol; if (a.duck144 != null) ed.duck144 = !!a.duck144; return true; }
    case "sfx_remove": { const ids = new Set(a.ids || []); ed.sfx = (ed.sfx || []).filter((x) => !ids.has(x.id)); return true; }
    case "sound_pass": { ed.sfx = (ed.sfx || []).filter((x) => !x.sp152).concat(Array.isArray(a.sfx) ? a.sfx : soundPass152(ed, a.preset, mkId ? () => mkId() : null)); return true; }   // (a.sfx: the sounds an agent's pass already placed)
    default: return false;
  }
}
export const isArText152 = isAr;

// ---- the looks an agent may set (the same names the editor's tiles use)
export const FRAMES152 = ["none", "polaroid", "card", "phone", "tv", "film", "neon", "finder", "vintage", "comic", "border", "double"];
export const FILTERS152 = ["none", "duo_night", "duo_sunset", "duo_mint", "duo_rose", "pop_red", "pop_blue", "pop_green", "pop_yellow", "halftone", "poster", "sketch", "thermal", "night"];
export const TRANS152 = ["cut", "fade", "dip", "slide", "zoom", "whip", "spin", "flash", "glitch", "wipe", "blurx", "shutter", "split", "whipblur",
  "gl_push", "gl_softwipe", "gl_crosszoom", "gl_dreamy", "gl_dreamzoom", "gl_blurmix", "gl_zoomthru", "gl_swirl", "gl_cube", "gl_ripple", "gl_drop", "gl_clock", "gl_circle", "gl_pixels", "gl_slices", "gl_glitchmem", "gl_filmburn", "gl_melt", "gl_doorway", "gl_pageflip", "gl_noise", "gl_curtain",
  "wipe_l", "wipe_r", "wipe_u", "wipe_d", "slide_l", "slide_r", "slide_u", "slide_d", "iris", "bands", "dot", "rise", "flip", "zoomout", "dissolve"];
// args: {transition, trans_len (s), filter, filter_amount (0–100), frame, frame_color "#rrggbb", clips: [ids] (default: every clip)}
// → the names it changed, or null when something asked for isn't one of the editor's own
export function applyStyle152(ed, a = {}) {
  const bad = (a.transition != null && !TRANS152.includes(a.transition)) || (a.filter != null && !FILTERS152.includes(a.filter)) || (a.frame != null && !FRAMES152.includes(a.frame)) ||
    (a.frame_color != null && !/^#[0-9a-f]{6}$/i.test(a.frame_color));
  if (bad) return null;
  const want = Array.isArray(a.clips) && a.clips.length ? new Set(a.clips) : null, cl = (ed.clips || []).filter((c) => !want || want.has(c.id)), done = [];
  if (a.transition != null) { cl.forEach((c) => { if ((ed.clips || []).indexOf(c) < (ed.clips || []).length - 1) { c.trans = a.transition; if (a.trans_len != null) c.trd = Math.min(2, Math.max(0.1, +a.trans_len || 0.6)); } }); done.push("transition"); }
  if (a.filter != null) { cl.forEach((c) => { if (a.filter === "none") { delete c.f152; delete c.f152a; } else { c.f152 = a.filter; c.f152a = Math.min(100, Math.max(0, a.filter_amount == null ? 100 : +a.filter_amount)); } }); done.push("filter"); }
  if (a.frame != null || a.frame_color != null) { ed.fr152 = Object.assign({}, ed.fr152, a.frame != null ? { id: a.frame } : {}, a.frame_color != null ? { col: a.frame_color } : {}); done.push("frame"); }
  return done;
}

// ---- v153
export const TYPING153 = ["type", "t152_cursor"];
const STOCK153 = ["take it to the next level", "next level", "game-changer", "game changer", "revolutionize", "revolutionise", "revolutionary", "unlock", "seamless", "cutting-edge", "cutting edge", "elevate", "unleash", "supercharge", "look no further", "like never before", "in today's world", "world-class", "best-in-class",
  "نقلة نوعية", "لا مثيل له", "الحل الأمثل", "الأفضل على الإطلاق", "ثوري", "عالمي المستوى"];
export function stock153(text) { const s = String(text || "").toLowerCase(); for (const w of STOCK153) { const i = s.indexOf(w); if (i < 0) continue; const b = s[i - 1], e = s[i + w.length]; if ((!b || !/[a-z\u0600-\u06ff]/.test(b)) && (!e || !/[a-z\u0600-\u06ff]/.test(e) || /^(s|d|ing|ed)$/.test(s.slice(i + w.length, i + w.length + 3).replace(/[^a-z]/g, "")))) return w; } return null; }
// a camera move for a still clip (slow push, slow pull, a pan each way — one after another so the clips don't all move alike)
export function moveKf153(i, d) { const z = (t, s, x) => ({ t: r2(t), s, x, y: 0, r: 0 });
  return [[z(0, 1, 0), z(d, 1.18, 0)], [z(0, 1.18, 0), z(d, 1, 0)], [z(0, 1.15, 0.06), z(d, 1.15, -0.06)], [z(0, 1.15, -0.06), z(d, 1.15, 0.06)]][i % 4]; }
// style kits (OpenMontage's style playbooks, our own looks): one tap sets the cut, the colour, the frame, the title motion and the sound pass
export const KITS153 = [
  { id: "clean", en: "Clean professional", ar: "احترافي نظيف", trans: "fade", trd: 0.5, look: "none", filter: null, frame: "none", tm: "t152_maskrise", sound: "calm" },
  { id: "flat", en: "Flat motion", ar: "حركة مسطحة", trans: "slide_l", trd: 0.35, look: "none", filter: null, frame: "card", tm: "t152_slam", sound: "crisp" },
  { id: "minimal", en: "Minimal", ar: "بسيط", trans: "cut", trd: 0.5, look: "none", filter: null, frame: "double", fcol: "#ffffff", tm: "t152_blurrise", sound: "minimal" },
  { id: "cinema", en: "Cinematic", ar: "سينمائي", trans: "fade", trd: 1, look: "teal", filter: null, frame: "none", tm: "t152_tracking", sound: "calm" },
  { id: "retro", en: "Retro film", ar: "فيلم قديم", trans: "dip", trd: 0.6, look: "vintage", filter: null, frame: "film", tm: "t152_scramble", sound: "crisp" },
  { id: "neon", en: "Neon night", ar: "ليل النيون", trans: "iris", trd: 0.5, look: "none", filter: "duo_night", amt: 70, frame: "neon", fcol: "#ff4fa3", tm: "t152_slice", sound: "crisp" },
  { id: "social", en: "Social pop", ar: "سوشيال حيوي", trans: "whip", trd: 0.3, look: "none", filter: null, frame: "none", tm: "pop", sound: "crisp" },
  { id: "doc", en: "Documentary", ar: "وثائقي", trans: "fade", trd: 0.8, look: "film", filter: null, frame: "none", tm: "fade", sound: "minimal" }];
// opts.sfx: the sounds already placed (an agent's kit) · mkId: new sound ids. → what changed, or null for an unknown kit
export function applyKit153(ed, id, opts = {}) {
  const K = KITS153.find((k) => k.id === id); if (!K) return null; const cl = (ed.clips || []).filter((c) => !(c.src && c.src.k === "demo"));
  cl.forEach((c, i) => { if (i < cl.length - 1) { c.trans = K.trans; c.trd = K.trd; }
    if (K.filter) { c.f152 = K.filter; c.f152a = K.amt || 100; } else { delete c.f152; delete c.f152a; }
    c.cg = Object.assign({}, c.cg || {}, { look: K.look }); });
  ed.fr152 = K.frame === "none" ? { id: "none" } : Object.assign({ id: K.frame }, K.fcol ? { col: K.fcol } : {});
  (ed.texts || []).forEach((x) => { if (!x.kind) x.anim = K.tm; });
  ed.sfx = (ed.sfx || []).filter((x) => !x.sp152).concat(Array.isArray(opts.sfx) ? opts.sfx : soundPass152(ed, K.sound, opts.mkId || null));
  ed.kit153 = K.id; return ["transition", K.filter ? "filter" : "colour", "frame", "titles", "sounds"];
}
