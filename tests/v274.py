# v274 — the cast at work: a 15-second talking example video for every ready character. A real nooi server, stand-in ByteDance,
# MiniMax and voice engines, and a browser:
#  · 30 examples, one per cast member, each a job (shops, restaurants, tourism, a factory, an office, an actor, a teacher, football,
#    diving, a crime-series villain, a hacker, news, radio, a journalist, a scientist, a doctor…) with the line in their own language
#    and its meaning in English and Arabic; the children have family-friendly roles; the public words carry no picture names
#  · nothing is made without the owner's confirm (409, no engine call); the older showcase group doesn't start them
#  · Admin: the box says how many, how long and on which engine before anything starts (Seedance 2.0 or MiniMax H3)
#  · Seedance 2.0: 30 jobs on the owner's ByteDance key, 15 s, with sound, the face (and sheet) as reference pictures, the spoken
#    line in the person's language in the words; staff jobs take no nooi credits
#  · MiniMax H3 (one made again): one 15 s shot with sound, the reference pictures and the person's own voice as reference audio
#  · the character's window shows the example video (not muted), the job and the line; "Make one like it" fills nooi Studio with the
#    character — nothing is made; a card with an example has a play mark; Explore lists the made examples; no sideways scroll on a phone
# Run: python3 tests/v274.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8819, 8820; B = f"http://localhost:{PORT}"; M = f"http://127.0.0.1:{MP}"
D = tempfile.mkdtemp(prefix="nooi-v274-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=360x640:r=24:d=3", "-f", "lavfi", "-i", "sine=f=440:d=3", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", D + "/res.mp4"], check=True, timeout=90, stdin=subprocess.DEVNULL)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=330:d=3", "-c:a", "libmp3lame", "-b:a", "64k", D + "/hi.mp3"], check=True, timeout=60, stdin=subprocess.DEVNULL)
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
ST = {"bp": [], "mm": [], "tts": []}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200, ct="application/json"):
        b = o if isinstance(o, bytes) else json.dumps(o).encode(); self.send_response(code); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/res.mp4": return self.send(open(D + "/res.mp4", "rb").read(), ct="video/mp4")
        if self.path.startswith("/v2/query/video_generation/"): return self.send({"task": {"id": self.path.split("/")[-1], "model": "MiniMax-H3", "status": "succeeded", "content": {"url": M + "/res.mp4"}}})
        if self.path.startswith("/api/v3/contents/generations/tasks/"): return self.send({"status": "succeeded", "content": {"video_url": M + "/res.mp4"}})
        return self.send({}, 404)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); b = json.loads(self.rfile.read(n) or b"{}")
        if self.path == "/api/v3/contents/generations/tasks": ST["bp"].append(b); return self.send({"id": "cgt-%d" % len(ST["bp"])})
        if self.path == "/v2/video_generation": ST["mm"].append(b); return self.send({"task_id": "h3-%d" % len(ST["mm"])})
        if self.path.startswith("/v1/text-to-speech/"): ST["tts"].append(b.get("text", "")); return self.send(open(D + "/hi.mp3", "rb").read(), ct="audio/mpeg")
        return self.send({}, 404)
mk = ThreadingHTTPServer(("127.0.0.1", MP), H); threading.Thread(target=mk.serve_forever, daemon=True).start()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "ADMIN_EMAILS", "SEEDANCE_", "ELEVEN", "SWAP_", "LOCAL_LLM", "GEMMA_", "DASHSCOPE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", MIRROR_MEDIA="false", AGENTS_AUTO_LEARN="false",
    SEEDANCE_API_KEY="bd-test-key", SEEDANCE_BASE_URL=M + "/api/v3", ELEVENLABS_API_KEY="el-test", ELEVENLABS_BASE_URL=M, ADMIN_EMAILS="boss@dev.local"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1500]))
