// v150: motion ads — the plan of animated scenes for the editor (public/editor150/plan.js has the scenes and the plan made
// without any AI), written by the site's text AI when one is set up (any of them — free, the quick tier), always checked with
// clean150(); and two tools for AI agents (Claude, ChatGPT, any MCP client) that put a motion ad or one scene on a project.
//   POST /v1/motion150/plan {brand, msg, len, lang} → {scenes:[{sc, t1, t2, items, val, ic, dur}], by:"ai"|"local"}
import { llmJson, llmConfigured } from "../providers/anthropic.js";
import { uid } from "./store.js";
import { KINDS150, ICONS150, clean150, plan150, iconFor150 } from "../public/editor150/plan.js";
import { OPS148, EXT148, TOOLS148, WRITE148 } from "./edit148.js";

const bad = (en, ar, code = 400) => Object.assign(new Error(en), { code, errorAr: ar });
const str = (x, n) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, n);
const COL = /^#[0-9a-f]{6}$/i;

export async function aiPlan150(b) {
  const brief = { brand: str(b.brand, 40), msg: str(b.msg, 600), len: Math.max(6, Math.min(60, +b.len || 20)) };
  if (!brief.brand && !brief.msg) throw bad("Say what the ad is about.", "اكتب موضوع الإعلان.");
  if (!llmConfigured()) return { scenes: plan150(brief), by: "local" };
  const ask = `You plan a short motion-graphics ad, like an app commercial: animated scenes over a dark background with one accent colour, cut to music.
Brand: ${brief.brand || "(none)"}
Brief: ${brief.msg || "(none)"}
Length: ${brief.len} seconds. Write every word in the language of the brief.
Use only these scene kinds:
- logo: the brand appears (title = the brand, subtitle = a short tagline or empty)
- trail: glowing light trails, a transition (no words, or a 1-3 word title)
- phone: an app screen (title = what the screen asks, items = up to 5 short words as buttons)
- counter: one big number (number, title = what it counts in 1-3 words, icon)
- board: a leaderboard (title, subtitle, items = "Name:points" up to 6; one of them is "You" / "أنت")
- call: a video call card (title = a question someone asks, subtitle = the reply)
- nodes: 3-6 things joined by glowing lines (items = short labels)
- words: big words (title = 1-3 words, subtitle = the rest of the line or empty)
- end: the end card (title = the brand, subtitle = a call to action, items = optional small print)
Start with logo or words, end with end, 5 to 9 scenes, the seconds adding up to about ${brief.len}. icon is one of: ${ICONS150.join(", ")}.
Answer with JSON only: {"scenes":[{"kind":"...","seconds":2.5,"title":"","subtitle":"","items":[],"number":null,"icon":null}]}`;
  try {
    const j = await llmJson(ask, { maxTokens: 1500, tier: "quick", timeoutMs: 45000 }), sc = clean150(j && j.scenes, brief.len);
    if (sc.length >= 3 && sc.some((s) => s.sc !== "trail")) return { scenes: sc, by: "ai" };
  } catch (e) { console.warn("motion150 plan:", String(e.message || e).slice(0, 160)); }
  return { scenes: plan150(brief), by: "local" };
}

// a plan → the editor's own items: the ad's background clip, the scenes one after another from `at`, whooshes at the cuts
export function items150(scenes, at, col) {
  const ac = COL.test(col || "") ? col : "#7CFF4F", infos = [], sfx = []; let t = at;
  scenes.forEach((s, i) => {
    const e = +(t + s.dur).toFixed(2);
    infos.push({ id: uid(), type: "mg150", sc: s.sc, start: +t.toFixed(2), end: e, x: 0.5, y: 0.5, k: 1, anim: "in", bg: "dark", accent: ac, t1: s.t1 || "", t2: s.t2 || "", items: (s.items || []).join(" | "), val: s.val == null ? "" : String(s.val), ic: s.ic || null, ad150: 1,
      ...(s.sc === "nodes" ? { ics: (s.items || []).map((x, j) => iconFor150(x, j)) } : {}) });
    if (i > 0) sfx.push({ id: uid(), n: "whoosh", t: +Math.max(0, t - 0.18).toFixed(2), vol: 55, ad150: 1 });
    if (s.sc === "logo" || s.sc === "counter") sfx.push({ id: uid(), n: "impact", t: +(t + 0.35).toFixed(2), vol: 60, ad150: 1 });
    t = e;
  });
  return { bg: { id: uid(), out: +Math.min(60, t - at).toFixed(2), ac }, infos, sfx };
}

