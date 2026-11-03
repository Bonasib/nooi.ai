# v222 — nooi Studio: the classic editor's tools come over (batch 1) and the owner's phone findings are fixed.
#  · every video clip shows a filmstrip — also a nooi result opened in the studio (its pictures, length and waveform are made once)
#  · Effects: Effects · Weather & light (rain, snow, fog, light leak, sparkles, old film) · Erase & blur (a box) · Motion presets
#    · Transitions — rain changes the picture; a blur box changes only its part; a motion preset writes keyframes
#  · Reset position puts a moved clip back; on a touch screen a quick swipe over the picture does not move the clip (a short hold
#    does)
#  · Text → Stickers (own drawings → a picture over the video), Logo (a corner, the whole video), Audio → Sound effects (made here)
#  · the phone: a picked clip swaps the bottom bar for its tools (split, speed, …, delete); Edit opens its settings
#  · a WebM exported on the device with rain + a sticker is a real video; no page errors; Arabic labels
# Run: python3 tests/v222.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8723; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v222-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=3", "-f", "lavfi", "-i", "sine=frequency=330:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-c:a", "libopus", "-shortest", D + "/media/r.webm")
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", D + "/a.webm")
FF("-f", "lavfi", "-i", "color=c=0xff3355:s=200x200", "-frames:v", "1", D + "/logo.png")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "jobs": {"jb222": {"id": "jb222", "owner": "local", "kind": "video", "status": "done", "url": "/media/r.webm", "title": "Raiders", "created": 1, "cost": 0, "payload": {"prompt": "Raiders", "model": "seedance", "dur": 3}}}}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
P = "window.__studio.editor.project"
PIX = "(xy)=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),d=new Uint8Array(4);g.readPixels(Math.round(c.width*xy[0]),Math.round(c.height*(1-xy[1])),1,1,g.RGBA,g.UNSIGNED_BYTE,d);return Array.from(d.slice(0,3))}"
CLIPS = "()=>" + P + ".tracks.flatMap(t=>t.clips.map(c=>({tr:t.name,type:c.type,a:c.asset&&" + P + ".assets[c.asset]&&" + P + ".assets[c.asset].kind,start:+c.start.toFixed(2),dur:+c.dur.toFixed(2),sc:c.transform.scale,x:+c.transform.x.toFixed(3),y:+c.transform.y.toFixed(3),fx:(c.effects||[]).map(e=>e.type),kf:Object.keys(c.keyframes)})))"
diff = lambda a, b: sum(abs(x - y) for x, y in zip(a, b))
def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", path], capture_output=True, text=True, timeout=60)
    try: return json.loads(r.stdout)
    except Exception: return {}

