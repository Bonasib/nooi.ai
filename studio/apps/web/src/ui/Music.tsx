// (v245) Music made here (Audio): pick a mood and a length, listen, add it — written in code and played by the browser's own
// synthesizers, free and yours to use anywhere. Each mood shows its icon and a small moving example of its rhythm.
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { Btn, Icon, Seg } from "@nooi/ui";
import { MOODS, compose } from "@nooi/editor-core";
import { editor, toast, useUI, playerRef } from "../state";
import * as A from "../actions";
import { renderScore } from "../media/synth";
import { encodeWav } from "../engine/wav";
import { importFiles } from "../media/library";

const ICON: Record<string, string> = { calm: "moon", upbeat: "speed", epic: "film", lofi: "notes", corporate: "chart", tension: "eye", happy: "sun", cinematic: "sparkle" };
export function CodeMusic() {
  const { t } = useTranslation(); const lang = useUI((s) => s.lang);
  const [mood, setMood] = useState("upbeat"); const [len, setLen] = useState("30"); const [seed, setSeed] = useState(1); const [busy, setBusy] = useState(""); const play = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode } | null>(null);
  const make = async () => { const s = compose(mood, +len, seed); return { s, buf: await renderScore(s.notes, s.dur) }; };
  const stop = () => { try { play.current?.src.stop(); void play.current?.ctx.close(); } catch { /* */ } play.current = null; };
  const listen = async () => { if (play.current) { stop(); setBusy(""); return; } setBusy("listen"); const { buf } = await make(); const ctx = new AudioContext(), src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(); src.onended = () => { if (play.current?.src === src) { stop(); setBusy(""); } }; play.current = { ctx, src }; setBusy("playing"); };
  const add = async () => { stop(); setBusy("add"); try { const { s, buf } = await make(); const m = MOODS.find((x) => x.id === mood)!;
      const file = new File([encodeWav(buf)], `${lang === "ar" ? m.ar : m.en} ${s.bpm}bpm.wav`, { type: "audio/wav" });
      const r = await importFiles([file], null, (x) => A.addAssets([x])); const a = r.assets[0] ? editor.project.assets[r.assets[0].id] || r.assets[0] : null;
      if (a) { A.addAsset(a, playerRef.current ? editor.playhead : 0); A.run("beats", (q) => { const at = q.tracks.flatMap((tr) => tr.clips).find((c) => c.type === "media" && c.asset === a.id); const off = at ? at.start : 0; q.beats = s.beats.map((b) => Math.round((b + off) * 1000) / 1000); }); }
      toast(t("cm.added", { name: lang === "ar" ? m.ar : m.en, s: Math.round(s.dur) }), "ok"); setSeed((x) => x + 1);
    } catch (e) { toast(String((e as Error).message || e), "warn"); } finally { setBusy(""); } };
  return <div className="cm" data-testid="code-music">
    <div className="cmg">{MOODS.map((m) => <button key={m.id} type="button" className="cmt" aria-pressed={mood === m.id} onClick={() => { setMood(m.id); stop(); setBusy(""); }} data-testid={"cm-" + m.id}>
      <Icon name={ICON[m.id] || "audio"} size={16} /><span className="cmx" aria-hidden="true" style={{ ["--b" as string]: (60 / m.bpm).toFixed(3) + "s" }}><i /><i /><i /><i /></span><b>{lang === "ar" ? m.ar : m.en}</b><small dir="ltr">{m.bpm} bpm</small></button>)}</div>
    <Seg label={t("cm.len")} value={len} onChange={setLen} options={["15", "30", "60"].map((v) => ({ v, label: t("ex.secs", { n: v }) }))} />
    <div className="row"><Btn icon={busy === "playing" ? "pause" : "play"} disabled={busy === "add" || busy === "listen"} onClick={() => void listen()} testid="cm-listen">{busy === "playing" ? t("cm.stop") : t("cm.listen")}</Btn>
      <Btn icon="plus" primary disabled={!!busy && busy !== "playing"} onClick={() => void add()} testid="cm-add">{busy === "add" ? t("auto.working") : t("cm.add")}</Btn>
      <Btn icon="redo" ghost onClick={() => { setSeed((x) => x + 1); stop(); setBusy(""); }} testid="cm-another" label={t("cm.another")} /></div>
    <p className="hint">{t("cm.hint")}</p>
  </div>;
}
