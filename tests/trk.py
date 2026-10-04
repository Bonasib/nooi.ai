import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True);pg=await ctx.new_page();errs=[]
        pg.on("pageerror",lambda e: errs.append(str(e)[:200]))
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(400)
        r=await pg.evaluate("""async()=>{S.user={name:'G',method:'google'};S.lang='ar';
          const orig=drawScene;window.truth=t=>({x:.2+.1*t,y:.5+.18*Math.sin(t*1.3)});
          drawScene=function(ctx,w,h,seed,pal,t){if(seed!==999)return orig.apply(this,arguments);ctx.fillStyle='#223';ctx.fillRect(0,0,w,h);for(let i=0;i<60;i++){ctx.fillStyle=i%2?'#2c3550':'#1a2238';ctx.fillRect((i*97%w),(i*53%h),w/9,h/12)}const p=truth(t);const r=h*.07;const g=ctx.createRadialGradient(p.x*w-r/3,p.y*h-r/3,1,p.x*w,p.y*h,r);g.addColorStop(0,'#fff');g.addColorStop(1,'#e33');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x*w,p.y*h,r,0,7);ctx.fill();ctx.fillStyle='#111';ctx.fillRect(p.x*w-r*.3,p.y*h-r*.15,r*.6,r*.3)};
          S.ed.clips=[{id:'tb',src:{k:'demo',kind:'scene'},in:0,out:5,speed:1,trans:'cut',vol:100}];S.ed.texts=[];S.view='edit';S.ed.tab='track';ED.t=0;renderAll();
          const m=clipMedia(S.ed.clips[0]);m.seed=999;m.dur=10;
          const F=fmt();const ar=F[3]/F[2];const band=(720/1280)/(F[3]/F[2]);const outY=y=>.5+(y-.5)*band;const t0=truth(0);S.ed.trackBox={x:t0.x,y:outY(t0.y),w:.16,h:.16*band*1280/720*.56};S.ed.trackWhat='text';
          const st=performance.now();await runTrack();const took=performance.now()-st;
          const pts=S.ed.lastTrack.pts;let err=0,maxe=0;pts.forEach(p=>{const tt=truth(p.t);const e=Math.hypot(p.x-tt.x,(p.y-outY(tt.y))*ar);err+=e;maxe=Math.max(maxe,e)});
          const tx=S.ed.texts.find(t=>t.track);
          return {points:pts.length,span:[pts[0].t,pts[pts.length-1].t],meanErrPctOfWidth:+(err/pts.length*100).toFixed(2),maxErrPctOfWidth:+(maxe*100).toFixed(2),ms:Math.round(took),layer:!!tx,layerEnd:tx&&tx.end}}""")
        await pg.evaluate("()=>{ED.t=2.5;}");await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#wk').scrollIntoView({block:'center'})");await pg.wait_for_timeout(200);await pg.screenshot(path="/tmp/trk.png")
        print(json.dumps(r,indent=1),errs);await b.close()
asyncio.run(main())
