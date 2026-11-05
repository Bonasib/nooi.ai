# v238 — Recast (keep the motion / swap elements), and deploy/why.sh.
#  · Keep the motion: references (an @character, an outfit, a place) + words → per version a new first frame made from the original
#    frame and the references (picture 1 = the frame, the references as pictures 2–4), then Motion Control with the whole take's
#    motion (the place rebuilt: one engine; "keep the original place": the other); 3 versions = 3 runs, each its own job
#  · More like this: 2 more versions from the same setup; Compare: the original and the new version, played in sync, a handle
#  · Use it: the clip plays the new version
#  · Swap elements: several changes in one job (what → what it becomes, a reference picture), the price first, N versions
#  · a phone in Arabic; deploy/why.sh reads the failed jobs and says what MiniMax could have made
# Run: python3 tests/v238.py
import asyncio, base64, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8751; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v238-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
VP9 = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "400k", "-pix_fmt", "yuv420p"]
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", *VP9, D + "/take.webm")
FF("-f", "lavfi", "-i", "color=c=0x2050d0:s=640x360:d=4:r=30,drawbox=x='100+80*t':y=100:w=120:h=160:c=white:t=fill", *VP9, D + "/media/new.webm")
shutil.copy(ROOT + "/public/studio/backdrops/library.webp", D + "/media/frame.webp")
for n, c in (("outfit", "0xc02040"), ("place", "0x20a060"), ("product", "0xe0c020"), ("face", "0xd0a080")): FF("-f", "lavfi", "-i", f"color=c={c}:s=256x256:d=1", "-frames:v", "1", D + f"/{n}.png")
FACE = "data:image/png;base64," + base64.b64encode(open(D + "/face.png", "rb").read()).decode()
CHARS = {"chars": [{"id": "k1", "name": "Layla", "photo": FACE, "look": "long black hair"}]}
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1100]))
P = "window.__studio.editor.project"
SENT, JOBS = {"jobs": [], "quotes": [], "rq": []}, {}
async def mock(route):
    req = route.request; u = req.url
    if u.endswith("/v1/jobs/quote"): b = json.loads(req.post_data); SENT["quotes"].append(b); return await route.fulfill(json={"cost": 6 if b.get("kind") == "image" else 30})
    if u.endswith("/v1/replace136/quote"): SENT["rq"].append(json.loads(req.post_data)); return await route.fulfill(json={"total": 42, "visual": 42, "sound": 0, "ready": True})
    if re.search(r"/v1/jobs$", u) and req.method == "POST":
        b = json.loads(req.post_data); jid = "j" + str(len(JOBS) + 1); SENT["jobs"].append(b); img = b.get("kind") == "image"
        JOBS[jid] = {"id": jid, "kind": b.get("kind"), "status": "done", "progress": 1, "resultUrl": "/media/frame.webp" if img else "/media/new.webm", "dur": None if img else 4, "title": b.get("title")}
        return await route.fulfill(json={"id": jid, "kind": b.get("kind"), "status": "rendering", "progress": 0.1})
    m = re.search(r"/v1/jobs/(j\d+)$", u)
    if m and m.group(1) in JOBS: return await route.fulfill(json=JOBS[m.group(1)])
    return await route.continue_()

async def fresh(pg):
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(500)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/take.webm")
    await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.w&&a.duration)", timeout=30000)
    await pg.evaluate("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a);s.editor.select([s.editor.project.tracks.flatMap(t=>t.clips)[0].id])}"); await pg.wait_for_timeout(400)

