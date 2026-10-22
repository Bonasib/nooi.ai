# v129 — the text AI look of Replace the person on Claude Haiku 5.5, with a real nooi server, a stand-in for the AI engine, a
# stand-in for Claude (the requests are checked) and a real browser:
#  · the look goes to Claude: Haiku 5.5, the photo and three frames of the video, the answer in a fixed shape (structured
#    output), effort low, no sampling settings — and it takes seconds, not the old 15 s limit
#  · what Claude saw (the place, the light, the moves, the eyes) reaches the engine's words
#  · Claude sure there's nobody in the photo → refused with the reason; Claude down → the swap goes on without the look
#  · the owner: Admin → Speed shows who looks, how many, how fast, what it cost; "The site's text AI" sends nothing to Claude
# Run: python3 tests/v129.py
import asyncio, json, os, subprocess, tempfile, threading, time, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8351; KPORT = 8352; CPORT = 8353; KEY = "kie_v129"
D = tempfile.mkdtemp(prefix="nooi-v129-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
F = D + "/fix"; os.makedirs(F)
ff = lambda *a: subprocess.run(["ffmpeg", "-y", "-v", "error", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x30c040:s=480x640:d=4:r=25", "-f", "lavfi", "-i", "sine=f=440:d=4", "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", F + "/out.mp4")
ff("-f", "lavfi", "-i", "color=c=0xd04040:s=480x640:d=4:r=25", "-f", "lavfi", "-i", "sine=f=330:d=4", "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", F + "/move.mp4")
Image.new("RGB", (512, 640), (180, 150, 120)).save(F + "/face.png")

# ---- the stand-in for the AI engine (any task: one video)
tasks = {}; n = [0]; sent = []
class Kie(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, d): b = json.dumps({"code": 200, "msg": "success", "data": d}).encode(); self.send_response(200); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path.startswith("/files/"):
            b = open(F + "/out.mp4", "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b); return
        if u.path == "/api/v1/chat/credit": return self.send(777)
        t = tasks.get((q.get("taskId") or [""])[0])
        if not t: return self.send(None)
        t["polls"] += 1
        self.send({"state": "generating"} if t["polls"] < 2 else {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://127.0.0.1:{KPORT}/files/out.mp4"]})})
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("content-length") or 0)) or b"{}")
        if self.headers.get("authorization") != "Bearer " + KEY: return self.send(None)
        n[0] += 1; tid = "t%d" % n[0]; tasks[tid] = {"body": body, "polls": 0}; sent.append(body); self.send({"taskId": tid})

# ---- the stand-in for Claude
MODE = {"m": "ok"}; LOOKS = []; BAD = []
class Claude(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("content-length") or 0)) or b"{}")
        sch = ((body.get("output_config") or {}).get("format") or {}).get("schema") or {}
        props = sch.get("properties") or {}
        content = body["messages"][-1]["content"]; imgs = [c for c in content if c.get("type") == "image"]
        LOOKS.append({"fields": sorted(props), "imgs": len(imgs), "mode": MODE["m"]})
        if body.get("model") != "claude-haiku-5-5": BAD.append("model " + str(body.get("model")))
        for k in ("temperature", "top_p", "top_k"):
            if k in body: BAD.append("sent " + k)
        if (body.get("output_config") or {}).get("effort") != "low": BAD.append("effort")
        if sch.get("additionalProperties") is not False or set(sch.get("required") or []) != set(props): BAD.append("schema")
        if MODE["m"] == "fail":
            self.send_response(500); self.send_header("content-type", "application/json"); self.end_headers(); self.wfile.write(b'{"type":"error","error":{"type":"api_error","message":"boom"}}'); return
        time.sleep(0.4)
        if "photo_people" in props:
            v = {"photo_people": 0 if MODE["m"] == "nobody" else 1, "video_people": 1, "video_person": "clear", "note_en": "", "note_ar": "", "sure": True}
            if "scene_en" in props: v.update(keep_en="", scene_en="SCENE129 a sunny kitchen", light_en="LIGHT129 soft window light", moves_en="MOVES129 waves and turns", eyes_en="EYES129 looks at the camera")
        elif "present" in props: v = {"people": 1, "present": "yes", "where_en": "", "who_en": "", "sure": True}
        elif "box" in props: v = {"box": [0.2, 0.1, 0.8, 0.95], "who_en": "a person"}
        else: v = {"people": 1, "sure": True}
        r = {"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-haiku-5-5", "content": [{"type": "text", "text": json.dumps(v)}], "stop_reason": "end_turn", "stop_sequence": None, "usage": {"input_tokens": 3000, "output_tokens": 200}}
        b = json.dumps(r).encode(); self.send_response(200); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
for S_, P_ in ((Kie, KPORT), (Claude, CPORT)):
    srv_ = ThreadingHTTPServer(("127.0.0.1", P_), S_); threading.Thread(target=srv_.serve_forever, daemon=True).start()

def api(path, body=None, method=None):
    r = urllib.request.Request(f"http://localhost:{PORT}{path}", data=json.dumps(body).encode() if body is not None else None, headers={"content-type": "application/json"}, method=method or ("POST" if body is not None else "GET"))
    try:
        with urllib.request.urlopen(r, timeout=120) as x: return x.status, json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
def upload(path):
    name = os.path.basename(path); body = b"--B\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + name.encode() + b"\"\r\nContent-Type: application/octet-stream\r\n\r\n" + open(path, "rb").read() + b"\r\n--B--\r\n"
    return json.loads(urllib.request.urlopen(urllib.request.Request(f"http://localhost:{PORT}/v1/uploads", data=body, headers={"content-type": "multipart/form-data; boundary=B"}, method="POST"), timeout=30).read())["url"]
def swap(wait=180):
    face = upload(F + "/face.png"); mv = upload(F + "/move.mp4")
    st, r = api("/v1/jobs", {"kind": "video", "model": "mcswap", "prompt": "", "dur": 4, "aspect": "9:16", "inputs": {"mcChar": face, "mcMove": mv}, "meta": {"consent": True, "lips115": False}})
    if st != 200: return {"status": "refused", "error": r.get("error")}
    t0 = time.time()
    while time.time() - t0 < wait:
        st, j = api("/v1/jobs/" + r["id"])
        if j.get("status") in ("done", "failed"): return j
        time.sleep(1)
    return j

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MC_LOOK"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        ANTHROPIC_API_KEY="sk-test-129", ANTHROPIC_BASE_URL=f"http://127.0.0.1:{CPORT}", LLM_BASE_URL=f"http://127.0.0.1:{CPORT}",
        KIE_API_KEY=KEY, KIE_BASE_URL=f"http://127.0.0.1:{KPORT}", FREE_PERIOD="false", RECOVER_MS="999999"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        # the look on Claude
        j = swap(); look = [x for x in LOOKS if "photo_people" in x["fields"]]
        out["swap"] = {"status": j.get("status"), "error": j.get("error"), "times": j.get("times")}
        prompt = json.dumps(sent[-1] if sent else {})
        ok(j.get("status") == "done" and look and look[-1]["imgs"] == 4 and {"scene_en", "light_en", "moves_en", "eyes_en", "sure"} <= set(look[-1]["fields"]), f"the look goes to Claude with the photo and three frames, the answer in a fixed shape {out['swap']} {look[-1:] }")
        tl = (j.get("times") or {}).get("look")
        ok(tl is not None and tl < 5, f"the look takes seconds, not the old 15 s limit ({tl} s)")
        ok("SCENE129" in prompt and "LIGHT129" in prompt and "EYES129" in prompt, f"what Claude saw reaches the engine's words {prompt[:300]}")
        ok(not BAD, f"each request: Haiku 5.5, structured output, effort low, no sampling settings {sorted(set(BAD))}")
        # nobody in the photo → refused with the reason
        MODE["m"] = "nobody"; j = swap(); out["nobody"] = {"status": j.get("status"), "error": j.get("error")}
        ok(j.get("status") == "failed" and "can't see a person in the photo" in str(j.get("error")), f"Claude sure nobody's in the photo → refused with the reason {out['nobody']}")
        # Claude down → the swap goes on without the look
        MODE["m"] = "fail"; j = swap(); out["down"] = {"status": j.get("status"), "look": (j.get("times") or {}).get("look")}
        ok(j.get("status") == "done" and (out["down"]["look"] or 0) < 16, f"Claude down → the swap goes on without the look {out['down']}")
        MODE["m"] = "ok"
        # the owner's row
        st, sp = api("/v1/admin/speed"); lk = sp.get("look") or {}; out["look info"] = lk
        ok(lk.get("by") == "claude" and lk.get("ready") and lk["week"]["looks"] >= 2 and lk["week"]["fails"] >= 1 and lk["week"]["usd"] > 0 and lk["week"]["avgSec"] is not None, f"Admin → Speed: who looks, how many, how fast, the cost {lk}")
        async with async_playwright() as p:
            b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1280, "height": 900}); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
            await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
            await pg.evaluate("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;S.admTab='overview';go('admin');renderAll()}")
            await pg.wait_for_timeout(2500)
            r = await pg.evaluate("""()=>{const row=document.querySelector('.lk129');if(!row)return{has:false};const on=row.querySelector('[aria-pressed="true"]');return {has:true,on:on&&on.dataset.by,text:row.textContent.slice(0,140)}}""")
            out["page"] = r; ok(r.get("has") and r["on"] == "claude" and "Claude Haiku 5.5" in r["text"], f"the Speed card shows the look on Claude {r}")
            await pg.click('[data-act="lk129"][data-by="chain"]'); await pg.wait_for_timeout(1500)
            ok(not errs, f"no page errors {errs[:3]}"); await b.close()
        st, sp = api("/v1/admin/speed"); ok((sp.get("look") or {}).get("by") == "chain", f"the owner switches the look to the site's text AI {sp.get('look')}")
        n0 = len(LOOKS); j = swap(); ok(j.get("status") == "done" and len(LOOKS) == n0, f"…then nothing goes to Claude for the look {len(LOOKS) - n0} {j.get('status')}")
    finally:
        srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:5000])
asyncio.run(main())
