# v161 "we have audio engines that will work in harmony with the agents as a single system — don't forget Kling 4, Kie AI has it,
# make it in the website". A real nooi server, a stand-in AI engine (it records what it is sent) and a stand-in text AI, and the page
# on a phone:
#  · Kling 4.0 is its own model (no longer Kling 3.0 under its name): kling-4.0/reference-to-video, 3–30 s, 720p / 1080p, 21:9,
#    priced from the engine's own rate (1080p 1.5×); a first frame alone → kling-4.0/keyframe-to-video (@first_frame)
#  · the characters, their faces and their voices in ONE request: a character with two pictures is an element with its own voice,
#    one with one picture is @image_N with a voice of its own (@Name_voice); the voice is the library voice's sample clip, found by
#    the server (an address sent by the page is never used); the line someone says stays in Arabic; every @ names something sent
#  · the voice picked in the box for whoever speaks; the customer's own clip (cloned with consent) → its sound alone, at most 20 s
#  · # reference pictures work on Kling 4.0 (@image_N); a job on another engine never carries the cast
#  · the agents are told the engine and the chosen voices
#  · the page: Kling 4.0 in the model list at its price, 30 s, a character goes straight to the engine (no first-frame picture), the
#    voice picked in the box goes with the video (no voice step after it, the sheet says no extra credits), 1080p 1.5×
# Run: python3 tests/v161.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8484, 8485; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v161-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
import hashlib
TOKEN = "nooi_" + "k" * 32   # a customer (the local owner is never charged) — for the prices
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(D + "/data/db.json", "w"))
for n in ["a.jpg", "b.jpg", "s.jpg", "ali.jpg", "faisal.jpg", "frame.png", "can.png"]: subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x806040:s=320x400", "-frames:v", "1", D + "/media/" + n], check=True)
GEORGE, SARAH = "JBFqnCBsd6RMkjVDRZzb", "EXAVITQu4vr4xnSDxMaL"
for v, lg in [(GEORGE, "ar"), (SARAH, "ar"), (GEORGE, "en")]: open(f"{D}/media/vs-{v}-{lg}.mp3", "wb").write(b"ID3" + b"\0" * 2000)   # (the library samples, made before)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x3060a0:s=320x240:r=10:d=30", "-f", "lavfi", "-i", "sine=frequency=220:duration=30", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", D + "/media/myvoice.mp4"], check=True)
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P = int(sys.argv[1]); st = {"reqs": [], "llm": []}
def translate(t):
    if "#cast1" in t and "شاب صيني" in t: return "#cast1, a young Chinese man, says: (⟦1⟧) next to #cast2, with real enthusiasm."
    return "An English prompt."
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        return self.send({"code": 200, "data": {"state": "generating"}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 500})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text"); st["llm"].append(text)
            if text.startswith("Put this prompt for an AI picture / video generator into natural English"): return self.send({"content": [{"type": "text", "text": translate(text)}]})
            if "planning one" in text: return self.send({"content": [{"type": "text", "text": json.dumps({"brief": {}, "agents": {}, "request": "Faisal waves", "prompt": "Faisal waves at the camera and says \"hello\".", "negative": "", "bible": "", "shots": []})}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "data": {"taskId": "t%d" % len(st["reqs"])}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, port=PORT, tok=None):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
stats = lambda: api("/stats", port=KPORT)
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
def engine(body, tok=None):
    n = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "video", "dur": 5, "aspect": "16:9", **body, "meta": {"audio": True, "chosen155": [], **(body.get("meta") or {})}}, tok=tok)
    r = wait(lambda: [x for x in stats()["reqs"][n:] if x["path"].endswith("createTask")] or None, 40) or [{}]
    return j, (r[-1].get("body") or {})
LINE = "اهلا بكم في الصين في شركة روندا"
def mentions_ok(inp):   # every @mention names something sent
    import re
    names = {"image_%d" % (i + 1) for i in range(len(inp.get("image_urls") or []))} | {e["name"].lower() for e in inp.get("elements") or []} | {v["name"].lower() for v in inp.get("voices") or []} | {"first_frame", "last_frame"}
    return [m for m in re.findall(r"@([\w]+)", inp.get("prompt", "")) if m.lower() not in names]

