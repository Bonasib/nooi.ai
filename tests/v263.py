# v263 — look fixes found by going through every page: the nine agents in one even row (the ninth dropped onto a second line),
# three across on a phone; Workflows' title icon; no too-small buttons on nooi Studio on a phone. Run: python3 tests/v263.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8791; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v263-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D); json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1400]))
SETUP = "(v)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go(v);renderAll()}"
ROW = "()=>{const c=[...document.querySelectorAll('#main .crewline .botcard')].map(e=>e.getBoundingClientRect());return{n:c.length,rows:[...new Set(c.map(r=>Math.round(r.top)))].length,w:[...new Set(c.map(r=>Math.round(r.width)))].length,last:Math.round(c[c.length-1].right),page:document.documentElement.scrollWidth-innerWidth}}"
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await pg.evaluate(SETUP, "crew"); await pg.wait_for_timeout(600)
        d = await pg.evaluate(ROW)
        chk("computer: the nine agents are one even row (none dropped onto a second line)", d["n"] == 9 and d["rows"] == 1 and d["w"] <= 2 and d["last"] <= 1440 and d["page"] <= 0, d)
        await pg.evaluate("()=>go('flow256')"); await pg.wait_for_timeout(400)
        chk("Workflows' title has the tool icon beside it", await pg.evaluate("()=>!!document.querySelector('#main h1 .tchip90 svg')"))
        await pg.close()
        ph = await (await b.new_context(**p.devices["iPhone 13"])).new_page(); ph.on("pageerror", lambda e: errs.append(str(e)[:300])); await ph.goto(B + "/"); await ph.wait_for_timeout(1500); await ph.evaluate(SETUP, "crew"); await ph.wait_for_timeout(600)
        m = await ph.evaluate(ROW)
        chk("phone: the agents are three across (3 × 3), inside the screen", m["n"] == 9 and m["rows"] == 3 and m["page"] <= 0, m)
        await ph.evaluate("()=>go('video')"); await ph.wait_for_timeout(500)
        t = await ph.evaluate("()=>[...document.querySelectorAll('#main button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.top>0&&r.top<innerHeight&&r.height<28}).map(e=>(e.className||'')+' '+Math.round(e.getBoundingClientRect().height))")
        chk("phone: no button on nooi Studio is shorter than 28 px", not t, t)
        chk("no page errors", not errs, errs); await b.close()
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v263 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v263 OK")
