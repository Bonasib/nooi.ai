# v175 — a card names the engine that really made the video. A real nooi server with a stand-in NVIDIA (its Cosmos answers 404
# "Not found for account") and a stand-in second engine (its WAN 2.7 fails on its side):
#  · a shot the agents gave to NVIDIA Cosmos → made on the site's other engine (Kling 3.0) → the job says madeWith "kling30";
#    the same for nooi Auto's Cosmos; a Cosmos that NVIDIA really made, or an engine that made its own shot, says nothing
#  · WAN 2.7 failed on the engine and the job moved to Kling 2.6 → madeWith "kling26"
#  · the job list no longer shows the engine's details (via / detail) to customers — map(publicJob) passed the index as "staff";
#    the owner still sees them
#  · the page (phone English, computer Arabic): a card the agents planned for NVIDIA Cosmos turns to "Kling 3.0" with Kling's
#    logo after the page asks the server (one job, and the list), the open view says why (planned engine, made with, the same
#    price), "Make it again" uses Kling 3.0, a card with nothing moved is unchanged, nothing wider than the screen
# Run: python3 tests/v175.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8540, 8541; B = f"http://localhost:{PORT}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v175-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "q" * 32; now = int(time.time() * 1000)
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": now},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "2", "-c:v", "libvpx-vp9", "-b:v", "300k", D + "/vid.webm"], check=True)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={nv:[],kie:[]},task={};let n=0;
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');s.setHeader('connection','close');
 const send=(d,code=200,msg='success')=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code,msg,data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(u.pathname==='/vid.webm'){s.setHeader('content-type','video/webm');return s.end(fs.readFileSync(path.join(DIR,'vid.webm')))}
 if(/^\/cosmos/.test(u.pathname)){st.nv.push(u.pathname);s.statusCode=404;s.setHeader('content-type','application/json');
   return s.end(JSON.stringify({status:404,title:'Not Found',detail:"Function '01327741-test-fn': Not found for account 'acct-test'"}))}
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){let j={};try{j=JSON.parse(b||'{}')}catch{}const id='t'+(++n);task[id]=j.model;st.kie.push({path:u.pathname,model:j.model});return send({taskId:id})}
 if(/record-?[iI]nfo/.test(u.pathname)){const id=u.searchParams.get('taskId'),url='http://localhost:'+P+'/vid.webm';
   if(/^wan\//.test(task[id]||''))return send({state:'fail',failMsg:'internal error',failCode:'500'});
   return send({state:'success',successFlag:1,response:{resultUrls:[url]},resultJson:JSON.stringify({resultUrls:[url]})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
mk = subprocess.Popen(["node", D + "/mock.js", str(MP), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false",
  NVIDIA_API_KEY="test-nv-key", KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{MP}", KIE_VIDEO_MODEL="kling-3.0/video", MIRROR_MEDIA="false", MC_AGAIN_MS="200", PART_AGAIN_MS="200"),
  stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))

def api(p, body=None, method=None, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=30).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{MP}/stats", timeout=10).read())
def wait_job(jid, tok=None, secs=60):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        c, j = api("/v1/jobs/" + jid, tok=tok)
        if j.get("status") in ("done", "failed"): return j
        time.sleep(0.4)
    return j
def make(body, tok=None):
    c, j = api("/v1/jobs", dict({"kind": "video", "prompt": "soldiers walk through a misty forest at dawn", "dur": 5, "aspect": "16:9"}, **body), tok=tok)
    if c != 200 or not j.get("id"): fails.append(f"job not made {body} {c} {j}"); return {}
    return wait_job(j["id"], tok)
PICK = lambda j: {k: j.get(k) for k in ("id", "status", "madeWith", "via", "detail", "error")}

def server_part():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: time.sleep(0.25)
    c, _ = api("/v1/admin/providers/nvidia", {"videoUrl": f"http://localhost:{MP}/cosmos", "use": "video:on image:off edit:off 3d:off"}, "PUT"); ok(c == 200, f"NVIDIA set up (stand-in) {c}")
    k0 = len(stats()["kie"])
    # 1. a shot the agents gave to NVIDIA Cosmos (customer) → made on Kling 3.0 → madeWith kling30, no engine details
    a = make({"model": "nvcosmos", "meta": {"studio": True, "auto": True}}, TOKEN); out["agents_cosmos"] = PICK(a)
    ok(a.get("status") == "done" and a.get("madeWith") == "kling30", f"the agents' Cosmos shot made on Kling 3.0 says so {out['agents_cosmos']}")
    ok("via" not in a and "detail" not in a, f"the customer doesn't see the engine's details {list(a)}")
    ok([x["model"] for x in stats()["kie"][k0:]] == ["kling-3.0/video"], f"the other engine was Kling 3.0 {stats()['kie'][k0:]}")
    # 2. WAN 2.7 failed on the engine → Kling 2.6 made it → madeWith kling26
    w = make({"model": "wan27"}, TOKEN); out["wan_moved"] = PICK(w); out["wan_sent"] = [x["model"] for x in stats()["kie"][k0 + 1:]]
    ok(w.get("status") == "done" and w.get("madeWith") == "kling26", f"WAN 2.7 failed, Kling 2.6 made it → says Kling 2.6 {out['wan_moved']} {out['wan_sent']}")
    # 3. an engine that made its own shot → nothing
    k = make({"model": "kling30"}, TOKEN); out["kling_own"] = PICK(k)
    ok(k.get("status") == "done" and "madeWith" not in k, f"Kling 3.0 that made its own shot → no madeWith {out['kling_own']}")
    # 4. the job list: madeWith carried, and no engine details for the customer on any row (the 2nd row and later leaked before)
    c, L = api("/v1/jobs", tok=TOKEN); rows = {x["id"]: x for x in L.get("jobs", [])}; out["list"] = {i: {"madeWith": x.get("madeWith"), "via": "via" in x, "detail": "detail" in x} for i, x in rows.items()}
    ok(len(rows) == 3 and rows.get(a.get("id"), {}).get("madeWith") == "kling30" and rows.get(w.get("id"), {}).get("madeWith") == "kling26" and "madeWith" not in rows.get(k.get("id"), {}), f"the list carries madeWith {out['list']}")
    ok(all("via" not in x and "detail" not in x and "times" not in x for x in rows.values()), f"no engine details for the customer on any row of the list {out['list']}")
    # 5. the owner: the planned Cosmos shot and a plain one (for the page), and the owner still sees the details
    lo = make({"model": "nvcosmos", "meta": {"studio": True}}); lk = make({"model": "kling30"})
    c, L2 = api("/v1/jobs"); rows2 = L2.get("jobs", [])
    ok(lo.get("madeWith") == "kling30" and len(rows2) == 2 and all("via" in x for x in rows2), f"the owner sees madeWith and the details on every row {PICK(lo)} {[x.get('via') for x in rows2]}")
    return lo, lk

async def run(p, phone, lang, lo, lk):
    tag = f"{'phone' if phone else 'desk'} {lang}"; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append((str(e)[:200] + " @ " + (getattr(e, "stack", "") or "")[:600]) if os.environ.get("V175_DEBUG") else str(e)[:300])); E = pg.evaluate; R = {}
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;go('home');renderAll()}", lang)
    await pg.wait_for_timeout(500)
    # the page's own record of the two jobs: the agents planned NVIDIA Cosmos for one, Kling 3.0 for the other
    await E("""([a,b])=>{const mk=(r,m,t)=>({id:'p'+r,remote:r,kind:'video',model:m,status:'complete',prompt:t,title:t,dur:5,aspect:'16:9',cost:20,created:Date.now(),url:'/vid.webm',seed:7,pal:PALS[0]});
      S.jobs=S.jobs.filter(j=>!['p'+a,'p'+b].includes(j.id));S.jobs.push(mk(a,'nvcosmos','soldiers walk through a misty forest at dawn'),mk(b,'kling30','soldiers rest by a fire'))}""", [lo["id"], lk["id"]])
    before = await E("(a)=>{const j=S.jobs.find(x=>x.remote===a);return{m:j.model,card:card98(j,0).includes('NVIDIA Cosmos')}}", lo["id"]); R["before"] = before
    ok(before["m"] == "nvcosmos" and before["card"], f"{tag}: before, the card says NVIDIA Cosmos {before}")
    # one job asked → the card turns to Kling 3.0
    await E("(a)=>API.req('/v1/jobs/'+a)", lo["id"]); await pg.wait_for_timeout(300)
    one = await E("""(a)=>{const j=S.jobs.find(x=>x.remote===a),c=card98(j,0),h=hfrCard(j),pv=previewCol(j,[]);
      const hn=h.replace(/ title="[^"]*"/g,"");
      return{m:j.model,asked:j.asked175,card:c.includes('Kling 3.0')&&!c.includes('NVIDIA Cosmos'),hf:hn.includes('Kling 3.0')&&!hn.includes('NVIDIA Cosmos')&&/title="[^"]*NVIDIA Cosmos/.test(h),
        logo:logoFor(j.model)===logoFor('kling30')&&logoFor(j.model)!==LOGO_SRC.nvidia,note:(/<p class="small mute note175"[^>]*>([\\s\\S]*?)<\\/p>/.exec(pv)||[])[1]||''}}""", lo["id"])
    R["one"] = {k: v for k, v in one.items() if k != "note"}; R["note"] = one["note"][-220:]
    ok(one["m"] == "kling30" and one["asked"] == "nvcosmos" and one["card"] and one["hf"] and one["logo"], f"{tag}: after asking the server, the card says Kling 3.0 with Kling's logo {R['one']}")
    want = ["صُنع بـ Kling 3.0", "NVIDIA Cosmos", "المحرك المخطط له", "بالسعر الذي ظهر لك"] if ar else ["Made with Kling 3.0", "NVIDIA Cosmos, the engine planned for this", "the price you were shown"]
    ok(all(x in one["note"] for x in want), f"{tag}: the open view says why {R['note']}")
    # the list too (a page opened again): reset the record, then the list → the same
    await E("(a)=>{const j=S.jobs.find(x=>x.remote===a);j.model='nvcosmos';delete j.asked175}", lo["id"])
    await E("()=>API.req('/v1/jobs')"); await pg.wait_for_timeout(300)
    two = await E("([a,b])=>{const j=S.jobs.find(x=>x.remote===a),k=S.jobs.find(x=>x.remote===b);return{m:j.model,asked:j.asked175,k:k.model,kAsked:k.asked175||null,kNote:previewCol(k,[]).includes('note175')}}", [lo["id"], lk["id"]])
    R["list"] = two; ok(two["m"] == "kling30" and two["asked"] == "nvcosmos" and two["k"] == "kling30" and not two["kAsked"] and not two["kNote"], f"{tag}: from the job list too; a card with nothing moved is unchanged {two}")
    # Make it again uses the engine that made it
    ag = await E("""(a)=>new Promise(res=>{const j=S.jobs.find(x=>x.remote===a),o=addJob;addJob=function(x){addJob=o;res(x&&x.model||null);return null};
      S.hf.out=[j.id];go('home');renderAll();setTimeout(()=>{const b=document.querySelector('[data-act="hfr-again"][data-id="'+j.id+'"]');if(b)b.click();else{addJob=o;res('no button')}},300);setTimeout(()=>{addJob=o;res('nothing made')},3000)})""", lo["id"])
    R["again"] = ag; ok(ag == "kling30", f"{tag}: Make it again uses Kling 3.0 {ag}")
    w = await E("()=>document.documentElement.scrollWidth<=innerWidth+1"); ok(w, f"{tag}: nothing wider than the screen")
    out[tag] = R; ok(not [e for e in errs if "stop" not in e], f"{tag}: page errors {errs}"); await br.close()

async def main(lo, lk):
    async with async_playwright() as p:
        for phone, lang in ((True, "en"), (False, "ar")):
            try: await run(p, phone, lang, lo, lk)
            except Exception as e: fails.append(f"{'phone' if phone else 'desk'} {lang} crashed: {e!r}"[:400])
try:
    lo, lk = server_part()
    if lo.get("id") and lk.get("id"): asyncio.run(main(lo, lk))
except Exception as e: fails.append(f"crashed: {e!r}"[:400])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1)[:9000])
if fails: print(open(D + "/server.log").read()[-1500:])
shutil.rmtree(D, ignore_errors=True)
print("v175 ok" if not fails else f"FAILED {len(fails)}"); sys.exit(1 if fails else 0)
