# v120 in a real browser with a real nooi server (computer, Arabic phone, "reduce motion"):
#  · footer: Home, Templates, Community, Recipes, All tools and My library end with the full footer — the logo, one line, the
#    email, four columns whose links carry each tool's own name and open it, © · Terms · Privacy; a tool switched off isn't
#    listed; work pages keep the slim footer line; on a phone it ends above the bottom bar
#  · bars: the top bar turns to frosted glass once the page scrolls (and back at the top); the phone's bottom bar marks the open
#    item and its highlight glides to the item tapped
#  · buttons: a main button has its light sweep (and it doesn't move with "reduce motion")
#  · cards: on a phone the words never lie on top of the engine's name or the buttons; on a computer they show under the pointer,
#    the engine's name steps aside, and they stop before the expand button
# Run: python3 tests/v120.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8332
D = tempfile.mkdtemp(prefix="nooi-v120-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=512x512", "-frames:v", "1", D + "/media/p.jpg"], check=True)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SEED = """()=>{const now=Date.now();for(let i=0;i<6;i++)S.jobs.push({id:'t120v'+i,kind:'video',status:'complete',progress:1,created:now-i*1000,prompt:'A red car on a coast road at sunset, a long description number '+i,title:'A red car on a coast road at sunset, a long description number '+i,model:'seedance',dur:5,aspect:'16:9',resultUrl:'/media/p.jpg',pal:PALS[i%PALS.length],seed:i});persist()}"""
FOOT = """()=>{const f=document.querySelector('#main .foot120');if(!f)return null;const cols=[...f.querySelectorAll('.f120col')];
  return {cols:cols.map(c=>c.querySelector('h3').textContent),links:cols.flatMap(c=>[...c.querySelectorAll('a[data-go]')].map(a=>[a.dataset.go,a.textContent])),
    names:Object.fromEntries(ALLNAV.map(x=>[x[0],L(x[2],x[3])])),logo:!!f.querySelector('.f120logo [class],.f120logo b,.f120logo svg'),mail:!!f.querySelector('a[href^="mailto:"]'),legal:f.querySelectorAll('[data-act="legal"]').length,
    h3:[...f.querySelectorAll('h3')].map(h=>parseFloat(getComputedStyle(h).fontSize))}}"""

async def start(b, W, H, lang, reduce=False):
    ctx = await b.new_context(viewport={"width": W, "height": H}, is_mobile=W < 600, has_touch=W < 600, reduced_motion="reduce" if reduce else "no-preference")
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await pg.evaluate("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}", lang)
    await pg.evaluate(SEED); return ctx, pg, errs

