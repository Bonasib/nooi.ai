# v168 "Slow motions in the editor": every slowed clip in the editor is smooth — the engine makes the real in-between frames by
# itself, free, timed exactly as the editor times the clip (any speed from 0.1×, steady or a ramp), so the clip keeps its length;
# until then (or with no server) the clip is smoothed on the device; the export waits for the engine's file.
# A real nooi server (its own ffmpeg — no AI engine is paid) and the editor in Playwright:
#  · server: the editor's slow motion costs nothing, comes out exactly as long as the editor's clip (steady and ramp), every
#    frame a new picture; a speed the editor doesn't have is refused (not made as a paid preset); someone else's video is refused
#  · page: slowing a clip starts the engine's version by itself (free), the clip is swapped for it when it is ready (same length),
#    the export of it is smooth — measured against the true moments (the test pattern drawn at 120 frames a second) — while the
#    page is drawn again during the export; "Back to the original clip"; a new speed starts again from the original; a ramp
#    comes out exactly as long as the editor's clip; a video the engine can't take stays smoothed on the device
#  · two export bugs found on the way: a page drawn during an export swapped the preview's canvas (the rest of the video froze
#    on one picture), and WebM times in whole milliseconds showed every third frame twice
# (This test browser can't decode H.264: the engine's file is handed to it as VP9 — the same frames.)
# Run: python3 tests/v168.py
import asyncio, base64, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
import numpy as np
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8492; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v168-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "e" * 32   # a customer (the local owner is never charged)
json.dump({"users": {
  "local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {"j1": {"id": "j1", "kind": "video", "status": "done", "progress": 1, "url": "/media/clip.webm", "title": "Clip", "created": 1, "payload": {"prompt": "x"}}}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "uploads": ["mine.mp4"], "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 10000000}]},
  "other": {"plan": "studio", "credits": 100, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "uploads": ["theirs.mp4"]}}}, open(D + "/data/db.json", "w"))
# the clip: a moving test pattern, 3 s at 24 frames a second (VP9 for this browser, H.264 for the customer) — and the truth: the
# same pattern drawn at 120 frames a second, which is exactly what 0.25× slow motion at 30 frames a second must show
ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=180)
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=3", "-c:v", "libvpx-vp9", "-b:v", "2M", "-deadline", "realtime", "-cpu-used", "8", D + "/media/clip.webm")
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/media/mine.mp4")
shutil.copy(D + "/media/mine.mp4", D + "/media/theirs.mp4"); shutil.copy(D + "/media/clip.webm", D + "/media/notmine.webm")
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=120", "-t", "2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "10", D + "/gt.mp4")
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, tok=None):
    req = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
      headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
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
done = lambda jid, tok=None: wait(lambda: (lambda j: j if j.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + jid, tok=tok)), 180) or {}
credits = lambda tok: (api("/v1/billing", tok=tok) or {}).get("credits")
mfile = lambda url: D + "/media/" + str(url).split("?")[0].rsplit("/", 1)[-1]
def probe(f):
    p = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], capture_output=True, text=True).stdout or "{}")
    v = next((s for s in p.get("streams", []) if s.get("codec_type") == "video"), {})
    uniq = len(set(l.split(",")[-1] for l in subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "framemd5", "-"], capture_output=True, text=True).stdout.splitlines() if l and not l.startswith("#")))
    return {"dur": round(float(p.get("format", {}).get("duration", 0)), 3), "fps": v.get("r_frame_rate"), "frames": int(v.get("nb_frames") or 0), "unique": uniq}
def gray(f, vf, W=160, H=90):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", f"{vf},scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True, timeout=200).stdout
    return np.frombuffer(raw, np.uint8).astype(np.float32).reshape(-1, H, W)
