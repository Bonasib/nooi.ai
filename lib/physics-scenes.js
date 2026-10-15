// nooi physics scenes (v85) — what really happens, computed with MuJoCo (Google DeepMind, Apache-2.0; npm @mujoco/mujoco).
// One system for the whole site: the same materials, surfaces, water and air act in every scene —
//   objects  · things of real materials dropped or thrown: weight, bounce, friction, rolling, breaking (glass, ice…)
//   water    · things falling into water: splash, sink or float (buoyancy from the volume under the surface), water drag
//   air      · a flag in gusty wind (cloth) · paper vs a ball falling through air (air drag, fluttering)
//   car      · a 1.4 t car on suspension: accelerate, brake, turn, jump a ramp, crash into boxes — on asphalt, wet, gravel, snow, ice
//   body     · a 70 kg human body (muscles that hold the pose and let go): pushed, trips, falls from a height, hit by a ball, into water
// Each run returns the motion (30 frames a second, every shape's position and turn), what happened (impacts, splashes, breaks),
// the measured facts, and a sentence in English and Arabic that video prompts use, so an engine is asked for what really happens.
export const FPS = 30;
const G = 9.81, RHO_WATER = 1000, RHO_AIR = 1.2;
// e = restitution (bounce), mu = friction, breakV = the impact speed (m/s) that breaks it (glass ≈ a 25 cm drop onto concrete)
// the materials and surfaces are shared with the live 3D world (public/world/materials.js) — one table for the whole site
import { MATERIALS, SURFACES } from "../public/world/materials.js";
export { MATERIALS, SURFACES };
// bounce → MuJoCo's contact damping ratio (a spring-damper whose energy loss gives that restitution)
// (MuJoCo's soft contact doesn't follow the textbook formula, so the table was measured: a ball dropped 2 m, 20 ms contact, 2 ms steps)
const ZETA = [[0.12, 0.7834], [0.15, 0.7084], [0.18, 0.6379], [0.25, 0.5025], [0.3, 0.4235], [0.35, 0.3605], [0.5, 0.2205], [0.65, 0.082], [0.78, 0.0754]];
const zeta = (e) => { if (e <= ZETA[0][0]) return ZETA[0][1]; for (let i = 1; i < ZETA.length; i++) if (e <= ZETA[i][0]) { const [a, za] = ZETA[i - 1], [b, zb] = ZETA[i]; return za + ((e - a) / (b - a)) * (zb - za); } return ZETA[ZETA.length - 1][1]; };
const num = (v, lo, hi, d) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const pick = (v, list, d) => (list.includes(v) ? v : d);
const r3 = (x) => Math.round(x * 1000) / 1000;
const f1 = (x) => Math.round(x * 10) / 10;
const ar1 = (x) => String(f1(x));
// ---------- the shared engine: build a model, step it, record shapes, report events ----------
function quatOf(m9, o) { const [a, b, c, d, e, f, g, h, i] = [m9[o], m9[o + 1], m9[o + 2], m9[o + 3], m9[o + 4], m9[o + 5], m9[o + 6], m9[o + 7], m9[o + 8]];
  const tr = a + e + i; let w, x, y, z;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (h - f) / s; y = (c - g) / s; z = (d - b) / s; }
  else if (a > e && a > i) { const s = Math.sqrt(1 + a - e - i) * 2; w = (h - f) / s; x = s / 4; y = (b + d) / s; z = (c + g) / s; }
  else if (e > i) { const s = Math.sqrt(1 + e - a - i) * 2; w = (c - g) / s; x = (b + d) / s; y = s / 4; z = (f + h) / s; }
  else { const s = Math.sqrt(1 + i - a - e) * 2; w = (d - b) / s; x = (c + g) / s; y = (f + h) / s; z = s / 4; }
  return [w, x, y, z]; }
