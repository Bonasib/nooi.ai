# Home create box: nooi button + one model chip (sheet), bots, durations, send, results appear under the box (no page change),
# Approve opens the editor (video) or the Images page (image). Demo mode (jobs simulated in the browser).
import asyncio, json, os, subprocess, time, urllib.request
from playwright.async_api import async_playwright

PORT = 8095
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

async def main():
    srv = subprocess.Popen(["node", "server.js"], cwd=ROOT, env=dict(os.environ, PORT=str(PORT), SECRET_KEY="h" * 32), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out, fails = {}, []
    try:
        for _ in range(60):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/", timeout=1); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            b = await p.chromium.launch()
            for w in (390, 1280):
                ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=w < 800, has_touch=w < 800)
                pg = await ctx.new_page(); errs = []
                pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)[:200]))
                await pg.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
                await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
                E = pg.evaluate
                await E("()=>{API.mode='demo';S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.credits=5000;S.hf.out=[];S.hf.n=2;S.hf.tab='image';go('home');renderAll()}")
                row = await E("()=>[...document.querySelectorAll('.hfmrow .hfmi')].map(b=>b.dataset.act)")
                await E("()=>document.querySelector('.hfmi[data-act=hf-model]').click()"); await pg.wait_for_timeout(200); await E("()=>document.querySelector('.hfmodel[data-v=nanopro]').click()"); await pg.wait_for_timeout(200)
                picked = await E("()=>S.hf.iModel")
                await E("()=>{document.querySelector('#hfq').value='a red fox in snow';document.querySelector('.hfsend').click()}")
                await pg.wait_for_timeout(400)
                stay = await E("()=>S.view"); cards = await E("()=>document.querySelectorAll('.hfres .hfrc').length")
                await pg.wait_for_timeout(9000)
                done = await E("()=>S.hf.out.map(id=>S.jobs.find(j=>j.id===id).status)")
                await E("()=>document.querySelector('[data-act=hfr-ok]').click()"); await pg.wait_for_timeout(300)
                img_view = await E("()=>S.view")
                await E("()=>{go('home');S.hf.tab='video';S.hf.vModel='auto';renderView()}")
                auto_first = await E("()=>{const b=document.querySelector('.hfmi');b.click();return b.dataset.act==='hfx-nooi'&&/nooi/.test(b.textContent)&&nooiOn()&&!!document.querySelector('.hfbots .botstrip')&&HF_DURS.filter(hfDurOK).includes(30)}")
                await E("()=>{document.querySelector('#hfq').value='waves at sunset';document.querySelector('.hfsend').click()}")
                await pg.wait_for_timeout(14000)
                await E("()=>document.querySelector('[data-act=hfr-ok]').click()"); await pg.wait_for_timeout(300)
                vid_view = await E("()=>S.view")
                r = {"modelRow": row, "picked": picked, "stayedOnHome": stay, "cards": cards, "statuses": done, "approveImage": img_view, "autoFirst": auto_first, "approveVideo": vid_view, "errors": errs}
                out[w] = r
                if not (row and row[0] == "hfx-nooi" and "hf-model" in row and picked == "nanopro"): fails.append(f"{w}: model row")
                if stay != "home" or cards != 2: fails.append(f"{w}: results not under the box ({stay}, {cards})")
                if done != ["complete", "complete"]: fails.append(f"{w}: images did not finish {done}")
                if img_view != "image" or vid_view != "edit": fails.append(f"{w}: approve went to {img_view}/{vid_view}")
                if not auto_first: fails.append(f"{w}: nooi button / bots / 30 s")
                if errs: fails.append(f"{w}: page errors {errs}")
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    print(json.dumps({"fails": fails, "detail": out}, indent=1))
    raise SystemExit(1 if fails else 0)

asyncio.run(main())
