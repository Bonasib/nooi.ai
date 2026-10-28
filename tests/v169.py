# v169 — the editor: captions that are the words said, at the moment they are said; a playhead that always moves; the editor
# opening as it should (not on the captions panel left open last time); the Home agents in one row.
# A real nooi server (its own ffmpeg) with a stand-in speech-to-text engine (ElevenLabs Scribe words, OpenAI Whisper words) and
# the page in Playwright (phone with touch, and desktop):
#  · server: exact captions are priced per minute before anything is sent (GET), held then charged when the words come back,
#    released when the engine fails or nothing is said; Whisper is asked for word times; someone else's file is refused; the
#    sound file is deleted after; not enough credits → 402
#  · page, on this device: the speech model's mistakes are put right — words invented over silence, subtitle-credit lines,
#    [music] tags and loops go; each word sits on the voice; the language heard first is kept for the next parts
#  · page, exact: the button shows the price first, the words come back with their times, the credits go down by that price
#  · typed words are laid on the voice, not spread over silence
#  · the playhead: a finger (or the mouse) on its line moves it even over a clip — no clip picked, no long-press menu, no page
#    scroll; a picked clip's edge under it still trims with the mouse
#  · the editor opens on Media with nothing picked (no sheet over the timeline on a phone), also after a reload; a way in that
#    asks for a panel keeps it; inside the editor the captions panel stays when chosen
#  · Home → Agents: all 9 agents in one row (sliding sideways on a phone), the plan as a row of all 9 cards in the same order
#  · the editor's Export button is an icon only on a phone
# Run: python3 tests/v169.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, uuid
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8495; MPORT = 8496; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v169-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "c" * 32; POOR = "nooi_" + "p" * 32
tok = lambda t, i: [{"id": i, "name": "t", "hash": hashlib.sha256(t.encode()).hexdigest(), "last4": t[-4:], "created": 1, "dailyCap": 10000000}]
json.dump({"users": {
  "local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {"j1": {"id": "j1", "kind": "video", "status": "done", "progress": 1, "url": "/media/clip.webm", "title": "Clip", "created": 1, "payload": {"prompt": "x"}}}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 1000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "uploads": [], "tokens": tok(TOKEN, "tk")},
  "poor": {"plan": "studio", "planUntil": 4102444800000, "credits": 0, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "uploads": [], "tokens": tok(POOR, "tp")},
  "other": {"plan": "studio", "credits": 100, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "uploads": ["theirs.wav"]}}}, open(D + "/data/db.json", "w"))
ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120)
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=3", "-c:v", "libvpx-vp9", "-b:v", "1M", "-deadline", "realtime", "-cpu-used", "8", D + "/media/clip.webm")
# 75 s of sound: a tone that comes and goes (2 minutes at the per-minute price)
ff("-f", "lavfi", "-i", "aevalsrc='0.3*sin(2*PI*220*t)*gt(sin(2*PI*0.3*t),0)':s=16000:d=75", "-ac", "1", D + "/talk.wav")
shutil.copy(D + "/talk.wav", D + "/media/theirs.wav")
MOCK = r"""
const http=require('http');const st={el:[],oa:[],mode:'ok'};
const body=q=>new Promise(r=>{const c=[];q.on('data',x=>c.push(x));q.on('end',()=>r(Buffer.concat(c)))});
const field=(b,n)=>{const m=new RegExp('name="'+n.replace(/[\[\]]/g,'\\$&')+'"\r\n\r\n([^\r]*)','g');const o=[];let x;const s=b.toString('latin1');while((x=m.exec(s)))o.push(x[1]);return o};
const W=(t,s,e)=>({text:t,start:s,end:e,type:'word',speaker_id:'speaker_0'});
http.createServer(async(q,s)=>{const b=await body(q),u=q.url.split('?')[0],J=(o,c)=>{s.statusCode=c||200;s.setHeader('content-type','application/json');s.end(JSON.stringify(o))};
 if(u==='/stats')return J(st);if(u==='/mode'){st.mode=q.url.split('=')[1];return J({ok:1})}
 if(u==='/el/v1/speech-to-text'){st.el.push({model:field(b,'model_id')[0],gran:field(b,'timestamps_granularity')[0],lang:field(b,'language_code')[0]||null,key:q.headers['xi-api-key'],bytes:b.length});
  if(st.mode==='fail'||st.mode==='elfail')return J({detail:{message:'busy'}},500);
  if(st.mode==='none')return J({language_code:'eng',text:'',words:[]});
  return J({language_code:'eng',text:'Hello and welcome to the show',words:[W('Hello',1.0,1.4),{text:' ',start:0,end:0,type:'spacing'},W('and',1.45,1.6),W('welcome',1.65,2.2),W('to',3.0,3.15),W('the',3.2,3.35),W('show.',3.4,3.9)]})}
 if(u==='/oa/audio/transcriptions'){st.oa.push({model:field(b,'model')[0],gran:field(b,'timestamp_granularities[]'),key:q.headers['authorization']});
  if(st.mode==='fail')return J({error:{message:'down'}},500);
  return J({language:'english',text:'Good morning everyone',segments:[{start:1,end:2.4,text:'Good morning everyone'}],words:[{word:'Good',start:1.0,end:1.3},{word:'morning',start:1.3,end:1.9},{word:'everyone',start:1.9,end:2.4}]})}
 J({error:'not found '+u},404)}).listen(+process.argv[2]);
"""
open(D + "/mock.js", "w").write(MOCK)
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, tk=None, method=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(B + p, data=data, method=method or ("POST" if data is not None else "GET"), headers={"content-type": ctype, **({"authorization": "Bearer " + tk} if tk else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def upload(f, tk):
    bd = uuid.uuid4().hex; data = (f"--{bd}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"captions.wav\"\r\nContent-Type: audio/wav\r\n\r\n").encode() + open(f, "rb").read() + f"\r\n--{bd}--\r\n".encode()
    return api("/v1/uploads", raw=data, tk=tk, ctype="multipart/form-data; boundary=" + bd)
mock = lambda p: json.loads(urllib.request.urlopen(f"http://localhost:{MPORT}{p}", timeout=10).read())
credits = lambda tk: (api("/v1/billing", tk=tk) or {}).get("credits")
def wait(fn, sec=40):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None

def server_checks():
    q = api("/v1/captions169?dur=75", tk=TOKEN); out["quote"] = q; per = q.get("perMin") or 0
    ok(q.get("ready") is True and per >= 1 and q.get("cost") == per * 2, f"priced first: 75 s = 2 minutes × the per-minute price {q}")
    ok(api("/v1/captions169?dur=75").get("cost") == 0, "the owner pays nothing")
    # 1. exact captions: Scribe words, charged once they come back, the sound file deleted
    c0 = credits(TOKEN); up = upload(D + "/talk.wav", TOKEN); name = str(up.get("url", "")).split("/")[-1]
    r = api("/v1/captions169", {"url": up.get("url"), "lang": "en"}, tk=TOKEN); c1 = credits(TOKEN); out["exact"] = {k: r.get(k) for k in ("words", "cost", "lang")}
    ok([w["w"] for w in r.get("words", [])] == ["Hello", "and", "welcome", "to", "the", "show."] and r["words"][0] == {"s": 1.0, "e": 1.4, "w": "Hello"}, f"every word with its own time {r}")
    ok(r.get("cost") == per * 2 and c0 - c1 == per * 2, f"charged the price shown ({c0}→{c1}) {r.get('cost')}")
    el = mock("/stats")["el"]; ok(el and el[-1]["model"] == "scribe_v2" and el[-1]["gran"] == "word" and el[-1]["lang"] == "en" and el[-1]["key"] == "el-test", f"Scribe asked for word times in the spoken language {el[-1:]}")
    time.sleep(.5); ok(not os.path.exists(D + "/media/" + name), "the sound file is deleted after it is heard")
    ok(api("/v1/captions169", {"url": up.get("url")}, tk=TOKEN).get("_status") == 404, "a deleted / unknown file is refused")
    # 2. someone else's file: refused, nothing charged
    r = api("/v1/captions169", {"url": "/media/theirs.wav"}, tk=TOKEN); ok(r.get("_status") == 404 and credits(TOKEN) == c1 and os.path.exists(D + "/media/theirs.wav"), f"someone else's sound refused {r}")
    # 3. Scribe down → Whisper with word times
    mock("/mode?m=elfail"); up = upload(D + "/talk.wav", TOKEN); r = api("/v1/captions169", {"url": up.get("url")}, tk=TOKEN); c2 = credits(TOKEN)
    oa = mock("/stats")["oa"]; out["whisper"] = {"words": r.get("words"), "asked": oa[-1:]}
    ok([w["w"] for w in r.get("words", [])] == ["Good", "morning", "everyone"] and r["words"][1]["s"] == 1.3, f"Whisper's own word times {r}")
    ok(oa and "word" in oa[-1]["gran"] and "segment" in oa[-1]["gran"] and oa[-1]["key"] == "Bearer oa-test", f"Whisper asked for word times {oa[-1:]}")
    ok(c1 - c2 == per * 2, f"charged once ({c1}→{c2})")
    # 4. every engine fails → nothing charged, the file still deleted
    mock("/mode?m=fail"); up = upload(D + "/talk.wav", TOKEN); name = str(up.get("url", "")).split("/")[-1]; r = api("/v1/captions169", {"url": up.get("url")}, tk=TOKEN); c3 = credits(TOKEN)
    ok(r.get("_status") == 502 and "nothing was charged" in r.get("error", "") and r.get("errorAr") and c3 == c2, f"engine down: 502, nothing charged {r} {c2}→{c3}")
    time.sleep(.5); ok(not os.path.exists(D + "/media/" + name), "the sound file is deleted after a failure too")
    led = api("/v1/billing", tk=TOKEN).get("ledger", []); ok(any(x.get("hold") == "released" for x in led), "the hold shows as released in the ledger")
    # 5. nothing said → nothing charged
    mock("/mode?m=none"); up = upload(D + "/talk.wav", TOKEN); r = api("/v1/captions169", {"url": up.get("url")}, tk=TOKEN)
    ok(r.get("words") == [] and r.get("cost") == 0 and credits(TOKEN) == c3, f"nothing said: nothing charged {r}")
    # 6. not enough credits → 402
    mock("/mode?m=ok"); up = upload(D + "/talk.wav", POOR); r = api("/v1/captions169", {"url": up.get("url")}, tk=POOR); ok(r.get("_status") == 402, f"not enough credits → 402 {r}")

# the edit's sound for the page (16 kHz): voice at these moments, silence between
VOICE = [[1, 2.4], [3, 4], [7.2, 8], [9, 10.5], [30, 31.5], [33, 34]]
AUD = "()=>{const sr=16000,a=new Float32Array(sr*40);for(const[s,e] of %s)for(let i=Math.floor(s*sr);i<e*sr;i++)a[i]=.3*Math.sin(i*.05);return a}" % json.dumps(VOICE)
SETUP = """async(phone)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
  S.jobs.push({id:'lj1',remote:'j1',kind:'video',status:'complete',progress:1,resultUrl:'/media/clip.webm',title:'Clip',prompt:'x',created:Date.now(),dur:3,aspect:'16:9',art:'scene',seed:1,pal:PALS[0]});
  S.ed.clips=['c1','c2','c3'].map(id=>({id,src:{k:'job',job:'lj1'},in:0,out:3,speed:1}));S.ed.sel=null;ED.t=0;S.view='edit';renderView();await new Promise(r=>setTimeout(r,1500))}"""
async def editor(p, phone):
    ctx = await p.chromium.launch(); c = await ctx.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000); await pg.evaluate(SETUP, phone)
    return ctx, c, pg, errs
inv = lambda W: all(any(w["s"] >= s - .07 and w["e"] <= e + .07 for s, e in VOICE) for w in W)

async def captions_checks(p):
    ctx, c, pg, errs = await editor(p, False)
    # 1. on this device: a stand-in speech model with the usual mistakes, three parts
    r = await pg.evaluate("""async(aud)=>{window.__aud=eval(aud);edxTimelineAudio=async()=>window.__aud();S.localAI=true;window.__calls=[];
      const P=[[[1.3,1.7,' مرحبا'],[1.7,2.9,' بكم'],[3.3,3.7,' في'],[3.7,4.4,' البرنامج.'],[5.2,5.9,' اشتركوا'],[5.9,6.2,' في'],[6.2,6.6,' القناة'],[6.7,6.9,' [موسيقى]'],[7.3,7.9,' اليوم']],
        [[1.1,1.3,' نعم'],[1.3,1.5,' نعم'],[1.5,1.7,' نعم'],[1.7,1.9,' نعم'],[1.9,2.1,' نعم'],[4,5,' شكرا']],
        [[3,5,' Thank'],[5,7,' you.'],[14.2,14.8,' إلى'],[14.8,15.4,' اللقاء'],[17,17.3,' ترجمة'],[17.3,17.6,' نانسي'],[17.6,18,' قنقر']]];
      laiCall=async(m)=>{const n=window.__calls.length;window.__calls.push({lang:m.input.language||null,len:+(m.input.audio.length/16000).toFixed(2),words:!!m.input.words});return {text:'',chunks:(P[n]||[]).map(x=>({start:x[0],end:x[1],text:x[2]}))}};
      S.ed.tab='words';S.ed.lt143=home143('words');renderView();await new Promise(r=>setTimeout(r,300));const b=document.querySelector('[data-act="edx-cap-auto"]');if(!b)return {err:'no button'};b.click();
      for(let i=0;i<60&&(EDX.busy||!S.ed.caps.words.length);i++)await new Promise(r=>setTimeout(r,100));
      const parts=win149(window.__aud(),16000).map(x=>[x[0]/16000,x[1]/16000]);return {calls:window.__calls,words:S.ed.caps.words,by:S.ed.caps.by169,parts}}""", AUD)
    out["device"] = {"text": " ".join(w["w"] for w in r.get("words", [])), "calls": r.get("calls"), "parts": r.get("parts")}
    W = r.get("words", []); txt = " ".join(w["w"] for w in W)
    ok(txt == "مرحبا بكم في البرنامج. اليوم نعم إلى اللقاء", f"the words said and only them (no invented words, credit lines, tags or loops): {txt!r}")
    ok(W and inv(W), f"every word sits on the voice {W}")
    ok(abs(W[0]["s"] - 1) < .06 and abs([w for w in W if w["w"] == "بكم"][0]["e"] - 2.4) < .06 if W else False, f"the first word starts with the voice; a word stretched into the pause ends with the voice {W[:3]}")
    ok(all(W[i]["e"] <= W[i + 1]["s"] + 1e-6 for i in range(len(W) - 1)), "no two words at once")
    cl = r.get("calls") or []; ok(len(cl) == 3 and cl[0]["lang"] is None and cl[1]["lang"] == "ar" and cl[2]["lang"] == "ar" and all(x["words"] for x in cl), f"the language heard first is kept for the next parts {cl}")
    ok(r.get("by") == "device", "made on the device")
    # 2. the panel offers exact captions with the price first (as a customer), and they come back with their own times
    await pg.evaluate("t=>{API.token=async()=>t;CAP169.dur=-1;renderView()}", TOKEN)
    await pg.wait_for_function("!!document.querySelector('[data-act=\"cap169\"]')", timeout=10000)
    q = api("/v1/captions169?dur=40", tk=TOKEN); c0 = credits(TOKEN)
    r = await pg.evaluate("""()=>{const b=document.querySelector('[data-act="cap169"]'),d=document.querySelector('[data-act="edx-cap-auto"]');return {exact:b.textContent,device:d&&d.textContent,primary:b.classList.contains('primary'),note:(document.querySelector('.e-body p.small.dim')||{}).textContent||''}}""")
    out["panel"] = r
    ok(r["exact"].endswith(f"· {q.get('cost')} credits") and r["primary"] and "On this device · free" in (r["device"] or ""), f"the exact button shows its price; the free way stays {r} {q}")
    await pg.evaluate("()=>document.querySelector('[data-act=\"cap169\"]').click()")
    await pg.wait_for_function("S.ed.caps.by169==='exact'&&!EDX.busy", timeout=30000)
    r = await pg.evaluate("()=>({words:S.ed.caps.words,on:S.ed.caps.on})"); c1 = credits(TOKEN)
    out["page_exact"] = r
    ok([w["w"] for w in r["words"]] == ["Hello", "and", "welcome", "to", "the", "show."] and r["words"][2] == {"s": 1.65, "e": 2.2, "w": "welcome"} and r["on"], f"exact captions with the engine's own times {r}")
    ok(c0 - c1 == q.get("cost"), f"charged exactly the price on the button ({c0}→{c1}, {q.get('cost')})")
    # 3. typed words: laid on the voice
    r = await pg.evaluate("""async()=>{S.ed.caps.words=[];renderView();const t=document.querySelector('#edxscript');t.value='one two three four five six seven eight';document.querySelector('[data-act="edx-cap-text"]').click();
      for(let i=0;i<40&&S.ed.caps.words.length!==8;i++)await new Promise(r=>setTimeout(r,100));return S.ed.caps.words}""")
    out["typed"] = r; ok(len(r) == 8 and inv(r), f"typed words laid on the voice only {r}")
    ok(not errs, f"page errors {errs}"); await ctx.close()

async def playhead_checks(p, phone):
    ctx, c, pg, errs = await editor(p, phone); R = {}
    async def geo(t):
        await pg.evaluate("t=>{ED.t=t;S.ed.sel=null;edSetPick(null);renderView();const w=document.querySelector('.tlwrap');if(w)w.scrollTop=0}", t); await pg.wait_for_timeout(250)
        return await pg.evaluate("""()=>{const tl=document.querySelector('#tlin').getBoundingClientRect(),b=document.querySelector('#tlin .blk[data-clip="c1"]').getBoundingClientRect(),m=document.querySelector('#main');
          return {x:tl.left+40+ED.t*S.ed.zoom,y:b.top+b.height/2,bx:[b.left,b.right],z:S.ed.zoom,scroll:m?m.scrollTop:0,wrap:document.querySelector('.tlwrap').scrollLeft}}""")
    async def drag(x0, y0, dx, steps=10, hold=0):
        if phone:
            cdp = await c.new_cdp_session(pg); await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y0}]})
            if hold: await pg.wait_for_timeout(hold)
            for k in range(1, steps + 1): await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x0 + dx * k / steps, "y": y0}]}); await pg.wait_for_timeout(16)
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        else:
            await pg.mouse.move(x0, y0); await pg.mouse.down()
            if hold: await pg.wait_for_timeout(hold)
            for k in range(1, steps + 1): await pg.mouse.move(x0 + dx * k / steps, y0); await pg.wait_for_timeout(16)
            await pg.mouse.up()
        await pg.wait_for_timeout(300)
        return await pg.evaluate("()=>({t:+ED.t.toFixed(3),sel:S.ed.sel,pick:S.ed.pick&&S.ed.pick.k||null,menu:!!(typeof CM131!=='undefined'&&CM131.el),c1:[S.ed.clips[0].in,S.ed.clips[0].out]})")
    # 1. on the line over a clip: the playhead moves, the clip isn't picked or dragged
    g = await geo(1.0); at = await pg.evaluate("([x,y])=>{const e=document.elementFromPoint(x,y);return e&&e.closest('.blk')?e.closest('.blk').dataset.clip:null}", [g["x"], g["y"]])
    r = await drag(g["x"] + (3 if phone else 1), g["y"], 100); R["over_clip"] = {**r, "under": at, "z": g["z"]}
    ok(at == "c1" and abs(r["t"] - (1.0 + 100 / g["z"])) < .25 and not r["sel"] and not r["pick"] and r["c1"] == [0, 3], f"{'finger' if phone else 'mouse'} on the playhead over a clip moves it {R['over_clip']}")
    # 2. held a moment first (shorter than a long press), then moved: still the playhead, no menu, the page doesn't scroll
    g = await geo(1.0); r = await drag(g["x"], g["y"], 80, hold=300); g2 = await pg.evaluate("()=>({scroll:(document.querySelector('#main')||{}).scrollTop||0})"); R["held"] = r
    ok(abs(r["t"] - (1.0 + 80 / g["z"])) < .25 and not r["menu"] and not r["sel"] and g2["scroll"] == g["scroll"], f"held then moved: the playhead, no menu, no scroll {r} {g['scroll']}→{g2['scroll']}")
    if phone:
        # a finger held still on the line is a long press on the clip (its menu), a tap picks the clip, up or down doesn't scrub
        cdp = await c.new_cdp_session(pg)
        async def press(x, y, ms):
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]}); await pg.wait_for_timeout(ms)
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(350)
            return await pg.evaluate("()=>({t:+ED.t.toFixed(3),sel:S.ed.sel,pick:S.ed.pick&&S.ed.pick.k||null,menu:!!CM131.el,items:CM131.el?[...CM131.el.querySelectorAll('.cm131i')].length:0})")
        g = await geo(1.0); r = await press(g["x"], g["y"], 800); R["long"] = r
        ok(r["menu"] and r["items"] > 2 and abs(r["t"] - 1.0) < .02, f"held still on the line over a clip: the clip's menu, the playhead stays {r}")
        await pg.evaluate("()=>cmClose131()"); await pg.wait_for_timeout(700); g = await geo(1.0); r = await press(g["x"], g["y"], 60); R["tap"] = r
        ok(r["sel"] == "c1" and not r["menu"], f"a tap on the line over a clip picks the clip (as a tap on a clip always does) {r}")
        g = await geo(1.0); await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": g["x"], "y": g["y"]}]})
        for k in range(1, 9): await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": g["x"] + k, "y": g["y"] - 8 * k}]}); await pg.wait_for_timeout(16)
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(300)
        r = await pg.evaluate("()=>({t:+ED.t.toFixed(3),menu:!!CM131.el,lanes:document.querySelector('.tlwrap').scrollTop})"); R["vertical"] = r
        ok(abs(r["t"] - 1.0) < .02 and not r["menu"], f"up or down from the line doesn't move the playhead {r}")
    # 3. away from the playhead a clip is still a clip (the playhead doesn't jump there)
    g = await geo(1.0); r = await drag(g["bx"][0] + (g["bx"][1] - g["bx"][0]) * .8, g["y"], 30); R["away"] = r
    ok(abs(r["t"] - 1.0) < .02, f"away from the playhead the timeline isn't scrubbed {r}")
    if not phone:
        # 4. a clip's edge under the playhead still trims with the mouse
        g = await geo(2.999); r = await drag(g["bx"][1] - 4, g["y"], -40); R["trim"] = r
        ok(r["c1"][1] < 2.8 and abs(r["t"] - 2.999) < .02, f"the edge under the playhead trims {r}")
    out["playhead_" + ("phone" if phone else "desk")] = R
    ok(not errs, f"page errors {errs}"); await ctx.close()

