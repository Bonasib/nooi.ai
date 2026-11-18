# v239 — Replace faces: every person's face found in the video, each given another face (a photo or an @character), several in one go.
#  · the server: a face change is priced like the change it is (one pass over the seconds they're seen in); a face needs a photo;
#    up to 6 new faces in a video (a 400 says so)
#  · the site: the Replace things sheet shows a Faces row first; a photo for one face, a character for another → ONE job with both
#    (face only), the price first; Keep takes a face back out; Motion Control → Replace the person has "Several people? Replace
#    their faces", which sends that video to the analysis
#  · the studio: Stock & AI → Replace shows the faces; a photo and a character → one quote with both faces
# Run: python3 tests/v239.py
import asyncio, base64, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8752; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v239-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
SHOTS = os.environ.get("SHOTS239")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
VP9 = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "400k", "-pix_fmt", "yuv420p"]
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", *VP9, D + "/take.webm"); shutil.copy(D + "/take.webm", D + "/media/two.webm")
for n, c in (("fa", "0xd0a080"), ("fb", "0x8a5a3c"), ("fc", "0xf0c8a0"), ("face", "0xc09070")): FF("-f", "lavfi", "-i", f"color=c={c}:s=192x192:d=1", "-frames:v", "1", D + f"/media/{n}.png")
for k in range(1, 8): shutil.copy(D + "/media/fa.png", D + f"/media/p{k}.png")
shutil.copy(D + "/media/face.png", D + "/face.png")
FACE = "data:image/png;base64," + base64.b64encode(open(D + "/face.png", "rb").read()).decode()
CHARS = {"chars": [{"id": "k1", "name": "Layla", "photo": FACE, "look": "long black hair"}]}
ITEMS = [{"id": "i1", "kind": "person", "name": "The man on the left", "en": "a man in a grey shirt", "where": "on the left", "seen": [[0, 4]], "at": 1, "box": [0.05, 0.1, 0.3, 0.85], "thumb": None, "face": "/media/fa.png"},
         {"id": "i2", "kind": "person", "name": "The woman on the right", "en": "a woman in a red coat", "where": "on the right", "seen": [[1, 3]], "at": 2, "box": [0.6, 0.15, 0.3, 0.8], "thumb": None, "face": "/media/fb.png"},
         {"id": "i3", "kind": "object", "name": "A cup", "en": "a white cup", "where": "in the middle", "seen": [[0, 1]], "at": 0.5, "box": [0.45, 0.6, 0.1, 0.1], "thumb": None}]
SCAN = {"kind": "video", "dur": 4, "w": 640, "h": 360, "scene": "Two people at a table.", "items": ITEMS, "sounds": [], "by": "agents", "lang": "en", "frames": []}
json.dump(SCAN, open(D + "/media/two.scan136.en.json", "w"))   # the analysis already made (no vision AI in the test)
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "ADMIN_EMAILS"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1100]))
def post(path, body, who="someone"):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "X-Dev-User": who}, method="POST")
    try: return json.loads(urllib.request.urlopen(r, timeout=30).read())
    except urllib.error.HTTPError as e: return {"status": e.code, **json.loads(e.read() or b"{}")}

def server():
    q1 = post("/v1/replace136/quote", {"src": "/media/two.webm", "lang": "en", "changes": [{"id": "i1", "face": True, "pic": "/media/p1.png"}]})
    q2 = post("/v1/replace136/quote", {"src": "/media/two.webm", "lang": "en", "changes": [{"id": "i1", "face": True, "pic": "/media/p1.png"}, {"id": "i2", "face": True, "pic": "/media/p2.png"}]})
    chk("the server: one new face is priced, two faces are one pass (the same seconds → the same price or a little more)", (q1.get("total") or 0) > 0 and q1.get("things") == 1 and q2.get("things") == 2 and q2.get("total") >= q1.get("total"), [q1, q2])
    q3 = post("/v1/replace136/quote", {"src": "/media/two.webm", "lang": "en", "changes": [{"id": "i1", "face": True}]})
    chk("the server: a new face needs a photo", q3.get("status") == 400 and "photo" in (q3.get("error") or ""), q3)
    q4 = post("/v1/replace136/quote", {"src": "/media/two.webm", "lang": "en", "changes": [{"id": "x%d" % k, "what": "person %d" % k, "pic": "/media/p%d.png" % k} for k in range(1, 8)]})
    chk("the server: up to 6 new faces or pictures at once in a video", q4.get("status") == 400 and "Up to 6" in (q4.get("error") or ""), q4)
    q5 = post("/v1/replace136/quote", {"src": "/media/two.webm", "lang": "en", "changes": [{"id": "i2", "face": True, "char": {"name": "Sara", "look": "", "face": "/media/fc.png"}}]})
    chk("the server: a character's face picture is the new face", (q5.get("total") or 0) > 0, q5)

