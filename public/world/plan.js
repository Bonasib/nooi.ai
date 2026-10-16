// The world plan — one small JSON that describes a whole living 3D world. The page builds the world from it (public/world/
// world.js); the server's text / vision AI writes it (lib/world.js); both clean it with cleanPlan() below, so nothing the AI
// writes is ever run, and every number stays in a range a phone can draw. localPlan() reads a prompt in English or Arabic
// without any AI (free, instant) — a world can always be made.
export const PLAN_VERSION = 2;

// places: what the ground, the land, the water, the plants and the life default to
export const PLACES = {
  meadow:     { en: "a meadow", ar: "مرج", ground: "grass", shape: "hills", height: 5, water: "none", fog: 0.35, dress: [["tree", 3], ["bush", 3], ["flowers", 4], ["rock", 1]], density: 0.55, grass: 1, life: [["bird", 6], ["butterfly", 6]], amb: ["birds", "wind"] },
  park:       { en: "a park", ar: "حديقة", ground: "grass", shape: "flat", height: 1, water: "pond", fog: 0.3, dress: [["tree", 4], ["bush", 3], ["flowers", 3], ["bench", 1], ["lamp", 1]], density: 0.45, grass: 1, paths: 1, life: [["person", 6], ["dog", 1], ["bird", 6]], amb: ["birds", "people"] },
  forest:     { en: "a forest", ar: "غابة", ground: "grass", shape: "hills", height: 8, water: "none", fog: 0.6, dress: [["tree", 5], ["pine", 4], ["bush", 3], ["rock", 1.5], ["log", 0.6], ["mushroom", 0.8], ["fern", 2]], density: 1.25, grass: 1, life: [["bird", 8], ["deer", 3]], amb: ["forest", "birds"] },
  rainforest: { en: "a rainforest", ar: "غابة مطيرة", ground: "grass", shape: "hills", height: 7, water: "river", fog: 0.8, weather: "rain", dress: [["tree", 5], ["palm", 3], ["fern", 5], ["bush", 4], ["rock", 1]], density: 1.5, grass: 1, life: [["bird", 10], ["butterfly", 8]], amb: ["rain", "forest"] },
  mountain:   { en: "the mountains", ar: "جبال", ground: "grass", shape: "mountains", height: 34, water: "lake", fog: 0.45, dress: [["pine", 6], ["rock", 4], ["boulder", 1.5], ["bush", 1]], density: 0.8, grass: 0.6, life: [["eagle", 3], ["deer", 2]], amb: ["wind"] },
  snow:       { en: "a snowy land", ar: "أرض ثلجية", ground: "snow", shape: "hills", height: 10, water: "lake", frozen: 1, fog: 0.55, weather: "snow", time: 11, dress: [["pine", 6], ["rock", 2], ["cabin", 0.15]], density: 0.75, grass: 0, life: [["bird", 3]], amb: ["wind"] },
  desert:     { en: "a desert", ar: "صحراء", ground: "sand", shape: "dunes", height: 7, water: "none", fog: 0.25, dress: [["ghaf", 0.5], ["rock", 1], ["shrub", 1.5]], density: 0.18, grass: 0, life: [["camel", 4], ["eagle", 1]], amb: ["wind"] },
  oasis:      { en: "a desert oasis", ar: "واحة", ground: "sand", shape: "dunes", height: 5, water: "oasis", fog: 0.25, dress: [["palm", 7], ["shrub", 2], ["rock", 1], ["tent", 0.2]], density: 0.45, grass: 0.25, life: [["camel", 4], ["bird", 4]], amb: ["wind", "birds"] },
  beach:      { en: "a beach", ar: "شاطئ", ground: "sand", shape: "coast", height: 3, water: "sea", fog: 0.3, dress: [["palm", 4], ["umbrella", 1.2], ["rock", 1], ["shrub", 1]], density: 0.3, grass: 0.15, life: [["seagull", 6], ["person", 4], ["boat", 2]], amb: ["waves", "birds"] },
  island:     { en: "an island", ar: "جزيرة", ground: "sand", shape: "island", height: 9, water: "sea", fog: 0.3, dress: [["palm", 6], ["bush", 2], ["rock", 1.5]], density: 0.55, grass: 0.6, life: [["seagull", 6], ["boat", 2]], amb: ["waves"] },
  lake:       { en: "a lake", ar: "بحيرة", ground: "grass", shape: "valley", height: 9, water: "lake", fog: 0.45, dress: [["tree", 4], ["pine", 3], ["reeds", 3], ["rock", 1.5]], density: 0.75, grass: 1, life: [["duck", 5], ["bird", 6], ["boat", 1]], amb: ["birds", "water"] },
  canyon:     { en: "a rocky canyon", ar: "وادٍ صخري", ground: "redrock", shape: "canyon", height: 26, water: "river", fog: 0.2, time: 16.5, dress: [["boulder", 2], ["rock", 3], ["shrub", 1.5], ["ghaf", 0.3]], density: 0.35, grass: 0, life: [["eagle", 2]], amb: ["wind"] },
  city:       { en: "a city", ar: "مدينة", ground: "asphalt", shape: "flat", height: 0.4, water: "none", fog: 0.4, dress: [["lamp", 2], ["tree", 1], ["bench", 1]], density: 0.2, grass: 0, roads: "grid", blocks: ["tower", "tower", "shop", "house"], life: [["person", 14], ["car", 8], ["bird", 3]], amb: ["city"] },
  village:    { en: "an old village", ar: "قرية قديمة", ground: "dirt", shape: "flat", height: 1.5, water: "none", fog: 0.3, time: 16.8, dress: [["palm", 3], ["shrub", 1.5], ["stall", 0.6]], density: 0.3, grass: 0.1, roads: "lanes", blocks: ["najdi", "najdi", "najdi", "shop"], life: [["person", 10], ["goat", 4], ["camel", 2], ["bird", 4]], amb: ["people", "wind"] },
  farm:       { en: "a farm", ar: "مزرعة", ground: "grass", shape: "hills", height: 4, water: "pond", fog: 0.35, dress: [["crops", 5], ["tree", 2], ["fence", 2], ["barn", 0.2]], density: 0.5, grass: 1, life: [["cow", 5], ["sheep", 6], ["bird", 6]], amb: ["birds"] },
  room:       { en: "a room", ar: "غرفة", ground: "floor", shape: "room", height: 0, water: "none", fog: 0, indoor: 1, dress: [], density: 0, grass: 0, life: [], amb: ["room"] },
  space:      { en: "the surface of the Moon", ar: "سطح القمر", ground: "moon", shape: "craters", height: 6, water: "none", fog: 0, time: 22, gravity: 1.62, dress: [["boulder", 1.5], ["rock", 3]], density: 0.3, grass: 0, life: [], amb: ["space"] },
  underwater: { en: "an underwater reef", ar: "شعاب تحت الماء", ground: "sand", shape: "hills", height: 4, water: "deep", fog: 0.9, dress: [["coral", 6], ["seaweed", 5], ["rock", 2]], density: 0.9, grass: 0, life: [["fish", 26]], amb: ["underwater"] }
};
export const SHAPES = ["flat", "hills", "mountains", "dunes", "coast", "island", "valley", "canyon", "craters", "room"];
export const GROUNDS = ["grass", "sand", "snow", "dirt", "asphalt", "stone", "redrock", "floor", "moon"];
export const WATERS = ["none", "pond", "lake", "river", "sea", "oasis", "pool", "deep"];
export const WEATHERS = ["clear", "cloudy", "rain", "storm", "snow", "fog", "sandstorm"];
export const ROOMS = ["living", "majlis", "bedroom", "kitchen", "office", "cafe", "gallery", "showroom", "classroom"];

