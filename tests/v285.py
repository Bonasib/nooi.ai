#!/usr/bin/env python3
"""v285: brand-free cinema lenses in the lens cards, plush agents on Home, the editor in the site's lime, and the editor's agents box
(type a command → the agents do it; several steps in one line). Port 8685."""
import os, sys, subprocess, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8685; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v285-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
fails = []
def ok(c, m):
    print(("  ok  " if c else "  FAIL ") + m)
    if not c: fails.append(m)
for n in ["arri", "canon", "pana", "zeiss", "cooke"]:
    ok(os.path.getsize(f"{ROOT}/public/cine284/lens-{n}.webp") > 3000, f"lens picture {n}")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=640x360:d=4:r=24", "-c:v", "libvpx-vp9", "-b:v", "300k", D + "/a.webm"], check=True)
env = dict(os.environ, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", AGENTS_AUTO_LEARN="false", MIRROR_MEDIA="false", NV_AUTOCHECK="false")
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
P = "window.__studio.editor.project"
try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(0.25)
    with sync_playwright() as p:
        b = p.chromium.launch()
        # ---- Home: plush agents
        pg = b.new_page(viewport={"width": 1440, "height": 900}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        pg.goto(B + "/"); pg.wait_for_timeout(2500)
        pg.evaluate("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;document.getElementById('modalRoot').innerHTML='';go('home');renderAll()}"); pg.wait_for_selector('.agc201c', timeout=10000); pg.wait_for_timeout(900)
        r = pg.evaluate("()=>{const st=document.querySelector('.st285');const im=[...document.querySelectorAll('.st285 .ag285 img')];return {st:!!st,n:im.length,loaded:im.every(i=>i.naturalWidth>100),h:st?st.getBoundingClientRect().height:0,door:!!document.querySelector('.door285'),over:document.documentElement.scrollWidth-innerWidth}}")
        ok(r["st"] and r["n"] == 9 and r["loaded"] and r["h"] > 180 and r["door"] and r["over"] <= 0, f"the crew stage on Home: nine plush agents, the doorway {r}")
        pg.locator('.ag285[data-i="4"]').click(force=True); pg.wait_for_timeout(900)
        ok(pg.evaluate("()=>AGC201.idx")==4, "a tap on an agent brings its card into view")
        pg.screenshot(path=D + "/home.png")
        pp = b.new_page(viewport={"width": 390, "height": 844}); pp.goto(B + "/"); pp.wait_for_timeout(2000); pp.evaluate("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;document.getElementById('modalRoot').innerHTML='';setUILang('ar');go('home');renderAll()}"); pp.wait_for_selector('.st285'); pp.wait_for_timeout(800)
        r = pp.evaluate("()=>{const s=document.querySelector('.st285').getBoundingClientRect(),row=document.querySelector('.row285').getBoundingClientRect();return [s.width,row.left>=s.left-1&&row.right<=s.right+1,document.documentElement.scrollWidth-innerWidth]}")
        ok(r[1] and r[2] <= 0, f"ar 390: the stage fits the phone {r}")
        pp.screenshot(path=D + "/home-ar.png"); pp.close()
        ok(pg.evaluate("()=>{const x=PIC284.lens;return x.anamorphic.ln.endsWith('lens-arri.webp')&&x.spherical.ln.endsWith('lens-pana.webp')&&x.vintage.ln.endsWith('lens-cooke.webp')}"), "lens types use the new lenses")
        ok(not errs, f"no page errors on Home {errs}")
        # ---- the editor
        for w, lang in [(1440, "en"), (390, "ar")]:
            ctx = b.new_context(viewport={"width": w, "height": 900 if w > 500 else 844}); pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
            if lang == "ar": pg.add_init_script("localStorage.setItem('nooi-studio-lang','ar')")
            pg.goto(B + "/studio/"); pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); pg.wait_for_timeout(800)
            lime = pg.evaluate("()=>getComputedStyle(document.documentElement).getPropertyValue('--lime').trim().toUpperCase()")
            ok(lime == "#D9F43B", f"{lang} {w}: the editor's accent is the site's lime ({lime})")
            ok(pg.locator('[data-testid="mate-fab"]').is_visible(), f"{lang} {w}: the agents' floating button")
            pg.evaluate("()=>window.__studio.ui.set({rail:'media',panelOpen:true})"); pg.wait_for_timeout(300)
            pg.locator('[data-testid="file-input"]').first.set_input_files([D + "/a.webm"]); pg.wait_for_function("Object.keys(" + P + ".assets).length===1", timeout=30000); pg.wait_for_timeout(600)
            pg.evaluate("()=>{const s=window.__studio;const a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a,0);s.editor.select([]);s.editor.playhead=1.5;if(s.player)s.player.seek&&s.player.seek(1.5)}"); pg.wait_for_timeout(400)
            pg.evaluate("()=>window.__studio.ui.set({panelOpen:false})"); pg.wait_for_timeout(300); pg.click('[data-testid="mate-fab"]'); pg.wait_for_selector('[data-testid="mate-q"]')
            q = "اقطع هنا ثم حركة بطيئة وأضف مطر" if lang == "ar" else "split here, then slow motion and add rain"
            pg.fill('[data-testid="mate-q"]', q); pg.click('[data-testid="mate-go"]'); pg.wait_for_timeout(500)
            n = pg.locator('[data-testid^="mate-card-"]').count()
            ok(n >= 3, f"{lang} {w}: one line → {n} steps")
            pg.click('[data-testid="mate-all"]'); pg.wait_for_timeout(900)
            r = pg.evaluate("()=>{const c=" + P + ".tracks.flatMap(t=>t.clips).filter(c=>c.type==='media');return {n:c.length,slow:c.some(x=>x.speed<1),rain:c.some(x=>(x.effects||[]).some(e=>e.type==='rain'))}}")
            ok(r["n"] == 2 and r["slow"] and r["rain"], f"{lang} {w}: split + slow motion + rain all done {r}")
            pg.fill('[data-testid="mate-q"]', "make it vertical" if lang == "en" else "اجعله عمودي"); pg.click('[data-testid="mate-go"]'); pg.wait_for_timeout(300)
            pg.click('[data-testid="mate-apply-0"]'); pg.wait_for_timeout(500)
            ok(pg.evaluate("()=>" + P + ".height>" + P + ".width"), f"{lang} {w}: the format follows a typed command")
            pg.fill('[data-testid="mate-q"]', "Cinematic black and white look" if lang == "en" else "أضف تأثير أبيض وأسود"); pg.click('[data-testid="mate-go"]'); pg.wait_for_timeout(300)
            ok(pg.locator('[data-testid^="mate-card-"]').count() >= 1, f"{lang} {w}: the catalogue is read by name")
            pg.screenshot(path=D + f"/studio-{lang}.png")
            ok(not errs, f"{lang} {w}: no page errors {errs}")
            ctx.close()
        b.close()
finally:
    srv.terminate()
print("shots:", D)
print("FAIL" if fails else "PASS", len(fails)); sys.exit(1 if fails else 0)
