# v185 — MiniMax videos with the owner's own key, and MiniMax taking over when the AI engine's balance is used up. A real nooi
# server with a stand-in AI engine (its balance empty or full on demand) and a stand-in MiniMax (its own codes, tasks and files):
#  · the AI engine says "Credits insufficient" (402, or a 500 with the same words) for a Kling 2.6 video from a picture → the same
#    job goes to MiniMax Hailuo 2.3 (6 s, 768P, the picture as its bytes) and is made; the engine is asked once only (not every
#    model on the same empty account); the customer pays what was asked, once; the card says MiniMax made it; staff are told the
#    engine is out of credits
#  · a tall (9:16) 10 s video without a picture → a first frame in 9:16 from image-01, then Hailuo 10 s from it
#  · MiniMax picked by hand → straight to MiniMax, the AI engine never asked
#  · a picture on the empty engine → MiniMax Image-01 makes it
#  · Videos switched off → the video fails with the calm message, credits back, MiniMax not asked
#  · MiniMax can't make it (Fail) → the job fails with MiniMax's reason, credits back
#  · the engine with credits again → Kling 2.6 on the engine as before, MiniMax not asked
#  · the page (phone in English, computer in Arabic): MiniMax's row has a fourth switch, Videos, and the video model; Videos off/on
#    follows the server's config
# Run: python3 tests/v185.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8600, 8601; B = f"http://localhost:{PORT}"; M = f"http://localhost:{MP}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v185-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "h" * 32; now = int(time.time() * 1000)
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": now},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "1", "-c:v", "libvpx-vp9", "-b:v", "200k", D + "/vid.webm"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360", "-frames:v", "1", D + "/pic.jpeg"], check=True)
shutil.copy(D + "/pic.jpeg", D + "/media/field.jpeg")   # (the customer's picture, uploaded before)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={mm:[],kie:[],kieBal:false},task={};let n=0;
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x'),J=(code,d)=>{s.statusCode=code;s.setHeader('content-type','application/json');s.end(JSON.stringify(d))};
 if(u.pathname==='/stats')return J(200,st);
 if(u.pathname==='/kiebal'){st.kieBal=u.searchParams.get('to')==='1';return J(200,{})}
 if(u.pathname==='/vid.webm'){s.setHeader('content-type','video/webm');return s.end(fs.readFileSync(path.join(DIR,'vid.webm')))}
 if(u.pathname==='/img.jpeg'){s.setHeader('content-type','image/jpeg');return s.end(fs.readFileSync(path.join(DIR,'pic.jpeg')))}
 let body={};try{body=JSON.parse(b||'{}')}catch{}
 // the stand-in MiniMax: HTTP 200 and its own code in base_resp; video tasks → a file → its link
 if(/^\/v1\/(get_voice|image_generation|video_generation|query\/video_generation|files\/retrieve)$/.test(u.pathname)){const key=(q.headers.authorization||'').replace('Bearer ','');
   st.mm.push({p:u.pathname,key,body:u.pathname==='/v1/video_generation'?Object.assign({},body,{first_frame_image:body.first_frame_image?String(body.first_frame_image).slice(0,40):undefined}):body,q:u.search});
   if(key!=='mm-good-key')return J(200,{base_resp:{status_code:1004,status_msg:'login fail'}});
   if(u.pathname==='/v1/get_voice')return J(200,{system_voice:[{voice_id:'Wise_Woman',voice_name:'Wise Woman'}],base_resp:{status_code:0,status_msg:'success'}});
   if(u.pathname==='/v1/image_generation')return J(200,{data:{image_urls:['http://localhost:'+P+'/img.jpeg']},base_resp:{status_code:0,status_msg:'success'}});
   if(u.pathname==='/v1/video_generation'){const id='mmv'+(++n);task[id]={fail:/FAILME/.test(body.prompt||''),polls:0};return J(200,{task_id:id,base_resp:{status_code:0,status_msg:'success'}})}
   if(u.pathname==='/v1/query/video_generation'){const t=task[u.searchParams.get('task_id')]||{};t.polls=(t.polls||0)+1;
     if(t.fail)return J(200,{task_id:u.searchParams.get('task_id'),status:'Fail',error_message:'the picture breaks the content rules',base_resp:{status_code:0,status_msg:'success'}});
     if(t.polls<2)return J(200,{status:'Processing',base_resp:{status_code:0,status_msg:'success'}});
     return J(200,{status:'Success',file_id:'f-'+u.searchParams.get('task_id'),base_resp:{status_code:0,status_msg:'success'}})}
   return J(200,{file:{file_id:u.searchParams.get('file_id'),download_url:'http://localhost:'+P+'/vid.webm'},base_resp:{status_code:0,status_msg:'success'}})}
 // the stand-in AI engine: its balance empty (402 for Kling, a 500 with the same words for the others) or full
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){st.kie.push({model:body.model});
   if(!st.kieBal){const m='Credits insufficient : Your current balance isn’t enough to run this request. Please top up to continue.';return J(200,{code:/kling/.test(body.model||'')?402:500,msg:m})}
   const id='t'+(++n);task[id]=body.model;return J(200,{code:200,msg:'success',data:{taskId:id}})}
 if(/record-?[iI]nfo/.test(u.pathname)){const url='http://localhost:'+P+'/vid.webm';return J(200,{code:200,msg:'success',data:{state:'success',successFlag:1,response:{resultUrls:[url]},resultJson:JSON.stringify({resultUrls:[url]})}})}
 if(/chat\/credit/.test(u.pathname))return J(200,{code:200,msg:'success',data:st.kieBal?1000:0});
 J(404,{})})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