async def computer(b):
    tag = "computer"; ctx, pg, errs = await start(b, 1440, 900, "en"); E = pg.evaluate; out[tag] = {}
    for v in ["home", "explore", "discover", "recipes", "apps", "library"]:
        await E("(v)=>{go(v);renderAll()}", v); await pg.wait_for_timeout(250); f = await E(FOOT); out[tag][v] = f and {"cols": f["cols"], "n": len(f["links"])}
        ok(f and f["cols"] == ["Create", "Edit & publish", "Explore", "Account & help"] and len(f["links"]) >= 15 and f["logo"] and f["mail"] and f["legal"] == 3, f"{tag} {v}: the full footer (v156: Terms, Privacy and the Publishing policy) {f and {k: f[k] for k in ('cols', 'logo', 'mail', 'legal')}}")
        if f: ok(all(f["names"].get(g, t) == t for g, t in f["links"]) and all(x == 14 for x in f["h3"]), f"{tag} {v}: each link carries its tool's own name; headings 14 px {[x for x in f['links'] if f['names'].get(x[0], x[1]) != x[1]]} {f['h3']}")
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(250)
    w = await E("()=>({big:!!document.querySelector('#main .foot120'),slim:!!document.querySelector('#main .appfoot')})"); out[tag]["video"] = w
    ok(not w["big"] and w["slim"], f"{tag}: a work page keeps the slim footer line {w}")
    # a footer link opens its tool
    await E("()=>{go('apps');renderAll()}"); await pg.wait_for_timeout(250)
    await E("()=>document.querySelector('#main .foot120 a[data-go=\"fx\"]').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
    await pg.click('#main .foot120 a[data-go="fx"]'); await pg.wait_for_timeout(300)
    ok(await E("()=>S.view") in ("fx", "bg"), f"{tag}: a footer link opens its tool ({await E('()=>S.view')})")
    # a tool switched off isn't listed
    off = await E("""()=>{const o=featureOn;featureOn=f=>f===FEATURE_OF_VIEW.fx?false:o(f);go('apps');renderAll();const has=!!document.querySelector('#main .foot120 a[data-go="fx"]');featureOn=o;renderAll();return [FEATURE_OF_VIEW.fx||null,has]}""")
    ok(off[0] is None or off[1] is False, f"{tag}: a tool switched off isn't in the footer {off}")
    # the top bar: frosted glass once the page scrolls
    await E("()=>{go('apps');renderAll();const sc=()=>{const m=document.getElementById('main');return m.scrollHeight>m.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(m).overflowY)?m:document.scrollingElement};sc().scrollTop=0}"); await pg.wait_for_timeout(300); g0 = await E("()=>document.querySelector('#main>.topm').classList.contains('scr120')")
    await E("()=>{const sc=()=>{const m=document.getElementById('main');return m.scrollHeight>m.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(m).overflowY)?m:document.scrollingElement};sc().scrollTop=600}"); await pg.wait_for_timeout(300)
    g1 = await E("()=>{const t=document.querySelector('#main>.topm');return [t.classList.contains('scr120'),getComputedStyle(t).backdropFilter]}")
    await E("()=>{const sc=()=>{const m=document.getElementById('main');return m.scrollHeight>m.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(m).overflowY)?m:document.scrollingElement};sc().scrollTop=0}"); await pg.wait_for_timeout(300); g2 = await E("()=>document.querySelector('#main>.topm').classList.contains('scr120')")
    out[tag]["bar"] = [g0, g1, g2]
    ok(not g0 and g1[0] and "blur" in g1[1] and not g2, f"{tag}: the top bar turns to frosted glass when the page scrolls, and back at the top {[g0, g1, g2]}")
    # a main button's light sweep
    s = await E("""()=>{go('motion');renderAll();const b=document.querySelector('#main .btn.primary');const c=getComputedStyle(b,'::before');return {pos:getComputedStyle(b).position,over:getComputedStyle(b).overflow,content:c.content,at:c.backgroundPosition,bg:c.backgroundImage.slice(0,30)}}""")
    out[tag]["button"] = s
    ok(s["pos"] == "relative" and s["over"] == "visible" and s["content"] == '""' and "gradient" in s["bg"] and s["at"].startswith("100%"), f"{tag}: a main button has its light sweep, without cutting its label {s}")
    # cards under the pointer: the words show, the engine's name steps aside, the words stop before the expand button
    await E("()=>{go('video');renderAll();scrollTo(0,0)}"); await pg.wait_for_timeout(500)
    await pg.hover("#main .gc98 .tk98"); await pg.wait_for_timeout(400)
    c = await E("""()=>{const c=document.querySelector('#main .gc98'),g=c.querySelector('.gp98'),t=c.querySelector('.tag98'),z=c.querySelector('.zoom80');const cs=getComputedStyle(g),r=g.getBoundingClientRect(),zr=z.getBoundingClientRect();
      return {words:+cs.opacity,tag:+getComputedStyle(t).opacity,textRight:Math.round(r.right-parseFloat(cs.paddingRight)),zoomLeft:Math.round(zr.left)}}""")
    out[tag]["card"] = c
    ok(c["words"] == 1 and c["tag"] == 0 and c["textRight"] <= c["zoomLeft"], f"{tag}: under the pointer the words show, the engine's name steps aside, the words stop before the expand button {c}")
    ok(not errs, f"{tag}: no page errors {errs[:3]}"); await ctx.close()

async def phone(b):
    tag = "ar phone"; ctx, pg, errs = await start(b, 390, 844, "ar"); E = pg.evaluate; out[tag] = {}
    await E("()=>{go('video');renderAll();scrollTo(0,0)}"); await pg.wait_for_timeout(500)
    c = await E("""()=>{const c=document.querySelector('#main .gc98'),g=c.querySelector('.gp98'),t=c.querySelector('.tag98');return {words:getComputedStyle(g).display,tag:+getComputedStyle(t).opacity}}""")
    out[tag]["card"] = c
    ok(c["words"] == "none" and c["tag"] == 1, f"{tag}: a result card shows its picture, length and engine — no words on top of them {c}")
    # the bottom bar: the open item is marked; the highlight glides to the tapped one
    m = await E("""()=>{const a=document.querySelector('#bottomnav [aria-current="page"]');return a?getComputedStyle(a).backgroundColor:null}""")
    await E("()=>{window.__pill=0;new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.classList&&n.classList.contains('pill118')&&n.closest('#bottomnav'))__pill++}).observe(document.body,{childList:true,subtree:true})}")
    await pg.click('#bottomnav [data-go="image"]'); await pg.wait_for_timeout(900)
    p1 = await E("()=>__pill>0")
    p2 = await E("""()=>({pill:!!document.querySelector('#bottomnav .pill118'),cur:(document.querySelector('#bottomnav [aria-current="page"]')||{}).dataset?.go,view:S.view})""")
    out[tag]["bottom"] = [m, p1, p2]
    ok(m and m not in ("rgba(0, 0, 0, 0)", "transparent") and p1 and not p2["pill"] and p2["view"] == "image", f"{tag}: the bottom bar marks the open item and its highlight glides to the tapped one {[m, p1, p2]}")
    # the footer ends above the bottom bar
    await E("()=>{go('apps');renderAll()}"); await pg.wait_for_timeout(300)
    await E("()=>{const sc=()=>{const m=document.getElementById('main');return m.scrollHeight>m.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(m).overflowY)?m:document.scrollingElement};const s=sc();s.scrollTop=s.scrollHeight}"); await pg.wait_for_timeout(400)
    f = await E("""()=>{const f=document.querySelector('#main .f120bot'),n=document.getElementById('bottomnav');return f&&n?{bot:Math.round(f.getBoundingClientRect().bottom),nav:Math.round(n.getBoundingClientRect().top),cols:[...document.querySelectorAll('#main .f120col h3')].map(h=>h.textContent),wide:document.documentElement.scrollWidth-innerWidth}:null}""")
    out[tag]["foot"] = f
    ok(f and f["bot"] <= f["nav"] and f["cols"] == ["إنشاء", "التحرير والنشر", "استكشف", "الحساب والمساعدة"] and f["wide"] <= 1, f"{tag}: the footer in Arabic ends above the bottom bar, nothing wider than the screen {f}")
    ok(not errs, f"{tag}: no page errors {errs[:3]}"); await ctx.close()

async def reduced(b):
    tag = "reduce motion"; ctx, pg, errs = await start(b, 1440, 900, "en", True); E = pg.evaluate
    await E("()=>{go('motion');renderAll()}"); await pg.wait_for_timeout(300)
    btn = await pg.query_selector("#main .btn.primary"); await btn.hover(); await pg.wait_for_timeout(300)
    s = await E("()=>{const c=getComputedStyle(document.querySelector('#main .btn.primary'),'::before');return [c.backgroundPosition,c.transitionDuration]}"); out[tag] = s
    ok(s[1] in ("0s", "") and s[0].startswith("100%"), f"{tag}: a main button's light doesn't move with 'reduce motion' {s}")
    ok(not errs, f"{tag}: no page errors {errs[:3]}"); await ctx.close()

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL="http://localhost:9", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            b = await p.chromium.launch(); await computer(b); await phone(b); await reduced(b); await b.close()
    finally: srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
