// WebGL2 compositor: draws a moment of the timeline into a canvas, layer by layer (bottom to top), on the user's device.
import { BLENDS, FS_COPY, FS_LAYER, FX, TRANS, VS } from "./shaders";
import { HUE_BANDS, keyOf, rgbOf, screenOf } from "@nooi/editor-core";
import type { ColorAdjust, Effect, Transform } from "@nooi/editor-core";

export type Src = TexImageSource;
export interface LayerDraw {
  src: Src; w: number; h: number; key: string;     // key: one texture per source (a video, an image, a text canvas)
  transform: Transform; x: number; y: number; scale: number; rotation: number; opacity: number;
  blend: string; color?: ColorAdjust | null; effects?: Effect[]; lut?: { tex: WebGLTexture; size: number; amount: number } | null;
  trans?: { type: string; k: number; role: "a" | "b" } | null; fit?: "contain" | "cover" | "frame";
  dynamic?: boolean;                              // re-upload every frame (video)
  fid?: number;                                   // (v226) the frame it shows: the same frame is not uploaded again
  stacked?: boolean;                              // (v234) a cut-out: the picture on the top half, its mask below (h is the whole frame)
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const mk = (t: number, s: string) => { const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(sh)); return sh; };
  const p = gl.createProgram()!; gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, "aPos"); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("program: " + gl.getProgramInfoLog(p)); return p;
}

