// v178: the video is made directly by the engine the customer picked — no picture made first by another engine. For an engine
// that starts from one picture (NVIDIA Cosmos, Kling 3.0, WAN, Veo…), the page sends the first picture named in the words as the
// video's first frame, and the other things it was given — the # pictures (meta.read178: their slots and names) and the @
// characters (meta.chars178: name, saved look, face photo) — are read here by the site's own vision AI (the providers the site
// already has: NVIDIA's vision model, Google's, a local model, Claude…, through llm()) and put into the words for the engine: who
// is in them and how they look, the place, the objects, the style. The pictures themselves don't go to the engine (it can't take
// them). No vision AI connected, or it fails → the saved looks and the names only; the video is still made.
import fs from "fs";
import { localPath, download } from "./media.js";
import { llmConfigured, llmJson } from "../providers/anthropic.js";

const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const dataUrl = async (url) => { const f = localPath(url) || (await download(url)).file; const ext = /\.jpe?g$/i.test(f) ? "jpeg" : /\.webp$/i.test(f) ? "webp" : "png";
  return `data:image/${ext};base64,${fs.readFileSync(f).toString("base64")}`; };
const inTime = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("took too long")), ms))]);

export async function read178(body) {
  const m = body && body.meta; if (!m || body.kind !== "video") return;
  const pics = Array.isArray(m.read178) ? m.read178.filter((r) => r && r.slot && body.inputs?.[r.slot]).slice(0, 6) : [];
  const chars = Array.isArray(m.chars178) ? m.chars178.filter((c) => c && c.name).slice(0, 3) : [];
  if (!pics.length && !chars.length) return;
  const items = [...pics.map((r) => ({ label: "#" + clip(r.tag, 30), url: body.inputs[r.slot], kind: "picture" })),
    ...chars.map((c) => ({ label: clip(c.name, 40), url: c.face || null, look: clip(c.look, 300), kind: "person" }))];
  let seen = {}, by = null;
  const withPic = items.filter((x) => x.url);
  if (withPic.length && llmConfigured()) {
    try {
      const images = await Promise.all(withPic.map((x) => dataUrl(x.url)));
      const ask = `These ${withPic.length} pictures were given for one video (the words: "${clip(body.prompt, 600)}"). The video engine can't see them — describe each so it can make the same things. Picture order: ${withPic.map((x, i) => `${i + 1} = ${x.label} (${x.kind === "person" ? "a person in the video" : "a picture named in the words"})`).join("; ")}.
For a person: apparent age, gender, face, hair, skin tone, build, clothes. For a place: the setting, light, time of day. For an object or product: shape, colours, materials, any text on it. Say the style (photo, cartoon, 3D…). At most 35 words each, in English.
Return JSON: {"pictures":[{"n":1,"what":"…"}]}`;
      const r = await inTime(llmJson(ask, { images, maxTokens: 900, tier: "quick", timeoutMs: 40000 }), 45000);
      for (const p of Array.isArray(r && r.pictures) ? r.pictures : []) { const x = withPic[(+p.n || 0) - 1]; if (x && p.what) seen[x.label] = clip(p.what, 260); }
      by = "vision";
    } catch (e) { console.warn("read178:", String(e.message).slice(0, 160)); }
  }
  const lines = items.map((x) => { const what = seen[x.label] || x.look || ""; return what ? `${x.label}: ${what}` : ""; }).filter(Boolean);
  if (lines.length) body.prompt = `${String(body.prompt || "").trim()}\nWhat the given pictures show — ${lines.join(" · ")}`;
  // the engine gets the words and its first frame, not the pictures it can't take
  for (const r of pics) delete body.inputs[r.slot];
  const { read178: _r, chars178: _c, ...rest } = m;
  body.meta = { ...rest, read178done: { pictures: pics.length, people: chars.length, by: by || (lines.length ? "looks" : "names") } };
}
