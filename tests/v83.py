# v83: the new engines (Kling 3.0 Turbo, Seedance 2.0 Mini, Gemini Omni Video, Grok Imagine 1.5, HappyHorse, Nano Banana 2
# Lite, Seedream 5 Lite, Z-Image) send what each engine expects; Motion Control (a character performs the movement of a video:
# both files and the rights confirmed before anything is charged, never moved to another model, priced by the video's length);
# Recipes (steps in a row: the server starts each step from the result of the one before, charges it when it starts, stops
# when a step fails or can't be paid); "what the AI received" (the words and settings, never file addresses); and the pages.
import asyncio, hashlib, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8131, 8132
D = tempfile.mkdtemp(prefix="nooi-v83-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN, POOR = "nooi_" + "c" * 32, "nooi_" + "p" * 32
tok = lambda t: [{"id": "tk", "name": "t", "hash": hashlib.sha256(t.encode()).hexdigest(), "last4": t[-4:], "created": 1, "dailyCap": 100000}]   # (engine tests: no daily limit in the way)
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": tok(TOKEN)},
  "poor": {"plan": "studio", "planUntil": 4102444800000, "credits": 12, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": tok(POOR)}}}, open(D + "/data/db.json", "w"))
for n, src in (("char.png", "color=c=0x30a050:s=320x480"), ("move.mp4", "testsrc2=size=320x480:rate=10")):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", src] + (["-frames:v", "1"] if n.endswith(".png") else ["-t", "4", "-pix_fmt", "yuv420p"]) + [D + "/media/" + n], check=True)
MOCK = r"""
const http=require('http');const P=+process.argv[2];const st={tasks:[]};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');const send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(u.pathname.startsWith('/out.')){s.setHeader('content-type',u.pathname.endsWith('.png')?'image/png':'video/mp4');return s.end(Buffer.alloc(64))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 if(u.pathname==='/api/v1/jobs/createTask'||u.pathname==='/api/v1/veo/generate'){const j=JSON.parse(b||'{}'),id='t'+(++n);T[id]=j;st.tasks.push(j);return send({taskId:id})}
 if(u.pathname==='/api/v1/jobs/recordInfo'){const j=T[u.searchParams.get('taskId')]||{},p=JSON.stringify(j);
  if(/FAILME/.test(p))return send({state:'fail',failMsg:'Internal Error, Please try again later.'});
  const out='http://localhost:'+P+(/image|nano|seedream|z-image|flux|qwen|gpt-image|imagen|ideogram/.test(j.model||'')&&!/video/.test(j.model||'')?'/out.png':'/out.mp4');
  return send({state:'success',resultJson:JSON.stringify({resultUrls:[out]})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
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
    r = subprocess.run(["node", "--input-type=module", "-e", js + "\nsetTimeout(() => process.exit(0), 300);"], capture_output=True, text=True, timeout=120, cwd=D,
                       env=dict(os.environ, SECRET_KEY="v" * 40, PUBLIC_BASE_URL="https://x.test", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"))
    try: return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: return {"_err": (r.stdout + r.stderr)[-800:]}
def wait_job(jid, token=None, secs=40, until=("done", "failed")):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        j = api("/v1/jobs/" + jid, token=token)
        if j.get("status") in until: return j
        time.sleep(.4)
    return j

def unit_checks():
    v = node(f"""import {{ kieInput, kieDur, KIE_BUILTIN, sentView }} from "{ROOT}/providers/kie.js"; import {{ cleanChain }} from "{ROOT}/lib/recipes.js";
      const V = (m, extra) => kieInput(m, {{ kind: "video", prompt: "a dancer", dur: 7, aspect: "21:9", ...(extra || {{}}) }}), I = (m, extra) => kieInput(m, {{ kind: "image", prompt: "x".repeat(1500), aspect: "2:3", ...(extra || {{}}) }});
      console.log(JSON.stringify({{
        ids: [KIE_BUILTIN.video.kling30t, KIE_BUILTIN.video.seedance2mini, KIE_BUILTIN.video.gemomni, KIE_BUILTIN.video.grok15, KIE_BUILTIN.video.happyhorse, KIE_BUILTIN.video.mc26, KIE_BUILTIN.video.mc30, KIE_BUILTIN.image.nano2lite, KIE_BUILTIN.image.seedream5lite, KIE_BUILTIN.image.zimage],
        turbo: V("kling/v3-turbo-text-to-video"), turboI: V("kling/v3-turbo-image-to-video", {{ inputs: {{ startImage: "https://x/a.png" }} }}),
        mini: V("bytedance/seedance-2-mini", {{ meta: {{ res: "1080p" }} }}), omni: V("gemini-omni-video"), grok: V("grok-imagine-video-1-5-preview", {{ inputs: {{ startImage: "https://x/a.png" }} }}),
        horse: V("happyhorse/text-to-video"), horseI: V("happyhorse/image-to-video", {{ inputs: {{ startImage: "https://x/a.png" }} }}),
        mc26: V("kling-2.6/motion-control", {{ inputs: {{ mcChar: "https://x/c.png", mcMove: "https://x/m.mp4" }}, meta: {{ res: "1080p" }} }}), mc30: V("kling-3.0/motion-control", {{ inputs: {{ mcChar: "https://x/c.png", mcMove: "https://x/m.mp4" }}, meta: {{ orient: "image" }} }}),
        lite: I("nano-banana-2-lite", {{ inputs: {{ iRef: "https://x/r.png" }} }}), zimg: I("z-image"), sd5: I("seedream/5-lite-text-to-image", {{ meta: {{ res: "4k" }} }}),
        dur: [kieDur("kling-2.6/motion-control", 12), kieDur("kling-2.6/motion-control", 45), kieDur("kling/v3-turbo-text-to-video", 20), kieDur("gemini-omni-video", 7), kieDur("grok-imagine-video-1-5-preview", 20), kieDur("happyhorse/text-to-video", 2)],
        sent: sentView({{ prompt: "hi", image_urls: ["https://x/a.png", "https://x/b.png"], video_urls: ["https://x/m.mp4"], duration: "5", aspect_ratio: "9:16", callBackUrl: "https://secret", nsfw_checker: true }}),
        chain: cleanChain([{{ kind: "video", model: "kling26", prompt: "p".repeat(3000), dur: 99, meta: {{ tool: "x", chain: [{{ kind: "video" }}], evil: 1 }} }}, {{ kind: "admin" }}, {{ kind: "image", model: "bad model!" }}, {{ kind: "finish" }}, {{ kind: "voice" }}, {{ kind: "music" }}])
      }}))""")
    out["unit"] = {k: v.get(k) for k in ("ids", "dur", "sent")}
    ok(v.get("ids") == ["kling/v3-turbo-text-to-video", "bytedance/seedance-2-mini", "gemini-omni-video", "grok-imagine-video-1-5-preview", "happyhorse/text-to-video", "kling-2.6/motion-control", "kling-3.0/motion-control", "nano-banana-2-lite", "seedream/5-lite-text-to-image", "z-image"], f"engine ids {v.get('ids')} {v.get('_err')}")
    t = v.get("turbo", {}); ok(t.get("aspect_ratio") == "16:9" and t.get("duration") == "7" and t.get("resolution") == "720p" and "image_urls" not in t, f"Kling 3.0 Turbo text {t}")
    t = v.get("turboI", {}); ok(t.get("image_urls") == ["https://x/a.png"] and "aspect_ratio" not in t, f"Kling 3.0 Turbo picture {t}")
    t = v.get("mini", {}); ok(t.get("resolution") == "720p" and t.get("aspect_ratio") == "21:9" and t.get("duration") == 7, f"Seedance 2.0 Mini: 1080p asked → 720p (Mini makes 480p/720p) {t}")
    t = v.get("omni", {}); ok(t.get("duration") == "6" and t.get("aspect_ratio") == "16:9", f"Gemini Omni Video: 4/6/8/10 s, 16:9 or 9:16 {t}")
    t = v.get("grok", {}); ok(t.get("image_urls") == ["https://x/a.png"] and t.get("duration") == 7 and t.get("resolution") == "720p", f"Grok Imagine 1.5 {t}")
    t = v.get("horse", {}); ok(t.get("resolution") == "1080p" and t.get("aspect_ratio") == "16:9" and t.get("duration") == 7, f"HappyHorse text {t}")
    t = v.get("horseI", {}); ok(t.get("image_urls") == ["https://x/a.png"] and "resolution" not in t and "aspect_ratio" not in t, f"HappyHorse picture {t}")
    t = v.get("mc26", {}); ok(t.get("input_urls") == ["https://x/c.png"] and t.get("video_urls") == ["https://x/m.mp4"] and t.get("mode") == "1080p" and t.get("character_orientation") == "image" and "background_source" not in t, f"Motion Control 2.6 {t}")
    t = v.get("mc30", {}); ok(t.get("character_orientation") == "image" and t.get("background_source") == "input_video" and t.get("mode") == "720p", f"Motion Control 3.0 {t}")
    t = v.get("lite", {}); ok(t.get("image_urls") == ["https://x/r.png"] and t.get("aspect_ratio") == "2:3" and "resolution" not in t, f"Nano Banana 2 Lite (not the Nano Banana 2 shape) {t}")
    t = v.get("zimg", {}); ok(len(t.get("prompt", "")) == 1000 and t.get("aspect_ratio") in ("3:4", "1:1") and t.get("nsfw_checker") is True, f"Z-Image: 1000 characters, its sizes {dict(t, prompt=len(t.get('prompt','')))}")
    t = v.get("sd5", {}); ok(t.get("quality") == "high" and t.get("aspect_ratio") == "2:3", f"Seedream 5 Lite 4K {t}")
    ok(v.get("dur") == [12, 30, 15, 6, 15, 3], f"lengths {v.get('dur')}")
    s = v.get("sent", {}); ok(s == {"prompt": "hi", "duration": "5", "aspect_ratio": "9:16", "pictures": 2, "videos": 1}, f"what the AI received: words and settings, no addresses {s}")
    c = v.get("chain") or []
    ok(len(c) == 4 and [x["kind"] for x in c] == ["video", "image", "finish", "voice"] and len(c[0]["prompt"]) == 2000 and c[0]["dur"] == 30 and c[0]["meta"] == {"tool": "x"} and "model" not in c[1], f"recipe steps are cleaned (4 at most, known kinds, no nested steps) {c}")

async def main():
    unit_checks()
    mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "REALTIME_", "DEPTH_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MC_AGAIN_MS="400", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(60):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.5)
        cfg = api("/v1/config"); P = cfg.get("prices", {})
        ok(all(P.get("video", {}).get(k) for k in ("kling30t", "seedance2mini", "gemomni", "grok15", "happyhorse", "mc26", "mc30")) and all(P.get("image", {}).get(k) for k in ("nano2lite", "seedream5lite", "zimage")), f"prices for the new engines {P.get('video')}")
        ok((cfg.get("registry") or {}).get("mc26", {}).get("name") == "Motion Control 2.6", "registry names Motion Control")
        # Motion Control: both files and the rights confirmed before anything is charged
        c0 = api("/v1/billing", token=TOKEN)["credits"]; mc = {"kind": "video", "model": "mc26", "prompt": "", "dur": 12, "aspect": "9:16", "meta": {"res": "720p", "orient": "video"}, "inputs": {"mcChar": "/media/char.png", "mcMove": "/media/move.mp4"}}
        r1 = api("/v1/jobs", mc, token=TOKEN); r2 = api("/v1/jobs", {**mc, "meta": {**mc["meta"], "consent": True}, "inputs": {"mcChar": "/media/char.png"}}, token=TOKEN)
        ok(r1.get("_status") == 400 and "right to use" in r1.get("error", "") and r2.get("_status") == 400 and "movement" in r2.get("error", "") and api("/v1/billing", token=TOKEN)["credits"] == c0, f"Motion Control refused before charging: rights {r1} · movement video {r2}")
        j = api("/v1/jobs", {**mc, "meta": {**mc["meta"], "consent": True}}, token=TOKEN); c1 = api("/v1/billing", token=TOKEN)["credits"]
        price5 = P["video"]["mc26"]; ok(j.get("cost") == round(price5 * 12 / 5 * 1.5) and c1 == c0 - j.get("cost", 0) and j.get("dur") == 12, f"Motion Control priced by the movement video's length (12 s), always at 1080p (v104) {j.get('cost')} vs {price5}/5 s")
        jd = wait_job(j.get("id", ""), TOKEN); task = next((t for t in stats()["tasks"] if t.get("model") == "kling-2.6/motion-control"), {})
        inp = task.get("input") or {}
        ok(jd.get("status") == "done" and len(inp.get("input_urls") or []) == 1 and inp["input_urls"][0].startswith(f"http://localhost:{PORT}/media/") and inp["input_urls"][0].endswith("-mc.jpg") and inp.get("video_urls") == [f"http://localhost:{PORT}/media/move.mp4"] and inp.get("character_orientation") == "video", f"Motion Control job: the engine gets both files {jd.get('status')} {inp}")
        s = jd.get("sent") or {}; ok(s.get("pictures") == 1 and s.get("videos") == 1 and "localhost" not in json.dumps(s), f"what the AI received (no file addresses) {s}")
        # 1080p costs more; a failed Motion Control job is never moved to another model, and its credits come back
        nb = len(stats()["tasks"])   # (v95: the files are made ready first, so the engine request can come just after the reply)
        j2 = api("/v1/jobs", {**mc, "dur": 5, "prompt": "FAILME", "meta": {**mc["meta"], "consent": True, "res": "1080p"}}, token=TOKEN)
        ok(j2.get("cost") == round(price5 * 1.5), f"Motion Control 1080p ×1.5 {j2.get('cost')}")
        n0 = len(stats()["tasks"]); jf = wait_job(j2.get("id", ""), TOKEN); time.sleep(1)
        # (v102: the same engine is asked once more when it fails on its own side — never another model)
        mt = [t.get("model") for t in stats()["tasks"][nb:]]
        # (v113: the engine's "please try again later" is a busy engine — asked twice more, on the same engine)
        ok(jf.get("status") == "failed" and mt == ["kling-2.6/motion-control"] * 3 and api("/v1/billing", token=TOKEN)["credits"] == c1, f"Motion Control failure: a busy engine asked twice more on the same engine, no other model tried, credits back {jf.get('status')} {mt}")
        # Grok Imagine 1.5 starts from a picture
        g = api("/v1/jobs", {"kind": "video", "model": "grok15", "prompt": "a cat", "dur": 6}, token=TOKEN)
        ok(g.get("_status") == 400 and "picture" in g.get("error", ""), f"Grok Imagine 1.5 needs a picture {g}")
        # a recipe: picture → video from it → sharper copy; each step starts from the one before
        c2 = api("/v1/billing", token=TOKEN)["credits"]
        r = api("/v1/jobs", {"kind": "image", "model": "zimage", "prompt": "an oud perfume bottle", "aspect": "9:16", "cid": "rcp1",
            "meta": {"recipe": "r1", "step": 0, "chain": [{"kind": "video", "model": "seedance2mini", "prompt": "slow orbit", "dur": 5}, {"kind": "finish", "meta": {"tool": "upscale"}}, {"kind": "admin"}]}}, token=TOKEN)
        a = wait_job(r.get("id", ""), TOKEN); t0 = time.time()
        while not a.get("next") and time.time() - t0 < 15: time.sleep(.4); a = api("/v1/jobs/" + r["id"], token=TOKEN)
        b = wait_job(a.get("next") or "x", TOKEN); t0 = time.time()
        while not b.get("next") and time.time() - t0 < 15: time.sleep(.4); b = api("/v1/jobs/" + (a.get("next") or "x"), token=TOKEN)
        c = wait_job(b.get("next") or "x", TOKEN); time.sleep(1); cc = api("/v1/jobs/" + (b.get("next") or "x"), token=TOKEN)
        tasks = stats()["tasks"]; vt = next((t for t in tasks if t.get("model") == "bytedance/seedance-2-mini" and "slow orbit" in json.dumps(t)), {}); up = next((t for t in reversed(tasks) if "upscale" in str(t.get("model"))), {})
        out["recipe"] = [a.get("status"), b.get("status"), c.get("status"), b.get("step"), c.get("step"), cc.get("next")]
        ok(a.get("status") == "done" and b.get("status") == "done" and c.get("status") == "done" and b.get("step") == 1 and c.get("step") == 2 and not cc.get("next"), f"recipe: three steps made in a row, no fourth (unknown kind dropped) {out['recipe']}")
        ok(vt.get("input", {}).get("first_frame_url") == "http://localhost:8132/out.png" and up.get("input", {}).get("video_url") == "http://localhost:8132/out.mp4", f"each step starts from the result before it {vt.get('input')} · {up.get('input')}")
        spent = c2 - api("/v1/billing", token=TOKEN)["credits"]; want = P["image"]["zimage"] + P["video"]["seedance2mini"] + (P.get("fixed", {}).get("finish") or 0)
        ok(spent == want, f"recipe: each step charged once ({spent} vs {want})")
        # a step that can't be paid stops the recipe; what was made is kept
        r = api("/v1/jobs", {"kind": "image", "model": "zimage", "prompt": "a small poster", "aspect": "1:1", "meta": {"chain": [{"kind": "video", "model": "kling30t", "prompt": "move", "dur": 5}]}}, token=POOR)
        a = wait_job(r.get("id", ""), POOR); t0 = time.time()
        while not a.get("chainError") and time.time() - t0 < 15: time.sleep(.4); a = api("/v1/jobs/" + r.get("id", "x"), token=POOR)
        ok(a.get("status") == "done" and a.get("chainError") and not a.get("next"), f"recipe stops when the next step can't be paid {a.get('status')} {a.get('chainError')}")
        # a failed step stops the recipe and its credits come back
        c3 = api("/v1/billing", token=TOKEN)["credits"]
        r = api("/v1/jobs", {"kind": "image", "model": "zimage", "prompt": "FAILME poster", "aspect": "1:1", "meta": {"chain": [{"kind": "video", "model": "seedance2mini", "prompt": "move", "dur": 5}]}}, token=TOKEN)
        a = wait_job(r.get("id", ""), TOKEN); time.sleep(1.5); a = api("/v1/jobs/" + r.get("id", "x"), token=TOKEN)
        ok(a.get("status") == "failed" and not a.get("next") and api("/v1/billing", token=TOKEN)["credits"] == c3, f"a failed step: no next step, credits back {a.get('status')} {a.get('next')}")
        async with async_playwright() as p: await browser_checks(p)
    finally:
        srv.terminate(); mk.terminate()
        try: out["serverLog"] = srv.stderr.read().decode()[-1200:]
        except Exception: pass

async def browser_checks(p):
    b = await p.chromium.launch(); errs = []
    for lang, w in (("en", 1280), ("ar", 390)):
        mob = w < 600; ctx = await b.new_context(viewport={"width": w, "height": 860 if mob else 900}, is_mobile=mob, has_touch=mob)
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:200])); tag = f"{lang} {w}"
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await pg.evaluate("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}", lang); await pg.wait_for_timeout(400)
        # the new engines are in the pickers with prices from the server
        r = await pg.evaluate("()=>({v:['kling30t','seedance2mini','gemomni','grok15','happyhorse'].map(k=>MODELS[k]&&MODELS[k].cr),i:['nano2lite','seedream5lite','zimage'].map(k=>IMG_MODELS[k]&&IMG_MODELS[k].cr),mcInPicker:!!MODELS.mc26,p:API.cfg.prices.video.kling30t})")
        ok(all(r["v"]) and all(r["i"]) and r["v"][0] == r["p"] and not r["mcInPicker"], f"{tag}: new engines in the pickers (Motion Control only on its own page) {r}")
        # Motion Control page: the tab after nooi Studio (Cinema Studio is part of it since v93), a title, two uploads, the rights box
        await pg.evaluate("()=>{go('motion');renderAll()}"); await pg.wait_for_timeout(400)
        r = await pg.evaluate("()=>({h1:document.querySelector('#main h1').textContent,tabs:[...document.querySelectorAll('.hubtabs [data-go]')].map(e=>e.dataset.go),slots:document.querySelectorAll('#main input[data-slot=\"mcMove\"],#main input[data-slot=\"mcChar\"]').length,consent:!!document.querySelector('[data-mc83consent]'),over:document.documentElement.scrollWidth>innerWidth})")
        ok(r["h1"] in ("Motion Control", "التحكم بالحركة") and r["tabs"][:2] == ["video", "motion"] and "cinema" not in r["tabs"] and r["slots"] == 2 and r["consent"] and not r["over"], f"{tag}: Motion Control page {r}")
        await pg.click('[data-act="mc-make"]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("()=>S.jobs.filter(j=>j.meta&&j.meta.motion83).length") == 0, f"{tag}: nothing is made without the files")
        if lang == "en":
            # make one: files from the library (made on the server), rights confirmed
            await pg.evaluate("""()=>{const mk=(kind,u,dur)=>{const j={id:uid(),kind,status:'complete',resultUrl:u,prompt:kind,title:kind,dur,created:Date.now(),remote:'x'+kind};S.jobs.push(j);return j};
              const v=mk('video','/media/move.mp4',4),i=mk('image','/media/char.png');M.mcMove={type:'video',url:v.resultUrl,remote:v.resultUrl,name:'move',libDur:4};M.mcChar={type:'image',url:i.resultUrl,remote:i.resultUrl,name:'char'};S.mc83.consent=true;S.mc83.mode='moves';renderView()}""")
            await pg.wait_for_timeout(300); n0 = len(stats()["tasks"])
            await pg.click('[data-act="mc-make"]'); await pg.wait_for_timeout(5000)
            r = await pg.evaluate("()=>{const j=S.jobs.filter(j=>j.meta&&j.meta.motion83).pop();return j&&{status:j.status,dur:j.dur,model:j.model,remote:!!j.remote}}")
            t = stats()["tasks"][n0:]
            ok(r and r["remote"] and r["dur"] == 4 and r["model"] == "mc30" and any(x.get("model") == "kling-3.0/motion-control" for x in t), f"{tag}: Motion Control from the page reaches the engine {r} {t[-1:] if t else t}")
            ok(await pg.evaluate("()=>!!document.querySelector('details.sent83')"), f"{tag}: the result has 'What the AI received'")
            await pg.evaluate("()=>{const d=document.querySelector('details.sent83');d.open=true}"); await pg.wait_for_timeout(1500)
            st = await pg.evaluate("()=>document.querySelector('details.sent83 .sent83b').innerText")
            ok(("Pictures sent" in st and "Videos sent" in st) or "Follows" in st, f"{tag}: what the AI received is shown {st!r}")
        # Recipes: five ready recipes, steps with prices, a run makes the steps one after another
        await pg.evaluate("()=>{go('recipes');renderAll()}"); await pg.wait_for_timeout(400)
        r = await pg.evaluate("()=>({h1:document.querySelector('#main h1').textContent,cards:document.querySelectorAll('.rc83').length,steps:document.querySelectorAll('.rsteps83 li').length,tabs:[...document.querySelectorAll('.hubtabs [data-go]')].map(e=>e.dataset.go),over:document.documentElement.scrollWidth>innerWidth})")
        ok(r["h1"] in ("Recipes", "الوصفات") and r["cards"] == 5 and r["steps"] == 3 and r["tabs"] == ["explore", "discover", "community204", "recipes"] and not r["over"], f"{tag}: Recipes page {r}")
        await pg.click('[data-act="rec-run"]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("()=>(S.rec83.runs||[]).length") == 0, f"{tag}: a recipe needs the idea first")
        if lang == "en":
            await pg.click('[data-act="rec-pick"][data-v="poster"]'); await pg.wait_for_timeout(200)
            await pg.fill("#rec83idea", "Riyadh season night market"); await pg.wait_for_timeout(200)
            await pg.click('[data-act="rec-run"]')
            t0 = time.time(); run = {}
            while time.time() - t0 < 45:
                await pg.wait_for_timeout(1500); run = await pg.evaluate("()=>{const r=S.rec83.runs.slice(-1)[0];return r&&{status:r.status,n:r.jobs.length,st:r.jobs.map(id=>(S.jobs.find(x=>x.id===id)||{}).status)}}")
                if run and run.get("status") != "running": break
            ok(run and run["status"] == "done" and run["n"] == 2 and run["st"] == ["complete", "complete"], f"{tag}: the poster recipe made its two steps {run}")
            ok(await pg.evaluate("()=>document.querySelectorAll('.run83 .strip [data-open-job]').length") == 2, f"{tag}: the run shows both steps")
            await pg.click('[data-act="rec-save"]'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("()=>S.rec83.mine.length===1&&document.querySelectorAll('.rc83').length===6"), f"{tag}: save as my recipe")
        await ctx.close()
    await b.close()
    ok(not errs, f"no page errors {errs[:5]}")

asyncio.run(main())
print(json.dumps({"fails": fails, **out}, ensure_ascii=False, indent=1, default=str))
