// nooi.ai · 3D Studio — one tool for 3D: photo → object, world, life & weather, walk-through, video, export.
// It replaces 3D Studio (SAM 3D), 3D worlds, 3D World Studio and On-device 3D. Free steps run on this device (WebGPU / WebGL2 /
// CPU); steps that generate what a photo can't show (the hidden sides, a painted 360° sky) use nooi credits through the app.
import { THREE, createEngine, REAL_HEIGHT, TOD } from "./engine.js";
import { BIOMES, BIOME_IDS } from "./world.js";
import { detectDevice, LocalInference, reconstruct, IDBModelCache } from "./localInference.js";
import { RECON_WGSL } from "./shaders.js";
import { toGrid, classicMask, alphaToMask, maskToAlpha, maskBox, cropToSubject, cutoutPNG, drawSelection, autoSubject, objectScore } from "./segment.js";
import { parsePrompt, makePlan, techniques, fitNote } from "./planner.js";
import { EMBED, call, follow } from "./bridge.js";

const q = new URLSearchParams(location.search), AR = (q.get("lang") || (EMBED ? "en" : navigator.language || "")).startsWith("ar");
document.documentElement.lang = AR ? "ar" : "en"; document.documentElement.dir = AR ? "rtl" : "ltr"; if (EMBED) document.body.classList.add("embed");
const L = (en, ar) => (AR ? ar : en), $ = (id) => document.getElementById(id), esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtMB = (b) => (b / 1048576).toFixed(b > 104857600 ? 0 : 1) + " MB", sleep = (ms) => new Promise((r) => setTimeout(r, ms));
document.querySelectorAll("[data-t]").forEach((el) => { const v = el.dataset.t.split("|"); if (AR && v[1]) el.textContent = v[1]; });
document.querySelectorAll("[data-ph]").forEach((el) => { const v = el.dataset.ph.split("|"); el.placeholder = AR && v[1] ? v[1] : v[0]; });

// shape & depth of the hidden side by kind of object (× its width)
const SHAPE = { suv: ["solid", 2.55, 0.05], vehicle: ["solid", 2.35, 0.05], chair: ["solid", 1], table: ["solid", 1.6], sofa: ["solid", 0.45], building: ["solid", 1], product: ["solid", 0.6], statue: ["pillow", 0.5], person: ["pillow", 0.45], animal: ["pillow", 0.5], plant: ["pillow", 0.45], tree: ["pillow", 0.45], object: ["solid", 0.8] };
const CATS = [["suv", "SUV / 4×4", "دفع رباعي"], ["vehicle", "Car", "سيارة"], ["person", "Person", "شخص"], ["animal", "Animal", "حيوان"], ["chair", "Chair", "كرسي"], ["table", "Table", "طاولة"], ["sofa", "Sofa", "كنبة"], ["plant", "Plant", "نبتة"], ["tree", "Tree", "شجرة"], ["statue", "Statue", "تمثال"], ["building", "Building", "مبنى"], ["product", "Product", "منتج"], ["object", "Other object", "عنصر آخر"]];

const S = { dev: null, E: null, ai: null, aiOk: true, cfg: { nooi: false }, img: null, blob: null, name: "", G: null, M: null, points: [], pmode: 1, samReady: null, depthFull: null, crop: null, label: "", category: "object", height: null,
  shape: null, length: null, res: null, plan: null, busy: false, log: [], lastVideo: null, clouds: {}, choice: {}, stepOn: {} };
const cache = new IDBModelCache("nooi-local3d-models");

// ───────── status / log ─────────
function status(t, p) { const el = $("status"); if (!t) { el.hidden = true; return; } el.hidden = false; $("statusTxt").textContent = t; $("statusBar").style.width = p == null ? "0" : Math.round(p * 100) + "%"; $("statusBar").parentElement.hidden = p == null; }
function log(en, ar, tech) { S.log.push({ t: new Date().toLocaleTimeString(), m: L(en, ar), tech }); $("log").innerHTML = S.log.slice(-40).map((x) => "<li><time>" + x.t + "</time> " + esc(x.m) + (x.tech ? ' <span class="tag">' + esc(x.tech) + "</span>" : "") + "</li>").join(""); }
function toast(t, kind) { const el = $("toast"); el.textContent = t; el.className = "toast show " + (kind || ""); clearTimeout(el._t); el._t = setTimeout(() => (el.className = "toast"), 3600); }
function fail(e) { const m = (e && e.message) || String(e); status(null); toast(m, "bad"); log("Stopped: " + m, "توقف: " + m); }

