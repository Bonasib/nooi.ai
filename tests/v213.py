# v213 — "a small leak inside a house" is a ROOM with a real leak, and no outdoor panorama is pasted indoors.
#  · "inside a house / home / apartment" (EN/AR) → the room itself (living, or the room named: kitchen…); the house building
#    is never an object standing inside its own room
#  · "leak / drip / تسريب / دلف" is a real thing: a damp ceiling patch, a line of falling drops, the puddle, a bucket with a
#    handle; "a small leak" stays ceiling-to-floor (scale pinned to 1)
#  · the Realistic pass for an indoor room orders NO 360° outdoor panorama (that was the pasted-picture look) — only real 3D
#    objects; the price says so and the empty case explains itself
# Run: python3 tests/v213.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8683; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v213-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))

NODE = """
import { localPlan, TYPES } from "%s/public/world/plan.js";
const o = [];
const g = localPlan("a small leak inside a house");
o.push(["room with the leak", JSON.stringify([g.place, g.room, g.objects.map(x => [x.type, x.scale])])]);
const a = localPlan("\\u062a\\u0633\\u0631\\u064a\\u0628 \\u0645\\u0627\\u0621 \\u062f\\u0627\\u062e\\u0644 \\u0627\\u0644\\u0628\\u064a\\u062a");
o.push(["Arabic leak room", JSON.stringify([a.place, a.room, a.objects.map(x => x.type), a.missed || []])]);
const k = localPlan("a water leak in the kitchen inside our home");
o.push(["the named room wins", JSON.stringify([k.place, k.room, k.objects.map(x => x.type)])]);
const h = localPlan("a house with a red roof");
o.push(["a house outdoors stays a house", JSON.stringify([h.place, h.objects.map(x => x.type)])]);
o.push(["leak is a type", TYPES.leak && TYPES.leak.c === "prop" && TYPES.leak.s[1] === 3]);
console.log(JSON.stringify(o));
""" % ROOT
r = subprocess.run(["node", "--input-type=module", "-e", NODE], capture_output=True, text=True, timeout=60)
try: plan = dict((x[0], x[1]) for x in json.loads(r.stdout.strip().splitlines()[-1]))
except Exception: plan = {}; chk("node plan checks ran", False, (r.stdout[-300:], r.stderr[-300:]))
if plan:
    out["plan"] = plan
    chk("a small leak inside a house = a living room with one whole leak", plan.get("room with the leak") == '["room","living",[["leak",1]]]', plan)
    chk("Arabic: the leak room, every word used", plan.get("Arabic leak room") == '["room","living",["leak"],[]]', plan)
    chk("the named room wins (kitchen)", plan.get("the named room wins") == '["room","kitchen",["leak"]]', plan)
    chk("a house outdoors stays a house (on the stage since v215: no place named)", plan.get("a house outdoors stays a house") == '["stage",["house"]]', plan)
    chk("leak is a ceiling-height prop type", plan.get("leak is a type") is True, plan)
chk("assets: the leak is modelled", 'case "leak"' in open(ROOT + "/public/world/assets.js", encoding="utf-8").read())
chk("the AI plans learn the same rules", '"leak"' in open(ROOT + "/lib/world.js", encoding="utf-8").read())
src = open(ROOT + "/public/index.html", encoding="utf-8").read()
chk("no panorama is ordered for a room (v216: a stage with a reference photo still gets the sky that continues the photo)", '(nwIn215(plan)&&!(file&&plan.place==="stage"))?null:withRef72("iRef"' in src and src.count('nwIn215(S.world.plan)') >= 3 and 'p.place==="room"||p.place==="stage"' in src)

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1100, "height": 760}); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
        await pg.evaluate("()=>{S.langAsked=true;S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('en');document.getElementById('modalRoot').innerHTML='';go('world');renderAll()}")
        await pg.wait_for_timeout(600)
        r = await pg.evaluate("""async()=>{const M=await nwMods();await nwBuild(M.localPlan('a small leak inside a house'));const W=NW.W;
          const types=(W.info||[]).map(x=>x.type);return{place:W.stats().place,leak:types.includes('leak'),sofa:types.includes('sofa'),
          trees:types.filter(t=>['tree','pine','palm','bush','house'].includes(t)).length,cost:nwRealCost(),caps:!!(NW.caps&&NW.caps.objects3d)}}""")
        chk("the room is built with the leak and the furniture, nothing pasted", r["place"] == "room" and r["leak"] and r["sofa"] and r["trees"] == 0, r)
        chk("the Realistic price for a room has no panorama in it", r["caps"] or r["cost"] == 0, r)
        chk("no page errors", not errs, errs)
        await b.close()
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:4000])
print("v213 OK" if not fails else "v213 FAIL")
sys.exit(1 if fails else 0)
