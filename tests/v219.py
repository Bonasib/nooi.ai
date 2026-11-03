# v219 — nooi Studio Editor (Phase 1): the new timeline editor at /studio, and the site's editor opening it.
#  · served: /studio → /studio/ (no-cache page, assets cached a year); POST /v1/jobs/quote prices a job before it runs
#  · the workspace: logo, name, autosave, undo/redo, zoom, ⌘K, the nine agents, format, Export; seven rail tools; library · preview ·
#    inspector · timeline; no page errors
#  · media: several files at once go to the library (thumbnails, lengths, waveforms; a .cube LUT); a tap puts videos one after another
#    on V1 and a sound on A1 at the playhead
#  · the preview draws real pixels (WebGL2); playing moves the clock
#  · timeline: a drag moves a clip and snaps to an edge; dragging an edge trims; S splits at the playhead; ripple delete closes the gap;
#    undo brings it all back; ⌘K runs "split"
#  · text (Arabic and English) with fonts; a transition on a cut; pointing at an effect shows it on the preview (grey for B&W) and
#    adds nothing until tapped; keyframes animate scale; speed 2× halves the clip; colour, LUT, detach audio, captions from lines and .srt
#  · export on the device: WebM (video + sound), GIF, WAV — checked with ffprobe
#  · autosave: a reload brings the project back; signed in, it is saved to the account (/v1/projects, kind studio)
#  · Arabic mirrors the interface but the timeline still runs left to right; the light theme; a phone gets the bottom rail and sheets
#  · the site: opening the editor goes to /studio/ (with ?job= when a nooi result is being opened); the old editor's edit is brought over
# Run: python3 tests/v219.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8697; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v219-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=3", "-f", "lavfi", "-i", "sine=frequency=330:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-c:a", "libopus", "-shortest", D + "/media/a.webm")
FF("-f", "lavfi", "-i", "color=c=0xdd3322:s=640x360:d=2:r=30", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "200k", D + "/b.webm")
FF("-f", "lavfi", "-i", "sine=frequency=520:duration=2", D + "/v.wav")
import shutil; shutil.copy(D + "/media/a.webm", D + "/a.webm")
open(D + "/warm.cube", "w").write("LUT_3D_SIZE 2\n" + "\n".join(f"{min(1, r * 1.0 + .2)} {g} {b * .8}" for b in (0, 1) for g in (0, 1) for r in (0, 1)) + "\n")
open(D + "/subs.srt", "w").write("1\n00:00:00,500 --> 00:00:01,500\nمرحبا\n\n2\n00:00:01,600 --> 00:00:02,400\nHello\n")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "jobs": {"jb219": {"id": "jb219", "owner": "local", "kind": "video", "status": "done", "url": "/media/a.webm", "title": "Beach", "created": 1, "cost": 0, "payload": {"prompt": "Beach", "model": "seedance", "dur": 3}}}}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
P = "window.__studio.editor.project"
TR = "(n)=>" + P + ".tracks.find(t=>t.name===n).clips.map(c=>[+c.start.toFixed(1),+c.dur.toFixed(1)])"
PIX = "(xy)=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),d=new Uint8Array(4);g.readPixels(Math.round(c.width*xy[0]),Math.round(c.height*(1-xy[1])),1,1,g.RGBA,g.UNSIGNED_BYTE,d);return Array.from(d.slice(0,3))}"
def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", path], capture_output=True, text=True, timeout=60)
    try: return json.loads(r.stdout)
    except Exception: return {}

async def http(path, method="GET", body=None):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json"})
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k): return None
    try:
        r = urllib.request.build_opener(NoRedirect).open(req, timeout=10); return r.status, dict(r.headers), r.read().decode("utf8", "replace")
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read().decode("utf8", "replace")

