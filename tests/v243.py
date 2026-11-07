# v243 — editing by the words, following the person, checking before posting, beat cuts on a grid (Auto in the studio)
#  · Auto has ten tools now; Smart cut and Check before posting are cards with a moving example like the others
#  · Smart cut: the price first, the edit's sound heard once (simulated here); the long pauses, the "um", the retake are listed for a
#    look, the leaned-on words (يعني) only when asked; one tap cuts them in one undo step — the talk gets shorter, the music under it
#    is not cut (one clip, still from 0, trimmed to the new end)
#  · Cut to the beat on every bar: fewer beats on the grid than every beat
#  · Check before posting (TikTok): a wide edit is the wrong shape (fixed with a tap), a title under TikTok's buttons (moved in with a
#    tap), the loudness measured (BS.1770) and brought to −14 LUFS with a tap, the safe area drawn on the preview; the Export dialog
#    shows the same check for the chosen platform
#  · Auto reframe that follows the person: a person walking left to right in a wide video → in 9:16 the picture moves with them
#    (keyframes from one side to the other, eased, not a jitter)
#  · Arabic
# Run: python3 tests/v243.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8759; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v243-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=180, stdin=subprocess.DEVNULL)
VP9 = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k"]
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=12", "-f", "lavfi", "-i", "aevalsrc='0.1*sin(2*PI*220*t)':d=12:s=48000", *VP9, "-c:a", "libopus", "-shortest", D + "/talk.webm")
FF("-f", "lavfi", "-i", "aevalsrc='0.07*sin(2*PI*440*t)+0.25*sin(2*PI*1000*t)*lt(mod(t\\,0.5)\\,0.03)':d=20:s=48000", "-c:a", "pcm_s16le", D + "/music.wav")
POSE = D + "/pose.jpg"
try: urllib.request.urlretrieve("https://storage.googleapis.com/mediapipe-assets/pose.jpg", POSE)
except Exception: POSE = None
if POSE:   # the person (cropped from the photo) walks from the left to the right of a wide grey frame
    FF("-f", "lavfi", "-i", "color=c=0x6a7a8a:s=1280x720:d=4:r=30", "-loop", "1", "-i", POSE, "-filter_complex", "[1]scale=640:-2,crop=360:ih:140:0[p];[0][p]overlay=x='40+220*t':y=150:shortest=1", "-t", "4", *VP9, D + "/walk.webm")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "SEEDANCE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1200]))
P = "window.__studio.editor.project"
def W(txt, t0, step=0.4, ln=0.3): return [{"s": round(t0 + i * step, 3), "e": round(t0 + i * step + ln, 3), "w": w} for i, w in enumerate(txt.split(" "))]
WORDS = W("welcome um to the show", 0.2) + W("today we look at", 4.0) + W("today we look at the new editor", 6.0) + W("يعني it is fast", 9.2)
SENT = {}
async def mock(route):
    req = route.request
    if req.method == "GET": return await route.fulfill(json={"ready": True, "cost": 4, "perMin": 2, "maxMin": 60})
    SENT["n"] = SENT.get("n", 0) + 1; return await route.fulfill(json={"words": WORDS, "lines": [], "lang": "en", "cost": 4})

async def fresh(pg, files):
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(500)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', [D + "/" + f for f in files])
    await pg.wait_for_function("Object.values(" + P + ".assets).filter(a=>a.duration>0&&(a.kind==='audio'||a.w)).length===" + str(len(files)), timeout=40000)
    await pg.wait_for_function("Object.values(" + P + ".assets).every(a=>a.kind==='image'||a.kind==='video'&&!a.hasAudio||(a.waveform||[]).length>10)", timeout=40000)

TRK = "()=>{const p=" + P + ";return p.tracks.map(t=>({k:t.kind,c:t.clips.map(c=>({s:+c.start.toFixed(3),d:+c.dur.toFixed(3),vol:c.volume,x:c.transform.x,sc:c.transform.scale,kx:(c.keyframes.x||[]).map(k=>[k.t,k.v,k.ease]),y:c.transform.y,n:c.type==='text'?c.text:p.assets[c.asset].name}))}))}"