// every thing a world can hold: category, real size (m) and what it is made of (the physics table); dyn = it can be pushed
export const TYPES = {
  // plants & nature
  tree: { c: "plant", s: [5, 7, 5], m: "wood" }, pine: { c: "plant", s: [4, 10, 4], m: "wood" }, palm: { c: "plant", s: [4, 9, 4], m: "wood" }, ghaf: { c: "plant", s: [6, 5, 6], m: "wood" },
  bush: { c: "plant", s: [1.8, 1.2, 1.8], m: "wood" }, shrub: { c: "plant", s: [1, 0.6, 1], m: "wood" }, flowers: { c: "plant", s: [1, 0.4, 1], m: "wood" }, fern: { c: "plant", s: [1.2, 0.8, 1.2], m: "wood" },
  reeds: { c: "plant", s: [1, 1.4, 1], m: "wood" }, cactus: { c: "plant", s: [1, 3, 1], m: "wood" }, mushroom: { c: "plant", s: [0.4, 0.4, 0.4], m: "wood" }, crops: { c: "plant", s: [6, 0.9, 4], m: "wood" },
  coral: { c: "plant", s: [1.2, 1, 1.2], m: "stone" }, seaweed: { c: "plant", s: [0.5, 2, 0.5], m: "wood" }, log: { c: "nature", s: [4, 0.6, 0.6], m: "wood", dyn: 1 },
  rock: { c: "nature", s: [1.4, 0.9, 1.2], m: "stone" }, boulder: { c: "nature", s: [4, 3, 3.5], m: "stone" },
  // buildings
  house: { c: "building", s: [9, 7, 8], m: "stone" }, cabin: { c: "building", s: [7, 5.5, 6], m: "wood" }, villa: { c: "building", s: [16, 7, 12], m: "stone" }, najdi: { c: "building", s: [10, 7, 10], m: "stone" },
  tower: { c: "building", s: [16, 60, 16], m: "glass" }, shop: { c: "building", s: [8, 5, 7], m: "stone" }, tent: { c: "building", s: [7, 3, 5], m: "wood" }, mosque: { c: "building", s: [18, 12, 18], m: "stone" },
  castle: { c: "building", s: [24, 14, 24], m: "stone" }, lighthouse: { c: "building", s: [5, 20, 5], m: "stone" }, barn: { c: "building", s: [12, 8, 9], m: "wood" }, windmill: { c: "building", s: [6, 14, 6], m: "wood" },
  dome: { c: "building", s: [12, 9, 12], m: "stone" }, ruins: { c: "building", s: [10, 5, 10], m: "stone" }, pyramid: { c: "building", s: [24, 16, 24], m: "stone" },
  // structures & street
  bridge: { c: "structure", s: [14, 2, 4], m: "wood" }, wall: { c: "structure", s: [10, 2.5, 0.6], m: "stone" }, gate: { c: "structure", s: [6, 6, 1.5], m: "stone" }, fence: { c: "structure", s: [6, 1.1, 0.2], m: "wood" },
  well: { c: "structure", s: [1.8, 1.8, 1.8], m: "stone" }, fountain: { c: "structure", s: [5, 2.4, 5], m: "stone" }, pier: { c: "structure", s: [3, 1, 16], m: "wood" }, statue: { c: "structure", s: [1.6, 4, 1.6], m: "stone" },
  lamp: { c: "street", s: [0.6, 5, 0.6], m: "metal" }, bench: { c: "street", s: [1.8, 0.9, 0.6], m: "wood" }, stall: { c: "street", s: [3, 2.6, 2], m: "wood" }, umbrella: { c: "street", s: [2.4, 2.4, 2.4], m: "plastic" },
  flag: { c: "street", s: [0.3, 7, 2.2], m: "metal" }, sign: { c: "street", s: [1.4, 2.4, 0.2], m: "metal" }, campfire: { c: "fire", s: [1.4, 0.8, 1.4], m: "wood" }, torch: { c: "fire", s: [0.3, 2, 0.3], m: "wood" },
  lantern: { c: "fire", s: [0.4, 0.6, 0.4], m: "metal", dyn: 1 }, crystal: { c: "nature", s: [1, 2.4, 1], m: "glass" },
  // vehicles (parked; the moving ones are in LIFE)
  car: { c: "vehicle", s: [4.5, 1.45, 1.9], m: "metal", dyn: 1 }, suv: { c: "vehicle", s: [4.9, 1.9, 2], m: "metal", dyn: 1 }, truck: { c: "vehicle", s: [6, 2.6, 2.3], m: "metal" },
  bus: { c: "vehicle", s: [11, 3.2, 2.6], m: "metal" }, boat: { c: "vehicle", s: [5, 1.4, 2], m: "wood", dyn: 1 }, bike: { c: "vehicle", s: [1.8, 1.1, 0.5], m: "metal", dyn: 1 },
  // things to push, kick and throw
  ball: { c: "prop", s: [0.22, 0.22, 0.22], m: "rubber", dyn: 1 }, crate: { c: "prop", s: [0.8, 0.8, 0.8], m: "wood", dyn: 1 }, barrel: { c: "prop", s: [0.6, 0.9, 0.6], m: "wood", dyn: 1 },
  cone: { c: "prop", s: [0.4, 0.7, 0.4], m: "plastic", dyn: 1 }, chair: { c: "prop", s: [0.5, 0.9, 0.5], m: "wood", dyn: 1 }, table: { c: "prop", s: [1.4, 0.75, 0.9], m: "wood", dyn: 1 },
  vase: { c: "prop", s: [0.3, 0.5, 0.3], m: "glass", dyn: 1 }, bottle: { c: "prop", s: [0.09, 0.3, 0.09], m: "glass", dyn: 1 }, cart: { c: "prop", s: [1.6, 1.1, 1], m: "wood", dyn: 1 },
  // inside
  sofa: { c: "furniture", s: [2.2, 0.85, 0.9], m: "wood" }, bed: { c: "furniture", s: [2, 0.6, 2.1], m: "wood" }, desk: { c: "furniture", s: [1.6, 0.76, 0.8], m: "wood" }, shelf: { c: "furniture", s: [1.2, 2, 0.4], m: "wood" },
  rug: { c: "furniture", s: [3, 0.02, 2], m: "wood" }, tv: { c: "furniture", s: [1.4, 0.85, 0.08], m: "plastic" }, plant: { c: "furniture", s: [0.5, 1.1, 0.5], m: "plastic", dyn: 1 },
  window: { c: "furniture", s: [1.6, 1.4, 0.1], m: "glass" }, door: { c: "furniture", s: [1, 2.1, 0.1], m: "wood" }, kitchen: { c: "furniture", s: [3, 0.92, 0.65], m: "stone" },
  cushions: { c: "furniture", s: [3, 0.7, 0.8], m: "foam" }, painting: { c: "furniture", s: [1.2, 0.8, 0.05], m: "wood" }, piano: { c: "furniture", s: [1.5, 1.2, 0.6], m: "wood" },
  // plain shapes (anything else)
  box: { c: "shape", s: [1, 1, 1], m: "plastic", dyn: 1 }, sphere: { c: "shape", s: [1, 1, 1], m: "plastic", dyn: 1 }, cylinder: { c: "shape", s: [1, 1.5, 1], m: "plastic" },
  ring: { c: "shape", s: [2, 2, 0.4], m: "metal" }, arch: { c: "structure", s: [4, 4, 1], m: "stone" }
};
// what people can do (human.js moves them)
export const ACTS = ["walk", "stand", "wave", "talk", "sit", "run", "dance", "look", "wander", "point"];
// what moves by itself
export const LIFE = { person: "walk", child: "walk", dog: "follow", cat: "wander", camel: "wander", horse: "wander", cow: "graze", sheep: "graze", goat: "graze", deer: "wander",
  bird: "fly", seagull: "fly", eagle: "soar", duck: "float", fish: "swim", butterfly: "flutter", car: "drive", bus: "drive", boat: "sail", plane: "flyby" };

