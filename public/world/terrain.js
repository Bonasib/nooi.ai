// The land: one height grid for the whole world (hills, mountains, dunes, a coast, an island, a valley, a canyon, moon craters),
// with water carved into it (pond, lake, river, oasis, sea) and coloured per vertex by ground, height and slope. The same grid
// feeds the physics (a height field), so what you see is what you walk on.
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function noise2(seed) {
  const p = new Uint16Array(512); let s = seed >>> 0 || 7;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const perm = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const g = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return x - y; case 2: return -x + y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const n = (x, y) => { const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y); const u = fade(x), v = fade(y);
    const a = p[X] + Y, b = p[X + 1] + Y; return lerp(lerp(g(p[a], x, y), g(p[b], x - 1, y), u), lerp(g(p[a + 1], x, y - 1), g(p[b + 1], x - 1, y - 1), u), v) * 0.7071; };
  const fbm = (x, y, o = 4) => { let a = 0, f = 1, w = 0.5, t = 0; for (let i = 0; i < o; i++) { a += n(x * f, y * f) * w; t += w; f *= 2.03; w *= 0.5; } return a / t; };
  const ridge = (x, y, o = 4) => { let a = 0, f = 1, w = 0.5, t = 0; for (let i = 0; i < o; i++) { const v = 1 - Math.abs(n(x * f, y * f)); a += v * v * w; t += w; f *= 2.1; w *= 0.5; } return a / t; };
  return { n, fbm, ridge };
}

const GROUND = {
  grass: ["#5d8a3a", "#6c9a44", "#4f7d33"], sand: ["#dcc38c", "#e6cf9a", "#ceb27b"], snow: ["#eef3f7", "#e2eaf0", "#f6f9fb"], dirt: ["#a98b63", "#9b7d58", "#b39770"],
  asphalt: ["#9b978f", "#a39f97", "#928e86"], stone: ["#8e8a83", "#84807a", "#99958e"], redrock: ["#b8673d", "#a65a35", "#c77a4c"], floor: ["#b98a58", "#a87b4b", "#c69a66"], moon: ["#a09e9a", "#8e8c88", "#b0aeaa"]
};
const ROCK = "#7f7b74", WET = "#b9a273", SNOWCAP = "#f0f4f7";

