# v160 "when I write in Arabic the voices in the video are always English — is there a problem? The prompt should be understood
# in Arabic or Russian, with all its details, e.g. @Younes … in a Chinese-Arabic accent: (اهلا بكم في الصين في شركة روندا)". A real
# nooi server, a stand-in engine and a stand-in text AI that translates and plans BADLY on purpose (it turns the line into English),
# and the page on a phone:
#  · translation: the line someone says (quotes, brackets after a colon, "says:") never comes back in English — kept out of the
#    translation and put back as "…"; the engine is told "Everything said aloud is in Arabic, never English"; a talking Arabic
#    prompt without a line gets the same sentence; a non-talking one doesn't; "speaks English" is respected; Russian too;
#    a silent video gets nothing; the no-on-screen-text line is still there
#  · the agents: the brief tells them which language people speak and to keep the lines; their plan, even when it translated the
#    line, comes back with the Arabic line and the sentence; the storyboard's dialogue is in Arabic even when the page is in English
#  · the Video page's voice-over in Arabic is said in Arabic; the character's voice speaks the language of its lines
#  · the page: nooi Auto doesn't pick Kling 2.6 (Chinese and English only) for Arabic speech; picked by hand, a notice says so
# Run: python3 tests/v160.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8482, 8483; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v160-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x3060a0:s=320x240:r=10:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/media/clip.mp4"], check=True)
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P = int(sys.argv[1]); st = {"reqs": [], "llm": [], "tr": "slots"}
def translate(t, mode):
    slot = "(⟦1⟧)" if mode == "slots" and "⟦1⟧" in t else None
    if "يونس شاب صيني" in t: return "Younes, a young Chinese man who speaks Chinese and Arabic, will market the company in a Chinese-Arabic accent: " + (slot or "Welcome to China, to Ronda company") + ". Realistic gestures, expressions and enthusiasm."
    if "يتكلم عن التجارة" in t: return "Younes talks about trade in China."
    if "قطة تلعب" in t: return "A cat plays in a garden."
    if "يتحدث بالإنجليزية" in t: return "A man speaks in English about cars."
    if "Иван" in t: return "Ivan smiles and says: " + ("«⟦1⟧»" if "⟦1⟧" in t and mode == "slots" else "Hello, friends!")
    return "An English prompt."
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        return self.send({"code": 200, "data": {"state": "generating"}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path == "/mode": st.update(j); return self.send(st)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 500})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text"); st["llm"].append(text)
            if text.startswith("Put this prompt for an AI picture / video generator into natural English"): return self.send({"content": [{"type": "text", "text": translate(text, st["tr"])}]})
            if "planning one" in text:
                o = {"brief": {}, "agents": {}, "request": "Younes markets the Ronda company in Chinese-accented Arabic", "prompt": "Younes greets visitors in front of the Ronda office in China, saying Welcome to China, to Ronda company, with enthusiastic gestures.", "negative": "", "bible": "", "shots": []}
                return self.send({"content": [{"type": "text", "text": json.dumps(o)}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "data": {"taskId": "t%d" % len(st["reqs"])}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, port=PORT):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"content-type": "application/json"})
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
def engine(prompt, **meta):
    n = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": prompt, "dur": 5, "aspect": "16:9", "meta": {"audio": True, "chosen155": [], **meta}})
    r = wait(lambda: stats()["reqs"][n:] or None, 40) or [{}]
    return j, ((r[-1].get("body") or {}).get("input") or {}).get("prompt", "")
U = "@يونس شاب صيني يتحدث باللغة الصينية ويتحدث العربية، يونس سوف يعمل تسويق للشركة بلهجة عربية صينية: (اهلا بكم في الصين في شركة روندا) المخرجات تكون لهجة عربية صينية مع الحركات والتعبيرات والحماس بشكل واقعي"
LINE = "اهلا بكم في الصين في شركة روندا"; AR = "Everything said aloud is in Arabic, never English"

