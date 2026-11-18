# v253 — the owner: "re-order the whole look after the open-source studio's layout, same identity, lime; keep the editor and
# the dashboard". A real nooi server and a browser:
#  · computer: a side menu in groups (Image · Video · Audio · Characters · 3D · Edit · Publish · Agents & automation) with the
#    tools of the open group, the page you're on marked in lime; a group opens on a tap; the menu folds to icons and stays
#    folded after a reload; the header says where you are (section › tool); the old row of sections is gone from the header
#  · Arabic: the menu is on the right
#  · phone: the Menu button opens the same menu as a drawer; a tool closes it
#  · a job being made shows a notice in the top corner, then "Ready · Open" when it's made
#  · template cards: tall covers with the kind in lime above the name
#  · nothing overlaps, nothing wider than the screen, no page errors
# Run: python3 tests/v253.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8771; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v253-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1500]))
SETUP = "([v,l])=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;go(v);renderAll()}"
OVER = """()=>{const R=e=>e.getBoundingClientRect();const a=document.querySelector('#sb253'),m=document.querySelector('#main');
  const items=[...document.querySelectorAll('#sb253 .sbi253,#sb253 .sbh253')].filter(e=>R(e).width>0);
  const spill=items.filter(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e.querySelector('span')||e).display!=='none'&&!e.querySelector('span'));
  return{side:a&&!a.hidden?[Math.round(R(a).left),Math.round(R(a).right)]:null,main:[Math.round(R(m).left),Math.round(R(m).right)],page:document.documentElement.scrollWidth-innerWidth,n:items.length}}"""
