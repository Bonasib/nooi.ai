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
        await pg.evaluate("()=>{S.user={name:'G',method:'google'};S.lang='en';S.credits=5000;S.myPlan='basic';S.view='voice';renderAll()}");await pg.wait_for_timeout(300)
        await pg.click('[data-act="veng"][data-v="elevenlabs"]');await pg.wait_for_timeout(200)
        r["basicElevenLabs"]=await pg.evaluate("!!document.querySelector('#modalRoot .upbox')")
        await pg.evaluate("()=>{$('#modalRoot').innerHTML='';S.myPlan='pro';S.voiceEng.engine='elevenlabs';renderAll()}");await pg.wait_for_timeout(300)
        r["elModels"]=await pg.evaluate("[...document.querySelectorAll('[data-act=\"vel\"]')].map(b=>b.querySelector('b').textContent+(b.dataset.locked?' (locked)':''))")
        await pg.click('[data-act="vel"][data-v="el_v3"]');await pg.wait_for_timeout(200)
        r["proV3"]=await pg.evaluate("!!document.querySelector('#modalRoot .upbox')")
        await pg.evaluate("()=>{$('#modalRoot').innerHTML='';S.voiceEng.model='el_flash';S.voiceEng.format='wav';S.tools.voice.text='Welcome to nooi';document.querySelector('[data-act=\"voice-gen\"]').click()}");await pg.wait_for_timeout(300)
        r["elJob"]=await pg.evaluate("(()=>{const j=S.jobs.filter(x=>x.kind==='voice').pop();return {engine:j.meta.engine,model:j.meta.elModel,format:j.meta.format,cost:j.cost}})()")
        await pg.evaluate("document.querySelector('.vengine').scrollIntoView({block:'start'});window.scrollBy(0,-70)");await pg.wait_for_timeout(300);await pg.screenshot(path="/tmp/el.png")
        # image models + specs + status
        await pg.evaluate("()=>{S.voiceEng.engine='nooi';S.view='home';S.uni.task='image';S.uni.imodel='nano';renderAll()}");await pg.wait_for_timeout(300)
        r["imageRail"]=await pg.evaluate("[...document.querySelectorAll('.uni .mcard b')].map(b=>b.textContent)")
        r["specs"]=await pg.evaluate("(()=>{const d=document.querySelector('.uni details.specs');if(!d)return null;d.open=true;return [...d.querySelectorAll('.usage b')].map(x=>x.textContent).slice(0,3)})()")
        r["statusTags"]=await pg.evaluate("[...document.querySelectorAll('.uni .mcard .stag')].map(t=>t.textContent).slice(0,8)")
        await pg.click('.uni .mcard[data-m="mj"]');await pg.wait_for_timeout(200)
        r["proMidjourney"]=await pg.evaluate("!!document.querySelector('#modalRoot .upbox')")
        await pg.evaluate("()=>{$('#modalRoot').innerHTML=''}")
        # mobile model bottom sheet
        await pg.click('[data-act="m-sheet"]');await pg.wait_for_timeout(200)
        r["sheetRows"]=await pg.evaluate("document.querySelectorAll('#modalRoot .mrow').length")
        await pg.click('#modalRoot .mrow[data-m="qwen2"]');await pg.wait_for_timeout(200)
        r["pickedFromSheet"]=await pg.evaluate("[S.uni.imodel,!!document.querySelector('#modalRoot .msheet')]")
        # durations
        await pg.evaluate("()=>{S.uni.task='content';renderAll()}");await pg.wait_for_timeout(200)
        r["secondChips"]=await pg.evaluate("[...document.querySelectorAll('[data-act=\"uni-dur\"]')].map(b=>b.textContent+(b.classList.contains('lockd')?'🔒':''))")
        await pg.evaluate("()=>{S.myPlan='studio';S.view='video';S.draft.model='kling40';S.draft.dur=30;S.draft.prompt='falcon';renderAll();makeVideo()}");await pg.wait_for_timeout(300)
        r["longVideo"]=await pg.evaluate("(()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return {dur:j.dur,parts:j.meta.parts,partSec:j.meta.partSec}})()")
        r["sliderMax"]=await pg.evaluate("(document.querySelector('[data-bind=\"draft.dur\"]')||{}).max")
        # credits sheet
        await pg.evaluate("()=>{S.credits=3;S.draft.model='kling40';S.draft.dur=10;makeVideo()}");await pg.wait_for_timeout(200)
        r["creditsSheet"]=await pg.evaluate("(document.querySelector('#modalRoot h2')||{}).textContent")
        await pg.evaluate("()=>{$('#modalRoot').innerHTML='';S.credits=5000}")
        # admin connection tests (demo)
        await pg.evaluate("()=>{S.view='admin';S.admTab='models';renderAll()}");await pg.wait_for_timeout(200)
        await pg.click('[data-act="h-all"]');await pg.wait_for_timeout(2500)
        r["health"]=await pg.evaluate("[...document.querySelectorAll('.hrow')].map(x=>x.querySelector('b').textContent+': '+x.querySelector('.stag').textContent).slice(0,11)")
        # export format
        await pg.evaluate("()=>{S.view='edit';S.ed.tab='export';S.ed.clips=[{id:'d1',src:{k:'demo',kind:'scene'},in:0,out:3,speed:1,trans:'cut',vol:100}];renderAll()}");await pg.wait_for_timeout(300)
        r["exportFormats"]=await pg.evaluate("[...document.querySelectorAll('[data-set=\"ed.fmtOut\"]')].map(b=>b.textContent)")
        r["stickyPreview"]=await pg.evaluate("getComputedStyle(document.querySelector('.edstage')).position")
        print(json.dumps(r,ensure_ascii=False,indent=1),errs);await b.close()
asyncio.run(main())
