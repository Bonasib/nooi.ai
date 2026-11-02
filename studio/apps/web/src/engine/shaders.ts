// The compositor's shaders (WebGL2 / GLSL ES 3.0). One pass per layer: the layer is placed (crop, transform), coloured
// (adjustments, LUT, effects), shaped by its transition, then blended over what is below (read from the other buffer).
export const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const FS_COPY = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform bool uFlipY; out vec4 o;
void main(){ vec2 uv = uFlipY ? vec2(vUv.x, 1.0 - vUv.y) : vUv; o = texture(uTex, uv); }`;

export const BLENDS = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "add", "difference", "softLight", "hardLight", "colorDodge", "colorBurn"];
export const TRANS = ["fade", "black", "white", "flash", "blur", "luma", "wipeL", "wipeR", "wipeU", "wipeD", "diagTL", "diagBR", "clock", "radial", "barnV", "barnH", "blinds", "checker",
  "slideL", "slideR", "slideU", "slideD", "pushL", "pushR", "pushU", "pushD", "zoomIn", "zoomOut", "spin", "circleOpen", "circleClose", "diamond", "pixelate", "glitch"];
export const FX = ["blur", "sharpen", "vignette", "grain", "glitch", "rgbSplit", "pixelate", "mono", "sepia", "invert", "mirror", "vhs", "glow", "posterize", "scanlines", "shake"];

export const FS_LAYER = `#version 300 es
precision highp float; precision highp sampler3D;
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
uniform float uFx[16];        // effect amounts (0 = off), order = FX
uniform int uTr; uniform float uTrK; uniform int uTrRole;   // transition type, progress, 0 = outgoing 1 = incoming (-1 none)
uniform bool uSrcFlipY;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0., -1./3., 2./3., -1.); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6. * d + 1e-10)), d / (q.x + 1e-10), q.x); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1., 2./3., 1./3.)) * 6. - 3.); return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y); }

