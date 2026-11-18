# v271 — MiniMax H3 (Hailuo 3) in place of Hailuo 2.x on the owner's MiniMax key: the v2 address with the words and pictures in
# "content" (platform.minimax.io → Create Video Generation Task / Query Task), sound always (H3 makes it), a Hailuo 2.x name saved in
# Admin read as H3, 4–15 s as asked, 768P, the shape for words only / "adaptive" with a picture, the price following H3's cost, and
# MiniMax's v2 errors read. Run: python3 tests/v271.py
import json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8813, 8814; B = f"http://localhost:{PORT}"; M = f"http://127.0.0.1:{MP}"
D = tempfile.mkdtemp(prefix="nooi-v271-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=24:d=5", "-f", "lavfi", "-i", "sine=f=440:d=5", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", D + "/res.mp4"], check=True, timeout=90, stdin=subprocess.DEVNULL)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=640x360", "-frames:v", "1", D + "/media/a.jpeg"], check=True, timeout=60, stdin=subprocess.DEVNULL)
shutil.copy(D + "/media/a.jpeg", D + "/media/b.jpeg")
json.dump({"users": {"dev_someone": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
ST = {"mm": [], "v1": [], "bp": [], "broke": False}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200, ct="application/json"):
        b = o if isinstance(o, bytes) else json.dumps(o).encode(); self.send_response(code); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/res.mp4": return self.send(open(D + "/res.mp4", "rb").read(), ct="video/mp4")
        if self.path.startswith("/v2/query/video_generation/"): return self.send({"task": {"id": self.path.split("/")[-1], "model": "MiniMax-H3", "status": "succeeded", "content": {"url": M + "/res.mp4"}}})
        if self.path.startswith("/api/v3/contents/generations/tasks/"): return self.send({"status": "succeeded", "content": {"video_url": M + "/res.mp4"}})
        return self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); b = json.loads(self.rfile.read(n) or b"{}")
        if self.path == "/v2/video_generation":
            ST["mm"].append(b)
            if ST["broke"]: return self.send({"type": "error", "error": {"type": "insufficient_balance_error", "message": "insufficient balance (1008)", "http_code": "402"}, "request_id": "x"}, 402)
            return self.send({"task_id": "h3-%d" % len(ST["mm"])})
        if self.path.startswith("/v1/"): ST["v1"].append(self.path); return self.send({"base_resp": {"status_code": 2013, "status_msg": "not expected"}})
        if self.path == "/api/v3/contents/generations/tasks": ST["bp"].append(b); return self.send({"id": "cgt-%d" % len(ST["bp"])})
        return self.send({}, 404)
mk = ThreadingHTTPServer(("127.0.0.1", MP), H); threading.Thread(target=mk.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_", "FAL_", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", ADMIN_EMAILS="boss@dev.local",
    SEEDANCE_API_KEY="bd-test-key", SEEDANCE_BASE_URL=M + "/api/v3"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
def api(path, body=None, who="someone", method=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": who}, method=method or ("POST" if body is not None else "GET"))
    try: return json.loads(urllib.request.urlopen(r, timeout=60).read())
    except urllib.error.HTTPError as e: return {"err": e.code, "body": e.read().decode()[:400]}
def make(body):
    b = {"kind": "video", "prompt": "A fisherman laughs and says: \"What a catch!\"", "aspect": "16:9", "dur": 5, "count": 1}; b.update(body); r = api("/v1/jobs", b)
    jid = r.get("id"); j = {}
    for _ in range(90):
        time.sleep(0.7); j = next((x for x in (api("/v1/jobs").get("jobs") or []) if x.get("id") == jid), {})
        if j.get("status") in ("done", "failed"): break
    return r, j
def credits(): return api("/v1/billing").get("credits")
try:
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    # the owner's MiniMax key, with the old Hailuo 2.3 name still saved as the video model
    r = api("/v1/admin/providers/minimax", {"apiKey": "mm-key", "baseUrl": M, "videoModel": "MiniMax-Hailuo-2.3"}, who="boss", method="PUT")
    chk("the owner saves the MiniMax key", "err" not in r, r)
    cfg = api("/v1/config"); cap = (cfg.get("caps187") or {}).get("hailuo")
    chk("MiniMax videos are marked as always making sound", cap and cap.get("audio") == "always", cap)
    # 1. words only, tall, 8 s
    n0 = len(ST["mm"]); c0 = credits(); r, j = make({"model": "hailuo", "aspect": "9:16", "dur": 8})
    b = ST["mm"][n0] if len(ST["mm"]) > n0 else {}
    chk("a Hailuo 2.x name saved in Admin is sent as MiniMax-H3 on the v2 address (not the old one)", b.get("model") == "MiniMax-H3" and not ST["v1"], [b.get("model"), ST["v1"]])
    chk("words only: one text item, the shape asked (9:16), 8 s, 768P", [x.get("type") for x in b.get("content", [])] == ["text"] and b.get("ratio") == "9:16" and b.get("duration") == 8 and b.get("resolution") == "768P", {k: b.get(k) for k in ("ratio", "duration", "resolution", "content")})
    chk("the words carry the spoken line (sound is on for H3)", "What a catch" in ((b.get("content") or [{}])[0].get("text") or ""), b.get("content"))
    chk("the video is made", j.get("status") == "done", j)
    f = D + "/media/" + str(j.get("url") or "").split("/media/")[-1]
    st = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", f], capture_output=True, text=True, timeout=30).stdout.split() if os.path.exists(f) else []
    chk("the finished file has H3's sound", "audio" in st, st)
    paid = (c0 or 0) - (credits() or 0)
    chk("the price follows H3's cost ($0.08/s at 768P — more than Hailuo 2.3)", paid >= 120, [paid, j.get("cost")])
    # 2. a first and a last picture → first_frame + last_frame, the picture decides the shape
    n0 = len(ST["mm"]); r, j = make({"model": "hailuo", "inputs": {"startImage": "/media/a.jpeg", "vEnd": "/media/b.jpeg"}})
    b = ST["mm"][n0] if len(ST["mm"]) > n0 else {}; imgs = [x for x in b.get("content", []) if x.get("type") == "image_url"]
    chk("pictures go as first_frame and last_frame (their bytes), the shape 'adaptive'", [x.get("role") for x in imgs] == ["first_frame", "last_frame"] and all(str(x["image_url"]["url"]).startswith("data:image/jpeg;base64,") for x in imgs) and b.get("ratio") == "adaptive",
        [[x.get("role"), str(x.get("image_url", {}).get("url"))[:30]] for x in imgs] + [b.get("ratio")])
    # 3. MiniMax says the balance is empty → its reason read, nothing charged
    ST["broke"] = True; c0 = credits(); r, j = make({"model": "hailuo", "prompt": "A quiet street at night"}); ST["broke"] = False
    chk("MiniMax's empty balance → failed, nothing charged", j.get("status") == "failed" and credits() == c0, [j.get("status"), j.get("error"), c0, credits()])
    chk("…and the owner can read why (insufficient balance)", any("insufficient balance" in str(e).lower() or "top up" in str(e).lower() for e in (j.get("errors") or [])) or "insufficient balance" in open(D + "/srv.log").read().lower(), [j.get("errors"), open(D + "/srv.log").read()[-400:]])
    # 4. "Everything on MiniMax" on → a talking video stays on MiniMax (H3 has sound), Seedance isn't asked
    r = api("/v1/admin/minimax183", {"all": True}, who="boss", method="PUT")
    n0, b0 = len(ST["mm"]), len(ST["bp"]); r, j = make({"model": "auto", "meta": {"audio": True}})
    chk("'Everything on MiniMax' keeps a video with sound on MiniMax", len(ST["mm"]) == n0 + 1 and len(ST["bp"]) == b0, [len(ST["mm"]) - n0, len(ST["bp"]) - b0, j.get("prov"), j.get("status")])
finally:
    srv.terminate(); mk.shutdown(); shutil.rmtree(D, ignore_errors=True)
print("FAIL\n- " + "\n- ".join(fails) if fails else "v271: MiniMax H3 with its sound on the owner's key — all checks passed")
sys.exit(1 if fails else 0)
