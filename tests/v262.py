# v262 — fewer doors (the owner approved the merge; nothing is deleted). A real nooi server and a browser:
#  · nooi Studio's mode row: One video · A film by 9 agents · Chapter story · Storyboard, on all four pages, the open one marked;
#    each opens its page; the side menu marks nooi Studio on all four and no longer lists the other three
#  · More (end of the menu): Sketch to life, Coloring book, Video intelligence, Hook lab — each opens, More stays marked
#  · a section with one tool (Image, Characters, 3D, Workflows) is a plain item
#  · All tools still lists every tool; no page errors; a phone gets the mode row too, nothing wider than the screen
# Run: python3 tests/v262.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8789; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v262-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D); json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1400]))
SETUP = "(v)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go(v);renderAll()}"
MODES = "()=>({m:[...document.querySelectorAll('#main .mode93 [data-go]')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.dataset.go+':'+b.getAttribute('aria-selected')),n:document.querySelectorAll('#main .mode93').length,cur:document.querySelector('#sb253 .sbi253[aria-current=page]')?.dataset.go,page:document.documentElement.scrollWidth-innerWidth})"
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await E(SETUP, "video"); await pg.wait_for_timeout(500)
        res = {}
        for v in ("video", "crew", "story", "board"):
            await pg.click(f'#main .mode93 [data-go="{v}"]'); await pg.wait_for_timeout(500); res[v] = dict(await E(MODES), view=await E("()=>S.view"))
        want = lambda v: [k + ":" + ("true" if k == v else "false") for k in ("video", "crew", "story", "board")]
        chk("the mode row (4 ways to make a film) is on all four pages, the open one marked, each opens its page; the menu marks nooi Studio", all(r["m"] == want(v) and r["n"] == 1 and r["view"] == v and r["cur"] == "video" and r["page"] <= 0 for v, r in res.items()), res)
        menu = await E("()=>({all:[...document.querySelectorAll('#sb253 [data-go]')].map(b=>b.dataset.go),groups:[...document.querySelectorAll('#sb253 .sbh253')].map(b=>b.dataset.sb253),single:[...document.querySelectorAll('#sb253 .sb1262 [data-go]')].map(b=>b.dataset.go)})")
        chk("the menu: the three film tools left it; Image, Characters, 3D and Workflows are plain items; More is the last group", not ({"crew", "story", "board"} & set(menu["all"])) and set(menu["single"]) == {"image", "chars", "world", "flow256"} and menu["groups"][-1] == "more", menu)
        await pg.click('#sb253 [data-sb253="more"]'); await pg.wait_for_timeout(200)
        more = await E("()=>[...document.querySelectorAll('#sb253 .sbg253.open .sbi253')].map(b=>b.dataset.go)")
        opened = {}
        for v in more:
            await pg.click(f'#sb253 .sbg253.open [data-go="{v}"]'); await pg.wait_for_timeout(450)
            opened[v] = await E("()=>[S.view,document.querySelector('#sb253 .sbg253.here .sbh253')?.dataset.sb253,document.querySelector('#sb253 .sbi253[aria-current=page]')?.dataset.go]")
        chk("More holds Sketch, Coloring book, Video intelligence and Hook lab; each opens and More stays marked", set(more) == {"sketch", "coloring", "vss", "hooks"} and all(o == [v, "more", v] for v, o in opened.items()), [more, opened])
        await E("()=>go('apps')"); await pg.wait_for_timeout(400)
        tools = await E("()=>[...document.querySelectorAll('#main .apps90 .tool[data-go]')].map(b=>b.dataset.go)")
        chk("All tools still lists every tool (nothing deleted)", {"story", "board", "sketch", "coloring", "hooks", "vss"} <= set(tools), tools)
        await pg.close()
        ph = await (await b.new_context(**p.devices["iPhone 13"])).new_page(); ph.on("pageerror", lambda e: errs.append(str(e)[:300])); await ph.goto(B + "/"); await ph.wait_for_timeout(1500); await ph.evaluate(SETUP, "story"); await ph.wait_for_timeout(600)
        pm = await ph.evaluate(MODES)
        chk("phone: the mode row is on Chapter story, nothing wider than the screen", pm["m"] == want("story") and pm["page"] <= 0, pm)
        chk("no page errors", not errs, errs); await b.close()
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v262 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v262 OK")
