# v91 in a real browser with a real nooi server (no AI keys; a stand-in for the voice engine):
#  · Video editor (phone, touch): after "Add keyframe" a Scale/Position/Rotation change at another moment adds a keyframe there
#    (before, the second change overwrote the first and nothing moved); the keyframe bar updates while you drag, jumps to the
#    previous / next keyframe, seeks where you tap it, has 32 px touch targets; keyframes show on the clip in the timeline;
#    Split cuts the keyframes at the playhead and Duplicate makes a real copy (both pieces shared one set of keyframes and
#    colours); AI commands in English and Arabic run at once and free with undo ("delete clip 2", "make it vertical",
#    "slow motion", "fade transitions between all clips", "music quieter", "black and white"…, several in one line);
#    what goes to the AI shows its price on Go first; Extend shot makes the next 5 s from the clip's last frame, in the
#    project's size, placed right after it; on a phone the header is compact (no intro text, one row of examples)
#  · Sketch: only the drawing tools, "What are you drawing?", how many versions (1 · 4 · 6 · 8 · 10, each a different look) and
#    one "Preview with AI" button with its price; Draw a scene opens it; the drawing is never replaced (touch, undo, redo,
#    eraser, re-renders), a pen move costs under a millisecond on a big drawing, the drawing is kept after a reload
#  · AI agents: nine, in the order the work runs — Lyra, the new Dialogue & Voice Director (her own microphone icon and
#    colour), and Echo, now the Sound Designer (realistic sound); names and roles in other languages; the landing page says
#    nine; the film crew runs Lyra's stage (one voice per speaker, lines with feelings) and Echo writes no spoken lines
#  · Character voices: the voice library with samples (free when the engine has one, otherwise made once for 1 credit and
#    free after), a picker on each character (women's voices for a woman, all on request), the chosen voice used by the
#    Voice studio and the film crew
#  · 3D World: with the picture engine connected Realistic is the default and its price is on Create; Realistic asks for the
#    360° sky (also the light), a photo of the ground and photo cut-outs of the plants; they join the world, stay in the plan,
#    and a picture without a white background is never used as a cut-out
#  · Video cards (phone and computer: home results, library, Video page): no two buttons on top of each other ("Share to
#    Explore" sat on Delete), and every video shows whole inside its frame (small previews played at full size, tall videos
#    were cut on the home page)
# Run: python3 tests/v91.py
import asyncio, json, math, os, random, subprocess, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageDraw, ImageFilter
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8201; MP = 8202
D = tempfile.mkdtemp(prefix="nooi-v91-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc=size=640x360:rate=24:duration=6", "-f", "lavfi", "-i", "sine=f=440:d=6", "-shortest", "-c:v", "libvpx-vp9", "-b:v", "200k", "-c:a", "libopus", D + "/media/a.webm")
FF("-f", "lavfi", "-i", "smptebars=size=360x640:rate=24:duration=5", "-f", "lavfi", "-i", "sine=f=330:d=5", "-shortest", "-c:v", "libvpx-vp9", "-b:v", "200k", "-c:a", "libopus", D + "/media/b.webm")
FF("-f", "lavfi", "-i", "sine=f=220:d=12", D + "/media/music.mp3"); FF("-f", "lavfi", "-i", "sine=f=300:d=1.2", "-c:a", "libmp3lame", D + "/media/s.mp3")
AUD = open(D + "/media/s.mp3", "rb").read()
im = Image.new("RGB", (600, 800), "white"); d = ImageDraw.Draw(im); d.rectangle([285, 300, 315, 790], fill=(120, 85, 50))
for a in range(0, 360, 30): d.line([300, 300, 300 + math.cos(math.radians(a)) * 230, 300 + math.sin(math.radians(a)) * 120], fill=(40, 120, 40), width=28)
im.save(D + "/media/palm.png")
g = Image.new("RGB", (256, 256)); px = g.load(); random.seed(3)
for yy in range(256):
    for xx in range(256): v = 180 + random.randint(-25, 25); px[xx, yy] = (v + 30, v + 5, v - 60)
g.filter(ImageFilter.GaussianBlur(1)).save(D + "/media/sand.jpg")
sk = Image.new("RGB", (1024, 512)); d = ImageDraw.Draw(sk)
for yy in range(512): c = int(90 + yy * 0.3); d.line([0, yy, 1024, yy], fill=(c, c + 40, 255) if yy < 256 else (200, 170, 120))
sk.save(D + "/media/pano.jpg")
# the voice engine stand-in: its library (one free sample) and speech
ST = {"tts": [], "prev": 0}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, body, ct): self.send_response(code); self.send_header("content-type", ct); self.send_header("content-length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path.startswith("/el/v1/voices"): return self._send(200, json.dumps({"voices": [{"voice_id": "EXAVITQu4vr4xnSDxMaL", "preview_url": f"http://localhost:{MP}/prev/sarah.mp3"}]}).encode(), "application/json")
        if self.path.startswith("/prev/"): ST["prev"] += 1; return self._send(200, AUD, "audio/mpeg")
        self._send(404, b"{}", "application/json")
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); b = self.rfile.read(n)
        if self.path.startswith("/el/v1/text-to-speech/"): ST["tts"].append([self.path.split("/")[-1].split("?")[0], json.loads(b).get("text")]); return self._send(200, AUD, "audio/mpeg")
        self._send(404, b"{}", "application/json")
