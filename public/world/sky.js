// Sky, sun, moon, stars, clouds, fog and weather (rain, snow, sandstorm, fog, storm with lightning) for any hour of the day.
// Cheap on purpose: a vertex-coloured dome that follows the camera, sprites for the sun, moon and clouds, points for stars and
// snow, line streaks for rain — all particles live in a box around the camera, so their number never grows with the world.
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const KEYS = [ // hour → zenith, horizon, sun colour, sun strength, sky-light strength
  [0, "#05070f", "#0d1424", "#9fb4ff", 0.16, 0.22], [4.6, "#070b18", "#18213a", "#9fb4ff", 0.16, 0.24], [5.6, "#1c2a52", "#c47a62", "#ff9a5a", 0.45, 0.35], [6.6, "#4a73b8", "#f2b27a", "#ffc68a", 1.2, 0.55],
  [8.5, "#3f78c8", "#bcd6ee", "#fff1d8", 2.3, 0.75], [12, "#2f6fc4", "#cfe3f4", "#fffaf0", 2.8, 0.85], [15.5, "#3a74c2", "#d2e2ef", "#fff0d6", 2.5, 0.8], [17.4, "#4f6fb0", "#f5c98f", "#ffc070", 1.8, 0.62],
  [18.4, "#3a4f8f", "#ff9d5c", "#ff8a45", 1.1, 0.48], [19.3, "#232f5e", "#d26c58", "#ff7a50", 0.35, 0.32], [20.3, "#0b1124", "#27304d", "#9fb4ff", 0.18, 0.24], [24, "#05070f", "#0d1424", "#9fb4ff", 0.16, 0.22]
];
export function skyAt(T, h, wx = "clear") {
  h = ((h % 24) + 24) % 24; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = (h - a[0]) / (b[0] - a[0] || 1), C = (x, y) => new T.Color(x).lerp(new T.Color(y), t);
  const o = { top: C(a[1], b[1]), horizon: C(a[2], b[2]), sun: C(a[3], b[3]), sunI: a[4] + (b[4] - a[4]) * t, hemiI: a[5] + (b[5] - a[5]) * t };
  o.night = 1 - smooth(5.2, 6.6, h) + smooth(19.4, 20.6, h); o.night = Math.max(0, Math.min(1, o.night));
  const grey = { cloudy: 0.45, rain: 0.65, storm: 0.85, snow: 0.55, fog: 0.6, sandstorm: 0.5 }[wx] || 0;
  if (grey) { const g = new T.Color().setRGB(0.55, 0.58, 0.62).multiplyScalar(0.3 + 0.7 * (1 - o.night)); if (wx === "sandstorm") g.set("#b8915c").multiplyScalar(0.4 + 0.6 * (1 - o.night)); o.top.lerp(g, grey); o.horizon.lerp(g, grey * 0.9); o.sunI *= 1 - grey * 0.7; o.hemiI *= 1 - grey * 0.25; }
  // the sun rises ≈ 5:40 and sets ≈ 18:40, so "sunset" (18:24) still has a low golden sun
  const up = Math.sin(((h - 5.65) / 13) * Math.PI), phi = ((h - 5.65) / 13) * Math.PI;
  o.sunDir = new T.Vector3(Math.cos(phi), Math.max(-0.3, up) * 1.1, -0.55).normalize();
  o.moonDir = new T.Vector3(-0.5, 0.65, -0.45).normalize();
  return o;
}
function radial(T, size, stops) { const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); for (const [o, col] of stops) g.addColorStop(o, col); x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
function cloudTex(T, rnd) { const s = 128, c = document.createElement("canvas"); c.width = s * 2; c.height = s; const x = c.getContext("2d");
  for (let i = 0; i < 14; i++) { const cx = s * 0.35 + rnd() * s * 1.3, cy = s * 0.45 + rnd() * s * 0.25, r = s * (0.18 + rnd() * 0.22), g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, s * 2, s); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }

