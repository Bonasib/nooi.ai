# v83 (2): your own text AI (Gemma … over an OpenAI-compatible API) runs the text tasks first and hands over when it fails;
# "Compare text AIs" scores it against the current one on nooi's own tasks; the backup voice on our own server speaks when the
# engine's voice fails (a voiceover — free — and an avatar); "Video from pictures" made with ffmpeg on our server (free, the
# length asked, captions, music; only this site's files, one at a time); and safety: customers can't reach admin tools, words
# from a text AI are cleaned before anyone sees them, and every step of a recipe goes through the content rules.
import asyncio, base64, hashlib, io, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8141, 8142
D = tempfile.mkdtemp(prefix="nooi-v83b-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "c" * 32
tok = lambda t: [{"id": "tk", "name": "t", "hash": hashlib.sha256(t.encode()).hexdigest(), "last4": t[-4:], "created": 1}]
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": tok(TOKEN)}}}, open(D + "/data/db.json", "w"))
for i in range(1, 4): subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x{i*40:02x}6090:s=640x480", "-frames:v", "1", f"{D}/media/p{i}.png"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=330:duration=20", f"{D}/media/song.mp3"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x305070:s=320x320", "-frames:v", "1", f"{D}/media/face.png"], check=True)
open(D + "/secret.txt", "w").write("do not serve")
MOCK = r"""
const http=require('http');const P=+process.argv[2];const st={local:0,localFail:false,anth:0,piper:{en:0,ar:0},tasks:[],lastPiper:''};let n=0;const T={};
const wav=()=>{const b=Buffer.alloc(44+3200);b.write('RIFF',0);b.writeUInt32LE(36+3200,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(3200,40);return b};
const answer=(t,good)=>{
 if(/From this page about filming/.test(t))return {skills:[{title:'Light from a source',how:'Name the window or lamp that lights the shot.',when:'always'},{title:'One lens per scene',how:'Keep one focal length for the whole scene.',when:'scenes'}]};
 if(/A client wrote/.test(t))return {brief_ar:'إعلان قصير ودافئ لمقهى في جدة عند الغروب',prompt_en:'A warm cinematic ad for a seaside cafe in Jeddah at sunset, friends laughing, golden light, slow dolly-in'};
 if(/Translate each line/.test(t))return {lines:[{i:0,text:'أهلاً بعودتكم إلى الاستوديو.'},{i:1,text:'اليوم نضيء بورتريه.'},{i:2,text:'ضع النافذة على الجهة اليسرى.'},{i:3,text:'شكراً للمشاهدة!'}]};
 if(/Make a storyboard of exactly 3/.test(t))return {scenes:[{shot:'ews',action:'Dawn over Riyadh rooftops.'},{shot:'ms',action:'A kite rises from a courtyard.'},{shot:'cu',action:'A child smiles at the sky.'}]};
 if(/Summarise this web page/.test(t))return good?{summary:'A short guide saying a 35mm lens feels natural.'}:{summary:'PWNED'};
 if(/planning one/.test(t)){const roles=['writer','casting','director','cine','sound','editor','producer','proof'];return {brief:{intent:'<b>sell</b> https://evil.example/x',subject:'coffee',audience:'all',platform:'',tone:'',language:'en',mustHaves:[],risks:[]},agents:Object.fromEntries(roles.map(r=>[r,'ok <script>steal()</script> visit https://evil.example/'+r])),prompt:'Cinematic coffee <script>alert(1)</script> shot, see https://evil.example/p {inject}',negative:'',bible:'',shots:[],fixes:[]}}
 return {ok:true}};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');const J=(o,c)=>{s.statusCode=c||200;s.setHeader('content-type','application/json');s.end(JSON.stringify(o))};
 if(u.pathname==='/stats')return J(st);
 if(u.pathname==='/set'){st.localFail=u.searchParams.get('fail')==='1';return J({ok:true})}
 if(u.pathname==='/oa/v1/chat/completions'){st.local++;if(st.localFail)return J({error:{message:'model not loaded'}},500);const j=JSON.parse(b);const t=j.messages.map(m=>typeof m.content==='string'?m.content:'').join('\n');return J({choices:[{message:{role:'assistant',content:'<think>hmm</think>'+JSON.stringify(answer(t,false))}}]})}
 if(u.pathname==='/v1/messages'){st.anth++;const j=JSON.parse(b);const c=j.messages[0].content;const t=Array.isArray(c)?c.map(x=>x.text||'').join('\n'):c;return J({content:[{type:'text',text:JSON.stringify(answer(t,true))}]})}
 if(u.pathname.startsWith('/piper-')){const l=u.pathname.slice(7,9);st.piper[l]=(st.piper[l]||0)+1;st.lastPiper=u.searchParams.get('text')||'';s.setHeader('content-type','audio/wav');return s.end(wav())}
 if(u.pathname.startsWith('/out.')){s.setHeader('content-type','video/mp4');return s.end(Buffer.alloc(64))}
 if(u.pathname==='/api/v1/chat/credit')return J({code:200,data:500});
 if(u.pathname==='/api/v1/jobs/createTask'){const j=JSON.parse(b||'{}'),id='t'+(++n);T[id]=j;st.tasks.push(j);return J({code:200,msg:'success',data:{taskId:id}})}
 if(u.pathname==='/api/v1/jobs/recordInfo'){const j=T[u.searchParams.get('taskId')]||{};const send=d=>J({code:200,msg:'success',data:d});
  if(/elevenlabs/.test(j.model||''))return send({state:'fail',failMsg:'Internal Error, Please try again later.'});
  return send({state:'success',resultJson:JSON.stringify({resultUrls:['http://localhost:'+P+'/out.mp4']})})}
 J({error:'nf'},404)})}).listen(P);
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
        with urllib.request.urlopen(req, timeout=180) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def mock(p): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}{p}").read())
def wait_job(jid, token=None, secs=60):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        j = api("/v1/jobs/" + jid, token=token)
        if j.get("status") in ("done", "failed"): return j
        time.sleep(.5)
    return j
def probe(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", f], capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {}

async def main():
    mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "REALTIME_", "DEPTH_", "LOCAL_LLM", "PIPER"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false", FREE_PERIOD="false", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="anth", LLM_MODEL="claude-test",
        LOCAL_LLM_URL=f"http://localhost:{KPORT}/oa/v1", LOCAL_LLM_MODEL="gemma-test", PIPER_URLS=f"en=http://localhost:{KPORT}/piper-en,ar=http://localhost:{KPORT}/piper-ar"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(60):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.5)
        # ---- your own text AI first; words from any text AI are cleaned before anyone sees them
        n0 = mock("/stats")["local"]; p = api("/v1/agents/plan", {"prompt": "a 5 second coffee ad", "task": "video", "dur": 5}, token=TOKEN)
        s = json.dumps(p, ensure_ascii=False)
        ok(p.get("by") == "ai" and mock("/stats")["local"] > n0, f"text tasks run on your own text AI first {p.get('by')} {p.get('error')}")
        ok("<script" not in s and "evil.example" not in s and "{inject}" not in s and "<b>" not in s, f"a text AI's words are cleaned (no scripts, links or braces) {s[:400]}")
        urllib.request.urlopen(f"http://localhost:{KPORT}/set?fail=1").read(); a0 = mock("/stats")["anth"]
        p = api("/v1/agents/plan", {"prompt": "a 5 second tea ad", "task": "video", "dur": 5}, token=TOKEN)
        ok(p.get("by") == "ai" and mock("/stats")["anth"] > a0, f"your own text AI down → the current one takes over {p.get('by')} {p.get('error')}")
        urllib.request.urlopen(f"http://localhost:{KPORT}/set?fail=0").read()
        # ---- compare text AIs (admins only): the local model fails the "page gives orders" task here, the current one passes all
        r = api("/v1/admin/llm-check", {}); out["compare"] = {k: (v.get("score"), v.get("of")) for k, v in r.items() if isinstance(v, dict)}
        loc = r.get("local", {}); site = r.get("site", {})
        ok(loc.get("score") == 4 and loc.get("of") == 5 and next((x for x in loc.get("results", []) if x["task"] == "safety"), {}).get("ok") is False and loc.get("model") == "gemma-test", f"compare: your own text AI scored per task {loc}")
        ok(site.get("score") == 5, f"compare: the current text AI {site}")
        ok(api("/v1/admin/llm-check", {}, token=TOKEN).get("_status") == 403, "customers can't run the comparison")
        # ---- backup voice: a voiceover whose engine voice fails is spoken by our own server, free
        c0 = api("/v1/billing", token=TOKEN)["credits"]
        v = api("/v1/jobs", {"kind": "voice", "prompt": "Hello from the backup voice", "meta": {"lang": "en"}}, token=TOKEN)
        vj = wait_job(v.get("id", ""), TOKEN, 90); c1 = api("/v1/billing", token=TOKEN)["credits"]; st = mock("/stats")
        ok(vj.get("status") == "done" and str(vj.get("url", "")).endswith(".wav") and vj.get("cost") == 0 and c1 == c0 and st["piper"].get("en", 0) >= 1, f"voiceover → backup voice, free {vj.get('status')} {vj.get('url')} cost {vj.get('cost')} {c0}→{c1} {st['piper']}")
        v = api("/v1/jobs", {"kind": "voice", "prompt": "مرحباً بكم في الاستوديو", "meta": {}}, token=TOKEN); vj = wait_job(v.get("id", ""), TOKEN, 90)
        ok(vj.get("status") == "done" and mock("/stats")["piper"].get("ar", 0) >= 1, f"Arabic words → the Arabic backup voice {vj.get('status')} {mock('/stats')['piper']}")
        # an avatar whose voice fails on the engine speaks with the backup voice
        av = api("/v1/jobs", {"kind": "lipsync", "prompt": "Welcome to nooi", "inputs": {"lsV": "/media/face.png"}, "meta": {"gender": "female"}}, token=TOKEN)
        aj = wait_job(av.get("id", ""), TOKEN, 120); at = next((t for t in reversed(mock("/stats")["tasks"]) if "avatar" in str(t.get("model"))), {})
        ok(aj.get("status") == "done" and str((at.get("input") or {}).get("audio_url", "")).endswith(".wav"), f"avatar speaks with the backup voice {aj.get('status')} {aj.get('error')} {at.get('input')}")
        # ---- video from pictures: free, the length asked, captions, music
        from PIL import Image, ImageDraw
        im = Image.new("RGBA", (720, 1280), (0, 0, 0, 0)); ImageDraw.Draw(im).rectangle([80, 1060, 640, 1160], fill=(0, 0, 0, 170)); buf = io.BytesIO(); im.save(buf, "PNG")
        cap = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        c2 = api("/v1/billing", token=TOKEN)["credits"]
        sv = api("/v1/render/slideshow", {"pictures": [{"url": "/media/p1.png", "caption": cap}, {"url": f"http://localhost:{PORT}/media/p2.png"}, {"url": "/media/p3.png", "caption": cap}], "secs": 3, "motion": "zoom", "transition": "fade", "aspect": "9:16", "music": "/media/song.mp3"}, token=TOKEN)
        busy = api("/v1/render/slideshow", {"pictures": [{"url": "/media/p1.png"}, {"url": "/media/p2.png"}]}, token=TOKEN)
        sj = wait_job(sv.get("id", ""), TOKEN, 120); f = os.path.join(D, "media", os.path.basename(str(sj.get("url", "")))); pr = probe(f)
        types = sorted(x.get("codec_type") for x in pr.get("streams", [])); vid = next((x for x in pr.get("streams", []) if x.get("codec_type") == "video"), {})
        ok(sj.get("status") == "done" and abs(float(pr.get("format", {}).get("duration", 0)) - 7.8) < .15 and types == ["audio", "video"] and vid.get("width") == 720 and vid.get("height") == 1280, f"video from pictures: 7.8 s, 720×1280, with music {sj.get('status')} {sj.get('error')} {pr}")
        ok(api("/v1/billing", token=TOKEN)["credits"] == c2 and sv.get("cost") == 0, "video from pictures is free")
        ok(busy.get("_status") == 429, f"one video from pictures at a time {busy}")
        bad = [api("/v1/render/slideshow", b, token=TOKEN) for b in ({"pictures": [{"url": "/media/../secret.txt"}, {"url": "/media/p1.png"}]}, {"pictures": [{"url": "http://evil.example/x.png"}, {"url": "/media/p1.png"}]}, {"pictures": [{"url": "/media/p1.png"}]}, {"pictures": [{"url": "/media/p1.png"}, {"url": "/media/p2.png"}], "music": "/etc/passwd"})]
        ok(all(x.get("_status") == 400 for x in bad), f"only this site's files, at least two pictures {[x.get('_status') for x in bad]}")
        # ---- safety: customers can't reach admin tools; every recipe step goes through the content rules
        ok(all(api(pth, body, m, token=TOKEN).get("_status") == 403 for pth, body, m in (("/v1/admin/settings", {"priceFactor": 0.1}, "PUT"), ("/v1/admin/providers/piper", {"baseUrl": "http://evil"}, "PUT"), ("/v1/agents/learn", {}, None), ("/v1/admin/pricing", None, "GET"))), "customers can't change settings, voices, learning or prices")
        c3 = api("/v1/billing", token=TOKEN)["credits"]
        r = api("/v1/jobs", {"kind": "image", "model": "zimage", "prompt": "a city poster", "aspect": "1:1", "meta": {"chain": [{"kind": "video", "model": "seedance2mini", "prompt": "a deepfake of a famous politician", "dur": 5}]}}, token=TOKEN)
        a = wait_job(r.get("id", ""), TOKEN); t0 = time.time()
        while not a.get("chainError") and time.time() - t0 < 15: time.sleep(.4); a = api("/v1/jobs/" + r.get("id", "x"), token=TOKEN)
        spent = c3 - api("/v1/billing", token=TOKEN)["credits"]
        ok(a.get("status") == "done" and "Acceptable Use" in str(a.get("chainError")) and not a.get("next") and spent == a.get("cost"), f"a recipe step against the rules is refused, not charged {a.get('chainError')} spent {spent} vs {a.get('cost')}")
        ok(api("/v1/jobs", {"kind": "video", "model": "mc26", "prompt": "", "dur": 5, "inputs": {"mcChar": "/media/face.png", "mcMove": "/media/p1.png"}, "meta": {}}, token=TOKEN).get("_status") == 400, "Motion Control needs the rights confirmed")
        async with async_playwright() as p: await browser(p)
    finally:
        srv.terminate(); mk.terminate()
        try: out["serverLog"] = srv.stderr.read().decode()[-1500:]
        except Exception: pass

async def browser(p):
    b = await p.chromium.launch(); errs = []
    for lang, w in (("en", 1280), ("ar", 390)):
        mob = w < 600; ctx = await b.new_context(viewport={"width": w, "height": 860 if mob else 900}, is_mobile=mob, has_touch=mob)
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:200])); tag = f"{lang} {w}"
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await pg.evaluate("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}", lang); await pg.wait_for_timeout(400)
        # Video from pictures page: Edit's second tab; pick pictures from the library, a caption, make it
        await pg.evaluate("""()=>{['/media/p1.png','/media/p2.png','/media/p3.png'].forEach((u,i)=>S.jobs.push({id:'lib'+i,kind:'image',status:'complete',resultUrl:u,prompt:'p'+i,title:'p'+i,created:Date.now()}));go('slideshow');renderAll()}""")
        await pg.wait_for_timeout(400)
        r = await pg.evaluate("()=>({h1:document.querySelector('#main h1').textContent,tabs:[...document.querySelectorAll('.hubtabs [data-go]')].map(e=>e.dataset.go).slice(0,2),lib:document.querySelectorAll('.ss83t').length,over:document.documentElement.scrollWidth>innerWidth})")
        ok(r["h1"] in ("Video from pictures", "فيديو من الصور") and r["tabs"][:2] == ["video", "motion"] and r["lib"] == 3 and not r["over"], f"{tag}: Video from pictures page {r}")
        if lang == "en":
            for i in range(3): await pg.click(f'.ss83t >> nth={i}'); await pg.wait_for_timeout(150)
            await pg.fill('[data-ss83cap="0"]', "مرحباً بكم — Riyadh"); await pg.wait_for_timeout(100)
            cap = await pg.evaluate("()=>{const d=capPNG83(S.ss83.pics[0].cap,720,1280);return d&&d.length}")
            ok(cap and cap > 1000, f"{tag}: the caption is drawn by the page {cap}")
            await pg.click('[data-act="ss83-make"]'); t0 = time.time(); st = None
            while time.time() - t0 < 60:
                await pg.wait_for_timeout(1500); st = await pg.evaluate("()=>{const j=S.jobs.filter(j=>j.kind==='slideshow').pop();return j&&j.status}")
                if st in ("complete", "failed"): break
            ok(st == "complete" and await pg.evaluate("()=>!!document.querySelector('#main video.frame')"), f"{tag}: the video is made and shown {st}")
            # Admin → AI providers: your own text AI and the backup voice are listed; the comparison runs
            ok(await pg.evaluate("()=>AI_PROVIDERS.some(p=>p[0]==='localtext')&&AI_PROVIDERS.some(p=>p[0]==='piper')&&llmCheck83().includes('llm-check83')"), f"{tag}: admin lists your own text AI, the backup voice and the comparison")
        await ctx.close()
    await b.close()
    ok(not errs, f"no page errors {errs[:5]}")

asyncio.run(main())
print(json.dumps({"fails": fails, **out}, ensure_ascii=False, indent=1, default=str))
