# v163 "Keep Kling 3, all the models with their icons will appear for the clients to decide" · "Generator = engine" ·
# "Why you didn't add the super slow motion, it has to be smooth all the slow motions, like cinematic moves".
# A real nooi server, a stand-in AI engine (it records what it is sent and hands back a 3 s clip) and the page:
#  · every engine with its icon in view: a row of icons in the home box (Kling 4.0, Kling 3.0 … first), in nooi Studio and Images;
#    a tap picks the engine; "All" opens the full list; Kling 3.0 is there; every engine has an icon
#  · "engine", not "model" / "generator", in what customers read (English, Arabic and the shipped translations)
#  · super slow motion: real speed · 0.5× · 0.25× · 0.125× · cinematic ramp — each shows its price and final length; the video is
#    slowed on the server with real in-between frames (30 a second, no frame shown twice), the engine is asked for crisp real-time
#    action; an unknown choice or a video shown in parts is not slowed and not charged for it
#  · the editor: a slowed clip is smoothed on the device by itself and the engine makes the real slow-motion file by itself, free
#    (v168 — tests/v168.py); a preset Finish job (tool "slowmo") is priced like the Video page and only for the client's own video
# Run: python3 tests/v163.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8496, 8497; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v163-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "s" * 32   # a customer (the local owner is never charged) — for the prices
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 10000000}]},
  "other": {"plan": "studio", "credits": 100, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "uploads": ["theirs.mp4"]}}}, open(D + "/data/db.json", "w"))
# the engine's clip: 3 s of moving pictures with sound (and one that belongs to someone else)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=480x270:rate=24:duration=3", "-f", "lavfi", "-i", "sine=f=330:d=3", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", D + "/res.mp4"], check=True)
shutil.copy(D + "/res.mp4", D + "/media/theirs.mp4")
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, F = int(sys.argv[1]), sys.argv[2]; st = {"reqs": []}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.mp4":
            b = open(F, "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b); return
        url = f"http://localhost:{P}/res.mp4"
        return self.send({"code": 200, "data": {"state": "success", "successFlag": 1, "response": {"resultUrls": [url]}, "resultJson": json.dumps({"resultUrls": [url]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 500})
        st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "data": {"taskId": "t%d" % len(st["reqs"])}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, port=PORT, tok=None, method=None):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"),
      headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
stats = lambda: api("/stats", port=KPORT)
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
def done(jid, tok=None, sec=240):
    return wait(lambda: (lambda j: j if j.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + jid, tok=tok)), sec) or {}
def probe(url):
    f = D + "/media/" + str(url).split("?")[0].rsplit("/", 1)[-1]
    if not os.path.exists(f): return {}
    p = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], capture_output=True, text=True).stdout or "{}")
    v = next((s for s in p.get("streams", []) if s.get("codec_type") == "video"), {})
    uniq = len(set(l.split(",")[-1] for l in subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "framemd5", "-"], capture_output=True, text=True).stdout.splitlines() if l and not l.startswith("#")))
    return {"dur": float(p.get("format", {}).get("duration", 0)), "fps": v.get("r_frame_rate"), "frames": int(v.get("nb_frames") or 0), "unique": uniq, "audio": any(s.get("codec_type") == "audio" for s in p.get("streams", []))}
credits = lambda tok: (api("/v1/billing", tok=tok) or {}).get("credits")

