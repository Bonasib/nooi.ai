# v181 — NVIDIA Cosmos 3 Super Image2Video on NVIDIA's own API (the owner chose NVIDIA's API only). A real nooi server with a
# stand-in AI engine and a stand-in NVIDIA: Cosmos 3 Nano closed to the key, Cosmos 3 Super Image2Video open (then closed):
#  · Admin's free check tries the "Picture-to-video URL"; open → /v1/config providers.nvI2v; Admin says videos from a picture are made there
#  · the server: NVIDIA Cosmos picked without a picture → refused at once with "add a picture" (nothing charged); with a first frame →
#    made by Cosmos 3 Super Image2Video (image2video, the frame as a data URL), Cosmos 3 Nano and Kie AI never asked; closed again →
#    the job fails with NVIDIA's answer, nothing charged, the open mark goes
#  · the page (phone in English, computer in Arabic): NVIDIA Cosmos in the list is not "not open" and says it makes the video from a
#    picture; Create with words only → "add a picture", nothing sent; with #image1 → ONE job on NVIDIA Cosmos, its first frame the picture
# Run: python3 tests/v181.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8576, 8577; B = f"http://localhost:{PORT}"; M = f"http://localhost:{MP}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v181-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
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
 // NVIDIA Cosmos 3 Super Image2Video (picture → video)
 if(u.pathname==='/i2v'){st.i2vState=u.searchParams.get('to');return J(200,{})}
 if(/cosmos3-super-image2video$/.test(u.pathname)){if(st.i2vState==='closed')return J(404,{status:404,detail:"Function 'f': Not found for account 'a'"});if(empty)return J(422,{detail:'input_reference is required'});
   st.i2v=(st.i2v||[]).concat([{mode:body.model_mode,ref:String(body.input_reference||'').slice(0,22),prompt:String(body.prompt||'').slice(0,200)}]);if(!body.input_reference)return J(422,{detail:'input_reference is required'});return J(200,{b64_video:VID})}
 // NVIDIA (Cosmos 3): open / closed / closed only for real requests
 // NVIDIA's vision model: only the reading of pictures answers (text steps fall back)
 if(u.pathname==='/v1/chat/completions'){const imgs=[];for(const m of body.messages||[])for(const c of (Array.isArray(m.content)?m.content:[]))if(c.type==='image_url')imgs.push(1);st.vision=(st.vision||[]).concat([{n:imgs.length,model:body.model}]);
   if(!imgs.length)return J(200,{choices:[{message:{content:JSON.stringify({request:'the brief',prompt:'the scene the client asked for, cinematic',negative:'',shots:[],agents:{},bible:''})}}]});if(st.visionOff)return J(500,{detail:'down'});return J(200,{choices:[{message:{content:JSON.stringify({pictures:[{n:1,what:'an old wooden house with a stone tower under a cloudy sky'},{n:2,what:'a woman of about 25 with long dark hair in a white dress'}]})}}]})}
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


SET = """(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.hf.tab='video';S.hf.bots=false;S.hf.dur=5;S.hf.aspect='16:9';go('home');renderAll();
  window.SENT=[];const o=API.req;API.req=function(p,opt){if(String(p)==='/v1/jobs'&&opt&&opt.json){const j=opt.json;SENT.push({kind:j.kind,model:j.model,inputs:Object.keys(j.inputs||{}),meta:j.meta||{}})}return o.apply(this,arguments)};
  window.TOASTS=[];const t=window.toast;window.toast=function(m,o2){TOASTS.push(String(m));return t.apply(this,arguments)}}"""
CLEAR = "()=>{S.draft.refs130=[];REF130.forEach(s=>M[s]=null);M.hfRef=null;M.vStart=null;TOASTS.length=0;SENT.length=0;const q=document.getElementById('hfq');if(q){q.value='';S.hf.prompt=''}renderAll()}"
ADD = """async()=>{document.querySelector('[data-act=pic156]').click();await new Promise(r=>setTimeout(r,300));return !!document.querySelector('#modalRoot input[data-ref130]')}"""

