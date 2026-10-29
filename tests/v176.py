# v176 — NVIDIA: Cosmos 3 for video, and a free check of every NVIDIA engine. A real nooi server with a stand-in NVIDIA whose
# engines answer as NVIDIA does (Cosmos 3 Nano: 422 to an empty request, b64_video VP9-in-MP4 to a real one, 202 + a request id
# for a picture-to-video; FLUX.1: 404 "Not found for account"; SD 3.5: open; FLUX Kontext: 401; TRELLIS: 500; Cosmos 3 Super: open):
#  · Admin's check sends each engine an empty request only (nothing made): video open, FLUX closed, SD 3.5 open, edits "key
#    refused", 3D error, Cosmos 3 Super open; the closed FLUX is marked (config nvDown.image, nooi Auto's pictures off)
#  · NVIDIA FLUX.1 picked by hand → refused at once (409, its name, Arabic), nothing charged, NVIDIA not asked
#  · Cosmos 3 from words: model_mode text2video, prompt, resolution 720_16_9, 121 frames at 24 fps, no picture → the video comes
#    back made H.264 (plays on every phone); from a picture (9:16): image2video with the picture as a data URL, 720_9_16, NVIDIA's
#    202 + request id followed until done
#  · SD 3.5 still makes pictures
#  · a Video URL saved for the retired Cosmos Predict 1 is read as Cosmos 3 Nano
#  · Cosmos 3 Nano closed → the check marks video closed and offers Cosmos 3 Super; Cosmos picked by hand is refused at once
#  · the page (phone English, computer Arabic): Admin → AI providers → NVIDIA AI → "Check NVIDIA engines" lists each engine and
#    its state in the reader's language, offers "Use Cosmos 3 Super for video", which saves it; FLUX.1's line in the picture
#    engine list says it isn't open; nothing wider than the screen
# Run: python3 tests/v176.py
import asyncio, base64, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8550, 8551; B = f"http://localhost:{PORT}"; M = f"http://localhost:{MP}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v176-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "n" * 32; now = int(time.time() * 1000)
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": now},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
# what NVIDIA's Cosmos 3 sends: VP9 in an MP4 box; a picture for picture-to-video
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "1", "-c:v", "libvpx-vp9", "-b:v", "200k", "-f", "mp4", D + "/vp9.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=360x640", "-frames:v", "1", D + "/pic.png"], check=True)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={calls:[],nanoClosed:false};let n=0;const pend={};
const VID=fs.readFileSync(path.join(DIR,'vp9.mp4')).toString('base64'),PNG=fs.readFileSync(path.join(DIR,'pic.png')).toString('base64');
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x'),J=(code,d,h)=>{s.statusCode=code;s.setHeader('content-type','application/json');for(const k in h||{})s.setHeader(k,h[k]);s.end(JSON.stringify(d))};
 if(u.pathname==='/stats')return J(200,st);
 if(u.pathname==='/close-nano'){st.nanoClosed=true;return J(200,{})}
 if(u.pathname==='/pic.png'){s.setHeader('content-type','image/png');return s.end(fs.readFileSync(path.join(DIR,'pic.png')))}
 let body={};try{body=JSON.parse(b||'{}')}catch{}const empty=!Object.keys(body).length;
 if(q.method==='GET'&&/^\/status\//.test(u.pathname)){const id=u.pathname.split('/').pop();st.calls.push({p:'status',id});if(!pend[id])return J(404,{detail:'no such request'});if(pend[id].n++<1){s.statusCode=202;s.setHeader('nvcf-reqid',id);return s.end()}return J(200,{b64_video:VID})}
 if(q.method!=='POST')return J(404,{});
 st.calls.push({p:u.pathname,empty,auth:q.headers.authorization||'',body:empty?null:Object.fromEntries(Object.entries(body).map(([k,v])=>[k,k==='input_reference'?String(v).slice(0,40)+'…'+String(v).length:v]))});
 const NF=()=>J(404,{status:404,title:'Not Found',detail:"Function 'f-"+u.pathname.split('/').pop()+"': Not found for account 'acct-test'"});
 if(/cosmos3-nano$/.test(u.pathname)){if(st.nanoClosed)return NF();if(empty||!body.model_mode)return J(422,{detail:[{loc:['body','model_mode'],msg:'Field required'}]});
   if(!body.prompt||!/^720_(16_9|9_16|1_1|4_3|3_4)$/.test(body.resolution||'')||!(body.num_frames>=25&&body.num_frames<=197))return J(422,{detail:'bad request '+JSON.stringify(body).slice(0,200)});
   if(body.model_mode==='image2video'){if(!/^data:image\/(png|jpeg|webp);base64,/.test(body.input_reference||''))return J(422,{detail:'input_reference must be an image'});const id='req-'+(++n);pend[id]={n:0};s.statusCode=202;s.setHeader('NVCF-REQID',id);return s.end()}
   if(body.model_mode!=='text2video'||body.input_reference)return J(422,{detail:'mode mismatch'});return J(200,{b64_video:VID})}
 if(/cosmos3-super$/.test(u.pathname))return empty?J(422,{detail:'model_mode is required'}):J(200,{b64_video:VID});
 if(/flux-closed$/.test(u.pathname))return NF();
 if(/sd35$/.test(u.pathname))return empty?J(422,{detail:'prompt is required'}):J(200,{artifacts:[{base64:PNG,finishReason:'SUCCESS',seed:1}]});
 if(/kontext$/.test(u.pathname))return J(401,{detail:'Unauthorized'});
 if(/trellis$/.test(u.pathname))return J(500,{detail:'Internal error'});
 J(404,{})})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
