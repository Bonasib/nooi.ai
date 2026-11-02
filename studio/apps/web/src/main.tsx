import "@nooi/ui/src/tokens.css";
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
import { assetFromJob } from "./media/library";

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
installShortcuts();
createRoot(document.getElementById("root")!).render(<App />);
boot();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/studio/sw.js", { scope: "/studio/" }).catch(() => undefined);
window.addEventListener("beforeunload", (e) => { if (editor.dirty) { autosave(); e.preventDefault(); } });
// for tests and the agents (the same named commands the AI prompt edit will use)
(window as unknown as Record<string, unknown>).__studio = { editor, api };