SET = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}"
async def page(b, w, touch=False, args=None):
    ctx = await b.new_context(viewport={"width": w, "height": 844 if w < 500 else 860}, is_mobile=w < 500, has_touch=touch or w < 500); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await pg.evaluate(SET, "en"); await pg.wait_for_timeout(300)
    return ctx, pg, errs

EDSETUP = """async()=>{const now=Date.now(),mk=(id,kind,url,dur,extra)=>Object.assign({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url,model:'seedance'},extra||{});
 S.jobs.push(mk('ed_va','video','/media/a.webm',6),mk('ed_vb','video','/media/b.webm',5,{aspect:'9:16'}),mk('ed_vc','video','/media/a.webm',6),mk('ed_mu','music','/media/music.mp3',12));
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.format='tiktok';for(const id of ['ed_va','ed_vb','ed_vc','ed_mu']){await edUseJob(S.jobs.find(j=>j.id===id),{stay:true,quiet:true,t:1})}
 S.ed.texts.push({id:uid(),text:'Hello',start:0,end:3,pos:'bottom',style:'caption',size:9,anim:'pop'});go('edit');renderAll();
 window.__runs=[];edRun=(o=>function(p){window.__runs.push(p);return o(p)})(edRun)}"""
async def editor(b):
    tag = "editor"; ctx, pg, errs = await page(b, 390, True); E = pg.evaluate
    await E(EDSETUP); await pg.wait_for_timeout(1800)
    r = await E("""async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms)),E=S.ed,c=E.clips[0];E.sel=c.id;edSetPick('clip',c.id);E.tab='motion';ED.playing=false;const st=edStarts()[0];ED.t=st+.5;renderView();await W(100);
      document.querySelector('[data-act="edx-kf-add"]').click();await W(100);ED.t=st+2.5;renderView();await W(100);const sl=document.querySelector('input[data-edx="mo.s"]');sl.value=160;sl.dispatchEvent(new Event('input',{bubbles:true}));await W(100);
      const bar=document.querySelectorAll('.edxpanel .kfbar .kfd').length,mid=edxMo(c,1.5).s;renderView();await W(100);const marks=document.querySelectorAll('#tlin .kfm91').length;
      document.querySelector('[data-act="kf91-nav"][data-v="-1"]').click();await W(60);const prev=+(ED.t-st).toFixed(2);document.querySelector('[data-act="kf91-nav"][data-v="1"]').click();await W(60);const next=+(ED.t-st).toFixed(2);
      const kb=document.querySelector('.kfbar.kf91'),rc=kb.getBoundingClientRect();kb.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:rc.left+rc.width*.25,clientY:rc.top+5}));await W(60);
      const seek=+(ED.t-st).toFixed(2),kd=document.querySelector('.kfbar.kf91 .kfd').getBoundingClientRect().width;return {kf:c.mo.kf.map(k=>[k.t,k.s]),bar,mid,marks,prev,next,seek,d:clipDur(c),kd}}""")
    out["kf"] = r
    ok(len(r["kf"]) == 2 and r["kf"][0][1] == 1 and abs(r["kf"][1][1] - 1.6) < 1e-6 and 1 < r["mid"] < 1.6, f"{tag}: a slider change at another moment adds a keyframe and the clip animates {r}")
    ok(r["bar"] == 2 and r["marks"] == 2, f"{tag}: the keyframe bar updates while you drag; keyframes show on the clip {r}")
    ok(r["prev"] == 0.5 and r["next"] == 2.5 and abs(r["seek"] - r["d"] * .25) < .1 and r["kd"] >= 32, f"{tag}: previous / next keyframe, tap the bar to seek, 32 px targets {r}")
    r = await E("""async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms)),E=S.ed,c=E.clips[0],st=edStarts()[0];E.sel=c.id;edSetPick('clip',c.id);ED.t=st+1.5;renderView();await W(60);
      document.querySelector('[data-act="ed-split"]').click();await W(60);const a=E.clips[0],b=E.clips[1],o={same:a.mo===b.mo,akf:a.mo.kf.map(k=>k.t),bkf:b.mo.kf.map(k=>k.t),joint:[a.mo.kf[a.mo.kf.length-1].s,b.mo.kf[0].s]};
      E.sel=b.id;edSetPick('clip',b.id);renderView();document.querySelector('[data-act="ed-dup"]').click();await W(60);const d=E.clips[2];d.cg=d.cg||{};d.cg.look='noir';o.shared=b.mo===d.mo||!!(b.cg&&b.cg.look==='noir');return o}""")
    ok(not r["same"] and r["akf"][-1] == 1.5 and r["bkf"][0] == 0 and abs(r["joint"][0] - r["joint"][1]) < 1e-6 and not r["shared"], f"{tag}: split cuts the keyframes, duplicate is a real copy {r}")
    async def cmd(q):
        await E("(q)=>{const i=$('#edcmdq');i.value=q;i.dispatchEvent(new Event('input',{bubbles:true}))}", q); await pg.wait_for_timeout(250)
        return await E("()=>({go:document.querySelector('[data-act=\"edcmd-go\"]').textContent,plan:($('#edplan91')||{}).textContent})")
    i = await cmd("delete clip 2"); ok("free" in i["go"] and "Delete clip 2" in i["plan"], f"{tag}: a local edit is free and says what it will do {i}")
    n0 = await E("S.ed.clips.length"); await E("edGo91('delete clip 2')"); await pg.wait_for_timeout(200); n1 = await E("S.ed.clips.length"); await E("histGo(-1)"); await pg.wait_for_timeout(150)
    ok(n1 == n0 - 1 and await E("S.ed.clips.length") == n0, f"{tag}: delete clip 2, then undo {n0} {n1}")
    i = await cmd("add calm oud music"); ok(any(ch.isdigit() for ch in i["go"]) and "free" not in i["go"], f"{tag}: AI music shows its price on Go first {i}")
    i = await cmd("delete clip 9"); ok("no clip 9" in i["plan"], f"{tag}: a clip that doesn't exist is explained {i}")
    checks = [("make it horizontal", "S.ed.format", "youtube"), ("square", "S.ed.format", "igsq"), ("for tiktok", "S.ed.format", "tiktok"), ("fade transitions between all clips", "S.ed.clips.slice(0,-1).every(c=>c.trans==='fade')", True),
              ("slow motion", "edSelClip().speed", 0.5), ("speed 2x", "edSelClip().speed", 2), ("mute", "edSelClip().vol", 0), ("unmute", "edSelClip().vol", 100), ("make clip 1 3 seconds", "+clipDur(S.ed.clips[0]).toFixed(1)", 3),
              ("black and white", "(edSelClip().cg||{}).look", "noir"), ("make the video warm", "S.ed.clips.every(c=>(c.cg||{}).look==='warm')", True), ("reset motion", "edSelClip().mo.kf.length", 0),
              ("slow zoom in", "edSelClip().mo.kf.length>1", True), ("turn on captions", "S.ed.caps.on", True), ("remove all texts", "S.ed.texts.length", 0), ("delete clip 2 and make it square", "S.ed.format", "igsq")]
    bad = []
    for q, expr, want in checks:
        await E("(q)=>edGo91(q)", q); await pg.wait_for_timeout(160); got = await E("()=>" + expr)
        if got != want: bad.append([q, got])
    ok(not bad, f"{tag}: AI commands run here, free {bad}")
    await E(SET, "ar"); await pg.wait_for_timeout(300); bad = []
    for q, expr, want in (("اجعله أفقياً", "S.ed.format", "youtube"), ("حركة بطيئة", "edSelClip().speed", 0.5), ("أبيض وأسود", "(edSelClip().cg||{}).look", "noir"), ("اكتم الصوت", "edSelClip().vol", 0), ("احذف المقطع ٢ واجعله مربعاً", "S.ed.format", "igsq")):
        i = await cmd(q); await E("(q)=>edGo91(q)", q); await pg.wait_for_timeout(160); got = await E("()=>" + expr)
        if got != want or "مجاناً" not in i["go"]: bad.append([q, got, i])
    ok(not bad, f"{tag}: Arabic commands {bad}"); ok(await E("window.__runs.length") == 0, f"{tag}: none of the free commands went to the AI {await E('window.__runs')}")
    await E(SET, "en"); await pg.wait_for_timeout(300)
    r = await E("""async()=>{const E=S.ed;E.format='tiktok';E.tab='clip';const c=E.clips[0];E.sel=c.id;edSetPick('clip',c.id);renderView();await new Promise(r=>setTimeout(r,100));
      const tb=(document.querySelector('.edbar [data-act="ed-extend91"]')||{}).textContent;document.querySelector('.ext91 [data-act="ed-extend91"]').click();
      for(let k=0;k<40&&!S.jobs.find(x=>x.meta&&x.meta.edCmd==='extend');k++)await new Promise(r=>setTimeout(r,100));const j=S.jobs.find(x=>x.meta&&x.meta.edCmd==='extend');
      return {tb,job:j&&[j.dur,j.aspect,j.meta.start,/^Extended/.test(j.title)],after:j&&EDP[j.id]&&EDP[j.id].after===c.id}}""")
    ok(r["tb"] and any(ch.isdigit() for ch in r["tb"]) and r["job"] == [5, "16:9", True, True] and r["after"], f"{tag}: Extend shot — price shown, 5 s from the last frame in the clip's own shape (v94: a 1280×720 clip stays 16:9 in a TikTok project), lands after the clip {r}")
    await E("()=>{$('#modalRoot').innerHTML='';$('#edcmdq').value='';S.edCmd='';renderView();scrollTo(0,0)}"); await pg.wait_for_timeout(300)
    r = await E("()=>{const l=document.querySelector('.view .lede'),ch=[...document.querySelectorAll('.edcmdx .chip')].map(c=>Math.round(c.getBoundingClientRect().top));return {lede:l?getComputedStyle(l).display:'none',rows:new Set(ch).size,sw:document.documentElement.scrollWidth}}")
    ok(r["lede"] == "none" and r["rows"] == 1 and r["sw"] <= 390, f"{tag}: compact phone header, no sideways scroll {r}")
    ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

