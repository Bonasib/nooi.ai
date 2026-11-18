// nooi Motion templates, seventh set (v244):
//  · 3D (8): an extruded title, a spinning coin logo, a product box, a phone mockup, flying particles, a camera fly-through, a 3D bar
//    chart and a globe with routes — drawn by a small 3D renderer of our own on the same 2D canvas (perspective, flat shading, back
//    faces hidden, far faces first), so the preview, the tile's example and the export are the same picture, with no WebGL needed.
//  · Hand-drawn (7): cut paper, crosshatch ink, a risograph print, a sketchbook, a math explainer, isometric line art and pixel art —
//    looks known from print and animation, drawn here in our own code; they move "on twos" (12 drawings a second) like hand animation,
//    and the lines boil (redrawn a little differently each drawing), all from fixed seeds so a frame always draws the same.
//  · Emoji pop and Text punch (the two flat graphics we didn't have yet).
// Every word is a field (any language — Arabic right to left).
import { AR, BG, FAM, T, cl, ease, labels, measure, nums, outK, rrect, sp, text, type MCtx, type Template } from "./kit";

// ---- small tools
const rnd = (i: number, s = 1) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const items = (s: string) => String(s || "").split(/\s*[|\n]\s*/).map((v) => v.trim()).filter(Boolean);
const rgb = (hex: string): [number, number, number] => { const h = String(hex || "#888").replace("#", ""); const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0"); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0) as [number, number, number]; };
const tone = (hex: string, k: number, a = 1) => { const [r, g, b] = rgb(hex); const f = (v: number) => Math.round(cl(k <= 1 ? v * k : v + (255 - v) * (k - 1), 0, 255)); return `rgba(${f(r)},${f(g)},${f(b)},${a})`; };
const hexOf = (hex: string, k: number) => { const [r, g, b] = rgb(hex); const f = (v: number) => Math.round(cl(k <= 1 ? v * k : v + (255 - v) * (k - 1), 0, 255)).toString(16).padStart(2, "0"); return "#" + f(r) + f(g) + f(b); };
const canvasOf = (w: number, h: number) => (typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h })) as OffscreenCanvas;
const TEX = new Map<string, OffscreenCanvas>();
function texture(key: string, w: number, h: number, paint: (x: OffscreenCanvasRenderingContext2D) => void) {
  let c = TEX.get(key); if (c) return c; c = canvasOf(w, h); paint(c.getContext("2d")! as OffscreenCanvasRenderingContext2D);
  if (TEX.size > 40) TEX.delete(TEX.keys().next().value as string); TEX.set(key, c); return c;
}
function label(x: OffscreenCanvasRenderingContext2D, s: string, X: number, Y: number, px: number, color: string, weight = 800, maxW = 1e9, align: CanvasTextAlign = "center") {
  x.font = `${weight} ${px}px ${FAM}`; const w = x.measureText(s).width; if (w > maxW) x.font = `${weight} ${(px * maxW) / w}px ${FAM}`;
  x.direction = AR.test(s) ? "rtl" : "ltr"; x.textAlign = align; x.textBaseline = "middle"; x.fillStyle = color; x.fillText(s, X, Y);
}

// ---- a small 3D renderer: points in units of the frame's shorter side, the camera looking down +z from -d
type V = [number, number, number];
const ry = (v: V, a: number): V => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const rx = (v: V, a: number): V => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const LIGHT = norm([-0.45, 0.65, -0.62]);
interface Cam { cx: number; cy: number; u: number; f: number; d: number }
const cam = (m: MCtx, f = 1.7, d = 2.4, cy = 0.5): Cam => ({ cx: m.W / 2, cy: m.H * cy, u: m.u, f, d });
const P = (c: Cam, v: V): [number, number, number] => { const k = c.f / Math.max(0.05, c.d + v[2]); return [c.cx + v[0] * k * c.u, c.cy - v[1] * k * c.u, k]; };
interface Face { pts: V[]; color: string; tex?: OffscreenCanvas; line?: string }
/** a box's six faces (centre c, sizes w × h × d), each corner list starting top-left as seen from outside */
function box(c: V, w: number, h: number, d: number, color: string): Face[] {
  const [x0, x1, y0, y1, z0, z1] = [c[0] - w / 2, c[0] + w / 2, c[1] - h / 2, c[1] + h / 2, c[2] - d / 2, c[2] + d / 2];
  return [
    { pts: [[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]], color },   // front (towards the camera)
    { pts: [[x1, y1, z1], [x0, y1, z1], [x0, y0, z1], [x1, y0, z1]], color },   // back
    { pts: [[x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [x0, y0, z1]], color },   // left
    { pts: [[x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [x1, y0, z0]], color },   // right
    { pts: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], color },   // top
    { pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], color },   // bottom
  ];
}
/** faces moved by `xf`, the ones facing away hidden, the far ones drawn first, each shaded by the light (a texture mapped on when given) */
function render(x: CanvasRenderingContext2D, c: Cam, faces: Face[], xf: (v: V) => V, amb = 0.38) {
  const list = faces.map((f) => { const w = f.pts.map(xf); const n = norm(cross(sub(w[1], w[0]), sub(w[3], w[0]))); return { f, w, n, z: w.reduce((s, v) => s + v[2], 0) / w.length }; })
    .filter((o) => dot(o.n, norm(add(o.w[0], [0, 0, c.d]))) < 0.02).sort((a, b) => b.z - a.z);
  for (const o of list) {
    const p = o.w.map((v) => P(c, v)); const k = amb + (1 - amb) * Math.max(0, dot(o.n, LIGHT));
    x.beginPath(); p.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.closePath(); x.fillStyle = tone(o.f.color, k); x.fill();
    if (o.f.tex && p.length === 4) {
      const t = o.f.tex, [a, b, , d] = p; x.save(); x.clip(); x.globalAlpha = cl(0.55 + 0.45 * k);
      x.setTransform((b[0] - a[0]) / t.width, (b[1] - a[1]) / t.width, (d[0] - a[0]) / t.height, (d[1] - a[1]) / t.height, a[0], a[1]); x.drawImage(t as unknown as CanvasImageSource, 0, 0); x.restore();
    }
    if (o.f.line) { x.strokeStyle = o.f.line; x.lineWidth = Math.max(1, c.u * 0.002); x.stroke(); }
  }
}
const shadow = (x: CanvasRenderingContext2D, X: number, Y: number, rx2: number, ry2: number, a = 0.35) => { const g = x.createRadialGradient(X, Y, 0, X, Y, rx2); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)"); x.save(); x.translate(X, Y); x.scale(1, ry2 / rx2); x.translate(-X, -Y); x.fillStyle = g; x.beginPath(); x.arc(X, Y, rx2, 0, 7); x.fill(); x.restore(); };
const A2 = (def = "#7B61FF") => T("accent2", "color", "Second colour", "اللون الثاني", def);

