# v154 "improve the face and body tracking — only the first frames got the new person, the rest wasn't tracked + make the features
# more realistic + the look isn't good + errors to fix + many problems in the editor and the video". A real nooi server, a stand-in
# engine that records every request (and can fail the tracking engine), a stand-in text AI, and the page on a phone:
#  · the new person's face up close is cut from the photo and sent as one more reference (@Image2 / the last picture); a photo that is
#    already a close-up adds nothing; the words ask for the new person from the first frame to the last and a real face (skin, grain)
#  · the result is looked at (four frames): the old person back → made once more on Wan 2.2 Animate Replace (frame-by-frame tracking),
#    the customer charged once; the remake failing → the first result with a note (en / ar); the new person held, the text AI not sure,
#    a person picked among several, the check off, or the swap already on Wan → no remake
#  · Admin → Speed: the check on / off (owners / admins only), Wan 2.2 Animate as an engine
#  · the page: the remake's stage text, the note on the card, a phone video in its own shape (the card and the gallery), the Replace
#    page on a phone (the button on a solid bar, a short empty preview), the editor's top bar (the name keeps room, nothing off the edge,
#    English and Arabic), a tab row that goes past the edge fades there
# Run: python3 tests/v154.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, hashlib
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8451, 8452
D = tempfile.mkdtemp(prefix="nooi-v154-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "u" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 30000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(D + "/data/db.json", "w"))
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=10:d=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=5", "-vf", "drawbox=x=80:y=60:w=120:h=280:color=0x2040e0:t=fill",
   "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/clip.mp4")
ff("-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4")
ff("-f", "lavfi", "-i", "testsrc2=size=360x640:rate=30:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", D + "/media/tall.webm")
im = Image.new("RGB", (512, 768), (240, 220, 200)); ImageDraw.Draw(im).ellipse([180, 80, 330, 260], fill=(200, 150, 120)); im.save(D + "/media/char.png")
im = Image.new("RGB", (640, 360), (128, 128, 128)); ImageDraw.Draw(im).rectangle([80, 60, 200, 340], fill=(32, 64, 224)); im.save(D + "/media/frame.png")
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": [], "mode": "held", "face": "small", "wanfail": False, "holdImages": []}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.mp4":
            b = open(DIR + "/res.mp4", "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        tid = (q.get("taskId") or [""])[0]; i = int(tid[1:]) - 1 if tid[1:].isdigit() else -1
        model = st["reqs"][i]["body"].get("model", "") if 0 <= i < len(st["reqs"]) else ""
        if st["wanfail"] and model.startswith("wan/"): return self.send({"code": 200, "data": {"state": "fail", "failMsg": "the engine could not make it"}})
        url = f"http://localhost:{P}/res.mp4"; return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [url]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path == "/mode": st.update(j); return self.send(st)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text"); imgs = sum(1 for p in parts if p.get("type") == "image")
            if "You check the two inputs" in text:
                st["llm"].append("look"); o = {"photo_people": 1, "video_people": 1, "video_person": "clear", "note_en": "", "note_ar": "", "keep_en": "", "sure": True,
                     "scene_en": "a bright kitchen", "light_en": "soft daylight", "moves_en": "walks and waves", "eyes_en": "looks at the camera"}
            elif "Find the face of the person in this photo" in text:
                st["llm"].append("face"); o = {"face": [0.35, 0.1, 0.65, 0.34], "sure": True} if st["face"] == "small" else {"face": [0.05, 0.03, 0.95, 0.97], "sure": True}
            elif "You check a video in which one person had to be replaced" in text:
                st["llm"].append("hold"); st["holdImages"].append(imgs)
                o = {"frames": ["new", "new", "new", "new"], "sure": True} if st["mode"] == "held" else {"frames": ["new", "old", "old", "old"], "sure": st["mode"] != "unsure"}
            elif "A red box marks one person" in text: st["llm"].append("pick"); o = {"box": [0.12, 0.16, 0.32, 0.95], "who_en": "the person in blue"}
            elif "the person to replace in a video" in text: st["llm"].append("part"); o = {"people": 1, "present": "yes", "where_en": "the person in blue on the left", "who_en": "the person in blue", "sure": True}
            else: st["llm"].append("other"); o = {}
            return self.send({"content": [{"type": "text", "text": json.dumps(o)}]})
        st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "data": {"taskId": "t%d" % len(st["reqs"])}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, tok=None, port=PORT):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