const num = (v, lo, hi, d) => { const n = +v; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v).toLowerCase() : null);
const txt = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const pick = (v, list, d) => (list.includes(v) ? v : d);
const xz = (v, lim) => (Array.isArray(v) && v.length >= 2 && v.every((x) => Number.isFinite(+x)) ? [num(v[0], -lim, lim, 0), num(v[v.length === 3 ? 2 : 1], -lim, lim, 0)] : null);

// whatever was written → a plan the page can always build (unknown things become plain shapes, numbers are clamped)
export function cleanPlan(j) {
  j = j && typeof j === "object" ? j : {};
  const place = pick(j.place, Object.keys(PLACES), "meadow"), P = PLACES[place];
  const size = Math.round(num(j.size, P.indoor ? 8 : 60, P.indoor ? 24 : 320, P.indoor ? 12 : place === "city" ? 220 : 180)), lim = size / 2 - 1;
  const t = j.terrain || {}, w = j.water || {}, wt = j.weather || {}, sky = j.sky || {};
  let budget = 1400;
  const objects = (Array.isArray(j.objects) ? j.objects : []).slice(0, 60).map((o) => {
    if (!o || typeof o !== "object") return null;
    const type = TYPES[o.type] ? o.type : "box", T = TYPES[type];
    const count = Math.round(num(o.count, 1, 60, 1)); if (budget - count < 0) return null; budget -= count;
    const scale = num(o.scale, 0.2, 6, 1);
    return { type, ...(TYPES[o.type] ? {} : { label: txt(o.label || o.type, 40) }), at: xz(o.at, lim), count, spread: num(o.spread, 0, lim, count > 1 ? Math.min(lim, 6 + count * 2) : 0), scale,
      color: hex(o.color), color2: hex(o.color2), mat: pick(o.mat || o.material, ["wood", "metal", "rubber", "glass", "stone", "foam", "plastic", "ice"], T.m), rot: num(o.rot, -360, 360, 0),
      dyn: o.dyn === undefined ? !!T.dyn : !!o.dyn, hero: !!o.hero, name: txt(o.name, 40) || undefined,
      box: Array.isArray(o.box) && o.box.length === 4 && o.box.every((v) => Number.isFinite(+v)) ? o.box.map((v) => num(v, 0, 1, 0)) : undefined };   // where it is in the picture (for its 3D model)
  }).filter(Boolean);
  let life = (Array.isArray(j.life) ? j.life : []).slice(0, 12).map((l) => (l && LIFE[l.type] ? { type: l.type, count: Math.round(num(l.count, 1, 30, 3)), at: xz(l.at, lim), spread: num(l.spread, 0, lim, lim * 0.6) } : null)).filter(Boolean);
  // people: real-looking 3D people (human.js) — who they are, how many, what they do and what they go to
  const people = (Array.isArray(j.people) ? j.people : []).slice(0, 12).map((q) => (q && typeof q === "object" ? { look: txt(q.look || q.who || q.description, 160), gender: pick(q.gender, ["male", "female"], undefined), age: Math.round(num(q.age, 3, 95, 30)),
    count: Math.round(num(q.count, 1, 12, 1)), act: pick(q.act, ACTS, "stand"), target: txt(q.target, 40) || undefined, task: txt(q.task, 140) || undefined, at: xz(q.at, lim) || undefined,
    char: typeof q.char === "string" && /^[\w-]{1,40}$/.test(q.char) ? q.char : undefined, name: txt(q.name, 40) || undefined } : null)).filter(Boolean);
  for (const l of life) if (l.type === "person" || l.type === "child") { if (!people.some((q) => q.fromLife === l.type)) people.push({ look: "", age: l.type === "child" ? 9 : 30, count: Math.min(12, l.count), act: "walk", fromLife: l.type }); }
  life = life.filter((l) => l.type !== "person" && l.type !== "child");
  const roads = (Array.isArray(j.roads) ? j.roads : []).slice(0, 10).map((r) => { const a = xz(r && r.from, lim), b = xz(r && r.to, lim); return a && b ? { from: a, to: b, width: num(r.width, 1.5, 14, 6), kind: pick(r.kind, ["road", "path", "street"], "road") } : null; }).filter(Boolean);
  return {
    v: PLAN_VERSION, seed: Math.round(num(j.seed, 1, 2 ** 31 - 2, 1 + Math.floor(Math.random() * 1e9))),
    title: txt(j.title, 80) || P.en, label: txt(j.label, 80) || "", describe: txt(j.describe, 500) || "", prompt: txt(j.prompt, 600),
    place, size, room: P.indoor ? pick(j.room, ROOMS, "living") : undefined,
    time: num(j.time, 0, 24, P.time ?? 10.5),
    weather: { kind: pick(wt.kind, WEATHERS, P.weather || "clear"), wind: num(wt.wind, 0, 25, P.weather === "rain" ? 5 : 3), amount: num(wt.amount, 0, 1, 0.6) },
    terrain: { shape: pick(t.shape, SHAPES, P.shape), height: num(t.height, 0, 60, P.height), ground: pick(t.ground, GROUNDS, P.ground), color: hex(t.color), color2: hex(t.color2) },
    water: { kind: pick(w.kind, WATERS, P.water), level: num(w.level, -6, 8, 0), color: hex(w.color), frozen: !!(w.frozen ?? P.frozen) },
    sky: { top: hex(sky.top), horizon: hex(sky.horizon), clouds: num(sky.clouds, 0, 1, 0.35), stars: num(sky.stars, 0, 1, 1) },
    gravity: num(j.gravity, 1, 15, P.gravity || 9.81),
    exclude: (Array.isArray(j.exclude) ? j.exclude : []).filter((x) => TYPES[x]).slice(0, 20),
    dress: num(j.dress, 0, 2, 1),
    objects, life, people, roads,
    spawn: { at: xz(j.spawn && j.spawn.at, lim) || [0, P.indoor ? size * 0.3 : Math.min(28, lim * 0.35)], look: xz(j.spawn && j.spawn.look, lim) || [0, 0] },
    // AI-made parts (filled in by the page when they arrive)
    pano: typeof j.pano === "string" && /^(\/media\/|https?:\/\/)/.test(j.pano) ? j.pano.slice(0, 500) : undefined,
    groundTex: typeof j.groundTex === "string" && /^(\/media\/|https?:\/\/)/.test(j.groundTex) ? j.groundTex.slice(0, 500) : undefined,
    billboards: j.billboards && typeof j.billboards === "object" ? Object.fromEntries(Object.entries(j.billboards).filter(([k, v]) => TYPES[k] && typeof v === "string" && /^(\/media\/|https?:\/\/)/.test(v)).slice(0, 6).map(([k, v]) => [k, v.slice(0, 500)])) : undefined,
    models: (Array.isArray(j.models) ? j.models : []).slice(0, 8).filter((m) => m && typeof m.url === "string" && /^(\/media\/|https?:\/\/|blob:)/.test(m.url)).map((m) => ({ url: m.url.slice(0, 500), i: Math.round(num(m.i, 0, 59, 0)), name: txt(m.name, 40) })),
    splat: j.splat && typeof j.splat === "object" ? { lo: /^(\/media\/|https?:\/\/)/.test(j.splat.lo || "") ? String(j.splat.lo).slice(0, 500) : undefined, hi: /^(\/media\/|https?:\/\/)/.test(j.splat.hi || "") ? String(j.splat.hi).slice(0, 500) : undefined, collider: /^(\/media\/|https?:\/\/)/.test(j.splat.collider || "") ? String(j.splat.collider).slice(0, 500) : undefined } : undefined
  };
}