async def open_checks(p, phone):
    ctx, c, pg, errs = await editor(p, phone); R = {}
    st = "()=>({tab:S.ed.tab,lt:S.ed.lt143,sel:S.ed.sel,pick:S.ed.pick,sheet:!!document.querySelector('.ed143 .e-sheet'),caps:!!document.querySelector('[data-act=\"edx-cap-auto\"]'),left:(document.querySelector('.e-assets .e-pt')||{}).textContent||null})"
    # 1. left on the captions panel with a clip picked → back later: Media, nothing picked
    await pg.evaluate("()=>{S.ed.tab='words';S.ed.lt143=home143('words');edSetPick('clip','c2');S.ed.sel='c2';renderView()}")
    R["inside"] = await pg.evaluate(st); ok(R["inside"]["tab"] == "words" and R["inside"]["caps"], f"inside the editor the captions panel stays when chosen {R['inside']}")
    await pg.evaluate("()=>go('home')"); await pg.wait_for_timeout(200); await pg.evaluate("()=>go('edit')"); await pg.wait_for_timeout(400)
    R["back"] = r = await pg.evaluate(st)
    ok(r["tab"] == "media" and r["lt"] == "media" and not r["sel"] and not r["pick"] and not r["caps"] and (not r["sheet"] if phone else r["left"] in ("Media", "الوسائط")), f"opens on Media, nothing picked, no captions panel {r}")
    # 2. a way in that asks for a panel keeps it (a result sent to the editor picks its clip)
    await pg.evaluate("()=>go('home')"); await pg.evaluate("()=>{S.ed.sel='c3';S.ed.tab='clip';go('edit')}"); await pg.wait_for_timeout(300)
    R["asked"] = r = await pg.evaluate(st); ok(r["tab"] == "clip" and r["sel"] == "c3", f"a way in that asks for a panel keeps it {r}")
    # 3. reloaded while on the captions panel → opens on Media
    await pg.evaluate("()=>{S.ed.tab='words';S.ed.lt143=home143('words');persist()}"); await pg.wait_for_timeout(1200); await pg.reload()   # (the page saves 0.7 s after the last change)
    await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&S.view==='edit'", timeout=20000); await pg.wait_for_timeout(800)
    R["reload"] = r = await pg.evaluate(st); ok(r["tab"] == "media" and not r["caps"], f"after a reload: Media {r}")
    # 4. the Export button: an icon only on a phone (its name read out), the words on a computer
    R["export"] = r = await pg.evaluate("()=>{const b=document.querySelector('.ed143 .e-act>.edout'),r=b.getBoundingClientRect();return {w:Math.round(r.width),text:b.innerText.trim(),label:b.getAttribute('aria-label'),icon:!!b.querySelector('svg')}}")
    ok((r["w"] <= 44 and r["text"] == "" and r["icon"] if phone else r["text"].startswith("Export")) and r["label"] == "Export video", f"Export: {'an icon only' if phone else 'with its words'} {r}")
    out["open_" + ("phone" if phone else "desk")] = R
    ok(not errs, f"page errors {errs}"); await ctx.close()