def smooth(f, vf):
    # still frames: a step from one frame to the next under 15% of the usual step (a frame shown twice); on time: the true moment
    # (of the 120 fps truth) each frame shows best is within one of where it should be
    x = gray(f, vf); d = np.abs(np.diff(x, axis=0)).mean(axis=(1, 2)); still = float(np.mean(d < np.median(d) * .15))
    g = gray(D + "/gt.mp4", "null"); x = x - x.mean(axis=(1, 2), keepdims=True); g = g - g.mean(axis=(1, 2), keepdims=True); n = min(len(x), len(g)); best = []
    for i in range(n):
        lo, hi = max(0, i - 10), min(len(g), i + 11); best.append(lo + int(np.argmin([np.mean((x[i] - g[j]) ** 2) for j in range(lo, hi)])))
    return {"frames": len(x), "still": round(still, 3), "onTime": round(float(np.mean(np.abs(np.array(best) - np.arange(n)) <= 1)), 3)}

def server_checks():
    js = subprocess.run(["node", "--input-type=module", "-e", """import { edSpec163, edWarp163 } from './lib/slowmo163.js';
      const st=edSpec163({slow163:'ed',speed163:.25,ramp163:'none'}),bu=edSpec163({slow163:'ed',speed163:.25,ramp163:'bullet'}),W=edWarp163(st,2),Wb=edWarp163(bu,2);
      const rate=x=>{const s=(a,b,v)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t)};return 1+(.25-1)*s(.15,.35,x)*(1-s(.65,.85,x))};let A=0;for(let i=0;i<4000;i++)A+=rate((i+.5)/4000)/4000;
      console.log(JSON.stringify({st,W,bEnd:Wb[Wb.length-1],mono:Wb.every((p,i)=>!i||(p[0]>Wb[i-1][0]&&p[1]>Wb[i-1][1])),pageLen:2/A,
        bad:[edSpec163({slow163:'ed',speed163:.05}),edSpec163({slow163:'ed',speed163:1}),edSpec163({slow163:'ed',speed163:.5,ramp163:'warp'}),edSpec163({slow163:'super',speed163:.5})]}))"""],
      cwd=ROOT, capture_output=True, text=True, timeout=30)
    try: o = json.loads(js.stdout)
    except Exception: o = {}; fails.append("slowmo163 pure steps: " + js.stderr[-300:])
    out["pure"] = o
    ok(o.get("st") == {"speed": 0.25, "ramp": "none", "ed": True} and o.get("W") == [[0, 0], [2, 8]], f"steady 0.25×: 2 s of the clip → 8 s, one straight line {o.get('st')} {o.get('W')}")
    ok(o.get("mono") and abs(o.get("bEnd", [0, 0])[1] - o.get("pageLen", 0)) < 0.01 and o.get("bEnd", [0])[0] == 2, f"bullet ramp: as long as the editor's clip {o.get('bEnd')} {o.get('pageLen')}")
    ok(o.get("bad") == [None, None, None, None], f"speeds and ramps the editor doesn't have are not the editor's slow motion {o.get('bad')}")
    # the editor's slow motion on the customer's own video: free, exactly as long, every frame a new picture
    c0 = credits(TOKEN); j = api("/v1/jobs", {"kind": "finish", "prompt": "Slow motion · clip", "meta": {"tool": "slowmo", "slow163": "ed", "speed163": .25, "ramp163": "none", "sourceUrl": "/media/mine.mp4", "from163": 0, "to163": 2, "isVideo": True}}, tok=TOKEN)
    ok(j.get("cost") == 0, f"the editor's slow motion is free {j.get('cost')} {j.get('error')}")
    d = done(j.get("id", ""), TOKEN); pr = probe(mfile(d.get("url"))) if d.get("url") else {}; out["steady"] = {**{k: d.get(k) for k in ("status", "url", "error")}, **pr}
    ok(d.get("status") == "done" and "-slow-ed" in str(d.get("url")) and abs(pr.get("dur", 0) - 8) < 0.07 and pr.get("fps") == "30/1", f"2 s at 0.25× → 8 s at 30 fps {out['steady']}")
    ok(pr.get("unique", 0) >= pr.get("frames", 999) * 0.97, f"every frame a new picture {pr}")
    ok(wait(lambda: credits(TOKEN) == c0, 10), f"nothing charged {c0} → {credits(TOKEN)}")
    j = api("/v1/jobs", {"kind": "finish", "prompt": "Slow motion · clip", "meta": {"tool": "slowmo", "slow163": "ed", "speed163": .25, "ramp163": "bullet", "sourceUrl": "/media/mine.mp4", "from163": 0, "to163": 2, "isVideo": True}}, tok=TOKEN)
    d = done(j.get("id", ""), TOKEN); pr = probe(mfile(d.get("url"))) if d.get("url") else {}; out["bullet"] = {**{k: d.get(k) for k in ("status", "error")}, **pr}
    ok(j.get("cost") == 0 and d.get("status") == "done" and abs(pr.get("dur", 0) - o.get("pageLen", 0)) < 0.07, f"bullet ramp: free and as long as the editor's clip ({o.get('pageLen')}) {out['bullet']}")
    for meta, why in (({"speed163": .05, "ramp163": "none"}, "0.05×"), ({"speed163": .5, "ramp163": "warp"}, "an unknown ramp")):
        r = api("/v1/jobs", {"kind": "finish", "prompt": "Slow motion", "meta": {"tool": "slowmo", "slow163": "ed", "sourceUrl": "/media/mine.mp4", "from163": 0, "to163": 2, **meta}}, tok=TOKEN)
        ok(r.get("_status") == 400 and "0.1×" in str(r.get("error")), f"{why} is refused, not made as a paid preset {r}")
    r = api("/v1/jobs", {"kind": "finish", "prompt": "Slow motion", "meta": {"tool": "slowmo", "slow163": "ed", "speed163": .25, "sourceUrl": "/media/theirs.mp4"}}, tok=TOKEN)
    ok(r.get("_status") == 404, f"someone else's video can't be slowed {r}")
    ok(wait(lambda: credits(TOKEN) == c0, 5), f"still nothing charged {c0} → {credits(TOKEN)}")

