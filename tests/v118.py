# v118 in a real browser with a real nooi server (computer, Arabic computer, phone, "reduce motion"):
#  · one frame: on every create / edit / publish / explore page the tabs and the title's icon start at the same place as
#    on Video and Images
#  · tool pages (Motion Control, UGC ads, Video from pictures, Video intelligence, Visual effects ×3, Sketch to life): the
#    settings column on the reading side (left; right in Arabic); with a main button: in view with its own scroll, the button
#    pinned at its foot, visible on the first screen, still working (moved, not rewritten); without one: both columns the same
#    height; the work on the other side; a redraw keeps
#    where you scrolled the settings; phones: one column, the button stays above the bottom bar, nothing wider than the screen
#  · motion: the active tab's pill glides (a page's tabs and the header's sections); new results rise in once — a redraw
#    doesn't replay it; with "reduce motion" none of it runs
# Run: python3 tests/v118.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8329
D = tempfile.mkdtemp(prefix="nooi-v118-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=512x512", "-frames:v", "1", D + "/media/p.jpg"], check=True)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SEED = """()=>{S.jobs=S.jobs.filter(j=>!/^t118/.test(j.id));const now=Date.now();for(let i=0;i<14;i++)S.jobs.push({id:'t118v'+i,kind:'video',status:'complete',progress:1,created:now-(14-i)*1000,prompt:'clip '+i,title:'clip '+i,model:'seedance',dur:5,aspect:'16:9',resultUrl:'/media/p.jpg',pal:PALS[i%PALS.length],seed:i});persist()}"""
TOOLS = {"motion": "mc-make", "ugcads": "ugc-make", "slideshow": "ss83-make", "vss": "vss-run", "fx": "", "grade": "", "mocap": "", "sketch": ""}
WIDE = ["video", "image", "motion", "ugcads", "fx", "sketch", "explore", "voice", "calendar", "plan", "library"]
GEO = """()=>{const g=document.querySelector('#main .tool118'),s=g&&g.querySelector(':scope>.set118'),w=g&&[...g.children].find(c=>c!==s);const r=e=>e?e.getBoundingClientRect():null,sr=r(s),wr=r(w);
  const go=s&&s.querySelector('.go118'),b=go&&go.querySelector('.btn'),br=r(b),cs=s&&getComputedStyle(s);
  return {tool:!!g,set:!!s,sx:sr&&Math.round(sr.left),wx:wr&&Math.round(wr.left),sw:sr&&Math.round(sr.width),sh:sr&&Math.round(sr.height),wh:wr&&Math.round(wr.height),pos:cs&&cs.position,ov:cs&&cs.overflowY,go:!!go,act:b&&b.dataset.act,
    bTop:br&&Math.round(br.top),bBot:br&&Math.round(br.bottom),vh:innerHeight,wide:document.documentElement.scrollWidth-innerWidth,errs:0}}"""

async def page(b, W, H, lang, tag, reduce=False):
    ctx = await b.new_context(viewport={"width": W, "height": H}, is_mobile=W < 600, has_touch=W < 600, reduced_motion="reduce" if reduce else "no-preference")
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await pg.evaluate("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}", lang)
    await pg.evaluate(SEED)
    await pg.evaluate("()=>{window.T118=[];toast=(o=>function(m){T118.push(String(m));return o.apply(this,arguments)})(toast)}")
    return ctx, pg, errs

