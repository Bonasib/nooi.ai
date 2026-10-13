// nooi.ai · 3D Studio — picking the subject in a photo ("select the car").
//   • SAM (SlimSAM, on the device, via localInference.js) when its model can load: taps → an exact mask
//   • a classic, instant fallback that needs no download: geodesic segmentation — every pixel goes to whichever seed it can
//     reach more cheaply, where crossing a colour or depth edge is expensive (the photo's border always counts as background)
//   • autoSubject(): tries a few candidate points in the middle of the picture and keeps the most object-like mask
//     (not touching the border, compact, standing out in depth) — works with SAM or with the classic method
//   • helpers: cut-out (transparent PNG for the cloud engines), crop around the subject, mask overlay, bounding box
export function toGrid(img, maxSide = 360) { const k = Math.min(1, maxSide / Math.max(img.width, img.height)), w = Math.max(8, Math.round(img.width * k)), h = Math.max(8, Math.round(img.height * k)), c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h); return { w, h, data: x.getImageData(0, 0, w, h).data }; }
function resampleDepth(depth, w, h) { if (!depth) return null; const o = new Float32Array(w * h); let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = depth.depth[Math.min(depth.h - 1, Math.floor(((y + 0.5) / h) * depth.h)) * depth.w + Math.min(depth.w - 1, Math.floor(((x + 0.5) / w) * depth.w))]; o[y * w + x] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < o.length; i++) o[i] = (o[i] - lo) / (hi - lo || 1); return o; }
// min-heap of (cost, index) — 64-bit keys: with 32-bit ones a rounded-up distance looks "improvable" forever on flat colour
class Heap { constructor(n) { this.k = new Float64Array(n); this.v = new Int32Array(n); this.n = 0; }
  push(k, v) { let i = this.n++; while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= k) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; } this.k[i] = k; this.v[i] = v; }
  pop() { const k0 = this.k[0], v0 = this.v[0], k = this.k[--this.n], v = this.v[this.n]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= this.n) break; if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++; if (this.k[c] >= k) break; this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c; } this.k[i] = k; this.v[i] = v; this.top = k0; return v0; } }
function geodesic(G, D, seeds, depthW) { const { w, h, data } = G, n = w * h, dist = new Float64Array(n).fill(Infinity), H = new Heap(n * 4 + 16);
  for (const s of seeds) { dist[s] = 0; H.push(0, s); }
  const col = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  while (H.n) { const i = H.pop(), d0 = H.top; if (d0 > dist[i]) continue; const x = i % w, y = (i / w) | 0, a = col(i);
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) { if (j < 0) continue; const b = col(j);
      const dc = Math.hypot(a[0] - b[0], (a[1] - b[1]) * 1.2, a[2] - b[2]) / 255, dd = D ? Math.abs(D[i] - D[j]) * depthW : 0, nd = d0 + 0.004 + dc * dc * 14 + dc * 0.6 + dd; if (nd < dist[j]) { dist[j] = nd; H.push(nd, j); } } }
  return dist; }
export function cleanMask(m, w, h, keepAt) { // largest piece (or the one under keepAt), holes filled
  const lab = new Int32Array(w * h).fill(-1), sizes = []; let id = 0;
  for (let s = 0; s < w * h; s++) { if (!m[s] || lab[s] >= 0) continue; let c = 0; const q = [s]; lab[s] = id; while (q.length) { const i = q.pop(); c++; const x = i % w, y = (i / w) | 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && m[j] && lab[j] < 0) { lab[j] = id; q.push(j); } } sizes.push(c); id++; }
  if (!sizes.length) return m; let keep = sizes.indexOf(Math.max(...sizes)); if (keepAt != null && lab[keepAt] >= 0) keep = lab[keepAt];
  const out = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) out[i] = lab[i] === keep ? 1 : 0;
  const reach = new Uint8Array(w * h), st = []; for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) { const i = st.pop(); if (reach[i] || out[i]) continue; reach[i] = 1; const x = i % w, y = (i / w) | 0; if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w); }
  for (let i = 0; i < w * h; i++) if (!reach[i]) out[i] = 1; return out; }
