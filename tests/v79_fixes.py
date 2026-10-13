# v79: the free period (nothing charged, nothing "refunded", prices and icons stay; Admin switch charges again), the avatar's
# voice (retries + a second voice model, a clear "busy" message, no other avatar model wasting the same voice), failed jobs
# that say why with "Try again", readable captions, labels that never break inside a word, nooi-star loaders, the avatar
# script, character looks from the whole character (failed / rendering / real states), the sketch that turns into what was
# drawn (AI vision reads it — "a car and a snake" — and the AI picture fills the output panel), the AI 3D world (scene
# language from the text AI, cleaned on the server, built at phone quality, rendered in the cloud), the 3D Studio's cloud
# mode on phones, the UGC ads page and the Templates page (each template its own picture or a clean cover — never an unrelated clip).
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
  if(/You are a 3D world designer/.test(t)){const d=/CLIENT'S DESCRIPTION: (".*")/.exec(t);st.world.push({desc:d?JSON.parse(d[1]):null,lang:/the title in (\w+)/.exec(t)[1]});
   if(/NOTHING/.test(t))o={title:'x',objects:[{type:'spaceship'}]};
   else o={title:'Desert oasis',label:'واحة صحراوية',describe:'A desert oasis at sunset with palms and a red car',sky:{top:'#3b2a6b',horizon:'#ff9a5a',sun:'#ffb070',sunElev:6},ground:{kind:'sand',color:'#d9b77a',size:9999},light:{ambient:.8,sun:1.4},camera:{move:'fly',dist:20,height:6,target:[0,1,0]},fx:{rain:0,snow:0},
    objects:[{type:'palm',at:[-5,0,-4],size:[1,7,1],color:'#3f8f3a',color2:'#8a6a42',count:500,spread:9},{type:'car',at:[2,0,3],size:[4.5,1.4,1.9],color:'#c62828'},{type:'water',at:[-4,0,-3],size:[9,.1,6],color:'not-a-colour'},{type:'<script>',at:[0,0,0]},{type:'rock',at:[1e9,0,0],size:3,color:'#8a8f94',count:6,spread:12}].concat(Array.from({length:120},(_,i)=>({type:'bush',at:[i%10,0,(i/10|0)],size:[1,1,1],color:'#2e6b3a'})))}}
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
    ok(v.get("made") == ["elevenlabs/text-to-speech-multilingual-v2", "elevenlabs/text-to-speech-multilingual-v2", "elevenlabs/text-to-speech-turbo-2-5"], f"avatar voice: twice, then turbo {v.get('made')}")
    ok("voice service is busy" in (v.get("msg") or "") and v.get("noFb") is True and v.get("type") == "provider", f"avatar voice: one clear message, no other avatar model {v}")
    # the world language is cleaned: known kinds only, ≤ 80 entries, ≤ 600 things, numbers clamped, colours checked
    o, e = node(f"""import {{ cleanScene }} from "{ROOT}/lib/worldai.js";
      const s = cleanScene({{ ground: {{ size: 1e6, kind: "lava" }}, sky: {{ top: "red" }}, camera: {{ move: "spin", dist: -5 }}, objects: [{{ type: "tree", count: 5000 }}, {{ type: "eval", at: [0,0,0] }}, ...Array.from({{ length: 200 }}, () => ({{ type: "rock", at: [1e9, 2, 3], color: "#ABCDEF" }}))] }});
      console.log(JSON.stringify({{ n: s.objects.length, g: s.ground, top: s.sky.top, cam: s.camera, first: s.objects[0], rock: s.objects[1] }})); process.exit(0)""", U)
    try: w = json.loads(o.splitlines()[-1])
    except Exception: w = {}
    ok(w.get("n") == 79 and w["g"] == {"color": "#6f9a4b", "kind": "grass", "size": 200} and w["top"] == "#4a7bd1" and w["cam"]["move"] == "orbit" and w["cam"]["dist"] == 2
       and w["first"]["count"] == 40 and w["rock"]["at"] == [200, 2, 3] and w["rock"]["color"] == "#abcdef", f"scene cleaned {w} {e}")
    out["unit"] = {"voiceMs": v.get("ms")}

