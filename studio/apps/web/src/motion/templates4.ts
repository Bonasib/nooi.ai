// nooi Motion, moving backgrounds (v234): whole-frame scenes that keep moving for as long as the clip lasts (no start or end), to
// put behind a cut-out person or a keyed green screen — aurora, bokeh, clouds, sea, a studio light, stars, a neon grid, rain, snow,
// a sunset, particles, waves, embers, under water, a city at night, forest light. Drawn frame by frame from their props (the same
// frame always draws the same picture), light enough to play smoothly. Our own designs.
import { Motion as M } from "@nooi/editor-core";
import { T, type MCtx, type Template } from "./kit";
import { STUDIO_SETS } from "./templates5";

const SPD = T("speed", "number", "Speed", "السرعة", 1, { min: 0, max: 3, step: 0.1 });
const C = (k: string, en: string, ar: string, def: string) => T(k, "color", en, ar, def);
const R = (s: string, i: number) => M.random(s + ":" + i);
const fill = (x: CanvasRenderingContext2D, W: number, H: number, stops: [number, string][], vertical = true) => {
  const g = vertical ? x.createLinearGradient(0, 0, 0, H) : x.createLinearGradient(0, 0, W, 0); for (const [o, c] of stops) g.addColorStop(o, c); x.fillStyle = g; x.fillRect(0, 0, W, H); };
const glow = (x: CanvasRenderingContext2D, X: number, Y: number, r: number, c: string, a = 1) => {
  const g = x.createRadialGradient(X, Y, 0, X, Y, Math.max(1, r)); g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)"); x.globalAlpha = a; x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2); x.globalAlpha = 1; };
const rgba = (hex: string, a: number) => { const [r, g, b] = M.parseColor(hex); return `rgba(${r},${g},${b},${a})`; };
const wrap = (v: number, n: number) => ((v % n) + n) % n;
const stars = (m: MCtx, n: number, seed: string, top = 1) => { const x = m.ctx; x.fillStyle = "#fff";
  for (let i = 0; i < n; i++) { const tw = 0.5 + 0.5 * Math.sin(m.t * (1 + R(seed + "w", i) * 3) + R(seed + "p", i) * 6); x.globalAlpha = 0.25 + 0.75 * tw * R(seed + "a", i);
    const s = m.u * (0.0015 + R(seed + "s", i) * 0.003); x.fillRect(R(seed + "x", i) * m.W, R(seed + "y", i) * m.H * top, s, s); } x.globalAlpha = 1; };

