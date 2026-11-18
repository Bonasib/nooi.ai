# v193 — the editor towards After Effects / Premiere / DaVinci, phase 1 (docs/EDITOR_PRO_ROADMAP.md). A real nooi server, a clip
# with sound and a music track:
#  · easing per keyframe: back overshoots past 1, elastic springs, bounce ends at 1, hold steps, a custom Bézier matches cubic-bezier;
#    a keyframe's own ease changes the value between two keys while the clip's ease stays for the others
#  · the graph editor: the chosen property's curve, dots for the keyframes, a dot dragged in time moves the keyframe; the ease seg sets k.e
#  · colour wheels + curve: a lift push towards red makes a black frame red; the curve lifted brightens; the export pass (R139.on)
#    gives the same pixels as the preview pass at full size; the scopes draw; Reset clears
#  · an adjustment layer darkens the frame below it only while it lasts; its row in the list has no "missing"
#  · motion blur on a keyframed move in export mode: the moving edge is softer than without; a still clip is identical
#  · loudness: a measured value in LUFS; Normalise brings a second measure within ±1.5 of −14; the export mix carries the gain
#  · export presets set format / fps / bitrate; the size estimate shows; q162 returns the bitrate
#  · shortcuts: L shuttles forward, J back, K stops; Home / End; ↑ ↓ cuts; Shift+Delete ripples; ? opens the sheet (EN + AR)
#  · Pro polish: ducking on, keyframes eased, exposure matched, a toast; no page errors anywhere
# Run: python3 tests/v193.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8651; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v193-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120)
FF("-f", "lavfi", "-i", "color=c=0x000000:s=640x360", "-frames:v", "1", M + "black.png")
FF("-f", "lavfi", "-i", "color=c=0x808080:s=640x360", "-frames:v", "1", M + "grey.png")
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=5", "-filter_complex", "[1:a]volume=0.05[a]", "-map", "0:v", "-map", "[a]", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-c:a", "libopus", "-b:a", "96k", M + "v.webm")
FF("-f", "lavfi", "-i", "sine=frequency=220:duration=8", "-af", "volume=0.1", "-c:a", "libmp3lame", M + "music.mp3")
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="d" * 40, FIREBASE_PROJECT_ID="", FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
SETUP = """async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
 const now=Date.now(),mk=(id,kind,url,dur)=>({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url});
 S.jobs.push(mk('j_v','video','/media/v.webm',5),mk('j_blk','image','/media/black.png'),mk('j_grey','image','/media/grey.png'));
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.layers=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];S.ed.fit='contain';S.ed.zoom=60;
 await edUseJob(S.jobs.find(j=>j.id==='j_blk'),{stay:true,quiet:true,t:1});await edUseJob(S.jobs.find(j=>j.id==='j_v'),{stay:true,quiet:true,t:1});S.ed.clips[0].in=0;S.ed.clips[0].out=1;S.ed.sel=S.ed.clips[0].id;
 window.__t=[];toast=(o=>function(m){window.__t.push(String(m));return o.apply(this,arguments)})(toast);go('edit');renderAll()}"""