SEEN = {"scan": [], "rq": []}
async def mock(route):
    req = route.request; u = req.url
    if u.endswith("/v1/scan136"): SEEN["scan"].append(json.loads(req.post_data)); return await route.fulfill(json={**SCAN, "image": False, "src": "/media/two.webm", "job": None, "hearPrice": 0, "canHear": False})
    if u.endswith("/v1/replace136/quote"): SEEN["rq"].append(json.loads(req.post_data)); return await route.fulfill(json={"total": 42, "visual": 42, "sound": 0, "ready": True, "things": 2, "from": 0, "to": 4, "secs": 4})
    return await route.continue_()

async def site(p, w, lang):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": w, "height": 860})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/(scan136|replace136/quote)$"), mock); SEEN["scan"].clear(); SEEN["rq"].clear()
    await pg.goto(B + "/?view=home"); await pg.wait_for_function("typeof rpSheet136==='function'&&typeof ME!=='undefined'&&ME._srv===true&&API.mode==='server'", timeout=20000)
    await E("l=>{S.lang=l;S.chars=[{id:'c1',name:'Sara',face:'/media/fc.png'}];window.__made=[];addJob=function(o){window.__made.push(o);return{id:'n1'}};renderAll()}", lang)
    await E("()=>rpSheet136({remote:'r1',id:'L1',kind:'video',title:'Clip',dur:4})")
    await pg.wait_for_selector('[data-testid="fc239-grid"] .fc239', timeout=15000)
    n = await E("()=>document.querySelectorAll('[data-testid=fc239-grid] .fc239').length")
    first = await E("()=>{const h=[...document.querySelectorAll('#rp136 .rp136h')].map(x=>x.textContent);return h[0]||''}")
    chk(f"site {w}: the Faces row comes first, one card per person (not the cup)", n == 2 and ("Faces" in first or "الوجوه" in first) and SEEN["scan"] and SEEN["scan"][0].get("job") == "r1", [n, first, SEEN["scan"][:1]])
    await pg.set_input_files('#rp136 input[data-rp136pic="i1"][data-face239]', D + "/face.png")
    await pg.wait_for_function("document.querySelectorAll('[data-fc239=i1].on .fc239p img').length===2", timeout=15000)
    await pg.select_option('#rp136 select[data-rp239char="i2"]', "c1")
    await pg.wait_for_function("document.querySelectorAll('[data-fc239=i2].on .fc239p img').length===2", timeout=5000)
    for _ in range(40):
        if SEEN["rq"] and len(SEEN["rq"][-1].get("changes", [])) == 2: break
        await pg.wait_for_timeout(250)
    await pg.wait_for_function("document.querySelector('#modalRoot [data-act=rp136-go]')&&!document.querySelector('#modalRoot [data-act=rp136-go]').disabled", timeout=10000)
    last = SEEN["rq"][-1] if SEEN["rq"] else {}; ch = {c["id"]: c for c in last.get("changes", [])}
    chk(f"site {w}: a photo for one face and a character for the other → one quote, both face only", last.get("job") == "r1" and len(ch) == 2 and ch.get("i1", {}).get("face") and str(ch.get("i1", {}).get("pic", "")).startswith("/media/")
        and ch.get("i2", {}).get("pic") == "/media/fc.png" and (ch.get("i2", {}).get("char") or {}).get("name") == "Sara", last)
    summ = await E("()=>document.querySelector('#rp136s').textContent")
    chk(f"site {w}: 'What changes' names the new faces", ("a new face" in summ or "وجه جديد" in summ) and "Sara" in summ, summ[:300])
    if SHOTS: await pg.screenshot(path=f"{SHOTS}/site-faces-{w}-{lang}.png")
    sw = await E("()=>document.querySelector('#rp136').scrollWidth<=document.querySelector('#rp136').clientWidth+1")
    chk(f"site {w}: the faces row fits (no sideways scroll)", sw)
    await pg.click('#modalRoot [data-act="rp136-go"]'); await pg.wait_for_timeout(300)
    made = await E("()=>window.__made")
    r = ((made[0] if made else {}).get("meta") or {}).get("replace136") or {}
    chk(f"site {w}: Make → one Replace-things job with both faces, the price shown", len(made) == 1 and r.get("job") == "r1" and len(r.get("changes", [])) == 2 and made[0].get("cost") == 42, made)
    # Keep takes a face back out
    await E("()=>rpSheet136({remote:'r1',id:'L1',kind:'video',title:'Clip',dur:4})"); await pg.wait_for_selector('[data-testid="fc239-grid"] .fc239', timeout=15000)
    await pg.select_option('#rp136 select[data-rp239char="i2"]', "c1"); await pg.wait_for_selector('[data-act="rp239-keep"][data-id="i2"]', timeout=5000); await pg.click('[data-act="rp239-keep"][data-id="i2"]')
    k = await E("()=>[document.querySelectorAll('.fc239.on').length,rpChanges136().length]")
    chk(f"site {w}: Keep puts the face back as it was", k == [0, 0], k)
    await E("()=>{document.querySelector('#modalRoot').innerHTML=''}")
    # Motion Control → Replace the person → "Several people? Replace their faces"
    SEEN["scan"].clear()
    await E("()=>{S.user=S.user||{name:'T',method:'google'};const c=MC83();c.mode='swap';M.mcMove={type:'video',url:'/media/two.webm',remote:'/media/two.webm',name:'two'};S.view='motion';renderAll()}")
    for _ in range(10):   # (the page may still be settling on the view it was opened with)
        await pg.wait_for_timeout(400)
        if await E("()=>!!document.querySelector('[data-testid=fc239-find]')"): break
        await E("()=>{S.view='motion';renderAll()}")
    await pg.wait_for_selector('[data-testid="fc239-find"]', timeout=10000); await pg.click('[data-testid="fc239-find"]')
    await pg.wait_for_selector('[data-testid="fc239-grid"] .fc239', timeout=15000)
    t = await E("()=>document.querySelector('#modalRoot').textContent")
    chk(f"site {w}: Replace the person → 'Replace their faces' sends that video to the analysis and shows its faces", SEEN["scan"] and SEEN["scan"][0].get("src") == "/media/two.webm" and ("Replace faces" in t or "استبدال الوجوه" in t), [SEEN["scan"][:1], t[:120]])
    if SHOTS: await pg.screenshot(path=f"{SHOTS}/site-swap-{w}-{lang}.png")
    chk(f"site {w}: no page errors", not errs, errs); await b.close()

