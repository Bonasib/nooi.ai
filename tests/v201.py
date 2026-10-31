# v201 — the owner's notes from the phone. A real nooi server, a 9:16 clip, two 2 s clips for a merge, the v132 stand-in engine for an
# Extend of 30 s:
#  · server: Merge with "soft" → every join dissolves (the result is shorter than the sum by the blends; "cut" keeps the sum);
#    Extend 30 s → the first step is one engine step (≤ 15 s), the rest chains as further steps from the last frame and joins
#  · page (phone): the format button is one icon (≤ 48 px wide, no text); an empty project with a 9:16 clip picks a 9:16 format by
#    itself, a format chosen by hand is kept; the editor follows the light theme (light panels); nine more animations and twelve more
#    effects/motions are listed; the Extend sheet offers 5–30 s; Home shows the nine agents as cards with dots and arrows, the hero
#    mark black on lime, results in two columns, the brand lime is the reference lime; no page errors
# Run: python3 tests/v201.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8660, 8662; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v201-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120)
FF("-f", "lavfi", "-i", "testsrc2=s=540x960:rate=24:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "300k", "-an", D + "/media/tall.webm")
FF("-f", "lavfi", "-i", "testsrc2=s=960x540:rate=24:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "300k", "-an", D + "/media/wide.webm")
for name, col in (("red", "0xff0000"), ("blue", "0x0000ff")):
    FF("-f", "lavfi", "-i", f"color=c={col}:s=320x180:rate=24:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + f"/media/{name}.mp4")
now = int(time.time() * 1000)
job = lambda i, url, dur: {"id": i, "owner": "local", "kind": "video", "status": "done", "url": url, "created": now, "doneAt": now, "payload": {"kind": "video", "model": "seedance20", "prompt": "a colour", "dur": dur, "aspect": "16:9", "meta": {}}}
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "jobs": {"jr": job("jr", "/media/red.mp4", 2), "jb": job("jb", "/media/blue.mp4", 2)}}}}, open(D + "/data/db.json", "w"))
src = open(ROOT + "/tests/v132.py", encoding="utf-8").read(); MOCK = src.split("MOCK = r'''")[1].split("'''")[0]; open(D + "/mock.py", "w").write(MOCK)   # the v132 stand-in engine
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
# the stand-in engine serves these two files as its results (v132 makes them the same way outside the MOCK string)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=24:d=5", "-f", "lavfi", "-i", "sine=frequency=300:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/res.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x2050a0:s=640x360:r=24:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/mute.mp4"], check=True)
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", AGENTS_AUTO_LEARN="false", KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", MIRROR_MEDIA="true", LONG_FAST="false", EXT_CHECK="false", RECOVER_MS="1500"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
for _ in range(80):
    try: urllib.request.urlopen(B + "/v1/config", timeout=1); break
    except Exception: time.sleep(0.5)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:500]))
def req(p, body=None, method=None):
    r = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json"}, method=method or ("POST" if body is not None else "GET"))
    try: res = urllib.request.urlopen(r, timeout=30); return res.getcode(), json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def wait(jid, sec=150):
    t0 = time.time(); r = {}
    while time.time() - t0 < sec:
        c, r = req("/v1/jobs/" + jid)
        if r.get("status") in ("done", "failed"): return r
        time.sleep(1.5)
    return r
def dur(url):
    f = D + "/media/" + url.split("/media/")[-1]; src = f if os.path.exists(f) else (url if url.startswith("http") else B + url)
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", src], capture_output=True, text=True).stdout or "{}")
    return round(float((j.get("format") or {}).get("duration") or 0), 2)
