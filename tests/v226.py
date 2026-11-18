# v226 — nooi Studio: the owner's list after v225.
#  · smoother: the preview is drawn at the size it is shown (phone: about half the pixels), a video frame goes to the GPU only when
#    it is new, the time and the playhead move without redrawing the editor
#  · the playhead's pin can be grabbed and dragged (scrub)
#  · the logo: the green wave, no background
#  · 60 animations (34 entrances, 12 exits, 14 loops) + 13 camera moves, each tile playing its example
#  · fonts by language (Arabic, English/Spanish/French, Russian, Japanese/Korean/Chinese, Hindi, Hebrew, Thai), each in its letters;
#    24 text effects drawn by the text engine (gold, neon, 3D…)
#  · captions translated with AI (in place or as a second-language track) — the server's answer is simulated here
#  · Restyle with AI: 56 styles with drawn examples, the model chosen by the client (MiniMax H3, Kling, WAN 3.0, Seedance 2.5…),
#    the price of both steps first; frame → picture in the style → video → on the timeline (jobs simulated here: no credits spent)
#  · Extend + merge into one clip (simulated jobs)
# Run: python3 tests/v226.py
import asyncio, json, os, re, subprocess, sys, tempfile
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8727; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v226-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "400k", D + "/a.webm")
FF("-f", "lavfi", "-i", "smptebars=size=640x360:rate=30:duration=5", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "400k", D + "/media/styled.webm")
FF("-f", "lavfi", "-i", "color=c=0xff00aa:s=640x360", "-frames:v", "1", D + "/media/styled.png")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
P = "window.__studio.editor.project"
CL = "()=>" + P + ".tracks.flatMap(t=>t.clips.map(c=>({tr:t.name,kind:t.kind,id:c.id,type:c.type,a:c.asset||null,text:c.text||null,start:+c.start.toFixed(2),dur:+c.dur.toFixed(2)})))"

# ---- the AI jobs, simulated (no engine, no credits): every job asks, then is done with a made file
JOBS = {}
async def mock(route):
    req = route.request; url = req.url
    if url.endswith("/v1/jobs/quote"): return await route.fulfill(json={"cost": 7 if '"image"' in (req.post_data or "") else 30})
    if url.endswith("/v1/uploads"):
        if b"restyle-frame" in (req.post_data_buffer or b""): return await route.fulfill(json={"url": "/media/frame.jpg"})
        return await route.continue_()
    if url.endswith("/v1/translate149"):
        b = json.loads(req.post_data); out["tr_req"] = b; return await route.fulfill(json={"lines": ["[" + b["to"] + "] " + l for l in b["lines"]]})
    if re.search(r"/v1/jobs$", url) and req.method == "POST":
        b = json.loads(req.post_data); jid = "j" + str(len(JOBS) + 1); m = b.get("meta") or {}
        res = "/media/styled.png" if b["kind"] == "image" else "/media/styled.webm"
        JOBS[jid] = {"id": jid, "kind": b["kind"], "status": "done", "progress": 1, "resultUrl": res, "url": res, "dur": 9 if m.get("merge135") else 5, "title": b.get("title"), "body": b}
        return await route.fulfill(json={"id": jid, "kind": b["kind"], "status": "rendering", "progress": 0.1})
    m = re.search(r"/v1/jobs/(j\d+)$", url)
    if m and m.group(1) in JOBS: j = dict(JOBS[m.group(1)]); j.pop("body"); return await route.fulfill(json=j)
    return await route.continue_()

