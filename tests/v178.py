# v177 + v178 — the engine you pick stays and makes the video itself. A real nooi server with a stand-in AI engine (pictures and
# videos), a stand-in NVIDIA (Cosmos 3 video and its vision model) and a stand-in fal.ai:
#  · Home, a picture added with NVIDIA Cosmos / Kling 3.0 picked → the engine stays (no switch to Seedance), told once how the
#    picture is used; nooi Auto and Seedance stay too
#  · the price on Home's button: nothing extra for an engine that starts from one picture (no picture is made first); the opening
#    frame (a picture) is counted only for @ characters with nooi Auto or an engine that takes pictures
#  · Create with NVIDIA Cosmos, #image1 and @Saba → ONE job, the video, on NVIDIA Cosmos: #image1 is its first frame
#    (image2video), the picture and Saba's face are read by the site's vision AI (NVIDIA's, stand-in) into the words ("What the
#    given pictures show — #image1: … · Saba: …"), the picture itself doesn't go to the engine; no picture made by another engine
#  · no vision AI answering → Saba's saved look goes in the words; the video is still made
#  · from Home the pictures reach an engine that takes them: Seedance gets meta.refs130 with the picture
#  · NVIDIA closed to the key (Admin's check) → NVIDIA Cosmos picked is refused at once: nothing sent, nothing made, nothing paid;
#    a fal.ai key changes nothing (NVIDIA Cosmos has nothing to do with fal.ai) and fal.ai is never asked
#  · Admin's check tries other Cosmos 3 addresses; no fal.ai row
# Run: python3 tests/v178.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8570, 8571; B = f"http://localhost:{PORT}"; M = f"http://localhost:{MP}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v178-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "c" * 32; now = int(time.time() * 1000)
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": now},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "1", "-c:v", "libvpx-vp9", "-b:v", "200k", "-f", "mp4", D + "/vp9.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "1", "-c:v", "libvpx-vp9", "-b:v", "200k", D + "/vid.webm"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=360x640", "-frames:v", "1", D + "/pic.png"], check=True)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={kie:[],nv:[],fal:[],nano:'open'};let n=0;
const VID=fs.readFileSync(path.join(DIR,'vp9.mp4')).toString('base64'),task={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x'),J=(code,d)=>{s.statusCode=code;s.setHeader('content-type','application/json');s.end(JSON.stringify(d))};
 if(u.pathname==='/stats')return J(200,st);
 if(u.pathname==='/nano'){st.nano=u.searchParams.get('to');return J(200,{})}
 if(/\.(png|jpe?g)$/.test(u.pathname)){s.setHeader('content-type','image/png');return s.end(fs.readFileSync(path.join(DIR,'pic.png')))}
 if(u.pathname==='/vid.webm'){s.setHeader('content-type','video/webm');return s.end(fs.readFileSync(path.join(DIR,'vid.webm')))}
 let body={};try{body=JSON.parse(b||'{}')}catch{}const empty=!Object.keys(body).length;
 // the AI engine (Kie-style): pictures and videos
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){const id='t'+(++n);task[id]=body.model;st.kie.push({model:body.model,input:body.input||null});return J(200,{code:200,msg:'success',data:{taskId:id}})}
 if(/record-?[iI]nfo/.test(u.pathname)){const id=u.searchParams.get('taskId'),img=!/video|kling|seedance|wan|veo|hailuo|minimax/i.test(task[id]||''),url='http://localhost:'+P+(img?'/frame.png':'/vid.webm');
   return J(200,{code:200,msg:'success',data:{state:'success',successFlag:1,response:{resultUrls:[url]},resultJson:JSON.stringify({resultUrls:[url]})}})}
 // NVIDIA (Cosmos 3): open / closed / closed only for real requests
 // NVIDIA's vision model: only the reading of pictures answers (text steps fall back)
 if(u.pathname==='/v1/chat/completions'){const imgs=[];for(const m of body.messages||[])for(const c of (Array.isArray(m.content)?m.content:[]))if(c.type==='image_url')imgs.push(1);st.vision=(st.vision||[]).concat([{n:imgs.length,model:body.model}]);
   if(st.visionOff||!imgs.length)return J(500,{detail:'down'});return J(200,{choices:[{message:{content:JSON.stringify({pictures:[{n:1,what:'an old wooden house with a stone tower under a cloudy sky'},{n:2,what:'a woman of about 25 with long dark hair in a white dress'}]})}}]})}
 if(u.pathname==='/vision-off'){st.visionOff=true;return J(200,{})}
 if(/\/cosmos3-/.test(u.pathname)){if(!empty)st.nv.push({p:u.pathname,mode:body.model_mode,ref:String(body.input_reference||'').slice(0,22),res:body.resolution,prompt:String(body.prompt||'')});
   const NF=()=>J(404,{status:404,detail:"Function 'f': Not found for account 'a'"});
   if(!/cosmos3-nano$/.test(u.pathname))return NF();
   if(st.nano==='closed'||(st.nano==='jobs'&&!empty))return NF();if(empty)return J(422,{detail:'model_mode is required'});return J(200,{b64_video:VID})}
 // fal.ai's queue
 if(q.method==='POST'&&/^\/fal\//.test(u.pathname)){const m=u.pathname.slice(5),id='r'+(++n);st.fal.push({model:m,input:body,auth:q.headers.authorization||''});
   return J(200,{request_id:id,status_url:'http://localhost:'+P+'/falq/'+id+'/status',response_url:'http://localhost:'+P+'/falq/'+id})}
 if(/^\/falq\//.test(u.pathname)){if(/status$/.test(u.pathname))return J(200,{status:'COMPLETED'});return J(200,{video:{url:'http://localhost:'+P+'/vid.webm'}})}
 J(404,{})})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
