# v109 Slow pictures and videos: what slowed every job down, fixed. A real nooi server with jobs a restart left behind, a
# stand-in engine, and the page:
#  · at start the server picks up what a restart left behind: a recent job that never reached the engine is sent again and made;
#    an old one, and a Motion Control job still being prepared, fail with the reason and their credits back; a join starts again;
#    a job the engine already has is followed as before
#  · Admin → Overview → Speed: how busy the server is and where the time of the last day's jobs went (staff only)
#  · the page asks about the jobs being made 4 at a time, never in two rounds at once, and about old jobs only once a minute
# Run: python3 tests/v109.py
import asyncio, hashlib, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8309, 8310
D = tempfile.mkdtemp(prefix="nooi-v109-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
for n, c in (("p1", "0xd02020"), ("p2", "0x2040e0")):
    ff("-f", "lavfi", "-i", f"color=c={c}:s=320x180:r=10:d=3", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f"{D}/media/{n}.mp4")
ff("-f", "lavfi", "-i", "color=c=0x30a050:s=64x64", "-frames:v", "1", D + "/res.png")
TOKEN = "nooi_" + "q" * 32; now = int(time.time() * 1000)
def held(ref, n): return {"id": "l" + ref, "t": now - 1000, "delta": -n, "reason": "job", "ref": ref, "hold": "held"}
IMG = lambda: {"kind": "image", "model": "nano", "prompt": "a red apple on a table", "aspect": "1:1", "meta": {}}
jobs = {
  "ja": {"id": "ja", "kind": "image", "cap": "image", "prov": "kie@nano-banana-2", "status": "queued", "progress": 0, "created": now - 60e3, "payload": IMG(), "cost": 10, "title": "apple"},
  "jb": {"id": "jb", "kind": "video", "cap": "video", "prov": "kie@kling-3.0/video", "status": "queued", "progress": 0, "created": now - 3 * 3600e3, "payload": {"kind": "video", "model": "kling30", "prompt": "a ship", "dur": 5, "meta": {}}, "cost": 20, "title": "ship"},
  "jc": {"id": "jc", "kind": "video", "cap": "video", "prov": "kie@minimax-h3/reference-to-video", "status": "queued", "stage": "prep", "progress": 0, "created": now - 60e3,
         "payload": {"kind": "video", "model": "mcswap", "prompt": "", "dur": 6, "inputs": {"mcMove": "/media/p1.mp4", "mcChar": "/media/p1.mp4"}, "meta": {"motion83": True, "swap93": True, "consent": True}}, "cost": 30, "title": "swap"},
  "jd": {"id": "jd", "kind": "video", "cap": "video", "prov": "kie@minimax-h3/reference-to-video", "status": "rendering", "joining": True, "progress": .97, "created": now - 120e3, "children": ["c1", "c2"], "cost": 40, "title": "long swap",
         "payload": {"kind": "video", "model": "mcswap", "dur": 6, "inputs": {}, "meta": {"swapSrc": "/media/p1.mp4", "swapParts": [{"url": "/media/p1.mp4", "dur": 3, "swap": True, "job": "c1"}, {"url": "/media/p2.mp4", "dur": 3, "swap": True, "job": "c2"}]}}},
  "c1": {"id": "c1", "kind": "video", "parent": "jd", "status": "done", "url": f"http://localhost:{PORT}/media/p1.mp4", "created": now - 120e3, "cost": 0, "payload": {"kind": "video", "model": "mcswap"}},
  "c2": {"id": "c2", "kind": "video", "parent": "jd", "status": "done", "url": f"http://localhost:{PORT}/media/p2.mp4", "created": now - 120e3, "cost": 0, "payload": {"kind": "video", "model": "mcswap"}},
  "je": {"id": "je", "kind": "image", "cap": "image", "prov": "kie@nano-banana-2", "status": "rendering", "remoteId": "m:t77", "progress": .3, "created": now - 30e3, "payload": IMG(), "cost": 5, "title": "pear"},
}
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 1000, "ledger": [held(k, j["cost"]) for k, j in jobs.items() if j.get("cost")], "posts": {}, "accounts": {}, "jobs": jobs,
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(D + "/data/db.json", "w"))
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": []}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.png":
            b = open(DIR + "/res.png", "rb").read(); self.send_response(200); self.send_header("content-type", "image/png"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        if "ecord" in u.path:
            url = f"http://localhost:{P}/res.png"; return self.send({"code": 200, "msg": "success", "data": {"state": "success", "successFlag": 1, "response": {"resultUrls": [url]}, "resultJson": json.dumps({"resultUrls": [url]})}})
        self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path == "/api/v1/chat/credit": return self.send({"code": 200, "data": 500})
        if u.path.startswith("/api/v1/"): st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "msg": "success", "data": {"taskId": "t%d" % len(st["reqs"])}})
        self.send({}, 404)
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, tok=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
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
job = lambda i: api("/v1/jobs/" + i, TOKEN)

