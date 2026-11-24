#!/usr/bin/env python3
"""v284: the owner's pictures in the pickers — lens cards (cut-out lenses), the era radio dial, camera-move pictures, the new
moves and their intensity on the server. Port 8684."""
import os, sys, json, subprocess, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8684; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v284-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
fails = []
def ok(c, m):
    print(("  ok  " if c else "  FAIL ") + m)
    if not c: fails.append(m)
# the server's words for the new moves and the intensity
js = "import('%s/lib/intent.js').then(m=>{console.log(JSON.stringify([m.intentLines('video',{camera:'whip',camI284:20}),m.intentLines('video',{camera:'lowpush',camI284:90}),m.intentLines('video',{camera:'static',camI284:90}),m.intentLines('video',{camera:'pan'})]));process.exit(0)})" % ROOT
r = json.loads(subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True).stdout.strip().splitlines()[-1])
j = lambda a: " ".join(a)
ok("whip pan" in j(r[0]).lower() and "gentle" in j(r[0]), f"whip pan, gentle {r[0]}")
ok("low-angle" in j(r[1]) and "bold" in j(r[1]), f"hero rise, bold {r[1]}")
ok("gentle" not in j(r[2]) and "bold" not in j(r[2]), "a still camera gets no intensity words")
ok("gentle" not in j(r[3]) and "bold" not in j(r[3]), "no intensity sent → none added")
for f in ["lens-f85", "lens-anamorphic", "e_d1980", "m_whip", "g_f14"]:
    ok(os.path.getsize(f"{ROOT}/public/cine284/{f}.webp") > 2000, f"picture {f}")