mk = subprocess.Popen(["node", D + "/mock.js", str(MP), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false",
  NVIDIA_API_KEY="test-nv-key", KIE_API_KEY="kk", KIE_BASE_URL=M, KIE_VIDEO_MODEL="kling-3.0/video", FAL_QUEUE_URL=M + "/fal", MIRROR_MEDIA="false", NV_AUTOCHECK="false"),
  stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))

def api(p, body=None, method=None, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=60).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def stats(): return json.loads(urllib.request.urlopen(M + "/stats", timeout=10).read())
def nano(to): urllib.request.urlopen(M + "/nano?to=" + to, timeout=5)
def wait_job(jid, tok=None, secs=60):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        c, j = api("/v1/jobs/" + jid, tok=tok)
        if j.get("status") in ("done", "failed"): return j
        time.sleep(0.5)
    return j

SET = """(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.hf.tab='video';S.hf.bots=false;S.hf.dur=5;S.hf.aspect='16:9';
  S.chars=[{id:'c1',name:'Saba',face:'%s/face.png',facePic:'%s/face.png',look:'a young woman'}];go('home');renderAll();
  window.SENT=[];const o=API.req;API.req=function(p,opt){if(String(p)==='/v1/jobs'&&opt&&opt.json){const j=opt.json;SENT.push({kind:j.kind,model:j.model,prompt:String(j.prompt||''),inputs:Object.keys(j.inputs||{}),meta:j.meta||{}})}return o.apply(this,arguments)};
  window.TOASTS=[];const t=window.toast;window.toast=function(m,o2){TOASTS.push(String(m));return t.apply(this,arguments)}}""" % (M, M)
ADD = """async()=>{document.querySelector('[data-act=pic156]').click();await new Promise(r=>setTimeout(r,300));return !!document.querySelector('#modalRoot input[data-ref130]')}"""

async def add_pic(pg, E):
    ok(await E(ADD), "the Picture sheet opens with its upload")
    inp = await pg.query_selector("#modalRoot input[data-ref130]"); await inp.set_input_files(D + "/pic.png"); await pg.wait_for_timeout(900)

