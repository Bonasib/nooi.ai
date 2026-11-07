# v256 — the owner: "the way of working and its automation". A real nooi server and a browser — Workflows (Agents & automation):
#  · Templates and My workflows as tall cards; the new templates (Moment with music, Sharp portrait) are there
#  · Create a workflow → the Builder: add steps (Picture · Video from it · Sharper copy · Voiceover · Music), change the words,
#    move and remove a step; the rules the server follows are checked (a video after a picture; up to 5 steps)
#  · the Form: what it needs (your idea), the steps with their prices and the total, Run → one job that carries the next steps
#  · a template can't be changed until it's saved as yours; Arabic and phone fit; no page errors
# Run: python3 tests/v256.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8775; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v256-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1500]))
SETUP = "([v,l])=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.credits=5000;S.fl256={};S.rec83={};go(v);renderAll()}"
async def run(p, lang, phone=False):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]) if phone else await b.new_context(viewport={"width": 1440, "height": 900})
    pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); posts = []
    pg.on("request", lambda r: posts.append(r.post_data) if r.method == "POST" and r.url.endswith("/v1/jobs") else None)
    await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await E(SETUP, ["flow256", lang]); await pg.wait_for_timeout(700)
    tag = ("phone " if phone else "computer ") + lang
    g = await E("()=>({cards:[...document.querySelectorAll('#main .fcard256')].map(c=>c.querySelector('b').textContent),ratio:(()=>{const r=document.querySelector('#main .fcard256').getBoundingClientRect();return Math.round(r.height/r.width*100)/100})(),tabs:[...document.querySelectorAll('.ftabs256 button')].map(b=>b.textContent),menu:!!document.querySelector('#sb253 [data-go=\"flow256\"]'),page:document.documentElement.scrollWidth-innerWidth})")
    names = ("Moment with music", "Sharp portrait") if lang == "en" else ("لحظة بموسيقى", "بورتريه واضح")
    chk(f"{tag}: Workflows lists the templates as tall cards (with the new ones), two tabs, in the menu; nothing wider than the screen", all(n in g["cards"] for n in names) and len(g["cards"]) >= 7 and 1.3 <= g["ratio"] <= 1.36 and len(g["tabs"]) == 2 and g["menu"] and g["page"] <= 0, g)
    if phone or lang == "ar":
        chk(f"{tag}: no page errors", not errs, errs); await b.close(); return
    # create → builder; add steps; the rules
    await pg.click('[data-act="fl256-new"]'); await pg.wait_for_timeout(400)
    await pg.click('[data-fl256add="music"]'); await pg.wait_for_timeout(250); await pg.click('[data-fl256add="video"]'); await pg.wait_for_timeout(300)
    bad = await E("()=>(document.querySelector('#main [role=alert]')||{}).textContent||''")
    await pg.click('[data-fl256mv="2"][data-d="-1"]'); await pg.wait_for_timeout(300)
    order = await E("()=>{const f=R83().mine.slice(-1)[0];return f.steps.map(s=>s.kind)}")
    ok2 = await E("()=>(document.querySelector('#main [role=alert]')||{}).textContent||''")
    chk("the builder: steps are added and moved; a video after music is caught (a video starts from a picture), and fixed by moving it", "picture" in bad.lower() and order == ["image", "video", "music"] and ok2 == "", [bad, order, ok2])
    for k in ("finish", "voice"): await pg.click(f'[data-fl256add="{k}"]'); await pg.wait_for_timeout(250)
    full = await E("()=>({n:R83().mine.slice(-1)[0].steps.length,add:!!document.querySelector('[data-fl256add]')})")
    await pg.click('[data-fl256rm="4"]'); await pg.wait_for_timeout(250); await pg.click('[data-fl256rm="3"]'); await pg.wait_for_timeout(250)
    await pg.fill('[data-fl256p="1"]', "Slow orbit around it, soft light"); await pg.fill('[data-fl256name="1"]', "Oud ad")
    st = await E("()=>{const f=R83().mine.slice(-1)[0];return{n:f.steps.length,name:f.name,p:f.steps[1].prompt}}")
    chk("up to 5 steps (no Add after 5); steps removed; a step's words and the name are changed", full == {"n": 5, "add": False} and st == {"n": 3, "name": "Oud ad", "p": "Slow orbit around it, soft light"}, [full, st])
    # the form: needs, prices, run
    await pg.click('[data-fl256mode="form"]'); await pg.wait_for_timeout(300)
    fm = await E("()=>({idea:!!document.getElementById('fl256idea'),steps:document.querySelectorAll('#main .rsteps83 li').length,cost:document.querySelector('[data-act=\"fl256-run\"] .cost').textContent})")
    await pg.fill("#fl256idea", "a glass bottle of oud perfume on black marble"); await pg.wait_for_timeout(200)
    n0 = len(posts); await pg.click('[data-act="fl256-run"]'); await pg.wait_for_timeout(1500)
    body = json.loads(posts[n0]) if len(posts) > n0 and posts[n0] else {}
    chain = (body.get("meta") or {}).get("chain") or []
    runs = await E("()=>({runs:(R83().runs||[]).map(r=>r.title),view:S.view,shown:document.querySelectorAll('#main .frun256').length})")
    chk("the form asks for the idea, lists the 3 steps with the total; Run sends one job that carries the next steps (video, music) with the idea in the words", fm["idea"] and fm["steps"] == 3 and fm["cost"].strip().split()[0].isdigit() and int(fm["cost"].strip().split()[0]) > 0
        and body.get("kind") == "image" and "oud perfume" in body.get("prompt", "") and [s.get("kind") for s in chain] == ["video", "music"] and chain[0].get("prompt") == "Slow orbit around it, soft light" and "oud perfume" in chain[1].get("prompt", "")
        and any(t.startswith("Oud ad") for t in runs["runs"]) and runs["view"] == "flow256" and runs["shown"] >= 1, [fm, body, runs])
    # a template can't be changed until saved
    await pg.click('[data-act="fl256-back"]'); await pg.wait_for_timeout(300); await pg.click('[data-fl256tab="tpl"]'); await pg.wait_for_timeout(300)
    await pg.click('.fcard256[data-fl256="t256portrait"]'); await pg.wait_for_timeout(300); await pg.click('[data-fl256mode="build"]'); await pg.wait_for_timeout(300)
    t = await E("()=>({ro:document.querySelector('[data-fl256p=\"0\"]').readOnly,add:!!document.querySelector('[data-fl256add]'),save:!!document.querySelector('[data-act=\"fl256-copy\"]')})")
    await pg.click('[data-act="fl256-copy"]'); await pg.wait_for_timeout(300)
    t2 = await E("()=>({ro:document.querySelector('[data-fl256p=\"0\"]').readOnly,mine:R83().mine.length,tab:S.fl256.tab})")
    chk("a template is read-only until saved as yours; then it can be changed (in My workflows)", t == {"ro": True, "add": False, "save": True} and t2 == {"ro": False, "mine": 2, "tab": "mine"}, [t, t2])
    chk(f"{tag}: no page errors", not errs, errs); await b.close()
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        await run(p, "en"); await run(p, "ar"); await run(p, "en", phone=True)
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v256 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-1500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v256 OK")
