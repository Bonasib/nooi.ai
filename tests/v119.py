# v119 "Kie AI was very fast at first, now very slow — is it a cache, or code? Which add-ons slow the export? Would a bigger VPS
# help?" — a real nooi server, real ffmpeg:
#  · 60/120 fps: the frame maker (minterpolate) uses one core, so the video is made in pieces side by side, one per core: the same
#    frames and sound as before, faster (2 pieces ≈ half the time)
#  · editor export: a recording already H.264 at the format's size is only re-packed (copy, fast); anything else is converted as
#    before (H.264 at the format's size); each conversion's time is noted
#  · the page uploads the recording once (to be converted) — not a second time first — and the library keeps the converted file
#  · Admin → Speed: would a bigger server help? no when the AI engine's time is most of it; yes when this server's own work is a
#    quarter or more, or the processor is fully busy; the exports' converting speed per second of video (English + Arabic)
# Run: python3 tests/v119.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8330
D = tempfile.mkdtemp(prefix="nooi-v119-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
def probe(f, ent="stream=codec_name,width,height,nb_read_frames", extra=("-count_frames", "-select_streams", "v")):
    r = subprocess.run(["ffprobe", "-v", "error", *extra, "-show_entries", ent, "-of", "json", f], capture_output=True, text=True).stdout
    return json.loads(r or "{}")
now = int(time.time() * 1000)
# jobs of the last day where the AI engine's time is nearly all of it (line 200 s + making 100 s; 20 s ours before)
ENG = lambda i: {"id": i, "kind": "video", "status": "done", "progress": 1, "url": "/media/x.mp4", "created": now - 400e3, "sentAt": now - 380e3, "doneAt": now - 78e3,
                 "times": {"queue": 200, "making": 100, "fetch": 2}, "payload": {"kind": "video", "model": "seedance", "dur": 5}, "cost": 0, "title": "v"}
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {i: ENG(i) for i in ("e1", "e2", "e3")}}}}, open(D + "/data/db.json", "w"))

def smoothing():
    W = tempfile.mkdtemp(prefix="nooi-v119s-"); os.makedirs(W + "/data"); os.makedirs(W + "/media")
    ff("-f", "lavfi", "-i", "testsrc2=s=640x360:r=24", "-f", "lavfi", "-i", "sine=f=440:r=44100", "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", W + "/media/src.mp4")
    js = W + "/t.mjs"; open(js, "w").write(f"""const m = await import("{ROOT}/lib/fps96.js"); const t0 = Date.now(); const u = await m.smoothFps("/media/src.mp4", 60);
console.log(JSON.stringify({{u, s: (Date.now() - t0) / 1000, parts: m.smoothParts(4)}})); process.exit(0);""")
    res = {}
    for n in ("1", "2"):
        r = subprocess.run(["taskset", "-c", "0,1", "node", js], cwd=W, env=dict(os.environ, SMOOTH_PARTS=n), capture_output=True, text=True, timeout=400)
        o = json.loads(r.stdout.strip().splitlines()[-1]); f = W + o["u"]
        v = probe(f)["streams"][0]; a = probe(f, "stream=codec_name,duration", ("-select_streams", "a"))["streams"]; vd = probe(f, "stream=duration", ("-select_streams", "v"))["streams"][0]
        res[n] = {"s": o["s"], "parts": o["parts"], "frames": int(v["nb_read_frames"]), "vdur": float(vd["duration"]), "audio": a[0]["codec_name"] if a else None, "adur": float(a[0]["duration"]) if a else 0}
    out["smooth"] = res; one, two = res["1"], res["2"]
    ok(one["parts"] == 1 and two["parts"] == 2, f"60 fps: one piece per core (asked 1 and 2) {res}")
    ok(abs(two["frames"] - one["frames"]) <= 1 and two["frames"] >= 4 * 60 - 12, f"60 fps in pieces: the same frames as in one go {one['frames']} / {two['frames']}")
    ok(two["audio"] == "aac" and abs(two["adur"] - two["vdur"]) <= 0.2, f"60 fps in pieces: the video's own sound, the same length as the picture {two}")
    ok(two["s"] < 0.8 * one["s"], f"60 fps in 2 pieces is faster than in one go ({one['s']} s → {two['s']} s)")

def verdicts():
    W = tempfile.mkdtemp(prefix="nooi-v119v-"); os.makedirs(W + "/data"); json.dump({"users": {}}, open(W + "/data/db.json", "w"))
    js = W + "/v.mjs"; open(js, "w").write(f"""const {{ vps119 }} = await import("{ROOT}/lib/jobs.js"); const S = (l, c) => ({{ load: [l, l, l], cpus: c }});
const k = (total, engine, own, lips = 0) => ({{ last24h: {{ video: {{ n: 4, total, engine, own, lips }} }} }});
console.log(JSON.stringify([vps119({{ ...k(320, 300, 5), server: S(0.2, 2) }}), vps119({{ ...k(100, 40, 50), server: S(0.2, 2) }}), vps119({{ ...k(320, 300, 5), server: S(2.5, 2) }}), vps119({{ last24h: {{}}, server: S(0.1, 2) }}),
  vps119({{ ...k(400, 100, 10, 200), server: S(0.1, 4) }})])); process.exit(0);""")
    r = subprocess.run(["node", js], cwd=W, capture_output=True, text=True, timeout=60); v = json.loads(r.stdout.strip().splitlines()[-1]); out["verdicts"] = v
    ok([x["verdict"] for x in v] == ["no", "yes", "yes", "unknown", "no"] and v[2]["busy"] and v[4]["engineShare"] == 75, f"bigger server: no (engine time) · yes (our work) · yes (processor full) · unknown (no jobs) · no (lip sync is the engine's) {v}")

