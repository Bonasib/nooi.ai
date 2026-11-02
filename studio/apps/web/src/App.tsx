import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TopBar } from "./ui/TopBar";
import { Panel, RailBar } from "./ui/Panels";
import { Preview } from "./ui/Preview";
import { Inspector } from "./ui/Inspector";
import { Timeline } from "./ui/Timeline";
import { ExportDialog, Palette, Projects, Toasts } from "./ui/Dialogs";
import { ui, useUI, editor, pickedNow } from "./state";
import { Btn } from "@nooi/ui";

// One editor, three arrangements of the same parts:
//  · full (computers and tablets): rail · library · preview · inspector over the timeline — on a tablet held upright the same
//    four panels are stacked: the preview across the top, library and clip settings side by side, the timeline below
//  · compact (phones held sideways, screens under 600 px high): rail · a full-width preview over the timeline; the library and the
//    clip settings slide in over the preview as drawers
//  · phone (held upright): preview / timeline / the tool bar at the foot; a tool or the clip settings take the middle, between
//    a smaller preview and the timeline, so the timeline always stays in view
const phoneQ = "(max-width: 767px) and (min-height: 501px)";
const compactQ = "(max-height: 600px)";   // only short screens (phones held sideways); tablets get the full computer layout
type Mode = "full" | "compact" | "phone";
const modeNow = (): Mode => (matchMedia(phoneQ).matches ? "phone" : matchMedia(compactQ).matches ? "compact" : "full");

export function App() {
  const { t } = useTranslation(); const exp = useUI((s) => s.exportOpen); const pal = useUI((s) => s.paletteOpen); const prj = useUI((s) => s.projectsOpen); const open = useUI((s) => s.panelOpen);
  const [mode, setMode] = useState<Mode>(modeNow);
  const [insp, setInsp] = useState(false);
  useEffect(() => {
    const ms = [matchMedia(phoneQ), matchMedia(compactQ)]; const f = () => setMode(modeNow());
    ms.forEach((m) => m.addEventListener("change", f)); return () => ms.forEach((m) => m.removeEventListener("change", f));
  }, []);
  // a newly picked clip opens its settings; nothing picked closes them (on a computer they are always there)
  useEffect(() => { let last = editor.selection.join(); return editor.subscribe(() => { const now = editor.selection.join(); if (now !== last) { last = now; if (!now) setInsp(false); else if (pickedNow() || !ui.get().panelOpen) { setInsp(true); if (pickedNow()) ui.set({ panelOpen: false }); } } }); }, []);
  const closeAll = () => { ui.set({ panelOpen: false }); setInsp(false); };
  const sheet = open || (insp && editor.selection.length > 0);
  return (
    <div className={"app " + mode + (mode === "phone" && sheet ? " sheeted" : "")} data-testid="studio">
      <TopBar />
      {mode === "phone" ? (<>
        <main className="mmain">
          <Preview />
          {sheet && <div className={"msheet" + (insp && editor.selection.length ? " insp" : "")} role="dialog" aria-label={t("app.sheet")}>
            <div className="mgrab"><Btn icon="close" ghost label={t("insp.close")} onClick={closeAll} testid="sheet-close" /></div>
            {insp && editor.selection.length ? <Inspector /> : <Panel />}
          </div>}
          <Timeline />
        </main>
        <RailBar mobile />
      </>) : mode === "compact" ? (
        <main className="workspace compact">
          <RailBar toggle />
          <Preview />
          <Timeline />
          {open && <div className="drawer start" role="dialog" aria-label={t("app.sheet")}><div className="mgrab"><Btn icon="close" ghost label={t("insp.close")} onClick={() => ui.set({ panelOpen: false })} testid="drawer-close" /></div><Panel /></div>}
          {insp && editor.selection.length > 0 && <div className="drawer end" role="dialog" aria-label={t("insp.label")}><div className="mgrab"><Btn icon="close" ghost label={t("insp.close")} onClick={() => setInsp(false)} testid="insp-close" /></div><Inspector /></div>}
        </main>
      ) : (
        <main className="workspace">
          <RailBar />
          <Panel />
          <Preview />
          <Inspector />
          <Timeline />
        </main>
      )}
      {exp && <ExportDialog />}{pal && <Palette />}{prj && <Projects />}
      <Toasts />
    </div>
  );
}
