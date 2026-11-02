import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TopBar } from "./ui/TopBar";
import { Panel, RailBar } from "./ui/Panels";
import { Preview } from "./ui/Preview";
import { Inspector } from "./ui/Inspector";
import { Timeline } from "./ui/Timeline";
import { ExportDialog, Palette, Projects, Toasts } from "./ui/Dialogs";
import { ui, useUI, editor } from "./state";
import { Btn } from "@nooi/ui";

const phoneQ = "(max-width: 767px)";
export function App() {
  const { t } = useTranslation(); const exp = useUI((s) => s.exportOpen); const pal = useUI((s) => s.paletteOpen); const prj = useUI((s) => s.projectsOpen); const open = useUI((s) => s.panelOpen);
  const [phone, setPhone] = useState(() => matchMedia(phoneQ).matches);
  const [insp, setInsp] = useState(false);
  useEffect(() => { const m = matchMedia(phoneQ); const f = () => setPhone(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  useEffect(() => editor.subscribe(() => { if (phone && editor.selection.length && !insp) setInsp(true); if (!editor.selection.length) setInsp(false); }), [phone, insp]);
  return (
    <div className={"app" + (phone ? " phone" : "")} data-testid="studio">
      <TopBar />
      {phone ? (<>
        <main className="mmain"><Preview /><Timeline /></main>
        {(open || insp) && <div className="msheet" role="dialog" aria-label={t("app.sheet")}>
          <div className="mgrab"><Btn icon="close" ghost label={t("insp.close")} onClick={() => { ui.set({ panelOpen: false }); setInsp(false); }} /></div>
          {insp && editor.selection.length ? <Inspector /> : <Panel />}
        </div>}
        <RailBar mobile />
      </>) : (
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
