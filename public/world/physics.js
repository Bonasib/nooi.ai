// Real-time physics for the 3D world (Rapier, Apache-2.0 — small enough for phones; MuJoCo stays on the server for exact
// measurements). The same materials table as the server (public/world/materials.js): a rubber ball bounces, a glass vase
// shatters above its breaking speed, wood floats with part of it above the water, ice slides, wind pushes light things.
// The walker is a character controller: slopes, steps, pushing things, jumping, swimming.
import { MATERIALS, SURFACES, G, RHO_WATER, RHO_AIR } from "./materials.js";
const FILL = { ball: 0, crate: 0.08, barrel: 0.22, cone: 0.05, chair: 0.06, table: 0.04, vase: 0.05, bottle: 0.25, cart: 0.08, lantern: 0.08, plant: 0.25, box: 0.06, sphere: 0.06, log: 1, boat: 0.08, bike: 0.02 };
const MASS = { ball: 0.43 };
let RAPIER = null, loading = null;
export async function loadRapier(url = "/vendor/rapier/rapier.mjs") {
  if (RAPIER) return RAPIER;
  if (!loading) loading = (async () => { const m = await import(url); const R = m.default || m; await R.init({}); RAPIER = R; return R; })();
  return loading;
}
const v3 = (x, y, z) => ({ x, y, z });