// ───────── boot ─────────
S.dev = await detectDevice();
const tier = S.dev.mobile || (S.dev.memoryGB && S.dev.memoryGB <= 4) ? "low" : "high";
$("badge").textContent = S.dev.webgpu ? "WebGPU ✓" : S.dev.webgl2 ? L("WebGL2 · CPU AI", "WebGL2 · ذكاء على المعالج") : L("No 3D", "لا يوجد 3D"); $("badge").className = "badge " + (S.dev.webgpu ? "ok" : "warn");
const kv = [[L("AI runs on", "الذكاء يعمل على"), S.dev.webgpu ? "WebGPU" + (S.dev.f16 ? " · fp16" : "") : L("CPU (WASM)", "المعالج (WASM)")], [L("GPU", "المعالج الرسومي"), S.dev.adapter || S.dev.webglRenderer || "—"], ["3D", S.dev.webgl2 ? "WebGL2" : "—"], [L("Quality", "الجودة"), tier === "low" ? L("Light (phone)", "خفيفة (هاتف)") : L("Full", "كاملة")], [L("Cores", "الأنوية"), S.dev.cores], [L("Memory", "الذاكرة"), S.dev.memoryGB ? S.dev.memoryGB + " GB" : "—"]];
$("devKv").innerHTML = kv.map(([k, v]) => "<span>" + k + "</span><span>" + esc(v) + "</span>").join("");
const AR_ADV = { "WebGPU isn't": "WebGPU غير مفعّل في هذا المتصفح — يعمل الذكاء على المعالج (أبطأ) وتستخدم الأبعاد الثلاثية WebGL2.", "Neither WebGPU": "لا يتوفر WebGPU ولا WebGL2 — جرّب أحدث إصدار من Chrome أو Edge أو Safari.", "iPhone / iPad": "آيفون / آيباد: الإعدادات ← التطبيقات ← Safari ← متقدم ← Feature Flags ← فعّل WebGPU (iOS 17/18)، أو حدّث إلى iOS 26.", "Android:": "أندرويد: استخدم Chrome 121 أو أحدث.", "Desktop:": "الحاسوب: Chrome / Edge 113+ أو Safari 26+." };
if (S.dev.advice.length) { $("devAdvice").hidden = false; $("devAdvice").innerHTML = S.dev.advice.map((a) => { if (AR) for (const k in AR_ADV) if (a.startsWith(k)) a = AR_ADV[k]; return "<li>" + esc(a) + "</li>"; }).join(""); }
async function showCache() { try { const u = await cache.usage(); $("cacheTxt").textContent = u.files ? u.files + L(" files · ", " ملفات · ") + fmtMB(u.bytes) : L("No AI models saved yet", "لا نماذج محفوظة بعد"); } catch (e) { $("cacheTxt").textContent = "—"; } }
showCache(); $("clearCache").onclick = async () => { await cache.clear(); showCache(); };
if (!S.dev.webgl2) { $("noGL").hidden = false; throw new Error("no WebGL2"); }
const E = (S.E = createEngine($("cv"), { tier, mobile: S.dev.mobile }));
E.setWorld({ biome: q.get("biome") || "rainforest", size: [8, 8] }); E.setMode("orbit"); E.frame();

// the app (inside nooi): what this account can use, credits, a photo handed over from another tool
async function loadCfg() { if (!EMBED) { renderCaps(); return; } try { S.cfg = Object.assign({ nooi: true }, await call("cfg", {}, { timeout: 8000 })); } catch (e) { S.cfg = { nooi: true, offline: true }; }
  renderCaps(); if (S.cfg.photo && S.cfg.photo.blob) await setPhoto(S.cfg.photo.blob, S.cfg.photo.name || "photo", S.cfg.photo.mode); if (S.cfg.glb && S.cfg.glb.blob) await addGLB(S.cfg.glb.blob, S.cfg.glb.name || "3D", "library"); }
function renderCaps() { const c = S.cfg; $("credits").hidden = !(c.nooi && c.credits != null); $("credits").textContent = (c.credits ?? "") + " cr"; $("standalone").hidden = !!c.nooi; }
function cap() { const c = S.cfg, k = c.cap || {}; return Object.assign({ nooi: !!c.nooi, signedIn: !!c.signedIn, server: !!c.server, cost: c.cost || {}, webgpu: S.dev.webgpu, webgl2: S.dev.webgl2, ai: S.aiOk, photo: !!S.img }, k); }

// ───────── 1 · the photo & the selection ─────────
async function setPhoto(blob, name, mode) {
  const img = await createImageBitmap(blob, { imageOrientation: "from-image" }).catch(() => null); if (!img) return toast(L("That picture couldn't be opened", "تعذّر فتح الصورة"), "bad");
  if (S.img && S.img.close) S.img.close(); Object.assign(S, { img, blob, name: (name || "photo").replace(/\.[a-z0-9]+$/i, "").slice(0, 40), G: toGrid(img, 360), M: null, points: [], samReady: null, depthFull: null, crop: null });
  const cv = $("selCv"), k = Math.min(1, 900 / img.width); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); $("selWrap").hidden = false; $("dropTxt").hidden = true; drawSel();
  $("photoChip").innerHTML = '<span class="chip on">📷 ' + esc(S.name) + "</span>"; if (mode && SHAPE[mode]) setCategory(mode); log("Photo added: " + S.name, "أُضيفت الصورة: " + S.name); renderPlan(); prepSam();
  $("pSubject").open = true; updateButtons();
}
function drawSel() { if (S.img) drawSelection($("selCv"), S.img, S.M, S.points); const box = S.M && maskBox(S.M); $("selTxt").textContent = S.M ? L("Selected · ", "محدد · ") + Math.round(S.M.mask.reduce((a, b) => a + b, 0) * 100 / S.M.mask.length) + "%" + (S.selHow ? " · " + S.selHow : "") : S.img ? L("Tap the object you want — or press Auto-select", "اضغط على العنصر الذي تريده — أو اضغط تحديد تلقائي") : ""; return box; }
// SAM: encode the picture once in the background (the first time also downloads the model, cached afterwards)
function aiClient() { if (!S.ai) S.ai = new LocalInference({ onProgress, plan: S.dev.plan, modelsHost: q.get("models") || (S.cfg.models && S.cfg.models.host) || undefined, ortBase: window.NOOI_LOCAL_VENDOR ? "/vendor/ort/" : undefined }); return S.ai; }
function prepSam() { if (window.__X3_TEST_MASK) { S.samReady = Promise.resolve(true); return; } if (!S.aiOk || !S.blob) { S.samReady = Promise.resolve(false); return; }
  S.samReady = aiClient().samEmbed(S.blob).then(() => { log("SAM ready on " + (S.dev.webgpu ? "WebGPU" : "CPU") + " — tap to select", "SAM جاهز على " + (S.dev.webgpu ? "WebGPU" : "المعالج") + " — اضغط للتحديد", "SAM"); return true; })
    .catch((e) => { S.aiOk = /fetch|load|library|network/i.test(e.message) ? false : S.aiOk; log("SAM unavailable (" + e.message.slice(0, 80) + ") — using instant select", "SAM غير متاح — يُستخدم التحديد الفوري", "classic"); renderPlan(); return false; }); }
