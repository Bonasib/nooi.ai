import "@nooi/ui/src/tokens.css";
import { NATIVE } from "./site";
import "./app.css";
import "./i18n";
import { createRoot } from "react-dom/client";
import { emptyProject, migrate, mediaClip, addClip } from "@nooi/editor-core";
import i18n from "./i18n";
import { App } from "./App";
import { api } from "./api";
import { editor, openProject, toast, autosave } from "./state";
import { getJSON } from "./media/idb";
import { installShortcuts } from "./shortcuts";
import { hasLegacy, importLegacy } from "./legacy";
import { assetFromJob, visualsFor } from "./media/library";

async function boot() {
  const q = new URLSearchParams(location.search);
  // 1) a project named in the address, 2) the last one on this device, 3) the old editor's edit (once), 4) a new one
  let opened = false;
  const pid = q.get("project");
  if (pid) { const p = await getJSON("proj_" + pid); if (p) { await openProject(p); opened = true; } }
  if (!opened) { const last = localStorage.getItem("nooi-studio-last"); const p = last ? await getJSON("proj_" + last) : null; if (p && !q.has("new")) { await openProject(p); opened = true; } }
  if (!opened && hasLegacy() && !localStorage.getItem("nooi-studio-legacy")) {
    const p = await importLegacy(i18n.t("proj.fromEditor")); localStorage.setItem("nooi-studio-legacy", "1");
    if (p) { await openProject(p); opened = true; autosave(); toast(i18n.t("proj.broughtOver"), "ok"); }
  }
  if (!opened) await openProject(emptyProject({ name: i18n.t("proj.untitled") }));
  await api.init();
  // ?job=<id>: a nooi.ai result opened in the studio (from the site's "Edit in the studio")
  const job = q.get("job");
  if (job && api.online) { try { const j = await api.job(job); const a = assetFromJob({ ...j, resultUrl: (j as unknown as { url?: string }).url || j.resultUrl }); if (a) { editor.run("open job", (d) => { d.assets[a.id] = a; addClip(d, mediaClip(a, 0)); }); autosave(); } } catch { toast(i18n.t("proj.jobMissing"), "warn"); } }
  if (q.has("job") || q.has("project") || q.has("new")) history.replaceState(null, "", location.pathname);
  void migrate;
}
// pictures, length, filmstrip and waveform for assets that lack them (nooi results, older projects) — one at a time, once each;
// kept in the project without an undo step
const tried = new Set<string>(); let filling = false;
async function fillVisuals() {
  if (filling) return; filling = true;
  try {
    for (;;) {
      const a = Object.values(editor.project.assets).find((x) => (x.kind === "video" && !x.strip) || ((x.kind === "video" || x.kind === "audio") && !x.waveform && x.hasAudio !== false) ? !tried.has(x.id) : false);
      if (!a) break; tried.add(a.id);
      const add = await visualsFor(a).catch(() => null);
      if (add && editor.project.assets[a.id]) { editor.run("pictures", (d) => { if (d.assets[a.id]) Object.assign(d.assets[a.id], add); }); editor.past.pop(); autosave(); }
    }
  } finally { filling = false; }
}
editor.subscribe(() => { if (Object.values(editor.project.assets).some((x) => !tried.has(x.id) && (x.kind === "video" || x.kind === "audio"))) setTimeout(() => void fillVisuals(), 300); });
installShortcuts();
createRoot(document.getElementById("root")!).render(<App />);
boot();
if ("serviceWorker" in navigator && location.protocol === "https:" && !NATIVE && location.pathname.startsWith("/studio/")) navigator.serviceWorker.register("/studio/sw.js", { scope: "/studio/" }).catch(() => undefined);
window.addEventListener("beforeunload", (e) => { if (editor.dirty) { autosave(); e.preventDefault(); } });
// for tests and the agents (the same named commands the AI prompt edit will use)
(window as unknown as Record<string, unknown>).__studio = { editor, api };