// where the output pixel falls in the source (0..1), with the transition's movement
vec2 place(vec2 uv){
  vec2 px = (uv - 0.5) * uFrame;
  if (uTrRole >= 0) {
    float k = uTrK; float s = uTrRole == 1 ? 1.0 - k : -k;   // incoming comes in; outgoing goes out
    if (uTr >= 18 && uTr <= 21 && uTrRole == 1) { vec2 d = uTr == 18 ? vec2(1,0) : uTr == 19 ? vec2(-1,0) : uTr == 20 ? vec2(0,-1) : vec2(0,1); px -= d * uFrame * s; }
    if (uTr >= 22 && uTr <= 25) { vec2 d = uTr == 22 ? vec2(1,0) : uTr == 23 ? vec2(-1,0) : uTr == 24 ? vec2(0,-1) : vec2(0,1); px -= d * uFrame * s; }
    if (uTr == 26) { float z = uTrRole == 0 ? 1.0 + k * 0.6 : 1.0 + (1.0 - k) * 0.3; px /= z; }
    if (uTr == 27) { float z = uTrRole == 1 ? 1.0 + (1.0 - k) * 0.8 : 1.0 - k * 0.3; px /= z; }
    if (uTr == 28) { float a = (uTrRole == 0 ? k : -(1.0 - k)) * 3.14159; float z = 1.0 + sin(k * 3.14159) * 0.6; px = mat2(cos(a), -sin(a), sin(a), cos(a)) * px * z; }
    if (uTr == 32) { float b = max(1.0, sin(k * 3.14159) * 48.0); px = floor(px / b) * b + b * 0.5; }
  }
  if (uFx[15] > 0.0) px += vec2(hash(vec2(uTime, 1.0)) - 0.5, hash(vec2(uTime, 2.0)) - 0.5) * uFx[15] * 0.04 * uFrame.y;
  vec3 s = uInv * vec3(px, 1.0);
  vec2 suv = s.xy / uSrcSize + 0.5;
  return suv;
}
vec4 tap(vec2 suv){
  // GL works y-up; the source's first row is its top, so the vertical is turned over here (crop: left top right bottom)
  vec2 q = vec2(suv.x, 1.0 - suv.y);
  vec2 c = vec2(uCrop.x + q.x * (1.0 - uCrop.x - uCrop.z), uCrop.y + q.y * (1.0 - uCrop.y - uCrop.w));
  if (uSrcFlipY) c.y = 1.0 - c.y;
  return texture(uSrc, c);
}
vec4 sampleSrc(vec2 suv){
  if (uFx[10] > 0.0) suv.x = suv.x > 0.5 ? 1.0 - suv.x : suv.x;
  if (uFx[6] > 0.0) { float b = mix(1.0, 64.0, uFx[6]) / uSrcSize.x; suv = floor(suv / b) * b + b * 0.5; }
  if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) return vec4(0.0);
  vec4 c = tap(suv);
  vec2 px1 = 1.0 / uSrcSize;
  if (uFx[0] > 0.0 || uTr == 4 && uTrRole >= 0) {
    float r = uFx[0] * 10.0 + (uTr == 4 && uTrRole >= 0 ? sin(uTrK * 3.14159) * 14.0 : 0.0);
    vec4 acc = vec4(0.0); float w = 0.0;
    for (int i = -3; i <= 3; i++) for (int j = -3; j <= 3; j++) { vec2 d = vec2(float(i), float(j)) * r / 3.0 * px1; float ww = 1.0 / (1.0 + float(i*i + j*j)); acc += tap(clamp(suv + d, 0.0, 1.0)) * ww; w += ww; }
    c = acc / w;
  }
  if (uFx[1] > 0.0) { vec4 n = tap(suv + vec2(px1.x, 0)) + tap(suv - vec2(px1.x, 0)) + tap(suv + vec2(0, px1.y)) + tap(suv - vec2(0, px1.y)); c.rgb = c.rgb + (c.rgb * 4.0 - n.rgb) * uFx[1] * 0.6; }
  if (uFx[4] > 0.0 || uFx[5] > 0.0 || uFx[11] > 0.0 || (uTr == 33 && uTrRole >= 0)) {
    float a = uFx[5] * 0.012 + uFx[4] * 0.02 * step(0.7, hash(vec2(floor(suv.y * 24.0), floor(uTime * 10.0)))) + uFx[11] * 0.006 + (uTr == 33 && uTrRole >= 0 ? sin(uTrK * 3.14159) * 0.03 : 0.0);
    float jx = uFx[4] > 0.0 ? (hash(vec2(floor(suv.y * 30.0), floor(uTime * 12.0))) - 0.5) * uFx[4] * 0.05 : 0.0;
    c.r = tap(clamp(suv + vec2(a + jx, 0), 0.0, 1.0)).r; c.b = tap(clamp(suv - vec2(a - jx, 0), 0.0, 1.0)).b;
  }
  if (uFx[12] > 0.0) { vec4 g = vec4(0.0); for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) g += tap(clamp(suv + vec2(float(i), float(j)) * 4.0 * px1, 0.0, 1.0)); g /= 25.0; c.rgb += max(g.rgb - 0.55, 0.0) * uFx[12] * 2.0; }
  return c;
}
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
  if (uLutAmt > 0.0) { vec3 q = clamp(c, 0.0, 1.0); vec3 lc = (q * (uLutSize - 1.0) + 0.5) / uLutSize; c = mix(c, texture(uLut, lc).rgb, uLutAmt); }
  if (uFx[7] > 0.0) c = mix(c, vec3(luma(c)), uFx[7]);
  if (uFx[8] > 0.0) { float y = luma(c); c = mix(c, vec3(y * 1.07, y * 0.74, y * 0.43) + vec3(0.08, 0.05, 0.0), uFx[8]); }
  if (uFx[9] > 0.0) c = mix(c, 1.0 - c, uFx[9]);
  if (uFx[13] > 0.0) { float n = mix(16.0, 3.0, uFx[13]); c = floor(c * n) / n; }
  if (uFx[2] > 0.0) { float d = distance(uv, vec2(0.5)); c *= 1.0 - smoothstep(0.35, 0.85, d) * uFx[2]; }
  if (uFx[3] > 0.0) c += (hash(uv * uFrame + uTime * 31.0) - 0.5) * uFx[3] * 0.18;
  if (uFx[14] > 0.0 || uFx[11] > 0.0) c *= 1.0 - (uFx[14] * 0.25 + uFx[11] * 0.15) * step(0.5, fract(uv.y * uFrame.y / 3.0));
  if (uFx[11] > 0.0) c += (hash(vec2(uv.y * 400.0, uTime)) - 0.5) * 0.06 * uFx[11];
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
  vec2 suv = place(vUv);
  vec4 src = sampleSrc(suv);
  src.rgb = grade(src.rgb, vUv);
  float a = src.a * uOpacity * trMask(vUv, src);
  if (uTrRole >= 0) {
    float k = uTrK;
    if (uTr == 1 || uTr == 2) { vec3 to = uTr == 1 ? vec3(0.0) : vec3(1.0); float m = uTrRole == 0 ? clamp(k * 2.0, 0.0, 1.0) : clamp((1.0 - k) * 2.0, 0.0, 1.0); src.rgb = mix(src.rgb, to, m); }
    if (uTr == 3) src.rgb += vec3(1.0) * pow(1.0 - abs(k - 0.5) * 2.0, 3.0);
    if (uTr == 26 && uTrRole == 0) a *= 1.0 - k;
  }
  vec3 outc = mix(dst.rgb, blendOp(dst.rgb, clamp(src.rgb, 0.0, 1.0)), a);
  o = vec4(outc, a + dst.a * (1.0 - a));
}`;