async function maskAt(points) {
  if (window.__X3_TEST_MASK) { const a = await window.__X3_TEST_MASK(S.img, points); return a ? alphaToMask(a, 360) : null; }
  if (S.samReady && (await S.samReady)) { try { const a = await S.ai.samMask(points); S.selHow = "SAM"; return alphaToMask(a, 360); } catch (e) {} }
  S.selHow = L("instant", "فوري"); return classicMask(S.G, points, S.depthFull);
}
async function updateMask() { if (!S.points.some((p) => p.label)) { S.M = null; drawSel(); updateButtons(); return; } status(L("Selecting…", "جارٍ التحديد…")); const r = await maskAt(S.points); S.M = r && r.mask.some((v) => v) ? r : null; status(null); drawSel(); updateButtons(); }
async function autoSelect(hint) { if (!S.img) return; status(L("Finding the main object…", "جارٍ إيجاد العنصر الرئيسي…")); if (S.samReady) await S.samReady;
  const best = await autoSubject(maskAt, S.G, S.depthFull, hint); status(null); if (!best || best.s.score <= 0) { toast(L("Tap the object to select it", "اضغط على العنصر لتحديده")); return false; }
  S.M = best.r; S.points = [{ x: best.point[0], y: best.point[1], label: 1 }]; drawSel(); updateButtons(); log("Selected the " + (S.label || "main object") + " (" + (S.selHow || "") + ")", "حُدد " + (S.label || "العنصر الرئيسي"), S.selHow); return true; }
async function visionFind() { if (!S.img || !S.label) return autoSelect(); try { status(L("AI vision is looking for the ", "رؤية الذكاء تبحث عن ") + S.label + "…");
    const c = document.createElement("canvas"), k = Math.min(1, 768 / Math.max(S.img.width, S.img.height)); c.width = Math.round(S.img.width * k); c.height = Math.round(S.img.height * k); c.getContext("2d").drawImage(S.img, 0, 0, c.width, c.height);
    const r = await call("vision", { image: c.toDataURL("image/jpeg", 0.85), label: S.label }, { timeout: 90000 }); status(null);
    if (r && r.box) { const b = r.box, hint = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; log("AI vision found the " + S.label, "وجدت رؤية الذكاء " + S.label, "vision"); return autoSelect(hint); } } catch (e) { status(null); log("AI vision: " + e.message, "رؤية الذكاء: " + e.message); }
  return autoSelect(); }
$("selCv").addEventListener("click", (e) => { if (!S.img) return; const b = e.target.getBoundingClientRect(); S.points.push({ x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height, label: S.pmode }); updateMask(); });

