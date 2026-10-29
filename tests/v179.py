# v179 — a tick on every choice, tidy options under the prompt, the agents pop in (glass), nooi keeps your pictures, NVIDIA + Agents.
# A real nooi server with a stand-in AI engine (pictures and videos) and a stand-in NVIDIA: Cosmos 3 closed to the key, FLUX.1 open,
# SD 3.5 closed, its text and vision AI answering:
#  · the settings sheets: the chosen resolution, slow motion, scene and engine show the same tick as the format tiles; the others don't
#  · under the prompt on a phone: the engine and Agents on one line, the options in two even columns (Scene among them), the price
#    and Create in the last column; nothing wider than the screen
#  · the agents' panel pops in once (not on every redraw); the plan box is as tall as the line shown
#  · NVIDIA: the picture list offers only the NVIDIA engines that passed the check (FLUX.1, not SD 3.5); NVIDIA for video is
#    "NVIDIA + Agents" (chip, list, card), priced first (the agents' price + FLUX.1's first frame), never refused: NVIDIA FLUX.1 makes
#    the first frame, then an open engine makes the video from it; the card names both
#  · NVIDIA + Agents with #image1 → the picture is used (first frame or reference), no FLUX.1 picture, not refused
#  · nooi Auto with #image1 and @Saba → the first frame is made from Saba's face AND #image1; with #image1 alone → the picture isn't dropped
#  · the server never sends the agents' work to a closed NVIDIA engine (it moves before anything is sent)
# Run: python3 tests/v179.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8574, 8575; B = f"http://localhost:{PORT}"; M = f"http://localhost:{MP}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v179-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "c" * 32; now = int(time.time() * 1000)
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": now},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "1", "-c:v", "libvpx-vp9", "-b:v", "200k", "-f", "mp4", D + "/vp9.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "1", "-c:v", "libvpx-vp9", "-b:v", "200k", D + "/vid.webm"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=360x640", "-frames:v", "1", D + "/pic.png"], check=True)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={kie:[],nv:[],fal:[],nano:'open'};let n=0;
const VID=fs.readFileSync(path.join(DIR,'vp9.mp4')).toString('base64'),PNG=fs.readFileSync(path.join(DIR,'pic.png')).toString('base64'),task={};
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
   if(!imgs.length)return J(200,{choices:[{message:{content:JSON.stringify({request:'the brief',prompt:'the scene the client asked for, cinematic',negative:'',shots:[],agents:{},bible:''})}}]});if(st.visionOff)return J(500,{detail:'down'});return J(200,{choices:[{message:{content:JSON.stringify({pictures:[{n:1,what:'an old wooden house with a stone tower under a cloudy sky'},{n:2,what:'a woman of about 25 with long dark hair in a white dress'}]})}}]})}
 if(u.pathname==='/vision-off'){st.visionOff=true;return J(200,{})}
 if(/\/cosmos3-/.test(u.pathname)){if(!empty)st.nv.push({p:u.pathname,mode:body.model_mode,ref:String(body.input_reference||'').slice(0,22),res:body.resolution,prompt:String(body.prompt||'')});
   const NF=()=>J(404,{status:404,detail:"Function 'f': Not found for account 'a'"});
   if(!/cosmos3-nano$/.test(u.pathname))return NF();
   if(st.nano==='closed'||(st.nano==='jobs'&&!empty))return NF();if(empty)return J(422,{detail:'model_mode is required'});return J(200,{b64_video:VID})}
 // NVIDIA FLUX.1 (open) and SD 3.5 (closed to the key)
 if(/flux\.1-dev$/.test(u.pathname)){if(empty)return J(422,{detail:'prompt is required'});st.flux=(st.flux||[]).concat([String(body.prompt||'')]);return J(200,{artifacts:[{base64:PNG,finishReason:'SUCCESS'}]})}
 if(/sd35$/.test(u.pathname))return J(404,{status:404,detail:"Function 'f': Not found for account 'a'"});
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


SET = """(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.hf.tab='video';S.hf.bots=true;S.hf.dur=5;S.hf.aspect='16:9';
  S.chars=[{id:'c1',name:'Saba',face:'%s/face.png',facePic:'%s/face.png',look:'a young woman'}];go('home');renderAll();
  window.SENT=[];const o=API.req;API.req=function(p,opt){if(String(p)==='/v1/jobs'&&opt&&opt.json){const j=opt.json;SENT.push({kind:j.kind,model:j.model,prompt:String(j.prompt||''),inputs:Object.keys(j.inputs||{}),meta:j.meta||{}})}return o.apply(this,arguments)};
  window.TOASTS=[];const t=window.toast;window.toast=function(m,o2){TOASTS.push(String(m));return t.apply(this,arguments)}}""" % (M, M)
