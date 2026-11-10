# v267 — found by running the site as a customer: (1) the side menu was rebuilt between press and release when the page redrew
# (leaving a field you had just edited), so the first click on it did nothing; (2) a customer's browser tried to save staff-only
# data and showed them "Not allowed". Run: python3 tests/v267.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8795; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v267-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D); json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", ADMIN_EMAILS="boss@dev.local"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1400]))
SETUP = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()}"
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []; bad = []; toasts = []
        pg = await (await b.new_context(viewport={"width": 1440, "height": 900}, extra_http_headers={"X-Dev-User": "someone"})).new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        pg.on("response", lambda r: "/v1/admin/" in r.url and bad.append([r.status, r.request.method, r.url.replace(B, "")]))
        await pg.goto(B + "/"); await pg.wait_for_timeout(1500); await pg.evaluate(SETUP); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{const o=toast;toast=function(m){(window.__t=window.__t||[]).push(String(m));return o.apply(this,arguments)}}")
        for v in ("chars", "explore", "video", "home", "more", "settings"):
            await pg.evaluate("v=>go(v)", v); await pg.wait_for_timeout(500)
        # one click on the side menu right after editing a field
        await pg.evaluate("()=>go('chars')"); await pg.wait_for_timeout(500)
        await pg.fill('#main [data-bind="char.name"]', "Zed"); await pg.wait_for_timeout(300)
        await pg.click('#sb253 [data-go="explore"]'); await pg.wait_for_timeout(700)
        chk("one click on the side menu right after typing in a field opens the page", await pg.evaluate("()=>S.view") == "explore", await pg.evaluate("()=>S.view"))
        # the menu still follows the page: the current item, and a group opened by hand
        cur = await pg.evaluate("()=>[...document.querySelectorAll('#sb253 [aria-current=page],#sb253 .on')].map(e=>e.textContent.trim()).join('|')")
        chk("the menu marks the page you are on", "Templates" in cur, cur)
        n0 = await pg.evaluate("()=>[...document.querySelectorAll('#sb253 [data-sb253]')].map(e=>e.getAttribute('aria-expanded')).join(',')")
        await pg.locator('#sb253 [data-sb253][aria-expanded="false"]').first.click(); await pg.wait_for_timeout(300)
        n1 = await pg.evaluate("()=>[...document.querySelectorAll('#sb253 [data-sb253]')].map(e=>e.getAttribute('aria-expanded')).join(',')")
        await pg.evaluate("()=>renderView()"); await pg.wait_for_timeout(200)
        n2 = await pg.evaluate("()=>[...document.querySelectorAll('#sb253 [data-sb253]')].map(e=>e.getAttribute('aria-expanded')).join(',')")
        chk("opening a group by hand shows its tools, and a redraw keeps it", n1 != n0 and n2 == n1, [n0, n1, n2])
        await pg.evaluate("()=>go('video')"); await pg.wait_for_timeout(400)
        chk("going to another page updates the menu", "nooi Studio" in await pg.evaluate("()=>[...document.querySelectorAll('#sb253 [aria-current=page],#sb253 .on')].map(e=>e.textContent.trim()).join('|')"))
        # any edited field or pressed button used to try a staff-only save
        chk("a customer's browser never calls a staff-only address", not bad, bad)
        chk("…and is never shown “Not allowed”", not any("Not allowed" in t for t in (await pg.evaluate("()=>window.__t||[]"))), await pg.evaluate("()=>window.__t||[]"))
        chk("no page errors", not errs, errs)
        await b.close()
try: asyncio.run(main())
finally:
    srv.terminate(); shutil.rmtree(D, ignore_errors=True)
print("FAIL\n- " + "\n- ".join(fails) if fails else "v267: one click on the side menu after editing a field; no staff-only saves from a customer's browser — all checks passed")
sys.exit(1 if fails else 0)