env = dict(os.environ, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", AGENTS_AUTO_LEARN="false", MIRROR_MEDIA="false", NV_AUTOCHECK="false")
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(0.25)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w, lang in [(1440, "en"), (390, "ar")]:
            pg = b.new_page(viewport={"width": w, "height": 900 if w > 800 else 844}); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
            pg.goto(B + "/"); pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=30000)
            pg.evaluate("l=>{S.langAsked=true;S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';S.draft.cine93={};go('video')}", lang); pg.wait_for_timeout(1200)
            pre = f"{w}/{lang}: "
            pg.evaluate("()=>{ST93().open='c_focal';renderView()}"); pg.wait_for_timeout(600)
            r = pg.evaluate("()=>{const s=document.getElementById('sec93-c_focal');const c=s.querySelector('.ph284[data-val=\"85\"]');return{n:s.querySelectorAll('.ph284').length,ln:c&&c.querySelector('.ln284').getAttribute('src'),nick:c&&c.querySelector('.nk284').textContent,pill:c&&c.querySelector('.mm284').textContent}}")
            ok(r["n"] >= 7 and r["ln"].endswith("lens-f85.webp") and r["pill"].strip().startswith("85"), pre + f"focal cards with the lenses {r}")
            pg.click("#sec93-c_focal .ph284[data-val='85']"); pg.wait_for_timeout(700)
            r = pg.evaluate("()=>[cine93().focal,(document.querySelector('.o93[data-o93=\"c_focal\"] .o93i img')||{}).src||'']")
            ok(str(r[0]) == "85" and r[1].endswith("lens-f85.webp"), pre + f"picked 85 mm; the chip shows its lens {r}")
            pg.evaluate("()=>{ST93().open='c_lens';renderView()}"); pg.wait_for_timeout(600)
            ok(pg.evaluate("!!document.querySelector('#sec93-c_lens .ph284[data-val=\"anamorphic\"] .ln284[src$=\"lens-anamorphic.webp\"]')"), pre + "anamorphic card with its lens")
            pg.evaluate("()=>{ST93().open='era254';renderView()}"); pg.wait_for_timeout(600)
            r = pg.evaluate("()=>{const d=document.querySelector('#sec93-era254 .dial284');return d&&{st:d.querySelectorAll('.st284').length,dir:d.querySelector('.dsc284').getAttribute('dir'),cards:document.querySelectorAll('#sec93-era254 .ph284').length}}")
            ok(r and r["st"] >= 14 and r["dir"] == "ltr" and r["cards"] >= 9, pre + f"the era dial: stations, left-to-right scale, era cards {r}")
            pg.click("#sec93-era254 .st284[data-v='d1980']"); pg.wait_for_timeout(1200)
            r = pg.evaluate("()=>{const d=document.querySelector('#sec93-era254 .dial284');const nd=d.querySelector('.nd284'),st=d.querySelector('.st284[data-v=\"d1980\"]');const a=nd.getBoundingClientRect(),b=st.getBoundingClientRect();return{era:cine93().era,bg:getComputedStyle(d.querySelector('.dw284')).getPropertyValue('--bg284'),dx:Math.abs((a.left+a.right)/2-(b.left+b.right)/2),on:st.getAttribute('aria-checked'),cap:d.querySelector('.dca284').textContent,chip:(document.querySelector('.o93[data-o93=\"era254\"] .o93i img')||{}).src||''}}")
            ok(r["era"] == "d1980" and "e_d1980" in r["bg"] and r["dx"] < 4 and r["on"] == "true" and r["chip"].endswith("e_d1980.webp"), pre + f"tuning the dial picks the 1980s: needle on it, its picture behind, the chip {r}")
            # drag the needle to the far end → Far future
            sc = pg.query_selector("#sec93-era254 .dsc284").bounding_box()
            y = sc["y"] + sc["height"] - 6
            pg.mouse.move(sc["x"] + sc["width"] * 0.3, y); pg.mouse.down(); pg.mouse.move(sc["x"] + sc["width"] * 0.7, y, steps=5); pg.mouse.move(sc["x"] + sc["width"] - 4, y, steps=5); pg.mouse.up(); pg.wait_for_timeout(1000)
            ok(pg.evaluate("cine93().era") == "farfuture", pre + f"dragging the needle to the end tunes Far future ({pg.evaluate('cine93().era')})")
            pg.evaluate("()=>{ST93().open='';renderView()}"); pg.wait_for_timeout(300)
            pg.evaluate("pk84sheet([...document.querySelectorAll('.pk84c')].find(c=>c.dataset.key.startsWith('move')).dataset.key)"); pg.wait_for_timeout(800)
            r = pg.evaluate("()=>({n:document.querySelectorAll('#modalRoot .pk84o.ph284').length,whip:!!document.querySelector('#modalRoot .pk84o[data-val=\"whip\"] .bg284[src$=\"m_whip.webp\"]'),int:!!document.querySelector('#modalRoot .in284 input[data-bind=\"draft.camI284\"]')})")
            ok(r["n"] >= 18 and r["whip"] and r["int"], pre + f"camera-move sheet: 18 pictures, the new moves, intensity {r}")
            pg.click("#modalRoot .pk84o[data-val='whip']"); pg.wait_for_timeout(500)
            ok(pg.evaluate("S.draft.camera") == "whip", pre + "whip pan picked")
            pg.evaluate("()=>{document.getElementById('modalRoot').innerHTML='';S.draft.camI284=25}")
            ov = pg.evaluate("()=>{const o=document.scrollingElement;return document.documentElement.scrollWidth-innerWidth}")
            ok(ov <= 1, pre + f"nothing sideways ({ov})")
            m = pg.evaluate("()=>{const j=addJob({kind:'video',prompt:'a walk in the rain',model:'auto',dur:5,aspect:'16:9',cost:1,meta:{camera:S.draft.camera}});return j&&j.meta}")
            ok(m and m.get("camI284") == 25, pre + f"the intensity goes with the video ({m and m.get('camI284')})")
            ok(not errs, pre + f"no page errors {errs}")
            pg.close()
        b.close()
finally:
    srv.terminate()
print("v284:", "OK" if not fails else f"{len(fails)} FAILED"); sys.exit(1 if fails else 0)
