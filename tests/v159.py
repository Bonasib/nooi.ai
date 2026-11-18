# v159 "a problem with the voices · an optional look for a character · photos give the age and the voice by themselves, with
# optional changes below · remove 'make it the main character' (I think it's why picking characters in the prompt gives wrong
# results) · fix what the pictures show". A real nooi server, a stand-in engine (also the voice engine) and a stand-in text AI
# that record everything, and the page on a phone:
#  · voice samples: the engine out of credits → a clear sentence in English and Arabic (no "credits refunded"), any other failure
#    → "try again in a minute"; on the page one sample loads at a time, a slow one stops waiting after the limit and says so
#  · the agents are told who the @characters are (name kept exactly, never re-described); a Home send keeps the agents' words AND
#    the lines that tie each character to its photo, in the first picture and in the video made from it; a character picked in
#    the Video page's own list (and its voice-over) stays out of Home sends
#  · no "Use as main character", no "Story" badge, the old choice cleared
#  · photos → characters (one each): age, gender, build, hair, look and a fitting library voice read from the photo, shown under
#    it with a play button; an optional Look box (your words win); a voice from the photo follows a changed gender until you pick
#    one; a photo added to a character keeps its name; the same in Arabic
# Run: python3 tests/v159.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8480, 8481; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v159-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x3060a0:s=512x512", "-frames:v", "1", D + "/res.png"], check=True)
for i, c in enumerate(["0xc08060", "0x6080c0", "0x60c080"]):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c={c}:s=256x256", "-frames:v", "1", f"{D}/media/f{i}.png"], check=True)
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": [], "tts": "quota"}
PLAN = "Younes talks about trade in a busy market in China, warm evening light, medium shot."
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def file(self, name, ct):
        b = open(DIR + "/" + name, "rb").read(); self.send_response(200); self.send_header("content-type", ct); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.mp4": return self.file("res.mp4", "video/mp4")
        if u.path == "/res.png": return self.file("res.png", "image/png")
        tid = (urllib.parse.parse_qs(u.query).get("taskId") or [""])[0]; kind = next((r["kind"] for r in st["reqs"] if r.get("tid") == tid), "video")
        url = f"http://localhost:{P}/res.png" if kind == "image" else f"http://localhost:{P}/res.mp4"
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [url]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path == "/mode": st.update(j); return self.send(st)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 500})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text"); st["llm"].append(text)
            o = {"brief": {"intent": "show", "subject": "Younes"}, "agents": {}, "request": "Younes talks about trade in China", "prompt": PLAN, "negative": "blurry", "bible": "", "shots": []} if "planning one" in text else {}
            return self.send({"content": [{"type": "text", "text": json.dumps(o)}]})
        model = str(j.get("model") or "").lower(); tts = "eleven" in model or "tts" in model or "speech" in model
        if tts and st["tts"] == "quota": return self.send({"code": 402, "msg": "Credits insufficient"})
        if tts and st["tts"] == "fail": return self.send({"code": 500, "msg": "server error"})
        tid = "t%d" % (len(st["reqs"]) + 1); kind = "image" if any(k in model for k in ("banana", "image", "seedream", "flux", "imagen", "gpt")) else "video"
        st["reqs"].append({"path": u.path, "body": j, "tid": tid, "kind": kind}); return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, port=PORT):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"content-type": "application/json"})
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

def server_checks():
    api("/mode", {"tts": "quota"}, port=KPORT); r = api("/v1/voice/sample", {"id": "EXAVITQu4vr4xnSDxMaL", "lang": "en"}); out["quota"] = r
    ok(r.get("_status") == 503 and r.get("errorType") == "quota" and "isn't taking new work" in r.get("error", "") and r.get("errorAr") and "refund" not in json.dumps(r).lower(),
       f"voice sample, engine out of credits → a clear sentence (en + ar), no 'refunded' {r}")
    api("/mode", {"tts": "fail"}, port=KPORT); r = api("/v1/voice/sample", {"id": "FGY2WhTYpPnrIDTdsKH5", "lang": "ar"}); out["fail"] = r
    ok(r.get("_status") == 502 and r.get("errorType") == "provider" and "Try again in a minute" in r.get("error", "") and "حاول بعد دقيقة" in (r.get("errorAr") or ""), f"voice sample, another failure → try again in a minute {r}")
    # the agents are told who the @characters are
    n = len(stats()["llm"]); api("/v1/agents/plan", {"prompt": "@Younes talks about trade in China", "task": "video", "dur": 5, "aspect": "16:9", "lang": "en", "cast": [{"name": "Younes", "look": "a 34-year-old man, short black hair, beard"}]})
    t = (stats()["llm"][n:] or [""])[-1]; out["cast_line"] = t[t.find("The brief names"):][:420] if "The brief names" in t else ""
    ok('The brief names the client\'s own character: "Younes"' in t and "never translated" in t and "34-year-old man" in t, f"the agents' brief names the character and keeps the name {out['cast_line']!r}")
    n = len(stats()["llm"]); api("/v1/agents/plan", {"prompt": "a cat in a garden", "task": "video", "dur": 5, "aspect": "16:9", "lang": "en"})
    t = (stats()["llm"][n:] or [""])[-1]; ok(t and "The brief names" not in t, "no characters → no cast line")