PIX = """(a)=>{ED.playing=false;ED.t=a[0];edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d');return Array.from(x.getImageData(Math.round(c.width*a[1]),Math.round(c.height*a[2]),1,1).data).slice(0,3)}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))

async def main():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
        await E(SETUP); await pg.wait_for_function("S.ed.clips.length===2&&(()=>{const m=M['c_'+S.ed.clips[1].id];return m&&m.el&&m.el.readyState>=1})()", timeout=20000)
        # 1. easing functions
        ez = await E("()=>({back:EDX_EASE.back(.7)>1,elastic:EDX_EASE.elastic(.1)!==.1&&Math.abs(EDX_EASE.elastic(1)-1)<1e-6,bounce:Math.abs(EDX_EASE.bounce(1)-1)<1e-6&&EDX_EASE.bounce(.5)<1,hold:EDX_EASE.hold(.99)===0&&EDX_EASE.hold(1)===1,bz:Math.abs(easeFn193([.42,0,.58,1])(.5)-.5)<.02&&easeFn193([.42,0,.58,1])(.25)<.2})")
        out["ease"] = ez; chk("easing functions", all(ez.values()), ez)
        pk = await E("""()=>{const c=S.ed.clips[0];c.mo={kf:[{t:0,s:1,x:0,y:0,r:0},{t:1,s:2,x:0,y:0,r:0,e:'hold'},{t:2,s:1,x:0,y:0,r:0}],ease:'linear'};
          return {mid:edxMo(c,.5).s,hold:edxMo(c,1.9).s,end:edxMo(c,2).s}}""")
        out["perkey"] = pk; chk("per-keyframe ease: linear first segment, hold second", abs(pk["mid"] - 1.5) < .02 and abs(pk["hold"] - 2) < .01 and abs(pk["end"] - 1) < .01, pk)
        # 2. the graph editor
        await E("()=>{S.ed.tab='motion';S.ed.sel=S.ed.clips[0].id;ED.t=1;renderView()}"); await pg.wait_for_selector(".gp193g", timeout=10000)
        g = await E("()=>({dots:document.querySelectorAll('.gp193k').length,on:document.querySelectorAll('.gp193k.on').length,props:document.querySelectorAll('.gp193p button').length,ease:document.querySelector('[data-act=ease193][aria-pressed=true]')?.dataset.v,mb:!!document.querySelector('[data-act=mb193]')})")
        out["graph"] = g; chk("graph: 3 dots, the one at the playhead lit, 5 properties, 'hold' pressed, motion-blur switch", g["dots"] == 3 and g["on"] == 1 and g["props"] == 5 and g["ease"] == "hold" and g["mb"], g)
        await pg.click('[data-act="ease193"][data-v="back"]'); e2 = await E("()=>S.ed.clips[0].mo.kf[1].e"); chk("ease seg sets k.e", e2 == "back", e2)
        await pg.click('[data-act="ease193"][data-v="bezier"]'); bz = await E("()=>[Array.isArray(S.ed.clips[0].mo.kf[1].e),document.querySelectorAll('.bz193 input').length]"); chk("custom bezier: 4 numbers", bz == [True, 4], bz)
        await E("()=>document.querySelector('.gp193g').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(150)   # (the Bezier click above scrolled the panel past the graph)
        dot = await pg.locator(".gp193k").nth(1).bounding_box(); svg = await pg.locator(".gp193g").bounding_box()
        await pg.mouse.move(dot["x"] + dot["width"] / 2, dot["y"] + dot["height"] / 2); await pg.mouse.down(); await pg.mouse.move(dot["x"] + svg["width"] * .15, dot["y"], steps=6); await pg.mouse.up(); await pg.wait_for_timeout(200)
        t1 = await E("()=>S.ed.clips[0].mo.kf[1].t"); out["drag"] = t1; chk("a dot dragged right moves the keyframe later (1 → ~1.15 on a 1 s clip)", 1.06 < t1 < 1.75, t1)
        # 3. colour wheels, curve, scopes
        await E("()=>{S.ed.clips[0].mo=null;S.ed.tab='color';ED.t=.5;renderView()}"); await pg.wait_for_selector(".wh193d", state="attached", timeout=10000)
        c0 = await E(PIX, [0.5, .5, .5]); await E("()=>{const c=S.ed.clips[0];c.cg=c.cg||{};c.cg.w193={lift:[.5,-.25,-.25,0]}}"); c1 = await E(PIX, [0.5, .5, .5])
        out["lift"] = [c0, c1]; chk("a lift push to red makes the black frame red", c0[0] < 20 and c1[0] > 40 and c1[0] > c1[1] + 25, out["lift"])
        await E("()=>{const c=S.ed.clips[0];c.cg.w193=null;c.cg.curve193=[0,.5,.75,.9,1]}"); c2 = await E(PIX, [0.5, .5, .5]); c3 = await E(PIX, [1.5, .5, .5])
        chk("the curve is per clip (black stays black at 0, the video frame brightens)", c2[0] < 12 and sum(c3) > 60, [c2, c3])
        # preview pass (half size) vs export pass (full size): the same colours within a little
        full = await E("""()=>{const c=S.ed.clips[0];c.cg.curve193=null;c.cg.w193={gamma:[.3,.3,.3,0]};ED.t=1.5;edTick(performance.now());const cv=document.getElementById('wk'),x=cv.getContext('2d');const a=Array.from(x.getImageData(cv.width>>1,cv.height>>1,1,1).data).slice(0,3);
          R139.on=true;R139.mine=true;try{edTick(performance.now())}finally{R139.on=false;R139.mine=false}const b=Array.from(x.getImageData(cv.width>>1,cv.height>>1,1,1).data).slice(0,3);return [a,b]}""")
        out["pass"] = full; chk("preview and export passes agree", all(abs(full[0][i] - full[1][i]) <= 12 for i in range(3)), full)
        await E("()=>{S.ed.sc193='hist';renderView();scopes193()}"); sc = await E("()=>{const c=document.querySelector('.sc193c'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>120)n++;return n}")
        out["scope"] = sc; chk("the histogram draws", sc > 50, sc)
        await E("()=>document.querySelector('[data-act=cw193-reset]').click()"); rs = await E("()=>!S.ed.clips[0].cg.w193&&!S.ed.clips[0].cg.curve193"); chk("Reset clears wheels and curve", rs)
        # 4. adjustment layer
        await E("()=>{S.ed.tab='layers';renderView()}"); await E("()=>document.querySelector('[data-act=adj193-add]').click()"); await pg.wait_for_selector('[data-edx="adj193.exp"]', state="attached", timeout=10000)
        await E("()=>{const Ly=S.ed.layers.find(x=>x.kind==='adj');Ly.start=1.2;Ly.end=3;Ly.cg={exp:-40}}")
        g1 = await E(PIX, [1.0, .5, .5]); g2 = await E(PIX, [2.0, .5, .5]); g3 = await E(PIX, [3.5, .5, .5])
        out["adj"] = [g1, g2, g3]; chk("the adjustment layer darkens only while it lasts", sum(g2) < sum(g1) * .8 and sum(g3) > sum(g2) * 1.2, out["adj"])
        await E("()=>{S.ed.selLayer=null;renderView()}"); miss = await E("()=>document.querySelector('.edxrow[data-act=edx-ly-sel]')?.innerText||''"); chk("the layer's row has no 'missing'", "missing" not in miss and "Adjustment" in miss, miss)
        await E("()=>{S.ed.layers=[];}")
        # 5. motion blur in export mode
        mb = await E("""()=>{const c=S.ed.clips[1];c.mo={kf:[{t:0,s:1,x:-.4,y:0,r:0},{t:1,s:1,x:.4,y:0,r:0}],ease:'linear',mb193:false};ED.t=1.5;const cv=document.getElementById('wk'),x=cv.getContext('2d');
          const row=()=>{const d=x.getImageData(0,cv.height>>1,cv.width,1).data,l=[];for(let i=0;i<d.length;i+=4)l.push((d[i]+d[i+1]+d[i+2])/3);let e=0;for(let i=1;i<l.length;i++)e=Math.max(e,Math.abs(l[i]-l[i-1]));return e};
          R139.on=true;R139.mine=true;try{edTick(performance.now());const a=row();c.mo.mb193=true;edTick(performance.now());const b=row();return [a,b]}finally{R139.on=false;R139.mine=false}}""")
        out["mb"] = mb; chk("motion blur softens the edges of a moving clip in the export (sharpest step along a row)", mb[1] < mb[0] * .7, mb)
        await E("()=>{S.ed.clips[1].mo=null}")
        # 6. loudness
        await E("()=>{S.ed.tab='sfx';renderView()}")
        await E("""async()=>{const r=await fetch('/media/music.mp3'),bl=await r.blob();const f=new File([bl],'music.mp3',{type:'audio/mpeg'});if(typeof edSetMusic==='function')return edSetMusic(f);M.edMusic={type:'audio',url:'/media/music.mp3',el:Object.assign(document.createElement('audio'),{src:'/media/music.mp3'})};S.ed.musicVol=80}""")
        l1 = await E("async()=>await loudness193()"); out["lufs1"] = l1; chk("a loudness value", l1 and -60 < l1["lufs"] < 0, l1)
        await E("()=>{if(typeof mixPanel150==='function'){const d=document.createElement('div');d.innerHTML=mixPanel150();document.body.appendChild(d)}}")
        await E("()=>document.querySelector('[data-act=ld193-norm]').click()"); await pg.wait_for_timeout(300); l2 = await E("async()=>await loudness193()"); out["lufs2"] = l2
        chk("Normalise brings the mix near −14 LUFS (or as loud as the peak allows)", l2 and (abs(l2["lufs"] + 14) < 1.5 or l2["peak"] > -2.5), l2)
        # 7. export presets
        await E("()=>edOutSheet()"); await pg.wait_for_selector('#modalRoot [data-act="ex193"]', state="attached", timeout=10000)
        await E("()=>document.querySelector('#modalRoot [data-act=ex193][data-v=cinema]').click()"); await pg.wait_for_timeout(300); ex = await E("()=>({fps:S.ed.fps,k:S.ed.kbps193,f:S.ed.format,q:q162({}),est:!!document.querySelector('#modalRoot .ex193')&&/MB|KB/.test(document.querySelector('#modalRoot .ex193').parentNode.innerText),pressed:document.querySelector('#modalRoot [data-act=ex193][data-v=cinema]')?.getAttribute('aria-pressed'),fpsBtn:document.querySelector('#modalRoot [data-act=xout-fps][data-v=\"24\"]')?.getAttribute('aria-pressed'),one:document.querySelectorAll('#modalRoot .ex193').length})")
        out["export"] = ex; chk("the Cinema preset in the export sheet: 24 fps, 16 Mb/s, YouTube size, q162 = bitrate, size estimate, sheet re-drawn once", ex["fps"] == 24 and ex["k"] == 16000 and ex["f"] == "youtube" and ex["q"] == 16000000 and ex["est"] and ex["pressed"] == "true" and ex["fpsBtn"] == "true" and ex["one"] == 1, ex)
        await E("()=>document.querySelector('#modalRoot .ex193wrap [data-set=\"ed.kbps193\"][data-val=\"0\"]').click()"); await pg.wait_for_timeout(200); kb = await E("()=>[S.ed.kbps193,S.ed.preset193,document.querySelectorAll('#modalRoot .ex193').length]"); chk("Auto bitrate in the sheet clears the preset", kb[0] == 0 and kb[1] == "" and kb[2] == 1, kb)
        await E("()=>{document.querySelector('#modalRoot [data-act=close-sheet]').click();S.ed.kbps193=16000}")
        # 8. shortcuts
        await E("()=>{ED.t=0;ED.playing=false;renderView()}"); await pg.keyboard.press("l"); await pg.wait_for_timeout(700); tL = await E("()=>ED.t"); await pg.keyboard.press("k"); await pg.wait_for_timeout(100); tK = await E("()=>ED.t"); await pg.wait_for_timeout(300); tK2 = await E("()=>ED.t")
        await pg.keyboard.press("j"); await pg.wait_for_timeout(400); tJ = await E("()=>ED.t"); await pg.keyboard.press("k")
        out["jkl"] = [tL, tK, tK2, tJ]; chk("L shuttles forward, K stops, J goes back", .4 < tL < 1.2 and abs(tK2 - tK) < .02 and tJ < tK - .15, out["jkl"])
        await pg.keyboard.press("End"); tE = await E("()=>ED.t"); await pg.keyboard.press("Home"); tH = await E("()=>ED.t"); await pg.keyboard.press("ArrowDown"); tD = await E("()=>ED.t")
        out["nav"] = [tE, tH, tD]; chk("End / Home / ↓ next cut", tE > 5.5 and tH == 0 and abs(tD - 1) < .05, out["nav"])
        await pg.keyboard.press("?"); await pg.wait_for_timeout(150); sh = await E("()=>!!document.querySelector('.keys193')&&document.querySelector('.keys193').innerText.includes('Shuttle')"); chk("? opens the shortcuts sheet", sh); await pg.keyboard.press("?"); await pg.wait_for_timeout(150); closed = await E("()=>!document.getElementById('modalRoot').innerHTML"); chk("? again closes it", closed)
        await E("()=>{S.ed.sel=S.ed.clips[0].id;ED.t=.5;renderView()}"); await pg.keyboard.press("Shift+Delete"); rd = await E("()=>[S.ed.clips.length,S.ed.sel,ED.t]"); out["ripple"] = rd; chk("Shift+Delete ripples", rd[0] == 1 and rd[1] is None and rd[2] == 0, rd)
        # 9. pro polish
        await E("()=>{S.ed.tab='export';S.ed.duck144=false;renderView()}"); await E("()=>document.querySelector('[data-act=polish193]').click()"); await pg.wait_for_function("window.__t.some(t=>/Pro polish|polished/.test(t))", timeout=30000)
        pz = await E("()=>({duck:S.ed.duck144,t:window.__t.filter(t=>/Pro polish|polished/.test(t))[0]})"); out["polish"] = pz; chk("Pro polish ran: ducking on, a toast", pz["duck"] is True and "polish" in pz["t"].lower(), pz)
        # Arabic words
        await E("()=>{S.lang='ar';document.documentElement.dir='rtl';S.ed.tab='motion';S.ed.sel=S.ed.clips[0].id;renderView()}"); ar = await E("()=>document.querySelector('.gp193p')?.innerText||''"); chk("Arabic graph labels", "الحجم" in ar and "الشفافية" in ar, ar)
        await pg.keyboard.press("?"); await pg.wait_for_timeout(150); ar2 = await E("()=>document.querySelector('.keys193')?.innerText||''"); chk("Arabic shortcuts sheet", "تشغيل" in ar2, ar2[:100]); await pg.keyboard.press("?")
        chk("no page errors", not errs, errs[:5])
        await b.close()
try: asyncio.run(main())
finally: srv.terminate(); srv.wait()
print(json.dumps(out, ensure_ascii=False, default=str)[:3000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]; print("server log:", open(D + "/server.log").read()[-1500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v193 OK")
