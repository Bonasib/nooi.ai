// v258 — with no text AI, a pasted script is cut into the shots in its order (sentences kept whole); a short one isn't condensed.
// Run: node tests/v258_plan.mjs
import { scriptShots258, condense258, SCRIPT_MAX258 } from "../lib/long132.js";
const fails = [], chk = (n, ok, info) => { if (!ok) fails.push(n + (info === undefined ? "" : " · " + JSON.stringify(info).slice(0, 900))); };
const t = "Layla enters the souk. She sees Omar. \"Keep it safe,\" he says. She takes the map. She runs to the harbour. The boat leaves at dusk.";
const s = scriptShots258(t, 3);
chk("cut into 3 shots in order, sentences whole", s.length === 3 && s[0].startsWith("Layla enters the souk.") && s[1].includes("Keep it safe") && s[2].includes("The boat leaves at dusk."), s);
chk("an Arabic script works the same way", scriptShots258("تدخل ليلى السوق. ترى عمر. يعطيها الخريطة. تجري إلى الميناء.", 2).length === 2);
const c = await condense258("A short scene.");
chk("a short script is used whole (no condensing)", c.by === "whole" && c.text === "A short scene.", c);
chk("the limit is 30,000 characters", SCRIPT_MAX258 === 30000);
if (fails.length) { console.log("v258 plan FAIL\n - " + fails.join("\n - ")); process.exit(1); } console.log("v258 plan OK");