export const THREE_D: Template[] = [
  { id: "3d-title", en: "3D title", ar: "عنوان ثلاثي الأبعاد", group: "3d", dur: 5, fields: [T("text", "text", "Words", "الكلمات", ["NOOI 3D", "نوي ثلاثي"]), BG(), A2("#3b2a8f")], draw(m) {
    const x = m.ctx, u = m.u, s = String(m.p.text || ""), a = sp(m, 0, { damping: 11, stiffness: 90 }), k = 1 - outK(m), ang = (1 - a) * 0.95 + Math.sin(m.t * 1.3) * 0.32, tilt = 0.35 + Math.sin(m.t * 0.9) * 0.08;
    let px = u * 0.2; const w = measure(m, s, px, 900); if (w > m.W * 0.8) px *= (m.W * 0.8) / w;
    x.globalAlpha = k; shadow(x, m.W / 2, m.H * 0.5 + px * 0.95, measure(m, s, px, 900) * 0.55, px * 0.18, 0.45);
    const N = 22, dep = u * 0.0042 * a;
    for (let i = N; i >= 0; i--) {
      x.save(); x.translate(m.W / 2 + Math.sin(ang) * i * dep * 1.6, m.H / 2 + i * dep * tilt); x.scale(Math.max(0.2, Math.cos(ang)) * (0.6 + 0.4 * a), 0.6 + 0.4 * a);
      if (i) text(m, s, 0, 0, { px, weight: 900, align: "center", color: tone(m.p.accent2, 0.55 + 0.45 * (1 - i / N)) });
      else { const g = x.createLinearGradient(0, -px / 2, 0, px / 2); g.addColorStop(0, "#ffffff"); g.addColorStop(1, m.p.accent); font9(x, px); x.direction = AR.test(s) ? "rtl" : "ltr"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = g; x.fillText(s, 0, 0);
        x.globalAlpha = k * 0.5 * cl(Math.sin(m.t * 2 - 1.5) * 2); x.fillStyle = "rgba(255,255,255,.9)"; x.globalCompositeOperation = "source-atop"; x.fillRect(-m.W, -px, m.W * 2, px * 0.18); }
      x.restore();
    } } },
  { id: "3d-coin", en: "Spinning coin logo", ar: "شعار عملة دوّارة", group: "3d", dur: 5, fields: [T("mark", "text", "Mark", "الرمز", ["N", "ن"]), T("name", "text", "Name", "الاسم", ["nooi", "نوي"]), BG({ def: "#ffd23f" })], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), e = ease.easeOut(cl(m.t / 1.8)), ang = (1 - e) * Math.PI * 5 + Math.sin(m.t * 1.6) * 0.45, R = u * 0.21 * sp(m), cx = m.W / 2, cy = m.H * 0.45, c = Math.cos(ang), th = u * 0.035;
    x.globalAlpha = k; shadow(x, cx, cy + R * 1.25, R * 0.9, R * 0.16);
    const rx2 = Math.max(1, R * Math.abs(c)), dx = Math.sin(ang) * th;
    for (let i = 10; i >= 0; i--) { x.beginPath(); x.ellipse(cx + (dx * i) / 10, cy, rx2, R, 0, 0, 7); x.fillStyle = tone(m.p.accent, 0.5 + 0.02 * (10 - i)); x.fill(); }
    x.beginPath(); x.ellipse(cx, cy, rx2, R, 0, 0, 7); const g = x.createLinearGradient(cx - rx2, cy - R, cx + rx2, cy + R); g.addColorStop(0, tone(m.p.accent, 1.25)); g.addColorStop(0.5, m.p.accent); g.addColorStop(1, tone(m.p.accent, 0.7)); x.fillStyle = g; x.fill();
    x.beginPath(); x.ellipse(cx, cy, rx2 * 0.82, R * 0.82, 0, 0, 7); x.strokeStyle = tone(m.p.accent, 0.62); x.lineWidth = u * 0.01; x.stroke();
    x.save(); x.translate(cx, cy); x.scale(Math.max(0.01, Math.abs(c)), 1); text(m, c >= 0 ? String(m.p.mark) : String(m.p.name), 0, 0, { px: c >= 0 ? R * 0.95 : R * 0.42, weight: 900, color: tone(m.p.accent, 0.4), align: "center", maxW: R * 1.5 }); x.restore();
    const sh = cl((m.t - 1.4) / 0.25); x.globalAlpha = k * cl(Math.sin(sh * Math.PI)); x.save(); x.beginPath(); x.ellipse(cx, cy, rx2, R, 0, 0, 7); x.clip(); x.fillStyle = "rgba(255,255,255,.55)"; x.fillRect(cx - R * 2 + sh * R * 4, cy - R, R * 0.35, R * 2); x.restore();
    x.globalAlpha = k * cl((m.t - 1.2) / 0.5); text(m, String(m.p.name), cx, cy + R * 1.65, { px: u * 0.075, weight: 900, align: "center", maxW: m.W * 0.8 }); } },
  { id: "3d-box", en: "Product box", ar: "علبة منتج", group: "3d", dur: 6, fields: [T("name", "text", "Product", "المنتج", ["FRESH", "طازج"]), T("tag", "text", "Line", "السطر", ["New flavour", "نكهة جديدة"]), BG({ def: "#FF3D9A" }), A2("#ffd23f")], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), a = sp(m, 0, { damping: 12, stiffness: 100 }), c = cam(m, 1.8, 2.6, 0.48), rot = (1 - a) * 2.4 + m.t * 0.7, tilt = -0.32;
    const tex = texture("box|" + m.p.name + "|" + m.p.tag + "|" + m.p.accent + m.p.accent2, 256, 360, (t) => { const g = t.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, tone(m.p.accent, 1.15)); g.addColorStop(1, tone(m.p.accent, 0.75)); t.fillStyle = g; t.fillRect(0, 0, 256, 360);
      t.fillStyle = m.p.accent2; t.beginPath(); t.arc(128, 150, 70, 0, 7); t.fill(); t.fillStyle = "rgba(255,255,255,.18)"; t.fillRect(0, 260, 256, 34);
      label(t, String(m.p.name), 128, 150, 54, "#121212", 900, 210); label(t, String(m.p.tag), 128, 277, 24, "#fff", 700, 230); label(t, "★★★★★", 128, 326, 20, m.p.accent2); });
    const f = box([0, 0, 0], 0.5, 0.7, 0.3, m.p.accent); f[0].tex = tex; f[1].tex = tex; f[4].color = hexOf(m.p.accent, 1.2);
    x.globalAlpha = k; shadow(x, m.W / 2, m.H * 0.48 + u * 0.43, u * 0.32, u * 0.06);
    render(x, c, f, (v) => { const w = rx(ry(v, rot), tilt); return [w[0] * a, w[1] * a, w[2] * a]; });
    x.globalAlpha = k * cl((m.t - 1) / 0.5); text(m, String(m.p.tag), m.W / 2, m.H * 0.92, { px: u * 0.05, weight: 800, align: "center", maxW: m.W * 0.8 }); } },
  { id: "3d-phone", en: "Phone mockup", ar: "هاتف ثلاثي الأبعاد", group: "3d", dur: 6, fields: [T("title", "text", "On the screen", "على الشاشة", ["Your app", "تطبيقك"]), T("line", "text", "Line", "السطر", ["Download today", "حمّله اليوم"]), BG({ def: "#7B61FF" }), A2("#00F0FF")], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), a = sp(m, 0, { damping: 13, stiffness: 90 }), c = cam(m, 1.8, 2.3, 0.5), rot = (1 - a) * 1.4 + Math.sin(m.t * 0.8) * 0.45, tilt = -0.12 + Math.sin(m.t * 0.6) * 0.05;
    const scr = texture("ph|" + m.p.title + "|" + m.p.line + "|" + m.p.accent + m.p.accent2, 220, 440, (t) => { const g = t.createLinearGradient(0, 0, 220, 440); g.addColorStop(0, m.p.accent); g.addColorStop(1, m.p.accent2); t.fillStyle = g; t.fillRect(0, 0, 220, 440);
      t.fillStyle = "rgba(0,0,0,.35)"; t.fillRect(70, 14, 80, 14); t.fillStyle = "rgba(255,255,255,.92)"; for (let i = 0; i < 3; i++) { t.beginPath(); t.roundRect ? t.roundRect(18, 210 + i * 62, 184, 48, 12) : t.rect(18, 210 + i * 62, 184, 48); t.fill(); }
      label(t, String(m.p.title), 110, 110, 34, "#fff", 900, 190); label(t, String(m.p.line), 110, 150, 17, "rgba(255,255,255,.9)", 700, 190);
      for (let i = 0; i < 3; i++) { t.fillStyle = [m.p.accent, m.p.accent2, "#ffd23f"][i]; t.beginPath(); t.arc(44, 234 + i * 62, 13, 0, 7); t.fill(); t.fillStyle = "#c9ccd6"; t.fillRect(66, 226 + i * 62, 110, 8); t.fillRect(66, 240 + i * 62, 70, 6); } });
    const body = box([0, 0, 0], 0.44, 0.88, 0.05, "#1d2029"); const screen: Face = { pts: [[-0.2, 0.41, -0.026], [0.2, 0.41, -0.026], [0.2, -0.41, -0.026], [-0.2, -0.41, -0.026]], color: "#000000", tex: scr };
    x.globalAlpha = k; shadow(x, m.W / 2, m.H * 0.5 + u * 0.47, u * 0.28, u * 0.05);
    const xf = (v: V): V => { const w = rx(ry(v, rot), tilt); return [w[0] * a, w[1] * a, w[2] * a]; };
    render(x, c, [...body, screen], xf, 0.55); } },
  { id: "3d-particles", en: "Flying particles", ar: "جسيمات طائرة", group: "3d", dur: 6, fields: [T("title", "text", "Title", "العنوان", ["Into the future", "نحو المستقبل"]), BG(), A2("#FF3D9A")], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), c = cam(m, 1.4, 0.2), N = 260, depth = 6, speed = 1.6;
    x.globalAlpha = k; const bg = x.createRadialGradient(m.W / 2, m.H / 2, 0, m.W / 2, m.H / 2, u); bg.addColorStop(0, "#151a2e"); bg.addColorStop(1, "#05060b"); x.fillStyle = bg; x.fillRect(0, 0, m.W, m.H);
    const cols = [m.p.accent, m.p.accent2, "#ffffff"];
    for (let i = 0; i < N; i++) { const ang = rnd(i, 2) * Math.PI * 2, rad = 0.25 + rnd(i, 3) * 1.6, z = ((rnd(i, 4) * depth - m.t * speed) % depth + depth) % depth + 0.05;
      const p = P(c, [Math.cos(ang) * rad, Math.sin(ang) * rad * 0.7, z]); if (p[0] < -20 || p[0] > m.W + 20 || p[1] < -20 || p[1] > m.H + 20) continue;
      const r = Math.max(0.6, u * 0.006 * p[2]); x.globalAlpha = k * cl(1.2 - z / depth) * cl(z * 3); x.fillStyle = cols[i % 3]; x.beginPath(); x.arc(p[0], p[1], r, 0, 7); x.fill(); }
    const a = sp(m, 12, { damping: 12, stiffness: 110 }); x.globalAlpha = k * cl(a); x.save(); x.translate(m.W / 2, m.H / 2); x.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a); x.shadowColor = m.p.accent; x.shadowBlur = u * 0.04;
    text(m, String(m.p.title), 0, 0, { px: u * 0.1, weight: 900, align: "center", maxW: m.W * 0.84 }); x.restore(); } },
  { id: "3d-fly", en: "Camera fly-through", ar: "عبور الكاميرا", group: "3d", dur: 7, fields: [T("items", "list", "Panels (| between)", "اللوحات (| بينها)", ["Plan | Shoot | Edit | Share", "خطّط | صوّر | حرّر | انشر"]), BG(), A2("#7B61FF")], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), it = items(m.p.items).slice(0, 6), n = Math.max(1, it.length), gap = 2.2, camZ = ease.easeInOut(cl(m.t / (m.dur - 0.6))) * (n - 0.6) * gap, c = cam(m, 1.5, 0.6);
    x.globalAlpha = k; x.fillStyle = "#07080d"; x.fillRect(0, 0, m.W, m.H);
    x.strokeStyle = tone(m.p.accent, 1, 0.22); x.lineWidth = 1;
    for (let i = -6; i <= 6; i++) { const a2 = P(c, [i * 0.5, -0.55, 0.05]), b2 = P(c, [i * 0.5, -0.55, 30]); x.beginPath(); x.moveTo(a2[0], a2[1]); x.lineTo(b2[0], b2[1]); x.stroke(); }
    for (let j = 0; j < 30; j++) { const z = j - (camZ % 1); if (z < 0.05) continue; const a2 = P(c, [-3, -0.55, z]), b2 = P(c, [3, -0.55, z]); x.beginPath(); x.moveTo(a2[0], a2[1]); x.lineTo(b2[0], b2[1]); x.stroke(); }
    for (let i = n - 1; i >= 0; i--) { const z = i * gap + 1.4 - camZ; if (z < 0.08) continue; const side = i % 2 ? 0.42 : -0.42, w = 0.62, h = 0.36;
      const a2 = P(c, [side - w / 2, h / 2, z]), b2 = P(c, [side + w / 2, -h / 2, z]); const fade = cl((8 - z) / 3) * cl(z * 4);
      x.globalAlpha = k * fade; rrect(x, a2[0], a2[1], b2[0] - a2[0], b2[1] - a2[1], (b2[0] - a2[0]) * 0.06); const g = x.createLinearGradient(a2[0], a2[1], b2[0], b2[1]); g.addColorStop(0, i % 2 ? m.p.accent2 : m.p.accent); g.addColorStop(1, "#14161f"); x.fillStyle = g; x.fill();
      x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1.5; x.stroke();
      text(m, String(i + 1), a2[0] + (b2[0] - a2[0]) * 0.12, a2[1] + (b2[1] - a2[1]) * 0.24, { px: (b2[1] - a2[1]) * 0.22, weight: 900, color: "rgba(255,255,255,.7)", align: "center" });
      text(m, it[i], (a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2 + (b2[1] - a2[1]) * 0.08, { px: (b2[1] - a2[1]) * 0.3, weight: 900, align: "center", maxW: (b2[0] - a2[0]) * 0.86 }); } } },
  { id: "3d-chart", en: "3D bar chart", ar: "رسم أعمدة ثلاثي", group: "3d", dur: 6, fields: [T("title", "text", "Title", "العنوان", ["Sales 2026", "مبيعات 2026"]), T("values", "text", "Values", "القيم", ["40, 65, 30, 80, 55"]), T("labels", "text", "Labels", "التسميات", ["Q1, Q2, Q3, Q4, Q5", "ر1، ر2، ر3، ر4، ر5"]), BG(), A2("#7B61FF")], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), vs = nums(m.p.values).slice(0, 8), lb = labels(m.p.labels), n = Math.max(1, vs.length), mx = Math.max(1, ...vs), c = cam(m, 1.9, 2.6, 0.6), rot = -0.55 + Math.sin(m.t * 0.5) * 0.18 + (1 - sp(m, 0, { damping: 16, stiffness: 60 })) * 0.6, tilt = 0.42;
    const xf = (v: V): V => rx(ry(v, rot), tilt); const W0 = 1.3, bw = (W0 / n) * 0.6;
    x.globalAlpha = k; text(m, String(m.p.title), m.W / 2, m.H * 0.1, { px: u * 0.07, weight: 900, align: "center", maxW: m.W * 0.9 });
    const floor: Face = { pts: [[-W0 / 2 - 0.1, 0, 0.35], [W0 / 2 + 0.1, 0, 0.35], [W0 / 2 + 0.1, 0, -0.35], [-W0 / 2 - 0.1, 0, -0.35]], color: "#262a36" };
    render(x, c, [floor], xf, 0.7);
    const faces: Face[] = []; const tops: [V, string, string][] = [];
    vs.forEach((v, i) => { const g = sp(m, 8 + i * 6, { damping: 14, stiffness: 110 }), h = Math.max(0.005, (v / mx) * 0.75 * g), cx = -W0 / 2 + ((i + 0.5) / n) * W0;
      faces.push(...box([cx, h / 2, 0], bw, h, bw, i % 2 ? m.p.accent2 : m.p.accent)); tops.push([[cx, h + 0.06, 0], String(Math.round(v * cl(g))), lb[i] || ""]); });
    render(x, c, faces, xf);
    tops.forEach(([v, val, l], i) => { const p = P(c, xf(v)), q = P(c, xf([v[0], -0.08, -0.3])); x.globalAlpha = k * cl(sp(m, 8 + i * 6)); text(m, val, p[0], p[1], { px: u * 0.04, weight: 900, align: "center" }); text(m, l, q[0], q[1], { px: u * 0.032, weight: 700, align: "center", color: "rgba(255,255,255,.75)" }); }); } },
  { id: "3d-globe", en: "Globe with routes", ar: "كرة أرضية ومسارات", group: "3d", dur: 7, fields: [T("title", "text", "Title", "العنوان", ["Shipping worldwide", "نشحن لكل العالم"]), BG(), A2("#ffd23f")], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), R = 0.42 * sp(m, 0, { damping: 14, stiffness: 90 }), c = cam(m, 2.2, 2.6, 0.46), rot = m.t * 0.45 + 0.6, tilt = 0.32;
    const on = (lat: number, lon: number, r = R): V => { const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180; return rx(ry([Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.cos(lo) * r], rot), tilt); };
    const ctr = P(c, [0, 0, 0]); x.globalAlpha = k;
    const g = x.createRadialGradient(ctr[0] - R * u * 0.3, ctr[1] - R * u * 0.4, 0, ctr[0], ctr[1], R * u * ctr[2] * 1.05); g.addColorStop(0, tone(m.p.accent, 0.5)); g.addColorStop(1, "#070b16"); x.fillStyle = g; x.beginPath(); x.arc(ctr[0], ctr[1], R * u * ctr[2], 0, 7); x.fill();
    x.lineWidth = Math.max(1, u * 0.0022);
    const line = (pts: V[]) => { for (let i = 1; i < pts.length; i++) { const a2 = pts[i - 1], b2 = pts[i]; const front = (a2[2] + b2[2]) / 2 < 0.02; x.strokeStyle = tone(m.p.accent, 1, front ? 0.55 : 0.1); const p = P(c, a2), q = P(c, b2); x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); } };
    for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 49 }, (_, i) => on(lat, i * 7.5)));
    for (let lon = 0; lon < 180; lon += 30) { line(Array.from({ length: 49 }, (_, i) => on(-90 + i * 3.75, lon))); line(Array.from({ length: 49 }, (_, i) => on(-90 + i * 3.75, lon + 180))); }
    const cities: [number, number][] = [[24.7, 46.7], [51.5, -0.1], [40.7, -74], [35.7, 139.7], [-33.9, 151.2], [30, 31.2], [25.2, 55.3], [-23.5, -46.6]];
    const routes: [number, number][] = [[0, 1], [0, 3], [6, 2], [5, 4], [1, 7], [6, 3]];
    routes.forEach(([i, j], r) => { const prog = cl((m.t - 0.8 - r * 0.45) / 1.2); if (prog <= 0) return; const A = cities[i], B = cities[j], pts: V[] = [];
      for (let s = 0; s <= 40 * prog; s++) { const q = s / 40; pts.push(on(A[0] + (B[0] - A[0]) * q, A[1] + (B[1] - A[1]) * q, R * (1 + Math.sin(q * Math.PI) * 0.25))); }
      x.lineWidth = u * 0.006; for (let s = 1; s < pts.length; s++) { const p = P(c, pts[s - 1]), q = P(c, pts[s]); x.strokeStyle = tone(m.p.accent2, 1, pts[s][2] < 0.05 ? 0.95 : 0.15); x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); } });
    cities.forEach(([la, lo], i) => { const v = on(la, lo); if (v[2] > 0.02) return; const p = P(c, v); x.fillStyle = m.p.accent2; x.beginPath(); x.arc(p[0], p[1], u * 0.009 * (1 + 0.3 * Math.sin(m.t * 4 + i)), 0, 7); x.fill(); });
    x.globalAlpha = k * cl((m.t - 0.6) / 0.5); text(m, String(m.p.title), m.W / 2, m.H * 0.92, { px: u * 0.06, weight: 900, align: "center", maxW: m.W * 0.9 }); } },
];
function font9(x: CanvasRenderingContext2D, px: number) { x.font = `900 ${Math.max(1, px)}px ${FAM}`; }

