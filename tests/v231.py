# v231 — nooi Studio as part of the site, and the owner's list:
#  · security: /v1/assets takes only the person's own uploaded 3D file (it took any address and any kind); the AI tools take only
#    files on this server; an upload needs a file; uploads are limited per account (files an hour)
#  · the site's sections along the top of the studio (each opens that page); "Editor free in every plan" — and on the plans
#  · tablets (iPad upright and sideways) get the full editor; a phone opens the site's sections from the logo; nothing overlaps
#  · motion graphics: their own Enter / Exit (each choice plays its example), with a length
#  · the AI words: #picture (by the name it was uploaded with), @character (the site's, or one added here with a name, a photo and
#    a voice) → reference pictures + the character's look and voice in the words (the job is captured here: no credits)
#  · Replace a person (→ @character) or a voice, and Replace the background (examples or your own picture), the price first
#    (the server's answers are simulated here)
# Run: python3 tests/v231.py
import asyncio, base64, json, os, re, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8736; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v231-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "400k", D + "/a.webm")
FF("-f", "lavfi", "-i", "smptebars=size=640x360:rate=30:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "400k", D + "/media/styled.webm")
FF("-f", "lavfi", "-i", "color=c=0xff8800:s=320x320", "-frames:v", "1", D + "/girl.png")
FF("-f", "lavfi", "-i", "color=c=0x3366ff:s=200x200", "-frames:v", "1", D + "/omar.jpg")
FF("-f", "lavfi", "-i", "color=c=0x22aa44:s=640x360", "-frames:v", "1", D + "/mybg.jpg")
open(D + "/media/someone-elses.mp4", "wb").write(open(D + "/a.webm", "rb").read())   # a file on the server that isn't the tester's
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "UPLOAD_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", UPLOAD_FILES_HOUR="12"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
P = "window.__studio.editor.project"
def http(path, body=None, who=None, raw=None, ctype="application/json"):
    h = {"Content-Type": ctype} if (body is not None or raw is not None) else {}
    if who: h["X-Dev-User"] = who
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    try: r = urllib.request.urlopen(urllib.request.Request(B + path, data=data, headers=h, method="POST" if data is not None else "GET"), timeout=30); return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def upload(name, data, who=None):
    bd = "----nooi231"; body = (f"--{bd}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\nContent-Type: application/octet-stream\r\n\r\n").encode() + data + f"\r\n--{bd}--\r\n".encode()
    return http("/v1/uploads", raw=body, who=who, ctype="multipart/form-data; boundary=" + bd)

def security():
    st, up = upload("model.glb", b"glTF" + b"\0" * 64, who="alice"); mine = up.get("url", "")
    st1, r1 = http("/v1/assets", {"url": "/media/someone-elses.mp4", "kind": "video"}, who="alice")
    st2, r2 = http("/v1/assets", {"url": "/media/someone-elses.mp4", "kind": "3d"}, who="alice")
    st3, r3 = http("/v1/assets", {"url": "https://example.com/x.glb", "kind": "3d"}, who="alice")
    st4, r4 = http("/v1/assets", {"url": mine, "kind": "3d", "title": "My model"}, who="alice")
    chk("/v1/assets: another person's file, another kind or an outside address is refused; one's own uploaded 3D file is fine", st == 200 and st1 == 400 and st2 == 400 and st3 == 400 and st4 == 200 and r4.get("id"), [st, st1, st2, st3, st4, r1, r4])
    s5, r5 = http("/v1/scan136", {"src": "https://example.com/x.mp4", "lang": "en"}, who="mallory")
    s6, r6 = http("/v1/replace136/quote", {"src": "/media/../data/db.json", "changes": [{"id": "x1", "what": "the sky", "to": "a storm"}]}, who="mallory")
    s7, r7 = http("/v1/edit135/quote", {"src": "http://169.254.169.254/latest/meta-data", "from": 0, "to": 3}, who="mallory")
    chk("the AI tools take only files on this server (an outside address or a path out of the media folder is refused)", s5 == 400 and s6 == 400 and s7 == 400, [s5, r5, s6, r6, s7, r7])
    st9, up9 = upload("clip.mp4", open(D + "/a.webm", "rb").read(), who="mallory"); own = up9.get("url", "")
    s10, r10 = http("/v1/edit135/quote", {"src": own, "from": 0, "to": 3}, who="mallory")
    chk("…while the person's own upload works", st9 == 200 and s10 != 400, [st9, s10, r10])
    s11, r11 = http("/v1/uploads", raw=b"--x--\r\n", who="mallory", ctype="multipart/form-data; boundary=x")
    chk("an upload with no file is a clear 400 (not a server error)", s11 == 400, [s11, r11])
    codes = [upload(f"f{i}.txt", b"hello", who="flooder")[0] for i in range(13)]
    chk("uploads are limited per account (12 an hour here): the 13th is refused with 429", codes[:12] == [200] * 12 and codes[12] == 429, codes)

CHARS = {"chars": [{"id": "k1", "name": "Layla", "photo": "data:image/png;base64," + base64.b64encode(open(D + "/girl.png", "rb").read()).decode(), "look": "long black hair", "outfit": "green dress", "voice": {"dialect": "najdi", "gender": "female", "age": "young", "tone": "warm"}}]}
JOBS, SENT = {}, {}
async def mock(route):
    req = route.request; url = req.url
    if url.endswith("/v1/jobs/quote"): return await route.fulfill(json={"cost": 30})
    if url.endswith("/v1/replace136/quote"): SENT.setdefault("quote", []).append(json.loads(req.post_data)); return await route.fulfill(json={"total": 42, "visual": 42, "sound": 0, "ready": True})
    if url.endswith("/v1/scan136"): SENT["scan"] = json.loads(req.post_data); return await route.fulfill(json={"items": [{"id": "p1", "kind": "person", "name": "Man in a blue shirt", "en": "man in a blue shirt", "where": "centre", "thumb": None}, {"id": "o1", "kind": "object", "name": "Red cup", "thumb": None}],
        "sounds": [{"id": "s1", "kind": "speech", "from": 0.5, "to": 2.5, "words": "hello there"}], "dur": 4, "image": False, "src": SENT["scan"].get("src"), "job": None})
    if re.search(r"/v1/jobs$", url) and req.method == "POST":
        b = json.loads(req.post_data); jid = "j" + str(len(JOBS) + 1); SENT.setdefault("jobs", []).append(b)
        JOBS[jid] = {"id": jid, "kind": "video", "status": "done", "progress": 1, "resultUrl": "/media/styled.webm", "url": "/media/styled.webm", "dur": 4, "title": b.get("title")}
        return await route.fulfill(json={"id": jid, "kind": "video", "status": "rendering", "progress": 0.1})
    m = re.search(r"/v1/jobs/(j\d+)$", url)
    if m and m.group(1) in JOBS: return await route.fulfill(json=JOBS[m.group(1)])
    return await route.continue_()

def boxes_overlap(bs):
    bad = []
    for i in range(len(bs)):
        for j in range(i + 1, len(bs)):
            a, b = bs[i], bs[j]
            if a["w"] and b["w"] and a["x"] < b["x"] + b["w"] - 1 and b["x"] < a["x"] + a["w"] - 1 and a["y"] < b["y"] + b["h"] - 1 and b["y"] < a["y"] + a["h"] - 1: bad.append([a["n"], b["n"]])
    return bad
HDR = "()=>{const out=[];for(const sel of ['.sitebar','.topbar']){const el=document.querySelector(sel);if(!el)continue;for(const k of el.children){const r=k.getBoundingClientRect();if(r.width&&getComputedStyle(k).visibility!=='hidden')out.push({n:sel+' '+(k.className||k.tagName),x:r.x,y:r.y,w:r.width,h:r.height})}}return{boxes:out,over:[...document.querySelectorAll('.sitebar,.topbar')].map(e=>e.scrollWidth-e.clientWidth),page:document.documentElement.scrollWidth-innerWidth}}"

async def desktop(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); await ctx.add_init_script("try{if(!localStorage.getItem('dotai-studio-v2'))localStorage.setItem('dotai-studio-v2'," + json.dumps(json.dumps(CHARS)) + ")}catch(e){}")
    pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.route(re.compile(r".*/v1/(jobs.*|scan136|replace136/quote)$"), mock)
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    sb = await E("()=>({links:[...document.querySelectorAll('.sitebar .snav a')].map(a=>[a.textContent,a.getAttribute('href'),a.getAttribute('aria-current')]),home:document.querySelector('.sitebar [data-testid=site-home]')?.getAttribute('href')})")
    hrefs = dict((x[0].replace("New", ""), x[1]) for x in sb["links"])
    # (v251: the studio wears the site's own header — its 9 sections, Home on the logo, the plans on the credits pill)
    chk("the site's sections along the top: the site's 9, Studio is this page, each opens its page of the site", len(sb["links"]) == 9 and hrefs.get("Explore") == "/?view=explore" and hrefs.get("Characters") == "/?view=chars" and sb["home"] == "/?view=home"
        and [x for x in sb["links"] if x[2] == "page"][0][1] == "/studio/", sb)
    h = await E(HDR); ov = boxes_overlap(h["boxes"])
    chk("desktop: nothing in the two top bars overlaps or spills", not ov and max(h["over"]) <= 0 and h["page"] <= 0, {"overlap": ov, "over": h["over"]})
    # ---- media: a video and a picture called "girl"
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', [D + "/a.webm", D + "/girl.png"])
    await pg.wait_for_function("Object.values(" + P + ".assets).filter(a=>a.w).length===2", timeout=30000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets).find(a=>a.kind==='video');s.actions.addAsset(a,0)}"); await pg.wait_for_timeout(400)
    # ---- motion graphic Enter / Exit
    await pg.click('[data-testid="rail-titles"]'); await pg.click('.panel .subtabs button:has-text("Motion graphics")'); await E("()=>window.__studio.player.seek(0)"); await pg.click('[data-testid="mg-lt-bar"]'); await pg.wait_for_timeout(300)
    ex = await E("()=>({tiles:document.querySelectorAll('[data-testid=mg-animIn] .mgio-t').length,anim:getComputedStyle(document.querySelector('[data-testid=mg-animIn-pop] .mgio-x i')).animationName})")
    await pg.click('[data-testid="mg-animIn-zoom"]'); await pg.click('[data-testid="mg-animOut-fade"]'); await pg.wait_for_timeout(200)
    mg = await E("()=>{const c=" + P + ".tracks.flatMap(t=>t.clips).find(c=>c.motion);return{i:c.animIn,o:c.animOut}}")
    chk("a motion graphic's Enter / Exit: 8 choices each playing its example; picking one sets it with a length", ex["tiles"] == 8 and ex["anim"] == "io-pop" and mg["i"]["type"] == "zoom" and mg["i"]["dur"] > 0 and mg["o"]["type"] == "fade", [ex, mg])
    LIT = "()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);let n=0;for(let y=0;y<H*0.45;y+=2)for(let x=0;x<W;x+=2){const i=(y*W+x)*4;if(d[i]+d[i+1]+d[i+2]>560)n++}return n}"
    await E("()=>window.__studio.editor.run('x',p=>{for(const t of p.tracks)for(const c of t.clips){if(c.type==='media')c.opacity=0}})")   # (only the graphic in the picture)
    await E("()=>window.__studio.player.seek(2.5)"); await pg.wait_for_timeout(300); mid = await E("()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);let n=0;for(let i=0;i<d.length;i+=8)if(d[i]+d[i+1]+d[i+2]>300)n++;return n}")
    await E("()=>window.__studio.player.seek(4.93)"); await pg.wait_for_timeout(300); end = await E("()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);let n=0;for(let i=0;i<d.length;i+=8)if(d[i]+d[i+1]+d[i+2]>300)n++;return n}")
    chk("the Exit plays: the graphic fades away at its end", mid > 200 and end < mid * 0.6, [mid, end])
    await E("()=>window.__studio.editor.run('x',p=>{for(const t of p.tracks){t.clips=t.clips.filter(c=>!c.motion);for(const c of t.clips)if(c.type==='media')c.opacity=1}})")
    # ---- #picture and @character in the AI words
    await pg.click('[data-testid="rail-stock"]'); await pg.click('.panel .subtabs button:has-text("Make with AI")'); await pg.wait_for_selector('[data-testid="gen-words"]')
    w = pg.locator('[data-testid="gen-words"]'); await w.click(); await w.type("#gi"); await pg.wait_for_timeout(300)
    pop1 = await E("()=>[...document.querySelectorAll('[data-testid=mention-pop] button b')].map(b=>b.textContent)")
    await pg.keyboard.press("Enter"); await w.type("drinks tea with @La"); await pg.wait_for_timeout(300)
    pop2 = await E("()=>[...document.querySelectorAll('[data-testid=mention-pop] button')].map(b=>b.textContent)")
    await pg.keyboard.press("Enter"); await w.type("and @"); await pg.wait_for_timeout(200)
    await pg.click('[data-testid="mn-addchar"]'); await pg.fill('[data-testid="mn-name"]', "Omar"); await pg.set_input_files('[data-testid="mn-photo"]', D + "/omar.jpg"); await pg.select_option('[data-testid="mn-voice"]', "young_man")
    await pg.wait_for_function("document.querySelector('.mnph')", timeout=5000); await pg.click('[data-testid="mn-save"]'); await pg.wait_for_timeout(300)
    words = await w.input_value(); chips = await E("()=>[...document.querySelectorAll('.mnused .chip')].map(c=>c.textContent)")
    chk("# lists the project's pictures by their names, @ the characters (with their voice); picking one writes its name; a character can be added here", pop1 == ["#girl"] and any("@Layla" in x and "warm young female najdi" in x for x in pop2)
        and words.strip() == "#girl drinks tea with @Layla and @Omar" and chips == ["#girl", "@Layla", "@Omar"], [pop1, pop2, words, chips])
    await pg.wait_for_function("()=>{const b=document.querySelector('[data-testid=gen-go]');return b&&!b.disabled&&/30/.test(b.textContent)}", timeout=10000)
    await pg.click('[data-testid="gen-go"]'); await pg.wait_for_function("()=>(" + json.dumps("x") + ")&&true", timeout=1000)
    for _ in range(60):
        if SENT.get("jobs"): break
        await pg.wait_for_timeout(200)
    jb = (SENT.get("jobs") or [{}])[0]; refs = (jb.get("meta") or {}).get("refs130") or []; ins = jb.get("inputs") or {}
    out["gen"] = {"prompt": jb.get("prompt"), "refs": refs, "inputs": ins}
    chk("the job takes the named pictures as reference pictures (#girl, Layla's and Omar's photos) and says the characters' look and voice",
        jb.get("kind") == "video" and [r["tag"] for r in refs] == ["girl", "Layla", "Omar"] and all(re.match(r"^/media/\w+\.(png|jpe?g)$", ins.get(r["slot"], "")) for r in refs)
        and "#girl" in jb.get("prompt", "") and "#Layla" in jb.get("prompt", "") and "#Omar" in jb.get("prompt", "") and "long black hair, green dress" in jb.get("prompt", "") and "Omar speaks in a young man voice" in jb.get("prompt", ""), out["gen"])
    # ---- Replace a person with @Layla
    SENT.pop("jobs", None); JOBS.clear()
    await E("()=>{const s=window.__studio,c=s.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.type==='media');s.editor.select([c.id])}")
    await pg.click('.panel .subtabs button:has-text("Replace person / voice")'); await pg.click('[data-testid="rp-look"]'); await pg.wait_for_selector('[data-testid="rp-p1"]', timeout=20000)
    lst = await E("()=>({people:[...document.querySelectorAll('[data-testid=replace-panel] .rpt span:last-child')].map(s=>s.textContent)})")
    await pg.click('[data-testid="rp-p1"]'); await pg.click('[data-testid="rpc-Layla"]')
    await pg.wait_for_function("()=>/42/.test((document.querySelector('[data-testid=rp-price]')||{}).textContent||'')", timeout=15000)
    q = SENT["quote"][-1]; await pg.click('[data-testid="rp-go"]')
    await pg.wait_for_function("()=>Object.values(" + P + ".assets).some(a=>/styled/.test(a.src))&&" + P + ".tracks.flatMap(t=>t.clips).some(c=>c.type==='media'&&/styled/.test(" + P + ".assets[c.asset].src))", timeout=20000)
    jb = SENT["jobs"][0]; rq = (jb.get("meta") or {}).get("replace136") or {}
    chk("Replace a person: the clip is looked at, the person picked, @Layla chosen, the price shown, then the clip replaced", "Man in a blue shirt" in lst["people"] and "“hello there” · 0.5–2.5s" in lst["people"] and q["changes"][0]["char"]["name"] == "Layla"
        and re.match(r"^/media/\w+\.jpe?g$", q["changes"][0].get("pic", "")) and rq.get("changes", [{}])[0].get("id") == "p1" and SENT["scan"].get("src", "").startswith("/media/"), [lst, q, rq])
    # a voice
    await pg.click('[data-testid="rp-s1"]'); await pg.select_option('[data-testid="rp-voice"]', "old_man"); await pg.wait_for_timeout(600)
    qv = SENT["quote"][-1]["changes"][0]
    chk("Replace a voice: another voice for what is said", qv == {"id": "s1", "voice": "old_man"}, qv)
    # ---- the background
    SENT.pop("jobs", None); JOBS.clear(); n0 = len(SENT["quote"])
    await pg.click('.panel .subtabs button:has-text("Background")'); await pg.wait_for_selector('[data-testid="bk-panel"]')
    await pg.click('.bk .ns-seg button:has-text("AI")'); await pg.wait_for_selector('[data-testid="bg-panel"]')   # (v234: the AI background is the Background panel's "AI" choice)
    nb = await E("()=>document.querySelectorAll('[data-testid=bg-panel] .bgt').length")
    await pg.click('[data-testid="bg-market"]'); await pg.wait_for_function("()=>/42/.test((document.querySelector('[data-testid=bg-price]')||{}).textContent||'')", timeout=15000)
    qb = SENT["quote"][-1]["changes"][0]
    await pg.set_input_files('[data-testid="bg-own"] input', D + "/mybg.jpg"); await pg.wait_for_timeout(1500); qo = SENT["quote"][-1]["changes"][0]
    chk("Replace the background: 12 examples + your own; the people kept and the light matched", nb == 13 and qb["id"] == "x1" and "market street" in qb["to"] and "Relight the people" in qb["to"] and re.match(r"^/media/\w+\.jpe?g$", qo.get("pic", "")), [nb, qb, qo])
    await pg.click('[data-testid="bg-go"]'); await pg.wait_for_function("()=>true");
    for _ in range(60):
        if SENT.get("jobs"): break
        await pg.wait_for_timeout(200)
    chk("…and the change is made (the job carries the new background)", (SENT.get("jobs") or [{}])[0].get("meta", {}).get("replace136", {}).get("changes", [{}])[0].get("id") == "x1", SENT.get("jobs"))
    # ---- the plans say it
    pg2 = await ctx.new_page(); await pg2.goto(B + "/"); await pg2.wait_for_function("typeof planCards==='function'", timeout=20000)
    pl = await pg2.evaluate("()=>{const h=planCards({});return{line:(h.match(/studio231 small/g)||[]).length,banner:/free in every plan — including the free one/.test(h)}}")
    chk("the site's plans: each plan says the Studio editor is included free, and a line under them", pl["line"] >= 3 and pl["banner"], pl)
    chk("desktop: no page errors", not errs, errs); await b.close()

