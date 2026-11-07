# v252 — from the owner's why.sh: eight Seedance 2.0 videos failed with only "The provider couldn't process this request", and
# MiniMax could have made them. A real nooi server, a stand-in BytePlus (ByteDance) and a stand-in MiniMax on this machine:
#  · ByteDance turns a video down (not a face, not a model left off) → the same video on the owner's MiniMax key, once, made there
#  · a real person's face is still not sent anywhere else (the customer gets ByteDance's reason)
#  · why.sh shows what the maker itself said (ByteDance's own words, no keys), how long ago, and the jobs still being made
# Run: python3 tests/v252.py
import json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8767; MP = 8768; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v252-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers", "deploy"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4"], check=True, timeout=60, stdin=subprocess.DEVNULL)
json.dump({"users": {"dev_c1": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
ST = {"bp": [], "mm": [], "why": "The parameter `duration` specified in the request is not valid for model dreamina-seedance-2-0-260128"}
class M(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200, ctype="application/json"):
        b = o if isinstance(o, bytes) else json.dumps(o).encode(); self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/res.mp4": return self.send(open(D + "/res.mp4", "rb").read(), ctype="video/mp4")
        if self.path.startswith("/v1/query/video_generation"): return self.send({"status": "Success", "file_id": "f1", "base_resp": {"status_code": 0}})
        if self.path.startswith("/v1/files/retrieve"): return self.send({"file": {"download_url": f"http://127.0.0.1:{MP}/res.mp4"}, "base_resp": {"status_code": 0}})
        return self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); b = json.loads(self.rfile.read(n) or b"{}")
        if self.path == "/api/v3/contents/generations/tasks":
            ST["bp"].append(b); code = "InputImageSensitiveContentDetected.PrivacyInformation" if ST.get("face") else "InvalidParameter"
            msg = "The request failed because the input image may contain real person" if ST.get("face") else ST["why"]
            return self.send({"error": {"code": code, "message": msg, "type": "BadRequest"}}, 400)
        if self.path == "/v1/video_generation": ST["mm"].append(b); return self.send({"task_id": "m%d" % len(ST["mm"]), "base_resp": {"status_code": 0}})
        if self.path == "/v1/image_generation": return self.send({"data": {"image_urls": [f"http://127.0.0.1:{MP}/res.mp4"]}, "base_resp": {"status_code": 0}})
        return self.send({}, 404)
mk = ThreadingHTTPServer(("127.0.0.1", MP), M); threading.Thread(target=mk.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "ADMIN_EMAILS", "SEEDANCE_", "ELEVEN", "SWAP_", "LOCAL_LLM", "GEMMA_", "DASHSCOPE_"))}
KEYS = dict(SECRET_KEY="f" * 40, SEEDANCE_API_KEY="bd-test-key-secret", SEEDANCE_BASE_URL=f"http://127.0.0.1:{MP}/api/v3", MINIMAX_API_KEY="mm-test-key-secret", MINIMAX_BASE_URL=f"http://127.0.0.1:{MP}")
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", MIRROR_MEDIA="false", AGENTS_AUTO_LEARN="false", ADMIN_EMAILS="boss@dev.local", **KEYS), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1500]))
def req(path, body=None, who="c1"):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": who}, method="POST" if body is not None else "GET")
    try: return json.loads(urllib.request.urlopen(r, timeout=60).read())
    except urllib.error.HTTPError as e: return {"status": e.code, **json.loads(e.read() or b"{}")}
def jobs(): return {j: x for U in json.load(open(D + "/data/db.json"))["users"].values() for j, x in (U.get("jobs") or {}).items()}
def wait(jid, s=60):
    for _ in range(s * 4):
        x = jobs().get(jid) or {}
        if x.get("status") in ("done", "failed"): return x
        time.sleep(0.25)
    return jobs().get(jid) or {}
def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    b0 = req("/v1/billing").get("credits"); j = req("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "a red kite over the sea", "dur": 5, "aspect": "16:9", "cid": "a1"}); x = wait(j.get("id")); b1 = req("/v1/billing").get("credits")
    chk("ByteDance turns a video down → the same video on the owner's MiniMax key (once), made there, charged once",
        x.get("status") == "done" and x.get("prov") == "mm183-video" and len(ST["bp"]) == 1 and len(ST["mm"]) == 1 and any("bd@" in e and "duration" in e for e in (x.get("errors") or [])) and 0 < b0 - b1,
        {"job": {k: x.get(k) for k in ("status", "prov", "error", "errors")}, "bp": len(ST["bp"]), "mm": len(ST["mm"]), "credits": [b0, b1], "j": j})
    ST["face"] = True; n0 = len(ST["mm"]); j = req("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "the man walks", "dur": 5, "aspect": "16:9", "cid": "a2"}); x = wait(j.get("id"))
    chk("a real person's face: not sent to MiniMax, the customer gets ByteDance's reason", x.get("status") == "failed" and len(ST["mm"]) == n0 and "real people's faces" in str(x.get("error")), {k: x.get(k) for k in ("status", "prov", "error", "errors")})
    ST["face"] = False
    w = subprocess.run(["bash", ROOT + "/deploy/why.sh"], env=dict(env, APP=D, **KEYS), capture_output=True, text=True, timeout=60).stdout
    chk("why.sh: what ByteDance itself said, how long ago, the jobs being made — and no key", "what the maker said:" in w and "real person" in w and "min ago" in w and "jobs being made now:" in w and "key-secret" not in w, w[-2500:])
try: main()
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate(); mk.shutdown()
if fails: print("v252 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-3000:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v252 OK")