export function buildSky(T, plan, tier, rnd, scene) {
  const far = tier.far, R = far * 0.92, group = new T.Group(); group.name = "nooi_sky";
  const space = plan.place === "space", under = plan.water.kind === "deep", indoor = plan.place === "room";
  const domeG = new T.SphereGeometry(R, 32, 18), dome = new T.Mesh(domeG, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, depthWrite: false, fog: false }));
  domeG.setAttribute("color", new T.BufferAttribute(new Float32Array(domeG.attributes.position.count * 3), 3)); dome.renderOrder = -10; dome.frustumCulled = false; group.add(dome);
  const sunS = new T.Sprite(new T.SpriteMaterial({ map: radial(T, 128, [[0, "rgba(255,255,240,1)"], [0.22, "rgba(255,240,200,.95)"], [0.4, "rgba(255,200,120,.35)"], [1, "rgba(255,180,100,0)"]]), blending: T.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  const moonS = new T.Sprite(new T.SpriteMaterial({ map: radial(T, 64, [[0, "rgba(250,250,255,1)"], [0.42, "rgba(232,236,245,1)"], [0.5, "rgba(200,210,235,.25)"], [1, "rgba(180,190,220,0)"]]), depthWrite: false, fog: false, transparent: true }));
  sunS.renderOrder = moonS.renderOrder = -9; group.add(sunS, moonS);
  let earth = null; if (space) { earth = new T.Sprite(new T.SpriteMaterial({ map: radial(T, 128, [[0, "#9fd0ff"], [0.5, "#3f7fd8"], [0.62, "#2b5fae"], [0.66, "rgba(140,190,255,.6)"], [1, "rgba(80,140,255,0)"]]), depthWrite: false, fog: false })); earth.renderOrder = -9; group.add(earth); }
  // stars
  const sn = space ? tier.stars * 1.6 : tier.stars, sp = new Float32Array(sn * 3);
  for (let i = 0; i < sn; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, y = Math.abs(u) * 0.95 + 0.04, r = Math.sqrt(1 - y * y); sp[i * 3] = Math.cos(a) * r * R * 0.95; sp[i * 3 + 1] = y * R * 0.95; sp[i * 3 + 2] = Math.sin(a) * r * R * 0.95; }
  const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.BufferAttribute(sp, 3));
  const stars = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: tier.name === "low" ? 1.6 : 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })); stars.renderOrder = -9; stars.frustumCulled = false; group.add(stars);
  // clouds
  const clouds = [], ct = cloudTex(T, rnd), amount = space || indoor || under ? 0 : Math.max(plan.sky.clouds, { cloudy: 0.85, rain: 1, storm: 1, snow: 0.9, fog: 0.5 }[plan.weather.kind] || 0);
  const nc = Math.round(tier.clouds * (0.3 + amount));
  for (let i = 0; i < nc && amount > 0.05; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.55 + amount * 0.4, fog: false }));
    const a = rnd() * Math.PI * 2, d = R * (0.25 + rnd() * 0.5); s.position.set(Math.cos(a) * d, 70 + rnd() * 70, Math.sin(a) * d); const w = 60 + rnd() * 70; s.scale.set(w, w * (0.36 + rnd() * 0.14), 1); s.renderOrder = -8; clouds.push(s); group.add(s); }
  // lights
  const sun = new T.DirectionalLight(0xffffff, 2), hemi = new T.HemisphereLight(0xbfd8ff, 0x5a4a38, 0.7), target = new T.Object3D();
  sun.target = target; group.add(target);
  if (tier.shadows) { sun.castShadow = true; sun.shadow.mapSize.set(tier.shadows, tier.shadows); const e = tier.name === "high" ? 46 : 32; Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 260 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6; }
  scene.add(sun, hemi);
  const fog = new T.Fog(0xcfe3f4, 30, far); scene.fog = fog;
  const state = { time: plan.time, wx: plan.weather.kind, night: 0, flash: 0, nextFlash: 4 + rnd() * 6, pano: null, base: null };
  function paint() {
    const o = skyAt(T, state.time, state.wx); state.base = o; state.night = o.night;
    let top = o.top, hor = o.horizon;
    if (space) { top = new T.Color("#010205"); hor = new T.Color("#04060c"); }
    if (under) { top = new T.Color("#2b7fa6").multiplyScalar(1 - o.night * 0.8); hor = new T.Color("#0f4d6e").multiplyScalar(1 - o.night * 0.8); }
    if (plan.sky.top) top = new T.Color(plan.sky.top); if (plan.sky.horizon) hor = new T.Color(plan.sky.horizon);
    const p = domeG.attributes.position, c = domeG.attributes.color, col = new T.Color(), sd = o.sunDir, tmp = new T.Vector3(), groundC = hor.clone().multiplyScalar(0.55);
    for (let i = 0; i < p.count; i++) { tmp.set(p.getX(i), p.getY(i), p.getZ(i)).normalize(); const y = tmp.y;
      if (y < 0) col.copy(hor).lerp(groundC, smooth(0, -0.25, y)); else col.copy(hor).lerp(top, Math.pow(smooth(0, 0.62, y), 0.75));
      if (!space && !under) { const g = Math.max(0, tmp.dot(sd)); col.lerp(o.sun, Math.pow(g, 9) * 0.55 * (1 - o.night) + Math.pow(g, 2.2) * 0.12 * smooth(-0.1, 0.25, sd.y) * (1 - smooth(0.4, 0.7, sd.y))); }
      c.setXYZ(i, col.r, col.g, col.b); }
    c.needsUpdate = true;
    sun.color.copy(o.night > 0.6 ? new T.Color("#9fb4ff") : o.sun); sun.intensity = space ? 3.2 : under ? o.sunI * 0.45 : Math.max(o.sunI, o.night > 0.6 ? 0.22 : 0);
    hemi.color.copy(top).lerp(new T.Color(0xffffff), 0.35); hemi.groundColor.set(plan.terrain.ground === "sand" ? "#a8895c" : plan.terrain.ground === "snow" ? "#b9c4cc" : "#4f4a3c"); hemi.intensity = space ? 0.25 : Math.max(0.55, o.hemiI * 1.15 * (indoor ? 1.25 : 1)) * (1 + 0.35 * smooth(0.1, 0.9, 1 - o.night) * (1 - Math.min(1, o.sunI / 2.5)));
    if (space) { sun.color.set("#ffffff"); hemi.color.set("#3a4458"); }
    const fogC = under ? hor.clone() : hor.clone().lerp(top, 0.15), wx = state.wx;
    fog.color.copy(fogC); fog.far = space ? far * 3 : under ? 55 : wx === "fog" ? 70 : wx === "sandstorm" ? 48 : wx === "storm" || wx === "rain" ? 170 : wx === "snow" ? 150 : far * 0.96;
    fog.near = space ? far * 2 : under ? 2 : wx === "fog" ? 4 : wx === "sandstorm" ? 3 : (plan.place === "forest" || plan.place === "rainforest") ? 18 : 40;
    if (wx === "sandstorm") fog.color.set("#b58f5e").multiplyScalar(1 - o.night * 0.7);
    stars.material.opacity = space ? 1 : under ? 0 : o.night * (wx === "clear" || wx === "cloudy" ? 1 : 0.25) * plan.sky.stars;
    for (const s of clouds) { s.material.color.copy(new T.Color("#ffffff").lerp(o.sun, 0.35 * (1 - o.night)).multiplyScalar(0.25 + 0.75 * (1 - o.night) * (wx === "storm" ? 0.55 : wx === "rain" ? 0.75 : 1))); }
    sunS.visible = !under && sd.y > -0.08 && o.night < 0.85 && wx !== "storm" && wx !== "fog"; moonS.visible = !under && !space && o.night > 0.3;
    if (state.pano) { dome.material.map = state.pano; dome.material.vertexColors = false; dome.material.color.set(0xffffff).multiplyScalar(0.55 + 0.45 * (1 - o.night)); dome.material.needsUpdate = true; for (const s of clouds) s.visible = false; sunS.visible = false; }
    return o;
  }
  paint();
  const api = {
    group, sun, hemi, fog, dome,
    get night() { return state.night; }, get time() { return state.time; }, get colors() { return state.base; },
    setTime(h) { state.time = h; paint(); }, setWeather(k) { state.wx = k; paint(); },
    // an AI panorama (360° picture) becomes the whole sky and the far land
    setPanorama(tex) { tex.colorSpace = T.SRGBColorSpace; tex.wrapS = T.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1; state.pano = tex; paint(); },
    update(dt, cam, wind) {
      group.position.copy(cam.position); const o = state.base, sd = o.sunDir;
      sunS.position.copy(sd).multiplyScalar(R * 0.85); const ss = R * (space ? 0.06 : 0.11); sunS.scale.set(ss, ss, 1);
      moonS.position.copy(o.moonDir).multiplyScalar(R * 0.85); moonS.scale.set(R * 0.045, R * 0.045, 1);
      if (earth) { earth.position.set(-R * 0.35, R * 0.38, -R * 0.62); earth.scale.set(R * 0.16, R * 0.16, 1); }
      for (const s of clouds) { s.position.x += wind.x * dt * 0.6; s.position.z += wind.z * dt * 0.6; if (Math.hypot(s.position.x, s.position.z) > R * 0.8) { s.position.x *= -0.95; s.position.z *= -0.95; } }
      // the sun light follows the walker so the shadows stay sharp around them
      const L = (sd.y > 0.02 || space ? sd : o.moonDir).clone(); L.y = Math.max(0.12, L.y); L.normalize(); sun.position.copy(cam.position).addScaledVector(L, 120); target.position.copy(cam.position); target.updateMatrixWorld();
      sun.position.x = Math.round(sun.position.x * 2) / 2; sun.position.z = Math.round(sun.position.z * 2) / 2;
      if (state.wx === "storm") { state.nextFlash -= dt; if (state.nextFlash < 0) { state.flash = 1; state.nextFlash = 3 + Math.random() * 7; } if (state.flash > 0) { state.flash = Math.max(0, state.flash - dt * 3.2); hemi.intensity = o.hemiI + state.flash * 2.2 * (Math.random() > 0.3 ? 1 : 0.3); } }
    },
    dispose() { scene.remove(sun, hemi); scene.fog = null; }
  };
  return api;
}

