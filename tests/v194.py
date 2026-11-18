# v194 — the editor towards After Effects / Premiere / DaVinci, phase 2 (docs/EDITOR_PRO_ROADMAP.md gaps 9–12). A real nooi server,
# a red|blue picture, a grey picture, a clip with a white square moving right (a 7 kHz tone), 110 Hz music, a voice that speaks then stops:
#  · RGB curves: the blue curve flattened makes the blue half black and leaves the red half red; the channel seg draws the blue curve
#  · hue curves: eight dots over the colour bands; a dot dragged writes the band's hue / saturation / lightness (when WebGL exists)
#  · qualifier: a pick on the red half sets the range; "saturation −100" greys only the red half; the mask view is white there, black elsewhere
#  · power window: an ellipse on the right half desaturates only inside it; tracking a window on the moving square follows it
#  · pre-comp: a second timeline (grey picture + the square clip) placed as one clip draws grey at its start — in the preview and the
#    frame-exact export — and its clip's tone is in the exported sound
#  · templates: a lower third adds the name and role as grouped items; the sheet lists the templates and a form adds one; a selection
#    is saved as a template with a field per text and applied with new words
#  · pen path: a straight path trimmed to 50 % draws on the left and not the right; write-on draws over time; the repeater adds
#    copies below; words sit along the path; a closed path fills; the pen adds a point from a tap on the picture
#  · sound per track: gate silences the quiet tone; compressor lowers it; de-esser removes a 7 kHz tone; EQ cuts the 110 Hz music;
#    music ducks under the voice and comes back when it stops; the FX button and sheet exist
# Run: python3 tests/v194.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8652; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v194-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120)
FF("-f", "lavfi", "-i", "color=c=0x0000ff:s=640x360,drawbox=x=0:y=0:w=320:h=360:c=0xff0000:t=fill", "-frames:v", "1", M + "colour.png")
FF("-f", "lavfi", "-i", "color=c=0x808080:s=640x360", "-frames:v", "1", M + "grey.png")
FF("-f", "lavfi", "-i", "color=c=0x202020:s=640x360:rate=30:duration=3", "-f", "lavfi", "-i", "color=c=white:s=60x60:rate=30:duration=3", "-f", "lavfi", "-i", "sine=frequency=7000:sample_rate=48000:duration=3",
   "-filter_complex", "[0:v][1:v]overlay=x='60+t*100':y=100:shortest=1[v];[2:a]volume=0.3[a]", "-map", "[v]", "-map", "[a]", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "800k", "-c:a", "libopus", "-b:a", "128k", M + "sq.webm")
FF("-f", "lavfi", "-i", "sine=frequency=110:duration=10", "-af", "volume=0.3", "-c:a", "libmp3lame", M + "music.mp3")
FF("-f", "lavfi", "-i", "sine=frequency=500:duration=4", "-af", "volume=0.4,volume=enable='between(t,2,4)':volume=0", "-c:a", "libmp3lame", M + "voice.mp3")
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="d" * 40, FIREBASE_PROJECT_ID="", FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
SETUP = """async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
 const now=Date.now(),mk=(id,kind,url,dur)=>({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url});
 S.jobs.push(mk('j_sq','video','/media/sq.webm',3),mk('j_col','image','/media/colour.png'),mk('j_grey','image','/media/grey.png'));
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.layers=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];S.ed.fit='contain';S.ed.zoom=60;
 await edUseJob(S.jobs.find(j=>j.id==='j_col'),{stay:true,quiet:true,t:1});await edUseJob(S.jobs.find(j=>j.id==='j_sq'),{stay:true,quiet:true,t:1});S.ed.clips[0].in=0;S.ed.clips[0].out=2;S.ed.sel=S.ed.clips[0].id;
 window.__t=[];toast=(o=>function(m){window.__t.push(String(m));return o.apply(this,arguments)})(toast);go('edit');renderAll()}"""
