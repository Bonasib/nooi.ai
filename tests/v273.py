# v273 — the ready cast: 30 fictional people (portraits and character sheets the owner supplied), each with a fixed face, a sheet,
# a description, a native language and a voice. The server serves them (/v1/cast, the ready avatars), each says hello in their
# own language and voice (free, made once); the page shows them in Characters and UGC ads; used once, the person is a character
# whose face (and sheet) go with every job that names them. Run: python3 tests/v273.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8817, 8818; B = f"http://localhost:{PORT}"; M = f"http://127.0.0.1:{MP}"
D = tempfile.mkdtemp(prefix="nooi-v273-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=330:d=2", "-c:a", "libmp3lame", "-b:a", "64k", D + "/hi.mp3"], check=True, timeout=60, stdin=subprocess.DEVNULL)
json.dump({"users": {"dev_someone": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
ST = {"tts": []}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); b = json.loads(self.rfile.read(n) or b"{}")
        if self.path.startswith("/v1/text-to-speech/"):
            ST["tts"].append({"voice": self.path.split("/")[3].split("?")[0], "text": b.get("text", "")}); out = open(D + "/hi.mp3", "rb").read()
            self.send_response(200); self.send_header("Content-Type", "audio/mpeg"); self.send_header("Content-Length", str(len(out))); self.end_headers(); self.wfile.write(out); return
        self.send_response(404); self.end_headers()
    def do_GET(self): self.send_response(404); self.end_headers()
mk = ThreadingHTTPServer(("127.0.0.1", MP), H); threading.Thread(target=mk.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_", "FAL_", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false",
    ELEVENLABS_API_KEY="el-test", ELEVENLABS_BASE_URL=M), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
def api(path, body=None, who="someone"):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": who}, method="POST" if body is not None else "GET")
    try: return json.loads(urllib.request.urlopen(r, timeout=60).read())
    except urllib.error.HTTPError as e: return {"err": e.code, "body": e.read().decode()[:300]}
def head(u):
    try: r = urllib.request.urlopen(u, timeout=20); return r.status, int(r.headers.get("Content-Length") or 0), r.headers.get("Content-Type")
    except Exception as e: return str(e), 0, ""
SIGN = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}"
async def page():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900}, extra_http_headers={"X-Dev-User": "someone"})).new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); posts = []; pg.on("request", lambda rq: rq.method == "POST" and rq.url.endswith("/v1/jobs") and posts.append(rq.post_data))
        await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await pg.evaluate(SIGN); await pg.wait_for_timeout(400)
        await pg.click('#sb253 [data-go="chars"]'); await pg.wait_for_function("document.querySelectorAll('#main .cast273 .cc273').length>0", timeout=20000)
        out["cards"] = await pg.evaluate("()=>document.querySelectorAll('#main .cast273 .cc273').length")
        out["imgs"] = await pg.evaluate("async()=>{const im=[...document.querySelectorAll('#main .cast273 .cc273 img')];await new Promise(r=>setTimeout(r,1500));return im.filter(i=>i.complete&&i.naturalWidth>100).length}")
        await pg.screenshot(path=os.environ.get("SHOT", "/dev/null") if os.environ.get("SHOT") else D + "/c.png")
        await pg.click('#main [data-castf273="kids"]'); await pg.wait_for_timeout(300); out["kids"] = await pg.evaluate("()=>document.querySelectorAll('#main .cast273 .cc273').length")
        await pg.click('#main [data-castf273="all"]'); await pg.wait_for_timeout(300)
        await pg.click('#main .cc273[data-cast273="cast-omar"]'); await pg.wait_for_timeout(500)
        out["sheet"] = await pg.evaluate("()=>{const s=document.querySelector('.cs273');return s?{h:s.querySelector('h2').textContent,big:(s.querySelector('.cbig273')||{}).src||'',meta:s.querySelector('.cmeta273').textContent}:null}")
        n0 = len(ST["tts"]); await pg.click('[data-act="cast273-hear"]'); await pg.wait_for_timeout(2500); out["tts"] = ST["tts"][n0:]
        await pg.click('[data-act="cast273-use"]'); await pg.wait_for_timeout(700)
        out["char"] = await pg.evaluate("()=>{const c=S.chars.find(c=>c.id==='cast-omar');return c?{name:c.name,face:c.face,sheet:c.sheet273,voice:c.voice,view:S.view,rowImg:!!document.querySelector('#main .charrow img[src*=cast273-omar]')}:null}")
        # @Omar in a picture job → his face goes with it (as the face reference)
        await pg.evaluate("()=>{S.img=S.img||{};}"); posts.clear()
        out["job"] = await pg.evaluate("()=>{const j=addJob({kind:'image',model:'nano',prompt:'@Omar holds a cup of coffee in a sunny cafe',aspect:'1:1',cost:5});return j?{id:j.id}:null}")
        await pg.wait_for_timeout(2500); out["posted"] = [json.loads(x) for x in posts][:2]
        # UGC ads: the cast as presenters
        await pg.click('#sb253 [data-go="video"]') if await pg.locator('#sb253 [data-go="video"]').is_visible() else None
        await pg.evaluate("()=>go('ugcads')"); await pg.wait_for_function("!!document.querySelector('#main [data-act=\"ugc-av87\"][data-v=\"cast-amina\"]')", timeout=20000)
        await pg.click('#main [data-act="ugc-av87"][data-v="cast-amina"]'); await pg.wait_for_timeout(500)
        out["ugc"] = await pg.evaluate("()=>({pick:S.draft.charId,face:(S.chars.find(c=>c.id==='cast-amina')||{}).face||'',voice:((S.chars.find(c=>c.id==='cast-amina')||{}).voice||{}).name,pressed:(document.querySelector('#main [data-act=\"ugc-av87\"][data-v=\"cast-amina\"]')||{getAttribute:()=>null}).getAttribute('aria-pressed')})")
        out["errs"] = errs; await b.close()
        # Arabic phone: the grid fits, the names in Arabic
        b = await p.chromium.launch(); pg = await (await b.new_context(**p.devices["iPhone 13"], extra_http_headers={"X-Dev-User": "someone"})).new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await pg.evaluate(SIGN); await pg.evaluate("()=>{setUILang('ar');document.getElementById('modalRoot').innerHTML='';go('chars')}")
        await pg.wait_for_function("document.querySelectorAll('#main .cast273 .cc273').length>0", timeout=20000); await pg.wait_for_timeout(800)
        out["phone"] = await pg.evaluate("()=>({wide:document.documentElement.scrollWidth-innerWidth,first:document.querySelector('#main .cc273 b').textContent,cols:getComputedStyle(document.querySelector('#main .cgrid273')).gridTemplateColumns.split(' ').length})")
        await pg.evaluate("()=>document.querySelector('#main .cast273').scrollIntoView()"); await pg.wait_for_timeout(600)
        if os.environ.get("SHOT2"): await pg.screenshot(path=os.environ["SHOT2"])
        await pg.click('#main .cc273[data-cast273="cast-hassan"]'); await pg.wait_for_timeout(600)
        if os.environ.get("SHOT3"): await pg.screenshot(path=os.environ["SHOT3"])
        out["phoneSheet"] = await pg.evaluate("()=>{const s=document.querySelector('.cs273');return s?{w:Math.round(s.getBoundingClientRect().width),wide:document.documentElement.scrollWidth-innerWidth}:null}")
        await b.close()
    return out, errs