async def tablets(p):
    res = {}
    for name, vp in (("iPad upright", {"width": 834, "height": 1194}), ("iPad sideways", {"width": 1194, "height": 834}), ("small tablet", {"width": 768, "height": 1024}), ("tablet sideways 1024", {"width": 1024, "height": 768})):
        b = await p.chromium.launch(); ctx = await b.new_context(viewport=vp, has_touch=True); pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
        r = await pg.evaluate("()=>({mode:document.querySelector('[data-testid=studio]').className.split(' ')[1],sitebar:!!document.querySelector('.sitebar'),menu:!!document.querySelector('[data-testid=site-menu]'),rail:!!document.querySelector('.workspace .rail'),timeline:!!document.querySelector('.timeline'),insp:!!document.querySelector('.inspector'),page:document.documentElement.scrollWidth-innerWidth})")
        h = await pg.evaluate(HDR); r["overlap"] = boxes_overlap(h["boxes"]); r["spill"] = max(h["over"]); r["errs"] = errs; res[name] = r; await b.close()
    out["tablets"] = res
    chk("tablets get the full editor (the site's sections — a bar, or the logo's menu on a short screen — rail, preview, timeline, settings), nothing overlapping or wider than the screen", all(r["mode"] == "full" and r["sitebar"] and r["rail"] and r["timeline"] and r["insp"] and r["page"] <= 0 and not r["overlap"] and r["spill"] <= 0 and not r["errs"] for n, r in res.items()), res)

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300); await pg.click('[data-testid="site-menu"]'); await pg.wait_for_timeout(200)
    m = await E("()=>({n:document.querySelectorAll('.smenu-list a').length,first:document.querySelector('.smenu-list a').textContent,free:document.querySelector('.smenu-list .sfree').textContent,bar:!!document.querySelector('.sitebar'),page:document.documentElement.scrollWidth-innerWidth,inview:(()=>{const r=document.querySelector('.smenu-list').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&[...document.querySelectorAll('.smenu-list a')].every(a=>{const q=a.getBoundingClientRect(),e=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return e&&a.contains(e)})})()})")
    chk("phone (Arabic): the logo opens the site's sections (and the free-editor line), inside the screen", m["n"] == 12 and m["first"] == "الرئيسية" and m["free"] == "المحرر مجاني في كل الباقات" and m["bar"] and m["page"] <= 0 and m["inview"], m)
    chk("phone: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    try: security()
    except Exception as e: chk("security crashed", False, repr(e)[:500])
    async with async_playwright() as p:
        for f in (desktop, tablets, phone):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps(out, ensure_ascii=False)[:1500])
if fails: print("v231 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v231 OK")
