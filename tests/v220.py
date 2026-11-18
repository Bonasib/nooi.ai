# v220 — nooi Studio render service (Phase 1, S4) through the site: /render-api/* on the nooi.ai server is passed to the render
# service (studio/services/render-api), and the studio's Export can make the video on the server.
#  · /render-api/health answers through the site; the service knows the signed-in user from the site itself
#  · Export → "nooi server": a file only on this device goes up by resumable upload (tus) through the site, a nooi result already on
#    the server is used where it is, the title is sent as a picture, FFmpeg renders, the status comes back live, Download gives the
#    real MP4 (H.264 + sound, 1280×720, both clips' length) — checked with ffprobe
#  · the render's live status also comes over a WebSocket through the site; another person can't see it
#  · the desktop/phone build (relative paths, VITE_SITE = the site) runs from another origin: it boots, reaches the site through CORS
#    (allowed app origins only), exports on the server across origins (resumable upload, live status), and inside the desktop app
#    offers "This computer (FFmpeg)"
# Run: python3 tests/v220.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8699; RPORT = 8798; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v220-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=3", "-f", "lavfi", "-i", "sine=frequency=330:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-c:a", "libopus", "-shortest", D + "/media/c.webm")
FF("-f", "lavfi", "-i", "color=c=0xdd3322:s=640x360:d=2:r=30", "-f", "lavfi", "-i", "sine=frequency=520:duration=2", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "200k", "-c:a", "libopus", "-shortest", D + "/b.webm")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "jobs": {"jb220": {"id": "jb220", "owner": "local", "kind": "video", "status": "done", "url": "/media/c.webm", "title": "Beach", "created": 1, "cost": 0, "payload": {"prompt": "Beach", "model": "seedance", "dur": 3}}}}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN", "RENDER_", "DATABASE_URL", "REDIS_URL"))}
APORT = 8700; AO = f"http://localhost:{APORT}"
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, APP_ORIGINS=AO, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", RENDER_API_URL=f"http://127.0.0.1:{RPORT}"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
RA = ROOT + "/studio/services/render-api"
rsrv = subprocess.Popen([RA + "/node_modules/.bin/tsx", "src/index.ts"], cwd=RA, env=dict(env, RENDER_PORT=str(RPORT), NOOI_APP_URL=B, MEDIA_DIR=D + "/media", UPLOAD_DIR=D + "/up", RENDER_DIR=D + "/out", RENDER_CONCURRENCY="1"), stdout=open(D + "/render.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)   # (its own group: tsx starts a child node)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
P = "window.__studio.editor.project"
def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", path], capture_output=True, text=True, timeout=60)
    try: return json.loads(r.stdout)
    except Exception: return {}
def http(path, headers=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request(B + path, headers=headers or {}), timeout=10); return r.status, r.read().decode("utf8", "replace")
    except urllib.error.HTTPError as e: return e.code, e.read().decode("utf8", "replace")

async def run(p):
    st, body = http("/render-api/health"); chk("the render service answers through the site", st == 200 and json.loads(body or "{}").get("ok") is True, [st, body[:200]])
    st, body = http("/render-api/limits"); lim = json.loads(body or "{}")
    chk("it knows the signed-in user and the plan from the site", st == 200 and lim.get("plan") == "studio" and lim.get("keepDays") == 7, [st, body[:200]])
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?job=jb220"); await pg.wait_for_function(P + "&&" + P + ".tracks.some(t=>t.clips.length)", timeout=30000); await pg.wait_for_timeout(800)
    await pg.route("**/v1/uploads", lambda r: r.abort())   # the background copy to the account fails (offline then) → the file stays only on this device
    await pg.set_input_files('[data-testid="file-input"]', [D + "/b.webm"]); await pg.wait_for_function("Object.keys(" + P + ".assets).length===2", timeout=30000); await pg.wait_for_timeout(400)
    names = await E("()=>[...document.querySelectorAll('[data-testid=asset] .libn')].map(x=>x.textContent)")
    await pg.click('[data-testid="asset"] >> nth=%d' % names.index("b"), position={"x": 30, "y": 25}); await pg.wait_for_timeout(300)
    await pg.keyboard.press("t"); await pg.wait_for_timeout(300)
    await E("()=>window.__studio.editor.run('t',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.type==='text'){c.text='مرحبا Hello';c.start=0.5;c.dur=2}})")
    srcs = await E("()=>Object.values(" + P + ".assets).map(a=>a.src.split(':')[0].slice(0,7))")
    chk("the project has a nooi result (on the server) and a file only on this device", sorted(srcs) == ["/media/", "local"], srcs)
    await pg.click('[data-testid="export"]'); await pg.wait_for_timeout(1500)
    has = await E("()=>[...document.querySelectorAll('.sheet .ns-seg button')].some(b=>b.textContent==='nooi server')")
    chk("Export offers the nooi server", has)
    await pg.click('.sheet .ns-seg button:has-text("nooi server")'); await pg.click('.sheet .ns-seg button:has-text("MP4")'); await pg.click('.sheet .ns-seg button:has-text("720p")')
    hint = await E("()=>[...document.querySelectorAll('.sheet .hint')].map(x=>x.textContent).join(' ')"); chk("it says what happens (uploaded first, no credits)", "uploaded first" in hint and "No credits" in hint, hint)
    await pg.click('[data-testid="export-go"]')
    try:
        await pg.wait_for_selector('[data-testid="download"], .sheet .err', timeout=180000)
        href = await E("()=>document.querySelector('[data-testid=download]').getAttribute('href')")
        async with pg.expect_download() as dl: await pg.click('[data-testid="download"]')
        d = await dl.value; path = D + "/srv.mp4"; await d.save_as(path); pr = probe(path)
        v = [s for s in pr.get("streams", []) if s.get("codec_type") == "video"]; a = [s for s in pr.get("streams", []) if s.get("codec_type") == "audio"]
        out["server_mp4"] = {"href": href, "v": v, "a": [x.get("codec_name") for x in a], "dur": pr.get("format", {}).get("duration")}
        chk("the server's MP4 is real: H.264 1280×720 with sound, both clips' length", v and v[0].get("codec_name") == "h264" and v[0].get("width") == 1280 and v[0].get("height") == 720 and a and abs(float(pr["format"]["duration"]) - 5) < 0.4, out["server_mp4"])
        chk("the download is the render service's file through the site", href.startswith("/render-api/files/r") and href.endswith(".mp4?download=1"), href)
    except Exception as e: chk("server export finished", False, [str(e)[:200], await E("()=>(document.querySelector('.sheet .err')||{}).textContent"), open(D + "/render.log").read()[-800:]])
    ups = os.listdir(D + "/up") if os.path.isdir(D + "/up") else []
    chk("only the device's file was uploaded (resumable), the nooi result was used where it is", len([x for x in ups if x.endswith(".webm")]) == 1, ups)
    st, body = http("/render-api/renders"); rs = json.loads(body or "{}").get("renders", [])
    rid = rs[0]["id"] if rs else ""
    ws = await E("(u)=>new Promise(ok=>{const w=new WebSocket(u);w.onmessage=m=>{ok(JSON.parse(m.data).status);w.close()};w.onerror=()=>ok('error');setTimeout(()=>ok('timeout'),5000)})", f"ws://localhost:{PORT}/render-api/ws/renders/{rid}")
    chk("live status over a WebSocket through the site", ws == "done", [ws, rid])
    st, _ = http("/render-api/renders/" + rid, {"X-Dev-User": "someoneelse"})
    chk("another person can't see the render", st in (401, 404), st)
    chk("no page errors", not errs, errs); await b.close()

async def apps(p):
    # the app build (as for Tauri / Capacitor), pointed at this test site, served from another origin
    r = subprocess.run(["pnpm", "exec", "vite", "build", "--mode", "desktop", "--outDir", D + "/app", "--emptyOutDir"], cwd=ROOT + "/studio/apps/web", env=dict(os.environ, VITE_SITE=B), capture_output=True, text=True, timeout=300)
    chk("the app build works (relative paths)", r.returncode == 0 and 'src="./assets/' in open(D + "/app/index.html").read(), r.stderr[-400:])
    st = subprocess.Popen(["python3", "-m", "http.server", str(APORT), "--bind", "127.0.0.1"], cwd=D + "/app", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(40):
            try: urllib.request.urlopen(AO + "/index.html", timeout=1); break
            except Exception: time.sleep(.25)
        req = urllib.request.Request(B + "/v1/health", headers={"Origin": "https://evil.example"}); h = dict(urllib.request.urlopen(req, timeout=5).headers)
        req = urllib.request.Request(B + "/v1/health", headers={"Origin": AO}); h2 = dict(urllib.request.urlopen(req, timeout=5).headers)
        chk("CORS: the app's origin is allowed, another site is not", h.get("Access-Control-Allow-Origin") is None and h2.get("Access-Control-Allow-Origin") == AO, [h.get("Access-Control-Allow-Origin"), h2.get("Access-Control-Allow-Origin")])
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; E = pg.evaluate
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.route("**/v1/uploads", lambda r: r.abort())
        await pg.goto(AO + "/index.html"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=30000); await pg.wait_for_timeout(1500)
        on = await E("()=>window.__studio.api.online"); chk("the app reaches the site across origins", on is True, on)
        await pg.set_input_files('[data-testid="file-input"]', [D + "/b.webm"]); await pg.wait_for_function("Object.keys(" + P + ".assets).length===1", timeout=30000); await pg.wait_for_timeout(300)
        await pg.click('[data-testid="asset"]', position={"x": 30, "y": 25}); await pg.wait_for_timeout(300)
        await pg.click('[data-testid="export"]'); await pg.wait_for_timeout(1500)
        await pg.click('.sheet .ns-seg button:has-text("nooi server")'); await pg.click('.sheet .ns-seg button:has-text("WEBM")'); await pg.click('.sheet .ns-seg button:has-text("720p")'); await pg.click('[data-testid="export-go"]')
        await pg.wait_for_selector('[data-testid="download"], .sheet .err', timeout=180000)
        href = await E("()=>{const a=document.querySelector('[data-testid=download]');return a?a.getAttribute('href'):'err: '+document.querySelector('.sheet .err').textContent}")
        ok = href.startswith(B + "/render-api/files/")
        if ok:
            path = D + "/app.webm"; open(path, "wb").write(urllib.request.urlopen(href, timeout=30).read()); pr = probe(path)
            out["app_webm"] = {"types": sorted(x.get("codec_type") for x in pr.get("streams", [])), "dur": pr.get("format", {}).get("duration")}
            ok = out["app_webm"]["types"] == ["audio", "video"] and abs(float(out["app_webm"]["dur"] or 0) - 2) < 0.4
        chk("the app exports on the server across origins (upload, status, download)", ok, [href, out.get("app_webm")])
        chk("no page errors in the app build", not errs, errs); await ctx.close()
        ctx = await b.new_context(viewport={"width": 1440, "height": 900}); await ctx.add_init_script("window.__TAURI_INTERNALS__={}"); pg = await ctx.new_page()
        await pg.goto(AO + "/index.html"); await pg.wait_for_function("window.__studio", timeout=30000); await pg.wait_for_timeout(800)
        await pg.click('[data-testid="export"]'); await pg.wait_for_timeout(1200)
        opts = await pg.evaluate("()=>[...document.querySelectorAll('.sheet .ns-seg')].map(x=>x.textContent).find(x=>x.includes('FFmpeg'))+' | '+[...document.querySelectorAll('.sheet .hint')].map(x=>x.textContent).join(' ')")
        chk("inside the desktop app, Export offers this computer (FFmpeg) first", "This computer (FFmpeg)" in opts and "FFmpeg" in opts.split("|")[1], opts)
        await b.close()
    finally: st.kill()

async def main():
    for u in (B + "/v1/health", f"http://127.0.0.1:{RPORT}/health"):
        for _ in range(120):
            try: urllib.request.urlopen(u, timeout=1); break
            except Exception: time.sleep(.25)
    async with async_playwright() as p:
        for f in (run, apps):
            try: await f(p)
            except Exception as e: fails.append(f"{f.__name__} crashed: " + repr(e)[:500])
try:
    asyncio.run(main())
finally:
    srv.kill()
    try: os.killpg(rsrv.pid, 9)
    except Exception: pass
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:5000])
print("v220 OK" if not fails else "v220 FAIL")
sys.exit(1 if fails else 0)
