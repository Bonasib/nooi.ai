# v103 Character Swap: a look at the photo and the video before anything is charged — a real nooi server, a stand-in swap
# engine and a stand-in text AI that reads pictures:
#  · the AI is sure the photo shows 3 people (a front / side / back sheet): refused with the reason, nothing charged, nothing sent
#  · the AI is sure there's no person in the video: refused the same way
#  · the AI isn't sure: the swap goes to the engine as before
#  · the AI noticed the person is hidden behind an object and the engine fails: the failure says what may have stopped it
#    (English and Arabic), nothing charged
#  · the text AI is down: the swap goes on as before
#  · the AI saw the photo and three frames of the video
# Run: python3 tests/v103.py
import hashlib, json, os, subprocess, sys, tempfile, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8301, 8302
D = tempfile.mkdtemp(prefix="nooi-v103-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "z" * 32
json.dump({"users": {"cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x3060a0:s=512x768", "-frames:v", "1", D + "/media/pic.png"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/media/move.mp4"], check=True)
subprocess.run(["cp", D + "/media/move.mp4", D + "/vid.mp4"], check=True)
# v104: a movement video with its own sound (the engine's result, vid.mp4, is silent)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "3",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/talk.mp4"], check=True)
has_sound = lambda f: "audio" in subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", f], capture_output=True, text=True).stdout
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={reqs:[],llm:[],look:null,swap:[]};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');s.setHeader('connection','close');
 const json=(o,code=200)=>{s.statusCode=code;s.setHeader('content-type','application/json');s.end(JSON.stringify(o))};
 const send=(d,code=200,msg='success')=>json({code,msg,data:d});
 if(u.pathname==='/stats')return json(st);
 if(u.pathname==='/plan'){const o=JSON.parse(b||'{}');if('look' in o)st.look=o.look;if(o.swap)st.swap=o.swap;return json({ok:1})}
 if(u.pathname==='/vid.mp4'){s.setHeader('content-type','video/mp4');return s.end(fs.readFileSync(path.join(DIR,'vid.mp4')))}
 if(u.pathname==='/v1/messages'){let j={};try{j=JSON.parse(b||'{}')}catch{}const c=(j.messages||[])[0]||{},parts=Array.isArray(c.content)?c.content:[{type:'text',text:String(c.content||'')}];
   const text=parts.filter(p=>p.type==='text').map(p=>p.text).join(' '),imgs=parts.filter(p=>p.type==='image').length;st.llm.push({imgs,look:/video tool/.test(text)});
   if(/video tool/.test(text)){if(st.look==='down')return json({error:{message:'overloaded'}},529);return json({content:[{type:'text',text:JSON.stringify(st.look||{})}]})}
   return json({content:[{type:'text',text:'{}'}]})}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){let j={};try{j=JSON.parse(b||'{}')}catch{}st.reqs.push({path:u.pathname,body:j});const id='t'+(++n);T[id]=j;j._out=st.swap.shift()||'ok';return send({taskId:id})}
 if(/record-?[iI]nfo/.test(u.pathname)){const j=T[u.searchParams.get('taskId')]||{};if(j._out==='fail')return send({state:'fail',failMsg:'Internal Error',failCode:'500'});
   const url='http://localhost:'+P+'/vid.mp4';return send({state:'success',successFlag:1,response:{resultUrls:[url]},resultJson:JSON.stringify({resultUrls:[url]})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def mock(p, body=None):
    req = urllib.request.Request(f"http://localhost:{KPORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET")
    return json.loads(urllib.request.urlopen(req).read())
def api(p, body=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", "authorization": "Bearer " + TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=90) as r: return json.loads(r.read())
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
credits = lambda: api("/v1/billing").get("credits")
SWAP = {"kind": "video", "model": "mcswap", "prompt": "", "dur": 3, "aspect": "16:9", "inputs": {"mcMove": "/media/move.mp4", "mcChar": "/media/pic.png"}, "meta": {"motion83": True, "swap93": True, "consent": True, "res": "480p"}}

mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}",
    AGENTS_AUTO_LEARN="false", KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock-vision",
    MC_AGAIN_MS="300", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30)
    tasks = lambda n0: [r["body"].get("model") for r in mock("/stats")["reqs"][n0:]]
    PV = api("/v1/config").get("prices", {}).get("video", {}); P_SWAP, P_MC30 = PV.get("mcswap"), PV.get("mc30")
    # 1) a front / side / back sheet: three people, the AI is sure → refused, nothing charged, nothing sent
    mock("/plan", {"look": {"photo_people": 3, "video_people": 1, "video_person": "clear", "note_en": "", "note_ar": "", "sure": True}})
    c0 = credits(); n0 = len(mock("/stats")["reqs"]); l0 = len(mock("/stats")["llm"]); j = api("/v1/jobs", {**SWAP, "cid": "a1"})
    look = mock("/stats")["llm"][l0:]; out["three"] = [j.get("_status"), j.get("error"), c0, credits(), tasks(n0), look]
    ok(j.get("_status") == 400 and "shows 3 people" in str(j.get("error")) and credits() == c0 and not tasks(n0), f"a photo with 3 people: refused with the reason, nothing charged or sent {out['three']}")
    ok(look and look[0]["look"] and look[0]["imgs"] == 4, f"the AI saw the photo and three frames of the video {look}")
    # 2) no person in the video, sure → refused
    mock("/plan", {"look": {"photo_people": 1, "video_people": 0, "video_person": "none", "sure": True}})
    j = api("/v1/jobs", {**SWAP, "cid": "a2"}); out["novideo"] = [j.get("_status"), j.get("error")]
    ok(j.get("_status") == 400 and "can't see a person in the video" in str(j.get("error")), f"no person in the video: refused {out['novideo']}")
    # 3) not sure → the engine gets it
    mock("/plan", {"look": {"photo_people": 3, "video_people": 1, "sure": False}})
    n0 = len(mock("/stats")["reqs"]); j = api("/v1/jobs", {**SWAP, "cid": "a3"}); d = done(j.get("id", "x")) or {}
    out["unsure"] = [j.get("_status"), d.get("status"), tasks(n0)]
    ok(d.get("status") == "done" and tasks(n0) == ["wan/2-2-animate-replace"], f"the AI isn't sure: the swap goes on {out['unsure']}")
    # 4) the person is hidden behind an object and the engine fails → the failure says what may have stopped it
    mock("/plan", {"look": {"photo_people": 1, "video_people": 1, "video_person": "hidden", "note_en": "the man holds a large model car in front of his body", "note_ar": "الرجل يحمل مجسّم سيارة كبيراً أمام جسمه", "sure": True}, "swap": ["fail", "fail"]})
    c0 = credits(); j = api("/v1/jobs", {**SWAP, "cid": "a4"}); d = done(j.get("id", "x"), 90) or {}
    out["hidden"] = [d.get("status"), d.get("error"), d.get("errorAr"), c0, credits()]
    ok(d.get("status") == "failed" and "large model car" in str(d.get("error")) and "مجسّم سيارة" in str(d.get("errorAr")) and wait(lambda: credits() == c0, 10),
       f"the engine fails on a hidden person: the failure says what may have stopped it, nothing charged {out['hidden']}")
    # 5) the text AI is down → the swap goes on as before
    mock("/plan", {"look": "down"}); n0 = len(mock("/stats")["reqs"]); j = api("/v1/jobs", {**SWAP, "cid": "a5"}); d = done(j.get("id", "x")) or {}
    out["down"] = [j.get("_status"), j.get("error"), d.get("status"), tasks(n0)]
    ok(d.get("status") == "done" and tasks(n0) == ["wan/2-2-animate-replace"], f"the text AI is down: the swap goes on {out['down']}")
    # v104 6) the page asked for 480p (an old page): the engine still gets 720p, the swap's best; the silent result keeps the video's
    # sound; the price is the full (720p) one
    mock("/plan", {"look": {"photo_people": 1, "video_people": 1, "video_person": "clear", "sure": True}})
    c0 = credits(); n0 = len(mock("/stats")["reqs"]); j = api("/v1/jobs", {**SWAP, "cid": "a6", "inputs": {"mcMove": "/media/talk.mp4", "mcChar": "/media/pic.png"}}); d = done(j.get("id", "x")) or {}
    req = (mock("/stats")["reqs"][n0:] or [{}])[0].get("body", {}).get("input", {}); f = D + "/media/" + str(d.get("url", "")).split("/media/")[-1]
    out["best"] = [j.get("_status"), j.get("cost"), c0 - (credits() or 0), req.get("resolution"), d.get("status"), d.get("url"), os.path.exists(f) and has_sound(f)]
    ok(req.get("resolution") == "720p" and d.get("status") == "done" and P_SWAP and j.get("cost") == round(P_SWAP * 3 / 5) and wait(lambda: c0 - credits() == j.get("cost"), 10), f"the swap always goes at 720p and costs what the page shows {out['best']}")
    ok(os.path.exists(f) and has_sound(f) and d.get("url", "").endswith("-snd.mp4"), f"the swap keeps the sound of the client's video {out['best']}")
    # 7) a silent movement video: the result is the engine's own file, nothing added
    n0 = len(mock("/stats")["reqs"]); j = api("/v1/jobs", {**SWAP, "cid": "a7"}); d = done(j.get("id", "x")) or {}
    out["silent"] = [d.get("status"), d.get("url")]
    ok(d.get("status") == "done" and not d.get("url", "").endswith("-snd.mp4"), f"a silent video: nothing added {out['silent']}")
    # 8) Make it move (Motion Control) asked at 720p: the engine gets 1080p, priced ×1.5 as the page shows
    n0 = len(mock("/stats")["reqs"]); j = api("/v1/jobs", {**SWAP, "model": "mc30", "cid": "a8", "meta": {**SWAP["meta"], "swap93": False, "res": "720p"}}); d = done(j.get("id", "x")) or {}
    req = (mock("/stats")["reqs"][n0:] or [{}])[0].get("body", {}); out["moves"] = [j.get("_status"), j.get("error"), j.get("cost"), req.get("model"), (req.get("input") or {}).get("mode"), d.get("status")]
    ok(req.get("model") == "kling-3.0/motion-control" and (req.get("input") or {}).get("mode") == "1080p" and P_MC30 and j.get("cost") == round(P_MC30 * 3 / 5 * 1.5), f"Make it move always goes at 1080p, priced ×1.5 {out['moves']}")
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
sys.exit(0)
