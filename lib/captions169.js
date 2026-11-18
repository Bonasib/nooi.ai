// v169: the editor's exact captions. The page mixes the sound of the whole edit itself (a small WAV: 16 kHz, one channel),
// uploads it, and gets back every word said with the moment it starts and ends — from the speech-to-text engine set up in
// Admin (ElevenLabs Scribe, else OpenAI Whisper with word times). Priced per minute like a transcript and shown on the
// button before anything is sent; held, charged when the words come back, released when they don't (or when nothing is
// said). The sound file is deleted as soon as it has been heard.
//   GET  /v1/captions169?dur=SECONDS → {ready, cost, perMin, maxMin}
//   POST /v1/captions169 {url: "/media/….wav", lang?} → {words: [{s, e, w}], lines: [{s, e, text}], lang, cost}
import fs from "fs";
import { user, uid, save } from "./store.js";
import { hold, settle, release } from "./billing.js";
import { transcribeWords, sttReady, locPrice } from "./localize.js";
import { mediaDur } from "./voice.js";
import { ownFile } from "./edit145.js";

const MAX_MIN = 30;
const perMin = () => Math.max(1, +locPrice().stt || 1);
export const price169 = (dur, staff) => (staff ? 0 : perMin() * Math.max(1, Math.ceil((+dur || 0) / 60)));
const refuse = (msg, msgAr, code = 400) => { throw Object.assign(new Error(msg), { code, errorAr: msgAr }); };
// the words as the editor keeps them: in time order, each with a length, none empty
export function words169(r) {
  const out = (r && r.words || []).map((w) => ({ s: Math.max(0, +(+w.s || 0).toFixed(3)), e: +(+w.e || 0).toFixed(3), w: String(w.text || w.w || "").replace(/\s+/g, " ").trim() }))
    .filter((w) => w.w && isFinite(w.s) && isFinite(w.e)).map((w) => ({ ...w, e: Math.max(w.e, +(w.s + 0.08).toFixed(3)) })).sort((a, b) => a.s - b.s);
  const lines = out.length ? [] : (r && r.lines || []).map((l) => ({ s: Math.max(0, +l.s || 0), e: Math.max(+l.e || 0, (+l.s || 0) + 0.3), text: String(l.text || "").trim() })).filter((l) => l.text);
  return { words: out.slice(0, 20000), lines: lines.slice(0, 3000) };
}
const BUSY = new Set();
export function registerCaptions169(app, requireUser, isStaff) {
  app.get("/v1/captions169", requireUser, (req, res) => {
    const staff = isStaff(req.user), dur = Math.max(0, Math.min(MAX_MIN * 60, +req.query.dur || 0));
    res.json({ ready: sttReady(), perMin: staff ? 0 : perMin(), cost: price169(dur, staff), maxMin: MAX_MIN });
  });
  app.post("/v1/captions169", requireUser, async (req, res) => {
    const b = req.body || {}, U = user(req.user.uid), file = ownFile(U, b.url), staff = isStaff(req.user), lang = /^[a-z]{2,3}$/.test(String(b.lang || "")) ? String(b.lang) : null;
    const gone = () => { if (!file) return; fs.rm(file, { force: true }, () => {}); const n = String(b.url || "").split(/[?#]/)[0].split("/").pop(); U.uploads = (U.uploads || []).filter((x) => x !== n); save(); };
    if (!file) return res.status(404).json({ error: "The sound of the edit didn't arrive — try again.", errorAr: "لم يصل صوت المونتاج — حاول مجدداً." });
    if (BUSY.has(req.user.uid)) { gone(); return res.status(429).json({ error: "Captions are already being made — wait a moment.", errorAr: "الترجمة قيد الصنع — انتظر لحظة." }); }
    BUSY.add(req.user.uid); const ref = "cap169." + uid(); let cost = 0;
    try {
      if (!sttReady()) refuse(staff ? "Exact captions need speech-to-text connected (Admin → AI providers: ElevenLabs or OpenAI)." : "Exact captions aren't available right now — make them on this device instead.", "الترجمة الدقيقة غير متاحة الآن — اصنعها على هذا الجهاز بدلاً من ذلك.", 501);
      const dur = await mediaDur(file).catch(() => 0);
      if (!(dur > 0.2)) refuse("The sound of the edit couldn't be read — try again.", "تعذّرت قراءة صوت المونتاج — حاول مجدداً.");
      if (dur > MAX_MIN * 60 + 1) refuse("Exact captions work on up to " + MAX_MIN + " minutes at a time.", "الترجمة الدقيقة تعمل حتى " + MAX_MIN + " دقيقة في المرة.");
      cost = price169(dur, staff);
      if (cost) hold(req.user.uid, cost, "Exact captions · " + Math.ceil(dur / 60) + " min", ref);
      let r;
      try { r = await transcribeWords(file, lang); }
      catch (e) { if (cost) release(req.user.uid, ref); cost = 0; console.warn("captions169:", String(e.message || e).slice(0, 200));
        refuse("The words couldn't be heard right now — nothing was charged. Try again, or make them on this device.", "تعذّر سماع الكلمات الآن — لم يُخصم شيء. حاول مجدداً أو اصنعها على هذا الجهاز.", 502); }
      const out = words169(r);
      // (nothing said at all → nothing charged)
      if (!out.words.length && !out.lines.length) { if (cost) release(req.user.uid, ref); cost = 0; }
      else if (cost) settle(req.user.uid, ref);
      res.json({ ...out, lang: r.lang || lang, cost, ...(staff ? { by: r.by } : {}) });
    } catch (e) { res.status(e.code || 500).json({ error: String(e.message || e).slice(0, 240), errorAr: e.errorAr }); }
    finally { BUSY.delete(req.user.uid); gone(); }
  });
}
