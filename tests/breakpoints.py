import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
OV = r"""(v)=>{S.user={name:'G',method:'google'};S.myPlan='studio';S.view=v;renderAll();const m=document.querySelector('#main');const docW=document.documentElement.scrollWidth;const out={pageOverflow:docW>innerWidth+1||m.scrollWidth>m.clientWidth+1};
 const clipAnc=e=>{let p=e.parentElement;while(p&&p!==document.body){const c=getComputedStyle(p);if(['auto','scroll'].includes(c.overflowX)||['auto','scroll'].includes(c.overflowY))return null;if(c.overflow!=='visible'||c.overflowX!=='visible'||c.overflowY!=='visible')return p;p=p.parentElement}return null};
 let hidden=[];document.querySelectorAll('#main *').forEach(e=>{if(e.closest('svg,canvas,textarea,input,select,[aria-hidden=true],.thumb,.kfslot,.board'))return;if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return;const d=e.closest('details');if(d&&!d.open&&!e.closest('summary'))return;const cs=getComputedStyle(e);const t=(e.textContent||'').trim().slice(0,28);
  if((cs.textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth+1)||(cs.webkitLineClamp!=='none'&&e.scrollHeight>e.clientHeight+2))hidden.push(t);const a=clipAnc(e);if(a){const q=a.getBoundingClientRect();const vis=Math.max(0,Math.min(r.right,q.right)-Math.max(r.left,q.left))*Math.max(0,Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top));if(vis<r.width*r.height*.9)hidden.push('✂'+t)}});
 out.hidden=[...new Set(hidden)].slice(0,5);return out}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();res={}
        for w in [767,768,1079,1080,1279,1280]:
            mob=w<1080;pg=await (await b.new_context(viewport={"width":w,"height":900},is_mobile=mob,has_touch=mob)).new_page()
            await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
            await pg.goto(PAGE);await pg.wait_for_timeout(400)
            views=await pg.evaluate("Object.keys(VIEWS)");layout=await pg.evaluate("()=>{S.user={name:'G',method:'google'};S.view='home';renderAll();const side=document.getElementById('side');const bn=document.getElementById('bottomnav');return {sidebar:side?Math.round(side.getBoundingClientRect().width):0,bottomNav:!!bn&&getComputedStyle(bn).display!=='none'}}")
            bad={}
            for lang in ["en","ar"]:
                await pg.evaluate(f"()=>{{S.lang='{lang}'}}")
                for v in views:
                    o=await pg.evaluate(OV,v)
                    if o["pageOverflow"] or o["hidden"]: bad[f"{lang}:{v}"]=o
            res[w]={"layout":layout,"problems":bad}
        print(json.dumps(res,ensure_ascii=False,indent=1));await b.close()
asyncio.run(main())
