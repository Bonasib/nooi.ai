# v134: Extend that can't be seen (the camera and the action carry on) or another angle (a picture of the new angle first, a clean
# cut), with words, pictures and characters, also from the editor · voices & sound for a made video — the whole video, one shot or
# one moment — chosen by the agents, made by the engines, the lips following the voice · the phone's prompt box folds away.
# A real nooi server, a stand-in engine that really makes each thing (videos from the picture it is given, voices, sounds, music,
# lip sync, pictures of a new angle) and a stand-in text AI (the agents' sound team). Run: python3 tests/v134.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request, hashlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8376, 8377
D = tempfile.mkdtemp(prefix="nooi-v134-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/eng"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOK = {"s": "nooi_" + "s" * 32, "o": "nooi_" + "o" * 32}
def acct(plan, credits, tok):
    return {"plan": plan, "planUntil": 4102444800000, "credits": credits, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
            "tokens": [{"id": "tk" + tok[-1], "name": "t", "hash": hashlib.sha256(tok.encode()).hexdigest(), "last4": tok[-4:], "created": 1, "dailyCap": 10000000}]}
other = acct("studio", 1000, TOK["o"]); other["jobs"]["theirs"] = {"id": "theirs", "kind": "video", "status": "done", "url": "/media/x.mp4", "created": 1, "payload": {"kind": "video"}}
json.dump({"users": {"local": {"plan": "studio", "planUntil": 4102444800000, "credits": 90000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}, "stu": acct("studio", 90000, TOK["s"]), "oth": other}}, open(D + "/data/db.json", "w"))
ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "mandelbrot=s=1280x720:start_scale=2.5", "-vf", "select=eq(n\\,40)", "-frames:v", "1", D + "/eng/scene.png")
ff("-f", "lavfi", "-i", "color=c=0x406080:s=640x360", "-frames:v", "1", D + "/media/pic1.png")
MOCK = r'''
import json, sys, re, urllib.parse, urllib.request, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": [], "llmImages": [], "bad": []}; LOCK = threading.Lock()
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
def fetch(u, out): open(out, "wb").write(urllib.request.urlopen(u, timeout=30).read()); return out
def make(tid, model, inp, veo):
    p = str(inp.get("prompt") or inp.get("text") or ""); out = DIR + "/" + tid
    if re.match(r"elevenlabs/text-to-speech", model):   # a voice: a tone that rises and falls like speech, as long as the words
        d = max(1.0, len(p) * 0.055); FF("-f", "lavfi", "-i", f"sine=frequency=190:duration={d:.2f}", "-af", "tremolo=f=5:d=0.7,volume=2", out + ".mp3"); return ".mp3"
    if re.match(r"elevenlabs/sound-effect", model):
        if "FAILSFX" in p: raise Exception("sound engine down")
        d = 6 if inp.get("loop") else 3; FF("-f", "lavfi", "-i", f"anoisesrc=d={d}:c=pink:a=0.35", out + ".mp3"); return ".mp3"
    if model == "ai-music-api/generate":
        FF("-f", "lavfi", "-i", "sine=frequency=262:duration=40", "-f", "lavfi", "-i", "sine=frequency=330:duration=40", "-filter_complex", "amix=inputs=2", out + ".mp3"); return ".mp3"
    if model == "volcengine/video-to-video-lip-sync":   # the lips: the same picture with a marker where the mouth would move, and the voice
        v = fetch(inp["video_url"], out + "-in.mp4"); a = fetch(inp["audio_url"], out + "-in.mp3")
        FF("-i", v, "-i", a, "-filter_complex", "[0:v]drawbox=x=300:y=160:w=40:h=20:color=red@1:t=fill[v]", "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "ultrafast", "-shortest", out + ".mp4"); return ".mp4"
    if re.match(r"nano-banana", model):   # a picture of another angle: a close-up of the middle of the given picture
        src = fetch((inp.get("image_input") or [None])[0], out + "-in.png") if inp.get("image_input") else DIR + "/scene.png"
        FF("-i", src, "-vf", "crop=iw/2:ih/2,scale=640:360", out + ".png"); return ".png"
    img = inp.get("first_frame_url") or (inp.get("image_urls") or [None])[0] or (inp.get("imageUrls") or [None])[0] or (inp.get("reference_image_urls") or [None])[-1]
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
            text = " ".join(x.get("text", "") for x in parts if x.get("type") == "text"); imgs = sum(1 for x in parts if x.get("type") == "image"); st["llm"].append(text[:400])
            if "sound team" in text:
                st["llmImages"].append(imgs)
                if "-second moment" in text: plan = {"mood": "tense", "lines": [], "ambience": "", "sfx": [{"what": "a heavy door slams shut", "at": 0, "dur": 1}], "music": ""}
                else: plan = {"mood": "hopeful", "lines": [{"who": "narrator", "gender": "male", "age": "middle", "text": "The city wakes slowly under a pale sky, and nobody is in a hurry yet.", "emotion": "calm", "at": 0.3, "onScreen": False},
                                                         {"who": "Lina", "gender": "female", "age": "young", "text": "I have waited a long time for this morning.", "emotion": "warm", "at": 5.0, "onScreen": True}],
                              "ambience": "a quiet city at dawn, distant traffic", "sfx": [{"what": "birds take off FAILSFX" if "FAILSFX" in text else "birds take off", "at": 2.0, "dur": 1.5}], "music": "soft piano, hopeful"}
                return self.send({"content": [{"type": "text", "text": json.dumps(plan)}]})
            m = re.search(r"in (\d+) connected shots", text)
            if m: k = int(m.group(1)); return self.send({"content": [{"type": "text", "text": json.dumps({"title": "t", "bible": "the same place", "shots": ["shot %d of the push in" % (i + 1) for i in range(k)]})}]})
            if "Image 1 is the reference of a scene" in text: return self.send({"content": [{"type": "text", "text": json.dumps({"score": 90, "same": True, "differences": []})}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        with LOCK: tid = "t%d" % (len(st["reqs"]) + 1); st["reqs"].append({"path": u.path, "body": j, "tid": tid})
        veo = "veo/" in u.path
        if "veo/extend" in u.path: return self.send({"code": 422, "msg": "no extend here"})
        try: EXT[tid] = make(tid, "veo" if veo else j.get("model", ""), j if veo else (j.get("input") or {}), veo)
        except Exception as e: st["bad"].append(tid); EXT[tid] = ".mp3"
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
def red(f, t):   # the lip-sync marker in the frame at t?
    b = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", f, "-frames:v", "1", "-vf", "crop=20:10:310:165,format=rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
    px = [b[i:i + 3] for i in range(0, len(b) - 2, 3)]; return bool(px) and sum(1 for p in px if p[0] > 180 and p[1] < 80 and p[2] < 80) > len(px) * 0.6
inp = lambda x: x["body"] if "veo/" in x["path"] else (x["body"].get("input") or {})
model = lambda x: "veo" if "veo/" in x["path"] else x["body"].get("model")
def sent(n0, pred=lambda x: True): return [x for x in stats()["reqs"][n0:] if pred(x)]
wallet = lambda: api("/v1/billing").get("credits")

def server_side():
    # a 10 s video to work on (the engine pushes in slowly and ends on a fade)
    base = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "A slow push in over a glowing city at dawn FADEEND", "dur": 10, "aspect": "16:9"})
    b = waitjob(base["id"], 120); out["base"] = {"status": b.get("status")}
    if b.get("status") != "done": chk("the base video was made", False, b); return
    # Extend — the same movement: the motion at the end is read and carried on, joined seamlessly
    n0 = len(stats()["reqs"])
    e = api("/v1/jobs", {"kind": "video", "prompt": "", "dur": 5, "meta": {"extend132": base["id"]}}); r = waitjob(e.get("id", "x"), 120); rq = sent(n0)
    p = inp(rq[0]).get("prompt", "") if rq else ""
    out["same"] = {"status": r.get("status"), "ext": r.get("ext132"), "ext134": r.get("ext134"), "prompt": p[-260:]}
    chk("Extend · same movement: the camera's push-in at the end is carried on (read from the video), one seamless longer video", r.get("status") == "done" and "The camera keeps pushing in" in p and (r.get("ext132") or {}).get("seamless") and (r.get("ext134") or {}).get("mode") == "same", out["same"])
    # Extend — another angle: a picture of the new angle first, then the video from it, a clean cut
    w0 = wallet(); n0 = len(stats()["reqs"])
    e = api("/v1/jobs", {"kind": "video", "prompt": "she looks up at the tower", "dur": 5, "meta": {"extend132": base["id"], "extMode134": "angle", "angle134": "close"}}); r = waitjob(e.get("id", "x"), 120); rq = sent(n0)
    img = [x for x in rq if re.match(r"nano-banana", str(model(x)))]; vid = [x for x in rq if model(x) == "wan/3-0-video"]
    out["angle"] = {"status": r.get("status"), "error": r.get("error"), "ext": r.get("ext132"), "ext134": r.get("ext134"), "stages": r.get("_stages"), "models": [model(x) for x in rq], "cost": e.get("cost"),
                    "imgPrompt": inp(img[0]).get("prompt", "")[:160] if img else None, "vidPrompt": inp(vid[0]).get("prompt", "")[:200] if vid else None, "from": (inp(vid[0]).get("first_frame_url") or "")[-30:] if vid else None}
    chk("Extend · another angle: first a picture of the close-up (from the clean last frame), then the video from that picture, joined with a clean cut", r.get("status") == "done" and img and vid and "close-up" in (out["angle"]["imgPrompt"] or "")
        and "new camera angle" in (out["angle"]["vidPrompt"] or "") and "she looks up at the tower" in (out["angle"]["vidPrompt"] or "") and inp(img[0]).get("image_input") and (r.get("ext132") or {}).get("joined") and (r.get("ext134") or {}).get("mode") == "angle" and "angle" in (r.get("_stages") or []), out["angle"])
    plain = api("/v1/jobs", {"kind": "video", "prompt": "x", "dur": 5, "meta": {"extend132": base["id"]}}); waitjob(plain.get("id", "x"), 120)
    chk("…another angle costs the video plus the picture of the angle", (e.get("cost") or 0) > (plain.get("cost") or 0) > 0, [e.get("cost"), plain.get("cost")])
    # Extend with pictures and characters → an engine that keeps them (Seedance 2.0), the frame as the opening reference
    n0 = len(stats()["reqs"])
    e = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "#guide waves to #image1", "dur": 5, "inputs": {"vRef1": "/media/pic1.png"},
                         "meta": {"extend132": base["id"], "refs130": [{"slot": "vRef1", "tag": "image1"}], "chars134": [{"name": "Lina", "look": "25, red scarf, blue coat"}]}}); r = waitjob(e.get("id", "x"), 120); rq = sent(n0)
    p = inp(rq[0]).get("prompt", "") if rq else ""
    out["refs"] = {"status": r.get("status"), "error": r.get("error"), "model": model(rq[0]) if rq else None, "refs": len(inp(rq[0]).get("reference_image_urls") or []) if rq else 0, "prompt": p[:400]}
    chk("Extend with a picture and a character: on Seedance 2.0 with the picture + the last frame as references, the character in the words", r.get("status") == "done" and out["refs"]["model"] == "bytedance/seedance-2" and out["refs"]["refs"] == 2
        and "@Image1" in p and "opens exactly on @Image2" in p and "Lina — 25, red scarf" in p, out["refs"])
    # the editor's extension: the new part alone, with where to cut the clip and where the new part really begins
    e = api("/v1/jobs", {"kind": "video", "prompt": "", "dur": 5, "meta": {"extend132": base["id"], "extNoJoin134": 1}}); r = waitjob(e.get("id", "x"), 120)
    f = mfile(r["url"]) if r.get("url") else None
    out["editor"] = {"status": r.get("status"), "ext134": r.get("ext134"), "file": info(f) if f else None}
    chk("the editor's Extend: only the new seconds come back, with the clip's clean cut and the new part's real start", r.get("status") == "done" and (r.get("ext134") or {}).get("cut") and 9.3 < r["ext134"]["cut"] < 9.7 and r["ext134"].get("head", -1) >= 0 and f and 4.5 < info(f)["dur"] < 5.6, out["editor"])
    # …from a clip that isn't on the server (its last frame uploaded as a picture), another angle
    e = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "", "dur": 5, "meta": {"extend132": "/media/pic1.png", "extNoJoin134": 1, "extMode134": "angle", "angle134": "wide"}}); r = waitjob(e.get("id", "x"), 120)
    chk("…and from a picture (a clip of your own): another angle made from it", r.get("status") == "done" and (r.get("ext134") or {}).get("mode") == "angle", {k: r.get(k) for k in ("status", "error", "ext134")})
    # a long video: each next part is told the motion at the end of the part before
    n0 = len(stats()["reqs"])
    lj = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "A slow push in over a glowing city at dawn", "dur": 20, "aspect": "16:9"}); lr = waitjob(lj.get("id", "x"), 240); rq = sent(n0, lambda x: model(x) == "wan/3-0-video")
    out["long"] = {"status": lr.get("status"), "n": len(rq), "p2": inp(rq[1]).get("prompt", "")[-320:] if len(rq) > 1 else None, "cuts": lr.get("cuts134")}
    chk("a long video: the next part carries on the camera's motion, and the video says where its parts meet", lr.get("status") == "done" and len(rq) == 2 and "The camera keeps pushing in" in (out["long"]["p2"] or "") and len(lr.get("cuts134") or []) == 1, out["long"])

    # ---- voices & sound
    q = api("/v1/sound134/quote", {"job": base["id"], "scope": "all", "want": {"voice": True, "sfx": True, "amb": True, "music": True}, "lang": "ar"})
    qm = api("/v1/sound134/quote", {"job": base["id"], "scope": "moment", "at": 3, "want": {"voice": False, "sfx": True}})
    qs = api("/v1/sound134/quote", {"job": lj.get("id"), "scope": "shot", "from": 2, "to": 6})
    out["quote"] = {"all": q, "moment": qm, "shot": {k: qs.get(k) for k in ("t0", "t1", "cuts")}}
    chk("the price first: the whole video (voice, sounds, place, music, lips), one moment (one sound only), one shot (its seconds and the long video's parts)", q.get("total", 0) > qm.get("total", 0) > 0 and q.get("missing") == []
        and all((q.get("parts") or {}).get(k, 0) > 0 for k in ("voice", "sfx", "amb", "music", "lips")) and qm.get("parts", {}).get("voice") == 0 and qs.get("t0") == 2 and qs.get("t1") == 6 and len(qs.get("cuts") or []) == 1, out["quote"])
    chk("…someone else's video is refused", api("/v1/sound134/quote", {"job": "theirs"}).get("_status") == 400 and api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"sound134": {"job": "theirs"}}}).get("_status") == 400)
    # the whole video, in Arabic, the agents decide; a narrator and a person on screen; the sounds; music; the lips
    w0 = wallet(); n0 = len(stats()["reqs"]); l0 = len(stats()["llmImages"])
    s = api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"sound134": {"job": base["id"], "scope": "all", "want": {"voice": True, "sfx": True, "amb": True, "music": True}, "lang": "ar", "who": "auto"}}})
    r = waitjob(s.get("id", "x"), 240); rq = sent(n0); w1 = wallet()
    tts = [x for x in rq if str(model(x)).startswith("elevenlabs/text-to-speech")]; sfx = [x for x in rq if model(x) == "elevenlabs/sound-effect-v2"]; mus = [x for x in rq if model(x) == "ai-music-api/generate"]; lip = [x for x in rq if model(x) == "volcengine/video-to-video-lip-sync"]
    f = mfile(r["url"]) if r.get("url") else None; pl = (r.get("snd134") or {}).get("plan") or {}
    out["all"] = {"status": r.get("status"), "error": r.get("error"), "stages": r.get("_stages"), "tts": [inp(x).get("text", "")[:40] for x in tts], "langs": [inp(x).get("language_code") for x in tts], "sfx": [inp(x).get("text", "")[:50] for x in sfx], "music": len(mus), "lips": len(lip),
                  "images": stats()["llmImages"][l0:], "file": info(f) if f else None, "plan": {k: pl.get(k) for k in ("by", "voices", "ambience", "music", "lips")}, "lines": [(x.get("who"), x.get("s"), x.get("voice")) for x in (pl.get("lines") or [])], "cost": [s.get("cost"), r.get("cost"), w0, w1]}
    chk("voices & sound for the whole video: the agents looked at its frames, two voices (a narrator, the woman on screen), the place's sound, a sound effect, music, made in order", r.get("status") == "done" and len(tts) == 2 and len(sfx) == 2 and len(mus) == 1
        and (out["all"]["images"] or [0])[0] >= 3 and r.get("_stages", [])[:1] == ["look"] and "mix" in r.get("_stages", []) and pl.get("by") == "agents" and len(set((pl.get("voices") or {}).values())) == 2, out["all"])
    chk("…the lips follow the voice only where the woman on screen speaks", len(lip) == 1 and f and red(f, 6.0) and not red(f, 1.5) and "lips" in r.get("_stages", []), out["all"])
    if f:
        out["all"]["vol"] = [vol(f, 0.3, 4.5), vol(f, 5.0, 7.5)]; src = mfile(b["url"]); out["all"]["srcVol"] = [vol(src, 0.3, 4.5)]
        chk("…one video, the same length, with the voices over the video's own sound", out["all"]["file"]["kinds"] == ["video", "audio"] and abs(out["all"]["file"]["dur"] - info(src)["dur"]) < 0.15 and out["all"]["vol"][0] > out["all"]["srcVol"][0] + 3, out["all"])
    chk("…charged what was made (no more than the price shown)", s.get("cost", 0) > 0 and w0 - w1 == r.get("cost") and r.get("cost") <= s.get("cost"), out["all"]["cost"])
    # one moment: a door slam at 3 s
    n0 = len(stats()["reqs"])
    s = api("/v1/jobs", {"kind": "video", "prompt": "a door slams", "meta": {"sound134": {"job": base["id"], "scope": "moment", "at": 3, "want": {"voice": False, "sfx": True}}}})
    r = waitjob(s.get("id", "x"), 120); rq = sent(n0); f = mfile(r["url"]) if r.get("url") else None
    out["moment"] = {"status": r.get("status"), "error": r.get("error"), "models": [model(x) for x in rq], "vol": [vol(f, 1.0, 2.8), vol(f, 3.05, 3.9)] if f else None}
    chk("one moment: a single sound at 3 s, nothing else", r.get("status") == "done" and out["moment"]["models"] == ["elevenlabs/sound-effect-v2"] and out["moment"]["vol"] and out["moment"]["vol"][1] > out["moment"]["vol"][0] + 3, out["moment"])
    # one shot (2–6 s), a narrator only (no lips); a sound engine that fails is left out and not charged
    n0 = len(stats()["reqs"])
    s = api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"sound134": {"job": base["id"], "scope": "shot", "from": 2, "to": 8, "who": "narrator", "say": "FAILSFX", "want": {"voice": True, "sfx": True, "amb": False}}}})
    r = waitjob(s.get("id", "x"), 180); rq = sent(n0); f = mfile(r["url"]) if r.get("url") else None; pl = (r.get("snd134") or {}).get("plan") or {}
    out["shot"] = {"status": r.get("status"), "error": r.get("error"), "models": [model(x) for x in rq], "lines": [(x.get("who"), x.get("s"), x.get("e")) for x in (pl.get("lines") or [])], "notes": (r.get("snd134") or {}).get("notes"), "cost": [s.get("cost"), r.get("cost")]}
    chk("one shot (2–8 s), a narrator: the voices inside those seconds, no lips; the failed sound left out and not charged", r.get("status") == "done" and "volcengine/video-to-video-lip-sync" not in out["shot"]["models"]
        and all(2 <= x[1] and x[2] <= 8.6 for x in out["shot"]["lines"]) and out["shot"]["notes"] and r.get("cost", 99) < s.get("cost", 0), out["shot"])

async def page(b):
    ctx = await b.new_context(viewport={"width": 1366, "height": 900}); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.myPlan='studio';S.chars.push({id:'c1',name:'Lina',look:'25, black hair',outfit:'red scarf',photo:''});S.credits=99999;Object.assign(S.draft,{model:'wan30',dur:5,prompt:'A slow push in over a glowing city at dawn'});go('video');renderAll()}")
    await pg.wait_for_timeout(600); await pg.locator('#main [data-act="gen-video"]').click()
    s = None
    for _ in range(200):
        s = await E("()=>{const j=S.jobs.find(x=>x.id===S.lastVideo);return j&&{st:j.status,id:j.id}}")
        if s and s["st"] in ("complete", "failed"): break
        await pg.wait_for_timeout(400)
    if not s or s["st"] != "complete": chk("page: a video made to work on", False, s); await ctx.close(); return
    jid = s["id"]; await E("()=>renderView()"); await pg.wait_for_timeout(300)
    # the Extend sheet
    await E("id=>extSheet132(S.jobs.find(x=>x.id===id))", jid); await pg.wait_for_timeout(300)
    x = await E("()=>({cards:[...document.querySelectorAll('#modalRoot .xm134c')].map(b=>b.dataset.v+':'+b.getAttribute('aria-checked')),ang:!document.querySelector('#modalRoot .xa134').hidden,cost:+$('#ext132c').textContent,want:vcost(S.ext132.m,5)})")
    await pg.locator('#modalRoot [data-act="ext134-mode"][data-v="angle"]').click(); await pg.wait_for_timeout(200)
    await pg.locator('#modalRoot [data-act="ext134-ang"][data-v="close"]').click(); await pg.wait_for_timeout(200)
    y = await E("()=>({ang:!document.querySelector('#modalRoot .xa134').hidden,cost:+$('#ext132c').textContent,pic:PIC134(),note:$('#ext134n').textContent})")
    await pg.locator('#modalRoot [data-ext134pic]').set_input_files(D + "/media/pic1.png"); await pg.wait_for_timeout(300)
    await pg.locator('#modalRoot [data-act="ext134-char"][data-id="c1"]').click(); await pg.wait_for_timeout(200)
    z = await E("()=>({thumbs:[...document.querySelectorAll('#modalRoot .xp134i small')].map(s=>s.textContent),char:document.querySelector('#modalRoot [data-act=\"ext134-char\"][data-id=\"c1\"]').getAttribute('aria-pressed'),note:$('#ext134n').textContent,cost:+$('#ext132c').textContent,want:vcost('seedance20',5)+PIC134()})")
    await pg.locator('#modalRoot [data-act="ext132-n"][data-v="10"]').click(); await pg.wait_for_timeout(200)
    z["cost10"] = await E("()=>[+$('#ext132c').textContent,vcost('seedance20',10)+PIC134()]")
    await pg.locator("#ext132w").fill("she looks up"); await pg.locator('#modalRoot [data-act="ext132-go"]').click(); await pg.wait_for_timeout(1200)
    g = await E("()=>{const j=S.jobs.find(x=>x.id===S.lastVideo);return j&&{meta:j.meta,model:j.model,dur:j.dur}}")
    out["pageExt"] = {"first": x, "angle": y, "refs": z, "job": g}
    chk("Extend sheet: Same movement (chosen) and Another angle; the angles; the price with the angle's picture", x["cards"] == ["same:true", "angle:false"] and not x["ang"] and x["cost"] == x["want"] and y["ang"] and y["cost"] == x["want"] + y["pic"] and "picture of the new angle" in y["note"], out["pageExt"])
    chk("…pictures (# names) and characters, then Seedance 2.0 and its price; the job carries all of it", z["thumbs"] == ["#image1"] and z["char"] == "true" and "Seedance 2.0" in z["note"] and z["cost"] == z["want"] and z["cost10"][0] == z["cost10"][1]
        and g and g["meta"].get("extMode134") == "angle" and g["meta"].get("angle134") == "close" and g["meta"].get("chars134") and (g["meta"].get("refs130") or [{}])[0].get("tag") == "image1" and g["model"] == "seedance20" and g["dur"] == 10, out["pageExt"])
    for _ in range(200):
        st = await E("()=>{const j=S.jobs.find(x=>x.id===S.lastVideo);return j&&j.status}")
        if st in ("complete", "failed"): break
        await pg.wait_for_timeout(400)
    chk("…and the new angle is made", st == "complete", st)
    # voices & sound from the opened video
    await E("id=>{S.lastVideo=id;renderView()}", jid); await pg.wait_for_timeout(300)
    await E("()=>{const c=document.querySelector('.gc98[data-open98=\"'+S.lastVideo+'\"]');c&&c.click()}"); await pg.wait_for_timeout(600)
    btn = await E("()=>!!document.querySelector('.lb98 [data-act=\"snd134\"]')")
    await E("id=>snd134Sheet(S.jobs.find(x=>x.id===id))", jid); await pg.wait_for_timeout(900)
    v = await E("()=>({scopes:[...document.querySelectorAll('#modalRoot .xs134 .xm134c b')].map(b=>b.textContent),want:[...document.querySelectorAll('#modalRoot [data-act=\"snd134-want\"]')].map(b=>b.textContent+':'+b.getAttribute('aria-pressed')),cost:$('#snd134c').textContent,lang:$('#snd134l')&&$('#snd134l').value})")
    await pg.locator('#modalRoot [data-act="snd134-scope"][data-v="moment"]').click(); await pg.wait_for_timeout(700)
    mo = await E("()=>({slider:!!$('#snd134r'),want:[...document.querySelectorAll('#modalRoot [data-act=\"snd134-want\"]')].map(b=>b.textContent),cost:$('#snd134c').textContent})")
    await pg.locator('#modalRoot [data-act="snd134-scope"][data-v="all"]').click(); await pg.wait_for_timeout(700)
    await pg.locator("#snd134l").select_option("ar"); await pg.wait_for_timeout(600)
    await pg.locator('#modalRoot [data-act="snd134-go"]').click(); await pg.wait_for_timeout(1000)
    lines = set()
    for _ in range(300):
        q = await E("()=>{const j=S.jobs.find(x=>x.id===S.lastVideo);const c=j&&document.querySelector('.gc98[data-open98=\"'+j.id+'\"] .lp132');return j&&{st:j.status,line:c?c.textContent:'',meta:j.meta&&j.meta.sound134,plan:!!(j.snd134&&j.snd134.plan)}}")
        if q and q["line"]: lines.add(q["line"][:40])
        if q and q["st"] in ("complete", "failed") and (q["plan"] or q["st"] == "failed"): break
        await pg.wait_for_timeout(400)
    await E("()=>renderView()"); await E("()=>{const c=document.querySelector('.gc98[data-open98=\"'+S.lastVideo+'\"]');c&&c.click()}"); await pg.wait_for_timeout(700)
    heard = await E("()=>{const d=document.querySelector('.lb98 .sh134');return d?{sum:d.querySelector('summary').textContent,n:d.querySelectorAll('li').length}:null}")
    out["pageSnd"] = {"btn": btn, "sheet": v, "moment": mo, "end": q, "lines": sorted(lines), "heard": heard}
    chk("Voices & sound: offered on the opened video; Whole video · One shot · One moment explained; what to add; the price", btn and v["scopes"] == ["Whole video", "One shot", "One moment"] and v["cost"].isdigit()
        and "Voice:true" in v["want"] and mo["slider"] and not any("Music" in w for w in mo["want"]), out["pageSnd"])
    chk("…made from the page in Arabic: the card says each step, the opened video says what you hear", q and q["st"] == "complete" and q["meta"]["lang"] == "ar" and any("agents are watching" in l or "voices" in l or "Mixing" in l for l in lines) and heard and heard["n"] >= 4 and "chosen by the agents" in heard["sum"], out["pageSnd"])
    # a made video's long press offers both
    await E("()=>{document.querySelectorAll('.lb98').forEach(x=>x.remove());const st=ST98&&ST98();if(st)st.lb='';renderView()}"); await pg.wait_for_timeout(300)
    card = pg.locator('.gc98[data-open98]').first; cb = await card.bounding_box()
    await pg.mouse.click(cb["x"] + cb["width"] / 2, cb["y"] + cb["height"] / 3, button="right"); await pg.wait_for_timeout(300)
    it = await E("()=>[...document.querySelectorAll('.cm131 .cm131i')].map(x=>x.textContent.trim())")
    chk("a made video's menu: Extend… and Voices & sound…", "Extend…" in it and "Voices & sound…" in it, it)
    await E("()=>{if(typeof cmClose131==='function')cmClose131();document.querySelectorAll('.cm131').forEach(x=>x.remove());if(typeof CM131!=='undefined'){CM131.el=null;CM131.fired=0}}")
    # the editor: Extend opens the same sheet for the clip; the new part lands after it, cut where it really begins
    ed = await E("""id=>{const j=S.jobs.find(x=>x.id===id);S.ext132=null;S.ed.clips=[{id:'k1',src:{k:'job',job:id},in:0,out:j.dur||5}];S.ed.sel='k1';go('edit');renderAll();const tb=document.querySelector('[data-act="ed-extend91"]');if(tb&&!tb.disabled)tb.click();else extEditor134(S.ed.clips[0]);
      return{title:(document.querySelector('#modalRoot h2,#modalRoot h3,#modalRoot [class*=title]')||{}).textContent||'',cards:document.querySelectorAll('#modalRoot .xm134c').length,clip:S.ext132&&S.ext132.clip,
        tb:!!tb,dis:tb&&tb.disabled,view:S.view,modal:document.querySelector('#modalRoot').innerHTML.length,ext91:Object.values(EXT91),toasts:[...document.querySelectorAll('.toast,[class*=toast]')].map(t=>t.textContent).slice(-2)}}""", jid)
    out["editorOpen"] = ed
    await pg.wait_for_timeout(300); await pg.locator('#modalRoot [data-act="ext132-go"]').click(); await pg.wait_for_timeout(1000)
    out["editorDbg"] = await E("()=>({toasts:[...document.querySelectorAll('.toast,[class*=toast]')].map(t=>t.textContent).slice(-3),ext91:Object.keys(EXT91),edp:Object.keys(EDP),modal:document.querySelector('#modalRoot').innerHTML.length,last:(S.jobs.slice(-1)[0]||{}).meta})")
    xid = (out["editorDbg"]["ext91"] or [None])[-1]; e2 = None
    for _ in range(200):
        e2 = await E("id=>{const j=id&&S.jobs.find(x=>x.id===id);const nc=j&&S.ed.clips.find(q=>q.src&&q.src.k==='job'&&q.src.job===j.id);return j&&{st:j.status,meta:j.meta,ext:j.ext134||null,clips:S.ed.clips.map(c=>[c.id,c.in,c.out]),landed:!!nc}}", xid)
        if e2 and e2["st"] in ("complete", "failed") and e2["landed"]: break
        await pg.wait_for_timeout(400)
    await pg.wait_for_timeout(1500); e2 = await E("id=>{const j=id&&S.jobs.find(x=>x.id===id);return j&&{st:j.status,meta:j.meta,ext:j.ext134||null,clips:S.ed.clips.map(c=>[c.id,c.in,c.out])}}", xid)
    out["editor"] = {"open": ed, "end": e2}
    chk("the editor's Extend: the same sheet for the clip; the new part comes back alone and lands after the clip, which ends at its clean last frame", ed["cards"] == 2 and ed["clip"] == "k1" and "clip" in ed["title"].lower() and e2 and e2["st"] == "complete" and e2["meta"].get("extNoJoin134") == 1
        and len(e2["clips"]) == 2 and e2["clips"][0][2] is not None and e2["clips"][0][2] < 5 and e2["clips"][1][1] >= 0, out["editor"])
    chk("computer: no page errors", not errs, errs[:3]); await ctx.close()

async def phone(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='ar';S.user={name:'T',method:'google'};AU.showAuth=false;S.myPlan='studio';S.fold134=false;go('video');renderAll()}"); await pg.wait_for_timeout(700)
    pos = lambda: E("()=>{const d=document.querySelector('#main .dock98'),a=document.querySelector('#main .fd134');if(!d||!a)return null;const r=d.getBoundingClientRect(),b=a.getBoundingClientRect(),t=getComputedStyle(d).transform;return{top:Math.round(r.top),h:Math.round(r.height),off:d.classList.contains('off134'),arrow:[Math.round(b.width),Math.round(b.height)],label:a.getAttribute('aria-label'),t,ta:getComputedStyle(document.querySelector('#main .cz98')).visibility}}")
    a = await pos(); await pg.locator("#main .fd134").tap(); await pg.wait_for_timeout(700); bb = await pos()
    await E("()=>renderView()"); await pg.wait_for_timeout(300); kept = await pos()
    await pg.locator("#main .fd134").tap(); await pg.wait_for_timeout(700); c = await pos()
    out["fold"] = {"open": a, "folded": bb, "afterRender": kept, "back": c}
    chk("phone: a small arrow on the prompt box folds it away (a slide), it stays folded, the arrow brings it back; Arabic labels", a and not a["off"] and a["arrow"][0] <= 64 and bb and bb["off"] and bb["top"] > a["top"] + 0.6 * a["h"] and bb["ta"] == "hidden" and "أظهر" in bb["label"]
        and kept and kept["off"] and c and not c["off"] and c["t"] == "none" and c["ta"] == "visible" and "أخفِ" in (a["label"] or ""), out["fold"])
    await pg.screenshot(path=D + "/phone-folded.png") if False else None
    await E("()=>{S.fold134=true;renderView()}"); await pg.wait_for_timeout(600); await pg.screenshot(path=D + "/phone-folded.png"); await E("()=>{S.fold134=false;renderView()}")
    w = await E("()=>matchMedia('(min-width:768px)').matches")
    chk("phone: no page errors", not errs, errs[:3]); await ctx.close()
    ctx = await b.new_context(viewport={"width": 1280, "height": 860}); pg = await ctx.new_page(); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;S.fold134=true;go('video');renderAll()}"); await pg.wait_for_timeout(500)
    dk = await E("()=>{const a=document.querySelector('#main .fd134');return{arrow:a?getComputedStyle(a).display:null,off:document.querySelector('#main .dock98').classList.contains('off134')}}")
    chk("computer: no fold arrow, the prompt box always there", dk["arrow"] == "none" and not dk["off"], dk); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for f in (page, phone):
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
