# v136: films made faster and never lost (the agents draw the first picture of every shot, all shots are made at the same time; a part
# that can't be made leaves the film with the parts that were, charged only for them, and the missing part can be made again) · an
# Extend whose engine ignored the last frame is made again on an engine that keeps it · two different shots are merged at one frame
# (a clean cut, no dissolve) · the agents work one after another · the prompt boxes (pictures, clips and characters at the top, # lists
# the pictures inside the box, no Agent tab, nooi Auto) · the folded box doesn't flash open when the page is drawn again.
# A real nooi server, a stand-in engine (videos from the picture given; pictures for the first frames of shots).
# Run: python3 tests/v136.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request, hashlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8380, 8381
D = tempfile.mkdtemp(prefix="nooi-v136-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/eng"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOK = {"s": "nooi_" + "s" * 32, "l": "nooi_" + "l" * 32}
def acct(plan, credits, tok):
    return {"plan": plan, "planUntil": 4102444800000, "credits": credits, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
            "tokens": [{"id": "tk" + tok[-1], "name": "t", "hash": hashlib.sha256(tok.encode()).hexdigest(), "last4": tok[-4:], "created": 1, "dailyCap": 10000000}]}
ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "mandelbrot=s=1280x720:start_scale=2.5", "-vf", "select=eq(n\\,40)", "-frames:v", "1", D + "/eng/scene.png")
ff("-f", "lavfi", "-i", "testsrc2=s=1280x720", "-frames:v", "1", D + "/eng/other.png")
ff("-f", "lavfi", "-i", "color=c=0x406080:s=640x360", "-frames:v", "1", D + "/media/pic1.png")
def clip(name, dur, src):
    ff("-f", "lavfi", "-i", src, "-f", "lavfi", "-i", f"sine=frequency=440:duration={dur}", "-t", str(dur), "-af", "volume=-12dB", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", D + "/media/" + name)
clip("lv1.mp4", 6, "mandelbrot=s=640x360:r=24"); clip("lv3.mp4", 5, "testsrc2=s=640x360:r=24")
pj = lambda i, f, t, d: {"id": i, "kind": "video", "status": "done", "url": "/media/" + f, "created": 1, "doneAt": 2, "title": t, "cost": 0, "payload": {"kind": "video", "prompt": t, "dur": d, "aspect": "16:9", "model": "wan30"}}
stu, loc = acct("studio", 90000, TOK["s"]), acct("studio", 90000, TOK["l"])
stu["jobs"] = {"jl1": pj("jl1", "lv1.mp4", "a garden at night", 6), "jl3": pj("jl3", "lv3.mp4", "a test card", 5),
               "ji1": {"id": "ji1", "kind": "image", "status": "done", "url": "/media/pic1.png", "created": 1, "doneAt": 2, "title": "a man by a car", "cost": 0, "payload": {"kind": "image", "prompt": "a man by a car", "aspect": "16:9", "model": "nano"}}}
loc["jobs"] = {"jv1": pj("jv1", "lv1.mp4", "a garden at night", 6)}
# a film of 4 shots that came out with part 3 missing (the page's own account: staff, so making it again is free)
PIC = f"http://localhost:{PORT}/media/pic1.png"
def kid(i, st):
    k = {"id": "jfk%d" % i, "owner": "local", "kind": "video", "cap": "video", "prov": "kie@wan/3-0-video", "status": st, "progress": 1 if st == "done" else 0, "created": 1, "parent": "jf", "cost": 0, "title": "Market · %d/4" % i,
         "payload": {"kind": "video", "model": "wan30", "prompt": "Shot %d in the market" % i, "dur": 5, "aspect": "16:9", "inputs": {"startImage": PIC}, "chainAfter": None, "meta": {"parts": 1, "part": i, "long132": 1, "fast136": 1}}}
    if st == "done": k["url"] = "/media/lv1.mp4"
    else: k.update(error="engine error", reason="engine error")
    return k
for i in range(1, 5): loc["jobs"]["jfk%d" % i] = kid(i, "failed" if i == 3 else "done")
loc["jobs"]["jf"] = {"id": "jf", "owner": "local", "kind": "video", "cap": "video", "prov": "kie@wan/3-0-video", "status": "done", "progress": 1, "created": 2, "doneAt": 3, "cost": 0, "title": "A morning in the market", "url": "/media/lv1.mp4",
    "children": ["jfk1", "jfk2", "jfk3", "jfk4"], "partsTotal": 4, "partsDone": 3, "partial136": {"made": 3, "of": 4, "missing": [3], "reason": None, "secs": 15, "full": 0}, "paid136": True,
    "payload": {"kind": "video", "model": "wan30", "prompt": "A morning in the market", "dur": 20, "aspect": "16:9", "meta": {"long132": 1, "parts": 4, "fast136": 1}}}
json.dump({"users": {"local": loc, "stu": stu}}, open(D + "/data/db.json", "w"))
MOCK = r'''
import json, sys, re, time, urllib.parse, urllib.request, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "bad": [], "nofail": False}; LOCK = threading.Lock()
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
def fetch(u, out): open(out, "wb").write(urllib.request.urlopen(u, timeout=30).read()); return out
def make(tid, model, inp):
    p = str(inp.get("prompt") or ""); out = DIR + "/" + tid
    if re.match(r"elevenlabs/text-to-speech", model):
        d = max(1.0, len(p) * 0.055); FF("-f", "lavfi", "-i", f"sine=frequency=190:duration={d:.2f}", "-af", "tremolo=f=5:d=0.7,volume=2", out + ".mp3"); return ".mp3"
    if re.match(r"elevenlabs/sound-effect", model):
        d = 6 if inp.get("loop") else 3; FF("-f", "lavfi", "-i", f"anoisesrc=d={d}:c=pink:a=0.35", out + ".mp3"); return ".mp3"
    if model == "ai-music-api/generate":
        FF("-f", "lavfi", "-i", "sine=frequency=262:duration=40", "-f", "lavfi", "-i", "sine=frequency=330:duration=40", "-filter_complex", "amix=inputs=2", out + ".mp3"); return ".mp3"
    if re.match(r"bytedance/seedance-2", model) and inp.get("reference_video_urls"):   # an edit: the video it was sent, tinted red, as long as asked
        v = fetch(inp["reference_video_urls"][0], out + "-ref.mp4"); d = int(inp.get("duration") or 5)
        FF("-i", v, "-an", "-vf", f"colorchannelmixer=rr=1:gg=0.35:bb=0.35,tpad=stop_mode=clone:stop_duration=15,trim=duration={d},setpts=PTS-STARTPTS", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", out + ".mp4"); return ".mp4"
    if re.match(r"nano-banana", model):   # the first picture of a shot: the picture given (or the scene), with the shot's number in its colour
        m = re.search(r"shot (\d+) of", p); k = int(m.group(1)) if m else 1
        src = fetch((inp.get("image_input") or [None])[0], out + "-in.png") if inp.get("image_input") else DIR + "/scene.png"
        FF("-i", src, "-vf", f"scale=1280:720,hue=h={k * 70}", out + ".png"); return ".png"
    if "FAILSHOT" in p and not st["nofail"]: raise Exception("engine refused")
    img = inp.get("first_frame_url") or (inp.get("image_urls") or [None])[0] or (inp.get("reference_image_urls") or [None])[-1]
    dur = max(1, int(float(inp.get("duration") or 5))); src = DIR + "/scene.png"
    if img: src = fetch(img, DIR + "/in_" + tid + ".png")
    if "IGNOREFRAME" in p and model.startswith("wan/2-7"): src = DIR + "/other.png"   # an engine that ignores the frame it was given
    FF("-i", src, "-f", "lavfi", "-i", f"sine=frequency=300:duration={dur}", "-filter_complex",
       f"[0:v]scale=1280:720,zoompan=z='1+on*0.0025':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={dur * 24}:s=640x360:fps=24,format=yuv420p[v];[1:a]volume=-20dB[a]",
       "-map", "[v]", "-map", "[a]", "-t", str(dur), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-c:a", "aac", out + ".mp4"); return ".mp4"
EXT = {}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/stats": return self.send(st)
        if u.path == "/nofail": st["nofail"] = True; return self.send(st)
        if u.path.startswith("/f/"):
            b = open(DIR + "/" + u.path[3:], "rb").read(); self.send_response(200); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        tid = (q.get("taskId") or [""])[0]; url = f"http://localhost:{P}/f/{tid}{EXT.get(tid, '.mp4')}"
        if tid in st["bad"]: return self.send({"code": 200, "data": {"state": "fail", "failMsg": "engine error"}})
        if tid not in EXT: return self.send({"code": 200, "data": {"state": "generating"}})
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [url]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(x.get("text", "") for x in parts if x.get("type") == "text"); imgs = len([x for x in parts if x.get("type") == "image"])
            with LOCK: st.setdefault("llm", []).append({"text": text[:300], "images": imgs})
            if "Image 1 is the reference of a scene" in text: return self.send({"content": [{"type": "text", "text": json.dumps({"score": 90, "same": True, "differences": []})}]})
            if "nooi's analysis team" in text:
                return self.send({"content": [{"type": "text", "text": json.dumps({"scene": "A garden at night with a man walking past a parked car.", "items": [
                    {"kind": "person", "name": "the man in the red coat", "en": "a man in a red coat walking slowly", "frames": [0, 1], "best": 0, "box": [0.3, 0.2, 0.3, 0.6]},
                    {"kind": "vehicle", "name": "the white car", "en": "a white car parked on the right", "frames": [2, 3], "best": 2, "box": [0.6, 0.5, 0.3, 0.3]}],
                    "sounds": [{"id": "s1", "kind": "music", "name": "a steady tone, like music"}]})}]})
            if "nooi's continuity supervisor" in text:
                n = len(re.findall(r"\n\d+\. ", text)) or 1
                return self.send({"content": [{"type": "text", "text": json.dumps({"checks": [{"n": i + 1, "done": True, "other": False, "note": "Changed, nothing else moved"} for i in range(n)]})}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        with LOCK: tid = "t%d" % (len(st["reqs"]) + 1); st["reqs"].append({"path": u.path, "body": j, "tid": tid, "t": time.time()})
        def work():
            try: EXT[tid] = make(tid, j.get("model", ""), j.get("input") or {})
            except Exception as e: st["bad"].append(tid); EXT[tid] = ".mp4"
        threading.Thread(target=work, daemon=True).start()   # (the engine makes it while the server waits — several at once)
        return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False)[:700]))
def api(p, body=None, tok="s"):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", "authorization": "Bearer " + TOK[tok]})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
stats = lambda: json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
def waitjob(jid, sec=240, tok="s"):
    t0 = time.time(); r = {}; seen = []
    while time.time() - t0 < sec:
        r = api("/v1/jobs/" + jid, tok=tok); s = r.get("stage")
        if s and (not seen or seen[-1] != s): seen.append(s)
        if r.get("status") in ("done", "failed"): break
        time.sleep(.4)
    r["_stages"] = seen; return r
mfile = lambda url: D + "/media/" + url.split("/media/")[-1]
def info(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", f], capture_output=True, text=True).stdout or "{}")
    return {"dur": round(float((j.get("format") or {}).get("duration") or 0), 2), "kinds": [s["codec_type"] for s in j.get("streams", [])]}
def jumps(f):   # the step between each two frames (0–1), small copies
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", "scale=80:45,format=rgb24", "-vsync", "passthrough", "-f", "rawvideo", "-"], capture_output=True).stdout; FB = 80 * 45 * 3
    fr = [r[i:i + FB] for i in range(0, len(r) - FB + 1, FB)]; return [sum(abs(a - b) for a, b in zip(fr[i - 1], fr[i])) / FB / 255 for i in range(1, len(fr))]
inp = lambda x: x["body"].get("input") or {}
model = lambda x: x["body"].get("model")
wallet = lambda tok="s": api("/v1/billing", tok=tok).get("credits")
FILM = {}

def server_side():
    # ---- a film of 4 shots: the first pictures (all at once), then every shot at the same time, joined with clean cuts
    n0 = len(stats()["reqs"]); w0 = wallet()
    shots = ["Elias walks into the old market at dawn", "Elias stops at a spice stall, the seller smiles", "FAILSHOT Elias climbs the stairs to the roof", "Elias looks over the city as the sun rises"]
    f = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "Elias, a documentary morning in the old market", "dur": 20, "aspect": "16:9", "meta": {"long132": 1, "parts": 4, "shots": shots, "bible": "Elias: 60, grey beard, blue jacket"}})
    r = waitjob(f.get("id", "x"), 300); rq = stats()["reqs"][n0:]
    pics = [x for x in rq if re.match(r"nano-banana", str(model(x)))]; vids = [x for x in rq if str(model(x)).startswith("wan/3")]
    first4 = vids[:4]; spread = round(max(x["t"] for x in first4) - min(x["t"] for x in first4), 2) if len(first4) == 4 else None
    firsts = [inp(x).get("first_frame_url") or (inp(x).get("image_urls") or [None])[0] for x in first4]
    out["film"] = {"status": r.get("status"), "error": r.get("error"), "stages": r.get("_stages"), "fast": r.get("fast136"), "partial": r.get("partial136"), "pics": len(pics), "vids": len(vids),
                   "spread": spread, "firsts": [str(x)[-24:] for x in firsts], "picsBefore": bool(pics) and bool(first4) and max(x["t"] for x in pics[:4]) <= min(x["t"] for x in first4), "cost": r.get("cost"),
                   "file": info(mfile(r["url"])) if r.get("url") else None}
    chk("a film: the first picture of every shot is drawn first (4 pictures), then all 4 shots are sent at the same time (not one after the other), each from its own picture",
        len(pics) == 4 and out["film"]["picsBefore"] and spread is not None and spread < 4 and len(set(firsts)) == 4 and all(firsts) and r.get("fast136") and "frames" in (r.get("_stages") or []), out["film"])
    p = r.get("partial136") or {}
    chk("…a shot that couldn't be made doesn't lose the film: it comes with the 3 shots that were made (about 15 s, sound and picture), the missing one named", r.get("status") == "done" and p.get("missing") == [3] and p.get("made") == 3 and p.get("of") == 4
        and out["film"]["file"] and 13 <= out["film"]["file"]["dur"] <= 15.6 and out["film"]["file"]["kinds"] == ["video", "audio"], out["film"])
    full = p.get("full") or 0; paid = w0 - wallet(); out["film"]["paid"] = [paid, full, (p.get("again") or {})]
    chk("…only the shots that were made are charged (3 of 4), and making the missing one again is priced first (the rest)", full > 0 and paid == round(full * 0.75) and r.get("cost") == paid and (p.get("again") or {}).get("parts") == [3]
        and (p.get("again") or {}).get("price") == round(full * 0.25), out["film"])
    # making the missing part again: its price held, then the whole film (4 parts), charged that price
    urllib.request.urlopen(f"http://localhost:{KPORT}/nofail").read(); w1 = wallet()
    a = api(f"/v1/jobs/{f.get('id')}/again136", {}); r2 = waitjob(f.get("id", "x"), 240); w2 = wallet()
    out["film"]["again"] = {"started": [a.get("status"), a.get("stage")], "status": r2.get("status"), "partial": r2.get("partial136"), "cost": r2.get("cost"), "paid": w1 - w2, "file": info(mfile(r2["url"])) if r2.get("url") else None}
    chk("…made again: the whole film comes back (4 parts, about 20 s) and costs the price shown — the film in all costs what it would have", a.get("status") == "rendering" and a.get("stage") == "again" and r2.get("status") == "done" and not r2.get("partial136")
        and out["film"]["again"]["file"] and 18 <= out["film"]["again"]["file"]["dur"] <= 20.6 and w1 - w2 == (p.get("again") or {}).get("price") and r2.get("cost") == full, out["film"])
    # ---- one continuous take, when asked: no first pictures, every part from the last frame of the one before
    n2 = len(stats()["reqs"])
    c = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "One take along the river", "dur": 10, "aspect": "16:9", "meta": {"long132": 1, "parts": 2, "shots": ["The boat leaves the pier", "The boat turns into the bend"], "continuous": True}})
    rc = waitjob(c.get("id", "x"), 180); rq = stats()["reqs"][n2:]
    out["take"] = {"status": rc.get("status"), "fast": rc.get("fast136"), "models": [model(x) for x in rq]}
    chk("…one continuous take, when asked for: no first pictures, the parts one after the other", rc.get("status") == "done" and not rc.get("fast136") and not any(re.match(r"nano-banana", str(model(x))) for x in rq) and len(rq) == 2, out["take"])
    # ---- an Extend whose engine ignored the last frame: made again, on an engine that keeps it, then joined as one shot
    base = api("/v1/jobs", {"kind": "video", "model": "wan27", "prompt": "A slow pan over a harbour", "dur": 5, "aspect": "16:9"}); b = waitjob(base.get("id", "x"), 120)
    n1 = len(stats()["reqs"])
    e = api("/v1/jobs", {"kind": "video", "prompt": "IGNOREFRAME the boats keep moving", "dur": 5, "meta": {"extend132": base.get("id")}}); x = waitjob(e.get("id", "x"), 180)
    rq = [y for y in stats()["reqs"][n1:] if not re.match(r"nano-banana", str(model(y)))]
    out["extend"] = {"base": b.get("status"), "status": x.get("status"), "error": x.get("error"), "models": [model(y) for y in rq], "frames": [str(inp(y).get("first_frame_url") or (inp(y).get("image_urls") or [None])[0] or (inp(y).get("reference_image_urls") or [None])[-1])[-20:] for y in rq],
                     "ext": x.get("ext132"), "cut": x.get("extCut136"), "seams": x.get("seams133")}
    chk("Extend: the engine ignored the last frame (a new shot) → made again once on an engine that keeps a first frame, from the same frame, then joined as one shot", x.get("status") == "done" and len(rq) == 2
        and str(rq[0]["body"].get("model", "")).startswith("wan/2-7") and str(rq[1]["body"].get("model", "")).startswith("bytedance/seedance-2") and out["extend"]["frames"][0] == out["extend"]["frames"][1]
        and (x.get("ext132") or {}).get("joined") and (x.get("ext132") or {}).get("seamless") and not x.get("extCut136") and 9.4 <= (x.get("ext132") or {}).get("dur", 0) <= 10.2, out["extend"])
    # ---- two different shots merged: a clean cut at one frame, no dissolve (no double picture)
    m = api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"merge135": {"items": [{"job": "jl1"}, {"job": "jl3"}], "style": "seamless"}}}); r = waitjob(m.get("id", "x"), 180)
    J = jumps(mfile(r["url"])) if r.get("url") else []; big = [round(v, 3) for v in J if v > 0.06]
    out["merge"] = {"status": r.get("status"), "m": r.get("merge135"), "seams": r.get("seams133"), "big": big[:12], "file": info(mfile(r["url"])) if r.get("url") else None}
    chk("Merge of two different shots: one clean cut at one frame — no dissolve, no frames of one picture over the other", r.get("status") == "done" and (r.get("merge135") or {}).get("fades") == 0
        and (r.get("merge135") or {}).get("cuts") == 1 and len(big) == 1, out["merge"])
    # ---- Replace things: what is in a video (the analysis agents), its sounds (measured), the price first, then only the seconds it is seen in made again
    s = api("/v1/scan136", {"job": "jl1", "lang": "en"})
    out["scan"] = {k: s.get(k) for k in ("kind", "dur", "by", "scene", "canHear", "hearPrice")}; out["scan"]["items"] = [(i.get("id"), i.get("kind"), i.get("name"), i.get("seen"), bool(i.get("thumb"))) for i in s.get("items") or []]
    out["scan"]["sounds"] = [(x.get("id"), x.get("kind"), x.get("from"), x.get("to")) for x in s.get("sounds") or []]
    thumbs = [i.get("thumb") for i in s.get("items") or []]; tok = all(t and os.path.exists(mfile(t)) for t in thumbs)
    chk("Replace things — the analysis: the agents list what is in the video (a person, a vehicle) with where and when each is seen and a small picture of it; its sound measured (a steady tone → music)",
        s.get("by") == "agents" and [i[1] for i in out["scan"]["items"]] == ["person", "vehicle"] and out["scan"]["items"][0][3] and tok and out["scan"]["sounds"] and out["scan"]["sounds"][0][1] == "music", out["scan"])
    s2 = api("/v1/scan136", {"job": "jl1", "lang": "en"}); h = api("/v1/scan136", {"job": "jl1", "lang": "en", "hear": True})
    chk("…made once and kept (asked again: the same list, the agents not asked again); hearing the words without speech-to-text connected: said, nothing charged", s2.get("items") == s.get("items") and len([x for x in stats().get("llm", []) if "analysis team" in x["text"]]) == 1 and h.get("_status") == 501 and s.get("canHear") is False, {"h": h, "llm": len(stats().get("llm", []))})
    ch = [{"id": "i1", "to": "a woman in a blue dress"}, {"id": "s1", "to": "soft rain"}]
    q = api("/v1/replace136/quote", {"job": "jl1", "lang": "en", "changes": ch}); out["rq"] = q
    chk("…the price first: the seconds the person is seen in, and the new sound", q.get("total", 0) > 0 and q.get("visual", 0) > 0 and q.get("sound", 0) > 0 and q.get("total") == q.get("visual") + q.get("sound") and q.get("ready") and q.get("secs", 0) >= 4 and q.get("to", 9) <= 4.5, q)
    n0 = len(stats()["reqs"]); w0 = wallet()
    j = api("/v1/jobs", {"kind": "video", "prompt": "the man → a woman; music → rain", "meta": {"replace136": {"job": "jl1", "lang": "en", "changes": ch}}}); r = waitjob(j.get("id", "x"), 240); w1 = wallet()
    rq = stats()["reqs"][n0:]; ed = [x for x in rq if str(model(x)).startswith("bytedance/seedance-2") and inp(x).get("reference_video_urls")]; mu = [x for x in rq if model(x) == "ai-music-api/generate"]
    f = mfile(r["url"]) if r.get("url") else None
    def rgb(t):
        b = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", f, "-frames:v", "1", "-vf", "scale=32:18,format=rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout; n = max(1, len(b) // 3); return [round(sum(b[i::3]) / n, 1) for i in range(3)]
    out["replace"] = {"status": r.get("status"), "error": r.get("error"), "stages": r.get("_stages"), "rp": r.get("replace136"), "edits": [inp(x).get("prompt", "")[:260] for x in ed], "music": [inp(x).get("prompt", "")[:60] for x in mu],
                      "file": info(f) if f else None, "early": rgb(1.0) if f else None, "late": rgb(5.5) if f else None, "paid": [w0 - w1, q.get("total"), r.get("cost")]}
    e0 = out["replace"]["edits"][0] if out["replace"]["edits"] else ""
    chk("…made: the seconds the person is seen in go to the edit engine with the list in words (what it is, where, what replaces it, everything else kept); the rest of the video is as it was; the new sound laid in; charged the price shown",
        r.get("status") == "done" and len(ed) == 1 and e0.startswith("Edit @Video1 — change only these things:") and "a man in a red coat walking slowly" in e0 and "a woman in a blue dress" in e0 and len(mu) == 1 and "soft rain" in out["replace"]["music"][0]
        and out["replace"]["file"] and 5.6 <= out["replace"]["file"]["dur"] <= 6.3 and out["replace"]["file"]["kinds"] == ["video", "audio"] and out["replace"]["early"][0] > 1.6 * max(1, out["replace"]["early"][1]) and not (out["replace"]["late"][0] > 1.6 * max(1, out["replace"]["late"][1]))
        and w0 - w1 == q.get("total") and r.get("cost") == q.get("total"), out["replace"])
    rp = r.get("replace136") or {}
    chk("…afterwards the card says what was changed, each checked by the Continuity supervisor (before and after)", [x.get("what") for x in rp.get("list") or []] == ["replaced", "replaced"] and (rp.get("checks") or [{}])[0].get("done") is True and "Changed" in ((rp.get("checks") or [{}])[0].get("note") or ""), rp)
    # a picture: removed with the picture engine, the same words
    n1 = len(stats()["reqs"])
    pj2 = api("/v1/jobs", {"kind": "image", "prompt": "remove the car", "meta": {"replace136": {"job": "ji1", "lang": "en", "changes": [{"id": "i2", "remove": True}]}}}); r2 = waitjob(pj2.get("id", "x"), 180)
    im = [x for x in stats()["reqs"][n1:] if re.match(r"nano-banana", str(model(x)))]
    out["pic"] = {"status": r2.get("status"), "error": r2.get("error"), "kind": r2.get("kind"), "url": r2.get("url"), "prompt": inp(im[0]).get("prompt", "")[:240] if im else None, "inputs": len(inp(im[0]).get("image_input") or []) if im else 0, "cost": r2.get("cost")}
    chk("Replace things in a picture: the picture engine gets the picture and the change in words (remove the white car, the place behind it filled in, everything else kept)", r2.get("status") == "done" and r2.get("kind") == "image" and len(im) == 1
        and out["pic"]["prompt"].startswith("Edit this picture (picture 1) — change only these things:") and "Remove a white car parked on the right" in out["pic"]["prompt"] and out["pic"]["inputs"] == 1 and r2.get("cost", 0) > 0, out["pic"])
    bad = api("/v1/replace136/quote", {"job": "jl1", "changes": []}); other = api("/v1/scan136", {"job": "jf"})
    chk("…nothing picked: said; another account's video: refused", bad.get("_status") == 400 and other.get("_status") == 400, [bad, other])

async def phone(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.myPlan='studio';S.credits=99999;S.hf.tab='video';S.hf.vModel='auto';S.hf.bots=true;go('home');renderAll()}")
    await pg.wait_for_timeout(500)
    # the home box: no Agent tab; nooi Auto says what it is; what to use at the top, the words below
    h = await E("""()=>{const box=document.querySelector('.hfbox').getBoundingClientRect(),top=document.querySelector('.hfmain .hft136'),q=document.getElementById('hfq').getBoundingClientRect(),t=top&&top.getBoundingClientRect();
      const n=document.querySelector('.hfmi.eng171');return{tabs:[...document.querySelectorAll('[data-act=hf-tab]')].map(e=>e.dataset.v),nooi:n&&n.textContent.trim(),title:n&&n.title,
      top:top?[...top.children].map(e=>e.dataset.act||e.className.split(' ')[0]+(e.querySelector('input[data-ref130]')?':pic':'')):null,above:t&&t.bottom<=q.top+1,wide:Math.round(q.width)>=Math.round(box.width)-60,inside:t&&t.right<=box.right+1}}""")
    out["box"] = h
    chk("home box: Video · Image · Audio · Avatar (no Agent tab); the nooi chip reads nooi Auto and says the agents pick the engine; the start frame, pictures, a clip and characters sit at the top, the words below at full width",
        h["tabs"] == ["video", "image", "audio", "avatar"] and h["nooi"] == "nooi Auto" and "agents pick" in (h["title"] or "") and h["top"] and h["top"][0] == "ch87-open" and "hfref" in h["top"] and "pic156" in h["top"] and "hf136-clip" in h["top"] and h["above"] and h["wide"] and h["inside"], h)
    # # in the box's words: the pictures, inside the box
    await E("()=>document.querySelector('.hft136 [data-act=\"pic156\"]').click()"); await pg.wait_for_timeout(300)   # (v156: Picture opens a sheet — from the phone there)
    await pg.set_input_files("#modalRoot .pkup156 input[data-hf136]", D + "/media/pic1.png"); await pg.wait_for_timeout(600)
    await pg.wait_for_function("refs130().length===1&&!!document.querySelector('.hft136 .t136.pic')", timeout=15000); await pg.wait_for_timeout(1200)
    await pg.locator("#hfq").fill(""); await pg.locator("#hfq").type("a fox walks past #"); await pg.wait_for_timeout(300)
    l = await E("()=>{const l=document.getElementById('hp136'),box=document.querySelector('.hfbox');return{open:!!l,inBox:!!(l&&box.contains(l)),opts:l?[...l.querySelectorAll('[data-hp136]')].map(o=>o.textContent.trim()):[],tiles:[...document.querySelectorAll('.hft136 .t136.pic small')].map(x=>x.textContent)}}")
    await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
    l["after"] = await E("()=>({v:document.getElementById('hfq').value,open:!!document.getElementById('hp136'),used:[...document.querySelectorAll('.hft136 .t136.pic')].map(x=>x.classList.contains('used'))})")
    out["hash"] = l
    chk("home box: a picture added shows at the top of the box with its # name; typing # lists the pictures inside the box; Enter puts #image1 in the words", l["tiles"] == ["#image1"] and l["open"] and l["inBox"] and l["opts"] == ["#image1"]
        and l["after"]["v"] == "a fox walks past #image1 " and not l["after"]["open"], l)
    # the agents: one works at a time, in order, and the ones before show ✓; their row stays inside the box
    a = await E("""()=>{const now=Date.now(),j={id:'fake136',kind:'video',status:'rendering',created:now-20000,progress:.5,model:'wan30',dur:5};S.jobs.push(j);const b1=Object.keys(busyBots());
      j.progress=.8;const b2=Object.keys(busyBots());j.progress=.3;const b3=Object.keys(busyBots());S.jobs=S.jobs.filter(x=>x!==j);
      AG.shown=HF_BOT_IDS.slice();AG.cur='proof';AG.done={};HF_BOT_IDS.slice(0,-1).forEach(i=>AG.done[i]=true);agPaint();const box=document.querySelector('.hfbox').getBoundingClientRect();
      const r=[...document.querySelectorAll('#agstrip .agb')].map(e=>e.getBoundingClientRect());return{b1,b2,b3,n:r.length,inside:r.every(x=>x.left>=box.left-1&&x.right<=box.right+1),overlap:r.some((x,i)=>i&&x.left<r[i-1].right-1&&Math.abs(x.top-r[i-1].top)<4)}}""")
    out["agents"] = a
    chk("agents: while a video is made one agent works at a time, in order (Lyra, then Echo — never back to Lumi), not the Director and the Cinematographer all the time; all 9 stay inside the box without overlapping",
        a["b1"] == ["voice"] and a["b2"] == ["sound"] and a["b3"] == ["sound"] and a["n"] == 9 and a["inside"] and not a["overlap"], a)
    # a long video: the shots at the same time, or one continuous take — the choice in the length sheet
    await E("()=>{S.hf.dur=60;hfDurSheet()}"); await pg.wait_for_timeout(300)
    d = await E("()=>{const c=document.querySelector('#modalRoot .ct136');return{ct:!!c,note:(document.getElementById('hfdnote')||{}).textContent||''}}")
    await E("()=>{$('#modalRoot').innerHTML='';S.hf.dur=5}"); out["take page"] = d
    chk("length sheet: a minute is made as shots at the same time; 'One continuous take' can be chosen instead", d["ct"] and "at the same time" in d["note"], d)
    # nooi Studio's box on the phone: the folded box doesn't flash open when the page is drawn again; what to use at the top
    await E("()=>{S.fold134=true;go('video');renderAll()}"); await pg.wait_for_timeout(700)
    fl = await E("()=>{const r=[];for(let i=0;i<3;i++){renderView();const d=document.querySelector('#main .dock98');r.push([d.classList.contains('off134'),+getComputedStyle(d).opacity])}return r}")
    await pg.wait_for_timeout(300)
    await E("()=>{S.fold134=false;renderView()}"); await pg.wait_for_timeout(600)
    v = await E("""()=>{const row=document.querySelector('#main .cz98 .rf136'),m=document.querySelector('#main .cz98m');return{row:!!row,add:!!(row&&row.querySelector('.add98')),clip:!!(row&&row.querySelector('[data-act="vd136-clip"]')),ch:!!(row&&row.querySelector('label.char98')),
      addInWords:!!(m&&m.querySelector('.add98')),order:row&&m?!!(row.compareDocumentPosition(m)&Node.DOCUMENT_POSITION_FOLLOWING):false}}""")
    out["studio"] = {"redraw": fl, "row": v}
    chk("nooi Studio on a phone: the folded box stays folded and see-through-free while the page is drawn again (no flash open)", all(x[0] and x[1] < 0.05 for x in fl), fl)
    chk("nooi Studio: + (pictures and frames), Clip and Characters at the top of the box, the words below", v["row"] and v["add"] and v["clip"] and v["ch"] and not v["addInWords"] and v["order"], v)
    # a film with a part missing: the card says so and offers to make it again; making it again brings the whole film
    await E("()=>syncServer()"); await pg.wait_for_function("S.jobs.some(j=>j.remote==='jf')", timeout=20000)
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(1500)
    c = await E("""()=>{const j=S.jobs.find(x=>x.remote==='jf'),c=document.querySelector('.gc98[data-open98="'+j.id+'"]'),n=c&&c.querySelector('.pa136');return{note:n&&n.textContent,btn:!!(n&&n.querySelector('[data-act="again136"]')),price:!!(n&&n.querySelector('.cost'))}}""")
    if c["btn"]: await pg.locator('.pa136 [data-act="again136"]').first.click(); await pg.wait_for_timeout(800)
    st1 = await E("()=>{const j=S.jobs.find(x=>x.remote==='jf');return [j.status,j.stage||null]}")
    r = waitjob("jf", 240, tok="l")
    out["again"] = {"card": c, "after": st1, "status": r.get("status"), "partial": r.get("partial136"), "file": info(mfile(r["url"])) if r.get("url") else None}
    chk("a film with a part missing: the card names the missing part and offers 'Make part 3 again' (free for staff: no price shown)", c["note"] and "Part 3 of 4 couldn't be made" in c["note"] and "Make part 3 again" in c["note"] and c["btn"] and not c["price"], c)
    chk("…tapped: the film is being made again on the card, then comes back whole (4 parts: three of 6 s and the new one of 5 s, about 23 s)", st1 == ["rendering", "again"] and r.get("status") == "done" and not r.get("partial136") and out["again"]["file"] and 21.5 <= out["again"]["file"]["dur"] <= 23.2, out["again"])
    # Replace things… on the page: the sheet lists what is in the video, the change in words, the price, Make
    await E("()=>{const j=S.jobs.find(x=>x.remote==='jv1');rpSheet136(j)}")
    await pg.wait_for_function("document.querySelectorAll('#rp136 .rp136i').length>=3", timeout=60000)
    sh = await E("()=>({heads:[...document.querySelectorAll('#rp136 .rp136h')].map(h=>h.textContent.trim()),names:[...document.querySelectorAll('#rp136 .rp136i b')].map(b=>b.textContent),thumbs:document.querySelectorAll('#rp136 img.rp136t').length,go:document.querySelector('[data-act=\"rp136-go\"]').disabled})")
    await pg.locator('#rp136 [data-act="rp136-mode"][data-id="i1"][data-v="change"]').click(); await pg.wait_for_timeout(200)
    await pg.locator('#rp136 [data-rp136to="i1"]').fill("a woman in a blue dress"); await pg.wait_for_timeout(1200)
    sm = await E("()=>({sum:[...document.querySelectorAll('#rp136s li')].map(x=>x.textContent),cost:(document.getElementById('rp136c')||{}).textContent,go:document.querySelector('[data-act=\"rp136-go\"]').disabled,n:(document.getElementById('rp136n')||{}).textContent})")
    n0 = await E("()=>S.jobs.length")
    if not sm["go"]: await pg.locator('[data-act="rp136-go"]').click(); await pg.wait_for_timeout(1500)
    mk = await E("()=>{const j=S.jobs[S.jobs.length-1];return{n:S.jobs.length,meta:j&&j.meta&&j.meta.replace136,remote:j&&j.remote||null,sheet:!!document.getElementById('rp136')}}")
    rr = waitjob(mk["remote"], 240, tok="l") if mk.get("remote") else {}
    out["sheet"] = {"sheet": sh, "summary": sm, "made": mk, "status": rr.get("status"), "error": rr.get("error")}
    chk("Replace things… on the page: the people, vehicles and sounds in the video, each with a small picture; nothing picked → Make is off", sh["heads"][:2] == ["People 1", "Vehicles 1"] and any(h.startswith("Sounds") for h in sh["heads"]) and sh["thumbs"] >= 2 and sh["go"], sh)
    chk("…'Change' and the words: 'What changes' says it in a numbered list, the price, Make; Make sends the change and the video comes back changed", sm["sum"] == ["the man in the red coat → a woman in a blue dress"] and not sm["go"] and sm["cost"] not in ("…", "—")
        and mk["n"] == n0 + 1 and (mk["meta"] or {}).get("changes") == [{"id": "i1", "to": "a woman in a blue dress"}] and not mk["sheet"] and rr.get("status") == "done", out["sheet"])
    chk("phone: no page errors", not errs, errs[:3]); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        try: await phone(b)
        except Exception as e: fails.append("phone crashed: " + str(e)[:300])
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "SWAP_ENGINE", "WAN_"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D + "/eng"], stdout=subprocess.DEVNULL, stderr=open(D + "/mock.log", "w"))
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", RECOVER_MS="1500", PART_AGAIN_MS="400",
    ENGINE134_POLL_MS="300", KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", MIRROR_MEDIA="true", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
        except Exception: time.sleep(.25)
    try: server_side()
    except Exception as e: fails.append("server crashed: " + repr(e)[:300])
    asyncio.run(main())
finally: srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": {k: json.dumps(v, ensure_ascii=False)[:1200] for k, v in out.items()}, "dir": D}, ensure_ascii=False, indent=1))