def api_checks():
    cfg = api("/v1/config"); ok(cfg.get("freeCredits") is True, f"free period on by default {cfg.get('freeCredits')}")
    b = api("/v1/billing", tok=TOKEN); ok(b.get("free") is True and b["credits"] == 5, f"billing says free {b.get('free')} {b.get('credits')}")
    # AI world: the client's words are data, in their language; the scene comes back cleaned; free → nothing taken
    r = api("/v1/world/design", {"prompt": "واحة في الصحراء وقت الغروب", "lang": "ar"}, tok=TOKEN); sc = r.get("scene") or {}; w = stats()["world"]
    ok(r.get("ready") and sc.get("label") == "واحة صحراوية" and w[-1] == {"desc": "واحة في الصحراء وقت الغروب", "lang": "Arabic"}, f"world designed {r.get('ready')} {w}")
    kinds = [o["type"] for o in sc.get("objects", [])]
    ok(len(kinds) <= 80 and "<script>" not in kinds and sum(o["count"] for o in sc["objects"]) <= 600 and sc["ground"]["size"] == 200 and sc["objects"][0]["count"] == 40
       and sc["objects"][2]["color"] == "#9aa4ad" and sc["objects"][3]["at"][0] == 200 and sc["camera"]["move"] == "fly", f"world cleaned {len(kinds)} {sc.get('ground')} {sc['objects'][:4] if sc.get('objects') else None}")
    b2 = api("/v1/billing", tok=TOKEN); ok(b2["credits"] == 5 and any(x.get("free") == 1 for x in b2["ledger"]), f"free period: nothing taken {b2['credits']}")
    ok(api("/v1/world/design", {"prompt": " "}).get("_status") == 400, "empty world refused")
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
    r2 = api("/v1/world/design", {"prompt": "a forest"}, tok=TOKEN); b3 = api("/v1/billing", tok=TOKEN)
    ok(r2.get("cost") == 1 and b3["credits"] == 4, f"charged again when the free period ends {r2.get('cost')} {b3['credits']}")
    r3 = api("/v1/world/design", {"prompt": "NOTHING here"}, tok=TOKEN); b4 = api("/v1/billing", tok=TOKEN)
    ok(r3.get("_status") == 502 and b4["credits"] == 4 and any(l["reason"].startswith("Refund · AI 3D world") for l in b4["ledger"]), f"failed design refunded {r3} {b4['credits']}")
    api("/v1/admin/settings", {"features": {"freePeriod": True}}, "PUT")
    out["api"] = {"world": len(w), "see": len(st)}

