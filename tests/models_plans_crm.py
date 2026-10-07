import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
HERE=pathlib.Path(__file__).resolve().parent
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2,color_scheme="dark");pg=await ctx.new_page();errs=[]
        pg.on("pageerror",lambda e: errs.append(str(e)[:200]))
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(500)
        r={}
        await pg.evaluate("()=>{S.user={name:'G',method:'google'};S.lang='ar';S.theme='dark';applyTheme();S.myPlan='studio';S.view='crew';S.crew.run=null;renderAll()}");await pg.wait_for_timeout(400)
        r["agents"]=await pg.evaluate("BOTS.map(b=>b.name[0]+' · '+b.role[0])")
        r["arabicUIShowsEnglishNames"]=await pg.evaluate("[...document.querySelectorAll('.botcard b')].map(x=>x.textContent)")
        r["accessories"]=await pg.evaluate("[...document.querySelectorAll('.crewline svg.fbot')].map(s=>s.getAttribute('class').match(/fb-[a-z]+/)[0])")
        await pg.evaluate("window.scrollTo(0,0)");await pg.screenshot(path="/tmp/agents.png")
        # flagship models
        await pg.evaluate("()=>{S.view='home';S.homeAdv=true;S.uni.task='content';S.uni.model='kling40';S.uni.prompt='';renderAll()}");await pg.wait_for_timeout(300)
        r["rail"]=await pg.evaluate("[...document.querySelectorAll('.uni .mcard b')].slice(0,8).map(b=>b.textContent)")
        r["newBadges"]=await pg.evaluate("document.querySelectorAll('.uni .mnew').length")
        r["features"]=await pg.evaluate("[...document.querySelectorAll('.uni .mfeat .fchip')].map(x=>x.textContent)")
        await pg.evaluate("document.querySelector('.uni .mrail').scrollIntoView({block:'center'})");await pg.wait_for_timeout(300);await pg.screenshot(path="/tmp/flag.png")
        # plans
        await pg.evaluate("()=>{S.view='account';S.myPlan='free';renderAll()}");await pg.wait_for_timeout(300)
        r["planThemes"]=await pg.evaluate("[...document.querySelectorAll('.plans3 .plan2')].map(c=>c.className.match(/pt-\\w+/)[0]+': '+[...c.querySelectorAll('.pchip')].map(x=>x.textContent).join(' | '))")
        await pg.evaluate("(()=>{const e=document.querySelector('.plans3');window.scrollTo(0,e.getBoundingClientRect().top+window.scrollY-70)})()");await pg.wait_for_timeout(300);await pg.screenshot(path="/tmp/plans2.png")
        # entitlement on the free plan for a flagship
        await pg.evaluate("()=>{S.view='home';S.homeAdv=true;S.uni.task='content';renderAll()}");await pg.click('.uni .mcard[data-m="kling40"]');await pg.wait_for_timeout(200)
        r["freeKling40"]=await pg.evaluate("!!document.querySelector('#modalRoot .upbox')")
        await pg.evaluate("()=>{$('#modalRoot').innerHTML='';S.myPlan='studio'}")
        # CRM & ERP
        await pg.evaluate("()=>{S.view='admin';S.admTab='crm';renderAll()}");await pg.wait_for_timeout(300)
        r["crm"]=await pg.evaluate("({tabActive:document.querySelector('.admtabs [data-v=\"crm\"]').getAttribute('aria-pressed'),columns:document.querySelectorAll('.kanban .kcol').length,cards:document.querySelectorAll('.kanban .kcard').length,deals:document.querySelectorAll('.dlist .drow').length,tasks:document.querySelectorAll('.tlist .trow').length})")
        await pg.fill('#dcomp','Jeddah Film Lab');await pg.fill('#dval','15000');await pg.click('[data-act="deal-add"]');await pg.wait_for_timeout(200)
        r["dealAdded"]=await pg.evaluate("A().crm.deals[0].company")
        await pg.evaluate("window.scrollTo(0,0)");await pg.screenshot(path="/tmp/crm.png")
        await pg.evaluate("()=>{S.admTab='erp';renderAll()}");await pg.wait_for_timeout(300)
        r["erp"]=await pg.evaluate("({kpis:[...document.querySelectorAll('.stats .stat')].length,pnlRows:document.querySelectorAll('table.pnl tbody tr').length,expenses:document.querySelectorAll('.dlist .drow').length})")
        await pg.fill('#xv','Seedance API');await pg.fill('#xa','640');await pg.click('[data-act="exp-add"]');await pg.wait_for_timeout(200)
        r["expenseAdded"]=await pg.evaluate("A().erp.expenses.slice(-1)[0].vendor")
        await pg.evaluate("window.scrollTo(0,0)");await pg.screenshot(path="/tmp/erp.png")
        print(json.dumps(r,ensure_ascii=False,indent=1),errs);await b.close()
asyncio.run(main())
