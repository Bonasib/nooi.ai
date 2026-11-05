# v236 — the owner and admins aren't stopped for credits: the server already charges the team nothing; now the site's page and the
# studio don't block them either (a customer with no credits is still told and stopped).
#  · site: crFree() is true for role owner / admin once the server said so (/v1/me), false for a customer
#  · studio: an admin with 0 credits sees "Team · free" and the AI buttons stay on; a customer with 0 credits can't press them
#  · the server: a job quote for the team is 0
# Run: python3 tests/v236.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8750; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v236-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k", D + "/a.webm"], check=True, timeout=60)
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "ADMIN_EMAILS"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", ADMIN_EMAILS="boss@dev.local"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
def post(path, body, who):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "X-Dev-User": who}, method="POST")
    try: return json.loads(urllib.request.urlopen(r, timeout=10).read())
    except urllib.error.HTTPError as e: return {"status": e.code}

def mocker(role, credits):
    async def mock(route):
        u = route.request.url
        if re.search(r"/v1/me$", u): return await route.fulfill(json={"uid": "u1", "role": role, "perms": ["admins.manage"] if role else [], "email": "x@y.z"})
        if re.search(r"/v1/billing$", u): return await route.fulfill(json={"credits": credits, "plan": "free"})
        if u.endswith("/v1/replace136/quote"): return await route.fulfill(json={"total": 42, "visual": 42, "sound": 0, "ready": True})
        if u.endswith("/v1/scan136"): return await route.fulfill(json={"items": [{"id": "p1", "kind": "person", "name": "A man", "thumb": None}], "sounds": [], "dur": 3, "src": "/media/x.webm", "job": None})
        return await route.continue_()
    return mock

async def site(p, role):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1280, "height": 800})).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/(me|billing)$"), mocker(role, 0))
    await pg.goto(B + "/?view=home"); await pg.wait_for_function("typeof crFree==='function'&&typeof ME!=='undefined'&&ME._srv===true", timeout=20000)
    r = await pg.evaluate("()=>({free:crFree(),role:ME.role})"); await b.close(); return r, errs

async def studio(p, role):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/(me|billing|scan136|replace136/quote)$"), mocker(role, 0))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(1500)
    top = await E("()=>(document.querySelector('[data-testid=top-free]')||{}).textContent||(document.querySelector('.topbar .credits')||{}).textContent||''")
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/a.webm")
    await pg.wait_for_function("Object.values(window.__studio.editor.project.assets).some(a=>a.w&&a.duration)", timeout=30000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a);s.editor.select([s.editor.project.tracks.flatMap(t=>t.clips)[0].id])}"); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="rail-stock"]'); await pg.wait_for_timeout(200); await pg.click('.panel .subtabs button:has-text("Replace")'); await pg.wait_for_selector('[data-testid="rp-look"]', timeout=15000)
    await pg.click('[data-testid="rp-look"]'); await pg.wait_for_selector('[data-testid="rp-p1"]', timeout=15000); await pg.click('[data-testid="rp-p1"]')
    await pg.click('[data-testid="rp-form"] .ns-seg button:has-text("Words")'); await pg.fill('[data-testid="rp-to"]', "a robot")
    await pg.wait_for_function("/42/.test(document.querySelector('[data-testid=rp-price]').textContent)", timeout=15000); await pg.wait_for_timeout(300)
    dis = await E("()=>document.querySelector('[data-testid=rp-go]').disabled"); await b.close(); return top, dis, errs

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    q1 = post("/v1/jobs/quote", {"kind": "video", "model": "seedance", "dur": 5}, "boss"); q2 = post("/v1/jobs/quote", {"kind": "video", "model": "seedance", "dur": 5}, "someone")
    chk("the server: a quote for the owner is 0 (the price is kept for information), a customer pays", q1.get("cost") == 0 and (q1.get("price") or 0) > 0 and (q2.get("cost") or 0) > 0, [q1, q2])
    async with async_playwright() as p:
        try:
            (a, e1), (n, e2) = await site(p, "admin"), await site(p, None)
            chk("site: the owner / admins aren't stopped for credits (crFree) — a customer still is", a == {"free": True, "role": "admin"} and n == {"free": False, "role": None} and not e1 and not e2, [a, n, e1, e2])
            ta, da, e3 = await studio(p, "admin"); tc, dc, e4 = await studio(p, None)
            chk("studio: an admin with 0 credits sees 'Team · free' and can press the AI button; a customer with 0 credits can't", ta == "Team · free" and da is False and tc == "0" and dc is True and not e3 and not e4, [ta, da, tc, dc, e3, e4])
        except Exception as e: chk("crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
if fails: print("v236 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v236 OK")
