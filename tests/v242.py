# v242 — the start page of the owner's design, the nine agents as the Mini Crew, the Infographics back, and Extend with AI.
#  · the start page (a visitor): light like the design; "Your Creative Team, Always on Call"; Meet Your Creative Team — nine cards
#    in the crew's order (Quill, Nova, Max, Lumi, Lyra, Echo, Remy, Duke, Iris), each with its own picture (loaded); the four
#    benefits; Made with nooi; the plans after it; nothing wider than the screen on a phone, a tablet or a computer; in Arabic too;
#    the bar at the bottom only on a phone; the arrows step the cards
#  · every place an agent is drawn shows the crew's picture
#  · the studio: an Infographics group (12 graphics), each tile drawn and each one moving in the preview
#  · Extend with AI: the picked clip's end frame starts the new shot (the price first), the new shot lands right after the clip and
#    the clip after it moves along
# Run: python3 tests/v242.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request, shutil
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8760; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v242-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
VP9 = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "400k", "-pix_fmt", "yuv420p"]
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", *VP9, D + "/take.webm")
FF("-f", "lavfi", "-i", "color=c=0x2050d0:s=640x360:d=5:r=30,drawbox=x='100+60*t':y=100:w=120:h=160:c=white:t=fill", *VP9, D + "/media/more.webm")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "SEEDANCE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1100]))
P = "window.__studio.editor.project"
IG = ["ig-checklist", "ig-steps", "ig-cycle", "ig-pyramid", "ig-table", "ig-kpi", "ig-icons", "ig-quote", "ig-cta", "ig-ticker", "ig-route", "ig-people"]
LIT = """()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);
  let n=0,h=0;for(let y=0;y<H;y+=3)for(let x=0;x<W;x+=3){const i=(y*W+x)*4,v=d[i]+d[i+1]+d[i+2];if(v>90){n++;h=(h*31+x*7+y*13+d[i]+d[i+1])>>>0}}return{n,h}}"""
TILE = "(i)=>{const c=document.querySelector('[data-testid=mg-'+i+'] canvas');if(!c)return -1;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let k=3;k<d.length;k+=16)if(d[k]>40)n++;return n}"

async def landing(p, w, h, lang):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": w, "height": h}); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof lpMain242==='function'", timeout=20000); await pg.wait_for_timeout(800)
    await E("l=>{S.user=null;S.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';renderAll()}", lang); await pg.wait_for_selector(".lp242 .c242", timeout=10000)
    await E("()=>document.querySelectorAll('.lp242 img').forEach(i=>{i.loading='eager'})"); await pg.wait_for_timeout(1800)   # (cards off to the side load when seen)
    r = await E("""()=>({names:[...document.querySelectorAll('.c242 h3')].map(x=>x.textContent),pics:[...document.querySelectorAll('.lp242 img')].map(i=>i.complete&&i.naturalWidth>0),theme:document.documentElement.dataset.theme,
      h1:(document.querySelector('.h242 h1')||{}).textContent,ben:document.querySelectorAll('.b242>div').length,made:document.querySelectorAll('.m242g figure').length,price:!!document.getElementById('lp-price'),
      over:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,bar:getComputedStyle(document.querySelector('.n242')).display})""")
    want = ["Quill", "Nova", "Max", "Lumi", "Lyra", "Echo", "Remy", "Duke", "Iris"] if lang == "en" else None
    chk(f"start page {w} {lang}: light, the headline, nine crew cards in order with their pictures, four benefits, Made with nooi, the plans after",
        r["theme"] == "light" and len(r["names"]) == 9 and (want is None or r["names"] == want) and all(r["pics"]) and len(r["pics"]) >= 12 and r["ben"] == 4 and r["made"] == 8 and r["price"]
        and (("Creative Team" in r["h1"]) if lang == "en" else ("فريقك الإبداعي" in r["h1"])), r)
    chk(f"start page {w} {lang}: nothing wider than the screen; the bottom bar only on a phone", r["over"] <= 1 and (r["bar"] != "none") == (w < 768), {"over": r["over"], "bar": r["bar"]})
    if w >= 861:
        x0 = await E("()=>document.getElementById('t242r').scrollLeft"); await pg.click('[data-act="t242-step"][data-d="1"]'); await pg.wait_for_timeout(700); x1 = await E("()=>document.getElementById('t242r').scrollLeft")
        chk(f"start page {w}: the arrow steps the cards", abs(x1 - x0) > 100, [x0, x1])
    sv = await E("()=>botSVG('writer','working',40)+'|'+botSVG('proof','idle',30)")
    chk(f"start page {w} {lang}: every agent drawn is the crew's picture", "/crew/quill.webp" in sv and "/crew/iris.webp" in sv and "cs-working" in sv, sv[:300])
    chk(f"start page {w} {lang}: no page errors", not errs, errs); await b.close()

