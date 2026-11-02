# v221 — nooi Studio on phones, tablets and computers: one editor, three arrangements of the same parts.
#  · computer — computers AND tablets, the same panels and look: rail · library · preview · clip settings over the timeline; a tablet
#    held upright stacks the same four panels (preview across the top, library and clip settings side by side, timeline below)
#  · compact (phones held sideways, screens under 600 px high): rail · full-width preview over the timeline; library and clip
#    settings slide in as drawers
#  · phone held upright: preview / timeline / tool bar; a tool or the clip settings sit between a smaller preview and the timeline
#  At 11 sizes: no sideways or up-down page scroll, no control off the screen, Export reachable, the export button in view, a file
#  goes to the library and onto the timeline, the video frame fits inside the preview; on touch screens few controls under 24 px.
#  On a tablet, all four panels are on screen together and a clip tap fills the Clip panel (the library stays). On a phone, tapping
#  a clip opens its settings with the timeline still in view; adding from the library keeps the library open; ✕ closes them.
# Run: python3 tests/v221.py
import asyncio, os, subprocess, sys, tempfile, time, urllib.request, json
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8717; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v221-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-f", "lavfi", "-i", "sine=frequency=330:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-c:a", "libopus", "-shortest", D + "/a.webm"], check=True, timeout=120, stdin=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("FIREBASE_", "NOOI_", "RENDER_", "LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
VP = [("phone 360", 360, 740, True, "phone"), ("phone 390", 390, 844, True, "phone"), ("phone 430", 430, 932, True, "phone"), ("phone sideways 844", 844, 390, True, "compact"),
      ("tablet 768", 768, 1024, True, "full"), ("tablet 820", 820, 1180, True, "full"), ("tablet sideways 1024", 1024, 768, True, "full"), ("tablet sideways 1180", 1180, 820, True, "full"),
      ("laptop 1280", 1280, 800, False, "full"), ("desktop 1440", 1440, 900, False, "full"), ("desktop 1920", 1920, 1080, False, "full")]
AUDIT="""()=>{const W=innerWidth,H=innerHeight,out=[],small=[];
for(const e of document.querySelectorAll('button,a,input,select,[role=slider]')){const r=e.getBoundingClientRect();const cs=getComputedStyle(e);if(!r.width||!r.height||cs.visibility==='hidden')continue;
 let p=e,clip=false;while(p=p.parentElement){const s=getComputedStyle(p);if(/(auto|scroll|hidden)/.test(s.overflowX+s.overflowY)){const q=p.getBoundingClientRect();if(r.right<=q.left+1||r.left>=q.right-1||r.bottom<=q.top+1||r.top>=q.bottom-1){clip=true;break}}}
 if(clip||e.closest('.tlbar'))continue;
 if(r.right>W+1||r.left<-1||r.bottom>H+1)out.push((e.dataset.testid||e.getAttribute('aria-label')||e.title||e.textContent||e.tagName).trim().slice(0,24)+'@'+Math.round(r.left)+','+Math.round(r.top));
 if(Math.min(r.width,r.height)<24&&e.tagName!=='INPUT')small.push((e.dataset.testid||e.getAttribute('aria-label')||e.title||e.textContent||e.tagName).trim().slice(0,18)+':'+Math.round(r.width)+'x'+Math.round(r.height))}
const areas={};for(const s of ['.topbar','.panel','.player','.inspector','.timeline','.rail','[data-testid=preview]']){const e=document.querySelector(s);if(e){const r=e.getBoundingClientRect();areas[s]=[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]}}
return {W,H,scrollX:document.documentElement.scrollWidth-W,scrollY:document.documentElement.scrollHeight-H,off:out.slice(0,15),nOff:out.length,small:small.slice(0,12),nSmall:small.length,areas,phone:!!document.querySelector('.app.phone')}}"""

async def size(b, name, w, h, touch, mode):
    ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch and w < 900); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio", timeout=30000); await pg.wait_for_timeout(800)
    got = await pg.evaluate("()=>['full','compact','phone'].find(m=>document.querySelector('.app').classList.contains(m))")
    chk(f"{name}: the {mode} arrangement", got == mode, got)
    if not await pg.locator('[data-testid="file-input"]').count(): await pg.click('[data-testid="rail-media"]'); await pg.wait_for_timeout(300)
    await pg.set_input_files('[data-testid="file-input"]', [D + "/a.webm"]); await pg.wait_for_function("Object.keys(window.__studio.editor.project.assets).length===1", timeout=20000); await pg.wait_for_timeout(400)
    await pg.locator('[data-testid="asset"] .libp').first.click(); await pg.wait_for_timeout(500)
    r = await pg.evaluate(AUDIT); r["clips"] = await pg.evaluate("()=>window.__studio.editor.project.tracks.reduce((s,t)=>s+t.clips.length,0)")
    chk(f"{name}: no page scroll, nothing off the screen, the file on the timeline", r["scrollX"] <= 0 and r["scrollY"] <= 0 and r["nOff"] == 0 and r["clips"] == 1, {k: r[k] for k in ("scrollX", "scrollY", "off", "clips")})
    if touch: chk(f"{name}: touch-size controls (at most 3 under 24 px)", r["nSmall"] <= 3, r["small"])
    pv, pl = r["areas"].get("[data-testid=preview]"), r["areas"].get(".player")
    chk(f"{name}: the video frame fits inside the preview", pv and pl and pv[0] >= pl[0] and pv[0] + pv[2] <= pl[0] + pl[2] + 1 and pv[1] >= pl[1] and pv[1] + pv[3] <= pl[1] + pl[3] + 1 and pv[2] >= 120, [pv, pl])
    if mode == "full":
        vis = all(k in r["areas"] and r["areas"][k][2] >= 200 and r["areas"][k][3] >= 150 for k in (".panel", ".inspector", ".player", ".timeline"))
        chk(f"{name}: library, preview, clip settings and timeline all on screen at once (the computer look)", vis, {k: r["areas"].get(k) for k in (".panel", ".player", ".inspector", ".timeline")})
    await pg.click('[data-testid="export"]'); await pg.wait_for_timeout(400)
    g = await pg.evaluate("()=>{const g=document.querySelector('[data-testid=export-go]').getBoundingClientRect();return g.bottom<=innerHeight&&g.top>=0&&g.right<=innerWidth}")
    chk(f"{name}: the export button is in view", g)
    chk(f"{name}: no page errors", not errs, errs); await ctx.close()