CLEAR = "()=>{S.draft.refs130=[];REF130.forEach(s=>M[s]=null);M.hfRef=null;M.vStart=null;TOASTS.length=0;SENT.length=0;const q=document.getElementById('hfq');if(q){q.value='';S.hf.prompt=''}renderAll()}"
ADD = """async()=>{document.querySelector('[data-act=pic156]').click();await new Promise(r=>setTimeout(r,300));return !!document.querySelector('#modalRoot input[data-ref130]')}"""
TICK = """([sel,pseudo])=>{const e=document.querySelector(sel);if(!e)return 'missing';const c=getComputedStyle(e,pseudo).content;return c&&c!=='none'&&c!=='normal'?'tick':'none'}"""

async def add_pic(pg, E):
    ok(await E(ADD), "the Picture sheet opens with its upload")
    inp = await pg.query_selector("#modalRoot input[data-ref130]"); await inp.set_input_files(D + "/pic.png"); await pg.wait_for_timeout(900)

async def words(E, t): await E("(t)=>{const q=document.getElementById('hfq');q.value=t;S.hf.prompt=t}", t)

async def done_video(pg, n0, secs=90):
    await pg.wait_for_function("(n)=>S.jobs.filter(x=>x.kind==='video').length>n&&['complete','failed'].includes(S.jobs.filter(x=>x.kind==='video').pop().status)", arg=n0, timeout=secs * 1000)

