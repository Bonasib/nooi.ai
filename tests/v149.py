# v149: what the owner found on a phone, fixed — captions whose words never run into each other (English and Arabic, every
# style), the whole edit listened to in parts (not only its first 30 s), translation on this device (the browser's translator;
# a stand-in here) with the original kept, a plain message when nothing can translate · the edit on every device: saved to the
# account by itself (its files too), opened on another device, brought up to date there, and a question when both changed ·
# the phone editor: the play row pinned under the preview, a touch on the timeline stops playback, the playhead dragged to the
# edge moves the timeline, rows of sounds that don't grow the page, sound effects that play on a tap and go in with Add (a hold
# and drag still drops them), stickers in groups, sizes on one line · Invert, Comic, Lightning and Dust visible.
# Run: python3 tests/v149.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8422; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v149-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "jobs": {}}}}, open(D + "/data/db.json", "w"))
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=12", "-f", "lavfi", "-i", "sine=frequency=330:duration=12", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", D + "/media/a.webm")
# 40 s of "speech": 4 s of sound, 2 s of silence
FF("-f", "lavfi", "-i", "color=c=0x334455:s=320x180:d=40:r=15", "-f", "lavfi", "-i", "sine=frequency=220:duration=40", "-af", "volume='if(lt(mod(t,6),4),1,0)':eval=frame", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "200k", "-c:a", "libopus", "-shortest", D + "/media/talk40.webm")
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Beach',title:'Beach at sunset',created:now,progress:1,pal:PALS[0],seed:7,dur:12,aspect:'16:9',resultUrl:'/media/a.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.texts=[];S.ed.format='youtube';
 await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});
 const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'talk.webm',{type:'video/webm'})]);
 S.ed.tab='media';S.ed.sel=S.ed.clips[0].id;edSetPick('clip',S.ed.clips[0].id);go('edit');renderAll()}"""
READY = "S.ed.clips.length===2&&document.querySelector('.ed143 #wk')&&S.ed.clips.every(c=>{const m=clipMedia(c);return m&&srcReady(m)})"
SCAN = open(os.path.join(ROOT, "tests/v148.py")).read().split('SCAN = r"""')[1].split('"""')[0]
GRAB = """async(t)=>{ED.playing=false;ED.t=t;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,200));for(let i=0;i<2;i++)await new Promise(r=>requestAnimationFrame(r));
 const cv=document.getElementById('wk'),s=document.createElement('canvas');s.width=96;s.height=54;s.getContext('2d').drawImage(cv,0,0,96,54);return [...s.getContext('2d').getImageData(0,0,96,54).data]}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
def diff(a, b): return sum(abs(a[i] - b[i]) for i in range(0, len(a)) if i % 4 != 3) / (len(a) / 4) / 3
def get(p): return json.loads(urllib.request.urlopen(B + p, timeout=10).read())

async def open_page(b, w, h, lang, mob, setup=True):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    if setup: await pg.evaluate(SETUP, lang); await pg.wait_for_function(READY, timeout=20000); await pg.wait_for_timeout(400)
    return ctx, pg, errs
async def scan(pg, tag, states):
    found = {}
    for name, js in states:
        await pg.evaluate(js); await pg.evaluate("()=>document.querySelectorAll('.toast').forEach(t=>t.remove())"); await pg.wait_for_timeout(250)
        H = await pg.evaluate("()=>document.getElementById('main').scrollHeight"); bad, over, dup = [], 0, []
        for y in range(0, H, 450):
            await pg.evaluate("(y)=>{document.getElementById('main').scrollTop=y}", y); await pg.wait_for_timeout(60)
            r = await pg.evaluate(SCAN); over = max(over, r["over"]); dup = r["dup"]; bad += [x for x in r["bad"] if x not in bad]
        await pg.evaluate("()=>{document.getElementById('main').scrollTop=0}")
        if bad or over > 1 or dup: found[name] = {"bad": bad[:6], "over": over, "dup": dup}
    chk(f"{tag}: nothing covered, no sideways scroll, no element id twice", not found, found)