// classic selection from taps: points [{x, y, label}] normalised 0..1
export function classicMask(G, points, depth) { const { w, h } = G, D = resampleDepth(depth, w, h), pos = [], neg = [], r = Math.max(1, Math.round(Math.min(w, h) * 0.012));
  for (const p of points) { const cx = Math.round(p.x * (w - 1)), cy = Math.round(p.y * (h - 1)); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w || y >= h || dx * dx + dy * dy > r * r) continue; (p.label ? pos : neg).push(y * w + x); } }
  if (!pos.length) return null; for (let x = 0; x < w; x++) neg.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) neg.push(y * w, y * w + w - 1);
  const dF = geodesic(G, D, pos, 6), dB = geodesic(G, D, neg, 6), m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) m[i] = dF[i] < dB[i] ? 1 : 0;
  const keepAt = pos[(pos.length / 2) | 0]; return { mask: cleanMask(m, w, h, keepAt), w, h }; }
// how much a mask looks like "the main object": inside the frame, a sensible size, compact, and nearer than its surroundings
export function objectScore(mask, w, h, D) { let n = 0, edge = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, din = 0, dout = 0, nout = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (mask[i]) { n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge++; if (D) din += D[i]; } else if (D) { dout += D[i]; nout++; } }
  if (!n) return { score: 0 }; const area = n / (w * h), fill = n / ((x1 - x0 + 1) * (y1 - y0 + 1)), border = edge / (2 * (w + h)), cx = sx / n / w - 0.5, cy = sy / n / h - 0.5;
  const sizeOk = area < 0.015 ? area / 0.015 : area > 0.7 ? Math.max(0, (0.95 - area) / 0.25) : 1, depthPop = D && nout ? Math.max(0, Math.min(1, (din / n - dout / nout) * 3 + 0.5)) : 0.5;
  const score = sizeOk * (0.35 + 0.65 * fill) * Math.max(0, 1 - border * 8) * (1 - Math.min(0.6, Math.hypot(cx, cy))) * (0.5 + depthPop);
  return { score, area, fill, border, box: [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h] }; }
export const CANDIDATES = [[0.5, 0.5], [0.5, 0.42], [0.5, 0.6], [0.4, 0.5], [0.6, 0.5], [0.5, 0.33], [0.5, 0.68], [0.35, 0.4], [0.65, 0.4]];
// the best "main object": maskAt(point) → {mask,w,h} (SAM or classic)
export async function autoSubject(maskAt, G, depth, hint) { const D = depth ? resampleDepth(depth, G.w, G.h) : null; let best = null; const pts = hint ? [hint, ...CANDIDATES] : CANDIDATES;
  for (const [x, y] of pts) { const r = await maskAt([{ x, y, label: 1 }]); if (!r) continue; const Dm = D && (r.w !== G.w || r.h !== G.h) ? resampleDepth(depth, r.w, r.h) : D, s = objectScore(r.mask, r.w, r.h, Dm);
    if (!best || s.score > best.s.score) best = { r, s, point: [x, y] }; if (hint && best && best.s.score > 0.35) break; }
  return best; }
// SAM's full-size alpha (0/255) → a 0/1 mask on a smaller grid
export function alphaToMask(a, maxSide = 360) { const k = Math.min(1, maxSide / Math.max(a.w, a.h)), w = Math.max(8, Math.round(a.w * k)), h = Math.max(8, Math.round(a.h * k)), m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = a.alpha[Math.min(a.h - 1, Math.floor(((y + 0.5) / h) * a.h)) * a.w + Math.min(a.w - 1, Math.floor(((x + 0.5) / w) * a.w))] > 127 ? 1 : 0; return { mask: m, w, h }; }
// a soft-edged alpha at the photo's size from a grid mask (for the reconstruction and the cut-out)
export function maskToAlpha(M, W, H) { const c = document.createElement("canvas"); c.width = M.w; c.height = M.h; const x = c.getContext("2d"), d = x.createImageData(M.w, M.h); for (let i = 0; i < M.w * M.h; i++) { d.data[i * 4 + 3] = M.mask[i] ? 255 : 0; } x.putImageData(d, 0, 0);
  const o = document.createElement("canvas"); o.width = W; o.height = H; const ox = o.getContext("2d", { willReadFrequently: true }); ox.imageSmoothingEnabled = true; ox.filter = "blur(" + Math.max(0.6, W / M.w * 0.6) + "px)"; ox.drawImage(c, 0, 0, W, H);
  const a = ox.getImageData(0, 0, W, H).data, al = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) al[i] = a[i * 4 + 3]; return { alpha: al, w: W, h: H }; }
