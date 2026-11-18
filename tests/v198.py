# v198 — the editor towards After Effects / Premiere / DaVinci, phase 4 (docs/EDITOR_PRO_ROADMAP.md gaps 16–19). A real nooi server,
# a grey picture, a white square, three plain-colour clips (red / blue / green, 2 s each):
#  · keyframes on every slider: a layer's size keyframed 20 → 60 % draws at 40 % half-way (preview and an export frame); the stopwatch
#    beside the opacity slider adds a key, a slider change at another moment adds the second, the value eases between; the keyframe
#    sheet lists them, changes an easing and removes one
#  · editing by the transcript: twelve caption words over three clips; two words tapped show "Remove 2 words"; the removal cuts the blue
#    clip (its in point moves), a later text and the later words close the gap, the total shortens by 1 s; filler words go in one tap
#  · playback quality: ½ and ¼ halve and quarter the preview canvas; Full restores it
#  · missing files: a clip whose file is gone is listed; a file chosen in the sheet relinks it
# Run: python3 tests/v198.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8657; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v198-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120)
for name, col in (("red", "0xff0000"), ("blue", "0x0000ff"), ("green", "0x00ff00")):
    FF("-f", "lavfi", "-i", f"color=c={col}:s=640x360:rate=30:duration=2", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "300k", "-an", M + name + ".webm")
FF("-f", "lavfi", "-i", "color=c=0x808080:s=640x360", "-frames:v", "1", M + "grey.png")
FF("-f", "lavfi", "-i", "color=c=white:s=256x256", "-frames:v", "1", M + "white.png")
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", AGENTS_AUTO_LEARN="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
near = lambda a, b, tol=30: all(abs(a[i] - b[i]) <= tol for i in range(3))
SETUP = """async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
 const now=Date.now(),mk=(id,kind,url,dur)=>({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url});
 S.jobs.push(mk('j_red','video','/media/red.webm',2),mk('j_blue','video','/media/blue.webm',2),mk('j_green','video','/media/green.webm',2),mk('j_grey','image','/media/grey.png'),mk('j_white','image','/media/white.png'));
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.layers=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];S.ed.fit='contain';S.ed.zoom=60;
 await edUseJob(S.jobs.find(j=>j.id==='j_grey'),{stay:true,quiet:true,t:3});S.ed.clips[0].in=0;S.ed.clips[0].out=3;S.ed.sel=S.ed.clips[0].id;
 const Ly={id:'w1',name:'w',start:0,end:3,x:.5,y:.5,sc:30,rot:0,op:100,key:'none',anim:'none',shape:'none',blend:'source-over'};slotUrl139('ly_w1',{url:'/media/white.png',type:'image',name:'w'});S.ed.layers.push(Ly);S.ed.selLayer='w1';
 window.__t=[];toast=(o=>function(m){window.__t.push(String(m));return o.apply(this,arguments)})(toast);go('edit');renderAll()}"""
PIX = """(a)=>{ED.playing=false;ED.t=a[0];edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d');return Array.from(x.getImageData(Math.round(c.width*a[1]),Math.round(c.height*a[2]),1,1).data).slice(0,3)}"""
BBOX = """(t)=>{ED.playing=false;ED.t=t;edTick(performance.now());edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d'),W=c.width,H=c.height,d=x.getImageData(0,0,W,H).data;let x0=W,x1=-1,y0=H,y1=-1;
 for(let y=0;y<H;y+=2)for(let X=0;X<W;X+=2){const i=(y*W+X)*4;if(d[i]>235&&d[i+1]>235&&d[i+2]>235){if(X<x0)x0=X;if(X>x1)x1=X;if(y<y0)y0=y;if(y>y1)y1=y}}return x1<0?null:{x0,x1,y0,y1,w:x1-x0,h:y1-y0,W,H}}"""

