// nooi.ai · 3D Studio — procedural worlds, built on the visitor's GPU in a fraction of a second, no downloads.
// A world = a walkable plot of an exact size (e.g. 5 × 5 m) + a ring of scenery around it that you see but don't walk into.
// Biomes: rainforest · forest · snow · desert · beach · meadow · studio (a car showroom). Every plant type is ONE InstancedMesh
// (one draw call for hundreds of ferns), leaves sway in the wind on the GPU, textures are painted on a canvas at build time.
import * as THREE from "three";
import { applyEnvironmentShaders } from "./shaders.js";

// ───────────── small helpers ─────────────
export function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function vnoise(seed) { const R = rng(seed), P = new Float32Array(512); for (let i = 0; i < 512; i++) P[i] = R();
  const h = (x, y) => P[((x * 73856093) ^ (y * 19349663)) & 511], s = (t) => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi); const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }; }
const fbm = (n, x, y, o = 4) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * n(x * f, y * f); a *= 0.5; f *= 2.03; } return v; };
const canvas = (w, h = w) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
function tex(c, { srgb = true, repeat = 0, aniso = 8 } = {}) { const t = new THREE.CanvasTexture(c); if (srgb) { if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding; } t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); } return t; }
function normalFrom(c, k = 2) { const w = c.width, h = c.height, s = c.getContext("2d").getImageData(0, 0, w, h).data, o = canvas(w, h), ox = o.getContext("2d"), d = ox.createImageData(w, h);
  const L = (x, y) => { x = (x + w) % w; y = (y + h) % h; const i = (y * w + x) * 4; return (s[i] * 0.3 + s[i + 1] * 0.59 + s[i + 2] * 0.11) / 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (L(x + 1, y) - L(x - 1, y)) * k, dy = (L(x, y + 1) - L(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4; d.data[i] = (-dx / l * 0.5 + 0.5) * 255; d.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; d.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; d.data[i + 3] = 255; }
  ox.putImageData(d, 0, 0); return o; }
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

// ───────────── painted textures ─────────────
const PAINT = {
  // leaf litter on dark soil (rainforest floor)
  litter(R) { const c = canvas(512), x = c.getContext("2d"); x.fillStyle = "#2f2418"; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) { const px = R() * 512, py = R() * 512, s = 4 + R() * 12, hue = R() < 0.25 ? 70 + R() * 40 : 18 + R() * 22; x.save(); x.translate(px, py); x.rotate(R() * 6.3);
      x.fillStyle = hsl(hue, 30 + R() * 35, 14 + R() * 22, 0.95); x.beginPath(); x.ellipse(0, 0, s, s * 0.42, 0, 0, 6.3); x.fill(); x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 0.6; x.beginPath(); x.moveTo(-s, 0); x.lineTo(s, 0); x.stroke(); x.restore();
      if (i % 4 === 0) { for (const [dx, dy] of [[512, 0], [-512, 0], [0, 512], [0, -512]]) { x.save(); x.translate(px + dx, py + dy); x.rotate(R() * 6.3); x.fillStyle = hsl(hue, 30, 18, 0.9); x.beginPath(); x.ellipse(0, 0, s, s * 0.4, 0, 0, 6.3); x.fill(); x.restore(); } } }
    for (let i = 0; i < 70; i++) { x.strokeStyle = hsl(25, 30, 12 + R() * 10); x.lineWidth = 1 + R() * 2; x.beginPath(); const a = R() * 512, b = R() * 512; x.moveTo(a, b); x.lineTo(a + (R() - 0.5) * 80, b + (R() - 0.5) * 80); x.stroke(); }
    return c; },
  ground(R, base, spots) { const c = canvas(512), x = c.getContext("2d"); x.fillStyle = base; x.fillRect(0, 0, 512, 512); const n = vnoise(R() * 1e6 | 0);
    const d = x.getImageData(0, 0, 512, 512); for (let y = 0; y < 512; y++) for (let X = 0; X < 512; X++) { const v = fbm(n, X / 40, y / 40, 4) - 0.5, i = (y * 512 + X) * 4; for (let k = 0; k < 3; k++) d.data[i + k] = Math.max(0, Math.min(255, d.data[i + k] * (1 + v * 0.45))); }
    x.putImageData(d, 0, 0); for (let i = 0; i < spots[0]; i++) { x.fillStyle = spots[1](R); x.beginPath(); x.arc(R() * 512, R() * 512, spots[2] * (0.3 + R()), 0, 6.3); x.fill(); } return c; },
  bark(R, hue = 28, light = 30) { const c = canvas(128, 512), x = c.getContext("2d"); x.fillStyle = hsl(hue, 18, light); x.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 160; i++) { x.strokeStyle = hsl(hue, 15 + R() * 15, light * (0.5 + R() * 0.7)); x.lineWidth = 1 + R() * 4; const px = R() * 128; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + (R() - 0.5) * 20, 170, px + (R() - 0.5) * 20, 340, px, 512); x.stroke(); }
    for (let i = 0; i < 40; i++) { x.fillStyle = hsl(85 + R() * 30, 40, 22 + R() * 12, 0.55); x.beginPath(); x.ellipse(R() * 128, R() * 512, 6 + R() * 18, 10 + R() * 40, 0, 0, 6.3); x.fill(); } return c; },
  // a pinnate frond (fern / palm): rachis + leaflets, transparent around
  pinnate(R, hue = 105, light = 30) { const c = canvas(128, 512), x = c.getContext("2d"); x.strokeStyle = hsl(hue - 20, 40, light - 8); x.lineWidth = 4; x.beginPath(); x.moveTo(64, 512); x.lineTo(64, 4); x.stroke();
    for (let y = 500; y > 10; y -= 11) { const t = 1 - y / 512, len = 58 * Math.sin(Math.min(1, (1 - t) * 1.25) * Math.PI * 0.5 + 0.2) * (0.85 + R() * 0.15), w = 5 + 3 * (1 - t);
      for (const sgn of [-1, 1]) { x.save(); x.translate(64, y); x.rotate(sgn * (1.05 + t * 0.35)); x.fillStyle = hsl(hue + (R() - 0.5) * 12, 45 + R() * 15, light + (R() - 0.5) * 8); x.beginPath(); x.ellipse(0, -len / 2, w, len / 2, 0, 0, 6.3); x.fill(); x.restore(); } } return c; },
  // a broad, heart-shaped leaf (alocasia / philodendron) with veins
  broad(R, hue = 110, light = 28) { const c = canvas(256), x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, hsl(hue, 50, light + 10)); g.addColorStop(1, hsl(hue - 8, 55, light - 4)); x.fillStyle = g;
    x.beginPath(); x.moveTo(128, 6); x.bezierCurveTo(250, 40, 250, 200, 140, 236); x.lineTo(128, 210); x.lineTo(116, 236); x.bezierCurveTo(6, 200, 6, 40, 128, 6); x.fill();
    x.strokeStyle = hsl(hue - 10, 30, light + 22, 0.8); x.lineWidth = 3; x.beginPath(); x.moveTo(128, 210); x.lineTo(128, 14); x.stroke(); x.lineWidth = 1.5;
    for (let i = 1; i < 8; i++) { const y = 205 - i * 24; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(128, y); x.quadraticCurveTo(128 + s * 50, y - 10, 128 + s * (70 + i * 3), y - 34); x.stroke(); } } return c; },
  // dense leaves for canopy / bush blobs (opaque)
  canopy(R, hue = 108, light = 22, cut = false) { const c = canvas(512), x = c.getContext("2d"); if (!cut) { x.fillStyle = hsl(hue, 45, light * 0.6); x.fillRect(0, 0, 512, 512); }
    for (let i = 0; i < 2400; i++) { const px = R() * 512, py = R() * 512, s = 6 + R() * 14; x.save(); x.translate(px, py); x.rotate(R() * 6.3); x.fillStyle = hsl(hue + (R() - 0.5) * 30, 40 + R() * 30, light * (0.7 + R() * 0.9)); x.beginPath(); x.ellipse(0, 0, s, s * 0.45, 0, 0, 6.3); x.fill(); x.restore(); } return c; },
  grassBlade(R, hue = 95) { const c = canvas(32, 256), x = c.getContext("2d"), g = x.createLinearGradient(0, 256, 0, 0); g.addColorStop(0, hsl(hue, 45, 16)); g.addColorStop(1, hsl(hue + 10, 55, 46)); x.fillStyle = g; x.beginPath(); x.moveTo(4, 256); x.quadraticCurveTo(14, 90, 16, 0); x.quadraticCurveTo(20, 90, 28, 256); x.fill(); return c; },
  sky(top, bottom) { const c = canvas(4, 256), x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 4, 256); return c; },
};

