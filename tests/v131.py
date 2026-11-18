# v131 "the editor, used on a phone" — with a real nooi server and real touch input (CDP), on a phone and on a computer:
#  · a tap on the picture keeps the video playing and hides the guides (safe zones, selection handles); another tap brings them
#    back; the tool row's words stay whole (one line each)
#  · dragging the playhead: a jump waits for the one before (only the newest place is kept), the light copy is shown while you
#    drag and the clip itself after; the server makes the copy (a keyframe every 6 frames, no sound, ≤ 640 px) and refuses
#    anything that isn't a clip of its own
#  · a long press (or a right click) opens the menu of the picture and a video you made; on the timeline a long press opens the item's settings (v171) and a right click its menu; its actions work;
#    a finger that moves is a drag, not a menu
#  · 22 transitions (gl-transitions) compile and draw the next clip; 20 text motions (Animate.css) move the text; 15 looks
#    (after CSSgram) colour the picture; 10 banners and 36+ stickers in groups (Material Symbols) are added, styled and drawn — in Arabic too
#  · Grok Imagine 1.5 (it starts from a picture) is offered only when a picture is attached
# Run: python3 tests/v131.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8360
D = tempfile.mkdtemp(prefix="nooi-v131-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
FF = ["ffmpeg", "-v", "error", "-y"]
VP9 = ["-c:v", "libvpx-vp9", "-b:v", "500k", "-deadline", "realtime", "-cpu-used", "8", "-g", "48", "-pix_fmt", "yuv420p", "-c:a", "libopus"]
# a.webm: 8 s, red = 30 × time (the picture says which moment it is); b.webm: 4 s of blue; s.mp4: one keyframe in 6 s; m.webm: music
subprocess.run(FF + ["-f", "lavfi", "-i", "color=c=black:s=640x360:r=24:d=8", "-f", "lavfi", "-i", "sine=frequency=330:duration=8", "-vf", "geq=r='30*T':g='60':b='60'"] + VP9 + ["-shortest", D + "/media/a.webm"], check=True)
subprocess.run(FF + ["-f", "lavfi", "-i", "color=c=0x003cdc:s=640x360:r=24:d=4", "-f", "lavfi", "-i", "sine=frequency=440:duration=4"] + VP9 + ["-shortest", D + "/media/b.webm"], check=True)
subprocess.run(FF + ["-f", "lavfi", "-i", "testsrc2=s=1280x720:r=24:d=6", "-f", "lavfi", "-i", "sine=frequency=500:duration=6", "-c:v", "libx264", "-g", "144", "-keyint_min", "144", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/s.mp4"], check=True)
subprocess.run(FF + ["-f", "lavfi", "-i", "sine=frequency=220:duration=6", "-c:a", "libopus", D + "/media/m.webm"], check=True)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "KIE_", "FIREBASE_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, res = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False)[:400]))
def post(path, body):
    rq = urllib.request.Request(f"http://localhost:{PORT}{path}", data=json.dumps(body).encode(), headers={"content-type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(rq, timeout=120) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")

# ---- the server's light copy for dragging
def server_side():
    t0 = time.time(); st, j = post("/v1/media/scrub", {"url": "/media/s.mp4"}); res["scrubMake"] = [st, j, round(time.time() - t0, 2)]
    chk("scrub copy made", st == 200 and j.get("url") == "/media/s.scrub.mp4", [st, j])
    f = D + "/media/s.scrub.mp4"
    if os.path.exists(f):
        pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-of", "json", f], capture_output=True, text=True).stdout)
        vs = [s for s in pr["streams"] if s["codec_type"] == "video"]; au = [s for s in pr["streams"] if s["codec_type"] == "audio"]
        kf = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "frame=key_frame", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.split()
        idx = [i for i, k in enumerate(kf) if k.strip().startswith("1")]; gaps = [b - a for a, b in zip(idx, idx[1:])]
        res["scrubCopy"] = {"w": vs[0]["width"], "h": vs[0]["height"], "codec": vs[0]["codec_name"], "audio": len(au), "frames": len(kf), "keyframes": len(idx), "maxGap": max(gaps or [0]), "bframes": vs[0].get("has_b_frames")}
        c = res["scrubCopy"]; chk("scrub copy: h264 ≤ 640 px, no sound, a keyframe every 6 frames, no B-frames", c["codec"] == "h264" and c["w"] <= 640 and c["audio"] == 0 and c["maxGap"] <= 6 and c["keyframes"] >= c["frames"] // 6 and not c["bframes"], c)
    t0 = time.time(); st, j = post("/v1/media/scrub", {"url": f"http://localhost:{PORT}/media/s.mp4"}); chk("scrub copy kept (second ask is instant, full address accepted)", st == 200 and j.get("url") == "/media/s.scrub.mp4" and time.time() - t0 < 1, [st, j])
    for bad in ["/media/../data/db.json", "/media/nope.mp4", "/media/s.scrub.mp4", "http://evil.example/media/s.mp4", "/etc/passwd", ""]:
        st, j = post("/v1/media/scrub", {"url": bad}); chk("scrub refuses " + bad, st == 404 and j.get("errorAr"), [st, j])

PIX = "(x,y)=>{const c=document.getElementById('wk');const d=c.getContext('2d').getImageData(Math.round(c.width*x),Math.round(c.height*y),1,1).data;return[d[0],d[1],d[2]]}"
HASH = "()=>{const c=document.getElementById('wk');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=0;for(let i=0;i<d.length;i+=12)h=(h*31+d[i]+d[i+1]*7+d[i+2]*13)|0;return h}"
WHITE = "()=>{const c=document.getElementById('wk');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]>200&&d[i+2]>200)n++;return n}"
DRAW = "(t)=>{ED.playing=false;ED.t=t;edTick(performance.now());edTick(performance.now()+16)}"

async def touch(cdp, x, y, hold=60, move=None):
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 7}]})
    if move:
        for k in range(1, 7): await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + move * k / 6, "y": y, "id": 7}]}); await asyncio.sleep(.015)
    await asyncio.sleep(hold / 1000)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})

