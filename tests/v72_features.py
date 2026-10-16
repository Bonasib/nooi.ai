# v72 regression: a fresh nooi server (own data + media folders) behind a mocked picture engine that returns real PNGs
# (front / side / back views on white, a 2:1 panorama). Checks, on a phone and a desktop:
#  · editor: the preview stays pinned while scrolling to the last tool, taps on the preview never move the page,
#    overlapping sound effects get their own lanes, an AI-designed effect is added and drawn, the logo size stays a clean number
#  · the sketch's "Preview with AI" sends the drawing to the engine (and leaves the user's own reference alone)
#  · a character made from an uploaded photo; its looks use the photo as the face reference
#  · AI full 3D from a photo and for a character: front/side/back views → a closed mesh with real depth → editor / scene
#  · a 3D world from a photo (3D Studio): 21:9 panorama job continuing the photo → sky + lighting → walk-through clip in the editor
#  · templates ordered by kind
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8085, 8084
D = tempfile.mkdtemp(prefix="nooi-v72-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/kie"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
FF = os.environ.get("FFMPEG_PATH", "ffmpeg"); K = D + "/kie/"
for args in (["-f", "lavfi", "-i", "color=white:size=512x512", "-vf", "drawbox=x=136:y=56:w=240:h=400:color=red@1:t=fill", "-frames:v", "1", K + "front.png"],
             ["-f", "lavfi", "-i", "color=white:size=512x512", "-vf", "drawbox=x=206:y=56:w=100:h=400:color=red@1:t=fill", "-frames:v", "1", K + "side.png"],
             ["-f", "lavfi", "-i", "color=white:size=512x512", "-vf", "drawbox=x=136:y=56:w=240:h=400:color=blue@1:t=fill", "-frames:v", "1", K + "back.png"],
             ["-f", "lavfi", "-i", "gradients=size=1024x512:duration=1", "-frames:v", "1", K + "pano.png"],
             ["-f", "lavfi", "-i", "testsrc2=size=800x600", "-frames:v", "1", K + "photo.jpg"]):
    subprocess.run([FF, "-v", "error", "-y", *args], check=True)
for f in ("front.png", "side.png", "back.png", "photo.jpg"): shutil.copy(K + f, D + "/media/" + f)
MOCK = r"""
const http=require('http'),fs=require('fs'),K=process.argv[2],P=+process.argv[3];let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x'),send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname.startsWith('/out/')){s.setHeader('content-type','image/png');return s.end(fs.readFileSync(K+u.pathname.slice(5)))}
 if(u.pathname==='/api/v1/chat/credit')return send(999);
 if(u.pathname==='/api/v1/jobs/createTask'){const body=JSON.parse(b||'{}'),id='t'+(++n),p=String(body.input&&body.input.prompt||'');T[id]={polls:0,f:/equirectangular/.test(p)?'pano.png':/right side/.test(p)?'side.png':/from behind/.test(p)?'back.png':'front.png'};return send({taskId:id})}
 const t=T[u.searchParams.get('taskId')];if(!t)return send(null);const done=++t.polls>=2;
 return send(done?{state:'success',resultJson:JSON.stringify({resultUrls:['http://localhost:'+P+'/out/'+t.f]})}:{state:'generating',progress:50})})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
SETUP = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;S.credits=50000}"
EDSETUP = """async()=>{const now=Date.now(),mk=(id,kind,url,dur)=>({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url});
 S.jobs.push(mk('v_img','image','/media/photo.jpg',0));PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];await edUseJob(S.jobs.find(j=>j.id==='v_img'),{stay:true,quiet:true});
 for(let i=0;i<3;i++)S.ed.sfx.push({id:'sx'+i,n:'whoosh',t:0.5+i*0.2,vol:100});go('edit');renderAll()}"""
fails = []
def ok(c, m):
    if not c: fails.append(m)
def db_jobs():
    d = json.load(open(D + "/data/db.json")); return [j for u in d["users"].values() for j in u.get("jobs", {}).values()]
async def wait_for(E, js, sec=20):
    for _ in range(sec * 4):
        if await E(js): return True
        await asyncio.sleep(.25)
    return False

async def run(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
    ctx = await b.new_context(viewport={"width": w, "height": 844 if mob else 900}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append((str(e)+' '+(e.stack or ''))[:600]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); E = pg.evaluate
    await E(SETUP % ("ar" if mob else "en")); await E(EDSETUP); await pg.wait_for_timeout(1500)
    r = {}
    # editor: pinned preview, taps don't move the page
    if mob:
        await E("()=>{const m=document.querySelector('#main');m.scrollTop=m.scrollHeight}"); await pg.wait_for_timeout(300)
        r["stageTop"] = await E("()=>Math.round(document.querySelector('.edstage').getBoundingClientRect().top)")
        ok(0 <= r["stageTop"] <= 80, f"{tag}: preview pinned at the top after scrolling to the end ({r['stageTop']})")
        await E("()=>{document.querySelector('#main').scrollTop=300}"); await pg.wait_for_timeout(300)
    sc0 = await E("()=>document.querySelector('#main').scrollTop")
    cv = await E("()=>{const r=document.querySelector('#wk').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}")
    for i in range(4):
        if mob: await pg.touchscreen.tap(cv[0] + i * 8, cv[1])
        else: await pg.mouse.click(cv[0] + i * 8, cv[1])
        await pg.wait_for_timeout(450)
    r["scroll"] = [sc0, await E("()=>document.querySelector('#main').scrollTop")]
    ok(abs(r["scroll"][1] - r["scroll"][0]) <= 1, f"{tag}: taps on the preview moved the page {r['scroll']}")
    r["fxLanes"] = await E("()=>[...document.querySelectorAll('#tlin .trk')].filter(t=>t.querySelector('.blk.sx')).length")
    ok(r["fxLanes"] == 3, f"{tag}: 3 overlapping sounds should use 3 lanes ({r['fxLanes']})")
    await E("()=>{S.ed.tab='vfx';renderView()}"); await pg.wait_for_timeout(300)
    await E("()=>{document.querySelector('#vfxaiq').value='blue magic sparks swirling'}"); await E("()=>document.querySelector('[data-act=vfxai-gen]').click()"); await pg.wait_for_timeout(700)
    r["aiVfx"] = await E("""()=>{const v=S.ed.vfx[S.ed.vfx.length-1];if(!v||!VFX_SPEC[v.kind])return null;const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');edVfxDraw(x,640,360,v.start+1);const d=x.getImageData(0,0,640,360).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return [VFX_SPEC[v.kind].layers[0].dir,VFX_SPEC[v.kind].layers[0].color,n,!!document.querySelector('[data-vx="'+v.id+'"]')]}""")
    ok(r["aiVfx"] and r["aiVfx"][0] == "swirl" and r["aiVfx"][2] > 300 and r["aiVfx"][3], f"{tag}: AI effect {r['aiVfx']}")
    await E("()=>{S.brand.size=5.3962965866;S.ed.tab='logo';renderView()}"); r["logo"] = await E("()=>S.brand.size"); ok(r["logo"] == 5.4, f"{tag}: logo size {r['logo']}")
    # the sketch (v91: one drawing, one "Preview with AI" button) sends the drawing to the engine and leaves the user's own reference alone
    await E("()=>{S.sketch.prompt='a red classic car';S.sketch.n91=1;M.iRef={type:'image',file:new Blob(['x'],{type:'image/png'}),name:'mine.png',url:''};go('sketch');renderAll()}"); await pg.wait_for_timeout(500)
    await E("()=>{SK.strokes=[{tool:'pen',color:'#222',size:6,pts:[[.2,.6,.6],[.5,.4,.6],[.8,.6,.6]]}];skRedraw();document.querySelector('[data-act=sk91-go]').click()}")
    ok(await wait_for(E, "()=>S.jobs.some(j=>j.meta&&j.meta.sk91&&j.remote)"), f"{tag}: sketch job sent")
    await pg.wait_for_timeout(500); r["skBox"] = await E("()=>!!document.querySelector('#sk91res .dfig')"); ok(r["skBox"], f"{tag}: the AI preview is shown under the button")
    r["keepRef"] = await E("()=>M.iRef&&M.iRef.name"); ok(r["keepRef"] == "mine.png", f"{tag}: the user's reference was replaced ({r['keepRef']})")
    # character from a photo → looks keep the face
    await E("()=>{go('chars');renderAll()}"); await pg.wait_for_timeout(500); n0 = await E("()=>S.chars.length")
    await pg.set_input_files('input[data-chphoto=new]', K + "photo.jpg"); await pg.wait_for_timeout(1500)
    r["char"] = await E("()=>[S.chars.length,!!S.chars[S.charSel].photo,!!document.querySelector('.charrow[aria-current=true] img')]")
    ok(r["char"][0] == n0 + 1 and r["char"][1] and r["char"][2], f"{tag}: character from photo {r['char']}")
    await E("()=>document.querySelector('[data-act=gen-looks]').click()")
    ok(await wait_for(E, "()=>S.jobs.filter(j=>j.kind==='look'&&j.meta&&j.meta.photo&&j.remote).length>=4"), f"{tag}: looks from the photo sent")
    # a photo handed to 3D (the old 3D Studio door) opens the one 3D World with the picture in it; "one thing in it → a 3D object"
    # sends one 3D job and the core picks the engine
    await E("async()=>{const b=await (await fetch('/media/photo.jpg')).blob();const u=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(b)});await setS3dFromDataURL(u,'a red box');go('studio3d')}")
    ok(await wait_for(E, "()=>S.view==='world'&&!!S.world.pic", 20), f"{tag}: the photo is in the 3D World")
    n3 = await E("()=>S.jobs.length")
    await E("()=>{const b=document.querySelector('[data-act=nw-obj3d]');b&&b.click()}")
    ok(await wait_for(E, f"()=>S.jobs.slice({n3}).some(j=>j.kind==='3d'&&j.meta&&j.meta.mode==='objects'&&j.meta.engine==='auto')", 20), f"{tag}: one thing in the photo → a 3D object job (engine auto)")
    r["mesh"] = await E("""async()=>{await ensureThree();const ld=async f=>{const b=await(await fetch('/media/'+f)).blob();return blobImg72(b)};const g=a3Mesh(await ld('front.png'),await ld('side.png'),await ld('back.png'),'object');const s=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());return [g.children.length,+s.x.toFixed(2),+s.y.toFixed(2),+(s.z/s.x).toFixed(2)]}""")
    ok(r["mesh"][0] == 2 and 0.35 < r["mesh"][3] < 0.75 and r["mesh"][2] > 1.9, f"{tag}: closed mesh with depth from the side view {r['mesh']}")
    # the AI 3D views (front · side · back of the user's photo, the fallback 3D path) carry that photo (checked on the server below)
    await E("async()=>{const b=await (await fetch('/media/photo.jpg')).blob();await a3Start('object',b,'red box','a red box')}"); await pg.wait_for_timeout(600)
    # 3D character: a full 3D body through the same 3D core
    await E("()=>{go('chars');renderAll()}"); await pg.wait_for_timeout(500); nb = await E("()=>S.jobs.length")
    r["charBtn"] = await E("()=>[S.view,S.chars.length,S.charSel,!!document.querySelector('[data-act=b87-make]'),!!document.querySelector('[data-act=gen-sheet]')]")
    ok(r["charBtn"][3], f"{tag}: 3D character button missing {r['charBtn']}")
    await E("()=>{const c=S.chars[S.charSel];if(c&&!c.face)c.face='/media/photo.jpg';const b=document.querySelector('[data-act=b87-make]');b&&b.click()}")
    ok(await wait_for(E, f"()=>S.jobs.slice({nb}).some(j=>j.kind==='image'&&j.meta&&j.meta.body87)", 20), f"{tag}: 3D character: a full-body photo of that same person comes first (v87), then its 3D body")
    # 3D world from a photo: the picture becomes a world, its view becomes the first frame of a video, and a tour is recorded
    await E("async()=>{const b=await (await fetch('/media/photo.jpg')).blob();const u=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(b)});await setS3dFromDataURL(u,'harbour');go('studio3d')}")
    ok(await wait_for(E, "()=>S.view==='world'&&!!S.world.pic&&typeof NW!=='undefined'&&!!NW.E&&(!!NW.W||!!NW.empty87)&&!NW.busy", 40), f"{tag}: 3D World ready with the photo")
    await E("()=>{S.world.opts.look='real';persist();const t=document.getElementById('nwprompt');if(t)t.value='a quiet harbour';document.querySelector('[data-act=nw-go]').click()}")
    ok(await wait_for(E, "()=>!NW.busy&&!!NW.W&&!S.world.pic&&!!S.world.plan", 60), f"{tag}: a world was built from the photo")
    if not mob:
        nv = await E("()=>S.jobs.length")
        await E("()=>{document.querySelector('[data-act=nw-video]').click()}"); await pg.wait_for_timeout(2500); await E("()=>NW.W&&NW.W.player.setMode('walk')")
        ok(await wait_for(E, f"()=>S.jobs.length>{nv}", 20), f"{tag}: a walk-through video saved to My library")
    await E("()=>{document.querySelector('[data-act=nw-use]').click()}")
    ok(await wait_for(E, "()=>S.view==='video'&&!!M.vStart", 20), f"{tag}: the world's view is the first frame of a video")
    # templates ordered by kind
    await E("()=>{S.exploreType='all';go('explore');renderAll()}"); await pg.wait_for_timeout(500)
    r["tpl"] = await E("()=>{const ord=TYPES.map(t=>t[0]),ids=[...document.querySelectorAll('.card.tpl')].map(c=>TEMPLATES.find(t=>t.id===c.dataset.id).type),ix=ids.map(t=>ord.indexOf(t));return [ids.length,ix.every((v,i)=>!i||v>=ix[i-1])]}")
    ok(r["tpl"][0] == 16 or r["tpl"][0] > 0 and r["tpl"][1], f"{tag}: templates {r['tpl']}")
    ok(r["tpl"][1], f"{tag}: templates not ordered by kind")
    ok(not errs, f"{tag}: page errors {errs}")
    await b.close(); return r

async def main():
    out = {}
    async with async_playwright() as p:
        for w in (390, 1280): out[w] = await run(p, w)
    return out

if __name__ == "__main__":
    mk = subprocess.Popen(["node", D + "/mock.js", K, str(KPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(os.environ, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", KIE_API_KEY="kie_v72", KIE_BASE_URL=f"http://localhost:{KPORT}", PUBLIC_BASE_URL=f"http://localhost:{PORT}"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        out = asyncio.run(main())
        jobs = db_jobs()
        sk = [j for j in jobs if (j.get("payload") or {}).get("meta", {}).get("sk91")]
        ok(sk and "skImg" in sk[-1]["payload"].get("inputs", {}), "sketch picture not uploaded to the engine")
        lk = [j for j in jobs if j.get("kind") == "look" and (j.get("payload") or {}).get("meta", {}).get("photo")]
        ok(lk and "chRef" in lk[-1]["payload"].get("inputs", {}), "character photo not sent with the looks")
        a3 = [j for j in jobs if (j.get("payload") or {}).get("meta", {}).get("a3")]
        ok(len(a3) >= 3 and all("iRef" in j["payload"].get("inputs", {}) for j in a3), "AI 3D views missing the reference photo")
        b87 = [j for j in jobs if (j.get("payload") or {}).get("meta", {}).get("body87")]
        ok(b87 and "iRef" in b87[-1]["payload"].get("inputs", {}), "a character's 3D body starts from a full-body photo made from its real face (v87)")
        pw = [j for j in jobs if ((j.get("payload") or {}).get("meta", {}).get("nw") or {}).get("role") == "pano"]
        ok(pw and pw[-1]["payload"].get("aspect") == "21:9" and "iRef" in pw[-1]["payload"].get("inputs", {}), "world panorama job wrong (Realistic: a 360° sky that continues the photo)")
        print(json.dumps({"fails": fails, "results": out}, ensure_ascii=False, default=str))
    finally:
        srv.terminate(); mk.terminate(); shutil.rmtree(D, ignore_errors=True)