# where each caption word is drawn: its centre and its drawn width (the canvas's own transform), on one frame
WORDS = """async([words,style,t])=>{const E=S.ed;E.caps=Object.assign({},E.caps,{on:true,style,per:3,size:9,pos:'bottom',words});ED.playing=false;ED.t=t;const got=[],f=CanvasRenderingContext2D.prototype.fillText;
 CanvasRenderingContext2D.prototype.fillText=function(s,x,y){if(this.canvas&&this.canvas.id==='wk'&&words.some(w=>w.w===s)){const T=this.getTransform();got.push({s,cx:T.e,y:Math.round(T.f),w:this.measureText(s).width*Math.hypot(T.a,T.b),lw:this.lineWidth*Math.hypot(T.a,T.b)})}return f.apply(this,arguments)};
 try{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,120))}finally{CanvasRenderingContext2D.prototype.fillText=f}
 const last={};for(const g of got)last[g.s]=g;const ws=Object.values(last).sort((a,b)=>a.cx-b.cx);let gap=1e9;for(let i=1;i<ws.length;i++)if(ws[i].y===ws[i-1].y)gap=Math.min(gap,(ws[i].cx-ws[i].w/2-ws[i].lw/2)-(ws[i-1].cx+ws[i-1].w/2+ws[i-1].lw/2));return {n:ws.length,gap:Math.round(gap*10)/10}}"""

