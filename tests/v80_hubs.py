# v80: the site in a few hubs with tool tabs (Higgsfield-style; duplicates folded in), nooi Auto as its own card, loaders that are
# only the nooi stars (each star moving on its own), tap-to-view for pictures and clips, compact grids, a faster Sketch to Life,
# photoreal 3D worlds (Kie picture + depth from the API or the picture engine → one light 3D surface on the device), the 3D
# Studio sized for phones, and round pink avatars.
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, LPORT = 8096, 8097
D = tempfile.mkdtemp(prefix="nooi-v80-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
# a synthetic place and its depth map (sky far, ground getting nearer, a house in the middle, a tree and a car near)
PY = r"""
from PIL import Image, ImageDraw, ImageFilter
import sys
W,H=1280,720;D=sys.argv[1]
ph=Image.new("RGB",(W,H));d=ImageDraw.Draw(ph);dp=Image.new("L",(W,H));dd=ImageDraw.Draw(dp)
for y in range(H):
    if y<H*0.45:
        t=y/(H*0.45);ph.paste((int(90+80*t),int(150+70*t),int(230-20*t)),(0,y,W,y+1));dp.paste(0,(0,y,W,y+1))
    else:
        t=(y-H*0.45)/(H*0.55);ph.paste((int(110-40*t),int(150-50*t),int(70-30*t)),(0,y,W,y+1));dp.paste(int(40+215*t),(0,y,W,y+1))
d.rectangle([520,260,760,420],fill=(200,170,130));dd.rectangle([520,190,760,420],fill=110)
d.rectangle([180,300,215,620],fill=(90,60,40));d.ellipse([90,150,310,360],fill=(50,120,60));dd.rectangle([180,300,215,620],fill=215);dd.ellipse([90,150,310,360],fill=205)
d.rounded_rectangle([860,480,1120,580],20,fill=(190,30,30));dd.rounded_rectangle([860,480,1120,580],20,fill=185)
ph.save(D+"/photo.png");dp.filter(ImageFilter.GaussianBlur(1.5)).save(D+"/depth.png")
"""
subprocess.run([sys.executable, "-c", PY, D + "/media"], check=True)
MOCK = r"""
const http=require('http');const P=+process.argv[2];const st={depth:[]};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const J=(o,c)=>{s.statusCode=c||200;s.setHeader('content-type','application/json');s.end(JSON.stringify(o))};
 if(q.url==='/stats')return J(st);
 if(q.url==='/depth'){const j=JSON.parse(b||'{}');st.depth.push({image:j.image_url||j.image,auth:q.headers.authorization||''});return J({depth:{url:'/media/depth.png'}})}
 J({error:'nf'},404)})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e: return {"_status": e.code, **json.loads(e.read() or b"{}")}
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{LPORT}/stats").read())

def api_checks():
    cfg = api("/v1/config"); ok(cfg.get("depthEngine") == "custom", f"depth engine announced {cfg.get('depthEngine')}")
    r = api("/v1/world/depth", {"url": "/media/photo.png"}); st = stats()["depth"]
    ok(r.get("depth") == "/media/depth.png" and r.get("engine") == "custom" and st and st[-1]["image"] == f"http://localhost:{PORT}/media/photo.png" and st[-1]["auth"] == "Bearer dk", f"depth from the API {r} {st}")
    ok(api("/v1/world/depth", {"url": "javascript:alert(1)"}).get("_status") == 400, "depth: bad URL refused")
    av = [x for x in json.loads(urllib.request.urlopen(f"http://localhost:{PORT}/v1/admin/showcase").read())["items"] if x["cat"] == "avatar"]
    ok(len(av) == 15, f"15 avatars {len(av)}")
    src = open(ROOT + "/lib/showcase.js", encoding="utf-8").read()
    ok("pastel-pink studio background" in src and 'aspect: "1:1"' in src and "crops cleanly into a circle" in src, "avatars: round pink portraits")
    out["api"] = {"depthCalls": len(st)}

SETUP = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}"
async def ui(p, w, lang):
    tag = f"{w}/{lang}"; r = {}; phone = w < 600
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport={"width": w, "height": 860}, is_mobile=phone, has_touch=phone, device_scale_factor=2 if phone else 1)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    posted = []; sees = []
    async def jobs(route):
        if route.request.method != "POST": return await route.continue_()
        posted.append(json.loads(route.request.post_data or "{}")); await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "rv" + str(len(posted))}))
    async def jstat(route):
        n = route.request.url.split("/")[-1]; k = int(n[2:]) - 1; j = posted[k] if 0 <= k < len(posted) else {}
        u = "/media/depth.png" if "depth map" in (j.get("prompt") or "") else "/media/photo.png"
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": n, "status": "done", "progress": 1, "url": u}))
    async def see(route):
        sees.append(1); await route.fulfill(status=200, content_type="application/json", body=json.dumps({"ready": True, "subject": "a red car", "objects": ["car"], "target": "vehicle", "label": "a car"}))
    async def av(route):
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({"items": [{"id": "av-faisal", "name": ["Faisal", "فيصل"], "gender": "male", "url": "/media/photo.png", "fresh": True}]}))
    await pg.route("**/v1/jobs", jobs); await pg.route("**/v1/jobs/rv*", jstat); await pg.route("**/v1/sketch/see", see); await pg.route("**/v1/avatars", av)
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    await E(SETUP % lang); await pg.wait_for_timeout(300)
    # ---- a few hubs in the menu; each hub page has its tools as tabs
    if not phone:
        r["side"] = await E("()=>[...document.querySelectorAll('#side .nav')].map(b=>b.dataset.go)")
        ok(r["side"] == ["home", "explore", "image", "video", "chars", "w3ai", "edit", "calendar", "library", "account", "admin"], f"{tag}: the menu is a few hubs {r['side']}")   # v82: Templates + Community under Explore
        ok(await E("()=>![...document.querySelectorAll('#side .nav .new')].some(x=>x.offsetParent)"), f"{tag}: no NEW tags in the menu")
    HUB = {"video": ["video", 7], "ugcads": ["video", 7], "crew": ["video", 7], "cinema": ["video", 7], "motion": ["video", 7], "image": ["image", 3], "sketch": ["image", 3], "draw": ["image", 3], "w3ai": ["w3ai", 3], "studio3d": ["w3ai", 3], "physics": ["w3ai", 3], "edit": ["edit", 7], "bg": ["edit", 7], "slideshow": ["edit", 7], "calendar": ["calendar", 3], "account": ["account", 5]}   # v82: + Cinema Studio in Video; Connections & APIs moved to the admin hub · v83: + Motion Control (Video), Video from pictures (Edit)
    for v, (hub, n) in HUB.items():
        await E("(v)=>{go(v);renderAll()}", v); await pg.wait_for_timeout(250)
        x = await E("()=>{const t=[...document.querySelectorAll('#main .hubtabs [role=tab]')];return [t.length,t.filter(b=>b.getAttribute('aria-selected')==='true').map(b=>b.dataset.go)]}")
        sel = {"draw": "sketch", "bg": "fx"}.get(v, v)
        ok(x[0] == n and x[1] == [sel], f"{tag}: {v} shows its hub's tabs {x}")
    await E("()=>{go('draw');renderAll()}"); await pg.wait_for_timeout(250)
    ok(await E("()=>!!document.querySelector('.skmode80 [data-go=\"sketch\"]')&&!!document.querySelector('.skmode80 [data-go=\"draw\"][aria-selected=\"true\"]')"), f"{tag}: Sketch and Draw a scene are one place")
    await E("()=>document.querySelector('.hubtabs [data-go=\"crew\"]').click()") if await E("()=>!!document.querySelector('.hubtabs [data-go=\"crew\"]')") else None
    await E("()=>{go('crew');renderAll()}"); await pg.wait_for_timeout(250)
    ok(await E("()=>document.querySelector('#main h1').textContent") == ("استوديو nooi" if lang == "ar" else "nooi Studio"), f"{tag}: the agents' page is nooi Studio")
    # ---- Video: no duplicate UGC type; nooi Auto is its own card
    await E("()=>{S.draft.model='auto';S.draft.type='story';go('video');renderAll()}"); await pg.wait_for_timeout(300)
    r["auto"] = await E("()=>{const c=document.querySelector('.model[data-val=\"auto\"]');return [c&&c.querySelector('b').textContent.trim(),!!document.querySelector('[data-set=\"draft.type\"][data-val=\"ugc\"]')]}")
    ok(r["auto"][0] == "nooi Auto" and not r["auto"][1], f"{tag}: nooi Auto separate from Veo, no duplicate UGC type {r['auto']}")
    # ---- loaders: only the stars (each star has its own motion), no "Rendering" word
    await E("""()=>{const c=S.chars[S.charSel];['rendering','queued','complete'].forEach((st,i)=>S.jobs.push({id:'lv'+i,kind:'look',status:st,progress:.42,created:Date.now()-7200e3,title:'x',prompt:'x',aspect:'3:4',seed:700+i,pal:PALS[i],art:'portrait',resultUrl:st==='complete'?'/media/photo.png':'',meta:{char:c.id}}));go('chars');renderAll()}""")
    await pg.wait_for_timeout(400)
    r["veil"] = await E("()=>[...document.querySelectorAll('.looks .veil.v80')].map(v=>[!!v.querySelector('.star79'),v.textContent.trim()])")
    ok(len(r["veil"]) >= 2 and all(x[0] for x in r["veil"]) and all(x[1] in ("", "42%") for x in r["veil"]), f"{tag}: loaders are only the stars {r['veil']}")
    r["svg"] = await E("()=>{const u=getComputedStyle(document.documentElement).getPropertyValue('--star79');const s=decodeURIComponent(u.slice(u.indexOf(',')+1,u.lastIndexOf('\"')));return [(s.match(/<animateTransform/g)||[]).length,(s.match(/dur=\"([\\d.]+)s\"/g)||[]).length,new Set((s.match(/dur=\"([\\d.]+)s\"/g)||[])).size]}")
    ok(r["svg"][0] == 6 and r["svg"][2] >= 3, f"{tag}: each star moves on its own {r['svg']}")
    ok(await E("()=>{const b=document.createElement('span');b.className='badge b-rendering';b.textContent='Rendering';document.body.appendChild(b);const s=getComputedStyle(b),a=getComputedStyle(b,'::before');const x=[s.fontSize,a.backgroundImage.includes('svg')];b.remove();return x[0]==='0px'&&x[1]}"), f"{tag}: status badges show stars, not the word")
    # ---- compact looks grid; tap to view (pause / zoom)
    r["grid"] = await E("()=>[getComputedStyle(document.querySelector('.looks')).gridTemplateColumns.split(' ').length,Math.round(document.querySelector('.looks .thumb').getBoundingClientRect().width)]")
    ok((r["grid"][0] >= 3 if phone else True) and r["grid"][1] <= 170, f"{tag}: looks are compact ({r['grid'][0]} per row, {r['grid'][1]} px wide)")
    await E("()=>document.querySelector('.looks .zoom80').click()"); await pg.wait_for_timeout(300)
    r["viewer"] = await E("()=>{const m=document.querySelector('.mv80');return m&&[m.querySelector('.mvm').tagName,m.querySelector('.mvm').getAttribute('src')]}")
    ok(r["viewer"] == ["IMG", "/media/photo.png"], f"{tag}: tap to view a picture {r['viewer']}")
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(150)
    ok(await E("()=>!document.querySelector('.mv80')"), f"{tag}: the viewer closes with Escape")
    await E("()=>viewMedia80('/media/clip.mp4','video')"); await pg.wait_for_timeout(150)
    ok(await E("()=>{const v=document.querySelector('.mv80 video');const x=!!v&&v.controls;document.querySelector('.mv80 .mvx').click();return x}"), f"{tag}: clips open with controls (pause)")
    # ---- faster Sketch to Life: recognised while drawing (once), 1K picture from a small JPEG, started soon after the pause
    n0 = len(posted)
    await E("()=>{S.sketch.prompt='';S.sketch.ai='pause';S.sketch.aiCap=250;go('sketch');renderAll()}"); await pg.wait_for_timeout(400)
    await E("()=>{SK.strokes=[{tool:'pen',color:'#000',size:6,pts:[[.2,.6,.6],[.5,.5,.6],[.8,.6,.6]]}];skRedraw();document.dispatchEvent(new PointerEvent('pointerup'))}")
    t0 = time.time()
    for _ in range(40):
        await pg.wait_for_timeout(100)
        if [x for x in posted[n0:] if x.get("kind") == "image"]: break
    dt = time.time() - t0; sk = [x for x in posted[n0:] if x.get("kind") == "image"]
    ok(sk and dt < 2.6 and "a red car" in sk[0]["prompt"] and sk[0]["meta"].get("res") == "1K" and "skImg" in (sk[0].get("inputs") or {}) and len(sees) == 1, f"{tag}: Sketch to Life starts fast ({dt:.1f}s, see calls {len(sees)}) {[x.get('meta') for x in sk]}")
    # ---- photoreal 3D world: picture → depth (from the API) → one light surface; walk; video from the view
    n0 = len(posted)
    await E("()=>{S.dw={mode:'photo',kind:'wide',prompt:'A mountain valley with a house, a tree and a red car',cur:null,list:[]};DW.built=null;go('w3ai');renderAll()}"); await pg.wait_for_timeout(400)
    await E("()=>document.querySelector('[data-act=\"dw-make\"]').click()")
    for _ in range(60):
        await pg.wait_for_timeout(400)
        if await E("()=>!!(DW.scene&&DW.built)"): break
    r["dw"] = await E("()=>[!!DW.built,DW.stats,S.dw.list[0].depthBy||'job',document.documentElement.scrollWidth<=innerWidth]")
    dwj = posted[n0:]
    ok(r["dw"][0] and r["dw"][1]["verts"] > 5000 and r["dw"][1]["tris"] < r["dw"][1]["verts"] * 2 and r["dw"][2] == "custom" and r["dw"][3], f"{tag}: photoreal world built from the picture + API depth {r['dw']}")
    ok(len(dwj) == 1 and dwj[0]["kind"] == "image" and dwj[0]["aspect"] == "16:9" and "photorealistic" in dwj[0]["prompt"].lower(), f"{tag}: one high-quality picture, depth from the API (no extra picture) {[(x.get('kind'), x.get('prompt','')[:50]) for x in dwj]}")
    await E("()=>{const c=$('#dwcv');for(let i=0;i<5;i++)c.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}))}"); await pg.wait_for_timeout(200)
    ok(await E("()=>DW.pos[2]<-0.5&&DW.pos[2]>=-1.6"), f"{tag}: walk into the world (kept inside it)")
    n0 = len(posted); await E("()=>document.querySelector('[data-act=\"dw-video\"]').click()"); await pg.wait_for_timeout(2500)
    ok([(x.get("kind"), sorted((x.get("inputs") or {}).keys())) for x in posted[n0:]] == [("video", ["vStart"])], f"{tag}: real video in the cloud from the view")
    # without a depth API the picture engine draws the depth map
    n0 = len(posted)
    await E("()=>{API.cfg.depthEngine=null;S.dw.kind='pano';S.dw.prompt='A souq at night';DW.built=null;renderView()}"); await pg.wait_for_timeout(200)
    await E("()=>document.querySelector('[data-act=\"dw-make\"]').click()")
    for _ in range(60):
        await pg.wait_for_timeout(400)
        if await E("()=>{const w=dwWorld();return !!(DW.scene&&DW.built===w.id)}"): break
    dwj = posted[n0:]
    ok(len(dwj) == 2 and dwj[0]["aspect"] == "21:9" and "360-degree" in dwj[0]["prompt"] and "depth map" in dwj[1]["prompt"] and "iRef" in (dwj[1].get("inputs") or {}) and await E("()=>DW.kind==='pano'"), f"{tag}: 360° world, depth from the picture engine {[(x.get('aspect'), x.get('prompt','')[:40]) for x in dwj]}")
    # ---- round pink avatars for UGC presenters
    await E("()=>{S.draft.ugc.mode='presenter';go('ugcads');renderAll()}"); await pg.wait_for_timeout(900)
    r["av"] = await E("()=>{const a=[...document.querySelectorAll('[data-act=\"ugc-pre\"] .avc80')];const s=a[0]&&getComputedStyle(a[0]);return [a.length,a.filter(x=>x.querySelector('img')).length,s&&s.borderRadius,s&&s.backgroundColor]}")
    ok(r["av"][0] >= 7 and r["av"][1] == 1 and r["av"][2] == "50%" and r["av"][3] == "rgb(246, 205, 213)", f"{tag}: presenters are round pink avatars {r['av']}")
    ok(not errs, f"{tag}: page errors {errs}")
    await b.close(); return r

async def studio(p):
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    pg = await (await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    await pg.evaluate(SETUP % "en"); await pg.evaluate("()=>{go('studio3d');renderAll()}")
    r = None
    for _ in range(40):
        await pg.wait_for_timeout(300)
        r = await pg.evaluate("()=>{const f=document.querySelector('iframe.x3frame');const d=f&&f.contentDocument;const v=d&&d.querySelector('.view');return f&&v?[Math.round(f.getBoundingClientRect().height),Math.round(v.getBoundingClientRect().height),Math.round(d.documentElement.scrollHeight),innerHeight]:null}")
        if r and abs(r[1] - r[3] * .5) < 30 and abs(r[0] - r[2]) < 30: break
    ok(r and abs(r[1] - r[3] * .5) < 30 and abs(r[0] - r[2]) < 30, f"3D Studio on a phone: half-screen 3D view, the page scrolls past it {r}")
    ok(not errs, f"3D Studio: page errors {errs}")
    await b.close()

async def main():
    async with async_playwright() as p:
        for w, lang in ((390, "ar"), (1280, "en")): out[f"{w}/{lang}"] = await ui(p, w, lang)
        await studio(p)

if __name__ == "__main__":
    mk = subprocess.Popen(["node", D + "/mock.js", str(LPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "REALTIME_", "DEPTH_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="w" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        DEPTH_API_URL=f"http://localhost:{LPORT}/depth", DEPTH_API_KEY="dk", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        time.sleep(.4)
        api_checks()
        asyncio.run(main())
    except Exception:
        import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
    finally:
        srv.terminate(); mk.terminate()
        try: err = srv.stderr.read().decode()[-1500:]
        except Exception: err = ""
    print(json.dumps({"fails": fails, "out": out, "serverLog": err if fails else ""}, ensure_ascii=False, default=str, indent=1))
    sys.exit(1 if fails else 0)
