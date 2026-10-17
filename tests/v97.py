# v97 with a real nooi server and a stand-in voice engine, in a browser that — like most phones and computers — has no
# built-in voice for the language (headless Chromium has none at all):
#  · the Voice page's example voices ("Hear") play: each is made by the voice engine with its own voice and a line in its
#    dialect, kept on the server (a second listen asks the engine nothing), a second tap stops it; two people asking at once
#    share one making; "Generate" with that example picked uses the same engine voice
#  · a character's "Hear voice" with no voice chosen plays the library voice that suits it; the character voices play too
#  · hearing any example is free (no credits taken, no "1 cr" on the buttons)
#  · the device's own speech ("Preview on device") says when the device has no voice for the language (it stayed silent)
# Run: python3 tests/v97.py
import asyncio, hashlib, json, os, subprocess, tempfile, time, urllib.request, threading
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8251, 8252
D = tempfile.mkdtemp(prefix="nooi-v97-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "x" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=330:d=3", "-c:a", "libmp3lame", D + "/a.mp3"], check=True)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={reqs:[]};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');s.setHeader('connection','close');const send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(u.pathname==='/a.mp3'){s.setHeader('content-type','audio/mpeg');return s.end(fs.readFileSync(path.join(DIR,'a.mp3')))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){let j={};try{j=JSON.parse(b||'{}')}catch{}st.reqs.push({path:u.pathname,body:j});const id='t'+(++n);T[id]={j,t:Date.now()};return send({taskId:id})}
 if(/record-?[iI]nfo/.test(u.pathname)){const t=T[u.searchParams.get('taskId')];if(t&&Date.now()-t.t<1500)return send({state:'generating'});   // a voice takes a moment, like the real engine
   const url='http://localhost:'+P+'/a.mp3';return send({state:'success',successFlag:1,resultJson:JSON.stringify({resultUrls:[url]})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
def tts(n0=0): return [r["body"] for r in stats()["reqs"][n0:] if "text-to-speech" in json.dumps(r["body"])]
def api(p, body=None, token=TOKEN):
    h = {"content-type": "application/json", "authorization": "Bearer " + token}
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def credits(): return (api("/v1/billing") or {}).get("credits")
BRIAN, MATILDA, BILL = "nPczCjzI2devNBz1zQrb", "XrExE9yKIg1WjnnlVkGX", "pqHfZKP75CvOlQylNhV4"
LOG = """window.__log=[];const op=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const s=this.src;const r=op.call(this);if(!/^data:/.test(s)){window.__log.push(['play',s]);if(r&&r.then)r.then(()=>window.__log.push(['played',s]),e=>window.__log.push(['playfail',s,String(e)]))}return r};
  if(window.speechSynthesis){const sp=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=u=>{window.__log.push(['devicespeech',u.text]);return sp(u)}}"""

def server_checks():
    # hearing an example is free for a customer, and two people asking at once share one making
    c0 = credits(); n0 = len(stats()["reqs"]); res = {}
    def ask(k, b): res[k] = api("/v1/voice/sample", b)
    th = [threading.Thread(target=ask, args=(i, {"preset": "v5", "lang": "ar"})) for i in range(2)] + [threading.Thread(target=ask, args=("lib", {"id": "EXAVITQu4vr4xnSDxMaL", "lang": "en"}))]
    [t.start() for t in th]; [t.join() for t in th]
    made = tts(n0); out["shared"] = [res, len(made)]
    ok(res[0].get("url") == res[1].get("url") and "vs-p-v5-gulf" in str(res[0].get("url")) and len([m for m in made if m["input"].get("voice") == BILL]) == 1, f"two people asking for the same example at once share one making {out['shared']}")
    ok(res["lib"].get("url") and res["lib"].get("cost") == 0 and credits() == c0, f"hearing a voice is free ({c0} → {credits()}) {res['lib']}")
    lst = api("/v1/voice/natural?lang=en"); out["list"] = sorted({v["sample"] for v in lst.get("voices", [])})
    ok("paid" not in out["list"], f"no voice is listed as paid {out['list']}")
    ok(api("/v1/voice/sample", {"preset": "v99"}).get("_status") == 404, "an unknown example is refused")

async def page_checks(b):
    pg = await (await b.new_context(viewport={"width": 1280, "height": 900})).new_page(); E = pg.evaluate; errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200])); await pg.add_init_script(LOG)
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('en');document.getElementById('modalRoot').innerHTML='';renderAll()}")
    await E("()=>{go('voice');renderAll()}"); await pg.wait_for_timeout(800)
    await E("()=>{toast=(o=>function(m){(window.__toasts=window.__toasts||[]).push(String(m));return o.apply(this,arguments)})(toast)}")   # every message, not only the last one
    toasts = "()=>window.__toasts||[]"
    async def tap(sel):
        await E("()=>{window.__log=[];window.__toasts=[]}")
        await E("(s)=>{const b=document.querySelector(s);b.scrollIntoView({block:'center'})}", sel); await pg.click(sel, timeout=5000)
    # Abu Fahad (Najdi): the engine's voice and a Najdi line, then it plays
    n0 = len(stats()["reqs"]); await tap('#main [data-act="hear-voice"][data-id="v1"]')
    busy = await E("()=>document.querySelector('#main [data-act=\"hear-voice\"][data-id=\"v1\"]').classList.contains('busy97')")
    for _ in range(40):
        await pg.wait_for_timeout(250)
        if any(x[0] == "played" for x in await E("()=>window.__log")): break
    log = await E("()=>window.__log"); made = tts(n0); out["v1"] = [log, [m["input"] for m in made], busy]
    ok(busy and made and made[0]["input"].get("voice") == BRIAN and "أبو فهد" in made[0]["input"].get("text", "") and "هلا والله" in made[0]["input"].get("text", ""), f"Hear (Abu Fahad): made by the voice engine with his voice and a Najdi line, the button shows it is being made {out['v1']}")
    ok(any(x[0] == "played" and "vs-p-v1-najdi.mp3" in x[1] for x in log) and not any(x[0] == "devicespeech" for x in log), f"Hear (Abu Fahad): the example plays (not the device's speech) {log}")
    pl = await E("()=>document.querySelector('#main [data-act=\"hear-voice\"][data-id=\"v1\"]').classList.contains('playing97')")
    await pg.click('#main [data-act="hear-voice"][data-id="v1"]'); await pg.wait_for_timeout(300)
    ok(pl and await E("()=>H97.a.paused"), f"a second tap stops it (playing mark {pl})")
    n1 = len(stats()["reqs"]); await tap('#main [data-act="hear-voice"][data-id="v1"]'); await pg.wait_for_timeout(1500)
    log = await E("()=>window.__log")
    ok(not tts(n1) and any(x[0] == "played" for x in log), f"the second listen plays the kept example (the engine isn't asked again) {log} {tts(n1)}")
    n2 = len(stats()["reqs"]); await tap('#main [data-act="hear-voice"][data-id="v8"]')
    for _ in range(40):
        await pg.wait_for_timeout(250)
        if any(x[0] == "played" for x in await E("()=>window.__log")): break
    m8 = tts(n2); out["v8"] = [m["input"] for m in m8]
    ok(m8 and m8[0]["input"].get("voice") == MATILDA and "I'm Ava" in m8[0]["input"].get("text", ""), f"Hear (Ava): her own voice and an English line {out['v8']}")
    # Generate with the example picked = the same engine voice
    await E("()=>{const b=document.querySelector('#main [data-act=\"pick-voice\"][data-id=\"v1\"]');b.click()}"); await pg.wait_for_timeout(300)
    n3 = len(stats()["reqs"])
    await E("()=>{S.tools.voice.text='Welcome to the film';for(const k in gen82Last)delete gen82Last[k];renderView();document.querySelector('#main [data-act=\"voice-gen\"]').click()}")
    for _ in range(40):
        await pg.wait_for_timeout(250)
        if tts(n3): break
    g = tts(n3); out["gen"] = [m["input"] for m in g]
    ok(g and g[0]["input"].get("voice") == BRIAN, f"Generate with Abu Fahad picked uses the voice you heard {out['gen']}")
    # the device's own speech: it says when the device has no voice (headless has none)
    await tap('#main [data-act="voice-preview"]'); await pg.wait_for_timeout(2500)
    t = await E(toasts); out["device"] = t
    ok(any("no English voice" in x for x in t), f"Preview on device says the device has no voice (it stayed silent) {t}")
    # a character with no voice chosen
    await E("()=>{go('chars');S.charSel=0;const c=S.chars[0];if(c.voice){c.voice.vid='';c.voice.clone=null}renderAll()}"); await pg.wait_for_timeout(1500)
    n4 = len(stats()["reqs"])
    await E("()=>{window.__log=[];document.querySelectorAll('#main details').forEach(d=>d.open=true);const b=document.querySelector('#main [data-act=\"speak-char\"]');b.scrollIntoView({block:'center'})}")
    await pg.click('#main [data-act="speak-char"]', timeout=5000)
    for _ in range(40):
        await pg.wait_for_timeout(250)
        if any(x[0] == "played" for x in await E("()=>window.__log")): break
    log = await E("()=>window.__log"); c = tts(n4); ch = await E("()=>({age:S.chars[0].age,g:S.chars[0].gender})"); out["char"] = [ch, [m["input"].get("voice") for m in c], log]
    ok(any(x[0] == "played" for x in log) and not any(x[0] == "devicespeech" for x in log) and (not c or c[0]["input"].get("voice") == BILL or ch["age"] < 55), f"Hear voice (no voice chosen): the library voice that suits the character plays {out['char']}")
    prices = await E("()=>[...document.querySelectorAll('#main .vp91play')].filter(b=>/cr/.test(b.innerText)).length")
    ok(prices == 0, f"no price on the character voice buttons ({prices})")
    await E("()=>{window.__log=[]}"); vid = await E("()=>{const b=[...document.querySelectorAll('#main [data-act=\"vp91-play\"]')].find(x=>!x.disabled);b.scrollIntoView({block:'center'});return b.dataset.id}")
    await pg.click(f'#main [data-act="vp91-play"][data-id="{vid}"]', timeout=5000)
    for _ in range(40):
        await pg.wait_for_timeout(250)
        if any(x[0] == "played" for x in await E("()=>window.__log")): break
    log = await E("()=>window.__log")
    ok(any(x[0] == "played" for x in log), f"a character voice plays {vid} {log}")
    ok(not errs, f"no page errors {errs}")
    await pg.context.close()

async def main():
    mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        server_checks()
        async with async_playwright() as p:
            b = await p.chromium.launch(); await page_checks(b); await b.close()
    finally: srv.kill(); mk.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
