// v134: Extend, two ways. "Same movement" — the video simply goes on: from its last clean frame, with the camera and the action
// carrying on exactly as they were (lib/seam133.js motion134 reads them), joined so the join can't be seen. "Another angle" — the
// same moment seen from a new camera position (close-up, wide, side, over the shoulder, above, below, reverse): first a picture of
// that angle made from the last frame by the picture engine (same people, clothes, place and light — only the camera moves), then
// the video from that picture, joined with a clean film cut. Either way the customer can say what happens next, add pictures (the
// # names of v130) and their characters.
import { runEngine134 } from "./engine134.js";

export const ANGLES134 = {
  auto: ["the best next angle for this moment — a close-up if the shot was wide, a wide shot if it was close", "أفضل زاوية تالية"],
  close: ["a close-up of the main person or thing", "لقطة قريبة"],
  wide: ["a wide shot that shows the whole place", "لقطة واسعة"],
  side: ["the same moment seen from the side", "من الجانب"],
  over: ["over the shoulder of the main person, looking at what they see", "من فوق الكتف"],
  top: ["from above, looking down on the scene", "من الأعلى"],
  low: ["a low angle, looking up at the main person", "من الأسفل"],
  reverse: ["the reverse angle — the camera on the opposite side, facing back", "الزاوية المعاكسة"],
};
export const angleOf134 = (k) => (ANGLES134[k] ? k : "auto");
const said = (w) => String(w || "").trim().replace(/[.\s]+$/, "");
// the characters the customer picked: "Lina — 25, black hair in a bun, red scarf"
export const castWords134 = (chars) => (Array.isArray(chars) ? chars : []).slice(0, 4).map((c) => [String(c?.name || "").slice(0, 40), String(c?.look || "").slice(0, 200)].filter(Boolean).join(" — ")).filter(Boolean);
// the words for the new part
export function extendWords134({ mode, n, words, motion, angle, chars }) {
  const cast = castWords134(chars), who = cast.length ? ` Characters: ${cast.join("; ")} — exactly as they look.` : "";
  if (mode === "angle") return `A new camera angle on the same moment — ${ANGLES134[angleOf134(angle)][0]} — for ${n} seconds: ${said(words) || "the action goes on from where it was"}. The same characters (faces, hair, clothes), the same place, time of day, light and colours; the action continues from exactly where it was, as in a film edited from two cameras.${who}`;
  return `Continue this exact shot for ${n} more seconds: ${said(words) || "the action goes on naturally"}. It begins exactly on the last frame of the video before it — the same characters, place, time of day, light and camera style; no cut, no new scene; the action simply goes on.${motion ? " " + motion : ""}${who}`;
}
// the picture of the new angle, made from the last clean frame (it starts the new part)
export async function anglePicture134(frame, angle, words, aspect, chars) {
  const cast = castWords134(chars);
  const prompt = `The very same moment from a new camera angle: ${ANGLES134[angleOf134(angle)][0]}. It is the same scene — keep every person exactly the same (face, hair, body, clothes and their colours), every object, the place, the time of day, the weather, the light and the colours; only the camera position changes.${said(words) ? " What is happening: " + said(words) + "." : ""}${cast.length ? " Characters: " + cast.join("; ") + "." : ""} A photorealistic film still with the same look as the picture, no text, no borders.`;
  const r = await runEngine134("image", { model: "nano", prompt, aspect: aspect || undefined, inputs: { iRef: frame }, meta: { angle134: angleOf134(angle) } });
  return r.url;
}
