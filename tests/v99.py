# v99 the editor's preview never blinks (desktop + phone, a real nooi server, a real video clip):
#  · dragging the playhead: the preview never paints the grey "Loading…" screen between frames, and the picture follows
#    the playhead (many different frames while dragging)
#  · moving the End slider, changing the speed, playing across a cut between two clips: no "Loading…" screen either
#  · paused and still: the clip isn't asked to jump again and again (no seeks)
#  · a clip that really doesn't load still says "Loading…" (after the short hold)
# Run: python3 tests/v99.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8295
D = tempfile.mkdtemp(prefix="nooi-v99-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
# (VP9: the test browser has no H.264)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-f", "lavfi", "-i", "sine=f=440", "-t", "4",
                "-c:v", "libvpx-vp9", "-b:v", "400k", "-deadline", "realtime", "-c:a", "libopus", "-shortest", D + "/media/clip.webm"], check=True)
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SETUP = """()=>{S.jobs.push({id:'c1',kind:'video',status:'complete',progress:1,created:Date.now(),prompt:'clip',title:'clip',model:'seedance',dur:4,aspect:'16:9',resultUrl:'/media/clip.webm',mediaType:'video',pal:PALS[0],seed:1});
  S.ed.clips=[];const c={id:uid(),src:{k:'job',job:'c1'},in:0,out:4,speed:1,trans:'cut',vol:100};S.ed.clips.push(c);S.ed.sel=c.id;S.ed.tab='clip';go('edit');renderAll()}"""
# counts every "Loading…" the preview paints, the clip's jumps, and the frames it shows
SAMPLER = """()=>{window.__s={lp:0,seeks:0,kt:new Set()};const ft=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas&&this.canvas.id==='wk'&&/Loading|جارٍ التحميل/.test(String(t)))__s.lp++;return ft.call(this,t,...a)};
  const tick=()=>{try{const c=S.ed.clips[0],m=c&&M['c_'+c.id];if(m&&m.type==='video'){__s.kt.add(m._kt);if(!m.el.__h99){m.el.__h99=1;m.el.addEventListener('seeking',()=>__s.seeks++)}}}catch(e){}requestAnimationFrame(tick)};requestAnimationFrame(tick)}"""
READ = "()=>{const r={loading:__s.lp,seeks:__s.seeks,frames:__s.kt.size};__s.lp=0;__s.seeks=0;__s.kt=new Set();return r}"
ACTIONS = [
    ("drag", "async()=>{ED.playing=false;for(let i=0;i<40;i++){ED.t=(i*0.1)%4;await new Promise(q=>setTimeout(q,50))}}"),
    ("still", "()=>{ED.playing=false}"),
    ("end slider", "async()=>{const r=[...document.querySelectorAll('#main input[type=range]')][1];for(let i=0;i<5;i++){r.value=String(4-i*0.4);r.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(q=>setTimeout(q,120))}r.dispatchEvent(new Event('change',{bubbles:true}))}"),
    ("speed", "async()=>{S.ed.tab='speed145';renderView();await new Promise(q=>setTimeout(q,150));const b=[...document.querySelectorAll('#main button')].find(x=>x.textContent.trim()==='0.5×');b.click()}"),   # (v145: the clip's speed has its own tab)
    ("cut", "async()=>{S.ed.clips[0].speed=1;const c={id:uid(),src:{k:'job',job:'c1'},in:1,out:3,speed:1,trans:'cut',vol:100};S.ed.clips.push(c);renderView();await new Promise(q=>setTimeout(q,400));ED.t=3.2;ED.playing=true}"),
]

async def run(b, vw, vh, tag):
    ctx = await b.new_context(viewport={"width": vw, "height": vh}, is_mobile=vw < 768, has_touch=vw < 768, device_scale_factor=2)
    pg = await ctx.new_page(); E = pg.evaluate; errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('en');document.getElementById('modalRoot').innerHTML='';renderAll()}")
    await E(SETUP); await pg.wait_for_timeout(1500); await E(SAMPLER)
    r = {}
    for name, js in ACTIONS:
        await E(READ); await E(js); await pg.wait_for_timeout(1500); r[name] = await E(READ)
    out[tag] = r
    ok(r["drag"]["loading"] == 0 and r["drag"]["frames"] >= 8, f"{tag}: dragging the playhead — no Loading… screen, the picture follows {r['drag']}")
    ok(r["still"]["seeks"] == 0 and r["still"]["loading"] == 0, f"{tag}: paused and still — no jumps, no blink {r['still']}")
    for k in ("end slider", "speed", "cut"):
        ok(r[k]["loading"] == 0, f"{tag}: {k} — no Loading… screen {r[k]}")
    # a clip that really doesn't load still says so (after the short hold)
    await E("()=>{ED.playing=false;const c=S.ed.clips[0],m=M['c_'+c.id];const v=document.createElement('video');m.el=v;ED.t=0.5}")
    await E(READ); await pg.wait_for_timeout(2600); slow = await E(READ); out[tag + "_slow"] = slow
    ok(slow["loading"] > 0, f"{tag}: a clip that doesn't load still shows Loading… {slow}")
    ok(not errs, f"{tag}: no page errors {errs}")
    await ctx.close()

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}",
        AGENTS_AUTO_LEARN="false", KIE_API_KEY="kk", KIE_BASE_URL="http://localhost:9", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            b = await p.chromium.launch()
            await run(b, 1440, 900, "desktop")
            await run(b, 390, 844, "phone")
            await b.close()
    finally: srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