async def flow(b, name, w, h, lang):
    ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=True, is_mobile=w < 900); pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio", timeout=30000); await pg.wait_for_timeout(600)
    if lang == "ar": await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="rail-media"]'); await pg.wait_for_timeout(300)
    await pg.set_input_files('[data-testid="file-input"]', [D + "/a.webm"]); await pg.wait_for_function("Object.keys(window.__studio.editor.project.assets).length===1", timeout=20000); await pg.wait_for_timeout(400)
    await pg.locator('[data-testid="asset"] .libp').first.click(); await pg.wait_for_timeout(400)
    full = await pg.evaluate("()=>document.querySelector('.app').classList.contains('full')")
    if full:
        await pg.evaluate("()=>window.__studio.editor.select([])"); await pg.wait_for_timeout(200)
        await pg.locator('.clip').first.tap(); await pg.wait_for_timeout(500)
        r = await pg.evaluate("()=>({lib:!!document.querySelector('.workspace > .panel .lib'),clip:(document.querySelector('.workspace > .inspector .ihead h2')||{}).textContent,tl:document.querySelector('.timeline').getBoundingClientRect().height>150,drawer:!!document.querySelector('.drawer,.msheet')})")
        chk(f"{name}: a clip tap fills the Clip panel, the library stays beside it, no drawers (the computer look)", r["lib"] and r["clip"] in ("Clip", "المقطع") and r["tl"] and not r["drawer"], r)
        chk(f"{name}: no page errors", not errs, errs); await ctx.close(); return
    s1 = await pg.evaluate("()=>({lib:!!document.querySelector('.drawer.start,.msheet:not(.insp)'),insp:!!document.querySelector('.drawer.end,.msheet.insp')})")
    chk(f"{name}: adding from the library keeps the library open", s1 == {"lib": True, "insp": False}, s1)
    c = pg.locator('[data-testid=drawer-close],[data-testid=sheet-close]')
    if await c.count(): await c.first.click(); await pg.wait_for_timeout(300)
    await pg.evaluate("()=>window.__studio.editor.select([])"); await pg.wait_for_timeout(200)
    await pg.locator('.clip').first.tap(); await pg.wait_for_timeout(500)
    s2 = await pg.evaluate("()=>{const d=document.querySelector('.drawer.end,.msheet.insp');const tl=document.querySelector('.timeline').getBoundingClientRect();const r=d&&d.getBoundingClientRect();return {insp:!!d,tl:tl.height>100&&tl.bottom<=innerHeight+1,side:d&&d.classList.contains('drawer')?(r.left+r.width/2>innerWidth/2?'right':'left'):'sheet'}}")
    want = "sheet" if w < 768 else ("left" if lang == "ar" else "right")
    chk(f"{name}: tapping a clip opens its settings, the timeline still in view" + ("" if want == "sheet" else f", from the {want}"), s2["insp"] and s2["tl"] and s2["side"] == want, s2)
    x = pg.locator('.drawer.end .ihead .ns-btn.ghost, .msheet.insp .ihead .ns-btn.ghost')
    if await x.count(): await x.last.click(); await pg.wait_for_timeout(300)
    s3 = await pg.evaluate("()=>!!document.querySelector('.drawer.end,.msheet.insp')")
    chk(f"{name}: the settings' own close closes them", not s3)
    chk(f"{name}: no page errors", not errs, errs); await ctx.close()

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for v in VP:
            try: await size(b, *v)
            except Exception as e: fails.append(f"{v[0]} crashed: " + repr(e)[:300])
        for f in [("tablet 768 English", 768, 1024, "en"), ("tablet 768 Arabic", 768, 1024, "ar"), ("phone 390 English", 390, 844, "en"), ("phone 390 Arabic", 390, 844, "ar"), ("phone sideways 844", 844, 390, "en")]:
            try: await flow(b, *f)
            except Exception as e: fails.append(f"{f[0]} crashed: " + repr(e)[:300])
        await b.close()
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails}, ensure_ascii=False, indent=1)[:5000])
print("v221 OK" if not fails else "v221 FAIL")
sys.exit(1 if fails else 0)
