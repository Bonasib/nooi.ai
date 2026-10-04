import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
SKIP={"wld-rec","wld-glb","wld-shot","crew-export","tx-csv","erp-csv","drw-go","dictate","vc-rec","vc-play","theme-toggle","cb-print","cb-png","adm-csv","uni-run","trk-run","cb-build","cb-hd","adm-rm","adm-send","adm-suspend","adm-feat","sup-new","dl-blender","dl-unity","sk-dl","copy","buy","signout","reset","ed-export","export-bg","export-grade","s3d-turntable","snap","export-json","subs-file","s3d-glb","view-landing","to-auth","an-close","close-sheet","media-clear","auth-guest","auth-oauth","del-ch","frame-del","del-char","post-del","ed-del","slot-clear","subs-clear","s3d-clear","llm-test","acct"}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True);pg=await ctx.new_page()
        errs=[]
        pg.on("pageerror",lambda e: errs.append((cur[0],str(e)[:160])))
        cur=["boot"]
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(500)
        views=await pg.evaluate("Object.keys(VIEWS)")
        clicks=0
        for v in views:
            await pg.evaluate("(v)=>{S.user={name:'T',method:'google'};S.view=v;document.querySelector('#modalRoot').innerHTML='';renderAll()}",v)
            await pg.wait_for_timeout(150)
            n=await pg.evaluate("document.querySelectorAll('#main [data-act],#main [data-set],#main [data-toggle],#main [data-arr],#main [data-focus]').length")
            for i in range(min(n,70)):
                info=await pg.evaluate("""([v,i,skip])=>{if(S.view!==v){S.view=v;renderAll()}document.querySelector('#modalRoot').innerHTML='';const els=[...document.querySelectorAll('#main [data-act],#main [data-set],#main [data-toggle],#main [data-arr],#main [data-focus]')];const el=els[i];if(!el)return null;const a=el.dataset.act||'';if(skip.includes(a)||el.disabled)return 'skip:'+a;el.click();return a||el.dataset.set||el.dataset.toggle||el.dataset.arr||'focus'}""",[v,i,list(SKIP)])
                cur[0]=v+":"+str(info);clicks+=1
                await pg.wait_for_timeout(40)
        await pg.wait_for_timeout(1500)
        print("clicks",clicks);print(json.dumps(errs[:15],ensure_ascii=False,indent=1))
        await b.close()
asyncio.run(main())
