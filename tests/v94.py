# v94 in a real browser with a real nooi server and a stand-in for the engines (it records every request):
#  · Extend shot continues the same shot: the engine gets the clip's OWN last frame (its source size — not the editor's
#    preview with its texts, safe-zone guide or blurred bars), the clip's own shape, an engine that starts from a frame
#    (the clip's own when it can), words that ask for one continuous take (plus what happens next, if typed), and the new
#    part gets the clip's look. A clip Veo made is continued by Veo itself (extend with that video's engine task); when the
#    whole longer video comes back, only the new seconds are used; if Veo refuses, a new video starts from the clean frame.
#    The server finds the engine task in the user's OWN jobs — a task id sent by the browser is ignored.
#  · An engine id typed in Admin → Models (text-to-video) switches to its picture-to-video form when a start frame is sent.
#  · Sketch: the AI picture takes the drawing's place on the paper; what you draw next goes on the picture and "Update the
#    picture" sends the picture with only those marks (and the words for the change) to an edit engine; the result replaces
#    the picture in the same frame; Undo removes the last mark, then goes back to the previous picture; the eraser removes
#    marks, never the picture; "My drawing" shows the strokes; "New picture" starts again; kept after a reload; Arabic phone.
# Run: python3 tests/v94.py
import asyncio, hashlib, io, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8221, 8222
D = tempfile.mkdtemp(prefix="nooi-v94-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "t" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
for n, args in (("base.webm", ["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=10", "-t", "4", "-c:v", "libvpx-vp9", "-b:v", "300k"]),
                ("long.webm", ["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=10", "-t", "8", "-c:v", "libvpx-vp9", "-b:v", "300k"]),
                ("pic1.png", ["-f", "lavfi", "-i", "color=c=0x2050d0:s=512x512", "-frames:v", "1"]), ("pic2.png", ["-f", "lavfi", "-i", "color=c=0x30b050:s=512x512", "-frames:v", "1"])):
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + args + [D + "/" + n], check=True)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={tasks:[],veo:[],ext:[],failExt:false};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');s.setHeader('access-control-allow-origin','*');
 const send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(u.pathname==='/failext'){st.failExt=u.searchParams.get('on')==='1';return s.end('{}')}
 if(/^\/(base|long)\.webm$|^\/pic[12]\.png$/.test(u.pathname)){s.setHeader('content-type',u.pathname.endsWith('.png')?'image/png':'video/webm');return s.end(fs.readFileSync(path.join(DIR,u.pathname)))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 const out=f=>'http://localhost:'+P+'/'+f;
 if(u.pathname==='/api/v1/jobs/createTask'){const j=JSON.parse(b||'{}'),id='t'+(++n);T[id]=j;st.tasks.push(j);return send({taskId:id})}
 if(u.pathname==='/api/v1/jobs/recordInfo'){const j=T[u.searchParams.get('taskId')]||{},img=!/video|kling|seedance|wan|hailuo|minimax|grok-imagine\/(text|image)-to-video|pixverse|happyhorse/.test(j.model||'');
   const f=img?(/Edit this picture/.test((j.input||{}).prompt||'')?'pic2.png':'pic1.png'):'base.webm';return send({state:'success',resultJson:JSON.stringify({resultUrls:[out(f)]})})}
 if(u.pathname==='/api/v1/veo/generate'){const j=JSON.parse(b||'{}'),id='g'+(++n);T[id]={veo:'gen',...j};st.veo.push(j);return send({taskId:id})}
 if(u.pathname==='/api/v1/veo/extend'){const j=JSON.parse(b||'{}');st.ext.push(j);if(st.failExt){s.setHeader('content-type','application/json');return s.end(JSON.stringify({code:422,msg:'This video cannot be extended'}))}
   const id='e'+(++n);T[id]={veo:'ext',...j};return send({taskId:id})}
 if(u.pathname==='/api/v1/veo/record-info'){const j=T[u.searchParams.get('taskId')]||{};return send({successFlag:1,response:{resultUrls:[out(j.veo==='ext'?'long.webm':'base.webm')]}})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
def mock(p): urllib.request.urlopen(f"http://localhost:{KPORT}{p}").read()
def api(p, body=None, method=None, token=None):
    h = {"content-type": "application/json"}
    if token: h["authorization"] = "Bearer " + token
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def img_at(url):
    if url.startswith("/"): url = f"http://localhost:{PORT}{url}"
    return Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=20).read())).convert("RGB")
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
SET = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}"
async def page(b, w, lang="en"):
    mob = w < 600; ctx = await b.new_context(viewport={"width": w, "height": 860 if mob else 900}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await pg.evaluate(SET, lang); await pg.wait_for_timeout(300)
    return ctx, pg, errs
async def until(pg, js, arg=None, sec=60):
    for _ in range(int(sec * 4)):
        r = await pg.evaluate(js, arg)
        if r: return r
        await pg.wait_for_timeout(250)
    return None

def server_checks():
    tag = "server"
    # an engine id typed in Admin → Models: text-to-video, but with a start frame its picture-to-video form
    r = api("/v1/admin/settings", {"modelCat": {"kling": {"kieModel": "kling-2.6/text-to-video"}}}, "PUT")
    ok(not r.get("_status"), f"{tag}: admin settings saved {r}")
    n0 = len(stats()["tasks"])
    Image.new("RGB", (64, 36), (200, 40, 40)).save(D + "/media/frame-test.jpg")
    a = api("/v1/jobs", {"kind": "video", "prompt": "a car", "model": "kling", "dur": 5, "aspect": "16:9", "inputs": {"startImage": "/media/frame-test.jpg"}})
    b = api("/v1/jobs", {"kind": "video", "prompt": "a car", "model": "kling", "dur": 5, "aspect": "16:9"})
    t = wait(lambda: (lambda x: x if len(x) >= 2 else None)(stats()["tasks"][n0:]), 20) or []
    ms = [x.get("model") for x in t]
    ok(ms[:2] == ["kling-2.6/image-to-video", "kling-2.6/text-to-video"] and (t[0].get("input") or {}).get("image_urls"), f"{tag}: an Admin engine id with a start frame uses its picture-to-video form {ms} {a} {b.get('_status')}")
    api("/v1/admin/settings", {"modelCat": {"kling": {"kieModel": ""}}}, "PUT")
    # a Veo task id sent by the browser is ignored; another user's job can't be extended
    e0 = len(stats()["ext"])
    api("/v1/jobs", {"kind": "video", "prompt": "a car", "model": "veo31f", "dur": 8, "aspect": "16:9", "meta": {"veoTask": "evil-task"}})
    cj = api("/v1/jobs", {"kind": "video", "prompt": "their car", "model": "veo31f", "dur": 8, "aspect": "16:9"}, token=TOKEN)
    wait(lambda: (api(f"/v1/jobs/{cj.get('id')}", token=TOKEN) or {}).get("status") == "done", 30)
    api("/v1/jobs", {"kind": "video", "prompt": "a car", "model": "veo31f", "dur": 8, "aspect": "16:9", "meta": {"extendOf": cj.get("id")}})
    time.sleep(3)
    ok(len(stats()["ext"]) == e0, f"{tag}: a task id from the browser or another user's job never reaches Veo extend {stats()['ext'][e0:]}")

async def extend(b):
    tag = "extend"; ctx, pg, errs = await page(b, 1280, "en"); E = pg.evaluate
    # a Veo clip in a TikTok project, with a caption, the safe-zone guide and a look
    await E("""()=>{window.__base=addJob({kind:'video',prompt:'A red car drives along a coast road at sunset',title:'car',model:'veo31f',dur:8,aspect:'16:9',cost:vcost('veo31f',8),meta:{}})}""")
    ok(await until(pg, "()=>{const j=window.__base&&S.jobs.find(x=>x.id===window.__base.id);return j&&j.status==='complete'&&j.remote&&mediaUrl(j)}", None, 60), f"{tag}: the Veo clip was made")
    await E("""async()=>{PJ.fresh('edit');S.ed.format='tiktok';S.ed.safe=true;const j=S.jobs.find(x=>x.id===window.__base.id);await edUseJob(j,{stay:true,quiet:true});const c=S.ed.clips[S.ed.clips.length-1];c.cg={look:'warm'};
      S.ed.texts=[{id:uid(),text:'BIG TITLE',start:0,end:8,pos:'center',style:'bold',size:12}];go('edit');renderAll()}""")
    ok(await until(pg, "()=>{const c=S.ed.clips[S.ed.clips.length-1],m=c&&clipMedia(c);return m&&m.type==='video'&&m.el.readyState>=2&&m.el.duration>0}", None, 30), f"{tag}: the clip's video loaded")
    r = await E("()=>{const c=S.ed.clips[0];return {cost:edExtCost91(c),model:edExtModel91(c),btn:[...document.querySelectorAll('[data-act=ed-extend91]')].map(b=>b.textContent).join(' | ')}}")
    ok(r["model"] == "veo31f" and str(r["cost"]) in r["btn"], f"{tag}: the clip's own engine, its price on the button {r}")
    e0 = len(stats()["ext"])
    r = await E("""async()=>{const c=S.ed.clips[0],n=S.jobs.length;const ok1=await edExtend91(c,'he opens the door');const j=S.jobs.slice(n).find(x=>x.meta&&x.meta.extend94);
      const f=M.vStart&&M.vStart.file,bm=f&&await createImageBitmap(f);return {ok1,model:j&&j.model,aspect:j&&j.aspect,prompt:j&&j.prompt,dur:j&&j.dur,ext:j&&j.meta.extendOf,base:window.__base.remote,frame:bm&&[bm.width,bm.height],id:j&&j.id}}""")
    out["ext"] = r
    ok(r["ok1"] and r["model"] == "veo31f" and r["aspect"] == "16:9" and r["frame"] == [640, 360] and r["ext"] == r["base"] and r["dur"] == 8, f"{tag}: the request: the clip's own engine and shape (not the TikTok project's), its own 640×360 frame (not the 608×1080 preview), the clip's job {r}")
    ok("One continuous take" in (r["prompt"] or "") and "same place and background" in r["prompt"] and r["prompt"].endswith("Next: he opens the door.") and "A red car drives along a coast road at sunset" in r["prompt"], f"{tag}: the words ask for one continuous take and say what happens next {r['prompt']}")
    x = wait(lambda: stats()["ext"][e0:], 30) or []
    vt = [t.get("taskId") for t in stats()["veo"]]
    ok(x and x[0].get("model") == "fast" and str(x[0].get("taskId", "")).startswith("g") and "Next: he opens the door" in x[0].get("prompt", ""), f"{tag}: Veo continues that same video (extend with its engine task) {x}")
    # the whole longer video came back: only the new seconds are used, right after the clip, with the clip's look
    r = await until(pg, """(id)=>{const c=S.ed.clips.find(q=>q.src&&q.src.k==='job'&&q.src.job===id);if(!c||!(c.out>4.5))return null;return {i:S.ed.clips.indexOf(c),in:c.in,out:c.out,look:c.cg&&c.cg.look,n:S.ed.clips.length,trans:S.ed.clips[0].trans}}""", r["id"], 60)
    out["placed"] = r
    ok(r and r["i"] == 1 and 3.8 <= r["in"] <= 4.2 and 7.8 <= r["out"] <= 8.2 and r["look"] == "warm" and r["trans"] == "cut", f"{tag}: the new part is right after the clip — only its new 4 s (of the 8 s that came back), with the clip's look {r}")
    # Veo refuses → a new video from the clip's clean last frame
    mock("/failext?on=1"); g0 = len(stats()["veo"])
    await E("()=>{const c=S.ed.clips[0];edExtend91(c)}")
    g = wait(lambda: stats()["veo"][g0:], 30) or []
    mock("/failext?on=0")
    fr = None
    if g and (g[0].get("imageUrls") or [None])[0]:
        try: fr = img_at(g[0]["imageUrls"][0]).size
        except Exception as e: fr = str(e)[:80]
    ok(g and fr == (640, 360), f"{tag}: when Veo can't extend, a new video starts from the clean 640×360 frame {fr} {g[:1]}")
    # a clip from an engine without its own extend: the clip's last frame to a picture-to-video engine
    await E("""()=>{const j=S.jobs.find(x=>x.id===window.__base.id);window.__auto={...j,id:uid(),model:'auto',remote:'none'};S.jobs.push(window.__auto);const c=S.ed.clips[0];c.src={k:'job',job:window.__auto.id};delete M['c_'+c.id];renderView()}""")
    await until(pg, "()=>{const m=clipMedia(S.ed.clips[0]);return m&&m.el.readyState>=2}", None, 20)
    t0 = len(stats()["tasks"]); await E("()=>Object.keys(EXT91).forEach(k=>delete EXT91[k])")
    r = await E("async()=>{const c=S.ed.clips[0],n=S.jobs.length;await edExtend91(c);const j=S.jobs.slice(n).find(x=>x.meta&&x.meta.extend94);return {model:j&&j.model,ext:j&&j.meta.extendOf}}")
    t = wait(lambda: stats()["tasks"][t0:], 30) or []
    inp = (t[0].get("input") or {}) if t else {}
    fr = None
    try: fr = img_at((inp.get("image_urls") or [""])[0]).size
    except Exception as e: fr = str(e)[:80]
    ok(r["model"] == "kling30" and not r["ext"] and t and t[0].get("model") == "kling-3.0/video" and fr == (640, 360) and "aspect_ratio" not in inp, f"{tag}: 'nooi Auto' clip → an engine that starts from the frame, which it gets at the clip's size {r} {t[:1] and t[0].get('model')} {fr}")
    # "extend: …" in the prompt box says what happens next
    r = await E("()=>{const p=edCmd91('extend: the car turns onto a bridge');return p&&{d:p.d,cost:p.cost,paid:p.paid}}")
    ok(r and r["paid"] and "the car turns onto a bridge" in r["d"][0], f"{tag}: 'extend: …' in the prompt box {r}")
    ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

PX = "(xy)=>{const c=document.getElementById('skcv');const d=c.getContext('2d').getImageData(Math.round(xy[0]*c.width),Math.round(xy[1]*c.height),1,1).data;return [d[0],d[1],d[2],d[3]]}"
async def sketch(b, w=1280, lang="en"):
    tag = f"sketch {w}/{lang}"; ctx, pg, errs = await page(b, w, lang); E = pg.evaluate
    await E("()=>{S.sketch.n91=1;S.sketch.prompt='a red car';S.sketch.pic94=null;S.sketch.hist94=[];S.sketch.k94=0;go('sketch');renderAll()}"); await pg.wait_for_timeout(500)
    await E("()=>{SK.strokes=[{tool:'pen',color:'#111111',size:10,pts:[[.2,.3,.6],[.5,.3,.6],[.8,.3,.6]]}];SK.redo=[];SK91.sig='';skRedraw()}"); await pg.wait_for_timeout(200)
    ok((await E(PX, [.5, .3]))[3] > 200, f"{tag}: the drawing is on the paper")
    t0 = len(stats()["tasks"])
    await pg.click('[data-act="sk91-go"]')
    r = await until(pg, "()=>{const p=skPic94();return p&&{id:p.id,src:(document.querySelector('.skpaper .skpic94')||{}).src,url:mediaUrl(p),k:S.sketch.k94}}", None, 60)
    out["first"] = r
    ok(r and r["src"] == r["url"] and r["k"] == 1, f"{tag}: the AI picture takes the drawing's place on the paper {r}")
    await pg.wait_for_timeout(300)
    ok((await E(PX, [.5, .3]))[3] == 0, f"{tag}: the strokes it was made from are under the picture, not on top of it")
    r = await E("()=>({btn:(document.querySelector('[data-act=sk91-go]')||{}).textContent,n:!!document.querySelector('.sk91n'),chg:!!document.querySelector('#skchg94'),view:[...document.querySelectorAll('[data-act=sk94-view]')].length,newp:!!document.querySelector('[data-act=sk94-new]')})")
    ok(r["btn"].startswith(("Update the picture", "حدّث الصورة")) and not r["n"] and r["chg"] and r["view"] == 2 and r["newp"], f"{tag}: one 'Update the picture' button, a box for the change, Picture / My drawing, New picture {r}")
    # "My drawing" shows the strokes; back to the picture
    await pg.click('[data-act="sk94-view"][data-v="draw"]'); await pg.wait_for_timeout(300)
    r = [await E("()=>!!document.querySelector('.skpaper .skpic94')"), (await E(PX, [.5, .3]))[3]]
    await pg.click('[data-act="sk94-view"][data-v="pic"]'); await pg.wait_for_timeout(300)
    ok(r[0] is False and r[1] > 200, f"{tag}: 'My drawing' shows the strokes {r}")
    # a red mark on the picture, then Update: the picture with only that mark goes to the edit engine
    await E("()=>{SK.strokes.push({tool:'marker',color:'#e01010',size:30,pts:[[.45,.7,.8],[.55,.7,.8]]});skRedraw()}"); await pg.wait_for_timeout(200)
    ok((await E(PX, [.5, .7]))[3] > 60, f"{tag}: the new mark shows on the picture")
    await E("()=>{const i=document.getElementById('skchg94');i.value='make it a hat';i.dispatchEvent(new Event('input',{bubbles:true}));S.sketch.chg94='make it a hat'}")
    t0 = len(stats()["tasks"])
    await pg.click('[data-act="sk91-go"]')
    t = wait(lambda: stats()["tasks"][t0:], 30) or []
    inp = (t[0].get("input") or {}) if t else {}
    pv = None
    try:
        im = img_at((inp.get("image_urls") or inp.get("image_input") or [""])[0]); W, H = im.size; pv = [W, H, im.getpixel((int(W * .5), int(H * .7))), im.getpixel((int(W * .5), int(H * .3))), im.getpixel((int(W * .2), int(H * .85)))]
    except Exception as e: pv = str(e)[:100]
    out["edit"] = {"model": t and t[0].get("model"), "img": pv, "prompt": inp.get("prompt", "")[:300]}
    red = lambda p: p[0] > 110 and p[0] > p[2] + 20 and p[1] < 110   # the marker is see-through: red over the blue picture, as on the paper
    blue = lambda p: p[2] > 150 and p[0] < 90
    ok(isinstance(pv, list) and pv[:2] == [1024, 1024] and red(pv[2]) and blue(pv[3]) and blue(pv[4]), f"{tag}: the engine gets the picture itself with only the new mark on it (the old strokes are not drawn again) {pv}")
    ok("Keep everything else exactly as it is" in inp.get("prompt", "") and "hand-drawn lines" in inp.get("prompt", "") and "make it a hat" in inp.get("prompt", "") and str(t and t[0].get("model")).startswith("nano-banana"), f"{tag}: the edit engine is told to change only what was marked {out['edit']['model']} {inp.get('prompt','')[:160]}")
    r = await until(pg, "(old)=>{const p=skPic94();return p&&p.id!==old&&{id:p.id,src:(document.querySelector('.skpaper .skpic94')||{}).src,url:mediaUrl(p),k:S.sketch.k94,hist:S.sketch.hist94.length}}", out["first"] and out["first"]["id"], 60)
    out["second"] = r
    ok(r and r["src"] == r["url"] and "pic2" in r["url"] and r["k"] == 2 and r["hist"] == 1, f"{tag}: the changed picture replaces it in the same frame {r}")
    await pg.wait_for_timeout(300)
    ok((await E(PX, [.5, .7]))[3] == 0, f"{tag}: the mark is now part of the picture")
    # Undo (no new marks): back to the previous picture, the mark shows again over it
    await pg.click('[data-act="sk-undo"]'); await pg.wait_for_timeout(400)
    r = await E("(id)=>({back:S.sketch.pic94===id,k:S.sketch.k94,src:(document.querySelector('.skpaper .skpic94')||{}).src||''})", out["first"] and out["first"]["id"])
    ok(r["back"] and r["k"] == 1 and "pic1" in r["src"] and (await E(PX, [.5, .7]))[3] > 60, f"{tag}: Undo goes back to the previous picture, with the mark that changed it {r}")
    # the eraser removes marks, never the picture
    await E("()=>{SK.strokes.push({tool:'eraser',color:'#000',size:40,pts:[[.42,.7,.8],[.58,.7,.8]]});SK91.sig='';skRedraw()}"); await pg.wait_for_timeout(200)
    ok((await E(PX, [.5, .7]))[3] == 0 and await E("()=>!!document.querySelector('.skpaper .skpic94')"), f"{tag}: the eraser takes the mark away and leaves the picture")
    # Clear on the picture: only the marks
    await pg.click('[data-act="sk-clear"]'); await pg.click('[data-act="sk-clear"]'); await pg.wait_for_timeout(200)
    ok(await E("()=>SK.strokes.length===S.sketch.k94&&!!skPic94()"), f"{tag}: Clear removes the marks on the picture, not the picture or the drawing")
    # kept after a reload
    await E("()=>persist()"); await pg.wait_for_timeout(600); await pg.reload(); await pg.wait_for_timeout(1500); await E(SET, lang); await E("()=>{go('sketch');renderAll()}"); await pg.wait_for_timeout(800)
    ok(await E("(id)=>S.sketch.pic94===id&&!!document.querySelector('.skpaper .skpic94')", out["first"] and out["first"]["id"]), f"{tag}: the picture is still on the paper after a reload")
    if w < 600:
        r = await E("()=>{const b=document.querySelector('[data-act=sk91-go]').getBoundingClientRect();return {wide:document.documentElement.scrollWidth-innerWidth,btn:b.width>100,bar:[...document.querySelectorAll('.sk94bar>*')].every(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1})}}")
        ok(r["wide"] <= 1 and r["btn"] and r["bar"], f"{tag}: fits the phone {r}")
    # New picture: back to the drawing, versions again
    await pg.click('[data-act="sk94-new"]'); await pg.wait_for_timeout(400)
    r = await E("()=>({pic:skPic94(),n:!!document.querySelector('.sk91n'),btn:(document.querySelector('[data-act=sk91-go]')||{}).textContent,layer:!!document.querySelector('.skpic94')})")
    ok(not r["pic"] and r["n"] and not r["layer"] and r["btn"].startswith(("Preview with AI", "معاينة بالذكاء")), f"{tag}: New picture goes back to the drawing (and the versions) {r}")
    ok(not errs, f"{tag}: page errors {errs[:3]}"); await ctx.close()

async def main():
    mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        try: server_checks()
        except Exception as e: fails.append(f"server: crashed — {str(e)[:300]}")
        async with async_playwright() as p:
            b = await p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
            for part, a in ((extend, ()), (sketch, ()), (sketch, (390, "ar"))):
                try: await part(b, *a)
                except Exception as e: fails.append(f"{part.__name__}{a}: crashed — {str(e)[:300]}")
            await b.close()
    finally: srv.kill(); mk.kill()
    print(json.dumps(out, ensure_ascii=False, default=str)[:2500])
    print("\n".join("✗ " + f for f in fails) or "✓ v94: Extend continues the same shot · sketch changes the same picture")
    raise SystemExit(1 if fails else 0)

asyncio.run(main())