async def studio(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); await ctx.add_init_script("try{if(!localStorage.getItem('dotai-studio-v2'))localStorage.setItem('dotai-studio-v2'," + json.dumps(json.dumps(CHARS)) + ")}catch(e){}")
    pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/(scan136|replace136/quote)$"), mock); SEEN["rq"].clear()
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(500)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/take.webm")
    await pg.wait_for_function("Object.values(window.__studio.editor.project.assets).some(a=>a.w&&a.duration)", timeout=30000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a);s.editor.select([s.editor.project.tracks.flatMap(t=>t.clips)[0].id])}"); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="rail-stock"]'); await pg.wait_for_timeout(200); await pg.click('.panel .subtabs button:has-text("Replace")'); await pg.wait_for_selector('[data-testid="rp-look"]', timeout=15000)
    await pg.click('[data-testid="rp-look"]'); await pg.wait_for_selector('[data-testid="rp-faces"] [data-testid="rpf-i1"]', timeout=20000)
    n = await E("()=>document.querySelectorAll('[data-testid=rp-faces] .rpface').length")
    chk("studio: the faces of both people are shown", n == 2, n)
    await pg.set_input_files('[data-testid="rpf-up-i1"]', D + "/face.png")
    await pg.wait_for_function("document.querySelectorAll('[data-testid=rpf-i1] .rpfp img').length===2", timeout=15000)
    await pg.select_option('[data-testid="rpf-ch-i2"]', "site:k1")
    await pg.wait_for_function("document.querySelectorAll('[data-testid=rpf-i2] .rpfp img').length===2", timeout=15000)
    await pg.wait_for_function("/42/.test((document.querySelector('[data-testid=rp-faces-price]')||{}).textContent||'')", timeout=15000); await pg.wait_for_timeout(500)
    last = SEEN["rq"][-1] if SEEN["rq"] else {}; ch = {c["id"]: c for c in last.get("changes", [])}
    dis = await E("()=>document.querySelector('[data-testid=rp-faces-go]').disabled")
    chk("studio: a photo and a character → one quote with both faces (face only), the button on", len(ch) == 2 and all(c.get("face") and str(c.get("pic", "")).startswith("/media/") for c in ch.values()) and (ch.get("i2", {}).get("char") or {}).get("name") == "Layla" and dis is False, [last, dis])
    if SHOTS: await pg.screenshot(path=f"{SHOTS}/studio-faces.png")
    chk("studio: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    try: server()
    except Exception as e: chk("server crashed", False, repr(e)[:700])
    async with async_playwright() as p:
        for f, a in ((site, (1280, "en")), (site, (390, "ar")), (studio, ())):
            try: await f(p, *a)
            except Exception as e: chk(f.__name__ + str(a) + " crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
if fails: print("v239 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v239 OK")
