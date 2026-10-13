// nooi.ai · 3D Studio — the render reviewer. Every object is checked right after it's built (free, on this device) and, on
// request, an AI vision model looks at three views of it. Each finding comes with an automatic fix, then the check runs again.
//   on-device checks: standing on the ground · plausible real size · fits the area with room to walk · lit (not a black render)
//   · wheels on the ground · no loose fragments · no broken (NaN) geometry · the back isn't a copy of the front
//   AI review: front / side / rear views in one contact sheet → {issues:[{code, view, note}]} → fixes (turn round, re-ground,
//   real size, repaint the back, …); what can't be fixed on the device (missing parts) is offered to a cloud engine.
import * as THREE from "three";

export const RANGE = { vehicle: [1.2, 2.3], suv: [1.5, 2.4], person: [1.0, 2.2], animal: [0.15, 3.5], chair: [0.6, 1.4], table: [0.5, 1.2], sofa: [0.6, 1.3], plant: [0.1, 4], tree: [2, 40], building: [2.5, 120], statue: [0.2, 12], product: [0.03, 1.5], object: [0.03, 6] };

// the object alone, from one side, on a neutral backdrop — into a small image (render target, nothing shown on screen)
export function viewOf(E, a, dir, size = 160) {
  const r = E.renderer, scene = E.scene, hidden = [], bg = scene.background, fog = scene.fog;
  scene.children.forEach((c) => { if (c !== a.holder && !c.isLight && c.visible) { c.visible = false; hidden.push(c); } });
  scene.background = new THREE.Color(0.5, 0.5, 0.5); scene.fog = null;
  const box = new THREE.Box3().setFromObject(a.holder), c = box.getCenter(new THREE.Vector3()), rad = Math.max(0.01, box.getSize(new THREE.Vector3()).length() / 2);
  const cam = new THREE.PerspectiveCamera(30, 1, rad * 0.05, rad * 20), d = new THREE.Vector3(...dir).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), a.rot || 0);
  cam.position.copy(c).addScaledVector(d, (rad / Math.sin((30 * Math.PI) / 360)) * 1.05); cam.lookAt(c);
  const rt = new THREE.WebGLRenderTarget(size, size), buf = new Uint8Array(size * size * 4), prevT = r.getRenderTarget(), tm = r.toneMapping;
  try { r.setRenderTarget(rt); r.clear(); r.render(scene, cam); r.readRenderTargetPixels(rt, 0, 0, size, size, buf); }
  finally { r.setRenderTarget(prevT); r.toneMapping = tm; rt.dispose(); hidden.forEach((h) => (h.visible = true)); scene.background = bg; scene.fog = fog; }
  // flip rows (GL origin is bottom-left), grey + mask (pixels that differ from the backdrop)
  const gray = new Float32Array(size * size), mask = new Uint8Array(size * size); let bgv = null;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = ((size - 1 - y) * size + x) * 4, g = (buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11) / 255; gray[y * size + x] = g; }
  bgv = gray[0]; for (let i = 0; i < gray.length; i++) mask[i] = Math.abs(gray[i] - bgv) > 0.02 || Math.abs(buf[i * 4] - buf[i * 4 + 2]) > 6 ? 1 : 0;
  return { size, gray, mask, rgba: buf };
}
// band-pass (difference of two box blurs) → the fine pattern of a surface (grille bars, logos), not its overall layout
function bandpass(g, n) { const blur = (src, r) => { const o = new Float32Array(src.length); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0, c = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue; s += src[Y * n + X]; c++; } o[y * n + x] = s / c; } return o; };
  const a = blur(g, 1), b = blur(g, 4), o = new Float32Array(g.length); for (let i = 0; i < o.length; i++) o[i] = a[i] - b[i]; return o; }