async def desktop(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); await ctx.add_init_script("try{if(!localStorage.getItem('dotai-studio-v2'))localStorage.setItem('dotai-studio-v2'," + json.dumps(json.dumps(CHARS)) + ")}catch(e){}")
    pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/(jobs.*|replace136/quote)$"), mock)
    await fresh(pg)
    await pg.click('[data-testid="rail-stock"]'); await pg.wait_for_timeout(200)
    tabs = await E("()=>[...document.querySelectorAll('.panel .subtabs button')].map(b=>b.textContent)")
    await pg.click('.panel .subtabs button:has-text("Recast")'); await pg.wait_for_selector('[data-testid="recast-panel"]')
    chk("Stock & AI has Recast, second (after Make with AI)", tabs[1] == "Recast", tabs)
    # ---- keep the motion
    await pg.click('[data-testid="rc-char-Layla"]')
    for kind, f in (("outfit", "outfit.png"), ("place", "place.png")):
        await pg.select_option('[data-testid="rc-kind"]', kind); await pg.set_input_files('[data-testid="rc-file"]', D + "/" + f); await pg.wait_for_selector(f'[data-testid="rc-ref-{kind}"]', timeout=15000)
    await pg.fill('[data-testid="rc-words"]', "night time, neon signs")
    await pg.click('.rc .ns-seg button:has-text("3")'); await pg.wait_for_function("/108 credits/.test(document.querySelector('[data-testid=rc-price]').textContent)", timeout=15000)
    price = await E("()=>document.querySelector('[data-testid=rc-price]').textContent")
    await pg.click('[data-testid="rc-go"]'); await pg.wait_for_function("document.querySelectorAll('[data-testid=rc-run-done]').length===3", timeout=60000)
    jobs = SENT["jobs"]; imgs = [j for j in jobs if j["kind"] == "image"]; vids = [j for j in jobs if j["kind"] == "video"]
    w = imgs[0].get("prompt", "") if imgs else ""
    chk("Keep the motion, 3 versions: the price first (3 × (6 + 30) = 108), each a new first frame from the frame + 3 references (pictures 1–4), then Motion Control with the take's motion",
        "108" in price and len(imgs) == 3 and len(vids) == 3 and sorted(j["meta"]["v238"]["i"] for j in vids) == [0, 1, 2]
        and set(imgs[0]["inputs"]) == {"iRef", "iRef2", "iRef3", "iRef4"} and "Picture 1 is a frame" in w and "(picture 2)" in w and "outfit" in w and "place becomes" in w and "night time" in w and "No text" in w
        and all(v["model"] == "mc26" and v["inputs"]["mcChar"] == "/media/frame.webp" and v["inputs"]["mcMove"].startswith("/media/") and v["meta"]["orient"] == "video" for v in vids), [price, imgs[:1], vids[:1]])
    await pg.locator('[data-testid="rc-more"]').first.click(); await pg.wait_for_function("document.querySelectorAll('[data-testid=rc-run-done]').length===5", timeout=60000)
    more = [j["meta"]["v238"]["i"] for j in SENT["jobs"] if j["kind"] == "video"][3:]
    chk("More like this: two more versions from the same setup (versions 4 and 5)", sorted(more) == [3, 4], more)
    # ---- compare, in sync, with a handle
    await pg.locator('[data-testid="rc-cmp"]').first.click(); await pg.wait_for_selector('[data-testid="rc-compare"]')
    await pg.wait_for_function("document.querySelector('[data-testid=rc-new]').readyState>=2&&document.querySelector('[data-testid=rc-old]').readyState>=2", timeout=15000)
    await pg.click('[data-testid="rc-play"]'); await pg.wait_for_timeout(1500)
    sync = await E("()=>{const a=document.querySelector('[data-testid=rc-old]'),b=document.querySelector('[data-testid=rc-new]');return {a:a.currentTime,b:b.currentTime,playing:!b.paused}}")
    await pg.fill('[data-testid="rc-handle"]', "30"); clip = await E("()=>document.querySelector('[data-testid=rc-old]').style.clipPath")
    chk("Compare: the original and the new version play in sync; the handle shows the original up to it", sync["playing"] and sync["b"] > 0.5 and abs(sync["a"] - sync["b"]) < 0.2 and clip == "inset(0px 70% 0px 0px)", [sync, clip])
    await pg.click('[data-testid="rc-close"]')
    await pg.locator('[data-testid="rc-use"]').first.click(); await pg.wait_for_timeout(500)
    used = await E("()=>{const p=" + P + ",c=p.tracks.flatMap(t=>t.clips).find(c=>c.type==='media');return p.assets[c.asset].name}")
    chk("Use it: the clip now plays the new version", "Version" in used, used)
    # ---- keep the original place → the other Motion Control engine
    await E("()=>{const s=window.__studio;s.editor.select([s.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.type==='media').id])}"); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="rc-keep"]'); await pg.click('.rc .ns-seg button:has-text("1")'); n0 = len(SENT["jobs"])
    await pg.wait_for_function("/36 credits/.test(document.querySelector('[data-testid=rc-price]').textContent)", timeout=15000); await pg.click('[data-testid="rc-go"]')
    await pg.wait_for_function(f"window.__n=(window.__n||0)+1,true", timeout=1000); await pg.wait_for_timeout(9000)
    kp = [j["model"] for j in SENT["jobs"][n0:] if j["kind"] == "video"]
    chk("Keep the original place: Motion Control that keeps the video's background", kp == ["mc30"], kp)
    # ---- swap elements
    await pg.click('.rc .ns-seg button:has-text("Swap elements")')
    await pg.select_option('[data-testid="rc-kind"]', "product"); await pg.set_input_files('[data-testid="rc-file"]', D + "/product.png"); await pg.wait_for_selector('[data-testid="rc-ref-product"]', timeout=15000)
    await pg.fill('[data-testid="rc-what-0"]', "the red bottle"); await pg.fill('[data-testid="rc-to-0"]', "a blue can")
    rid = await E("()=>[...document.querySelector('[data-testid=rc-useref-0]').options].find(o=>o.textContent.startsWith('Product')).value"); await pg.select_option('[data-testid="rc-useref-0"]', rid)
    await pg.click('[data-testid="rc-addrow"]'); await pg.fill('[data-testid="rc-what-1"]', "the text on the sign"); await pg.fill('[data-testid="rc-to-1"]', "SALE 50%")
    await pg.click('.rc .ns-seg button:has-text("2")'); await pg.wait_for_function("/84 credits/.test(document.querySelector('[data-testid=rc-price]').textContent)", timeout=20000)
    q = SENT["rq"][-1]; n1 = len(SENT["jobs"])
    await pg.click('[data-testid="rc-go"]'); await pg.wait_for_function(f"document.querySelectorAll('[data-testid=rc-run-done]').length>=8", timeout=60000)
    sw = [j for j in SENT["jobs"][n1:]]; ch = (sw[0].get("meta", {}).get("replace136", {}) if sw else {}).get("changes", [])
    chk("Swap elements, 2 versions: the price first (2 × 42), several changes in one job — the product from its picture, the text — the rest kept",
        len(q["changes"]) == 2 and len(sw) == 2 and sorted(j["meta"]["v238"]["i"] for j in sw) == [0, 1] and ch[0]["id"] == "x1" and ch[0]["what"] == "the red bottle" and ch[0]["to"] == "a blue can" and re.match(r"^/media/\w+\.png$", ch[0].get("pic", ""))
        and ch[1] == {"id": "x2", "what": "the text on the sign", "to": "SALE 50%"}, [q, ch])
    chk("desktop: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await fresh(pg)
    if await E("()=>!!document.querySelector('[data-testid=sheet-close]')"): await pg.click('[data-testid="sheet-close"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300); await E("()=>window.__studio.editor.select([])"); await pg.wait_for_timeout(300)
    await pg.locator('[data-testid="rail-stock"]').scroll_into_view_if_needed(); await pg.click('[data-testid="rail-stock"]'); await pg.wait_for_timeout(300)
    await pg.click('.panel .subtabs button:has-text("إعادة التمثيل")'); await pg.wait_for_selector('[data-testid="recast-panel"]')
    await E("()=>{const s=window.__studio;s.editor.select([s.editor.project.tracks.flatMap(t=>t.clips)[0].id])}"); await pg.wait_for_timeout(500)
    v = await E("()=>({modes:[...document.querySelectorAll('.rc .ns-seg button')].slice(0,2).map(b=>b.textContent),over:document.documentElement.scrollWidth-innerWidth})")
    chk("phone (Arabic): Recast in Arabic (keep the motion / swap the elements), nothing wider than the screen", v["modes"] == ["احتفظ بالحركة", "بدّل العناصر"] and v["over"] <= 0, v)
    chk("phone: no page errors", not errs, errs); await b.close()

def why():
    T = tempfile.mkdtemp(prefix="nooi-v238w-"); os.makedirs(T + "/data")
    for n in ("lib", "providers", "node_modules"): os.symlink(ROOT + "/" + n, T + "/" + n)
    shutil.copy(ROOT + "/package.json", T); open(T + "/.env", "w").write("SECRET_KEY=" + "f" * 40 + "\nMINIMAX_API_KEY=x\n")
    json.dump({"users": {"u": {"jobs": {"a": {"status": "failed", "created": 2, "kind": "video", "prov": "kie@bytedance/seedance-2-fast", "error": "Kie AI 402: Credits insufficient", "payload": {"kind": "video", "model": "mcswap", "inputs": {"mcMove": "/media/x.mp4"}}},
        "b": {"status": "failed", "created": 1, "kind": "video", "prov": "kie@kling", "error": "AI engine 402", "payload": {"kind": "video", "model": "seedance"}}}}}, "settings": {"providers": {}, "payments": {}}}, open(T + "/data/db.json", "w"))
    r = subprocess.run(["bash", ROOT + "/deploy/why.sh"], env=dict(os.environ, APP=T), capture_output=True, text=True, timeout=60).stdout
    chk("deploy/why.sh: engines (yes/no, no keys), the failed jobs and whether MiniMax could have made them", "MiniMax key: yes" in r and "AI engine (videos, swaps, motion): NO" in r and "NO — Motion Control / Character Swap" in r and "MiniMax could make it: yes" in r and "engine@" in r and "Kie" not in r and "x\n" not in r, r)

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    why()
    async with async_playwright() as p:
        for f in (desktop, phone):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
if fails: print("v238 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v238 OK")