const GEOM_KIND = { 2: "sphere", 3: "capsule", 5: "cylinder", 6: "box", 0: "plane" };
function run(mj, xml, { dur, step, setup, each, cloth, tags = {}, water = null, wind = null, rest = false }) {
  let m; try { m = mj.MjModel.from_xml_string(xml); } catch (e) { throw Object.assign(new Error("physics model: " + String(e.message || e).slice(0, 200)), { code: 500 }); }
  const d = new mj.MjData(m), vbuf = new mj.DoubleBuffer(6), fbuf = new mj.DoubleBuffer(6);
  try {
    if (setup) setup(m, d); mj.mj_forward(m, d);
    const dt = m.opt.timestep, steps = Math.round(dur / dt), every = Math.max(1, Math.round(1 / (FPS * dt)));
    const shapes = [], moving = [];
    for (let g = 0; g < m.ngeom; g++) { const kind = GEOM_KIND[m.geom_type[g]]; if (!kind || m.geom_rgba[g * 4 + 3] === 0) continue;
      const body = m.geom_bodyid[g], name = mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM.value, g) || "";
      const sh = { kind, size: [r3(m.geom_size[g * 3]), r3(m.geom_size[g * 3 + 1]), r3(m.geom_size[g * 3 + 2])], color: tags[name.split(":")[0]] || "#" + [0, 1, 2].map((k) => Math.round(m.geom_rgba[g * 4 + k] * 255).toString(16).padStart(2, "0")).join(""), part: name.split(":")[0] };
      if (body === 0) { sh.pos = [0, 1, 2].map((k) => r3(d.geom_xpos[g * 3 + k])); sh.quat = quatOf(d.geom_xmat, g * 9).map(r3); sh.still = true; }
      else moving.push(g);
      shapes.push(sh); sh.g = g; }
    const frames = []; const clothFrames = [];
    const ctx = { m, d, mj, events: [], vbuf, fbuf, dt, water, wind, maxContact: () => maxContact(mj, m, d, fbuf), vel: (b) => bodyVel(mj, m, d, b, vbuf), cons: () => (ctx._cs === ctx._step ? ctx._c : ((ctx._cs = ctx._step), (ctx._c = contactsOf(d)))) };
    const snap = () => { const f = []; for (const g of moving) { for (let k = 0; k < 3; k++) f.push(r3(d.geom_xpos[g * 3 + k])); for (const q of quatOf(d.geom_xmat, g * 9)) f.push(r3(q)); } frames.push(f);
      if (cloth) { const c = []; for (const b of cloth.bodies) for (let k = 0; k < 3; k++) c.push(Math.round(d.xpos[b * 3 + k] * 100) / 100); clothFrames.push(c); } };
    snap();
    for (let i = 1; i <= steps; i++) {
      d.xfrc_applied.fill(0);
      ctx._step = i; if (water) waterForces(ctx); if (wind && cloth) clothWind(ctx, cloth); if (each) each(ctx, i * dt);
      mj.mj_step(m, d);
      if (!Number.isFinite(d.qpos[0]) && m.nq) throw Object.assign(new Error("The simulation became unstable — try gentler numbers."), { code: 422 });
      if (i % every === 0) { snap();
        if (rest && i * dt > 1.2) { let mx = 0; for (let k = 0; k < m.nv; k++) mx = Math.max(mx, Math.abs(d.qvel[k])); ctx.still = mx < 0.03 ? (ctx.still || 0) + 1 : 0; if (ctx.still >= 15) break; } } }
    const order = shapes.filter((s) => !s.still).map((s) => s.g);
    shapes.forEach((s) => { s.i = s.still ? -1 : order.indexOf(s.g); delete s.g; });
    return { shapes, frames, cloth: cloth ? { nx: cloth.nx, ny: cloth.ny, color: cloth.color, frames: clothFrames } : null, events: ctx.events, ctx };
  } finally { vbuf.delete(); fbuf.delete(); d.delete(); m.delete(); }
}
function bodyVel(mj, m, d, b, buf) { mj.mj_objectVelocity(m, d, mj.mjtObj.mjOBJ_BODY.value, b, buf, 0); const v = buf.GetView(); return { w: [v[0], v[1], v[2]], v: [v[3], v[4], v[5]] }; }
function maxContact(mj, m, d, buf) { let f = 0, at = -1; for (let c = 0; c < d.ncon; c++) { mj.mj_contactForce(m, d, c, buf); const n = Math.abs(buf.GetView()[0]); if (n > f) { f = n; at = c; } } return { f, at }; }
const bodyId = (mj, m, n) => mj.mj_name2id(m, mj.mjtObj.mjOBJ_BODY.value, n);
// the contacts of this step as [geom1, geom2] pairs (the binding hands out copies, freed here)
function contactsOf(d) { const cv = d.contact, out = []; try { for (let i = 0; i < d.ncon; i++) { const ct = cv.get(i); if (ct) { out.push([ct.geom1, ct.geom2]); if (ct.delete) ct.delete(); } } } finally { cv.delete(); } return out; }
// water: every moving body is split into sample points; a point under the surface lifts with its share of the displaced water
// (Archimedes) and is slowed by water drag — so a plank floats flat, a bottle tips, a person bobs with the head out.
function waterForces(ctx) { const { m, d, water } = ctx;
  for (const W of water.bodies) { const b = W.b, xm = d.xmat, p0 = [d.xpos[b * 3], d.xpos[b * 3 + 1], d.xpos[b * 3 + 2]], com = [d.xipos[b * 3], d.xipos[b * 3 + 1], d.xipos[b * 3 + 2]];
    let under = 0; const F = [0, 0, 0], T = [0, 0, 0]; let vv = null;
    for (let q = 0; q < W.pts.length; q++) { const s = W.pts[q], gi = W.geom[q], p = [0, 1, 2].map((k) => p0[k] + xm[b * 9 + k * 3] * s[0] + xm[b * 9 + k * 3 + 1] * s[1] + xm[b * 9 + k * 3 + 2] * s[2]);
      // each point stands for a small cell of the shape: the part of that cell under the surface counts (smooth, so floating depth is right)
      const G9z = d.geom_xmat, gz = gi.g * 9, ext = Math.abs(G9z[gz + 6]) * gi.c[0] + Math.abs(G9z[gz + 7]) * gi.c[1] + Math.abs(G9z[gz + 8]) * gi.c[2], fr = Math.max(0, Math.min(1, (water.level - p[2]) / Math.max(1e-4, ext) + 0.5));
      if (fr <= 0) continue; under++; if (!vv) vv = ctx.vel(b);
      const r = [p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]], w = vv.w, vp = [vv.v[0] + w[1] * r[2] - w[2] * r[1], vv.v[1] + w[2] * r[0] - w[0] * r[2], vv.v[2] + w[0] * r[1] - w[1] * r[0]], sp = Math.hypot(...vp);
      // drag on the area that faces the motion: feet first slices in, flat on the belly stops hard
      const G9 = d.geom_xmat, gm = gi.g * 9, u = sp > 1e-6 ? [0, 1, 2].map((k) => (G9[gm + k] * vp[0] + G9[gm + 3 + k] * vp[1] + G9[gm + 6 + k] * vp[2]) / sp) : [0, 0, 1], z = gi.s;
      const face = gi.kind === "box" ? 4 * (z[1] * z[2] * Math.abs(u[0]) + z[0] * z[2] * Math.abs(u[1]) + z[0] * z[1] * Math.abs(u[2])) : gi.kind === "sphere" ? Math.PI * z[0] * z[0]
        : 4 * z[0] * z[1] * Math.sqrt(Math.max(0, 1 - u[2] * u[2])) + Math.PI * z[0] * z[0] * Math.abs(u[2]), A = (face / gi.n) * 1.0;
      const f = [-0.5 * RHO_WATER * A * fr * sp * vp[0], -0.5 * RHO_WATER * A * fr * sp * vp[1], RHO_WATER * G * gi.vol * fr - 0.5 * RHO_WATER * A * fr * sp * vp[2]];
      const rc = [p[0] - com[0], p[1] - com[1], p[2] - com[2]]; for (let k = 0; k < 3; k++) F[k] += f[k];
      T[0] += rc[1] * f[2] - rc[2] * f[1]; T[1] += rc[2] * f[0] - rc[0] * f[2]; T[2] += rc[0] * f[1] - rc[1] * f[0]; }
    if (under) { const o = b * 6; for (let k = 0; k < 3; k++) { d.xfrc_applied[o + k] += F[k]; d.xfrc_applied[o + 3 + k] += T[k] - 0.4 * W.mass * (under / W.pts.length) * vv.w[k]; } }
    const was = W.under || 0; W.under = under;
    if (!was && under && d.time > 0.05) { const v = ctx.vel(b).v, sp = Math.hypot(...v); if (sp > 0.8 && !water.splashed.has(W.group)) { water.splashed.add(W.group); ctx.events.push({ t: r3(d.time), type: "splash", what: W.group, speed: f1(sp), x: r3(p0[0]), y: r3(p0[1]), size: r3(Math.min(3, 0.15 * sp * Math.cbrt(W.mass))) }); } } } }
// sample points of a body's shape (in the body's frame) with the volume and the drag area each point stands for
function samplePts(kind, s, pos = [0, 0, 0], n = 3) { const pts = [];
  if (kind === "sphere") { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) { const p = [(i + 0.5) / n * 2 - 1, (j + 0.5) / n * 2 - 1, (k + 0.5) / n * 2 - 1]; if (Math.hypot(...p) <= 1.05) pts.push(p.map((x, q) => x * s[0] + pos[q])); }
    return { pts, vol: (4 / 3) * Math.PI * s[0] ** 3 / pts.length, area: Math.PI * s[0] ** 2 / (n * n) }; }
  if (kind === "capsule" || kind === "cylinder") { const rad = s[0], hl = s[1]; for (let k = 0; k < n + 2; k++) pts.push([pos[0], pos[1], pos[2] + (-1 + (2 * k) / (n + 1)) * hl]);
    const vol = Math.PI * rad * rad * 2 * hl + (kind === "capsule" ? (4 / 3) * Math.PI * rad ** 3 : 0); return { pts, vol: vol / pts.length, area: 2 * rad * 2 * hl / pts.length }; }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) pts.push([pos[0] + ((i + 0.5) / n * 2 - 1) * s[0], pos[1] + ((j + 0.5) / n * 2 - 1) * s[1], pos[2] + ((k + 0.5) / n * 2 - 1) * s[2]]);
  return { pts, vol: 8 * s[0] * s[1] * s[2] / pts.length, area: 4 * Math.max(s[0] * s[1], s[1] * s[2], s[0] * s[2]) / (n * n) }; }
function waterBody(mj, m, name, group) { const b = bodyId(mj, m, name); const pts = [], geom = [];
  for (let g = 0; g < m.ngeom; g++) if (m.geom_bodyid[g] === b) { const kind = GEOM_KIND[m.geom_type[g]], sz = [m.geom_size[g * 3], m.geom_size[g * 3 + 1], m.geom_size[g * 3 + 2]], P = [m.geom_pos[g * 3], m.geom_pos[g * 3 + 1], m.geom_pos[g * 3 + 2]];
    // (geom_pos / sizes are in the body's frame; a geom given with fromto is centred there and lies along its own z)
    const S = samplePts(kind, sz, [0, 0, 0], 3), Q = [m.geom_quat[g * 4], m.geom_quat[g * 4 + 1], m.geom_quat[g * 4 + 2], m.geom_quat[g * 4 + 3]];
    const c = kind === "box" ? [(2 * sz[0]) / 3, (2 * sz[1]) / 3, (2 * sz[2]) / 3] : kind === "sphere" ? [(2 * sz[0]) / 3, (2 * sz[0]) / 3, (2 * sz[0]) / 3] : [2 * sz[0], 2 * sz[0], (2 * sz[1]) / 4];
    const info = { g, kind, s: sz, n: S.pts.length, vol: S.vol, c };
    S.pts.forEach((p) => { pts.push(rotq(Q, p).map((x, k) => x + P[k])); geom.push(info); }); }
  return { b, pts, geom, mass: m.body_mass[b], group: group || name }; }