async def sketch(b):
    tag = "sketch"; ctx, pg, errs = await page(b, 390, True); E = pg.evaluate
    await E("()=>{SK.strokes=[];go('draw');renderAll()}"); await pg.wait_for_timeout(600)
    acts = await E("()=>[...document.querySelectorAll('#main [data-act],#main [data-bind]')].filter(e=>e.getBoundingClientRect().width>1).map(e=>e.dataset.act||e.dataset.bind)")
    bad = [a for a in acts if a and (a.startswith("lsk") or a in ("sk-target", "sk-hd", "sk-save", "sk-3d", "sk-dl", "drw-go"))]
    ok(await E("S.view") == "sketch" and not bad and not await E("()=>!!document.querySelector('.skmode80')"), f"{tag}: Draw a scene opens the one Sketch page, nothing unrelated on it {bad}")
    ok(all(x in acts for x in ("sk-tool", "sk-undo", "sk-redo", "sk-clear", "sk-color", "sketch.prompt", "sk91-n", "sk91-go")) and acts.count("sk91-go") == 1, f"{tag}: drawing tools, what it is, versions, one AI button {acts}")
    box = await pg.locator("#skcv").bounding_box(); cdp = await ctx.new_cdp_session(pg)
    async def stroke(x0, y0, x1, y1):
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": box["x"] + x0 * box["width"], "y": box["y"] + y0 * box["height"]}]})
        for k in range(1, 13): await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": box["x"] + (x0 + (x1 - x0) * k / 12) * box["width"], "y": box["y"] + (y0 + (y1 - y0) * k / 12) * box["height"]}]})
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(80)
    await pg.locator("#skcv").scroll_into_view_if_needed(); box = await pg.locator("#skcv").bounding_box()
    await stroke(.2, .5, .8, .5); await stroke(.5, .2, .5, .8)
    INK = "()=>{const c=$('#skcv'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;return n}"
    n2 = await E(INK); ok(await E("SK.strokes.length") == 2 and n2 > 500, f"{tag}: touch draws {n2}")
    same = await E("()=>{const c=$('#skcv'),W=c.width,o=document.createElement('canvas');o.width=o.height=W;const x=o.getContext('2d');SK.strokes.forEach(s=>skDrawStroke(x,s,W,W));const a=c.getContext('2d').getImageData(0,0,W,W).data,b=x.getImageData(0,0,W,W).data;let d=0;for(let i=3;i<a.length;i+=4)if((a[i]>40)!==(b[i]>40))d++;return d/(W*W)}")
    ok(same < .01, f"{tag}: what you see is the drawing ({same})")
    await pg.click("[data-act=sk-undo]"); await pg.wait_for_timeout(100); u = [await E("SK.strokes.length"), await E(INK)]
    await pg.click("[data-act=sk-redo]"); await pg.wait_for_timeout(100); rd = [await E("SK.strokes.length"), await E(INK)]
    ok(u[0] == 1 and u[1] < n2 and rd[0] == 2 and abs(rd[1] - n2) < n2 * .02, f"{tag}: undo and redo {u} {rd}")
    await pg.click("[data-act=sk-tool][data-v=eraser]"); await pg.wait_for_timeout(150); box = await pg.locator("#skcv").bounding_box(); await stroke(.15, .5, .85, .5); n3 = await E(INK)
    ok(n3 < n2 and await E("SK.strokes.length") == 3, f"{tag}: the eraser erases the same drawing {n2}→{n3}")
    await pg.click("[data-act=sk-tool][data-v=pen]"); await pg.wait_for_timeout(100)
    el0 = await pg.evaluate_handle("()=>$('#skcv')"); await pg.click("[data-act=sk91-n][data-v='6']"); await pg.wait_for_timeout(200)
    r = await E("(e)=>({same:$('#skcv')===e,go:document.querySelector('[data-act=sk91-go]').textContent,each:skCost91()})", el0)
    ok(r["same"] and str(6 * r["each"]) in r["go"] and abs(await E(INK) - n3) < max(50, n3 * .02), f"{tag}: 6 versions — the price shown, the same drawing kept {r}")
    await pg.fill("#skwhat91", "a red car"); before = await E(INK); await pg.click("[data-act=sk91-go]")
    await pg.wait_for_function("()=>S.jobs.filter(j=>j.meta&&j.meta.sk91).length>=6", timeout=10000)
    r = await E("()=>{const js=S.jobs.filter(j=>j.meta&&j.meta.sk91);return {styles:new Set(js.map(j=>j.meta.style)).size,batches:new Set(js.map(j=>j.batch)).size,p:js[0].prompt.includes('a red car'),res:document.querySelectorAll('#sk91res .dfig').length}}")
    ok(r == {"styles": 6, "batches": 1, "p": True, "res": 6} and abs(await E(INK) - before) < 30, f"{tag}: six different looks of what you drew, listed under the button, the drawing unchanged {r}")
    t = await E("()=>{for(let i=0;i<400;i++)SK.strokes.push({tool:'pen',color:'#222',size:6,pts:Array.from({length:30},()=>[Math.random(),Math.random(),.6])});skRedraw();SK.cur={tool:'pen',color:'#e53935',size:6,pts:[[.1,.1,.6]]};const t0=performance.now();for(let i=0;i<200;i++){SK.cur.pts.push([.1+i*.004,.1+i*.002,.6]);skRedraw()}const dt=(performance.now()-t0)/200;SK.strokes.push(SK.cur);SK.cur=null;skRedraw();return dt}")
    ok(t < 1, f"{tag}: a pen move costs under 1 ms on a 400-line drawing ({t:.3f} ms)")
    await E("()=>{SK.strokes=SK.strokes.slice(0,3);skRedraw()}"); await pg.wait_for_timeout(700); await pg.reload(); await pg.wait_for_timeout(1500)
    await E(SET, "en"); await E("()=>{go('sketch');renderAll()}"); await pg.wait_for_timeout(900)
    ok(await E("SK.strokes.length") == 3 and await E(INK) > 300, f"{tag}: the drawing is kept after a reload")
    ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

