#!/usr/bin/env python3
"""v283: the Library draws a page of results (48 + Show more), so an account with thousands of results never freezes the page. Port 8683."""
import os, sys, subprocess, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8683; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v283-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
fails = []
def ok(c, m):
    print(("  ok  " if c else "  FAIL ") + m)
    if not c: fails.append(m)
env = dict(os.environ, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", AGENTS_AUTO_LEARN="false", MIRROR_MEDIA="false", NV_AUTOCHECK="false")
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
FILL = """N=>{S.langAsked=true;S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;const now=Date.now();
 for(let i=0;i<N;i++){const v=i%2==0;S.jobs.push({id:'x'+i,remote:'r'+i,kind:v?'video':'image',status:'complete',prompt:'Prompt '+i,title:'T'+i,model:v?'kling30':'nano',cost:10,created:now-i*60000,resultUrl:v?'/media/a.webm':'/media/a.jpg',meta:{aspect:'9:16'}})}
 renderAll()}"""
try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(0.25)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        pg.goto(B + "/"); pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=30000)
        pg.evaluate(FILL, 3000); pg.wait_for_timeout(800)
        CNT = "()=>({cards:document.querySelectorAll('#main .cards .thumb').length,videos:document.querySelectorAll('#main video').length,all:document.querySelectorAll('*').length})"
        t = time.time(); pg.evaluate("go('library')"); d = time.time() - t; c = pg.evaluate(CNT)
        ok(d < 3 and c["cards"] <= 60 and c["all"] < 6000, f"Library with 3,000 results opens with one page ({d:.2f}s, {c})")
        ok(pg.evaluate("!!document.querySelector('[data-act=lib283-more]')") and "2952" in pg.inner_text(".lib283"), "Show more says how many are left")
        t = time.time(); pg.evaluate("go('home')"); pg.wait_for_timeout(200); ok(time.time() - t < 3, f"leaving the Library is quick ({time.time()-t:.2f}s)")
        pg.evaluate("go('library')"); pg.click("[data-act=lib283-more]"); pg.wait_for_timeout(300)
        n = pg.evaluate(CNT)["cards"]; ok(96 <= n <= 110, f"Show more adds the next 48 ({n})")
        pg.evaluate("S.libFilter='image';renderView()"); pg.wait_for_timeout(300)
        n = pg.evaluate(CNT)["cards"]; ok(n <= 60, f"another filter starts from the first page ({n})")
        ok(not errs, f"no page errors {errs}")
        b.close()
finally:
    srv.terminate()
print("v283:", "OK" if not fails else f"{len(fails)} FAILED"); sys.exit(1 if fails else 0)
