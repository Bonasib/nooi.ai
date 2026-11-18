# v245 — for another editor (FCPXML / EDL / MLT), music made in code, a long video → shorts (the lossless server cut is
# tests/v245_smartcut.mjs)
#  · Export → For another editor: three files download; the FCPXML holds both shots and the marker, the EDL the timecodes, the MLT
#    a playlist per track
#  · Audio → Music made here: 8 moods, each with its icon and a moving example; Listen plays it; Add puts a WAV of the asked length
#    (whole bars) on a sound track at the playhead and marks its beats; Another tune writes a different one
#  · Auto → Long video → shorts: from the heard words (simulated), the hook and its answer is the best moment; Make this short opens
#    a new edit (the long one kept): only that moment, 9:16, captions from its words
# Run: python3 tests/v245.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8762; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v245-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=180, stdin=subprocess.DEVNULL)
VP9 = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "120k"]
FF("-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=6", *VP9, D + "/a.webm")
FF("-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=190", "-f", "lavfi", "-i", "aevalsrc='0.1*sin(2*PI*220*t)':d=190:s=48000", *VP9, "-c:a", "libopus", "-shortest", D + "/long.webm")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "SEEDANCE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1200]))
P = "window.__studio.editor.project"
def W(txt, t0, step=0.35): return [{"s": round(t0 + i * step, 3), "e": round(t0 + i * step + 0.28, 3), "w": w} for i, w in enumerate(txt.split(" "))]
def talk():
    out, t = [], 0.0
    for _ in range(12): out += W("um so yeah we were just um talking about stuff", t, 0.6); t += 9
    hook = t; out += W("Why do most videos fail?", t); t += 2.2
    for _ in range(8): out += W("They lose people in the first three seconds because nothing happens.", t); t += 4.2
    for _ in range(5): out += W("uh and then um we went home", t, 0.7); t += 8
    return out, hook
WORDS, HOOK = talk()
async def mock(route):
    if route.request.method == "GET": return await route.fulfill(json={"ready": True, "cost": 6, "perMin": 2, "maxMin": 60})
    return await route.fulfill(json={"words": WORDS, "lines": [], "lang": "en", "cost": 6})

async def fresh(pg, files):
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(500)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', [D + "/" + f for f in files])
    await pg.wait_for_function("Object.values(" + P + ").length>=0&&Object.values(" + P + ".assets).filter(a=>a.duration>0&&a.w).length===" + str(len(files)), timeout=60000)