stats = lambda: json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
reqs = lambda: stats()["reqs"]
mode = lambda **k: api("/mode", k, port=KPORT)
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
SW = lambda cid, **inp: {"kind": "video", "model": "mcswap", "prompt": "", "dur": 5, "aspect": "16:9", "cid": cid, "inputs": {"mcMove": "/media/clip.mp4", "mcChar": "/media/char.png", **inp}, "meta": {"motion83": True, "swap93": True, "consent": True, **({"whoTap": [0.22, 0.5]} if inp.get("mcWho") else {})}}
def charged(jid):
    time.sleep(1.5); db = json.load(open(D + "/data/db.json")); return -sum(x.get("delta", 0) for x in db["users"]["cust"]["ledger"] if x.get("ref") == jid)
def swap(cid, tok=None, **inp):
    n, s0 = len(reqs()), stats(); j = api("/v1/jobs", SW(cid, **inp), tok); seen = set()
    def poll():
        x = api("/v1/jobs/" + j.get("id", "x"), None, tok); seen.update(k for k in ("remade154",) if x.get(k)); [seen.add("stage:" + str(x.get("stage"))) for _ in [0] if x.get("stage")]
        return x if x.get("status") in ("done", "failed") else None
    d = wait(poll, 150) or {}; s1 = stats()
    return d, [x["body"] for x in s1["reqs"][n:]], s1["llm"][len(s0["llm"]):], j.get("id"), seen

def server_checks():
    sp = api("/v1/admin/speed"); ok(sp.get("hold154") is True, f"the end-to-end check is on by default {sp.get('hold154')}")
    # 1. the new person held: the face up close goes with the photo, the words, one engine request
    mode(mode="held", face="small", wanfail=False)
    d, bs, llm, jid, seen = swap("h1", TOKEN); i = (bs[0] if bs else {}).get("input") or {}; pr = i.get("prompt", ""); refs = i.get("reference_image_urls") or []
    out["held"] = {"status": d.get("status"), "reqs": [b.get("model") for b in bs], "refs": refs, "llm": llm}
    ok(d.get("status") == "done" and len(bs) == 1 and bs[0].get("model") == "bytedance/seedance-2-fast", f"a swap that held: made once {out['held']}")
    face = refs[-1] if len(refs) == 2 else ""; fp = D + "/media/" + face.rsplit("/", 1)[-1]
    ok(face.endswith("-face.jpg") and os.path.exists(fp) and Image.open(fp).size == (640, 640), f"the new person's face up close is the second picture (640×640) {refs}")
    ok("@Image2 is the same new person's face up close" in pr and "From the very first frame to the very last frame the replaced person is the new person" in pr and "The person being replaced never appears again" in pr
       and "natural skin with fine texture and pores" in pr and "same sharpness, grain and noise as the rest of @Video1" in pr, f"the words: the face up close, every frame to the last, a real face {pr}")
    ok(llm.count("hold") == 1 and "remade154" not in seen and not d.get("note154"), f"the result looked at once, nothing made again {llm} {seen}")
    hi = stats()["holdImages"]; ok(hi and hi[-1] == 6, f"the check sees the new photo, the person replaced and four frames of the result {hi}")
    c_one = charged(jid); out["charged_one"] = c_one; ok(c_one > 0, f"the customer is charged for a swap {c_one}")
    # 2. the old person came back → made again on Wan 2.2 Animate Replace, charged once
    mode(mode="drift")
    d, bs, llm, jid, seen = swap("d1", TOKEN); out["drift"] = {"status": d.get("status"), "reqs": [b.get("model") for b in bs], "llm": llm, "seen": sorted(seen), "url": d.get("url")}
    w = (bs[1] if len(bs) > 1 else {}).get("input") or {}
    ok(d.get("status") == "done" and [b.get("model") for b in bs] == ["bytedance/seedance-2-fast", "wan/2-2-animate-replace"], f"the old person came back → made again on Wan 2.2 Animate Replace {out['drift']}")
    ok(str(w.get("video_url", "")).startswith("http") and str(w.get("image_url", "")).startswith("http") and w.get("resolution") == "720p", f"…with the client's video and the new person's photo {w}")
    ok(llm.count("hold") == 1 and d.get("remade154") is True and not d.get("note154"), f"…looked at once (the remake isn't looked at again), the card knows it was made again {llm} {d.get('remade154')}")
    ok(charged(jid) == c_one, f"…the customer charged once {charged(jid)} vs {c_one}")
    # 3. the remake fails → the first result, with a note
    mode(mode="drift", wanfail=True)
    d, bs, llm, jid, seen = swap("f1", TOKEN); out["wanfail"] = {"status": d.get("status"), "reqs": [b.get("model") for b in bs], "note": d.get("note154"), "seen": sorted(seen)}
    n = d.get("note154") or {}
    ok(d.get("status") == "done" and len(bs) == 2 and d.get("url") and "remade154" in seen and not d.get("remade154"), f"the remake failed → the first result is the video {out['wanfail']}")
    ok("here is the first result" in n.get("en", "") and "هذه النتيجة الأولى" in n.get("ar", ""), f"…with a note in English and Arabic {n}")
    ok(charged(jid) == c_one, f"…charged once {charged(jid)}")
    mode(wanfail=False)
    # 4. not sure / a picked person / a close-up photo → no remake (and no face picture for a close-up)
    mode(mode="unsure"); d, bs, llm, jid, seen = swap("u1")
    ok(d.get("status") == "done" and len(bs) == 1, f"the text AI not sure → the result stays {[b.get('model') for b in bs]}")
    mode(mode="drift", face="big"); d, bs, llm, jid, seen = swap("p1", mcWho="/media/frame.png"); i = (bs[0] if bs else {}).get("input") or {}
    out["picked"] = {"reqs": [b.get("model") for b in bs], "refs": i.get("reference_image_urls")}
    ok(d.get("status") == "done" and len(bs) == 1 and len(i.get("reference_image_urls") or []) == 2 and "face up close" not in i.get("prompt", ""), f"a person picked among several → no remake; a close-up photo → no face picture {out['picked']}")
    # 5. the switch: owners / admins only; off → not looked at
    no = api("/v1/admin/speed/hold154", {"on": False}, TOKEN); r = api("/v1/admin/speed/hold154", {"on": False})
    ok(no.get("_status") in (401, 403) and r.get("hold154") is False and api("/v1/admin/speed").get("hold154") is False, f"the switch: owners / admins only {no} {r}")
    mode(mode="drift", face="small"); d, bs, llm, jid, seen = swap("o1")
    ok(d.get("status") == "done" and len(bs) == 1 and "hold" not in llm, f"the check off → not looked at, not made again {llm}")
    api("/v1/admin/speed/hold154", {"on": True})
    # 6. Wan 2.2 Animate as the engine: no second Wan
    r = api("/v1/admin/speed/swapengine", {"engine": "wan"}); d, bs, llm, jid, seen = swap("w1")
    ok(r.get("swapEngine") == "wan" and d.get("status") == "done" and [b.get("model") for b in bs] == ["wan/2-2-animate-replace"], f"Wan 2.2 Animate picked in Admin: the swap runs on it, once {r} {[b.get('model') for b in bs]}")
    api("/v1/admin/speed/swapengine", {"engine": "seedancefast"})

