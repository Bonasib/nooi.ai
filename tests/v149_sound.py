# v149: sound for the whole edit on the AI engine, and captions translated on the server. A real nooi server, a stand-in engine
# that really makes voices, sound effects, ambience and lip sync, and a stand-in text AI (the agents' sound team; a translator that
# answers numbered lines — once leaving one out, once failing). Checks: the server translation (all lines back, a missing line
# asked again, a failing text AI said plainly), the price of the whole edit before anything is made, and in the editor: one tap
# makes the sound of every clip — each clip's voices, ambience and sound effects land as their own tracks under it (the voices
# marked as voices), the people's words become captions, the lips follow the voices in the picture. Run: python3 tests/v149_sound.py
import asyncio, hashlib, json, os, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8424, 8425; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v149s-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/eng"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOK = "nooi_" + "s" * 32   # (a customer's connection: the local user is the owner, who pays nothing)
json.dump({"users": {"local": {"plan": "studio", "planUntil": 4102444800000, "credits": 90000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "stu": {"plan": "studio", "planUntil": 4102444800000, "credits": 90000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": [{"id": "tks", "name": "t", "hash": hashlib.sha256(TOK.encode()).hexdigest(), "last4": TOK[-4:], "created": 1, "dailyCap": 10000000}]}}}, open(D + "/data/db.json", "w"))
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=8", "-f", "lavfi", "-i", "sine=frequency=300:duration=8", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-c:a", "libopus", "-shortest", D + "/media/a.webm")
MOCK = r'''
import json, sys, re, urllib.parse, urllib.request, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": [], "tr": []}; LOCK = threading.Lock(); EXT = {}; BAD = set()
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
def fetch(u, out): open(out, "wb").write(urllib.request.urlopen(u, timeout=30).read()); return out
def make(tid, model, inp):
    p = str(inp.get("prompt") or inp.get("text") or ""); out = DIR + "/" + tid
    if re.match(r"elevenlabs/text-to-speech", model): d = max(1.0, len(p) * 0.05); FF("-f", "lavfi", "-i", f"sine=frequency=190:duration={d:.2f}", "-af", "volume=2", out + ".mp3"); return ".mp3"
    if re.match(r"elevenlabs/sound-effect", model): d = 6 if inp.get("loop") else 2; FF("-f", "lavfi", "-i", f"anoisesrc=d={d}:c=pink:a=0.3", out + ".mp3"); return ".mp3"
    if model == "ai-music-api/generate": FF("-f", "lavfi", "-i", "sine=frequency=262:duration=30", out + ".mp3"); return ".mp3"
    if model == "volcengine/video-to-video-lip-sync":
        v = fetch(inp["video_url"], out + "-in.mp4"); a = fetch(inp["audio_url"], out + "-in.mp3")
        FF("-i", v, "-i", a, "-filter_complex", "[0:v]drawbox=x=300:y=160:w=40:h=20:color=red@1:t=fill[v]", "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "ultrafast", "-shortest", out + ".mp4"); return ".mp4"
    raise Exception("unknown model " + model)
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/stats": return self.send(st)
        if u.path.startswith("/f/"):
            b = open(DIR + "/" + u.path[3:], "rb").read(); self.send_response(200); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        tid = (q.get("taskId") or [""])[0]
        if tid in BAD: return self.send({"code": 200, "data": {"state": "fail", "failMsg": "engine error"}})
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/f/{tid}{EXT.get(tid, '.mp3')}"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(x.get("text", "") for x in parts if x.get("type") == "text"); st["llm"].append(text[:300])
            if "Translate each numbered line" in text:
                st["tr"].append(text[:200])
                if "FAILTR" in text: return self.send({"error": {"message": "overloaded"}}, 529)
                lines = re.findall(r"^(\d+)\| (.*)$", text, re.M); keep = lines[:-1] if ("MISSONE" in text and "Every number from" not in text) else lines
                return self.send({"content": [{"type": "text", "text": "\n".join(f"{k}| AR:{t}" for k, t in keep)}]})
            if "sound team" in text:
                plan = {"mood": "warm", "lines": [{"who": "Lina", "gender": "female", "age": "young", "text": "This is our new car, come and see it.", "emotion": "warm", "at": 0.5, "onScreen": True}],
                        "ambience": "a quiet living room", "sfx": [{"what": "a toy car rolls on a table", "at": 2.0, "dur": 1.2}, {"what": "a hand claps", "at": 3.5, "dur": 0.6}], "music": ""}
                return self.send({"content": [{"type": "text", "text": json.dumps(plan)}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        with LOCK: tid = "t%d" % (len(st["reqs"]) + 1); st["reqs"].append({"path": u.path, "model": j.get("model"), "tid": tid})
        try: EXT[tid] = make(tid, j.get("model", ""), j.get("input") or {})
        except Exception as e: BAD.add(tid)
        return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
def api(p, body=None, tok=None):
    req = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def dur(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", f], capture_output=True, text=True).stdout or "{}"); return round(float((j.get("format") or {}).get("duration") or 0), 2)
mfile = lambda url: D + "/media/" + url.split("/media/")[-1]

def server_side():
    r = api("/v1/translate149", {"lines": ["Hello there", "See you soon"], "to": "ar", "from": "en"})
    chk("the server translates every line, in order", r.get("lines") == ["AR:Hello there", "AR:See you soon"], r)
    r = api("/v1/translate149", {"lines": ["one", "two", "three MISSONE"], "to": "ar"})
    chk("a reply that leaves a line out is asked again (all lines come back)", r.get("lines") == ["AR:one", "AR:two", "AR:three MISSONE"], r)
    r = api("/v1/translate149", {"lines": ["x FAILTR"], "to": "ar"})
    chk("a failing text AI: a plain message (try again), no provider name", r.get("_status") == 503 and "try again" in (r.get("error") or "") and "529" not in (r.get("error") or ""), r)
    r = api("/v1/translate149", {"lines": ["x"], "to": "xx"}); chk("an unknown language is refused", r.get("_status") == 400, r)
    q = api("/v1/sound149/quote", {"parts": [{"len": 6}, {"len": 4}], "want": {"voice": True, "sfx": True, "amb": True, "music": False}, "who": "auto", "lang": "en", "lipsync": True}, TOK)
    q1 = api("/v1/sound149/quote", {"parts": [{"len": 6}], "want": {"voice": True, "sfx": True, "amb": True, "music": False}, "who": "auto", "lang": "en", "lipsync": True}, TOK)
    chk("the price of the whole edit before anything is made (two clips cost more than one; everything can be made here)", q.get("total", 0) > q1.get("total", 0) > 0 and q.get("missing") == [] and q.get("parts") == 2, [q, q1])
    out["quote"] = [q, q1]

SETUP = """async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.texts=[];S.ed.format='youtube';
 const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'talk.webm',{type:'video/webm'})]);
 S.ed.tab='aiaudio144';S.ed.lt143='audio';go('edit');renderAll()}"""
async def browser(b):
    ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E(SETUP); await pg.wait_for_function("S.ed.clips.length===1&&srcReady(clipMedia(S.ed.clips[0]))", timeout=20000)
    await pg.wait_for_timeout(800); await E("()=>{S.ed.clips[0].in=1;S.ed.clips[0].out=7;persist();S.ed.tab='aiaudio144';renderView()}")
    try: await pg.wait_for_function("(()=>{const b=document.querySelector('[data-act=\"sd149-go\"]');return b&&!b.disabled&&!!b.querySelector('.cost,.crc')})()", timeout=10000); ok = True
    except Exception: ok = False
    card = await E("()=>{const c=document.querySelector('.sd149');return c?{chips:[...c.querySelectorAll('[data-act=\"sd149-want\"]')].map(b=>b.textContent+':'+b.getAttribute('aria-pressed')),btn:(document.querySelector('[data-act=\"sd149-go\"]')||{}).textContent}:null}")
    chk("the AI audio panel offers Sound for the whole video, priced first (the price on the button)", ok and card and "1 clip" in card["btn"], card)
    await pg.click('[data-act="sd149-go"]')
    try: await pg.wait_for_function("(S.ed.sfx||[]).length>=4", timeout=150000); ok = True
    except Exception: ok = False
    await pg.wait_for_timeout(1500)
    st = await E("""()=>{const E=S.ed,c=E.clips[0];return {sfx:E.sfx.map(x=>({name:x.name,t:x.t,voice:!!x.voice,vol:x.vol,file:!!M['sx_'+x.id]})),caps:(E.caps.words||[]).map(w=>w.w).join(' '),src:c.src,jobs:S.jobs.filter(j=>j.meta&&j.meta.sound134).map(j=>({st:j.status,stems:!!(j.snd134&&j.snd134.stems),lips:j.snd134&&j.snd134.lips,meta:j.meta.sound134}))}}""")
    out["landed"] = st
    v = [x for x in st["sfx"] if x["voice"]]; amb = [x for x in st["sfx"] if x["name"].startswith("Ambience")]; fx = [x for x in st["sfx"] if not x["voice"] and not x["name"].startswith("Ambience")]
    chk("the clip's voices, ambience and two sounds of what happens land as their own tracks under it", ok and len(v) == 1 and len(amb) == 1 and len(fx) == 2 and all(x["file"] for x in st["sfx"]), st["sfx"])
    chk("…at the clip's start (the voices and the ambience) and at their moments (the sounds)", v and v[0]["t"] == 0 and amb and amb[0]["t"] == 0 and sorted(x["t"] for x in fx) == [2.0, 3.5], st["sfx"])
    m = st["jobs"][0]["meta"] if st["jobs"] else {}
    chk("the part of the file on the timeline is what was sent (from 1 s to 7 s), with separate tracks asked for", m.get("scope") == "shot" and m.get("from") == 1 and m.get("to") == 7 and m.get("stems") is True, m)
    chk("the people's words became captions", "new car" in st["caps"], st["caps"])
    chk("the lips follow the voice: the clip now plays the lip-synced picture", st["src"].get("k") == "job" and st["jobs"] and st["jobs"][0]["lips"], [st["src"], st["jobs"]])
    # the files on the server: each track as long as the part, the sounds short
    j = [x for x in json.load(open(D + "/data/db.json"))["users"]["local"]["jobs"].values() if (x.get("snd134") or {}).get("stems")]
    s = j[0]["snd134"]["stems"] if j else {}
    out["stems"] = s
    chk("on the server: the voices and the ambience as long as the part (6 s), each sound effect alone", s and abs(dur(mfile(s["voice"]["url"])) - 6) < 0.3 and abs(dur(mfile(s["amb"]["url"])) - 6) < 0.3 and len(s["sfx"]) == 2 and all(dur(mfile(x["url"])) <= 2.1 for x in s["sfx"]), s)
    chk("no page errors", not errs, errs); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        try:
            server_side(); await browser(b)
        finally: await b.close()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D + "/eng"], stdout=subprocess.DEVNULL, stderr=open(D + "/mock.log", "w"))
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", ENGINE134_POLL_MS="300",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", MIRROR_MEDIA="true", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: time.sleep(.25)
    asyncio.run(main())
except Exception as e: fails.append("crashed: " + repr(e)[:400])
finally: srv.kill(); mk.kill()
print(json.dumps(out, ensure_ascii=False, default=str)[:1500])
print("FAIL " + str(len(fails)) if fails else "PASS"); [print(" ✗", f) for f in fails]
sys.exit(1 if fails else 0)
