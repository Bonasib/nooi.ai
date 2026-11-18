# The logo is still: it draws itself once on the first visit (the dot rides the line and lands on the i), then every logo on every
# page is complete — on hover, on a page change, on a phone tap and after a reload in the same visit. The dot no longer beats.
import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
SAMPLE="""()=>[...document.querySelectorAll('.nbrand')].filter(x=>x.offsetParent).map(b=>{const sv=b.querySelector('.nmark'),d=b.querySelector('.nm-dot'),l=b.querySelector('.nm-ln');const prog=1-parseFloat(getComputedStyle(l).strokeDashoffset);const tip=l.getPointAtLength(l.getTotalLength()*Math.max(0,Math.min(1,prog)));const cx=+d.getAttribute('cx'),cy=+d.getAttribute('cy');
  return {line:+prog.toFixed(2),r:+(+d.getAttribute('r')).toFixed(0),gap:Math.round(Math.hypot(cx-tip.x,cy-tip.y)),atI:Math.round(Math.hypot(cx-802.5,cy-312.7)),playing:sv.classList.contains('playing'),beat:d.getAnimations().length}})"""
fails=[]; log={}
def ok(c,m):
    if not c: fails.append(m)
# (v204 put the owner's logo in: its dot is smaller and rests elsewhere — "complete" is now: the line drawn, nothing playing or
#  beating, and the dot at the same resting place in every logo and every sample)
REST={}
def complete(s):
    if not s or not all(x["line"]==1 and not x["playing"] and x["beat"]==0 for x in s): return False
    for x in s: REST.setdefault("p",(x["r"],x["atI"]))
    return all((x["r"],x["atI"])==REST["p"] for x in s)
async def series(pg,label,times):
    out=[];t0=0
    for t in times:
        await pg.wait_for_timeout(t-t0);t0=t;out.append(await pg.evaluate(SAMPLE))
    log[label]=out; return out
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={"width":1280,"height":800}); pg=await ctx.new_page()
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE)
        s=await series(pg,"first visit (the first page the visitor sees)",[60,400,800,1200,1600,1900,2600])
        await pg.evaluate("()=>{S.user={name:'G',method:'google'};S.view='home';renderAll()}"); await pg.wait_for_timeout(700)
        ok(all(complete(x) for x in [await pg.evaluate(SAMPLE)]), "after signing in: complete, no second drawing")
        moving=[x for snap in s[:4] for x in snap if x["line"]<1]
        ok(moving and all(x["gap"]<=2 for x in moving), f"first visit: the dot rides the tip of the line {s[:4]}")
        ok(complete(s[-1]), f"first visit: complete at the end {s[-1]}")
        bb=await pg.evaluate("(()=>{const r=[...document.querySelectorAll('.nbrand')].find(x=>x.offsetParent).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        await pg.mouse.move(bb[0],bb[1]); s=await series(pg,"hover",[100,400,900])
        ok(all(complete(x) for x in s), f"hover: still complete {s}")
        await pg.mouse.move(5,600)
        for v in ("video","account","edit","world","image"):
            await pg.evaluate(f"()=>go('{v}')"); s=await series(pg,"page "+v,[60,300,700])
            ok(all(complete(x) for x in s), f"page change to {v}: complete at once {s}")
        await pg.reload(); await pg.evaluate("()=>{S.user={name:'G',method:'google'};S.view='home';renderAll()}"); await pg.wait_for_timeout(300)
        s=await series(pg,"reload, same visit",[100,500])
        ok(all(complete(x) for x in s), f"reload in the same visit: no second drawing {s}")
        m=await (await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)).new_page()
        await m.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await m.goto(PAGE);await m.evaluate("()=>{S.user={name:'G',method:'google'};S.view='home';renderAll()}");await m.wait_for_timeout(2600)
        bb=await m.evaluate("(()=>{const r=[...document.querySelectorAll('.nbrand')].find(x=>x.offsetParent).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        await m.touchscreen.tap(bb[0],bb[1]); s=await series(m,"phone tap",[100,600])
        ok(all(complete(x) for x in s), f"phone tap: still complete {s}")
        await m.evaluate("()=>go('chars')"); s=await series(m,"phone page change",[60,400])
        ok(all(complete(x) for x in s), f"phone page change: complete {s}")
        await b.close()
asyncio.run(main())
print(json.dumps({"fails":fails,"checks":len(log)},default=str))