CACHE = {}
async def as_vp9(route):
    u = route.request.url.split("?")[0]
    if u not in CACHE:
        src = mfile(u); dst = src + ".vp9.webm"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-c:v", "libvpx-vp9", "-b:v", "3M", "-deadline", "realtime", "-cpu-used", "8", "-an", dst], timeout=120); CACHE[u] = open(dst, "rb").read()
    data = CACHE[u]; n = len(data); rg = route.request.headers.get("range", ""); h = {"content-type": "video/webm", "accept-ranges": "bytes"}
    if rg.startswith("bytes="):
        a, _, b = rg[6:].partition("-"); a = int(a or 0); b = min(int(b) if b else n - 1, n - 1); h["content-range"] = f"bytes {a}-{b}/{n}"
        await route.fulfill(status=206, body=data[a:b + 1], headers=h)
    else: await route.fulfill(status=200, body=data, headers=h)

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1280, "height": 900})).new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300])); await pg.route("**/*-slow-ed.mp4", as_vp9)
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
        await pg.evaluate("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false}")
        fin = "S.jobs.filter(j=>j.kind==='finish'&&j.meta&&j.meta.slow163==='ed')"
        # 1. slowing a clip: smooth on the device at once, the engine's version starts by itself (free) and goes in when ready
        r = await pg.evaluate("""async()=>{const R={};S.jobs.push({id:'lj1',remote:'j1',kind:'video',status:'complete',progress:1,resultUrl:'/media/clip.webm',title:'Clip',prompt:'x',created:Date.now(),dur:3,aspect:'16:9',art:'scene',seed:1,pal:PALS[0]});
          S.ed.clips=[{id:'c1',src:{k:'job',job:'lj1'},in:0,out:2,speed:1}];S.ed.sel='c1';S.view='edit';S.ed.tab='clip';renderView();await new Promise(r=>setTimeout(r,1500));
          const c=S.ed.clips[0];edxSetSlow(c,.25,'none');persist();renderView();R.len=edTotal();R.smooth=c.smooth;return R}""")
        out["slowed"] = r; ok(abs(r["len"] - 8) < 1e-6 and r["smooth"] == "flow", f"2 s at 0.25× = 8 s on the timeline, smoothed on the device at once {r}")
        await pg.wait_for_function(f"{fin}.length>0", timeout=15000)
        r = await pg.evaluate(f"()=>{{const j={fin}[0];return {{cost:j.cost,meta:j.meta}}}}"); out["job"] = r
        ok(r["cost"] == 0 and r["meta"].get("speed163") == .25 and r["meta"].get("ramp163") == "none" and r["meta"].get("from163") == 0 and r["meta"].get("to163") == 2, f"started by itself, free, with the editor's speed and part {r}")
        await pg.wait_for_function("(renderView(),!!S.ed.clips[0].sl0)", polling=1000, timeout=150000)
        r = await pg.evaluate("""()=>{const c=S.ed.clips[0],h=speed145();return {src:c.src,in:c.in,out:c.out,speed:c.speed,smooth:c.smooth,len:edTotal(),was:c.sl0&&c.sl0.speed,ok:/Smooth — every in-between frame was made by the engine/.test(h),back:h.includes('sl163back'),shows:/0\\.25/.test(h)}}""")
        out["swapped"] = r
        ok(r["src"].get("k") == "job" and r["src"].get("job") != "lj1" and r["in"] == 0 and r["speed"] == 1 and r["was"] == .25 and abs(r["len"] - 8) < 0.05, f"the clip is the engine's smooth file now, the same length {r}")
        ok(r["ok"] and r["back"] and r["shows"], f"the panel says it is smooth, shows the speed it was given and offers the original {r}")
        # 2. the export of it — the page drawn again every second meanwhile — measured against the true moments
        r = await pg.evaluate("""async()=>{const iv=setInterval(()=>renderView(),1000);let r;try{r=await edRender139(edTotal())}finally{clearInterval(iv)}if(!r)return {err:'no export'};
          const b=new Uint8Array(await r.blob.arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return {stats:R139.stats,data:btoa(s)}}""")
        st = r.get("stats") or {}; out["export"] = {k: st.get(k) for k in ("frames", "fps", "w", "h", "misses", "fallbacks")}
        if r.get("data"):
            f = D + "/export.webm"; open(f, "wb").write(base64.b64decode(r["data"])); w, h = st.get("w", 1080), st.get("h", 1920); ch = int(w * 9 / 16) - 2; y = int((h - w * 9 / 16) / 2) + 1
            m = smooth(f, f"crop={w}:{ch}:0:{y}"); out["export"].update(m)
            ok(m["frames"] >= 238 and m["still"] <= 0.10 and m["onTime"] >= 0.9, f"the export is smooth: no frame shown twice, each at its true moment {out['export']}")
            raw = D + "/raw.webm"; ff("-i", D + "/media/clip.webm", "-vf", "trim=0:2,setpts=4*PTS,fps=30", "-c:v", "libvpx-vp9", "-b:v", "2M", "-deadline", "realtime", "-cpu-used", "8", raw)
            out["held_frames_before"] = smooth(raw, "null")   # (what 0.25× is without in-between frames: each frame shown 5 times)
        else: fails.append(f"export: {r.get('err')}")
        ok(st.get("misses") == 0 and not st.get("fallbacks"), f"every frame read from the file {out['export']}")
        # 3. back to the original clip: as it was, and the engine isn't asked again
        n0 = await pg.evaluate(f"()=>{fin}.length")
        r = await pg.evaluate("""async()=>{const a=document.createElement('button');a.dataset.act='sl163back';document.body.appendChild(a);a.click();a.remove();renderView();await new Promise(r=>setTimeout(r,2600));renderView();
          const c=S.ed.clips[0];return {src:c.src,out:c.out,speed:c.speed,sl0:!!c.sl0,len:edTotal(),dev:/smoothed on this device/.test(speed145())}}""")
        out["back"] = r; n1 = await pg.evaluate(f"()=>{fin}.length")
        ok(r["src"] == {"k": "job", "job": "lj1"} and r["out"] == 2 and r["speed"] == .25 and not r["sl0"] and abs(r["len"] - 8) < 1e-6 and r["dev"] and n1 == n0, f"back to the original clip (smoothed on the device), the engine not asked again {r} {n0}→{n1}")
        # 4. a new speed starts again from the original: 0.5× → the engine's file → a speed chip brings the original back first
        await pg.evaluate("()=>{const c=S.ed.clips[0];edxSetSlow(c,.5,'none');persist();renderView()}")
        await pg.wait_for_function(f"{fin}.some(j=>j.meta.speed163===.5)", timeout=15000)
        await pg.wait_for_function("(renderView(),!!S.ed.clips[0].sl0)", polling=1000, timeout=150000)
        r = await pg.evaluate("""()=>{const c=S.ed.clips[0],R={was:c.sl0.speed,len:edTotal()};const a=document.createElement('button');a.dataset.set='edclip.speed';a.dataset.val='1';a.dataset.num='1';document.body.appendChild(a);a.click();a.remove();
          R.after={src:c.src,sl0:!!c.sl0,out:c.out};return R}""")
        out["respeed"] = r
        ok(r["was"] == .5 and abs(r["len"] - 4) < 0.05 and r["after"]["src"] == {"k": "job", "job": "lj1"} and not r["after"]["sl0"] and r["after"]["out"] == 2, f"0.5× made smooth (4 s); a new speed starts from the original {r}")
        # 5. a ramp: the engine's file is exactly as long as the editor's clip
        r = await pg.evaluate("""()=>{const c=S.ed.clips[0];edxSetSlow(c,.25,'bullet');persist();renderView();return {len:edTotal(),ramp:c.ramp}}""")
        await pg.wait_for_function(f"{fin}.some(j=>j.meta.ramp163==='bullet')", timeout=15000)
        await pg.wait_for_function("(renderView(),!!S.ed.clips[0].sl0)", polling=1000, timeout=150000)
        r2 = await pg.evaluate(f"()=>{{const j={fin}.find(j=>j.meta.ramp163==='bullet');return {{url:j.resultUrl,len:edTotal(),cost:j.cost}}}}")
        pr = probe(mfile(r2["url"])) if r2.get("url") else {}; out["ramp"] = {"editor": r, "after": r2, "file": pr}
        ok(r["ramp"] == "bullet" and r2["cost"] == 0 and abs(pr.get("dur", 0) - r["len"]) < 0.07 and abs(r2["len"] - r["len"]) < 0.05, f"bullet ramp: the file is as long as the editor's clip and the clip keeps its length {out['ramp']}")
        # 6. a video the engine can't take (not this account's): told once, smoothed on the device, not asked again
        r = await pg.evaluate("""async()=>{S.jobs.push({id:'lj2',remote:'zz',kind:'video',status:'complete',progress:1,resultUrl:'/media/notmine.webm',title:'Other',prompt:'y',created:Date.now(),dur:3,aspect:'16:9',art:'scene',seed:2,pal:PALS[0]});
          S.ed.clips.push({id:'c2',src:{k:'job',job:'lj2'},in:0,out:1,speed:1});S.ed.sel='c2';const c=S.ed.clips[1];edxSetSlow(c,.25,'none');persist();renderView();
          for(let i=0;i<40&&c.no163==null;i++){await new Promise(r=>setTimeout(r,500));renderView()}return {no:c.no163===edKey163(c),smooth:c.smooth,dev:/smoothed on this device/.test(speed145()),sl:!!c.sl163}}""")
        out["refused"] = r
        ok(r["no"] and r["smooth"] == "flow" and r["dev"] and not r["sl"], f"refused by the server → smoothed on the device, not asked again {r}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false", AI_LABEL="false"),
  stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    ok(wait(lambda: api("/v1/config"), 40), "server up")
    server_checks(); asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-1500:])
finally:
    srv.kill(); log = open(D + "/server.log").read()[-1500:]; shutil.rmtree(D, ignore_errors=True)
print(json.dumps(out, ensure_ascii=False, indent=1)[:5000])
if fails:
    print("server log:", log); print("FAILED:"); [print(" ✗", f) for f in fails]; sys.exit(1)
print("v168 ok")