async def desktop(p):
    tag = "en 1440"
    st, h, _ = await http("/studio"); chk("/studio sends to /studio/", st == 301 and h.get("Location", "").startswith("/studio/"), [st, h.get("Location")])
    st, h, body = await http("/studio/"); chk("/studio/ is the app, not cached", st == 200 and "nooi Studio Editor" in body and "no-cache" in h.get("Cache-Control", ""), [st, h.get("Cache-Control")])
    js = [x for x in os.listdir(ROOT + "/public/studio/assets") if x.startswith("index-") and x.endswith(".js")][0]
    st, h, _ = await http("/studio/assets/" + js); chk("the app's files are cached a year", st == 200 and "immutable" in h.get("Cache-Control", ""), h.get("Cache-Control"))
    st, _, body = await http("/v1/jobs/quote", "POST", {"kind": "video", "model": "seedance", "dur": 5}); q = json.loads(body or "{}")
    chk("a job is priced before it runs (the price; the team's own account pays nothing, like the job itself)", st == 200 and isinstance(q.get("price"), int) and q["price"] > 0 and q.get("cost") == 0 and q.get("credits") == 500, q)
    st, _, body = await http("/v1/jobs/quote", "POST", {"kind": "video", "meta": {"merge135": {"items": []}}}); chk("merging is free", json.loads(body or "{}").get("cost") == 0, body[:200])

    b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(1200)
    r = await E("""()=>({rail:[...document.querySelectorAll('.rail button')].map(b=>b.dataset.testid),logo:!!document.querySelector('.topbar .logo svg'),name:!!document.querySelector('.pname'),undo:!!document.querySelector('[data-testid=undo]'),
      k:!!document.querySelector('.kbtn'),crew:document.querySelectorAll('.crew i').length,fmt:!!document.querySelector('.fmt select'),exp:!!document.querySelector('[data-testid=export]'),
      areas:['.panel','.player','.inspector','.timeline'].map(s=>!!document.querySelector(s)),over:document.documentElement.scrollWidth-innerWidth,dir:document.documentElement.dir})""")
    chk(f"{tag}: the workspace — top bar, seven rail tools, library · preview · inspector · timeline", r["rail"] == ["rail-media", "rail-audio", "rail-text", "rail-captions", "rail-effects", "rail-color", "rail-ai"] and r["logo"] and r["name"] and r["undo"] and r["k"] and r["crew"] == 4 and r["fmt"] and r["exp"] and all(r["areas"]) and r["over"] <= 1, r)
    # ---- media
    await pg.set_input_files('[data-testid="file-input"]', [D + "/a.webm", D + "/b.webm", D + "/v.wav", D + "/warm.cube"])
    await pg.wait_for_function(P + "&&Object.keys(" + P + ".assets).length===4", timeout=30000); await pg.wait_for_timeout(500)
    r = await E("()=>Object.values(" + P + ".assets).map(a=>[a.name,a.kind,a.duration?+a.duration.toFixed(1):0,!!a.thumb,(a.waveform||[]).length>0])")
    am = {x[0]: x for x in r}
    chk(f"{tag}: several files at once → the library (picture, length, waveform, LUT); the timeline untouched", am.get("a", [0, 0, 0, 0, 0])[1:] == ["video", 3.0, True, True] and am.get("b", [0])[1] == "video" and am.get("v", [0, 0, 0])[1:3] == ["audio", 2.0] and am.get("warm", [0, 0])[1] == "lut" and await E("()=>" + P + ".tracks.every(t=>!t.clips.length)"), r)
    names = await E("()=>[...document.querySelectorAll('[data-testid=asset] .libn')].map(x=>x.textContent)")
    for nm in ("a", "b", "v"): await pg.click('[data-testid="asset"] >> nth=%d' % names.index(nm), position={"x": 30, "y": 25}); await pg.wait_for_timeout(300)
    v1, a1 = await E(TR, "V1"), await E(TR, "A1")
    chk(f"{tag}: a tap puts the videos one after another on V1 and the sound on A1 at the playhead", v1 == [[0, 3], [3, 2]] and a1 == [[0, 2]], [v1, a1])
    # ---- preview + play
    await E("()=>window.__studio.editor.select([])"); await pg.wait_for_timeout(600)
    px = await E(PIX, [0.5, 0.5]); t0 = await E("()=>document.querySelector('[data-testid=tc]').textContent")
    await pg.click('[data-testid="play"]'); await pg.wait_for_timeout(1200); await pg.click('[data-testid="play"]'); await pg.wait_for_timeout(300)
    t1 = await E("()=>document.querySelector('[data-testid=tc]').textContent")
    chk(f"{tag}: the preview draws the picture (not black) and playing moves the clock", sum(px) > 60 and t0 != t1, [px, t0, t1])
    # ---- timeline: drag (snap), trim, split, ripple delete, undo
    async def clip_box(name, idx=0):
        return await E("([n,i])=>{const t=" + P + ".tracks.find(x=>x.name===n);const c=t.clips[i];const el=document.querySelector('[data-clip=\"'+c.id+'\"]');const r=el.getBoundingClientRect();return [r.left,r.top,r.width,r.height,c.id]}", [name, idx])
    async def drag(x0, y0, x1, y1):
        await pg.mouse.move(x0, y0); await pg.mouse.down()
        for i in range(1, 11): await pg.mouse.move(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); await pg.wait_for_timeout(16)
        await pg.mouse.up(); await pg.wait_for_timeout(250)
    zoom = await E("()=>60")
    bx = await clip_box("V1", 1); await drag(bx[0] + 30, bx[1] + bx[3] / 2, bx[0] + 30 + 1.4 * zoom, bx[1] + bx[3] / 2)
    after = await E(TR, "V1"); chk(f"{tag}: dragging a clip moves it (the drop snaps to a nearby edge or keeps the gap)", after[1][0] > 3.5 and after[0] == [0, 3], after)
    await E("()=>{const e=window.__studio.editor;e.undo()}")
    ax = await clip_box("V1", 0); await drag(ax[0] + ax[2] - 3, ax[1] + ax[3] / 2, ax[0] + ax[2] - 3 - 1.0 * zoom, ax[1] + ax[3] / 2)
    tr = await E(TR, "V1"); chk(f"{tag}: dragging the right edge trims (a gap is left; with Ripple it would close)", abs(tr[0][1] - 2.0) < 0.15 and tr[1][0] == 3, tr)
    await E("()=>{window.__studio.editor.undo()}")
    await E("()=>{const e=window.__studio.editor;window.__studio.editor.select([]);}"); await pg.click('[data-testid="ruler"]', position={"x": 90, "y": 10}); await pg.wait_for_timeout(200)
    await pg.keyboard.press("s"); sp = await E(TR, "V1")
    await E("()=>{const e=window.__studio.editor;const t=" + P + ".tracks.find(x=>x.name==='V1');e.select([t.clips[1].id])}"); await pg.click('[data-testid="ripple-delete"]'); rp = await E(TR, "V1")
    await pg.click('[data-testid="undo"]'); await pg.click('[data-testid="undo"]'); un = await E(TR, "V1")
    chk(f"{tag}: S splits at the playhead, ripple delete closes the gap, undo brings both back", len(sp) == 3 and abs(sp[0][1] - 1.5) < 0.1 and len(rp) == 2 and abs(rp[1][0] - sp[1][0]) < 0.01 and un == [[0, 3], [3, 2]], [sp, rp, un])
    await pg.keyboard.press("Control+k"); await pg.fill('[data-testid="palette-q"]', "split"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
    pk = await E(TR, "V1"); chk(f"{tag}: ⌘K finds and runs Split", len(pk) == 3, pk)
    await pg.click('[data-testid="undo"]'); await pg.wait_for_timeout(100)
    # ---- text with fonts (Arabic)
    await pg.click('[data-testid="rail-text"]'); await pg.click('[data-testid="add-text"]'); await pg.wait_for_timeout(200)
    await pg.fill('[data-testid="text-words"]', "مرحبا بالعالم"); await pg.locator('[data-testid="text-words"]').blur(); await pg.wait_for_timeout(200)
    await pg.click('.fontpick .ns-tile >> nth=1'); await pg.wait_for_timeout(200)
    r = await E("()=>{const c=" + P + ".tracks.flatMap(t=>t.clips).find(c=>c.type==='text');return{text:c.text,font:c.style.font,track:" + P + ".tracks.find(t=>t.clips.includes(c)).kind}}")
    chk(f"{tag}: a text (Arabic) on the text track, with a font picked from samples of its own words", r["text"] == "مرحبا بالعالم" and r["font"] == "Tajawal" and r["track"] == "text", r)
    # ---- transition, effect preview, keyframes, speed, colour, LUT, detach
    await E("()=>{const e=window.__studio.editor;e.select([" + P + ".tracks.find(t=>t.name==='V1').clips[0].id])}")
    await pg.click('[data-testid="rail-effects"]'); await pg.click('.panel .subtabs button:has-text("Transitions")'); await pg.click('[data-testid="tr-wipeL"]'); await pg.wait_for_timeout(200)
    chk(f"{tag}: a transition sits on the cut", await E("()=>" + P + ".transitions.map(x=>x.type)") == ["wipeL"])
    await pg.click('.subtabs button >> nth=0'); await E("()=>{window.__studio.editor.select([]);}")
    await E("()=>{}"); await pg.click('[data-testid="ruler"]', position={"x": 60, "y": 10}); await pg.wait_for_timeout(400)
    before = await E(PIX, [0.3, 0.6]); await pg.hover('[data-testid="fx-mono"]'); await pg.wait_for_timeout(500); grey = await E(PIX, [0.3, 0.6])
    tag_shown = await E("()=>!!document.querySelector('.pvtag')"); nfx = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).filter(c=>c.type==='media').reduce((s,c)=>s+c.effects.length,0)")
    await pg.mouse.move(700, 880); await pg.wait_for_timeout(400); back = await E(PIX, [0.3, 0.6])
    chk(f"{tag}: pointing at Black & white shows it on the preview (grey), adds nothing, and leaving brings the colour back", max(grey) - min(grey) < 12 and max(before) - min(before) > 30 and tag_shown and nfx == 0 and back == before, [before, grey, back, tag_shown, nfx])
    await E("()=>{const e=window.__studio.editor;e.select([" + P + ".tracks.find(t=>t.name==='V1').clips[0].id])}"); await pg.click('[data-testid="fx-mono"]'); await pg.wait_for_timeout(200)
    chk(f"{tag}: a tap adds the effect to the selected clip", await E("()=>" + P + ".tracks.find(t=>t.name==='V1').clips[0].effects.map(e=>e.type)") == ["mono"])
    r = await E("""()=>{const S=window.__studio,e=S.editor,c=e.project.tracks.find(t=>t.name==='V1').clips[0];
      e.run('kf',p=>{const x=p.tracks.find(t=>t.name==='V1').clips[0];x.keyframes={scale:[{t:0,v:1,ease:'linear'},{t:2,v:2}]};});return 1}""")
    r = await E("()=>{const c=" + P + ".tracks.find(t=>t.name==='V1').clips[0];return [c.keyframes.scale.length]}")
    await pg.click('[data-testid="rail-media"]'); await pg.click('[data-testid="insp-speed"]'); await pg.click('text=2× >> nth=0'); sp2 = await E(TR, "V1")
    chk(f"{tag}: keyframes are kept on the clip; speed 2× halves the clip and pulls the next one", r == [2] and sp2[0] == [0, 1.5] and abs(sp2[1][0] - 1.5) < 0.06, [r, sp2])
    await pg.click('[data-testid="insp-color"]'); sl = pg.locator('[data-testid="color-exposure"] input'); await sl.focus()
    for _ in range(10): await pg.keyboard.press("ArrowRight")
    await pg.keyboard.press("Tab")
    ex = await E("()=>" + P + ".tracks.find(t=>t.name==='V1').clips[0].color.exposure")
    await pg.click('[data-testid="rail-color"]'); await pg.click('.panel .ns-btn.wide:has-text("warm")'); lut = await E("()=>{const c=" + P + ".tracks.find(t=>t.name==='V1').clips[0];return c.lut&&" + P + ".assets[c.lut.asset].name}")
    await pg.click('[data-testid="insp-audio"]'); await pg.click('[data-testid="detach"]'); await pg.wait_for_timeout(200)
    det = await E("()=>({muted:" + P + ".tracks.find(t=>t.name==='V1').clips[0].muted,audio:" + P + ".tracks.filter(t=>t.kind==='audio').flatMap(t=>t.clips).filter(c=>c.link).length})")
    chk(f"{tag}: exposure, a .cube LUT, and detach audio (the sound on its own track, the video muted)", ex > 0 and lut == "warm" and det == {"muted": True, "audio": 1}, [ex, lut, det])
    # ---- captions
    await pg.click('[data-testid="rail-captions"]'); await pg.fill('.panel textarea', "One\nTwo"); await pg.click('[data-testid="cap-add"]')
    await pg.set_input_files('[data-testid="srt-input"]', D + "/subs.srt"); await pg.wait_for_timeout(300)
    caps = await E("()=>" + P + ".tracks.filter(t=>t.kind==='text').flatMap(t=>t.clips).map(c=>c.text)")
    chk(f"{tag}: captions from lines and from an .srt (Arabic too)", "One" in caps and "Two" in caps and "مرحبا" in caps and "Hello" in caps, caps)
    # ---- export on the device
    await E("()=>{const e=window.__studio.editor;e.run('short',p=>{for(const t of p.tracks)t.clips=t.clips.filter(c=>c.start<2);for(const t of p.tracks)for(const c of t.clips)if(c.start+c.dur>2)c.dur=2-c.start;p.transitions=[];})}")
    for fmt in ("WEBM", "GIF", "WAV"):
        await pg.click('[data-testid="export"]'); await pg.click(f'.sheet .ns-seg button:has-text("{fmt}")')
        if fmt == "WEBM": await pg.click('.sheet .ns-seg button:has-text("720p")')
        await pg.click('[data-testid="export-go"]')
        try:
            await pg.wait_for_selector('[data-testid="download"]', timeout=240000)
            async with pg.expect_download() as dl: await pg.click('[data-testid="download"]')
            d = await dl.value; path = D + "/out." + fmt.lower(); await d.save_as(path); pr = probe(path)
            types = sorted(s.get("codec_type") for s in pr.get("streams", [])); dur = float(pr.get("format", {}).get("duration", 0) or 0)
            out["export_" + fmt] = {"types": types, "dur": dur, "bytes": os.path.getsize(path)}
            want = {"WEBM": ["audio", "video"], "GIF": ["video"], "WAV": ["audio"]}[fmt]
            chk(f"{tag}: export {fmt} on the device is a real file", types == want and 1.5 < dur < 2.6, out["export_" + fmt])
        except Exception as e: chk(f"{tag}: export {fmt} on the device is a real file", False, [str(e)[:200], await E("()=>(document.querySelector('.err')||{}).textContent")])
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
    # ---- autosave + the account
    n_before = await E("()=>" + P + ".tracks.reduce((s,t)=>s+t.clips.length,0)"); await pg.wait_for_timeout(5000)
    st, _, body = await http("/v1/projects"); pl = json.loads(body or "{}").get("projects", [])
    chk(f"{tag}: the project is saved to the account (kind studio)", any(x.get("kind") == "studio" and x["id"].startswith("st") for x in pl), pl[:3])
    await pg.reload(); await pg.wait_for_function("window.__studio&&" + P + ".tracks.some(t=>t.clips.length)", timeout=20000)
    n_after = await E("()=>" + P + ".tracks.reduce((s,t)=>s+t.clips.length,0)")
    chk(f"{tag}: a reload brings the project back (this device)", n_after == n_before and n_after > 0, [n_before, n_after])
    # ---- Arabic, light theme
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300)
    r = await E("()=>({dir:document.documentElement.dir,tl:getComputedStyle(document.querySelector('.timeline')).direction,grid:document.querySelector('.tlgrid').dir,media:document.querySelector('[data-testid=rail-media] span').textContent,over:document.documentElement.scrollWidth-innerWidth})")
    chk(f"{tag}: Arabic mirrors the interface, the timeline still runs left to right", r["dir"] == "rtl" and r["tl"] == "ltr" and r["grid"] == "ltr" and r["media"] == "الوسائط" and r["over"] <= 1, r)
    await pg.click('.tright .ns-btn.icon >> nth=0'); th = await E("()=>document.documentElement.dataset.theme"); chk(f"{tag}: the light theme", th == "light", th)
    await pg.screenshot(path=os.environ.get("SHOT219", D + "/ar.png"))
    chk(f"{tag}: no page errors", not errs, errs); await b.close()

