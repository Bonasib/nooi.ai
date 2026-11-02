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

export type Rail = "media" | "audio" | "text" | "captions" | "effects" | "color" | "ai";
export type Tool = "select" | "ripple" | "roll" | "slip" | "slide";
export interface UI {
  rail: Rail; sub: Partial<Record<Rail, string>>; tool: Tool; zoom: number; snap: boolean; scrollX: number;
  inspector: string; exportOpen: boolean; paletteOpen: boolean; projectsOpen: boolean; panelOpen: boolean;
  theme: "dark" | "light"; lang: "en" | "ar"; saved: "saved" | "saving" | "local" | "error"; folder: string | null; loop: boolean;
  safe: boolean; preview: string | null;      // an effect / transition shown on the preview before it is added
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
export async function saveCloud(): Promise<boolean> {
  if (!api.online || !api.me.signedIn) { ui.set({ saved: "local" }); return false; }
  const p = editor.project; const id = cloudId(p.id);
  try { const r = await api.saveProject(id, p.name, p, cloudBase || undefined); cloudBase = r.updated || Date.now(); ui.set({ saved: "saved" }); return true; }
  catch (e) { const st = (e as { status?: number }).status; if (st === 409) { cloudBase = 0; toast(i18nText("save.conflict"), "warn"); } ui.set({ saved: "error" }); return false; }
}
export const cloudId = (id: string) => ("st" + id.replace(/[^a-z0-9]/gi, "").toLowerCase()).slice(0, 24).padEnd(8, "0");
export async function openProject(p: Project | unknown) { cloudBase = 0; editor.load(migrate(p)); playerRef.current?.resize(); playerRef.current?.seek(0); }
let i18nText: (k: string) => string = (k) => k;
export function setI18nText(f: (k: string) => string) { i18nText = f; }