async def agents(b):
    tag = "agents"; ctx, pg, errs = await page(b, 390); E = pg.evaluate
    want = ["writer", "casting", "director", "cine", "voice", "sound", "editor", "producer", "proof"]
    r = await E("()=>({order:BOTS.map(b=>b.id),hf:HF_BOT_IDS,ag:AG_ROLES.video,lyra:[BOT('voice').name[0],BOT('voice').role[0],BOT('voice').job[0]],echo:BOT('sound').role[0],fills:BOTS.map(b=>FB[b.id].c.toLowerCase())})")
    ok(r["order"] == want and r["hf"] == want and r["ag"] == want, f"{tag}: nine agents in the order the work runs {r['order']}")
    ok(r["lyra"][:2] == ["Lyra", "Dialogue & Voice Director"] and "voice" in r["lyra"][2] and r["echo"] == "Sound Designer", f"{tag}: Lyra and Echo's roles {r}")
    ok(len(set(r["fills"])) == 9, f"{tag}: every agent its own colour {r['fills']}")
    s = await E("()=>{const d=document.createElement('div');d.innerHTML=botSVG('voice','working',64);return [!!d.querySelector('.shape rect[rx=\"25\"]'),!!d.querySelector('.fx-wave')]}")
    ok(s == [True, True], f"{tag}: Lyra's own icon (a microphone with sound waves) {s}")
    for l, nm, rl in (("ru", "Лира", "Режиссёр диалогов и озвучки"), ("ja", "ライラ", "台詞・ボイスディレクター"), ("fr", "Lyra", "Directeur des dialogues et des voix")):
        t = await E("(l)=>{S.lang=l;const b=BOT('voice'),r=[L(b.name[0],b.name[1]),L(b.role[0],b.role[1])];S.lang='en';return r}", l); ok(t == [nm, rl], f"{tag}: {l} name and role {t}")
    await E("()=>{go('crew');renderAll()}"); await pg.wait_for_timeout(800)
    r = await E("()=>({roles:[...document.querySelectorAll('.crewline .botcard[data-bot]')].map(c=>c.dataset.bot),cards:document.querySelectorAll('.crewline .botcard').length})")   # v93: the cards are the list
    ok(r["roles"] == want and r["cards"] == 9, f"{tag}: nooi Studio lists all nine in order {r}")
    await E("()=>{S.user=null;renderAll()}"); await pg.wait_for_timeout(500)
    r = await E("()=>({ids:[...document.querySelectorAll('#lp-crew .lpbot')].map(x=>x.dataset.bot),h:(document.querySelector('#lp-crew .lph2')||{}).textContent})")
    ok(r["ids"] == want and "Nine" in (r["h"] or ""), f"{tag}: the landing page — nine specialists in order {r}")
    await E("()=>{S.user={name:'T',method:'google'};S.crew.brief.idea='Sara and Omar meet at a café. Sara: Did you see the sunrise? Omar: Every day.';S.crew.brief.lang='en';S.crew.brief.seconds=20;go('crew');renderAll();runCrew()}")
    for _ in range(300):
        st = await E("()=>S.crew.run&&S.crew.run.status")
        if st and st != "running": break
        await pg.wait_for_timeout(500)
    # the page redraws a moment after the run ends — wait for the audio button rather than reading too early
    try: await pg.wait_for_function("()=>!!document.querySelector('[data-act=crew-audio]')", timeout=5000)
    except Exception: pass
    r = await E("()=>{const run=S.crew.run,V=run.out.voice;return {stages:Object.keys(run.stages),cast:V&&V.cast.map(c=>c.voice),lines:V&&V.lines.length,audit:(run.audit||[]).filter(a=>a.severity==='error').map(a=>a.stage+': '+a.problem),echo:!!run.out.sound&&run.out.sound.shots.every(s=>!s.voice_line),tile:(document.querySelector('[data-act=crew-audio]')||{}).textContent}}")
    ok("voice" in r["stages"] and r["lines"] and r["cast"] and all(r["cast"]) and len(set(r["cast"])) == len(r["cast"]), f"{tag}: the film crew runs Lyra's stage — one voice per speaker {r}")
    ok(r["echo"] and not [a for a in r["audit"] if a.startswith(("voice", "sound", "producer"))] and r["tile"] and any(ch.isdigit() for ch in r["tile"]), f"{tag}: Echo writes no spoken lines; no audit errors; the audio button shows its price {r}")
    ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

