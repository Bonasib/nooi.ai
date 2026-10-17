# v110 Still slow after v109: a preview copy left running did the live site's work a second time, and the time before a job
# exists was not measured. Two real nooi servers side by side — the live site and a preview copy (NOOI_STAGE=1) started on a
# copy of its data — each with its own stand-in engine:
#  · the preview never sends, checks, joins or finishes the jobs it found in the copy (the live site makes them, once); what is
#    made on the preview itself is made as usual; a stop saves what is in memory first
#  · the live site times the words step (Arabic → English) and bringing the result here; Admin → Overview → Speed says in plain
#    words what slows jobs down: a preview copy still running, the words step, the download, the engine's own share
# Run: python3 tests/v110.py
import asyncio, hashlib, hmac, json, os, shutil, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SPORT, SMOCK, LPORT, LMOCK = 8311, 8312, 8313, 8314
T = tempfile.mkdtemp(prefix="nooi-v110-"); SECRET = "v" * 40
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
TOKEN = "nooi_" + "w" * 32; now = int(time.time() * 1000)
IMG = lambda p: {"kind": "image", "model": "nano", "prompt": p, "aspect": "1:1", "meta": {}}
def held(ref, n): return {"id": "l" + ref, "t": now - 1000, "delta": -n, "reason": "job", "ref": ref, "hold": "held"}
def seed(d, rid, extra):
    os.makedirs(d + "/data"); os.makedirs(d + "/media"); os.symlink(ROOT + "/public", d + "/public"); os.symlink(ROOT + "/node_modules", d + "/node_modules")
    for n, c in (("p1", "0xd02020"), ("p2", "0x2040e0")):
        ff("-f", "lavfi", "-i", f"color=c={c}:s=320x180:r=10:d=3", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f"{d}/media/{n}.mp4")
    jobs = {"sq": {"id": "sq", "kind": "image", "cap": "image", "prov": "kie@nano-banana-2", "status": "queued", "progress": 0, "created": now - 60e3, "payload": IMG("a queued pear"), "cost": 10, "title": "pear"},
            "sr": {"id": "sr", "kind": "image", "cap": "image", "prov": "kie@nano-banana-2", "status": "rendering", "remoteId": "m:" + rid, "progress": .3, "created": now - 30e3, "payload": IMG("a plum"), "cost": 5, "title": "plum"}, **extra}
    json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
      "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 1000, "ledger": [held(k, j["cost"]) for k, j in jobs.items() if j.get("cost")], "posts": {}, "accounts": {}, "jobs": jobs,
               "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(d + "/data/db.json", "w"))
SD, LD = T + "/stage", T + "/live"
seed(SD, "stg77", {  # a long swap the live site is joining
  "sp": {"id": "sp", "kind": "video", "cap": "video", "prov": "kie@minimax-h3/reference-to-video", "status": "rendering", "joining": True, "progress": .97, "created": now - 120e3, "children": ["c1", "c2"], "cost": 40, "title": "long swap",
         "payload": {"kind": "video", "model": "mcswap", "dur": 6, "inputs": {}, "meta": {"swapSrc": "/media/p1.mp4", "swapParts": [{"url": "/media/p1.mp4", "dur": 3, "swap": True, "job": "c1"}, {"url": "/media/p2.mp4", "dur": 3, "swap": True, "job": "c2"}]}}},
  "c1": {"id": "c1", "kind": "video", "parent": "sp", "status": "done", "url": f"http://localhost:{SPORT}/media/p1.mp4", "created": now - 120e3, "cost": 0, "payload": {"kind": "video", "model": "mcswap"}},
  "c2": {"id": "c2", "kind": "video", "parent": "sp", "status": "done", "url": f"http://localhost:{SPORT}/media/p2.mp4", "created": now - 120e3, "cost": 0, "payload": {"kind": "video", "model": "mcswap"}}})
DONE = lambda i: {"id": i, "kind": "image", "cap": "image", "prov": "kie@nano-banana-2", "status": "done", "progress": 1, "url": "/media/x.png", "created": now - 300e3, "sentAt": now - 292e3, "doneAt": now - 180e3,
                  "times": {"words": 6, "fetch": 14}, "payload": IMG("old"), "cost": 0, "title": "old"}
