# v241 — Seedance on the owner's own ByteDance key, through the real server and a stand-in for BytePlus ModelArk on this machine
# (no real key, no request leaves the machine):
#  · a customer picks Seedance 2.0 Fast → the server sends the task to ByteDance (never the AI engine), polls it, saves the video on
#    the server and charges only then
#  · the request is in BytePlus's form (model id, text, ratio, duration, resolution, no watermark); a picture goes as Base64
#  · a task ByteDance fails is refunded
#  · with "Only my MiniMax key" on, a Seedance pick still runs on ByteDance and Replace things in a video is ready (it runs on
#    ByteDance); Motion Control stays off
#  · /v1/config says ByteDance is connected; deploy/why.sh says so (no keys)
# Run: python3 tests/v241.py
import json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8757; BP = 8758; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v241-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=2", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k", D + "/out.webm")
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=5", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k", D + "/media/v.webm")
FF("-f", "lavfi", "-i", "color=c=red:s=640x360:d=1", "-frames:v", "1", D + "/media/start.png")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
GOT, TASKS = [], {}
class ARK(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body, ctype="application/json"):
        b = body if isinstance(body, bytes) else json.dumps(body).encode(); self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); b = json.loads(self.rfile.read(n) or b"{}")
        GOT.append({"path": self.path, "auth": self.headers.get("Authorization"), "body": b})
        if self.path != "/api/v3/contents/generations/tasks": return self.send(404, {"error": {"message": "no"}})
        tid = "cgt-%d" % (len(TASKS) + 1); fail = "FAIL" in json.dumps(b); TASKS[tid] = {"n": 0, "fail": fail}; return self.send(200, {"id": tid})
    def do_GET(self):
        if self.path == "/out.webm": return self.send(200, open(D + "/out.webm", "rb").read(), "video/webm")
        if self.path.startswith("/api/v3/contents/generations/tasks/"):
            tid = self.path.rsplit("/", 1)[1]; t = TASKS.get(tid)
            if not t: return self.send(404, {"error": {"message": "not found"}})
            t["n"] += 1
            if t["n"] < 2: return self.send(200, {"id": tid, "status": "running"})
            if t["fail"]: return self.send(200, {"id": tid, "status": "failed", "error": {"code": "InternalServiceError", "message": "the model could not make this"}})
            return self.send(200, {"id": tid, "status": "succeeded", "content": {"video_url": f"http://127.0.0.1:{BP}/out.webm"}})
        if self.path.startswith("/api/v3/contents/generations/tasks"): return self.send(200, {"items": [], "total": 0})
        return self.send(404, {})
ark = ThreadingHTTPServer(("127.0.0.1", BP), ARK); threading.Thread(target=ark.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "ADMIN_EMAILS", "SEEDANCE_", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false",
    SEEDANCE_API_KEY="bd-test-key-000", SEEDANCE_BASE_URL=f"http://127.0.0.1:{BP}/api/v3", KIE_API_KEY="kie-test-000", MINIMAX_API_KEY="mm-test-000", MINIMAX_BASE_URL="http://127.0.0.1:9", ADMIN_EMAILS="boss@dev.local"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1200]))
