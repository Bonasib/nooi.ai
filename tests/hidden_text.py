import asyncio, json, sys
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
JS = r"""(v)=>{S.user={name:'G',method:'google'};S.myPlan='studio';S.view=v;renderAll();const out=[];
 const clipAnc=e=>{let p=e.parentElement;while(p&&p!==document.body){const c=getComputedStyle(p);if(['auto','scroll'].includes(c.overflowX)||['auto','scroll'].includes(c.overflowY))return null;if(c.overflow!=='visible'||c.overflowX!=='visible'||c.overflowY!=='visible')return p;p=p.parentElement}return null};
 document.querySelectorAll('#main *').forEach(e=>{if(e.closest('svg,canvas,textarea,input,select,[aria-hidden=true],.thumb,.kfslot,.board'))return;const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!own)return;const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return;const d=e.closest('details');if(d&&!d.open&&!e.closest('summary'))return;const cs=getComputedStyle(e);const t=(e.textContent||'').trim().slice(0,34);
   if(cs.textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth+1)out.push('…  '+t);
   else if(cs.webkitLineClamp&&cs.webkitLineClamp!=='none'&&e.scrollHeight>e.clientHeight+2)out.push('⋯  '+t);
   const a=clipAnc(e);if(a){const q=a.getBoundingClientRect();const vis=Math.max(0,Math.min(r.right,q.right)-Math.max(r.left,q.left))*Math.max(0,Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top));if(vis<r.width*r.height*.9)out.push('✂  '+t)}});
 return [...new Set(out)].slice(0,10)}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();res={};tot=0
        for dev,vp,mob in [("mobile-375",{"width":375,"height":812},True),("tablet-768",{"width":768,"height":1024},True),("tablet-1024",{"width":1024,"height":1366},True),("desktop-1280",{"width":1280,"height":800},False),("desktop-1440",{"width":1440,"height":900},False)]:
            pg=await (await b.new_context(viewport=vp,is_mobile=mob,has_touch=mob)).new_page()
            await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
            await pg.goto(PAGE);await pg.wait_for_timeout(400)
            views=await pg.evaluate("Object.keys(VIEWS)")
            for lang in ["en","ar"]:
                await pg.evaluate(f"()=>{{S.lang='{lang}'}}")
                for v in views:
                    h=await pg.evaluate(JS,v)
                    if h: res[f"{dev}:{lang}:{v}"]=h;tot+=len(h)
        print(json.dumps({"hiddenTextItems":tot,"pages":len(res),"detail":res},ensure_ascii=False,indent=1));await b.close()
asyncio.run(main())
