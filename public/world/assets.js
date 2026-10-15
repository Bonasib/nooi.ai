// Everything a world holds, modelled in code (nothing to download): low-poly shapes in real sizes, coloured per vertex, so each
// thing is ONE geometry per material and a whole forest is one draw call (instancing). Each model returns its parts by material
// (opaque / shiny / glass / glow / win), its size and a collider for the physics. Origin = the middle of its foot on the ground,
// +z = its front. Variants (v) give each type a few different looks; the world picks them with its seeded random.
import { TYPES } from "./plan.js";

export function makeKit(T) {
  const tmpC = new T.Color(), mat4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), ps = new T.Vector3();
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => mat4.clone().compose(ps.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), sc.set(sx, sy, sz));
  // bake a three geometry: transformed, non-indexed, with a colour per vertex (a function colours each triangle on its own)
  function bake(g, color, m) {
    let gg = g.index ? g.toNonIndexed() : g; g !== gg && g.dispose();
    if (m) gg.applyMatrix4(m);
    for (const k of Object.keys(gg.attributes)) if (k !== "position" && k !== "normal") gg.deleteAttribute(k);
    if (!gg.attributes.normal) gg.computeVertexNormals();
    const n = gg.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const c = typeof color === "function" ? color((i / 3) | 0, gg.attributes.position, i) : color; tmpC.set(c); col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b; }
    gg.setAttribute("color", new T.BufferAttribute(col, 3));
    return gg;
  }
  function merge(list) {
    list = list.filter(Boolean); if (!list.length) return null;
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
    for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
    const out = new T.BufferGeometry(); out.setAttribute("position", new T.BufferAttribute(P, 3)); out.setAttribute("normal", new T.BufferAttribute(N, 3)); out.setAttribute("color", new T.BufferAttribute(C, 3));
    out.computeBoundingBox(); out.computeBoundingSphere(); return out;
  }
  // a model under construction: parts per material
  function Model() {
    const g = { opaque: [], shiny: [], glass: [], glow: [], win: [] };
    const add = (k, geo, color, m) => { g[k].push(bake(geo, color, m)); return api; };
    const api = {
      box: (w, h, d, c, m, k = "opaque") => add(k, new T.BoxGeometry(w, h, d), c, m),
      cyl: (rt, rb, h, seg, c, m, k = "opaque") => add(k, new T.CylinderGeometry(rt, rb, h, seg, 1), c, m),
      cone: (r, h, seg, c, m, k = "opaque") => add(k, new T.ConeGeometry(r, h, seg, 1), c, m),
      ico: (r, det, c, m, k = "opaque", jit = 0, rnd = Math.random) => { const geo = new T.IcosahedronGeometry(r, det); if (jit) { const p = geo.attributes.position, key = new Map(); for (let i = 0; i < p.count; i++) { const id = p.getX(i).toFixed(3) + "," + p.getY(i).toFixed(3) + "," + p.getZ(i).toFixed(3); if (!key.has(id)) key.set(id, 1 + (rnd() - 0.5) * jit); const f = key.get(id); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f); } geo.computeVertexNormals(); } return add(k, geo, c, m); },
      sphere: (r, ws, hs, c, m, k = "opaque", phiL = Math.PI * 2, thetaL = Math.PI) => add(k, new T.SphereGeometry(r, ws, hs, 0, phiL, 0, thetaL), c, m),
      torus: (r, t, rs, ts, c, m, k = "opaque", arc = Math.PI * 2) => add(k, new T.TorusGeometry(r, t, rs, ts, arc), c, m),
      lathe: (pts, seg, c, m, k = "opaque") => add(k, new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), seg), c, m),
      shape: (pts, depth, c, m, k = "opaque", bevel = 0) => { const s = new T.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); const geo = new T.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1 }); geo.translate(0, 0, -depth / 2); return add(k, geo, c, m); },
      prism: (w, h, d, c, m, k = "opaque") => api.shape([[-w / 2, 0], [w / 2, 0], [0, h]], d, c, m, k),   // a gable roof
      plane: (w, h, c, m, k = "opaque") => add(k, new T.PlaneGeometry(w, h), c, m),
      done(size, collider, extra = {}) { const parts = {}; for (const k in g) { const mg = merge(g[k]); if (mg) parts[k] = mg; } return { parts, size, collider, ...extra }; }
    };
    return api;
  }
  return { M, Model, bake, merge };
}

// colour helpers
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const m = (v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))); return "#" + ((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1); };
const pickc = (rnd, list) => list[Math.floor(rnd() * list.length) % list.length];
export const PALETTE = {
  leaf: ["#4f8a3b", "#5b9a44", "#447c35", "#679f4b"], pine: ["#2f6b3c", "#2a5e37", "#367443"], palm: ["#5f9440", "#6aa046", "#55873a"], dry: ["#8d8d58", "#9a9460", "#7f8452"],
  trunk: ["#6b4a2f", "#5e4029", "#7a5636"], rock: ["#8b8780", "#7d7a74", "#96918a", "#857f76"], red: ["#9c4a32", "#8a3f2c", "#a85a3c"], wall: ["#ece6da", "#e3dccd", "#f2eee6", "#d9d2c3"],
  car: ["#d63a32", "#f4f4f0", "#1d1f22", "#2f6fd6", "#8a9097", "#3e7a52", "#c9a54a", "#5a2f80"], cloth: ["#c0392b", "#2980b9", "#27ae60", "#f39c12", "#8e44ad", "#16a085", "#d35400"],
  flower: ["#e74c5b", "#f6c945", "#f4f1ea", "#a66fd6", "#ff8fb4", "#ff9d3a"], coral: ["#ff7f6e", "#ff9fc4", "#ffb347", "#b98cff", "#ff6f91"], mud: ["#c69c6d", "#bf9465", "#cfa776", "#b98c5d"]
};

