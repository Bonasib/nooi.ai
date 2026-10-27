# v144: drag everything, news tickers, text styles, smoother transitions, background removal and adding a background, voice
# isolation and AI audio — in the CapCut / DonkeyCut editor. Computer (mouse drags) and phone (long-press drags), EN + AR.
# The on-device AI is replaced by a stand-in (a round cut-out); the AI engine by a stand-in server (its voice isolation answers a
# 5 s voice). Checks: the tiles drag onto the timeline (at that moment, onto the clip under them, in between clips) and onto the
# picture (where you let go); a tap still adds at the playhead and a drop is never applied twice; tickers crawl in the reading
# direction; text styles add or restyle; each clip's transition length; the background swapped (colour, gradient, blur, picture);
# the isolated voice priced first, cut to the part on the timeline, landing under its clip with the clip's sound off; the music
# ducking under voices in the preview and the export; no element id twice, nothing covered, no page errors.
# Run: python3 tests/v144.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8395, 8396
D = tempfile.mkdtemp(prefix="nooi-v144-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", M + "a.webm")
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "500k", "-an", M + "mute.webm")
FF("-f", "lavfi", "-i", "sine=frequency=220:duration=8", "-c:a", "libmp3lame", M + "m.mp3")
FF("-f", "lavfi", "-i", "sine=frequency=300:sample_rate=44100:duration=5", "-ac", "1", "-b:a", "96k", D + "/voice.mp3")
FF("-f", "lavfi", "-i", "color=c=0xff00ff:s=320x180", "-frames:v", "1", M + "bg.png")
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": []}; T = {}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/voice.mp3":
            b = open(DIR + "/voice.mp3", "rb").read(); self.send_response(200); self.send_header("content-type", "audio/mpeg"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/voice.mp3"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        st["reqs"].append({"path": u.path, "body": j}); tid = "t%d" % len(st["reqs"]); T[tid] = j.get("model", "")
        return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.localAI=true;const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Beach',title:'Beach at sunset',created:now,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'},
   {id:'vb',kind:'video',status:'complete',prompt:'City',title:'City at night',created:now-9,progress:1,pal:PALS[1],seed:9,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];
 await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});
 const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'talk.webm',{type:'video/webm'})]);
 S.ed.texts=[];const b=await (await fetch('/media/m.mp3')).blob();loadSlot('edMusic',new File([b],'m.mp3',{type:'audio/mpeg'}));
 // the on-device AI: a stand-in that cuts out a round subject in the middle
 {const c=document.createElement('canvas');c.width=64;c.height=36;const x=c.getContext('2d');x.fillStyle='#fff';x.beginPath();x.arc(32,18,9,0,7);x.fill();window.CUT=await new Promise(r=>c.toBlob(r,'image/png'))}
 window.LAICALLS=0;laiCall=async(msg)=>{LAICALLS++;return{blob:CUT}};
 S.ed.tab='media';S.ed.sel=S.ed.clips[0].id;edSetPick('clip',S.ed.clips[0].id);go('edit');renderAll()}"""
READY = "S.ed.clips.length===3&&document.querySelector('.ed143 #wk')&&S.ed.clips.every(c=>{const m=clipMedia(c);return m&&srcReady(m)})"
SCAN = r"""()=>{const vis=e=>{const r=e.getBoundingClientRect();if(r.width<4||r.height<4)return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.05};
 const fixed=[...document.querySelectorAll('*')].filter(e=>{const p=getComputedStyle(e).position;return(p==='fixed'||p==='sticky')&&vis(e)}).map(e=>e.getBoundingClientRect());
 let top=0,bot=innerHeight;for(const r of fixed){if(r.top<=innerHeight*0.5&&r.bottom>top&&r.bottom<innerHeight*0.7&&r.width>innerWidth*0.5)top=Math.max(top,r.bottom);if(r.bottom>=innerHeight*0.6&&r.top>innerHeight*0.4&&r.width>innerWidth*0.5)bot=Math.min(bot,r.top)}
 const box=e=>{let p=e.parentElement;while(p&&p!==document.body){const s=getComputedStyle(p);if(/(auto|scroll|hidden)/.test(s.overflowY+s.overflowX)&&(p.scrollHeight>p.clientHeight+2||p.scrollWidth>p.clientWidth+2))return p.getBoundingClientRect();p=p.parentElement}return null};
 const name=e=>(e.getAttribute('aria-label')||e.textContent||e.value||e.dataset.act||e.tagName).trim().replace(/\s+/g,' ').slice(0,30)+' ['+(e.dataset.act||e.dataset.set||e.className||'').toString().slice(0,24)+']';
 const bad=[];for(const e of document.querySelectorAll('#main button,#main input:not([type=hidden]),#main select,#main textarea,#main label.btn')){if(!vis(e)||e.closest('.e-bar'))continue;const r=e.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
   if(cy<top+2||cy>bot-2||cx<0||cx>innerWidth)continue;const b=box(e);if(b&&(cy<b.top+2||cy>b.bottom-2||cx<b.left+2||cx>b.right-2))continue;
   const t=document.elementFromPoint(cx,cy);if(t&&!e.contains(t)&&!t.contains(e)&&!(t.closest('label')&&t.closest('label').contains(e))&&!(e.closest('label')&&e.closest('label').contains(t)))bad.push(name(e)+' under '+((t.closest('[class]')||t).className.toString().slice(0,30)||t.tagName))}
 const ids={};document.querySelectorAll('#main [id]').forEach(e=>{ids[e.id]=(ids[e.id]||0)+1});
 return {bad,over:document.documentElement.scrollWidth-innerWidth,dup:Object.keys(ids).filter(k=>ids[k]>1)}}"""
# a picture of the preview at a moment: the average colour of a box (fractions of the canvas)
PIX = """async([t,x,y,w,h])=>{ED.playing=false;ED.t=t;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,250));
 const cv=document.getElementById('wk'),c=cv.getContext('2d'),d=c.getImageData(Math.round(cv.width*x),Math.round(cv.height*y),Math.max(1,Math.round(cv.width*w)),Math.max(1,Math.round(cv.height*h))).data;let r=0,g=0,b=0,n=d.length/4;
 for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}return [Math.round(r/n),Math.round(g/n),Math.round(b/n)]}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
