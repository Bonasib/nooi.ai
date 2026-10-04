import asyncio, json, sys
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
RENDER=r"""([v,tab])=>{S.user={name:'G',method:'google'};S.myPlan='studio';S.view=v;if(tab)S.admTab=tab;renderAll();return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(1))))}"""
JS=r"""([v,tab])=>{if(window.__defect&&v==='admin'&&tab==='payments'){const st=document.createElement('style');st.textContent='#main .provc input[type=password]{width:55%!important}#main .trow:nth-child(3) .switch{margin-right:40px}#main .intgrid>.panel:first-child{align-self:start}';document.head.appendChild(st)}
 const vis=e=>{const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return null;const d=e.closest('details');if(d&&!d.open&&!e.closest('summary'))return null;let p=e;while(p&&p!==document.body){const c=getComputedStyle(p);if(c.display==='none'||c.visibility==='hidden')return null;p=p.parentElement}return r};
 const R={width:[],height:[],toggles:[],cards:[]};
 const TXT='input:not([type]),input[type=text],input[type=email],input[type=password],input[type=number],input[type=url],input[type=search],input[type=tel],input[type=date],textarea,.selbtn';
 // A) a control that stands alone in a block container should fill its width like its siblings
 document.querySelectorAll('#main '+TXT.split(',').join(',#main ')).forEach(e=>{const r=vis(e);if(!r)return;const par=e.parentElement,pc=getComputedStyle(par);if(!/block|grid/.test(pc.display)||e.closest('.row,.seg,.hbar,.tlwrap,.dealform,.pboxbar,.cmpwrap,td,.tl,.kcard,.drow')||(e.style&&e.style.maxWidth))return;
   const pr=par.getBoundingClientRect(),inner=pr.width-parseFloat(pc.paddingLeft)-parseFloat(pc.paddingRight);if(pc.display==='grid')return;if(r.width<inner-3)R.width.push((e.dataset.bind||e.dataset.fl||e.placeholder||e.type||e.className).slice(0,22)+' '+Math.round(r.width)+'/'+Math.round(inner))});
 // B) heights: text inputs & select buttons share one height (textareas excluded)
 const hs={};document.querySelectorAll('#main input:not([type]),#main input[type=text],#main input[type=email],#main input[type=password],#main input[type=number],#main input[type=url],#main input[type=date],#main .selbtn').forEach(e=>{const r=vis(e);if(!r||e.closest('.kcard,.cmpwrap,td,.tl,.edbar'))return;const h=Math.round(r.height);(hs[h]=hs[h]||[]).push((e.dataset.bind||e.dataset.fl||e.type||'').slice(0,16))});
 const keys=Object.keys(hs).map(Number);if(keys.length>1){const main=keys.sort((a,b)=>hs[b].length-hs[a].length)[0];keys.filter(k=>Math.abs(k-main)>2).forEach(k=>R.height.push(k+'px vs '+main+'px: '+hs[k].slice(0,3).join(',')))}
 // C) toggles in a list line up
 const groups=new Map();document.querySelectorAll('#main .switch,#main [role=switch]').forEach(s=>{const r=vis(s);if(!r)return;const row=s.parentElement,list=row&&row.parentElement;if(!list)return;(groups.get(list)||groups.set(list,[]).get(list)).push(Math.round(r.right))});
 groups.forEach(xs=>{if(xs.length>1&&Math.max(...xs)-Math.min(...xs)>3)R.toggles.push('right edges '+[...new Set(xs)].join('/'))});
 // D) cards side by side share a height
 document.querySelectorAll('#main *').forEach(g=>{const c=getComputedStyle(g);if(c.display!=='grid'||!vis(g))return;const kids=[...g.children].filter(k=>k.matches('.panel,.card')&&vis(k));if(kids.length<2)return;const rows={};kids.forEach(k=>{const r=k.getBoundingClientRect();(rows[Math.round(r.top)]=rows[Math.round(r.top)]||[]).push(Math.round(r.height))});Object.values(rows).forEach(hh=>{if(hh.length>1&&Math.max(...hh)-Math.min(...hh)>2)R.cards.push((g.className||'grid')+': '+hh.join('/'))})});
 R.options=[];document.querySelectorAll('#main .tiles,#main .admtabs').forEach(g=>{if(!vis(g))return;const kids=[...g.children].filter(k=>vis(k));if(kids.length<2)return;const rows={};kids.forEach(k=>{const r=k.getBoundingClientRect();(rows[Math.round(r.top/4)]=rows[Math.round(r.top/4)]||[]).push(r)});const rs=Object.values(rows);if(rs.length<2)return;const full=Math.max(...rs.map(x=>x.length));const ws=new Set(kids.map(k=>Math.round(k.getBoundingClientRect().width)));if(ws.size>1)R.options.push((g.className||'tiles')+': unequal option widths '+[...ws].join('/'));const last=rs[rs.length-1];if(last.length<full){const gl=g.getBoundingClientRect(),L=Math.min(...last.map(r=>r.left))-gl.left,Rr=gl.right-Math.max(...last.map(r=>r.right));if(Math.abs(L-Rr)>4)R.options.push((g.className||'tiles')+': short last row not centred ('+last.length+'/'+full+')')}});document.querySelectorAll('#main .seg').forEach(sg=>{if(!vis(sg)||sg.classList.contains('eqwrap')||sg.classList.contains('dmode'))return;const bs=[...sg.children].filter(b=>vis(b));if(bs.length<2)return;const ws=bs.map(b=>Math.round(b.getBoundingClientRect().width));if(Math.max(...ws)-Math.min(...ws)>2)R.options.push('seg: '+ws.join('/'))});
 R.cramped=[];document.querySelectorAll('#main *').forEach(g=>{const c=getComputedStyle(g);if(c.display!=='grid'||!vis(g)||g.matches('.tiles,.admtabs'))return;const cols=c.gridTemplateColumns.split(' ').filter(Boolean);if(cols.length<2)return;[...g.children].forEach(k=>{const r=vis(k);if(!r)return;if(r.width<200&&k.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),textarea,.selbtn'))R.cramped.push((g.className||g.tagName).slice(0,20)+(g.getAttribute('style')?' [inline]':'')+': field column '+Math.round(r.width)+'px')})});
 R.cramped=[];if(innerWidth<700)document.querySelectorAll('#main *').forEach(g=>{const c=getComputedStyle(g);if(c.display!=='grid'||!vis(g))return;const cols=c.gridTemplateColumns.split(' ').filter(Boolean);if(cols.length<2)return;[...g.children].forEach(k=>{const r=vis(k);if(!r)return;if(r.width<200&&k.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),textarea,.selbtn'))R.cramped.push((g.className||g.tagName)+': '+cols.length+' cols, field column '+Math.round(r.width)+'px')})});
 R.overflow=document.documentElement.scrollWidth>innerWidth+1?['page '+document.documentElement.scrollWidth+'>'+innerWidth]:[];
 return R}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();res={};tot={"width":0,"height":0,"toggles":0,"cards":0,"options":0,"cramped":0,"overflow":0}
        for dev,vp,mob in [("phone",{"width":390,"height":844},True),("tablet",{"width":820,"height":1180},True),("desktop",{"width":1440,"height":900},False)]:
            pg=await (await b.new_context(viewport=vp,is_mobile=mob,has_touch=mob)).new_page()
            await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
            await pg.goto(PAGE);await pg.wait_for_timeout(300)
            await pg.evaluate("()=>{S.lang='en';window.__defect=%s}"%("true" if "--defect" in sys.argv else "false"))
            views=[] if "--defect" in sys.argv else await pg.evaluate("Object.keys(VIEWS).filter(v=>v!=='admin')");tabs=["payments"] if "--defect" in sys.argv else await pg.evaluate("ATABS.map(t=>t[0])")
            for v,t in [(v,None) for v in views]+[("admin",t) for t in tabs]:
                await pg.evaluate(RENDER,[v,t]);await pg.wait_for_timeout(30);r=await pg.evaluate(JS,[v,t]);key=f"{dev}:{v}"+(f"/{t}" if t else "")
                for k in tot:
                    if r[k]: res.setdefault(key,{})[k]=r[k][:4];tot[k]+=len(r[k])
        print(json.dumps({"totals":tot,"detail":res},ensure_ascii=False,indent=1));await b.close()
asyncio.run(main())
