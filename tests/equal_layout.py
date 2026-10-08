import asyncio, json, sys
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
AUDIT=r"""()=>{const out={fields:[],toggles:[],cards:[],overflow:[]};const W=document.documentElement.clientWidth;
 const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('details:not([open]) > :not(summary)')};
 const nm=e=>(e.closest('.panel,.card,section,div')||e).querySelector('h3,b,label')?.textContent?.trim().slice(0,22)||'';
 // 1) text-like fields narrower than their siblings in the same form block
 document.querySelectorAll('#main .panel,#main .card,#main .admgrid>div,#main .grid2>div').forEach(box=>{const f=[...box.querySelectorAll(':scope input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),:scope textarea,:scope .selbtn')].filter(x=>vis(x)&&!x.closest('.row,.seg,.dealform,.pbox,.kcard,.drow'));if(f.length<2)return;const colOf=x=>{let q=x.parentElement;while(q&&q!==box){const g=getComputedStyle(q);if(g.display==='grid'&&g.gridTemplateColumns.split(' ').length>1)return q;q=q.parentElement}return null};
   const stacked=f.filter(x=>!colOf(x)&&x.getBoundingClientRect().width>4);const byBox=new Map();stacked.forEach(x=>{const k=x.closest('.ugcbox,.pbox,details,.panel,.card')||box;(byBox.get(k)||byBox.set(k,[]).get(k)).push(Math.round(x.getBoundingClientRect().width))});byBox.forEach(ws=>{if(ws.length>1){const mx=Math.max(...ws),mn=Math.min(...ws);if(mx-mn>8)out.fields.push(nm(box)+': '+ws.join('/'))}})
   /* side-by-side fields: every column in one grid row must be equally wide */
   const grids=new Set(f.map(colOf).filter(Boolean));grids.forEach(g=>{const rows={};[...g.children].filter(c=>vis(c)&&c.getBoundingClientRect().width>4).forEach(c=>{const r=c.getBoundingClientRect();(rows[Math.round(r.top/6)]=rows[Math.round(r.top/6)]||[]).push(Math.round(r.width))});Object.values(rows).forEach(w=>{if(w.length>1&&Math.max(...w)-Math.min(...w)>8&&getComputedStyle(g).gridTemplateColumns.split(' ').every((v,i,a)=>Math.abs(parseFloat(v)-parseFloat(a[0]))<2))out.fields.push(nm(box)+' (grid): '+w.join('/'))})})});
 // 2) switches that do not line up within the same list
 const groups=new Map();document.querySelectorAll('#main .switch').forEach(s=>{if(!vis(s))return;const row=s.closest('.prow,.row,.spread,.frow,label,li,div');const list=row&&row.parentElement;if(!list)return;(groups.get(list)||groups.set(list,[]).get(list)).push(Math.round(s.getBoundingClientRect().left))});
 groups.forEach((xs,list)=>{if(xs.length>1&&Math.max(...xs)-Math.min(...xs)>4)out.toggles.push((list.className||list.tagName)+': x='+xs.join('/'))});
 // 3) sibling cards in one grid row with different heights
 document.querySelectorAll('#main *').forEach(g=>{const cs=getComputedStyle(g);if(cs.display!=='grid'||g.children.length<2)return;const kids=[...g.children].filter(k=>vis(k)&&/panel|card|tile|plan|botcard|kcol|tpl/.test(k.className));if(kids.length<2)return;const rows={};kids.forEach(k=>{const r=k.getBoundingClientRect();(rows[Math.round(r.top/4)]=rows[Math.round(r.top/4)]||[]).push(Math.round(r.height))});Object.values(rows).forEach(h=>{if(h.length>1&&Math.max(...h)-Math.min(...h)>4)out.cards.push((g.className||'grid')+': h='+h.join('/'))})});
 // 4) anything wider than the screen (outside intentional scrollers)
 document.querySelectorAll('#main *').forEach(e=>{if(!vis(e))return;if(e.closest('.tlwrap,.edtools72>.tabs,.cmpwrap,.kanban,.tasks,.mrail,.tplcats,.botstrip,.crewline,.hbar,.strip,.board,.pnl,table,.seglist'))return;const r=e.getBoundingClientRect();if(r.right>W+2&&r.width<W*3)out.overflow.push((e.className&&typeof e.className==='string'?e.className.split(' ')[0]:e.tagName)+' +'+Math.round(r.right-W)+'px')});
 for(const k in out)out[k]=[...new Set(out[k])].slice(0,6);return out}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();rep={};tot={"fields":0,"toggles":0,"cards":0,"overflow":0}
        for dev,vp,mob in [("phone360",{"width":360,"height":780},True),("phone",{"width":390,"height":844},True),("tablet",{"width":820,"height":1180},True),("desktop",{"width":1440,"height":900},False)]:
            pg=await (await b.new_context(viewport=vp,is_mobile=mob,has_touch=mob)).new_page()
            await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
            await pg.goto(PAGE);await pg.wait_for_timeout(300)
            views=await pg.evaluate("Object.keys(VIEWS)");tabs=await pg.evaluate("ATABS.map(t=>t[0])")
            pages=[(v,None) for v in views]+[("admin",t) for t in tabs]
            for v,t in pages:
                r=await pg.evaluate("([v,t])=>{S.user={name:'G',method:'google'};S.lang='en';S.myPlan='studio';S.view=v;if(t)S.admTab=t;renderAll();return 1}",[v,t])
                await pg.wait_for_timeout(30)
                a=await pg.evaluate(AUDIT)
                key=f"{dev}:{v}{'/'+t if t else ''}"
                for k in tot:
                    if a[k]: tot[k]+=len(a[k]);rep.setdefault(key,{})[k]=a[k]
        print(json.dumps({"totals":tot,"pages":len(rep),"detail":rep},indent=1,ensure_ascii=False));await b.close()
asyncio.run(main())
