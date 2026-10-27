# v82: one clean system. One name, one door and one title per tool; customers never see the server's settings or admin
# directions; company details saved on the server fill the policies (in Arabic on Arabic pages); one generation path —
# checked before anything is charged, credits held → charged when it is made → given back by themselves when it fails, the
# same request never made twice, the length and format the engine can really make; Cinema Studio; the studio's craft notes in
# the agents; clean empty states (no made-up steps, no giant icons, no flag emoji); the example story in the visitor's
# language; and a picture comparison of every page (tests/visual82.json — UPDATE_VISUAL=1 rewrites it after a wanted change).
import asyncio, hashlib, io, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8121, 8122
BASE = ROOT + "/tests/visual82.json"; UPDATE = os.environ.get("UPDATE_VISUAL") == "1" or not os.path.exists(BASE)
D = tempfile.mkdtemp(prefix="nooi-v82-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "c" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 300, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"name": "Customer"},
    "tokens": [{"id": "tk1", "name": "test", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1}]}}}, open(D + "/data/db.json", "w"))
# the engine: every task is made, except a prompt with FAILME (it fails the way the engine fails)
MOCK = r"""
const http=require('http');const P=+process.argv[2];const st={tasks:[]};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');const send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(u.pathname.startsWith('/out.')){s.setHeader('content-type',u.pathname.endsWith('.png')?'image/png':'video/mp4');return s.end(Buffer.alloc(64))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 if(u.pathname==='/api/v1/jobs/createTask'||u.pathname==='/api/v1/veo/generate'){const j=JSON.parse(b||'{}'),id='t'+(++n);T[id]=j;st.tasks.push(j);return send({taskId:id})}
 if(u.pathname==='/api/v1/jobs/recordInfo'||u.pathname==='/api/v1/veo/record-info'){const j=T[u.searchParams.get('taskId')]||{},p=JSON.stringify(j);
  if(/FAILME/.test(p))return send({state:'fail',failMsg:'Internal Error, Please try again later.',successFlag:3});
  const out='http://localhost:'+P+(/image|seedream|nano|flux|qwen|gpt-image|imagen|ideogram/.test(j.model||'')?'/out.png':'/out.mp4');
  return send({state:'success',successFlag:1,resultJson:JSON.stringify({resultUrls:[out]}),response:{resultUrls:[out]}})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {"visual": {}}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None, token=None):
    h = {"content-type": "application/json"}
    if token: h["authorization"] = "Bearer " + token
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
def node(js):
    r = subprocess.run(["node", "--input-type=module", "-e", js + "\nsetTimeout(() => process.exit(0), 300);"], capture_output=True, text=True, timeout=120, cwd=D, env=dict(os.environ, SECRET_KEY="v" * 40, PUBLIC_BASE_URL="https://x.test", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"))
    try: return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: return {"_err": (r.stdout + r.stderr)[-800:]}
def wait_job(jid, token=None, secs=40):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        j = api("/v1/jobs/" + jid, token=token)
        if j.get("status") in ("done", "failed"): return j
        time.sleep(.5)
    return j

def unit_checks():
    # the length and format each engine can really make (a wide 21:9 shot goes to the nearest format the engine accepts)
    v = node(f"""import {{ kieDur, kieInput }} from "{ROOT}/providers/kie.js";
      const ar = (m) => kieInput(m, {{ kind: "video", prompt: "x", dur: 5, aspect: "21:9" }});
      console.log(JSON.stringify({{ veo: kieDur("veo3", 5), k26a: kieDur("kling-2.6/text-to-video", 7), k26b: kieDur("kling-2.6/text-to-video", 9), k30: kieDur("kling-3.0/video", 20), k30b: kieDur("kling-3.0/video", 2),
        sd: kieDur("bytedance/seedance-2-5", 3), h3: kieDur("minimax-h3/text-to-video", 8), wan: kieDur("wan/2-7-text-to-video", 30),
        arK30: ar("kling-3.0/video").aspect_ratio, arK26: ar("kling-2.6/text-to-video").aspect_ratio, arH3: ar("minimax-h3/text-to-video").aspect_ratio, arSd: ar("bytedance/seedance-2-5").aspect_ratio, arWan: ar("wan/2-7-text-to-video").ratio }}))""")
    out["lengths"] = v
    ok(v.get("veo") == 8 and v.get("k26a") == 5 and v.get("k26b") == 10 and v.get("k30") == 15 and v.get("k30b") == 3 and v.get("sd") == 4 and v.get("h3") == 6 and v.get("wan") == 15, f"lengths the engines really make {v}")
    ok(v.get("arK30") == "16:9" and v.get("arK26") == "16:9" and v.get("arH3") == "16:9" and v.get("arSd") == "21:9" and v.get("arWan") == "16:9", f"21:9 → the nearest format each engine accepts {v}")
    # hold → charge on success · hold → given back on failure (once only)
    v = node(f"""import {{ user, save }} from "{ROOT}/lib/store.js"; import {{ hold, settle, release, balance }} from "{ROOT}/lib/billing.js";
      const U = user("u1"); U.credits = 100; U.ledger = [];
      const h1 = hold("u1", 10, "Video · test", "J1"), b1 = balance("u1"); settle("u1", "J1"); const r1 = (user("u1").ledger || []).find((x) => x.ref === "J1");
      hold("u1", 5, "Video · test 2", "J2"); const b2 = balance("u1"); const back = release("u1", "J2"), again = release("u1", "J2"), b3 = balance("u1"); const r2 = (user("u1").ledger || []).find((x) => x.ref === "J2");
      console.log(JSON.stringify({{ b1, b2, b3, back: !!back, again: !!again, r1: r1 && r1.hold, r2: r2 && r2.hold, r2d: r2 && r2.delta }}))""")
    out["hold"] = v
    ok(v.get("b1") == 90 and v.get("r1") == "charged" and v.get("b2") == 85 and v.get("back") and not v.get("again") and v.get("b3") == 90 and v.get("r2") == "released" and v.get("r2d") == 0, f"credits: held → charged · held → given back once {v}")
    # one list of models (the name people see comes from one place)
    v = node(f"""import {{ REGISTRY, modelNames }} from "{ROOT}/lib/models.js"; const n = modelNames();
      console.log(JSON.stringify({{ wan27: n.wan27, kling26: n.kling26, auto: n.auto, kinds: [...new Set(Object.values(REGISTRY).map((x) => x.kind))].sort() }}))""")
    ok(v.get("wan27") == "WAN 2.7" and v.get("kling26") == "Kling 2.6" and v.get("auto") == "nooi Auto" and v.get("kinds") == ["image", "video"], f"model registry {v}")
    # the studio's craft notes: every agent with a craft has its notes, in English and Arabic; the agents read the best-fitting
    # notes next to what they learned; the dubbing translator reads the dubbing notes
    v = node(f"""import {{ builtinSkills, craftNotes }} from "{ROOT}/lib/skills.js"; import {{ skillsFor }} from "{ROOT}/lib/agents.js";
      const all = builtinSkills(), by = {{}}; all.forEach((c) => by[c.agent] = (by[c.agent] || 0) + 1);
      const cine = skillsFor("cine", ["video"]).map((s) => s.id), voice = skillsFor("sound", ["voice", "subtitles"]).map((s) => s.id);
      console.log(JSON.stringify({{ n: all.length, by, bad: all.filter((c) => !c.ar || !c.howAr || !c.when || !c.tags.length).map((c) => c.id), ids: new Set(all.map((c) => c.id)).size, cine, voice, dub: craftNotes("dubbing", 5).split("\\n").length }}))""")
    out["skills"] = v
    by = v.get("by", {})
    ok(v.get("n", 0) >= 48 and v.get("ids") == v.get("n") and not v.get("bad") and all(by.get(a, 0) >= 8 for a in ("cine", "writer", "director", "sound", "casting")), f"craft notes: cinematography, story, directing, sound, dubbing, art {v}")
    ok(any(x.startswith("nooi-cinematography-") for x in v.get("cine", [])) and any(x.startswith("nooi-") for x in v.get("voice", [])) and v.get("dub") == 5, f"the agents read the craft notes {v}")

async def browser_checks(p):
    b = await p.chromium.launch(); errs = []
    async def page(lang, w):
        mob = w < 600; ctx = await b.new_context(viewport={"width": w, "height": 860 if mob else 900}, is_mobile=mob, has_touch=mob, device_scale_factor=1)
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{lang} {w}: {str(e)[:200]}"))
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await pg.evaluate("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}", lang)
        await pg.wait_for_timeout(500); return ctx, pg
    COLLECT = r"""(v)=>{const vis=e=>{const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return false;const cs=getComputedStyle(e);return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.05};
      const h1=[...document.querySelectorAll('#main h1')].filter(vis).map(h=>h.textContent.trim());
      const big=[...document.querySelectorAll('#main svg')].filter(vis).map(s=>{const r=s.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),(s.parentElement.className.baseVal??s.parentElement.className)+'']}).filter(x=>x[0]>44&&x[1]>44&&!/plane|bot|crew|nmark|logo|brand|hero|stage|thumb|tpl|art|world|face|empty|^sav$/i.test(x[2]));
      const emoji=[...document.querySelectorAll('#side,#bottomnav,#main')].flatMap(r=>[...r.querySelectorAll('button,a,.tile,.chip,.nav')]).filter(vis).map(e=>e.textContent).filter(t=>/\p{Extended_Pictographic}/u.test(t)||/[\u{1F1E6}-\u{1F1FF}]/u.test(t)).slice(0,3);
      const txt=document.querySelector('#main').innerText;
      return {view:S.view,h1,name:name82(S.view),big,emoji,fake:/Encoding prompt|Denoising|ترميز الوصف/.test(txt)&&!/Enhance|التحسين/.test(name82(S.view)||''),admin:/Admin →|الإدارة ←/.test(txt),
        logoMoving:[...document.querySelectorAll('.nbrand')].some(e=>e.getAnimations({subtree:true}).some(a=>a.playState==='running'))}}"""
    NAV = r"""()=>{const vis=e=>{const r=e.getBoundingClientRect();return r.width>1&&r.height>1&&getComputedStyle(e).visibility!=='hidden'};const sig=s=>s?s.innerHTML.replace(/\s+/g,'').replace(/data-[a-z]+="[^"]*"/g,'').slice(0,200):'';
      const lab={},door={},tabs=[];document.querySelectorAll('#side .nav[data-go],#bottomnav [data-go],#main .hubtabs [data-go]').forEach(e=>{if(!vis(e))return;const l=(e.textContent||'').replace(/\s+/g,' ').trim();if(!l)return;
        const s=sig(e.querySelector('svg'));if(s){(lab[l]=lab[l]||new Set()).add(s)}
        if(e.closest('.hubtabs')){if(name82(e.dataset.go)&&l!==name82(e.dataset.go))tabs.push(e.dataset.go+': '+l+' ≠ '+name82(e.dataset.go))}else(door[e.dataset.go]=door[e.dataset.go]||new Set()).add(l)});
      return {icons:Object.entries(lab).filter(([l,s])=>s.size>1).map(([l])=>l),doors:Object.entries(door).filter(([g,s])=>s.size>1).map(([g,s])=>g+': '+[...s].join(' / ')).concat(tabs)}}"""
    views = None; shots = {}
    for lang in ("en", "ar"):
        for w in (390, 1280):
            ctx, pg = await page(lang, w); tag = f"{lang} {w}"
            views = views or await pg.evaluate("()=>Object.keys(VIEWS).filter(v=>!['admin'].includes(v))")
            navbad = {"icons": set(), "doors": set()}
            for v in views:
                await pg.evaluate("(v)=>{document.getElementById('modalRoot').innerHTML='';go(v);renderAll();scrollTo(0,0)}", v); await pg.wait_for_timeout(450)
                r = await pg.evaluate(COLLECT, v)
                ok(len(r["h1"]) == 1 or r["view"] == "home" or (v == "edit" and w < 1024 and not r["h1"]), f"{tag} {v}: one title {r['h1']}")   # (v151: the phone studio's bar shows the project's name instead)
                if r["name"] and r["h1"] and r["view"] != "home": ok(r["h1"][0] == r["name"], f"{tag} {v}: the title is the tool's name ({r['h1'][0]} vs {r['name']})")
                ok(not r["big"], f"{tag} {v}: no oversized icon {r['big']}")
                ok(not r["emoji"], f"{tag} {v}: no emoji on buttons {r['emoji']}")
                ok(not r["fake"], f"{tag} {v}: no made-up progress steps")
                ok(not r["logoMoving"], f"{tag} {v}: the logo is still")
                n = await pg.evaluate(NAV); navbad["icons"].update(n["icons"]); navbad["doors"].update(n["doors"])
                if (lang, w) in (("en", 1280), ("ar", 390)):
                    png = await pg.screenshot(type="png", animations="disabled"); shots[f"{lang}_{w}_{v}"] = png
            ok(not navbad["icons"], f"{tag}: one icon per name in the menus and tabs {sorted(navbad['icons'])}")
            ok(not navbad["doors"], f"{tag}: one name per door {sorted(navbad['doors'])}")
            # a customer: no server settings, no admin directions
            r = await pg.evaluate("""async(views)=>{const keep=[ME.role,ME.perms];ME.role=null;ME.perms=[];const bad=[];
              for(const v of views){go(v);renderAll();await new Promise(r=>setTimeout(r,60));const t=document.querySelector('#main').innerText;if(/Admin →|الإدارة ←|server \\.env/.test(t))bad.push(v)}
              go('connect');renderAll();const landed=S.view;const nav=[...document.querySelectorAll('[data-go="connect"]')].filter(e=>e.offsetParent).length;
              go('video');renderAll();const tabs=[...document.querySelectorAll('.hubtabs [data-go]')].map(e=>e.dataset.go);[ME.role,ME.perms]=keep;return {bad,landed,nav,tabs}}""", views)
            ok(not r["bad"] and r["landed"] != "connect" and r["nav"] == 0, f"{tag}: customers see no server settings or admin directions {r}")
            ok("cinema" not in r["tabs"] and r["tabs"][:2] == ["video", "motion"], f"{tag}: Cinema Studio is part of nooi Studio, the first tab of Video (v93) {r['tabs']}")
            if lang == "ar":
                r = await pg.evaluate("()=>({title:S.story.title,ch:S.story.chapters.map(c=>c.title),char:S.chars[0]&&S.chars[0].name,board:(S.board.frames[0]||{}).action})")
                ok(r["title"] == "حارس المنارة الأخير" and r["char"] == "الحارس" and all(not any(ch.isascii() and ch.isalpha() for ch in t) for t in r["ch"]) and r["board"] and not r["board"].isascii(), f"{tag}: the example story is in Arabic {r}")
            await ctx.close()
    # Cinema Studio is part of nooi Studio (v93): its address opens the Video page, whose one box has the camera, lens, focal length,
    # aperture, light and ready looks; a look fills the choices; the shot carries them; a double tap makes one video
    ctx, pg = await page("en", 1280)
    await pg.evaluate("()=>{go('cinema');renderAll();S.draft.variations=1}"); await pg.wait_for_timeout(400)
    r = await pg.evaluate("()=>({view:S.view,secs:['c_cam','c_lens','c_focal','c_ap','c_light','look'].filter(k=>document.querySelector('.box93 [data-o93=\"'+k+'\"]')).length})")
    ok(r["view"] == "video" and r["secs"] == 6, f"cinema: opens nooi Studio with the camera choices and ready looks in its box {r}")
    await pg.click('[data-o93="look"]'); await pg.wait_for_timeout(150)
    await pg.click('[data-act="look93"][data-v="noir"]'); await pg.wait_for_timeout(200)
    r = await pg.evaluate("()=>({n:S.jobs.filter(j=>j.meta&&j.meta.cinema).length,c:{...S.draft.cine93},w:cineWords93()})")
    ok(r["n"] == 0 and r["c"].get("light") == "noir" and r["c"].get("cam") == "vintage", f"cinema: a look fills the choices; nothing is made without a shot {r}")
    words = r["w"]
    await pg.fill('[data-bind="draft.prompt"]', "A detective walks under a streetlight in the rain"); await pg.wait_for_timeout(150)
    before = len(stats()["tasks"])
    await pg.click('[data-act="gen-video"]'); await pg.click('[data-act="gen-video"]')
    await pg.wait_for_timeout(4000)
    r = await pg.evaluate("()=>S.jobs.filter(j=>j.meta&&j.meta.cinema).map(j=>({prompt:j.prompt,title:j.title,kind:j.kind,status:j.status,meta:j.meta.cinema}))")
    t = stats()["tasks"][before:]
    ok(len(r) == 1 and words and words in r[0]["prompt"] and "noir" in r[0]["prompt"] and r[0]["meta"]["light"] == "noir", f"cinema: one video with the choices (a double tap makes one) {r}")
    ok(len(t) == 1 and "noir" in json.dumps(t[0]), f"cinema: the engine receives the film wording {t}")
    # the Voice page: one "Clone a voice"; the empty video page: no steps
    await pg.evaluate("()=>{go('voice');renderAll()}"); await pg.wait_for_timeout(300)
    ok(await pg.evaluate("()=>[...document.querySelectorAll('#main [data-act=\"vc-open\"]')].filter(e=>e.offsetParent).length") == 1, "voice: one Clone a voice")
    # company details saved on the server fill the policies; the Arabic page names the place in Arabic
    api("/v1/admin/settings", {"biz": {"name": "Nooi Test Co", "cr": "1010101010", "vat": "300000000000003", "country": "Saudi Arabia", "city": "Riyadh", "address": "King Fahd Rd", "email": "help@nooi.test"}}, "PUT")
    await pg.reload(); await pg.wait_for_timeout(1500)
    r = await pg.evaluate("""async()=>{S.user={name:'T',method:'google'};AU.showAuth=false;S.lang='ar';go('legal');renderAll();await new Promise(r=>setTimeout(r,800));return document.querySelector('#main').innerText}""")
    ok("Nooi Test Co" in r and "الرياض" in r and "المملكة العربية السعودية" in r and "[المدينة]" not in r and "Riyadh" not in r, f"legal: the company details from the server, place names in Arabic {r[:300]}")
    await ctx.close(); await b.close()
    ok(not errs, f"no page errors {errs[:5]}")
    return shots

def dhash(png):
    im = Image.open(io.BytesIO(png)).convert("L").resize((17, 16), Image.BILINEAR); px = list(im.tobytes())
    bits = "".join("1" if px[r * 17 + c] > px[r * 17 + c + 1] else "0" for r in range(16) for c in range(16))
    return "%064x" % int(bits, 2)
def hamming(a, b): return bin(int(a, 16) ^ int(b, 16)).count("1")

async def main():
    unit_checks()
    mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "REALTIME_", "DEPTH_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(60):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.5)
        cfg = api("/v1/config")
        ok((cfg.get("registry") or {}).get("wan27", {}).get("name") == "WAN 2.7", "config: the model list from one place")
        # a customer's request: checked before anything is charged
        c0 = api("/v1/billing", token=TOKEN)["credits"]
        r = api("/v1/jobs", {"kind": "video", "prompt": "  ", "model": "kling26", "dur": 5}, token=TOKEN)
        ok(r.get("_status") == 400 and "Describe" in r.get("error", "") and api("/v1/billing", token=TOKEN)["credits"] == c0, f"an empty request is refused and nothing is charged {r}")
        # the same request twice = one job, charged once; the length the engine makes (7 s → 5 s on Kling 2.6), 21:9 → 16:9
        body = {"kind": "video", "prompt": "A calm sea at dawn, slow dolly-in", "model": "kling26", "dur": 7, "aspect": "21:9"}
        j1 = api("/v1/jobs", body, token=TOKEN); j2 = api("/v1/jobs", body, token=TOKEN); c1 = api("/v1/billing", token=TOKEN)["credits"]
        ok(j1.get("id") and j1.get("id") == j2.get("id") and c1 == c0 - (j1.get("cost") or 0) and (j1.get("cost") or 0) > 0, f"one request = one job, charged once {j1.get('id')} {j2.get('id')} {c0}→{c1} cost {j1.get('cost')}")
        ok(j1.get("dur") == 5 and j1.get("durAsked") == 7, f"priced and made for the length the engine makes {j1.get('dur')} {j1.get('durAsked')}")
        j = wait_job(j1["id"], TOKEN); led = api("/v1/billing", token=TOKEN)["ledger"]; row = next((x for x in led if x.get("ref") == j1["id"]), {})
        task = next((x for x in stats()["tasks"] if "calm sea" in json.dumps(x)), {})
        ok(j.get("status") == "done" and row.get("hold") == "charged", f"made → the held credits are charged {j.get('status')} {row}")
        ok((task.get("input") or {}).get("aspect_ratio") == "16:9" and (task.get("input") or {}).get("duration") == "5", f"the engine is asked for a format and length it makes {task.get('input')}")
        # a failure gives the credits back by itself, with one short sentence
        f1 = api("/v1/jobs", {"kind": "video", "prompt": "FAILME a storm over the harbour", "model": "kling26", "dur": 5, "aspect": "16:9"}, token=TOKEN)
        jf = wait_job(f1["id"], TOKEN); c2 = api("/v1/billing", token=TOKEN)["credits"]; led = api("/v1/billing", token=TOKEN)["ledger"]; row = next((x for x in led if x.get("ref") == f1["id"]), {})
        ok(jf.get("status") == "failed" and c2 == c1 and row.get("hold") == "released" and "Internal Error" not in (jf.get("error") or ""), f"failed → credits back, a friendly sentence {jf.get('status')} {c1}→{c2} {row} {jf.get('error')}")
        async with async_playwright() as p: shots = await browser_checks(p)
        # picture comparison: each page's picture (a 16×16 difference hash) against the saved one
        cur = {k: dhash(v) for k, v in shots.items()}
        if UPDATE:
            json.dump({"note": "v82 picture of every page (16x16 difference hash). UPDATE_VISUAL=1 python3 tests/v82.py rewrites it after a wanted change.", "pages": cur}, open(BASE, "w"), indent=0, sort_keys=True); out["visual"]["written"] = len(cur)
        else:
            # the 3D World draws a live 3D scene (it moves and loads in steps): tests/v86.py checks that page instead
            base = json.load(open(BASE))["pages"]; diff = {k: hamming(cur[k], base[k]) for k in cur if k in base and not k.endswith("_world")}
            out["visual"] = {"pages": len(diff), "max": max(diff.values() or [0]), "changed": {k: d for k, d in diff.items() if d > 40}, "new": [k for k in cur if k not in base], "gone": [k for k in base if k not in cur]}
            ok(not out["visual"]["changed"] and not out["visual"]["gone"], f"pages look as saved (difference > 40 of 256) {out['visual']}")
    finally:
        srv.terminate(); mk.terminate()
        try: out["serverLog"] = srv.stderr.read().decode()[-1500:]
        except Exception: pass
asyncio.run(main())
print(json.dumps({"fails": fails, **out}, ensure_ascii=False, indent=1, default=str))
