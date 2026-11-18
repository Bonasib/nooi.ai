// (v231) Names in the AI words: "#name" is one of this project's pictures (by the name it was uploaded with), "@name" is a character
// (its own name, its picture and its voice) — from the site's Characters page, or added here (a name, a photo and a voice).
// Each one named goes to the AI as a reference picture: the server turns #name into that picture (lib/refs130.js); a character's
// look and voice are said in the words.
import { useTranslation } from "react-i18next";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Btn, Icon } from "@nooi/ui";
import type { Asset, Project } from "@nooi/editor-core";
import { api } from "../api";
import { serverPath, uploadAsset, urlOf } from "../media/library";
import { at } from "../site";

export interface Char { id: string; name: string; photo?: string; look?: string; voice?: string; own?: boolean }
const OWN = "nooi-studio-chars231";
export const tagOf = (s: string) => String(s || "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[^\p{L}\p{N}_]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 20) || "pic";
export const VOICES231: [string, string, string][] = [["woman", "Woman", "امرأة"], ["man", "Man", "رجل"], ["young_woman", "Young woman", "شابة"], ["young_man", "Young man", "شاب"], ["old_woman", "Older woman", "امرأة كبيرة"], ["old_man", "Older man", "رجل كبير"]];

/** the person's characters: the site's (Characters page, same browser) and the ones added in the studio */
export function charsNow(): Char[] {
  const out: Char[] = [];
  try {
    const s = JSON.parse(localStorage.getItem("dotai-studio-v2") || "{}") as { chars?: { id: string; name: string; photo?: string; look?: string; outfit?: string; voice?: { dialect?: string; gender?: string; age?: string; tone?: string } }[] };
    for (const c of s.chars || []) if (c && c.name) out.push({ id: "site:" + c.id, name: c.name, photo: c.photo, look: [c.look, c.outfit].filter(Boolean).join(", "), voice: c.voice ? [c.voice.tone, c.voice.age, c.voice.gender, c.voice.dialect].filter(Boolean).join(" ") : "" });
  } catch { /* none */ }
  try { for (const c of JSON.parse(localStorage.getItem(OWN) || "[]") as Char[]) if (c && c.name) out.push({ ...c, own: true }); } catch { /* none */ }
  return out;
}
function saveOwn(list: Char[]) { try { localStorage.setItem(OWN, JSON.stringify(list.filter((c) => c.own).map(({ own: _o, ...c }) => c))); } catch { /* full or private */ } }
const shrink = (f: File, max = 512) => new Promise<string>((ok, no) => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), cv = Object.assign(document.createElement("canvas"), { width: Math.round(im.width * k), height: Math.round(im.height * k) });
  cv.getContext("2d")!.drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(im.src); ok(cv.toDataURL("image/jpeg", 0.88)); }; im.onerror = no; im.src = URL.createObjectURL(f); });