async def phone(p):
    tag = "ar 390"; b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.add_init_script("localStorage.setItem('nooi-studio-ui', JSON.stringify({lang:'ar',theme:'dark'}))")
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(800)
    r = await E("()=>({phone:document.querySelector('.app').classList.contains('phone'),rail:!!document.querySelector('.mrail'),over:document.documentElement.scrollWidth-innerWidth,dir:document.documentElement.dir})")
    chk(f"{tag}: a phone gets the bottom rail, Arabic, nothing sideways", r["phone"] and r["rail"] and r["over"] <= 1 and r["dir"] == "rtl", r)
    await pg.tap('[data-testid="rail-media"]'); await pg.wait_for_timeout(300)
    await pg.set_input_files('[data-testid="file-input"]', [D + "/b.webm"]); await pg.wait_for_function(P + "&&Object.keys(" + P + ".assets).length===1", timeout=20000); await pg.wait_for_timeout(300)
    await pg.tap('[data-testid="asset"] .libp'); await pg.wait_for_timeout(300)
    chk(f"{tag}: the library in a sheet; a tap adds the clip", await E(TR, "V1") == [[0, 2]], await E(TR, "V1"))
    chk(f"{tag}: no page errors", not errs, errs); await b.close()

async def site(p):
    tag = "site"; b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1280, "height": 860}); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    logs = []; pg.on("console", lambda m: logs.append(m.type + ": " + m.text[:200])); out["site_logs"] = logs
    await pg.add_init_script("window.__studio219=true")
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await E("()=>{S.langAsked=true;S.user={name:'T',method:'google'};AU.showAuth=false;document.getElementById('modalRoot').innerHTML='';S.jobs.push({id:'loc1',remote:'jb219',kind:'video',status:'complete',resultUrl:'/media/a.webm',title:'Beach',dur:3,created:Date.now(),aspect:'16:9'});persist()}")
    await E("async()=>{await edUseJob(S.jobs.find(j=>j.id==='loc1'),{stay:true,quiet:true});go('edit')}")
    await pg.wait_for_url("**/studio/**", timeout=15000); await pg.wait_for_function("window.__studio&&" + P + ".tracks.some(t=>t.clips.length)", timeout=20000)
    r = await E("()=>({url:location.pathname+location.search,assets:Object.values(" + P + ".assets).map(a=>[a.src,a.job])})")
    chk(f"{tag}: 'Edit this video' on the site opens the studio with that video on the timeline", r["url"] == "/studio/" and ["/media/a.webm", "jb219"] in r["assets"], r)
    # the old editor's edit comes across once
    await pg.goto(B + "/")
    await E("()=>{localStorage.removeItem('nooi-studio-last');localStorage.removeItem('nooi-studio-legacy');localStorage.setItem('dotai-studio-v2',JSON.stringify({ed:{clips:[{id:'c1',src:{k:'job',job:'loc1'},in:0.5,out:2.5,speed:1}],texts:[{id:'t1',text:'Old title',start:0,end:2,pos:'bottom'}],format:'9:16 Reels'},jobs:[{id:'loc1',remote:'jb219',kind:'video',status:'complete',resultUrl:'/media/a.webm',dur:3}]}))}")
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&" + P + ".tracks.some(t=>t.clips.length)", timeout=20000)
    r = await E("()=>({w:" + P + ".width,h:" + P + ".height,clips:" + P + ".tracks.flatMap(t=>t.clips).map(c=>c.type==='text'?c.text:+c.in.toFixed(1)+'-'+(+c.dur.toFixed(1)))})")
    chk(f"{tag}: the previous editor's edit is brought over (vertical, the clip's in/out, the title)", r["w"] == 1080 and r["h"] == 1920 and "0.5-2" in r["clips"] and "Old title" in r["clips"], r)
    chk(f"{tag}: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        for f in (desktop, phone, site):
            try: await f(p)
            except Exception as e: fails.append(f"{f.__name__} crashed: " + repr(e)[:500])
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:5000])
print("v219 OK" if not fails else "v219 FAIL")
sys.exit(1 if fails else 0)