def req(path, body=None, who="boss", method=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": who}, method=method or ("POST" if body is not None else "GET"))
    try: return json.loads(urllib.request.urlopen(r, timeout=120).read())
    except urllib.error.HTTPError as e: return {"status": e.code, **json.loads(e.read() or b"{}")}
def demos(who="someone"): return [s for s in req("/v1/showcase", who=who).get("items", []) if s["cat"] == "castdemo"]
def text(b): return " ".join(x.get("text", "") for x in b.get("content", []) if x.get("type") == "text")
def roles(b, r): return [x for x in b.get("content", []) if x.get("role") == r]
SETUP = "(v)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go(v);renderAll()}"
async def admin(p):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900}, extra_http_headers={"X-Dev-User": "boss"})).new_page(); E = pg.evaluate; errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_timeout(1800); await E(SETUP, "home"); await E("()=>{S.admTab='models';go('admin')}")
    try: await pg.wait_for_selector('[data-act="cd274-ask"]', timeout=20000)
    except Exception: chk("Admin shows the cast examples box", False, await E("()=>[S.view,S.admTab,!!document.querySelector('.scadm')]")); await b.close(); return
    t0 = await E("()=>document.querySelector('.cdadm274 .row [data-act=\"cd274-ask\"]').textContent"); n0 = len(ST["bp"]) + len(ST["mm"])
    gen = await E("()=>[...document.querySelectorAll('.scadm .sclist .scrow b')].map(x=>x.textContent)")
    chk("Admin: the general showcase list leaves the cast examples to their own box (30 chips)", "Specialty coffee shop owner" not in gen and await E("()=>document.querySelectorAll('.cdadm274 .cdc274').length") == 30, gen[:5])
    await pg.click('.cdadm274 .row [data-act="cd274-ask"]'); await pg.wait_for_timeout(400)
    a1 = await E("()=>(document.querySelector('.cdadm274 [role=alert]')||{}).textContent||''")
    await pg.select_option('[data-cd274m]', "hailuo"); await pg.wait_for_timeout(300)
    a2 = await E("()=>(document.querySelector('.cdadm274 [role=alert]')||{}).textContent||''")
    await pg.click('[data-act="cd274-no"]'); await pg.wait_for_timeout(300)
    gone = await E("()=>!document.querySelector('.cdadm274 [role=alert]')")
    chk("Admin: the button says how many, how long and on which engine (30 × 15 s = 450 s, Seedance 2.0 or MiniMax H3) and nothing starts until Yes", "(30)" in t0 and "30 videos × 15 seconds" in a1 and "450 seconds of Seedance 2.0" in a1 and "MiniMax H3" in a2 and gone and len(ST["bp"]) + len(ST["mm"]) == n0, [t0, a1, a2, gone])
    chk("Admin page: no errors", not errs, errs); await b.close()
