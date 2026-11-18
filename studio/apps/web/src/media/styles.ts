// AI restyle: the look a scene is made again in. Each style has the words the AI is given and a small drawn example (the same little
// scene — sky, sun, hills, a person — in that style's colours and treatment), so you see the idea before you choose.
export type Fx = "none" | "grid" | "scan" | "halftone" | "paper" | "pixel" | "outline" | "glow" | "grain" | "sketch" | "mosaic" | "blocks";
export interface Style { id: string; en: string; ar: string; words: string; pal: [string, string, string, string, string, string]; fx: Fx[] }
const S = (id: string, en: string, ar: string, words: string, pal: Style["pal"], fx: Fx[] = []): Style => ({ id, en, ar, words, pal, fx });
// pal: sky top, sky bottom, sun, far hills, near hills, person
export const STYLES: Style[] = [
  S("synth80s", "80s synthwave", "سينث الثمانينات", "1980s synthwave retro style: neon magenta and cyan, a glowing sunset sun with stripes, a chrome grid floor, VHS glow", ["#120338", "#ff2bd6", "#ffd23f", "#5b1a8e", "#2a0a52", "#0a0118"], ["grid", "glow"]),
  S("vhs90s", "90s VHS", "شريط فيديو التسعينات", "1990s home-video VHS look: soft focus, colour bleeding, scan lines, slight tracking noise, warm faded colours", ["#5b6c8f", "#d9b08c", "#fff1c1", "#6b7d5a", "#4a5a3a", "#2b2b2b"], ["scan", "grain"]),
  S("anime", "Anime", "أنمي", "Japanese anime style: clean line art, cel shading, vivid colours, big expressive eyes, painted sky", ["#3f8efc", "#bfe3ff", "#fff7c2", "#7cc47f", "#3e9b5a", "#2b2f5a"], ["outline"]),
  S("anime_paint", "Hand-painted anime", "أنمي مرسوم يدوياً", "hand-painted anime film look: soft watercolour backgrounds, warm light, gentle detailed scenery", ["#7fb7e6", "#f6e7c8", "#fffbe6", "#8fbf8a", "#5f9a63", "#3c3a4a"], ["paper"]),
  S("anim3d", "3D animated film", "فيلم ثلاثي الأبعاد", "3D animated feature-film style: soft global illumination, rounded stylised characters, rich colour, subsurface skin", ["#62b6ff", "#ffe2b8", "#fff4d6", "#86c66b", "#58a548", "#e0805a"], []),
  S("clay", "Claymation", "صلصال", "claymation stop-motion: everything sculpted from modelling clay, fingerprints in the surfaces, soft studio light", ["#9fd0e8", "#f2e3c9", "#ffcf5a", "#d58c5c", "#b5653a", "#5a3b8c"], ["grain"]),
  S("stopmotion", "Stop motion puppets", "دمى متحركة", "stop-motion puppet film: handmade miniature sets, felt and wood textures, tilt-shift depth", ["#384a6b", "#c99f6e", "#f5d48a", "#6b5a3e", "#4a3c28", "#a33b3b"], ["grain"]),
  S("cyberpunk", "Cyberpunk", "سايبربانك", "cyberpunk city at night: neon signs in pink and cyan, rain-wet streets, holograms, high contrast", ["#05020f", "#3a0b5c", "#00f0ff", "#ff2bd6", "#1a0630", "#00f0ff"], ["glow", "scan"]),
  S("steampunk", "Steampunk", "ستيمبانك", "steampunk Victorian style: brass gears, copper pipes, steam, warm sepia light", ["#3b2a1a", "#c08a4a", "#ffd27a", "#7a4f2a", "#4f3218", "#2b1d10"], ["grain"]),
  S("noir", "Film noir", "فيلم نوار", "1940s film noir: black and white, hard shadows through blinds, smoky, dramatic contrast", ["#0d0d0d", "#6b6b6b", "#f2f2f2", "#3a3a3a", "#1c1c1c", "#000000"], ["grain"]),
  S("watercolor", "Watercolour", "ألوان مائية", "watercolour painting: soft washes, bleeding edges, paper texture, light airy colours", ["#a7d3f2", "#fbe7d3", "#ffd9a8", "#b6d8a8", "#89c08f", "#7a6aa8"], ["paper"]),
  S("oil", "Oil painting", "لوحة زيتية", "classical oil painting: visible brush strokes, rich glazes, warm chiaroscuro light", ["#2e3f5c", "#c99a5b", "#ffe2a1", "#5b6b3a", "#3c4a24", "#5a2a1e"], ["grain"]),
  S("sketch", "Pencil sketch", "رسم بالقلم", "pencil sketch on paper: graphite lines, cross-hatching, no colour", ["#f4f1ea", "#e8e3d6", "#f4f1ea", "#bdb6a8", "#9a9384", "#4a4740"], ["sketch", "paper"]),
  S("manga", "Manga ink", "مانغا بالحبر", "black-and-white manga: bold ink lines, screentone shading, speed lines", ["#ffffff", "#dcdcdc", "#ffffff", "#9a9a9a", "#5a5a5a", "#111111"], ["outline", "halftone"]),
  S("comic", "Comic book", "قصص مصوّرة", "American comic book: bold black outlines, flat bright colours, halftone dots, dramatic angles", ["#2f7dd8", "#ffd93a", "#fff3a0", "#e2463b", "#b1281f", "#1b1b3a"], ["outline", "halftone"]),
  S("popart", "Pop art", "فن البوب", "pop art: bold flat colours, Ben-Day dots, thick outlines, high contrast", ["#ff3d9a", "#ffe600", "#00c2ff", "#ff6b00", "#00a86b", "#111111"], ["outline", "halftone"]),
  S("pixel", "Pixel art", "فن البكسل", "16-bit pixel art: a limited palette, crisp square pixels, retro game look", ["#2b2d6e", "#6aa5ff", "#ffe36e", "#3fa34d", "#22703a", "#d94a4a"], ["pixel"]),
  S("lowpoly", "Low poly", "مضلعات قليلة", "low-poly 3D: faceted flat-shaded triangles, clean pastel lighting", ["#5ec4ff", "#c4eaff", "#ffe08a", "#7ccf8a", "#3fa66a", "#ff7a59"], ["blocks"]),
  S("vaporwave", "Vaporwave", "فيبورويف", "vaporwave aesthetic: pastel pink and teal, marble statues, palm trees, 90s computer graphics", ["#ff9ed8", "#7ef9ff", "#fff0a8", "#b48cff", "#7a5cff", "#40e0d0"], ["grid"]),
  S("celshade", "Cel shaded", "تظليل كرتوني", "cel-shaded video game look: flat two-tone shading, ink outlines, saturated colours", ["#4aa3ff", "#cfeaff", "#fff6b0", "#66cc66", "#2e9e4f", "#ff5a36"], ["outline"]),
  S("paper", "Paper craft", "ورق مقصوص", "paper craft: layered cut-paper shapes, soft shadows between layers, handmade", ["#9ad1ff", "#fff1d6", "#ffc94a", "#8ccf7e", "#57a65a", "#e8664e"], ["paper"]),
  S("bricks", "Toy bricks", "مكعبات ألعاب", "everything built from plastic toy bricks, glossy studs, bright primary colours, miniature scale", ["#4fb3ff", "#d6eeff", "#ffd400", "#2fa84f", "#1d7a36", "#e3000b"], ["blocks"]),
  S("silent20s", "1920s silent film", "فيلم صامت", "1920s silent film: sepia black-and-white, flicker, film scratches, vignette, slightly fast motion", ["#2a2118", "#a08a68", "#f0e2c0", "#5e4e38", "#3a3024", "#140f0a"], ["grain", "scan"]),
  S("film70s", "70s film", "فيلم السبعينات", "1970s film: warm grainy 35 mm, faded orange and brown tones, soft light", ["#7a5a3a", "#e8b07a", "#ffe0a0", "#9a7a3a", "#6a4a20", "#3a2412"], ["grain"]),
  S("polaroid", "Instant photo", "صورة فورية", "instant-film photo look: soft contrast, creamy highlights, slightly faded colours", ["#b8d4e0", "#f3e6cf", "#fff6dc", "#a7b98a", "#7f9469", "#5a4a4a"], ["grain"]),
  S("neonnoir", "Neon noir", "نوار النيون", "neon noir: dark rainy night, red and blue neon reflections, deep shadows, cinematic", ["#05060c", "#1b0f2e", "#ff2244", "#2244ff", "#0a0a1a", "#ff2244"], ["glow"]),
  S("fantasy", "Fantasy", "خيالي", "epic fantasy: magical glowing light, enchanted forest, painterly detail, golden particles", ["#2c3e7a", "#f6c27a", "#fff2b0", "#3f7a5a", "#24543a", "#7a3fa8"], ["glow"]),
  S("darkfantasy", "Dark fantasy", "خيال مظلم", "dark fantasy: gothic ruins, mist, cold moonlight, desaturated with deep reds", ["#0b0d14", "#3a3f52", "#d8dde8", "#262a36", "#14161e", "#7a1020"], ["grain"]),
  S("scifi", "Sci-fi", "خيال علمي", "clean science-fiction: sleek futuristic architecture, cool blue light, holographic interfaces", ["#061a33", "#2a6db0", "#bff2ff", "#16406b", "#0c2440", "#9be7ff"], ["glow"]),
  S("retrofuture", "Retro futurism", "مستقبل كلاسيكي", "retro-futurism from the 1950s: chrome rockets, atomic-age shapes, pastel space-age colours", ["#4cc3c9", "#ffe0b0", "#ff8a65", "#ffb74d", "#e57c3a", "#3a3a6a"], ["halftone"]),
  S("ukiyoe", "Woodblock print", "طباعة خشبية", "Japanese woodblock print: flat colours, flowing outlines, textured paper, stylised waves and clouds", ["#e8dcc0", "#d9c9a0", "#d9452b", "#3a6b8a", "#22465c", "#1b1b1b"], ["outline", "paper"]),
  S("impression", "Impressionist", "انطباعي", "impressionist painting: short broken brush strokes, dappled light, soft vibrant colour", ["#8fb8e8", "#f7e3b5", "#ffe28a", "#9cc57a", "#6b9a52", "#b0507a"], ["grain"]),
  S("swirl", "Swirling night painting", "لوحة ليلية دوّامية", "post-impressionist swirling brush strokes, thick paint, deep blue night sky with glowing stars", ["#0f2a6b", "#3a6bc4", "#ffe34a", "#2a4a8a", "#16305a", "#141c3a"], ["grain"]),
  S("charcoal", "Charcoal", "فحم", "charcoal drawing: smudged dark tones, rough strokes on toothy paper", ["#d8d4cc", "#9a968e", "#efece6", "#5a5650", "#2e2c28", "#121110"], ["sketch", "grain"]),
  S("chalk", "Chalkboard", "سبورة طباشير", "chalk drawing on a blackboard: dusty pastel chalk lines and smudges", ["#1d2b24", "#2b3d33", "#f5f0c8", "#a8d8b0", "#7ab8c8", "#f5f5f5"], ["sketch"]),
  S("stained", "Stained glass", "زجاج معشّق", "stained glass window: jewel-toned glass pieces, thick dark lead lines, light shining through", ["#1d4fa0", "#b03a8a", "#ffd23f", "#2a9a5a", "#c43a2a", "#3a1a5a"], ["mosaic", "glow"]),
  S("mosaic", "Mosaic", "فسيفساء", "ancient mosaic: small stone tiles, grout lines, earthy colours", ["#5a8ab0", "#e8d4a8", "#e8a83a", "#8aa05a", "#6a7a3a", "#8a3a2a"], ["mosaic"]),
  S("graffiti", "Graffiti", "غرافيتي", "street-art graffiti: spray paint, drips, bold outlines, vibrant colours on a brick wall", ["#ff3d00", "#ffd600", "#00e5ff", "#7c4dff", "#ff4081", "#111111"], ["outline", "grain"]),
  S("cartoon", "2D cartoon", "رسوم كرتونية", "classic 2D cartoon: simple shapes, thick outlines, bouncy expressive animation, bright flat colours", ["#47b5ff", "#d9f1ff", "#ffe066", "#7bd389", "#3fb867", "#ff6b6b"], ["outline"]),
  S("storybook", "Storybook", "كتاب قصص", "children's storybook illustration: gouache textures, warm soft colours, cosy whimsical details", ["#9cc9e8", "#fbe8cf", "#ffd27a", "#a8d08d", "#7ab067", "#d9776a"], ["paper"]),
  S("isometric", "Isometric diorama", "مجسّم متساوي القياس", "isometric miniature diorama: tilt-shift, tiny detailed world, clean soft light", ["#7fd1ff", "#e6f6ff", "#ffe08a", "#8bd17c", "#55aa55", "#ff8c5a"], ["blocks"]),
  S("flat", "Flat vector", "رسوم مسطحة", "flat vector illustration: geometric shapes, no gradients, a modern limited palette", ["#2ec4b6", "#cbf3f0", "#ffbf69", "#ff9f1c", "#e07a1f", "#293241"], []),
  S("bwphoto", "Black & white photo", "صورة أبيض وأسود", "classic black-and-white photography: fine grain, rich tonal range, natural light", ["#2a2a2a", "#bdbdbd", "#fafafa", "#6a6a6a", "#3a3a3a", "#111111"], ["grain"]),
  S("infrared", "Infrared", "أشعة تحت الحمراء", "infrared photography: white glowing foliage, dark skies, dreamy pink and white tones", ["#1a1030", "#c06090", "#fff0f8", "#ffe0f0", "#ffc0e0", "#301030"], ["glow"]),
  S("thermal", "Thermal camera", "كاميرا حرارية", "thermal camera view: heat colours from deep blue to yellow-white", ["#10006a", "#7a00b0", "#ffff80", "#ff6000", "#c00060", "#ffd000"], ["scan"]),
  S("hologram", "Hologram", "هولوغرام", "holographic projection: translucent cyan light, scan lines, flicker, glow", ["#001018", "#00303f", "#80ffff", "#00a0b0", "#006070", "#a0ffff"], ["scan", "glow"]),
  S("glitch", "Glitch art", "فن الخلل الرقمي", "digital glitch art: RGB split, data-moshing blocks, broken pixels, neon accents", ["#0a0a12", "#ff0055", "#00ffd5", "#5500ff", "#220033", "#00ffd5"], ["scan", "pixel"]),
  S("golden", "Golden hour cinematic", "سينمائي ساعة ذهبية", "cinematic golden hour: warm low sun, lens flare, shallow depth of field, anamorphic", ["#3a2a5a", "#ffb35a", "#fff0b0", "#a8643a", "#6a3a20", "#2a1a1a"], ["glow"]),
  S("pastel", "Pastel symmetric", "باستيل متماثل", "pastel colour palette, perfectly symmetrical framing, whimsical retro production design", ["#f7c6d0", "#fbe3c9", "#fff3d6", "#c9e4de", "#a3cfc4", "#7a5a8a"], []),
  S("western", "Western", "غرب أمريكي", "classic western film: dusty desert, warm sepia, wide landscapes, harsh sun", ["#6a8ab0", "#f0c890", "#fff0c0", "#c8864a", "#9a5a2a", "#3a2412"], ["grain"]),
  S("horror", "Horror", "رعب", "horror film: dark, cold desaturated green, fog, harsh shadows, unsettling", ["#050807", "#1f3a2c", "#c8d8c0", "#14241c", "#0a120e", "#000000"], ["grain"]),
  S("underwater", "Underwater", "تحت الماء", "underwater world: blue-green light rays, floating particles, caustics", ["#002a4a", "#008a9a", "#bff8ff", "#00566a", "#003a4a", "#ffd27a"], ["glow"]),
  S("winter", "Snowy winter", "شتاء ثلجي", "snowy winter: soft falling snow, cool blue light, frosted surfaces", ["#9ab8d8", "#eef5ff", "#ffffff", "#c8d8ea", "#a8bed8", "#3a4a6a"], ["grain"]),
  S("kawaii", "Kawaii", "كاواي", "kawaii cute style: pastel candy colours, round shapes, sparkles, smiling faces", ["#ffb3d9", "#fff0f8", "#fff59a", "#b8f0d8", "#8de0c0", "#ff7ab6"], ["outline"]),
  S("artdeco", "Art deco", "آرت ديكو", "art deco poster: gold geometric lines, black and cream, elegant 1920s glamour", ["#0d0d0d", "#2a2418", "#d8b45a", "#3a3020", "#1a160e", "#d8b45a"], ["outline"]),
  S("arabesque", "Arabesque", "أرابيسك", "arabesque art: geometric Islamic patterns, gold and turquoise tiles, intricate ornament", ["#0d3b5a", "#1f8a8a", "#e8c45a", "#2a6a6a", "#0d3b4a", "#e8c45a"], ["mosaic"]),
];

