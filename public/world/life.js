// Life: animals, birds, fish, cars and boats that move by themselves and notice you (people are real 3D people: human.js) — a dog follows you, people stop
// and turn to you, deer and birds run off when you run at them, cars brake when you step in front of them (stopping distance
// from the road surface, the same friction table as the physics). Every species is a handful of instanced parts, so 40 people
// are still ~6 draw calls; each part swings from its own joint (legs, arms, wings, tails) every frame.
import { buildModel, PALETTE } from "./assets.js";
import { SURFACES, G } from "./materials.js";
const SKIN = ["#f1c9a5", "#e0ac7e", "#c68e5f", "#a8734a", "#8a5a36", "#5e3b25"], CLOTH = ["#2f6fd6", "#d63a32", "#3e9b47", "#e8c22c", "#f4f4f0", "#1d1f22", "#7d4fc4", "#ec7a2d", "#5b6b7a", "#c9a54a"];

function species(T, K, type, rnd) {
  const { M } = K, P = []; // parts: { geo, mat, pivot:[x,y,z], anim, tint }
  const part = (anim, pivot, build, mat = "opaque", tint = null) => { const m = K.Model(); build(m); const d = m.done([1, 1, 1]); for (const k in d.parts) P.push({ geo: d.parts[k], mat: k === "opaque" ? mat : k, pivot, anim, tint: k === "opaque" ? tint : null }); };
  const quad = (o) => { // a four-legged animal
    const { len, h, w, leg, neck, head, col, col2 = col, hump = 0, tail = 0.4, horns = 0, ears = 0.1 } = o;
    part("body", [0, 0, 0], (m) => { m.box(w, h, len, col, M(0, leg + h / 2, 0)); if (hump) m.sphere(hump, 8, 5, col, M(0, leg + h, -len * 0.05), "opaque", Math.PI * 2, Math.PI / 2); });
    part("head", [0, leg + h * 0.8, len / 2], (m) => { m.box(w * 0.42, w * 0.42, neck, col, M(0, neck * 0.35, neck * 0.32, -0.9, 0, 0)); m.box(head * 0.7, head * 0.75, head * 1.15, col2, M(0, neck * 0.72, neck * 0.62 + head * 0.35));
      m.box(head * 0.16, ears, head * 0.1, col2, M(head * 0.26, neck * 0.72 + head * 0.45, neck * 0.62 + head * 0.1)); m.box(head * 0.16, ears, head * 0.1, col2, M(-head * 0.26, neck * 0.72 + head * 0.45, neck * 0.62 + head * 0.1));
      if (horns) { m.cone(0.05, horns, 4, "#d8cdb0", M(head * 0.2, neck * 0.72 + head * 0.55, neck * 0.62, -0.4, 0, -0.3)); m.cone(0.05, horns, 4, "#d8cdb0", M(-head * 0.2, neck * 0.72 + head * 0.55, neck * 0.62, -0.4, 0, 0.3)); }
      m.box(head * 0.1, head * 0.1, 0.02, "#111", M(head * 0.25, neck * 0.78, neck * 0.62 + head * 0.7)); m.box(head * 0.1, head * 0.1, 0.02, "#111", M(-head * 0.25, neck * 0.78, neck * 0.62 + head * 0.7)); });
    for (const [n, x, z] of [["legFL", w * 0.3, len * 0.38], ["legFR", -w * 0.3, len * 0.38], ["legBL", w * 0.3, -len * 0.38], ["legBR", -w * 0.3, -len * 0.38]]) part(n, [x, leg, z], (m) => m.box(w * 0.2, leg, w * 0.2, col2, M(0, -leg / 2, 0)));
    if (tail) part("tail", [0, leg + h * 0.75, -len / 2], (m) => m.box(0.06, 0.06, tail, col2, M(0, -tail * 0.3, -tail * 0.4, 0.8, 0, 0)));
  };
  const bird = (o) => { const { s, col, col2 = col, beak = "#e8a33a" } = o;
    part("body", [0, 0, 0], (m) => { m.ico(s * 0.3, 0, col, M(0, 0, 0, 0, 0, 0, 0.8, 0.7, 1.4)); m.ico(s * 0.17, 0, col2, M(0, s * 0.12, s * 0.38)); m.cone(s * 0.05, s * 0.16, 4, beak, M(0, s * 0.1, s * 0.56, Math.PI / 2, 0, 0)); m.box(s * 0.2, 0.02, s * 0.3, col2, M(0, 0, -s * 0.48)); });
    part("wingL", [s * 0.15, s * 0.05, 0], (m) => m.box(s * 0.9, 0.03, s * 0.32, col2, M(s * 0.45, 0, 0)));
    part("wingR", [-s * 0.15, s * 0.05, 0], (m) => m.box(s * 0.9, 0.03, s * 0.32, col2, M(-s * 0.45, 0, 0))); };
  switch (type) {
    case "person": case "child": { const k = type === "child" ? 0.62 : 1;
      part("legL", [0.1 * k, 0.9 * k, 0], (m) => m.box(0.13 * k, 0.9 * k, 0.15 * k, "#ffffff", M(0, -0.45 * k, 0)), "opaque", "pants");
      part("legR", [-0.1 * k, 0.9 * k, 0], (m) => m.box(0.13 * k, 0.9 * k, 0.15 * k, "#ffffff", M(0, -0.45 * k, 0)), "opaque", "pants");
      part("body", [0, 0, 0], (m) => { m.box(0.42 * k, 0.62 * k, 0.24 * k, "#ffffff", M(0, 1.22 * k, 0)); }, "opaque", "shirt");
      part("head", [0, 1.55 * k, 0], (m) => { m.box(0.2 * k, 0.24 * k, 0.22 * k, "#ffffff", M(0, 0.12 * k, 0)); m.box(0.06 * k, 0.03 * k, 0.01, "#1d1f22", M(0.05 * k, 0.15 * k, 0.11 * k)); m.box(0.06 * k, 0.03 * k, 0.01, "#1d1f22", M(-0.05 * k, 0.15 * k, 0.11 * k)); }, "opaque", "skin");
      part("hair", [0, 1.55 * k, 0], (m) => m.box(0.22 * k, 0.09 * k, 0.24 * k, "#ffffff", M(0, 0.27 * k, -0.01)), "opaque", "hair");
      part("armL", [0.27 * k, 1.5 * k, 0], (m) => m.box(0.1 * k, 0.6 * k, 0.12 * k, "#ffffff", M(0, -0.3 * k, 0)), "opaque", "shirt");
      part("armR", [-0.27 * k, 1.5 * k, 0], (m) => m.box(0.1 * k, 0.6 * k, 0.12 * k, "#ffffff", M(0, -0.3 * k, 0)), "opaque", "shirt");
      return { P, h: 1.75 * k, speed: 1.3, kind: "walk" }; }
    case "robe": { // a thobe or an abaya — long garment, a head cloth
      part("legL", [0.08, 0.6, 0], (m) => m.box(0.12, 0.6, 0.13, "#ffffff", M(0, -0.3, 0)), "opaque", "shirt");
      part("legR", [-0.08, 0.6, 0], (m) => m.box(0.12, 0.6, 0.13, "#ffffff", M(0, -0.3, 0)), "opaque", "shirt");
      part("body", [0, 0, 0], (m) => { m.cyl(0.21, 0.27, 1.0, 8, "#ffffff", M(0, 1.05, 0)); }, "opaque", "shirt");
      part("head", [0, 1.55, 0], (m) => { m.box(0.19, 0.23, 0.21, "#ffffff", M(0, 0.12, 0)); m.box(0.05, 0.03, 0.01, "#1d1f22", M(0.05, 0.15, 0.105)); m.box(0.05, 0.03, 0.01, "#1d1f22", M(-0.05, 0.15, 0.105)); }, "opaque", "skin");
      part("hair", [0, 1.55, 0], (m) => { m.box(0.26, 0.12, 0.27, "#ffffff", M(0, 0.27, -0.01)); m.box(0.27, 0.36, 0.08, "#ffffff", M(0, 0.06, -0.13)); }, "opaque", "headwear");
      part("armL", [0.25, 1.48, 0], (m) => m.box(0.11, 0.6, 0.13, "#ffffff", M(0, -0.3, 0)), "opaque", "shirt");
      part("armR", [-0.25, 1.48, 0], (m) => m.box(0.11, 0.6, 0.13, "#ffffff", M(0, -0.3, 0)), "opaque", "shirt");
      return { P, h: 1.75, speed: 1.2, kind: "walk" }; }
    case "camel": quad({ len: 1.9, h: 0.75, w: 0.62, leg: 1.35, neck: 1.0, head: 0.42, col: "#c9a067", col2: "#b58d58", hump: 0.42, tail: 0.5 }); return { P, h: 2.4, speed: 1.4, kind: "wander" };
    case "horse": quad({ len: 1.8, h: 0.7, w: 0.55, leg: 1.0, neck: 0.85, head: 0.36, col: pickc(rnd, ["#6b4a2f", "#2b2522", "#e9e2d2", "#8a5a36"]), tail: 0.7, ears: 0.14 }); return { P, h: 1.7, speed: 2.2, kind: "wander" };
    case "cow": quad({ len: 1.9, h: 0.85, w: 0.75, leg: 0.75, neck: 0.4, head: 0.4, col: pickc(rnd, ["#f2efe8", "#6b4a2f", "#2b2522"]), col2: "#2b2522", horns: 0.2, tail: 0.6 }); return { P, h: 1.5, speed: 0.6, kind: "graze" };
    case "sheep": quad({ len: 0.95, h: 0.6, w: 0.62, leg: 0.42, neck: 0.25, head: 0.24, col: "#f1ece0", col2: "#2b2522", tail: 0.15 }); return { P, h: 0.9, speed: 0.6, kind: "graze" };
    case "goat": quad({ len: 0.9, h: 0.45, w: 0.4, leg: 0.5, neck: 0.3, head: 0.22, col: pickc(rnd, ["#2b2522", "#8a5a36", "#e9e2d2"]), horns: 0.22, tail: 0.15 }); return { P, h: 0.9, speed: 0.8, kind: "graze" };
    case "deer": quad({ len: 1.1, h: 0.5, w: 0.38, leg: 0.8, neck: 0.55, head: 0.24, col: "#c69a63", col2: "#b98a55", horns: 0.3, tail: 0.12, ears: 0.16 }); return { P, h: 1.3, speed: 1.4, kind: "wander", shy: 1 };
    case "dog": quad({ len: 0.75, h: 0.32, w: 0.28, leg: 0.36, neck: 0.25, head: 0.24, col: pickc(rnd, ["#c69a63", "#2b2522", "#e9e2d2", "#8a5a36"]), tail: 0.32, ears: 0.12 }); return { P, h: 0.7, speed: 2.4, kind: "follow" };
    case "cat": quad({ len: 0.48, h: 0.2, w: 0.17, leg: 0.2, neck: 0.12, head: 0.15, col: pickc(rnd, ["#e8a050", "#2b2522", "#9a9a9a", "#f1ece0"]), tail: 0.32, ears: 0.07 }); return { P, h: 0.35, speed: 1.0, kind: "wander" };
    case "bird": bird({ s: 0.35, col: pickc(rnd, ["#6b5a48", "#3a4a5a", "#c0392b"]), col2: "#4a3a2c" }); return { P, h: 0.2, speed: 6, kind: "fly" };
    case "seagull": bird({ s: 0.5, col: "#f4f4f0", col2: "#b9c0c6" }); return { P, h: 0.3, speed: 7, kind: "fly" };
    case "eagle": bird({ s: 1.0, col: "#6b4a2f", col2: "#4a321f", beak: "#e8c22c" }); return { P, h: 0.5, speed: 9, kind: "soar" };
    case "duck": part("body", [0, 0, 0], (m) => { m.ico(0.2, 0, "#e9e2d2", M(0, 0.1, 0, 0, 0, 0, 0.9, 0.7, 1.3)); m.ico(0.11, 0, "#2f7d4f", M(0, 0.28, 0.2)); m.cone(0.04, 0.1, 4, "#e8a33a", M(0, 0.27, 0.33, Math.PI / 2, 0, 0)); }); return { P, h: 0.3, speed: 0.4, kind: "float" };
    case "fish": { const c = pickc(rnd, ["#ff8a3a", "#3fa6c8", "#f2d16b", "#e74c5b", "#9b7bff"]);
      part("body", [0, 0, 0], (m) => { m.ico(0.18, 0, c, M(0, 0, 0, 0, 0, 0, 0.45, 0.8, 1.5)); m.ico(0.03, 0, "#111", M(0.06, 0.04, 0.17)); m.ico(0.03, 0, "#111", M(-0.06, 0.04, 0.17)); });
      part("tail", [0, 0, -0.24], (m) => m.cone(0.13, 0.22, 3, c, M(0, 0, -0.1, -Math.PI / 2, 0, 0, 0.3, 1, 1))); return { P, h: 0.3, speed: 1.2, kind: "swim" }; }
    case "butterfly": { const c = pickc(rnd, PALETTE.flower);
      part("body", [0, 0, 0], (m) => m.box(0.02, 0.02, 0.1, "#1d1f22", M(0, 0, 0)));
      part("wingL", [0.01, 0, 0], (m) => m.box(0.09, 0.005, 0.08, c, M(0.045, 0, 0))); part("wingR", [-0.01, 0, 0], (m) => m.box(0.09, 0.005, 0.08, c, M(-0.045, 0, 0))); return { P, h: 0.1, speed: 1.2, kind: "flutter" }; }
    case "plane": part("body", [0, 0, 0], (m) => { m.cyl(0.9, 0.9, 16, 10, "#f4f4f0", M(0, 0, 0, Math.PI / 2, 0, 0), "shiny"); m.cone(0.9, 2.5, 10, "#f4f4f0", M(0, 0, 9.2, Math.PI / 2, 0, 0), "shiny"); m.box(18, 0.25, 2.6, "#d9dde1", M(0, -0.2, 0.5), "shiny"); m.box(5.5, 0.2, 1.4, "#d9dde1", M(0, 0.2, -7.2), "shiny"); m.box(0.2, 3, 1.8, "#2f6fd6", M(0, 1.6, -7.2)); });
      return { P, h: 2, speed: 70, kind: "flyby" };
    default: return null;
  }
}
const pickc = (rnd, l) => l[Math.floor(rnd() * l.length) % l.length];

