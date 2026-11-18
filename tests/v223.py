# v223 — nooi Studio, Step 1 of the owner's master spec: the design system and the shell.
#  · the Obsidian look: cyan accent, AI gradient, red playhead, Inter / JetBrains Mono; a 40 px header
#  · header: File menu (project settings 520 × 440, save / open a .nooi file), workspaces (Classic, Vertical, Colorist, Audio),
#    Nooi Mate (a 340 px drawer: words → cards → apply), Cloud (saved state), Export
#  · the 8-category dock: Media · Stock & AI · Audio · Titles · Transitions · Effects · Stickers · Templates (split screen, montage)
#  · timeline toolbar: undo / redo + history list, split, delete, ripple, crop & reframe (Ken Burns), speed menu, color, AI Hub
#    (320 × 280), keyframe ◆, voice-over with 3-2-1, render status + the cache line, snap, zoom
#  · inspector: Video (basic · effects · animation) · Color · Audio · Speed
#  · Arabic mirrors (the drawer on the other side); a phone keeps it all in view; no page errors
# Run: python3 tests/v223.py
import asyncio, json, os, subprocess, sys, tempfile
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8724; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v223-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "500k", D + "/a.webm")
FF("-f", "lavfi", "-i", "smptebars=size=640x360:rate=30:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "500k", D + "/b.webm")
# talk · 1.5 s of quiet · talk — for "remove the pauses"
FF("-f", "lavfi", "-i", "sine=frequency=300:duration=1", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-f", "lavfi", "-i", "sine=frequency=500:duration=1",
   "-filter_complex", "[1]atrim=0:1.5[s];[0][s][2]concat=n=3:v=0:a=1", "-c:a", "libopus", D + "/talk.ogg")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
P = "window.__studio.editor.project"
CLIPS = "()=>" + P + ".tracks.flatMap(t=>t.clips.map(c=>({tr:t.name,kind:t.kind,id:c.id,start:+c.start.toFixed(2),dur:+c.dur.toFixed(2),sp:c.speed,sc:+(c.transform.scale).toFixed(3),x:+c.transform.x.toFixed(3),y:+c.transform.y.toFixed(3),kf:Object.keys(c.keyframes).filter(k=>c.keyframes[k]&&c.keyframes[k].length).sort()})))"
SEL = "(i)=>{const e=window.__studio.editor;const c=" + P + ".tracks.flatMap(t=>t.clips)[i];e.select([c.id]);return c.id}"

async def boot(pg):
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(800)

async def add_files(pg, files):
    await pg.click('[data-testid="rail-media"]'); n0 = await pg.evaluate("Object.keys(" + P + ".assets).length")
    await pg.set_input_files('[data-testid="file-input"]', files); await pg.wait_for_function(f"Object.keys({P}.assets).length>={n0 + len(files)}", timeout=20000); await pg.wait_for_timeout(500)

async def desktop(p):
    b = await p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
    ctx = await b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True); await ctx.grant_permissions(["microphone"])
    pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await boot(pg)
    # ---- the look and the header
    r = await E("""()=>{const cs=getComputedStyle(document.documentElement),tb=document.querySelector('.topbar').getBoundingClientRect();
      return{accent:cs.getPropertyValue('--accent').trim(),ai:cs.getPropertyValue('--ai').trim(),ph:cs.getPropertyValue('--playhead').trim(),font:cs.getPropertyValue('--f').trim().slice(0,7),mono:cs.getPropertyValue('--mono').trim().slice(0,16),
        h:Math.round(tb.height),exp:getComputedStyle(document.querySelector('[data-testid=export]')).backgroundColor,
        parts:['[data-testid=file-menu]','[data-testid=ws]','[data-testid=mate-open]','[data-testid=cloud]','[data-testid=export]','.topbar .logo svg'].map(s=>!!document.querySelector(s)),
        rail:[...document.querySelectorAll('.rail button')].map(b=>b.dataset.testid),over:document.documentElement.scrollWidth-innerWidth}}""")
    out["look"] = r
    chk("the Obsidian look: cyan accent, AI gradient, red playhead, Inter + JetBrains Mono", r["accent"].lower() == "#00f0ff" and "#7b61ff" in r["ai"].lower() and r["ph"].lower() == "#ff3b30" and r["font"] == '"Inter"' and r["mono"].startswith('"JetBrains Mono"'), r)
    chk("a 40 px header: logo, File, workspace, Nooi Mate, Cloud, Export (cyan)", r["h"] == 40 and all(r["parts"]) and r["exp"] == "rgb(0, 240, 255)" and r["over"] <= 1, r)
    chk("the dock: the 8 categories + Auto (v233)", r["rail"] == ["rail-media", "rail-stock", "rail-auto", "rail-audio", "rail-titles", "rail-transitions", "rail-effects", "rail-stickers", "rail-templates"], r["rail"])
    # ---- File menu → project settings (520 × 440)
    await pg.click('[data-testid="file-menu"]'); items = await E("()=>[...document.querySelectorAll('.pop [role=menuitem]')].length")
    await pg.click('[data-testid="file-settings"]'); await pg.wait_for_selector('[data-testid="settings"]')
    sz = await E("()=>{const r=document.querySelector('.sheet.settings').getBoundingClientRect();return[Math.round(r.width),Math.round(r.height)]}")
    await pg.fill('[data-testid="set-name"]', "Desert trip"); await pg.click('.sheet.settings .ns-seg button:has-text("4K")'); await pg.click('.sheet.settings .ns-seg button:has-text("30")')
    pr = await E("()=>({n:" + P + ".name,w:" + P + ".width,h:" + P + ".height,fps:" + P + ".fps})"); await pg.click('[data-testid="set-done"]')
    chk("File menu → Project settings (520 × 440): name, 4K, 30 fps", items >= 7 and sz[0] == 520 and sz[1] >= 440 and pr == {"n": "Desert trip", "w": 3840, "h": 2160, "fps": 30}, {"items": items, "sz": sz, "pr": pr})
    # ---- save a .nooi file, change the name, open the file again
    await pg.click('[data-testid="file-menu"]')
    async with pg.expect_download() as dl: await pg.click('[data-testid="file-save"]')
    d = await dl.value; path = D + "/" + d.suggested_filename; await d.save_as(path); doc = json.load(open(path))
    chk("Save as .nooi: one JSON file with the project (the v224 shape)", d.suggested_filename == "Desert trip.nooi" and doc.get("nooiVersion") == "1.0.0" and doc["metadata"]["title"] == "Desert trip", {"f": d.suggested_filename, "keys": list(doc)})
    await E("()=>window.__studio.editor.run('rn',p=>{p.name='Other'})")
    await pg.click('[data-testid="file-menu"]'); await pg.set_input_files('[data-testid="nooi-input"]', path); await pg.wait_for_function(P + ".name==='Desert trip'", timeout=8000)
    # back to 1080p for the rest
    await E("()=>window.__studio.editor.run('f',p=>{p.width=1920;p.height=1080})")
    # ---- media, inspector tabs, the toolbar
    await add_files(pg, [D + "/a.webm", D + "/b.webm"])
    await E("()=>{const s=window.__studio;Object.values(" + P + ".assets).forEach((a,i)=>s.actions.addAsset(a,i*3))}")
    await pg.wait_for_timeout(400); await E(SEL, 0); await pg.wait_for_timeout(300)
    tabs = await E("()=>[...document.querySelectorAll('.inspector .subtabs button')].map(b=>b.dataset.testid)")
    secs = await E("()=>['#isec-fx','#isec-motion'].map(s=>!!document.querySelector('.inspector '+s))")
    chk("inspector: Video (with Effects and Animation) · Color · Audio · Speed", tabs == ["insp-video", "insp-color", "insp-audio", "insp-speed"] and all(secs), {"tabs": tabs, "secs": secs})
    tb = await E("()=>['undo','redo','history','split','delete','ripple-delete','reframe-open','speed-menu','tb-color','hub','tb-keyframe','vo','render-status','snap'].filter(k=>!document.querySelector('.tlbar [data-testid='+k+']'))")
    chk("the timeline toolbar has every §4.3 tool", tb == [], tb)
    # speed menu
    await pg.click('[data-testid="speed-menu"]'); await pg.click('[data-testid="sp-2"]'); c = (await E(CLIPS))[0]
    chk("Speed menu → 2×", c["sp"] == 2, c); await pg.keyboard.press("Escape")
    # keyframe ◆ at the playhead: five properties in one step
    await E("()=>window.__studio.player.seek(0.5)"); n0 = await E("()=>window.__studio.editor.past.length"); await pg.click('[data-testid="tb-keyframe"]')
    c = (await E(CLIPS))[0]; n1 = await E("()=>window.__studio.editor.past.length")
    chk("Keyframe ◆: position, size, turn and opacity in one undo step", c["kf"] == ["opacity", "rotation", "scale", "x", "y"] and n1 == n0 + 1, {"c": c, "steps": [n0, n1]})
    # crop & reframe: a slow zoom over the clip
    await pg.click('[data-testid="reframe-open"]'); await pg.click('[data-testid="rf-in"]'); await pg.click('[data-testid="rf-apply"]')
    kf = await E("()=>{const c=" + P + ".tracks.flatMap(t=>t.clips)[0];return c.keyframes.scale.map(k=>[+k.t.toFixed(2),+k.v.toFixed(2)])}")
    chk("Crop & reframe → zoom in: two scale keyframes over the clip", len(kf) == 2 and kf[0][1] == 1 and kf[1][1] > 1.1, kf)
    # history list: two steps back at once
    hl = await E("()=>window.__studio.editor.past.length"); await pg.click('[data-testid="history"]'); rows = await E("()=>[...document.querySelectorAll('.hist [data-testid^=hist-]')].map(b=>b.textContent)")
    await pg.click('[data-testid="hist-1"]'); hl2 = await E("()=>window.__studio.editor.past.length"); c = (await E(CLIPS))[0]
    chk("History: the steps by name; a tap goes back that far", rows[:2] == ["Reframe", "Keyframe"] and hl2 == hl - 2 and c["kf"] == [], {"rows": rows[:4], "len": [hl, hl2], "c": c})
    # AI Hub (320 × 280)
    await pg.click('[data-testid="hub"]'); hub = await E("()=>{const r=document.querySelector('.pop.hub').getBoundingClientRect();return{w:Math.round(r.width),h:Math.round(r.height),n:document.querySelectorAll('.hubgrid button').length,badge:!!document.querySelector('.hubgrid .aibadge')}}")
    chk("AI Hub: a 320 × 280 grid of AI tools with the AI badge", hub == {"w": 320, "h": 280, "n": 10, "badge": True}, hub)
    await pg.click('[data-testid="hub-gen"]'); r = await E("()=>({rail:document.querySelector('.rail [aria-pressed=true]')?.dataset.testid,tab:document.querySelector('.panel .subtabs [aria-selected=true]')?.textContent})")
    chk("AI Hub → Make video or picture opens Stock & AI · Make with AI", r == {"rail": "rail-stock", "tab": "Make with AI"}, r)
    # render status + cache line (an effect makes the clip red)
    await E("()=>window.__studio.actions.applyEffect('rain')"); await pg.wait_for_timeout(200)
    rs = await E("()=>({k:document.querySelector('[data-testid=render-status]').className,red:document.querySelectorAll('.ruler .cache.r').length,green:document.querySelectorAll('.ruler .cache.g').length})")
    chk("render status and the cache line: red where the picture is heavy, green elsewhere", "amber" in rs["k"] and rs["red"] == 1 and rs["green"] == 1, rs)
    # ---- Templates: split screen with the two clips
    await E("()=>{const e=window.__studio.editor;e.select(" + P + ".tracks.flatMap(t=>t.clips).map(c=>c.id))}")
    await pg.click('[data-testid="rail-templates"]'); await pg.click('[data-testid="tpl-2h"]'); await pg.wait_for_timeout(300); cl = await E(CLIPS)
    vids = [c for c in cl if c["kind"] == "video"]
    chk("Templates → split screen: each clip in its own half, side by side", len(vids) == 2 and sorted(c["x"] for c in vids) == [-0.25, 0.25] and len({c["tr"] for c in vids}) == 2, cl)
    await E("()=>window.__studio.editor.run('clear',p=>{for(const t of p.tracks)t.clips=[];p.transitions=[]})")
    await pg.click('[data-testid="tpl-instant"]'); await pg.wait_for_timeout(300); cl = await E(CLIPS); tr = await E("()=>" + P + ".transitions.length")
    chk("Templates → instant montage: the library's items, 3 s each, with fades", len(cl) == 2 and all(c["dur"] == 3 for c in cl) and tr == 1, {"cl": cl, "tr": tr})
    # ---- workspaces
    await pg.click('[data-testid="ws"]'); await pg.click('[data-testid="ws-vertical"]'); v = await E("()=>[" + P + ".width," + P + ".height]")
    await pg.click('[data-testid="ws"]'); await pg.click('[data-testid="ws-audio"]'); await E(SEL, 0); await pg.wait_for_timeout(200)
    a = await E("()=>({app:document.querySelector('.app').className,tab:document.querySelector('.inspector .subtabs [aria-selected=true]')?.dataset.testid,tl:Math.round(document.querySelector('.timeline').getBoundingClientRect().height)})")
    await pg.click('[data-testid="ws"]'); await pg.click('[data-testid="ws-color"]'); await pg.wait_for_timeout(200)
    col = await E("()=>({tab:document.querySelector('.inspector .subtabs [aria-selected=true]')?.dataset.testid,w:Math.round(document.querySelector('.inspector').getBoundingClientRect().width)})")
    await pg.click('[data-testid="ws"]'); await pg.click('[data-testid="ws-classic"]')
    chk("workspaces: Vertical → 9:16; Audio → a taller timeline and the Audio tab; Colorist → a wider Color tab", v == [1080, 1920] and "ws-audio" in a["app"] and a["tab"] == "insp-audio" and a["tl"] >= 400 and col["tab"] == "insp-color" and col["w"] >= 320, {"v": v, "a": a, "col": col})
    await E("()=>window.__studio.actions.format('16:9')")
    # ---- Nooi Mate
    await pg.click('[data-testid="mate-open"]'); m = await E("()=>{const r=document.querySelector('[data-testid=mate]').getBoundingClientRect();return[Math.round(r.width),Math.round(r.right)===innerWidth]}")
    await pg.fill('[data-testid="mate-q"]', "make it vertical and add rain"); await pg.click('[data-testid="mate-go"]'); cards = await E("()=>[...document.querySelectorAll('.mcard span')].map(s=>s.textContent)")
    await pg.click('.mcard:has-text("9:16") button'); await pg.wait_for_timeout(200); v = await E("()=>[" + P + ".width," + P + ".height]")
    chk("Nooi Mate: a 340 px drawer; words → cards → apply", m == [340, True] and len(cards) == 2 and v == [1080, 1920], {"m": m, "cards": cards, "v": v})
    await pg.fill('[data-testid="mate-q"]', "blah"); await pg.click('[data-testid="mate-go"]'); none = await pg.locator('[data-testid="mate-none"]').count()
    chk("Nooi Mate says plainly when it doesn't understand", none == 1)
    # remove the pauses (read from the sound on this device)
    await E("()=>{window.__studio.actions.format('16:9');window.__studio.editor.run('clear',p=>{for(const t of p.tracks)t.clips=[];p.transitions=[]})}")
    await add_files(pg, [D + "/talk.ogg"]); await E("()=>{const a=Object.values(" + P + ".assets).find(a=>a.kind==='audio');window.__studio.actions.addAsset(a,0)}"); await pg.wait_for_timeout(300)
    await E(SEL, 0); d0 = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).reduce((s,c)=>s+c.dur,0)")
    await pg.fill('[data-testid="mate-q"]', "remove the pauses"); await pg.click('[data-testid="mate-go"]'); await pg.click('[data-testid="mate-apply-0"]')
    await pg.wait_for_function("document.querySelector('[data-testid=mate-card-0]').classList.contains('done')", timeout=15000)
    d1 = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).reduce((s,c)=>s+c.dur,0)")
    chk("Nooi Mate → remove the pauses: the 1.5 s of quiet goes", 2.9 < d0 < 3.6 and 1.8 < d1 < 2.4, [d0, d1])
    await pg.click('[data-testid="mate-close"]')
    # ---- voice-over: 3-2-1, then it records
    await pg.click('[data-testid="vo"]'); await pg.wait_for_selector('[data-testid="countdown"]', timeout=4000); cd = await E("()=>document.querySelector('[data-testid=countdown] b').textContent")
    await pg.wait_for_selector('[data-testid="rec-stop"]', timeout=6000); await pg.wait_for_timeout(1200); na = await E("()=>Object.keys(" + P + ".assets).length")
    await pg.click('[data-testid="rec-stop"]'); await pg.wait_for_function(f"Object.keys({P}.assets).length>{na}", timeout=15000)
    chk("Voice-over: a 3-2-1, then it records and lands on the timeline", cd == "3", cd)
    # ---- Cloud popover
    await pg.click('[data-testid="cloud"]'); cp = await E("()=>!!document.querySelector('.pop [data-testid=cloud-save]')"); await pg.keyboard.press("Escape")
    chk("Cloud: the saved state and Save now", cp)
    # ---- Arabic: mirrored, the drawer on the other side, labels in Arabic
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300); await pg.click('[data-testid="mate-open"]')
    ar = await E("()=>({dir:document.documentElement.dir,left:Math.round(document.querySelector('[data-testid=mate]').getBoundingClientRect().left),rail:document.querySelector('[data-testid=rail-templates] span').textContent,file:document.querySelector('[data-testid=file-menu] span').textContent})")
    chk("Arabic: mirrored, Nooi Mate opens on the left, Arabic labels", ar == {"dir": "rtl", "left": 0, "rail": "القوالب", "file": "ملف"}, ar)
    await pg.click('[data-testid="lang"]')
    await pg.screenshot(path=D + "/desk.png")
    chk("desktop: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await boot(pg)
    r = await E("""()=>{const off=[...document.querySelectorAll('.topbar button,.topbar a,.topbar select')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0).filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1||r.left<-1}).map(e=>e.dataset.testid||e.className);
      return{off,over:document.documentElement.scrollWidth-innerWidth,rail:document.querySelectorAll('.mrail button').length,exp:!!document.querySelector('[data-testid=export]')}}""")
    chk("phone: the header fits (nothing off the screen), the 8 dock tools + Auto at the foot (v233)", r["off"] == [] and r["over"] <= 1 and r["rail"] == 9 and r["exp"], r)
    await pg.click('[data-testid="file-menu"]'); fm = await E("()=>{const r=document.querySelector('.pop').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}")
    chk("phone: the File menu opens inside the screen", fm)
    await pg.keyboard.press("Escape"); await pg.click('[data-testid="mate-open"]'); mw = await E("()=>Math.round(document.querySelector('[data-testid=mate]').getBoundingClientRect().width)")
    chk("phone: Nooi Mate takes the whole width", mw == 390, mw)
    await pg.screenshot(path=D + "/phone.png")
    chk("phone: no page errors", not errs, errs); await b.close()

async def main():
    import urllib.request, time
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f in (desktop, phone):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:600])

try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps(out, ensure_ascii=False)[:600]); print("shots:", D)
if fails: print("v223 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v223 OK")