export function buildTerrain(T, plan, tier, rnd) {
  const S = plan.size, H = plan.terrain.height, shape = plan.terrain.shape, ground = plan.terrain.ground, water = plan.water.kind;
  const N = noise2(plan.seed), res = Math.max(48, Math.min(tier.terrain, Math.round(S / 1.1))) | 0, step = S / (res - 1);
  const wdir = rnd() * Math.PI * 2, cw = Math.cos(wdir), sw = Math.sin(wdir);
  const craters = shape === "craters" ? Array.from({ length: 9 }, () => ({ x: (rnd() - 0.5) * S * 0.8, z: (rnd() - 0.5) * S * 0.8, r: 6 + rnd() * 16 })).filter((c) => Math.hypot(c.x, c.z - plan.spawn.at[1]) > c.r + 6) : [];
  // where the water is
  const W = { level: plan.water.level || 0, kind: water, frozen: plan.water.frozen };
  if (water === "pond") Object.assign(W, { x: S * 0.16, z: -S * 0.1, r: Math.min(14, S * 0.08) });
  else if (water === "oasis") Object.assign(W, { x: 0, z: 2, r: 9 });
  else if (water === "lake") Object.assign(W, { x: 0, z: -S * 0.2, r: S * 0.17 });
  else if (water === "pool") Object.assign(W, { x: 8, z: -6, r: 5, box: [5, 3] });
  else if (water === "river") Object.assign(W, { river: (x) => -S * 0.14 + Math.sin(x / 28) * 7 + Math.sin(x / 11) * 2, width: 6 });
  const meander = (x) => Math.sin(x / 40) * 10 + Math.sin(x / 17) * 3;
  function base(x, z) {
    const r = Math.hypot(x, z), f = N.fbm(x / 60, z / 60), f2 = N.fbm(x / 21 + 9, z / 21 - 4, 3), center = 0.25 + 0.75 * smooth(10, 34, Math.hypot(x - plan.spawn.at[0], z - plan.spawn.at[1]));
    switch (shape) {
      case "flat": return 0.35 + f * 0.25;
      case "hills": return 0.6 + (Math.max(0, f + 0.25) * H * 0.85 + f2 * H * 0.15) * center;
      case "mountains": { const m = N.ridge(x / 75, z / 75) * H * smooth(28, S * 0.46, r); return 0.6 + Math.max(0, f + 0.2) * 5 * center + m; }
      case "dunes": { const d = Math.sin((x * cw + z * sw) / 13 + f * 3.2) * 0.5 + 0.5; return 0.5 + (d * d * H * 0.6 + Math.max(0, f + 0.3) * H * 0.5) * center; }
      case "coast": { const d = z + S * 0.06 + f * 8; return d > 0 ? 0.4 + Math.min(H + f2 * 2, d * 0.09) + Math.max(0, f2) * 2 * smooth(10, 40, d) : d * 0.22; }
      case "island": { const k = 1 - smooth(S * 0.17, S * 0.34 + f * 10, r); return k > 0 ? 0.3 + (H * (0.6 + 0.4 * f2) * k * k) - 6 * (1 - k) * smooth(0.4, 1, 1 - k) : -6 * smooth(S * 0.3, S * 0.4, r); }
      case "valley": return 0.6 + H * Math.pow(smooth(S * 0.12, S * 0.48, r), 1.4) + Math.max(0, f) * 3 * center;
      case "canyon": { const d = Math.abs(z - meander(x)), cliff = smooth(9, 18, d + f * 4); let h = cliff * H * (0.75 + 0.25 * f2); h = Math.floor(h / 4.2) * 4.2 + (h % 4.2) * 0.25; return 0.5 + h; }
      case "craters": { let h = 0.4 + f * 1.4; for (const c of craters) { const d = Math.hypot(x - c.x, z - c.z) / c.r; if (d < 1.35) h += d < 1 ? -2.6 * (1 - d * d) + 1.2 * d * d * d : 1.2 * (1 - smooth(1, 1.35, d)); } return h; }
      default: return 0;
    }
  }
  function carve(x, z, h) {
    if (W.r && !W.box) { const d = Math.hypot(x - W.x, z - W.z);
      if (d < W.r * 3.2) h = lerp(Math.min(h, W.level + 0.35 + Math.max(0, d - W.r) * 0.12), h, smooth(W.r * 1.6, W.r * 3.2, d));   // the land slopes gently down to the shore
      if (d < W.r * 1.7) { const t = smooth(W.r * 0.55, W.r * 1.35, d); h = lerp(W.level - (water === "lake" ? 4 : 1.6), Math.max(h, W.level + 0.25 + (d - W.r) * 0.08), t); } }
    if (W.box) { const dx = Math.abs(x - W.x) - W.box[0], dz = Math.abs(z - W.z) - W.box[1]; if (dx < 0 && dz < 0) h = W.level - 1.6; }
    if (W.river) { const d = Math.abs(z - W.river(x)); if (d < W.width * 2.2) h = lerp(W.level - 1.8, Math.max(h, W.level + 0.3), smooth(W.width * 0.5, W.width * 1.6, d)); }
    if (shape === "canyon" && water === "river") { const d = Math.abs(z - meander(x)); if (d < 7) h = lerp(W.level - 1.4, h, smooth(3, 7, d)); }
    if (["coast", "island"].includes(shape) || water === "deep" || water === "sea" || W.r || W.river || shape === "canyon") return h;
    return Math.max(h, 0.2);
  }
  const heights = new Float32Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const x = -S / 2 + i * step, z = -S / 2 + j * step; heights[j * res + i] = carve(x, z, base(x, z)); }
  // a sea next to a land that isn't a coast or an island ("a city by the sea"): lower one side
  if (water === "sea" && !["coast", "island"].includes(shape)) for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const z = -S / 2 + j * step; if (z < -S * 0.22) heights[j * res + i] = lerp(heights[j * res + i], -5, smooth(-S * 0.22, -S * 0.32, z)); }
  if (water === "deep") W.level = Math.max(...heights) + 14;
  if (["coast", "island", "sea"].includes(shape) || water === "sea") W.sea = 1;
  const heightAt = (x, z) => {
    const fx = Math.max(0, Math.min(res - 1.0001, (x + S / 2) / step)), fz = Math.max(0, Math.min(res - 1.0001, (z + S / 2) / step)), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    const a = heights[j * res + i], b = heights[j * res + i + 1], c = heights[(j + 1) * res + i], d = heights[(j + 1) * res + i + 1];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  const slopeAt = (x, z) => { const e = step; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); };
  const isWater = (x, z) => (W.kind !== "none" && W.kind !== "deep" ? heightAt(x, z) < W.level + 0.05 : false);
  // flatten a spot for a building (and keep the record so the physics sees the same ground)
  function flatten(x, z, rx, rz, pad = 2) {
    const h0 = heightAt(x, z); let sum = 0, n = 0;
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const px = -S / 2 + i * step, pz = -S / 2 + j * step; if (Math.abs(px - x) < rx && Math.abs(pz - z) < rz) { sum += heights[j * res + i]; n++; } }
    const target = n ? Math.max(sum / n, h0 - 0.4) : h0;
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const px = -S / 2 + i * step, pz = -S / 2 + j * step, dx = Math.max(0, Math.abs(px - x) - rx), dz = Math.max(0, Math.abs(pz - z) - rz), d = Math.hypot(dx, dz);
      if (d < pad) { const k = j * res + i; heights[k] = lerp(target, heights[k], smooth(0, pad, d)); } }
    return target;
  }
  // o.plain: the base is white so a photo texture shows its own colours (roads, wet edges, rock and snow still paint over it)
  function mesh(roads = [], o = {}) {
    const g = new T.PlaneGeometry(S, S, res - 1, res - 1); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new T.Color(), pal = (GROUND[ground] || GROUND.grass).map((h) => new T.Color(h)), rock = new T.Color(ROCK), wet = new T.Color(WET), snow = new T.Color(SNOWCAP);
    if (plan.terrain.color) pal[0].set(plan.terrain.color); if (plan.terrain.color2) pal[1].set(plan.terrain.color2);
    if (o.plain) { pal[0].set("#ffffff"); pal[1].set("#f2f2f2"); pal[2].set("#e6e6e6"); }
    const peak = Math.max(1, ...heights), road = new T.Color(ground === "asphalt" ? "#3b3e42" : ground === "sand" ? "#c9b07c" : "#a48f6e");
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k), i = Math.round((x + S / 2) / step), j = Math.round((z + S / 2) / step), h = heights[j * res + i]; pos.setY(k, h);
      const v = N.fbm(x / 9, z / 9, 2) * 0.5 + 0.5; c.copy(pal[0]).lerp(pal[1], smooth(0.35, 0.75, v)).lerp(pal[2], smooth(0.6, 0.95, N.fbm(x / 31 + 3, z / 31, 2) * 0.5 + 0.5) * 0.6);
      const sl = slopeAt(x, z);
      if (ground === "redrock") c.lerp(new T.Color(Math.floor(h / 2.1) % 2 ? "#a95b35" : "#c98457"), 0.45);
      if (W.kind !== "none" && W.kind !== "deep" && h < W.level + 0.9 && ground !== "snow") c.lerp(wet, smooth(W.level + 0.9, W.level + 0.15, h) * (ground === "sand" ? 0.4 : 0.85));
      if (sl > 0.55 && ground !== "floor") c.lerp(rock, smooth(0.55, 1.1, sl));
      if (shape === "mountains" && h > peak * 0.62) c.lerp(snow, smooth(peak * 0.62, peak * 0.78, h) * (sl > 1.2 ? 0.4 : 1));
      for (const r of roads) { const d = segDist(x, z, r); if (d < r.width / 2 + 0.8) c.lerp(road, smooth(r.width / 2 + 0.8, r.width / 2 - 0.4, d)); }
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    g.setAttribute("color", new T.BufferAttribute(col, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: tier.name === "low" }));
    m.receiveShadow = tier.shadows > 0; m.name = "nooi_ground"; return m;
  }
  // the land past the edge: low hills or dunes in the fog, so the world never ends at a cliff
  function farRing() {
    if (W.sea || shape === "room") return null;
    const seg = 96, inner = S * 0.5 * 1.02, outer = S * 1.9, P = [], C = [], c = new T.Color(), col = new T.Color((GROUND[ground] || GROUND.grass)[0]).lerp(new T.Color(shape === "mountains" ? "#6d7680" : "#8a9a9c"), 0.35);
    const hmax = shape === "mountains" ? H * 2.2 : shape === "canyon" ? H * 1.1 : shape === "dunes" ? H * 1.2 : Math.max(6, H * 1.4);
    for (let s = 0; s < seg; s++) { const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2, h0 = hmax * (0.45 + 0.55 * (N.fbm(Math.cos(a0) * 3, Math.sin(a0) * 3) * 0.5 + 0.5)), h1 = hmax * (0.45 + 0.55 * (N.fbm(Math.cos(a1) * 3, Math.sin(a1) * 3) * 0.5 + 0.5));
      const pIn0 = [Math.cos(a0) * inner * 1.41, 0, Math.sin(a0) * inner * 1.41], pIn1 = [Math.cos(a1) * inner * 1.41, 0, Math.sin(a1) * inner * 1.41], pT0 = [Math.cos(a0) * (inner * 1.41 + 40), h0, Math.sin(a0) * (inner * 1.41 + 40)], pT1 = [Math.cos(a1) * (inner * 1.41 + 40), h1, Math.sin(a1) * (inner * 1.41 + 40)], pO0 = [Math.cos(a0) * outer, h0 * 0.6, Math.sin(a0) * outer], pO1 = [Math.cos(a1) * outer, h1 * 0.6, Math.sin(a1) * outer];
      for (const tri of [[pIn0, pT0, pIn1], [pIn1, pT0, pT1], [pT0, pO0, pT1], [pT1, pO0, pO1]]) for (const p of tri) { P.push(...p); c.copy(col).multiplyScalar(0.8 + (p[1] / Math.max(1, hmax)) * 0.35); C.push(c.r, c.g, c.b); } }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(P, 3)); g.setAttribute("color", new T.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: T.DoubleSide })); m.position.y = -1; m.name = "nooi_far"; return m;
  }
  return { size: S, res, step, heights, heightAt, slopeAt, isWater, flatten, mesh, farRing, water: W, noise: N };
}
export function segDist(x, z, r) { const [ax, az] = r.from, [bx, bz] = r.to, dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)); return Math.hypot(x - (ax + dx * t), z - (az + dz * t)); }
