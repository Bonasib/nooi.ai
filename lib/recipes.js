// Recipes: a few steps in a row (a picture → a video from it → a sharper copy …). The first step is an ordinary job that
// carries the steps after it (meta.chain); when a step is made, the next one starts from its result (lib/jobs.js), held and
// charged like any job and given back if it fails. A failed or unaffordable step stops the recipe; what was made is kept.
const KINDS = new Set(["video", "image", "finish", "voice", "music"]);
const META = ["tool", "res", "orient", "audio", "scale", "gender", "lang", "tone", "isVideo"];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] != null && typeof o[k] !== "object").map((k) => [k, typeof o[k] === "string" ? o[k].slice(0, 40) : o[k]]));
export function cleanChain(c) {
  if (!Array.isArray(c)) return [];
  return c.filter((s) => s && KINDS.has(s.kind)).slice(0, 4).map((s) => ({ kind: s.kind, model: typeof s.model === "string" && /^[a-z0-9_.-]{1,40}$/i.test(s.model) ? s.model : undefined,
    prompt: String(s.prompt || "").slice(0, 2000), dur: s.dur ? Math.max(1, Math.min(30, Math.round(+s.dur) || 5)) : undefined, meta: pick(s.meta, META) }));
}
