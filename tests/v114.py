# v114 "Seedance is not slow as MiniMax H3 + analyze the environment and the light and the eye move with flickering eyes and the
# body movement and the head movement". A real nooi server, a stand-in engine that records every request, a stand-in text AI and
# the page:
#  · Replace the person runs on Seedance 2.0 (bytedance/seedance-2): @Video1 the client's video, @Image1 the new person (@Image2 the
#    person to replace when one was picked), reference fields only (no first frame), 1080p (720p with "Faster"), no engine sound
#    (the video's own sound is put back), the words ask for the same body, head, hand, face, lip and eye movement and blinks, and
#    the video's light on the new person
#  · the text AI's look adds the place, the light, how the person moves and their eyes — to Seedance's words and to H3's
#  · Admin → Overview → Speed: the engine (Seedance 2.0 · faster / MiniMax H3) with one tap (owners / admins), its resolutions
#  · a plain Seedance video (first frame) is not touched
# Run: python3 tests/v114.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, hashlib
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8321, 8322
D = tempfile.mkdtemp(prefix="nooi-v114-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "s" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 30000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(D + "/data/db.json", "w"))
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=5", "-vf", "drawbox=x=80:y=60:w=120:h=280:color=0x2040e0:t=fill",
   "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/clip.mp4")
ff("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")
ff("-f", "lavfi", "-i", "color=c=0x3060a0:s=640x360", "-frames:v", "1", D + "/media/house.png")
im = Image.new("RGB", (512, 768), (240, 220, 200)); ImageDraw.Draw(im).ellipse([180, 80, 330, 260], fill=(200, 150, 120)); im.save(D + "/media/char.png")
im = Image.new("RGB", (640, 360), (128, 128, 128)); ImageDraw.Draw(im).rectangle([80, 60, 200, 340], fill=(32, 64, 224)); im.save(D + "/media/frame.png")
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": []}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.mp4":
            b = open(DIR + "/res.mp4", "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        url = f"http://localhost:{P}/res.mp4"; return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [url]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text")
            if "You check the two inputs" in text:
                st["llm"].append("look"); o = {"photo_people": 1, "video_people": 1, "video_person": "clear", "note_en": "", "note_ar": "", "keep_en": "a red mug", "sure": True,
                     "scene_en": "a bright kitchen with white cabinets", "light_en": "soft daylight from a window on the left", "moves_en": "walks to the counter, turns her head to the right, waves",
                     "eyes_en": "looks at the camera, blinks twice"}
            elif "A red box marks one person" in text: st["llm"].append("pick"); o = {"box": [0.12, 0.16, 0.32, 0.95], "who_en": "the person in blue"}
            elif "the person to replace in a video" in text: st["llm"].append("part"); o = {"people": 1, "present": "yes", "where_en": "the person in blue on the left", "who_en": "the person in blue", "sure": True}
            else: st["llm"].append("other"); o = {}
            return self.send({"content": [{"type": "text", "text": json.dumps(o)}]})
        st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "data": {"taskId": "t%d" % len(st["reqs"])}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, tok=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
reqs = lambda: json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())["reqs"]
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
SW = lambda cid, **inp: {"kind": "video", "model": "mcswap", "prompt": "", "dur": 5, "aspect": "16:9", "cid": cid, "inputs": {"mcMove": "/media/clip.mp4", "mcChar": "/media/char.png", **inp}, "meta": {"motion83": True, "swap93": True, "consent": True, **({"whoTap": [0.22, 0.5]} if inp.get("mcWho") else {})}}
def swap(cid, **inp):
    n = len(reqs()); j = api("/v1/jobs", SW(cid, **inp)); d = wait(lambda: (lambda x: x if x.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + j.get("id", "x"))), 90) or {}
    b = [x["body"] for x in reqs()[n:]]; return d, (b[-1] if b else {})

