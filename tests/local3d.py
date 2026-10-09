# On-device 3D (public/local3d/) in a real browser, phone + desktop. The AI models can't be downloaded in CI, so a synthetic
# depth map (a dome on a flat background) stands in for Depth Anything; everything after it is the real code:
# device detection, the module Worker booting (and failing politely without the AI library), reconstruction (subject from
# depth, closed front + back), PBR maps, wind & snow shaders, falling snow, sun / exposure, a user .hdr sky, .glb export,
# the IndexedDB model cache, no GPU-memory growth across runs, the "whole scene" relief, and the hand-off into nooi's library.
import asyncio, json, os, shutil, struct, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8069
D = tempfile.mkdtemp(prefix="nooi-l3d-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 100, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
FF = os.environ.get("FFMPEG_PATH", "ffmpeg"); subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=480x640", "-frames:v", "1", D + "/photo.png"], check=True)
# a tiny flat (non-RLE) Radiance .hdr: 4×2 pixels
hdr = b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 4\n" + bytes([200, 180, 120, 129] * 8); open(D + "/sky.hdr", "wb").write(hdr)
FAKE = """()=>{window.__L3D_TEST_DEPTH=async(img)=>{const w=256,h=256,d=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-w/2)/(w*0.32),dy=(y-h/2)/(h*0.4),r=dx*dx+dy*dy;d[y*w+x]=r<1?5+3*Math.sqrt(1-r):1+0.05*Math.random()}return{depth:d,w,h,ms:1}}}"""
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

async def run(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"; r = {}
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=mob, has_touch=mob, accept_downloads=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("console", lambda m: errs.append("console: " + m.text[:200]) if m.type == "error" and "ERR_" not in m.text and "Failed to load resource" not in m.text else None)
    await pg.goto(f"http://localhost:{PORT}/local3d/" + ("?lang=ar" if mob else "")); E = pg.evaluate
    ok(await wait_for(E, "()=>!!window.L3D&&!!window.L3D.viewer", 20), f"{tag}: tool loaded with a 3D viewer")
    r["vendor"] = await E("()=>window.NOOI_LOCAL_VENDOR"); ok(r["vendor"] is True, f"{tag}: three.js from this server")
    r["dev"] = await E("()=>{const d=L3D.S.dev;return [typeof d.webgpu,d.webgl2,d.plan.device,d.plan.meshRes,document.getElementById('devBadge').textContent]}")
    ok(r["dev"][0] == "boolean" and r["dev"][1] is True and r["dev"][2] in ("webgpu", "wasm"), f"{tag}: device detected {r['dev']}")
    if mob: ok(await E("()=>document.documentElement.dir==='rtl'&&document.getElementById('go').textContent.includes('اصنع')"), f"{tag}: Arabic + RTL")
    if mob: ok(await E("()=>!/WebGPU isn't|Desktop:/.test(document.getElementById('devAdvice').textContent)"), f"{tag}: device advice in Arabic")
    # the real worker boots and fails politely without the AI library (CDN blocked here)
    await pg.set_input_files("#file", D + "/photo.png"); ok(await wait_for(E, "()=>!document.getElementById('go').disabled", 10), f"{tag}: photo accepted")
    await E("()=>document.getElementById('go').click()")
    ok(await wait_for(E, "()=>!document.getElementById('err').hidden", 40), f"{tag}: without the AI library the error is shown (no hang)")
    r["err"] = await E("()=>document.getElementById('err').textContent"); ok("AI library" in r["err"] or "مكتبة" in r["err"] or "load" in r["err"].lower(), f"{tag}: error text {r['err'][:120]}")
    # with the stand-in depth: a real reconstruction
    await E(FAKE); await E("()=>document.getElementById('go').click()")
    ok(await wait_for(E, "()=>!!L3D.S.last&&document.getElementById('stats').textContent.length>5", 30), f"{tag}: 3D model made")
    r["stats"] = await E("()=>L3D.S.last.stats"); s = r["stats"]
    ok(s["subject"] == "depth" and s["triangles"] > 2000 and s["vertices"] > 1000, f"{tag}: subject from depth, closed mesh {s}")
    r["meshes"] = await E("()=>L3D.S.last.group.children.map(m=>m.name)"); ok(r["meshes"] == ["front", "back"], f"{tag}: front + back {r['meshes']}")
    r["maps"] = await E("()=>{const m=L3D.S.last.group.children[0].material;return [!!m.map,!!m.normalMap,!!m.roughnessMap,m.customProgramCacheKey&&m.customProgramCacheKey()]}")
    ok(r["maps"] == [True, True, True, "nooi-env-v1"], f"{tag}: PBR maps + environment shaders {r['maps']}")
    r["fit"] = await E("()=>{const B=new L3D.viewer.THREE.Box3().setFromObject(L3D.S.last.group),s=B.getSize(new L3D.viewer.THREE.Vector3());return [+Math.max(s.x,s.y,s.z).toFixed(2),+B.min.y.toFixed(3),+s.z.toFixed(2)]}")
    ok(r["fit"][0] == 1.6 and abs(r["fit"][1]) < .01 and r["fit"][2] > .2, f"{tag}: 1.6 m tall on the ground, real depth {r['fit']}")
    ok(await E("()=>document.querySelectorAll('#steps li.done').length>=6"), f"{tag}: progress steps completed")
    # shaders: wind & snow change the picture, snowfall shows, the program compiled without errors
    shot = "()=>{const c=document.getElementById('cv');const x=document.createElement('canvas');x.width=64;x.height=64;const g=x.getContext('2d');g.drawImage(c,0,0,64,64);const d=g.getImageData(0,0,64,64).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return s/(64*64*3)}"
    await pg.wait_for_timeout(500); b0 = await E(shot)
    r["lit"] = await E("()=>{const c=document.getElementById('cv');const x=document.createElement('canvas');x.width=64;x.height=64;const g=x.getContext('2d');g.drawImage(c,0,0,64,64);const d=g.getImageData(26,26,12,12).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return Math.round(s/(144*3))}")
    ok(r["lit"] > 40, f"{tag}: the model is lit by the sky + sun (centre brightness {r['lit']}, black = broken environment map)")
    ok(await E("()=>getComputedStyle(document.getElementById('empty')).display==='none'"), f"{tag}: the 'appears here' hint is gone once there is a model")
    await E("()=>{const s=document.getElementById('snow');s.value='0.9';s.dispatchEvent(new Event('input'))}"); await pg.wait_for_timeout(700); b1 = await E(shot)
    r["snow"] = [round(b0, 1), round(b1, 1), await E("()=>L3D.viewer.scene.getObjectByName('nooi_snowfall').visible")]
    ok(b1 > b0 + 2 and r["snow"][2], f"{tag}: snow brightens the model + snowfall on {r['snow']}")
    await E("()=>{const s=document.getElementById('wind');s.value='2';s.dispatchEvent(new Event('input'))}"); await pg.wait_for_timeout(300)
    r["wind"] = await E("()=>L3D.viewer.uniforms.uWind.value"); ok(r["wind"] == 2, f"{tag}: wind uniform {r['wind']}")
    await E("()=>{const s=document.getElementById('sunEl');s.value='8';s.dispatchEvent(new Event('input'))}"); await pg.wait_for_timeout(400)
    r["programs"] = await E("()=>L3D.viewer.info().programs"); ok(r["programs"] >= 3, f"{tag}: shader programs compiled {r['programs']}")
    # a user .hdr sky
    await pg.set_input_files("#hdr", D + "/sky.hdr"); ok(await wait_for(E, "()=>!document.getElementById('noHdr').hidden&&!!L3D.viewer.scene.background&&L3D.viewer.scene.background.isTexture", 10), f"{tag}: .hdr sky loaded")
    await E("()=>document.getElementById('noHdr').click()"); ok(await E("()=>L3D.viewer.scene.background===null"), f"{tag}: back to the live sky")
    # export
    async with pg.expect_download() as dl:
        await E("()=>document.getElementById('glb').click()")
    data = open(await (await dl.value).path(), "rb").read(); ok(data[:4] == b"glTF" and len(data) > 20000, f"{tag}: .glb exported ({len(data)} bytes)")
    # memory: three more runs, the number of live geometries / textures doesn't grow
    g0 = await E("()=>L3D.viewer.info()")
    for _ in range(3):
        await E("()=>{L3D.S.last=null;document.getElementById('go').click()}"); await wait_for(E, "()=>!!L3D.S.last&&!L3D.S.busy", 30)
    await pg.wait_for_timeout(400); g1 = await E("()=>L3D.viewer.info()")
    ok(g1["geometries"] <= g0["geometries"] and g1["textures"] <= g0["textures"] + 1, f"{tag}: no GPU memory growth {g0} → {g1}")
    # whole-scene relief
    await E("()=>document.querySelector('#subj [data-v=relief]').click()"); await E("()=>{L3D.S.last=null;document.getElementById('go').click()}")
    ok(await wait_for(E, "()=>!!L3D.S.last&&L3D.S.last.stats.subject==='relief'&&L3D.S.last.group.children.length===1", 30), f"{tag}: whole scene as a relief")
    # IndexedDB model cache
    r["idb"] = await E("""async()=>{const c=L3D.cache;await c.clear();await c.put('https://huggingface.co/x/model.onnx',new Response(new Uint8Array([1,2,3,4,5]),{headers:{'content-type':'application/octet-stream'}}));const m=await c.match('https://huggingface.co/x/model.onnx'),u=await c.usage(),miss=await c.match('https://nope');const n=(await m.arrayBuffer()).byteLength;await c.clear();return [n,u.files,u.bytes,miss===undefined]}""")
    ok(r["idb"] == [5, 1, 5, True], f"{tag}: IndexedDB cache put / match / usage {r['idb']}")
    ok(not errs, f"{tag}: page errors {errs[:4]}")
    await pg.screenshot(path=os.environ.get("L3D_SHOT", tempfile.gettempdir()) + f"/l3d_{w}.png", full_page=False)
    # inside nooi: the tool in an iframe hands its model to the library
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go('l3d');renderAll()}")
    ok(await wait_for(E, "()=>!!document.querySelector('.l3dframe')", 10), f"{tag}: nooi page with the tool")
    fr = None
    for _ in range(40):
        fr = next((f for f in pg.frames if "/local3d/" in f.url), None)
        if fr:
            try:
                if await fr.evaluate("()=>!!window.L3D&&!!window.L3D.viewer"): break
            except Exception: pass
        await asyncio.sleep(.25)
    ok(fr is not None, f"{tag}: iframe loaded")
    if fr:
        await fr.evaluate(FAKE); await fr.set_input_files("#file", D + "/photo.png"); await fr.wait_for_timeout(400)
        await fr.evaluate("()=>document.getElementById('go').click()"); await asyncio.sleep(.5)
        for _ in range(60):
            if await fr.evaluate("()=>!!L3D.S.last"): break
            await asyncio.sleep(.25)
        ok(await fr.evaluate("()=>!document.getElementById('toNooi').hidden"), f"{tag}: 'Save to my nooi library' shown when embedded")
        n0 = await E("()=>S.jobs.filter(j=>j.meta&&j.meta.ondevice).length")
        await fr.evaluate("()=>document.getElementById('toNooi').click()")
        ok(await wait_for(E, f"()=>S.jobs.filter(j=>j.meta&&j.meta.ondevice).length>{n0}", 10), f"{tag}: model saved into the nooi library")
        r["lib"] = await E("()=>{const j=S.jobs.filter(j=>j.meta&&j.meta.ondevice).slice(-1)[0];return [j.kind,j.status,/#nooi\\.glb$/.test(EXPORTS[j.id]||''),!!j.thumb]}")
        ok(r["lib"] == ["3d", "complete", True, True], f"{tag}: library entry {r['lib']}")
    await b.close(); return r

async def main():
    out = {}
    async with async_playwright() as p:
        for w in (390, 1280): out[w] = await run(p, w)
    return out

if __name__ == "__main__":
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "KIE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="l" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        out = asyncio.run(main())
        print(json.dumps({"fails": fails, "results": out}, ensure_ascii=False, default=str))
    finally:
        srv.terminate(); shutil.rmtree(D, ignore_errors=True)
