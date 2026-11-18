# v235 — the background library and backgrounds made with AI.
#  · 20 high-quality pictures (Full HD, served with the studio), by group: studios, technology, nature & travel, business & finance;
#    each still or moving (a slow push-in + the light that suits it: rain on the rainy lane, stars twinkling…)
#  · 11 drawn studio sets (no chairs, no tables): 27 scenes in all, by group, each moving or still (held on one picture)
#  · with no clip picked, a background goes on the main track
#  · Make a background with AI: what it shows, where the person stands, a picture or a moving one — the price first, the words
#    say no people / chairs / tables; the moving one is made from the picture (simulated here)
# Run: python3 tests/v235.py
import asyncio, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8746; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v235-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
VP9 = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-pix_fmt", "yuv420p"]
FF("-f", "lavfi", "-i", "color=c=0x00b140:s=640x360:d=3:r=30,drawbox=x=250:y=110:w=140:h=180:c=0xe02020:t=fill", *VP9, D + "/gs.webm")
shutil.copy(ROOT + "/public/studio/backdrops/neon-navy.webp", D + "/media/aibg.webp")
FF("-f", "lavfi", "-i", "color=c=0x2040c0:s=640x360:d=5:r=30", *VP9, D + "/media/aibg.webm")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
P = "window.__studio.editor.project"
PIX = "(xy)=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),d=new Uint8Array(4);g.readPixels(Math.round(c.width*xy[0]),Math.round(c.height*(1-xy[1])),1,1,g.RGBA,g.UNSIGNED_BYTE,d);return Array.from(d.slice(0,3))}"
BG = "()=>{const p=" + P + ";const c=p.tracks.flatMap(t=>t.clips).filter(c=>c.backdrop);return c.map(c=>({type:c.type,name:c.name,tpl:c.motion?c.motion.tpl:null,speed:c.motion?c.motion.props.speed:null,kf:c.keyframes&&c.keyframes.scale?c.keyframes.scale.map(k=>k.v):null,fx:(c.effects||[]).map(e=>e.type),a:c.asset?{mime:p.assets[c.asset].mime,w:p.assets[c.asset].w,kind:p.assets[c.asset].kind}:null}))}"
SENT, JOBS = {}, {}
async def mock(route):
    req = route.request; url = req.url
    if url.endswith("/v1/jobs/quote"):
        b = json.loads(req.post_data); SENT.setdefault("quotes", []).append(b); return await route.fulfill(json={"cost": 6 if b.get("kind") == "image" else 30})
    if re.search(r"/v1/jobs$", url) and req.method == "POST":
        b = json.loads(req.post_data); jid = "j" + str(len(JOBS) + 1); SENT.setdefault("jobs", []).append(b); img = b.get("kind") == "image"
        JOBS[jid] = {"id": jid, "kind": b.get("kind"), "status": "done", "progress": 1, "resultUrl": "/media/aibg." + ("webp" if img else "webm"), "dur": None if img else 5, "title": b.get("title")}
        return await route.fulfill(json={"id": jid, "kind": b.get("kind"), "status": "rendering", "progress": 0.1})
    m = re.search(r"/v1/jobs/(j\d+)$", url)
    if m and m.group(1) in JOBS: return await route.fulfill(json=JOBS[m.group(1)])
    return await route.continue_()

async def fresh(pg, files):
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(500)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', [D + "/" + f for f in files])
    await pg.wait_for_function("Object.values(" + P + ".assets).filter(a=>a.duration>0&&a.w).length===" + str(len(files)), timeout=40000)
    await pg.evaluate("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a);const c=s.editor.project.tracks.flatMap(t=>t.clips)[0];s.editor.select([c.id])}")
    await pg.wait_for_timeout(400)
async def panel(pg):
    await pg.click('[data-testid="insp-video"]'); await pg.wait_for_timeout(150)
    await pg.locator('[data-testid="bk-open"]').scroll_into_view_if_needed(); await pg.click('[data-testid="bk-open"]'); await pg.wait_for_selector('[data-testid="bk-panel"]')