def server_checks():
    d, b = swap("s1"); i = b.get("input") or {}; pr = i.get("prompt", ""); out["seedance"] = {"status": d.get("status"), "model": b.get("model"), "input": {k: v for k, v in i.items() if k != "prompt"}, "prompt": pr}
    ok(d.get("status") == "done" and b.get("model") == "bytedance/seedance-2", f"Replace the person runs on Seedance 2.0 {out['seedance']}")
    ok(len(i.get("reference_image_urls") or []) == 1 and str((i.get("reference_image_urls") or [""])[0]).endswith(".jpg") or str((i.get("reference_image_urls") or [""])[0]).endswith(".png"), f"@Image1: the new person {i.get('reference_image_urls')}")
    ok(len(i.get("reference_video_urls") or []) == 1 and "first_frame_url" not in i and i.get("resolution") == "1080p" and i.get("aspect_ratio") == "adaptive" and i.get("generate_audio") is False and i.get("duration") == 5,
       f"@Video1, reference fields only, 1080p, no engine sound, the video's length {out['seedance']['input']}")
    ok(pr.startswith("Replace the person in @Video1 with the person in @Image1.") and "head turns and tilts" in pr and "eye movement and natural blinks" in pr and "The light of @Video1 falls on the new person the same way" in pr,
       f"the words: who changes, the same body / head / eyes / blinks, the same light {pr}")
    ok("Place: a bright kitchen with white cabinets." in pr and "Light: soft daylight from a window on the left." in pr and "Movement: walks to the counter, turns her head to the right, waves." in pr and "Eyes: looks at the camera, blinks twice." in pr and "(a red mug)" in pr,
       f"…and what the text AI saw: the place, the light, the movement, the eyes, what to keep {pr}")
    d, b = swap("s2", mcWho="/media/frame.png"); i = b.get("input") or {}; pr = i.get("prompt", ""); out["picked"] = pr[:300]
    ok(len(i.get("reference_image_urls") or []) == 2 and pr.startswith("Replace the person shown in @Image2 (the person in blue on the left) in @Video1 with the person in @Image1."), f"a picked person is @Image2, with where they are {pr[:300]}")
    r = api("/v1/admin/speed/swapres", {"res": "768P"}); d, b = swap("s3"); out["fast"] = (b.get("input") or {}).get("resolution")
    ok(r.get("swapRes") == "768P" and out["fast"] == "720p", f"'Faster' on Seedance = 720p {r} {out['fast']}"); api("/v1/admin/speed/swapres", {"res": "2K"})
    no = api("/v1/admin/speed/swapengine", {"engine": "h3"}, TOKEN); bad = api("/v1/admin/speed/swapengine", {"engine": "nope"}); r = api("/v1/admin/speed/swapengine", {"engine": "h3"})
    ok(no.get("_status") in (401, 403) and bad.get("_status") == 400 and r.get("swapEngine") == "h3" and api("/v1/admin/speed").get("swapEngine") == "h3", f"the engine switch: owners / admins only; a known engine only {no} {bad} {r}")
    d, b = swap("s4"); i = b.get("input") or {}; pr = i.get("prompt", ""); out["h3"] = {"model": b.get("model"), "res": i.get("resolution"), "prompt": pr[-700:]}
    ok(b.get("model") == "minimax-h3/reference-to-video" and i.get("resolution") == "2K" and "<Picture 1>" in pr and "Place: a bright kitchen with white cabinets." in pr and "eye movement and blinks" in pr and "Eyes: looks at the camera, blinks twice." in pr,
       f"on MiniMax H3: its own layout, with the place, light, movement and eyes too {out['h3']}")
    api("/v1/admin/speed/swapengine", {"engine": "seedance"})
    n = len(reqs()); api("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "a boat at sea", "dur": 5, "aspect": "16:9", "cid": "plain", "inputs": {"vStart": "/media/house.png"}, "meta": {}})
    pb = (wait(lambda: reqs()[n:] or None, 20) or [{}])[-1].get("body", {}); pi = pb.get("input") or {}; out["plain"] = {"model": pb.get("model"), "keys": sorted(pi)}
    ok(pb.get("model") == "bytedance/seedance-2" and pi.get("first_frame_url") and "reference_video_urls" not in pi and not str(pi.get("prompt", "")).startswith("Replace"), f"a plain Seedance video is not touched {out['plain']}")

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 390, "height": 844})).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.view='admin';S.admTab='overview';renderAll()}")
        t = None
        for _ in range(40):
            t = await E("()=>{const c=[...document.querySelectorAll('.sw112')].map(x=>x.textContent);return c.length>=2?c:null}")
            if t: break
            await asyncio.sleep(.25)
        out["card"] = t
        on = lambda k, v: E(f"()=>document.querySelector('[data-act={k}][data-{'eng' if k=='sw114' else 'res'}=\"{v}\"]')?.classList.contains('on')")
        ok(t and "Seedance 2.0" in t[0] and "MiniMax H3" in t[0] and "Sharpest (1080p)" in t[1] and "Faster (720p)" in t[1] and await on("sw114", "seedance"), f"the speed card: the engine (Seedance on) and its resolutions {t}")
        await pg.click('[data-act=sw114][data-eng="h3"]'); await pg.wait_for_timeout(1200)
        t2 = await E("()=>[...document.querySelectorAll('.sw112')].map(x=>x.textContent)")
        ok(await on("sw114", "h3") and "Sharpest (2K)" in t2[1] and api("/v1/admin/speed").get("swapEngine") == "h3", f"one tap: MiniMax H3, its resolutions {t2}")
        await pg.click('[data-act=sw114][data-eng="seedance"]'); await pg.wait_for_timeout(1000)
        ok(api("/v1/admin/speed").get("swapEngine") == "seedance", "…and back to Seedance 2.0")
        await E("()=>{S.lang='ar';renderAll()}"); await pg.wait_for_timeout(500)
        ta = await E("()=>[...document.querySelectorAll('.sw112')].map(x=>x.textContent).join(' | ')")
        ok("استبدال الشخص — المحرّك" in ta and "أسرع (720p)" in ta, f"…in Arabic {ta}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "SWAP_ENGINE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, SWAP_ENGINE="seedance", PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock-vision", MIRROR_MEDIA="false", FREE_PERIOD="false"),
    stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30); wait(lambda: reqs() is not None, 10)
    server_checks()
    asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1))
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
