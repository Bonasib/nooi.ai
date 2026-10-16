# v93 in a real browser with a real nooi server and a stand-in for the video engine:
#  · Motion Control asks what you want: "Replace the person in the video" (default — Character Swap keeps the video's place,
#    objects, light and camera and changes only the person) or "My character does the moves" (Motion Control 3.0); each shows
#    only its own options (no words box and no framing for a swap), the price is on the button and is what is charged, the
#    engine gets the video and the photo (and nothing else for a swap), files over the engine's 10 MB are caught before
#    anything is charged, and the library picker disappears once a file is in its slot
#  · nooi Studio: Create video, Cinema Studio and the agents' film are one page — one box with the idea on top and one row of
#    option chips (each opens its choices inside the box, one at a time); camera, lens, focal length, aperture, light and
#    ready looks from Cinema Studio are chips there and reach the shot as tested wording (the job keeps the client's words as
#    its title); Cinema Studio's old door opens it; "Who does what" is gone; the tab row has no duplicates
#  · Editor: icons in headings keep their size (the "giant star"); Infographics take your own picture or logo (move, size,
#    frame, caption, kept after a reload) and numbers from a CSV file (a chart); exports record as sharp as the device keeps
#    smooth — the format's own size (1080×1920 for TikTok, not the 608×1080 preview) when a frame draws fast enough, a size in
#    between or the preview's when not ("Fast" always keeps the lighter way); fade in from / out to black;
#    the agents' cards carry each one's job (the separate list was a copy); search still finds nooi Studio by "cinema"
# Run: python3 tests/v93.py
import asyncio, hashlib, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8211, 8212
D = tempfile.mkdtemp(prefix="nooi-v93-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "s" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
def api(p, body=None, token=None):
    h = {"content-type": "application/json"}
    if token: h["authorization"] = "Bearer " + token
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
# (a WebM movement video: the test browser has no H.264, and the page measures the video's shape)
for n, src in (("char.png", "color=c=0x30a050:s=320x480"), ("move.webm", "testsrc2=size=480x270:rate=10")):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", src] + (["-frames:v", "1"] if n.endswith(".png") else ["-t", "4", "-c:v", "libvpx-vp9", "-b:v", "200k"]) + [D + "/media/" + n], check=True)
MOCK = r"""
const http=require('http');const P=+process.argv[2];const st={tasks:[]};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');const send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(u.pathname.startsWith('/out.')){s.setHeader('content-type',u.pathname.endsWith('.png')?'image/png':'video/mp4');return s.end(Buffer.alloc(64))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 if(u.pathname==='/api/v1/jobs/createTask'){const j=JSON.parse(b||'{}'),id='t'+(++n);T[id]=j;st.tasks.push(j);return send({taskId:id})}
 if(u.pathname==='/api/v1/jobs/recordInfo'){const j=T[u.searchParams.get('taskId')]||{};return send({state:'success',resultJson:JSON.stringify({resultUrls:['http://localhost:'+P+'/out.mp4']})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
SET = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}"
async def page(b, w, lang="en"):
    mob = w < 600; ctx = await b.new_context(viewport={"width": w, "height": 860 if mob else 900}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await pg.evaluate(SET, lang); await pg.wait_for_timeout(300)
    return ctx, pg, errs

LIB = """()=>{const mk=(kind,u,dur)=>{const j={id:uid(),kind,status:'complete',resultUrl:u,prompt:kind,title:kind,dur,created:Date.now(),remote:'x'+kind+Math.random()};S.jobs.push(j);return j};
  const v=mk('video','/media/move.webm',4),i=mk('image','/media/char.png');M.mcMove={type:'video',url:v.resultUrl,remote:v.resultUrl,name:'move',libDur:4};M.mcChar={type:'image',url:i.resultUrl,remote:i.resultUrl,name:'char'};S.mc83.consent=true;renderView()}"""
async def motion(b):
    for w, lang in ((390, "ar"), (1280, "en")):
        tag = f"motion {w}"; ctx, pg, errs = await page(b, w, lang); E = pg.evaluate
        await E("()=>{delete S.mc83;M.mcMove=null;M.mcChar=null;go('motion');renderAll()}"); await pg.wait_for_timeout(500)
        r = await E("""()=>({modes:[...document.querySelectorAll('.mcm93')].map(x=>[x.dataset.val,x.getAttribute('aria-checked')]),words:!!document.querySelector('[data-bind="mc83.prompt"]'),frame:!!document.querySelector('[data-set="mc83.orient"]'),
          res:[...document.querySelectorAll('[data-set="mc83.res"]')].map(x=>x.dataset.val),lib:document.querySelectorAll('.mclib83').length,go:document.querySelector('[data-act=mc-make]').textContent,over:document.documentElement.scrollWidth>innerWidth+1})""")
        ok(r["modes"] == [["swap", "true"], ["moves", "false"]], f"{tag}: two jobs, Replace the person first and chosen {r['modes']}")
        ok(not r["words"] and not r["frame"] and r["res"] == ["480p", "720p"] and not r["over"], f"{tag}: a swap shows only its own options {r}")
        await pg.click('[data-set="mc83.mode"][data-val="moves"]'); await pg.wait_for_timeout(250)
        r2 = await E("""()=>({words:!!document.querySelector('[data-bind="mc83.prompt"]'),frame:!!document.querySelector('[data-set="mc83.orient"]'),res:[...document.querySelectorAll('[data-set="mc83.res"]')].map(x=>x.dataset.val)})""")
        ok(r2["words"] and r2["frame"] and r2["res"] == ["720p", "1080p"], f"{tag}: the moves show their words box, framing and quality {r2}")
        await pg.click('[data-set="mc83.mode"][data-val="swap"]'); await pg.wait_for_timeout(200)
        # nothing without the files; a file over 10 MB is caught before anything is charged
        await pg.click('[data-act="mc-make"]'); await pg.wait_for_timeout(300)
        ok(await E("()=>S.jobs.filter(j=>j.meta&&j.meta.motion83).length") == 0, f"{tag}: nothing is made without the files")
        await E(LIB); await E("()=>{M.mcMove.file={size:12*1048576};renderView()}"); await pg.wait_for_timeout(200)
        big = await E("()=>(document.querySelector('.warn83')||{}).textContent||''")
        await pg.click('[data-act="mc-make"]'); await pg.wait_for_timeout(300)
        ok(("10" in big) and await E("()=>S.jobs.filter(j=>j.meta&&j.meta.motion83).length") == 0, f"{tag}: a 12 MB video is caught before charging {big!r}")
        await E("()=>{delete M.mcMove.file;renderView()}"); await pg.wait_for_timeout(200)
        ok(await E("()=>document.querySelectorAll('.mclib83').length") == 0, f"{tag}: the library picker goes away once both files are in")
        if w == 1280:
            shown = await E("()=>+(document.querySelector('[data-act=mc-make] .cost').textContent.match(/\\d+/)||[0])[0]")
            n0 = len(stats()["tasks"]); await pg.click('[data-act="mc-make"]')
            for _ in range(40):
                await pg.wait_for_timeout(400)
                if len(stats()["tasks"]) > n0: break
            t = stats()["tasks"][n0:]; inp = (t[0] if t else {}).get("input", {})
            r = await E("()=>{const j=S.jobs.filter(j=>j.meta&&j.meta.motion83).pop();return j&&{model:j.model,swap:!!j.meta.swap93,aspect:j.aspect,cost:j.cost}}")
            # a customer is charged the price the page shows (the owner's own account isn't charged)
            c0 = api("/v1/billing", token=TOKEN)["credits"]
            jj = api("/v1/jobs", {"kind": "video", "model": "mcswap", "prompt": "", "dur": 4, "aspect": "16:9", "meta": {"motion83": True, "swap93": True, "res": "720p", "consent": True}, "inputs": {"mcChar": "/media/char.png", "mcMove": "/media/move.webm"}}, token=TOKEN)
            c1 = api("/v1/billing", token=TOKEN)["credits"]
            nocons = api("/v1/jobs", {"kind": "video", "model": "mcswap", "prompt": "", "dur": 4, "meta": {"res": "720p"}, "inputs": {"mcChar": "/media/char.png", "mcMove": "/media/move.webm"}}, token=TOKEN)
            out["swap"] = {"job": r, "sent": inp, "credits": [c0, c1], "shown": shown, "api": jj.get("id") or jj}
            ok(t and t[0].get("model") == "wan/2-2-animate-replace", f"{tag}: Replace the person reaches the Character Swap engine {[x.get('model') for x in t]}")
            ok(set(inp) <= {"video_url", "image_url", "resolution", "nsfw_checker"} and inp.get("resolution") == "720p" and inp.get("video_url", "").endswith("move.webm") and inp.get("image_url", "").endswith("char.png"), f"{tag}: the engine gets the video, the photo and the quality — nothing else {inp}")
            ok(r and r["model"] == "mcswap" and r["swap"] and r["aspect"] == "16:9" and r["cost"] == shown, f"{tag}: the swap keeps the video's shape and its price is the one on the button {r} shown {shown}")
            ok(c0 - c1 == shown, f"{tag}: a customer is charged exactly the price on the button {c0}->{c1} shown {shown} {jj}")
            ok(nocons.get("_status") == 400, f"{tag}: no swap without the rights confirmed {nocons}")
            # the moves: Motion Control 3.0 with the words
            await E("()=>{S.mc83.mode='moves';S.mc83.prompt='on a beach';renderView()}"); await pg.wait_for_timeout(300); n0 = len(stats()["tasks"])
            await pg.click('[data-act="mc-make"]')
            for _ in range(40):
                await pg.wait_for_timeout(400)
                if len(stats()["tasks"]) > n0: break
            t = stats()["tasks"][n0:]
            ok(t and t[0].get("model") == "kling-3.0/motion-control" and "on a beach" in t[0].get("input", {}).get("prompt", ""), f"{tag}: My character does the moves reaches Motion Control 3.0 with the words {t[:1]}")
        ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

async def studio(b):
    for w, lang in ((390, "en"), (1280, "ar")):
        tag = f"studio {w}"; ctx, pg, errs = await page(b, w, lang); E = pg.evaluate
        await E("()=>{go('cinema');renderAll()}"); await pg.wait_for_timeout(400)
        r = await E("""()=>({view:S.view,tabs:[...document.querySelectorAll('.hubtabs [data-go]')].map(b=>b.dataset.go),modes:[...document.querySelectorAll('.mode93 [data-go]')].map(b=>b.dataset.go+':'+b.getAttribute('aria-selected')),
          chips:[...document.querySelectorAll('.box93 [data-o93]')].map(c=>c.dataset.o93),pk:document.querySelectorAll('.box93 .opt93 .pk84c').length,open:[...document.querySelectorAll('.box93 .sec93')].filter(x=>!x.hidden).length,
          boxes:document.querySelectorAll('#main .box93').length,gen:!!document.querySelector('.box93 [data-act="gen-video"]'),prompt:!!document.querySelector('.box93 #dprompt'),over:document.documentElement.scrollWidth>innerWidth+1})""")
        out.setdefault("studio", {})[w] = r
        ok(r["view"] == "video" and r["tabs"] == ["video", "motion", "ugcads", "story", "board"], f"{tag}: Cinema Studio opens nooi Studio, the tab row has no duplicates {r['tabs']}")
        ok(r["modes"] == ["video:true", "crew:false"] and r["boxes"] == 1 and r["gen"] and r["prompt"] and not r["over"], f"{tag}: one box with the idea, the options and Generate {r}")
        ok(all(k in r["chips"] for k in ("type", "model", "length", "look", "c_cam", "c_lens", "c_focal", "c_ap", "c_light", "fps", "takes", "sound", "more")) and r["pk"] == 3 and r["open"] == 0, f"{tag}: every option is a chip in the box, all closed {r['chips']}")
        # a chip opens its choices inside the box (one at a time) without redrawing the page
        await pg.click('[data-o93="c_lens"]'); await pg.wait_for_timeout(150)
        r = await E("()=>[...document.querySelectorAll('.box93 .sec93')].filter(x=>!x.hidden).map(x=>x.dataset.sec93)")
        await pg.click('[data-o93="takes"]'); await pg.wait_for_timeout(150)
        r2 = await E("()=>[...document.querySelectorAll('.box93 .sec93')].filter(x=>!x.hidden).map(x=>x.dataset.sec93)")
        ok(r == ["c_lens"] and r2 == ["takes"], f"{tag}: one option open at a time {r} {r2}")
        await pg.click('[data-o93="c_lens"]'); await pg.wait_for_timeout(150)
        await pg.click('[data-set="draft.cine93.lens"][data-val="anamorphic"]'); await pg.wait_for_timeout(250)
        r = await E("()=>({v:(document.querySelector('[data-o93=c_lens] .o93v')||{}).textContent,open:[...document.querySelectorAll('.box93 .sec93')].filter(x=>!x.hidden).map(x=>x.dataset.sec93)})")
        ok(r["open"] == ["c_lens"] and r["v"] in ("Anamorphic", "أنامورفيك"), f"{tag}: a choice shows on its chip and the section stays open {r}")
        await E("()=>document.querySelector('[data-act=look93][data-v=noir]')||(ST93().open='look',renderView())"); await pg.wait_for_timeout(150)
        await E("()=>{const b=document.querySelector('[data-act=look93][data-v=noir]');if(b)b.click()}"); await pg.wait_for_timeout(250)
        r = await E("()=>Object.assign({},S.draft.cine93)")
        ok(r.get("cam") == "vintage" and r.get("light") == "noir", f"{tag}: a ready look sets camera, lens, focal length, aperture and light {r}")
        r = await E("""()=>{S.draft.prompt='A rider crosses the desert at dawn';const n=S.jobs.length;makeVideo();const j=S.jobs.slice(n)[0];return j&&{p:j.prompt,t:j.title,m:j.meta.cinema}}""")
        ok(r and r["p"].startswith("A rider crosses the desert at dawn. ") and "noir" in r["p"] and r["t"] == "A rider crosses the desert at dawn" and r["m"]["light"] == "noir", f"{tag}: the shot gets the camera wording, the title stays the client's words {r}")
        # the agents' film: same page, its box first, no "Who does what"
        await pg.click('.mode93 [data-go="crew"]'); await pg.wait_for_timeout(500)
        r = await E("""()=>({view:S.view,h1:document.querySelector('#main h1').textContent.trim(),roles:!!document.querySelector('.roles90'),box:!!document.querySelector('.box93 [data-act="crew-start"]'),
          first:!!(document.querySelector('.crewgrid').compareDocumentPosition(document.querySelector('.crewline'))&Node.DOCUMENT_POSITION_FOLLOWING),chips:[...document.querySelectorAll('.box93 [data-o93]')].map(c=>c.dataset.o93),tab:(document.querySelector('.hubtabs [aria-selected=true]')||{dataset:{}}).dataset.go,cards:document.querySelectorAll('.crewline .botcard').length})""")
        ok(r["view"] == "crew" and ("nooi Studio" in r["h1"] or "استوديو nooi" in r["h1"]) and not r["roles"] and r["box"] and r["first"] and r["tab"] == "video" and r["cards"] == 9 and all(k in r["chips"] for k in ("len", "genre", "lang")), f"{tag}: the film by the agents — the same page, its box first, no duplicate list {r}")
        ok(await E("()=>!MODELS.mcswap&&!/Character Swap|تبديل الشخصية/.test(document.querySelector('#main').textContent)"), f"{tag}: Character Swap is only on Motion Control, not in nooi Studio's engines")
        r = await E("()=>({door:ALLNAV.some(x=>x[0]==='cinema'),find:['cinema','video','فيديو'].map(q=>(palItems(q)[0]||{act:{}}).act.go),nooi:palItems('nooi').map(x=>x.act.go+':'+!!x.sub.trim())})")
        ok(not r["door"] and r["find"] == ["video"] * 3 and r["nooi"][:2] == ["video:true", "crew:true"], f"{tag}: search finds nooi Studio by cinema / video, each result says what it makes, no second Cinema Studio door {r}")
        ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

async def editor(b):
    tag = "editor"; ctx, pg, errs = await page(b, 390, "en"); E = pg.evaluate
    await E("""()=>{PJ.fresh('edit');S.ed.format='tiktok';S.ed.clips.push({id:uid(),src:{k:'demo',kind:'scene',seed:11},in:0,out:3,speed:1,trans:'cut',vol:100});go('edit');renderAll()}""")
    await pg.wait_for_timeout(800)
    big = {}
    for t in ("info", "audio", "words"):
        await E("(t)=>{S.ed.tab=t;renderView()}", t); await pg.wait_for_timeout(250)
        big[t] = await E("()=>[...document.querySelectorAll('#main svg[viewBox=\"0 0 24 24\"]')].filter(s=>s.getBoundingClientRect().width>48).length")
    ok(not any(big.values()), f"{tag}: no icon fills a panel {big}")
    await E("()=>{S.ed.tab='info';renderView()}"); await pg.wait_for_timeout(200)
    ok(await E("()=>!!document.querySelector('.mine93 [data-ipic93]')&&!!document.querySelector('.mine93 [data-icsv93]')"), f"{tag}: Infographics has uploads for a picture and for numbers")
    await pg.set_input_files("[data-ipic93]", D + "/media/char.png"); await pg.wait_for_timeout(900)
    r = await E("""()=>{const it=(S.ed.infos||[]).find(x=>x.type==='pic');if(!it)return null;ED.playing=false;ED.t=it.start+1;return {id:it.id,img:!!(M['ip_'+it.id]&&M['ip_'+it.id].img.naturalWidth),frame:it.frame,ui:[...document.querySelectorAll('[data-act=ipic-frame]')].length,cap:[...document.querySelectorAll('.edsel .lbl')].map(l=>l.textContent).includes('Caption (optional)')}}""")
    await pg.wait_for_timeout(400)
    px = await E("""(id)=>{const h=(ED.hit||[]).filter(x=>x.k==='info'&&x.id===id).pop(),c=document.getElementById('wk');if(!h)return null;const d=c.getContext('2d').getImageData(Math.round(h.cx),Math.round(h.y+h.h*.4),1,1).data;return [d[0],d[1],d[2]]}""", r and r["id"])
    out["pic"] = [r, px]
    ok(r and r["img"] and r["ui"] == 3 and r["cap"], f"{tag}: your picture becomes an infographic with frame and caption choices {r}")
    ok(px and px[1] > 120 and px[0] < 90, f"{tag}: the picture is drawn on the video {px}")
    open(D + "/nums.csv", "w").write("Quarter,Sales\nQ1,30\nQ2,55\nQ3,70\n")
    await E("()=>{S.ed.sel=null;edSetPick&&edSetPick('clip',S.ed.clips[0].id);renderView()}"); await pg.wait_for_timeout(200)
    await pg.set_input_files("[data-icsv93]", D + "/nums.csv"); await pg.wait_for_timeout(600)
    r = await E("()=>{const b=(S.ed.infos||[]).filter(x=>x.type==='bars').pop();return b&&{t1:b.t1,t2:b.t2}}")
    ok(r and r["t2"] == "Q1:30, Q2:55, Q3:70" and r["t1"] == "nums", f"{tag}: numbers from a CSV file make a chart {r}")
    # the picture comes back after a reload (kept on this device)
    pid = out["pic"][0]["id"] if out["pic"][0] else ""
    await E("()=>persist()"); await pg.reload(); await pg.wait_for_timeout(1500); await E(SET, "en"); await E("()=>{go('edit');S.ed.tab='info';renderAll()}"); await pg.wait_for_timeout(300)
    await E("(id)=>{const it=S.ed.infos.find(x=>x.id===id);ED.playing=false;ED.t=it.start+1}", pid); await pg.wait_for_timeout(1200)
    ok(await E("(id)=>!!(M['ip_'+id]&&M['ip_'+id].img)", pid), f"{tag}: the picture is still there after a reload")
    # fades
    await E("()=>{S.ed.fadeIn93=1;S.ed.fadeOut93=0;ED.playing=false;ED.t=0.02}"); await pg.wait_for_timeout(300)
    dark = await E("()=>{const c=document.getElementById('wk'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i+=4*97)s+=d[i]+d[i+1]+d[i+2];return s/(d.length/(4*97))/3}")
    await E("()=>{ED.t=1.6}"); await pg.wait_for_timeout(300)
    lit = await E("()=>{const c=document.getElementById('wk'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i+=4*97)s+=d[i]+d[i+1]+d[i+2];return s/(d.length/(4*97))/3}")
    ok(dark < 8 and lit > 25, f"{tag}: fade in from black {dark:.1f} → {lit:.1f}")
    # export: the Quality choice, the fades, then the size the export records at
    await E("""()=>{S.ed.fadeIn93=0;S.ed.tab='export';renderView();
      window.__cap=[];const cs=HTMLCanvasElement.prototype.captureStream;HTMLCanvasElement.prototype.captureStream=function(){if(this.id==='wk')window.__cap.push([this.width,this.height]);return cs.apply(this,arguments)}}"""); await pg.wait_for_timeout(200)
    r = await E("()=>({q:[...document.querySelectorAll('[data-set=\"ed.q93\"]')].map(b=>b.textContent),fades:document.querySelectorAll('[data-set=\"ed.fadeIn93\"],[data-set=\"ed.fadeOut93\"]').length,prev:[document.getElementById('wk').width,document.getElementById('wk').height]})")
    ok(len(r["q"]) == 2 and "1080×1920" in r["q"][0] and r["fades"] == 6 and r["prev"] == [608, 1080], f"{tag}: Export has Quality (full size shown) and the fades; the preview stays light {r}")
    # the size follows how fast this device draws a frame (a recording is real time): fast → the format's own size,
    # medium → the largest size that keeps 30 fps, slow → the preview size (this test machine draws slowly, so it's stubbed)
    sz = await E("""()=>{const k1=ED.tk93,k2=ED.ti93,real=[med93(k1),med93(k2)],out=[];
      for(const [d,g] of [[2,16.7],[15,16.7],[80,16.7],[2,300],[2,null]]){ED.tk93=Array(12).fill(d);ED.ti93=g==null?[16]:Array(12).fill(g);out.push(edHQ93())}ED.tk93=k1;ED.ti93=k2;return [out,real,edHQ93()]}""")
    out["hq"] = sz
    ok(sz[0] == [1920, sz[0][1], 0, 0, 0] and 1200 <= sz[0][1] < 1920 and sz[0][1] % 8 == 0 and sz[1][0] is not None and sz[1][1] is not None, f"{tag}: the export size follows the device (fast · medium drawing · slow drawing · slow screen · not yet measured) {sz}")
    await E("()=>{window.__hq=edHQ93;edHQ93=()=>1920}")
    async with pg.expect_download(timeout=60000) as dl:
        await E("()=>edExport()")
    await dl.value; await pg.wait_for_timeout(300)
    r = await E("()=>({cap:window.__cap,after:[document.getElementById('wk').width,document.getElementById('wk').height]})")
    out["export"] = r
    ok(r["cap"] and r["cap"][0] == [1080, 1920], f"{tag}: the export records at 1080×1920 {r}")
    await pg.wait_for_timeout(400)
    ok(await E("()=>[document.getElementById('wk').width,document.getElementById('wk').height]") == [608, 1080], f"{tag}: the preview goes back to its light size after the export")
    await E("()=>{edHQ93=window.__hq}")
    ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

async def main():
    mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            b = await p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
            for part in (motion, studio, editor):
                try: await part(b)
                except Exception as e: fails.append(f"{part.__name__}: crashed — {str(e)[:300]}")
            await b.close()
    finally: srv.kill(); mk.kill()
    print(json.dumps(out, ensure_ascii=False)[:2000])
    print("\n".join("✗ " + f for f in fails) or "✓ v93: Motion Control, nooi Studio, editor")
    raise SystemExit(1 if fails else 0)

asyncio.run(main())
