# v229 — 36 more nooi Motion templates (73 in all), and two new groups: Intros & outros, Wipes & reveals.
#  · every new template's tile is drawn by its own program; each one added to the timeline draws in the preview frame by frame
#    (a different picture early and later), with no page errors
#  · the full-frame wipes cover the frame in the middle of their time and leave it at the end
#  · in Arabic the new tiles have Arabic names and a new graphic gets Arabic words
# Run: python3 tests/v229.py
import asyncio, json, os, re, subprocess, sys, tempfile
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8732; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v229-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
P = "window.__studio.editor.project"
NEW = ["lt-glass", "lt-corner", "lt-slant", "lt-gradient", "ti-wave", "ti-outline", "ti-bounce", "ti-rotate", "ti-split", "ti-cinema", "so-story", "so-poll", "so-swipe", "so-notify",
       "ch-hbar", "ch-area", "ch-stats", "ch-versus", "bg-grid", "bg-particles", "bg-stripes", "sh-orbit", "co-box", "co-spot", "co-tooltip", "tm-bar", "tm-date", "au-wave", "au-dots",
       "in-logo", "in-end", "in-shine", "in-leader", "wp-slide", "wp-circle", "wp-bars"]
LIT = """()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);
  let n=0,h=0,all=0;for(let y=0;y<H;y+=3)for(let x=0;x<W;x+=3){const i=(y*W+x)*4,v=d[i]+d[i+1]+d[i+2];all++;if(v>90){n++;h=(h*31+x*7+y*13+d[i]+d[i+1])>>>0}}return{n,h,all}}"""
TILE = "(i)=>{const c=document.querySelector('[data-testid=mg-'+i+'] canvas');if(!c)return -1;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let k=3;k<d.length;k+=16)if(d[k]>40)n++;return n}"

async def desktop(p):
    b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1440, "height": 900}); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="rail-titles"]'); await pg.click('.panel .subtabs button:has-text("Motion graphics")'); await pg.wait_for_selector('[data-testid="motion-gallery"]')
    n = await E("()=>({tiles:document.querySelectorAll('.mgal .mgt').length,groups:[...document.querySelectorAll('.mgal .chip')].map(c=>c.textContent)})")
    chk("the gallery: 110 motion graphics (since v230); the groups Intros & outros, Wipes & reveals", n["tiles"] == 110 and "Intros & outros" in n["groups"] and "Wipes & reveals" in n["groups"], n)
    for g, cnt in (("intros", 7), ("wipes", 6), ("lower", 13), ("titles", 19)):
        await pg.click(f'[data-testid="mgg-{g}"]'); await pg.wait_for_timeout(150); c = await E("()=>document.querySelectorAll('.mgal .mgt').length")
        chk(f"group {g}: {cnt} graphics", c == cnt, c)
    await pg.click('[data-testid="mgg-all"]'); await pg.wait_for_timeout(200)
    for i in NEW: await pg.locator(f'[data-testid="mg-{i}"]').scroll_into_view_if_needed()
    await pg.wait_for_timeout(1200); blank = [[i, v] for i in NEW if (v := await E(TILE, i)) < 30]
    chk("every new tile is drawn by its own program (none blank)", not blank, blank)
    # each new template on the timeline: drawn in the preview, frame by frame
    bad = []; drawn = {}
    for i in NEW:
        await E("(i)=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).map(c=>c.id));s.actions.del();s.player.seek(0);s.actions.addMotion(i,0)}", i)
        dur = await E("()=>" + P + ".tracks.flatMap(t=>t.clips)[0].dur")
        await E("(t)=>window.__studio.player.seek(t)", min(0.15, dur * 0.1)); await pg.wait_for_timeout(260); a = await E(LIT)
        await E("(t)=>window.__studio.player.seek(t)", dur * 0.62); await pg.wait_for_timeout(260); c = await E(LIT)
        drawn[i] = [a["n"], c["n"]]
        if i not in ("co-spot", "wp-slide") and (c["n"] < 40 or a["h"] == c["h"]): bad.append([i, a, c])
        if i == "wp-slide" and (a["n"] < 40 or a["h"] == c["h"]): bad.append([i, a, c])   # (its second colour is the dark one)
        if i == "co-spot" and (a["n"] != 0 or c["n"] != 0): bad.append([i, "a spotlight only darkens (nothing lit on black)", a, c])
    out["drawn"] = drawn
    chk("each new graphic draws in the preview and moves (a different picture while it comes in and at 62% of its time)", not bad, bad)
    # the wipes: covering in the middle, gone at the end
    cov = {}
    for i, need in (("wp-circle", 0.97), ("wp-bars", 0.5)):
        await E("(i)=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).map(c=>c.id));s.actions.del();s.player.seek(0);s.actions.addMotion(i,0)}", i)
        dur = await E("()=>" + P + ".tracks.flatMap(t=>t.clips)[0].dur")
        await E("(t)=>window.__studio.player.seek(t)", dur * 0.5); await pg.wait_for_timeout(260); mid = await E(LIT)
        await E("(t)=>window.__studio.player.seek(t)", dur * 0.99); await pg.wait_for_timeout(260); end = await E(LIT)
        cov[i] = [round(mid["n"] / mid["all"], 3), round(end["n"] / end["all"], 3)]
        chk(f"{i} covers the frame in the middle and leaves it at the end", mid["n"] / mid["all"] >= need and end["n"] / end["all"] < 0.15, cov[i])
    out["wipes"] = cov
    chk("desktop: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="rail-titles"]'); await pg.click('.panel .subtabs button:has-text("رسوم متحركة")'); await pg.wait_for_selector('[data-testid="motion-gallery"]')
    await pg.click('[data-testid="mgg-intros"]'); await pg.wait_for_timeout(200)
    v = await E("()=>({names:[...document.querySelectorAll('.mgal .mgt span:last-child')].map(s=>s.textContent),chip:document.querySelector('[data-testid=mgg-intros]').textContent,over:document.documentElement.scrollWidth-innerWidth})")
    chk("phone (Arabic): the new group and its graphics in Arabic, nothing wider than the screen", v["chip"] == "مقدمات وخواتيم" and v["names"][:4] == ["كشف الشعار", "شاشة النهاية", "لمعة ضوئية", "عدّ تنازلي سينمائي"] and v["over"] <= 0, v)
    await pg.click('[data-testid="mg-in-logo"]'); await pg.wait_for_timeout(400)
    mg = await E("()=>" + P + ".tracks.flatMap(t=>t.clips.filter(c=>c.motion).map(c=>c.motion.props))")
    chk("phone: a new graphic added in Arabic gets Arabic words", len(mg) == 1 and mg[0].get("brand") == "نوي" and mg[0].get("tag") == "اجعلها تتحرك", mg)
    chk("phone: no page errors", not errs, errs); await b.close()

async def main():
    import urllib.request, time
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f in (desktop, phone):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:600])

try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps(out, ensure_ascii=False)[:900])
if fails: print("v229 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v229 OK")