mk = subprocess.Popen(["node", D + "/mock.js", str(MP), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false",
  NVIDIA_API_KEY="test-nv-key", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))

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
        time.sleep(0.5)
    return j
credits = lambda: api("/v1/billing", tok=TOKEN)[1].get("credits")
def codec(url):
    f = D + "/got.mp4"; urllib.request.urlretrieve(url if url.startswith("http") else B + url, f)
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "default=nw=1:nk=1", f], capture_output=True, text=True)
    return r.stdout.strip()
STATES = lambda r: {e["task"]: e["state"] for e in r.get("engines", [])}
PROV = {"videoUrl": M + "/v1/cosmos/nvidia/cosmos3-nano", "imageUrl": M + "/v1/genai/bfl/flux-closed", "image2Url": M + "/v1/genai/stabilityai/sd35", "editUrl": M + "/v1/genai/bfl/kontext",
  "trellisUrl": M + "/v1/genai/microsoft/trellis", "statusUrl": M + "/status/", "use": "video:on image:on edit:on 3d:on"}

def server_part():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: time.sleep(0.25)
    c, _ = api("/v1/admin/providers/nvidia", PROV, "PUT"); ok(c == 200, f"NVIDIA set up (stand-in) {c}")
    # 1. the free check
    n0 = len(stats()["calls"]); c, r = api("/v1/admin/nvidia/check", {}); calls = stats()["calls"][n0:]; out["check"] = {"states": STATES(r), "statuses": {e["task"]: e["status"] for e in r.get("engines", [])}}
    ok(c == 200 and STATES(r) == {"video": "open", "image": "closed", "image2": "open", "edit": "key", "3d": "error", "video-alt": "open"}, f"the check: each engine's state {out['check']}")
    ok(len(calls) == 6 and all(x["empty"] and x["auth"] == "Bearer test-nv-key" for x in calls), f"the check sent empty requests only (nothing made) {calls}")
    ok("suggest" not in r, f"no suggestion while Cosmos 3 Nano is open {r.get('suggest')}")
    cfg = api("/v1/config")[1].get("providers", {}); out["cfg"] = {"nvDown": cfg.get("nvDown"), "nvUse": cfg.get("nvUse")}
    ok(cfg.get("nvDown") == {"image": True} and (cfg.get("nvUse") or {}).get("image") is False, f"FLUX marked closed: nooi Auto's NVIDIA pictures off {out['cfg']}")
    c, r = api("/v1/admin/nvidia/check", {}, tok=TOKEN); ok(c in (401, 403), f"a customer can't run the check {c}")
    # 2. FLUX picked by hand → refused at once
    cr0, n0 = credits(), len(stats()["calls"])
    c, j = api("/v1/jobs", {"kind": "image", "model": "nvflux", "prompt": "a red bicycle by a canal", "aspect": "1:1"}, tok=TOKEN); out["flux_hand"] = {"code": c, "error": j.get("error"), "errorAr": j.get("errorAr")}
    ok(c == 409 and "NVIDIA FLUX.1 isn't open to this site right now" in (j.get("error") or "") and "NVIDIA FLUX.1 غير متاح" in (j.get("errorAr") or ""), f"FLUX picked by hand → refused at once, in Arabic too {out['flux_hand']}")
    time.sleep(0.4); ok(credits() == cr0 and len(stats()["calls"]) == n0, f"nothing charged, NVIDIA not asked {cr0}→{credits()}")
    # 3. Cosmos 3 from words
    n0 = len(stats()["calls"]); c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a robot arm stacks three red blocks on a table", "dur": 5, "aspect": "16:9"}, tok=TOKEN)
    j = wait_job(j.get("id", "x"), TOKEN); sent = [x for x in stats()["calls"][n0:] if x["p"].endswith("cosmos3-nano")]; out["t2v"] = {"status": j.get("status"), "error": j.get("error"), "sent": sent[:1]}
    b = (sent[0]["body"] if sent else None) or {}
    ok(j.get("status") == "done" and b.get("model_mode") == "text2video" and "robot arm" in (b.get("prompt") or "") and b.get("resolution") == "720_16_9" and b.get("num_frames") == 121 and b.get("fps") == 24 and "input_reference" not in b,
       f"Cosmos 3 from words: the request NVIDIA documents {out['t2v']}")
    if j.get("url"): cd = codec(j["url"]); out["t2v_codec"] = cd; ok(cd == "h264", f"the VP9 video comes back H.264 (plays on every phone) {cd}")
    # 4. from a picture, 9:16, NVIDIA answers 202 and a request id
    n0 = len(stats()["calls"]); c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "the robot turns its head and waves", "dur": 5, "aspect": "9:16", "inputs": {"startImage": M + "/pic.png"}}, tok=TOKEN)
    j = wait_job(j.get("id", "x"), TOKEN); cl = stats()["calls"][n0:]; sent = [x for x in cl if x["p"].endswith("cosmos3-nano")]; out["i2v"] = {"status": j.get("status"), "error": j.get("error"), "sent": sent[:1], "polled": sum(1 for x in cl if x["p"] == "status")}
    b = (sent[0]["body"] if sent else None) or {}
    ok(j.get("status") == "done" and b.get("model_mode") == "image2video" and str(b.get("input_reference", "")).startswith("data:image/png;base64,") and b.get("resolution") == "720_9_16" and out["i2v"]["polled"] >= 2,
       f"Cosmos 3 from a picture: image2video, the picture as a data URL, 9:16, NVIDIA's request id followed {out['i2v']}")
    # 5. SD 3.5 still makes pictures
    c, j = api("/v1/jobs", {"kind": "image", "model": "nvsd35", "prompt": "a lighthouse at dusk", "aspect": "1:1"}, tok=TOKEN); j = wait_job(j.get("id", "x"), TOKEN); out["sd35"] = {"status": j.get("status"), "error": j.get("error")}
    ok(j.get("status") == "done" and (j.get("url") or "").endswith(".png"), f"SD 3.5 makes pictures {out['sd35']}")
    # 6. a Video URL saved for the retired Cosmos Predict 1 → read as Cosmos 3 Nano
    api("/v1/admin/providers/nvidia", {"videoUrl": "https://ai.api.nvidia.com/v1/cosmos/nvidia/cosmos-predict1-7b"}, "PUT")
    c, r = api("/v1/admin/nvidia/check", {}); v = [e for e in r.get("engines", []) if e["task"] == "video"]
    ok(v and v[0]["url"] == "https://ai.api.nvidia.com/v1/cosmos/nvidia/cosmos3-nano", f"the retired Cosmos Predict 1 URL is read as Cosmos 3 Nano {v[:1]}")
    api("/v1/admin/providers/nvidia", {"videoUrl": PROV["videoUrl"]}, "PUT")
    # 7. Cosmos 3 Nano closed → marked, Super offered, Cosmos picked by hand refused at once
    urllib.request.urlopen(M + "/close-nano", timeout=5)
    c, r = api("/v1/admin/nvidia/check", {}); out["closed"] = {"states": STATES(r), "suggest": r.get("suggest")}
    ok(STATES(r).get("video") == "closed" and (r.get("suggest") or {}).get("videoUrl") == M + "/v1/cosmos/nvidia/cosmos3-super", f"Nano closed → Super offered {out['closed']}")
    cfg = api("/v1/config")[1].get("providers", {}); ok((cfg.get("nvDown") or {}).get("video") is True, f"video marked closed {cfg.get('nvDown')}")
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a robot arm", "dur": 5, "aspect": "16:9"}, tok=TOKEN)
    ok(c == 409 and "NVIDIA Cosmos isn't open" in (j.get("error") or ""), f"Cosmos picked by hand → refused at once {c} {j}")

