// v100: a picture with no words still makes a video (or a new picture).
// A video from a start picture with nothing typed is accepted (the picture is what to work from), but it reached the engine
// with no prompt at all, and Kling 3.0 (like most engines) refuses that: "AI engine 422: prompt is required". Now such a
// request gets plain words that say what to do with the picture. They are added first, before the other words steps
// (lib/v88.js: English + no on-screen text; lib/intent.js: the page's style, camera move…), so those still apply.
// Jobs that write their own full prompt (sketch, Motion Control, Extend shot, editor commands, storyboard parts) are left
// as they are; a request with neither words nor a picture is still refused (lib/jobs.js checkJob).
import { jobHooks } from "./jobs.js";
import { PICTURE_WORDS } from "./picturewords.js";

const OWN_PROMPT = (m) => m.sketch || m.sk91 || m.sk94e || m.motion83 || m.extend94 || m.extend132 || m.edCmd || Array.isArray(m.shots);
export const hasPicture = (b) => Object.values(b.inputs || {}).some((v) => typeof v === "string" && v) || (b.meta?.refs || []).some((r) => r && r.url) || !!b.chainFrom || !!b.source;

jobHooks.before.unshift(async (u, body) => {
  const kind = body && (body.kind === "chapter" ? "video" : body.kind);
  if (!PICTURE_WORDS[kind] || OWN_PROMPT(body.meta || {}) || String(body.prompt || "").trim() || !hasPicture(body)) return;
  body.prompt = PICTURE_WORDS[kind];
  body.meta = { ...(body.meta || {}), pictureWords: true };
});
