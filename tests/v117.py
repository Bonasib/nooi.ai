# v117 "Improve the lip sync — use what's included, build a tool, or combine the techniques". A real nooi server, stand-in engines
# (Kie: the swap, ElevenLabs voice isolation, Volcengine lip sync; fal.ai: Sync Lipsync 2 Pro) and the page:
#  · the voice alone first: the engine's voice isolation (ElevenLabs on Kie) gets the video's sound; when it can't, the speech band
#    of the video's sound (an mp3 made here); the lip sync gets that voice — not the music
#  · the lips on the owner's engine: Volcengine (Kie, the default) or Sync Lipsync 2 Pro on fal.ai (video_url, audio_url,
#    sync_mode cut_off), the other one when it fails
#  · the video's own full sound laid back over the lip-synced result (so only the mouth changed)
#  · Admin → Speed: the lip-sync engine with one tap (fal.ai off without its key; refused without it); its own price on the page
# Run: python3 tests/v117.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8327, 8328
D = tempfile.mkdtemp(prefix="nooi-v117-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/talk.mp4")
ff("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")
ff("-f", "lavfi", "-i", "color=c=0x20a040:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=44100:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/lips.mp4")
ff("-f", "lavfi", "-i", "sine=frequency=300:sample_rate=44100:duration=5", "-ac", "1", "-b:a", "96k", D + "/voice.mp3")
im = Image.new("RGB", (512, 768), (240, 220, 200)); ImageDraw.Draw(im).ellipse([180, 80, 330, 260], fill=(200, 150, 120)); im.save(D + "/media/char.png")
MOCK = r'''
import json, sys, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "fal": [], "isoFail": False, "volcFail": False, "syncFail": False}; T = {}; R = {}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def file(self, n, t):
        b = open(DIR + "/" + n, "rb").read(); self.send_response(200); self.send_header("content-type", t); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path in ("/res.mp4", "/lips.mp4"): return self.file(u.path[1:], "video/mp4")
        if u.path == "/voice.mp3": return self.file("voice.mp3", "audio/mpeg")
        if u.path.startswith("/fal/requests/"):
            rid = u.path.split("/")[3]; r = R.get(rid, {})
            if u.path.endswith("/status"): return self.send({"status": "COMPLETED" if time.time() - r.get("t", 0) > 1 else "IN_PROGRESS"})
            if r.get("fail"): return self.send({"detail": "lip sync failed on fal"}, 500)
            return self.send({"video": {"url": f"http://localhost:{P}/lips.mp4"}})
        t = T.get(urllib.parse.parse_qs(u.query).get("taskId", [""])[0]) or {}; m = t.get("model", "")
        ok = lambda url: self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [url]})}})
        bad = lambda: self.send({"code": 200, "data": {"state": "fail", "failMsg": "failed", "failCode": "500"}})
        if "audio-isolation" in m: return bad() if t["fail"] else ok(f"http://localhost:{P}/voice.mp3")
        if "lip-sync" in m: return bad() if t["fail"] else ok(f"http://localhost:{P}/lips.mp4")
        return ok(f"http://localhost:{P}/res.mp4")
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/plan": st.update(j); return self.send({"ok": 1})
        if u.path.startswith("/fal/"):
            rid = "r%d" % (len(st["fal"]) + 1); st["fal"].append({"model": u.path[5:], "input": j}); R[rid] = {"t": time.time(), "fail": st["syncFail"]}
            b = f"http://localhost:{P}/fal/requests/{rid}"; return self.send({"request_id": rid, "status_url": b + "/status", "response_url": b})
        m = str(j.get("model", "")); st["reqs"].append({"path": u.path, "body": j}); tid = "t%d" % len(st["reqs"])
        T[tid] = {"model": m, "fail": (st["isoFail"] if "audio-isolation" in m else st["volcFail"] if "lip-sync" in m else False)}
        return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def call(port, p, body=None):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
api = lambda p, body=None: call(PORT, p, body)
mock = lambda p, body=None: call(KPORT, p, body)
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
def probe(url):
    f = D + "/media/" + url.rsplit("/", 1)[-1]
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], capture_output=True, text=True).stdout or "{}")
    return {"audio": any(s.get("codec_type") == "audio" for s in j.get("streams", [])), "dur": round(float(j.get("format", {}).get("duration", 0)), 1)}
def swap(cid, **plan):
    mock("/plan", {"isoFail": False, "volcFail": False, "syncFail": False, **plan}); s0 = mock("/stats"); n, nf = len(s0["reqs"]), len(s0["fal"])
    j = api("/v1/jobs", {"kind": "video", "model": "mcswap", "prompt": "", "dur": 5, "aspect": "16:9", "cid": cid, "inputs": {"mcMove": "/media/talk.mp4", "mcChar": "/media/char.png"}, "meta": {"motion83": True, "swap93": True, "consent": True, "lips115": True}})
    d = wait(lambda: (lambda x: x if x.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + j.get("id", "x"))), 90) or {}; s1 = mock("/stats")
    return d, [x["body"] for x in s1["reqs"][n:]], s1["fal"][nf:]
model = lambda b: str(b.get("model", ""))

def checks_nokey():
    d, b, f = swap("iso"); iso = [x for x in b if "audio-isolation" in model(x)]; lips = [x for x in b if "lip-sync" in model(x)]; li = (lips or [{}])[0].get("input", {})
    out["iso"] = {"status": d.get("status"), "iso": [x.get("input") for x in iso], "lips": li, "url": d.get("url")}
    ok(d.get("status") == "done" and len(iso) == 1 and str(iso[0].get("input", {}).get("audio_url", "")).endswith("-voice.mp3"), f"the voice alone first: the engine's voice isolation gets the video's sound {out['iso']}")
    ok(len(lips) == 1 and str(li.get("audio_url", "")).startswith(f"http://localhost:{PORT}/media/") and str(li.get("audio_url", "")).endswith(".mp3") and "-voice" not in li.get("audio_url", "") and "-clean" not in li.get("audio_url", ""),
       f"…and the lip sync gets the isolated voice, not the music {li}")
    pr = probe(d.get("url", "")) if d.get("url") else {}; out["iso"]["final"] = pr
    ok(str(d.get("url", "")).endswith("-snd.mp4") and pr.get("audio") and abs(pr.get("dur", 0) - 5) < .6, f"the video's own full sound laid back over the lip-synced result {pr}")
    d, b, f = swap("band", isoFail=True); li = ([x for x in b if "lip-sync" in model(x)] or [{}])[0].get("input", {}); out["band"] = li
    ok(d.get("status") == "done" and str(li.get("audio_url", "")).endswith("-clean.mp3"), f"no voice isolation → the speech band of the video's sound {li}")
    r = api("/v1/admin/speed/lipsengine", {"engine": "sync"}); sp = api("/v1/admin/speed")
    ok(r.get("_status") == 400 and "fal.ai key" in str(r.get("error")) and sp.get("lipsEngine") == "volc", f"Sync Lipsync can't be picked without the fal.ai key {r} {sp.get('lipsEngine')}")

def checks_key():
    p0 = api("/v1/config").get("prices", {}).get("video", {}).get("swaplips")
    r = api("/v1/admin/speed/lipsengine", {"engine": "sync"}); p1 = api("/v1/config").get("prices", {}).get("video", {}).get("swaplips"); out["lipsPrices"] = [p0, p1]
    ok(r.get("lipsEngine") == "sync" and p1 and p0 and p1 > p0, f"Sync Lipsync 2 Pro picked; its own price on the page {r} {out['lipsPrices']}")
    d, b, f = swap("sync"); fi = (f or [{}])[0]; out["sync"] = {"status": d.get("status"), "fal": fi, "volc": len([x for x in b if "lip-sync" in model(x)]), "url": d.get("url")}
    ok(d.get("status") == "done" and fi.get("model") == "fal-ai/sync-lipsync/v2/pro" and str(fi.get("input", {}).get("video_url", "")).startswith(f"http://localhost:{PORT}/media/") and str(fi.get("input", {}).get("audio_url", "")).endswith(".mp3")
       and fi.get("input", {}).get("sync_mode") == "cut_off" and out["sync"]["volc"] == 0 and str(d.get("url", "")).endswith("-snd.mp4"), f"the lips on Sync Lipsync 2 Pro (fal.ai), the original sound back {out['sync']}")
    d, b, f = swap("syncfail", syncFail=True); out["fallback"] = {"status": d.get("status"), "fal": len(f), "volc": len([x for x in b if "lip-sync" in model(x)]), "note": d.get("note115")}
    ok(d.get("status") == "done" and out["fallback"]["fal"] == 1 and out["fallback"]["volc"] == 1 and not d.get("note115"), f"Sync fails → Volcengine makes the lips {out['fallback']}")
    d, b, f = swap("both", syncFail=True, volcFail=True); out["both"] = {"status": d.get("status"), "note": (d.get("note115") or {}).get("en", "")}
    ok(d.get("status") == "done" and out["both"]["note"].startswith("The lips couldn't be matched"), f"both fail → the swap as it came, the note {out['both']}")
    api("/v1/admin/speed/lipsengine", {"engine": "volc"})

async def page(withKey):
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 390, "height": 844})).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.view='admin';S.admTab='overview';renderAll()}")
        r = None
        for _ in range(40):
            r = await E("()=>{const s=document.querySelector('[data-act=lips117][data-eng=\"sync\"]');return s?{t:s.closest('.sw112').textContent,off:s.disabled,on:document.querySelector('[data-act=lips117][data-eng=\"volc\"]').classList.contains('on')}:null}")
            if r: break
            await asyncio.sleep(.25)
        out["card_" + str(withKey)] = r
        ok(r and "Lips follow the voice — engine" in r["t"] and "Sync Lipsync 2 Pro" in r["t"] and r["on"] and r["off"] == (not withKey), f"the speed card: the lip-sync engine, Volcengine on, Sync off without the fal.ai key {r}")
        if withKey:
            await pg.click('[data-act=lips117][data-eng="sync"]'); await pg.wait_for_timeout(1200)
            ok(api("/v1/admin/speed").get("lipsEngine") == "sync", "one tap: Sync Lipsync 2 Pro"); api("/v1/admin/speed/lipsengine", {"engine": "volc"})
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "SWAP_ENGINE", "LIPS_ENGINE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def server(**extra):
    return subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", FAL_QUEUE_URL=f"http://localhost:{KPORT}/fal", FREE_PERIOD="false", LIPS_POLL_MS="400", **extra), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "a"))
srv = server()
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30); wait(lambda: mock("/stats"), 10)
    checks_nokey(); asyncio.run(page(False))
    srv.terminate(); srv.wait(10); srv = server(FAL_KEY="fk"); wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30)
    checks_key(); asyncio.run(page(True))
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1))
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
