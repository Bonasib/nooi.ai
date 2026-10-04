import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
SAMPLE=r"""async()=>{const out=[];const t0=performance.now();for(let i=0;i<14;i++){const sv=[...document.querySelectorAll('.nbrand .nmark')].find(x=>x.getBoundingClientRect().width>0);const d=sv.querySelector('.nm-dot'),l=sv.querySelector('.nm-ln');const r=d.getBoundingClientRect();out.push([Math.round(performance.now()-t0),Math.round(r.width*10)/10,Math.round(parseFloat(getComputedStyle(l).strokeDashoffset)*100)/100]);await new Promise(r=>setTimeout(r,250))}return out}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await (await b.new_context(viewport={"width":1280,"height":800})).new_page()
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(100)
        await pg.evaluate("()=>{S.user={name:'G',method:'google'};S.view='home';renderAll()}")
        print("FIRST APPEARANCE [ms, dot width px, line dashoffset]:",json.dumps(await pg.evaluate(SAMPLE)))
        el=lambda: pg.evaluate("(()=>{const e=[...document.querySelectorAll('.nbrand')].find(x=>x.getBoundingClientRect().width>0);e.dispatchEvent(new PointerEvent('pointerenter',{bubbles:false,pointerType:'mouse'}));return 1})()")
        await pg.wait_for_timeout(500);await el();print("REPLAY #1:",json.dumps(await pg.evaluate(SAMPLE)))
        await pg.wait_for_timeout(2600);await el();print("REPLAY #2:",json.dumps(await pg.evaluate(SAMPLE)))
        await pg.wait_for_timeout(2000);await pg.evaluate("(()=>{const e=[...document.querySelectorAll('.nbrand')].find(x=>x.getBoundingClientRect().width>0);e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}))})()");print("TAP (phone):",json.dumps(await pg.evaluate(SAMPLE)))
        await pg.evaluate("go('video')");print("AFTER NAVIGATION:",json.dumps(await pg.evaluate(SAMPLE)))
        same=await pg.evaluate("(()=>{const a=document.querySelector('.nbrand');go('video');const b=document.querySelector('.nbrand');return a===b})()")
        print("header element kept after navigation:",same)
        await b.close()
asyncio.run(main())