// ───────────── geometry builders (unit sized; instances scale them) ─────────────
// a frond: a strip along +Z, arching (rise then droop), width taper comes from the texture's alpha
function frondGeo(len = 1, wid = 0.35, rise = 0.5, droop = 0.55, seg = 10) { const g = new THREE.PlaneGeometry(wid, len, 1, seg); g.rotateX(-Math.PI / 2); g.translate(0, 0, len / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i) / len; p.setY(i, (rise * z - droop * z * z) * len + Math.abs(p.getX(i)) * 0.15); } g.computeVertexNormals(); return g; }
function leafGeo(w = 0.6, h = 0.7, cup = 0.12) { const g = new THREE.PlaneGeometry(w, h, 4, 4); g.rotateX(-Math.PI / 2.6); g.translate(0, 0, h * 0.35); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + cup * (1 - (2 * p.getX(i) / w) ** 2) - 0.08 * (p.getZ(i) / h) ** 2); g.computeVertexNormals(); return g; }
function blobGeo(seed, detail = 1, amp = 0.22) { const g = new THREE.IcosahedronGeometry(1, detail), n = vnoise(seed), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), k = 1 + (fbm(n, v.x * 2 + 9, v.z * 2 + v.y * 3 + 9, 3) - 0.5) * amp * 2; p.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k); }
  g.computeVertexNormals(); return g; }
