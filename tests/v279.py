#!/usr/bin/env python3
"""v279: a clear top menu (every section by name, its tools in a panel, the rest under More) · a first picture before the script
· the page sent minified. Port 8479."""
import os, sys, json, subprocess, tempfile, time, urllib.request, zlib
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8479; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v279-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
fails = []
def ok(c, m):
    print(("  ok  " if c else "  FAIL ") + m)
    if not c: fails.append(m)
env = dict(os.environ, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", MIRROR_MEDIA="false")
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(0.25)
    # ---- the page as sent
    raw = urllib.request.urlopen(B + "/").read().decode("utf8")
    ok('class="boot279"' in raw and "nooi-mark.svg" in raw, "the first picture (logo, sections, Opening nooi…) is in the page before the script")
    ok("/* ================= v279" not in raw, "the page's script is sent without its comments (minified)")
    src = open(ROOT + "/public/index.html", encoding="utf8").read()
    ok(len(raw) < len(src) * 0.95, f"minified page smaller ({len(raw)} < {len(src)})")
    SETUP = "(a)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(a[0]);document.getElementById('modalRoot').innerHTML='';go(a[1])}"
    with sync_playwright() as p:
        b = p.chromium.launch()
        def page(w, h, lang, view, mob=False):
            ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); ctx.add_init_script("window.__tn279=1"); pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
            pg.goto(B + "/"); pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=30000)
            pg.evaluate(SETUP, [lang, view]); pg.wait_for_timeout(900); return ctx, pg, errs
        vis = "()=>[...document.querySelectorAll('#main>.topm .tni279')].filter(x=>!x.hidden&&x.offsetWidth).map(x=>x.dataset.tn279sec||'__more')"
        # computer, English
        ctx, pg, errs = page(1440, 900, "en", "video")
        ok(not pg.evaluate("!!document.querySelector('#main .boot279')"), "the first picture is gone once the page is drawn")
        v = pg.evaluate(vis); ok(v[:4] == ["home", "explore", "image", "video"] and len(v) >= 9, f"1440: sections by name in the top bar {v}")
        r = pg.evaluate("()=>{const n=document.querySelector('#main>.topm .tn279').getBoundingClientRect(),row=document.querySelector('.tnr279');return{h:n.height,fit:row.scrollWidth<=row.clientWidth+1,cur:document.querySelector('.tnb279[aria-current=page]')?.dataset.go,logo:!!document.querySelector('.tnlogo279').offsetWidth}}")
        ok(r["fit"] and r["cur"] == "video" and r["logo"], f"1440: nothing cut, Video marked as the open section, the logo is Home {r}")
        pg.hover('#main>.topm .tni279[data-tn279sec="explore"] .tnb279'); pg.wait_for_timeout(450)
        r = pg.evaluate("()=>{const p=document.getElementById('tnp279');return{open:!p.hidden,tools:[...p.querySelectorAll('.tnt279')].map(x=>x.dataset.go),desc:p.querySelectorAll('.tnt279 small').length,inside:p.getBoundingClientRect().right<=innerWidth}}")
        ok(r["open"] and "discover" in r["tools"] and r["desc"] >= 1 and r["inside"], f"pointing at Explore opens its tools with a line on each {r}")
        pg.hover('#main>.topm .tni279[data-tn279sec="audio"] .tnb279'); pg.wait_for_timeout(300)
        ok(pg.evaluate("[...document.querySelectorAll('#tnp279 .tnt279')].map(x=>x.dataset.go).includes('voice')"), "moving to Audio swaps the panel at once")
        pg.click('#tnp279 .tnt279[data-go="voice"]'); pg.wait_for_timeout(600)
        ok(pg.evaluate("S.view==='voice'&&document.getElementById('tnp279').hidden&&document.querySelector('.tnb279[aria-current=page]').dataset.go==='voice'"), "a tool in the panel opens its page, closes the panel and Audio is now the open section")
        pg.mouse.move(700, 600); pg.wait_for_timeout(200)
        pg.click('#main>.topm .tni279[data-tn279sec="video"] .tnc279'); pg.wait_for_timeout(200)
        ok(pg.evaluate("!document.getElementById('tnp279').hidden&&document.querySelector('[data-tn279=video]').getAttribute('aria-expanded')==='true'"), "the arrow opens the panel on a click")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
        ok(pg.evaluate("document.getElementById('tnp279').hidden&&document.activeElement.dataset.tn279==='video'"), "Escape closes it and puts the focus back")
        pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(150); pg.keyboard.press("ArrowDown")
        ok(pg.evaluate("document.activeElement.classList.contains('tnt279')&&!document.getElementById('tnp279').hidden"), "↓ opens the panel and moves through its tools")
        pg.keyboard.press("Escape")
        pg.evaluate("renderShell()"); pg.click('#main>.topm .tni279[data-tn279sec="video"] .tnc279'); pg.evaluate("renderShell();renderView()"); pg.wait_for_timeout(150)
        ok(pg.evaluate("!document.getElementById('tnp279').hidden"), "a redraw of the page (credits, a job) doesn't close an open panel")
        ok(pg.evaluate("document.body.classList.contains('sb253fold')"), "the side menu starts folded to icons (the top bar carries the names)")
        ok(not errs, f"no page errors {errs}"); ctx.close()
        # computer 1920 — every section fits
        ctx, pg, errs = page(1920, 1000, "en", "home")
        v = pg.evaluate(vis); ok("__more" not in v and "apps" in v and "calendar" in v, f"1920: every section in the bar, no More {v}"); ctx.close()
        # tablet, Arabic — what doesn't fit is under More, mirrored
        ctx, pg, errs = page(1024, 768, "ar", "image")
        v = pg.evaluate(vis); ok("__more" in v and "image" in v, f"1024 ar: the open section stays, the rest under More {v}")
        r = pg.evaluate("()=>{const row=document.querySelector('.tnr279');return{fit:row.scrollWidth<=row.clientWidth+1,dir:document.documentElement.dir}}")
        ok(r["fit"] and r["dir"] == "rtl", f"1024 ar: nothing cut, right to left {r}")
        pg.click("#main>.topm .more279 .tnb279"); pg.wait_for_timeout(200)
        r = pg.evaluate("()=>{const p=document.getElementById('tnp279'),b=p.getBoundingClientRect();return{n:p.querySelectorAll('.tnt279').length,t:p.querySelector('.tnph279 b').textContent,l:b.left>=0&&b.right<=innerWidth}}")
        ok(r["n"] >= 4 and r["t"] == "أقسام أخرى" and r["l"], f"More lists the hidden sections in Arabic, inside the screen {r}")
        ok(not errs, f"no page errors {errs}"); ctx.close()
        # tablet upright
        ctx, pg, errs = page(768, 1024, "en", "video")
        r = pg.evaluate("()=>{const row=document.querySelector('.tnr279');return{fit:row.scrollWidth<=row.clientWidth+1,ovf:document.documentElement.scrollWidth>innerWidth}}")
        v = pg.evaluate(vis); ok(r["fit"] and not r["ovf"] and "video" in v and "__more" in v, f"768: the open section + More, nothing cut {v} {r}"); ctx.close()
        # phone — the bottom menu and the drawer, no top row of sections
        ctx, pg, errs = page(390, 844, "ar", "home", True)
        ok(pg.evaluate("!document.querySelector('#main>.topm .tn279')||!document.querySelector('#main>.topm .tn279').offsetWidth"), "phone: no row of sections at the top (bottom menu + Menu drawer)")
        ok(not errs, f"no page errors {errs}"); ctx.close()
        # the first picture is in Arabic for an Arabic visitor
        ctx = b.new_context(viewport={"width": 1280, "height": 800}); pg = ctx.new_page()
        pg.route("**/*", lambda rt: rt.abort() if rt.request.resource_type == "script" and "gstatic" in rt.request.url else rt.continue_())
        pg.add_init_script("try{localStorage.setItem('nooi.lang279','ar')}catch(e){}")
        pg.goto(B + "/", wait_until="commit"); pg.wait_for_selector(".boot279", state="attached", timeout=20000)
        pg.wait_for_function("!document.querySelector('.boot279')||document.documentElement.dir==='rtl'&&document.querySelector('.bth279 span:last-child')&&document.querySelector('.bth279 span').textContent!=='Home'", timeout=20000)
        r = pg.evaluate("()=>{const b=document.querySelector('.boot279');return b?{dir:document.documentElement.dir,t:b.querySelector('.bth279 span').textContent}:null}")
        ok(r is None or (r["dir"] == "rtl" and r["t"] == "الرئيسية"), f"the first picture follows the visitor's language {r}"); ctx.close()
        b.close()
finally:
    srv.terminate()
print("v279:", "PASS" if not fails else f"FAIL {len(fails)}"); sys.exit(1 if fails else 0)