async def run(p, phone, lang, full):
    tag = f"{'phone' if phone else 'desk'} {lang}"; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate; R = {}
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
    await E(SET, lang); await pg.wait_for_timeout(400)
    cfg = await E("()=>({i2v:API.cfg.providers.nvI2v,down:API.cfg.providers.nvDown})"); R["cfg"] = cfg
    ok(cfg["i2v"] is True and cfg["down"] and cfg["down"].get("video"), f"{tag}: the page knows Cosmos 3 Super Image2Video is open while Nano is closed {cfg}")
    # the list: NVIDIA Cosmos makes the video from a picture
    await E("()=>{S.hf.vModel='nvcosmos';renderAll();document.querySelector('.hfmi.eng171').click()}"); await pg.wait_for_timeout(600)
    row = await E("()=>{const b=document.querySelector('#modalRoot .hfmodel[data-v=nvcosmos]');return b?{off:b.classList.contains('off173'),t:b.innerText}:null}")
    await E("()=>{document.getElementById('modalRoot').innerHTML=''}"); R["row"] = row
    ok(row and not row["off"] and ("من صورتك" if ar else "from your picture") in row["t"] and "Cosmos 3 Super" in row["t"], f"{tag}: NVIDIA Cosmos in the list makes the video from a picture {row}")
    # Admin's note
    note = await E("()=>{const k=NV176.r;NV176.r={engines:[{task:'video',state:'closed',label:'v',url:'u'},{task:'i2v',state:'open',label:'i',url:'u2'}]};const a=nvCheckHTML176();NV176.r=k;return{ok:a.includes('ok181'),closedNote:/nvhint180\"(?! ok181)/.test(a)||a.includes('Public API Endpoints')}}")
    R["note"] = note; ok(note["ok"] and not note["closedNote"], f"{tag}: Admin says videos from a picture are made on Cosmos 3 Super {note}")
    if full:
        # words only → add a picture, nothing sent
        await E(CLEAR); await E("()=>{S.hf.vModel='nvcosmos';const q=document.getElementById('hfq');q.value='a red car on a coast road at sunset';S.hf.prompt=q.value;hfSend()}"); await pg.wait_for_timeout(2000)
        w = await E("()=>({sent:SENT.length,toasts:TOASTS.slice()})"); R["words"] = w
        ok(w["sent"] == 0 and any("add a picture" in t for t in w["toasts"]), f"{tag}: words only → told to add a picture, nothing sent {w}")
        # with #image1 → ONE job on NVIDIA Cosmos, made by Cosmos 3 Super Image2Video
        await E(CLEAR); await E("()=>{S.hf.vModel='nvcosmos';renderAll()}"); ok(await E(ADD), "the Picture sheet opens")
        inp = await pg.query_selector("#modalRoot input[data-ref130]"); await inp.set_input_files(D + "/pic.png"); await pg.wait_for_timeout(900)
        i0, n0, k0 = len(stats().get("i2v") or []), len(stats()["nv"]), len(stats()["kie"]); v0 = await E("()=>S.jobs.filter(x=>x.kind==='video').length")
        await E("()=>{const q=document.getElementById('hfq');q.value='a man walks into #image1';S.hf.prompt=q.value;TOASTS.length=0;SENT.length=0;hfSend()}")
        await pg.wait_for_function("(n)=>S.jobs.filter(x=>x.kind==='video').length>n&&['complete','failed'].includes(S.jobs.filter(x=>x.kind==='video').pop().status)", arg=v0, timeout=90000)
        s = await E("()=>({sent:SENT.map(x=>({kind:x.kind,model:x.model,inputs:x.inputs})),job:(j=>({status:j.status,model:j.model,error:j.error||''}))(S.jobs.filter(x=>x.kind==='video').pop())})"); R["pic"] = s
        i2 = (stats().get("i2v") or [])[i0:]; R["i2v"] = i2
        ok(len(s["sent"]) == 1 and s["sent"][0]["model"] == "nvcosmos" and "vStart" in s["sent"][0]["inputs"] and s["job"]["status"] == "complete" and s["job"]["model"] == "nvcosmos",
           f"{tag}: with a picture → ONE job on NVIDIA Cosmos, made {s}")
        ok(len(i2) == 1 and i2[0]["mode"] == "image2video" and i2[0]["ref"].startswith("data:image/") and len(stats()["nv"]) == n0 and len(stats()["kie"]) == k0,
           f"{tag}: made by Cosmos 3 Super Image2Video on NVIDIA (the picture as its first frame); Nano and Kie AI never asked {i2}")
    w = await E("()=>document.documentElement.scrollWidth<=innerWidth+1"); ok(w, f"{tag}: nothing wider than the screen")
    out[tag] = R; ok(not errs, f"{tag}: page errors {errs}"); await br.close()

