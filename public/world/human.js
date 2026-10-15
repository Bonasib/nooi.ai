// Real-looking people for the 3D World. A person is a textured 3D model that the AI 3D engines made from a real photo —
// a character's real face → a full-body picture of that same person → a 3D model — never a drawn or box figure.
// Here the model gets a skeleton fitted to its own body (hips, spine, chest, neck, head, arms and legs found from the shape
// of the mesh, skin weights by distance to each bone) and moves in code like a person: a walk with hip sway, knee bend, foot
// roll and arm swing, standing and breathing, waving, talking with the hands, sitting, running and dancing. What each person
// does comes from the plan (the words): walk to the car, wave, sit on the bench, talk to each other, dance, wander — and
// people turn to look at you when you come close.
const PROTOS = new Map();   // url → Promise<prototype>
const NAMES = ["hips", "spine", "chest", "neck", "head", "l_arm", "l_fore", "l_hand", "r_arm", "r_fore", "r_hand", "l_thigh", "l_shin", "l_foot", "r_thigh", "r_shin", "r_foot"];
const PARENT = { spine: "hips", chest: "spine", neck: "chest", head: "neck", l_arm: "chest", l_fore: "l_arm", l_hand: "l_fore", r_arm: "chest", r_fore: "r_arm", r_hand: "r_fore",
  l_thigh: "hips", l_shin: "l_thigh", l_foot: "l_shin", r_thigh: "hips", r_shin: "r_thigh", r_foot: "r_shin" };
const END = { head: "headTop", l_hand: "l_end", r_hand: "r_end", l_foot: "l_toe", r_foot: "r_toe" };   // the far end of the last bone in a chain
const CHILD = { hips: "spine", spine: "chest", chest: "neck", neck: "head", l_arm: "l_fore", l_fore: "l_hand", r_arm: "r_fore", r_fore: "r_hand", l_thigh: "l_shin", l_shin: "l_foot", r_thigh: "r_shin", r_shin: "r_foot" };

export function loadHuman(T, url) {
  if (!PROTOS.has(url)) PROTOS.set(url, buildProto(T, url).catch((e) => { PROTOS.delete(url); throw e; }));
  return PROTOS.get(url);
}

// ---- the model → one frame (feet on y = 0, 1 unit tall, facing +Z), its joints, a skeleton and skin weights ----
async function buildProto(T, url) {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const g = await new GLTFLoader().loadAsync(url);
  g.scene.updateMatrixWorld(true);
  const parts = [];
  g.scene.traverse((n) => {
    if (!n.isMesh || !n.geometry || !n.geometry.attributes.position) return;
    const geo = n.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (!["position", "normal", "uv", "color"].includes(k)) geo.deleteAttribute(k);
    geo.applyMatrix4(n.matrixWorld); parts.push({ geo, mat: n.material });
  });
  if (!parts.length) throw new Error("no person in the model");
  const each = (f) => { for (const p of parts) { const a = p.geo.attributes.position; for (let i = 0; i < a.count; i++) f(a.getX(i), a.getY(i), a.getZ(i)); } };
  const box = () => { const b = new T.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); } return b; };
  const apply = (m) => { for (const p of parts) p.geo.applyMatrix4(m); };
  // up is the tallest side
  let b = box(), s = b.getSize(new T.Vector3());
  if (s.z > s.y * 1.15 && s.z >= s.x) apply(new T.Matrix4().makeRotationX(-Math.PI / 2));
  else if (s.x > s.y * 1.15 && s.x >= s.z) apply(new T.Matrix4().makeRotationZ(Math.PI / 2));
  b = box(); s = b.getSize(new T.Vector3());
  // feet on the ground, 1 unit tall
  const H = s.y || 1; apply(new T.Matrix4().makeTranslation(0, -b.min.y, 0)); apply(new T.Matrix4().makeScale(1 / H, 1 / H, 1 / H));
  // centred on the hips
  { let sx = 0, sz = 0, n = 0; each((x, y, z) => { if (y > 0.44 && y < 0.58) { sx += x; sz += z; n++; } }); if (n) apply(new T.Matrix4().makeTranslation(-sx / n, 0, -sz / n)); }
  // facing +Z: the toes point forward (the feet reach further in front than the ankles)
  { let fz = 0, fn = 0, az = 0, an = 0; each((x, y, z) => { if (y < 0.035) { fz += z; fn++; } else if (y > 0.06 && y < 0.13) { az += z; an++; } });
    if (fn && an && fz / fn < az / an - 0.004) apply(new T.Matrix4().makeRotationY(Math.PI)); }
  for (const p of parts) { p.geo.computeVertexNormals(); p.geo.computeBoundingBox(); p.geo.computeBoundingSphere(); }
  const J = fitJoints(each);
  return makeSkinned(T, parts, J);
}

