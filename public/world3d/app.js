/* nooi.ai — 3D World Studio
   A three.js studio inside nooi: type (or attach a picture) → the AI builds a 3D object or a whole 360° world → it appears in the
   scene, where you orbit, select, move / rotate / scale, light it with the world's sky, then export .glb, send an orbit video to
   the editor or use the view as a video's first frame.
   Engines (keys stay on the server, Admin → AI providers):
     objects — NVIDIA TRELLIS · Tripo3D · Meshy · nooi AI views (front / side / back pictures → mesh)
     worlds  — Blockade Labs Skybox (360° + depth) · nooi 360° (the picture model paints an equirectangular panorama)
   Loaded by the nooi app (VIEWS.w3d); uses the app's API, jobs, credits, library and editor. */
(function () {
  "use strict";
  const W = { r: null, scene: null, cam: null, ctl: null, tc: null, pmrem: null, envDefault: null, ground: null, grid: null, items: [], sel: null, sky: null, raf: 0, loader: null, ro: null, lastT: 0, wasDrag: false, down: null, loaded: {}, placeholders: {} };
  // one state object, filled in place (replacing it would let a running callback write to a stale copy)
  const W3DEF = { mode: "object", engine: "auto", wengine: "auto", prompt: "", items: [], sky: null, gizmo: "translate", jobs: [] };
  const st = () => { if (!S.w3d || typeof S.w3d !== "object") S.w3d = {}; for (const k in W3DEF) if (S.w3d[k] === undefined) S.w3d[k] = Array.isArray(W3DEF[k]) ? [] : W3DEF[k]; return S.w3d; };
  const cfgP = () => (API.cfg && API.cfg.providers) || {};
  const g3 = () => cfgP().gen3d || {};
  const nvOn = (k) => !!(cfgP().nvidia && cfgP().nvUse && cfgP().nvUse[k] !== false);
  const server = () => API.mode === "server";
  const isPhone = () => innerWidth < 768;

  // ── engines ────────────────────────────────────────────────
  function objEngines() {
    return [["auto", L("Auto", "تلقائي"), true], ["nvidia", "NVIDIA TRELLIS", nvOn("3d")], ["tripo", "Tripo3D", !!g3().tripo], ["meshy", "Meshy", !!g3().meshy], ["views", L("nooi AI views", "زوايا nooi بالذكاء"), true]];
  }
  function worldEngines() { return [["auto", L("Auto", "تلقائي"), true], ["skybox", "Blockade Labs Skybox", !!g3().skybox], ["pano", L("nooi 360°", "nooi ‏360°"), true]]; }
  function pickObj(e) { if (e !== "auto") return e; if (nvOn("3d")) return "nvidia"; if (g3().tripo) return "tripo"; if (g3().meshy) return "meshy"; return "views"; }
  function pickWorld(e) { if (e !== "auto") return e; return g3().skybox ? "skybox" : "pano"; }
  const objCost = () => (typeof S3D_COST === "object" ? S3D_COST.objects : 12) || 12;
  const panoCost = () => { const m = typeof bestImg72 === "function" ? bestImg72() : "nano"; return ((IMG_MODELS[m] || { cr: 2 }).cr) * 2; };
  function cost() { const s = st(); if (s.mode === "world") return pickWorld(s.wengine) === "skybox" ? 40 : panoCost(); const e = pickObj(s.engine); return e === "views" ? (typeof a3Cost === "function" ? a3Cost() : 6) : objCost(); }

  // ── markup (re-rendered by the app; the WebGL canvas is kept and moved into the new stage) ──
  function view() {
    const s = st(), eng = s.mode === "world" ? worldEngines() : objEngines(), cur = s.mode === "world" ? s.wengine : s.engine, ph = M.w3Ref;
    const pend = s.jobs.map((id) => S.jobs.find((j) => j.id === id)).filter((j) => j && !["complete", "failed"].includes(j.status));
    const lib3d = S.jobs.filter((j) => j.kind === "3d" && j.status === "complete" && mediaUrl(j)).slice(-12).reverse();
    const libW = S.jobs.filter((j) => j.status === "complete" && mediaUrl(j) && ((j.kind === "world") || (j.meta && j.meta.world360))).slice(-8).reverse();
    const off = !server() ? '<div class="note">' + L("The 3D World Studio runs on your nooi server — sign in on the live site to generate.", "استوديو العوالم ثلاثية الأبعاد يعمل على خادم nooi — سجّل الدخول في الموقع للتوليد.") + "</div>" : "";
    return '<div class="view w3d"><div class="spread"><h1>' + L("3D World Studio", "استوديو العوالم ثلاثية الأبعاد") + '</h1><span class="badge b-live">' + L("Objects · Worlds · Live 3D", "مجسّمات · عوالم · 3D مباشر") + "</span></div>" +
      '<p class="lede">' + L("Describe an object or a whole world — or attach a picture. The AI builds it in 3D and drops it into your scene, where you can orbit, move, rotate and scale it, then export it or turn it into a video.", "صِف مجسّماً أو عالماً كاملاً — أو أرفق صورة. يبنيه الذكاء ثلاثي الأبعاد ويضعه في مشهدك، فتدور حوله وتحرّكه وتدوّره وتغيّر حجمه، ثم تصدّره أو تحوّله إلى فيديو.") + "</p>" + off +
      '<div class="w3grid"><div class="w3main"><div class="w3stage" id="w3stage"><div class="w3hud">' +
      (pend.length ? pend.map((j) => '<span class="w3chip"><i class="w3spin"></i>' + esc((j.title || "").slice(0, 28)) + " · " + Math.round((j.progress || 0) * 100) + "%</span>").join("") : "") + '</div>' +
      (!s.items.length && !s.sky ? '<div class="w3empty">' + L("Your scene is empty — describe something below", "مشهدك فارغ — صِف شيئاً بالأسفل") + "</div>" : "") +
      '<div class="w3tools"><button class="w3b" data-w3="gizmo" data-v="translate" aria-pressed="' + (s.gizmo === "translate") + '" title="' + esc(L("Move", "تحريك")) + '">✥</button><button class="w3b" data-w3="gizmo" data-v="rotate" aria-pressed="' + (s.gizmo === "rotate") + '" title="' + esc(L("Rotate", "تدوير")) + '">⟳</button><button class="w3b" data-w3="gizmo" data-v="scale" aria-pressed="' + (s.gizmo === "scale") + '" title="' + esc(L("Scale", "تحجيم")) + '">⤢</button><button class="w3b" data-w3="frame" title="' + esc(L("Fit view", "ملاءمة العرض")) + '">⌖</button><button class="w3b" data-w3="full" title="' + esc(L("Full screen", "ملء الشاشة")) + '">⛶</button></div></div>' +
      '<form class="w3bar" data-w3form="1"><div class="seg w3mode">' + [["object", L("3D object", "مجسّم 3D")], ["world", L("360° world", "عالم 360°")]].map((m) => '<button type="button" data-w3="mode" data-v="' + m[0] + '" aria-pressed="' + (s.mode === m[0]) + '">' + m[1] + "</button>").join("") + "</div>" +
      '<div class="w3row"><label class="w3att" title="' + esc(L("Attach a picture", "أرفق صورة")) + '">' + (ph ? '<img src="' + esc(ph.url) + '" alt="">' : "＋") + '<input type="file" accept="image/*" data-w3up="1"></label>' + (ph ? '<button type="button" class="w3x" data-w3="unattach" aria-label="' + esc(L("Remove picture", "إزالة الصورة")) + '">×</button>' : "") +
      '<textarea id="w3q" rows="1" dir="auto" placeholder="' + esc(s.mode === "world" ? L("e.g. a neon night market in old Jeddah after rain", "مثال: سوق ليلي بإضاءة نيون في جدة القديمة بعد المطر") : L("e.g. a vintage red motorbike, a ceramic coffee pot", "مثال: دراجة نارية حمراء كلاسيكية، دلّة قهوة خزفية")) + '">' + esc(s.prompt) + "</textarea>" +
      '<button type="submit" class="btn primary w3go" data-w3="go">' + ic("spark") + '<span>' + L("Generate", "ولّد") + '</span><span class="cost">' + cost() + " cr</span></button></div>" +
      '<div class="w3eng">' + eng.map((e) => '<button type="button" class="chip" data-w3="eng" data-v="' + e[0] + '" aria-pressed="' + (cur === e[0]) + '"' + (e[2] ? "" : ' disabled title="' + esc(L("Add its key in Admin → AI providers", "أضف مفتاحه من الإدارة ← مزودو الذكاء")) + '"') + ">" + esc(e[1]) + "</button>").join("") + "</div></form></div>" +
      '<aside class="w3side"><div class="panel pad"><h3>' + L("In the scene", "في المشهد") + '</h3><div class="w3list">' + (s.items.length ? s.items.map((it, i) => { const j = S.jobs.find((x) => x.id === it.job); return '<div class="w3item' + (W.sel && W.sel.userData.idx === i ? " on" : "") + '"><button class="w3pick" data-w3="pick" data-v="' + i + '">' + (j && j.thumb ? '<img src="' + j.thumb + '" alt="">' : "◆") + "<span>" + esc((j && j.title || L("Object", "مجسّم")).slice(0, 34)) + '</span></button><button class="w3x" data-w3="del" data-v="' + i + '" aria-label="' + esc(L("Remove", "إزالة")) + '">×</button></div>'; }).join("") : '<p class="small mute">' + L("Nothing yet.", "لا شيء بعد.") + "</p>") +
      (s.sky ? '<div class="w3item"><span class="w3pick">🌐 <span>' + L("360° sky", "سماء 360°") + '</span></span><button class="w3x" data-w3="nosky" aria-label="' + esc(L("Remove sky", "إزالة السماء")) + '">×</button></div>' : "") + "</div>" +
      '<div class="w3acts"><button class="btn sm" data-w3="glb">' + ic("download") + L("Download scene .glb", "نزّل المشهد ‎.glb") + '</button><button class="btn sm" data-w3="video">' + ic("edit") + L("Orbit video → editor", "فيديو دوران ← المحرر") + '</button><button class="btn sm" data-w3="still">' + ic("video") + L("Use this view in a video", "استخدم المنظر في فيديو") + '</button><button class="btn sm ghost danger" data-w3="clear">' + ic("trash") + L("Clear scene", "امسح المشهد") + "</button></div></div>" +
      (lib3d.length || libW.length ? '<div class="panel pad" style="margin-top:12px"><h3>' + L("From your library", "من مكتبتك") + '</h3><div class="w3lib">' + lib3d.map((j) => '<button class="w3libi" data-w3="add" data-v="' + j.id + '" title="' + esc(j.title || "") + '">' + (j.thumb ? '<img src="' + j.thumb + '" alt="">' : "◆") + "<small>" + esc((j.title || "3D").slice(0, 18)) + "</small></button>").join("") + libW.map((j) => '<button class="w3libi" data-w3="sky" data-v="' + j.id + '" title="' + esc(j.title || "") + '"><img src="' + esc(mediaUrl(j)) + '" alt=""><small>🌐 ' + esc((j.title || "").slice(0, 16)) + "</small></button>").join("") + "</div></div>" : "") + "</aside></div></div>";
  }

  // ── three.js scene ─────────────────────────────────────────
  const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  async function extras() { if (THREE.TransformControls) return; for (const b of ["https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "/vendor/three/examples/js/"]) { try { await loadScript(b + "controls/TransformControls.js"); return; } catch (e) {} } }
  function roomEnv() { // a soft studio light box (like three's RoomEnvironment) → image-based lighting without downloading an HDR
    const sc = new THREE.Scene(), box = new THREE.BoxGeometry(), room = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ side: THREE.BackSide, color: 0x7f7f7f }));
    room.scale.set(16, 10, 16); room.position.y = 4; sc.add(room); sc.add(new THREE.AmbientLight(0xffffff, 0.6));
    const lamp = (x, y, z, sx, sy, sz, k) => { const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k) })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); sc.add(m); };
    lamp(0, 8.8, 0, 6, 0.1, 6, 14); lamp(-7.9, 4, 0, 0.1, 4, 7, 6); lamp(7.9, 5, 2, 0.1, 3, 4, 5); lamp(0, 5, -7.9, 6, 3, 0.1, 4);
    return W.pmrem.fromScene(sc, 0.04).texture;
  }
  async function ensure() {
    if (!(await ensureThree())) return false; await extras();
    if (W.r) return true;
    const r = (W.r = new THREE.WebGLRenderer({ antialias: !isPhone(), alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }));
    r.setPixelRatio(Math.min(isPhone() ? 1.5 : 2, devicePixelRatio || 1)); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = !isPhone(); r.shadowMap.type = THREE.PCFSoftShadowMap; r.domElement.className = "w3canvas";
    W.scene = new THREE.Scene(); W.scene.background = new THREE.Color(0x15181b);
    W.cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 500); W.cam.position.set(3.2, 2.2, 4.2);
    W.pmrem = new THREE.PMREMGenerator(r); W.envDefault = roomEnv(); W.scene.environment = W.envDefault;
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(4, 7, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -6; sun.shadow.camera.right = sun.shadow.camera.top = 6; W.scene.add(sun);
    W.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.35));
    W.ground = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.ShadowMaterial({ opacity: 0.28 })); W.ground.rotation.x = -Math.PI / 2; W.ground.receiveShadow = true; W.scene.add(W.ground);
    W.grid = new THREE.GridHelper(24, 48, 0x5a7a2a, 0x2a2f2a); W.grid.material.transparent = true; W.grid.material.opacity = 0.35; W.scene.add(W.grid);
    W.ctl = new THREE.OrbitControls(W.cam, r.domElement); W.ctl.enableDamping = true; W.ctl.target.set(0, 0.8, 0); W.ctl.maxPolarAngle = Math.PI * 0.495; W.ctl.minDistance = 0.4; W.ctl.maxDistance = 60;
    if (THREE.TransformControls) { W.tc = new THREE.TransformControls(W.cam, r.domElement); W.tc.setMode(st().gizmo); W.tc.addEventListener("dragging-changed", (e) => { W.ctl.enabled = !e.value; if (!e.value) saveXf(); }); W.scene.add(W.tc); }
    W.loader = new THREE.GLTFLoader();
    r.domElement.addEventListener("pointerdown", (e) => { W.down = { x: e.clientX, y: e.clientY }; });
    r.domElement.addEventListener("pointerup", (e) => { if (!W.down || Math.hypot(e.clientX - W.down.x, e.clientY - W.down.y) > 6 || (W.tc && W.tc.dragging)) return; pickAt(e); });
    const loop = (t) => { W.raf = requestAnimationFrame(loop); if (!W.r.domElement.isConnected || document.hidden) return; W.ctl.update(); for (const id in W.placeholders) { const p = W.placeholders[id]; p.rotation.y += 0.02; p.rotation.x += 0.01; } W.r.render(W.scene, W.cam); };
    W.raf = requestAnimationFrame(loop);
    return true;
  }
  function size() { const box = document.getElementById("w3stage"); if (!box || !W.r) return; const w = box.clientWidth || 640, h = box.clientHeight || 400; W.r.setSize(w, h, false); W.cam.aspect = w / h; W.cam.updateProjectionMatrix(); }
  async function mount() {
    const box = document.getElementById("w3stage"); if (!box) return; if (!(await ensure())) { box.insertAdjacentHTML("beforeend", '<div class="w3empty">' + L("The 3D viewer couldn't load.", "تعذّر تحميل عارض 3D.") + "</div>"); return; }
    if (W.r.domElement.parentNode !== box) box.prepend(W.r.domElement);
    if (W.ro) W.ro.disconnect(); W.ro = new ResizeObserver(size); W.ro.observe(box); size();
    if (W.tc) W.tc.setMode(st().gizmo);
    syncScene();
  }
  // scene ⇄ saved state: every item is a finished 3D job (a .glb) with its position / rotation / scale
  function syncScene() {
    const s = st();
    s.items.forEach((it, i) => { if (W.loaded[it.key]) { W.loaded[it.key].userData.idx = i; return; } const j = S.jobs.find((x) => x.id === it.job); if (j && mediaUrl(j)) loadItem(it, i, mediaUrl(j)); });
    for (const k in W.loaded) if (!s.items.some((it) => it.key === k)) { const o = W.loaded[k]; if (W.tc && W.tc.object === o) W.tc.detach(); W.scene.remove(o); dispose(o); delete W.loaded[k]; }
    if (s.sky && W.skyKey !== s.sky) { const j = S.jobs.find((x) => x.id === s.sky); if (j && mediaUrl(j)) setSky(j); }
    if (!s.sky && W.skyKey) clearSky();
  }
  function dispose(o) { o.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"]) if (m[k]) m[k].dispose(); m.dispose(); }); }); }
  function placeholder(key, pos) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshBasicMaterial({ color: 0x9cd245, wireframe: true, transparent: true, opacity: 0.7 })); p.position.set(pos[0], 0.8, pos[2]); W.scene.add(p); W.placeholders[key] = p; }
  function unplace(key) { const p = W.placeholders[key]; if (p) { W.scene.remove(p); p.geometry.dispose(); p.material.dispose(); delete W.placeholders[key]; } }
  function loadItem(it, i, url) {
    if (W.loading && W.loading[it.key]) return; W.loading = W.loading || {}; W.loading[it.key] = true; placeholder(it.key, it.pos || [0, 0, 0]);
    W.loader.load(url, (g) => {
      const o = g.scene; unplace(it.key); delete W.loading[it.key];
      // fit: tallest side 1.6 m, standing on the ground
      const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), k = 1.6 / Math.max(sz.x, sz.y, sz.z, 1e-3); o.scale.multiplyScalar(k);
      const b2 = new THREE.Box3().setFromObject(o), c = b2.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));
      const wrap = new THREE.Group(); wrap.add(o); wrap.userData = { key: it.key, idx: i, w3: true };
      o.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; if (n.material && n.material.map) n.material.map.anisotropy = 4; } });
      if (it.pos) wrap.position.fromArray(it.pos); if (it.rot) wrap.rotation.set(it.rot[0], it.rot[1], it.rot[2]); if (it.scale) wrap.scale.setScalar(it.scale);
      W.scene.add(wrap); W.loaded[it.key] = wrap; if (it.fresh) { delete it.fresh; select(wrap); frame(); persist(); }
    }, (e) => { const p = W.placeholders[it.key]; if (p && e.total) p.material.opacity = 0.35 + 0.6 * (e.loaded / e.total); },
    () => { unplace(it.key); delete W.loading[it.key]; toast(L("Couldn't load this 3D model.", "تعذّر تحميل هذا المجسّم."), { type: "warn" }); });
  }
  function nextSlot() { const n = st().items.length, a = n * 2.399963, r = n ? 1.3 + 0.55 * Math.sqrt(n) : 0; return [+(Math.cos(a) * r).toFixed(2), 0, +(Math.sin(a) * r).toFixed(2)]; }
  function addJob3d(j) { const s = st(), it = { key: "k" + uid(), job: j.id, pos: nextSlot(), fresh: true }; s.items.push(it); persist(); if (W.r) loadItem(it, s.items.length - 1, mediaUrl(j)); }
  function saveXf() { const o = W.sel; if (!o) return; const it = st().items.find((x) => x.key === o.userData.key); if (!it) return; it.pos = o.position.toArray().map((v) => +v.toFixed(3)); it.rot = [o.rotation.x, o.rotation.y, o.rotation.z].map((v) => +v.toFixed(3)); it.scale = +o.scale.x.toFixed(3); persist(); }
  function select(o) { W.sel = o || null; if (W.tc) { if (o) W.tc.attach(o); else W.tc.detach(); } document.querySelectorAll(".w3item").forEach((el, i) => el.classList.toggle("on", !!o && o.userData.idx === i)); }
  function pickAt(e) { const rc = new THREE.Raycaster(), r = W.r.domElement.getBoundingClientRect(); rc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), W.cam);
    const hits = rc.intersectObjects(Object.values(W.loaded), true); if (!hits.length) return select(null); let o = hits[0].object; while (o && !(o.userData && o.userData.w3)) o = o.parent; select(o); }
  function frame() { const objs = Object.values(W.loaded); if (!objs.length) { W.ctl.target.set(0, 0.8, 0); W.cam.position.set(3.2, 2.2, 4.2); return; } const b = new THREE.Box3(); objs.forEach((o) => b.expandByObject(o)); const c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2 || 1;
    W.ctl.target.copy(c); const d = r / Math.sin((W.cam.fov * Math.PI) / 360) * 0.9; W.cam.position.copy(c).add(new THREE.Vector3(0.7, 0.45, 1).normalize().multiplyScalar(Math.max(2.2, d))); }
  // a 360° world: the panorama becomes the sky and the light (image-based lighting); its depth map, when there is one, lifts the ground
  function setSky(j) { const url = mediaUrl(j); W.skyKey = j.id; new THREE.TextureLoader().load(url, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
      if (W.skyTex) W.skyTex.dispose(); W.skyTex = t; W.scene.background = t; if (W.skyEnv) W.skyEnv.dispose(); W.skyEnv = W.pmrem.fromEquirectangular(t).texture; W.scene.environment = W.skyEnv; W.grid.visible = false; },
    undefined, () => toast(L("Couldn't load the world picture.", "تعذّر تحميل صورة العالم."), { type: "warn" })); }
  function clearSky() { W.skyKey = null; W.scene.background = new THREE.Color(0x15181b); W.scene.environment = W.envDefault; W.grid.visible = true; if (W.skyTex) { W.skyTex.dispose(); W.skyTex = null; } }

  // ── generating ─────────────────────────────────────────────
  async function generate() {
    const s = st(), q = (document.getElementById("w3q") || {}).value || ""; s.prompt = q.trim(); persist();
    if (!server()) { toast(L("Sign in on the live site to generate.", "سجّل الدخول في الموقع للتوليد.")); return; }
    const file = M.w3Ref && M.w3Ref.file; if (!s.prompt && !file) { toast(L("Describe it or attach a picture first.", "صِفه أو أرفق صورة أولاً."), { type: "warn" }); return; }
    const title = (s.prompt || (file && file.name) || "3D").replace(/\.[a-z0-9]+$/i, "").slice(0, 40);
    if (s.mode === "world") {
      const e = pickWorld(s.wengine);
      const j = e === "skybox" ? addJob({ kind: "world", prompt: s.prompt || title, title: L("World · ", "عالم · ") + title, cost: 40, secs: 60, art: "scene", aspect: "21:9", meta: { engine: "skybox" } })
        : withRef72("iRef", file, () => addJob({ kind: "image", model: bestImg72(), prompt: "A seamless 360-degree equirectangular panorama" + (file ? " that continues the place in the reference photo in every direction" : "") + (s.prompt ? ". The place: " + s.prompt : "") + ". Eye-level camera in the middle of the space, straight horizon across the middle, photorealistic, consistent light, no text, no borders; the left and right edges must join seamlessly.", title: L("World · ", "عالم · ") + title, aspect: "21:9", cost: panoCost(), secs: 12, art: "scene", meta: { world360: true } }));
      if (j) { s.jobs.push(j.id); persist(); toast(L("Building your 360° world…", "يُبنى عالمك 360°…"), { type: "ok" }); renderView(); }
      return;
    }
    const e = pickObj(s.engine);
    if (e === "views") { const blob = file || null; const p = await a3Start("object", blob, title, s.prompt); if (p) { s.jobs.push("a3:" + p.id); persist(); renderView(); } return; }
    const j = withRef72("s3dImg", file, () => addJob({ kind: "3d", prompt: s.prompt || title, title: title + " · " + ({ nvidia: "NVIDIA TRELLIS", tripo: "Tripo3D", meshy: "Meshy" })[e], cost: objCost(), secs: 60, art: "scene", aspect: "1:1", meta: { mode: "objects", engine: e === "nvidia" ? "trellis" : e } }));
    if (j) { if (file) { try { const c = document.createElement("canvas"), im = await createImageBitmap(file); c.width = 192; c.height = Math.round((192 * im.height) / im.width); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); j.thumb = c.toDataURL("image/jpeg", 0.72); } catch (er) {} }
      s.jobs.push(j.id); persist(); toast(L("Building your 3D model…", "يُبنى مجسّمك…"), { type: "ok" }); renderView(); }
  }
  // finished jobs flow into the scene by themselves
  setInterval(() => { if (!S.w3d || !S.w3d.jobs || !S.w3d.jobs.length) return; const s = st(); let ch = false;
    s.jobs = s.jobs.filter((id) => {
      if (String(id).startsWith("a3:")) { const p = (S.a3 || []).find((x) => x.id === id.slice(3)); if (!p) return false; if (p.status === "done" && p.res) { const j = S.jobs.find((x) => x.id === p.res); if (j) addJob3d(j); ch = true; return false; } if (p.status === "failed") { ch = true; return false; } return true; }
      const j = S.jobs.find((x) => x.id === id); if (!j) return false;
      if (j.status === "failed") { toast(L("Generation failed: ", "فشل التوليد: ") + (j.error || ""), { type: "warn" }); ch = true; return false; }
      if (j.status === "complete" && mediaUrl(j)) { if (j.kind === "3d") addJob3d(j); else { s.sky = j.id; persist(); if (W.r) setSky(j); } ch = true; return false; }
      return true; });
    if (ch) { persist(); if (S.view === "w3d") renderView(); } else if (S.view === "w3d") { const h = document.querySelector(".w3hud"); if (h) { const pend = s.jobs.map((id) => S.jobs.find((j) => j.id === id)).filter(Boolean); h.innerHTML = pend.map((j) => '<span class="w3chip"><i class="w3spin"></i>' + esc((j.title || "").slice(0, 28)) + " · " + Math.round((j.progress || 0) * 100) + "%</span>").join(""); } } }, 1500);

  // ── exports ────────────────────────────────────────────────
  function sceneGroup() { const g = new THREE.Group(); Object.values(W.loaded).forEach((o) => g.add(o.clone(true))); return g; }
  async function recordOrbit(sec) { const cv = W.r.domElement; if (!cv.captureStream || !window.MediaRecorder) return null; select(null); const mime = ["video/webm;codecs=vp9", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const rec = new MediaRecorder(cv.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : {}), ch = []; rec.ondataavailable = (e) => { if (e.data.size) ch.push(e.data); }; const done = new Promise((r) => (rec.onstop = r));
    const ar = W.ctl.autoRotate, sp = W.ctl.autoRotateSpeed; W.ctl.autoRotate = true; W.ctl.autoRotateSpeed = 60 / sec; rec.start(250); await new Promise((r) => setTimeout(r, sec * 1000)); rec.stop(); await done; W.ctl.autoRotate = ar; W.ctl.autoRotateSpeed = sp;
    return new Blob(ch, { type: (mime || "video/webm").split(";")[0] }); }

  // ── events ─────────────────────────────────────────────────
  document.addEventListener("submit", (e) => { if (e.target && e.target.dataset && e.target.dataset.w3form) { e.preventDefault(); generate(); } });
  document.addEventListener("keydown", (e) => { if (e.target && e.target.id === "w3q" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); } });
  document.addEventListener("input", (e) => { if (e.target && e.target.id === "w3q") { st().prompt = e.target.value; e.target.style.height = "auto"; e.target.style.height = Math.min(140, e.target.scrollHeight) + "px"; } });
  document.addEventListener("change", (e) => { const t = e.target; if (t && t.dataset && t.dataset.w3up && t.files && t.files[0]) { loadSlot("w3Ref", t.files[0]); setTimeout(renderView, 60); } });
  document.addEventListener("click", async (e) => {
    const a = e.target.closest && e.target.closest("[data-w3]"); if (!a) return; const s = st(), v = a.dataset.v;
    switch (a.dataset.w3) {
      case "go": return; // the form's submit handles it
      case "mode": s.mode = v; persist(); renderView(); break;
      case "eng": if (s.mode === "world") s.wengine = v; else s.engine = v; persist(); renderView(); break;
      case "unattach": delete M.w3Ref; renderView(); break;
      case "gizmo": s.gizmo = v; persist(); if (W.tc) W.tc.setMode(v); document.querySelectorAll('[data-w3="gizmo"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v))); break;
      case "frame": frame(); break;
      case "full": { const el = document.getElementById("w3stage"); if (!el) break; if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().then(() => setTimeout(size, 120)).catch(() => {}); break; }
      case "pick": { const it = s.items[+v], o = it && W.loaded[it.key]; if (o) { select(o); W.ctl.target.copy(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3())); } break; }
      case "del": { const it = s.items[+v]; if (!it) break; if (W.sel && W.sel.userData.key === it.key) select(null); s.items.splice(+v, 1); persist(); syncScene(); renderView(); break; }
      case "nosky": s.sky = null; persist(); clearSky(); renderView(); break;
      case "clear": if (!a.dataset.armed) { arm(a, L("Tap again", "اضغط مرة أخرى")); break; } select(null); s.items = []; s.sky = null; persist(); syncScene(); clearSky(); renderView(); break;
      case "add": { const j = S.jobs.find((x) => x.id === v); if (j) { addJob3d(j); renderView(); } break; }
      case "sky": { s.sky = v; persist(); const j = S.jobs.find((x) => x.id === v); if (j && W.r) setSky(j); renderView(); break; }
      case "glb": { if (!Object.keys(W.loaded).length) { toast(L("Add something to the scene first.", "أضف شيئاً إلى المشهد أولاً.")); break; } new THREE.GLTFExporter().parse(sceneGroup(), (r) => saveFile("nooi-scene.glb", new Blob([r], { type: "model/gltf-binary" })), { binary: true }); break; }
      case "video": { if (!W.r) break; a.disabled = true; a.classList.add("busy"); const b = await recordOrbit(8); a.disabled = false; a.classList.remove("busy"); if (!b) { toast(L("Recording isn't supported in this browser.", "التسجيل غير مدعوم في هذا المتصفح."), { type: "warn" }); break; }
        const cv = W.r.domElement, j = await clipJob72(b, L("3D world orbit", "دوران في عالم 3D"), 8, cv.width + ":" + cv.height); await edUseJob(j); break; }
      case "still": { if (!W.r) break; select(null); W.r.render(W.scene, W.cam); const b = await new Promise((r) => W.r.domElement.toBlob(r, "image/png")); if (!b) break; loadSlot("vStart", new File([b], "world.png", { type: "image/png" })); S.draft.startJob = null; S.draft.prompt = (s.prompt || L("This 3D scene", "هذا المشهد ثلاثي الأبعاد")) + " — " + L("cinematic camera move, natural light", "حركة كاميرا سينمائية وإضاءة طبيعية"); go("video"); toast(L("View set as the first frame", "عُيّن المنظر كإطار أول"), { type: "ok" }); break; }
    }
  });
  window.W3D = { view, mount, state: W, generate };
})();