// weather particles around the camera: rain streaks, snow flakes, sand, bubbles under water, fire flies at night
export function buildWeather(T, plan, tier, rnd) {
  const kind = plan.water.kind === "deep" ? "bubbles" : plan.weather.kind, group = new T.Group(); group.name = "nooi_weather";
  const box = { x: 46, y: 26, z: 46 }, amount = plan.weather.amount ?? 0.6;
  let n = 0, mesh = null, pos = null, vel = null;
  if (kind === "rain" || kind === "storm") {
    n = Math.round(tier.particles * (0.5 + amount) * (kind === "storm" ? 1.3 : 1)); pos = new Float32Array(n * 6); vel = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (rnd() - 0.5) * box.x, y = rnd() * box.y, z = (rnd() - 0.5) * box.z; pos.set([x, y, z, x, y - 0.55, z], i * 6); vel[i] = 16 + rnd() * 6; }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); mesh = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.42, depthWrite: false }));
  } else if (kind === "snow" || kind === "sandstorm" || kind === "bubbles") {
    n = Math.round(tier.particles * (kind === "sandstorm" ? 1.4 : 0.9) * (0.5 + amount)); pos = new Float32Array(n * 3); vel = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([(rnd() - 0.5) * box.x, rnd() * box.y, (rnd() - 0.5) * box.z], i * 3); vel[i] = rnd(); }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3));
    const col = kind === "snow" ? 0xffffff : kind === "bubbles" ? 0xd8f4ff : 0xc9a46a;
    mesh = new T.Points(g, new T.PointsMaterial({ color: col, size: kind === "snow" ? 0.12 : kind === "bubbles" ? 0.09 : 0.06, transparent: true, opacity: kind === "sandstorm" ? 0.55 : 0.9, depthWrite: false, sizeAttenuation: true }));
  }
  if (mesh) { mesh.frustumCulled = false; group.add(mesh); }
  let ox = 0, oz = 0;
  return {
    group, kind,
    update(dt, cam, wind, groundY) {
      if (!mesh) return; group.position.set(cam.position.x, 0, cam.position.z);
      // keep the particles where they are in the world while the camera walks (wrap them around the box)
      const dx = cam.position.x - ox, dz = cam.position.z - oz; ox = cam.position.x; oz = cam.position.z; const base = cam.position.y - box.y * 0.4;
      if (kind === "rain" || kind === "storm") { for (let i = 0; i < n; i++) { const k = i * 6; let x = pos[k] - dx + wind.x * dt * 0.6, y = pos[k + 1] - vel[i] * dt, z = pos[k + 2] - dz + wind.z * dt * 0.6;
          if (y < base - box.y * 0.1 || y < groundY - 0.5) { y = base + box.y * (0.75 + Math.random() * 0.3); }
          x = ((x + box.x / 2) % box.x + box.x) % box.x - box.x / 2; z = ((z + box.z / 2) % box.z + box.z) % box.z - box.z / 2;
          pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; pos[k + 3] = x - wind.x * 0.035; pos[k + 4] = y - 0.55; pos[k + 5] = z - wind.z * 0.035; } }
      else { const fall = kind === "snow" ? 1.1 : kind === "bubbles" ? -0.9 : 0.25, side = kind === "sandstorm" ? 1.6 : 0.5;
        for (let i = 0; i < n; i++) { const k = i * 3; let x = pos[k] - dx + (wind.x * side + Math.sin(i + performance.now() / 900) * 0.4) * dt, y = pos[k + 1] - fall * (0.6 + vel[i]) * dt, z = pos[k + 2] - dz + (wind.z * side + Math.cos(i * 1.7 + performance.now() / 1100) * 0.4) * dt;
          if (y < base - box.y * 0.1) y += box.y; if (y > base + box.y) y -= box.y;
          x = ((x + box.x / 2) % box.x + box.x) % box.x - box.x / 2; z = ((z + box.z / 2) % box.z + box.z) % box.z - box.z / 2; pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; } }
      mesh.geometry.attributes.position.needsUpdate = true;
    }
  };
}