def server_checks():
    a = wait(lambda: (lambda j: j if j.get("status") in ("done", "failed") else None)(job("ja")), 40) or {}
    b, c = job("jb"), job("jc"); d = wait(lambda: (lambda j: j if j.get("status") in ("done", "failed") else None)(job("jd")), 60) or {}; e = wait(lambda: (lambda j: j if j.get("status") == "done" else None)(job("je")), 30) or {}
    reqs = json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())["reqs"]
    out["recover"] = {"a": [a.get("status"), a.get("url")], "b": [b.get("status"), b.get("error"), b.get("errorAr")], "c": [c.get("status"), c.get("error")], "d": [d.get("status"), d.get("url")], "e": e.get("status"), "sent": [r["body"].get("model") for r in reqs]}
    ok(a.get("status") == "done" and [r["body"].get("model") for r in reqs].count("nano-banana-2") == 1, f"a recent job that never reached the engine is sent again and made {out['recover']}")
    msg = "The server restarted while this was being prepared — nothing was charged. Make it again."
    ok(b.get("status") == "failed" and b.get("error") == msg and "أُعيد تشغيل الخادم" in str(b.get("errorAr")) and c.get("status") == "failed" and c.get("error") == msg, f"an old job and a Motion Control job still being prepared: the reason, nothing charged {out['recover']}")
    ok(d.get("status") == "done" and str(d.get("url", "")).endswith("-swap.mp4") and e.get("status") == "done", f"a join starts again; a job the engine has is followed as before {out['recover']}")
    cr = wait(lambda: (lambda x: x if x == 1050 else None)(api("/v1/billing", TOKEN).get("credits")), 15)
    ok(cr == 1050, f"the two failed jobs' credits back (20 + 30), the made ones charged {api('/v1/billing', TOKEN).get('credits')}")
    # the Admin speed numbers
    sp = api("/v1/admin/speed"); no = api("/v1/admin/speed", TOKEN); out["speed"] = sp
    ok(no.get("_status") == 403, f"the speed numbers are for the owner and admins only {no}")
    s = sp.get("server") or {}
    ok(isinstance(s.get("load"), list) and s.get("cpus", 0) >= 1 and "max" in (s.get("lagMs") or {}) and s.get("recovered", 0) >= 4 and (sp.get("last24h") or {}).get("image", {}).get("n", 0) >= 1 and (sp.get("last24h") or {}).get("image", {}).get("engine") is not None,
       f"speed: load, CPUs, the longest wait, jobs picked up after the restart, the last day's pictures with our part and the engine's {sp}")

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1280, "height": 900}); pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        st = {"active": 0, "max": 0, "per": {}, "dup": 0, "on": set()}
        async def slow(route):
            jid = route.request.url.rsplit("/", 1)[-1]
            if route.request.method != "GET": return await route.continue_()
            if jid in st["on"]: st["dup"] += 1
            st["on"].add(jid); st["active"] += 1; st["max"] = max(st["max"], st["active"]); st["per"][jid] = st["per"].get(jid, 0) + 1
            await asyncio.sleep(1.5); st["active"] -= 1; st["on"].discard(jid)
            await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": jid, "status": "rendering", "progress": .4}))
        await pg.route("**/v1/jobs/slow*", slow); await pg.route("**/v1/jobs/old*", slow)
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}")
        await E("""()=>{const t=Date.now();for(let i=1;i<=12;i++)S.jobs.push({id:'s'+i,remote:'slow'+i,kind:'image',status:'rendering',progress:0,created:t,prompt:'x',title:'x'});
          for(let i=1;i<=2;i++)S.jobs.push({id:'o'+i,remote:'old'+i,kind:'video',status:'rendering',progress:0,created:t-3*3600e3,prompt:'x',title:'x'})}""")
        await pg.wait_for_timeout(14000)
        young = [st["per"].get("slow%d" % i, 0) for i in range(1, 13)]; old = [st["per"].get("old%d" % i, 0) for i in range(1, 3)]
        out["poll"] = {"max": st["max"], "dup": st["dup"], "young": young, "old": old}
        ok(st["max"] <= 4 and st["dup"] == 0 and min(young) >= 2 and max(old) <= 1, f"the page asks 4 at a time, never twice at once, old jobs once a minute {out['poll']}")
        # Admin → Overview → Speed
        await E("()=>{S.view='admin';S.admTab='overview';renderAll()}")
        r = None
        for _ in range(40):
            r = await E("()=>{const c=document.querySelector('.sp109');return c&&c.querySelector('.sp109g')?{t:c.textContent,rows:c.querySelectorAll('.sp109t tbody tr').length}:null}")
            if r: break
            await asyncio.sleep(.25)
        out["card"] = r and {"rows": r["rows"], "t": r["t"][:300]}
        ok(r and "Speed" in r["t"] and "Processor load" in r["t"] and r["rows"] >= 1 and "Pictures" in r["t"], f"Admin → Overview → Speed shows the server and the last day's jobs {out['card']}")
        ok(not errs, f"page errors {errs}")
        await b.close()

mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false", FREE_PERIOD="false", RECOVER_MS="400"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30)
    server_checks()
    asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1))
sys.exit(0)
