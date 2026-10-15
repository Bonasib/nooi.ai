# v86: one 3D World instead of 3D worlds + 3D Studio + Physics — in a real browser with a real nooi server (no AI keys: plans are
# made from the words, free). Desktop (English) and Arabic phone:
#  · the page opens empty (v87) and the first words make a world (one engine, quality tier, draw budget), nothing sideways, no page errors
#  · words → a world; a change in the same box ("make it rain and add three horses") keeps the seed; save → new → open again;
#    photo to the library; leave and come back (phones free the 3D engine when you leave)
#  · real physics in the world: pick up and throw a ball, kick a crate, a glass vase shatters when thrown down (desktop)
#  · a photoreal place (Gaussian splats + collider mesh, as World Labs sends them) — WebGL2 for Spark, you walk on the collider
#  · WebGPU asked for on a software GPU: the world keeps drawing (WebGPU, or WebGL2 after the engine falls back)
#  · old doors (/world3d/, ?view=studio3d, go('physics')) open the World; template cards show their drawings; the style and
#    camera-move sheets show pictures and moving diagrams; tool cards have app icons
import asyncio, json, math, os, random, struct, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8179
D = tempfile.mkdtemp(prefix="nooi-v86-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)

# ---- a small photoreal place: a Gaussian-splat PLY (3DGS layout, y-down like World Labs files) + a collider .glb (floor + a box)
def make_splat(media):
    random.seed(3); pts = []; SH0 = 0.28209479177387814
    def add(x, y, z, r, g, b, s=0.08, a=0.95): pts.append((x, y, z, (r - .5) / SH0, (g - .5) / SH0, (b - .5) / SH0, math.log(a / (1 - a)), math.log(s), math.log(s), math.log(s * .6), 1, 0, 0, 0))
    for i in range(-60, 61):
        for k in range(-60, 61):
            if (i + k) % 2: continue
            n = random.random() * .06; add(i * .25, 0, k * .25, .82 + n, .71 + n, .5 + n, .12)
    for _ in range(1500):
        th, ph = random.random() * math.pi * 2, random.random() * math.pi / 2
        add(math.cos(th) * math.cos(ph) * 2, -math.sin(ph) * 2, -6 + math.sin(th) * math.cos(ph) * 2, .75, .2, .18, .09)
    props = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]
    head = "ply\nformat binary_little_endian 1.0\nelement vertex %d\n" % len(pts) + "".join("property float %s\n" % p for p in props) + "end_header\n"
    with open(media + "/world.ply", "wb") as f:
        f.write(head.encode()); [f.write(struct.pack("<14f", *p)) for p in pts]
    V = [(-15, 0, -15), (15, 0, -15), (15, 0, 15), (-15, 0, 15)]; I = [0, 2, 1, 0, 3, 2]; b0 = len(V)
    V += [(x, y, z) for x in (-2, 2) for y in (0, -4) for z in (-8, -4)]
    for a, b, c in [(0, 1, 3), (0, 3, 2), (4, 6, 7), (4, 7, 5), (0, 4, 5), (0, 5, 1), (2, 3, 7), (2, 7, 6), (0, 2, 6), (0, 6, 4), (1, 5, 7), (1, 7, 3)]: I += [b0 + a, b0 + b, b0 + c]
    pos = b"".join(struct.pack("<3f", *v) for v in V); ind = b"".join(struct.pack("<I", i) for i in I)
    js = json.dumps({"asset": {"version": "2.0"}, "scenes": [{"nodes": [0]}], "scene": 0, "nodes": [{"mesh": 0}], "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1}]}],
        "buffers": [{"byteLength": len(pos) + len(ind)}], "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(pos)}, {"buffer": 0, "byteOffset": len(pos), "byteLength": len(ind)}],
        "accessors": [{"bufferView": 0, "componentType": 5126, "count": len(V), "type": "VEC3", "min": [min(v[i] for v in V) for i in range(3)], "max": [max(v[i] for v in V) for i in range(3)]},
                      {"bufferView": 1, "componentType": 5125, "count": len(I), "type": "SCALAR"}]}).encode()
    js += b" " * ((4 - len(js) % 4) % 4); binb = pos + ind; binb += b"\0" * ((4 - len(binb) % 4) % 4)
    body = struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(binb), 0x004E4942) + binb
    open(media + "/collider.glb", "wb").write(struct.pack("<III", 0x46546C67, 2, 12 + len(body)) + body)
