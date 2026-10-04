import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await (await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)).new_page()
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(400)
        views=await pg.evaluate("Object.keys(VIEWS)");rep={"titleMismatch":[],"clipped":{},"smallTargets":{},"noLabel":{}}
        for v in views:
            r=await pg.evaluate("""(v)=>{S.user={name:'G',method:'google'};S.lang='ar';S.myPlan='studio';S.view=v;renderAll();const out={};
              const nav=ALLNAV.find(x=>x[0]===v);const h1=(document.querySelector('#main h1')||{}).textContent||'';out.title=nav?[L(nav[2],nav[3]),h1.trim()]:null;
              out.clipped=[...document.querySelectorAll('#main button,#main .lb,#main .badge,#main .ti,#main .su,#main h2,#main h3,#main .lbl')].filter(e=>{const cs=getComputedStyle(e);return e.offsetParent&&e.scrollWidth>e.clientWidth+2&&cs.textOverflow!=='ellipsis'&&cs.overflowX!=='visible'&&!e.closest('.tlwrap,.strip,.seglist,.cmpwrap,.cchips,.hbar')}).map(e=>(e.textContent||'').trim().slice(0,30)).slice(0,6);
              out.small=[...document.querySelectorAll('#main button,#main [role=button],#main a')].filter(e=>{const r=e.getBoundingClientRect();return e.offsetParent&&r.width>0&&(r.height<30||r.width<30)&&!e.closest('.tlwrap,.tl,.frame-mini,.cchips')}).map(e=>(e.getAttribute('aria-label')||e.textContent||e.className).trim().slice(0,24)).slice(0,6);
              out.noLabel=[...document.querySelectorAll('#main button')].filter(e=>e.offsetParent&&!(e.textContent||'').trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('title')).map(e=>e.className||e.dataset.act).slice(0,6);return out}""",v)
            if r["title"] and r["title"][1] and r["title"][0]!=r["title"][1]: rep["titleMismatch"].append(v+": nav«"+r["title"][0]+"» ≠ h1«"+r["title"][1]+"»")
            for k,key in [("clipped","clipped"),("small","smallTargets"),("noLabel","noLabel")]:
                if r[k]: rep[key][v]=r[k]
        print(json.dumps(rep,ensure_ascii=False,indent=1));await b.close()
asyncio.run(main())
