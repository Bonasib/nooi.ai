// Captions you write or bring (.srt / .vtt) become text clips on a captions track, in one caption style you can change.
// (Automatic captions from speech come with the AI features — Phase 2.)
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { Btn, Icon, Seg } from "@nooi/ui";
import { textClip, textStyle0, addClip, addTrack, findClip } from "@nooi/editor-core";
import type { Project, TextClip, Track } from "@nooi/editor-core";
import * as A from "../actions";
import { toast, useProject, useUI } from "../state";
import { api } from "../api";
import { parseSubs } from "../subs";
export { parseSubs };

export function CaptionsPanel() {
  const { t } = useTranslation(); const [txt, setTxt] = useState(""); const [secs, setSecs] = useState(2.5); const ref = useRef<HTMLInputElement>(null);
  const place = (items: { a: number; b: number; text: string }[]) => {
    if (!items.length) { toast(t("cap.none"), "info"); return; }
    A.run("captions", (p) => {
      const tr = addTrack(p, "text", 0); tr.name = t("cap.track");
      for (const it of items) { const c = textClip(it.text, it.a, { template: "caption", dur: Math.max(0.3, it.b - it.a), style: textStyle0({ size: 0.055, box: { color: "#000000", opacity: 0.55, pad: 0.25, radius: 0.2 } }), animIn: { type: "fade", dur: 0.12 }, animOut: { type: "fade", dur: 0.12 } }); c.transform.y = 0.36; addClip(p, c, tr.id); }
    });
    toast(t("cap.added", { n: items.length }), "ok");
  };
  const fromLines = () => { const lines = txt.split("\n").map((l) => l.trim()).filter(Boolean); const at = A.now(); place(lines.map((l, i) => ({ a: at + i * secs, b: at + (i + 1) * secs, text: l }))); setTxt(""); };
  return (<>
    <p className="hint">{t("cap.hint")}</p>
    <textarea className="ns-input" rows={5} dir="auto" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={t("cap.placeholder")} aria-label={t("cap.lines")} />
    <label className="ns-field"><span>{t("cap.each")}<b>{secs}s</b></span><input className="ns-range" type="range" min={0.8} max={6} step={0.1} value={secs} onChange={(e) => setSecs(+e.target.value)} /></label>
    <div className="addrow"><Btn icon="captions" primary onClick={fromLines} disabled={!txt.trim()} testid="cap-add">{t("cap.place")}</Btn>
      <Btn icon="upload" onClick={() => ref.current?.click()}>{t("cap.import")}</Btn>
      <input ref={ref} type="file" accept=".srt,.vtt,text/vtt" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) place(parseSubs(await f.text())); e.target.value = ""; }} data-testid="srt-input" /></div>
    <p className="hint">{t("cap.auto")}</p>
    <TranslateCaptions />
  </>);
}
// (v226) translate the captions with AI — on the server, free (the site's text AI), the lines keep their times; either in place or
// as a second-language track under them
const LANGS: [string, string, string][] = [["ar", "Arabic", "العربية"], ["en", "English", "الإنجليزية"], ["es", "Spanish", "الإسبانية"], ["fr", "French", "الفرنسية"], ["de", "German", "الألمانية"], ["tr", "Turkish", "التركية"],
  ["ur", "Urdu", "الأردية"], ["hi", "Hindi", "الهندية"], ["id", "Indonesian", "الإندونيسية"], ["zh", "Chinese", "الصينية"], ["ru", "Russian", "الروسية"], ["pt", "Portuguese", "البرتغالية"], ["it", "Italian", "الإيطالية"],
  ["ja", "Japanese", "اليابانية"], ["ko", "Korean", "الكورية"], ["fa", "Persian", "الفارسية"], ["nl", "Dutch", "الهولندية"], ["bn", "Bengali", "البنغالية"], ["ms", "Malay", "الملايوية"], ["sw", "Swahili", "السواحيلية"]];