// ───────── 2 · the 3D object ─────────
function setCategory(c) { S.category = SHAPE[c] ? c : "object"; $("cat").value = S.category; S.height = REAL_HEIGHT[S.category] || 0.6; $("height").value = S.height; S.shape = SHAPE[S.category][0]; S.length = SHAPE[S.category][1]; $("relief").value = SHAPE[S.category][2] || 0.12; $("o_relief").textContent = (+$("relief").value).toFixed(2); syncShape(); }
function syncShape() { document.querySelectorAll("#shapeSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === S.shape))); $("len").value = S.length; $("o_len").textContent = (+S.length).toFixed(2) + "×"; $("lenRow").hidden = S.shape !== "solid"; }
async function depthOf(canvas) {
  if (window.__X3_TEST_DEPTH) return window.__X3_TEST_DEPTH(canvas);
  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png")); const ai = aiClient(); status(L("Loading the depth AI…", "تحميل ذكاء العمق…"), 0); await ai.init(); status(L("Measuring depth on ", "قياس العمق على ") + (S.dev.webgpu ? "WebGPU" : L("the CPU", "المعالج")) + "…"); return ai.depth(blob);
}
async function make3D() {
  if (!S.img) throw new Error(L("Add a photo first", "أضف صورة أولاً")); if (!S.M && !(await autoSelect())) throw new Error(L("Select the object first", "حدّد العنصر أولاً"));
  const t0 = performance.now(), box = maskBox(S.M), alpha = maskToAlpha(S.M, S.img.width, S.img.height); S.crop = cropToSubject(S.img, alpha, box);
  const depth = await depthOf(S.crop.image); status(L("Building the 3D surface…", "بناء السطح ثلاثي الأبعاد…"));
  const out = await reconstruct(THREE, { image: S.crop.image, depth, alpha: S.crop.alpha, plan: S.dev.plan, WGSL: RECON_WGSL, opts: { res: S.res || S.dev.plan.meshRes, shape: S.shape, length: +S.length, depthScale: +$("relief").value, vehicle: S.category === "vehicle" || S.category === "suv" }, onStep: (k, i) => status(L("3D · ", "3D · ") + k + (i ? " · " + i : "")) });
  if (S.dev.plan.disposeAfterRun && S.ai) S.ai.dispose();
  const old = E.assets.find((a) => a.photoKey === S.name); const name = S.label ? S.label[0].toUpperCase() + S.label.slice(1) : S.name || "Object";
  let a; if (old) { old.height = +$("height").value || S.height; E.replaceAssetObject(old, out.group, "device"); a = old; } else a = E.addAsset(out.group, { name, category: S.category, height: +$("height").value || S.height, source: "device", rigid: S.category !== "plant" && S.category !== "tree" });
  a.photoKey = S.name; a.stats = out.stats; autoFit(a); status(null);
  log("3D object made on this device in " + Math.round(performance.now() - t0) + " ms (" + out.stats.triangles.toLocaleString() + " triangles, " + out.stats.shape + ", surface on " + out.stats.surface + ")", "صُنع المجسّم على جهازك في " + Math.round(performance.now() - t0) + " م.ث", out.stats.surface === "webgpu" ? "WebGPU compute" : "CPU");
  renderAssets(); E.frame(); return a;
}
// a real-size object bigger than the area: shrink it to leave ~0.8 m to walk around it, and say how to keep the real size
function autoFit(a) { const w = E.world().plot, side = Math.min(w.hw, w.hd) * 2; a.fit = 1; E.layout(a); const longest = Math.max(a.size[0], a.size[2]), room = Math.min(0.8, side * 0.16);
  if (longest + room * 2 > side && !a.keepReal) { a.realSize = a.size.slice(); a.fit = Math.max(0.2, (side - room * 2) / longest); E.layout(a); } else a.realSize = null; showFit(); }
function showFit() { const a = E.assets[0], w = E.state.size, el = $("fitWarn"); if (!a || !a.realSize) { el.hidden = true; return; } const n = fitNote({ name: a.name, size: a.realSize, fits: false }, { w: w[0], d: w[1] });
  el.hidden = false; el.innerHTML = esc(L(`At real size the ${a.name} is ${a.realSize[0]} × ${a.realSize[2]} m — bigger than the ${w[0]} × ${w[1]} m area, so it's shown at ${Math.round(a.fit * 100)}% to leave room to walk around it.`, `بالحجم الحقيقي ${a.name} أبعاده ${a.realSize[0]} × ${a.realSize[2]} م — أكبر من المساحة ${w[0]} × ${w[1]} م، لذا يظهر بنسبة ${Math.round(a.fit * 100)}% ليبقى مكان للمشي حوله.`)) +
    ' <button class="btn sm" data-x3="realSize">' + esc(L(`Real size · area ${n.need} × ${n.need} m`, `الحجم الحقيقي · مساحة ${n.need} × ${n.need} م`)) + "</button>"; }
async function addGLB(blob, name, source) { const url = URL.createObjectURL(blob); try { const obj = await E.loadGLB(url); const a = E.addAsset(obj, { name, category: S.category || "object", height: +$("height").value || REAL_HEIGHT[S.category] || 0.8, source }); autoFit(a); renderAssets(); E.frame(); return a; } finally { setTimeout(() => URL.revokeObjectURL(url), 4000); } }
// the hidden parts generated by AI (credits): the clean cut-out goes to the engine; the result replaces the preview in place
async function cloudUpgrade(engine, a) {
  a = a || E.assets[E.assets.length - 1]; if (!a) throw new Error(L("Make the 3D object first", "اصنع المجسّم أولاً")); if (!S.crop) throw new Error(L("Select the object in the photo first", "حدّد العنصر في الصورة أولاً"));
  const T = techniques(cap()).find((t) => t.id === engine); if (!T || !T.ok) throw new Error(L("This engine isn't available on your account", "هذا المحرك غير متاح لحسابك"));
  const png = await cutoutPNG(S.crop), desc = S.label || a.name; status(L("Sending to ", "إرسال إلى ") + L(T.en, T.ar).split(" — ")[0] + "…");
  const r = await call(engine === "views" ? "views" : "job3d", { engine, blob: png, name: a.name, prompt: desc, category: S.category }, { timeout: 30000 }); status(null);
  if (r && r.credits != null) { S.cfg.credits = r.credits; renderCaps(); }
  a.cloud = { engine, id: r.id, status: "queued", progress: 0 }; renderAssets(); log("AI is generating the missing parts with " + T.en.split(" — ")[0] + " (" + T.cost + " cr)", "الذكاء يولّد الأجزاء الناقصة بـ " + T.ar.split(" — ")[0], T.where);
  return new Promise((done) => { follow([r.id], async (j) => { a.cloud = Object.assign(a.cloud, { status: j.status, progress: j.progress || 0, error: j.error }); renderAssets();
    if (j.status === "complete" && j.url) { try { const b = await call("fetch", { url: j.url }, { timeout: 120000 }); const obj = await E.loadGLB(URL.createObjectURL(b)); E.replaceAssetObject(a, obj, engine); autoFit(a); a.cloud.status = "done";
        log("Full 3D from " + T.en.split(" — ")[0] + " replaced the preview — every side is generated now", "حلّ مجسّم كامل من " + T.ar.split(" — ")[0] + " محل المعاينة", T.where); toast(L("Full 3D ready — all sides generated", "المجسّم الكامل جاهز — كل الجوانب مولّدة"), "ok"); } catch (e) { a.cloud.status = "failed"; a.cloud.error = e.message; } renderAssets(); done(a); }
    else if (j.status === "failed" || j.gone) { log("The cloud engine failed: " + (j.error || "unknown") + " — the on-device object stays", "فشل المحرك السحابي — يبقى المجسّم المصنوع على جهازك"); done(a); } }); });
}
function renderAssets() { const el = $("assets"); if (!E.assets.length) { el.innerHTML = '<p class="dim">' + L("No objects yet.", "لا مجسّمات بعد.") + "</p>"; return; }
  el.innerHTML = E.assets.map((a) => { const c = a.cloud, src = { device: L("this device", "هذا الجهاز"), trellis: "NVIDIA TRELLIS", views: L("AI views", "زوايا الذكاء"), tripo: "Tripo3D", meshy: "Meshy", sam3d: "SAM 3D", library: L("library", "المكتبة") }[a.source] || a.source;
    return '<div class="asset' + (E.sel === a ? " on" : "") + '"><button class="nm" data-x3="sel" data-v="' + a.id + '">' + esc(a.name) + '</button><span class="dim">' + a.size.join(" × ") + " m · " + esc(src) + (c && c.status !== "done" ? " · " + esc(c.status === "failed" ? L("cloud failed", "فشل السحابي") : L("AI generating ", "الذكاء يولّد ") + Math.round((c.progress || 0) * 100) + "%") : "") + "</span>" +
      '<span class="row"><button class="btn sm" data-x3="fit" data-v="' + a.id + '">' + L("Fit to area", "ملاءمة المساحة") + '</button><button class="btn sm" data-x3="turn" data-v="' + a.id + '">↻ 45°</button><button class="btn sm ghost" data-x3="del" data-v="' + a.id + '">' + L("Remove", "إزالة") + "</button></span></div>"; }).join(""); }

// ───────── 3 · world · 4 · effects ─────────
function renderWorld() { $("biomes").innerHTML = BIOME_IDS.map((b) => '<button data-x3="biome" data-v="' + b + '" aria-pressed="' + (E.state.biome === b) + '">' + esc(L(BIOMES[b].en, BIOMES[b].ar)) + "</button>").join("");
  $("todSeg").innerHTML = Object.keys(TOD).map((t) => '<button data-x3="tod" data-v="' + t + '" aria-pressed="' + (E.state.tod === t) + '">' + { dawn: L("Dawn", "فجر"), day: L("Day", "نهار"), sunset: L("Sunset", "غروب"), night: L("Night", "ليل") }[t] + "</button>").join("");
  $("sizeW").value = E.state.size[0]; $("sizeD").value = E.state.size[1]; const i = E.world().info; $("worldInfo").textContent = L(i.size.join(" × ") + " m to walk · ", i.size.join(" × ") + " م للمشي · ") + i.instances.toLocaleString() + L(" plants & rocks in ", " نبتة وصخرة في ") + Object.keys(i.counts).length + L(" draw calls", " استدعاء رسم");
  const fx = E.state.fx; for (const k of ["rain", "mist", "rays", "fireflies", "leaves", "snow", "wind"]) { const el = $("fx_" + k); if (el) { el.value = k === "wind" ? E.uniforms.uWind.value : k === "snow" ? E.uniforms.uSnow.value : fx[k] || 0; $("o_fx_" + k).textContent = (+el.value).toFixed(2); } } }
function setWorld(o) { E.setWorld(o); E.assets.forEach((a) => autoFit(a)); renderWorld(); log("World: " + BIOMES[E.state.biome].en + " " + E.state.size.join(" × ") + " m — " + E.world().info.instances + " instances on the GPU", "العالم: " + BIOMES[E.state.biome].ar + " " + E.state.size.join(" × ") + " م", "WebGL2 instancing"); }
async function cloudSky(engine) { const T = techniques(cap()).find((t) => t.id === engine); if (!T || !T.ok) throw new Error(L("Not available on your account", "غير متاح لحسابك"));
  const prompt = ($("q").value || L(BIOMES[E.state.biome].en, BIOMES[E.state.biome].ar)).slice(0, 400); status(L("Asking AI for a 360° sky…", "طلب سماء 360° من الذكاء…"));
  const fromPhoto = engine === "pano" && $("skyPhoto").checked && S.blob; // the AI continues the place in your photo all the way round
  const r = await call(engine === "skybox" ? "skybox" : "pano", { prompt, biome: E.state.biome, tod: E.state.tod, blob: fromPhoto ? S.blob : null }, { timeout: 30000 }); status(null); if (r && r.credits != null) { S.cfg.credits = r.credits; renderCaps(); }
  log("AI is painting a 360° sky (" + T.cost + " cr)", "الذكاء يرسم سماء 360°", T.where); $("skyTxt").textContent = L("Painting… ", "جارٍ الرسم… ");
  follow([r.id], async (j) => { $("skyTxt").textContent = j.status === "complete" ? "" : j.status === "failed" ? L("Failed: ", "فشل: ") + (j.error || "") : L("Painting… ", "جارٍ الرسم… ") + Math.round((j.progress || 0) * 100) + "%";
    if (j.status === "complete" && j.url) { const b = await call("fetch", { url: j.url }, { timeout: 120000 }); await E.setPanorama(URL.createObjectURL(b)); $("noSky").hidden = false; log("The AI 360° sky now lights the scene", "السماء 360° تضيء المشهد الآن", "PMREM"); } }); }

// ───────── 5 · walk & share ─────────
function setMode(m) { E.setMode(m); document.querySelectorAll("[data-x3=mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === E.mode))); $("joy").hidden = !(E.mode === "walk" && matchMedia("(pointer:coarse)").matches); $("hint").textContent = E.mode === "walk" ? L("WASD / arrows to walk · drag to look · Shift to run", "WASD / الأسهم للمشي · اسحب للنظر · Shift للجري") : L("Drag to orbit · tap an object to move it", "اسحب للدوران · اضغط على مجسّم لتحريكه"); }
async function record(sec) { const b = await E.record(sec, { tourMode: true, onTick: (p) => status(L("Recording the walk-through…", "تسجيل الجولة…"), p) }); status(null); S.lastVideo = b; const v = $("vid"); v.src = URL.createObjectURL(b); $("vidBox").hidden = false; log("Walk-through recorded: " + sec + " s, " + fmtMB(b.size) + (E.ambience.on ? " with ambience" : ""), "سُجّلت الجولة: " + sec + " ث", "MediaRecorder"); return b; }
const save = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };

// ───────── the plan ─────────
function renderPlan() { const intent = parsePrompt($("q").value), prev = S.plan || {}; if (intent.subject && !S.label) { S.label = intent.subject; $("label").value = S.label; } if (intent.category && intent.category !== S.category && !S.catUser) setCategory(intent.category);
  S.plan = makePlan(intent, cap(), { biome: E.state.biome, size: E.state.size, tod: E.state.tod, cloud: S.cloudPref, sky: S.skyPref }); const P = S.plan, T = techniques(cap());
  for (const s of P.steps) { const c = S.choice[s.id]; if (c && s.options.some((o) => o.id === c && o.ok)) s.choice = c; if (S.stepOn[s.id] != null) s.on = S.stepOn[s.id]; }
  $("steps").innerHTML = P.steps.map((s, i) => { const opts = s.options.filter((o) => o.ok || o.cost), ch = s.choice;
    const detail = s.id === "world" ? L(BIOMES[P.biome].en, BIOMES[P.biome].ar) + " · " + P.size.join(" × ") + " m · " + L({ dawn: "dawn", day: "day", sunset: "sunset", night: "night" }[P.tod], { dawn: "فجر", day: "نهار", sunset: "غروب", night: "ليل" }[P.tod]) :
      s.id === "fx" ? Object.entries(Object.assign({}, BIOMES[P.biome].fx, P.fx)).filter(([k, v]) => v > 0 && k !== "wind").map(([k]) => L(k, { rain: "مطر", mist: "ضباب", rays: "أشعة", fireflies: "يراعات", leaves: "أوراق", snow: "ثلج", snowfall: "ثلج" }[k] || k)).join(" · ") :
      s.id === "select" ? (S.img ? (P.subject ? L("the " + P.subject, P.subject) : L("the main object", "العنصر الرئيسي")) : L("add a photo", "أضف صورة")) : s.id === "explore" ? (P.walk ? L("first person, 1.65 m eye height", "منظور شخص، ارتفاع العين 1.65 م") : L("orbit", "دوران")) : "";
    return '<li class="step ' + (s.on ? "" : "off ") + (s.status || "") + '"><div class="sh"><b>' + (i + 1) + "</b><span>" + esc(L(s.en, s.ar)) + '</span><label class="sw"><input type="checkbox" data-x3s="on" data-v="' + s.id + '"' + (s.on ? " checked" : "") + "><i></i></label></div>" + (detail ? '<div class="dim sd">' + esc(detail) + "</div>" : "") +
      '<div class="techs">' + opts.map((o) => '<button data-x3="tech" data-step="' + s.id + '" data-v="' + o.id + '" aria-pressed="' + (o.id === ch) + '"' + (o.ok ? "" : " disabled") + ' title="' + esc(o.where) + '">' + esc(L(o.en, o.ar).split(" — ")[0]) + ' <small>' + esc(o.where) + (o.cost ? " · " + o.cost + " cr" : " · " + L("free", "مجاني")) + "</small></button>").join("") + "</div>" +
      (s.id === "asset" ? '<div class="techs up"><span class="dim">' + L("Missing parts:", "الأجزاء الناقصة:") + '</span><button data-x3="upg" data-v="" aria-pressed="' + !s.upgrade + '">' + L("estimate on device · free", "تقدير على الجهاز · مجاني") + "</button>" + T.filter((t) => t.step === "asset" && t.id !== "device").map((t) => '<button data-x3="upg" data-v="' + t.id + '" aria-pressed="' + (s.upgrade === t.id) + '"' + (t.ok ? "" : " disabled") + ">" + esc(L(t.en, t.ar).split(" — ")[0]) + " <small>" + t.cost + " cr</small></button>").join("") + "</div>" : "") +
      (s.id === "world" ? '<div class="techs up"><span class="dim">' + L("Sky:", "السماء:") + '</span><button data-x3="skyp" data-v="" aria-pressed="' + !s.sky + '">' + L("live procedural · free", "حية إجرائية · مجاني") + "</button>" + T.filter((t) => t.step === "world" && t.id !== "procedural").map((t) => '<button data-x3="skyp" data-v="' + t.id + '" aria-pressed="' + (s.sky === t.id) + '"' + (t.ok ? "" : " disabled") + ">" + esc(L(t.en, t.ar).split(" — ")[0].replace("Blockade Labs ", "")) + " <small>" + t.cost + " cr</small></button>").join("") + "</div>" : "") + "</li>"; }).join("");
  $("planCost").textContent = P.cost ? P.cost + " cr" : L("free", "مجاني"); $("notes").innerHTML = P.notes.map((n) => '<p class="note">' + esc(L(n.en, n.ar)) + "</p>").join(""); }
async function runPlan() {
  if (S.busy) return; S.busy = true; $("runAll").disabled = true; const P = S.plan, st = (id, v) => { const s = P.steps.find((x) => x.id === id); s.status = v; renderStepsState(); }, on = (id) => P.steps.find((x) => x.id === id).on;
  try {
    // world first (instant), so the object lands in it
    st("world", "run"); if (P.biome !== E.state.biome || P.size.join() !== E.state.size.join()) setWorld({ biome: P.biome, size: P.size }); E.setTime(P.tod); st("world", "done");
    st("fx", "run"); if (on("fx")) { E.setFX(Object.assign({ wind: BIOMES[P.biome].fx.wind }, P.fx)); } renderWorld(); log("Life & weather on the GPU: " + (Object.keys(P.fx).join(", ") || "biome defaults"), "الحياة والطقس على المعالج الرسومي", "GLSL"); st("fx", "done");
    if (S.img && on("select")) { st("select", "run"); if (!S.M) { const sel = P.steps.find((x) => x.id === "select").choice; if (sel === "vision") await visionFind(); else await autoSelect(); } st("select", S.M ? "done" : "fail"); }
    if (S.img && on("asset")) { st("asset", "run"); const a = await make3D(); st("asset", "done"); const up = P.steps.find((x) => x.id === "asset").upgrade; if (up) { st("asset", "cloud"); cloudUpgrade(up, a).then(() => st("asset", "done")).catch((e) => { st("asset", "done"); log(e.message, e.message); }); } }
    const sky = P.steps.find((x) => x.id === "world").sky; if (sky) cloudSky(sky).catch((e) => log(e.message, e.message));
    if (on("explore")) { st("explore", "run"); setMode(P.walk ? "walk" : "orbit"); st("explore", "done"); }
    if (on("capture")) { st("capture", "run"); const c = P.steps.find((x) => x.id === "capture").choice; if (c === "video" || c === "editor") { const b = await record(+$("recSec").value || 10); if (c === "editor" && EMBED) await sendToEditor(b); } else if (c === "glb") save(await E.exportGLB(), "nooi-3d-scene.glb"); st("capture", "done"); }
    toast(L("Done — explore your scene", "تم — استكشف مشهدك"), "ok");
  } catch (e) { fail(e); P.steps.forEach((s) => { if (s.status === "run") s.status = "fail"; }); renderStepsState(); }
  finally { S.busy = false; $("runAll").disabled = false; }
}
function renderStepsState() { const P = S.plan; document.querySelectorAll("#steps .step").forEach((li, i) => { li.classList.remove("run", "done", "fail", "cloud"); const s = P.steps[i]; if (s && s.status && s.status !== "todo") li.classList.add(s.status); }); }
async function sendToEditor(b) { const cv = $("cv"); await call("video", { blob: b || S.lastVideo, title: L("3D walk-through", "جولة ثلاثية الأبعاد") + (S.label ? " · " + S.label : ""), secs: +$("recSec").value || 10, aspect: cv.width + ":" + cv.height }, { timeout: 120000 }); }

// ───────── events ─────────
$("ask").addEventListener("submit", (e) => { e.preventDefault(); renderPlan(); $("planCard").scrollIntoView({ behavior: "smooth", block: "nearest" }); });
$("q").addEventListener("input", () => { clearTimeout(S._pt); S._pt = setTimeout(renderPlan, 250); });
$("q").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); renderPlan(); } });
$("file").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) setPhoto(f, f.name); e.target.value = ""; });
$("drop").addEventListener("dragover", (e) => e.preventDefault()); $("drop").addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) setPhoto(f, f.name); });
$("runAll").onclick = () => runPlan();
$("cat").innerHTML = CATS.map((c) => '<option value="' + c[0] + '">' + esc(L(c[1], c[2])) + "</option>").join(""); setCategory("object");
$("cat").onchange = (e) => { S.catUser = true; setCategory(e.target.value); renderPlan(); }; $("label").oninput = (e) => { S.label = e.target.value.trim(); };
$("height").onchange = (e) => { const a = E.sel || E.assets[E.assets.length - 1]; if (a) { a.height = Math.max(0.05, +e.target.value || 1); autoFit(a); renderAssets(); } };
$("len").oninput = (e) => { S.length = +e.target.value; $("o_len").textContent = S.length.toFixed(2) + "×"; }; $("relief").oninput = (e) => ($("o_relief").textContent = (+e.target.value).toFixed(2));
$("sizeW").onchange = $("sizeD").onchange = () => setWorld({ size: [+$("sizeW").value, +$("sizeD").value] });
for (const k of ["rain", "mist", "rays", "fireflies", "leaves", "snow", "wind"]) $("fx_" + k).addEventListener("input", (e) => { E.setFX({ [k]: +e.target.value }); $("o_fx_" + k).textContent = (+e.target.value).toFixed(2); });
$("windDir").addEventListener("input", (e) => { E.setWindDir(+e.target.value); $("o_windDir").textContent = e.target.value + "°"; }); $("exposure").addEventListener("input", (e) => { E.setExposure(+e.target.value); $("o_exposure").textContent = (+e.target.value).toFixed(2); });
$("sound").addEventListener("change", (e) => E.ambience.set({ on: e.target.checked, rain: E.state.fx.rain || 0, wind: E.uniforms.uWind.value }));
$("hdr").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; try { if (/\.hdr$/i.test(f.name)) await E.setPanorama(await f.arrayBuffer(), { hdr: true }); else await E.setPanorama(URL.createObjectURL(f)); $("noSky").hidden = false; log("Your 360° sky lights the scene", "سماؤك 360° تضيء المشهد", "PMREM"); } catch (er) { toast(er.message, "bad"); } e.target.value = ""; });
// joystick (phones, walk mode)
{ const J = $("joy"), knob = J.querySelector("i"); let id = null, c = null; J.addEventListener("pointerdown", (e) => { id = e.pointerId; const b = J.getBoundingClientRect(); c = [b.left + b.width / 2, b.top + b.height / 2]; J.setPointerCapture(id); e.stopPropagation(); });
  J.addEventListener("pointermove", (e) => { if (e.pointerId !== id) return; const dx = e.clientX - c[0], dy = e.clientY - c[1], r = 44, l = Math.min(r, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); E.walk.joy.x = (Math.cos(a) * l) / r; E.walk.joy.y = (Math.sin(a) * l) / r; knob.style.transform = `translate(${Math.cos(a) * l}px,${Math.sin(a) * l}px)`; });
  const end = () => { id = null; E.walk.joy.x = E.walk.joy.y = 0; knob.style.transform = ""; }; J.addEventListener("pointerup", end); J.addEventListener("pointercancel", end); }
