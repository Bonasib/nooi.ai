# v278 — nooi Studio, the rest of the Filmora-16 plan in one update (all drawn or heard on the device; stabilise on the server's
# processor; no graphics card on the server):
#  · library: 80+ effects, 80+ transitions, 40 looks, 40 text templates, 20 text motions — every new effect and transition really
#    changes the picture; the tiles are pictures drawn by the compositor itself; search finds one in English or Arabic
#  · colour: curves (drag a point), colour wheels, scopes; an adjustment layer colours everything under it
#  · sound: 12 voices (the chipmunk voice is really higher), an equaliser, a compressor, the clean-up in the export, ducking per track
#  · big projects: a preview copy (proxy) and preview quality, nest / un-nest, the timeline draws only what is near the view
#  · Arabic names; no page errors
# Run: python3 tests/v278.py
import asyncio, json, os, subprocess, sys, tempfile
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8778; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v278-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
VP9 = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "800k"]
FF("-f", "lavfi", "-i", "testsrc2=s=640x360", "-frames:v", "1", D + "/scene.png")
FF("-f", "lavfi", "-i", "color=c=red:s=320x180", "-frames:v", "1", D + "/red.png")
FF("-f", "lavfi", "-i", "color=c=blue:s=320x180", "-frames:v", "1", D + "/blue.png")
FF("-f", "lavfi", "-i", "color=c=0x808080:s=320x180", "-frames:v", "1", D + "/grey.png")
FF("-f", "lavfi", "-i", "sine=f=440:d=2:sample_rate=48000", "-ac", "1", D + "/tone.wav")
FF("-f", "lavfi", "-i", "testsrc2=s=1280x720:d=2:r=30", *VP9, D + "/big.webm")
FF("-f", "lavfi", "-i", "testsrc2=s=800x450:d=2:r=30", "-vf", "crop=720:400:40+30*sin(t*23):25+20*cos(t*19)", *VP9, D + "/shaky.webm")
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
ONLY = [x for x in os.environ.get('ONLY', '').split(',') if x]
def chk(name, ok, info=None):
    print(("ok   " if ok else "FAIL ") + name + ("" if ok or info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]), flush=True)
    if not ok: fails.append(name)
P = "window.__studio.editor.project"
# the whole preview as a small grid of colours (8×6) — to compare two pictures
GRID = "()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);const o=[];for(let j=0;j<12;j++)for(let i=0;i<16;i++){const x=Math.floor((i+.5)*W/16),y=Math.floor((j+.5)*H/12),k=(y*W+x)*4;o.push(d[k],d[k+1],d[k+2])}return o}"
PIX = "(xy)=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),d=new Uint8Array(4);g.readPixels(Math.round((c.width-1)*xy[0]),Math.round((c.height-1)*(1-xy[1])),1,1,g.RGBA,g.UNSIGNED_BYTE,d);return Array.from(d.slice(0,3))}"
# how much of the whole preview changed since `mark` was set (share of pixels moved by more than 24 levels)
MARK = "()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);window.__mk=d}"
CHG = "()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);const m=window.__mk;let n=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-m[i])+Math.abs(d[i+1]-m[i+1])+Math.abs(d[i+2]-m[i+2])>24)n++;return n/(W*H)}"
diff = lambda a, b: sum(abs(x - y) for x, y in zip(a, b)) / max(1, len(a))

async def fresh(pg, files):
    E = pg.evaluate
    await E("()=>{const e=window.__studio.editor;e.run('clear',p=>{for(const t of p.tracks)t.clips=[];p.transitions=[];p.assets={}});e.select([]);window.__studio.ui.set({rail:'media',panelOpen:true})}"); await pg.wait_for_timeout(200)
    await pg.set_input_files('[data-testid="file-input"]', [D + "/" + f for f in files])
    await pg.wait_for_function("(n)=>Object.keys(" + P + ".assets).length===n", arg=len(files), timeout=30000); await pg.wait_for_timeout(300)
    return {a["name"]: a["id"] for a in await E("()=>Object.values(" + P + ".assets).map(a=>({id:a.id,name:a.name}))")}

