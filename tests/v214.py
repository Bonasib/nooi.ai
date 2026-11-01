# v214 — the realism ceiling raised: up to FOUR real 3D objects per world, the fully-real path (World Labs / Marble) named
# under the Realistic look, smooth ground and soft leaf masses on every tier (the faceted look read as "shapeless" on phones).
# Run: python3 tests/v214.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8685; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v214-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))

src = open(ROOT + "/public/index.html", encoding="utf-8").read()
chk("up to four real 3D objects (both prices and the maker)", src.count("slice(0,4)") >= 3 and "nwHeroish(x.o)).slice(0,4)" in src)
chk("the fully-real path (World Labs / Marble) is named, EN+AR, both notes", src.count("World Labs (Marble) key in Admin") == 2 and src.count("أضف مفتاح World Labs (Marble)") == 2)
ter = open(ROOT + "/public/world/terrain.js", encoding="utf-8").read()
chk("the ground shades smooth on every tier", 'flatShading: tier.name === "low"' not in ter)
chk("leaf masses are welded smooth", "smooth = 0" in open(ROOT + "/public/world/assets.js", encoding="utf-8").read())

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1100, "height": 760}); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
        await pg.evaluate("()=>{S.langAsked=true;S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('en');document.getElementById('modalRoot').innerHTML='';go('world');renderAll()}")
        await pg.wait_for_timeout(500)
        r = await pg.evaluate("""async()=>{const M=await nwMods();NW.caps={ai:false,vision:false,worldlabs:false,objects3d:true,images:true,pano:true,cost:{plan:1}};
          S.world.plan={place:'meadow',objects:[{type:'car'},{type:'garage'},{type:'statue'},{type:'boat'},{type:'castle'},{type:'tree'}]};
          const outdoor=nwRealCost(),one=nwObjCost(),pano=nwPanoCost(),part=nwPartCost91(),bb=nwBbN91();
          S.world.plan={place:'room',room:'living',objects:[{type:'car'},{type:'statue'},{type:'leak'}]};
          const room=nwRealCost();return{outdoor,room,one,pano,part,bb}}""")
        chk("the outdoor price counts four real objects", r["outdoor"] == r["pano"] + r["part"] * (1 + r["bb"]) + 4 * r["one"], r)
        chk("a room pays for its real objects only — no panorama", r["room"] == 2 * r["one"], r)
        chk("no page errors", not errs, errs)
        await b.close()
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:3000])
print("v214 OK" if not fails else "v214 FAIL")
sys.exit(1 if fails else 0)
