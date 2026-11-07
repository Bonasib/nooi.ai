# v258 — a script or a chapter becomes the film (after ViMax's Script2Video / Novel2Video). A real nooi server, a stand-in engine
# and a stand-in text AI: a long chapter is condensed by the story editor first; the planner gets the condensed story (not the
# raw idea) and adapts it in order; the film is made from those shots; the parts don't carry the whole script; with no text
# AI the text is cut into the shots in order. Then the page: the Script chip, its count, and the job it sends.
# Run: python3 tests/v258.py
# (from v257:) "Best quality" for a long video (after ViMax): the agents also plan how each shot ends; each shot's first picture is
# drawn twice and a vision check keeps the better one; each shot gets its last picture, and its part ends on it; the extra
# pictures are in the price held before anything is made. A real nooi server, a stand-in engine and a stand-in text AI.
#  · Best quality: 3 extra pictures a part on the price; 2 candidates a shot, the vision check sees 3 pictures (reference + 2)
#    and its pick is kept; each part's end frame is its shot's last picture; the planner was asked for each shot's end
#  · Standard: one picture a shot, no check, no end frames, the price as before; both films are made
# Run: python3 tests/v257.py
import json, os, re, shutil, subprocess, sys, tempfile, threading, time, urllib.request, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KP = 8781, 8782; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v258-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/eng")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=s=640x360", "-frames:v", "1", D + "/eng/scene.png")
json.dump({"users": {"dev_c1": {"plan": "studio", "planUntil": 4102444800000, "credits": 90000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
ST = {"reqs": [], "llm": []}; EXT = {}; LOCK = threading.Lock()
def make(tid, model, inp):
    out = D + "/eng/" + tid
    if "nano-banana" in model:
        FF("-i", D + "/eng/scene.png", "-vf", f"hue=h={(len(ST['reqs']) * 37) % 360}", out + ".png"); return ".png"
    FF("-f", "lavfi", "-i", "color=c=0x3060a0:s=320x180:r=12:d=3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", out + ".mp4"); return ".mp4"
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path.startswith("/f/"):
            b = open(D + "/eng/" + u.path[3:], "rb").read(); self.send_response(200); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        tid = (q.get("taskId") or [""])[0]
        if tid not in EXT: return self.send({"code": 200, "data": {"state": "generating"}})
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{KP}/f/{tid}{EXT[tid]}"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 500})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(x.get("text", "") for x in parts if x.get("type") == "text"); imgs = len([x for x in parts if x.get("type") == "image"])
            with LOCK: ST["llm"].append({"text": text[:8000], "images": imgs, "end": '"end"' in text})
            if "nooi's story editor" in text: return self.send({"content": [{"type": "text", "text": json.dumps({"beats": "BEATS-OK Layla meets Omar at the old souk; he gives her the map. \"Keep it safe,\" Omar says. She runs to the harbour."})}]})
            if "You choose the better film frame" in text: return self.send({"content": [{"type": "text", "text": json.dumps({"best": 3, "why": "the face is clearer"})}]})
            if "film crew" in text:
                k = len(re.findall(r"exactly (\d+) shots", text)) and int(re.findall(r"exactly (\d+) shots", text)[0]) or 2
                return self.send({"content": [{"type": "text", "text": json.dumps({"title": "Kite", "bible": "A girl in a yellow coat on a green hill, windy afternoon.", "shots": [{"shot": f"SCRIPTSHOT{i+1}: Layla and Omar at the souk", "cam": "AB"[i % 2]} for i in range(k)]})}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        with LOCK: tid = "t%d" % (len(ST["reqs"]) + 1); ST["reqs"].append({"model": j.get("model", ""), "input": j.get("input") or {}, "tid": tid})
        def work():
            try: EXT[tid] = make(tid, j.get("model", ""), j.get("input") or {})
            except Exception as e: print("mock", e); EXT[tid] = ".mp4"
        threading.Thread(target=work, daemon=True).start()
        return self.send({"code": 200, "data": {"taskId": tid}})
mk = ThreadingHTTPServer(("127.0.0.1", KP), H); threading.Thread(target=mk.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "MINIMAX_", "SEEDANCE_", "ADMIN_EMAILS", "SWAP_", "WAN_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", NV_AUTOCHECK="false", ENGINE134_POLL_MS="300",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KP}", LLM_BASE_URL=f"http://localhost:{KP}", LLM_API_KEY="llm", LLM_MODEL="mock", MIRROR_MEDIA="true", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1800]))
def req(path, body=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": "c1"}, method="POST" if body is not None else "GET")
    try: return json.loads(urllib.request.urlopen(r, timeout=60).read())
    except urllib.error.HTTPError as e: return {"status": e.code, **json.loads(e.read() or b"{}")}
def jobs(): return json.load(open(D + "/data/db.json"))["users"]["dev_c1"]["jobs"]
def wait(jid, s=180):
    for _ in range(s * 2):
        x = jobs().get(jid) or {}
        if x.get("status") in ("done", "failed"): return x
        time.sleep(0.5)
    return jobs().get(jid) or {}
def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    chapter = ("Layla walked through the old souk at dawn, past the spice stalls and the brass lamps. " * 60) + "Omar waited by the well with the map. \"Keep it safe,\" he said. " + ("The city woke around them. " * 120)
    l0 = len(ST["llm"]); j = req("/v1/jobs", {"kind": "video", "model": "kling26", "prompt": "", "dur": 20, "aspect": "16:9", "cid": "sc1", "meta": {"script258": chapter}})
    if j.get("status"): j = req("/v1/jobs", {"kind": "video", "model": "kling26", "prompt": "Layla walked through the old souk at dawn", "dur": 20, "aspect": "16:9", "cid": "sc2", "meta": {"script258": chapter}})
    x = wait(j.get("id")); calls = ST["llm"][l0:]
    ed = [c for c in calls if "story editor" in c["text"]]; plan = [c for c in calls if "film crew" in c["text"]]
    kids = [jobs().get(k) or {} for k in x.get("children") or []]
    chk("a long chapter is condensed by the story editor first; the planner adapts the condensed story", len(chapter) > 6000 and len(ed) == 1 and plan and all("Adapt this script" in c["text"] and "BEATS-OK" in c["text"] and "spice stalls and the brass lamps. Layla" not in c["text"] for c in plan), {"ed": len(ed), "plan": [c["text"][:200] for c in plan]})
    full = [c for c in ST["llm"][l0:] if "film crew" in c["text"]]
    chk("the film's shots are the planner's adaptation, made into the film; the plan is marked as from the script", (x.get("plan132") or {}).get("by") == "agents-script" and all("SCRIPTSHOT" in str(sh) for sh in (x.get("plan132") or {}).get("shots", [])) and x.get("status") == "done", {"plan": x.get("plan132"), "status": x.get("status"), "error": x.get("error")})
    chk("the job keeps the script (once), its parts don't carry it", len((x.get("payload") or {}).get("meta", {}).get("script258") or "") == len(chapter[:30000]) and kids and all(not (k.get("payload") or {}).get("meta", {}).get("script258") for k in kids), {"kids": len(kids)})
try: main()
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate(); mk.shutdown()
if fails: print("v258 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-2500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v258 OK")