// where the joints are, from the shape of the body (1 unit tall, facing +Z, the person's left is +X)
function fitJoints(each) {
  const BIN = 0.006, NB = Math.round(1 / BIN), bands = 40, occ = [], cz = new Float32Array(bands), cn = new Float32Array(bands);
  for (let k = 0; k < bands; k++) occ.push(new Uint8Array(NB + 1));
  each((x, y, z) => { const k = Math.min(bands - 1, Math.max(0, Math.floor(y * bands))), i = Math.round((x + 0.5) / BIN); if (i >= 0 && i <= NB) occ[k][i] = 1; cz[k] += z; cn[k]++; });
  const zAt = (y) => { const k = Math.min(bands - 1, Math.max(0, Math.floor(y * bands))); return cn[k] ? cz[k] / cn[k] : 0; };
  // the run of filled cells around the middle of a band (the torso, or the two legs together)
  const run = (k) => { const o = occ[k], c = Math.round(0.5 / BIN); let lo = c, hi = c, gap = 0;
    if (!o[c]) { let d = 1; while (d < 12 && !o[c - d] && !o[c + d]) d++; if (d >= 12) return null; lo = hi = o[c - d] ? c - d : c + d; }
    for (gap = 0; lo > 0 && gap <= 2; lo--) gap = o[lo - 1] ? 0 : gap + 1; lo += gap;
    for (gap = 0; hi < NB && gap <= 2; hi++) gap = o[hi + 1] ? 0 : gap + 1; hi -= gap;
    return [lo * BIN - 0.5, hi * BIN - 0.5]; };
  // the legs part at the crotch: the middle of the band is empty there
  let crotch = 0; for (let k = Math.floor(0.52 * bands); k >= Math.floor(0.2 * bands); k--) { const o = occ[k], c = Math.round(0.5 / BIN); if (!o[c] && !o[c - 1] && !o[c + 1]) { crotch = (k + 1) / bands; break; } }
  const robe = !crotch; if (robe) crotch = 0.47;
  // the torso's half width at each band (arms that hang away from the body are outside it)
  const half = new Float32Array(bands); for (let k = 0; k < bands; k++) { const r = run(k); half[k] = r ? Math.max(-r[0], r[1]) : 0.12; }
  const halfAt = (y) => half[Math.min(bands - 1, Math.max(0, Math.floor(y * bands)))];
  // the arm points on each side: away from the torso, between the hips and the shoulders
  const arm = { l: [], r: [] }; each((x, y, z) => { if (y < Math.max(crotch, 0.36) || y > 0.83) return; if (Math.abs(x) > halfAt(y) + 0.012) arm[x > 0 ? "l" : "r"].push([x, y, z]); });
  const chestHalf = Math.max(0.07, Math.min(0.15, halfAt(0.76)));
  const J = { hips: [0, 0.53, zAt(0.53)], spine: [0, 0.62, zAt(0.62)], chest: [0, 0.72, zAt(0.72)], neck: [0, 0.845, zAt(0.84)], head: [0, 0.885, zAt(0.9)], headTop: [0, 1, zAt(0.97)] };
  const armsDown = {};
  for (const sd of ["l", "r"]) {
    const sg = sd === "l" ? 1 : -1, sh = [sg * chestHalf * 0.86, 0.815, zAt(0.8)], P = arm[sd];
    let dir = [sg * 0.08, -1, 0.02];
    if (P.length > 60) {   // the arm's direction: from the shoulder to the farthest arm point
      let far = null, fd = 0; for (const p of P) { const d = (p[0] - sh[0]) ** 2 + (p[1] - sh[1]) ** 2 + (p[2] - sh[2]) ** 2; if (d > fd) { fd = d; far = p; } }
      const L = Math.sqrt(fd); if (L > 0.22 && L < 0.6) dir = [(far[0] - sh[0]) / L, (far[1] - sh[1]) / L, (far[2] - sh[2]) / L];
      armsDown[sd] = false; J[sd + "_arm"] = sh; const at = (f) => sh.map((v, i) => v + dir[i] * L * f);
      J[sd + "_fore"] = at(0.46); J[sd + "_hand"] = at(0.84); J[sd + "_end"] = at(1);
    } else { armsDown[sd] = true; J[sd + "_arm"] = sh; const at = (f) => [sh[0] + sg * 0.012 * f, sh[1] - 0.4 * f, sh[2] + 0.01 * f]; J[sd + "_fore"] = at(0.46); J[sd + "_hand"] = at(0.84); J[sd + "_end"] = at(1); }
    // the legs: the middle of each leg at the knee and the ankle
    let kx = 0, kn = 0, ax = 0, an = 0, kz = 0, az = 0;
    each((x, y, z) => { if (sg * x <= 0.005) return; if (y > 0.25 && y < 0.31) { kx += x; kz += z; kn++; } else if (y > 0.035 && y < 0.07) { ax += x; az += z; an++; } });
    const knee = kn ? [kx / kn, 0.28, kz / kn] : [sg * 0.055, 0.28, 0], ank = an ? [ax / an, 0.048, az / an] : [sg * 0.06, 0.048, 0.0];
    J[sd + "_thigh"] = [knee[0] * 1.06 || sg * 0.06, Math.min(0.5, crotch + 0.04), zAt(0.5)]; J[sd + "_shin"] = knee; J[sd + "_foot"] = ank; J[sd + "_toe"] = [ank[0], 0.012, ank[2] + 0.075];
  }
  J.robe = robe; J.crotch = crotch; J.halfAt = halfAt; J.armsDown = armsDown;
  return J;
}

