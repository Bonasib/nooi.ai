# Video editor with real media (no demo): a fresh nooi server with its own data + media folders, real files made by ffmpeg
# (2 videos with sound, a picture, music, a voice). Adds them from the results to the editor, then — by touch on a phone and
# by mouse on a desktop — checks: tap the timeline seeks and never adds text, drag on the ruler scrubs, tap a clip selects,
# play / pause, split, duplicate, move, delete, undo, redo, trim, volume, speed, add / edit text, music & sounds, and the
# export: an MP4 at the exact size of the format (1080×1920 for Reels) with sound and the right length.
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8087
D = tempfile.mkdtemp(prefix="nooi-ed-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
FF = os.environ.get("FFMPEG_PATH", "ffmpeg"); M = D + "/media/"
for args in (["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", M + "a.webm"],
             ["-f", "lavfi", "-i", "mandelbrot=size=720x1280:rate=30", "-t", "5", "-f", "lavfi", "-i", "sine=frequency=550:duration=5", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", M + "b.webm"],
             ["-f", "lavfi", "-i", "gradients=size=1024x1024:duration=1", "-frames:v", "1", M + "img.jpg"],
             ["-f", "lavfi", "-i", "sine=frequency=220:duration=20", "-c:a", "libmp3lame", M + "music.mp3"],
             ["-f", "lavfi", "-i", "sine=frequency=700:duration=3", "-c:a", "libmp3lame", M + "voice.mp3"]):
    subprocess.run([FF, "-v", "error", "-y", *args], check=True)
SETUP = """async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='ar';S.user={name:'T',method:'google'};AU.showAuth=false;
 const now=Date.now(),mk=(id,kind,url,dur,extra)=>Object.assign({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url},extra||{});
 S.jobs.push(mk('ed_va','video','/media/a.webm',6),mk('ed_vb','video','/media/b.webm',5,{aspect:'9:16'}),mk('ed_img','image','/media/img.jpg',0),mk('ed_mu','music','/media/music.mp3',20),mk('ed_vo','voice','/media/voice.mp3',3));
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.format='reels';
 for(const id of ['ed_va','ed_vb','ed_img','ed_mu','ed_vo']){await edUseJob(S.jobs.find(j=>j.id===id),{stay:true,quiet:true,t:1})}
 go('edit');renderAll()}"""
SCROLL = """(sel)=>{const all=document.querySelectorAll(sel),el=all[all.length-1];if(!el)return null;let e=el.parentElement;while(e&&!(e.scrollHeight>e.clientHeight+5&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)))e=e.parentElement;e=e||document.scrollingElement;
 const st=document.querySelector('.edstage');const top=(st&&getComputedStyle(st).position==='sticky')?st.getBoundingClientRect().bottom+20:120;e.style.scrollBehavior='auto';e.scrollTop+=el.getBoundingClientRect().top-top;return 1}"""
RECT = "(s)=>{const a=document.querySelectorAll(s),x=a[a.length-1].getBoundingClientRect();return [x.x,x.y,x.width,x.height]}"
WRAP = "()=>{const r=document.querySelector('.tlwrap').getBoundingClientRect();return [r.left,r.right]}"

async def run(p, w, mob, fails, out):
    b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=mob, has_touch=mob, accept_downloads=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1800); E = pg.evaluate
    await E(SETUP); await pg.wait_for_timeout(2500); R = {}
    snap = lambda: E("()=>({n:S.ed.clips.length,order:S.ed.clips.map(c=>c.id).join(','),sel:S.ed.sel,t:+ED.t.toFixed(2),playing:ED.playing,texts:S.ed.texts.length})")
    async def tap(sel, dx=0.5):
        if not await E(SCROLL, sel): return False
        await pg.wait_for_timeout(250); r = await E(RECT, sel); wr = await E(WRAP)
        x, y = min(r[0] + r[2] * dx, (wr[1] if sel.startswith("[data-trk") else w) - 25), r[1] + r[3] / 2
        if mob: await pg.touchscreen.tap(x, y)
        else: await pg.mouse.click(x, y)
        await pg.wait_for_timeout(350); return True
    def check(name, cond, info=""):
        R[name] = "ok" if cond else "FAIL " + str(info)
        if not cond: fails.append(f"{w}: {name} {info}")
    s0 = await snap(); await tap("[data-trk=t]", 0.7); s = await snap(); check("tap timeline seeks, adds no text", s["t"] > 0 and s["texts"] == s0["texts"], s)
    await E(SCROLL, "#tlin .ruler"); await pg.wait_for_timeout(250); await E("()=>{ED.t=0}"); rr = await E(RECT, "#tlin .ruler"); wr = await E(WRAP)
    y = rr[1] + rr[3] / 2; x0 = max(rr[0] + 50, wr[0] + 50); x1 = min(x0 + 180, wr[1] - 15)
    if mob:
        cdp = await ctx.new_cdp_session(pg); await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y}]})
        for k in range(1, 9): await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x0 + (x1 - x0) * k / 8, "y": y}]}); await pg.wait_for_timeout(20)
        mid = (await snap())["t"]; await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    else:
        await pg.mouse.move(x0, y); await pg.mouse.down()
        for k in range(1, 9): await pg.mouse.move(x0 + (x1 - x0) * k / 8, y); await pg.wait_for_timeout(20)
        mid = (await snap())["t"]; await pg.mouse.up()
    check("drag on the ruler scrubs", mid > 0.5, mid)
    await tap(".blk.v"); s = await snap(); check("tap a clip selects it", bool(s["sel"]))
    await tap("[data-act=ed-play]"); await pg.wait_for_timeout(900); s1 = await snap(); check("play", s1["playing"] and s1["t"] > s["t"], [s["t"], s1["t"]])
    await tap("[data-act=ed-play]"); check("pause", not (await snap())["playing"])
    await E("()=>{ED.t=2;S.ed.sel=S.ed.clips[0].id;renderView()}")
    for act, fn in [("ed-split", lambda a, b: b["n"] == a["n"] + 1), ("ed-dup", lambda a, b: b["n"] == a["n"] + 1), ("ed-move", lambda a, b: b["order"] != a["order"]), ("ed-del", lambda a, b: b["n"] == a["n"] - 1), ("ed-undo", lambda a, b: b["n"] == a["n"] + 1), ("ed-redo", lambda a, b: b["n"] == a["n"] - 1)]:
        a = await snap(); await tap(f"[data-act={act}]:not([disabled])"); b2 = await snap(); check(act, fn(a, b2), [a["n"], b2["n"]])
    await E("()=>{S.ed.sel=S.ed.clips[0].id;S.ed.tab='clip';renderView()}"); await pg.wait_for_timeout(300)
    res = await E("""()=>{const set=(b,v)=>{const i=document.querySelector('[data-bind="'+b+'"]');if(!i)return 0;i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return 1};const c=S.ed.clips[0];set('edclip.in',1);set('edclip.out',4);set('edclip.vol',50);return [+c.in,+c.out,+c.vol]}""")
    check("trim & volume", res == [1, 4, 50], res)
    sp = await E("()=>{const b=[...document.querySelectorAll('[data-set=\"edclip.speed\"]')].find(x=>x.dataset.val==='2');if(!b)return 0;b.click();return +S.ed.clips[0].speed}"); check("speed", sp == 2, sp)
    a = await snap(); await E("()=>{S.ed.tab='text';renderView()}"); await tap("[data-act=ed-addtext]"); b2 = await snap(); check("add text", b2["texts"] == a["texts"] + 1, b2)
    tx = await E("()=>{const i=document.querySelector('[data-bind=\"edtext.text\"]');if(!i)return null;i.value='Grand opening';i.dispatchEvent(new Event('input',{bubbles:true}));return S.ed.texts.find(t=>t.id===S.ed.selText).text}"); check("edit text", tx == "Grand opening", tx)
    au = await E("()=>[!!M.edMusic,(S.ed.sfx||[]).length]"); check("music & sounds from results", au[0] and au[1] >= 1, au)
    check("no demo buttons", not await E("()=>!!document.querySelector('#main [data-act=ed-demo]')"))
    if not mob:   # export once (it records in real time)
        await E("()=>{S.ed.tab='export';renderView()}"); await pg.wait_for_timeout(400)
        try:
            async with pg.expect_download(timeout=150000) as dl: await pg.locator("[data-act=ed-export]").last.click()
            d = await dl.value; f = D + "/export_" + d.suggested_filename; await d.save_as(f)
            pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", f], capture_output=True, text=True).stdout or "{}")
            v = [s for s in pr.get("streams", []) if s.get("codec_type") == "video"]; a_ = [s for s in pr.get("streams", []) if s.get("codec_type") == "audio"]; dur = float(pr.get("format", {}).get("duration", 0) or 0)
            check("export: MP4 1080×1920 with sound and length", f.endswith(".mp4") and v and v[0]["width"] == 1080 and v[0]["height"] == 1920 and a_ and dur > 3, [d.suggested_filename, v and v[0], bool(a_), dur])
        except Exception as e: check("export", False, str(e)[:160])
    check("no page errors", not errs, errs); out[w] = R; await b.close()

async def main():
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(os.environ, PORT=str(PORT), SECRET_KEY="r" * 40, FIREBASE_PROJECT_ID=""), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    fails, out = [], {}
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            for w, mob in ((390, True), (1280, False)): await run(p, w, mob, fails, out)
    finally:
        srv.terminate(); shutil.rmtree(D, ignore_errors=True)
    print(json.dumps({"fails": fails, "detail": out}, ensure_ascii=False, indent=1)); sys.exit(1 if fails else 0)
asyncio.run(main())