async def box(pg, sel, inline="center", block="center"):
    await pg.evaluate("([s,i,b])=>{const e=document.querySelector(s);e&&e.scrollIntoView({block:b,inline:i})}", [sel, inline, block]); await pg.wait_for_timeout(250)
    return await pg.locator(sel).first.bounding_box()

async def spot(pg, sel, dx=None):
    # a point on the element that a finger really reaches (not under the pinned preview, a lane label or the bottom bar)
    vw = pg.viewport_size["width"]
    for blk in ("center", "end", "start", "nearest"):
        bb = await box(pg, sel, "center", blk)
        if not bb: continue
        x0, x1 = max(bb["x"], 4), min(bb["x"] + bb["width"], vw) - 4
        xs = ([x0 + dx] if dx is not None else []) + [(x0 + x1) / 2, x0 + (x1 - x0) * .75]
        for x in xs:
            for fy in (.5, .3, .7):
                y = bb["y"] + bb["height"] * fy
                if x0 <= x <= x1 and await pg.evaluate("([s,x,y])=>{const e=document.elementFromPoint(x,y),t=document.querySelector(s);return!!(e&&t&&(t===e||t.contains(e)))}", [sel, x, y]): return x, y
    raise Exception("can't reach " + sel)

async def setup(pg, lang):
    E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.ed.clips=[];S.ed.texts=[];S.ed.infos=[];S.ed.safe=true;go('edit');renderAll()}", lang)
    await E("async()=>{const f=async n=>new File([await (await fetch('/media/'+n)).blob()],n,{type:'video/webm'});edAddFiles([await f('a.webm'),await f('b.webm')]);renderView()}")
    await pg.wait_for_function("S.ed.clips.length===2&&S.ed.clips.every(c=>{const m=M['c_'+c.id];return m&&m.el&&m.el.readyState>=2})&&Math.abs(clipDur(S.ed.clips[0])-8)<.2", timeout=20000)

