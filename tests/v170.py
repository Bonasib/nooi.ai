# v170 — the Home box empties after Create; an angle photo of any shape stays in its tile; the editor's preview is drawn only
# when something changed (the playhead and the picture follow the finger on a phone).
# A real nooi server (no AI engine is set up: the jobs fail, but they are made) and the page in Playwright (phone and desktop):
#  · Home → avatar with a face photo, an extra angle and a voice file → Create: the photo, the angle, the voice file and the words
#    leave the box (also after a reload); with no words and no voice nothing is made and nothing is emptied
#  · Home → video with a # picture → Create: the picture leaves the box
#  · a tall angle photo is cropped to its tile — nothing in the box overlaps the Acting chip under it
#  · the editor, nothing touched: the frame loop draws the preview only a few times a second (it drew every frame); a jump of
#    the playhead, an edit, a play — each is drawn at once; the playhead is placed by one GPU move (no left as well)
# Run: python3 tests/v170.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8500; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v170-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {"j1": {"id": "j1", "kind": "video", "status": "done", "progress": 1, "url": "/media/clip.webm", "title": "Clip", "created": 1, "payload": {"prompt": "x"}}}}}}, open(D + "/data/db.json", "w"))
ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120)
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=4", "-c:v", "libvpx-vp9", "-b:v", "1M", "-deadline", "realtime", "-cpu-used", "8", D + "/media/clip.webm")
ff("-f", "lavfi", "-i", "testsrc2=size=512x640:duration=1", "-frames:v", "1", D + "/media/face.png")
ff("-f", "lavfi", "-i", "mandelbrot=size=360x900", "-frames:v", "1", D + "/media/tall.png")   # (a tall photo: 2.5 times as high as wide)
ff("-f", "lavfi", "-i", "sine=frequency=300:duration=2", "-ac", "1", D + "/media/voice.mp3")
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def wait(fn, sec=40):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
SETUP = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false}"
FILES = """async()=>{const fe=async(u,n,t)=>new File([await (await fetch(u)).blob()],n,{type:t});return {face:await fe('/media/face.png','face.png','image/png'),tall:await fe('/media/tall.png','tall.png','image/png'),voice:await fe('/media/voice.mp3','10-28-2026 18.32.11.mp3','audio/mpeg')}}"""
BOX = "()=>({ref:!!M.hfRef,ang:[1,2,3].map(i=>!!M['hfAng'+i]),aud:!!M.hfAud,prompt:S.hf.prompt||'',q:(document.getElementById('hfq')||{}).value||'',keys:Object.keys(S.mediaKeys||{}).filter(k=>/^hf|^vRef/.test(k)),refs:(S.draft.refs130||[]).length,jobs:S.jobs.filter(j=>!j.remote||j.remote!=='j1').filter(j=>(j.created||0)>(window.__T0||0)).length})"   # (jobs made by this test only)

async def home_checks(p, phone):
    b = await p.chromium.launch(); c = await b.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); R = {}
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000); await pg.evaluate(SETUP, "en")
    # 1. avatar with a face, a tall extra angle and a voice file
    await pg.evaluate("async(F)=>{const f=await (eval(F))();window.__F=f;window.__T0=Date.now();S.view='home';S.hf.tab='avatar';renderView();loadSlot('hfRef',f.face);loadSlot('hfAng1',f.tall);loadSlot('hfAud',f.voice);S.hf.prompt='';renderView()}", FILES)
    await pg.wait_for_timeout(800)
    # (the tall photo stays in its tile; nothing overlaps the chips under the tiles)
    R["tile"] = r = await pg.evaluate("""()=>{const t=document.querySelector('.hfang:not(.add)'),i=t&&t.querySelector('img');if(!t||!i)return {err:'no tile'};const a=t.getBoundingClientRect(),b=i.getBoundingClientRect();
      const box=document.querySelector('.hfbox'),els=[...box.querySelectorAll('.hfang,.hfchip,.hfrefw,.hfsend,button.hfchip,label.hfchip')].filter(e=>e.getBoundingClientRect().width>4);
      const ov=[];for(let x=0;x<els.length;x++)for(let y=x+1;y<els.length;y++){const A=els[x],Bb=els[y];if(A.contains(Bb)||Bb.contains(A))continue;const p=A.getBoundingClientRect(),q=Bb.getBoundingClientRect(),w=Math.min(p.right,q.right)-Math.max(p.left,q.left),h=Math.min(p.bottom,q.bottom)-Math.max(p.top,q.top);if(w>2&&h>2)ov.push([A.className,Bb.className])}
      return {tile:[Math.round(a.width),Math.round(a.height)],img:[Math.round(b.width),Math.round(b.height)],imgBottom:Math.round(b.bottom-a.bottom),ov}}""")
    ok(r.get("tile") and abs(r["img"][1] - r["tile"][1]) <= 1 and r["imgBottom"] <= 1 and not r["ov"], f"a tall angle photo is cropped to its tile, nothing overlaps {r}")
    # (no words and no voice: nothing is made, nothing is emptied)
    await pg.evaluate("()=>{drop170('hfAud');S.hf.prompt='';renderView()}")
    n0 = (await pg.evaluate(BOX))["jobs"]
    await pg.evaluate("()=>hfSend()"); await pg.wait_for_timeout(600)
    R["nothing"] = r = await pg.evaluate(BOX)
    ok(r["jobs"] == n0 and r["ref"] and r["ang"][0], f"nothing made → the box keeps its photos {r}")
    # (Create: everything leaves the box — and stays gone after a reload)
    await pg.evaluate("()=>{loadSlot('hfAud',window.__F.voice);S.hf.prompt='A friendly presenter introduces our new app in 15 seconds';const q=document.getElementById('hfq');if(q)q.value=S.hf.prompt;renderView()}")
    await pg.wait_for_timeout(300); await pg.evaluate("()=>hfSend()"); await pg.wait_for_timeout(1500)
    R["avatar"] = r = await pg.evaluate(BOX)
    ok(r["jobs"] > n0 and not r["ref"] and not any(r["ang"]) and not r["prompt"] and not r["q"] and not r["keys"], f"after Create the face, the angle and the words leave the box {r}")
    await pg.wait_for_timeout(1500); await pg.reload(); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000); await pg.wait_for_timeout(1500)
    R["reload"] = r = await pg.evaluate(BOX); ok(not r["ref"] and not any(r["ang"]) and not r["keys"], f"…and they don't come back after a reload {r}")
    # 2. video with a # picture
    await pg.evaluate(SETUP, "en")
    # (the way the box's picture sheet adds one: a file input marked for the box's pictures)
    await pg.evaluate("async(F)=>{const f=await (eval(F))();window.__T0=Date.now();S.view='home';S.hf.tab='video';renderView();await new Promise(r=>setTimeout(r,300));const inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.setAttribute('data-ref130','');inp.setAttribute('data-hf136','');inp.hidden=true;document.body.appendChild(inp);const dt=new DataTransfer();dt.items.add(f.face);inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>inp.remove(),0)}", FILES)
    await pg.wait_for_timeout(1200)
    before = await pg.evaluate(BOX)
    await pg.evaluate("()=>{S.hf.prompt='#image1 walks along the beach at sunset';const q=document.getElementById('hfq');if(q)q.value=S.hf.prompt}")
    await pg.evaluate("()=>hfSend()"); await pg.wait_for_timeout(2000)
    R["video"] = r = await pg.evaluate(BOX)
    ok(before["refs"] == 1 and r["jobs"] > before["jobs"] and r["refs"] == 0 and not r["keys"] and not r["prompt"], f"after Create the # picture leaves the box {before} → {r}")
    out["home_" + ("phone" if phone else "desk")] = R
    ok(not errs, f"page errors {errs}"); await b.close()