async def agents_checks(p, phone):
    b = await p.chromium.launch(); c = await b.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone); pg = await c.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    r = await pg.evaluate("""async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';AU.showAuth=false;S.view='home';S.hf.tab='video';S.hf.bots=false;renderView();await new Promise(r=>setTimeout(r,300));
      document.querySelector('[data-act="hfx-bots"]').click();await new Promise(r=>setTimeout(r,600));const s=document.querySelector('.hfbots .botstrip'),bs=[...s.querySelectorAll('.sbot')],l=document.querySelector('.hfstplan.bots .hbls'),ls=l?[...l.querySelectorAll('.hbl')]:[];
      const top=a=>new Set(a.map(x=>Math.round(x.getBoundingClientRect().top))).size;s.scrollIntoView({block:'center'});
      return {on:hfBotsOn(),n:bs.length,ids:bs.map(x=>x.dataset.bot),planIds:ls.map(x=>x.dataset.bot),rows:top(bs),h:Math.round(s.getBoundingClientRect().height),sw:s.scrollWidth,cw:s.clientWidth,plan:ls.length,planRows:top(ls),pw:l?l.scrollWidth:0,pcw:l?l.clientWidth:0,ov:getComputedStyle(s).overflowX}}""")
    out["agents_" + ("phone" if phone else "desk")] = r
    ok(r["on"] and r["n"] == 9 and r["rows"] == 1 and r["h"] < 130, f"the agents in one row {r}")
    ok(r["plan"] == 9 and r["planRows"] == 1 and r["planIds"] == r["ids"], f"the plan: all 9 agents, in the same order, as a row of cards {r}")
    if phone: ok(r["sw"] > r["cw"] and r["ov"] == "auto" and r["pw"] > r["pcw"], f"on a phone the row slides sideways {r}")
    await pg.screenshot(path=D + f"/agents_{'phone' if phone else 'desk'}.png")
    ok(not errs, f"page errors {errs}"); await b.close()