async def phone(b):
    ctx = await b.new_context(viewport={"width": 412, "height": 915}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = await ctx.new_page(); errs, warns, scrubReqs = [], [], []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("console", lambda m: m.type in ("warning", "error") and "v131" in m.text and warns.append(m.text[:200]))
    pg.on("request", lambda r: "/v1/media/scrub" in r.url and scrubReqs.append(r.url))
    E = pg.evaluate; await setup(pg, "en"); cdp = await ctx.new_cdp_session(pg)
    c0 = await E("()=>S.ed.clips[0].id")
    # the tool row: whole words
    await E("(id)=>{edSetPick('clip',id);S.ed.tab='clip';renderView()}", c0); await pg.wait_for_timeout(300)
    bar = await E("""()=>[...document.querySelectorAll('#main .edbar .tb,#main .e-bar button')].filter(t=>t.offsetParent||getComputedStyle(t.closest('.e-bar')||t).position==='fixed').map(t=>{const s=t.querySelector('span')||t,r=document.createRange();r.selectNodeContents(s);const rs=[...r.getClientRects()].filter(x=>x.width>1).sort((a,b)=>a.top-b.top);let n=0,bot=-1e9;for(const x of rs){if(x.top>=bot-2){n++;bot=x.bottom}else bot=Math.max(bot,x.bottom)}return{t:s.textContent.trim(),lines:n}})""")
    res["bar"] = bar; chk("tool row: every label on one line", bar and all(x["lines"] == 1 for x in bar), bar)
    # a tap on the picture while it plays
    await E("()=>{ED.t=0;ED.playing=true}"); await pg.wait_for_timeout(400)
    wk = await box(pg, "#wk"); cx, cy = wk["x"] + wk["width"] / 2, wk["y"] + wk["height"] * .3
    t1 = await E("()=>ED.t"); await touch(cdp, cx, cy); await pg.wait_for_timeout(500)
    a = await E("()=>({playing:ED.playing,clean:!!ED.clean131,cls:!!document.querySelector('#main .edstage.clean131'),chip:(document.querySelector('#main .cl131.on')||{}).textContent||'',t:ED.t})")
    res["tap1"] = a; chk("tap: the video keeps playing", a["playing"] and a["t"] > t1 + .3, [t1, a]); chk("tap: the guides go away (clean view)", a["clean"] and a["cls"] and "show" in a["chip"], a)
    await pg.screenshot(path=D + "/clean.png")
    await touch(cdp, cx, cy); await pg.wait_for_timeout(300)
    a = await E("()=>({playing:ED.playing,clean:!!ED.clean131})"); res["tap2"] = a; chk("second tap: guides back, still playing", a["playing"] and not a["clean"], a)
    # clean view draws the picture as with no guides and nothing picked (v208: on a portrait format — since v201 the format follows the
    # first clip, and the safe-zone guides are drawn for portrait formats only)
    d = await E("""async(id)=>{ED.playing=false;await new Promise(r=>setTimeout(r,200));const H=%s;S.ed.format='reels';S.ed.fmtSet201=1;edSetPick('clip',id);S.ed.safe=true;ED.t=1;
      ED.clean131=false;edTick(performance.now());const h1=H();ED.clean131=true;edTick(performance.now());const h2=H();ED.clean131=false;S.ed.safe=false;const pk=S.ed.pick;S.ed.pick=null;edTick(performance.now());const h3=H();S.ed.safe=true;S.ed.pick=pk;
      return{h1,h2,h3,pick:!!S.ed.pick,safe:S.ed.safe}}""" % HASH, c0)
    res["cleanDraw"] = d; chk("clean view = the picture without guides or handles", d["h1"] != d["h2"] and d["h2"] == d["h3"] and d["pick"] and d["safe"], d)
    # jumps: only the newest place is kept while one is under way
    q = await E("""async()=>{const v=document.createElement('video');v.muted=true;v.preload='auto';v.src='/media/a.webm';mediaHost().appendChild(v);await new Promise(r=>v.readyState>=2?r():v.addEventListener('loadeddata',r,{once:true}));
      const m={type:'video',el:v};hook131(m);let seeks=0;v.addEventListener('seeking',()=>seeks++);v.currentTime=1;const s=v.seeking;v.currentTime=2;v.currentTime=3;v.currentTime=4.5;const q=v._q131;
      await new Promise(r=>setTimeout(r,900));const o={s,q,ct:v.currentTime,seeking:v.seeking,seeks};v.remove();return o}""")
    res["coalesce"] = q; chk("jumps: one at a time, the newest kept", q["q"] == 4.5 and abs(q["ct"] - 4.5) < .05 and not q["seeking"] and q["seeks"] == 2, q)
    # the light copy while dragging (a VP9 stand-in here: this browser has no H.264), the clip itself after
    # (v135: a clip with its film strip shows the strip instead — tests/v135.py; here the clip has none, so the copy is used)
    p = await E("""async(id)=>{const P=%s;const m=M['c_'+id],v=m.el,px=document.createElement('video');m.sp135=null;m.spReq135=1;px.muted=true;px.src='/media/b.webm';mediaHost().appendChild(px);landed131(px);
      await new Promise(r=>px.readyState>=2?r():px.addEventListener('loadeddata',r,{once:true}));hook131(m);m.px131=px;ED.playing=false;ED.t=1;await new Promise(r=>setTimeout(r,500));
      TLX.s={scrub:true};const before=CT131.get.call(v);ED.t=2;edTick(performance.now());const r1={use:!!m.use131,want:m.want131,read:v.currentTime};await new Promise(r=>setTimeout(r,500));
      edTick(performance.now());const p1=P(.5,.5);r1.main=CT131.get.call(v);r1.before=before;r1.px=px.currentTime;
      TLX.s=null;await new Promise(r=>setTimeout(r,1000));edTick(performance.now());edTick(performance.now());const p2=P(.5,.5);const r2={use:m.use131,main:CT131.get.call(v)};m.px131=null;m.use131=0;px.remove();return{r1,p1,p2,r2,h264:H264_131}}""" % PIX, c0)
    res["proxy"] = p
    chk("while dragging: the copy moves, the clip waits (and reads as being there)", p["r1"]["use"] and abs(p["r1"]["main"] - p["r1"]["before"]) < .01 and p["r1"]["want"] == 2 and p["r1"]["read"] == 2 and abs(p["r1"]["px"] - 2) < .01, p)
    chk("while dragging: the picture comes from the copy", p["p1"][2] > 150 and p["p1"][0] < 60, p)
    chk("let go: the clip itself again, at the same moment", not p["r2"]["use"] and abs(p["r2"]["main"] - 2) < .05 and abs(p["p2"][0] / 30 - 2) < .25 and p["p2"][2] < 120, p)
    chk("no copy asked for when the browser can't play it", not p["h264"] and not scrubReqs, [p["h264"], scrubReqs])
    # a real drag on the playhead
    await E("()=>{ED.t=.5;renderView()}"); await pg.wait_for_timeout(600)
    await box(pg, "#tlin", "nearest", "end"); ph = await pg.locator("#ph").bounding_box(); pps = await E("()=>S.ed.zoom"); wr = await pg.locator(".tlwrap").bounding_box()
    x0, y0 = ph["x"] + ph["width"] / 2, max(ph["y"], wr["y"]) + 10   # (v151: the studio's timeline scrolls inside itself — its ruler stays at its top)
    chk("the playhead can be reached (not under the preview or the bottom bar)", await E("([x,y])=>{const e=document.elementFromPoint(x,y);return!!(e&&e.closest('#tlin'))}", [x0, y0]))
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y0, "id": 1}]})
    for k in range(1, 31):
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x0 + k * (5 * pps / 30), "y": y0, "id": 1}]}); await pg.wait_for_timeout(25)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(1300)
    s = await E("(P)=>{const p=(%s)(.5,.5);return{shown:+(p[0]/30).toFixed(2),ed:+ED.t.toFixed(2),menu:!!document.querySelector('.cm131')}}" % PIX, None)
    res["drag"] = s; chk("drag the playhead: the picture lands where you let go, no menu", abs(s["shown"] - s["ed"]) < .2 and s["ed"] > 4 and not s["menu"], s)
    # long press on a clip on the timeline
    await E("()=>{ED.playing=false;ED.t=1;renderView()}"); await pg.wait_for_timeout(400)
    pt = await spot(pg, f'#tlin .blk[data-clip="{c0}"]', 24)
    before = await E("()=>S.ed.clips.map(c=>c.id+':'+c.in)")
    await touch(cdp, *pt, hold=750); await pg.wait_for_timeout(250)
    st = await E(SET171); res["longClip"] = st
    chk("long press on a clip (v171): its settings open, no menu", st["tab"] == "clip" and st["pick"] == "clip" and not st["menu"] and not st["closed"], st)
    await E(MENU171, f'#tlin .blk[data-clip="{c0}"]'); await pg.wait_for_timeout(200)
    mn = await E("()=>{const m=document.querySelector('.cm131');return m&&{sheet:m.classList.contains('sheet'),title:(m.querySelector('.cm131h')||{}).textContent||'',items:[...m.querySelectorAll('.cm131i')].map(x=>x.textContent.trim())}}")
    res["menuClip"] = mn; await pg.screenshot(path=D + "/menu.png")
    chk("a clip's menu (as a right click opens it): as a sheet on a phone", mn and mn["sheet"] and any("Split" in x for x in mn["items"]) and any("Duplicate" in x for x in mn["items"]) and any("Delete" in x for x in mn["items"]) and any("2×" in x for x in mn["items"]), mn)
    chk("long press didn't move the clip", await E("()=>S.ed.clips.map(c=>c.id+':'+c.in)") == before)
    if mn:
        await pg.locator(".cm131 .cm131i", has_text="Duplicate").tap(); await pg.wait_for_timeout(300)
        n = await E("()=>({n:S.ed.clips.length,menu:!!document.querySelector('.cm131')})"); chk("menu → Duplicate", n["n"] == 3 and not n["menu"], n)
        await E("()=>{S.ed.clips.splice(1,1);persist();renderView()}"); await pg.wait_for_timeout(300)
        await E(MENU171, f'#tlin .blk[data-clip="{c0}"]'); await pg.wait_for_timeout(250)
        await pg.locator(".cm131 .cm131i", has_text="Speed 2×").tap(); await pg.wait_for_timeout(250)
        sp = await E("(id)=>S.ed.clips.find(c=>c.id===id).speed", c0); chk("menu → Speed 2×", sp == 2, sp)
        await E("(id)=>{S.ed.clips.find(c=>c.id===id).speed=1;persist();renderView()}", c0); await pg.wait_for_timeout(200)
    # a finger that moves is a drag
    pt = await spot(pg, f'#tlin .blk[data-clip="{c0}"]', 24); await touch(cdp, *pt, hold=750, move=40); await pg.wait_for_timeout(250)
    chk("a moving finger opens no menu", not await E("()=>!!document.querySelector('.cm131')"))
    await E("()=>{cmClose131();ED.t=1;renderView()}")
    # long press on the picture → the clip under the playhead
    wk = await box(pg, "#wk")
    await touch(cdp, wk["x"] + wk["width"] * .5, wk["y"] + wk["height"] * .3, hold=750); await pg.wait_for_timeout(250)
    mn = await E("()=>{const m=document.querySelector('.cm131');return m&&{title:(m.querySelector('.cm131h')||{}).textContent||'',items:[...m.querySelectorAll('.cm131i')].map(x=>x.textContent.trim())}}")
    res["menuPic"] = mn; chk("long press on the picture: the clip's menu", mn and "a" in mn["title"].lower() and any("Split" in x for x in mn["items"]), mn)
    pt = await E("()=>{const m=document.querySelector('.cm131'),top=m?m.getBoundingClientRect().top:innerHeight,w=document.getElementById('wk').getBoundingClientRect();for(let y=Math.max(70,w.top+10);y<top-10;y+=10){const e=document.elementFromPoint(w.left+w.width/2,y);if(e&&e.id==='wk')return[w.left+w.width/2,y]}return null}")
    if pt: await touch(cdp, pt[0], pt[1]); await pg.wait_for_timeout(200)
    chk("a tap outside closes the menu", pt and not await E("()=>!!document.querySelector('.cm131')"), pt)
    chk("…and stays in the editor", await E("()=>S.view") == "edit"); await E("()=>{if(ED.clean131)clean131(false)}")
    # music: long press → remove
    await E("async()=>{loadSlot('edMusic',new File([await (await fetch('/media/m.webm')).blob()],'m.webm',{type:'audio/webm'}));renderView()}"); await pg.wait_for_timeout(800)
    am = pg.locator("#tlin .blk.a").first
    if await am.count():
        pt = await spot(pg, "#tlin .blk.a", 20); await touch(cdp, *pt, hold=750); await pg.wait_for_timeout(250)
        st = await E(SET171); res["longMusic"] = st; chk("long press on the music (v171): its settings", st["aux"] == "music" and st["tab"] == "audio" and not st["menu"], st)
        await E(MENU171, "#tlin .blk.a"); await pg.wait_for_timeout(250)
        it = await E("()=>[...document.querySelectorAll('.cm131 .cm131i')].map(x=>x.textContent.trim())"); res["menuMusic"] = it
        if any("Remove" in x for x in it): await pg.locator(".cm131 .cm131i", has_text="Remove").tap(); await pg.wait_for_timeout(250)
        chk("the music's menu → Remove the music", not await E("()=>!!M.edMusic"), it)
    else: chk("music on the timeline", False)
    # transitions from gl-transitions
    await E("(id)=>{edSetPick('clip',id);S.ed.tab='clip';renderView()}", c0); await pg.wait_for_function("GL131.list", timeout=8000); await E("()=>renderView()"); await pg.wait_for_timeout(200)
    # (v151: the editor shows its transitions as picture tiles in the clip's panel — no picker sheet; what each does on the tile)
    nt = await E("()=>({n:document.querySelectorAll('#main [data-set=\"edclip.trans\"][data-val^=\"gl_\"]').length,desc:(document.querySelector('#main [data-set=\"edclip.trans\"][data-val=\"gl_circle\"]')||{}).title||'',chip:document.querySelectorAll('#main .pk84c').length})")
    chk("22 new transitions among the clip's transition tiles, each saying what it does", nt["n"] == 22 and "circle" in nt["desc"] and nt["chip"] == 0, nt)
    await pg.locator('#main [data-set="edclip.trans"][data-val="gl_circle"]').first.scroll_into_view_if_needed(); await pg.locator('#main [data-set="edclip.trans"][data-val="gl_circle"]').first.tap(); await pg.wait_for_timeout(300)
    tr = await E("(id)=>S.ed.clips.find(c=>c.id===id).trans", c0); chk("tap a transition: it is the clip's", tr == "gl_circle", tr)
    comp = await E("()=>{if(!glCtx131())return'no webgl';return GLT131.map(x=>x[0]).filter(id=>!glProg131(id))}"); res["glCompile"] = comp
    chk("every transition compiles", comp == [], comp)
    g = await E("""async(id)=>{const P=%s,D=%s,c=S.ed.clips.find(x=>x.id===id),t=clipDur(c)-.25;c.trans='none';D(t);await new Promise(r=>setTimeout(r,250));D(t);const none=P(.5,.5);
      c.trans='gl_circle';D(t);await new Promise(r=>setTimeout(r,250));D(t);const circ=P(.5,.5),edge=P(.02,.02);let ms=performance.now();for(let i=0;i<10;i++)edTick(performance.now());ms=(performance.now()-ms)/10;
      const H=%s,hc=H();c.trans='gl_cube';D(t);await new Promise(r=>setTimeout(r,150));D(t);const cube=H();c.trans='none';return{none,circ,edge,cube:cube!==hc,ms:+ms.toFixed(1)}}""" % (PIX, DRAW, HASH), c0)
    res["glDraw"] = g
    chk("transition: the next clip shows through (circle open)", g["none"][0] > 120 and g["circ"][2] > 150 and g["circ"][0] < 80, g)
    chk("transition: the edge still shows this clip", g["edge"][0] > 120 and g["edge"][2] < 120, g)
    chk("transition: another one draws differently", g["cube"], g)
    # text motions from Animate.css
    await E("()=>{S.ed.tab='text';renderView()}"); await pg.wait_for_timeout(200)
    await E("()=>{const b=document.querySelector('#main [data-act=\"ed-addtext\"]');b&&b.click()}"); await pg.wait_for_timeout(300)
    tx = await E("()=>{const t=S.ed.texts.find(x=>x.id===S.ed.selText)||S.ed.texts[0];if(t){t.text='HELLO NOOI';t.start=1;t.end=4;S.ed.selText=t.id;S.ed.tab='text';persist();renderView()}return t&&{id:t.id,anim:t.anim}}")
    await pg.wait_for_timeout(250); nm = await E("()=>document.querySelectorAll('#main .tiles.ac131 .tile').length"); chk("20 text motions in the text tab", tx and nm == 20, [tx, nm])
    if tx and nm:
        await pg.locator('#main .tiles.ac131 [data-v="bounceIn"]').scroll_into_view_if_needed(); await pg.locator('#main .tiles.ac131 [data-v="bounceIn"]').tap(); await pg.wait_for_timeout(150)
        a = await E("()=>{const t=S.ed.texts.find(x=>x.id===S.ed.selText);return{anim:t.anim,playing:ED.playing,t:ED.t}}"); chk("tap a motion: the text has it and plays from its start", a["anim"] == "ac_bounceIn" and a["playing"], a)
        w = await E("""async()=>{const W=%s,D=%s,t=S.ed.texts.find(x=>x.id===S.ed.selText);S.ed.pick=null;const an=t.anim;D(1.03);const early=W();D(1.73);const late=W();t.anim='none';D(1.73);const plain=W();t.anim='ac_pulse';D(2.4);const loop=W();t.anim=an;return{early,late,plain,loop}}""" % (WHITE, DRAW))
        res["motion"] = w; chk("text motion: small and faint at first, whole at the end", w["plain"] > 200 and w["early"] < w["plain"] * .5 and abs(w["late"] - w["plain"]) < w["plain"] * .3, w)
        chk("text motion: a looping one draws", w["loop"] > w["plain"] * .5, w)
        tl = pg.locator(f'#tlin .blk[data-textl="{tx["id"]}"]')
        if await tl.count():
            pt = await spot(pg, f'#tlin .blk[data-textl="{tx["id"]}"]', 12); await touch(cdp, *pt, hold=750); await pg.wait_for_timeout(250)
            st = await E(SET171); res["longText"] = st; chk("long press on a text (v171): its settings", st["tab"] == "text" and st["pick"] == "text" and not st["menu"], st)
            await E(MENU171, f'#tlin .blk[data-textl="{tx["id"]}"]'); await pg.wait_for_timeout(200)
            it = await E("()=>[...document.querySelectorAll('.cm131 .cm131i')].map(x=>x.textContent.trim())"); res["menuText"] = it; chk("a text's menu: Edit, Duplicate, Delete", "Edit" in it and "Duplicate" in it and "Delete" in it, it)
            await E("()=>cmClose131()")
        else: chk("text on the timeline", False)
    # looks after CSSgram
    await E("(id)=>{edSetPick('clip',id);S.ed.tab='color';renderView()}", c0); await pg.wait_for_timeout(200)
    # (v151: the looks are tiles showing the clip itself in that look — no picker sheet)
    lk = await E("()=>{const b=document.querySelector('#main [data-act=\"edx-look\"][data-v=\"ember\"]'),c=b&&b.querySelector('canvas.lk151');return{n:document.querySelectorAll('#main [data-act=\"edx-look\"]').length,pic:!!c,filt:c?getComputedStyle(c).filter:'',desc:b?b.title:''}}")
    await pg.locator('#main [data-act="edx-look"][data-v="ember"]').scroll_into_view_if_needed(); await pg.locator('#main [data-act="edx-look"][data-v="ember"]').tap(); await pg.wait_for_timeout(300)
    lk["picked"] = await E("(id)=>(S.ed.clips.find(c=>c.id===id).cg||{}).look", c0)
    chk("15 more looks among the look tiles, each the clip's own picture in that look and what it does; a tap picks it", lk["n"] >= 26 and lk["pic"] and lk["filt"] not in ("", "none") and lk["desc"] and lk["picked"] == "ember", lk)
    l = await E("""async(id)=>{const P=%s,D=%s,c=S.ed.clips.find(x=>x.id===id);c.cg={look:'none'};D(3);await new Promise(r=>setTimeout(r,200));D(3);const a=P(.5,.5),e=P(.02,.02);c.cg={look:'ember'};D(3);const b=P(.5,.5),f=P(.02,.02);c.cg={look:'seabreeze'};D(3);const s=P(.5,.1);c.cg={};return{a,b,e,f,s}}""" % (PIX, DRAW), c0)
    res["looks"] = l; chk("a look colours the picture", sum(abs(x - y) for x, y in zip(l["a"], l["b"])) > 40 and l["b"] != l["f"], l)
    # banners and stickers with Material Symbols
    await E("()=>{S.ed.tab='info';S.ed.pick=null;renderView()}"); await pg.wait_for_function("IC131.d", timeout=8000); await E("()=>renderView()"); await pg.wait_for_timeout(200)
    g = await E("()=>({bn:document.querySelectorAll('#main .bn131t').length,st:document.querySelectorAll('#main .st131t').length,path:(document.querySelector('#main .bn131t svg path')||{getAttribute:()=>''}).getAttribute('d').length,label:[...document.querySelectorAll('#main .lbl')].map(x=>x.textContent).filter(x=>/Banners|Stickers/.test(x)),grp:document.querySelectorAll('#main [data-act=stg149]').length,all:ST131.length})")
    # (v149: the stickers come in groups — one group's tiles at a time, 36 and more in all)
    res["bnPanel"] = g; chk("10 banners and the stickers (in groups) in the Infographics tab, with their icons", g["bn"] == 10 and g["grp"] == 7 and g["st"] >= 6 and g["all"] >= 36 and g["path"] > 20 and len(g["label"]) == 2, g)
    await pg.locator('#main .bn131t[data-v="sub"]').tap(); await pg.wait_for_timeout(300)
    it = await E("()=>{const i=(S.ed.infos||[]).find(x=>x.type==='bn131');return i&&{id:i.id,t1:i.t1,t2:i.t2,st:i.st,pick:S.ed.pick,t2f:(document.querySelector('#main [data-ib=\"t2\"]')||{}).value,chips:document.querySelectorAll('#main [data-act=\"bn131-st\"]').length,icons:document.querySelectorAll('#main [data-act=\"ic131-set\"]').length}}")
    res["banner"] = it; chk("add a banner: picked, its words, style and icon to change", it and it["t1"] == "Subscribe" and it["pick"]["id"] == it["id"] and it["t2f"] == "New videos every week" and it["chips"] == 8 and it["icons"] >= 36, it)
    if it:
        await pg.locator('#main [data-act="bn131-st"][data-v="news"]').tap(); await pg.wait_for_timeout(200)
        await pg.locator('#main [data-act="ic131-set"][data-v="bolt"]').scroll_into_view_if_needed(); await pg.locator('#main [data-act="ic131-set"][data-v="bolt"]').tap(); await pg.wait_for_timeout(200)
        s = await E("(id)=>{const i=S.ed.infos.find(x=>x.id===id);return[i.st,i.ic]}", it["id"]); chk("banner style and icon change", s == ["news", "bolt"], s)
        dr = await E("""async(id)=>{const H=%s,D=%s,i=S.ed.infos.find(x=>x.id===id),out=[];S.ed.pick=null;const st0=i.st;i.start=0;i.end=6;
          for(const st of BNST131.map(x=>x[0])){i.st=st;D(2);const h=(ED.hit||[]).find(x=>x.k==='info'&&x.id===id);out.push([st,h?Math.round(h.w):0,H()])}i.end=-1;D(2);const none=H();i.end=6;i.st=st0;return{out,none}}""" % (HASH, DRAW), it["id"])
        res["bnStyles"] = dr; chk("every banner style draws (and can be picked on the picture)", all(w > 20 and h != dr["none"] for _, w, h in dr["out"]), dr)
        bl = pg.locator(f'#tlin .blk[data-ix="{it["id"]}"]')
        if await bl.count():
            pt = await spot(pg, f'#tlin .blk[data-ix="{it["id"]}"]', 12); await touch(cdp, *pt, hold=750); await pg.wait_for_timeout(250)
            st = await E(SET171); res["longBanner"] = st; chk("long press on a banner (v171): its settings", st["tab"] == "info" and st["pick"] == "info" and not st["menu"], st)
            await E(MENU171, f'#tlin .blk[data-ix="{it["id"]}"]'); await pg.wait_for_timeout(200)
            m2 = await E("()=>{const m=document.querySelector('.cm131');return m&&{title:(m.querySelector('.cm131h')||{}).textContent,items:[...m.querySelectorAll('.cm131i')].map(x=>x.textContent.trim())}}"); res["menuBanner"] = m2
            chk("a banner's menu", m2 and "Subscribe" in m2["title"] and "Edit" in m2["items"], m2); await E("()=>cmClose131()")
        else: chk("banner on the timeline", False)
    await E("()=>{S.ed.tab='info';S.ed.pick=null;renderView()}"); await pg.wait_for_timeout(150)
    await pg.locator('#main .st131t[data-v="favorite"]').first.scroll_into_view_if_needed(); await pg.locator('#main .st131t[data-v="favorite"]').first.tap(); await pg.wait_for_timeout(300)
    st = await E("""()=>{const i=(S.ed.infos||[]).find(x=>x.type==='st131');if(!i)return null;const cap=[...document.querySelectorAll('#main label.lbl')].map(x=>x.textContent).find(x=>/Caption/.test(x));
      S.ed.pick=null;i.start=0;i.end=6;ED.playing=false;ED.t=2;edTick(performance.now());const h=(ED.hit||[]).find(x=>x.k==='info'&&x.id===i.id);return{ic:i.ic,cap,w:h?Math.round(h.w):0,lane:[...document.querySelectorAll('#tlin .blk')].some(b=>b.textContent.trim()==='Sticker'||b.textContent.includes('Sticker'))}}""")
    res["sticker"] = st; chk("add a sticker: drawn, with an optional caption", st and st["ic"] == "favorite" and st["w"] > 20 and st["cap"], st)
    await pg.screenshot(path=D + "/banners.png")
    res["phoneErrs"] = errs[:5]; res["warns"] = warns[:5]; chk("phone: no page errors", not errs, errs[:3]); chk("phone: no drawing warnings", not warns, warns[:3])
    await ctx.close()