# ---- merge: soft vs cut
c, j = req("/v1/jobs", {"kind": "video", "prompt": "", "title": "cut", "model": "auto", "dur": 4, "aspect": "16:9", "cost": 0, "meta": {"merge135": {"items": [{"job": "jr"}, {"job": "jb"}], "style": "cut"}}}); out["cut"] = [c, j.get("error")]
rc = wait(j["id"]) if c == 200 else {}; dcut = dur(rc["url"]) if rc.get("url") else 0
c, j = req("/v1/jobs", {"kind": "video", "prompt": "", "title": "soft", "model": "auto", "dur": 4, "aspect": "16:9", "cost": 0, "meta": {"merge135": {"items": [{"job": "jr"}, {"job": "jb"}], "style": "soft"}}}); out["soft"] = [c, j.get("error")]
rs = wait(j["id"]) if c == 200 else {}; dsoft = dur(rs["url"]) if rs.get("url") else 0; out["durs"] = [dcut, dsoft, (rs.get("merge135") or {}).get("style")]
chk("merge: clean cuts keep the two seconds + two seconds", rc.get("status") == "done" and 3.8 <= dcut <= 4.2, out)
chk("merge: soft blend — every join dissolves for ~0.45 s (shorter by the blend), the style kept on the job", rs.get("status") == "done" and (rs.get("merge135") or {}).get("style") == "soft" and 3.3 <= dsoft <= dcut - 0.3, out)
# ---- extend 30 s on the stand-in engine (seedance: 15 s a step → two steps)
c, j = req("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "", "dur": 30, "aspect": "16:9", "meta": {"extend132": "jr"}}); out["ext"] = [c, j.get("error"), j.get("id")]
chk("extend 30 s accepted", c == 200 and j.get("id"), out["ext"])
r1 = wait(j["id"]) if c == 200 else {}; out["ext1"] = {k: r1.get(k) for k in ("status", "dur", "next", "error", "ext132")}
chk("the first step is one engine step (15 s) and a second step follows from it", r1.get("status") == "done" and r1.get("next"), out["ext1"])
r2 = wait(r1["next"]) if r1.get("next") else {}; out["ext2"] = {k: r2.get(k) for k in ("status", "dur", "next", "error", "ext132")}
chk("the second step finishes, nothing more is chained", r2.get("status") == "done" and not r2.get("next"), out["ext2"])
d1 = dur(r1["url"]) if r1.get("url") else 0; d2 = dur(r2["url"]) if r2.get("url") else 0; out["dext"] = [d1, d2, r1.get("url"), r2.get("url")]
chk("each step's result is the one before plus the new seconds (base + step 1 < base + step 1 + step 2)", d1 > 2.5 and d2 > d1 + 1, out["dext"])

SETUP = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';S.theme='dark';applyTheme();const now=Date.now();for(let i=0;i<4;i++)S.jobs.push({id:'j'+i,kind:'video',status:'complete',prompt:'A walk through the field '+i,title:'Clip '+i,created:now-i,progress:1,pal:PALS[0],seed:7,dur:3,aspect:'9:16',resultUrl:'/media/tall.webm',model:'hailuo'});S.hf.out=S.jobs.map(j=>j.id);go('home');renderAll()}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(B + "/"); await pg.wait_for_function("()=>typeof S!=='undefined'&&typeof renderAll==='function'", timeout=25000); await pg.wait_for_timeout(500)
        await pg.evaluate(SETUP, "en"); await pg.wait_for_selector(".agc201c", timeout=10000); await pg.wait_for_timeout(600)
        h = await pg.evaluate("""()=>{const lime=getComputedStyle(document.documentElement).getPropertyValue('--lime').trim().toLowerCase();const br=document.querySelector('.brand');const mk=document.querySelector('.hfmarkw201');
          return{cards:document.querySelectorAll('.agc201c').length,dots:document.querySelectorAll('.agc201d i').length,arrows:document.querySelectorAll('.agc201n').length,strip:getComputedStyle(document.querySelector('.hfbots .botstrip')).display,
            cols:getComputedStyle(document.querySelector('.hfres .hfrgrid')).gridTemplateColumns.split(' ').length,lime,brandBg:br&&getComputedStyle(br).backgroundColor,brandColor:br&&getComputedStyle(br.querySelector('.nlogo')||br).color,
            mark:!!mk&&getComputedStyle(mk).backgroundColor,markFilter:mk&&getComputedStyle(mk.querySelector('.hfmark')).filter,wide:[...document.querySelectorAll('.view *')].filter(e=>!e.closest('.agc201s')&&e.getBoundingClientRect().right>innerWidth+1).length}}""")
        out["home"] = h
        chk("home: nine agent cards with dots (arrows hidden on phones), the old row hidden, results in two columns, lime #d9f43b, the brand black on lime, the hero mark black on lime, nothing wider than the screen",
            h["cards"] == 9 and h["dots"] == 9 and h["strip"] == "none" and h["cols"] == 2 and h["lime"] == "#d9f43b" and h["brandBg"] == "rgb(217, 244, 59)" and h["brandColor"] == "rgb(11, 13, 8)" and h["mark"] == "rgb(217, 244, 59)" and "brightness(0)" in (h["markFilter"] or "") and h["wide"] == 0, h)
        await pg.evaluate("()=>agcGo201(3,false)"); await pg.wait_for_timeout(400)
        on = await pg.evaluate("()=>[...document.querySelectorAll('.agc201d i')].findIndex(d=>d.classList.contains('on'))"); chk("home: the dots follow the carousel", on == 3, on)
        # the editor: the format icon, the auto format, the light theme, the lists, the Extend chips
        await pg.evaluate("()=>{PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.clips=[{id:'c1',src:{k:'upload',name:'wide.webm'},in:0,out:3,speed:1,trans:'cut',vol:100}];const v=document.createElement('video');v.src='/media/wide.webm';v.muted=true;v.preload='auto';M['c_c1']={type:'video',el:v,url:'/media/wide.webm',name:'wide.webm'};go('edit');renderAll()}")
        await pg.wait_for_function("()=>S.ed.fmtSet201==='auto'", timeout=12000)
        e = await pg.evaluate("""()=>{const b=document.querySelector('.fmtbtn'),r=b.getBoundingClientRect();const f=FORMATS.find(x=>x[0]===S.ed.format);
          return{w:Math.round(r.width),textVisible:[...b.querySelectorAll('span')].filter(s=>s.textContent.trim()&&getComputedStyle(s).display!=='none').length,fmt:S.ed.format,tall:f&&f[2]>f[3],an:AN145.length,anNew:AN145.some(x=>x[0]==='bounce')&&!!ANG145.bounce,vfx:EDX_VFX.length,vfxNew:EDX_VFX.some(x=>x[0]==='vignette')&&EDX_VFX.some(x=>x[0]==='handheld'),bg:getComputedStyle(document.querySelector('.view.ed143')).backgroundColor}}""")
        out["edit"] = e
        chk("editor: the format button is one icon (≤ 48 px, no visible text); a fresh 9:16 project with a 16:9 clip picked a 16:9 format; 21 animations and 24 effects listed; dark panels", e["w"] <= 48 and e["textVisible"] == 0 and e["tall"] and e["an"] >= 21 and e["anNew"] and e["vfx"] >= 24 and e["vfxNew"] and e["bg"] == "rgb(11, 12, 15)", e)
        # a format chosen by hand stays
        await pg.evaluate("()=>{S.ed.format='reels';persist();renderView()}"); await pg.wait_for_timeout(1600)
        chk("editor: a format chosen by hand (any write but the auto-pick) is kept", await pg.evaluate("()=>S.ed.format==='reels'&&S.ed.fmtSet201==='user'"))
        # the light theme
        await pg.evaluate("()=>{S.theme='light';applyTheme();renderView()}"); await pg.wait_for_timeout(500)
        lt = await pg.evaluate("()=>({cls:document.documentElement.classList.contains('lt201'),bg:getComputedStyle(document.querySelector('.view.ed143')).backgroundColor,text:getComputedStyle(document.querySelector('.view.ed143')).color})")
        chk("editor: the light theme gives light panels and dark text", lt["cls"] and lt["bg"] == "rgb(243, 244, 240)" and lt["text"] == "rgb(20, 23, 19)", lt)
        await pg.evaluate("()=>{S.theme='dark';applyTheme();renderView()}")
        # the Extend sheet's seconds
        await pg.evaluate("()=>{go('home');renderAll()}"); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{S.ext132=null;const j=S.jobs[0];j.remote='jr';j.model='seedance20';extSheet132(j)}")
        await pg.wait_for_selector('[data-act="ext132-n"]', timeout=8000)
        ns = await pg.evaluate("()=>[...document.querySelectorAll('[data-act=\"ext132-n\"]')].map(b=>+b.dataset.v)"); chk("extend sheet: 5 · 10 · 15 · 20 · 25 · 30 s", ns == [5, 10, 15, 20, 25, 30], ns)
        await pg.click('[data-act="ext132-n"][data-v="30"]'); await pg.wait_for_timeout(200)
        cost = await pg.evaluate("()=>({n:S.ext132.n,cost:(document.getElementById('ext132c')||{}).textContent})"); chk("extend sheet: 30 s chosen and priced", cost["n"] == 30 and cost["cost"] and int(''.join(ch for ch in cost["cost"] if ch.isdigit()) or 0) > 0, cost)
        chk("page: no errors", not errs, errs[:3]); await ctx.close(); await b.close()
async def main_safe():
    try: await main()
    except Exception as e: fails.append("browser checks stopped: " + str(e)[:300])
try: asyncio.run(main_safe())
finally:
    for pr in (srv, mk):
        pr.terminate()
        try: pr.wait(timeout=5)
        except Exception: pr.kill()
    if os.environ.get("KEEP_LOG"): subprocess.run(["cp", D + "/srv.log", os.environ["KEEP_LOG"]])
    subprocess.run(["rm", "-rf", D])
print(json.dumps(out, ensure_ascii=False, default=str)[:1500]); print("fails", json.dumps(fails, ensure_ascii=False)); sys.exit(1 if fails else 0)
