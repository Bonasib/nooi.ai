import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
SAMPLE="""()=>{const b=[...document.querySelectorAll('.nbrand')].find(x=>x.offsetParent);const sv=b.querySelector('.nmark'),d=b.querySelector('.nm-dot'),l=b.querySelector('.nm-ln');const prog=1-parseFloat(getComputedStyle(l).strokeDashoffset);const tip=l.getPointAtLength(l.getTotalLength()*Math.max(0,Math.min(1,prog)));const cx=+d.getAttribute('cx'),cy=+d.getAttribute('cy');return {line:+prog.toFixed(2),r:+(+d.getAttribute('r')).toFixed(0),gap:Math.round(Math.hypot(cx-tip.x,cy-tip.y)),atI:Math.round(Math.hypot(cx-802.5,cy-312.7)),playing:sv.classList.contains('playing')}}"""
async def series(pg,label,times):
    out=[];t0=0
    for t in times:
        await pg.wait_for_timeout(t-t0);t0=t;s=await pg.evaluate(SAMPLE)
        out.append(f"{t/1000:.1f}s line {s['line']:.2f} · dot r{s['r']} · {'on tip (gap '+str(s['gap'])+')' if s['line']<1 else ('at the i' if s['atI']<3 else 'jumping ('+str(s['atI'])+' away)')}")
    print(label);[print("   ",x) for x in out]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await (await b.new_context(viewport={"width":1280,"height":800})).new_page()
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE)
        await pg.evaluate("()=>{S.user={name:'G',method:'google'};S.view='home';renderAll()}")
        await series(pg,"1) on load",[150,500,900,1300,1600,1900,2400])
        bb=await pg.evaluate("(()=>{const r=[...document.querySelectorAll('.nbrand')].find(x=>x.offsetParent).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        await pg.mouse.move(bb[0],bb[1]);await series(pg,"2) mouse hover",[150,700,1250,1600,2300])
        await pg.mouse.move(5,600);await pg.wait_for_timeout(300);await pg.evaluate("()=>go('video')");await series(pg,"3) page change",[150,800,1700,2300])
        m=await (await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)).new_page()
        await m.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await m.goto(PAGE);await m.evaluate("()=>{S.user={name:'G',method:'google'};S.view='home';renderAll()}");await m.wait_for_timeout(2600)
        bb=await m.evaluate("(()=>{const r=[...document.querySelectorAll('.nbrand')].find(x=>x.offsetParent).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        await m.touchscreen.tap(bb[0],bb[1]);await series(m,"4) phone tap",[150,800,1600,2300])
        await b.close()
asyncio.run(main())