async def page_checks():
    async with async_playwright() as p:
        await captions_checks(p)
        for ph in (True, False): await playhead_checks(p, ph)
        for ph in (True, False): await open_checks(p, ph)
        for ph in (True, False): await agents_checks(p, ph)

mk = subprocess.Popen(["node", D + "/mock.js", str(MPORT)], cwd=D, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "CAMB_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false", AI_LABEL="false",
  ELEVENLABS_API_KEY="el-test", ELEVENLABS_BASE_URL=f"http://localhost:{MPORT}/el", OPENAI_API_KEY="oa-test", OPENAI_BASE_URL=f"http://localhost:{MPORT}/oa"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    ok(wait(lambda: api("/v1/config"), 40), "server up")
    server_checks(); mock("/mode?m=ok"); asyncio.run(page_checks())
    shots = os.environ.get("V169_SHOTS")
    if shots:
        for f in os.listdir(D):
            if f.startswith("agents_"): shutil.copy(D + "/" + f, shots)
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-1500:])
finally:
    srv.kill(); mk.kill(); log = open(D + "/server.log").read()[-1500:]; shutil.rmtree(D, ignore_errors=True)
print(json.dumps(out, ensure_ascii=False, indent=1)[:6000])
if fails:
    print("server log:", log); print("FAILED:"); [print(" ✗", f) for f in fails]; sys.exit(1)
print("v169 ok")
