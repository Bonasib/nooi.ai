# v155 "check how the prompt is built — the results are very different from what was asked + a hang: the clip finished and I
# watched it in Video, but Home still shows the agents searching". A real nooi server, a stand-in engine and a stand-in text AI
# that record everything, and the page on a phone:
#  · a job the page sent but never heard back about (the phone closed the page mid-send) finds its job on the server by the page's
#    own id (cid, now in the server's list): it takes the job's state, the library sync's extra copy goes, Home's agents finish;
#    one that never reached the server says so after 10 minutes (nothing charged); one still being sent is left alone
#  · only what the customer picked goes into the engine's words: the Video page's defaults (a short film, the cinematic look, a
#    slow dolly-in) are left out unless picked (a tap, or a page that set them — UGC ads); a job without chosen155 keeps them
#  · the agents: the request in English goes first (a prompt that drifted gives way to the request), the fidelity rules are in
#    the brief to the text AI, a short single shot gets no story techniques; the long-video planner keeps to the idea
# Run: python3 tests/v155.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8463, 8464; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v155-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4"], check=True)
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": [], "plan": "faithful"}
REQ = "An orange cat plays with a red ball of yarn in a garden, close-up shot"
PLANS = {"faithful": REQ + ", soft morning light, 85 mm lens, shallow depth of field.", "drift": "A curious kitten discovers a mysterious glowing orb at dusk, cinematic reveal.",
         "partial": "Soft morning light over a garden. A fluffy orange cat bats a red ball of yarn, close-up."}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.mp4":
            b = open(DIR + "/res.mp4", "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/res.mp4"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path == "/mode": st.update(j); return self.send(st)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 500})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text"); st["llm"].append(text)
            if "planning one" in text:
                o = {"brief": {"intent": "show", "subject": "cat"}, "agents": {}, "request": REQ, "prompt": PLANS[st["plan"]], "negative": "blurry", "bible": "", "shots": []}
            elif "connected shots" in text: o = {"title": "t", "bible": "a garden", "shots": ["the cat plays", "the cat plays on", "the cat rests"]}
            else: o = {}
            return self.send({"content": [{"type": "text", "text": json.dumps(o)}]})
        st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "data": {"taskId": "t%d" % len(st["reqs"])}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, port=PORT):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
stats = lambda: api("/stats", port=KPORT)
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
def engine(body):
    n = len(stats()["reqs"]); j = api("/v1/jobs", body); r = wait(lambda: stats()["reqs"][n:] or None, 40) or [{}]
    return j, (r[-1].get("body") or {}).get("input") or {}
V = lambda cid, **meta: {"kind": "video", "model": "kling30", "prompt": "An orange cat plays with a red ball of yarn in a garden, close-up shot", "dur": 5, "aspect": "16:9", "cid": cid,
                         "meta": {"type": "story", "style": "cinematic", "camera": "dollyIn", "motion": 50, **meta}}
SHORT, CINE, DOLLY = "Made as a short film", "Cinematic film look", "Slow dolly-in"