// ---------- reading a prompt without AI (English + Arabic) ----------
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const norm = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d)).replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=[\s|),،.]|$)/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "").toLowerCase();
// English words need whole-word matches; Arabic words may carry a joined و/ف/ب/ل/ك and ال in front (no look-behind: older Safari)
const W = (en, ar) => new RegExp("(?:\\b(?:" + en + ")\\b" + (ar ? "|(?:^|[^\\u0600-\\u06FF])(?:[وفبلك])?(?:ال)?(?:" + norm(ar) + ")" : "") + ")", "i");
// order matters: the first place that matches wins
const PLACE_WORDS = [
  ["underwater", W("underwater|under the sea|ocean floor|coral reef|reef|scuba", "تحت الماء|تحت البحر|قاع البحر|شعاب|مرجان")],
  ["space", W("on the moon|moon surface|mars|space station|outer space|planet", "علي القمر|سطح القمر|المريخ|الفضاء|كوكب")],
  ["room", W("room|bedroom|living room|kitchen|office|cafe|coffee shop|majlis|showroom|gallery|museum|classroom|interior|lobby|hall", "غرفه|صاله|مطبخ|مكتب|مقهي|كافيه|مجلس|معرض|متحف|فصل|داخل البيت|ردهه|قاعه")],
  ["rainforest", W("rain ?forest|jungle|tropical", "غابه مطيره|الغابات المطيره|ادغال|استوائي")],
  ["oasis", W("oasis", "واحه")],
  ["island", W("island", "جزيره")],
  ["beach", W("beach|shore|coast|seaside|ocean|sea", "شاطي|ساحل|بحر|محيط|كورنيش")],
  ["canyon", W("canyon|wadi|valley of rocks|gorge|alula|al ?ula", "وادي|اخدود|العلا|مضيق")],
  ["snow", W("snow|snowy|winter|arctic|ice land|glacier", "ثلج|ثلوج|شتاء|جليد|قطبي")],
  ["mountain", W("mountains?|peaks?|alps|summit|cliffs?", "جبل|جبال|قمه|قمم|منحدر")],
  ["lake", W("lake|pond|river", "بحيره|بركه|نهر")],
  ["desert", W("desert|dunes?|sahara|sand", "صحراء|صحرا|كثبان|رمال|نفود|الربع الخالي")],
  ["farm", W("farm|ranch|fields?|barn|countryside", "مزرعه|حقل|حقول|ريف")],
  ["village", W("village|old town|heritage|ancient town|souq|bazaar|mud houses?", "قريه|حي قديم|تراث|تراثي|سوق شعبي|الدرعيه|نجدي|بيوت طين|بلده قديمه")],
  ["city", W("city|downtown|street|skyscrapers?|town|urban|avenue|neon", "مدينه|شارع|شوارع|ابراج|ناطحات|وسط البلد")],
  ["park", W("park|garden|playground", "حديقه|منتزه|بستان|ملعب")],
  ["forest", W("forest|woods|woodland|trees", "غابه|غابات|اشجار")],
  ["meadow", W("meadow|grassland|prairie|hills", "مرج|مروج|عشب|تلال")]
];
const TIME_WORDS = [
  [6.1, W("dawn|sunrise|early morning|first light", "فجر|شروق|الصباح الباكر|الشروق")], [18.4, W("sunset|golden hour|dusk|evening glow", "غروب|المغرب|الغروب|الساعه الذهبيه|مغيب")],
  [19.3, W("evening|twilight", "مساء|المساء|شفق")], [22.5, W("night|midnight|moonlight|stars|starry|dark", "ليل|ليلا|ليله|منتصف الليل|نجوم|ظلام|مظلم|ضوء القمر")],
  [9, W("morning", "صباح|الصباح|ضحي")], [12.5, W("noon|midday|sunny|bright day|daytime", "ظهر|الظهر|نهار|ظهيره|مشمس")], [15.6, W("afternoon", "عصر|العصر")]
];
const WEATHER_WORDS = [
  ["storm", W("storm|thunder|lightning|thunderstorm", "عاصفه رعديه|رعد|برق|عاصفه ممطره")], ["sandstorm", W("sandstorm|dust storm|dusty", "عاصفه رمليه|غبار|عجاج")],
  ["snow", W("snowing|snowfall|snow falling|blizzard", "يتساقط الثلج|تساقط الثلوج|ثلج يتساقط|عاصفه ثلجيه")], ["rain", W("rain|rainy|raining|drizzle|wet", "مطر|ماطر|امطار|ممطر|رذاذ")],
  ["fog", W("fog|foggy|mist|misty|haze", "ضباب|ضبابي|شبوره")], ["cloudy", W("cloudy|overcast|clouds", "غائم|غيوم|سحب|غيم")], ["clear", W("clear sky|clear|sunny", "صافي|صافيه|مشمس")]
];
const WIND = W("wind|windy|breeze|gusts?", "رياح|ريح|عاصف|نسيم|هواء قوي");
// thing words → types (and life)
const THING_WORDS = [
  ["palm", W("palm trees?|date palms?|palms?", "نخل|نخله|نخيل|نخلات")], ["pine", W("pine trees?|pines?|firs?|conifers?", "صنوبر")], ["ghaf", W("ghaf|acacias?|sidr|samr", "غاف|سدر|سمر|طلح|اكاسيا")],
  ["cactus", W("cactus|cacti", "صبار")], ["flowers", W("flowers?|roses?|tulips?|blossoms?", "زهور|زهره|ورد|ورود|ازهار")], ["bush", W("bush(es)?|hedges?", "شجيره|شجيرات|سياج نباتي")],
  ["tree", W("trees?|oaks?", "شجره|شجر|اشجار")], ["boulder", W("big rocks?|huge rocks?|boulders?", "صخره كبيره|صخور كبيره|جلمود")], ["rock", W("rocks?|stones?", "صخره|صخور|حجاره|احجار")],
  ["crystal", W("crystals?|gems?", "كريستال|بلورات|جواهر")], ["log", W("logs?", "جذع|جذوع")], ["mushroom", W("mushrooms?", "فطر|فطريات|مشروم")], ["reeds", W("reeds?", "قصب|بوص")],
  ["coral", W("corals?", "مرجان|شعاب")], ["seaweed", W("seaweed|kelp", "اعشاب بحريه")], ["crops", W("crops?|wheat|corn", "قمح|زرع|محاصيل|ذره")],
  ["najdi", W("mud houses?|mud-brick|najdi|adobe", "بيت طين|بيوت طين|طيني|نجدي|بيوت تراثيه")], ["villa", W("villas?|mansion", "فيلا|فلل|قصر حديث")], ["cabin", W("cabins?|huts?|cottage", "كوخ|اكواخ|شاليه")],
  ["tower", W("towers?|skyscrapers?|high-rise", "برج|ابراج|ناطحه|ناطحات")], ["mosque", W("mosques?|minaret", "مسجد|مساجد|جامع|منارة مسجد|مئذنه")], ["castle", W("castles?|fort|fortress|citadel", "قلعه|قلاع|حصن")],
  ["lighthouse", W("lighthouse", "منارة بحريه|فنار")], ["barn", W("barns?", "حظيره|اسطبل")], ["windmill", W("windmills?", "طاحونه")], ["tent", W("tents?|bedouin tent|camp", "خيمه|خيام|بيت شعر|مخيم")],
  ["shop", W("shops?|stores?|cafes?|restaurants?", "محل|محلات|دكان|مطعم|متجر")], ["house", W("houses?|homes?|buildings?", "بيت|بيوت|منزل|منازل|مبني|مباني")], ["pyramid", W("pyramids?", "هرم|اهرام")],
  ["ruins", W("ruins|columns|ancient", "اطلال|اثار|اعمده")], ["dome", W("domes?", "قبه|قباب")],
  ["bridge", W("bridges?", "جسر|جسور|كوبري")], ["wall", W("walls?", "سور|جدار|اسوار")], ["gate", W("gates?|arch(es)?", "بوابه|قوس|باب كبير")], ["fence", W("fences?", "سياج|اسوار خشبيه")],
  ["well", W("wells?", "بئر|ابار")], ["fountain", W("fountains?", "نافوره")], ["pier", W("piers?|dock|jetty", "رصيف بحري|مرسي")], ["statue", W("statues?|sculptures?", "تمثال|منحوته")],
  ["lamp", W("street ?lights?|lamp ?posts?|lamps?", "عمود انارة|اعمده انارة|اناره|مصباح|مصابيح")], ["bench", W("bench(es)?", "مقعد|مقاعد|كنبه حديقه")], ["stall", W("stalls?|market|souq|bazaar", "بسطه|سوق|بسطات")],
  ["umbrella", W("umbrellas?|parasols?", "مظله|مظلات|شمسيه")], ["flag", W("flags?", "علم|اعلام|رايه")], ["sign", W("signs?|billboards?", "لوحه اعلان|لافته")],
  ["campfire", W("campfire|bonfire|fire pit|fire", "نار المخيم|شبه نار|موقد نار|نار")], ["torch", W("torch(es)?", "مشعل|مشاعل")], ["lantern", W("lanterns?", "فانوس|فوانيس")],
  ["suv", W("suvs?|jeeps?|4x4|land ?cruiser", "جيب|دفع رباعي|لاندكروزر")], ["truck", W("trucks?|pickup", "شاحنه|ونيت|تريله")], ["bus", W("bus(es)?", "باص|حافله")],
  ["car", W("cars?|vehicles?|sedan|taxi", "سياره|سيارات|مركبه|تاكسي")], ["boat", W("boats?|ships?|yacht|dhow", "قارب|قوارب|مركب|سفينه|يخت|طراد")], ["bike", W("bikes?|bicycles?", "دراجه|دراجات|سيكل")],
  ["ball", W("balls?|football|soccer ball", "كوره|كره|طابه")], ["crate", W("crates?|boxes", "صندوق|صناديق|كرتون")], ["barrel", W("barrels?", "برميل|براميل")], ["cone", W("traffic cones?|cones?", "قمع|اقماع")],
  ["sofa", W("sofas?|couch(es)?", "كنبه|كنب|اريكه")], ["bed", W("beds?", "سرير|اسره")], ["desk", W("desks?", "مكتب خشبي|طاوله مكتب")], ["shelf", W("shel(f|ves)|bookcase", "رف|رفوف|مكتبه كتب")],
  ["rug", W("rugs?|carpets?", "سجاده|سجاد|زوليه")], ["tv", W("tv|television|screen", "تلفزيون|شاشه")], ["plant", W("pot plants?|potted plants?|houseplants?", "نبته|اصيص|زرعه")],
  ["cushions", W("floor cushions|majlis seating|cushions", "مساند|جلسه عربيه|تكايات")], ["painting", W("paintings?|pictures? on the wall|art", "لوحه فنيه|لوحات|بروازات")], ["piano", W("piano", "بيانو")],
  ["kitchen", W("kitchen counters?|stove|oven", "مطبخ|فرن|موقد غاز")], ["window", W("windows?", "نافذه|نوافذ|شباك")], ["chair", W("chairs?|stools?", "كرسي|كراسي")], ["table", W("tables?", "طاوله|طاولات|سفره")],
  ["vase", W("vases?", "مزهريه|فازه")], ["bottle", W("bottles?", "قاروره|زجاجه|زجاجات")], ["cart", W("carts?|wagons?", "عربه|عربات")]
];
const LIFE_WORDS = [
  ["camel", W("camels?", "جمل|جمال|ابل|ناقه|نوق|بعير")], ["horse", W("horses?|stallion", "حصان|خيل|خيول|فرس")], ["dog", W("dogs?|puppy", "كلب|كلاب|جرو")], ["cat", W("cats?|kitten", "قطه|قطط")],
  ["cow", W("cows?|cattle", "بقره|ابقار|بقر")], ["sheep", W("sheep|lambs?", "خروف|خرفان|غنم|اغنام|نعاج")], ["goat", W("goats?", "ماعز|تيس|معزه")], ["deer", W("deer|gazelles?|oryx", "غزال|غزلان|مها|ظبي")],
  ["eagle", W("eagles?|falcons?|hawks?", "صقر|صقور|نسر|نسور|عقاب")], ["seagull", W("seagulls?|gulls?", "نورس|نوارس")], ["duck", W("ducks?|swans?", "بط|بطه|اوز|بجع")], ["fish", W("fish|fishes", "سمك|اسماك|سمكه")],
  ["butterfly", W("butterfl(y|ies)", "فراشه|فراشات")], ["bird", W("birds?|sparrows?|pigeons?", "طير|طيور|عصفور|عصافير|حمام")], ["plane", W("planes?|airplanes?|jets?", "طائره|طيارات|طائرات")],
  ["child", W("kids?|children|child", "طفل|اطفال|اولاد|صغار")], ["person", W("people|persons?|man|men|woman|women|crowd|visitors|tourists|walkers", "ناس|اشخاص|شخص|رجل|رجال|امراه|نساء|زوار|سياح|جمهور|مشاه")]
];
const COLORS = [["#d63a32", W("red", "احمر|حمراء")], ["#2f6fd6", W("blue", "ازرق|زرقاء")], ["#3e9b47", W("green", "اخضر|خضراء")], ["#e8c22c", W("yellow", "اصفر|صفراء")],
  ["#f4f4f0", W("white", "ابيض|بيضاء")], ["#1d1f22", W("black", "اسود|سوداء")], ["#ec7a2d", W("orange", "برتقالي")], ["#7d4fc4", W("purple|violet", "بنفسجي|موف")], ["#e66fa7", W("pink", "وردي|زهري")],
  ["#7a5032", W("brown", "بني")], ["#8a9097", W("gr[ae]y|silver", "رمادي|فضي")], ["#d4a63a", W("gold|golden", "ذهبي")]];