const r = (n: number) => Math.round(n * 10) / 10;
/** the example: a 160 × 90 picture of the same little scene in the style's colours and treatment (an SVG data URL) */
export function styleExample(s: Style): string {
  const [s1, s2, sun, h1, h2, fig] = s.pal, has = (f: Fx) => s.fx.includes(f), ol = has("outline") ? ` stroke="#111" stroke-width="1.4"` : has("sketch") ? ` stroke="${fig}" stroke-width="0.9" fill-opacity="0.15"` : "";
  const defs = [`<linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient>`];
  const parts: string[] = [`<rect width="160" height="90" fill="url(#k)"/>`];
  if (has("glow")) defs.push(`<filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
  const sunEl = `<circle cx="112" cy="40" r="17" fill="${sun}"${has("glow") ? ' filter="url(#g)"' : ""}${ol}/>`;
  parts.push(sunEl);
  if (has("grid") && s.id === "synth80s") for (let i = 0; i < 4; i++) parts.push(`<rect x="94" y="${r(36 + i * 4.2)}" width="36" height="1.6" fill="${s2}"/>`);
  if (has("blocks") || has("pixel")) {
    const step = has("pixel") ? 8 : 12;
    for (let x = 0; x < 160; x += step) { const y1 = 52 + Math.round((Math.sin(x / 23) * 8) / 4) * 4, y2 = 64 + Math.round((Math.cos(x / 17) * 6) / 4) * 4;
      parts.push(`<rect x="${x}" y="${y1}" width="${step}" height="${90 - y1}" fill="${h1}"${ol}/>`, `<rect x="${x}" y="${y2}" width="${step}" height="${90 - y2}" fill="${h2}"${ol}/>`); }
  } else {
    parts.push(`<path d="M0 58 C30 44 52 50 80 54 S130 44 160 52 V90 H0Z" fill="${h1}"${ol}/>`, `<path d="M0 70 C34 60 66 74 96 66 S140 62 160 68 V90 H0Z" fill="${h2}"${ol}/>`);
  }
  if (has("grid")) { const g: string[] = []; for (let i = 0; i <= 10; i++) g.push(`M${80 + (i - 5) * 4} 66 L${80 + (i - 5) * 40} 92`); for (let j = 0; j < 5; j++) { const y = 68 + j * j * 1.2 + j * 2; g.push(`M0 ${r(y)} H160`); }
    parts.push(`<path d="${g.join(" ")}" stroke="${s.id === "vaporwave" ? "#ffffff" : "#ff2bd6"}" stroke-width="0.8" fill="none" opacity="0.9"${has("glow") ? ' filter="url(#g)"' : ""}/>`); }
  // the person
  const figP = has("pixel") ? `<g fill="${fig}"><rect x="54" y="46" width="8" height="8"/><rect x="52" y="54" width="12" height="14"/><rect x="52" y="68" width="4" height="8"/><rect x="60" y="68" width="4" height="8"/></g>`
    : `<g fill="${fig}"${ol}><circle cx="58" cy="49" r="5.2"/><path d="M50 76 L52 60 Q58 54 64 60 L66 76 Z"/></g>`;
  parts.push(figP);
  if (has("halftone")) { defs.push(`<pattern id="h" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="#000" opacity="0.28"/></pattern>`); parts.push(`<rect width="160" height="90" fill="url(#h)"/>`); }
  if (has("scan")) { defs.push(`<pattern id="s" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1" fill="#000" opacity="0.28"/></pattern>`); parts.push(`<rect width="160" height="90" fill="url(#s)"/>`); }
  if (has("mosaic")) { defs.push(`<pattern id="m" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0H7V7H0Z" fill="none" stroke="#1a1a1a" stroke-width="0.9" opacity="0.65"/></pattern>`); parts.push(`<rect width="160" height="90" fill="url(#m)"/>`); }
  if (has("grain") || has("paper")) { defs.push(`<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${has("paper") ? 0.06 : 0.9}" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 ${has("paper") ? 0.35 : 0.5} 0"/></filter>`); parts.push(`<rect width="160" height="90" filter="url(#n)" opacity="${has("paper") ? 0.6 : 0.45}"/>`); }
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" width="320" height="180"><defs>${defs.join("")}</defs>${parts.join("")}</svg>`);
}
// the models a client can choose for the restyle (their names come from the site's own list of models)
export const RESTYLE_MODELS = ["auto", "hailuoh3", "kling30", "kling40", "wan30", "seedance25"];
