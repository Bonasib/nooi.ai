// The person walking in the world: keyboard + mouse on a computer, a thumb stick and buttons on a phone. Walk (first person,
// eye height 1.65 m, with the physics walker so slopes, steps and walls work), fly (a drone, no gravity), look around from
// above (orbit) and a smooth automatic tour for videos. One button picks up / throws / pushes whatever is in front of you.
export function createPlayer(T, engine, { host: host0, physics, terrain, water, plan, onAct = () => {}, onMode = () => {} }) {
  let host = host0;
  const cam = new T.PerspectiveCamera(plan.place === "room" ? 72 : 68, 1, 0.08, engine.tier.far * 1.05);
  engine.camera = cam;
  const S = plan.size, lim = S / 2 - 1.5, eye = 1.65, [ox, oz] = terrain.center || [0, 0];
  const st = { mode: "intro", yaw: 0, pitch: -0.04, x: plan.spawn.at[0], z: plan.spawn.at[1], y: 0, vy: 0, mv: { x: 0, y: 0 }, keys: new Set(), run: false, jump: false, up: false, down: false,
    orbit: { az: 0.6, el: 0.5, dist: Math.min(140, S * 0.55) }, intro: 0, tour: null, bob: 0, touched: false };
  const look = plan.spawn.look; st.yaw = Math.atan2(look[0] - st.x, look[1] - st.z) + Math.PI;
  st.y = terrain.heightAt(st.x, st.z);
  let walker = null; if (physics) walker = physics.addWalker(st.x, st.y + 0.05, st.z);
  const dir = new T.Vector3(), fwd = new T.Vector3(), right = new T.Vector3(), tmp = new T.Vector3();
  // ---- input ----
  const typing = (e) => /input|textarea|select/i.test((e.target && e.target.tagName) || "") || (e.target && e.target.isContentEditable);
  const kd = (e) => { if (typing(e) || !host.isConnected) return; const k = e.code; if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight", "KeyE", "KeyF", "KeyQ"].includes(k)) e.preventDefault();
    st.keys.add(k); if (k === "Space") st.jump = true; if (k === "KeyE") onAct("act"); if (k === "KeyF") setMode(st.mode === "fly" ? "walk" : "fly"); if (k === "KeyQ") onAct("kick"); wake(); };
  const ku = (e) => { st.keys.delete(e.code); if (e.code === "Space") st.jump = false; };
  addEventListener("keydown", kd); addEventListener("keyup", ku);
  const cv = engine.canvas; let drag = null;
  const pd = (e) => { if (e.target !== engine.canvas) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, t: performance.now() }; try { engine.canvas.setPointerCapture(e.pointerId); } catch {} wake(); };
  const pm = (e) => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); turn(dx, dy); };
  const pu = (e) => { if (!drag || e.pointerId !== drag.id) return; const tap = drag.moved < 8 && performance.now() - drag.t < 400; drag = null; if (tap) onAct("tap", { x: e.clientX, y: e.clientY }); };
  const wh = (e) => { if (st.mode === "orbit") { st.orbit.dist = Math.max(8, Math.min(S * 1.2, st.orbit.dist * (e.deltaY > 0 ? 1.1 : 0.9))); e.preventDefault(); } };
  host.addEventListener("pointerdown", pd); addEventListener("pointermove", pm); addEventListener("pointerup", pu); addEventListener("pointercancel", pu); host.addEventListener("wheel", wh, { passive: false });
  function turn(dx, dy) { const k = matchMedia("(pointer:coarse)").matches ? 0.0052 : 0.0034; if (st.mode === "orbit") { st.orbit.az -= dx * k; st.orbit.el = Math.max(0.08, Math.min(1.4, st.orbit.el + dy * k)); } else { st.yaw -= dx * k; st.pitch = Math.max(-1.35, Math.min(1.35, st.pitch - dy * k)); } }
  function wake() { st.touched = true; if (st.mode === "tour") setMode("walk"); }
  // ---- the thumb stick (phones and tablets) ----
  const joy = document.createElement("div"); joy.className = "nw-joy"; joy.innerHTML = '<div class="nw-knob"></div>'; host.appendChild(joy);
  let jid = null, jc = null;
  joy.addEventListener("pointerdown", (e) => { jid = e.pointerId; const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; joy.setPointerCapture(e.pointerId); jm(e); wake(); e.stopPropagation(); });
  const jm = (e) => { if (e.pointerId !== jid) return; let dx = (e.clientX - jc.x) / jc.r, dy = (e.clientY - jc.y) / jc.r; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } st.mv.x = dx; st.mv.y = -dy; st.run = l > 0.92; joy.firstChild.style.transform = `translate(${dx * jc.r * 0.55}px,${dy * jc.r * 0.55}px)`; };
  joy.addEventListener("pointermove", jm);
  const je = (e) => { if (e.pointerId !== jid) return; jid = null; st.mv.x = st.mv.y = 0; st.run = false; joy.firstChild.style.transform = ""; };
  joy.addEventListener("pointerup", je); joy.addEventListener("pointercancel", je);
  function setMode(m) {
    if (m === st.mode) return; const prev = st.mode; st.mode = m;
    if (m === "orbit") { st.orbit.az = st.yaw; }
    if (m === "walk" && prev === "fly" && walker) { const p = walker.body.translation(); walker.body.setTranslation({ x: st.x, y: Math.max(terrain.heightAt(st.x, st.z) + 1.0, st.y - eye + 0.9), z: st.z }, true); walker.vy = 0; void p; }
    if (m === "tour") st.tour = makeTour();
    host.classList.toggle("nw-fly", m === "fly"); onMode(m);
  }
  // a smooth path for videos: around the hero, over the land, back down to the walker
  function makeTour() {
    const hero = plan._hero || [0, 0], pts = [], n = 6, h0 = terrain.heightAt(st.x, st.z) + eye;
    pts.push(new T.Vector3(st.x, h0, st.z));
    for (let i = 0; i < n; i++) { const a = st.yaw + Math.PI + (i / n) * Math.PI * 1.6, r = 14 + i * 3, x = hero[0] + Math.sin(a) * r, z = hero[1] + Math.cos(a) * r; pts.push(new T.Vector3(x, Math.max(terrain.heightAt(x, z), water ? water.level : -99) + 2.2 + i * 1.6, z)); }
    const curve = new T.CatmullRomCurve3(pts, false, "centripetal"); return { curve, t: 0, len: 14, hero };
  }
  // ---- every frame ----
  function update(dt, t) {
    const K = st.keys, kx = (K.has("KeyD") || K.has("ArrowRight") ? 1 : 0) - (K.has("KeyA") || K.has("ArrowLeft") ? 1 : 0), kz = (K.has("KeyW") || K.has("ArrowUp") ? 1 : 0) - (K.has("KeyS") || K.has("ArrowDown") ? 1 : 0);
    const mx = st.mv.x + kx, mz = st.mv.y + kz, run = st.run || K.has("ShiftLeft") || K.has("ShiftRight");
    fwd.set(-Math.sin(st.yaw), 0, -Math.cos(st.yaw)); right.set(-fwd.z, 0, fwd.x);
    dir.set(0, 0, 0).addScaledVector(fwd, mz).addScaledVector(right, mx);
    if (st.mode === "intro") {
      // a short flight in from above, then the world is yours
      st.intro += dt / 2.6; const k = Math.min(1, st.intro), e = 1 - Math.pow(1 - k, 3), gy = terrain.heightAt(st.x, st.z) + eye;
      const from = tmp.set(st.x + Math.sin(st.yaw) * 60, gy + 48, st.z + Math.cos(st.yaw) * 60); cam.position.lerpVectors(from, new T.Vector3(st.x, gy, st.z), e);
      cam.rotation.set(-0.62 * (1 - e) + st.pitch * e, st.yaw, 0, "YXZ"); if (k >= 1 || st.touched) setMode("walk"); return;
    }
    if (st.mode === "tour") { const tr = st.tour; tr.t = Math.min(1, tr.t + dt / tr.len); const p = tr.curve.getPointAt(tr.t); cam.position.copy(p); const h = tr.hero; cam.lookAt(h[0], terrain.heightAt(h[0], h[1]) + 2, h[1]); if (tr.t >= 1) setMode("walk"); return; }
    if (st.mode === "orbit") { const o = st.orbit, c = plan._hero || [0, 0], cy = terrain.heightAt(c[0], c[1]) + 2; if (!st.touched) o.az += dt * 0.08;
      cam.position.set(c[0] + Math.sin(o.az) * Math.cos(o.el) * o.dist, cy + Math.sin(o.el) * o.dist, c[1] + Math.cos(o.az) * Math.cos(o.el) * o.dist); cam.lookAt(c[0], cy, c[1]); return; }
    if (st.mode === "fly") {
      const sp = (run ? 26 : 11) * dt; tmp.set(-Math.sin(st.yaw) * Math.cos(st.pitch), Math.sin(st.pitch), -Math.cos(st.yaw) * Math.cos(st.pitch));
      cam.position.addScaledVector(tmp, mz * sp).addScaledVector(right, mx * sp); if (K.has("Space") || st.up) cam.position.y += sp; if (K.has("KeyC") || st.down) cam.position.y -= sp;
      cam.position.x = Math.max(ox - lim, Math.min(ox + lim, cam.position.x)); cam.position.z = Math.max(oz - lim, Math.min(oz + lim, cam.position.z)); cam.position.y = Math.max(terrain.heightAt(cam.position.x, cam.position.z) + 0.6, Math.min(320, cam.position.y));
      st.x = cam.position.x; st.z = cam.position.z; st.y = cam.position.y; cam.rotation.set(st.pitch, st.yaw, 0, "YXZ"); return;
    }
    // walk
    if (physics && walker) {
      physics.step(dt, { x: dir.x, z: dir.z, run, jump: st.jump || K.has("Space"), up: K.has("Space") || st.up, down: K.has("KeyC") || st.down });
      st.jump = false; const p = walker.pos; st.x = p.x; st.z = p.z; st.y = p.y + eye - 0.87;
    } else { // no physics engine on this device: walk on the height map
      const sp = (run ? 6.2 : 3.4) * dt; st.x = Math.max(ox - lim, Math.min(ox + lim, st.x + dir.x * sp)); st.z = Math.max(oz - lim, Math.min(oz + lim, st.z + dir.z * sp));
      const gy = terrain.heightAt(st.x, st.z); if (st.jump && st.y <= gy + eye + 0.01) st.vy = 4.2; st.jump = false; st.vy -= 9.81 * dt; st.y = Math.max(gy + eye, st.y + st.vy * dt); if (st.y <= gy + eye) st.vy = 0;
    }
    const moving = dir.lengthSq() > 0.01; st.bob = moving ? st.bob + dt * (run ? 11 : 7.5) : st.bob * 0.9;
    cam.position.set(st.x, st.y + (moving ? Math.sin(st.bob) * 0.035 : 0), st.z); cam.rotation.set(st.pitch, st.yaw, 0, "YXZ");
    if (physics) { const o = cam.position, d = cam.getWorldDirection(tmp); physics.setHeldTarget({ x: o.x, y: o.y, z: o.z }, { x: d.x, y: d.y, z: d.z }); }
  }
  return {
    camera: cam, update, setMode, get mode() { return st.mode; },
    get pos() { return { x: st.x, y: st.y, z: st.z, yaw: st.yaw, running: st.run || st.keys.has("ShiftLeft") }; },
    eyeRay() { const o = cam.position, d = cam.getWorldDirection(new T.Vector3()); return { origin: { x: o.x, y: o.y, z: o.z }, dir: { x: d.x, y: d.y, z: d.z } }; },
    press(name, on = true) { if (name === "jump") st.jump = on; if (name === "up") st.up = on; if (name === "down") st.down = on; wake(); },
    move(x, y) { st.mv.x = x; st.mv.y = y; },
    look: turn,
    // the page redrew the stage: move the thumb stick and the listeners to the new one (the canvas moves with the engine)
    rehost(el) { if (!el || el === host) return; host.removeEventListener("pointerdown", pd); host.removeEventListener("wheel", wh); host = el; host.addEventListener("pointerdown", pd); host.addEventListener("wheel", wh, { passive: false }); host.appendChild(joy); },
    teleport(x, z) { st.x = x; st.z = z; st.y = terrain.heightAt(x, z) + eye; if (walker) { walker.body.setTranslation({ x, y: terrain.heightAt(x, z) + 1, z }, true); walker.vy = 0; } },
    // turn to look at a point (a tapped thing, the start of a tour, a test)
    face(x, y, z) { const dx = x - st.x, dz = z - st.z; st.yaw = Math.atan2(dx, dz) + Math.PI; st.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(y - st.y, Math.hypot(dx, dz)))); cam.rotation.set(st.pitch, st.yaw, 0, "YXZ"); },
    dispose() { removeEventListener("keydown", kd); removeEventListener("keyup", ku); host.removeEventListener("pointerdown", pd); removeEventListener("pointermove", pm); removeEventListener("pointerup", pu); removeEventListener("pointercancel", pu); host.removeEventListener("wheel", wh); joy.remove(); }
  };
}