async def window(p, phone=False):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1440, "height": 900}, extra_http_headers={"X-Dev-User": "someone"}); pg = await ctx.new_page(); E = pg.evaluate; errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_timeout(1800); await E(SETUP, "chars")
    await pg.wait_for_function("typeof SC!=='undefined'&&SC.items&&SC.items.some(s=>s.cat==='castdemo'&&s.url)&&document.querySelector('#main .cc273')", timeout=20000); await E("()=>renderView()"); await pg.wait_for_timeout(400)
    marks = await E("()=>document.querySelectorAll('#main .cc273 .vid274').length")
    await pg.click('#main .cc273[data-cast273="cast-omar"]'); await pg.wait_for_timeout(700)
    w = await E("()=>{const v=document.querySelector('.cs273 .cd274 video');return{video:!!v,src:v&&v.getAttribute('src'),muted:v?v.muted||v.hasAttribute('muted'):null,role:(document.querySelector('.cs273 .cd274 h3')||{}).textContent,line:(document.querySelector('.cs273 .cd274l')||{}).textContent,mean:(document.querySelector('.cs273 .cd274t .mute')||{}).textContent,side:document.documentElement.scrollWidth-innerWidth,sheet:(document.querySelector('.cs273')||{scrollWidth:0,clientWidth:0})}}")
    if os.environ.get("SHOT"):   # (pictures of the window and the cards, when asked)
        await E("()=>{const s=document.querySelector('.cs273 .cd274');if(s)s.scrollIntoView({block:'center'})}"); await pg.wait_for_timeout(300); await pg.screenshot(path=os.environ["SHOT"] + ("-phone" if phone else "") + ".png")
    chk(("phone: " if phone else "") + "the window shows the example video (sound on), the job, the line in Arabic and its meaning", w["video"] and w["src"] and w["muted"] is False and w["role"] == "Specialty coffee shop owner" and "هلا والله" in (w["line"] or "") and "Every cup here is roasted" in (w["mean"] or "") and w["side"] <= 0, w)
    if not phone:
        chk("a card with a made example has a play mark (all 30), clear of the Child badge", marks == 30 and await E("()=>[...document.querySelectorAll('#main .cc273')].every(c=>{const k=c.querySelector('.kid273'),v=c.querySelector('.vid274');if(!k||!v)return true;const a=k.getBoundingClientRect(),b=v.getBoundingClientRect();return a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top})"), marks)
        n0 = len(ST["bp"]) + len(ST["mm"]); await pg.click('.cs273 [data-act="cast273-like"]'); await pg.wait_for_timeout(700)
        st = await E("()=>({view:S.view,p:S.draft.prompt,audio:S.draft.audio,aspect:S.draft.aspect,mine:S.chars.some(c=>c.cast273==='cast-omar')})")
        chk("Make one like it: nooi Studio with @Omar and the example's words, sound on, 9:16 — nothing is made", st["view"] == "video" and st["p"].startswith("@Omar — ") and "coffee shop" in st["p"] and "#face" not in st["p"] and st["audio"] is True and st["aspect"] == "9:16" and st["mine"] and len(ST["bp"]) + len(ST["mm"]) == n0, st)
        await E(SETUP, "chars"); await pg.wait_for_timeout(500)
        if os.environ.get("SHOT"): await pg.screenshot(path=os.environ["SHOT"] + "-cards.png")
        await pg.click('#main .cc273[data-cast273="cast-leo"]'); await pg.wait_for_timeout(600)
        k = await E("()=>({role:(document.querySelector('.cs273 .cd274 h3')||{}).textContent,line:(document.querySelector('.cs273 .cd274l')||{}).textContent})")
        chk("a child's example: a family-friendly job (the science fair)", k["role"] == "Young scientist at a science fair" and "volcano" in (k["line"] or ""), k)
        xp = await E("()=>xpExamples().filter(x=>x.cat==='castdemo'&&x.url).length")
        chk("Explore lists the made examples", xp == 30, xp)
    chk(("phone " if phone else "") + "page: no errors", not errs, errs); await b.close()
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    d0 = demos(); kids = [s for s in d0 if s["kid"]]
    chk("30 examples, one per cast member, 15 s each, the line in their language with its meaning, none made yet",
        len(d0) == 30 and len({s["cast"] for s in d0}) == 30 and all(s["dur"] == 15 and s["line"][0] and s["line"][1] and s["line"][2] and s["role"][0] and s["role"][1] and not s["url"] for s in d0), len(d0))
    jobs = " | ".join(s["role"][0] for s in d0).lower()
    chk("the jobs the owner listed are there", all(w in jobs for w in ("coffee shop", "restaurant", "travel guide", "factory", "office", "actress", "teacher", "football", "diver", "dealer", "hacker", "news anchor", "radio host", "journalist", "scientist", "doctor")), jobs)
    chk("children: 7, family-friendly roles only; crime roles are adults", len(kids) == 7 and not any(w in " ".join(s["role"][0] for s in kids).lower() for w in ("villain", "dealer", "hacker", "crime")), [s["role"][0] for s in kids])
    chk("the public words carry no picture names", not any("#face" in s["prompt"][0] or "#sheet" in s["prompt"][0] for s in d0))
    r = req("/v1/admin/showcase", {"group": "castdemo"}); time.sleep(1)
    chk("nothing is made without the owner's confirm (409, no engine call)", r.get("status") == 409 and r.get("confirm") is True and not ST["bp"] and not ST["mm"], r)
    r = req("/v1/admin/showcase", {"group": "castdemo", "sure": True}, who="someone")
    chk("customers can't start them", r.get("status") == 403 and not ST["bp"], r)
    req("/v1/admin/showcase", {"group": "showcase"}); time.sleep(1)
    chk("the older showcase group doesn't start the cast examples", not any("lips in sync" in text(b) for b in ST["bp"]), len(ST["bp"]))
    async with async_playwright() as p:
        await admin(p)
        n0 = len(ST["bp"]); r = req("/v1/admin/showcase", {"group": "castdemo", "model": "seedance20", "sure": True}); time.sleep(2)
        cd = [b for b in ST["bp"][n0:] if "lips in sync" in text(b)]
        om = next((b for b in cd if "هلا والله" in text(b)), {}); yz = next((b for b in cd if "شوفوا شو وصلني" in text(b)), {})
        chk("Seedance 2.0: 30 jobs on the owner's ByteDance key, 15 s, with sound, the face (and sheet) as reference pictures, the line in the person's language",
            len(cd) == 30 and all(str(b.get("model", "")).startswith("dreamina-seedance-2-0") and b.get("duration") == 15 and b.get("generate_audio") is True and roles(b, "reference_image") and not roles(b, "first_frame") for b in cd)
            and len(roles(om, "reference_image")) == 2 and len(roles(yz, "reference_image")) == 1 and om.get("ratio") == "9:16" and "@Image1" in text(om) and "#face" not in text(om) and "Saudi Najdi Arabic" in text(om),
            {"n": len(cd), "om": {k: v for k, v in om.items() if k != "content"}, "omt": text(om)[:900], "refs": [len(roles(b, "reference_image")) for b in cd][:8]})
        chk("a scene that is spoken to someone off camera says so; Turkish is the language", any("Bu şehirde" in text(b) and "Turkish" in text(b) and "just off camera" in text(b) for b in cd))
        for _ in range(150):
            st = [x for x in req("/v1/admin/showcase").get("items", []) if x["cat"] == "castdemo"]
            if all(x["status"] == "done" for x in st): break
            time.sleep(1)
        pub = demos(); bill = req("/v1/billing")
        chk("the examples are made and public with their video and engine; staff jobs took no nooi credits", len(pub) == 30 and all(s["url"] and s["made"] == "seedance20" for s in pub) and not any((x.get("delta") or 0) < 0 for x in bill.get("ledger", [])),
            {"made": sum(1 for s in pub if s["url"]), "err": [x.get("error") for x in st if x.get("error")][:2]})
        vs = req("/v1/voice/sample", {"cast": "cast-omar"}, who="someone")   # (Omar's voice sample, as "Hear the voice" makes it — before MiniMax also speaks)
        chk("Omar's voice sample is made by the voice engine", str(vs.get("url", "")).startswith("/media/") and ST["tts"], vs)
        r = req("/v1/admin/providers/minimax", {"apiKey": "mm-key", "baseUrl": M}, method="PUT")
        m0 = len(ST["mm"]); r = req("/v1/admin/showcase", {"ids": ["cd-omar"], "force": True, "model": "hailuo", "sure": True}); time.sleep(2)
        h3 = ST["mm"][m0:]; h = h3[0] if h3 else {}
        aud = roles(h, "reference_audio")
        chk("MiniMax H3: one 15 s shot with sound, the face and sheet as reference pictures and the person's own voice as reference audio — no frame",
            len(h3) == 1 and h.get("model") == "MiniMax-H3" and h.get("duration") == 15 and h.get("ratio") == "9:16" and len(roles(h, "reference_image")) == 2 and not roles(h, "first_frame") and len(aud) == 1
            and str(aud[0].get("audio_url", {}).get("url", "")).startswith("data:audio/mp3;base64,") and "reference image 1" in text(h) and "reference audio 1" in text(h) and "#face" not in text(h) and "هلا والله" in text(h),
            {"n": len(h3), "h": {k: v for k, v in h.items() if k != "content"}, "roles": [x.get("role") for x in h.get("content", [])], "t": text(h)[-500:], "srv": [x for x in req("/v1/admin/showcase").get("items", []) if x["id"] == "cd-omar"]})
        for _ in range(60):
            o = next((x for x in req("/v1/admin/showcase").get("items", []) if x["id"] == "cd-omar"), {})
            if o.get("status") == "done": break
            time.sleep(1)
        chk("the H3 example replaces the Seedance one (engine saved)", o.get("status") == "done" and o.get("made") == "hailuo", o)
        await window(p); await window(p, phone=True)
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:900])
finally: srv.terminate(); mk.shutdown()
if fails: print("v274 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-2500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v274 OK")