export function maskBox(M) { let x0 = M.w, x1 = -1, y0 = M.h, y1 = -1; for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.mask[y * M.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0 / M.w, y0 / M.h, (x1 + 1) / M.w, (y1 + 1) / M.h]; }
// crop the photo + its alpha around the subject (a margin keeps context for the depth model)
export function cropToSubject(img, alpha, box, margin = 0.08) { const W = img.width, H = img.height, mw = (box[2] - box[0]) * margin + 0.01, mh = (box[3] - box[1]) * margin + 0.01;
  const x0 = Math.max(0, Math.floor((box[0] - mw) * W)), y0 = Math.max(0, Math.floor((box[1] - mh) * H)), x1 = Math.min(W, Math.ceil((box[2] + mw) * W)), y1 = Math.min(H, Math.ceil((box[3] + mh) * H)), cw = x1 - x0, ch = y1 - y0;
  const c = document.createElement("canvas"); c.width = cw; c.height = ch; c.getContext("2d").drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
  const a = new Uint8Array(cw * ch); for (let y = 0; y < ch; y++) a.set(alpha.alpha.subarray((y + y0) * alpha.w + x0, (y + y0) * alpha.w + x0 + cw), y * cw); return { image: c, alpha: { alpha: a, w: cw, h: ch }, rect: [x0, y0, cw, ch] }; }
// transparent PNG of just the subject (what the cloud 3D engines like best)
export function cutoutPNG(crop) { const c = document.createElement("canvas"); c.width = crop.image.width; c.height = crop.image.height; const x = c.getContext("2d"); x.drawImage(crop.image, 0, 0); const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < c.width * c.height; i++) d.data[i * 4 + 3] = crop.alpha.alpha[i]; x.putImageData(d, 0, 0); return new Promise((ok) => c.toBlob(ok, "image/png")); }
// draw the photo with the selection tinted and the tap points
export function drawSelection(cv, img, M, points, color = "rgba(156,210,69,.45)") { const x = cv.getContext("2d"), W = cv.width, H = cv.height; x.clearRect(0, 0, W, H); x.drawImage(img, 0, 0, W, H);
  if (M) { const c = document.createElement("canvas"); c.width = M.w; c.height = M.h; const cx = c.getContext("2d"), d = cx.createImageData(M.w, M.h); for (let i = 0; i < M.w * M.h; i++) if (!M.mask[i]) d.data[i * 4 + 3] = 150; cx.putImageData(d, 0, 0);
    x.save(); x.imageSmoothingEnabled = true; x.drawImage(c, 0, 0, W, H); x.restore(); const e = document.createElement("canvas"); e.width = M.w; e.height = M.h; const ex = e.getContext("2d"), ed = ex.createImageData(M.w, M.h);
    for (let y = 1; y < M.h - 1; y++) for (let X = 1; X < M.w - 1; X++) { const i = y * M.w + X; if (M.mask[i] && (!M.mask[i - 1] || !M.mask[i + 1] || !M.mask[i - M.w] || !M.mask[i + M.w])) { ed.data[i * 4] = 156; ed.data[i * 4 + 1] = 210; ed.data[i * 4 + 2] = 69; ed.data[i * 4 + 3] = 255; } }
    ex.putImageData(ed, 0, 0); x.drawImage(e, 0, 0, W, H); }
  for (const p of points || []) { x.beginPath(); x.arc(p.x * W, p.y * H, Math.max(5, W / 90), 0, 6.3); x.fillStyle = p.label ? "#9cd245" : "#ef5b5b"; x.fill(); x.lineWidth = 2; x.strokeStyle = "#fff"; x.stroke(); } }