mk = subprocess.Popen(["node", D + "/mock.js", str(MP), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_", "MINIMAX_", "TTS_", "MUSIC_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false",
  KIE_API_KEY="kk", KIE_BASE_URL=M, MIRROR_MEDIA="false", NV_AUTOCHECK="false", LONG_FAST="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))

def api(p, body=None, method=None, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=60).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def stats(): return json.loads(urllib.request.urlopen(M + "/stats", timeout=10).read())
def wait_job(jid, tok=None, secs=90):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        c, j = api("/v1/jobs/" + jid, tok=tok)
        if j.get("status") in ("done", "failed"): return j
        time.sleep(0.4)
    return j
def bal(): return api("/v1/billing", tok=TOKEN)[1].get("credits")
def mm(path): return [x for x in stats()["mm"] if x["p"] == path]
def make(body):
    c, j = api("/v1/jobs", dict({"kind": "video", "dur": 5, "aspect": "16:9"}, **body), tok=TOKEN)
    if c != 200 or not j.get("id"): fails.append(f"job not made {body} {c} {j}"); return {}
    return wait_job(j["id"], TOKEN)
PICK = lambda j: {k: j.get(k) for k in ("status", "url", "madeBy", "error", "cost")}

def server_part():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    ok(api("/v1/admin/providers/minimax", {"apiKey": "mm-good-key", "baseUrl": M}, method="PUT")[0] == 200, "saving the MiniMax key failed")
    cfg = api("/v1/config")[1].get("providers", {}).get("minimax183"); out["cfg"] = cfg
    ok(cfg == {"voice": True, "image": True, "music": True, "video": True}, f"with the key, videos are on too: {cfg}")
    ok(api("/v1/admin/minimax183")[1].get("video") is True, "Admin should show Videos on")
    # 1. the engine's balance is empty: Kling 2.6 from a picture → MiniMax Hailuo makes it
    k0, b0 = len(stats()["kie"]), bal()
    j = make({"model": "kling26", "prompt": "Elias walks in this field and the house behind him, v185 one", "inputs": {"startImage": "/media/field.jpeg"}}); out["kling_moved"] = PICK(j)
    v = (mm("/v1/video_generation") or [{}])[-1].get("body", {}); out["mm_video"] = v
    ok(j.get("status") == "done" and j.get("url") == M + "/vid.webm", f"the video should be made by MiniMax: {PICK(j)}")
    ok(v.get("model") == "MiniMax-Hailuo-2.3" and v.get("duration") == 6 and v.get("resolution") == "768P" and str(v.get("first_frame_image") or "").startswith("data:image/jpeg;base64,") and "Elias" in (v.get("prompt") or ""),
       f"MiniMax should get Hailuo 2.3, 6 s, 768P, the picture as its bytes and the words: {v}")
    ok(len(stats()["kie"]) - k0 == 1, f"the empty engine should be asked once, not on every model: {stats()['kie'][k0:]}")
    ok(j.get("madeBy") == ["hailuo"], f"the card should say MiniMax made it: {j.get('madeBy')}")
    paid = b0 - bal(); out["paid"] = [paid, j.get("cost")]; ok(paid > 0 and paid == j.get("cost"), f"the customer pays what was asked, once: {paid} vs {j.get('cost')}")
    me = api("/v1/me")[1]; out["alerts"] = me.get("alerts138"); ok((me.get("alerts138") or {}).get("engine", {}).get("type") == "quota", f"staff should be told the engine is out of credits: {me.get('alerts138')}")
    # 2. tall, 10 s, no picture → a 9:16 first frame from image-01, then Hailuo 10 s from it
    n_img = len(mm("/v1/image_generation"))
    j = make({"model": "seedance20", "prompt": "a lantern festival over the river, v185 two", "aspect": "9:16", "dur": 10}); out["tall"] = PICK(j)
    im = mm("/v1/image_generation")[n_img:]; v = (mm("/v1/video_generation") or [{}])[-1].get("body", {})
    ok(j.get("status") == "done" and len(im) == 1 and im[0]["body"].get("aspect_ratio") == "9:16" and v.get("duration") == 10 and v.get("resolution") == "768P" and v.get("first_frame_image") == M + "/img.jpeg",
       f"a tall video should start from a 9:16 first frame: {out['tall']} {[x['body'].get('aspect_ratio') for x in im]} {v}")
    # 3. MiniMax picked by hand → MiniMax at once, the engine never asked
    k1 = len(stats()["kie"]); j = make({"model": "hailuo", "prompt": "waves on black rocks at dusk, v185 three"}); out["picked"] = PICK(j)
    ok(j.get("status") == "done" and len(stats()["kie"]) == k1 and "madeBy" not in j, f"MiniMax picked → MiniMax only: {PICK(j)} {stats()['kie'][k1:]}")
    # 4. a picture on the empty engine → MiniMax Image-01
    n_img = len(mm("/v1/image_generation")); c, j = api("/v1/jobs", {"kind": "image", "model": "nano", "prompt": "a red bicycle by a blue door, v185 four", "aspect": "1:1"}, tok=TOKEN)
    j = wait_job(j.get("id", ""), TOKEN); out["image"] = PICK(j)
    ok(j.get("status") == "done" and len(mm("/v1/image_generation")) == n_img + 1 and j.get("madeBy") == ["mmimage"], f"the picture should be made by MiniMax Image-01: {PICK(j)}")
    # 5. MiniMax can't make it → fails with its reason, credits back
    b0 = bal(); j = make({"model": "kling26", "prompt": "FAILME a stormy harbour, v185 five"}); out["mm_fail"] = PICK(j)
    time.sleep(0.5); ok(j.get("status") == "failed" and bal() == b0 and "content rules" in (j.get("error") or ""), f"MiniMax's failure → failed with its reason, credits back: {PICK(j)} {b0}→{bal()}")
    # 6. Videos off → the calm message, credits back, MiniMax not asked
    ok(api("/v1/admin/minimax183", {"video": False}, method="PUT")[1].get("video") is False, "switching videos off failed")
    n_v, k2, b0 = len(mm("/v1/video_generation")), len(stats()["kie"]), bal()
    j = make({"model": "kling26", "prompt": "a quiet library at night, v185 six"}); out["off"] = PICK(j)
    time.sleep(0.5); ok(j.get("status") == "failed" and "can't take new work" in (j.get("error") or "") and bal() == b0 and len(mm("/v1/video_generation")) == n_v and len(stats()["kie"]) - k2 == 1,
       f"Videos off → fails calmly, credits back, MiniMax not asked, the engine once: {PICK(j)} {stats()['kie'][k2:]}")
    ok(api("/v1/config")[1]["providers"]["minimax183"]["video"] is False, "config should follow the Videos switch")
    api("/v1/admin/minimax183", {"video": True}, method="PUT")
    # 7. the engine has credits again → Kling 2.6 on the engine, MiniMax not asked
    urllib.request.urlopen(M + "/kiebal?to=1", timeout=5); n_v = len(mm("/v1/video_generation"))
    j = make({"model": "kling26", "prompt": "a cyclist on a mountain road, v185 seven"}); out["kie_back"] = PICK(j)
    ok(j.get("status") == "done" and len(mm("/v1/video_generation")) == n_v and "madeBy" not in j, f"with credits the engine makes it again: {PICK(j)}")
    urllib.request.urlopen(M + "/kiebal?to=0", timeout=5)

async def page_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=S.user||{{name:'Owner',method:'email',contact:'owner@nooi.ai'}};persist();S.admTab='models';go('admin')}}")
        await pg.wait_for_function("!!document.querySelector('.aiprow[data-k=\"minimax\"]')", timeout=20000)
        await pg.click('.aiprow[data-k="minimax"] .aiphead')
        await pg.wait_for_function("!!document.querySelector('[data-act=\"mm183-use\"][data-k=\"video\"]')", timeout=20000)
        v = await E("""()=>{const c=document.getElementById('mm183p'),W=innerWidth,row=document.querySelector('.aiprow[data-k="minimax"]');return {sw:[...c.querySelectorAll('[data-act="mm183-use"]')].map(b=>b.dataset.k+':'+b.getAttribute('aria-checked')),
          models:[...c.querySelectorAll('[data-mm183]')].map(i=>i.dataset.mm183),head:row.querySelector('.aiphead').innerText,text:c.innerText,
          wide:[...c.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>W+1||b.left<-1)}).length}}""")
        out[tag] = {k: v[k] for k in ("sw", "models", "wide")}
        ok(v["sw"] == ["voice:true", "image:true", "music:true", "video:true"] and v["models"] == ["speechModel", "imageModel", "musicModel", "videoModel"] and not v["wide"], f"{tag}: the MiniMax row should have the Videos switch and the video model: {out[tag]}")
        ok(("فيديو" in v["head"] and "Hailuo 2.3" in v["text"]) if ar else ("videos" in v["head"] and "Hailuo 2.3" in v["text"]), f"{tag}: the row should say MiniMax makes videos (Hailuo 2.3): {v['head']}")
        await pg.screenshot(path=D + f"/{tag}.png")
        await pg.click('[data-act="mm183-use"][data-k="video"]'); await pg.wait_for_function("API.cfg.providers.minimax183.video===false", timeout=15000)
        await E("()=>{S.admTab='models';go('admin')}"); await pg.wait_for_function("!!document.querySelector('[data-act=\"mm183-use\"][data-k=\"video\"]')", timeout=15000)
        ok(await E("()=>document.querySelector('[data-act=\"mm183-use\"][data-k=\"video\"]').getAttribute('aria-checked')") == "false", f"{tag}: Videos off should show off")
        await pg.click('[data-act="mm183-use"][data-k="video"]'); await pg.wait_for_function("API.cfg.providers.minimax183.video===true", timeout=15000)
        ok(not errs, f"{tag}: page errors {errs[:3]}")
    finally:
        await br.close()

async def pages():
    async with async_playwright() as p:
        await page_part(p, True, "en")
        await page_part(p, False, "ar")

try:
    server_part()
    asyncio.run(pages())
finally:
    srv.terminate(); srv.wait(); mk.terminate(); mk.wait()
print(json.dumps(out, ensure_ascii=False, indent=1)[:4000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + "/server.log").read()[-2500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v185 OK")
