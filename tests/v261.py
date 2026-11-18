# v261 — the clean-up, steps 1 and 5. A real nooi server and a browser:
#  · one navigation: on a computer the row of tabs that repeats the side menu is hidden (Video, Image, Audio, Edit, Publish,
#    Explore); Settings keeps its tabs (they aren't in the menu); a phone keeps the tabs
#  · Community is in the side menu; going to another section from anywhere opens its group in the menu
#  · a wall of more than 12 choices (Hook lab's languages) shows ten and the chosen one, "Show all (N)" opens the rest, "Show fewer" folds it
#  · a customer never sees a staff direction ("Admin →") on the Voice page; the owner does
# Run: python3 tests/v261.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8787; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v261-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D); json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1400]))
SETUP = "(v)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go(v);renderAll()}"
TABS = "()=>{const t=document.querySelector('#main>.view>.hubtabs');return t?getComputedStyle(t).display:'none-there'}"
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await E(SETUP, "video"); await pg.wait_for_timeout(500)
        t = {}
        for v in ("video", "image", "voice", "fx", "calendar", "explore", "wallet"):
            await E("(v)=>{go(v)}", v); await pg.wait_for_timeout(250); t[v] = await E(TABS)
        chk("computer: the tab rows that repeat the side menu are hidden; Settings keeps its tabs", all(t[v] == "none" for v in ("video", "image", "voice", "fx", "calendar", "explore")) and t["wallet"] not in ("none", "none-there"), t)
        await E("()=>go('calendar')"); await pg.wait_for_timeout(300)
        m = await E("()=>({com:!!document.querySelector('#sb253 [data-go=\"community204\"]'),open:[...document.querySelectorAll('#sb253 .sbg253.open .sbi253')].map(b=>b.dataset.go),cur:document.querySelector('#sb253 .sbi253[aria-current=page]')?.dataset.go})")
        chk("Community is in the menu; going to Publish from anywhere opens its group", m["com"] and "plan" in m["open"] and m["cur"] == "calendar", m)
        await E("()=>go('hooks')"); await pg.wait_for_timeout(400)
        f1 = await E("()=>{const b=document.querySelector('#main [data-more261]');const box=b&&b.previousElementSibling;const k=box?[...box.children]:[];return b?{t:b.textContent,all:k.length,shown:k.filter(x=>getComputedStyle(x).display!=='none').length,on:k.filter(x=>x.getAttribute('aria-pressed')==='true'&&getComputedStyle(x).display!=='none').length}:null}")
        await pg.click('#main [data-more261]'); await pg.wait_for_timeout(300)
        f2 = await E("()=>{const b=document.querySelector('#main [data-more261]');const k=[...b.previousElementSibling.children];return{t:b.textContent,shown:k.filter(x=>getComputedStyle(x).display!=='none').length}}")
        await pg.click('#main [data-more261]'); await pg.wait_for_timeout(300)
        f3 = await E("()=>{const b=document.querySelector('#main [data-more261]');const k=[...b.previousElementSibling.children];return k.filter(x=>getComputedStyle(x).display!=='none').length}")
        chk("Hook lab: ten languages and the chosen one show; Show all opens the rest; Show fewer folds it", f1 and f1["all"] > 12 and 10 <= f1["shown"] <= 11 and f1["on"] >= 1 and "Show all" in f1["t"] and str(f1["all"]) in f1["t"] and f2["shown"] == f1["all"] and "fewer" in f2["t"] and f3 == f1["shown"], [f1, f2, f3])
        await E("()=>go('voice')"); await pg.wait_for_timeout(500)
        own = await E("()=>document.querySelector('#main').textContent")
        await E("()=>{ME.role=null;ME.perms=[];renderView()}"); await pg.wait_for_timeout(400)   # (a customer: no staff role)
        txt = await E("()=>document.querySelector('#main').textContent")
        staff = await E("()=>typeof staff82==='function'&&staff82()")
        chk("a customer sees no staff direction on the Voice page", (not staff) and "Admin →" not in txt and "AI providers" not in txt, {"staff": staff, "has": "Admin →" in txt, "ownerSaw": "Admin →" in own})
        await pg.close()
        ph = await (await b.new_context(**p.devices["iPhone 13"])).new_page(); await ph.goto(B + "/"); await ph.wait_for_timeout(1500); await ph.evaluate(SETUP, "video"); await ph.wait_for_timeout(500)
        pt = await ph.evaluate(TABS)
        chk("phone: the page keeps its tabs", pt not in ("none", "none-there"), pt)
        chk("no page errors", not errs, errs); await b.close()
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v261 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v261 OK")
