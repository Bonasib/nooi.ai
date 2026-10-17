# v111 The check-up showed where the time goes: one "Replace the person" took 730 s — 45 s ours, 685 s at the engine. A real nooi
# server, a stand-in engine that keeps each job waiting in its line before making it, and a slow stand-in text AI:
#  · the engine's time is split in two: waiting in its line and making it (Admin → Speed, deploy/doctor.sh); a long swap takes its
#    slowest part's
#  · our part is shorter: the video and the photos are made ready at the same time, and the text AI looks at the photo and the
#    video while it follows the person through the video; a refusal is still the same one
#  · Admin → Overview → Speed says when the engine's line is the wait, and how to try the swap at 768P (and stops once it's set)
# Run: python3 tests/v111.py
import hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8315, 8316
D = tempfile.mkdtemp(prefix="nooi-v111-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "y" * 32; now = int(time.time() * 1000)
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=6", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=6", "-vf", "drawbox=x=80:y=60:w=120:h=280:color=0x2040e0:t=fill",
   "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/clip.mp4")
ff("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=6", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")
im = Image.new("RGB", (512, 768), (240, 220, 200)); ImageDraw.Draw(im).ellipse([180, 80, 330, 260], fill=(200, 150, 120)); im.save(D + "/media/char.png")
im = Image.new("RGB", (640, 360), (128, 128, 128)); ImageDraw.Draw(im).rectangle([80, 60, 200, 340], fill=(32, 64, 224)); im.save(D + "/media/frame.png")
SLOW = lambda i: {"id": i, "kind": "video", "cap": "video", "prov": "kie@minimax-h3/reference-to-video", "status": "done", "progress": 1, "url": "/media/x.mp4", "created": now - 1500e3, "sentAt": now - 1455e3, "doneAt": now - 770e3,
                  "times": {"prep": 30, "look": 15, "queue": 420, "making": 265}, "payload": {"kind": "video", "model": "mcswap", "dur": 6, "meta": {"mcVideo": {"dur": 6}}}, "cost": 0, "title": "old swap"}
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {i: SLOW(i) for i in ("o1", "o2", "o3", "o4")}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 30000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(D + "/data/db.json", "w"))
MOCK = r'''
import json, sys, threading, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": [], "on": 0, "most": 0, "bad": False, "states": []}; T = {}; lock = threading.Lock()
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
        if "ecord" in u.path:   # waiting in line for 4 s, then making it for 3 s
            age = time.time() - T.get(urllib.parse.parse_qs(u.query).get("taskId", [""])[0], time.time()); s = "queuing" if age < 4 else "generating" if age < 7 else "success"; st["states"].append(s)
            url = f"http://localhost:{P}/res.mp4"; return self.kie({"state": s, **({"resultJson": json.dumps({"resultUrls": [url]})} if s == "success" else {})})
        self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path == "/plan": st.update(j); return self.send({"ok": 1})
        if u.path == "/api/v1/chat/credit": return self.kie(500)
        if u.path.startswith("/api/v1/"): tid = "t%d" % (len(T) + 1); T[tid] = time.time(); st["reqs"].append({"path": u.path, "body": j}); return self.kie({"taskId": tid})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text")
            kind = "look" if "You check the two inputs" in text else "pick" if "A red box marks one person" in text else "part" if "the person to replace in a video" in text else "count" if "frames from one part" in text else "other"
            with lock: st["on"] += 1; st["most"] = max(st["most"], st["on"])
            time.sleep(1.5)
            with lock: st["on"] -= 1
            o = {"photo_people": 2 if st["bad"] else 1, "video_people": 1, "video_person": "clear", "note_en": "", "note_ar": "", "keep_en": "", "sure": True,
                 "box": [0.12, 0.16, 0.32, 0.95], "who_en": "the person in blue", "people": 1, "present": "no" if st["bad"] else "yes", "where_en": "the person in blue on the left"}
            st["llm"].append(kind); return self.send({"content": [{"type": "text", "text": json.dumps(o)}]})
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
mock = lambda p, body=None: call(KPORT, p, body, None)
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
SWAP = lambda cid: {"kind": "video", "model": "mcswap", "prompt": "", "dur": 6, "aspect": "16:9", "cid": cid, "inputs": {"mcMove": "/media/clip.mp4", "mcChar": "/media/char.png", "mcWho": "/media/frame.png"},
                    "meta": {"motion83": True, "swap93": True, "consent": True, "whoTap": [0.22, 0.5]}}

def checks():
    # a swap with the person picked on a frame: the text AI's looks run side by side; the engine keeps it in line, then makes it
    j = api("/v1/jobs", SWAP("v111-a"), None); jid = j.get("id", "x")
    d = wait(lambda: (lambda x: x if x.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + jid, None, None)), 120) or {}
    s = mock("/stats"); t = d.get("times") or {}
    out["swap"] = {"status": d.get("status"), "error": d.get("error"), "times": t, "llm": s["llm"], "most": s["most"], "states": sorted(set(s["states"]))}
    ok(d.get("status") == "done" and sorted(s["llm"]) == ["look", "part", "pick"] and s["most"] >= 2, f"the text AI looks at the photo and the video while it follows the person (side by side, not one after another) {out['swap']}")
    ok(t.get("look", 99) < 4.2, f"…so its step takes the time of the longer of the two, not of all three answers (1.5 s each) {t}")
    ok(3 <= t.get("queue", 0) <= 9 and 2 <= t.get("making", 0) <= 7, f"the engine's time in two: waiting in its line ~4 s, making it ~3 s {t}")
    # a refusal is the same one as before: the photo's problem first, even if the following also found nothing
    mock("/plan", {"bad": True}); j = api("/v1/jobs", SWAP("v111-b"), None); jid = j.get("id", "x")
    d = wait(lambda: (lambda x: x if x.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + jid, None, None)), 90) or {}
    out["refused"] = [d.get("status"), d.get("error")]; mock("/plan", {"bad": False})
    ok(d.get("status") == "failed" and "This photo shows 2 people" in str(d.get("error")), f"a refusal is still the first one in the old order (the photo) {out['refused']}")
    # Admin → Speed: the engine's line, its making, and how to try 768P
    sp = api("/v1/admin/speed", None, None); sw = (sp.get("last24h") or {}).get("swap") or {}; adv = " | ".join(a["en"] for a in sp.get("advice") or []); out["speed"] = {"swap": sw, "advice": adv[:900]}
    ok(sw.get("queue") == 420 and sw.get("making") == 265, f"speed: the swaps' line and making {sw}")
    ok("waited about 7 min in the AI engine's line" in adv and 'tap "Faster (768P)" below' in adv and all(a.get("ar") for a in sp.get("advice") or []), f"speed: the line named, and how to try 768P (English · Arabic) {adv}")
    r = api("/v1/admin/providers/kie", {"apiKey": "kk", "baseUrl": f"http://localhost:{KPORT}", "inputs": '{"minimax-h3/reference-to-video":{"resolution":"768P"}}'}, None, "PUT")
    adv2 = " | ".join(a["en"] for a in api("/v1/admin/speed", None, None).get("advice") or [])
    ok("768P" not in adv2 and "line" in adv2, f"once 768P is set, it is no longer suggested {r} {adv2}")
    j = api("/v1/jobs", SWAP("v111-c"), None); jid = j.get("id", "x"); wait(lambda: (lambda x: x if x.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + jid, None, None)), 120)
    sent = [x["body"] for x in mock("/stats")["reqs"]][-1]
    ok((sent.get("input") or {}).get("resolution") == "768P", f"…and the swap is sent at 768P {sent.get('input')}")
    # the check-up shows each swap step by step
    open(D + "/.env", "w").write(f"PORT={PORT}\n"); r = subprocess.run(["bash", ROOT + "/deploy/doctor.sh"], env=dict(env, APP=D), capture_output=True, text=True, timeout=180); dout = r.stdout + r.stderr
    out["doctor"] = dout[dout.find("last Replace"):][:600]
    ok("last Replace the person / Make it move" in dout and "· 420 s · 265 s ·" in dout, f"check-up: each swap's steps, the engine's line and making {out['doctor']}")

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, SWAP_ENGINE="h3", PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock-vision", MIRROR_MEDIA="false", FREE_PERIOD="false"),
    stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30); wait(lambda: mock("/stats"), 10)
    checks()
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1))
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