SETUP = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}"
WORDS = r"""(sel)=>{const bad=[];document.querySelectorAll(sel).forEach(el=>{if(!el.offsetParent)return;const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const re=/\S+/g;let m;while((m=re.exec(n.data))){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);
  const rs=[...r.getClientRects()].filter(x=>x.width>0);const tops=new Set(rs.map(x=>Math.round(x.top)));if(tops.size>1)bad.push(m[0])}}if(el.scrollWidth>el.clientWidth+1)bad.push("overflow:"+el.textContent)});return bad}"""
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
    await pg.route("**/v1/jobs", jobs); await pg.route("**/v1/jobs/rj*", jstat)
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
    await E("()=>{const L=S.jobs.filter(j=>j.kind==='look').slice(-4);L[0].status='failed';L[0].error='Engine said no';L[1].status='complete';L[1].resultUrl='/media/ai.png';L[2].status='rendering';L[2].progress=.4;L.forEach(j=>delete j.remote);persist();renderView()}")
    await pg.wait_for_timeout(2200)
    r["looks"] = await E("()=>{const c=S.chars[S.charSel];return [!!c.autoLook79,!(c.looks||[]).includes(c.lookSeed),document.querySelectorAll('.looks .fail79 [data-act=\"job-retry\"]').length,document.querySelectorAll('.looks canvas[data-ref^=\"look:\"]').length,getComputedStyle(document.querySelector('.looks .veil:has([data-pct])>div'),'::before').animationName]}")
    ok(r["looks"] == [True, True, 1, 0, "star79"], f"{tag}: looks — failed says so with Try again, real look picked, drawn previews hidden, star while rendering {r['looks']}")
    # the sketch turns into what was drawn: AI vision reads it, the AI picture fills the output panel
    n0 = len(posted)
    await E("()=>{S.sketch.prompt='';S.sketch.target='vehicle';S.sketch.aiCap=250;go('sketch');renderAll()}"); await pg.wait_for_timeout(500)
    r["skmode"] = await E("()=>lskMode()"); ok(r["skmode"] == "pause", f"{tag}: the sketch makes real pictures by default {r['skmode']}")
    await E("()=>{SK.strokes=[{tool:'pen',color:'#000',size:6,pts:[[.2,.6,.6],[.5,.5,.6],[.8,.6,.6]]},{tool:'pen',color:'#000',size:6,pts:[[.3,.8,.6],[.4,.7,.6],[.6,.8,.6]]}];skRedraw()}")
    for _ in range(40):
        await pg.wait_for_timeout(300)
        if await E("()=>SKAI.state==='done'"): break
    sk = [x for x in posted[n0:] if x.get("kind") == "image"]
    r["sketch"] = await E("()=>{const c=$('#skout'),d=c.getContext('2d').getImageData(c.width/2|0,c.height/2|0,1,1).data;return [SKAI.state,c.dataset.ai79,($('#skai79')||{}).textContent,[d[0],d[1],d[2]]]}")
    ok(len(sk) == 1 and "a red sports car next to a coiled green snake" in sk[0]["prompt"] and "skImg" in (sk[0].get("inputs") or {}), f"{tag}: the picture is made from what the AI saw {[x.get('prompt','')[:60] for x in sk]}")
    ok(r["sketch"][0] == "done" and r["sketch"][1] == "/media/ai.png" and ("سيارة وثعبان" in r["sketch"][2]) and r["sketch"][3][0] > 180 and r["sketch"][3][1] < 80, f"{tag}: the AI picture fills the output panel {r['sketch']}")
    await E("()=>{SK.strokes.push({tool:'pen',color:'#000',size:6,pts:[[.1,.1,.6],[.2,.2,.6]]});skRedraw()}"); await pg.wait_for_timeout(500)
    ok(await E("()=>SKAI.state===''&&!$('#skout').dataset.ai79"), f"{tag}: drawing more goes back to the live preview")
    # AI 3D world: designed by the text AI, built at phone quality, rendered in the cloud from one small view
    n0 = len(posted)
    await E("()=>{S.w3.prompt='A desert oasis at sunset';S.w3.scene=null;go('w3ai');renderAll()}"); await pg.wait_for_timeout(400)
    await E("()=>document.querySelector('[data-act=\"w3-make\"]').click()")
    for _ in range(40):
        await pg.wait_for_timeout(300)
        if await E("()=>!!(W3.scene&&W3.r)"): break
    await pg.wait_for_timeout(600)
    r["w3"] = await E("()=>{const c=document.getElementById('w3cv'),x=document.createElement('canvas');x.width=64;x.height=40;W3.dirty=true;w3Cam();W3.r.render(W3.scene,W3.cam);x.getContext('2d').drawImage(c,0,0,64,40);const d=x.getContext('2d').getImageData(0,0,64,40).data,set=new Set();for(let i=0;i<d.length;i+=16)set.add(d[i]>>4<<8|d[i+1]>>4<<4|d[i+2]>>4);return [S.w3.scene.title,S.w3.scene.objects.length,set.size,document.documentElement.scrollWidth<=innerWidth,S.w3.move]}")
    ok(r["w3"][0] == "Desert oasis" and r["w3"][1] <= 80 and r["w3"][2] > 12 and r["w3"][3] and r["w3"][4] == "fly", f"{tag}: AI 3D world built and drawn {r['w3']}")
    await E("()=>document.querySelector('[data-act=\"w3-photo\"]').click()"); await pg.wait_for_timeout(2500)
    await E("()=>document.querySelector('[data-act=\"w3-video\"]').click()"); await pg.wait_for_timeout(2500)
    rw = [(x.get("kind"), sorted((x.get("inputs") or {}).keys())) for x in posted[n0:]]
    ok(("image", ["iRef"]) in rw and ("video", ["vStart"]) in rw, f"{tag}: cloud renders from one view {rw}")
    # Templates: each its own picture or a clean cover — never the logo placeholder or an unrelated clip
    await E("()=>{S.exploreType='all';go('explore');renderAll()}"); await pg.wait_for_timeout(500)
    r["tpl"] = await E("()=>[document.querySelectorAll('.tpl .frame.tplcov').length,document.querySelectorAll('.tpl .frame.ph0').length,document.querySelectorAll('.tpl video.frame').length,TEMPLATES.length]")
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
    await E("()=>document.querySelector('[data-act=\"ugc-pre\"][data-v=\"p-sa-f\"]').click()"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('[data-act=\"ugc-make\"]').click()")
    for _ in range(40):
        await pg.wait_for_timeout(400)
        if len(posted) - n0 >= 2: break
    u = posted[n0:n0 + 2]
    ok(len(u) == 2 and u[0].get("kind") == "image" and "iRef" in (u[0].get("inputs") or {}) and "Rose serum" in u[0]["prompt"] and "exactly the one in the reference photo" in u[0]["prompt"]
       and u[1].get("kind") == "video" and "vStart" in (u[1].get("inputs") or {}) and u[1].get("aspect") == "9:16" and "Rose serum" in u[1]["prompt"], f"{tag}: presenter ad in two steps from the product photo {[(x.get('kind'), sorted((x.get('inputs') or {}).keys()), x.get('prompt','')[:70]) for x in u]}")
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
    # 3D Studio on a phone: cloud mode — no AI download, the render is made in the cloud from one view
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport={"width": 390, "height": 860}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate; posted = []
    async def jobs(route):
        if route.request.method != "POST": return await route.continue_()
        posted.append(json.loads(route.request.post_data or "{}")); await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "rx" + str(len(posted))}))
    async def jstat(route): await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": route.request.url.split("/")[-1], "status": "done", "progress": 1, "url": "/media/ai.png"}))
    await pg.route("**/v1/jobs", jobs); await pg.route("**/v1/jobs/rx*", jstat)
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    await E(SETUP % "en"); await E("()=>{go('studio3d');renderAll()}")
    fr = None
    for _ in range(60):
        await pg.wait_for_timeout(250); fr = next((f for f in pg.frames if "studio3d" in f.url), None)
        if fr and await fr.evaluate("()=>!!(window.X3&&X3.S.cfg&&X3.S.cfg.nooi&&document.getElementById('liteSw'))"): break
    r = await fr.evaluate("()=>{const q=document.getElementById('q');q.value='a red car in the desert, record a video';X3.renderPlan();return [X3.S.lite,document.getElementById('liteSw').checked,document.getElementById('aiRow').hidden,X3.S.plan.steps.find(s=>s.id==='capture').choice,X3.S.plan.notes.some(n=>n.k==='lite')]}")
    ok(r == [True, True, False, "airender", True], f"3D Studio phone: cloud mode {r}")
    await fr.evaluate("()=>document.querySelector('[data-x3=\"airender\"][data-v=\"photo\"]').click()")
    for _ in range(60):
        await pg.wait_for_timeout(300)
        if posted and await fr.evaluate("()=>!!document.querySelector('#aiOut img')"): break
    ok(posted and posted[-1].get("kind") == "image" and "iRef" in (posted[-1].get("inputs") or {}) and await fr.evaluate("()=>!!document.querySelector('#aiOut img')"), f"3D Studio: AI photo made in the cloud {[(x.get('kind'), list((x.get('inputs') or {}).keys())) for x in posted]}")
    await fr.evaluate("()=>{const s=document.getElementById('liteSw');s.checked=false;s.dispatchEvent(new Event('change'))}")
    ok(await fr.evaluate("()=>[X3.S.lite,localStorage.getItem('x3lite')]") == [False, "0"], "3D Studio: cloud mode can be switched off (remembered)")
    ok(not errs, f"3D Studio: page errors {errs}")
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