const SCENES: Template[] = [
  { id: "mb-aurora", en: "Aurora", ar: "الشفق القطبي", group: "backgrounds", dur: 10, fields: [C("c1", "Colour 1", "اللون 1", "#2dffb0"), C("c2", "Colour 2", "اللون 2", "#7b61ff"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, "#02040c"], [0.7, "#071428"], [1, "#0b1d2e"]]); stars(m, 120, "au", 0.7);
    x.globalCompositeOperation = "lighter";
    for (let b = 0; b < 3; b++) { const col = b === 1 ? m.p.c2 : m.p.c1, base = m.H * (0.28 + b * 0.1);
      for (let i = 0; i <= 60; i++) { const X = (i / 60) * m.W, n = M.noise2("au" + b, i * 0.08 + t * 0.12, t * 0.05 + b), Y = base + Math.sin(i * 0.22 + t * 0.5 + b) * m.H * 0.05 + n * m.H * 0.12;
        const h = m.H * (0.18 + 0.12 * M.noise2("ah" + b, i * 0.1, t * 0.1)); const g = x.createLinearGradient(0, Y - h, 0, Y + h * 0.2);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.7, rgba(col, 0.22)); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(X, Y - h, m.W / 60 + 1, h * 1.2); } }
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "#03060c"; x.beginPath(); x.moveTo(0, m.H); for (let i = 0; i <= 40; i++) x.lineTo((i / 40) * m.W, m.H * (0.86 - 0.08 * M.noise2("ridge", i * 0.15, 0))); x.lineTo(m.W, m.H); x.fill(); } },
  { id: "mb-bokeh", en: "Bokeh lights", ar: "أضواء ضبابية", group: "backgrounds", dur: 10, fields: [C("c1", "Colour 1", "اللون 1", "#ffb34d"), C("c2", "Colour 2", "اللون 2", "#ff4f8b"), C("bg", "Background", "الخلفية", "#120a1c"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, m.p.bg], [1, "#000"]]); x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 46; i++) { const r = m.u * (0.03 + R("bk", i) * 0.09), sp = 0.02 + R("bv", i) * 0.05, Y = wrap(R("by", i) - t * sp, 1.3) * m.H * 1.0 - r, X = R("bx", i) * m.W + Math.sin(t * 0.3 + i) * m.u * 0.03;
      glow(x, X, m.H * 1.15 - Y, r, R("bc", i) > 0.5 ? m.p.c1 : m.p.c2, 0.35 + 0.35 * Math.sin(t * 0.7 + i * 1.7) ** 2); }
    x.globalCompositeOperation = "source-over"; } },
  { id: "mb-clouds", en: "Drifting clouds", ar: "غيوم متحركة", group: "backgrounds", dur: 10, fields: [C("sky", "Sky", "السماء", "#4aa3ff"), C("low", "Horizon", "الأفق", "#cfeaff"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, m.p.sky], [1, m.p.low]]); glow(x, m.W * 0.82, m.H * 0.18, m.u * 0.35, "rgba(255,250,220,0.8)");
    for (let i = 0; i < 9; i++) { const depth = 0.4 + R("cd", i) * 0.6, w = m.W * (0.25 + 0.25 * depth), X = wrap(R("cx", i) * (m.W + w) + t * m.W * 0.012 * depth, m.W + w) - w, Y = m.H * (0.12 + R("cy", i) * 0.5);
      x.globalAlpha = 0.55 + 0.35 * depth; x.fillStyle = "#fff";
      for (let k = 0; k < 6; k++) { const cx = X + (k / 5) * w, cy = Y + Math.sin(k * 1.7 + i) * w * 0.05, r = w * (0.12 + 0.1 * Math.sin(k * 2.3 + i * 0.7) ** 2); x.beginPath(); x.ellipse(cx, cy, r * 1.3, r, 0, 0, Math.PI * 2); x.fill(); } }
    x.globalAlpha = 1; } },
  { id: "mb-ocean", en: "Ocean waves", ar: "أمواج المحيط", group: "backgrounds", dur: 10, fields: [C("sea", "Sea", "البحر", "#0a6fa8"), C("sky", "Sky", "السماء", "#8fd3ff"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed, hz = m.H * 0.45; fill(x, m.W, hz, [[0, m.p.sky], [1, "#e9f7ff"]]); glow(x, m.W * 0.5, hz, m.u * 0.25, "rgba(255,245,210,0.9)");
    for (let l = 0; l < 7; l++) { const k = l / 6, Y = hz + (m.H - hz) * Math.pow(k, 1.6), amp = m.u * (0.004 + 0.02 * k), col = M.interpolateColors(k, [0, 1], [m.p.sea, "#023a5c"]);
      x.fillStyle = col; x.beginPath(); x.moveTo(0, m.H); for (let i = 0; i <= 48; i++) { const X = (i / 48) * m.W; x.lineTo(X, Y + Math.sin(i * (0.5 - k * 0.3) + t * (1 + k) + l) * amp); } x.lineTo(m.W, m.H); x.fill();
      x.fillStyle = "rgba(255,255,255,0.25)"; for (let i = 0; i < 10; i++) { const gx = wrap(R("gl" + l, i) * m.W + t * m.u * 0.02 * (1 + k), m.W); x.fillRect(gx, Y + Math.sin(t + i) * amp, m.u * 0.02 * (0.5 + k), Math.max(1, m.u * 0.002)); } } } },
  { id: "mb-studio", en: "Studio light", ar: "إضاءة استوديو", group: "backgrounds", dur: 10, fields: [C("bg", "Backdrop", "الخلفية", "#2b2f3a"), C("light", "Light", "الضوء", "#9fb7ff"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, m.p.bg], [1, "#0d0f14"]]);
    glow(x, m.W * (0.5 + 0.18 * Math.sin(t * 0.25)), m.H * (0.42 + 0.06 * Math.cos(t * 0.2)), m.u * 0.75, rgba(m.p.light, 0.55));
    glow(x, m.W * (0.2 + 0.05 * Math.sin(t * 0.4)), m.H * 0.2, m.u * 0.35, "rgba(255,255,255,0.12)");
    const g = x.createRadialGradient(m.W / 2, m.H / 2, m.u * 0.3, m.W / 2, m.H / 2, Math.max(m.W, m.H) * 0.75); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.55)"); x.fillStyle = g; x.fillRect(0, 0, m.W, m.H); } },
  { id: "mb-space", en: "Starfield", ar: "حقل النجوم", group: "backgrounds", dur: 10, fields: [C("neb", "Nebula", "السديم", "#7b61ff"), C("neb2", "Second colour", "اللون الثاني", "#ff3d9a"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; x.fillStyle = "#03030a"; x.fillRect(0, 0, m.W, m.H); x.globalCompositeOperation = "lighter";
    glow(x, m.W * (0.35 + 0.05 * Math.sin(t * 0.1)), m.H * 0.45, m.u * 0.7, rgba(m.p.neb, 0.35)); glow(x, m.W * 0.7, m.H * (0.6 + 0.05 * Math.cos(t * 0.12)), m.u * 0.55, rgba(m.p.neb2, 0.25));
    const cx = m.W / 2, cy = m.H / 2; x.fillStyle = "#fff";
    for (let i = 0; i < 260; i++) { const a = R("sa", i) * Math.PI * 2, z = wrap(R("sz", i) + t * 0.06, 1), d = Math.pow(z, 2.2) * Math.max(m.W, m.H) * 0.75, s = m.u * 0.004 * z + 0.5;
      x.globalAlpha = Math.min(1, z * 1.6); x.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s); }
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; } },
  { id: "mb-grid", en: "Neon grid", ar: "شبكة نيون", group: "backgrounds", dur: 10, fields: [C("c1", "Grid", "الشبكة", "#ff2bd6"), C("sun", "Sun", "الشمس", "#ffb800"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed, hz = m.H * 0.55; fill(x, m.W, hz, [[0, "#12002a"], [1, "#5a0b5e"]]); x.fillStyle = "#0c0018"; x.fillRect(0, hz, m.W, m.H - hz);
    const sr = m.u * 0.22, g = x.createLinearGradient(0, hz - sr * 2, 0, hz); g.addColorStop(0, m.p.sun); g.addColorStop(1, "#ff2b6a"); x.fillStyle = g; x.beginPath(); x.arc(m.W / 2, hz, sr, Math.PI, 0); x.fill();
    x.fillStyle = "#12002a"; for (let i = 0; i < 6; i++) x.fillRect(m.W / 2 - sr, hz - sr * (0.08 + i * 0.13), sr * 2, Math.max(1, sr * 0.02 * (i + 1)));
    x.strokeStyle = m.p.c1; x.lineWidth = Math.max(1, m.u * 0.003); x.shadowColor = m.p.c1; x.shadowBlur = m.u * 0.02;
    for (let i = -12; i <= 12; i++) { x.beginPath(); x.moveTo(m.W / 2 + i * m.W * 0.012, hz); x.lineTo(m.W / 2 + i * m.W * 0.16, m.H); x.stroke(); }
    for (let i = 0; i < 12; i++) { const z = wrap(i / 12 + t * 0.15, 1), Y = hz + (m.H - hz) * z * z; x.globalAlpha = z; x.beginPath(); x.moveTo(0, Y); x.lineTo(m.W, Y); x.stroke(); }
    x.globalAlpha = 1; x.shadowBlur = 0; } },
  { id: "mb-rain", en: "Rainy window", ar: "نافذة ممطرة", group: "backgrounds", dur: 10, fields: [C("c1", "City lights", "أضواء المدينة", "#ffcf70"), C("bg", "Night", "الليل", "#0b1626"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, m.p.bg], [1, "#05080f"]]); x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 30; i++) glow(x, R("rx", i) * m.W, m.H * (0.45 + R("ry", i) * 0.5), m.u * (0.03 + R("rr", i) * 0.06), R("rc", i) > 0.6 ? "#ff5a5a" : m.p.c1, 0.25 + 0.2 * Math.sin(t * 0.5 + i) ** 2);
    x.globalCompositeOperation = "source-over"; x.strokeStyle = "rgba(200,220,255,0.35)"; x.lineWidth = Math.max(1, m.u * 0.0015);
    for (let i = 0; i < 140; i++) { const X = R("dx", i) * m.W, L = m.u * (0.02 + R("dl", i) * 0.04), Y = wrap(R("dy", i) * m.H + t * m.H * (0.8 + R("dv", i)), m.H + L) - L; x.beginPath(); x.moveTo(X, Y); x.lineTo(X - L * 0.15, Y + L); x.stroke(); }
    for (let i = 0; i < 40; i++) { const X = R("wx", i) * m.W, Y = wrap(R("wy", i) * m.H + t * m.u * 0.01 * (R("wv", i) > 0.7 ? 6 : 0.3), m.H), r = m.u * (0.004 + R("wr", i) * 0.008);
      x.fillStyle = "rgba(220,235,255,0.25)"; x.beginPath(); x.ellipse(X, Y, r * 0.8, r, 0, 0, Math.PI * 2); x.fill(); } } },
  { id: "mb-snow", en: "Snowy night", ar: "ليلة مثلجة", group: "backgrounds", dur: 10, fields: [C("bg", "Sky", "السماء", "#1b2a4a"), C("hill", "Hills", "التلال", "#e8f0fb"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, "#0a1020"], [1, m.p.bg]]); glow(x, m.W * 0.78, m.H * 0.2, m.u * 0.12, "rgba(255,255,240,0.9)");
    for (let l = 0; l < 2; l++) { x.fillStyle = l ? m.p.hill : M.interpolateColors(0.5, [0, 1], [m.p.hill, m.p.bg]); x.beginPath(); x.moveTo(0, m.H);
      for (let i = 0; i <= 30; i++) x.lineTo((i / 30) * m.W, m.H * (0.72 + l * 0.08 - 0.06 * M.noise2("hill" + l, i * 0.2, 0))); x.lineTo(m.W, m.H); x.fill(); }
    x.fillStyle = "#fff"; for (let i = 0; i < 180; i++) { const d = 0.3 + R("fd", i) * 0.7, Y = wrap(R("fy", i) * m.H + t * m.H * 0.08 * d, m.H), X = wrap(R("fx", i) * m.W + Math.sin(t * 0.8 + i) * m.u * 0.02 * d, m.W);
      x.globalAlpha = 0.4 + 0.6 * d; x.beginPath(); x.arc(X, Y, m.u * 0.004 * d + 0.5, 0, Math.PI * 2); x.fill(); } x.globalAlpha = 1; } },
  { id: "mb-sunset", en: "Sunset", ar: "غروب", group: "backgrounds", dur: 10, fields: [C("top", "Sky", "السماء", "#3b1f6e"), C("mid", "Glow", "الوهج", "#ff7a45"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, m.p.top], [0.6, m.p.mid], [1, "#ffd27a"]]); const sy = m.H * (0.62 + 0.02 * Math.sin(t * 0.1));
    glow(x, m.W * 0.5, sy, m.u * 0.6, "rgba(255,220,150,0.6)"); x.fillStyle = "#fff1c4"; x.beginPath(); x.arc(m.W * 0.5, sy, m.u * 0.08, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 6; i++) { const w = m.W * 0.35, X = wrap(R("sx", i) * m.W + t * m.u * 0.01 * (1 + i % 3), m.W + w) - w, Y = m.H * (0.2 + R("sy", i) * 0.35); x.fillStyle = "rgba(255,190,160,0.25)"; x.beginPath(); x.ellipse(X, Y, w / 2, m.u * 0.015, 0, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = "#2a1236"; x.beginPath(); x.moveTo(0, m.H); for (let i = 0; i <= 30; i++) x.lineTo((i / 30) * m.W, m.H * (0.78 - 0.07 * M.noise2("sun", i * 0.25, 0))); x.lineTo(m.W, m.H); x.fill(); } },
  { id: "mb-plexus", en: "Floating particles", ar: "جزيئات عائمة", group: "backgrounds", dur: 10, fields: [C("c1", "Dots", "النقاط", "#00F0FF"), C("bg", "Background", "الخلفية", "#06121f"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, m.p.bg], [1, "#000"]]); const pts: [number, number][] = [];
    for (let i = 0; i < 60; i++) pts.push([wrap(R("px", i) * m.W + Math.sin(t * 0.2 * (0.5 + R("pv", i)) + i) * m.W * 0.08, m.W), wrap(R("py", i) * m.H + Math.cos(t * 0.17 * (0.5 + R("pw", i)) + i) * m.H * 0.08, m.H)]);
    const D = m.u * 0.18; x.strokeStyle = m.p.c1; x.lineWidth = Math.max(1, m.u * 0.0012);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < D) { x.globalAlpha = (1 - d / D) * 0.5; x.beginPath(); x.moveTo(pts[i][0], pts[i][1]); x.lineTo(pts[j][0], pts[j][1]); x.stroke(); } }
    x.globalAlpha = 1; x.fillStyle = m.p.c1; for (const [X, Y] of pts) { x.beginPath(); x.arc(X, Y, m.u * 0.004, 0, Math.PI * 2); x.fill(); } } },
  { id: "mb-waves", en: "Flowing waves", ar: "موجات منسابة", group: "backgrounds", dur: 10, fields: [C("c1", "Colour 1", "اللون 1", "#00F0FF"), C("c2", "Colour 2", "اللون 2", "#7B61FF"), C("bg", "Background", "الخلفية", "#0b0d18"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; x.fillStyle = m.p.bg; x.fillRect(0, 0, m.W, m.H);
    for (let l = 0; l < 6; l++) { const k = l / 5, col = M.interpolateColors(k, [0, 1], [m.p.c1, m.p.c2]), base = m.H * (0.35 + k * 0.45), amp = m.H * 0.08;
      x.globalAlpha = 0.35 + 0.1 * l; x.fillStyle = col; x.beginPath(); x.moveTo(0, m.H);
      for (let i = 0; i <= 60; i++) { const X = (i / 60) * m.W; x.lineTo(X, base + Math.sin(i * 0.12 + t * (0.6 + k * 0.4) + l * 1.3) * amp + M.noise2("wv" + l, i * 0.05, t * 0.1) * amp); }
      x.lineTo(m.W, m.H); x.fill(); } x.globalAlpha = 1; } },
  { id: "mb-embers", en: "Warm embers", ar: "جمرات دافئة", group: "backgrounds", dur: 10, fields: [C("c1", "Glow", "الوهج", "#ff6a00"), C("bg", "Background", "الخلفية", "#1a0702"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, "#000"], [1, m.p.bg]]);
    glow(x, m.W / 2, m.H * 1.05, m.u * (0.8 + 0.05 * Math.sin(t * 6) * M.noise2("fl", t * 2, 0)), rgba(m.p.c1, 0.55)); x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 80; i++) { const life = wrap(R("el", i) + t * (0.08 + R("ev", i) * 0.1), 1), X = R("ex", i) * m.W + Math.sin(t * 2 + i) * m.u * 0.02 * life, Y = m.H * (1 - life * 1.1);
      glow(x, X, Y, m.u * (0.006 + 0.01 * R("er", i)), "rgba(255,180,80,1)", (1 - life) * 0.9); }
    x.globalCompositeOperation = "source-over"; } },
  { id: "mb-water", en: "Under water", ar: "تحت الماء", group: "backgrounds", dur: 10, fields: [C("c1", "Water", "الماء", "#0a8fb5"), C("deep", "Deep", "العمق", "#032238"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, m.p.c1], [1, m.p.deep]]); x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) { const X = m.W * (0.1 + i * 0.14) + Math.sin(t * 0.3 + i) * m.W * 0.03, w = m.W * 0.05; const g = x.createLinearGradient(0, 0, 0, m.H * 0.8); g.addColorStop(0, "rgba(200,255,255,0.18)"); g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g; x.beginPath(); x.moveTo(X - w, 0); x.lineTo(X + w, 0); x.lineTo(X + w * 3, m.H * 0.8); x.lineTo(X + w * 1.5, m.H * 0.8); x.fill(); }
    x.strokeStyle = "rgba(210,255,255,0.12)"; x.lineWidth = Math.max(1, m.u * 0.002);
    for (let r = 0; r < 10; r++) { x.beginPath(); for (let i = 0; i <= 40; i++) { const X = (i / 40) * m.W, Y = m.H * (0.04 + r * 0.025) + M.noise2("cau" + r, i * 0.15, t * 0.3) * m.H * 0.04; if (i) x.lineTo(X, Y); else x.moveTo(X, Y); } x.stroke(); }
    x.globalCompositeOperation = "source-over"; x.strokeStyle = "rgba(220,250,255,0.6)";
    for (let i = 0; i < 40; i++) { const r = m.u * (0.004 + R("br", i) * 0.01), Y = m.H - wrap(R("by", i) * m.H + t * m.H * 0.1 * (0.5 + R("bv", i)), m.H + r * 2), X = R("bx", i) * m.W + Math.sin(t * 2 + i) * m.u * 0.01;
      x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.stroke(); } } },
  { id: "mb-city", en: "City at night", ar: "مدينة ليلاً", group: "backgrounds", dur: 10, fields: [C("c1", "Windows", "النوافذ", "#ffd76a"), C("sky", "Sky", "السماء", "#0b1030"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, m.p.sky], [1, "#1c1440"]]); stars(m, 60, "ct", 0.4);
    for (let l = 0; l < 2; l++) { let X = -m.W * 0.02 * l; let i = 0; while (X < m.W) { const w = m.W * (0.05 + R("bw" + l, i) * 0.07), h = m.H * (0.25 + R("bh" + l, i) * 0.4) * (l ? 0.8 : 1), Y = m.H * 0.86 - h;
        x.fillStyle = l ? "#0e1230" : "#161b46"; x.fillRect(X, Y, w, h + m.H);
        if (!l) for (let r = 0; r < Math.floor(h / (m.u * 0.035)); r++) for (let c = 0; c < Math.floor(w / (m.u * 0.03)); c++) { const on = M.random("win" + i + ":" + r + ":" + c + ":" + Math.floor(t * 0.3 + R("wt", i * 7 + r) * 5)) > 0.45;
          if (on) { x.fillStyle = m.p.c1; x.globalAlpha = 0.75; x.fillRect(X + m.u * 0.008 + c * m.u * 0.03, Y + m.u * 0.012 + r * m.u * 0.035, m.u * 0.014, m.u * 0.018); x.globalAlpha = 1; } }
        X += w + m.u * 0.01; i++; } }
    x.fillStyle = "#07081a"; x.fillRect(0, m.H * 0.86, m.W, m.H * 0.14);
    for (let i = 0; i < 14; i++) { const dir = i % 2 ? 1 : -1, X = wrap(R("cx", i) * m.W + dir * t * m.W * 0.12 * (0.6 + R("cv", i)), m.W * 1.2) - m.W * 0.1, Y = m.H * (0.9 + (i % 2) * 0.04);
      const g = x.createLinearGradient(X - dir * m.W * 0.08, 0, X, 0); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, dir > 0 ? "rgba(255,240,200,0.9)" : "rgba(255,60,60,0.9)"); x.fillStyle = g; x.fillRect(Math.min(X, X - dir * m.W * 0.08), Y, m.W * 0.08, Math.max(1, m.u * 0.004)); } } },
  { id: "mb-forest", en: "Forest light", ar: "ضوء الغابة", group: "backgrounds", dur: 10, fields: [C("c1", "Leaves", "الأوراق", "#2f6b3a"), C("light", "Sun", "الشمس", "#fff2b0"), SPD], draw(m) {
    const x = m.ctx, t = m.t * m.p.speed; fill(x, m.W, m.H, [[0, "#cfe8b8"], [0.5, m.p.c1], [1, "#0f2a14"]]);
    for (let l = 0; l < 3; l++) { x.fillStyle = M.interpolateColors(l / 2, [0, 1], ["#5c8a57", "#0c2410"]);
      for (let i = 0; i < 9; i++) { const X = (i / 8) * m.W + (R("tx" + l, i) - 0.5) * m.W * 0.1, w = m.W * (0.012 + l * 0.01); x.fillRect(X - w / 2, 0, w, m.H); x.beginPath(); x.ellipse(X, m.H * (0.1 + l * 0.05), m.W * 0.08, m.H * 0.16, 0, 0, Math.PI * 2); x.fill(); } }
    x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) { const X = m.W * (0.15 + i * 0.18) + Math.sin(t * 0.2 + i) * m.W * 0.03, a = 0.1 + 0.07 * Math.sin(t * 0.5 + i * 2) ** 2, g = x.createLinearGradient(0, 0, 0, m.H);
      g.addColorStop(0, rgba(m.p.light, a * 2)); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.beginPath(); x.moveTo(X, 0); x.lineTo(X + m.W * 0.04, 0); x.lineTo(X + m.W * 0.22, m.H); x.lineTo(X + m.W * 0.1, m.H); x.fill(); }
    for (let i = 0; i < 50; i++) { const X = wrap(R("dx", i) * m.W + Math.sin(t * 0.4 + i) * m.u * 0.04 + t * m.u * 0.01, m.W), Y = wrap(R("dy", i) * m.H - t * m.u * 0.008, m.H); glow(x, X, Y, m.u * 0.006, "rgba(255,250,200,1)", 0.5 * Math.sin(t + i) ** 2); }
    x.globalCompositeOperation = "source-over"; } },
];
// (v235) and the studio sets: empty, formal backgrounds for a presenter
export const BACKGROUNDS: Template[] = [...SCENES, ...STUDIO_SETS];
