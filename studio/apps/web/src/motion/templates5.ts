// nooi Motion, studio sets (v235): empty, formal backgrounds for a presenter — no chairs, no tables, no people — for studios,
// technology, business and finance, and a garden wall. Each one moves gently (speed 0 holds it still: the same picture every frame).
// Drawn frame by frame from their props; our own designs.
import { Motion as M } from "@nooi/editor-core";
import { T, type MCtx, type Template } from "./kit";

const SPD = T("speed", "number", "Speed", "السرعة", 1, { min: 0, max: 3, step: 0.1 });
const C = (k: string, en: string, ar: string, def: string) => T(k, "color", en, ar, def);
const R = (s: string, i: number) => M.random(s + ":" + i);
const wrap = (v: number, n: number) => ((v % n) + n) % n;
const rgba = (hex: string, a: number) => { const [r, g, b] = M.parseColor(hex); return `rgba(${r},${g},${b},${a})`; };
const lin = (x: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = x.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
const glow = (x: CanvasRenderingContext2D, X: number, Y: number, r: number, c: string, a = 1) => {
  const g = x.createRadialGradient(X, Y, 0, X, Y, Math.max(1, r)); g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)"); x.globalAlpha = a; x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2); x.globalAlpha = 1; };
/** an empty room: the back wall, the floor with a soft reflection, the wall–floor line at `fy` */
function room(m: MCtx, wall: [string, string], floor: [string, string], fy = 0.72) {
  const x = m.ctx, Y = m.H * fy; x.fillStyle = lin(x, 0, 0, 0, Y, [[0, wall[0]], [1, wall[1]]]); x.fillRect(0, 0, m.W, Y);
  x.fillStyle = lin(x, 0, Y, 0, m.H, [[0, floor[0]], [1, floor[1]]]); x.fillRect(0, Y, m.W, m.H - Y);
  x.fillStyle = "rgba(0,0,0,0.35)"; x.fillRect(0, Y - Math.max(1, m.u * 0.004), m.W, Math.max(1, m.u * 0.008)); return Y; }
/** pools of light on the wall from ceiling spots, drifting a little */
function spots(m: MCtx, Y: number, n: number, col: string, t: number, a = 0.55) {
  const x = m.ctx; for (let i = 0; i < n; i++) { const X = m.W * ((i + 0.5) / n) + Math.sin(t * 0.3 + i * 1.7) * m.W * 0.01, k = 0.85 + 0.15 * Math.sin(t * 0.8 + i * 2.1);
    const g = x.createRadialGradient(X, Y * 0.12, 0, X, Y * 0.35, Y * 0.75); g.addColorStop(0, rgba(col, a * k)); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(X - Y, 0, Y * 2, Y);
    x.fillStyle = "rgba(255,250,235,0.9)"; x.beginPath(); x.ellipse(X, m.u * 0.012, m.u * 0.018, m.u * 0.006, 0, 0, Math.PI * 2); x.fill(); } }
const shine = (m: MCtx, Y: number, col: string, a = 0.25) => { const x = m.ctx; x.globalCompositeOperation = "lighter"; x.fillStyle = lin(x, 0, Y, 0, m.H, [[0, rgba(col, a)], [1, "rgba(0,0,0,0)"]]); x.fillRect(0, Y, m.W, m.H - Y); x.globalCompositeOperation = "source-over"; };

export const STUDIO_SETS: Template[] = [
  { id: "st-cyclo", en: "White cyclorama", ar: "استوديو أبيض لا نهائي", group: "backgrounds", dur: 10, fields: [C("bg", "Backdrop", "الخلفية", "#eceef2"), C("light", "Light", "الضوء", "#ffffff"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; x.fillStyle = lin(x, 0, 0, 0, m.H, [[0, M.interpolateColors(0.25, [0, 1], [m.p.bg, "#000000"])], [0.62, m.p.bg], [1, M.interpolateColors(0.12, [0, 1], [m.p.bg, "#000000"])]]); x.fillRect(0, 0, m.W, m.H);
    glow(x, m.W * (0.5 + 0.12 * Math.sin(t * 0.2)), m.H * 0.5, m.u * 0.9, rgba(m.p.light, 0.55)); x.fillStyle = "rgba(0,0,0,0.06)"; x.beginPath(); x.ellipse(m.W / 2, m.H * 0.82, m.W * 0.35, m.H * 0.04, 0, 0, Math.PI * 2); x.fill(); } },
  { id: "st-panels", en: "Slatted studio", ar: "استوديو ألواح", group: "backgrounds", dur: 10, fields: [C("wall", "Wall", "الجدار", "#3a2a1f"), C("light", "Light", "الضوء", "#ffb85c"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed, Y = room(m, [m.p.wall, M.interpolateColors(0.4, [0, 1], [m.p.wall, "#000000"])], ["#2a1d14", "#120c08"]);
    const n = Math.round(m.W / (m.u * 0.028)); for (let i = 0; i < n; i++) { const X = (i / n) * m.W; x.fillStyle = "rgba(0,0,0,0.28)"; x.fillRect(X, 0, Math.max(1, m.u * 0.006), Y); x.fillStyle = "rgba(255,255,255,0.04)"; x.fillRect(X + m.u * 0.006, 0, Math.max(1, m.u * 0.004), Y); }
    spots(m, Y, 3, m.p.light, t); shine(m, Y, m.p.light, 0.12); } },
  { id: "st-neon", en: "Neon room", ar: "غرفة نيون", group: "backgrounds", dur: 10, fields: [C("c1", "Neon", "النيون", "#00e5ff"), C("wall", "Wall", "الجدار", "#0d1633"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed, Y = room(m, [m.p.wall, "#060a18"], ["#141a2c", "#05070d"], 0.7);
    const k = 0.75 + 0.25 * Math.sin(t * 1.3) ** 2; x.strokeStyle = m.p.c1; x.lineWidth = Math.max(2, m.u * 0.006); x.shadowColor = m.p.c1; x.shadowBlur = m.u * 0.04 * k; x.globalAlpha = k;
    x.beginPath(); x.moveTo(m.W * 0.18, Y); x.lineTo(m.W * 0.18, m.H * 0.12); x.lineTo(m.W * 0.82, m.H * 0.12); x.lineTo(m.W * 0.82, Y); x.stroke();
    x.beginPath(); x.moveTo(0, Y); x.lineTo(m.W, Y); x.stroke(); x.shadowBlur = 0; x.globalAlpha = 1;
    for (let i = 0; i < 18; i++) { const X = m.W * (0.22 + i * 0.033); x.fillStyle = "rgba(255,255,255,0.03)"; x.fillRect(X, m.H * 0.14, m.u * 0.01, Y - m.H * 0.14); }
    shine(m, Y, m.p.c1, 0.22 * k); } },
  { id: "st-hex", en: "Hex tech wall", ar: "جدار تقني سداسي", group: "backgrounds", dur: 10, fields: [C("c1", "Light", "الضوء", "#2f8cff"), C("wall", "Wall", "الجدار", "#070d1c"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed, Y = room(m, [m.p.wall, "#03060d"], ["#0e1424", "#04060b"], 0.76), r = m.u * 0.06, h = r * Math.sqrt(3);
    for (let row = -1; row * h * 0.5 < Y + h; row++) for (let col = -1; col * r * 1.5 < m.W + r; col++) {
      const cx = col * r * 1.5, cy = row * h + (col % 2 ? h / 2 : 0); if (cy > Y + r) continue; const d = Math.hypot(cx - m.W / 2, cy - Y * 0.45) / m.u, wave = 0.5 + 0.5 * Math.sin(d * 6 - t * 1.6), a = 0.08 + 0.5 * wave ** 6 * (R("hx", row * 97 + col) > 0.3 ? 1 : 0.3);
      x.beginPath(); for (let k = 0; k < 6; k++) { const an = (Math.PI / 3) * k; x.lineTo(cx + Math.cos(an) * r * 0.92, cy + Math.sin(an) * r * 0.92); } x.closePath();
      x.fillStyle = rgba(m.p.c1, a * 0.35); x.fill(); x.strokeStyle = rgba(m.p.c1, 0.15 + a * 0.6); x.lineWidth = Math.max(1, m.u * 0.0018); x.stroke(); }
    shine(m, Y, m.p.c1, 0.18); } },
  { id: "st-data", en: "Data streams", ar: "تدفّق البيانات", group: "backgrounds", dur: 10, fields: [C("c1", "Data", "البيانات", "#21e6c1"), C("bg", "Background", "الخلفية", "#03100f"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; x.fillStyle = lin(x, 0, 0, 0, m.H, [[0, m.p.bg], [1, "#000"]]); x.fillRect(0, 0, m.W, m.H);
    const cols = Math.round(m.W / (m.u * 0.03)), cell = m.u * 0.03; x.font = `600 ${Math.round(cell * 0.8)}px ui-monospace,monospace`; x.textAlign = "center"; x.textBaseline = "middle";
    for (let c = 0; c < cols; c++) { const sp = 0.15 + R("ds", c) * 0.35, len = 6 + Math.floor(R("dl", c) * 14), head = wrap(R("dh", c) * 3 + t * sp, 1.6) * (m.H / cell) - len;
      for (let k = 0; k < len; k++) { const row = Math.floor(head + k), Y = row * cell; if (Y < -cell || Y > m.H) continue; const a = (k / len) ** 2;
        x.fillStyle = k === len - 1 ? "rgba(220,255,250,0.95)" : rgba(m.p.c1, a * 0.8); x.fillText(String(Math.floor(M.random("dg" + c + ":" + row + ":" + Math.floor(t * 4 + k)) * 2)), (c + 0.5) * cell, Y); } }
    glow(x, m.W / 2, m.H / 2, m.u * 0.7, "rgba(0,0,0,0.6)"); } },
  { id: "st-globe", en: "Connected world", ar: "عالم متصل", group: "backgrounds", dur: 10, fields: [C("c1", "Dots", "النقاط", "#4fc3ff"), C("c2", "Links", "الروابط", "#ffd24a"), C("bg", "Background", "الخلفية", "#050b1a"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed, cx = m.W * 0.5, cy = m.H * 0.52, Rr = m.u * 0.42; x.fillStyle = lin(x, 0, 0, 0, m.H, [[0, m.p.bg], [1, "#000"]]); x.fillRect(0, 0, m.W, m.H);
    glow(x, cx, cy, Rr * 1.5, rgba(m.p.c1, 0.18)); const rot = t * 0.12, pts: [number, number, number][] = [];
    const dot = Math.max(1, m.u * 0.0045);
    for (let la = -80; la <= 80; la += 4) for (let lo = 0; lo < 360; lo += 4) { const land = M.noise2("land", lo * 0.022, la * 0.032) + 0.35 * M.noise2("land2", lo * 0.06, la * 0.06) > 0.04;   // (perlin: about −0.5…0.5)
      const a = (lo * Math.PI) / 180 + rot, b = (la * Math.PI) / 180, X = Math.cos(b) * Math.sin(a), Z = Math.cos(b) * Math.cos(a); if (Z < 0) continue;
      const px = cx + X * Rr, py = cy - Math.sin(b) * Rr; if (land) pts.push([px, py, Z]); else { x.fillStyle = rgba(m.p.c1, 0.08 * Z); x.fillRect(px, py, dot * 0.7, dot * 0.7); } }
    for (const [X, Y, Z] of pts) { x.fillStyle = rgba(m.p.c1, 0.3 + 0.65 * Z); x.fillRect(X, Y, dot, dot); }
    // links between near-ish places: an arc that draws itself, holds, and fades (the same pairs every frame)
    x.strokeStyle = m.p.c2; x.lineWidth = Math.max(1, m.u * 0.0028); x.shadowColor = m.p.c2; x.shadowBlur = m.u * 0.012; x.lineCap = "round";
    const front = pts.filter((q) => q[2] > 0.35);
    for (let i = 0; i < 7 && front.length > 10; i++) { const p0 = front[Math.floor(R("ga", i) * front.length)], p1 = front[Math.floor(R("gb", i) * front.length)];
      const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (d < Rr * 0.25 || d > Rr * 1.3) continue;
      const k = wrap(t * 0.25 + R("gk", i), 1.3), grow = Math.min(1, k / 0.6), fade = k > 1 ? 1 - (k - 1) / 0.3 : 1; if (fade <= 0) continue;
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2 - d * 0.35, L = d * 1.25;
      x.globalAlpha = fade; x.setLineDash([L * grow, L]); x.beginPath(); x.moveTo(p0[0], p0[1]); x.quadraticCurveTo(mx, my, p1[0], p1[1]); x.stroke();
      x.setLineDash([]); x.fillStyle = m.p.c2; x.beginPath(); x.arc(p0[0], p0[1], m.u * 0.005, 0, Math.PI * 2); x.fill(); if (grow >= 1) { x.beginPath(); x.arc(p1[0], p1[1], m.u * 0.005, 0, Math.PI * 2); x.fill(); } }
    x.globalAlpha = 1; x.setLineDash([]);
    x.shadowBlur = 0; } },
  { id: "st-market", en: "Market wall", ar: "جدار السوق المالي", group: "backgrounds", dur: 10, fields: [C("up", "Up", "صعود", "#22d39a"), C("down", "Down", "هبوط", "#ff4d6d"), C("bg", "Background", "الخلفية", "#06101e"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed, Y = room(m, [m.p.bg, "#030812"], ["#0c1422", "#04070c"], 0.8), top = m.H * 0.12, bot = Y - m.H * 0.12;
    x.strokeStyle = "rgba(120,170,255,0.08)"; x.lineWidth = 1; for (let i = 0; i <= 6; i++) { const yy = top + ((bot - top) * i) / 6; x.beginPath(); x.moveTo(0, yy); x.lineTo(m.W, yy); x.stroke(); }
    const w = m.u * 0.03, n = Math.ceil(m.W / w) + 2, off = (t * w * 0.8) % w, base = Math.floor(t * 0.8);
    const val = (i: number) => 0.5 + 0.3 * M.noise2("mk", i * 0.06, 0) + 0.12 * Math.sin(i * 0.15);
    for (let k = 0; k < n; k++) { const i = base + k, o = val(i), c = val(i + 1), hi = Math.max(o, c) + R("hi", i) * 0.04, lo = Math.min(o, c) - R("lo", i) * 0.04, X = m.W - k * w + off, yy = (v: number) => bot - (bot - top) * v;
      const col = c >= o ? m.p.up : m.p.down; x.strokeStyle = col; x.fillStyle = col; x.globalAlpha = 0.85; x.beginPath(); x.moveTo(X, yy(hi)); x.lineTo(X, yy(lo)); x.stroke(); x.fillRect(X - w * 0.3, yy(Math.max(o, c)), w * 0.6, Math.max(1, Math.abs(yy(o) - yy(c)))); }
    x.globalAlpha = 1; x.strokeStyle = "rgba(255,210,90,0.9)"; x.lineWidth = Math.max(1, m.u * 0.003); x.beginPath(); for (let k = 0; k < n; k++) { const i = base + k, X = m.W - k * w + off, v = (val(i) + val(i - 1) + val(i - 2)) / 3; const yy = bot - (bot - top) * v; if (k) x.lineTo(X, yy); else x.moveTo(X, yy); } x.stroke();
    x.fillStyle = "rgba(0,0,0,0.55)"; x.fillRect(0, Y - m.H * 0.07, m.W, m.H * 0.05);
    for (let i = 0; i < 14; i++) { const X = wrap(i * m.W * 0.11 - t * m.u * 0.08, m.W * 1.54) - m.W * 0.1; x.fillStyle = R("tk", i) > 0.5 ? m.p.up : m.p.down; x.fillRect(X, Y - m.H * 0.055, m.u * 0.06, m.H * 0.02); x.fillStyle = "rgba(255,255,255,0.5)"; x.fillRect(X + m.u * 0.07, Y - m.H * 0.052, m.u * 0.05, m.H * 0.014); }
    shine(m, Y, "#3a7bff", 0.12); } },
  { id: "st-ticker", en: "Finance ticker", ar: "شريط الأسهم", group: "backgrounds", dur: 10, fields: [C("up", "Up", "صعود", "#22d39a"), C("down", "Down", "هبوط", "#ff4d6d"), C("bg", "Background", "الخلفية", "#0a0f1c"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; x.fillStyle = lin(x, 0, 0, 0, m.H, [[0, m.p.bg], [1, "#02040a"]]); x.fillRect(0, 0, m.W, m.H);
    const rows = 9, rh = m.H / rows; x.textBaseline = "middle"; x.textAlign = "left";
    for (let r = 0; r < rows; r++) { const px = rh * 0.34, dir = r % 2 ? 1 : -1, sp = m.u * (0.03 + R("ts", r) * 0.04), a = r === 4 ? 0.95 : 0.2 + 0.25 * (1 - Math.abs(r - 4) / 4); x.font = `700 ${Math.round(px)}px ui-monospace,monospace`;
      const item = m.u * 0.34, n = Math.ceil(m.W / item) + 2, off = wrap(t * sp * dir, item);
      for (let k = -1; k < n; k++) { const i = k + Math.floor((t * sp * dir) / item) * -1, up = R("tu" + r, i) > 0.45, v = (R("tv" + r, i) * 4.9 + 0.1).toFixed(2), X = k * item + (dir > 0 ? off : -off);
        x.globalAlpha = a; x.fillStyle = "rgba(255,255,255,0.85)"; x.fillText(String(Math.round(100 + R("tp" + r, i) * 900)) + "." + String(Math.floor(R("tc" + r, i) * 90 + 10)), X, (r + 0.5) * rh);
        x.fillStyle = up ? m.p.up : m.p.down; x.fillText((up ? "▲ +" : "▼ −") + v + "%", X + item * 0.45, (r + 0.5) * rh); } }
    x.globalAlpha = 1; glow(x, m.W / 2, m.H / 2, m.u * 0.6, "rgba(40,110,255,0.15)"); } },
  { id: "st-glass", en: "Glass office", ar: "مكتب زجاجي", group: "backgrounds", dur: 10, fields: [C("sky", "Daylight", "ضوء النهار", "#9fc7ee"), C("frame", "Frames", "الإطارات", "#1f2630"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed, Y = m.H * 0.8; x.fillStyle = lin(x, 0, 0, 0, Y, [[0, m.p.sky], [1, "#e8eef4"]]); x.fillRect(0, 0, m.W, Y);
    for (let i = 0; i < 26; i++) { const X = wrap(R("bx", i) * m.W + t * m.u * 0.004 * (1 + R("bv", i)), m.W), YY = Y * (0.45 + R("by", i) * 0.5); glow(x, X, YY, m.u * (0.03 + R("br", i) * 0.06), R("bc", i) > 0.5 ? "rgba(255,255,255,0.7)" : "rgba(255,220,170,0.6)", 0.6); }
    for (let i = 0; i < 9; i++) { const X = m.W * (0.4 + i * 0.12) - m.W * 0.06 * Math.floor(i / 3); x.fillStyle = "rgba(60,80,110,0.18)"; x.fillRect(X - m.u * 0.07, Y * (0.35 + R("tw", i) * 0.25), m.u * 0.14, Y); }
    x.fillStyle = m.p.frame; const nf = 6; for (let i = 0; i <= nf; i++) x.fillRect((i / nf) * m.W - m.u * 0.01, 0, m.u * 0.02, Y); x.fillRect(0, Y * 0.18, m.W, m.u * 0.012);
    x.fillStyle = lin(x, 0, Y, 0, m.H, [[0, "#c9ced4"], [1, "#8d949c"]]); x.fillRect(0, Y, m.W, m.H - Y);
    x.globalAlpha = 0.25; x.fillStyle = lin(x, 0, 0, m.W, 0, [[0, "rgba(255,255,255,0)"], [wrap(0.3 + t * 0.02, 1), "rgba(255,255,255,0.6)"], [1, "rgba(255,255,255,0)"]]); x.fillRect(0, 0, m.W, Y); x.globalAlpha = 1; } },
  { id: "st-news", en: "News studio", ar: "استوديو الأخبار", group: "backgrounds", dur: 10, fields: [C("c1", "Accent", "اللون المميز", "#e53935"), C("wall", "Wall", "الجدار", "#0b1a3a"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed, Y = room(m, [m.p.wall, "#050c1d"], ["#101826", "#05080e"], 0.78);
    const cols = 4, rows = 3, gw = m.W * 0.7, gh = Y * 0.62, gx = (m.W - gw) / 2, gy = Y * 0.12;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const X = gx + (c * gw) / cols, YY = gy + (r * gh) / rows, w = gw / cols - m.u * 0.008, h = gh / rows - m.u * 0.008;
      x.fillStyle = lin(x, X, YY, X + w, YY + h, [[0, "#12306a"], [1, "#0a1838"]]); x.fillRect(X, YY, w, h);
      const k = 0.5 + 0.5 * Math.sin(t * 0.6 + r * 1.3 + c * 0.9); x.fillStyle = `rgba(120,180,255,${0.05 + 0.12 * k})`; x.fillRect(X, YY, w, h);
      for (let l = 0; l < 3; l++) { x.fillStyle = "rgba(170,210,255,0.18)"; x.fillRect(X + w * 0.1, YY + h * (0.3 + l * 0.2), w * (0.3 + 0.5 * R("nl", r * 13 + c * 3 + l)), Math.max(1, h * 0.05)); } }
    const sweep = wrap(t * 0.12, 1.4) - 0.2; x.globalCompositeOperation = "lighter"; x.fillStyle = lin(x, gx + gw * (sweep - 0.1), 0, gx + gw * (sweep + 0.1), 0, [[0, "rgba(255,255,255,0)"], [0.5, "rgba(160,200,255,0.25)"], [1, "rgba(255,255,255,0)"]]); x.fillRect(gx, gy, gw, gh); x.globalCompositeOperation = "source-over";
    x.fillStyle = m.p.c1; x.fillRect(0, Y - m.H * 0.11, m.W, m.H * 0.012); x.fillStyle = rgba(m.p.c1, 0.35); x.fillRect(0, Y - m.H * 0.098, m.W, m.H * 0.004); shine(m, Y, "#4a8bff", 0.14); } },
  { id: "st-garden", en: "Garden wall", ar: "جدار حديقة", group: "backgrounds", dur: 10, fields: [C("leaf", "Leaves", "الأوراق", "#2f7a3e"), C("sun", "Sun", "الشمس", "#fff1b8"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed, Y = room(m, ["#163b21", "#0c2414"], ["#6b5a46", "#3b3126"], 0.78);
    for (let i = 0; i < 520; i++) { const X = R("lx", i) * m.W, YY = R("ly", i) * Y, s = m.u * (0.02 + R("ls", i) * 0.035), a = R("la", i) * Math.PI * 2 + Math.sin(t * 0.7 + i) * 0.08;
      x.fillStyle = M.interpolateColors(R("lc", i), [0, 1], [m.p.leaf, "#9ccf6a"]); x.globalAlpha = 0.75; x.beginPath(); x.ellipse(X, YY, s, s * 0.45, a, 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1; x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 12; i++) glow(x, wrap(R("sx", i) * m.W + Math.sin(t * 0.15 + i) * m.W * 0.04, m.W), R("sy", i) * Y, m.u * (0.05 + R("sr", i) * 0.08), rgba(m.p.sun, 1), 0.18 + 0.12 * Math.sin(t * 0.4 + i * 2) ** 2);
    x.globalCompositeOperation = "source-over"; x.fillStyle = "rgba(0,0,0,0.25)"; x.fillRect(0, Y - m.u * 0.03, m.W, m.u * 0.03); } },
];