make_splat(D + "/media")

SET = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'Sara',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}"
READY = "()=>S.view==='world'&&typeof NW!=='undefined'&&!!NW.E&&!!NW.W&&!NW.busy"
async def until(pg, js, sec=40, arg=None):
    for _ in range(sec * 4):
        try:
            if await (pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)): return True
        except Exception: pass
        await asyncio.sleep(.25)
    return False

INTERACT = """async()=>{const W=NW.W,P=W.physics;const key=(code)=>{dispatchEvent(new KeyboardEvent('keydown',{code}));dispatchEvent(new KeyboardEvent('keyup',{code}))};
  const near=async(rec,d=1.4)=>{const p=rec.body.translation(),pl=W.player.pos,dx=pl.x-p.x,dz=pl.z-p.z,L=Math.hypot(dx,dz)||1;W.player.teleport(p.x+dx/L*d,p.z+dz/L*d);await new Promise(r=>setTimeout(r,400));W.player.face(p.x,p.y,p.z);await new Promise(r=>setTimeout(r,150))};
  const out={types:P.bodies.map(b=>b.type).join(',')},ev0=NW.ev.length;
  const ball=P.bodies.find(b=>b.type==='ball');if(ball){await near(ball);key('KeyE');await new Promise(r=>setTimeout(r,700));out.heldBall=P.held===ball;const p0=ball.body.translation();key('KeyE');await new Promise(r=>setTimeout(r,2200));const p1=ball.body.translation();out.ballMoved=Math.hypot(p1.x-p0.x,p1.z-p0.z)}
  const crate=P.bodies.find(b=>b.type==='crate'||b.type==='box');if(crate){const c0=crate.body.translation();await near(crate,1.2);key('KeyQ');await new Promise(r=>setTimeout(r,1500));const c1=crate.body.translation();out.crateMoved=Math.hypot(c1.x-c0.x,c1.z-c0.z)}
  const vase=P.bodies.find(b=>b.type==='vase');if(vase){await near(vase);key('KeyE');await new Promise(r=>setTimeout(r,900));out.heldVase=P.held===vase;out.lift=vase.body.translation().y-W.terrain.heightAt(vase.body.translation().x,vase.body.translation().z);
    const pp=W.player.pos;W.player.face(pp.x+Math.sin(pp.yaw+Math.PI)*2,pp.y-3,pp.z+Math.cos(pp.yaw+Math.PI)*2);await new Promise(r=>setTimeout(r,200));key('KeyE');await new Promise(r=>setTimeout(r,2500));out.vaseGone=!!vase.gone}
  out.toasts=NW.ev.slice(ev0).map(e=>e.t);return out}"""