export class Compositor {
  gl: WebGL2RenderingContext; canvas: HTMLCanvasElement | OffscreenCanvas; W = 2; H = 2;
  private layer: WebGLProgram; private copy: WebGLProgram; private vao: WebGLVertexArrayObject;
  private fbo: { fb: WebGLFramebuffer; tex: WebGLTexture }[] = []; private cur = 0;
  private texs = new Map<string, { tex: WebGLTexture; w: number; h: number; stamp: number; fid?: number }>();
  private U: Record<string, WebGLUniformLocation | null> = {};
  private emptyLut: WebGLTexture; time = 0; lost = false;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: false, antialias: false }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error("WebGL2 is not available on this device.");
    this.gl = gl;
    this.layer = compile(gl, VS, FS_LAYER); this.copy = compile(gl, VS, FS_COPY);
    this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const n of ["uSrc", "uDst", "uLut", "uFrame", "uSrcSize", "uInv", "uCrop", "uOpacity", "uBlend", "uTime", "uC1", "uC2", "uHsl", "uLutAmt", "uLutSize", "uFx", "uBox", "uTr", "uTrK", "uTrRole", "uSrcFlipY", "uKey", "uKeyP", "uStack", "uTexH"]) this.U[n] = gl.getUniformLocation(this.layer, n);
    this.emptyLut = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_3D, this.emptyLut); gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 2, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(32));
    if ("addEventListener" in canvas) (canvas as HTMLCanvasElement).addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; });
  }
  resize(W: number, H: number) {
    W = Math.max(2, Math.round(W)); H = Math.max(2, Math.round(H)); if (W === this.W && H === this.H && this.fbo.length) return;
    this.W = W; this.H = H; this.canvas.width = W; this.canvas.height = H; const gl = this.gl;
    for (const f of this.fbo) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
    this.fbo = [0, 1].map(() => { const tex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); this.params(); const fb = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); return { fb, tex }; });
  }
  private params(filter = this.gl.LINEAR) { const gl = this.gl; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  begin(bg = "#000000") {
    const gl = this.gl; const c = parseInt(bg.slice(1), 16) || 0;
    for (const f of this.fbo) { gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb); gl.viewport(0, 0, this.W, this.H); gl.clearColor(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    this.cur = 0;
  }
  texture(key: string, src: Src, w: number, h: number, dynamic: boolean, fid?: number): WebGLTexture {
    const gl = this.gl; let t = this.texs.get(key);
    if (!t) { t = { tex: gl.createTexture()!, w: 0, h: 0, stamp: -1 }; this.texs.set(key, t); }
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    const same = dynamic && fid != null && t.fid === fid && t.w === w && t.h === h && t.stamp >= 0;
    if (!same && (dynamic || t.w !== w || t.h !== h || t.stamp < 0)) { t.fid = fid;
      try { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch { /* a frame not ready yet */ }
      this.params(); t.w = w; t.h = h; t.stamp = 1;
    }
    return t.tex;
  }
  forget(key: string) { const t = this.texs.get(key); if (t) { this.gl.deleteTexture(t.tex); this.texs.delete(key); } }
  forgetAll(prefix: string) { for (const k of [...this.texs.keys()]) if (k.startsWith(prefix)) this.forget(k); }
  draw(L: LayerDraw) {
    const gl = this.gl; if (!this.fbo.length) this.resize(this.W, this.H);
    const tex = this.texture(L.key, L.src, L.w, L.h, !!L.dynamic, L.fid);
    const from = this.fbo[this.cur], to = this.fbo[1 - this.cur];
    gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb); gl.viewport(0, 0, this.W, this.H); gl.useProgram(this.layer); gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(this.U.uSrc, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, from.tex); gl.uniform1i(this.U.uDst, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, L.lut ? L.lut.tex : this.emptyLut); gl.uniform1i(this.U.uLut, 2);
    gl.uniform2f(this.U.uFrame, this.W, this.H);
    const fh = L.stacked ? L.h / 2 : L.h, cw = L.w * (1 - L.transform.crop[0] - L.transform.crop[2]), ch = fh * (1 - L.transform.crop[1] - L.transform.crop[3]);
    gl.uniform2f(this.U.uSrcSize, Math.max(1, cw), Math.max(1, ch));
    gl.uniformMatrix3fv(this.U.uInv, false, inverse(this.W, this.H, cw, ch, L));
    gl.uniform4fv(this.U.uCrop, L.transform.crop); gl.uniform1f(this.U.uOpacity, Math.max(0, Math.min(1, L.opacity)));
    gl.uniform1i(this.U.uBlend, Math.max(0, BLENDS.indexOf(L.blend))); gl.uniform1f(this.U.uTime, this.time);
    const c = L.color;
    gl.uniform4f(this.U.uC1, c?.exposure || 0, c?.contrast || 0, c?.saturation || 0, c?.temperature || 0);
    gl.uniform4f(this.U.uC2, c?.tint || 0, c?.highlights || 0, c?.shadows || 0, c?.vibrance || 0);
    const hsl = new Float32Array(24); if (c) HUE_BANDS.forEach((b, i) => { const v = c.hsl[b] || [0, 0, 0]; hsl.set(v, i * 3); }); gl.uniform3fv(this.U.uHsl, hsl);
    gl.uniform1f(this.U.uLutAmt, L.lut ? L.lut.amount : 0); gl.uniform1f(this.U.uLutSize, L.lut ? L.lut.size : 2);
    const fx = new Float32Array(24); let box = [0.35, 0.35, 0.3, 0.3];
    for (const e of L.effects || []) { const i = FX.indexOf(e.type); if (i >= 0 && e.enabled) { fx[i] = Math.max(0.001, +(e.params.amount ?? 0.5)); if (i >= 22) box = [+(e.params.x ?? 0.35), +(e.params.y ?? 0.35), +(e.params.w ?? 0.3), +(e.params.h ?? 0.3)]; } }
    gl.uniform1fv(this.U.uFx, fx); gl.uniform4f(this.U.uBox, box[0], box[1], box[2], box[3]);
    gl.uniform1i(this.U.uTr, L.trans ? Math.max(0, TRANS.indexOf(L.trans.type)) : 0); gl.uniform1f(this.U.uTrK, L.trans ? L.trans.k : 0); gl.uniform1i(this.U.uTrRole, L.trans ? (L.trans.role === "a" ? 0 : 1) : -1);
    gl.uniform1i(this.U.uSrcFlipY, 0);
    const k = L.effects ? keyOf({ effects: L.effects }) : null; const kc = k ? rgbOf(k.color) : [0, 0, 0];
    gl.uniform4f(this.U.uKey, kc[0], kc[1], kc[2], k ? 1 : 0); gl.uniform4f(this.U.uKeyP, k?.sim || 0, k?.soft || 0, k?.spill || 0, k ? screenOf(k.color) : 0);
    gl.uniform1i(this.U.uStack, L.stacked ? 1 : 0); gl.uniform1f(this.U.uTexH, L.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); this.cur = 1 - this.cur;
  }
  /** show the result on the canvas */
  present() {
    const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.W, this.H); gl.useProgram(this.copy); gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbo[this.cur].tex); gl.uniform1i(gl.getUniformLocation(this.copy, "uTex"), 0); gl.uniform1i(gl.getUniformLocation(this.copy, "uFlipY"), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  readPixels(): Uint8Array { const gl = this.gl; const out = new Uint8Array(this.W * this.H * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[this.cur].fb); gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, out); return out; }
  makeLut(data: Float32Array, size: number): WebGLTexture {
    const gl = this.gl; const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_3D, t);
    const b = new Uint8Array(size * size * size * 4); for (let i = 0, j = 0; i < data.length; i += 3, j += 4) { b[j] = Math.round(Math.max(0, Math.min(1, data[i])) * 255); b[j + 1] = Math.round(Math.max(0, Math.min(1, data[i + 1])) * 255); b[j + 2] = Math.round(Math.max(0, Math.min(1, data[i + 2])) * 255); b[j + 3] = 255; }
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, b);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); return t;
  }
  dispose() { for (const k of [...this.texs.keys()]) this.forget(k); for (const f of this.fbo) { this.gl.deleteFramebuffer(f.fb); this.gl.deleteTexture(f.tex); } this.fbo = []; }
}

