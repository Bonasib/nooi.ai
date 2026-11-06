# v240 — "Only my MiniMax key": the AI engine is never used, even with its key saved.
#  · the server: the owner's switch (Admin → AI providers → MiniMax) turns it on; a customer can't. While it is on every video,
#    picture, voice and music job goes to MiniMax whatever model was picked, and what MiniMax can't make (a Character Swap, Motion
#    Control, a picture edit, lip-sync, a sound effect, Replace things) is refused before anything is charged
#  · /v1/config says the AI engine is off and MiniMax makes videos, pictures, voices and music
#  · deploy/why.sh says the AI engine is OFF (key saved, not used)
#  · the site: Motion Control says the tool isn't available and Make can't be pressed; Replace things doesn't open; the Admin card
#    has the switch · the studio: Replace / Recast / Restyle say the tool isn't available
#  · switched off → the AI engine is back
# Run: python3 tests/v240.py
import asyncio, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8755; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v240-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules"); os.symlink(ROOT + "/lib", D + "/lib"); os.symlink(ROOT + "/providers", D + "/providers"); shutil.copy(ROOT + "/package.json", D)
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=25:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k", D + "/media/v.webm")
FF("-f", "lavfi", "-i", "color=c=red:s=64x64:d=1", "-frames:v", "1", D + "/media/p.png")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "ADMIN_EMAILS", "ELEVEN"))}
# (a fake key for each: no request reaches MiniMax or the AI engine — MiniMax's jobs fail on the network and are refunded)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false",
    KIE_API_KEY="kie-test-000", MINIMAX_API_KEY="mm-test-000", MINIMAX_BASE_URL="http://127.0.0.1:9", ADMIN_EMAILS="boss@dev.local"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1100]))