async def desktop(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    # a nooi result opened in the studio: its pictures arrive by themselves
    await pg.goto(B + "/studio/?job=jb222"); await pg.wait_for_function(P + "&&" + P + ".tracks.some(t=>t.clips.length)", timeout=30000)
    ok = await pg.wait_for_function("()=>Object.values(" + P + ".assets).some(a=>a.strip&&a.waveform&&a.duration>2)", timeout=40000)
    st = await E("()=>{const c=document.querySelector('.clip.video');return {bg:getComputedStyle(c).backgroundImage.slice(0,30),w:c.getBoundingClientRect().width}}")
    chk("a nooi result gets its filmstrip, length and waveform, and the clip shows the filmstrip", st["bg"].startswith('url("data:image/jpeg'), st)
    # Reset position
    await E("()=>{const e=window.__studio.editor;const id=" + P + ".tracks.flatMap(t=>t.clips)[0].id;e.select([id]);e.run('m',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id){c.transform.x=0.3;c.transform.y=0.64}})}")
    await pg.wait_for_timeout(300); await pg.click('[data-testid="reset-transform"]'); await pg.wait_for_timeout(300)
    r = await E(CLIPS); chk("Reset position puts the clip back in the middle", r[0]["x"] == 0 and r[0]["y"] == 0, r[0])
    # effects groups
    await pg.click('[data-testid="rail-effects"]'); await pg.wait_for_timeout(200)
    tabs = await E("()=>[...document.querySelectorAll('.panel .subtabs button')].map(b=>b.textContent)")
    chk("Effects has Effects · Weather & light · Erase & blur · Motion · Transitions", tabs == ["Effects", "Weather & light", "Erase & blur", "Motion", "Transitions"], tabs)
    await pg.click('.panel .subtabs button:has-text("Weather & light")'); n_w = await E("()=>document.querySelectorAll('.panel [data-testid^=fx-]').length")
    await pg.evaluate("()=>window.__studio.editor.select([])"); await pg.click('[data-testid="play"]'); await pg.wait_for_timeout(300); await pg.click('[data-testid="play"]'); await pg.wait_for_timeout(500)
    px0 = [await E(PIX, [x / 10, y / 10]) for x in (2, 5, 8) for y in (2, 5, 8)]
    await E("()=>window.__studio.editor.select([" + P + ".tracks.flatMap(t=>t.clips)[0].id])")
    await pg.click('[data-testid="fx-rain"]'); await pg.wait_for_timeout(700)
    px1 = [await E(PIX, [x / 10, y / 10]) for x in (2, 5, 8) for y in (2, 5, 8)]
    chk("six weather & light effects; rain changes the picture", n_w == 6 and sum(diff(a, b) for a, b in zip(px0, px1)) > 60, [n_w, px0[:2], px1[:2]])
    await E("()=>window.__studio.editor.run('x',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.effects)c.effects=[]})"); await pg.wait_for_timeout(500)
    await pg.click('.panel .subtabs button:has-text("Erase & blur")'); await pg.click('[data-testid="fx-pixelBox"]'); await pg.wait_for_timeout(400)
    for k, v in (("x", 0.3), ("y", 0.3), ("w", 0.4), ("h", 0.4)):
        await E("([k,v])=>window.__studio.editor.run('b',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.effects&&c.effects[0])c.effects[0].params[k]=v})", [k, v])
    await pg.wait_for_timeout(600)
    inside = [await E(PIX, [0.33 + i * 0.065, 0.67 - j * 0.065]) for i in range(6) for j in range(6)]; outside = await E(PIX, [0.85, 0.2])
    sliders = await E("()=>['x','y','w','h'].every(k=>document.querySelector('[data-testid=box-'+k+']'))")
    await E("()=>window.__studio.editor.run('x',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.effects)c.effects=[]})"); await pg.wait_for_timeout(500)
    clean_in = [await E(PIX, [0.33 + i * 0.065, 0.67 - j * 0.065]) for i in range(6) for j in range(6)]; clean_out = await E(PIX, [0.85, 0.2])
    chk("Erase & blur: the box changes its part of the picture only, and has its place sliders", sliders and sum(diff(a, b) for a, b in zip(inside, clean_in)) > 100 and diff(outside, clean_out) < 12, [sliders, inside[:3], clean_in[:3], outside, clean_out])
    await pg.click('.panel .subtabs button:has-text("Motion")'); n_m = await E("()=>document.querySelectorAll('.panel [data-testid^=mo-]').length")
    await pg.click('[data-testid="mo-zoomIn"]'); await pg.wait_for_timeout(200)
    kf = await E("()=>" + P + ".tracks.flatMap(t=>t.clips)[0].keyframes.scale")
    chk("Motion presets: 13; Slow zoom in writes scale keyframes from 1 to 1.25", n_m == 13 and kf and len(kf) == 2 and kf[0]["v"] == 1 and abs(kf[1]["v"] - 1.25) < 1e-6, [n_m, kf])
    # stickers, logo, sound effects
    await pg.click('[data-testid="rail-text"]'); await pg.click('.panel .subtabs button:has-text("Stickers")'); n_s = await E("()=>document.querySelectorAll('.panel [data-testid^=stk-]').length")
    await E("()=>window.__studio.editor.select([])"); await pg.click('[data-testid="stk-star"]'); await pg.wait_for_timeout(1500)
    r = await E(CLIPS); s = [c for c in r if c["tr"] == "V2" and c["a"] == "image"]
    await pg.click('[data-testid="ruler"]', position={"x": 60 * 1.2, "y": 10}); await pg.wait_for_timeout(700)
    centre = await E(PIX, [0.5, 0.5])
    chk("Stickers: 30 own drawings; the star goes over the video on V2 (3 s, a third of the height), drawn on the preview", n_s == 30 and s and s[0]["dur"] == 3 and abs(s[0]["sc"] - 0.32) < 1e-6 and centre[0] > 200 and centre[1] > 170 and centre[2] < 90, [n_s, s, centre])
    await pg.click('.panel .subtabs button:has-text("Logo")'); await pg.click('[data-testid="corner-tr"]')
    await pg.set_input_files('[data-testid="logo-input"]', D + "/logo.png"); await pg.wait_for_timeout(1500)
    r = await E(CLIPS); lg = [c for c in r if c["tr"] != "V1" and c["start"] == 0 and c["a"] == "image" and abs(c["sc"] - 0.18) < 1e-6]
    await pg.wait_for_timeout(500); tr_px = await E(PIX, [0.94, 0.1])   # (PIX: x from the left, y from the top)
    chk("Logo: on the whole video in the top-right corner (red there on the preview)", lg and abs(lg[0]["sc"] - 0.18) < 1e-6 and lg[0]["x"] > 0.3 and lg[0]["y"] < -0.3 and tr_px[0] > 200 and tr_px[1] < 90, [lg, tr_px])
    await pg.click('[data-testid="rail-audio"]'); await pg.click('.panel .subtabs button:has-text("Sound effects")'); n_x = await E("()=>document.querySelectorAll('.panel [data-testid^=sfx-]').length")
    await pg.click('[data-testid="sfx-whoosh"]'); await pg.wait_for_function("()=>" + P + ".tracks.some(t=>t.name==='A2'&&t.clips.length)", timeout=15000)
    a = await E("()=>{const t=" + P + ".tracks.find(t=>t.name==='A2');const c=t.clips[0];const a=" + P + ".assets[c.asset];return {kind:a.kind,dur:+a.duration.toFixed(2),wave:(a.waveform||[]).length>0}}")
    chk("Sound effects: 16 made on the device; Whoosh goes onto A2 with its waveform", n_x == 16 and a["kind"] == "audio" and 0.8 < a["dur"] < 1.0 and a["wave"], [n_x, a])
    # export with rain + the sticker + the logo
    await E("()=>window.__studio.editor.run('r',p=>{const c=p.tracks.find(t=>t.name==='V1').clips[0];c.effects=[{id:'e1',type:'rain',enabled:true,params:{amount:0.6}}]})")
    await pg.click('[data-testid="export"]'); await pg.click('.sheet .ns-seg button:has-text("WEBM")'); await pg.click('.sheet .ns-seg button:has-text("720p")'); await pg.click('[data-testid="export-go"]')
    try:
        await pg.wait_for_selector('[data-testid="download"], .sheet .err', timeout=300000)
        async with pg.expect_download() as dl: await pg.click('[data-testid="download"]')
        d = await dl.value; path = D + "/out.webm"; await d.save_as(path); pr = probe(path)
        out["export"] = {"types": sorted(s.get("codec_type") for s in pr.get("streams", [])), "dur": pr.get("format", {}).get("duration")}
        chk("a WebM made on the device with rain, a sticker, a logo and a sound effect is a real video", out["export"]["types"] == ["audio", "video"] and 2.6 < float(out["export"]["dur"] or 0) < 3.4, out["export"])
    except Exception as e: chk("device export", False, [str(e)[:200], await E("()=>(document.querySelector('.sheet .err')||{}).textContent")])
    chk("desktop: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio", timeout=30000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/a.webm"); await pg.wait_for_function("Object.keys(" + P + ".assets).length===1", timeout=20000)
    await pg.locator('[data-testid="asset"] .libp').first.click(); await pg.wait_for_timeout(400)
    await pg.locator('[data-testid="sheet-close"]').click(); await pg.wait_for_timeout(300)
    await E("()=>window.__studio.editor.select([])"); await pg.locator('.clip').first.tap(); await pg.wait_for_timeout(500)
    bar = await E("()=>({bar:!!document.querySelector('[data-testid=clipbar]'),rail:!!document.querySelector('.mrail'),sheet:!!document.querySelector('.msheet'),labels:[...document.querySelectorAll('.clipbar .cbs button span')].map(s=>s.textContent).slice(0,4)})")
    chk("phone (Arabic): a picked clip swaps the bottom bar for its tools; the preview stays big (no sheet)", bar["bar"] and not bar["rail"] and not bar["sheet"] and bar["labels"][:2] == ["تحرير", "قص"], bar)
    # a quick swipe over the picture does not move the clip; a short hold then a move does
    h = await E("()=>{const r=document.querySelector('.handle').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}")
    cdp = await ctx.new_cdp_session(pg)
    async def touch(pts, hold=0):
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": pts[0][0], "y": pts[0][1]}]})
        if hold: await pg.wait_for_timeout(hold)
        for x, y in pts[1:]: await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y}]}); await pg.wait_for_timeout(16)
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(200)
    await touch([(h[0], h[1]), (h[0] + 10, h[1] + 20), (h[0] + 20, h[1] + 50), (h[0] + 25, h[1] + 70)])
    t1 = (await E(CLIPS))[0]
    await touch([(h[0], h[1]), (h[0] + 10, h[1] + 10), (h[0] + 30, h[1] + 20)], hold=450)
    t2 = (await E(CLIPS))[0]
    chk("phone: a quick swipe over the picture leaves the clip where it is; a short hold then a move moves it", t1["x"] == 0 and t1["y"] == 0 and (t2["x"] != 0 or t2["y"] != 0), [t1, t2])
    await pg.locator('[data-testid="ruler"]').tap(position={"x": 90, "y": 10}); await pg.wait_for_timeout(200)
    if not await pg.locator('[data-testid="cb-split"]').count(): await pg.locator('.clip').first.tap(); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="cb-split"]'); await pg.wait_for_timeout(300)
    n = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).length")
    await pg.click('[data-testid="cb-edit"]'); await pg.wait_for_timeout(400)
    ed = await E("()=>({sheet:!!document.querySelector('.msheet.insp'),tl:document.querySelector('.timeline').getBoundingClientRect().height>100})")
    chk("phone: Split from the clip bar cuts at the playhead; Edit opens the settings with the timeline in view", n == 2 and ed["sheet"] and ed["tl"], [n, ed])
    chk("phone: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        for f in (desktop, phone):
            try: await f(p)
            except Exception as e: fails.append(f"{f.__name__} crashed: " + repr(e)[:500])
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:5000])
print("v222 OK" if not fails else "v222 FAIL")
sys.exit(1 if fails else 0)
