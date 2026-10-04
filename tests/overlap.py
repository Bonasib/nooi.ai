import asyncio, json, sys
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
JS = r"""(v)=>{S.user={name:'G',method:'google'};S.myPlan='studio';S.view=v;renderAll();
 const vis=e=>{let r=e.getBoundingClientRect();if(r.width<2||r.height<2)return null;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.opacity==='0')return null;let p=e.parentElement,L=r.left,T=r.top,R=r.right,B=r.bottom;while(p&&p!==document.body){const c=getComputedStyle(p);if(c.overflow!=='visible'||c.overflowX!=='visible'||c.overflowY!=='visible'){const q=p.getBoundingClientRect();L=Math.max(L,q.left);T=Math.max(T,q.top);R=Math.min(R,q.right);B=Math.min(B,q.bottom)}p=p.parentElement}if(R-L<2||B-T<2)return null;return{left:L,top:T,right:R,bottom:B,width:R-L,height:B-T}};
 const closedIn=e=>{const d=e.closest('details');return d&&!d.open&&!e.closest('summary')};const leaves=[...document.querySelectorAll('#main *')].filter(e=>{if(e.closest('svg,canvas,.tlwrap,.tl,.boardcanvas,.bcanvas,.frames,.botstrip,.crewline,.cchips,.tplcats,.hbar,.strip,.lpticker,[aria-hidden=true]')||closedIn(e))return false;const t=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).length;return t>0}).map(e=>{const rs=[...e.getClientRects()];return{e,r:vis(e)}}).filter(x=>x.r).slice(0,900);
 const hits=[];for(let i=0;i<leaves.length;i++){for(let j=i+1;j<leaves.length;j++){const a=leaves[i],b=leaves[j];if(a.e.contains(b.e)||b.e.contains(a.e))continue;const inl=x=>getComputedStyle(x).display.startsWith('inline');if(a.e.parentElement===b.e.parentElement&&inl(a.e)&&inl(b.e))continue;if(a.e.closest('.veil')||b.e.closest('.veil'))continue;const x=Math.max(0,Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)),y=Math.max(0,Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top));const ar=x*y,sm=Math.min(a.r.width*a.r.height,b.r.width*b.r.height);if(ar>sm*.25&&ar>30)hits.push((a.e.textContent||'').trim().slice(0,22)+' ⟷ '+(b.e.textContent||'').trim().slice(0,22))}}
 return [...new Set(hits)].slice(0,8)}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();out={}
        for dev,vp,mob in [("mobile-375",{"width":375,"height":812},True),("tablet-768",{"width":768,"height":1024},True),("tablet-1024",{"width":1024,"height":1366},True),("desktop-1280",{"width":1280,"height":800},False),("desktop-1440",{"width":1440,"height":900},False)]:
            pg=await (await b.new_context(viewport=vp,is_mobile=mob,has_touch=mob)).new_page()
            await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
            await pg.goto(PAGE);await pg.wait_for_timeout(400)
            views=await pg.evaluate("Object.keys(VIEWS)")
            for lang in ["ar","en"]:
                await pg.evaluate(f"()=>{{S.lang='{lang}'}}")
                for v in views:
                    h=await pg.evaluate(JS,v)
                    if h: out[f"{dev}:{lang}:{v}"]=h
        print(json.dumps({"pagesWithOverlap":len(out),"detail":out},ensure_ascii=False,indent=1));await b.close()
asyncio.run(main())
