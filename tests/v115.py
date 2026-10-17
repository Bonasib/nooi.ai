# v115 "And realistic voice" + "Also lips sync": Replace the person keeps the video's own (real) voice, and now the new person's
# lips follow it — the engine's video lip sync (volcengine/video-to-video-lip-sync) runs on the swap with the video's voice. A real
# nooi server, a stand-in engine (swap + lip sync) and the page:
#  · on: after the swap the lip sync gets the swapped video + the video's voice (an mp3 cut from it); the card says "Matching the
#    lips to the voice…"; the result is the lip-synced video; the price = the swap + the lips (both shown on the page first)
#  · the lip sync fails → the swap as it came, a note in English and Arabic, the lips part not charged
#  · a video with no sound → no lip sync, a note, not charged; off → no lip sync at all
#  · the page: the choice with its price, on by default; off lowers the button's price; the step line and the note on the card
# Run: python3 tests/v115.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8323, 8324
D = tempfile.mkdtemp(prefix="nooi-v115-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "l" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 30000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(D + "/data/db.json", "w"))
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/talk.mp4")
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/media/silent.mp4")
ff("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")
ff("-f", "lavfi", "-i", "color=c=0x20a040:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/lips.mp4")
im = Image.new("RGB", (512, 768), (240, 220, 200)); ImageDraw.Draw(im).ellipse([180, 80, 330, 260], fill=(200, 150, 120)); im.save(D + "/media/char.png")
MOCK = r'''
import json, sys, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "lipsFail": False}; T = {}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def file(self, n):
        b = open(DIR + "/" + n, "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path in ("/res.mp4", "/lips.mp4"): return self.file(u.path[1:])
        t = T.get(urllib.parse.parse_qs(u.query).get("taskId", [""])[0]) or {}
        if "lip-sync" in t.get("model", ""):
            if t["fail"]: return self.send({"code": 200, "data": {"state": "fail", "failMsg": "lip sync failed", "failCode": "500"}})
            if time.time() - t["t"] < 3: return self.send({"code": 200, "data": {"state": "generating"}})
            return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/lips.mp4"]})}})
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/res.mp4"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/plan": st.update(j); return self.send({"ok": 1})
        st["reqs"].append({"path": u.path, "body": j}); tid = "t%d" % len(st["reqs"]); T[tid] = {"model": str(j.get("model", "")), "t": time.time(), "fail": st["lipsFail"]}
        return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def call(port, p, body=None, tok=TOKEN):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
api = lambda p, body=None, tok=TOKEN: call(PORT, p, body, tok)
mock = lambda p, body=None: call(KPORT, p, body, None)
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
SW = lambda cid, video, lips=True: {"kind": "video", "model": "mcswap", "prompt": "", "dur": 5, "aspect": "16:9", "cid": cid, "inputs": {"mcMove": "/media/" + video, "mcChar": "/media/char.png"},
                                    "meta": {"motion83": True, "swap93": True, "consent": True, **({"lips115": True} if lips else {})}}
credits = lambda: api("/v1/billing").get("credits")
def run(cid, video, lips=True, fail=False):
    mock("/plan", {"lipsFail": fail}); n = len(mock("/stats")["reqs"]); c0 = credits(); j = api("/v1/jobs", SW(cid, video, lips)); seen = set()
    def fin():
        x = api("/v1/jobs/" + j.get("id", "x")); seen.add(x.get("stage")); return x if x.get("status") in ("done", "failed") else None
    d = wait(fin, 90) or {}; time.sleep(.5)
    return d, [x["body"] for x in mock("/stats")["reqs"][n:]], c0 - (credits() or 0), seen, j

def server_checks():
    pr = api("/v1/config").get("prices", {}).get("video", {}); P_SW, P_LIPS = pr.get("mcswap"), pr.get("swaplips"); out["prices"] = [P_SW, P_LIPS]
    ok(P_SW and P_LIPS, f"the lips have a price the page can show {out['prices']}")
    d, b, spent, seen, j = run("on", "talk.mp4"); lips = [x for x in b if "lip-sync" in str(x.get("model"))]; li = (lips or [{}])[0].get("input", {})
    out["on"] = {"status": d.get("status"), "url": d.get("url"), "stages": sorted(str(s) for s in seen), "lips": li, "spent": spent, "cost": j.get("cost"), "note": d.get("note115")}
    ok(d.get("status") == "done" and len(lips) == 1 and str(li.get("video_url", "")).startswith(f"http://localhost:{PORT}/media/") and str(li.get("audio_url", "")).endswith("-voice.mp3") and li.get("mode") == "basic",
       f"on: the lip sync gets the swapped video and the video's voice {out['on']}")
    a = urllib.request.urlopen(li.get("audio_url")) if li.get("audio_url") else None
    ok(a is not None and a.status == 200 and len(a.read()) > 1000, "the voice is cut from the client's video and readable by the engine")
    ok("lips" in seen and d.get("url") != None and not d.get("note115"), f"the card says the lips are being matched; the result is the lip-synced video {out['on']}")
    ok(spent == P_SW + P_LIPS, f"the price: the swap + the lips {spent} vs {P_SW}+{P_LIPS}")
    d2, b2, spent2, _, _ = run("fail", "talk.mp4", fail=True); out["fail"] = {"status": d2.get("status"), "note": d2.get("note115"), "spent": spent2, "url": d2.get("url")}
    ok(d2.get("status") == "done" and d2.get("url") and (d2.get("note115") or {}).get("en", "").startswith("The lips couldn't be matched to the voice this time") and "تعذّرت مطابقة الشفاه" in (d2.get("note115") or {}).get("ar", "") and spent2 == P_SW,
       f"the lip sync fails: the swap as it came, a note (EN + AR), the lips not charged {out['fail']}")
    d3, b3, spent3, _, _ = run("silent", "silent.mp4"); out["silent"] = {"status": d3.get("status"), "note": d3.get("note115"), "spent": spent3, "lipsReqs": len([x for x in b3 if "lip-sync" in str(x.get("model"))])}
    ok(d3.get("status") == "done" and out["silent"]["lipsReqs"] == 0 and "no voice" in (d3.get("note115") or {}).get("en", "") and spent3 == P_SW, f"no sound in the video: no lip sync, a note, not charged {out['silent']}")
    d4, b4, spent4, _, _ = run("off", "talk.mp4", lips=False); out["off"] = {"status": d4.get("status"), "lipsReqs": len([x for x in b4 if "lip-sync" in str(x.get("model"))]), "spent": spent4, "note": d4.get("note115")}
    ok(d4.get("status") == "done" and out["off"]["lipsReqs"] == 0 and spent4 == P_SW and not d4.get("note115"), f"off: no lip sync at all {out['off']}")
    return P_LIPS

async def page_checks(P_LIPS):
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 390, "height": 844})).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;MC83().mode='swap';go('motion');renderAll()}"); await pg.wait_for_timeout(800)
        r = await E("()=>{const l=document.querySelector('.lips115');const btn=document.querySelector('[data-act=mc-make] .cost');return l?{t:l.textContent,on:l.querySelector('input').checked,cost:btn&&btn.textContent}:null}")
        out["page"] = r
        ok(r and r["on"] and "Lips follow the voice" in r["t"] and f"+{P_LIPS}" in r["t"], f"the choice with its price, on by default {r}")
        await pg.click(".lips115 input"); await pg.wait_for_timeout(500)
        r2 = await E("()=>({on:document.querySelector('.lips115 input').checked,cost:document.querySelector('[data-act=mc-make] .cost').textContent})")
        c1, c2 = int(str(r["cost"]).split()[0]), int(str(r2["cost"]).split()[0])
        ok(not r2["on"] and c1 - c2 == P_LIPS, f"off lowers the button's price by the lips {r['cost']} → {r2['cost']}")
        h = await E("()=>{const g={id:'z1',kind:'video',status:'rendering',stage:'lips',progress:1,created:Date.now(),prompt:'swap',title:'swap',aspect:'16:9',meta:{motion83:true}};return previewCol(g,[])}")
        ok("Matching the lips to the voice" in h, "the card: the lips step")
        h2 = await E("()=>{const g={id:'z2',kind:'video',status:'complete',progress:1,created:Date.now(),prompt:'swap',title:'swap',aspect:'16:9',note115:{en:'The video has no voice, so there were no lips to sync — that part wasn\\'t charged.',ar:'لا صوت'}};return previewCol(g,[])}")
        ok("there were no lips to sync" in h2, "the card: the note when the lips couldn't be matched")
        await E("()=>{S.lang='ar';renderAll()}"); await pg.wait_for_timeout(400)
        ta = await E("()=>document.querySelector('.lips115')?.textContent||''")
        ok("الشفاه تتبع الصوت" in ta, f"…in Arabic {ta}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "SWAP_ENGINE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", FREE_PERIOD="false", LIPS_POLL_MS="500"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30); wait(lambda: mock("/stats"), 10)
    pl = server_checks()
    asyncio.run(page_checks(pl))
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1))
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