document.addEventListener("change", (e) => { const t = e.target; if (t.dataset && t.dataset.x3s === "on") { S.stepOn[t.dataset.v] = t.checked; const s = S.plan.steps.find((x) => x.id === t.dataset.v); if (s) s.on = t.checked; t.closest(".step").classList.toggle("off", !t.checked); } });
document.addEventListener("click", async (e) => {
  const b = e.target.closest && e.target.closest("[data-x3]"); if (!b || b.disabled) return; const v = b.dataset.v;
  try { switch (b.dataset.x3) {
    case "tech": S.choice[b.dataset.step] = v; renderPlan(); break;
    case "upg": S.cloudPref = v || false; renderPlan(); break;
    case "skyp": S.skyPref = v || null; renderPlan(); break;
    case "auto": await autoSelect(); break;
    case "find": await visionFind(); break;
    case "pmode": S.pmode = +v; document.querySelectorAll("[data-x3=pmode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); break;
    case "undo": S.points.pop(); await updateMask(); break;
    case "clearSel": S.points = []; S.M = null; drawSel(); updateButtons(); break;
    case "make": b.classList.add("busy"); await make3D(); b.classList.remove("busy"); break;
    case "cloud": await cloudUpgrade(v); break;
    case "shape": S.shape = v; syncShape(); break;
    case "sel": E.select(v); renderAssets(); break;
    case "fit": { const a = E.assets.find((x) => x.id === v); if (a) { a.keepReal = false; autoFit(a); renderAssets(); } break; }
    case "turn": { const a = E.assets.find((x) => x.id === v); if (a) { a.rot += Math.PI / 4; autoFit(a); renderAssets(); } break; }
    case "del": E.removeAsset(v); showFit(); renderAssets(); break;
    case "realSize": { const a = E.assets[0]; if (!a) break; const n = fitNote({ name: a.name, size: a.realSize, fits: false }, { w: E.state.size[0], d: E.state.size[1] }); a.keepReal = true; a.fit = 1; setWorld({ size: [n.need, n.need] }); renderAssets(); break; }
    case "biome": setWorld({ biome: v }); if (S.plan) S.plan.biome = v; break;
    case "seed": setWorld({ seed: (Math.random() * 1e5) | 0 }); break;
    case "tod": E.setTime(v); renderWorld(); break;
    case "sky": await cloudSky(v); break;
    case "noSky": E.clearPanorama(); $("noSky").hidden = true; break;
    case "mode": setMode(v); break;
    case "tour": if (E.touring()) { E.stopTour(); b.setAttribute("aria-pressed", "false"); } else { E.startTour(14); b.setAttribute("aria-pressed", "true"); } break;
    case "full": { const el = $("view"); if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen && el.requestFullscreen().catch(() => {}); break; }
    case "rec": b.disabled = true; try { await record(+$("recSec").value || 10); } finally { b.disabled = false; } break;
    case "dlVid": if (S.lastVideo) save(S.lastVideo, "nooi-3d-walkthrough.webm"); break;
    case "toEditor": await sendToEditor(); break;
    case "shot": save(await E.snapshot(), "nooi-3d.png"); break;
    case "still": await call("still", { blob: await E.snapshot("image/jpeg"), prompt: ($("q").value || L("This 3D scene", "هذا المشهد ثلاثي الأبعاد")) + " — " + L("cinematic camera move, natural light", "حركة كاميرا سينمائية وإضاءة طبيعية") }); break;
    case "glb": save(await E.exportGLB(), "nooi-3d-scene.glb"); log("Scene exported as .glb", "صُدّر المشهد ‎.glb", "GLTFExporter"); break;
    case "glbObj": save(await E.exportGLB({ assetsOnly: true }), "nooi-3d-object.glb"); break;
    case "usdz": save(await E.exportUSDZ(), "nooi-3d.usdz"); break;
    case "lib": { const blob = await E.exportGLB({ assetsOnly: true }), thumb = await E.snapshot("image/jpeg", 0.8); const r = await call("save", { glb: blob, thumb, name: (S.label || (E.assets[0] && E.assets[0].name) || "3D").slice(0, 40), stats: E.assets[0] && E.assets[0].stats }); toast(L("Saved to your nooi library", "حُفظ في مكتبتك على nooi"), "ok"); log("Saved to the library", "حُفظ في المكتبة"); break; }
    case "libOpen": { const r = await call("library", {}); const el = $("libList"); el.hidden = false; el.innerHTML = r.items.length ? r.items.map((x) => '<button class="libit" data-x3="libPick" data-v="' + esc(x.id) + '" data-k="' + esc(x.kind) + '">' + (x.thumb ? '<img alt="" src="' + esc(x.thumb) + '">' : "") + "<span>" + esc(x.title) + "</span><small>" + esc(x.kind) + "</small></button>").join("") : '<p class="dim">' + L("Nothing in your library yet.", "لا شيء في مكتبتك بعد.") + "</p>"; break; }
    case "libPick": { const r = await call("libItem", { id: v }, { timeout: 120000 }); if (b.dataset.k === "3d") await addGLB(r.blob, r.title || "3D", "library"); else await setPhoto(r.blob, r.title || "image"); break; }
    case "free": if (S.ai) { await S.ai.dispose(); S.ai.terminate(); S.ai = null; S.samReady = null; } toast(L("AI memory released", "حُرّرت ذاكرة الذكاء")); break;
  } } catch (er) { fail(er); b.classList.remove("busy"); }
});
function updateButtons() { $("makeBtn").disabled = !S.img; for (const id of ["autoBtn", "undoBtn", "clearBtn"]) $(id).disabled = !S.img; $("findBtn").hidden = !techniques(cap()).find((t) => t.id === "vision").ok;
  const T = techniques(cap()); $("cloudBtns").innerHTML = T.filter((t) => t.step === "asset" && t.id !== "device" && t.ok).map((t) => '<button class="btn" data-x3="cloud" data-v="' + t.id + '">' + esc(L(t.en, t.ar).split(" — ")[0]) + ' <span class="cost">' + t.cost + " cr</span></button>").join("") || '<p class="dim">' + (S.cfg.nooi ? L("Sign in on nooi.ai to let AI generate the hidden sides (credits).", "سجّل الدخول في nooi.ai ليولّد الذكاء الجوانب المخفية (برصيد).") : L("Open this studio inside nooi.ai to let AI generate the hidden sides with credits.", "افتح هذا الاستوديو داخل nooi.ai ليولّد الذكاء الجوانب المخفية بالرصيد.")) + "</p>";
  $("skyPhotoRow").hidden = !(S.img && T.find((t) => t.id === "pano").ok);
  $("skyBtns").innerHTML = T.filter((t) => t.step === "world" && t.id !== "procedural" && t.ok).map((t) => '<button class="btn" data-x3="sky" data-v="' + t.id + '">' + esc(L(t.en, t.ar).split(" — ")[0].replace("Blockade Labs ", "")) + ' <span class="cost">' + t.cost + " cr</span></button>").join("");
  for (const id of ["toEditor", "still", "libSave", "libOpenBtn"]) $(id).hidden = !S.cfg.nooi; }
function onProgress(m) { if (m.stage === "download" && m.file) { const f = (S.files = S.files || {}), x = (f[m.file] = f[m.file] || { loaded: 0, total: 0 }); if (m.total) x.total = m.total; if (m.loaded != null) x.loaded = m.loaded; if (m.status === "done" && x.total) x.loaded = x.total;
    let a = 0, t = 0; for (const k in f) { a += f[k].loaded; t += f[k].total; } status(L("Downloading the AI once (then it's saved on this device) · ", "تنزيل الذكاء مرة واحدة (ثم يُحفظ على جهازك) · ") + (t ? fmtMB(a) + " / " + fmtMB(t) : "…"), t ? a / t : null); if (t && a >= t) setTimeout(showCache, 500); }
  else if (m.stage === "gpu" && m.status === "fallback") log("WebGPU failed → the AI runs on the CPU", "فشل WebGPU ← يعمل الذكاء على المعالج", "WASM"); }
addEventListener("pagehide", () => { if (S.ai) S.ai.terminate(); E.dispose(); });

// first paint
const q0 = q.get("q"); if (q0) $("q").value = q0; renderWorld(); setMode("orbit"); renderAssets(); updateButtons(); renderPlan(); await loadCfg(); updateButtons(); renderPlan();
window.X3 = { S, E, cache, run: runPlan, make3D, autoSelect, setPhoto, renderPlan, cloudUpgrade, cloudSky, record, setWorld, setMode, addGLB, maskAt, objectScore };