async def run(p, phone, lang, full):
    tag = f"{'phone' if phone else 'desk'} {lang}"; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate; R = {}
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
    await E(SET, lang); await pg.wait_for_timeout(500)
    # 1. NVIDIA + Agents on the chip; the agents' panel pops in when it appears (Agents on), not on every redraw
    await E("()=>{S.hf.vModel='nvcosmos';S.hf.bots=false;renderAll()}"); await pg.wait_for_timeout(300)
    await E("()=>{S.hf.bots=true;renderAll()}"); await pg.wait_for_timeout(250)
    st = await E("()=>({chip:document.querySelector('.eng171').innerText.trim(),pop:!!document.querySelector('.hfbots.pro.in179'),std:(document.querySelector('.hfstd')||{}).innerText||''})")
    await pg.wait_for_timeout(1500); await E("()=>renderAll()"); await pg.wait_for_timeout(300)
    st["pop2"] = await E("()=>!!document.querySelector('.hfbots.pro.in179')"); R["chip"] = st
    ok(st["chip"] == ("NVIDIA + الوكلاء" if ar else "NVIDIA + Agents") and ("NVIDIA FLUX.1" in st["std"]), f"{tag}: NVIDIA for video is NVIDIA + Agents, the card says what it does {st}")
    ok(st["pop"] and not st["pop2"], f"{tag}: the agents' panel pops in once, not on every redraw {st}")
    fit = await E("()=>{agApply171(false);const ul=document.querySelector('.hfstplan.bots.one171 .hbls'),li=ul&&ul.querySelector('li.on171');if(!li)return null;const cs=getComputedStyle(ul);return{ul:ul.getBoundingClientRect().height,li:li.offsetHeight,pad:parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom),box:cs.boxSizing}}")
    R["fit"] = fit; ok(fit and abs(fit["ul"] - fit["li"] - fit["pad"]) < 3, f"{tag}: the plan box is as tall as the line shown {fit}")
    # 2. the price: the agents' price + NVIDIA FLUX.1's first frame
    await words(E, "a red car on a coast road at sunset")
    pr = await E("()=>{const H=S.hf;const a=hfCost();H.vModel='auto';const b=hfCost();H.vModel='nvcosmos';return{nv:a,auto:b,flux:IMG_MODELS.nvflux.cr}}"); R["price"] = pr
    ok(pr["nv"] == pr["auto"] + pr["flux"], f"{tag}: NVIDIA + Agents costs the agents' price + FLUX.1's first frame {pr}")
    # 3. the options under the prompt
    lay = await E("""()=>{const bar=document.querySelector('.hfbox .hfbar'),chips=[...bar.querySelectorAll('.hfchip')],go=bar.querySelector('.hfgo'),eng=document.querySelector('.eng171'),bots=document.querySelector('.hfmrow .bots'),r=e=>e.getBoundingClientRect();
      return{grid:getComputedStyle(bar).display,scene:!!bar.querySelector('.hfchip.sc179[data-act=hfx-scene]'),sceneTop:!!document.querySelector('.hfmrow [data-act=hfx-scene]'),widths:chips.map(c=>Math.round(r(c).width)),lefts:[...new Set(chips.map(c=>Math.round(r(c).left)))].length,
        goRight:Math.round(r(go).right),barRight:Math.round(r(bar).right),sameLine:Math.abs(r(eng).top-r(bots).top)<3,wide:document.documentElement.scrollWidth<=innerWidth+1}}""")
    R["layout"] = lay
    ok(lay["scene"] and not lay["sceneTop"] and lay["wide"], f"{tag}: Scene is among the options, nothing wider than the screen {lay}")
    if phone:
        ok(lay["grid"] == "grid" and lay["lefts"] == 2 and max(lay["widths"]) - min(lay["widths"]) <= 2 and abs(lay["goRight"] - lay["barRight"]) <= 2 and lay["sameLine"],
           f"{tag}: the options in two even columns, Create in the last column, the engine and Agents on one line {lay}")
    # 4. the ticks
    tk = {}
    await E("()=>document.querySelector('[data-act=hf-ratio]').click()"); await pg.wait_for_timeout(500)
    tk["res_on"] = await E(TICK, ['#modalRoot .seg>button[aria-pressed="true"]', "::before"]); tk["res_off"] = await E(TICK, ['#modalRoot .seg>button[aria-pressed="false"]', "::before"])
    tk["ar"] = await E("()=>!!document.querySelector('#modalRoot .pk84o[aria-pressed=true] .pk84ok')")
    await E("()=>{document.getElementById('modalRoot').innerHTML='';document.querySelector('[data-act=sl163h]').click()}"); await pg.wait_for_timeout(500)
    tk["slow_on"] = await E(TICK, ['#modalRoot .tile[aria-checked="true"]', "::after"]); tk["slow_off"] = await E(TICK, ['#modalRoot .tile[aria-checked="false"]', "::after"])
    await E("()=>{document.getElementById('modalRoot').innerHTML='';document.querySelector('[data-act=hfx-scene]').click()}"); await pg.wait_for_timeout(500)
    tk["scene_on"] = await E(TICK, ["#modalRoot .scopt.on", "::after"])
    await E("()=>{document.getElementById('modalRoot').innerHTML='';document.querySelector('.eng171').click()}"); await pg.wait_for_timeout(600)
    tk["eng_on"] = await E(TICK, ['#modalRoot .hfmodel[aria-pressed="true"]', "::after"]); tk["eng_off"] = await E(TICK, ['#modalRoot .hfmodel[aria-pressed="false"]', "::after"])
    tile = await E("()=>{const b=document.querySelector('#modalRoot .hfmodel[data-v=nvcosmos]');return b?{t:b.innerText,off:b.classList.contains('off173')}:null}")
    await E("()=>{document.getElementById('modalRoot').innerHTML='';S.hf.tab='image';renderAll();document.querySelector('.eng171').click()}"); await pg.wait_for_timeout(600)
    imgs = await E("()=>[...document.querySelectorAll('#modalRoot .hfmodel')].map(b=>b.dataset.v)")
    await E("()=>{document.getElementById('modalRoot').innerHTML='';S.hf.tab='video';S.hf.vModel='nvcosmos';renderAll()}"); await pg.wait_for_timeout(300)
    R["ticks"] = tk; R["tile"] = tile; R["imgList"] = [m for m in imgs if m.startswith("nv")]
    ok(tk["res_on"] == "tick" and tk["res_off"] == "none" and tk["ar"] and tk["slow_on"] == "tick" and tk["slow_off"] == "none" and tk["scene_on"] == "tick" and tk["eng_on"] == "tick" and tk["eng_off"] == "none",
       f"{tag}: every chosen option shows a tick, the others don't {tk}")
    ok(tile and not tile["off"] and ("NVIDIA + الوكلاء" if ar else "NVIDIA + Agents") in tile["t"], f"{tag}: the list offers NVIDIA + Agents (not 'not open') {tile}")
    ok("nvflux" in imgs and "nvsd35" not in imgs, f"{tag}: pictures: only the NVIDIA engines that passed the check {R['imgList']}")
    if full:
        # 5. Create with NVIDIA + Agents: NVIDIA FLUX.1's first frame, then an open engine makes the video from it — never refused
        await E(CLEAR); await E("()=>{S.hf.vModel='nvcosmos';renderAll()}"); await words(E, "a red car on a coast road at sunset")
        k0, f0, n0 = len(stats()["kie"]), len(stats().get("flux") or []), len(stats()["nv"]); v0 = await E("()=>S.jobs.filter(x=>x.kind==='video').length")
        await E("()=>hfSend()"); await done_video(pg, v0)
        sent = await E("()=>SENT.map(x=>({kind:x.kind,model:x.model,inputs:x.inputs,nv:!!x.meta.nv179,frame:!!x.meta.frame87,nvf:!!x.meta.nvFrame179,start:!!x.meta.start}))"); R["nvSent"] = sent
        fin = await E("()=>{const j=S.jobs.filter(x=>x.kind==='video').pop();return{status:j.status,model:j.model,names:names175(j),toasts:TOASTS.slice(),chip:document.querySelector('.eng171').innerText.trim()}}"); R["nvFinal"] = fin
        img = [x for x in sent if x["kind"] == "image"]; vid = [x for x in sent if x["kind"] == "video"]
        ok(len(img) == 1 and img[0]["model"] == "nvflux" and img[0]["frame"] and len(vid) == 1 and vid[0]["model"] not in ("nvcosmos", "auto") and "vStart" in vid[0]["inputs"] and vid[0]["nvf"] and vid[0]["start"],
           f"{tag}: NVIDIA + Agents — NVIDIA FLUX.1 makes the first frame, an open engine makes the video from it {sent}")
        ok(fin["status"] == "complete" and not any("isn't open" in t or "غير متاح" in t for t in fin["toasts"]) and fin["names"] and fin["names"].startswith("NVIDIA FLUX.1 + ") and fin["chip"] == "NVIDIA + Agents",
           f"{tag}: never refused, made, the card names both engines, NVIDIA + Agents stays picked {fin}")
        fl = (stats().get("flux") or [])[f0:]; kie = stats()["kie"][k0:]; R["flux"] = [x[:80] for x in fl]; R["kie"] = [{"model": x["model"], "in": sorted((x["input"] or {}).keys())} for x in kie]
        ok(len(fl) == 1 and len(stats()["nv"]) == n0 and any(x["input"] and any(k in json.dumps(x["input"]) for k in ("first_frame", "image_url", "image_urls", "start_image", "input_image")) for x in kie),
           f"{tag}: FLUX.1 asked once, Cosmos never, the engine got the first frame {R['flux']} {R['kie']}")
        # 6. NVIDIA + Agents with #image1: the picture is used — no FLUX.1 picture, not dropped, not refused
        await E(CLEAR); await E("()=>{S.hf.vModel='nvcosmos';renderAll()}"); await add_pic(pg, E); f1 = len(stats().get("flux") or [])
        t1 = await E("()=>TOASTS.slice()"); await words(E, "a man walks into #image1"); await E("()=>{SENT.length=0}"); v1 = await E("()=>S.jobs.filter(x=>x.kind==='video').length")
        await E("()=>hfSend()"); await done_video(pg, v1)
        s2 = await E("()=>SENT.map(x=>({kind:x.kind,model:x.model,inputs:x.inputs,refs:x.meta.refs130||null,read:x.meta.read178||null}))"); R["nvPic"] = s2
        v = [x for x in s2 if x["kind"] == "video"]
        ok(any("NVIDIA + Agents" in t for t in t1) and not [x for x in s2 if x["kind"] == "image"] and len(stats().get("flux") or []) == f1 and v and "vRef1" in v[0]["inputs"] and (v[0]["refs"] or (v[0]["read"] and "vStart" in v[0]["inputs"])),
           f"{tag}: NVIDIA + Agents with a picture — told how it's used, the picture is used (first frame or reference), no FLUX.1 picture {t1} {s2}")
        # 7. nooi Auto with #image1 and @Saba → the first frame from Saba's face AND #image1
        await E(CLEAR); await E("()=>{S.hf.vModel='auto';renderAll()}"); await add_pic(pg, E); await words(E, "walking through this field #image1 @Saba"); await E("()=>{SENT.length=0}")
        v2 = await E("()=>S.jobs.filter(x=>x.kind==='video').length"); await E("()=>hfSend()"); await done_video(pg, v2)
        s3 = await E("()=>SENT.map(x=>({kind:x.kind,model:x.model,inputs:x.inputs,words:x.prompt.slice(0,600),refs:x.meta.refs130||null,read:x.meta.read178||null}))"); R["autoChar"] = s3
        fr = [x for x in s3 if x["kind"] == "image"]
        ok(fr and "iRef" in fr[0]["inputs"] and "iRef2" in fr[0]["inputs"] and "#image1 is reference picture 2" in fr[0]["words"], f"{tag}: nooi Auto — the first frame is made from Saba's face and #image1 {fr}")
        # 8. nooi Auto with #image1 alone → the picture isn't dropped (first frame + read, or a reference)
        await E(CLEAR); await E("()=>{S.hf.vModel='auto';renderAll()}"); await add_pic(pg, E); await words(E, "a man walks into #image1"); await E("()=>{SENT.length=0}")
        v3 = await E("()=>S.jobs.filter(x=>x.kind==='video').length"); await E("()=>hfSend()"); await done_video(pg, v3)
        s4 = await E("()=>SENT.filter(x=>x.kind==='video').map(x=>({model:x.model,inputs:x.inputs,refs:x.meta.refs130||null,read:x.meta.read178||null}))"); R["autoPic"] = s4
        ok(s4 and "vRef1" in s4[0]["inputs"] and ((s4[0]["model"] in ("seedance20", "seedance25", "seedance", "kling40") and s4[0]["refs"]) or (s4[0]["read"] and "vStart" in s4[0]["inputs"] and not s4[0]["refs"])),
           f"{tag}: nooi Auto keeps the picture — as the first frame read into the words, or as a reference {s4}")
    w = await E("()=>document.documentElement.scrollWidth<=innerWidth+1"); ok(w, f"{tag}: nothing wider than the screen")
    out[tag] = R; ok(not errs, f"{tag}: page errors {errs}"); await br.close()

