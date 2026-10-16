// Builds a whole living world from a plan (public/world/plan.js) inside the engine (public/world/engine.js): sky and weather,
// the land and water, the things in it (instanced, in chunks the camera can skip), the life, the physics and the walker.
// Everything is made from the plan + its seed, so the same plan always gives the same world and a lost GPU can rebuild it.
import { cleanPlan, rng, TYPES, PLACES } from "./plan.js";
import { makeKit, buildModel, makeMaterials, PALETTE } from "./assets.js";
import { buildTerrain, segDist } from "./terrain.js";
import { buildSky, buildWeather } from "./sky.js";
import { buildWater } from "./water.js";
import { buildLife } from "./life.js";
import { createPhysics } from "./physics.js";
import { createPlayer } from "./player.js";
import { disposeTree } from "./engine.js";
import { loadSplat, terrainFromCollider } from "./splat.js";
import { createPeople } from "./human.js";
const BUILD = new Set(["building"]), SWAY = { tree: 1, pine: 0.6, palm: 1, ghaf: 0.5, bush: 0.4, reeds: 0.8, crops: 0.5, fern: 0.4, seaweed: 1.2 };
const ROOMSET = {
  living: [["sofa", [0, -3.6], 0], ["tv", [0, 3.9], Math.PI], ["rug", [0, 0], 0], ["table", [0, -1.2], 0], ["plant", [4, -4], 0], ["shelf", [-5.2, 0], Math.PI / 2], ["lantern", [3.2, 3.4], 0], ["painting", [0, -4.85], 0], ["chair", [2.6, -1.6], -0.6], ["chair", [-2.6, -1.6], 0.6]],
  majlis: [["cushions", [0, -4.3], 0], ["cushions", [-4.3, 0], Math.PI / 2], ["cushions", [4.3, 0], -Math.PI / 2], ["rug", [0, 0], 0], ["table", [0, 0], 0], ["lantern", [-3.6, -3.6], 0], ["lantern", [3.6, -3.6], 0], ["plant", [4.2, 4.2], 0], ["painting", [0, -4.85], 0], ["vase", [0.3, 0.1], 0]],
  bedroom: [["bed", [0, -3.4], 0], ["rug", [0, 0.3], 0], ["shelf", [-5, 1], Math.PI / 2], ["plant", [4.2, -4.2], 0], ["desk", [3.6, 3.6], Math.PI], ["chair", [3.6, 2.8], 0], ["lantern", [-1.4, -4.3], 0], ["painting", [0, -4.85], 0]],
  kitchen: [["kitchen", [0, -4.3], 0], ["kitchen", [-4.3, 0], Math.PI / 2], ["table", [1, 1], 0], ["chair", [1, 0.2], 0], ["chair", [1, 1.8], Math.PI], ["chair", [0, 1], Math.PI / 2], ["plant", [4.2, 4.2], 0], ["bottle", [1.1, 1.05], 0], ["vase", [0.7, 0.9], 0]],
  office: [["desk", [-2.5, -2], 0], ["desk", [2.5, -2], 0], ["chair", [-2.5, -1.2], Math.PI], ["chair", [2.5, -1.2], Math.PI], ["shelf", [-5, 2], Math.PI / 2], ["shelf", [-5, 3.4], Math.PI / 2], ["plant", [4.3, 4.3], 0], ["sofa", [2.5, 3.8], Math.PI], ["rug", [0, 1.5], 0]],
  cafe: [["kitchen", [0, -4.3], 0], ["table", [-2.6, 0.6], 0], ["table", [2.6, 0.6], 0], ["table", [0, 3.2], 0], ["chair", [-2.6, -0.2], 0], ["chair", [-2.6, 1.4], Math.PI], ["chair", [2.6, -0.2], 0], ["chair", [2.6, 1.4], Math.PI], ["chair", [0, 2.4], 0], ["chair", [0, 4], Math.PI], ["plant", [4.3, 4.3], 0], ["lantern", [-4.2, 4.2], 0], ["bottle", [-2.6, 0.6], 0]],
  gallery: [["painting", [-2.5, -4.85], 0], ["painting", [2.5, -4.85], 0], ["statue", [0, 0], 0], ["painting", [-4.85, 1], Math.PI / 2], ["painting", [4.85, 1], -Math.PI / 2], ["plant", [4.3, 4.3], 0], ["bench", [0, 2.6], 0], ["vase", [-3.8, 3.8], 0]],
  showroom: [["car", [0, -1], 0.5], ["suv", [-6, 4], 2.3], ["plant", [7.5, -7.5], 0], ["sofa", [6.5, 5.5], -2.3], ["sign", [0, -7.4], 0], ["rug", [6.5, 4.5], 0]],
  classroom: [["desk", [-2.2, -0.5], Math.PI], ["desk", [0, -0.5], Math.PI], ["desk", [2.2, -0.5], Math.PI], ["desk", [-2.2, 2], Math.PI], ["desk", [0, 2], Math.PI], ["desk", [2.2, 2], Math.PI], ["chair", [-2.2, 0.3], 0], ["chair", [0, 0.3], 0], ["chair", [2.2, 0.3], 0], ["chair", [-2.2, 2.8], 0], ["chair", [0, 2.8], 0], ["chair", [2.2, 2.8], 0], ["painting", [0, -4.85], 0], ["shelf", [-5, 3], Math.PI / 2]]
};

// low plants (grass, flowers, crops…) stay as they are; a photo cut-out is for the plants you look at
const BB_SKIP = new Set(["grass", "flowers", "crops", "mushroom", "shrub", "fern", "seaweed", "reeds"]);
// a photo on a white background → the thing alone (the white around it becomes see-through, soft at the edge), cropped to it
async function keyWhite(url) {
  const im = await new Promise((ok, bad) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => bad(new Error("picture")); i.src = url; });
  const s = Math.min(1, 768 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(8, Math.round(im.naturalWidth * s)), h = Math.max(8, Math.round(im.naturalHeight * s));
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
  let d; try { d = x.getImageData(0, 0, w, h); } catch { return null; }   // a picture from another site that can't be read
  const p = d.data, bg = new Uint8Array(w * h), st = [], white = (i) => { const r = p[i * 4], g = p[i * 4 + 1], b = p[i * 4 + 2]; return r > 226 && g > 226 && b > 226 && Math.max(r, g, b) - Math.min(r, g, b) < 24; };
  for (let X = 0; X < w; X++) st.push(X, (h - 1) * w + X); for (let Y = 0; Y < h; Y++) st.push(Y * w, Y * w + w - 1);
  while (st.length) { const i = st.pop(); if (bg[i] || !white(i)) continue; bg[i] = 1; const X = i % w, Y = (i / w) | 0; if (X > 0) st.push(i - 1); if (X < w - 1) st.push(i + 1); if (Y > 0) st.push(i - w); if (Y < h - 1) st.push(i + w); }
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
  for (let i = 0; i < w * h; i++) { if (bg[i]) { p[i * 4 + 3] = 0; continue; } n++; const X = i % w, Y = (i / w) | 0;
    if ((X > 0 && bg[i - 1]) || (X < w - 1 && bg[i + 1]) || (Y > 0 && bg[i - w]) || (Y < h - 1 && bg[i + w])) { const m = Math.min(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]); if (m > 200) p[i * 4 + 3] = Math.round((255 * (255 - m)) / 55); }
    if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
  if (x1 < x0 || n > w * h * 0.97 || n < w * h * 0.02) return null;   // the background wasn't white, or nothing is left
  x.putImageData(d, 0, 0); const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); return o;
}