const MATS = [["wood", W("wooden|wood", "خشب|خشبي")], ["metal", W("metal|steel|iron", "معدن|معدني|حديد|فولاذ")], ["glass", W("glass", "زجاج|زجاجي")], ["stone", W("stone|marble", "حجر|حجري|رخام")], ["rubber", W("rubber", "مطاط")], ["plastic", W("plastic", "بلاستيك")], ["ice", W("ice|frozen", "جليد|مثلج")]];
const NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20, a: 1, an: 1, few: 3, several: 4, many: 9, lots: 12, some: 4,
  [norm("واحد")]: 1, [norm("واحده")]: 1, [norm("اثنين")]: 2, [norm("اثنان")]: 2, [norm("ثلاث")]: 3, [norm("ثلاثه")]: 3, [norm("اربع")]: 4, [norm("اربعه")]: 4, [norm("خمس")]: 5, [norm("خمسه")]: 5, [norm("ست")]: 6, [norm("سته")]: 6, [norm("سبع")]: 7, [norm("ثمان")]: 8, [norm("تسع")]: 9, [norm("عشر")]: 10, [norm("عشره")]: 10, [norm("عده")]: 4, [norm("بعض")]: 3, [norm("كثير")]: 9, [norm("كثيره")]: 9 };
const ROOM_WORDS = [["majlis", W("majlis|diwan", "مجلس|ديوانيه")], ["bedroom", W("bedroom", "غرفه نوم")], ["kitchen", W("kitchen", "مطبخ")], ["office", W("office|workspace", "مكتب")], ["cafe", W("cafe|coffee shop|restaurant", "مقهي|كافيه|مطعم|كوفي")],
  ["gallery", W("gallery|museum|exhibition", "معرض|متحف")], ["showroom", W("showroom|car showroom", "معرض سيارات|صاله عرض")], ["classroom", W("classroom|school", "فصل دراسي|مدرسه")], ["living", W("living room|lounge|salon", "صاله|غرفه جلوس|صالون")]];

