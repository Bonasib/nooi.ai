# v265 — the common frame on the last four pages: Enhance, Coloring book, Voice & audio and Characters have their options in the
# 420 px column on the start side and the result beside it, like every other tool; a phone stacks them. Run: python3 tests/v265.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8795; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v265-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D); json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1400]))
SETUP = "(v)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go(v);renderAll()}"
FR = "()=>{const b=document.querySelector('#main>.view>.f265');if(!b)return null;const R=e=>e.getBoundingClientRect(),s=b.querySelector(':scope>.set265'),r=b.querySelector(':scope>.res265');return{set:[Math.round(R(s).left),Math.round(R(s).width)],res:[Math.round(R(r).left),Math.round(R(r).width)],resH:Math.round(R(r).height),same:Math.abs(R(s).top-R(r).top)<2,page:document.documentElement.scrollWidth-innerWidth}}"
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await pg.evaluate(SETUP, "video"); await pg.wait_for_timeout(500)
        fr = {}
        for v in ("finish", "coloring", "voice", "chars", "motion"):
            await pg.evaluate("(v)=>go(v)", v); await pg.wait_for_timeout(450)
            fr[v] = await pg.evaluate(FR) if v != "motion" else await pg.evaluate("()=>{const b=document.querySelector('#main .tool118'),s=b.querySelector('.set118').getBoundingClientRect();return{set:[Math.round(s.left),Math.round(s.width)]}}")
        chk("computer: Enhance, Coloring book, Voice and Characters use the common frame — the options are the 420 px column at the common edge (like Motion Control), the result beside it",
            all(fr[v] and fr[v]["set"] == fr["motion"]["set"] == [264, 420] and fr[v]["res"][0] == 704 and fr[v]["res"][1] >= 690 and fr[v]["same"] and fr[v]["resH"] > 100 and fr[v]["page"] <= 0 for v in ("finish", "coloring", "voice", "chars")), fr)
        await pg.evaluate("()=>go('finish')"); await pg.wait_for_timeout(400)
        fin = await pg.evaluate("()=>({tools:document.querySelectorAll('#main .toolgrid .tool').length,rows:new Set([...document.querySelectorAll('#main .toolgrid .tool')].map(t=>Math.round(t.getBoundingClientRect().top))).size,h:Math.round(document.querySelector('#main .toolgrid .tool').getBoundingClientRect().height),run:!!document.querySelector('#main .set265 .btn.primary'),empty:(document.querySelector('#main .res265 .empty')||{}).textContent})")
        await pg.click('#main .toolgrid .tool:nth-child(3)'); await pg.wait_for_timeout(400)
        fin2 = await pg.evaluate("()=>({title:document.querySelector('#main .set265 h2,#main .set265 h3')?.textContent,frame:!!document.querySelector('#main>.view>.f265')})")
        chk("Enhance: the eight tools are a compact row of choices (2 rows at most), the chosen tool's options and its Run button are in the column; picking another tool keeps the frame", fin["tools"] == 8 and fin["rows"] <= 2 and fin["h"] <= 72 and fin["run"] and fin["empty"] and fin2["frame"] and fin2["title"], [fin, fin2])
        await pg.evaluate("()=>go('chars')"); await pg.wait_for_timeout(400)
        ch = await pg.evaluate("()=>({list:!!document.querySelector('#main .set265 [data-act=\"pick-char\"]'),photo:!!document.querySelector('#main .set265 .a3card'),det:!!document.querySelector('#main .res265 .cbuild'),name:document.querySelector('#main .res265 [data-bind=\"char.name\"]')?.value})")
        await pg.fill('#main .res265 [data-bind="char.name"]', "Layla"); await pg.wait_for_timeout(300)
        nm = await pg.evaluate("()=>S.chars[S.charSel].name")
        chk("Characters: the list and From a photo are the column, the character and its details beside it; the fields still work", ch["list"] and ch["photo"] and ch["det"] and ch["name"] and nm == "Layla", [ch, nm])
        await pg.evaluate("()=>go('coloring')"); await pg.wait_for_timeout(400)
        chk("Coloring book: every option and its button are in the column", await pg.evaluate("()=>!!document.querySelector('#main .set265 .btn.primary.big')&&document.querySelectorAll('#main .set265 .tiles').length>=2"))
        await pg.close()
        ph = await (await b.new_context(**p.devices["iPhone 13"])).new_page(); ph.on("pageerror", lambda e: errs.append(str(e)[:300])); await ph.goto(B + "/"); await ph.wait_for_timeout(1500); await ph.evaluate(SETUP, "video"); await ph.wait_for_timeout(500)
        m = {}
        for v in ("finish", "coloring", "voice", "chars"):
            await ph.evaluate("(v)=>go(v)", v); await ph.wait_for_timeout(400); m[v] = await ph.evaluate("()=>{const b=document.querySelector('#main .f265'),s=b.querySelector('.set265').getBoundingClientRect(),r=b.querySelector('.res265').getBoundingClientRect();return{stack:r.top>=s.bottom-1,w:Math.round(s.width),page:document.documentElement.scrollWidth-innerWidth}}")
        chk("phone: the options first, the result under them, nothing wider than the screen", all(x["stack"] and x["w"] >= 330 and x["page"] <= 0 for x in m.values()), m)
        chk("no page errors", not errs, errs); await b.close()
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v265 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v265 OK")
