# v96 with a real nooi server and a stand-in for the engines (it records every request):
#  · every choice reaches the engine: on the Video, Images and Voice pages each option is changed one at a time through the
#    page itself, the create button is pressed, and what the engine receives must change (the only options allowed to leave
#    the request as it is are listed in SAME_OK, each with the reason)
#  · the words: Style, Camera move, Video type, Motion strength, What to avoid and a voice-over line with its voice reach the
#    video engine as plain words (a voice-over also turns the sound on); Images Style reaches the picture engine; jobs that
#    write their own full prompt (sketch) get nothing added
#  · 60 / 120 fps: the video comes at that frame rate (in-between frames made on the server) and the extra is charged; if it
#    can't be made, the video comes as the engine made it and the extra is refunded; the "120 fps" button makes a 120 fps copy
#  · voice: Tone and Speed reach the voice engine; if the engine refuses those settings the same voice is made without them
#  · the page: no Seed box ("What to avoid" only), frame rate Standard · 60 · 120, "nooi Image" no longer listed next to
#    Nano Banana (same engine), the voice speed range is the engine's own (0.7–1.2×)
# Run: python3 tests/v96.py
import asyncio, hashlib, json, os, re, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8241, 8242
D = tempfile.mkdtemp(prefix="nooi-v96-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "w" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x3060a0:s=512x512", "-frames:v", "1", D + "/pic.png")
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-f", "lavfi", "-i", "sine=f=440", "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/vid.mp4")
open(D + "/bad.mp4", "w").write("not a video")
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={reqs:[]};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');s.setHeader('access-control-allow-origin','*');s.setHeader('connection','close');
 const send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(/^\/(pic\.png|vid\.mp4|bad\.mp4)$/.test(u.pathname)){s.setHeader('content-type',u.pathname.endsWith('png')?'image/png':'video/mp4');return s.end(fs.readFileSync(path.join(DIR,u.pathname)))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 const out=f=>'http://localhost:'+P+'/'+f;
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){let j={};try{j=JSON.parse(b||'{}')}catch{}st.reqs.push({path:u.pathname,body:j});
   const inp=j.input||{};if(/elevenlabs\/text-to-speech/.test(j.model||'')&&inp.stability!=null&&/REFUSESET/.test(inp.text||'')){s.setHeader('content-type','application/json');return s.end(JSON.stringify({code:422,msg:'stability is not allowed'}))}
   const id='t'+(++n);T[id]=j;return send({taskId:id})}
 if(/record-?[iI]nfo/.test(u.pathname)){const j=T[u.searchParams.get('taskId')]||{},js=JSON.stringify(j);
   const f=/elevenlabs/.test(j.model||'')?'vid.mp4':/BADVIDEO/.test(js)?'bad.mp4':/video|veo|kling|seedance|wan|hailuo|grok-imagine\/(text|image)-to-video|pixverse|happyhorse/.test(js.slice(0,300))?'vid.mp4':'pic.png';
   const url=out(f);return send({state:'success',successFlag:1,response:{resultUrls:[url]},resultJson:JSON.stringify({resultUrls:[url]})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
def api(p, body=None, method=None, token=TOKEN):
    h = {"content-type": "application/json"}
    if token: h["authorization"] = "Bearer " + token
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
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
def credits(): return (api("/v1/billing") or {}).get("credits")
def job(jid): return api("/v1/jobs/" + jid)
def done(jid, sec=120): return wait(lambda: (lambda j: j if j.get("status") in ("done", "failed") else None)(job(jid)), sec)
def fps_of(url):
    if url.startswith("/"): url = f"http://localhost:{PORT}{url}"
    f = D + "/probe.mp4"; open(f, "wb").write(urllib.request.urlopen(url, timeout=30).read())
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", f], capture_output=True, text=True).stdout)
    v = [s for s in j["streams"] if s["codec_type"] == "video"][0]; a, b = v["avg_frame_rate"].split("/")
    return round(int(a) / int(b)), any(s["codec_type"] == "audio" for s in j["streams"])
def sent_after(n0, pred=lambda r: True): return [r for r in stats()["reqs"][n0:] if pred(r)]
def prompt_of(r): return (r["body"].get("input") or {}).get("prompt") or r["body"].get("prompt") or ""

def server_checks():
    # the words for every choice, and a voice-over turns the sound on
    n0 = len(stats()["reqs"])
    j = api("/v1/jobs", {"kind": "video", "model": "seedance", "dur": 5, "aspect": "16:9", "prompt": "A camel walks across the dunes",
        "meta": {"type": "ad", "style": "anime", "camera": "orbit", "motion": 90, "neg": "blur, text", "vo": "مرحبا بكم في الرياض", "voice": "v1", "audio": False}})
    r = wait(lambda: sent_after(n0), 30) or []; p = prompt_of(r[0]) if r else ""; out["words"] = p
    need = ["A camel walks across the dunes", "Made as a polished commercial.", "Japanese anime style", "The camera orbits 360° around the subject.", "Fast, intense, dynamic motion.", "Avoid: blur, text.",
            'Voice-over, spoken by a deep middle-aged male voice in Saudi Najdi Arabic: "مرحبا بكم في الرياض"']
    ok(j.get("id") and all(w in p for w in need), f"video: every choice reaches the engine as words — missing {[w for w in need if w not in p]} in {p!r}")
    ok(r and (r[0]["body"].get("input") or {}).get("generate_audio") is True, "video: a voice-over line turns the sound on (it was off)")
    # the middle of the motion slider adds nothing; an unknown style adds nothing; a sketch job's own prompt is left alone
    n0 = len(stats()["reqs"])
    api("/v1/jobs", {"kind": "video", "model": "seedance", "dur": 5, "aspect": "16:9", "prompt": "A quiet harbour at dawn", "meta": {"motion": 50, "style": "zzz"}})
    api("/v1/jobs", {"kind": "image", "model": "nano", "aspect": "1:1", "prompt": "Turn this rough sketch into a photo of a cat", "meta": {"sketch": True, "style": "photo"}})
    api("/v1/jobs", {"kind": "image", "model": "nano", "aspect": "1:1", "prompt": "A red apple on a table", "meta": {"style": "productshot", "neg": "shadows"}})
    r = wait(lambda: (lambda x: x if len(x) >= 3 else None)(sent_after(n0)), 30) or []; ps = [prompt_of(x) for x in r]; out["plain"] = ps
    ok(any(x.startswith("A quiet harbour at dawn") and "motion" not in x.lower() and "Style" not in x for x in ps), f"video: the middle of the motion slider and an unknown style add nothing {ps}")
    ok(any(x == "Turn this rough sketch into a photo of a cat" for x in ps), f"a sketch job's own prompt is left as it is {ps}")
    ok(any("A red apple on a table." in x and "Professional product photography" in x and "Avoid: shadows." in x for x in ps), f"image: Style and What to avoid reach the picture engine {ps}")

    # 60 fps: made on the server, the extra charged
    c0 = credits(); base = api("/v1/jobs", {"kind": "video", "model": "seedance", "dur": 5, "aspect": "16:9", "prompt": "A kite over the sea", "meta": {}})
    done(base.get("id", "x"), 60); wait(lambda: credits() < c0, 10); cb = credits(); price = c0 - cb
    j = api("/v1/jobs", {"kind": "video", "model": "seedance", "dur": 5, "aspect": "16:9", "prompt": "A kite over the beach", "meta": {"fps": 60}})
    d = done(j.get("id", "x"), 150)
    fps, aud = fps_of(d["url"]) if d and d.get("url") else (0, False); out["fps60"] = [fps, aud, d and d.get("url"), price]
    ok(price > 0 and d and d.get("status") == "done" and fps == 60 and aud, f"60 fps: the video comes at 60 fps, with its sound {out['fps60']}")
    ok(wait(lambda: credits() == cb - price - 2, 20), f"60 fps: the extra (+2) is charged ({cb} → {credits()}, base {price})")
    # can't be made → the video as the engine made it, the extra back
    c1 = credits(); jb = api("/v1/jobs", {"kind": "video", "model": "seedance", "dur": 5, "aspect": "16:9", "prompt": "BADVIDEO a boat", "meta": {"fps": 120}})
    db = done(jb.get("id", "x"), 120) or {}
    ok(db.get("status") == "done" and "bad.mp4" in str(db.get("url")) and wait(lambda: credits() == c1 - price, 20), f"120 fps that can't be made: the engine's video, the +4 refunded ({c1} → {credits()}, {db.get('status')}, {db.get('url')})")
    # the "120 fps" button under a video
    jf = api("/v1/jobs", {"kind": "finish", "prompt": "120 fps · kite", "aspect": "16:9", "dur": 5, "meta": {"tool": "interp", "fps": 120, "slow": 1, "source": j.get("id"), "sourceUrl": d and d.get("url")}})
    df = done(jf.get("id", "x"), 150) or {}; f2 = fps_of(df["url"])[0] if df.get("url") else 0; out["btn120"] = [jf.get("_status"), jf.get("error"), df.get("status"), f2]
    ok(df.get("status") == "done" and f2 == 120, f"the 120 fps button makes a 120 fps copy (it had no engine before) {out['btn120']}")
    jx = api("/v1/jobs", {"kind": "finish", "prompt": "120 fps", "meta": {"tool": "interp", "fps": 120, "sourceUrl": "http://example.com/x.mp4"}})
    dx = done(jx.get("id", "x"), 30) or jx; out["btnOff"] = [dx.get("status"), dx.get("error"), dx.get("_status")]
    ok((dx.get("status") == "failed" and "isn't on the server" in str(dx.get("error"))) or dx.get("_status") in (400, 422), f"the 120 fps button never fetches a file from elsewhere {out['btnOff']}")

    # voice: Tone and Speed reach the voice; refused settings → the same voice without them
    n0 = len(stats()["reqs"]); jv = api("/v1/jobs", {"kind": "voice", "prompt": "Welcome to nooi", "meta": {"tone": "calm", "rate": 1.1, "gender": "female"}})
    r = wait(lambda: sent_after(n0, lambda x: "elevenlabs" in json.dumps(x["body"])), 30) or []; inp = (r[0]["body"].get("input") if r else {}) or {}; out["voice"] = inp
    ok(inp.get("stability") == .62 and inp.get("style") == .1 and inp.get("speed") == 1.1, f"voice: Tone and Speed reach the voice engine {inp}")
    n0 = len(stats()["reqs"]); jr = api("/v1/jobs", {"kind": "voice", "prompt": "REFUSESET hello", "meta": {"tone": "warm", "rate": 1.2, "gender": "male"}})
    dr = done(jr.get("id", "x"), 60) or {}; r = sent_after(n0, lambda x: "elevenlabs" in json.dumps(x["body"])); out["voiceRetry"] = [dr.get("status"), [x["body"].get("input") for x in r]]
    ok(dr.get("status") == "done" and len(r) >= 2 and "stability" in r[0]["body"]["input"] and "stability" not in r[1]["body"]["input"], f"voice: settings the engine refuses → the same voice without them {out['voiceRetry']}")

# ---- the page: change every option, press create, the engine's request must change
GEN = {"video": "gen-video", "image": "gen-images", "voice": "voice-gen"}
SAME_OK = {
    "draft.fps": "the frames are made after the video is ready (checked above), not by the engine",
    "draft.voice": "the voice of a voice-over line — with no line there is nothing to say (checked above)",
    "tools.voice.dialect": "the accent comes from the words; there is no dialect setting on the voice engine",
    "tools.voice.assign": "Lip-sync's own button", "tools.voice.lipText": "Lip-sync's own button",
}
SAME_OK_PREFIX = ("alab.", "tools.music.")   # Audio Lab and Music: their own buttons on the same page
COLLECT = r"""()=>{const m=document.querySelector('#main');const out={};
  const vis=e=>!e.closest('#side,#bottomnav,.hubtabs,#modalRoot,.mode93');
  m.querySelectorAll('[data-set]').forEach(e=>{if(!vis(e))return;const k=e.dataset.set;(out[k]=out[k]||{kind:'set',vals:new Set(),cur:null});out[k].vals.add(e.dataset.val);if(e.getAttribute('aria-pressed')==='true'||e.getAttribute('aria-checked')==='true')out[k].cur=e.dataset.val});
  m.querySelectorAll('[data-bind]').forEach(e=>{if(!vis(e))return;const k=e.dataset.bind;if(out[k])return;out[k]={kind:e.tagName==='SELECT'?'select':(e.type==='range'||e.type==='number')?'num':e.type==='checkbox'?'check':'text',
    opts:e.tagName==='SELECT'?[...e.options].map(o=>o.value):null,min:e.min,max:e.max,step:e.step,cur:e.type==='checkbox'?e.checked:e.value}});
  m.querySelectorAll('[data-toggle]').forEach(e=>{if(!vis(e))return;const k=e.dataset.toggle;out[k]=out[k]||{kind:'toggle'}});
  for(const k in out)if(out[k].vals)out[k].vals=[...out[k].vals];return out}"""
APPLY = r"""([k,c])=>{const m=document.querySelector('#main');
  if(c.kind==='set'){const alt=c.vals.find(v=>v!==c.cur&&v!==undefined);if(alt==null)return null;const e=[...m.querySelectorAll('[data-set="'+k+'"]')].find(x=>x.dataset.val===alt);e.click();return alt}
  if(c.kind==='toggle'){m.querySelector('[data-toggle="'+k+'"]').click();return 'toggled'}
  const e=m.querySelector('[data-bind="'+k+'"]');if(!e)return null;let v;
  if(c.kind==='select'){v=c.opts.find(o=>o!==c.cur);if(v==null)return null;e.value=v}
  else if(c.kind==='num'){const mn=+(c.min||0),mx=+(c.max||100),cur=+c.cur;v=String(cur===mx?mn:Math.min(mx,cur+Math.max(+(c.step||1),(mx-mn)/4)));
    if(k==='draft.dur')v=String(cur>=10?cur-2:cur+2);   // a length the engine makes in one clip (a longer video is made in parts, the first part looks like the base)
    e.value=v}
  else if(c.kind==='check'){e.checked=!e.checked;v=String(e.checked)}
  else{v=(e.value||'')+' ZETA-WORD';e.value=v}
  e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return v}"""
FILL = "()=>{const t=[...document.querySelectorAll('#main textarea[data-bind],#main input[type=text][data-bind]')].find(x=>/prompt|idea|desc|what|text|script/i.test(x.dataset.bind));if(t&&!t.value.trim()){t.value='A red car drives on a coast road at sunset';t.dispatchEvent(new Event('input',{bubbles:true}))}return !!t}"
SKIP = re.compile(r"^(lang|theme|ui\.|view|tab|hfTab|hf\.tab|.*\.tab$|.*open.*|S\.view)")
def norm(reqs):
    s = json.dumps([r["body"] for r in reqs], sort_keys=True)
    s = re.sub(r'"callBackUrl": "[^"]*"', '"callBackUrl": "-"', s); s = re.sub(r'http://localhost:%d/media/[A-Za-z0-9_.-]+' % PORT, "<file>", s)
    return re.sub(r'"seeds?": \d+', '"seed": 0', s)

async def connected(b):
    for page in GEN:
        pg = await (await b.new_context(viewport={"width": 1280, "height": 900})).new_page(); E = pg.evaluate; errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('en');document.getElementById('modalRoot').innerHTML='';renderAll()}")
        await E("(v)=>{go(v);renderAll()}", page); await pg.wait_for_timeout(300)
        async def press():
            for _ in range(300):   # one job at a time on this plan (a 60 fps job is smoothed on the server first)
                if not await E("()=>S.jobs.some(j=>['queued','rendering','running','waiting'].includes(j.status))"): break
                await pg.wait_for_timeout(300)
            n0 = len(stats()["reqs"]); await E(FILL)
            await E("(a)=>{for(const k in gen82Last)delete gen82Last[k];document.getElementById('modalRoot').innerHTML='';const b=[...document.querySelectorAll('#main [data-act=\"'+a+'\"]')].find(x=>!x.disabled);if(b)b.click()}", GEN[page])
            for _ in range(40):
                await pg.wait_for_timeout(250)
                if stats()["reqs"][n0:]: await pg.wait_for_timeout(600); return stats()["reqs"][n0:]
            return []
        base = await press(); bn = norm(base); ctrls = await E(COLLECT); rows = []
        for k, c in ctrls.items():
            if SKIP.match(k): continue
            old = await E("(k)=>{try{return JSON.stringify(k.split('.').reduce((o,x)=>o==null?o:o[x],S))}catch(e){return null}}", k)
            try: v = await E(APPLY, [k, c])
            except Exception as e: rows.append([k, "error", str(e)[:80]]); continue
            if v is None: continue
            await pg.wait_for_timeout(150); got = await press()
            rows.append([k, "no-request" if not got else ("same" if norm(got) == bn else "changed"), str(v)[:30]])
            await E("([k,o])=>{const ps=k.split('.');let t=S;for(let i=0;i<ps.length-1;i++){if(t[ps[i]]==null)return;t=t[ps[i]]}try{t[ps[ps.length-1]]=o==null?undefined:JSON.parse(o)}catch(e){}renderView()}", [k, old])
            await pg.wait_for_timeout(100)
        out["connected_" + page] = rows
        bad = [r for r in rows if r[1] != "changed" and r[0] not in SAME_OK and not r[0].startswith(SAME_OK_PREFIX)]
        ok(base and len(rows) >= {"video": 15, "image": 5, "voice": 6}[page] and not bad, f"{page}: every option changes what the engine receives — {len(rows)} options, not reaching: {bad}")
        ok(not errs, f"{page}: no page errors {errs}")
        await pg.context.close()

async def page_checks(b):
    for lang, vp in (("en", {"width": 1280, "height": 900}), ("ar", {"width": 390, "height": 844})):
        pg = await (await b.new_context(viewport=vp)).new_page(); E = pg.evaluate; errs = []; tag = lang
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';S.draft.seed='123';S.draft.fps=24;S.img.model='dotimg';renderAll()}", lang)
        await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(300)
        v = await E("""()=>({seed:!!document.querySelector('#main [data-bind="draft.seed"]'),avoid:!!document.querySelector('#main [data-bind="draft.neg"]'),
          fps:[...document.querySelectorAll('#main [data-set="draft.fps"]')].map(e=>[e.dataset.val,e.textContent.trim(),e.getAttribute('aria-pressed')]),
          summ:[...document.querySelectorAll('#main summary')].map(e=>e.textContent.trim()),draftSeed:S.draft.seed})""")
        out["video_" + tag] = v
        ok(not v["seed"] and v["avoid"] and not v["draftSeed"], f"{tag}: no Seed box (no engine takes one), What to avoid stays {v}")
        ok([x[0] for x in v["fps"]] == ["30", "60", "120"] and ("Standard" in v["fps"][0][1] or "عادي" in v["fps"][0][1]) and v["fps"][0][2] == "true", f"{tag}: frame rate is Standard · 60 · 120 (24 is Standard) {v['fps']}")
        await E("()=>{go('image');renderAll()}"); await pg.wait_for_timeout(300)
        im = await E("""()=>({vals:[...document.querySelectorAll('#main [data-set="img.model"]')].map(e=>e.dataset.val),model:S.img.model,text:document.querySelector('#main').innerText.includes('nooi Image')})""")
        out["image_" + tag] = im
        ok(im["vals"] and "dotimg" not in im["vals"] and "nano" in im["vals"] and im["model"] == "nano" and not im["text"], f"{tag}: one name per engine on the Images page (nooi Image = Nano Banana) {im}")
        await E("()=>{go('voice');renderAll()}"); await pg.wait_for_timeout(300)
        r = await E("""()=>{const e=document.querySelector('#main [data-bind="tools.voice.rate"]');return e&&[e.min,e.max]}""")
        ok(r == ["0.7", "1.2"], f"{tag}: the voice speed range is the voice engine's own {r}")
        ok(not errs, f"{tag}: no page errors {errs}")
        await pg.context.close()

async def main():
    mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30)
        server_checks()
        async with async_playwright() as p:
            b = await p.chromium.launch()
            await page_checks(b)
            await connected(b)
            await b.close()
    finally: srv.kill(); mk.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