function countNear(t, idx) { // a number written just before the word ("3 palms", "ثلاث نخلات")
  const before = t.slice(Math.max(0, idx - 18), idx).trim().split(/\s+/).slice(-2);
  for (let k = before.length - 1; k >= 0; k--) { const w = before[k]; if (/^\d+$/.test(w)) return Math.min(60, +w); if (NUMS[w]) return NUMS[w]; }
  return 0;
}
function near(t, m, list) { const ar = /[\u0600-\u06FF]/.test(m[0]), end = m.index + m[0].length;
  const s = ar ? t.slice(end).trim().split(/\s+/).slice(0, 2).join(" ") : t.slice(0, m.index).trim().split(/\s+/).slice(-2).join(" "); for (const [v, re] of list) if (re.test(" " + s + " ")) return v; return null; }
const plural = (m) => { const w = m[0].trim(); return /[\u0600-\u06FF]/.test(w) ? /(ات|ين|ون)$/.test(w) || /^(?:[وفبلك])?(?:ال)?(نخيل|اشجار|صخور|جمال|ابل|خيام|بيوت|ابراج|سيارات|قوارب|طيور|اسماك|زهور|ورود|كراسي|مظلات|مصابيح|فوانيس|اعلام|براميل|صناديق)/.test(w.replace(/^[^\u0600-\u06FF]+/, "")) : /[^s]s$|ies$|ches$/.test(w) || /\b(people|children|fish|sheep|deer|cattle|men|women)\b/.test(w); };

export function localPlan(prompt, opts = {}) {
  const raw = String(prompt || "").slice(0, 600), t = norm(raw);
  const hits = PLACE_WORDS.filter(([, re]) => re.test(t)).map(([p]) => p);
  let place = opts.place && PLACES[opts.place] ? opts.place : null, water;
  if (!place) { const land = hits.filter((p) => !["lake", "beach"].includes(p)); place = land[0] || hits[0] || "meadow";
    if (place !== "lake" && hits.includes("lake") && !["underwater", "space", "room", "oasis", "island", "beach"].includes(place)) water = /\briver\b|نهر/.test(t) ? "river" : /\bpond\b|بركه/.test(t) ? "pond" : "lake";
    if (place !== "beach" && hits.includes("beach") && ["city", "village", "park", "meadow", "forest", "desert", "mountain"].includes(place)) water = "sea"; }
  let ground, shape;   // snowy mountains, a snowy forest, a desert canyon…
  if (place === "snow" && PLACE_WORDS.find((x) => x[0] === "mountain")[1].test(t)) { place = "mountain"; ground = "snow"; }
  if (place === "snow" && PLACE_WORDS.find((x) => x[0] === "forest")[1].test(t)) { place = "forest"; ground = "snow"; }
  if (place === "desert" && PLACE_WORDS.find((x) => x[0] === "mountain")[1].test(t)) shape = "mountains";
  const P = PLACES[place];
  let time = P.time ?? 10.5; for (const [h, re] of TIME_WORDS) if (re.test(t)) { time = h; break; }
  let kind = P.weather || "clear"; for (const [k, re] of WEATHER_WORDS) if (re.test(t)) { kind = k; break; }
  if (opts.time != null && Number.isFinite(+opts.time)) time = +opts.time;
  if (opts.weather && WEATHERS.includes(opts.weather)) kind = opts.weather;
  const wind = WIND.test(t) ? 9 : kind === "storm" ? 14 : kind === "sandstorm" ? 16 : kind === "rain" ? 5 : 3;
  const objects = [], life = [], seen = new Set();
  for (const [type, re] of THING_WORDS) {
    const m = re.exec(t); if (!m || seen.has(type)) continue; seen.add(type);
    if (type === "house" && (seen.has("najdi") || seen.has("villa") || seen.has("cabin") || seen.has("tower"))) continue;
    if (type === "tree" && (seen.has("palm") || seen.has("pine") || seen.has("ghaf")) && !/\btrees?\b|اشجار/.test(t.replace(/palm trees?|pine trees?/g, ""))) continue;
    const T = TYPES[type], pl = plural(m), n = countNear(t, m.index) || (T.c === "plant" ? (pl ? 8 : 1) : T.c === "building" ? (place === "city" || place === "village" ? 6 : pl ? 4 : 1) : pl ? 4 : 1);
    objects.push({ type, count: n, color: near(t, m, COLORS), mat: near(t, m, MATS) || undefined, scale: /\b(huge|giant|enormous)\b|ضخم|عملاق/.test(t.slice(Math.max(0, m.index - 14), m.index + 4)) ? 2.2 : /\b(big|large|tall)\b|كبير|طويل/.test(t.slice(Math.max(0, m.index - 14), m.index + 4)) ? 1.5 : /\b(small|little|tiny)\b|صغير/.test(t.slice(Math.max(0, m.index - 14), m.index + 4)) ? 0.6 : 1, hero: objects.length === 0 && T.c !== "plant" });
  }
  for (const [type, re] of LIFE_WORDS) { const m = re.exec(t); if (!m || life.some((l) => l.type === type)) continue; if (type === "car" && seen.has("car")) continue; if (type === "person" || type === "child") continue; life.push({ type, count: countNear(t, m.index) || (type === "fish" ? 20 : plural(m) ? 4 : 1) }); }
  const people = localPeople(raw);
  // a car "driving" / "on the road" moves; a parked one stays
  if (seen.has("car") && /\b(driving|traffic|moving|racing)\b|تسير|تمشي|زحمه|سباق|مسرعه/.test(t)) { const i = objects.findIndex((o) => o.type === "car"); if (i >= 0) { life.push({ type: "car", count: objects[i].count }); objects.splice(i, 1); } }
  let room; if (P.indoor) { room = "living"; for (const [r, re] of ROOM_WORDS) if (re.test(t)) { room = r; break; } }
  if (ground === "snow" && kind === "clear" && !opts.weather) kind = "snow";
  if (water === "sea" && !shape) shape = "coast";
  // a village or houses named next to another place ("a snowy mountain village")
  if (place !== "village" && place !== "city" && hits.includes("village") && !objects.some((o) => TYPES[o.type].c === "building")) objects.push({ type: ground === "snow" || place === "snow" || place === "mountain" || place === "forest" ? "cabin" : place === "desert" || place === "oasis" ? "najdi" : "house", count: 5 });
  const p = cleanPlan({ prompt: raw, place, room, time, weather: { kind, wind }, terrain: { ground, shape }, water: { kind: water }, objects, life, people, title: raw.slice(0, 60) || P.en, label: raw.slice(0, 60) });
  p.describe = describePlan(p);
  return p;
}