def server_checks():
    # 1. Kling 4.0 is its own model, 3–30 s, 1080p, 21:9, its own price (1080p 1.5×)
    j, r = engine({"model": "kling40", "prompt": "A dancer on a rooftop at sunset", "dur": 25, "aspect": "21:9", "meta": {"res": "1080P"}}, tok=TOKEN); i = r.get("input") or {}; out["t2v"] = r
    ok(r.get("model") == "kling-4.0/reference-to-video", f"Kling 4.0 → kling-4.0/reference-to-video {r.get('model')}")
    ok(i.get("duration") == 25 and i.get("resolution") == "1080p" and i.get("aspect_ratio") == "21:9", f"25 s, 1080p, 21:9 {i}")
    ok(not any(k in i for k in ("image_urls", "elements", "voices", "sound", "mode", "multi_shots")) and "@" not in i.get("prompt", ""), f"words alone: no pictures, people, voices or Kling 3.0 fields {i}")
    out["t2v_j"] = {k: j.get(k) for k in ("cost", "dur", "status", "error", "_status")}; ok(j.get("cost") == round(169 * 5 * 1.5), f"25 s at 1080p = 169 credits per 5 s × 5 × 1.5 {j.get('cost')}")
    j, r = engine({"model": "kling40", "prompt": "A dancer on a rooftop at sunrise", "dur": 5, "meta": {"res": "720P"}}, tok=TOKEN); ok(j.get("cost") == 169, f"5 s at 720p = 169 credits {j.get('cost')}")
    # 2. a first frame alone → the keyframe model, the frame kept exactly
    j, r = engine({"model": "kling40", "prompt": "the cat jumps @nobody", "dur": 8, "inputs": {"vStart": "/media/frame.png"}}); i = r.get("input") or {}; out["frame"] = r; out["frame_j"] = j
    ok(r.get("model") == "kling-4.0/keyframe-to-video" and i.get("first_frame_url") == B + "/media/frame.png" and "@first_frame" in i.get("prompt", "") and "aspect_ratio" not in i and i.get("duration") == 8, f"first frame → keyframe-to-video {r}")
    ok(not mentions_ok(i), f"keyframe: every @ names a frame {i.get('prompt')!r}")
    # 3. two characters, their pictures and voices, an Arabic line
    U = "@يونس شاب صيني يقول: (" + LINE + ") مع @Sara"
    cast = [{"name": "يونس", "faces": ["/media/a.jpg", "/media/b.jpg"], "voice": GEORGE, "voiceUrl": "https://evil.example/x.mp3"}, {"name": "Sara", "faces": ["/media/s.jpg"], "voice": SARAH}]
    j, r = engine({"model": "kling40", "prompt": U, "dur": 10, "aspect": "9:16", "meta": {"cast161": cast}}); i = r.get("input") or {}; out["cast"] = r
    el, vs, p = i.get("elements") or [], i.get("voices") or [], i.get("prompt", "")
    ok(r.get("model") == "kling-4.0/reference-to-video", f"characters stay on reference-to-video {r.get('model')}")
    ok(len(el) == 1 and el[0].get("image_urls") == [B + "/media/a.jpg", B + "/media/b.jpg"] and el[0].get("tag") == "character" and el[0].get("voice_url") == f"{B}/media/vs-{GEORGE}-ar.mp3", f"two pictures → an element with the library voice's sample (Arabic) {el}")
    ok(i.get("image_urls") == [B + "/media/s.jpg"] and vs == [{"name": "Sara_voice", "audio_url": f"{B}/media/vs-{SARAH}-ar.mp3"}], f"one picture → @image_1 + a voice of her own {i.get('image_urls')} {vs}")
    ok("evil.example" not in json.dumps(r), "a voice address sent by the page is never used")
    ok(f"@{el[0]['name'] if el else 'x'}" in p and "Sara (@image_1)" in p and "@Sara_voice" in p and LINE in p and "#cast" not in p and "Everything said aloud is in Arabic" in p, f"the words: the people by their materials, the line in Arabic, the language said {p!r}")
    ok(not mentions_ok(i), f"every @ names something sent {mentions_ok(i)}")
    ok(j.get("title", "").startswith("@يونس"), f"the library keeps the client's own words {j.get('title')!r}")
    t = next((x for x in reversed(stats()["llm"]) if x.startswith("Put this prompt")), ""); ok("#cast1" in t and "يونس" not in t.split("\n\n", 1)[-1], "the names go to the translator as #cast1 (they can't be translated away)")
    j, r = engine({"model": "kling40", "prompt": "@Ali and @Ghost wave", "meta": {"cast161": [{"name": "Ali", "faces": ["/media/ali.jpg", "/media/gone.jpg"]}, {"name": "Ghost", "faces": ["/media/gone2.jpg"]}]}}); i = r.get("input") or {}
    ok(i.get("image_urls") == [B + "/media/ali.jpg"] and "elements" not in i and "Ghost" in i.get("prompt", "") and "@Ghost" not in i.get("prompt", "") and not mentions_ok(i), f"faces no longer on the server are left out {i}")
    # 4. the box's voice for whoever speaks (no character)
    j, r = engine({"model": "kling40", "prompt": "A man in a cafe says \"good morning\"", "meta": {"voice161": {"voice": GEORGE, "url": "https://evil.example/y.mp3"}}}); i = r.get("input") or {}; out["voice"] = r
    ok(i.get("voices") == [{"name": "speaker", "audio_url": f"{B}/media/vs-{GEORGE}-en.mp3"}] and "@speaker" in i.get("prompt", ""), f"the box's voice → @speaker with the English sample {i.get('voices')}")
    # 5. the customer's own clip (cloned, with consent) for the one character → its sound alone, 20 s at most
    j, r = engine({"model": "kling40", "prompt": "@Ali talks about the new phone", "inputs": {"vVoice161": "/media/myvoice.mp4"}, "meta": {"cast161": [{"name": "Ali", "faces": ["/media/ali.jpg"]}], "voice161": {"clip": 1, "who": "Ali"}}}); i = r.get("input") or {}; out["clip"] = r
    vu = ((i.get("voices") or [{}])[0]).get("audio_url", ""); f = D + "/media/" + vu.rsplit("/", 1)[-1]
    ok(vu.startswith(B + "/media/v161-") and vu.endswith(".mp3") and os.path.exists(f), f"the clip's sound becomes Ali's voice {i.get('voices')}")
    if os.path.exists(f):
        pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], capture_output=True, text=True).stdout or "{}")
        ok(all(s.get("codec_type") == "audio" for s in pr.get("streams", [])) and float(pr.get("format", {}).get("duration", 99)) <= 20.5, f"sound alone, at most 20 s {pr.get('format', {}).get('duration')}")
    ok("Ali (@image_1)" in i.get("prompt", "") and "@Ali_voice" in i.get("prompt", ""), f"Ali speaks with his own clip {i.get('prompt')!r}")
    # 6. # reference pictures on Kling 4.0
    j, r = engine({"model": "kling40", "prompt": "a girl drinks the cold #can", "inputs": {"vRef1": "/media/can.png"}, "meta": {"refs130": [{"slot": "vRef1", "tag": "can"}]}}); i = r.get("input") or {}; out["refs"] = r; out["refs_j"] = j
    ok(r.get("model") == "kling-4.0/reference-to-video" and i.get("image_urls") == [B + "/media/can.png"] and "@image_1" in i.get("prompt", "") and "#" not in i.get("prompt", ""), f"# pictures → @image_N on Kling 4.0 {r}")
    # 7. another engine never carries the cast
    j, r = engine({"model": "kling30", "prompt": "@Ali waves", "meta": {"cast161": [{"name": "Ali", "faces": ["/media/a.jpg", "/media/b.jpg"]}]}}); i = r.get("input") or {}
    ok(r.get("model") == "kling-3.0/video" and "#cast" not in i.get("prompt", "") and "elements" not in i and not (i.get("kling_elements") or []), f"Kling 3.0: no cast {r}")
    # 8. the agents know the engine and the voices
    n = len(stats()["llm"]); api("/v1/agents/plan", {"prompt": "@Faisal waves and says hello", "task": "video", "dur": 5, "lang": "en", "model": "kling40", "cast": [{"name": "Faisal", "look": "a man"}], "castVoices161": {"Faisal": "George"}})
    t = next((x for x in stats()["llm"][n:] if "planning one" in x), ""); ok("The engine is Kling 4.0" in t and "Faisal: George" in t, "the agents are told the engine and the chosen voice")
    n = len(stats()["llm"]); api("/v1/agents/plan", {"prompt": "a cat", "task": "video", "dur": 5, "lang": "en", "model": "kling30", "castVoices161": {"__proto__": "x"}})
    t = next((x for x in stats()["llm"][n:] if "planning one" in x), ""); ok("Kling 4.0" not in t, "another engine: nothing about Kling 4.0")
    # 9. the price table and the shot lengths the page reads
    c = api("/v1/config"); ok((c.get("prices") or {}).get("video", {}).get("kling40") == 169, f"price table: Kling 4.0 = 169 {(c.get('prices') or {}).get('video', {}).get('kling40')}")
    # 10. the pure steps
    js = subprocess.run(["node", "--input-type=module", "-e", """import { castRoute161, keepRefs161, cast161 } from './lib/kling161.js';
      const a={kind:'video',model:'kling40',prompt:'#cast1 waves',meta:{cast161:[{name:'Ali',faces:['/media/a.jpg']}],voice161:{voice:'JBFqnCBsd6RMkjVDRZzb'}}}; castRoute161(a,'kie@kling-3.0/video');
      const b={kind:'video',model:'kling40',prompt:'@Ali waves',meta:{cast161:[{name:'Ali',faces:['/media/a.jpg']}],partModels:['kling40','seedance20']}}; cast161(b);
      console.log(JSON.stringify({a, b, k1:keepRefs161('kling-4.0/reference-to-video',{meta:{}}), k2:keepRefs161('kling-4.0/reference-to-video',{meta:{voice161:{voice:'x'}}})}))"""], cwd=ROOT, capture_output=True, text=True, timeout=30)
    try: o = json.loads(js.stdout)
    except Exception: o = {}; fails.append("node: " + js.stderr[-300:])
    ok(o.get("a", {}).get("prompt") == "Ali waves" and "cast161" not in o.get("a", {}).get("meta", {}) and "voice161" not in o.get("a", {}).get("meta", {}), f"routed elsewhere → the names come back, no cast {o.get('a')}")
    ok(o.get("b", {}).get("meta", {}).get("partModels") == ["kling40", "kling40"], f"a long video with characters keeps Kling 4.0 in every part {o.get('b')}")
    ok(o.get("k1") is False and o.get("k2") is True, "keyframe model only when there's nothing to keep")

