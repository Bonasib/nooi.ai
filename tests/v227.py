# v227 — nooi Motion: our own programmatic motion-graphics engine (own code; no Remotion code).
#  · 126 motion graphics since v234 (lower thirds, titles, social, charts and numbers, shapes, callouts, timers, sound-reactive, intros, wipes, badges, frames, moving backgrounds, code), each tile
#    the template itself drawn live (it plays when pointed at)
#  · a motion graphic is a clip drawn frame by frame from its props; the props form changes the drawing (one undo step)
#  · sound-reactive graphics follow the edit's sound at that moment
#  · Motion code: JavaScript run in a sealed sandbox (no network, no storage, no page); errors shown; a stuck loop is stopped
#  · the device export draws every frame (templates and code) into the video
# Run: python3 tests/v227.py
import asyncio, json, os, re, subprocess, sys, tempfile, hashlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8728; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v227-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
# a sound that is loud at 0.52 s and quiet at 1.05 s (and so on)
FF("-f", "lavfi", "-i", "sine=f=220:d=6:sample_rate=48000", "-af", "volume='0.04+0.96*abs(sin(t*3))':eval=frame", "-c:a", "pcm_s16le", D + "/beat.wav")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
P = "window.__studio.editor.project"
# the preview's picture: how many points are lit, and a fingerprint (a region given as [x0,y0,x1,y1] shares of the frame)
LIT = """(r)=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);
  r=r||[0,0,1,1];let n=0,h=0;for(let y=Math.floor(H*r[1]);y<Math.floor(H*r[3]);y+=2)for(let x=Math.floor(W*r[0]);x<Math.floor(W*r[2]);x+=2){const i=((H-1-y)*W+x)*4,v=d[i]+d[i+1]+d[i+2];if(v>90){n++;h=(h*31+x*7+y*13+d[i])>>>0}}return{n,h}}"""
SEEK = "(t)=>window.__studio.player.seek(t)"
MG = "()=>" + P + ".tracks.flatMap(t=>t.clips.filter(c=>c.motion).map(c=>({id:c.id,tpl:c.motion.tpl,props:c.motion.props,start:+c.start.toFixed(2),dur:c.dur,text:c.text,tr:t.kind})))"

async def code(pg, src):
    await pg.fill('[data-testid="mg-src"]', src); await pg.click('[data-testid="mg-run"]')
    await pg.wait_for_function("()=>!document.querySelector('[data-testid=mg-run]').disabled", timeout=8000); await pg.wait_for_timeout(250)
    return await pg.evaluate("()=>(document.querySelector('[data-testid=mg-err]')||{}).textContent||''")