def server_part():
    cr0 = api("/v1/billing", tok=TOKEN)[1].get("credits")
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a robot arm stacks blocks", "dur": 5, "aspect": "16:9"}, tok=TOKEN)
    ok(c == 409 and "add a picture" in (j.get("error") or "") and "أضف صورة" in (j.get("errorAr") or ""), f"API: Cosmos without a picture → add a picture, in Arabic too {c} {j}")
    i0, n0, k0 = len(stats().get("i2v") or []), len(stats()["nv"]), len(stats()["kie"])
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a robot arm stacks blocks", "dur": 5, "aspect": "16:9", "inputs": {"startImage": M + "/start.png"}}, tok=TOKEN)
    j = wait_job(j.get("id", "x"), TOKEN); out["api_pic"] = {"code": c, "status": j.get("status"), "i2v": len(stats().get("i2v") or []) - i0, "nv": len(stats()["nv"]) - n0, "kie": len(stats()["kie"]) - k0}
    ok(c == 200 and j.get("status") == "done" and out["api_pic"]["i2v"] == 1 and out["api_pic"]["nv"] == 0 and out["api_pic"]["kie"] == 0, f"API: with a first frame → made on Cosmos 3 Super Image2Video only {out['api_pic']}")
    # closed again → fails with NVIDIA's answer, nothing charged, the open mark goes
    urllib.request.urlopen(M + "/i2v?to=closed", timeout=5); cr1 = api("/v1/billing", tok=TOKEN)[1].get("credits")
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a crane lifts a red container at the harbour", "dur": 5, "aspect": "16:9", "inputs": {"startImage": M + "/start.png"}}, tok=TOKEN)
    j = wait_job(j.get("id", "x"), TOKEN); cfg = api("/v1/config")[1].get("providers", {})
    out["closed"] = {"status": j.get("status"), "error": (j.get("error") or "")[:120], "nvI2v": cfg.get("nvI2v"), "credits": api("/v1/billing", tok=TOKEN)[1].get("credits") == cr1}
    ok(j.get("status") == "failed" and "isn't open" in (j.get("error") or "") and cfg.get("nvI2v") is False and out["closed"]["credits"], f"API: Cosmos 3 Super closed again → fails, nothing charged, no longer offered {out['closed']}")

async def main():
    async with async_playwright() as p:
        for phone, lang, full in ((True, "en", True), (False, "ar", False)):
            try: await run(p, phone, lang, full)
            except Exception as e: fails.append(f"{'phone' if phone else 'desk'} {lang} crashed: {e!r}"[:400])
try:
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: time.sleep(0.25)
    c, _ = api("/v1/admin/providers/nvidia", {"videoUrl": M + "/v1/cosmos/nvidia/cosmos3-nano", "i2vUrl": M + "/v1/cosmos/nvidia/cosmos3-super-image2video", "baseUrl": M + "/v1", "use": "video:on image:off edit:off 3d:off text:on vision:on"}, "PUT"); ok(c == 200, f"NVIDIA set up {c}")
    nano("closed"); c, r = api("/v1/admin/nvidia/check", {}); st = {e["task"]: e["state"] for e in r.get("engines", [])}; out["check"] = st
    ok(st.get("video") == "closed" and st.get("i2v") == "open" and not (r.get("suggest") or {}).get("videoUrl", "").endswith("image2video"), f"the check: Nano closed, Cosmos 3 Super Image2Video open (not offered as the video URL) {st}")
    asyncio.run(main())
    server_part()
except Exception as e: fails.append(f"crashed: {e!r}"[:400])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1)[:9000])
if fails: print(open(D + "/server.log").read()[-2000:])
shutil.rmtree(D, ignore_errors=True)
print("v181 ok" if not fails else f"FAILED {len(fails)}"); sys.exit(1 if fails else 0)