def req(path, body=None, who="someone", method=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": who}, method=method or ("POST" if body is not None else "GET"))
    try: return json.loads(urllib.request.urlopen(r, timeout=30).read())
    except urllib.error.HTTPError as e: return {"status": e.code, **json.loads(e.read() or b"{}")}
def db(): return json.load(open(D + "/data/db.json"))
def why(): return subprocess.run(["bash", ROOT + "/deploy/why.sh"], env=dict(os.environ, APP=D, MINIMAX_API_KEY="mm-test-000", KIE_API_KEY="kie-test-000", SECRET_KEY="f" * 40), capture_output=True, text=True, timeout=60).stdout

def server_on():
    a0 = req("/v1/admin/minimax183", who="boss"); c0 = req("/v1/config")
    chk("before: the switch is off, the AI engine is connected", a0.get("only") is False and c0["providers"].get("engine") is True and c0["providers"].get("mmOnly240") is False, [a0, c0["providers"].get("engine")])
    no = req("/v1/admin/minimax183", {"only": True}, who="someone", method="PUT")
    chk("a customer can't turn it on", no.get("status") in (401, 403), no)
    r = req("/v1/admin/minimax183", {"only": True}, who="boss", method="PUT"); c = req("/v1/config")
    chk("the owner turns it on: the AI engine is off, MiniMax makes videos, pictures, voices and music", r.get("only") is True and r.get("all") is True and c["providers"].get("engine") is False and c["providers"].get("mmOnly240") is True
        and all(c["providers"].get(k) for k in ("video", "image", "tts", "music")), [r, {k: c["providers"].get(k) for k in ("engine", "mmOnly240", "video", "image", "tts", "music")}])
    adm = req("/v1/admin/settings", who="boss"); pe = (adm.get("providers") or {}).get("engine") or {}
    chk("Admin still shows the AI engine's key as saved (paused, not gone)", pe.get("configured") is True and pe.get("paused240") is True, pe)
    made = {}
    for i, (name, b) in enumerate([("a Seedance video", {"kind": "video", "model": "seedance", "prompt": "a cat walks on a beach", "dur": 5}), ("an Auto video", {"kind": "video", "model": "auto", "prompt": "a dog runs", "dur": 5}),
            ("a picture", {"kind": "image", "model": "nano", "prompt": "a red apple"}), ("a voice", {"kind": "voice", "prompt": "hello there"}), ("music", {"kind": "music", "prompt": "calm piano"})]):
        j = req("/v1/jobs", b, who="u%d" % i); made[name] = j.get("id") or j
    time.sleep(3); jobs = {j: x for U in db()["users"].values() for j, x in (U.get("jobs") or {}).items()}
    provs = {n: (jobs.get(i) or {}).get("prov") if isinstance(i, str) else i for n, i in made.items()}
    chk("every video, picture, voice and music job goes to MiniMax, whatever model was picked", provs == {"a Seedance video": "mm183-video", "an Auto video": "mm183-video", "a picture": "mm183-image", "a voice": "mm183-voice", "music": "mm183-music"}, provs)
    chk("…none of them went to the AI engine (not even after MiniMax failed)", not any(str(x.get("prov", "")).startswith("kie@") or str(x.get("own185") or "").startswith("kie@") for x in jobs.values()), [(x.get("prov"), x.get("errors")) for x in jobs.values()])
    before = req("/v1/billing", who="c1").get("credits")
    out = {}
    for name, b in [("a Character Swap", {"kind": "video", "model": "mcswap", "prompt": "x", "dur": 5, "inputs": {"mcMove": "/media/v.webm", "mcChar": "/media/p.png"}, "meta": {"swap93": True}}),
                    ("Motion Control", {"kind": "video", "model": "mc30", "dur": 5, "inputs": {"mcMove": "/media/v.webm", "mcChar": "/media/p.png"}}),
                    ("a picture edit", {"kind": "image", "model": "nano", "prompt": "make it blue", "inputs": {"iRef": "/media/p.png"}}),
                    ("lip-sync", {"kind": "lipsync", "model": "auto", "inputs": {"vIn": "/media/v.webm"}}), ("a sound effect", {"kind": "sfx", "prompt": "a door"})]:
        j = req("/v1/jobs", b, who="c1"); out[name] = [j.get("status"), str(j.get("error") or "")[:160]]
    after = req("/v1/billing", who="c1").get("credits")
    chk("what MiniMax can't make is refused, nothing charged", all(v[0] == 501 and "Nothing was charged" in v[1] for v in out.values()) and before == after, [out, before, after])
    q = req("/v1/replace136/quote", {"src": "/media/v.webm", "changes": [{"id": "x1", "what": "the box", "to": "a ball"}]}, who="c1")
    chk("Replace things says it isn't ready (the button stays off)", q.get("ready") is False, q)
    w = why()
    chk("deploy/why.sh: the AI engine OFF (key saved, not used), Only my MiniMax key: yes — no keys printed", "OFF (key saved" in w and "Only my MiniMax key (the AI engine never used): yes" in w and "kie-test" not in w and "mm-test" not in w, w)

def server_off():
    r = req("/v1/admin/minimax183", {"only": False}, who="boss", method="PUT"); c = req("/v1/config")
    chk("switched off → the AI engine is back", r.get("only") is False and c["providers"].get("engine") is True and c["providers"].get("mmOnly240") is False, [r, c["providers"].get("engine")])

async def site(p, w, lang):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": w, "height": 860})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/?view=home"); await pg.wait_for_function("typeof engOff240==='function'&&API.cfg&&API.cfg.providers&&ME._srv===true", timeout=20000)
    await E("l=>{S.lang=l;S.user=S.user||{name:'T',method:'google'};const c=MC83();c.mode='swap';M.mcMove={type:'video',url:'/media/v.webm',remote:'/media/v.webm',name:'v'};S.view='motion';renderAll()}", lang)
    for _ in range(10):
        await pg.wait_for_timeout(400)
        if await E("()=>!!document.querySelector('.mc83')"): break
        await E("()=>{S.view='motion';renderAll()}")
    r = await E("()=>({off:!!document.querySelector('[data-testid=engine-off]'),dis:(document.querySelector('[data-act=mc-make]')||{}).disabled,cls:document.body.classList.contains('mmonly240'),faces:!!(document.querySelector('[data-testid=fc239-find]')||{}).offsetParent})")
    chk(f"site {w}: Motion Control says the tool isn't available, Make can't be pressed, Replace their faces is hidden", r == {"off": True, "dis": True, "cls": True, "faces": False}, r)
    await E("()=>{const c=MC83();c.mode='moves';renderAll()}"); await pg.wait_for_timeout(200)
    r2 = await E("()=>[!!document.querySelector('[data-testid=engine-off]'),(document.querySelector('[data-act=mc-make]')||{}).disabled]")
    chk(f"site {w}: My character does the moves is off too", r2 == [True, True], r2)
    await E("()=>{document.querySelector('#modalRoot').innerHTML='';rpSheet136({remote:'r1',id:'L1',kind:'video',title:'Clip',dur:4})}"); await pg.wait_for_timeout(400)
    sheet = await E("()=>!!document.querySelector('#rp136')")
    chk(f"site {w}: Replace things doesn't open", sheet is False, sheet)
    adm = await E("()=>{MM183.d={keySet:true,only:true,all:true,voice:true,image:true,music:true,video:true,status:{}};return mmBody183()}")
    stt = await E("()=>{const d=A&&A();if(d){d.providers=d.providers||{};d.providers.engine={configured:true,paused240:true}}else{window.__a=1}return typeof aipState184==='function'&&A()?aipState184('engine'):null}")
    chk(f"site {w}: the AI engine card says the key is saved and paused (not 'Not set')", stt is None or (stt[0] == "warn" and ("paused" in stt[1] or "متوقف" in stt[1])), stt)
    chk(f"site {w}: the Admin MiniMax card has the 'Only my MiniMax key' switch", 'data-k="only"' in adm and ("Only my MiniMax key" in adm or "مفتاح ميني ماكس فقط" in adm), adm[:300])
    chk(f"site {w}: no page errors", not errs, errs); await b.close()

async def studio(p):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="rail-stock"]'); await pg.wait_for_timeout(200)
    seen = {}
    for tab in ("Replace", "Recast", "Restyle"):
        await pg.click(f'.panel .subtabs button:has-text("{tab}")'); await pg.wait_for_timeout(300)
        seen[tab] = await E("()=>!!document.querySelector('[data-testid=engine-off]')")
    await pg.click('.panel .subtabs button:has-text("Make with AI")'); await pg.wait_for_timeout(300)
    seen["Make with AI"] = await E("()=>!!document.querySelector('[data-testid=engine-off]')")
    chk("studio: Replace / Recast / Restyle say the tool isn't available; Make with AI (MiniMax) stays", seen == {"Replace": True, "Recast": True, "Restyle": True, "Make with AI": False}, seen)
    chk("studio: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    try: server_on()
    except Exception as e: chk("server crashed", False, repr(e)[:700])
    async with async_playwright() as p:
        for f, a in ((site, (1280, "en")), (site, (390, "ar")), (studio, ())):
            try: await f(p, *a)
            except Exception as e: chk(f.__name__ + str(a) + " crashed", False, repr(e)[:700])
    try: server_off()
    except Exception as e: chk("server (off) crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
if fails: print("v240 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v240 OK")