PIX = """(a)=>{ED.playing=false;ED.t=a[0];edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d');return Array.from(x.getImageData(Math.round(c.width*a[1]),Math.round(c.height*a[2]),1,1).data).slice(0,3)}"""
RMS = """async(a)=>{const b=await mix139(edTotal());if(!b)return null;const SR=b.sampleRate,d=b.getChannelData(0),i0=Math.round(a[0]*SR),i1=Math.min(d.length,Math.round(a[1]*SR));let s=0;for(let i=i0;i<i1;i++)s+=d[i]*d[i];return Math.sqrt(s/Math.max(1,i1-i0))}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
near = lambda a, b, tol=30: all(abs(a[i] - b[i]) <= tol for i in range(3))

async def main():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
        await E(SETUP); await pg.wait_for_function("S.ed.clips.length===2&&(()=>{const m=M['c_'+S.ed.clips[1].id];return m&&m.el&&m.el.readyState>=1})()", timeout=20000)
        await pg.wait_for_function("(()=>{const m=M['c_'+S.ed.clips[0].id];return m&&m.el&&m.el.complete})()", timeout=10000)
        # ---- 9a. RGB curves
        base = await E(PIX, [.5, .25, .5]); baseR = await E(PIX, [.5, .75, .5])
        await E("()=>{const c=S.ed.clips[0];c.cg=c.cg||{};c.cg.cvRGB194={b:[0,0,0,0,0]}}")
        l = await E(PIX, [.5, .25, .5]); r = await E(PIX, [.5, .75, .5]); out["rgb"] = [base, baseR, l, r]
        chk("RGB curves: the blue curve flattened — the blue half goes black, the red half stays red", near(base, [255, 0, 0]) and near(baseR, [0, 0, 255]) and near(r, [0, 0, 0]) and near(l, [255, 0, 0]), out["rgb"])
        await E("()=>{S.ed.tab='color';renderView()}"); await pg.wait_for_selector('[data-act="cvch194"]', state="attached", timeout=10000)
        await E("()=>document.querySelector('[data-act=cvch194][data-v=b]').click()"); await pg.wait_for_timeout(250)
        seg = await E("()=>({n:document.querySelectorAll('[data-act=cvch194]').length,on:document.querySelector('[data-act=cvch194][aria-pressed=true]')?.dataset.v,svg:document.querySelector('.cv193.ch194')?.dataset.path,dots:document.querySelectorAll('.cv193.ch194 circle').length,reset:!!document.querySelector('[data-act=cvch194-reset]')})")
        out["seg"] = seg; chk("the channel seg (Luma · R · G · B) draws the blue curve with its own colour and a Reset RGB button", seg["n"] == 4 and seg["on"] == "b" and seg["svg"] == "clip|b" and seg["dots"] == 5 and seg["reset"], seg)
        dot = await E("()=>{const d=document.querySelectorAll('.cv193.ch194 circle')[2];d.closest('svg').scrollIntoView({block:'center'});const r=d.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}}"); await pg.wait_for_timeout(150)
        await pg.mouse.move(dot["x"], dot["y"]); await pg.mouse.down(); await pg.mouse.move(dot["x"], dot["y"] - 30, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(200)
        mid = await E("()=>S.ed.clips[0].cg.cvRGB194.b[2]"); out["drag"] = mid; chk("a dot on the blue curve dragged up raises its value", mid > .15, mid)
        await E("()=>document.querySelector('[data-act=cvch194-reset]').click()"); await pg.wait_for_timeout(200); chk("Reset RGB clears the curves", await E("()=>!S.ed.clips[0].cg.cvRGB194"))
        # ---- 9b. hue curves (the v140 GPU engine drawn as curves)
        gl = await E("()=>!(typeof GL140!=='undefined'&&GL140.no)&&!!document.querySelector('.hc194')")
        if gl:
            hc = await E("()=>({dots:document.querySelectorAll('.hc194 circle').length,segs:document.querySelectorAll('[data-act=hc194]').length})")
            await E("()=>document.querySelector('[data-act=hc194][data-v=s]').click()"); await pg.wait_for_timeout(200)
            d2 = await E("()=>{const d=document.querySelector('.hc194 circle[data-band=red]');d.closest('svg').scrollIntoView({block:'center'});const r=d.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}}"); await pg.wait_for_timeout(150)
            await pg.mouse.move(d2["x"], d2["y"]); await pg.mouse.down(); await pg.mouse.move(d2["x"], d2["y"] + 20, steps=4); await pg.mouse.up(); await pg.wait_for_timeout(250)
            hs = await E("()=>S.ed.clips[0].cg.hsl&&S.ed.clips[0].cg.hsl.red"); out["hue"] = [hc, hs]
            chk("hue curves: 8 dots, 3 curves; the red dot dragged down on Hue vs Sat lowers red's saturation", hc["dots"] == 8 and hc["segs"] == 3 and hs and hs[1] < -20, out["hue"])
            await E("()=>{delete S.ed.clips[0].cg.hsl}")
        else: out["hue"] = "no WebGL here — hue curves hidden (as designed)"
        # ---- 9c. qualifier + mask + window
        await E(PIX, [.5, .25, .5]); q = await E("()=>pick194({x:.25,y:.5})"); out["q"] = q
        await E("()=>{const s=S.ed.clips[0].cg.sec194;s.sat=-100}"); l = await E(PIX, [.5, .25, .5]); r = await E(PIX, [.5, .75, .5])
        chk("qualifier: a pick on the red half sets the range (hue ≈ 0) and the secondary turns on; saturation −100 greys the red half only", q and q["on"] and (q["h"] < 15 or q["h"] > 345) and abs(l[0] - l[1]) < 25 and l[0] > 60 and near(r, [0, 0, 255]), [q, l, r])
        await E("()=>{S.ed.clips[0].cg.sec194.show=true}"); ml = await E(PIX, [.5, .25, .5]); mr = await E(PIX, [.5, .75, .5])
        chk("the mask view: white on the red half, black on the blue half", near(ml, [255, 255, 255]) and near(mr, [0, 0, 0]), [ml, mr])
        await E("()=>{const s=S.ed.clips[0].cg.sec194;s.show=false;s.q.on=false;s.win={on:true,shape:'ellipse',cx:.75,cy:.5,rx:40,ry:60,soft:5}}")
        wl = await E(PIX, [.5, .25, .5]); wr = await E(PIX, [.5, .75, .5]); wo = await E(PIX, [.5, .97, .5])
        chk("power window: an ellipse on the right half desaturates inside it only (the red half and the far corner untouched)", near(wl, [255, 0, 0]) and abs(wr[0] - wr[2]) < 30 and wr[2] < 200 and near(wo, [0, 0, 255], 40), [wl, wr, wo])
        ui = await E("()=>({pick:!!document.querySelector('[data-act=sec194-pick]'),track:!!document.querySelector('[data-act=sec194-track]'),sl:document.querySelectorAll('[data-sec194]').length,wheels:document.querySelectorAll('[data-wh193^=\"sec:\"]').length})")
        chk("the secondary's controls: pick, track, sliders, its own wheels", ui["pick"] and ui["track"] and ui["sl"] >= 18 and ui["wheels"] == 3, ui)
        await E("()=>{delete S.ed.clips[0].cg.sec194}")
        # tracking on the moving square (clip 2)
        await E("()=>{const c=S.ed.clips[1];c.cg={sec194:{on:true,sat:-100,win:{on:true,shape:'ellipse',cx:.14,cy:.36,rx:20,ry:35,soft:5}}};S.ed.sel=c.id;ED.t=2.02;ED.playing=false;renderView()}")
        kf = await E("async()=>{const r=await track194(S.ed.clips[1]);return r&&{n:r.length,first:r[0],last:r[r.length-1]}}"); out["track"] = kf
        chk("tracking: the window follows the white square to the right (≈ 24 steps, centre from x≈.14 to x≈.6)", kf and kf["n"] >= 20 and abs(kf["first"]["cx"] - .14) < .03 and .5 < kf["last"]["cx"] < .7 and abs(kf["last"]["cy"] - .36) < .06, kf)
        await E("()=>{delete S.ed.clips[1].cg}")
        # ---- 10a. pre-comp: a second timeline placed as a clip
        A = await E("()=>seqQ148(true).cur"); await E("()=>seqNew148(null)"); await pg.wait_for_timeout(200)
        await E("async()=>{await edUseJob(S.jobs.find(j=>j.id==='j_grey'),{stay:true,quiet:true,t:1});await edUseJob(S.jobs.find(j=>j.id==='j_sq'),{stay:true,quiet:true,t:1});S.ed.clips[0].in=0;S.ed.clips[0].out=1}")
        await pg.wait_for_function("S.ed.clips.length===2&&(()=>{const m=M['c_'+S.ed.clips[0].id];return m&&m.el&&m.el.complete})()", timeout=10000)
        Bid = await E("()=>seqQ148(true).cur"); await E("(a)=>seqGo148(a)", A); await pg.wait_for_timeout(300)
        await E("()=>{S.ed.tab='media';renderView()}"); await pg.wait_for_selector('[data-act="seq194-add"]', state="attached", timeout=10000)
        await E("()=>document.querySelector('[data-act=seq194-add]').click()"); await pg.wait_for_timeout(300)
        pc = await E("()=>{const c=S.ed.clips.find(x=>x.src&&x.src.k==='seq');const m=c&&M['c_'+c.id];return c&&{n:S.ed.clips.length,dur:+clipDur(c).toFixed(2),kind:m&&m.kind,w:m&&m.w,total:+edTotal().toFixed(2)}}"); out["precomp"] = pc
        chk("a timeline placed as one clip: 4 s long (1 s grey + 3 s clip), a live media of its own", pc and pc["n"] == 3 and pc["dur"] == 4 and pc["kind"] == "seq194" and pc["w"] > 0 and pc["total"] == 9, pc)
        s0 = await E("()=>{const i=S.ed.clips.findIndex(x=>x.src&&x.src.k==='seq');return edStarts()[i]}")
        g1 = await E(PIX, [s0 + .5, .5, .5]); g2 = await E(PIX, [s0 + .5, .1, .1])
        if not near(g1, [128, 128, 128], 12): print("DBG-PRECOMP", await E("()=>{const c=S.ed.clips.find(x=>x.src&&x.src.k==='seq'),r=seqData194(c.src.seq);return {clips:r.d.clips.map(n=>[n.src.job,n.in,n.out,!!(M['c_'+n.id]&&srcReady(M['c_'+n.id]))]),starts:S.ed.clips.map(c=>+clipDur(c).toFixed(2)),at:edAt(5.5)}}"))
        chk("…it draws live: grey at its start (the nested picture), in the preview", near(g1, [128, 128, 128], 12) and near(g2, [128, 128, 128], 12), [g1, g2])
        gx = await E("(t)=>{ED.t=t;R139.on=true;R139.mine=true;try{edTick(performance.now())}finally{R139.on=false;R139.mine=false}const c=document.getElementById('wk'),x=c.getContext('2d');return Array.from(x.getImageData(c.width>>1,c.height>>1,1,1).data).slice(0,3)}", s0 + .5)
        chk("…and in the frame-exact export", near(gx, [128, 128, 128], 12), gx)
        sq = await E(PIX, [s0 + 2.5, .5, .25]); chk("…later the nested clip shows (dark grey of the square clip's background)", near(sq, [32, 32, 32], 14), sq)
        back = await E(PIX, [.5, .25, .5]); chk("the outer timeline is untouched after a nested draw (red half still red; the playhead restored)", near(back, [255, 0, 0]) and (await E("()=>S.ed.clips.length")) == 3, back)
        rin = await E(RMS, [s0 + 1.2, s0 + 2.8]); rout = await E(RMS, [0.2, 1.8]); out["seqsound"] = [s0, rin, rout]
        chk("the nested clip's tone is in the exported sound where the pre-comp plays, and not before it", rin is not None and rin > .015 and (rout or 0) < .005, out["seqsound"])
        await E("()=>{S.ed.clips=S.ed.clips.filter(x=>!(x.src&&x.src.k==='seq'));persist()}")
        # ---- 10b. templates
        await E("()=>{S.ed.texts=[];S.ed.infos=[];ED.t=.5}"); keys = await E("()=>tplApply194('lower3',{name:'Sara',role:'Director',accent:'#ff0000',dur:4})")
        tp = await E("()=>({texts:S.ed.texts.map(t=>t.text),infos:S.ed.infos.map(i=>i.sh),grp:(S.ed.groups146||[]).slice(-1)[0]?.keys.length,start:S.ed.texts[0]?.start,end:S.ed.texts[0]?.end,tab:S.ed.tab})"); out["tpl"] = tp
        chk("lower third: name and role texts + a bar, grouped (3 keys), 4 s from the playhead", keys and len(keys) == 3 and tp["texts"] == ["Sara", "Director"] and tp["infos"] == ["rect"] and tp["grp"] == 3 and tp["start"] == .5 and tp["end"] == 4.5, tp)
        await E("()=>{S.ed.tab='text';renderView()}"); await pg.wait_for_selector('[data-act="tpl194"]', state="attached", timeout=10000)
        await E("()=>document.querySelector('[data-act=tpl194]').click()"); await pg.wait_for_timeout(200)
        n = await E("()=>document.querySelectorAll('#modalRoot .tile.tpl194').length"); await E("()=>document.querySelector('#modalRoot [data-act=tpl194-pick][data-v=title]').click()"); await pg.wait_for_timeout(200)
        await E("()=>{document.querySelector('#modalRoot [data-tplf194=title]').value='Hello';document.querySelector('#modalRoot [data-tpld194=\"6\"]').click();document.querySelector('#modalRoot [data-act=tpl194-go]').click()}"); await pg.wait_for_timeout(300)
        t2 = await E("()=>({texts:S.ed.texts.map(t=>t.text),dur:+(S.ed.texts[2].end-S.ed.texts[2].start).toFixed(1),modal:!!document.getElementById('modalRoot').innerHTML})"); out["tpl2"] = [n, t2]
        chk("the sheet lists 6 templates; the Title card form adds 'Hello' for 6 s and closes", n == 6 and t2["texts"][2] == "Hello" and t2["dur"] == 6 and not t2["modal"], out["tpl2"])
        sv = await E("()=>{S.ed.ms146=['text:'+S.ed.texts[0].id,'text:'+S.ed.texts[1].id];const T=tplSave194('Mine');return T&&{fields:T.fields.length,n:(S.tpl194||[]).length,rel:T.items.texts.map(x=>x.start)}}")
        ap = await E("()=>{ED.t=1;const k=tplApply194((S.tpl194||[])[0].id,{t0:'New name'});return {k:k&&k.length,texts:S.ed.texts.slice(-2).map(t=>[t.text,t.start])}}"); out["tplsave"] = [sv, ap]
        chk("a selection saved as a template (a field per text, times relative) and applied with a new word at 1 s", sv and sv["fields"] == 2 and sv["n"] == 1 and sv["rel"][0] == 0 and ap["k"] == 2 and ap["texts"][0][0] == "New name" and ap["texts"][0][1] == 1, out["tplsave"])
        await E("()=>{S.ed.texts=[];S.ed.infos=[];S.ed.groups146=[];S.ed.ms146=[]}")
        # ---- 11. pen paths
        await E("()=>{S.ed.tab='info';edSetPick(null);renderView()}"); await pg.wait_for_timeout(200); tile = await E("()=>!!document.querySelector('[data-act=sh141-add][data-v=path]')")
        await E("()=>{shAdd141('path');renderView()}"); await pg.wait_for_timeout(200)
        it0 = await E("(tile)=>{const it=S.ed.infos.find(x=>x.sh==='path');return it&&{pts:it.pts.length,smooth:it.smooth,tanim:it.tanim,panel:!!document.querySelector('[data-act=sh194-pen]'),tile}}", tile); out["path0"] = it0
        chk("a pen path shape exists with 3 starter points, a write-on, its panel and its tile", it0 and it0["pts"] == 3 and it0["smooth"] and it0["tanim"] == "draw" and it0["panel"] and it0["tile"], it0)
        await E("()=>{const it=S.ed.infos.find(x=>x.sh==='path');Object.assign(it,{pts:[[.1,.5],[.9,.5]],smooth:false,lw:6,line:'#ffffff',anim:'none',start:0,end:9,tanim:'none',trim:{s:0,e:50}})}")
        a = await E(PIX, [.5, .3, .5]); bb = await E(PIX, [.5, .7, .5]); chk("trim path to 50 %: the line is on the left, not on the right", a[1] > 150 and bb[1] < 60, [a, bb])
        await E("()=>{const it=S.ed.infos.find(x=>x.sh==='path');it.trim={s:0,e:100};it.tanim='draw';it.tdur=2}")
        w1 = await E(PIX, [.3, .3, .5]); w2 = await E(PIX, [.3, .7, .5]); w3 = await E(PIX, [3, .7, .5])
        chk("write-on over 2 s: early the left is drawn and the right not yet; later the whole line", w1[1] > 150 and w2[1] < 60 and w3[1] > 150, [w1, w2, w3])
        await E("()=>{const it=S.ed.infos.find(x=>x.sh==='path');it.tanim='none';it.rep={n:3,dy:20}}"); r2 = await E(PIX, [.5, .5, .7]); r3 = await E(PIX, [.5, .5, .9]); r0 = await E(PIX, [.5, .5, .8])
        chk("repeater: 3 copies 20 % apart — lines at 50 %, 70 % and 90 %, nothing at 80 %", r2[1] > 150 and r3[1] > 150 and r0[1] < 60, [r2, r3, r0])
        await E("()=>{const it=S.ed.infos.find(x=>x.sh==='path');it.rep=null;it.t1='HELLO HELLO';it.onPath=true;it.k=1}")
        above = await E("""()=>{ED.t=.5;edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d'),d=x.getImageData(Math.round(c.width*.15),Math.round(c.height*.40),Math.round(c.width*.7),Math.round(c.height*.08)).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i+1]>150)n++;return n}""")
        chk("words along the path sit above the line", above > 200, above)
        await E("()=>{const it=S.ed.infos.find(x=>x.sh==='path');it.t1='';it.onPath=false;it.pts=[[.3,.2],[.7,.2],[.5,.8]];it.closed=true;delete it.fill;it.accent='#CFE13E'}")
        fl = await E(PIX, [.5, .5, .45]); chk("a closed path fills with its colour", near(fl, [207, 225, 62], 25), fl)
        await E("()=>{const it=S.ed.infos.find(x=>x.sh==='path');edSetPick('info',it.id);S.ed.tab='info';renderView()}"); await pg.wait_for_timeout(200)
        dbg = await E("()=>({pick:JSON.stringify(edPick()),tab:S.ed.tab,panel:!!document.querySelector('.path194'),pen:!!document.querySelector('[data-act=sh194-pen]'),info:!!document.querySelector('[data-act=sh141-set]'),n:S.ed.infos.length})"); print("DBG-PEN", dbg)
        await E("()=>document.querySelector('[data-act=sh194-pen]').click()"); await pg.wait_for_timeout(200)
        box = await E("()=>{const r=document.getElementById('wk').getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.5}}"); await pg.mouse.click(box["x"], box["y"]); await pg.wait_for_timeout(200)
        pn = await E("()=>{const it=S.ed.infos.find(x=>x.sh==='path');return {n:it.pts.length,last:it.pts[it.pts.length-1],on:PEN194.on}}"); out["pen"] = pn
        chk("the pen: a tap on the picture adds a point there", pn["n"] == 4 and abs(pn["last"][0] - .5) < .03 and abs(pn["last"][1] - .5) < .03 and pn["on"], pn)
        await E("()=>{PEN194.on=false;S.ed.infos=[];renderView()}")
        # ---- 12. sound per track (the export mix)
        await E("()=>{S.ed.clips[0].vol=0}")   # (the picture has no sound anyway; the square clip's 7 kHz tone plays 2–5 s)
        r0 = await E(RMS, [2.3, 4.7]); out["rms0"] = r0
        await E("()=>{S.ed.fx194={clips:{gate:{on:true,thr:-10}}}}"); rg = await E(RMS, [2.3, 4.7])
        await E("()=>{S.ed.fx194={clips:{comp:{on:true,thr:-45,ratio:20}}}}"); rc = await E(RMS, [2.3, 4.7])
        await E("()=>{S.ed.fx194={clips:{dess:{on:true,amt:100}}}}"); rd = await E(RMS, [2.3, 4.7]); out["fx"] = [r0, rg, rc, rd]
        chk("clips: the gate silences the quiet tone, the compressor (threshold under it) lowers it, the de-esser removes the 7 kHz tone", r0 and r0 > .02 and rg < r0 * .1 and rc < r0 * .6 and rd < r0 * .4, out["fx"])
        await E("""async()=>{S.ed.fx194={};M.edMusic={type:'audio',url:'/media/music.mp3',el:Object.assign(document.createElement('audio'),{src:'/media/music.mp3'})};S.ed.musicVol=80;M.edVoice={type:'audio',url:'/media/voice.mp3',el:Object.assign(document.createElement('audio'),{src:'/media/voice.mp3'})};S.ed.voiceVol=0}""")
        m0 = await E(RMS, [.2, 1.8]); await E("()=>{S.ed.fx194={music:{eq:{lo:-18}}}}"); me = await E(RMS, [.2, 1.8]); out["eq"] = [m0, me]
        chk("music: EQ low −18 dB cuts the 110 Hz tone to under half", m0 and m0 > .01 and me < m0 * .5, out["eq"])
        await E("()=>{S.ed.voiceVol=100;S.ed.clipSound=false;S.ed.fx194={music:{duck:{src:'voice',amt:90}},voice:{eq:{hi:-18}}}}")
        G110 = """async()=>{const b=await mix139(edTotal());const SR=b.sampleRate,d=b.getChannelData(0),g=(a,c)=>{const i0=Math.round(a*SR),i1=Math.round(c*SR),k=2*Math.cos(2*Math.PI*110/SR);let s0=0,s1=0,s2=0;for(let i=i0;i<i1;i++){s0=d[i]+k*s1-s2;s2=s1;s1=s0}return Math.sqrt(Math.max(0,s1*s1+s2*s2-k*s1*s2))/(i1-i0)};return {during:g(.6,1.8),after:g(2.6,3.8)}}"""
        dk = await E(G110); await E("()=>{S.ed.fx194={};S.ed.voiceVol=0}"); nd = await E(G110); await E("()=>{S.ed.clipSound=true}"); out["duck"] = [dk, nd]
        chk("side-chain: the 110 Hz music drops under the voice (0–2 s) and comes back after it stops", dk["during"] < dk["after"] * .35 and dk["after"] > nd["after"] * .7 and abs(nd["during"] - nd["after"]) < nd["after"] * .3, out["duck"])
        await E("()=>{S.ed.tab='sfx';renderView()}"); await E("()=>{const d=document.createElement('div');d.id='mxp194';d.innerHTML=mixPanel150();document.body.appendChild(d)}")
        fx = await E("()=>({btns:document.querySelectorAll('#mxp194 [data-act=fx194]').length})"); await E("()=>document.querySelector('#mxp194 [data-act=fx194][data-v=music]').click()"); await pg.wait_for_timeout(200)
        sh = await E("()=>({sl:document.querySelectorAll('#modalRoot [data-fx194]').length,sel:!!document.querySelector('#modalRoot select[data-fx194=\"music:duck.src\"]'),title:document.querySelector('#modalRoot h2')?.textContent||''})")
        await E("()=>{const i=document.querySelector('#modalRoot [data-fx194=\"music:comp.on\"]');i.checked=true;i.dispatchEvent(new Event('input',{bubbles:true}))}"); await pg.wait_for_timeout(200)
        cp = await E("()=>({on:S.ed.fx194.music.comp.on,thr:!!document.querySelector('#modalRoot [data-fx194=\"music:comp.thr\"]')})"); out["fxui"] = [fx, sh, cp]
        chk("the mixer: an FX button per track opens its sheet (EQ, compressor, de-esser, gate, ducking source); switching the compressor on shows its sliders", fx["btns"] == 4 and sh["sl"] >= 7 and sh["sel"] and "Music" in sh["title"] and cp["on"] is True and cp["thr"], out["fxui"])
        await E("()=>{closeSheet();document.getElementById('mxp194').remove();S.ed.fx194={}}")
        # Arabic words
        await E("()=>{S.lang='ar';document.documentElement.dir='rtl';S.ed.tab='color';S.ed.sel=S.ed.clips[0].id;renderView()}"); await pg.wait_for_timeout(200)
        ar = await E("()=>document.querySelector('.sec194')?.innerText||''"); chk("Arabic labels in the secondary", "تدريج ثانوي" in ar, ar[:80])
        await E("()=>{S.ed.tab='text';renderView()}"); ar2 = await E("()=>document.querySelector('.tplrow194')?.innerText||''"); chk("Arabic templates button", "القوالب" in ar2, ar2)
        chk("no page errors", not errs, errs[:5])
        await b.close()
try: asyncio.run(main())
finally: srv.terminate(); srv.wait()
print(json.dumps(out, ensure_ascii=False, default=str)[:3000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]; print("server log:", open(D + "/server.log").read()[-1500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v194 OK")
