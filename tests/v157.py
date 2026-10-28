# v157 "add choosing and uploading voices for the characters in the prompt — cloned from the clip, or chosen, or the same clip
# with the character's lips in sync · a cinematic promo from a picture and a word · publishing to Explore with benefits: more
# credits, followers, people working with you and writing to you, people using your prompt". A real nooi server, a stand-in
# engine and text AI, two more customers (API tokens), and the page on a phone:
#  · voices: a price ahead for a video not made yet (your clip: no voice charge, lips charged; a library voice: the voice too;
#    cloning without the voice engine that clones → said); your clip as the voice of a made video — the lips step gets that clip,
#    the film keeps sound; cloning without the speaker's consent and a clip not on the server are refused
#  · the page: the Voice tile and sheet (20 voices, a price, a voice kept on the @character, your clip → lips / clone with consent);
#    a video sent with your clip → when it is made its voice step goes on it by itself, with the clip, and is made
#  · promo: the word found in the words ("كلمة …", "word …", in quotes with a promo); drawn and sent with the video; the engine is
#    told to write nothing (even when the words name a word) and to make an advert; the agents are told the word goes on after;
#    the finished film shows the word over its last seconds and not at the start
#  · the creator program: shared with the program (on by default), others follow, use the prompt (2 credits to the creator once per
#    person), write and ask to work together; the creator's bar and inbox; a voice from the library shared as a sound
# Run: python3 tests/v157.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8473, 8474; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v157-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TK = {n: "nooi_" + c * 32 for n, c in (("fan", "f"), ("pal", "p"))}
tok = lambda n: [{"id": "tk" + n, "name": n, "hash": hashlib.sha256(TK[n].encode()).hexdigest(), "last4": TK[n][-4:], "created": 1, "dailyCap": 1000000}]
now = int(time.time() * 1000)
V1 = {"id": "V1", "owner": "local", "kind": "video", "status": "done", "url": "/media/clip.mp4", "created": now - 60000, "progress": 1, "title": "a man talks", "payload": {"kind": "video", "prompt": "a man talks to the camera", "model": "kling30", "dur": 5, "aspect": "16:9", "meta": {}}}
A1 = {"id": "A1", "owner": "local", "kind": "voice", "status": "done", "url": "/media/v.mp3", "created": now - 60000, "progress": 1, "title": "hello", "payload": {"kind": "voice", "prompt": "Hello there, welcome", "meta": {}}}
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {"V1": V1, "A1": A1}, "profile": {"name": "Sara"}},
  "fan": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": tok("fan"), "profile": {"name": "Omar"}},
  "pal": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": tok("pal"), "profile": {"name": "Lina"}}}}, open(D + "/data/db.json", "w"))
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/clip.mp4")
ff("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")
ff("-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100:duration=3", "-c:a", "libmp3lame", D + "/media/v.mp3")
ff("-f", "lavfi", "-i", "sine=frequency=300:sample_rate=44100:duration=3", "-c:a", "libmp3lame", D + "/voice.mp3")
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": []}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.mp4":
            b = open(DIR + "/res.mp4", "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/res.mp4"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 500})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            st["llm"].append(" ".join(p.get("text", "") for p in parts if p.get("type") == "text")); return self.send({"content": [{"type": "text", "text": "{}"}]})
        st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "data": {"taskId": "t%d" % len(st["reqs"])}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, port=PORT, who=None):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", **({"authorization": "Bearer " + TK[who]} if who else {})})
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
def bright(file, t):   # the brightest grey level in the middle third of a frame
    o = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", file, "-frames:v", "1", "-vf", "crop=iw/3:ih/3:iw/3:ih/3,scale=32:18,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    return max(o) if o else -1
SND = lambda **k: {"scope": "all", "want": {"voice": True, "sfx": False, "amb": False, "music": False}, "who": "characters", "lipsync": True, "keep": True, "lang": "en", **k}