async def desktop(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/captions169(\?.*)?$"), mock)
    await fresh(pg, ["talk.webm", "music.wav"])
    await E("()=>{const s=window.__studio,as=Object.values(s.editor.project.assets),f=n=>as.find(a=>a.name===n);s.actions.addAsset(f('talk'));s.actions.addAsset(f('music'),0);s.editor.select([])}"); await pg.wait_for_timeout(400)
    await pg.click('[data-testid="rail-auto"]'); await pg.wait_for_selector('[data-testid="auto-panel"]')
    cards = await E("()=>[...document.querySelectorAll('.autoc')].map(c=>({id:c.dataset.testid,anim:[...c.querySelectorAll('.autodemo *')].some(x=>getComputedStyle(x).animationName!=='none'),btn:!!c.querySelector('button')}))")
    chk("Auto has ten tools — Smart cut first and Check before posting — each with a moving example and a button", len(cards) == 10 and cards[0]["id"] == "auto-smart" and any(c["id"] == "auto-check" for c in cards) and all(c["anim"] and c["btn"] for c in cards), cards)
    await pg.screenshot(path=D + "/auto.png")
    # ---- smart cut
    hear = await E("()=>document.querySelector('[data-testid=sc-hear]').textContent")
    await pg.click('[data-testid="sc-hear"]'); await pg.wait_for_selector('[data-testid="sc-list"]', timeout=40000)
    rows = await E("()=>[...document.querySelectorAll('[data-testid^=sc-cut-]')].map(li=>[li.querySelector('em').textContent,li.querySelector('span').textContent])")
    kinds = [r[0] for r in rows]
    chk("Smart cut: the price first, the sound heard once; pauses, the 'um' and the retake listed for a look (يعني only when asked)", "4 credits" in hear and SENT.get("n") == 1 and "Long pauses" in kinds and any("um" == r[1] for r in rows) and any(r[0] == "Retakes" and "today we look at" in r[1] for r in rows) and not any("يعني" in r[1] for r in rows), [hear, SENT, rows])
    await pg.click('[data-testid="sc-soft"]'); await pg.wait_for_timeout(200)
    rows2 = await E("()=>[...document.querySelectorAll('[data-testid^=sc-cut-] span')].map(s=>s.textContent)")
    chk("…the leaned-on words (يعني) join the list when asked", any("يعني" in r for r in rows2), rows2)
    await pg.screenshot(path=D + "/smart.png")
    before = await E(TRK); n0 = await E("()=>window.__studio.editor.past.length")
    btn = await E("()=>document.querySelector('[data-testid=sc-apply]').textContent"); secs = float(re.search(r"−([\d.]+)", btn).group(1))
    await pg.click('[data-testid="sc-apply"]'); await pg.wait_for_timeout(400); after = await E(TRK); n1 = await E("()=>window.__studio.editor.past.length")
    v0 = [t for t in before if t["k"] == "video"][-1]["c"]; v1 = [t for t in after if t["k"] == "video"][-1]["c"]; m1 = [t for t in after if t["k"] == "audio" and t["c"]][0]["c"]
    end1 = max(c["s"] + c["d"] for c in v1); end0 = max(c["s"] + c["d"] for c in v0)
    chk("…one tap cuts them, one undo step: the talk is shorter by what was listed; the music is not cut — one clip from 0 to the new end",
        n1 == n0 + 1 and abs((end0 - end1) - secs) < 0.15 and len(v1) >= 4 and len(m1) == 1 and m1[0]["s"] == 0 and abs(m1[0]["s"] + m1[0]["d"] - end1) < 0.06, [btn, end0, end1, v1, m1])
    await E("()=>window.__studio.actions.undo()"); await pg.wait_for_timeout(200); und = await E(TRK)
    chk("…and Undo brings it all back", und == before, None)
    # ---- the beat, on bars
    await pg.click('[data-testid="auto-beat"] .ns-seg button:has-text("Every beat")'); await pg.click('[data-testid="auto-go-beat"]'); await pg.wait_for_selector('[data-testid="auto-done-beat"]', timeout=40000)
    nb = await E("()=>" + P + ".beats.length"); await E("()=>window.__studio.actions.undo()")
    await pg.click('[data-testid="auto-beat"] .ns-seg button:has-text("Every bar")'); await pg.click('[data-testid="auto-go-beat"]'); await pg.wait_for_timeout(300)
    await pg.wait_for_function("()=>/onto the beat/.test(document.querySelector('[data-testid=auto-done-beat]')?.textContent||'')", timeout=40000)
    nbar = await E("()=>" + P + ".beats"); await E("()=>window.__studio.actions.undo()")
    chk("Cut to the beat on every bar: a quarter of the beats on the grid, two seconds apart at 120 bpm", nb >= 20 and abs(len(nbar) - nb / 4) <= 2 and abs((nbar[2] - nbar[1]) - 2.0) < 0.1, [nb, nbar[:5]])
    # ---- check before posting
    await E("()=>{const s=window.__studio;s.actions.run('t',p=>{const tr=window.__studio.core.addTrack(p,'text',0);const c=window.__studio.core.textClip('Follow for more',1);c.transform={...c.transform,y:0.42};window.__studio.core.addClip(p,c,tr.id)})}")
    await pg.select_option('[data-testid="chk-pl"]', "tiktok"); await pg.wait_for_timeout(200)
    iss = await E("()=>[...document.querySelectorAll('[data-testid^=chk-i-]')].map(x=>x.dataset.testid.slice(6))")
    await pg.click('[data-testid="chk-hear"]'); await pg.wait_for_function("()=>/LUFS/.test(document.querySelector('[data-testid=chk-hear]').textContent)", timeout=30000)
    heard = await E("()=>document.querySelector('[data-testid=chk-hear]').textContent"); iss2 = await E("()=>[...document.querySelectorAll('[data-testid^=chk-i-]')].map(x=>x.dataset.testid.slice(6))")
    chk("Check before posting (TikTok): a wide edit is the wrong shape, the title sits under TikTok's buttons; the loudness is measured and off −14 LUFS", "aspect" in iss and "unsafe" in iss and "loud" in iss2, [iss, iss2, heard])
    await pg.click('[data-testid="chk-safe"]'); await pg.wait_for_timeout(200); safe = await E("()=>{const e=document.querySelector('[data-testid=safe243]');return e&&e.getBoundingClientRect().width>50}")
    await pg.click('[data-testid="chk-fix-safe"]'); await pg.click('[data-testid="chk-fix-loud"]'); await pg.wait_for_timeout(200); await pg.click('[data-testid="chk-fix-aspect"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="chk-hear"]'); await pg.wait_for_function("()=>/LUFS/.test(document.querySelector('[data-testid=chk-hear]').textContent)", timeout=30000)
    heard2 = await E("()=>document.querySelector('[data-testid=chk-hear]').textContent"); iss3 = await E("()=>[...document.querySelectorAll('[data-testid^=chk-i-]')].map(x=>x.dataset.testid.slice(6))")
    dims = await E("()=>[" + P + ".width," + P + ".height]"); l2 = float(re.search(r"(-?[\d.]+) LUFS", heard2).group(1))
    await pg.screenshot(path=D + "/check.png")
    chk("…each fixed with a tap: 9:16, the title moved in, the sound near −14 LUFS; the safe area drawn on the preview", safe and dims == [1080, 1920] and "unsafe" not in iss3 and "aspect" not in iss3 and abs(l2 + 14) < 1.5, [safe, dims, iss3, heard2])
    await E("()=>window.__studio.ui.set({exportOpen:true})"); await pg.wait_for_selector('[data-testid="preset-tiktok"]'); await pg.click('[data-testid="preset-tiktok"]')
    await E("()=>window.__studio.actions.run('t',p=>{p.tracks.find(t=>t.kind==='text').clips[0].transform.y=0.45})"); await pg.wait_for_timeout(200)
    ex = await E("()=>[...document.querySelectorAll('[data-testid^=exp-i-]')].map(x=>x.dataset.testid.slice(6))")
    chk("the Export dialog shows the same check for the chosen platform", "unsafe" in ex and await E("()=>!!document.querySelector('[data-testid=exp-check-more]')"), ex)
    await E("()=>window.__studio.ui.set({exportOpen:false})")
    # ---- follow the person
    if POSE:
        await fresh(pg, ["walk.webm"]); await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a);s.editor.select([])}")
        await pg.click('[data-testid="rail-auto"]'); await pg.click('[data-testid="auto-reframe"] .ns-seg button:has-text("9:16")')
        await pg.click('[data-testid="auto-go-reframe"]'); await pg.wait_for_selector('[data-testid="auto-done-reframe"]', timeout=120000)
        r = await E("()=>document.querySelector('[data-testid=auto-done-reframe]').textContent"); c = [t for t in await E(TRK) if t["k"] == "video"][-1]["c"][0]
        kx = c["kx"]; vs = [k[1] for k in kx]
        chk("Auto reframe that follows the person: 9:16, the picture moves with them from one side to the other (eased keyframes, few of them)",
            "follows the person in 1" in r and abs(c["sc"] - 3.16) < 0.02 and len(kx) >= 3 and vs[0] > 0.4 and vs[-1] < -0.4 and all(vs[i] >= vs[i + 1] - 0.05 for i in range(len(vs) - 1)) and len(kx) <= 40 and all(k[2] == "easeInOut" for k in kx), [r, c["sc"], kx])
        await pg.screenshot(path=D + "/follow.png")
    else: print("(no network for the person photo — follow-the-person skipped)")
    chk("desktop: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300)
    await pg.locator('[data-testid="rail-auto"]').scroll_into_view_if_needed(); await pg.click('[data-testid="rail-auto"]'); await pg.wait_for_selector('[data-testid="auto-panel"]')
    a = await E("()=>({smart:document.querySelector('[data-testid=auto-smart] .autot b').textContent,check:document.querySelector('[data-testid=auto-check] .autot b').textContent,page:document.documentElement.scrollWidth-innerWidth})")
    chk("phone: Smart cut and Check before posting in Arabic, nothing wider than the screen", a["smart"] == "قص ذكي بالكلمات" and a["check"] == "افحص قبل النشر" and a["page"] <= 0, a)
    await pg.screenshot(path=D + "/phone.png")
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
if fails: print("v243 FAIL\n - " + "\n - ".join(fails)); print("shots:", D); sys.exit(1)
if os.environ.get("KEEP"): print("shots:", D)
else: subprocess.run(["rm", "-rf", D])
print("v243 OK")
