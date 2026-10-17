# v100 a picture with no words still makes a video — a real nooi server and a stand-in engine that, like Kling 3.0,
# refuses a request with no prompt ("prompt is required"):
#  · Kling 3.0 from a start picture with nothing typed: the job finishes; the engine gets plain words for the picture
#    (and the picture); the page's choices (the style) still reach it
#  · with words typed, the engine gets the client's words (nothing replaced)
#  · neither words nor a picture: refused before anything is charged
#  · a new picture from a reference picture with nothing typed: the picture engine gets words too
# v101 (same run, with the Admin defaults the quick-start card saves — kling-3.0/video, nano-banana-pro):
#  · Character Swap goes to its own engine (it went to Kling 3.0 text/picture-to-video: "prompt is required"), Wan 3.0 too
#  · nooi Auto still uses the Admin default
# v102 (same run): Character Swap whose engine fails on its own side ("internal error", 500) after taking the job
#  · once: it is asked once more and the swap is made (two tasks, one charge)
#  · every time: a clear line (an error on the engine's side, try again, a whole-body photo works best), nothing charged
# Run: python3 tests/v100.py
import hashlib, json, os, subprocess, sys, tempfile, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8296, 8297
D = tempfile.mkdtemp(prefix="nooi-v100-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "q" * 32
json.dump({"users": {"cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x3060a0:s=512x512", "-frames:v", "1", D + "/media/pic.png"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/vid.mp4"], check=True)
subprocess.run(["cp", D + "/vid.mp4", D + "/media/move.mp4"], check=True)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={reqs:[]};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');s.setHeader('connection','close');
 const send=(d,code=200,msg='success')=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code,msg,data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(/^\/(pic\.png|vid\.mp4)$/.test(u.pathname)){s.setHeader('content-type',u.pathname.endsWith('png')?'image/png':'video/mp4');return s.end(fs.readFileSync(path.join(DIR,u.pathname)))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 if(u.pathname==='/swapplan'){st.swap=JSON.parse(b||'[]');return send(1)}   // outcomes for the next Character Swap tasks: "fail" / "ok"
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){let j={};try{j=JSON.parse(b||'{}')}catch{}st.reqs.push({path:u.pathname,body:j});
   if(!String((j.input||{}).prompt||'').trim()&&!/elevenlabs|topaz|recraft|animate/.test(j.model||''))return send(null,422,'prompt is required');   // like Kling 3.0
   const id='t'+(++n);T[id]=j;if(/animate-replace/.test(j.model||''))j._out=(st.swap||[]).shift()||'ok';return send({taskId:id})}
 if(/record-?[iI]nfo/.test(u.pathname)){const j=T[u.searchParams.get('taskId')]||{};if(j._out==='fail')return send({state:'fail',failMsg:'internal error',failCode:'500'});const f=/video|kling|seedance|wan/.test(JSON.stringify(j).slice(0,300))?'vid.mp4':'pic.png';
   const url='http://localhost:'+P+'/'+f;return send({state:'success',successFlag:1,response:{resultUrls:[url]},resultJson:JSON.stringify({resultUrls:[url]})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK); subprocess.run(["cp", D + "/media/pic.png", D + "/pic.png"])
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
def api(p, body=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", "authorization": "Bearer " + TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
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
def done(jid, sec=60): return wait(lambda: (lambda j: j if j.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + jid)), sec)
def sent(n0): return [r["body"] for r in stats()["reqs"][n0:]]

mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}",
    AGENTS_AUTO_LEARN="false", KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", KIE_VIDEO_MODEL="kling-3.0/video", KIE_IMAGE_MODEL="nano-banana-pro", MC_AGAIN_MS="400", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30)
    # 1) Kling 3.0 from a picture, nothing typed
    n0 = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "", "dur": 5, "aspect": "16:9", "inputs": {"startImage": "/media/pic.png"}, "meta": {}})
    d = done(j.get("id", "x")) or {}; r = [b for b in sent(n0) if "kling-3.0" in str(b.get("model"))]; inp = (r[0].get("input") if r else {}) or {}
    out["picture"] = [j.get("_status"), j.get("error"), d.get("status"), d.get("error"), inp.get("prompt"), inp.get("image_urls")]
    ok(d.get("status") == "done" and "Bring this picture to life" in str(inp.get("prompt")) and str(inp.get("image_urls", [""])[0]).endswith("/media/pic.png"),
       f"Kling 3.0 from a picture with nothing typed: done, the engine gets words and the picture {out['picture']}")
    # 2) …and the page's choices still reach it
    n0 = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": " ", "dur": 5, "aspect": "16:9", "inputs": {"startImage": "/media/pic.png"}, "meta": {"style": "cinematic"}})
    d = done(j.get("id", "x")) or {}; r = [b for b in sent(n0) if "kling-3.0" in str(b.get("model"))]; pr = str(((r[0].get("input") if r else {}) or {}).get("prompt"))
    out["choices"] = [d.get("status"), pr]
    ok(d.get("status") == "done" and "Bring this picture to life" in pr and "Cinematic film look" in pr, f"a picture with no words keeps the chosen style {out['choices']}")
    # 3) words typed: the client's words
    n0 = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "A red kite over the sea", "dur": 5, "aspect": "16:9", "inputs": {"startImage": "/media/pic.png"}, "meta": {}})
    d = done(j.get("id", "x")) or {}; r = [b for b in sent(n0) if "kling-3.0" in str(b.get("model"))]; pr = str(((r[0].get("input") if r else {}) or {}).get("prompt"))
    out["words"] = [d.get("status"), pr]
    ok(d.get("status") == "done" and pr.startswith("A red kite over the sea") and "Bring this picture" not in pr, f"with words typed the engine gets them {out['words']}")
    # 4) neither words nor a picture: refused, nothing charged
    c0 = api("/v1/billing").get("credits"); j = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "", "dur": 5, "aspect": "16:9", "meta": {}})
    out["nothing"] = [j.get("_status"), j.get("error"), c0, api("/v1/billing").get("credits")]
    ok(j.get("_status") == 400 and "Describe" in str(j.get("error")) and c0 is not None and out["nothing"][2] == out["nothing"][3], f"neither words nor a picture: refused, nothing charged {out['nothing']}")
    # 5) a new picture from a reference picture, nothing typed
    n0 = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "image", "model": "nano", "prompt": "", "aspect": "1:1", "inputs": {"iRef": "/media/pic.png"}, "meta": {}})
    d = done(j.get("id", "x")) or {}; r = sent(n0); pr = str(((r[0].get("input") if r else {}) or {}).get("prompt"))
    out["image"] = [j.get("_status"), j.get("error"), d.get("status"), pr[:80]]
    ok(d.get("status") == "done" and "A new version of this picture" in pr, f"a new picture from a reference with nothing typed {out['image']}")
    # 6) v101: Character Swap reaches its own engine, not the Admin default (Kling 3.0)
    n0 = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "video", "model": "mcswap", "prompt": "", "dur": 5, "aspect": "9:16", "inputs": {"mcMove": "/media/move.mp4", "mcChar": "/media/pic.png"}, "meta": {"motion83": True, "swap93": True, "consent": True, "res": "720p"}})
    d = done(j.get("id", "x"), 90) or {}; models = [b.get("model") for b in sent(n0)]
    out["swap"] = [j.get("_status"), j.get("error"), d.get("status"), d.get("error"), models]
    ok(d.get("status") == "done" and models and models[0] == "wan/2-2-animate-replace" and "kling-3.0/video" not in models, f"Character Swap goes to its own engine {out['swap']}")
    # 7) a model with its own engine (Wan 3.0) keeps it; nooi Auto uses the Admin default
    for m, want in (("wan30", "wan/3-0-video"), ("auto", "kling-3.0/video")):
        n0 = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "video", "model": m, "prompt": "A boat at sea", "dur": 5, "aspect": "16:9", "meta": {}})
        d = done(j.get("id", "x")) or {}; models = [b.get("model") for b in sent(n0)]; out["route_" + m] = [d.get("status"), models]
        ok(d.get("status") == "done" and models and models[0] == want, f"{m} → {want} {out['route_' + m]}")
    # 8) v102: the swap engine fails on its side once → asked once more → made
    SWAP = {"kind": "video", "model": "mcswap", "prompt": "", "dur": 5, "aspect": "9:16", "inputs": {"mcMove": "/media/move.mp4", "mcChar": "/media/pic.png"}, "meta": {"motion83": True, "swap93": True, "consent": True, "res": "480p"}}
    def plan(o): urllib.request.urlopen(urllib.request.Request(f"http://localhost:{KPORT}/swapplan", data=json.dumps(o).encode(), method="POST"))
    plan(["fail", "ok"]); c0 = api("/v1/billing").get("credits"); n0 = len(stats()["reqs"]); j = api("/v1/jobs", {**SWAP, "cid": "sw-once"})
    d = done(j.get("id", "x"), 90) or {}; tasks = [b.get("model") for b in sent(n0)]; c1 = api("/v1/billing").get("credits")
    out["swapOnce"] = [d.get("status"), d.get("error"), tasks, c0, c1, j.get("cost")]
    ok(d.get("status") == "done" and tasks.count("wan/2-2-animate-replace") == 2 and c0 - c1 == (j.get("cost") or 0) > 0, f"the swap engine failed once on its side: asked once more, made, charged once {out['swapOnce']}")
    # 9) …fails every time → a clear line, nothing charged
    plan(["fail", "fail"]); c0 = api("/v1/billing").get("credits"); n0 = len(stats()["reqs"]); j = api("/v1/jobs", {**SWAP, "cid": "sw-never"})
    d = done(j.get("id", "x"), 90) or {}; tasks = [b.get("model") for b in sent(n0)]; c1 = wait(lambda: (lambda c: c if c == c0 else None)(api("/v1/billing").get("credits")), 10)
    out["swapNever"] = [d.get("status"), d.get("error"), tasks, c0, c1]
    ok(d.get("status") == "failed" and tasks.count("wan/2-2-animate-replace") == 2 and "an error on its side" in str(d.get("error")) and "whole person" in str(d.get("error")) and c1 == c0,
       f"the swap engine fails every time: a clear line, nothing charged {out['swapNever']}")
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
sys.exit(0)