R_MALE = {"name": "Younes", "gender": "male", "age": 34, "height": 181, "weight": 79, "build": "athletic", "skin": 3, "eyes": "#2b1a10", "hair": "#16110e", "hairStyle": "short", "facial": "beard", "headwear": "none",
          "outfitStyle": "formal", "art": "realistic", "look": "short black hair, trimmed beard, warm brown eyes", "outfit": "navy suit", "persona": "calm and sharp", "voice": "deep"}
R_FEM = {"name": "Huda", "gender": "female", "age": 62, "build": "average", "skin": 2, "hairStyle": "bun", "headwear": "hijab", "outfitStyle": "traditional", "art": "realistic", "look": "kind eyes, soft smile", "voice": "warm"}
STUB = """(rs)=>{window.__rd=rs.slice();window.__rdn=0;API.cfg.providers.llm=true;
  API.req=(o=>function(p,opt){if(String(p)==='/v1/llm/json'&&opt&&opt.json&&opt.json.task==='character from photo'){window.__rdn++;const r=window.__rd.shift()||{};return new Promise(res=>setTimeout(()=>res(r),150))}return o.apply(this,arguments)})(API.req)}"""
CH = "()=>S.chars.map(c=>({id:c.id,name:c.name,age:c.age,gender:c.gender,shape:c.shape,hairStyle:c.hairStyle,facial:c.facial,headwear:c.headwear,look:c.look,read:!!c.read159,v:c.voice&&{vid:c.voice.vid,vname:c.voice.vname,age:c.voice.age,tone:c.voice.tone,gender:c.voice.gender,auto:!!c.voice.auto159}}))"

