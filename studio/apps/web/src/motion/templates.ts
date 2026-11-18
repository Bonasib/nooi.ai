// nooi Motion templates: motion graphics drawn frame by frame on a canvas from their props (words, colours, numbers, data). Each one
// is a small program on nooi Motion's math (springs, easing, noise, shapes); the same frame always draws the same picture, so the
// preview, the tile's example and the export match. Our own designs.
import { Motion as M } from "@nooi/editor-core";
import { CODE_EXAMPLE } from "./code";
import { AR, BG, FAM, L3, T, cl, ease, labels, life, measure, nums, outK, px0, rrect, sp, text, words, type Group, type Template, type MCtx, type Props } from "./kit";
import { MORE } from "./templates2";
import { MORE3 } from "./templates3";
import { BACKGROUNDS } from "./templates4";
import { INFOGRAPHICS } from "./templates6";   // v242: the classic editor's infographics, back
import { DRAWN, FLAT2, THREE_D } from "./templates7";   // v244: 3D, hand-drawn looks, emoji pop, text punch
import { SCENES } from "./templates8";   // v247: the classic editor's video scenes (made after the owner's reference videos)
export type { Field, FieldType, Group, MCtx, Props, Template } from "./kit";

export const GROUPS: [Group, string, string][] = [["lower", "Lower thirds", "أشرطة سفلية"], ["titles", "Titles & typography", "عناوين وطباعة حركية"], ["social", "Social", "تواصل اجتماعي"],
  ["data", "Charts & numbers", "رسوم بيانية وأرقام"], ["infographics", "Infographics", "إنفوجرافيك"], ["scenes", "Video scenes", "مشاهد الفيديو"], ["3d", "3D", "ثلاثي الأبعاد"], ["drawn", "Hand-drawn", "مرسوم باليد"], ["shapes", "Shapes & backgrounds", "أشكال وخلفيات"], ["callouts", "Callouts", "إشارات توضيحية"], ["timers", "Timers", "مؤقتات"],
  ["audio", "Sound-reactive", "تتفاعل مع الصوت"], ["intros", "Intros & outros", "مقدمات وخواتيم"], ["wipes", "Wipes & reveals", "مسحات وكشف"], ["badges", "Badges & offers", "شارات وعروض"], ["frames", "Frames & overlays", "إطارات وطبقات"], ["backgrounds", "Moving backgrounds", "خلفيات متحركة"], ["code", "Motion code", "كود الحركة"]];

