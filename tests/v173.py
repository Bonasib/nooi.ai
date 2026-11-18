# v173 — NVIDIA Cosmos picked by hand stays NVIDIA's, its logo, agents that react, the character's face in place, and the member
# dashboard with invites (the planned v166). Checks:
#  · invites (the module itself): a code per member (own code refused, a friend counted for one member only, only new accounts,
#    an account that already bought a plan can't take one, a wrong code → 404, typed without "R-" or in small letters works);
#    every 10 friends who subscribe → 1,500 credits, once each; a friend counted once; a later rule change pays nothing
#    backwards; after the member deletes the account the code is gone
#  · a real nooi server with a stand-in NVIDIA (its Cosmos answers 404 "Function …: Not found for account") and a stand-in second
#    engine: Cosmos picked by hand → the job fails with NVIDIA's reason in plain words, never sent to the other engine, nothing
#    charged; then nooi Auto stops choosing it (config: nvUse.video off, nvDown.video on) and Cosmos picked by hand is refused at
#    once (409, Arabic too, nothing charged); a Cosmos that nooi Auto chose still moves to the other engine when NVIDIA fails
#  · the API: GET /v1/refer, links saved (a handle, a site without https, a bad link refused), a connection (token) can't take
#    an invite
#  · the page (phone and computer, English and Arabic): NVIDIA's logo (the green eye, not "NV" letters) on Cosmos and its line
#    "Not open to this site right now"; picking an engine → the producer speaks and the row of agents hops; words typed → the
#    agent whose part they touch speaks and quotes them; "Your characters" — every face inside its own tile; the account page
#    opens with My dashboard (balance, posts, friends, credits earned, the invite code, share with a link / without a link,
#    social links that save, Create a gift, Delete my account); an invite link (/?ref=CODE) is taken once after sign-in;
#    nothing wider than the screen
# Run: python3 tests/v173.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8530, 8531; B = f"http://localhost:{PORT}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

# ---- 1. invites, the module on its own ----
U = tempfile.mkdtemp(prefix="nooi-v173u-"); os.makedirs(U + "/data"); os.makedirs(U + "/media")
now = int(time.time() * 1000); users = {"A": {"profile": {"created": now}, "credits": 0, "ledger": [], "jobs": {}, "posts": {}, "accounts": {}}, "B": {"profile": {"created": now}, "jobs": {}, "posts": {}, "accounts": {}},
  "old": {"profile": {"created": now - 30 * 864e5}, "jobs": {}, "posts": {}, "accounts": {}}, "paid": {"profile": {"created": now}, "payments": {"p1": {"status": "paid", "snap": {"plan": "basic"}}}, "jobs": {}, "posts": {}, "accounts": {}}}
