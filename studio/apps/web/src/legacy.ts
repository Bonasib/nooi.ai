// The editor before the studio kept its edit in this site's storage (localStorage "dotai-studio-v2", files in IndexedDB "dotai-media").
// Opening the studio brings that edit across once: clips (your videos and nooi results), titles, sound effects from files, the music.
import { addClip, emptyProject, mediaClip, textClip, textStyle0, uid } from "@nooi/editor-core";
import type { Asset, Project } from "@nooi/editor-core";
import { putFile } from "./media/idb";

interface OldClip { id: string; src: { k: string; job?: string; name?: string }; in?: number; out?: number; speed?: number; vol?: number; trans?: string }
interface OldText { id: string; text: string; start: number; end: number; pos?: string; size?: number; font?: string; color?: string }
interface OldSfx { id: string; n: string; name?: string; t: number; vol?: number }
interface OldJob { id: string; kind: string; status: string; title?: string; prompt?: string; resultUrl?: string; dur?: number; aspect?: string; remote?: string }

function oldFile(key: string): Promise<Blob | null> {
  return new Promise((res) => { try { const r = indexedDB.open("dotai-media", 1); r.onsuccess = () => { try { const q = r.result.transaction("m").objectStore("m").get(key); q.onsuccess = () => res((q.result as Blob) || null); q.onerror = () => res(null); } catch { res(null); } }; r.onerror = () => res(null); r.onupgradeneeded = () => { r.transaction?.abort(); res(null); }; } catch { res(null); } });
}
export function hasLegacy(): boolean { try { const s = JSON.parse(localStorage.getItem("dotai-studio-v2") || "null"); return !!(s && s.ed && ((s.ed.clips || []).length || (s.ed.texts || []).length)); } catch { return false; } }
export async function importLegacy(name: string): Promise<Project | null> {
  let S: { ed?: { clips?: OldClip[]; texts?: OldText[]; sfx?: OldSfx[]; format?: string; title?: string; musicVol?: number }; jobs?: OldJob[] } | null = null;
  try { S = JSON.parse(localStorage.getItem("dotai-studio-v2") || "null"); } catch { return null; }
  const E = S?.ed; if (!E || !((E.clips || []).length || (E.texts || []).length)) return null;
  const p = emptyProject({ name: E.title || name });
  const fmt = String(E.format || ""); if (/9:16|story|reel|tiktok|shorts|vertical/i.test(fmt)) { p.width = 1080; p.height = 1920; } else if (/1:1|square/i.test(fmt)) { p.width = 1080; p.height = 1080; } else if (/4:5/.test(fmt)) { p.width = 1080; p.height = 1350; }
  const v1 = p.tracks.find((t) => t.name === "V1")!; let at = 0;
  const fileAsset = async (key: string, nm: string, kind: Asset["kind"]): Promise<Asset | null> => { const b = await oldFile(key); if (!b) return null; const id = uid("a"); await putFile("f_" + id, b); return { id, kind, name: nm, src: "local:f_" + id, mime: b.type, size: b.size, createdAt: Date.now() }; };
  for (const c of E.clips || []) {
    let a: Asset | null = null;
    if (c.src.k === "job") { const j = (S!.jobs || []).find((x) => x.id === c.src.job); if (j?.resultUrl) a = { id: "j_" + (j.remote || j.id), kind: /image/.test(j.kind) ? "image" : "video", name: String(j.title || j.prompt || "clip").slice(0, 80), src: j.resultUrl, duration: j.dur, job: j.remote || undefined, createdAt: Date.now(), hasAudio: true }; }
    else if (c.src.k === "upload") a = await fileAsset("c_" + c.id, c.src.name || "clip", /\.(png|jpe?g|webp|gif)$/i.test(c.src.name || "") ? "image" : "video");
    if (!a) continue;
    p.assets[a.id] = a;
    const speed = c.speed || 1, dur = Math.max(0.1, ((c.out ?? (a.duration || 4)) - (c.in || 0)) / speed);
    addClip(p, mediaClip(a, at, { in: c.in || 0, dur, speed, volume: Math.max(0, Math.min(2, (c.vol ?? 100) / 100)) }), v1.id); at += dur;
  }
  for (const x of E.texts || []) { const c = textClip(x.text, x.start, { dur: Math.max(0.3, x.end - x.start), style: textStyle0({ font: x.font || "Cairo", color: x.color || "#ffffff", size: Math.max(0.03, Math.min(0.2, (x.size || 7) / 100)) }) }); c.transform.y = x.pos === "top" ? -0.36 : x.pos === "center" ? 0 : 0.36; addClip(p, c); }
  for (const s of E.sfx || []) { if (s.n !== "file") continue; const a = await fileAsset("sx_" + s.id, s.name || "sound", "audio"); if (!a) continue; p.assets[a.id] = a; addClip(p, mediaClip(a, s.t, { dur: 2, volume: (s.vol ?? 100) / 100 })); }
  const music = await fileAsset("edMusic", "Music", "audio"); if (music) { p.assets[music.id] = music; addClip(p, mediaClip(music, 0, { dur: Math.max(4, at), volume: (E.musicVol ?? 80) / 100 })); }
  return p;
}
