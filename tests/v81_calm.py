# v81: calm & clear. The avatar's voice is asked for by voice ID (a bare name made the engine fail with "Internal Error"),
# in a man's or woman's voice that fits the face; the picture-motion line is never spoken as a script; a failed job shows one
# short sentence with "Try again" (the admin's provider detail folded behind "Details"); things being made show a calm
# colour field with the stars instead of a blocky half-made picture, and honest steps; the crew cards keep whole words.
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8101, 8102
D = tempfile.mkdtemp(prefix="nooi-v81-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=320x320", "-frames:v", "1", D + "/media/face.png"], check=True)
# the engine, as it behaves: an ElevenLabs voice by name (not an ID) or a language code on multilingual v2 fails with "Internal Error"
MOCK = r"""
const http=require('http');const P=+process.argv[2];const st={tasks:[]};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');const send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(u.pathname.startsWith('/out.')){s.setHeader('content-type',u.pathname.endsWith('.mp3')?'audio/mpeg':'video/mp4');return s.end(Buffer.alloc(64))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 if(u.pathname==='/api/v1/jobs/createTask'){const j=JSON.parse(b||'{}'),id='t'+(++n);T[id]=j;st.tasks.push(j);return send({taskId:id})}
 if(u.pathname==='/api/v1/jobs/recordInfo'){const j=T[u.searchParams.get('taskId')]||{},i=j.input||{};
  if(/^elevenlabs\/text-to-speech/.test(j.model)){if(!/^[A-Za-z0-9]{18,}$/.test(i.voice||'')||(/multilingual/.test(j.model)&&i.language_code))return send({state:'fail',failMsg:'Internal Error, Please try again later.'});
   if(process.env.TTS_DOWN==='1')return send({state:'fail',failMsg:'Internal Error, Please try again later.'});
   return send({state:'success',resultJson:JSON.stringify({resultUrls:['http://localhost:'+P+'/out.mp3']})})}
  return send({state:'success',resultJson:JSON.stringify({resultUrls:['http://localhost:'+P+'/out.mp4']})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e: return {"_status": e.code, **json.loads(e.read() or b"{}")}
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
def node(js):
    r = subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True, timeout=120, env=dict(os.environ, KIE_API_KEY="k", PUBLIC_BASE_URL="https://x.test"))
    return r.stdout, r.stderr[-600:]
def wait_job(jid, secs=40):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        j = api("/v1/jobs/" + jid)
        if j.get("status") in ("done", "failed"): return j
        time.sleep(.5)
    return j

SARAH, GEORGE, RACHEL, DEF = "EXAVITQu4vr4xnSDxMaL", "JBFqnCBsd6RMkjVDRZzb", "21m00Tcm4TlvDq8ikWAM", "EkK5I93UQWFDigLMpZcX"
def unit_checks():
    o, e = node(f"""import {{ kieInput }} from "{ROOT}/providers/kie.js";
      const v = (m, meta) => kieInput(m, {{ kind: "voice", prompt: "hi", meta }});
      const M2 = "elevenlabs/text-to-speech-multilingual-v2", T25 = "elevenlabs/text-to-speech-turbo-2-5";
      console.log(JSON.stringify({{ fem: v(M2, {{ gender: "female" }}), male: v(M2, {{ gender: "male" }}), none: v(M2, {{}}), named: v(M2, {{ voiceId: "Rachel" }}), id: v(M2, {{ voiceId: "AbCdEfGhIjKlMnOpQrSt" }}),
        unknown: v(M2, {{ voiceId: "Najdi narrator", gender: "male" }}), lang2: v(M2, {{ lang: "ar" }}), turbo: v(T25, {{ lang: "ar-SA" }}), turboBad: v(T25, {{ lang: "Arabic" }}) }}))""")
    try: v = json.loads(o.splitlines()[-1])
    except Exception: v = {}
    ok(v.get("fem", {}).get("voice") == SARAH and v.get("male", {}).get("voice") == GEORGE and v.get("none", {}).get("voice") == SARAH, f"voice: a woman's / man's voice by ID {v} {e}")
    ok(v.get("named", {}).get("voice") == RACHEL and v.get("id", {}).get("voice") == "AbCdEfGhIjKlMnOpQrSt" and v.get("unknown", {}).get("voice") == GEORGE, f"voice: names → IDs, IDs kept, unknown names → the gender's voice {v}")
    ok("language_code" not in v.get("lang2", {}) and v.get("turbo", {}).get("language_code") == "ar" and "language_code" not in v.get("turboBad", {}), f"voice: a two-letter language code on turbo only {v}")
    # the voice tries: the avatar's own voice (v2, then turbo), then the engine's default voice; one friendly sentence when all fail
    o, e = node(f"""import {{ _lipVoice }} from "{ROOT}/providers/kie.js"; let n = 0; const made = [];
      const call = (k) => async (p, opt) => {{ if (p.includes("createTask")) {{ const b = JSON.parse(opt.body); made.push([b.model, b.input.voice]); return {{ taskId: "t" + (++n) }}; }} return k(n); }};
      let err = null; try {{ await _lipVoice({{ prompt: "Hi", meta: {{ gender: "male" }} }}, call(() => ({{ state: "fail", failMsg: "Internal Error" }}))); }} catch (x) {{ err = x; }}
      console.log(JSON.stringify({{ made, user: err && err.userMsg, msg: err && err.message }})); process.exit(0)""")
    try: v = json.loads(o.splitlines()[-1])
    except Exception: v = {}
    ok(v.get("made") == [["elevenlabs/text-to-speech-multilingual-v2", GEORGE], ["elevenlabs/text-to-speech-turbo-2-5", GEORGE], ["elevenlabs/text-to-speech-multilingual-v2", DEF]], f"avatar voice: own voice ×2 models, then the default voice {v} {e}")
    ok(v.get("user") == "The avatar's voice couldn't be made right now — nothing was charged. Try again in a minute, or add a voice file." and "Internal Error" in (v.get("msg") or ""), f"avatar voice: a friendly sentence for people, the detail for the admin {v}")

def stage_checks():
    # the preview copy (deploy/stage.sh) never takes payments, never emails people and never posts to social accounts
    js = f"""import {{ enabledPayments }} from "{ROOT}/lib/billing.js"; import {{ runPost }} from "{ROOT}/lib/scheduler.js"; import {{ sendEmail }} from "{ROOT}/lib/email.js";
      const post = {{ status: "scheduled" }}; await runPost({{ accounts: {{}} }}, post); const m = await sendEmail({{ to: "a@b.c", subject: "s", text: "t" }});
      console.log(JSON.stringify({{ pay: enabledPayments(), post, mail: m }})); process.exit(0)"""
    base = dict(os.environ, PAYMENT_PROVIDER="stripe", STRIPE_SECRET_KEY="sk_test_x", EMAIL_PROVIDER="smtp", SMTP_HOST="127.0.0.1", SMTP_PORT="1", SMTP_USER="u", SMTP_PASS="p", EMAIL_FROM="x@y.z")
    res = {}
    for k, extra in (("stage", {"NOOI_STAGE": "1"}), ("live", {})):
        code = js if k == "stage" else f"""import {{ enabledPayments }} from "{ROOT}/lib/billing.js"; console.log(JSON.stringify({{ pay: enabledPayments() }})); process.exit(0)"""
        r = subprocess.run(["node", "--input-type=module", "-e", code], capture_output=True, text=True, timeout=60, cwd=D, env=dict(base, **extra))
        try: res[k] = json.loads(r.stdout.splitlines()[-1])
        except Exception: res[k] = {"err": r.stderr[-300:]}
    S_, L_ = res["stage"], res["live"]
    ok(S_.get("pay") == [] and L_.get("pay") == ["stripe"], f"preview copy: no payments (the live site keeps them) {res}")
    ok((S_.get("post") or {}).get("status") == "failed" and "Preview copy" in (S_.get("post") or {}).get("error", "") and (S_.get("mail") or {}).get("skipped") is True, f"preview copy: no posts, no emails {res}")

def api_checks():
    # the picture-motion line is not a script
    r = api("/v1/jobs", {"kind": "lipsync", "prompt": "Bring this picture to life: gentle camera move, natural motion", "inputs": {"lsV": "/media/face.png"}})
    ok(r.get("_status") == 400 and "Type what the avatar should say" in (r.get("error") or ""), f"avatar: the motion line is refused as words {r}")
    r = api("/v1/jobs", {"kind": "lipsync", "prompt": "حرّك هذه الصورة: حركة كاميرا هادئة وحركة طبيعية", "inputs": {"lsV": "/media/face.png"}})
    ok(r.get("_status") == 400, f"avatar: the Arabic motion line is refused too {r}")
    # a real avatar through the engine: the voice by ID (a man's voice for a man's face), then the face speaks it
    r = api("/v1/jobs", {"kind": "lipsync", "prompt": "Welcome to our store", "inputs": {"lsV": "/media/face.png"}, "meta": {"gender": "male"}})
    j = wait_job(r.get("id", "x")); tasks = stats()["tasks"]
    tts = [t for t in tasks if t["model"].startswith("elevenlabs/")]; av = [t for t in tasks if t["model"].startswith("kling/ai-avatar")]
    ok(j.get("status") == "done", f"avatar: finished {j} {tasks}")
    ok(tts and tts[0]["input"].get("voice") == GEORGE and tts[0]["input"].get("text") == "Welcome to our store" and "language_code" not in tts[0]["input"], f"avatar: the engine got a voice ID {tts}")
    ok(av and av[-1]["input"].get("audio_url", "").endswith("/out.mp3") and av[-1]["input"].get("image_url") == f"http://localhost:{PORT}/media/face.png", f"avatar: the face speaks the voice {av}")
    out["api"] = {"tasks": [t["model"] for t in tasks]}

SETUP = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}"
P = "Turn this rough hand-drawn sketch into a high-end 3D render of a modern two-storey house with large glass windows, warm interior lights, a wooden deck and a pool"
JOBS = """(P)=>{const now=Date.now();S.jobs=S.jobs.filter(j=>!/^rv/.test(j.id));
  S.jobs.unshift({id:'rv1',kind:'video',status:'rendering',progress:.39,created:now-120e3,title:P,prompt:P,aspect:'16:9',dur:5,seed:41,pal:PALS[1],art:'city',model:'auto'});
  S.lastVideo='rv1';renderAll()}"""
async def ui(p, w, lang):
    tag = f"{w}/{lang}"; r = {}; phone = w < 600; ar = lang == "ar"
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": w, "height": 860}, is_mobile=phone, has_touch=phone, device_scale_factor=2 if phone else 1)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    posted = []
    async def jobs(route):
        if route.request.method != "POST": return await route.continue_()
        posted.append(json.loads(route.request.post_data or "{}")); await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "srv" + str(len(posted)), "status": "queued"}))
    await pg.route("**/v1/jobs", jobs)
    await pg.route("**/v1/avatars", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"items": [{"id": "av-faisal", "name": ["Faisal", "فيصل"], "gender": "male", "url": "/media/face.png", "fresh": True}]})))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    await E(SETUP % lang); await pg.wait_for_timeout(300)
    # ---- a failed job: one short sentence + Try again; the admin detail is folded and opens with "Details"
    await E("""()=>{S.jobs.unshift({id:'rvf',kind:'lipsync',status:'failed',created:Date.now()-5e3,title:'Hello',prompt:'Hello',seed:3,pal:PALS[2],art:'portrait',
      error:"The avatar's voice couldn't be made right now — nothing was charged. Try again in a minute, or add a voice file.",errorType:'provider',detail:'engine@kling/ai-avatar-standard: Error: The voice service is busy (text-to-speech-multilingual-v2: Internal Error, Please try again later. · text-to-speech-turbo-2-5: Internal Error)'});go('home');renderAll()}""")
    await pg.wait_for_timeout(2200)
    r["toast"] = await E("""()=>{const t=document.getElementById('toast'),m=t.querySelector('.tm'),d=t.querySelector('.tdet81'),rc=t.getBoundingClientRect();
      return {show:t.classList.contains('show'),text:m&&m.textContent,lines:m?Math.round(m.getBoundingClientRect().height/parseFloat(getComputedStyle(m).lineHeight)):0,det:!!d,detShown:d?getComputedStyle(d).display!=='none':null,
        act:(t.querySelector('.tact')||{}).textContent,x:!!t.querySelector('.tx81'),h:Math.round(rc.height),w:Math.round(rc.width),vw:innerWidth}}""")
    T = r["toast"]
    ok(T["show"] and T["text"] == ("تعذّر إنشاء صوت الأفاتار الآن — لم يُخصم شيء. حاول بعد دقيقة، أو أضف ملفاً صوتياً." if ar else "The avatar's voice couldn't be made right now — nothing was charged. Try again in a minute, or add a voice file."), f"{tag}: the failure in one sentence, in the page's language {T}")
    ok("Internal Error" not in (T["text"] or "") and T["det"] and T["detShown"] is False and T["x"] and T["act"] in ("Try again", "حاول مجدداً"), f"{tag}: detail folded, close and Try again {T}")
    ok(T["h"] < 130 and T["lines"] <= 3 and T["w"] > min(300, T["vw"] * .6), f"{tag}: a small, wide-enough toast {T}")
    await E("()=>document.querySelector('#toast .tdb81').click()"); await pg.wait_for_timeout(200)
    r["open"] = await E("()=>{const d=document.querySelector('#toast .tdet81');return d&&getComputedStyle(d).display!=='none'&&/Internal Error/.test(d.textContent)}")
    ok(r["open"], f"{tag}: Details shows the provider detail")
    await E("()=>document.querySelector('#toast .tx81').click()"); await pg.wait_for_timeout(200)
    ok(await E("()=>!document.getElementById('toast').classList.contains('show')"), f"{tag}: the toast closes")
    # an old message with the admin detail in the text is folded too
    await E("()=>toast('The AI provider is temporarily unavailable. Your credits were refunded.\\nAdmin detail: engine@x: Error: boom (a · b · c)',{type:'warn'})")
    r["old"] = await E("()=>({t:document.querySelector('#toast .tm').textContent,d:!!document.querySelector('#toast .tdet81')})")
    ok(r["old"]["t"] == "The AI provider is temporarily unavailable. Your credits were refunded." and r["old"]["d"], f"{tag}: inline admin detail folded {r['old']}")
    # ---- Try again on an avatar that was given the motion line: back to the avatar box, asking for the words
    await E("""()=>{S.jobs.unshift({id:'rva',kind:'lipsync',status:'failed',created:Date.now()-4000e3,title:'x',prompt:ANIM79[0],seed:3,pal:PALS[2],art:'portrait',meta:{face:'/media/face.png',faceName:'face.png'}});retry79('rva')}""")
    await pg.wait_for_timeout(300)
    r["retry"] = await E("()=>({gone:!S.jobs.some(j=>j.id==='rva'),view:S.view,tab:S.hf.tab,ref:M.hfRef&&M.hfRef.url,q:($('#hfq')||{}).value,news:S.jobs.filter(j=>j.kind==='lipsync'&&j.status!=='failed'&&!(j.meta&&j.meta.synced)).length})")
    ok(r["retry"] == {"gone": True, "view": "home", "tab": "avatar", "ref": "/media/face.png", "q": "", "news": 0}, f"{tag}: Try again asks for the avatar's words {r['retry']}")
    # ---- an avatar picked from the ready ones gives its voice (man / woman) to the job
    r["gender"] = await E("""async()=>{await avLoad();S.hf.tab='avatar';renderView();await new Promise(r=>setTimeout(r,150));const b=document.querySelector('[data-act="hfav"]');if(!b)return 'no avatars';b.click();
      M.lsV=M.hfRef;addJob({kind:'lipsync',prompt:'Hello',cost:12,secs:10});await new Promise(r=>setTimeout(r,800));return 'sent'}""")
    g = [x for x in posted if x.get("kind") == "lipsync"]
    r["gender"] = (g[-1].get("meta") or {}).get("gender") if g else r["gender"]
    ok(r["gender"] == "male", f"{tag}: a ready avatar's gender goes with the job {r['gender']}")
    # ---- something being made: calm colours + the stars only (v89: no percent, no time), honest steps, no pause button, no long caption
    await E(JOBS, P); await E("()=>{go('video');S.lastVideo='rv1';if(typeof ST98==='function')ST98().lb='video';renderAll()}"); await pg.wait_for_timeout(900)   # (v98: the stage opens over the gallery)
    r["stage"] = await E("""()=>{const s=document.querySelector('.preview-col .stage');const v=s&&s.querySelector('.sveil81'),cap=s&&s.querySelector('.cap');
      const cv=s&&s.querySelector('canvas.frame.live');let blocky=null;if(cv&&cv.width>40){const x=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data,W=cv.width;let jumps=0,n=0;
        for(let y=8;y<cv.height-8;y+=7)for(let i=8;i<W-9;i++){const a=(y*W+i)*4,b=a+4;const d=Math.abs(x[a]-x[b])+Math.abs(x[a+1]-x[b+1])+Math.abs(x[a+2]-x[b+2]);if(d>24)jumps++;n++}blocky=jumps/n}
      return {veil:!!v,star:!!(v&&v.querySelector('.star79')),txt:v&&v.innerText.trim(),ctl:!!s.querySelector('.ctl'),cap:cap?getComputedStyle(cap).display:null,blocky,
        pipe:[...document.querySelectorAll('#pipe>div')].map(d=>d.className+':'+d.textContent)}}""")
    S_ = r["stage"]
    ok(S_["veil"] and S_["star"] and S_["txt"] == "" and not S_["ctl"] and S_["cap"] == "none", f"{tag}: calm stage while making — the stars only {S_}")
    ok(S_["blocky"] is not None and S_["blocky"] < .01, f"{tag}: no blocky half-made picture (sharp jumps {S_['blocky']})")
    ok(len(S_["pipe"]) == 3 and S_["pipe"][0].startswith("done:") and S_["pipe"][1].startswith("now:") and "%" not in S_["pipe"][1] and not any("192" in x or "Denois" in x for x in S_["pipe"]), f"{tag}: honest steps {S_['pipe']}")
    await E("()=>{const j=S.jobs.find(x=>x.id==='rv1');j.status='complete';j.progress=1;j.resultUrl='/media/out.mp4';renderAll()}"); await pg.wait_for_timeout(300)
    r["capDone"] = await E("()=>{const c=document.querySelector('.preview-col .stage .cap');if(!c)return null;const cs=getComputedStyle(c);return {d:cs.display,h:Math.round(c.getBoundingClientRect().height),lh:parseFloat(cs.lineHeight)||20}}")
    C = r["capDone"]
    ok(C and C["d"] != "none" and (not phone or C["h"] <= C["lh"] * 1.2 + 14), f"{tag}: the finished clip's caption is short {C}")
    # ---- the crew: the "New" pill inside its card, whole-word roles, equal cards, the genre tiles have their own icons
    await E("()=>{go('crew');renderAll()}"); await pg.wait_for_timeout(700)
    r["crew"] = await E("""()=>{const cards=[...document.querySelectorAll('.crewline .botcard')],line=document.querySelector('.crewline').getBoundingClientRect();
      const tags=[...document.querySelectorAll('.crewline .newtag81')].map(t=>{const c=t.closest('.botcard').getBoundingClientRect(),r=t.getBoundingClientRect();return r.left>=c.left-1&&r.right<=c.right+1&&r.top>=c.top-1});
      const roles=cards.map(c=>{const s=c.querySelector('.small');return s.scrollWidth<=s.clientWidth+1});
      const rows={};cards.forEach(c=>{const r=c.getBoundingClientRect();(rows[Math.round(r.top/20)]=rows[Math.round(r.top/20)]||[]).push(Math.round(r.height))});
      const out=cards.filter(c=>{const r=c.getBoundingClientRect();return r.right>line.right+2||r.left<line.left-2}).length;
      const genre=[...document.querySelectorAll('[data-set="crew.brief.genre"] svg')].map(s=>/^<circle cx="12" cy="12" r="3"/.test(s.innerHTML.trim()));
      return {old:!!document.querySelector('.newtag'),tags,roles,rows:Object.values(rows).map(a=>Math.max(...a)-Math.min(...a)),out,genre,dashed:cards.some(c=>getComputedStyle(c).borderStyle==='dashed')}}""")
    K = r["crew"]
    ok(not K["old"] and len(K["tags"]) == 3 and all(K["tags"]), f"{tag}: the New pill sits inside its card {K}")
    ok(all(K["roles"]) and all(x <= 2 for x in K["rows"]) and not K["dashed"], f"{tag}: whole-word roles, equal cards in a row {K}")
    ok(K["out"] == 0 or phone, f"{tag}: the whole crew fits in one row on a computer {K}")
    ok(K["genre"] and not any(K["genre"]), f"{tag}: every genre has its own icon {K['genre']}")
    # ---- hub tabs on a phone: one row that scrolls sideways (no second row)
    if phone:
        r["tabs"] = await E("()=>{const h=document.querySelector('.hubtabs');const bs=[...h.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().top));return {rows:new Set(bs).size,scroll:h.scrollWidth>h.clientWidth,page:document.documentElement.scrollWidth<=innerWidth+1}}")
        ok(r["tabs"]["rows"] == 1 and r["tabs"]["page"], f"{tag}: hub tabs in one row {r['tabs']}")
    ok(not errs, f"{tag}: page errors {errs}")
    await b.close(); return r

async def main():
    async with async_playwright() as p:
        for w, lang in ((390, "en"), (390, "ar"), (1280, "en"), (1280, "ar")): out[f"{w}/{lang}"] = await ui(p, w, lang)

if __name__ == "__main__":
    mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "REALTIME_", "DEPTH_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        time.sleep(.4)
        unit_checks(); stage_checks(); api_checks()
        asyncio.run(main())
    except Exception:
        import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
    finally:
        srv.terminate(); mk.terminate()
        try: err = srv.stderr.read().decode()[-1500:]
        except Exception: err = ""
    print(json.dumps({"fails": fails, "out": out, "serverLog": err if fails else ""}, ensure_ascii=False, default=str, indent=1))
    sys.exit(1 if fails else 0)
