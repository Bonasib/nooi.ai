// The compositor's shaders (WebGL2 / GLSL ES 3.0). One pass per layer: the layer is placed (crop, transform), coloured
// (adjustments, LUT, effects), shaped by its transition, then blended over what is below (read from the other buffer).
export const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

import { EFFECTS, TRANSITIONS } from "@nooi/editor-core";
export const FS_ACC = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform float uW; out vec4 o;
void main(){ o = texture(uTex, vUv) * uW; }`;
export const FS_COPY = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform bool uFlipY; out vec4 o;
void main(){ vec2 uv = uFlipY ? vec2(vUv.x, 1.0 - vUv.y) : vUv; o = texture(uTex, uv); }`;

export const BLENDS = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "add", "difference", "softLight", "hardLight", "colorDodge", "colorBurn"];
// (v278) the effect and transition lists come from the catalogue, in its order; the shader gets a #define for each (FX_<id>, TR_<id>)
export const TRANS = TRANSITIONS.map((x) => x.id);
export const FX = EFFECTS.map((x) => x.id);
export const NFX = 96;   // effect slots (packed four to a vec4)
const DEFS = FX.map((id, i) => `#define FX_${id} ${i}`).concat(TRANS.map((id, i) => `#define TR_${id} ${i}`)).join("\n");