export const TEMPLATES: Template[] = [
  // ======== lower thirds
  { id: "lt-bar", en: "Accent bar", ar: "شريط ملوّن", group: "lower", dur: 5, fields: L3("Alex Morgan", "Head of Marketing"), draw(m) {
    const x = m.ctx, u = m.u, a = sp(m), b = sp(m, 6), k = 1 - outK(m), n = String(m.p.name), r = String(m.p.role);
    const w = Math.max(measure(m, n, u * 0.07, 800), measure(m, r, u * 0.042, 500)) + u * 0.12, X = px0(m, w), Y = m.H * 0.74;
    x.globalAlpha = k; x.fillStyle = m.p.accent; x.fillRect(X, Y - u * 0.06, u * 0.018, u * 0.15 * a);
    x.save(); x.beginPath(); x.rect(X + u * 0.03, Y - u * 0.08, w * b, u * 0.2); x.clip();
    text(m, n, X + u * 0.05, Y - u * 0.02, { px: u * 0.07, weight: 800 }); text(m, r, X + u * 0.05, Y + u * 0.055, { px: u * 0.042, weight: 500, color: "rgba(255,255,255,.8)" }); x.restore(); } },
  { id: "lt-pill", en: "Pill with initials", ar: "كبسولة بالأحرف", group: "lower", dur: 5, fields: L3("Sara Khan", "Designer"), draw(m) {
    const x = m.ctx, u = m.u, a = sp(m), k = 1 - outK(m), n = String(m.p.name), r = String(m.p.role), h = u * 0.15;
    const full = h + u * 0.05 + Math.max(measure(m, n, u * 0.055, 800), measure(m, r, u * 0.036, 500)) + u * 0.07, w = h + (full - h) * sp(m, 5), X = px0(m, full), Y = m.H * 0.78;
    x.globalAlpha = k * cl(a * 2); rrect(x, X, Y - h / 2, w, h, h / 2); x.fillStyle = "rgba(12,14,18,.88)"; x.fill();
    x.beginPath(); x.arc(X + h / 2, Y, (h / 2 - u * 0.012) * a, 0, 7); x.fillStyle = m.p.accent; x.fill();
    const ini = words(n).slice(0, 2).map((w2) => [...w2][0]).join("").toUpperCase(); text(m, ini, X + h / 2, Y, { px: u * 0.05, weight: 800, color: "#0f1014", align: "center" });
    x.save(); x.beginPath(); x.rect(X + h, Y - h / 2, w - h, h); x.clip(); x.globalAlpha = k * cl(sp(m, 9));
    text(m, n, X + h + u * 0.03, Y - u * 0.02, { px: u * 0.055, weight: 800 }); text(m, r, X + h + u * 0.03, Y + u * 0.035, { px: u * 0.036, weight: 500, color: "rgba(255,255,255,.75)" }); x.restore(); } },
  { id: "lt-split", en: "Two-colour blocks", ar: "كتلتان ملونتان", group: "lower", dur: 5, fields: [...L3("Omar Faris", "Reporter, Dubai"), BG({ k: "accent2", en: "Second colour", ar: "اللون الثاني", def: "#ffffff" })], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), n = String(m.p.name).toUpperCase(), r = String(m.p.role);
    const w1 = measure(m, n, u * 0.06, 900) + u * 0.06, w2 = measure(m, r, u * 0.04, 600) + u * 0.06, X = px0(m, Math.max(w1, w2)), Y = m.H * 0.72;
    const a = ease.snappy(cl(m.t / 0.45)), b = ease.snappy(cl((m.t - 0.15) / 0.45));
    x.globalAlpha = k; x.fillStyle = m.p.accent; x.fillRect(X, Y, w1 * a, u * 0.085); x.fillStyle = m.p.accent2; x.fillRect(X, Y + u * 0.085, w2 * b, u * 0.06);
    x.save(); x.beginPath(); x.rect(X, Y, w1 * a, u * 0.085); x.clip(); text(m, n, X + u * 0.03, Y + u * 0.044, { px: u * 0.06, weight: 900, color: "#0f1014" }); x.restore();
    x.save(); x.beginPath(); x.rect(X, Y + u * 0.085, w2 * b, u * 0.06); x.clip(); text(m, r, X + u * 0.03, Y + u * 0.116, { px: u * 0.04, weight: 600, color: "#0f1014" }); x.restore(); } },
  { id: "lt-underline", en: "Underline", ar: "خط سفلي", group: "lower", dur: 5, fields: L3("Lina Haddad", "Chef"), draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), n = String(m.p.name), r = String(m.p.role), w = measure(m, n, u * 0.065, 800), X = px0(m, w), Y = m.H * 0.76;
    x.globalAlpha = k * cl(m.t / 0.4); text(m, n, X, Y - (1 - ease.easeOut(cl(m.t / 0.5))) * u * 0.05, { px: u * 0.065, weight: 800 });
    x.fillStyle = m.p.accent; x.fillRect(X, Y + u * 0.045, w * ease.easeInOut(cl((m.t - 0.2) / 0.6)), u * 0.008);
    x.globalAlpha = k * cl((m.t - 0.5) / 0.4); text(m, r, X, Y + u * 0.09, { px: u * 0.04, weight: 500, color: "rgba(255,255,255,.8)" }); } },
  { id: "lt-news", en: "News strap", ar: "شريط أخبار", group: "lower", dur: 6, fields: [T("label", "text", "Label", "التسمية", ["BREAKING", "عاجل"]), T("headline", "text", "Headline", "العنوان", ["Markets rise after the announcement", "الأسواق ترتفع بعد الإعلان"]),
    T("ticker", "text", "Ticker", "الشريط المتحرك", ["Weather: sunny · Traffic: clear · Next: sports at 9", "الطقس: مشمس · المرور: سلس · التالي: الرياضة الساعة 9"]), BG({ def: "#ff2d2d" })], draw(m) {
    const x = m.ctx, u = m.u, W = m.W, Y = m.H * 0.78, h = u * 0.09, a = ease.snappy(cl(m.t / 0.5)), k = 1 - outK(m), lw = measure(m, String(m.p.label), u * 0.05, 900) + u * 0.06;
    x.globalAlpha = k; x.fillStyle = "#ffffff"; x.fillRect(0, Y, W * a, h); x.fillStyle = m.p.accent; x.fillRect(0, Y, Math.min(lw, W * a), h);
    text(m, String(m.p.label), u * 0.03, Y + h / 2, { px: u * 0.05, weight: 900 });
    x.save(); x.beginPath(); x.rect(lw, Y, W * a - lw, h); x.clip(); text(m, String(m.p.headline), lw + u * 0.03, Y + h / 2, { px: u * 0.05, weight: 700, color: "#111" }); x.restore();
    x.fillStyle = "rgba(10,12,16,.9)"; x.fillRect(0, Y + h, W * a, u * 0.055);
    x.save(); x.beginPath(); x.rect(0, Y + h, W * a, u * 0.055); x.clip(); const tw = measure(m, String(m.p.ticker) + "     ", u * 0.032, 600); const off = (m.t * u * 0.12) % (tw || 1);
    for (let i = -1; i < W / (tw || 1) + 2; i++) text(m, String(m.p.ticker), W - off - i * tw, Y + h + u * 0.028, { px: u * 0.032, weight: 600, color: "#e6e9ef", align: "left" }); x.restore(); } },
  { id: "lt-minimal", en: "Minimal line", ar: "خط بسيط", group: "lower", dur: 5, fields: L3("Noor", "Photographer"), draw(m) {
    const x = m.ctx, u = m.u, k = life(m, 0.6, 0.5), X = px0(m, u * 0.5), Y = m.H * 0.8, a = ease.easeOut(cl(m.t / 0.8));
    x.globalAlpha = k; x.strokeStyle = m.p.accent; x.lineWidth = u * 0.004; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + u * 0.14 * a, Y); x.stroke();
    text(m, String(m.p.name), X + u * 0.17, Y - u * 0.022, { px: u * 0.05, weight: 300, color: "#fff" }); text(m, String(m.p.role).toUpperCase(), X + u * 0.17, Y + u * 0.03, { px: u * 0.026, weight: 600, color: m.p.accent }); } },
  // ======== titles & typography
  { id: "ti-words", en: "Words spring up", ar: "كلمات تقفز", group: "titles", dur: 4, fields: [T("text", "text", "Words", "الكلمات", ["Make every second count", "اجعل كل ثانية تستحق"]), T("color", "color", "Colour", "اللون", "#ffffff"), BG(), T("size", "number", "Size", "الحجم", 1, { min: 0.4, max: 2, step: 0.05 })], draw(m) {
    const x = m.ctx, u = m.u, ws = words(m.p.text), px = u * 0.1 * m.p.size, gap = px * 0.3, rtl = AR.test(m.p.text), k = 1 - outK(m);
    const widths = ws.map((w) => measure(m, w, px, 900)); const total = widths.reduce((s, w) => s + w, 0) + gap * (ws.length - 1); let X = (m.W - total) / 2; const order = rtl ? [...ws.keys()].reverse() : [...ws.keys()];
    for (const i of order) { const s = sp(m, i * 4, { damping: 11, stiffness: 140 }); x.save(); x.globalAlpha = k * cl(s * 1.4); x.translate(X + widths[i] / 2, m.H / 2 + (1 - s) * px * 0.9); x.scale(0.6 + 0.4 * s, 0.6 + 0.4 * s);
      text(m, ws[i], 0, 0, { px, weight: 900, color: i === ws.length - 1 ? m.p.accent : m.p.color, align: "center" }); x.restore(); X += widths[i] + gap; } } },
  { id: "ti-letters", en: "Letters drop in", ar: "حروف تسقط", group: "titles", dur: 4, fields: [T("text", "text", "Words", "الكلمات", ["NOOI STUDIO", "استوديو نوي"]), T("color", "color", "Colour", "اللون", "#ffffff"), T("size", "number", "Size", "الحجم", 1, { min: 0.4, max: 2, step: 0.05 })], draw(m) {
    const x = m.ctx, u = m.u, s = String(m.p.text), px = u * 0.12 * m.p.size, k = 1 - outK(m);
    if (AR.test(s)) { const a = sp(m); x.globalAlpha = k * cl(a); x.save(); x.translate(m.W / 2, m.H / 2 - (1 - a) * px); text(m, s, 0, 0, { px, weight: 900, color: m.p.color, align: "center" }); x.restore(); return; }   // (joined letters stay joined)
    const ch = [...s], wsz = ch.map((c) => measure(m, c, px, 900)), total = wsz.reduce((a, b) => a + b, 0); let X = (m.W - total) / 2;
    ch.forEach((c, i) => { const a = sp(m, i * 2, { damping: 9, stiffness: 160 }); x.save(); x.globalAlpha = k * cl(a * 2); x.translate(X + wsz[i] / 2, m.H / 2 - (1 - a) * m.H * 0.5); x.rotate((1 - a) * (i % 2 ? 0.5 : -0.5));
      text(m, c, 0, 0, { px, weight: 900, color: m.p.color, align: "center" }); x.restore(); X += wsz[i]; }); } },
  { id: "ti-mask", en: "Mask wipe", ar: "كشف بالقناع", group: "titles", dur: 4, fields: [T("text", "text", "Title", "العنوان", ["Behind the scenes", "خلف الكواليس"]), T("sub", "text", "Small line", "سطر صغير", ["EPISODE 01", "الحلقة 01"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, px = u * 0.11, w = measure(m, m.p.text, px, 900), a = ease.snappy(cl(m.t / 0.7)), b = ease.snappy(cl((m.t - 0.35) / 0.7)), k = 1 - outK(m);
    x.globalAlpha = k; x.fillStyle = m.p.accent; x.fillRect((m.W - w) / 2 - u * 0.02, m.H / 2 - px * 0.6, (w + u * 0.04) * (a - b), px * 1.2); x.translate(((w + u * 0.04) * b), 0); x.translate(-((w + u * 0.04) * b), 0);
    x.save(); x.beginPath(); x.rect((m.W - w) / 2 - u * 0.02, m.H / 2 - px * 0.6, (w + u * 0.04) * b, px * 1.2); x.clip(); text(m, m.p.text, m.W / 2, m.H / 2, { px, weight: 900, align: "center" }); x.restore();
    x.globalAlpha = k * cl((m.t - 0.8) / 0.4); text(m, m.p.sub, m.W / 2, m.H / 2 + px * 0.95, { px: u * 0.035, weight: 700, color: m.p.accent, align: "center" }); } },
  { id: "ti-type", en: "Typewriter", ar: "آلة كاتبة", group: "titles", dur: 5, fields: [T("text", "text", "Words", "الكلمات", ["Hello, world.", "مرحباً بالعالم."]), T("color", "color", "Colour", "اللون", "#e8ffe8"), T("speed", "number", "Letters a second", "حروف في الثانية", 14, { min: 3, max: 40, step: 1 }), T("mono", "bool", "Typewriter letters", "حروف آلة كاتبة", true)], draw(m) {
    const ch = [...String(m.p.text)], n = Math.min(ch.length, Math.floor(m.t * m.p.speed)), s = ch.slice(0, n).join(""), fam = m.p.mono ? '"JetBrains Mono","Cairo",monospace' : FAM, px = m.u * 0.07;
    m.ctx.globalAlpha = 1 - outK(m); const r = text(m, s, m.W / 2, m.H / 2, { px, weight: 600, color: m.p.color, align: "center", fam });
    if (Math.floor(m.t * 2) % 2 === 0 || n < ch.length) { m.ctx.fillStyle = m.p.color; const rtl = AR.test(s); m.ctx.fillRect(m.W / 2 + (rtl ? -r.w / 2 - px * 0.6 : r.w / 2 + px * 0.08), m.H / 2 - px * 0.5, px * 0.5, px); } } },
  { id: "ti-glitch", en: "Glitch", ar: "تشويش رقمي", group: "titles", dur: 4, fields: [T("text", "text", "Words", "الكلمات", ["SYSTEM ONLINE", "النظام يعمل"]), T("power", "number", "Strength", "القوة", 1, { min: 0, max: 3, step: 0.1 })], draw(m) {
    const x = m.ctx, u = m.u, px = u * 0.1, j = (M.random("g" + Math.floor(m.frame / 2)) - 0.5) * u * 0.02 * m.p.power, burst = M.random("b" + Math.floor(m.frame / 6)) > 0.7 ? 1 : 0.25, k = life(m, 0.2, 0.3);
    x.globalAlpha = k; x.globalCompositeOperation = "lighter";
    text(m, m.p.text, m.W / 2 - j * 2 * burst, m.H / 2, { px, weight: 900, color: "#ff004c", align: "center" }); text(m, m.p.text, m.W / 2 + j * 2 * burst, m.H / 2 + j, { px, weight: 900, color: "#00e5ff", align: "center" });
    x.globalCompositeOperation = "source-over"; text(m, m.p.text, m.W / 2, m.H / 2, { px, weight: 900, color: "#fff", align: "center" });
    for (let i = 0; i < 4 * burst * m.p.power; i++) { const y = M.random("y" + i + Math.floor(m.frame / 3)) * m.H, h = u * 0.01 * (1 + M.random("h" + i)); x.drawImage(x.canvas, 0, y, m.W, h, (M.random("x" + i + m.frame) - 0.5) * u * 0.06, y, m.W, h); } } },
  { id: "ti-neon", en: "Neon sign", ar: "لافتة نيون", group: "titles", dur: 5, fields: [T("text", "text", "Words", "الكلمات", ["OPEN LATE", "مفتوح ليلاً"]), T("color", "color", "Glow", "التوهج", "#ff2bd6")], draw(m) {
    const x = m.ctx, u = m.u, flick = m.t < 1.2 ? (M.random("n" + Math.floor(m.frame / 2)) > 0.45 ? 1 : 0.15) : M.random("f" + Math.floor(m.frame / 3)) > 0.97 ? 0.4 : 1, k = (1 - outK(m)) * flick;
    x.globalAlpha = k; x.shadowColor = m.p.color; for (const b of [u * 0.08, u * 0.04, u * 0.015]) { x.shadowBlur = b; text(m, m.p.text, m.W / 2, m.H / 2, { px: u * 0.11, weight: 800, color: m.p.color, align: "center" }); }
    x.shadowBlur = 0; text(m, m.p.text, m.W / 2, m.H / 2, { px: u * 0.11, weight: 800, color: "#fff", align: "center" }); } },
  { id: "ti-zoom", en: "Zoom through", ar: "تكبير عبر", group: "titles", dur: 3, fields: [T("text", "text", "Words", "الكلمات", ["WELCOME", "أهلاً بكم"]), T("color", "color", "Colour", "اللون", "#ffffff")], draw(m) {
    const x = m.ctx, u = m.u, p = m.t / m.dur, s = p < 0.25 ? 0.2 + 0.8 * ease.snappy(p / 0.25) : p > 0.8 ? 1 + 8 * ease.easeIn((p - 0.8) / 0.2) : 1 + 0.08 * (p - 0.25);
    x.globalAlpha = p > 0.8 ? 1 - (p - 0.8) / 0.2 : cl(p / 0.12); x.translate(m.W / 2, m.H / 2); x.scale(s, s); text(m, m.p.text, 0, 0, { px: u * 0.13, weight: 900, color: m.p.color, align: "center" }); } },
  { id: "ti-marker", en: "Marker highlight", ar: "تظليل بالقلم", group: "titles", dur: 4, fields: [T("text", "text", "Words", "الكلمات", ["Save 50% today", "وفّر 50% اليوم"]), T("color", "color", "Marker", "لون القلم", "#ffe600")], draw(m) {
    const x = m.ctx, u = m.u, px = u * 0.1, w = measure(m, m.p.text, px, 900), a = ease.easeInOut(cl((m.t - 0.3) / 0.7)), rtl = AR.test(m.p.text), k = 1 - outK(m), X = (m.W - w) / 2;
    x.globalAlpha = k; x.fillStyle = m.p.color; x.save(); x.translate(0, m.H / 2 + px * 0.1); x.rotate(-0.015); x.fillRect(rtl ? X + w * (1 - a) - u * 0.01 : X - u * 0.01, -px * 0.32, (w + u * 0.02) * a, px * 0.62); x.restore();
    x.globalAlpha = k * cl(m.t / 0.3); text(m, m.p.text, m.W / 2, m.H / 2, { px, weight: 900, color: "#111", align: "center" }); } },
  // ======== social
  { id: "so-subscribe", en: "Subscribe button", ar: "زر الاشتراك", group: "social", dur: 4, fields: [T("label", "text", "Button", "الزر", ["SUBSCRIBE", "اشترك"]), T("done", "text", "After the tap", "بعد الضغط", ["SUBSCRIBED", "مشترك"]), BG({ def: "#ff0033" })], draw(m) {
    const x = m.ctx, u = m.u, a = sp(m, 0, { damping: 12, stiffness: 160 }), tap = m.t > 1.6, w = u * 0.42, h = u * 0.11, X = (m.W - w) / 2, Y = m.H * 0.72, k = 1 - outK(m);
    const press = tap ? 1 - 0.06 * Math.sin(cl((m.t - 1.6) / 0.25) * Math.PI) : 1; x.globalAlpha = k; x.translate(m.W / 2, Y + h / 2); x.scale(a * press, a * press); x.translate(-m.W / 2, -(Y + h / 2));
    rrect(x, X, Y, w, h, h * 0.18); x.fillStyle = tap ? "#3a3d44" : m.p.accent; x.fill(); text(m, tap ? m.p.done : m.p.label, m.W / 2, Y + h / 2, { px: u * 0.045, weight: 800, align: "center", maxW: w * 0.85 });
    const cx = X + w * 0.82 + (m.t < 1.6 ? (1 - ease.easeOut(cl((m.t - 0.6) / 0.8))) * u * 0.25 : 0), cy = Y + h * (m.t < 1.6 ? 0.9 : 0.8);   // the pointer
    if (m.t > 0.6) { x.fillStyle = "#fff"; x.strokeStyle = "#111"; x.lineWidth = u * 0.004; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy + u * 0.07); x.lineTo(cx + u * 0.018, cy + u * 0.052); x.lineTo(cx + u * 0.04, cy + u * 0.06); x.closePath(); x.fill(); x.stroke(); } } },
  { id: "so-handle", en: "Social handle", ar: "حساب التواصل", group: "social", dur: 4, fields: [T("handle", "text", "Handle", "الحساب", "@nooi.ai"), T("net", "select", "Network", "المنصة", "ig", { options: [["ig", "Instagram", "إنستغرام"], ["tt", "TikTok", "تيك توك"], ["yt", "YouTube", "يوتيوب"], ["x", "X", "إكس"], ["sc", "Snapchat", "سناب شات"]] })], draw(m) {
    const x = m.ctx, u = m.u, col: Record<string, string> = { ig: "#e1306c", tt: "#25f4ee", yt: "#ff0033", x: "#ffffff", sc: "#fffc00" }, c = col[m.p.net] || "#00F0FF", h = u * 0.1, tw = measure(m, m.p.handle, u * 0.05, 700);
    const full = h + tw + u * 0.06, w = h + (full - h) * sp(m, 6), X = (m.W - full) / 2, Y = m.H * 0.8, k = 1 - outK(m); x.globalAlpha = k * cl(sp(m) * 2);
    rrect(x, X, Y - h / 2, w, h, h / 2); x.fillStyle = "rgba(255,255,255,.95)"; x.fill(); x.beginPath(); x.arc(X + h / 2, Y, h * 0.38 * sp(m), 0, 7); x.fillStyle = c; x.fill();
    text(m, ({ ig: "◎", tt: "♪", yt: "▶", x: "𝕏", sc: "☺" } as Record<string, string>)[m.p.net] || "@", X + h / 2, Y + u * 0.002, { px: u * 0.045, weight: 900, color: m.p.net === "x" || m.p.net === "sc" ? "#111" : "#fff", align: "center" });
    x.save(); x.beginPath(); x.rect(X + h, Y - h / 2, w - h, h); x.clip(); text(m, m.p.handle, X + h + u * 0.02, Y, { px: u * 0.05, weight: 700, color: "#111" }); x.restore(); } },
  { id: "so-like", en: "Like burst", ar: "إعجاب متفجر", group: "social", dur: 3, fields: [T("count", "number", "Likes", "الإعجابات", 1280, { min: 0, max: 9999999, step: 1 }), BG({ def: "#ff2d55" })], draw(m) {
    const x = m.ctx, u = m.u, cx = m.W / 2, cy = m.H / 2, s = sp(m, 0, { damping: 7, stiffness: 180 }), k = 1 - outK(m); x.globalAlpha = k;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, d = u * (0.1 + 0.12 * ease.easeOut(cl(m.t / 0.6))), r = u * 0.012 * (1 - cl(m.t / 0.8)); x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(0, r), 0, 7); x.fillStyle = i % 2 ? m.p.accent : "#ffd23f"; x.fill(); }
    x.save(); x.translate(cx, cy); x.scale(s, s); x.fillStyle = m.p.accent; x.fill(new Path2D(M.toPath(M.shapes.heart(u * 0.1)))); x.restore();
    const n = Math.round(M.interpolate(m.t, [0.3, 1.5], [Math.max(0, m.p.count - 37), m.p.count], { easing: ease.easeOut })); text(m, n.toLocaleString("en"), cx, cy + u * 0.18, { px: u * 0.06, weight: 800, align: "center" }); } },
  { id: "so-comment", en: "Comment bubble", ar: "فقاعة تعليق", group: "social", dur: 5, fields: [T("user", "text", "Name", "الاسم", ["Maya", "مايا"]), T("text", "text", "Comment", "التعليق", ["This edit is fire 🔥", "مونتاج رائع 🔥"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, tw = Math.min(m.W * 0.7, measure(m, m.p.text, u * 0.045, 600)), w = tw + u * 0.2, h = u * 0.16, X = (m.W - w) / 2, Y = m.H * 0.68, s = sp(m, 0, { damping: 12, stiffness: 150 }), k = 1 - outK(m);
    x.globalAlpha = k; x.translate(X + u * 0.06, Y + h); x.scale(s, s); x.translate(-(X + u * 0.06), -(Y + h)); rrect(x, X, Y, w, h, u * 0.04); x.fillStyle = "#ffffff"; x.fill();
    x.beginPath(); x.arc(X + u * 0.07, Y + h / 2, u * 0.04, 0, 7); x.fillStyle = m.p.accent; x.fill(); text(m, [...String(m.p.user)][0] || "?", X + u * 0.07, Y + h / 2, { px: u * 0.04, weight: 800, color: "#0f1014", align: "center" });
    text(m, m.p.user, X + u * 0.13, Y + h * 0.33, { px: u * 0.032, weight: 800, color: "#111" }); text(m, m.p.text, X + u * 0.13, Y + h * 0.66, { px: u * 0.045, weight: 600, color: "#222", maxW: tw }); } },
  { id: "so-follow", en: "Follow card", ar: "بطاقة متابعة", group: "social", dur: 5, fields: [T("name", "text", "Name", "الاسم", ["nooi studio", "استوديو نوي"]), T("followers", "text", "Followers", "المتابعون", ["12.4K followers", "12.4 ألف متابع"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, w = u * 0.62, h = u * 0.2, X = (m.W - w) / 2, Y = m.H * 0.66 + (1 - sp(m)) * u * 0.3, k = 1 - outK(m), tap = m.t > 2;
    x.globalAlpha = k * cl(m.t / 0.3); rrect(x, X, Y, w, h, u * 0.04); x.fillStyle = "rgba(18,20,26,.94)"; x.fill();
    x.beginPath(); x.arc(X + u * 0.1, Y + h / 2, u * 0.06, 0, 7); const g = x.createLinearGradient(X, Y, X + u * 0.2, Y + h); g.addColorStop(0, m.p.accent); g.addColorStop(1, "#7B61FF"); x.fillStyle = g; x.fill();
    text(m, m.p.name, X + u * 0.19, Y + h * 0.38, { px: u * 0.042, weight: 800 }); text(m, m.p.followers, X + u * 0.19, Y + h * 0.66, { px: u * 0.03, weight: 500, color: "rgba(255,255,255,.7)" });
    const bw = u * 0.14, bx = X + w - bw - u * 0.03; rrect(x, bx, Y + h / 2 - u * 0.03, bw, u * 0.06, u * 0.03); x.fillStyle = tap ? "#3a3d44" : m.p.accent; x.fill();
    text(m, tap ? "✓" : "+", bx + bw / 2, Y + h / 2, { px: u * 0.04, weight: 900, color: tap ? "#fff" : "#0f1014", align: "center" }); } },
  // ======== charts & numbers
  { id: "ch-bars", en: "Bar chart", ar: "أعمدة بيانية", group: "data", dur: 6, fields: [T("values", "list", "Values", "القيم", "12, 19, 8, 24, 16"), T("labels", "list", "Labels", "التسميات", ["Mon, Tue, Wed, Thu, Fri", "الإثنين، الثلاثاء، الأربعاء، الخميس، الجمعة"]), T("title", "text", "Title", "العنوان", ["Weekly views", "المشاهدات الأسبوعية"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, v = nums(m.p.values), lb = labels(m.p.labels), max = Math.max(1, ...v), n = Math.max(1, v.length), CW = m.W * 0.7, CH = m.H * 0.5, X0 = (m.W - CW) / 2, Y0 = m.H * 0.78, bw = (CW / n) * 0.62, k = 1 - outK(m);
    x.globalAlpha = k; text(m, m.p.title, m.W / 2, m.H * 0.18, { px: u * 0.06, weight: 800, align: "center" }); x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(X0, Y0, CW, u * 0.003);
    v.forEach((val, i) => { const g = sp(m, 6 + i * 5, { damping: 15, stiffness: 110 }), hgt = (val / max) * CH * g, bx = X0 + (i + 0.5) * (CW / n) - bw / 2;
      rrect(x, bx, Y0 - hgt, bw, hgt, u * 0.01); x.fillStyle = i === v.indexOf(max) ? m.p.accent : "rgba(255,255,255,.85)"; x.fill();
      x.globalAlpha = k * cl(g); text(m, String(Math.round(val * g)), bx + bw / 2, Y0 - hgt - u * 0.03, { px: u * 0.035, weight: 700, align: "center" }); text(m, lb[i] || "", bx + bw / 2, Y0 + u * 0.035, { px: u * 0.03, weight: 500, align: "center", color: "rgba(255,255,255,.75)", maxW: CW / n }); x.globalAlpha = k; }); } },
  { id: "ch-line", en: "Line chart", ar: "خط بياني", group: "data", dur: 6, fields: [T("values", "list", "Values", "القيم", "3, 7, 5, 11, 9, 15, 18"), T("title", "text", "Title", "العنوان", ["Growth", "النمو"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, v = nums(m.p.values), max = Math.max(1, ...v), min = Math.min(0, ...v), CW = m.W * 0.7, CH = m.H * 0.48, X0 = (m.W - CW) / 2, Y0 = m.H * 0.78, k = 1 - outK(m);
    const pts: M.Pt[] = v.map((val, i) => [X0 + (i / Math.max(1, v.length - 1)) * CW, Y0 - ((val - min) / (max - min || 1)) * CH]); const e = M.evolve(pts, ease.easeInOut(cl((m.t - 0.3) / 1.6)), false);
    x.globalAlpha = k; text(m, m.p.title, m.W / 2, m.H * 0.18, { px: u * 0.06, weight: 800, align: "center" }); x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = 1; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(X0, Y0 - (i / 4) * CH); x.lineTo(X0 + CW, Y0 - (i / 4) * CH); x.stroke(); }
    x.strokeStyle = m.p.accent; x.lineWidth = u * 0.008; x.lineJoin = "round"; x.lineCap = "round"; x.setLineDash(e.dash); x.lineDashOffset = e.offset; x.stroke(new Path2D(M.toPath(pts, false))); x.setLineDash([]);
    const head = M.pointAt(pts, ease.easeInOut(cl((m.t - 0.3) / 1.6)), false); x.beginPath(); x.arc(head[0], head[1], u * 0.014, 0, 7); x.fillStyle = "#fff"; x.fill(); } },
  { id: "ch-pie", en: "Donut chart", ar: "مخطط دائري", group: "data", dur: 6, fields: [T("values", "list", "Values", "القيم", "45, 30, 25"), T("labels", "list", "Labels", "التسميات", ["Video, Photo, Audio", "فيديو، صور، صوت"])], draw(m) {
    const x = m.ctx, u = m.u, v = nums(m.p.values), lb = labels(m.p.labels), sum = v.reduce((a, b) => a + b, 0) || 1, R = u * 0.22, cx = m.W * 0.4, cy = m.H / 2, cols = ["#00F0FF", "#7B61FF", "#FF3D9A", "#ffd23f", "#2dd4a8", "#ff7a1a"], g = ease.easeInOut(cl((m.t - 0.2) / 1.4)), k = 1 - outK(m);
    x.globalAlpha = k; let a0 = -Math.PI / 2; v.forEach((val, i) => { const a1 = a0 + (val / sum) * Math.PI * 2 * g; x.beginPath(); x.arc(cx, cy, R, a0, a1); x.strokeStyle = cols[i % 6]; x.lineWidth = u * 0.08; x.stroke(); a0 = a1;
      x.globalAlpha = k * cl((m.t - 0.6 - i * 0.2) / 0.4); x.fillStyle = cols[i % 6]; x.fillRect(m.W * 0.68, cy - u * 0.12 + i * u * 0.08, u * 0.03, u * 0.03); text(m, (lb[i] || "") + "  " + Math.round((val / sum) * 100) + "%", m.W * 0.68 + u * 0.05, cy - u * 0.105 + i * u * 0.08, { px: u * 0.036, weight: 700 }); x.globalAlpha = k; });
    text(m, Math.round(100 * g) + "%", cx, cy, { px: u * 0.06, weight: 800, align: "center" }); } },
  { id: "ch-counter", en: "Number counter", ar: "عدّاد أرقام", group: "data", dur: 4, fields: [T("to", "number", "Up to", "حتى", 25000, { min: -1e9, max: 1e9, step: 1 }), T("from", "number", "From", "من", 0, { min: -1e9, max: 1e9, step: 1 }), T("prefix", "text", "Before", "قبل", ""), T("suffix", "text", "After", "بعد", ["+ users", "+ مستخدم"]), T("color", "color", "Colour", "اللون", "#ffffff"), BG()], draw(m) {
    const n = M.interpolate(m.t, [0.2, Math.max(0.5, m.dur * 0.6)], [Number(m.p.from), Number(m.p.to)], { easing: ease.easeOut }), s = m.p.prefix + Math.round(n).toLocaleString("en") + m.p.suffix, k = 1 - outK(m), pop = 1 + 0.06 * Math.sin(cl((m.t - m.dur * 0.6) / 0.3) * Math.PI);
    m.ctx.globalAlpha = k * cl(m.t / 0.25); m.ctx.translate(m.W / 2, m.H / 2); m.ctx.scale(pop, pop); text(m, s, 0, 0, { px: m.u * 0.14, weight: 900, color: m.p.color, align: "center", maxW: m.W * 0.9 });
    m.ctx.fillStyle = m.p.accent; m.ctx.fillRect(-m.u * 0.1, m.u * 0.1, m.u * 0.2 * ease.easeOut(cl(m.t / 1)), m.u * 0.01); } },
  { id: "ch-progress", en: "Progress ring", ar: "حلقة تقدّم", group: "data", dur: 4, fields: [T("pct", "number", "Percent", "النسبة", 82, { min: 0, max: 100, step: 1 }), T("label", "text", "Label", "التسمية", ["Complete", "مكتمل"]), T("ring", "bool", "Ring (off: bar)", "حلقة (أو شريط)", true), BG()], draw(m) {
    const x = m.ctx, u = m.u, g = ease.easeInOut(cl((m.t - 0.2) / 1.6)) * m.p.pct / 100, k = 1 - outK(m); x.globalAlpha = k;
    if (m.p.ring) { const R = u * 0.2; x.lineWidth = u * 0.035; x.lineCap = "round"; x.strokeStyle = "rgba(255,255,255,.15)"; x.beginPath(); x.arc(m.W / 2, m.H / 2, R, 0, 7); x.stroke();
      x.strokeStyle = m.p.accent; x.beginPath(); x.arc(m.W / 2, m.H / 2, R, -Math.PI / 2, -Math.PI / 2 + g * Math.PI * 2); x.stroke(); text(m, Math.round(g * 100) + "%", m.W / 2, m.H / 2 - u * 0.01, { px: u * 0.08, weight: 800, align: "center" });
      text(m, m.p.label, m.W / 2, m.H / 2 + u * 0.06, { px: u * 0.03, weight: 600, align: "center", color: "rgba(255,255,255,.75)" }); }
    else { const w = m.W * 0.6, X = (m.W - w) / 2, Y = m.H * 0.7; rrect(x, X, Y, w, u * 0.03, u * 0.015); x.fillStyle = "rgba(255,255,255,.15)"; x.fill(); rrect(x, X, Y, w * g, u * 0.03, u * 0.015); x.fillStyle = m.p.accent; x.fill();
      text(m, m.p.label + "  " + Math.round(g * 100) + "%", X, Y - u * 0.04, { px: u * 0.04, weight: 700 }); } } },
  // ======== shapes & backgrounds
  { id: "bg-blobs", en: "Living gradient", ar: "تدرج حيّ", group: "shapes", dur: 8, fields: [T("c1", "color", "Colour 1", "اللون 1", "#00F0FF"), T("c2", "color", "Colour 2", "اللون 2", "#7B61FF"), T("c3", "color", "Colour 3", "اللون 3", "#FF3D9A"), T("bg", "color", "Background", "الخلفية", "#0f1014"), T("speed", "number", "Speed", "السرعة", 1, { min: 0, max: 4, step: 0.1 })], draw(m) {
    const x = m.ctx; x.fillStyle = m.p.bg; x.fillRect(0, 0, m.W, m.H); x.globalCompositeOperation = "lighter";
    [m.p.c1, m.p.c2, m.p.c3].forEach((c, i) => { const tt = m.t * 0.25 * m.p.speed, cx = m.W * (0.5 + 0.4 * M.noise2("bx" + i, tt, i * 3)), cy = m.H * (0.5 + 0.4 * M.noise2("by" + i, tt + 9, i)), R = Math.max(m.W, m.H) * 0.55;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)"); x.globalAlpha = 0.75; x.fillStyle = g; x.fillRect(0, 0, m.W, m.H); }); x.globalCompositeOperation = "source-over"; } },
  { id: "sh-burst", en: "Sun burst", ar: "انفجار شعاعي", group: "shapes", dur: 4, fields: [T("color", "color", "Colour", "اللون", "#ffd23f"), T("rays", "number", "Rays", "الأشعة", 18, { min: 4, max: 60, step: 1 })], draw(m) {
    const x = m.ctx, u = m.u, n = Math.round(m.p.rays), rot = m.t * 0.3, a = ease.easeOut(cl(m.t / 0.6)), k = 1 - outK(m); x.globalAlpha = k * 0.85; x.translate(m.W / 2, m.H / 2); x.rotate(rot); x.fillStyle = m.p.color;
    for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, w = (Math.PI / n) * 0.6; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, Math.max(m.W, m.H) * a, a0 - w, a0 + w); x.closePath(); x.fill(); } } },
  { id: "sh-confetti", en: "Confetti", ar: "قصاصات احتفال", group: "shapes", dur: 4, fields: [T("count", "number", "Pieces", "القطع", 120, { min: 10, max: 400, step: 10 }), T("seed", "text", "Seed", "البذرة", "party")], draw(m) {
    const x = m.ctx, u = m.u, cols = ["#00F0FF", "#7B61FF", "#FF3D9A", "#ffd23f", "#2dd4a8", "#ffffff"];
    for (let i = 0; i < m.p.count; i++) { const r = (k: string) => M.random(m.p.seed + k + i), sx = r("x") * m.W, delay = r("d") * 0.8, tt = Math.max(0, m.t - delay), y = -u * 0.05 + tt * (m.H * (0.35 + r("v") * 0.4)) + 0.5 * 300 * tt * tt * (u / 1000);
      if (y > m.H + u * 0.05 || tt <= 0) continue; const xx = sx + Math.sin(tt * (2 + r("w") * 4) + r("p") * 6) * u * 0.04; x.save(); x.translate(xx, y); x.rotate(tt * (r("r") - 0.5) * 12); x.scale(1, Math.cos(tt * (3 + r("f") * 6)));
      x.fillStyle = cols[Math.floor(r("c") * cols.length)]; x.fillRect(-u * 0.008, -u * 0.012, u * 0.016, u * 0.024); x.restore(); } } },
  { id: "sh-ripple", en: "Ripples", ar: "تموجات", group: "shapes", dur: 4, fields: [T("color", "color", "Colour", "اللون", "#00F0FF"), T("rings", "number", "Rings", "الحلقات", 5, { min: 1, max: 12, step: 1 })], draw(m) {
    const x = m.ctx, u = m.u; x.lineWidth = u * 0.006; for (let i = 0; i < m.p.rings; i++) { const p = M.loop(m.t / 2 + i / m.p.rings, 1); x.globalAlpha = (1 - p) * (1 - outK(m)); x.strokeStyle = m.p.color; x.beginPath(); x.arc(m.W / 2, m.H / 2, p * u * 0.6, 0, 7); x.stroke(); } } },
  { id: "sh-draw", en: "Shape draws itself", ar: "شكل يرسم نفسه", group: "shapes", dur: 3, fields: [T("shape", "select", "Shape", "الشكل", "star", { options: [["star", "Star", "نجمة"], ["heart", "Heart", "قلب"], ["circle", "Circle", "دائرة"], ["rect", "Square", "مربع"], ["triangle", "Triangle", "مثلث"], ["hexagon", "Hexagon", "سداسي"]] }), T("color", "color", "Colour", "اللون", "#00F0FF"), T("fill", "bool", "Fill at the end", "تعبئة في النهاية", true)], draw(m) {
    const x = m.ctx, u = m.u, R = u * 0.22, P = ({ star: M.shapes.star(R, R * 0.45), heart: M.shapes.heart(R), circle: M.shapes.circle(R), rect: M.shapes.rect(R * 1.6, R * 1.6), triangle: M.shapes.triangle(R), hexagon: M.shapes.polygon(R, 6) } as Record<string, M.Pt[]>)[m.p.shape] || M.shapes.star(R, R * 0.45);
    const k = ease.easeInOut(cl(m.t / 1.4)), e = M.evolve(P, k), path = new Path2D(M.toPath(P)); x.translate(m.W / 2, m.H / 2); x.globalAlpha = 1 - outK(m);
    if (m.p.fill) { x.globalAlpha *= cl((m.t - 1.4) / 0.5); x.fillStyle = m.p.color; x.fill(path); x.globalAlpha = 1 - outK(m); }
    x.setLineDash(e.dash); x.lineDashOffset = e.offset; x.lineWidth = u * 0.012; x.lineJoin = "round"; x.strokeStyle = m.p.color; x.stroke(path); } },
  // ======== callouts
  { id: "co-arrow", en: "Arrow to a point", ar: "سهم نحو نقطة", group: "callouts", dur: 4, fields: [T("label", "text", "Label", "التسمية", ["Look here!", "انظر هنا!"]), T("tx", "number", "Point across (%)", "النقطة أفقياً (%)", 70, { min: 0, max: 100, step: 1 }), T("ty", "number", "Point down (%)", "النقطة عمودياً (%)", 40, { min: 0, max: 100, step: 1 }), T("color", "color", "Colour", "اللون", "#ffe600")], draw(m) {
    const x = m.ctx, u = m.u, tx = (m.p.tx / 100) * m.W, ty = (m.p.ty / 100) * m.H, sx = m.W * 0.25, sy = m.H * 0.78, cx = (sx + tx) / 2 - u * 0.1, cy = Math.min(sy, ty) - u * 0.1;
    const pts: M.Pt[] = Array.from({ length: 40 }, (_, i) => { const t = i / 39; return [(1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t * t * tx, (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t * t * ty]; }); const k = ease.easeInOut(cl(m.t / 1)), e = M.evolve(pts, k, false), kk = 1 - outK(m);
    x.globalAlpha = kk; x.strokeStyle = m.p.color; x.lineWidth = u * 0.01; x.lineCap = "round"; x.setLineDash(e.dash); x.lineDashOffset = e.offset; x.stroke(new Path2D(M.toPath(pts, false))); x.setLineDash([]);
    if (k > 0.95) { const a = Math.atan2(ty - pts[37][1], tx - pts[37][0]); x.fillStyle = m.p.color; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx - Math.cos(a - 0.5) * u * 0.05, ty - Math.sin(a - 0.5) * u * 0.05); x.lineTo(tx - Math.cos(a + 0.5) * u * 0.05, ty - Math.sin(a + 0.5) * u * 0.05); x.fill(); }
    x.globalAlpha = kk * cl(m.t / 0.4); text(m, m.p.label, sx, sy + u * 0.05, { px: u * 0.055, weight: 800, color: m.p.color, align: "center" }); } },
  { id: "co-circle", en: "Hand-drawn circle", ar: "دائرة باليد", group: "callouts", dur: 3, fields: [T("tx", "number", "Across (%)", "أفقياً (%)", 50, { min: 0, max: 100, step: 1 }), T("ty", "number", "Down (%)", "عمودياً (%)", 50, { min: 0, max: 100, step: 1 }), T("size", "number", "Size", "الحجم", 1, { min: 0.2, max: 3, step: 0.05 }), T("color", "color", "Colour", "اللون", "#ff3b30")], draw(m) {
    const x = m.ctx, u = m.u, R = u * 0.16 * m.p.size, cx = (m.p.tx / 100) * m.W, cy = (m.p.ty / 100) * m.H;
    const pts: M.Pt[] = Array.from({ length: 80 }, (_, i) => { const a = (i / 70) * Math.PI * 2 - 1, r = R * (1 + 0.08 * M.noise2("c", i / 12, 1)); return [cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r]; });
    const e = M.evolve(pts, ease.easeOut(cl(m.t / 0.9)), false); x.globalAlpha = 1 - outK(m); x.strokeStyle = m.p.color; x.lineWidth = u * 0.012; x.lineCap = "round"; x.setLineDash(e.dash); x.lineDashOffset = e.offset; x.stroke(new Path2D(M.toPath(pts, false))); } },
  { id: "co-pin", en: "Map pin", ar: "دبوس خريطة", group: "callouts", dur: 4, fields: [T("place", "text", "Place", "المكان", ["Riyadh", "الرياض"]), T("tx", "number", "Across (%)", "أفقياً (%)", 50, { min: 0, max: 100, step: 1 }), T("ty", "number", "Down (%)", "عمودياً (%)", 45, { min: 0, max: 100, step: 1 }), BG({ def: "#ff3b30" })], draw(m) {
    const x = m.ctx, u = m.u, cx = (m.p.tx / 100) * m.W, cy = (m.p.ty / 100) * m.H, s = sp(m, 0, { damping: 9, stiffness: 170 }), drop = (1 - s) * u * 0.4, k = 1 - outK(m); x.globalAlpha = k;
    for (let i = 0; i < 2; i++) { const p = M.loop(m.t / 1.6 + i / 2, 1); x.globalAlpha = k * (1 - p) * cl(m.t - 0.5); x.strokeStyle = m.p.accent; x.lineWidth = u * 0.004; x.beginPath(); x.ellipse(cx, cy, p * u * 0.12, p * u * 0.04, 0, 0, 7); x.stroke(); } x.globalAlpha = k;
    x.save(); x.translate(cx, cy - drop); x.fillStyle = m.p.accent; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-u * 0.07, -u * 0.08, -u * 0.06, -u * 0.16, 0, -u * 0.16); x.bezierCurveTo(u * 0.06, -u * 0.16, u * 0.07, -u * 0.08, 0, 0); x.fill();
    x.beginPath(); x.arc(0, -u * 0.11, u * 0.022, 0, 7); x.fillStyle = "#fff"; x.fill(); x.restore();
    x.globalAlpha = k * cl((m.t - 0.6) / 0.4); const w = measure(m, m.p.place, u * 0.045, 800) + u * 0.06; rrect(x, cx - w / 2, cy - u * 0.27, w, u * 0.07, u * 0.035); x.fillStyle = "#fff"; x.fill(); text(m, m.p.place, cx, cy - u * 0.235, { px: u * 0.045, weight: 800, color: "#111", align: "center" }); } },
  // ======== timers
  { id: "tm-countdown", en: "Countdown", ar: "عدّ تنازلي", group: "timers", dur: 4, fields: [T("from", "number", "From", "من", 3, { min: 1, max: 60, step: 1 }), T("end", "text", "Last word", "الكلمة الأخيرة", ["GO!", "انطلق!"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, step = (m.dur - 0.6) / m.p.from, i = Math.floor(m.t / step), local = m.t - i * step, n = m.p.from - i, s = 1.4 - 0.4 * ease.easeOut(cl(local / 0.3));
    x.lineWidth = u * 0.015; x.strokeStyle = "rgba(255,255,255,.2)"; x.beginPath(); x.arc(m.W / 2, m.H / 2, u * 0.2, 0, 7); x.stroke(); x.strokeStyle = m.p.accent; x.beginPath(); x.arc(m.W / 2, m.H / 2, u * 0.2, -Math.PI / 2, -Math.PI / 2 + (local / step) * Math.PI * 2); x.stroke();
    x.translate(m.W / 2, m.H / 2); x.scale(s, s); x.globalAlpha = cl(1.5 - local / step); text(m, n > 0 ? String(n) : m.p.end, 0, 0, { px: u * 0.18, weight: 900, align: "center", maxW: u * 0.36 }); } },
  { id: "tm-clock", en: "Timer", ar: "مؤقّت", group: "timers", dur: 6, fields: [T("start", "number", "Starts at (s)", "يبدأ من (ث)", 0, { min: 0, max: 36000, step: 1 }), T("down", "bool", "Counts down", "عدّ تنازلي", false), T("color", "color", "Colour", "اللون", "#ffffff")], draw(m) {
    const v = Math.max(0, m.p.down ? m.p.start - m.t : m.p.start + m.t), mm = Math.floor(v / 60), ss = Math.floor(v % 60), cs = Math.floor((v % 1) * 100);
    m.ctx.globalAlpha = life(m, 0.3, 0.3); text(m, `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}`, m.W / 2, m.H / 2, { px: m.u * 0.13, weight: 600, color: m.p.color, align: "center", fam: '"JetBrains Mono",monospace' }); } },
  // ======== sound-reactive
  { id: "au-bars", en: "Sound bars", ar: "أعمدة الصوت", group: "audio", dur: 8, fields: [T("bars", "number", "Bars", "الأعمدة", 32, { min: 8, max: 96, step: 1 }), BG(), T("mirror", "bool", "Mirrored", "متماثل", true)], draw(m) {
    const x = m.ctx, u = m.u, b = m.bars(Math.round(m.p.bars)), n = b.length, CW = m.W * 0.8, X0 = (m.W - CW) / 2, w = (CW / n) * 0.7, Y = m.H * (m.p.mirror ? 0.5 : 0.85), k = life(m, 0.3, 0.3); x.globalAlpha = k; x.fillStyle = m.p.accent;
    b.forEach((v, i) => { const h = Math.max(u * 0.006, v * m.H * 0.35); const bx = X0 + (i + 0.15) * (CW / n); rrect(x, bx, m.p.mirror ? Y - h / 2 : Y - h, w, h, w / 2); x.fill(); }); } },
  { id: "au-circle", en: "Sound circle", ar: "دائرة الصوت", group: "audio", dur: 8, fields: [BG(), T("label", "text", "Middle", "في المنتصف", "nooi")], draw(m) {
    const x = m.ctx, u = m.u, b = m.bars(64), R = u * 0.16 * (1 + m.audio() * 0.25), cx = m.W / 2, cy = m.H / 2, k = life(m, 0.3, 0.3); x.globalAlpha = k; x.strokeStyle = m.p.accent; x.lineWidth = u * 0.008; x.lineCap = "round";
    b.forEach((v, i) => { const a = (i / b.length) * Math.PI * 2, l = u * 0.02 + v * u * 0.16; x.beginPath(); x.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.lineTo(cx + Math.cos(a) * (R + l), cy + Math.sin(a) * (R + l)); x.stroke(); });
    text(m, m.p.label, cx, cy, { px: u * 0.06, weight: 800, align: "center" }); } },
  ...MORE, ...INFOGRAPHICS, ...THREE_D, ...DRAWN, ...FLAT2, ...SCENES,
  ...MORE3,
  ...BACKGROUNDS,
  // ======== code
  { id: "code", en: "Motion code", ar: "كود الحركة", group: "code", dur: 5, fields: [T("code", "code", "Code", "الكود", CODE_EXAMPLE)], draw() { /* drawn by the sandbox (motion/code.ts) */ } },
];
export const templateOf = (id: string) => TEMPLATES.find((t) => t.id === id);
export const defaultsOf = (t: Template, lang: "en" | "ar"): Props => Object.fromEntries(t.fields.map((f) => [f.k, Array.isArray(f.def) && f.type !== "list" ? f.def[lang === "ar" ? 1 : 0] : Array.isArray(f.def) ? f.def[lang === "ar" ? 1 : 0] : f.def]));
