# v233 — Auto (the tools that edit by themselves) and the clip settings in sections.
#  · a ninth section in the rail: Auto — 8 tools, each a card with a small moving example and one button, and "Auto-edit: do it all"
#  · Remove the pauses (3 quiet seconds taken out), Cut to the beat (every cut lands on a beat of the music, the beats kept),
#    Auto reframe (9:16, every picture fills the frame), Auto colour (a dark clip brightened), Even loudness (a quiet clip louder),
#    Duck the music (under the video's voice), Soft cuts (a dissolve at each cut), Auto captions (heard on the server — simulated
#    here — price first, placed at their times); each one is one undo step
#  · the clip's settings in sections with icons, in the pro editors' order; a section folds and stays folded after a reload
#  · a phone: the nine sections scroll sideways in the bottom bar; Auto in Arabic
# Run: python3 tests/v233.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8742; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v233-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
# a talk with three quiet seconds (1–2, 3–4, 5–6), a dark quiet clip, and music with a click every half second (120 bpm)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6", "-f", "lavfi", "-i", "aevalsrc='if(lt(mod(t\\,2)\\,1)\\,0.5*sin(2*PI*440*t)\\,0)':d=6:s=48000", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k", "-c:a", "libopus", "-shortest", D + "/talk.webm")
FF("-f", "lavfi", "-i", "color=c=0x1c1c1c:s=640x360:d=4:r=30", "-f", "lavfi", "-i", "aevalsrc='0.06*sin(2*PI*330*t)':d=4:s=48000", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "200k", "-c:a", "libopus", "-shortest", D + "/dark.webm")
FF("-f", "lavfi", "-i", "aevalsrc='0.9*sin(2*PI*1000*t)*lt(mod(t\\,0.5)\\,0.03)':d=16:s=48000", "-c:a", "pcm_s16le", D + "/music.wav")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
P = "window.__studio.editor.project"
V1 = "()=>{const p=" + P + ",t=p.tracks.filter(t=>t.kind==='video').slice(-1)[0];return t.clips.map(c=>({id:c.id,s:+c.start.toFixed(3),d:+c.dur.toFixed(3),e:+(c.start+c.dur).toFixed(3),vol:c.volume,col:c.color,sc:c.transform.scale,a:p.assets[c.asset].name}))}"
SENT = {}
async def mock(route):
    req = route.request
    if req.method == "GET": return await route.fulfill(json={"ready": True, "cost": 4, "perMin": 2, "maxMin": 60})
    SENT["cap"] = json.loads(req.post_data); return await route.fulfill(json={"lines": [{"s": 0.1, "e": 0.9, "text": "Hello there"}, {"s": 2.1, "e": 2.9, "text": "This is nooi"}, {"s": 4.1, "e": 4.9, "text": "Thanks"}], "words": [], "lang": "en", "cost": 4})

async def fresh(pg, E, files):
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(500)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', [D + "/" + f for f in files])
    await pg.wait_for_function("Object.values(" + P + ").length>=0&&Object.values(" + P + ".assets).filter(a=>a.duration>0&&(a.kind==='audio'||a.w)).length===" + str(len(files)), timeout=40000)
    await pg.wait_for_function("Object.values(" + P + ".assets).every(a=>a.kind==='image'||(a.waveform||[]).length>10)", timeout=40000)

async def go(pg, E, k, done_re=None):
    await pg.click(f'[data-testid="auto-go-{k}"]'); await pg.wait_for_selector(f'[data-testid="auto-done-{k}"]', timeout=40000)
    return await E(f"()=>document.querySelector('[data-testid=auto-done-{k}]').textContent")

