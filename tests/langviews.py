import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();res={}
        ctx=await b.new_context(viewport={"width":360,"height":780},is_mobile=True,has_touch=True);pg=await ctx.new_page();errs=[]
        pg.on("pageerror",lambda e: errs.append(str(e)[:150]))
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(400)
        views=await pg.evaluate("Object.keys(VIEWS)")
        for lang in ["ar","fa","de","th","ckb"]:
            bad={};dirs=set()
            for v in views:
                m=await pg.evaluate("""([v,l])=>{S.user={name:'G',method:'google'};S.lang=l;S.uiDialect='';S.view=v;renderAll();const main=document.querySelector('#main');return {sw:main.scrollWidth,cw:main.clientWidth,doc:document.documentElement.scrollWidth,dir:document.documentElement.dir}}""",[v,lang])
                dirs.add(m["dir"])
                if m["sw"]>m["cw"]+1 or m["doc"]>361: bad[v]=m
            res[lang]={"dir":sorted(dirs),"overflow":list(bad)}
        print(json.dumps(res,indent=1),errs[:5]);await b.close()
asyncio.run(main())