async def chars_page(b, lang):
    tag = lang; ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    async def E(js, arg=None): return await asyncio.wait_for(pg.evaluate(js, arg), 60)
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;go('chars');renderAll()}", lang); await pg.wait_for_timeout(600)
    h = await E("()=>({main:S.story.charId,btn:!!document.querySelector('#main [data-act=\"char-to-story\"]'),badge:[...document.querySelectorAll('#main .charrow .badge')].map(x=>x.textContent)})")
    ok(h["main"] == "" and not h["btn"] and not h["badge"], f"{tag}: no main character — choice cleared, no button, no Story badge {h}")
    n0 = await E("()=>S.chars.length"); await E(STUB, [R_MALE, R_FEM])
    await pg.set_input_files('#main input[data-chphoto="new"]', [D + "/media/f0.png", D + "/media/f1.png"])
    cs = []
    for _ in range(60):
        cs = await E(CH)
        if len(cs) >= n0 + 2 and all(c["read"] for c in cs[n0:]): break
        await pg.wait_for_timeout(250)
    new = cs[n0:]; out[tag + "_new"] = new
    ok(len(new) == 2, f"{tag}: two photos → two characters {len(new)}")
    if len(new) == 2:
        m, f = new
        ok(m["name"] == "Younes" and m["age"] == 34 and m["gender"] == "male" and m["shape"] == "athletic" and m["facial"] == "beard" and m["look"].startswith("short black hair"), f"{tag}: the photo gives the age, gender, build and look {m}")
        ok(m["v"] and m["v"]["vname"] == "Brian" and m["v"]["age"] == "adult" and m["v"]["tone"] == "deep" and m["v"]["gender"] == "male" and m["v"]["auto"], f"{tag}: and a fitting voice (man, 34, deep → Brian) {m['v']}")
        ok(f["age"] == 62 and f["gender"] == "female" and f["headwear"] == "hijab" and f["v"] and f["v"]["vname"] == "Lily" and f["v"]["age"] == "senior", f"{tag}: woman, 62, warm → Lily, senior voice age {f}")
    # the page: the reading under the photo, the optional Look box, optional details
    await E("()=>{S.charSel=S.chars.findIndex(c=>c.name==='Younes');renderView()}"); await pg.wait_for_timeout(300)
    v = await E("""()=>{const r=document.querySelector('#main .rd159');return {rd:r&&r.textContent.trim(),play:!!(r&&r.querySelector('[data-act="vp91-play"]')),look:!!document.querySelector('#look159[data-bind="char.look"]'),
      lookLbl:document.querySelector('label[for="look159"]')?.textContent,extra:[...document.querySelectorAll('#main .lbl')].some(x=>/Extra appearance details|تفاصيل إضافية للمظهر/.test(x.textContent)),
      opt:document.querySelector('#main .opt159')?.textContent,multi:document.querySelector('#main input[data-chphoto="new"]')?.multiple}}""")
    out[tag + "_page"] = v
    want = ("From the photo", "34 · Male", "Voice: Brian") if lang == "en" else ("من الصورة", "34 · ذكر", "الصوت: Brian")
    ok(v["rd"] and all(w in v["rd"] for w in want) and v["play"], f"{tag}: one line under the photo with the age, gender and voice + play {v['rd']!r}")
    ok(v["look"] and v["lookLbl"] in ("Look (optional)", "الشكل (اختياري)") and not v["extra"] and v["opt"] in ("Change details (optional)", "تعديل التفاصيل (اختياري)") and v["multi"], f"{tag}: optional Look box, optional details, several photos at once {v}")
    await pg.fill("#look159", "tall, white thobe, round glasses"); await pg.wait_for_timeout(200)
    lk = await E("()=>{const c=S.chars[S.charSel];return [c.look,!!c.lookOwn159]}"); ok(lk == ["tall, white thobe, round glasses", True], f"{tag}: the Look box sets the character's look (your words win) {lk}")
    # a voice from the photo follows a changed gender; a picked voice stays
    await E("()=>{const b=document.querySelector('#main [data-set=\"char.gender\"][data-val=\"female\"]');b&&b.click()}"); await pg.wait_for_timeout(300)
    fv = await E("()=>{const c=S.chars[S.charSel];return [c.gender,c.voice.vname,c.voice.gender,!!c.voice.auto159]}"); out[tag + "_follow"] = fv
    ok(fv[0] == "female" and fv[2] == "female" and fv[1] in ("Alice", "Matilda", "Lily", "Aria") and fv[3], f"{tag}: changed to a woman → the photo's voice follows (a woman's voice) {fv}")
    await E("()=>{VP91.all=true;vp91Paint();const b=document.querySelector('#main [data-act=\"vp91-pick\"][data-id=\"onwK4e9ZLuTAKqWW03F9\"]');b&&b.click()}"); await pg.wait_for_timeout(200)
    await E("()=>{const c=S.chars[S.charSel];c.age=70;c.gender='male';persist();renderView()}"); await pg.wait_for_timeout(300)
    pv = await E("()=>{const c=S.chars[S.charSel];return [c.voice.vname,!!c.voice.auto159]}"); ok(pv == ["Daniel", False], f"{tag}: a voice you pick stays yours {pv}")
    # a photo added to this character keeps its name
    await E(STUB, [dict(R_MALE, name="Other")]); await pg.set_input_files('#main input[data-chphoto="cur"]', [D + "/media/f2.png"])
    nm = None
    for _ in range(40):
        nm = await E("()=>{const c=S.chars[S.charSel];return [c.name,!!c.photo,window.__rdn]}")
        if nm[2] >= 1 and not await E("()=>!!S.chars[S.charSel].reading159"): break
        await pg.wait_for_timeout(250)
    ok(nm and nm[0] == "Younes" and nm[1], f"{tag}: a photo added to a character keeps its name {nm}")
    # voice samples on the page
    await E("""()=>{window.__smp=[];API.req=(o=>function(p,opt){if(String(p)==='/v1/voice/sample'){const id=opt.json.id;window.__smp.push(id);
      if(id==='EXAVITQu4vr4xnSDxMaL')return Promise.reject(Object.assign(new Error("Voice samples can't be made right now — the AI engine isn't taking new work. Nothing was charged."),{status:503,errorAr:'لا يمكن صنع عيّنات الأصوات الآن — محرّك الذكاء لا يقبل أعمالاً جديدة. لم يُخصم شيء.'}));
      return new Promise(()=>{})}return o.apply(this,arguments)})(API.req);SMP159.ms=1200}""")
    await E("()=>vp91Play('EXAVITQu4vr4xnSDxMaL',null)"); await pg.wait_for_timeout(300)
    t1 = await E("()=>[$('#toast')?.textContent||'',Object.keys(VP91.busy)]"); out[tag + "_t1"] = t1
    ok(("isn't taking new work" if lang == "en" else "لا يقبل أعمالاً جديدة") in t1[0] and "refund" not in t1[0].lower() and "أُعيد رصيدك" not in t1[0] and not t1[1], f"{tag}: a refused sample says why, in the visitor's language, and stops spinning {t1}")
    await E("()=>{vp91Play('FGY2WhTYpPnrIDTdsKH5',null)}"); await pg.wait_for_timeout(200); await E("()=>{vp91Play('Xb7hH8MSUJpSbSDYk0k2',null)}"); await pg.wait_for_timeout(200)
    bz = await E("()=>Object.keys(VP91.busy)"); ok(bz == ["Xb7hH8MSUJpSbSDYk0k2"], f"{tag}: one sample loads at a time (the newest) {bz}")
    await pg.wait_for_timeout(1500)
    t2 = await E("()=>[$('#toast')?.textContent||'',Object.keys(VP91.busy)]"); out[tag + "_t2"] = t2
    ok(("taking long" if lang == "en" else "تأخذ وقتاً") in t2[0] and not t2[1], f"{tag}: a slow sample stops waiting and says so {t2}")
    ok(not errs, f"{tag}: page errors {errs}")
    await ctx.close()