def server_part():
    # the agents' work on a closed NVIDIA engine moves before anything is sent: made, Cosmos never asked
    n0, k0 = len(stats()["nv"]), len(stats()["kie"])
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a robot arm stacks blocks", "dur": 5, "aspect": "16:9", "meta": {"studio": 2}}, tok=TOKEN)
    j = wait_job(j.get("id", "x"), TOKEN); out["swap"] = {"code": c, "status": j.get("status"), "nv": len(stats()["nv"]) - n0, "kie": len(stats()["kie"]) - k0}
    ok(c == 200 and j.get("status") == "done" and len(stats()["nv"]) == n0 and len(stats()["kie"]) > k0, f"the agents' job on a closed NVIDIA engine moves before it's sent {out['swap']}")
    # picked by hand it is still refused at once (nothing charged)
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a robot arm stacks blocks", "dur": 5, "aspect": "16:9"}, tok=TOKEN)
    ok(c == 409, f"a hand-picked closed NVIDIA engine sent straight to the server is refused, nothing charged {c} {j}")

async def main():
    async with async_playwright() as p:
        for phone, lang, full in ((True, "en", True), (False, "ar", False)):
            try: await run(p, phone, lang, full)
            except Exception as e: fails.append(f"{'phone' if phone else 'desk'} {lang} crashed: {e!r}"[:400])
try:
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: time.sleep(0.25)
    c, _ = api("/v1/admin/providers/nvidia", {"videoUrl": M + "/v1/cosmos/nvidia/cosmos3-nano", "imageUrl": M + "/v1/genai/black-forest-labs/flux.1-dev", "image2Url": M + "/v1/genai/stabilityai/sd35",
      "baseUrl": M + "/v1", "use": "video:on image:on edit:off 3d:off text:on vision:on"}, "PUT"); ok(c == 200, f"NVIDIA set up {c}")
    nano("closed"); c, r = api("/v1/admin/nvidia/check", {}); st = {e["task"]: e["state"] for e in r.get("engines", [])}; out["check"] = st
    ok(st.get("video") == "closed" and st.get("image") == "open" and st.get("image2") == "closed", f"the check: Cosmos and SD 3.5 closed, FLUX.1 open {st}")
    asyncio.run(main())
    server_part()
except Exception as e: fails.append(f"crashed: {e!r}"[:400])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1)[:9000])
if fails: print(open(D + "/server.log").read()[-2000:])
shutil.rmtree(D, ignore_errors=True)
print("v179 ok" if not fails else f"FAILED {len(fails)}"); sys.exit(1 if fails else 0)
