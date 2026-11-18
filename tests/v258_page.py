# v258 (page) — nooi Studio: the Script chip (paste a script or chapter, its word count, a note when the length makes one shot);
# Generate sends the script with the job and, with no words of its own, the script's first line as the idea. Run: python3 tests/v258_page.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8783; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v258p-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D); json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1200]))
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(B + "/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.credits=9000;S.draft.dur=5;S.draft.hq257='';S.draft.variations=1;go('video');renderAll()}"); await pg.wait_for_timeout(600)
        await E("()=>{S.draft.script258='';S.draft.prompt='';S.draft.dur=5;renderView()}"); await pg.wait_for_timeout(300)
        chip = await E("()=>{const c=document.querySelector('#main [data-o93=\"scr258\"]');return c?c.querySelector('.o93v').textContent:null}")
        await E("()=>{const c=document.querySelector('#main [data-o93=\"scr258\"]');c.scrollIntoView({block:'nearest',inline:'center'})}")
        await pg.click('#main [data-o93="scr258"]', force=True); await pg.wait_for_timeout(250)
        await pg.fill('[data-scr258="1"]', "INT. OLD SOUK - DAY\nLayla walks between the spice stalls. Omar gives her the map.")
        await pg.wait_for_timeout(200); await E("()=>document.querySelector('[data-scr258]').dispatchEvent(new Event('change',{bubbles:true}))"); await pg.wait_for_timeout(400)
        one = await E("()=>({v:document.querySelector('#main [data-o93=\"scr258\"] .o93v').textContent,note:(document.querySelector('#sec93-scr258 [role=note]')||{}).textContent||'',n:(document.querySelector('[data-scr258n]')||{}).textContent})")
        j = await E("()=>{const n=S.jobs.length;makeVideo();const j=S.jobs[S.jobs.length-1];return S.jobs.length>n?{p:j.prompt,t:j.title,s:(j.meta||{}).script258}:null}")
        left = await E("()=>S.draft.prompt")
        chk("the Script chip is in the bar (None at first); pasting shows the word count; a short length says it makes one shot", chip in ("None",) and one["v"].endswith("words") and "one shot" in one["note"] and one["n"].startswith("8"), [chip, one])
        chk("Generate sends the script with the job, its first line as the idea; the box's own words stay empty", j and j["p"].startswith("INT. OLD SOUK") and "spice stalls" in (j["s"] or "") and left == "", [j, left])
        chk("no page errors", not errs, errs); await b.close()
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v258 page FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v258 page OK")
