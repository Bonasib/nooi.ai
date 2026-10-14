// The studio's own craft notes: lib/skills/*.md — cinematography, story, directing, sound, dubbing, art & style — written for
// nooi from general craft knowledge. Each file belongs to one agent (lib/agents.js) and holds short cards
// (title · how · when · tags, with an Arabic title and text for the Film crew page). The agents always read the best-fitting
// notes next to what they learned from the web, and results move the notes up or down like any other card.
//
// File format:
//   # Craft            ← the file's name for people
//   agent: cine         ← the agent that owns the cards
//   tags: video, image  ← default tags of the cards
//   ## Card title       ← one card; then "ar:", "how:", "how_ar:", "when:" and optional "tags:" lines
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";

const DIR = fileURLToPath(new URL("./skills", import.meta.url));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const tagList = (s) => String(s || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

export function parseSkills(text, file) {
  const name = path.basename(file || "notes", ".md"), head = {}, cards = []; let cur = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    if (/^##\s+/.test(line)) { cur = { title: line.replace(/^##\s+/, "").trim() }; cards.push(cur); continue; }
    if (/^#\s+/.test(line)) { head.craft = line.replace(/^#\s+/, "").trim(); continue; }
    const m = /^([a-z_]+):\s*(.*)$/.exec(line); if (!m) continue;
    (cur || head)[m[1]] = m[2].trim();
  }
  const agent = head.agent || "", tags = tagList(head.tags);
  return cards.filter((c) => c.title && c.how).map((c) => ({ id: "nooi-" + name + "-" + slug(c.title), agent, craft: head.craft || name, title: c.title.slice(0, 80), ar: (c.ar || "").slice(0, 80),
    how: c.how.slice(0, 400), howAr: (c.how_ar || "").slice(0, 400), when: (c.when || "").slice(0, 120), tags: c.tags ? tagList(c.tags) : tags, src: "https://nooi.ai/skills/" + name }));
}

let cache = null;
export function builtinSkills() {
  if (cache) return cache;
  let files = []; try { files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort(); } catch { files = []; }
  cache = files.flatMap((f) => { try { return parseSkills(fs.readFileSync(path.join(DIR, f), "utf8"), f); } catch { return []; } });
  return cache;
}
// a few notes of one craft as plain lines for a prompt (reference notes, not instructions)
export const craftNotes = (name, n = 4) => builtinSkills().filter((c) => c.src.endsWith("/" + name)).slice(0, n).map((c) => `- ${c.title}: ${c.how}`).join("\n");