function makeSkinned(T, parts, J) {
  const holder = new T.Group(), bones = {}, list = [];
  for (const n of NAMES) { const b = new T.Bone(); b.name = "nooi_" + n; bones[n] = b; list.push(b); }
  for (const n of NAMES) { const p = PARENT[n], src = J[n];
    if (p) { const pj = J[p]; bones[n].position.set(src[0] - pj[0], src[1] - pj[1], src[2] - pj[2]); bones[p].add(bones[n]); } else bones[n].position.set(src[0], src[1], src[2]); }
  holder.add(bones.hips); holder.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(list);
  // each bone as a segment (joint → its child joint, or the end of the chain)
  const segs = NAMES.map((n) => { const a = J[n], b = J[CHILD[n]] || J[END[n]] || [a[0], a[1] + 0.05, a[2]]; return { n, a, b }; });
  const idx = Object.fromEntries(NAMES.map((n, i) => [n, i]));
  // each point follows its nearest bone (bones on the other side of the body never count), blended with the next bone only
  // near a joint — so a raised arm never drags the shirt, and a hand hanging by the hip never follows the leg
  const side = (n) => (n.startsWith("l_") ? 1 : n.startsWith("r_") ? -1 : 0);
  const near = (x, y, z) => { let best = -1, bd = 1e9, bt = 0;
    for (let k = 0; k < segs.length; k++) { const sg = side(segs[k].n); if ((sg > 0 && x < -0.015) || (sg < 0 && x > 0.015)) continue;
      const [ax, ay, az] = segs[k].a, bx = segs[k].b[0] - ax, by = segs[k].b[1] - ay, bz = segs[k].b[2] - az, L2 = bx * bx + by * by + bz * bz || 1e-6;
      let t = ((x - ax) * bx + (y - ay) * by + (z - az) * bz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(x - ax - bx * t, y - ay - by * t, z - az - bz * t);
      if (d < bd) { bd = d; best = k; bt = t; } }
    return [best, bt]; };
  for (const p of parts) {
    const pos = p.geo.attributes.position, n = pos.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), [k, t] = near(x, y, z), nm = NAMES[k], par = PARENT[nm], ch = CHILD[nm];
      let w0 = 1, k1 = k, w1 = 0;
      if (t < 0.22 && par) { k1 = idx[par]; w1 = 0.5 * (0.22 - t) / 0.22; } else if (t > 0.78 && ch) { k1 = idx[ch]; w1 = 0.5 * (t - 0.78) / 0.22; }
      w0 = 1 - w1; si[i * 4] = k; sw[i * 4] = w0; si[i * 4 + 1] = k1; sw[i * 4 + 1] = w1;
    }
    p.geo.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4)); p.geo.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    const m = Array.isArray(p.mat) ? p.mat.map((x) => x.clone()) : p.mat.clone();
    const sm = new T.SkinnedMesh(p.geo, m); sm.castShadow = true; sm.frustumCulled = false; holder.add(sm); holder.updateMatrixWorld(true); sm.bind(skeleton);
  }
  // the arms hang down when they stand (the photo was taken with the arms a little away from the body)
  const down = {}; for (const sd of ["l", "r"]) { const a = J[sd + "_arm"], h = J[sd + "_hand"], d = new T.Vector3(h[0] - a[0], h[1] - a[1], h[2] - a[2]).normalize();
    down[sd] = { dir: d, q: new T.Quaternion().setFromUnitVectors(d, new T.Vector3(sd === "l" ? 0.1 : -0.1, -1, 0.03).normalize()) }; }
  return { holder, J, down, hipsY: J.hips[1] };
}

