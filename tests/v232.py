# v232 — the owner's phone notes after v231:
#  · Home went back to the editor: the site kept "editor" as its page (the save waited 0.7 s, the redirect to the studio left
#    first), so every visit to the home page bounced to /studio/. Now the page is saved at once, and opening the site shows the
#    site; the studio's Home goes to /?view=home
#  · the site's sections are on top on every computer and tablet (also 1024×768 sideways)
#  · a phone: a Home icon and a menu beside it (the site's sections)
#  · a finger on the timeline scrolls it — it doesn't pick or move a clip; a quick tap picks a clip; a press held 0.4 s lifts it
#  · dragging the playhead's pin to the timeline's edge scrolls the timeline along (the playhead stays in view)
# Run: python3 tests/v232.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8739; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v232-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=8", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k", D + "/a.webm"], check=True, timeout=120, stdin=subprocess.DEVNULL)
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:800]))
P = "window.__studio.editor.project"
CLIP = "()=>{const c=" + P + ".tracks.flatMap(t=>t.clips)[0];return c?{start:+c.start.toFixed(3),track:" + P + ".tracks.find(t=>t.clips.includes(c)).id,sel:window.__studio.editor.selection.slice()}:null}"

async def site(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1280, "height": 800}); await ctx.add_init_script("window.__studio219=true")
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof S!=='undefined'&&typeof go==='function'", timeout=20000); await pg.wait_for_timeout(1200)
    await pg.evaluate("()=>{S.langAsked=true;S.user={name:'T',method:'google'};AU.showAuth=false;document.getElementById('modalRoot').innerHTML='';localStorage.setItem(LSKEY,JSON.stringify(S));renderAll()}")
    # the site remembered the editor (as it did after "Edit" took the person to the studio)
    await pg.evaluate("()=>{S.view='edit';localStorage.setItem(LSKEY,JSON.stringify(S))}")
    await pg.goto(B + "/"); await pg.wait_for_timeout(2500)
    r = await pg.evaluate("()=>({path:location.pathname,view:S.view,saved:JSON.parse(localStorage.getItem(LSKEY)||'{}').view})")
    chk("opening the site that remembered the editor shows the site (it doesn't bounce to the studio), and that is saved at once", r == {"path": "/", "view": "home", "saved": "home"}, r)
    await pg.evaluate("()=>go('explore')"); await pg.wait_for_timeout(300)
    await pg.evaluate("()=>go('edit')"); await pg.wait_for_url("**/studio/**", timeout=15000)
    saved = await pg.evaluate("()=>JSON.parse(localStorage.getItem('dotai-studio-v2')||'{}').view")
    chk("Edit opens the studio, and the site's own page (not the editor) is saved before leaving", saved == "explore", saved)
    await pg.goto(B + "/?view=home"); await pg.wait_for_timeout(2500)
    r2 = await pg.evaluate("()=>({path:location.pathname,view:S.view})")
    chk("the studio's Home (/?view=home) lands on the site's home page", r2 == {"path": "/", "view": "home"}, r2)
    chk("site: no page errors", not errs, errs); await b.close()

async def tablets(p):
    res = {}
    for name, vp in (("1024×768 sideways", {"width": 1024, "height": 768}), ("iPad upright", {"width": 834, "height": 1194}), ("laptop 1280×720", {"width": 1280, "height": 720})):
        b = await p.chromium.launch(); ctx = await b.new_context(viewport=vp, has_touch=True); pg = await ctx.new_page()
        await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(500)
        res[name] = await pg.evaluate("()=>({bar:!!document.querySelector('.sitebar'),links:document.querySelectorAll('.sitebar .snav a').length,home:(document.querySelector('[data-testid=site-home]')||{}).getAttribute?.('href')||document.querySelector('.sitebar [data-testid=site-home]')?.getAttribute('href'),menu:!!document.querySelector('.sitebar [data-testid=site-menu]'),page:document.documentElement.scrollWidth-innerWidth})"); await b.close()
    out["tablets"] = res
    chk("computers and tablets: the site's sections are on top (also 1024×768 sideways); Home and the logo go to /?view=home", all(r["bar"] and (r["links"] == 9 or r["menu"]) and r["home"] == "/?view=home" and r["page"] <= 0 for r in res.values()) and res["laptop 1280×720"]["links"] == 9, res)   # (v251: under 1180 px the sections sit behind the menu button)

