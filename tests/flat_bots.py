import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();errs=[]
        pg=await (await b.new_context(viewport={"width":900,"height":700},device_scale_factor=2,color_scheme="light")).new_page()
        pg.on("pageerror",lambda e: errs.append(str(e)[:200]))
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(400)
        r=await pg.evaluate("""()=>{S.user={name:'G',method:'google'};S.theme='light';applyTheme();const host=document.createElement('div');host.id='fbhost';host.style.cssText='position:fixed;inset:0;z-index:999;background:#f4f5f2;display:grid;grid-template-columns:repeat(8,1fr);gap:6px;padding:20px;align-content:start;font:12px sans-serif';document.body.appendChild(host);
          const out={};for(const st of ['idle','working','done']){for(const bt of BOTS){const d=document.createElement('div');d.style.textAlign='center';d.innerHTML=botSVG(bt.id,st,96)+'<div>'+bt.name[0]+'<br><small>'+st+'</small></div>';host.appendChild(d);
            const sv=d.querySelector('svg');const anims=[...sv.querySelectorAll('*')].concat([sv]).map(e=>getComputedStyle(e).animationName).filter(a=>a&&a!=='none'&&a!=='pop');(out[st]=out[st]||{})[bt.id]=[...new Set(anims)].join('+')}}
          const uniq=st=>{const v=Object.values(out[st]);return new Set(v).size+'/'+v.length};return {animations:out,uniqueIdle:uniq('idle'),uniqueWorking:uniq('working'),uniqueDone:uniq('done')}}""")
        await pg.wait_for_timeout(700);
        print(json.dumps(r,indent=1),errs);await b.close()
asyncio.run(main())
