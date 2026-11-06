// nooi Motion templates, sixth set (v242): Infographics — the classic editor's infographics brought back, redrawn for nooi Motion:
// a checklist, steps, a cycle, a pyramid, a comparison table, a KPI board, an icon row, a quote, a call to action, a news ticker,
// a route between two places and a people chart. Every word and number is a field (any language — Arabic lays out right to left),
// drawn frame by frame from its props, so the preview and the export are the same picture. Our own designs.
import { AR, BG, T, cl, ease, labels, measure, nums, outK, rrect, sp, text, type MCtx, type Template } from "./kit";

const PAL = ["#00F0FF", "#7B61FF", "#FF3D9A", "#ffd23f", "#2dd4a8", "#ff7a1a"];
const A2 = (def = "#7B61FF") => BG({ k: "accent2", en: "Second colour", ar: "اللون الثاني", def });
const items = (s: string) => String(s || "").split(/\s*[|\n]\s*|\s*[,،]\s*/).map((v) => v.trim()).filter(Boolean);
const rtlOf = (...s: string[]) => s.some((v) => AR.test(String(v || "")));
const CARD = "rgba(16,18,24,.88)";
// words broken into lines that fit (Arabic stays joined: whole words only)
function wrap(m: MCtx, s: string, px: number, maxW: number, weight = 700) {
  const out: string[] = []; let line = "";
  for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const t = line ? line + " " + w : w; if (line && measure(m, t, px, weight) > maxW) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
// small icons drawn with lines (the same in the preview and the export)
function glyph(x: CanvasRenderingContext2D, kind: string, cx: number, cy: number, r: number) {
  x.save(); x.translate(cx, cy); x.lineWidth = r * 0.16; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath();
  if (kind === "spark") { for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.38 : r; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill(); }
  else if (kind === "shield") { x.moveTo(0, -r); x.lineTo(r * 0.8, -r * 0.6); x.lineTo(r * 0.7, r * 0.3); x.quadraticCurveTo(0, r * 1.05, -r * 0.7, r * 0.3); x.lineTo(-r * 0.8, -r * 0.6); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(-r * 0.32, 0); x.lineTo(-r * 0.05, r * 0.28); x.lineTo(r * 0.38, -r * 0.25); x.stroke(); }
  else if (kind === "wallet" || kind === "coin") { x.arc(0, 0, r * 0.85, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0, -r * 0.5); x.lineTo(0, r * 0.5); x.moveTo(r * 0.3, -r * 0.3); x.quadraticCurveTo(-r * 0.4, -r * 0.42, -r * 0.3, -r * 0.05); x.quadraticCurveTo(r * 0.4, r * 0.1, r * 0.3, r * 0.32); x.quadraticCurveTo(-r * 0.1, r * 0.45, -r * 0.32, r * 0.3); x.stroke(); }
  else if (kind === "users") { x.arc(-r * 0.3, -r * 0.3, r * 0.32, 0, 7); x.moveTo(r * 0.62, -r * 0.2); x.arc(r * 0.4, -r * 0.2, r * 0.24, 0, 7); x.stroke(); x.beginPath(); x.moveTo(-r * 0.95, r * 0.75); x.quadraticCurveTo(-r * 0.3, -r * 0.15, r * 0.35, r * 0.75); x.moveTo(r * 0.2, r * 0.2); x.quadraticCurveTo(r * 0.75, r * 0.05, r, r * 0.65); x.stroke(); }
  else if (kind === "clock") { x.arc(0, 0, r * 0.85, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0, -r * 0.5); x.lineTo(0, 0); x.lineTo(r * 0.38, r * 0.2); x.stroke(); }
  else if (kind === "heart") { x.moveTo(0, r * 0.8); x.bezierCurveTo(-r * 1.2, 0, -r * 0.6, -r * 1, 0, -r * 0.35); x.bezierCurveTo(r * 0.6, -r * 1, r * 1.2, 0, 0, r * 0.8); x.fill(); }
  else if (kind === "bolt") { x.moveTo(r * 0.15, -r); x.lineTo(-r * 0.55, r * 0.15); x.lineTo(-r * 0.02, r * 0.15); x.lineTo(-r * 0.2, r); x.lineTo(r * 0.55, -r * 0.15); x.lineTo(r * 0.02, -r * 0.15); x.closePath(); x.fill(); }
  else { x.arc(0, 0, r * 0.6, 0, 7); x.fill(); }
  x.restore();
}
const ICONS = ["spark", "shield", "wallet", "users", "clock", "heart", "bolt", "coin"];
const ICON_OPT = ICONS.map((k) => [k, k[0].toUpperCase() + k.slice(1), { spark: "نجمة", shield: "درع", wallet: "سعر", users: "أشخاص", clock: "ساعة", heart: "قلب", bolt: "سرعة", coin: "عملة" }[k] as string]) as [string, string, string][];

export const INFOGRAPHICS: Template[] = [
  { id: "ig-checklist", en: "Checklist", ar: "قائمة نقاط", group: "infographics", dur: 6, fields: [T("title", "text", "Title", "العنوان", ["Why us", "لماذا نحن"]), T("items", "list", "Points (| between)", "النقاط (| بينها)", ["Fast delivery | Best quality | 24/7 support | Fair prices", "توصيل سريع | أفضل جودة | دعم على مدار الساعة | أسعار عادلة"]), BG({ def: "#2dd4a8" })], draw(m) {
    const x = m.ctx, u = m.u, it = items(m.p.items).slice(0, 6), rtl = rtlOf(m.p.title, ...it), k = 1 - outK(m), rowH = Math.min(u * 0.11, (m.H * 0.6) / Math.max(1, it.length)), W0 = Math.min(m.W * 0.7, u * 1.3), X = (m.W - W0) / 2, Y0 = m.H * 0.32;
    x.globalAlpha = k; text(m, m.p.title, rtl ? X + W0 : X, m.H * 0.18, { px: u * 0.07, weight: 900, align: rtl ? "right" : "left", maxW: W0 });
    it.forEach((s, i) => { const g = sp(m, 8 + i * 7, { damping: 15, stiffness: 140 }), y = Y0 + i * rowH * 1.15, bx = rtl ? X + W0 - rowH * 0.8 : X, d = ease.easeOut(cl((m.t - 0.4 - i * 0.24) / 0.35));
      x.save(); x.globalAlpha = k * cl(g * 1.4); x.translate((1 - g) * (rtl ? 1 : -1) * u * 0.08, 0);
      rrect(x, bx, y, rowH * 0.8, rowH * 0.8, rowH * 0.22); x.fillStyle = m.p.accent; x.fill();
      x.strokeStyle = "#0f1014"; x.lineWidth = rowH * 0.11; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath(); const c0 = [bx + rowH * 0.2, y + rowH * 0.42], c1 = [bx + rowH * 0.36, y + rowH * 0.58], c2 = [bx + rowH * 0.62, y + rowH * 0.26];
      x.moveTo(c0[0], c0[1]); if (d > 0) { const a = cl(d * 2), b = cl(d * 2 - 1); x.lineTo(c0[0] + (c1[0] - c0[0]) * a, c0[1] + (c1[1] - c0[1]) * a); if (b > 0) x.lineTo(c1[0] + (c2[0] - c1[0]) * b, c1[1] + (c2[1] - c1[1]) * b); } x.stroke();
      text(m, s, rtl ? bx - rowH * 0.35 : bx + rowH * 1.15, y + rowH * 0.42, { px: rowH * 0.42, weight: 700, align: rtl ? "right" : "left", maxW: W0 - rowH * 1.3 }); x.restore(); }); } },
  { id: "ig-steps", en: "Steps", ar: "خطوات", group: "infographics", dur: 6, fields: [T("title", "text", "Title", "العنوان", ["How it works", "كيف يعمل"]), T("items", "list", "Steps (| between)", "الخطوات (| بينها)", ["Order | Prepare | Deliver | Enjoy", "اطلب | نجهّز | نوصّل | استمتع"]), BG(), A2()], draw(m) {
    const x = m.ctx, u = m.u, it = items(m.p.items).slice(0, 6), n = Math.max(1, it.length), rtl = rtlOf(...it), k = 1 - outK(m), CW = m.W * 0.78, X0 = (m.W - CW) / 2, Y = m.H * 0.52, r = Math.min(u * 0.075, CW / n / 3.2), line = ease.easeInOut(cl((m.t - 0.3) / 1.6));
    x.globalAlpha = k; text(m, m.p.title, m.W / 2, m.H * 0.22, { px: u * 0.07, weight: 900, align: "center", maxW: m.W * 0.9 });
    const cx = (i: number) => { const j = rtl ? n - 1 - i : i; return n === 1 ? m.W / 2 : X0 + (j / (n - 1)) * CW; };
    x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = u * 0.008; x.beginPath(); x.moveTo(X0, Y); x.lineTo(X0 + CW, Y); x.stroke();
    x.strokeStyle = m.p.accent; x.beginPath(); if (rtl) { x.moveTo(X0 + CW, Y); x.lineTo(X0 + CW - CW * line, Y); } else { x.moveTo(X0, Y); x.lineTo(X0 + CW * line, Y); } x.stroke();
    it.forEach((s, i) => { const g = sp(m, 6 + i * 9, { damping: 12, stiffness: 150 }), X = cx(i);
      x.save(); x.translate(X, Y); x.scale(cl(g, 0, 1.2), cl(g, 0, 1.2)); x.beginPath(); x.arc(0, 0, r, 0, 7); x.fillStyle = i % 2 ? m.p.accent2 : m.p.accent; x.fill();
      text(m, String(i + 1), 0, r * 0.05, { px: r * 0.9, weight: 900, color: "#0f1014", align: "center" }); x.restore();
      x.globalAlpha = k * cl(g); text(m, s, X, Y + r * 1.9, { px: u * 0.04, weight: 700, align: "center", maxW: CW / n * 0.95 }); x.globalAlpha = k; }); } },
  { id: "ig-cycle", en: "Cycle", ar: "دورة", group: "infographics", dur: 7, fields: [T("center", "text", "Middle", "الوسط", ["Growth", "النمو"]), T("items", "list", "Parts (| between)", "الأجزاء (| بينها)", ["Plan | Build | Launch | Learn", "خطّط | ابنِ | أطلق | تعلّم"]), BG(), A2("#FF3D9A")], draw(m) {
    const x = m.ctx, u = m.u, it = items(m.p.items).slice(0, 6), n = Math.max(1, it.length), k = 1 - outK(m), R = u * 0.28, cx = m.W / 2, cy = m.H / 2, spin = ease.easeOut(cl(m.t / 1.4)) * Math.PI * 2;
    x.globalAlpha = k; x.lineWidth = u * 0.012; x.lineCap = "round";
    for (let i = 0; i < n; i++) { const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2 + 0.12, a1 = a0 + (Math.PI * 2) / n - 0.24, shown = cl(spin / (Math.PI * 2) * n - i);
      if (shown <= 0) continue; x.strokeStyle = PAL[i % PAL.length]; x.beginPath(); x.arc(cx, cy, R, a0, a0 + (a1 - a0) * shown); x.stroke();
      if (shown >= 1) { const ah = a1, px1 = cx + Math.cos(ah) * R, py1 = cy + Math.sin(ah) * R; x.save(); x.translate(px1, py1); x.rotate(ah + Math.PI / 2); x.fillStyle = PAL[i % PAL.length]; x.beginPath(); x.moveTo(u * 0.03, 0); x.lineTo(-u * 0.02, -u * 0.025); x.lineTo(-u * 0.02, u * 0.025); x.closePath(); x.fill(); x.restore(); }
      const am = (a0 + a1) / 2, lx = cx + Math.cos(am) * (R + u * 0.12), ly = cy + Math.sin(am) * (R + u * 0.09); x.globalAlpha = k * shown; text(m, it[i], lx, ly, { px: u * 0.042, weight: 800, align: "center", maxW: u * 0.36 }); x.globalAlpha = k; }
    const g = sp(m, 4); x.save(); x.translate(cx, cy); x.scale(g, g); x.beginPath(); x.arc(0, 0, R * 0.62, 0, 7); x.fillStyle = CARD; x.fill(); x.strokeStyle = m.p.accent; x.lineWidth = u * 0.006; x.stroke();
    text(m, m.p.center, 0, 0, { px: u * 0.06, weight: 900, align: "center", maxW: R * 1.1 }); x.restore(); } },
  { id: "ig-pyramid", en: "Pyramid", ar: "هرم", group: "infographics", dur: 6, fields: [T("title", "text", "Title", "العنوان", ["What matters most", "ما يهم أكثر"]), T("items", "list", "Levels, top first (| between)", "المستويات من الأعلى (| بينها)", ["Vision | Strategy | Plans | Daily work", "الرؤية | الاستراتيجية | الخطط | العمل اليومي"]), BG()], draw(m) {
    const x = m.ctx, u = m.u, it = items(m.p.items).slice(0, 6), n = Math.max(1, it.length), k = 1 - outK(m), H0 = m.H * 0.62, Y0 = m.H * 0.28, Wb = Math.min(m.W * 0.7, u * 1.25), cx = m.W / 2, lh = H0 / n;
    x.globalAlpha = k; text(m, m.p.title, cx, m.H * 0.15, { px: u * 0.065, weight: 900, align: "center", maxW: m.W * 0.9 });
    for (let i = 0; i < n; i++) { const g = sp(m, 4 + (n - 1 - i) * 7, { damping: 14, stiffness: 130 }), yT = Y0 + i * lh, wT = (Wb * i) / n, wB = (Wb * (i + 1)) / n;
      x.save(); x.globalAlpha = k * cl(g * 1.3); x.translate(0, (1 - g) * u * 0.1); x.beginPath(); x.moveTo(cx - wT / 2 + u * 0.004, yT + u * 0.006); x.lineTo(cx + wT / 2 - u * 0.004, yT + u * 0.006); x.lineTo(cx + wB / 2, yT + lh - u * 0.006); x.lineTo(cx - wB / 2, yT + lh - u * 0.006); x.closePath();
      x.fillStyle = i === 0 ? m.p.accent : PAL[(i + 1) % PAL.length]; x.fill(); text(m, it[i], cx, yT + lh * 0.58, { px: Math.min(lh * 0.36, u * 0.045), weight: 800, align: "center", color: "#0f1014", maxW: Math.max(u * 0.12, (wT + wB) / 2 * 0.8) }); x.restore(); } } },
  { id: "ig-table", en: "Comparison table", ar: "جدول مقارنة", group: "infographics", dur: 7, fields: [T("ca", "text", "Column 1", "العمود 1", ["Us", "نحن"]), T("cb", "text", "Column 2", "العمود 2", ["Others", "غيرنا"]), T("rows", "list", "Rows (| between)", "الصفوف (| بينها)", ["Free delivery | Same-day support | Lifetime warranty | Local team", "توصيل مجاني | دعم في نفس اليوم | ضمان مدى الحياة | فريق محلي"]), T("marks", "text", "Column 2 ✓ (1 = yes, 0 = no)", "علامات العمود 2 (1 نعم، 0 لا)", "0,1,0,0"), BG({ def: "#2dd4a8" })], draw(m) {
    const x = m.ctx, u = m.u, rows = items(m.p.rows).slice(0, 7), mk = String(m.p.marks || "").split(/[,،\s]+/), rtl = rtlOf(m.p.ca, ...rows), k = 1 - outK(m), TW = Math.min(m.W * 0.82, u * 1.5), X = (m.W - TW) / 2, rh = Math.min(u * 0.1, (m.H * 0.62) / (rows.length + 1)), Y = (m.H - rh * (rows.length + 1)) / 2;
    const colL = TW * 0.56, colW = (TW - colL) / 2, colX = (c: number) => (rtl ? X + TW - colL - colW * (c + 1) + colW / 2 : X + colL + colW * c + colW / 2), lab = rtl ? X + TW - u * 0.03 : X + u * 0.03;
    x.globalAlpha = k; rrect(x, X, Y, TW, rh * (rows.length + 1), u * 0.03); x.fillStyle = CARD; x.fill();
    rrect(x, rtl ? X + TW - colL - colW : X + colL, Y + u * 0.01, colW, rh * (rows.length + 1) - u * 0.02, u * 0.02); x.fillStyle = "rgba(45,212,168,.16)"; x.fill();
    text(m, m.p.ca, colX(0), Y + rh / 2, { px: rh * 0.38, weight: 900, align: "center", color: m.p.accent, maxW: colW * 0.9 }); text(m, m.p.cb, colX(1), Y + rh / 2, { px: rh * 0.38, weight: 800, align: "center", color: "rgba(255,255,255,.7)", maxW: colW * 0.9 });
    rows.forEach((s, i) => { const g = cl((m.t - 0.4 - i * 0.22) / 0.3), y = Y + rh * (i + 1.5); x.globalAlpha = k * g; x.fillStyle = "rgba(255,255,255,.08)"; x.fillRect(X + u * 0.02, y - rh / 2, TW - u * 0.04, u * 0.002);
      text(m, s, lab, y, { px: rh * 0.36, weight: 600, align: rtl ? "right" : "left", maxW: colL - u * 0.05 });
      [[true, colX(0)], [mk[i] === "1", colX(1)]].forEach(([yes, cx]) => { x.save(); x.translate(cx as number, y); x.scale(ease.easeOut(g), ease.easeOut(g)); x.lineWidth = rh * 0.09; x.lineCap = "round"; x.strokeStyle = yes ? m.p.accent : "#ff5d6c"; x.beginPath();
        if (yes) { x.moveTo(-rh * 0.18, 0); x.lineTo(-rh * 0.04, rh * 0.14); x.lineTo(rh * 0.2, -rh * 0.14); } else { x.moveTo(-rh * 0.14, -rh * 0.14); x.lineTo(rh * 0.14, rh * 0.14); x.moveTo(rh * 0.14, -rh * 0.14); x.lineTo(-rh * 0.14, rh * 0.14); } x.stroke(); x.restore(); }); }); } },
  { id: "ig-kpi", en: "KPI board", ar: "لوحة مؤشرات", group: "infographics", dur: 6, fields: [T("values", "list", "Numbers", "الأرقام", "12400, 86, 3.2"), T("labels", "list", "Labels", "التسميات", ["Visitors, Happy %, Orders (k)", "الزوار، ٪ الرضا، الطلبات (ألف)"]), T("changes", "list", "Change % (- for down)", "التغير ٪ (- للانخفاض)", "18, 4, -2"), BG({ def: "#2dd4a8" })], draw(m) {
    const x = m.ctx, u = m.u, v = nums(m.p.values).slice(0, 4), lb = labels(m.p.labels), ch = String(m.p.changes || "").split(/[,،\s]+/).map(Number), n = Math.max(1, v.length), gap = u * 0.035, cw = Math.min(u * 0.44, (m.W * 0.9 - gap * (n - 1)) / n), chh = u * 0.42, X0 = (m.W - (cw * n + gap * (n - 1))) / 2, Y = (m.H - chh) / 2, k = 1 - outK(m);
    v.forEach((val, i) => { const s = sp(m, i * 6, { damping: 14, stiffness: 140 }), X = X0 + i * (cw + gap), up = !(ch[i] < 0), col = up ? m.p.accent : "#ff5d6c", cnt = val * ease.easeOut(cl((m.t - 0.3 - i * 0.15) / 1.4));
      x.save(); x.globalAlpha = k * cl(s * 1.5); x.translate(X, Y + (1 - s) * u * 0.12); rrect(x, 0, 0, cw, chh, u * 0.03); x.fillStyle = CARD; x.fill();
      text(m, lb[i] || "", cw / 2, chh * 0.16, { px: u * 0.03, weight: 600, align: "center", color: "rgba(255,255,255,.7)", maxW: cw * 0.9 });
      text(m, (Number.isInteger(val) ? Math.round(cnt) : cnt.toFixed(1)).toLocaleString("en"), cw / 2, chh * 0.4, { px: u * 0.085, weight: 900, align: "center", maxW: cw * 0.88 });
      if (isFinite(ch[i])) text(m, (up ? "▲ " : "▼ ") + Math.abs(ch[i]) + "%", cw / 2, chh * 0.6, { px: u * 0.034, weight: 800, align: "center", color: col });
      const pts = Array.from({ length: 8 }, (_, j) => { const w = Math.sin(j * 1.7 + i) * 0.25 + (up ? j / 7 : 1 - j / 7) * 0.7; return [cw * 0.12 + (j / 7) * cw * 0.76, chh * 0.9 - w * chh * 0.18]; }), a = cl((m.t - 0.6 - i * 0.15) / 1);
      x.save(); x.beginPath(); x.rect(0, 0, cw * 0.12 + cw * 0.76 * a, chh); x.clip(); x.strokeStyle = col; x.lineWidth = u * 0.006; x.lineJoin = "round"; x.beginPath(); pts.forEach((p, j) => (j ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); x.restore(); x.restore(); }); } },
  { id: "ig-icons", en: "Icon row", ar: "صف أيقونات", group: "infographics", dur: 5, fields: [T("title", "text", "Title", "العنوان", ["Why choose us", "لماذا تختارنا"]), T("items", "list", "Labels (| between)", "التسميات (| بينها)", ["Fast | Safe | Fair price | Support", "سريع | آمن | سعر عادل | دعم"]),
    T("i1", "select", "Icon 1", "الأيقونة 1", "bolt", { options: ICON_OPT }), T("i2", "select", "Icon 2", "الأيقونة 2", "shield", { options: ICON_OPT }), T("i3", "select", "Icon 3", "الأيقونة 3", "wallet", { options: ICON_OPT }), T("i4", "select", "Icon 4", "الأيقونة 4", "users", { options: ICON_OPT }), BG()], draw(m) {
    const x = m.ctx, u = m.u, it = items(m.p.items).slice(0, 4), n = Math.max(1, it.length), rtl = rtlOf(...it), k = 1 - outK(m), CW = m.W * 0.8, X0 = (m.W - CW) / 2, r = Math.min(u * 0.1, CW / n / 3.4), Y = m.H * 0.5;
    x.globalAlpha = k; text(m, m.p.title, m.W / 2, m.H * 0.22, { px: u * 0.07, weight: 900, align: "center", maxW: m.W * 0.9 });
    it.forEach((s, i) => { const j = rtl ? n - 1 - i : i, X = X0 + (CW / n) * (j + 0.5), g = sp(m, 6 + i * 7, { damping: 11, stiffness: 160 });
      x.save(); x.translate(X, Y); x.scale(cl(g, 0, 1.25), cl(g, 0, 1.25)); x.beginPath(); x.arc(0, 0, r, 0, 7); x.fillStyle = i % 2 ? PAL[(i + 1) % PAL.length] : m.p.accent; x.fill(); x.fillStyle = "#0f1014"; x.strokeStyle = "#0f1014";
      glyph(x, String(m.p["i" + (i + 1)] || ICONS[i]), 0, 0, r * 0.5); x.restore(); x.globalAlpha = k * cl(g); text(m, s, X, Y + r * 1.7, { px: u * 0.042, weight: 800, align: "center", maxW: CW / n * 0.95 }); x.globalAlpha = k; }); } },
  { id: "ig-quote", en: "Quote", ar: "اقتباس", group: "infographics", dur: 6, fields: [T("text", "text", "Quote", "الاقتباس", ["Creativity is intelligence having fun.", "الإبداع هو الذكاء حين يستمتع."]), T("who", "text", "Who said it", "القائل", ["Albert Einstein", "ألبرت أينشتاين"]), BG({ def: "#ffd23f" })], draw(m) {
    const x = m.ctx, u = m.u, rtl = rtlOf(m.p.text), k = 1 - outK(m), px = u * 0.075, W0 = Math.min(m.W * 0.78, u * 1.4), lines = wrap(m, m.p.text, px, W0, 800), lh = px * 1.25, H0 = lines.length * lh, Y0 = m.H / 2 - H0 / 2, X = rtl ? m.W / 2 + W0 / 2 : m.W / 2 - W0 / 2;
    x.globalAlpha = k * cl(m.t / 0.4); text(m, rtl ? "”" : "“", rtl ? X + u * 0.02 : X - u * 0.02, Y0 - u * 0.06, { px: u * 0.26, weight: 900, color: m.p.accent, align: rtl ? "right" : "left", fam: "Georgia,serif" });
    lines.forEach((ln, i) => { const a = ease.easeOut(cl((m.t - 0.25 - i * 0.25) / 0.5)); x.globalAlpha = k * a; text(m, ln, X, Y0 + i * lh + (1 - a) * u * 0.03, { px, weight: 800, align: rtl ? "right" : "left", maxW: W0 }); });
    const a = ease.easeOut(cl((m.t - 0.5 - lines.length * 0.25) / 0.5)); x.globalAlpha = k * a; x.fillStyle = m.p.accent; const by = Y0 + H0 + u * 0.06; x.fillRect(rtl ? X - u * 0.08 * a : X, by, u * 0.08 * a, u * 0.006);
    text(m, m.p.who, rtl ? X - u * 0.11 : X + u * 0.11, by + u * 0.003, { px: u * 0.04, weight: 600, color: "rgba(255,255,255,.8)", align: rtl ? "right" : "left", maxW: W0 * 0.8 }); } },
  { id: "ig-cta", en: "Call to action", ar: "دعوة لإجراء", group: "infographics", dur: 5, fields: [T("text", "text", "Button", "الزر", ["Shop now", "تسوّق الآن"]), T("sub", "text", "Under it", "تحته", ["nooi.ai", "nooi.ai"]), BG({ def: "#B8F06A" })], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), g = sp(m, 2, { damping: 10, stiffness: 170 }), px = u * 0.07, tw = measure(m, m.p.text, px, 900), bw = tw + u * 0.3, bh = u * 0.15, cx = m.W / 2, cy = m.H * 0.48, pulse = 1 + 0.035 * Math.sin(m.t * 5), rtl = rtlOf(m.p.text);
    x.globalAlpha = k; x.save(); x.translate(cx, cy); x.scale(g * pulse, g * pulse);
    for (let r = 0; r < 2; r++) { const ph = ((m.t * 0.9 + r * 0.5) % 1); x.globalAlpha = k * (1 - ph) * 0.4; rrect(x, -bw / 2 - ph * u * 0.06, -bh / 2 - ph * u * 0.06, bw + ph * u * 0.12, bh + ph * u * 0.12, bh); x.strokeStyle = m.p.accent; x.lineWidth = u * 0.006; x.stroke(); }
    x.globalAlpha = k; rrect(x, -bw / 2, -bh / 2, bw, bh, bh / 2); x.fillStyle = m.p.accent; x.fill(); const ax = (rtl ? -1 : 1) * (tw / 2 + u * 0.04);
    text(m, m.p.text, -(rtl ? -1 : 1) * u * 0.03, 0, { px, weight: 900, color: "#0f1014", align: "center" }); const nud = Math.sin(m.t * 6) * u * 0.008;
    x.strokeStyle = "#0f1014"; x.lineWidth = u * 0.012; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath(); const d = rtl ? -1 : 1; x.moveTo(ax + nud * d, 0); x.lineTo(ax + d * u * 0.05 + nud * d, 0); x.moveTo(ax + d * u * 0.03 + nud * d, -u * 0.022); x.lineTo(ax + d * u * 0.052 + nud * d, 0); x.lineTo(ax + d * u * 0.03 + nud * d, u * 0.022); x.stroke(); x.restore();
    x.globalAlpha = k * cl((m.t - 0.5) / 0.4); text(m, m.p.sub, cx, cy + bh * 0.95, { px: u * 0.04, weight: 600, align: "center", color: "rgba(255,255,255,.85)" }); } },
  { id: "ig-ticker", en: "News ticker", ar: "شريط أخبار", group: "infographics", dur: 10, fields: [T("label", "text", "Label", "التسمية", ["BREAKING", "عاجل"]), T("items", "list", "News (| between)", "الأخبار (| بينها)", ["Our new collection drops this Friday | Free delivery on every order | Open daily 4 PM – midnight", "مجموعتنا الجديدة تصل الجمعة | توصيل مجاني لكل طلب | نفتح يومياً من 4 عصراً حتى منتصف الليل"]), BG({ def: "#FF3D9A" }), T("speed", "number", "Speed", "السرعة", 1, { min: 0.3, max: 3, step: 0.1 })], draw(m) {
    const x = m.ctx, u = m.u, it = items(m.p.items), rtl = rtlOf(m.p.label, ...it), k = 1 - outK(m), bh = u * 0.085, Y = m.H * 0.86, slide = ease.easeOut(cl(m.t / 0.5)), px = bh * 0.46;
    x.globalAlpha = k; x.fillStyle = "rgba(10,12,18,.92)"; x.fillRect(0, Y, m.W * slide, bh);
    const lw = measure(m, m.p.label, px, 900) + u * 0.06, lx = rtl ? m.W - lw : 0; x.fillStyle = m.p.accent; x.fillRect(lx, Y, lw * slide, bh); text(m, m.p.label, lx + lw / 2, Y + bh / 2, { px, weight: 900, color: "#fff", align: "center" });
    const line = it.join("   •   "), tw = measure(m, line + "   •   ", px, 700), off = (m.t * u * 0.18 * Number(m.p.speed || 1)) % Math.max(1, tw);
    x.save(); x.beginPath(); x.rect(rtl ? 0 : lw, Y, m.W - lw, bh); x.clip(); for (let j = -1; j < Math.ceil(m.W / Math.max(1, tw)) + 1; j++) { const X = rtl ? -tw + off + j * tw : lw + m.W - off + j * tw - m.W + u * 0.03;
      text(m, line + "   •   ", X, Y + bh / 2, { px, weight: 700, align: "left", color: "rgba(255,255,255,.95)" }); } x.restore(); } },
  { id: "ig-route", en: "Route", ar: "مسار", group: "infographics", dur: 6, fields: [T("from", "text", "From", "من", ["Riyadh", "الرياض"]), T("to", "text", "To", "إلى", ["Jeddah", "جدة"]), T("note", "text", "Note", "ملاحظة", ["950 km · 9 h", "950 كم · 9 ساعات"]), BG(), A2("#FF3D9A")], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), A = [m.W * 0.24, m.H * 0.62], B = [m.W * 0.76, m.H * 0.4], c1 = [m.W * 0.4, m.H * 0.2], c2 = [m.W * 0.6, m.H * 0.85], a = ease.easeInOut(cl((m.t - 0.5) / 1.8));
    const P = (t: number) => { const s = 1 - t; return [s * s * s * A[0] + 3 * s * s * t * c1[0] + 3 * s * t * t * c2[0] + t * t * t * B[0], s * s * s * A[1] + 3 * s * s * t * c1[1] + 3 * s * t * t * c2[1] + t * t * t * B[1]]; };
    x.globalAlpha = k; x.setLineDash([u * 0.02, u * 0.018]); x.lineDashOffset = -m.t * u * 0.05; x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = u * 0.008; x.lineCap = "round"; x.beginPath();
    for (let i = 0; i <= 60 * a; i++) { const p = P(i / 60); if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); } x.stroke(); x.setLineDash([]);
    const dot = P(a); x.beginPath(); x.arc(dot[0], dot[1], u * 0.016, 0, 7); x.fillStyle = "#fff"; x.fill();
    const pin = (p: number[], col: string, d: number, label: string) => { const g = sp(m, d, { damping: 10, stiffness: 160 }); x.save(); x.translate(p[0], p[1]); x.scale(g, g); x.fillStyle = col; x.beginPath(); x.arc(0, -u * 0.07, u * 0.045, Math.PI * 0.85, Math.PI * 2.15); x.lineTo(0, 0); x.closePath(); x.fill();
      x.beginPath(); x.arc(0, -u * 0.07, u * 0.018, 0, 7); x.fillStyle = "#0f1014"; x.fill(); x.restore(); x.globalAlpha = k * cl(g); text(m, label, p[0], p[1] + u * 0.05, { px: u * 0.045, weight: 800, align: "center", maxW: m.W * 0.4 }); x.globalAlpha = k; };
    pin(A, m.p.accent, 2, m.p.from); x.globalAlpha = k * cl((a - 0.95) * 20); pin(B, m.p.accent2, 0, m.p.to); x.globalAlpha = k;
    if (a > 0.98) { const g = sp(m, Math.round((2.3) * m.fps)); x.globalAlpha = k * cl(g); const nw = measure(m, m.p.note, u * 0.04, 700) + u * 0.06; rrect(x, m.W / 2 - nw / 2, m.H * 0.13, nw, u * 0.08, u * 0.04); x.fillStyle = CARD; x.fill(); text(m, m.p.note, m.W / 2, m.H * 0.13 + u * 0.04, { px: u * 0.04, weight: 700, align: "center" }); } } },
  { id: "ig-people", en: "People chart", ar: "رسم الأشخاص", group: "infographics", dur: 6, fields: [T("pct", "number", "Percent", "النسبة", 70, { min: 0, max: 100, step: 1 }), T("title", "text", "Says", "يقول", ["of people prefer video", "من الناس يفضلون الفيديو"]), BG({ def: "#00F0FF" })], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), p = cl(Number(m.p.pct) / 100), on = Math.round(p * 10), rtl = rtlOf(m.p.title), cols = 10, r = Math.min(u * 0.045, (m.W * 0.8) / cols / 2.6), gx = r * 2.6, X0 = m.W / 2 - (gx * (cols - 1)) / 2, Y = m.H * 0.42, a = cl((m.t - 0.3) / 1.4);
    x.globalAlpha = k; for (let i = 0; i < cols; i++) { const j = rtl ? cols - 1 - i : i, X = X0 + j * gx, lit = i < on && a * 10 > i, g = sp(m, 3 + i * 3, { damping: 12, stiffness: 160 });
      x.save(); x.translate(X, Y); x.scale(g, g); x.fillStyle = lit ? m.p.accent : "rgba(255,255,255,.18)"; x.beginPath(); x.arc(0, -r * 1.1, r * 0.55, 0, 7); x.fill(); rrect(x, -r * 0.75, -r * 0.42, r * 1.5, r * 1.75, r * 0.6); x.fill(); x.restore(); }
    const cnt = Math.round(Number(m.p.pct) * ease.easeOut(a)); text(m, cnt + "%", m.W / 2, Y + r * 3.4, { px: u * 0.12, weight: 900, align: "center", color: m.p.accent });
    text(m, m.p.title, m.W / 2, Y + r * 3.4 + u * 0.1, { px: u * 0.045, weight: 700, align: "center", maxW: m.W * 0.85 }); } },
];