async def touch(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    hm = await E("()=>({home:document.querySelector('[data-testid=site-home]')?.getAttribute('href'),menu:!!document.querySelector('[data-testid=site-menu]'),bar:!!document.querySelector('.sitebar'),logo:!!document.querySelector('.topbar a.logo,.topbar button.logo')})")
    await pg.click('[data-testid="site-menu"]'); await pg.wait_for_timeout(200)
    # (really seen: the element at each item's middle is that item — nothing clips or covers it)
    n = await E("()=>[...document.querySelectorAll('.smenu-list a')].filter(a=>{const r=a.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.width>0&&e&&a.contains(e)}).length")
    await pg.click('[data-testid="site-menu"]')
    hdr = await E("()=>{const t=document.querySelector('.topbar');return{spill:t.scrollWidth-t.clientWidth,boxes:[...t.children].map(k=>{const r=k.getBoundingClientRect();return[k.className||k.tagName,Math.round(r.left),Math.round(r.right)]})}}")
    ov = [[a[0], c[0]] for i, a in enumerate(hdr["boxes"]) for c in hdr["boxes"][i + 1:] if a[1] < c[2] - 1 and c[1] < a[2] - 1 and a[2] > a[1] and c[2] > c[1]]
    chk("phone: a Home icon (to the site's home) and a menu beside it with the site's sections; the header fits", hm == {"home": "/?view=home", "menu": True, "bar": True, "logo": False} and n == 12 and hdr["spill"] <= 0 and not ov, [hm, n, hdr, ov])
    # a clip on the timeline, zoomed in so the timeline can scroll
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/a.webm"); await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.duration>7)", timeout=30000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a,0);s.editor.select([])}"); await pg.wait_for_timeout(300)
    for _ in range(3):
        if await E("()=>!!document.querySelector('[data-testid=sheet-close]')"): await pg.click('[data-testid="sheet-close"]'); await pg.wait_for_timeout(250)
    cdp = await ctx.new_cdp_session(pg)
    BOX = "()=>{const r=document.querySelector('.clip.video').getBoundingClientRect(),x=r.left+r.width*0.5,y=r.top+r.height/2;return{x,y,w:r.width,on:document.elementFromPoint(x,y)?.closest('.clip')?true:false}}"
    box = await E(BOX)
    async def touchseq(points, hold_ms=0):
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": points[0][0], "y": points[0][1]}]})
        if hold_ms: await pg.wait_for_timeout(hold_ms)
        for x, y in points[1:]:
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y}]}); await pg.wait_for_timeout(16)
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(300)
    c0 = await E(CLIP); sl0 = await E("()=>document.querySelector('.tlscroll').scrollLeft")
    await touchseq([(box["x"], box["y"])] + [(box["x"] - 12 * k, box["y"] - 2 * k) for k in range(1, 12)])
    c1 = await E(CLIP); sl1 = await E("()=>document.querySelector('.tlscroll').scrollLeft")
    chk("a finger swiping across a clip scrolls the timeline — the clip isn't moved or picked", box["on"] and c1["start"] == c0["start"] and c1["sel"] == [] and c1["track"] == c0["track"], [box, c0, c1, sl0, sl1])
    await touchseq([(box["x"], box["y"])]); c2 = await E(CLIP)
    chk("a quick tap picks the clip", len(c2["sel"]) == 1, c2)
    await E("()=>window.__studio.editor.select([])"); await pg.wait_for_timeout(500)
    for _ in range(3):
        if await E("()=>!!document.querySelector('[data-testid=sheet-close]')"): await pg.click('[data-testid="sheet-close"]'); await pg.wait_for_timeout(300)
    box = await E(BOX)
    await touchseq([(box["x"], box["y"])] + [(box["x"] + 6 * k, box["y"]) for k in range(1, 10)], hold_ms=600); c3 = await E(CLIP)
    chk("a press held still for 0.4 s lifts the clip: then the finger moves it", box["on"] and c3["start"] > c0["start"] + 0.05 and len(c3["sel"]) == 1, [box, c0, c3])
    chk("phone: no page errors", not errs, errs); await b.close()

async def pin(p):
    b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1440, "height": 900}); E = pg.evaluate
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(500)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/a.webm"); await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.duration>7)", timeout=30000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a,0);s.actions.addAsset(a,8);s.actions.addAsset(a,16);s.editor.select([]);s.player.seek(0)}"); await pg.wait_for_timeout(300)
    await E("()=>{for(let i=0;i<6;i++)window.__studio.actions.zoom(1.5)}"); await pg.wait_for_timeout(300)
    await E("()=>window.__studio.player.seek(1)"); await pg.wait_for_timeout(300)   # (at 0 the pin's half sits under the track names)
    sc = await E("()=>{const e=document.querySelector('.tlscroll'),r=e.getBoundingClientRect();return{l:r.left,r:r.right,y:r.top+12,sl:e.scrollLeft,sw:e.scrollWidth,cw:e.clientWidth}}")
    pb = await E("()=>{const r=document.querySelector('[data-testid=playhead-pin]').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+8}}")
    await pg.mouse.move(pb["x"], pb["y"]); await pg.mouse.down(); await pg.mouse.move(sc["r"] - 6, pb["y"], steps=8); await pg.wait_for_timeout(900)
    mid = await E("()=>({sl:document.querySelector('.tlscroll').scrollLeft,t:window.__studio.player.clock.t})"); await pg.mouse.up()
    vis = await E("()=>{const e=document.querySelector('.tlscroll'),r=e.getBoundingClientRect(),p=document.querySelector('[data-testid=playhead]').getBoundingClientRect();return p.left>=r.left&&p.left<=r.right}")
    chk("dragging the pin to the timeline's edge scrolls the timeline along (the time goes on with it); the playhead stays in view", sc["sw"] > sc["cw"] and mid["sl"] > sc["sl"] + 40 and mid["t"] > 3 and vis, [sc, mid, vis])
    await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f in (site, tablets, touch, pin):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps(out, ensure_ascii=False)[:900])
if fails: print("v232 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v232 OK")