// (v278) two builds of the layer shader: the full one, and a light one where the new effects, transitions, curves and wheels are
// compiled out (picked for a layer that uses none of them) — so ordinary edits cost what they did before
const FULL = `#define N78 (uFx278 > 0)\n#define T78 (uTrRole >= 0 && uTr >= 34)\n#define C78 (uCurveOn > 0)\n#define W78 (uWheelOn > 0)\n#define F(i) uFxV[(i)/4][(i)%4]`;
const LIGHT = `#define N78 false\n#define T78 false\n#define C78 false\n#define W78 false\n#define F(i) ((i) < 24 ? uFxV[(i)/4][(i)%4] : 0.0)`;
export const FS_LAYER = layerSrc(FULL);
export const FS_LAYER_LIGHT = layerSrc(LIGHT);
function layerSrc(MODE: string) { return `#version 300 es
precision highp float; precision highp sampler3D;
${DEFS}
${MODE}
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform sampler2D uDst; uniform sampler3D uLut;
uniform vec2 uFrame;          // output size (px)
uniform vec2 uSrcSize;        // source size (px)
uniform mat3 uInv;            // output px (centred) -> source px (centred)
uniform vec4 uCrop;           // l t r b (fractions)
uniform float uOpacity; uniform int uBlend; uniform float uTime;
uniform vec4 uC1;             // exposure contrast saturation temperature
uniform vec4 uC2;             // tint highlights shadows vibrance
uniform vec3 uHsl[8];
uniform float uLutAmt; uniform float uLutSize;
uniform vec4 uFxV[24];        // effect amounts (0 = off), order = FX, four to a vec4
uniform float uCurve[20];     // (v278) curves: master, red, green, blue — five points each (at 0, ¼, ½, ¾, 1)
uniform int uCurveOn; uniform int uFx278; uniform int uWheelOn;   // (v278) any of the new effects on · colour wheels on
uniform vec3 uLift; uniform vec3 uGamma; uniform vec3 uGain;   // (v278) colour wheels
uniform vec4 uBox;            // the blur / pixelate box on the clip picture: x, y (from the top-left), w, h — fractions
uniform int uTr; uniform float uTrK; uniform int uTrRole;   // transition type, progress, 0 = outgoing 1 = incoming (-1 none)
uniform bool uSrcFlipY;
uniform vec4 uKey;            // (v234) the colour key: rgb, on
uniform vec4 uKeyP;           // similarity, softness, spill, screen (1 green, 2 blue, 0 other)
uniform int uStack;           // (v234) a cut-out: the picture on the top half, its mask (grey) below
uniform float uTexH;          // the whole source's height (px)
uniform bool uPremul;         // (v277) the source is a picture of this compositor (colours multiplied by their alpha)
uniform sampler2D uMatte;     // (v277) track matte: the layer above, drawn alone (frame space, premultiplied)
uniform vec2 uMatteM;         // mode (0 none, 1 alpha, 2 luma), invert
uniform vec4 uCm; uniform vec4 uCm2; uniform vec4 uCm3;   // (v277) colour mask: hue range soft on · hue-shift sat exposure invert · show minSat
uniform vec4 uPano;           // (v277) 360°: yaw pitch roll (radians), fov (radians; 0 = off)

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
vec2 gUv; float gCut = 1.0;       // (v278) the output pixel (0..1, y up) and a cut for pictures moved off their own place
mat2 rot2(float a){ return mat2(cos(a), -sin(a), sin(a), cos(a)); }
float eo(float k){ return 1.0 - pow(1.0 - clamp(k, 0.0, 1.0), 3.0); }
float bounceOut(float k){ k = clamp(k, 0.0, 1.0); if (k < 1.0 / 2.75) return 7.5625 * k * k; if (k < 2.0 / 2.75) { k -= 1.5 / 2.75; return 7.5625 * k * k + 0.75; } if (k < 2.5 / 2.75) { k -= 2.25 / 2.75; return 7.5625 * k * k + 0.9375; } k -= 2.625 / 2.75; return 7.5625 * k * k + 0.984375; }
// (v278) the distort effects, in frame space (u: 0..1, y up)
vec2 distort(vec2 u){
  if (!N78) return u;
  float asp = uFrame.x / uFrame.y; float a;
  a = F(FX_kaleido); if (a > 0.0) { vec2 d = (u - 0.5) * vec2(asp, 1.0); float r = length(d), an = atan(d.y, d.x), sg = 3.14159265 / 3.0; an = mod(an, sg); an = abs(an - sg * 0.5); d = r * vec2(cos(an), sin(an)); u = 0.5 + d / vec2(asp, 1.0); }
  a = F(FX_quad); if (a > 0.0) u = fract(u * 2.0);
  a = F(FX_split3); if (a > 0.0) u.x = fract(u.x * 3.0) / 3.0 + 1.0 / 3.0;
  a = F(FX_fisheye); if (a > 0.0) { vec2 d = u - 0.5; vec2 da = d * vec2(asp, 1.0); u = 0.5 + d * (1.0 + a * 1.1 * dot(da, da)) / (1.0 + a * 0.35); }
  a = F(FX_bulge); if (a > 0.0) { vec2 d = (u - 0.5) * vec2(asp, 1.0); float r = length(d); d *= mix(1.0, smoothstep(0.0, 0.45, r), a * 0.6); u = 0.5 + d / vec2(asp, 1.0); }
  a = F(FX_pinch); if (a > 0.0) { vec2 d = (u - 0.5) * vec2(asp, 1.0); float r = length(d); d *= 1.0 + a * 0.6 * (1.0 - smoothstep(0.0, 0.45, r)); u = 0.5 + d / vec2(asp, 1.0); }
  a = F(FX_twirl); if (a > 0.0) { vec2 d = (u - 0.5) * vec2(asp, 1.0); float r = length(d); d = rot2(a * 3.0 * (1.0 - smoothstep(0.0, 0.5, r))) * d; u = 0.5 + d / vec2(asp, 1.0); }
  a = F(FX_ripple); if (a > 0.0) { vec2 d = (u - 0.5) * vec2(asp, 1.0); float r = length(d) + 1e-4; u += (d / r) / vec2(asp, 1.0) * sin(r * 40.0 - uTime * 6.0) * 0.008 * a; }
  a = F(FX_wave); if (a > 0.0) u.x += sin(u.y * 20.0 + uTime * 3.0) * 0.012 * a;
  a = F(FX_zoomPulse); if (a > 0.0) u = 0.5 + (u - 0.5) / (1.0 + a * 0.08 * (0.5 + 0.5 * sin(uTime * 12.566)));
  a = F(FX_heatHaze); if (a > 0.0) u += (vec2(vnoise(u * 18.0 + vec2(0.0, uTime * 2.0)), vnoise(u * 18.0 - vec2(uTime * 2.0, 0.0))) - 0.5) * 0.008 * a;
  a = F(FX_underwater); if (a > 0.0) u += vec2(sin(u.y * 15.0 + uTime * 1.5), cos(u.x * 12.0 + uTime * 1.3)) * 0.007 * a;
  a = F(FX_jitter); if (a > 0.0) u += (vec2(hash(vec2(floor(uTime * 12.0), 3.0)), hash(vec2(floor(uTime * 12.0), 5.0))) - 0.5) * 0.012 * a;
  a = F(FX_crt); if (a > 0.0) { vec2 d = u - 0.5; u = 0.5 + d * (1.0 + a * 0.12 * dot(d, d) * 4.0); if (u.x < 0.0 || u.y < 0.0 || u.x > 1.0 || u.y > 1.0) gCut = 0.0; }
  return u;
}
// (v278) the transitions that move or bend the picture (frame space; out-of-frame parts are cut)
vec2 trPlace(vec2 u){
  if (!T78) return u;
  float k = uTrK, e = smoothstep(0.0, 1.0, k); bool inc = uTrRole == 1; float asp = uFrame.x / uFrame.y;
  if (uTr == TR_cubeL) { if (!inc) u.x = u.x / max(1.0 - k, 1e-3); else u.x = (u.x - (1.0 - k)) / max(k, 1e-3); }
  else if (uTr == TR_cubeR) { if (!inc) u.x = (u.x - k) / max(1.0 - k, 1e-3); else u.x = u.x / max(k, 1e-3); }
  else if (uTr == TR_flipH) { float sc = !inc ? 1.0 - 2.0 * k : 2.0 * k - 1.0; u.x = 0.5 + (u.x - 0.5) / max(sc, 1e-3); }
  else if (uTr == TR_flipV) { float sc = !inc ? 1.0 - 2.0 * k : 2.0 * k - 1.0; u.y = 0.5 + (u.y - 0.5) / max(sc, 1e-3); }
  else if (uTr == TR_splitV && !inc) { bool L = u.x < 0.5; u.x += L ? k * 0.5 : -k * 0.5; if (L != (u.x < 0.5)) gCut = 0.0; }
  else if (uTr == TR_splitH && !inc) { bool B = u.y < 0.5; u.y += B ? k * 0.5 : -k * 0.5; if (B != (u.y < 0.5)) gCut = 0.0; }
  else if (uTr == TR_linesT && inc) { float band = floor(u.y * 12.0); u.x += (mod(band, 2.0) < 0.5 ? 1.0 : -1.0) * (1.0 - eo(k)); }
  else if (uTr == TR_bounceIn && inc) u.y -= (1.0 - bounceOut(k));
  else if (uTr == TR_stackUp) { if (inc) u.y += 1.0 - eo(k); else u = 0.5 + (u - 0.5) / (1.0 - 0.15 * k); }
  else if (uTr == TR_page && inc) u.x -= 1.0 - eo(k);
  else if (uTr == TR_swirl) { vec2 d = (u - 0.5) * vec2(asp, 1.0); float r = length(d); d = rot2(sin(k * 3.14159) * 3.0 * (1.0 - smoothstep(0.0, 0.6, r))) * d; u = 0.5 + d / vec2(asp, 1.0); }
  else if (uTr == TR_rippleT) { vec2 d = (u - 0.5) * vec2(asp, 1.0); float r = length(d) + 1e-4; u += (d / r) / vec2(asp, 1.0) * sin(r * 40.0 - k * 20.0) * 0.02 * sin(k * 3.14159); }
  else if (uTr == TR_crossWarp) { vec2 d = u - 0.5; float w = (inc ? 1.0 - k : k) * 0.6 * (1.0 - length(d)); u = 0.5 + d / (1.0 + w); }
  else if (uTr == TR_shakeT) u += (vec2(hash(vec2(floor(k * 40.0), 1.0)), hash(vec2(floor(k * 40.0), 2.0))) - 0.5) * 0.06 * sin(k * 3.14159);
  if (u.x < -1e-4 || u.y < -1e-4 || u.x > 1.0001 || u.y > 1.0001) gCut = 0.0;
  return u;
}
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0., -1./3., 2./3., -1.); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6. * d + 1e-10)), d / (q.x + 1e-10), q.x); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1., 2./3., 1./3.)) * 6. - 3.); return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y); }

// where the output pixel falls in the source (0..1), with the transition's movement
vec2 place(vec2 uv){
  vec2 px = (uv - 0.5) * uFrame;
  if (uPano.w > 0.0) {
    float t = tan(uPano.w * 0.5); vec2 q = vec2((uv.x - 0.5) * 2.0 * t * uFrame.x / uFrame.y, (uv.y - 0.5) * 2.0 * t);
    vec3 d = normalize(vec3(q, 1.0));
    float cr = cos(uPano.z), sr = sin(uPano.z); d.xy = mat2(cr, sr, -sr, cr) * d.xy;
    float cp = cos(uPano.y), sp = sin(uPano.y); d.yz = mat2(cp, -sp, sp, cp) * d.yz;
    float cy = cos(uPano.x), sy = sin(uPano.x); d.xz = mat2(cy, -sy, sy, cy) * d.xz;
    return vec2(fract(atan(d.x, d.z) / 6.2831853 + 0.5), clamp(asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5, 0.0, 1.0));
  }
  uv = trPlace(distort(uv)); px = (uv - 0.5) * uFrame;
  if (T78) {
    float k = uTrK, e = smoothstep(0.0, 1.0, k); bool inc = uTrRole == 1;
    if (uTr == TR_crossZoom) px /= 1.0 + (inc ? 1.0 - k : k) * 0.4;
    if (uTr >= TR_whipL && uTr <= TR_whipD) { vec2 d = uTr == TR_whipL ? vec2(1,0) : uTr == TR_whipR ? vec2(-1,0) : uTr == TR_whipU ? vec2(0,-1) : vec2(0,1); px -= d * uFrame * (inc ? 1.0 - e : -e); }
    if (uTr == TR_rotateIn && inc) px = rot2((1.0 - e) * 1.5708) * px / (0.6 + 0.4 * e);
    if (uTr == TR_zoomSpin && inc) px = rot2((1.0 - e) * 3.14159) * px / max(e, 0.02);
    if (uTr == TR_zoomThrough) px /= inc ? 0.3 + 0.7 * k : 1.0 + k * 3.0;
  }
  if (uTrRole >= 0) {
    float k = uTrK; float s = uTrRole == 1 ? 1.0 - k : -k;   // incoming comes in; outgoing goes out
    if (uTr >= 18 && uTr <= 21 && uTrRole == 1) { vec2 d = uTr == 18 ? vec2(1,0) : uTr == 19 ? vec2(-1,0) : uTr == 20 ? vec2(0,-1) : vec2(0,1); px -= d * uFrame * s; }
    if (uTr >= 22 && uTr <= 25) { vec2 d = uTr == 22 ? vec2(1,0) : uTr == 23 ? vec2(-1,0) : uTr == 24 ? vec2(0,-1) : vec2(0,1); px -= d * uFrame * s; }
    if (uTr == 26) { float z = uTrRole == 0 ? 1.0 + k * 0.6 : 1.0 + (1.0 - k) * 0.3; px /= z; }
    if (uTr == 27) { float z = uTrRole == 1 ? 1.0 + (1.0 - k) * 0.8 : 1.0 - k * 0.3; px /= z; }
    if (uTr == 28) { float a = (uTrRole == 0 ? k : -(1.0 - k)) * 3.14159; float z = 1.0 + sin(k * 3.14159) * 0.6; px = mat2(cos(a), -sin(a), sin(a), cos(a)) * px * z; }
    if (uTr == 32) { float b = max(1.0, sin(k * 3.14159) * 48.0); px = floor(px / b) * b + b * 0.5; }
  }
  if (F(15) > 0.0) px += vec2(hash(vec2(uTime, 1.0)) - 0.5, hash(vec2(uTime, 2.0)) - 0.5) * F(15) * 0.04 * uFrame.y;
  vec3 s = uInv * vec3(px, 1.0);
  vec2 suv = s.xy / uSrcSize + 0.5;
  return suv;
}
vec4 tap(vec2 suv){
  // GL works y-up; the source's first row is its top, so the vertical is turned over here (crop: left top right bottom)
  vec2 q = vec2(suv.x, 1.0 - suv.y);
  vec2 c = vec2(uCrop.x + q.x * (1.0 - uCrop.x - uCrop.z), uCrop.y + q.y * (1.0 - uCrop.y - uCrop.w));
  if (uSrcFlipY) c.y = 1.0 - c.y;
  if (uStack == 1) { float e = 0.5 / max(uTexH, 2.0); vec2 t = vec2(c.x, clamp(c.y * 0.5, e, 0.5 - e)); return vec4(texture(uSrc, t).rgb, texture(uSrc, t + vec2(0.0, 0.5)).r); }
  return texture(uSrc, c);
}
// (v234) the colour key, measured as FFmpeg's chromakey does (the colour part of YUV), then the screen's colour taken out of the edges
vec2 uvOf(vec3 c){ return vec2(-0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b, 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b); }
vec4 keyed(vec4 c){
  if (uKey.w <= 0.0) return c;
  vec2 d = uvOf(c.rgb) - uvOf(uKey.rgb); float diff = sqrt(dot(d, d) / 2.0);
  c.a *= uKeyP.y > 0.0001 ? clamp((diff - uKeyP.x) / uKeyP.y, 0.0, 1.0) : step(uKeyP.x, diff);
  if (uKeyP.w == 1.0) c.g -= max(c.g - (c.r + c.b) * 0.5, 0.0) * uKeyP.z;
  else if (uKeyP.w == 2.0) c.b -= max(c.b - (c.r + c.g) * 0.5, 0.0) * uKeyP.z;
  return c;
}
float hexId(vec2 p){ vec2 r = vec2(1.0, 1.7320508); vec2 h = r * 0.5; vec2 a = mod(p, r) - h, b = mod(p - h, r) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b; vec2 id = p - g; return hash(floor(id * 10.0 + 0.5)); }
vec2 hexCenter(vec2 p){ vec2 r = vec2(1.0, 1.7320508); vec2 h = r * 0.5; vec2 a = mod(p, r) - h, b = mod(p - h, r) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b; return p - g; }
float edgeAt(vec2 suv, vec2 px1){
  float tl = luma(tap(suv + vec2(-px1.x, px1.y)).rgb), t = luma(tap(suv + vec2(0.0, px1.y)).rgb), tr = luma(tap(suv + px1).rgb);
  float l = luma(tap(suv - vec2(px1.x, 0.0)).rgb), r = luma(tap(suv + vec2(px1.x, 0.0)).rgb);
  float bl = luma(tap(suv - px1).rgb), b = luma(tap(suv - vec2(0.0, px1.y)).rgb), br = luma(tap(suv + vec2(px1.x, -px1.y)).rgb);
  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br, gy = -bl - 2.0 * b - br + tl + 2.0 * t + tr; return clamp(length(vec2(gx, gy)), 0.0, 1.0);
}
vec4 sampleSrc(vec2 suv){
  if (F(10) > 0.0) suv.x = suv.x > 0.5 ? 1.0 - suv.x : suv.x;
  bool n78 = N78, t78 = T78;
  if (n78 && F(FX_mirrorV) > 0.0 && suv.y < 0.5) suv.y = 1.0 - suv.y;
  // erase & blur a part: inside the box the picture is blurred or pixelated strongly (suv.y runs bottom → top)
  bool inBox = (F(22) > 0.0 || F(23) > 0.0) && suv.x >= uBox.x && suv.x <= uBox.x + uBox.z && 1.0 - suv.y >= uBox.y && 1.0 - suv.y <= uBox.y + uBox.w;
  float fxPix = F(6), fxBlur = F(0);
  if (inBox) { fxPix = max(fxPix, F(23) * 0.5); fxBlur = max(fxBlur, F(22) * 2.4); }
  float ts = n78 ? F(FX_tiltShift) : 0.0; if (ts > 0.0) fxBlur = max(fxBlur, ts * 1.2 * smoothstep(0.12, 0.42, abs(gUv.y - 0.5)));
  if (t78 && uTr == TR_dreamyT) fxBlur = max(fxBlur, sin(uTrK * 3.14159) * 0.9);
  if (fxPix > 0.0) { float b = mix(1.0, 64.0, fxPix) / uSrcSize.x; suv = floor(suv / b) * b + b * 0.5; }
  float hx = n78 ? F(FX_hexPixel) : 0.0; if (hx > 0.0) { float n = mix(80.0, 14.0, hx); vec2 sc = vec2(uSrcSize.x / uSrcSize.y, 1.0) * n; suv = hexCenter(suv * sc) / sc; }
  float dm = n78 ? F(FX_dotMatrix) : 0.0; vec2 dmf = vec2(0.5); if (dm > 0.0) { vec2 sc = vec2(uSrcSize.x / uSrcSize.y, 1.0) * 70.0; dmf = fract(suv * sc); suv = (floor(suv * sc) + 0.5) / sc; }
  float bg = (n78 ? F(FX_blockGlitch) : 0.0) + (t78 && uTr == TR_digital ? sin(uTrK * 3.14159) : 0.0);
  if (bg > 0.0) { vec2 bl = floor(suv * vec2(16.0, 24.0)); float h = hash(bl + floor(uTime * 8.0)); if (h > 0.82) suv.x += (hash(bl + 7.0) - 0.5) * 0.12 * bg; }
  if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) return vec4(0.0);
  vec4 c = tap(suv);
  vec2 px1 = 1.0 / uSrcSize;
  if (fxBlur > 0.0 || uTr == 4 && uTrRole >= 0) {
    float r = fxBlur * 10.0 + (uTr == 4 && uTrRole >= 0 ? sin(uTrK * 3.14159) * 14.0 : 0.0);
    vec4 acc = vec4(0.0); float w = 0.0;
    for (int i = -3; i <= 3; i++) for (int j = -3; j <= 3; j++) { vec2 d = vec2(float(i), float(j)) * r / 3.0 * px1; float ww = 1.0 / (1.0 + float(i*i + j*j)); acc += tap(clamp(suv + d, 0.0, 1.0)) * ww; w += ww; }
    c = acc / w;
  }
  if (n78 || t78) {
  // (v278) streak blurs: zoom, spin, sideways (also the cross-zoom and whip transitions)
  float zb = F(FX_zoomBlur) + (uTr == TR_crossZoom && uTrRole >= 0 ? sin(uTrK * 3.14159) * 0.8 : 0.0);
  float hb = F(FX_motionBlurH), vb = 0.0;
  if (uTrRole >= 0 && uTr >= TR_whipL && uTr <= TR_whipD) { float s = sin(uTrK * 3.14159); if (uTr <= TR_whipR) hb = max(hb, s); else vb = s; }
  float sb = F(FX_spinBlur);
  if (zb > 0.0 || hb > 0.0 || vb > 0.0 || sb > 0.0) {
    vec4 acc = vec4(0.0);
    for (int i = 0; i < 12; i++) { float f = float(i) / 11.0 - 0.5; vec2 q = suv;
      if (zb > 0.0) q = mix(q, vec2(0.5), f * 0.18 * zb + 0.09 * zb);
      if (hb > 0.0) q.x += f * 0.06 * hb; if (vb > 0.0) q.y += f * 0.06 * vb;
      if (sb > 0.0) q = vec2(0.5) + rot2(f * 0.12 * sb) * (q - 0.5);
      acc += tap(clamp(q, 0.0, 1.0)); }
    c = acc / 12.0;
  }
  }
  if (F(1) > 0.0) { vec4 n = tap(suv + vec2(px1.x, 0)) + tap(suv - vec2(px1.x, 0)) + tap(suv + vec2(0, px1.y)) + tap(suv - vec2(0, px1.y)); c.rgb = c.rgb + (c.rgb * 4.0 - n.rgb) * F(1) * 0.6; }
  if (F(4) > 0.0 || F(5) > 0.0 || F(11) > 0.0 || (uTr == 33 && uTrRole >= 0) || (uTr == TR_digital && uTrRole >= 0)) {
    float a = F(5) * 0.012 + F(4) * 0.02 * step(0.7, hash(vec2(floor(suv.y * 24.0), floor(uTime * 10.0)))) + F(11) * 0.006 + ((uTr == 33 || uTr == TR_digital) && uTrRole >= 0 ? sin(uTrK * 3.14159) * 0.03 : 0.0);
    float jx = F(4) > 0.0 ? (hash(vec2(floor(suv.y * 30.0), floor(uTime * 12.0))) - 0.5) * F(4) * 0.05 : 0.0;
    c.r = tap(clamp(suv + vec2(a + jx, 0), 0.0, 1.0)).r; c.b = tap(clamp(suv - vec2(a - jx, 0), 0.0, 1.0)).b;
  }
  if (n78 || t78) {
  float cl = F(FX_chromaLens); if (cl > 0.0) { vec2 d = suv - 0.5; float k = dot(d, d) * 0.06 * cl; c.r = tap(clamp(suv + d * k * 4.0, 0.0, 1.0)).r; c.b = tap(clamp(suv - d * k * 4.0, 0.0, 1.0)).b; }
  // glows: glow, bloom, halation, dreamy (one wide gather)
  float gl1 = F(12), gl2 = F(FX_bloom), gl3 = F(FX_halation), gl4 = F(FX_dreamy) + (uTr == TR_dreamyT && uTrRole >= 0 ? sin(uTrK * 3.14159) * 0.6 : 0.0);
  if (gl1 > 0.0 || gl2 > 0.0 || gl3 > 0.0 || gl4 > 0.0) { vec4 g = vec4(0.0); float rr = gl2 > 0.0 || gl4 > 0.0 ? 7.0 : 4.0;
    for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) g += tap(clamp(suv + vec2(float(i), float(j)) * rr * px1, 0.0, 1.0)); g /= 25.0;
    c.rgb += max(g.rgb - 0.55, 0.0) * gl1 * 2.0;
    c.rgb += max(g.rgb - 0.4, 0.0) * gl2 * 2.6;
    c.rgb += vec3(1.0, 0.25, 0.1) * max(luma(g.rgb) - 0.5, 0.0) * gl3 * 1.8;
    c.rgb = mix(c.rgb, max(c.rgb, g.rgb) * 1.08, clamp(gl4 * 0.6, 0.0, 1.0)); }
  // drawn looks: emboss, edges, sketch, cartoon, neon edges, oil, halftone, LED dots
  float emb = F(FX_emboss), edg = F(FX_edges), skt = F(FX_sketch), ctn = F(FX_cartoon), neo = F(FX_neonEdges);
  if (emb > 0.0) c.rgb = mix(c.rgb, vec3(0.5 + (luma(tap(clamp(suv - px1 * 1.5, 0.0, 1.0)).rgb) - luma(tap(clamp(suv + px1 * 1.5, 0.0, 1.0)).rgb)) * 2.5), emb);
  if (edg > 0.0 || skt > 0.0 || ctn > 0.0 || neo > 0.0) { float ed = edgeAt(suv, px1 * 1.5);
    if (edg > 0.0) c.rgb = mix(c.rgb, vec3(ed) * vec3(0.7, 1.0, 1.0) * 1.6, edg);
    if (skt > 0.0) c.rgb = mix(c.rgb, vec3(clamp(1.0 - ed * 1.8, 0.0, 1.0)) * vec3(1.0, 0.98, 0.94), skt);
    if (ctn > 0.0) { vec3 q = floor(c.rgb * 5.0 + 0.5) / 5.0; c.rgb = mix(c.rgb, q * (1.0 - smoothstep(0.25, 0.45, ed)), ctn); }
    if (neo > 0.0) c.rgb = mix(c.rgb, hsv2rgb(vec3(fract(gUv.x * 0.5 + gUv.y * 0.3 + uTime * 0.1), 1.0, 1.0)) * ed * 2.0 + c.rgb * 0.12, neo); }
  float oil = F(FX_oil); if (oil > 0.0) { vec3 best = c.rgb; float bv = 1e9;
    for (int q = 0; q < 4; q++) { vec2 o = vec2(q == 1 || q == 3 ? 1.0 : -1.0, q >= 2 ? 1.0 : -1.0); vec3 m = vec3(0.0), m2 = vec3(0.0);
      for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) { vec3 v = tap(clamp(suv + vec2(float(i), float(j)) * o * 1.6 * px1 * (1.0 + oil), 0.0, 1.0)).rgb; m += v; m2 += v * v; }
      m /= 16.0; vec3 vv = m2 / 16.0 - m * m; float sv = vv.r + vv.g + vv.b; if (sv < bv) { bv = sv; best = m; } }
    c.rgb = mix(c.rgb, best, oil); }
  float ht = F(FX_halftone); if (ht > 0.0) { float n = 90.0; vec2 sc = vec2(uSrcSize.x / uSrcSize.y, 1.0) * n; vec2 g = rot2(0.785) * (suv * sc);
    vec2 cc = (rot2(-0.785) * (floor(g) + 0.5)) / sc; float l = luma(tap(clamp(cc, 0.0, 1.0)).rgb); float r = sqrt(1.0 - l) * 0.62;
    float d = length(fract(g) - 0.5); c.rgb = mix(c.rgb, mix(vec3(0.07), vec3(0.97), smoothstep(r - 0.06, r + 0.06, d)), ht); }
  if (dm > 0.0) { float d = length(dmf - 0.5); c.rgb = mix(c.rgb, c.rgb * 1.25 * smoothstep(0.48, 0.32, d), dm); }
  } else if (F(12) > 0.0) { vec4 g = vec4(0.0); for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) g += tap(clamp(suv + vec2(float(i), float(j)) * 4.0 * px1, 0.0, 1.0)); g /= 25.0; c.rgb += max(g.rgb - 0.55, 0.0) * F(12) * 2.0; }
  return c;
}
// weather & light: drawn in the frame (uv: 0..1, y up), animated by uTime
float rainF(vec2 uv){ float s = 0.0; float asp = uFrame.x / uFrame.y;
  for (int i = 0; i < 3; i++) { float k = float(i) + 1.0; vec2 q = vec2(uv.x * asp * 70.0 * k + uv.y * 6.0, uv.y * 3.0 * k + uTime * (2.2 + k * 0.9));
    vec2 id = floor(q); float r = hash(id + k * 13.0); float f = fract(q.y); float x = fract(q.x);
    s += step(0.86, r) * smoothstep(0.5, 0.42, abs(x - 0.5)) * smoothstep(0.0, 0.15, f) * (1.0 - smoothstep(0.15, 0.9, f)) * (0.55 / k); }
  return s; }
float snowF(vec2 uv){ float s = 0.0; float asp = uFrame.x / uFrame.y;
  for (int i = 0; i < 3; i++) { float k = float(i); float sc = 7.0 + k * 6.0; vec2 q = vec2(uv.x * asp, uv.y) * sc; q.y += uTime * (0.6 + k * 0.3); q.x += sin(uTime * 0.8 + q.y * 0.7 + k) * 0.35;
    vec2 id = floor(q); vec2 f = fract(q) - 0.5; vec2 o = vec2(hash(id + 1.3 + k), hash(id + 2.7 + k)) - 0.5; float d = length(f - o * 0.6);
    s += step(0.45, hash(id + k * 7.0)) * smoothstep(0.11 - k * 0.025, 0.0, d); }
  return clamp(s, 0.0, 1.0); }
float sparkF(vec2 uv){ vec2 q = vec2(uv.x * uFrame.x / uFrame.y, uv.y) * 12.0; vec2 id = floor(q), f = fract(q) - 0.5; float r = hash(id + 3.1);
  if (r < 0.82) return 0.0; f -= (vec2(hash(id + 5.0), hash(id + 9.0)) - 0.5) * 0.5; float tw = pow(0.5 + 0.5 * sin(uTime * 3.5 + r * 60.0), 3.0);
  vec2 a = abs(f); float star = max(0.0, 1.0 - length(f) * 9.0) + max(0.0, 1.0 - a.x * 60.0) * max(0.0, 1.0 - a.y * 4.0) + max(0.0, 1.0 - a.y * 60.0) * max(0.0, 1.0 - a.x * 4.0);
  return star * tw; }
// (v278) curves: five points (0, ¼, ½, ¾, 1) per curve, Catmull-Rom between them
float cv(int k, float x){ x = clamp(x, 0.0, 1.0); float f = x * 4.0; int i = int(min(floor(f), 3.0)); float t = f - float(i);
  float p0 = uCurve[k * 5 + max(i - 1, 0)], p1 = uCurve[k * 5 + i], p2 = uCurve[k * 5 + i + 1], p3 = uCurve[k * 5 + min(i + 2, 4)];
  float t2 = t * t, t3 = t2 * t; return clamp(0.5 * (2.0 * p1 + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3), 0.0, 1.0); }
// a particle field: the cell's local position (x, y), and two random numbers per cell
vec4 cellP(vec2 uv, float sc, vec2 vel, float seed){ float asp = uFrame.x / uFrame.y; vec2 q = vec2(uv.x * asp, uv.y) * sc + vel * uTime; vec2 id = floor(q);
  vec2 f = fract(q) - 0.5; float r = hash(id + seed); vec2 o = (vec2(hash(id + seed + 1.7), hash(id + seed + 3.1)) - 0.5) * 0.5; return vec4(f - o, r, hash(id + seed + 5.3)); }
float heartF(vec2 p){ p.y = -p.y + 0.25; p *= 1.2; float a = p.x * p.x + p.y * p.y - 1.0; return a * a * a - p.x * p.x * p.y * p.y * p.y; }
vec3 grade(vec3 c, vec2 uv){
  c *= pow(2.0, uC1.x * 2.0);
  c = (c - 0.5) * (1.0 + uC1.y) + 0.5;
  c += vec3(uC1.w, 0.0, -uC1.w) * 0.12 + vec3(0.0, uC2.x * 0.1, 0.0);
  float l = luma(c);
  c += uC2.y * 0.25 * smoothstep(0.45, 1.0, l) + uC2.z * 0.25 * (1.0 - smoothstep(0.0, 0.55, l));
  float sat = 1.0 + uC1.z; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); sat += uC2.w * (1.0 - (mx - mn));
  c = mix(vec3(luma(c)), c, sat);
  vec3 h = rgb2hsv(clamp(c, 0.0, 1.0)); vec3 adj = vec3(0.0);
  for (int i = 0; i < 8; i++) { float center = float(i) / 8.0; float d = abs(h.x - center); d = min(d, 1.0 - d); float w = smoothstep(0.09, 0.0, d) * step(0.05, h.y); adj += uHsl[i] * w; }
  h.x = fract(h.x + adj.x * 0.1); h.y = clamp(h.y * (1.0 + adj.y), 0.0, 1.0); h.z = clamp(h.z * (1.0 + adj.z * 0.5), 0.0, 1.0); c = hsv2rgb(h);
  if (C78) { c = clamp(c, 0.0, 1.0); c = vec3(cv(0, c.r), cv(0, c.g), cv(0, c.b)); c = vec3(cv(1, c.r), cv(2, c.g), cv(3, c.b)); }
  if (W78) { c = c * (1.0 + uGain) + uLift * (1.0 - c); c = pow(max(c, 0.0), exp(-uGamma)); }
  if (uLutAmt > 0.0) { vec3 q = clamp(c, 0.0, 1.0); vec3 lc = (q * (uLutSize - 1.0) + 0.5) / uLutSize; c = mix(c, texture(uLut, lc).rgb, uLutAmt); }
  if (F(7) > 0.0) c = mix(c, vec3(luma(c)), F(7));
  if (F(8) > 0.0) { float y = luma(c); c = mix(c, vec3(y * 1.07, y * 0.74, y * 0.43) + vec3(0.08, 0.05, 0.0), F(8)); }
  if (F(9) > 0.0) c = mix(c, 1.0 - c, F(9));
  if (F(13) > 0.0) { float n = mix(16.0, 3.0, F(13)); c = floor(c * n) / n; }
  if (F(2) > 0.0) { float d = distance(uv, vec2(0.5)); c *= 1.0 - smoothstep(0.35, 0.85, d) * F(2); }
  if (F(3) > 0.0) c += (hash(uv * uFrame + uTime * 31.0) - 0.5) * F(3) * 0.18;
  if (F(14) > 0.0 || F(11) > 0.0) c *= 1.0 - (F(14) * 0.25 + F(11) * 0.15) * step(0.5, fract(uv.y * uFrame.y / 3.0));
  if (F(11) > 0.0) c += (hash(vec2(uv.y * 400.0, uTime)) - 0.5) * 0.06 * F(11);
  if (F(18) > 0.0) { float f = fbm(uv * vec2(3.0, 2.0) + vec2(uTime * 0.06, uTime * 0.01)); c = mix(c, vec3(0.83, 0.85, 0.88), clamp(f * 1.25 * F(18) * (0.55 + 0.45 * (1.0 - uv.y)), 0.0, 0.88)); }
  if (F(16) > 0.0) { c *= 1.0 - 0.16 * F(16); c = mix(c, vec3(0.8, 0.85, 0.95), clamp(rainF(uv) * F(16) * 1.4, 0.0, 0.9)); }
  if (F(17) > 0.0) c = mix(c, vec3(1.0), snowF(uv) * clamp(F(17) * 1.3, 0.0, 1.0));
  if (F(19) > 0.0) { vec2 p1 = vec2(0.1 + 0.12 * sin(uTime * 0.35), 0.85 + 0.08 * cos(uTime * 0.27)), p2 = vec2(0.95, 0.25 + 0.15 * sin(uTime * 0.22));
    vec3 leak = vec3(1.0, 0.55, 0.18) * smoothstep(0.85, 0.0, distance(uv, p1)) + vec3(1.0, 0.25, 0.45) * smoothstep(0.6, 0.0, distance(uv, p2)) * 0.7;
    c = 1.0 - (1.0 - c) * (1.0 - clamp(leak * F(19) * 0.85, 0.0, 1.0)); }
  if (F(20) > 0.0) c += vec3(1.0, 0.95, 0.82) * sparkF(uv) * F(20) * 1.3;
  if (F(21) > 0.0) { float t = floor(uTime * 12.0); float sp = step(0.9988, hash(floor(uv * uFrame / 3.0) + t * 1.7)); float lx = hash(vec2(t, 4.0));
    float line = step(0.6, hash(vec2(t, 9.0))) * (1.0 - smoothstep(0.0, 1.5 / uFrame.x, abs(uv.x - lx)));
    c = mix(c, vec3(0.08), clamp((sp + line * 0.6) * F(21), 0.0, 1.0)); c *= 1.0 - F(21) * 0.1 * hash(vec2(t, 3.0)); c = mix(c, vec3(luma(c)) * vec3(1.05, 0.98, 0.86), F(21) * 0.35); }
  if (N78) {
  // (v278) colour looks
  float a, y = luma(c), asp = uFrame.x / uFrame.y;
  a = F(FX_duotone); if (a > 0.0) c = mix(c, mix(vec3(0.08, 0.1, 0.35), vec3(1.0, 0.75, 0.3), y), a);
  a = F(FX_duotoneB); if (a > 0.0) c = mix(c, mix(vec3(0.05, 0.05, 0.07), vec3(0.85, 0.95, 0.23), y), a);
  a = F(FX_thermal); if (a > 0.0) c = mix(c, hsv2rgb(vec3(fract(0.7 - 0.75 * clamp(y, 0.0, 1.0)), 1.0 - smoothstep(0.85, 1.0, y) * 0.8, 0.55 + 0.45 * clamp(y, 0.0, 1.0))), a);
  a = F(FX_nightVision); if (a > 0.0) { float g = y * 1.7 + (hash(uv * uFrame + uTime * 17.0) - 0.5) * 0.15; vec3 nv = vec3(0.12, 1.0, 0.25) * g * (1.0 - smoothstep(0.4, 0.75, distance(uv, vec2(0.5)))); c = mix(c, nv, a); }
  a = F(FX_infrared); if (a > 0.0) c = mix(c, vec3(c.g * 1.15 + 0.1, c.r * 0.6 + 0.12, c.b * 0.85 + 0.05), a);
  a = F(FX_xray); if (a > 0.0) c = mix(c, vec3(1.0 - y) * vec3(0.75, 0.9, 1.05), a);
  a = F(FX_hueCycle); if (a > 0.0) { vec3 h = rgb2hsv(clamp(c, 0.0, 1.0)); h.x = fract(h.x + uTime * 0.15 * a); c = hsv2rgb(h); }
  a = F(FX_rainbow); if (a > 0.0) { vec3 rb = hsv2rgb(vec3(fract(uv.x * 0.8 + uv.y * 0.4 + uTime * 0.1), 0.85, 1.0)); c = mix(c, 1.0 - (1.0 - c) * (1.0 - rb * 0.6), a * 0.7); }
  a = F(FX_colorPop); if (a > 0.0) { vec3 h = rgb2hsv(clamp(c, 0.0, 1.0)); float d = min(h.x, 1.0 - h.x); float keep = smoothstep(0.09, 0.03, d) * smoothstep(0.15, 0.3, h.y); c = mix(c, mix(vec3(y), c, keep), a); }
  a = F(FX_bleach); if (a > 0.0) { vec3 g = vec3(y); vec3 ov = mix(2.0 * c * g, 1.0 - 2.0 * (1.0 - c) * (1.0 - g), step(0.5, g)); c = mix(c, mix(ov, g, 0.4), a); }
  a = F(FX_popArt); if (a > 0.0) { vec3 q = floor(clamp(c, 0.0, 1.0) * 4.0) / 3.0; q = mix(vec3(luma(q)), q, 1.7); c = mix(c, clamp(q, 0.0, 1.0), a); }
  a = F(FX_crosshatch); if (a > 0.0) { vec2 p = uv * uFrame; float ink = 1.0;
    if (y < 0.8) ink -= step(mod(p.x + p.y, 10.0), 1.0); if (y < 0.6) ink -= step(mod(p.x - p.y, 10.0), 1.0); if (y < 0.4) ink -= step(mod(p.x + p.y - 5.0, 10.0), 1.0); if (y < 0.2) ink -= step(mod(p.x - p.y - 5.0, 10.0), 1.0);
    c = mix(c, vec3(clamp(ink, 0.0, 1.0)) * vec3(0.98, 0.96, 0.9), a); }
  a = F(FX_crt); if (a > 0.0) { c *= 1.0 - a * 0.3 * (0.5 + 0.5 * sin(uv.y * uFrame.y * 3.14159)); float m = mod(floor(uv.x * uFrame.x), 3.0);
    c *= mix(vec3(1.0), vec3(m < 0.5 ? 1.15 : 0.85, m > 0.5 && m < 1.5 ? 1.15 : 0.85, m > 1.5 ? 1.15 : 0.85), a); c *= 1.0 - smoothstep(0.4, 0.8, distance(uv, vec2(0.5))) * a * 0.6; }
  // light
  a = F(FX_strobe); if (a > 0.0) c = mix(c, vec3(1.0), step(0.82, fract(uTime * 4.0)) * a * 0.85);
  a = F(FX_flicker); if (a > 0.0) c *= 1.0 - a * 0.3 * hash(vec2(floor(uTime * 15.0), 1.0));
  a = F(FX_lensFlare); if (a > 0.0) { vec2 p = vec2(0.72 + 0.05 * sin(uTime * 0.3), 0.78); vec2 q = (uv - p) * vec2(asp, 1.0); vec3 fl = vec3(1.0, 0.85, 0.6) * exp(-length(q) * 7.0) * 1.3;
    fl += vec3(1.0, 0.9, 0.7) * max(0.0, 1.0 - abs(q.y) * 60.0) * exp(-abs(q.x) * 2.5) * 0.5;
    for (int i = 1; i <= 4; i++) { vec2 g = mix(p, 1.0 - p, float(i) * 0.3); float d = length((uv - g) * vec2(asp, 1.0)); fl += hsv2rgb(vec3(float(i) * 0.18, 0.6, 1.0)) * smoothstep(0.06 + float(i) * 0.015, 0.0, d) * 0.25; }
    c = 1.0 - (1.0 - c) * (1.0 - clamp(fl * a, 0.0, 1.0)); }
  a = F(FX_godRays); if (a > 0.0) { vec2 sp = vec2(0.5, 1.15); vec2 d = (uv - sp) * vec2(asp, 1.0); float an = atan(d.x, -d.y);
    float r = fbm(vec2(an * 9.0, uTime * 0.15)) * smoothstep(1.6, 0.2, length(d)); c = 1.0 - (1.0 - c) * (1.0 - clamp(vec3(1.0, 0.95, 0.8) * pow(r, 1.6) * a * 0.9, 0.0, 1.0)); }
  // retro
  a = F(FX_filmBurn); if (a > 0.0) { float b = fbm(uv * 3.0 + vec2(uTime * 0.3, -uTime * 0.2)) * smoothstep(1.0, 0.1, distance(uv, vec2(0.05 + 0.1 * sin(uTime * 0.2), 0.95)));
    c = 1.0 - (1.0 - c) * (1.0 - clamp(vec3(1.0, 0.45, 0.1) * smoothstep(0.25, 0.75, b) * a * 1.6, 0.0, 1.0)); }
  a = F(FX_scratches); if (a > 0.0) { float t = floor(uTime * 18.0); float sc = 0.0;
    for (int i = 0; i < 3; i++) { float lx = hash(vec2(t, float(i) + 1.0)); sc += step(0.5, hash(vec2(t, float(i) + 11.0))) * (1.0 - smoothstep(0.0, 1.2 / uFrame.x, abs(uv.x - lx))); }
    float dust = step(0.9993, hash(floor(uv * uFrame / 2.0) + t)); c = mix(c, vec3(0.95), clamp(sc * 0.55, 0.0, 1.0) * a); c = mix(c, vec3(0.05), dust * a); }
  a = F(FX_grunge); if (a > 0.0) { float g = fbm(uv * vec2(asp, 1.0) * 6.0 + 3.7); c *= 1.0 - a * 0.4 * smoothstep(0.45, 0.8, g); c = mix(c, c * vec3(1.02, 0.95, 0.82), a * 0.5); c += (hash(uv * uFrame) - 0.5) * a * 0.08; }
  // particles
  a = F(FX_bokeh); if (a > 0.0) { vec4 p = cellP(uv, 4.0, vec2(0.04, 0.07), 1.0); float rr = mix(0.18, 0.32, p.w); float disc = smoothstep(rr, rr - 0.03, length(p.xy)) * step(0.45, p.z);
    c = 1.0 - (1.0 - c) * (1.0 - clamp(hsv2rgb(vec3(0.05 + p.w * 0.12, 0.55, 1.0)) * disc * a * 0.45, 0.0, 1.0)); }
  a = F(FX_fireflies); if (a > 0.0) { vec4 p = cellP(uv, 9.0, vec2(0.02, 0.03), 2.0); vec2 f = p.xy - vec2(sin(uTime * 1.3 + p.z * 20.0), cos(uTime * 1.1 + p.z * 30.0)) * 0.22;
    float gl = exp(-length(f) * 22.0) * step(0.72, p.z) * (0.5 + 0.5 * sin(uTime * 3.0 + p.w * 40.0)); c += vec3(0.85, 1.0, 0.45) * gl * a * 1.6; }
  a = F(FX_confetti); if (a > 0.0) { vec4 p = cellP(uv, 10.0, vec2(0.0, 1.0), 3.0); vec2 f = rot2(uTime * 3.0 + p.z * 6.0) * p.xy;
    float m = step(abs(f.x), 0.12) * step(abs(f.y), 0.06) * step(0.55, p.z); c = mix(c, hsv2rgb(vec3(p.w, 0.8, 1.0)), m * a); }
  a = F(FX_hearts); if (a > 0.0) { vec4 p = cellP(uv, 7.0, vec2(0.0, -0.6), 4.0); vec2 f = p.xy * 4.5; f.x += sin(uTime * 2.0 + p.z * 9.0) * 0.4;
    float m = step(heartF(f), 0.0) * step(0.6, p.z); c = mix(c, vec3(1.0, 0.3, 0.5) * (0.85 + 0.15 * p.w), m * a); }
  a = F(FX_embers); if (a > 0.0) { vec4 p = cellP(uv, 14.0, vec2(0.0, -1.2), 5.0); vec2 f = p.xy; f.x += sin(uTime * 2.5 + p.z * 11.0) * 0.2;
    float gl = exp(-length(f) * 28.0) * step(0.7, p.z) * (1.0 - uv.y * 0.7); c += vec3(1.0, 0.5, 0.12) * gl * a * 1.8; }
  a = F(FX_smoke); if (a > 0.0) { float sm = fbm(uv * vec2(asp, 1.0) * 3.0 + vec2(0.0, -uTime * 0.25)); c = mix(c, vec3(0.75), smoothstep(0.4, 0.85, sm) * a * 0.75 * (1.0 - uv.y * 0.6)); }
  a = F(FX_lightning); if (a > 0.0) { float t = floor(uTime * 2.5); float fl = step(0.78, hash(vec2(t, 7.0))) * exp(-fract(uTime * 2.5) * 6.0);
    float lx = hash(vec2(t, 2.0)) * 0.6 + 0.2 + (fbm(vec2(uv.y * 8.0, t)) - 0.5) * 0.25; float ln = (1.0 - smoothstep(0.0, 0.005, abs(uv.x - lx))) * step(0.3, uv.y);
    c = mix(c, c * 0.75 + vec3(0.6, 0.65, 0.85) * fl, a); c += vec3(0.85, 0.9, 1.0) * ln * fl * 2.0 * a; }
  // frames
  a = F(FX_letterbox); if (a > 0.0) { float bh = 0.12 * a; if (abs(uv.y - 0.5) > 0.5 - bh) c = vec3(0.0); }
  a = F(FX_frameWhite); if (a > 0.0) { vec2 w = vec2(0.035 * a / asp, 0.035 * a); if (uv.x < w.x || uv.x > 1.0 - w.x || uv.y < w.y || uv.y > 1.0 - w.y) c = vec3(0.97); }
  a = F(FX_roundFrame); if (a > 0.0) { vec2 p = (uv - 0.5) * uFrame; vec2 h = uFrame * 0.5 - 2.0; float r = min(uFrame.x, uFrame.y) * 0.12 * a; vec2 q = abs(p) - h + r; float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; gCut *= 1.0 - smoothstep(-1.0, 1.0, sd); }
  }
  return c;
}
float trMask(vec2 uv, vec4 src){
  if (uTrRole < 0) return 1.0;
  float k = uTrK; bool inc = uTrRole == 1;
  if (uTr == 0 || uTr == 4 || uTr == 26 || uTr == 27 || uTr == 28 || uTr == 32 || uTr == 33) return inc ? k : 1.0;
  if (uTr == 1 || uTr == 2) return inc ? step(0.5, k) : 1.0;
  if (uTr == 3) return inc ? step(0.5, k) : 1.0;
  if (uTr == 5) { float l = luma(src.rgb); return inc ? smoothstep(l - 0.08, l + 0.08, k * 1.16 - 0.08) : 1.0; }
  if (!inc) return 1.0;
  float e = 0.004;
  if (uTr == 6) return smoothstep(1.0 - k - e, 1.0 - k + e, uv.x);
  if (uTr == 7) return 1.0 - smoothstep(k - e, k + e, uv.x);
  if (uTr == 8) return 1.0 - smoothstep(k - e, k + e, uv.y);
  if (uTr == 9) return smoothstep(1.0 - k - e, 1.0 - k + e, uv.y);
  if (uTr == 10) return 1.0 - smoothstep(k * 2.0 - e, k * 2.0 + e, uv.x + (1.0 - uv.y));
  if (uTr == 11) return smoothstep(2.0 - k * 2.0 - e, 2.0 - k * 2.0 + e, uv.x + (1.0 - uv.y));
  if (uTr == 12) { float a = atan(uv.x - 0.5, uv.y - 0.5) / 6.28318 + 0.5; return 1.0 - step(k, a); }
  if (uTr == 13) { float d = distance(uv, vec2(0.5)) / 0.7072; return 1.0 - smoothstep(k - 0.02, k + 0.02, d); }
  if (uTr == 14) return 1.0 - smoothstep(k - e, k + e, abs(uv.x - 0.5) * 2.0);
  if (uTr == 15) return 1.0 - smoothstep(k - e, k + e, abs(uv.y - 0.5) * 2.0);
  if (uTr == 16) return step(fract(uv.y * 8.0), k);
  if (uTr == 17) { vec2 g = floor(uv * 8.0); float r = hash(g); return step(r, k); }
  if (uTr >= 18 && uTr <= 25) return 1.0;
  if (uTr == 29 || uTr == 30) { vec2 q = (uv - 0.5) * uFrame / uFrame.y; float d = length(q) / length(vec2(0.5 * uFrame.x / uFrame.y, 0.5));
    return uTr == 29 ? 1.0 - smoothstep(k - 0.01, k + 0.01, d) : smoothstep(1.0 - k - 0.01, 1.0 - k + 0.01, d) + step(0.999, k); }
  if (uTr == 31) { float d = abs(uv.x - 0.5) + abs(uv.y - 0.5); return 1.0 - step(k, d); }
  // (v278)
  if (!T78) return 1.0;
  float asp = uFrame.x / uFrame.y; vec2 q = (uv - 0.5) * vec2(asp, 1.0); float R = length(vec2(asp, 1.0)) * 0.5;
  if (uTr == TR_crossZoom || uTr == TR_swirl || uTr == TR_rippleT || uTr == TR_dreamyT || uTr == TR_shakeT || uTr == TR_crossWarp) return k;
  if (uTr == TR_leakT) return smoothstep(0.3, 0.7, k);
  if (uTr == TR_colorFlash) return step(0.5, k);
  if (uTr == TR_rotateIn) return smoothstep(0.0, 0.3, k);
  if (uTr == TR_zoomSpin) return smoothstep(0.0, 0.2, k);
  if (uTr == TR_zoomThrough) return smoothstep(0.35, 0.75, k);
  if (uTr == TR_dissolve) return step(hash(floor(uv * uFrame / 3.0)), k);
  if (uTr == TR_burn) { float n = fbm(uv * vec2(asp, 1.0) * 4.0); return smoothstep(n - 0.02, n + 0.02, k * 1.25 - 0.12); }
  if (uTr == TR_heart) { float s = max(k * 1.9, 1e-3); return k > 0.995 ? 1.0 : step(heartF(q / s * 1.1), 0.0); }
  if (uTr == TR_star) { float an = atan(q.y, q.x) + 1.5708; float rr = mix(0.5, 1.0, 0.5 + 0.5 * cos(5.0 * an)) * k * R * 2.2; return 1.0 - smoothstep(rr - 0.005, rr + 0.005, length(q)); }
  if (uTr == TR_irisSq) return 1.0 - step(k * max(asp * 0.5, 0.5) * 1.01, max(abs(q.x), abs(q.y)));
  if (uTr == TR_plus) { float w = k * max(asp * 0.5, 0.5) * 1.01; return max(1.0 - step(w, abs(q.x)), 1.0 - step(w, abs(q.y))); }
  if (uTr == TR_splitV) return 1.0 - smoothstep(k * 0.5 - e, k * 0.5 + e, abs(uv.x - 0.5));
  if (uTr == TR_splitH) return 1.0 - smoothstep(k * 0.5 - e, k * 0.5 + e, abs(uv.y - 0.5));
  if (uTr == TR_waveT) { float x = k * 1.25 - 0.12 + sin(uv.y * 18.0 + k * 6.0) * 0.05; return 1.0 - smoothstep(x - e, x + e, uv.x); }
  if (uTr == TR_squares) { vec2 g = q * 8.0; vec2 f = abs(fract(g) - 0.5); float h = hash(floor(g)); return 1.0 - step(k * 1.4 - h * 0.4, max(f.x, f.y) * 2.0); }
  if (uTr == TR_hexT) return step(hash(floor(hexCenter(q * 10.0) * 10.0 + 0.5)), k);
  if (uTr == TR_dotsT) { vec2 g = q * 10.0; return 1.0 - step(k * 0.75, length(fract(g) - 0.5)); }
  if (uTr == TR_windL) { float x = k * 1.4 - 0.2 + (hash(vec2(floor(uv.y * uFrame.y / 4.0), 1.0)) - 0.5) * 0.35; return 1.0 - smoothstep(x - 0.02, x + 0.02, uv.x); }
  if (uTr == TR_digital) return step(hash(floor(uv * vec2(16.0, 9.0)) + 3.0), k);
  if (uTr == TR_ink) { float d = length(q) / R + (fbm(q * 5.0) - 0.5) * 0.45; return 1.0 - smoothstep(k * 1.35 - 0.02, k * 1.35 + 0.02, d + 0.1); }
  if (uTr == TR_spiral) { float an = atan(q.y, q.x) / 6.28318 + 0.5; float v = fract(an + length(q) / R * 2.0) * 0.4 + length(q) / R * 0.6; return 1.0 - step(k * 1.05, v); }
  if (uTr == TR_fan) { float an = atan(uv.x - 0.5, uv.y + 0.02) / 3.14159 + 0.5; return 1.0 - step(k, an); }
  if (uTr == TR_zigzag) { float x = uv.x + abs(fract(uv.y * 8.0) - 0.5) * 0.12; return 1.0 - step(k * 1.08, x); }
  if (uTr == TR_ellipse) return 1.0 - smoothstep(k * 1.42 - 0.01, k * 1.42 + 0.01, length((uv - 0.5) * 2.0));
  if (uTr == TR_lumaInv) { float l = 1.0 - luma(src.rgb); return smoothstep(l - 0.08, l + 0.08, k * 1.16 - 0.08); }
  if (uTr == TR_softWipeL) return 1.0 - smoothstep(k * 1.4 - 0.4, k * 1.4, uv.x);
  if (uTr == TR_softWipeR) return smoothstep(1.0 - k * 1.4, 1.4 - k * 1.4, uv.x);
  if (uTr == TR_bars) return step(uv.y, k * 1.4 - hash(vec2(floor(uv.x * 10.0), 5.0)) * 0.4);
  if (uTr == TR_blindsV) return step(fract(uv.x * 10.0), k);
  return 1.0;
}
vec3 blendOp(vec3 d, vec3 s){
  if (uBlend == 1) return d * s;
  if (uBlend == 2) return 1.0 - (1.0 - d) * (1.0 - s);
  if (uBlend == 3) return mix(2.0 * d * s, 1.0 - 2.0 * (1.0 - d) * (1.0 - s), step(0.5, d));
  if (uBlend == 4) return min(d, s);
  if (uBlend == 5) return max(d, s);
  if (uBlend == 6) return min(d + s, 1.0);
  if (uBlend == 7) return abs(d - s);
  if (uBlend == 8) return mix(2.0 * d * s + d * d * (1.0 - 2.0 * s), sqrt(d) * (2.0 * s - 1.0) + 2.0 * d * (1.0 - s), step(0.5, s));
  if (uBlend == 9) return mix(2.0 * d * s, 1.0 - 2.0 * (1.0 - d) * (1.0 - s), step(0.5, s));
  if (uBlend == 10) return min(d / max(1.0 - s, 1e-3), 1.0);
  if (uBlend == 11) return 1.0 - min((1.0 - d) / max(s, 1e-3), 1.0);
  return s;
}
void main(){
  vec4 dst = texture(uDst, vUv);
  gUv = vUv;
  vec2 suv = place(vUv);
  vec4 src = sampleSrc(suv);
  if (uPremul) src.rgb /= max(src.a, 1e-4);
  src = keyed(src);
  vec3 orig = src.rgb;
  src.rgb = grade(src.rgb, vUv);
  if (uCm.w > 0.5) {
    vec3 hv = rgb2hsv(clamp(orig, 0.0, 1.0)); float dh = abs(fract(hv.x - uCm.x + 0.5) - 0.5);
    float m = (1.0 - smoothstep(uCm.y, uCm.y + uCm.z + 1e-3, dh)) * smoothstep(uCm3.y * 0.5, uCm3.y + 0.05, hv.y);
    if (uCm2.w > 0.5) m = 1.0 - m;
    vec3 h = rgb2hsv(clamp(src.rgb, 0.0, 1.0)); h.x = fract(h.x + uCm2.x); h.y = clamp(h.y * (1.0 + uCm2.y), 0.0, 1.0);
    vec3 adj = hsv2rgb(h) * pow(2.0, uCm2.z * 2.0);
    src.rgb = mix(src.rgb, adj, m); if (uCm3.x > 0.5) src.rgb = vec3(m);
  }
  float a = src.a * uOpacity * trMask(vUv, src);
  if (uMatteM.x > 0.5) { vec4 mt = texture(uMatte, vUv); float v = uMatteM.x < 1.5 ? mt.a : clamp(luma(mt.rgb), 0.0, 1.0); if (uMatteM.y > 0.5) v = 1.0 - v; a *= v; }
  if (uTrRole >= 0) {
    float k = uTrK;
    if (uTr == 1 || uTr == 2) { vec3 to = uTr == 1 ? vec3(0.0) : vec3(1.0); float m = uTrRole == 0 ? clamp(k * 2.0, 0.0, 1.0) : clamp((1.0 - k) * 2.0, 0.0, 1.0); src.rgb = mix(src.rgb, to, m); }
    if (uTr == 3) src.rgb += vec3(1.0) * pow(1.0 - abs(k - 0.5) * 2.0, 3.0);
    if (uTr == 26 && uTrRole == 0) a *= 1.0 - k;
    float sk = sin(k * 3.14159); if (T78) {
    if (uTr == TR_burn && uTrRole == 0) { float n = fbm(vUv * vec2(uFrame.x / uFrame.y, 1.0) * 4.0); float d = k * 1.25 - 0.12 - n; src.rgb = mix(src.rgb, vec3(1.0, 0.45, 0.08) * 1.5, smoothstep(-0.14, 0.0, d) * 0.95); }
    if (uTr == TR_leakT) src.rgb = 1.0 - (1.0 - src.rgb) * (1.0 - vec3(1.0, 0.55, 0.2) * sk * 0.8 * smoothstep(1.0, 0.0, distance(vUv, vec2(0.15, 0.85))));
    if (uTr == TR_colorFlash) src.rgb = mix(src.rgb, vec3(0.85, 0.95, 0.23), pow(1.0 - abs(k - 0.5) * 2.0, 2.0));
    if (uTr == TR_dreamyT) src.rgb += sk * 0.15;
    if ((uTr == TR_page || uTr == TR_stackUp) && uTrRole == 0) src.rgb *= 1.0 - 0.4 * k;
    if (uTr == TR_zoomThrough && uTrRole == 0) a *= 1.0 - smoothstep(0.5, 0.9, k); }
  }
  a *= gCut;
  vec3 outc = mix(dst.rgb, blendOp(dst.rgb, clamp(src.rgb, 0.0, 1.0)), a);
  o = vec4(outc, a + dst.a * (1.0 - a));
}`; }
