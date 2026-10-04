import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
HTML="/mnt/user-data/outputs/nooi-studio.html"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        res={}
        for name,vp,mob in [("phone",{"width":360,"height":780},True),("ipad",{"width":768,"height":1024},False),("ipadL",{"width":1180,"height":820},False),("desktop",{"width":1440,"height":900},False)]:
            ctx=await b.new_context(viewport=vp,is_mobile=mob,has_touch=True,device_scale_factor=2)
            pg=await ctx.new_page();errs=[]
            pg.on("pageerror",lambda e: errs.append(str(e)[:120]))
            await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
            await pg.goto(PAGE);await pg.wait_for_timeout(500)
            views=await pg.evaluate("Object.keys(VIEWS)")
            bad={}
            for v in views+["__landing","__auth"]:
                await pg.evaluate("""(v)=>{if(v==='__landing'){S.user=null;AU.showAuth=false}else if(v==='__auth'){S.user=null;AU.showAuth=true}else{S.user={name:'T',method:'google'};S.view=v}renderAll()}""",v)
                await pg.wait_for_timeout(250)
                m=await pg.evaluate("""()=>{const main=document.querySelector('#main');let worst=null,ww=0;document.querySelectorAll('#main *').forEach(el=>{const r=el.getBoundingClientRect();if(r.width>0&&r.right>innerWidth+2){const over=r.right-innerWidth;if(over>ww&&!el.closest('.tlwrap,.strip,.tabs,.lpticker,.board,.tl,.seglist,.ftiles,.cmpwrap,.pmx,.tplcats,.botstrip,.mrail,.tasks')){ww=over;worst=el.tagName+'.'+(el.className||'').toString().slice(0,40)}}});return {sw:main.scrollWidth,cw:main.clientWidth,doc:document.documentElement.scrollWidth,worst,ww:Math.round(ww)}}""")
                if m["sw"]>m["cw"]+1 or m["doc"]>vp["width"]+1 or m["ww"]>2: bad[v]=m
            res[name]={"overflow":bad,"errors":errs[:5]}
            await ctx.close()
        print(json.dumps(res,indent=1,ensure_ascii=False))
        await b.close()
asyncio.run(main())