async def page_run(p, W, lang):
    mob = W < 600; tag = f"{lang} {W}"; r = {}
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport={"width": W, "height": 844 if mob else 860}, is_mobile=mob, has_touch=mob, accept_downloads=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:240]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await pg.evaluate(SET, lang)
    E = pg.evaluate
    # v87: the World opens EMPTY (nothing is built until you write) — the first words make the first world
    await E("()=>go('world')"); ok(await until(pg, "()=>S.view==='world'&&typeof NW!=='undefined'&&!!NW.E&&!!NW.empty87&&!NW.W", 60), f"{tag}: the 3D World opens empty, waiting for words")
    first = "a quiet park with trees, a pond and a bench" if lang == "en" else "حديقة هادئة فيها أشجار وبركة ومقعد"
    await E("(t)=>{const a=document.getElementById('nwprompt');a.value=t;document.querySelector('[data-act=nw-go]').click()}", first)
    ok(await until(pg, READY, 60), f"{tag}: the first words make the first world")
    r["first"] = await E("()=>{const s=NW.W.stats();return {tier:s.tier,backend:s.backend,calls:s.calls,tris:s.triangles,things:s.things,life:s.life,physics:s.physics,wide:document.documentElement.scrollWidth-innerWidth,h1:(document.querySelector('#main h1')||{}).textContent}}")
    f = r["first"]; ok(f["tier"] in ("low", "mid", "high") and f["calls"] > 0 and f["calls"] < 160 and f["tris"] < 120000 and f["physics"] and f["life"] > 0 and f["wide"] <= 1, f"{tag}: one engine, a draw budget, life and physics, nothing sideways {f}")
    ok(f["h1"] in ("3D World", "عالم 3D"), f"{tag}: the page title {f['h1']}")
    # words → a world; then a change in the same box
    say = "A snowy mountain village at night with a campfire" if lang == "en" else "واحة في الصحراء وقت الغروب فيها جمال ونخيل"
    await E("(t)=>{const a=document.getElementById('nwprompt');a.value=t;document.querySelector('[data-act=nw-go]').click()}", say)
    ok(await until(pg, "(pl)=>!NW.busy&&!!S.world.plan&&S.world.plan.place===pl", 60, "mountain" if lang == "en" else "oasis"), f"{tag}: words → a world " + json.dumps(await E("()=>S.world.plan&&[S.world.plan.place,S.world.plan.time]")))
    seed = await E("()=>S.world.plan.seed")
    if lang == "en": ok(await E("()=>S.world.plan.time>=19||S.world.plan.time<=5"), f"{tag}: it is night")
    else: ok(await E("()=>S.world.plan.life.some(l=>l.type==='camel')"), f"{tag}: camels")
    change = "make it rain and add three horses" if lang == "en" else "اجعلها ممطرة وأضف ثلاثة خيول"
    await E("(t)=>{const a=document.getElementById('nwprompt');a.value=t;document.querySelector('[data-act=nw-go]').click()}", change)
    ok(await until(pg, "()=>!NW.busy&&S.world.plan.weather.kind==='rain'&&S.world.plan.life.some(l=>l.type==='horse'&&l.count>=3)", 40), f"{tag}: the change was made " + json.dumps(await E("()=>[S.world.plan.weather.kind,S.world.plan.life]")))
    ok(await E("()=>S.world.plan.seed") == seed, f"{tag}: a change keeps the same world (seed)")
    # save → new → open again; a photo to the library
    await E("()=>document.querySelector('[data-act=nw-save]').click()")
    ok(await until(pg, "()=>S.world.saved.length===1", 15), f"{tag}: saved " + str(await E("()=>S.world.saved.length")))
    ok(await E("()=>NW.E.running"), f"{tag}: the 3D view is running")
    n0 = await E("()=>S.jobs.length")
    await E("()=>document.querySelector('[data-act=nw-photo]').click()")
    ok(await until(pg, "(n)=>S.jobs.length>n", 20, n0), f"{tag}: a photo of the view went to My library")
    await E("()=>document.querySelector('[data-act=nw-new]').click()"); await pg.wait_for_timeout(600)
    opened = await E("()=>{const b=document.querySelector('[data-act=nw-open]');if(b)b.click();return !!b}")
    ok(opened and await until(pg, "(s)=>!NW.busy&&!!NW.W&&NW.W.plan.seed===s", 30, seed), f"{tag}: a saved world opens again")
    # leave and come back
    await E("()=>go('library')"); await pg.wait_for_timeout(700)
    if mob: ok(await E("()=>!NW.E&&!NW.W"), f"{tag}: leaving frees the 3D engine on a phone")
    await E("()=>go('world')"); ok(await until(pg, READY, 40), f"{tag}: back in the world")
    # physics you can feel (desktop): pick up and throw, kick, a vase shatters
    if not mob:
        await E("async()=>{const M=await nwMods();await nwBuild(M.localPlan('a sunny park with a red ball, a wooden crate and a glass vase'))}")
        ok(await until(pg, READY, 40), f"{tag}: the park is ready")
        await E("()=>NW.W.player.setMode('walk')"); await pg.wait_for_timeout(800)
        r["play"] = await E(INTERACT)
        q = r["play"]; ok(q.get("heldBall") and q.get("ballMoved", 0) > 2 and q.get("crateMoved", 0) > 0.05 and q.get("heldVase") and q.get("lift", 0) > 0.6 and q.get("vaseGone"), f"{tag}: grab, throw, kick, a vase shatters {q}")
        ok(any(t.startswith("Picked up") for t in q.get("toasts", [])) and any(t.startswith("Crash!") for t in q.get("toasts", [])), f"{tag}: what happened is said in words {q.get('toasts')}")
        # a photoreal place: splats + collider (Spark needs WebGL2: the engine switches); you stand on the collider
        await E("async()=>{await nwBuild({place:'beach',splat:{lo:'/media/world.ply',collider:'/media/collider.glb'},objects:[{type:'ball',count:1}],life:[{type:'person',count:2}],seed:4})}")
        ok(await until(pg, "()=>!NW.busy&&!!NW.W&&!!NW.W.splat", 60), f"{tag}: the photoreal place loaded")
        await pg.wait_for_timeout(2500)
        r["splat"] = await E("()=>{const W=NW.W;return {backend:NW.E.backend,trimesh:!!W.terrain.trimesh,h0:W.terrain.heightAt(0,0),walker:W.physics&&W.physics.walker?W.physics.walker.pos.y:null,calls:NW.E.stats().calls}}")
        s = r["splat"]; ok(s["backend"] == "webgl" and s["trimesh"] and abs(s["h0"]) < 0.3 and s["walker"] is not None and -0.2 < s["walker"] < 2.5 and s["calls"] > 0, f"{tag}: Spark draws it on WebGL2 and you stand on its collider {s}")
    # the page itself: template drawings, picture tiles in the sheets, app icons
    await E("()=>{S.exploreType='all';go('explore')}"); await pg.wait_for_timeout(700)
    r["tpl"] = await E("()=>[document.querySelectorAll('.tpl .frame.tplart86 svg').length,document.querySelectorAll('.tpl .frame.tplcov').length,TEMPLATES.length]")
    ok(r["tpl"][0] == r["tpl"][2] and r["tpl"][1] == 0, f"{tag}: every template card shows its own drawing {r['tpl']}")
    await E("()=>go('video')"); await pg.wait_for_timeout(700)
    for k, need in (("style", 8), ("move", 12)):
        await E("()=>{document.getElementById('modalRoot').innerHTML=''}")
        await E("(k)=>{const c=document.querySelector('#main .pk84c[data-pk84=\"'+k+'\"]');c&&c.click()}", k); await pg.wait_for_timeout(500)
        n = await E("()=>document.querySelectorAll('#modalRoot .pk84s .pk86art svg').length")
        ok(n >= need, f"{tag}: the {k} sheet shows a picture per choice ({n})")
    ok(await E("()=>document.querySelectorAll('#modalRoot .pk86art .mvw86').length>=10"), f"{tag}: camera moves are moving diagrams")
    await E("()=>{document.getElementById('modalRoot').innerHTML='';go('home')}"); await pg.wait_for_timeout(600)
    r["icons"] = await E("()=>{const i=[...document.querySelectorAll('#main .tool .ico')];return [i.length,i.filter(x=>/gradient/.test(getComputedStyle(x).backgroundImage)).length]}")
    ok(r["icons"][0] >= 4 and r["icons"][1] == r["icons"][0], f"{tag}: tool cards have app icons {r['icons']}")
    # old doors
    for v in ("studio3d", "w3ai", "physics"):
        await E("(v)=>go(v)", v); await pg.wait_for_timeout(250); ok(await E("()=>S.view==='world'"), f"{tag}: {v} opens the 3D World")
    await pg.goto(f"http://localhost:{PORT}/world3d/"); await pg.wait_for_url("**/?view=world*", timeout=15000); await pg.wait_for_timeout(1200); await pg.evaluate(SET, lang)
    ok(await until(pg, "()=>S.view==='world'", 20), f"{tag}: /world3d/ opens the 3D World")
    if mob: await pg.screenshot(path=os.path.join(tempfile.gettempdir(), "v86_phone.png"))
    ok(not errs, f"{tag}: page errors {errs[:4]}")
    await b.close(); return r

