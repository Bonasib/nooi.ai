// v130: several reference pictures for one video (not only a first / end frame). Each picture has a short name the customer
// writes after "#" in the words ("#girl drinks the cold #can"). The page sends them as inputs vRef1…vRef6, with
// meta.refs130 = [{slot, tag}] in the order they were added. Seedance 2.x takes reference pictures (reference_image_urls) and
// names them @Image1, @Image2… in its words, so each #name becomes the @ImageN of its picture (providers/kie.js).
// Seedance doesn't mix reference pictures with a first / last frame: a frame then becomes one more reference ("opens on @ImageN").
export const REF_SLOTS130 = ["vRef1", "vRef2", "vRef3", "vRef4", "vRef5", "vRef6"];
export const REF_STUDIO130 = new Set(["auto", "seedance25", "seedance20", "seedance"]);   // the studio's engines that take them
export const takesRefs130 = (kieModel) => /^bytedance\/seedance-2(-fast|-5)?$/.test(String(kieModel || "").toLowerCase());
const TAG = /^[\p{L}\p{N}_]{1,20}$/u;
const STYLE_WORDS136 = /\b(anime|manga|cartoons?|animated|animation|pixar|ghibli|claymation|stop[- ]motion|watercolou?rs?|oil painting|painting|pencil|sketch|comic|pixel[- ]art|low[- ]poly|illustration|photo-?realistic|realistic|live[- ]action)\b/i;   // (v136: words that name a style win over the pictures' own)
const TAGS = /(?<![\p{L}\p{N}_])#([\p{L}\p{N}_]{1,20})(?![\p{L}\p{N}_])/gu;

// the job's reference pictures → [{tag, url}], in order
export function refsOf130(p) {
  const inp = p?.inputs || {}, seen = new Set(), out = [];
  for (const r of Array.isArray(p?.meta?.refs130) ? p.meta.refs130 : []) {
    const s = String(r?.slot || ""), u = inp[s], t = String(r?.tag || "");
    if (!REF_SLOTS130.includes(s) || typeof u !== "string" || !u || seen.has(s)) continue;
    seen.add(s); out.push({ slot: s, tag: TAG.test(t) ? t : "", url: u });
  }
  return out.slice(0, REF_SLOTS130.length);
}

// the words with each #name of a picture replaced by what the engine calls it (other # words stay as they are)
export function tagWords130(text, refs, name) {
  const by = new Map(refs.map((r, i) => [r.tag.toLowerCase(), i]).filter(([t]) => t));
  return String(text || "").replace(TAGS, (m, t) => (by.has(t.toLowerCase()) ? name(by.get(t.toLowerCase())) : m));
}
// which pictures the words name
export const tagged130 = (text, refs) => { const s = new Set(); tagWords130(text, refs, (i) => (s.add(i), "")); return s; };

// Seedance's words and pictures: the customer's words with @ImageN, the pictures they didn't name, the first / end frame
export function seedanceRefs130(prompt, refs, { start, end, style = true } = {}) {
  const at = (i) => "@Image" + (i + 1), pics = refs.map((r) => r.url), named = tagged130(prompt, refs);
  const lines = [String(prompt || "").trim() ? tagWords130(String(prompt).trim(), refs, at) : "A video with " + refs.map((_, i) => at(i)).join(", ") + ", moving naturally."];
  const rest = refs.map((_, i) => i).filter((i) => !named.has(i));
  if (rest.length && named.size) lines.push("Also use " + rest.map(at).join(", ") + " as reference" + (rest.length > 1 ? "s." : "."));
  lines.push("Keep every person, product and place exactly as they look in " + (pics.length > 1 ? "their reference pictures" : "the reference picture") + ".");
  // v136: and in the pictures' own visual style (a cartoon stays a cartoon) — unless the customer picked a Style themselves
  if (style && !/Keep exactly the visual style of the reference/.test(lines[0]) && !STYLE_WORDS136.test(String(prompt || ""))) lines.push("The video has exactly the visual style of " + (pics.length > 1 ? "these pictures" : "this picture") + ": a photo stays a photo, a cartoon or 2D animation stays a cartoon, a 3D animation stays 3D, a painting stays a painting — the same rendering, colours and light.");
  if (start) { pics.push(start); lines.push("The video opens exactly on " + at(pics.length - 1) + "."); }
  if (end) { pics.push(end); lines.push("The video ends exactly on " + at(pics.length - 1) + "."); }
  return { prompt: lines.join("\n"), pics: pics.slice(0, 9) };
}

// createJob, before the words are put into English: each picture's name becomes #ref1, #ref2… in the words (a translation
// leaves those as they are, while "#صورة1" could come back as "#picture1" and no longer name its picture). The library keeps
// the customer's own words as the title.
export function asciiTags130(body) {
  if (body?.kind !== "video" || !Array.isArray(body.meta?.refs130)) return;
  const refs = refsOf130(body); if (!refs.length) return;
  const said = String(body.prompt || "");
  if (said.trim() && !body.title) body.title = said.trim().slice(0, 300);
  body.prompt = tagWords130(said, refs, (i) => "#ref" + (i + 1));
  body.meta = { ...body.meta, refs130: refs.map((r, i) => ({ slot: r.slot, tag: "ref" + (i + 1), name: r.tag })) };
}

// createJob: the pictures are checked before anything is charged; a long video by the agents uses an engine that takes them
// in every part
export function checkRefs130(body) {
  if (!Array.isArray(body.meta?.refs130)) return;
  if (body.kind !== "video" || !refsOf130(body).length) { const { refs130, ...meta } = body.meta; body.meta = meta; return; }
  if (body.meta.refs130.length > REF_SLOTS130.length) throw Object.assign(new Error("Up to 6 reference pictures for one video."), { code: 400, errorAr: "حتى 6 صور مرجعية للفيديو الواحد." });
  if (!REF_STUDIO130.has(String(body.model || "auto")))
    throw Object.assign(new Error("Reference pictures work with Seedance — pick Seedance 2.0, or remove the pictures. Nothing was charged."), { code: 400, errorAr: "الصور المرجعية تعمل مع Seedance — اختر Seedance 2.0 أو أزل الصور. لم يُخصم شيء." });
  if (Array.isArray(body.meta.partModels)) {
    const fit = REF_STUDIO130.has(String(body.model)) && body.model !== "auto" ? body.model : "seedance20";
    body.meta = { ...body.meta, partModels: body.meta.partModels.map((m) => (REF_STUDIO130.has(String(m)) ? m : fit)) };
  }
}
