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
        # draw a scene
        await pg.evaluate("()=>{S.myPlan='studio';S.view='draw';S.drw.mode='draw';S.drw.n=2;renderAll()}");await pg.wait_for_timeout(400)
        box=await (await pg.query_selector('#drwcv')).bounding_box()
        for k in range(3):
            await pg.dispatch_event('#drwcv','pointerdown',{"clientX":box["x"]+40+k*60,"clientY":box["y"]+60,"pointerId":1,"bubbles":True})
            for s in range(8): await pg.evaluate(f"document.dispatchEvent(new PointerEvent('pointermove',{{clientX:{box['x']+40+k*60+s*8},clientY:{box['y']+60+s*10},bubbles:true}}))")
            await pg.evaluate("document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))")
        r["inked"]=await pg.evaluate("!drwEmpty()")
        await pg.evaluate("()=>{S.drw.scene='قلعة على تلة وقت الغروب';S.drw.style='anime'}")
        n0=await pg.evaluate("S.jobs.length");await pg.evaluate("drwGenerate()");await pg.wait_for_timeout(400)
        r["sketchJobs"]=await pg.evaluate(f"S.jobs.slice({n0}).map(j=>j.kind+':'+j.meta.style+':'+j.meta.variant)")
        r["sketchAsReference"]=await pg.evaluate("!!(M.iRef&&M.iRef.name==='sketch.png')")
        await pg.evaluate("window.scrollTo(0,0)");await pg.screenshot(path="/tmp/draw.png")
        # upload & instruct
        await pg.evaluate("()=>{S.drw.mode='upload';renderAll()}");await pg.wait_for_timeout(200)
        await (await pg.query_selector('input[data-drwup]')).set_input_files(str(HERE/'noisy.wav').replace('noisy.wav','sample.png'));await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{S.drw.instr='اجعلها ليلاً مع أضواء المدينة';S.drw.preset='time';drwEdit()}");await pg.wait_for_timeout(300)
        r["editJobs"]=await pg.evaluate("S.jobs.filter(j=>j.meta&&j.meta.instruct).map(j=>j.kind+':'+j.meta.preset).slice(-2)")
        # 3D world — the old "3D worlds" page now opens the one 3D Studio (its 3D runs in a frame served by nooi; tests/studio3d.py
        # covers building, walking and .glb export there — this file:// run only checks the hand-over)
        await pg.evaluate("()=>{S.view='world';renderAll()}");await pg.wait_for_timeout(500)
        r["worldRender"]=await pg.evaluate("()=>({view:S.view,frame:!!document.querySelector('iframe.x3frame'),menu:ALLNAV.filter(x=>['world','w3d','l3d'].includes(x[0])).length})")
        r["movedViewChanged"]=r["worldRender"]["view"]=="studio3d" and r["worldRender"]["frame"] and r["worldRender"]["menu"]==0
        print(json.dumps(r,ensure_ascii=False,indent=1),errs);await b.close()
asyncio.run(main())