async def desktop(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/jobs.*$"), mock)
    await fresh(pg, ["gs.webm"]); await panel(pg)
    # ---- the pictures
    await pg.click('.bk .ns-seg button:has-text("Pictures")'); await pg.wait_for_selector('[data-testid="bk-photos"]')
    await pg.wait_for_function("[...document.querySelectorAll('[data-testid=bk-photos] img')].every(i=>i.complete)", timeout=20000)
    ph = await E("()=>[...document.querySelectorAll('[data-testid=bk-photos] .bgt')].map(b=>{const i=b.querySelector('img');i.scrollIntoView();return {id:b.dataset.testid,w:i.naturalWidth}})")
    await pg.wait_for_timeout(500); ph = await E("()=>[...document.querySelectorAll('[data-testid=bk-photos] .bgt')].map(b=>({id:b.dataset.testid,w:b.querySelector('img').naturalWidth}))")
    counts = {}
    for k in ("studio", "tech", "nature", "business"):
        await pg.click(f'[data-testid="bkc-{k}"]'); await pg.wait_for_timeout(150); counts[k] = await E("()=>document.querySelectorAll('[data-testid=bk-photos] .bgt').length")
    await pg.click('[data-testid="bkc-all"]')
    full = await E("async()=>{const r=await fetch('/studio/backdrops/library.webp');const bm=await createImageBitmap(await r.blob());return [r.headers.get('content-type'),bm.width,bm.height]}")
    chk("20 high-quality pictures (Full HD files, small previews), by group: 8 studios, 5 technology, 4 nature, 3 business & finance", len(ph) == 20 and all(x["w"] == 320 for x in ph) and counts == {"studio": 8, "tech": 5, "nature": 4, "business": 3} and full == ["image/webp", 1920, 1080], [ph[:3], counts, full])
    await pg.click('[data-testid="bkh-library"]'); await pg.wait_for_function("(" + BG + ")().length===1&&(" + BG + ")()[0].name==='Library study'", timeout=30000)
    st = (await E(BG))[0]
    await E("()=>window.__studio.player.seek(1.0)"); await pg.wait_for_timeout(900); px = await E(PIX, [0.06, 0.5])
    chk("a still picture behind the keyed person (Full HD, no movement), the preview shows it where the screen was", st["type"] == "media" and st["a"]["w"] == 1920 and st["kf"] is None and st["fx"] == [] and sum(px) > 60 and not (px[1] > 120 and px[0] < 60), [st, px])
    await pg.click('.bk .ns-seg button:has-text("Moving")'); await pg.click('[data-testid="bkh-kyoto-rain"]')
    await pg.wait_for_function("(" + BG + ")()[0].name==='Rainy lane'", timeout=30000); mv = (await E(BG))[0]
    chk("a moving picture: a slow push-in (1 → 1.08) and the rain that suits it", mv["kf"] and abs(mv["kf"][0] - 1) < 0.01 and abs(mv["kf"][1] - 1.08) < 0.01 and mv["fx"] == ["rain"], mv)
    n_img = await E("()=>Object.values(" + P + ".assets).filter(a=>a.mime==='image/webp').length")
    await pg.click('[data-testid="bkh-library"]'); await pg.wait_for_function("(" + BG + ")()[0].name==='Library study'", timeout=30000)
    n_img2 = await E("()=>Object.values(" + P + ".assets).filter(a=>a.mime==='image/webp').length")
    chk("a picture used again comes from the library (not downloaded twice)", n_img == 2 and n_img2 == 2, [n_img, n_img2])
    # ---- the scenes and studio sets
    await pg.click('.bk .ns-seg button:has-text("Scenes")'); await pg.wait_for_selector('[data-testid="bk-moving"]')
    nall = await E("()=>document.querySelectorAll('[data-testid=bk-moving] .bgt').length")
    await pg.click('[data-testid="bkc-business"]'); await pg.wait_for_timeout(200); biz = await E("()=>[...document.querySelectorAll('[data-testid=bk-moving] .bgt')].map(b=>b.dataset.testid.slice(3))")
    await pg.locator('[data-testid="bk-st-market"]').scroll_into_view_if_needed(); await pg.wait_for_timeout(400)
    drawn = await E("()=>[...document.querySelectorAll('[data-testid=bk-moving] canvas')].filter(c=>c.dataset.drawn).length")
    chk("27 scenes (11 new studio sets); business & finance: the city, connected world, market wall, ticker, glass office, news studio", nall == 27 and sorted(biz) == sorted(["mb-city", "st-globe", "st-market", "st-ticker", "st-glass", "st-news"]) and drawn == len(biz), [nall, biz, drawn])
    await pg.click('.bk .ns-seg button:has-text("Still")'); await pg.click('[data-testid="bk-st-market"]'); await pg.wait_for_function("(" + BG + ")()[0].tpl==='st-market'", timeout=20000); s1 = (await E(BG))[0]
    await E("()=>window.__studio.player.seek(0.5)"); await pg.wait_for_timeout(700); a1 = await E(PIX, [0.3, 0.3]); await E("()=>window.__studio.player.seek(2.5)"); await pg.wait_for_timeout(700); a2 = await E(PIX, [0.3, 0.3])
    await pg.click('.bk .ns-seg button:has-text("Moving")'); await pg.click('[data-testid="bk-st-news"]'); await pg.wait_for_function("(" + BG + ")()[0].tpl==='st-news'", timeout=20000); s2 = (await E(BG))[0]
    chk("a still studio set holds one picture (speed 0); a moving one moves", s1["speed"] == 0 and a1 == a2 and s2["speed"] == 1, [s1, a1, a2, s2])
    # ---- with no clip picked: on the main track
    await E("()=>window.__studio.editor.select([])"); await pg.wait_for_timeout(300)
    hint = await E("()=>document.querySelector('.bk .warnline')?.textContent||''")
    n0 = await E("()=>(" + P + ").tracks.filter(t=>t.kind==='video').slice(-1)[0].clips.length")
    await pg.click('[data-testid="bkc-studio"]'); await pg.wait_for_timeout(200); await pg.click('[data-testid="bk-st-cyclo"]'); await pg.wait_for_timeout(500)
    v1 = await E("()=>(" + P + ").tracks.filter(t=>t.kind==='video').slice(-1)[0].clips.map(c=>({tpl:c.motion?c.motion.tpl:null,s:+c.start.toFixed(2),d:c.dur}))")
    chk("no clip picked: the background goes on the main track, after what is there (5 s)", "main track" in hint and len(v1) == n0 + 1 and v1[-1]["tpl"] == "st-cyclo" and v1[-1]["d"] == 5 and v1[-1]["s"] >= 2.9, [hint, v1])
    # ---- made with AI
    await E("()=>{const s=window.__studio,c=s.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.type==='media'&&!c.backdrop&&s.editor.project.assets[c.asset].name==='gs');s.editor.select([c.id])}"); await pg.wait_for_timeout(300)
    await pg.click('.bk .ns-seg button:has-text("AI")'); await pg.wait_for_selector('[data-testid="bk-ai"]')
    await pg.click('[data-testid="bkai-finance"]'); await pg.click('[data-testid="bk-ai"] .ns-seg button:has-text("Right")'); await pg.click('[data-testid="bk-ai"] .ns-seg button:has-text("Moving")')
    await pg.wait_for_function("/36 credits/.test(document.querySelector('[data-testid=bkai-price]').textContent)", timeout=15000)
    price = await E("()=>document.querySelector('[data-testid=bkai-go]').textContent")
    await pg.click('[data-testid="bkai-go"]'); await pg.wait_for_function("(" + BG + ")().length&&(" + BG + ")()[0].a&&(" + BG + ")()[0].a.kind==='video'", timeout=30000)
    jobs = SENT.get("jobs", []); bg = (await E(BG))[0]
    w0 = jobs[0].get("prompt", "") if jobs else ""
    chk("Make a background with AI: the price first (picture 6 + moving 30), a picture in the words (finance, room on the right, no people / chairs / tables), then made to move from it, placed behind the person",
        "36" in price and len(jobs) == 2 and jobs[0]["kind"] == "image" and "market charts" in w0 and "open space on the right side" in w0 and "No people, no chairs, no tables" in w0
        and jobs[1]["kind"] == "video" and jobs[1].get("inputs", {}).get("vStart") == "/media/aibg.webp" and "push-in" in jobs[1].get("prompt", "") and bg["a"]["kind"] == "video", [price, jobs, bg])
    # also the video's own background (v231) is still here
    chk("…and the video's own background with AI is still offered below it", await E("()=>!!document.querySelector('[data-testid=bg-panel]')"))
    chk("desktop: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await fresh(pg, ["gs.webm"])
    if await E("()=>!!document.querySelector('[data-testid=sheet-close]')"): await pg.click('[data-testid="sheet-close"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300); await E("()=>window.__studio.editor.select([])"); await pg.wait_for_timeout(300)
    await pg.locator('[data-testid="rail-stock"]').scroll_into_view_if_needed(); await pg.click('[data-testid="rail-stock"]'); await pg.wait_for_timeout(300)
    await pg.click('.panel .subtabs button:has-text("الخلفية")'); await pg.wait_for_selector('[data-testid="bk-panel"]')
    await pg.click('.bk .ns-seg button:has-text("صور")'); await pg.wait_for_selector('[data-testid="bk-photos"]'); await pg.wait_for_timeout(400)
    v = await E("()=>({n:document.querySelectorAll('[data-testid=bk-photos] .bgt').length,first:document.querySelector('[data-testid=bk-photos] .bgt span:last-child').textContent,chip:document.querySelector('[data-testid=bkc-business]').textContent,over:document.documentElement.scrollWidth-innerWidth})")
    chk("phone (Arabic): the pictures by group in Arabic, nothing wider than the screen", v["n"] == 20 and v["first"] == "مكتبة فاخرة" and v["chip"] == "أعمال ومال" and v["over"] <= 0, v)
    chk("phone: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f in (desktop, phone):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps(out, ensure_ascii=False)[:900])
if fails: print("v235 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v235 OK")
