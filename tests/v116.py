# v116 "the issue is from the engine — even on Seedance it still takes a long time (Higgsfield and OpenArt are fast)". A real nooi
# server, a stand-in Kie engine, a stand-in fal.ai queue and the page:
#  · Replace the person runs on Seedance 2.0 Fast by default (bytedance/seedance-2-fast on Kie: 720p, 480p with "Faster")
#  · fal.ai as a second provider with its own line (the owner's fal key; one tap on the speed card, refused without a key):
#    Seedance 2.0 Fast reference-to-video with @Video1 / @Image1 words, fal's own fields (duration a string, 720p, aspect auto, no
#    engine sound); the engine's line and its making are measured; its own price (the page shows the same); a failure on fal →
#    the engine's reason, nothing charged
#  · the speed card: four engines, fal.ai off until its key is saved, each engine's resolutions
# Run: python3 tests/v116.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8325, 8326
D = tempfile.mkdtemp(prefix="nooi-v116-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "f" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 30000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(D + "/data/db.json", "w"))
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/clip.mp4")
ff("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")
im = Image.new("RGB", (512, 768), (240, 220, 200)); ImageDraw.Draw(im).ellipse([180, 80, 330, 260], fill=(200, 150, 120)); im.save(D + "/media/char.png")
MOCK = r'''
import json, sys, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "fal": [], "falFail": False, "auth": []}; R = {}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.mp4":
            b = open(DIR + "/res.mp4", "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        if u.path.startswith("/fal/requests/"):
            st["auth"].append(self.headers.get("authorization")); rid = u.path.split("/")[3]; r = R.get(rid, {}); age = time.time() - r.get("t", 0)
            if u.path.endswith("/status"): return self.send({"status": "IN_QUEUE" if age < 3 else "IN_PROGRESS" if age < 5 else "COMPLETED", "request_id": rid})
            if r.get("fail"): return self.send({"detail": [{"msg": "The reference video could not be read", "type": "value_error"}]}, 422)
            return self.send({"video": {"url": f"http://localhost:{P}/res.mp4"}, "seed": 7})
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/res.mp4"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/plan": st.update(j); return self.send({"ok": 1})
        if u.path.startswith("/fal/"):
            st["auth"].append(self.headers.get("authorization")); rid = "r%d" % (len(st["fal"]) + 1); st["fal"].append({"model": u.path[5:], "input": j}); R[rid] = {"t": time.time(), "fail": st["falFail"]}
            b = f"http://localhost:{P}/fal/requests/{rid}"; return self.send({"request_id": rid, "status_url": b + "/status", "response_url": b, "cancel_url": b + "/cancel"})
        st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "data": {"taskId": "t%d" % len(st["reqs"])}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def call(port, p, body=None, tok=None):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
api = lambda p, body=None, tok=None: call(PORT, p, body, tok)
mock = lambda p, body=None: call(KPORT, p, body)
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
SW = lambda cid: {"kind": "video", "model": "mcswap", "prompt": "", "dur": 5, "aspect": "16:9", "cid": cid, "inputs": {"mcMove": "/media/clip.mp4", "mcChar": "/media/char.png"}, "meta": {"motion83": True, "swap93": True, "consent": True}}
def swap(cid, tok=None):
    j = api("/v1/jobs", SW(cid), tok); d = wait(lambda: (lambda x: x if x.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + j.get("id", "x"), None, tok)), 90) or {}
    return j, d

def server_checks(withKey):
    if not withKey:
        r = api("/v1/admin/speed/swapengine", {"engine": "fal"}); sp = api("/v1/admin/speed")
        ok(r.get("_status") == 400 and "fal.ai key" in str(r.get("error")) and sp.get("falReady") is False, f"fal.ai can't be picked without its key {r} {sp.get('falReady')}")
        n = len(mock("/stats")["reqs"]); j, d = swap("kfast"); b = mock("/stats")["reqs"][n:]; i = (b[-1]["body"] if b else {}).get("input", {}); out["default"] = {"model": (b[-1]["body"] if b else {}).get("model"), "res": i.get("resolution"), "status": d.get("status")}
        ok(d.get("status") == "done" and out["default"]["model"] == "bytedance/seedance-2-fast" and i.get("resolution") == "720p" and "reference_video_urls" in i, f"Replace the person on Seedance 2.0 Fast by default, 720p {out['default']}")
        api("/v1/admin/speed/swapres", {"res": "768P"}); n = len(mock("/stats")["reqs"]); swap("kfast2"); b = mock("/stats")["reqs"][n:]
        ok(((b[-1]["body"] if b else {}).get("input") or {}).get("resolution") == "480p", "…480p with \"Faster\""); api("/v1/admin/speed/swapres", {"res": "2K"})
        return
    p_kie = api("/v1/config").get("prices", {}).get("video", {}).get("mcswap")
    r = api("/v1/admin/speed/swapengine", {"engine": "fal"}); sp = api("/v1/admin/speed"); p_fal = api("/v1/config").get("prices", {}).get("video", {}).get("mcswap")
    out["prices"] = [p_kie, p_fal]
    ok(r.get("swapEngine") == "fal" and sp.get("falReady") is True and sp.get("swapEngine") == "fal" and p_fal and p_kie and p_fal > p_kie, f"fal.ai picked with its key; its own (higher) price on the page {r} {out['prices']}")
    c0 = api("/v1/billing", None, TOKEN).get("credits"); j, d = swap("fal1", TOKEN); c1 = api("/v1/billing", None, TOKEN).get("credits"); st = mock("/stats"); f = st["fal"][-1] if st["fal"] else {}; i = f.get("input", {})
    dd = api("/v1/jobs/" + j.get("id", "x")) ; out["fal"] = {"status": d.get("status"), "model": f.get("model"), "input": {k: v for k, v in i.items() if k != "prompt"}, "prompt": str(i.get("prompt", ""))[:120], "spent": c0 - c1, "auth": st["auth"][-1:]}
    ok(d.get("status") == "done" and f.get("model") == "bytedance/seedance-2.0/fast/reference-to-video" and st["auth"] and all(a == "Key fk-test" for a in st["auth"]), f"Replace the person made on fal.ai with its key {out['fal']}")
    ok(i.get("duration") == "5" and i.get("resolution") == "720p" and i.get("aspect_ratio") == "auto" and i.get("generate_audio") is False and len(i.get("image_urls") or []) == 1 and len(i.get("video_urls") or []) == 1
       and str(i.get("prompt", "")).startswith("Replace the person in @Video1 with the person in @Image1."), f"fal's own fields and the @Video1 / @Image1 words {out['fal']}")
    ok(c0 - c1 == p_fal, f"the customer pays fal's price, the one the page showed {c0 - c1} vs {p_fal}")
    t = (api("/v1/jobs?limit=5") or {}); jl = api("/v1/jobs/" + j.get("id", "x"))
    mock("/plan", {"falFail": True}); c0 = api("/v1/billing", None, TOKEN).get("credits"); j2, d2 = swap("fal2", TOKEN); c1 = api("/v1/billing", None, TOKEN).get("credits"); mock("/plan", {"falFail": False})
    out["falFail"] = {"status": d2.get("status"), "error": d2.get("error"), "spent": c0 - c1}
    ok(d2.get("status") == "failed" and "reference video could not be read" in str(d2.get("error")) and c0 - c1 == 0, f"a failure on fal.ai: the engine's reason, nothing charged {out['falFail']}")
    j3, d3 = swap("fal3"); tm = api("/v1/jobs/" + j3.get("id", "x")).get("times") or {}; out["times"] = tm
    ok(tm.get("queue", 0) >= 2 and tm.get("making", 0) >= 1, f"the engine's line and making are measured on fal.ai too {tm}")

async def page_checks(withKey):
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 390, "height": 844})).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.view='admin';S.admTab='overview';renderAll()}")
        t = None
        for _ in range(40):
            t = await E("()=>{const c=[...document.querySelectorAll('.sw112')].map(x=>x.textContent);return c.length>=2?c:null}")
            if t: break
            await asyncio.sleep(.25)
        fal = await E("()=>{const b=document.querySelector('[data-act=sw114][data-eng=\"fal\"]');return b?{off:b.disabled,on:b.classList.contains('on')}:null}")
        out["card_" + str(withKey)] = [t, fal]
        if not withKey:
            ok(t and all(x in t[0] for x in ("Seedance 2.0 Fast · fastest", "Seedance 2.0", "Seedance 2.0 Fast · fal.ai", "MiniMax H3")) and "Sharpest (720p)" in t[1] and "Faster (480p)" in t[1] and fal and fal["off"],
               f"the speed card: four engines, fal.ai off until its key is saved, Seedance Fast's resolutions {out['card_False']}")
        else:
            ok(fal and not fal["off"] and fal["on"], f"with the key fal.ai can be picked (and is on) {out['card_True']}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "SWAP_ENGINE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def server(**extra):
    return subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", FAL_QUEUE_URL=f"http://localhost:{KPORT}/fal", MIRROR_MEDIA="false", FREE_PERIOD="false", **extra), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "a"))
srv = server()
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30); wait(lambda: mock("/stats"), 10)
    server_checks(False); asyncio.run(page_checks(False))
    srv.terminate(); srv.wait(10); srv = server(FAL_KEY="fk-test"); wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30)
    server_checks(True); asyncio.run(page_checks(True))
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1))
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
