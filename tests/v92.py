# v92 calm icons, in a real browser (file://, no server):
#  · phone (touch): on every main page, tapping the page or an option that is already chosen starts no movement anywhere —
#    no icon redraws itself or pops, the agents don't turn toward the finger and their idle motion carries on instead of
#    starting over; touching a button to scroll doesn't make its icon jump
#  · choosing a new option animates that one icon once, and a redraw a moment later doesn't start it over
#    (v93: the Video page's options are in nooi Studio's box — the tests open its first section)
#  · the open menu item doesn't replay its motion when the page redraws
#  · computer (mouse): hovering still plays an icon's motion and the agents still look toward the pointer
# Run: python3 tests/v92.py
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright
PAGE = os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
VIEWS = ["home", "video", "image", "edit", "chars", "sketch", "world", "crew", "library", "voice", "ugcads", "explore"]
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SET = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'G',method:'google'};S.myPlan='studio';AU.showAuth=false;S.lang=l;renderAll()}"
# animations that move something (not colour fades) and started in the last 400 ms
MOVING = """()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect&&a.effect.target&&(a.currentTime||0)<400).filter(a=>{
  if(a.transitionProperty)return /transform|translate|scale|rotate/.test(a.transitionProperty);return true}).map(a=>{const t=a.effect.target;
  return (a.animationName||a.transitionProperty)+'@'+(t.closest('[data-probe]')?'tapped':((t.getAttribute&&t.getAttribute('class'))||t.tagName||'').toString().split(' ')[0])})"""

