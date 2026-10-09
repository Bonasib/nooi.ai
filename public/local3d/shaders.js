// nooi.ai · On-device 3D — GPU shaders.
//   RECON_WGSL      WebGPU compute shader: depth + distance field → closed mesh (front & back surfaces) + normals
//   applyEnvironmentShaders()  patches any three.js MeshStandardMaterial with
//                      • wind  — vertex sway that grows with height, gusts from time + position (Wind Speed slider)
//                      • snow  — accumulation on upward-facing normals: colour, roughness and a little thickness (Snow slider)
//   createSnowfall()  falling snow particles blown by the same wind
//   createSkyDome()   procedural HDR sky (sun, horizon glow) — rendered into a PMREM environment for reflections & light
// All of it runs on the visitor's GPU; nothing is sent anywhere.

// One invocation per grid cell. Inputs: normalised depth (0 = far … 1 = near, < 0 = outside the subject) and the distance
// to the subject's edge (in cells). Front surface = depth relief rounded at the edges; back surface = a smooth inflated
// shell meeting the front exactly at the silhouette, so the model is closed and can be seen from every side.
export const RECON_WGSL = /* wgsl */ `
struct Params { gw: u32, gh: u32, thickness: f32, relief: f32, round: f32, maxd: f32, cell: f32, back: f32 };
@group(0) @binding(0) var<storage, read> depth: array<f32>;
@group(0) @binding(1) var<storage, read> dist: array<f32>;
@group(0) @binding(2) var<storage, read_write> front: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> backp: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> nrm: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> P: Params;

fn profile(i: u32) -> f32 { return sqrt(clamp(dist[i] / max(P.round, 1.0), 0.0, 1.0)); }
fn heightAt(x: i32, y: i32) -> f32 {
  let cx = clamp(x, 0, i32(P.gw) - 1); let cy = clamp(y, 0, i32(P.gh) - 1); let i = u32(cy) * P.gw + u32(cx);
  let d = depth[i]; if (d < 0.0) { return 0.0; }
  return P.thickness * (P.relief * d + (1.0 - P.relief)) * profile(i);
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; if (i >= P.gw * P.gh) { return; }
  let x = i32(i % P.gw); let y = i32(i / P.gw);
  let px = (f32(x) - f32(P.gw) * 0.5) * P.cell; let py = (f32(P.gh) * 0.5 - f32(y)) * P.cell;
  if (depth[i] < 0.0) { front[i] = vec4<f32>(px, py, 0.0, 0.0); backp[i] = vec4<f32>(px, py, 0.0, 0.0); nrm[i] = vec4<f32>(0.0, 0.0, 1.0, 0.0); return; }
  let zf = heightAt(x, y);
  let zb = -P.back * P.thickness * profile(i);
  front[i] = vec4<f32>(px, py, zf * P.cell, 1.0);
  backp[i] = vec4<f32>(px, py, zb * P.cell, 1.0);
  // central differences → surface normal of the front relief
  let dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * 0.5;
  let dy = (heightAt(x, y - 1) - heightAt(x, y + 1)) * 0.5;
  nrm[i] = vec4<f32>(normalize(vec3<f32>(-dx, -dy, 1.0)), 1.0);
}`;

// Shared uniforms (one object for every material, the snowfall and the sky)
export function createEnvUniforms(THREE) {
  return { uTime: { value: 0 }, uWind: { value: 0.35 }, uWindDir: { value: new THREE.Vector2(1, 0.3).normalize() }, uSnow: { value: 0 },
    uHeight: { value: new THREE.Vector2(0, 1) }, uSnowColor: { value: new THREE.Color(0.96, 0.97, 1.0) }, uUpView: { value: new THREE.Vector3(0, 1, 0) } };
}