function rockGeo(seed) { const g = blobGeo(seed, 2, 0.35), p = g.attributes.position, col = new Float32Array(p.count * 3); g.computeVertexNormals(); const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const up = Math.max(0, nr.getY(i)), m = Math.min(1, up * 1.6); col[i * 3] = 0.42 * (1 - m) + 0.2 * m; col[i * 3 + 1] = 0.41 * (1 - m) + 0.33 * m; col[i * 3 + 2] = 0.38 * (1 - m) + 0.12 * m; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); return g; }
// trunk: a slightly tapered cylinder with buttress fins at the base (rainforest giants)
function trunkGeo(buttress) { const g = new THREE.CylinderGeometry(0.5, 1, 1, 10, 8); g.translate(0, 0.5, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)); let k = 1;
    if (buttress) k += 1.6 * Math.pow(Math.max(0, 1 - y / 0.12), 2) * Math.pow(Math.max(0, Math.cos(a * 5)), 6); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  g.computeVertexNormals(); return g; }
function palmTrunkGeo() { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(t * 1.2) * 0.12, t, 0)); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.035, 7, false); return g; }
function coniferGeo() { const parts = [new THREE.CylinderGeometry(0.05, 0.08, 0.3, 6).translate(0, 0.15, 0)]; for (let i = 0; i < 4; i++) { const h = 0.42 - i * 0.07, r = 0.36 - i * 0.075; parts.push(new THREE.ConeGeometry(r, h, 9, 1).translate(0, 0.25 + i * 0.19 + h / 2, 0)); }
  return merge(parts); }
function cactusGeo() { const c = (r, h) => new THREE.CylinderGeometry(r, r * 1.05, h, 10, 2); const a = c(0.12, 1).translate(0, 0.5, 0), b = c(0.07, 0.35).translate(0.24, 0.62, 0), b2 = c(0.07, 0.18).rotateZ(Math.PI / 2).translate(0.15, 0.45, 0), d = c(0.065, 0.3).translate(-0.22, 0.5, 0), d2 = c(0.065, 0.14).rotateZ(Math.PI / 2).translate(-0.14, 0.35, 0);
  const top = new THREE.SphereGeometry(0.12, 10, 6, 0, 6.3, 0, Math.PI / 2).translate(0, 1, 0); return merge([a, b, b2, d, d2, top]); }