async def studio(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/captions169(\?.*)?$"), mock)
    # ---- for another editor
    await fresh(pg, ["a.webm"])
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a);s.actions.addAsset(a);s.actions.run('m',p=>{p.markers.push({id:'k1',t:6,name:'Second',color:'#fff'})})}"); await pg.wait_for_timeout(300)
    await E("()=>window.__studio.ui.set({exportOpen:true})"); await pg.wait_for_selector('[data-testid="nle"]')
    got = {}
    for k in ("fcpxml", "edl", "mlt"):
        async with pg.expect_download() as dl: await pg.click(f'[data-testid="nle-{k}"]')
        d = await dl.value; f = D + "/" + d.suggested_filename; await d.save_as(f); got[k] = (d.suggested_filename, open(f, encoding="utf8").read())
    lint = {k: subprocess.run(["xmllint", "--noout", D + "/" + got[k][0]], capture_output=True, text=True).returncode for k in ("fcpxml", "mlt")}
    fx, ed, ml = got["fcpxml"][1], got["edl"][1], got["mlt"][1]
    chk("For another editor: FCPXML (2 shots, the marker), EDL (timecodes), MLT (a playlist) — the XML well formed", got["fcpxml"][0].endswith(".fcpxml") and fx.count("<asset-clip ") == 2 and 'value="Second"' in fx and 'src="./a.webm"' in fx
        and "001  A        AA/V  C        00:00:00:00 00:00:06:00 00:00:00:00 00:00:06:00" in ed and "002  A" in ed and "<playlist " in ml and lint == {"fcpxml": 0, "mlt": 0}, {k: v[1][:400] for k, v in got.items()} | {"lint": lint})
    await E("()=>window.__studio.ui.set({exportOpen:false})")
    # ---- music made here
    await pg.click('[data-testid="rail-audio"]'); await pg.wait_for_selector('[data-testid="code-music"]')
    moods = await E("()=>[...document.querySelectorAll('[data-testid^=cm-]')].filter(b=>b.classList.contains('cmt')).map(b=>({id:b.dataset.testid,icon:!!b.querySelector('svg'),anim:getComputedStyle(b.querySelector('.cmx i')).animationName}))")
    chk("Music made here: 8 moods, each with an icon and a moving example", len(moods) == 8 and all(m["icon"] and m["anim"] == "cmb" for m in moods), moods)
    await pg.click('[data-testid="cm-upbeat"]'); await pg.click('[data-testid="cm-listen"]'); await pg.wait_for_function("()=>/Stop/.test(document.querySelector('[data-testid=cm-listen]').textContent)", timeout=20000)
    await pg.click('[data-testid="cm-listen"]')
    await pg.click('[data-testid="cm-calm"]'); await pg.click('.cm .ns-seg button:has-text("15")'); await E("()=>window.__studio.player.seek(2)")
    await pg.click('[data-testid="cm-add"]'); await pg.wait_for_function("()=>Object.values(" + P + ".assets).some(a=>a.kind==='audio')", timeout=30000); await pg.wait_for_timeout(500)
    mu = await E("()=>{const p=" + P + ",a=Object.values(p.assets).find(x=>x.kind==='audio'),c=p.tracks.flatMap(t=>t.clips).find(c=>c.asset===a.id);return{name:a.name,dur:a.duration,peak:Math.max(...(a.waveform||[0])),start:c&&c.start,beats:p.beats.slice(0,3),nb:p.beats.length}}")
    bar = 4 * 60 / 76
    chk("…Add: a WAV of whole bars (≥ 15 s) on a sound track at the playhead, not silent, its beats marked from there", mu["dur"] and 15 <= mu["dur"] < 15 + bar + 0.8 and mu["peak"] > 0.1 and abs((mu["start"] or 0) - 2) < 0.05 and abs(mu["beats"][0] - 2) < 0.01 and abs(mu["beats"][1] - 2 - 60 / 76) < 0.01, mu)
    await pg.locator('[data-testid="code-music"]').screenshot(path=D + "/music.png")
    # ---- long video → shorts
    await fresh(pg, ["long.webm"]); await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a);s.actions.run('n',p=>{p.name='Long talk'})}"); await pg.wait_for_timeout(500)
    longId = await E("()=>" + P + ".id")
    await pg.click('[data-testid="rail-auto"]'); await pg.click('[data-testid="sh-hear"]'); await pg.wait_for_selector('[data-testid="sh-list"]', timeout=60000)
    ms = await E("()=>[...document.querySelectorAll('[data-testid^=sh-m-]')].map(li=>({t:li.querySelector('.sht').textContent,why:li.querySelector('.shw').textContent,when:li.querySelector('.shh b').textContent}))")
    chk("Long video → shorts: the hook and its answer is the best moment, with why", ms and ms[0]["t"].startswith("“Why do most videos fail?") and "starts with a hook" in ms[0]["why"], ms)
    await pg.locator('[data-testid="auto-shorts"]').screenshot(path=D + "/shorts.png")
    await pg.click('[data-testid="sh-make-0"]'); await pg.wait_for_function("()=>/Short 1/.test(" + P + ".name)", timeout=60000)
    await pg.wait_for_function("()=>" + P + ".tracks.some(t=>t.kind==='text'&&t.clips.length)", timeout=120000); await pg.wait_for_timeout(800)
    sh = await E("()=>{const p=" + P + ",cap=p.tracks.filter(t=>t.kind==='text').flatMap(t=>t.clips);return{id:p.id,name:p.name,w:p.width,h:p.height,dur:p.tracks.flatMap(t=>t.clips).filter(c=>c.type==='media').reduce((m,c)=>Math.max(m,c.start+c.dur),0),caps:cap.map(c=>[+c.start.toFixed(2),c.text]).slice(0,3)}}")
    idx = await E("async()=>{const r=await new Promise(ok=>{const q=indexedDB.open('nooi-studio');q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(null)});return !!r}")
    m0 = re.findall(r"(\d+):(\d+)", ms[0]["when"]); a0 = int(m0[0][0]) * 60 + int(m0[0][1]); b0 = int(m0[1][0]) * 60 + int(m0[1][1])
    chk("…Make this short: a new edit (the long one kept), only that moment, 9:16, captions from its words starting at the question",
        sh["id"] != longId and sh["name"] == "Long talk · Short 1" and [sh["w"], sh["h"]] == [1080, 1920] and abs(sh["dur"] - (b0 - a0)) < 1.5 and sh["caps"] and sh["caps"][0][1].startswith("Why do most") and sh["caps"][0][0] < 0.5, [sh, ms[0], a0, b0])
    await pg.screenshot(path=D + "/short.png")
    chk("studio: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        try: await studio(p)
        except Exception as e: chk("studio crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
if fails: print("v245 FAIL\n - " + "\n - ".join(fails)); print("shots:", D); sys.exit(1)
if os.environ.get("KEEP"): print("shots:", D)
else: subprocess.run(["rm", "-rf", D])
print("v245 OK")
