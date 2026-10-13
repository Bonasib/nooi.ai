# The one 3D Studio (public/studio3d/) in a real browser, phone (Arabic) + desktop. The AI models can't be downloaded in CI, so
# stand-ins replace SAM's mask and Depth Anything's depth; everything after them is the real code:
#  · planner: "put the car in the middle of a rainforest 5m*5m and walk through it" (and the Arabic) → steps, techniques, sizes
#  · without the AI library: SAM fails politely and the instant (colour/depth) selection still finds the object
#  · the plan runs: subject → 3D (a vehicle: outline walls, hood, side windows, 4 wheels) → rainforest 5×5 m → walk mode
#  · a real-size car bigger than the area is shrunk to leave walking room, and "Real size" enlarges the area instead
#  · every biome builds; rain makes surfaces wet, night brings fireflies, snow, mist
#  · walking: you can't walk through the car or out of the plot · guided tour · a recorded walk-through video
#  · exports: scene .glb, object .glb, iPhone .usdz · IndexedDB model cache · no GPU memory growth across rebuilds
#  · inside nooi: one menu entry, the old pages open it, a photo handed over from another tool arrives, save to library, video → editor
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8069
D = tempfile.mkdtemp(prefix="nooi-x3-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
FF = os.environ.get("FFMPEG_PATH", "ffmpeg")
# a toy "car" on a plain backdrop: red body, dark cabin, black wheels
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x8aa6b4:size=800x600", "-vf",
                "drawbox=x=200:y=300:w=400:h=150:color=0x9a1d1d@1:t=fill,drawbox=x=270:y=215:w=260:h=90:color=0x7a1818@1:t=fill,drawbox=x=290:y=228:w=220:h=62:color=0x1d2630@1:t=fill,drawbox=x=230:y=430:w=70:h=60:color=black@1:t=fill,drawbox=x=500:y=430:w=70:h=60:color=black@1:t=fill",
                "-frames:v", "1", D + "/media/car.png"], check=True)
CAR = [200 / 800, 215 / 600, 600 / 800, 490 / 600]  # its box in the picture
HOOKS = """()=>{const B=%s;
 window.__X3_TEST_MASK=async(img,pts)=>{const w=img.width,h=img.height,a=new Uint8Array(w*h),p=pts.find(q=>q.label);if(!p)return null;const inC=p.x>B[0]&&p.x<B[2]&&p.y>B[1]&&p.y<B[3];
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h;if(inC?(u>B[0]&&u<B[2]&&v>B[1]&&v<B[3]&&!(v<0.5&&(u<0.3375||u>0.6625))):Math.hypot(u-p.x,v-p.y)<0.05)a[y*w+x]=255}return{alpha:a,w,h}};
 window.__X3_TEST_DEPTH=async(cv)=>{const w=160,h=Math.max(16,Math.round(160*cv.height/cv.width)),d=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-w/2)/(w*0.45),dy=(y-h*0.62)/(h*0.6);d[y*w+x]=1+Math.max(0,1-dx*dx-dy*dy)*3+(y>h*0.45?1.2:0)}return{depth:d,w,h,ms:1}};
 return true}""" % json.dumps(CAR)
fails = []
def ok(c, m):
    if not c: fails.append(m)
async def wait_for(E, js, sec=20):
    for _ in range(sec * 4):
        try:
            if await E(js): return True
        except Exception: pass
        await asyncio.sleep(.25)
    return False

