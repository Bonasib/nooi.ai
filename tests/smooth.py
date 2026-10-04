import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2);pg=await ctx.new_page();errs=[]
        pg.on("pageerror",lambda e: errs.append(str(e)[:200]))
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(500)
        await pg.evaluate("""()=>{S.user={name:'G',method:'google'};S.lang='ar';S.view='edit';S.ed.clips=[{id:'d1',src:{k:'demo',kind:'scene',seed:5},in:0,out:4,speed:1,trans:'cut',vol:100},{id:'d2',src:{k:'demo',kind:'green'},in:0,out:8,speed:1,trans:'cut',vol:100}];S.ed.sel=null;ED.t=0;renderAll()}""")
        await pg.wait_for_timeout(400)
        res=await pg.evaluate("""()=>new Promise(res=>{ED.playing=true;ED.last=0;const s=[];const t0=performance.now();
          (function f(){const ph=document.querySelector('#ph'),w=document.querySelector('.tlwrap');s.push({t:ED.t,screen:ph.getBoundingClientRect().left,scroll:w.scrollLeft});
            if(performance.now()-t0<9000)requestAnimationFrame(f);else{ED.playing=false;let maxDt=0,maxScreen=0,maxScroll=0;for(let i=1;i<s.length;i++){maxDt=Math.max(maxDt,s[i].t-s[i-1].t);maxScreen=Math.max(maxScreen,Math.abs(s[i].screen-s[i-1].screen));maxScroll=Math.max(maxScroll,Math.abs(s[i].scroll-s[i-1].scroll))}
            res({frames:s.length,endT:+s[s.length-1].t.toFixed(2),maxTimeStep:+maxDt.toFixed(3),maxScreenJumpPx:+maxScreen.toFixed(1),maxScrollJumpPx:+maxScroll.toFixed(1),playheadOnScreenAtEnd:s[s.length-1].screen>0&&s[s.length-1].screen<390})}})()})""")
        # simulate a finger drag (scrolling) on the timeline — the playhead must not move
        before=await pg.evaluate("ED.t")
        await pg.evaluate("""()=>{const tl=document.querySelector('#tlin');const r=tl.getBoundingClientRect();const x=r.left+200,y=r.top+60;const ev=(type,dx,dy)=>tl.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',clientX:x+dx,clientY:y+dy,isPrimary:true}));
          ev('pointerdown',0,0);for(let k=1;k<10;k++)ev('pointermove',0,k*12);ev('pointerup',0,108);tl.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y+108}))}""")
        await pg.wait_for_timeout(200)
        after_drag=await pg.evaluate("ED.t")
        # a quick tap should still seek
        await pg.evaluate("""()=>{const tl=document.querySelector('#tlin');const r=tl.getBoundingClientRect();const x=r.left+120,y=r.top+60;tl.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:x,clientY:y}));tl.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',clientX:x,clientY:y}));tl.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y}))}""")
        await pg.wait_for_timeout(200)
        after_tap=await pg.evaluate("ED.t")
        print(json.dumps({"playback":res,"dragMovedPlayhead":abs(after_drag-before)>0.001,"tapSeeks":abs(after_tap-after_drag)>0.001},indent=1),errs);await b.close()
asyncio.run(main())