// the operation, the same as op148 in the page: the background clip at the end, the scenes and their sounds
OPS148.motion_add = (ed, a) => {
  ed.clips = ed.clips || []; ed.infos = ed.infos || []; ed.sfx = ed.sfx || [];
  if (a.bg && !ed.clips.some((c) => c.id === a.bg.id)) ed.clips.push({ id: a.bg.id, src: { k: "demo", kind: "mg150", ac: a.bg.ac, name: "Motion ad background" }, in: 0, out: a.bg.out, speed: 1, trans: "cut", vol: 0 });
  for (const it of a.infos || []) if (!ed.infos.some((x) => x.id === it.id)) ed.infos.push(it);
  for (const f of a.sfx || []) if (!ed.sfx.some((x) => x.id === f.id)) ed.sfx.push(f);
};

const P = { project_id: { type: "string" } };
TOOLS148.push(
  { name: "nooi_motion_ad", description: "Build a motion-graphics ad on a project from a short brief: animated scenes (the brand's logo reveal, light trails, an app screen, a big number, a leaderboard, a video call, a map of things joined by lines, big words, an end card) on their own dark background, with whooshes at the cuts — added after what is on the timeline now. Free. Every scene can be changed in the editor after.",
    inputSchema: { type: "object", properties: { ...P, brand: { type: "string" }, brief: { type: "string", description: "What the ad should say — the words, numbers and things to show." }, seconds: { type: "number", description: "10–60, default 20" }, colour: { type: "string", description: "The accent colour as #rrggbb" } }, required: ["project_id", "brief"] } },
  { name: "nooi_motion_scene_add", description: "Add one animated motion scene to a project's timeline from start to end seconds.",
    inputSchema: { type: "object", properties: { ...P, kind: { type: "string", enum: KINDS150 }, start: { type: "number" }, end: { type: "number" }, title: { type: "string" }, subtitle: { type: "string" },
      items: { type: "array", items: { type: "string" }, description: "phone: button words · board: 'Name:points' · nodes: labels · end: small print" }, number: { type: "number" }, icon: { type: "string", enum: ICONS150 },
      colour: { type: "string" }, background: { type: "string", enum: ["dark", "none"], description: "dark: its own glowing background; none: over the video" } }, required: ["project_id", "kind"] } });
WRITE148.add("nooi_motion_ad"); WRITE148.add("nooi_motion_scene_add");
EXT148.push(async (uidv, name, a, x) => {
  if (name === "nooi_motion_ad") {
    const len = Math.max(10, Math.min(60, +a.seconds || 20)), r = await aiPlan150({ brand: a.brand, msg: a.brief, len });
    const args = items150(r.scenes, +x.total().toFixed(2), a.colour);
    return x.done(x.commit({ op: "motion_add", args }), "motion ad added: " + r.scenes.length + " scenes (" + r.scenes.map((s) => s.sc).join(", ") + ")" + (r.by === "local" ? " — planned without the text AI" : ""));
  }
  if (name === "nooi_motion_scene_add") {
    if (!KINDS150.includes(a.kind)) throw bad("Unknown scene " + a.kind + ".", "مشهد غير معروف.");
    const s = Math.max(0, +a.start || 0), e = Math.max(s + 0.5, +a.end || s + 3), sc = clean150([{ kind: a.kind, title: a.title, subtitle: a.subtitle, items: a.items, number: a.number, icon: a.icon, seconds: e - s }], e - s)[0];
    const { infos } = items150([{ ...sc, dur: e - s }], s, a.colour); infos[0].bg = a.background === "none" ? "none" : "dark";
    return x.done(x.commit({ op: "motion_add", args: { infos } }), "motion scene added");
  }
  return null;
});

export function registerMotion150(app, requireUser) {
  app.post("/v1/motion150/plan", requireUser, async (req, res) => {
    try { res.json(await aiPlan150(req.body || {})); }
    catch (e) { res.status(e.code || 500).json({ error: e.message, errorAr: e.errorAr }); }
  });
}
