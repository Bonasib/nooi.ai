// Photoreal worlds made by World Labs (Marble): the place itself is a Gaussian-splat cloud drawn by Spark (World Labs' MIT
// renderer for three.js — it needs WebGL2, so the engine switches to it for these worlds), the ground you walk on is their
// collider mesh. The collider is sampled into the same height grid the built worlds use, so walking, physics, people and
// animals work the same way on top of a photoreal place. Phones load the light 100k-splat file, computers the 500k one.
import { noise2 } from "./terrain.js";

export async function loadSplat(T, engine, scene, splat, tier) {
  const { SparkRenderer, SplatMesh } = await import("@sparkjsdev/spark");
  const spark = new SparkRenderer({ renderer: engine.renderer }); scene.add(spark);
  const url = tier.name === "high" && splat.hi ? splat.hi : splat.lo;
  const mesh = new SplatMesh({ url }); mesh.quaternion.set(1, 0, 0, 0);   // their files are y-down
  scene.add(mesh);
  if (mesh.initialized && typeof mesh.initialized.then === "function") await Promise.race([mesh.initialized, new Promise((_, bad) => setTimeout(() => bad(new Error("The world's picture took too long to load")), 60000))]);
  let collider = null;
  if (splat.collider) { const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"); const g = await new GLTFLoader().loadAsync(splat.collider); collider = g.scene; collider.quaternion.set(1, 0, 0, 0); collider.updateMatrixWorld(true); collider.visible = false; scene.add(collider); }
  return { spark, mesh, collider, dispose() { scene.remove(spark, mesh); if (collider) scene.remove(collider); try { mesh.dispose && mesh.dispose(); spark.dispose && spark.dispose(); } catch {} } };
}

// the collider mesh → a height grid with the same interface as terrain.js (heightAt, slopeAt, flatten, isWater…)
export function terrainFromCollider(T, collider, tier, fallbackSize = 40) {
  const box = collider ? new T.Box3().setFromObject(collider) : new T.Box3(new T.Vector3(-fallbackSize / 2, -1, -fallbackSize / 2), new T.Vector3(fallbackSize / 2, 1, fallbackSize / 2));
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, S = Math.max(8, Math.ceil(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + 2));
  const res = Math.max(32, Math.min(tier.name === "low" ? 96 : 140, Math.round(S / 0.35))), step = S / (res - 1), heights = new Float32Array(res * res);
  const rc = new T.Raycaster(), down = new T.Vector3(0, -1, 0), o = new T.Vector3(), meshes = [];
  if (collider) collider.traverse((n) => { if (n.isMesh) meshes.push(n); });
  // the floor under where the picture was taken (World Labs puts that camera at the origin, at eye height)
  const floorAt = (x, z, from) => { o.set(x, from, z); rc.set(o, down); rc.far = from - box.min.y + 5; const h = meshes.length ? rc.intersectObjects(meshes, false) : []; return h.length ? h[0].point.y : box.min.y; };
  const spawn = box.containsPoint(new T.Vector3(0, (box.min.y + box.max.y) / 2, 0)) ? [0, 0] : [cx, cz], spawnY = floorAt(spawn[0], spawn[1], Math.min(box.max.y, 0.8));
  // for people, animals and placing things: the highest surface that faces up (roofs higher than a storey above the start are skipped)
  const nrm = new T.Vector3();
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = cx - S / 2 + i * step, z = cz - S / 2 + j * step; o.set(x, box.max.y + 5, z); rc.set(o, down); rc.far = box.max.y - box.min.y + 10;
    const hits = meshes.length ? rc.intersectObjects(meshes, false) : []; let h = spawnY;
    for (const k of hits) { if (!k.face) continue; nrm.copy(k.face.normal).transformDirection(k.object.matrixWorld); if (nrm.y > 0.5 && k.point.y < spawnY + 2.6) { h = k.point.y; break; } }
    heights[j * res + i] = h;
  }
  // the exact collider for the walker and the physics (walls, steps and arches as they are)
  let trimesh = null;
  if (meshes.length) { const P = [], I = []; const v = new T.Vector3();
    for (const m of meshes) { const g = m.geometry, pos = g.attributes.position, base = P.length / 3; for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld); P.push(v.x, v.y, v.z); }
      if (g.index) for (let k = 0; k < g.index.count; k++) I.push(base + g.index.getX(k)); else for (let k = 0; k < pos.count; k++) I.push(base + k); }
    if (I.length < 3e6) trimesh = { vertices: new Float32Array(P), indices: new Uint32Array(I) }; }
  const lerp = (a, b, t) => a + (b - a) * t, x0 = cx - S / 2, z0 = cz - S / 2;
  const heightAt = (x, z) => { const fx = Math.max(0, Math.min(res - 1.0001, (x - x0) / step)), fz = Math.max(0, Math.min(res - 1.0001, (z - z0) / step)), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    return lerp(lerp(heights[j * res + i], heights[j * res + i + 1], u), lerp(heights[(j + 1) * res + i], heights[(j + 1) * res + i + 1], u), v); };
  const slopeAt = (x, z) => Math.hypot(heightAt(x + step, z) - heightAt(x - step, z), heightAt(x, z + step) - heightAt(x, z - step)) / (2 * step);
  return { size: S, res, step, heights, heightAt, slopeAt, isWater: () => false, flatten: (x, z) => heightAt(x, z), mesh: () => null, farRing: () => null, water: { kind: "none", level: -999 }, noise: noise2(7), center: [cx, cz], offset: [x0, z0], spawn, spawnY, trimesh };
}
