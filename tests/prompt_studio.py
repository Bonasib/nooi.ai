import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2,color_scheme="light");pg=await ctx.new_page();errs=[]
        pg.on("pageerror",lambda e: errs.append(str(e)[:200]))
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(500)
        r={}
        await pg.evaluate("()=>{S.user={name:'G',method:'google'};S.lang='ar';S.theme='light';applyTheme();S.myPlan='studio';S.view='home';S.uni.task='content';S.uni.prompt='';renderAll()}");await pg.wait_for_timeout(400)
        r["tasks"]=await pg.evaluate("document.querySelectorAll('.uni .task').length")
        r["videoModels"]=await pg.evaluate("[...document.querySelectorAll('.uni .mcard b')].map(b=>b.textContent)")
        r["placeholderLines"]=await pg.evaluate("document.querySelector('#uniq').placeholder.split('\\n')")
        r["controls"]=await pg.evaluate("[document.querySelectorAll('[data-act=uni-dur]').length,document.querySelectorAll('[data-act=uni-fps]').length]")
        await pg.evaluate("document.querySelector('.uni').scrollIntoView({block:'start'});window.scrollBy(0,-66)");await pg.wait_for_timeout(300);await pg.screenshot(path="/tmp/uni1.png")
        # structured run
        await pg.evaluate("""()=>{S.uni.prompt='الفكرة: صقر يحلّق فوق كثبان الرياض\\nالمشهد: لقطة واسعة ثم قريبة على عينيه\\nالصوت: «الحرية تبدأ من السماء»\\nالمؤثرات: رياح خفيفة وعود\\nالأسلوب: سينمائي دافئ\\nالمدة: 8 ثوانٍ';S.uni.model='kling';S.uni.fps=60;S.uni.aspect='9:16';renderAll()}""")
        await pg.click('[data-act="uni-run"]');await pg.wait_for_timeout(400)
        r["videoJob"]=await pg.evaluate("(()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return {view:S.view,model:j.model,dur:j.dur,fps:j.meta&&j.meta.fps,aspect:j.aspect,vo:S.draft.vo,style:S.draft.style,prompt:j.prompt.slice(0,90)}})()")
        await pg.evaluate("()=>{S.view='home';S.uni.task='image';S.uni.prompt='الموضوع: شعار لمقهى عربي\\nالنص: «قهوة»\\nالأسلوب: ذهبي على أسود';S.uni.imodel='flux';S.uni.n=2;S.uni.aspect='1:1';renderAll()}");await pg.wait_for_timeout(200)
        r["imageModels"]=await pg.evaluate("[...document.querySelectorAll('.uni .mcard b')].map(b=>b.textContent)")
        n0=await pg.evaluate("S.jobs.filter(x=>x.kind==='image').length");await pg.click('[data-act="uni-run"]');await pg.wait_for_timeout(400)
        r["imageJobs"]=await pg.evaluate(f"S.jobs.filter(x=>x.kind==='image').length-{n0}")
        await pg.evaluate("()=>{S.view='home';S.uni.task='productad';S.uni.prompt='المنتج: عطر الورد\\nالفكرة: امرأة تجرّبه في مجلس فاخر\\nالعرض: 99 ريال';renderAll()}");await pg.click('[data-act="uni-run"]');await pg.wait_for_timeout(400)
        r["productAd"]=await pg.evaluate("(()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return {type:S.draft.type,name:S.draft.ugc.name,ugc:!!(j.meta&&j.meta.ugc)}})()")
        # bots v2
        await pg.evaluate("()=>{S.view='crew';renderAll()}");await pg.wait_for_timeout(300)
        r["bots"]=await pg.evaluate("[document.querySelectorAll('.crewline svg.fbot').length,new Set([...document.querySelectorAll('.crewline svg.fbot')].map(s=>s.getAttribute('class').match(/fb-[a-z]+/)[0])).size,getComputedStyle(document.querySelector('.crewline svg.fbot .e-open')).opacity]")
        await pg.evaluate("()=>{S.crew.run={id:'x',t:Date.now(),brief:S.crew.brief,stages:Object.fromEntries(BOTS.map((b,i)=>[b.id,{status:i<3?'done':i===3?'working':'waiting',attempts:1,errors:[]}])),out:{},log:[],loops:0,status:'running',active:'cine'};renderAll()}");await pg.wait_for_timeout(1500)
        await pg.evaluate("window.scrollTo(0,0)");await pg.screenshot(path="/tmp/bots2.png")
        # board toolbar & templates
        await pg.evaluate("()=>{S.view='board';renderAll()}");await pg.wait_for_timeout(300)
        r["boardBar"]=await pg.evaluate("[!!document.querySelector('.boardbar .btools2'),!!document.querySelector('.board .btools')]")
        await pg.evaluate("()=>{S.view='explore';renderAll()}");await pg.wait_for_timeout(500)
        r["tplHeights"]=await pg.evaluate("[...new Set([...document.querySelectorAll('.card.tpl')].slice(0,6).map(c=>Math.round(c.getBoundingClientRect().height)))]")
        r["tplThumbTops"]=await pg.evaluate("(()=>{const c=[...document.querySelectorAll('.card.tpl')].slice(0,4);return c.map(x=>Math.round(x.querySelector('.thumb').getBoundingClientRect().height))})()")
        await pg.screenshot(path="/tmp/tpl3.png")
        print(json.dumps(r,ensure_ascii=False,indent=1),errs);await b.close()
asyncio.run(main())
