# v244 — 3D graphics, hand-drawn looks, Emoji pop and Text punch, speed ramps, icons on the graphics' groups
#  · Titles → Motion graphics: a 3D group (8: extruded title, spinning coin, product box, phone, flying particles, fly-through,
#    3D bar chart, globe with routes) and a Hand-drawn group (7: cut paper, crosshatch ink, risograph, sketchbook, math, isometric,
#    pixel art); every tile is drawn, every graphic draws in the preview and moves; the same moment always draws the same picture
#  · the two flat graphics we didn't have: Emoji pop (Social) and Text punch (Titles)
#  · every group chip has an icon
#  · Speed ramps (the clip's Speed tab): 8 curves, each tile with its curve and a moving example; Bullet time makes the clip ten
#    parts at the curve's speeds (one undo step), the clip after it moves along
#  · Arabic: a hand-drawn graphic laid out right to left
# Run: python3 tests/v244.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8761; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v244-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k", D + "/clip.webm")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "SEEDANCE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1200]))
P = "window.__studio.editor.project"
G3 = ["3d-title", "3d-coin", "3d-box", "3d-phone", "3d-particles", "3d-fly", "3d-chart", "3d-globe"]
DR = ["dr-paper", "dr-ink", "dr-riso", "dr-sketch", "dr-math", "dr-iso", "dr-pixel"]
LIT = """()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);
let n=0,h=0;for(let i=0;i<d.length;i+=64){const v=d[i]+d[i+1]+d[i+2];if(v>60)n++;h=(h*31+(v>>3))%1000003}return{n,h}}"""
TILE = "(i)=>{const c=document.querySelector('[data-testid=mg-'+i+'] canvas');if(!c)return -1;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let k=3;k<d.length;k+=16)if(d[k]>40)n++;return n}"

async def gallery(pg, E, group, ids):
    await pg.click(f'[data-testid="mgg-{group}"]'); await pg.wait_for_timeout(300)
    n = await E("()=>[...document.querySelectorAll('.mgal .mgt')].map(t=>t.dataset.testid)")
    for i in ids: await pg.locator(f'[data-testid="mg-{i}"]').scroll_into_view_if_needed()
    await pg.wait_for_timeout(1200); blank = [[i, v] for i in ids if (v := await E(TILE, i)) < 30]
    return n, blank

async def moves(pg, E, ids):
    bad = []
    for i in ids:
        await E("(i)=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).map(c=>c.id));s.actions.del();s.player.seek(0);s.actions.addMotion(i,0)}", i)
        dur = await E("()=>" + P + ".tracks.flatMap(t=>t.clips)[0].dur")
        await E("(t)=>window.__studio.player.seek(t)", dur * 0.15); await pg.wait_for_timeout(300); a = await E(LIT)
        await E("(t)=>window.__studio.player.seek(t)", dur * 0.6); await pg.wait_for_timeout(300); c = await E(LIT)
        await E("(t)=>window.__studio.player.seek(t)", dur * 0.15); await pg.wait_for_timeout(300); a2 = await E(LIT)
        if c["n"] < 40 or a["h"] == c["h"] or a["h"] != a2["h"]: bad.append([i, a, c, a2])
    await E("()=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).map(c=>c.id));s.actions.del()}")
    return bad