async def voices(b):
    tag = "voices"; ctx, pg, errs = await page(b, 390); E = pg.evaluate
    api = lambda path, body=None: E("(a)=>API.req(a[0],a[1]?{json:a[1]}:undefined).catch(e=>({err:String(e.message||e)}))", [path, body])
    g = await api("/v1/voice/natural?lang=en"); vs = {v["name"]: v for v in g.get("voices", [])}
    ok(len(vs) == 20 and vs["Sarah"]["sample"] == "free" and vs["George"]["sample"] == "paid", f"{tag}: the library with free / paid samples {[(k, v['sample']) for k, v in vs.items()][:4]}")
    s1 = await api("/v1/voice/sample", {"id": "EXAVITQu4vr4xnSDxMaL", "lang": "en"}); ok(s1.get("cost") == 0 and "/media/vs-" in s1.get("url", "") and ST["prev"] == 1, f"{tag}: the engine's own sample, free {s1}")
    s2 = await api("/v1/voice/sample", {"id": "JBFqnCBsd6RMkjVDRZzb", "lang": "ar"}); s3 = await api("/v1/voice/sample", {"id": "JBFqnCBsd6RMkjVDRZzb", "lang": "ar"})
    ok(s2.get("url") and len(ST["tts"]) == 1 and "George" in ST["tts"][0][1] and s3.get("cost") == 0 and len(ST["tts"]) == 1, f"{tag}: a sample is spoken once in that voice, then kept for everyone {s2} {s3} {ST['tts']}")
    ok((await api("/v1/voice/sample", {"id": "nope"})).get("err"), f"{tag}: an unknown voice is refused")
    await E("()=>{S.chars=[normChar({id:'c1',name:'Sara',age:28,gender:'female',look:'',outfit:'',persona:'',voice:{dialect:'enUS',gender:'female',age:'adult',tone:'warm'},looks:[1,2,3,4],lookSeed:null,locked:true})];S.charSel=0;go('chars');renderAll()}")
    await pg.wait_for_timeout(1200); await E("()=>{const d=document.querySelector('.vp91').closest('details');if(d)d.open=true}"); await pg.wait_for_timeout(200)
    r = await E("()=>[...document.querySelectorAll('.vp91c .vp91pick b')].map(x=>x.textContent)")
    ok(r[0] == "Automatic" and "Sarah" in r and "George" not in r and "River" in r, f"{tag}: a woman's character sees women's voices (and the neutral one) {r}")
    el = await pg.query_selector('.vp91pick[data-id="XrExE9yKIg1WjnnlVkGX"]'); await el.scroll_into_view_if_needed(); await el.tap(); await pg.wait_for_timeout(300)
    ok(await E("()=>S.chars[0].voice.vid") == "XrExE9yKIg1WjnnlVkGX" and await E("()=>document.querySelector('.vp91').closest('details').open"), f"{tag}: Matilda picked for Sara; the Voice section stays open")
    el = await pg.query_selector('.vp91play[data-id="EXAVITQu4vr4xnSDxMaL"]'); await el.scroll_into_view_if_needed(); await el.tap(); await pg.wait_for_timeout(800)
    ok(await E("()=>!!VP91.audio&&/vs-/.test(VP91.audio.src)"), f"{tag}: hear a voice before choosing it")
    await E("()=>{ndState().text='Sara: Did you see the sunrise?\\nOmar: Every day.';ndState().pick={};go('voice');renderAll()}"); await pg.wait_for_timeout(800)
    ok(await E("()=>ndState().pick.Sara") == "XrExE9yKIg1WjnnlVkGX", f"{tag}: the Voice studio gives Sara her voice")
    r = await E("""()=>{const ctx={brief:{lang:'en',seconds:20,idea:'x'},out:{writer:{characters:[{name:'Sara'},{name:'Omar'}],scenes:[]},casting:{characters:[{name:'Sara',gender:'female',age:28},{name:'Omar',gender:'male',age:30}]},director:{shots:[{id:'S1-1'}]}}};
      const o=crewNormalize('voice',{cast:[{name:'Sara',voice:'Lily'},{name:'Omar',voice:'Brian'}],lines:[{id:'S1-1',speaker:'Sara',line:'Hi',delivery:'warm'}]},ctx);return o.cast.map(c=>c.name+':'+c.voice)}""")
    ok("Sara:XrExE9yKIg1WjnnlVkGX" in r and "Omar:nPczCjzI2devNBz1zQrb" in r, f"{tag}: the film crew keeps the voice you chose {r}")
    ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

