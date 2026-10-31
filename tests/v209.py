# v209 — several at once · studio looks · a studio behind you · pauses & stutters · DJ & beats · voices · fonts & languages.
#  · the editor's "Your videos & pictures": Select several → ticks in order → "Add 2" puts both on the timeline in that order;
#    a long press starts the selection; overlay and sound uploads take several files (each one added)
#  · the four looks (ideas of react-three-fiber, shadergradient, liquid-glass-js; liquid metal our own): drawn on the picture,
#    the same twice at the same time (preview = export), moving over time; the glass bends what is under it; the 3D object turns
#  · the Studio looks panel (tiles drawn), its options as chips; Background: Moving / Studio / Video + the studio finish
#  · Cut pauses & stutters: fillers, words said twice, broken starts, pauses → real cuts, the captions move up
#  · DJ effects change the sound (filter, beat repeat, tape stop); the beats (funk, house, hip-hop, lo-fi …) are real sound
#  · Voices: the lines from the words, two speakers told apart by pitch, the background-only track made on the device
#  · fonts for every script (Hebrew, Thai, Cyrillic … picked by themselves), 100+ languages, Hebrew right-to-left
#  · the server: a dubbed line keeps the original's laughs and sighs as audio tags; the face direction asks for lips and eyes
#  · panels fit a 390 px phone, English and Arabic, no page errors
# Run: python3 tests/v209.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8674; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v209-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-c:a", "libopus", "-shortest", D + "/media/a.webm")
FF("-f", "lavfi", "-i", "color=c=0x22aa55:s=640x360:d=4:r=30", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "200k", D + "/media/b.webm")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Beach',title:'Beach',created:now,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'},{id:'vb',kind:'video',status:'complete',prompt:'Green',title:'Green',created:now-9,progress:1,pal:PALS[1],seed:9,dur:4,aspect:'16:9',resultUrl:'/media/b.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});go('edit');renderAll()}"""
TAB = "(t)=>{const E=S.ed;E.tab=t;const T=TABS143.find(x=>x[4].includes(t));if(T)E.lt143=T[0];E.pclosed143=null;renderView()}"

async def run(p, lang, w, h):
    tag = f"{lang} {w}"; b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); mob = w < 700
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await E(SETUP, lang); await pg.wait_for_function("S.ed.clips.length===1&&document.querySelector('#wk')&&M['c_'+S.ed.clips[0].id]&&srcReady(M['c_'+S.ed.clips[0].id])", timeout=25000); await pg.wait_for_timeout(500)
    # ---- the panels fit and say their names
    for t in ["studio209", "dj209", "voice209", "media", "ai140"]:
        await E(TAB, t); await pg.wait_for_timeout(250)
        r = await E("()=>({over:document.documentElement.scrollWidth-innerWidth,body:!!document.querySelector('.ed143 .e-body'),wide:[...document.querySelectorAll('.ed143 .e-body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>2&&r.right>innerWidth+1&&!e.closest('.chips,.seg,.e-lib,.dj209t,.st209s,.v209l')}).map(e=>e.className+'').slice(0,4)})")
        chk(f"{tag}: the {t} panel fits the screen", r["body"] and r["over"] <= 1 and not r["wide"], r)
    if lang == "en":
        # ---- 1. several at once
        await E(TAB, "media"); await pg.wait_for_timeout(200)
        await pg.click('[data-act="ms209"]'); await pg.wait_for_timeout(150)
        await pg.click('.e-libi[data-v="vb"]'); await pg.click('.e-libi[data-v="va"]'); await pg.wait_for_timeout(150)
        r = await E("()=>({ids:MS209.ids.slice(),n:[...document.querySelectorAll('.e-libi.on')].map(b=>b.dataset.n),btn:(document.querySelector('[data-act=\"ms209-add\"]')||{}).textContent})")
        chk(f"{tag}: Select several ticks in order with numbers", r["ids"] == ["vb", "va"] and sorted(r["n"]) == ["1", "2"] and "2" in (r["btn"] or ""), r)
        await pg.click('[data-act="ms209-add"]'); await pg.wait_for_function("S.ed.clips.length===3", timeout=20000); await pg.wait_for_timeout(300)
        r = await E("()=>({src:S.ed.clips.map(c=>c.src&&c.src.job),on:MS209.on})")
        chk(f"{tag}: Add 2 puts both on the timeline in the order picked", r["src"][1:] == ["vb", "va"] and not r["on"], r)
        await E("()=>{S.ed.clips.splice(1,2);persist();renderView()}")
        r = await E("""async()=>{const mk=(n,t)=>new File([new Uint8Array(64)],n,{type:t});
          const sel=document.createElement('input');sel.type='file';sel.dataset.edxsfx='1';document.body.appendChild(sel);mark209(document);
          const dt=new DataTransfer();const b=await (await fetch('/media/a.webm')).blob();dt.items.add(new File([b],'one.webm',{type:'audio/webm'}));dt.items.add(new File([b],'two.webm',{type:'audio/webm'}));sel.files=dt.files;const n0=(S.ed.sfx||[]).length;
          sel.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,400));const n1=(S.ed.sfx||[]).length;sel.remove();
          return{multi:sel.multiple,added:n1-n0,ts:(S.ed.sfx||[]).slice(-2).map(x=>x.t)}}""")
        chk(f"{tag}: a sound upload takes two files and adds both", r["multi"] and r["added"] == 2 and r["ts"][1] > r["ts"][0], r)
        await E("()=>{S.ed.sfx=[];persist()}")
        # ---- 2. the looks
        r = await E("""async()=>{const E=S.ed;E.infos=[];ED.t=1;['sgrad209','lglass209','lmetal209','obj3d209'].forEach(sc=>{ED.t=1;lookAdd209(sc)});await three209();await new Promise(r=>setTimeout(r,800));
          const W=640,H=360,mk=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c},px=(c,x,y)=>Array.from(c.getContext('2d').getImageData(x,y,1,1).data),
            sum=c=>{const d=c.getContext('2d').getImageData(0,0,W,H).data;let s=0;for(let i=0;i<d.length;i+=4*37)s+=d[i]+d[i+1]*2+d[i+2];return s};
          const it=sc=>E.infos.find(x=>x.sc===sc),R={};
          // gradient: fills the frame, moves with time, the same twice
          let a=mk(),b2=mk(),c=mk();draw164(a.getContext('2d'),W,H,2,it('sgrad209'));draw164(b2.getContext('2d'),W,H,2,it('sgrad209'));draw164(c.getContext('2d'),W,H,4,it('sgrad209'));
          R.grad={same:sum(a)===sum(b2),moves:sum(a)!==sum(c),corner:px(a,4,4)[3]};
          // glass over stripes: the middle reads (blurred) stripes, the rim bends them — different from the stripes themselves
          const st=()=>{const s=mk(),x=s.getContext('2d');for(let i=0;i<16;i++){x.fillStyle=i%2?'#ff2a2a':'#1a3cff';x.fillRect(i*40,0,40,H)}return s};
          const g1=st(),base=st();draw164(g1.getContext('2d'),W,H,2.2,it('lglass209'));const g2=st();draw164(g2.getContext('2d'),W,H,2.2,it('lglass209'));
          let diff=0;const d1=g1.getContext('2d').getImageData(0,0,W,H).data,d0=base.getContext('2d').getImageData(0,0,W,H).data;for(let i=0;i<d1.length;i+=4*11)diff+=Math.abs(d1[i]-d0[i]);
          R.glass={same:sum(g1)===sum(g2),changed:diff>20000,outside:px(g1,4,4).join()===px(base,4,4).join(),gl:GL209.ok};
          // metal: shiny (very bright and very dark pixels inside the word) and revealed over time
          const m1=mk();draw164(m1.getContext('2d'),W,H,2.4,it('lmetal209'));const md=m1.getContext('2d').getImageData(0,0,W,H).data;let hi=0,lo=0,n=0;for(let i=0;i<md.length;i+=4*7){if(md[i+3]>200){n++;const l=md[i]+md[i+1]+md[i+2];if(l>650)hi++;if(l<150)lo++}}
          const m0=mk();draw164(m0.getContext('2d'),W,H,1.05,it('lmetal209'));R.metal={n,hi,lo,early:sum(m0)<sum(m1)};
          // 3D: draws a lit object, and it turns
          const o1=mk(),o2=mk();draw164(o1.getContext('2d'),W,H,2.2,it('obj3d209'));draw164(o2.getContext('2d'),W,H,3.4,it('obj3d209'));R.o3d={drawn:sum(o1)>0,turns:sum(o1)!==sum(o2),three:!!(window.THREE&&THREE.WebGLRenderer)};
          return R}""")
        out["looks"] = r
        chk(f"{tag}: moving gradient fills the frame, moves, the same twice (preview = export)", r["grad"]["same"] and r["grad"]["moves"] and r["grad"]["corner"] == 255, r["grad"])
        chk(f"{tag}: liquid glass bends what is under it, nothing outside, the same twice", r["glass"]["gl"] and r["glass"]["same"] and r["glass"]["changed"] and r["glass"]["outside"], r["glass"])
        chk(f"{tag}: liquid metal is chrome (bright and dark inside the shape) and melts in", r["metal"]["n"] > 300 and r["metal"]["hi"] > 10 and r["metal"]["lo"] > 10 and r["metal"]["early"], r["metal"])
        chk(f"{tag}: the 3D object is drawn and turns", r["o3d"]["three"] and r["o3d"]["drawn"] and r["o3d"]["turns"], r["o3d"])
        # options as chips, tiles drawn
        await E("()=>{const it=S.ed.infos.find(x=>x.sc==='lglass209');edSetPick('info',it.id);S.ed.tab='info';S.ed.lt143='stickers';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(300)
        r = await E("()=>({chips:[...document.querySelectorAll('[data-act=\"st209-opt\"]')].map(b=>b.dataset.k+':'+b.dataset.v).length,on:[...document.querySelectorAll('[data-act=\"st209-opt\"][aria-pressed=\"true\"]')].map(b=>b.dataset.k)})")
        chk(f"{tag}: the glass's options as chips, the current one pressed", r["chips"] >= 10 and set(["lg", "lt209", "lgs", "sz"]) <= set(r["on"]), r)
        await pg.click('[data-act="st209-opt"][data-k="lg"][data-v="pill"]'); await pg.wait_for_timeout(150)
        chk(f"{tag}: a chip changes the look", await E("()=>S.ed.infos.find(x=>x.sc==='lglass209').lg") == "pill")
        await E(TAB, "studio209"); await pg.wait_for_timeout(700)
        r = await E("()=>{const c=[...document.querySelectorAll('canvas.st209c')];return{n:c.length,drawn:c.filter(x=>{const d=x.getContext('2d').getImageData(x.width/2,x.height/2,1,1).data;return d[3]>0}).length}}")
        chk(f"{tag}: Studio looks: 4 looks + 10 gradients, each tile drawn", r["n"] == 14 and r["drawn"] >= 13, r)
        await E("()=>{S.ed.infos=[];persist();renderView()}")
        # ---- 3. a studio behind you (a fake cut-out: the left half is the person)
        r = await E("""async()=>{const E=S.ed,c=E.clips[0],m=clipMedia(c),cut=document.createElement('canvas');cut.width=64;cut.height=36;const x=cut.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,32,36);
          BG144[c.id]={busy:false,n:1,done:1,frames:[{t:0,cut:await createImageBitmap(cut)}],ready:true,url:bgSrc144(m)};const R={};
          for(const mode of ['live','set','color']){c.bg144={on:true,mode,col:'#00b140',sg209:'lava',set209:'neon'};const r=edxSmooth(c,m,1);const d=r.el.getContext('2d').getImageData(Math.round(r.el.width*.8),Math.round(r.el.height/2),1,1).data;R[mode]=Array.from(d).slice(0,3)}
          c.bg144={on:true,mode:'live',sg209:'ocean',fe209:2,lw209:2,sh209:2,mc209:1};let ok=true;try{edxSmooth(c,m,1)}catch(e){ok=String(e)}R.finish=ok;
          E.tab='bg144';edSetPick('clip',c.id);E.pclosed143=null;renderView();await new Promise(r=>setTimeout(r,300));
          R.modes=[...document.querySelectorAll('[data-act="bg144-mode"]')].map(b=>b.dataset.v);R.fin=document.querySelectorAll('[data-bg209f]').length;c.bg144={on:false};delete BG144[c.id];renderView();return R}""")
        chk(f"{tag}: background: moving / studio / colour each change what is behind", r["live"] != r["color"] and r["set"] != r["color"] and r["color"] == [0, 177, 64] and r["finish"] is True, r)
        chk(f"{tag}: background panel has Moving · Studio · Video and the four finish sliders", set(["live", "set", "vid"]) <= set(r["modes"]) and r["fin"] == 4, r)
        # ---- 4. pauses & stutters
        r = await E("""()=>{const E=S.ed,W=[['So',.2,.4],['um',.5,.8],['I',.9,1],['I',1.1,1.2],['think',1.3,1.6],['wh-',1.7,1.8],['what',1.9,2.2],['now',3.4,3.7],['هذا',3.8,4.1],['امم',4.2,4.5],['جميل',4.6,5]].map(([w,s,e])=>({w,s,e}));
          E.caps.words=W;const cuts=stutters209(W,{fill:true,rep:true,gap:.8});const kinds=cuts.map(x=>x[2]);const t0=edTotal();const sec=cutRanges209(cuts);
          return{kinds,t0,t1:edTotal(),sec,clips:E.clips.length,words:E.caps.words.map(w=>w.w),last:E.caps.words[E.caps.words.length-1].s}}""")
        out["cut"] = r
        chk(f"{tag}: fillers (um, امم), repeats (I I), a broken start (wh- what) and a long pause are found", r["kinds"].count("fill") == 2 and r["kinds"].count("rep") == 2 and r["kinds"].count("gap") == 1, r)
        chk(f"{tag}: they are cut: the clip in parts, shorter, the captions moved up", r["clips"] >= 3 and abs((r["t0"] - r["t1"]) - r["sec"]) < .05 and "um" not in r["words"] and "امم" not in r["words"] and r["last"] < 4.6, r)
        await E("()=>{histUndo&&histUndo()}") if await E("()=>typeof histUndo==='function'") else None
        # ---- 5. DJ & beats
        r = await E("""async()=>{const SR=44100,mk=()=>{const b=new AudioBuffer({numberOfChannels:1,length:SR*3,sampleRate:SR}),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=.3*Math.sin(i*2*Math.PI*220/SR)+.2*Math.sin(i*2*Math.PI*3300/SR);return b};
          const rms=b=>{const d=b.getChannelData(0);let s=0;for(let i=0;i<d.length;i++)s+=d[i]*d[i];return Math.sqrt(s/d.length)},diff=(a,b)=>{const x=a.getChannelData(0),y=b.getChannelData(0);let s=0;for(let i=0;i<x.length;i+=7)s+=Math.abs(x[i]-y[i]);return s};
          const R={},src=mk();for(const fx of ['filter','echo','crush','repeat','tapestop']){const o=await djApply209(mk(),{fx,mix:80,bpm:120});R[fx]=+diff(src,o).toFixed(1)}
          const E=S.ed;E.fx194={music:{dj:{fx:'wobble',mix:60}}};R.any=djAny209();E.fx194={};R.none=djAny209();
          for(const g of ['funk','house','hiphop','lofi']){const b=await beat209(g,110,3);R['beat_'+g]=+rms(b).toFixed(3)}return R}""")
        out["dj"] = r
        chk(f"{tag}: DJ effects change the sound (filter, echo, crush, beat repeat, tape stop)", all(r[k] > 50 for k in ["filter", "echo", "crush", "repeat", "tapestop"]), r)
        chk(f"{tag}: a DJ effect on a track turns the per-track export on", r["any"] and not r["none"], r)
        chk(f"{tag}: the beats are real sound (funk, house, hip-hop, lo-fi)", all(r["beat_" + g] > .02 for g in ["funk", "house", "hiphop", "lofi"]), r)
        await E(TAB, "dj209"); await pg.wait_for_timeout(200)
        await pg.click('[data-act="dj209-fx"][data-v="echo"]'); await pg.wait_for_timeout(150)
        chk(f"{tag}: the DJ tile sets the effect on the music", await E("()=>((S.ed.fx194||{}).music||{}).dj&&S.ed.fx194.music.dj.fx") == "echo")
        await E("()=>{S.ed.fx194={};persist()}")
        await pg.click('[data-act="beat209"][data-v="funk"]'); await pg.wait_for_function("M.edMusic&&/funk/.test(M.edMusic.name||'')", timeout=20000)
        chk(f"{tag}: Make a beat (funk) becomes the music", await E("()=>!!M.edMusic"))
        # ---- 6. voices
        r = await E("""async()=>{const W=[['Hello',.2,.5],['there.',.55,.9],['How',2,2.2],['are',2.25,2.4],['you?',2.45,2.8],['Fine',4,4.3],['thanks.',4.35,4.8]].map(([w,s,e])=>({w,s,e}));const L2=lines209(W);
          const SR=16000,a=new Float32Array(SR*5);for(let i=0;i<a.length;i++){const t=i/SR,f=t<1.5?120:t<3.5?240:120;a[i]=.4*Math.sin(2*Math.PI*f*t)}
          const f=[f0209(a,SR,.2,.9),f0209(a,SR,2,2.8)];return{n:L2.length,text:L2.map(l=>l.text),f}}""")
        chk(f"{tag}: the lines come from the words; pitch tells a low voice (~120 Hz) from a high one (~240 Hz)", r["n"] == 3 and r["text"][0] == "Hello there." and abs(r["f"][0] - 120) < 12 and abs(r["f"][1] - 240) < 24, r)
        r = await E("""async()=>{const c=S.ed.clips[0],n0=(S.ed.sfx||[]).length;await bgOnly209(c);return{added:(S.ed.sfx||[]).length-n0,vol:c.vol,name:((S.ed.sfx||[]).slice(-1)[0]||{}).name}}""")
        chk(f"{tag}: Background only: a new track on the device, the clip's own sound off", r["added"] == 1 and r["vol"] == 0, r)
        await E(TAB, "voice209"); await pg.wait_for_timeout(200)
        r = await E("()=>{S.ed.rep209={on:true,voice:'',lines:[{i:0,s:.2,e:.9,text:'Hello there.',spk:'A',on:false,done:false},{i:1,s:2,e:2.8,text:'How are you?',spk:'B',on:false,done:false}]};renderView();return document.querySelectorAll('.v209i').length}")
        await pg.click('[data-act="v209-pick"][data-v="B"]'); await pg.wait_for_timeout(150)
        r2 = await E("()=>({on:S.ed.rep209.lines.map(l=>l.on),cost:repCost209(),btn:!!document.querySelector('[data-act=\"v209-run\"]:not([disabled]) .cost')})")
        chk(f"{tag}: Replace a speaker: the lines listed, 'Tick all B' ticks B, priced first", r == 2 and r2["on"] == [False, True] and r2["cost"] >= 1 and r2["btn"], [r, r2])
        # ---- 7. fonts & languages
        r = await E("""()=>{S.ed.texts=[{id:'th',text:'שלום עולם สวัสดี Привет',start:0,end:3,pos:'center',style:'clean',anim:'none',size:6}];renderView();
          return{fonts:['Heebo','Noto Sans Thai','Amiri','Vazirmatn','PT Sans','Noto Sans Ethiopic'].filter(f=>FONTS.some(x=>x[0]===f)).length,cats:FCATS.map(c=>c[0]),stack:fontStack('Inter'),loaded:[...FL209],
            langs:LANGS.length,has:['he','vi','pl','uk','bn','sw','yo','ka'].filter(c=>LANGS.some(l=>l[0]===c)).length,rtl:RTL_LANGS.includes('he')}}""")
        out["fonts"] = r
        chk(f"{tag}: fonts for more scripts, their own groups, fallbacks in every text, picked by the words", r["fonts"] == 6 and {"cyr", "he", "th", "fa"} <= set(r["cats"]) and "Heebo" in r["stack"] and {"Heebo", "Noto Sans Thai", "Noto Sans"} <= set(r["loaded"]), r)
        chk(f"{tag}: 100+ languages (Hebrew, Vietnamese, Polish …), Hebrew right to left", r["langs"] >= 100 and r["has"] == 8 and r["rtl"], r)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await b.close()

def server_checks():
    js = """import { reactions209, keepReactions209, REACT_RULE209 } from "%s/lib/react209.js"; import { LIVING165, faceShort165, ruleBeats165 } from "%s/lib/face165.js"; import { craftNotes } from "%s/lib/skills.js";
      console.log(JSON.stringify({a:reactions209("hahaha so funny"),b:keepReactions209("hahaha so funny","مضحك جداً"),c:keepReactions209("(sighs) fine","حسناً"),d:keepReactions209("ok","حسناً ههههه"),e:reactions209("آخر خبر"),
        rule:REACT_RULE209.includes("[laughs]"),lips:/close fully on m, b and p/.test(LIVING165),eyes:/eyelids follow the gaze/.test(LIVING165),short:/closed on m, b, p/.test(faceShort165(ruleBeats165("Hi."))),body:craftNotes("physics",40).includes("A body moves from its centre")}))""" % (ROOT, ROOT, ROOT)
    r = json.loads(subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True, timeout=60).stdout)
    out["server"] = r
    chk("server: a laugh in the original becomes [laughs] in the dubbed line; a sigh [sighs]; typed laughter becomes the tag", r["a"] == ["laughs"] and r["b"].startswith("[laughs]") and r["c"].startswith("[sighs]") and r["d"].startswith("[laughs]") and "ههه" not in r["d"] and r["e"] == [], r)
    chk("server: the translator is told to keep the reactions; the face direction asks for lips (m, b, p) and living eyelids; the body notes are in the physics skill", r["rule"] and r["lips"] and r["eyes"] and r["short"] and r["body"], r)
    src = open(ROOT + "/lib/localize.js").read()
    chk("server: dubbing keeps the reactions and speaks a tagged line with the expressive voice", "keepReactions209(l.text" in src and "${REACT_RULE209}" in src and "expressive: /\\[[a-z][a-z ]{1,24}\\]/i.test(L.text)" in src)

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        await run(p, "en", 1280, 860)
        await run(p, "ar", 390, 844)
    server_checks()
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:6000])
print("fails", fails)
sys.exit(1 if fails else 0)