MENU171 = "(sel)=>{const b=document.querySelector(sel);if(!b)return false;const r=b.getBoundingClientRect();return menuAt131(b,r.left+r.width/2,r.top+r.height/2)}"
SET171 = "()=>({tab:S.ed.tab,pick:S.ed.pick&&S.ed.pick.k,aux:S.ed.aux143||null,menu:!!document.querySelector('.cm131'),closed:S.ed.pclosed143})"

async def arabic(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await setup(pg, "ar"); cdp = await ctx.new_cdp_session(pg)
    c0 = await E("()=>S.ed.clips[0].id")
    await E("(id)=>{edSetPick('clip',id);S.ed.tab='clip';renderView()}", c0); await pg.wait_for_timeout(300)
    bar = await E("""()=>[...document.querySelectorAll('#main .edbar .tb,#main .e-bar button')].filter(t=>t.offsetParent||getComputedStyle(t.closest('.e-bar')||t).position==='fixed').map(t=>{const s=t.querySelector('span')||t,r=document.createRange();r.selectNodeContents(s);const rs=[...r.getClientRects()].filter(x=>x.width>1).sort((a,b)=>a.top-b.top);let n=0,bot=-1e9;for(const x of rs){if(x.top>=bot-2){n++;bot=x.bottom}else bot=Math.max(bot,x.bottom)}return{t:s.textContent.trim(),lines:n}})""")
    chk("Arabic: tool row labels on one line", bar and all(x["lines"] == 1 for x in bar), bar)
    await E("()=>{S.ed.tab='info';renderView()}"); await pg.wait_for_function("IC131.d", timeout=8000)
    a = await E("""()=>{const i=bnAdd131('sale');const s=stAdd131('star');s.t1='جديد';S.ed.pick=null;i.start=s.start=0;i.end=s.end=6;ED.playing=false;ED.t=2;edTick(performance.now());
      return{t1:i.t1,hits:(ED.hit||[]).filter(x=>x.k==='info').length,lbl:[...document.querySelectorAll('#main .lbl')].map(x=>x.textContent).filter(x=>/البانرات|الملصقات/.test(x)).length}}""")
    await E("()=>renderView()"); await pg.wait_for_timeout(200)
    a["lbl"] = await E("()=>[...document.querySelectorAll('#main .lbl')].map(x=>x.textContent).filter(x=>/البانرات|الملصقات/.test(x)).length")
    res["arabic"] = a; chk("Arabic: banner words in Arabic, banner and sticker drawn, panel in Arabic", a["t1"] == "خصم 50%" and a["hits"] >= 2 and a["lbl"] == 2, a)
    await E("()=>{S.ed.tab='clip';ED.t=1;renderView()}"); await pg.wait_for_timeout(200)
    await E(MENU171, f'#tlin .blk[data-clip="{c0}"]'); await pg.wait_for_timeout(250)
    it = await E("()=>[...document.querySelectorAll('.cm131 .cm131i')].map(x=>x.textContent.trim())"); res["menuAr"] = it
    chk("Arabic: the clip menu in Arabic", any("قص" in x for x in it) and any("حذف" in x for x in it), it)
    await pg.screenshot(path=D + "/arabic.png")
    chk("Arabic: no page errors", not errs, errs[:3]); await ctx.close()

async def desktop(b):
    ctx = await b.new_context(viewport={"width": 1366, "height": 900}); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await setup(pg, "en"); c0 = await E("()=>S.ed.clips[0].id")
    # right click on a clip: a menu next to the pointer
    await E("()=>{ED.playing=false;renderView()}"); await pg.wait_for_timeout(200)
    bb = await box(pg, f'#tlin .blk[data-clip="{c0}"]'); x, y = bb["x"] + 30, bb["y"] + bb["height"] / 2
    await pg.mouse.click(x, y, button="right"); await pg.wait_for_timeout(200)
    m = await E("()=>{const m=document.querySelector('.cm131');if(!m)return null;const r=m.getBoundingClientRect();return{sheet:m.classList.contains('sheet'),x:r.left,y:r.top,w:r.width,h:r.height,n:m.querySelectorAll('.cm131i').length}}")
    res["rightClick"] = m; chk("right click on a clip: a menu by the pointer", m and not m["sheet"] and abs(m["x"] - x) < 260 and m["n"] >= 6, m)
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(100); chk("Escape closes the menu", not await E("()=>!!document.querySelector('.cm131')"))
    # a video you made: right click → open, download, edit, delete
    await E("()=>{S.jobs=S.jobs||[];S.jobs.unshift({id:'jv131',kind:'video',status:'complete',resultUrl:'/media/a.webm',prompt:'A street at dawn',created:Date.now(),model:'seedance2mini',dur:5,aspect:'16:9'});go('video');renderAll()}"); await pg.wait_for_timeout(800)
    card = pg.locator('.gc98[data-open98="jv131"]').first
    if await card.count():
        await card.scroll_into_view_if_needed(); cb = await card.bounding_box(); await pg.mouse.click(cb["x"] + cb["width"] / 2, cb["y"] + cb["height"] / 2, button="right"); await pg.wait_for_timeout(250)
        it = await E("()=>[...document.querySelectorAll('.cm131 .cm131i')].map(x=>x.textContent.trim())"); res["menuCard"] = it
        chk("right click on a video you made: Open, Download, Edit in the editor, Extend… (v132), Voices & sound… (v134), Edit with words…, Merge videos… (v135), Delete", it[:8] == ["Open", "Download", "Edit in the editor", "Extend…", "Voices & sound…", "Edit with words…", "Merge videos…", "Delete"], it)
        await pg.keyboard.press("Escape")
    else: chk("a made video on the Video page", False, await E("()=>document.querySelectorAll('.gc98').length"))
    # Grok Imagine 1.5 only with a picture
    g = await E("""()=>{const has=h=>/data-val="grok15"/.test(h);M.vStart=null;S.draft.startJob=null;if(S.draft.model==='grok15')S.draft.model='auto';const a=has(VIEWS.video());
      M.vStart={type:'image',url:'/media/x.png',name:'x.png'};const b=has(VIEWS.video());M.vStart=null;const cin=VIEWS.cinema?/value="grok15"/.test(VIEWS.cinema()):false;return{noPic:a,withPic:b,cin,allowed:modelAllowed('grok15')}}""")
    res["grokVideo"] = g; chk("Video page: Grok only with a picture", g["allowed"] and not g["noPic"] and g["withPic"], g); chk("Cinema Studio (words only): no Grok", not g["cin"], g)
    await E("()=>{M.hfRef=null;S.hf=S.hf||{};S.hf.tab='video';if(S.hf.vModel==='grok15')S.hf.vModel='auto';go('home');renderAll()}"); await pg.wait_for_timeout(500)
    h = {}
    for k, setref in [("noPic", "M.hfRef=null"), ("withPic", "M.hfRef={url:'/media/x.png',remote:'/media/x.png',name:'x.png'}"), ("video", "M.hfRef={url:'/media/a.webm',remote:'/media/a.webm',name:'a.webm',type:'video'}")]:
        h[k] = await E("()=>{%s;document.querySelectorAll('.hfsheet').forEach(x=>x.closest('.sheet-wrap,.modal,.ovl')?.remove());hfModelSheet();const s=document.querySelectorAll('.hfsheet .hfmodel');const r={n:s.length,grok:!!document.querySelector('.hfsheet .hfmodel[data-v=\"grok15\"]')};document.querySelectorAll('.hfsheet').forEach(x=>{const w=x.closest('[class*=sheet],[class*=modal]')||x;w.remove()});return r}" % setref)
    res["grokHome"] = h; chk("home engine list: Grok only with a picture (not with a video)", h["noPic"]["n"] > 3 and not h["noPic"]["grok"] and h["withPic"]["grok"] and not h["video"]["grok"], h)
    chk("desktop: no page errors", not errs, errs[:3]); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        for f in (phone, arabic, desktop):
            try: await f(b)
            except Exception as e: fails.append(f.__name__ + " crashed: " + str(e)[:300])
        await b.close()
try:
    for _ in range(80):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
        except Exception: time.sleep(.25)
    server_side()
    asyncio.run(main())
finally: srv.kill()
res["shots"] = D
print(json.dumps({"fails": fails, "res": res}, ensure_ascii=False, indent=1))