function rotq([w, x, y, z], [a, b, c]) { const ix = w * a + y * c - z * b, iy = w * b + z * a - x * c, iz = w * c + x * b - y * a, iw = -x * a - y * b - z * c;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; }
// wind on cloth: each little triangle of the cloth is pushed by the wind that meets it (pressure ∝ ρ v² on the facing area)
function clothWind(ctx, cloth) { const { d } = ctx, t = d.time, w = ctx.wind, gust = 1 + 0.35 * Math.sin(t * 2.7) + 0.2 * Math.sin(t * 6.1 + 1) + 0.1 * Math.sin(t * 11.3);
  const V = [w[0] * gust, w[1] * gust, w[2]], vb = cloth.bodies, P = (k) => [d.xpos[vb[k] * 3], d.xpos[vb[k] * 3 + 1], d.xpos[vb[k] * 3 + 2]];
  const Vel = (k) => [d.cvel[vb[k] * 6 + 3], d.cvel[vb[k] * 6 + 4], d.cvel[vb[k] * 6 + 5]];
  for (const [a, b, c] of cloth.tris) { const A = P(a), B = P(b), C = P(c), u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], n2 = Math.hypot(...n); if (!n2) continue;
    // the air relative to the cloth: pressure on the face it meets + drag along the fabric (what keeps a real flag flying out)
    const va = Vel(a), vbb = Vel(b), vc = Vel(c), rel = [0, 1, 2].map((q) => V[q] - (va[q] + vbb[q] + vc[q]) / 3), area = n2 / 2;
    const nn = n.map((x) => x / n2), vn = rel[0] * nn[0] + rel[1] * nn[1] + rel[2] * nn[2], Fn = 0.5 * RHO_AIR * 1.3 * area * vn * Math.abs(vn);
    const vt = [rel[0] - vn * nn[0], rel[1] - vn * nn[1], rel[2] - vn * nn[2]], st = Math.hypot(...vt), Ft = 0.5 * RHO_AIR * 0.3 * area * st;
    for (const k of [a, b, c]) { const o = vb[k] * 6; for (let q = 0; q < 3; q++) d.xfrc_applied[o + q] += (nn[q] * Fn + vt[q] * Ft) / 3; } } }