export async function createWorld(engine, planIn, opts = {}) {
  const plan0 = cleanPlan(planIn);
  if (plan0.splat && plan0.splat.lo && engine.backend === "webgpu") { try { await engine.useBackend("webgl"); } catch (e) { console.warn("nooi 3D:", e); } }   // splats draw on WebGL2
  const T = engine.T, tier = engine.tier, plan = plan0, rnd = rng(plan.seed), K = makeKit(T), mats = makeMaterials(T);
  const P = PLACES[plan.place], indoor = !!P.indoor, low = tier.name === "low"; let S = plan.size, lim = S / 2 - 2;
  if (indoor) plan.spawn = { at: [0, S * 0.32], look: [0, -S * 0.3] };
  const progress = opts.onProgress || (() => {}), onEvent = opts.onEvent || (() => {});
  const scene = new T.Scene(); engine.scene = scene; const root = new T.Group(); root.name = "nooi_world"; scene.add(root);
  progress(0.1, "land");
  // ---- a photoreal place from World Labs (if this world has one), else the land is built ----
  let splatObj = null, terrain = null;
  if (plan.splat && plan.splat.lo) { try { progress(0.05, "photoreal"); splatObj = await loadSplat(T, engine, scene, plan.splat, tier); terrain = terrainFromCollider(T, splatObj.collider, tier);
      plan.size = S = terrain.size; lim = S / 2 - 2; plan.spawn = { at: terrain.spawn, look: [terrain.spawn[0], terrain.spawn[1] - 6] }; plan.dress = 0; }
    catch (e) { console.warn("nooi 3D: the photoreal world didn't load —", e); if (splatObj) splatObj.dispose(); splatObj = null; terrain = null; opts.onEvent && opts.onEvent({ type: "note", text: "photoreal-failed" }); } }
  const splatWorld = !!splatObj;
  // ---- land, water, roads ----
  if (!terrain) terrain = buildTerrain(T, plan, tier, rnd);
  const roads = plan.roads.slice();
  if (!roads.length && P.roads === "grid") { const g = 44; for (let v = -Math.floor(S / 2 / g) * g; v <= S / 2; v += g) { roads.push({ from: [v, -S / 2 + 4], to: [v, S / 2 - 4], width: 10, kind: "street" }); roads.push({ from: [-S / 2 + 4, v], to: [S / 2 - 4, v], width: 10, kind: "street" }); } }
  if (!roads.length && P.roads === "lanes") { roads.push({ from: [-S * 0.4, 6], to: [S * 0.4, -4], width: 5, kind: "path" }, { from: [-6, S * 0.4], to: [4, -S * 0.4], width: 5, kind: "path" }); }
  if (!roads.length && plan.life.some((l) => l.type === "car" || l.type === "bus")) roads.push({ from: [-S * 0.42, -14], to: [S * 0.42, -14], width: 9, kind: "road" });
  if (P.paths && !roads.length) roads.push({ from: [plan.spawn.at[0], plan.spawn.at[1] + 6], to: [0, -S * 0.3], width: 2.6, kind: "path" });
  for (const r of roads) { const L = Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]); for (let k = 0; k <= L; k += 4) { const t = k / (L || 1), x = r.from[0] + (r.to[0] - r.from[0]) * t, z = r.from[1] + (r.to[1] - r.from[1]) * t; terrain.flatten(x, z, r.width / 2 + 0.5, r.width / 2 + 0.5, 2.5); } }
  // ---- what goes where (an occupancy grid keeps houses, trees and roads apart) ----
  const [ox, oz] = terrain.center || [0, 0];
  const cell = 2, cells = Math.ceil(S / cell), occ = new Uint8Array(cells * cells), ci = (x, z) => { const i = Math.floor((x - ox + S / 2) / cell), j = Math.floor((z - oz + S / 2) / cell); return i < 0 || j < 0 || i >= cells || j >= cells ? -1 : j * cells + i; };
  const mark = (x, z, hx, hz, v = 1) => { for (let zz = z - hz; zz <= z + hz; zz += cell) for (let xx = x - hx; xx <= x + hx; xx += cell) { const k = ci(xx, zz); if (k >= 0) occ[k] = Math.max(occ[k], v); } };
  const free = (x, z, hx, hz) => { if (Math.abs(x - ox) > lim - hx || Math.abs(z - oz) > lim - hz) return false; for (let zz = z - hz; zz <= z + hz; zz += cell) for (let xx = x - hx; xx <= x + hx; xx += cell) { const k = ci(xx, zz); if (k < 0 || occ[k]) return false; } return true; };
  for (const r of roads) { const L = Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]); for (let k = 0; k <= L; k += cell) { const t = k / (L || 1); mark(r.from[0] + (r.to[0] - r.from[0]) * t, r.from[1] + (r.to[1] - r.from[1]) * t, r.width / 2, r.width / 2, 2); } }
  mark(plan.spawn.at[0], plan.spawn.at[1], 4, 4, 3);   // a clear spot where you arrive
  const okLand = (x, z, type) => { const T0 = TYPES[type]; if (type === "boat" || type === "pier") return true; if (terrain.isWater(x, z)) return false; const sl = terrain.slopeAt(x, z); return sl < (T0.c === "building" ? 0.35 : T0.c === "plant" || T0.c === "nature" ? 0.9 : 0.5); };
  // ---- the things ----
  const statics = new Map(), dynamics = [], lights = [], cloths = [], sails = [], fires = [], avoid = [], info = [], tmpl = new Map();
  const tpl = (type, v, color, color2, mat) => { const key = type + "|" + v + "|" + (color || "") + "|" + (color2 || ""); if (!tmpl.has(key)) tmpl.set(key, buildModel(T, K, type, v, { rnd: rng(plan.seed + key.length * 131 + v), color, color2, place: plan.place, snow: plan.terrain.ground === "snow" || plan.weather.kind === "snow", low, mat })); return tmpl.get(key); };
  const place = (o, x, z, ry, s, v, idx) => {
    const md = tpl(o.type, v, o.color, o.color2, o.mat), T0 = TYPES[o.type] || TYPES.box, ss = (o.scale || 1) * s;
    let y = terrain.heightAt(x, z);
    if (md.foundation) { y = terrain.flatten(x, z, md.size[0] * ss / 2 + 1, md.size[2] * ss / 2 + 1, 3); }
    if (o.type === "boat" && terrain.water.level > -900 && terrain.isWater(x, z)) y = terrain.water.level - 0.3;
    if (o.type === "pier" && terrain.water.level > -900) y = Math.max(y, terrain.water.level + 0.1);
    const rec = { type: o.type, x, y, z, ry, s: ss, md, idx, name: o.name || o.label || o.type, mat: o.mat || T0.m };
    if (md.collider && (T0.c === "building" || T0.c === "structure")) avoid.push({ x, z, hx: (md.size[0] * ss) / 2 + 0.5, hz: (md.size[2] * ss) / 2 + 0.5 });
    if (o.dyn && md.collider) { dynamics.push(rec); return rec; }
    const k = o.type + "|" + v + "|" + (o.color || "") + "|" + (o.color2 || ""), cx = Math.floor((x + S / 2) / 48), cz = Math.floor((z + S / 2) / 48), key = k + "#" + cx + "," + cz;
    if (!statics.has(key)) statics.set(key, { md, list: [], type: o.type }); statics.get(key).list.push(rec);
    if (md.light) lights.push({ ...md.light, x: x + (md.light.x || 0) * ss, y: y + md.light.y * ss, z, rec });
    if (md.cloth) cloths.push({ w: md.cloth.w, h: md.cloth.h, cy: md.cloth.y, x, y, z, ry, s: ss, color: o.color || md.cloth.color });
    if (md.sails) sails.push({ len: md.sails.len, color: md.sails.color, sy: md.sails.y, sz: md.sails.z, x, y, z, ry, s: ss });
    if (md.fire) fires.push({ size: md.fire.size, fy: md.fire.y, x, y, z, s: ss });
    info.push(rec); return rec;
  };
  const sizeOf = (type, scale) => { const s = (TYPES[type] || TYPES.box).s; return [s[0] * scale / 2 + 0.5, s[2] * scale / 2 + 0.5]; };
  function scatter(o, n, cx, cz, spread, pref) {
    const out = []; const [hx, hz] = sizeOf(o.type, o.scale || 1), T0 = TYPES[o.type] || TYPES.box, big = T0.c === "building";
    for (let i = 0; i < n; i++) {
      let ok = null;
      for (let tries = 0; tries < 30 && !ok; tries++) {
        let x, z;
        if (pref === "front") { const a = Math.atan2(plan.spawn.look[0] - plan.spawn.at[0], plan.spawn.look[1] - plan.spawn.at[1]) + (rnd() - 0.5) * 1.6, d = 3.5 + rnd() * 6 + i * 0.4; x = plan.spawn.at[0] + Math.sin(a) * d; z = plan.spawn.at[1] + Math.cos(a) * d; }
        else if (pref === "ring") { const a = rnd() * 6.283, d = 16 + rnd() * Math.max(10, spread); x = cx + Math.cos(a) * d; z = cz + Math.sin(a) * d; }
        else { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * spread; x = cx + Math.cos(a) * d; z = cz + Math.sin(a) * d; }
        if (o.type === "boat") { if (terrain.isWater(x, z)) ok = [x, z]; continue; }
        if (free(x, z, big ? hx + 2 : hx * 0.7, big ? hz + 2 : hz * 0.7) && okLand(x, z, o.type)) ok = [x, z];
      }
      if (!ok) continue; mark(ok[0], ok[1], big ? hx + 1.5 : hx * 0.6, big ? hz + 1.5 : hz * 0.6, big ? 2 : 1); out.push(ok);
    }
    return out;
  }
  // building lots: in a street grid every block holds up to four lots; along village lanes the houses face the lane
  const lots = [];
  if (P.roads === "grid") { const g = 44, ws = 5 + 1; for (let bx = -Math.floor(S / 2 / g) * g; bx < S / 2 - g / 2; bx += g) for (let bz = -Math.floor(S / 2 / g) * g; bz < S / 2 - g / 2; bz += g) for (const [fx, fz] of [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]]) { const x = bx + ws + (g - 2 * ws) * fx, z = bz + ws + (g - 2 * ws) * fz; if (Math.abs(x) < lim - 10 && Math.abs(z) < lim - 10) lots.push([x, z]); } }
  if (P.roads === "lanes") for (const r of roads) { const L = Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]), dx = (r.to[0] - r.from[0]) / L, dz = (r.to[1] - r.from[1]) / L; for (let k = 10; k < L - 10; k += 13) for (const side of [-1, 1]) lots.push([r.from[0] + dx * k - dz * side * (r.width / 2 + 7), r.from[1] + dz * k + dx * side * (r.width / 2 + 7)]); }
  lots.sort((a, b) => Math.hypot(a[0] - plan.spawn.look[0], a[1] - plan.spawn.look[1]) - Math.hypot(b[0] - plan.spawn.look[0], b[1] - plan.spawn.look[1]));
  const takeLot = (type, scale) => { const [hx, hz] = sizeOf(type, scale || 1); while (lots.length) { const [x, z] = lots.shift(); if (free(x, z, hx * 0.8, hz * 0.8) && okLand(x, z, type)) { mark(x, z, hx + 1, hz + 1, 2); return [x, z]; } } return null; };
  progress(0.3, "things");
  const roomWalls = [];
  if (indoor) buildRoom();
  // the plan's own things first (the main one in the middle, small things in front of you so you can play with them)
  plan.objects.forEach((o, idx) => {
    const T0 = TYPES[o.type] || TYPES.box, small = T0.c === "prop" || T0.c === "fire" || (T0.dyn && T0.c !== "vehicle");
    if (splatWorld && !small) return;
    if (indoor && (T0.c === "furniture" || T0.c === "prop" || T0.c === "fire")) { // inside: along the walls
      const spots = scatter(o, o.count, 0, 0, S * 0.3); spots.forEach(([x, z]) => place(o, x, z, Math.atan2(-x, -z), 1, 0, idx)); return; }
    let spots;
    if (o.at) spots = o.count === 1 ? [o.at] : scatter(o, o.count, o.at[0], o.at[1], o.spread || 8);
    else if (o.hero && idx === 0 && !small) spots = scatter(o, o.count, 0, 0, o.count > 1 ? o.spread : 4);
    else if (small) spots = scatter(o, o.count, plan.spawn.at[0], plan.spawn.at[1], 10, "front");
    else if (T0.c === "building" && lots.length) { spots = []; for (let i = 0; i < o.count; i++) { const l = takeLot(o.type, o.scale); if (l) spots.push(l); } }
    else if (T0.c === "building") spots = scatter(o, o.count, 0, 0, Math.min(lim * 0.8, 14 + o.count * 9), o.count > 1 ? "ring" : null);
    else spots = scatter(o, o.count, 0, 0, o.spread || Math.min(lim * 0.85, 10 + o.count * 4));
    spots.forEach(([x, z], i) => place(o, x, z, o.rot ? (o.rot * Math.PI) / 180 : buildingYaw(x, z, T0), 0.9 + rnd() * 0.2 * (T0.c === "plant" ? 2 : 0.5), (i + idx) % 2, idx));
    if (idx === 0 || o.hero) plan._hero = spots[0] || plan._hero;
  });
  function buildingYaw(x, z, T0) { if (T0.c !== "building" && T0.c !== "street" && T0.c !== "vehicle") return rnd() * 6.283; let best = null, bd = 1e9; for (const r of roads) { const d = segDist(x, z, r); if (d < bd) { bd = d; best = r; } } if (best && bd < 40) { const dx = best.to[0] - best.from[0], dz = best.to[1] - best.from[1]; const nx = -dz, nz = dx, s = (best.from[0] - x) * nx + (best.from[1] - z) * nz > 0 ? 1 : -1; return Math.atan2(nx * s, nz * s); } return Math.atan2(-x, -z); }
  // city blocks / village houses between the streets
  if (P.blocks && plan.dress > 0) {
    const n = Math.round((P.roads === "grid" ? 22 : 14) * plan.dress * (low ? 0.65 : 1));
    for (let i = 0; i < n; i++) { const type = P.blocks[i % P.blocks.length]; if ((plan.exclude || []).includes(type)) continue; const o = { type, count: 1, scale: 1, color: null }; const l = takeLot(type, 1); const sp = l ? [l] : []; sp.forEach(([x, z]) => place(o, x, z, buildingYaw(x, z, TYPES[type]), 0.9 + rnd() * 0.25, i % 3, -1)); }
  }
  // lamps along the streets
  if (roads.length && !indoor && plan.dress > 0 && !(plan.exclude || []).includes("lamp")) for (const r of roads.slice(0, 8)) { if (r.kind === "path" && plan.place !== "park") continue; const L = Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]), dx = (r.to[0] - r.from[0]) / L, dz = (r.to[1] - r.from[1]) / L; for (let k = 12; k < L - 6; k += 26) { const x = r.from[0] + dx * k - dz * (r.width / 2 + 1), z = r.from[1] + dz * k + dx * (r.width / 2 + 1); if (free(x, z, 0.4, 0.4) && okLand(x, z, "lamp")) { mark(x, z, 0.5, 0.5); place({ type: "lamp", scale: 1 }, x, z, Math.atan2(dz, -dx) + Math.PI / 2, 1, 0, -1); } } }
  // the place itself: plants, rocks, the little things that make it feel real
  progress(0.45, "plants");
  if (!indoor && plan.dress > 0) {
    const area = (S * S) / 100, total = Math.min(tier.inst * (low ? 0.55 : 0.8), Math.round(P.density * area * plan.dress * (low ? 0.5 : 1))), wsum = P.dress.reduce((a, d) => a + d[1], 0) || 1;
    for (const [type, w] of P.dress) {
      if ((plan.exclude || []).includes(type)) continue; let n = Math.round((total * w) / wsum); const T0 = TYPES[type]; if (T0.c === "building") n = Math.min(n, 4);
      const o = { type, count: n, scale: 1 }, N = terrain.noise; let placed = 0;
      for (let i = 0; i < n * 2 && placed < n; i++) {
        const x = (rnd() - 0.5) * 2 * lim, z = (rnd() - 0.5) * 2 * lim, cl = N.fbm(x / 38 + 11, z / 38 - 7, 2) * 0.5 + 0.5;   // plants grow in groups
        if (T0.c === "plant" && rnd() > 0.25 + cl * 0.9) continue;
        if (type === "palm" && terrain.water.r && Math.hypot(x - terrain.water.x, z - terrain.water.z) > terrain.water.r * 2.6 && plan.place === "oasis" && rnd() > 0.15) continue;
        if (type === "reeds" && !(terrain.heightAt(x, z) < terrain.water.level + 0.7)) continue;
        const [hx, hz] = sizeOf(type, 1); if (!free(x, z, hx * 0.6, hz * 0.6) || !okLand(x, z, type)) continue;
        if (Math.hypot(x - plan.spawn.at[0], z - plan.spawn.at[1]) < (T0.c === "plant" && T0.s[1] > 3 ? 9 : 5)) continue;
        mark(x, z, hx * 0.5, hz * 0.5); place(o, x, z, rnd() * 6.283, 0.75 + rnd() * 0.55, Math.floor(rnd() * 2), -1); placed++;
      }
    }
  }
  // ---- turn the records into instanced meshes (one chunk of the map per mesh, so the camera skips what it can't see) ----
  progress(0.6, "meshes");
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sv = new T.Vector3(), pv = new T.Vector3(), chunks = [], bbs = [];
  for (const [, g] of statics) {
    const list = g.list, md = g.md;
    for (const k in md.parts) {
      const im = new T.InstancedMesh(md.parts[k], mats[k], list.length); im.castShadow = tier.shadows > 0 && (TYPES[g.type].c === "building" || TYPES[g.type].c === "plant" || TYPES[g.type].c === "nature" || TYPES[g.type].c === "vehicle"); im.receiveShadow = tier.shadows > 0;
      list.forEach((r, i) => { m4.compose(pv.set(r.x, r.y, r.z), q.setFromEuler(e.set(0, r.ry, 0)), sv.set(r.s, r.s, r.s)); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.userData = { type: g.type, list, sway: SWAY[g.type] || 0 }; root.add(im); chunks.push(im);
    }
  }
  // things that move: one mesh each, with a physics body
  const movers = [];
  for (const r of dynamics) { const grp = new T.Group(); for (const k in r.md.parts) { const mm = new T.Mesh(r.md.parts[k], mats[k]); mm.castShadow = tier.shadows > 0; grp.add(mm); } grp.position.set(r.x, r.y + 0.02, r.z); grp.rotation.y = r.ry; grp.scale.setScalar(r.s); grp.userData = { rec: r }; root.add(grp); movers.push(grp);
    if (r.md.light) lights.push({ color: r.md.light.color, power: r.md.light.power, flicker: r.md.light.flicker, y0: r.md.light.y, mover: grp, s: r.s, x: r.x, y: r.y, z: r.z }); }
  // cloth flags, windmill sails, fire
  const flagMeshes = cloths.map((c) => { const g = new T.PlaneGeometry(c.w, c.h, 12, 6); g.translate(c.w / 2, 0, 0); const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: new T.Color(c.color), side: T.DoubleSide, roughness: 0.85 })); m.position.set(c.x, c.y + c.cy * c.s, c.z); m.scale.setScalar(c.s); m.castShadow = tier.shadows > 0; root.add(m); m.userData.base = g.attributes.position.array.slice(); return m; });
  const sailMeshes = sails.map((c) => { const g = new T.Group(); for (let i = 0; i < 4; i++) { const b = new T.Mesh(new T.BoxGeometry(0.9, c.len, 0.05), mats.opaque); b.geometry.translate(0, c.len / 2, 0); const col = new T.Color(c.color), n = b.geometry.attributes.position.count, cc = new Float32Array(n * 3); for (let j = 0; j < n; j++) cc.set([col.r, col.g, col.b], j * 3); b.geometry.setAttribute("color", new T.BufferAttribute(cc, 3)); b.rotation.z = (i * Math.PI) / 2; g.add(b); } g.position.set(c.x + Math.sin(c.ry) * c.sz * c.s, c.y + c.sy * c.s, c.z + Math.cos(c.ry) * c.sz * c.s); g.rotation.y = c.ry; g.scale.setScalar(c.s); root.add(g); return g; });
  const fireTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,240,180,1)"); g.addColorStop(0.35, "rgba(255,160,60,.8)"); g.addColorStop(1, "rgba(255,80,20,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })();
  const fireSprites = fires.map((f) => { const s = new T.Sprite(new T.SpriteMaterial({ map: fireTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true })); s.position.set(f.x, f.y + f.fy * f.s, f.z); s.scale.setScalar(f.size * 2.4 * f.s); root.add(s); return { s, f }; });
  // ---- sky, light, weather, water ----
  progress(0.7, "sky");
  const sky = buildSky(T, plan, tier, rnd, scene); scene.add(sky.group); if (splatWorld) scene.fog = null;   // the sky stays behind the photoreal place (it may not cover all of it)
  const ground = terrain.mesh(roads); if (!indoor && ground) root.add(ground); const far = terrain.farRing(); if (far && !indoor) root.add(far);
  const water = buildWater(T, plan, terrain, tier); root.add(water.group);
  const tintWater = () => { if (water.setSky && sky.colors) water.setSky(sky.colors.horizon, sky.colors.top, sky.night); }; tintWater();
  const weather = buildWeather(T, plan, tier, rnd); scene.add(weather.group);
  const pool = []; for (let i = 0; i < tier.lights; i++) { const l = new T.PointLight(0xffd99a, 0, 18, 1.6); l.visible = false; scene.add(l); pool.push(l); }
  // ---- physics (in the background: you can look around while it loads) ----
  progress(0.8, "physics");
  let physics = null, physicsErr = null;
  if (opts.physics !== false) {
    try { physics = await createPhysics(T, { terrain, gravity: plan.gravity, ground: plan.terrain.ground, water, onEvent: (ev) => events.push(ev) }); }
    catch (err) { physicsErr = String(err && err.message || err); console.warn("nooi 3D: physics unavailable —", physicsErr); }
  }
  const events = [];
  if (physics) {
    let n = 0; for (const r of info) { if (n > 2600) break; const c = r.md.collider; if (!c) continue; physics.addStatic(c.trunk ? { shape: "cyl", r: c.r, hy: c.hy, y: c.y } : c, r.x, r.y, r.z, r.ry, r.s); n++; }
    for (const g of movers) { const r = g.userData.rec; g.userData.body = physics.addDynamic(g, r.md.collider, r.type, r.mat, r.s, { mass: r.md.mass, floats: r.md.floats }); }
    if (indoor) for (const w of roomWalls) physics.addStatic({ shape: "box", hx: w.hx, hy: w.hy, hz: w.hz, y: 0 }, w.x, w.y, w.z, 0, 1);
  }
  // ---- the walker ----
  const host = opts.host || engine.canvas.parentNode;
  const player = createPlayer(T, engine, { host, physics, terrain, water, plan, onAct: (k, at) => act(k, at), onMode: opts.onMode });
  if (indoor) player.setMode("walk");
  scene.add(root);
  progress(1, "ready");
  // ---- every frame ----
  const wind = new T.Vector3(Math.cos(plan.seed % 6.28), 0, Math.sin(plan.seed % 6.28)).multiplyScalar(plan.weather.wind);
  if (physics) physics.wind.copy(wind);
  let lt = 0, gust = 0;
  const off = engine.onFrame((dt, t) => {
    gust = Math.sin(t * 0.7) * 0.3 + Math.sin(t * 1.9) * 0.15; const w = wind.clone().multiplyScalar(1 + gust); if (physics) physics.wind.copy(w);
    player.update(dt, t);
    const cam = player.camera, pos = player.pos;
    if (player.mode !== "walk" && physics) physics.step(dt, {});
    const lifeEv = life ? life.update(dt, t, player.mode === "walk" ? pos : null) : [];
    if (people) people.update(dt, t, player.mode === "walk" || player.mode === "fly" ? pos : null);
    if (!revealed) reveal();
    sky.update(dt, cam, w); weather.update(dt, cam, w, terrain.heightAt(cam.position.x, cam.position.z)); water.update(dt, t, w);
    mats.win.emissiveIntensity = sky.night * 1.25 + (indoor ? 0.2 : 0);
    // trees and grass bend with the wind (only the ones near you)
    if (revealed && t - lt > (low ? 0.08 : 0.04)) { lt = t; const r2 = (low ? 30 : 48) ** 2, k = 0.012 * (1 + plan.weather.wind * 0.25);
      for (const im of chunks) { const sw = im.userData.sway; if (!sw) continue; const L = im.userData.list; let dirty = false;
        for (let i = 0; i < L.length; i++) { const r = L[i], dx = r.x - cam.position.x, dz = r.z - cam.position.z; if (dx * dx + dz * dz > r2) continue; const a = Math.sin(t * 1.7 + r.x * 0.31 + r.z * 0.17) * k * sw * (1 + gust);
          m4.compose(pv.set(r.x, r.y, r.z), q.setFromEuler(e.set(a * (w.z / (wind.length() || 1)), r.ry, -a * (w.x / (wind.length() || 1)))), sv.set(r.s, r.s, r.s)); im.setMatrixAt(i, m4); dirty = true; }
        if (dirty) im.instanceMatrix.needsUpdate = true; } }
    // the nearest lamps and fires get the few real lights (lamps only at night)
    for (const l of lights) if (l.mover) { l.x = l.mover.position.x; l.y = l.mover.position.y + l.y0 * (l.s || 1); l.z = l.mover.position.z; }
    const cands = lights.filter((l) => !l.night || sky.night > 0.35).map((l) => ({ l, d: (l.x - cam.position.x) ** 2 + (l.z - cam.position.z) ** 2 })).sort((a, b) => a.d - b.d);
    pool.forEach((p, i) => { const c = cands[i]; if (!c || c.d > 60 * 60) { p.visible = false; return; } p.visible = true; p.position.set(c.l.x, c.l.y, c.l.z); p.color.set(c.l.color); p.intensity = c.l.power * (c.l.flicker ? 0.8 + Math.sin(t * 13 + i) * 0.12 + Math.sin(t * 29) * 0.08 : 1) * (c.l.beam ? 3 : 1) * 6; });
    for (const { s, f } of fireSprites) { const k = 1 + Math.sin(t * 17 + f.x) * 0.12 + Math.sin(t * 7) * 0.08; s.scale.setScalar(f.size * 2.4 * f.s * k); }
    for (const m of flagMeshes) { const p = m.geometry.attributes.position, b = m.userData.base, ws = w.length(); for (let i = 0; i < p.count; i++) { const x = b[i * 3], u = x / 2.2; p.setZ(i, Math.sin(t * (3 + ws * 0.4) - x * 2.2) * u * (0.12 + Math.min(1, ws / 12) * 0.35)); p.setY(i, b[i * 3 + 1] - u * u * Math.max(0, 0.5 - ws / 20)); } p.needsUpdate = true; m.rotation.y = Math.atan2(-w.z, w.x); }
    for (const g of sailMeshes) g.children.forEach((b, i) => { b.rotation.z = (i * Math.PI) / 2 + t * (0.3 + plan.weather.wind * 0.08); });
    // what happened (splashes, breaks, a car braking for you)
    for (const ev of events.splice(0).concat(lifeEv || [])) handle(ev);
    for (const s of splashes) { s.t += dt; s.m.scale.setScalar(1 + s.t * 5); s.m.material.opacity = Math.max(0, 0.7 - s.t * 0.8); if (s.t > 1) { root.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); s.done = 1; } }
    for (let i = splashes.length - 1; i >= 0; i--) if (splashes[i].done) splashes.splice(i, 1);
    if (Math.abs(cam.position.x) > S * 2) player.teleport(plan.spawn.at[0], plan.spawn.at[1]);
  });
  const life = buildLife(T, K, mats, plan, terrain, water, tier, rnd, { roads, blocked: (x, z) => { const k = ci(x, z); return k >= 0 && occ[k] === 2; }, avoid });
  scene.add(life.group);
  // the people (real-looking 3D people the page adds as their models arrive: see human.js) and what they can walk to
  const SEAT = { bench: 0.45, chair: 0.46, sofa: 0.42, cushions: 0.24, bed: 0.5 };
  const seats = info.filter((r) => SEAT[r.type]).map((r) => ({ x: r.x, z: r.z, yaw: r.ry, h: SEAT[r.type] * r.s }));
  const norm = (v) => String(v || "").toLowerCase().trim();
  function findTarget(name) { const n = norm(name); if (!n) return null;
    const all = info.concat(movers.map((m) => m.userData.rec)), hit = all.find((r) => norm(r.type) === n || norm(r.name) === n) || all.find((r) => norm(r.name).includes(n) || n.includes(norm(r.type)));
    return hit ? { x: hit.x, z: hit.z, r: Math.max(hit.md.size[0], hit.md.size[2]) * hit.s / 2, type: hit.type } : null; }
  const people = createPeople(T, { root, terrain, plan, tier, rnd: rng(plan.seed + 77), blocked: (x, z) => { const k = ci(x, z); return k >= 0 && occ[k] === 2; }, avoid, findTarget, seats });
  // coming to life: the land rises and every thing grows in, from where you stand outwards (about two seconds)
  let revealed = !!opts.noReveal; const born = performance.now(), sp0 = plan.spawn.at;
  const ease = (k) => { const c = 1.70158; return k <= 0 ? 0 : k >= 1 ? 1 : 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
  if (!revealed) { if (ground) ground.scale.y = 0.02; life.group.visible = false; for (const g of movers) g.scale.setScalar(0.001); }
  function reveal() {
    const e = (performance.now() - born) / 1000, done = e > 2.6;
    if (ground) ground.scale.y = done ? 1 : 0.02 + 0.98 * Math.min(1, (e / 0.7) ** 0.6);
    for (const im of chunks) { const L = im.userData.list; for (let i = 0; i < L.length; i++) { const r = L[i], d = Math.min(1.5, Math.hypot(r.x - sp0[0], r.z - sp0[1]) / Math.max(40, S * 0.55) * 1.5), k = done ? 1 : ease((e - 0.35 - d) / 0.55);
        m4.compose(pv.set(r.x, r.y, r.z), q.setFromEuler(e3.set(0, r.ry, 0)), sv.setScalar(Math.max(0.0001, r.s * k))); im.setMatrixAt(i, m4); } im.instanceMatrix.needsUpdate = true; }
    for (const g of movers) { const r = g.userData.rec, d = Math.min(1.5, Math.hypot(r.x - sp0[0], r.z - sp0[1]) / Math.max(40, S * 0.55) * 1.5); g.scale.setScalar(Math.max(0.001, r.s * (done ? 1 : ease((e - 0.4 - d) / 0.55)))); }
    if (e > 1.4) life.group.visible = true;
    if (done) revealed = true;
  }
  const e3 = new T.Euler();
  const splashes = [];
  function handle(ev) {
    if (ev.type === "splash" && water.level > -900) { const m = new T.Mesh(new T.RingGeometry(0.3, 0.45, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(ev.x, water.level + 0.03, ev.z); root.add(m); splashes.push({ m, t: 0 }); }
    if (ev.type === "break" && ev.rec && physics) { // glass and ice shatter into pieces that keep the motion
      const r = ev.rec, g = r.obj, p = g.position.clone(), v = r.body.linvel(); physics.remove(r); root.remove(g);
      for (let i = 0; i < (low ? 5 : 8); i++) { const sz = 0.05 + Math.random() * 0.07 * r.s * 2, shard = new T.Mesh(new T.TetrahedronGeometry(sz), mats.glass); const md = r.md || (g.userData.rec && g.userData.rec.md), n = md && (md.parts.glass || md.parts.opaque), cc = n && n.attributes.color ? n.attributes.color : null;
        const col = new T.Color(cc ? cc.getX(0) : 0.8, cc ? cc.getY(0) : 0.9, cc ? cc.getZ(0) : 0.95), cl = new Float32Array(shard.geometry.attributes.position.count * 3); for (let j = 0; j < cl.length; j += 3) cl.set([col.r, col.g, col.b], j); shard.geometry.setAttribute("color", new T.BufferAttribute(cl, 3));
        shard.position.copy(p).add(new T.Vector3((Math.random() - 0.5) * 0.3, 0.1 + Math.random() * 0.2, (Math.random() - 0.5) * 0.3)); root.add(shard);
        const b = physics.addDynamic(shard, { shape: "ball", r: sz * 0.6, y: 0 }, "shard", r.mat, 1, { mass: 0.02 + Math.random() * 0.05 }); b.breakV = 0; b.body.setLinvel({ x: v.x * 0.6 + (Math.random() - 0.5) * 2.5, y: Math.abs(v.y) * 0.3 + Math.random() * 1.8, z: v.z * 0.6 + (Math.random() - 0.5) * 2.5 }, true); }
    }
    onEvent(ev);
  }
  function act(kind, at) {
    if (!physics) return;
    const ray = player.eyeRay();
    if (kind === "act") { if (physics.held) { const r = physics.throw(ray.dir, 1); if (r) onEvent({ type: "throw", what: r.rec.type, speed: Math.round(r.speed * 10) / 10, mass: r.rec.mass }); } else { const h = physics.grab(ray.origin, ray.dir); if (h) onEvent({ type: "grab", what: h.type, mass: Math.round(h.mass * 10) / 10, mat: h.mat }); else { const k = physics.kick(ray.origin, ray.dir); if (k) onEvent({ type: "push", what: k.type, mass: Math.round(k.mass) }); } } }
    if (kind === "kick") { if (physics.held) { const r = physics.held; physics.drop(); onEvent({ type: "drop", what: r.type, mass: Math.round(r.mass * 10) / 10 }); return; }   // Q with something in your hands lets it go
      const k = physics.kick(ray.origin, ray.dir); if (k) onEvent({ type: "push", what: k.type, mass: Math.round(k.mass) }); }
    if (kind === "tap" && at) { const rc = new T.Raycaster(), rect = engine.canvas.getBoundingClientRect(); rc.setFromCamera(new T.Vector2(((at.x - rect.left) / rect.width) * 2 - 1, -((at.y - rect.top) / rect.height) * 2 + 1), player.camera); rc.far = 60;
      const hits = rc.intersectObjects([...chunks, ...movers], true); if (!hits.length) return; const h = hits[0]; let rec = null;
      if (h.object.isInstancedMesh && h.instanceId != null) rec = h.object.userData.list[h.instanceId]; else { let o = h.object; while (o && !o.userData.rec) o = o.parent; rec = o && o.userData.rec; const b = o && o.userData.body; if (rec && b) rec.mass = b.mass; }
      if (rec) onEvent({ type: "info", what: rec.name || rec.type, type2: rec.type, mat: rec.mat, mass: rec.mass ? Math.round(rec.mass * 10) / 10 : null, dist: Math.round(h.distance * 10) / 10 }); }
  }
  // ---- inside: a room with walls, windows, a door, a ceiling light ----
  function buildRoom() {
    const w = S, h = 3.2, t = 0.2, wallC = plan.terrain.color || (plan.room === "majlis" ? "#efe4cf" : "#eeebe4"), floorC = plan.terrain.color2 || (plan.room === "majlis" ? "#b98a58" : "#c49a6c");
    const fm = new T.Mesh(new T.BoxGeometry(w, 0.1, w), new T.MeshStandardMaterial({ color: floorC, roughness: 0.7 })); fm.position.y = -0.05; fm.receiveShadow = tier.shadows > 0; root.add(fm);
    const wm = new T.MeshStandardMaterial({ color: wallC, roughness: 0.95 }), ceil = new T.Mesh(new T.BoxGeometry(w, 0.1, w), wm); ceil.position.y = h + 0.05; root.add(ceil);
    for (const [x, z, hx, hz] of [[0, -w / 2, w / 2, t], [0, w / 2, w / 2, t], [-w / 2, 0, t, w / 2], [w / 2, 0, t, w / 2]]) { const m = new T.Mesh(new T.BoxGeometry(hx * 2, h, hz * 2), wm); m.position.set(x, h / 2, z); m.receiveShadow = tier.shadows > 0; root.add(m); roomWalls.push({ x, y: h / 2, z, hx, hy: h / 2, hz }); }
    const add = (type, x, z, ry, o = {}) => place({ type, scale: 1, color: o.color || null, color2: o.color2 || null, dyn: (TYPES[type] || {}).dyn }, x, z, ry, 1, 0, -1);
    const k = w / 12; for (const [type, [x, z], ry] of ROOMSET[plan.room] || ROOMSET.living) { if (!(plan.exclude || []).includes(type)) add(type, x * k, z * k, ry, plan.room === "majlis" && type === "cushions" ? { color: "#8e2f2a", color2: "#d4a63a" } : {}); }
    for (const x of [-w * 0.28, w * 0.28]) add("window", x, -w / 2 + 0.25, 0); add("window", w / 2 - 0.25, 0, -Math.PI / 2); add("door", -w / 2 + 0.25, w * 0.25, Math.PI / 2);
    const lamp = new T.Mesh(new T.CylinderGeometry(0.55, 0.7, 0.18, 16), new T.MeshBasicMaterial({ color: 0xfff3dc })); lamp.position.set(0, h - 0.12, 0); root.add(lamp);
    lights.push({ color: "#fff1d6", power: 1.3, x: 0, y: h - 0.9, z: 0 }); lights.push({ color: "#ffe2b0", power: 0.8, x: w * 0.3, y: h - 1.0, z: w * 0.3 });
  }
  // ---- what the page can do with the world ----
  const api = {
    plan, scene, root, terrain, water, sky, physics, physicsErr, player, life, info, act, people, findTarget,
    get revealed() { return revealed; },
    // a real-looking person joins the world (entry: what the plan says about them; url: their 3D model)
    addPerson(entry, url) { return people.add(entry || {}, url); },
    stats() { return { ...engine.stats(), things: info.length + movers.length, movers: movers.length, life: life.count, people: people.count, physics: !!physics, chunks: chunks.length, place: plan.place }; },
    setTime(h) { plan.time = h; sky.setTime(h); tintWater(); }, setWeather(k) { plan.weather.kind = k; sky.setWeather(k); tintWater(); },
    // the AI's 360° picture becomes the sky and also lights the world (soft light and reflections from the place itself)
    async setPanorama(url) { const tex = await new T.TextureLoader().loadAsync(url); sky.setPanorama(tex); plan.pano = url;
      try { const env = tex.clone(); env.mapping = T.EquirectangularReflectionMapping; env.colorSpace = T.SRGBColorSpace; env.needsUpdate = true; if (scene.environment && scene.environment.dispose) scene.environment.dispose(); scene.environment = env; if ("environmentIntensity" in scene) scene.environmentIntensity = 0.5; } catch (e) { console.warn("nooi 3D: light from the panorama", e); } },
    // an AI photo of the ground (seamless, seen from above) covers the land; roads, wet edges, rock and snow stay painted on it
    async setGround(url) { if (!ground || splatWorld) return false; const tex = await new T.TextureLoader().loadAsync(url); tex.colorSpace = T.SRGBColorSpace; tex.wrapS = tex.wrapT = T.RepeatWrapping; const rep = Math.max(4, Math.round(S / 7)); tex.repeat.set(rep, rep); tex.anisotropy = Math.min(8, engine.maxAniso || 8);
      const fresh = terrain.mesh(roads, { plain: true }); if (!fresh) return false; ground.geometry.dispose(); ground.geometry = fresh.geometry; const old = ground.material; ground.material = fresh.material; ground.material.map = tex; ground.material.flatShading = false; ground.material.needsUpdate = true; if (old.map && old.map !== tex) old.map.dispose(); old.dispose(); plan.groundTex = url; return true; },
    // the kinds of plants this world has (most first) — the ones a photo cut-out can replace
    plantTypes() { const m = new Map(); for (const im of chunks) { const t = im.userData.type; if ((TYPES[t] || {}).c !== "plant" || BB_SKIP.has(t)) continue; const s = m.get(t) || new Set(); s.add(im.userData.list); m.set(t, s); }
      return [...m].map(([t, s]) => [t, [...s].reduce((a, L) => a + L.length, 0)]).sort((a, b) => b[1] - a[1]); },
    // a photo of the real plant on a white background becomes two crossed cut-outs at every place the built one stood
    async setBillboard(type, url) { const cv = await keyWhite(url); if (!cv) return 0; const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const lists = new Set(), hide = []; for (const im of chunks) if (im.userData.type === type) { lists.add(im.userData.list); hide.push(im); } if (!lists.size) { tex.dispose(); return 0; }
      for (const b of bbs.filter((x) => x.userData.type === type)) { root.remove(b); b.geometry.dispose(); } bbs.splice(0, bbs.length, ...bbs.filter((x) => x.userData.type !== type));
      const any = [...lists][0][0], h = (any && any.md && any.md.size ? any.md.size[1] : (TYPES[type] || { s: [3, 4, 3] }).s[1]) * 1.04, w = h * (cv.width / cv.height);
      const g1 = new T.PlaneGeometry(w, h); g1.translate(0, h / 2, 0); const g2 = g1.clone(); g2.rotateY(Math.PI / 2);
      const mat = new T.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: T.DoubleSide, roughness: 0.92, metalness: 0 }); let n = 0;
      for (const L of lists) for (const g of [g1, g2]) { const im = new T.InstancedMesh(g, mat, L.length); L.forEach((r, i) => { m4.compose(pv.set(r.x, r.y, r.z), q.setFromEuler(e.set(0, r.ry, 0)), sv.set(r.s, r.s, r.s)); im.setMatrixAt(i, m4); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = tier.shadows > 0; im.receiveShadow = tier.shadows > 0; im.userData = { type, list: L, bb: 1 }; root.add(im); bbs.push(im); n += g === g1 ? L.length : 0; }
      for (const im of hide) im.visible = false; plan.billboards = Object.assign({}, plan.billboards, { [type]: url }); return n; },
    // an AI-made 3D object (a .glb) takes the place of the built one it stands for
    async addModel(url, { i = 0, name = "", at = null } = {}) {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"); const g = await new GLTFLoader().loadAsync(url), obj = g.scene;
      const box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
      const stand = info.find((r) => r.idx === i) || movers.map((m) => m.userData.rec).find((r) => r.idx === i);
      const target = stand ? Math.max(stand.md.size[0], stand.md.size[1], stand.md.size[2]) * stand.s : 2, s = target / Math.max(size.x, size.y, size.z, 0.01);
      obj.position.set(-center.x * s, -box.min.y * s, -center.z * s); obj.scale.setScalar(s); const holder = new T.Group(); holder.add(obj);
      const x = stand ? stand.x : at ? at[0] : player.pos.x + 3, z = stand ? stand.z : at ? at[1] : player.pos.z - 3; holder.position.set(x, terrain.heightAt(x, z), z); holder.rotation.y = stand ? stand.ry : 0;
      obj.traverse((n) => { if (n.isMesh) { n.castShadow = tier.shadows > 0; n.receiveShadow = tier.shadows > 0; } }); root.add(holder);
      if (stand) { for (const im of chunks) { const L = im.userData.list, k = L.indexOf(stand); if (k >= 0) { im.setMatrixAt(k, new T.Matrix4().makeScale(0, 0, 0)); im.instanceMatrix.needsUpdate = true; } } const mv = movers.find((m) => m.userData.rec === stand); if (mv) mv.visible = false; }
      if (physics) physics.addStatic({ shape: "box", hx: (size.x * s) / 2, hy: (size.y * s) / 2, hz: (size.z * s) / 2, y: (size.y * s) / 2 }, x, terrain.heightAt(x, z), z, holder.rotation.y, 1);
      plan.models = (plan.models || []).filter((m) => m.i !== i).concat([{ url, i, name }]); return holder;
    },
    async exportGLB() { const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js"); const out = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true }); return new Blob([out], { type: "model/gltf-binary" }); },
    tour(secs = 12) { player.setMode("tour"); if (player.mode === "tour") { /* the tour length follows the request */ } return secs; },
    splat: splatWorld,
    dispose() { off(); if (splatObj) splatObj.dispose(); player.dispose(); life.dispose(); people.dispose(); if (physics) physics.dispose(); sky.dispose(); disposeTree(root); disposeTree(sky.group); disposeTree(weather.group); disposeTree(life.group); pool.forEach((l) => scene.remove(l)); for (const k in mats) mats[k].dispose(); fireTex.dispose(); tmpl.forEach((md) => { for (const k in md.parts) md.parts[k].dispose(); }); engine.scene = null; }
  };
  // AI parts that were made before (a saved world): the 360° sky and the 3D objects
  if (plan.pano) api.setPanorama(plan.pano).catch((e) => console.warn("panorama", e));
  if (plan.groundTex) api.setGround(plan.groundTex).catch((e) => console.warn("ground", e));
  for (const [t, u] of Object.entries(plan.billboards || {})) api.setBillboard(t, u).catch((e) => console.warn("cut-out", e));
  for (const m of plan.models || []) api.addModel(m.url, m).catch((e) => console.warn("model", e));
  return api;
}

// ---- before anything is written: an empty, calm stage (no world is made until the words or a picture arrive) — a soft sky,
// a quiet floor with light rings and a few floating lights, the camera slowly turning. Light on any phone.
export function createEmpty(engine) {
  const T = engine.T, scene = new T.Scene(), root = new T.Group(); engine.scene = scene; scene.add(root);
  const night = (() => { const h = new Date().getHours(); return h < 6 || h >= 19; })();
  const top = new T.Color(night ? "#0b1220" : "#bcd6ee"), mid = new T.Color(night ? "#1c2a3f" : "#e9eef2"), low = new T.Color(night ? "#22324a" : "#f4efe6");
  const sg = new T.SphereGeometry(400, 32, 16), cols = new Float32Array(sg.attributes.position.count * 3), c = new T.Color();
  for (let i = 0; i < sg.attributes.position.count; i++) { const y = sg.attributes.position.getY(i) / 400; if (y > 0) c.copy(mid).lerp(top, Math.min(1, y * 1.6)); else c.copy(mid).lerp(low, Math.min(1, -y * 3)); cols.set([c.r, c.g, c.b], i * 3); }
  sg.setAttribute("color", new T.BufferAttribute(cols, 3)); root.add(new T.Mesh(sg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, depthWrite: false })));
  const tex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 512; const x = cv.getContext("2d"), g = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, night ? "rgba(120,170,220,.38)" : "rgba(255,255,255,.95)"); g.addColorStop(0.55, night ? "rgba(70,110,160,.16)" : "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = night ? "rgba(160,200,240,.22)" : "rgba(120,140,150,.2)"; x.lineWidth = 1.2; for (let r = 40; r < 256; r += 36) { x.beginPath(); x.arc(256, 256, r, 0, Math.PI * 2); x.stroke(); }
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t; })();
  const floor = new T.Mesh(new T.CircleGeometry(36, 64), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); floor.rotation.x = -Math.PI / 2; root.add(floor);
  const ringM = new T.MeshBasicMaterial({ color: night ? 0x9cc8ff : 0x8fd14f, transparent: true, opacity: 0.55 }), rings = [];
  for (let i = 0; i < 3; i++) { const r = new T.Mesh(new T.TorusGeometry(3 + i * 2.2, 0.025, 6, 96), ringM.clone()); r.rotation.x = -Math.PI / 2; r.position.y = 0.02 + i * 0.01; root.add(r); rings.push(r); }
  const N = 46, dots = new T.InstancedMesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshBasicMaterial({ color: night ? 0xcfe6ff : 0xffffff, transparent: true, opacity: 0.85 }), N), seeds = [];
  for (let i = 0; i < N; i++) seeds.push([Math.random() * 6.283, 2 + Math.random() * 9, Math.random() * 4, 0.2 + Math.random() * 0.5]); root.add(dots);
  const cam = new T.PerspectiveCamera(50, 1, 0.1, 900); engine.camera = cam; const m4 = new T.Matrix4();
  const off = engine.onFrame((dt, t) => {
    const a = t * 0.06; cam.position.set(Math.sin(a) * 15, 5.2 + Math.sin(t * 0.21) * 0.4, Math.cos(a) * 15); cam.lookAt(0, 1.2, 0);
    rings.forEach((r, i) => { const k = (t * 0.25 + i / 3) % 1; r.scale.setScalar(0.6 + k * 1.6); r.material.opacity = 0.5 * (1 - k); });
    for (let i = 0; i < N; i++) { const [ph, rad, h, sp] = seeds[i], y = (h + t * sp) % 6; m4.makeTranslation(Math.cos(ph + t * 0.05) * rad, 0.3 + y, Math.sin(ph + t * 0.05) * rad); dots.setMatrixAt(i, m4); }
    dots.instanceMatrix.needsUpdate = true;
  });
  return { empty: true, scene, dispose() { off(); disposeTree(root); tex.dispose(); } };
}