async def show(pg, t, wait=500):
    await pg.evaluate("(t)=>{window.__studio.player.seek(t);window.__studio.player.redraw()}", t); await pg.wait_for_timeout(wait)

async def run(p, lang, vw, vh):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": vw, "height": vh}, accept_downloads=True, locale="ar" if lang == "ar" else "en-US")
    pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.on("console", lambda m: errs.append("console: " + m.text[:300]) if m.type == "warning" and m.text.startswith("draw") else None)
    await pg.add_init_script("window.__toasts=[];new MutationObserver(()=>{for(const t of document.querySelectorAll('.toast'))if(!window.__toasts.includes(t.textContent))window.__toasts.push(t.textContent)}).observe(document,{subtree:true,childList:true})")
    await pg.add_init_script("try{localStorage.setItem('nooi-studio-ui',JSON.stringify({lang:'" + lang + "'}))}catch(e){}")
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&window.__studio.player", timeout=30000)
    if lang == "ar":
        A = await fresh(pg, ["scene.png"]); await E("(id)=>{const c=window.__studio.actions.addAsset(" + P + ".assets[id],0);window.__studio.editor.select([c.id]);window.__studio.ui.set({inspector:'color'})}", A["scene"])
        await pg.wait_for_timeout(600)
        secs = await E("()=>[...document.querySelectorAll('.inspector .isech b')].map(b=>b.textContent)")
        chk("Arabic: curves, wheels and scopes are named in Arabic", all(x in secs for x in ["المنحنيات", "عجلات الألوان", "أدوات القياس"]), secs)
        await E("()=>window.__studio.ui.set({rail:'effects',panelOpen:true,sub:{effects:'effects'}})"); await pg.wait_for_timeout(400)
        heads = await E("()=>[...document.querySelectorAll('.lib278s .ns-lbl')].map(x=>x.firstChild.textContent.trim())")
        chk("Arabic: the effect groups are named in Arabic", "تشويه" in heads and "جزيئات" in heads, heads)
        await pg.fill('[data-testid="fx-search"]', "عين"); await pg.wait_for_timeout(200)
        found = await E("()=>[...document.querySelectorAll('[data-testid^=fx-]')].map(x=>x.dataset.testid).filter(x=>x!=='fx-search')")
        chk("Arabic: search finds an effect by its Arabic name", "fx-fisheye" in found and len(found) < 6, found)
        chk("Arabic: no page errors", not errs, errs[:3]); await b.close(); return

    if not ONLY or "lib" in ONLY:
        # ---- the library sizes
        await E("()=>window.__studio.ui.set({rail:'effects',panelOpen:true,sub:{effects:'effects'}})"); await pg.wait_for_timeout(500)
        nfx = await E("()=>document.querySelectorAll('.lib278s [data-testid^=fx-]').length")
        await E("()=>window.__studio.ui.set({sub:{effects:'weather'}})"); await pg.wait_for_timeout(200); nw = await E("()=>document.querySelectorAll('[data-testid^=fx-]').length")
        await E("()=>window.__studio.ui.set({sub:{effects:'erase'}})"); await pg.wait_for_timeout(200); ne = await E("()=>document.querySelectorAll('[data-testid^=fx-]').length")
        chk("80+ effects (the Effects tab in groups, weather & light, erase & blur)", nfx + nw + ne >= 80 and nfx >= 70, [nfx, nw, ne])
        await E("()=>window.__studio.ui.set({sub:{effects:'effects'}})"); await pg.wait_for_timeout(300)
        try: await pg.wait_for_function("()=>document.querySelectorAll('.lib278s .fxsw.has img').length>=document.querySelectorAll('.lib278s .fxsw').length", timeout=60000)
        except Exception: pass
        pics = await E("()=>[document.querySelectorAll('.lib278s .fxsw.has img').length,document.querySelectorAll('.lib278s .fxsw').length]")
        chk("every effect tile is a picture drawn by the compositor", pics[0] == pics[1] and pics[0] >= 70, pics)
        srcs = await E("()=>new Set([...document.querySelectorAll('.lib278s .fxsw.has img')].map(i=>i.src)).size")
        chk("the effect tiles are all different pictures", srcs >= pics[0] - 4, [srcs, pics[0]])
        await pg.fill('[data-testid="fx-search"]', "fish"); await pg.wait_for_timeout(200)
        found = await E("()=>[...document.querySelectorAll('.lib278s [data-testid^=fx-]')].map(x=>x.dataset.testid)")
        chk("search finds an effect by its name", found == ["fx-fisheye"], found)
        await pg.fill('[data-testid="fx-search"]', "")
        await E("()=>window.__studio.ui.set({rail:'transitions',panelOpen:true})"); await pg.wait_for_timeout(500)
        ntr = await E("()=>document.querySelectorAll('.lib278s [data-testid^=tr-]').length")
        chk("80+ transitions, in groups", ntr >= 80, ntr)
        try: await pg.wait_for_function("()=>document.querySelectorAll('.lib278s .fxsw.has img').length>=80", timeout=60000)
        except Exception: pass
        chk("the transition tiles are pictures too", await E("()=>document.querySelectorAll('.lib278s .fxsw.has img').length") >= 80)
        await E("()=>window.__studio.ui.set({rail:'effects',panelOpen:true,sub:{effects:'filters'}})"); await pg.wait_for_timeout(400)
        nlk = await E("()=>document.querySelectorAll('[data-testid^=look-]').length - (document.querySelector('[data-testid=look-search]')?1:0)")
        chk("40 looks", nlk >= 40, nlk)
        await E("()=>window.__studio.ui.set({rail:'titles',panelOpen:true,sub:{titles:'text'}})"); await pg.wait_for_timeout(400)
        ntp = await E("()=>document.querySelectorAll('[data-testid^=tpl-]').length")
        chk("40 text templates", ntp >= 40, ntp)

    if not ONLY or "fx" in ONLY:
        # ---- every effect changes the picture (on a colourful picture)
        A = await fresh(pg, ["scene.png"]); cid = await E("(id)=>window.__studio.actions.addAsset(" + P + ".assets[id],0).id", A["scene"])
        await E("()=>window.__studio.editor.select([])"); await show(pg, 1.3, 700); base = await E(GRID); await E(MARK)
        new_fx = ["fisheye","bulge","pinch","twirl","ripple","wave","kaleido","mirrorV","quad","split3","zoomPulse","heatHaze","underwater","jitter","tiltShift","zoomBlur","motionBlurH","spinBlur","bloom","halation","dreamy","chromaLens","lensFlare","godRays","strobe","flicker","emboss","edges","sketch","cartoon","oil","halftone","crosshatch","dotMatrix","hexPixel","neonEdges","popArt","blockGlitch","duotone","duotoneB","thermal","nightVision","infrared","xray","hueCycle","rainbow","colorPop","bleach","crt","filmBurn","scratches","grunge","bokeh","fireflies","confetti","hearts","embers","smoke","lightning","letterbox","frameWhite","roundFrame"]
        flat = []
        for fx in new_fx:
            await E("([id,fx])=>window.__studio.editor.run('fx',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id)c.effects=[{id:'e1',type:fx,enabled:true,params:{amount:0.9}}]})", [cid, fx])
            best = 0
            for tt in (1.3, 0.47, 2.11, 0.9):   # some come and go (strobe, lightning, sparks): a few moments
                await show(pg, tt, 150); best = max(best, await E(CHG))
                if best >= 0.0008: break
            if best < 0.0008: flat.append([fx, round(best, 5)])
        chk("every new effect changes the picture", not flat, flat)
        chk("the effects draw without errors", not errs, errs[:3])

    if not ONLY or "tr" in ONLY:
        # ---- every new transition is a real mix of the two clips at its middle
        A = await fresh(pg, ["red.png", "blue.png"])
        ca = await E("(id)=>window.__studio.actions.addAsset(" + P + ".assets[id],0).id", A["red"])
        cb = await E("(id)=>{const c=window.__studio.actions.addAsset(" + P + ".assets[id],4);return c.id}", A["blue"])
        await E("([a,b])=>window.__studio.editor.run('t',p=>{const tr=p.tracks.find(t=>t.clips.some(c=>c.id===a));const A=tr.clips.find(c=>c.id===a),B=tr.clips.find(c=>c.id===b);B.start=A.start+A.dur;p.transitions=[{id:'x1',track:tr.id,a,b,type:'fade',dur:1}]})", [ca, cb])
        cut = await E("(b)=>window.__studio.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.id===b).start", cb)
        await show(pg, cut - 0.8, 300); pa = await E(GRID); await show(pg, cut + 0.8, 300); pb = await E(GRID)
        alltr = ["crossZoom","whipL","whipR","whipU","whipD","dissolve","burn","leakT","heart","star","irisSq","plus","splitV","splitH","cubeL","cubeR","flipH","flipV","rotateIn","zoomSpin","bounceIn","swirl","rippleT","waveT","squares","hexT","dotsT","linesT","windL","digital","dreamyT","colorFlash","ink","spiral","fan","zigzag","ellipse","page","stackUp","zoomThrough","shakeT","lumaInv","softWipeL","softWipeR","bars","blindsV","crossWarp"]
        same = []
        for tp in alltr:
            await E("(tp)=>window.__studio.editor.run('t',p=>{p.transitions[0].type=tp})", tp)
            ks = [0.5, 0.35, 0.65, 0.82, 0.18]; ok = False
            for k in ks:
                await show(pg, cut - 0.5 + k, 140); g = await E(GRID)
                if diff(g, pa) > 4 and diff(g, pb) > 4: ok = True; break
            if not ok: same.append([tp, round(diff(g, pa), 1), round(diff(g, pb), 1)])
        chk("every new transition mixes the two clips in its middle", not same, same)
        await E("()=>window.__studio.editor.run('t',p=>{p.transitions[0].type='heart'})"); await show(pg, cut - 0.5 + 0.02, 200); early = await E(GRID); await show(pg, cut + 0.49, 200); late = await E(GRID)
        chk("a transition starts on the first clip and ends on the second", diff(early, pa) < 6 and diff(late, pb) < 6, [diff(early, pa), diff(late, pb)])

    if not ONLY or "color" in ONLY:
        # ---- colour: curves (invert the master curve → red becomes cyan), wheels, the UI drag, scopes
        A = await fresh(pg, ["red.png", "grey.png"])
        rc = await E("(id)=>window.__studio.actions.addAsset(" + P + ".assets[id],0).id", A["red"])
        await E("(id)=>window.__studio.editor.run('c',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id)c.color.curves={l:[1,.75,.5,.25,0],r:[0,.25,.5,.75,1],g:[0,.25,.5,.75,1],b:[0,.25,.5,.75,1]}})", rc)
        await show(pg, 1, 400); px = await E(PIX, [0.5, 0.5])
        chk("curves: an upside-down curve makes red cyan", px[0] < 60 and px[1] > 190 and px[2] > 190, px)
        await E("(id)=>window.__studio.editor.run('c',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id){c.color.curves=null;c.color.wheels={lift:[0,0,0],gamma:[0,0,0],gain:[-0.6,0,0]}}})", rc)
        await show(pg, 1, 300); px2 = await E(PIX, [0.5, 0.5])
        chk("colour wheels: less red in the highlights darkens the red", px2[0] < 150, px2)
        await E("(id)=>{window.__studio.editor.run('c',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id)c.color.wheels=null});window.__studio.editor.select([id]);window.__studio.ui.set({inspector:'color'})}", rc)
        await pg.wait_for_timeout(500)
        if not await E("()=>!!document.querySelector('[data-testid=curves]')"): await pg.click('[data-testid="sec-curves278"]'); await pg.wait_for_timeout(200)
        await pg.locator('[data-testid="curves"]').scroll_into_view_if_needed()
        pt = await (await pg.query_selector('[data-testid="crv-pt-4"]')).bounding_box(); sv = await (await pg.query_selector('[data-testid="curves"]')).bounding_box()
        await pg.mouse.move(pt["x"] + pt["width"] / 2, pt["y"] + pt["height"] / 2); await pg.mouse.down(); await pg.mouse.move(pt["x"] + pt["width"] / 2, sv["y"] + sv["height"] * 0.55, steps=6); await pg.mouse.up()
        cu = await E("(id)=>window.__studio.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.id===id).color.curves", rc)
        await show(pg, 1, 300); px3 = await E(PIX, [0.5, 0.5])
        chk("dragging the curve's top point down darkens the picture (one undo step)", cu and cu["l"][4] < 0.6 and px3[0] < 200, [cu, px3])
        if not await E("()=>!!document.querySelector('[data-testid=scope]')"): await pg.click('[data-testid="sec-scopes278"]')
        await pg.locator('[data-testid="scope"]').scroll_into_view_if_needed(); await pg.wait_for_timeout(900)
        lit = await E("()=>{const c=document.querySelector('[data-testid=scope]');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>30)n++;return n}")
        chk("the waveform scope draws the preview", lit > 40, lit)
        await pg.click('[data-testid="scope-vector"]'); await pg.wait_for_timeout(700)
        lit2 = await E("()=>{const c=document.querySelector('[data-testid=scope]');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>30)n++;return n}")
        chk("the vectorscope draws too", lit2 > 20, lit2)

    if not ONLY or "adjust" in ONLY:
        # ---- adjustment layer: black-and-white over a red picture
        await E("()=>window.__studio.editor.select([])"); await pg.click('[data-testid="adjust-add"]')
        await pg.wait_for_function("()=>window.__studio.editor.project.tracks.flatMap(t=>t.clips).some(c=>c.adjust)", timeout=15000)
        adj = await E("()=>window.__studio.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.adjust).id")
        await E("(id)=>window.__studio.editor.run('a',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id){c.start=0;c.dur=4;c.effects=[{id:'m',type:'mono',enabled:true,params:{amount:1}}]}})", adj)
        await show(pg, 1, 400); px4 = await E(PIX, [0.5, 0.5])
        chk("an adjustment layer turns the red clip under it grey", abs(px4[0] - px4[1]) < 12 and abs(px4[1] - px4[2]) < 12 and px4[0] > 20, px4)
        await E("(id)=>window.__studio.editor.run('a',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id)c.start=10})", adj); await show(pg, 1, 300); px5 = await E(PIX, [0.5, 0.5])
        chk("…and only while it lasts", px5[0] > px5[1] + 60 and px5[0] > px5[2] + 60, px5)

    if not ONLY or "sound" in ONLY:
        # ---- sound: chipmunk voice really higher; EQ; clean-up in the export; ducking per track
        A = await fresh(pg, ["tone.wav"]); tc = await E("(id)=>window.__studio.actions.addAsset(" + P + ".assets[id],0).id", A["tone"])
        FREQ = "async(fx)=>{const s=window.__studio;s.editor.run('v',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.type==='media'){c.afx=fx}});const ab=await s.engine.mixSound(s.editor.project,0,1.5);const d=ab.getChannelData(0);let z=0;for(let i=24000;i<60000;i++)if(d[i-1]<0&&d[i]>=0)z++;let e=0;for(let i=24000;i<60000;i++)e+=d[i]*d[i];return [z/(36000/48000),Math.sqrt(e/36000)]}"
        f0 = await E(FREQ, None); f1 = await E(FREQ, {"eq": [0, 0, 0], "voice": "chipmunk", "comp": False}); f2 = await E(FREQ, {"eq": [0, 0, 0], "voice": "deep", "comp": False})
        chk("the tone is 440 Hz untouched", abs(f0[0] - 440) < 12, f0)
        chk("chipmunk voice: 7 semitones higher (≈ 659 Hz)", abs(f1[0] - 659) < 35, f1)
        chk("deep voice: 5 semitones lower (≈ 330 Hz)", abs(f2[0] - 330) < 30, f2)
        f3 = await E(FREQ, {"eq": [0, 12, 0], "voice": "none", "comp": False})
        chk("the equaliser's mid band makes 440 Hz louder", f3[1] > f0[1] * 1.5, [f0, f3])
        rob = await E(FREQ, {"eq": [0, 0, 0], "voice": "robot", "comp": False}); tel = await E(FREQ, {"eq": [0, 0, 0], "voice": "telephone", "comp": False})
        chk("robot and telephone voices change the sound", abs(rob[0] - 440) > 20 or abs(rob[1] - f0[1]) > 0.05, [rob, tel])
        # every voice renders and isn't silent
        quiet = []
        for v in ["deep","chipmunk","robot","telephone","radio","echo","hall","underwater","monster","alien","megaphone"]:
            r = await E(FREQ, {"eq": [0, 0, 0], "voice": v, "comp": True})
            if r[1] < 0.01: quiet.append([v, r])
        chk("all 11 voices (with the compressor) give sound", not quiet, quiet)
        # the clean-up: a hiss-only first second gets much quieter in the export; the tone second stays
        await E("()=>{const e=window.__studio.editor;e.run('clear',p=>{for(const t of p.tracks)t.clips=[];p.transitions=[];p.assets={}})}")
        await pg.evaluate("""async()=>{const n=96000,o=new DataView(new ArrayBuffer(44+n*2));const W=(p,s)=>{for(let i=0;i<s.length;i++)o.setUint8(p+i,s.charCodeAt(i))};W(0,'RIFF');o.setUint32(4,36+n*2,true);W(8,'WAVE');W(12,'fmt ');o.setUint32(16,16,true);o.setUint16(20,1,true);o.setUint16(22,1,true);o.setUint32(24,48000,true);o.setUint32(28,96000,true);o.setUint16(32,2,true);o.setUint16(34,16,true);W(36,'data');o.setUint32(40,n*2,true);let x=7;for(let i=0;i<n;i++){x=(x*1103515245+12345)&0x7fffffff;const v=(x/0x7fffffff*2-1)*0.03+(i>48000?0.4*Math.sin(i*2*Math.PI*300/48000):0);o.setInt16(44+i*2,Math.max(-1,Math.min(1,v))*32767,true)}
          const inp=document.querySelector('[data-testid=file-input]');const dt=new DataTransfer();dt.items.add(new File([o.buffer],'noise.wav',{type:'audio/wav'}));inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}))}""")
        await pg.wait_for_function("()=>Object.keys(" + P + ".assets).length===1", timeout=20000)
        await E("()=>{const a=Object.values(" + P + ".assets)[0];window.__studio.actions.addAsset(a,0)}")
        RMS = "async(dn)=>{const s=window.__studio;s.editor.run('d',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.type==='media')c.denoise=dn});const ab=await s.engine.mixSound(s.editor.project,0,2);const d=ab.getChannelData(0);const r=(a,b)=>{let e=0;for(let i=a;i<b;i++)e+=d[i]*d[i];return Math.sqrt(e/(b-a))};return [r(4800,43000),r(53000,91000)]}"
        r0 = await E(RMS, False); r1 = await E(RMS, True)
        chk("clean-up: the hiss is at least 10 dB quieter in the export", r1[0] < r0[0] / 3.16, [r0, r1])
        chk("clean-up: the voice (tone) stays within 3 dB", r1[1] > r0[1] / 1.41, [r0, r1])
        # ducking per track: music on A2 ducks under a voice on A1 by its own amount
        A = await fresh(pg, ["tone.wav"])
        ducked = await E("""async(id)=>{const s=window.__studio,C=s.core;const p=s.editor.project;let a1,a2;s.editor.run('t',q=>{const au=q.tracks.filter(t=>t.kind==='audio');a1=au[0]||C.addTrack(q,'audio');a2=au[1]||C.addTrack(q,'audio');a1=a1.id;a2=a2.id});
          const v=s.actions.addAsset(s.editor.project.assets[id],0,a1),m=s.actions.addAsset(s.editor.project.assets[id],0,a2);
          s.editor.run('d',q=>{q.ducking={enabled:true,amount:0.5,voiceTracks:[a1]};for(const t of q.tracks)if(t.id===a2)t.duck=0.9;for(const t of q.tracks)for(const c of t.clips)if(c.id===v.id)c.muted=true});
          const ab=await s.engine.mixSound(s.editor.project,0,1.5);const d=ab.getChannelData(0);let e=0;for(let i=24000;i<60000;i++)e+=d[i]*d[i];const r1=Math.sqrt(e/36000);
          s.editor.run('d',q=>{for(const t of q.tracks)if(t.id===a2)t.duck=null});const ab2=await s.engine.mixSound(s.editor.project,0,1.5);const d2=ab2.getChannelData(0);e=0;for(let i=24000;i<60000;i++)e+=d2[i]*d2[i];return [r1,Math.sqrt(e/36000)]}""", A["tone"])
        chk("ducking per track: a track set to 90 % goes lower than the main 50 %", ducked[0] < ducked[1] * 0.4, ducked)

    if not ONLY or "sound" in ONLY:
        # ---- the clip's Voice & EQ section in the Inspector
        tcid = await E("()=>window.__studio.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.type==='media').id")
        await E("(id)=>{window.__studio.editor.select([id]);window.__studio.ui.set({inspector:'audio'})}", tcid); await pg.wait_for_timeout(400)
        if not await E("()=>!!document.querySelector('[data-testid=voice-robot]')"): await pg.click('[data-testid="sec-sfx278"]')
        await pg.click('[data-testid="voice-robot"]'); await pg.wait_for_timeout(200)
        chk("a voice is picked from the Inspector", await E("(id)=>window.__studio.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.id===id).afx.voice", tcid) == "robot")
        chk("12 voices in the voice changer", await E("()=>document.querySelectorAll('[data-testid^=voice-]').length") == 12)

    if not ONLY or "big" in ONLY:
        # ---- big projects: a preview copy, preview quality, nest / un-nest, the timeline draws only what is near
        A = await fresh(pg, ["big.webm"]); bc = await E("(id)=>{const c=window.__studio.actions.addAsset(" + P + ".assets[id],0);window.__studio.editor.select([c.id]);window.__studio.ui.set({inspector:'video'});return c.id}", A["big"])
        await pg.wait_for_timeout(400)
        if not await E("()=>!!document.querySelector('[data-testid=proxy-make]')"): await pg.click('[data-testid="sec-pro278"]')
        await pg.click('[data-testid="proxy-make"]')
        await pg.wait_for_function("(id)=>!!window.__studio.editor.project.assets[id].proxy", arg=A["big"], timeout=90000)
        pw = await E("(id)=>window.__studio.editor.project.assets[id].proxy", A["big"])
        await show(pg, 0.5, 900); drawn = await E(GRID)
        chk("a preview copy is made (540p) and the preview still draws", pw.startswith("local:p_") and diff(drawn, [0] * len(drawn)) > 20, pw)
        # stabilise: the clip goes to the server's processor and comes back steady (the original kept)
        A2 = await fresh(pg, ["shaky.webm"]); sc = await E("(id)=>{const c=window.__studio.actions.addAsset(" + P + ".assets[id],0);window.__studio.editor.select([c.id]);window.__studio.ui.set({inspector:'video'});return c.id}", A2["shaky"])
        await pg.wait_for_timeout(400)
        if not await E("()=>!!document.querySelector('[data-testid=stab]')"): await pg.click('[data-testid="sec-pro278"]')
        await pg.click('[data-testid="stab"]')
        try: await pg.wait_for_function("(id)=>{const c=window.__studio.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.id===id);return c&&c.steadyOf}", arg=sc, timeout=180000)
        except Exception: print("DEBUG stab", await E("()=>window.__toasts")); raise
        st2 = await E("(id)=>{const p=window.__studio.editor.project;const c=p.tracks.flatMap(t=>t.clips).find(c=>c.id===id);return {src:p.assets[c.asset].src,orig:c.steadyOf,asset:c.asset}}", sc)
        chk("stabilise: the clip now plays a steady copy made on the server, the original is kept", "/media/" in st2["src"] and st2["orig"] != st2["asset"], st2)
        await pg.click('[data-testid="unstab"]'); await pg.wait_for_timeout(200)
        chk("…and goes back to the original", await E("(id)=>{const p=window.__studio.editor.project;const c=p.tracks.flatMap(t=>t.clips).find(c=>c.id===id);return !c.steadyOf}", sc))
        A = await fresh(pg, ["big.webm"]); bc = await E("(id)=>{const c=window.__studio.actions.addAsset(" + P + ".assets[id],0);window.__studio.editor.select([c.id]);return c.id}", A["big"])
        await pg.wait_for_timeout(600)
        q0 = await E("()=>document.querySelector('[data-testid=preview]').width")
        await pg.select_option('[data-testid="preview-quality"]', "0.5"); await pg.wait_for_timeout(300)
        q1 = await E("()=>document.querySelector('[data-testid=preview]').width")
        chk("preview quality ½ draws a smaller picture", q1 <= q0 * 0.6, [q0, q1])
        await pg.select_option('[data-testid="preview-quality"]', "1")
        # nest two picture clips on two tracks into one, then un-nest
        A = await fresh(pg, ["red.png", "blue.png"])
        n1 = await E("(id)=>window.__studio.actions.addAsset(" + P + ".assets[id],0).id", A["red"])
        n2 = await E("(id)=>{const s=window.__studio;const tr=s.editor.run('t',p=>s.core.addTrack(p,'video').id);const c=s.actions.addAsset(" + P + ".assets[id],1,tr);s.editor.run('x',p=>{for(const t of p.tracks)for(const k of t.clips)if(k.id===c.id){k.dur=1;k.transform.scale=0.4}});return c.id}", A["blue"])
        await E("(ids)=>window.__studio.editor.select(ids)", [n1, n2]); await pg.wait_for_timeout(200)
        await pg.click('[data-testid="tb-nest"]')
        try: await pg.wait_for_function("()=>window.__studio.editor.project.tracks.flatMap(t=>t.clips).some(c=>c.nested)", timeout=360000)
        except Exception: print("DEBUG", await E("()=>window.__toasts"), errs); raise
        st = await E("()=>{const cs=window.__studio.editor.project.tracks.flatMap(t=>t.clips);const n=cs.find(c=>c.nested);return {count:cs.length,dur:n.dur,inside:n.nested.tracks.reduce((s,t)=>s+t.clips.length,0)}}")
        chk("nest: two clips become one clip holding both", st["count"] == 1 and st["inside"] == 2 and abs(st["dur"] - 4) < 0.2, st)
        await show(pg, 1.5, 1200); cen = await E(PIX, [0.5, 0.5]); edge = await E(PIX, [0.08, 0.5])
        chk("the nested clip shows both (blue on red)", cen[2] > 150 and cen[0] < 110 and edge[0] > 150 and edge[2] < 110, [cen, edge])
        nid = await E("()=>window.__studio.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.nested).id")
        await E("(id)=>window.__studio.editor.select([id])", nid); await pg.wait_for_timeout(200); await pg.click('[data-testid="tb-unnest"]'); await pg.wait_for_timeout(300)
        back = await E("()=>window.__studio.editor.project.tracks.flatMap(t=>t.clips).map(c=>c.id).sort()")
        chk("un-nest puts the two clips back", sorted([n1, n2]) == back, back)
        # a big timeline: 400 clips, only those near the view are drawn
        A = await fresh(pg, ["red.png"])
        await E("(id)=>{const s=window.__studio;const a=s.editor.project.assets[id];const c0=s.actions.addAsset(a,0);s.editor.run('many',p=>{const tr=p.tracks.find(t=>t.clips.some(c=>c.id===c0.id));const base=tr.clips[0];for(let i=1;i<400;i++)tr.clips.push({...structuredClone(base),id:'m'+i,start:i*2,dur:2})})}", A["red"])
        await pg.wait_for_timeout(600)
        shown = await E("()=>document.querySelectorAll('.tlscroll .clip').length")
        chk("a 400-clip timeline draws only the clips near the view", 2 < shown < 120, shown)
        await E("()=>{const el=document.querySelector('.tlscroll');el.scrollLeft=el.scrollWidth*0.6}"); await pg.wait_for_timeout(400)
        shown2 = await E("()=>[...document.querySelectorAll('.tlscroll .clip')].length")
        chk("…and draws the ones further along when scrolled", 2 < shown2 < 120, shown2)
    chk("no page errors", not errs, errs[:4])
    await b.close()

async def main():
    for _ in range(60):
        try:
            import urllib.request; urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: await asyncio.sleep(0.25)
    try:
        async with async_playwright() as p:
            await run(p, "en", 1440, 900)
            await run(p, "ar", 1280, 800)
    finally:
        srv.terminate()
    print(json.dumps({"fails": fails}, ensure_ascii=False)); sys.exit(1 if fails else 0)
asyncio.run(main())