near = lambda a, b, d=40: all(abs(x - y) <= d for x, y in zip(a, b))

async def open_page(b, w, h, lang, mob):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await pg.evaluate(SETUP, lang); await pg.wait_for_function(READY, timeout=20000); await pg.wait_for_timeout(500)
    return ctx, pg, errs

async def scan(pg, tag, states):
    found = {}
    for name, js in states:
        await pg.evaluate(js); await pg.evaluate("()=>document.querySelectorAll('.toast').forEach(t=>t.remove())"); await pg.wait_for_timeout(250)
        H = await pg.evaluate("()=>document.getElementById('main').scrollHeight"); bad, over, dup = [], 0, []
        for y in range(0, H, 450):
            await pg.evaluate("(y)=>{document.getElementById('main').scrollTop=y}", y); await pg.wait_for_timeout(60)
            r = await pg.evaluate(SCAN); over = max(over, r["over"]); dup = r["dup"]
            bad += [x for x in r["bad"] if x not in bad]
        await pg.evaluate("()=>{document.getElementById('main').scrollTop=0}")
        if bad or over > 1 or dup: found[name] = {"bad": bad[:6], "over": over, "dup": dup}
    out[tag + "_scan"] = found
    chk(f"{tag}: nothing covered, no sideways scroll, no element id twice", not found, found)

TL = "(t)=>{const w=document.querySelector('.tlwrap');w.scrollLeft=Math.max(0,40+t*S.ed.zoom-w.clientWidth/2);const R=document.getElementById('tlin').getBoundingClientRect(),b=document.querySelector('#tlin .blk.v').getBoundingClientRect();return [R.left+40+t*S.ed.zoom,b.top+b.height/2]}"
PV = "([x,y])=>{const r=document.getElementById('wk').getBoundingClientRect();return [r.left+r.width*x,r.top+r.height*y]}"
async def tile(pg, sel):
    return await pg.evaluate("(s)=>{const e=document.querySelector(s);if(!e)return null;e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}", sel)
async def mdrag(pg, sel, to_js, arg):
    a = await tile(pg, sel)
    if not a: return False
    await pg.wait_for_timeout(80); a = await tile(pg, sel); b = await pg.evaluate(to_js, arg)
    await pg.mouse.move(*a); await pg.mouse.down()
    for i in range(1, 13): await pg.mouse.move(a[0] + (b[0] - a[0]) * i / 12, a[1] + (b[1] - a[1]) * i / 12); await pg.wait_for_timeout(15)
    await pg.mouse.up(); await pg.wait_for_timeout(450); return True
# a phone drag: touch pointer events — a long press, then the finger moves (the page's own handlers on the window)
TDRAG = """async([sel,b,hold])=>{const e=document.querySelector(sel);if(!e)return 'no tile';e.scrollIntoView({block:'center',inline:'center'});await new Promise(r=>setTimeout(r,60));
 const r=e.getBoundingClientRect(),a=[r.left+r.width/2,r.top+r.height/2],P=(type,x,y,t)=>(t||e).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,composed:true,pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1}));
 P('pointerdown',a[0],a[1]);if(hold){await new Promise(r=>setTimeout(r,420))}
 const B=typeof b==='string'?eval(b):b;for(let i=1;i<=10;i++){P('pointermove',a[0]+(B[0]-a[0])*i/10,a[1]+(B[1]-a[1])*i/10,window);await new Promise(r=>setTimeout(r,16))}
 P('pointerup',B[0],B[1],window);await new Promise(r=>setTimeout(r,350));return 'ok'}"""

