// nooi Motion templates, second set (v229): more lower thirds, titles, social, charts, backgrounds, callouts, timers,
// sound-reactive, intros & outros and full-frame wipes. Same rules as the first set: drawn frame by frame from their props, the
// same frame always draws the same picture, Arabic and right-to-left words drawn as words. Our own designs.
import { Motion as M } from "@nooi/editor-core";
import { AR, BG, L3, T, cl, ease, labels, life, measure, nums, outK, px0, rrect, sp, text, words, type MCtx, type Template } from "./kit";

const bounceOut = (t: number) => 1 - ease.bounce(1 - t);
const PAL = ["#00F0FF", "#7B61FF", "#FF3D9A", "#ffd23f", "#2dd4a8", "#ff7a1a"];
const A2 = (def = "#7B61FF") => BG({ k: "accent2", en: "Second colour", ar: "اللون الثاني", def });
const unitsOf = (s: string) => (AR.test(s) ? words(s) : [...s]);   // Arabic letters stay joined: it moves word by word
const pct = (m: MCtx, k: string, of: number) => (Number(m.p[k]) / 100) * of;
const spacing = (x: CanvasRenderingContext2D, px: number) => { try { (x as unknown as { letterSpacing: string }).letterSpacing = px + "px"; } catch { /* older browsers */ } };

