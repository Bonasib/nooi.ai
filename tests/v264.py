# v264 — one frame for every page (clean-up step 2): every page's title starts at the same edge; Subtitles & dubbing has its options
# on the start side like every other tool; a phone's tab rows don't repeat what moved in v262. Run: python3 tests/v264.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8793; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v264-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D); json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1400]))
SETUP = "(v)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go(v);renderAll()}"
PAGES = ["home", "explore", "discover", "apps", "image", "video", "crew", "story", "board", "motion", "ugcads", "slideshow", "voice", "subs", "chars", "fx", "finish", "vss", "calendar", "plan", "hooks", "sketch", "coloring", "library", "account", "wallet", "integrations", "support", "flow256"]
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await pg.evaluate(SETUP, "video"); await pg.wait_for_timeout(500)
        xs = {}
        for v in PAGES:
            await pg.evaluate("(v)=>go(v)", v); await pg.wait_for_timeout(250)
            xs[v] = await pg.evaluate("()=>{const e=[...document.querySelectorAll('#main>.view h1,#main>.fillwrap h1,#main>.fillwrap .mode93')].find(x=>x.getBoundingClientRect().width>1);const m=document.querySelector('#main>.view,#main>.fillwrap');return [e?Math.round(e.getBoundingClientRect().left):null,document.documentElement.scrollWidth-innerWidth,m?Math.round(m.getBoundingClientRect().left):null]}")
        edge = {v: x[0] for v, x in xs.items() if v not in ("home", "discover")}   # (Home and Explore open with a banner, not a title)
        chk("computer: every page's title starts at the same edge (264 px), none wider than the screen", all(e == 264 for e in edge.values()) and all(x[1] <= 0 for x in xs.values()) and all(x[2] == 232 for x in xs.values()), xs)
        await pg.evaluate("()=>go('subs')"); await pg.wait_for_timeout(300)
        sb = await pg.evaluate("()=>[...document.querySelector('#main .edgrid').children].map(k=>[Math.round(k.getBoundingClientRect().left),Math.round(k.getBoundingClientRect().width)]).sort((a,b)=>a[0]-b[0])")
        chk("Subtitles & dubbing: the options are the 420 px column on the start side, the video beside it", sb[0] == [264, 420] and sb[1][0] > 684 and sb[1][1] > 600, sb)
        await pg.evaluate("()=>go('hooks')"); await pg.wait_for_timeout(300)
        chk("a page under More shows no tab row on a computer", await pg.evaluate("()=>{const t=document.querySelector('#main .hubtabs');return !t||getComputedStyle(t).display==='none'}"))
        await pg.close()
        ph = await (await b.new_context(**p.devices["iPhone 13"])).new_page(); ph.on("pageerror", lambda e: errs.append(str(e)[:300])); await ph.goto(B + "/"); await ph.wait_for_timeout(1500); await ph.evaluate(SETUP, "video"); await ph.wait_for_timeout(500)
        tabs = {}
        for v in ("video", "image", "story"):
            await ph.evaluate("(v)=>go(v)", v); await ph.wait_for_timeout(350)
            tabs[v] = await ph.evaluate("()=>[...document.querySelectorAll('#main .hubtabs [data-go]')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.dataset.go)")
        chk("phone: the tab rows no longer repeat what moved (film tools → modes; Sketch, Coloring book → More)", tabs["video"] == ["video", "motion", "ugcads", "slideshow"] and tabs["image"] == ["image"] and "board" not in tabs["story"] and "story" in tabs["story"], tabs)
        chk("no page errors", not errs, errs); await b.close()
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v264 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v264 OK")