async def computer(b, lang, tag):
    ctx, pg, errs = await page(b, 1440, 900, lang, tag); E = pg.evaluate; out[tag] = {}
    rtl = lang == "ar"
    # one frame: the title's icon and the tabs start at the same place
    xs = {}
    for v in WIDE:
        await E("(v)=>{go(v);renderAll();scrollTo(0,0)}", v); await pg.wait_for_timeout(250)
        xs[v] = await E("()=>{const c=document.querySelector('#main>.view .tchip90'),t=document.querySelector('#main>.view>.hubtabs'),r=e=>e?Math.round(document.documentElement.dir==='rtl'?innerWidth-e.getBoundingClientRect().right:e.getBoundingClientRect().left):null;return [r(c),r(t)]}")
    out[tag]["frame"] = xs; ref = xs["video"]
    ok(all(abs(x[0] - ref[0]) <= 2 for x in xs.values() if x[0] is not None), f"{tag}: the title's icon starts at the same place on every page {xs}")
    ok(all(abs(x[1] - ref[1]) <= 2 for x in xs.values() if x[1] is not None), f"{tag}: the tabs start at the same place on every page {xs}")
    # tool pages
    for v, act in TOOLS.items():
        await E("(v)=>{go(v);renderAll();scrollTo(0,0);const m=document.getElementById('main');if(m)m.scrollTop=0}", v); await pg.wait_for_timeout(350)
        g = await E(GEO); out[tag][v] = g
        ok(g["tool"] and g["set"], f"{tag} {v}: settings + work in the tool arrangement {g}")
        if not g["set"]: continue
        side = (g["sx"] > g["wx"]) if rtl else (g["sx"] < g["wx"])
        ok(side and 380 <= g["sw"] <= 440, f"{tag} {v}: the settings column on the reading side, 420 px {g}")
        if act: ok(g["pos"] == "sticky" and g["ov"] == "auto", f"{tag} {v}: the settings stay in view with their own scroll {g}")
        else: ok(abs(g["sh"] - g["wh"]) <= 2, f"{tag} {v}: settings and work the same height (equal panels) {g}")
        if act:
            ok(g["go"] and g["act"] == act and g["bBot"] <= g["vh"] and g["bTop"] > 0, f"{tag} {v}: the main button pinned at the foot, visible on the first screen {g}")
            dis = await E("(a)=>{const b=document.querySelector('#main .go118 [data-act=\"'+a+'\"]');return !b||b.disabled}", act)
            if not dis:
                n0 = await E("()=>T118.length"); await pg.click(f'#main .go118 [data-act="{act}"]'); await pg.wait_for_timeout(500)
                msg = await E("(n)=>T118.slice(n)", n0); out[tag][v]["click"] = msg
                ok(len(msg) >= 1, f"{tag} {v}: the moved button still runs its own action (it asks for what's missing) {msg}")
    # a redraw keeps the settings where you scrolled them
    await E("()=>{go('motion');renderAll()}"); await pg.wait_for_timeout(300)
    await E("()=>{const s=document.querySelector('#main .set118');s.scrollTop=240}"); await pg.wait_for_timeout(100)
    k = await E("()=>{renderView();return document.querySelector('#main .set118').scrollTop}")
    ok(k >= 200, f"{tag}: a redraw keeps where you scrolled the settings ({k})")
    # the pill glides: a page's tabs, then the header's sections
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(500)
    await pg.click('#main>.view>.hubtabs [data-go="ugcads"]'); await pg.wait_for_timeout(60)
    p1 = await E("()=>!!document.querySelector('#main>.view>.hubtabs .pill118')"); await pg.wait_for_timeout(600)
    p1b = await E("()=>!!document.querySelector('#main .pill118')")
    ok(p1 and not p1b, f"{tag}: the tab's pill glides to the picked tab, then goes ({p1}, {p1b})")
    await pg.click('#main>.topm .hnav98 [data-go="edit"]'); await pg.wait_for_timeout(60)
    p2 = await E("()=>!!document.querySelector('#main>.topm .hnav98 .pill118')"); await pg.wait_for_timeout(600)
    ok(p2 and await E("()=>S.view") == "edit", f"{tag}: the header's pill glides to the picked section ({p2})")
    # results rise in once; a redraw doesn't replay it
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(40)
    r1 = await E("()=>document.querySelectorAll('#main .gc98.rise118').length"); await pg.wait_for_timeout(1300)
    await E("()=>renderView()"); await pg.wait_for_timeout(40)
    r2 = await E("()=>document.querySelectorAll('#main .gc98.rise118').length")
    ok(r1 >= 6 and r2 == 0, f"{tag}: the results rise in one after another, and a redraw doesn't replay it ({r1}, {r2})")
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()

async def phone(b):
    tag = "ar phone"; ctx, pg, errs = await page(b, 390, 844, "ar", tag); E = pg.evaluate; out[tag] = {}
    for v, act in TOOLS.items():
        await E("(v)=>{go(v);renderAll();scrollTo(0,0)}", v); await pg.wait_for_timeout(300)
        g = await E(GEO); out[tag][v] = g
        ok(g["set"] and g["pos"] != "sticky" and abs(g["sx"] - g["wx"]) <= 2 and g["wide"] <= 1, f"{tag} {v}: one column on a phone, nothing wider than the screen {g}")
        if act:
            await E("()=>{const s=document.querySelector('#main .set118');s.scrollIntoView({block:'start'});scrollBy(0,-60)}"); await pg.wait_for_timeout(250)
            g2 = await E("""()=>{const b=document.querySelector('#main .go118 .btn').getBoundingClientRect(),n=document.getElementById('bottomnav').getBoundingClientRect();return {bot:Math.round(b.bottom),nav:Math.round(n.top),vh:innerHeight}}""")
            out[tag][v]["btn"] = g2
            ok(g2["bot"] <= g2["nav"] + 1 and g2["bot"] > 100, f"{tag} {v}: the main button stays in reach above the bottom bar {g2}")
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()

async def reduced(b):
    tag = "reduce motion"; ctx, pg, errs = await page(b, 1440, 900, "en", tag, True); E = pg.evaluate
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(400)
    await pg.click('#main>.view>.hubtabs [data-go="ugcads"]'); await pg.wait_for_timeout(60)
    p = await E("()=>!!document.querySelector('#main .pill118')")
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(40)
    r = await E("()=>document.querySelectorAll('#main .rise118').length")
    out[tag] = {"pill": p, "rise": r}
    ok(not p and r == 0, f"{tag}: nothing glides or rises with the device's 'reduce motion' ({p}, {r})")
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL="http://localhost:9", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            b = await p.chromium.launch()
            await computer(b, "en", "computer"); await computer(b, "ar", "ar computer"); await phone(b); await reduced(b)
            await b.close()
    finally: srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