seed(LD, "liv77", {i: DONE(i) for i in ("d1", "d2", "d3", "d4")})
ff("-f", "lavfi", "-i", "color=c=0x30a050:s=64x64", "-frames:v", "1", T + "/res.png")
MOCK = r'''
import json, sys, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "gets": [], "llm": 0}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.png":
            time.sleep(.4); b = open(DIR + "/res.png", "rb").read(); self.send_response(200); self.send_header("content-type", "image/png"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        if "ecord" in u.path:
            st["gets"].append(urllib.parse.parse_qs(u.query).get("taskId", [""])[0]); url = f"http://localhost:{P}/res.png"
            return self.send({"code": 200, "msg": "success", "data": {"state": "success", "successFlag": 1, "response": {"resultUrls": [url]}, "resultJson": json.dumps({"resultUrls": [url]})}})
        self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("/chat/completions"): st["llm"] += 1; time.sleep(1.3); return self.send({"choices": [{"message": {"content": "a red apple on a wooden table"}}]})
        if u.path == "/api/v1/chat/credit": return self.send({"code": 200, "data": 500})
        if u.path.startswith("/api/v1/"): st["reqs"].append({"path": u.path, "prompt": (j.get("input") or {}).get("prompt") or j.get("prompt")}); return self.send({"code": 200, "msg": "success", "data": {"taskId": "t%d" % len(st["reqs"])}})
        self.send({}, 404)
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(T + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(port, p, tok=None, body=None):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
stats = lambda port: json.loads(urllib.request.urlopen(f"http://localhost:{port}/stats").read())
done = lambda port, i, tok=TOKEN: wait(lambda: (lambda j: j if j.get("status") in ("done", "failed") else None)(api(port, "/v1/jobs/" + i, tok)), 40) or {}
sig = lambda i: hmac.new(SECRET.encode(), ("cb:" + i).encode(), hashlib.sha256).hexdigest()[:24]

def stage_checks():
    time.sleep(5)   # (the live site has long picked up and checked its own by now)
    api(SPORT, f"/v1/engine/cb/sr/{sig('sr')}", body={})   # the engine calls back about a job the live site sent
    time.sleep(3)
    s = stats(SMOCK); q, r, p = (api(SPORT, "/v1/jobs/" + i, TOKEN) for i in ("sq", "sr", "sp"))
    out["stage"] = {"reqs": [x["prompt"] for x in s["reqs"]], "gets": s["gets"], "sq": q.get("status"), "sr": r.get("status"), "sp": [p.get("status"), p.get("url")]}
    ok(not s["reqs"] and not s["gets"] and q.get("status") == "queued" and r.get("status") == "rendering" and p.get("status") == "rendering" and not p.get("url"),
       f"the preview never sends, checks or joins the live site's jobs again (not even when the engine calls back) {out['stage']}")
    n = api(SPORT, "/v1/jobs", TOKEN, {"kind": "image", "model": "nano", "prompt": "a blue cup", "aspect": "1:1", "cid": "v110-cup"}); d = done(SPORT, n.get("id", "x"))
    ok(d.get("status") == "done" and [x["prompt"] for x in stats(SMOCK)["reqs"]] == ["a blue cup"], f"what is made on the preview itself is made as usual {d} {stats(SMOCK)}")

def live_checks():
    q, r = done(LPORT, "sq"), done(LPORT, "sr"); s = stats(LMOCK)
    out["live"] = {"sq": q.get("status"), "sr": r.get("status"), "reqs": [x["prompt"] for x in s["reqs"]], "gets": s["gets"]}
    ok(q.get("status") == "done" and r.get("status") == "done" and [x["prompt"] for x in s["reqs"]].count("a queued pear") == 1 and "liv77" in s["gets"], f"the live site makes its jobs, once {out['live']}")
    t0 = time.time(); n = api(LPORT, "/v1/jobs", None, {"kind": "image", "model": "nano", "prompt": "تفاحة حمراء على طاولة", "aspect": "1:1", "cid": "v110-ar"}); took = time.time() - t0
    d = done(LPORT, n.get("id", "x"), None); tm = d.get("times") or {}
    out["words"] = {"took": round(took, 1), "times": tm, "sent": [x["prompt"] for x in stats(LMOCK)["reqs"]][-1:]}
    ok(d.get("status") == "done" and tm.get("words", 0) >= 1.0 and tm.get("fetch", 0) >= 0.3 and "a red apple on a wooden table" in str(out["words"]["sent"]),
       f"the words step (Arabic → English) and bringing the result here are timed {out['words']}")
    sp = api(LPORT, "/v1/admin/speed"); adv = " | ".join(a["en"] for a in sp.get("advice") or []); out["advice"] = adv[:900]; s = sp.get("server") or {}; im = (sp.get("last24h") or {}).get("image") or {}
    ok(s.get("preview") is True and "preview copy of the site is still running" in adv and "stage.sh stop" in adv, f"speed: a preview copy still running is named, with how to remove it {adv}")
    ok("putting the words into English takes" in adv and "bringing each finished result to this server takes" in adv and "the AI engine's own time" in adv and im.get("words") and im.get("fetch"),
       f"speed: the words step, the download and the engine's own share, in plain words {adv} {im}")
    ok(all(a.get("ar") for a in sp.get("advice") or []) and (s.get("saveMs") or {}).get("n", 0) >= 1, f"speed: each line also in Arabic; how long saving takes {s}")
    ok(api(LPORT, "/v1/admin/speed", TOKEN).get("_status") == 403, "speed: owners and admins only")

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1280, "height": 900})).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(f"http://localhost:{LPORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.view='admin';S.admTab='overview';renderAll()}")
        r = None
        for _ in range(40):
            r = await E("()=>{const c=document.querySelector('.sp109');return c&&c.querySelector('.sp109g')?c.textContent:null}")
            if r: break
            await asyncio.sleep(.25)
        out["card"] = (r or "")[:500]
        ok(r and "preview copy of the site is still running" in r and "Each save" in r and "putting the words into English" in r, f"Admin → Overview → Speed says what slows jobs down {out['card']}")
        await E("()=>{S.lang='ar';renderAll()}"); await pg.wait_for_timeout(300)
        ra = await E("()=>document.querySelector('.sp109')?.textContent||''")
        ok("نسخة المعاينة" in ra and "كل حفظ" in ra, f"…and in Arabic {ra[:300]}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "STAGE_PORT"))}
mocks = [subprocess.Popen([sys.executable, T + "/mock.py", str(p), T], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) for p in (SMOCK, LMOCK)]
def server(d, port, mock, **extra):
    return subprocess.Popen(["node", ROOT + "/server.js"], cwd=d, env=dict(env, PORT=str(port), SECRET_KEY=SECRET, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{port}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{mock}", FREE_PERIOD="false", RECOVER_MS="400", **extra), stdout=subprocess.DEVNULL, stderr=open(d + "/server.log", "w"))
live = server(LD, LPORT, LMOCK, STAGE_PORT=str(SPORT), LOCAL_LLM_URL=f"http://localhost:{LMOCK}/v1", LOCAL_LLM_MODEL="m")
stage = server(SD, SPORT, SMOCK, NOOI_STAGE="1", MIRROR_MEDIA="false")
try:
    for port in (LPORT, SPORT): wait(lambda: urllib.request.urlopen(f"http://localhost:{port}/v1/config", timeout=2), 30)
    stage_checks(); live_checks(); asyncio.run(page_checks())
    # deploy/doctor.sh: the read-only check-up the owner runs on the server — the jobs' times, no keys
    open(LD + "/.env", "w").write(f"PORT={LPORT}\nKIE_API_KEY=doctor-secret-123456\nPUBLIC_BASE_URL=https://x.test\n")
    r = subprocess.run(["bash", ROOT + "/deploy/doctor.sh"], env=dict(env, APP=LD), capture_output=True, text=True, timeout=180); dout = r.stdout + r.stderr; out["doctor"] = dout[-700:]
    ok(r.returncode == 0 and "/v1/health → 200" in dout and "users: 2" in dout and "image · done" in dout and "PUBLIC_BASE_URL: set" in dout and "Done — nothing was changed." in dout, f"check-up: the server, the site and the jobs {dout[-900:]}")
    ok("doctor-secret" not in dout and os.path.exists(LD + "/data/db.json"), "check-up: no keys printed")
    # a stop saves what is in memory first (an update restarts the site)
    n = api(SPORT, "/v1/jobs", TOKEN, {"kind": "image", "model": "nano", "prompt": "a green bowl", "aspect": "1:1", "cid": "v110-bowl"}); stage.send_signal(signal.SIGTERM); rc = stage.wait(10)
    db = json.load(open(SD + "/data/db.json")); ok(rc == 0 and n.get("id") in db["users"]["cust"]["jobs"], f"a stop saves what is in memory first {rc} {n.get('id')}")
    # the preview restarted: its own jobs are still its own (the live site's still aren't)
    stage = server(SD, SPORT, SMOCK, NOOI_STAGE="1", MIRROR_MEDIA="false"); wait(lambda: urllib.request.urlopen(f"http://localhost:{SPORT}/v1/config", timeout=2), 30)
    bw = done(SPORT, n.get("id", "x")); time.sleep(2); s2 = stats(SMOCK)
    ok(bw.get("status") == "done" and "a queued pear" not in [x["prompt"] for x in s2["reqs"]] and "stg77" not in s2["gets"] and api(SPORT, "/v1/jobs/sq", TOKEN).get("status") == "queued",
       f"after the preview restarts its own jobs are made, the live site's still left alone {bw.get('status')} {s2}")
    stage.terminate(); stage.wait(10)
    adv = " | ".join(a["en"] for a in api(LPORT, "/v1/admin/speed").get("advice") or [])
    ok("preview copy" not in adv, f"no preview running → not named {adv}")
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    for x in (live, stage, *mocks): x.kill()
print(json.dumps({"fails": fails, "out": out, "dir": T}, ensure_ascii=False, indent=1))
if not fails: shutil.rmtree(T, ignore_errors=True)
sys.exit(1 if fails else 0)
