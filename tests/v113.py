# v113 "I put the picture as first frame … but the outputs aren't related to it — the images and frames are not linked in the
# prompt" + "when you press Create or Generate, the prompt box remains on the screen". A real nooi server, a stand-in engine that
# records every request, and the page (phone):
#  · a video with a first frame: the engine gets the picture as its first frame AND words that open with "The video starts exactly
#    on the first-frame picture…" (its place, subject, composition, colours, light and look); the Style line is left out while a
#    frame is set (it pulled the video away from the picture); the type and camera move still go
#  · first + end frames: "…and ends exactly on the end-frame picture 8 seconds later"; an end frame alone: "ends exactly on…"
#  · no frame: the Style line as before, no frame words; Extend shot (its own words) is left as it is
#  · the page: the frames panel says the video starts on that picture and keeps its look; Generate closes the open panel and
#    the keyboard (the prompt empties, as before); English and Arabic
#  · "Model response exception, please try again later | 模型响应异常…(1012)" on a swap: asked again twice (then made, or failed
#    with plain words in English and Arabic, no Chinese, nothing charged)
#  · the phone screen turned off while files upload: the upload waits for the screen and goes on (not a failed job)
# Run: python3 tests/v113.py
import asyncio, base64, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8319, 8320
D = tempfile.mkdtemp(prefix="nooi-v113-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
for n, c in (("house", "0x3060a0"), ("sunset", "0xd08020")): subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c={c}:s=640x360", "-frames:v", "1", f"{D}/media/{n}.png"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/clip.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4"], check=True)
MOCK = r'''
import json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "busy": 0}; T = {}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/stats": return self.send(st)
        if self.path == "/res.mp4":
            b = open(DIR + "/res.mp4", "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        t = T.get(self.path.split("taskId=")[-1])
        if t and t["model"].startswith("minimax-h3"):   # the swap engine: busy for the first st["busy"] tasks, then made
            if t["n"] <= st["busy"]: return self.send({"code": 200, "data": {"state": "fail", "failMsg": "Model response exception, please try again later | 模型响应异常，请稍后重试", "failCode": "1012"}})
            u = f"http://localhost:{P}/res.mp4"; return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [u]})}})
        return self.send({"code": 200, "data": {"state": "generating"}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}")
        if self.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if self.path == "/plan": st.update(j); return self.send({"ok": 1})
        st["reqs"].append({"path": self.path, "body": j}); tid = "t%d" % len(st["reqs"]); T[tid] = {"model": str(j.get("model", "")), "n": len([x for x in st["reqs"] if str(x["body"].get("model", "")).startswith("minimax-h3")])}
        return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
reqs = lambda: json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())["reqs"]
def wait(fn, sec=30):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
def sent(body):
    n = len(reqs()); j = api("/v1/jobs", body); r = wait(lambda: reqs()[n:] or None, 20)
    return j, (r or [{}])[-1].get("body", {})
VID = lambda **k: {"kind": "video", "model": "seedance", "prompt": "the camera flies slowly toward the house", "dur": 8, "aspect": "16:9", "meta": {"type": "music", "style": "anim2d", "camera": "dollyIn"}, **k}

def server_checks():
    j, b = sent(VID(cid="a", inputs={"vStart": "/media/house.png"})); i = b.get("input") or {}; pr = i.get("prompt", ""); out["first"] = {"model": b.get("model"), "prompt": pr, "first_frame_url": i.get("first_frame_url")}
    ok(pr.startswith("The video starts exactly on the first-frame picture and continues from it, with the same place, subject, people, composition, colours, light and visual style as that picture")
       and str(i.get("first_frame_url", "")).endswith("/media/house.png"), f"a first frame: the picture is the first frame and the words open with it {out['first']}")
    ok("2D hand-drawn" not in pr and "Made as a music video." in pr and "Slow dolly-in" in pr and "the camera flies slowly toward the house" in pr, f"…the Style line is left out (the picture sets the look); the words, type and camera move still go {pr}")
    j, b = sent({**VID(cid="b", inputs={"vStart": "/media/house.png", "vEnd": "/media/sunset.png"}), "model": "kling30"}); i = b.get("input") or {}; pr = i.get("prompt", ""); out["both"] = {"model": b.get("model"), "prompt": pr[:300], "image_urls": i.get("image_urls")}
    ok(pr.startswith("The video starts exactly on the first-frame picture and ends exactly on the end-frame picture 8 seconds later") and len(i.get("image_urls") or []) == 2, f"first + end frames: both pictures, and the words tie the start and the end to them {out['both']}")
    j, b = sent(VID(cid="c", inputs={"vEnd": "/media/sunset.png"})); pr = (b.get("input") or {}).get("prompt", ""); out["end"] = pr[:200]
    ok(pr.startswith("The video ends exactly on the end-frame picture") and "2D hand-drawn" not in pr, f"an end frame alone {pr[:200]}")
    j, b = sent(VID(cid="d")); pr = (b.get("input") or {}).get("prompt", ""); out["none"] = pr[:300]
    ok("first-frame" not in pr and "end-frame" not in pr and "2D hand-drawn animation style" in pr, f"no frame: the Style line as before, no frame words {pr[:300]}")
    j, b = sent({**VID(cid="e", inputs={"startImage": "/media/house.png"}), "prompt": "Continue the same shot", "meta": {"extend94": True}}); pr = (b.get("input") or {}).get("prompt", ""); out["extend"] = pr[:200]
    ok("first-frame picture" not in pr, f"Extend shot keeps its own words {pr[:200]}")
    # a busy engine on a swap: asked again twice
    SW = lambda cid: {"kind": "video", "model": "mcswap", "prompt": "", "dur": 5, "aspect": "16:9", "cid": cid, "inputs": {"mcMove": "/media/clip.mp4", "mcChar": "/media/house.png"}, "meta": {"motion83": True, "swap93": True, "consent": True}}
    h3 = lambda: len([x for x in reqs() if str(x["body"].get("model", "")).startswith("minimax-h3")])
    def made(cid, busy):
        call = urllib.request.Request(f"http://localhost:{KPORT}/plan", data=json.dumps({"busy": busy}).encode(), method="POST", headers={"content-type": "application/json"}); urllib.request.urlopen(call).read()
        n0 = h3(); j = api("/v1/jobs", SW(cid)); d = wait(lambda: (lambda x: x if x.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + j.get("id", "x"))), 90) or {}
        return d, h3() - n0
    d, n = made("busy-ok", 2); out["busy_ok"] = [d.get("status"), n, d.get("error")]
    ok(d.get("status") == "done" and n == 3, f"a busy engine is asked again (20 s, then 60 s later) and the swap is made {out['busy_ok']}")
    d, n = made("busy-no", 99); out["busy_no"] = [d.get("status"), n, d.get("error"), d.get("errorAr")]
    ok(d.get("status") == "failed" and n == 3 and d.get("error") == "The engine was too busy to make this — we asked it again twice. Nothing was charged. Try again in a few minutes."
       and "كان المحرّك مشغولاً جداً فلم يصنع هذا — طلبناه منه مرتين أخريين" in str(d.get("errorAr")) and not any("\u3000" <= ch <= "\u9fff" for ch in str(d.get("error")) + str(d.get("errorAr"))), f"still busy after that: plain words, English and Arabic, no Chinese {out['busy_no']}")

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 390, "height": 844})).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        posts = []; pg.on("request", lambda r: posts.append(r.post_data) if r.method == "POST" and r.url.endswith("/v1/jobs") else None)
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go('video');renderAll()}"); await pg.wait_for_timeout(600)
        png = base64.b64encode(open(D + "/media/house.png", "rb").read()).decode()
        await E("async b=>{const s=atob(b),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);loadSlot('vStart',new File([a],'house.png',{type:'image/png'}));S.draft.startJob=null;renderAll()}", png)
        await pg.wait_for_timeout(500); await pg.click("[data-o93=length]"); await pg.wait_for_timeout(500)
        vis = "()=>{const k=document.querySelector('.kfbox');if(!k)return false;const r=k.getBoundingClientRect();return r.height>0&&k.offsetParent!==null}"
        note = await E("()=>document.querySelector('.fr113')?.textContent||''"); out["note"] = note
        ok(await E(vis) and "The video starts on this picture and keeps its place, subject and look" in note and "Style choice is left out" in note, f"the frames panel says what the first frame does {note}")
        await pg.fill("#dprompt", "the camera flies slowly toward the house"); await pg.focus("#dprompt")
        await pg.click('[data-act="gen-video"]'); await pg.wait_for_timeout(2500)
        st = await E("()=>({open:ST93().open,ta:document.querySelector('#dprompt')?.value,focus:document.activeElement&&document.activeElement.tagName})"); st["visible"] = await E(vis); out["after"] = st
        body = json.loads(posts[-1]) if posts and posts[-1] else {}
        ok(str((body.get("inputs") or {}).get("vStart", "")).startswith("http") or str((body.get("inputs") or {}).get("vStart", "")).startswith("/media/"), f"the page sends the first frame {body.get('inputs')}")
        ok(not st["visible"] and st["open"] == "" and st["ta"] == "" and st["focus"] != "TEXTAREA", f"Generate closes the open panel and the keyboard; the prompt empties {st}")
        await E("()=>{S.lang='ar';ST93().open='length';renderAll()}"); await pg.wait_for_timeout(500)
        na = await E("()=>document.querySelector('.fr113')?.textContent||''")
        ok("يبدأ الفيديو من هذه الصورة" in na, f"…and in Arabic {na}")
        # the screen turned off while a file uploads: the upload waits and goes on when the screen is back
        st2 = {"block": True}
        async def up(route):
            if st2["block"]: return await route.abort("internetdisconnected")
            await route.continue_()
        await pg.route("**/v1/uploads", up)
        await E("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hid113});window.__hid113=true;document.dispatchEvent(new Event('visibilitychange'));window.__up=null;API.upload(new Blob([new Uint8Array([137,80,78,71,1,2,3])],{type:'image/png'}),'a.png').then(r=>window.__up=r.url||'ok',e=>window.__up='ERR '+e.message)}")
        await pg.wait_for_timeout(9000); mid = await E("()=>window.__up")
        st2["block"] = False; await E("()=>{window.__hid113=false;document.dispatchEvent(new Event('visibilitychange'))}")
        fin = None
        for _ in range(40):
            fin = await E("()=>window.__up")
            if fin: break
            await asyncio.sleep(.25)
        out["screen"] = [mid, fin]
        ok(mid is None and fin and not str(fin).startswith("ERR"), f"an upload cut off by the screen turning off waits, then goes on {out['screen']}")
        st2["block"] = True; await E("()=>{window.__up=null;API.upload(new Blob([new Uint8Array([137,80,78,71,9])],{type:'image/png'}),'b.png').then(r=>window.__up='ok',e=>window.__up='ERR')}")
        await pg.wait_for_timeout(9000); ok(await E("()=>window.__up") == "ERR", "with the screen on, a lost connection still says so (no endless wait)"); st2["block"] = False
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", FREE_PERIOD="false", MC_AGAIN_MS="300", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30); wait(lambda: reqs() is not None, 10)
    server_checks()
    asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1))
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
