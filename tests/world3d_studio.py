# 3D World Studio (v75) end to end: a fresh nooi server + mocked Tripo3D, Meshy, Blockade Labs Skybox and NVIDIA TRELLIS.
# API: Tripo3D picture → upload → task → poll → .glb · Meshy text → .glb · Skybox → 360° picture + depth map (job segments)
#      · NVIDIA TRELLIS failing → the same 3D job finishes on Tripo3D · 3D jobs pass without a GPU server when an engine is connected.
# Browser (phone + desktop, WebGL): /world3d/ opens the one 3D Studio inside the app; a handed-over photo → on-device preview →
#      Tripo3D / NVIDIA TRELLIS (falling back) generate every side and replace it in place; Skybox → sky + image lighting; .glb export.
import asyncio, json, os, shutil, struct, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MPORT = 8072, 8071
D = tempfile.mkdtemp(prefix="nooi-w3d-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/out")
os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
def glb():  # a real one-triangle glTF binary
    pos = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
    js = json.dumps({"asset": {"version": "2.0"}, "scenes": [{"nodes": [0]}], "scene": 0, "nodes": [{"mesh": 0}], "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}],
        "buffers": [{"byteLength": len(pos)}], "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(pos)}],
        "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3", "min": [0, 0, 0], "max": [1, 1, 0]}]}).encode()
    js += b" " * ((4 - len(js) % 4) % 4); body = struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(pos), 0x004E4942) + pos
    return struct.pack("<III", 0x46546C67, 2, 12 + len(body)) + body