def server_checks():
    # 1. super slow motion on a video: the extra in the price, the engine asked for crisp real-time action, real in-between frames
    n = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "A drop of water falls into a glass", "dur": 5, "aspect": "16:9", "meta": {"slow163": "super", "chosen155": []}}, tok=TOKEN)
    ok(j.get("cost") == 83 + 4, f"Kling 3.0 5 s + super slow = 83 + 4 credits {j.get('cost')}")
    r = wait(lambda: [x for x in stats()["reqs"][n:] if x["path"].endswith("createTask")] or None, 40) or [{}]; p = ((r[-1].get("body") or {}).get("input") or {}).get("prompt", "")
    ok("crisp high-shutter frames" in p and "smooth cinematic slow motion" in p, f"the engine is asked for real-time action with crisp frames {p[-200:]!r}")
    d = done(j.get("id", ""), TOKEN); out["super"] = {k: d.get(k) for k in ("status", "url", "error", "stage")}; pr = probe(d.get("url")); out["super_probe"] = pr
    ok(d.get("status") == "done" and "-slow-super" in str(d.get("url")), f"the video comes slowed {out['super']}")
    ok(abs(pr.get("dur", 0) - 12) < 0.3 and pr.get("fps") == "30/1", f"3 s at 0.25× → 12 s at 30 fps {pr}")
    ok(pr.get("unique", 0) >= pr.get("frames", 999) * 0.97, f"every frame is a new picture (in-between frames, nothing held) {pr}")
    ok(not pr.get("audio"), "slow motion has no sound")
    # 2. the cinematic ramp: real speed → super slow → real speed
    j = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "A skateboarder jumps a gap", "dur": 5, "meta": {"slow163": "ramp", "chosen155": []}}, tok=TOKEN); ok(j.get("cost") == 87, f"ramp + 4 {j.get('cost')}")
    d = done(j.get("id", ""), TOKEN); pr = probe(d.get("url")); out["ramp"] = pr
    ok("-slow-ramp" in str(d.get("url")) and 5.6 < pr.get("dur", 0) < 6.4, f"3 s with a ramp → about 6 s {d.get('url')} {pr}")
    # 3. an unknown choice is dropped (no extra, not slowed); a video shown in parts can't be slowed as one
    j = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "A cat", "dur": 5, "meta": {"slow163": "warp", "chosen155": []}}, tok=TOKEN); ok(j.get("cost") == 83, f"unknown slow motion → no extra {j.get('cost')}")
    d = done(j.get("id", ""), TOKEN); ok(d.get("status") == "done" and "-slow-" not in str(d.get("url")), f"…and not slowed {d.get('url')}")
    j = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "A cat", "dur": 10, "meta": {"slow163": "super", "parts": 2, "chosen155": []}}, tok=TOKEN)
    ok(j.get("cost") is not None and j.get("cost") % 83 == 0 or j.get("cost") == 166, f"parts shown one after another → no slow-motion extra {j.get('cost')}")
    # 4. the editor's "Smooth with the engine": a Finish job on the client's own video, priced like the Video page
    first = out["super"].get("url") or ""; src = "/media/" + first.split("?")[0].rsplit("/", 1)[-1]
    c0 = credits(TOKEN); j = api("/v1/jobs", {"kind": "finish", "prompt": "Slow motion", "meta": {"tool": "slowmo", "slow163": "ultra", "sourceUrl": src, "from163": 0, "to163": 2}}, tok=TOKEN)
    ok(j.get("cost") == 6, f"editor ultra slow = 6 credits {j.get('cost')} {j.get('error')}")
    d = done(j.get("id", ""), TOKEN); pr = probe(d.get("url")); out["finish"] = {**{k: d.get(k) for k in ("status", "url", "error")}, **pr}
    ok(d.get("status") == "done" and abs(pr.get("dur", 0) - 16) < 0.4, f"2 s of the clip at 0.125× → 16 s {out['finish']}")
    ok(credits(TOKEN) == c0 - 6, f"6 credits charged {c0} → {credits(TOKEN)}")
    j = api("/v1/jobs", {"kind": "finish", "prompt": "Slow motion", "meta": {"tool": "slowmo", "slow163": "super", "sourceUrl": "/media/theirs.mp4"}}, tok=TOKEN)
    ok(j.get("_status") == 404 and "yours" in str(j.get("error")), f"someone else's video can't be slowed {j}")
    c0 = credits(TOKEN); j = api("/v1/jobs", {"kind": "finish", "prompt": "Slow motion", "meta": {"tool": "slowmo", "slow163": "super", "sourceUrl": src, "from163": 0, "to163": 0.05}}, tok=TOKEN)
    d = done(j.get("id", ""), TOKEN); ok(d.get("status") == "failed" and "Nothing was charged" in str(d.get("error")), f"a part too short fails clearly {d.get('error')}")
    ok(wait(lambda: credits(TOKEN) == c0, 10), f"…and nothing is charged {c0} → {credits(TOKEN)}")
    # 5. the time bend itself
    js = subprocess.run(["node", "--input-type=module", "-e", """import { warp163, outLen163, setpts163, speedAt163, SLOW163 } from './lib/slowmo163.js';
      const W=warp163('ramp',5); console.log(JSON.stringify({mono:W.every((p,i)=>!i||(p[0]>W[i-1][0]&&p[1]>W[i-1][1])),ramp:outLen163('ramp',5),sup:outLen163('super',5),ult:outLen163('ultra',5),half:outLen163('slow',5),
        ends:[speedAt163('ramp',0),speedAt163('ramp',.5),speedAt163('ramp',1)],expr:setpts163(warp163('super',4),1,2.4),extra:Object.fromEntries(Object.entries(SLOW163).map(([k,v])=>[k,v.extra]))}))"""],
      cwd=ROOT, capture_output=True, text=True, timeout=30)
    try: o = json.loads(js.stdout)
    except Exception: o = {}; fails.append("slowmo163 pure steps: " + js.stderr[-300:])
    out["pure"] = o
    ok(o.get("mono") and abs(o.get("sup", 0) - 20) < 1e-6 and abs(o.get("ult", 0) - 40) < 1e-6 and abs(o.get("half", 0) - 10) < 1e-6, f"lengths: 0.5× 10 s, 0.25× 20 s, 0.125× 40 s {o}")
    ok(9 < o.get("ramp", 0) < 11 and o.get("ends") == [1, 0.25, 1], f"the ramp: real speed → 0.25× → real speed, 5 s → about 10 s {o.get('ramp')} {o.get('ends')}")
    ok(o.get("expr", "").startswith("setpts='(") and "*4.00000" in o.get("expr", ""), f"a steady 0.25× piece is a straight ×4 time {o.get('expr')}")
    ok(o.get("extra") == {"slow": 2, "super": 4, "ultra": 6, "ramp": 4}, f"the extras {o.get('extra')}")

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        async def page(vw=1280, vh=900, lang="en"):
            ctx = await b.new_context(viewport={"width": vw, "height": vh}); pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
            await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
            await pg.evaluate("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false}", lang); return pg
        pg = await page()
        # every engine with its icon, Kling 3.0 kept (v171: the engines are inside the nooi Auto chip — no row of icons under the box)
        r = await pg.evaluate("""async()=>{const R={};R.noLogo=[...Object.keys(MODELS),...Object.keys(IMG_MODELS)].filter(i=>!logoFor(i));
          S.view='home';S.hf.tab='video';S.hf.vModel='auto';renderView();await new Promise(r=>setTimeout(r,400));R.rows=document.querySelectorAll('.ms163').length;
          document.querySelector('.hfmi.eng171').click();await new Promise(r=>setTimeout(r,300));const L=[...document.querySelectorAll('.hfsheet .hfmodel')];R.home=L.map(b=>b.dataset.v);R.homeImgs=L.filter(b=>b.querySelector('img')).length;
          R.sheet=(document.querySelector('.hfsheet h2')||{}).textContent;document.querySelector('.hfsheet .hfmodel[data-v="kling30"]').click();await new Promise(r=>setTimeout(r,300));R.picked=S.hf.vModel;R.chip=(document.querySelector('.hfmi.eng171')||{}).textContent;
          S.view='video';renderView();await new Promise(r=>setTimeout(r,600));R.vrows=document.querySelectorAll('.ms163').length;const vt=[...document.querySelectorAll('.dock98 .sec93 [data-set="draft.model"][data-val]')];R.video=vt.map(b=>b.dataset.val);
          vt.find(b=>b.dataset.val==='kling40').click();await new Promise(r=>setTimeout(r,400));R.vPicked=S.draft.model;
          S.view='image';renderView();await new Promise(r=>setTimeout(r,600));R.irows=document.querySelectorAll('.ms163').length;const it=[...document.querySelectorAll('.dock98 .sec93 [data-set="img.model"][data-val]')];R.image=it.map(b=>b.dataset.val);
          it.find(b=>b.dataset.val==='mj').click();await new Promise(r=>setTimeout(r,400));R.iPicked=S.img.model;return R}""")
        out["icons"] = r
        ok(not r["noLogo"], f"every engine has an icon {r['noLogo']}")
        ok(r["rows"] == 0 and r["home"][0] == "auto" and {"kling40", "kling30"} <= set(r["home"]) and len(r["home"]) >= 15 and r["homeImgs"] == len(r["home"]), f"home: the nooi Auto chip opens every engine, each with its icon {r['home']} {r['homeImgs']}")
        ok(r["sheet"] == "Video engine" and r["picked"] == "kling30" and r["chip"] == "Kling 3.0", f"Kling 3.0 picked from the list shows on the chip {r['picked']} {r['chip']!r}")
        ok(r["vrows"] == 0 and {"auto", "kling40", "kling30"} <= set(r["video"]) and r["vPicked"] == "kling40", f"nooi Studio: the engines in the Engine list {r['video'][:4]} {r['vPicked']}")
        ok(r["irows"] == 0 and {"auto", "nanopro", "mj"} <= set(r["image"]) and r["iPicked"] == "mj", f"Images: the engines in the Engine list {r['image'][:3]} {r['iPicked']}")
        # engine, not model / generator
        for lang, want in (("en", ("Engine: ", "Video engine")), ("ar", ("المحرك: ", "محرك الفيديو"))):
            await pg.evaluate("(l)=>{S.lang=l;S.view='home';S.hf.tab='video';S.hf.vModel='auto';renderView()}", lang); await pg.wait_for_timeout(300)
            t = await pg.evaluate("""async()=>{const box=document.querySelector('.hfbox');const txt=box.innerText;hfModelSheet();await new Promise(r=>setTimeout(r,200));const h=(document.querySelector('.hfsheet h2')||{}).textContent;closeSheet();
              return {chip:(document.querySelector('.hfmi.eng171')||{getAttribute:()=>''}).getAttribute('aria-label'),h,model:/\\bmodels?\\b|generator|نموذج|مولّد/i.test(txt)}}""")
            ok((t["chip"] or "").startswith(want[0]) and t["h"] == want[1] and not t["model"], f"{lang}: the box says engine {t}")
        await pg.evaluate("()=>{S.lang='en'}")
        fr = json.load(open(ROOT + "/public/i18n/fr.json")); ok(fr.get("Video engine") == "Moteur vidéo" and "Video model" not in fr, "the shipped French says moteur")
        # v187: no slow-motion buttons any more (the Video page's tiles, the home box's Slow-mo chip) — the words turn it on, priced
        # on the Video page's Generate button too (tests/v187.py goes further)
        r = await pg.evaluate("""async()=>{const R={};S.view='video';S.draft.dur=5;S.draft.slow163='off';S.draft.variations=2;S.draft.model='kling30';S.draft.prompt='A drop of water falls into a glass';const st=ST93();st.open='fps';renderView();await new Promise(r=>setTimeout(r,600));
          R.tiles=document.querySelectorAll('#main .sl163').length;const cost=()=>+document.querySelector('.dock98 [data-act="gen-video"] .crc b').textContent;R.c0=cost();
          S.draft.prompt='A drop of water falls into a glass in super slow motion';renderView();await new Promise(r=>setTimeout(r,400));R.c1=cost();S.draft.variations=1;S.draft.prompt='';
          S.view='home';S.hf.tab='video';S.hf.dur=5;renderView();await new Promise(r=>setTimeout(r,400));R.hchip=!!document.querySelector('[data-act="sl163h"]');return R}""")
        out["slow_page"] = r
        ok(r["tiles"] == 0 and not r["hchip"] and r["c1"] == r["c0"] + 2 * 4, f"no slow-motion buttons; 'super slow motion' in the words adds +4 for each of the 2 takes {r}")
        # the editor: a slowed clip is smooth by itself — the engine's version starts by itself, free (v168: tests/v168.py goes further)
        r = await pg.evaluate("""async()=>{const R={};const j={id:'lj1',remote:'x',kind:'video',status:'complete',progress:1,resultUrl:'/media/none.mp4',title:'Clip',prompt:'x',created:Date.now(),dur:3,aspect:'16:9',art:'scene',seed:1,pal:PALS[0]};S.jobs.push(j);
          S.ed.clips=[{id:'c1',src:{k:'job',job:'lj1'},in:0,out:3,speed:1}];S.ed.sel='c1';S.view='edit';renderView();await new Promise(r=>setTimeout(r,500));const c=S.ed.clips[0];
          const h0=speed145();R.before=h0.includes('sl163ed');R.hint0=/plays smooth: the engine makes the real in-between frames by itself, free/.test(h0);
          edxSetSlow(c,.125,'none');c.no163=null;R.smooth=c.smooth;const h=speed145();R.btn=(h.match(/data-act="sl163ed"[^>]*>[\\s\\S]*?<\\/svg>([^<]*)/)||[])[1];R.starting=/Starting the engine's smooth slow motion/.test(h);R.price=/\\bcr\\b|credits/.test(h.slice(h.indexOf('slow163')));
          c.smooth='off';edxSetSlow(c,.5,'bullet');R.kept=c.smooth;c.no163=edKey163(c);R.dev=/smoothed on this device/.test(speed145());return R}""")
        out["editor"] = r
        ok(not r["before"] and r["hint0"] and r["smooth"] == "flow", f"real speed: no button, the line says slow motion plays smooth by itself; slowing it smooths it on the device {r}")
        ok(r["btn"] == "Make it smooth now" and r["starting"] and not r["price"], f"slowed: the engine's version starts by itself, free (no price) {r}")
        ok(r["kept"] == "off" and r["dev"], f"a smoothing switched off stays off; a clip the engine can't do says it is smoothed on this device {r}")
        # phone, Arabic: the row and the tiles fit
        pg2 = await page(390, 844, "ar")
        r = await pg2.evaluate("""async()=>{S.view='home';S.hf.tab='video';S.hf.vModel='happyhorse';renderView();await new Promise(r=>setTimeout(r,400));const o=document.querySelector('.hfmi.eng171').getBoundingClientRect();
          return {inView:o.left>=-1&&o.right<=innerWidth+1&&o.width>40,overflow:document.documentElement.scrollWidth>innerWidth+1}}""")
        ok(r["inView"] and not r["overflow"], f"phone (Arabic): the picked engine's chip is in view, nothing wider than the screen {r}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
mock = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D + "/res.mp4"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", MIRROR_MEDIA="true",
  KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", FREE_PERIOD="false", AI_LABEL="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    ok(wait(lambda: api("/v1/config"), 40), "server up"); ok(wait(lambda: stats(), 20), "engine stand-in up")
    server_checks(); asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-1500:])
finally:
    srv.kill(); mock.kill()
    log = open(D + "/server.log").read()[-1500:]; shutil.rmtree(D, ignore_errors=True)
print(json.dumps(out, ensure_ascii=False, indent=1)[:6000])
if fails:
    print("server log:", log); print("FAILED:"); [print(" ✗", f) for f in fails]; sys.exit(1)
print("v163 ok")
