# v85: physics with MuJoCo on our server (since v86 it works inside the site: the 3D World and every video prompt — the old
# Physics page opens the 3D World; tests/v86_physics.mjs checks the video prompts).
# Checks the numbers against real physics: fall time √(2h/g) and impact speed √(2gh); the bounce follows the material
# (rubber > plastic > wood > steel); glass survives a 10 cm drop and breaks from 1 m; in water wood floats high, ice floats
# low, steel sinks; braking from 90 km/h ≈ 40 m on dry asphalt and much longer on snow; a car off a ramp is in the air;
# paper falls far slower than a ball (the ball ≈ no air at all); a flag hangs in a calm and flies in a strong wind;
# a pushed person reacts (hands/hip/back first, never the head), from a height lands on the feet at √(2gh/…) timing,
# into water at √(2gh). Also: free (no credits), one run at a time, unknown scene refused, numbers clamped, words in both
# languages. The page: the old Physics address opens the 3D World with its physics on (computer and Arabic phone).
import asyncio, json, math, os, subprocess, tempfile, threading, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8186
PUB = os.environ.get("NOOI_PUBLIC", ROOT + "/public"); SERVER = os.environ.get("NOOI_SERVER", ROOT + "/server.js")
D = tempfile.mkdtemp(prefix="nooi-v85-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(PUB, D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
sim = lambda scene, **o: api("/v1/physics/simulate", {"scene": scene, "opts": o})
near = lambda a, b, tol: a is not None and abs(a - b) <= tol
def physics_checks():
    c0 = api("/v1/billing")["credits"]
    r = sim("objects", material="rubber", shape="ball", height=2); F = r.get("facts", {})
    ok(near(F.get("fallTime"), math.sqrt(4 / 9.81), 0.02) and near(F.get("impact"), math.sqrt(2 * 9.81 * 2), 0.3) and near(F.get("landedAt"), 0.639, 0.04), f"a 2 m drop takes √(2h/g) and hits at √(2gh) {F}")
    ok(near(F.get("bounceHeight"), 0.78 ** 2 * 2, 0.2) and F.get("bounces", 0) >= 3, f"a rubber ball bounces back to ~60% of the height, several times {F.get('bounceHeight')} {F.get('bounces')}")
    n = len([s for s in r.get("shapes", []) if s["i"] >= 0]); ok(r.get("frames") and all(len(f) == n * 7 for f in r["frames"]) and r.get("fps") == 30, "every frame has every moving shape (position + turn)")
    bh = {m: sim("objects", material=m, shape="ball", height=2).get("facts", {}).get("bounceHeight", 0) for m in ("rubber", "plastic", "wood", "metal")}; out["bounce"] = bh
    ok(bh["rubber"] > bh["plastic"] > bh["wood"] >= bh["metal"] - 0.01, f"the bounce follows the material {bh}")
    g1, g2 = sim("objects", material="glass", shape="box", height=0.1).get("facts", {}), sim("objects", material="glass", shape="box", height=1)
    ok(not g1.get("broke") and g2.get("facts", {}).get("broke") and any(e["type"] == "break" for e in g2.get("events", [])), f"glass survives 10 cm and breaks from 1 m {g1.get('broke')} {g2.get('facts', {}).get('broke')}")
    w = sim("water", items=["wood", "ice", "metal"], height=2).get("facts", {}); it = {x["material"]: x for x in w.get("items", [])}; out["water"] = it
    ok(it.get("wood", {}).get("floats") and 40 <= it["wood"].get("under", 0) <= 72 and it.get("ice", {}).get("floats") and it["ice"].get("under", 0) >= 75 and not it.get("metal", {}).get("floats") and w.get("splashes") == 3, f"wood floats high, ice floats low, steel sinks, three splashes {w}")
    a, s = sim("car", action="brake", speed=90, surface="asphalt").get("facts", {}), sim("car", action="brake", speed=90, surface="snow").get("facts", {}); out["brake"] = [a.get("stopDist"), s.get("stopDist")]
    ok(30 <= (a.get("stopDist") or 0) <= 50 and (s.get("stopDist") or 0) > 2 * (a.get("stopDist") or 99) and a.get("noseDip", 0) > 0.5, f"braking from 90 km/h: ~40 m dry, much longer on snow, the nose dips {a} {s}")
    j = sim("car", action="jump", speed=80); jf = j.get("facts", {}); ev = [e["type"] for e in j.get("events", [])]
    ok("airborne" in ev and "land" in ev and jf.get("airTime", 0) > 0.5 and jf.get("jumpLen", 0) > 8, f"a car off a ramp flies and lands {jf}")
    p = sim("air", mode="paper", height=2.5).get("facts", {}); out["paper"] = p
    ok(near(p.get("ball"), p.get("vacuum", 0), 0.06) and (p.get("paper") or 99) > 2 * (p.get("ball") or 1), f"paper falls far slower than a ball {p}")
    f1, f2 = sim("air", mode="flag", wind=2).get("facts", {}), sim("air", mode="flag", wind=12).get("facts", {})
    ok(f1.get("extended", 1) < 0.6 and f2.get("extended", 0) > 0.85, f"a flag hangs in a calm and flies in a strong wind {f1} {f2}")
    for frm in ("front", "back", "left"):
        b = sim("body", action="push", **{"from": frm}).get("facts", {})
        ok(b.get("ground") and b["ground"] < 2.5 and b.get("first") in ("hand", "hip", "back", "arm"), f"a person pushed from the {frm} reacts and falls (hands, hip or back first — not the head) {b}")
    h = sim("body", action="fall", height=3).get("facts", {})
    ok(near(h.get("feet"), math.sqrt(2 * 3 / 9.81), 0.06) and near(h.get("landSpeed"), math.sqrt(2 * 9.81 * 3), 0.4), f"from 3 m a person lands on the feet after √(2h/g) at √(2gh) {h}")
    wb = sim("body", action="water", height=3); wf = wb.get("facts", {})
    ok(near(wf.get("splash"), math.sqrt(2 * 9.81 * 3), 0.4) and (wf.get("deepest") or 0) < -0.3 and wb.get("water"), f"into water at √(2gh), and under the surface {wf}")
    ok(all(x.get("words", {}).get("en") and any("؀" <= ch <= "ۿ" for ch in x.get("words", {}).get("ar", "")) for x in (r, g2, wb, j)), "a sentence in English and Arabic for every scene")
    bad = api("/v1/physics/simulate", {"scene": "rocket", "opts": {}}); big = sim("objects", material="stone", height=999, count=99)
    ok(bad.get("_status") == 400 and big.get("facts", {}).get("height") == 10 and big.get("facts", {}).get("count") == 6, f"unknown scene refused, numbers kept in range {bad} {big.get('facts')}")
    res = {}
    def one(k): res[k] = sim("air", mode="flag", wind=9)
    ts = [threading.Thread(target=one, args=(k,)) for k in range(2)]; [t.start() for t in ts]; [t.join() for t in ts]
    ok(sorted(1 if v.get("_status") == 429 else 0 for v in res.values()) == [0, 1], f"one simulation at a time per person {[v.get('_status') for v in res.values()]}")
    ok(api("/v1/billing")["credits"] == c0, "physics is free — no credits")
    # ChatGPT / Claude (MCP): the same physics as a tool
    tok = api("/v1/tokens", {"name": "assistant"}).get("token")
    req = urllib.request.Request(f"http://localhost:{PORT}/mcp", data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "nooi_physics", "arguments": {"scene": "car", "options": {"action": "brake", "speed": 100, "surface": "wet"}}}}).encode(), headers={"content-type": "application/json", "authorization": "Bearer " + str(tok)})
    try: mres = json.loads(urllib.request.urlopen(req, timeout=60).read()); mt = json.loads(mres["result"]["content"][0]["text"])
    except Exception as e: mt = {"error": str(e)[:200]}
    ok(mt.get("scene") == "car" and (mt.get("facts", {}).get("stopDist") or 0) > 40 and "brakes" in mt.get("sentence", ""), f"ChatGPT / Claude can ask the physics (MCP nooi_physics) {str(mt)[:200]}")
    def mcall(args):
        rq = urllib.request.Request(f"http://localhost:{PORT}/mcp", data=json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "nooi_physics", "arguments": args}}).encode(), headers={"content-type": "application/json", "authorization": "Bearer " + str(tok)})
        try: rr = json.loads(urllib.request.urlopen(rq, timeout=60).read())["result"]; return {"err": bool(rr.get("isError")), "text": rr["content"][0]["text"]}
        except Exception as e: return {"err": True, "text": "stopped: " + str(e)[:160]}
    m1 = mcall({"scene": "rocket"}); m2 = mcall({"scene": "objects", "options": {"note": "x" * 3000}})
    ok(m1["err"] and "Pick a scene" in m1["text"] and m2["err"] and "Too many options" in m2["text"], f"ChatGPT / Claude: unknown scene and oversized options refused like on the page {m1} {m2}")
    mres2 = {}
    def mone(k): mres2[k] = mcall({"scene": "air", "options": {"mode": "flag", "wind": 9}})
    ts = [threading.Thread(target=mone, args=(k,)) for k in range(2)]; [t.start() for t in ts]; [t.join() for t in ts]
    ok(sorted(1 if "One simulation at a time" in v["text"] else 0 for v in mres2.values()) == [0, 1], f"ChatGPT / Claude: one simulation at a time per person too {[v['text'][:40] for v in mres2.values()]}")