def server_checks():
    q = api("/v1/sound134/quote", SND(dur=8, clip="/media/pending", clipUse="lips"), who="fan"); out["q_lips"] = q   # (a customer: the owner pays nothing)
    ok(q.get("total", 0) > 0 and q["parts"]["voice"] == 0 and q["parts"]["lips"] > 0 and "voice" not in (q.get("missing") or []), f"a price ahead for your clip: lips, no voice charge {q}")
    q2 = api("/v1/sound134/quote", SND(dur=8, voice="JBFqnCBsd6RMkjVDRZzb"), who="fan"); ok(q2.get("parts", {}).get("voice", 0) > 0, f"a library voice is priced with the voice {q2}")
    q3 = api("/v1/sound134/quote", SND(dur=8, clip="/media/pending", clipUse="clone", consent=True)); ok("voice clone" in (q3.get("missing") or []), f"cloning without the engine that clones is said first {q3.get('missing')}")
    ok(api("/v1/sound134/quote", SND()).get("_status") == 400, "no video and no length → asked for a video")
    r = api("/v1/jobs", {"kind": "video", "prompt": "", "model": "kling30", "dur": 5, "aspect": "16:9", "meta": {"sound134": SND(job="V1", clip="/media/v.mp3", clipUse="clone")}})
    ok(r.get("_status") == 400 and "consent" in str(r.get("error")) and "موافقة" in str(r.get("errorAr")), f"cloning without the speaker's consent is refused {r}")
    r = api("/v1/jobs", {"kind": "video", "prompt": "", "model": "kling30", "dur": 5, "aspect": "16:9", "meta": {"sound134": SND(job="V1", clip="/media/nope.mp3", clipUse="lips")}})
    ok(r.get("_status") == 400 and "voice clip" in str(r.get("error")), f"a clip not on the server is refused {r}")
    n0 = len(stats()["reqs"]); r = api("/v1/jobs", {"kind": "video", "prompt": "", "model": "kling30", "dur": 5, "aspect": "16:9", "meta": {"sound134": SND(job="V1", clip=f"{B}/media/v.mp3", clipUse="lips")}})
    j = wait(lambda: (lambda x: x if x.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + str(r.get("id")))), 90) or {}
    out["lips_job"] = {k: j.get(k) for k in ("status", "error", "url")}
    lip = [x for x in stats()["reqs"][n0:] if "lsV" in json.dumps(x) or "audio" in json.dumps(x).lower()]
    ok(j.get("status") == "done" and j.get("url"), f"your clip as the voice of a made video: done {out['lips_job']}")
    ok(lip, f"the lips step was sent to the engine {[x['path'] for x in stats()['reqs'][n0:]][:4]}")
    if j.get("url"):
        f = D + "/media/" + j["url"].split("/media/")[-1]; a = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_name", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip()
        ok(bool(a), f"the film has its sound (the clip mixed in) {a!r}")