async def run(p, phone, lang, full):
    tag = f"{'phone' if phone else 'desk'} {lang}"; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate; R = {}
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
    await E(SET, lang); await pg.wait_for_timeout(500)
    clear = "()=>{S.draft.refs130=[];REF130.forEach(s=>M[s]=null);M.hfRef=null;TOASTS.length=0;SENT.length=0;const q=document.getElementById('hfq');if(q){q.value='';S.hf.prompt=''}renderAll()}"
    # 1. a picture keeps the engine that was picked
    for m in ("nvcosmos", "kling30", "auto", "seedance25"):
        await E(clear); await E("(m)=>{S.hf.vModel=m;renderAll()}", m); await pg.wait_for_timeout(200); await add_pic(pg, E)
        st = await E("()=>({m:S.hf.vModel,refs:refs130().map(r=>r.tag),toasts:TOASTS.slice()})"); R["keep_" + m] = st
        ok(st["m"] == m and len(st["refs"]) == 1, f"{tag}: a picture keeps {m} as the engine {st}")
        if m in ("nvcosmos", "kling30"):
            want = "يصنع" if ar else "makes the video from your picture"
            ok(sum(1 for t in st["toasts"] if want in t) == 1 and not any("Seedance" in t for t in st["toasts"]), f"{tag}: {m} — told once how the picture is used, no switch {st['toasts']}")
    # 2. the price counts the opening frame when one will be made
    pr = await E("""()=>{const q=document.getElementById('hfq'),set=(m,t)=>{S.hf.vModel=m;q.value=t;S.hf.prompt=t;return hfCost()},fr=(IMG_MODELS[FACE87()]||{cr:4}).cr;
      const r={fr,cosmosPic:set('nvcosmos','a man walks #image1 @Saba'),cosmosBase:vcost('nvcosmos',5),seedPic:set('seedance25','a man walks #image1'),seedBase:vcost('seedance25',5)};
      S.draft.refs130=[];r.charKling=set('kling30','@Saba walks in the rain');r.klingBase=vcost('kling30',5);r.charAuto=set('auto','@Saba walks in the rain');r.autoBase=set('auto','a woman walks in the rain');return r}""")
    R["price"] = pr
    ok(pr["cosmosPic"] == pr["cosmosBase"] and pr["seedPic"] == pr["seedBase"] and pr["charKling"] == pr["klingBase"] and pr["charAuto"] == pr["autoBase"] + pr["fr"],
       f"{tag}: nothing extra for a picked engine that starts from one picture; the opening frame counted for characters with nooi Auto {pr}")
    # 3. the opening frame's card says what it is for
    lab = await E("""()=>{const j={id:'pf177',kind:'image',model:'nanopro',status:'complete',prompt:'x · first frame',meta:{frame87:1,for177:'nvcosmos'},url:'%s/frame.png',seed:1,pal:PALS[0]};
      return (/<small[^>]*>([^<]*)<\\/small>/.exec(hfrCard(j))||[])[1]||''}""" % M)
    R["label"] = lab; ok(("الإطار الأول لـ NVIDIA Cosmos" if ar else "First frame for NVIDIA Cosmos") in lab and "Nano Banana Pro" in lab, f"{tag}: the opening frame's card says it is for NVIDIA Cosmos {lab}")
    if full:
        # 4. Create: NVIDIA Cosmos + #image1 + @Saba → the opening frame from both, then the video on NVIDIA from it
        await E(clear); await E("()=>{S.hf.vModel='nvcosmos';renderAll()}"); await add_pic(pg, E)
        await E("()=>{const q=document.getElementById('hfq');q.value='walking through this field #image1 @Saba';S.hf.prompt=q.value}")
        k0, n0 = len(stats()["kie"]), len(stats()["nv"])
        await E("()=>hfSend()")
        await pg.wait_for_function("SENT.some(x=>x.kind==='video')", timeout=60000); await pg.wait_for_timeout(800)
        sent = await E("()=>SENT.map(x=>({kind:x.kind,model:x.model,inputs:x.inputs,refs:x.meta.refs130||null,read:x.meta.read178||null,chars:(x.meta.chars178||[]).map(c=>[c.name,c.look,!!c.face]),start:x.inputs.includes('startImage')||x.inputs.includes('vStart'),words:x.prompt.slice(0,400)}))")
        R["sent"] = sent; vid = [x for x in sent if x["kind"] == "video"]
        ok(len(sent) == 1 and vid and vid[0]["model"] == "nvcosmos" and vid[0]["start"] and "vRef1" in vid[0]["inputs"] and vid[0]["read"] == [{"slot": "vRef1", "tag": "image1"}] and not vid[0]["refs"]
           and vid[0]["chars"] == [["Saba", "a young woman", True]] and "@Saba" not in vid[0]["words"],
           f"{tag}: ONE job — the video on NVIDIA Cosmos: #image1 its first frame, the picture and Saba sent to be read, no picture made first {sent}")
        await pg.wait_for_function("(()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return j&&['complete','failed'].includes(j.status)})()", timeout=90000)
        fin = await E("()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return{status:j.status,model:j.model}}"); R["final"] = fin
        nv = stats()["nv"][n0:]; R["nv"] = nv; kie = [x["model"] for x in stats()["kie"][k0:]]; R["kie"] = kie
        vis = stats().get("vision") or []; R["vision"] = vis[-1:]
        ok(fin["status"] == "complete" and fin["model"] == "nvcosmos" and nv and nv[-1]["mode"] == "image2video" and nv[-1]["ref"].startswith("data:image/") and not any("nano-banana" in k for k in kie),
           f"{tag}: made directly on NVIDIA Cosmos from the first frame, nothing made on another engine {fin} {[{k: v for k, v in x.items() if k != 'prompt'} for x in nv]} {kie}")
        words = nv[-1]["prompt"] if nv else ""
        ok(vis and vis[-1]["n"] == 2 and "What the given pictures show" in words and "#image1: an old wooden house with a stone tower" in words and "Saba: a woman of about 25 with long dark hair" in words,
           f"{tag}: NVIDIA's vision model read the picture and Saba's face into the words {vis[-1:]} {words[-400:]}")
        # no vision AI answering → Saba's saved look in the words, the video still made
        urllib.request.urlopen(M + "/vision-off", timeout=5); n1 = len(stats()["nv"])
        await E(clear); await E("()=>{S.hf.vModel='nvcosmos';const q=document.getElementById('hfq');q.value='@Saba waves at the camera';S.hf.prompt=q.value;hfSend()}")
        await pg.wait_for_function("(()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return j&&j.prompt&&j.prompt.includes('waves')&&['complete','failed'].includes(j.status)})()", timeout=60000)
        nv2 = stats()["nv"][n1:]; w2 = nv2[-1]["prompt"] if nv2 else ""; R["looks"] = w2[-200:]
        ok(nv2 and nv2[-1]["mode"] == "text2video" and "Saba: a young woman" in w2, f"{tag}: no vision AI → the saved look goes in the words, the video is made {w2[-200:]}")
        # 5. from Home the pictures reach an engine that takes them
        await E(clear); await E("()=>{S.hf.vModel='seedance25';renderAll()}"); await add_pic(pg, E)
        await E("()=>{const q=document.getElementById('hfq');q.value='a man walks into #image1';S.hf.prompt=q.value;hfSend()}")
        await pg.wait_for_function("SENT.some(x=>x.kind==='video')", timeout=30000)
        sv = await E("()=>SENT.filter(x=>x.kind==='video').map(x=>({model:x.model,refs:x.meta.refs130||null,inputs:x.inputs}))"); R["seed"] = sv
        ok(sv and sv[0]["refs"] and sv[0]["refs"][0]["tag"] == "image1" and "vRef1" in sv[0]["inputs"], f"{tag}: Home's picture reaches Seedance {sv}")
        # 6. NVIDIA closed to the key → refused at once, nothing sent
        nano("closed"); api("/v1/admin/nvidia/check", {}); await E("async()=>{API.cfg=await API.req('/v1/config')}")
        await E(clear); await E("()=>{S.hf.vModel='nvcosmos';renderAll()}"); await add_pic(pg, E)
        await E("()=>{const q=document.getElementById('hfq');q.value='walking through this field #image1 @Saba';S.hf.prompt=q.value;TOASTS.length=0;SENT.length=0;hfSend()}"); await pg.wait_for_timeout(1500)
        cl = await E("()=>({sent:SENT.length,toasts:TOASTS.slice()})"); R["closed"] = cl
        ok(cl["sent"] == 0 and any("NVIDIA Cosmos isn't open" in t for t in cl["toasts"]), f"{tag}: NVIDIA closed → refused at once, nothing made or paid {cl}")
        # 7. a fal.ai key changes nothing: NVIDIA Cosmos is NVIDIA's only, still refused while closed, fal.ai never asked
        api("/v1/admin/providers/fal", {"apiKey": "fal-test-key"}, "PUT"); await E("async()=>{API.cfg=await API.req('/v1/config')}")
        f0 = len(stats()["fal"])
        await E(clear); await E("()=>{S.hf.vModel='nvcosmos';const q=document.getElementById('hfq');q.value='a red car on a coast road at sunset';S.hf.prompt=q.value;TOASTS.length=0;SENT.length=0;hfSend()}"); await pg.wait_for_timeout(1500)
        fz = await E("()=>({sent:SENT.length,toasts:TOASTS.slice()})"); R["fal"] = fz
        ok(fz["sent"] == 0 and any("NVIDIA Cosmos isn't open" in t for t in fz["toasts"]) and len(stats()["fal"]) == f0, f"{tag}: a fal.ai key changes nothing — NVIDIA Cosmos still refused while NVIDIA is closed {fz}")
    w = await E("()=>document.documentElement.scrollWidth<=innerWidth+1"); ok(w, f"{tag}: nothing wider than the screen")
    out[tag] = R; ok(not errs, f"{tag}: page errors {errs}"); await br.close()

