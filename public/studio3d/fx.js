// nooi.ai · 3D Studio — living effects, all animated in shaders on the GPU (the CPU only updates a few uniforms per frame):
//   rain (streaks that follow the camera, slanted by the wind) · ground mist · light shafts through the canopy · fireflies ·
//   falling leaves · snowfall · and an ambience made with Web Audio (rain, wind, birds, insects, waves) that is also mixed into
//   recorded walk-through videos. Nothing is downloaded.
import * as THREE from "three";
import { createSnowfall } from "./shaders.js";
import { rng } from "./world.js";

function softDot(size = 64) { const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, size, size); return new THREE.CanvasTexture(c); }

export function createFX({ U, radius = 30, plot = { hw: 2.5, hd: 2.5 }, tier = "high", seed = 3 }) {
  const R = rng(seed), q = tier === "low" ? 0.45 : 1, group = new THREE.Group(); group.name = "nooi_fx"; const owned = [];
  const F = { uRain: { value: 0 }, uMist: { value: 0 }, uRays: { value: 0 }, uFire: { value: 0 }, uLeaves: { value: 0 }, uNight: { value: 0 }, uCam: { value: new THREE.Vector3() }, uMistColor: { value: new THREE.Color(0.85, 0.9, 0.86) }, uSunDir: { value: new THREE.Vector3(0.3, 1, 0.2).normalize() } };
  const uni = (extra) => Object.assign({}, U, F, extra || {});
  const own = (o) => (owned.push(o), o);

  // ── rain: line streaks in a 24 m box that travels with the camera
  { const n = Math.round(7000 * q), pos = new Float32Array(n * 6), sd = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const a = R(), b = R(), c = R(), d = R(); for (let k = 0; k < 2; k++) { sd.set([a, b, c], i * 6 + k * 3); pos[i * 6 + k * 3 + 1] = k; } }
    const g = own(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(sd, 3));
    const m = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: uni(),
      vertexShader: `attribute vec3 seed; uniform float uTime; uniform float uWind; uniform vec2 uWindDir; uniform vec3 uCam; uniform float uRain; varying float vA;
        void main(){ float B = 24.0, H = 14.0; float y = mod(seed.y * H - uTime * (8.0 + seed.z * 3.0), H);
          vec3 p = vec3(uCam.x + (fract(seed.x - uCam.x / B) - 0.5) * B, uCam.y - 4.0 + y, uCam.z + (fract(seed.z * 7.13 - uCam.z / B) - 0.5) * B);
          vec2 slant = uWindDir * uWind * 0.35; p.xz += slant * (position.y * 0.38); p.y += position.y * 0.38;
          vA = step(seed.z, uRain) * 0.55 * smoothstep(0.0, 2.0, y); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `varying float vA; void main(){ if (vA <= 0.0) discard; gl_FragColor = vec4(0.78, 0.84, 0.9, vA); }` }));
    const rain = new THREE.LineSegments(g, m); rain.frustumCulled = false; rain.name = "rain"; group.add(rain); }

  // ── ground mist: big soft points drifting slowly at knee height
  { const n = Math.round(110 * q), pos = new Float32Array(n * 3), sd = new Float32Array(n * 4); for (let i = 0; i < n; i++) { const a = R() * 6.3, r = Math.sqrt(R()) * radius * 0.7; pos.set([Math.cos(a) * r, 0.2 + R() * 1.4, Math.sin(a) * r], i * 3); sd.set([R(), R(), R(), R()], i * 4); }
    const g = own(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(sd, 4));
    const m = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: uni({ uTex: { value: own(softDot(128)) } }),
      vertexShader: `attribute vec4 seed; uniform float uTime; uniform vec2 uWindDir; uniform float uMist; varying float vA;
        void main(){ vec3 p = position; p.xz += uWindDir * mod(uTime * (0.08 + seed.x * 0.1) + seed.y * 40.0, 40.0) - uWindDir * 20.0; p.y += sin(uTime * 0.2 + seed.z * 6.0) * 0.15;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (600.0 + seed.w * 500.0) / max(-mv.z, 1.0); vA = uMist * 0.11 * smoothstep(0.5, 3.0, -mv.z); }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uMistColor; varying float vA; void main(){ float t = texture2D(uTex, gl_PointCoord).a; if (vA * t < 0.003) discard; gl_FragColor = vec4(uMistColor, vA * t); }` }));
    const mist = new THREE.Points(g, m); mist.frustumCulled = false; mist.name = "mist"; mist.renderOrder = 2; group.add(mist); }

  // ── light shafts: long open cones from canopy gaps, additive, brighter in fog — one always lands near the plot
  { const n = Math.round(9 * q) || 3, cone = own(new THREE.CylinderGeometry(0.6, 1.7, 26, 20, 1, true)); cone.translate(0, -13, 0);
    const m = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: uni(),
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y / 26.0; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uRays; uniform float uTime; varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ float edge = pow(abs(dot(vN, vV)), 1.8); float a = uRays * 0.085 * edge * smoothstep(0.0, 0.25, vY) * smoothstep(1.0, 0.55, vY) * (0.85 + 0.15 * sin(uTime * 0.7 + vY * 6.0)); gl_FragColor = vec4(1.0, 0.95, 0.78, a); }` }));
    for (let i = 0; i < n; i++) { const r = i === 0 ? 0.6 : 3 + R() * radius * 0.45, a = R() * 6.3, s = new THREE.Mesh(cone, m); s.position.set(Math.cos(a) * r, 24, Math.sin(a) * r); s.name = "ray"; s.userData.ray = true; s.scale.setScalar(0.6 + R() * 0.8); s.frustumCulled = false; group.add(s); }
    group.userData.rays = group.children.filter((c) => c.userData.ray); }

  // ── fireflies (dusk / night)
  { const n = Math.round(160 * q), pos = new Float32Array(n * 3), sd = new Float32Array(n * 4); for (let i = 0; i < n; i++) { const a = R() * 6.3, r = Math.sqrt(R()) * Math.max(plot.hw, plot.hd) * 3 + 0.5; pos.set([Math.cos(a) * r, 0.3 + R() * 2.2, Math.sin(a) * r], i * 3); sd.set([R(), R(), R(), R()], i * 4); }
    const g = own(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(sd, 4));
    const m = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: uni({ uTex: { value: own(softDot(64)) } }),
      vertexShader: `attribute vec4 seed; uniform float uTime; uniform float uFire; uniform float uNight; varying float vA;
        void main(){ vec3 p = position + vec3(sin(uTime * 0.6 + seed.x * 20.0), sin(uTime * 0.9 + seed.y * 20.0) * 0.4, cos(uTime * 0.5 + seed.z * 20.0)) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 70.0 / max(-mv.z, 0.5);
          vA = uFire * max(uNight, 0.15) * (0.5 + 0.5 * sin(uTime * (1.5 + seed.w * 2.5) + seed.x * 30.0)); }`,
      fragmentShader: `uniform sampler2D uTex; varying float vA; void main(){ float t = texture2D(uTex, gl_PointCoord).a; if (vA * t < 0.01) discard; gl_FragColor = vec4(0.85, 1.0, 0.45, vA * t); }` }));
    const ff = new THREE.Points(g, m); ff.frustumCulled = false; ff.name = "fireflies"; group.add(ff); }

  // ── falling leaves: small quads tumbling down, recycled at the top
  { const n = Math.round(260 * q), base = own(new THREE.PlaneGeometry(0.09, 0.14)), g = own(new THREE.InstancedBufferGeometry()); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv; g.instanceCount = n;
    const sd = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) sd[i] = R(); g.setAttribute("seed", new THREE.InstancedBufferAttribute(sd, 4));
    const m = own(new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, uniforms: uni({ uR: { value: Math.max(plot.hw, plot.hd) * 2.5 + 3 } }),
      vertexShader: `attribute vec4 seed; uniform float uTime; uniform float uWind; uniform vec2 uWindDir; uniform float uLeaves; uniform float uR; varying float vA; varying vec2 vUv; varying float vT;
        mat3 rot(vec3 a, float t){ a = normalize(a); float s = sin(t), c = cos(t), o = 1.0 - c; return mat3(o*a.x*a.x+c, o*a.x*a.y+a.z*s, o*a.z*a.x-a.y*s, o*a.x*a.y-a.z*s, o*a.y*a.y+c, o*a.y*a.z+a.x*s, o*a.z*a.x+a.y*s, o*a.y*a.z-a.x*s, o*a.z*a.z+c); }
        void main(){ float H = 12.0, y = mod(seed.y * H - uTime * (0.5 + seed.z * 0.4), H); vec3 c = vec3((seed.x - 0.5) * 2.0 * uR, y, (seed.w - 0.5) * 2.0 * uR);
          c.xz += uWindDir * uWind * (H - y) * 0.3 + vec2(sin(uTime * 1.3 + seed.x * 40.0), cos(uTime * 1.1 + seed.w * 40.0)) * 0.4;
          vec3 p = rot(vec3(seed.x, seed.y, seed.z) - 0.5, uTime * (1.5 + seed.w * 2.0) + seed.x * 10.0) * position; vUv = uv; vT = seed.z;
          vA = step(seed.w, uLeaves) * smoothstep(0.0, 0.3, y); gl_Position = projectionMatrix * viewMatrix * vec4(c + p, 1.0); }`,
      fragmentShader: `varying float vA; varying vec2 vUv; varying float vT; void main(){ vec2 d = vUv - 0.5; if (vA <= 0.0 || dot(d * vec2(1.6, 1.0), d * vec2(1.6, 1.0)) > 0.25) discard; vec3 col = mix(vec3(0.55, 0.38, 0.12), vec3(0.42, 0.55, 0.16), vT); gl_FragColor = vec4(col * 0.8, vA); }` }));
    const lv = new THREE.Mesh(g, m); lv.frustumCulled = false; lv.name = "leaves"; group.add(lv); }

  // ── snowfall (shared with the asset shaders' snow cover)
  const snow = createSnowfall(THREE, U, Math.round(5000 * q), Math.max(14, Math.max(plot.hw, plot.hd) * 4)); own(snow.geometry); own(snow.material); snow.position.y = 0; group.add(snow);

  const api = {
    group, uniforms: F,
    set(o) { if ("rain" in o) F.uRain.value = +o.rain; if ("mist" in o) F.uMist.value = +o.mist; if ("rays" in o) F.uRays.value = +o.rays; if ("fireflies" in o) F.uFire.value = +o.fireflies; if ("leaves" in o) F.uLeaves.value = +o.leaves; if ("night" in o) F.uNight.value = +o.night; if ("snow" in o) U.uSnow.value = +o.snow; },
    setMistColor(c) { F.uMistColor.value.set(c); },
    // light shafts lean with the sun
    setSun(dir) { F.uSunDir.value.copy(dir); const q2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); for (const r of group.userData.rays || []) r.quaternion.copy(q2); },
    update(cam) { F.uCam.value.copy(cam.position); const sf = group.getObjectByName("nooi_snowfall"); if (sf) { sf.visible = U.uSnow.value > 0.01; sf.position.x = Math.round(cam.position.x / 4) * 4; sf.position.z = Math.round(cam.position.z / 4) * 4; }
      for (const n of group.children) { if (n.name === "rain") n.visible = F.uRain.value > 0.01; else if (n.name === "mist") n.visible = F.uMist.value > 0.01; else if (n.userData.ray) n.visible = F.uRays.value > 0.01; else if (n.name === "fireflies") n.visible = F.uFire.value > 0.01; else if (n.name === "leaves") n.visible = F.uLeaves.value > 0.01; } },
    dispose() { for (const o of owned) { try { o.dispose(); } catch (e) {} } group.clear(); },
  };
  return api;
}