SETUP_ED = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.cloud149=false;
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.format='tiktok';
 const v=await (await fetch('/media/tall.webm')).blob();edAddFiles([new File([v],'beach.webm',{type:'video/webm'})]);S.ed.tab='media';edSetPick(null);go('edit');renderAll()}"""
async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.view='admin';S.admTab='overview';renderAll()}")
        t = None
        for _ in range(60):
            t = await E("()=>{const r=document.querySelector('.hold154');return r?r.textContent:null}")
            if t: break
            await asyncio.sleep(.25)
        on = lambda v: E(f"()=>document.querySelector('[data-act=hold154][data-on=\"{v}\"]')?.getAttribute('aria-pressed')==='true'")
        ok(t and "stays to the end" in t and "Wan 2.2 Animate" in t and await on("true") and await E("()=>!!document.querySelector('[data-act=sw114][data-eng=\"wan\"]')"), f"Admin → Speed: the check (on) and Wan 2.2 Animate as an engine {t}")
        await pg.click('[data-act=hold154][data-on="false"]'); await pg.wait_for_timeout(1200)
        ok(await on("false") and api("/v1/admin/speed").get("hold154") is False, "one tap turns the check off")
        await pg.click('[data-act=hold154][data-on="true"]'); await pg.wait_for_timeout(1200)
        ok(api("/v1/admin/speed").get("hold154") is True, "…and on again")
        await E("()=>{S.lang='ar';renderAll()}"); await pg.wait_for_timeout(600)
        ta = await E("()=>document.querySelector('.hold154')?.textContent||''"); ok("يبقى الشخص الجديد حتى النهاية" in ta, f"…in Arabic {ta}")
        # the card: the stage texts, the note, the video's own shape
        st = await E("""()=>{S.lang='en';const mk=(o)=>Object.assign({id:'x'+Math.random().toString(36).slice(2,7),kind:'video',model:'mcswap',prompt:'',title:'Swap',dur:5,aspect:'16:9',cost:10,created:Date.now(),meta:{motion83:true,swap93:true}},o);
          const a=mk({status:'rendering',stage:'check154'}),b=mk({status:'rendering',stage:'engine',remade154:true});return [stage108(a),stage108(b)]}""")
        ok("Checking the new person stays to the end" in st[0] and "the engine follows the person frame by frame" in st[1], f"the stage texts {st}")
        await E("""()=>{S.jobs.push({id:'t154',kind:'video',model:'mcswap',prompt:'',title:'Swap · me',dur:4,aspect:'16:9',cost:10,status:'complete',progress:1,resultUrl:'/media/tall.webm',created:Date.now(),meta:{motion83:true,swap93:true},
          note154:{en:'The new person didn\\'t stay to the end — here is the first result.',ar:'هذه النتيجة الأولى.'}});go('motion');renderAll()}""")
        r = None
        for _ in range(40):
            r = await E("()=>{const s=document.querySelector('.preview-col .stage');const j=S.jobs.find(x=>x.id==='t154');if(!s||!j.ar154)return null;const q=s.getBoundingClientRect();return {w:q.width,h:q.height,ar:j.ar154,note:document.querySelector('.note154')?.textContent||''}}")
            if r: break
            await asyncio.sleep(.25)
        ok(r and r["ar"] == [360, 640] and abs(r["w"] / r["h"] - 360 / 640) < 0.03 and "first result" in r["note"], f"the result card: the note, and a phone video in its own shape (no wide black frame) {r}")
        # the Replace page on a phone: the button on a solid bar, a short empty preview
        await E("()=>{S.jobs=S.jobs.filter(x=>x.id!=='t154');go('motion');renderAll()}"); await pg.wait_for_timeout(700)
        lay = await E("()=>{const g=document.querySelector('.go118'),s=document.querySelector('.preview-col .stage');return {bg:g?getComputedStyle(g).backgroundColor:'',bgi:g?getComputedStyle(g).backgroundImage:'',h:s?s.getBoundingClientRect().height:0}}")
        ok(lay["bgi"] == "none" and lay["bg"] not in ("", "rgba(0, 0, 0, 0)", "transparent") and 0 < lay["h"] <= 130, f"the Replace page: a solid bar behind the button, a short empty preview {lay}")
        # the gallery: the card takes its video's shape
        await E("()=>{S.jobs.push({id:'g154',kind:'video',model:'kling3',prompt:'tall',title:'tall',dur:4,aspect:'16:9',cost:10,status:'complete',progress:1,resultUrl:'/media/tall.webm',created:Date.now()});go('video');renderAll()}")
        g = None
        for _ in range(40):
            g = await E("()=>{const j=S.jobs.find(x=>x.id==='g154');const t=document.querySelector('.gc98[data-open98=\"g154\"] .tk98');return j&&j.ar154&&t?{ar:j.ar154,css:t.style.aspectRatio}:null}")
            if g: break
            await asyncio.sleep(.25)
        ok(g and g["ar"] == [360, 640] and g["css"].replace(" ", "") == "360/640", f"the gallery card in the video's own shape {g}")
        # the editor's top bar and tab rows, English and Arabic (v169: on a phone Export is an icon, its name read out)
        for lang in ("en", "ar"):
            await E(SETUP_ED, lang); await pg.wait_for_function("S.ed.clips.length===1&&document.querySelector('.ed143 #wk')", timeout=20000); await pg.wait_for_timeout(500)
            tb = await E("()=>{const t=document.querySelector('.ed143 .e-top'),n=t.querySelector('.e-name'),x=t.querySelector('.edout');const r=x.getBoundingClientRect();return {sw:t.scrollWidth,cw:t.clientWidth,name:n.getBoundingClientRect().width,left:r.left,right:r.right,vw:innerWidth,label:x.innerText.trim()||x.getAttribute('aria-label')}}")
            ok(tb["sw"] <= tb["cw"] + 1 and tb["name"] >= 80 and tb["left"] >= 0 and tb["right"] <= tb["vw"] and tb["label"] in ("Export", "تصدير", "Export video", "تصدير الفيديو"), f"{lang}: the editor's top bar — the name keeps room, Export inside the screen {tb}")
            await E("()=>{edSetPick(null);S.ed.lt143='ai';S.ed.tab='chat143';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(500)
            fd = await E("()=>{const r=document.querySelector('.ed143 .e-sub');return r?{more:r.scrollWidth>r.clientWidth+2,fade:r.classList.contains('fe154')||r.classList.contains('fs154')}:null}")
            ok(fd and (not fd["more"] or fd["fade"]), f"{lang}: a tab row that goes past the edge fades there {fd}")
            await E("()=>{edSetPick(null);S.ed.lt143='ai';S.ed.tab='3d';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(500)
            sv = await E("()=>{const r=document.querySelector('.ed143 .e-sub'),o=r&&r.querySelector('[aria-pressed=\"true\"]');if(!o)return null;const a=o.getBoundingClientRect(),q=r.getBoundingClientRect();return a.left>=q.left-1&&a.right<=q.right+1}")
            ok(sv, f"{lang}: the open tab is scrolled into view {sv}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "SWAP_ENGINE", "HOLD154"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock-vision", FREE_PERIOD="false"),
    stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 30); wait(lambda: reqs() is not None, 10)
    t0 = time.time(); server_checks(); out["server_s"] = round(time.time() - t0)
    asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1, default=str)[:8000])
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
