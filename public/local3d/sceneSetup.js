// nooi.ai · On-device 3D — the three.js scene: renderer sized for the device, orbit controls, live HDR sky (procedural or
// your own .hdr), sun light with soft shadows, shadow-catching ground, wind & snow on every material, falling snow,
// .glb export, and strict cleanup (geometries, materials, textures, render lists, PMREM targets) for iPhone / iPad.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { createEnvUniforms, applyEnvironmentShaders, createSnowfall, createSkyDome } from "./shaders.js";
import { disposeObject } from "./localInference.js";
export { THREE };

export function createViewer(canvas, { mobile = false } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(mobile ? 1.5 : 2, window.devicePixelRatio || 1));
  if ("outputColorSpace" in r) r.outputColorSpace = THREE.SRGBColorSpace; else r.outputEncoding = THREE.sRGBEncoding;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.shadowMap.enabled = true; r.shadowMap.type = mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.02, 200); cam.position.set(1.8, 1.3, 3.2);
  const ctl = new OrbitControls(cam, canvas); ctl.enableDamping = true; ctl.target.set(0, 0.8, 0); ctl.maxPolarAngle = Math.PI * 0.495; ctl.minDistance = 0.4; ctl.maxDistance = 30;
  const U = createEnvUniforms(THREE), pmrem = new THREE.PMREMGenerator(r);
  // sky + image-based lighting
  const sky = createSkyDome(THREE), skyScene = new THREE.Scene(); skyScene.add(sky); scene.add(sky.clone());
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 }); sun.shadow.bias = -0.0005; scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xdde6ff, 0x3a3328, 0.25); scene.add(hemi);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: 0.3 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const snow = createSnowfall(THREE, U, mobile ? 2000 : 5000); scene.add(snow);
  let envRT = null, hdrTex = null, model = null, sunDeg = { az: 35, el: 40 }, envTimer = 0;
  function bakeEnv() { if (hdrTex) return; if (envRT) envRT.dispose(); envRT = pmrem.fromScene(skyScene, 0.02); scene.environment = envRT.texture; scene.background = null; }
  function setSun(az = sunDeg.az, el = sunDeg.el) { sunDeg = { az, el }; const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, d = new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
    sky.material.uniforms.uSun.value.copy(d); scene.children.forEach((c) => { if (c.name === "nooi_sky") c.material.uniforms.uSun.value.copy(d); });
    sun.position.copy(d).multiplyScalar(8); sun.intensity = 2.4 * Math.max(0.05, Math.sin(e)); sun.color.setHSL(0.09, 0.6, 0.5 + 0.45 * Math.min(1, e / 0.6));
    clearTimeout(envTimer); envTimer = setTimeout(bakeEnv, 120); }
  setSun(); bakeEnv();
  // a user .hdr file (read locally, never uploaded): becomes background + lighting
  async function setHDR(arrayBuffer) { const loader = new RGBELoader(); if (loader.setDataType) loader.setDataType(THREE.HalfFloatType); const data = loader.parse(arrayBuffer); if (!data || !data.data) throw new Error("That isn't a readable .hdr file"); const t = new THREE.DataTexture(data.data, data.width, data.height, data.format ?? THREE.RGBAFormat, data.type); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true; if ("colorSpace" in t) t.colorSpace = THREE.LinearSRGBColorSpace; else t.encoding = THREE.LinearEncoding;
    clearHDR(); hdrTex = t; if (envRT) envRT.dispose(); envRT = pmrem.fromEquirectangular(t); scene.environment = envRT.texture; scene.background = t; scene.children.forEach((c) => { if (c.name === "nooi_sky") c.visible = false; }); }
  function clearHDR() { if (hdrTex) { hdrTex.dispose(); hdrTex = null; scene.children.forEach((c) => { if (c.name === "nooi_sky") c.visible = true; }); bakeEnv(); } }
  // the generated model: stand it on the ground, 1.6 m tall, every material gets wind & snow
  function setModel(group) {
    clearModel(); if (!group) return; const b = new THREE.Box3().setFromObject(group), s = b.getSize(new THREE.Vector3()), k = 1.6 / Math.max(s.x, s.y, s.z, 1e-3);
    group.scale.multiplyScalar(k); const b2 = new THREE.Box3().setFromObject(group), c = b2.getCenter(new THREE.Vector3()); group.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));
    let ymin = Infinity, ymax = -Infinity; group.traverse((n) => { if (n.isMesh) { n.geometry.computeBoundingBox(); ymin = Math.min(ymin, n.geometry.boundingBox.min.y); ymax = Math.max(ymax, n.geometry.boundingBox.max.y); applyEnvironmentShaders(n.material, U); } });
    U.uHeight.value.set(ymin, ymax); model = group; scene.add(group); frame();
  }
  function clearModel() { if (!model) return; scene.remove(model); disposeObject(model); model = null; r.renderLists.dispose(); }
  function frame() { if (!model) return; const b = new THREE.Box3().setFromObject(model), c = b.getCenter(new THREE.Vector3()), rad = b.getSize(new THREE.Vector3()).length() / 2; ctl.target.copy(c); cam.position.copy(c).add(new THREE.Vector3(0.55, 0.35, 1).normalize().multiplyScalar(rad / Math.sin((cam.fov * Math.PI) / 360) * 0.85)); ctl.update(); }
  function setMode(m) { if (!model) return; model.traverse((n) => { if (n.isMesh) n.material.wireframe = m === "wire"; }); }
  // render loop — paused when the tab is hidden or the canvas is off the page
  const clock = new THREE.Clock(), upW = new THREE.Vector3(0, 1, 0); let raf = 0, running = true;
  function resize() { const w = canvas.clientWidth || 640, h = canvas.clientHeight || 400; if (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(h * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } }
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  function loop() { raf = requestAnimationFrame(loop); if (!running || document.hidden) return; resize(); U.uTime.value = clock.getElapsedTime(); U.uUpView.value.copy(upW).transformDirection(cam.matrixWorldInverse); snow.visible = U.uSnow.value > 0.01; ctl.update(); r.render(scene, cam); }
  loop();
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); running = false; });
  canvas.addEventListener("webglcontextrestored", () => { running = true; bakeEnv(); });
  return {
    THREE, renderer: r, scene, camera: cam, controls: ctl, uniforms: U,
    setModel, clearModel, frame, setMode, setSun, setHDR, clearHDR,
    setWind(v) { U.uWind.value = +v; }, setWindDir(deg) { const a = (deg * Math.PI) / 180; U.uWindDir.value.set(Math.cos(a), Math.sin(a)); }, setSnow(v) { U.uSnow.value = +v; },
    setExposure(v) { r.toneMappingExposure = +v; },
    exportGLB() { return new Promise((ok, no) => { if (!model) return no(new Error("Nothing to export")); new GLTFExporter().parse(model, (res) => ok(new Blob([res], { type: "model/gltf-binary" })), { binary: true }); }); },
    snapshot(type = "image/png") { r.render(scene, cam); return new Promise((ok) => canvas.toBlob(ok, type, 0.92)); },
    info() { return { geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: (r.info.programs || []).length, calls: r.info.render.calls } },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); clearModel(); clearHDR(); disposeObject(snow); disposeObject(sky); scene.traverse((n) => { if (n.name === "nooi_sky") disposeObject(n); }); ground.geometry.dispose(); ground.material.dispose(); if (envRT) envRT.dispose(); pmrem.dispose(); ctl.dispose(); r.renderLists.dispose(); r.dispose(); }
  };
}