open(D + "/out/model.glb", "wb").write(glb())
FF = os.environ.get("FFMPEG_PATH", "ffmpeg")
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "gradients=size=1024x512:duration=1", "-frames:v", "1", D + "/out/sky.jpg"], check=True)
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "color=gray:size=512x256", "-frames:v", "1", D + "/out/depth.jpg"], check=True)
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x480", "-frames:v", "1", D + "/photo.png"], check=True); shutil.copy(D + "/photo.png", D + "/media/photo.png")
MOCK = r"""
const http=require('http'),fs=require('fs'),O=process.argv[2],P=+process.argv[3];const seen=[];const t={};let n=0;
http.createServer((q,s)=>{const ch=[];q.on('data',c=>ch.push(c));q.on('end',()=>{const raw=Buffer.concat(ch),u=new URL(q.url,'http://x'),ct=q.headers['content-type']||'',body=/json/.test(ct)&&raw.length?JSON.parse(raw):null;
 const J=(d,c)=>{s.statusCode=c||200;s.setHeader('content-type','application/json');s.end(JSON.stringify(d))};seen.push({p:u.pathname,m:q.method,auth:q.headers.authorization||q.headers['x-api-key'],body,ct:ct.split(';')[0]});
 if(u.pathname==='/seen')return J(seen);
 if(u.pathname.startsWith('/out/')){const f=O+u.pathname.slice(4);s.setHeader('content-type',f.endsWith('.glb')?'model/gltf-binary':'image/jpeg');return s.end(fs.readFileSync(f))}
 // Tripo3D
 if(u.pathname==='/tripo/upload')return J({code:0,data:{image_token:'img-tok'}});
 if(u.pathname==='/tripo/task'&&q.method==='POST'){const id='tr'+(++n);t[id]=0;return J({code:0,data:{task_id:id}})}
 if(u.pathname.startsWith('/tripo/task/')){const id=u.pathname.split('/').pop();t[id]=(t[id]||0)+1;return J({code:0,data:t[id]<2?{status:'running',progress:40}:{status:'success',progress:100,output:{pbr_model:'http://localhost:'+P+'/out/model.glb'}}})}
 // Meshy
 if(u.pathname==='/meshy/v2/text-to-3d'&&q.method==='POST')return J({result:'m1'});
 if(u.pathname==='/meshy/v2/text-to-3d/m1'){t.m1=(t.m1||0)+1;return J(t.m1<2?{status:'IN_PROGRESS',progress:50}:{status:'SUCCEEDED',progress:100,model_urls:{glb:'http://localhost:'+P+'/out/model.glb'}})}
 // Blockade Labs Skybox
 if(u.pathname==='/sky/skybox')return J({id:7,status:'pending'});
 if(u.pathname==='/sky/imagine/requests/7'){t.s7=(t.s7||0)+1;return J({request:t.s7<2?{id:7,status:'processing'}:{id:7,status:'complete',file_url:'http://localhost:'+P+'/out/sky.jpg',depth_map_url:'http://localhost:'+P+'/out/depth.jpg'}})}
 // NVIDIA: TRELLIS down → fallback
 if(u.pathname==='/nv/assets')return J({uploadUrl:'http://localhost:'+P+'/nvup',assetId:'a9'});
 if(u.pathname==='/nvup')return s.end();
 if(u.pathname==='/nv/trellis')return J({detail:'Service unavailable'},503);
 if(u.pathname==='/nv/v1/models')return J({data:[]});
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
def job(body):
    j = api("/v1/jobs", body)
    for _ in range(80):
        if j.get("status") in ("done", "failed"): break
        time.sleep(.3); j = api("/v1/jobs/" + j["id"])
    return j
def seen(): return json.loads(urllib.request.urlopen(f"http://localhost:{MPORT}/seen").read())
async def wait_for(E, js, sec=20):
    for _ in range(sec * 4):
        try:
            if await E(js): return True
        except Exception: pass
        await asyncio.sleep(.25)
    return False

HOOKS = """()=>{window.__X3_TEST_MASK=async(img,pts)=>{const w=img.width,h=img.height,a=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h;if(u>.25&&u<.75&&v>.3&&v<.8)a[y*w+x]=255}return{alpha:a,w,h}};
 window.__X3_TEST_DEPTH=async(cv)=>{const w=96,h=Math.max(16,Math.round(96*cv.height/cv.width)),d=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-w/2)/(w*.45),dy=(y-h/2)/(h*.45);d[y*w+x]=1+Math.max(0,1-dx*dx-dy*dy)*3}return{depth:d,w,h,ms:1}};return true}"""
async def studio_frame(pg):
    for _ in range(80):
        f = next((f for f in pg.frames if "/studio3d/" in f.url), None)
        if f:
            try:
                if await f.evaluate("()=>!!window.X3&&!!X3.S.cfg&&X3.S.cfg.nooi"): return f
            except Exception: pass
        await asyncio.sleep(.25)
    return None

async def run(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"; r = {}
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport={"width": w, "height": 860}, is_mobile=mob, has_touch=mob, accept_downloads=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200); E = pg.evaluate
    sign = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;S.credits=50000;persist();renderAll()}" % ("ar" if mob else "en")
    await E(sign)
    # the old /world3d/ address opens the one 3D Studio inside the app
    await pg.goto(f"http://localhost:{PORT}/world3d/"); await pg.wait_for_url("**/?view=studio3d*", timeout=10000); await pg.wait_for_timeout(900); await E(sign)
    ok(await wait_for(E, "()=>S.view==='studio3d'&&!!document.querySelector('iframe.x3frame')", 20), f"{tag}: /world3d/ opens the 3D Studio")
    r["nav"] = await E("()=>[ALLNAV.some(x=>x[0]==='studio3d'),ALLNAV.some(x=>['w3d','world','l3d'].includes(x[0]))]"); ok(r["nav"] == [True, False], f"{tag}: one 3D entry {r['nav']}")
    # a photo handed over → the studio, with every connected engine offered
    await E("async()=>{const b=await (await fetch('/media/photo.png')).blob();const u=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(b)});await setS3dFromDataURL(u,'chair');go('studio3d')}")
    await pg.wait_for_timeout(600); fr = await studio_frame(pg); ok(fr is not None, f"{tag}: studio frame ready")
    if not fr: await b.close(); return r
    ok(await wait_for(fr.evaluate, "()=>!!X3.S.img", 15), f"{tag}: the photo arrived")
    r["cap"] = await fr.evaluate("()=>{const c=X3.S.cfg.cap;return [c.trellis,c.tripo,c.meshy,c.skybox]}"); ok(r["cap"] == [True, True, True, True], f"{tag}: engines {r['cap']}")
    r["btns"] = await fr.evaluate("()=>[...document.querySelectorAll('#cloudBtns [data-x3=cloud]')].map(b=>b.dataset.v)"); ok({"trellis", "tripo", "meshy"} <= set(r["btns"]), f"{tag}: AI buttons for the hidden parts {r['btns']}")
    await fr.evaluate(HOOKS); await fr.evaluate("()=>X3.make3D()"); ok(await fr.evaluate("()=>X3.E.assets.length===1&&X3.E.assets[0].source==='device'"), f"{tag}: on-device preview made")
    # Tripo3D generates every side → replaces the preview in place
    await fr.evaluate("()=>{X3.cloudUpgrade('tripo')}")
    ok(await wait_for(fr.evaluate, "()=>{const a=X3.E.assets[0];return a.source==='tripo'&&a.cloud&&a.cloud.status==='done'}", 40), f"{tag}: Tripo3D model replaced the preview " + json.dumps(await fr.evaluate("()=>X3.E.assets[0].cloud")))
    r["obj"] = await fr.evaluate("()=>{const a=X3.E.assets[0];return [a.size[1],+a.holder.position.y.toFixed(2),X3.E.assets.length]}"); ok(r["obj"][2] == 1 and r["obj"][1] == 0, f"{tag}: same place, on the ground {r['obj']}")
    # NVIDIA TRELLIS (down) → the server finishes the same job on Tripo3D
    await fr.evaluate("()=>{X3.cloudUpgrade('trellis')}")
    ok(await wait_for(fr.evaluate, "()=>{const a=X3.E.assets[0];return a.source==='trellis'&&a.cloud.status==='done'}", 40), f"{tag}: NVIDIA TRELLIS request finished (fallback)")
    # a 360° world from Skybox → sky + image lighting
    await fr.evaluate("()=>{X3.cloudSky('skybox')}")
    ok(await wait_for(fr.evaluate, "()=>X3.E.hasPanorama()", 40), f"{tag}: Skybox 360° world set as sky + lighting")
    r["skyJob"] = await E("()=>{const j=S.jobs.filter(x=>x.kind==='world').pop();return j&&[j.kind,(j.segments||[]).length]}"); ok(r["skyJob"] == ["world", 1], f"{tag}: world job with its depth map {r['skyJob']}")
    r["glb"] = await fr.evaluate("async()=>{const b=await X3.E.exportGLB();return String.fromCharCode(...new Uint8Array(await b.slice(0,4).arrayBuffer()))}"); ok(r["glb"] == "glTF", f"{tag}: scene exported as .glb")
    await pg.screenshot(path=os.environ.get("W3D_SHOT", "/tmp") + f"/w3d_{w}.png")
    ok(not errs, f"{tag}: page errors {errs}")
    await b.close(); return r

async def main():
    out = {}
    async with async_playwright() as p:
        for w in (390, 1280): out[w] = await run(p, w)
    return out

if __name__ == "__main__":
    mk = subprocess.Popen(["node", D + "/mock.js", D + "/out", str(MPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "KIE_"))}
    M = f"http://localhost:{MPORT}"
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="w" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}",
        TRIPO_API_KEY="tsk_test", TRIPO_BASE_URL=M + "/tripo", MESHY_API_KEY="msy_test", MESHY_BASE_URL=M + "/meshy", BLOCKADE_API_KEY="bl_test", BLOCKADE_BASE_URL=M + "/sky",
        NVIDIA_API_KEY="nvapi-test", NVIDIA_BASE_URL=M + "/nv/v1", NVIDIA_ASSETS_URL=M + "/nv/assets"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        api("/v1/admin/providers/nvidia", {"trellisUrl": M + "/nv/trellis", "use": "text:off vision:off image:off edit:off 3d:on video:off"}, "PUT")
        cfg = api("/v1/config"); g = cfg["providers"].get("gen3d", {})
        ok(g == {"tripo": True, "meshy": True, "skybox": True} and not cfg["providers"].get("sam3d"), f"config: engines {g}, no fake SAM 3D server")
        photo = "data:image/png;base64," + __import__("base64").b64encode(open(D + "/photo.png", "rb").read()).decode()
        j = job({"kind": "3d", "prompt": "a chair", "meta": {"mode": "objects", "engine": "tripo"}, "inputs": {"s3dImg": photo}})
        ok(j["status"] == "done" and j["url"].endswith(".glb") and open(D + "/media/" + os.path.basename(j["url"]), "rb").read()[:4] == b"glTF", f"Tripo3D picture → .glb ({j.get('status')} {j.get('error')})")
        sn = seen(); ok(any(x["p"] == "/tripo/upload" and x["ct"] == "multipart/form-data" for x in sn) and any(x["p"] == "/tripo/task" and x["body"] and x["body"]["type"] == "image_to_model" and x["body"]["file"]["file_token"] == "img-tok" for x in sn), "Tripo3D: picture uploaded, image_to_model task with its token")
        ok(all(x["auth"] == "Bearer tsk_test" for x in sn if x["p"].startswith("/tripo")), "Tripo3D key as Bearer")
        j = job({"kind": "3d", "prompt": "a teapot", "meta": {"mode": "objects", "engine": "meshy"}})
        ok(j["status"] == "done" and j["url"].endswith(".glb"), f"Meshy text → .glb ({j.get('status')} {j.get('error')})")
        ok(any(x["p"] == "/meshy/v2/text-to-3d" and x["body"] and x["body"]["prompt"] == "a teapot" and x["auth"] == "Bearer msy_test" for x in seen()), "Meshy text-to-3d request")
        j = job({"kind": "world", "prompt": "a forest at dawn", "meta": {"engine": "skybox"}})
        ok(j["status"] == "done" and j["url"].endswith(".jpg") and j.get("segments") and j["segments"][0].endswith(".jpg"), f"Skybox → 360° picture + depth map ({j.get('status')} {j.get('error')})")
        ok(any(x["p"] == "/sky/skybox" and x["auth"] == "bl_test" and x["body"]["prompt"] == "a forest at dawn" for x in seen()), "Skybox request with x-api-key")
        j = job({"kind": "3d", "prompt": "a lamp", "meta": {"mode": "objects", "engine": "trellis"}, "inputs": {"s3dImg": photo}})
        ok(j["status"] == "done" and j["url"].endswith(".glb") and any(x["p"] == "/nv/trellis" for x in seen()), f"NVIDIA TRELLIS down → finished on Tripo3D ({j.get('status')} {j.get('error')})")
        os.environ["W3D_SHOT"] = os.environ.get("W3D_SHOT", tempfile.gettempdir())
        out = asyncio.run(main())
        print(json.dumps({"fails": fails, "results": out}, ensure_ascii=False, default=str))
    finally:
        srv.terminate(); mk.terminate(); shutil.rmtree(D, ignore_errors=True)
