# v275: Admin panels load after sign-in (no stale 401 answers) · robots.txt / sitemap.xml / manifest.json · share tags.
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8475
D = tempfile.mkdtemp(prefix="nooi-v275-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules"); fails = []
def ok(c, m): print(("✓ " if c else "✗ ") + m); (None if c else fails.append(m))

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        for p, ct in (("/robots.txt", "text/plain"), ("/sitemap.xml", "xml"), ("/manifest.json", "json")):
            r = urllib.request.urlopen(f"http://localhost:{PORT}{p}"); ok(r.status == 200 and ct in r.headers.get("content-type", ""), f"{p} is served ({r.headers.get('content-type')})")
        man = json.loads(urllib.request.urlopen(f"http://localhost:{PORT}/manifest.json").read())
        for ic in man["icons"]: ok(urllib.request.urlopen(f"http://localhost:{PORT}{ic['src']}").status == 200, f"manifest icon {ic['src']}")
        async with async_playwright() as pw:
            b = await pw.chromium.launch(); ctx = await b.new_context(); pg = await ctx.new_page()
            errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            st = {"block": True}
            async def gate(route):
                if st["block"] and route.request.method == "GET": await route.fulfill(status=401, content_type="application/json", body='{"error":"Sign in first"}')
                else: await route.continue_()
            await pg.route("**/v1/admin/**", gate); await pg.route("**/v1/me", gate)
            await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
            head = await pg.evaluate("()=>({d:!!document.querySelector('meta[name=description]'),og:(document.querySelector('meta[property=\"og:image\"]')||{}).content,c:(document.querySelector('link[rel=canonical]')||{}).href,m:!!document.querySelector('link[rel=manifest]')})")
            ok(head["d"] and head["og"] and head["c"] == "https://nooi.ai/" and head["m"], f"description, share picture, canonical and manifest in the page {head}")
            await pg.evaluate("()=>{S.user=S.user||{name:'Owner'};ME.role='owner';ME.perms=['providers.manage'];S.view='admin';S.admTab='models';renderAll()}"); await pg.wait_for_timeout(1500); await pg.evaluate("()=>prAdmin()"); await pg.wait_for_timeout(1000)
            a = await pg.evaluate("()=>({pr:PR.rows&&PR.rows.length,a:A272.d&&(A272.d.strongList||[]).length,mm:MM183.d&&MM183.d.err?1:0,set:[...ADM275]})")
            ok("/v1/admin/pricing" in a["set"] and "/v1/admin/auto272" in a["set"] and not a["pr"] and not a["a"] and a["mm"], f"before sign-in the admin calls get 401 and are remembered {a}")
            st["block"] = False
            await pg.evaluate("()=>loadMe()"); await pg.wait_for_timeout(3000)
            c = await pg.evaluate("()=>({pr:PR.rows&&PR.rows.length,a:A272.d&&(A272.d.strongList||[]).length,mm:MM183.d&&MM183.d.err?1:0,set:ADM275.size,role:ME.role})")
            ok(c["pr"] and c["pr"] > 3, f"Pricing loads again after sign-in {c}")
            ok(c["a"] and c["a"] > 0, f"nooi Auto engines load again after sign-in {c}")
            ok(not c["mm"] and c["set"] == 0, f"MiniMax no longer shows the old error; nothing left to retry {c}")
            ok(not errs, f"no page errors {errs[:3]}")
            await b.close()
    finally: srv.kill()
    print(json.dumps({"fails": fails}, ensure_ascii=False))
asyncio.run(main())
