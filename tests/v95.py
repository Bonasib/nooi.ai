# v95 with a real nooi server and a stand-in for the engines (it records every request):
#  · Character Swap / Motion Control get files the engine can read: a phone video that is HEVC, 60 fps, 2560 px and stored
#    sideways (rotation tag) reaches the engine as an upright H.264 MP4, ≤ 1280 px, ≤ 30 fps, under 10 MB; a photo stored
#    sideways (EXIF orientation) reaches it upright as a JPEG; a video that is already fine is sent as it is; a video under
#    2 s or a file that isn't a video is refused with the reason and nothing charged
#  · when the engine takes the job and then fails, the person sees the engine's own reason (no engine company name), in
#    English or Arabic, and gets the credits back
#  · results: a /media file is read through the page's own address (the preview at :8443 vs the live site); a result still
#    on the engine's link is copied to the server first (the user's own job only)
#  · Sketch Live: with the switch on, the picture is made / updated by itself about a second after you stop drawing (no
#    button), one update at a time, with the faster engine for updates, the price on the switch, and it pauses after 10
# Run: python3 tests/v95.py
import asyncio, hashlib, io, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8231, 8232
D = tempfile.mkdtemp(prefix="nooi-v95-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "u" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "testsrc2=size=2560x1440:rate=60", "-t", "4", "-c:v", "libx265", "-preset", "ultrafast", "-tag:v", "hvc1", "-pix_fmt", "yuv420p", D + "/raw.mp4")
ff("-display_rotation:v:0", "90", "-i", D + "/raw.mp4", "-c", "copy", M + "phone.mp4")                      # stored sideways, shown upright
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25", "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", M + "fine.mp4")
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25", "-t", "1.4", "-c:v", "libx264", "-pix_fmt", "yuv420p", M + "short.mp4")
open(M + "broken.mp4", "w").write("not a video")
im = Image.new("RGB", (400, 300), (40, 120, 200)); im.paste((230, 30, 30), (0, 0, 400, 60)); ex = im.getexif(); ex[0x0112] = 6; im.save(M + "photo.jpg", exif=ex)   # top band red; shown rotated
for n, c in (("pic1.png", (32, 80, 208)), ("pic2.png", (48, 176, 80))): Image.new("RGB", (512, 512), c).save(D + "/" + n)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={tasks:[],failNext:null};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');const send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(u.pathname==='/failnext'){st.failNext=u.searchParams.get('msg');return s.end('{}')}
 if(/^\/pic[12]\.png$/.test(u.pathname)){s.setHeader('access-control-allow-origin','*');s.setHeader('content-type','image/png');return s.end(fs.readFileSync(path.join(DIR,u.pathname)))}
 if(u.pathname==='/nocors.png'){s.setHeader('content-type','image/png');return s.end(fs.readFileSync(path.join(DIR,'pic2.png')))}   // like an engine's own link: no CORS
 if(u.pathname==='/out.mp4'){s.setHeader('content-type','video/mp4');return s.end(fs.readFileSync(path.join(DIR,'media','fine.mp4')))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 const out=f=>'http://localhost:'+P+'/'+f;
 if(u.pathname==='/api/v1/jobs/createTask'){const j=JSON.parse(b||'{}'),id='t'+(++n);T[id]={...j,fail:st.failNext};st.failNext=null;st.tasks.push(j);return send({taskId:id})}
 if(u.pathname==='/api/v1/jobs/recordInfo'){const j=T[u.searchParams.get('taskId')]||{};if(j.fail)return send({state:'fail',failMsg:j.fail,failCode:'422'});
   const img=/nano|seedream|image/.test(j.model||'')&&!/video/.test(j.model||'');const f=img?(/Edit this picture/.test((j.input||{}).prompt||'')?'pic2.png':'pic1.png'):'out.mp4';return send({state:'success',resultJson:JSON.stringify({resultUrls:[out(f)]})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
def mock(p): urllib.request.urlopen(f"http://localhost:{KPORT}{p}").read()
def api(p, body=None, method=None, token=None):
    h = {"content-type": "application/json"}
    if token: h["authorization"] = "Bearer " + token
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
def fetch(url, to):
    if url.startswith("/"): url = f"http://localhost:{PORT}{url}"
    open(to, "wb").write(urllib.request.urlopen(url, timeout=30).read()); return to
def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], capture_output=True, text=True).stdout)
    v = [s for s in j["streams"] if s["codec_type"] == "video"][0]; a, b = v["avg_frame_rate"].split("/")
    return {"codec": v["codec_name"], "w": v["width"], "h": v["height"], "fps": round(int(a) / int(b), 1), "rot": [x.get("rotation") for x in v.get("side_data_list", []) if "rotation" in x], "size": int(j["format"]["size"]), "dur": round(float(j["format"]["duration"]), 1)}
U = lambda n: f"http://localhost:{PORT}/media/{n}"
SWAP = lambda mv, ph: {"kind": "video", "prompt": "", "model": "mcswap", "dur": 4, "aspect": "9:16", "inputs": {"mcMove": U(mv), "mcChar": U(ph)}, "meta": {"motion83": 1, "consent": True, "res": "720p", "swap93": 1}}
def credits(): return (api("/v1/billing", token=TOKEN) or {}).get("credits")

def server_checks():
    tag = "swap"
    out["phone"] = probe(M + "phone.mp4")
    c0 = credits(); t0 = len(stats()["tasks"])
    j = api("/v1/jobs", SWAP("phone.mp4", "photo.jpg"), token=TOKEN)
    ok(j.get("id") and not j.get("_status"), f"{tag}: the phone video and photo are accepted {j}")
    t = wait(lambda: stats()["tasks"][t0:], 60) or []
    inp = (t[0].get("input") or {}) if t else {}
    v = p = None
    try: v = probe(fetch((inp.get("reference_video_urls") or [""])[0], D + "/sent.mp4"))
    except Exception as e: v = str(e)[:120]
    try: im = Image.open(fetch((inp.get("reference_image_urls") or [""])[0], D + "/sent.jpg")); p = [im.format, im.size, im.convert("RGB").getpixel((im.size[0] - 10, im.size[1] // 2))]
    except Exception as e: p = str(e)[:120]
    out["sent"] = {"video": v, "photo": p, "model": t and t[0].get("model")}
    ok(isinstance(v, dict) and v["codec"] == "h264" and max(v["w"], v["h"]) <= 1280 and v["h"] > v["w"] and not v["rot"] and v["fps"] <= 30.5 and v["size"] < 10 * 1024 * 1024 and 3.5 <= v["dur"] <= 4.5,
       f"{tag}: the engine gets an upright H.264 MP4, ≤ 1280 px, ≤ 30 fps, under 10 MB (was {out['phone']}) → {v}")
    ok(isinstance(p, list) and p[0] == "JPEG" and p[1] == (300, 400) and p[2][0] > 180 and p[2][2] < 90, f"{tag}: the photo reaches the engine upright (the red top band of the sideways file is now on the right) {p}")
    ok(t and t[0].get("model") == "minimax-h3/reference-to-video" and inp.get("resolution") == "2K" and len(inp.get("reference_video_urls") or []) == 1, f"{tag}: Character Swap engine and quality {t and t[0].get('model')} {inp}")
    # a video that is already right is sent as it is
    t0 = len(stats()["tasks"]); api("/v1/jobs", SWAP("fine.mp4", "photo.jpg"), token=TOKEN)
    t = wait(lambda: stats()["tasks"][t0:], 30) or []
    ok(t and t[0]["input"]["reference_video_urls"][0].endswith("/media/fine.mp4"), f"{tag}: a video the engine can already read is sent as it is {t and t[0]['input'].get('reference_video_urls')}")
    # refusals: nothing charged
    c1 = credits()
    r1 = api("/v1/jobs", SWAP("short.mp4", "photo.jpg"), token=TOKEN); r2 = api("/v1/jobs", SWAP("broken.mp4", "photo.jpg"), token=TOKEN); r3 = api("/v1/jobs", SWAP("gone.mp4", "photo.jpg"), token=TOKEN)
    # (v108: the job is made at once and the video is read after — a refusal is the job failing with its reason, the credits back)
    why = lambda r: r.get("error", "") if r.get("_status") == 400 else (wait(lambda: (lambda x: x if x.get("status") == "failed" else None)(api(f"/v1/jobs/{r.get('id')}", token=TOKEN)), 60) or {}).get("error") or ""
    e1, e2, e3 = why(r1), why(r2), why(r3)
    ok("shorter than 2 seconds" in e1 and "can't be read" in e2 and "add it again" in e3 and wait(lambda: credits() == c1, 15),
       f"{tag}: a too-short, unreadable or missing video is refused with the reason, nothing charged {e1} · {e2} · {e3} · {credits()} {c1}")
    # the engine's own reason, no company name, credits back
    mock("/failnext?msg=" + urllib.parse.quote("No human detected in the video (Kie AI)"))
    c2 = credits(); j = api("/v1/jobs", {**SWAP("fine.mp4", "photo.jpg"), "cid": "fail-test"}, token=TOKEN)   # (its own request: the same one within 15 s is the same job)
    f = wait(lambda: (lambda x: x if x.get("status") == "failed" else None)(api(f"/v1/jobs/{j.get('id')}", token=TOKEN)), 60) or {}
    out["fail"] = f.get("error")
    ok(f.get("error") == "The engine couldn't make this: No human detected in the video. Nothing was charged." and "kie" not in json.dumps(f).lower() and wait(lambda: credits() == c2, 10), f"{tag}: the engine's own reason, no company name, credits back {f.get('error')} {credits()} {c2}")

async def page_checks(b):
    tag = "page"; ctx = await b.new_context(viewport={"width": 390, "height": 860}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); E = pg.evaluate
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('ar');document.getElementById('modalRoot').innerHTML='';renderAll()}")
    r = await E("()=>[errText81({error:\"The engine couldn't make this: No human detected in the video. Nothing was charged.\"}),sameOrigin95('https://nooi.example:443/media/a.png?x=1'),sameOrigin95(location.origin+'/media/b.png'),sameOrigin95('https://cdn.example/x.png')]")
    ok(r[0].startswith("تعذّر على المحرّك صنع هذا: No human detected in the video") and r[0].endswith("لم يُخصم شيء.") and r[1] == "/media/a.png?x=1" and r[2].endswith("/media/b.png") and r[3] == "https://cdn.example/x.png", f"{tag}: the reason in Arabic; /media files read through the page's own address {r}")
    # a result still on the engine's link (no CORS): copied to the server, then read
    srv = api("/v1/jobs", {"kind": "image", "prompt": "a red car", "model": "nano", "aspect": "1:1"})
    d = wait(lambda: (lambda x: x if x.get("status") == "done" else None)(api(f"/v1/jobs/{srv.get('id')}")), 60) or {}
    # point the job at the engine-like link without CORS, as the server would have kept it
    db = json.load(open(D + "/data/db.json"))
    r = await E("""async(id)=>{const j={id:uid(),remote:id,kind:'image',status:'complete',resultUrl:'http://localhost:%d/nocors.png',meta:{}};S.jobs.push(j);let direct=null;try{await fetch(j.resultUrl);direct='read'}catch(e){direct='blocked'}
      const b=await jobBlob72(j);return {direct,ok:!!b,size:b&&b.size,now:j.resultUrl}}""" % KPORT, srv.get("id"))
    out["keep"] = r
    ok(r["direct"] == "blocked" and r["ok"] and "/media/" in r["now"], f"{tag}: a picture on the engine's own link is copied here and read {r} {d.get('url')}")
    ok(api(f"/v1/jobs/{srv.get('id')}/keep", {}, token=TOKEN).get("_status") == 404, f"{tag}: another user's job can't be copied")
    ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

async def live(b):
    tag = "live"; ctx = await b.new_context(viewport={"width": 1280, "height": 900}); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); E = pg.evaluate
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('en');document.getElementById('modalRoot').innerHTML='';S.sketch.prompt='a house';S.sketch.n91=4;S.sketch.pic94=null;S.sketch.live95=false;go('sketch');renderAll()}")
    await pg.wait_for_timeout(500)
    r = await E("()=>({row:!!document.querySelector('.live95 [data-act=sk95-live]'),txt:(document.querySelector('.live95')||{}).textContent||''})")
    ok(r["row"] and any(ch.isdigit() for ch in r["txt"]) and "each" in r["txt"], f"{tag}: a Live switch with the price of each update (the credit sign is an icon) {r}")
    await pg.click('.live95 [data-act="sk95-live"]'); await pg.wait_for_timeout(300)
    box = await E("()=>{const r=document.getElementById('skcv').getBoundingClientRect();return [r.x,r.y,r.width,r.height]}")
    async def stroke(y0, x0=.2, x1=.8):
        await pg.mouse.move(box[0] + box[2] * x0, box[1] + box[3] * y0); await pg.mouse.down()
        for k in range(1, 9): await pg.mouse.move(box[0] + box[2] * (x0 + (x1 - x0) * k / 8), box[1] + box[3] * y0, steps=2)
        await pg.mouse.up()
    t0 = len(stats()["tasks"])
    await stroke(.4)
    await pg.wait_for_timeout(600)
    ok(len(stats()["tasks"]) == t0, f"{tag}: nothing is sent while you may still be drawing")
    first = wait(lambda: stats()["tasks"][t0:], 20) or []
    ok(len(first) == 1, f"{tag}: one picture is made by itself (no button), not four versions {len(first)}")
    r = None
    for _ in range(120):
        r = await E("()=>{const p=skPic94();return p&&{id:p.id,k:S.sketch.k94}}")
        if r: break
        await pg.wait_for_timeout(250)
    ok(r and r["k"] == 1, f"{tag}: the picture goes on the paper {r}")
    # a mark on the picture → updated by itself, with the faster engine
    t1 = len(stats()["tasks"])
    await stroke(.7, .4, .6)
    upd = wait(lambda: stats()["tasks"][t1:], 20) or []
    ok(len(upd) == 1 and "Edit this picture" in (upd[0].get("input") or {}).get("prompt", "") and upd[0].get("model") == "nano-banana-2", f"{tag}: a mark on the picture updates it by itself with the faster engine {[x.get('model') for x in upd]}")
    r2 = None
    for _ in range(120):
        r2 = await E("(old)=>{const p=skPic94();return p&&p.id!==old&&{id:p.id,k:S.sketch.k94,n:LIVE95.n}}", r and r["id"])
        if r2: break
        await pg.wait_for_timeout(250)
    ok(r2 and r2["k"] == 2 and r2["n"] == 2, f"{tag}: the updated picture replaces it on the paper {r2}")
    # typing the change also updates it
    t2 = len(stats()["tasks"])
    await pg.fill("#skchg94", "add a blue door"); await pg.wait_for_timeout(2600)
    t = stats()["tasks"][t2:]
    ok(len(t) == 1 and "add a blue door" in (t[0].get("input") or {}).get("prompt", ""), f"{tag}: typing what to change updates it by itself {len(t)}")
    await pg.wait_for_timeout(3000)
    # the cap
    await E("()=>{LIVE95.n=LIVECAP95}"); t3 = len(stats()["tasks"])
    await stroke(.85, .3, .5); await pg.wait_for_timeout(2500)
    ok(len(stats()["tasks"]) == t3 and await E("()=>!S.sketch.live95"), f"{tag}: Live pauses after {10} updates — nothing more is sent")
    # off: drawing sends nothing
    await stroke(.15, .3, .5); await pg.wait_for_timeout(2500)
    ok(len(stats()["tasks"]) == t3, f"{tag}: with Live off, drawing sends nothing")
    ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

async def main():
    mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        try: server_checks()
        except Exception as e: fails.append(f"server: crashed — {str(e)[:300]}")
        async with async_playwright() as p:
            b = await p.chromium.launch(args=["--no-sandbox"])
            for part in (page_checks, live):
                try: await part(b)
                except Exception as e: fails.append(f"{part.__name__}: crashed — {str(e)[:300]}")
            await b.close()
    finally: srv.kill(); mk.kill()
    print(json.dumps(out, ensure_ascii=False, default=str)[:2500])
    print("\n".join("✗ " + f for f in fails) or "✓ v95: Character Swap gets files it can read · the engine's own reason · results the page can read · Live sketch")
    raise SystemExit(1 if fails else 0)

asyncio.run(main())