// ---------- the models ----------
export function buildModel(T, K, type, v = 0, opt = {}) {
  const rnd = opt.rnd || Math.random, m = K.Model(), { M } = K, c1 = opt.color, c2 = opt.color2, det = opt.low ? 0 : 1;
  const S = (TYPES[type] || TYPES.box).s;
  const box = (w, h, d) => ({ shape: "box", hx: w / 2, hy: h / 2, hz: d / 2, y: h / 2 });
  const cyl = (r, h) => ({ shape: "cyl", r, hy: h / 2, y: h / 2 });
  switch (type) {
    // ----- plants -----
    case "tree": { const h = 2.6 + v * 0.5, tr = pickc(rnd, PALETTE.trunk);
      m.cyl(0.16, 0.3, h, 7, tr, M(0, h / 2, 0, (rnd() - 0.5) * 0.08, 0, (rnd() - 0.5) * 0.08));
      m.cyl(0.07, 0.12, 1.4, 5, tr, M(0.45, h - 0.2, 0, 0, 0, -0.7)); m.cyl(0.06, 0.11, 1.2, 5, tr, M(-0.4, h - 0.1, 0.2, 0.3, 0, 0.75));
      const leaf = c1 || pickc(rnd, PALETTE.leaf), n = 4 + (v % 2);
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + rnd(), r = i === 0 ? 0 : 0.9 + rnd() * 0.5, s = i === 0 ? 1.9 : 1.2 + rnd() * 0.5; m.ico(s, det, i % 2 ? leaf : shade(leaf, 0.88), M(Math.cos(a) * r, h + 1.2 + (i === 0 ? 0.5 : rnd() * 0.8), Math.sin(a) * r), "opaque", 0.22, rnd); }
      return m.done([5, h + 3.6, 5], { ...cyl(0.3, h + 1), trunk: 1 }, { sway: 1 }); }
    case "pine": { const tr = pickc(rnd, PALETTE.trunk), g = c1 || pickc(rnd, PALETTE.pine), snow = opt.snow;
      m.cyl(0.18, 0.28, 2.6, 6, tr, M(0, 1.3, 0)); const tiers = 4 + (v % 2);
      for (let i = 0; i < tiers; i++) { const r = 2.3 - i * 0.42, y = 2 + i * 1.55; m.cone(r, 2.8, 8, i % 2 ? g : shade(g, 1.08), M(0, y + 1.4, 0, 0, rnd(), 0)); if (snow) m.cone(r * 0.62, 1.05, 8, "#f3f7fa", M(0, y + 2.25, 0, 0, rnd(), 0)); }
      return m.done([4.6, 2 + tiers * 1.55 + 2.4, 4.6], { ...cyl(0.3, 8), trunk: 1 }, { sway: 0.6 }); }
    case "palm": { const tr = "#8b6b46", seg = 7, lean = 0.06 + rnd() * 0.1, dir = rnd() * 6.28; let x = 0, y = 0, z = 0;
      for (let i = 0; i < seg; i++) { const hh = 1.15, ang = lean * i; const nx = x + Math.cos(dir) * Math.sin(ang) * hh, ny = y + Math.cos(ang) * hh, nz = z + Math.sin(dir) * Math.sin(ang) * hh;
        m.cyl(0.2 - i * 0.012, 0.24 - i * 0.012, hh * 1.05, 7, i % 2 ? tr : shade(tr, 0.86), M((x + nx) / 2, (y + ny) / 2, (z + nz) / 2, Math.sin(dir) * ang, 0, -Math.cos(dir) * ang)); x = nx; y = ny; z = nz; }
      // drooping fronds: each one is four flat tapering segments bending down along an arc
      const g = c1 || pickc(rnd, PALETTE.palm), fr = 9;
      for (let i = 0; i < fr; i++) { const a = (i / fr) * 6.28 + rnd() * 0.35, ca = Math.cos(a), sa = Math.sin(a), lift = 0.35 + rnd() * 0.35; let fx = x, fy = y, fz = z, pitch = lift;
        for (let k = 0; k < 4; k++) { const L = 0.95 - k * 0.08, w = (0.62 - k * 0.12) * (k === 0 ? 0.8 : 1), mx = fx + ca * Math.cos(pitch) * L / 2, my = fy + Math.sin(pitch) * L / 2, mz = fz + sa * Math.cos(pitch) * L / 2;
          m.box(L, 0.04, w, i % 2 ? g : shade(g, 0.86), M(mx, my, mz).multiply(new T.Matrix4().makeRotationY(-a)).multiply(new T.Matrix4().makeRotationZ(pitch)));
          fx += ca * Math.cos(pitch) * L; fy += Math.sin(pitch) * L; fz += sa * Math.cos(pitch) * L; pitch -= 0.42 + rnd() * 0.1; } }
      for (let i = 0; i < 4; i++) m.ico(0.17, 0, "#6b4a24", M(x + Math.cos(i * 1.6) * 0.25, y - 0.35, z + Math.sin(i * 1.6) * 0.25));
      return m.done([4.5, y + 1.2, 4.5], { ...cyl(0.26, y), trunk: 1 }, { sway: 0.9 }); }
    case "ghaf": { const tr = "#6e5236", g = c1 || "#71894a";
      m.cyl(0.22, 0.32, 1.8, 7, tr, M(0, 0.9, 0)); m.cyl(0.1, 0.18, 2, 6, tr, M(0.55, 2.2, 0, 0, 0, -0.55)); m.cyl(0.1, 0.18, 2, 6, tr, M(-0.5, 2.2, 0.2, 0.25, 0, 0.6));
      for (let i = 0; i < 5; i++) { const a = i * 1.25 + rnd(); m.ico(1.6 + rnd() * 0.6, det, i % 2 ? g : shade(g, 0.9), M(Math.cos(a) * 1.4, 3.6 + rnd() * 0.4, Math.sin(a) * 1.4, 0, 0, 0, 1.25, 0.42, 1.25), "opaque", 0.2, rnd); }
      return m.done([6.4, 4.6, 6.4], { ...cyl(0.32, 3), trunk: 1 }, { sway: 0.5 }); }
    case "bush": { const g = c1 || pickc(rnd, PALETTE.leaf); for (let i = 0; i < 3; i++) m.ico(0.65 + rnd() * 0.3, det, i % 2 ? g : shade(g, 0.85), M((rnd() - 0.5) * 0.9, 0.55, (rnd() - 0.5) * 0.9), "opaque", 0.25, rnd);
      return m.done([1.8, 1.2, 1.8], null, { sway: 0.4 }); }
    case "shrub": { const g = c1 || pickc(rnd, PALETTE.dry); for (let i = 0; i < 3; i++) m.ico(0.35 + rnd() * 0.2, 0, i % 2 ? g : shade(g, 0.8), M((rnd() - 0.5) * 0.6, 0.25, (rnd() - 0.5) * 0.6, 0, 0, 0, 1, 0.7, 1), "opaque", 0.35, rnd);
      return m.done([1, 0.6, 1], null); }
    case "flowers": { for (let i = 0; i < 7; i++) { const x = (rnd() - 0.5) * 0.9, z = (rnd() - 0.5) * 0.9, h = 0.22 + rnd() * 0.2; m.cyl(0.012, 0.015, h, 3, "#4f8a3b", M(x, h / 2, z)); m.ico(0.06, 0, c1 || pickc(rnd, PALETTE.flower), M(x, h + 0.03, z)); }
      return m.done([1, 0.4, 1], null); }
    case "fern": { const g = c1 || "#4d8a3a"; for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; m.cone(0.16, 1.1, 3, i % 2 ? g : shade(g, 0.85), M(Math.cos(a) * 0.35, 0.35, Math.sin(a) * 0.35).multiply(new T.Matrix4().makeRotationY(-a)).multiply(new T.Matrix4().makeRotationZ(-1.05)).multiply(new T.Matrix4().makeScale(1, 1, 0.25))); }
      return m.done([1.2, 0.8, 1.2], null, { sway: 0.4 }); }
    case "reeds": { for (let i = 0; i < 8; i++) { const h = 0.9 + rnd() * 0.7; m.cone(0.035, h, 3, i % 3 ? "#7f9a4c" : "#a7955a", M((rnd() - 0.5) * 0.7, h / 2, (rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2)); }
      return m.done([1, 1.4, 1], null, { sway: 0.8 }); }
    case "cactus": { const g = c1 || "#4f7f3f"; m.cyl(0.26, 0.3, 2.8, 8, g, M(0, 1.4, 0)); m.sphere(0.26, 8, 4, g, M(0, 2.8, 0), "opaque", Math.PI * 2, Math.PI / 2);
      m.cyl(0.16, 0.16, 0.7, 7, g, M(0.42, 1.3, 0, 0, 0, 1.57)); m.cyl(0.15, 0.16, 0.9, 7, g, M(0.74, 1.72, 0)); m.cyl(0.15, 0.15, 0.55, 7, g, M(-0.38, 1.0, 0, 0, 0, 1.57)); m.cyl(0.14, 0.15, 0.7, 7, g, M(-0.62, 1.32, 0));
      return m.done([1.4, 3, 0.6], cyl(0.3, 3)); }
    case "mushroom": { m.cyl(0.05, 0.07, 0.28, 6, "#f1ece0", M(0, 0.14, 0)); m.sphere(0.16, 8, 4, c1 || "#c2362f", M(0, 0.27, 0), "opaque", Math.PI * 2, Math.PI / 2); return m.done([0.35, 0.4, 0.35], null); }
    case "crops": { const c = c1 || (v % 2 ? "#d8b85a" : "#7aa84a"); for (let r = 0; r < 6; r++) for (let k = 0; k < 9; k++) m.cone(0.16, 0.9, 4, k % 2 ? c : shade(c, 0.9), M(-2.6 + k * 0.65, 0.45, -1.6 + r * 0.64)); return m.done([6, 0.9, 4], null, { sway: 0.5 }); }
    case "coral": { const c = c1 || pickc(rnd, PALETTE.coral); for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, t = 0.3 + rnd() * 0.5; m.cyl(0.04, 0.1, 0.8 + rnd() * 0.5, 5, i % 2 ? c : shade(c, 0.85), M(Math.cos(a) * 0.2, 0.45, Math.sin(a) * 0.2, Math.cos(a) * t, 0, Math.sin(a) * t)); m.ico(0.1, 0, shade(c, 1.15), M(Math.cos(a) * 0.45, 0.9, Math.sin(a) * 0.45)); }
      return m.done([1.2, 1, 1.2], null); }
    case "seaweed": { for (let i = 0; i < 4; i++) { const h = 1.4 + rnd(); m.cone(0.07, h, 4, i % 2 ? "#3f7a4a" : "#5b8a3c", M((rnd() - 0.5) * 0.4, h / 2, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3)); } return m.done([0.5, 2, 0.5], null, { sway: 1.2 }); }
    case "log": { m.cyl(0.3, 0.3, 4, 8, "#6b4a2f", M(0, 0.3, 0, 0, 0, Math.PI / 2)); m.cyl(0.29, 0.29, 0.02, 8, "#c79a63", M(2.0, 0.3, 0, 0, 0, Math.PI / 2)); m.cyl(0.29, 0.29, 0.02, 8, "#c79a63", M(-2.0, 0.3, 0, 0, 0, Math.PI / 2));
      return m.done([4, 0.6, 0.6], { shape: "cyl", r: 0.3, hy: 2, y: 0.3, rz: Math.PI / 2 }); }
    case "rock": case "boulder": { const big = type === "boulder", r = big ? 1.7 : 0.62, c = c1 || pickc(rnd, PALETTE.rock);
      m.ico(r, big ? det : 0, c, M(0, r * 0.55, 0, rnd(), rnd(), rnd(), 1.1, 0.75, 1), "opaque", 0.38, rnd); if (big) m.ico(r * 0.55, 0, shade(c, 0.9), M(r * 0.8, r * 0.3, r * 0.2, rnd(), rnd(), 0), "opaque", 0.4, rnd);
      return m.done(big ? [4, 2.6, 3.6] : [1.4, 0.95, 1.2], { shape: "ball", r: r * 0.85, y: r * 0.5 }); }
    case "crystal": { const c = c1 || (v % 2 ? "#9b7bff" : "#6fe0f2"); for (let i = 0; i < 5; i++) { const a = i * 1.3, h = 1.2 + rnd() * 1.4; m.cone(0.22, h, 4, c, M(Math.cos(a) * 0.25, h / 2, Math.sin(a) * 0.25, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), "glass"); m.cone(0.08, h * 0.6, 4, shade(c, 1.4), M(Math.cos(a) * 0.25, h * 0.35, Math.sin(a) * 0.25, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), "glow"); }
      return m.done([1.2, 2.6, 1.2], cyl(0.5, 2.4), { light: { color: c, power: 0.6, y: 1.2 } }); }
    // ----- buildings -----
    case "house": { const w = 8, d = 7, h = 4.6, wall = c1 || pickc(rnd, PALETTE.wall), roof = c2 || pickc(rnd, PALETTE.red);
      m.box(w + 0.4, 1.2, d + 0.4, "#8f8a80", M(0, -0.3, 0)); m.box(w, h, d, wall, M(0, h / 2, 0));
      m.prism(w + 1.2, 2.6, d + 1.0, roof, M(0, h, 0, 0, Math.PI / 2, 0, (d + 1.0) / (w + 1.2), 1, (w + 1.2) / (d + 1.0)));
      m.box(1.1, 2.1, 0.12, "#5e4029", M(0, 1.05, d / 2 + 0.03)); m.box(0.7, 2.2, 0.7, shade(wall, 0.8), M(w * 0.28, h + 1.7, -d * 0.15));
      for (const [x, z, ry] of [[-2.5, d / 2 + 0.04, 0], [2.5, d / 2 + 0.04, 0], [-2.5, -d / 2 - 0.04, 0], [2.5, -d / 2 - 0.04, 0], [w / 2 + 0.04, 0, Math.PI / 2], [-w / 2 - 0.04, 0, Math.PI / 2]]) { m.box(1.3, 1.2, 0.08, "#c8d4dc", M(x, 2.7, z, 0, ry, 0), "win"); m.box(1.5, 0.14, 0.14, "#ffffff", M(x, 2.03, z, 0, ry, 0)); }
      return m.done([w + 1.2, h + 2.6, d + 1], box(w, h + 1.6, d), { foundation: 1 }); }
    case "cabin": { const w = 6.5, d = 5.5, h = 3.2, wood = c1 || "#7a5432", roof = c2 || "#3b4a3a";
      m.box(w + 0.3, 0.8, d + 0.3, "#6d665c", M(0, -0.2, 0)); for (let i = 0; i < 6; i++) m.box(w, 0.55, d, i % 2 ? wood : shade(wood, 0.88), M(0, 0.28 + i * 0.53, 0));
      m.prism(w + 1.4, 2.8, d + 1.2, roof, M(0, h, 0, 0, Math.PI / 2, 0, (d + 1.2) / (w + 1.4), 1, (w + 1.4) / (d + 1.2))); if (opt.snow) m.prism(w + 1.5, 0.6, d + 1.3, "#f3f7fa", M(0, h + 2.25, 0, 0, Math.PI / 2, 0, 0.9, 1, 1.1));
      m.box(1, 2, 0.1, "#3e2a18", M(-1.4, 1, d / 2 + 0.03)); m.box(1.2, 1, 0.08, "#c8d4dc", M(1.4, 1.7, d / 2 + 0.04), "win"); m.box(0.8, 2.6, 0.8, "#6d665c", M(w / 2 - 0.6, h + 1.2, -1));
      return m.done([w + 1.4, h + 2.8, d + 1.2], box(w, h + 1.4, d), { foundation: 1 }); }
    case "villa": { const wall = c1 || "#eeece6", acc = c2 || "#6b5a48";
      m.box(17, 0.8, 13, "#bdb8ae", M(0, -0.2, 0)); m.box(16, 3.6, 12, wall, M(0, 1.8, 0)); m.box(10, 3.2, 8, wall, M(-2.5, 5.2, -1.5)); m.box(16.6, 0.3, 12.6, acc, M(0, 3.75, 0)); m.box(10.6, 0.3, 8.6, acc, M(-2.5, 6.95, -1.5));
      m.box(7, 2.6, 0.1, "#9fc3d6", M(3.5, 1.7, 6.03), "glass"); m.box(5, 2.2, 0.1, "#9fc3d6", M(-2.5, 5.2, 2.53), "glass"); m.box(1.4, 2.6, 0.12, acc, M(-3, 1.3, 6.04));
      for (let i = 0; i < 3; i++) m.box(1.6, 1.1, 0.08, "#c8d4dc", M(-6.5 + i * 2.2, 2.2, 6.04), "win");
      return m.done([16, 7.2, 12], box(16, 7, 12), { foundation: 1 }); }
    case "najdi": { const w = 9 + v, d = 9, h = 5.4, mud = c1 || pickc(rnd, PALETTE.mud), dark = shade(mud, 0.72);
      m.box(w + 0.4, 1, d + 0.4, shade(mud, 0.85), M(0, -0.3, 0)); m.box(w, h, d, mud, M(0, h / 2, 0)); m.box(w + 0.2, 0.35, d + 0.2, shade(mud, 0.92), M(0, h - 1.2, 0));
      // the stepped triangle crenellations along the parapet
      for (let i = 0; i < Math.round(w / 1.1); i++) for (const z of [d / 2 - 0.15, -d / 2 + 0.15]) m.shape([[-0.42, 0], [0.42, 0], [0.42, 0.25], [0.2, 0.25], [0.2, 0.5], [0, 0.75], [-0.2, 0.5], [-0.2, 0.25], [-0.42, 0.25]], 0.3, mud, M(-w / 2 + 0.55 + i * 1.1, h, z));
      for (let i = 0; i < Math.round(d / 1.1); i++) for (const x of [w / 2 - 0.15, -w / 2 + 0.15]) m.shape([[-0.42, 0], [0.42, 0], [0.42, 0.25], [0.2, 0.25], [0.2, 0.5], [0, 0.75], [-0.2, 0.5], [-0.2, 0.25], [-0.42, 0.25]], 0.3, mud, M(x, h, -d / 2 + 0.55 + i * 1.1, 0, Math.PI / 2, 0));
      // a second floor block, triangle vents, a carved wooden door, wooden water spouts
      if (v % 2 === 0) m.box(w * 0.45, 3, d * 0.5, mud, M(w * 0.2, h + 1.5, -d * 0.18));
      for (let i = 0; i < 4; i++) m.shape([[-0.18, 0], [0.18, 0], [0, 0.32]], 0.1, dark, M(-w / 2 + 1.4 + i * (w - 2.8) / 3, h - 2.1, d / 2 + 0.03));
      m.box(1.4, 2.4, 0.15, "#7a5434", M(-1.2, 1.2, d / 2 + 0.05)); m.box(1.2, 0.16, 0.18, "#a87b4f", M(-1.2, 1.7, d / 2 + 0.1)); m.box(0.9, 1.1, 0.1, "#2c241c", M(2.4, 2.6, d / 2 + 0.04), "win");
      for (const x of [-w / 2 + 1, w / 2 - 1]) m.cyl(0.07, 0.07, 0.9, 5, "#6b4a2f", M(x, h - 0.5, d / 2 + 0.4, Math.PI / 2, 0, 0));
      return m.done([w, h + 3.2, d], box(w, h + 0.6, d), { foundation: 1 }); }
    case "tower": { const w = 14 + v * 2, h = 46 + v * 12, gc = c1 || (v % 2 ? "#7fa6c4" : "#5f86a6"), fr = c2 || "#2b3238";
      m.box(w + 1, 1.2, w + 1, "#6f7479", M(0, 0.3, 0)); m.box(w, h, w, gc, M(0, h / 2, 0), "glass"); m.box(w - 0.6, h - 0.4, w - 0.6, shade(gc, 0.45), M(0, h / 2, 0));
      for (let y = 4; y < h; y += 4) m.box(w + 0.1, 0.35, w + 0.1, fr, M(0, y, 0)); for (const s of [-1, 1]) for (const t of [-1, 1]) m.box(0.5, h, 0.5, fr, M(s * w / 2, h / 2, t * w / 2));
      m.box(w * 0.6, 3, w * 0.6, fr, M(0, h + 1.5, 0)); m.cyl(0.15, 0.15, 6, 5, "#c9ced3", M(0, h + 6, 0)); m.ico(0.25, 0, "#ff4040", M(0, h + 9, 0), "glow");
      for (let y = 6; y < h - 2; y += 8) for (const [x, z, ry] of [[0, w / 2 + 0.06, 0], [0, -w / 2 - 0.06, 0], [w / 2 + 0.06, 0, Math.PI / 2], [-w / 2 - 0.06, 0, Math.PI / 2]]) m.box(w * 0.82, 2.4, 0.06, "#cfd8e0", M(x, y, z, 0, ry, 0), "win");
      return m.done([w, h + 9, w], box(w, h + 3, w), { foundation: 1 }); }
    case "shop": { const w = 8, d = 7, h = 4.6, wall = c1 || pickc(rnd, PALETTE.wall), aw = c2 || pickc(rnd, PALETTE.cloth);
      m.box(w + 0.3, 0.8, d + 0.3, "#8f8a80", M(0, -0.2, 0)); m.box(w, h, d, wall, M(0, h / 2, 0)); m.box(w + 0.2, 0.4, d + 0.2, shade(wall, 0.8), M(0, h + 0.2, 0));
      m.box(5.6, 2.4, 0.08, "#a9c4d4", M(-0.6, 1.6, d / 2 + 0.04), "glass"); m.box(1, 2.3, 0.1, "#3e2a18", M(3.1, 1.15, d / 2 + 0.05));
      for (let i = 0; i < 6; i++) m.box(w / 6, 0.12, 1.6, i % 2 ? aw : "#f4f1ea", M(-w / 2 + w / 12 + i * (w / 6), 3.25, d / 2 + 0.7, 0.32, 0, 0));
      m.box(4, 0.8, 0.1, shade(aw, 0.8), M(0, 3.9, d / 2 + 0.05)); m.box(5.4, 2.2, 0.06, "#e8d9b6", M(-0.6, 1.6, d / 2 + 0.02), "win");
      return m.done([w, h + 0.4, d + 1.4], box(w, h, d), { foundation: 1 }); }
    case "tent": { const bed = opt.place === "desert" || opt.place === "oasis" || opt.place === "village" || v % 2;
      if (bed) { const cl = c1 || "#2b2622"; m.box(7, 0.12, 5, "#8e2f2a", M(0, 0.06, 0)); for (const x of [-3, 0, 3]) for (const z of [-2, 2]) m.cyl(0.05, 0.05, 2.4, 5, "#6b4a2f", M(x, 1.2, z));
        m.shape([[-3.6, 0], [3.6, 0], [3.2, 0.5], [0, 0.85], [-3.2, 0.5]], 5.4, cl, M(0, 2.3, 0)); for (let i = 0; i < 3; i++) m.box(7.3, 0.08, 0.06, "#e9e2d0", M(0, 2.66 + i * 0.001, -1.6 + i * 1.6));
        m.box(7, 1.9, 0.06, cl, M(0, 1.35, -2.5)); m.box(5.6, 0.25, 0.7, "#a3352e", M(0, 0.2, -1.8)); for (let i = 0; i < 4; i++) m.box(0.5, 0.45, 0.25, "#7d2a24", M(-2.1 + i * 1.4, 0.45, -2.15));
        return m.done([7.2, 3.2, 5.4], box(7, 2.6, 5)); }
      const cl = c1 || pickc(rnd, ["#e07b39", "#3f8f5b", "#d9c26a", "#4b7bbf"]); m.prism(3.6, 2.4, 4.4, cl, M(0, 0, 0)); m.prism(1.6, 1.2, 0.05, shade(cl, 0.5), M(0, 0, 2.21));
      return m.done([3.6, 2.4, 4.4], box(3.6, 2.4, 4.4)); }
    case "mosque": { const wall = c1 || "#efe9dc", dome = c2 || (v % 2 ? "#3f8f6a" : "#e4d8b8"), sz = 16;
      m.box(sz + 1, 1, sz + 1, "#c9c1b0", M(0, -0.2, 0)); m.box(sz, 7, sz, wall, M(0, 3.5, 0)); m.box(sz + 0.3, 0.5, sz + 0.3, shade(wall, 0.9), M(0, 7.2, 0));
      m.cyl(4.2, 4.6, 1.2, 16, wall, M(0, 8, 0)); m.sphere(4.3, 18, 9, dome, M(0, 8.5, 0), "opaque", Math.PI * 2, Math.PI / 2); m.cyl(0.08, 0.08, 1.6, 5, "#d4a63a", M(0, 13.6, 0), "shiny"); m.torus(0.35, 0.06, 5, 12, "#d4a63a", M(0, 14.6, 0, 0, 0, 0, 1, 1, 1), "shiny", Math.PI * 1.6);
      for (let i = -1; i <= 1; i++) m.shape([[-1, 0], [1, 0], [1, 2.6], [0.6, 3.4], [0, 3.7], [-0.6, 3.4], [-1, 2.6]], 0.2, i ? "#7a6a52" : "#4a3a28", M(i * 4, 0.1, sz / 2 + 0.05), i ? "win" : "opaque");
      const mx = sz / 2 + 1.5; m.cyl(1.1, 1.3, 20, 10, wall, M(mx, 10, -sz / 2 + 1)); m.cyl(1.6, 1.6, 0.4, 12, shade(wall, 0.85), M(mx, 16, -sz / 2 + 1)); m.cyl(0.85, 0.95, 3, 10, wall, M(mx, 21.5, -sz / 2 + 1));
      m.sphere(0.95, 10, 5, dome, M(mx, 23, -sz / 2 + 1), "opaque", Math.PI * 2, Math.PI / 2); m.cyl(0.04, 0.04, 1, 4, "#d4a63a", M(mx, 24.4, -sz / 2 + 1), "shiny");
      for (let i = 0; i < 6; i++) m.box(0.6, 0.6, 0.06, "#f6e3a8", M(mx + Math.cos(i) * 0.2, 13 + i * 1.2, -sz / 2 + 1 + 1.15), "win");
      return m.done([sz + 3, 25, sz], box(sz, 13, sz), { foundation: 1, light: { color: "#ffe7b0", power: 1, y: 10 } }); }
    case "castle": { const wall = c1 || "#b9ad97", sz = 22, h = 8;
      for (const [x, z, ry] of [[0, sz / 2, 0], [0, -sz / 2, 0], [sz / 2, 0, Math.PI / 2], [-sz / 2, 0, Math.PI / 2]]) { m.box(sz, h, 1.6, wall, M(x, h / 2, z, 0, ry, 0)); for (let i = 0; i < 9; i++) m.box(1.1, 1.1, 1.7, shade(wall, 0.93), M(x + (ry ? 0 : -sz / 2 + 1.5 + i * 2.4), h + 0.55, z + (ry ? -sz / 2 + 1.5 + i * 2.4 : 0), 0, ry, 0)); }
      for (const s of [-1, 1]) for (const t of [-1, 1]) { m.cyl(2.4, 2.6, h + 4, 10, shade(wall, 0.95), M(s * sz / 2, (h + 4) / 2, t * sz / 2)); m.cone(3, 3.6, 10, c2 || "#7a3b2e", M(s * sz / 2, h + 5.8, t * sz / 2)); }
      m.shape([[-1.8, 0], [1.8, 0], [1.8, 3.4], [0, 4.6], [-1.8, 3.4]], 0.4, "#3a2a1c", M(0, 0, sz / 2 + 0.6));
      return m.done([sz + 5, h + 8, sz + 5], box(sz, h, sz), { foundation: 1, hollow: 1 }); }
    case "lighthouse": { m.cyl(3, 3.4, 1.2, 12, "#9c9488", M(0, 0.6, 0)); for (let i = 0; i < 6; i++) m.cyl(1.9 - i * 0.12, 2.0 - i * 0.12, 2.8, 12, i % 2 ? "#c9302c" : "#f4f1ea", M(0, 2.6 + i * 2.8, 0));
      m.cyl(1.6, 1.6, 0.3, 12, "#2b3238", M(0, 19.2, 0)); m.cyl(1.0, 1.0, 1.6, 10, "#fff6c8", M(0, 20.2, 0), "glow"); m.cone(1.3, 1.4, 10, "#c9302c", M(0, 21.7, 0));
      return m.done([4, 22.4, 4], cyl(2, 21), { light: { color: "#fff2c0", power: 2.2, y: 20.2, beam: 1 } }); }
    case "barn": { const red = c1 || "#a8392b", w = 11, d = 8.5;
      m.box(w, 5, d, red, M(0, 2.5, 0)); m.shape([[-w / 2 - 0.4, 0], [w / 2 + 0.4, 0], [w / 2 - 1.2, 2.2], [0, 3.3], [-w / 2 + 1.2, 2.2]], d + 0.6, "#5c3a2a", M(0, 5, 0));
      m.box(3.4, 3.6, 0.15, "#f4f1ea", M(0, 1.8, d / 2 + 0.05)); m.box(3.0, 3.2, 0.12, shade(red, 0.8), M(0, 1.7, d / 2 + 0.1)); m.box(0.12, 3.2, 0.16, "#f4f1ea", M(0, 1.7, d / 2 + 0.14, 0, 0, 0.75));
      return m.done([w + 0.8, 8.3, d + 0.6], box(w, 6, d), { foundation: 1 }); }
    case "windmill": { const c = c1 || "#e9e2d2"; m.cyl(1.4, 2.6, 10, 8, c, M(0, 5, 0)); m.cone(2.0, 2.4, 8, "#5c3a2a", M(0, 11.2, 0)); m.box(0.9, 1.8, 0.1, "#3e2a18", M(0, 0.9, 2.45));
      return m.done([6, 14, 6], cyl(2.4, 10), { sails: { y: 9.6, z: 2.2, len: 5.6, color: "#d8cfbf" } }); }
    case "dome": { const c = c1 || "#e8e4da"; m.cyl(6, 6.2, 3, 20, c, M(0, 1.5, 0)); m.sphere(6, 20, 10, c2 || "#d8d2c4", M(0, 3, 0), "opaque", Math.PI * 2, Math.PI / 2); m.shape([[-1.2, 0], [1.2, 0], [1.2, 2.2], [0, 3], [-1.2, 2.2]], 0.3, "#3a3a3a", M(0, 0, 6.05));
      return m.done([12.4, 9, 12.4], cyl(6, 7), { foundation: 1 }); }
    case "ruins": { const c = c1 || "#cdbf9f"; m.box(10, 0.6, 8, shade(c, 0.9), M(0, 0.3, 0)); for (let i = 0; i < 6; i++) { const h = 1 + rnd() * 4.5; m.cyl(0.42, 0.46, h, 10, c, M(-4 + (i % 3) * 4, 0.6 + h / 2, i < 3 ? -3 : 3)); }
      m.box(5, 0.6, 1, c, M(-2, 5.9, -3)); for (let i = 0; i < 4; i++) m.box(1 + rnd(), 0.6, 0.8, shade(c, 0.9), M((rnd() - 0.5) * 8, 0.9, (rnd() - 0.5) * 6, 0, rnd() * 3, 0.2));
      return m.done([10, 6.2, 8], { shape: "box", hx: 5, hy: 0.3, hz: 4, y: 0.3 }); }
    case "pyramid": { const c = c1 || "#d9bf86"; m.cone(17, 16, 4, (i) => (Math.floor(i / 2) % 2 ? c : shade(c, 0.9)), M(0, 8, 0, 0, Math.PI / 4, 0)); return m.done([24, 16, 24], box(18, 10, 18)); }
    // ----- structures & street -----
    case "bridge": { const wd = c1 || "#8a6440"; m.box(14, 0.4, 3.6, wd, M(0, 1.6, 0)); for (const z of [-1.7, 1.7]) { m.box(14, 0.12, 0.12, shade(wd, 0.8), M(0, 2.6, z)); for (let i = 0; i < 8; i++) m.box(0.12, 1, 0.12, shade(wd, 0.8), M(-6.8 + i * 1.94, 2.1, z)); }
      for (const x of [-5, 0, 5]) m.box(0.5, 2, 0.5, "#6d665c", M(x, 0.6, 0)); return m.done([14, 2.7, 3.6], { shape: "box", hx: 7, hy: 0.2, hz: 1.8, y: 1.6 }); }
    case "wall": { const c = c1 || "#b9ad97"; m.box(10, 2.5, 0.6, c, M(0, 1.25, 0)); m.box(10.2, 0.25, 0.8, shade(c, 0.9), M(0, 2.6, 0)); return m.done([10, 2.7, 0.8], box(10, 2.7, 0.6)); }
    case "gate": case "arch": { const c = c1 || "#c9b48c"; m.box(1.2, 5, 1.2, c, M(-2.4, 2.5, 0)); m.box(1.2, 5, 1.2, c, M(2.4, 2.5, 0)); m.torus(2.4, 0.5, 6, 12, c, M(0, 5, 0), "opaque", Math.PI); m.box(6.4, 0.6, 1.4, shade(c, 0.9), M(0, 7.6, 0));
      return m.done([6.4, 8, 1.4], { shape: "box", hx: 3.2, hy: 4, hz: 0.6, y: 4, gate: 1 }); }
    case "fence": { const c = c1 || "#9a7650"; for (let i = 0; i < 4; i++) m.box(0.12, 1.1, 0.12, c, M(-2.9 + i * 1.93, 0.55, 0)); m.box(6, 0.1, 0.06, shade(c, 1.1), M(0, 0.85, 0)); m.box(6, 0.1, 0.06, shade(c, 1.1), M(0, 0.45, 0));
      return m.done([6, 1.1, 0.2], box(6, 1.1, 0.15)); }
    case "well": { const c = c1 || "#9b9488"; m.cyl(0.9, 0.95, 0.9, 12, c, M(0, 0.45, 0)); m.cyl(0.7, 0.7, 0.05, 12, "#2a4a5a", M(0, 0.78, 0)); for (const x of [-0.8, 0.8]) m.box(0.12, 1.6, 0.12, "#6b4a2f", M(x, 1.6, 0));
      m.prism(2, 0.6, 1.2, "#7a3b2e", M(0, 2.35, 0, 0, Math.PI / 2, 0, 0.6, 1, 1.66)); m.cyl(0.05, 0.05, 1.6, 5, "#6b4a2f", M(0, 2.1, 0, 0, 0, Math.PI / 2)); return m.done([1.9, 2.9, 1.9], cyl(0.95, 1)); }
    case "fountain": { const c = c1 || "#d8d2c4"; m.cyl(2.5, 2.6, 0.6, 18, c, M(0, 0.3, 0)); m.cyl(2.25, 2.25, 0.05, 18, "#4f9cc4", M(0, 0.55, 0), "glass"); m.cyl(0.3, 0.4, 1.6, 8, c, M(0, 1.1, 0)); m.cyl(1, 0.4, 0.4, 12, c, M(0, 2.0, 0)); m.cyl(0.85, 0.85, 0.04, 12, "#4f9cc4", M(0, 2.18, 0), "glass");
      return m.done([5.2, 2.4, 5.2], cyl(2.6, 0.7), { water: { y: 2.2 } }); }
    case "pier": { const c = c1 || "#8a6440"; for (let i = 0; i < 16; i++) m.box(3, 0.12, 0.9, i % 2 ? c : shade(c, 0.9), M(0, 1, -7.5 + i)); for (let i = 0; i < 6; i++) for (const x of [-1.4, 1.4]) m.cyl(0.12, 0.12, 3, 6, "#5e4029", M(x, -0.4, -7.5 + i * 3));
      return m.done([3, 1.1, 16], { shape: "box", hx: 1.5, hy: 0.06, hz: 8, y: 1 }); }
    case "statue": { const c = c1 || "#9a8f7c"; m.box(1.6, 1.4, 1.6, "#cfc7b6", M(0, 0.7, 0)); m.cyl(0.32, 0.42, 1.6, 8, c, M(0, 2.3, 0), "shiny"); m.ico(0.32, 1, c, M(0, 3.4, 0), "shiny"); m.cyl(0.1, 0.12, 1.1, 6, c, M(0.45, 2.6, 0, 0, 0, -0.9), "shiny");
      return m.done([1.6, 3.8, 1.6], box(1.6, 3.8, 1.6)); }
    case "lamp": { const c = c1 || "#2b3238"; m.cyl(0.09, 0.13, 4.8, 7, c, M(0, 2.4, 0), "shiny"); m.cyl(0.05, 0.05, 1, 5, c, M(0.45, 4.75, 0, 0, 0, Math.PI / 2), "shiny"); m.cone(0.35, 0.35, 8, c, M(0.9, 4.65, 0), "shiny"); m.cyl(0.22, 0.22, 0.06, 8, "#fff1c4", M(0.9, 4.47, 0), "glow");
      return m.done([1.2, 5, 0.6], cyl(0.15, 4.8), { light: { color: "#ffd99a", power: 1.4, y: 4.3, x: 0.9, night: 1 } }); }
    case "bench": { const c = c1 || "#9a6a3c"; for (let i = 0; i < 3; i++) m.box(1.8, 0.05, 0.12, c, M(0, 0.45, -0.18 + i * 0.16)); for (let i = 0; i < 2; i++) m.box(1.8, 0.1, 0.05, c, M(0, 0.62 + i * 0.16, -0.3, -0.25, 0, 0));
      for (const x of [-0.8, 0.8]) { m.box(0.06, 0.45, 0.5, "#2b3238", M(x, 0.22, 0), "shiny"); m.box(0.06, 0.4, 0.05, "#2b3238", M(x, 0.65, -0.3), "shiny"); }
      return m.done([1.8, 0.9, 0.6], box(1.8, 0.55, 0.5)); }
    case "stall": { const cl = c1 || pickc(rnd, PALETTE.cloth); m.box(2.8, 0.1, 1.6, "#9a6a3c", M(0, 0.9, 0)); for (const x of [-1.3, 1.3]) for (const z of [-0.7, 0.7]) m.box(0.08, 2.4, 0.08, "#6b4a2f", M(x, 1.2, z));
      for (let i = 0; i < 5; i++) m.box(3.1 / 5, 0.06, 2, i % 2 ? cl : "#f4f1ea", M(-1.24 + i * 0.62, 2.45, 0, 0.18, 0, 0));
      for (let i = 0; i < 9; i++) m.ico(0.12, 0, pickc(rnd, ["#e8b24a", "#d9443a", "#7cae4c", "#8d5a3c", "#f2d16b"]), M(-1.1 + (i % 5) * 0.55, 1.05, -0.4 + Math.floor(i / 5) * 0.6));
      return m.done([3, 2.6, 2], box(2.8, 1, 1.6)); }
    case "umbrella": { const cl = c1 || pickc(rnd, PALETTE.cloth); m.cyl(0.04, 0.04, 2.4, 5, "#e9e2d2", M(0, 1.2, 0)); m.cone(1.25, 0.6, 10, (i) => (Math.floor(i / 2) % 2 ? cl : "#f4f1ea"), M(0, 2.3, 0));
      m.box(0.7, 0.05, 1.8, "#f4f1ea", M(0.9, 0.18, 0.4)); return m.done([2.5, 2.6, 2.5], cyl(0.05, 2.4)); }
    case "flag": { m.cyl(0.06, 0.08, 7, 6, "#c9ced3", M(0, 3.5, 0), "shiny"); m.ico(0.1, 0, "#d4a63a", M(0, 7.05, 0), "shiny"); return m.done([0.3, 7, 2.2], cyl(0.08, 7), { cloth: { y: 6.0, w: 2.2, h: 1.4, color: c1 || "#2f8f62" } }); }
    case "sign": { m.box(0.1, 2.4, 0.1, "#2b3238", M(-0.55, 1.2, 0), "shiny"); m.box(0.1, 2.4, 0.1, "#2b3238", M(0.55, 1.2, 0), "shiny"); m.box(1.5, 0.9, 0.08, c1 || "#2f6fd6", M(0, 2.0, 0.05)); m.box(1.2, 0.12, 0.09, "#f4f4f0", M(0, 2.1, 0.06));
      return m.done([1.5, 2.45, 0.2], box(1.4, 2.4, 0.2)); }
    case "campfire": { for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; m.ico(0.18, 0, pickc(rnd, PALETTE.rock), M(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62), "opaque", 0.3, rnd); }
      for (let i = 0; i < 4; i++) m.cyl(0.07, 0.07, 1, 5, "#5e4029", M(0, 0.18, 0, 0, i * 0.8, 1.25)); m.cone(0.32, 0.9, 6, "#ff9a2e", M(0, 0.55, 0), "glow"); m.cone(0.18, 0.6, 6, "#ffe08a", M(0, 0.45, 0), "glow");
      return m.done([1.4, 0.8, 1.4], null, { light: { color: "#ff9a40", power: 2.4, y: 0.8, flicker: 1 }, fire: { y: 0.6, size: 0.5 } }); }
    case "torch": { m.cyl(0.04, 0.05, 1.7, 5, "#5e4029", M(0, 0.85, 0)); m.cyl(0.07, 0.05, 0.2, 6, "#3a2a1c", M(0, 1.75, 0)); m.cone(0.1, 0.32, 6, "#ffae3a", M(0, 2.0, 0), "glow");
      return m.done([0.3, 2.1, 0.3], cyl(0.06, 1.8), { light: { color: "#ffa040", power: 1.1, y: 2, flicker: 1 }, fire: { y: 2.0, size: 0.18 } }); }
    case "lantern": { const c = c1 || "#2b3238"; m.box(0.26, 0.04, 0.26, c, M(0, 0.02, 0), "shiny"); m.box(0.26, 0.04, 0.26, c, M(0, 0.4, 0), "shiny"); for (const s of [-1, 1]) for (const t of [-1, 1]) m.box(0.025, 0.4, 0.025, c, M(s * 0.12, 0.21, t * 0.12), "shiny");
      m.cyl(0.08, 0.08, 0.24, 6, "#ffd88a", M(0, 0.21, 0), "glow"); m.cone(0.16, 0.14, 4, c, M(0, 0.49, 0, 0, Math.PI / 4, 0), "shiny"); m.torus(0.05, 0.012, 3, 8, c, M(0, 0.6, 0), "shiny");
      return m.done([0.3, 0.65, 0.3], { shape: "box", hx: 0.13, hy: 0.32, hz: 0.13, y: 0.32 }, { light: { color: "#ffcf7a", power: 0.7, y: 0.25, flicker: 1 } }); }
    // ----- vehicles -----
    case "car": case "suv": { const suv = type === "suv", body = c1 || pickc(rnd, PALETTE.car), L = suv ? 4.9 : 4.5, H = suv ? 1.9 : 1.45, W = suv ? 2.0 : 1.86;
      const prof = suv ? [[-2.45, 0.35], [2.45, 0.35], [2.45, 0.95], [2.15, 1.1], [1.25, 1.15], [0.95, 1.85], [-2.2, 1.9], [-2.45, 1.75]] : [[-2.25, 0.3], [2.25, 0.3], [2.25, 0.75], [1.9, 0.92], [0.85, 1.0], [0.35, 1.45], [-1.15, 1.45], [-1.85, 1.0], [-2.25, 0.92]];
      m.shape(prof, W - 0.08, body, M(0, 0, 0, 0, -Math.PI / 2, 0), "shiny", 0.04);
      const win = suv ? [[1.12, 1.18], [0.88, 1.8], [-2.1, 1.82], [-2.3, 1.2]] : [[0.75, 1.03], [0.32, 1.4], [-1.1, 1.4], [-1.72, 1.02]];
      m.shape(win, W - 0.04, "#20303a", M(0, 0, 0, 0, -Math.PI / 2, 0), "glass");
      for (const [x, z] of [[1.45, 0.86], [-1.45, 0.86], [1.45, -0.86], [-1.45, -0.86]].map(([x, z]) => [x * (L / 4.5), z * (W / 1.86)])) { m.cyl(0.36, 0.36, 0.26, 12, "#1b1c1e", M(z, 0.36, x, 0, 0, Math.PI / 2)); m.cyl(0.2, 0.2, 0.27, 8, "#b8bec4", M(z, 0.36, x, 0, 0, Math.PI / 2), "shiny"); }
      for (const s of [-1, 1]) { m.box(0.32, 0.14, 0.05, "#fff6d8", M(s * (W / 2 - 0.3), suv ? 0.9 : 0.72, L / 2 + 0.01), "glow"); m.box(0.3, 0.12, 0.05, "#d81e1e", M(s * (W / 2 - 0.3), suv ? 0.95 : 0.78, -L / 2 - 0.01), "glow"); }
      return m.done([W, H, L], { shape: "box", hx: W / 2, hy: H / 2 - 0.1, hz: L / 2, y: H / 2 + 0.05 }, { mass: suv ? 2200 : 1400 }); }
    case "truck": { const c = c1 || pickc(rnd, ["#f4f4f0", "#2f6fd6", "#d63a32", "#c9a54a"]); m.box(2.3, 2.1, 2, c, M(0, 1.45, 2), "shiny"); m.box(2.24, 0.9, 0.08, "#20303a", M(0, 1.95, 3.02), "glass");
      m.box(2.3, 0.3, 4.2, "#3b3e42", M(0, 0.75, -1.1)); m.box(2.3, 0.7, 0.08, c, M(0, 1.25, -3.2), "shiny"); for (const s of [-1, 1]) m.box(0.08, 0.7, 4.2, c, M(s * 1.11, 1.25, -1.1), "shiny");
      for (const z of [2, -0.6, -2.4]) for (const s of [-1, 1]) m.cyl(0.45, 0.45, 0.3, 12, "#1b1c1e", M(s * 1.05, 0.45, z, 0, 0, Math.PI / 2));
      return m.done([2.3, 2.6, 6.2], box(2.3, 2.5, 6.2)); }
    case "bus": { const c = c1 || pickc(rnd, ["#e8c22c", "#2f6fd6", "#f4f4f0", "#d63a32"]); m.box(2.5, 2.8, 11, c, M(0, 1.75, 0), "shiny"); m.box(2.52, 1.0, 9.6, "#20303a", M(0, 2.35, -0.3), "glass"); m.box(2.3, 1.3, 0.06, "#20303a", M(0, 2.2, 5.51), "glass");
      for (const z of [3.6, -3.6]) for (const s of [-1, 1]) m.cyl(0.5, 0.5, 0.3, 12, "#1b1c1e", M(s * 1.15, 0.5, z, 0, 0, Math.PI / 2)); return m.done([2.5, 3.2, 11], box(2.5, 3, 11)); }
    case "boat": { const dhow = v % 2 || opt.place === "beach" || opt.place === "oasis", hull = c1 || (dhow ? "#8a5a34" : "#f4f4f0");
      m.shape([[-2.5, 0.5], [2.5, 0.5], [2.1, 0], [-2.0, 0]], 1.8, hull, M(0, 0, 0, 0, Math.PI / 2, 0, 1, 1.4, 1), dhow ? "opaque" : "shiny"); m.box(1.7, 0.05, 4.4, dhow ? "#b9864f" : "#c8b28a", M(0, 0.68, 0));
      if (dhow) { m.cyl(0.06, 0.08, 4.4, 5, "#5e4029", M(0, 2.8, 0.6)); m.shape([[0, 0], [0.1, 3.4], [2.6, 0.2]], 0.03, c2 || "#f2ead8", M(0, 1.2, -0.6, 0, Math.PI / 2, 0)); }
      else { m.box(1.2, 0.8, 1.4, "#f4f4f0", M(0, 1.1, -0.4), "shiny"); m.box(1.15, 0.4, 0.05, "#20303a", M(0, 1.25, 0.31), "glass"); m.box(1.82, 0.12, 4.6, c2 || "#2f6fd6", M(0, 0.4, 0)); }
      return m.done([1.9, dhow ? 4.6 : 1.6, 5], { shape: "box", hx: 0.9, hy: 0.4, hz: 2.3, y: 0.4 }, { mass: dhow ? 1800 : 900, floats: 1 }); }
    case "bike": { const c = c1 || pickc(rnd, PALETTE.car); for (const z of [-0.55, 0.55]) m.torus(0.34, 0.035, 4, 14, "#1b1c1e", M(0, 0.36, z, 0, Math.PI / 2, 0)); m.cyl(0.025, 0.025, 1.1, 4, c, M(0, 0.62, 0, Math.PI / 2 - 0.25, 0, 0), "shiny");
      m.cyl(0.025, 0.025, 0.6, 4, c, M(0, 0.62, 0.35, 0.3, 0, 0), "shiny"); m.cyl(0.02, 0.02, 0.5, 4, "#2b3238", M(0, 0.95, 0.5, 0, 0, Math.PI / 2), "shiny"); m.box(0.12, 0.05, 0.24, "#1b1c1e", M(0, 0.9, -0.3));
      return m.done([0.5, 1.1, 1.8], { shape: "box", hx: 0.1, hy: 0.5, hz: 0.85, y: 0.5 }, { mass: 14 }); }
    // ----- things to push, kick and throw -----
    case "ball": { const c = c1 || pickc(rnd, ["#d63a32", "#f4f4f0", "#2f6fd6", "#e8c22c"]); m.ico(0.11, 2, (i) => (i % 9 < 2 ? "#1d1f22" : c), M(0, 0.11, 0)); return m.done([0.22, 0.22, 0.22], { shape: "ball", r: 0.11, y: 0.11 }); }
    case "crate": { const c = c1 || "#b7884f"; m.box(0.8, 0.8, 0.8, c, M(0, 0.4, 0)); for (const s of [-1, 1]) { m.box(0.84, 0.1, 0.84, shade(c, 0.8), M(0, 0.4 + s * 0.35, 0)); m.box(0.1, 0.84, 0.84, shade(c, 0.8), M(s * 0.35, 0.4, 0)); }
      return m.done([0.84, 0.84, 0.84], box(0.8, 0.8, 0.8)); }
    case "barrel": { const c = c1 || "#8a5a34"; m.cyl(0.28, 0.28, 0.9, 12, c, M(0, 0.45, 0)); m.cyl(0.32, 0.32, 0.9 * 0.5, 12, shade(c, 1.08), M(0, 0.45, 0)); for (const y of [0.15, 0.75]) m.cyl(0.3, 0.3, 0.06, 12, "#3b3e42", M(0, y, 0), "shiny");
      return m.done([0.64, 0.9, 0.64], cyl(0.31, 0.9)); }
    case "cone": { m.cone(0.2, 0.68, 10, "#ff6a1a", M(0, 0.38, 0)); m.cyl(0.13, 0.155, 0.12, 10, "#f4f4f0", M(0, 0.38, 0)); m.box(0.42, 0.04, 0.42, "#ff6a1a", M(0, 0.02, 0));
      return m.done([0.42, 0.72, 0.42], { shape: "cone", r: 0.2, hy: 0.36, y: 0.36 }); }
    case "chair": { const c = c1 || "#9a6a3c"; m.box(0.46, 0.05, 0.46, c, M(0, 0.46, 0)); m.box(0.46, 0.5, 0.05, c, M(0, 0.72, -0.21)); for (const s of [-1, 1]) for (const t of [-1, 1]) m.box(0.05, 0.46, 0.05, shade(c, 0.85), M(s * 0.2, 0.23, t * 0.2));
      return m.done([0.5, 0.97, 0.5], box(0.46, 0.95, 0.46)); }
    case "table": { const c = c1 || "#9a6a3c"; m.box(1.4, 0.06, 0.9, c, M(0, 0.73, 0)); for (const s of [-1, 1]) for (const t of [-1, 1]) m.box(0.07, 0.7, 0.07, shade(c, 0.85), M(s * 0.62, 0.35, t * 0.38));
      return m.done([1.4, 0.76, 0.9], box(1.4, 0.76, 0.9)); }
    case "vase": { m.lathe([[0, 0], [0.1, 0], [0.15, 0.12], [0.13, 0.3], [0.07, 0.42], [0.09, 0.5]], 12, c1 || "#5aa0c8", M(), "glass"); return m.done([0.3, 0.5, 0.3], { shape: "cyl", r: 0.14, hy: 0.25, y: 0.25 }); }
    case "bottle": { m.lathe([[0, 0], [0.045, 0], [0.045, 0.18], [0.018, 0.24], [0.018, 0.3]], 10, c1 || "#3f8f5b", M(), "glass"); return m.done([0.09, 0.3, 0.09], { shape: "cyl", r: 0.045, hy: 0.15, y: 0.15 }); }
    case "cart": { const c = c1 || "#9a6a3c"; m.box(1.4, 0.5, 0.9, c, M(0, 0.75, 0)); for (const s of [-1, 1]) m.cyl(0.42, 0.42, 0.08, 10, "#5e4029", M(s * 0.5, 0.42, 0, 0, 0, Math.PI / 2)); m.cyl(0.03, 0.03, 1.2, 4, "#5e4029", M(0, 0.8, 0.9, Math.PI / 2 - 0.3, 0, 0));
      return m.done([1.6, 1.1, 1], box(1.4, 1, 1)); }
    // ----- inside -----
    case "sofa": { const c = c1 || pickc(rnd, ["#5b6b7a", "#8a6a50", "#3f5a4a", "#b9a284"]); m.box(2.2, 0.4, 0.9, shade(c, 0.85), M(0, 0.25, 0)); m.box(2.2, 0.55, 0.22, c, M(0, 0.62, -0.34)); for (const s of [-1, 1]) m.box(0.22, 0.6, 0.9, c, M(s * 1.0, 0.45, 0));
      for (const s of [-0.45, 0.45]) m.box(0.88, 0.16, 0.66, shade(c, 1.1), M(s, 0.52, 0.08)); return m.done([2.2, 0.9, 0.9], box(2.2, 0.85, 0.9)); }
    case "bed": { const c = c1 || "#d9d2c4"; m.box(2, 0.3, 2.1, "#6b4a2f", M(0, 0.15, 0)); m.box(1.9, 0.25, 2.0, "#f4f1ea", M(0, 0.42, 0)); m.box(1.9, 0.1, 1.3, c, M(0, 0.58, 0.32)); m.box(2, 1.0, 0.1, "#6b4a2f", M(0, 0.5, -1.05));
      for (const s of [-0.48, 0.48]) m.box(0.7, 0.14, 0.4, "#ffffff", M(s, 0.62, -0.75)); return m.done([2, 1, 2.1], box(2, 0.6, 2.1)); }
    case "desk": { const c = c1 || "#a6825a"; m.box(1.6, 0.05, 0.8, c, M(0, 0.74, 0)); m.box(0.45, 0.7, 0.75, shade(c, 0.9), M(0.55, 0.36, 0)); m.box(0.05, 0.7, 0.75, shade(c, 0.9), M(-0.77, 0.36, 0));
      m.box(0.6, 0.38, 0.04, "#1d1f22", M(-0.1, 1.0, -0.2), "shiny"); m.box(0.56, 0.34, 0.02, "#4f8fbf", M(-0.1, 1.0, -0.17), "glow"); return m.done([1.6, 1.2, 0.8], box(1.6, 0.76, 0.8)); }
    case "shelf": { const c = c1 || "#8a6440"; m.box(1.2, 2, 0.05, c, M(0, 1, -0.18)); for (const s of [-1, 1]) m.box(0.05, 2, 0.4, c, M(s * 0.58, 1, 0)); for (let i = 0; i < 5; i++) m.box(1.16, 0.04, 0.38, c, M(0, 0.05 + i * 0.47, 0));
      for (let i = 0; i < 4; i++) for (let k = 0; k < 7; k++) if (rnd() > 0.25) m.box(0.06 + rnd() * 0.05, 0.28 + rnd() * 0.1, 0.26, pickc(rnd, ["#c0392b", "#2980b9", "#27ae60", "#f39c12", "#8e44ad", "#ecf0f1", "#34495e"]), M(-0.48 + k * 0.15, 0.24 + i * 0.47, 0));
      return m.done([1.2, 2, 0.4], box(1.2, 2, 0.4)); }
    case "rug": { const c = c1 || pickc(rnd, ["#8e2f2a", "#2f4f7a", "#7a5a2f"]); m.box(3, 0.02, 2, c, M(0, 0.01, 0)); m.box(2.6, 0.022, 1.6, c2 || "#d4a63a", M(0, 0.012, 0)); m.box(2.3, 0.024, 1.3, c, M(0, 0.013, 0));
      for (let i = 0; i < 3; i++) m.box(0.3, 0.026, 0.3, c2 || "#d4a63a", M(-0.8 + i * 0.8, 0.014, 0, 0, Math.PI / 4, 0)); return m.done([3, 0.03, 2], null); }
    case "tv": { m.box(1.4, 0.82, 0.05, "#111214", M(0, 1.1, 0), "shiny"); m.box(1.32, 0.74, 0.02, "#2a5a8a", M(0, 1.1, 0.03), "glow"); m.box(0.3, 0.05, 0.25, "#111214", M(0, 0.6, 0), "shiny"); m.box(0.06, 0.12, 0.06, "#111214", M(0, 0.66, 0), "shiny");
      m.box(1.8, 0.5, 0.45, c1 || "#5e4029", M(0, 0.25, 0.1)); return m.done([1.8, 1.5, 0.5], box(1.8, 0.5, 0.45)); }
    case "plant": { m.cyl(0.2, 0.15, 0.36, 10, c1 || "#d8c9a8", M(0, 0.18, 0)); for (let i = 0; i < 4; i++) m.ico(0.22 + rnd() * 0.08, 1, i % 2 ? "#4f8a3b" : "#3f7a33", M((rnd() - 0.5) * 0.25, 0.6 + i * 0.12, (rnd() - 0.5) * 0.25), "opaque", 0.3, rnd);
      return m.done([0.5, 1.1, 0.5], { shape: "cyl", r: 0.2, hy: 0.35, y: 0.35 }); }
    case "window": { const c = c1 || "#f4f4f0"; m.box(1.6, 1.4, 0.06, "#bfe0f0", M(0, 1.6, 0), "glass"); for (const y of [0.9, 2.3]) m.box(1.7, 0.08, 0.1, c, M(0, y, 0)); for (const x of [-0.81, 0, 0.81]) m.box(0.08, 1.4, 0.1, c, M(x, 1.6, 0));
      return m.done([1.7, 2.4, 0.1], null); }
    case "door": { m.box(1, 2.1, 0.08, c1 || "#7a5434", M(0, 1.05, 0)); m.box(1.1, 0.08, 0.1, "#5e4029", M(0, 2.12, 0)); m.ico(0.035, 0, "#d4a63a", M(0.38, 1.05, 0.06), "shiny"); return m.done([1.1, 2.2, 0.1], null); }
    case "kitchen": { const c = c1 || "#f4f1ea"; m.box(3, 0.88, 0.62, c, M(0, 0.44, 0)); m.box(3.04, 0.05, 0.66, "#3b3e42", M(0, 0.9, 0)); m.box(0.5, 0.04, 0.38, "#9aa3ab", M(-0.6, 0.93, 0), "shiny");
      for (let i = 0; i < 4; i++) m.box(0.7, 0.75, 0.02, shade(c, 0.94), M(-1.12 + i * 0.75, 0.44, 0.32)); m.box(3, 0.7, 0.35, c, M(0, 1.9, -0.13)); return m.done([3, 2.3, 0.66], box(3, 0.92, 0.62)); }
    case "cushions": { const c = c1 || "#8e2f2a", tr = c2 || "#d4a63a"; m.box(3, 0.14, 0.8, c, M(0, 0.07, 0)); m.box(3, 0.45, 0.2, c, M(0, 0.36, -0.3)); for (let i = 0; i < 4; i++) m.box(0.45, 0.4, 0.18, shade(c, 0.85), M(-1.1 + i * 0.73, 0.38, -0.18, -0.2, 0, 0));
      m.box(3.02, 0.03, 0.82, tr, M(0, 0.15, 0)); return m.done([3, 0.6, 0.8], box(3, 0.55, 0.8)); }
    case "painting": { m.box(1.2, 0.8, 0.05, "#d4a63a", M(0, 1.6, 0), "shiny"); m.box(1.08, 0.68, 0.02, c1 || "#4f8fbf", M(0, 1.6, 0.03)); m.box(0.5, 0.3, 0.025, c2 || "#e8b24a", M(-0.2, 1.5, 0.035)); return m.done([1.2, 2, 0.05], null); }
    case "piano": { m.box(1.5, 1.2, 0.6, c1 || "#151517", M(0, 0.6, 0), "shiny"); m.box(1.4, 0.06, 0.25, "#f4f4f0", M(0, 0.76, 0.42)); for (let i = 0; i < 18; i++) if (i % 7 !== 2 && i % 7 !== 6) m.box(0.03, 0.04, 0.14, "#111", M(-0.62 + i * 0.075, 0.8, 0.38));
      return m.done([1.5, 1.2, 0.8], box(1.5, 1.2, 0.6)); }
    // ----- plain shapes -----
    case "sphere": m.ico(0.5, 2, c1 || "#d9d4c7", M(0, 0.5, 0), "shiny"); return m.done([1, 1, 1], { shape: "ball", r: 0.5, y: 0.5 });
    case "cylinder": m.cyl(0.5, 0.5, 1.5, 16, c1 || "#d9d4c7", M(0, 0.75, 0), "shiny"); return m.done([1, 1.5, 1], cyl(0.5, 1.5));
    case "ring": m.torus(0.9, 0.18, 8, 24, c1 || "#d4a63a", M(0, 1.1, 0), "shiny"); return m.done([2, 2.2, 0.4], null);
    default: { const c = c1 || "#d9d4c7"; m.box(1, 1, 1, c, M(0, 0.5, 0)); return m.done([1, 1, 1], box(1, 1, 1)); }
  }
}

// one material set per renderer kind (made once, shared by every model)
export function makeMaterials(T) {
  const std = (o) => new T.MeshStandardMaterial({ vertexColors: true, ...o });
  return {
    opaque: std({ flatShading: true, roughness: 0.9, metalness: 0 }),
    shiny: std({ roughness: 0.32, metalness: 0.45 }),
    glass: std({ roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.5, depthWrite: false }),
    glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    win: std({ roughness: 0.25, metalness: 0.1, emissive: new T.Color("#ffc977"), emissiveIntensity: 0 })
  };
}
