import asyncio, json, base64
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
        # admin link in the footer (signed out → admin login screen)
        await pg.evaluate("()=>{S.user=null;AU.showAuth=false;S.lang='ar';renderAll()}");await pg.wait_for_timeout(200)
        r["landingAdminLink"]=await pg.evaluate("!!document.querySelector('.lpfoot [data-act=\"admin-login\"]')")
        await pg.evaluate("document.querySelector('.lpfoot [data-act=\"admin-login\"]').click()");await pg.wait_for_timeout(200)
        r["adminLoginScreen"]=await pg.evaluate("(document.querySelector('h1')||{}).textContent")
        await pg.evaluate("()=>{S.user={name:'G',method:'google'};renderAll()}");await pg.wait_for_timeout(200)
        r["afterLoginView"]=await pg.evaluate("S.view")
        r["appAdminLink"]=await pg.evaluate("!!document.querySelector('.appfoot [data-act=\"admin-login\"]')")
        # draw a scene — since v91 "Draw a scene" opens the one Sketch page: the drawing, what it is, how many versions, one AI button
        await pg.evaluate("()=>{S.myPlan='studio';SK.strokes=[];go('draw');renderAll()}");await pg.wait_for_timeout(500)
        r["drawOpensSketch"]=await pg.evaluate("()=>S.view==='sketch'&&!!document.getElementById('skcv')&&document.querySelectorAll('[data-act=sk91-go]').length===1&&!document.getElementById('drwcv')")
        await pg.locator('#skcv').scroll_into_view_if_needed();box=await pg.locator('#skcv').bounding_box()
        for k in range(3):
            x0,y0=box["x"]+40+k*60,box["y"]+60
            await pg.dispatch_event('#skcv','pointerdown',{"clientX":x0,"clientY":y0,"pointerId":1,"pointerType":"touch","isPrimary":True,"bubbles":True})
            for s in range(8): await pg.dispatch_event('#skcv','pointermove',{"clientX":x0+s*8,"clientY":y0+s*10,"pointerId":1,"pointerType":"touch","isPrimary":True,"bubbles":True})
            await pg.dispatch_event('#skcv','pointerup',{"clientX":x0+64,"clientY":y0+80,"pointerId":1,"pointerType":"touch","isPrimary":True,"bubbles":True})
        r["inked"]=await pg.evaluate("SK.strokes.length")
        await pg.fill("#skwhat91","قلعة على تلة وقت الغروب");await pg.click("[data-act=sk91-n][data-v='4']")
        n0=await pg.evaluate("S.jobs.length");await pg.click("[data-act=sk91-go]");await pg.wait_for_timeout(1500)
        r["sketchJobs"]=await pg.evaluate(f"S.jobs.slice({n0}).filter(j=>j.meta&&j.meta.sk91).map(j=>j.kind+':'+j.meta.style+':'+j.meta.variant)")
        r["sketchPrompt"]=await pg.evaluate(f"(S.jobs.slice({n0}).find(j=>j.meta&&j.meta.sk91)||{{}}).prompt||''")
        await pg.evaluate("window.scrollTo(0,0)");await pg.screenshot(path="/tmp/draw.png")
        # 3D world — every old 3D page (3D worlds, 3D Studio, Physics) opens the one 3D World (tests/v86.py builds, walks and
        # exports worlds with a server — this file:// run only checks the door)
        await pg.evaluate("()=>go('w3ai')");await pg.wait_for_timeout(500)
        r["worldRender"]=await pg.evaluate("()=>({view:S.view,stage:!!document.getElementById('nwstage'),old:ALLNAV.filter(x=>['w3ai','studio3d','physics','w3d','l3d'].includes(x[0])).length,world:ALLNAV.filter(x=>x[0]==='world').length})")
        r["movedViewChanged"]=r["worldRender"]["view"]=="world" and r["worldRender"]["stage"] and r["worldRender"]["old"]==0 and r["worldRender"]["world"]==1
        print(json.dumps(r,ensure_ascii=False,indent=1),errs);await b.close()
asyncio.run(main())
