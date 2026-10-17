# v107 Replace the person — the right person in long, crowded videos. A real nooi server, a stand-in engine and a stand-in text AI
# that really looks at the pictures (two "people" in the video: blue on the left, gone from 14 s to 26 s, and green on the right):
#  · a 40 s video → 3 parts of ~13.3 s; a picture of the blue person → followed through the video: the part they're not in is kept
#    as it is (not sent, not charged); the engine gets the new person (Image 1), the person to replace (Image 2) and where they are
#  · the parts joined again: 40 s, the swapped parts from the engine, the kept part as it was, the video's own sound; charged for
#    the seconds swapped (less than the price for the whole video)
#  · a tap on the green person on a frame → just them is cut out and sent as Image 2, every part swapped
#  · several people and nobody picked → refused, nothing charged · a picture of someone not in the video → refused
#  · the text AI down → every part swapped with the picture as it is · a part the engine can't make → the swap fails, nothing charged
#  · the page: 2 minutes, step 3 "The person to replace", tap them on a frame (−2 s / +2 s), the price of the parts, what's sent
#  · a video over 2 minutes refused
# Run: python3 tests/v107.py
import asyncio, hashlib, json, os, subprocess, sys, tempfile, time, urllib.request
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8307, 8308
D = tempfile.mkdtemp(prefix="nooi-v107-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "w" * 32
json.dump({"users": {"cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 30000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]},
    "local": {"plan": "studio", "credits": 30000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
BLUE = "drawbox=x=80:y=60:w=120:h=280:color=0x2040e0:t=fill:enable='not(between(t,14,26))'"; GREEN = "drawbox=x=440:y=60:w=120:h=280:color=0x20c040:t=fill"
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=40", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=40", "-vf", BLUE + "," + GREEN,
   "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/crowd.mp4")
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=8", "-vf", BLUE + "," + GREEN, "-c:v", "libvpx-vp9", "-b:v", "300k", D + "/crowd.webm")   # the page (no H.264 in the test browser)
ff("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=15", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")                     # what the stand-in engine makes: red
ff("-f", "lavfi", "-i", "color=c=0x808080:s=160x90:r=5:d=125", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/media/toolong.mp4")
im = Image.new("RGB", (512, 768), (240, 220, 200)); ImageDraw.Draw(im).ellipse([180, 80, 330, 260], fill=(200, 150, 120)); im.save(D + "/media/char.png")   # the new person
im = Image.new("RGB", (300, 500), "white"); ImageDraw.Draw(im).rectangle([60, 40, 240, 470], fill=(32, 64, 224)); im.save(D + "/media/blue.png")            # a picture of the blue person
im = Image.new("RGB", (300, 500), "white"); ImageDraw.Draw(im).rectangle([60, 40, 240, 470], fill=(230, 210, 30)); im.save(D + "/media/yellow.png")         # someone not in the video
im = Image.new("RGB", (640, 360), (128, 128, 128)); g = ImageDraw.Draw(im); g.rectangle([80, 60, 200, 340], fill=(32, 64, 224)); g.rectangle([440, 60, 560, 340], fill=(32, 192, 64)); im.save(D + "/media/frame.png")
MOCK = r'''
import base64, io, json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": [], "down": False, "fail": False}; T = {}
COL = {"blue": lambda r, g, b: b > 150 and r < 110 and g < 130, "green": lambda r, g, b: g > 150 and r < 110 and b < 120, "yellow": lambda r, g, b: r > 180 and g > 160 and b < 90, "red": lambda r, g, b: r > 170 and g < 90 and b < 90}
def img(part): return Image.open(io.BytesIO(base64.b64decode(part["source"]["data"]))).convert("RGB")
def blobs(im):   # colour → its box (fractions), for each colour with enough pixels
    w, h = im.size; px = im.load(); out = {}
    for name, f in COL.items():
        xs = []; ys = []
        for y in range(0, h, 3):
            for x in range(0, w, 3):
                if f(*px[x, y]): xs.append(x); ys.append(y)
        if len(xs) > 12: out[name] = [min(xs) / w, min(ys) / h, (max(xs) + 3) / w, (max(ys) + 3) / h]
    return out
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def kie(self, d, code=200, msg="success"): self.send({"code": code, "msg": msg, "data": d})
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.mp4":
            b = open(DIR + "/res.mp4", "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        if "ecord" in u.path:
            t = T.get(urllib.parse.parse_qs(u.query).get("taskId", [""])[0], {})
            if t.get("fail"): return self.kie({"state": "fail", "failMsg": "Internal Error", "failCode": "500"})
            url = f"http://localhost:{P}/res.mp4"; return self.kie({"state": "success", "successFlag": 1, "response": {"resultUrls": [url]}, "resultJson": json.dumps({"resultUrls": [url]})})
        self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path == "/plan": st.update(j); return self.send({"ok": 1})
        if u.path == "/api/v1/chat/credit": return self.kie(500)
        if u.path.startswith("/api/v1/"): tid = "t%d" % (len(T) + 1); T[tid] = {"fail": st["fail"]}; st["reqs"].append({"path": u.path, "body": j}); return self.kie({"taskId": tid})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text"); ims = [img(p) for p in parts if p.get("type") == "image"]
            if st["down"]: st["llm"].append("down"); return self.send({"error": {"message": "overloaded"}}, 529)
            people = lambda frames: max([len([k for k in blobs(f) if k in ("blue", "green")]) for f in frames] or [0])
            if "You check the two inputs" in text: kind = "look"; o = {"photo_people": 1, "video_people": people(ims[1:]), "video_person": "clear", "note_en": "", "note_ar": "", "keep_en": "", "sure": True}
            elif "A red box marks one person" in text:
                kind = "pick"; b = blobs(ims[0]); r = b.get("red"); o = {"box": None, "who_en": ""}
                if r:
                    cx, cy = (r[0] + r[2]) / 2, (r[1] + r[3]) / 2
                    for k in ("blue", "green"):
                        q = b.get(k)
                        if q and q[0] - .02 <= cx <= q[2] + .02: o = {"box": q, "who_en": "the person in " + k}
            elif "the person to replace in a video" in text:
                kind = "part"; tb = blobs(ims[0]); tc = max((k for k in tb if k != "red"), key=lambda k: (tb[k][2] - tb[k][0]) * (tb[k][3] - tb[k][1]), default=None)
                seen = [blobs(f) for f in ims[1:]]; here = [s[tc] for s in seen if tc in s]
                o = {"people": people(ims[1:]), "present": "yes" if here else "no", "where_en": ("the person in %s on the %s" % (tc, "left" if here[0][0] < .5 else "right")) if here else "", "who_en": "the person in %s" % tc, "sure": True}
            elif "frames from one part of a video" in text: kind = "count"; o = {"people": people(ims), "sure": True}
            else: kind = "other"; o = {}
            st["llm"].append(kind); return self.send({"content": [{"type": "text", "text": json.dumps(o)}]})
        self.send({}, 404)
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def mock(p, body=None):
    req = urllib.request.Request(f"http://localhost:{KPORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"content-type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())
def api(p, body=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", "authorization": "Bearer " + TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=300) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
def done(jid, sec=240): return wait(lambda: (lambda j: j if j.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + jid)), sec)
credits = lambda: api("/v1/billing").get("credits")
def refused(j, sec=90):   # v108: the job is made at once and the files are looked at after — a refusal is the job failing with its reason
    if j.get("_status") == 400: return j.get("error")
    d = done(j.get("id", "x"), sec) or {}
    return d.get("error") if d.get("status") == "failed" else None
def local(u): return D + "/media/" + str(u).split("/media/")[-1]
def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], capture_output=True, text=True).stdout or "{}")
    return {"dur": round(float(j.get("format", {}).get("duration", 0)), 2), "audio": any(s.get("codec_type") == "audio" for s in j.get("streams", []))}
def pixel(f, t):
    o = D + f"/px{t}.png"; ff("-ss", str(t), "-i", f, "-frames:v", "1", o); im = Image.open(o).convert("RGB"); return im.getpixel((im.size[0] // 2, im.size[1] // 2))
red = lambda p: p[0] > 170 and p[1] < 90 and p[2] < 90; grey = lambda p: abs(p[0] - p[1]) < 25 and abs(p[1] - p[2]) < 25 and 90 < p[0] < 170
def share(u, col):   # how much of a picture on the server is this colour
    im = Image.open(local(u)).convert("RGB"); b = im.tobytes(); px = [tuple(b[i:i + 3]) for i in range(0, len(b), 3)]; f = {"blue": lambda r, g, b: b > 150 and r < 110 and g < 130, "green": lambda r, g, b: g > 150 and r < 110 and b < 120}[col]
    return round(sum(1 for p in px if f(*p)) / len(px), 2)
SWAP = {"kind": "video", "model": "mcswap", "prompt": "", "dur": 40, "aspect": "16:9", "inputs": {"mcMove": "/media/crowd.mp4", "mcChar": "/media/char.png"}, "meta": {"motion83": True, "swap93": True, "consent": True}}
tasks = lambda n0: [r["body"] for r in mock("/stats")["reqs"][n0:] if r["body"].get("model")]

def server_checks():
    P_SWAP = api("/v1/config").get("prices", {}).get("video", {}).get("mcswap")
    # 1) a picture of the blue person: followed through 3 parts; the middle part (they're gone) kept as it is
    c0 = credits(); n0 = len(mock("/stats")["reqs"]); t0 = time.time(); j = api("/v1/jobs", {**SWAP, "cid": "b1", "inputs": {**SWAP["inputs"], "mcWho": "/media/blue.png"}}); took = round(time.time() - t0, 1)
    st0 = api("/v1/jobs/" + j.get("id", "x")); d = done(j.get("id", "x")) or {}
    out["fast"] = [took, j.get("status"), st0.get("stage"), j.get("cost")]
    ok(took < 4 and j.get("status") == "queued" and st0.get("stage") in ("prep", "look", "engine"), f"v108: the job is made at once (the video is made ready after) and says which step it is on {out['fast']}")
    ts = tasks(n0); inp = [t.get("input", {}) for t in ts]
    out["blue"] = [j.get("_status"), j.get("error"), j.get("cost"), d.get("status"), d.get("error"), d.get("url"), [(t.get("model"), i.get("duration"), len(i.get("reference_image_urls") or [])) for t, i in zip(ts, inp)], [i.get("prompt", "")[:230] for i in inp]]
    ok(d.get("status") == "done" and len(ts) == 2 and all(t.get("model") == "minimax-h3/reference-to-video" for t in ts), f"the person is followed: 2 of the 3 parts go to the engine {out['blue'][:7]}")
    ok(all(len(i.get("reference_image_urls") or []) == 2 and "the person in blue on the left" in i.get("prompt", "") and "Every other person in <Video 1> stays exactly as they are" in i.get("prompt", "") and "the person shown in <Picture 2>" in i.get("prompt", "") and "[video editing]" in i.get("prompt", "") for i in inp),
       f"the engine gets the new person (Image 1), the person to replace (Image 2) and where they are {out['blue'][7]}")
    ok(all(i.get("duration") in (13, 14) and len(i.get("reference_video_urls") or []) == 1 and (i.get("reference_video_urls") or [""])[0].endswith(("-mc1.mp4", "-mc3.mp4")) for i in inp), f"each part is its own clip of ~13 s (parts 1 and 3) {[(i.get('duration'), i.get('reference_video_urls')) for i in inp]}")
    f = local(d.get("url", "")); pr = probe(f) if os.path.exists(f) else {}; px = [pixel(f, t) for t in (6, 20, 33)] if os.path.exists(f) else []
    out["joined"] = [pr, px]
    ok(pr and 39.3 <= pr["dur"] <= 40.6 and pr["audio"] and d.get("url", "").endswith("-swap.mp4"), f"the parts joined: 40 s with the video's own sound {pr}")
    ok(len(px) == 3 and red(px[0]) and grey(px[1]) and red(px[2]), f"the swapped parts from the engine, the kept part as it was {px}")
    exp = round(P_SWAP * 27 / 5) if P_SWAP else None
    ok(P_SWAP and j.get("cost") == round(P_SWAP * 40 / 5) and d.get("cost") == exp and exp < j.get("cost") and wait(lambda: c0 - credits() == exp, 10), f"held at the page's price (40 s), charged for the seconds swapped (27 s) {j.get('cost')} → {d.get('cost')} vs {exp}")
    # 2) a tap on the green person on a frame → just them, sent as Image 2; every part swapped
    n0 = len(mock("/stats")["reqs"]); j = api("/v1/jobs", {**SWAP, "cid": "b2", "inputs": {**SWAP["inputs"], "mcWho": "/media/frame.png"}, "meta": {**SWAP["meta"], "whoTap": [0.78, 0.5]}}); d = done(j.get("id", "x")) or {}
    ts = tasks(n0); inp = [t.get("input", {}) for t in ts]; who = (inp[0].get("reference_image_urls") or ["", ""])[1] if inp else ""
    out["tap"] = [j.get("_status"), j.get("error"), d.get("status"), len(ts), who, [i.get("prompt", "")[:200] for i in inp[:1]]]
    ok(d.get("status") == "done" and len(ts) == 3 and all("the person in green on the right" in i.get("prompt", "") for i in inp), f"the tapped person is followed in every part {out['tap']}")
    ok(who.endswith("-who.jpg") and share(who, "green") > 0.5 and share(who, "blue") < 0.02, f"just the tapped person is cut from the frame {who} green {who and share(who, 'green')} blue {who and share(who, 'blue')}")
    # 3) several people and nobody picked → refused, nothing charged
    c0 = credits(); n0 = len(mock("/stats")["reqs"]); j = api("/v1/jobs", {**SWAP, "cid": "b3"}); why = refused(j)
    out["nobody"] = [j.get("_status"), why, c0, credits(), len(tasks(n0))]
    ok("tap the person to replace" in str(why) and wait(lambda: credits() == c0, 10) and not tasks(n0), f"several people, nobody picked: refused, nothing charged {out['nobody']}")
    # 4) a picture of someone who isn't in the video → refused
    c0 = credits(); n0 = len(mock("/stats")["reqs"]); j = api("/v1/jobs", {**SWAP, "cid": "b4", "inputs": {**SWAP["inputs"], "mcWho": "/media/yellow.png"}}); why = refused(j)
    out["gone"] = [j.get("_status"), why, c0, credits(), len(tasks(n0))]
    ok("can't find the person you picked" in str(why) and wait(lambda: credits() == c0, 10) and not tasks(n0), f"a person not in the video: refused, nothing charged {out['gone']}")
    # 5) the text AI down → every part swapped, the picture as it is
    mock("/plan", {"down": True}); n0 = len(mock("/stats")["reqs"]); j = api("/v1/jobs", {**SWAP, "cid": "b5", "inputs": {**SWAP["inputs"], "mcWho": "/media/blue.png"}}); d = done(j.get("id", "x")) or {}; mock("/plan", {"down": False})
    ts = tasks(n0); out["down"] = [j.get("_status"), j.get("error"), d.get("status"), len(ts)]
    ok(d.get("status") == "done" and len(ts) == 3 and all(len(t["input"].get("reference_image_urls") or []) == 2 for t in ts), f"the text AI down: every part swapped with the picture {out['down']}")
    # 6) a part the engine can't make (twice) → the swap fails with the part's words, nothing charged
    mock("/plan", {"fail": True}); c0 = credits(); j = api("/v1/jobs", {**SWAP, "cid": "b6", "inputs": {**SWAP["inputs"], "mcWho": "/media/blue.png"}}); d = done(j.get("id", "x"), 120) or {}; mock("/plan", {"fail": False})
    out["fail"] = [d.get("status"), d.get("error"), c0, credits()]
    ok(d.get("status") == "failed" and "Nothing was charged" in str(d.get("error")) and wait(lambda: credits() == c0, 15), f"a part fails: the swap fails, nothing charged {out['fail']}")
    # 7) over 2 minutes → refused
    c0 = credits(); j = api("/v1/jobs", {**SWAP, "cid": "b7", "inputs": {**SWAP["inputs"], "mcMove": "/media/toolong.mp4"}}); out["toolong"] = [j.get("_status"), refused(j)]
    ok("up to 2 minutes" in str(out["toolong"][1]) and wait(lambda: credits() == c0, 10), f"over 2 minutes: refused, nothing charged {out['toolong']}")

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, lang in ((1280, "en"), (390, "ar")):
            tag = f"{w}/{lang}"; phone = w < 600
            ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=phone, has_touch=phone, device_scale_factor=2 if phone else 1); pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
            sent = []
            async def jobs(route):
                if route.request.method != "POST": return await route.continue_()
                sent.append(json.loads(route.request.post_data or "{}")); await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "rj%d" % len(sent)}))
            await pg.route("**/v1/jobs", jobs)
            await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
            await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;go('motion');renderAll()}" % lang); await pg.wait_for_timeout(400)
            await pg.set_input_files('input[data-slot="mcMove"]', D + "/crowd.webm")
            for _ in range(60):
                if await E("()=>!!(M.mcMove&&M.mcMove.el&&M.mcMove.el.readyState>=2&&mcDur83()>0)"): break
                await asyncio.sleep(.25)
            await E("()=>renderView()"); await pg.wait_for_timeout(300)
            r = await E("""()=>({lbl:[...document.querySelectorAll('.mc83 .lbl')].map(x=>x.textContent),pick:!!document.querySelector('[data-act=mc107-pick]'),up:!!document.querySelector('input[data-slot="mcWho"]'),
              cost:+(document.querySelector('[data-act=mc-make] .cost').textContent.match(/\\d+/)||[0])[0],want:vprice83('mcswap',mcDur105(true,mcDur83()),1),d:mcDur83()})""")
            out["page_" + tag] = r
            ok(r["pick"] and r["up"] and any(("The person to replace" in x) or ("الشخص المراد استبداله" in x) for x in r["lbl"]) and r["cost"] == r["want"] and r["d"] == 8, f"{tag}: step 3 — tap them in the video or upload a picture; the price {r}")
            await pg.click("[data-act=mc107-pick]")
            await pg.wait_for_selector(".pick107 img", timeout=15000); await pg.wait_for_timeout(300)
            bx = await (await pg.query_selector(".pick107 img")).bounding_box(); over = await E("()=>document.documentElement.scrollWidth>innerWidth+1")
            await pg.click("[data-act=mc107-step][data-d='2']"); await pg.wait_for_selector(".pick107 img", timeout=15000); await pg.wait_for_timeout(300)
            t2 = await E("()=>P107.f&&P107.f.t")
            bx = await (await pg.query_selector(".pick107 img")).bounding_box()
            await pg.mouse.click(bx["x"] + bx["width"] * 0.78, bx["y"] + bx["height"] * 0.5); await pg.wait_for_timeout(500)
            r = await E("()=>({tap:M.mcWho&&M.mcWho.tap,file:!!(M.mcWho&&M.mcWho.file),open:P107.open,slot:!!document.querySelector('.slot img'),name:M.mcWho&&M.mcWho.name})")
            out["tap_" + tag] = [r, t2, over]
            ok(r["tap"] and abs(r["tap"][0] - 0.78) < 0.02 and abs(r["tap"][1] - 0.5) < 0.02 and r["file"] and not r["open"] and r["slot"] and t2 and t2 >= 1.5 and not over, f"{tag}: a tap on the frame picks that person (+2 s moves the frame) {out['tap_' + tag]}")
            # make it: the frame and where it was tapped are sent
            await pg.set_input_files('input[data-slot="mcChar"]', D + "/media/char.png"); await pg.wait_for_timeout(400)
            await E("()=>{MC83().consent=true;renderView()}"); await pg.wait_for_timeout(200)
            await pg.click("[data-act=mc-make]")
            for _ in range(60):
                if sent: break
                await asyncio.sleep(.25)
            s0 = sent[0] if sent else {}
            out["sent_" + tag] = {k: s0.get(k) for k in ("model", "dur", "meta", "inputs")}
            ok(s0.get("model") == "mcswap" and str((s0.get("inputs") or {}).get("mcWho", "")).startswith(("/media/", "http")) and (s0.get("meta") or {}).get("whoTap") == r["tap"], f"{tag}: the picked frame and the tap are sent {out['sent_' + tag]}")
            # v108: the card says which step the swap is on; a refusal reads in the page's language
            r = await E("""()=>{const j=S.jobs.filter(x=>x.meta&&x.meta.motion83).pop();if(!j)return null;j.status='rendering';j.stage='engine';j.parts108=[1,3];renderView();
              const a=(document.querySelector('.stage108')||{}).textContent||'';j.stage='join';renderView();const b=(document.querySelector('.stage108')||{}).textContent||'';
              j.stage='prep';renderView();const c=(document.querySelector('.stage108')||{}).textContent||'';
              return{a,b,c,gone:errText81({error:"We can't find the person you picked anywhere in the video — tap them on a frame where they're clearly seen, or use a clearer picture of them."})}}""")
            out["stage_" + tag] = r; en = lang == "en"
            ok(r and (("1 of 3 parts ready" in r["a"] and "Joining the parts" in r["b"] and "Getting your video ready" in r["c"] and r["gone"].startswith("We can't find")) if en else
                      ("جاهز 1 من 3 أجزاء" in r["a"] and "جمع الأجزاء" in r["b"] and "تجهيز الفيديو" in r["c"] and r["gone"].startswith("لم نجد الشخص"))), f"{tag}: the step on the card, the refusal in the page's language {r}")
            ok(not errs, f"{tag}: page errors {errs}")
            await ctx.close()
        await b.close()

mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock-vision", MC_AGAIN_MS="300", MIRROR_MEDIA="false", FREE_PERIOD="false"),
    stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30)
    server_checks()
    asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1))
sys.exit(0)