// ---- hand-drawn looks: drawn on twos, the lines boil
const HAND = '"Segoe Print","Bradley Hand","Chalkboard SE","Comic Sans MS","Cairo",cursive';
const twos = (m: MCtx) => Math.floor(m.t * 12) / 12;
const boil = (m: MCtx) => Math.floor(m.t * 12);
/** a line through points, a little different on each drawing (jitter `j` in px), drawn twice like a quick pen */
function ink(x: CanvasRenderingContext2D, pts: [number, number][], seed: number, j: number, passes = 2) {
  for (let p = 0; p < passes; p++) { x.beginPath(); pts.forEach(([X, Y], i) => { const a = X + (rnd(seed + i * 3.1, p + 1) - 0.5) * j, b = Y + (rnd(seed + i * 5.7, p + 7) - 0.5) * j; if (i) x.lineTo(a, b); else x.moveTo(a, b); }); x.stroke(); }
}
const rectPts = (X: number, Y: number, w: number, h: number, n = 4): [number, number][] => { const o: [number, number][] = []; const seg = (a: [number, number], b: [number, number]) => { for (let i = 0; i < n; i++) o.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]); };
  seg([X, Y], [X + w, Y]); seg([X + w, Y], [X + w, Y + h]); seg([X + w, Y + h], [X, Y + h]); seg([X, Y + h], [X, Y]); o.push([X, Y]); return o; };
