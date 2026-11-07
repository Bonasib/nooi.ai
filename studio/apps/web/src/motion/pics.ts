// (v247) Pictures inside motion graphics (the video scenes' slots): a slot holds a picture asset id; the picture is loaded once and
// kept, the preview redraws when it arrives, and an export waits for all of them first (so the file has them, not placeholders).
import type { Project } from "@nooi/editor-core";
import { bumpPics206, setPicSource206 } from "./scenes206";

interface Ent { im: HTMLImageElement | null; p: Promise<void> }
const cache = new Map<string, Ent>(); let resolveUrl: (id: string) => Promise<string | null> = async () => null; let ready = () => undefined as void;
function load(id: string): Ent {
  let e = cache.get(id); if (e) return e;
  const ent: Ent = { im: null, p: Promise.resolve() };
  ent.p = (async () => { const u = await resolveUrl(id).catch(() => null); if (!u) return; const im = new Image(); im.crossOrigin = "anonymous";
    await new Promise<void>((ok) => { im.onload = () => ok(); im.onerror = () => ok(); im.src = u; });
    if (im.naturalWidth) { ent.im = im; bumpPics206(); ready(); } })();
  cache.set(id, ent); return ent;
}
/** the host says how to find a picture's address and what to do when one arrives */
export function initPics(r: (id: string) => Promise<string | null>, onReady: () => void) { resolveUrl = r; ready = onReady; setPicSource206((id) => load(String(id)).im); }
export const picIds = (p: Project) => [...new Set(p.tracks.flatMap((t) => t.clips).flatMap((c) => (c.type === "text" && Array.isArray(c.motion?.props?.pics) ? (c.motion!.props.pics as string[]) : [])).filter(Boolean))];
/** every picture used by a motion graphic, loaded (at most 8 s) */
export async function preparePics(p: Project) { const ids = picIds(p); if (!ids.length) return; await Promise.race([Promise.all(ids.map((id) => load(id).p)), new Promise((ok) => setTimeout(ok, 8000))]); }
