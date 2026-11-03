# v225 — the owner's phone video, fixed, and the classic editor's motions and stickers in the studio.
#  · Stickers: 10 banners (each shown as it looks; its lines and colour set before it is added) and 36 icon stickers (Material
#    Symbols) — added as pictures that come in with a motion
#  · Motion: the 20 classic motions (Animate.css) — each tile plays its example; on a clip they become keyframes
#  · the outline on the picture is the clip's real picture; a clip moved out of the frame gets "Put it back"
#  · a phone needs a deliberate half-second hold before a touch moves a clip (a quick swipe moves nothing)
#  · the account copy leaves out the filmstrips (the project stays small); a failed save says why
# Run: python3 tests/v225.py
import asyncio, glob, json, os, subprocess, sys, tempfile
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8726; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v225-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "400k", D + "/a.webm"], check=True, timeout=120)
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
P = "window.__studio.editor.project"
LAST = "()=>{const c=" + P + ".tracks.flatMap(t=>t.clips).sort((a,b)=>(b.id>a.id?1:-1));const e=window.__studio.editor,s=e.selection[0];const k=" + P + ".tracks.flatMap(t=>t.clips).find(x=>x.id===s);return k?{name:k.name,kf:Object.keys(k.keyframes).filter(n=>k.keyframes[n]&&k.keyframes[n].length).sort(),sc:k.transform.scale,y:k.transform.y,a:" + P + ".assets[k.asset]&&" + P + ".assets[k.asset].w}:null}"

async def boot(pg):
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)