try:
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    cast = api("/v1/cast").get("items") or []
    chk("the server serves the 30 cast members", len(cast) == 30 and len({c["id"] for c in cast}) == 30, len(cast))
    chk("each has a face, and the 20 sheet characters a sheet, a body and a smile", all(c.get("face") and c.get("thumb") for c in cast) and sum(1 for c in cast if c.get("sheet") and c.get("body") and c.get("smile")) == 20, [c["id"] for c in cast if not c.get("face")])
    bad = [(c["id"], u, head(u)[:2]) for c in cast for u in (c.get("face"), c.get("sheet"), c.get("thumb")) if u and head(u)[0] != 200]
    chk("every picture is served from the media folder (as engines reach them)", not bad and all("/media/cast273-" in c["face"] for c in cast), bad[:4])
    chk("each has a voice of the voice engine (a real voice id), their gender and age", all(len(c["voice"]["id"]) >= 18 and c["voice"]["gender"] == c["gender"] and c["voice"]["age"] == c["band"] for c in cast), [c["voice"] for c in cast][:3])
    chk("children are marked (7)", sum(1 for c in cast if c["kid"]) == 7 and all(c["age"] < 18 for c in cast if c["kid"]), [c["id"] for c in cast if c["kid"]])
    av = api("/v1/avatars").get("items") or []
    chk("the ready avatars list has the cast, adults first", len([a for a in av if a.get("cast")]) == 30 and not av[0].get("kid") and av[0].get("url"), [a.get("id") for a in av][:3])
    r1 = api("/v1/voice/sample", {"cast": "cast-yui"}); r2 = api("/v1/voice/sample", {"cast": "cast-yui"})
    yui = next(c for c in cast if c["id"] == "cast-yui")
    chk("a cast member says hello in their own language and voice (Yui: Japanese), made once, free", r1.get("url") and r1.get("cost") == 0 and r2.get("url") == r1.get("url") and len(ST["tts"]) == 1 and ST["tts"][0]["voice"] == yui["voice"]["id"] and "です" in ST["tts"][0]["text"], [r1, r2, ST["tts"]])
    chk("an unknown cast id → 404", api("/v1/voice/sample", {"cast": "cast-nobody"}).get("err") == 404)
    out, errs = asyncio.run(page())
    chk("Characters shows the 30 ready characters with their pictures", out.get("cards") == 30 and out.get("imgs", 0) >= 20, [out.get("cards"), out.get("imgs")])
    chk("the Children filter shows the 7 children", out.get("kids") == 7, out.get("kids"))
    s = out.get("sheet") or {}
    chk("opening Omar shows his sheet, language and voice", "Omar" in s.get("h", "") and "cast273-omar-sheet" in s.get("big", "") and "Arabic" in s.get("meta", "") and "Roger" in s.get("meta", ""), s)
    omar = next(c for c in cast if c["id"] == "cast-omar")
    chk("'Hear the voice' plays Omar's voice saying hello in Arabic", out.get("tts") and out["tts"][0]["voice"] == omar["voice"]["id"] and "عمر" in out["tts"][0]["text"], out.get("tts"))
    ch = out.get("char") or {}
    chk("'Use this character' makes him one of the customer's characters, with his face, sheet and voice", ch.get("name") == "Omar" and "cast273-omar-face" in (ch.get("face") or "") and "cast273-omar-sheet" in (ch.get("sheet") or "") and (ch.get("voice") or {}).get("id") == omar["voice"]["id"] and ch.get("view") == "chars" and ch.get("rowImg"), ch)
    sent = json.dumps(out.get("posted") or [])
    chk("a job that names @Omar carries his face (and sheet) to the engine", "cast273-omar-face" in sent, sent[:600])
    u = out.get("ugc") or {}
    chk("UGC ads offers the cast as presenters; picking Amina makes her the presenter, with her face and voice", u.get("pick") == "cast-amina" and "cast273-amina-face" in u.get("face", "") and u.get("voice") == "Aria" and u.get("pressed") == "true", u)
    ph = out.get("phone") or {}
    chk("Arabic phone: the grid fits (3 across), names in Arabic", ph.get("wide", 1) <= 0 and ph.get("cols") == 3 and any("؀" <= ch <= "ۿ" for ch in ph.get("first", "")), ph)
    chk("…and the character window fits the phone", (out.get("phoneSheet") or {}).get("wide", 1) <= 0, out.get("phoneSheet"))
    chk("no page errors", not errs, errs)
finally:
    srv.terminate(); mk.shutdown(); log = open(D + "/srv.log").read(); shutil.rmtree(D, ignore_errors=True)
print("FAIL\n- " + "\n- ".join(fails) + "\nlog: " + log[-800:] if fails else "v273: the ready cast — all checks passed")
sys.exit(1 if fails else 0)