async def studio(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="rail-titles"]'); await pg.click('.panel .subtabs button:has-text("Motion graphics")'); await pg.wait_for_selector('[data-testid="motion-gallery"]')
    icons = await E("()=>[...document.querySelectorAll('[data-testid^=mgg-]')].map(b=>[b.dataset.testid,!!b.querySelector('svg')])")
    chk("every group chip has an icon, and the 3D and Hand-drawn groups are there", all(x[1] for x in icons) and any(x[0] == "mgg-3d" for x in icons) and any(x[0] == "mgg-drawn" for x in icons), icons)
    n, blank = await gallery(pg, E, "3d", G3); await pg.screenshot(path=D + "/g3d.png")
    chk("3D: eight graphics, every tile drawn", sorted(n) == sorted("mg-" + i for i in G3) and not blank, [n, blank])
    n, blank = await gallery(pg, E, "drawn", DR); await pg.screenshot(path=D + "/gdrawn.png")
    chk("Hand-drawn: seven looks, every tile drawn", sorted(n) == sorted("mg-" + i for i in DR) and not blank, [n, blank])
    await pg.click('[data-testid="mgg-social"]'); await pg.wait_for_timeout(200); so = await E("()=>!!document.querySelector('[data-testid=mg-so-emoji]')")
    await pg.click('[data-testid="mgg-titles"]'); await pg.wait_for_timeout(200); ti = await E("()=>!!document.querySelector('[data-testid=mg-ti-punch]')")
    chk("Emoji pop in Social and Text punch in Titles", so and ti, [so, ti])
    bad = await moves(pg, E, G3 + DR + ["so-emoji", "ti-punch"])
    chk("each one draws in the preview, moves, and draws the same picture at the same moment", not bad, bad)
    # a few frames to look at
    for i in ("3d-box", "3d-globe", "dr-paper", "dr-riso", "dr-iso", "dr-pixel"):
        await E("(i)=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).map(c=>c.id));s.actions.del();s.actions.addMotion(i,0);s.player.seek(2.4)}", i); await pg.wait_for_timeout(400)
        await pg.locator('[data-testid="preview"]').screenshot(path=D + f"/f-{i}.png")
    await E("()=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).map(c=>c.id));s.actions.del()}")
    # ---- speed ramps
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/clip.webm")
    await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.w&&a.duration)", timeout=30000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a);s.actions.addAsset(a);const cs=s.editor.project.tracks.flatMap(t=>t.clips).sort((x,y)=>x.start-y.start);s.editor.select([cs[0].id])}"); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="insp-speed"]'); await pg.wait_for_selector('[data-testid="ramps"]')
    tiles = await E("()=>[...document.querySelectorAll('[data-testid^=ramp-]')].map(b=>({id:b.dataset.testid,icon:!!b.querySelector('svg path.rmpc'),anim:getComputedStyle(b.querySelector('.rmpx i')).animationName}))")
    chk("Speed ramps: eight curves, each with its curve icon and a moving example", len(tiles) == 8 and all(t["icon"] and t["anim"].startswith("rmp-") for t in tiles), tiles)
    await pg.locator('[data-testid="ramps"]').screenshot(path=D + "/ramps.png")
    n0 = await E("()=>window.__studio.editor.past.length"); await pg.click('[data-testid="ramp-bullet"]'); await pg.wait_for_timeout(300)
    cl = await E("()=>" + P + ".tracks.filter(t=>t.kind==='video').slice(-1)[0].clips.slice().sort((a,b)=>a.start-b.start).map(c=>[+c.start.toFixed(3),+c.dur.toFixed(3),c.speed,+c.in.toFixed(3)])")
    n1 = await E("()=>window.__studio.editor.past.length")
    ok = len(cl) == 11 and [c[2] for c in cl[:10]] == [3, 3, 2, 0.25, 0.2, 0.2, 0.25, 2, 3, 3] and all(abs(cl[i][0] - (cl[i - 1][0] + cl[i - 1][1])) < 0.002 for i in range(1, 11)) and abs(cl[9][3] + cl[9][1] * cl[9][2] - 6) < 0.01
    chk("Bullet time: ten parts at the curve's speeds over the same source, the next clip moves along — one undo step", ok and n1 == n0 + 1, cl)
    await E("()=>window.__studio.actions.undo()"); n2 = await E("()=>" + P + ".tracks.filter(t=>t.kind==='video').slice(-1)[0].clips.length")
    chk("…Undo puts the clip back", n2 == 2, n2)
    chk("studio: no page errors", not errs, errs); await b.close()

async def arabic(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1280, "height": 800}); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="rail-titles"]'); await pg.click('.panel .subtabs button >> nth=1'); await pg.wait_for_selector('[data-testid="motion-gallery"]')
    chips = await E("()=>[document.querySelector('[data-testid=mgg-3d]').textContent,document.querySelector('[data-testid=mgg-drawn]').textContent]")
    await E("()=>{const s=window.__studio;s.actions.addMotion('dr-sketch',0);s.player.seek(3)}"); await pg.wait_for_timeout(500)
    props = await E("()=>" + P + ".tracks.flatMap(t=>t.clips)[0].motion.props")
    await pg.locator('[data-testid="preview"]').screenshot(path=D + "/ar-sketch.png")
    chk("Arabic: the groups named in Arabic, a hand-drawn graphic made with Arabic words", chips == ["ثلاثي الأبعاد", "مرسوم باليد"] and props.get("title") == "فكرة كبيرة", [chips, props])
    chk("arabic: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f in (studio, arabic):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
if fails: print("v244 FAIL\n - " + "\n - ".join(fails)); print("shots:", D); sys.exit(1)
if os.environ.get("KEEP"): print("shots:", D)
else: subprocess.run(["rm", "-rf", D])
print("v244 OK")