def server_checks():
    api("/mode", {"tr": "slots"}, port=KPORT); j, p = engine(U); out["slots"] = p
    ok(LINE in p and AR in p and "No on-screen text" in p and "⟦" not in p and "Welcome to China" not in p, f"Arabic prompt, a line in (brackets): the engine gets the line in Arabic + the spoken language {p!r}")
    t = next((x for x in reversed(stats()["llm"]) if x.startswith("Put this prompt")), ""); ok("⟦1⟧" in t and LINE not in t, "the line never reaches the translator (a mark stands in for it)")
    api("/mode", {"tr": "drop"}, port=KPORT); j, p = engine(U + " ."); out["drop"] = p
    ok(LINE in p and AR in p, f"a translator that drops the mark → the Arabic line still reaches the engine {p!r}")
    api("/mode", {"tr": "slots"}, port=KPORT)
    j, p = engine("يونس يتكلم عن التجارة في الصين"); out["talks"] = p; ok(AR in p and p.startswith("Younes talks about trade"), f"Arabic, someone talks, no line → speaks Arabic {p!r}")
    j, p = engine("قطة تلعب في حديقة"); ok("said aloud" not in p, f"Arabic, nobody talks → no speech sentence {p!r}")
    j, p = engine("رجل يتحدث بالإنجليزية عن السيارات"); out["en"] = p; ok("Everything said aloud is in English" in p and "never English" not in p, f"'speaks English' is respected {p!r}")
    j, p = engine("Иван улыбается и говорит: «Привет, друзья!»"); out["ru"] = p; ok("Привет, друзья!" in p and "Everything said aloud is in Russian, never English" in p, f"Russian {p!r}")
    j, p = engine("يونس يتكلم عن التجارة في الصين", audio=False); ok("said aloud" not in p, f"a silent video → no speech sentence {p!r}")
    j, p = engine("A presenter in a studio", vo="اهلا بكم في نوي"); out["vo"] = p; ok('Voice-over in Arabic, never English: "اهلا بكم في نوي"' in p, f"the Video page's voice-over in Arabic {p!r}")
    # the agents
    n = len(stats()["llm"]); r = api("/v1/agents/plan", {"prompt": U, "task": "video", "dur": 5, "aspect": "16:9", "lang": "en"}); out["plan"] = r.get("prompt")
    t = next((x for x in stats()["llm"][n:] if "planning one" in x), "")
    ok("People in this video speak Arabic" in t and "never translated" in t, "the agents are told the language and to keep the lines")
    ok(LINE in (r.get("prompt") or "") and AR in (r.get("prompt") or ""), f"a plan that translated the line comes back with the Arabic line + the language {r.get('prompt')!r}")
    j, p = engine(r.get("prompt") or "", agents=1); out["plan_job"] = p
    ok(p.count(AR) == 1 and LINE in p, f"the planned job keeps one speech sentence and the line {p!r}")
    n = len(stats()["llm"]); api("/v1/agents/storyboard", {"prompt": "يونس يرحب بالزوار ويتكلم عن الشركة", "scenes": 3, "lang": "en"})
    t = next((x for x in stats()["llm"][n:] if "storyboard of" in x), ""); ok('write "dialogue" — what people say — in Arabic' in t, "the storyboard's dialogue is in Arabic with the page in English")
    q = api("/v1/sound134/quote", {"src": "/media/clip.mp4", "lang": "en", "say": "اهلا بكم في الصين", "want": {"voice": True}}); out["quote"] = q
    ok(q.get("lang") == "ar", f"the character's voice speaks the language of its lines {q.get('lang')}")

async def page_checks(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    async def E(js, arg=None): return await asyncio.wait_for(pg.evaluate(js, arg), 60)
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go('home');renderAll()}")
    pk = await E("""()=>{const v=API.cfg.providers.video;API.cfg.providers.video=false;try{const o={camera:'orbit',style:'cinematic'};
      return {base:pickVideo('رجل يركض في السوق',o).id,talk:pickVideo('رجل يركض في السوق ويقول: (مرحبا بكم في السوق)',o).id,en:pickVideo('a man runs in the market and says "welcome"',o).id}}finally{API.cfg.providers.video=v}}""")
    out["pick"] = pk
    ok(pk["base"] != "kling26" or pk["talk"] != "kling26", f"nooi Auto: no Kling 2.6 for Arabic speech {pk}")
    if pk["base"] == "kling26": ok(pk["talk"] != "kling26" and pk["en"] == "kling26", f"… only when the speech isn't Chinese or English {pk}")
    t = await E("""()=>{note160=0;addJob({kind:'video',model:'kling26',prompt:'Younes greets the visitors',title:'يونس يقول: "مرحبا بكم"',cost:0,dur:5,aspect:'16:9',meta:{}});return $('#toast')?.textContent||''}""")
    out["note"] = t; ok("speaks only Chinese and English" in t and "Arabic" in t, f"Kling 2.6 picked by hand → a notice {t!r}")
    t2 = await E("""()=>{note160=0;const seen=[],keep=toast;toast=function(m){seen.push(String(m));return keep.apply(this,arguments)};
      try{addJob({kind:'video',model:'kling26',prompt:'A man says "hello"',title:'A man says "hello"',cost:0,dur:5,aspect:'16:9',meta:{}})}finally{toast=keep}return seen.some(x=>x.includes('speaks only Chinese'))}""")
    ok(not t2, "English speech on Kling 2.6 → no notice")
    rl = await E("""()=>{S.hf.prompt='يونس يتكلم عن التجارة في الصين';const a=req157(null,{mode:'preset',voice:'JBFqnCBsd6RMkjVDRZzb'},5).lang;
      const b=req157(null,{mode:'preset',voice:'JBFqnCBsd6RMkjVDRZzb',say:'Привет, друзья'},5).lang;S.hf.prompt='a man talks about cars';const c=req157(null,{mode:'preset',voice:'JBFqnCBsd6RMkjVDRZzb'},5).lang;return [a,b,c]}""")
    ok(rl == ["ar", "ru", "en"], f"the character's voice: the language of the prompt or its lines, else the page's {rl}")
    ok(not errs, f"page errors {errs}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); await page_checks(b); await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(B + "/v1/config", timeout=2), 30); wait(lambda: stats(), 10)
    server_checks(); asyncio.run(main())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1, default=str)[:7000])
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