async def desktop(b):
    ctx, pg, errs = await open_page(b, 1440, 900, "en", False); E = pg.evaluate
    # ---- 1. caption words never run into each other
    en = [{"s": 0.2, "e": 0.6, "w": "doing"}, {"s": 0.6, "e": 1.0, "w": "car"}, {"s": 1.0, "e": 1.6, "w": "marketing."}]
    ar = [{"s": 0.2, "e": 0.6, "w": "نحن"}, {"s": 0.6, "e": 1.0, "w": "نسوّق"}, {"s": 1.0, "e": 1.6, "w": "السيارات."}]
    res = {}
    for nm, words in [("en", en), ("ar", ar)]:
        for st in ["pop", "box", "karaoke", "bounce"]:
            res[nm + "-" + st] = await E(WORDS, [words, st, 0.8])
    out["caption_gaps"] = res
    chk("caption words keep a space between them in every style, English and Arabic (the word being said too)", all(r["n"] == 3 and r["gap"] > 2 for r in res.values()), res)
    # ---- 2. the whole edit listened to, in parts at the quiet moments
    await E("""async()=>{const v=await (await fetch('/media/talk40.webm')).blob();S.ed.clips=[];edAddFiles([new File([v],'talk40.webm',{type:'video/webm'})]);S.localAI=true;S.ed.caps.lang149='en';
      window.ASR=[];laiCall=async(msg)=>{if(msg.task==='asr'){const d=msg.input.audio.length/16000;ASR.push({d:+d.toFixed(2),lang:msg.input.language||null});return{chunks:[{start:.3,end:.8,text:'w'+ASR.length},{start:Math.max(.9,d-1.2),end:d-.7,text:'z'+ASR.length}]}}throw new Error('no')};renderView()}""")
    # (a new clip takes its first 30 s — the whole 40 s here)
    await pg.wait_for_function("S.ed.clips.length===1&&srcReady(clipMedia(S.ed.clips[0]))&&!S.ed.clips[0].auto", timeout=20000)
    await E("()=>{const c=S.ed.clips[0];c.out=clipMedia(c).el.duration}"); await pg.wait_for_function("edTotal()>39", timeout=5000)
    await E("()=>edxAutoCaps()"); await pg.wait_for_function("!EDX.busy&&(S.ed.caps.words||[]).length>0", timeout=60000)
    r = await E("()=>({asr:ASR,words:S.ed.caps.words.map(w=>[w.w,+w.s.toFixed(2)]),tot:edTotal()})")
    out["asr"] = r
    chk("the whole 40 s edit is heard in parts of at most 26 s cut at quiet moments, in the chosen language", len(r["asr"]) >= 2 and all(x["d"] <= 26.1 for x in r["asr"]) and all(x["lang"] == "en" for x in r["asr"]) and sum(x["d"] for x in r["asr"]) > 30, r["asr"])
    chk("…and the captions reach the end of the edit, in order", r["words"] and r["words"][-1][1] > 30 and all(r["words"][i][1] <= r["words"][i + 1][1] for i in range(len(r["words"]) - 1)), r["words"][-4:])
    # ---- 3. translation on this device (a stand-in for the browser's translator), the original kept
    await E("""()=>{S.ed.caps.words=[{s:.2,e:.6,w:'hello'},{s:.6,e:1,w:'there'},{s:2,e:2.5,w:'friends'}];S.ed.caps.lang149='auto';S.localAI=false;delete S.ed.caps.orig149;
      self.Translator={availability:async()=>'available',create:async()=>({translate:async t=>'ترجمة '+t,destroy(){}})};S.ed.tab='words';S.ed.lt143='captions';renderView()}""")
    note = await E("()=>{const n=document.querySelector('.tr149n');return n?n.textContent:''}")
    chk("the caption panel says the translation is made on this device", "on this device" in note, note)
    await E("()=>{const s=document.getElementById('edtrl');s.value='ar';document.querySelector('[data-act=\"edai-tr\"]').click()}")
    await pg.wait_for_function("(S.ed.caps.words||[]).some(w=>/ترجمة/.test(w.w))", timeout=10000)
    t1 = await E("()=>({w:S.ed.caps.words.map(w=>w.w).join(' '),orig:!!S.ed.caps.orig149,back:!!document.querySelector('[data-act=\"tr149-back\"]')})")
    chk("translated on this device, the original words kept with a way back", "ترجمة hello there" in t1["w"] and t1["orig"] and t1["back"], t1)
    await pg.click('[data-act="tr149-back"]'); await pg.wait_for_timeout(200)
    t2 = await E("()=>S.ed.caps.words.map(w=>w.w).join(' ')")
    chk("Back to the original words", t2 == "hello there friends", t2)
    await E("()=>{delete self.Translator;renderView()}")
    await E("()=>{document.getElementById('edtrl').value='ar';document.querySelector('[data-act=\"edai-tr\"]').click()}"); await pg.wait_for_timeout(800)
    msg = await E("()=>[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | ')")
    chk("with nothing that can translate: a plain message (no provider name, nothing charged)", "Translation failed" in msg and "translate on this device" in msg and "provider" not in msg.lower(), msg)
    await scan(pg, "desktop captions", [("captions panel", "()=>{S.ed.tab='words';renderView()}")])
    # ---- 4. effects that did nothing
    await E("""async()=>{const v=await (await fetch('/media/a.webm')).blob();S.ed.clips=[];S.ed.caps.on=false;edAddFiles([new File([v],'a.webm',{type:'video/webm'})]);MS146.mod=null;edSetPick(null);S.ed.sel=null;renderView()}""")
    await pg.wait_for_function("S.ed.clips.length===1&&srcReady(clipMedia(S.ed.clips[0]))", timeout=15000)
    fx = {}
    for t in [0.4, 1.3, 2.6]:
        base = await E(GRAB, t)
        for k in ["invert", "comic"]:
            await E("(k)=>{S.ed.clips[0].vfx={[k]:true};S.ed.clips[0].cg=null}", k); fx[k] = max(fx.get(k, 0), diff(base, await E(GRAB, t)))
        await E("()=>{S.ed.clips[0].vfx={}}")
        for k in ["lightning", "dust"]:
            await E("(k)=>{S.ed.vfx=[{id:'x',kind:k,start:0,end:6,amt:80}]}", k); fx[k] = max(fx.get(k, 0), diff(base, await E(GRAB, t)))
        await E("()=>{S.ed.vfx=[]}")
    out["effects"] = fx
    chk("Invert, Comic, Lightning and Dust change the picture (they did nothing or almost nothing)", fx["invert"] > 50 and fx["comic"] > 1 and fx["lightning"] > 5 and fx["dust"] > 1.5, fx)
    # ---- 5. the edit on every device
    # (a new edit of its own — the one above went to the account by itself already)
    await E("""async()=>{clearTimeout(PJ139.t);PJ139.t=null;S.ed.clips=[];S.ed.srv139=null;S.ed.at149=0;S.ed.key149=null;PJ139.key=null;const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'trip.webm',{type:'video/webm'})]);S.ed.title='Trip';persist()}""")
    try: await pg.wait_for_function("!!S.ed.srv139&&!PJ139.busy&&S.ed.at149>0", timeout=25000); ok = True
    except Exception: ok = False
    pid = await E("()=>S.ed.srv139"); doc = get(f"/v1/projects/{pid}")["doc"] if pid else {}
    chk("the edit went to the account by itself (no button), its uploaded file with it", ok and doc and all(not x.get("local") for x in doc["media"].values()) and len(doc["ed"]["clips"]) == 1, doc.get("media") if doc else None)
    ctx2, p2, e2s = await open_page(b, 1280, 860, "en", False, setup=False)
    await p2.evaluate("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.jobs=[];PJ.fresh('edit');go('edit');renderAll()}")
    try: await p2.wait_for_function(f"S.ed.srv139==='{pid}'&&S.ed.clips.length===1&&S.ed.title==='Trip'", timeout=20000); ok = True
    except Exception: ok = False
    chk("another device: its empty editor opens the edit from the account", ok, await p2.evaluate("()=>({id:S.ed.srv139,n:S.ed.clips.length,t:S.ed.title})"))
    await E("()=>{S.ed.texts.push({id:'tx1',text:'From the phone',start:.5,end:2,pos:'top',style:'caption',size:7,anim:'pop'});persist()}")
    await pg.wait_for_function("(()=>{try{return true}catch(e){return false}})()"); await pg.wait_for_timeout(7500)
    await p2.evaluate("async()=>{DV149.last=0;await sync149()}"); await p2.wait_for_timeout(800)
    t = await p2.evaluate("()=>S.ed.texts.map(x=>x.text)")
    chk("a change made on the first device comes to the other one (which had nothing of its own)", "From the phone" in t, t)
    SYNC = "async()=>{DV149.last=0;await sync149()}"
    BAR = "()=>({bar:(document.querySelector('.dv149')||{}).textContent||'',title:S.ed.title,t:S.ed.texts.map(x=>x.text)})"
    await p2.evaluate("()=>{clearTimeout(PJ139.t);PJ139.t=null;S.ed.title='Trip — my version'}")   # (a change here, not saved yet — no signal, say)
    await E("()=>{S.ed.texts[0].text='Changed again';persist()}"); await pg.wait_for_timeout(7500)
    await p2.evaluate(SYNC); await p2.wait_for_timeout(500)
    bn = await p2.evaluate(BAR)
    chk("when both changed: the other device asks (its own work is not replaced)", "changed on your other device" in bn["bar"] and "Keep mine" in bn["bar"] and bn["title"] == "Trip — my version" and "Changed again" not in bn["t"], bn)
    await p2.click('[data-act="dv149-open"]'); await p2.wait_for_timeout(1200)
    t = await p2.evaluate("()=>S.ed.texts.map(x=>x.text)")
    chk("…Open the newer one brings it in", "Changed again" in t, t)
    # Keep mine: this device's version goes over the other one's — and then that one, behind now, is asked before it saves
    await p2.evaluate("()=>{clearTimeout(PJ139.t);PJ139.t=null;S.ed.title='Trip — kept'}")
    await E("()=>{S.ed.texts[0].text='Third';persist()}"); await pg.wait_for_timeout(7500)
    await p2.evaluate(SYNC); await p2.wait_for_timeout(500)
    # (the first device stays as it is meanwhile — its own check every 30 s would bring it up to date first, which is right too)
    await E("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})}")
    await p2.click('[data-act="dv149-x"]'); await p2.wait_for_timeout(7500)
    d1 = get(f"/v1/projects/{pid}")["doc"]["ed"]
    chk("Keep mine: this device's version goes to the account", d1["title"] == "Trip — kept" and [x["text"] for x in d1["texts"]] == ["Changed again"], [d1["title"], [x["text"] for x in d1["texts"]]])
    await E("()=>{delete document.hidden;S.ed.texts[0].text='Fourth';persist()}"); await pg.wait_for_timeout(8000)
    b1 = await E(BAR); d2 = get(f"/v1/projects/{pid}")["doc"]["ed"]
    chk("…the first device, behind now, doesn't save over it by itself — it asks", "changed on your other device" in b1["bar"] and d2["title"] == "Trip — kept" and [x["text"] for x in d2["texts"]] == ["Changed again"], [b1, d2["title"]])
    chk("no page errors (second device)", not e2s, e2s); await ctx2.close()
    chk("no page errors (computer)", not errs, errs); await ctx.close()