def api(p, body=None, method=None, raw=None, ctype=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=raw if raw is not None else (json.dumps(body).encode() if body is not None else None), method=method or ("POST" if (body is not None or raw is not None) else "GET"))
    req.add_header("content-type", ctype or "application/json")
    try: return json.loads(urllib.request.urlopen(req, timeout=180).read())
    except urllib.error.HTTPError as e: return {"_code": e.code, **(json.loads(e.read() or b"{}"))}

def server_side():
    ff("-f", "lavfi", "-i", "testsrc2=s=540x960:r=30", "-f", "lavfi", "-i", "sine=f=330:r=48000", "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/rec.mp4")
    ff("-f", "lavfi", "-i", "testsrc2=s=540x960:r=30", "-f", "lavfi", "-i", "sine=f=330:r=48000", "-t", "3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-shortest", D + "/rec.webm")
    r1 = api("/v1/media/transcode?w=540&h=960&fmt=mp4&fps=30", raw=open(D + "/rec.mp4", "rb").read(), ctype="video/webm")
    r2 = api("/v1/media/transcode?w=540&h=960&fmt=mp4&fps=30", raw=open(D + "/rec.webm", "rb").read(), ctype="video/webm")
    r3 = api("/v1/media/transcode?w=720&h=1280&fmt=mp4&fps=30", raw=open(D + "/rec.mp4", "rb").read(), ctype="video/webm")
    out["transcode"] = [r1, r2, r3]
    def got(r): f = D + "/media/" + r["url"].split("/media/")[-1]; s = probe(f, "stream=codec_name,width,height", ("-select_streams", "v"))["streams"][0]; return [s["codec_name"], s["width"], s["height"]]
    ok(r1.get("copy") is True and got(r1) == ["h264", 540, 960], f"export: H.264 already at the format's size is only re-packed {r1}")
    ok(r2.get("copy") is False and got(r2) == ["h264", 540, 960], f"export: a WebM recording is converted to H.264 as before {r2}")
    ok(r3.get("copy") is False and got(r3) == ["h264", 720, 1280], f"export: H.264 at another size is converted to the format's size {r3}")
    sp = api("/v1/admin/speed"); adv = [a for a in sp.get("advice") or []]; en = " | ".join(a["en"] for a in adv); out["speed"] = {"vps": sp.get("vps"), "advice": en[:900]}
    v = sp.get("vps") or {}
    ok(v.get("verdict") == "no" and v.get("engineShare", 0) >= 80, f"speed card: the engine's time is most of it → a bigger server would not help {v}")
    ok("A bigger server (VPS) would not make jobs noticeably faster" in en and "Editor exports: converting takes about" in en and v.get("exportRate") is not None and v.get("exports") == 3 and all(a.get("ar") for a in adv),
       f"speed card: the bigger-server answer and the exports' converting speed (English + Arabic) {en}")

async def page():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1280, "height": 860}, accept_downloads=True); pg = await ctx.new_page(); E = pg.evaluate; errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('en');document.getElementById('modalRoot').innerHTML='';renderAll()}")
        await E("""()=>{window.__calls=[];const f=window.fetch;window.fetch=function(u,o){const s=String(u&&u.url||u);if(/\\/v1\\/(uploads|media\\/transcode)/.test(s))__calls.push(((o&&o.method)||'GET')+' '+s.split('?')[0]);return f.apply(this,arguments)};
          PJ.fresh('edit');S.ed.format='tiktok';S.ed.q93='fast';S.ed.rcheck=false;S.ed.clips.push({id:uid(),src:{k:'demo',kind:'scene',seed:11},in:0,out:2,speed:1,trans:'cut',vol:100});go('edit');renderAll()}""")
        await pg.wait_for_timeout(800)
        async with pg.expect_download(timeout=90000) as dl:
            await E("()=>edExport()")
        await dl.value; await pg.wait_for_timeout(500)
        r = await E("()=>{const j=S.jobs.find(x=>x.id===S.ed.lastExport);return {calls:__calls,url:j&&j.resultUrl,api:API.mode}}"); out["page"] = r
        ups = [c for c in r["calls"] if "/v1/uploads" in c]; tcs = [c for c in r["calls"] if "/v1/media/transcode" in c]
        ok(r["api"] == "server" and not ups and len(tcs) == 1, f"export: the recording goes up once (to be converted), not a second time first {r}")
        ok(str(r["url"] or "").endswith(".mp4") and "/media/" in str(r["url"]), f"export: the library keeps the converted file {r}")
        ok(not errs, f"page errors {errs[:3]}"); await b.close()

async def main():
    smoothing(); verdicts()
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL="http://localhost:9", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        server_side(); await page()
    finally: srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