async def standalone(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"; r = {}
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
    ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=mob, has_touch=mob, accept_downloads=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.on("console", lambda m: errs.append("console: " + m.text[:200]) if m.type == "error" and "ERR_" not in m.text and "Failed to load resource" not in m.text else None)
    await pg.goto(f"http://localhost:{PORT}/studio3d/" + ("?lang=ar" if mob else "")); E = pg.evaluate
    ok(await wait_for(E, "()=>!!window.X3&&!!X3.E.world()", 25), f"{tag}: studio loaded with a world")
    r["vendor"] = await E("()=>window.NOOI_LOCAL_VENDOR"); ok(r["vendor"] is True, f"{tag}: three.js from this server")
    r["dev"] = await E("()=>{const d=X3.S.dev;return [typeof d.webgpu,d.webgl2,d.plan.device,document.getElementById('badge').textContent]}")
    ok(r["dev"][0] == "boolean" and r["dev"][1] is True, f"{tag}: device detected {r['dev']}")
    if mob: ok(await E("()=>document.documentElement.dir==='rtl'&&/خطّط/.test(document.getElementById('planBtn').textContent)"), f"{tag}: Arabic + RTL")
    # ── the planner
    q = "ضع السيارة في وسط غابة مطيرة ٥م × ٥م وتجول فيها مع مطر" if mob else "Put the car in the middle of a rainforest 5m*5m and walk through it"
    await E("(q)=>{const t=document.getElementById('q');t.value=q;document.getElementById('ask').requestSubmit()}", q); await pg.wait_for_timeout(300)
    r["plan"] = await E("()=>{const P=X3.S.plan;return {biome:P.biome,size:P.size,subject:P.subject,cat:P.category,walk:P.walk,rain:P.fx.rain||0,steps:P.steps.map(s=>s.id+':'+s.choice)}}")
    P = r["plan"]; ok(P["biome"] == "rainforest" and P["size"] == [5, 5] and P["cat"] == "vehicle" and P["walk"], f"{tag}: plan {P}")
    ok((P["rain"] > 0) == mob, f"{tag}: rain only when asked (rainforest ≠ rain) {P['rain']}")
    # ── without the AI library: SAM fails politely, the instant selection still finds the object
    await E("async()=>{const b=await (await fetch('/media/car.png')).blob();await X3.setPhoto(b,'car.png')}")
    ok(await wait_for(E, "()=>X3.S.samReady!==null", 5), f"{tag}: photo loaded")
    await E("()=>X3.S.samReady"); r["sam"] = await E("async()=>await X3.S.samReady"); ok(r["sam"] is False, f"{tag}: SAM unavailable without the AI library → {r['sam']}")
    await E("()=>X3.autoSelect()"); r["classic"] = await E("()=>{const M=X3.S.M;if(!M)return null;const n=M.mask.reduce((a,b)=>a+b,0);return [+(n/M.mask.length).toFixed(3),X3.S.selHow]}")
    ok(r["classic"] and 0.03 < r["classic"][0] < 0.6, f"{tag}: instant selection found an object {r['classic']}")
    # ── the plan with stand-ins for SAM + Depth Anything
    await E(HOOKS); await E("()=>{X3.S.M=null;X3.S.points=[]}")
    await E("()=>X3.run()"); ok(await wait_for(E, "()=>!X3.S.busy&&X3.E.assets.length===1", 40), f"{tag}: the plan ran")
    r["steps"] = await E("()=>X3.S.plan.steps.map(s=>s.id+':'+s.status)"); ok(all(s.endswith(":done") or s.startswith("capture") for s in r["steps"]), f"{tag}: steps {r['steps']}")
    r["asset"] = await E("()=>{const a=X3.E.assets[0];return {stats:a.stats,size:a.size,real:a.realSize,fit:+a.fit.toFixed(2),fits:a.fits,parts:a.object.children.map(c=>c.name)}}")
    A = r["asset"]; ok(A["stats"]["shape"] == "vehicle" and A["stats"]["wheels"] == 4 and A["stats"]["triangles"] > 4000, f"{tag}: a vehicle with wheels {A['stats']}")
    ok({"front", "sides", "rear"} <= set(A["parts"]) and A["parts"].count("wheel") == 4, f"{tag}: front + outline walls + rear + wheels {A['parts']}")
    ok(A["real"] and A["real"][2] > 5 and A["fit"] < 1 and A["fits"], f"{tag}: real-size car {A['real']} shrunk to {A['fit']} to fit 5×5 m with room to walk")
    ok(await E("()=>!document.getElementById('fitWarn').hidden&&!!document.querySelector('[data-x3=realSize]')"), f"{tag}: the fit note offers real size")
    r["world"] = await E("()=>{const i=X3.E.world().info;return [i.biome,i.size,i.instances,X3.E.mode]}"); ok(r["world"][0] == "rainforest" and r["world"][1] == [5, 5] and r["world"][2] > (300 if mob else 1500) and r["world"][3] == "walk", f"{tag}: rainforest 5×5 m, walking {r['world']}")
    shot = "()=>{const c=document.getElementById('cv'),x=document.createElement('canvas');x.width=64;x.height=64;const g=x.getContext('2d');g.drawImage(c,0,0,64,64);const d=g.getImageData(0,0,64,64).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return s/(64*64*3)}"
    r["lit"] = round(await E(shot), 1); ok(r["lit"] > 25, f"{tag}: the scene renders (brightness {r['lit']})")
    # ── walking: blocked by the car, kept inside the plot
    await E("()=>{X3.setMode('walk');X3.E.walk.keys={KeyW:true}}"); await pg.wait_for_timeout(2500); await E("()=>{X3.E.walk.keys={}}")
    r["walkFwd"] = await E("()=>{const a=X3.E.assets[0];return [+X3.E.camera.position.z.toFixed(2),+(a.holder.position.z+a.foot.hz).toFixed(2)]}")
    ok(r["walkFwd"][0] >= r["walkFwd"][1] + 0.2, f"{tag}: can't walk into the car {r['walkFwd']}")
    await E("()=>{X3.E.walk.keys={KeyA:true}}"); await pg.wait_for_timeout(3500); await E("()=>{X3.E.walk.keys={}}")
    r["walkSide"] = await E("()=>[+X3.E.camera.position.x.toFixed(2),X3.E.world().plot.hw]"); ok(r["walkSide"][0] >= -r["walkSide"][1] + 0.27, f"{tag}: kept inside the plot {r['walkSide']}")
    # ── real size: the area grows instead
    await E("()=>document.querySelector('[data-x3=realSize]').click()"); await pg.wait_for_timeout(400)
    r["real"] = await E("()=>{const a=X3.E.assets[0];return [a.fit,a.fits,X3.E.state.size]}"); ok(r["real"][0] == 1 and r["real"][1] and r["real"][2][0] >= 8, f"{tag}: real size + bigger area {r['real']}")
    # ── effects & time of day
    await E("()=>{X3.E.setFX({rain:0.8});X3.E.setTime('night')}"); await pg.wait_for_timeout(300)
    r["fx"] = await E("()=>{const g=X3.E.fx().group;const v=n=>g.getObjectByName(n).visible;return [v('rain'),+X3.E.uniforms.uWet.value.toFixed(2),v('fireflies'),X3.E.state.tod]}")
    ok(r["fx"][0] and r["fx"][1] > 0.7 and r["fx"][2] and r["fx"][3] == "night", f"{tag}: rain wets surfaces, night brings fireflies {r['fx']}")
    await E("()=>{X3.E.setFX({rain:0,snow:0.8});X3.E.setTime('day')}"); r["snow"] = await E("()=>+X3.E.uniforms.uSnow.value.toFixed(2)"); ok(r["snow"] == 0.8, f"{tag}: snow {r['snow']}")
    # ── every biome
    r["biomes"] = await E("()=>{const o={};for(const b of ['forest','snow','desert','beach','meadow','studio','rainforest']){const t=performance.now();const i=X3.setWorld({biome:b,size:[6,6]})||X3.E.world().info;o[b]=[X3.E.world().info.instances,Math.round(performance.now()-t)]}return o}")
    ok(all(v[0] > 0 or k == "studio" for k, v in r["biomes"].items()), f"{tag}: every biome builds {r['biomes']}")
    # ── tour + recorded walk-through
    vid = await E("async()=>{try{const b=await X3.record(3);return [b.size,b.type]}catch(e){return [0,String(e.message)]}}")
    r["video"] = vid  # headless phone emulation gives the recorder no frames; there the studio must say so instead of saving an empty file
    ok(vid[0] > 2000 and "webm" in vid[1] if not mob else (vid[0] > 2000 or "couldn't record" in vid[1]), f"{tag}: walk-through recorded {vid}")
    # ── exports
    r["glb"] = await E("async()=>{const m=async b=>String.fromCharCode(...new Uint8Array(await b.slice(0,4).arrayBuffer()));const s=await X3.E.exportGLB(),o=await X3.E.exportGLB({assetsOnly:true}),u=await X3.E.exportUSDZ();return [await m(s),s.size,await m(o),await m(u)]}")
    ok(r["glb"][0] == "glTF" and r["glb"][1] > 50000 and r["glb"][2] == "glTF" and r["glb"][3].startswith("PK"), f"{tag}: scene .glb, object .glb, .usdz {r['glb']}")
    # ── memory: rebuilding the object and the world doesn't grow GPU memory
    await E("()=>X3.make3D()"); await pg.wait_for_timeout(300); g0 = await E("()=>X3.E.info()")
    for _ in range(3): await E("async()=>{await X3.make3D();X3.setWorld({seed:Math.random()*1e5|0})}")
    await pg.wait_for_timeout(400); g1 = await E("()=>X3.E.info()")
    ok(g1["geometries"] <= g0["geometries"] + 2 and g1["textures"] <= g0["textures"] + 2, f"{tag}: no GPU memory growth {g0['geometries']}/{g0['textures']} → {g1['geometries']}/{g1['textures']}")
    # ── IndexedDB model cache
    r["idb"] = await E("""async()=>{const c=X3.cache;await c.clear();await c.put('https://huggingface.co/x/model.onnx',new Response(new Uint8Array([1,2,3,4,5])));const m=await c.match('https://huggingface.co/x/model.onnx'),u=await c.usage(),miss=await c.match('https://nope');const n=(await m.arrayBuffer()).byteLength;await c.clear();return [n,u.files,u.bytes,miss===undefined]}""")
    ok(r["idb"] == [5, 1, 5, True], f"{tag}: IndexedDB cache {r['idb']}")
    await E("()=>{X3.setWorld({biome:'rainforest',size:[5,5]});X3.E.setTime('day');X3.E.setFX({snow:0});const a=X3.E.assets[0];a.keepReal=false;X3.setMode('orbit');X3.E.frame()}"); await pg.wait_for_timeout(800)
    await pg.screenshot(path=os.environ.get("X3_SHOT", tempfile.gettempdir()) + f"/x3_{w}.png")
    ok(not errs, f"{tag}: page errors {errs[:4]}")
    await b.close(); return r

async def in_nooi(p, w):
    mob = w < 800; tag = ("phone" if mob else "desktop") + " in nooi"; r = {}
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;S.credits=500;renderAll()}" % ("ar" if mob else "en"))
    r["nav"] = await E("()=>[ALLNAV.some(x=>x[0]==='studio3d'),ALLNAV.filter(x=>['world','w3d','l3d'].includes(x[0])).length]"); ok(r["nav"] == [True, 0], f"{tag}: one 3D entry in the menu {r['nav']}")
    await E("()=>go('w3d')"); ok(await wait_for(E, "()=>S.view==='studio3d'&&!!document.querySelector('iframe.x3frame')", 10), f"{tag}: the old 3D World Studio opens the 3D Studio")
    async def frame():
        for _ in range(60):
            f = next((f for f in pg.frames if "/studio3d/" in f.url), None)
            if f:
                try:
                    if await f.evaluate("()=>!!window.X3&&!!X3.S.cfg&&X3.S.cfg.nooi"): return f
                except Exception: pass
            await asyncio.sleep(.25)
        return None
    fr = await frame(); ok(fr is not None, f"{tag}: studio frame talks to the app")
    if fr:
        r["cfg"] = await fr.evaluate("()=>{const c=X3.S.cfg;return [c.nooi,c.signedIn,c.credits,Object.keys(c.cap||{}).length,document.documentElement.dir]}"); ok(r["cfg"][0] and r["cfg"][1] and r["cfg"][3] >= 6 and r["cfg"][4] == ("rtl" if mob else "ltr"), f"{tag}: bridge cfg {r['cfg']}")
        # re-render of the app keeps the frame (no reload)
        await fr.evaluate("()=>{window.__keep=1}"); await E("()=>{renderAll();renderView()}"); await pg.wait_for_timeout(300); fr2 = await frame()
        ok(fr2 is not None and await fr2.evaluate("()=>window.__keep===1"), f"{tag}: the app's re-renders keep the studio running")
    # a photo handed over from another tool (e.g. the editor's 3D tab) arrives in the studio
    await E("async()=>{const b=await (await fetch('/media/car.png')).blob();const u=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(b)});await setS3dFromDataURL(u,'frame 00:03');go('studio3d')}")
    await pg.wait_for_timeout(600); fr = await frame(); ok(fr is not None and await wait_for(fr.evaluate, "()=>!!X3.S.img&&X3.S.name==='frame 00:03'", 15), f"{tag}: the handed-over photo arrived")
    if fr:
        await fr.evaluate(HOOKS); await fr.evaluate("()=>X3.make3D()"); ok(await fr.evaluate("()=>X3.E.assets.length===1"), f"{tag}: 3D made in the frame")
        n0 = await E("()=>S.jobs.filter(j=>j.kind==='3d').length")
        await fr.evaluate("()=>document.querySelector('[data-x3=lib]').click()"); ok(await wait_for(E, f"()=>S.jobs.filter(j=>j.kind==='3d').length>{n0}", 10), f"{tag}: saved to the library")
        r["lib"] = await E("()=>{const j=S.jobs.filter(j=>j.kind==='3d').pop();return [j.meta&&j.meta.ondevice,!!j.thumb,(j.title||'').includes('3D')]}"); ok(r["lib"][0] and r["lib"][1], f"{tag}: library item {r['lib']}")
        if not mob:  # recording needs real frames (desktop run)
            await fr.evaluate("async()=>{await X3.record(3)}")
            await fr.evaluate("()=>document.querySelector('[data-x3=toEditor]').click()")
            ok(await wait_for(E, "()=>S.view==='edit'", 20), f"{tag}: walk-through video opened in the editor")
    ok(not errs, f"{tag}: page errors {errs[:4]}")
    await b.close(); return r

async def main():
    out = {}
    async with async_playwright() as p:
        for w in (390, 1280): out[w] = await standalone(p, w)
        for w in (390, 1280): out[str(w) + "n"] = await in_nooi(p, w)
    return out

if __name__ == "__main__":
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "KIE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="x" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        out = asyncio.run(main())
        print(json.dumps({"fails": fails, "results": out}, ensure_ascii=False, default=str))
    finally:
        srv.terminate(); shutil.rmtree(D, ignore_errors=True)