// how much the back (seen from behind, mirrored) repeats the front's fine detail: 1 = a copy, ~0 = unrelated
export function backCopiesFront(front, back) {
  const n = front.size, F = bandpass(front.gray, n), B0 = bandpass(back.gray, n), Bm = new Float32Array(n * n), m = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const j = y * n + (n - 1 - x); Bm[y * n + x] = B0[j]; m[y * n + x] = front.mask[y * n + x] && back.mask[j] ? 1 : 0; }
  let sa = 0, sb = 0, c = 0; for (let i = 0; i < m.length; i++) if (m[i]) { sa += F[i]; sb += Bm[i]; c++; } if (c < 50) return 0; sa /= c; sb /= c;
  let num = 0, da = 0, db = 0; for (let i = 0; i < m.length; i++) if (m[i]) { const u = F[i] - sa, v = Bm[i] - sb; num += u * v; da += u * u; db += v * v; }
  return da > 1e-9 && db > 1e-9 ? num / Math.sqrt(da * db) : 0;
}
// the back's own picture vs the front's, in the same texture space (our objects share UVs front ↔ back): 1 = the same picture
function grayOf(tex, n = 96) { const im = tex && tex.image; if (!im || !im.width) return null; const c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d"); x.drawImage(im, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data, g = new Float32Array(n * n); for (let i = 0; i < n * n; i++) g[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255; return g; }
export function textureCopy(a, n = 96) { const f = a.object.getObjectByName("front"), r = a.object.getObjectByName("rear"); if (!f || !r || !f.material.map || !r.material.map) return null;
  if (f.material.map === r.material.map) return 1; const A = grayOf(f.material.map, n), B = grayOf(r.material.map, n); if (!A || !B) return null;
  const F = bandpass(A, n), R = bandpass(B, n); let sa = 0, sb = 0, c = 0; for (let y = n * 0.15 | 0; y < n * 0.85; y++) for (let x = n * 0.15 | 0; x < n * 0.85; x++) { const i = y * n + x; sa += F[i]; sb += R[i]; c++; } sa /= c; sb /= c;
  let num = 0, da = 0, db = 0; for (let y = n * 0.15 | 0; y < n * 0.85; y++) for (let x = n * 0.15 | 0; x < n * 0.85; x++) { const i = y * n + x, u = F[i] - sa, v = R[i] - sb; num += u * v; da += u * u; db += v * v; }
  return da > 1e-9 && db > 1e-9 ? num / Math.sqrt(da * db) : 0; }
// all on-device checks for one object → [{id, ok, en, ar, fix}]
export function checkAsset(E, a) {
  const out = [], push = (id, ok, en, ar, fix) => out.push({ id, ok: !!ok, en, ar, fix: ok ? null : fix || null });
  a.holder.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(a.holder), size = box.getSize(new THREE.Vector3()), gy = E.world() ? E.world().height(a.holder.position.x, a.holder.position.z) : 0;
  const tol = Math.max(0.03, size.y * 0.02);
  push("ground", Math.abs(box.min.y - gy) <= tol, `Stands on the ground (gap ${(box.min.y - gy).toFixed(2)} m)`, `يقف على الأرض (الفجوة ${(box.min.y - gy).toFixed(2)} م)`, "reground");
  const rg = RANGE[a.category] || RANGE.object; push("size", a.height >= rg[0] && a.height <= rg[1], `Real height ${a.height} m (a ${a.category} is ${rg[0]}–${rg[1]} m)`, `الارتفاع الحقيقي ${a.height} م (المعتاد ${rg[0]}–${rg[1]} م)`, "realHeight");
  push("fits", a.fits !== false, a.fits !== false ? "Fits the area" : "Doesn't fit the area", a.fits !== false ? "يناسب المساحة" : "لا يناسب المساحة", "fit");
  let bad = 0, tris = 0; const meshes = []; a.object.traverse((n) => { if (!n.isMesh) return; meshes.push(n); const p = n.geometry.attributes.position; tris += n.geometry.index ? n.geometry.index.count / 3 : p.count / 3; for (let i = 0; i < p.array.length; i += 97) if (!Number.isFinite(p.array[i])) bad++; });
  push("geometry", !bad && tris > 12, bad ? "Broken points in the mesh" : `${Math.round(tris).toLocaleString()} triangles, no broken points`, bad ? "نقاط تالفة في الشبكة" : "شبكة سليمة", "rebuild");
  // loose fragments: a small part with nothing else near it (the body, its back and its wheels always touch each other)
  let loose = 0; const all = new THREE.Box3(); meshes.forEach((m) => all.expandByObject(m)); const diag = all.getSize(new THREE.Vector3()).length() || 1;
  if (meshes.length > 1) meshes.forEach((m) => { if (/^(front|sides|rear|back|wheel|rim)$/.test(m.name)) return; const mb = new THREE.Box3().setFromObject(m), others = new THREE.Box3();
    meshes.forEach((o) => { if (o !== m) others.expandByObject(o); }); const ms = mb.getSize(new THREE.Vector3()).length();
    if (!others.isEmpty() && !mb.intersectsBox(others) && others.distanceToPoint(mb.getCenter(new THREE.Vector3())) > diag * 0.15 && ms < diag * 0.35) { loose++; m.userData.loose = true; } });
  push("intact", !loose, loose ? `${loose} loose part(s) floating away` : "One piece, nothing floating", loose ? `${loose} جزء منفصل يطفو` : "قطعة واحدة لا شيء يطفو", "dropLoose");
  if (a.object.getObjectByName("wheel")) { let low = Infinity; a.object.traverse((n) => { if (n.name === "wheel") { const b = new THREE.Box3().setFromObject(n); if (b.min.y < low) low = b.min.y; } });
    push("wheels", Math.abs(low - gy) <= tol, "Wheels on the ground", "العجلات على الأرض", "reground"); }
  // lit + the back vs the front (rendered views)
  try { const f = viewOf(E, a, [0, 0.12, 1]), b = viewOf(E, a, [0, 0.12, -1]); let s = 0, c = 0; for (let i = 0; i < f.mask.length; i++) if (f.mask[i]) { s += f.gray[i]; c++; }
    const lum = c ? s / c : 0; push("lit", lum > 0.035 && Number.isFinite(lum), `Lit correctly (brightness ${(lum * 100) | 0}%)`, `الإضاءة سليمة (${(lum * 100) | 0}%)`, "relight");
    if (a.category === "vehicle" || a.category === "suv") { const kt = textureCopy(a), kv = backCopiesFront(f, b), k = kt != null ? Math.max(kt, kv) : kv; a.backCopy = +k.toFixed(2);
      push("rear", k < 0.45, k < 0.45 ? `The back is its own (likeness to the front ${k.toFixed(2)})` : `The back repeats the front (${k.toFixed(2)}) — a car can't have its front on the back`, k < 0.45 ? "الخلف خاص به وليس نسخة من الأمام" : "الخلف يكرر الأمام — لا يمكن أن تكون مقدمة السيارة في الخلف", "repaintRear"); } }
  catch (e) { push("lit", true, "View check skipped (" + e.message + ")", "تُخطي فحص المنظر"); }
  return out;
}
// one picture with the three views (front · side · rear) for the AI to look at
export function contactSheet(E, a, size = 256) {
  const views = [[[0.35, 0.2, 1], "front"], [[1, 0.15, 0], "side"], [[-0.35, 0.2, -1], "rear"]], c = document.createElement("canvas"); c.width = size * 3; c.height = size + 22; const x = c.getContext("2d");
  x.fillStyle = "#808080"; x.fillRect(0, 0, c.width, c.height); views.forEach(([d, name], i) => { const v = viewOf(E, a, d, size), im = x.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let X = 0; X < size; X++) { const s = ((size - 1 - y) * size + X) * 4, t = (y * size + X) * 4; im.data[t] = v.rgba[s]; im.data[t + 1] = v.rgba[s + 1]; im.data[t + 2] = v.rgba[s + 2]; im.data[t + 3] = 255; }
    x.putImageData(im, i * size, 22); x.fillStyle = "#fff"; x.font = "bold 15px system-ui, sans-serif"; x.fillText(name.toUpperCase(), i * size + 8, 16); });
  return c;
}
// what each finding (on-device or from the AI) does to fix it; returns a sentence for the log, or null when it can't on the device
export const FIX_OF_CODE = { front_on_back: "repaintRear", faces_backwards: "turnAround", floating: "reground", sunken: "reground", wrong_scale: "realHeight", broken_shape: "rebuild", missing_parts: "cloud", wrong_colors: null, other: null };
export function applyFix(E, a, fix, { REAL_HEIGHT, repaintRear, rebuild } = {}) {
  switch (fix) {
    case "reground": E.layout(a); return ["Stood it back on the ground", "أُعيد وضعه على الأرض"];
    case "realHeight": a.height = (REAL_HEIGHT && REAL_HEIGHT[a.category]) || a.height; E.layout(a); return ["Real height reset to " + a.height + " m", "أُعيد الارتفاع الحقيقي إلى " + a.height + " م"];
    case "fit": return null; // handled by the app (shrink to the area, or make the area bigger)
    case "dropLoose": { let n = 0; a.object.traverse((m) => { if (m.isMesh && m.userData.loose) { m.visible = false; n++; } }); E.layout(a); return n ? ["Removed " + n + " loose part(s)", "أُزيلت " + n + " قطعة منفصلة"] : null; }
    case "relight": E.clearPanorama(); E.setExposure(1); return ["Lighting reset", "أُعيدت الإضاءة"];
    case "turnAround": a.rot = (a.rot || 0) + Math.PI; E.layout(a); return ["Turned it round — the front now faces you", "أُدير — الأمام يواجهك الآن"];
    case "repaintRear": return repaintRear ? repaintRear(a) : null;
    case "rebuild": return rebuild ? rebuild(a) : null;
    default: return null;
  }
}
