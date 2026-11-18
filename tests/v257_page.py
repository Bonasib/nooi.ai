# v257 (page) — nooi Studio: the Quality chip shows only for a video made of several parts; Best quality adds 3 pictures a part
# to Generate's price and the job carries it. Run: python3 tests/v257_page.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8779; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v257p-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
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
        short = await E("()=>!!document.querySelector('#main [data-o93=\"hq257\"]')")
        await E("()=>{const m=Object.keys(MODELS).find(k=>k!=='auto'&&parts132(k,30)>1);S.draft.model=m;S.draft.dur=30;renderView()}"); await pg.wait_for_timeout(500)
        info = await E("()=>({m:S.draft.model,n:parts132(S.draft.model,S.draft.dur),chip:!!document.querySelector('#main [data-o93=\"hq257\"]'),cost:+document.querySelector('#main [data-act=\"gen-video\"] .cost').textContent.replace(/\\D/g,''),nano:IMG_MODELS.nano.cr})")
        await E("()=>{const c=document.querySelector('#main [data-o93=\"hq257\"]');c.scrollIntoView({block:'nearest',inline:'center'})}")
        await pg.click('#main [data-o93="hq257"]', force=True); await pg.wait_for_timeout(250)
        await pg.click('#sec93-hq257 [data-set="draft.hq257"][data-val="1"]', force=True); await pg.wait_for_timeout(400)
        after = await E("()=>({cost:+document.querySelector('#main [data-act=\"gen-video\"] .cost').textContent.replace(/\\D/g,''),v:document.querySelector('#main [data-o93=\"hq257\"] .o93v').textContent})")
        j = await E("()=>{S.draft.prompt='A girl runs on a hill with a red kite';const n=S.jobs.length;makeVideo();const j=S.jobs[S.jobs.length-1];return S.jobs.length>n?{meta:j.meta,cost:j.cost}:null}")
        chk("the Quality chip shows only for a video made of several parts", not short and info["chip"] and info["n"] > 1, [short, info])
        chk("Best quality adds 3 pictures a part to Generate's price", after["cost"] - info["cost"] == info["n"] * 3 * info["nano"] and after["v"] == "Best", [info, after])
        chk("the job carries Best quality and its price", j and (j["meta"] or {}).get("hq257") == 1 and j["cost"] >= after["cost"] - 1, [j, after])
        chk("no page errors", not errs, errs); await b.close()
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v257 page FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v257 page OK")