async def webgpu_run(p):
    # WebGPU asked for on a software GPU (SwiftShader): it draws with WebGPU, and if the GPU drops the device the same world goes on
    # in WebGL2 — never a black or frozen view, never an error on the page
    b = await p.chromium.launch(args=["--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader", "--enable-features=Vulkan"])
    pg = await (await b.new_context(viewport={"width": 1100, "height": 760})).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:240]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await pg.evaluate("()=>{try{localStorage.setItem('nooiWorldPrefer','webgpu');localStorage.removeItem('nooiWorldBackend')}catch(e){}}"); await pg.evaluate(SET, "en")
    await pg.evaluate("()=>go('world')"); ok(await until(pg, "()=>S.view==='world'&&!!NW.E&&!!NW.empty87", 60), "WebGPU: the 3D view opens (empty)")
    first = await pg.evaluate("()=>NW.E.backend")
    await pg.evaluate("async()=>{const M=await nwMods();await nwBuild(M.localPlan('a sunny park with trees and a pond'))}")
    ok(await until(pg, READY, 60), "WebGPU: the world opens")
    await pg.wait_for_timeout(8000)
    r = await pg.evaluate("()=>{const s=NW.E.stats();return {first:'%s',now:s.backend,calls:s.calls,fps:s.fps,remember:(()=>{try{return localStorage.getItem('nooiWorldBackend')}catch(e){return null}})()}}" % first)
    ok(r["first"] == "webgpu", f"WebGPU: used when asked for {r}")
    ok(r["calls"] > 0 and r["fps"] > 0 and (r["now"] == "webgpu" or (r["now"] == "webgl" and str(r["remember"]).startswith("webgl:"))), f"WebGPU: still drawing (WebGPU, or WebGL2 after a fall-back that is remembered for a week) {r}")
    ok(not errs, f"WebGPU: page errors {errs[:4]}")
    await pg.evaluate("()=>{try{localStorage.removeItem('nooiWorldPrefer')}catch(e){}}")
    await b.close(); return r

async def main():
    async with async_playwright() as p:
        for W, lang in ((1280, "en"), (390, "ar")): out[f"{W}/{lang}"] = await page_run(p, W, lang)
        out["webgpu"] = await webgpu_run(p)

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "LOCAL_LLM", "GEMMA_", "GOOGLE_", "WORLDLABS_", "WORLD_", "KIE_", "TRIPO_", "MESHY_", "BLOCKADE_", "DASHSCOPE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false", MIRROR_MEDIA="false"),
    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
try:
    for _ in range(80):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
        except Exception: time.sleep(.5)
    try: asyncio.run(main())
    except Exception as e: fails.append("browser checks stopped: " + str(e)[:400])
finally:
    srv.terminate()
    try: out["serverLog"] = srv.stderr.read().decode()[-600:]
    except Exception: pass
print(json.dumps({"fails": fails, **out}, ensure_ascii=False, indent=1))
sys.exit(1 if fails else 0)
