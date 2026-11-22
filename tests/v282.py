#!/usr/bin/env python3
"""v282: one menu — on a computer or tablet the top bar is the site's only menu (no side menu repeating it), and the editor
(/studio/) draws the very same sections, tools and More from what the site's bar saved. Port 8482."""
import os, sys, subprocess, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8482; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v282-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
fails = []
def ok(c, m):
    print(("  ok  " if c else "  FAIL ") + m)
    if not c: fails.append(m)
env = dict(os.environ, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", MIRROR_MEDIA="false")
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
SETUP = "(a)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(a[0]);document.getElementById('modalRoot').innerHTML='';go(a[1])}"
MAIN = "()=>{const sb=document.getElementById('sb253');return{side:sb&&sb.offsetParent?sb.offsetWidth:0,pad:parseFloat(getComputedStyle(document.querySelector('.app')).paddingInlineStart),logo:document.querySelector('.tnlogo279').offsetWidth,secs:[...document.querySelectorAll('.tni279[data-tn279sec]')].map(x=>x.dataset.tn279sec),shown:[...document.querySelectorAll('#main>.topm .tni279')].filter(x=>!x.hidden).map(x=>x.dataset.tn279sec||'more'),saved:JSON.parse(localStorage.getItem('nooi.nav282')||'null')}}"
STUDIO = "()=>({secs:[...document.querySelectorAll('.tni282[data-sec]')].map(x=>x.dataset.sec),shown:[...document.querySelectorAll('.tni282')].filter(x=>!x.hidden).map(x=>x.dataset.sec||'more'),cur:document.querySelector('.tnb282[aria-current=page]')?.dataset.testid,icons:document.querySelectorAll('.tnb282 svg').length})"
try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(0.25)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w, lang in ((1440, "en"), (1054, "en"), (1280, "ar")):
            ctx = b.new_context(viewport={"width": w, "height": 820}); ctx.add_init_script("window.__tn282=1"); pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
            pg.goto(B + "/"); pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=30000)
            pg.evaluate(SETUP, [lang, "home"]); pg.wait_for_timeout(900)
            m = pg.evaluate(MAIN)
            ok(m["side"] == 0 and m["pad"] == 0 and m["logo"] > 0, f"{w} {lang}: no side menu beside the top bar, the page starts at the edge, the logo is Home {[m['side'], m['pad'], m['logo']]}")
            ok(m["saved"] and [s["id"] for s in m["saved"]["secs"]] == m["secs"] and all(s["svg"].startswith("<svg") for s in m["saved"]["secs"]), f"{w} {lang}: the bar's sections are saved for the editor")
            pg.evaluate(SETUP, [lang, "voice"]); pg.wait_for_timeout(700)
            ok(pg.evaluate("[...document.querySelectorAll('#main .hubtabs')].some(x=>x.offsetHeight>0)"), f"{w} {lang}: a page's own tabs show again (the side menu was their only other copy)")
            for v in ("home", "edit"):
                pg.evaluate(SETUP, [lang, v]); pg.wait_for_timeout(500)
                ok(pg.evaluate(MAIN)["secs"] == m["secs"], f"{w} {lang}: the same sections on {v}")
            pg.goto(B + "/studio/"); pg.wait_for_function("document.querySelector('.tn282')", timeout=20000); pg.wait_for_timeout(1500)
            s = pg.evaluate(STUDIO)
            ok(s["secs"] == m["secs"] and s["cur"] == "site-edit" and s["icons"] >= len(s["secs"]), f"{w} {lang}: the editor shows the site's own sections, Edit is this page {s}")
            if w == 1440: ok(s["shown"] == m["shown"], f"1440: the editor's bar fits the same sections as the site's {s['shown']} / {m['shown']}")
            pg.hover('.tni282[data-sec="video"] .tnb282'); pg.wait_for_timeout(400)
            t = pg.evaluate("[...document.querySelectorAll('.tnp282 .tnt282')].map(a=>[a.getAttribute('href'),a.getBoundingClientRect().height])")
            ok(len(t) >= 3 and all(h >= 40 for _, h in t) and t[0][0].startswith("/?view="), f"{w} {lang}: pointing at Video opens its tools, each a full-size row that opens the site's page {t}")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
            ok(pg.evaluate("!document.querySelector('.tnp282')"), f"{w} {lang}: Escape closes the panel")
            if pg.evaluate("!document.querySelector('.more282').hidden"):
                pg.click(".tnm282"); pg.wait_for_timeout(250)
                mo = pg.evaluate("[...document.querySelectorAll('.tnp282 .tnt282')].length"); hid = pg.evaluate("document.querySelectorAll('.tni282[hidden][data-sec]').length")
                ok(mo == hid and mo > 0, f"{w} {lang}: More lists exactly the sections that didn't fit ({mo}/{hid})")
            ok(not errs, f"{w} {lang}: no page errors {errs}"); ctx.close()
        # a phone keeps its drawer and the studio its menu button
        ctx = b.new_context(**p.devices["iPhone 13"]); ctx.add_init_script("window.__tn282=1"); pg = ctx.new_page()
        pg.goto(B + "/"); pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=30000); pg.evaluate(SETUP, ["en", "home"]); pg.wait_for_timeout(700)
        ok(pg.evaluate("!document.querySelector('.tn279')?.offsetParent"), "phone: no top bar sections (the Menu drawer and the bottom bar as before)")
        pg.goto(B + "/studio/"); pg.wait_for_function("document.querySelector('[data-testid=site-menu]')", timeout=20000); pg.click('[data-testid="site-menu"]'); pg.wait_for_timeout(200)
        ok(pg.evaluate("document.querySelectorAll('.smenu-list a').length") == 13, "phone studio: the menu button lists the same 12 sections (+ the free-editor line)")
        ctx.close(); b.close()
finally:
    srv.kill()
print("v282", "FAIL" if fails else "OK"); [print(" -", f) for f in fails]; sys.exit(1 if fails else 0)