const circPts = (X: number, Y: number, r: number, n = 24, over = 1.08): [number, number][] => Array.from({ length: Math.round(n * over) + 1 }, (_, i) => [X + Math.cos((i / n) * Math.PI * 2 - 1.2) * r, Y + Math.sin((i / n) * Math.PI * 2 - 1.2) * r]);
function hand(m: MCtx, s: string, X: number, Y: number, px: number, color: string, align: CanvasTextAlign = "center", wob = 0.03, maxW?: number) {
  const x = m.ctx; x.save(); x.translate(X, Y); x.rotate((rnd(boil(m) + s.length, 9) - 0.5) * wob); text(m, s, 0, 0, { px, weight: 700, color, align, fam: HAND, maxW }); x.restore();
}
const DRAWN_FIELDS = (title: [string, string], list: [string, string], accent: string) => [T("title", "text", "Title", "العنوان", title), T("items", "list", "Points (| between)", "النقاط (| بينها)", list), BG({ def: accent })];

export const DRAWN: Template[] = [
  { id: "dr-paper", en: "Cut paper", ar: "ورق مقصوص", group: "drawn", dur: 6, fields: DRAWN_FIELDS(["Our story", "قصتنا"], ["Started small | Grew together | Still curious", "بدأنا صغاراً | كبرنا معاً | ما زلنا فضوليين"], "#ff7a1a"), draw(m) {
    const x = m.ctx, u = m.u, t = twos(m), B = boil(m), k = 1 - outK(m), it = items(m.p.items).slice(0, 4), rtl = AR.test(String(m.p.title) + it.join(""));
    x.globalAlpha = k; x.fillStyle = "#f2e6cf"; x.fillRect(0, 0, m.W, m.H);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,90,40,${0.04 + rnd(i, 3) * 0.05})`; x.fillRect(rnd(i, 1) * m.W, rnd(i, 2) * m.H, u * 0.003, u * 0.003); }
    const torn = (X: number, Y: number, w: number, h: number, seed: number, fill: string, rot: number) => { x.save(); x.translate(X + w / 2, Y + h / 2); x.rotate(rot); x.shadowColor = "rgba(60,40,10,.35)"; x.shadowBlur = u * 0.02; x.shadowOffsetY = u * 0.01;
      x.beginPath(); const n = 18; for (let i = 0; i <= n * 4; i++) { const side = Math.floor(i / n), q = (i % n) / n; let px2 = 0, py2 = 0; const jg = (rnd(seed + i, 4) - 0.5) * u * 0.012;
        if (side === 0) { px2 = -w / 2 + w * q; py2 = -h / 2 + jg; } else if (side === 1) { px2 = w / 2 + jg; py2 = -h / 2 + h * q; } else if (side === 2) { px2 = w / 2 - w * q; py2 = h / 2 + jg; } else { px2 = -w / 2 + jg; py2 = h / 2 - h * q; }
        if (i) x.lineTo(px2, py2); else x.moveTo(px2, py2); } x.closePath(); x.fillStyle = fill; x.fill(); x.restore(); };
    const g = cl(t / 0.5); torn(m.W * 0.14, m.H * 0.1 - (1 - g) * u * 0.3, m.W * 0.72, u * 0.16, 11, m.p.accent, -0.02 + (rnd(B, 5) - 0.5) * 0.006);
    hand(m, String(m.p.title), m.W / 2, m.H * 0.1 - (1 - g) * u * 0.3 + u * 0.08, u * 0.085, "#2b1d0e", "center", 0.02, m.W * 0.66);
    const cols = ["#2dd4a8", "#ffd23f", "#7B61FF", "#FF3D9A"];
    it.forEach((s, i) => { const d = cl((t - 0.5 - i * 0.5) / 0.34); if (d <= 0) return; const w = m.W * 0.6, h = u * 0.12, X = (m.W - w) / 2 + (rtl ? -1 : 1) * (i % 2 ? u * 0.05 : -u * 0.05), Y = m.H * 0.34 + i * h * 1.3, drop = (1 - ease.easeOut(d)) * -u * 0.12;
      torn(X, Y + drop, w, h, 30 + i * 7, cols[i % 4], (i % 2 ? 0.03 : -0.025) + (rnd(B + i, 6) - 0.5) * 0.008);
      x.save(); x.beginPath(); x.arc(rtl ? X + w - h * 0.5 : X + h * 0.5, Y + drop + h / 2, h * 0.28, 0, 7); x.fillStyle = "#fff8ea"; x.fill(); x.fillStyle = "#2b1d0e"; x.beginPath(); x.arc(rtl ? X + w - h * 0.44 : X + h * 0.56, Y + drop + h * 0.45, h * 0.07, 0, 7); x.fill(); x.restore();
      hand(m, s, rtl ? X + w - h : X + h, Y + drop + h / 2, h * 0.42, "#2b1d0e", rtl ? "right" : "left", 0.03, w - h * 1.3); }); } },
  { id: "dr-ink", en: "Crosshatch ink", ar: "حبر مخطّط", group: "drawn", dur: 6, fields: DRAWN_FIELDS(["How it works", "كيف يعمل"], ["You ask | It thinks | You get it", "تسأل | يفكّر | تحصل عليه"], "#1d2b5c"), draw(m) {
    const x = m.ctx, u = m.u, t = twos(m), B = boil(m), k = 1 - outK(m), it = items(m.p.items).slice(0, 4), n = Math.max(1, it.length), ink0 = m.p.accent;
    x.globalAlpha = k; x.fillStyle = "#f6efe0"; x.fillRect(0, 0, m.W, m.H); x.strokeStyle = ink0; x.fillStyle = ink0; x.lineCap = "round"; x.lineJoin = "round";
    hand(m, String(m.p.title), m.W / 2, m.H * 0.14, u * 0.085, ink0, "center", 0.02, m.W * 0.86);
    x.lineWidth = u * 0.005; ink(x, [[m.W * 0.3, m.H * 0.22], [m.W * 0.7 * cl(t / 0.6) + m.W * 0.3 * (1 - cl(t / 0.6)), m.H * 0.225]], B, u * 0.006);
    const bw = Math.min(u * 0.34, (m.W * 0.86) / n - u * 0.06), Y = m.H * 0.56;
    it.forEach((s, i) => { const d = cl((t - 0.4 - i * 0.6) / 0.4); if (d <= 0) return; const cx = m.W / 2 + (i - (n - 1) / 2) * (bw + u * 0.08) * (AR.test(s) ? -1 : 1), X = cx - bw / 2, h = bw * 0.75;
      x.lineWidth = u * 0.005; ink(x, rectPts(X, Y - h / 2, bw, h, 5).slice(0, Math.ceil(21 * d)), B * 7 + i, u * 0.008);
      x.save(); x.beginPath(); x.rect(X, Y - h / 2, bw, h); x.clip(); x.lineWidth = u * 0.0022; x.globalAlpha = k * 0.55 * d;
      for (let q = -h; q < bw; q += u * 0.018) ink(x, [[X + q, Y + h / 2], [X + q + h, Y - h / 2]], B * 13 + q, u * 0.004, 1);
      if (i % 2) for (let q = -h; q < bw; q += u * 0.026) ink(x, [[X + q + h, Y + h / 2], [X + q, Y - h / 2]], B * 17 + q, u * 0.004, 1); x.restore();
      x.fillStyle = "#f6efe0"; x.fillRect(cx - bw * 0.42, Y - u * 0.04, bw * 0.84, u * 0.08); hand(m, s, cx, Y, u * 0.045, ink0, "center", 0.04, bw * 0.8);
      if (i < n - 1 && d >= 1) { const ax = cx + (bw / 2 + u * 0.005) * (AR.test(s) ? -1 : 1), bx = ax + u * 0.07 * (AR.test(s) ? -1 : 1); x.lineWidth = u * 0.005; ink(x, [[ax, Y], [bx, Y]], B + i * 3, u * 0.005); ink(x, [[bx - u * 0.02 * Math.sign(bx - ax), Y - u * 0.018], [bx, Y], [bx - u * 0.02 * Math.sign(bx - ax), Y + u * 0.018]], B + i * 5, u * 0.004); } }); } },
  { id: "dr-riso", en: "Risograph print", ar: "طباعة ريزو", group: "drawn", dur: 5, fields: [T("title", "text", "Title", "العنوان", ["SUMMER SALE", "تخفيضات الصيف"]), T("line", "text", "Line", "السطر", ["Up to 50% off", "حتى 50٪"]), BG({ def: "#ff48b0" }), A2("#0078bf")], draw(m) {
    const x = m.ctx, u = m.u, t = twos(m), B = boil(m), k = 1 - outK(m), mis = (i: number) => [(rnd(B, i) - 0.5) * u * 0.008, (rnd(B, i + 3) - 0.5) * u * 0.008];
    x.globalAlpha = k; x.fillStyle = "#f4efe4"; x.fillRect(0, 0, m.W, m.H); x.globalCompositeOperation = "multiply";
    const dots = (cx: number, cy: number, r: number, color: string, step: number, off: number[]) => { x.fillStyle = color; for (let yy = cy - r; yy < cy + r; yy += step) for (let xx = cx - r; xx < cx + r; xx += step) { const d = Math.hypot(xx - cx, yy - cy) / r; if (d > 1) continue; x.beginPath(); x.arc(xx + off[0], yy + off[1], step * 0.48 * (1 - d * 0.75), 0, 7); x.fill(); } };
    const g = ease.easeOut(cl(t / 0.8)); dots(m.W * 0.35, m.H * 0.45, u * 0.3 * g, "#ffe800", u * 0.022, mis(1)); dots(m.W * 0.62, m.H * 0.52, u * 0.26 * g, m.p.accent, u * 0.02, mis(2)); dots(m.W * 0.48, m.H * 0.4, u * 0.17 * g, m.p.accent2, u * 0.016, mis(4));
    const s = String(m.p.title), px = Math.min(u * 0.16, (m.W * 0.86) / Math.max(1, measure(m, s, 1, 900)));
    const a = cl((t - 0.4) / 0.4), o1 = mis(5), o2 = mis(6); x.globalAlpha = k * a;
    text(m, s, m.W / 2 + o1[0] + u * 0.006, m.H * 0.47 + o1[1] + u * 0.006, { px, weight: 900, align: "center", color: m.p.accent }); text(m, s, m.W / 2 + o2[0], m.H * 0.47 + o2[1], { px, weight: 900, align: "center", color: m.p.accent2 });
    x.globalAlpha = k * cl((t - 0.9) / 0.4); text(m, String(m.p.line), m.W / 2, m.H * 0.66, { px: u * 0.06, weight: 800, align: "center", color: "#1d1d1d", maxW: m.W * 0.8 });
    x.globalCompositeOperation = "source-over"; for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(0,0,0,${rnd(i, 8) * 0.06})`; x.fillRect(rnd(i + B, 1) * m.W, rnd(i + B, 2) * m.H, 1.2, 1.2); } } },
  { id: "dr-sketch", en: "Sketchbook", ar: "دفتر رسم", group: "drawn", dur: 6, fields: DRAWN_FIELDS(["Big idea", "فكرة كبيرة"], ["Draw it | Test it | Ship it", "ارسمها | جرّبها | أطلقها"], "#ff3d5a"), draw(m) {
    const x = m.ctx, u = m.u, t = twos(m), B = boil(m), k = 1 - outK(m), it = items(m.p.items).slice(0, 4), graph = "#45474d", rtl = AR.test(String(m.p.title) + it.join(""));
    x.globalAlpha = k; x.fillStyle = "#fbfaf5"; x.fillRect(0, 0, m.W, m.H); x.strokeStyle = "rgba(90,140,200,.18)"; x.lineWidth = 1; for (let y = m.H * 0.08; y < m.H; y += u * 0.06) { x.beginPath(); x.moveTo(0, y); x.lineTo(m.W, y); x.stroke(); }
    x.strokeStyle = "rgba(220,80,80,.25)"; x.beginPath(); x.moveTo(rtl ? m.W * 0.9 : m.W * 0.1, 0); x.lineTo(rtl ? m.W * 0.9 : m.W * 0.1, m.H); x.stroke();
    const tx = rtl ? m.W * 0.84 : m.W * 0.16; hand(m, String(m.p.title), tx, m.H * 0.18, u * 0.1, graph, rtl ? "right" : "left", 0.02, m.W * 0.7);
    const tw = Math.min(measure(m, String(m.p.title), u * 0.1, 700, HAND), m.W * 0.7), ud = cl((t - 0.3) / 0.5); x.strokeStyle = m.p.accent; x.lineWidth = u * 0.009; x.lineCap = "round";
    const wv: [number, number][] = Array.from({ length: 12 }, (_, i) => [tx + (rtl ? -1 : 1) * tw * (i / 11) * ud, m.H * 0.25 + Math.sin(i * 1.7) * u * 0.008]); if (ud > 0) ink(x, wv, B, u * 0.004);
    it.forEach((s, i) => { const d = cl((t - 0.8 - i * 0.5) / 0.3); if (d <= 0) return; const Y = m.H * 0.42 + i * u * 0.13, bx = rtl ? m.W * 0.82 : m.W * 0.18;
      x.strokeStyle = graph; x.lineWidth = u * 0.004; ink(x, circPts(bx, Y, u * 0.025, 14, d * 1.1), B * 3 + i, u * 0.005);
      x.globalAlpha = k * d; hand(m, s, rtl ? bx - u * 0.06 : bx + u * 0.06, Y, u * 0.055, graph, rtl ? "right" : "left", 0.05, m.W * 0.6); x.globalAlpha = k;
      if (i === 0 && t > 2.2) { x.strokeStyle = m.p.accent; x.lineWidth = u * 0.006; const w2 = measure(m, s, u * 0.055, 700, HAND); ink(x, circPts(rtl ? bx - u * 0.06 - w2 / 2 : bx + u * 0.06 + w2 / 2, Y, w2 * 0.62, 20, cl((t - 2.2) / 0.5) * 1.1).map(([a, b]) => [a, Y + (b - Y) * 0.45] as [number, number]), B * 5, u * 0.006); } }); } },
  { id: "dr-math", en: "Math explainer", ar: "شرح رياضي", group: "drawn", dur: 7, fields: [T("title", "text", "Title", "العنوان", ["Growth over time", "النمو مع الوقت"]), T("fx", "text", "Label", "التسمية", ["f(x) = x²", "ص = س²"]), BG({ def: "#58c4dd" }), A2("#fc6255")], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), X0 = m.W * 0.18, Y0 = m.H * 0.8, Wd = m.W * 0.66, Hd = m.H * 0.56, ax = ease.easeInOut(cl(m.t / 0.9)), cv = ease.easeInOut(cl((m.t - 0.9) / 2.2));
    x.globalAlpha = k; x.fillStyle = "#0b0b0d"; x.fillRect(0, 0, m.W, m.H); x.strokeStyle = "#e8e8e8"; x.lineWidth = u * 0.004; x.lineCap = "round";
    x.beginPath(); x.moveTo(X0, Y0); x.lineTo(X0 + Wd * ax, Y0); x.moveTo(X0, Y0); x.lineTo(X0, Y0 - Hd * ax); x.stroke();
    for (let i = 1; i <= 5; i++) { if (i / 5 > ax) break; x.beginPath(); x.moveTo(X0 + (Wd * i) / 5, Y0 - u * 0.01); x.lineTo(X0 + (Wd * i) / 5, Y0 + u * 0.01); x.moveTo(X0 - u * 0.01, Y0 - (Hd * i) / 5); x.lineTo(X0 + u * 0.01, Y0 - (Hd * i) / 5); x.stroke(); text(m, String(i), X0 + (Wd * i) / 5, Y0 + u * 0.04, { px: u * 0.03, weight: 500, align: "center", color: "#bbb", fam: "serif" }); }
    x.strokeStyle = m.p.accent; x.lineWidth = u * 0.008; x.beginPath(); const N = 80; let last: [number, number] = [X0, Y0];
    for (let i = 0; i <= N * cv; i++) { const q = i / N, px2 = X0 + Wd * q, py2 = Y0 - Hd * q * q; if (i) x.lineTo(px2, py2); else x.moveTo(px2, py2); last = [px2, py2]; } x.stroke();
    if (cv > 0) { x.fillStyle = m.p.accent2; x.beginPath(); x.arc(last[0], last[1], u * 0.014, 0, 7); x.fill(); x.setLineDash([u * 0.01, u * 0.01]); x.strokeStyle = tone(m.p.accent2, 1, 0.7); x.lineWidth = u * 0.003; x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(last[0], Y0); x.moveTo(last[0], last[1]); x.lineTo(X0, last[1]); x.stroke(); x.setLineDash([]); }
    x.globalAlpha = k * cl((m.t - 2) / 0.6); text(m, String(m.p.fx), X0 + Wd * 0.62, Y0 - Hd * 0.72, { px: u * 0.06, weight: 400, color: m.p.accent, fam: '"Cambria Math","STIX Two Math","Times New Roman",serif' });
    x.globalAlpha = k * cl(m.t / 0.6); text(m, String(m.p.title), m.W / 2, m.H * 0.1, { px: u * 0.065, weight: 400, align: "center", color: "#f2f2f2", fam: '"Cambria","Times New Roman",serif', maxW: m.W * 0.9 }); } },
  { id: "dr-iso", en: "Isometric line art", ar: "رسم أيزومتري", group: "drawn", dur: 6, fields: [T("title", "text", "Title", "العنوان", ["Built in layers", "مبني طبقة فوق طبقة"]), T("items", "list", "Layers (| between)", "الطبقات (| بينها)", ["Data | Logic | Design", "البيانات | المنطق | التصميم"]), BG({ def: "#4f46e5" })], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), it = items(m.p.items).slice(0, 4), n = Math.max(1, it.length), cx = m.W * 0.42, base = m.H * 0.86, S = u * 0.22, line = "#1f2230";
    x.globalAlpha = k; x.fillStyle = "#eef0f5"; x.fillRect(0, 0, m.W, m.H);
    const iso = (X: number, Y: number, Z: number) => [cx + (X - Y) * S * 0.866, base - (X + Y) * S * 0.5 - Z * S] as [number, number];
    const quad = (pts: [number, number][], fill: string) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = line; x.lineWidth = Math.max(1, u * 0.0028); x.lineJoin = "round"; x.stroke(); };
    for (let i = 0; i < n; i++) { const g = sp(m, 6 + i * 9, { damping: 13, stiffness: 120 }); if (g <= 0.01) continue; const z = i * 0.34 + (1 - g) * 0.9, h = 0.16, w = 1, top = i === n - 1;
      x.globalAlpha = k * cl(g * 1.5);
      quad([iso(0, 0, z + h), iso(w, 0, z + h), iso(w, w, z + h), iso(0, w, z + h)], top ? m.p.accent : "#ffffff");
      quad([iso(w, 0, z), iso(w, w, z), iso(w, w, z + h), iso(w, 0, z + h)], "#d9dce6"); quad([iso(0, w, z), iso(w, w, z), iso(w, w, z + h), iso(0, w, z + h)], "#c4c8d4");
      const lp = iso(w, w * 0.5, z + h * 0.5); x.strokeStyle = line; x.lineWidth = Math.max(1, u * 0.002); x.beginPath(); x.moveTo(lp[0] + u * 0.01, lp[1]); x.lineTo(m.W * 0.74, lp[1]); x.stroke();
      text(m, it[i], m.W * 0.75, lp[1], { px: u * 0.045, weight: 800, color: line, align: "left", maxW: m.W * 0.24 }); }
    x.globalAlpha = k; text(m, String(m.p.title), m.W / 2, m.H * 0.1, { px: u * 0.065, weight: 900, align: "center", color: line, maxW: m.W * 0.9 }); } },
  { id: "dr-pixel", en: "Pixel art", ar: "فن البكسل", group: "drawn", dur: 5, fields: [T("title", "text", "Title", "العنوان", ["LEVEL UP!", "مستوى جديد!"]), T("score", "text", "Score", "النقاط", ["SCORE 9999", "النقاط 9999"]), BG({ def: "#ffd23f" }), A2("#2dd4a8")], draw(m) {
    const x = m.ctx, k = 1 - outK(m), t = twos(m), pw = Math.max(64, Math.round(m.W / 6)), ph = Math.max(36, Math.round(m.H / 6));
    const lo = canvasOf(pw, ph), c = lo.getContext("2d")! as OffscreenCanvasRenderingContext2D; c.imageSmoothingEnabled = false;
    c.fillStyle = "#1b1c3a"; c.fillRect(0, 0, pw, ph); for (let i = 0; i < 40; i++) { if ((Math.floor(t * 4) + i) % 5 === 0) continue; c.fillStyle = "#ffffff"; c.fillRect(Math.floor(rnd(i, 1) * pw), Math.floor(rnd(i, 2) * ph * 0.6), 1, 1); }
    c.fillStyle = m.p.accent2; c.fillRect(0, ph - 6, pw, 6); c.fillStyle = tone(m.p.accent2, 0.6); for (let i = 0; i < pw; i += 4) c.fillRect(i, ph - 6, 2, 1);
    const jump = Math.abs(Math.sin(t * Math.PI * 1.5)) * 8, hx = Math.floor(pw * 0.2), hy = Math.floor(ph - 6 - 8 - jump);
    const hero = ["..XX..", ".XXXX.", "XOXXOX", "XXXXXX", ".X..X."]; hero.forEach((row, ry2) => [...row].forEach((ch, rx2) => { if (ch === ".") return; c.fillStyle = ch === "O" ? "#1b1c3a" : m.p.accent; c.fillRect(hx + rx2, hy + ry2 + 2, 1, 1); }));
    for (let i = 0; i < 4; i++) { const cxp = Math.floor(pw * 0.45 + i * pw * 0.12), cyp = Math.floor(ph * 0.55 + Math.sin(t * 6 + i) * 2); if (t > 1.2 + i * 0.3) continue; c.fillStyle = "#ffd23f"; c.fillRect(cxp, cyp, 3, 3); c.fillStyle = "#fff6b0"; c.fillRect(cxp, cyp, 1, 1); }
    const s = String(m.p.title), fpx = Math.max(6, Math.round(ph * 0.2)); c.font = `900 ${fpx}px ${FAM}`; c.textAlign = "center"; c.textBaseline = "middle"; c.direction = AR.test(s) ? "rtl" : "ltr";
    const sw = c.measureText(s).width; const sc = sw > pw * 0.9 ? (pw * 0.9) / sw : 1; c.save(); c.translate(pw / 2, ph * 0.28 + (t < 0.6 ? Math.floor((1 - t / 0.6) * -10) : 0)); c.scale(sc, sc);
    c.fillStyle = "#000"; c.fillText(s, 1, 1); c.fillStyle = Math.floor(t * 6) % 2 ? m.p.accent : "#ffffff"; c.fillText(s, 0, 0); c.restore();
    c.font = `700 ${Math.max(5, Math.round(ph * 0.11))}px ${FAM}`; c.fillStyle = "#ffffff"; c.fillText(String(m.p.score), pw / 2, ph * 0.44);
    // nearest-neighbour upscale: every pixel a crisp block
    x.globalAlpha = k; x.save(); x.imageSmoothingEnabled = false; x.drawImage(lo as unknown as CanvasImageSource, 0, 0, m.W, m.H); x.restore(); } },
];