async def studio(p):
    b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1440, "height": 900}); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    SENT = {"q": [], "jobs": []}
    async def mock(route):
        rq = route.request; u = rq.url
        if u.endswith("/v1/jobs/quote"): SENT["q"].append(json.loads(rq.post_data)); return await route.fulfill(json={"cost": 30})
        if re.search(r"/v1/jobs$", u) and rq.method == "POST": SENT["jobs"].append(json.loads(rq.post_data)); return await route.fulfill(json={"id": "x1", "kind": "video", "status": "rendering", "progress": 0.1})
        if re.search(r"/v1/jobs/x1$", u): return await route.fulfill(json={"id": "x1", "kind": "video", "status": "done", "progress": 1, "resultUrl": "/media/more.webm", "dur": 5, "title": "more"})
        return await route.continue_()
    await pg.route(re.compile(r".*/v1/jobs(/quote|/x1)?$"), mock)
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    # ---- Infographics
    await pg.click('[data-testid="rail-titles"]'); await pg.click('.panel .subtabs button:has-text("Motion graphics")'); await pg.wait_for_selector('[data-testid="motion-gallery"]')
    await pg.click('[data-testid="mgg-infographics"]'); await pg.wait_for_timeout(300)
    n = await E("()=>[...document.querySelectorAll('.mgal .mgt')].map(t=>t.dataset.testid)")
    chk("the studio: an Infographics group with 12 graphics", sorted(n) == sorted("mg-" + i for i in IG), n)
    for i in IG: await pg.locator(f'[data-testid="mg-{i}"]').scroll_into_view_if_needed()
    await pg.wait_for_timeout(1200); blank = [[i, v] for i in IG if (v := await E(TILE, i)) < 30]
    chk("every infographic tile is drawn (none blank)", not blank, blank)
    bad = []
    for i in IG:
        await E("(i)=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).map(c=>c.id));s.actions.del();s.player.seek(0);s.actions.addMotion(i,0)}", i)
        dur = await E("()=>" + P + ".tracks.flatMap(t=>t.clips)[0].dur")
        await E("(t)=>window.__studio.player.seek(t)", min(0.2, dur * 0.1)); await pg.wait_for_timeout(260); a = await E(LIT)
        await E("(t)=>window.__studio.player.seek(t)", dur * 0.6); await pg.wait_for_timeout(260); c = await E(LIT)
        if c["n"] < 40 or a["h"] == c["h"]: bad.append([i, a, c])
    chk("each infographic draws in the preview and moves", not bad, bad)
    await E("()=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).map(c=>c.id));s.actions.del()}")
    # ---- Extend with AI
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/take.webm")
    await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.w&&a.duration)", timeout=30000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a);s.actions.addAsset(a);const cs=s.editor.project.tracks.flatMap(t=>t.clips).sort((x,y)=>x.start-y.start);s.editor.select([cs[0].id])}"); await pg.wait_for_timeout(400)
    before = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).filter(c=>c.type==='media').sort((x,y)=>x.start-y.start).map(c=>[c.start,c.dur])")
    await pg.click('[data-testid="ex-open"]'); await pg.wait_for_selector('[data-testid="extend-panel"] [data-testid="ex-form"]', timeout=10000)
    await pg.fill('[data-testid="ex-next"]', "the box keeps moving to the right")
    await pg.wait_for_function("/30/.test((document.querySelector('[data-testid=ex-price]')||{}).textContent||'')", timeout=15000)
    await pg.click('[data-testid="ex-go"]'); await pg.wait_for_function("window.__studio.editor.project.tracks.flatMap(t=>t.clips).filter(c=>c.type==='media').length===3", timeout=40000); await pg.wait_for_timeout(300)
    after = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).filter(c=>c.type==='media').sort((x,y)=>x.start-y.start).map(c=>[c.start,c.dur,c.name])")
    j = SENT["jobs"][-1] if SENT["jobs"] else {}
    chk("Extend with AI: the clip's end frame starts the new shot with the words (price first: 30)", SENT["q"] and SENT["q"][-1].get("inputs", {}).get("vStart") == "frame" and str(j.get("inputs", {}).get("vStart", "")).startswith("/media/") and "Continue this exact shot" in j.get("prompt", "") and "keeps moving" in j.get("prompt", "") and j.get("dur") == 5, j)
    chk("Extend with AI: the new shot lands right after the clip and the next clip moves along", len(after) == 3 and abs(after[1][0] - (before[0][0] + before[0][1])) < 0.02 and abs(after[2][0] - (after[1][0] + after[1][1])) < 0.02, {"before": before, "after": after})
    chk("studio: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f, a in ((landing, (390, 844, "en")), (landing, (390, 844, "ar")), (landing, (820, 1180, "en")), (landing, (1366, 860, "en")), (studio, ())):
            try: await f(p, *a)
            except Exception as e: chk(f.__name__ + str(a) + " crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
if fails: print("v242 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v242 OK")
