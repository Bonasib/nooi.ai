# v250 — "Your account … has not activated the model dreamina-seedance-2-0-260128" (the owner's video failed): a real nooi
# server, a stand-in BytePlus that has only some Seedance models switched on, and a stand-in AI engine:
#  · a Seedance 2.0 video → BytePlus says 2.0 isn't activated → made on Seedance 2.0 Fast (switched on), at Fast's lower price
#  · the next Seedance 2.0 video goes to Fast at once (2.0 remembered as off); why.sh says which model to activate and how
#  · the Seedance card's Test in Admin forgets it (the owner activated it): 2.0 is asked again
#  · no Seedance model switched on → the AI engine makes it
# Run: python3 tests/v250.py
import json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8769; MP = 8770; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v250-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=f=440:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/clip.mp4")
FF("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")
FF("-f", "lavfi", "-i", "color=c=0x3060a0:s=400x600", "-frames:v", "1", D + "/media/person.png")
json.dump({"users": {"dev_c1": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}, "dev_c2": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
ST = {"asked": [], "off": ["dreamina-seedance-2-0-260128"], "face": False, "kieDry": False, "bp": [], "kie": [], "credit": 0}; BT, KT = {}, {}
class M(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200, ctype="application/json"):
        b = o if isinstance(o, bytes) else json.dumps(o).encode(); self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/res.mp4": return self.send(open(D + "/res.mp4", "rb").read(), ctype="video/mp4")
        if self.path.endswith("/api/v1/chat/credit"): ST["credit"] += 1; return self.send({"code": 200, "msg": "success", "data": 120})
        if self.path.startswith("/api/v3/contents/generations/tasks/"):
            t = BT.get(self.path.rsplit("/", 1)[1]) or {}; t["n"] = t.get("n", 0) + 1
            if t["n"] < 2: return self.send({"status": "running"})
            if t.get("face"): return self.send({"status": "failed", "error": {"code": "InputImageSensitiveContentDetected.PrivacyInformation", "message": "The request failed because the input image may contain real person"}})
            return self.send({"status": "succeeded", "content": {"video_url": f"http://127.0.0.1:{MP}/res.mp4"}})
        if "recordInfo" in self.path:
            return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://127.0.0.1:{MP}/res.mp4"]})}})
        return self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); b = json.loads(self.rfile.read(n) or b"{}")
        if self.path == "/api/v3/contents/generations/tasks":
            m = str(b.get("model", "")); ST["asked"].append(m)
            if m in ST["off"] or ST["off"] == ["*"]: return self.send({"error": {"code": "ModelNotOpen", "message": f"Your account 3005456623 has not activated the model {m}. Please activate the model service in the Ark Console. Request id: 0217"}}, 404)
            ST["bp"].append(b); tid = "cgt-%d" % len(ST["bp"]); BT[tid] = {"face": ST["face"]}; return self.send({"id": tid})
        if self.path.endswith("/jobs/createTask"):
            ST["kie"].append(b)
            if ST["kieDry"]: return self.send({"code": 402, "msg": "Credits insufficient"})
            return self.send({"code": 200, "data": {"taskId": "k%d" % len(ST["kie"])}})
        return self.send({}, 404)
mk = ThreadingHTTPServer(("127.0.0.1", MP), M); threading.Thread(target=mk.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "ADMIN_EMAILS", "SEEDANCE_", "ELEVEN", "SWAP_", "LOCAL_LLM", "GEMMA_", "DASHSCOPE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", MIRROR_MEDIA="false", AGENTS_AUTO_LEARN="false",
    SEEDANCE_API_KEY="bd-test-key", SEEDANCE_BASE_URL=f"http://127.0.0.1:{MP}/api/v3", KIE_API_KEY="kie-test", KIE_BASE_URL=f"http://127.0.0.1:{MP}/api/v1", ADMIN_EMAILS="boss@dev.local", MC_AGAIN_MS="300"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1200]))
def req(path, body=None, who="c1", method=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": who}, method=method or ("POST" if body is not None else "GET"))
    try: return json.loads(urllib.request.urlopen(r, timeout=60).read())
    except urllib.error.HTTPError as e: return {"status": e.code, **json.loads(e.read() or b"{}")}
def jobs(): return {j: x for U in json.load(open(D + "/data/db.json"))["users"].values() for j, x in (U.get("jobs") or {}).items()}
def wait(jid, s=60):
    for _ in range(s * 4):
        x = jobs().get(jid) or {}
        if x.get("status") in ("done", "failed"): return x
        time.sleep(0.25)
    return jobs().get(jid) or {}
J = lambda x: {k: x.get(k) for k in ("status", "prov", "error", "errors", "cost")}
V = lambda n: {"kind": "video", "model": "seedance20", "prompt": "Elias runs across the ice with his horses behind him, take %d" % n, "dur": 5, "aspect": "16:9"}
def why():
    time.sleep(3); return subprocess.run(["bash", ROOT + "/deploy/why.sh"], env=dict(os.environ, APP=D, SECRET_KEY="f" * 40, SEEDANCE_API_KEY="bd-test-key"), capture_output=True, text=True, timeout=60).stdout
def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    q20 = req("/v1/jobs/quote", {"kind": "video", "model": "seedance20", "dur": 5, "aspect": "16:9"}).get("cost"); qf = req("/v1/jobs/quote", {"kind": "video", "model": "seedance", "dur": 5, "aspect": "16:9"}).get("cost")
    b0 = req("/v1/billing").get("credits"); j = req("/v1/jobs", V(1)); x = wait(j.get("id")); b1 = req("/v1/billing").get("credits")
    chk("Seedance 2.0 not activated → made on Seedance 2.0 Fast, at Fast's price", x.get("status") == "done" and x.get("prov") == "bd@dreamina-seedance-2-0-fast-260128" and ST["asked"][:2] == ["dreamina-seedance-2-0-260128", "dreamina-seedance-2-0-fast-260128"] and b0 - b1 == qf and qf < q20, {"job": J(x), "asked": ST["asked"], "paid": b0 - b1, "q": [q20, qf]})
    n = len(ST["asked"]); j = req("/v1/jobs", V(2)); x = wait(j.get("id"))
    chk("the next Seedance 2.0 video goes to Fast at once (2.0 remembered as off)", x.get("status") == "done" and ST["asked"][n:] == ["dreamina-seedance-2-0-fast-260128"], {"asked": ST["asked"][n:], "job": J(x)})
    w = why(); line = [l for l in w.splitlines() if "NOT activated" in l]
    chk("why.sh says which model to activate and how", line and "dreamina-seedance-2-0-260128" in line[0] and "model activation" in line[0], w[-1500:])
    req("/v1/admin/providers/seedance/test", {}, who="boss"); n = len(ST["asked"]); j = req("/v1/jobs", V(3)); x = wait(j.get("id"))
    chk("the Seedance card's Test forgets it: 2.0 is asked again", ST["asked"][n:n + 1] == ["dreamina-seedance-2-0-260128"] and x.get("status") == "done", {"asked": ST["asked"][n:], "job": J(x)})
    ST["off"] = ["*"]; n = len(ST["kie"]); j = req("/v1/jobs", V(4)); x = wait(j.get("id"))
    chk("no Seedance model switched on → the AI engine makes it", x.get("status") == "done" and str(x.get("prov", "")).startswith("kie@") and len(ST["kie"]) == n + 1, {"job": J(x)})

try: main()
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate(); mk.shutdown()
if fails: print("v250 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-3000:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v250 OK")
