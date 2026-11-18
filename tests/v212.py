# v212 — a garage prompt builds the garage ROOM, the subject stays the subject, and nothing needs a GPU.
#  · "garage with old car" (EN/AR) → an indoor concrete room: roller door, workbench, toolbox, crates, barrels, tyres, a side
#    window — and the old car inside, slightly turned. No meadow, no forest around the subject.
#  · "tools / عدة" adds a toolbox; tyres is a type too; a garage named WITH a place (a village, a meadow) stays an outdoor building
#  · a lone outdoor subject gets flat ground and only a few plants (dress 0.25) — never a forest around a garage
#  · no GPU anywhere: a software renderer gets its own smaller tier (engine.js), and the Realistic note says the AI parts are
#    made by the cloud engines (NVIDIA · Google · the image engine) — no graphics card on the device or the server
# Run: python3 tests/v212.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8681; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v212-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))

# ---- 1. the plan (node) ----
NODE = """
import { localPlan, TYPES, ROOMS } from "%s/public/world/plan.js";
const o = [];
const g = localPlan("garage with old car");
o.push(["room garage", JSON.stringify([g.place, g.room])]);
o.push(["the car inside, turned", JSON.stringify(g.objects.map(x => [x.type, x.era || "", x.at, x.rot]))]);
const t = localPlan("garage with an old car and some tools");
o.push(["tools add a toolbox", JSON.stringify(t.objects.map(x => x.type))]);
const a = localPlan("\\u0648\\u0631\\u0634\\u0629 \\u0641\\u064a\\u0647\\u0627 \\u0633\\u064a\\u0627\\u0631\\u0629 \\u0642\\u062f\\u064a\\u0645\\u0629 \\u0648\\u0639\\u062f\\u0629");
o.push(["Arabic workshop room", JSON.stringify([a.place, a.room, a.objects.map(x => [x.type, x.era || ""])])]);
const v = localPlan("a village with a garage");
o.push(["a garage WITH a place stays outdoors", JSON.stringify([v.place, v.objects.map(x => x.type)])]);
const c = localPlan("a huge castle");
o.push(["a lone subject: flat and few plants", JSON.stringify([c.terrain.shape, c.dress])]);
o.push(["types exist", TYPES.toolbox && TYPES.toolbox.c === "prop" && TYPES.tyres && ROOMS.includes("garage")]);
console.log(JSON.stringify(o));
""" % ROOT
r = subprocess.run(["node", "--input-type=module", "-e", NODE], capture_output=True, text=True, timeout=60)
try: plan = dict((x[0], x[1]) for x in json.loads(r.stdout.strip().splitlines()[-1]))
except Exception: plan = {}; chk("node plan checks ran", False, (r.stdout[-300:], r.stderr[-300:]))
if plan:
    out["plan"] = plan
    chk("a garage prompt is the garage room", plan.get("room garage") == '["room","garage"]', plan)
    chk("the old car is inside, slightly turned", plan.get("the car inside, turned") == '[["car","classic",[0,-0.4],14]]', plan)
    chk("'some tools' adds a toolbox", plan.get("tools add a toolbox") == '["car","toolbox"]', plan)
    chk("Arabic: a workshop room with the old car and tools", plan.get("Arabic workshop room") == '["room","garage",[["car","classic"],["toolbox",""]]]', plan)
    chk("a garage named with a village stays an outdoor building", plan.get("a garage WITH a place stays outdoors") == '["village",["garage"]]', plan)
    chk("a lone subject stands on flat ground with few plants", plan.get("a lone subject: flat and few plants") == '["flat",0.25]', plan)
    chk("toolbox and tyres are real types, garage a room", plan.get("types exist") is True, plan)
eng = open(ROOT + "/public/world/engine.js", encoding="utf-8").read()
chk("no-GPU mode: a software renderer gets its own smaller tier", "info.soft && !opts.tier" in eng and "0.45" in eng)
chk("the garage room is furnished and dressed in concrete", 'garage: [["desk"' in open(ROOT + "/public/world/world.js", encoding="utf-8").read())
chk("assets: toolbox and tyres are modelled", 'case "toolbox"' in open(ROOT + "/public/world/assets.js", encoding="utf-8").read())
chk("the AI plan knows the garage room rule", 'room "garage"' in open(ROOT + "/lib/world.js", encoding="utf-8").read())
src = open(ROOT + "/public/index.html", encoding="utf-8").read()
chk("the Realistic note says no graphics card is needed", src.count("no graphics card is needed on your device or your server") == 2 and src.count("لا حاجة لبطاقة رسومات على جهازك أو خادمك") == 2)

# ---- 2. the room in the browser ----
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
        r = await pg.evaluate("""async()=>{const M=await nwMods();await nwBuild(M.localPlan('garage with an old car and some tools'));const W=NW.W;
          const types=(W.info||[]).map(x=>x.type);return{place:W.stats().place,movers:W.stats().movers,bench:types.includes('desk'),win:types.includes('window'),
          plants:W.plantTypes().length,trees:types.filter(t=>['tree','pine','palm','bush'].includes(t)).length,soft:NW.E.info.soft,tier:NW.E.tier.name,far:NW.E.tier.far}}""")
        chk("the garage room is built indoors with the bench and window", r["place"] == "room" and r["bench"] and r["win"], r)
        chk("the car and the loose tools are there to push around", r["movers"] >= 5, r)
        chk("no forest around the subject — no trees indoors at all", r["plants"] == 0 and r["trees"] == 0, r)
        chk("a software renderer runs the lighter no-GPU tier", (not r["soft"]) or (r["tier"] == "low" and r["far"] <= 190), r)
        chk("no page errors", not errs, errs)
        await b.close()
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:4000])
print("v212 OK" if not fails else "v212 FAIL")
sys.exit(1 if fails else 0)