async def editor_checks(p):
    b = await p.chromium.launch(); c = await b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True); pg = await c.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); R = {}
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000); await pg.evaluate(SETUP, "en")
    await pg.evaluate("""async()=>{S.jobs.push({id:'lj1',remote:'j1',kind:'video',status:'complete',progress:1,resultUrl:'/media/clip.webm',title:'Clip',prompt:'x',created:Date.now(),dur:4,aspect:'16:9',art:'scene',seed:1,pal:PALS[0]});
      S.ed.clips=[{id:'c1',src:{k:'job',job:'lj1'},in:0,out:4,speed:1}];S.ed.sel=null;ED.t=0;S.view='edit';renderView();
      window.__N=0;const o=edTick;edTick=function(){__N++;return o.apply(this,arguments)}}""")
    await pg.wait_for_timeout(3000)
    count = lambda ms: pg.evaluate(f"async()=>{{__N=0;await new Promise(r=>setTimeout(r,{ms}));return __N}}")
    R["idle"] = n = await count(2000); ok(n <= 6, f"nothing touched: the preview is drawn a few times in 2 s, not every frame ({n})")
    R["jump"] = r = await pg.evaluate("async()=>{__N=0;const tl=document.querySelector('#tlin').getBoundingClientRect();edSeekX(tl.left+40+2*S.ed.zoom);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const ph=document.getElementById('ph');return {n:__N,t:+ED.t.toFixed(2),left:ph.style.left,tr:ph.style.transform}}")
    ok(r["n"] >= 1 and abs(r["t"] - 2) < .05 and r["left"] == "0px" and "translate3d(" in r["tr"], f"a jump of the playhead is drawn at once; the playhead is placed by one GPU move {r}")
    R["edit"] = r = await pg.evaluate("async()=>{__N=0;S.ed.texts.push({id:'tx1',text:'Hello',start:0,end:4,pos:'center',style:'caption',size:7,anim:'none'});persist();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {n:__N,hit:(ED.hit||[]).some(h=>h.k==='text')}}")
    ok(r["n"] >= 1, f"an edit is drawn at once {r}")
    R["play"] = n = await pg.evaluate("async()=>{ED.playing=true;__N=0;await new Promise(r=>setTimeout(r,1000));const n=__N;ED.playing=false;return n}")
    ok(n >= 20, f"while playing the preview is drawn every frame ({n} in 1 s)")
    R["after"] = n = await count(2000); ok(n <= 6, f"stopped again: back to a few draws ({n})")
    out["editor"] = R
    ok(not errs, f"page errors {errs}"); await b.close()

async def page_checks():
    async with async_playwright() as p:
        for ph in (True, False): await home_checks(p, ph)
        await editor_checks(p)

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "CAMB_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false", AI_LABEL="false"),
  stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    ok(wait(lambda: urllib.request.urlopen(B + "/v1/config", timeout=2).status == 200, 40), "server up")
    asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-1500:])
finally:
    srv.kill(); log = open(D + "/server.log").read()[-1500:]; shutil.rmtree(D, ignore_errors=True)
print(json.dumps(out, ensure_ascii=False, indent=1)[:5000])
if fails:
    print("server log:", log); print("FAILED:"); [print(" ✗", f) for f in fails]; sys.exit(1)
print("v170 ok")