const header = (dt = 0.002, extra = "") => `<option timestep="${dt}" integrator="implicitfast" ${extra}/><size memory="64M"/>`;
const ground = (surf, size = 60) => { const S = SURFACES[surf]; return `<geom name="ground" type="plane" size="${size} ${size} .1" friction="${S.mu} 0.01 0.0005" solmix="0.0001" ${S.soft ? 'solref="0.03 1"' : ""} rgba="0 0 0 0"/>`; };
// ---------- objects: drop or throw things of real materials ----------
function objects(mj, o) {
  const mat = pick(o.material, Object.keys(MATERIALS), "rubber"), M = MATERIALS[mat], shape = pick(o.shape, ["box", "ball", "cylinder"], mat === "glass" || mat === "ice" ? "box" : "ball");
  const n = Math.round(num(o.count, 1, 6, 1)), size = num(o.size, 0.05, 0.6, shape === "ball" ? 0.11 : 0.15), h = num(o.height, 0, 10, 2), thr = num(o.throw, 0, 15, 0), surf = pick(o.surface, Object.keys(SURFACES), "concrete");
  const breaks = M.breakV > 0 && o.breakable !== false && shape === "box", sol = `solref="0.02 ${r3(zeta(M.e))}" friction="${M.mu} 0.005 0.0002"`, rho = shape === "ball" && M.hollow ? M.rho * M.hollow : M.rho;
  const bodies = [], welds = [], groups = [];
  for (let k = 0; k < n; k++) { const x0 = (k - (n - 1) / 2) * size * 3.2, z0 = h + size + 0.002;
    if (breaks) { const s = size / 2, ps = []; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let l = 0; l < 2; l++) ps.push([i, j, l]);
      ps.forEach((p) => bodies.push(`<body name="o${k}_${p.join("")}" pos="${r3(x0 + (p[0] - 0.5) * size)} ${r3((p[1] - 0.5) * size)} ${r3(z0 + (p[2] - 0.5) * size)}"><freejoint/><geom name="o${k}:${p.join("")}" type="box" size="${s} ${s} ${s}" density="${M.rho}" ${sol}/></body>`));
      ps.forEach((p, a) => ps.forEach((q, b) => { if (b > a && Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) === 1) welds.push(`<weld body1="o${k}_${p.join("")}" body2="o${k}_${q.join("")}" solref="0.004 1"/>`); }));
      groups.push({ k, bodies: ps.map((p) => `o${k}_${p.join("")}`) }); }
    else { const geom = shape === "ball" ? `type="sphere" size="${size}"` : shape === "cylinder" ? `type="cylinder" size="${size} ${size}"` : `type="box" size="${size} ${size} ${size}"`;
      bodies.push(`<body name="o${k}" pos="${r3(x0)} 0 ${r3(z0)}"><freejoint/><geom name="o${k}:x" ${geom} density="${r3(rho)}" ${sol}/></body>`); groups.push({ k, bodies: [`o${k}`] }); } }
  const xml = `<mujoco>${header(0.002, `density="${RHO_AIR}" viscosity="1.8e-5"`)}<worldbody>${ground(surf)}${bodies.join("")}</worldbody>${welds.length ? `<equality>${welds.join("")}</equality>` : ""}</mujoco>`;
  const tags = {}; groups.forEach((g) => (tags["o" + g.k] = M.color));
  const st = groups.map(() => ({ landed: null, impact: 0, bounces: 0, airborne: true, peak: 0, broke: false, top: 0, lastUp: false }));
  const res = run(mj, xml, { dur: Math.min(8, Math.sqrt((2 * h) / G) + (M.e > 0.6 ? 4.5 : 3)), tags, rest: true,
    setup: (m, d) => { groups.forEach((g) => g.bodies.forEach((bn) => { const b = bodyId(mj, m, bn), a = m.jnt_dofadr[m.body_jntadr[b]]; d.qvel[a] = thr; d.qvel[a + 2] = thr ? thr * 0.35 : 0; d.qvel[a + 3] = thr ? 2 : 0; })); },
    each: (c) => { const { m, d } = c; groups.forEach((g, k) => { const S = st[k], b = bodyId(mj, m, g.bodies[0]), vz = d.cvel[b * 6 + 5], z = d.xipos[b * 3 + 2];
      const ids = g.ids || (g.ids = g.bodies.map((bn) => bodyId(mj, m, bn))); let touching = false;
      for (const [g1, g2] of c.cons()) { const b1 = m.geom_bodyid[g1], b2 = m.geom_bodyid[g2]; if ((b1 === 0 && ids.includes(b2)) || (b2 === 0 && ids.includes(b1))) { touching = true; break; } }
      if (touching && S.airborne) { const v = Math.abs(S.lastVz || 0); if (S.landed == null) { S.landed = r3(d.time); S.impact = f1(v); c.events.push({ t: S.landed, type: "impact", what: "o" + k, speed: S.impact }); } else if (v > 0.6) { S.bounces++; c.events.push({ t: r3(d.time), type: "bounce", what: "o" + k, speed: f1(v) }); } S.airborne = false; }
      if (!touching && !S.airborne && z > size + 0.02 && vz > 0.3) S.airborne = true;
      if (S.landed != null && S.bounces === 0 && !S.peakAfter) S.peakAfter = 0; if (S.landed != null) S.top = Math.max(S.top, z - size);
      S.lastVz = vz;
      if (breaks && !S.broke && touching && S.landed != null && d.time - S.landed < 0.05) { if (Math.abs(S.lastVz || 0) > M.breakV || S.impact > M.breakV) { S.broke = true; c.events.push({ t: r3(d.time), type: "break", what: "o" + k, pieces: 8, speed: f1(Math.abs(S.lastVz || 0)) });
        for (let e = 0; e < m.neq; e++) if (m.eq_obj1id[e] && g.bodies.includes(mj.mj_id2name(m, mj.mjtObj.mjOBJ_BODY.value, m.eq_obj1id[e]))) d.eq_active[e] = 0;
        const cx = d.xipos[b * 3], cy = d.xipos[b * 3 + 1], sp = Math.max(1, Math.abs(S.lastVz || 2)); g.bodies.forEach((bn, q) => { const id = bodyId(mj, m, bn), a = m.jnt_dofadr[m.body_jntadr[id]], dx = d.xipos[id * 3] - cx, dy = d.xipos[id * 3 + 1] - cy, L = Math.hypot(dx, dy) || 1;
          d.qvel[a] += (dx / L) * sp * 0.35 * (0.7 + 0.6 * ((q * 37) % 10) / 10); d.qvel[a + 1] += (dy / L) * sp * 0.35 * (0.7 + 0.6 * ((q * 53) % 10) / 10); d.qvel[a + 2] += sp * 0.12; d.qvel[a + 3] += (q % 3) * 3; }); } } }); } });
  const fall = Math.sqrt((2 * h) / G), s0 = st[0];
  const facts = { material: mat, shape, count: n, height: h, throw: thr, surface: surf, fallTime: r3(fall), impact: s0.impact, landedAt: s0.landed, bounces: s0.bounces, bounceHeight: r3(s0.top), broke: st.some((s) => s.broke), mass: r3(shape === "ball" ? (4 / 3) * Math.PI * size ** 3 * rho : shape === "cylinder" ? Math.PI * size * size * 2 * size * M.rho : 8 * size ** 3 * M.rho) };
  const thing = (shape === "ball" ? ["ball", "كرة"] : shape === "cylinder" ? ["cylinder", "أسطوانة"] : ["block", "كتلة"]);
  const en = `${/^[aeiou]/.test(M.en) ? "An" : "A"} ${M.en} ${thing[0]} (${facts.mass < 1 ? Math.round(facts.mass * 1000) + " g" : f1(facts.mass) + " kg"}) ${thr ? "is thrown at " + f1(thr) + " m/s and lands" : "falls " + f1(h) + " m, hits " + SURFACES[surf].en + " after " + f1(fall) + " s"} at ${facts.impact} m/s${facts.broke ? ", and shatters into sharp pieces that skid and spin apart" : facts.bounces ? `, bounces ${facts.bounces} time${facts.bounces > 1 ? "s" : ""} (up to ${Math.round(facts.bounceHeight * 100)} cm), then ${shape === "ball" ? "rolls" : "settles"}` : ", lands with a dull thud and stays"}. Real weight, real momentum, no floating.`;
  const ar = `${thing[1]} ${M.ar} (${facts.mass < 1 ? Math.round(facts.mass * 1000) + " غ" : ar1(facts.mass) + " كغ"}) ${thr ? "تُرمى بسرعة " + ar1(thr) + " م/ث وتصطدم" : "تسقط من " + ar1(h) + " م وتصطدم بـ" + SURFACES[surf].ar + " بعد " + ar1(fall) + " ث"} بسرعة ${facts.impact} م/ث${facts.broke ? "، فتتحطم إلى قطع حادة تنزلق وتدور متفرقة" : facts.bounces ? `، ثم ترتد ${facts.bounces} مرة (حتى ${Math.round(facts.bounceHeight * 100)} سم) و${shape === "ball" ? "تتدحرج" : "تستقر"}` : "، وتستقر بصوت مكتوم"}. وزن حقيقي وزخم حقيقي بلا طفو.`;
  return { ...res, facts, words: { en, ar } };
}
// ---------- water: things fall into a pool ----------
function waterScene(mj, o) {
  const list = (Array.isArray(o.items) ? o.items : ["wood", "ice", "metal"]).filter((x) => MATERIALS[x]).slice(0, 4), h = num(o.height, 0.3, 8, 2), size = num(o.size, 0.1, 0.5, 0.25);
  const items = list.length ? list : ["wood"];
  const bodies = items.map((mt, k) => { const M = MATERIALS[mt]; return `<body name="w${k}" pos="${r3((k - (items.length - 1) / 2) * size * 4)} 0 ${r3(h + size)}" euler="0 ${k * 7} ${k * 11}"><freejoint/><geom name="w${k}:x" type="box" size="${size} ${size} ${r3(size * 0.6)}" density="${M.rho}" friction="${M.mu} 0.005 0.0002" solref="0.004 0.8"/></body>`; });
  const xml = `<mujoco>${header(0.002)}<worldbody><geom name="pool" type="plane" pos="0 0 -3" size="30 30 .1" rgba="0 0 0 0"/>${bodies.join("")}</worldbody></mujoco>`;
  const water = { level: 0, bodies: [], splashed: new Set() }; const tags = {}; items.forEach((mt, k) => (tags["w" + k] = MATERIALS[mt].color));
  const res = run(mj, xml, { dur: 7, tags, water, setup: (m) => { items.forEach((_, k) => water.bodies.push(waterBody(mj, m, "w" + k))); } });
  const last = res.frames[res.frames.length - 1], shapes = res.shapes.filter((s) => !s.still);
  const out = items.map((mt, k) => { const i = shapes.findIndex((s) => s.part === "w" + k); const z = last[i * 7 + 2]; const sub = Math.max(0, Math.min(1, (0 - (z - size * 0.6)) / (size * 1.2)));
    return { material: mt, floats: z > -size * 0.6 - 0.02 && z > -2.5, under: Math.round(sub * 100), z: r3(z) }; });
  const sp = res.events.filter((e) => e.type === "splash");
  const facts = { height: h, items: out, entrySpeed: sp.length ? sp[0].speed : 0, splashes: sp.length };
  const en = `${out.map((x) => `the ${MATERIALS[x.material].en} block ${x.floats ? (x.under > 85 ? `floats almost fully under (${x.under}% below the surface)` : `bobs back up and floats with ${100 - x.under}% above the water`) : "sinks straight to the bottom"}`).join("; ")}. They hit the water at ${facts.entrySpeed} m/s with a crown splash and rings that spread across the surface; heavy things slow down quickly under water.`;
  const ar = `${out.map((x) => `الكتلة الـ${MATERIALS[x.material].ar.replace(/ي$/, "ية")} ${x.floats ? (x.under > 85 ? `تطفو وهي مغمورة تقريباً (${x.under}٪ تحت السطح)` : `تعود للأعلى وتطفو و${100 - x.under}٪ منها فوق الماء`) : "تغوص مباشرة إلى القاع"}`).join("، ")}. تصطدم بالماء بسرعة ${facts.entrySpeed} م/ث مع رذاذ على شكل تاج وحلقات تنتشر على السطح، والأشياء الثقيلة تتباطأ بسرعة تحت الماء.`;
  return { ...res, water: { level: 0, floor: -3 }, facts: { ...facts }, words: { en, ar } };
}
// ---------- air: a flag in the wind, paper vs a ball ----------
function airScene(mj, o) {
  const mode = pick(o.mode, ["flag", "paper"], "flag"), wind = num(o.wind, 0, 25, 9);
  if (mode === "flag") {
    const nx = 11, ny = 7, sp = 0.12, xml = `<mujoco>${header(0.003)}<worldbody><geom name="pole" type="cylinder" fromto="0 0 0 0 0 3" size="0.03" rgba=".75 .75 .78 1"/>
      <flexcomp name="flag" type="grid" count="${nx} ${ny} 1" spacing="${sp} ${sp} ${sp}" pos="${r3(((nx - 1) * sp) / 2 + 0.03)} 0 ${r3(3 - ((ny - 1) * sp) / 2)}" euler="90 0 0" radius="0.006" mass="0.25" dim="2" rgba="0 0 0 0">
      <edge equality="true" damping="0.002"/><contact selfcollide="none" contype="0" conaffinity="0"/><pin gridrange="0 0 0 ${ny - 1}"/></flexcomp></worldbody></mujoco>`;
    let cloth = null; const tris = []; for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) { const a = i * ny + j; tris.push([a, a + ny, a + 1], [a + 1, a + ny, a + ny + 1]); }
    const holder = {}; const res = run(mj, xml, { dur: 6, wind: [wind, wind * 0.15, 0], cloth: new Proxy({}, { get: (_, k) => holder.c && holder.c[k] }),
      setup: (m) => { holder.c = { nx, ny, tris, bodies: Array.from(m.flex_vertbodyid).slice(0, m.nflexvert), color: "#d94b3d" }; } });
    cloth = res.cloth; const lastC = cloth.frames[cloth.frames.length - 1]; const tipX = lastC[(nx * ny - 1) * 3];
    const facts = { mode, wind, kmh: Math.round(wind * 3.6), extended: r3(Math.max(0, tipX) / ((nx - 1) * sp + 0.03)) };
    const feel = wind < 3 ? ["hangs and barely moves", "يتدلى ولا يكاد يتحرك"] : wind < 9 ? ["waves softly, ripples running along it", "يتموج بهدوء وتجري التموجات على طوله"] : wind < 16 ? ["flies out and snaps in the gusts", "يمتد ويرفرف بقوة مع الهبات"] : ["is stretched flat and whips loudly at the edge", "يمتد مستوياً ويضرب طرفه بقوة"];
    return { ...res, facts, words: { en: `A cloth flag in a ${facts.kmh} km/h wind ${feel[0]}; the free edge moves most, gusts come every few seconds, the fabric folds and unfolds with real weight.`, ar: `علم من القماش في رياح سرعتها ${facts.kmh} كم/س ${feel[1]}، والطرف الحر يتحرك أكثر، والهبات تأتي كل بضع ثوانٍ، والقماش ينثني وينفرد بوزن حقيقي.` } };
  }
  const h = num(o.height, 1, 6, 2.5), xml = `<mujoco>${header(0.001, `density="${RHO_AIR}" viscosity="1.8e-5" wind="${r3(wind * 0.2)} 0 0"`)}<worldbody>${ground("wood")}
    <body name="paper" pos="-0.4 0 ${h}" euler="8 14 0"><freejoint/><geom name="paper:x" type="box" size="0.105 0.148 0.0006" density="67" fluidshape="ellipsoid" rgba=".97 .97 .95 1"/></body>
    <body name="ball" pos="0.4 0 ${h}"><freejoint/><geom name="ball:x" type="sphere" size="0.11" density="80" fluidshape="ellipsoid" rgba=".85 .3 .25 1" solref="0.004 0.2"/></body></worldbody></mujoco>`;
  const land = {}; const res = run(mj, xml, { dur: 7, each: (c, t) => { const { m, d } = c; for (const [n, hz] of [["paper", 0.0006], ["ball", 0.11]]) { const b = bodyId(mj, m, n); if (land[n] == null && d.xipos[b * 3 + 2] - hz < 0.03) land[n] = r3(t); } } });
  const facts = { mode, height: h, wind, paper: land.paper || null, ball: land.ball || null, vacuum: r3(Math.sqrt((2 * h) / G)) };
  return { ...res, facts, words: { en: `Dropped together from ${f1(h)} m: the ball lands after ${facts.ball || "-"} s, while the sheet of paper catches the air, swings side to side and glides down, landing after ${facts.paper || "more than 6"} s.`, ar: `يسقطان معاً من ${ar1(h)} م: الكرة تصل الأرض بعد ${facts.ball || "-"} ث، بينما تمسك الورقة بالهواء وتتأرجح يميناً ويساراً وتنزلق ببطء، فتصل بعد ${facts.paper || "أكثر من 6"} ث.` } };
}
// ---------- car ----------
function carScene(mj, o) {
  const act = pick(o.action, ["brake", "accelerate", "turn", "jump", "crash"], "brake"), kmh = num(o.speed, 10, 140, 80), v0 = kmh / 3.6, surf = pick(o.surface, ["asphalt", "wet", "gravel", "snow", "ice"], "asphalt"), S = SURFACES[surf];
  const wheel = (n, x, y, steer) => `<body name="${n}_s" pos="${x} ${y} -0.2"><joint name="${n}_susp" type="slide" axis="0 0 1" range="-0.14 0.12" stiffness="46000" damping="3600"/><geom type="sphere" size="0.05" mass="8" contype="0" conaffinity="0" rgba="0 0 0 0"/>
    ${steer ? `<body name="${n}_k"><joint name="${n}_steer" type="hinge" axis="0 0 1" range="-0.6 0.6" damping="20"/><geom type="sphere" size="0.04" mass="4" contype="0" conaffinity="0" rgba="0 0 0 0"/>` : ""}
    <body name="${n}" euler="90 0 0"><joint name="${n}_spin" type="hinge" axis="0 0 1" damping="0.4"/><geom name="wheel:${n}" type="cylinder" size="0.33 0.11" mass="22" friction="${S.mu} 0.01 0.001" condim="6" rgba=".08 .08 .09 1"/></body>${steer ? "</body>" : ""}</body>`;
  let extra = "";
  if (act === "jump") extra = `<geom name="ramp" type="box" pos="16 0 0.18" size="3 1.6 0.12" euler="0 -11 0" rgba=".55 .55 .58 1"/>`;
  const boxes = []; if (act === "crash") for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) boxes.push(`<body name="b${i}${j}" pos="${16 + i * 0.01} ${r3((j - 1.5) * 0.62)} ${r3(0.3 + i * 0.6)}"><freejoint/><geom name="box:${i}${j}" type="box" size="0.3 0.3 0.3" density="140" friction="0.6 0.005 0.0002" rgba=".78 .62 .4 1"/></body>`);
  const xml = `<mujoco>${header(0.002)}<worldbody><geom name="ground" type="plane" size="200 200 .1" friction="${S.mu} 0.01 0.0005" solmix="0.0001" rgba="0 0 0 0"/>${extra}${boxes.join("")}
    <body name="car" pos="0 0 0.7"><freejoint/><geom name="body:a" type="box" size="2.2 0.9 0.3" mass="1250" pos="0 0 0.05" rgba=".82 .16 .14 1"/><geom name="body:b" type="box" size="1.15 0.82 0.27" mass="90" pos="-0.25 0 0.6" rgba=".16 .2 .26 1"/>
    ${wheel("fl", 1.35, 0.86, 1)}${wheel("fr", 1.35, -0.86, 1)}${wheel("rl", -1.35, 0.86, 0)}${wheel("rr", -1.35, -0.86, 0)}</body></worldbody>
    <contact>${["fl", "fr", "rl", "rr"].map((w) => `<exclude body1="car" body2="${w}"/>`).join("")}</contact>
    <actuator><motor name="dl" joint="rl_spin" gear="-900" ctrlrange="0 1"/><motor name="dr" joint="rr_spin" gear="-900" ctrlrange="0 1"/><position name="sl" joint="fl_steer" kp="4000" ctrlrange="-0.6 0.6"/><position name="sr" joint="fr_steer" kp="4000" ctrlrange="-0.6 0.6"/></actuator></mujoco>`;
  const st = { stop: null, stopDist: 0, x0: 0, maxPitch: 0, maxRoll: 0, airborne: 0, air: 0, maxLat: 0, slid: false, hit: null, t100: null, peak: 0, landed: false };
  const spinDofs = [], A = {}; const dur = act === "accelerate" ? 8 : act === "jump" ? 5 : act === "crash" ? 5 : act === "turn" ? 6 : Math.min(9, v0 / (S.mu * G) + 2.5);
  const res = run(mj, xml, { dur, setup: (m, d) => { const c = bodyId(mj, m, "car"); const a = m.jnt_dofadr[m.body_jntadr[c]]; A.v = a; A.q = m.jnt_qposadr[m.body_jntadr[c]]; for (const w of ["fl", "fr", "rl", "rr"]) spinDofs.push(m.jnt_dofadr[m.body_jntadr[bodyId(mj, m, w)]]);
      if (act !== "accelerate") { d.qvel[a] = v0; spinDofs.forEach((s) => (d.qvel[s] = -v0 / 0.33)); } },
    each: (c, t) => { const { m, d } = c, cb = bodyId(mj, m, "car"), vx = d.qvel[A.v], vy = d.qvel[A.v + 1], sp = Math.hypot(vx, vy), R = d.xmat, pitch = Math.asin(Math.max(-1, Math.min(1, -R[cb * 9 + 6]))), roll = Math.atan2(R[cb * 9 + 7], R[cb * 9 + 8]);
      st.maxPitch = Math.max(st.maxPitch, Math.abs(pitch)); st.maxRoll = Math.max(st.maxRoll, Math.abs(roll));
      d.ctrl[0] = d.ctrl[1] = 0; d.ctrl[2] = d.ctrl[3] = 0;
      const brake = (k) => spinDofs.forEach((s) => (d.qfrc_applied[s] = -Math.max(-k, Math.min(k, 900 * d.qvel[s]))));
      if (act === "brake") { if (t > 0.4) brake(1100); else spinDofs.forEach((s) => (d.qfrc_applied[s] = 0)); if (t > 0.4 && st.stop == null && sp < 0.15) { st.stop = r3(t - 0.4); st.stopDist = r3(d.qpos[A.q] - st.x0); c.events.push({ t: r3(t), type: "stop", what: "car" }); } if (t <= 0.4) st.x0 = d.qpos[A.q]; }
      else { spinDofs.forEach((s) => (d.qfrc_applied[s] = 0)); }
      if (act === "accelerate") { d.ctrl[0] = d.ctrl[1] = 1; if (st.t100 == null && sp >= Math.min(v0, 27.8)) st.t100 = r3(t); st.peak = Math.max(st.peak, sp); const wr = Math.abs(d.qvel[spinDofs[2]]) * 0.33; if (wr > sp * 1.25 + 1) st.slid = true; }
      if (act === "turn") { const s = t > 0.6 ? Math.min(0.32, (t - 0.6) * 0.8) : 0; d.ctrl[2] = d.ctrl[3] = s; if (t > 0.6) { d.ctrl[0] = d.ctrl[1] = 0.25; } const head = Math.atan2(R[cb * 9 + 3], R[cb * 9]), dir = Math.atan2(vy, vx); if (sp > 3 && Math.abs(((dir - head + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > 0.25) st.slid = true;
        st.maxLat = Math.max(st.maxLat, Math.abs(d.qacc[A.v + 1] * Math.cos(head) - d.qacc[A.v] * Math.sin(head)) / G); }
      if (act === "jump" || act === "crash") { d.ctrl[0] = d.ctrl[1] = 0.15; let wheelsDown = 0; for (const [g1, g2] of c.cons()) { const n1 = mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM.value, g1) || "", n2 = mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM.value, g2) || ""; if (n1.startsWith("wheel") || n2.startsWith("wheel")) wheelsDown++; if (act === "crash" && st.hit == null && (n1.startsWith("box") || n2.startsWith("box")) && (n1.startsWith("body") || n2.startsWith("body"))) { st.hit = r3(t); st.hitSpeed = f1(sp * 3.6); c.events.push({ t: r3(t), type: "impact", what: "car", speed: f1(sp) }); } }
        if (act === "jump") { if (!wheelsDown && d.qpos[A.q] > 14) { st.off = st.off == null ? t : st.off; if (!st.airborne && t - st.off > 0.1) { st.airborne = st.off; st.takeoffX = st.offX; c.events.push({ t: r3(st.off), type: "airborne", what: "car" }); } }
          else { st.off = null; st.offX = d.qpos[A.q]; if (st.airborne && !st.landed && wheelsDown >= 2 && t - st.airborne > 0.15) { st.landed = true; st.air = r3(t - st.airborne); st.jumpLen = r3(d.qpos[A.q] - st.takeoffX); c.events.push({ t: r3(t), type: "land", what: "car" }); } } } } } });
  const facts = { action: act, speed: kmh, surface: surf, stopTime: st.stop, stopDist: st.stopDist, decel: st.stop ? r3(v0 / st.stop / G) : null, noseDip: Math.round((st.maxPitch * 180) / Math.PI * 10) / 10, roll: Math.round((st.maxRoll * 180) / Math.PI * 10) / 10, slid: st.slid, airTime: st.air || 0, jumpLen: st.jumpLen || 0, hitSpeed: st.hitSpeed || null, t100: st.t100, top: Math.round(st.peak * 3.6) };
  const W = { brake: [`The car brakes hard from ${kmh} km/h on ${S.en}: the nose dips ${facts.noseDip}°, the tyres ${surf === "ice" || surf === "snow" ? "lock and slide" : "squeal"} and it stops in ${facts.stopDist} m after ${facts.stopTime} s (${facts.decel} g).`, `تكبح السيارة بقوة من ${kmh} كم/س على ${S.ar}: تنخفض المقدمة ${facts.noseDip}°، و${surf === "ice" || surf === "snow" ? "تنغلق العجلات وتنزلق" : "تصدر الإطارات صريراً"} وتتوقف خلال ${facts.stopDist} م بعد ${facts.stopTime} ث (${facts.decel} g).`],
    accelerate: [`Full throttle from a standstill on ${S.en}: the rear squats, ${facts.slid ? "the rear tyres spin and smoke before they grip" : "the tyres grip"}, reaching ${facts.top} km/h${facts.t100 ? ` (100 km/h in ${facts.t100} s)` : ""}.`, `انطلاق بأقصى قوة من التوقف على ${S.ar}: تنخفض المؤخرة، و${facts.slid ? "تدور الإطارات الخلفية وتدخّن قبل أن تتماسك" : "تتماسك الإطارات"}، حتى ${facts.top} كم/س${facts.t100 ? ` (100 كم/س في ${facts.t100} ث)` : ""}.`],
    turn: [`At ${kmh} km/h on ${S.en} the car turns in: the body leans ${facts.roll}° to the outside${facts.slid ? " and the rear steps out into a slide" : ", the tyres hold the line"}.`, `بسرعة ${kmh} كم/س على ${S.ar} تنعطف السيارة: يميل الجسم ${facts.roll}° للخارج${facts.slid ? " وتنزلق المؤخرة جانبياً" : " وتحافظ الإطارات على المسار"}.`],
    jump: [`The car hits a ramp at ${kmh} km/h, flies ${facts.airTime} s for ${facts.jumpLen} m with the nose dropping, then lands hard: the suspension compresses and the body bounces once.`, `تصطدم السيارة بمنحدر بسرعة ${kmh} كم/س، وتطير ${facts.airTime} ث لمسافة ${facts.jumpLen} م والمقدمة تنخفض، ثم تهبط بقوة: ينضغط التعليق ويرتد الجسم مرة واحدة.`],
    crash: [`The car drives into a wall of cardboard boxes at ${facts.hitSpeed || kmh} km/h: the boxes burst apart and tumble, the car slows but keeps rolling through.`, `تصطدم السيارة بجدار من الصناديق الكرتونية بسرعة ${facts.hitSpeed || kmh} كم/س: تتطاير الصناديق وتتدحرج، وتتباطأ السيارة لكنها تواصل المرور.`] }[act];
  return { ...res, ground: { surface: surf, color: S.color }, facts, words: { en: W[0], ar: W[1] } };
}
// ---------- a human body ----------
const SEG_COLOR = "#d9cfc4";
function humanXML(o = {}) { const arm = (s, y) => `<body name="uarm_${s}" pos="0 ${y} 0.38"><joint name="sh1_${s}" type="hinge" axis="0 1 0" range="-150 60"/><joint name="sh2_${s}" type="hinge" axis="1 0 0" range="${s === "l" ? "-10 160" : "-160 10"}"/>
  <geom name="arm:u${s}" fromto="0 0 0 0 0 -0.28" size="0.045"/><body name="larm_${s}" pos="0 0 -0.3"><joint name="elb_${s}" type="hinge" axis="0 1 0" range="-150 0"/><geom name="arm:l${s}" fromto="0 0 0 0 0 -0.25" size="0.04"/><geom name="hand:${s}" type="sphere" pos="0 0 -0.29" size="0.045"/></body></body>`;
  const leg = (s, y) => `<body name="thigh_${s}" pos="0 ${y} -0.04"><joint name="hipx_${s}" type="hinge" axis="1 0 0" range="-35 35"/><joint name="hipy_${s}" type="hinge" axis="0 1 0" range="-120 30"/>
  <geom name="leg:t${s}" fromto="0 0 0 0 0 -0.42" size="0.065"/><body name="shin_${s}" pos="0 0 -0.45"><joint name="knee_${s}" type="hinge" axis="0 1 0" range="0 150"/><geom name="leg:s${s}" fromto="0 0 0 0 0 -0.4" size="0.05"/>
  <body name="foot_${s}" pos="0 0 -0.44"><joint name="ank_${s}" type="hinge" axis="0 1 0" range="-40 40"/><geom name="foot:${s}" type="box" size="0.12 0.045 0.025" pos="0.04 0 -0.01"/></body></body></body>`;
  return `<body name="pelvis" pos="${o.x || 0} 0 ${r3(0.985 + (o.z || 0))}" euler="0 0 ${o.yaw || 0}"><freejoint/><geom name="hip:p" fromto="0 -0.09 0 0 0.09 0" size="0.09"/>
 <body name="torso" pos="0 0 0.1"><joint name="abd_y" type="hinge" axis="0 1 0" range="-30 70"/><joint name="abd_x" type="hinge" axis="1 0 0" range="-30 30"/>
  <geom name="back:t" fromto="0 0 0 0 0 0.34" size="0.11"/><geom name="back:c" fromto="0 -0.13 0.32 0 0.13 0.32" size="0.08"/>
  <body name="head" pos="0 0 0.48"><joint name="neck" type="hinge" axis="0 1 0" range="-45 45"/><geom name="head:h" type="sphere" pos="0 0 0.08" size="0.1"/></body>${arm("l", 0.21)}${arm("r", -0.21)}</body>${leg("l", 0.09)}${leg("r", -0.09)}</body>`; }