async def run(p, phone, lang):
    tag = f"{'phone' if phone else 'desk'} {lang}"; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate; R = {}
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}", lang)
    # the picture engine list: FLUX.1's line says it isn't open
    await E("()=>{S.hf.tab='image';go('home');renderAll()}"); await pg.wait_for_timeout(500)
    sh = await E("""async()=>{const b=document.querySelector('.hfmi.eng171');if(!b)return'no chip';b.click();await new Promise(r=>setTimeout(r,400));const f=document.querySelector('#modalRoot .hfmodel[data-v="nvflux"]'),s=document.querySelector('#modalRoot .hfmodel[data-v="nvsd35"]');
      const r={flux:f&&{off:f.classList.contains('off173'),txt:(f.querySelector('.nm small')||{}).textContent||''},sd:s&&s.classList.contains('off173')};closeSheet();return r}""")
    R["sheet"] = sh; ok(isinstance(sh, dict) and sh["flux"] and sh["flux"]["off"] and ("غير متاح لهذا الموقع" in sh["flux"]["txt"] if ar else "Not open to this site right now" in sh["flux"]["txt"]) and not sh["sd"], f"{tag}: FLUX.1's line says it isn't open, SD 3.5's doesn't {sh}")
    # Admin → AI providers → NVIDIA AI → Check NVIDIA engines
    await E("()=>{S.admTab='models';go('admin');renderAll()}"); await pg.wait_for_function("document.querySelector('#nvchk176 [data-act=\"nv176-check\"]')", timeout=15000)
    await E("()=>{const b=document.querySelector('#nvchk176 [data-act=\"nv176-check\"]');b.scrollIntoView();b.click()}")
    await pg.wait_for_function("document.querySelectorAll('#nvchk176 .nvrow176').length>=5", timeout=30000)
    a = await E("""()=>{const w=document.getElementById('nvchk176'),card=w.closest('.provc');return{rows:[...w.querySelectorAll('.nvrow176')].map(r=>[r.dataset.task,r.className.replace('nvrow176','').trim(),r.querySelector('span').textContent]),
      inCard:!!(card&&card.querySelector('[data-pv="nvidia"]')),use:!!w.querySelector('[data-act="nv176-use"]'),useTxt:(w.querySelector('[data-act="nv176-use"]')||{}).textContent||'',wide:document.documentElement.scrollWidth<=innerWidth+1,
      fit:[...w.querySelectorAll('.nvrow176')].every(r=>r.getBoundingClientRect().right<=w.getBoundingClientRect().right+1)}}""")
    R["admin"] = a; rows = {x[0]: x for x in a["rows"]}
    ok(a["inCard"] and rows.get("video", [0, ""])[1] == "bad" and rows.get("image", [0, ""])[1] == "bad" and rows.get("image2", [0, ""])[1] == "ok" and rows.get("video-alt", [0, ""])[1] == "ok",
       f"{tag}: the NVIDIA card lists each engine and its state {a['rows']}")
    words = (["غير متاح لهذا المفتاح", "متاح لهذا المفتاح", "المفتاح مرفوض"] if ar else ["Not open to this key", "Open to this key", "Key refused"])
    ok(words[0] in rows["image"][2] and words[1] in rows["image2"][2] and words[2] in rows.get("edit", [0, 0, ""])[2], f"{tag}: states in the reader's language {a['rows']}")
    ok(a["use"] and ("Cosmos 3 Super" in a["useTxt"]) and a["wide"] and a["fit"], f"{tag}: offers Cosmos 3 Super, nothing wider than the screen {a['use']} {a['useTxt']} {a['wide']} {a['fit']}")
    if not phone:
        await E("()=>document.querySelector('#nvchk176 [data-act=\"nv176-use\"]').click()"); await pg.wait_for_timeout(1200)
        c2, r2 = api("/v1/admin/nvidia/check", {}); v = [e for e in r2.get("engines", []) if e["task"] == "video"]
        R["used"] = v[:1]; ok(v and v[0]["url"].endswith("/cosmos3-super") and v[0]["state"] == "open", f"{tag}: Use Cosmos 3 Super saved it, and it's open {v[:1]}")
        cfg = api("/v1/config")[1].get("providers", {}); ok(not (cfg.get("nvDown") or {}).get("video"), f"{tag}: video open again {cfg.get('nvDown')}")
    out[tag] = R; ok(not errs, f"{tag}: page errors {errs}"); await br.close()

async def main():
    async with async_playwright() as p:
        for phone, lang in ((True, "en"), (False, "ar")):
            try: await run(p, phone, lang)
            except Exception as e: fails.append(f"{'phone' if phone else 'desk'} {lang} crashed: {e!r}"[:400])
try:
    server_part()
    asyncio.run(main())
except Exception as e: fails.append(f"crashed: {e!r}"[:400])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1)[:9000])
if fails: print(open(D + "/server.log").read()[-1500:])
shutil.rmtree(D, ignore_errors=True)
print("v176 ok" if not fails else f"FAILED {len(fails)}"); sys.exit(1 if fails else 0)