// ---- moving like a person ----
const ang = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function poser(T, inst) {
  const E = new T.Euler(), Q = new T.Quaternion(), V = new T.Vector3(), B = inst.bones, P = inst.proto;
  const set = (b, x, y, z, base) => { b.quaternion.setFromEuler(E.set(x, y, z, "YXZ")); if (base) b.quaternion.multiply(base); };
  const up = (sd, x, y, z) => { V.set(x, y, z).normalize(); return Q.clone().setFromUnitVectors(P.down[sd].dir, V); };
  return function pose(st, t) {
    const a = Math.min(1.6, st.speed / 1.35), ph = st.phase, s = Math.sin(ph), c = Math.cos(ph), run = st.speed > 2.4;
    let hipY = P.hipsY, hipYaw = 0, hipRoll = 0, chestX = 0.015 * Math.sin(t * 1.65), chestY = 0, headX = 0, headY = st.look || 0;
    let lt = 0, rt = 0, ls = 0.05, rs = 0.05, lf = 0, rf = 0, la = 0, ra = 0, lfo = -0.12, rfo = -0.12, lq = P.down.l.q, rq = P.down.r.q, lfz = 0, rfz = 0;
    if (st.speed > 0.05) {   // walking / running
      const A = run ? 0.72 : 0.45 * Math.min(1, a);
      lt = -A * s; rt = A * s; ls = 0.06 + (run ? 1.5 : 0.95 * Math.min(1, a)) * Math.max(0, c) ** 2; rs = 0.06 + (run ? 1.5 : 0.95 * Math.min(1, a)) * Math.max(0, -c) ** 2;
      lf = -(lt + ls) * 0.85; rf = -(rt + rs) * 0.85;
      la = (run ? 0.62 : 0.34) * Math.min(1.2, a) * s; ra = -la; lfo = run ? -1.25 : -(0.16 + 0.22 * Math.max(0, s) * a); rfo = run ? -1.25 : -(0.16 + 0.22 * Math.max(0, -s) * a);
      hipY = P.hipsY - (run ? 0.022 : 0.011 * a) * (1 + Math.cos(2 * ph)) * 0.5; hipYaw = 0.07 * a * s; hipRoll = 0.04 * a * s; chestY = -0.09 * a * s; chestX = run ? 0.17 : 0.03 * a; headY += 0.06 * a * s;
    } else if (st.act === "wave" && st.doing) {
      rq = up("r", -0.48, 0.84, 0.25); rfo = -0.35; rfz = 0.42 * Math.sin(t * 13); headY += 0.12;
    } else if (st.act === "talk" && st.doing) {
      la = -0.22; ra = -0.22; lfo = -1.0 - 0.18 * Math.sin(t * 3.1); rfo = -0.9 - 0.2 * Math.sin(t * 2.6 + 1); headX = 0.05 * Math.sin(t * 4.2); headY += 0.12 * Math.sin(t * 0.7);
    } else if (st.act === "sit" && st.doing) {
      hipY = (st.seatH || 0.26) + 0.035; lt = rt = -1.45; ls = rs = 1.45; lf = rf = 0; lfo = rfo = -0.65; la = ra = -0.15; chestX = -0.04;
    } else if (st.act === "dance" && st.doing) {
      const b = Math.sin(t * 6.9); hipRoll = 0.13 * Math.sin(t * 3.45); hipY = P.hipsY - 0.016 * (1 + b); ls = rs = 0.22 + 0.2 * (1 + b) * 0.5; lt = rt = -0.12 - 0.1 * (1 + b) * 0.5; lf = rf = -(lt + ls) * 0.8;
      lq = up("l", 0.55, 0.55 + 0.3 * Math.sin(t * 3.45), 0.3); rq = up("r", -0.55, 0.55 - 0.3 * Math.sin(t * 3.45), 0.3); lfo = rfo = -0.6; headY += 0.22 * Math.sin(t * 1.7);
    } else if (st.act === "point" && st.doing) {
      rq = up("r", -0.15, 0.1, 1); rfo = -0.05;
    } else { hipRoll = 0.018 * Math.sin(t * 0.55); }   // standing: breathing, the weight shifting slowly
    B.hips.position.y = hipY; set(B.hips, 0, hipYaw, hipRoll); set(B.spine, chestX * 0.4, chestY * 0.4, -hipRoll * 0.6); set(B.chest, chestX * 0.6, chestY * 0.6, 0);
    const hy = Math.max(-1.1, Math.min(1.1, headY)); set(B.neck, headX * 0.4, hy * 0.45, 0); set(B.head, headX * 0.6, hy * 0.55, 0);
    set(B.l_thigh, lt, 0, 0); set(B.r_thigh, rt, 0, 0); set(B.l_shin, ls, 0, 0); set(B.r_shin, rs, 0, 0); set(B.l_foot, lf, 0, 0); set(B.r_foot, rf, 0, 0);
    set(B.l_arm, la, 0, 0, lq); set(B.r_arm, ra, 0, 0, rq); set(B.l_fore, lfo, 0, lfz); set(B.r_fore, rfo, 0, rfz); set(B.l_hand, 0, 0, 0); set(B.r_hand, 0, 0, 0);
  };
}