// output pixel (centred) → source pixel (centred, after crop): the inverse of fit · scale · rotate · flip · move
function inverse(W: number, H: number, sw: number, sh: number, L: LayerDraw): Float32Array {
  const base = L.fit === "frame" ? W / sw : L.fit === "cover" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
  const s = base * L.scale, a = (L.rotation * Math.PI) / 180, fx = L.transform.flipH ? -1 : 1, fy = L.transform.flipV ? -1 : 1;
  const tx = L.x * W, ty = -L.y * H;   // y up in GL, the model uses y down
  // forward: out = T · R(−a) · S · F · src (a positive angle turns clockwise on screen) → src = F · S⁻¹ · R(a) · (out − T)
  const c = Math.cos(a), n = Math.sin(a);
  // rows of the 3×3 (column-major for GL)
  const m00 = (c / s) * fx, m01 = (-n / s) * fx, m10 = (n / s) * fy, m11 = (c / s) * fy;
  const ox = -(m00 * tx + m01 * ty), oy = -(m10 * tx + m11 * ty);
  return new Float32Array([m00, m10, 0, m01, m11, 0, ox, oy, 1]);
}

// a .cube file → its table (size³ rgb, red fastest)
export function parseCube(text: string): { size: number; data: Float32Array } {
  let size = 0; const vals: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim(); if (!l || l.startsWith("#")) continue;
    if (/^LUT_3D_SIZE/i.test(l)) { size = parseInt(l.split(/\s+/)[1], 10); continue; }
    if (/^(TITLE|DOMAIN_MIN|DOMAIN_MAX|LUT_1D_SIZE)/i.test(l)) continue;
    const p = l.split(/\s+/).map(Number); if (p.length === 3 && p.every((x) => isFinite(x))) vals.push(...p);
  }
  if (!size || vals.length !== size * size * size * 3) throw new Error("That isn't a 3D .cube LUT.");
  return { size, data: new Float32Array(vals) };
}