// ---- people in the words: who (a man in a thobe, two girls, a family…), how many, what they do (walk, sit, wave, talk, dance,
// run…) and what to (the nearest thing named after the verb: "walks to the car", "يجلس على الكرسي")
const WHO = [
  [{ gender: "male", age: 70 }, W("old m[ae]n|grandfathers?|elderly m[ae]n", "شيخ كبير|رجل كبير|رجل مسن|جد|عجوز")], [{ gender: "female", age: 68 }, W("old wom[ae]n|grandmothers?|elderly wom[ae]n", "عجوز|جده|امراه مسنه")],
  [{ gender: "male", age: 9 }, W("boys?|sons?", "ولد|اولاد|صبي|صبيان")], [{ gender: "female", age: 9 }, W("girls?|daughters?", "بنت|بنات|طفله")], [{ age: 8 }, W("kids?|children|child", "طفل|اطفال|صغار")],
  [{ gender: "male", age: 24 }, W("young m[ae]n|guys?|teens?|teenagers?", "شاب|شباب")], [{ gender: "female", age: 24 }, W("young wom[ae]n|ladies", "فتاه|فتيات|شابه")],
  [{ gender: "male", age: 34 }, W("m[ae]n|fathers?|dads?|husbands?|guards?|policem[ae]n|chefs?|workers?|sellers?|merchants?|fishermen|fisherman", "رجل|رجال|والد|زوج|حارس|شرطي|طباخ|عامل|عمال|بائع|تاجر|صياد")],
  [{ gender: "female", age: 32 }, W("wom[ae]n|mothers?|moms?|wives|wife", "امراه|نساء|سيده|سيدات|والده|زوجه")],
  [{ count: 2 }, W("couples?", "زوجين|ثنائي")], [{ count: 4 }, W("famil(y|ies)", "عائله|اسره")], [{ count: 7 }, W("people|persons?|crowd|visitors|tourists|walkers|shoppers|friends", "ناس|اشخاص|شخص|زوار|سياح|جمهور|مشاه|متسوقين|اصدقاء|اصحاب")]];
const ACT_WORDS = [["sit", W("sits?|sitting|seated|sat", "يجلس|يجلسون|جالس|جالسين|جالسه|تجلس|قاعد|قاعدين")], ["wave", W("waves?|waving", "يلوح|يلوحون|تلوح|يأشر|يؤشر")],
  ["talk", W("talks?|talking|chats?|chatting|speaks?|speaking|conversation", "يتحدث|يتحدثون|تتحدث|يتكلم|يتكلمون|يسولف|يسولفون|يدردش|حوار")], ["dance", W("dances?|dancing", "يرقص|يرقصون|ترقص|رقص|العرضه")],
  ["run", W("runs?|running|jogs?|jogging|sprints?", "يركض|يركضون|يجري|يجرون|تركض|تجري")], ["walk", W("walks?|walking|strolls?|strolling|goes|going|heads?|approach(es)?", "يمشي|يمشون|تمشي|يتمشي|يتمشون|يسير|يسيرون|تسير|يذهب|يتجه|يقترب")],
  ["look", W("looks?|looking|watch(es|ing)?|stares?", "ينظر|ينظرون|تنظر|يشاهد|يتأمل|يراقب")], ["point", W("points?|pointing", "يشير|تشير")], ["stand", W("stands?|standing", "يقف|يقفون|واقف|واقفين|تقف")]];
const DRESS = [["in a white thobe and shemagh", W("thobes?|dishdasha|kandura", "ثوب|ثياب|دشداشه|كندوره|شماغ|غتره")], ["in a black abaya", W("abayas?|hijabs?|niqab", "عبايه|عباءه|حجاب|نقاب")],
  ["in a suit", W("suits?|business", "بدله|رسمي")], ["in sportswear", W("sportswear|tracksuit|runner|athletes?", "رياضي|رياضيه")], ["in a chef's jacket", W("chefs?", "طباخ|شيف")]];
