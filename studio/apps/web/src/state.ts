// Shared state: the editor (project + history), the UI (panels, tools, zoom…), the player, toasts. Small stores, no framework.
import { useSyncExternalStore } from "react";
import { Editor, emptyProject, migrate } from "@nooi/editor-core";
import type { Project } from "@nooi/editor-core";
import { getJSON, putJSON } from "./media/idb";
import { api } from "./api";
import type { Player } from "./engine/player";

export const editor = new Editor(emptyProject());
export function useProject(): Project { useSyncExternalStore((f) => editor.subscribe(f), () => editor.version); return editor.project; }
export function useEditorVersion() { return useSyncExternalStore((f) => editor.subscribe(f), () => editor.version); }

export type Rail = "media" | "stock" | "auto" | "audio" | "titles" | "transitions" | "effects" | "stickers" | "templates";   // the spec's 8-category dock (§4.2)
export type Workspace = "classic" | "vertical" | "color" | "audio";
export type Tool = "select" | "ripple" | "roll" | "slip" | "slide";
export interface UI {
  rail: Rail; sub: Partial<Record<Rail, string>>; tool: Tool; zoom: number; snap: boolean; scrollX: number;
  inspector: string; exportOpen: boolean; paletteOpen: boolean; projectsOpen: boolean; panelOpen: boolean;
  theme: "dark" | "light"; lang: "en" | "ar"; saved: "saved" | "saving" | "local" | "error"; folder: string | null; loop: boolean;
  safe: boolean; preview: string | null;      // an effect / transition shown on the preview before it is added
  workspace: Workspace; mate: boolean; hub: boolean; cloudOpen: boolean; fileOpen: boolean; settingsOpen: boolean; reframeOpen: boolean; speedOpen: boolean; historyOpen: boolean;
  rec: "idle" | "count" | "rec"; count: number;   // the voice-over: 3-2-1, then recording
  saveErr: string;   // why the last save to the account did not go through
}
function createStore<T extends object>(init: T) {
  let s = init; const ls = new Set<() => void>();
  return {
    get: () => s, set: (p: Partial<T> | ((s: T) => Partial<T>)) => { s = { ...s, ...(typeof p === "function" ? p(s) : p) }; ls.forEach((f) => f()); },
    subscribe: (f: () => void) => { ls.add(f); return () => { ls.delete(f); }; },
  };
}
const saved = (() => { try { return JSON.parse(localStorage.getItem("nooi-studio-ui") || "{}"); } catch { return {}; } })();
export const ui = createStore<UI>({
  rail: "media", sub: {}, tool: "select", zoom: 60, snap: true, scrollX: 0, inspector: "video", exportOpen: false, paletteOpen: false, projectsOpen: false, panelOpen: false,
  theme: saved.theme === "light" ? "light" : "dark", lang: saved.lang === "ar" || (!saved.lang && /^ar/.test(navigator.language)) ? "ar" : "en",
  saved: "saved", folder: null, loop: false, safe: false, preview: null,
  workspace: "classic", mate: false, hub: false, cloudOpen: false, fileOpen: false, settingsOpen: false, reframeOpen: false, speedOpen: false, historyOpen: false, rec: "idle", count: 0, saveErr: "",
});
ui.subscribe(() => { const s = ui.get(); try { localStorage.setItem("nooi-studio-ui", JSON.stringify({ theme: s.theme, lang: s.lang })); } catch { /* private mode */ } });
export function useUI<K>(pick: (s: UI) => K): K { return useSyncExternalStore(ui.subscribe, () => pick(ui.get())); }

// ---- toasts
export interface Toast { id: number; text: string; kind: "ok" | "warn" | "info"; action?: { label: string; run: () => void } }
export const toasts = createStore<{ list: Toast[] }>({ list: [] });
let tid = 0;
export function toast(text: string, kind: Toast["kind"] = "info", action?: Toast["action"]) {
  const id = ++tid; toasts.set((s) => ({ list: [...s.list.slice(-3), { id, text, kind, action }] }));
  setTimeout(() => toasts.set((s) => ({ list: s.list.filter((x) => x.id !== id) })), kind === "warn" ? 6000 : 3500);
}

// ---- the player is made by the preview; others reach it here
export const playerRef: { current: Player | null } = { current: null };

// ---- saving: this device at once (after a short pause), the account a little later (when signed in)
let localT = 0, cloudT = 0, cloudBase = 0;
export function autosave() {
  clearTimeout(localT); clearTimeout(cloudT);
  if (ui.get().saved !== "saving") ui.set({ saved: "saving" });
  localT = window.setTimeout(async () => {
    const p = editor.project; await putJSON("proj_" + p.id, p); localStorage.setItem("nooi-studio-last", p.id);
    const idx = (await getJSON<{ id: string; name: string; updated: number }[]>("projects")) || [];
    const row = { id: p.id, name: p.name, updated: Date.now() }; await putJSON("projects", [row, ...idx.filter((x) => x.id !== p.id)].slice(0, 100));
    ui.set({ saved: api.online && api.me.signedIn ? "saving" : "local" }); editor.dirty = false;
    cloudT = window.setTimeout(saveCloud, 3000);
  }, 700);
}
// (v225) the account copy leaves out the pictures this device makes again by itself (filmstrips, large thumbnails), so a project with
// many clips stays well inside the account's limit; a save that fails says why and tries again on its own (not after a conflict)
export function slimForCloud(p: Project): Project {
  return { ...p, assets: Object.fromEntries(Object.entries(p.assets).map(([k, a]) => { const b = { ...a }; delete b.strip; if (b.thumb && b.thumb.length > 24000) delete b.thumb; return [k, b]; })) };
}
let retryT = 0, tries = 0;
export async function saveCloud(): Promise<boolean> {
  clearTimeout(retryT);
  if (!api.online || !api.me.signedIn) { ui.set({ saved: "local", saveErr: "" }); return false; }
  const p = editor.project; const id = cloudId(p.id);
  try { const r = await api.saveProject(id, p.name, slimForCloud(p), cloudBase || undefined); cloudBase = r.updated || Date.now(); tries = 0; ui.set({ saved: "saved", saveErr: "" }); return true; }
  catch (e) {
    const er = e as { status?: number; message?: string; errorAr?: string }; const st = er.status;
    const why = (ui.get().lang === "ar" && er.errorAr) || er.message || ""; ui.set({ saved: "error", saveErr: st == null ? i18nText("save.offline") : why });
    if (st === 409) { cloudBase = 0; toast(i18nText("save.conflict"), "warn"); }
    else if (st !== 413 && tries < 4) { tries++; retryT = window.setTimeout(() => void saveCloud(), 8000 * tries); }   // a dropped connection or a busy server: again in a little while
    return false;
  }
}
export const cloudId = (id: string) => ("st" + id.replace(/[^a-z0-9]/gi, "").toLowerCase()).slice(0, 24).padEnd(8, "0");
export async function openProject(p: Project | unknown) { cloudBase = 0; editor.load(migrate(p)); playerRef.current?.resize(); playerRef.current?.seek(0); }
let i18nText: (k: string) => string = (k) => k;
export function setI18nText(f: (k: string) => string) { i18nText = f; }

// when the person picked a clip themselves (a tap on the timeline, a new title): on a phone or tablet its settings open then
let pickedAt = 0;
export const markPick = () => { pickedAt = Date.now(); };
export const pickedNow = () => Date.now() - pickedAt < 800;