async def desktop(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="rail-titles"]'); await pg.click('.panel .subtabs button:has-text("Motion graphics")'); await pg.wait_for_selector('[data-testid="motion-gallery"]')
    n = await E("()=>({tiles:document.querySelectorAll('.mgal .mgt').length,chips:document.querySelectorAll('.mgal .chip').length,groups:document.querySelectorAll('.mgal .ns-lbl').length})")
    chk("the gallery: 126 motion graphics in 14 groups (+ All)", n == {"tiles": 126, "chips": 15, "groups": 14}, n)
    # every tile is the template drawn (scrolled into view one by one; the code tile is drawn by the sandbox)
    ids = await E("()=>[...document.querySelectorAll('.mgal .mgt')].map(b=>b.dataset.testid.slice(3))"); blank = []
    for i in ids:
        await pg.locator(f'[data-testid="mg-{i}"]').scroll_into_view_if_needed();
    await pg.wait_for_timeout(1500)
    for i in ids:
        lit = await E("(i)=>{const c=document.querySelector('[data-testid=mg-'+i+'] canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let k=3;k<d.length;k+=16)if(d[k]>40)n++;return n}", i)
        if lit < 30: blank.append([i, lit])
    chk("every tile shows its graphic drawn by its own program (none blank)", not blank and len(ids) == 126, blank)
    # pointing at a tile plays it
    tl = pg.locator('[data-testid="mg-ti-letters"]'); await tl.scroll_into_view_if_needed(); await tl.hover()
    FP = "()=>{const c=document.querySelector('[data-testid=mg-ti-letters] canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=0;for(let k=0;k<d.length;k+=40)h=(h*31+d[k])>>>0;return h}"
    a1 = await E(FP); await pg.wait_for_timeout(450); a2 = await E(FP); await pg.mouse.move(5, 5)
    chk("pointing at a tile plays its animation", a1 != a2, [a1, a2])

    # ---- sound-reactive: the bars follow the edit's sound
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/beat.wav")
    await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.kind==='audio'&&(a.waveform||[]).length>50)", timeout=20000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a,0)}"); await E(SEEK, 0); await pg.wait_for_timeout(200)
    await pg.click('[data-testid="rail-titles"]'); await pg.click('[data-testid="mg-au-bars"]'); await pg.wait_for_timeout(300)
    await E("()=>{const s=window.__studio;s.editor.run('x',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.motion)c.start=0})}")
    await E(SEEK, 0.52); await pg.wait_for_timeout(500); loud = await E(LIT)
    await E(SEEK, 1.05); await pg.wait_for_timeout(500); quiet = await E(LIT)
    chk("sound-reactive bars follow the sound (tall when loud, short when quiet)", loud["n"] > 1.8 * max(1, quiet["n"]) and loud["n"] > 200, [loud, quiet])
    await E("()=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).map(c=>c.id));s.actions.del()}"); await pg.wait_for_timeout(300)

    # ---- a lower third: added at the playhead, drawn frame by frame, the props form changes it
    await E(SEEK, 0); await pg.wait_for_timeout(200); await pg.click('[data-testid="mg-lt-bar"]'); await pg.wait_for_timeout(400)
    mg = await E(MG)
    chk("a motion graphic goes on a title track at the playhead with the template's props and length", len(mg) == 1 and mg[0]["tpl"] == "lt-bar" and mg[0]["props"].get("name") == "Alex Morgan" and mg[0]["dur"] == 5 and mg[0]["tr"] == "text" and mg[0]["start"] == 0, mg)
    tab = await E("()=>({tab:(document.querySelector('[data-testid=insp-mg]')||{}).getAttribute?.('aria-selected'),form:!!document.querySelector('[data-testid=mg-props]'),fields:document.querySelectorAll('[data-testid=mg-props] [data-testid^=mgp-]').length,label:(document.querySelector('.clip.text.mg .cn')||{}).textContent})")
    chk("the inspector opens on the graphic's props (name, title, colour, place); the clip is marked on the timeline", tab["tab"] == "true" and tab["form"] and tab["fields"] == 4 and tab["label"] == "Accent bar", tab)
    await E(SEEK, 0.05); await pg.wait_for_timeout(350); early = await E(LIT, [0, 0.55, 0.7, 1])
    await E(SEEK, 1.5); await pg.wait_for_timeout(350); full = await E(LIT, [0, 0.55, 0.7, 1])
    chk("it is drawn frame by frame (it grows in, then shows in the lower left)", full["n"] > 300 and full["n"] > early["n"] * 1.5, [early, full])
    await pg.fill('[data-testid="mgp-name"]', "Zainab Al-Rashid Mohammed"); await pg.locator('[data-testid="mgp-name"]').blur(); await pg.wait_for_timeout(400)
    after = await E(LIT, [0, 0.55, 0.7, 1]); pr = (await E(MG))[0]["props"]
    chk("editing a prop changes the drawing", pr["name"] == "Zainab Al-Rashid Mohammed" and after["h"] != full["h"] and after["n"] > full["n"], [full, after, pr.get("name")])
    await pg.select_option('[data-testid="mgp-pos"]', "right"); await pg.wait_for_timeout(400)
    right = await E(LIT, [0.5, 0.55, 1, 1]); left = await E(LIT, [0, 0.55, 0.22, 1])
    chk("the Place choice moves it to the right", right["n"] > 200 and left["n"] < right["n"] / 3, [right, left])
    await pg.keyboard.press("Control+z"); await pg.wait_for_timeout(300); pos = (await E(MG))[0]["props"]["pos"]
    chk("a prop change is one undo step", pos == "left", pos)

    # ---- Motion code in the sealed sandbox
    await E(SEEK, 0); await pg.click('.panel .subtabs button:has-text("Motion graphics")'); await pg.locator('[data-testid="mg-code"]').scroll_into_view_if_needed()
    await pg.click('[data-testid="mg-code"]'); await pg.wait_for_timeout(500)
    mg = await E(MG); cid = [c for c in mg if c["tpl"] == "code"]
    chk("Motion code: a code clip with a working example", len(cid) == 1 and "M.spring" in cid[0]["props"].get("code", ""), mg)
    await E(SEEK, 1.5); await pg.wait_for_timeout(900); ring = await E(LIT, [0.3, 0.15, 0.7, 0.6])
    chk("the example code draws in the preview", ring["n"] > 150, ring)
    e1 = await code(pg, "m.ctx.fillStyle = '#fff'; m.ctx.fillRect(0, 0, m.W, m.H * 0.4 * (1 + ;")
    chk("a code error is shown (the drawing keeps the last good picture)", "Unexpected" in e1 or "SyntaxError" in e1 or "token" in e1, e1)
    e2 = await code(pg, "const open = Object.entries({ fetch: typeof fetch, xhr: typeof XMLHttpRequest, idb: typeof indexedDB, imp: typeof importScripts, doc: typeof document, parent: typeof parent, ws: typeof WebSocket }).filter(([, x]) => x !== 'undefined').map(([k]) => k); if (open.length) throw new Error('open: ' + open.join(','));\nm.ctx.fillStyle = '#ff00aa'; m.ctx.fillRect(0, 0, m.W, m.H * M.interpolate(m.frame, [0, 30], [0.2, 1]));")
    await E(SEEK, 1.4); await pg.wait_for_timeout(900); fill = await E(LIT, [0.05, 0.05, 0.95, 0.5])
    chk("the sandbox is sealed: no network, no storage, no page — and the new code draws", e2 == "" and fill["n"] > 1500, [e2, fill])
    e3 = await code(pg, "while (true) {}")
    chk("a stuck loop is stopped (too slow) instead of freezing the studio", "too slow" in e3, e3)
    e4 = await code(pg, "m.ctx.fillStyle = '#00ff66'; m.ctx.beginPath(); m.ctx.arc(m.W / 2, m.H / 2, m.u * 0.3 * M.spring({ frame: m.frame, fps: m.fps }), 0, 7); m.ctx.fill();")
    chk("after a stopped loop the sandbox works again", e4 == "", e4)

    # ---- the device export draws every frame (the lower third and the code) into the video
    await E("()=>window.__studio.editor.run('x',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.motion){c.start=0;c.dur=3}})"); await E(SEEK, 0)
    await pg.click('[data-testid="export"]'); await pg.click('.sheet .ns-seg button:has-text("WEBM")'); await pg.click('.sheet .ns-seg button:has-text("720p")'); await pg.click('[data-testid="export-go"]')
    try:
        await pg.wait_for_selector('[data-testid="download"], .sheet .err', timeout=300000)
        async with pg.expect_download() as dl: await pg.click('[data-testid="download"]')
        d = await dl.value; path = D + "/out.webm"; await d.save_as(path)
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", "1.5", "-i", path, "-frames:v", "1", "-vf", "scale=64:36", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, timeout=60).stdout
        g = lambda x0, y0, x1, y1: sum(1 for y in range(y0, y1) for x in range(x0, x1) if raw[y * 64 + x] > 60)
        out["export"] = {"bytes": len(raw), "centre": g(24, 10, 40, 26), "lower_left": g(3, 24, 24, 31), "corner": g(56, 0, 64, 6)}
        x = out["export"]
        chk("the exported video has the code's circle in the middle and the lower third at the bottom left", x["bytes"] == 64 * 36 and x["centre"] > 120 and x["lower_left"] > 15 and x["corner"] == 0, x)
    except Exception as e: chk("device export", False, [str(e)[:200], await E("()=>(document.querySelector('.sheet .err')||{}).textContent")])
    chk("desktop: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="rail-titles"]'); await pg.click('.panel .subtabs button:has-text("رسوم متحركة")'); await pg.wait_for_selector('[data-testid="motion-gallery"]')
    v = await E("()=>({tiles:document.querySelectorAll('.mgal .mgt').length,first:document.querySelector('.mgal .mgt span:last-child').textContent,over:document.documentElement.scrollWidth-innerWidth,cols:new Set([...document.querySelectorAll('.mgal .mgt')].slice(0,6).map(b=>Math.round(b.getBoundingClientRect().left))).size})")
    chk("phone (Arabic): the gallery in Arabic, at least two tiles a row, nothing wider than the screen", v["tiles"] == 126 and v["first"] == "شريط ملوّن" and v["over"] <= 0 and v["cols"] >= 2, v)
    await pg.click('[data-testid="mgg-data"]'); await pg.wait_for_timeout(200); nd = await E("()=>document.querySelectorAll('.mgal .mgt').length")
    await pg.click('[data-testid="mg-ch-counter"]'); await pg.wait_for_timeout(500); mg = await E(MG)
    chk("phone: the group filter, and a graphic added in Arabic gets Arabic words", nd == 13 and len(mg) == 1 and re.search("[؀-ۿ]", json.dumps(mg[0]["props"], ensure_ascii=False)) and mg[0]["text"] == "عدّاد أرقام", [nd, mg])
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
print(json.dumps(out, ensure_ascii=False)[:600])
if fails: print("v227 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v227 OK")