const WIND_VERT = /* glsl */ `
  // ── nooi wind: sway grows with height above the model's base, two waves + a slow gust
  float nh = clamp((position.y - uHeight.x) / max(uHeight.y - uHeight.x, 1e-3), 0.0, 1.0);
  float gust = 0.65 + 0.35 * sin(uTime * 0.6 + position.x * 0.7);
  float wave = sin(uTime * 1.9 + position.x * 2.3 + position.z * 1.7) * 0.6 + sin(uTime * 3.7 + position.y * 5.0) * 0.25;
  float sway = uWind * gust * wave * pow(nh, 1.6) * 0.09 * (uHeight.y - uHeight.x);
  transformed.xz += uWindDir * sway;
  transformed.y -= abs(sway) * 0.15 * nh;
  // ── nooi snow: a thin layer builds up on surfaces that face the sky
  float upFacing = smoothstep(0.25, 0.9, objectNormal.y);
  transformed += objectNormal * uSnow * upFacing * 0.012 * (uHeight.y - uHeight.x);
  vSnowPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const SNOW_FRAG = /* glsl */ `
  // ── nooi snow: white, rough cover on up-facing normals with a little noise so it isn't uniform
  {
    float upv = dot(normalize(normal), normalize(uUpView));
    float n = fract(sin(dot(floor(vSnowPos * 40.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float snowAmt = clamp(smoothstep(0.98 - uSnow * 0.75, 1.0 - uSnow * 0.25, upv) * (0.85 + 0.15 * n) * min(1.0, uSnow * 1.6), 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, snowAmt);
    roughnessFactor = mix(roughnessFactor, 0.92, snowAmt);
  }
`;
// Patch a three.js standard material in place. Keeps every built-in PBR feature (maps, env reflections, shadows).
export function applyEnvironmentShaders(material, U) {
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = "uniform float uTime; uniform float uWind; uniform vec2 uWindDir; uniform float uSnow; uniform vec2 uHeight; varying vec3 vSnowPos;\n" +
      sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n" + WIND_VERT);
    sh.fragmentShader = "uniform float uSnow; uniform vec3 uSnowColor; uniform vec3 uUpView; varying vec3 vSnowPos;\n" +
      sh.fragmentShader.replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + SNOW_FRAG);
  };
  material.customProgramCacheKey = () => "nooi-env-v1";
  material.needsUpdate = true;
  return material;
}

// Falling snow — one draw call; the vertex shader moves every flake (no CPU work per frame)
export function createSnowfall(THREE, U, count = 4000, area = 8) {
  const g = new THREE.BufferGeometry(), seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random(); }
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3)); g.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { ...U, uArea: { value: area }, uSize: { value: 5.5 } },
    vertexShader: /* glsl */ `attribute vec4 seed; uniform float uTime; uniform float uWind; uniform vec2 uWindDir; uniform float uSnow; uniform float uArea; uniform float uSize; varying float vA;
      void main() {
        float fall = 0.35 + seed.w * 0.45, h = uArea * 0.6;
        float y = mod(seed.y * h - uTime * fall, h);
        vec2 drift = uWindDir * uWind * (h - y) * 0.35 + vec2(sin(uTime * 1.3 + seed.x * 40.0), cos(uTime * 1.1 + seed.z * 40.0)) * 0.05;
        vec3 p = vec3((seed.x - 0.5) * uArea + drift.x, y, (seed.z - 0.5) * uArea + drift.y);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = min(uSize * (0.6 + seed.w) * (6.0 / max(-mv.z, 0.5)), 14.0);
        vA = step(seed.w, uSnow) * smoothstep(0.0, 0.4, y) * smoothstep(0.4, 1.2, -mv.z) * 0.9;
      }`,
    fragmentShader: /* glsl */ `varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25 || vA <= 0.0) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, vA * (1.0 - d * 4.0)); }` });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.name = "nooi_snowfall"; return p;
}

// Procedural HDR sky: physically-inspired gradient + sun disc and glow. Rendered once into a PMREM cube for image-based
// lighting & reflections; re-rendered when the sun moves (the "HDRI" stays live without downloading any file).
export function createSkyDome(THREE) {
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { uSun: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() }, uSunI: { value: 18.0 }, uZenith: { value: new THREE.Color(0.18, 0.36, 0.75) }, uHorizon: { value: new THREE.Color(0.85, 0.82, 0.78) }, uGround: { value: new THREE.Color(0.22, 0.2, 0.18) } },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: /* glsl */ `uniform vec3 uSun; uniform float uSunI; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir); float h = d.y;
        vec3 sky = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));
        vec3 col = h >= 0.0 ? sky : mix(uHorizon * 0.6, uGround, clamp(-h * 3.0, 0.0, 1.0));
        float s = max(dot(d, normalize(uSun)), 0.0), elev = clamp(uSun.y, 0.0, 1.0);
        vec3 warm = mix(vec3(1.0, 0.55, 0.3), vec3(1.0, 0.95, 0.88), elev);
        col += warm * (pow(s, 900.0) * uSunI + pow(s, 12.0) * 0.6 + pow(s, 3.0) * 0.12) ;
        col *= mix(0.35, 1.0, smoothstep(-0.1, 0.25, uSun.y));
        // tone-map + encode like a built-in material: the PMREM target is RGBE in three r128, so writing raw alpha = 1
        // there decodes as 2^127 → NaN lighting (a black model). linearToOutputTexel matches whatever target is bound.
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        gl_FragColor = linearToOutputTexel(gl_FragColor);
      }` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), m); mesh.name = "nooi_sky"; return mesh;
}