export function captionClips(p: Project): { track: Track; clips: TextClip[] }[] {
  const capName = new Set(["Captions", "الترجمة", "Subtitles"]);
  return p.tracks.filter((tr) => tr.kind === "text").map((tr) => ({ track: tr, clips: tr.clips.filter((c) => c.type === "text" && ((c as TextClip).template === "caption" || capName.has(tr.name))) as TextClip[] })).filter((x) => x.clips.length);
}
function TranslateCaptions() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang); const p = useProject(); const [to, setTo] = useState(lang === "ar" ? "en" : "ar"); const [mode, setMode] = useState<"add" | "replace">("add"); const [busy, setBusy] = useState(false);
  const groups = captionClips(p); const n = groups.reduce((s, g) => s + g.clips.length, 0);
  const go = async () => {
    if (!n) return; setBusy(true);
    try {
      const all = groups.flatMap((g) => g.clips.map((c) => ({ g, c }))); const r = await api.req<{ lines: string[] }>("/v1/translate149", { json: { lines: all.map((x) => x.c.text), to } });
      if (!Array.isArray(r.lines) || r.lines.length !== all.length) throw new Error(t("cap.trFail"));
      const rtl = /^(ar|ur|fa)$/.test(to); const font = rtl ? "Cairo" : /^(ja|zh|ko|hi|bn)$/.test(to) ? ({ ja: "Noto Sans JP", zh: "Noto Sans SC", ko: "Noto Sans KR", hi: "Hind", bn: "Hind Siliguri" } as Record<string, string>)[to] : "Inter";
      A.run("translate captions", (q) => {
        if (mode === "replace") { for (const [i, x] of all.entries()) { const f = findClip(q, x.c.id); if (f && f.clip.type === "text") { f.clip.text = r.lines[i]; f.clip.style.font = font; f.clip.style.dir = rtl ? "rtl" : "auto"; } } return; }
        for (const g of groups) {
          const tr = addTrack(q, "text", Math.max(0, q.tracks.findIndex((x) => x.id === g.track.id) + 1)); tr.name = t("cap.track") + " · " + to.toUpperCase();
          for (const c of g.clips) { const i = all.findIndex((x) => x.c.id === c.id); const k = textClip(r.lines[i], c.start, { template: "caption", dur: c.dur, style: { ...c.style, font, size: c.style.size * 0.85, dir: rtl ? "rtl" : "auto" }, animIn: c.animIn, animOut: c.animOut });
            k.transform = { ...c.transform, y: c.transform.y + c.style.size * 1.5 }; addClip(q, k, tr.id); }
        }
      });
      toast(t("cap.translated", { n, lang: (LANGS.find((x) => x[0] === to) || ["", to, to])[lang === "ar" ? 2 : 1] }), "ok");
    } catch (e) { const er = e as { message?: string; errorAr?: string }; toast((lang === "ar" && er.errorAr) || er.message || t("cap.trFail"), "warn"); }
    finally { setBusy(false); }
  };
  return (
    <div className="aicard" data-testid="cap-translate">
      <h3 className="ns-h3"><span className="aibadge" aria-hidden="true"><Icon name="globe" size={14} /></span>{t("cap.translate")}</h3>
      <p className="hint">{n ? t("cap.trHint", { n }) : t("cap.trNone")}</p>
      <label className="ns-field"><span>{t("cap.to")}</span><select className="ns-input" value={to} onChange={(e) => setTo(e.target.value)} data-testid="cap-to">{LANGS.map(([k, en, ar]) => <option key={k} value={k}>{lang === "ar" ? ar : en}</option>)}</select></label>
      <Seg label={t("cap.trMode")} value={mode} onChange={setMode} options={[{ v: "add", label: t("cap.trAdd") }, { v: "replace", label: t("cap.trReplace") }]} />
      <Btn icon="globe" primary disabled={!n || busy || !api.online} onClick={() => void go()} testid="cap-tr-go">{busy ? t("cap.translating") : t("cap.trGo") + " · " + t("ai.free")}</Btn>
    </div>
  );
}