def explore_checks(pid, item):
    f = api(f"/v1/creators/{pid}/follow", {}, who="fan"); ok(f.get("following") and f.get("followers") == 1, f"another customer follows the creator {f}")
    db0 = json.load(open(D + "/data/db.json")); c0 = db0["users"]["local"]["credits"]
    u1 = api(f"/v1/explore/{item}/use", {}, who="fan"); u2 = api(f"/v1/explore/{item}/use", {}, who="fan"); u3 = api(f"/v1/explore/{item}/use", {}, who="pal"); u4 = api(f"/v1/explore/{item}/use", {})
    time.sleep(.6); db = json.load(open(D + "/data/db.json")); c1 = db["users"]["local"]["credits"]
    ok(u1.get("earned") == 2 and u2.get("earned") == 0 and u3.get("earned") == 2 and u4.get("earned") == 0 and c1 - c0 == 4 and u3.get("uses") == 2, f"each new person who uses the prompt earns the creator 2 credits (not twice, not the creator) {[u1.get('earned'), u2.get('earned'), u3.get('earned'), u4.get('earned')]} {c1 - c0}")
    m = api(f"/v1/creators/{pid}/message", {"text": "Let's make a film together!", "kind": "collab", "item": item}, who="pal"); ok(m.get("ok"), f"another customer asks to work together {m}")
    bad = api(f"/v1/creators/{pid}/message", {"text": "x"}, who="pal"); ok(bad.get("_status") == 400, "an empty message is refused")
    me = api(f"/v1/creators/{pid}/follow", {}); ok(me.get("_status") == 400, "you can't follow yourself")
    p = api(f"/v1/creators/{pid}", who="fan"); ok(p.get("name") == "Sara" and p.get("followers") == 1 and p.get("following") and len(p.get("items") or []) >= 1, f"the creator's page {p and {k: p.get(k) for k in ('name', 'followers', 'following')}}")
    feed = api("/v1/explore"); x = next((i for i in feed.get("items") or [] if i["id"] == item), {}); ok(x.get("program") and x.get("creator") == pid and "uid" not in x and x.get("uses") == 2, f"the feed shows the creator by a public id only {x}")

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 412, "height": 915}, is_mobile=True, has_touch=True); pg = await ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        async def E(js, arg=None): return await asyncio.wait_for(pg.evaluate(js, arg), 90)
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'Sara',method:'google'};AU.showAuth=false;S.chars=[{id:'c1',name:'Rami',photo:'/media/x.png',voice:{dialect:'msa'}}];S.hf.tab='video';S.hf.vModel='kling30';S.hf.bots=false;S.hf.dur=5;go('home');renderAll()}")
        await pg.wait_for_timeout(500)
        # the Voice tile and sheet
        ok(await E("()=>!!document.querySelector('.hft136 [data-act=\"vc157\"]')"), "the box has a Voice tile")
        await E("()=>{const q=$('#hfq');q.value='@Rami says \"welcome to nooi\" in a cafe';q.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-act=\"vc157\"]').click()}"); await pg.wait_for_timeout(400)
        r = await E("()=>({n:document.querySelectorAll('#modalRoot [data-act=\"vc157-v\"]').length,play:document.querySelectorAll('#modalRoot [data-act=\"vc157-play\"]').length,up:!!document.querySelector('#modalRoot input[data-vc157up]'),who:document.querySelector('#modalRoot').innerText.includes('@Rami')})")
        ok(r["n"] == 20 and r["play"] == 20 and r["up"] and r["who"], f"the sheet: 20 voices to hear and pick, upload a clip, for @Rami {r}")
        await E("()=>document.querySelector('#modalRoot [data-act=\"vc157-v\"][data-id=\"JBFqnCBsd6RMkjVDRZzb\"]').click()"); await pg.wait_for_timeout(900)
        r = await E("()=>({v:S.hf.vc157,ch:S.chars[0].voice.vid,price:($('#vc157price')||{}).textContent||''})"); out["preset"] = r
        ok(r["v"] and r["v"]["mode"] == "preset" and r["ch"] == "JBFqnCBsd6RMkjVDRZzb" and "credits" in r["price"].lower(), f"a voice picked: kept on @Rami, its price shown first {r}")
        await pg.set_input_files("#modalRoot input[data-vc157up]", D + "/voice.mp3"); await pg.wait_for_timeout(700)
        r = await E("()=>({mode:S.hf.vc157.mode,clip:!!(M.vc157&&M.vc157.file),seg:document.querySelectorAll('#modalRoot [data-act=\"vc157-m\"]').length})")
        ok(r["mode"] == "lips" and r["clip"] and r["seg"] == 2, f"a clip: the lips follow it (or clone it) {r}")
        await E("()=>document.querySelector('#modalRoot [data-act=\"vc157-m\"][data-v=\"clone\"]').click()"); await pg.wait_for_timeout(300)
        await E("()=>document.querySelector('#modalRoot [data-act=\"vc157-ok\"]').click()"); await pg.wait_for_timeout(200)
        ok(await E("()=>!!$('#modalRoot').innerHTML.trim()"), "cloning needs the speaker's consent before Done")
        await E("()=>document.querySelector('#modalRoot [data-act=\"vc157-m\"][data-v=\"lips\"]').click()"); await pg.wait_for_timeout(300)
        await E("()=>document.querySelector('#modalRoot [data-act=\"vc157-ok\"]').click()"); await pg.wait_for_timeout(300)
        ok(await E("()=>document.querySelector('.hft136 [data-act=\"vc157\"]').textContent.includes('Your clip')"), "the tile says what is chosen")
        # sent with the clip → when made, its voice step goes on it, with the clip
        n0 = len(stats()["reqs"])
        await E("()=>{const q=$('#hfq');q.value='A man in a cafe talks to the camera';q.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.hfsend').click()}")
        j = None
        for _ in range(240):
            j = await E("()=>{const v=S.jobs.find(x=>x.kind==='video'&&x.meta&&x.meta.sound134&&x.meta.sound134.clipUse==='lips');return v?{status:v.status,clip:v.meta.sound134.clip,job:v.meta.sound134.job,err:v.error}:null}")
            if j and j["status"] in ("complete", "failed"): break
            await asyncio.sleep(.5)
        out["voice_step"] = j
        ok(j and j["status"] == "complete" and "/media/" in str(j["clip"]) and j["job"], f"the made video's voice step went on by itself, with the clip, and was made {j}")
        # promo: the word, found and drawn
        w = await E("""()=>[word157('اعمل مقطع دعائي سينمائي لكلمة "نوي" من الصورة'),word157('a cinematic promo for the word Nooi'),word157('a cat says "hello"'),word157('An advert: «NOOI» rising from the sea')]""")
        ok(w == ["نوي", "Nooi", "", "NOOI"], f"the word is found (كلمة / word / quotes with a promo), not in a plain quote {w}")
        await E("()=>{S.hf.vc157=null;persist()}"); n0 = len(stats()["reqs"]); l0 = len(stats()["llm"])
        await E("()=>{const q=$('#hfq');q.value='A cinematic promo with the word \"NOOI\" over the sea at dawn';q.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.hfsend').click()}")
        pj = None
        for _ in range(240):
            pj = await E("()=>{const v=S.jobs.filter(x=>x.kind==='video'&&x.meta&&x.meta.title157).pop();return v?{status:v.status,title:v.meta.title157,remote:v.remote,url:v.resultUrl}:null}")
            if pj and pj["status"] in ("complete", "failed"): break
            await asyncio.sleep(.5)
        out["promo"] = pj
        ok(pj and pj["status"] == "complete" and pj["title"]["word"] == "NOOI" and "/media/" in pj["title"]["url"], f"the promo video carries its word and is made {pj}")
        sent = next((((x.get("body") or {}).get("input") or {}).get("prompt", "") for x in stats()["reqs"][n0:] if "NOOI" in json.dumps(x)), "")
        out["promo_prompt"] = sent
        ok("No on-screen text" in sent and "cinematic advert" in sent, f"the engine writes nothing and makes an advert {sent[:400]}")
        if pj and pj.get("url"):
            f = D + "/media/" + pj["url"].split("/media/")[-1]; s0, s1 = bright(f, 0.4), bright(f, 4.6); out["promo_bright"] = [s0, s1]
            ok(s1 >= 200 and s0 < 150, f"the word shows over the film's last seconds, not at the start {[s0, s1]}")
        # the agents are told (text AI on)
        await E("()=>{S.hf.bots=true}"); l0 = len(stats()["llm"])
        await E("async()=>{PR157.send={url:'/media/x.png',word:'NOOI'};try{await API.req('/v1/agents/plan',{json:{prompt:'a promo with the word NOOI',task:'video',dur:5,aspect:'16:9',lang:'en'}})}catch(e){}finally{PR157.send=null}}")
        t = next((x for x in stats()["llm"][l0:] if "planning one" in x), "")
        ok('the word "NOOI" is laid over the film' in t and "Never put that word" in t, f"the agents are told the word goes on after {t[-600:]}")
        await E("()=>{S.hf.bots=false}")
        # share with the creator program
        await E("()=>{S.jobs.push({id:'pv1',remote:'V1',kind:'video',status:'complete',progress:1,resultUrl:'/media/clip.mp4',created:Date.now(),title:'a man talks',prompt:'a man talks to the camera',dur:5,aspect:'16:9',art:'scene',meta:{}},{id:'pa1',remote:'A1',kind:'voice',status:'complete',progress:1,resultUrl:'/media/v.mp3',created:Date.now(),title:'hello',prompt:'Hello there, welcome',art:'wave',meta:{}});go('library');renderAll()}")
        await pg.wait_for_timeout(500)
        await E("()=>xpShareSheet(S.jobs.find(x=>x.id==='pv1'))"); await pg.wait_for_timeout(300)
        ok(await E("()=>{const c=document.getElementById('xpprog157');return !!c&&c.checked&&document.querySelector('.xpp157').innerText.includes('2 credits')}"), "the share sheet offers the creator program (on) and says what it gives")
        await E("()=>{document.getElementById('xpagree156').checked=true;document.querySelector('[data-act=\"xps-go\"]').click()}")
        it = wait(lambda: [x for x in api("/v1/explore").get("items") or [] if x.get("url") == "/media/clip.mp4"], 10) or [{}]
        ok(it[0].get("program") and it[0].get("creator"), f"shared with the program {it[0]}")
        sh = await E("()=>!!document.querySelector('[data-open-job=\"pa1\"] .xpshare')"); ok(sh, "a voice in the library can be shared")
        await E("()=>{xpShareSheet(S.jobs.find(x=>x.id==='pa1'))}"); await pg.wait_for_timeout(200)
        await E("()=>{document.getElementById('xpagree156').checked=true;document.querySelector('[data-act=\"xps-go\"]').click()}")
        au = wait(lambda: [x for x in api("/v1/explore").get("items") or [] if x.get("kind") == "audio"], 10) or [{}]
        ok(au[0].get("kind") == "audio" and au[0].get("sub") == "voice", f"…shared as a sound {au[0]}")
        if it[0].get("creator"): explore_checks(it[0]["creator"], it[0]["id"])
        # the creator's bar, the inbox, a post's creator row (not on your own)
        await E("()=>{CR157.at=0;XP.at=0;go('discover');renderAll()}"); await pg.wait_for_timeout(1500)
        bar = await E("()=>(document.querySelector('.xpme157')||{}).innerText||''"); out["bar"] = bar
        ok("1 followers" in bar and "4 credits" in bar and "Messages" in bar, f"the creator's bar: followers, credits earned, messages {bar!r}")
        ok(await E("()=>document.querySelector('.xpme157 .xpbadge157')?.textContent==='1'"), "one new message is counted")
        await E("()=>document.querySelector('[data-act=\"cr157-inbox\"]').click()"); await pg.wait_for_timeout(700)
        t = await E("()=>document.getElementById('modalRoot').innerText"); ok("Lina" in t and "make a film together" in t and "Work together" in t, f"the inbox shows the request {t[:200]!r}")
        await E("()=>closeSheet()"); x = await E("(id)=>xpFind(id)", it[0].get("id"))
        await E("async()=>{CR157.at=0;await crMe157(true)}"); await E("(id)=>xpOpen(xpFind(id))", it[0].get("id")); await pg.wait_for_timeout(300)
        ok(not await E("()=>!!document.querySelector('#modalRoot .xpc157')"), "your own post has no follow / message row")
        ok(await E("()=>[...document.querySelectorAll('.xpgrid .xpcard')].some(c=>c.querySelector('.xpaud157'))"), "a sound shows as a sound card in the feed")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "ELEVEN"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", FREE_PERIOD="false", ENGINE134_POLL_MS="300"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(B + "/v1/config", timeout=2), 30); wait(lambda: stats(), 10)
    server_checks(); print("server ok", flush=True); asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1, default=str)[:7000])
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