export function buildLife(T, K, mats, plan, terrain, water, tier, rnd, { roads = [], blocked = () => false, avoid = [] } = {}) {
  const group = new T.Group(); group.name = "nooi_life";
  const S = plan.size, lim = S / 2 - 4, groups = [];
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), one = new T.Vector3(1, 1, 1), pos = new T.Vector3(), piv = new T.Matrix4(), rot = new T.Matrix4(), col = new T.Color();
  const wlvl = water ? water.level : -999, under = plan.water.kind === "deep";
  const [ox, oz] = terrain.center || [0, 0];   // a photoreal (World Labs) place may not be centred on 0
  const land = (x, z) => Math.abs(x - ox) < lim && Math.abs(z - oz) < lim && !terrain.isWater(x, z) && terrain.slopeAt(x, z) < 0.7 && !blocked(x, z) && (terrain.spawnY == null || Math.abs(terrain.heightAt(x, z) - terrain.spawnY) < 1.6);
  const wet = (x, z) => under || terrain.isWater(x, z);
  const findSpot = (cx, cz, r, ok, tries = 40) => { for (let i = 0; i < tries; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (ok(x, z)) return [x, z]; } return null; };
  const want = [];
  // people are never drawn here any more: they are real-looking 3D people (human.js), added by the page as their models arrive
  const HUMAN = new Set(["person", "child", "robe"]);
  for (const l of plan.life) if (!HUMAN.has(l.type)) want.push({ type: l.type, count: Math.max(1, Math.ceil(l.count * Math.max(0.8, tier.life) - 0.01)), at: l.at, spread: l.spread });   // what was asked for stays (almost) all there
  // a little life the place always has (birds in the sky, fish in a lake) unless the plan already asked for it
  const PL = { meadow: [["bird", 5], ["butterfly", 5]], park: [["person", 6], ["dog", 1], ["bird", 5]], forest: [["bird", 6], ["deer", 2]], rainforest: [["bird", 8], ["butterfly", 6]], mountain: [["eagle", 2]], snow: [["bird", 2]],
    desert: [["camel", 3], ["eagle", 1]], oasis: [["camel", 3], ["bird", 4]], beach: [["seagull", 5], ["person", 3]], island: [["seagull", 5]], lake: [["duck", 4], ["bird", 5]], canyon: [["eagle", 2]], city: [["person", 12], ["car", 6], ["bird", 2]],
    village: [["person", 8], ["goat", 3], ["bird", 3]], farm: [["cow", 4], ["sheep", 5], ["bird", 4]], underwater: [["fish", 24]] }[plan.place] || [];
  if (plan.dress > 0) for (const [t, n] of PL) if (!HUMAN.has(t) && !want.some((w) => w.type === t) && !(plan.exclude || []).includes(t)) want.push({ type: t, count: Math.max(1, Math.round(n * tier.life * plan.dress)) });
  if (["lake", "pond", "oasis", "river", "sea"].includes(plan.water.kind) && !want.some((w) => w.type === "fish") && plan.place !== "underwater") want.push({ type: "fish", count: Math.round(8 * tier.life) });
  const vgroups = [];
  const robeShare = ["village", "desert", "oasis", "city"].includes(plan.place) ? 0.6 : 0.2;
  for (const w of want) {
    const list = w.type === "person" ? [["robe", Math.round(w.count * robeShare)], ["person", w.count - Math.round(w.count * robeShare)]] : [[w.type, w.count]];
    for (const [type, n] of list) { if (n <= 0) continue;
      if (type === "car" || type === "bus" || type === "boat") { vehicles(type, n, w); continue; }
      const sp = species(T, K, type, rnd); if (!sp) continue;
      const agents = [];
      for (let i = 0; i < n; i++) {
        const cx = w.at ? w.at[0] : 0, cz = w.at ? w.at[1] : 0, r = w.spread || lim * 0.7;
        let spot = null;
        if (sp.kind === "swim" || sp.kind === "float") { const W = terrain.water; spot = W.r ? findSpot(W.x, W.z, W.r * 0.9, wet) : findSpot(cx, cz, r, wet, 80); }
        else if (sp.kind === "fly" || sp.kind === "soar" || sp.kind === "flyby") spot = [cx + (rnd() - 0.5) * r, cz + (rnd() - 0.5) * r];
        else spot = findSpot(cx, cz, r, land) || findSpot(plan.spawn.at[0], plan.spawn.at[1], 30, land);
        if (!spot) continue;
        const a = { x: spot[0], z: spot[1], y: 0, yaw: rnd() * 6.283, speed: 0, phase: rnd() * 10, tx: spot[0], tz: spot[1], wait: rnd() * 3, cx: spot[0], cz: spot[1], r: 10 + rnd() * 30, alt: 0, k: rnd() > 0.5 ? 1 : -1, v: 0,
          tint: { shirt: type === "robe" ? (rnd() < 0.55 ? "#f4f4f0" : "#151517") : pickc(rnd, CLOTH), pants: pickc(rnd, ["#2b3a5a", "#3b3e42", "#6b5a48", "#1d1f22"]), skin: pickc(rnd, SKIN), hair: pickc(rnd, ["#1d1612", "#3a2a1c", "#6b4a2f", "#c9a067", "#2b2522"]), headwear: null } };
        if (type === "robe") a.tint.headwear = a.tint.shirt === "#151517" ? "#151517" : rnd() < 0.5 ? "#f4f4f0" : "#c8443a";
        if (sp.kind === "fly") a.alt = 12 + rnd() * 20; if (sp.kind === "soar") a.alt = 40 + rnd() * 30; if (sp.kind === "flyby") { a.alt = 160 + rnd() * 60; a.x = -tier.far * 0.8; a.z = (rnd() - 0.5) * 300; a.yaw = Math.PI / 2; }
        if (sp.kind === "flutter") a.alt = 0.6 + rnd() * 1.2;
        agents.push(a);
      }
      if (!agents.length) continue;
      const parts = sp.P.map((p) => { const im = new T.InstancedMesh(p.geo, mats[p.mat], agents.length); im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.castShadow = tier.shadows > 0 && sp.h > 0.8; im.frustumCulled = false;
        if (p.tint) { for (let i = 0; i < agents.length; i++) im.setColorAt(i, col.set(agents[i].tint[p.tint] || "#ffffff")); im.instanceColor.needsUpdate = true; } group.add(im); return { ...p, im }; });
      groups.push({ type, sp, agents, parts });
    }
  }
  // cars and boats: whole models that move along roads / over the water
  function vehicles(type, n, w) {
    const md = buildModel(T, K, type, 0, { rnd, place: plan.place }), ims = [], agents = [];
    for (let i = 0; i < n; i++) {
      if (type === "boat") { const W = terrain.water; const s = W.sea ? findSpot(0, -S * 0.35, S * 0.25, wet, 80) : W.r ? findSpot(W.x, W.z, W.r * 0.7, wet) : null; if (!s) continue; agents.push({ x: s[0], z: s[1], cx: s[0], cz: s[1], r: 6 + rnd() * 12, yaw: 0, phase: rnd() * 6, k: rnd() > 0.5 ? 1 : -1 }); }
      else { if (!roads.length) continue; const r = roads[i % roads.length]; agents.push({ road: r, t: rnd(), dir: rnd() > 0.5 ? 1 : -1, v: 9 + rnd() * 4, vmax: 9 + rnd() * 4, lane: (r.width / 4) * (rnd() > 0.5 ? 1 : -1), x: 0, z: 0, yaw: 0 }); }
    }
    if (!agents.length) return;
    for (const k in md.parts) { const im = new T.InstancedMesh(md.parts[k], mats[k], agents.length); im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.castShadow = tier.shadows > 0; im.frustumCulled = false;
      if (k === "shiny" && type !== "boat") { for (let i = 0; i < agents.length; i++) im.setColorAt(i, col.set(pickc(rnd, PALETTE.car))); im.instanceColor.needsUpdate = true; } group.add(im); ims.push(im); }
    vgroups.push({ type, ims, agents, md });
  }
  const mu = (SURFACES[{ asphalt: "asphalt", sand: "sand", snow: "snow", dirt: "gravel" }[plan.terrain.ground] || "asphalt"] || SURFACES.asphalt).mu * (plan.weather.kind === "rain" || plan.weather.kind === "storm" ? 0.6 : 1);
  let events = [];
  function update(dt, t, player) {
    const px = player ? player.x : 1e9, pz = player ? player.z : 1e9, running = player && player.running;
    for (const g of groups) {
      const { sp, agents, parts } = g;
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i], dP = Math.hypot(px - a.x, pz - a.z);
        switch (sp.kind) {
          case "walk": case "wander": case "graze": case "follow": {
            if (sp.kind === "follow" && dP < 40) { if (dP > 3.5) { a.tx = px; a.tz = pz; a.wait = 0; } else { a.wait = 1; } }
            else if (sp.shy && running && dP < 14) { a.tx = a.x + (a.x - px) * 2; a.tz = a.z + (a.z - pz) * 2; a.wait = 0; a.flee = 2; }
            const near = sp.kind === "walk" && dP < 3 && player;
            if (near) { a.speed = Math.max(0, a.speed - dt * 4); const want = Math.atan2(px - a.x, pz - a.z); a.yaw += angleTo(a.yaw, want) * Math.min(1, dt * 4); }
            else if (a.wait > 0) { a.wait -= dt; a.speed = Math.max(0, a.speed - dt * 3); }
            else { const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
              if (d < 0.8) { a.wait = sp.kind === "graze" ? 3 + rnd() * 6 : 1 + rnd() * 4; const s = findSpot(a.x, a.z, sp.kind === "walk" ? 30 : 18, land, 12); if (s) { a.tx = s[0]; a.tz = s[1]; } }
              else { const want = Math.atan2(dx, dz); a.yaw += angleTo(a.yaw, want) * Math.min(1, dt * 3); const top = sp.speed * (a.flee ? 2.5 : 1) * (sp.kind === "follow" && dP > 10 ? 2 : 1); a.speed += (top - a.speed) * Math.min(1, dt * 2); }
              if (a.flee) a.flee = Math.max(0, a.flee - dt); }
            const nx = a.x + Math.sin(a.yaw) * a.speed * dt, nz = a.z + Math.cos(a.yaw) * a.speed * dt;
            if (land(nx, nz) && !hitsAvoid(nx, nz)) { a.x = nx; a.z = nz; } else { a.yaw += Math.PI * (0.5 + rnd() * 0.5); a.tx = a.x; a.tz = a.z; }
            a.y = terrain.heightAt(a.x, a.z); a.phase += a.speed * dt * (sp.h > 1.5 ? 3.2 : 6); break; }
          case "fly": case "soar": {
            const flee = running && dP < 12 && a.alt < 6; if (flee) a.alt += dt * 8;
            a.phase += dt * (sp.kind === "soar" ? 0.15 : 0.5) * a.k; const r = a.r; a.x = a.cx + Math.cos(a.phase) * r; a.z = a.cz + Math.sin(a.phase) * r; a.yaw = a.phase * 1 + (a.k > 0 ? 0 : Math.PI) + Math.PI;
            a.y = Math.max(terrain.heightAt(a.x, a.z) + 4, (under ? wlvl - 6 : 0) + a.alt + Math.sin(t * 0.7 + i) * 1.5); a.flap = sp.kind === "soar" ? Math.sin(t * 0.6 + i) * 0.15 : Math.sin(t * 14 + i * 2); break; }
          case "flyby": { a.x += sp.speed * dt; a.yaw = Math.PI / 2; a.y = a.alt; if (a.x > tier.far * 0.9) { a.x = -tier.far * 0.9; a.z = (rnd() - 0.5) * 300; } break; }
          case "flutter": { a.phase += dt; a.x += Math.sin(a.phase * 1.3 + i) * dt * 1.2; a.z += Math.cos(a.phase * 0.9 + i * 2) * dt * 1.2; if (Math.hypot(a.x - a.cx, a.z - a.cz) > 8) { a.x += (a.cx - a.x) * dt; a.z += (a.cz - a.z) * dt; } a.yaw = Math.sin(a.phase) * 3; a.y = terrain.heightAt(a.x, a.z) + a.alt + Math.sin(a.phase * 3) * 0.3; a.flap = Math.sin(t * 30 + i); break; }
          case "float": case "swim": {
            a.phase += dt * 0.12 * a.k; const W = terrain.water, cx = W.r ? W.x : a.cx, cz = W.r ? W.z : a.cz, r = W.r ? W.r * 0.6 * (0.4 + (i % 5) / 6) : a.r;
            const nx = cx + Math.cos(a.phase) * r, nz = cz + Math.sin(a.phase) * r; if (wet(nx, nz)) { a.yaw = Math.atan2(nx - a.x, nz - a.z); a.x = nx; a.z = nz; }
            a.y = sp.kind === "float" ? wlvl + Math.sin(t * 2 + i) * 0.02 : Math.max(terrain.heightAt(a.x, a.z) + 0.5, Math.min(wlvl - 0.6, wlvl - 1.2 - (i % 4) * 0.8)); a.flap = Math.sin(t * 8 + i); break; }
        }
        // the parts follow their joints
        for (const p of parts) {
          e.set(0, a.yaw, 0); q.setFromEuler(e); m4.compose(pos.set(a.x, a.y + bob(sp, a), a.z), q, one);
          const s = Math.sin(a.phase), amp = Math.min(1, a.speed / Math.max(0.5, sp.speed)) * 0.6;
          let rx = 0, ry = 0, rz = 0;
          switch (p.anim) { case "legL": case "legFL": case "legBR": rx = s * amp; break; case "legR": case "legFR": case "legBL": rx = -s * amp; break; case "armL": rx = -s * amp * 0.8; break; case "armR": rx = s * amp * 0.8; break;
            case "wingL": rz = (a.flap || 0) * 0.8; break; case "wingR": rz = -(a.flap || 0) * 0.8; break; case "tail": ry = sp.kind === "swim" ? (a.flap || 0) * 0.5 : Math.sin(t * (sp.kind === "follow" ? 12 : 3) + i) * 0.4; break;
            case "head": rx = sp.kind === "graze" && a.speed < 0.1 ? 0.55 : 0; break; }
          piv.makeTranslation(p.pivot[0], p.pivot[1], p.pivot[2]); e.set(rx, ry, rz); rot.makeRotationFromEuler(e); m4.multiply(piv).multiply(rot);
          p.im.setMatrixAt(i, m4);
        }
      }
      for (const p of parts) p.im.instanceMatrix.needsUpdate = true;
    }
    for (const g of vgroups) {
      for (let i = 0; i < g.agents.length; i++) {
        const a = g.agents[i];
        if (g.type === "boat") { a.phase += dt * 0.05 * a.k; a.x = a.cx + Math.cos(a.phase) * a.r; a.z = a.cz + Math.sin(a.phase) * a.r; a.yaw = a.phase + (a.k > 0 ? 0 : Math.PI); e.set(Math.sin(t * 1.1 + i) * 0.05, a.yaw, Math.sin(t * 0.9 + i) * 0.07); q.setFromEuler(e); m4.compose(pos.set(a.x, wlvl - 0.25 + Math.sin(t * 1.4 + i) * 0.08, a.z), q, one); }
        else { const r = a.road, [ax, az] = r.from, [bx, bz] = r.to, L = Math.hypot(bx - ax, bz - az) || 1, dx = (bx - ax) / L, dz = (bz - az) / L;
          // brake for the walker: the distance a car needs to stop on this surface (v² / 2µg)
          const x0 = ax + (bx - ax) * a.t, z0 = az + (bz - az) * a.t, ahead = (px - x0) * dx * a.dir + (pz - z0) * dz * a.dir, side = Math.abs((px - x0) * -dz + (pz - z0) * dx);
          const stop = (a.v * a.v) / (2 * mu * G) + 3;
          if (player && ahead > 0 && ahead < stop + 4 && side < r.width / 2 + 1) { if (a.v > 3 && !a.braked) { events.push({ type: "brake", speed: Math.round(a.v * 3.6), dist: Math.round(stop - 3), x: x0, z: z0 }); a.braked = 1; } a.v = Math.max(0, a.v - mu * G * dt); }
          else { a.v += (a.vmax - a.v) * dt * 0.5; if (a.v > a.vmax * 0.9) a.braked = 0; }
          a.t += (a.v * a.dir * dt) / L; if (a.t > 1 || a.t < 0) { a.dir *= -1; a.t = Math.max(0, Math.min(1, a.t)); }
          const x = ax + (bx - ax) * a.t + -dz * a.lane * a.dir, z = az + (bz - az) * a.t + dx * a.lane * a.dir; a.x = x; a.z = z; a.yaw = Math.atan2(dx * a.dir, dz * a.dir);
          e.set(0, a.yaw, 0); q.setFromEuler(e); m4.compose(pos.set(x, terrain.heightAt(x, z) + 0.02, z), q, one); }
        for (const im of g.ims) im.setMatrixAt(i, m4);
      }
      for (const im of g.ims) im.instanceMatrix.needsUpdate = true;
    }
    const out = events; events = []; return out;
  }
  function hitsAvoid(x, z) { for (const o of avoid) if (Math.abs(x - o.x) < o.hx && Math.abs(z - o.z) < o.hz) return true; return false; }
  const count = groups.reduce((n, g) => n + g.agents.length, 0) + vgroups.reduce((n, g) => n + g.agents.length, 0);
  return { group, update, count, agents: groups.map((g) => ({ type: g.type, n: g.agents.length })).concat(vgroups.map((g) => ({ type: g.type, n: g.agents.length }))), dispose() { group.traverse((n) => { if (n.isInstancedMesh) { n.geometry.dispose(); n.dispose(); } }); } };
}
const bob = (sp, a) => (sp.kind === "walk" || sp.kind === "wander" || sp.kind === "follow" ? Math.abs(Math.sin(a.phase)) * 0.03 * Math.min(1, a.speed) : 0);
const angleTo = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
