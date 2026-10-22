# v79: the free period (nothing charged, nothing "refunded", prices and icons stay; Admin switch charges again), the avatar's
# voice (retries + a second voice model, a clear "busy" message, no other avatar model wasting the same voice), failed jobs
# that say why with "Try again", readable captions, labels that never break inside a word, nooi-star loaders, the avatar
# script, character looks from the whole character (failed / rendering / real states), the sketch that turns into what was
# drawn (AI vision reads it — "a car and a snake" — and the AI picture fills the output panel), the 3D World (the plan from the
# text AI, cleaned on the server, charged / refunded, built on the device, a real photo of the view made in the cloud; nothing
# heavy on a phone), the UGC ads page and the Templates page (each template its own picture or a drawn cover — never an unrelated clip).
import asyncio, hashlib, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, LPORT = 8094, 8095
D = tempfile.mkdtemp(prefix="nooi-v79-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = os.environ.get("FFMPEG_PATH", "ffmpeg")
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xd02828:s=512x512", "-frames:v", "1", f"{D}/media/ai.png"], check=True)
TOKEN = "nooi_" + "v" * 32   # a paying client (not staff)
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "u2": {"plan": "pro", "credits": 5, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": [{"id": "tk1", "name": "test", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1}]}}}, open(D + "/data/db.json", "w"))
MOCK = r"""
const http=require('http');const P=+process.argv[2];const st={world:[],see:[]};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const J=(o,c)=>{s.statusCode=c||200;s.setHeader('content-type','application/json');s.end(JSON.stringify(o))};const u=q.url;
 if(u==='/stats')return J(st);
 if(u==='/v1/messages'){const j=JSON.parse(b),c=j.messages[0].content,t=Array.isArray(c)?c.find(x=>x.type==='text').text:c,img=Array.isArray(c)&&c.some(x=>x.type==='image');let o={};
  if(/You design 3D worlds for a real-time engine|You turn a photo into a 3D world/.test(t)){const d=/CLIENT'S DESCRIPTION: (".*")/.exec(t);st.world.push({desc:d?JSON.parse(d[1]):null,lang:/the title in (\w+)/.exec(t)[1]});
   if(/NOTHING/.test(t))return J({type:'error',error:{type:'api_error',message:'overloaded'}},500);
   o={title:'Desert oasis',label:'واحة صحراوية',describe:'A desert oasis at sunset with palms and a red car',place:'oasis',size:99999,time:18.2,weather:{kind:'clear',wind:3},terrain:{shape:'dunes',height:8,ground:'sand',color:'not-a-colour'},water:{kind:'lake'},
    objects:[{type:'palm',count:500,at:[-5,-4],color:'#3f8f3a'},{type:'car',at:[2,3],color:'#c62828'},{type:'<script>',at:[0,0]},{type:'rock',at:[1e9,0],color:'#8A8A8A'}].concat(Array.from({length:100},()=>({type:'bush',at:[1,1]}))),life:[{type:'camel',count:99}],spawn:{at:[0,28],look:[0,0]}}}
  else if(/hand-drawn sketch/.test(t)){st.see.push({img,lang:/the same subject in (\w+)/.exec(t)[1]});o={subject:'a red sports car next to a coiled green snake',objects:['car','snake'],target:'vehicle',label:'سيارة وثعبان'}}
  return J({content:[{type:'text',text:JSON.stringify(o)}]})}
 J({error:'nf '+u},404)})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None, tok=None):
    h = {"content-type": "application/json"}
    if tok: h["authorization"] = "Bearer " + tok
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e: return {"_status": e.code, **json.loads(e.read() or b"{}")}
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{LPORT}/stats").read())
M = f"http://localhost:{LPORT}"
SK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

def node(code, cwd):
    env = {k: v for k, v in os.environ.items() if not k.startswith(("FREE_PERIOD", "ELEVENLABS_", "KIE_", "LLM_"))}
    r = subprocess.run(["node", "--input-type=module", "-e", code], cwd=cwd, env=env, capture_output=True, text=True, timeout=120)
    return r.stdout.strip(), r.stderr.strip()[-600:]

def unit_checks():
    # the free period in billing: nothing taken, a failed job's "refund" gives nothing back; switched off it charges again
    U = tempfile.mkdtemp(prefix="nooi-v79u-"); os.makedirs(U + "/data")
    o, e = node(f"""import {{ charge, credit, balance, freeCredits }} from "{ROOT}/lib/billing.js"; import {{ user }} from "{ROOT}/lib/store.js"; import {{ S }} from "{ROOT}/lib/settings.js";
      user("c").credits = 10; const a = [freeCredits()]; charge("c", 4, "Video · x"); a.push(balance("c")); credit("c", 4, "Refund · failed video", "j1"); a.push(balance("c"));
      S().features.freePeriod = false; a.push(freeCredits()); charge("c", 4, "Video · y", "j2"); a.push(balance("c")); credit("c", 4, "Refund · failed video", "j2"); a.push(balance("c"));
      S().features.freePeriod = true; credit("c", 3, "Purchase · 3 credits"); a.push(balance("c")); const l = user("c").ledger; a.push(l.some((x) => x.free === 4 && x.delta === 0)); console.log(JSON.stringify(a)); process.exit(0)""", U)
    try: a = json.loads(o.splitlines()[-1])
    except Exception: a = None
    ok(a == [True, 10, 10, False, 6, 10, 13, True], f"billing free period {a} {e}")
    # the avatar's voice: retries the engine's voice, then a second voice model; all busy → one clear message, no other avatar model
    o, e = node(f"""import {{ _lipVoice }} from "{ROOT}/providers/kie.js"; let n = 0, made = [];
      const call = (k) => async (p, opt) => {{ if (p.includes("createTask")) {{ made.push(JSON.parse(opt.body).model); return {{ taskId: "t" + (++n) }}; }} return k(n); }};
      const t0 = Date.now(), url = await _lipVoice({{ prompt: "Hello there", meta: {{}} }}, call((i) => i < 3 ? {{ state: "fail", failMsg: "Internal Error, Please try again later." }} : {{ state: "success", resultJson: JSON.stringify({{ resultUrls: ["https://cdn/x.mp3"] }}) }}));
      let err = null; made = []; n = 0; try {{ await _lipVoice({{ prompt: "Hi", meta: {{}} }}, call(() => ({{ state: "fail", failMsg: "Internal Error" }}))); }} catch (x) {{ err = x; }}
      console.log(JSON.stringify({{ url, made, msg: err && err.message, noFb: err && err.noFallback, type: err && err.type, ms: Date.now() - t0 }})); process.exit(0)""", U)
    try: v = json.loads(o.splitlines()[-1])
    except Exception: v = {}
    ok(v.get("url") == "https://cdn/x.mp3", f"avatar voice: the third try gives the voice {v} {e}")
    ok(v.get("made") == ["elevenlabs/text-to-speech-multilingual-v2", "elevenlabs/text-to-speech-turbo-2-5", "elevenlabs/text-to-speech-multilingual-v2"], f"avatar voice: v2, turbo, then the engine's default voice {v.get('made')}")
    ok("voice service is busy" in (v.get("msg") or "") and v.get("noFb") is True and v.get("type") == "provider", f"avatar voice: one clear message, no other avatar model {v}")
    # the world plan is cleaned: known places and kinds only (an unknown thing becomes a labelled box), ≤ 60 entries, counts and
    # positions clamped to the world, colours checked
    o, e = node(f"""import {{ cleanPlan }} from "{ROOT}/public/world/plan.js";
      const p = cleanPlan({{ place: "lava", size: 1e6, time: 99, weather: {{ kind: "acid" }}, terrain: {{ color: "red" }}, objects: [{{ type: "palm", count: 5000 }}, {{ type: "eval", at: [0, 0] }}, ...Array.from({{ length: 200 }}, () => ({{ type: "rock", at: [1e9, 3], color: "#ABCDEF" }}))], life: [{{ type: "dragon" }}, {{ type: "camel", count: 99 }}] }});
      console.log(JSON.stringify({{ n: p.objects.length, place: p.place, size: p.size, time: p.time, wx: p.weather.kind, tcol: p.terrain.color, first: p.objects[0], unknown: p.objects[1], rock: p.objects[2], life: p.life }})); process.exit(0)""", U)
    try: w = json.loads(o.splitlines()[-1])
    except Exception: w = {}
    ok(w.get("n") == 60 and w.get("place") == "meadow" and w.get("size") == 320 and w.get("time") == 24 and w.get("wx") == "clear" and w.get("tcol") is None
       and w["first"]["count"] == 60 and w["unknown"]["type"] == "box" and w["unknown"]["label"] == "eval" and w["rock"]["at"] == [159, 3] and w["rock"]["color"] == "#abcdef"
       and [l["type"] for l in w["life"]] == ["camel"] and w["life"][0]["count"] == 30, f"world plan cleaned {w} {e}")
    out["unit"] = {"voiceMs": v.get("ms")}

def api_checks():
    cfg = api("/v1/config"); ok(cfg.get("freeCredits") is True, f"free period on by default {cfg.get('freeCredits')}")
    b = api("/v1/billing", tok=TOKEN); ok(b.get("free") is True and b["credits"] == 5, f"billing says free {b.get('free')} {b.get('credits')}")
    # 3D World: the client's words are data, in their language; the plan comes back cleaned; free → nothing taken
    r = api("/v1/world/plan", {"prompt": "واحة في الصحراء وقت الغروب", "lang": "ar"}, tok=TOKEN); pl = r.get("plan") or {}; w = stats()["world"]
    ok(r.get("ai") is True and pl.get("label") == "واحة صحراوية" and w[-1] == {"desc": "واحة في الصحراء وقت الغروب", "lang": "Arabic"}, f"world planned {r.get('ai')} {w}")
    objs = pl.get("objects", []); kinds = [o["type"] for o in objs]
    ok(len(objs) <= 60 and "<script>" not in kinds and pl.get("size") == 320 and pl.get("place") == "oasis" and next(o for o in objs if o["type"] == "palm")["count"] == 60
       and next(o for o in objs if o["type"] == "car")["color"] == "#c62828" and next(o for o in objs if o["type"] == "rock")["at"] == [159, 0] and pl["terrain"].get("color") is None
       and next(l for l in pl["life"] if l["type"] == "camel")["count"] == 30, f"world cleaned {len(objs)} {pl.get('size')} {objs[:4]}")
    b2 = api("/v1/billing", tok=TOKEN); ok(b2["credits"] == 5 and any(x.get("free") == 1 for x in b2["ledger"]), f"free period: nothing taken {b2['credits']}")
    ok(api("/v1/world/plan", {"prompt": " "}).get("_status") == 400, "empty world refused")
    # the sketch: AI vision reads the drawing (free)
    s = api("/v1/sketch/see", {"image": SK, "lang": "ar"}, tok=TOKEN); st = stats()["see"]
    ok(s.get("ready") and s.get("subject") == "a red sports car next to a coiled green snake" and s.get("objects") == ["car", "snake"] and s.get("target") == "vehicle" and s.get("label") == "سيارة وثعبان", f"sketch seen {s}")
    ok(st and st[-1] == {"img": True, "lang": "Arabic"}, f"the picture went to the vision AI {st}")
    ok(api("/v1/sketch/see", {"image": "not a picture"}).get("_status") == 400, "sketch: bad picture refused")
    # template previews: public list; admin makes them (ids checked)
    ok(api("/v1/tplprev") == {"items": {}}, "template previews: none yet")
    t = api("/v1/admin/tplprev", {"items": [{"id": "t1", "prompt": "A creator reviews a skincare product", "aspect": "9:16"}, {"id": "../x", "prompt": "bad"}]})
    ok("t1" in (t.get("items") or {}) and "../x" not in t["items"], f"template previews: admin starts them {t}")
    ok(api("/v1/admin/tplprev", {"items": []}, tok=TOKEN).get("_status") == 403, "template previews: staff only")
    # the Admin switch: the free period off → charged again; a failed design is refunded
    api("/v1/admin/settings", {"features": {"freePeriod": False}}, "PUT")
    ok(api("/v1/config").get("freeCredits") is False, "free period switched off")
    r2 = api("/v1/world/plan", {"prompt": "a forest"}, tok=TOKEN); b3 = api("/v1/billing", tok=TOKEN)
    ok(r2.get("cost") == 1 and b3["credits"] == 4, f"charged again when the free period ends {r2.get('cost')} {b3['credits']}")
    r3 = api("/v1/world/plan", {"prompt": "NOTHING here"}, tok=TOKEN); b4 = api("/v1/billing", tok=TOKEN)
    ok(r3.get("ai") is False and r3.get("cost") == 0 and (r3.get("plan") or {}).get("objects") is not None and b4["credits"] == 4 and any(l["reason"].startswith("Refund · 3D world plan") for l in b4["ledger"]),
       f"the text AI failed → the world is made from the words and the credit comes back {r3.get('ai')} {r3.get('cost')} {b4['credits']}")
    api("/v1/admin/settings", {"features": {"freePeriod": True}}, "PUT")
    out["api"] = {"world": len(w), "see": len(st)}

SETUP = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}"
WORDS = r"""(sel)=>{const bad=[];document.querySelectorAll(sel).forEach(el=>{if(!el.offsetParent)return;const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const re=/\S+/g;let m;while((m=re.exec(n.data))){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);
  const rs=[...r.getClientRects()].filter(x=>x.width>0);const tops=new Set(rs.map(x=>Math.round(x.top)));if(tops.size>1)bad.push(m[0])}}if(el.scrollWidth>el.clientWidth+1)bad.push("overflow:"+el.textContent)});return bad}"""
async def wait_for(E, js, sec=20):
    for _ in range(sec * 4):
        try:
            if await E(js): return True
        except Exception: pass
        await asyncio.sleep(.25)
    return False

# (v124: the page asks about all its jobs in one request, /v1/jobs/live?ids=… — the faked jobs answer there too)
def live_route(prefix):
    async def live(route):
        from urllib.parse import urlparse, parse_qs
        ids = parse_qs(urlparse(route.request.url).query).get("ids", [""])[0].split(",")
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({"jobs": {i: ({"id": i, "status": "done", "progress": 1, "url": "/media/ai.png"} if i.startswith(prefix) else None) for i in ids if i}}))
    return live
async def ui(p, w, lang):
    tag = f"{w}/{lang}"; r = {}
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    phone = w < 600
    ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=phone, has_touch=phone, device_scale_factor=2 if phone else 1)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    posted = []
    async def jobs(route):
        if route.request.method != "POST": return await route.continue_()
        body = json.loads(route.request.post_data or "{}"); posted.append(body)
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "rj" + str(len(posted))}))
    async def jstat(route):
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": route.request.url.split("/")[-1], "status": "done", "progress": 1, "url": "/media/ai.png"}))
    await pg.route("**/v1/jobs", jobs); await pg.route("**/v1/jobs/rj*", jstat); await pg.route("**/v1/jobs/live*", live_route("rj"))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    await E(SETUP % lang); await pg.wait_for_timeout(300)
    # free period: no credits needed; prices still shown
    r["free"] = await E("()=>{S.credits=0;S.draft.prompt='A lighthouse at dusk';S.draft.type='story';S.draft.variations=1;go('video');renderAll();const n=S.jobs.length;makeVideo();return [crFree(),S.jobs.length-n,!!document.querySelector('#modalRoot .sheet,#modalRoot .modal'),!!document.querySelector('.cost')]}")
    ok(r["free"][0] and r["free"][1] == 1 and not r["free"][2] and r["free"][3], f"{tag}: free period — made with 0 credits, no top-up sheet, prices shown {r['free']}")
    # a failed clip: why it failed, a readable caption, "Try again"
    await E("""()=>{$('#modalRoot').innerHTML='';const j={id:'vf1',kind:'video',status:'failed',progress:0,created:Date.now()-7200e3,title:'UGC ad',prompt:'UGC-style vertical ad: a relatable creator holds and presents the product to camera',model:'kling30',dur:5,aspect:'9:16',seed:3,pal:PALS[1],art:'ugc',error:'The provider could not process this request.',errorType:'input',detail:'kie@kling-3.0/video: 422',meta:{ugc:{mode:'presenter'}}};S.jobs.push(j);S.draft.type='ugc';S.lastVideo='vf1';S.ugc79.last='vf1';go('ugcads');renderAll()}""")
    await pg.wait_for_timeout(300)
    r["fail"] = await E("()=>{const c=document.querySelector('.stage .cap'),s=getComputedStyle(c),p=document.querySelector('.pfail79');return [s.backgroundColor,s.color,s.borderTopWidth,!!p&&p.textContent.includes(ERR_MSG.input),!!document.querySelector('.pfail79 [data-act=\"job-retry\"]')]}")
    ok(r["fail"][0].startswith("rgba(8, 10, 9") and r["fail"][1] == "rgb(255, 255, 255)" and r["fail"][2] == "0px" and r["fail"][3] and r["fail"][4], f"{tag}: failed clip says why, readable caption {r['fail']}")
    n0 = len(posted); await E("()=>document.querySelector('.pfail79 [data-act=\"job-retry\"]').click()"); await pg.wait_for_timeout(800)
    r["retry"] = await E("()=>[S.lastVideo!=='vf1',!S.jobs.some(j=>j.id==='vf1'),(S.jobs.find(j=>j.id===S.lastVideo)||{}).model]")
    ok(len(posted) - n0 == 1 and r["retry"][0] and r["retry"][1] and r["retry"][2] == "kling30", f"{tag}: Try again sends it again {len(posted)-n0} {r['retry']}")
    # labels: no word split across lines, nothing wider than its tile
    for v, setup in (("video", "S.draft.type='story';go('video')"), ("ugcads", "go('ugcads')"), ("image", "go('image')"), ("sketch", "go('sketch')")):
        await E("()=>{" + setup + ";renderAll()}"); await pg.wait_for_timeout(450)
        bad = await E(WORDS, ".tile .lb")
        ok(not bad, f"{tag}: {v} labels break inside a word {bad[:6]}")
    r["doc"] = await E("()=>{S.draft.type='story';go('video');renderAll();return new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const el=[...document.querySelectorAll('.tile .lb')].find(e=>/Documentary|وثائقي/.test(e.textContent));ok(el?[el.textContent,el.getClientRects().length,el.scrollWidth<=el.clientWidth+1]:null)})))}")
    # loaders are the moving nooi stars
    r["star"] = await E("()=>{const b=document.createElement('button');b.className='btn busy';b.textContent='x';document.body.appendChild(b);const s=getComputedStyle(b,'::after'),x=[s.backgroundImage.includes('data:image/svg+xml'),s.animationName,s.animationIterationCount];b.remove();return x}")
    ok(r["star"] == [True, "star79", "infinite"], f"{tag}: busy buttons show the moving stars {r['star']}")
    # avatar: the "bring this picture to life" motion prompt isn't spoken
    await E("()=>{go('home');S.hf.tab='video';S.hf.prompt=L('Bring this picture to life: gentle camera move, natural motion','حرّك هذه الصورة: حركة كاميرا هادئة وحركة طبيعية');renderView()}"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('[data-act=\"hf-tab\"][data-v=\"avatar\"]').click()"); await pg.wait_for_timeout(300)
    r["avatar"] = await E("()=>[S.hf.tab,S.hf.prompt,($('#hfq')||{}).value]")
    ok(r["avatar"] == ["avatar", "", ""], f"{tag}: avatar tab clears the motion prompt {r['avatar']}")
    n0 = len(posted); await E("()=>{M.hfRef={url:'/media/ai.png',remote:'/media/ai.png',name:'face.png'};const q=$('#hfq');q.value=ANIM79[S.lang==='ar'?1:0];S.hf.prompt=q.value;hfSend()}"); await pg.wait_for_timeout(500)
    ok(len(posted) == n0 and not await E("()=>S.jobs.some(j=>j.kind==='lipsync'&&ANIM79.includes(j.prompt))"), f"{tag}: no avatar made from the motion prompt")
    # character looks: the whole character goes to the engine; failed / rendering / real states; the first real look is picked
    n0 = len(posted); await E("()=>{go('chars');renderAll()}"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('[data-act=\"gen-looks\"]').click()"); await pg.wait_for_timeout(1000)
    lk = [x for x in posted[n0:] if x.get("kind") == "look"]
    ok(len(lk) == 4 and all(x["prompt"].startswith("Portrait of ") and "year-old" in x["prompt"] and len(x["prompt"]) > 120 for x in lk), f"{tag}: looks from the whole character {[x['prompt'][:90] for x in lk]}")
    # (the states are set while no job check is on its way — an answer still coming would write "done" over them)
    for _ in range(40):
        if await E("()=>!poll109&&!hf109"): break
        await pg.wait_for_timeout(100)
    await E("()=>{const L=S.jobs.filter(j=>j.kind==='look').slice(-4);L[0].status='failed';L[0].error='Engine said no';L[1].status='complete';L[1].resultUrl='/media/ai.png';L[2].status='rendering';L[2].progress=.4;L.forEach(j=>delete j.remote);persist();renderView()}")
    await pg.wait_for_timeout(2200)
    r["looks"] = await E("()=>{const c=S.chars[S.charSel];return [!!c.autoLook79,!(c.looks||[]).includes(c.lookSeed),document.querySelectorAll('.looks .fail79 [data-act=\"job-retry\"]').length,document.querySelectorAll('.looks canvas[data-ref^=\"look:\"]').length,!!document.querySelector('.looks .veil.v80 .star79')]}")
    ok(r["looks"] == [True, True, 1, 0, True], f"{tag}: looks — failed says so with Try again, real look picked, drawn previews hidden, star while rendering {r['looks']}")
    # the sketch (v91): nothing happens while you draw; "Preview with AI" — AI vision reads the drawing (free), writes what it is in
    # the box, and the picture is made from what it saw; the drawing itself never changes
    n0 = len(posted)
    await E("()=>{S.sketch.prompt='';S.sketch.n91=1;go('sketch');renderAll()}"); await pg.wait_for_timeout(500)
    await E("()=>{SK.strokes=[{tool:'pen',color:'#000',size:6,pts:[[.2,.6,.6],[.5,.5,.6],[.8,.6,.6]]},{tool:'pen',color:'#000',size:6,pts:[[.3,.8,.6],[.4,.7,.6],[.6,.8,.6]]}];skRedraw()}")
    await pg.wait_for_timeout(1500); ok(not [x for x in posted[n0:] if x.get("kind") == "image"], f"{tag}: drawing alone makes no pictures (no credits spent)")
    await E("()=>document.querySelector('[data-act=sk91-go]').click()")
    for _ in range(40):
        await pg.wait_for_timeout(300)
        if [x for x in posted[n0:] if x.get("kind") == "image"]: break
    sk = [x for x in posted[n0:] if x.get("kind") == "image"]
    r["sketch"] = await E("()=>[S.sketch.prompt,($('#skwhat91')||{}).value,SK.strokes.length,!!document.querySelector('#sk91res .dfig')]")
    ok(len(sk) == 1 and "a red sports car next to a coiled green snake" in sk[0]["prompt"] and "skImg" in (sk[0].get("inputs") or {}), f"{tag}: the picture is made from what the AI saw {[x.get('prompt','')[:60] for x in sk]}")
    ok("سيارة وثعبان" in (r["sketch"][0] or "") and "سيارة وثعبان" in (r["sketch"][1] or "") and r["sketch"][2] == 2 and r["sketch"][3], f"{tag}: what the AI saw is written in the box, the drawing stays, the preview is listed {r['sketch']}")
    # 3D World: the plan from the text AI, built on the device; a real photo of the view is made in the cloud from one view
    n0 = len(posted)
    await E("()=>go('w3ai')"); ok(await wait_for(E, "()=>S.view==='world'&&typeof NW!=='undefined'&&!!NW.E&&(!!NW.W||!!NW.empty87)&&!NW.busy", 40), f"{tag}: the old 3D world page opens the 3D World")
    await E("()=>{document.getElementById('nwprompt').value='A desert oasis at sunset';document.querySelector('[data-act=nw-go]').click()}")
    ok(await wait_for(E, "()=>!NW.busy&&!!NW.W&&NW.W.plan.title==='Desert oasis'", 60), f"{tag}: the world the text AI planned was built " + json.dumps(await E("()=>NW.W&&[NW.W.plan.title,NW.busy]")))
    r["w3"] = await E("()=>{const s=NW.W.stats();return [NW.W.plan.place,NW.W.plan.objects.length<=60,s.calls>0,s.things>12]}")
    ok(r["w3"] == ["oasis", True, True, True], f"{tag}: 3D World built and drawn {r['w3']}")
    await E("()=>document.querySelector('[data-act=nw-real]').click()"); await pg.wait_for_timeout(2500)
    rw = [(x.get("kind"), sorted((x.get("inputs") or {}).keys())) for x in posted[n0:]]
    ok(("image", ["iRef"]) in rw, f"{tag}: a real photo made in the cloud from one view {rw}")
    # Templates: each its own picture or a clean cover — never the logo placeholder or an unrelated clip
    await E("()=>{S.exploreType='all';go('explore');renderAll()}"); await pg.wait_for_timeout(500)
    r["tpl"] = await E("()=>[document.querySelectorAll('.tpl .frame.tplcov,.tpl .frame.tplart86').length,document.querySelectorAll('.tpl .frame.ph0').length,document.querySelectorAll('.tpl video.frame').length,TEMPLATES.length]")
    ok(r["tpl"][0] == r["tpl"][3] and r["tpl"][1] == 0 and r["tpl"][2] == 0, f"{tag}: templates show their own covers {r['tpl']}")
    await E("()=>{TPLPREV.t1='/media/ai.png';renderView()}"); await pg.wait_for_timeout(200)
    ok(await E("()=>!!document.querySelector('.tpl[data-id=\"t1\"] img.frame[src=\"/media/ai.png\"]')"), f"{tag}: a template's own preview picture is used")
    # UGC ads: its own step-by-step page (not the Video page); with a product photo a presenter ad is a photo of the presenter
    # holding YOUR product, then a video that starts from it; the Video page points to UGC ads and keeps its own prompt
    n0 = len(posted)
    await E("()=>{S.ugc79.last=null;S.ugc79.fmt='9:16';S.draft.ugc.name='Rose serum';S.draft.ugc.desc='glow in 7 days';S.draft.ugc.mode='presenter';S.draft.charId='';go('ugcads');renderAll()}"); await pg.wait_for_timeout(400)
    r["ugcpage"] = await E("()=>[S.view,document.querySelectorAll('.ugcstep').length,[...document.querySelectorAll('#main .lbl')].map(l=>l.textContent).filter(t=>/Camera|الكاميرا|Frame rate|First & end|Video type|نوع الفيديو/.test(t)),document.documentElement.scrollWidth<=innerWidth]")
    ok(r["ugcpage"][0] == "ugcads" and r["ugcpage"][1] == 4 and not r["ugcpage"][2] and r["ugcpage"][3], f"{tag}: UGC ads is its own page {r['ugcpage']}")
    await pg.set_input_files('input[data-ugc="ugcP"]', D + "/media/ai.png"); await pg.wait_for_timeout(700)
    # v87: the presenters are real portraits made once for the site (here one is ready); picking one gives the ad that face
    await E("()=>{AV.items=[{id:'av-noura',name:['Noura','نورة'],gender:'female',who:'a Saudi woman',url:'/media/photo.png'}];AV.total=8;AV.making=0;renderView()}"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('[data-act=\"ugc-av87\"][data-v=\"av-noura\"]').click()"); await pg.wait_for_timeout(300)
    r["ugcdbg"] = await E("()=>{const c=charById(S.draft.charId);return [!!M.ugcP,S.draft.charId,!!c,c?hasFace87(c):null,c?face87(c):null,(AV.items||[]).length,S.draft.ugc.mode]}")
    await E("()=>document.querySelector('[data-act=\"ugc-make\"]').click()")
    for _ in range(40):
        await pg.wait_for_timeout(400)
        if len(posted) - n0 >= 2: break
    u = posted[n0:n0 + 2]
    ok(len(u) == 2 and u[0].get("kind") == "image" and "iRef" in (u[0].get("inputs") or {}) and "Rose serum" in u[0]["prompt"] and "exactly the one in the reference photo" in u[0]["prompt"]
       and "iRef2" in (u[0].get("inputs") or {}) and u[1].get("kind") == "video" and "vStart" in (u[1].get("inputs") or {}) and u[1].get("aspect") == "9:16" and "Rose serum" in u[1]["prompt"], f"{tag}: presenter ad in two steps from the product photo + the presenter's face {r.get('ugcdbg')} {[(x.get('kind'), sorted((x.get('inputs') or {}).keys()), x.get('prompt','')[:70]) for x in u]}")
    await pg.wait_for_timeout(600)
    ok(await E("()=>{const j=S.jobs.find(x=>x.id===S.ugc79.last);return !!j&&j.kind==='video'&&j.meta.ugcStep===2}"), f"{tag}: the UGC page follows the video step")
    n0 = len(posted)
    await E("()=>{S.draft.type='ugc';S.draft.prompt='A city at night';S.draft.variations=1;go('video');renderAll()}"); await pg.wait_for_timeout(300)
    r["vpage"] = await E("()=>[!!document.querySelector('.ugcgo79 [data-go=\"ugcads\"]'),!!document.querySelector('.ugcbox')]")
    await E("()=>makeVideo()"); await pg.wait_for_timeout(900)
    ok(r["vpage"] == [True, False] and posted[n0:] and posted[n0]["prompt"] == "A city at night", f"{tag}: the Video page points to UGC ads and keeps its prompt {r['vpage']} {[x.get('prompt','')[:40] for x in posted[n0:]]}")
    ok(await E("()=>FEATURES.some(f=>f[0]==='freePeriod')"), f"{tag}: Admin can end the free period")
    ok(not errs, f"{tag}: page errors {errs}")
    await b.close(); return r

async def studio(p):
    # the 3D World on a phone: a light quality tier, nothing heavy on the device, the real photo is made in the cloud from one view
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport={"width": 390, "height": 860}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate; posted = []
    async def jobs(route):
        if route.request.method != "POST": return await route.continue_()
        posted.append(json.loads(route.request.post_data or "{}")); await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "rx" + str(len(posted))}))
    async def jstat(route): await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": route.request.url.split("/")[-1], "status": "done", "progress": 1, "url": "/media/ai.png"}))
    await pg.route("**/v1/jobs", jobs); await pg.route("**/v1/jobs/rx*", jstat); await pg.route("**/v1/jobs/live*", live_route("rx"))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    await E(SETUP % "ar"); await E("()=>go('studio3d')")
    ok(await wait_for(E, "()=>S.view==='world'&&typeof NW!=='undefined'&&!!NW.E&&!!NW.empty87", 40), "3D World on a phone (opens empty)")
    await E("async()=>{const M=await nwMods();await nwBuild(M.localPlan('a sunny park with trees and a pond'))}"); ok(await wait_for(E, "()=>!!NW.W&&!NW.busy", 40), "3D World on a phone: a world from words")
    r = await E("()=>[NW.E.tier.name,NW.E.stats().pixelRatio<=NW.E.tier.pr[1]+0.01,NW.W.stats().physics]")
    ok(r[0] in ("low", "mid") and r[1] and r[2], f"3D World phone: a light quality tier, physics on {r}")
    await E("()=>document.querySelector('[data-act=nw-real]').click()")
    for _ in range(40):
        await pg.wait_for_timeout(300)
        if posted: break
    ok(posted and posted[-1].get("kind") == "image" and "iRef" in (posted[-1].get("inputs") or {}), f"3D World: a real photo made in the cloud {[(x.get('kind'), list((x.get('inputs') or {}).keys())) for x in posted]}")
    await E("()=>go('library')"); await pg.wait_for_timeout(600)
    ok(await E("()=>!NW.E&&!NW.W"), "3D World: leaving the page on a phone frees the 3D engine")
    ok(not errs, f"3D World phone: page errors {errs}")
    await b.close()

async def main():
    async with async_playwright() as p:
        for w, lang in ((390, "ar"), (1280, "en")): out[f"{w}/{lang}"] = await ui(p, w, lang)
        await studio(p)

if __name__ == "__main__":
    unit_checks()
    mk = subprocess.Popen(["node", D + "/mock.js", str(LPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "CAMB_", "NV_LOCALIZE", "WAN_", "KIE_", "FREE_PERIOD", "FAL_", "REALTIME_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        LLM_API_KEY="mock", LLM_BASE_URL=M, LLM_MODEL="mock-text", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        time.sleep(.5); mk.poll()
        api_checks()
        asyncio.run(main())
    except Exception:
        import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
    finally:
        srv.terminate(); mk.terminate()
        try: err = srv.stderr.read().decode()[-1500:]
        except Exception: err = ""
    print(json.dumps({"fails": fails, "out": out, "serverLog": err if fails else ""}, ensure_ascii=False, default=str, indent=1))
    sys.exit(1 if fails else 0)
