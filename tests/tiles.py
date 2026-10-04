import asyncio, json, sys
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await (await b.new_context(viewport={"width":390,"height":844},is_mobile=True,device_scale_factor=1)).new_page()
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(400)
        views=await pg.evaluate("Object.keys(VIEWS)");out={};total=0;samples=[]
        for lang in ["ar","en"]:
          for v in views:
            bad=await pg.evaluate("""([v,l])=>{S.user={name:'G',method:'google'};S.lang=l;S.view=v;S.myPlan='studio';renderAll();const res=[];document.querySelectorAll('#main .tile').forEach(t=>{const r=t.getBoundingClientRect();if(!r.width)return;const gl=t.querySelector('.gl');let bad=false,why='';
              t.querySelectorAll('.gl *,.lb').forEach(c=>{const q=c.getBoundingClientRect();if(q.width&&(q.left<r.left-1||q.right>r.right+1||q.top<r.top-1||q.bottom>r.bottom+1)){bad=true;why='outside tile'}});
              if(gl){const g=gl.getBoundingClientRect();gl.querySelectorAll(':scope > *').forEach(c=>{const q=c.getBoundingClientRect();if(q.width>g.width+2||q.height>g.height+2){bad=true;why='bigger than glyph box'}})}
              if(bad)res.push(v+': '+(t.textContent||'').trim().slice(0,24)+' ('+why+')')});return res}""",[v,lang])
            if bad: out[v+':'+lang]=len(bad);total+=len(bad);samples+=bad[:2]
        print(json.dumps({"brokenTiles":total,"byView":out,"samples":samples[:14]},ensure_ascii=False,indent=1));await b.close()
asyncio.run(main())
