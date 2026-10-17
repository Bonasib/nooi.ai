# v112 Still slow: the check-up showed the text AI took 42 s to look at one swap's photo and video before it was sent. A real nooi
# server, a stand-in engine that keeps jobs waiting in its line, a stand-in text AI that is slower than the limit, and the page:
#  · each look of the text AI waits at most MC_LOOK_MS (15 s; 2 s here): a slower one is left out and the job is sent anyway
#  · a job the engine has waiting in its line says so (the server's inLine; the card: "Waiting in the engine's line…")
#  · Admin → Overview → Speed: the text AI's slow look is named; Replace the person switches between 2K and 768P with one tap
#    (owners / admins only; the engine's other extra inputs are kept); the next swap is sent at the chosen resolution
# Run: python3 tests/v112.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8317, 8318
D = tempfile.mkdtemp(prefix="nooi-v112-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "z" * 32; now = int(time.time() * 1000)
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=6", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=6", "-vf", "drawbox=x=80:y=60:w=120:h=280:color=0x2040e0:t=fill",
   "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/clip.mp4")
ff("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=6", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")
im = Image.new("RGB", (512, 768), (240, 220, 200)); ImageDraw.Draw(im).ellipse([180, 80, 330, 260], fill=(200, 150, 120)); im.save(D + "/media/char.png")
SLOW = lambda i: {"id": i, "kind": "video", "cap": "video", "prov": "kie@minimax-h3/reference-to-video", "status": "done", "progress": 1, "url": "/media/x.mp4", "created": now - 1500e3, "sentAt": now - 1455e3, "doneAt": now - 770e3,
                  "times": {"prep": 3, "look": 42, "queue": 30, "making": 600}, "payload": {"kind": "video", "model": "mcswap", "dur": 8, "meta": {"mcVideo": {"dur": 8}}}, "cost": 0, "title": "old swap"}
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {i: SLOW(i) for i in ("o1", "o2", "o3")}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 30000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(D + "/data/db.json", "w"))
MOCK = r'''
import json, sys, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": 0, "line": 6}; T = {}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def kie(self, d): self.send({"code": 200, "msg": "success", "data": d})
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.mp4":
            b = open(DIR + "/res.mp4", "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        if "ecord" in u.path:
            age = time.time() - T.get(urllib.parse.parse_qs(u.query).get("taskId", [""])[0], time.time()); s = "queuing" if age < st["line"] else "generating" if age < st["line"] + 2 else "success"
            url = f"http://localhost:{P}/res.mp4"; return self.kie({"state": s, **({"resultJson": json.dumps({"resultUrls": [url]})} if s == "success" else {})})
        self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path == "/api/v1/chat/credit": return self.kie(500)
        if u.path.startswith("/api/v1/"): tid = "t%d" % (len(T) + 1); T[tid] = time.time(); st["reqs"].append({"path": u.path, "body": j}); return self.kie({"taskId": tid})
        if u.path == "/v1/messages": st["llm"] += 1; time.sleep(5); return self.send({"content": [{"type": "text", "text": json.dumps({"photo_people": 1, "video_people": 1, "video_person": "clear", "keep_en": "a red mug", "sure": True})}]})
        self.send({}, 404)
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def call(port, p, body=None, tok=TOKEN, method=None):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"),
                                 headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
api = lambda p, body=None, tok=TOKEN, method=None: call(PORT, p, body, tok, method)
mock = lambda p: call(KPORT, p, None, None)
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
SWAP = lambda cid: {"kind": "video", "model": "mcswap", "prompt": "", "dur": 6, "aspect": "16:9", "cid": cid, "inputs": {"mcMove": "/media/clip.mp4", "mcChar": "/media/char.png"}, "meta": {"motion83": True, "swap93": True, "consent": True}}
finished = lambda jid: wait(lambda: (lambda x: x if x.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + jid, None, None)), 90) or {}

def server_checks():
    # the text AI answers in 5 s, the limit is 2 s: the swap is sent without its look, and soon
    t0 = time.time(); j = api("/v1/jobs", SWAP("v112-a"), None); jid = j.get("id", "x")
    sent = wait(lambda: mock("/stats")["reqs"], 30); took = time.time() - t0
    inl = wait(lambda: (lambda x: x if x.get("inLine") else None)(api("/v1/jobs/" + jid, None, None)), 10) or {}
    d = finished(jid); t = d.get("times") or {}; body = (sent or [{}])[-1].get("body", {})
    out["a"] = {"took": round(took, 1), "times": t, "status": d.get("status"), "inLine": inl.get("inLine"), "inLineAfter": d.get("inLine"), "res": (body.get("input") or {}).get("resolution"), "prompt": str((body.get("input") or {}).get("prompt", ""))[-200:]}
    ok(sent and took < 4.8 and t.get("look", 99) < 3.2 and d.get("status") == "done", f"a slow text AI's look is left out after the limit: the swap is sent anyway, in time {out['a']}")
    ok(inl.get("inLine") is True and d.get("inLine") is None and t.get("queue", 0) >= 5, f"while the engine has it waiting in its line the job says so, not after {out['a']}")
    ok(out["a"]["res"] == "2K" and "red mug" not in out["a"]["prompt"], f"sent at 2K (the default), without the late look's words {out['a']}")
    # Admin → Speed: the slow look named; the switch
    sp = api("/v1/admin/speed", None, None); adv = " | ".join(a["en"] for a in sp.get("advice") or []); out["speed"] = {"swapRes": sp.get("swapRes"), "advice": adv[:700]}
    ok(sp.get("swapRes") == "2K" and "the text AI took about 42 s to look at the photo and the video" in adv and 'tap "Faster (768P)" below' in adv, f"speed: the slow look named, 2K now, the switch offered {out['speed']}")
    api("/v1/admin/providers/kie", {"apiKey": "kk", "baseUrl": f"http://localhost:{KPORT}", "inputs": '{"kling-3.0/video":{"mode":"pro"}}'}, None, "PUT")
    no = api("/v1/admin/speed/swapres", {"res": "768P"}); r = api("/v1/admin/speed/swapres", {"res": "768P"}, None)
    ok(no.get("_status") in (401, 403) and r.get("swapRes") == "768P" and api("/v1/admin/speed", None, None).get("swapRes") == "768P", f"the switch: owners / admins only; 768P set {no} {r}")
    adv2 = " | ".join(a["en"] for a in api("/v1/admin/speed", None, None).get("advice") or [])
    j = api("/v1/jobs", SWAP("v112-b"), None); finished(j.get("id", "x")); b2 = mock("/stats")["reqs"][-1]["body"]
    ok((b2.get("input") or {}).get("resolution") == "768P" and "Faster (768P)" not in adv2, f"the next swap is sent at 768P; no longer suggested {b2.get('input')} {adv2[:300]}")
    r = api("/v1/admin/speed/swapres", {"res": "2K"}, None)
    j = api("/v1/jobs", SWAP("v112-c"), None); finished(j.get("id", "x")); b3 = mock("/stats")["reqs"][-1]["body"]
    ok(r.get("swapRes") == "2K" and (b3.get("input") or {}).get("resolution") == "2K", f"back to 2K {r} {b3.get('input')}")
    j = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "a ship at sea", "dur": 5, "aspect": "16:9", "cid": "v112-k"}, None); finished(j.get("id", "x"))
    kb = [x["body"] for x in mock("/stats")["reqs"] if x["body"].get("model") == "kling-3.0/video"]
    ok(kb and (kb[-1].get("input") or {}).get("mode") == "pro", f"the engine's other extra inputs are kept {kb[-1:] }")

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 390, "height": 844})).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        async def line(route): await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "wl", "status": "rendering", "progress": .1, "inLine": True}))
        await pg.route("**/v1/jobs/wl1", line)
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}")
        await E("()=>{S.jobs.unshift({id:'w1',remote:'wl1',kind:'video',type:'video',model:'kling30',aspect:'16:9',dur:5,status:'rendering',progress:0,created:Date.now(),prompt:'a red apple',title:'a red apple'});renderAll()}")
        t = None
        for _ in range(40):
            t = await E("()=>{const h=previewCol(S.jobs.find(j=>j.id==='w1'),[]);return h.includes('Waiting in the engine') ? h : null}")
            if t: break
            await asyncio.sleep(.25)
        ok(t and "Waiting in the engine" in t and "as soon as the engine is free" in t, f"the card says the job is waiting in the engine's line {str(t)[:200]}")
        await E("()=>{S.view='admin';S.admTab='overview';renderAll()}")
        r = None
        for _ in range(40):
            r = await E("()=>{const c=document.querySelector('.sw112');return c?c.textContent:null}")
            if r: break
            await asyncio.sleep(.25)
        out["card"] = r
        ok(r and "Sharpest (2K)" in r and "Faster (768P)" in r and await E("()=>document.querySelector('[data-act=sw112][data-res=\"2K\"]').classList.contains('on')"), f"the speed card: the 2K / 768P switch, 2K on {r}")
        await pg.click('[data-act=sw112][data-res="768P"]'); await pg.wait_for_timeout(1200)
        on = await E("()=>document.querySelector('[data-act=sw112][data-res=\"768P\"]')?.classList.contains('on')")
        ok(on and api("/v1/admin/speed", None, None).get("swapRes") == "768P", f"one tap sets 768P {on}")
        w = await E("()=>{const c=document.querySelector('.sw112');return c?c.getBoundingClientRect().right<=window.innerWidth+1:false}")
        ok(w, "the switch fits a phone")
        await E("()=>{S.lang='ar';renderAll()}"); await pg.wait_for_timeout(400)
        ra = await E("()=>document.querySelector('.sw112')?.textContent||''")
        ok("أسرع (768P)" in ra and "الأوضح (2K)" in ra, f"…and in Arabic {ra}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "MC_LOOK"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock-vision", MIRROR_MEDIA="false", FREE_PERIOD="false", MC_LOOK_MS="2000"),
    stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30); wait(lambda: mock("/stats"), 10)
    server_checks()
    asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1))
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