const HUMAN_DEF = `<compiler angle="degree"/><default><joint damping="3" armature="0.03" limited="true"/><geom type="capsule" condim="3" friction="0.9 0.005 0.0001" density="985" rgba=".85 .81 .77 1"/></default>`;
function bodyScene(mj, o) {
  const act = pick(o.action, ["push", "trip", "fall", "hit", "water"], "push"), from = pick(o.from, ["front", "back", "left", "right"], "front"), str = pick(o.strength, ["light", "medium", "strong"], "medium"), tone = pick(o.tone, ["tense", "normal", "limp"], "normal");
  const h = act === "fall" || act === "water" ? num(o.height, 1, 10, 3) : 0, surf = pick(o.surface, Object.keys(SURFACES), "concrete");
  const F = { light: 170, medium: 270, strong: 420 }[str], dir = { front: [-1, 0], back: [1, 0], left: [0, -1], right: [0, 1] }[from], keep = { tense: 1.6, normal: 1, limp: 0.45 }[tone];
  let world = act === "water" ? `<geom name="pool" type="plane" pos="0 0 -4" size="30 30 .1" rgba="0 0 0 0"/><geom name="ledge" type="box" pos="-0.6 0 ${r3((h - 4) / 2)}" size="0.8 1 ${r3((h + 4) / 2)}" rgba=".7 .68 .64 1"/>` : ground(surf);
  if (act === "trip") world += `<geom name="curb" type="box" pos="0.55 0 0.06" size="0.06 1.2 0.06" rgba=".75 .73 .68 1"/>`;
  if (act === "fall") world += `<geom name="ledge" type="box" pos="-0.6 0 ${r3(h / 2)}" size="0.8 1 ${r3(h / 2)}" rgba=".7 .68 .64 1"/>`;
  const ball = act === "hit" ? `<body name="ball" pos="3 0 1.45"><freejoint/><geom name="ball:b" type="sphere" size="0.11" mass="0.43" solref="0.004 0.15" rgba=".95 .95 .95 1"/></body>` : "";
  const startX = act === "fall" || act === "water" ? 0.5 : 0;   // stepped clear of the edge (the ledge ends at x = 0.2)
  const xml = `<mujoco>${HUMAN_DEF}${header(0.002)}<worldbody>${world}${humanXML({ x: startX, z: h })}${ball}</worldbody></mujoco>`;
  const st = { first: null, firstT: null, ground: null, impact: 0, lastV: 0, splash: null, feet: null }; let q0 = null, hinge = [], tgt = null, land = null;
  // reflexes (what people do when they lose balance): falling back → sit down, chin in, hands behind; falling forward → hands out;
  // to the side → that arm out; dropping from a height → legs ready, then they give way on landing
  const D = Math.PI / 180, back = act === "hit" || (act === "push" && from === "front"), fwd = act === "trip" || (act === "push" && from === "back");
  const side = act === "push" && (from === "left" || from === "right") ? (from === "left" ? "r" : "l") : null;
  const BRACE = back ? { hipy_l: -55, hipy_r: -55, knee_l: 70, knee_r: 70, abd_y: 35, sh1_l: 45, sh1_r: 45, elb_l: -20, elb_r: -20, neck: 25 }
    : fwd ? { hipy_l: -25, hipy_r: -25, knee_l: 25, knee_r: 25, abd_y: 15, sh1_l: -75, sh1_r: -75, elb_l: -25, elb_r: -25, neck: -25 }
    : side ? { hipy_l: -30, hipy_r: -30, knee_l: 40, knee_r: 40, abd_y: 15, ["sh2_" + side]: side === "l" ? 70 : -70, ["sh1_" + side]: -20, neck: 10 }
    : { hipy_l: -20, hipy_r: -20, knee_l: 20, knee_r: 20, abd_y: 8 };
  const LAND = { hipy_l: -80, hipy_r: -80, knee_l: 100, knee_r: 100, abd_y: 40, sh1_l: -45, sh1_r: -45, elb_l: -30, elb_r: -30 };
  const water = act === "water" ? { level: 0, bodies: [], splashed: new Set() } : null;
  const push0 = act === "push" ? 0.5 : act === "hit" ? 0 : 0.35, lose = act === "push" || act === "hit" ? 0.5 : 0.35;
  const res = run(mj, xml, { dur: act === "water" ? 6 : 4.5, water,
    setup: (m, d) => { q0 = Float64Array.from(d.qpos); for (let j = 0; j < m.njnt; j++) if (m.jnt_type[j] === 3) hinge.push(j);
      const at = (P) => { const t = Float64Array.from(q0); for (const [n, deg] of Object.entries(P)) { const j = mj.mj_name2id(m, mj.mjtObj.mjOBJ_JOINT.value, n); if (j >= 0) t[m.jnt_qposadr[j]] = deg * D; } return t; };
      tgt = at(BRACE); land = at(LAND);
      if (water) for (const n of ["pelvis", "torso", "head", "uarm_l", "larm_l", "uarm_r", "larm_r", "thigh_l", "shin_l", "foot_l", "thigh_r", "shin_r", "foot_r"]) water.bodies.push(waterBody(mj, m, n, "body"));
      if (act === "trip") d.qvel[0] = 1.6; if (act === "fall" || act === "water") { d.qvel[0] = 0.6; } if (act === "hit") { const b = bodyId(mj, m, "ball"), a = m.jnt_dofadr[m.body_jntadr[b]]; d.qvel[a] = -14; d.qvel[a + 2] = 1.2; } },
    each: (c, t) => { const { m, d } = c; const torso = bodyId(mj, m, "torso");
      // muscles: hold the pose, react 0.15 s after losing balance, keep some tone while falling, give way after the hit
      const tR = push0 + 0.15, blend = Math.max(0, Math.min(1, (t - tR) / 0.25)), drop = act === "fall" || act === "water";
      let tone = t < push0 + 0.05 ? 1 : Math.max(0.25, 1 - (t - push0) / (lose * 1.6));
      if (drop) tone = st.feet == null ? 1 : Math.max(0.2, 0.6 - (t - st.feet) / 0.5);
      if (st.ground != null) tone = Math.min(tone, Math.max(0.1, 0.4 - (t - st.ground) / 0.4));
      if (act === "water" && st.splashT != null) tone = 0.2;
      const kp = 650 * keep * tone, kd = 32 * keep * tone, aim = drop && st.feet != null ? land : tgt, mix = drop ? (st.feet != null ? Math.min(1, (t - st.feet) / 0.2) : blend) : blend;
      for (const j of hinge) { const a = m.jnt_qposadr[j], v = m.jnt_dofadr[j], goal = (drop && st.feet != null ? tgt[a] : q0[a]) + mix * (aim[a] - (drop && st.feet != null ? tgt[a] : q0[a])); d.qfrc_applied[v] = kp * (goal - d.qpos[a]) - kd * d.qvel[v]; }
      if (act === "water" && st.splashT == null && c.events.some((e) => e.type === "splash")) st.splashT = t;
      if (act === "push" && t > push0 && t < push0 + 0.16) { d.xfrc_applied[torso * 6] += dir[0] * F; d.xfrc_applied[torso * 6 + 1] += dir[1] * F; }
      const pz = d.xipos[bodyId(mj, m, "pelvis") * 3 + 2], vz = d.cvel[bodyId(mj, m, "pelvis") * 6 + 5];
      if (st.feet == null && t > 0.05) for (const [g1, g2] of c.cons()) { const n1 = mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM.value, g1) || "", n2 = mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM.value, g2) || ""; if ((n1 === "ground" && n2.startsWith("foot")) || (n2 === "ground" && n1.startsWith("foot"))) { st.feet = t; if (act === "fall") { st.landSpeed = f1(Math.abs(st.lastV)); c.events.push({ t: r3(t), type: "land", what: "feet", speed: st.landSpeed }); } break; } }
      if (st.ground == null) { for (const [g1, g2] of c.cons()) { const n1 = mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM.value, g1) || "", n2 = mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM.value, g2) || ""; if (n1.startsWith("ball") || n2.startsWith("ball")) continue;
          const gr = (n) => n === "ground" || n === "pool", part = gr(n1) ? n2 : gr(n2) ? n1 : null; if (part && !part.startsWith("foot") && t > push0) { st.ground = r3(t); st.first = part.split(":")[0]; st.impact = f1(Math.abs(st.lastV)); c.events.push({ t: st.ground, type: "impact", what: st.first, speed: st.impact }); break; } } }
      st.lastV = vz; } });
  const sp = res.events.find((e) => e.type === "splash");
  let headOut = null, deepest = null; if (water) { const hs = res.shapes.filter((x) => !x.still).findIndex((x) => x.part === "head"); if (hs >= 0) { const zs = res.frames.map((f) => f[hs * 7 + 2]); headOut = zs[zs.length - 1] > 0.02; deepest = r3(Math.min(...zs)); } }
  const PART = { hip: ["hip", "الورك"], back: ["back", "الظهر"], head: ["head", "الرأس"], arm: ["arm", "الذراع"], hand: ["hands", "اليدين"], leg: ["leg", "الساق"], ball: ["ball", "الكرة"] }[st.first] || ["side", "الجنب"];
  const facts = { action: act, from, strength: str, tone, height: h, ground: st.ground, first: st.first, impact: st.impact, feet: st.feet != null && act === "fall" ? r3(st.feet) : null, landSpeed: st.landSpeed || null, splash: sp ? sp.speed : null, fallTime: h ? r3(Math.sqrt((2 * h) / G)) : null, headOut, deepest };
  const tn = { tense: ["stiff, braced", "متصلب ومتأهب"], normal: ["natural", "طبيعي"], limp: ["loose, limp", "مرتخٍ"] }[tone];
  const W = { push: [`A ${str} shove from the ${from}: the person stumbles a step, loses balance and falls, landing first on the ${PART[0]} after ${st.ground || "-"} s at ${st.impact} m/s; the body moves as one weight, arms swing out late, a ${tn[0]} fall.`, `دفعة ${{ light: "خفيفة", medium: "متوسطة", strong: "قوية" }[str]} من ${{ front: "الأمام", back: "الخلف", left: "اليسار", right: "اليمين" }[from]}: يتعثر الشخص خطوة ويفقد توازنه ويسقط على ${PART[1]} أولاً بعد ${st.ground || "-"} ث بسرعة ${st.impact} م/ث؛ الجسم يتحرك ككتلة واحدة والذراعان تتأخران، سقوط ${tn[1]}.`],
    trip: [`Walking briskly, the person catches a foot on a curb: the upper body keeps going, the hands reach out, and the ${PART[0]} hits the ground first after ${st.ground || "-"} s.`, `أثناء المشي السريع تعلق قدم الشخص بحافة الرصيف: يواصل الجزء العلوي حركته وتمتد اليدان، ويصطدم ${PART[1]} بالأرض أولاً بعد ${st.ground || "-"} ث.`],
    fall: [`The person steps off a ${f1(h)} m ledge: ${facts.fallTime} s in the air, lands feet first at ${facts.landSpeed || "-"} m/s on ${SURFACES[surf].en}, the knees and hips fold to soak up the hit${st.first ? ` and the ${PART[0]} goes down too` : ""}.`, `يخطو الشخص من حافة ارتفاعها ${ar1(h)} م: ${facts.fallTime} ث في الهواء، ويهبط على قدميه بسرعة ${facts.landSpeed || "-"} م/ث على ${SURFACES[surf].ar}، وتنثني الركبتان والوركان لامتصاص الصدمة${st.first ? ` ثم يلمس ${PART[1]} الأرض أيضاً` : ""}.`],
    hit: [`A football hits the person in the chest at 50 km/h: the upper body snaps back, the person staggers ${st.ground ? "and falls" : "but stays up"}, the ball bounces away.`, `كرة قدم تصيب الشخص في صدره بسرعة 50 كم/س: يرتد الجزء العلوي للخلف ويترنح الشخص ${st.ground ? "ثم يسقط" : "لكنه يبقى واقفاً"}، وترتد الكرة بعيداً.`],
    water: [`The person drops ${f1(h)} m into deep water, enters at ${facts.splash || "-"} m/s with a big splash, goes ${deepest != null ? Math.round(-deepest * 10) / 10 + " m" : ""} under, slows fast, then ${headOut ? "floats back up with the head out" : "drifts just under the surface"}.`, `يسقط الشخص ${ar1(h)} م في ماء عميق، ويدخله بسرعة ${facts.splash || "-"} م/ث مع رذاذ كبير، ويغوص ${deepest != null ? Math.round(-deepest * 10) / 10 + " م" : ""} ثم يتباطأ بسرعة و${headOut ? "يطفو عائداً ورأسه فوق الماء" : "يبقى تحت السطح بقليل"}.`] }[act];
  return { ...res, water: water ? { level: 0, floor: -4 } : null, ground: water ? null : { surface: surf, color: SURFACES[surf].color }, facts, words: { en: W[0], ar: W[1] } };
}
export const SCENES = { objects, water: waterScene, air: airScene, car: carScene, body: bodyScene };
export function simulate(mj, scene, opts = {}) {
  const f = SCENES[scene]; if (!f) throw Object.assign(new Error("Unknown scene"), { code: 400 });
  const t0 = Date.now(), r = f(mj, opts || {}); const shapes = r.shapes.map(({ i, kind, size, color, part, pos, quat, still }) => ({ i, kind, size, color, part, ...(still ? { pos, quat } : {}) }));
  return { scene, fps: FPS, dur: r3((r.frames.length - 1) / FPS), shapes, frames: r.frames, cloth: r.cloth, water: r.water || null, ground: "ground" in r ? r.ground : scene === "water" || (scene === "air" && r.facts.mode === "flag") ? null : { surface: r.facts.surface || "concrete", color: (SURFACES[r.facts.surface] || SURFACES.concrete).color },
    events: r.events, facts: r.facts, words: r.words, ms: Date.now() - t0 };
}
