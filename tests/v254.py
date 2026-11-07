# v254 — the owner: "lenses + directing options + time-period options". A real nooi server and a browser, nooi Studio (Video):
#  · more cameras (70 mm, Super 8, 90s camcorder), lenses (11+: tilt-shift, fisheye, swirl bokeh, halation, …), 8 mm, f/4
#  · a Directing chip: shot size, camera angle, pace, composition, directing style — each a tile with its drawing, Auto first
#  · an Era chip: ancient world … far future, with Arabian heritage and the Islamic golden age
#  · what's picked becomes fixed wording added to the shot the engine receives; the job keeps the client's own words as its title
#  · the chips sit in the bar's row, nothing wider than the screen (computer and phone), Arabic labels, no page errors
# Run: python3 tests/v254.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8773; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v254-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1500]))
SETUP = "([v,l])=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.draft.cine93={};go(v);renderAll()}"
async def run(p, lang, phone=False):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]) if phone else await b.new_context(viewport={"width": 1440, "height": 900})
    pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await E(SETUP, ["video", lang]); await pg.wait_for_timeout(700)
    tag = ("phone " if phone else "computer ") + lang
    lists = await E("()=>({cam:CIN82.cam.length,lens:CIN82.lens.length,focal:CIN82.focal.map(x=>x[0]),ap:CIN82.ap.map(x=>x[0]),shot:CIN82.shot.length,angle:CIN82.angle.length,pace:CIN82.pace.length,comp:CIN82.comp.length,dstyle:CIN82.dstyle.length,era:CIN82.era.map(x=>x[0])})")
    if not phone and lang == "en":
        chk("more cameras, lenses (11+), 8 mm and f/4", lists["cam"] >= 8 and lists["lens"] >= 11 and 8 in lists["focal"] and "4" in lists["ap"], lists)
        chk("directing lists and eras (Arabian heritage, Islamic golden age, decades, future)", lists["shot"] >= 6 and lists["angle"] >= 7 and lists["pace"] >= 4 and lists["comp"] >= 5 and lists["dstyle"] >= 6 and {"heritage", "golden", "d1920", "d1980", "farfuture", "ancient"} <= set(lists["era"]), lists)
    chips = await E("()=>[...document.querySelectorAll('#main [data-o93]')].map(c=>c.dataset.o93+'='+c.querySelector('.o93t').textContent+':'+c.querySelector('.o93v').textContent)")
    has = lambda k: any(c.startswith(k + "=") for c in chips)
    chk(f"{tag}: Directing and Era chips in the bar (Auto at first)", has("dir254") and has("era254") and any(c.startswith("dir254=") and c.endswith(("Auto", "تلقائي")) for c in chips), chips)
    await E("()=>{const c=document.querySelector('#main [data-o93=\"dir254\"]');c.scrollIntoView({block:'nearest',inline:'center'})}")
    await pg.click('#main [data-o93="dir254"]', force=True); await pg.wait_for_timeout(250)
    sec = await E("()=>{const s=document.getElementById('sec93-dir254');if(!s||s.hidden)return null;return{lbl:[...s.querySelectorAll('.lbl')].map(x=>x.textContent),tiles:s.querySelectorAll('.tile').length,first:s.querySelector('.tile .lb').textContent,svg:[...s.querySelectorAll('.tile .gl svg')].length}}")
    chk(f"{tag}: Directing opens shot size, angle, pace, composition and style tiles (each with its drawing, Auto first)", sec and len(sec["lbl"]) == 5 and sec["tiles"] >= 35 and sec["svg"] == sec["tiles"] and sec["first"] in ("Auto", "تلقائي"), sec)
    for k, v in (("angle", "low"), ("shot", "close"), ("dstyle", "epic")):
        await pg.click(f'#sec93-dir254 [data-set="draft.cine93.{k}"][data-val="{v}"]', force=True); await pg.wait_for_timeout(250)
    await E("()=>{const c=document.querySelector('#main [data-o93=\"era254\"]');c.scrollIntoView({block:'nearest',inline:'center'})}")
    await pg.click('#main [data-o93="era254"]', force=True); await pg.wait_for_timeout(250)
    await pg.click('#sec93-era254 [data-set="draft.cine93.era"][data-val="heritage"]', force=True); await pg.wait_for_timeout(300)
    st = await E("()=>({c:S.draft.cine93,words:cineWords93(),dir:document.querySelector('#main [data-o93=\"dir254\"] .o93v').textContent,era:document.querySelector('#main [data-o93=\"era254\"] .o93v').textContent,page:document.documentElement.scrollWidth-innerWidth})")
    chk(f"{tag}: the picks are kept and shown on the chips; nothing wider than the screen", st["c"].get("angle") == "low" and st["c"].get("era") == "heritage" and st["page"] <= 0 and st["dir"] not in ("Auto", "تلقائي") and st["era"] in ("Arabian heritage", "التراث العربي"), st)
    if not phone and lang == "en":
        w = st["words"]
        chk("the engine gets fixed wording for each pick (angle, shot, style, era)", "low angle looking up" in w.lower() and "close-up on the face" in w.lower() and "epic large-scale directing" in w and "mud-brick Najdi houses" in w, w)
        j = await E("""()=>{S.draft.prompt='A falcon lands on a gloved hand';S.credits=999;const n=S.jobs.length;makeVideo();const j=S.jobs[S.jobs.length-1];return S.jobs.length>n?{p:j.prompt,t:j.title,meta:j.meta&&j.meta.cinema}:null}""")
        chk("the job carries the wording; its title stays the client's own words", j and "A falcon lands on a gloved hand" in j["p"] and "mud-brick Najdi houses" in j["p"] and "low angle" in j["p"] and j["t"].startswith("A falcon") and (j["meta"] or {}).get("era") == "heritage", j)
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
if fails: print("v254 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-1500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v254 OK")