const TOKEN = /(^|[\s(])([#@])([\p{L}\p{N}_]*)$/u;
const NAMED = /(?<![\p{L}\p{N}_])([#@])([\p{L}\p{N}_]{1,20})(?![\p{L}\p{N}_])/gu;
export const pictures = (p: Project) => Object.values(p.assets).filter((a) => a.kind === "image");

/** the words with their #pictures and @characters, as the AI job takes them (pictures uploaded first when only on this device) */
export async function withRefs(words: string, p: Project, lang: "en" | "ar"): Promise<{ prompt: string; inputs: Record<string, string>; meta: Record<string, unknown>; first?: string }> {
  const pics = pictures(p), chars = charsNow(), refs: { tag: string; url: string }[] = [], extra: string[] = [];
  const seen = new Set<string>(); let out = words;
  for (const m of words.matchAll(NAMED)) {
    const [, kind, raw] = m, key = kind + raw.toLowerCase(); if (seen.has(key) || refs.length >= 6) continue; seen.add(key);
    if (kind === "#") { const a = pics.find((x) => tagOf(x.name).toLowerCase() === raw.toLowerCase()); if (!a) continue;
      const url = serverPath(a.src) || (await uploadAsset(a)); if (url) refs.push({ tag: raw, url: serverPath(url) || url }); }
    else { const c = chars.find((x) => tagOf(x.name).toLowerCase() === raw.toLowerCase()); if (!c) continue;
      if (c.photo) { try { const b = await (await fetch(c.photo)).blob(); const u = await api.upload(b, tagOf(c.name) + ".jpg"); refs.push({ tag: raw, url: serverPath(u) || u }); } catch { /* the words still say who it is */ } }
      out = out.replace(new RegExp("@" + raw + "(?![\\p{L}\\p{N}_])", "gu"), c.photo ? "#" + raw : c.name);
      const v = VOICES231.find((x) => x[0] === c.voice); const voice = v ? (lang === "ar" ? v[2] : v[1]).toLowerCase() : c.voice;
      extra.push(`${c.name}${c.look ? ": " + c.look : ""}${voice ? `. ${c.name} speaks in a ${voice} voice` : ""}.`); }
  }
  const prompt = [out.trim(), ...extra].filter(Boolean).join("\n");
  const inputs: Record<string, string> = {}, meta: Record<string, unknown> = {};
  if (refs.length) { refs.forEach((r, i) => { inputs["vRef" + (i + 1)] = r.url; }); meta.refs130 = refs.map((r, i) => ({ slot: "vRef" + (i + 1), tag: r.tag })); }
  return { prompt, inputs, meta, first: refs[0]?.url };
}

export function MentionBox({ value, onChange, placeholder, p }: { value: string; onChange: (v: string) => void; placeholder: string; p: Project }) {
  const { t } = useTranslation(); const ref = useRef<HTMLTextAreaElement>(null); const [tok, setTok] = useState<{ kind: "#" | "@"; q: string } | null>(null); const [i, setI] = useState(0);
  const [chars, setChars] = useState<Char[]>(charsNow); const [thumbs, setThumbs] = useState<Record<string, string>>({}); const [add, setAdd] = useState(false);
  const pics = pictures(p);
  useEffect(() => { let live = true; void Promise.all(pics.map(async (a) => [a.id, a.thumb || (await urlOf(a)) || ""] as const)).then((r) => live && setThumbs(Object.fromEntries(r))); return () => { live = false; }; }, [pics.map((a) => a.id).join()]);
  const list = useMemo(() => !tok ? [] : tok.kind === "#" ? pics.filter((a) => tagOf(a.name).toLowerCase().startsWith(tok.q.toLowerCase())).map((a) => ({ id: a.id, tag: tagOf(a.name), label: a.name, img: thumbs[a.id] }))
    : chars.filter((c) => tagOf(c.name).toLowerCase().startsWith(tok.q.toLowerCase())).map((c) => ({ id: c.id, tag: tagOf(c.name), label: c.name, img: c.photo, sub: c.voice })), [tok, pics.length, chars, thumbs]);
  const look = (v: string, caret: number) => { const m = TOKEN.exec(v.slice(0, caret)); setTok(m ? { kind: m[2] as "#" | "@", q: m[3] } : null); setI(0); };
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => { const el = ref.current; if (el && caret.current != null) { el.focus(); el.setSelectionRange(caret.current, caret.current); caret.current = null; } }, [value]);   // (the caret right after the name, before the next key)
  const pick = (tag: string) => { const el = ref.current!, c = el.selectionStart, before = value.slice(0, c).replace(TOKEN, (_m, a, k) => a + k + tag + " "), v = before + value.slice(c); caret.current = before.length; onChange(v); setTok(null); };
  const used = [...value.matchAll(NAMED)].map((m) => ({ kind: m[1], tag: m[2] }));
  const known = (u: { kind: string; tag: string }) => u.kind === "#" ? pics.some((a) => tagOf(a.name).toLowerCase() === u.tag.toLowerCase()) : chars.some((c) => tagOf(c.name).toLowerCase() === u.tag.toLowerCase());
  return (<div className="mention">
    <textarea ref={ref} className="ns-in gen" rows={4} value={value} placeholder={placeholder} dir="auto" data-testid="gen-words"
      onChange={(e) => { onChange(e.target.value); look(e.target.value, e.target.selectionStart); }} onClick={(e) => look(value, (e.target as HTMLTextAreaElement).selectionStart)}
      onKeyDown={(e) => { if (!tok || !list.length) return; if (e.key === "ArrowDown") { e.preventDefault(); setI((i + 1) % list.length); } else if (e.key === "ArrowUp") { e.preventDefault(); setI((i - 1 + list.length) % list.length); } else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(list[i].tag); } else if (e.key === "Escape") setTok(null); }} />
    <p className="hint">{t("mn.hint")}</p>
    {tok && <div className="mnpop" role="listbox" data-testid="mention-pop">
      <span className="ns-lbl">{tok.kind === "#" ? t("mn.pics") : t("mn.chars")}</span>
      {list.map((x, k) => <button key={x.id} type="button" role="option" aria-selected={k === i} onMouseDown={(e) => { e.preventDefault(); pick(x.tag); }} data-testid={"mn-" + x.tag}>
        {x.img ? <img src={x.img} alt="" /> : <Icon name={tok.kind === "#" ? "image" : "users"} size={16} />}<b dir="auto">{tok.kind}{x.tag}</b><small dir="auto">{x.label}{"sub" in x && x.sub ? " · 🎙 " + x.sub : ""}</small></button>)}
      {!list.length && <p className="hint">{tok.kind === "#" ? t("mn.noPics") : t("mn.noChars")}</p>}
      {tok.kind === "@" && <div className="row"><Btn icon="plus" onClick={() => setAdd(true)} testid="mn-addchar">{t("mn.add")}</Btn><a className="ns-btn" href={at("/?view=chars")}>{t("mn.sitechars")}</a></div>}
    </div>}
    {add && <NewChar onDone={(c) => { setAdd(false); if (c) { const next = [...chars, c]; setChars(next); saveOwn(next); pick(tagOf(c.name)); } }} />}
    {used.length > 0 && <div className="mnused">{used.map((u, k) => <span key={k} className={"chip" + (known(u) ? "" : " bad")} title={known(u) ? "" : t("mn.unknown")}>{u.kind}{u.tag}{known(u) ? "" : " ?"}</span>)}</div>}
  </div>);
}
function NewChar({ onDone }: { onDone: (c: Char | null) => void }) {
  const { t } = useTranslation(); const [name, setName] = useState(""); const [photo, setPhoto] = useState(""); const [voice, setVoice] = useState("woman"); const [look, setLook] = useState(""); const lang = document.documentElement.lang;
  return (<div className="mnnew" data-testid="mn-new">
    <label className="ns-field"><span>{t("mn.name")}</span><input className="ns-input" value={name} onChange={(e) => setName(e.target.value)} dir="auto" data-testid="mn-name" /></label>
    <label className="ns-field"><span>{t("mn.photo")}</span><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await shrink(f)); }} data-testid="mn-photo" /></label>
    {photo && <img className="mnph" src={photo} alt="" />}
    <label className="ns-field"><span>{t("mn.look")}</span><input className="ns-input" value={look} onChange={(e) => setLook(e.target.value)} dir="auto" placeholder={t("mn.lookPh")} /></label>
    <label className="ns-field"><span>{t("mn.voice")}</span><select className="ns-input" value={voice} onChange={(e) => setVoice(e.target.value)} data-testid="mn-voice">{VOICES231.map(([k, en, ar]) => <option key={k} value={k}>{lang === "ar" ? ar : en}</option>)}</select></label>
    <div className="row"><Btn primary icon="check" disabled={!tagOf(name) || !name.trim()} onClick={() => onDone({ id: "own:" + Date.now().toString(36), name: name.trim().slice(0, 40), photo, look: look.trim().slice(0, 200), voice, own: true })} testid="mn-save">{t("mn.save")}</Btn><Btn ghost onClick={() => onDone(null)}>{t("mn.cancel")}</Btn></div>
  </div>);
}
export type { Asset };