def server_part():
    # NVIDIA refuses a hand-picked Cosmos job mid-way (closed for real requests only) → it fails with NVIDIA's reason, nothing
    # charged, never sent anywhere else (fal.ai has a key here and is never asked)
    nano("jobs"); c, r = api("/v1/admin/nvidia/check", {}); st = {e["task"]: e["state"] for e in r.get("engines", [])}; out["check"] = st
    ok(st.get("video") == "open" and st.get("video-super") == "closed" and st.get("video-edge") == "closed" and st.get("video-genai") == "open" and "video-fal" not in st, f"the check: other Cosmos 3 addresses, no fal.ai {st}")
    f0, n0, cr0 = len(stats()["fal"]), len(stats()["nv"]), api("/v1/billing", tok=TOKEN)[1].get("credits")
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a robot arm stacks blocks", "dur": 5, "aspect": "16:9", "inputs": {"startImage": M + "/start.png"}}, tok=TOKEN)
    j = wait_job(j.get("id", "x"), TOKEN); time.sleep(0.5); out["refused"] = {"status": j.get("status"), "error": j.get("error"), "fal": len(stats()["fal"]) - f0, "nv": len(stats()["nv"]) - n0}
    ok(j.get("status") == "failed" and "NVIDIA Cosmos isn't open" in (j.get("error") or "") and len(stats()["fal"]) == f0 and api("/v1/billing", tok=TOKEN)[1].get("credits") == cr0,
       f"Cosmos refused by NVIDIA mid-way → fails with NVIDIA's reason, nothing charged, fal.ai never asked {out['refused']}")

async def main():
    async with async_playwright() as p:
        for phone, lang, full in ((True, "en", True), (False, "ar", False)):
            try: await run(p, phone, lang, full)
            except Exception as e: fails.append(f"{'phone' if phone else 'desk'} {lang} crashed: {e!r}"[:400])
try:
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: time.sleep(0.25)
    c, _ = api("/v1/admin/providers/nvidia", {"videoUrl": M + "/v1/cosmos/nvidia/cosmos3-nano", "baseUrl": M + "/v1", "use": "video:on image:off edit:off 3d:off text:on vision:on"}, "PUT"); ok(c == 200, f"NVIDIA set up {c}")
    asyncio.run(main())
    server_part()
except Exception as e: fails.append(f"crashed: {e!r}"[:400])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1)[:9000])
if fails: print(open(D + "/server.log").read()[-2000:])
shutil.rmtree(D, ignore_errors=True)
print("v178 ok" if not fails else f"FAILED {len(fails)}"); sys.exit(1 if fails else 0)