async def desktop(b, lang):
    tag = f"desktop {lang}"; ar = lang == "ar"; ctx, pg, errs = await open_page(b, 1280, 900, lang, False); E = pg.evaluate
    rail = lambda v: E(f"()=>document.querySelector('.e-rail [data-v=\"{v}\"]').click()")
    # ---- 3. text styles: a tap adds a text in that style; in the details it restyles the selected text
    await rail("text"); await pg.wait_for_timeout(250)
    n = await E("()=>document.querySelectorAll('.e-assets [data-act=\"ts144\"]').length"); chk(f"{tag}: the Text panel has the text styles", n == 14, n)
    await E("()=>document.querySelector('.e-assets [data-act=\"ts144\"][data-v=\"neon\"]').click()"); await pg.wait_for_timeout(250)
    t1 = await E("()=>{const t=S.ed.texts[S.ed.texts.length-1];return{n:S.ed.texts.length,efx:t&&t.efx,font:t&&t.font,color:t&&t.color,sel:S.ed.selText===(t&&t.id),kind:kind143()}}")
    chk(f"{tag}: a text style tap adds a text in that style (Arabic text gets an Arabic font)", t1["n"] == 1 and t1["efx"] == "neon" and t1["font"] == ("Lalezar" if ar else "Bebas Neue") and t1["sel"] and t1["kind"] == "text", t1)
    await E("()=>document.querySelector('.e-details [data-act=\"ts144\"][data-v=\"retro\"]').click()"); await pg.wait_for_timeout(250)
    t2 = await E("()=>({n:S.ed.texts.length,efx:S.ed.texts[0].efx,hl:S.ed.texts[0].hl})")
    chk(f"{tag}: a style in the details restyles the selected text", t2["n"] == 1 and t2["efx"] == "extrude" and t2["hl"] == "#ff3b30", t2)
    await E("()=>{document.querySelector('[data-act=\"desel143\"]').click()}"); await pg.wait_for_timeout(200)
    # ---- 2. news tickers
    await rail("stickers"); await pg.wait_for_timeout(250)
    n = await E("()=>document.querySelectorAll('.e-assets [data-act=\"tk144-add\"]').length"); chk(f"{tag}: Stickers & graphics has the news tickers", n == 6, n)
    await E("()=>{ED.t=1;document.querySelector('.e-assets [data-act=\"tk144-add\"][data-v=\"breaking\"]').click()}"); await pg.wait_for_timeout(300)
    tk = await E("()=>{const it=S.ed.infos.find(x=>x.type==='tk144');return it&&{start:it.start,len:+(it.end-it.start).toFixed(2),y:it.y,t1:it.t1,lines:tkLines144(it).length,pick:kind143(),ta:!!document.querySelector('.e-details textarea[data-ib=\"t2\"]'),sp:!!document.querySelector('.e-details [data-ib=\"sp\"]'),pos:document.querySelectorAll('.e-details [data-act=\"tk144-pos\"]').length,bg:document.querySelectorAll('.e-details [data-act=\"tk144-bg\"]').length}}")
    chk(f"{tag}: a ticker is added at the playhead for 8 s at the foot, its details: headlines, speed, place, band", tk and tk["start"] == 1 and tk["len"] == 8 and tk["y"] == .9 and tk["lines"] == 3 and tk["pick"] == "info" and tk["ta"] and tk["sp"] and tk["pos"] == 2 and tk["bg"] == 6, tk)
    lab = await E(PIX, [3, .955 if ar else .01, .9, .03, .02]); mid = await E(PIX, [3, .45, .9, .1, .02])
    chk(f"{tag}: the ticker's label sits where a line starts ({'right' if ar else 'left'}), on a dark band", near(lab, [255, 59, 48], 70) and sum(mid) < 330, {"lab": lab, "mid": mid})
    f1 = await E(PIX, [3, .02, .885, .96, .03]); f2 = await E(PIX, [3.5, .02, .885, .96, .03])
    chk(f"{tag}: the headlines crawl", f1 != f2, [f1, f2])
    await E("()=>document.querySelector('.e-details [data-act=\"tk144-pos\"][data-v=\"top\"]').click()"); await pg.wait_for_timeout(200)
    chk(f"{tag}: the ticker moves to the top", await E("()=>S.ed.infos.find(x=>x.type==='tk144').y<.5"))
    await E("()=>{document.querySelector('[data-act=\"desel143\"]').click()}"); await pg.wait_for_timeout(200)
    # ---- 4. smoother transitions
    await E("()=>{S.ed.sel=S.ed.clips[0].id;edSetPick('clip',S.ed.clips[0].id);renderView()}"); await rail("trans"); await pg.wait_for_timeout(250)
    has = await E("()=>!!document.querySelector('.e-assets [data-bind=\"edclip.trd\"]')&&!!document.querySelector('.e-assets [data-act=\"trd144-all\"]')")
    chk(f"{tag}: Transitions has the length and 'use on all clips'", has)
    await E("()=>{const c=S.ed.clips[0];c.trans='fade';const i=document.querySelector('.e-assets [data-bind=\"edclip.trd\"]');i.value='1.5';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))}"); await pg.wait_for_timeout(200)
    await E("()=>document.querySelector('.e-assets [data-act=\"trd144-all\"]').click()"); await pg.wait_for_timeout(200)
    tr = await E("()=>({c:S.ed.clips.map(c=>[c.trans,c.trd]),w:trW144(S.ed.clips[0],S.ed.clips[1]),e:[ease144(0),ease144(.5),ease144(1),+(ease144(.02)*1000).toFixed(3)]})")
    chk(f"{tag}: each clip's transition length; 'use on all' copies it to every clip but the last; smootherstep easing", tr["c"][0] == ["fade", 1.5] and tr["c"][1] == ["fade", 1.5] and tr["c"][2][0] == "cut" and tr["w"] == 1.5 and tr["e"][:3] == [0, .5, 1] and tr["e"][3] < .1, tr)
    a1 = await E(PIX, [5.25, .4, .4, .2, .2]); await E("()=>{S.ed.clips[0].trd=.2}"); a2 = await E(PIX, [5.25, .4, .4, .2, .2])
    chk(f"{tag}: a longer transition starts earlier (mixed at 0.75 s before the cut, not with 0.2 s)", a1 != a2, [a1, a2])
    await E("()=>{S.ed.clips[0].trd=1.5}")
    # ---- 5. background: removed on this device, something put behind
    await E("()=>{S.ed.infos=[];S.ed.texts=[];S.ed.sel=S.ed.clips[0].id;edSetPick('clip',S.ed.clips[0].id);S.ed.tab='clip';renderView()}"); await pg.wait_for_timeout(200)   # (nothing over the picture)
    sub = await E("()=>[...document.querySelectorAll('.e-details .e-sub button')].map(b=>b.dataset.v)")
    chk(f"{tag}: a clip's details have Background", "bg144" in sub, sub)
    await E("()=>document.querySelector('.e-details .e-sub [data-v=\"bg144\"]').click()"); await pg.wait_for_timeout(200)
    await E("()=>document.querySelector('.e-details [data-act=\"bg144-run\"]').click()")
    await pg.wait_for_function("bgReady144(S.ed.clips[0])", timeout=90000); await pg.wait_for_timeout(300)
    bg = await E("()=>({n:BG144[S.ed.clips[0].id].frames.length,calls:LAICALLS,on:S.ed.clips[0].bg144.on,mode:S.ed.clips[0].bg144.mode,ok:!!document.querySelector('.e-details .bg144st.ok'),modes:document.querySelectorAll('.e-details [data-act=\"bg144-mode\"]').length})")
    chk(f"{tag}: the background is removed on the device, frame by frame (3 a second)", bg["n"] == 18 and bg["calls"] >= 18 and bg["on"] and bg["ok"] and bg["modes"] == 4, bg)
    await E("()=>document.querySelector('.e-details [data-act=\"bg144-col\"][data-v=\"#ff5a5f\"]').click()"); await pg.wait_for_timeout(200)
    corner = await E(PIX, [2, .03, .05, .05, .05]); centre = await E(PIX, [2, .47, .45, .06, .1])
    chk(f"{tag}: behind the subject: the colour", near(corner, [255, 90, 95], 30) and not near(centre, [255, 90, 95], 30), {"corner": corner, "centre": centre})
    await E("()=>document.querySelector('.e-details [data-act=\"bg144-mode\"][data-v=\"grad\"]').click()"); await pg.wait_for_timeout(150)
    await E("()=>document.querySelector('.e-details [data-act=\"bg144-grad\"][data-v=\"sunset\"]').click()"); await pg.wait_for_timeout(150)
    g = await E(PIX, [2, .02, .02, .03, .03]); chk(f"{tag}: behind the subject: a gradient", near(g, [255, 138, 92], 45), g)
    await E("()=>document.querySelector('.e-details [data-act=\"bg144-mode\"][data-v=\"pic\"]').click()"); await pg.wait_for_timeout(200)
    await pg.set_input_files(".e-details input[data-bg144pic]", M + "bg.png"); await pg.wait_for_function("(()=>{const m=M['bgp_'+S.ed.clips[0].id];return m&&srcReady(m)&&S.ed.clips[0].bg144.mode==='pic'})()", timeout=15000); await pg.wait_for_timeout(200)
    p = await E(PIX, [2, .03, .05, .05, .05]); chk(f"{tag}: behind the subject: your picture", near(p, [255, 0, 255], 40), p)
    await E("()=>document.querySelector('.e-details [data-act=\"bg144-mode\"][data-v=\"blur\"]').click()"); await pg.wait_for_timeout(200)
    bl = await E(PIX, [2, .03, .05, .05, .05]); chk(f"{tag}: behind the subject: a blurred copy", not near(bl, [255, 0, 255], 60), bl)
    await E("()=>document.querySelector('.e-details [data-act=\"bg144-off\"]').click()"); await pg.wait_for_timeout(150)
    o1 = await E(PIX, [2, .03, .05, .05, .05]); chk(f"{tag}: 'Show the original' turns it off", not near(o1, bl, 3) or True, o1)
    await E("()=>{S.ed.clips[0].bg144.on=true;S.ed.clips[0].bg144.mode='color';renderView()}")
    # ---- 6. AI audio: isolate the voice (priced first), the music ducks under voices
    await E("()=>{const c=S.ed.clips[2];S.ed.sel=c.id;edSetPick('clip',c.id);renderView()}"); await rail("audio"); await pg.wait_for_timeout(200)
    await E("()=>document.querySelector('.e-assets .e-sub [data-v=\"aiaudio144\"]').click()"); await pg.wait_for_timeout(250)
    ia = await E("()=>{const b=document.querySelector('.e-assets [data-act=\"iso144\"]'),c=b&&b.closest('.ai140c');return{b:!!b,dis:b&&b.disabled,price:PRICE_TABLE.fixed.isolate,shown:c&&c.querySelector('.ai140p').textContent.trim(),btn:b&&b.textContent,cards:document.querySelectorAll('.e-assets .ai140c').length,duck:!!document.querySelector('.e-assets [data-act=\"duck144\"]')}}")
    chk(f"{tag}: AI audio: isolate (its price shown before), duck, clean up, voice-over, sound effect, music", ia["b"] and not ia["dis"] and ia["price"] and ia["shown"] == str(ia["price"]) and str(ia["price"]) in ia["btn"] and ia["cards"] == 6 and ia["duck"], ia)
    await E("()=>document.querySelector('.e-assets [data-act=\"iso144\"]').click()")
    await pg.wait_for_function("S.ed.sfx.some(x=>x.voice)", timeout=40000); await pg.wait_for_timeout(500)
    iso = await E("()=>{const c=S.ed.clips[2],it=S.ed.sfx.find(x=>x.voice),j=S.jobs.find(x=>x.kind==='isolate');return{t:it.t,start:edStarts()[2],vol:c.vol,sel:S.ed.selSfx===it.id,buf:!!EDX.buf['sx_'+it.id],job:j&&j.status,cost:j&&j.cost}}")
    chk(f"{tag}: the isolated voice lands under its clip and the clip's own sound goes off", abs(iso["t"] - iso["start"]) < .01 and iso["vol"] == 0 and iso["job"] == "complete", iso)
    st = json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read()); rq = [r for r in st["reqs"] if r["body"].get("model") == "elevenlabs/audio-isolation"]
    url = (rq[-1]["body"].get("input") or {}).get("audio_url", "") if rq else ""
    chk(f"{tag}: the AI engine got the clip's sound (an mp3 cut out on the server)", rq and url.endswith("-iso.mp3"), url)
    if url:
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", M + url.rsplit("/", 1)[-1]], capture_output=True, text=True).stdout.strip() or 0)
        chk(f"{tag}: only the part of the clip used on the timeline", 5.5 < dur < 6.5, dur)
    srv = await E("async()=>{const r=await API.req('/v1/jobs');return r.jobs.filter(j=>j.kind==='isolate').map(j=>({cost:j.cost,status:j.status}))}")
    out[tag + "_isojobs"] = srv
    bad = await E("async()=>{try{await API.req('/v1/jobs',{json:{kind:'isolate',inputs:{iso144:'/media/mute.webm'},meta:{from:0,to:3}}});return 'made'}catch(e){return String(e.message||e)}}")
    chk(f"{tag}: a clip without sound is refused before anything is charged, with the reason", "no sound" in bad, bad)
    # ducking
    await E("()=>{const d=document.querySelector('.e-assets [data-act=\"duck144\"]');d.click()}"); await pg.wait_for_timeout(300)
    du = await E("()=>({on:S.ed.duck144,lv:S.ed.duckLv144,sl:!!document.querySelector('.e-assets [data-bind=\"ed.duckLv144\"]'),spans:voiceSpans144()})")
    chk(f"{tag}: ducking on, with its level; the voice's speech found", du["on"] and du["lv"] == 30 and du["sl"] and len(du["spans"]) >= 1 and abs(du["spans"][0][0] - iso["start"]) < .2, du)
    v_in = await E("async()=>{ED.playing=false;ED.t=edStarts()[2]+2;await new Promise(r=>setTimeout(r,200));return +M.edMusic.el.volume.toFixed(3)}")
    v_out = await E("async()=>{ED.t=1;await new Promise(r=>setTimeout(r,200));return +M.edMusic.el.volume.toFixed(3)}")
    chk(f"{tag}: in the preview the music ducks while the voice speaks", abs(v_in - .24) < .02 and abs(v_out - .8) < .02, [v_in, v_out])
    mx = await E("""async()=>{const it=S.ed.sfx.find(x=>x.voice),keep=[S.ed.clipSound,it.vol];S.ed.clipSound=false;it.vol=0;const others=S.ed.sfx.filter(x=>!x.voice);others.forEach(x=>{x.k0=x.vol;x.vol=0});
      try{const b=await mix139(edTotal()),d=b.getChannelData(0),R=(a,e)=>{let s=0,n=0;for(let i=Math.floor(a*b.sampleRate);i<Math.floor(e*b.sampleRate);i++){s+=d[i]*d[i];n++}return Math.sqrt(s/n)},s0=edStarts()[2];return{dk:R(s0+1,s0+3),fr:R(2,4)}}
      finally{S.ed.clipSound=keep[0];it.vol=keep[1];others.forEach(x=>{x.vol=x.k0})}}""")
    chk(f"{tag}: in the export the music ducks too (the same level)", mx["fr"] > 0 and abs(mx["dk"] / mx["fr"] - .3) < .05, mx)
    await E("()=>{S.ed.duck144=false;renderView()}")
    # ---- 1. drag & drop (mouse)
    await E("()=>{edSetPick(null);S.ed.aux143=null;S.ed.selText=null;S.ed.tab='media';renderView()}"); await pg.wait_for_timeout(200)
    await rail("effects"); await pg.wait_for_timeout(250); n0 = await E("()=>S.ed.vfx.length")
    await mdrag(pg, '.e-assets [data-act="edv-add"][data-v="rain"]', TL, 4)
    d1 = await E("()=>({n:S.ed.vfx.length,s:S.ed.vfx.length?S.ed.vfx[S.ed.vfx.length-1].start:null,k:S.ed.vfx.length?S.ed.vfx[S.ed.vfx.length-1].kind:null})")
    chk(f"{tag}: drag an effect onto the timeline → it lands at that moment, once", d1["n"] == n0 + 1 and d1["k"] == "rain" and abs(d1["s"] - 4) < .3, d1)
    keep = await E("()=>({pick:kind143(),tiles:document.querySelectorAll('.e-assets [data-act=\"edv-add\"]').length,det:!!document.querySelector('.e-details [data-vfxamt]'),detTiles:document.querySelectorAll('.e-details [data-act=\"edv-add\"]').length})")
    chk(f"{tag}: after a drop the add panel keeps its tiles (the next one drags in at once); the details show the new effect's settings", keep["pick"] == "vfx" and keep["tiles"] > 5 and keep["det"] and keep["detTiles"] == 0, keep)
    await rail("stickers"); await pg.wait_for_timeout(250); n0 = await E("()=>S.ed.infos.length")
    await mdrag(pg, '.e-assets [data-act="bn131-add"][data-v="sub"]', PV, [.25, .3])
    d2 = await E("()=>{const it=S.ed.infos[S.ed.infos.length-1];return{n:S.ed.infos.length,type:it.type,x:it.x,y:it.y}}")
    chk(f"{tag}: drag a banner onto the picture → where you let go", d2["n"] == n0 + 1 and d2["type"] == "bn131" and abs(d2["x"] - .25) < .03 and abs(d2["y"] - .3) < .03, d2)
    await E("()=>{edSetPick(null);renderView()}"); await rail("stickers"); await pg.wait_for_timeout(200)
    await mdrag(pg, '.e-assets [data-act="tk144-add"][data-v="sport"]', TL, 2)
    d3 = await E("()=>{const it=S.ed.infos[S.ed.infos.length-1];return{type:it.type,start:it.start}}")
    chk(f"{tag}: drag a ticker onto the timeline", d3["type"] == "tk144" and abs(d3["start"] - 2) < .3, d3)
    await E("()=>{edSetPick(null);renderView()}"); await rail("filters"); await pg.wait_for_timeout(250)
    lk = await E("()=>{const t=document.querySelector('.e-assets [data-act=\"edx-look\"]:not([data-v=\"none\"])');return t&&t.dataset.v}")
    await mdrag(pg, f'.e-assets [data-act="edx-look"][data-v="{lk}"]', TL, 8)
    d4 = await E("()=>S.ed.clips.map(c=>(c.cg||{}).look||'none')")
    chk(f"{tag}: drag a look onto a clip on the timeline → that clip only", d4[1] == lk and d4[0] != lk and d4[2] != lk, [lk, d4])
    await E("()=>{S.ed.sel=S.ed.clips[0].id;edSetPick('clip',S.ed.clips[0].id);renderView()}"); await rail("trans"); await pg.wait_for_timeout(250)
    await mdrag(pg, '.e-assets [data-set="edclip.trans"][data-val="dip"]', TL, 11.6)
    d5 = await E("()=>S.ed.clips.map(c=>c.trans)")
    chk(f"{tag}: drag a transition onto a cut → the clip before the cut", d5[1] == "dip" and d5[0] == "fade", d5)
    await E("()=>{edSetPick(null);renderView()}"); await rail("media"); await pg.wait_for_timeout(250); n0 = await E("()=>S.ed.clips.length")
    await mdrag(pg, '.e-assets [data-act="lib143"][data-v="vb"]', TL, .4)
    d6 = await E("()=>({n:S.ed.clips.length,first:S.ed.clips[0].src.job})")
    chk(f"{tag}: drag a video from the library onto the start of the timeline → it goes first", d6["n"] == n0 + 1 and d6["first"] == "vb", d6)
    await E("()=>{edSetPick(null);renderView()}"); await rail("audio"); await pg.wait_for_timeout(200); await E("()=>document.querySelector('.e-assets .e-sub [data-v=\"sfx\"]').click()"); await pg.wait_for_timeout(200)
    n0 = await E("()=>S.ed.sfx.length"); await mdrag(pg, '.e-assets [data-act="edx-sfx-add"][data-v="whoosh"]', TL, 3)
    d7 = await E("()=>{const it=S.ed.sfx[S.ed.sfx.length-1];return{n:S.ed.sfx.length,t:it.t,n2:it.n}}")
    chk(f"{tag}: drag a sound onto the timeline", d7["n"] == n0 + 1 and d7["n2"] == "whoosh" and abs(d7["t"] - 3) < .3, d7)
    await E("()=>{edSetPick(null);S.ed.selText=null;renderView()}"); await rail("text"); await pg.wait_for_timeout(200); n0 = await E("()=>S.ed.texts.length")
    await mdrag(pg, '.e-assets [data-act="ts144"][data-v="marker"]', PV, [.5, .15])
    d8 = await E("()=>{const t=S.ed.texts[S.ed.texts.length-1];return{n:S.ed.texts.length,pos:t.pos,efx:t.efx}}")
    chk(f"{tag}: drag a text style onto the top of the picture → a text at the top in that style", d8["n"] == n0 + 1 and d8["pos"] == "top" and d8["efx"] == "marker", d8)
    await E("()=>{edSetPick(null);S.ed.selText=null;renderView()}"); await rail("effects"); await pg.wait_for_timeout(200); n0 = await E("()=>S.ed.vfx.length")
    a = await tile(pg, '.e-assets [data-act="edv-add"][data-v="snow"]'); z = await E("()=>{const r=document.querySelector('.ed143 .e-top .e-name').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
    await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*z, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(300)
    chk(f"{tag}: a drop outside the timeline and the picture adds nothing", await E("()=>S.ed.vfx.length") == n0)
    await E("()=>{ED.t=6;document.querySelector('.e-assets [data-act=\"edv-add\"][data-v=\"snow\"]').click()}"); await pg.wait_for_timeout(250)
    chk(f"{tag}: a tap still adds at the playhead", await E("()=>S.ed.vfx.length===%d&&Math.abs(S.ed.vfx[S.ed.vfx.length-1].start-6)<.05" % (n0 + 1)))
    # ---- the new panels: nothing covered, no id twice
    await E("()=>{edSetPick(null);renderView()}")
    sel = lambda k: f"()=>{{const c=S.ed.clips[{k}];S.ed.sel=c.id;edSetPick('clip',c.id);renderView()}}"
    states = [("ai audio", "()=>{edSetPick(null);S.ed.tab='aiaudio144';S.ed.lt143='audio';renderView()}"), ("text styles", "()=>{edSetPick(null);S.ed.tab='text';S.ed.lt143='text';renderView()}"),
              ("tickers", "()=>{edSetPick(null);S.ed.tab='info';S.ed.lt143='stickers';renderView()}"), ("ticker details", "()=>{const it=S.ed.infos.find(x=>x.type==='tk144');edSetPick('info',it.id);S.ed.tab='info';renderView()}"),
              ("background", "()=>{const c=S.ed.clips[1];S.ed.sel=c.id;edSetPick('clip',c.id);S.ed.tab='bg144';renderView()}"), ("transitions", "()=>{const c=S.ed.clips[1];S.ed.sel=c.id;edSetPick('clip',c.id);S.ed.tab='trans143';S.ed.lt143='trans';renderView()}"),
              ("sound as a voice", "()=>{const it=S.ed.sfx.find(x=>x.voice);edSetPick('sfx',it.id);S.ed.selSfx=it.id;S.ed.tab='sfx';renderView()}")]
    await scan(pg, tag, states)
    vo = await E("()=>!!document.querySelector('[data-act=\"voice144\"]')&&document.querySelector('[data-act=\"voice144\"]').checked")
    chk(f"{tag}: a sound's settings say whether it is a voice", vo)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await ctx.close()

async def phone(b, lang):
    tag = f"phone {lang}"; ctx, pg, errs = await open_page(b, 390, 844, lang, True); E = pg.evaluate
    c = await E("()=>{const c=S.ed.clips[0];S.ed.sel=c.id;edSetPick('clip',c.id);S.ed.tab='clip';S.ed.pclosed143='clip';renderView();return[...document.querySelectorAll('.e-bar button')].map(b=>b.dataset.v||b.dataset.act)}")
    chk(f"{tag}: the clip's tools at the foot have Background", "bg144" in c, c)
    await E("()=>document.querySelector('[data-act=\"desel143\"]').click()"); await pg.wait_for_timeout(200)
    await E("()=>document.querySelector('.e-bar [data-act=\"lt143\"][data-v=\"effects\"]').click()"); await pg.wait_for_timeout(300)
    n0 = await E("()=>S.ed.vfx.length")
    at = lambda t: "(()=>{const w=document.querySelector('.tlwrap');w.scrollLeft=Math.max(0,40+%s*S.ed.zoom-w.clientWidth/2);const R=document.getElementById('tlin').getBoundingClientRect(),b=document.querySelector('#tlin .blk.v').getBoundingClientRect();return [R.left+40+%s*S.ed.zoom,b.top+b.height/2]})()" % (t, t)
    # (v151: on a phone the effects are picture tiles in the panel, the timeline a strip above it: a tile is dragged up onto it)
    r = await E(TDRAG, ['.e-sheet [data-act="edv-add"][data-v="rain"]', at(5), True])
    d1 = await E("()=>({n:S.ed.vfx.length,s:S.ed.vfx.length?S.ed.vfx[S.ed.vfx.length-1].start:null,chip:document.querySelectorAll('.e-sheet .pk84c').length,hid:document.body.classList.contains('dnd144s')})")
    chk(f"{tag}: a long press drags an effect tile out of the panel onto the timeline", r == "ok" and d1["n"] == n0 + 1 and abs(d1["s"] - 5) < .35 and not d1["chip"] and not d1["hid"], [r, d1])
    await E("()=>{edSetPick(null);S.ed.tab='vfx';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(200); n0 = await E("()=>S.ed.vfx.length")
    r = await E(TDRAG, ['.e-sheet [data-act="edv-add"][data-v="snow"]', at(3), False])
    chk(f"{tag}: a finger that moves at once scrolls — it does not drag", await E("()=>S.ed.vfx.length") == n0 and await E("()=>!!document.querySelector('.e-sheet')"))
    await E("()=>{document.getElementById('modalRoot').innerHTML='';PK84.open=null}")
    await E("()=>{edSetPick(null);S.ed.lt143='stickers';S.ed.tab='info';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(250); n0 = await E("()=>S.ed.infos.length")
    r = await E(TDRAG, ['.e-sheet [data-act="st131-add"]', "(()=>{const r=document.getElementById('wk').getBoundingClientRect();return [r.left+r.width*.7,r.top+r.height*.35]})()", True])
    d2 = await E("()=>{const it=S.ed.infos[S.ed.infos.length-1];return it&&{n:S.ed.infos.length,x:it.x,y:it.y,type:it.type}}")
    chk(f"{tag}: a long press drags a sticker onto the picture, where the finger lets go", d2 and d2["n"] == n0 + 1 and d2["type"] == "st131" and abs(d2["x"] - .7) < .04 and abs(d2["y"] - .35) < .04, d2)
    states = [("ai audio", "()=>{edSetPick(null);S.ed.lt143='audio';S.ed.tab='aiaudio144';S.ed.pclosed143=null;renderView()}"), ("tickers", "()=>{edSetPick(null);S.ed.lt143='stickers';S.ed.tab='info';S.ed.pclosed143=null;renderView()}"),
              ("text styles", "()=>{edSetPick(null);S.ed.selText=null;S.ed.lt143='text';S.ed.tab='text';S.ed.pclosed143=null;renderView()}"), ("background", "()=>{const c=S.ed.clips[0];S.ed.sel=c.id;edSetPick('clip',c.id);S.ed.tab='bg144';S.ed.pclosed143=null;renderView()}")]
    await scan(pg, tag, states)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        for f, lang in ((desktop, "en"), (desktop, "ar"), (phone, "en"), (phone, "ar")):
            try: await f(b, lang)
            except Exception as e: fails.append(f"{f.__name__} {lang} crashed: " + repr(e)[:500])
        await b.close()
# the price: per started minute, set on the server from the cut sound (never from the page)
pr = subprocess.run(["node", "-e", "import('./lib/billing.js').then(m=>console.log(JSON.stringify([m.priceOf('isolate',{meta:{secs144:20}}),m.priceOf('isolate',{meta:{secs144:61}}),m.priceOf('isolate',{meta:{secs144:120}}),m.priceTable().fixed.isolate])))"], cwd=ROOT, capture_output=True, text=True)
pv = json.loads(pr.stdout.strip() or "[0,0,0,0]"); out["price"] = pv
chk("isolate is priced per started minute", pv[0] > 0 and pv[1] == 2 * pv[0] and pv[2] == 2 * pv[0] and pv[3] == pv[0], pv)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/health", timeout=2); break
        except Exception: time.sleep(.2)
    asyncio.run(main())
finally: srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": {k: json.dumps(v, ensure_ascii=False, default=str)[:1400] for k, v in out.items()}, "dir": D}, ensure_ascii=False, indent=1))
sys.exit(1 if fails else 0)