// ───────────── ambience: Web Audio, synthesized (no files) ─────────────
export function createAmbience() {
  let ctx = null, master, dest, nodes = {}, timer = 0; const st = { on: false, rain: 0, wind: 0.3, kind: "jungle", night: 0 };
  function noise(sec = 2) { const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.start(); return s; }
  function band(type, f, q, g0) { const f1 = ctx.createBiquadFilter(); f1.type = type; f1.frequency.value = f; f1.Q.value = q; const g = ctx.createGain(); g.gain.value = g0; noise().connect(f1); f1.connect(g); g.connect(master); return g; }
  function boot() { if (ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination); dest = ctx.createMediaStreamDestination ? ctx.createMediaStreamDestination() : null; if (dest) master.connect(dest);
    nodes.rain = band("bandpass", 1400, 0.6, 0); nodes.wind = band("lowpass", 380, 0.7, 0); nodes.surf = band("lowpass", 600, 0.5, 0); nodes.insects = band("bandpass", 6800, 8, 0);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.12; lfo.connect(lg); lg.connect(nodes.surf.gain); lfo.start(); }
  function chirp() { if (!ctx || !st.on) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = 2200 + Math.random() * 2600; o.type = "sine"; o.frequency.setValueAtTime(f, t);
    const n = 2 + (Math.random() * 4 | 0); for (let i = 0; i < n; i++) { o.frequency.linearRampToValueAtTime(f * (1.25 + Math.random() * 0.3), t + i * 0.12 + 0.05); o.frequency.linearRampToValueAtTime(f, t + i * 0.12 + 0.1); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * (1 - st.rain), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + n * 0.12 + 0.1); o.connect(g); g.connect(master); o.start(t); o.stop(t + n * 0.12 + 0.15); }
  function apply() { if (!ctx) return; const t = ctx.currentTime, k = st.kind; master.gain.setTargetAtTime(st.on ? 0.9 : 0, t, 0.3);
    nodes.rain.gain.setTargetAtTime(st.rain * 0.55, t, 0.4); nodes.wind.gain.setTargetAtTime((k === "wind" ? 0.5 : 0.2) * st.wind, t, 0.4); nodes.surf.gain.setTargetAtTime(k === "waves" ? 0.3 : 0, t, 0.4);
    nodes.insects.gain.setTargetAtTime((k === "jungle" || k === "meadow") ? 0.01 + 0.03 * st.night : 0, t, 0.4);
    clearInterval(timer); if (st.on && (k === "jungle" || k === "forest" || k === "meadow")) timer = setInterval(() => { if (Math.random() < (st.night ? 0.15 : 0.55)) chirp(); }, 700); }
  return {
    set(o) { Object.assign(st, o); if (st.on) boot(); if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {}); apply(); },
    get on() { return st.on; },
    stream() { return dest ? dest.stream : null; },
    dispose() { clearInterval(timer); if (ctx) ctx.close().catch(() => {}); ctx = null; },
  };
}
