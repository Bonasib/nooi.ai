# v251 — the owner's five notes:
#  · "no sound in the MiniMax videos": a video that asks for sound goes to Seedance (it makes sound) even with "Everything on
#    MiniMax" on; without sound it stays on MiniMax (tests/v251_route.mjs)
#  · "the prompt box should show the picture's own name, not image": a picture called elias.png is #elias; a camera number
#    (IMG_1234.jpg) is still image1
#  · "a video or a picture can't be tapped to watch it": every finished result has an open button (the full-screen viewer, with
#    Download); a tap on a picture opens it
#  · "Seedance is slow and stays on the waiting mark": a result being made says what is happening, for how long (ticking), and that
#    Seedance usually takes a few minutes
#  · "the editor's header must be the same as the site's": the studio opens under the site's header — the green tile, the site's
#    sections, theme, search, credits, language, Library, account — on a computer and (with the sections menu) on a phone
# Run: python3 tests/v251.py
import asyncio, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8773; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v251-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", D + "/media/v.webm")
FF("-f", "lavfi", "-i", "color=c=red:s=300x300", "-frames:v", "1", D + "/media/p.png"); shutil.copy(D + "/media/p.png", D + "/elias.png"); shutil.copy(D + "/media/p.png", D + "/IMG_1234.png")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "MINIMAX_", "SEEDANCE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1200]))
SETUP = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go('home');renderAll()}"

async def site(p):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 390, "height": 844})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await E(SETUP); await pg.wait_for_timeout(500)
    # ---- the picture's own name in the prompt
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(500)
    await pg.set_input_files("input[data-ref130]", [D + "/elias.png", D + "/IMG_1234.png"]); await pg.wait_for_timeout(600)
    tags = await E("()=>(S.draft.refs130||[]).map(r=>r.tag)")
    chk("a picture's own name in the prompt (#elias); a camera number stays image1", tags == ["elias", "image1"], tags)
    # ---- results: open big, and what a waiting one is doing
    now = int(time.time() * 1000)
    await E("(now)=>{S.jobs=[{id:'j1',kind:'video',status:'complete',prompt:'Elias walking',resultUrl:'/media/v.webm',model:'seedance20',created:now-60000},{id:'j2',kind:'image',status:'complete',prompt:'red',resultUrl:'/media/p.png',model:'nano',created:now-60000},{id:'j3',kind:'video',status:'rendering',prompt:'Elias runs on the ice',model:'seedance20',created:now-125000}];S.hf=S.hf||{};S.hf.out=['j3','j1','j2'];go('home');renderAll()}", now)
    await pg.wait_for_timeout(800)
    z = await E("()=>[...document.querySelectorAll('.hfrc .hfzoom251')].map(b=>b.dataset.kind)")
    st = await E("()=>{const p=document.querySelector('.hfst251');return p&&p.textContent}")
    await pg.wait_for_timeout(1300); st2 = await E("()=>{const p=document.querySelector('.hfst251 b');return p&&p.textContent}")
    chk("a waiting Seedance result says what is happening, for how long (ticking), and that it takes a few minutes", st and "Being made" in st and re.search(r"2:0\d", st) and "2–8 minutes" in st and st2 != re.search(r"\d+:\d\d", st).group(0), [st, st2])
    await pg.locator(".hfrc .hfzoom251[data-kind=video]").scroll_into_view_if_needed(); await pg.click(".hfrc .hfzoom251[data-kind=video]"); await pg.wait_for_timeout(500)
    v = await E("()=>{const d=document.querySelector('.mv80');return d&&{video:!!d.querySelector('video.mvm'),dl:!!d.querySelector('a[download]')}}")
    await pg.screenshot(path=D + "/viewer.png"); await E("()=>document.querySelector('.mv80 .mvx').click()"); await pg.wait_for_timeout(300)
    await pg.click(".hfrc .hfrm > img"); await pg.wait_for_timeout(400); im = await E("()=>{const d=document.querySelector('.mv80');return d&&!!d.querySelector('img.mvm')}")
    chk("every finished result has an open button; the video and a tapped picture open full screen (with Download)", sorted(z) == ["image", "video"] and v == {"video": True, "dl": True} and im, [z, v, im])
    await E("()=>document.querySelector('.mv80 .mvx')?.click()"); await pg.wait_for_timeout(200); await pg.screenshot(path=D + "/results.png", full_page=False)
    chk("site: no page errors", not errs, errs); await b.close()

async def studio(p, w, h, name):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": w, "height": h})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(800)
    r = await E("""()=>{const h=document.querySelector('.sitebar.sitehdr');if(!h)return null;const q=s=>h.querySelector(s),R=e=>e&&e.getBoundingClientRect();
      const kids=[...h.querySelectorAll('.shlogo,.snav a,.shright > *,[data-testid=site-menu]')].filter(e=>R(e).width>0).map(e=>{const r=R(e);return[e.className||e.tagName,Math.round(r.left),Math.round(r.right),Math.round(r.top),Math.round(r.bottom)]});
      let over=0;for(let i=0;i<kids.length;i++)for(let j=i+1;j<kids.length;j++){const a=kids[i],c=kids[j];if(a[1]<c[2]-1&&c[1]<a[2]-1&&a[3]<c[4]-1&&c[3]<a[4]-1)over++}
      return{logo:getComputedStyle(q('.shlogo')).backgroundColor,nav:[...h.querySelectorAll('.snav a')].map(a=>a.textContent),menu:!!q('[data-testid=site-menu]'),credits:!!q('.shcredits'),lang:!!q('[data-testid=lang]'),av:!!q('.shav'),theme:!!q('[data-testid=site-theme]'),
        over,spill:h.scrollWidth-h.clientWidth,page:document.documentElement.scrollWidth-innerWidth,top:Math.round(R(h).top),hh:Math.round(R(h).height),topbar:!!document.querySelector('.topbar')}}""")
    await pg.screenshot(path=D + f"/studio-{name}.png", clip={"x": 0, "y": 0, "width": w, "height": min(h, 140)})
    if w >= 1024: chk(f"studio {name}: the site's header — green tile, the site's 9 sections (Studio is this page), theme, credits, language, account; the studio's own bar under it", r and r["logo"] == "rgb(193, 255, 114)" and len(r["nav"]) == 9 and r["nav"][1].startswith("Studio") and r["credits"] and r["lang"] and r["av"] and r["theme"] and r["top"] == 0 and r["topbar"] and not r["over"] and r["page"] <= 0, r)
    else: chk(f"studio {name}: the site's header with the sections behind the menu button, nothing overlapping or wider than the screen", r and r["logo"] == "rgb(193, 255, 114)" and r["menu"] and r["credits"] and r["lang"] and r["av"] and not r["over"] and r["page"] <= 0 and r["spill"] <= 0, r)
    chk(f"studio {name}: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f, a in ((site, ()), (studio, (1440, 900, "desktop")), (studio, (390, 844, "phone")), (studio, (820, 1180, "tablet"))):
            try: await f(p, *a)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
if fails: print("v251 FAIL\n - " + "\n - ".join(fails)); print("shots:", D); sys.exit(1)
if os.environ.get("KEEP"): print("shots:", D)
else: subprocess.run(["rm", "-rf", D])
print("v251 OK")
