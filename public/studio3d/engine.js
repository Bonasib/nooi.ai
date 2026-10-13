// nooi.ai · 3D Studio — the live 3D engine (three.js on WebGL2; heavy maths on WebGPU compute in localInference.js).
//   • renderer sized for the device (pixel ratio, shadows, instance counts by tier), ACES tone mapping, sRGB
//   • sky dome → PMREM image-based lighting that follows the time of day (dawn · day · sunset · night) and the world's fog
//   • a world (world.js) + effects (fx.js) + your assets, each at real-world size, standing on the ground
//   • orbit (inspect, move / rotate / scale with a gizmo) or WALK: eye height 1.65 m, WASD / arrows / joystick / drag to look,
//     you can't walk through objects or out of the plot · a guided tour path for walk-through videos
//   • record a video of the canvas (+ the ambience sound) · export the scene as .glb (Blender, Unity) or .usdz (iPhone AR)
//   • "drip" loading: a model's textures go to the GPU a few at a time (each part appears when its textures are ready, no
//     frozen frames), phones/older GPUs get right-sized textures, and the resolution follows the real frame rate
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { USDZExporter } from "three/addons/exporters/USDZExporter.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { createEnvUniforms, applyEnvironmentShaders, createSkyDome } from "./shaders.js";
import { buildWorld, BIOMES } from "./world.js";
import { createFX, createAmbience } from "./fx.js";
import { disposeObject } from "./localInference.js";
export { THREE };

export const TOD = {
  dawn: { el: 7, az: -70, sun: "#ffb98a", I: 0.9, night: 0.25, exp: 0.95, zen: "#5f7aa6", hor: "#f2b48e" },
  day: { el: null, az: 35, sun: null, I: null, night: 0, exp: 1.0 },
  sunset: { el: 5, az: 115, sun: "#ff9650", I: 1.0, night: 0.3, exp: 0.95, zen: "#4b5f8e", hor: "#f0905a" },
  night: { el: 28, az: 220, sun: "#9fb6ff", I: 0.22, night: 1, exp: 0.85, zen: "#08101e", hor: "#1b2840", moon: true },
};
// how tall things are in real life (m) — a photo has no scale, so the label decides it (editable in the app)
export const REAL_HEIGHT = { vehicle: 1.75, suv: 1.9, person: 1.72, animal: 0.9, chair: 0.9, table: 0.76, sofa: 0.85, plant: 1.2, tree: 6, building: 9, statue: 2.2, product: 0.35, object: 0.6 };

