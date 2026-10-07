import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2,color_scheme="dark");pg=await ctx.new_page();errs=[]
        pg.on("pageerror",lambda e: errs.append(str(e)[:200]))
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(500)
        r={}
        cov=[]
        for v in ["home","video","image","edit","voice","account","crew","explore","library"]:
            c=await pg.evaluate(f"()=>{{S.user={{name:'G',method:'google'}};S.lang='ar';S.myPlan='studio';S.view='{v}';renderAll();return new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(()=>{{const all=[...document.querySelectorAll('#main svg,#bottomnav svg')].filter(s=>!s.classList.contains('bot')&&!s.closest('.nlogo,.thtoggle'));res([all.length,all.filter(s=>s.dataset.mo).length])}})))}}")
            cov.append(f"{v}:{c[1]}/{c[0]}")
        r["iconsWithMotion"]=cov
        await pg.evaluate("()=>{S.view='home';S.homeAdv=true;renderAll()}");await pg.wait_for_timeout(200)
        await pg.dispatch_event('#bottomnav [data-go="tools"], #bottomnav button:nth-child(2)','pointerdown')
        r["tapPlays"]=await pg.evaluate("[...document.querySelectorAll('#bottomnav svg.ic-play')].length>0")
        r["activeDuotone"]=await pg.evaluate("(()=>{const p=document.querySelector('#bottomnav [aria-current=\"page\"] svg[data-mo] path');return p?getComputedStyle(p).fillOpacity:'none'})()")
        # templates
        await pg.evaluate("()=>{S.view='explore';renderAll()}");await pg.wait_for_timeout(500)
        r["templates"]=await pg.evaluate("({h1:document.querySelector('#main h1').textContent,chips:document.querySelectorAll('.tplcats .tplcat').length,meta:document.querySelectorAll('.tmeta span').length,dotInTitle:[...document.querySelectorAll('.card.tpl .ti')].some(t=>t.textContent.includes(' · '))})")
        await pg.screenshot(path="/tmp/tplnew.png")
        # names
        r["ugcTitle"]=await pg.evaluate("()=>{go('ugcads');return document.querySelector('#main h1').textContent}")
        # bots under the prompt come alive with work
        await pg.evaluate("()=>{S.view='home';S.homeAdv=true;S.uni={task:'video',model:'auto',prompt:'صقر فوق الصحراء'};renderAll()}");await pg.wait_for_timeout(300)
        r["underPrompt"]=await pg.evaluate("({models:document.querySelectorAll('.uni .underprompt .mchip').length,bots:document.querySelectorAll('.uni .botstrip .sbot').length,modelsRightAfterTextarea:!!document.querySelector('.uni textarea + .underprompt, .uni .micwrap + .underprompt')})")
        await pg.evaluate("()=>{const j=addJob({kind:'video',prompt:'x',model:'kling',dur:5,cost:20,secs:60});j.status='rendering'}");await pg.wait_for_timeout(900)
        r["liveBots"]=await pg.evaluate("[...document.querySelectorAll('.uni .sbot.on')].map(s=>s.dataset.bot)")
        r["liveModelChip"]=await pg.evaluate("[...document.querySelectorAll('.mchip.live')].map(c=>c.dataset.m)")
        await pg.evaluate("document.querySelector('.uni').scrollIntoView({block:'start'});window.scrollBy(0,-70)");await pg.wait_for_timeout(300);await pg.screenshot(path="/tmp/under.png")
        r["videoStrip"]=await pg.evaluate("()=>{S.view='video';renderAll();return document.querySelectorAll('#main .botstrip .sbot').length}")
        r["imageStrip"]=await pg.evaluate("()=>{S.view='image';renderAll();return document.querySelectorAll('#main .botstrip .sbot').length}")
        print(json.dumps(r,ensure_ascii=False,indent=1),errs);await b.close()
asyncio.run(main())
