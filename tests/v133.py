# v133 "every AI engine makes 1- and 2-minute videos, and the parts are joined without visible errors — all in nooi Studio".
# A real nooi server and a stand-in engine that really makes each part FROM THE PICTURE IT IS GIVEN (a slow push-in over it, so a
# part that starts on the right frame continues the one before): it can end a part on a fade to black, start it with still frames,
# drift its colour, make one part louder, or ignore the given picture (a new scene) — the things real engines do. Then:
#  · every engine's real shot lengths (Veo 8 s, MiniMax 6/10 s, Kling 2.6 5/10 s, Gemini Omni 4–10 s, the rest up to 15 s): 1 and
#    2 minutes planned on each, each part a length its engine makes, together the asked length; the page gets the same table
#  · the seam engine on its own: the hand-off frame is before a fade, a new scene is caught, still frames are left out, colour and
#    sound carry on, the join has no jump (a plain join of the same parts does)
#  · 1 minute on Veo 3.1 (8 × 8 s): every part from the clean hand-off frame, one video with no dark dips or jumps, sound levelled
#  · 45 s on MiniMax (10+10+10+10+6), a mix of three engines (Kling 2.6 → Veo → WAN 3.0), a part whose engine ignored the frame made
#    again (and the second time on an engine that keeps first frames), Extend from a clean frame joined seamlessly
#  · the page: the long-video note with each engine's real parts (Arabic too), the home box plans 2 minutes in 8 parts, a long
#    video made from nooi Studio shows its matched joins
# Run: python3 tests/v133.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request, hashlib, struct
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8374, 8375
D = tempfile.mkdtemp(prefix="nooi-v133-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/eng"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOK = {"s": "nooi_" + "s" * 32}
def acct(plan, credits, tok):
    return {"plan": plan, "planUntil": 4102444800000, "credits": credits, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
            "tokens": [{"id": "tk" + plan, "name": "t", "hash": hashlib.sha256(tok.encode()).hexdigest(), "last4": tok[-4:], "created": 1, "dailyCap": 10000000}]}
json.dump({"users": {"local": {"plan": "studio", "planUntil": 4102444800000, "credits": 90000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}, "stu": acct("studio", 90000, TOK["s"])}}, open(D + "/data/db.json", "w"))
ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "mandelbrot=s=1280x720:start_scale=2.5", "-vf", "select=eq(n\\,40)", "-frames:v", "1", D + "/eng/scene.png")
ff("-f", "lavfi", "-i", "smptehdbars=s=1280x720", "-frames:v", "1", D + "/eng/other.png")
MOCK = r'''
import json, sys, urllib.parse, urllib.request, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "ign": {}}; LOCK = threading.Lock()
def make(tid, inp, veo):
    p = str(inp.get("prompt", "")); img = inp.get("first_frame_url") or (inp.get("image_urls") or [None])[0] or (inp.get("imageUrls") or [None])[0] or inp.get("image_url")
    dur = 8 if veo else max(1, int(float(inp.get("duration") or 5))); part = 1
    import re; m = re.search(r"\(part (\d+) of", p); part = int(m.group(1)) if m else 1
    src = DIR + "/scene.png"
    if img:
        src = DIR + "/in_" + tid + ".png"; open(src, "wb").write(urllib.request.urlopen(img, timeout=30).read())
    for flag, lim in (("IGNORE1", 1), ("IGNORE2", 2)):
        if flag in p and part == 3:
            with LOCK:
                n = st["ign"].get(flag, 0)
                if n < lim: st["ign"][flag] = n + 1; src = DIR + "/other.png"
    N = dur * 24; ex = ""
    if "STILLSTART" in p and img: ex += f",tpad=start=6:start_mode=clone,trim=duration={dur}"
    if "SHIFT" in p and part >= 2: ex += ",eq=brightness=0.035:saturation=1.08"   # (an engine creeping a little brighter and more saturated each shot)
    if "FADEEND" in p: ex += f",fade=t=out:st={dur - 0.35:.2f}:d=0.35"
    vol = -4 if ("LOUD" in p and part == 2) else -14
    out = DIR + "/" + tid + ".mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-f", "lavfi", "-i", f"sine=frequency={300 + 40 * part}:duration={dur}", "-filter_complex",
        f"[0:v]scale=1280:720,zoompan=z='1+on*0.0025':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={N}:s=640x360:fps=24{ex},format=yuv420p[v];[1:a]volume={vol}dB[a]",
        "-map", "[v]", "-map", "[a]", "-t", str(dur), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-c:a", "aac", out], check=True)
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/stats": return self.send(st)
        if u.path.startswith("/f/"):
            b = open(DIR + "/" + u.path[3:], "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        tid = (q.get("taskId") or [""])[0]; url = f"http://localhost:{P}/f/{tid}.mp4"
        if "veo/record-info" in u.path: return self.send({"code": 200, "data": {"successFlag": 1, "response": {"resultUrls": [url]}}})
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [url]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        with LOCK: tid = "t%d" % (len(st["reqs"]) + 1); st["reqs"].append({"path": u.path, "body": j, "tid": tid})
        veo = "veo/" in u.path
        if "veo/extend" in u.path: return self.send({"code": 422, "msg": "no extend here"})
        try: make(tid, j if veo else (j.get("input") or {}), veo)
        except Exception as e: return self.send({"code": 500, "msg": str(e)[:200]})
        return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False)[:600]))
def api(p, body=None, tok="s"):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", "authorization": "Bearer " + TOK[tok]})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
stats = lambda: json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
def waitjob(jid, sec=240):
    t0 = time.time(); r = {}
    while time.time() - t0 < sec:
        r = api("/v1/jobs/" + jid)
        if r.get("status") in ("done", "failed"): break
        time.sleep(.5)
    return r
mfile = lambda url: D + "/media/" + url.split("/media/")[-1]
def dur(f): return round(float(json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", f], capture_output=True, text=True).stdout)["format"]["duration"]), 2)
def lumas(f, w=160, h=90):
    b = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", f"scale={w}:{h}:flags=area,format=gray", "-vsync", "passthrough", "-f", "rawvideo", "-"], capture_output=True).stdout
    n = w * h; fr = [b[i * n:(i + 1) * n] for i in range(len(b) // n)]
    return [sum(x) / n for x in fr], fr
def jumps(fr):   # frame-to-frame change (0–1)
    return [sum(abs(a - b) for a, b in zip(fr[i - 1][::7], fr[i][::7])) / len(fr[i][::7]) / 255 for i in range(1, len(fr))]
def vol(f, a=None, b=None):
    args = ["ffmpeg", "-v", "info", *(["-ss", str(a), "-t", str(b - a)] if a is not None else []), "-i", f, "-vn", "-af", "volumedetect", "-f", "null", "-"]
    e = subprocess.run(args, capture_output=True, text=True).stderr; import re; m = re.search(r"mean_volume: (-?[\d.]+) dB", e); return float(m.group(1)) if m else None
def pic_luma(f):
    b = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", "scale=160:90,format=gray", "-frames:v", "1", "-f", "rawvideo", "-"], capture_output=True).stdout
    return sum(b) / max(1, len(b))
sent = lambda n0, pred=lambda x: True: [x for x in stats()["reqs"][n0:] if pred(x)]
inp = lambda x: x["body"] if "veo/" in x["path"] else (x["body"].get("input") or {})
model = lambda x: "veo:" + x["body"].get("model", "") if "veo/" in x["path"] else x["body"].get("model")

def server_side():
    # every engine's shot lengths and the parts for 1 and 2 minutes
    node = subprocess.run(["node", "--input-type=module", "-e", """
import { longPlan133, shotLens133 } from '@ROOT@/lib/long132.js';
import { KIE_BUILTIN } from '@ROOT@/providers/kie.js';
import { REGISTRY } from '@ROOT@/lib/models.js';
const o = {};
for (const [k, v] of Object.entries(REGISTRY)) { if (v.kind !== 'video' || /^mc/.test(k)) continue; const key = 'kie@' + KIE_BUILTIN.video[k], lens = shotLens133(k, key);
  o[k] = { lens, p60: longPlan133({ kind: 'video', model: k, dur: 60 }, () => key), p120: longPlan133({ kind: 'video', model: k, dur: 120 }, () => key) }; }
o.mix = longPlan133({ kind: 'video', model: 'auto', dur: 30, meta: { parts: 3, partModels: ['kling26', 'veo31', 'wan30'] } }, (i) => 'kie@' + KIE_BUILTIN.video[['kling26', 'veo31', 'wan30'][i]]);
o.crew = longPlan133({ kind: 'video', model: 'seedance20', dur: 18, meta: { parts: 3, partDurs: [6, 6, 6], partModels: ['seedance20', 'seedance20', 'kling30'] } }, () => 'kie@bytedance/seedance-2');
console.log(JSON.stringify(o));""".replace("@ROOT@", ROOT)], cwd=D, capture_output=True, text=True)
    try: h = json.loads(node.stdout)
    except Exception: h = {"err": node.stderr[-600:]}
    out["plans"] = {k: (v if k in ("mix", "crew", "err") else [v["lens"][:3], v["p60"], v["p120"]]) for k, v in h.items()}
    bad = []
    for k, v in h.items():
        if k in ("mix", "crew", "err"): continue
        for T, p in ((60, v["p60"]), (120, v["p120"])):
            if not p or len(p) > 16 or any(x not in v["lens"] for x in p) or not (T <= sum(p) < T + max(v["lens"])): bad.append([k, T, p])
    chk("every engine (" + str(len([k for k in h if k not in ("mix", "crew", "err")])) + "): 1 and 2 minutes in parts its engine really makes, together the asked length, at most 16", not bad and "err" not in h and len(h) >= 28, bad or h.get("err"))
    chk("Veo 8 s shots: 1 minute = 8 parts, 2 minutes = 15; MiniMax 10/6; Kling 2.6 10/5; Gemini Omni 4–10", h.get("veo31", {}).get("p60") == [8] * 8 and h.get("veo", {}).get("p120") == [8] * 15 and h.get("hailuo", {}).get("lens") == [6, 10]
        and h.get("kling26", {}).get("lens") == [5, 10] and h.get("gemomni", {}).get("lens") == [4, 6, 8, 10] and h.get("wan30", {}).get("p120") == [15] * 8, {k: h.get(k) for k in ("veo31", "hailuo", "kling26", "gemomni")})
    chk("a mix of engines (Kling 2.6, Veo, WAN 3.0) in 30 s: 10 + 8 + 12; the crew's own 6-second shots kept", h.get("mix") == [10, 8, 12] and h.get("crew") == [6, 6, 6], [h.get("mix"), h.get("crew")])
    cfg = json.loads(urllib.request.urlopen(f"http://localhost:{PORT}/v1/config").read()).get("shots133") or {}
    chk("the page gets every engine's shot lengths (config shots133)", cfg.get("veo31") == [8] and cfg.get("kling26") == [5, 10] and cfg.get("hailuo") == [6, 10] and "mcswap" not in cfg and len(cfg) >= 28, {k: cfg.get(k) for k in ("veo31", "kling26", "hailuo")})

    # the seam engine on its own: parts made like an engine makes them
    S = D + "/media"
    ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=14", "-f", "lavfi", "-i", "sine=frequency=330:duration=14", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", D + "/src.mp4")
    ff("-i", D + "/src.mp4", "-t", "5", "-vf", "fade=t=out:st=4.65:d=0.35", "-af", "volume=-12dB", "-c:v", "libx264", "-crf", "16", "-c:a", "aac", S + "/sa.mp4")
    ff("-ss", "4.625", "-i", D + "/src.mp4", "-t", "5", "-vf", "tpad=start=5:start_mode=clone,trim=duration=5,eq=brightness=0.08:saturation=1.3", "-af", "volume=4dB", "-c:v", "libx264", "-crf", "16", "-c:a", "aac", S + "/sb.mp4")
    ff("-f", "lavfi", "-i", "mandelbrot=size=640x360:rate=24", "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", S + "/sc.mp4")
    node = subprocess.run(["node", "--input-type=module", "-e", """
import { handoff133, adherence133, joinSeamless133 } from '@ROOT@/lib/seam133.js';
const a = await handoff133('/media/sa.mp4'), b = await handoff133('/media/sb.mp4');
const okB = await adherence133('/media/sb.mp4', a.img), newC = await adherence133('/media/sc.mp4', a.img);
const r = await joinSeamless133([{ url: '/media/sa.mp4', cut: a.t }, { url: '/media/sb.mp4', cut: b.t }]);
console.log(JSON.stringify({ a, okB, newC, r }));""".replace("@ROOT@", ROOT)], cwd=D, capture_output=True, text=True)
    try: u = json.loads(node.stdout)
    except Exception: u = {"err": node.stderr[-600:]}
    out["seamUnit"] = u
    a, r = u.get("a") or {}, u.get("r") or {}
    chk("hand-off frame: the last clean frame, before the engine's fade to black", 4.3 < a.get("at", 9) < 4.65 and a.get("dropped", 0) >= 0.3, a)
    chk("start check: the next part on the given frame passes; a new scene is caught", (u.get("okB") or {}).get("ok") is True and (u.get("newC") or {}).get("ok") is False and (u.get("newC") or {}).get("d", 0) > 0.2, [u.get("okB"), u.get("newC")])
    sm = (r.get("seams") or [{}])[0]
    chk("seam: the still frames at the start left out, the colour carried on", sm.get("same") and sm.get("head", 0) >= 0.2 and sm.get("colour") is True, sm)
    if r.get("url"):
        f = mfile(r["url"]); ff("-i", S + "/sa.mp4", "-i", S + "/sb.mp4", "-filter_complex", "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]", "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "16", D + "/plain.mp4")
        Ls, Fs = lumas(f); Lp, Fp = lumas(D + "/plain.mp4"); js, jp = max(jumps(Fs)), max(jumps(Fp))
        med = sorted(Ls)[len(Ls) // 2]
        v1, v2 = vol(f, 0.5, 4.2), vol(f, 5.2, 9.2); r1, r2 = vol(S + "/sa.mp4"), vol(S + "/sb.mp4")
        out["seamJoin"] = {"jump": round(js, 3), "plainJump": round(jp, 3), "darkest": round(min(Ls) / med, 2), "plainDarkest": round(min(Lp) / sorted(Lp)[len(Lp) // 2], 2), "vol": [v1, v2], "rawVol": [r1, r2], "dur": dur(f)}
        o = out["seamJoin"]
        chk("joined: no jump at the join (a plain join of the same parts jumps), no dip to black", js < 0.5 * jp and js < 0.12 and o["darkest"] > 0.85 and o["plainDarkest"] < 0.5, o)
        chk("joined: the two parts' sound brought to one level (16 dB apart before)", v1 is not None and v2 is not None and abs(v1 - v2) <= abs(r1 - r2) - 6, o)

    # 1 minute on Veo 3.1 — 8 parts of 8 s, an engine that fades out, starts still, drifts in colour and has one loud part
    n0 = len(stats()["reqs"]); w0 = api("/v1/billing").get("credits")
    j = api("/v1/jobs", {"kind": "video", "model": "veo31", "prompt": "A slow push in over a glowing fractal city at night FADEEND STILLSTART SHIFT LOUD", "dur": 60, "aspect": "16:9"})
    chk("1 minute on Veo 3.1: made at once", bool(j.get("id")), j)
    if j.get("id"):
        r = waitjob(j["id"], 300); reqs = sent(n0, lambda x: "veo/generate" in x["path"])
        out["veo"] = {"status": r.get("status"), "error": r.get("error"), "parts": r.get("partsTotal"), "seams": r.get("seams133"), "join": r.get("join133"), "n": len(reqs), "imgs": [bool(inp(x).get("imageUrls")) for x in reqs]}
        chk("Veo: 8 parts, the first from words, the other 7 each from a picture; one video", r.get("status") == "done" and r.get("partsTotal") == 8 and len(reqs) == 8 and out["veo"]["imgs"] == [False] + [True] * 7, out["veo"])
        hand = [pic_luma(D + "/eng/in_" + x["tid"] + ".png") for x in reqs[1:] if os.path.exists(D + "/eng/in_" + x["tid"] + ".png")]
        mid = pic_luma(D + "/eng/scene.png")
        out["veo"]["handoff"] = [round(x) for x in hand]
        chk("Veo: each part started from the clean hand-off frame (never the faded last one), in the first part's colours (the engine's drift doesn't pile up)", len(hand) == 7 and max(hand) <= 1.15 * hand[0] and abs(hand[6] - hand[4]) <= 6, out["veo"]["handoff"])
        s = r.get("seams133") or {}
        chk("Veo: 7 joins, all matched, the colour carried on where the engine drifted", s.get("n") == 7 and s.get("matched") == 7 and s.get("colour", 0) >= 1 and r.get("join133") == "seamless", s)
        if r.get("url"):
            f = mfile(r["url"]); Ls, Fs = lumas(f); med = sorted(Ls)[len(Ls) // 2]; js = jumps(Fs)[:-12]; body = Ls[:-12]   # (the film's own ending may fade out)
            segs = [mfile(u) for u in (r.get("segments") or [])]
            top = sorted(((v, i / 24) for i, v in enumerate(js)), reverse=True)[:3]
            dip = min(body[i] / sorted(body[max(0, i - 24):i + 24])[len(body[max(0, i - 24):i + 24]) // 2] for i in range(len(body)))   # (a dip: darker than the second around it)
            out["veo"]["file"] = {"dur": dur(f), "darkest": round(dip, 2), "maxJump": round(max(js), 3), "medJump": round(sorted(js)[len(js) // 2], 4), "top": [[round(v, 3), round(t, 2)] for v, t in top],
                                  "drift": round(sorted(Ls[-170:-20])[65] / sorted(Ls[24:170])[73], 3)}
            vv = [vol(f, 1, 6.5), vol(f, 9, 14), vol(f, 17, 22)]; out["veo"]["vol"] = vv; out["veo"]["rawVol"] = [vol(x) for x in segs[:3]]
            o = out["veo"]["file"]
            chk("Veo: one file of about a minute (64 s made, the faded ends and still starts left out), no dip to black, no jump, no colour creeping from part to part", 57 <= o["dur"] <= 64 and o["darkest"] > 0.8 and o["maxJump"] < 0.08 and o["drift"] < 1.2, o)
            chk("Veo: the loud part brought to the others' level (10 dB above before)", None not in vv and abs(vv[1] - vv[0]) <= 3 and abs(vv[1] - vv[2]) <= 3, [vv, out["veo"]["rawVol"]])
        w1 = api("/v1/billing").get("credits"); out["veo"]["charged"] = [w0, w1]

    # 45 s on MiniMax: 10 + 10 + 10 + 10 + 6
    n0 = len(stats()["reqs"])
    j = api("/v1/jobs", {"kind": "video", "model": "hailuo", "prompt": "Waves roll onto a quiet beach at sunrise", "dur": 45, "aspect": "16:9"})
    if j.get("id"):
        r = waitjob(j["id"], 240); reqs = sent(n0)
        out["minimax"] = {"status": r.get("status"), "durs": [inp(x).get("duration") for x in reqs], "models": [model(x) for x in reqs], "file": dur(mfile(r["url"])) if r.get("url") else None}
        chk("MiniMax, 45 s: parts of 10, 10, 10, 10 and 6 s (what it makes), the 2nd on from a picture; one video of about 45 s", r.get("status") == "done" and [int(x) for x in out["minimax"]["durs"]] == [10, 10, 10, 10, 6]
            and out["minimax"]["models"][0] == "minimax-h3/text-to-video" and all(m == "minimax-h3/image-to-video" for m in out["minimax"]["models"][1:]) and 42 <= (out["minimax"]["file"] or 0) <= 46.5, out["minimax"])
    else: chk("MiniMax 45 s made", False, j)

    # a mix of three engines, chosen per part
    n0 = len(stats()["reqs"])
    j = api("/v1/jobs", {"kind": "video", "model": "kling26", "prompt": "A red kite rises over green hills", "dur": 30, "aspect": "16:9", "meta": {"parts": 3, "partModels": ["kling26", "veo31", "wan30"]}})
    if j.get("id"):
        r = waitjob(j["id"], 240); reqs = sent(n0)
        out["mix"] = {"status": r.get("status"), "error": r.get("error"), "models": [model(x) for x in reqs], "durs": [inp(x).get("duration") for x in reqs], "seams": r.get("seams133")}
        chk("three engines in one video: Kling 2.6 (10 s), Veo (8 s, from a picture), WAN 3.0 (12 s, from a picture), joined", r.get("status") == "done" and out["mix"]["models"] == ["kling-2.6/text-to-video", "veo:veo3", "wan/3-0-video"]
            and str(out["mix"]["durs"][0]) == "10" and int(out["mix"]["durs"][2]) == 12 and inp(reqs[2]).get("first_frame_url") and (r.get("seams133") or {}).get("n") == 2, out["mix"])
    else: chk("mix made", False, j)

    # an engine that ignored the picture once → that part made again; twice → the third time on an engine that keeps first frames
    for flag, want in (("IGNORE1", 2), ("IGNORE2", 3)):
        n0 = len(stats()["reqs"])
        j = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "A tram crosses a snowy square " + flag, "dur": 45, "aspect": "16:9"})
        if not j.get("id"): chk(flag + " made", False, j); continue
        r = waitjob(j["id"], 240); p3 = [x for x in sent(n0) if "(part 3 of" in str(inp(x).get("prompt", ""))]
        out[flag] = {"status": r.get("status"), "p3": [(model(x), "must begin EXACTLY" in str(inp(x).get("prompt", ""))) for x in p3], "seams": r.get("seams133")}
        ok = r.get("status") == "done" and len(p3) == want and not out[flag]["p3"][0][1] and all(x[1] for x in out[flag]["p3"][1:])
        if want == 3: ok = ok and out[flag]["p3"][2][0] == "bytedance/seedance-2" and out[flag]["p3"][1][0] == "wan/3-0-video"
        chk(("a part whose engine started a new scene is made again, told to begin on the frame" if want == 2 else "…and a second miss is made on an engine that keeps first frames (Seedance 2.0)"), ok, out[flag])
        if want == 2 and r.get("seams133"): chk("…and the remade part joins without a dissolve (it started on the frame)", (r.get("seams133") or {}).get("matched") == 2, r.get("seams133"))

    # Extend from a clean frame (the engine faded the video out), joined seamlessly
    j = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "A lighthouse beam sweeps the sea FADEEND", "dur": 10, "aspect": "16:9"})
    if j.get("id"):
        base = waitjob(j["id"], 120); n0 = len(stats()["reqs"])
        e = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "the beam turns toward the shore", "dur": 5, "meta": {"extend132": j["id"]}})
        r = waitjob(e.get("id", "x"), 120) if e.get("id") else e; reqs = sent(n0)
        img = D + "/eng/in_" + reqs[0]["tid"] + ".png" if reqs else ""
        bl, _ = lumas(mfile(base["url"])) if base.get("url") else ([0], None)
        out["extend"] = {"status": r.get("status"), "ext": r.get("ext132"), "hand": round(pic_luma(img)) if os.path.exists(img) else None, "baseBeforeFade": round(bl[int(9.4 * 24)]) if len(bl) > 230 else None}
        f = mfile(r["url"]) if r.get("url") else None
        if f:
            Ls, Fs = lumas(f); body = Ls[:-12]
            out["extend"]["dip"] = round(min(body[i] / sorted(body[max(0, i - 24):i + 24])[len(body[max(0, i - 24):i + 24]) // 2] for i in range(len(body))), 2); out["extend"]["maxJump"] = round(max(jumps(Fs)[:-12]), 3); out["extend"]["dur"] = dur(f)
        e = out["extend"]
        chk("Extend: from the video's last clean frame (not its fade), joined seamlessly into one longer video", r.get("status") == "done" and (r.get("ext132") or {}).get("joined") and (r.get("ext132") or {}).get("seamless")
            and e["hand"] and e["baseBeforeFade"] and e["hand"] >= 0.9 * e["baseBeforeFade"] and e.get("dip", 0) > 0.85 and e.get("maxJump", 1) < 0.08 and 14 <= e.get("dur", 0) <= 15.2, e)

async def page(b):
    ctx = await b.new_context(viewport={"width": 1366, "height": 900}); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg&&API.cfg.shots133", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.myPlan='studio';Object.assign(S.draft,{model:'veo31',dur:60,prompt:''});go('video');renderAll()}"); await pg.wait_for_timeout(700)
    notes = await E("""()=>{const r={};for(const [m,d] of [['veo31',60],['hailuo',45],['kling26',120],['wan30',120],['gemomni',30]]){S.draft.model=m;S.draft.dur=d;renderView();const c=document.querySelector('#main .o93[data-o93="length"]');
      if(c&&c.getAttribute('aria-expanded')!=='true')c.click();const n=document.querySelector('#main .ln132');r[m+d]=n&&!n.hidden?n.textContent:''}return r}""")
    out["notes"] = notes
    chk("nooi Studio: each engine's real parts — Veo 1:00 = 8 × 8 s (1:04 in all), MiniMax 45 s = 10·10·10·10·6, Kling 2.6 2:00 = 12 × 10 s, WAN 3.0 2:00 = 8 × 15 s",
        "8 connected parts of 8 s" in notes.get("veo3160", "") and "1:04 in all" in notes.get("veo3160", "") and "5 connected parts (10 · 10 · 10 · 10 · 6 s)" in notes.get("hailuo45", "")
        and "12 connected parts of 10 s" in notes.get("kling26120", "") and "8 connected parts of 15 s" in notes.get("wan30120", "") and "joins are matched" in notes.get("wan30120", ""), notes)
    ar = await E("()=>{S.lang='ar';S.draft.model='veo31';S.draft.dur=60;renderView();const n=document.querySelector('#main .ln132');const t=n&&!n.hidden?n.textContent:'';S.lang='en';renderView();return t}")
    chk("…in Arabic too", "8 أجزاء متصلة" in ar and "كل جزء 8 ث" in ar and "الوصلات" in ar, ar)
    hb = await E("()=>{go('home');S.hf=S.hf||{};S.hf.tab='video';S.hf.dur=120;const p=hfStudio('a fox runs through the snow',120);S.hf.vModel='veo31';return{n:p&&p.n,per:p&&p.per,models:p&&p.shots.map(s=>s.m),note:hfDurNote(120,120)}}")
    out["home"] = hb
    chk("home box: nooi Auto plans 2 minutes in 8 parts of 15 s (it was cut at 6); a chosen engine's own parts", hb["n"] == 8 and hb["per"] == 15 and len(hb["models"]) == 8 and ("15 connected parts" in hb["note"] or "15 shots at the same time" in hb["note"]), hb)
    # a 30 s video on Veo from nooi Studio: 4 parts, its matched joins shown when opened
    await E("()=>{go('video');S.draft.model='veo31';S.draft.dur=30;S.draft.prompt='A paper boat drifts down a rainy street';renderView()}"); await pg.wait_for_timeout(400)
    await pg.locator('#main [data-act="gen-video"]').click(); await pg.wait_for_timeout(800)
    s = None
    for _ in range(300):
        s = await E("()=>{const j=S.jobs.find(x=>x.id===S.lastVideo);return j&&{st:j.status,seams:j.seams133||null,parts:j.parts108||null}}")
        if s and s["st"] in ("complete", "failed") and (s["seams"] or s["st"] == "failed"): break
        await pg.wait_for_timeout(500)
    await E("()=>renderView()"); await pg.wait_for_timeout(300)
    await E("()=>{const c=document.querySelector('.gc98[data-open98=\"'+S.lastVideo+'\"]');c&&c.click()}"); await pg.wait_for_timeout(700)
    ln = await E("()=>{const p=document.querySelector('.lb98 .sm133');return p?p.textContent:''}")
    out["pageJoin"] = {"end": s, "line": ln}
    chk("a long video from nooi Studio: made, and opened it says its joins were matched", s and s["st"] == "complete" and "3 joins matched" in ln, out["pageJoin"])
    chk("computer: no page errors", not errs, errs[:3]); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        try: await page(b)
        except Exception as e: fails.append("page crashed: " + str(e)[:300])
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "SWAP_ENGINE", "WAN_"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D + "/eng"], stdout=subprocess.DEVNULL, stderr=open(D + "/mock.log", "w"))
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", RECOVER_MS="1500", PART_AGAIN_MS="400",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="true", FREE_PERIOD="false", LONG_FAST="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
        except Exception: time.sleep(.25)
    try: server_side()
    except Exception as e: fails.append("server crashed: " + repr(e)[:300])
    asyncio.run(main())
finally: srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1)[:14000])
