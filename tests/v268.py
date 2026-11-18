# v268 — videos came out silent: the Sound switch was off by default (and saved off in every browser), and tools that send no
# choice (films, long videos) asked for no sound. Now sound is on unless turned off; edits keep the client's own sound; silent
# engines stay silent. Run: python3 tests/v268.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8796, 8797; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v268-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
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
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", MIRROR_MEDIA="false",
    SEEDANCE_API_KEY="bd-test-key", SEEDANCE_BASE_URL=f"http://127.0.0.1:{MP}/api/v3"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
SIGN = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}"
def api(body):
    r = urllib.request.Request(B + "/v1/jobs", data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "X-Dev-User": "someone"}, method="POST")
    try: return json.loads(urllib.request.urlopen(r, timeout=30).read())
    except urllib.error.HTTPError as e: return {"err": e.code, "body": e.read().decode()[:300]}
async def generate(p, old=None):
    b = await p.chromium.launch(); c = await b.new_context(viewport={"width": 1440, "height": 900}, extra_http_headers={"X-Dev-User": "someone"}); pg = await c.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200])); await pg.goto(B + "/"); await pg.wait_for_timeout(1500)
    if old is not None: await pg.evaluate("v=>{S.hf=Object.assign(S.hf||{},{sound:v});delete S.hf.snd268;persist()}", old); await pg.reload(); await pg.wait_for_timeout(1500)
    await pg.evaluate(SIGN); await pg.wait_for_timeout(500)
    await pg.evaluate("()=>go('video')"); await pg.wait_for_timeout(900)
    await pg.evaluate("()=>{S.hf.vModel='seedance20';S.draft.model='seedance20';persist();renderView()}"); await pg.wait_for_timeout(300)
    await pg.fill('#dprompt', "A fisherman pulls in a net at sunrise and laughs"); n0 = len(BP)
    await pg.click('#main [data-act="gen-video"]', force=True)
    for _ in range(40):
        if len(BP) > n0: break
        await pg.wait_for_timeout(250)
    sound = await pg.evaluate("()=>({sound:S.hf.sound,jobs:S.jobs.slice(0,2).map(j=>[j.model,j.status,String(j.error||'').slice(0,120)]),toast:(document.querySelector('#toast')||{}).textContent})"); await b.close(); return BP[n0:], sound, errs
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        sent, st, errs = await generate(p)
        chk("a new customer presses Generate in nooi Studio → the video is asked with sound", len(sent) == 1 and sent[0].get("generate_audio") is True, [x.get("generate_audio") for x in sent] + [st])
        sent, st, errs2 = await generate(p, old=False)
        chk("a browser that had saved the old 'sound off' gets sound on once", len(sent) == 1 and sent[0].get("generate_audio") is True and st["sound"] is True, [[x.get("generate_audio") for x in sent], st])
        chk("no page errors", not errs and not errs2, errs + errs2)
    base = {"kind": "video", "model": "seedance20", "prompt": "A dog runs on a beach", "aspect": "16:9", "dur": 5, "count": 1}
    for name, meta, want in (("a job that says nothing about sound (films, long videos) gets sound", {}, True),
                             ("a job that turns sound off stays silent", {"audio": False}, False)):
        n0 = len(BP); r = api(dict(base, meta=meta)); time.sleep(1.5)
        chk(name, len(BP) > n0 and BP[n0].get("generate_audio") is want, [r, [x.get("generate_audio") for x in BP[n0:]]])
    print("seedance requests:", len(BP))
try: asyncio.run(main())
finally:
    srv.terminate(); mk.shutdown(); shutil.rmtree(D, ignore_errors=True)
print("FAIL\n- " + "\n- ".join(fails) if fails else "v268: videos are made with sound unless it is turned off — all checks passed")
sys.exit(1 if fails else 0)