async def main():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
        await E(SETUP); await pg.wait_for_function("()=>{const m=M['c_'+S.ed.clips[0].id],l=M['ly_w1'];return m&&m.el&&m.el.complete&&l&&l.el&&l.el.complete&&l.el.naturalWidth>0}", timeout=20000)
        # ---- 18. playback quality
        w1 = await E("()=>{S.ed.pq198=1;edTick(performance.now());return document.getElementById('wk').width}"); w2 = await E("()=>{S.ed.pq198=2;edTick(performance.now());return document.getElementById('wk').width}"); w4 = await E("()=>{S.ed.pq198=4;edTick(performance.now());return document.getElementById('wk').width}")
        await E("()=>{S.ed.pq198=1;edTick(performance.now())}"); out["pq"] = [w1, w2, w4]
        chk("playback quality: Full / ½ / ¼ draw the preview at 1080 / 540 / 270 on the long side", w1 == 1080 and w2 == 540 and w4 == 270, out["pq"])
        # ---- 16. keyframes on every slider
        b0 = await E(BBOX, 0.5); await E("()=>{kfSet198('ly:w1|sc',0,20,'linear');kfSet198('ly:w1|sc',2,60,'linear')}")
        b1 = await E(BBOX, 1.0); b2 = await E(BBOX, 2.5); out["kf"] = [b0 and b0["w"], b1 and b1["w"], b2 and b2["w"], b0 and b0["W"]]
        chk("a layer's size keyframed 20 → 60 % over 2 s (linear) draws at 40 % half-way and 60 % after the last key", bool(b1) and bool(b2) and abs(b1["w"] - b1["W"] * .4) < b1["W"] * .025 and abs(b2["w"] - b2["W"] * .6) < b2["W"] * .025, out["kf"])
        ex = await E("()=>{R139.on=true;R139.mine=true;ED.t=1;try{edTick(performance.now())}finally{R139.on=false;R139.mine=false}const c=document.getElementById('wk'),x=c.getContext('2d'),W=c.width,H=c.height,d=x.getImageData(0,Math.round(H/2),W,1).data;let x0=W,x1=-1;for(let X=0;X<W;X++){const i=X*4;if(d[i]>235&&d[i+1]>235&&d[i+2]>235){if(X<x0)x0=X;if(X>x1)x1=X}}return {w:x1-x0,W}}")
        out["kfex"] = ex; chk("an export frame at 1 s reads the same keyframed size (40 %)", abs(ex["w"] - ex["W"] * .4) < ex["W"] * .03, ex)
        await E("()=>{S.ed.tab='layers';ED.t=.5;renderView()}"); await pg.wait_for_selector('.kf198[data-kf198="ly:w1|op"]', state="attached", timeout=10000)
        btns = await E("()=>({n:document.querySelectorAll('.kf198').length,sc:document.querySelector('.kf198[data-kf198=\"ly:w1|sc\"]')?.dataset.n,scOn:document.querySelector('.kf198[data-kf198=\"ly:w1|sc\"]')?.classList.contains('on'),startBtn:!!document.querySelector('.kf198[data-kf198=\"ly:w1|start\"]')})")
        await E("()=>document.querySelector('.kf198[data-kf198=\"ly:w1|op\"]').click()"); await pg.wait_for_timeout(150)
        k1 = await E("()=>kfKeys198('ly:w1|op').map(k=>[k.t,k.v])")
        await E("()=>{ED.t=2.5;edTick(performance.now());const i=document.querySelector('input[data-edx=\"ly.op\"]');i.value=20;i.dispatchEvent(new Event('input',{bubbles:true}))}"); await pg.wait_for_timeout(400)
        k2 = await E("()=>kfKeys198('ly:w1|op').map(k=>[k.t,k.v,k.ez])"); mid = await E(PIX, [1.5, .5, .5]); out["stopwatch"] = [btns, k1, k2, mid]
        chk("the stopwatch beside Opacity adds a key (100 at 0.5 s); the slider moved to 20 at 2.5 s adds the second; at 1.5 s the layer is about 60 % white over grey; no stopwatch on From / To", btns["n"] >= 4 and btns["sc"] == "2" and btns["scOn"] and not btns["startBtn"] and k1 == [[.5, 100]] and len(k2) == 2 and k2[1][0] == 2.5 and k2[1][1] == 20 and 190 <= mid[0] <= 218, out["stopwatch"])
        await E("()=>kfSheet198('ly:w1|op')"); await pg.wait_for_selector("[data-kf198ez]", timeout=5000)
        rows = await E("()=>document.querySelectorAll('[data-kf198ez]').length"); await E("()=>{const s=document.querySelector('[data-kf198ez]');s.value='hold';s.dispatchEvent(new Event('change',{bubbles:true}))}"); await pg.wait_for_timeout(100)
        held = await E(PIX, [1.5, .5, .5]); await E("()=>document.querySelector('[data-act=kf198-del]').click()"); await pg.wait_for_timeout(150)
        left = await E("()=>kfKeys198('ly:w1|op').length"); out["sheet"] = [rows, held, left]
        chk("the keyframe sheet lists both keys; Hold on the first keeps the layer fully white until the second; removing one leaves one", rows == 2 and held[0] > 245 and left == 1, out["sheet"])
        await E("()=>{closeSheet();delete S.ed.kf198;S.ed.layers[0].op=100;S.ed.layers[0].sc=30}")
        # ---- 17. editing by the transcript
        await E("""async()=>{S.ed.clips=[];S.ed.layers=[];S.ed.texts=[];for(const id of ['j_red','j_blue','j_green'])await edUseJob(S.jobs.find(j=>j.id===id),{stay:true,quiet:true,t:1});S.ed.clips.forEach(c=>{c.in=0;c.out=2;c.speed=1;c.trans='cut'});
          S.ed.caps.words=Array.from({length:12},(_,i)=>({s:i*.5,e:i*.5+.5,w:i===4?'um':'w'+i}));S.ed.caps.on=false;S.ed.texts.push({id:'tt',text:'late',start:3.5,end:4.5,pos:'bottom',style:'caption',size:5,anim:'none'});S.ed.marks146=[{id:'m1',t:4.2,n:'x'}];S.ed.sel=S.ed.clips[0].id;S.ed.tab='words';renderView()}""")
        await pg.wait_for_function("()=>S.ed.clips.length===3&&S.ed.clips.every(c=>{const m=M['c_'+c.id];return m&&m.el&&m.el.readyState>=2})&&document.querySelectorAll('.tx198w').length===12", timeout=30000)
        before = await E("()=>({total:edTotal(),fill:document.querySelectorAll('.tx198w.fill').length,rm:document.querySelector('[data-act=tx198-rm]').disabled})")
        await E("()=>document.querySelector('.tx198w[data-tx198=\"4\"]').click()"); await pg.wait_for_timeout(150); await E("()=>document.querySelector('.tx198w[data-tx198=\"5\"]').click()"); await pg.wait_for_timeout(150)
        sel = await E("()=>({n:TX198.sel.size,label:document.querySelector('[data-act=tx198-rm]').textContent,t:ED.t,pressed:document.querySelectorAll('.tx198w[aria-pressed=true]').length})")
        await E("()=>document.querySelector('[data-act=tx198-rm]').click()"); await pg.wait_for_timeout(300)
        after = await E("()=>({total:edTotal(),clips:S.ed.clips.map(c=>[c.in,c.out]),text:S.ed.texts[0]&&[S.ed.texts[0].start,S.ed.texts[0].end],words:S.ed.caps.words.length,w4:S.ed.caps.words[4]&&[S.ed.caps.words[4].s,S.ed.caps.words[4].w],mark:S.ed.marks146[0]&&S.ed.marks146[0].t,toast:(window.__t||[]).slice(-1)[0]})")
        c25 = await E(PIX, [2.5, .5, .5]); await pg.wait_for_timeout(300); c25 = await E(PIX, [2.5, .5, .5]); c35 = await E(PIX, [3.5, .5, .5]); await pg.wait_for_timeout(300); c35 = await E(PIX, [3.5, .5, .5])
        out["tx"] = [before, sel, after, c25, c35]
        chk("the transcript: 12 words, the filler marked; two tapped → the button says Remove 2 words and the playhead jumps to the word; the removal takes 2.0–3.0 s out: the blue clip starts 1 s in, the total is 5 s, the later text, marker and words move back 1 s; blue still shows at 2.5 s and green at 3.5 s",
            abs(before["total"] - 6) < .05 and before["fill"] == 1 and before["rm"] and sel["n"] == 2 and "2" in sel["label"] and abs(sel["t"] - 2.5) < .1 and sel["pressed"] == 2 and abs(after["total"] - 5) < .05 and len(after["clips"]) == 3 and abs(after["clips"][1][0] - 1.0) < .02 and after["text"] and abs(after["text"][0] - 2.5) < .02 and after["words"] == 10 and after["w4"] and abs(after["w4"][0] - 2.0) < .02 and after["w4"][1] == "w6" and abs(after["mark"] - 3.2) < .02 and near(c25, [0, 0, 255]) and near(c35, [0, 255, 0]), out["tx"])
        await E("()=>{S.ed.caps.words=[{s:0.2,e:0.6,w:'hi'},{s:0.7,e:1.0,w:'um'},{s:1.1,e:1.6,w:'there'},{s:1.7,e:1.9,w:'آآ'},{s:2.0,e:2.4,w:'ok'}];renderView()}"); await pg.wait_for_selector("[data-act=tx198-fill]:not([disabled])", timeout=5000)
        t0 = await E("()=>edTotal()"); await E("()=>document.querySelector('[data-act=tx198-fill]').click()"); await pg.wait_for_timeout(300)
        t1 = await E("()=>({total:edTotal(),words:S.ed.caps.words.map(w=>w.w)})"); out["fill"] = [t0, t1]
        chk("filler words (um, آآ) go in one tap: the two ranges (0.7–1.1 and 1.7–2.0) shorten the edit by about 0.7 s and leave three words", abs((t0 - t1["total"]) - .7) < .08 and t1["words"] == ["hi", "there", "ok"], out["fill"])
        # ---- 19. missing files
        await E("()=>{S.ed.clips.push({id:'miss',src:{k:'upload',name:'gone.mp4'},in:0,out:2,speed:1,trans:'cut',vol:100});S.ed.tab='media';renderView()}"); await pg.wait_for_timeout(200)
        mi = await E("()=>({n:missing198().length,name:missing198()[0]&&missing198()[0].name,btn:!!document.querySelector('[data-act=rl198]')})")
        await E("()=>rlSheet198()"); await pg.wait_for_selector("[data-rl198]", timeout=5000)
        await pg.set_input_files("[data-rl198]", M + "white.png"); await pg.wait_for_function("()=>{const m=M['c_miss'];return m&&m.type==='image'&&m.el&&m.el.complete&&m.el.naturalWidth>0}", timeout=10000)
        rl = await E("()=>({n:missing198().length,src:S.ed.clips.find(c=>c.id==='miss').src,sheet:!!document.querySelector('[data-rl198]'),type:M['c_miss'].type})"); out["relink"] = [mi, rl]
        chk("a clip whose file is gone is listed as missing (named after its file) with a Relink button; a file chosen in the sheet relinks it as an upload, the sheet closes", mi["n"] == 1 and mi["name"] == "gone.mp4" and mi["btn"] and rl["n"] == 0 and rl["src"]["k"] == "upload" and rl["src"]["name"] == "white.png" and not rl["sheet"] and rl["type"] == "image", out["relink"])
        out["errors"] = errs; chk("no page errors", not errs, errs)
        await b.close()
    print(json.dumps({"fails": fails, **out}, ensure_ascii=False, default=str, indent=1)[:9000])
try: asyncio.run(main())
finally:
    srv.terminate()
    try: srv.wait(timeout=5)
    except Exception: srv.kill()
    import shutil; shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