TDRAG = """async([sel,b,hold])=>{const e=document.querySelector(sel);if(!e)return 'no tile';e.scrollIntoView({block:'center',inline:'center'});await new Promise(r=>setTimeout(r,60));
 const r=e.getBoundingClientRect(),a=[r.left+r.width/2,r.top+r.height/2],P=(type,x,y,t)=>(t||e).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,composed:true,pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1}));
 P('pointerdown',a[0],a[1]);if(hold){await new Promise(r=>setTimeout(r,420))}
 const B=typeof b==='string'?eval(b):b;for(let i=1;i<=10;i++){P('pointermove',a[0]+(B[0]-a[0])*i/10,a[1]+(B[1]-a[1])*i/10,window);await new Promise(r=>setTimeout(r,16))}
 P('pointerup',B[0],B[1],window);await new Promise(r=>setTimeout(r,350));return 'ok'}"""
async def phone(b):
    ctx, pg, errs = await open_page(b, 390, 844, "ar", True); E = pg.evaluate
    await E("()=>{MS146.mod=null;edSetPick(null);S.ed.sel=null;S.ed.tab='media';renderView()}")
    # ---- the play row pinned under the preview
    await E("()=>{document.getElementById('main').scrollTop=320}"); await pg.wait_for_timeout(300)
    r = await E("()=>{const t=document.querySelector('.ed143 .e-player .transport').getBoundingClientRect(),s=document.querySelector('.ed143 .edstage').getBoundingClientRect();return {t:Math.round(t.top),s:Math.round(s.bottom),vis:t.bottom<innerHeight}}")
    chk("phone: the play row stays pinned right under the preview when the page scrolls", abs(r["t"] - r["s"]) <= 2 and r["vis"], r)
    await E("()=>{document.getElementById('main').scrollTop=0}")
    # ---- a touch on the timeline stops playback; dragging the playhead to the edge moves the timeline
    await E("()=>{S.ed.zoom=40;renderView()}"); await pg.wait_for_timeout(200)
    r = await E("""async()=>{ED.t=3;ED.playing=true;await new Promise(r=>setTimeout(r,500));const w=document.querySelector('.tlwrap'),t=w.querySelector('.trk[data-trk="a"]')||w,R=t.getBoundingClientRect();
      t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:4,pointerType:'touch',isPrimary:true,clientX:R.left+R.width*.7,clientY:R.top+R.height/2,buttons:1}));
      window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:4,pointerType:'touch',isPrimary:true,clientX:R.left+R.width*.7,clientY:R.top+R.height/2}));await new Promise(r=>setTimeout(r,300));return {playing:ED.playing,icon:document.querySelector('.ed143 [data-act="ed-play"]').innerHTML.includes(ICONS.play.slice(0,12))}}""")
    chk("phone: touching the timeline while it plays stops it there (a swipe back works)", r["playing"] is False, r)
    r = await E("""async()=>{const w=document.querySelector('.tlwrap');w.scrollLeft=320;ED.t=12;await new Promise(r=>setTimeout(r,200));const ru=document.querySelector('#tlin .ruler'),R=ru.getBoundingClientRect(),W=w.getBoundingClientRect(),x0=document.getElementById('tlin').getBoundingClientRect().left+40+12*S.ed.zoom,y=R.top+R.height/2;
      const P=(t,x,tg)=>(tg||ru).dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,composed:true,pointerId:6,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:t==='pointerup'?0:1}));const s0=w.scrollLeft;
      P('pointerdown',x0);for(let i=1;i<=8;i++){P('pointermove',x0+(W.left+6-x0)*i/8,window);await new Promise(r=>setTimeout(r,16))}await new Promise(r=>setTimeout(r,700));P('pointerup',W.left+6,window);await new Promise(r=>setTimeout(r,200));
      return {s0,s1:w.scrollLeft,t:+ED.t.toFixed(2),left:+((s0-40)/S.ed.zoom).toFixed(2)}}""")
    chk("phone: dragging the playhead to the left edge moves the timeline back with it", r["s1"] < r["s0"] - 40 and r["t"] < r["left"], r)
    # ---- sound effects: a tap plays, Add puts it in; rows of sounds stay small
    await E("()=>{S.ed.tab='sfx';S.ed.lt143='audio';renderView()}"); await pg.wait_for_timeout(250)
    await E("()=>document.querySelector('[data-act=\"edx-sfx-add\"][data-v=\"boom\"]').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
    await pg.tap('[data-act="edx-sfx-add"][data-v="boom"]'); await pg.wait_for_timeout(400)
    r = await E("()=>({n:S.ed.sfx.length,add:!!document.querySelector('[data-act=\"sx149-add\"]'),pressed:document.querySelector('[data-act=\"edx-sfx-add\"][data-v=\"boom\"]').getAttribute('aria-pressed')})")
    chk("phone: tapping a sound effect only plays it (nothing added) and shows Add", r["n"] == 0 and r["add"] and r["pressed"] == "true", r)
    await E("()=>{ED.t=2}"); await pg.tap('[data-act="sx149-add"]'); await pg.wait_for_timeout(400)
    r = await E("()=>S.ed.sfx.map(x=>[x.n,x.t])")
    chk("phone: Add puts it at the playhead", r == [["boom", 2]], r)
    await E("()=>{S.ed.sel=null;MS146.mod=null;edSetPick(null);S.ed.tab='sfx';renderView()}"); await pg.wait_for_timeout(200)
    res = await E(TDRAG, ['[data-act="edx-sfx-add"][data-v="whoosh"]', "(()=>{const w=document.querySelector('.tlwrap');w.scrollIntoView({block:'center'});const r=w.getBoundingClientRect();return [r.left+r.width*.5,r.top+r.height*.5]})()", True])
    r = await E("()=>S.ed.sfx.map(x=>x.n)")
    chk("phone: a hold and drag still drops a sound on the timeline", res == "ok" and "whoosh" in r, [res, r])
    await E("()=>{S.ed.sfx=[];for(let i=0;i<6;i++)S.ed.sfx.push({id:'z'+i,n:'whoosh',t:0,vol:100});renderView()}"); await pg.wait_for_timeout(200)
    r = await E("()=>{const tr=[...document.querySelectorAll('#tlin .trk')].filter(t=>t.querySelector('.blk.sx'));const w=document.querySelector('.tlwrap').getBoundingClientRect();return {rows:tr.map(t=>Math.round(t.getBoundingClientRect().height)),h:Math.round(w.height),vh:innerHeight}}")
    chk("phone: six sounds at one moment: the extra rows are thin and the timeline stays within half the screen", len(r["rows"]) == 6 and max(r["rows"][1:]) <= 24 and r["h"] <= r["vh"] * 0.47, r)
    await E("()=>{S.ed.sfx=[];renderView()}")
    # ---- stickers in groups; sizes on one line
    await E("()=>{S.ed.tab='info';S.ed.lt143='stickers';renderView()}"); await pg.wait_for_timeout(250)
    g = await E("()=>({chips:[...document.querySelectorAll('.stg149 .chip')].map(b=>b.textContent),n:document.querySelectorAll('.st131g:not(.sm) .st131t svg path').length})")
    await E("()=>document.querySelector('.stg149 [data-v=\"arrow\"]').click()"); await pg.wait_for_timeout(200)
    g2 = await E("()=>({first:document.querySelector('.st131g:not(.sm) .st131t').dataset.v,n:document.querySelectorAll('.st131g:not(.sm) .st131t svg path').length,on:document.querySelector('.stg149 [aria-pressed=\"true\"]').dataset.v})")
    chk("phone (AR): stickers in seven groups; a group shows its own stickers (drawn)", len(g["chips"]) == 7 and "تفاعلات" in g["chips"] and g["n"] >= 10 and g2["on"] == "arrow" and g2["first"] == "arrow_forward" and g2["n"] >= 10, [g, g2])
    await E("()=>document.querySelector('.st131g:not(.sm) .st131t[data-v=\"north_east\"]').click()"); await pg.wait_for_timeout(250)
    chk("phone: a new sticker goes on the video", await E("()=>(S.ed.infos||[]).some(x=>x.ic==='north_east')"))
    await E("()=>{MS146.mod=null;edSetPick(null);S.ed.tab='export';renderView()}"); await pg.wait_for_timeout(250)
    d = await E("()=>[...document.querySelectorAll('.ft149 .dm149')].slice(0,6).map(e=>{const r=e.getBoundingClientRect(),fs=parseFloat(getComputedStyle(e).fontSize);return [e.textContent,Math.round(r.height),fs]})")
    chk("phone: each size in small numbers on one line", d and all("×" in x[0] and x[1] <= x[2] * 1.6 and x[2] <= 11 for x in d), d)
    await scan(pg, "phone", [("sound effects + Add", "()=>{S.ed.tab='sfx';S.ed.lt143='audio';SX149.pick='pop';renderView()}"), ("stickers", "()=>{SX149.pick=null;S.ed.tab='info';S.ed.lt143='stickers';renderView()}"),
                              ("captions", "()=>{S.ed.tab='words';S.ed.lt143='captions';renderView()}"), ("AI audio", "()=>{S.ed.tab='aiaudio144';S.ed.lt143='audio';renderView()}"), ("sizes", "()=>{S.ed.tab='export';renderView()}")])
    chk("no page errors (phone)", not errs, errs)
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        try:
            await desktop(b); await phone(b)
        finally: await b.close()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "KIE_", "GOOGLE_", "LOCAL_LLM", "GEMMA_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    asyncio.run(main())
except Exception as e: fails.append("crashed: " + repr(e)[:400])
finally: srv.kill()
print(json.dumps(out, ensure_ascii=False, default=str)[:1500])
print("FAIL " + str(len(fails)) if fails else "PASS"); [print(" ✗", f) for f in fails]
sys.exit(1 if fails else 0)
