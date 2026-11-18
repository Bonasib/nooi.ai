# v137: results keep the style of the pictures, the clip and the words (a Style nobody picked isn't added over a picture; the engine
# is told to keep the picture's visual style; "Photorealistic" no longer forced on a film's first pictures, an edit or a replace;
# the planning agents are told there are pictures) · Replace things' analysis works with every vision AI (the frames as one
# picture — a model that takes one picture at a time; boxes in any form; a failed look isn't kept and says so; something not in
# the list can be described; "to what" in Arabic reaches the engine in English).
# A real nooi server, a stand-in engine and a stand-in vision AI that takes ONE picture per request.
# Run: python3 tests/v137.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request, hashlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8382, 8383
D = tempfile.mkdtemp(prefix="nooi-v137-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/eng"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOK = {"s": "nooi_" + "s" * 32, "l": "nooi_" + "l" * 32}
def acct(plan, credits, tok):
    return {"plan": plan, "planUntil": 4102444800000, "credits": credits, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
            "tokens": [{"id": "tk" + tok[-1], "name": "t", "hash": hashlib.sha256(tok.encode()).hexdigest(), "last4": tok[-4:], "created": 1, "dailyCap": 10000000}]}
ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "mandelbrot=s=1280x720:start_scale=2.5", "-vf", "select=eq(n\\,40)", "-frames:v", "1", D + "/eng/scene.png")
ff("-f", "lavfi", "-i", "color=c=0x406080:s=640x360", "-vf", "drawbox=x=200:y=80:w=160:h=200:color=yellow@1:t=fill", "-frames:v", "1", D + "/media/toon.png")
def clip(name, dur, src):
    ff("-f", "lavfi", "-i", src, "-f", "lavfi", "-i", f"sine=frequency=440:duration={dur}", "-t", str(dur), "-af", "volume=-12dB", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", D + "/media/" + name)
clip("lv1.mp4", 6, "mandelbrot=s=640x360:r=24"); clip("lv2.mp4", 6, "testsrc2=s=640x360:r=24")
pj = lambda i, f, t, d: {"id": i, "kind": "video", "status": "done", "url": "/media/" + f, "created": 1, "doneAt": 2, "title": t, "cost": 0, "payload": {"kind": "video", "prompt": t, "dur": d, "aspect": "16:9", "model": "wan30"}}
stu, loc = acct("studio", 90000, TOK["s"]), acct("studio", 90000, TOK["l"])
stu["jobs"] = {"jl1": pj("jl1", "lv1.mp4", "a garden at night", 6), "jfv": pj("jfv", "lv2.mp4", "FAILVISION a test card", 6)}
loc["jobs"] = {"jfv": pj("jfv", "lv2.mp4", "FAILVISION a test card", 6)}
json.dump({"users": {"local": loc, "stu": stu}}, open(D + "/data/db.json", "w"))
MOCK = r'''
import json, sys, re, time, urllib.parse, urllib.request, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "bad": [], "llm": []}; LOCK = threading.Lock()
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
def fetch(u, out): open(out, "wb").write(urllib.request.urlopen(u, timeout=30).read()); return out
def make(tid, model, inp):
    p = str(inp.get("prompt") or ""); out = DIR + "/" + tid
    if re.match(r"nano-banana", model):
        src = fetch((inp.get("image_input") or inp.get("image_urls") or [None])[0], out + "-in.png") if (inp.get("image_input") or inp.get("image_urls")) else DIR + "/scene.png"
        FF("-i", src, "-vf", "scale=1280:720,hue=h=60", out + ".png"); return ".png"
    if re.match(r"bytedance/seedance-2", model) and inp.get("reference_video_urls"):
        v = fetch(inp["reference_video_urls"][0], out + "-ref.mp4"); d = int(inp.get("duration") or 5)
        FF("-i", v, "-an", "-vf", f"colorchannelmixer=rr=1:gg=0.35:bb=0.35,tpad=stop_mode=clone:stop_duration=15,trim=duration={d},setpts=PTS-STARTPTS", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", out + ".mp4"); return ".mp4"
    img = inp.get("first_frame_url") or (inp.get("image_urls") or [None])[0] or (inp.get("reference_image_urls") or [None])[-1]
    dur = max(1, int(float(inp.get("duration") or 5))); src = DIR + "/scene.png"
    if img: src = fetch(img, DIR + "/in_" + tid + ".png")
    FF("-i", src, "-f", "lavfi", "-i", f"sine=frequency=300:duration={dur}", "-filter_complex", f"[0:v]scale=1280:720,zoompan=z='1+on*0.0025':d={dur * 24}:s=640x360:fps=24,format=yuv420p[v];[1:a]volume=-20dB[a]",
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
        if tid not in EXT: return self.send({"code": 200, "data": {"state": "generating"}})
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [url]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/v1/messages":   # a vision AI that takes one picture per request (as NVIDIA's do)
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(x.get("text", "") for x in parts if x.get("type") == "text"); imgs = len([x for x in parts if x.get("type") == "image"])
            with LOCK: st["llm"].append({"text": text[:4000], "images": imgs})
            if imgs > 1: return self.send({"error": {"message": "At most 1 image(s) may be provided in one request."}}, 400)
            if "nooi's analysis team" in text:
                if "FAILVISION" in text: return self.send({"error": {"message": "vision model overloaded"}}, 500)
                return self.send({"content": [{"type": "text", "text": json.dumps({"scene": "A garden at night.", "items": [
                    {"kind": "person", "name": "the man in the red coat", "en": "a man in a red coat", "frames": [0, 1], "best": 0, "box_2d": [200, 300, 800, 600]},
                    {"kind": "animal", "name": "the dog", "en": "a small brown dog", "frames": [2, 3], "best": 2, "box": [0.55, 0.5, 0.9, 0.95]}]})}]})
            if "into natural English" in text:
                return self.send({"content": [{"type": "text", "text": "a lion" if "أسد" in text else "a red sports car" if "سيارة" in text else text.split("\n")[-1][:80]}]})
            if "Image 1 is the reference of a scene" in text: return self.send({"content": [{"type": "text", "text": json.dumps({"score": 90, "same": True, "differences": []})}]})
            if "planning one" in text: return self.send({"content": [{"type": "text", "text": json.dumps({"prompt": "A girl waves. In exactly the visual style of the reference pictures.", "agents": {}, "brief": {}})}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        with LOCK: tid = "t%d" % (len(st["reqs"]) + 1); st["reqs"].append({"path": u.path, "body": j, "tid": tid, "t": time.time()})
        def work():
            try: EXT[tid] = make(tid, j.get("model", ""), j.get("input") or {})
            except Exception as e: st["bad"].append(tid); EXT[tid] = ".mp4"
        threading.Thread(target=work, daemon=True).start()
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
    t0 = time.time(); r = {}
    while time.time() - t0 < sec:
        r = api("/v1/jobs/" + jid, tok=tok)
        if r.get("status") in ("done", "failed"): break
        time.sleep(.4)
    return r
inp = lambda x: x["body"].get("input") or {}
model = lambda x: x["body"].get("model")
PIC = f"http://localhost:{PORT}/media/toon.png"
def sent(body, pred, sec=120):   # the engine request a job makes
    n0 = len(stats()["reqs"]); j = api("/v1/jobs", body); r = waitjob(j.get("id", "x"), sec)
    rq = [x for x in stats()["reqs"][n0:] if pred(x)]; return r, rq

def server_side():
    nano = lambda x: re.match(r"nano-banana", str(model(x)))
    # ---- a picture with a reference: the Style nobody picked isn't added; the engine keeps the picture's style
    r, rq = sent({"kind": "image", "model": "nano", "aspect": "1:1", "prompt": "A girl reading in a garden", "inputs": {"iRef": PIC}, "meta": {"style": "photo"}}, nano)
    p1 = inp(rq[0]).get("prompt", "") if rq else ""
    r, rq = sent({"kind": "image", "model": "nano", "aspect": "1:1", "prompt": "A girl reading in a garden", "inputs": {"iRef": PIC}, "meta": {"style": "photo", "styleChosen136": True}}, nano)
    p2 = inp(rq[0]).get("prompt", "") if rq else ""
    r, rq = sent({"kind": "image", "model": "nano", "aspect": "1:1", "prompt": "The same girl as an anime character", "inputs": {"iRef": PIC}, "meta": {"style": "photo"}}, nano)
    p3 = inp(rq[0]).get("prompt", "") if rq else ""
    r, rq = sent({"kind": "image", "model": "nano", "aspect": "1:1", "prompt": "A red apple on a table", "meta": {"style": "photo"}}, nano)
    p4 = inp(rq[0]).get("prompt", "") if rq else ""
    out["image"] = [p1[:400], p2[:300], p3[:300], p4[:300]]
    chk("a picture from a reference picture: the page's Style that nobody picked ('Photorealistic photograph') isn't added; the engine is told to keep the picture's visual style", p1 and "Photorealistic" not in p1 and "Keep exactly the visual style of the reference picture" in p1 and "a cartoon" in p1, out["image"])
    chk("…a Style the customer picked still counts; words that name a style ('as an anime character') win; without a picture the Style is added as before",
        "Photorealistic photograph" in p2 and "Keep exactly the visual style" not in p2 and "Photorealistic" not in p3 and "Keep exactly the visual style" not in p3 and "Photorealistic photograph" in p4, out["image"])
    # ---- a video with # pictures: no "Cinematic film look" nobody picked; the style kept, said once
    seed = lambda x: str(model(x)).startswith("bytedance/seedance-2")
    r, rq = sent({"kind": "video", "model": "seedance20", "dur": 5, "aspect": "16:9", "prompt": "#ref1 waves at the camera", "inputs": {"vRef1": PIC}, "meta": {"style": "cinematic", "refs130": [{"slot": "vRef1", "tag": "ref1"}]}}, seed)
    v1 = inp(rq[0]).get("prompt", "") if rq else ""
    r, rq = sent({"kind": "video", "model": "seedance20", "dur": 5, "aspect": "16:9", "prompt": "", "inputs": {"vRef1": PIC}, "meta": {"refs130": [{"slot": "vRef1", "tag": "ref1"}]}}, seed)
    v2 = inp(rq[0]).get("prompt", "") if rq else ""
    r, rq = sent({"kind": "video", "model": "seedance20", "dur": 5, "aspect": "16:9", "prompt": "The yellow box slides away", "inputs": {"startImage": PIC}, "meta": {"style": "cinematic"}}, seed)
    v3 = inp(rq[0]).get("prompt", "") if rq else ""
    out["video"] = [v1[:500], v2[:400], v3[:400]]
    chk("a video with # pictures: no 'Cinematic film look' nobody picked; the engine keeps the pictures' visual style, said once", v1 and "Cinematic film look" not in v1 and v1.count("visual style of the reference picture") == 1 and "@Image1" in v1, out["video"])
    chk("…pictures and no words: not 'a natural, realistic video' any more, the picture's own style; a first frame: the same kind of image (a cartoon stays a cartoon)",
        v2 and "realistic" not in v2.lower() and "visual style" in v2 and "a cartoon stays a cartoon" in v2 and "a cartoon stays a cartoon" in v3 and "Cinematic film look" not in v3, out["video"])
    # ---- a film's first pictures: no "Photorealistic" forced; with # pictures, in their style
    n0 = len(stats()["reqs"])
    f = api("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "#ref1 walks through the market", "dur": 10, "aspect": "16:9", "inputs": {"vRef1": PIC},
                         "meta": {"long132": 1, "parts": 2, "shots": ["#ref1 walks in", "#ref1 stops"], "refs130": [{"slot": "vRef1", "tag": "ref1"}]}})
    fr = waitjob(f.get("id", "x"), 240); kf = [inp(x).get("prompt", "") for x in stats()["reqs"][n0:] if nano(x)]
    out["film"] = {"made": [f.get("_status"), f.get("error"), fr.get("status")], "kf": [k[:300] for k in kf]}
    chk("a film's first pictures: never 'Photorealistic'; in the visual style of the reference pictures", len(kf) == 2 and all("Photorealistic" not in k for k in kf) and all("In exactly the visual style" in k for k in kf), out["film"])
    # ---- the planning agents are told there are pictures
    l0 = len(stats()["llm"]); pl = api("/v1/agents/plan", {"prompt": "A girl waves hello", "task": "video", "dur": 5, "pics": 2})
    t = next((x["text"] for x in stats()["llm"][l0:] if "planning one" in x["text"]), "")
    out["plan"] = {"plan": pl.get("prompt"), "told": "2 reference pictures" in t and "Never write \"photorealistic\"" in t}
    chk("the planning agents are told there are 2 pictures and to keep their style (never 'photorealistic' unless asked)", out["plan"]["told"], out["plan"])
    # ---- the analysis: the frames as ONE picture (a vision AI that takes one picture at a time works); boxes in any form
    l0 = len(stats()["llm"]); s = api("/v1/scan136", {"job": "jl1", "lang": "en"}); ll = [x for x in stats()["llm"][l0:] if "analysis team" in x["text"]]
    thumbs = [i.get("thumb") for i in s.get("items") or []]
    def flat(u):
        b = subprocess.run(["ffmpeg", "-v", "error", "-i", D + "/media/" + u.split("/media/")[-1], "-vf", "scale=24:24,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
        m = sum(b) / max(1, len(b)); return (sum((v - m) ** 2 for v in b) / max(1, len(b))) ** .5 < 5
    out["scan"] = {"by": s.get("by"), "failed": s.get("failed"), "items": [(i.get("kind"), i.get("name")) for i in s.get("items") or []], "llm": [(x["images"], "grid of" in x["text"]) for x in ll], "thumbs": [bool(u) and not flat(u) for u in thumbs]}
    chk("the analysis: one picture of all the frames (a vision AI that takes one picture at a time answers) — the person and the dog listed, each with a small picture that isn't blank",
        s.get("by") == "agents" and not s.get("failed") and [i[0] for i in out["scan"]["items"]] == ["person", "animal"] and out["scan"]["llm"] == [(1, True)] and out["scan"]["thumbs"] == [True, True], out["scan"])
    # ---- a look that failed: said (the reason to staff only), not kept — the next time the agents look again
    l0 = len(stats()["llm"]); f1 = api("/v1/scan136", {"job": "jfv", "lang": "en"}); f2 = api("/v1/scan136", {"job": "jfv", "lang": "en"})
    tries = len([x for x in stats()["llm"][l0:] if "analysis team" in x["text"]]); f3 = api("/v1/scan136", {"job": "jfv", "lang": "en"}, tok="l")
    out["fail"] = {"f1": {k: f1.get(k) for k in ("by", "failed", "why")}, "tries": tries, "staff": {k: f3.get(k) for k in ("failed", "why")}}
    chk("…when the agents couldn't look: the sheet is told (no reason given to a customer), nothing kept — asked again, they look again; the owner sees why",
        f1.get("failed") is True and not f1.get("why") and f2.get("failed") is True and tries == 2 and f3.get("failed") is True and "overloaded" in (f3.get("why") or ""), out["fail"])
    # ---- something not in the list, described; "to what" in Arabic → English for the engine
    ch = [{"id": "x1", "what": "the cat on the wall", "to": "أسد"}]
    q = api("/v1/replace136/quote", {"job": "jl1", "lang": "ar", "changes": ch})
    n0 = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "video", "prompt": "the cat → a lion", "meta": {"replace136": {"job": "jl1", "lang": "ar", "changes": ch}}}); r = waitjob(j.get("id", "x"), 240)
    ed = [inp(x).get("prompt", "") for x in stats()["reqs"][n0:] if str(model(x)).startswith("bytedance/seedance-2") and inp(x).get("reference_video_urls")]
    out["custom"] = {"q": q, "status": r.get("status"), "error": r.get("error"), "edit": ed[0][:400] if ed else None, "list": (r.get("replace136") or {}).get("list")}
    chk("Replace things: something the agents didn't list, described by the customer, is changed in the whole video; 'أسد' reaches the engine as 'a lion'; no 'Photorealistic'",
        q.get("total", 0) > 0 and q.get("secs", 0) >= 5.5 and r.get("status") == "done" and ed and "Replace the cat on the wall with a lion" in ed[0] and "Photorealistic" not in ed[0] and "visual style of @Video1" in ed[0], out["custom"])

async def phone(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.myPlan='studio';S.credits=99999}")
    await E("()=>syncServer()"); await pg.wait_for_function("S.jobs.some(j=>j.remote==='jfv')", timeout=20000)
    # the sheet when the agents couldn't look: said, the reason for the owner; something to describe; the sounds as small time bars
    await E("()=>rpSheet136(S.jobs.find(x=>x.remote==='jfv'))"); await pg.wait_for_function("!!document.querySelector('#rp136 [data-act=\"rp136-add\"]')", timeout=60000)
    a = await E("()=>({note:(document.querySelector('#rp136 .rp136f')||{}).textContent||'',bars:document.querySelectorAll('#rp136 .rp136t.snd i').length,blank:[...document.querySelectorAll('#rp136 .rp136t')].filter(t=>t.tagName!=='IMG'&&!t.querySelector('svg')).length})")
    await pg.locator('#rp136 [data-act="rp136-add"]').click(); await pg.wait_for_timeout(200)
    await pg.locator('#rp136 [data-rp136what="x1"]').fill("the sign above the door"); await pg.locator('#rp136 [data-rp136cto="x1"]').fill("a neon sign"); await pg.wait_for_timeout(1500)
    b2 = await E("()=>({sum:[...document.querySelectorAll('#rp136s li')].map(x=>x.textContent),go:document.querySelector('[data-act=\"rp136-go\"]').disabled,cost:(document.getElementById('rp136c')||{}).textContent})")
    out["sheet"] = {"a": a, "b": b2}
    chk("the sheet when the agents couldn't look: it says so, with the reason for the owner; the sounds are small time bars (no blank squares)", "couldn't look" in a["note"] and "overloaded" in a["note"] and a["bars"] >= 1 and a["blank"] == 0, a)
    chk("…'Describe something to change': what it is and what instead — in the numbered list, priced, Make on", b2["sum"] == ["the sign above the door → a neon sign"] and not b2["go"] and b2["cost"] not in ("…", "—"), b2)
    await E("()=>{$('#modalRoot').innerHTML=''}")
    # a Style picked by the customer is sent as theirs; the agents are told how many pictures there are
    st = await E("""async()=>{const sent=[];const of=window.fetch;window.fetch=function(u,opt){if(String(u).includes('/v1/agents/plan')){sent.push(JSON.parse(opt.body||'{}'));return Promise.resolve(new Response(JSON.stringify({prompt:'x',agents:{},by:'ai'}),{status:200,headers:{'content-type':'application/json'}}))}return of.apply(this,arguments)};
      go('home');S.hf.tab='video';renderAll();const c=document.createElement('canvas');c.width=64;c.height=64;const b=await new Promise(r=>c.toBlob(r,'image/png'));loadSlot('hfRef',new File([b],'a.png',{type:'image/png'}));
      try{await API.req('/v1/agents/plan',{json:{prompt:'a girl waves',task:'video'}})}finally{window.fetch=of}
      const before=STY136.image;document.body.insertAdjacentHTML('beforeend','<button id="t137" data-set="img.style" data-val="anime">x</button>');document.getElementById('t137').click();document.getElementById('t137').remove();
      return{plan:sent[0]||null,before,after:STY136.image}}""")
    out["page"] = st
    chk("page: the agents are told the box has a picture; a Style counts as the customer's only once they pick one", (st["plan"] or {}).get("pics") == 1 and st["before"] is False and st["after"] is True, st)
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
print(json.dumps({"fails": fails, "out": {k: json.dumps(v, ensure_ascii=False)[:1400] for k, v in out.items()}, "dir": D}, ensure_ascii=False, indent=1))