async def world(b):
    tag = "world"; ctx, pg, errs = await page(b, 1100); E = pg.evaluate
    await E("()=>{go('world');renderAll()}")
    for _ in range(60):
        if await E("()=>!!NW.E&&!NW.busy"): break
        await pg.wait_for_timeout(500)
    await E("()=>{NW.caps=null;S.world.opts.look91=0;S.world.opts.look='fast';const o=API.req;API.req=function(p){if(p==='/v1/world/caps')return Promise.resolve({ai:false,vision:false,worldlabs:false,objects3d:false,pano:true,images:true,cost:{plan:1}});return o.apply(this,arguments)};return nwCaps()}")
    await pg.wait_for_timeout(300)
    r = await E("()=>({look:S.world.opts.look,go:document.querySelector('[data-act=nw-go]').textContent,rc:nwRealCost(),note:(document.querySelector('.nw-note')||{}).textContent})")
    ok(r["look"] == "real" and str(r["rc"]) in r["go"] and "ground" in (r["note"] or ""), f"{tag}: Realistic is the default with the picture engine, its price on Create {r}")
    await E("()=>{S.world.opts.look='fast';const t=document.getElementById('nwprompt');t.value='A desert oasis with palm trees';document.querySelector('[data-act=nw-go]').click()}")
    for _ in range(80):
        if await E("()=>!!NW.W&&!NW.busy"): break
        await pg.wait_for_timeout(500)
    await pg.wait_for_timeout(2500); await E("()=>nwRealistic(null)"); await pg.wait_for_timeout(800)
    r = await E("()=>S.jobs.filter(j=>j.meta&&j.meta.nw).map(j=>[j.meta.nw.role,j.meta.nw.type||''])")
    ok(r and r[0][0] == "pano" and ["ground", ""] in r and ["bb", "palm"] in r, f"{tag}: Realistic asks for the sky, the ground and the plants {r}")
    r = await E("""async()=>{const W=NW.W;await W.setPanorama('/media/pano.jpg');const g=await W.setGround('/media/sand.jpg'),n=await W.setBillboard('palm','/media/palm.png'),bad=await W.setBillboard('palm','/media/sand.jpg');
      return {g,n,bad,env:!!W.scene.environment,map:!!W.scene.getObjectByName('nooi_ground').material.map,bb:W.root.children.filter(o=>o.userData&&o.userData.bb).length,built:W.root.children.filter(o=>o.isInstancedMesh&&o.userData.type==='palm'&&!o.userData.bb&&o.visible).length,plan:[!!W.plan.groundTex,!!(W.plan.billboards||{}).palm]}}""")
    ok(r["g"] and r["map"] and r["env"] and r["n"] > 0 and r["bb"] >= 2 and r["built"] == 0 and r["bad"] == 0 and r["plan"] == [True, True], f"{tag}: the sky lights the world, a photo covers the ground, palms become photo cut-outs (never from a picture without white) {r}")
    await E("()=>nwBuild(Object.assign({},NW.W.plan),{})"); await pg.wait_for_timeout(5000)
    r = await E("()=>({bb:NW.W.root.children.filter(o=>o.userData&&o.userData.bb).length,map:!!NW.W.scene.getObjectByName('nooi_ground').material.map})")
    ok(r["bb"] >= 2 and r["map"], f"{tag}: a saved world comes back real {r}")
    ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

