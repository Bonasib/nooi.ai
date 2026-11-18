# v266 — the cinematic showcase. A real nooi server, a stand-in BytePlus (ByteDance) and a browser:
#  · Admin's "Make the cinematic shots" (group cinema): 24 Seedance 2.0 jobs with sound on the owner's ByteDance key, 5 s each,
#    16 genres, staff jobs (no nooi credits); the older showcase group doesn't start them
#  · made shots are public with their genre, person, template and line; a shot not made isn't listed in Explore's examples
#  · Templates shows "Cinematic shots" with genre chips; a shot opens with its video, who is in it, the spoken line's language
#    and the shape; picking one of my characters puts @Name in the prompt, picking French asks for the line in French;
#    "Use this shot" opens nooi Studio with that prompt and sound on — nothing is made
#  · Admin: the button says how many it will make first; a second press starts them
# Run: python3 tests/v266.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8797, 8798; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v266-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x204060:s=320x180:r=10:d=2", "-c:v", "libvpx-vp9", D + "/res.webm"], check=True, timeout=60, stdin=subprocess.DEVNULL)
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
ST = {"bp": []}
class M(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200, ctype="application/json"):
        b = o if isinstance(o, bytes) else json.dumps(o).encode(); self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/res.webm": return self.send(open(D + "/res.webm", "rb").read(), ctype="video/webm")
        if self.path.startswith("/api/v3/contents/generations/tasks/"): return self.send({"status": "succeeded", "content": {"video_url": f"http://127.0.0.1:{MP}/res.webm"}})
        return self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); b = json.loads(self.rfile.read(n) or b"{}")
        if self.path == "/api/v3/contents/generations/tasks": ST["bp"].append(b); return self.send({"id": "cgt-%d" % len(ST["bp"])})
        return self.send({}, 404)
mk = ThreadingHTTPServer(("127.0.0.1", MP), M); threading.Thread(target=mk.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "ADMIN_EMAILS", "SEEDANCE_", "ELEVEN", "SWAP_", "LOCAL_LLM", "GEMMA_", "DASHSCOPE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", MIRROR_MEDIA="false", AGENTS_AUTO_LEARN="false",
    SEEDANCE_API_KEY="bd-test-key", SEEDANCE_BASE_URL=f"http://127.0.0.1:{MP}/api/v3", ADMIN_EMAILS="boss@dev.local"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1500]))
def req(path, body=None, who="boss", method=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": who}, method=method or ("POST" if body is not None else "GET"))
    try: return json.loads(urllib.request.urlopen(r, timeout=60).read())
    except urllib.error.HTTPError as e: return {"status": e.code, **json.loads(e.read() or b"{}")}
SETUP = "(v)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go(v);renderAll()}"
async def page(p):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900}, extra_http_headers={"X-Dev-User": "boss"})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_timeout(1800); await E(SETUP, "explore"); await pg.wait_for_function("typeof SC!=='undefined'&&SC.items&&SC.items.some(s=>s.cat==='cinema'&&s.url)", timeout=20000); await E("()=>renderView()"); await pg.wait_for_timeout(500)
    sec = await E("()=>({cards:document.querySelectorAll('#main .cn266 .cc266').length,chips:[...document.querySelectorAll('#main .cng266 button')].map(b=>b.textContent),first:document.querySelector('#main .cn266 .cc266 b')?.textContent,page:document.documentElement.scrollWidth-innerWidth})")
    chk("Templates shows Cinematic shots: 24 made shots with genre chips (Fantasy, The 80s, The 90s, Comedy, Sci-fi, Adventure…)", sec["cards"] == 24 and {"All", "Fantasy", "Action", "The 80s", "The 90s", "Comedy", "Sci-fi", "Adventure"} <= set(sec["chips"]) and len(sec["chips"]) == 17 and sec["page"] <= 0, sec)
    await pg.click('#main .cng266 [data-cng266="80s"]'); await pg.wait_for_timeout(300)
    chk("a genre chip shows only its shots", await E("()=>document.querySelectorAll('#main .cn266 .cc266').length") == 2)
    await E("()=>{const c=S.chars[0];c.name='Layla';c.face='/media/x.png'}")
    await pg.click('#main .cc266[data-cn266="cn-arcade"]'); await pg.wait_for_timeout(400)
    sh = await E("()=>({video:!!document.querySelector('.cns266 video'),vhtml:(document.querySelector('.cns266')||{innerHTML:''}).innerHTML.slice(380,700),who:[...document.querySelectorAll('[data-cn266f=who] option')].map(o=>o.textContent),langs:document.querySelectorAll('[data-cn266f=lang] option').length,p:document.querySelector('[data-cn266p]').textContent})")
    chk("a shot opens with its video, who is in it (as filmed or my characters), 12 languages + no line, and its prompt", sh["video"] and sh["who"][0].startswith("As filmed") and "@Layla" in sh["who"] and sh["langs"] == 13 and "teenager with big curly hair" in sh["p"] and 'in English: "One more coin' in sh["p"], sh)
    await pg.select_option('[data-cn266f="who"]', label="@Layla"); await pg.select_option('[data-cn266f="lang"]', "fr"); await pg.wait_for_timeout(200)
    p2 = await E("()=>document.querySelector('[data-cn266p]').textContent")
    n0 = len(ST["bp"]); await pg.click('[data-act="cn266-use"]'); await pg.wait_for_timeout(700)
    st = await E("()=>({view:S.view,p:S.draft.prompt,audio:S.draft.audio,box:(document.getElementById('dprompt')||{}).value,sheet:!!document.querySelector('.cns266')})")
    chk("my character and French: @Layla replaces the person, the line is asked in French; Use this shot opens nooi Studio with it and sound on — nothing is made", "@Layla plays a glowing arcade cabinet" in p2 and "teenager" not in p2 and "said in French" in p2 and st["view"] == "video" and st["p"] == p2 and st["audio"] is True and st["box"] == p2 and not st["sheet"] and len(ST["bp"]) == n0, [p2, st])
    chk("page: no errors", not errs, errs); await b.close()
