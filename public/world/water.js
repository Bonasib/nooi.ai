// Water surfaces: sea, lake, pond, oasis, river, pool — one light plane each with ripples (a moving normal map, no custom
// shaders, so it draws the same on WebGPU and WebGL2), ice when it is frozen, and the surface seen from below under water.
import { noise2 } from "./terrain.js";
let NORMAL = null;
function normalTex(T) {
  if (NORMAL) return NORMAL.clone();
  const s = 256, N = noise2(91), c = document.createElement("canvas"); c.width = c.height = s; const x = c.getContext("2d"), img = x.createImageData(s, s), h = new Float32Array(s * s);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const u = i / s, v = j / s, w = (fx, fy, k) => N.n(Math.cos(u * 6.2832) * fx + Math.sin(u * 6.2832) * 0.3 + k, Math.sin(v * 6.2832) * fy + Math.cos(v * 6.2832) * 0.3 - k); h[j * s + i] = w(1.6, 1.6, 0) * 0.6 + w(3.4, 3.4, 5) * 0.3 + w(7, 7, 9) * 0.1; }
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const dx = h[j * s + ((i + 1) % s)] - h[j * s + ((i - 1 + s) % s)], dy = h[((j + 1) % s) * s + i] - h[((j - 1 + s) % s) * s + i], k = (j * s + i) * 4, nx = -dx * 4, ny = -dy * 4, l = Math.hypot(nx, ny, 1);
    img.data[k] = ((nx / l) * 0.5 + 0.5) * 255; img.data[k + 1] = ((ny / l) * 0.5 + 0.5) * 255; img.data[k + 2] = ((1 / l) * 0.5 + 0.5) * 255; img.data[k + 3] = 255; }
  x.putImageData(img, 0, 0); NORMAL = new T.CanvasTexture(c); NORMAL.wrapS = NORMAL.wrapT = T.RepeatWrapping; return NORMAL.clone();
}
const COLOR = { sea: "#1d6a96", lake: "#2c6d86", pond: "#3a7468", oasis: "#2a8a8a", river: "#3a7a86", pool: "#3fa6c8", deep: "#2a86b0" };

export function buildWater(T, plan, terrain, tier) {
  const W = terrain.water, group = new T.Group(); group.name = "nooi_water";
  if (W.kind === "none") return { group, level: -999, update() {}, under: () => false, surfaceAt: () => -999 };
  const S = plan.size, frozen = W.frozen && W.kind !== "sea" && W.kind !== "deep", tex = frozen ? null : normalTex(T);
  if (tex) { tex.repeat.set(W.sea || W.kind === "deep" ? 60 : 8, W.sea || W.kind === "deep" ? 60 : 8); }
  const mat = new T.MeshStandardMaterial({ color: new T.Color(plan.water.color || (frozen ? "#cfe7f1" : COLOR[W.kind] || COLOR.lake)), roughness: frozen ? 0.28 : 0.18, metalness: 0, emissive: new T.Color(0x000000),
    transparent: !frozen, opacity: frozen ? 1 : W.kind === "pool" ? 0.75 : 0.84, normalMap: tex || null, normalScale: new T.Vector2(0.55, 0.55), side: W.kind === "deep" ? T.DoubleSide : T.FrontSide, depthWrite: frozen });
  const add = (geo, x = 0, z = 0) => { geo.rotateX(-Math.PI / 2); const m = new T.Mesh(geo, mat); m.position.set(x, W.level, z); m.receiveShadow = tier.shadows > 0 && frozen; m.renderOrder = 2; group.add(m); return m; };
  if (W.sea || W.kind === "deep") add(new T.CircleGeometry(tier.far * 1.25, 48));
  else if (W.box) add(new T.PlaneGeometry(W.box[0] * 2, W.box[1] * 2), W.x, W.z);
  else if (W.r) add(new T.CircleGeometry(W.r * 1.45, 40), W.x, W.z);
  if (W.river || (plan.terrain.shape === "canyon" && W.kind === "river")) {
    const f = W.river || ((x) => Math.sin(x / 40) * 10 + Math.sin(x / 17) * 3), seg = 80, wd = W.width ? W.width * 1.7 : 7, P = [], I = [];
    for (let i = 0; i <= seg; i++) { const x = -S / 2 + (S * i) / seg, z = f(x); P.push(x, 0, z - wd / 2, x, 0, z + wd / 2); if (i < seg) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    const uv = []; for (let i = 0; i <= seg; i++) uv.push(i / 4, 0, i / 4, 1); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    const m = new T.Mesh(g, mat); m.position.y = W.level; m.renderOrder = 2; group.add(m);
  }
  const flow = W.river ? 0.08 : 0.02;
  return {
    group, level: W.level, frozen,
    under: (cam) => W.kind === "deep" ? cam.position.y < W.level : (cam.position.y < W.level - 0.05 && terrain.isWater(cam.position.x, cam.position.z)),
    surfaceAt: (x, z) => (W.kind === "deep" || terrain.isWater(x, z) ? W.level : -999),
    // the sky it reflects (there's no mirror pass — that would cost a second render on phones)
    setSky(horizon, top, night) { if (frozen) return; mat.emissive.copy(horizon).lerp(top, 0.35).multiplyScalar(0.42 * (1 - night * 0.6)); },
    update(dt, t, wind) { if (!tex) return; tex.offset.x += (wind.x * 0.004 + flow) * dt; tex.offset.y += (wind.z * 0.004 + flow * 0.4) * dt; }
  };
}