CARDS = """()=>{const vis=e=>{const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return false;const c=getComputedStyle(e);return c.visibility!=='hidden'&&c.display!=='none'&&+c.opacity>0.05};
 const bs=[...document.querySelectorAll('#main button,#main a.btn,#main [role=button]')].filter(vis),over=[];
 for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];if(a.contains(b)||b.contains(a))continue;const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();
  const w=Math.min(A.right,B.right)-Math.max(A.left,B.left),h=Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top);if(w>3&&h>3)over.push([(a.getAttribute('aria-label')||a.textContent||'').trim().slice(0,20),(b.getAttribute('aria-label')||b.textContent||'').trim().slice(0,20)])}
 const big=[...document.querySelectorAll('#main video')].filter(vis).map(v=>{const r=v.getBoundingClientRect();let x=v.parentElement;while(x&&getComputedStyle(x).overflow==='visible'&&x!==document.body)x=x.parentElement;const bb=x.getBoundingClientRect();
  return {w:Math.round(r.width),h:Math.round(r.height),boxW:Math.round(bb.width),boxH:Math.round(bb.height),fit:getComputedStyle(v).objectFit,cls:v.parentElement.className.slice(0,20)}}).filter(o=>o.w>o.boxW+2||o.h>o.boxH+2||(/thumb|hfrm/.test(o.cls)&&o.fit!=='contain'));
 return {over,big}}"""
