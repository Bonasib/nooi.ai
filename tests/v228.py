# v228 — nooi Motion graphics in the server export (the render service, through the site), like any other part of the edit.
#  · Export → nooi server with motion graphics: each one is drawn on the device frame by frame into a video (colour over black on
#    top, transparency as grey below), uploaded (resumable); the server joins the halves into one see-through layer and lays it in
#  · the dialog says the graphics are drawn here first; the progress names the step
#  · the server's MP4: the lower third and the Motion code circle are in it, moving, over the video (the video shows through around
#    them), at their times; the frames match the device export's drawing
#  · the render service only takes a person's own uploads for motion clips of that project
# Run: python3 tests/v228.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8731; RPORT = 8831; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v228-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
# a dark-red background video with sound, 4 s
FF("-f", "lavfi", "-i", "color=c=0x601010:s=640x360:d=4:r=30", "-f", "lavfi", "-i", "sine=frequency=330:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k", "-c:a", "libopus", "-shortest", D + "/bg.webm")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "jobs": {}}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN", "RENDER_", "DATABASE_URL", "REDIS_URL"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", RENDER_API_URL=f"http://127.0.0.1:{RPORT}"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
RA = ROOT + "/studio/services/render-api"
rsrv = subprocess.Popen([RA + "/node_modules/.bin/tsx", "src/index.ts"], cwd=RA, env=dict(env, RENDER_PORT=str(RPORT), NOOI_APP_URL=B, MEDIA_DIR=D + "/media", UPLOAD_DIR=D + "/up", RENDER_DIR=D + "/out", RENDER_CONCURRENCY="1"), stdout=open(D + "/render.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
P = "window.__studio.editor.project"
def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", path], capture_output=True, text=True, timeout=60)
    try: return json.loads(r.stdout)
    except Exception: return {}
def frame(path, t):   # one frame, 64×36, RGB
    return subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1", "-vf", "scale=64:36", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, timeout=60).stdout
def region(raw, x0, y0, x1, y1, test):
    return sum(1 for y in range(y0, y1) for x in range(x0, x1) if test(raw[(y * 64 + x) * 3: (y * 64 + x) * 3 + 3]))
bright = lambda p: sum(p) > 330          # light (the graphics: white text, a white disc) — the background is dark red
reddish = lambda p: p[0] > 60 and p[0] > p[1] + 30 and p[0] > p[2] + 30   # the background video
def post(path, body):
    try:
        r = urllib.request.urlopen(urllib.request.Request(B + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}), timeout=20); return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

async def run(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route("**/v1/uploads", lambda r: r.abort())   # (the background copy to the account: not part of this)
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=30000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/bg.webm"); await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.duration>3&&a.w)", timeout=30000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a,0)}"); await pg.wait_for_timeout(300)
    # a lower third (0–3 s) and Motion code (1–4 s: a white disc that grows)
    await E("()=>{const A=window.__studio.actions;A.addMotion('lt-bar',0);A.addMotion('code',1)}"); await pg.wait_for_timeout(300)
    code = "m.ctx.fillStyle = '#ffffff'; m.ctx.beginPath(); m.ctx.arc(m.W / 2, m.H * 0.4, m.u * 0.2 * M.interpolate(m.t, [0, 1], [0.3, 1]), 0, 7); m.ctx.fill();"
    await E("(code)=>window.__studio.editor.run('x',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.motion){if(c.motion.tpl==='lt-bar'){c.start=0;c.dur=3}else{c.start=1;c.dur=3;c.motion.props.code=code}}})", code)
    mg = await E("()=>" + P + ".tracks.flatMap(t=>t.clips.filter(c=>c.motion).map(c=>[c.motion.tpl,c.start,c.dur]))")
    chk("the edit: a video, a lower third and a Motion code clip", sorted(mg) == [["code", 1, 3], ["lt-bar", 0, 3]], mg)
    await pg.click('[data-testid="export"]'); await pg.wait_for_timeout(1500)
    await pg.click('.sheet .ns-seg button:has-text("nooi server")'); await pg.click('.sheet .ns-seg button:has-text("MP4")'); await pg.click('.sheet .ns-seg button:has-text("720p")'); await pg.wait_for_timeout(200)
    note = await E("()=>(document.querySelector('[data-testid=exp-motion]')||{}).textContent||''")
    chk("the dialog keeps the server and says the graphics are drawn here first", "drawn on this device first" in note, note)
    steps = set(); await pg.click('[data-testid="export-go"]')
    try:
        t0 = time.time()
        while time.time() - t0 < 240:
            s = await E("()=>{const d=document.querySelector('.sheet .aibusy span');return d?d.textContent:(document.querySelector('[data-testid=download], .sheet .err')?'end':'')}")
            if s == "end": break
            if s: steps.add(s.split(" · ")[0])
            await pg.wait_for_timeout(150)
        chk("the progress names the step (drawing the motion graphics, then the server)", "Drawing the motion graphics" in steps, sorted(steps))
        href = await E("()=>{const a=document.querySelector('[data-testid=download]');return a?a.getAttribute('href'):'err: '+(document.querySelector('.sheet .err')||{}).textContent}")
        if not href.startswith("/render-api/files/"): raise Exception(href + " · " + open(D + "/render.log").read()[-900:])
        async with pg.expect_download() as dl: await pg.click('[data-testid="download"]')
        d = await dl.value; path = D + "/srv.mp4"; await d.save_as(path); pr = probe(path)
        v = [s for s in pr.get("streams", []) if s.get("codec_type") == "video"]
        out["mp4"] = {"v": v, "dur": pr.get("format", {}).get("duration")}
        chk("the server's MP4 is real: H.264 1280×720, the edit's 4 s", v and v[0].get("codec_name") == "h264" and v[0].get("width") == 1280 and abs(float(out["mp4"]["dur"] or 0) - 4) < 0.4, out["mp4"])
        f05, f15, f20, f35 = frame(path, 0.5), frame(path, 1.5), frame(path, 2.0), frame(path, 3.5)
        if os.environ.get("SHOT"): subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.5", "-i", path, "-frames:v", "1", os.environ["SHOT"]], timeout=60)
        LT = (3, 24, 30, 31); MID = (24, 8, 40, 22); CORNER = (54, 2, 62, 8)
        x = out["frames"] = {
            "lt_1.5": region(f15, *LT, bright), "lt_3.5": region(f35, *LT, bright),
            "disc_0.5": region(f05, *MID, bright), "disc_1.5": region(f15, *MID, bright), "disc_2.0": region(f20, *MID, bright),
            "corner_red_1.5": region(f15, *CORNER, reddish), "corner_cells": (CORNER[2] - CORNER[0]) * (CORNER[3] - CORNER[1]),
            "around_lt_red": region(f15, 34, 26, 60, 34, reddish),
        }
        chk("the lower third is in the server's video while it lasts (0–3 s) and gone after", x["lt_1.5"] > 8 and x["lt_3.5"] == 0, x)
        chk("the Motion code disc is there from 1 s and grows (frame by frame, not one still picture)", x["disc_0.5"] == 0 and x["disc_1.5"] > 10 and x["disc_2.0"] > x["disc_1.5"], x)
        chk("the graphics are see-through: the video shows around them (no black box)", x["corner_red_1.5"] == x["corner_cells"] and x["around_lt_red"] > 120, x)
        ups = [f for f in os.listdir(D + "/up")] if os.path.isdir(D + "/up") else []
        chk("the device's video and the two drawn graphics were uploaded (resumable)", len([f for f in ups if f.endswith(".webm")]) == 3, ups)
    except Exception as e: chk("server export with motion graphics", False, str(e)[:900])
    # the render service takes only this person's uploads, for motion clips of that project
    proj = await E("()=>{const p=JSON.parse(JSON.stringify(" + P + "));for(const t of p.tracks)t.clips=t.clips.filter(c=>c.motion);p.assets={};return p}"); mid = [c["id"] for t in proj["tracks"] for c in t["clips"] if c.get("motion")][0]
    st, body = post("/render-api/renders", {"project": proj, "motions": {mid: "/etc/passwd"}, "format": "mp4", "width": 640, "height": 360, "fps": 30})
    chk("a motion video that isn't one of the person's uploads is refused", st == 400 and "motion graphic" in body, [st, body[:200]])
    chk("no page errors", not errs, errs); await b.close()

async def main():
    for u in (B + "/v1/health", f"http://127.0.0.1:{RPORT}/health"):
        for _ in range(120):
            try: urllib.request.urlopen(u, timeout=1); break
            except Exception: time.sleep(.25)
    async with async_playwright() as p:
        try: await run(p)
        except Exception as e: fails.append("run crashed: " + repr(e)[:500])
try:
    asyncio.run(main())
finally:
    srv.kill()
    try: os.killpg(rsrv.pid, 9)
    except Exception: pass
print(json.dumps(out, ensure_ascii=False)[:700])
if fails: print("v228 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v228 OK")