async def page_checks(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    async def E(js, arg=None): return await asyncio.wait_for(pg.evaluate(js, arg), 60)
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg&&API.cfg.prices", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go('home');renderAll()}")
    m = await E("()=>({keys:Object.keys(MODELS).includes('kling40'),name:MODELS.kling40&&MODELS.kling40.name,cr:MODELS.kling40&&MODELS.kling40.cr,alias:'kling40' in M_ALIAS,top:HF_TOP.video.includes('kling40'),max:engMax('kling40'),list:hfModels('video').map(r=>r[0]).includes('kling40')})")
    out["models"] = m; ok(m == {"keys": True, "name": "Kling 4.0", "cr": 169, "alias": False, "top": True, "max": 30, "list": True}, f"Kling 4.0 in the model list at its price, 30 s {m}")
    # a character goes straight to the engine with its face and voice (no first-frame picture)
    n = len(stats()["reqs"])
    r = await E(f"""()=>{{S.chars=(S.chars||[]).filter(c=>c.id!=='c161');S.chars.push(normChar({{id:'c161',name:'Faisal',age:30,gender:'male',face:'/media/faisal.jpg',voice:{{vid:'{GEORGE}',vname:'George'}}}}));
      S.hf.tab='video';S.hf.vModel='kling40';const f0=S.flow87.length,i0=S.jobs.filter(x=>x.kind==='image').length;
      const j=addJob({{kind:'video',model:'kling40',prompt:'@Faisal waves at the camera',cost:169,dur:5,aspect:'16:9',meta:{{}}}});
      return {{flow:S.flow87.length-f0,img:S.jobs.filter(x=>x.kind==='image').length-i0,kind:j&&j.kind,cast:j&&j.meta&&j.meta.cast161}}}}""")
    out["page_cast"] = r
    ok(r.get("flow") == 0 and r.get("img") == 0 and r.get("kind") == "video" and r.get("cast") == [{"name": "Faisal", "faces": ["/media/faisal.jpg"], "voice": GEORGE}], f"Kling 4.0 + a character: no first-frame picture, the face and voice go with the video {r}")
    q = wait(lambda: [x for x in stats()["reqs"][n:] if x["path"].endswith("createTask")] or None, 40) or [{}]; i = (q[-1].get("body") or {}).get("input") or {}
    ok(i.get("image_urls") == [B + "/media/faisal.jpg"] and (i.get("voices") or [{}])[0].get("audio_url") == f"{B}/media/vs-{GEORGE}-en.mp3" and "Faisal (@image_1)" in i.get("prompt", ""), f"… and reach the engine {i}")
    # the voice picked in the box goes with the video (no voice step after it); the sheet says no extra credits
    r = await E(f"""()=>{{S.hf.vc157={{mode:'preset',voice:'{GEORGE}'}};VC157.send={{mode:'preset',voice:'{GEORGE}',say:'good morning',prompt:'A man in a cafe'}};
      const j=addJob({{kind:'video',model:'kling40',prompt:'A man in a cafe',cost:169,dur:5,aspect:'16:9',meta:{{}}}});
      const res={{v:j&&j.meta&&j.meta.voice161,after:!!(j&&j.vc157),send:VC157.send,prompt:j&&j.prompt}};vcSheet157();res.price=($('#vc157price')||{{}}).textContent||'';res.lead=(document.querySelector('#modalRoot .hfsheet p.small.mute')||{{}}).textContent||'';closeSheet();S.hf.vc157=null;return res}}""")
    out["page_voice"] = r
    ok(r.get("v") == {"voice": GEORGE} and not r.get("after") and r.get("send") is None and 'The person says: "good morning"' in (r.get("prompt") or ""), f"the box's voice rides with the video, no step after it {r}")
    ok("no extra credits" in r.get("price", "") and "Kling 4.0 makes it" in r.get("lead", ""), f"the voice sheet says it {r}")
    # 1080p costs 1.5×
    c = await E("()=>{S.hf.tab='video';S.hf.vModel='kling40';S.hf.dur=5;S.hf.res='720P';const a=hfCost();S.hf.res='1080P';const b=hfCost();S.hf.vModel='kling30';const c=hfCost();S.hf.res='720P';const d=hfCost();S.hf.vModel='auto';return [a,b,c===d]}")
    ok(c == [169, 254, True], f"Kling 4.0 1080p 1.5×, other engines unchanged {c}")
    # the agents get the engine and the voice
    n = len(stats()["llm"]); await E("()=>{S.hf.tab='video';S.hf.vModel='kling40';return API.req('/v1/agents/plan',{json:{prompt:'@Faisal waves',task:'video',dur:5,aspect:'16:9',lang:'en'}}).catch(e=>String(e))}")
    t = next((x for x in stats()["llm"][n:] if "planning one" in x), ""); ok("The engine is Kling 4.0" in t and "Faisal: George" in t, "the page tells the agents the engine and the character's voice")
    await E("()=>{S.hf.vModel='auto'}")
    ok(not errs, f"page errors {errs}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); await page_checks(b); await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(B + "/v1/config", timeout=2), 30); wait(lambda: stats(), 10)
    server_checks(); asyncio.run(main())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1, default=str)[:9000])
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
