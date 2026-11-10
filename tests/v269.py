# v269 — phone fixes from the owner's screenshots (Motion Control): the action bar sat at different heights and partly under the
# bottom menu; page text showed through the bottom menu; the chosen option's icon was lime on lime; a title's words had a double
# gap. Run: python3 tests/v269.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8798; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v269-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D); json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1400]))
SETUP = "(v)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go(v);renderAll()}"
BAR = """()=>{const n=document.getElementById('bottomnav').getBoundingClientRect(),g=document.querySelector('#main .go118');if(!g)return null;const r=g.getBoundingClientRect(),m=document.getElementById('main');
  return {navTop:Math.round(n.top),barTop:Math.round(r.top),barBottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),w:innerWidth,
  navBg:getComputedStyle(document.getElementById('bottomnav')).backgroundColor,last:(()=>{m.scrollTop=1e6;scrollTo(0,1e6);const f=[...document.querySelectorAll('#main .res118, #main .set118')].pop();return f?Math.round(f.getBoundingClientRect().bottom):0})()}}"""
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        for dev in ("Pixel 7", "iPhone 13"):
            pg = await (await b.new_context(**p.devices[dev])).new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
            await pg.goto(B + "/"); await pg.wait_for_timeout(1500)
            seen = 0
            for v in ("motion", "ugcads", "slideshow", "vss"):
                await pg.evaluate(SETUP, v); await pg.wait_for_timeout(700)
                d = await pg.evaluate(BAR)
                if d is None: continue
                seen += 1; await pg.wait_for_timeout(300); d2 = await pg.evaluate(BAR)
                chk(f"{dev} {v}: the action bar sits right on the bottom menu, full width, and stays there when scrolled",
                    abs(d["barBottom"] - d["navTop"]) <= 1 and d["left"] == 0 and d["right"] == d["w"] and d2["barBottom"] == d["barBottom"], [d, d2])
                chk(f"{dev} {v}: the bottom menu is solid (nothing shows through)", d["navBg"].startswith("rgb(") or d["navBg"].endswith("/ 1)"), d["navBg"])
                chk(f"{dev} {v}: the end of the page isn't hidden behind the bar", d2["last"] <= d2["barTop"] + 1, d2)
            chk(f"{dev}: the bar was found on the tool pages", seen >= 3, seen)
            await pg.evaluate(SETUP, "motion"); await pg.wait_for_timeout(600)
            c = await pg.evaluate("()=>{const g=document.querySelector('#main .mcm93[aria-checked=true] .gl');return [getComputedStyle(g).backgroundColor,getComputedStyle(g.querySelector('svg')).color]}")
            chk(f"{dev}: the chosen option's icon is dark on its lime square", c[0] != c[1] and c[1] in ("rgb(10, 18, 0)",), c)
            gap = await pg.evaluate("()=>{const w=[...document.querySelectorAll('#main h1 .w121')].map(e=>e.getBoundingClientRect());return w.length>1?w[1].left-w[0].right:null}")
            chk(f"{dev}: one normal space between the title's words", gap is not None and 4 <= gap <= 14, gap)
            await pg.close()
        pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await pg.evaluate(SETUP, "motion"); await pg.wait_for_timeout(600)
        pos = await pg.evaluate("()=>getComputedStyle(document.querySelector('#main .go118')).position")
        chk("computer: the bar stays inside its panel (not fixed to the screen)", pos == "sticky", pos)
        chk("no page errors", not errs, errs)
        await b.close()
try: asyncio.run(main())
finally:
    srv.terminate(); shutil.rmtree(D, ignore_errors=True)
print("FAIL\n- " + "\n- ".join(fails) if fails else "v269: phone action bar on the bottom menu, solid menu, visible icon, title spacing — all checks passed")
sys.exit(1 if fails else 0)