async def home_send(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    async def E(js, arg=None): return await asyncio.wait_for(pg.evaluate(js, arg), 60)
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg&&API.cfg.llm", timeout=15000)
    await E("""()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
      S.chars.push(normChar({id:'yn',name:'Younes',age:34,gender:'male',look:'short black hair, trimmed beard',outfit:'',persona:'',voice:{dialect:'enUS',gender:'male',age:'adult',tone:'deep'},looks:[1,2,3,4],lookSeed:null,locked:true,face:'/media/f0.png'}));
      S.chars.push(normChar({id:'ot',name:'Other Guy',age:50,gender:'male',look:'grey hair',outfit:'',persona:'',voice:{dialect:'enUS',gender:'male',age:'mid',tone:'warm'},looks:[1,2,3,4],lookSeed:null,locked:true,face:'/media/f1.png'}));
      S.draft.charId='ot';S.draft.vo='an old voice-over from the Video page';S.hf.tab='video';S.hf.bots=true;S.hf.dur=5;go('home');renderAll();
      window.__sub=[];serverSubmit=(o=>function(job,kind,payload){window.__sub.push({kind,prompt:payload&&payload.prompt,meta:payload&&payload.meta||{}});return o.apply(this,arguments)})(serverSubmit)}""")
    await pg.wait_for_timeout(500)
    n = len(stats()["llm"])
    await E("()=>{const q=$('#hfq');q.value='@Younes talks about trade in China';q.dispatchEvent(new Event('input',{bubbles:true}));hfSend()}")
    first = None
    for _ in range(120):
        first = await E("()=>window.__sub.slice()")
        if first: break
        await pg.wait_for_timeout(250)
    t = next((x for x in stats()["llm"][n:] if "planning one" in x), ""); out["home_cast"] = "The brief names" in t
    ok('"Younes"' in t and "The brief names" in t, "Home: the agents are told who @Younes is")
    f0 = (first or [{}])[0]; out["first"] = {"kind": f0.get("kind"), "prompt": (f0.get("prompt") or "")[:400]}
    p = f0.get("prompt") or ""
    ok(f0.get("kind") == "image" and "busy market" in p and "Younes = the person in reference picture 1" in p and "Other Guy" not in p, f"Home: the first picture has the agents' words AND the character's photo line {out['first']}")
    fl = await E("()=>(S.flow87||[]).map(f=>({prompt:f.then&&f.then.prompt,meta:f.then&&f.then.meta}))"); out["flow"] = fl
    fp = (fl[-1]["prompt"] if fl else "") or ""
    ok(fl and "busy market" in fp and "Younes = the person in reference picture 1" in fp and "Other Guy" not in fp and (fl[-1]["meta"] or {}).get("char") in (None, "") and (fl[-1]["meta"] or {}).get("vo") in (None, ""),
       f"Home: the video waiting for that picture has the same words, only @Younes, no Video-page character or voice-over {fl}")
    rs = await E("()=>[S.draft.charId,S.draft.vo]"); ok(rs == ["ot", "an old voice-over from the Video page"], f"the Video page keeps its own choices {rs}")
    # the first picture is made → the video starts from it, with the same words
    vid = None
    for _ in range(240):
        vid = await E("()=>window.__sub.find(s=>s.kind==='video')||null")
        if vid: break
        await pg.wait_for_timeout(250)
    out["video"] = vid and {"prompt": (vid.get("prompt") or "")[:400], "start": vid["meta"].get("start"), "chars87": vid["meta"].get("chars87")}
    vp = (vid or {}).get("prompt") or ""
    ok(vid and "busy market" in vp and "Younes = the person in reference picture 1" in vp and vid["meta"].get("start") and [c.get("name") for c in vid["meta"].get("chars87") or []] == ["Younes"],
       f"Home: the video starts from that picture with the agents' words and only Younes {out['video']}")
    ok(not errs, f"home: page errors {errs}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "ar"): await chars_page(b, lang)
        await home_send(b)
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(B + "/v1/config", timeout=2), 30); wait(lambda: stats(), 10)
    server_checks(); asyncio.run(main())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1, default=str)[:7000])
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