for i in range(1, 23): users["f%d" % i] = {"profile": {"created": now}, "jobs": {}, "posts": {}, "accounts": {}}
json.dump({"users": users}, open(U + "/data/db.json", "w"))
UNIT = """
const R=process.argv[2];const M=await import(R+'/lib/refer173.js'),st=await import(R+'/lib/store.js'),set=await import(R+'/lib/settings.js');
const o={},t=f=>{try{return{ok:f()}}catch(e){return{err:e.code,msg:e.message,ar:e.errorAr||null}}};const A='A',va=M.view173(A);o.v0=va;
o.own=t(()=>M.claim173(A,va.code));for(let i=1;i<=21;i++)o['c'+i]=t(()=>M.claim173('f'+i,i%2?va.code.toLowerCase().replace('-',''):va.code.slice(2)));
o.again=t(()=>M.claim173('f1',va.code));o.other=t(()=>M.claim173('f1',M.view173('B').code));o.old=t(()=>M.claim173('old',va.code));o.paid=t(()=>M.claim173('paid',va.code));
o.bad=t(()=>M.claim173('f22','R-2222QQ'));o.back=t(()=>M.claim173(A,M.view173('f1').code));const cr=()=>st.user(A).credits||0;o.cr0=cr();
o.g9=[];for(let i=1;i<=9;i++)o.g9.push((M.subscribed173('f'+i)||{}).given);o.cr9=cr();o.g10=M.subscribed173('f10');o.cr10=cr();o.g10b=M.subscribed173('f10');
for(let i=11;i<=20;i++)M.subscribed173('f'+i);o.cr20=cr();o.v20=M.view173(A);set.S().refer173={every:2,bonus:7};o.g21=M.subscribed173('f21');o.cr21=cr();o.v21=M.view173(A);
o.ledger=(st.user(A).ledger||[]).filter(x=>/Invite bonus/.test(x.reason)).map(x=>x.delta);const acc=await import(R+'/lib/account125.js');await acc.deleteAccount(A,'DELETE');
o.afterDel=t(()=>M.claim173('f22',va.code));console.log(JSON.stringify(o));st.saveNow();process.exit(0)"""
open(U + "/unit.mjs", "w").write(UNIT)
uenv = {k: v for k, v in os.environ.items() if not k.startswith(("FIREBASE_", "NVIDIA_", "KIE_"))}
r = subprocess.run(["node", U + "/unit.mjs", ROOT], cwd=U, capture_output=True, text=True, timeout=60, env=dict(uenv, SECRET_KEY="u" * 40, FIREBASE_PROJECT_ID=""))
try: o = json.loads([l for l in r.stdout.splitlines() if l.startswith("{")][-1])
except Exception: o = {}; fails.append("invite module: no answer " + (r.stderr or r.stdout)[-600:])
if o:
    out["unit"] = {k: o[k] for k in ("own", "again", "other", "old", "paid", "bad", "back", "g9", "cr0", "cr9", "cr10", "cr20", "cr21", "ledger", "afterDel") if k in o}
    v0 = o["v0"]; ok(v0["code"].startswith("R-") and len(v0["code"]) == 8 and v0["link"].endswith("/?ref=" + v0["code"]) and v0["every"] == 10 and v0["bonus"] == 1500 and v0["canJoin"], f"a code and a link per member {v0}")
    ok(o["own"].get("err") == 400 and o["own"].get("ar"), f"your own code is refused (with Arabic) {o['own']}")
    ok(all(o["c%d" % i].get("ok", {}).get("ok") for i in range(1, 22)), f"21 new friends join with the code, typed in small letters or without R- {[o['c%d' % i] for i in (1, 2)]}")
    ok(o["again"].get("ok", {}).get("already") is True, f"the same friend again → already counted {o['again']}")
    ok(o["other"].get("err") == 409 and o["old"].get("err") == 409 and o["paid"].get("err") == 409 and o["bad"].get("err") == 404 and o["back"].get("err") == 409,
       f"another member's code later, an old account, an account with a plan, a wrong code, the member who invited you → refused {o['other']} {o['old']} {o['paid']} {o['bad']} {o['back']}")
    ok(o["g9"] == [0] * 9 and o["cr9"] == o["cr0"], f"9 friends subscribed → no bonus yet {o['g9']}")
    ok(o["g10"] and o["g10"]["given"] == 1500 and o["cr10"] == o["cr0"] + 1500 and o["g10b"] is None, f"the 10th → 1,500 credits, once {o['g10']} {o['g10b']}")
    v20 = o["v20"]; ok(o["cr20"] == o["cr0"] + 3000 and v20["subscribed"] == 20 and v20["joined"] == 21 and v20["earned"] == 3000 and v20["bonuses"] == 2 and v20["toNext"] == 10 and v20["progress"] == 0, f"20 → two bonuses {v20}")
    ok(o["g21"]["given"] == 0 and o["cr21"] == o["cr20"] and o["v21"]["toNext"] == 9, f"the rule changed to every 2 → nothing paid backwards {o['g21']} {o['v21']}")
    ok(o["ledger"] == [1500, 1500], f"the bonuses are in the member's credit history {o['ledger']}")
    ok(o["afterDel"].get("err") == 404, f"the member deleted the account → the code is gone {o['afterDel']}")
shutil.rmtree(U, ignore_errors=True)