// ---- the people of a world: where they stand, what they do, and the walk to get there ----
export function createPeople(T, { root, terrain, plan, tier, rnd = Math.random, blocked = () => false, avoid = [], findTarget = () => null, seats = [] }) {
  const group = new T.Group(); group.name = "nooi_people"; root.add(group);
  const list = [], cap = tier.name === "low" ? 5 : tier.name === "mid" ? 10 : 18, S = plan.size, lim = S / 2 - 3, [ox, oz] = terrain.center || [0, 0];
  let SkeletonUtils = null;
  const land = (x, z) => Math.abs(x - ox) < lim && Math.abs(z - oz) < lim && !terrain.isWater(x, z) && terrain.slopeAt(x, z) < 0.6 && !blocked(x, z) && !avoid.some((o) => Math.abs(x - o.x) < o.hx && Math.abs(z - o.z) < o.hz);
  const spot = (cx, cz, r, tries = 40) => { for (let i = 0; i < tries; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (land(x, z)) return [x, z]; } return null; };
  async function add(entry, url, k = 0) {
    if (list.length >= cap) return null;
    if (!SkeletonUtils) SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
    const proto = await loadHuman(T, url), obj = SkeletonUtils.clone(proto.holder), bones = {};
    obj.traverse((n) => { if (n.isBone && /^nooi_/.test(n.name)) bones[n.name.slice(5)] = n; if (n.isMesh) { n.castShadow = tier.shadows > 0; n.receiveShadow = false; } });
    const h = Math.max(1.0, Math.min(2.05, (entry.height || (entry.age && entry.age < 13 ? 1.3 : entry.gender === "female" ? 1.66 : 1.77)))); obj.scale.setScalar(h);
    // where they start: by what they go to, or in front of you
    const tgt = entry.target ? findTarget(entry.target) : null, sp = plan.spawn;
    const fx = sp.look[0] - sp.at[0], fz = sp.look[1] - sp.at[1], fl = Math.hypot(fx, fz) || 1, front = [sp.at[0] + (fx / fl) * 9, sp.at[1] + (fz / fl) * 9];
    let at = entry.at || (tgt ? spot(tgt.x, tgt.z, entry.act && entry.act !== "walk" ? 3 : 10) : null) || spot(front[0], front[1], 6 + list.length * 1.5) || spot(sp.at[0], sp.at[1], 18);
    if (!at) return null;
    if (tgt && (entry.act === "walk" || entry.go)) { const a0 = rnd() * 6.283, far = spot(tgt.x + Math.cos(a0) * 12, tgt.z + Math.sin(a0) * 12, 4); if (far) at = far; }   // they walk to it, so they start a little away
    const p = { entry, obj, bones, proto, h, x: at[0], z: at[1], yaw: Math.atan2(sp.at[0] - at[0], sp.at[1] - at[1]), st: { speed: 0, phase: rnd() * 6, act: entry.act || "stand", doing: false, look: 0 }, tx: null, tz: null, wait: 0.5 + rnd() * 2, tgt, home: at.slice(), born: 0 };
    p.pose = poser(T, p); obj.position.set(p.x, terrain.heightAt(p.x, p.z), p.z); obj.rotation.y = p.yaw; obj.scale.setScalar(0.001); group.add(obj); list.push(p);
    if (p.st.act === "sit") { const seat = seats.find((s) => !s.used && Math.hypot(s.x - p.x, s.z - p.z) < 30) || null; if (seat) { seat.used = 1; p.seat = seat; } }
    if (p.st.act === "talk" && !tgt) { const o = list.find((q) => q !== p && q.st.act === "talk" && !q.partner); if (o) { p.partner = o; o.partner = p; p.tgt = { x: o.x, z: o.z, r: 0.45 }; } }
    if (["walk", "run", "wander", "go"].includes(p.st.act) || p.tgt || p.seat) plan87(p);
    return p;
  }
  function plan87(p) {   // the next place to walk to
    if (p.seat) { p.tx = p.seat.x; p.tz = p.seat.z; return; }
    if (p.tgt && !p.arrived) { const a = Math.atan2(p.x - p.tgt.x, p.z - p.tgt.z), r = (p.tgt.r || 1) + 0.9; p.tx = p.tgt.x + Math.sin(a) * r; p.tz = p.tgt.z + Math.cos(a) * r; return; }
    // somewhere a real distance away (a runner runs, a walker walks — never a step on the spot): the first spot far enough, else the farthest
    const run = p.st.act === "run", far = run ? 8 : 3; let best = null, bd = -1;
    for (let i = 0; i < 12; i++) { const s = spot(p.home[0], p.home[1], run ? 26 : 14, 4); if (!s) continue; const d = Math.hypot(s[0] - p.x, s[1] - p.z); if (d >= far) { best = s; break; } if (d > bd) { bd = d; best = s; } }
    if (best) { p.tx = best[0]; p.tz = best[1]; }
  }
  function update(dt, t, player) {
    const px = player ? player.x : 1e9, pz = player ? player.z : 1e9;
    for (const p of list) {
      const st = p.st, dP = Math.hypot(px - p.x, pz - p.z);
      if (p.born < 1) { p.born = Math.min(1, p.born + dt * 1.6); p.obj.scale.setScalar(p.h * (1 - (1 - p.born) ** 3)); }   // they appear, they don't pop
      const wantSpeed = st.act === "run" ? 3.4 : 1.35;
      if (p.tx != null) {
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.35) { p.tx = null; st.speed = 0; if (p.tgt) { p.arrived = 1; p.yaw = Math.atan2(p.tgt.x - p.x, p.tgt.z - p.z); if (p.partner) p.partner.yaw = Math.atan2(p.x - p.partner.x, p.z - p.partner.z); } if (p.seat) { p.x = p.seat.x; p.z = p.seat.z; p.yaw = p.seat.yaw; st.seatH = p.seat.h / p.h; }
          st.doing = true; p.wait = st.act === "run" ? 0.15 + rnd() * 0.5 : ["walk", "wander"].includes(st.act) ? 1 + rnd() * 2.5 : 1e9; }
        else { const want = Math.atan2(dx, dz); p.yaw += ang(p.yaw, want) * Math.min(1, dt * 4); st.speed += (Math.min(wantSpeed, d * 1.2 + 0.3) - st.speed) * Math.min(1, dt * 3); st.doing = false; }
      } else { st.speed = Math.max(0, st.speed - dt * 4); if (!p.wait || (p.wait -= dt) <= 0) { if (["walk", "run", "wander"].includes(st.act)) plan87(p); else st.doing = true; p.wait = 0; } if (!["walk", "run", "wander"].includes(st.act)) st.doing = true; }
      // a few steps, around what is in the way and around each other
      if (st.speed > 0.01) {
        let nx = p.x + Math.sin(p.yaw) * st.speed * dt, nz = p.z + Math.cos(p.yaw) * st.speed * dt;
        for (const o of list) { if (o === p) continue; const ddx = nx - o.x, ddz = nz - o.z, dd = Math.hypot(ddx, ddz); if (dd < 0.7 && dd > 1e-3) { nx += (ddx / dd) * (0.7 - dd) * 0.5; nz += (ddz / dd) * (0.7 - dd) * 0.5; } }
        if (land(nx, nz) || p.seat) { p.x = nx; p.z = nz; } else { p.yaw += Math.PI * (0.4 + rnd() * 0.4); if (!p.tgt && !p.seat) plan87(p); }
        st.phase += (st.speed * dt * 2 * Math.PI) / ((st.act === "run" ? 1.05 : 0.82) * p.h);
      }
      // they notice you: the head turns to you when you come close (and they turn round if you're behind them)
      const near = player && dP < 3.2 && st.speed < 0.3 && st.act !== "sit" && st.act !== "dance";
      const toYou = Math.atan2(px - p.x, pz - p.z), rel = ang(p.yaw, toYou); st.look += ((near ? Math.max(-1, Math.min(1, rel)) : 0) - st.look) * Math.min(1, dt * 3);
      if (near && Math.abs(rel) > 1.1) p.yaw += rel * Math.min(1, dt * 1.5);
      if (st.act === "wave" && near) st.doing = true;
      p.obj.position.set(p.x, terrain.heightAt(p.x, p.z) + (p.seat ? 0 : 0), p.z); p.obj.rotation.y = p.yaw;
      p.pose(st, t + p.home[0]);
    }
  }
  return { group, add, update, get count() { return list.length; }, list,
    dispose() { for (const p of list) p.obj.traverse((n) => { if (n.isMesh) { [].concat(n.material).forEach((m) => m.dispose && m.dispose()); } }); root.remove(group); list.length = 0; } };
}