def server_checks():
    # only what was picked
    j, i = engine(V("c1", chosen155=[])); p = i.get("prompt", ""); out["none"] = p
    ok(j.get("id") and SHORT not in p and CINE not in p and DOLLY not in p and p.startswith("An orange cat plays"), f"nothing picked → the page's defaults stay out of the words {p}")
    j, i = engine(V("c2", chosen155=["camera"])); p = i.get("prompt", "")
    ok(DOLLY in p and SHORT not in p and CINE not in p, f"the camera picked → only its line {p}")
    j, i = engine(V("c3", type="ugc", chosen155=["type"])); p = i.get("prompt", "")
    ok("authentic UGC social video" in p and CINE not in p, f"a type a page set (UGC) → its line {p}")
    j, i = engine(V("c4")); p = i.get("prompt", "")
    ok(SHORT in p and CINE in p and DOLLY in p, f"a job without chosen155 (an older page, an agent) keeps its lines {p}")
    # the server's list gives back the page's own id
    lst = api("/v1/jobs").get("jobs") or []; ok(any(x.get("cid") == "c1" for x in lst), f"the job list carries the page's id (cid) {[x.get('cid') for x in lst][:6]}")
    # the agents keep the request
    req = "قطة برتقالية تلعب بكرة صوف حمراء في حديقة، لقطة قريبة"; R = "An orange cat plays with a red ball of yarn in a garden, close-up shot"
    for mode, want in (("faithful", lambda p: p.startswith(R) and "85 mm" in p), ("drift", lambda p: p == R), ("partial", lambda p: p.startswith(R + ".") and "fluffy" in p)):
        api("/mode", {"plan": mode}, port=KPORT); l0 = len(stats()["llm"]); r = api("/v1/agents/plan", {"prompt": req, "task": "video", "dur": 5, "aspect": "16:9", "lang": "ar"})
        out["plan_" + mode] = r.get("prompt"); ok(want(str(r.get("prompt") or "")), f"agents plan ({mode}): the request goes first / alone when it drifted {r.get('prompt')}")
    t = stats()["llm"][-1]
    ok('"request"' in t and "Never add a story, a twist, a reveal" in t and "everything it names is in the prompt" in t, f"the agents' brief has the fidelity rules {t[:300]}")
    ok("Hook in the first two seconds" not in t and "one obstacle" not in t.lower(), "a 5-second single shot gets no story techniques")
    api("/mode", {"plan": "faithful"}, port=KPORT); api("/v1/agents/plan", {"prompt": R, "task": "video", "dur": 30, "aspect": "16:9", "lang": "en"}); t30 = stats()["llm"][-1]
    ok("Hook in the first two seconds" in t30, "a 30-second film still gets the story techniques")
    # the long-video planner keeps to the idea
    l0 = len(stats()["llm"]); api("/v1/jobs", {**V("long1", chosen155=[]), "dur": 30})
    lt = wait(lambda: next((x for x in stats()["llm"][l0:] if "connected shots" in x), None), 40) or ""
    ok("Add no new characters, objects, places or events" in lt and "a beginning, a middle and an end" not in lt and "v155" not in lt, f"the long-video planner keeps to the idea {lt[:400]}")

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 412, "height": 915}, is_mobile=True, has_touch=True)).new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go('home');renderAll()}")
        # a job the page never heard back about: on the server (made with the page's id), the page's copy without the server's id
        sid = await E("""async()=>{const r=await API.req('/v1/jobs',{json:{kind:'video',model:'kling30',prompt:'a lost one',dur:5,aspect:'16:9',cid:'L155',meta:{chosen155:[]}}});return r.id}""")
        wait(lambda: any(x.get("id") == sid and x.get("status") == "done" for x in (api("/v1/jobs").get("jobs") or [])), 60)
        await E("""(sid)=>{const now=Date.now();S.jobs.push({id:'L155',kind:'video',model:'kling30',prompt:'a lost one',title:'a lost one',status:'queued',progress:0,created:now-60000,dur:5,aspect:'16:9',art:'scene',meta:{}},
            {id:'D155',remote:sid,kind:'video',status:'complete',progress:1,resultUrl:'/media/x.mp4',created:now,title:'',prompt:'',dur:5,aspect:'16:9',art:'scene',meta:{synced:true}},
            {id:'U155',kind:'video',model:'kling30',prompt:'never sent',status:'queued',progress:0,created:now-11*60e3,dur:5,aspect:'16:9',art:'scene',meta:{}},
            {id:'S155',kind:'video',model:'kling30',prompt:'being sent',status:'queued',progress:0,created:now-11*60e3,dur:5,aspect:'16:9',art:'scene',meta:{}});
          SEND155.add('S155');S.hf.out=(S.hf.out||[]).concat(['L155']);const run=agStart();agWatch(run,['L155']);window.__run=run;renderAll()}""", sid)
        n = await E("()=>link155()")
        st = await E("()=>{const g=id=>S.jobs.find(x=>x.id===id);const L=g('L155'),U=g('U155'),Sd=g('S155');return {n:0,L:L&&[L.remote,L.status,!!L.resultUrl],dup:!!g('D155'),U:U&&[U.status,U.errorType,U.error,U.errorAr],S:Sd&&Sd.status}}")
        out["lost"] = st
        ok(st["L"] and st["L"][0] == sid and st["L"][1] == "complete" and st["L"][2] and not st["dup"], f"the page's copy found its job (complete, the sync's copy gone) {st}")
        ok(st["U"] and st["U"][0] == "failed" and st["U"][1] == "unsent" and "didn't reach the server" in st["U"][2] and "لم يصل" in st["U"][3], f"never reached the server → says so after 10 minutes {st}")
        ok(st["S"] == "queued", f"a job still being sent is left alone {st}")
        done = False
        for _ in range(40):
            done = await E("()=>!AG.busy&&!!AG.summary")
            if done: break
            await asyncio.sleep(.25)
        ok(done, "Home's agents finish once the job is found")
        # only what was picked, from Home (bots off) through the page
        n0 = len(stats()["reqs"])
        await E("""()=>{S.draft.type='story';S.draft.style='cinematic';S.draft.camera='dollyIn';delete S.draft.chosen155;S.hf.tab='video';S.hf.vModel='kling30';S.hf.bots=false;S.hf.dur=5;go('home');renderAll();
            setTimeout(()=>{const q=document.querySelector('#hfq');q.value='A red kite over the sea';q.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.hfsend').click()},300)}""")
        kite = lambda n0: next((((x.get("body") or {}).get("input") or {}).get("prompt", "") for x in stats()["reqs"][n0:] if "red kite" in json.dumps(x)), None)
        pr = wait(lambda: kite(n0), 40) or ""; out["home"] = pr
        jm = await E("()=>{const j=S.jobs.filter(x=>x.kind==='video'&&/red kite/.test(x.prompt||'')).pop();return j&&j.meta&&j.meta.chosen155}")
        ok(jm == [] and SHORT not in pr and CINE not in pr and DOLLY not in pr and "red kite" in pr, f"Home: the Video page's defaults stay out {jm} {pr}")
        n0 = len(stats()["reqs"])
        await E("""()=>{const b=document.createElement('button');b.dataset.set='draft.camera';b.dataset.val='orbit';document.body.appendChild(b);b.click();b.remove();S.draft.type='ugc';
            go('home');renderAll();setTimeout(()=>{const q=document.querySelector('#hfq');q.value='A red kite over the sea';q.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.hfsend').click()},300)}""")
        pr = wait(lambda: kite(n0), 40) or ""
        jm = await E("()=>{const j=S.jobs.filter(x=>x.kind==='video'&&/red kite/.test(x.prompt||'')).pop();return j&&j.meta&&j.meta.chosen155}")
        ok(jm and "camera" in jm and "type" in jm and "style" not in jm and "orbits" in pr and CINE not in pr, f"a camera tapped and a type a page set go in, the style nobody picked doesn't {jm} {pr}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(B + "/v1/config", timeout=2), 30); wait(lambda: stats(), 10)
    server_checks(); asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1, default=str)[:6000])
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