async def desktop(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/captions169(\?.*)?$"), mock)
    await fresh(pg, E, ["talk.webm", "dark.webm", "music.wav"])
    rails = await E("()=>[...document.querySelectorAll('.rail button')].map(b=>b.dataset.testid)")
    await pg.click('[data-testid="rail-auto"]'); await pg.wait_for_selector('[data-testid="auto-panel"]')
    cards = await E("()=>[...document.querySelectorAll('.autoc')].map(c=>({id:c.dataset.testid,anim:[...c.querySelectorAll('.autodemo *')].some(x=>getComputedStyle(x).animationName!=='none'),btn:!!c.querySelector('button')}))")
    chk("the rail's ninth section is Auto: 8 tools, each a card with a moving example and a button", rails[2] == "rail-auto" and len(rails) == 9 and len(cards) == 10 and all(c["anim"] and c["btn"] for c in cards), [rails, cards])
    # the edit: the talk twice on V1 (a cut at 6 s), the dark clip after it, the music under them
    await E("()=>{const s=window.__studio,as=Object.values(s.editor.project.assets),f=n=>as.find(a=>a.name===n);s.actions.addAsset(f('talk'));s.actions.addAsset(f('talk'));s.actions.addAsset(f('dark'));s.actions.addAsset(f('music'),0);s.editor.select([])}")
    await pg.wait_for_timeout(400); v0 = await E(V1)
    # ---- pauses
    r = await go(pg, E, "pauses"); v1 = await E(V1); total0 = sum(c["d"] for c in v0); total1 = sum(c["d"] for c in v1)
    chk("Remove the pauses: the quiet seconds of both talks are taken out (one undo step)", "6 pauses removed" in r and 4.8 < total0 - total1 < 6.2 and len(v0) == 3, [r, total0, total1, v0])
    await E("()=>window.__studio.actions.undo()"); await pg.wait_for_timeout(200); v1u = await E(V1)
    chk("…and Undo puts them back", [c["d"] for c in v1u] == [c["d"] for c in v0], [v0, v1u])
    # ---- beat
    r = await go(pg, E, "beat"); v2 = await E(V1); beats = await E("()=>" + P + ".beats")
    near = [min((abs(c["e"] - b) for b in beats), default=9) for c in v2]
    chk("Cut to the beat: the beats are found (every half second) and every cut lands on one", "onto the beat" in r and len(beats) >= 20 and all(x < 0.04 for x in near) and abs((beats[3] - beats[2]) - 0.5) < 0.05, [r, beats[:6], v2, near])
    await E("()=>window.__studio.actions.undo()"); await pg.wait_for_timeout(200)
    # ---- colour, loudness, duck, soft cuts
    r = await go(pg, E, "color"); v3 = await E(V1); dark = [c for c in v3 if c["a"] == "dark"][0]
    chk("Auto colour: the dark clip is brightened; the bright test picture barely changes", "balanced" in r and dark["col"]["exposure"] > 0.3 and abs([c for c in v3 if c["a"] == "talk"][0]["col"]["exposure"]) < 0.25, [r, dark["col"], v3[0]["col"]])
    r = await go(pg, E, "loud"); v4 = await E(V1); dv = [c for c in v4 if c["a"] == "dark"][0]["vol"]; tv = [c for c in v4 if c["a"] == "talk"][0]["vol"]
    chk("Even loudness: the quiet clip is turned up, the loud one stays near its level", "evened out" in r and dv > 1.5 and 0.8 <= tv <= 1.9 and dv > tv, [r, dv, tv])
    r = await go(pg, E, "duck"); du = await E("()=>{const p=" + P + ",v=p.tracks.filter(t=>t.kind==='video').slice(-1)[0];return{on:p.ducking.enabled,voices:p.ducking.voiceTracks,v1:v.id}}")
    chk("Duck the music: on, with the video's sound as the voice", du["on"] and du["v1"] in du["voices"], [r, du])
    r = await go(pg, E, "trans"); tr = await E("()=>" + P + ".transitions.map(t=>t.type)")
    chk("Soft cuts: a dissolve at each of the two cuts", tr == ["fade", "fade"], [r, tr])
    # ---- reframe
    await pg.click('[data-testid="auto-reframe"] .ns-seg button:has-text("9:16")'); await pg.click('[data-testid="auto-reframe"] .ns-seg button:has-text("Keep the middle")'); r = await go(pg, E, "reframe"); v5 = await E(V1); dims = await E("()=>[" + P + ".width," + P + ".height]")
    chk("Auto reframe: the project becomes 9:16 and each 16:9 picture fills it (scale 3.16)", dims == [1080, 1920] and all(abs(c["sc"] - 3.16) < 0.02 for c in v5), [r, dims, [c["sc"] for c in v5]])
    # ---- captions (the server's hearing simulated)
    btn = await E("()=>document.querySelector('[data-testid=auto-go-captions]').textContent")
    r = await go(pg, E, "captions"); caps = await E("()=>" + P + ".tracks.filter(t=>t.kind==='text').flatMap(t=>t.clips).map(c=>[c.text,+c.start.toFixed(1),c.template])")
    chk("Auto captions: the price first, the edit's sound sent once (a small WAV), the words placed at their times", "4 credits" in btn and SENT.get("cap", {}).get("url", "").endswith(".wav") and caps == [["Hello there", 0.1, "caption"], ["This is nooi", 2.1, "caption"], ["Thanks", 4.1, "caption"]], [btn, SENT.get("cap"), caps])
    # ---- do it all, on a fresh edit
    await fresh(pg, E, ["talk.webm", "dark.webm", "music.wav"])
    await E("()=>{const s=window.__studio,as=Object.values(s.editor.project.assets),f=n=>as.find(a=>a.name===n);s.actions.addAsset(f('talk'));s.actions.addAsset(f('dark'));s.actions.addAsset(f('music'),0);s.editor.select([])}")
    await pg.click('[data-testid="rail-auto"]'); await pg.click('[data-testid="auto-all"]'); await pg.wait_for_selector('[data-testid="auto-done-trans"]', timeout=60000)
    dn = await E("()=>[...document.querySelectorAll('[data-testid^=auto-done-]')].map(x=>x.dataset.testid.slice(10))")
    st = await E("()=>{const p=" + P + ";return{duck:p.ducking.enabled,tr:p.transitions.length,steps:window.__studio.editor.past.slice(-5).map(x=>x.label||x)}}")
    chk("Auto-edit (do it all): pauses, loudness, colour, ducking and soft cuts, each its own undo step", sorted(dn) == ["color", "duck", "loud", "pauses", "trans"] and st["duck"] and st["tr"] >= 1, [dn, st])
    # ---- the clip's settings in sections
    await E("()=>{const s=window.__studio,c=s.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.type==='media'&&s.editor.project.assets[c.asset].kind==='video');s.editor.select([c.id])}"); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="insp-video"]'); await pg.wait_for_timeout(200)
    secs = await E("()=>[...document.querySelectorAll('.inspector .isec')].map(s=>({id:s.dataset.sec,icon:!!s.querySelector('.isic svg'),open:s.classList.contains('open')}))")
    chk("the clip's settings in sections with icons, in order: position & size, opacity & blend, crop, keyframes, background & cut-out (v234), extend with AI (v242), effects, animation", [s["id"] for s in secs] == ["transform", "compose", "crop", "keys", "bk", "ex", "fx", "anim"] and all(s["icon"] and s["open"] for s in secs), secs)
    await pg.click('[data-testid="sec-crop"]'); await pg.wait_for_timeout(200); folded = await E("()=>!document.querySelector('[data-sec=crop] .isecb')")
    await pg.reload(); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(800)
    await E("()=>{const s=window.__studio,c=s.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.type==='media'&&s.editor.project.assets[c.asset].kind==='video');s.editor.select([c.id])}"); await pg.wait_for_timeout(300); await pg.click('[data-testid="insp-video"]'); await pg.wait_for_timeout(200)
    still = await E("()=>({crop:!document.querySelector('[data-sec=crop] .isecb'),trans:!!document.querySelector('[data-sec=transform] .isecb')})")
    for tab, want in (("audio", ["volume", "clean"]), ("color", ["cbasic", "clight", "hsl", "lut"]), ("speed", ["speed", "ramps"])):
        await pg.click(f'[data-testid="insp-{tab}"]'); await pg.wait_for_timeout(150); got = await E("()=>[...document.querySelectorAll('.inspector .isec')].map(s=>s.dataset.sec)")
        chk(f"the {tab} tab in sections", got == want, got)
    chk("a section folds with a tap and stays folded after a reload", folded and still == {"crop": True, "trans": True}, [folded, still])
    chk("desktop: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300)
    m = await E("()=>{const r=document.querySelector('.mrail');return{n:r.querySelectorAll('button').length,scroll:r.scrollWidth>r.clientWidth,page:document.documentElement.scrollWidth-innerWidth,minw:Math.min(...[...r.querySelectorAll('button')].map(b=>b.getBoundingClientRect().width))}}")
    await pg.locator('[data-testid="rail-auto"]').scroll_into_view_if_needed(); await pg.click('[data-testid="rail-auto"]'); await pg.wait_for_selector('[data-testid="auto-panel"]')
    a = await E("()=>({title:document.querySelector('[data-testid=auto-pauses] .autot b').textContent,all:document.querySelector('[data-testid=auto-all]').textContent,page:document.documentElement.scrollWidth-innerWidth})")
    chk("phone: nine sections in the bottom bar (it scrolls sideways, none squeezed), Auto in Arabic, nothing wider than the screen", m["n"] == 9 and m["minw"] >= 56 and m["page"] <= 0 and a["title"] == "حذف الصمت" and "مونتاج تلقائي" in a["all"] and a["page"] <= 0, [m, a])
    chk("phone: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f in (desktop, phone):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps(out, ensure_ascii=False)[:900])
if fails: print("v233 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v233 OK")