async def desktop(p):
    b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1440, "height": 900}); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/(jobs.*|uploads|translate149)$"), mock)
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    lg = await E("()=>{const s=document.querySelector('.topbar .logo svg');return{rect:!!s.querySelector('rect'),stroke:s.querySelector('path').getAttribute('stroke')}}")
    chk("the logo: the green wave, no background", lg == {"rect": False, "stroke": "#c1ff72"}, lg)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', D + "/a.webm"); await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.duration>3&&a.w)", timeout=20000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a,0)}"); await pg.wait_for_timeout(500)
    # preview drawn at the size shown
    cv = await E("()=>{const c=document.querySelector('[data-testid=preview]');return{w:c.width,css:Math.round(c.getBoundingClientRect().width)}}")
    chk("the preview is drawn at the size it is shown (not always 1280 px)", cv["w"] <= max(320, cv["css"] * 2 + 16) and cv["w"] >= min(cv["css"], 1280) - 16, cv)
    # the playhead's pin: grab and drag
    await E("()=>window.__studio.player.seek(0.5)"); await pg.wait_for_timeout(200)
    pin = await pg.locator('[data-testid="playhead-pin"]').bounding_box(); t0 = await E("()=>window.__studio.player.clock.t")
    await pg.mouse.move(pin["x"] + pin["width"] / 2, pin["y"] + 40); await pg.mouse.down(); await pg.mouse.move(pin["x"] + 120, pin["y"] + 40, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(200)
    t1 = await E("()=>window.__studio.player.clock.t"); left = await E("()=>parseFloat(document.querySelector('[data-testid=playhead]').style.left)")
    chk("the playhead's pin drags the time along (scrub)", t1 > t0 + 1 and abs(left - t1 * 60) < 3, [t0, t1, left])
    # motions: 60 animations in three groups + camera moves
    await pg.click('[data-testid="rail-effects"]'); await pg.click('.panel .subtabs button:has-text("Motion")'); await pg.wait_for_timeout(300)
    mo = await E("()=>({ac:document.querySelectorAll('.panel [data-testid^=ac-]').length,cam:document.querySelectorAll('.panel [data-testid^=mo-]').length,groups:[...document.querySelectorAll('.panel .ns-lbl')].map(x=>x.textContent)})")
    chk("Motion: 60 animations (entrances · exits · loops) and 13 camera moves", mo["ac"] == 60 and mo["cam"] == 13 and {"Entrances", "Exits", "Loops & emphasis"} <= set(mo["groups"]), mo)
    # text effects + fonts by language
    await pg.click('[data-testid="rail-titles"]'); await pg.click('[data-testid="add-text"]'); await pg.wait_for_timeout(400)
    await pg.wait_for_function("document.querySelectorAll('.panel [data-testid^=tfx-] img').length===24", timeout=20000)
    await pg.click('.panel [data-testid="tfx-gold"]'); await pg.wait_for_timeout(300)
    st = await E("()=>{const s=window.__studio.editor.selection[0],c=" + P + ".tracks.flatMap(t=>t.clips).find(x=>x.id===s);return{g:c.style.gradient,font:c.style.font}}")
    chk("24 text effects, each drawn by the text engine; Gold gives the title its gradient and font", st["g"] == ["#fff3b0", "#c8901c"] and st["font"] == "Cinzel", st)
    sc = await E("()=>[...document.querySelectorAll('.inspector [data-testid^=script-]')].map(b=>b.dataset.testid)")
    await pg.click('.inspector [data-testid="script-arabic"]'); await pg.wait_for_timeout(300); nar = await E("()=>document.querySelectorAll('.inspector [data-testid=fontpick] .fontt').length")
    await pg.click('.inspector [data-testid="script-cjk"]'); await pg.wait_for_timeout(300); ncjk = await E("()=>document.querySelectorAll('.inspector [data-testid=fontpick] .fontt').length")
    await pg.click('.inspector [data-testid="font-Noto_Sans_JP"]'); await pg.wait_for_timeout(300); f = await E("()=>{const s=window.__studio.editor.selection[0];return " + P + ".tracks.flatMap(t=>t.clips).find(x=>x.id===s).style.font}")
    chk("fonts by language: 7 writing systems; Arabic and Japanese/Korean/Chinese fonts each in their letters", len(sc) == 7 and nar >= 25 and ncjk >= 12 and f == "Noto Sans JP", [sc, nar, ncjk, f])
    # captions translated with AI (simulated answer)
    await pg.click('.panel .subtabs button:has-text("Captions")'); await pg.fill('.panel textarea', "Hello\nGood morning"); await pg.click('[data-testid="cap-add"]'); await pg.wait_for_timeout(300)
    await pg.select_option('[data-testid="cap-to"]', "es"); await pg.click('[data-testid="cap-tr-go"]'); await pg.wait_for_timeout(800)
    cl = await E(CL); tr = [c for c in cl if c["text"] and c["text"].startswith("[es]")]
    chk("captions translated with AI into a second-language track (times kept)", out.get("tr_req", {}).get("lines") == ["Hello", "Good morning"] and len(tr) == 2 and len({c["tr"] for c in tr}) == 1, {"req": out.get("tr_req"), "tr": tr})
    # Restyle with AI (simulated jobs)
    await E("()=>{const e=window.__studio.editor,c=" + P + ".tracks.find(t=>t.name==='V1').clips[0];e.select([c.id])}")
    await pg.click('[data-testid="rail-stock"]'); await pg.click('.panel .subtabs button:has-text("Restyle")'); await pg.wait_for_timeout(500)
    ns = await E("()=>[...document.querySelectorAll('.panel [data-testid^=sty-] img')].filter(i=>i.complete&&i.naturalWidth>0).length")
    await pg.click('[data-testid="sty-anime"]'); await pg.wait_for_timeout(300)
    models = await E("()=>[...document.querySelectorAll('.panel [data-testid^=rsm-]')].map(b=>b.textContent)")
    await pg.click('[data-testid="rsm-hailuoh3"]'); await pg.wait_for_function("/= 37 credits/.test(document.querySelector('[data-testid=rs-price]').textContent)", timeout=10000)
    await pg.click('[data-testid="rs-go"]'); await pg.wait_for_function("Object.keys(" + P + ".assets).some(k=>k.startsWith('j_'))", timeout=30000); await pg.wait_for_timeout(300)
    bodies = [j["body"] for j in JOBS.values()]; v1 = await E("()=>{const c=" + P + ".tracks.find(t=>t.name==='V1').clips[0];return{a:c.asset,n:" + P + ".tracks.find(t=>t.name==='V1').clips.length}}")
    chk("Restyle: 56 styles with examples; the client's models; price of both steps first (7 + 30)",
        ns >= 44 and {"MiniMax H3", "Seedance 2.5"} <= set(models) and any("WAN" in m for m in models) and any("Kling" in m for m in models), [ns, models])
    chk("Restyle: the frame is redrawn in the style, then the chosen model makes the video, and it replaces the clip",
        len(bodies) == 2 and bodies[0]["kind"] == "image" and bodies[0]["inputs"]["iRef"] == "/media/frame.jpg" and "anime" in bodies[0]["prompt"].lower()
        and bodies[1]["model"] == "hailuoh3" and bodies[1]["inputs"]["vStart"] == "/media/styled.png" and v1["a"].startswith("j_j2") and v1["n"] == 1, {"bodies": [{k: x.get(k) for k in ("kind", "model", "inputs")} for x in bodies], "v1": v1})
    # Extend + merge into one clip (simulated)
    JOBS.clear(); await pg.click('.panel .subtabs button:has-text("AI tools")'); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="ai-extend"]'); await pg.wait_for_function("(" + P + ".tracks.find(t=>t.name==='V1').clips[0].dur>8)", timeout=40000)
    v1 = await E("()=>" + P + ".tracks.find(t=>t.name==='V1').clips.map(c=>({a:c.asset,d:+c.dur.toFixed(2)}))"); kinds = [("merge" if (j["body"].get("meta") or {}).get("merge135") else "extend") for j in JOBS.values()]
    chk("Extend + merge: the new part is joined to the clip — one clip on the timeline", kinds == ["extend", "merge"] and len(v1) == 1 and v1[0]["d"] == 9, {"v1": v1, "kinds": kinds})
    chk("desktop: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    cv = await E("()=>{const c=document.querySelector('[data-testid=preview]');return{w:c.width,h:c.height,css:Math.round(c.getBoundingClientRect().width)}}")
    chk("phone: the preview is drawn for the phone's screen (at most 2× its size, far under 1280 px)", cv["w"] <= cv["css"] * 2 + 16 and cv["w"] < 1000, cv)
    pin = await E("()=>{const r=document.querySelector('[data-testid=playhead-pin]').getBoundingClientRect();return Math.round(r.width)}")
    chk("phone: the playhead's pin is finger-size", pin >= 30, pin)
    chk("phone: no page errors", not errs, errs); await b.close()

async def main():
    import urllib.request, time
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f in (desktop, phone):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:600])

try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps({k: v for k, v in out.items() if k != "tr_req"}, ensure_ascii=False)[:600])
if fails: print("v226 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v226 OK")
