# 3D World Studio (v75) end to end: a fresh nooi server + mocked Tripo3D, Meshy, Blockade Labs Skybox and NVIDIA TRELLIS.
# API: Tripo3D picture → upload → task → poll → .glb · Meshy text → .glb · Skybox → 360° picture + depth map (job segments)
#      · NVIDIA TRELLIS failing → the same 3D job finishes on Tripo3D · 3D jobs pass without a GPU server when an engine is connected.
# Browser (phone + desktop, WebGL): /world3d/ opens the studio inside the app, a prompt → object loaded into the three.js scene
#      (placeholder → real model), gizmo modes, a 360° world → sky + image lighting, library re-add, scene .glb export,
#      3D Studio's main button goes to the 3D engine (no "3D generation is not available yet"), 3D worlds' AI button → Skybox.
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
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x480", "-frames:v", "1", D + "/photo.png"], check=True)
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

async def run(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"; r = {}
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport={"width": w, "height": 860}, is_mobile=mob, has_touch=mob, accept_downloads=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200); E = pg.evaluate
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;S.credits=50000;S.w3d=null;persist()}" % ("ar" if mob else "en"))
    await pg.goto(f"http://localhost:{PORT}/world3d/"); await pg.wait_for_url("**/?view=w3d*", timeout=10000); await pg.wait_for_timeout(900)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;S.credits=50000;S.w3d=null;renderAll()}" % ("ar" if mob else "en"))
    ok(await wait_for(E, "()=>S.view==='w3d'&&!!window.W3D&&!!document.querySelector('#w3stage canvas')", 20), f"{tag}: /world3d/ opens the studio with a 3D canvas")
    r["nav"] = await E("()=>ALLNAV.some(x=>x[0]==='w3d')"); ok(r["nav"], f"{tag}: studio in the menu")
    r["eng"] = await E("()=>[...document.querySelectorAll('[data-w3=eng]')].map(b=>b.dataset.v+(b.disabled?'-off':''))")
    ok("tripo" in r["eng"] and "meshy" in r["eng"] and "nvidia-off" not in r["eng"], f"{tag}: engines listed {r['eng']}")
    # object from words on Tripo3D
    await E("()=>{document.querySelector('[data-w3=eng][data-v=tripo]').click()}"); await pg.wait_for_timeout(200)
    await E("()=>{const q=document.querySelector('#w3q');q.value='a red vintage motorbike';q.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-w3form]').requestSubmit()}")
    ok(await wait_for(E, "()=>S.w3d.items.length===1&&Object.keys(W3D.state.loaded).length===1", 30), f"{tag}: Tripo3D model loaded into the scene")
    r["obj"] = await E("()=>{const o=Object.values(W3D.state.loaded)[0];const b=new THREE.Box3().setFromObject(o),s=b.getSize(new THREE.Vector3());return [+Math.max(s.x,s.y,s.z).toFixed(2),+b.min.y.toFixed(2),!!W3D.state.sel]}")
    ok(r["obj"][0] == 1.6 and abs(r["obj"][1]) < .02 and r["obj"][2], f"{tag}: model fitted to 1.6 m, standing on the ground, selected {r['obj']}")
    # gizmo & placement saved
    await E("()=>document.querySelector('[data-w3=gizmo][data-v=rotate]').click()"); r["gizmo"] = await E("()=>W3D.state.tc&&W3D.state.tc.getMode()"); ok(r["gizmo"] == "rotate", f"{tag}: gizmo mode {r['gizmo']}")
    # 360° world from Skybox
    await E("()=>document.querySelector('[data-w3=mode][data-v=world]').click()"); await pg.wait_for_timeout(200)
    await E("()=>{const q=document.querySelector('#w3q');q.value='a neon night market';document.querySelector('[data-w3form]').requestSubmit()}")
    sky = await wait_for(E, "()=>!!S.w3d.sky&&W3D.state.scene.background&&W3D.state.scene.background.isTexture", 30)
    ok(sky, f"{tag}: Skybox world set as sky + lighting " + ("" if sky else json.dumps(await E("()=>({mode:S.w3d.mode,jobs:S.w3d.jobs,sky:S.w3d.sky,world:S.jobs.filter(j=>j.kind==='world').map(j=>[j.status,j.error,j.remote,!!mediaUrl(j)]),bg:String(W3D.state.scene.background&&W3D.state.scene.background.type)})"))))
    r["skyJob"] = await E("()=>{const j=S.jobs.find(x=>x.id===S.w3d.sky);return j&&[j.kind,(j.segments||[]).length]}"); ok(r["skyJob"] == ["world", 1], f"{tag}: world job with its depth map {r['skyJob']}")
    # re-add from the library, export
    await E("()=>{const b=document.querySelector('[data-w3=add]');b&&b.click()}"); ok(await wait_for(E, "()=>Object.keys(W3D.state.loaded).length===2", 15), f"{tag}: re-added from the library")
    async with pg.expect_download() as dl:
        await E("()=>document.querySelector('[data-w3=glb]').click()")
    d = await dl.value; pth = await d.path(); data = open(pth, "rb").read(); ok(data[:4] == b"glTF", f"{tag}: scene exported as .glb")
    await pg.screenshot(path=os.environ.get("W3D_SHOT", "/tmp") + f"/w3d_{w}.png")
    # 3D Studio main button → 3D engine, not "not available yet"
    await E("()=>{S.s3d.mode='objects';go('studio3d');renderAll()}"); await pg.wait_for_timeout(700)
    await pg.set_input_files("input[data-s3dfile]", D + "/photo.png"); await pg.wait_for_timeout(800)
    n0 = await E("()=>S.jobs.filter(j=>j.kind==='3d').length")
    await E("()=>{S.s3d.points=[{x:.5,y:.5,pos:true}];renderView()}"); await pg.wait_for_timeout(300)
    await E("()=>{const b=document.querySelector('[data-act=s3d-run]');b.disabled=false;b.click()}")
    ok(await wait_for(E, f"()=>S.jobs.filter(j=>j.kind==='3d').length>{n0}&&S.jobs.filter(j=>j.kind==='3d').slice(-1)[0].remote", 15), f"{tag}: 3D Studio's button sent a 3D engine job")
    ok(await wait_for(E, "()=>{const j=S.jobs.filter(j=>j.kind==='3d').slice(-1)[0];return j.status==='complete'}", 30), f"{tag}: … and it finished")
    # 3D worlds: the AI button → Skybox (no "not connected")
    await E("()=>{S.wld.prompt='desert canyon at sunset';go('world');renderAll()}"); await pg.wait_for_timeout(600)
    r["chips"] = await E("()=>!!document.querySelector('[data-set=\"wld.engine\"]')"); ok(not r["chips"], f"{tag}: unconnected world-engine chips hidden")
    w0 = await E("()=>S.jobs.filter(j=>j.kind==='world').length")
    await E("()=>{const b=document.querySelector('[data-act=wld-ai]');b&&b.click()}")
    ok(await wait_for(E, f"()=>S.jobs.filter(j=>j.kind==='world').length>{w0}", 10), f"{tag}: 3D worlds' AI button → Skybox job")
    ok(await wait_for(E, "()=>!!PW.mesh&&PW.mesh.name==='nooi_world360_depth'", 30), f"{tag}: world shown with its depth map")
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