async def admin(p):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900}, extra_http_headers={"X-Dev-User": "boss"})).new_page(); E = pg.evaluate
    await pg.goto(B + "/"); await pg.wait_for_timeout(1800); await E(SETUP, "home"); await E("()=>{S.admTab='models';go('admin')}")
    try: await pg.wait_for_selector('[data-act="cine266-ask"]', timeout=20000)
    except Exception: chk("Admin shows the cinematic button", False, await E("()=>[S.view,S.admTab,!!document.querySelector('.scadm')]")); await b.close(); return
    t0 = await E("()=>document.querySelector('[data-act=\"cine266-ask\"]').textContent"); n0 = len(ST["bp"])
    await pg.click('[data-act="cine266-ask"]'); await pg.wait_for_timeout(400)
    ask = await E("()=>({t:(document.querySelector('.cnadm266 [role=alert]')||{}).textContent,go:!!document.querySelector('[data-act=\"cine266-go\"]')})")
    sent = len(ST["bp"]) - n0
    chk("Admin: the button says how many it will make (24 videos × 5 seconds) before anything starts", "(24)" in t0 and ask["go"] and "24 videos" in (ask["t"] or "") and "120 seconds" in (ask["t"] or "") and sent == 0, [t0, ask, sent])
    await b.close()
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    pub0 = [s for s in req("/v1/showcase").get("items", []) if s["cat"] == "cinema"]
    chk("24 cinematic shots in 16 genres, each a template (its person, its line), none made yet", len(pub0) == 24 and len({s["genre"] for s in pub0}) == 16 and all("{who}" in s["tpl"][0] and s["who"][0] and not s["url"] for s in pub0) and sum(1 for s in pub0 if s["line"]) == 23, [len(pub0)])
    async with async_playwright() as p:
        await admin(p)
        req("/v1/admin/showcase", {"group": "showcase"}); time.sleep(1)
        chk("the older showcase group doesn't start the cinematic shots", not any("dragon" in json.dumps(b).lower() for b in ST["bp"]), len(ST["bp"]))
        n0 = len(ST["bp"]); r = req("/v1/admin/showcase", {"group": "cinema"}); time.sleep(2)
        cine = ST["bp"][n0:]
        chk("Make the cinematic shots: 24 Seedance 2.0 jobs on the owner's ByteDance key, 5 s, with sound", len(cine) == 24 and all(str(b.get("model", "")).startswith("dreamina-seedance-2-0") and b.get("generate_audio") is True and b.get("duration") == 5 for b in cine) and any("Spoken line, in English" in json.dumps(b) for b in cine), {"n": len(cine), "one": cine[:1]})
        for _ in range(120):
            st = [x for x in req("/v1/admin/showcase").get("items", []) if x["cat"] == "cinema"]
            if all(x["status"] == "done" for x in st): break
            time.sleep(1)
        pub = [s for s in req("/v1/showcase", who="someone").get("items", []) if s["cat"] == "cinema"]
        bill = req("/v1/billing")
        chk("the shots are made and public with their video; staff jobs took no nooi credits", len(pub) == 24 and all(s["url"] for s in pub) and not any((x.get("delta") or 0) < 0 for x in bill.get("ledger", [])), {"made": sum(1 for s in pub if s["url"]), "status": [x["status"] for x in st][:6], "err": [x.get("error") for x in st if x.get("error")][:2]})
        await page(p)
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:900])
finally: srv.terminate(); mk.shutdown()
if fails: print("v266 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-2000:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v266 OK")