async def desktop(p):
    b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1440, "height": 900}); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await boot(pg)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/a.webm")
    await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.duration>3&&a.w)", timeout=20000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a,0)}"); await pg.wait_for_timeout(300)
    # ---- stickers: banners and icons
    await pg.click('[data-testid="rail-stickers"]'); await pg.wait_for_timeout(400)
    r = await E("()=>({ban:[...document.querySelectorAll('.panel [data-testid^=ban-]')].filter(b=>b.querySelector('img')&&b.querySelector('img').naturalWidth>100).length,ico:[...document.querySelectorAll('.panel [data-testid^=ico-]')].filter(b=>b.querySelector('img').naturalWidth>=128).length})")
    chk("Stickers: 10 banners and 36 icon stickers, each shown as it looks", r == {"ban": 10, "ico": 36}, r)
    await pg.click('[data-testid="ban-sub"]'); await pg.fill('[data-testid="ban-l1"]', "Join the crew"); await pg.click('[data-testid="ban-add"]'); await pg.wait_for_timeout(900)
    ban = await E(LAST)
    chk("a banner is added with its own words, low in the frame, coming in with a motion", ban and ban["name"].startswith("banner-sub") and ban["y"] == 0.3 and "opacity" in ban["kf"] and "y" in ban["kf"], ban)
    await pg.click('[data-testid="ico-favorite"]'); await pg.wait_for_timeout(900); ic = await E(LAST)
    chk("an icon sticker is added as a picture that bounces in", ic and ic["name"].startswith("sticker-favorite") and "scale" in ic["kf"] and "opacity" in ic["kf"], ic)
    await E("()=>window.__studio.player.seek(2)"); await pg.wait_for_timeout(700)
    px = await E("()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),d=new Uint8Array(4);g.readPixels(Math.round(c.width*0.5),Math.round(c.height*0.5),1,1,g.RGBA,g.UNSIGNED_BYTE,d);return Array.from(d.slice(0,3))}")
    chk("the heart is drawn on the picture (red in the middle)", px[0] > 180 and px[1] < 140, px)
    # ---- motions with their examples
    await pg.click('[data-testid="rail-effects"]'); await pg.click('.panel .subtabs button:has-text("Motion")'); await pg.wait_for_timeout(400)
    r = await E("()=>{const t=[...document.querySelectorAll('.panel [data-testid^=ac-]')];return{n:t.length,playing:t.filter(b=>{const i=b.querySelector('.acx i');return i&&getComputedStyle(i).animationName.startsWith('ac-')&&i.getAnimations().length>0}).length,old:document.querySelectorAll('.panel [data-testid^=mo-]').length}}")
    chk("Motion: the 20 classic motions, each playing its example, next to the camera moves", r == {"n": 20, "playing": 20, "old": 13}, r)
    await pg.click('[data-testid="ac-tada"]'); await pg.wait_for_timeout(300); k = await E("()=>{const s=window.__studio.editor.selection[0],c=" + P + ".tracks.flatMap(t=>t.clips).find(x=>x.id===s);return{sc:(c.keyframes.scale||[]).length,rot:(c.keyframes.rotation||[]).length}}")
    chk("a motion on a clip becomes keyframes (tada repeats through the clip)", k["sc"] >= 20 and k["rot"] >= 20, k)
    # ---- the outline is the real picture; a clip out of the frame gets "Put it back"
    await E("()=>{const e=window.__studio.editor,c=" + P + ".tracks.find(t=>t.name==='V1').clips[0];e.select([c.id]);e.run('m',p=>{const k=p.tracks.find(t=>t.name==='V1').clips[0];k.transform.scale=0.5;k.transform.y=0});window.__studio.player.seek(1)}"); await pg.wait_for_timeout(500)
    hb = await E("()=>{const h=document.querySelector('[data-testid=handle]').getBoundingClientRect(),s=document.querySelector('.stage').getBoundingClientRect();return[+(h.width/s.width).toFixed(2),+(h.height/s.height).toFixed(2)]}")
    chk("the outline on the picture is the clip's own picture (half size → half the frame)", hb == [0.5, 0.5], hb)
    await E("()=>{window.__studio.editor.run('m',p=>{const k=p.tracks.find(t=>t.name==='V1').clips[0];k.transform.scale=1;k.transform.y=0.64})}"); await pg.wait_for_timeout(400)
    lost = await pg.locator('[data-testid="offframe"]').count(); await pg.click('[data-testid="put-back"]'); await pg.wait_for_timeout(300)
    back = await E("()=>{const k=" + P + ".tracks.find(t=>t.name==='V1').clips[0];return[k.transform.x,k.transform.y,document.querySelectorAll('[data-testid=offframe]').length]}")
    chk("a clip pushed out of the frame says so, and Put it back brings it back", lost == 1 and back == [0, 0, 0], [lost, back])
    # ---- saving to the account: no filmstrips in the account copy
    await E("()=>window.__studio.editor.run('n',p=>{p.name='Slim'})"); await pg.wait_for_function("document.querySelector('[data-testid=cloud]').className.includes('saved saved')", timeout=20000)
    files = glob.glob(D + "/data/projects139/*/*.json"); doc = json.load(open(files[0])) if files else {}
    st = doc.get("studio") or {}; strips = [a for a in (st.get("assets") or {}).values() if a.get("strip")]; mem = await E("()=>Object.values(" + P + ").length&&Object.values(" + P + ".assets).filter(a=>a.strip).length")
    chk("the account copy leaves out the filmstrips (this device keeps them)", files and st.get("name") == "Slim" and not strips and mem >= 1, {"files": len(files), "strips": len(strips), "mem": mem})
    chk("desktop: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await boot(pg)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/a.webm")
    await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.duration>3&&a.w)", timeout=20000); await pg.click('[data-testid="sheet-close"]')
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a,0);const c=" + P + ".tracks.flatMap(t=>t.clips)[0];s.editor.select([c.id]);s.player.seek(1)}"); await pg.wait_for_timeout(600)
    SW = """async(hold)=>{const h=document.querySelector('[data-testid=handle]');const r=h.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      const ev=(t,el,dy)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y+dy}));
      ev('pointerdown',h,0);await new Promise(r=>setTimeout(r,hold));for(const d of [10,30,60,90])ev('pointermove',window,d);ev('pointerup',window,90);await new Promise(r=>setTimeout(r,150));
      return +window.__studio.editor.project.tracks.flatMap(t=>t.clips)[0].transform.y.toFixed(3)}"""
    quick = await E(SW, 220); slow = await E(SW, 650)
    chk("phone: a quick swipe over the picture moves nothing; a half-second hold, then a drag, moves the clip", quick == 0 and slow > 0.1, [quick, slow])
    m = await E("()=>[getComputedStyle(document.querySelector('.tlbar>.fadeend')).backgroundImage,(()=>{const e=document.querySelector('.cbs');return getComputedStyle(e).maskImage||getComputedStyle(e).webkitMaskImage})()]")
    chk("phone: the tool bars fade at the edge (they scroll)", all("gradient" in x for x in m), m)
    chk("phone: no page errors", not errs, errs); await b.close()

async def main():
    import urllib.request, time
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f in (desktop, phone):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:600])

try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps(out, ensure_ascii=False)[:600])
if fails: print("v225 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v225 OK")
