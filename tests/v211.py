# v211 — the 3D World reads a garage and an old car, and says what it could not read.
#  · plan.js: garage / workshop (EN+AR) is a real type; "old / classic / vintage / rusty" vehicles carry era / rust; a lone
#    building or vehicle stands on flat ground; "a garage with a car" parks the car inside, nose out at the door
#  · assets.js: the garage model (open front, rolled door, workbench, tyres, a light) and the classic car (fenders, chrome,
#    round lights, whitewalls; rust freckles when asked); parked-car colours are sober — no purple default
#  · the world built in the browser holds the garage at its spot and the car as a mover; no page errors
#  · a word the free reader can't use (a dragon…) is named under the world instead of vanishing silently
# Run: python3 tests/v211.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8678; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v211-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))

# ---- 1. the plan, without a browser (node) ----
NODE = """
import { localPlan, cleanPlan, editPlan, describePlan, TYPES, missedWords } from "%s/public/world/plan.js";
const o = [];
const g = localPlan("a garage with an old car in a meadow");
o.push(["garage is a building", TYPES.garage && TYPES.garage.c === "building"]);
o.push(["garage + classic car", JSON.stringify(g.objects.map(x => [x.type, x.era || "", x.rust || false]))]);
o.push(["parked inside, nose out", JSON.stringify([g.objects[0].at, g.objects[1].at, g.objects[1].rot])]);
o.push(["flat ground for a lone castle", localPlan("a huge castle").terrain.shape]);
o.push(["nothing missed", (g.missed || []).length === 0]);
o.push(["describe says classic", g.describe]);
const a = localPlan("\\u0642\\u0631\\u064a\\u0629 \\u0641\\u064a\\u0647\\u0627 \\u0643\\u0631\\u0627\\u062c \\u0648\\u0633\\u064a\\u0627\\u0631\\u0629 \\u0642\\u062f\\u064a\\u0645\\u0629");
o.push(["Arabic garage + old car", JSON.stringify(a.objects.filter(x=>["garage","car"].includes(x.type)).map(x => [x.type, x.era || ""]))]);
const r = localPlan("a rusty abandoned truck in the desert");
o.push(["rusty truck in the desert", JSON.stringify([r.place, r.objects.map(x => [x.type, x.rust || false])])]);
const m = localPlan("a flying dragon lands near the castle");
o.push(["dragon reported, castle kept", JSON.stringify([m.missed, m.objects.map(x => x.type)])]);
const w = localPlan("car workshop by the beach at sunset");
o.push(["workshop = garage, no shop double", JSON.stringify([w.objects.map(x => x.type), Math.round(w.time)])]);
const c = cleanPlan({ objects: [{ type: "car", era: "classic", rust: 1 }, { type: "car", era: "evil" }] });
o.push(["cleanPlan keeps classic, drops junk", JSON.stringify(c.objects.map(x => [x.era || "", x.rust || false]))]);
const e = editPlan(g, "make it night");
o.push(["editPlan still works", !!e && e.time > 21]);
console.log(JSON.stringify(o));
""" % ROOT
r = subprocess.run(["node", "--input-type=module", "-e", NODE], capture_output=True, text=True, timeout=60)
try: plan = dict((x[0], x[1]) for x in json.loads(r.stdout.strip().splitlines()[-1]))
except Exception: plan = {}; chk("node plan checks ran", False, (r.stdout[-300:], r.stderr[-300:]))
if plan:
    out["plan"] = plan
    chk("garage is a building type", plan.get("garage is a building") is True)
    chk("garage + classic car found", plan.get("garage + classic car") == '[["garage","",false],["car","classic",false]]', plan)
    chk("the car parks inside the garage, nose out", plan.get("parked inside, nose out") == "[[0,-6],[0,-4.5],6]", plan)
    chk("a lone building stands on flat ground", plan.get("flat ground for a lone castle") == "flat", plan)
    chk("every word of the garage prompt is used", plan.get("nothing missed") is True, plan)
    chk("the description says a classic car", "classic car" in str(plan.get("describe says classic")), plan)
    chk("Arabic: a workshop with an old car", plan.get("Arabic garage + old car") == '[["garage",""],["car","classic"]]', plan)
    chk("a rusty truck stays rusty, the desert stays", plan.get("rusty truck in the desert") == '["desert",[["truck",true]]]', plan)
    dm = json.loads(plan.get("dragon reported, castle kept") or "[[],[]]")
    chk("a dragon is reported as not read, the castle is built", "dragon" in dm[0] and "castle" in dm[1], plan)
    ws = json.loads(plan.get("workshop = garage, no shop double") or "[[],0]")
    chk("a car workshop is a garage (a car with it) at sunset", ws[0] == ["garage", "car"] and ws[1] == 18, plan)
    chk("cleanPlan keeps classic and rust, drops junk eras", plan.get("cleanPlan keeps classic, drops junk") == '[["classic",true],["",false]]', plan)
    chk("editPlan still edits the plan", plan.get("editPlan still works") is True)
src = open(ROOT + "/public/world/assets.js", encoding="utf-8").read()
chk("assets: a garage model and a classic car exist", 'case "garage"' in src and 'opt.era === "classic"' in src and "#5a2f80" not in src)
chk("the AI plan schema teaches era and rust", '"era":"classic' in open(ROOT + "/lib/world.js", encoding="utf-8").read())

# ---- 2. the world in the browser ----
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
        r = await pg.evaluate("""async()=>{const M=await nwMods();await nwBuild(M.localPlan('a garage with an old car in a meadow'));const W=NW.W;
          return{built:!!W,garage:(W.info||[]).filter(x=>x.type==='garage').map(x=>[Math.round(x.x),Math.round(x.z)]),movers:W.stats().movers,note:!!document.querySelector('.nw211')}}""")
        chk("the world builds with the garage at its spot", r["built"] and r["garage"] == [[0, -6]] and r["movers"] >= 1, r)
        chk("no missing-words note when every word is read", not r["note"], r)
        r = await pg.evaluate("""async()=>{const M=await nwMods();await nwBuild(M.localPlan('a flying dragon lands near the castle'));nwRefresh();
          await new Promise(q=>setTimeout(q,300));const n=document.querySelector('.nw211');return{note:n?n.textContent:'',castle:(NW.W.info||[]).some(x=>x.type==='castle')}}""")
        chk("the dragon is named under the world, the castle is built", "dragon" in r["note"] and r["castle"], r)
        chk("no page errors", not errs, errs)
        await b.close()
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:4000])
print("v211 OK" if not fails else "v211 FAIL")
sys.exit(1 if fails else 0)