export async function createPhysics(T, { terrain, gravity = G, ground = "grass", water, onEvent = () => {}, rapierUrl }) {
  const R = await loadRapier(rapierUrl);
  const world = new R.World(v3(0, -gravity, 0)), res = terrain.res, S = terrain.size;
  world.timestep = 1 / 60;
  // the land: a height field (Rapier wants the heights x-major)
  const hf = new Float32Array(res * res); for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) hf[i * res + j] = terrain.heights[j * res + i];
  const skey = { grass: "grass", sand: "sand", snow: "snow", dirt: "gravel", asphalt: "asphalt", stone: "concrete", redrock: "concrete", floor: "wood", moon: "gravel" }[ground] || "grass", surf = SURFACES[skey];
  const roll = { grass: 0.08, sand: 0.25, snow: 0.15, gravel: 0.06, asphalt: 0.015, concrete: 0.015, wood: 0.012, ice: 0.01, wet: 0.02 }[skey] || 0.05;   // rolling-resistance coefficient
  const [cx, cz] = terrain.center || [0, 0];   // a photoreal world (World Labs) isn't always centred on 0
  if (terrain.trimesh) world.createCollider(R.ColliderDesc.trimesh(terrain.trimesh.vertices, terrain.trimesh.indices).setFriction(surf.mu).setRestitution(0));   // a photoreal place: its own collider
  else world.createCollider(R.ColliderDesc.heightfield(res - 1, res - 1, hf, v3(S, 1, S)).setTranslation(cx, 0, cz).setFriction(surf.mu).setRestitution(0));
  // walls at the edge of the world
  for (const [x, z, hx, hz] of [[S / 2 + 1, 0, 1, S / 2], [-S / 2 - 1, 0, 1, S / 2], [0, S / 2 + 1, S / 2, 1], [0, -S / 2 - 1, S / 2, 1]]) world.createCollider(R.ColliderDesc.cuboid(hx, 200, hz).setTranslation(cx + x, 0, cz + z));
  const bodies = [], quat = new T.Quaternion(), eul = new T.Euler(), tmp = new T.Vector3();
  const rotY = (a) => { quat.setFromEuler(eul.set(0, a, 0)); return { x: quat.x, y: quat.y, z: quat.z, w: quat.w }; };
  function shapeDesc(c, s) {
    s = s || 1;
    switch (c.shape) {
      case "ball": return R.ColliderDesc.ball(c.r * s);
      case "cyl": return R.ColliderDesc.cylinder(c.hy * s, c.r * s);
      case "cone": return R.ColliderDesc.cone(c.hy * s, c.r * s);
      default: return R.ColliderDesc.cuboid(c.hx * s, c.hy * s, c.hz * s);
    }
  }
  const volOf = (c, s) => (c.shape === "ball" ? (4 / 3) * Math.PI * (c.r * s) ** 3 : c.shape === "cyl" ? Math.PI * (c.r * s) ** 2 * c.hy * 2 * s : c.shape === "cone" ? (Math.PI * (c.r * s) ** 2 * c.hy * 2 * s) / 3 : 8 * c.hx * c.hy * c.hz * s ** 3);
  // something that doesn't move: a house, a tree trunk, a rock, a wall
  function addStatic(c, x, y, z, ry = 0, s = 1) {
    if (!c) return;
    if (c.gate) { for (const dx of [-2.4, 2.4]) { const ox = Math.cos(ry) * dx * s, oz = -Math.sin(ry) * dx * s; world.createCollider(R.ColliderDesc.cuboid(0.6 * s, c.hy * s, 0.6 * s).setTranslation(x + ox, y + c.y * s, z + oz).setRotation(rotY(ry))); } return; }
    const d = shapeDesc(c, s).setTranslation(x, y + (c.y || 0) * s, z).setRotation(c.rz ? (() => { quat.setFromEuler(eul.set(0, ry, c.rz)); return { x: quat.x, y: quat.y, z: quat.z, w: quat.w }; })() : rotY(ry)).setFriction(0.7);
    world.createCollider(d);
  }
  // something that moves: it is pushed, kicked, thrown, floats, breaks
  function addDynamic(obj, c, type, mat, s = 1, extra = {}) {
    const M = MATERIALS[mat] || MATERIALS.wood, vol = volOf(c, s), mass = extra.mass || (MASS[type] ?? M.rho * vol * (FILL[type] ?? 0.3)) * (type === "ball" ? s ** 3 : 1);
    const p = obj.position, bd = R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y + (c.y || 0) * s, p.z).setRotation({ x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w }).setLinearDamping(0.05).setAngularDamping(0.25).setCanSleep(true);
    const body = world.createRigidBody(bd);
    const cd = shapeDesc(c, s).setDensity(Math.max(1, mass / Math.max(1e-6, vol))).setFriction(M.mu).setRestitution(M.e).setRestitutionCombineRule(R.CoefficientCombineRule.Max);
    world.createCollider(cd, body);
    const rec = { body, obj, c, s, type, mat, mass, vol, half: (c.shape === "ball" ? c.r : c.hy) * s, yoff: (c.y || 0) * s, breakV: M.breakV, last: 0, wet: false, floats: !!extra.floats };
    bodies.push(rec); return rec;
  }
  // the walker
  const cc = world.createCharacterController(0.03);
  cc.enableAutostep(0.45, 0.2, true); cc.enableSnapToGround(0.45); cc.setMaxSlopeClimbAngle((52 * Math.PI) / 180); cc.setMinSlopeSlideAngle((62 * Math.PI) / 180);
  cc.setApplyImpulsesToDynamicBodies(true); if (cc.setCharacterMass) cc.setCharacterMass(70);
  let walker = null;
  function addWalker(x, y, z) {
    const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + 0.9, z)), col = world.createCollider(R.ColliderDesc.capsule(0.55, 0.32).setFriction(0.5), body);
    walker = { body, col, vy: 0, grounded: false, swim: false, pos: new T.Vector3(x, y + 0.9, z) };
    return walker;
  }
  let acc = 0, held = null, wind = new T.Vector3();
  const want = new T.Vector3();
  function walkStep(dt, input) {
    if (!walker) return;
    const p = walker.body.translation(), lvl = water ? water.surfaceAt(p.x, p.z) : -999;
    walker.swim = lvl > -900 && p.y < lvl + 0.15 && !(water && water.frozen);
    const sp = (input.run ? 6.2 : 3.4) * (walker.swim ? 0.55 : 1);
    want.set(input.x || 0, 0, input.z || 0); if (want.lengthSq() > 1) want.normalize(); want.multiplyScalar(sp * dt);
    if (walker.swim) { walker.vy += ((input.up ? 2.5 : input.down ? -2.5 : 0) - walker.vy) * Math.min(1, dt * 3) + (lvl - 0.25 - p.y) * dt * 1.5; }
    else { if (walker.grounded && walker.vy <= 0) walker.vy = -0.5; if (input.jump && walker.grounded) { walker.vy = 4.2 * Math.sqrt(gravity / G); walker.grounded = false; } walker.vy -= gravity * dt; walker.vy = Math.max(walker.vy, -40); }
    want.y = walker.vy * dt;
    cc.computeColliderMovement(walker.col, want);
    const mv = cc.computedMovement(); walker.grounded = cc.computedGrounded();
    if (walker.grounded && walker.vy < -6) onEvent({ type: "land", speed: -walker.vy, x: p.x, z: p.z });
    if (walker.grounded && walker.vy < 0) walker.vy = 0;
    walker.body.setNextKinematicTranslation(v3(p.x + mv.x, p.y + mv.y, p.z + mv.z));
  }
  function forces(dt) {
    for (const b of bodies) {
      if (b.gone) continue; const body = b.body; body.resetForces(false);   // Rapier keeps forces until they are reset
      if (body.isSleeping() && !b.wet && wind.lengthSq() < 30) continue;
      const p = body.translation(), v = body.linvel();
      // water: Archimedes on the part under the surface, and water drag
      const lvl = water ? water.surfaceAt(p.x, p.z) : -999;
      if (lvl > -900 && !(water && water.frozen)) { const bottom = p.y - b.half, f = Math.max(0, Math.min(1, (lvl - bottom) / (2 * b.half || 1)));
        if (f > 0) { const now = performance.now(); if (!b.wet && v.y < -1.5 && now - (b.splashAt || 0) > 1500) { b.splashAt = now; onEvent({ type: "splash", x: p.x, y: lvl, z: p.z, speed: Math.round(-v.y * 10) / 10, mass: b.mass, what: b.type }); } b.wet = true; body.wakeUp();
          // the lift is capped at 3× the weight (a light, big thing would otherwise be shot out of the water) and the water damps the motion
          const fl = b.floats ? 1.6 : 1, lift = Math.min(RHO_WATER * gravity * b.vol * f * fl, 3 * b.mass * gravity * fl); body.addForce(v3(0, lift, 0), true);
          const kv = Math.min(0.5, (1.5 + 8 * f) * dt), kh = Math.min(0.5, (0.8 + 4 * f) * dt); body.setLinvel(v3(v.x * (1 - kh), v.y * (1 - kv), v.z * (1 - kh)), true); const w = body.angvel(); body.setAngvel(v3(w.x * (1 - kh), w.y * (1 - kh), w.z * (1 - kh)), true); }
        else b.wet = false; }
      // wind on light things (drag = ½ ρ C A v²)
      // rolling resistance: a ball on grass or sand slows down and stops (Rapier has none of its own)
      if (b.c.shape === "ball" && !b.wet && b !== held && !terrain.trimesh) { const gy = terrain.heightAt(p.x, p.z), sp = Math.hypot(v.x, v.z);
        if (p.y - b.half < gy + 0.05) { if (sp < 0.15 && terrain.slopeAt(p.x, p.z) < roll * 2) { body.setLinvel(v3(0, Math.min(0, v.y), 0), true); body.setAngvel(v3(0, 0, 0), true); }
          else if (sp > 0) { const F = roll * b.mass * gravity; body.addForce(v3((-v.x / sp) * F, 0, (-v.z / sp) * F), true); } } }
      if (b.mass < 8 && wind.lengthSq() > 4) { const A = b.vol ** (2 / 3), rv = tmp.set(wind.x - v.x, 0, wind.z - v.z), sp = rv.length(); if (sp > 0.5) { const F = 0.5 * RHO_AIR * 1.0 * A * sp * sp; body.addForce(v3((rv.x / sp) * F, 0, (rv.z / sp) * F), true); } }
    }
  }
  function afterStep() {
    for (const b of bodies) {
      if (b.gone) continue; const body = b.body, p = body.translation(), q = body.rotation(), v = body.linvel(), sp = Math.hypot(v.x, v.y, v.z);
      // a hard hit breaks glass and ice (the speed it lost in one step)
      if (b.breakV && b.last - sp > b.breakV && b !== held) { onEvent({ type: "break", x: p.x, y: p.y, z: p.z, speed: Math.round(b.last * 10) / 10, rec: b }); }
      b.last = sp;
      b.obj.position.set(p.x, p.y - b.yoff, p.z); b.obj.quaternion.set(q.x, q.y, q.z, q.w);
      if (p.y < -60) { body.setTranslation(v3(p.x, 30, p.z), true); body.setLinvel(v3(0, 0, 0), true); }
    }
    if (walker) { const p = walker.body.translation(); walker.pos.set(p.x, p.y, p.z); }
  }
  return {
    R, world, bodies, get walker() { return walker; }, get held() { return held; }, wind,
    addStatic, addDynamic, addWalker,
    step(dt, input) {
      acc = Math.min(acc + dt, 4 / 60);
      let n = 0; while (acc >= 1 / 60 && n < 4) { walkStep(1 / 60, input || {}); if (held) hold(1 / 60, input); forces(1 / 60); world.step(); acc -= 1 / 60; n++; }
      afterStep();
    },
    // what is in front of the eye (a thing you can grab, push or kick)
    pick(origin, dir, max = 4) { const hit = world.castRay(new R.Ray(origin, dir), max, true, undefined, undefined, walker ? walker.col : undefined); if (!hit) return null; const col = hit.collider, body = col.parent(); const rec = body && bodies.find((b) => b.body === body); return rec ? { rec, dist: hit.timeOfImpact } : { rec: null, dist: hit.timeOfImpact }; },
    grab(origin, dir) { const h = this.pick(origin, dir, 3.6); if (!h || !h.rec || h.rec.mass > 80 || h.rec.gone) return null; held = h.rec; held.body.setGravityScale(0, true); held.body.wakeUp(); held.target = { origin, dir }; return held; },
    drop() { if (held) { held.body.setGravityScale(1, true); held = null; } },
    // a person's throw and kick: light things fly fast (a ball ~12 m/s), heavy things only move a little (the same push, more mass)
    throw(dir, power = 1) { if (!held) return null; const b = held; this.drop(); const v = Math.min(12, 9 / Math.sqrt(Math.max(0.3, b.mass) / 2)) * power; b.body.setLinvel(v3(dir.x * v, dir.y * v + 1.5, dir.z * v), true); return { rec: b, speed: v }; },
    kick(origin, dir) { const h = this.pick(origin, dir, 2.2); if (!h || !h.rec) return null; const b = h.rec, j = Math.min(12, 35 / Math.pow(b.mass, 0.8)) * b.mass; b.body.applyImpulse(v3(dir.x * j, Math.max(0.3, dir.y + 0.35) * j, dir.z * j), true); return b; },
    setHeldTarget(origin, dir) { if (held) held.target = { origin, dir }; },
    remove(rec) { if (rec.gone) return; rec.gone = true; world.removeRigidBody(rec.body); if (held === rec) held = null; },
    dispose() { try { world.free(); } catch {} bodies.length = 0; }
  };
  // a held thing rides in front of the chest like in your hands: looking down at the floor doesn't push it into the ground
  function hold(dt) { const b = held, t = b.target; if (!t) return; const d = t.dir, h = Math.hypot(d.x, d.z) || 1, pc = Math.max(-0.35, Math.min(0.45, Math.atan2(d.y, h))), k = Math.cos(pc) / h;
    const p = b.body.translation(), tx = t.origin.x + d.x * k * 1.3, ty = t.origin.y + Math.sin(pc) * 1.3 - 0.25, tz = t.origin.z + d.z * k * 1.3; b.body.setLinvel(v3((tx - p.x) * 12, (ty - p.y) * 12, (tz - p.z) * 12), true); const w = b.body.angvel(); b.body.setAngvel(v3(w.x * 0.85, w.y * 0.85, w.z * 0.85), true); }
}
