# v147: AI extras in the editor. Auto reframe (a new size; the crop follows what moves — a white square crossing the frame stays
# in the middle of a 9:16 frame), Stabilise (on the server with ffmpeg: a hand-held shake taken out, Show the original gives it
# back), Remove silences (a clip's pauses found in its sound and cut out; undo puts them back), the background removed by the AI
# engine (a stand-in engine; the frames go on one contact sheet, priced first — 3 credits — and come back as masks that put a
# colour behind the subject, read back free when the page opens again), and the assistant's @0:05, @0:01–0:03, @selection,
# @clip 2 and a marker's name. Computer and phone, EN + AR, nothing covered, no element id twice, no page errors.
# Run: python3 tests/v147.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8406, 8407
D = tempfile.mkdtemp(prefix="nooi-v147-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
# a white square crossing a dark frame in 4 s (x 40 → 520), silent
FF("-f", "lavfi", "-i", "color=c=0x101418:s=640x360:d=4:r=30", "-f", "lavfi", "-i", "color=c=white:s=60x60:d=4:r=30", "-filter_complex", "[0][1]overlay=x='40+t*120':y=150,format=yuv420p", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "800k", "-an", M + "move.webm")
# speech-like sound with two pauses: 0–1.5 s, 3–4 s and 5.5–6 s sound; 1.5–3 s and 4–5.5 s silent
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6", "-f", "lavfi", "-i", "aevalsrc='0.5*sin(2*PI*440*t)*(lt(t,1.5)+between(t,3,4)+gte(t,5.5))':s=48000:d=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "800k", "-c:a", "libopus", "-shortest", M + "talk.webm")
# a hand-held shake over a still picture
FF("-f", "lavfi", "-i", "mandelbrot=size=960x540:rate=1", "-frames:v", "1", D + "/still.png")
FF("-loop", "1", "-i", D + "/still.png", "-t", "4", "-vf", "crop=800:450:'80+14*sin(n*0.9)+8*sin(n*2.1)':'45+10*sin(n*1.3)+6*cos(n*2.7)',scale=640:360,fps=30", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1500k", M + "shaky.webm")
# the stand-in AI engine: the background removed where the picture is dark (the subject is the bright square)
MOCK = r'''
import json, sys, urllib.parse, urllib.request, io
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": []}; T = {}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path.startswith("/cut_"):
            b = open(DIR + u.path, "rb").read(); self.send_response(200); self.send_header("content-type", "image/png"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        tid = urllib.parse.parse_qs(u.query).get("taskId", [""])[0]
        self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/cut_{tid}.png"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5000})
        st["reqs"].append({"path": u.path, "body": j}); tid = "t%d" % len(st["reqs"])
        try:
            im = Image.open(io.BytesIO(urllib.request.urlopen((j.get("input") or {}).get("image"), timeout=20).read())).convert("RGBA")
            a = im.convert("L").point(lambda v: 255 if v > 128 else 0); im.putalpha(a); im.save(DIR + "/cut_" + tid + ".png")
        except Exception as e: st["err"] = str(e)
        return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.texts=[];S.ed.format='youtube';M.edMusic=null;S.ed.marks146=[];S.ed.groups146=[];S.ed.ms146=[];S.ed.chat143=[];
 const f=async(n,t)=>new File([await (await fetch('/media/'+n)).blob()],n,{type:t});edAddFiles([await f('move.webm','video/webm'),await f('talk.webm','video/webm'),await f('shaky.webm','video/webm')]);
 S.ed.tab='media';edSetPick(null);go('edit');renderAll()}"""
READY = "S.ed.clips.length===3&&document.querySelector('.ed143 #wk')&&S.ed.clips.every(c=>{const m=clipMedia(c);return m&&srcReady(m)&&(m.type!=='video'||isFinite(m.el.duration))})"
SCAN = open(os.path.join(ROOT, "tests", "v144.py")).read().split('SCAN = r"""', 1)[1].split('"""', 1)[0]
PIX = """async([t,x,y,w,h])=>{ED.playing=false;ED.t=t;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,350));
 const cv=document.getElementById('wk'),c=cv.getContext('2d'),d=c.getImageData(Math.round(cv.width*x),Math.round(cv.height*y),Math.max(1,Math.round(cv.width*w)),Math.max(1,Math.round(cv.height*h))).data;let r=0,g=0,b=0,n=d.length/4;
 for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}return [Math.round(r/n),Math.round(g/n),Math.round(b/n)]}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
near = lambda a, b, d=40: all(abs(x - y) <= d for x, y in zip(a, b))
def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], capture_output=True, text=True).stdout or "{}")
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), {}); return {"v": v.get("codec_name"), "dur": float(j.get("format", {}).get("duration", 0) or 0)}
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats", timeout=5).read())

async def open_page(b, w, h, lang, mob):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await pg.evaluate(SETUP, lang); await pg.wait_for_function(READY, timeout=25000); await pg.wait_for_timeout(500)
    return ctx, pg, errs

async def scan(pg, tag, states):
    found = {}
    for name, js in states:
        await pg.evaluate(js); await pg.evaluate("()=>document.querySelectorAll('.toast').forEach(t=>t.remove())"); await pg.wait_for_timeout(300)
        H = await pg.evaluate("()=>document.getElementById('main').scrollHeight"); bad, over, dup = [], 0, []
        for y in range(0, H, 450):
            await pg.evaluate("(y)=>{document.getElementById('main').scrollTop=y}", y); await pg.wait_for_timeout(60)
            r = await pg.evaluate(SCAN); over = max(over, r["over"]); dup = r["dup"]
            bad += [x for x in r["bad"] if x not in bad]
        await pg.evaluate("()=>{document.getElementById('main').scrollTop=0}")
        if bad or over > 1 or dup: found[name] = {"bad": bad[:6], "over": over, "dup": dup}
    out[tag + "_scan"] = found
    chk(f"{tag}: nothing covered, no sideways scroll, no element id twice", not found, found)

PICK = "(k)=>{const c=S.ed.clips[k];S.ed.sel=c.id;edSetPick('clip',c.id);renderView()}"
AI = "()=>{S.ed.lt143='ai';(S.ed.ls143=S.ed.ls143||{}).ai='ai140';S.ed.tab='ai140';S.ed.pclosed143=null;renderView()}"
async def click(pg, sel):
    await pg.evaluate("(s)=>{const b=document.querySelector(s);if(!b)throw new Error('no '+s);b.scrollIntoView({block:'center'});b.click()}", sel); await pg.wait_for_timeout(250)
async def cmd(pg, text):
    await pg.evaluate("()=>{const q=document.getElementById('edcmdq');q.scrollIntoView({block:'center'});q.focus()}"); await pg.fill("#edcmdq", text); await pg.wait_for_timeout(250)
    plan = await pg.evaluate("()=>(document.getElementById('edplan91')||{}).textContent||''")
    await pg.evaluate("()=>document.querySelector('[data-act=\"edcmd-go\"]').click()"); await pg.wait_for_timeout(500); return plan

async def desktop(b, lang):
    tag = f"desktop {lang}"; ctx, pg, errs = await open_page(b, 1280, 900, lang, False); E = pg.evaluate; ar = lang == "ar"
    await E(PICK, 0); await E(AI)
    cards = await E("()=>({rf:[...document.querySelectorAll('[data-act=\"rf147\"]')].map(b=>b.dataset.v),stab:!!document.querySelector('[data-act=\"stab147\"]'),sil:!!document.querySelector('[data-act=\"sil147\"]'),bge:(document.querySelector('.ai140c [data-act=\"bge147\"]')||{}).textContent||'',bgcr:(()=>{const b=document.querySelector('.ai140c [data-act=\"bge147\"]'),c=b&&b.querySelector('.crc');return c?c.getAttribute('aria-label'):((b&&b.querySelector('.cost'))||{}).textContent})()})")
    chk(f"{tag}: the AI tools have Fix & reframe — reframe sizes, Stabilise, Remove silences, background on the AI engine with its price", cards["rf"] == ["9:16", "1:1", "4:5", "16:9"] and cards["stab"] and cards["sil"] and str(cards["bgcr"]).startswith("6 "), cards)
    # ---- auto reframe to 9:16: the crop follows the square
    await E("()=>{S.ed.clips=[S.ed.clips[0]].concat(S.ed.clips.slice(1));renderView()}")
    await click(pg, '[data-act="rf147"][data-v="9:16"]'); await pg.wait_for_function("!BUSY147.rf&&S.ed.format==='reels'", timeout=30000); await pg.wait_for_timeout(400)
    rf = await E("()=>{const c=S.ed.clips[0],P=c.crop&&c.crop.px147||[],at=t=>{let i=0;while(i<P.length-1&&P[i+1][0]<t)i++;return P[i]&&P[i][1]};return{ar:c.crop&&c.crop.ar,n:P.length,x0:at(.5),x1:at(3.5),fmt:S.ed.format}}")
    st = await E("()=>edStarts()[0]"); a = await E(PIX, [st + .5, .4, .35, .2, .2]); bb = await E(PIX, [st + 3.5, .4, .35, .2, .2])
    chk(f"{tag}: Auto reframe 9:16 — the size changes and the crop follows the square from left to right (it stays in the middle)", rf["ar"] == "9:16" and rf["fmt"] == "reels" and rf["n"] >= 10 and rf["x0"] < -.4 and rf["x1"] > .4 and min(a) > 150 and min(bb) > 150, {"rf": rf, "mid@0.5": a, "mid@3.5": bb})
    # ---- Remove silences on the talking clip
    await E(PICK, 1); await E(AI); await E("()=>{S.ed.silMin147=.5;renderView()}"); n0 = await E("()=>S.ed.clips.length")
    await click(pg, '[data-act="sil147"]'); await pg.wait_for_function("S.ed.clips.length>" + str(n0), timeout=20000); await pg.wait_for_timeout(300)
    sl = await E("()=>S.ed.clips.slice(1,4).map(c=>+(c.out-c.in).toFixed(2))")
    chk(f"{tag}: Remove silences cuts the two pauses out (three spoken parts, about 1.6 · 1.2 · 0.6 s)", len(sl) == 3 and abs(sl[0] - 1.62) < .1 and abs(sl[1] - 1.24) < .12 and abs(sl[2] - .62) < .1, sl)
    await pg.keyboard.press("Escape"); await E("()=>{document.activeElement&&document.activeElement.blur()}"); await pg.keyboard.press("Control+z"); await pg.wait_for_timeout(400)
    un = await E("()=>[S.ed.clips.length,+(S.ed.clips[1].out-S.ed.clips[1].in).toFixed(2)]")
    chk(f"{tag}: undo puts the pauses back", un[0] == 3 and abs(un[1] - 6) < .1, un)
    # ---- Stabilise the shaky clip (server, free)
    cr0 = await E("()=>S.credits"); await E(PICK, 2); await E(AI); await click(pg, '[data-act="stab147"]')
    await pg.wait_for_function("S.ed.clips[2].stab147>0", timeout=60000)   # (the steady copy is H.264: this test browser can't play it, real browsers do — checked with ffprobe)
    sb = await E("()=>{const c=S.ed.clips[2],j=S.jobs.find(x=>x.id===c.src.job);return{url:j&&j.resultUrl,dur:c.out-c.in,orig:!!c.stab0,btn:(document.querySelector('[data-act=\"stab147\"]')||{}).textContent}}")
    pr = probe(D + "/media/" + str(sb["url"]).split("/media/")[-1]) if sb["url"] else {}
    chk(f"{tag}: Stabilise makes a steady copy on the server (H.264, 4 s) and the clip uses it; the button offers the original back", str(sb["url"]).endswith("-steady.mp4") and abs(sb["dur"] - 4) < .2 and pr.get("v") == "h264" and abs(pr.get("dur", 0) - 4) < .2 and sb["orig"] and sb["btn"] in ("Show the original", "أظهر الأصل"), {"sb": sb, "probe": pr})
    await click(pg, '[data-act="stab147"]'); back = await E("()=>({k:S.ed.clips[2].src.k,s:S.ed.clips[2].stab147})")
    chk(f"{tag}: Show the original gives the shaky clip back", back["k"] == "upload" and not back["s"], back)
    # ---- the background removed by the AI engine (stand-in engine): priced first, one sheet, masks on the clip
    await E(PICK, 0); await E("()=>{S.ed.tab='bg144';renderView()}"); await pg.wait_for_timeout(300)
    card = await E("()=>(document.querySelector('.bge147')||{}).textContent||''"); r0 = len(stats()["reqs"])
    chk(f"{tag}: the Background panel offers the AI engine with its price first", ("6" in card) and await E("()=>{const c=document.querySelector('.bge147 .crc');return /^6 \\S/.test(c?c.getAttribute('aria-label'):(document.querySelector('.bge147 .cost')||{}).textContent||'')}") and ("AI engine" in card or "محرك الذكاء" in card), card)
    await click(pg, '.bge147 [data-act="bge147"]'); await pg.wait_for_function("(()=>{const s=BG144[S.ed.clips[0].id];return s&&s.ready&&s.eng147&&s.frames.length>=12})()", timeout=60000); await pg.wait_for_timeout(500)
    be = await E("()=>{const c=S.ed.clips[0],s=BG144[c.id],js=S.jobs.filter(x=>x.kind==='bg'&&x.meta&&x.meta.bg147);return{n:s.frames.length,t:s.frames[4]&&s.frames[4].t,on:c.bg144.on,sheets:(c.bg144.eng147||{}).sheets.length,cost:js.reduce((a,j)=>a+(+j.cost||0),0),model:(stats().reqs||[]).length}}".replace("stats().reqs||[]", "[]"))
    rq = stats()["reqs"][r0:]
    st = await E("()=>edStarts()[0]"); tt = st + (be.get("t") or .5); sq = await E(PIX, [tt, .44, .4, .12, .1]); bgc = await E(PIX, [tt, .3, .05, .4, .08])   # (at a sampled frame: its own mask)
    chk(f"{tag}: the AI engine gets two sheets of 12 frames (6 credits) and its cut-out puts the colour behind the square", be["n"] == 12 and be["on"] and be["sheets"] == 2 and be["cost"] == 6 and len(rq) == 2 and all(x["body"].get("model") == "recraft/remove-background" for x in rq) and min(sq) > 150 and near(bgc, [0, 177, 64], 45), {"be": be, "reqs": [x["body"].get("model") for x in rq], "square": sq, "behind": bgc})
    await E("()=>{delete BG144[S.ed.clips[0].id];renderView()}"); await pg.wait_for_function("(()=>{const s=BG144[S.ed.clips[0].id];return s&&s.ready})()", timeout=15000)
    chk(f"{tag}: opened again, the engine's cut-out is read back without asking the engine again", len(stats()["reqs"]) == r0 + 2, len(stats()["reqs"]) - r0)
    # ---- the assistant: @time, a range, @selection, a marker, @clip
    await cmd(pg, 'add text "Hello" @0:02' if not ar else 'أضف النص: «مرحبا» @0:02'); tx = await E("()=>S.ed.texts.map(t=>[t.text,+t.start.toFixed(2)])")
    chk(f"{tag}: “add text … @0:02” puts it at 0:02", any(abs(t[1] - 2) < .05 for t in tx), tx)
    await cmd(pg, 'add text "Range" @0:01-0:03' if not ar else 'أضف النص: «مدى» @0:01-0:03'); rg = await E("()=>{const t=S.ed.texts[S.ed.texts.length-1];return[+t.start.toFixed(2),+t.end.toFixed(2)]}")
    chk(f"{tag}: a range @0:01-0:03 sets when it starts and ends", rg == [1, 3], rg)
    await E("()=>{S.ed.marks146=[{id:'m1',t:4.5,n:'Drop'}];renderView()}"); await cmd(pg, 'add text "Mark" @Drop' if not ar else 'أضف النص: «علامة» @Drop')
    mk = await E("()=>+S.ed.texts[S.ed.texts.length-1].start.toFixed(2)"); chk(f"{tag}: @<marker name> means the marker's time", abs(mk - 4.5) < .05, mk)
    await E("()=>{const t=S.ed.texts;edSetPick('text',t[0].id);S.ed.ms146=['text:'+t[0].id,'text:'+t[1].id];renderView()}")
    plan = await cmd(pg, "delete @selection" if not ar else "احذف @التحديد"); dn = await E("()=>S.ed.texts.length")
    chk(f"{tag}: “delete @selection” says what it will do, then deletes the selected ones", dn == 1 and ("2" in plan), {"left": dn, "plan": plan})
    await E("()=>{const c=S.ed.clips;edSetPick('clip',c[0].id);S.ed.ms146=['clip:'+c[0].id,'clip:'+c[1].id];renderView()}")
    await cmd(pg, "slow motion @selection" if not ar else "حركة بطيئة @التحديد"); sp = await E("()=>S.ed.clips.map(c=>c.speed||1)")
    chk(f"{tag}: a clip change @selection is done to each selected clip", sp[0] == .5 and sp[1] == .5 and sp[2] == 1, sp)
    await cmd(pg, "@0:01"); ph = await E("()=>ED.t"); chk(f"{tag}: @0:01 alone moves the playhead", abs(ph - 1) < .01, ph)
    log = await E("()=>(S.ed.chat143||[]).filter(m=>m.me).map(m=>m.t)")
    chk(f"{tag}: the assistant's thread keeps what you typed, with the @", any("@0:02" in x for x in log) and any("@selection" in x or "@التحديد" in x for x in log), log)
    await E("()=>{edSetPick('clip',S.ed.clips[0].id);S.ed.ms146=['clip:'+S.ed.clips[0].id,'clip:'+S.ed.clips[1].id];renderView()}")
    await click(pg, '[data-act="at147-open"]'); al = await E("()=>[...document.querySelectorAll('#at147 [data-act=\"at147\"]')].map(b=>b.dataset.v)")
    chk(f"{tag}: the @ button lists the playhead, the selection, the markers and the clips", len(al) >= 5 and al[0].startswith("@") and ("@selection" in al or "@التحديد" in al) and "@Drop" in al and ("@clip 1" in al or "@المقطع 1" in al), al)
    await click(pg, '#at147 [data-v="' + ('@التحديد' if ar else '@selection') + '"]'); val = await E("()=>document.getElementById('edcmdq').value")
    chk(f"{tag}: a tap puts it in the prompt", ("@التحديد" if ar else "@selection") in val, val)
    await scan(pg, tag, [("AI tools", AI), ("background panel", "()=>{edSetPick('clip',S.ed.clips[0].id);S.ed.ms146=[];S.ed.tab='bg144';renderView()}"), ("the @ list open", "()=>{atOpen147(true)}")])
    chk(f"{tag}: no page errors", not errs, errs); await ctx.close()

async def phone(b, lang):
    tag = f"phone {lang}"; ctx, pg, errs = await open_page(b, 390, 844, lang, True); E = pg.evaluate
    await E(PICK, 0); await E("()=>{S.ed.tab='ai140';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(300)
    vis = await E("()=>[...document.querySelectorAll('.ed143 .e-sheet [data-act=\"rf147\"],.ed143 .e-sheet [data-act=\"stab147\"],.ed143 .e-sheet [data-act=\"sil147\"],.ed143 .e-sheet [data-act=\"bge147\"]')].filter(b=>b.getBoundingClientRect().width>20).length")
    chk(f"{tag}: the AI sheet shows reframe, stabilise, silences and the engine's background", vis >= 7, vis)
    await click(pg, '.ed143 .e-sheet [data-act="rf147"][data-v="1:1"]'); await pg.wait_for_function("!BUSY147.rf&&S.ed.format==='igsq'", timeout=30000)
    sq = await E("()=>S.ed.clips.filter(c=>c.crop&&c.crop.ar==='1:1').length"); chk(f"{tag}: reframe to 1:1 from the phone", sq == 3, sq)
    at = await E("()=>!!document.querySelector('.ed143 [data-act=\"at147-open\"]')"); chk(f"{tag}: the prompt bar has the @ button", at)
    await scan(pg, tag, [("AI sheet", "()=>{S.ed.tab='ai140';S.ed.pclosed143=null;renderView()}"), ("the @ list open", "()=>{S.ed.pclosed143=S.ed.tab;renderView();atOpen147(true)}")])
    chk(f"{tag}: no page errors", not errs, errs); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        for f, lang in ((desktop, "en"), (desktop, "ar"), (phone, "en"), (phone, "ar")):
            try: await f(b, lang)
            except Exception as e: fails.append(f"{f.__name__} {lang} crashed: " + repr(e)[:500])
        await b.close()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=open(D + "/mock.log", "w"))
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/health", timeout=2); urllib.request.urlopen(f"http://localhost:{KPORT}/stats", timeout=2); break
        except Exception: time.sleep(.2)
    asyncio.run(main())
finally: srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": {k: json.dumps(v, ensure_ascii=False, default=str)[:1400] for k, v in out.items()}, "dir": D}, ensure_ascii=False, indent=1))
sys.exit(1 if fails else 0)