export const MORE: Template[] = [
  // ======== lower thirds
  { id: "lt-glass", en: "Glass card", ar: "بطاقة زجاجية", group: "lower", dur: 5, fields: L3("Rami Saleh", "Product Lead"), draw(m) {
    const x = m.ctx, u = m.u, n = String(m.p.name), r = String(m.p.role), k = 1 - outK(m), a = sp(m);
    const w = Math.max(measure(m, n, u * 0.06, 800), measure(m, r, u * 0.036, 500)) + u * 0.12, h = u * 0.16, X = px0(m, w), Y = m.H * 0.72 + (1 - a) * u * 0.08;
    x.globalAlpha = k * cl(a * 1.5); rrect(x, X, Y, w, h, u * 0.03); x.fillStyle = "rgba(255,255,255,.14)"; x.fill(); x.strokeStyle = "rgba(255,255,255,.4)"; x.lineWidth = u * 0.003; x.stroke();
    x.beginPath(); x.arc(X + u * 0.045, Y + h * 0.36, u * 0.013 * sp(m, 6), 0, 7); x.fillStyle = m.p.accent; x.fill();
    x.globalAlpha = k * cl(sp(m, 5)); text(m, n, X + u * 0.075, Y + h * 0.36, { px: u * 0.06, weight: 800 }); text(m, r, X + u * 0.075, Y + h * 0.72, { px: u * 0.036, weight: 500, color: "rgba(255,255,255,.82)" }); } },
  { id: "lt-corner", en: "Corner brackets", ar: "أقواس الزوايا", group: "lower", dur: 5, fields: L3("Dana Youssef", "Architect"), draw(m) {
    const x = m.ctx, u = m.u, n = String(m.p.name), r = String(m.p.role), k = 1 - outK(m), w = Math.max(measure(m, n, u * 0.065, 800), measure(m, r, u * 0.036, 500)) + u * 0.1, h = u * 0.18, X = px0(m, w), Y = m.H * 0.7;
    const a = ease.easeOut(cl(m.t / 0.6)), L = u * 0.05 * a, ex = (1 - ease.snappy(cl(m.t / 0.6))) * u * 0.06;
    x.globalAlpha = k; x.strokeStyle = m.p.accent; x.lineWidth = u * 0.007; x.lineCap = "square";
    x.beginPath(); x.moveTo(X - ex, Y + L - ex); x.lineTo(X - ex, Y - ex); x.lineTo(X + L - ex, Y - ex); x.moveTo(X + w + ex, Y + h - L + ex); x.lineTo(X + w + ex, Y + h + ex); x.lineTo(X + w - L + ex, Y + h + ex); x.stroke();
    x.globalAlpha = k * cl((m.t - 0.25) / 0.4); text(m, n, X + u * 0.05, Y + h * 0.4 + (1 - cl((m.t - 0.25) / 0.4)) * u * 0.03, { px: u * 0.065, weight: 800 });
    x.globalAlpha = k * cl((m.t - 0.45) / 0.4); text(m, r, X + u * 0.05, Y + h * 0.74, { px: u * 0.036, weight: 500, color: "rgba(255,255,255,.8)" }); } },
  { id: "lt-slant", en: "Slanted bars", ar: "أشرطة مائلة", group: "lower", dur: 5, fields: [...L3("Yara Haddad", "Sports Desk"), A2("#111318")], draw(m) {
    const x = m.ctx, u = m.u, n = String(m.p.name).toUpperCase(), r = String(m.p.role), k = 1 - outK(m), w1 = measure(m, n, u * 0.058, 900) + u * 0.09, w2 = measure(m, r, u * 0.036, 600) + u * 0.09, X = px0(m, Math.max(w1, w2)), Y = m.H * 0.72;
    const a = ease.snappy(cl(m.t / 0.45)), b = ease.snappy(cl((m.t - 0.18) / 0.45));
    x.globalAlpha = k; x.save(); x.translate(X, Y); x.transform(1, 0, -0.25, 1, 0, 0);
    x.fillStyle = m.p.accent2; x.fillRect(0, 0, w1 * a, u * 0.085); x.fillStyle = m.p.accent; x.fillRect(u * 0.04, u * 0.085, w2 * b, u * 0.058);
    x.beginPath(); x.rect(0, 0, w1 * a, u * 0.085); x.rect(u * 0.04, u * 0.085, w2 * b, u * 0.058); x.clip(); x.setTransform(1, 0, 0, 1, 0, 0);
    text(m, n, X + u * 0.035, Y + u * 0.044, { px: u * 0.058, weight: 900, color: "#fff" }); text(m, r, X + u * 0.06, Y + u * 0.115, { px: u * 0.036, weight: 700, color: "#0f1014" }); x.restore(); } },
  { id: "lt-gradient", en: "Gradient strip", ar: "شريط متدرج", group: "lower", dur: 5, fields: [...L3("Hassan Ali", "Live from Cairo"), A2()], draw(m) {
    const x = m.ctx, u = m.u, n = String(m.p.name), r = String(m.p.role), k = 1 - outK(m), h = u * 0.13, Y = m.H * 0.76, a = ease.easeInOut(cl(m.t / 0.7)), W = m.W * 0.88 * a, X = (m.W - W) / 2;
    const g = x.createLinearGradient(X, 0, X + W, 0); g.addColorStop(0, m.p.accent); g.addColorStop(1, m.p.accent2);
    x.globalAlpha = k; rrect(x, X, Y, W, h, h / 2); x.fillStyle = g; x.fill(); x.save(); rrect(x, X, Y, W, h, h / 2); x.clip();
    x.globalAlpha = k * cl((m.t - 0.4) / 0.4); const cx = m.W * 0.06 + h * 0.6; text(m, n, cx, Y + h * 0.38, { px: u * 0.05, weight: 800, color: "#0f1014" }); text(m, r, cx, Y + h * 0.72, { px: u * 0.032, weight: 600, color: "rgba(15,16,20,.75)" });
    const lx = m.W * 0.06 + h * 0.25; x.beginPath(); x.arc(lx, Y + h / 2, h * 0.16 * (0.85 + 0.15 * Math.sin(m.t * 6)), 0, 7); x.fillStyle = "#ff2d2d"; x.fill(); x.restore(); } },
  // ======== titles & typography
  { id: "ti-wave", en: "Letter wave", ar: "موجة الحروف", group: "titles", dur: 5, fields: [T("text", "text", "Words", "الكلمات", ["Good vibes only", "طاقة إيجابية فقط"]), BG(), A2("#FF3D9A"), T("size", "number", "Size", "الحجم", 1, { min: 0.4, max: 2, step: 0.05 })], draw(m) {
    const x = m.ctx, u = m.u, s = String(m.p.text), us = unitsOf(s), ar = AR.test(s), px = u * 0.11 * m.p.size, gap = ar ? px * 0.3 : 0, k = life(m, 0.4, 0.4);
    const ws = us.map((c) => measure(m, c, px, 900)), total = ws.reduce((a, b) => a + b, 0) + gap * (us.length - 1); let X = (m.W - total) / 2; const order = ar ? [...us.keys()].reverse() : [...us.keys()];
    for (const i of order) { const y = Math.sin(m.t * 4 - i * 0.55) * px * 0.22, c = M.interpolateColors(Math.sin(m.t * 2 - i * 0.4) * 0.5 + 0.5, [0, 1], [m.p.accent, m.p.accent2]);
      x.globalAlpha = k; text(m, us[i], X + ws[i] / 2, m.H / 2 + y, { px, weight: 900, color: c, align: "center" }); X += ws[i] + gap; } } },
  { id: "ti-outline", en: "Outline, then fill", ar: "حدود ثم تعبئة", group: "titles", dur: 4, fields: [T("text", "text", "Words", "الكلمات", ["THE JOURNEY", "الرحلة"]), T("color", "color", "Colour", "اللون", "#ffffff"), BG()], draw(m) {
    const x = m.ctx, u = m.u, px = u * 0.14, s = String(m.p.text), k = 1 - outK(m), a = ease.easeInOut(cl(m.t / 1.4)), L = u * 3;
    x.globalAlpha = k; x.font = `900 ${px}px "Inter","Cairo",system-ui,sans-serif`; x.direction = AR.test(s) ? "rtl" : "ltr"; x.textAlign = "center"; x.textBaseline = "middle";
    x.setLineDash([L * a, L]); x.lineWidth = u * 0.004; x.strokeStyle = m.p.accent; x.strokeText(s, m.W / 2, m.H / 2); x.setLineDash([]);
    x.globalAlpha = k * cl((m.t - 1.1) / 0.6); x.fillStyle = m.p.color; x.fillText(s, m.W / 2, m.H / 2); } },
  { id: "ti-bounce", en: "Bouncy drop", ar: "سقوط مرن", group: "titles", dur: 4, fields: [T("text", "text", "Words", "الكلمات", ["Let's go!", "هيا بنا!"]), T("color", "color", "Colour", "اللون", "#ffd23f"), T("size", "number", "Size", "الحجم", 1, { min: 0.4, max: 2, step: 0.05 })], draw(m) {
    const x = m.ctx, u = m.u, ws = words(m.p.text), px = u * 0.13 * m.p.size, gap = px * 0.3, rtl = AR.test(m.p.text), k = 1 - outK(m);
    const widths = ws.map((w) => measure(m, w, px, 900)), total = widths.reduce((s, w) => s + w, 0) + gap * (ws.length - 1); let X = (m.W - total) / 2; const order = rtl ? [...ws.keys()].reverse() : [...ws.keys()];
    for (const i of order) { const b = bounceOut(cl((m.t - i * 0.15) / 0.9)), sq = 1 + 0.12 * Math.max(0, Math.sin(cl((m.t - i * 0.15 - 0.35) / 0.2) * Math.PI)) * (b > 0.9 ? 1 : 0);
      x.save(); x.globalAlpha = k * cl((m.t - i * 0.15) / 0.1); x.translate(X + widths[i] / 2, m.H / 2 - (1 - b) * m.H * 0.6 + px * 0.5); x.scale(sq, 2 - sq); text(m, ws[i], 0, -px * 0.5, { px, weight: 900, color: m.p.color, align: "center" }); x.restore(); X += widths[i] + gap; } } },
  { id: "ti-rotate", en: "Rotating words", ar: "كلمات متبدّلة", group: "titles", dur: 6, fields: [T("lead", "text", "First line", "السطر الأول", ["We make videos", "نصنع فيديوهات"]), T("list", "list", "Words that change", "كلمات تتبدّل", ["faster, smarter, better", "أسرع، أذكى، أجمل"]), BG(), T("each", "number", "Seconds each", "ثوانٍ لكل كلمة", 1.2, { min: 0.4, max: 4, step: 0.1 })], draw(m) {
    const x = m.ctx, u = m.u, px = u * 0.09, list = labels(m.p.list).filter(Boolean), n = Math.max(1, list.length), each = Math.max(0.2, Number(m.p.each)), i = Math.floor(m.t / each), local = m.t - i * each, k = life(m, 0.4, 0.4);
    x.globalAlpha = k; text(m, m.p.lead, m.W / 2, m.H / 2 - px * 0.65, { px, weight: 700, align: "center" });
    const cur = list[i % n] || "", prev = list[(i - 1 + n) % n] || "", s = ease.snappy(cl(local / 0.45)), bw = Math.max(measure(m, cur, px, 900), u * 0.2) + u * 0.08, top = m.H / 2 + px * 0.05, h = px * 1.25;
    rrect(x, (m.W - bw) / 2, top, bw, h, u * 0.02); x.fillStyle = m.p.accent; x.fill(); x.save(); x.beginPath(); x.rect(0, top, m.W, h); x.clip();
    if (i > 0) text(m, prev, m.W / 2, top + h / 2 - s * h, { px, weight: 900, color: "#0f1014", align: "center" }); text(m, cur, m.W / 2, top + h / 2 + (1 - s) * h * (i > 0 ? 1 : 0), { px, weight: 900, color: "#0f1014", align: "center" }); x.restore(); } },
  { id: "ti-split", en: "Split reveal", ar: "كشف منقسم", group: "titles", dur: 4, fields: [T("text", "text", "Words", "الكلمات", ["NEW SEASON", "موسم جديد"]), T("color", "color", "Colour", "اللون", "#ffffff"), BG()], draw(m) {
    const x = m.ctx, u = m.u, px = u * 0.14, k = 1 - outK(m), a = ease.snappy(cl(m.t / 0.8)), off = (1 - a) * m.W * 0.6, cy = m.H / 2;
    x.globalAlpha = k; x.fillStyle = m.p.accent; x.fillRect(m.W / 2 - m.W * 0.35 * a, cy - u * 0.002, m.W * 0.7 * a, u * 0.004);
    x.save(); x.beginPath(); x.rect(0, cy - px, m.W, px); x.clip(); text(m, m.p.text, m.W / 2 - off, cy, { px, weight: 900, color: m.p.color, align: "center" }); x.restore();
    x.save(); x.beginPath(); x.rect(0, cy, m.W, px); x.clip(); text(m, m.p.text, m.W / 2 + off, cy, { px, weight: 900, color: m.p.color, align: "center" }); x.restore(); } },
  { id: "ti-cinema", en: "Cinematic title", ar: "عنوان سينمائي", group: "titles", dur: 6, fields: [T("text", "text", "Title", "العنوان", ["THE LAST LIGHT", "الضوء الأخير"]), T("sub", "text", "Small line", "سطر صغير", ["A nooi film", "فيلم من نوي"]), T("bars", "bool", "Cinema bars", "أشرطة سينمائية", true)], draw(m) {
    const x = m.ctx, u = m.u, k = life(m, 1.2, 1), s = 1 + 0.06 * (m.t / m.dur), ar = AR.test(m.p.text);
    if (m.p.bars) { const bh = m.H * 0.12 * ease.easeInOut(cl(m.t / 0.8)) * (1 - outK(m, 0.6)); x.fillStyle = "#000"; x.fillRect(0, 0, m.W, bh); x.fillRect(0, m.H - bh, m.W, bh); }
    x.save(); x.globalAlpha = k; x.translate(m.W / 2, m.H / 2); x.scale(s, s); if (!ar) spacing(x, u * 0.025 * (1 + m.t / m.dur)); text(m, m.p.text, 0, 0, { px: u * 0.09, weight: 300, align: "center", maxW: m.W * 0.85 }); spacing(x, 0); x.restore();
    x.globalAlpha = Math.min(k, cl((m.t - 1.2) / 0.8)); if (!AR.test(m.p.sub)) spacing(x, u * 0.012); text(m, String(m.p.sub).toUpperCase(), m.W / 2, m.H / 2 + u * 0.1, { px: u * 0.028, weight: 600, color: "rgba(255,255,255,.7)", align: "center" }); spacing(x, 0); } },
  // ======== social
  { id: "so-story", en: "Story bars", ar: "أشرطة القصة", group: "social", dur: 6, fields: [T("count", "number", "Parts", "الأجزاء", 4, { min: 1, max: 12, step: 1 }), T("name", "text", "Name", "الاسم", ["nooi.ai", "نوي"]), T("ago", "text", "Time", "الوقت", ["2h", "منذ ساعتين"]), BG({ def: "#ffffff" })], draw(m) {
    const x = m.ctx, u = m.u, n = Math.max(1, Math.round(m.p.count)), pad = m.W * 0.03, gap = u * 0.01, w = (m.W - pad * 2 - gap * (n - 1)) / n, y = m.H * 0.04, k = life(m, 0.3, 0.3), done = (m.t / m.dur) * n;
    x.globalAlpha = k; for (let i = 0; i < n; i++) { const X = pad + i * (w + gap); rrect(x, X, y, w, u * 0.008, u * 0.004); x.fillStyle = "rgba(255,255,255,.35)"; x.fill(); rrect(x, X, y, w * cl(done - i), u * 0.008, u * 0.004); x.fillStyle = m.p.accent; x.fill(); }
    x.beginPath(); x.arc(pad + u * 0.035, y + u * 0.06, u * 0.028, 0, 7); const g = x.createLinearGradient(pad, y, pad + u * 0.07, y + u * 0.1); g.addColorStop(0, "#ffd23f"); g.addColorStop(1, "#FF3D9A"); x.fillStyle = g; x.fill();
    text(m, m.p.name, pad + u * 0.075, y + u * 0.06, { px: u * 0.032, weight: 700 }); text(m, m.p.ago, pad + u * 0.085 + measure(m, m.p.name, u * 0.032, 700), y + u * 0.06, { px: u * 0.028, weight: 500, color: "rgba(255,255,255,.7)" }); } },
  { id: "so-poll", en: "Poll", ar: "تصويت", group: "social", dur: 6, fields: [T("q", "text", "Question", "السؤال", ["Which one is better?", "أيهما أفضل؟"]), T("a", "text", "Answer A", "الخيار أ", ["Morning", "الصباح"]), T("b", "text", "Answer B", "الخيار ب", ["Night", "الليل"]), T("pa", "number", "A gets (%)", "نسبة أ (%)", 64, { min: 0, max: 100, step: 1 }), BG()], draw(m) {
    const x = m.ctx, u = m.u, w = Math.min(m.W * 0.7, u * 0.9), X = (m.W - w) / 2, Y = m.H * 0.22 + (1 - sp(m)) * u * 0.2, k = 1 - outK(m), g = ease.easeInOut(cl((m.t - 1.4) / 1.2)), pa = cl(Number(m.p.pa) / 100), h = u * 0.62;
    x.globalAlpha = k * cl(m.t / 0.3); rrect(x, X, Y, w, h, u * 0.04); x.fillStyle = "rgba(255,255,255,.96)"; x.fill();
    text(m, m.p.q, m.W / 2, Y + u * 0.1, { px: u * 0.05, weight: 800, color: "#111", align: "center", maxW: w * 0.9 });
    [[m.p.a, pa], [m.p.b, 1 - pa]].forEach(([lab, v], i) => { const by = Y + u * (0.22 + i * 0.17), bx = X + u * 0.05, bw = w - u * 0.1, bh = u * 0.12; rrect(x, bx, by, bw, bh, u * 0.025); x.fillStyle = "#eceef2"; x.fill();
      rrect(x, bx, by, bw * (v as number) * g, bh, u * 0.025); x.fillStyle = i === 0 ? m.p.accent : "#c7cbd4"; x.fill();
      text(m, String(lab), bx + u * 0.03, by + bh / 2, { px: u * 0.04, weight: 700, color: "#111" }); x.globalAlpha = k * cl(g * 3); text(m, Math.round((v as number) * 100 * g) + "%", bx + bw - u * 0.03, by + bh / 2, { px: u * 0.04, weight: 800, color: "#111", align: "right" }); x.globalAlpha = k; }); } },
  { id: "so-swipe", en: "Swipe up", ar: "اسحب للأعلى", group: "social", dur: 4, fields: [T("label", "text", "Words", "الكلمات", ["Swipe up", "اسحب للأعلى"]), T("color", "color", "Colour", "اللون", "#ffffff")], draw(m) {
    const x = m.ctx, u = m.u, cx = m.W / 2, k = life(m, 0.4, 0.4); x.globalAlpha = k; x.strokeStyle = m.p.color; x.lineWidth = u * 0.012; x.lineCap = "round"; x.lineJoin = "round";
    for (let i = 0; i < 3; i++) { const p = M.loop(m.t * 0.9 - i * 0.18, 1), y = m.H * 0.78 - p * u * 0.12 - i * u * 0.05; x.globalAlpha = k * Math.sin(p * Math.PI); x.beginPath(); x.moveTo(cx - u * 0.05, y + u * 0.03); x.lineTo(cx, y); x.lineTo(cx + u * 0.05, y + u * 0.03); x.stroke(); }
    x.globalAlpha = k; text(m, m.p.label, cx, m.H * 0.86, { px: u * 0.045, weight: 800, color: m.p.color, align: "center" }); } },
  { id: "so-notify", en: "Notification", ar: "إشعار", group: "social", dur: 4, fields: [T("app", "text", "From", "من", ["nooi", "نوي"]), T("title", "text", "Title", "العنوان", ["Your video is ready", "الفيديو جاهز"]), T("msg", "text", "Message", "الرسالة", ["Tap to watch it now", "اضغط لمشاهدته الآن"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, w = Math.min(m.W * 0.8, u * 1.1), h = u * 0.2, X = (m.W - w) / 2, s = sp(m, 0, { damping: 13, stiffness: 150 }), back = ease.easeIn(cl(1 - (m.dur - m.t) / 0.4)), Y = m.H * 0.05 - (1 - s) * h * 1.6 - back * h * 1.6;
    rrect(x, X, Y, w, h, u * 0.04); x.fillStyle = "rgba(245,246,248,.97)"; x.fill(); rrect(x, X + u * 0.035, Y + u * 0.04, u * 0.07, u * 0.07, u * 0.018); x.fillStyle = m.p.accent; x.fill();
    text(m, [...String(m.p.app)][0] || "n", X + u * 0.07, Y + u * 0.075, { px: u * 0.04, weight: 900, color: "#0f1014", align: "center" }); text(m, String(m.p.app).toUpperCase(), X + u * 0.13, Y + u * 0.055, { px: u * 0.024, weight: 700, color: "#6b7280" });
    text(m, m.p.title, X + u * 0.13, Y + u * 0.1, { px: u * 0.038, weight: 800, color: "#111", maxW: w - u * 0.17 }); text(m, m.p.msg, X + u * 0.13, Y + u * 0.15, { px: u * 0.032, weight: 500, color: "#374151", maxW: w - u * 0.17 }); } },
  // ======== charts & numbers
  { id: "ch-hbar", en: "Horizontal bars", ar: "أشرطة أفقية", group: "data", dur: 6, fields: [T("values", "list", "Values", "القيم", "82, 64, 47, 31"), T("labels", "list", "Labels", "التسميات", ["Video, Photos, Music, Text", "فيديو، صور، موسيقى، نصوص"]), T("title", "text", "Title", "العنوان", ["What people make", "ماذا يصنع الناس"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, v = nums(m.p.values), lb = labels(m.p.labels), max = Math.max(1, ...v), n = Math.max(1, v.length), X0 = m.W * 0.3, CW = m.W * 0.55, rowH = Math.min(u * 0.12, (m.H * 0.55) / n), Y0 = m.H * 0.3, k = 1 - outK(m);
    x.globalAlpha = k; text(m, m.p.title, m.W / 2, m.H * 0.16, { px: u * 0.06, weight: 800, align: "center" });
    v.forEach((val, i) => { const g = sp(m, 6 + i * 5, { damping: 16, stiffness: 100 }), y = Y0 + i * rowH * 1.25, bw = (val / max) * CW * g;
      text(m, lb[i] || "", X0 - u * 0.03, y + rowH / 2, { px: u * 0.035, weight: 600, align: "right", color: "rgba(255,255,255,.85)", maxW: X0 - u * 0.06 });
      rrect(x, X0, y, bw, rowH, rowH * 0.25); x.fillStyle = i === 0 ? m.p.accent : PAL[(i + 1) % PAL.length]; x.fill(); x.globalAlpha = k * cl(g); text(m, String(Math.round(val * g)), X0 + bw + u * 0.02, y + rowH / 2, { px: u * 0.035, weight: 800 }); x.globalAlpha = k; }); } },
  { id: "ch-area", en: "Area chart", ar: "مخطط مساحي", group: "data", dur: 6, fields: [T("values", "list", "Values", "القيم", "4, 6, 5, 9, 8, 12, 11, 16"), T("title", "text", "Title", "العنوان", ["Monthly revenue", "الإيراد الشهري"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, v = nums(m.p.values), max = Math.max(1, ...v), CW = m.W * 0.72, CH = m.H * 0.46, X0 = (m.W - CW) / 2, Y0 = m.H * 0.8, k = 1 - outK(m), a = ease.easeInOut(cl((m.t - 0.3) / 1.8));
    const pts: M.Pt[] = v.map((val, i) => [X0 + (i / Math.max(1, v.length - 1)) * CW, Y0 - (val / max) * CH]);
    x.globalAlpha = k; text(m, m.p.title, m.W / 2, m.H * 0.18, { px: u * 0.06, weight: 800, align: "center" }); x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(X0, Y0, CW, u * 0.003);
    x.save(); x.beginPath(); x.rect(X0 - u * 0.02, 0, (CW + u * 0.04) * a, m.H); x.clip();
    const g = x.createLinearGradient(0, Y0 - CH, 0, Y0); g.addColorStop(0, m.p.accent); g.addColorStop(1, "rgba(0,0,0,0)"); x.globalAlpha = k * 0.55; x.fillStyle = g;
    x.beginPath(); x.moveTo(X0, Y0); pts.forEach((p) => x.lineTo(p[0], p[1])); x.lineTo(X0 + CW, Y0); x.closePath(); x.fill();
    x.globalAlpha = k; x.strokeStyle = m.p.accent; x.lineWidth = u * 0.007; x.lineJoin = "round"; x.stroke(new Path2D(M.toPath(pts, false))); x.restore();
    if (a > 0.98) { const p = pts[pts.length - 1]; if (p) { x.beginPath(); x.arc(p[0], p[1], u * 0.015 * (1 + 0.2 * Math.sin(m.t * 6)), 0, 7); x.fillStyle = "#fff"; x.fill(); text(m, String(v[v.length - 1]), p[0], p[1] - u * 0.05, { px: u * 0.04, weight: 800, align: "center" }); } } } },
  { id: "ch-stats", en: "Stat cards", ar: "بطاقات أرقام", group: "data", dur: 5, fields: [T("values", "list", "Numbers", "الأرقام", "120, 48, 96"), T("labels", "list", "Labels", "التسميات", ["Videos, Countries, % happy", "فيديو، دولة، ٪ رضا"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, v = nums(m.p.values).slice(0, 4), lb = labels(m.p.labels), n = Math.max(1, v.length), gap = u * 0.04, cw = Math.min(u * 0.42, (m.W * 0.86 - gap * (n - 1)) / n), ch = u * 0.32, X0 = (m.W - (cw * n + gap * (n - 1))) / 2, Y = (m.H - ch) / 2, k = 1 - outK(m);
    v.forEach((val, i) => { const s = sp(m, i * 6, { damping: 13, stiffness: 140 }), X = X0 + i * (cw + gap), cnt = M.interpolate(m.t, [0.3 + i * 0.2, 1.8 + i * 0.2], [0, val], { easing: ease.easeOut });
      x.save(); x.globalAlpha = k * cl(s * 1.5); x.translate(X + cw / 2, Y + ch / 2 + (1 - s) * u * 0.15); rrect(x, -cw / 2, -ch / 2, cw, ch, u * 0.03); x.fillStyle = "rgba(20,22,28,.92)"; x.fill();
      x.fillStyle = PAL[i % PAL.length]; x.fillRect(-cw / 2, -ch / 2 + u * 0.03, u * 0.008, ch - u * 0.06);
      text(m, (Number.isInteger(val) ? Math.round(cnt) : cnt.toFixed(1)).toLocaleString(), 0, -u * 0.03, { px: u * 0.09, weight: 900, align: "center", maxW: cw * 0.85 }); text(m, lb[i] || "", 0, u * 0.08, { px: u * 0.032, weight: 600, color: "rgba(255,255,255,.75)", align: "center", maxW: cw * 0.9 }); x.restore(); }); } },
  { id: "ch-versus", en: "Versus", ar: "مقارنة", group: "data", dur: 5, fields: [T("la", "text", "Left", "اليسار", ["Before", "قبل"]), T("va", "number", "Left number", "رقم اليسار", 38, { min: 0, max: 1e9, step: 1 }), T("lb", "text", "Right", "اليمين", ["After", "بعد"]), T("vb", "number", "Right number", "رقم اليمين", 91, { min: 0, max: 1e9, step: 1 }), BG({ def: "#FF3D9A" }), A2("#00F0FF")], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), a = ease.easeOut(cl((m.t - 0.2) / 1.2)), va = Number(m.p.va), vb = Number(m.p.vb), sum = va + vb || 1, bw = m.W * 0.7, X = (m.W - bw) / 2, Y = m.H * 0.66;
    x.globalAlpha = k; [[m.p.la, va, m.p.accent, m.W * 0.3], [m.p.lb, vb, m.p.accent2, m.W * 0.7]].forEach(([lab, val, col, cx]) => { const s = sp(m, cx === m.W * 0.3 ? 0 : 6);
      x.save(); x.translate(cx as number, m.H * 0.42); x.scale(s, s); text(m, Math.round((val as number) * a).toLocaleString("en"), 0, 0, { px: u * 0.15, weight: 900, color: col as string, align: "center" }); text(m, String(lab), 0, u * 0.11, { px: u * 0.04, weight: 700, align: "center", color: "rgba(255,255,255,.8)" }); x.restore(); });
    text(m, "VS", m.W / 2, m.H * 0.42, { px: u * 0.05, weight: 900, align: "center", color: "rgba(255,255,255,.5)" });
    const wa = bw * (va / sum) * a, wb = bw * (vb / sum) * a; rrect(x, X, Y, bw, u * 0.03, u * 0.015); x.fillStyle = "rgba(255,255,255,.12)"; x.fill(); x.fillStyle = m.p.accent; x.fillRect(X, Y, wa, u * 0.03); x.fillStyle = m.p.accent2; x.fillRect(X + bw - wb, Y, wb, u * 0.03); } },
  // ======== shapes & backgrounds
  { id: "bg-grid", en: "Retro grid", ar: "شبكة ريترو", group: "shapes", dur: 8, fields: [T("line", "color", "Lines", "الخطوط", "#FF3D9A"), T("sun", "color", "Sun", "الشمس", "#ffd23f"), T("bg", "color", "Sky", "السماء", "#140a2a"), T("speed", "number", "Speed", "السرعة", 1, { min: 0, max: 4, step: 0.1 })], draw(m) {
    const x = m.ctx, W = m.W, H = m.H, hz = H * 0.55; x.fillStyle = m.p.bg; x.fillRect(0, 0, W, H);
    const R = m.u * 0.28, sg = x.createLinearGradient(0, hz - R * 2, 0, hz); sg.addColorStop(0, m.p.sun); sg.addColorStop(1, m.p.line); x.fillStyle = sg; x.beginPath(); x.arc(W / 2, hz, R, Math.PI, 0); x.fill();
    x.fillStyle = m.p.bg; for (let i = 0; i < 5; i++) x.fillRect(W / 2 - R, hz - R * (0.12 + i * 0.16), R * 2, R * 0.03 * (i + 1) * 0.6);
    x.fillStyle = "#000"; x.globalAlpha = 0.35; x.fillRect(0, hz, W, H - hz); x.globalAlpha = 1; x.strokeStyle = m.p.line; x.lineWidth = Math.max(1, m.u * 0.003); x.shadowColor = m.p.line; x.shadowBlur = m.u * 0.02;
    for (let i = -12; i <= 12; i++) { x.beginPath(); x.moveTo(W / 2 + i * W * 0.02, hz); x.lineTo(W / 2 + i * W * 0.22, H); x.stroke(); }
    const off = M.loop(m.t * 0.5 * m.p.speed, 1); for (let j = 0; j < 12; j++) { const d = (j + off) / 12, y = hz + (H - hz) * d * d; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } x.shadowBlur = 0; } },
  { id: "bg-particles", en: "Floating particles", ar: "جسيمات عائمة", group: "shapes", dur: 8, fields: [T("count", "number", "Particles", "الجسيمات", 70, { min: 5, max: 300, step: 5 }), T("color", "color", "Colour", "اللون", "#00F0FF"), T("glow", "bool", "Glow", "توهج", true), T("seed", "text", "Seed", "البذرة", "air")], draw(m) {
    const x = m.ctx, u = m.u, k = life(m, 0.8, 0.8); x.fillStyle = m.p.color; if (m.p.glow) { x.shadowColor = m.p.color; x.shadowBlur = u * 0.025; }
    for (let i = 0; i < m.p.count; i++) { const r = (s: string) => M.random(m.p.seed + s + i), z = 0.3 + r("z") * 0.7, px = ((r("x") + M.noise2("px" + i, m.t * 0.08, 0) * 0.15 + m.t * 0.01 * z) % 1 + 1) % 1, py = ((r("y") - m.t * 0.03 * z + M.noise2("py" + i, 0, m.t * 0.08) * 0.15) % 1 + 1) % 1;
      x.globalAlpha = k * (0.3 + 0.7 * z) * (0.6 + 0.4 * Math.sin(m.t * 2 + i)); x.beginPath(); x.arc(px * m.W, py * m.H, u * 0.006 * z * 1.6, 0, 7); x.fill(); } x.shadowBlur = 0; } },
  { id: "bg-stripes", en: "Moving stripes", ar: "خطوط متحركة", group: "shapes", dur: 6, fields: [T("c1", "color", "Colour 1", "اللون 1", "#ffd23f"), T("c2", "color", "Colour 2", "اللون 2", "#111318"), T("width", "number", "Stripe width", "عرض الخط", 1, { min: 0.2, max: 4, step: 0.1 }), T("speed", "number", "Speed", "السرعة", 1, { min: 0, max: 5, step: 0.1 })], draw(m) {
    const x = m.ctx, s = m.u * 0.08 * m.p.width, off = (m.t * s * 2 * m.p.speed) % (s * 2), D = m.W + m.H; x.globalAlpha = life(m, 0.3, 0.3); x.fillStyle = m.p.c2; x.fillRect(0, 0, m.W, m.H); x.fillStyle = m.p.c1;
    for (let i = -D; i < D; i += s * 2) { const a = i + off; x.beginPath(); x.moveTo(a, 0); x.lineTo(a + s, 0); x.lineTo(a + s - m.H, m.H); x.lineTo(a - m.H, m.H); x.closePath(); x.fill(); } } },
  { id: "sh-orbit", en: "Orbits", ar: "مدارات", group: "shapes", dur: 6, fields: [T("rings", "number", "Orbits", "المدارات", 4, { min: 1, max: 8, step: 1 }), BG(), A2("#FF3D9A"), T("label", "text", "Middle", "في المنتصف", "")], draw(m) {
    const x = m.ctx, u = m.u, cx = m.W / 2, cy = m.H / 2, k = life(m, 0.5, 0.5), n = Math.round(m.p.rings); x.globalAlpha = k;
    for (let i = 0; i < n; i++) { const R = u * (0.1 + i * 0.07) * sp(m, i * 4), sp2 = (1.4 - i * 0.18) * (i % 2 ? -1 : 1), col = M.interpolateColors(i / Math.max(1, n - 1), [0, 1], [m.p.accent, m.p.accent2]);
      x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = u * 0.002; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke();
      for (let tr = 0; tr < 8; tr++) { const a = m.t * sp2 - tr * 0.06 * Math.sign(sp2) + i; x.globalAlpha = k * (1 - tr / 8); x.beginPath(); x.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, u * 0.012 * (1 - tr / 10), 0, 7); x.fillStyle = col; x.fill(); } x.globalAlpha = k; }
    if (String(m.p.label).trim()) text(m, m.p.label, cx, cy, { px: u * 0.05, weight: 800, align: "center" }); else { x.beginPath(); x.arc(cx, cy, u * 0.035, 0, 7); x.fillStyle = "#fff"; x.fill(); } } },
  // ======== callouts
  { id: "co-box", en: "Highlight box", ar: "مربع تمييز", group: "callouts", dur: 4, fields: [T("label", "text", "Label", "التسمية", ["Important", "مهم"]), T("tx", "number", "Across (%)", "أفقياً (%)", 50, { min: 0, max: 100, step: 1 }), T("ty", "number", "Down (%)", "عمودياً (%)", 45, { min: 0, max: 100, step: 1 }), T("w", "number", "Width (%)", "العرض (%)", 30, { min: 5, max: 100, step: 1 }), T("h", "number", "Height (%)", "الارتفاع (%)", 30, { min: 5, max: 100, step: 1 }), T("color", "color", "Colour", "اللون", "#ffe600")], draw(m) {
    const x = m.ctx, u = m.u, w = pct(m, "w", m.W), h = pct(m, "h", m.H), cx = pct(m, "tx", m.W), cy = pct(m, "ty", m.H), k = 1 - outK(m), P: M.Pt[] = [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
    const e = M.evolve(P, ease.easeInOut(cl(m.t / 0.8))); x.globalAlpha = k; x.strokeStyle = m.p.color; x.lineWidth = u * 0.008; x.lineJoin = "round"; x.setLineDash(e.dash); x.lineDashOffset = e.offset; x.stroke(new Path2D(M.toPath(P))); x.setLineDash([]);
    x.globalAlpha = k * cl((m.t - 0.7) / 0.3); const tw = measure(m, m.p.label, u * 0.036, 800) + u * 0.04; rrect(x, cx - w / 2, cy - h / 2 - u * 0.065, tw, u * 0.055, u * 0.01); x.fillStyle = m.p.color; x.fill();
    text(m, m.p.label, cx - w / 2 + u * 0.02, cy - h / 2 - u * 0.037, { px: u * 0.036, weight: 800, color: "#111" }); } },
  { id: "co-spot", en: "Spotlight", ar: "بقعة ضوء", group: "callouts", dur: 4, fields: [T("tx", "number", "Across (%)", "أفقياً (%)", 60, { min: 0, max: 100, step: 1 }), T("ty", "number", "Down (%)", "عمودياً (%)", 45, { min: 0, max: 100, step: 1 }), T("size", "number", "Size", "الحجم", 1, { min: 0.2, max: 3, step: 0.05 }), T("dim", "number", "Darkness", "التعتيم", 0.7, { min: 0.1, max: 1, step: 0.05 })], draw(m) {
    const x = m.ctx, u = m.u, cx = pct(m, "tx", m.W), cy = pct(m, "ty", m.H), R = u * 0.18 * m.p.size * (1 + 0.04 * Math.sin(m.t * 3)), k = life(m, 0.5, 0.5);
    x.globalAlpha = k * m.p.dim; x.fillStyle = "#000"; x.fillRect(0, 0, m.W, m.H); x.globalCompositeOperation = "destination-out"; x.globalAlpha = 1;
    const g = x.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.1); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R * 1.1, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; } },
  { id: "co-tooltip", en: "Tooltip", ar: "تلميح", group: "callouts", dur: 4, fields: [T("label", "text", "Words", "الكلمات", ["Tap here to start", "اضغط هنا للبدء"]), T("tx", "number", "Across (%)", "أفقياً (%)", 40, { min: 0, max: 100, step: 1 }), T("ty", "number", "Down (%)", "عمودياً (%)", 55, { min: 0, max: 100, step: 1 }), BG()], draw(m) {
    const x = m.ctx, u = m.u, cx = pct(m, "tx", m.W), cy = pct(m, "ty", m.H), k = 1 - outK(m), up = cy > m.H * 0.4 ? -1 : 1, ly = cy + up * u * 0.16 * ease.easeOut(cl((m.t - 0.2) / 0.4));
    x.globalAlpha = k; for (let i = 0; i < 2; i++) { const p = M.loop(m.t / 1.2 + i / 2, 1); x.globalAlpha = k * (1 - p); x.strokeStyle = m.p.accent; x.lineWidth = u * 0.004; x.beginPath(); x.arc(cx, cy, u * 0.015 + p * u * 0.05, 0, 7); x.stroke(); }
    x.globalAlpha = k; x.beginPath(); x.arc(cx, cy, u * 0.015, 0, 7); x.fillStyle = m.p.accent; x.fill(); x.strokeStyle = "#fff"; x.lineWidth = u * 0.003; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, ly); x.stroke();
    x.globalAlpha = k * cl((m.t - 0.5) / 0.3); const tw = measure(m, m.p.label, u * 0.038, 700) + u * 0.06, bh = u * 0.075, bx = Math.max(u * 0.02, Math.min(m.W - tw - u * 0.02, cx - tw / 2)), by = up < 0 ? ly - bh : ly;
    rrect(x, bx, by, tw, bh, u * 0.02); x.fillStyle = "#fff"; x.fill(); text(m, m.p.label, bx + tw / 2, by + bh / 2, { px: u * 0.038, weight: 700, color: "#111", align: "center" }); } },
  // ======== timers
  { id: "tm-bar", en: "Video progress bar", ar: "شريط تقدّم الفيديو", group: "timers", dur: 10, fields: [BG({ def: "#ff2d2d" }), T("marks", "list", "Chapter marks (%)", "علامات الفصول (%)", "25, 50, 75"), T("top", "bool", "At the top", "في الأعلى", false), T("thick", "number", "Thickness", "السُمك", 1, { min: 0.3, max: 4, step: 0.1 })], draw(m) {
    const x = m.ctx, h = m.u * 0.012 * m.p.thick, y = m.p.top ? 0 : m.H - h, p = cl(m.t / m.dur); x.globalAlpha = life(m, 0.2, 0.2);
    x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(0, y, m.W, h); x.fillStyle = m.p.accent; x.fillRect(0, y, m.W * p, h);
    x.fillStyle = "rgba(0,0,0,.6)"; for (const v of nums(m.p.marks)) x.fillRect((cl(v / 100)) * m.W - h * 0.3, y, h * 0.6, h);
    x.beginPath(); x.arc(m.W * p, y + h / 2, h * 1.1, 0, 7); x.fillStyle = m.p.accent; x.fill(); } },
  { id: "tm-date", en: "Date stamp", ar: "ختم التاريخ", group: "timers", dur: 4, fields: [T("day", "number", "Day", "اليوم", 25, { min: 1, max: 31, step: 1 }), T("month", "text", "Month", "الشهر", ["DECEMBER", "ديسمبر"]), T("year", "number", "Year", "السنة", 2026, { min: 1900, max: 2200, step: 1 }), BG()], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), s = sp(m, 0, { damping: 12, stiffness: 150 }), w = u * 0.34, h = u * 0.4, X = (m.W - w) / 2, Y = (m.H - h) / 2;
    x.save(); x.globalAlpha = k * cl(s * 2); x.translate(m.W / 2, m.H / 2); x.scale(1, s); x.translate(-m.W / 2, -m.H / 2);
    rrect(x, X, Y, w, h, u * 0.03); x.fillStyle = "#fff"; x.fill(); x.save(); rrect(x, X, Y, w, h, u * 0.03); x.clip(); x.fillStyle = m.p.accent; x.fillRect(X, Y, w, h * 0.26); x.restore();
    text(m, m.p.month, m.W / 2, Y + h * 0.13, { px: u * 0.04, weight: 800, color: "#0f1014", align: "center", maxW: w * 0.9 });
    const d = Math.round(M.interpolate(m.t, [0.2, 1], [1, Number(m.p.day)], { easing: ease.easeOut })); text(m, String(d), m.W / 2, Y + h * 0.58, { px: u * 0.16, weight: 900, color: "#111", align: "center" });
    text(m, String(m.p.year), m.W / 2, Y + h * 0.87, { px: u * 0.035, weight: 600, color: "#6b7280", align: "center" }); x.restore(); } },
  // ======== sound-reactive
  { id: "au-wave", en: "Sound wave", ar: "موجة صوتية", group: "audio", dur: 8, fields: [BG(), A2("#FF3D9A"), T("lines", "number", "Lines", "الخطوط", 3, { min: 1, max: 6, step: 1 })], draw(m) {
    const x = m.ctx, u = m.u, b = m.bars(48), cy = m.H / 2, k = life(m, 0.3, 0.3), n = Math.round(m.p.lines); x.lineWidth = u * 0.006; x.lineCap = "round";
    for (let l = 0; l < n; l++) { x.globalAlpha = k * (1 - l / (n + 1)); x.strokeStyle = M.interpolateColors(l / Math.max(1, n - 1), [0, 1], [m.p.accent, m.p.accent2]); x.beginPath();
      for (let i = 0; i <= 120; i++) { const t = i / 120, bi = b[Math.min(b.length - 1, Math.floor(Math.abs(t - 0.5) * 2 * (b.length - 1)))], env = Math.sin(t * Math.PI), y = cy + Math.sin(t * Math.PI * (6 + l * 2) - m.t * (5 + l)) * env * (u * 0.03 + bi * m.H * 0.25) * (1 - l * 0.2);
        const X = m.W * 0.08 + t * m.W * 0.84; if (i) x.lineTo(X, y); else x.moveTo(X, y); } x.stroke(); } } },
  { id: "au-dots", en: "Dot meter", ar: "عداد نقاط", group: "audio", dur: 8, fields: [T("cols", "number", "Columns", "الأعمدة", 24, { min: 6, max: 64, step: 1 }), BG({ def: "#2dd4a8" }), A2("#ff3b30")], draw(m) {
    const x = m.ctx, u = m.u, n = Math.round(m.p.cols), b = m.bars(n), rows = 12, CW = m.W * 0.8, cw = CW / n, X0 = (m.W - CW) / 2, ch = Math.min(cw, (m.H * 0.6) / rows), Y0 = m.H * 0.8, r = Math.min(cw, ch) * 0.32, k = life(m, 0.3, 0.3);
    for (let i = 0; i < n; i++) { const lit = Math.round(b[i] * rows); for (let j = 0; j < rows; j++) { x.globalAlpha = k * (j < lit ? 1 : 0.12); x.fillStyle = j < lit ? M.interpolateColors(j / rows, [0, 0.6, 1], [m.p.accent, "#ffd23f", m.p.accent2]) : "#ffffff";
      x.beginPath(); x.arc(X0 + (i + 0.5) * cw, Y0 - (j + 0.5) * ch, r, 0, 7); x.fill(); } } } },
  // ======== intros & outros
  { id: "in-logo", en: "Logo reveal", ar: "كشف الشعار", group: "intros", dur: 4, fields: [T("brand", "text", "Name", "الاسم", ["nooi", "نوي"]), T("tag", "text", "Tagline", "الشعار النصي", ["make it move", "اجعلها تتحرك"]), BG(), T("bg", "color", "Background", "الخلفية", "#0f1014")], draw(m) {
    const x = m.ctx, u = m.u, cx = m.W / 2, cy = m.H / 2, D = Math.hypot(m.W, m.H) / 2, a = ease.easeInOut(cl(m.t / 0.7)), b = ease.easeInOut(cl((m.t - 0.25) / 0.7)), k = 1 - outK(m, 0.5);
    x.globalAlpha = k; x.fillStyle = m.p.accent; x.beginPath(); x.arc(cx, cy, D * a, 0, 7); x.fill(); x.fillStyle = m.p.bg; x.beginPath(); x.arc(cx, cy, D * b, 0, 7); x.fill();
    const s = sp(m, 18, { damping: 10, stiffness: 140 }); x.save(); x.translate(cx, cy - u * 0.02); x.scale(s, s); text(m, m.p.brand, 0, 0, { px: u * 0.16, weight: 900, align: "center", maxW: m.W * 0.8 }); x.restore();
    for (let i = 0; i < 2; i++) { const p = cl((m.t - 0.9 - i * 0.15) / 0.9); if (p <= 0 || p >= 1) continue; x.globalAlpha = k * (1 - p); x.strokeStyle = m.p.accent; x.lineWidth = u * 0.006; x.beginPath(); x.arc(cx, cy, u * (0.2 + p * 0.35), 0, 7); x.stroke(); }
    x.globalAlpha = k * cl((m.t - 1.2) / 0.5); text(m, m.p.tag, cx, cy + u * 0.13, { px: u * 0.04, weight: 600, color: m.p.accent, align: "center" }); } },
  { id: "in-end", en: "End screen", ar: "شاشة النهاية", group: "intros", dur: 8, fields: [T("title", "text", "Title", "العنوان", ["Thanks for watching", "شكراً للمشاهدة"]), T("next", "text", "Under the boxes", "تحت المربعات", ["Watch next", "شاهد التالي"]), BG(), T("bg", "color", "Background", "الخلفية", "#0f1014")], draw(m) {
    const x = m.ctx, u = m.u, k = life(m, 0.5, 0.5); x.globalAlpha = k; x.fillStyle = m.p.bg; x.fillRect(0, 0, m.W, m.H);
    const g = x.createRadialGradient(m.W * 0.2, m.H * 0.1, 0, m.W * 0.2, m.H * 0.1, m.W * 0.7); g.addColorStop(0, m.p.accent + "40"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, m.W, m.H);
    text(m, m.p.title, m.W / 2, m.H * 0.16, { px: u * 0.07, weight: 900, align: "center", maxW: m.W * 0.9 });
    const bw = Math.min(m.W * 0.36, u * 0.7), bh = bw * 9 / 16, gap = m.W * 0.04, y = m.H * 0.3;
    [0, 1].forEach((i) => { const s = sp(m, 8 + i * 6), X = m.W / 2 + (i ? gap / 2 : -gap / 2 - bw); x.save(); x.globalAlpha = k * cl(s * 1.5); x.translate(X + bw / 2, y + bh / 2); x.scale(0.8 + 0.2 * s, 0.8 + 0.2 * s);
      rrect(x, -bw / 2, -bh / 2, bw, bh, u * 0.02); x.fillStyle = "rgba(255,255,255,.08)"; x.fill(); x.setLineDash([u * 0.02, u * 0.015]); x.strokeStyle = "rgba(255,255,255,.45)"; x.lineWidth = u * 0.004; x.stroke(); x.setLineDash([]);
      x.beginPath(); x.moveTo(-u * 0.03, -u * 0.04); x.lineTo(u * 0.05, 0); x.lineTo(-u * 0.03, u * 0.04); x.closePath(); x.fillStyle = "rgba(255,255,255,.6)"; x.fill(); x.restore(); });
    x.globalAlpha = k * cl((m.t - 0.8) / 0.5); text(m, m.p.next, m.W / 2, y + bh + u * 0.07, { px: u * 0.04, weight: 700, color: "rgba(255,255,255,.75)", align: "center" });
    const s2 = sp(m, 30, { damping: 9, stiffness: 160 }); x.save(); x.translate(m.W / 2, m.H * 0.86); x.scale(s2, s2); x.beginPath(); x.arc(0, 0, u * 0.06, 0, 7); x.fillStyle = m.p.accent; x.fill(); text(m, "+", 0, 0, { px: u * 0.07, weight: 900, color: "#0f1014", align: "center" }); x.restore(); } },
  { id: "in-shine", en: "Light sweep", ar: "لمعة ضوئية", group: "intros", dur: 4, fields: [T("text", "text", "Words", "الكلمات", ["PREMIUM", "فاخر"]), T("color", "color", "Colour", "اللون", "#d4af37"), T("size", "number", "Size", "الحجم", 1, { min: 0.4, max: 2, step: 0.05 })], draw(m) {
    const x = m.ctx, u = m.u, px = u * 0.16 * m.p.size, k = life(m, 0.5, 0.5), w = measure(m, m.p.text, px, 900), p = M.loop(m.t / 2.2, 1), sx = m.W / 2 - w / 2 - u * 0.3 + p * (w + u * 0.6);
    x.globalAlpha = k; text(m, m.p.text, m.W / 2, m.H / 2, { px, weight: 900, color: m.p.color, align: "center" });
    x.globalCompositeOperation = "source-atop"; const g = x.createLinearGradient(sx - u * 0.15, 0, sx + u * 0.15, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, m.W, m.H); x.globalCompositeOperation = "source-over"; } },
  { id: "in-leader", en: "Film countdown", ar: "عدّ تنازلي سينمائي", group: "intros", dur: 5, fields: [T("from", "number", "From", "من", 5, { min: 1, max: 10, step: 1 }), T("tone", "color", "Tone", "اللون", "#d9d2c3")], draw(m) {
    const x = m.ctx, u = m.u, n = Math.max(1, Math.round(m.p.from)), step = m.dur / n, i = Math.min(n - 1, Math.floor(m.t / step)), local = (m.t - i * step) / step, cx = m.W / 2, cy = m.H / 2, R = u * 0.36;
    x.fillStyle = m.p.tone; x.fillRect(0, 0, m.W, m.H); x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, Math.hypot(m.W, m.H), -Math.PI / 2, -Math.PI / 2 + local * Math.PI * 2); x.closePath(); x.fill();
    x.strokeStyle = "#1a1a1a"; x.lineWidth = u * 0.006; x.beginPath(); x.moveTo(0, cy); x.lineTo(m.W, cy); x.moveTo(cx, 0); x.lineTo(cx, m.H); x.stroke();
    for (const r of [R, R * 0.85]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); }
    text(m, String(n - i), cx, cy + u * 0.01, { px: u * 0.42, weight: 800, color: "#1a1a1a", align: "center" });
    for (let s = 0; s < 40; s++) { const r = (k: string) => M.random("grain" + k + s + m.frame); x.globalAlpha = 0.25; x.fillStyle = r("c") > 0.5 ? "#000" : "#fff"; x.fillRect(r("x") * m.W, r("y") * m.H, u * 0.004, u * 0.004 * (1 + r("h") * 8)); } x.globalAlpha = 1; } },
  // ======== wipes & reveals (full-frame, between two scenes: put it over the cut)
  { id: "wp-slide", en: "Colour wipe", ar: "مسح لوني", group: "wipes", dur: 1.2, fields: [T("c1", "color", "Colour 1", "اللون 1", "#00F0FF"), T("c2", "color", "Colour 2", "اللون 2", "#7B61FF"), T("dir", "select", "Direction", "الاتجاه", "left", { options: [["left", "To the left", "إلى اليسار"], ["right", "To the right", "إلى اليمين"], ["up", "Up", "للأعلى"], ["down", "Down", "للأسفل"]] })], draw(m) {
    const x = m.ctx, p = m.t / m.dur, hor = m.p.dir === "left" || m.p.dir === "right", L = hor ? m.W : m.H, sgn = m.p.dir === "left" || m.p.dir === "up" ? -1 : 1;
    [[m.p.c1, 0], [m.p.c2, 0.12]].forEach(([c, d]) => { const a = ease.easeInOut(cl((p - (d as number)) / 0.45)), b = ease.easeInOut(cl((p - 0.45 - (d as number)) / 0.45)), s0 = b * L, s1 = a * L;
      x.fillStyle = c as string; const from = sgn > 0 ? s0 : L - s1, len = s1 - s0; if (len <= 0) return; if (hor) x.fillRect(from, 0, len, m.H); else x.fillRect(0, from, m.W, len); }); } },
  { id: "wp-circle", en: "Circle reveal", ar: "كشف دائري", group: "wipes", dur: 1.4, fields: [T("color", "color", "Colour", "اللون", "#7B61FF"), T("tx", "number", "From across (%)", "من أفقياً (%)", 50, { min: 0, max: 100, step: 1 }), T("ty", "number", "From down (%)", "من عمودياً (%)", 50, { min: 0, max: 100, step: 1 })], draw(m) {
    const x = m.ctx, p = m.t / m.dur, cx = pct(m, "tx", m.W), cy = pct(m, "ty", m.H), D = Math.hypot(Math.max(cx, m.W - cx), Math.max(cy, m.H - cy)), a = ease.easeInOut(cl(p / 0.5)), b = ease.easeInOut(cl((p - 0.5) / 0.5));
    x.fillStyle = m.p.color; x.beginPath(); x.arc(cx, cy, D * a, 0, Math.PI * 2); if (b > 0) { x.moveTo(cx + D * b, cy); x.arc(cx, cy, D * b, 0, Math.PI * 2, true); } x.fill("evenodd"); } },
  { id: "wp-bars", en: "Bars sweep", ar: "أشرطة متتابعة", group: "wipes", dur: 1.4, fields: [T("color", "color", "Colour", "اللون", "#FF3D9A"), T("color2", "color", "Second colour", "اللون الثاني", "#ffd23f"), T("count", "number", "Bars", "الأشرطة", 6, { min: 2, max: 20, step: 1 })], draw(m) {
    const x = m.ctx, p = m.t / m.dur, n = Math.round(m.p.count), h = m.H / n;
    for (let i = 0; i < n; i++) { const d = (i / n) * 0.2, a = ease.easeInOut(cl((p - d) / 0.4)), b = ease.easeInOut(cl((p - 0.5 - d) / 0.4)), x0 = (i % 2 ? b : 1 - a) * m.W, x1 = (i % 2 ? a : 1 - b) * m.W;
      x.fillStyle = i % 2 ? m.p.color : m.p.color2; const l = Math.min(x0, x1), w = Math.abs(x1 - x0); if (i % 2) x.fillRect(b * m.W, i * h, (a - b) * m.W, h + 1); else x.fillRect(l, i * h, w, h + 1); } } },
];
