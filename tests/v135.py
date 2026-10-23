# v135: merge videos so the join can't be seen (a video and its extension, any of yours; clean cuts on request; free; also the
# editor's clips) · edit a video with words (Seedance 2.0 is sent the seconds to change as its reference video; long ones in parts,
# each also given the part before's last frame; put back in place with the video's own sound; priced first) · the seam engine's
# morph joins · the playhead follows the finger (the clip's film strip while dragging) · the phone's folded prompt box goes away,
# only a small arrow above the bottom menu stays.
# A real nooi server, a stand-in engine (videos from the picture given; an edit = a tinted copy of the video sent to it).
# Run: python3 tests/v135.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request, hashlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8378, 8379
D = tempfile.mkdtemp(prefix="nooi-v135-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/eng"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOK = {"s": "nooi_" + "s" * 32, "o": "nooi_" + "o" * 32}
def acct(plan, credits, tok):
    return {"plan": plan, "planUntil": 4102444800000, "credits": credits, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
            "tokens": [{"id": "tk" + tok[-1], "name": "t", "hash": hashlib.sha256(tok.encode()).hexdigest(), "last4": tok[-4:], "created": 1, "dailyCap": 10000000}]}
ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "mandelbrot=s=1280x720:start_scale=2.5", "-vf", "select=eq(n\\,40)", "-frames:v", "1", D + "/eng/scene.png")
ff("-f", "lavfi", "-i", "color=c=0x406080:s=640x360", "-frames:v", "1", D + "/media/pic1.png")
def clip(name, dur, src="testsrc2=s=1280x720:r=24", hz=440):   # a video of our own, with its sound
    ff("-f", "lavfi", "-i", src, "-f", "lavfi", "-i", f"sine=frequency={hz}:duration={dur}", "-t", str(dur), "-af", "volume=-12dB", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/" + name)
clip("e10.mp4", 10); clip("e30.mp4", 30); clip("e3.mp4", 3)
# the page's videos: red then blue (to see which frame the editor shows), and two more
ff("-f", "lavfi", "-i", "color=c=red:s=640x360:r=24:d=3", "-f", "lavfi", "-i", "color=c=blue:s=640x360:r=24:d=3", "-filter_complex", "[0:v][1:v]concat=n=2:v=1[v]", "-map", "[v]", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "1M", "-pix_fmt", "yuv420p", D + "/media/rb.webm")   # (a file this test browser can play)
clip("lv1.mp4", 6, "mandelbrot=s=640x360:r=24"); clip("lv2.mp4", 5, "mandelbrot=s=640x360:r=24:start_scale=2"); clip("lv3.mp4", 5, "testsrc2=s=640x360:r=24")
pj = lambda i, f, t, d: {"id": i, "kind": "video", "status": "done", "url": "/media/" + f, "created": 1, "doneAt": 2, "title": t, "cost": 0, "payload": {"kind": "video", "prompt": t, "dur": d, "aspect": "16:9", "model": "seedance"}}
local = {"plan": "studio", "planUntil": 4102444800000, "credits": 90000, "ledger": [], "posts": {}, "accounts": {},
         "jobs": {"jrb": pj("jrb", "rb.webm", "red then blue", 6), "jl1": pj("jl1", "lv1.mp4", "a garden at night", 6), "jl2": pj("jl2", "lv2.mp4", "the garden goes on", 5), "jl3": pj("jl3", "lv3.mp4", "a test card", 5)}}
other = acct("studio", 1000, TOK["o"]); other["jobs"]["theirs"] = {"id": "theirs", "kind": "video", "status": "done", "url": "/media/lv3.mp4", "created": 1, "payload": {"kind": "video"}}
json.dump({"users": {"local": local, "stu": acct("studio", 90000, TOK["s"]), "oth": other}}, open(D + "/data/db.json", "w"))
MOCK = r'''
import json, sys, re, urllib.parse, urllib.request, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "bad": []}; LOCK = threading.Lock()
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
def fetch(u, out): open(out, "wb").write(urllib.request.urlopen(u, timeout=30).read()); return out
def make(tid, model, inp, veo):
    p = str(inp.get("prompt") or ""); out = DIR + "/" + tid
    if re.match(r"bytedance/seedance-2", model) and inp.get("reference_video_urls"):   # an edit: the video it was sent, tinted red, as long as asked
        if "FAILEDIT" in p: raise Exception("edit engine down")
        v = fetch(inp["reference_video_urls"][0], out + "-ref.mp4"); d = int(inp.get("duration") or 5)
        FF("-i", v, "-an", "-vf", f"colorchannelmixer=rr=1:gg=0.35:bb=0.35,tpad=stop_mode=clone:stop_duration=15,trim=duration={d},setpts=PTS-STARTPTS", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", out + ".mp4"); return ".mp4"
    img = inp.get("first_frame_url") or (inp.get("image_urls") or [None])[0] or (inp.get("reference_image_urls") or [None])[-1]
    dur = 8 if veo else max(1, int(float(inp.get("duration") or 5))); src = DIR + "/scene.png"
    if img: src = fetch(img, DIR + "/in_" + tid + ".png")
    ex = f",fade=t=out:st={dur - 0.35:.2f}:d=0.35" if "FADEEND" in p else ""
    FF("-i", src, "-f", "lavfi", "-i", f"sine=frequency=300:duration={dur}", "-filter_complex",
       f"[0:v]scale=1280:720,zoompan=z='1+on*0.0025':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={dur * 24}:s=640x360:fps=24{ex},format=yuv420p[v];[1:a]volume=-20dB[a]",
       "-map", "[v]", "-map", "[a]", "-t", str(dur), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-c:a", "aac", out + ".mp4"); return ".mp4"
EXT = {}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/stats": return self.send(st)
        if u.path.startswith("/f/"):
            b = open(DIR + "/" + u.path[3:], "rb").read(); self.send_response(200); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        tid = (q.get("taskId") or [""])[0]; url = f"http://localhost:{P}/f/{tid}{EXT.get(tid, '.mp4')}"
        if tid in st["bad"]: return self.send({"code": 200, "data": {"state": "fail", "failMsg": "engine error"}})
        if "veo/record-info" in u.path: return self.send({"code": 200, "data": {"successFlag": 1, "response": {"resultUrls": [url]}}})
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [url]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(x.get("text", "") for x in parts if x.get("type") == "text")
            if "Image 1 is the reference of a scene" in text: return self.send({"content": [{"type": "text", "text": json.dumps({"score": 90, "same": True, "differences": []})}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        with LOCK: tid = "t%d" % (len(st["reqs"]) + 1); st["reqs"].append({"path": u.path, "body": j, "tid": tid})
        veo = "veo/" in u.path
        if "veo/extend" in u.path: return self.send({"code": 422, "msg": "no extend here"})
        try: EXT[tid] = make(tid, "veo" if veo else j.get("model", ""), j if veo else (j.get("input") or {}), veo)
        except Exception as e: st["bad"].append(tid); EXT[tid] = ".mp4"
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
def vol(f, a, b):
    e = subprocess.run(["ffmpeg", "-v", "info", "-ss", str(a), "-t", str(b - a), "-i", f, "-vn", "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = re.search(r"mean_volume: (-?[\d.]+) dB", e); return float(m.group(1)) if m else -99
def rgb(f, t):   # the mean colour of the frame at t
    b = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", f, "-frames:v", "1", "-vf", "scale=32:18,format=rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
    n = max(1, len(b) // 3); return [round(sum(b[i::3]) / n, 1) for i in range(3)]
tinted = lambda c: c[0] > 40 and c[1] < 0.6 * c[0] and c[2] < 0.6 * c[0]
def frames(f):   # all frames, small: [luma], [biggest step between two frames]
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", "scale=80:45,format=rgb24", "-vsync", "passthrough", "-f", "rawvideo", "-"], capture_output=True).stdout; FB = 80 * 45 * 3
    fr = [r[i:i + FB] for i in range(0, len(r) - FB + 1, FB)]; L = [sum(x[0::3]) / 3600 * .3 + sum(x[1::3]) / 3600 * .59 + sum(x[2::3]) / 3600 * .11 for x in fr]
    J = [sum(abs(a - b) for a, b in zip(fr[i - 1], fr[i])) / FB / 255 for i in range(1, len(fr))]; return L, J
inp = lambda x: x["body"] if "veo/" in x["path"] else (x["body"].get("input") or {})
model = lambda x: "veo" if "veo/" in x["path"] else x["body"].get("model")
def sent(n0, pred=lambda x: True): return [x for x in stats()["reqs"][n0:] if pred(x)]
wallet = lambda: api("/v1/billing").get("credits")

def server_side():
    # ---- Merge
    base = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "A slow push in over a glowing city at dawn FADEEND", "dur": 10, "aspect": "16:9"}); b = waitjob(base["id"], 120)
    other = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "A quiet street in the rain", "dur": 5, "aspect": "16:9"}); o2 = waitjob(other["id"], 120)
    part = api("/v1/jobs", {"kind": "video", "prompt": "", "dur": 5, "meta": {"extend132": base["id"], "extNoJoin134": 1}}); p = waitjob(part["id"], 120)
    joined = api("/v1/jobs", {"kind": "video", "prompt": "", "dur": 5, "meta": {"extend132": base["id"]}}); jn = waitjob(joined["id"], 120)
    out["made"] = [x.get("status") for x in (b, o2, p, jn)]
    if out["made"] != ["done"] * 4: chk("the videos to merge were made", False, out["made"]); return
    w0 = wallet()
    m = api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"merge135": {"items": [{"job": base["id"]}, {"job": part["id"]}], "style": "seamless"}}}); r = waitjob(m.get("id", "x"), 180)
    f = mfile(r["url"]) if r.get("url") else None; L, J = frames(f) if f else ([], [])
    med = sorted(L)[len(L) // 2] if L else 0
    out["merge"] = {"status": r.get("status"), "error": r.get("error"), "stages": r.get("_stages"), "m": r.get("merge135"), "seams": r.get("seams133"), "file": info(f) if f else None,
                    "darkest": round(min(L[:-12]) / med, 2) if L else None, "maxJump": round(max(J[:-12] or [0]), 3), "cost": [m.get("cost"), r.get("cost")]}
    chk("Merge: the video and the part the editor made from it, as one video — the faded end left out, the part from where it really goes on, no jump, no dip", r.get("status") == "done" and (r.get("merge135") or {}).get("seamless")
        and (r.get("seams133") or {}).get("matched") == 1 and out["merge"]["file"] and 13.2 <= out["merge"]["file"]["dur"] <= 15.2 and out["merge"]["file"]["kinds"] == ["video", "audio"] and out["merge"]["darkest"] > 0.8 and out["merge"]["maxJump"] < 0.08
        and r.get("_stages", [])[:1] == ["ends"] and "join" in r.get("_stages", []), out["merge"])
    chk("…free", m.get("cost") == 0 and r.get("cost") == 0 and wallet() == w0, [m.get("cost"), r.get("cost"), w0, wallet()])
    # a video and its joined extension: the extension already holds it
    x = api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"merge135": {"items": [{"job": base["id"]}, {"job": joined["id"]}]}}})
    y = api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"merge135": {"items": [{"job": base["id"]}, {"job": joined["id"]}, {"job": other["id"]}], "style": "cut"}}}); ry = waitjob(y.get("id", "x"), 180)
    out["holds"] = {"two": x, "three": {"status": ry.get("status"), "m": ry.get("merge135"), "dur": ry.get("dur")}}
    chk("…a video and its extension (which holds it): not shown twice — refused when nothing else is left, left out otherwise", x.get("_status") == 400 and "already one video" in str(x.get("error"))
        and ry.get("status") == "done" and (ry.get("merge135") or {}).get("dropped") == [base["id"]] and (ry.get("merge135") or {}).get("n") == 2 and (ry.get("merge135") or {}).get("cuts") == 1, out["holds"])
    bad = [api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"merge135": {"items": [{"job": base["id"]}, {"job": "theirs"}]}}}), api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"merge135": {"items": [{"job": base["id"]}]}}}),
           api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"merge135": {"items": [{"job": base["id"]}, {"src": "/etc/passwd"}]}}})]
    chk("…someone else's video, one video, a path that isn't a video here: refused", [z.get("_status") for z in bad] == [400, 400, 400], bad)
    # ---- the film strip
    sp = api("/v1/media/sprite", {"url": b["url"]}); spi = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", mfile(sp.get("url", "/media/x"))], capture_output=True, text=True).stdout.strip() if sp.get("url") else ""
    out["sprite"] = {"r": sp, "img": spi, "bad": api("/v1/media/sprite", {"url": "/etc/passwd"}).get("_status")}
    chk("the film strip of a clip: small frames, 12 a second for a short clip, one picture no wider than 3840 px; nothing for a path that isn't a clip here", sp.get("fps") == 12 and sp.get("n") == 120 and sp.get("w") == 320 and sp.get("cols") == 12
        and spi == "3840,1800" and out["sprite"]["bad"] == 404, out["sprite"])
    # ---- Edit with words
    q = api("/v1/edit135/quote", {"src": "/media/e10.mp4", "from": 3, "to": 7}); qs = api("/v1/edit135/quote", {"src": "/media/e10.mp4", "from": 1, "to": 2}); qw = api("/v1/edit135/quote", {"src": "/media/e30.mp4"})
    qt = api("/v1/edit135/quote", {"src": "/media/e3.mp4"})
    out["quote"] = {"q": q, "short": qs, "whole30": qw, "tiny": qt}
    chk("Edit · the price first: 3–7 s of a 10 s video (one part), 1–2 s grows to the engine's 4 s, a whole 30 s video in 3 parts, a 3 s video can't be edited", q.get("secs") == 4 and q.get("parts") == 1 and q.get("total", 0) > 0 and q.get("ready")
        and qs.get("secs") == 4 and qs.get("from") == 0 and qw.get("parts") == 3 and qw.get("total", 0) > q["total"] and qt.get("short") is True, out["quote"])
    w0 = wallet(); n0 = len(stats()["reqs"])
    e = api("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "her coat is red now", "meta": {"edit135": {"src": "/media/e10.mp4", "from": 3, "to": 7}, "edCmd": "edit135", "noPhysics": True}})
    r = waitjob(e.get("id", "x"), 180); rq = sent(n0); f = mfile(r["url"]) if r.get("url") else None; src = D + "/media/e10.mp4"
    pr = inp(rq[0]) if rq else {}
    out["edit"] = {"status": r.get("status"), "error": r.get("error"), "stages": r.get("_stages"), "e": r.get("edit135"), "models": [model(x) for x in rq], "dur": pr.get("duration"), "refv": len(pr.get("reference_video_urls") or []),
                   "prompt": str(pr.get("prompt", ""))[:240], "file": info(f) if f else None, "c1": rgb(f, 1.0) if f else None, "o1": rgb(src, 1.0), "c5": rgb(f, 5.0) if f else None, "c9": rgb(f, 9.0) if f else None, "o9": rgb(src, 9.0),
                   "vol": [vol(f, 0.2, 2.8), vol(f, 3.2, 6.8), vol(f, 7.2, 9.8)] if f else None, "srcVol": vol(src, 0.2, 9.8), "cost": [q.get("total"), e.get("cost"), r.get("cost"), w0 - wallet()]}
    E_ = out["edit"]
    chk("Edit · 3–7 s: the engine is sent those seconds (with a little on each side) as @Video1, with the change in words", r.get("status") == "done" and E_["models"] == ["bytedance/seedance-2"] and E_["refv"] == 1 and E_["dur"] == 5
        and E_["prompt"].startswith("Edit @Video1: her coat is red now.") and "stays exactly as it is" in E_["prompt"] and "No on-screen text, captions" not in E_["prompt"], E_)
    chk("…put back in place: the same length, before and after untouched, the edited seconds changed, the video's own sound all through", E_["file"] and abs(E_["file"]["dur"] - 10) < 0.15 and E_["file"]["kinds"] == ["video", "audio"]
        and all(abs(a - b) < 12 for a, b in zip(E_["c1"], E_["o1"])) and all(abs(a - b) < 12 for a, b in zip(E_["c9"], E_["o9"])) and tinted(E_["c5"]) and all(abs(v - E_["srcVol"]) < 1.5 for v in E_["vol"]), E_)
    chk("…charged the price shown", e.get("cost") == q.get("total") and r.get("cost") == q.get("total") and E_["cost"][3] == q.get("total"), E_["cost"])
    # a long video: the whole 30 s in 3 parts, one after the other, each also given the part before's last frame
    n0 = len(stats()["reqs"])
    e = api("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "it is snowing", "meta": {"edit135": {"src": "/media/e30.mp4"}, "edCmd": "edit135"}}); r = waitjob(e.get("id", "x"), 300); rq = sent(n0)
    f = mfile(r["url"]) if r.get("url") else None; L, J = frames(f) if f else ([], [])
    out["long"] = {"status": r.get("status"), "error": r.get("error"), "e": r.get("edit135"), "n": len(rq), "durs": [inp(x).get("duration") for x in rq], "refs": [len(inp(x).get("reference_image_urls") or []) for x in rq],
                   "parts": [re.findall(r"part (\d) of (\d)", str(inp(x).get("prompt", ""))) for x in rq], "file": info(f) if f else None, "tint": [tinted(rgb(f, t)) for t in (2, 10, 15, 20, 28)] if f else None,
                   "seam": [round(max(J[int(t * 24) - 6:int(t * 24) + 6] or [0]), 3) for t in (10, 20)], "own": round(sorted(J)[len(J) // 2], 3) if J else None, "vol": vol(f, 1, 29) if f else None, "srcVol": vol(D + "/media/e30.mp4", 1, 29)}
    G = out["long"]
    chk("Edit · a 30 s video: 3 parts, one after the other; parts 2 and 3 also see the last frame of the part before", r.get("status") == "done" and G["n"] == 3 and G["durs"] == [11, 11, 11] and G["refs"] == [0, 1, 1]
        and G["parts"][1] == [("2", "3")] and G["parts"][2] == [("3", "3")], G)
    chk("…one 30 s video, all of it edited, no jump where the parts meet, its own sound", G["file"] and abs(G["file"]["dur"] - 30) < 0.2 and all(G["tint"] or [False]) and max(G["seam"]) < 0.08 and abs(G["vol"] - G["srcVol"]) < 1.5, G)
    # a picture in the words, a character; an engine that fails: nothing charged
    n0 = len(stats()["reqs"])
    e = api("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "the cup on the table is #mug", "inputs": {"vRef1": "/media/pic1.png"},
                         "meta": {"edit135": {"src": "/media/e10.mp4", "from": 0, "to": 5}, "refs130": [{"slot": "vRef1", "tag": "mug"}], "chars134": [{"name": "Lina", "look": "red scarf"}], "edCmd": "edit135"}})
    r = waitjob(e.get("id", "x"), 180); rq = sent(n0); pr = inp(rq[0]) if rq else {}
    full = str(pr.get("prompt", "")); out["pics"] = {"status": r.get("status"), "error": r.get("error"), "refs": len(pr.get("reference_image_urls") or []), "prompt": full[-420:]}
    chk("Edit with a picture and a character: the picture is @Image1 in the words, the character named", r.get("status") == "done" and out["pics"]["refs"] == 1 and "the cup on the table is @Image1" in full and "Use @Image1 for what the change brings in" in full and "Lina — red scarf" in full, out["pics"])
    w0 = wallet(); e = api("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "FAILEDIT make it night", "meta": {"edit135": {"src": "/media/e10.mp4"}, "edCmd": "edit135"}}); r = waitjob(e.get("id", "x"), 120)
    out["fail"] = {"status": r.get("status"), "error": r.get("error"), "cost": e.get("cost"), "w": [w0, wallet()]}
    chk("…an engine that fails: the job says so and nothing is charged", r.get("status") == "failed" and "nothing was charged" in str(r.get("error")).lower() and wallet() == w0, out["fail"])
    bad = [api("/v1/jobs", {"kind": "video", "prompt": "red", "meta": {"edit135": {"src": "/media/e3.mp4"}}}), api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"edit135": {"src": "/media/e10.mp4"}}}),
           api("/v1/jobs", {"kind": "video", "prompt": "red", "meta": {"edit135": {"job": "theirs"}}})]
    chk("…refused: a 3 s video, no words, someone else's video", [z.get("_status") for z in bad] == [400, 400, 400], bad)

async def phone(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.myPlan='studio';S.fold134=false;go('video');renderAll()}"); await pg.wait_for_timeout(700)
    st = lambda: E("""()=>{const d=document.querySelector('#main .dock98'),u=document.querySelector('.fu135'),n=document.querySelector('.bottomnav');if(!d)return null;const cs=getComputedStyle(d),ur=u&&u.getBoundingClientRect(),nr=n.getBoundingClientRect();
      const probe=document.elementFromPoint(195,nr.top-70);return{off:d.classList.contains('off134'),vis:cs.visibility,op:+cs.opacity,arrow:u?{on:u.classList.contains('on'),op:+getComputedStyle(u).opacity,w:Math.round(ur.width),bottom:Math.round(ur.bottom),navTop:Math.round(nr.top)}:null,
      overDock:!!(probe&&probe.closest('.dock98'))}}""")
    a = await st(); await pg.locator("#main .fd134").tap(); await pg.wait_for_timeout(800); f = await st()
    await pg.screenshot(path=D + "/phone-folded.png")
    await pg.locator(".fu135").tap(); await pg.wait_for_timeout(800); c = await st()
    out["fold"] = {"open": a, "folded": f, "back": c}
    chk("phone: folded, the prompt box goes away completely (nothing left over the videos or the menu); only a small arrow, just above the bottom menu; the arrow brings it back", a and not a["off"] and a["vis"] == "visible"
        and f and f["off"] and f["vis"] == "hidden" and f["op"] < 0.05 and not f["overDock"] and f["arrow"]["on"] and f["arrow"]["op"] > 0.9 and f["arrow"]["w"] <= 56 and f["arrow"]["bottom"] <= f["arrow"]["navTop"] - 4
        and c and not c["off"] and c["vis"] == "visible" and not c["arrow"]["on"], out["fold"])
    # the editor: dragging the playhead shows the film strip's frame at once; the video only goes there when you let go
    await E("()=>syncServer()"); await pg.wait_for_function("S.jobs.some(j=>j.remote==='jrb')", timeout=20000)
    await E("""()=>{const J=r=>S.jobs.find(j=>j.remote===r).id;window.__sets=0;S.ed.clips=[{id:'k1',src:{k:'job',job:J('jrb')},in:0,out:6,speed:1,trans:'cut',vol:100}];S.ed.texts=[];S.ed.sel='k1';ED.t=.2;ED.playing=false;go('edit');renderAll()}""")
    await pg.wait_for_function("M.c_k1&&M.c_k1.sp135&&M.c_k1.sp135.ok", timeout=30000)
    await E("""()=>{M.c_k1.el.addEventListener('seeking',()=>window.__sets++);document.querySelector('#tlin').scrollIntoView({block:'end'})}""")   # (the video's real jumps)
    await pg.wait_for_timeout(400)
    r = await E("()=>{const tl=document.querySelector('#tlin').getBoundingClientRect(),t=document.querySelector('#tlin .ruler').getBoundingClientRect();return{x:tl.left+40,y:t.top+t.height/2,z:S.ed.zoom}}")
    px = lambda: E("()=>{const c=document.getElementById('wk'),x=c.getContext('2d').getImageData(c.width/2|0,c.height/2|0,1,1).data;return[x[0],x[1],x[2]]}")
    await pg.mouse.move(r["x"] + 0.4 * r["z"], r["y"]); await pg.mouse.down(); await pg.mouse.move(r["x"] + 1.0 * r["z"], r["y"]); await pg.wait_for_timeout(250); red = await px()
    await pg.mouse.move(r["x"] + 4.5 * r["z"], r["y"]); await pg.wait_for_timeout(250); blue = await px(); k = await E("()=>[M.c_k1.sp135.k,Math.round(ED.t*M.c_k1.sp135.fps),window.__sets]")
    await pg.mouse.up(); await pg.wait_for_timeout(500); after = await E("()=>[window.__sets,+ED.t.toFixed(2)]")
    await E("()=>{ED.playing=true}"); await pg.wait_for_timeout(200); await E("()=>edSeekX(document.querySelector('#tlin').getBoundingClientRect().left+80)"); await pg.wait_for_timeout(200)
    icon = await E("()=>{const s=document.querySelector('#main [data-act=\"ed-play\"] svg'),d=document.createElement('div');d.innerHTML=ic('play');return !!s&&s.innerHTML===d.firstElementChild.innerHTML}")
    sel = await E("()=>[getComputedStyle(document.querySelector('#main .tlwrap')).userSelect,getComputedStyle(document.getElementById('wk')).userSelect]")
    out["strip"] = {"red": red, "blue": blue, "k": k, "after": after, "playIcon": icon, "select": sel}
    chk("editor on a phone: dragging the playhead, the picture is the frame under it at once (red at 1 s, blue at 4.5 s) and the video doesn't jump while you drag; it goes there when you let go",
        red[0] > 150 and red[2] < 90 and blue[2] > 150 and blue[0] < 90 and k[0] == k[1] and k[2] == 0 and after[0] >= 1, out["strip"])
    chk("…a drag that stops the video shows the play button again; a long press doesn't select the timeline or the picture", icon and sel == ["none", "none"], out["strip"])
    chk("phone: no page errors", not errs, errs[:3]); await ctx.close()

async def page(b):
    ctx = await b.new_context(viewport={"width": 1366, "height": 900}); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.myPlan='studio';S.credits=99999;S.chars.push({id:'c1',name:'Lina',look:'25, black hair',outfit:'red scarf',photo:''})}")
    await E("()=>syncServer()"); await pg.wait_for_function("S.jobs.some(j=>j.remote==='jl3')", timeout=20000)
    ids = await E("()=>Object.fromEntries(['jl1','jl2','jl3'].map(r=>[r,S.jobs.find(j=>j.remote===r).id]))")
    async def done(lid, sec=240):
        for _ in range(sec * 2):
            s = await E("id=>{const j=S.jobs.find(x=>x.id===id);return j&&{st:j.status,meta:j.meta,cost:j.cost,dur:j.dur,remote:j.remote}}", lid)
            if s and s["st"] in ("complete", "failed"): return s
            await pg.wait_for_timeout(500)
        return s
    # the opened video offers Edit with words and Merge videos
    await E("id=>{S.lastVideo=id;go('video');renderAll();const st=ST98();st.lb='video';renderView()}", ids["jl1"]); await pg.wait_for_timeout(600)
    btn = await E("()=>[...document.querySelectorAll('.lb98 [data-act]')].map(b=>b.dataset.act).filter(a=>['extend-job','snd134','ew135','mg135'].includes(a))")
    await pg.locator('.lb98 [data-act="mg135"]').first.click(); await pg.wait_for_timeout(400)
    s1 = await E("()=>({tiles:document.querySelectorAll('#modalRoot .mg135t').length,sel:[...document.querySelectorAll('#modalRoot .mg135t[aria-pressed=\"true\"]')].map(x=>x.dataset.id),go:document.querySelector('#modalRoot [data-act=\"mg135-go\"]').disabled,styles:[...document.querySelectorAll('#modalRoot [data-act=\"mg135-style\"] b')].map(x=>x.textContent)})")
    await pg.locator(f'#modalRoot .mg135t[data-id="{ids["jl2"]}"]').click(); await pg.wait_for_timeout(200)
    s2 = await E("()=>({n:[...document.querySelectorAll('#modalRoot .mg135n')].map(x=>x.textContent),go:document.querySelector('#modalRoot [data-act=\"mg135-go\"]').disabled,note:document.getElementById('mg135n').textContent})")
    await pg.locator('#modalRoot [data-act="mg135-go"]').click(); await pg.wait_for_timeout(500)
    mj = await E("()=>{const j=S.jobs.find(x=>x.id===S.lastVideo);return j&&{id:j.id,meta:j.meta,cost:j.cost}}"); md = await done(mj["id"]) if mj else None
    out["pageMerge"] = {"buttons": btn, "open": s1, "picked": s2, "job": mj, "end": md}
    chk("nooi Studio: the opened video offers Edit with words and Merge videos; Merge lists your videos with this one first, picked in order, free; the merged video comes back", btn == ["extend-job", "snd134", "ew135", "mg135"]
        and s1["tiles"] >= 4 and s1["sel"] == [ids["jl1"]] and s1["go"] and s1["styles"] == ["So the join can't be seen", "Clean cuts"] and s2["n"] == ["1", "2"] and not s2["go"] and "free" in s2["note"]
        and mj and mj["meta"]["merge135"] == {"items": [{"job": "jl1"}, {"job": "jl2"}], "style": "seamless"} and mj["cost"] == 0 and md and md["st"] == "complete", out["pageMerge"])
    # Edit with words from the opened video: some seconds, the price first
    await E("id=>{S.lastVideo=id;const st=ST98();st.lb='video';renderView()}", ids["jl1"]); await pg.wait_for_timeout(500)
    await pg.locator('.lb98 [data-act="ew135"]').first.click(); await pg.wait_for_timeout(300)
    await pg.locator("#ew135w").fill("the sky turns purple"); await pg.locator('#modalRoot [data-act="ew135-whole"][data-v="0"]').click(); await pg.wait_for_timeout(200)
    await pg.locator("#ew135f").fill("1"); await pg.locator("#ew135t").fill("5"); await pg.locator("#ew135t").dispatch_event("change"); await pg.wait_for_timeout(900)
    e1 = await E("()=>({cost:document.getElementById('ew135c').textContent,note:document.getElementById('ew135n').textContent,go:document.querySelector('#modalRoot [data-act=\"ew135-go\"]').disabled})")
    await pg.locator('#modalRoot [data-act="ew135-go"]').click(); await pg.wait_for_timeout(600)
    ej = await E("()=>{const j=S.jobs.find(x=>x.id===S.lastVideo);return j&&{id:j.id,meta:j.meta,cost:j.cost,model:j.model,prompt:j.prompt}}"); ed = await done(ej["id"]) if ej else None
    out["pageEdit"] = {"sheet": e1, "job": ej, "end": ed}
    chk("…Edit with words: the words, some seconds (1–5 s), the price shown before (the owner tests for free); the edit is made", e1["cost"].isdigit() and "1 s–5 s" in e1["note"] and not e1["go"] and ej and ej["meta"]["edit135"] == {"job": "jl1", "from": 1, "to": 5}
        and ej["model"] == "seedance20" and ej["cost"] == int(e1["cost"]) and ed and ed["st"] == "complete", out["pageEdit"])
    # the editor: a clip's menu; join a clip with the next one — one clip takes their place
    await E("I=>{S.ed.clips=[{id:'a1',src:{k:'job',job:I.jl1},in:0,out:6,speed:1,trans:'cut',vol:100},{id:'a2',src:{k:'job',job:I.jl2},in:.5,out:5,speed:1,trans:'cut',vol:100},{id:'a3',src:{k:'job',job:I.jl3},in:0,out:5,speed:1,trans:'cut',vol:100}];S.ed.texts=[];S.ed.sel='a1';go('edit');renderAll()}", ids)
    labels = await E("()=>edMenu131('clip','a1').map(i=>i.label)")
    await E("()=>{const it=edMenu131('clip','a1').find(i=>/Join with the next clip/.test(i.label));it.fn()}"); await pg.wait_for_timeout(600)
    gj = await E("()=>{const k=Object.keys(MGED135)[0];const j=k&&S.jobs.find(x=>x.id===k);return j&&{id:j.id,meta:j.meta}}"); gd = await done(gj["id"]) if gj else None
    await pg.wait_for_timeout(2500)
    cl = await E("()=>S.ed.clips.map(c=>[c.id,c.src.job,+(+c.in).toFixed(2),+(+c.out).toFixed(2)])")
    out["editor"] = {"labels": labels, "job": gj, "end": gd, "clips": cl}
    chk("the editor: a clip offers Edit with words, Join with the next clip and Merge all clips; joining sends both clips' trims and one clip takes their place", all(x in labels for x in ("Edit with words…", "Join with the next clip, seamlessly", "Merge all clips into one"))
        and gj and gj["meta"]["merge135"]["items"] == [{"job": "jl1", "out": 6}, {"job": "jl2", "in": 0.5, "out": 5}] and gd and gd["st"] == "complete" and len(cl) == 2 and cl[0][1] == gj["id"] and cl[1][0] == "a3", out["editor"])
    chk("computer: no page errors", not errs, errs[:3]); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for f in (phone, page):
            try: await f(b)
            except Exception as e: fails.append(f.__name__ + " crashed: " + str(e)[:300])
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
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1)[:16000])