async def browser_checks():
    SET = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'Sara',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}"
    async def until(pg, js, sec=40):
        for _ in range(sec * 4):
            try:
                if await pg.evaluate(js): return True
            except Exception: pass
            await asyncio.sleep(.25)
        return False
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for W, lang in ((1280, "en"), (390, "ar")):
            mob = W < 600; pg = await (await b.new_context(viewport={"width": W, "height": 880}, is_mobile=mob, has_touch=mob)).new_page()
            errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
            await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await pg.evaluate(SET, lang)
            await pg.evaluate("()=>go('physics')")
            ok(await until(pg, "()=>S.view==='world'&&typeof NW!=='undefined'&&!!NW.W&&!NW.busy"), f"{lang} {W}: the old Physics page opens the 3D World")
            r = await pg.evaluate("()=>[!!NW.W.physics,NW.W.stats().physics,!!document.querySelector('.hubtabs [data-go=physics]')]")
            ok(r == [True, True, False], f"{lang} {W}: physics runs inside the world, no Physics tab {r}")
            g = await pg.evaluate("()=>{const c=AI_PROVIDERS.find(p=>p[0]==='gemma');return {card:!!c&&c[4].map(f=>f[0]).join(','),health:HEALTH_KEYS.some(h=>h[0]==='gemma'),order:AI_PROVIDERS.findIndex(p=>p[0]==='gemma')<AI_PROVIDERS.findIndex(p=>p[0]==='localtext')}}")
            ok(g["card"] == "apiKey,model,thinking,use" and g["health"] and g["order"], f"{lang} {W}: Admin has the Gemma 4 · Google AI Studio card (key, model, thinking, on/off) and its status row {g}")
            ok(not errs, f"{lang}: page errors {errs[:3]}")
        await b.close()
srv = subprocess.Popen(["node", SERVER], cwd=D, env=dict({k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "LOCAL_LLM", "PIPER"))},
    PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
try:
    for _ in range(60):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
        except Exception: time.sleep(.5)
    t0 = time.time(); physics_checks(); out["apiSeconds"] = round(time.time() - t0, 1)
    try: asyncio.run(browser_checks())
    except Exception as e: fails.append("browser checks stopped: " + str(e)[:300])
finally:
    srv.terminate()
    try: out["serverLog"] = srv.stderr.read().decode()[-800:]
    except Exception: pass
print(json.dumps({"fails": fails, **out}, ensure_ascii=False, indent=1))
