// v272: nooi Auto — the only place the site chooses between engines. The customer either picks a model (it is made on that
// model or not at all: no backup engine anywhere) or picks Auto: the agents write the video as scenes, and each scene gets the
// engine it needs — a "strong" model for action and visual effects (fights, chases, explosions, crowds, creatures, magic, fire,
// storms…), a "light" one for calm scenes (talking, walking, a still view, a simple product shot), which costs fewer credits.
// The page shows the price first as the most it can be (every scene on the strong model); after the plan the hold is lowered to
// what the scenes really use. The two models: the first of each list that is on and connected (the owner can name them in Admin
// → AI providers → nooi Auto, or AUTO_STRONG / AUTO_LIGHT on the server).
export const STRONG272 = ["seedance20", "seedance25", "kling30", "veo31", "kling40", "hailuoh3", "hailuo"];
export const LIGHT272 = ["seedance", "seedance2mini", "wan27", "veo31f", "hailuo", "pixverse6", "grok"];
export const SCENE_SEC272 = 5;   // about one scene every 5 seconds

// the words that mean a scene needs a strong engine (English — the words reach here in English — and Arabic)
const STRONG_WORDS = new RegExp([
  "fight", "fights", "fighting", "battle", "war\\b", "combat", "punch", "kick", "sword", "duel", "gun", "shoot", "shooting", "bullet",
  "chase", "chasing", "pursuit", "race", "racing", "crash", "collide", "explo", "blast", "debris", "shatter", "smash", "collapse",
  "stunt", "leap", "jumps? (?:off|over|across)", "flip", "parkour", "fall(?:s|ing)? from", "fly", "flies", "flying", "soar", "swoop",
  "dragon", "monster", "creature", "giant", "beast", "alien", "robot", "mech", "spaceship", "starship", "army", "crowd", "stampede",
  "magic", "spell", "portal", "laser", "energy beam", "lightning", "fire", "flames", "burning", "inferno", "lava", "storm", "tornado",
  "hurricane", "tsunami", "flood", "avalanche", "earthquake", "transform", "morph", "shapeshift", "superhero", "superpower",
  "vfx", "cgi", "visual effects?", "particle", "slow[- ]?motion", "bullet time", "time freeze", "zero gravity", "warp", "hyperspace",
  "قتال", "معركة", "حرب", "مطاردة", "سباق", "انفجار", "تحطم", "اصطدام", "سيف", "مسدس", "رصاص", "يطير", "تطير", "طيران", "تنين", "وحش",
  "مخلوق", "روبوت", "سفينة فضاء", "جيش", "حشد", "سحر", "تعويذة", "بوابة", "ليزر", "برق", "نار", "لهب", "حريق", "عاصفة", "إعصار",
  "فيضان", "زلزال", "يتحول", "تتحول", "تحوّل", "بطل خارق", "مؤثرات", "حركة بطيئة", "أكشن", "اكشن", "action",
].join("|"), "i");
/** "strong" or "light" for one scene's words (a tag from the planner wins) */
export function power272(text, tag) {
  if (tag === "strong" || tag === "light") return tag;
  return STRONG_WORDS.test(String(text || "")) ? "strong" : "light";
}
/** the two engines Auto uses now: the first of each list that `ok(model)` accepts (on, connected, not closed to the key) */
export function tiers272(ok, pick = {}) {
  const first = (want, list) => [want, ...list].filter(Boolean).find((m) => { try { return ok(m); } catch { return false; } }) || null;
  const strong = first(pick.strong, STRONG272), light = first(pick.light, LIGHT272) || strong;
  return strong ? { strong, light: light || strong } : light ? { strong: light, light } : null;
}
/** how many scenes for a video this long */
export const scenes272 = (dur, max = 16) => Math.max(1, Math.min(max, Math.round((+dur || SCENE_SEC272) / SCENE_SEC272)));
/** the model of each scene */
export const models272 = (powers, t) => powers.map((p) => (p === "strong" ? t.strong : t.light));