async def phone(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
    await pg.goto(PAGE); await pg.wait_for_timeout(600); await pg.evaluate(SET, "ar"); E = pg.evaluate
    for v in VIEWS:
        await E("(v)=>{document.getElementById('modalRoot').innerHTML='';go(v);renderAll();scrollTo(0,0);document.querySelector('#main').scrollTo(0,0)}", v); await pg.wait_for_timeout(1600)
        # 1) tap the page itself (the title) and redraw: nothing starts moving
        h = await pg.query_selector("#main h1") or await pg.query_selector("#main")
        await h.tap(); await E("()=>renderView()"); await pg.wait_for_timeout(120)
        m = [x for x in await E(MOVING) if not x.startswith(("spin", "star", "st79", "shimmer", "load"))]
        out.setdefault("tap", {})[v] = m
        ok(not m, f"phone/{v}: tapping the page and redrawing starts movement {m[:6]}")
        # 2) tap an option that is already chosen: nothing moves
        has = await E("""()=>{document.querySelectorAll('[data-probe]').forEach(x=>x.removeAttribute('data-probe'));const e=[...document.querySelectorAll('#main .tile[data-set][aria-pressed=true]')].find(x=>{const r=x.getBoundingClientRect();return r.width>10&&r.top>40&&r.bottom<840});if(!e)return false;e.setAttribute('data-probe','1');return true}""")
        if has:
            await pg.wait_for_timeout(1000); await pg.tap("[data-probe='1']"); await pg.wait_for_timeout(100)
            m = await E(MOVING); ok(not m, f"phone/{v}: tapping an option that is already chosen starts movement {m[:6]}")
    # 3) a new option: only its icon, once; a redraw 300 ms later doesn't start it over
    await E("()=>{go('video');ST93().open='type';renderAll();scrollTo(0,0);const o=document.querySelector('.sec93:not([hidden])');if(o)o.scrollIntoView({block:'center'})}"); await pg.wait_for_timeout(1500)
    key = await E("""()=>{const e=[...document.querySelectorAll('#main .tile[data-set][aria-pressed=false]')].find(x=>{const r=x.getBoundingClientRect();return r.width>10&&r.top>40&&r.bottom<840});e.setAttribute('data-probe','1');return [e.dataset.set,e.dataset.val]}""")
    await pg.tap("[data-probe='1']"); await pg.wait_for_timeout(30)
    mark = "(k)=>{const e=[...document.querySelectorAll('#main .tile[data-set]')].find(x=>x.dataset.set===k[0]&&x.dataset.val===k[1]);if(e)e.setAttribute('data-probe','1')}"
    await E(mark, key); m = await E(MOVING)
    ok(m and all(x.endswith("@tapped") for x in m), f"phone: choosing a new option animates that icon only {m[:8]}")
    await pg.wait_for_timeout(250); await E("()=>renderView()"); await E(mark, key); await pg.wait_for_timeout(40)
    t = await E("()=>{const e=document.querySelector('[data-probe] .gl');const a=e&&e.getAnimations().find(x=>x.animationName==='pop');return a?Math.round(a.currentTime):null}")
    ok(t is None or t > 200, f"phone: a redraw right after choosing doesn't start the icon over (pop at {t} ms)")
    # 4) the open menu item doesn't replay on a redraw
    await pg.wait_for_timeout(1200); await E("()=>renderAll()"); await pg.wait_for_timeout(60)
    m = await E("()=>document.getAnimations().filter(a=>a.animationName&&a.effect.target.closest&&a.effect.target.closest('#bottomnav,#side')&&(a.currentTime||0)<400).map(a=>a.animationName)")
    ok(not m, f"phone: the open menu item replays its motion on a redraw {m}")
    # 5) the agents: no turning toward the finger, idle motion carries on through a redraw
    await E("()=>{go('crew');renderAll();scrollTo(0,0)}"); await pg.wait_for_timeout(2500)
    await pg.touchscreen.tap(30, 400); await pg.wait_for_timeout(300)
    r = await E("()=>[...document.querySelectorAll('#main svg.bot')].slice(0,6).map(b=>getComputedStyle(b).transform)")
    ok(r and all(x == "none" for x in r), f"phone: agents turn toward the finger {r[:3]}")
    await E("()=>renderView()"); await pg.wait_for_timeout(120)
    r = await E("()=>document.getAnimations().filter(a=>a.effect&&a.effect.target.closest&&a.effect.target.closest('svg.bot')&&a.effect.getTiming().iterations===Infinity).map(a=>Math.round(a.currentTime||0))")
    ok(r and min(r) > 1000, f"phone: agents' idle motion starts over on a redraw {sorted(r)[:5]}")
    # 6) touching a button to scroll doesn't make its icon jump
    await E("()=>{go('video');ST93().open='type';renderAll();scrollTo(0,0);const o=document.querySelector('.sec93:not([hidden])');if(o)o.scrollIntoView({block:'end'})}"); await pg.wait_for_timeout(1200)
    box = await E("()=>{const e=[...document.querySelectorAll('#main .tile')].find(x=>x.getBoundingClientRect().top>200&&x.querySelector('svg[data-mo]'));if(!e)return null;e.setAttribute('data-scroll','1');const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}")
    if box:
        cdp = await ctx.new_cdp_session(pg)
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": box[0], "y": box[1]}]})
        for k in range(1, 8): await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": box[0], "y": box[1] - k * 25}]})
        await pg.wait_for_timeout(40)
        jumped = await E("()=>!!document.querySelector('[data-scroll] svg.ic-play')")
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        ok(not jumped, "phone: touching a button to scroll makes its icon jump")
    ok(not errs, f"phone: page errors {errs[:3]}"); await ctx.close()

async def computer(b):
    ctx = await b.new_context(viewport={"width": 1280, "height": 860}); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
    await pg.goto(PAGE); await pg.wait_for_timeout(600); await pg.evaluate(SET, "en"); E = pg.evaluate
    await E("()=>{go('video');ST93().open='type';renderAll()}"); await pg.wait_for_timeout(1200)
    sel = await E("()=>{const e=[...document.querySelectorAll('#main .tile')].find(x=>x.querySelector('svg[data-mo]')&&x.getBoundingClientRect().top>100);e.setAttribute('data-hover','1');return true}")
    await pg.hover("[data-hover='1']"); await pg.wait_for_timeout(80)
    ok(await E("()=>!!document.querySelector('[data-hover] svg.ic-play')"), "computer: hovering an option no longer plays its icon motion")
    await E("()=>{go('crew');renderAll();scrollTo(0,0)}"); await pg.wait_for_timeout(1500)
    bb = await E("()=>{const b=document.querySelector('#main svg.bot');const r=b.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}")
    await pg.mouse.move(bb[0] + bb[2] + 160, bb[1] + bb[3] / 2, steps=4); await pg.wait_for_timeout(400)
    r = await E("()=>{const b=document.querySelector('#main svg.bot');return getComputedStyle(b).transform}")
    ok(r != "none", f"computer: the agents no longer look toward the mouse {r}")
    ok(not errs, f"computer: page errors {errs[:3]}"); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for part in (phone, computer):
            try: await part(b)
            except Exception as e: fails.append(f"{part.__name__}: crashed — {str(e)[:300]}")
        await b.close()
    print(json.dumps(out, ensure_ascii=False)[:1500])
    print("\n".join("✗ " + f for f in fails) or "✓ v92: calm icons — they move once, when chosen")
    raise SystemExit(1 if fails else 0)

asyncio.run(main())