async def desktop(p, lang):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append((str(e)+" @ "+str(getattr(e,"stack",""))[:600])))
    await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await E(SETUP, ["video", lang]); await pg.wait_for_timeout(700)
    r = await E("""()=>({groups:[...document.querySelectorAll('#sb253 .sbh253 span')].map(s=>s.textContent),open:[...document.querySelectorAll('#sb253 .sbg253.open .sbi253 span')].map(s=>s.textContent),
      cur:document.querySelector('#sb253 .sbi253[aria-current=page] span')?.textContent,curBg:getComputedStyle(document.querySelector('#sb253 .sbi253[aria-current=page]')).backgroundColor,
      crumb:document.querySelector('.crumb253')?.textContent,hnav:!!document.querySelector('#main>.topm .hnav98')&&getComputedStyle(document.querySelector('#main>.topm .hnav98')).display!=='none',dir:document.documentElement.dir})""")
    o = await E(OVER)
    if lang == "en":
        chk("computer: a side menu in groups, the open group's tools, the page marked in lime; the header says where you are; no row of sections in the header",
            r["groups"] == ["Video", "Audio", "Edit", "Publish", "More"] and "Motion Control" in r["open"] and r["cur"] == "nooi Studio" and "Video" in (r["crumb"] or "") and "nooi Studio" in (r["crumb"] or "") and not r["hnav"]
            and o["side"] == [0, 232] and o["main"][0] >= 232 and o["page"] <= 0, [r, o])
        await pg.click('#sb253 [data-sb253="audio"]'); await pg.wait_for_timeout(200)
        a = await E("()=>[...document.querySelectorAll('#sb253 .sbg253.open .sbi253 span')].map(s=>s.textContent)")
        await pg.click('#sb253 .sbg253.open .sbi253'); await pg.wait_for_timeout(500); v = await E("()=>S.view")
        chk("a group opens its tools on a tap, and a tool opens its page", "Voice & audio" in a and v in ("voice", "audio"), [a, v])
        await pg.click('[data-act="sb253-fold"]'); await pg.wait_for_timeout(300); f1 = await E(OVER)
        await pg.reload(); await pg.wait_for_timeout(1500); await E(SETUP, ["image", lang]); await pg.wait_for_timeout(600); f2 = await E(OVER)
        lbl = await E("()=>getComputedStyle(document.querySelector('#sb253 .sbi253 span')).display")
        chk("the menu folds to icons and stays folded after a reload", f1["side"] == [0, 68] and f2["side"] == [0, 68] and lbl == "none" and f2["main"][0] >= 68, [f1, f2, lbl])
        await pg.click('[data-act="sb253-fold"]'); await pg.wait_for_timeout(200)
        # a job being made → a notice; made → Ready · Open
        await E("()=>{S.jobs.push({id:'jn1',kind:'video',status:'rendering',prompt:'a kite over the sea',created:Date.now(),pal:PALS[0],aspect:'16:9',dur:5});}"); await pg.wait_for_timeout(1500)
        n1 = await E("()=>document.querySelector('#nt253 .ntc253')?.className+'|'+document.querySelector('#nt253 .ntc253')?.textContent")
        await E("()=>{const j=S.jobs.find(x=>x.id==='jn1');j.status='complete';j.url='/media/x.mp4'}"); await pg.wait_for_timeout(1500)
        n2 = await E("()=>document.querySelector('#nt253 .ntc253')?.className+'|'+document.querySelector('#nt253 .ntc253')?.textContent")
        await pg.click('#nt253 [data-nt253]'); await pg.wait_for_timeout(400); v2 = await E("()=>[S.view,document.querySelectorAll('#nt253 .ntc253').length]")
        chk("a job being made shows a notice, then Ready with Open (which opens its page)", "busy" in n1 and "Being made" in n1 and "a kite" in n1 and "ok" in n2 and "Ready" in n2 and "Open" in n2 and v2 == ["video", 0], [n1, n2, v2])
        await E("()=>go('explore')"); await pg.wait_for_timeout(700)
        t = await E("()=>{const c=document.querySelector('#main .tpl2');const r=c.getBoundingClientRect();return{ratio:Math.round(r.height/r.width*100)/100,cat:c.querySelector('.cat253')?.textContent,col:getComputedStyle(c.querySelector('.cat253')).color,name:c.querySelector('.cv253 .ti')?.textContent,n:document.querySelectorAll('#main .tpl2 .cv253').length}}")
        chk("template cards: tall covers (3:4) with the kind in lime above the name", 1.3 <= t["ratio"] <= 1.36 and t["cat"] and t["name"] and t["n"] >= 8 and "rgb(217, 244, 59)" == t["col"], t)
    else:
        chk("Arabic: the menu on the right, in Arabic", o["side"] == [1440 - 232, 1440] and o["main"][1] <= 1440 - 232 and r["dir"] == "rtl" and "فيديو" in r["groups"] and o["page"] <= 0, [r, o])
    chk(f"desktop {lang}: no page errors", not errs, errs); await b.close()
async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await E(SETUP, ["video", "en"]); await pg.wait_for_timeout(600)
    s0 = await E("()=>Math.round(document.querySelector('#sb253').getBoundingClientRect().right)")
    await pg.click('#bottomnav [data-act="menu82"]'); await pg.wait_for_timeout(400)
    s1 = await E("()=>{const r=document.querySelector('#sb253').getBoundingClientRect();return{l:Math.round(r.left),w:Math.round(r.width),side:getComputedStyle(document.querySelector('#side')).display,bd:getComputedStyle(document.querySelector('#sb253bd')).display}}")
    await pg.click('#sb253 [data-go="image"]'); await pg.wait_for_timeout(600)   # (v262: Image is one tool — a plain item)
    s2 = await E("()=>({v:S.view,menu:document.body.classList.contains('menu82'),right:Math.round(document.querySelector('#sb253').getBoundingClientRect().right),page:document.documentElement.scrollWidth-innerWidth})")
    chk("phone: Menu opens the same grouped menu as a drawer; a tool opens and the drawer closes", s0 <= 0 and s1["l"] == 0 and s1["w"] >= 260 and s1["side"] == "none" and s1["bd"] == "block" and s2["v"] == "image" and not s2["menu"] and s2["right"] <= 0 and s2["page"] <= 0, [s0, s1, s2])
    chk("phone: no page errors", not errs, errs); await b.close()
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        await desktop(p, "en"); await desktop(p, "ar"); await phone(p)
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v253 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-1500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v253 OK")