export function createEngine(canvas, { tier = "high", mobile = false } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: tier !== "low", preserveDrawingBuffer: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(tier === "low" ? 1.25 : mobile ? 1.6 : 2, window.devicePixelRatio || 1)); r.outputEncoding = THREE.sRGBEncoding;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1; r.shadowMap.enabled = true; r.shadowMap.type = tier === "low" ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(55, 1, 0.05, 400); cam.rotation.order = "YXZ"; cam.position.set(4, 2.6, 6);
  const U = createEnvUniforms(THREE), pmrem = new THREE.PMREMGenerator(r), prCap = r.getPixelRatio(), maxTex = tier === "low" ? 2048 : 8192;
  const orbit = new OrbitControls(cam, canvas); orbit.enableDamping = true; orbit.target.set(0, 0.9, 0); orbit.maxPolarAngle = Math.PI * 0.49; orbit.minDistance = 0.5; orbit.maxDistance = 60;
  const gizmo = new TransformControls(cam, canvas); gizmo.addEventListener("dragging-changed", (e) => { orbit.enabled = !e.value && E.mode === "orbit"; if (!e.value) E.emit("moved", gizmo.object); }); scene.add(gizmo);
  // sky + lights
  const sky = createSkyDome(THREE); sky.renderOrder = -1; sky.scale.setScalar(6); scene.add(sky); const skyScene = new THREE.Scene(), skyEnv = createSkyDome(THREE); skyScene.add(skyEnv);
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true; const sm = tier === "low" ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 0.6); scene.add(hemi);
  let envRT = null, hdrTex = null, panoTex = null, world = null, fx = null; const amb = createAmbience();
  const E = {
    THREE, renderer: r, scene, camera: cam, controls: orbit, gizmo, uniforms: U, tier, mode: "orbit", assets: [], listeners: {}, state: { biome: "rainforest", size: [5, 5], seed: 7, tod: "day", fx: {} },
    quality: { auto: true, pr: prCap, cap: prCap, min: Math.max(0.6, +(prCap * 0.55).toFixed(2)), fps: 60, drip: 0 },
    on(k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); }, emit(k, v) { (this.listeners[k] || []).forEach((f) => f(v)); },
  };
  function bakeEnv() { if (hdrTex || panoTex) return; if (envRT) envRT.dispose(); envRT = pmrem.fromScene(skyScene, 0.03); scene.environment = envRT.texture; }
  // ── time of day + biome palette → sky colours, sun, fog, exposure
  function applyLook() {
    const B = (world && world.palette) || BIOMES.rainforest, T = TOD[E.state.tod] || TOD.day, el = T.el ?? B.sun[0], az = T.az, d = new THREE.Vector3(Math.cos(el * Math.PI / 180) * Math.sin(az * Math.PI / 180), Math.sin(el * Math.PI / 180), Math.cos(el * Math.PI / 180) * Math.cos(az * Math.PI / 180)).normalize();
    const zen = new THREE.Color(T.zen || B.sky[0]), hor = new THREE.Color(T.hor || B.sky[1]), fogC = new THREE.Color(B.fog[0]).lerp(hor, T.night ? 0.85 : T.hor ? 0.55 : 0);
    if (B.fog[1] >= 0.02 && !T.night) hor.lerp(fogC, 0.7); // a foggy place: the horizon is the fog's colour, so distance fades into the sky seamlessly
    if (T.night) fogC.multiplyScalar(0.35);
    for (const s of [sky, skyEnv]) { const u = s.material.uniforms; u.uSun.value.copy(T.moon ? d.clone().multiplyScalar(-1).setY(Math.abs(d.y) * 0.4 + 0.2).normalize() : d); u.uZenith.value.copy(zen); u.uHorizon.value.copy(hor); u.uGround.value.copy(fogC).multiplyScalar(0.5); u.uSunI.value = T.moon ? 2 : 18; }
    const sd = E.state.biome === "studio" ? new THREE.Vector3(0.35, 1, 0.45).normalize() : d; sun.position.copy(sd).multiplyScalar(30); sun.color.set(T.sun || B.sun[2]); sun.intensity = (T.I ?? B.sun[1]) * (E.state.biome === "rainforest" && !T.night ? 0.85 : 1);
    hemi.color.set(B.hemi[0]); hemi.groundColor.set(B.hemi[1]); hemi.intensity = B.hemi[2] * (T.night ? 0.25 : 1);
    scene.fog = B.fog[1] > 0 ? new THREE.FogExp2(fogC, B.fog[1] * (1 + 0.8 * (E.state.fx.mist || 0))) : null; r.toneMappingExposure = (T.exp || 1) * (E.state.exposure || 1);
    U.uWet.value = Math.min(1, Math.max(B.wet || 0, (E.state.fx.rain || 0) * 1.1)); if (fx) { fx.set({ night: T.night }); fx.setMistColor(fogC.clone().lerp(new THREE.Color(1, 1, 1), 0.35)); fx.setSun(sd); }
    amb.set({ night: T.night, kind: B.sound || "" }); clearTimeout(E._envT); E._envT = setTimeout(bakeEnv, 60); E.emit("look", { el, az, tod: E.state.tod });
  }
  function fitShadow() { const p = world ? world.plot : { hw: 3, hd: 3 }, s = Math.max(p.hw, p.hd) + 6; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 80 }); sun.shadow.camera.updateProjectionMatrix(); sun.target.position.set(0, 0, 0); }
  // ── the world
  E.setWorld = function ({ biome, size, seed } = {}) {
    if (biome) E.state.biome = biome; if (size) E.state.size = size.map((v) => Math.min(200, Math.max(2, +v || 5))); if (seed != null) E.state.seed = seed;
    if (world) { scene.remove(world.group); world.dispose(); } if (fx) { scene.remove(fx.group); fx.dispose(); }
    world = buildWorld({ biome: E.state.biome, size: E.state.size, seed: E.state.seed, tier, U }); scene.add(world.group);
    const envI = E.state.biome === "rainforest" ? 0.55 : E.state.biome === "studio" ? 1.2 : 0.85; world.group.traverse((n) => { if (n.material && "envMapIntensity" in n.material) n.material.envMapIntensity = envI; });
    fx = createFX({ U, radius: world.info.radius, plot: world.plot, tier, seed: E.state.seed }); scene.add(fx.group);
    const B = world.palette; E.state.fx = Object.assign({}, B.fx, { snow: B.snow || 0 }); fx.set(E.state.fx); U.uSnow.value = B.snow ? 0.85 : 0; U.uWind.value = B.fx.wind ?? 0.3; if (B.fx.snowfall) U.uSnow.value = Math.max(U.uSnow.value, B.fx.snowfall);
    fitShadow(); applyLook(); E.placeAll(); E.emit("world", world.info); return world.info;
  };
  E.world = () => world; E.fx = () => fx; E.ambience = amb;
  E.setTime = (tod) => { E.state.tod = TOD[tod] ? tod : "day"; if (E.state.tod === "night" && fx && !E.state.fx._fireUser) { E.state.fx.fireflies = Math.max(E.state.fx.fireflies || 0, 0.8); fx.set({ fireflies: E.state.fx.fireflies }); } applyLook(); };
  E.setFX = (o) => { Object.assign(E.state.fx, o); if ("fireflies" in o) E.state.fx._fireUser = true; if (fx) fx.set(o); if ("wind" in o) U.uWind.value = +o.wind; if ("snow" in o) U.uSnow.value = +o.snow; if ("rain" in o || "mist" in o) applyLook(); amb.set({ rain: E.state.fx.rain || 0, wind: U.uWind.value }); };
  E.setWindDir = (deg) => { const a = (deg * Math.PI) / 180; U.uWindDir.value.set(Math.cos(a), Math.sin(a)); };
  E.setExposure = (v) => { E.state.exposure = +v; applyLook(); };
  // a 360° panorama (AI world / Skybox / your .hdr) as the sky and the light
  E.setPanorama = async function (src, { hdr = false } = {}) {
    E.clearPanorama(); let t;
    if (hdr) { const data = new RGBELoader().setDataType(THREE.HalfFloatType).parse(src); t = new THREE.DataTexture(data.data, data.width, data.height, data.format ?? THREE.RGBAFormat, data.type); t.encoding = THREE.LinearEncoding; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; hdrTex = t; }
    else { t = await new THREE.TextureLoader().loadAsync(src); t.encoding = THREE.sRGBEncoding; panoTex = t; }
    t.mapping = THREE.EquirectangularReflectionMapping; if (envRT) envRT.dispose(); envRT = pmrem.fromEquirectangular(t); scene.environment = envRT.texture; scene.background = t; sky.visible = false; E.emit("sky", { panorama: true });
  };
  E.clearPanorama = function () { if (hdrTex) hdrTex.dispose(); if (panoTex) panoTex.dispose(); hdrTex = panoTex = null; scene.background = null; sky.visible = true; bakeEnv(); };
  E.hasPanorama = () => !!(hdrTex || panoTex);

  // ── assets: real size, standing on the ground, footprint for walking around them
  const dripQ = [];
  const TEX_KEYS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap", "displacementMap", "lightMap"];
  function fitTexture(t) {   // a texture bigger than this device carries → resized once, on the CPU, before it reaches the GPU
    const im = t && t.image; if (!im || !im.width || Math.max(im.width, im.height) <= maxTex || typeof document === "undefined") return;
    const k = maxTex / Math.max(im.width, im.height), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
    try { c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); t.image = c; t.needsUpdate = true; } catch (e) {}
  }
  E.dripTextures = function (object) {
    object.traverse((n) => { if (!n.isMesh) return; const ts = new Set(); (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => m && TEX_KEYS.forEach((k) => m[k] && m[k].isTexture && ts.add(m[k])));
      if (!ts.size || !n.visible) return; ts.forEach(fitTexture); n.visible = false; n.userData._drip = true; dripQ.push({ mesh: n, tex: [...ts] }); });
    E.quality.drip = dripQ.length; return dripQ.length;
  };
  const dripShow = (m) => { if (m.userData._drip) { m.visible = true; delete m.userData._drip; } };   // a part someone hid meanwhile (e.g. a loose piece) stays hidden
  E.dripFlush = function () { while (dripQ.length) { const d = dripQ.shift(); d.tex.forEach((t) => { try { r.initTexture(t); } catch (e) {} }); dripShow(d.mesh); } E.quality.drip = 0; };
  let inLoop = false; const render0 = r.render.bind(r);
  r.render = function (sc, c) { if (!inLoop && dripQ.length) E.dripFlush(); return render0(sc, c); };   // checks and captures always see the whole model
  function dripStep() { if (!dripQ.length) return; const t0 = performance.now();
    while (dripQ.length && performance.now() - t0 < 6) { const d = dripQ[0], t = d.tex.shift(); if (t) { try { r.initTexture(t); } catch (e) {} } if (!d.tex.length) { dripShow(d.mesh); dripQ.shift(); } }
    E.quality.drip = dripQ.length; if (!dripQ.length) E.emit("drip", 0); }
  E.addAsset = function (object, { name = "3D", category = "object", height, source = "device", pos = null, rot = 0, rigid = true, id } = {}) {
    const a = { id: id || "a" + Math.random().toString(36).slice(2, 8), name, category, source, object, height: height || REAL_HEIGHT[category] || 0.6, rot, pos: pos || [0, 0], rigid, fit: 1 };
    object.traverse((n) => { if (n.isMesh) { n.castShadow = n.receiveShadow = true; const ms = Array.isArray(n.material) ? n.material : [n.material]; ms.forEach((m) => { if (m && m.isMeshStandardMaterial) applyEnvironmentShaders(m, U, rigid ? "static" : undefined); }); n.userData.asset = a.id; } });
    const holder = new THREE.Group(); holder.name = "asset_" + a.id; holder.add(object); holder.userData.asset = a.id; a.holder = holder; scene.add(holder); E.assets.push(a); E.layout(a); E.dripTextures(object); E.emit("assets", E.assets); return a;
  };
  // scale to the real height, stand on the ground, apply position/rotation, measure the footprint, check it fits the plot
  E.layout = function (a) {
    const o = a.object; o.position.set(0, 0, 0); o.scale.setScalar(1); o.rotation.set(0, 0, 0); o.updateMatrixWorld(true);
    const b0 = new THREE.Box3().setFromObject(o), s0 = b0.getSize(new THREE.Vector3()), k = (a.height / Math.max(s0.y, 1e-3)) * (a.fit || 1); o.scale.setScalar(k); o.updateMatrixWorld(true);
    const b1 = new THREE.Box3().setFromObject(o), c1 = b1.getCenter(new THREE.Vector3()); o.position.set(-c1.x, -b1.min.y, -c1.z);
    a.holder.position.set(a.pos[0], world ? world.height(a.pos[0], a.pos[1]) : 0, a.pos[1]); a.holder.rotation.set(0, a.rot, 0); a.holder.updateMatrixWorld(true);
    const s1 = b1.getSize(new THREE.Vector3()); a.size = [+s1.x.toFixed(2), +s1.y.toFixed(2), +s1.z.toFixed(2)]; a.foot = { hx: s1.x / 2, hz: s1.z / 2 };
    const p = world ? world.plot : { hw: 99, hd: 99 }, c = Math.cos(a.rot), s = Math.sin(a.rot), ex = Math.abs(c) * a.foot.hx + Math.abs(s) * a.foot.hz, ez = Math.abs(s) * a.foot.hx + Math.abs(c) * a.foot.hz;
    a.fits = Math.abs(a.pos[0]) + ex <= p.hw && Math.abs(a.pos[1]) + ez <= p.hd; a.walkable = Math.min(p.hw * 2 - ex * 2, p.hd * 2 - ez * 2); return a;
  };
  E.placeAll = () => E.assets.forEach((a) => E.layout(a));
  E.fitToPlot = function (a, share = 0.62) { const p = world.plot; a.fit = 1; E.layout(a); const k = Math.min(1, (share * Math.min(p.hw, p.hd) * 2) / Math.max(a.size[0], a.size[2])); a.fit = k; E.layout(a); E.emit("assets", E.assets); return k; };
  E.replaceAssetObject = function (a, object, source) { a.holder.remove(a.object); disposeObject(a.object); a.object = object; a.source = source || a.source;
    object.traverse((n) => { if (n.isMesh) { n.castShadow = n.receiveShadow = true; (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { if (m && m.isMeshStandardMaterial) applyEnvironmentShaders(m, U, a.rigid ? "static" : undefined); }); n.userData.asset = a.id; } });
    a.holder.add(object); E.layout(a); E.dripTextures(object); E.emit("assets", E.assets); };
  E.removeAsset = function (id) { const i = E.assets.findIndex((x) => x.id === id); if (i < 0) return; const a = E.assets[i]; if (gizmo.object === a.holder) gizmo.detach(); scene.remove(a.holder); disposeObject(a.holder); E.assets.splice(i, 1); r.renderLists.dispose(); E.emit("assets", E.assets); };
  E.select = function (id) { const a = E.assets.find((x) => x.id === id); if (a && E.mode === "orbit") gizmo.attach(a.holder); else gizmo.detach(); E.sel = a || null; E.emit("select", E.sel); };
  E.setGizmo = (m) => gizmo.setMode(m);
  E.on("moved", (h) => { const a = h && E.assets.find((x) => x.holder === h); if (!a) return; a.pos = [+h.position.x.toFixed(3), +h.position.z.toFixed(3)]; a.rot = h.rotation.y; const s = h.scale.x; if (Math.abs(s - 1) > 1e-3) { a.height *= s; h.scale.setScalar(1); } E.layout(a); E.emit("assets", E.assets); });
  E.loadGLB = (url) => new Promise((ok, no) => new GLTFLoader().load(url, (g) => ok(g.scene), undefined, (e) => no(new Error("Couldn't open the 3D file (" + ((e && e.message) || "load error") + ")"))));

  // ── camera: orbit ↔ walk
  const W = { yaw: 0, pitch: -0.05, keys: {}, joy: { x: 0, y: 0 }, look: null, bob: 0, eye: 1.65, speed: 1.4, r: 0.28 };
  E.walk = W;
  E.setMode = function (m) {
    E.mode = m === "walk" ? "walk" : "orbit"; orbit.enabled = E.mode === "orbit"; if (E.mode === "walk") { gizmo.detach(); const p = world ? world.plot : { hw: 2, hd: 2 };
      const start = new THREE.Vector3(0, W.eye, Math.max(0.5, p.hd - 0.45)); cam.position.copy(start); resolve(cam.position); W.yaw = 0; W.pitch = -0.08; const tgt = E.assets[0] ? E.assets[0].holder.position : new THREE.Vector3(); W.yaw = Math.atan2(-(tgt.x - cam.position.x), -(tgt.z - cam.position.z)); cam.fov = 70; }
    else { cam.fov = 55; E.frame(); } cam.updateProjectionMatrix(); E.emit("mode", E.mode);
  };
  E.frame = function () { const b = new THREE.Box3(); E.assets.forEach((a) => b.expandByObject(a.holder)); if (b.isEmpty()) { const p = world ? world.plot : { hw: 2.5, hd: 2.5 }; b.set(new THREE.Vector3(-p.hw, 0, -p.hd), new THREE.Vector3(p.hw, 1.7, p.hd)); }
    const c = b.getCenter(new THREE.Vector3()), rad = Math.max(1, b.getSize(new THREE.Vector3()).length() / 2); orbit.target.copy(c); cam.position.copy(c).add(new THREE.Vector3(0.75, 0.42, 1).normalize().multiplyScalar(rad / Math.sin((cam.fov * Math.PI) / 360) * 0.9)); orbit.update(); };
  // collisions: the plot's edge, every asset's footprint (oriented box), tree trunks
  function resolve(p) { const pl = world ? world.plot : { hw: 99, hd: 99 }, rr = W.r; p.x = Math.max(-pl.hw + rr, Math.min(pl.hw - rr, p.x)); p.z = Math.max(-pl.hd + rr, Math.min(pl.hd - rr, p.z));
    for (const a of E.assets) { if (!a.foot) continue; const c = Math.cos(-a.rot), s = Math.sin(-a.rot), dx = p.x - a.holder.position.x, dz = p.z - a.holder.position.z, lx = dx * c - dz * s, lz = dx * s + dz * c, hx = a.foot.hx + rr, hz = a.foot.hz + rr;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz) { let nx = lx, nz = lz; if (hx - Math.abs(lx) < hz - Math.abs(lz)) nx = Math.sign(lx || 1) * hx; else nz = Math.sign(lz || 1) * hz; const c2 = Math.cos(a.rot), s2 = Math.sin(a.rot); p.x = a.holder.position.x + nx * c2 - nz * s2; p.z = a.holder.position.z + nx * s2 + nz * c2; } }
    for (const t of world ? world.colliders : []) { const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz), m = t.r + rr; if (d < m && d > 1e-4) { p.x = t.x + (dx / d) * m; p.z = t.z + (dz / d) * m; } } return p; }
  E.resolve = resolve;
  function walkStep(dt) { const k = W.keys, run = k.ShiftLeft || k.ShiftRight ? 2.1 : 1; let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - W.joy.y, sx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + W.joy.x;
    if (k.KeyQ) W.yaw += dt * 1.6; if (k.KeyE) W.yaw -= dt * 1.6; const l = Math.hypot(f, sx); if (l > 1) { f /= l; sx /= l; }
    const v = W.speed * run * dt, fw = new THREE.Vector3(-Math.sin(W.yaw), 0, -Math.cos(W.yaw)), rt = new THREE.Vector3(Math.cos(W.yaw), 0, -Math.sin(W.yaw));
    const p = cam.position.clone().addScaledVector(fw, f * v).addScaledVector(rt, sx * v); resolve(p); const moved = Math.hypot(p.x - cam.position.x, p.z - cam.position.z); W.bob += moved * 5.5;
    cam.position.set(p.x, (world ? world.height(p.x, p.z) : 0) + W.eye + Math.sin(W.bob) * 0.022, p.z); cam.rotation.set(W.pitch, W.yaw, 0); }
  // pointer: drag to look in walk mode; tap picks an asset in orbit mode
  let down = null; canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, yaw: W.yaw, pitch: W.pitch, t: performance.now(), id: e.pointerId }; });
  addEventListener("pointermove", (e) => { if (!down || E.mode !== "walk" || e.pointerId !== down.id) return; W.yaw = down.yaw - (e.clientX - down.x) * 0.005; W.pitch = Math.max(-1.2, Math.min(1.2, down.pitch - (e.clientY - down.y) * 0.004)); });
  addEventListener("pointerup", (e) => { if (!down) return; const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 400; down = null;
    if (tap && E.mode === "orbit" && !gizmo.dragging) { const rc = new THREE.Raycaster(), b = canvas.getBoundingClientRect(); rc.setFromCamera(new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), cam);
      const hit = rc.intersectObjects(E.assets.map((a) => a.holder), true)[0]; E.select(hit ? hit.object.userData.asset : null); } });
  const typing = (e) => /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "");
  addEventListener("keydown", (e) => { if (E.mode !== "walk" || typing(e)) return; W.keys[e.code] = true; if (/^(Arrow|Key[WASDQE]|Space)/.test(e.code)) e.preventDefault(); });
  addEventListener("keyup", (e) => { W.keys[e.code] = false; }); addEventListener("blur", () => { W.keys = {}; });

  // ── guided tour: a loop around the subject inside the plot, looking at it (used for walk-through videos)
  E.tourPose = function (t) { const p = world ? world.plot : { hw: 2.5, hd: 2.5 }, a0 = E.assets[0], c = a0 ? a0.holder.position : new THREE.Vector3();
    const fx = a0 ? a0.foot.hx : 0, fz = a0 ? a0.foot.hz : 0, rx = Math.max(Math.min(fx + 0.9, p.hw - W.r - 0.05), 0.4), rz = Math.max(Math.min(fz + 0.9, p.hd - W.r - 0.05), 0.4), a = t * Math.PI * 2 + Math.PI / 2;
    const pos = new THREE.Vector3(c.x + Math.cos(a) * rx, 0, c.z + Math.sin(a) * rz); resolve(pos); pos.y = W.eye + Math.sin(t * 40) * 0.015; const look = new THREE.Vector3(c.x, a0 ? Math.min(a0.size[1] * 0.55, 1.3) : 1, c.z); return { pos, look }; };
  let tour = null; E.startTour = (sec = 12) => { E.setMode("walk"); tour = { t0: performance.now(), sec }; }; E.stopTour = () => { tour = null; }; E.touring = () => !!tour;

  // ── loop
  const clock = new THREE.Clock(); let raf = 0, running = true, fps = 60, acc = 0, frames = 0;
  function size() { const w = canvas.clientWidth || 640, h = canvas.clientHeight || 400; if (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(h * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } }
  const ro = new ResizeObserver(size); ro.observe(canvas);
  let slow = 0, fast = 0;
  function adapt() { const Q = E.quality; Q.fps = fps; if (!Q.auto || E._recTrack || tour || dripQ.length) { slow = fast = 0; return; }
    if (fps < 42) { fast = 0; if (++slow >= 2 && Q.pr > Q.min) { Q.pr = Math.max(Q.min, +(Q.pr * 0.85).toFixed(2)); r.setPixelRatio(Q.pr); size(); slow = 0; E.emit("quality", Q); } }
    else if (fps >= 57) { slow = 0; if (++fast >= 4 && Q.pr < Q.cap) { Q.pr = Math.min(Q.cap, +(Q.pr * 1.12).toFixed(2)); r.setPixelRatio(Q.pr); size(); fast = 0; E.emit("quality", Q); } }
    else slow = fast = 0; }
  E.setQuality = function (auto, pr) { const Q = E.quality; Q.auto = !!auto; if (pr) { Q.pr = Math.min(Q.cap, Math.max(Q.min, +pr)); r.setPixelRatio(Q.pr); size(); } E.emit("quality", Q); };
  function loop() { raf = requestAnimationFrame(loop); if (!running || document.hidden) return; const dt = Math.min(0.05, clock.getDelta()); size(); U.uTime.value += dt; acc += dt; frames++; if (acc > 1) { fps = Math.round(frames / acc); acc = 0; frames = 0; adapt(); } dripStep();
    if (tour) { const t = ((performance.now() - tour.t0) / 1000) / tour.sec, pose = E.tourPose(t % 1); cam.position.copy(pose.pos); cam.lookAt(pose.look); W.yaw = cam.rotation.y; W.pitch = cam.rotation.x; if (t >= 1 && tour.once) tour = null; }
    else if (E.mode === "walk") walkStep(dt); else orbit.update();
    U.uUpView.value.set(0, 1, 0).transformDirection(cam.matrixWorldInverse); sky.position.copy(cam.position); if (fx) fx.update(cam); inLoop = true; try { r.render(scene, cam); } finally { inLoop = false; } if (E._recTrack && E._recTrack.requestFrame) E._recTrack.requestFrame(); }
  loop();
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); running = false; E.lost = true; E.emit("lost"); }); canvas.addEventListener("webglcontextrestored", () => { running = true; E.lost = false; bakeEnv(); });

  // ── capture & export
  E.snapshot = (type = "image/png", q = 0.92) => { gizmo.visible = false; r.render(scene, cam); const p = new Promise((ok) => canvas.toBlob(ok, type, q)); gizmo.visible = true; return p; };
  E.record = async function (sec = 10, { tourMode = true, onTick } = {}) { E.dripFlush();
    if (!canvas.captureStream || !window.MediaRecorder) throw new Error("This browser can't record video");
    const vs = canvas.captureStream(30); E._recTrack = vs.getVideoTracks()[0]; const as = amb.on ? amb.stream() : null, tracks = [...vs.getVideoTracks(), ...(as ? as.getAudioTracks() : [])], st = new MediaStream(tracks);
    const mime = (tier === "low" ? ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus"] : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus"]).concat(["video/webm", "video/mp4"]).find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const rec = new MediaRecorder(st, mime ? { mimeType: mime, videoBitsPerSecond: tier === "low" ? 4e6 : 8e6 } : {}), ch = []; let got = 0; rec.ondataavailable = (e) => { if (e.data.size) { ch.push(e.data); got += e.data.size; } }; const done = new Promise((ok) => (rec.onstop = ok));
    gizmo.detach(); const was = E.mode; if (tourMode) { E.startTour(sec); tour.once = true; } rec.start(250);
    const t0 = performance.now(); await new Promise((ok) => { const iv = setInterval(() => { const t = (performance.now() - t0) / 1000; onTick && onTick(Math.min(1, t / sec)); if (t >= sec) { clearInterval(iv); ok(); } }, 200); });
    // a slow device's encoder can take a few seconds to hand over its first data — stopping before that gives an empty file, so wait for it
    const t1 = performance.now(); while (got < 1024 && performance.now() - t1 < 8000) { try { rec.requestData(); } catch (e) {} await new Promise((ok) => setTimeout(ok, 250)); }
    try { rec.requestData(); } catch (e) {} rec.stop(); await done; E._recTrack = null; vs.getTracks().forEach((t) => t.stop()); tour = null; if (tourMode && was === "orbit") E.setMode("orbit");
    const out = new Blob(ch, { type: (mime || "video/webm").split(";")[0] }); if (!out.size) throw new Error("This browser couldn't record the 3D view — try Chrome, Edge or Safari"); return out;
  };
  // the scene for export: assets + the ground + the plants within `radius` (instanced plants become meshes sharing geometry)
  function exportGroup(radius = 14) { const g = new THREE.Group(); g.name = "nooi_scene";
    for (const a of E.assets) { const c = a.holder.clone(true); g.add(c); }
    if (world) { world.group.updateMatrixWorld(true); const m4 = new THREE.Matrix4(), v = new THREE.Vector3(); let n = 0;
      world.group.traverse((o) => { if (o.name === "ground") { const c = o.clone(); c.geometry = o.geometry; g.add(c); return; }
        if (o.isInstancedMesh) { for (let i = 0; i < o.count && n < 1600; i++) { o.getMatrixAt(i, m4); v.setFromMatrixPosition(m4); if (Math.hypot(v.x, v.z) > radius) continue; const m = new THREE.Mesh(o.geometry, o.material); m.applyMatrix4(m4); m.name = o.name; g.add(m); n++; } } }); }
    return g; }
  E.exportGLB = (opts = {}) => new Promise((ok, no) => { E.dripFlush(); const g = opts.assetsOnly ? (() => { const x = new THREE.Group(); E.assets.forEach((a) => x.add(a.holder.clone(true))); return x; })() : exportGroup(opts.radius); if (!g.children.length) return no(new Error("Nothing to export yet"));
    new GLTFExporter().parse(g, (res) => ok(new Blob([res], { type: "model/gltf-binary" })), { binary: true, onlyVisible: true, maxTextureSize: 2048 }); });
  E.exportUSDZ = async () => { E.dripFlush(); const g = new THREE.Group(); E.assets.forEach((a) => g.add(a.holder.clone(true))); if (!g.children.length) throw new Error("Add an object first"); const buf = await new USDZExporter().parse(g); return new Blob([buf], { type: "model/vnd.usdz+zip" }); };
  E.info = () => ({ lost: !!E.lost, fps, calls: r.info.render.calls, triangles: r.info.render.triangles, geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: (r.info.programs || []).length, mode: E.mode, assets: E.assets.length, world: world && world.info });
  E.dispose = () => { cancelAnimationFrame(raf); ro.disconnect(); amb.dispose(); E.assets.slice().forEach((a) => E.removeAsset(a.id)); if (world) world.dispose(); if (fx) fx.dispose(); disposeObject(sky); disposeObject(skyEnv); if (envRT) envRT.dispose(); pmrem.dispose(); gizmo.dispose(); orbit.dispose(); r.renderLists.dispose(); r.dispose(); };
  return E;
}