# ---- 2. a real server, a stand-in NVIDIA (Cosmos closed to the key) and a stand-in second engine ----
D = tempfile.mkdtemp(prefix="nooi-v173-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "w" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": now},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/vid.mp4"], check=True)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={nv:[],kie:[]};let n=0;
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');s.setHeader('connection','close');
 const send=(d,code=200,msg='success')=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code,msg,data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(u.pathname==='/vid.mp4'){s.setHeader('content-type','video/mp4');return s.end(fs.readFileSync(path.join(DIR,'vid.mp4')))}
 if(/^\/cosmos/.test(u.pathname)){st.nv.push(u.pathname);s.statusCode=404;s.setHeader('content-type','application/json');
   return s.end(JSON.stringify({status:404,title:'Not Found',detail:"Function '01327741-test-fn': Not found for account 'acct-test'"}))}
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){let j={};try{j=JSON.parse(b||'{}')}catch{}st.kie.push({path:u.pathname,model:j.model});return send({taskId:'t'+(++n)})}
 if(/record-?[iI]nfo/.test(u.pathname)){const url='http://localhost:'+P+'/vid.mp4';return send({state:'success',successFlag:1,response:{resultUrls:[url]},resultJson:JSON.stringify({resultUrls:[url]})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
mk = subprocess.Popen(["node", D + "/mock.js", str(MP), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false",
  NVIDIA_API_KEY="test-nv-key", KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{MP}", KIE_VIDEO_MODEL="kling-3.0/video", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))

def api(p, body=None, method=None, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=30).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{MP}/stats", timeout=10).read())
def wait_job(jid, tok, until=("done", "failed"), secs=40):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        c, j = api("/v1/jobs/" + jid, tok=tok)
        if j.get("status") in until: return j
        time.sleep(0.4)
    return j
credits = lambda: api("/v1/billing", tok=TOKEN)[1].get("credits")

def server_part():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: time.sleep(0.25)
    c, _ = api("/v1/admin/providers/nvidia", {"videoUrl": f"http://localhost:{MP}/cosmos", "use": "video:on image:off edit:off 3d:off"}, "PUT")
    ok(c == 200, f"NVIDIA set up (stand-in) {c}")
    cfg0 = api("/v1/config")[1].get("providers", {}); ok(cfg0.get("nvUse", {}).get("video") is True and not cfg0.get("nvDown"), f"Cosmos open before {cfg0.get('nvUse')} {cfg0.get('nvDown')}")
    k0, cr0 = len(stats()["kie"]), credits()
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a red car drives along the coast at sunset", "dur": 5, "aspect": "16:9"}, tok=TOKEN)
    ok(c == 200 and j.get("id"), f"Cosmos picked by hand → the job starts {c} {j}")
    if j.get("id"):
        j = wait_job(j["id"], TOKEN); out["cosmos_hand"] = {k: j.get(k) for k in ("status", "error", "errorAr", "errorType")}
        ok(j.get("status") == "failed" and "NVIDIA Cosmos isn't open" in (j.get("error") or "") and "nothing was charged" in (j.get("error") or ""), f"it fails with NVIDIA's reason in plain words {out['cosmos_hand']}")
        ok(len(stats()["kie"]) == k0, f"never sent to the other engine {stats()['kie'][k0:]}")
        time.sleep(0.5); ok(credits() == cr0, f"nothing charged {cr0} → {credits()}")
    ok(len(stats()["nv"]) >= 1, f"NVIDIA was asked {stats()['nv']}")
    cfg1 = api("/v1/config")[1].get("providers", {}); out["cfg_after"] = {"nvUse": cfg1.get("nvUse"), "nvDown": cfg1.get("nvDown")}
    ok(cfg1.get("nvUse", {}).get("video") is False and (cfg1.get("nvDown") or {}).get("video") is True, f"then nooi Auto stops choosing Cosmos {out['cfg_after']}")
    n0 = len(stats()["nv"])
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a red car drives along the coast", "dur": 5, "aspect": "16:9"}, tok=TOKEN)
    ok(c == 409 and "NVIDIA Cosmos isn't open" in (j.get("error") or "") and "NVIDIA Cosmos غير متاح" in (j.get("errorAr") or ""), f"Cosmos picked by hand again → refused at once, in Arabic too {c} {j}")
    ok(len(stats()["nv"]) == n0 and credits() == cr0, f"nothing sent, nothing charged {credits()}")
    # a new Video URL → open again; a Cosmos that nooi Auto chose still moves to the other engine when NVIDIA fails
    api("/v1/admin/providers/nvidia", {"videoUrl": f"http://localhost:{MP}/cosmos-b"}, "PUT")
    cfg2 = api("/v1/config")[1].get("providers", {}); ok(cfg2.get("nvUse", {}).get("video") is True and not cfg2.get("nvDown"), f"a new Video URL → open again {cfg2.get('nvUse')} {cfg2.get('nvDown')}")
    k1 = len(stats()["kie"])
    c, j = api("/v1/jobs", {"kind": "video", "model": "nvcosmos", "prompt": "a red car drives along the coast", "dur": 5, "aspect": "16:9", "meta": {"auto": True}}, tok=TOKEN)
    if j.get("id"):
        j = wait_job(j["id"], TOKEN, secs=60); out["cosmos_auto"] = {k: j.get(k) for k in ("status", "error")}
        ok(len(stats()["kie"]) > k1 and j.get("status") == "done", f"nooi Auto's Cosmos → made on the other engine {out['cosmos_auto']} {stats()['kie'][k1:]}")
    else: fails.append(f"nooi Auto job not made {c} {j}")
    # invites through the API
    c, rv = api("/v1/refer"); ok(c == 200 and rv.get("code", "").startswith("R-") and rv.get("every") == 10, f"GET /v1/refer {rv}")
    c, cv = api("/v1/refer", tok=TOKEN); out["cust_code"] = cv.get("code")
    c, e = api("/v1/refer/claim", {"code": rv.get("code")}); ok(c == 400, f"own code → 400 {c} {e}")
    c, e = api("/v1/refer/claim", {"code": rv.get("code")}, tok=TOKEN); ok(c == 403, f"a connection (token) can't take an invite {c} {e}")
    c, e = api("/v1/me/links", {"links": {"instagram": "@me", "website": "nooi.ai/me", "x": "not a link at all"}}); ok(c == 400 and e.get("errorAr"), f"a bad link → refused {c} {e}")
    c, e = api("/v1/me/links", {"links": {"instagram": "me.test", "website": "nooi.ai/me", "tiktok": "https://www.tiktok.com/@me"}})
    ok(c == 200 and e.get("links") == {"instagram": "@me.test", "website": "https://nooi.ai/me", "tiktok": "https://www.tiktok.com/@me"}, f"links saved (a handle, a site, a full link) {e}")
    return rv, cv

FACE = "data:image/svg+xml;base64," + __import__("base64").b64encode(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#c66"/></svg>').decode()
async def run(p, phone, lang, first, cust_code):
    tag = f"{'phone' if phone else 'desk'} {lang}"; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    await c.grant_permissions(["clipboard-read", "clipboard-write"], origin=B)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate; R = {}
    await pg.goto(B + ("/?ref=" + cust_code if first else "/")); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    if first: R["ref_kept"] = await E("()=>localStorage.getItem('nooi.ref173')"); ok(R["ref_kept"] == cust_code, f"{tag}: the invite link is kept until sign-in {R['ref_kept']}")
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.hf.tab='video';S.hf.vModel='auto';S.hf.bots=true;go('home');renderAll()}", lang)
    await pg.wait_for_timeout(600)
    if first:
        await pg.wait_for_function("!localStorage.getItem('nooi.ref173')", timeout=9000)
        R["joined"] = await E("()=>MB173.r&&{invitedBy:MB173.r.invitedBy}"); ok(R["joined"] and R["joined"]["invitedBy"], f"{tag}: the invite taken once after sign-in {R['joined']}")
    # 1. NVIDIA's logo, and Cosmos's line while NVIDIA keeps it closed
    lg = await E("()=>{const s=atob(LOGO_SRC.nvidia.split(',')[1]);return{green:s.includes('#76B900'),eye:(s.match(/<path/g)||[]).length>=2,letters:/>NV</.test(s),chip:logoFor('nvcosmos')===LOGO_SRC.nvidia}}")
    ok(lg["green"] and lg["eye"] and not lg["letters"] and lg["chip"], f"{tag}: NVIDIA's logo is the green eye, not letters {lg}")
    sh = await E("""async()=>{document.querySelector('.hfmi.eng171').click();await new Promise(r=>setTimeout(r,400));const b=document.querySelector('#modalRoot .hfmodel[data-v="nvcosmos"]');
      return b&&{img:(b.querySelector('.lg img')||{}).src===LOGO_SRC.nvidia,off:b.classList.contains('off173'),txt:(b.querySelector('.nm small')||{}).textContent||''}}""")
    R["cosmos_row"] = sh; ok(sh and sh["img"] and sh["off"] and ("غير متاح لهذا الموقع" in sh["txt"] if ar else "Not open to this site right now" in sh["txt"]), f"{tag}: Cosmos in the list with NVIDIA's logo and its line {sh}")
    # 2. picking an engine → the producer speaks, the row hops
    await E("()=>document.querySelector('#modalRoot .hfmodel[data-v=\"kling30\"]').click()"); await pg.wait_for_timeout(450)
    a = await E("()=>{const on=document.querySelector('.hfstplan.bots li.hbl.on171');return{m:S.hf.vModel,bot:on&&on.dataset.bot,txt:on&&on.textContent,wave:!!document.querySelector('.hfbots .botstrip.wave173'),spk:[...document.querySelectorAll('.hfbots .sbot.spk171')].map(x=>x.dataset.bot),anim:!!(on&&on.classList.contains('anim171'))}}")
    R["pick"] = {k: v for k, v in a.items() if k != "txt"}
    ok(a["m"] == "kling30" and a["bot"] == "producer" and a["wave"] and a["spk"] == ["producer"] and a["anim"] and "Kling" in (a["txt"] or ""), f"{tag}: an engine picked → the producer speaks about it and the agents hop {R['pick']}")
    # 3. words typed → the agent whose part they touch speaks and quotes them
    TYPE = """async(t)=>{const q=document.querySelector('#hfq');q.focus();q.value=t;q.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,1300));
      const on=document.querySelector('.hfstplan.bots li.hbl.on171'),qq=on&&on.querySelector('q.q173');return{bot:on&&on.dataset.bot,quote:qq&&qq.textContent,wave:!!document.querySelector('.hfbots .botstrip.wave173')}}"""
    words = [("a woman sings softly on a stage", "sound"), ("a man walks through the old city", "casting"), ("a red car on a desert road", "director"), ("a man using a phone", "casting")] if not ar else [("امرأة تغني على المسرح", "sound"), ("رجل يمشي في المدينة القديمة", "casting"), ("سيارة حمراء على طريق صحراوي", "director"), ("ولد يركض والكاميرا تتبعه", "cine")]
    for t, want in words:
        w = await E(TYPE, t); R["type_" + want] = w
        ok(w["bot"] == want and w["quote"] and t[:12] in w["quote"] and w["wave"], f"{tag}: '{t}' → {want} speaks and quotes it {w}")
    await E("()=>{const q=document.querySelector('#hfq');q.value='';S.hf.prompt='';q.blur()}")
    # 4. "Your characters" — every face inside its tile
    await E("(f)=>{S.chars=[{id:'c1',name:'Lina',facePic:f},{id:'c2',name:'Omar',facePic:f},{id:'c3',name:'Sara'}];sheet87('hfq')}", FACE); await pg.wait_for_timeout(400)
    ch = await E("""()=>[...document.querySelectorAll('#modalRoot .chpick87')].map(b=>{const r=b.getBoundingClientRect(),f=b.querySelector('.ph'),q=f.getBoundingClientRect(),n=b.querySelector('b').getBoundingClientRect();
      return{inside:q.left>=r.left-1&&q.right<=r.right+1&&q.top>=r.top-1&&q.bottom<=r.bottom+1,above:q.bottom<=n.top+1,size:Math.round(q.width),pos:getComputedStyle(f).position}})""")
    R["chars"] = ch; ok(len(ch) == 3 and all(x["inside"] and x["above"] and x["size"] >= 50 and x["pos"] == "relative" for x in ch), f"{tag}: each face sits in its own tile, above the name {ch}")
    await E("()=>closeSheet()")
    # 5. My dashboard
    await E("()=>{go('account');renderAll()}"); await pg.wait_for_function("document.querySelector('#mb173 .mbcode173 b')", timeout=12000); await pg.wait_for_timeout(500)
    d = await E("""()=>{const m=document.querySelector('#mb173'),bar=document.querySelector('#main .secbar122'),prev=m.previousElementSibling;
      return{stats:m.querySelectorAll('.mbs173').length,code:m.querySelector('.mbcode173 b').textContent,share:[...m.querySelectorAll('[data-act="mb173-share"]')].map(b=>b.dataset.how),
        links:m.querySelectorAll('[data-lk173]').length,gift:!!m.querySelector('[data-act="mb173-gift"]'),del:!!m.querySelector('[data-act="mb173-del"]'),bar:bar&&bar.querySelector('button').textContent,
        afterCard:!!(prev&&prev.matches('.pcard')),w:document.documentElement.scrollWidth<=innerWidth+1,bonus:m.querySelector('.mbinv173 p').textContent}}""")
    R["dash"] = d
    ok(d["stats"] == 4 and d["code"].startswith("R-") and d["share"] == ["link", "code"] and d["links"] == 8 and d["gift"] and d["del"] and d["w"], f"{tag}: My dashboard — balance, posts, friends, earned, code, two ways to share, links, gift, delete {d}")
    ok(d["bar"] == ("لوحتي" if ar else "My dashboard") and d["afterCard"], f"{tag}: first in the page's bar, after the profile card {d['bar']} {d['afterCard']}")
    ok(("1,500" in d["bonus"]) and ("10" in d["bonus"]), f"{tag}: says every 10 friends who subscribe give 1,500 credits {d['bonus']}")
    if not phone:   # (sharing: the page copies it when the device can't share)
        await E("()=>{navigator.share=undefined;document.querySelector('[data-act=\"mb173-share\"][data-how=\"link\"]').click()}"); await pg.wait_for_timeout(400)
        s1 = await E("()=>navigator.clipboard.readText()"); ok("/?ref=" + d["code"] in s1 and "nooi.ai" in s1, f"{tag}: share with a link → the link with the code {s1}")
        await E("()=>document.querySelector('[data-act=\"mb173-share\"][data-how=\"code\"]').click()"); await pg.wait_for_timeout(400)
        s2 = await E("()=>navigator.clipboard.readText()"); ok(d["code"] in s2 and "http" not in s2, f"{tag}: share without a link → the code only {s2}")
    await E("()=>{document.querySelector('#lk173-instagram').value='@nooi.studio';document.querySelector('#lk173-website').value='nooi.ai';document.querySelector('#lk173-x').value=''}")
    await E("()=>document.querySelector('[data-act=\"mb173-links\"]').click()"); await pg.wait_for_timeout(700)
    lk = await E("()=>API.req('/v1/me/links')"); ok(lk["links"].get("instagram") == "@nooi.studio" and lk["links"].get("website") == "https://nooi.ai", f"{tag}: social links saved from the page {lk['links']}")
    await E("()=>document.querySelector('[data-act=\"mb173-gift\"]').click()"); await pg.wait_for_timeout(400)
    g = await E("()=>!!document.querySelector('#modalRoot .gbsheet')"); ok(g, f"{tag}: Create a gift opens the gift card maker"); await E("()=>closeSheet()")
    await E("()=>document.querySelector('[data-act=\"mb173-del\"]').click()"); await pg.wait_for_timeout(800)
    dl = await E("()=>{const r=document.querySelector('#del125').getBoundingClientRect();return{focus:document.activeElement&&document.activeElement.id,vis:r.top<innerHeight&&r.bottom>0}}")
    ok(dl["focus"] == "del125i" and dl["vis"], f"{tag}: Delete my account takes you to the confirmation {dl}")
    out[tag] = R; ok(not errs, f"{tag}: page errors {errs}"); await br.close()

async def main(rv, cv):
    async with async_playwright() as p:
        for i, (phone, lang) in enumerate(((True, "en"), (True, "ar"), (False, "en"))):
            try: await run(p, phone, lang, i == 0, cv.get("code"))
            except Exception as e: fails.append(f"{'phone' if phone else 'desk'} {lang} crashed: {e!r}"[:400])
    c, cv2 = api("/v1/refer", tok=TOKEN); ok(cv2.get("joined") == 1, f"the friend who invited sees one friend joined {cv2}")
try:
    rv, cv = server_part()
    asyncio.run(main(rv, cv))
except Exception as e: fails.append(f"crashed: {e!r}"[:400])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1)[:9000])
if fails: print(open(D + "/server.log").read()[-1500:])
shutil.rmtree(D, ignore_errors=True)
print("v173 ok" if not fails else f"FAILED {len(fails)}"); sys.exit(1 if fails else 0)
