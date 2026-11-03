// Keyboard (computer): J K L, Space, S split, Delete / Shift+Delete, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Ctrl+C/V/D, M marker,
// ← → a frame, Shift+← → a second, Home / End, + / − zoom, V B N Y U tools, Ctrl+K commands, Ctrl+E export, Ctrl+S save, Ctrl+Shift+S a .nooi file.
import { duration } from "@nooi/editor-core";
import { editor, playerRef, saveCloud, toast, ui, autosave } from "./state";
import * as A from "./actions";
import i18n from "./i18n";
import { saveNooi } from "./ui/Shell";

let shuttle = 0;
export function installShortcuts() {
  window.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement; if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) && !(e.key === "Escape")) return;
    if (ui.get().exportOpen || ui.get().paletteOpen || ui.get().projectsOpen || ui.get().settingsOpen || ui.get().reframeOpen) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ui.set({ paletteOpen: false }); } return; }
    const pl = playerRef.current, mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    const fps = editor.project.fps;
    const done = () => e.preventDefault();
    if (mod && k === "z") { done(); e.shiftKey ? A.redo() : A.undo(); return; }
    if (mod && k === "y") { done(); A.redo(); return; }
    if (mod && k === "k") { done(); ui.set({ paletteOpen: true }); return; }
    if (mod && k === "e") { done(); ui.set({ exportOpen: true }); return; }
    if (mod && e.shiftKey && k === "s") { done(); saveNooi(); return; }
    if (mod && k === "s") { done(); autosave(); saveCloud().then((ok) => toast(i18n.t(ok ? "save.saved" : "save.local"), ok ? "ok" : "info")); return; }
    if (mod && k === "c") { A.copy(); return; }
    if (mod && k === "v") { done(); A.paste(); return; }
    if (mod && k === "d") { done(); A.duplicate(); return; }
    if (mod && k === "a") { done(); editor.select(editor.project.tracks.flatMap((t) => t.clips.map((c) => c.id))); return; }
    if (mod) return;
    switch (e.key) {
      case " ": done(); pl?.toggle(); return;
      case "k": case "K": pl?.pause(); shuttle = 0; return;
      case "l": case "L": shuttle = Math.min(3, shuttle + 1); if (pl) { pl.play(); } return;
      case "j": case "J": pl?.pause(); pl?.seek(Math.max(0, (pl?.clock.t || 0) - 1)); return;
      case "s": case "S": done(); A.split(); return;
      case "Delete": case "Backspace": done(); A.del(e.shiftKey); return;
      case "m": case "M": A.marker(); return;
      case "t": case "T": A.addText("title"); return;
      case "ArrowLeft": done(); pl?.step(e.shiftKey ? -fps : -1); return;
      case "ArrowRight": done(); pl?.step(e.shiftKey ? fps : 1); return;
      case "ArrowUp": done(); A.nextMarker(-1); return;
      case "ArrowDown": done(); A.nextMarker(1); return;
      case "Home": pl?.seek(0); return;
      case "End": pl?.seek(duration(editor.project)); return;
      case "+": case "=": A.zoom(1.25); return;
      case "-": A.zoom(1 / 1.25); return;
      case "v": case "V": ui.set({ tool: "select" }); return;
      case "b": case "B": ui.set({ tool: "ripple" }); return;
      case "n": case "N": ui.set({ tool: "roll" }); return;
      case "y": case "Y": ui.set({ tool: "slip" }); return;
      case "u": case "U": ui.set({ tool: "slide" }); return;
      case "Escape": editor.select([]); ui.set({ preview: null }); return;
    }
  });
}
