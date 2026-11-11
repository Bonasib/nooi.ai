# v270 — finished videos played with the sound off: the result players in nooi Studio carried "muted" though the files have
# their sound. The finished file keeps the engine's sound through every step here, and pressing play plays it. Run: python3 tests/v270.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8799, 8800; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v270-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=320x180:r=12:d=2", "-f", "lavfi", "-i", "sine=f=440:d=2", "-shortest", "-c:v", "libvpx-vp9", "-c:a", "libopus", D + "/res.webm"], check=True, timeout=90, stdin=subprocess.DEVNULL)
json.dump({"users": {"dev_someone": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
BP = []
class M(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, ctype="application/json"):
        b = o if isinstance(o, bytes) else json.dumps(o).encode(); self.send_response(200); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/res.webm": return self.send(open(D + "/res.webm", "rb").read(), "video/webm")
        return self.send({"status": "succeeded", "content": {"video_url": f"http://127.0.0.1:{MP}/res.webm"}})
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); BP.append(json.loads(self.rfile.read(n) or b"{}")); return self.send({"id": "cgt-%d" % len(BP)})
mk = ThreadingHTTPServer(("127.0.0.1", MP), M); threading.Thread(target=mk.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_", "FAL_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false",
    SEEDANCE_API_KEY="bd-test-key", SEEDANCE_BASE_URL=f"http://127.0.0.1:{MP}/api/v3"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
SIGN = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}"
def api(body):
    r = urllib.request.Request(B + "/v1/jobs", data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "X-Dev-User": "someone"}, method="POST")
    try: return json.loads(urllib.request.urlopen(r, timeout=30).read())
    except urllib.error.HTTPError as e: return {"err": e.code, "body": e.read().decode()[:300]}
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        b = await p.chromium.launch(); c = await b.new_context(viewport={"width": 1440, "height": 900}, extra_http_headers={"X-Dev-User": "someone"}); pg = await c.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await pg.evaluate(SIGN); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>go('video')"); await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{S.hf.vModel='seedance20';S.draft.model='seedance20';persist();renderView()}"); await pg.wait_for_timeout(300)
        await pg.fill('#dprompt', "A fisherman pulls in a net at sunrise and laughs"); await pg.click('#main [data-act="gen-video"]', force=True)
        url = None
        for _ in range(90):
            await pg.wait_for_timeout(1000)
            url = await pg.evaluate("()=>{const j=S.jobs.find(j=>j.kind==='video'&&j.status==='complete'&&mediaUrl(j));return j?mediaUrl(j):null}")
            if url: break
        chk("the video is made", bool(url), await pg.evaluate("()=>S.jobs.slice(0,2).map(j=>[j.status,String(j.error||'')])"))
        if url:
            f = D + "/media/" + url.split("/media/")[-1]
            st = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", f], capture_output=True, text=True, timeout=30).stdout.split()
            chk("the finished file still has the engine's sound", "audio" in st, st)
            await pg.evaluate("()=>renderView()"); await pg.wait_for_timeout(800)
            await pg.click('#main .gc98[data-open98]'); await pg.wait_for_timeout(1200)
            info = await pg.evaluate("()=>[...document.querySelectorAll('video')].filter(v=>v.getBoundingClientRect().width>200).map(v=>{let p=v.parentElement,a=[];for(let i=0;i<3&&p;i++){a.push(p.className);p=p.parentElement}return {attrMuted:v.hasAttribute('muted'),muted:v.muted,controls:v.controls,autoplay:v.autoplay,paused:v.paused,vol:v.volume,cls:v.className,in:a.join('<')}})")
            chk("tapping the result opens a player", len(info) >= 1, info)
            if info:
                big = await pg.evaluate_handle("()=>[...document.querySelectorAll('video')].find(v=>v.getBoundingClientRect().width>200)")
                await pg.evaluate("v=>{v.pause()}", big); await pg.wait_for_timeout(200)
                box = await pg.evaluate("v=>{const r=v.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}", big)
                await pg.mouse.click(box[0], box[1]); await pg.wait_for_timeout(300)
                if await pg.evaluate("v=>v.paused", big): await pg.mouse.click(box[0], box[1]); await pg.wait_for_timeout(300)
                d = await pg.evaluate("v=>({muted:v.muted,paused:v.paused,vol:v.volume})", big)
                chk("the opened player plays the video with sound", not d["muted"] and d["vol"] > 0, [info, d])
        chk("no page errors", not errs, errs)
        await b.close()
try: asyncio.run(main())
finally:
    srv.terminate(); mk.shutdown(); shutil.rmtree(D, ignore_errors=True)
print("FAIL\n- " + "\n- ".join(fails) if fails else "v270: finished videos keep their sound and play with it — all checks passed")
sys.exit(1 if fails else 0)