export function localPeople(raw) {
  const t = norm(String(raw || "").slice(0, 600)), out = [];
  for (const [who, re] of WHO) {
    const g = new RegExp(re.source, "gi"); let m;
    while ((m = g.exec(t)) && out.length < 6) {
      if (out.some((o) => Math.abs(o.at - m.index) < 4)) continue;
      // what they do: the words after them, up to the next person or the end of the sentence
      let after = t.slice(m.index + m[0].length, m.index + m[0].length + 70); const cut = after.search(/[.;!?؛،]/); if (cut >= 0) after = after.slice(0, cut);
      for (const [, r2] of WHO) { const x = r2.exec(after); if (x && x.index > 2) after = after.slice(0, x.index); }
      const around = t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 60);
      let act = "stand", k = 1e9; for (const [a, ar] of ACT_WORDS) { const x = ar.exec(after); if (x && x.index < k) { k = x.index; act = a; } }
      const rest = k < 1e9 ? after.slice(k) : after; let target, tk = 41; for (const [type, tr] of THING_WORDS) { const x = tr.exec(rest); if (x && x.index < tk) { tk = x.index; target = type; } }
      const word = (t.slice(m.index).match(/^[^\s,.;،]*\s*[\u0600-\u06FF]+/) || [""])[0].trim(), dual = /[\u0600-\u06FF]/.test(word) && /(?:ان|ين|تان|تين)$/.test(word) && !/^(?:[وفبلك])?(?:ال)?(?:صبيان|شبان|اولاد|بنات|نساء|رجال|زوار|سياح)$/.test(word);
      const dress = (DRESS.find(([, d]) => d.test(around)) || [""])[0], n = countNear(t, m.index) || (dual ? 2 : 0) || who.count || (plural(m) ? 3 : 1);
      const gender = who.gender || (/\b(she|her)\b|هي|ت(مشي|جلس|لوح|رقص)/.test(after) ? "female" : undefined);
      const look = [who.age && who.age < 13 ? (gender === "female" ? "a girl" : gender === "male" ? "a boy" : "a child") : who.age >= 60 ? (gender === "female" ? "an elderly woman" : "an elderly man") : gender === "female" ? "a woman" : gender === "male" ? "a man" : "a person", dress].filter(Boolean).join(" ");
      out.push({ look, gender, age: who.age || 30, count: Math.min(8, n), act: act === "stand" && target ? "walk" : act, target, at: m.index });
      break;
    }
  }
  return out.map(({ at, ...q }) => q);
}
const NAMES = { najdi: "mud-brick house", ghaf: "ghaf tree", palm: "palm tree", pine: "pine tree", shrub: "desert shrub", crops: "crop field", stall: "market stall", campfire: "campfire", tv: "TV", cushions: "floor cushions", person: "person", child: "child", seagull: "seagull" };
const PLURALS = { person: "people", child: "children", fish: "fish", sheep: "sheep", deer: "deer", cushions: "floor cushions", flowers: "flowers", crops: "crop fields", reeds: "reeds", bus: "buses" };
// one English sentence for a photographer / a video engine
export function describePlan(p) {
  const P = PLACES[p.place] || PLACES.meadow, h = p.time;
  const tod = h < 5 || h >= 21 ? "at night under the stars" : h < 7.2 ? "at dawn" : h < 11 ? "in the morning light" : h < 15 ? "at midday" : h < 17.6 ? "in the afternoon" : h < 19.3 ? "at golden-hour sunset" : "at dusk";
  const wx = { clear: "", cloudy: ", under a cloudy sky", rain: ", in the rain", storm: ", in a thunderstorm", snow: ", with snow falling", fog: ", in soft fog", sandstorm: ", in a sandstorm" }[p.weather.kind] || "";
  const nm = (k, n) => { const one = NAMES[k] || k, many = PLURALS[k] || (/(s|sh|ch|x)$/.test(one) ? one + "es" : /[^aeiou]y$/.test(one) ? one.slice(0, -1) + "ies" : one + "s"); return n > 1 ? many : one; };
  const things = p.objects.slice(0, 6).map((o) => (o.count > 1 ? o.count + " " + nm(o.label || o.type, 2) : (/^[aeiou]/.test(nm(o.label || o.type, 1)) ? "an " : "a ") + nm(o.label || o.type, 1))).join(", ");
  const alive = p.life.slice(0, 4).map((l) => nm(l.type, l.count)).join(" and ");
  const where = P.indoor ? "a " + ({ living: "living room", majlis: "majlis (Arabic sitting room)", cafe: "café" }[p.room] || p.room || "room") : P.en;
  return ("A walkable 3D world: " + where + " " + tod + wx + (things ? ", with " + things : "") + (alive ? "; " + alive + (p.life.length === 1 && p.life[0].count === 1 ? " moves" : " move") + " about" : "") + ".").replace(/\s+/g, " ");
}

// small changes said in words, without AI ("make it night", "add 3 camels", "remove the cars", "more trees", "rain")
export function editPlan(plan, text) {
  const t = norm(text), p = JSON.parse(JSON.stringify(plan)); let changed = false;
  for (const [h, re] of TIME_WORDS) if (re.test(t)) { p.time = h; changed = true; break; }
  for (const [k, re] of WEATHER_WORDS) if (re.test(t)) { p.weather.kind = k; changed = true; break; }
  if (WIND.test(t)) { p.weather.wind = /\b(stop|no|calm)\b|بدون|اوقف|هادئ/.test(t) ? 1 : 12; changed = true; }
  const remove = /\b(remove|delete|without|no more|get rid of)\b|احذف|ازل|بدون|شيل|امسح/.test(t);
  for (const [type, re] of THING_WORDS) { const m = re.exec(t); if (!m) continue; changed = true;
    if (remove) { p.objects = p.objects.filter((o) => o.type !== type); p.life = p.life.filter((l) => l.type !== type); }
    else { const ex = p.objects.find((o) => o.type === type), n = countNear(t, m.index) || (/\bmore\b|اكثر|زياده/.test(t) && ex ? ex.count : TYPES[type].c === "plant" ? 6 : 1);
      if (ex && /\bmore\b|اكثر|زياده/.test(t)) ex.count = Math.min(60, ex.count + n); else p.objects.push({ type, count: n, color: near(t, m, COLORS), mat: near(t, m, MATS) || undefined, at: null });
    p.exclude = (p.exclude || []).filter((x) => x !== type); }
    if (remove) p.exclude = [...new Set([...(p.exclude || []), type])]; }
  for (const [type, re] of LIFE_WORDS) { const m = re.exec(t); if (!m) continue; changed = true;
    if (remove) { p.life = p.life.filter((l) => l.type !== type); continue; }
    const n = countNear(t, m.index) || 3, ex = p.life.find((l) => l.type === type); if (ex) ex.count = Math.min(30, ex.count + n); else p.life.push({ type, count: n }); }
  let place = null; for (const [pl, re] of PLACE_WORDS) if (re.test(t) && /\b(make it|turn it into|change to|move to)\b|اجعلها|حولها|غيرها|انقلها/.test(t)) { place = pl; break; }
  if (place) { p.place = place; p.terrain = {}; p.water = {}; changed = true; }
  if (!changed) return null;
  const out = cleanPlan({ ...p, seed: plan.seed }); out.describe = describePlan(out); return out;
}

// is this a change to the world that is open, or a new world? ("add three camels", "make it night" → change; "a snowy village
// in the mountains" → new). Short words without a new place ("rain", "more palms") are changes too.
const EDIT = W("add|remove|delete|make it|make the|turn it|turn the|change|more|less|fewer|without|put|place|bigger|smaller|move|let it", "اضف|ازل|احذف|اجعل|غير|زد|زيد|اكثر|اقل|بدون|ضع|حط|كبر|صغر|انقل|خلي|خل");
export function isEdit(text, plan) {
  if (!plan) return false; const t = norm(text); if (EDIT.test(t)) return true;
  const hit = PLACE_WORDS.find(([, re]) => re.test(t)); if (hit && hit[0] !== plan.place) return false;
  return t.trim().split(/\s+/).length <= 4;
}
// a seeded random source, so the same plan always builds the same world
export function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
