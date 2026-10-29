# v177 — the engine you pick stays; pictures go through a first frame; NVIDIA Cosmos on the second provider. A real nooi server
# with a stand-in AI engine (pictures and videos), a stand-in NVIDIA (Cosmos 3) and a stand-in fal.ai (Cosmos Predict 2.5):
#  · Home, a picture added with NVIDIA Cosmos / Kling 3.0 picked → the engine stays (no switch to Seedance), told once how the
#    picture is used; nooi Auto and Seedance stay too
#  · the price on Home's button counts the opening frame (a picture) when one will be made — # pictures with an engine that starts
#    from one picture, or @ characters; not with Seedance + pictures
#  · Create with NVIDIA Cosmos, #image1 and @Saba → the opening frame is made from the face AND the picture (two references, the
#    words name #image1), its card says "First frame for NVIDIA Cosmos"; then NVIDIA Cosmos makes the video from that frame
#    (image2video) — the whole chain finishes
#  · from Home the pictures now reach an engine that takes them: Seedance gets meta.refs130 with the picture
#  · NVIDIA closed to the key (Admin's check) → NVIDIA Cosmos picked is refused at once: nothing sent, nothing made, nothing paid
#  · a fal.ai key saved → NVIDIA Cosmos is made on fal.ai's NVIDIA Cosmos (Predict 2.5) while NVIDIA is closed: text-to-video
#    { prompt }, the card still says NVIDIA Cosmos; and a Cosmos job NVIDIA refuses mid-way moves to it (once)
#  · Admin's check also tries other Cosmos 3 addresses and shows fal.ai's Cosmos as ready
# Run: python3 tests/v177.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8570, 8571; B = f"http://localhost:{PORT}"; M = f"http://localhost:{MP}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v177-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
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
 if(/\/cosmos3-/.test(u.pathname)){if(!empty)st.nv.push({p:u.pathname,mode:body.model_mode,ref:String(body.input_reference||'').slice(0,22),res:body.resolution});
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
            want = "يبدأ" if ar else "starts from one picture"
            ok(sum(1 for t in st["toasts"] if want in t) == 1 and not any("Seedance" in t for t in st["toasts"]), f"{tag}: {m} — told once how the picture is used, no switch {st['toasts']}")
    # 2. the price counts the opening frame when one will be made
    pr = await E("""()=>{const q=document.getElementById('hfq'),set=(m,t)=>{S.hf.vModel=m;q.value=t;S.hf.prompt=t;return hfCost()},fr=(IMG_MODELS[FACE87()]||{cr:4}).cr;
      const r={fr,cosmosPic:set('nvcosmos','a man walks #image1'),cosmosBase:vcost('nvcosmos',5),seedPic:set('seedance25','a man walks #image1'),seedBase:vcost('seedance25',5)};
      S.draft.refs130=[];r.charKling=set('kling30','@Saba walks in the rain');r.klingBase=vcost('kling30',5);r.plain=set('kling30','a man walks in the rain');return r}""")
    R["price"] = pr
    ok(pr["cosmosPic"] == pr["cosmosBase"] + pr["fr"] and pr["seedPic"] == pr["seedBase"] and pr["charKling"] == pr["klingBase"] + pr["fr"] and pr["plain"] == pr["klingBase"], f"{tag}: the price counts the opening frame when one is made {pr}")
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
        await pg.wait_for_function("SENT.some(x=>x.kind==='video')", timeout=60000)
        sent = await E("()=>SENT.map(x=>({kind:x.kind,model:x.model,inputs:x.inputs,for177:x.meta.for177||null,refs:x.meta.refs130||null,start:x.inputs.includes('startImage')||x.inputs.includes('vStart'),words:x.prompt.slice(0,400)}))")
        R["sent"] = sent; img = [x for x in sent if x["kind"] == "image"]; vid = [x for x in sent if x["kind"] == "video"]
        ok(len(img) == 1 and img[0]["model"] == "nanopro" and set(img[0]["inputs"]) >= {"iRef", "iRef2"} and img[0]["for177"] == "nvcosmos" and "#image1 is reference picture 2" in img[0]["words"] and not img[0]["refs"],
           f"{tag}: the opening frame is made from the face and the picture {img}")
        ok(len(vid) == 1 and vid[0]["model"] == "nvcosmos" and vid[0]["start"] and not vid[0]["refs"], f"{tag}: then NVIDIA Cosmos makes the video from that frame (no pictures it can't take) {vid}")
        await pg.wait_for_function("(()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return j&&['complete','failed'].includes(j.status)})()", timeout=90000)
        fin = await E("()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return{status:j.status,model:j.model}}"); R["final"] = fin
        nv = stats()["nv"][n0:]; R["nv"] = nv; kie = [x["model"] for x in stats()["kie"][k0:]]; R["kie"] = kie
        ok(fin["status"] == "complete" and fin["model"] == "nvcosmos" and nv and nv[-1]["mode"] == "image2video" and "nano-banana-pro" in kie, f"{tag}: the whole chain finishes on NVIDIA Cosmos {fin} {nv} {kie}")
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
        # 7. a fal.ai key → NVIDIA Cosmos on fal.ai while NVIDIA is closed
        api("/v1/admin/providers/fal", {"apiKey": "fal-test-key"}, "PUT"); await E("async()=>{API.cfg=await API.req('/v1/config')}")
        f0 = len(stats()["fal"])
        await E(clear); await E("()=>{S.hf.vModel='nvcosmos';const q=document.getElementById('hfq');q.value='a red car on a coast road at sunset';S.hf.prompt=q.value;TOASTS.length=0;SENT.length=0;hfSend()}")
        await pg.wait_for_function("(()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return j&&j.prompt&&j.prompt.includes('red car')&&['complete','failed'].includes(j.status)})()", timeout=60000)
        fj = await E("()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return{status:j.status,model:j.model,card:card98(j,0).includes('NVIDIA Cosmos')}}"); fal = stats()["fal"][f0:]
        R["fal"] = {"job": fj, "fal": fal}
        ok(fj["status"] == "complete" and fj["model"] == "nvcosmos" and fj["card"] and fal and fal[0]["model"] == "fal-ai/cosmos-predict-2.5/text-to-video" and "red car" in fal[0]["input"].get("prompt", "") and fal[0]["auth"] == "Key fal-test-key",
           f"{tag}: NVIDIA Cosmos made on fal.ai's NVIDIA Cosmos, the card still NVIDIA Cosmos {R['fal']}")
    w = await E("()=>document.documentElement.scrollWidth<=innerWidth+1"); ok(w, f"{tag}: nothing wider than the screen")
    out[tag] = R; ok(not errs, f"{tag}: page errors {errs}"); await br.close()

def server_part():
    # NVIDIA refuses a hand-picked Cosmos job mid-way (closed for real requests only) → the same model on fal.ai, once
    nano("jobs"); c, r = api("/v1/admin/nvidia/check", {}); st = {e["task"]: e["state"] for e in r.get("engines", [])}; out["check"] = st
    ok(st.get("video") == "open" and st.get("video-super") == "closed" and st.get("video-edge") == "closed" and st.get("video-genai") == "open" and st.get("video-fal") == "ready", f"the check: other Cosmos 3 addresses and fal.ai's Cosmos {st}")
    f0, n0 = len(stats()["fal"]), len(stats()["nv"])
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a robot arm stacks blocks", "dur": 5, "aspect": "16:9", "inputs": {"startImage": M + "/start.png"}}, tok=TOKEN)
    j = wait_job(j.get("id", "x"), TOKEN); fal = stats()["fal"][f0:]; out["moved"] = {"status": j.get("status"), "error": j.get("error"), "madeBy": j.get("madeBy"), "fal": fal[:1], "nv": stats()["nv"][n0:]}
    ok(j.get("status") == "done" and not j.get("madeBy") and fal and fal[0]["model"] == "fal-ai/cosmos-predict-2.5/image-to-video" and fal[0]["input"].get("image_url", "").startswith("http") and len(stats()["nv"][n0:]) == 1,
       f"Cosmos refused by NVIDIA mid-way → the same model on fal.ai (picture → image_url), named NVIDIA Cosmos {out['moved']}")

async def main():
    async with async_playwright() as p:
        for phone, lang, full in ((True, "en", True), (False, "ar", False)):
            try: await run(p, phone, lang, full)
            except Exception as e: fails.append(f"{'phone' if phone else 'desk'} {lang} crashed: {e!r}"[:400])
try:
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: time.sleep(0.25)
    c, _ = api("/v1/admin/providers/nvidia", {"videoUrl": M + "/v1/cosmos/nvidia/cosmos3-nano", "use": "video:on image:off edit:off 3d:off"}, "PUT"); ok(c == 200, f"NVIDIA set up {c}")
    asyncio.run(main())
    server_part()
except Exception as e: fails.append(f"crashed: {e!r}"[:400])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1)[:9000])
if fails: print(open(D + "/server.log").read()[-2000:])
shutil.rmtree(D, ignore_errors=True)
print("v177 ok" if not fails else f"FAILED {len(fails)}"); sys.exit(1 if fails else 0)
