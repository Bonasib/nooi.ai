# v247 — "make sure Seedance takes over every time the engine gives an error": a real nooi server, a stand-in AI engine and a
# stand-in BytePlus (ByteDance):
#  · a Kling 3.0 video the engine refuses (out of credits) → made by Seedance on the owner's ByteDance key, charged once; the owner
#    is still told the engine is out of credits
#  · a Wan video the engine takes and then fails on its own side → made by Seedance
#  · a Character Swap on the MiniMax H3 swap engine the engine refuses → made by Seedance
#  · Kling Motion Control (Seedance can't do it) isn't sent to Seedance — it fails with the engine's reason, refunded
# (the v246 notes follow)
# v246 — from the owner's why.sh: "The AI engine account ran out of credits", "balance not read (HTTP 404)", and every Character
# Swap going to the engine. A real nooi server, a stand-in BytePlus (ByteDance) and a stand-in AI engine on this machine:
#  · the engine's balance is read from the same address the jobs use: a saved base like …/api/v1 no longer gives a 404, so a top-up
#    is seen by itself (the "out of credits" mark clears)
#  · a Character Swap (Seedance as the swap engine) goes to the owner's ByteDance key first: the video and the new person as
#    BytePlus references, made and saved, charged once
#  · ByteDance turns down a real person's face → the same swap on the AI engine, once (made there)
#  · …but while the engine is out of credits, the customer is told ByteDance's reason (not "the engine can't take work") and the
#    engine isn't asked
# Run: python3 tests/v246.py
import json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8765; MP = 8766; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v247-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=f=440:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/clip.mp4")
FF("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")
FF("-f", "lavfi", "-i", "color=c=0x3060a0:s=400x600", "-frames:v", "1", D + "/media/person.png")
json.dump({"users": {"dev_c1": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}, "dev_c2": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
ST = {"face": False, "kieDry": False, "bp": [], "kie": [], "credit": 0}; BT, KT = {}, {}
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
            if ST["kie"] and str(ST["kie"][int(self.path.rsplit("k", 1)[-1]) - 1].get("model", "")).startswith("wan"): return self.send({"code": 200, "data": {"state": "fail", "failMsg": "internal error", "failCode": "500"}})
            return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://127.0.0.1:{MP}/res.mp4"]})}})
        return self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); b = json.loads(self.rfile.read(n) or b"{}")
        if self.path == "/api/v3/contents/generations/tasks":
            ST["bp"].append(b); tid = "cgt-%d" % len(ST["bp"]); BT[tid] = {"face": ST["face"]}; return self.send({"id": tid})
        if self.path.endswith("/jobs/createTask"):
            ST["kie"].append(b)
            if ST["kieDry"] or str(b.get("model", "")).startswith(("kling", "minimax-h3")): return self.send({"code": 402, "msg": "Credits insufficient"})
            return self.send({"code": 200, "data": {"taskId": "k%d" % len(ST["kie"])}})
        return self.send({}, 404)
mk = ThreadingHTTPServer(("127.0.0.1", MP), M); threading.Thread(target=mk.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "ADMIN_EMAILS", "SEEDANCE_", "ELEVEN", "SWAP_", "LOCAL_LLM", "GEMMA_", "DASHSCOPE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", MIRROR_MEDIA="false", AGENTS_AUTO_LEARN="false",
    SEEDANCE_API_KEY="bd-test-key", SEEDANCE_BASE_URL=f"http://127.0.0.1:{MP}/api/v3", KIE_API_KEY="kie-test", KIE_BASE_URL=f"http://127.0.0.1:{MP}/api/v1", ADMIN_EMAILS="boss@dev.local", MC_AGAIN_MS="300", SWAP_ENGINE="h3"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
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
J = lambda x: {k: x.get(k) for k in ("status", "prov", "error", "errors", "triedBd247")}
def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    b0 = req("/v1/billing").get("credits"); j = req("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "a red car drives through the rain at night", "dur": 5, "aspect": "16:9"}); x = wait(j.get("id")); b1 = req("/v1/billing").get("credits")
    al = req("/v1/me", who="boss").get("alerts138") or {}
    chk("a Kling video the engine refuses (no credits) → made by Seedance on the ByteDance key, charged once", x.get("status") == "done" and str(x.get("prov", "")).startswith("bd@") and str(x.get("triedBd247", "")).startswith("kie@kling") and 0 < b0 - b1 and ST["bp"], {"job": J(x), "credits": [b0, b1], "j": j})
    chk("…and the owner is still told the engine is out of credits", (al.get("engine") or al.get("kie") or {}).get("type") == "quota", al)
    n = len(ST["bp"]); j = req("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "waves on a quiet beach", "dur": 5, "aspect": "16:9"}); x = wait(j.get("id"))
    chk("a Wan video the engine takes and then fails → made by Seedance", x.get("status") == "done" and str(x.get("prov", "")).startswith("bd@") and str(x.get("triedBd247", "")).startswith("kie@wan") and len(ST["bp"]) == n + 1, {"job": J(x), "j": j})
    n = len(ST["bp"]); j = req("/v1/jobs", {"kind": "video", "model": "mcswap", "prompt": "", "cid": "sw-h3", "dur": 5, "aspect": "16:9", "inputs": {"mcMove": "/media/clip.mp4", "mcChar": "/media/person.png"}, "meta": {"motion83": True, "swap93": True, "consent": True}}); x = wait(j.get("id"), 90)
    roles = [c.get("role") for c in (ST["bp"][-1].get("content", []) if len(ST["bp"]) > n else [])]
    chk("a Character Swap on the H3 swap engine the engine refuses → made by Seedance (the video and the person as references)", x.get("status") == "done" and str(x.get("prov", "")).startswith("bd@") and "reference_video" in roles and "reference_image" in roles, {"job": J(x), "roles": roles, "j": j})
    n = len(ST["bp"]); b2 = req("/v1/billing", who="c2").get("credits"); j = req("/v1/jobs", {"kind": "video", "model": "mc30", "prompt": "", "dur": 5, "inputs": {"mcMove": "/media/clip.mp4", "mcChar": "/media/person.png"}, "meta": {"motion83": True, "consent": True}}, who="c2"); x = wait(j.get("id"), 90); time.sleep(1); b3 = req("/v1/billing", who="c2").get("credits")
    chk("Kling Motion Control (Seedance can't do it) isn't sent to Seedance — failed, refunded", x.get("status") == "failed" and len(ST["bp"]) == n and b2 == b3 and not x.get("triedBd247"), {"job": J(x), "credits": [b2, b3], "j": j})

try: main()
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate(); mk.shutdown()
if fails: print("v247 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-3000:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v247 OK")