async def cards(b):
    for w in (390, 1280):
        tag = f"video cards {w}px"; ctx, pg, errs = await page(b, w); E = pg.evaluate
        await E("""()=>{const now=Date.now(),mk=(id,url,aspect)=>({id,kind:'video',status:'complete',prompt:'clip '+id,title:'clip '+id,created:now,progress:1,pal:PALS[0],seed:7,dur:5,aspect,resultUrl:url,model:'seedance',meta:{}});
          S.jobs.push(mk('vc1','/media/a.webm','16:9'),mk('vc2','/media/b.webm','9:16'));S.lastVideo='vc2';S.hf.out=['vc1','vc2'];renderAll()}""")
        for v in ("home", "library", "video"):
            await E("(v)=>{document.getElementById('modalRoot').innerHTML='';go(v);renderAll();scrollTo(0,0)}", v); await pg.wait_for_timeout(1200)
            r = await E(CARDS); out.setdefault("cards", {})[f"{w}:{v}"] = r
            ok(not r["over"], f"{tag}: {v} — buttons on top of each other {r['over'][:4]}")
            ok(not r["big"], f"{tag}: {v} — a video is bigger than its frame or cropped {r['big'][:3]}")
        ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

def server_checks():
    v = subprocess.run(["node", "--input-type=module", "-e", f"""import {{ builtinSkills }} from "{ROOT}/lib/skills.js"; import {{ AGENTS, ROLES_OF }} from "{ROOT}/lib/agents.js";
      const by = {{}}; builtinSkills().forEach((c) => by[c.agent] = (by[c.agent] || 0) + 1); console.log(JSON.stringify({{ by, agents: AGENTS.map((a) => a.id + ":" + a.name + ":" + a.role), video: ROLES_OF.video }})); process.exit(0)"""],
      capture_output=True, text=True, timeout=60, cwd=tempfile.mkdtemp(prefix="nooi-v91s-"), env=dict(os.environ, SECRET_KEY="v" * 40, PUBLIC_BASE_URL="https://x.test", AGENTS_AUTO_LEARN="false"))
    try: v = json.loads(v.stdout.strip().splitlines()[-1])
    except Exception: v = {"err": v.stderr[-400:]}
    out["server"] = v
    ok("voice:Lyra:Dialogue & Voice Director" in v.get("agents", []) and "sound:Echo:Sound Designer" in v.get("agents", []) and v.get("video", [])[4:6] == ["voice", "sound"], f"server: Lyra and Echo in the agents and the plan order {v}")
    ok(v.get("by", {}).get("voice", 0) >= 8 and v.get("by", {}).get("sound", 0) >= 8, f"server: Lyra and Echo each have their craft notes {v.get('by')}")

async def main():
    ms = ThreadingHTTPServer(("127.0.0.1", MP), H); threading.Thread(target=ms.serve_forever, daemon=True).start()
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "GOOGLE_", "KIE_", "FIREBASE_", "DASHSCOPE_", "ELEVENLABS_"))}
    env.update(PORT=str(PORT), SECRET_KEY="v" * 40, PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false", FIREBASE_PROJECT_ID="", ELEVENLABS_API_KEY="el-test", ELEVENLABS_BASE_URL=f"http://localhost:{MP}/el")
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        server_checks()
        async with async_playwright() as p:
            b = await p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            for part in (editor, sketch, agents, voices, world, cards):
                try: await part(b)
                except Exception as e: fails.append(f"{part.__name__}: crashed — {str(e)[:300]}")
            await b.close()
    finally: srv.kill(); ms.shutdown()
    print(json.dumps(out, ensure_ascii=False)[:2500])
    print("\n".join("✗ " + f for f in fails) or "✓ v91: editor, sketch, agents, voices, 3D world, video cards")
    raise SystemExit(1 if fails else 0)

asyncio.run(main())