def req(path, body=None, who="someone", method=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": who}, method=method or ("POST" if body is not None else "GET"))
    try: return json.loads(urllib.request.urlopen(r, timeout=30).read())
    except urllib.error.HTTPError as e: return {"status": e.code, **json.loads(e.read() or b"{}")}
def jobs(): return {j: x for U in json.load(open(D + "/data/db.json"))["users"].values() for j, x in (U.get("jobs") or {}).items()}
def wait(jid, s=40):
    for _ in range(s * 4):
        x = jobs().get(jid) or {}
        if x.get("status") in ("done", "failed"): return x
        time.sleep(0.25)
    return jobs().get(jid) or {}

def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    c = req("/v1/config"); chk("/v1/config: ByteDance connected", c["providers"].get("bd241") is True, c["providers"].get("bd241"))
    b0 = req("/v1/billing", who="c1").get("credits")
    j = req("/v1/jobs", {"kind": "video", "model": "seedance", "prompt": "a cat walks on a beach at sunset", "dur": 5, "aspect": "16:9"}, who="c1")
    x = wait(j.get("id")); b1 = req("/v1/billing", who="c1").get("credits")
    sent = GOT[-1] if GOT else {}
    chk("Seedance 2.0 Fast → the owner's ByteDance key (not the AI engine): sent, polled, saved on the server, charged once", x.get("status") == "done" and str(x.get("prov")) == "bd@dreamina-seedance-2-0-fast-260128" and "/media/" in str(x.get("url", "")) and os.path.exists(D + "/media/" + str(x.get("url", "")).rsplit("/media/", 1)[-1]) and b1 < b0,
        {"job": {k: x.get(k) for k in ("status", "prov", "url", "error", "errors")}, "credits": [b0, b1]})
    body = sent.get("body") or {}
    chk("the request is in BytePlus's form, with the owner's key", sent.get("auth") == "Bearer bd-test-key-000" and body.get("model") == "dreamina-seedance-2-0-fast-260128" and body.get("content", [{}])[0].get("type") == "text" and body.get("ratio") == "16:9" and body.get("duration") == 5 and body.get("watermark") is False, sent)
    j2 = req("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "she turns and smiles", "dur": 5, "aspect": "16:9", "inputs": {"vStart": "/media/start.png"}}, who="boss"); x2 = wait(j2.get("id"))
    ff = [c for c in (GOT[-1]["body"].get("content") or []) if c.get("role") == "first_frame"]
    chk("a picture to video on Seedance 2.0: the first frame goes as Base64", x2.get("status") == "done" and str(x2.get("prov")) == "bd@dreamina-seedance-2-0-260128" and ff and ff[0]["image_url"]["url"].startswith("data:image/png;base64,"), {"j2": j2, "x2": {k: x2.get(k) for k in ("status", "prov", "error")}, "ff": bool(ff)})
    b2 = req("/v1/billing", who="c3").get("credits")
    j3 = req("/v1/jobs", {"kind": "video", "model": "seedance", "prompt": "FAIL please", "dur": 5}, who="c3"); x3 = wait(j3.get("id")); time.sleep(1)
    b3 = req("/v1/billing", who="c3").get("credits")
    chk("a task ByteDance fails is refunded, and no other engine is tried", x3.get("status") == "failed" and b2 == b3 and not any(str(p).startswith("kie@") for p in [x3.get("prov"), x3.get("own185")]), {"x3": {k: x3.get(k) for k in ("status", "prov", "error", "errors")}, "credits": [b2, b3]})
    # ---- with "Only my MiniMax key" on
    r = req("/v1/admin/minimax183", {"only": True}, who="boss", method="PUT")
    j4 = req("/v1/jobs", {"kind": "video", "model": "seedance", "prompt": "a dog runs", "dur": 5}, who="c4"); time.sleep(1.5); x4 = jobs().get(j4.get("id")) or {}
    q = req("/v1/replace136/quote", {"src": "/media/v.webm", "changes": [{"id": "x1", "what": "the box", "to": "a ball"}]}, who="c4")
    mc = req("/v1/jobs", {"kind": "video", "model": "mc30", "dur": 5, "inputs": {"mcMove": "/media/v.webm", "mcChar": "/media/start.png"}}, who="c5")
    chk("Only my MiniMax key: a Seedance pick still runs on ByteDance, Replace things in a video is ready (ByteDance), Motion Control stays off", r.get("only") is True and str(x4.get("prov", "")).startswith("bd@") and q.get("ready") is True and mc.get("status") == 501, {"x4": x4.get("prov"), "q": q, "mc": mc.get("status")})
    req("/v1/admin/minimax183", {"only": False}, who="boss", method="PUT")
    pr = req("/v1/admin/providers/elevenlabs", {"apiKey": "el-test-key-999"}, who="boss", method="PUT"); chk("the owner saves a key in Admin", pr.get("ok") is True, pr)
    time.sleep(3)   # (the server writes its data a moment after a change)
    w = subprocess.run(["bash", ROOT + "/deploy/why.sh"], env=dict(os.environ, APP=D, SEEDANCE_API_KEY="bd-test-key-000", SECRET_KEY="f" * 40), capture_output=True, text=True, timeout=60).stdout
    chk("deploy/why.sh: ByteDance key yes, the keys saved in Admin listed (yes/no only), no keys printed", "ByteDance key (Seedance, BytePlus ModelArk): yes" in w and "keys saved in Admin: " in w and "elevenlabs" in w and "bd-test" not in w and "el-test" not in w and "can NOT be read" not in w, w)
    w2 = subprocess.run(["bash", ROOT + "/deploy/why.sh"], env=dict(os.environ, APP=D, SECRET_KEY="g" * 40), capture_output=True, text=True, timeout=60).stdout
    chk("deploy/why.sh: a key saved under another SECRET_KEY is reported as unreadable", "can NOT be read" in w2 and "elevenlabs" in w2.split("can NOT be read")[-1], w2)

try: main()
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate(); ark.shutdown()
if fails: print("v241 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-2500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v241 OK")
