# v272 — the customer's model is the model: no backup engine anywhere on the site (a failed job fails, every credit back, nothing
# moved to another engine), a picked model the site can't make on its own engine is refused before anything is charged, and nooi
# Auto is the only choice the site makes: the agents write the video as scenes and each scene gets the strong engine (action,
# visual effects) or the light one (calm), the price shown first as the most it can be and lowered to what the scenes use.
# Run: python3 tests/v272.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8815, 8816; B = f"http://localhost:{PORT}"; M = f"http://127.0.0.1:{MP}"
D = tempfile.mkdtemp(prefix="nooi-v272-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=320x180:r=24:d=5", "-f", "lavfi", "-i", "sine=f=440:d=5", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", D + "/res.mp4"], check=True, timeout=90, stdin=subprocess.DEVNULL)
json.dump({"users": {"dev_someone": {"plan": "studio", "planUntil": 4102444800000, "credits": 9000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
ST = {"bp": [], "mm": [], "llm": 0}
PLAN = {"title": "The letter", "bible": "A woman in a blue dress, an old stone house, morning light.", "shots": [
    {"shot": "A woman in a blue dress reads a letter by the window of an old stone house", "cam": "A", "power": "light"},
    {"shot": "A dragon smashes through the stone wall breathing fire as debris flies", "cam": "B", "power": "strong"},
    {"shot": "She steps outside into the quiet morning garden and smiles", "cam": "A", "power": "light"}]}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200, ct="application/json"):
        b = o if isinstance(o, bytes) else json.dumps(o).encode(); self.send_response(code); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/res.mp4": return self.send(open(D + "/res.mp4", "rb").read(), ct="video/mp4")
        if self.path.startswith("/api/v3/contents/generations/tasks/"): return self.send({"status": "succeeded", "content": {"video_url": M + "/res.mp4"}})
        if self.path.startswith("/v2/query/video_generation/"): return self.send({"task": {"status": "succeeded", "content": {"url": M + "/res.mp4"}}})
        return self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); b = json.loads(self.rfile.read(n) or b"{}"); txt = json.dumps(b)
        if self.path == "/api/v3/contents/generations/tasks":
            ST["bp"].append(b)
            if "FAILME" in txt: return self.send({"error": {"code": "InvalidParameter", "message": "The request failed because of the content", "type": "BadRequest"}}, 400)
            if "NOTON" in txt: return self.send({"error": {"code": "ModelNotOpen", "message": "Your account 1 has not activated the model " + b.get("model", ""), "type": "NotFound"}}, 404)
            return self.send({"id": "cgt-%d" % len(ST["bp"])})
        if self.path == "/v2/video_generation": ST["mm"].append(b); return self.send({"task_id": "h%d" % len(ST["mm"])})
        if self.path == "/v1/messages":
            ST["llm"] += 1; t = json.dumps(b)
            if "film crew making ONE continuous" in t: return self.send({"content": [{"type": "text", "text": json.dumps(PLAN)}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        return self.send({}, 404)
mk = ThreadingHTTPServer(("127.0.0.1", MP), H); threading.Thread(target=mk.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_", "FAL_", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", ADMIN_EMAILS="boss@dev.local",
    SEEDANCE_API_KEY="bd-test-key", SEEDANCE_BASE_URL=M + "/api/v3", LLM_API_KEY="mock", LLM_BASE_URL=M, LLM_MODEL="mock-text"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
def api(path, body=None, who="someone", method=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": who}, method=method or ("POST" if body is not None else "GET"))
    try: return json.loads(urllib.request.urlopen(r, timeout=60).read())
    except urllib.error.HTTPError as e: return {"err": e.code, "body": e.read().decode()[:400]}
def make(body, wait=True):
    b = {"kind": "video", "prompt": "A quiet street at dawn", "aspect": "16:9", "dur": 5, "count": 1}; b.update(body); r = api("/v1/jobs", b)
    if "err" in r or not wait: return r, {}
    jid = r.get("id"); j = {}
    for _ in range(120):
        time.sleep(0.6); j = next((x for x in (api("/v1/jobs").get("jobs") or []) if x.get("id") == jid), {})
        if j.get("status") in ("done", "failed"): break
    return r, j
credits = lambda: api("/v1/billing").get("credits")
BDS = {"seedance20": "dreamina-seedance-2-0-260128", "seedance": "dreamina-seedance-2-0-fast-260128", "seedance25": "dreamina-seedance-2-5-260628", "seedance2mini": "dreamina-seedance-2-0-mini-260615"}
async def page_check():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900}, extra_http_headers={"X-Dev-User": "someone"})).new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg&&API.cfg.auto272", timeout=20000)
        await pg.evaluate("()=>{S.langAsked=true;S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.hf.vModel='auto';S.hf.dur=15;persist();go('video');renderAll()}"); await pg.wait_for_timeout(900)
        await pg.fill('#dprompt', "A woman reads a letter, then a dragon breaks in"); await pg.wait_for_timeout(500)
        info = await pg.evaluate("()=>({plan:hfStudioPlanHTML().replace(/<[^>]+>/g,' ').replace(/\\s+/g,' '),cost:hfCost(),T:API.cfg.auto272})")
        posts = []; pg.on("request", lambda rq: rq.method == "POST" and rq.url.endswith("/v1/jobs") and posts.append(rq.post_data))
        await pg.click('#main [data-act="gen-video"]', force=True)
        for _ in range(40):
            await pg.wait_for_timeout(500)
            if posts: break
        sent = None
        if posts:
            b0 = json.loads(posts[0]); sent = {"model": b0.get("model"), "dur": b0.get("dur"), "pm": (b0.get("meta") or {}).get("partModels")}
        pg2 = await (await b.new_context(viewport={"width": 1440, "height": 900}, extra_http_headers={"X-Dev-User": "boss"})).new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg2.goto(B + "/"); await pg2.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await pg2.evaluate("()=>{S.langAsked=true;S.lang='en';S.user={name:'B',method:'google'};AU.showAuth=false;S.admTab='models';go('admin');renderAll()}")
        try: await pg2.wait_for_function("document.querySelectorAll('#main .auto272adm select').length===2", timeout=15000); adm = await pg2.evaluate("()=>({sel:[...document.querySelectorAll('#main .auto272adm select')].map(s=>s.value),txt:document.querySelector('#main .auto272adm').innerText.slice(0,300)})")
        except Exception as e: adm = {"err": str(e)[:200]}
        await b.close(); return info, sent, errs, adm
try:
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    api("/v1/admin/providers/minimax", {"apiKey": "mm-key", "baseUrl": M}, who="boss", method="PUT")
    # 1. a picked model that fails: failed, credits back, no other engine asked
    c0, b0, m0 = credits(), len(ST["bp"]), len(ST["mm"]); r, j = make({"model": "seedance20", "prompt": "FAILME a harbour at night"})
    chk("a picked model that fails → the job fails, every credit back", j.get("status") == "failed" and credits() == c0, [j.get("status"), c0, credits()])
    chk("…and no other engine is tried (Seedance asked once, MiniMax never)", len(ST["bp"]) - b0 == 1 and len(ST["mm"]) == m0, [len(ST["bp"]) - b0, len(ST["mm"]) - m0, j.get("errors")])
    # 2. a Seedance model not switched on: told plainly, no "nearest" model tried
    b0 = len(ST["bp"]); r, j = make({"model": "seedance20", "prompt": "NOTON a lighthouse in fog"})
    chk("a Seedance model not switched on → failed with that reason, no other Seedance model tried", j.get("status") == "failed" and len(ST["bp"]) - b0 == 1 and "switched on" in (j.get("error") or ""), [j.get("error"), [x.get("model") for x in ST["bp"][b0:]]])
    cfg = api("/v1/config").get("auto272") or {}
    chk("Auto stops using a model that isn't switched on", cfg.get("strong") and cfg.get("strong") != "seedance20", cfg)
    # 3. a picked model whose engine isn't connected → refused before anything is charged
    c0 = credits(); r, j = make({"model": "kling30"}, wait=False)
    chk("a picked model whose engine isn't connected → refused, nothing charged", "err" in r and credits() == c0, r)
    # 4. "Everything on MiniMax" on → a picked Seedance model is still made on Seedance
    api("/v1/admin/minimax183", {"all": True}, who="boss", method="PUT")
    b0, m0 = len(ST["bp"]), len(ST["mm"]); r, j = make({"model": "seedance", "prompt": "A cat on a sofa"})
    chk("'Everything on MiniMax' doesn't take a model the customer picked", j.get("status") == "done" and len(ST["bp"]) - b0 == 1 and len(ST["mm"]) == m0, [j.get("status"), len(ST["bp"]) - b0, len(ST["mm"]) - m0])
    api("/v1/admin/minimax183", {"all": False}, who="boss", method="PUT")
    T = api("/v1/config").get("auto272") or {}
    # 5. Auto, one scene: calm → the light engine; action → the strong one
    b0 = len(ST["bp"]); r, j = make({"model": "auto", "prompt": "A woman reads a book in a quiet cafe"})
    calm = [x.get("model") for x in ST["bp"][b0:]]
    b0 = len(ST["bp"]); r, j2 = make({"model": "auto", "prompt": "A car chase through the city ends in a huge explosion"})
    act = [x.get("model") for x in ST["bp"][b0:]]
    chk("Auto, a calm scene → the light engine; an action scene → the strong one", T and calm and act and calm[0] != act[0] and j.get("status") == "done" and j2.get("status") == "done", [T, calm, act])
    # 6. Auto, 15 s: the agents' scenes, each its engine; the hold lowered to what they use
    c0 = credits(); b0 = len(ST["bp"]); r, j = make({"model": "auto", "prompt": "A woman reads a letter, then a dragon breaks in", "dur": 15})
    models = [x.get("model") for x in ST["bp"][b0:]]
    pl = j.get("plan132") or {}
    pm = pl.get("models") or []; want = {BDS.get(m) for m in pm}
    chk("Auto, 15 s → three scenes from the agents, each on its engine (light · strong · light)", j.get("status") == "done" and pl.get("powers") == ["light", "strong", "light"] and len(pm) == 3 and pm[0] == pm[2] == T.get("light") and pm[1] == T.get("strong")
        and set(models) == want, [j.get("status"), pl.get("powers"), pm, T, models, j.get("error")])
    paid = (c0 or 0) - (credits() or 0)
    chk("…and the customer pays what the scenes used (less than three strong scenes)", 0 < paid < (r.get("cost") or 0) + 1 and paid == j.get("cost"), [paid, r.get("cost"), j.get("cost")])
    # 7. the owner names Auto's engines in Admin; a customer can't
    r = api("/v1/admin/auto272", {"strong": "seedance25", "light": "seedance"}, who="boss", method="PUT")
    chk("the owner names Auto's strong and light engines", (r.get("now") or {}).get("strong") == "seedance25" and (r.get("now") or {}).get("light") == "seedance" and (api("/v1/config").get("auto272") or {}).get("strong") == "seedance25", r)
    chk("a customer can't change them", api("/v1/admin/auto272", {"strong": "kling30"}, method="PUT").get("err") in (401, 403))
    chk("a made-up model name is refused", api("/v1/admin/auto272", {"strong": "../x"}, who="boss", method="PUT").get("err") == 400)
    info, sent, errs, adm = asyncio.run(page_check())
    chk("Admin shows the nooi Auto box with the two engines chosen", adm.get("sel") == ["seedance25", "seedance"] and "never switches engines" in adm.get("txt", ""), adm)
    chk("the page shows Auto's two engines and what each is for", "Action · VFX" in info["plan"] and "Calm" in info["plan"], info)
    chk("the page sends 'auto' (the server plans the scenes), with the most it can cost shown", sent and sent.get("model") == "auto" and not sent.get("pm") and info["cost"] and info["cost"] > 0, [sent, info.get("cost")])
    chk("no page errors", not errs, errs)
finally:
    srv.terminate(); mk.shutdown(); log = open(D + "/srv.log").read(); shutil.rmtree(D, ignore_errors=True)
print("FAIL\n- " + "\n- ".join(fails) + "\nserver log: " + log[-1200:] if fails else "v272: no backup engines; the customer's model is the model; Auto picks per scene — all checks passed")
sys.exit(1 if fails else 0)