function merge(list) { // minimal BufferGeometry merge (position, normal, uv) for non-indexed + indexed inputs
  const ps = [], ns = [], us = [], idx = []; let off = 0;
  for (const g0 of list) { const g = g0.index ? g0 : g0; const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { ps.push(p.getX(i), p.getY(i), p.getZ(i)); ns.push(n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0); us.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off); off += p.count; g0.dispose(); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(ps, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(ns, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(us, 2)); g.setIndex(idx); return g; }

// ───────────── biomes ─────────────
// sky: zenith / horizon colours · fog: colour + density · light: sun elevation & intensity, ambient · ground painter
export const BIOMES = {
  rainforest: { en: "Rainforest", ar: "غابة مطيرة", sky: ["#5d7f73", "#a9bba6"], fog: ["#7f9884", 0.034], sun: [62, 1.7, "#fff0d0"], hemi: ["#d6ecd6", "#2b3a20", 0.85], wet: 0.35,
    ground: (R) => PAINT.litter(R), groundRough: 0.95, fx: { mist: 0.6, rays: 0.8, leaves: 0.35, rain: 0, fireflies: 0, wind: 0.25 }, sound: "jungle" },
  forest: { en: "Forest", ar: "غابة", sky: ["#6f98c4", "#d5dfe6"], fog: ["#b9c7cf", 0.025], sun: [48, 2.1, "#fff3dc"], hemi: ["#e0ecff", "#3a3325", 0.6], wet: 0,
    ground: (R) => PAINT.ground(R, "#4b5a2c", [500, (R) => hsl(80 + R() * 30, 35, 18 + R() * 14, 0.6), 7]), groundRough: 0.95, fx: { mist: 0.25, rays: 0.4, leaves: 0.15, rain: 0, fireflies: 0, wind: 0.3 }, sound: "forest" },
  snow: { en: "Snowy pines", ar: "صنوبر مثلج", sky: ["#8ba4c2", "#e6ecf2"], fog: ["#dfe6ee", 0.03], sun: [28, 1.8, "#fff4e6"], hemi: ["#eef4ff", "#9aa4b0", 0.9], wet: 0, snow: 1,
    ground: (R) => PAINT.ground(R, "#e9eef4", [300, (R) => hsl(210, 20, 82 + R() * 12, 0.5), 9]), groundRough: 0.7, fx: { mist: 0.15, rays: 0, leaves: 0, rain: 0, fireflies: 0, wind: 0.35, snowfall: 0.6 }, sound: "wind" },
  desert: { en: "Desert", ar: "صحراء", sky: ["#4f86c6", "#f1dcc0"], fog: ["#ecd7b8", 0.012], sun: [55, 2.6, "#fff6e4"], hemi: ["#fff1dc", "#9a6b3c", 0.6], wet: 0,
    ground: (R) => PAINT.ground(R, "#d2a36a", [400, (R) => hsl(32, 45, 50 + R() * 15, 0.35), 6]), groundRough: 0.9, fx: { mist: 0, rays: 0, leaves: 0, rain: 0, fireflies: 0, wind: 0.4 }, sound: "wind" },
  beach: { en: "Beach", ar: "شاطئ", sky: ["#3f8fd2", "#cfe6f2"], fog: ["#cfe3ee", 0.012], sun: [50, 2.4, "#fff6e8"], hemi: ["#e8f6ff", "#b89a6e", 0.7], wet: 0,
    ground: (R) => PAINT.ground(R, "#e3cb98", [400, (R) => hsl(40, 40, 70 + R() * 15, 0.4), 5]), groundRough: 0.85, fx: { mist: 0, rays: 0, leaves: 0, rain: 0, fireflies: 0, wind: 0.45 }, sound: "waves", ocean: true },
  meadow: { en: "Meadow", ar: "مرج", sky: ["#5b95d6", "#dcebf2"], fog: ["#cddde6", 0.015], sun: [45, 2.3, "#fff4dc"], hemi: ["#e6f2ff", "#4a5a2a", 0.7], wet: 0,
    ground: (R) => PAINT.ground(R, "#557a2c", [600, (R) => hsl(85 + R() * 25, 45, 22 + R() * 18, 0.5), 6]), groundRough: 0.95, fx: { mist: 0.1, rays: 0, leaves: 0.1, rain: 0, fireflies: 0, wind: 0.4 }, sound: "meadow" },
  studio: { en: "Showroom", ar: "صالة عرض", sky: ["#2a2d31", "#4a4e54"], fog: ["#3c4045", 0.0], sun: [65, 1.4, "#ffffff"], hemi: ["#ffffff", "#30333a", 0.9], wet: 0,
    ground: (R) => PAINT.ground(R, "#5b5f66", [0, null, 0]), groundRough: 0.28, fx: { mist: 0, rays: 0, leaves: 0, rain: 0, fireflies: 0, wind: 0 }, sound: "" },
};
export const BIOME_IDS = Object.keys(BIOMES);

// ───────────── the world ─────────────
// opts: { biome, size: [w, d] (m, walkable), seed, tier: "low"|"high", U (shared env uniforms) }
export function buildWorld({ biome = "rainforest", size = [5, 5], seed = 7, tier = "high", U }) {
  const B = BIOMES[biome] || BIOMES.rainforest, R = rng(seed * 7919 + biome.length), N = vnoise(seed), hw = size[0] / 2, hd = size[1] / 2;
  const RAD = Math.max(32, Math.max(hw, hd) + 26), q = tier === "low" ? 0.45 : 1, group = new THREE.Group(); group.name = "nooi_world";
  const owned = [], colliders = [], counts = {}; const keep = (o) => { owned.push(o); return o; };
  const outside = (x, z) => Math.max(Math.abs(x) - hw, Math.abs(z) - hd, 0) > 0 ? Math.hypot(Math.max(0, Math.abs(x) - hw), Math.max(0, Math.abs(z) - hd)) : 0;
  // ground height: flat on the plot, gently rolling outside, rising at the far edge so the horizon is hidden
  const hFn = biome === "studio" ? () => 0 : (x, z) => { const o = outside(x, z), r = Math.hypot(x, z), amp = biome === "desert" ? 1.6 : biome === "snow" ? 0.9 : 0.55;
    return (fbm(N, x * 0.08 + 40, z * 0.08 + 40, 4) - 0.5) * 2 * amp * Math.min(1, o / 3) + Math.max(0, r - RAD * 0.72) * (biome === "beach" ? 0.05 : 0.22); };
  const ocean = !!B.ocean, oceanZ = -(hd + 4); // the sea starts a few metres beyond the plot's far edge
  // ground
  { const segs = tier === "low" ? 96 : 160, g = new THREE.PlaneGeometry(RAD * 2, RAD * 2, segs, segs); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); let y = hFn(x, z); if (ocean && z < oceanZ) y -= Math.min(1.2, (oceanZ - z) * 0.12); p.setY(i, y); }
    g.computeVertexNormals(); const gc = B.ground(R), gt = keep(tex(gc, { repeat: biome === "studio" ? 1 : RAD / 2.2 })), nt = keep(tex(normalFrom(gc, biome === "studio" ? 0.2 : 2.4), { srgb: false, repeat: biome === "studio" ? 1 : RAD / 2.2 }));
    const m = keep(new THREE.MeshStandardMaterial({ map: gt, normalMap: nt, normalScale: new THREE.Vector2(0.8, 0.8), roughness: B.groundRough, metalness: biome === "studio" ? 0.1 : 0 })); if (U) applyEnvironmentShaders(m, U, "static");
    const ground = new THREE.Mesh(keep(g), m); ground.name = "ground"; ground.receiveShadow = true; group.add(ground); }
  // instanced helper: n placements → one draw call
  const dummy = new THREE.Object3D(); dummy.rotation.order = "YXZ"; // yaw first, then the plant's own tilt
  function inst(name, geo, mat, list, { shadow = true, foliage = null } = {}) { if (!list.length) return null; keep(geo); keep(mat); if (U) applyEnvironmentShaders(mat, U, foliage || "static");
    const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((t, i) => { dummy.position.set(t[0], t[1], t[2]); dummy.rotation.set(t[4] || 0, t[3] || 0, t[5] || 0); const s = t[6] ?? 1; dummy.scale.set(t[7] ?? s, t[8] ?? s, t[9] ?? s); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.instanceMatrix.needsUpdate = true; m.castShadow = shadow; m.receiveShadow = true; m.name = name; m.frustumCulled = false; group.add(m); counts[name] = list.length; return m; }
  // scatter in the ring around the plot (rejection sampling with spacing)
  function scatter(n, { min = 0.4, max = RAD - 2, gap = 1, near = 0, tries = 30 } = {}) { const pts = []; for (let k = 0; k < n * tries && pts.length < n; k++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * RAD, x = Math.cos(a) * r, z = Math.sin(a) * r, o = outside(x, z); if (o < min || r > max) continue; if (near && o > near) continue;
      if (ocean && z < oceanZ + 1) continue; if (pts.some((p) => (p[0] - x) ** 2 + (p[2] - z) ** 2 < gap * gap)) continue; pts.push([x, hFn(x, z), z]); } return pts; }
  const ring = (area) => Math.round(area * q);
  const bark = (h, l) => { const c = PAINT.bark(R, h, l), t = tex(c, { repeat: 0 }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 6); return keep(t); };
  const mat = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0 }, o));
  const leafMat = (c, o) => mat(Object.assign({ map: keep(tex(c)), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }, o));

  if (biome === "rainforest") {
    // giants with buttress roots and a high, dense canopy (gaps let light shafts through)
    const giants = scatter(ring(42), { min: 1.2, gap: 4.2 }); const gT = [], cT = [];
    for (const p of giants) { const h = 18 + R() * 16, r = 0.35 + R() * 0.45; gT.push([p[0], p[1] - 0.2, p[2], R() * 6.3, 0, 0, 1, r, h, r]); colliders.push({ x: p[0], z: p[2], r: r * 1.6 });
      for (let k = 0; k < 5 + (R() * 4 | 0); k++) { const a = R() * 6.3, d = 1 + R() * 3.5; cT.push([p[0] + Math.cos(a) * d, p[1] + h - 1 + R() * 4, p[2] + Math.sin(a) * d, R() * 6.3, 0, 0, 1, 3 + R() * 3, 1.6 + R() * 1.6, 3 + R() * 3]); } }
    inst("giant_trees", trunkGeo(true), mat({ map: bark(30, 34), roughness: 0.95 }), gT);
    // canopy: a dark inner mass + a leafy shell with see-through edges (alpha-tested leaves), so crowns have real leaf silhouettes
    inst("canopy", blobGeo(seed + 3, 1, 0.3), mat({ map: keep(tex(PAINT.canopy(R, 112, 16), { repeat: 0 })), roughness: 0.9, color: 0x9fbf8f }), cT.map((t) => [t[0], t[1], t[2], t[3], 0, 0, 1, t[7] * 0.82, t[8] * 0.8, t[9] * 0.82]), { shadow: true });
    inst("canopy_leaves", blobGeo(seed + 4, 2, 0.4), leafMat(PAINT.canopy(R, 108, 26, true), { color: 0xc6e2b0, roughness: 0.8 }), cT, { shadow: false, foliage: { height: 3, bend: 0.05 } });
    // mid layer: thin trees with small crowns
    const mids = scatter(ring(70), { min: 0.8, gap: 2.2 }), mT = [], mC = [];
    for (const p of mids) { const h = 5 + R() * 8, r = 0.07 + R() * 0.08; mT.push([p[0], p[1], p[2], R() * 6.3, 0, 0, 1, r, h, r]); mC.push([p[0], p[1] + h, p[2], R() * 6.3, 0, 0, 1, 1 + R() * 1.4, 0.8 + R() * 0.6, 1 + R() * 1.4]); colliders.push({ x: p[0], z: p[2], r: r * 1.5 }); }
    inst("mid_trees", trunkGeo(false), mat({ map: bark(35, 40) }), mT); inst("mid_crowns", blobGeo(seed + 5, 2, 0.4), leafMat(PAINT.canopy(R, 104, 28, true), { color: 0xc8e0b0 }), mC, { foliage: { height: 2, bend: 0.06 } });
    // palms
    const palms = scatter(ring(26), { min: 0.9, gap: 2.6, max: RAD * 0.75 }), pT = [], pF = [];
    for (const p of palms) { const h = 3.5 + R() * 5, ry = R() * 6.3; pT.push([p[0], p[1], p[2], ry, 0, 0, h]); const top = [p[0] + Math.cos(-ry) * Math.sin(1.2) * 0.12 * h, p[1] + h, p[2] + Math.sin(-ry) * Math.sin(1.2) * 0.12 * h];
      const n = 9 + (R() * 4 | 0); for (let k = 0; k < n; k++) pF.push([top[0], top[1], top[2], (k / n) * 6.3 + R() * 0.4, -0.15 + R() * 0.35, 0, 1, 0.9 + R() * 0.3, 1 + R() * 0.5, 2.4 + R() * 1.4]); }
    inst("palm_trunks", palmTrunkGeo(), mat({ map: bark(32, 38) }), pT); inst("palm_fronds", frondGeo(1, 1, 0.55, 0.9), leafMat(PAINT.pinnate(R, 100, 30)), pF, { foliage: { height: 1.6, bend: 0.12, radial: true } });
    // ferns (rosettes) — dense near the plot's edge, a few tucked into its corners
    const ferns = scatter(ring(360), { min: 0.15, gap: 0.55, max: RAD * 0.9 }), fF = [];
    for (const p of ferns) { const n = 6 + (R() * 4 | 0), s = 0.6 + R() * 0.9; for (let k = 0; k < n; k++) fF.push([p[0], p[1], p[2], (k / n) * 6.3 + R() * 0.5, -0.1 + R() * 0.25, 0, 1, s * 0.6, s * 0.8, s]); }
    inst("ferns", frondGeo(1, 0.42, 0.75, 0.75), leafMat(PAINT.pinnate(R, 112, 32)), fF, { shadow: false, foliage: { height: 0.9, bend: 0.08, radial: true } });
    // broad-leaf understory (elephant ears)
    const broad = scatter(ring(150), { min: 0.2, gap: 0.8, max: RAD * 0.8 }), bL = [], bS = [];
    for (const p of broad) { const n = 3 + (R() * 4 | 0), h0 = 0.4 + R() * 0.9; for (let k = 0; k < n; k++) { const a = (k / n) * 6.3 + R() * 0.6, d = 0.12 + R() * 0.12, hh = h0 * (0.7 + R() * 0.5);
        bL.push([p[0] + Math.cos(a) * d, p[1] + hh, p[2] + Math.sin(a) * d, -a + Math.PI / 2, 0, 0, 0.8 + R() * 0.9]); bS.push([p[0] + Math.cos(a) * d * 0.5, p[1], p[2] + Math.sin(a) * d * 0.5, 0, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4, 1, 0.015, hh, 0.015]); } }
    inst("broad_leaves", leafGeo(0.55, 0.7, 0.14), leafMat(PAINT.broad(R, 112, 26), { roughness: 0.55 }), bL, { shadow: false, foliage: { height: 0.5, bend: 0.06 } });
    inst("stems", new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0), mat({ color: 0x4f6b2c }), bS, { shadow: false });
    // lianas hanging from the canopy, rocks & mossy logs
    const vines = []; for (const p of giants.slice(0, Math.round(16 * q))) { const a = R() * 6.3, d = 1.5 + R() * 3, top = new THREE.Vector3(p[0] + Math.cos(a) * d, p[1] + 14 + R() * 8, p[2] + Math.sin(a) * d), bot = new THREE.Vector3(top.x + (R() - 0.5) * 3, hFn(top.x, top.z) + R() * 1.5, top.z + (R() - 0.5) * 3);
      const mid = top.clone().lerp(bot, 0.5).add(new THREE.Vector3((R() - 0.5) * 2, -1.5, (R() - 0.5) * 2)); vines.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(top, mid, bot), 24, 0.025 + R() * 0.03, 5, false)); }
    if (vines.length) { const vmat = keep(mat({ color: 0x4a5a2a })); if (U) applyEnvironmentShaders(vmat, U, "static"); const vm = new THREE.Mesh(keep(merge(vines)), vmat); vm.name = "vines"; vm.castShadow = true; group.add(vm); counts.vines = vines.length; }
    const rocks = scatter(ring(30), { min: 0.3, gap: 1.2 }); inst("rocks", rockGeo(seed + 9), mat({ vertexColors: true, roughness: 0.95 }), rocks.map((p) => [p[0], p[1] - 0.1, p[2], R() * 6.3, 0, 0, 1, 0.25 + R() * 0.7, 0.2 + R() * 0.5, 0.25 + R() * 0.7]));
    const logs = scatter(Math.round(6 * q), { min: 0.6, gap: 3 }); inst("logs", new THREE.CylinderGeometry(1, 1, 1, 9).rotateZ(Math.PI / 2), mat({ map: bark(70, 24) }), logs.map((p) => [p[0], p[1] + 0.18, p[2], R() * 6.3, 0, 0, 1, 2 + R() * 3, 0.2 + R() * 0.12, 0.2 + R() * 0.12]));
    // a few small ferns & seedlings inside the plot's border (you walk through them)
    const inner = []; for (let k = 0; k < Math.round(16 * q); k++) { const side = R() < 0.5, u = (R() * 2 - 1), x = side ? u * hw : (R() < 0.5 ? -1 : 1) * (hw - 0.15), z = side ? (R() < 0.5 ? -1 : 1) * (hd - 0.15) : u * hd; const s = 0.3 + R() * 0.3; for (let j = 0; j < 6; j++) inner.push([x, 0, z, (j / 6) * 6.3, 0, 0, 1, s * 0.6, s * 0.8, s]); }
    inst("plot_ferns", frondGeo(1, 0.42, 0.75, 0.75), leafMat(PAINT.pinnate(R, 118, 34)), inner, { shadow: false, foliage: { height: 0.6, bend: 0.06, radial: true } });
  }
  if (biome === "forest" || biome === "snow") {
    const conifers = scatter(ring(biome === "snow" ? 120 : 90), { min: 0.8, gap: 2 }), cT = [];
    for (const p of conifers) { const h = 5 + R() * 10; cT.push([p[0], p[1], p[2], R() * 6.3, 0, 0, h, h * (0.8 + R() * 0.3), h, h * (0.8 + R() * 0.3)]); colliders.push({ x: p[0], z: p[2], r: 0.25 }); }
    inst("conifers", coniferGeo(), mat({ color: biome === "snow" ? 0x2f4a38 : 0x2c4a2a, roughness: 0.9, flatShading: true }), cT);
    if (biome === "forest") { const birch = scatter(ring(40), { min: 1, gap: 2.5 }), bT = [], bC = [];
      for (const p of birch) { const h = 6 + R() * 6; bT.push([p[0], p[1], p[2], 0, 0, 0, 1, 0.12, h, 0.12]); bC.push([p[0], p[1] + h * 0.85, p[2], R() * 6.3, 0, 0, 1, 1.6 + R(), 2 + R() * 1.4, 1.6 + R()]); }
      inst("birch", trunkGeo(false), mat({ map: bark(40, 82) }), bT); inst("crowns", blobGeo(seed + 4, 1, 0.3), mat({ map: keep(tex(PAINT.canopy(R, 90, 34))), color: 0xd8f0b0 }), bC);
      const ferns = scatter(ring(220), { min: 0.15, gap: 0.6 }), fF = []; for (const p of ferns) { const n = 6, s = 0.5 + R() * 0.6; for (let k = 0; k < n; k++) fF.push([p[0], p[1], p[2], (k / n) * 6.3 + R() * 0.5, 0, 0, 1, s * 0.6, s * 0.8, s]); }
      inst("ferns", frondGeo(1, 0.42, 0.75, 0.75), leafMat(PAINT.pinnate(R, 100, 30)), fF, { shadow: false, foliage: { height: 0.9, bend: 0.08, radial: true } }); }
    const rocks = scatter(ring(34), { min: 0.3, gap: 1.2 }); inst("rocks", rockGeo(seed + 9), mat({ vertexColors: true }), rocks.map((p) => [p[0], p[1] - 0.1, p[2], R() * 6.3, 0, 0, 1, 0.3 + R() * 0.8, 0.25 + R() * 0.6, 0.3 + R() * 0.8]));
  }
  if (biome === "desert") {
    const cacti = scatter(ring(36), { min: 0.8, gap: 3 }); inst("cacti", cactusGeo(), mat({ color: 0x5f7d3a, roughness: 0.7 }), cacti.map((p) => { const h = 1.5 + R() * 3; colliders.push({ x: p[0], z: p[2], r: 0.2 }); return [p[0], p[1], p[2], R() * 6.3, 0, 0, h]; }));
    const rocks = scatter(ring(40), { min: 0.4, gap: 1.6 }); inst("rocks", rockGeo(seed + 2), mat({ color: 0xb5714a, roughness: 0.95 }), rocks.map((p) => [p[0], p[1] - 0.15, p[2], R() * 6.3, 0, 0, 1, 0.4 + R() * 1.4, 0.3 + R() * 1, 0.4 + R() * 1.4]));
    const tufts = scatter(ring(160), { min: 0.2, gap: 0.6 }), gT = []; for (const p of tufts) for (let k = 0; k < 7; k++) gT.push([p[0], p[1], p[2], R() * 6.3, (R() - 0.5) * 0.7, 0, 1, 0.12, 0.25 + R() * 0.2, 1]);
    inst("dry_grass", new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), leafMat(PAINT.grassBlade(R, 42)), gT, { shadow: false, foliage: { height: 0.4, bend: 0.06 } });
  }
  if (biome === "beach") {
    const palms = scatter(ring(22), { min: 1, gap: 3 }), pT = [], pF = [];
    for (const p of palms) { const h = 4 + R() * 4, ry = R() * 6.3; pT.push([p[0], p[1], p[2], ry, 0, 0, h]); const top = [p[0] + Math.cos(-ry) * Math.sin(1.2) * 0.12 * h, p[1] + h, p[2] + Math.sin(-ry) * Math.sin(1.2) * 0.12 * h];
      for (let k = 0; k < 10; k++) pF.push([top[0], top[1], top[2], (k / 10) * 6.3 + R() * 0.3, -0.1 + R() * 0.3, 0, 1, 0.9 + R() * 0.3, 1 + R() * 0.4, 2.6 + R()]); colliders.push({ x: p[0], z: p[2], r: 0.2 }); }
    inst("palm_trunks", palmTrunkGeo(), mat({ map: bark(34, 52) }), pT); inst("palm_fronds", frondGeo(1, 1, 0.55, 0.9), leafMat(PAINT.pinnate(R, 92, 36)), pF, { foliage: { height: 1.6, bend: 0.14, radial: true } });
    const rocks = scatter(ring(14), { min: 0.5, gap: 2 }); inst("rocks", rockGeo(seed + 6), mat({ color: 0x8c8378 }), rocks.map((p) => [p[0], p[1] - 0.1, p[2], R() * 6.3, 0, 0, 1, 0.4 + R(), 0.3 + R() * 0.6, 0.4 + R()]));
  }
  if (biome === "meadow") {
    const blades = [], n = Math.round(9000 * q); for (let k = 0; k < n; k++) { const a = R() * 6.3, r = Math.sqrt(R()) * (RAD * 0.8), x = Math.cos(a) * r, z = Math.sin(a) * r; blades.push([x, hFn(x, z), z, R() * 6.3, (R() - 0.5) * 0.4, 0, 1, 0.06 + R() * 0.05, 0.25 + R() * 0.35, 1]); }
    inst("grass", new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), leafMat(PAINT.grassBlade(R, 92)), blades, { shadow: false, foliage: { height: 0.55, bend: 0.12 } });
    const fl = []; for (let k = 0; k < Math.round(900 * q); k++) { const a = R() * 6.3, r = Math.sqrt(R()) * RAD * 0.7, x = Math.cos(a) * r, z = Math.sin(a) * r; fl.push([x, hFn(x, z) + 0.3 + R() * 0.2, z, R() * 6.3, 0, 0, 0.06 + R() * 0.04]); }
    inst("flowers", new THREE.SphereGeometry(1, 6, 4), mat({ color: 0xf2d24a, emissive: 0x2a2000, roughness: 0.6 }), fl, { shadow: false });
    const trees = scatter(ring(16), { min: 3, gap: 6 }), tT = [], tC = []; for (const p of trees) { const h = 4 + R() * 3; tT.push([p[0], p[1], p[2], 0, 0, 0, 1, 0.22, h, 0.22]); tC.push([p[0], p[1] + h, p[2], R() * 6.3, 0, 0, 1, 2.4 + R(), 2 + R(), 2.4 + R()]); colliders.push({ x: p[0], z: p[2], r: 0.3 }); }
    inst("trees", trunkGeo(false), mat({ map: bark(28, 30) }), tT); inst("crowns", blobGeo(seed + 8, 1, 0.3), mat({ map: keep(tex(PAINT.canopy(R, 96, 30))), color: 0xd0eab0 }), tC);
  }
  if (biome === "studio") { // cyclorama wall + a soft round stage
    const wall = new THREE.Mesh(keep(new THREE.CylinderGeometry(RAD * 0.5, RAD * 0.5, 14, 64, 1, true, 0, Math.PI * 2)), keep(mat({ color: 0x41454b, side: THREE.BackSide, roughness: 1 }))); wall.position.y = 7; wall.name = "cyclorama"; group.add(wall);
    const stage = new THREE.Mesh(keep(new THREE.CylinderGeometry(Math.max(hw, hd) * 1.05, Math.max(hw, hd) * 1.1, 0.12, 64)), keep(mat({ color: 0x1d1f23, roughness: 0.22, metalness: 0.3 }))); stage.position.y = 0.06; stage.receiveShadow = true; stage.name = "stage"; group.add(stage);
  }
  if (ocean) { const og = new THREE.PlaneGeometry(RAD * 2.4, RAD * 1.4, 1, 1); og.rotateX(-Math.PI / 2); og.translate(0, -0.25, oceanZ - RAD * 0.7); const om = new THREE.Mesh(keep(og), keep(mat({ color: 0x1f6f8f, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.92 }))); om.name = "ocean"; group.add(om); }
  // the plot's outline: four low markers at its corners (walk boundary hint)
  const plot = { hw, hd, area: size[0] * size[1] }, info = { biome, size, seed, radius: RAD, counts, instances: Object.values(counts).reduce((a, b) => a + b, 0) };
  return { group, colliders, plot, info, palette: B, height: hFn, dispose() { group.traverse((n) => { if (n.isInstancedMesh && n.dispose) n.dispose(); }); for (const o of owned) { try { o.dispose(); } catch (e) {} } owned.length = 0; group.clear(); } };
}