// ---- the two flat graphics we didn't have
export const FLAT2: Template[] = [
  { id: "so-emoji", en: "Emoji pop", ar: "انفجار إيموجي", group: "social", dur: 4, fields: [T("emoji", "text", "Emoji", "الإيموجي", ["🔥 😍 👏 🎉"]), T("text", "text", "Words", "الكلمات", ["So good!", "رائع جداً!"]), BG({ def: "#FF3D9A" })], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), es = [...String(m.p.emoji || "").matchAll(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu)].map((q) => q[0]).slice(0, 6), n = Math.max(1, es.length);
    x.globalAlpha = k; const a = sp(m, 0, { damping: 9, stiffness: 160 });
    rrect(x, m.W / 2 - u * 0.36 * a, m.H * 0.7 - u * 0.07, u * 0.72 * a, u * 0.14, u * 0.07); x.fillStyle = m.p.accent; x.fill();
    x.globalAlpha = k * cl(a * 2); text(m, String(m.p.text), m.W / 2, m.H * 0.7, { px: u * 0.065, weight: 900, align: "center", maxW: u * 0.66 });
    es.forEach((e, i) => { const g = sp(m, 4 + i * 4, { damping: 8, stiffness: 170 }), X = m.W / 2 + (i - (n - 1) / 2) * u * 0.17, rise = ((m.t - i * 0.13) * 0.06) % 0.12, Y = m.H * 0.44 - Math.max(0, rise) * u;
      x.globalAlpha = k; x.save(); x.translate(X, Y); x.rotate(Math.sin(m.t * 3 + i) * 0.15); x.scale(g, g); x.font = `${Math.round(u * 0.12)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(e, 0, 0); x.restore();
      for (let j = 0; j < 6; j++) { const pr = cl((m.t - 0.15 - i * 0.13) / 0.5); if (pr <= 0 || pr >= 1) continue; const an = (j / 6) * Math.PI * 2 + i, rr = u * 0.12 * ease.easeOut(pr); x.globalAlpha = k * (1 - pr); x.fillStyle = j % 2 ? m.p.accent : "#ffd23f"; x.beginPath(); x.arc(X + Math.cos(an) * rr, Y + Math.sin(an) * rr, u * 0.008, 0, 7); x.fill(); } }); } },
  { id: "ti-punch", en: "Text punch", ar: "كلمات ضاربة", group: "titles", dur: 4, fields: [T("text", "text", "Words", "الكلمات", ["THIS CHANGES EVERYTHING", "هذا يغيّر كل شيء"]), BG({ def: "#ffd23f" })], draw(m) {
    const x = m.ctx, u = m.u, k = 1 - outK(m), ws = String(m.p.text || "").split(/\s+/).filter(Boolean).slice(0, 6), per = Math.min(0.45, (m.dur - 1) / Math.max(1, ws.length)), i = Math.min(ws.length - 1, Math.floor(m.t / per)), lt = m.t - i * per;
    if (!ws.length) return; const w = ws[i], last = i === ws.length - 1, g = M2(lt), shake = lt < 0.12 ? (rnd(Math.floor(m.t * 60), 3) - 0.5) * u * 0.03 : 0;
    x.globalAlpha = k; if (lt < 0.06) { x.fillStyle = tone(m.p.accent, 1, 0.25); x.fillRect(0, 0, m.W, m.H); }
    let px = u * (last ? 0.24 : 0.2); const mw = measure(m, w, px, 900); if (mw > m.W * 0.86) px *= (m.W * 0.86) / mw;
    x.save(); x.translate(m.W / 2 + shake, m.H / 2 + shake * 0.6); x.scale(g, g); x.rotate(last ? -0.04 : (i % 2 ? 0.03 : -0.02));
    if (last) { const bw = measure(m, w, px, 900) + u * 0.08; x.fillStyle = m.p.accent; x.fillRect(-bw / 2, -px * 0.62, bw, px * 1.24); }
    text(m, w, 0, 0, { px, weight: 900, align: "center", color: last ? "#111" : "#fff" }); x.restore(); } },
];
/** a punch: big, overshoots, settles (by the time from the word's start) */
function M2(lt: number) { const q = cl(lt / 0.22); return 1 + (1 - ease.easeOut(q)) * 0.9 - Math.sin(q * Math.PI) * 0.12; }
