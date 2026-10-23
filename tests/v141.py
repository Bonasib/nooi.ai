# v141: the editor, combined (part 2) — waveforms on the timeline (clips, music, sound effects), snapping while dragging and
# trimming (magnet off → no snap), opacity and volume keyframes (preview and export), a soft edge and an oval for layers, more
# fonts, 8 shapes with fill, outline, size, rotation, opacity and words. Run: python3 tests/v141.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8392
D = tempfile.mkdtemp(prefix="nooi-v141-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "color=c=0xff0000:s=640x360", "-frames:v", "1", M + "red.png")
FF("-f", "lavfi", "-i", "color=c=0x000000:s=640x360", "-frames:v", "1", M + "black.png")
FF("-f", "lavfi", "-i", "color=c=0xffffff:s=400x400", "-frames:v", "1", M + "white.png")
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=5",
   "-filter_complex", "[1:a]volume='if(between(t,1,2)+between(t,3,3.5),0.5,0)':eval=frame[a]", "-map", "0:v", "-map", "[a]", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-c:a", "libopus", "-b:a", "128k", M + "v.webm")
FF("-f", "lavfi", "-i", "sine=frequency=220:duration=8", "-c:a", "libmp3lame", M + "music.mp3")
SETUP = """async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
 const now=Date.now(),mk=(id,kind,url,dur)=>({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url});
 S.jobs.push(mk('j_v','video','/media/v.webm',5),mk('j_red','image','/media/red.png'),mk('j_blk','image','/media/black.png'));
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];S.ed.fit='contain';S.ed.zoom=60;
 await edUseJob(S.jobs.find(j=>j.id==='j_v'),{stay:true,quiet:true,t:1});S.ed.sel=S.ed.clips[0].id;
 window.__t=[];toast=(o=>function(m){window.__t.push(String(m));return o.apply(this,arguments)})(toast);go('edit');renderAll()}"""
PIX = """(a)=>{ED.playing=false;ED.t=a[0];edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d');return Array.from(x.getImageData(Math.round(c.width*a[1]),Math.round(c.height*a[2]),1,1).data).slice(0,3)}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
near = lambda c, w, d=40: c is not None and all(abs(c[i] - w[i]) < d for i in range(3))
BARS = """(sel)=>{const p=document.querySelector(sel+' .wf141 path');if(!p)return null;const v=document.querySelector(sel+' .wf141').viewBox.baseVal.width;
  return [...p.getAttribute('d').matchAll(/M([\\d.]+) ([\\d.]+)V([\\d.]+)/g)].map(m=>[+m[1]/v,+m[3]-+m[2]])}"""

async def editor(p):
    b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1280, "height": 900})
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E(SETUP); await pg.wait_for_function("S.ed.clips.length===1&&(()=>{const m=M['c_'+S.ed.clips[0].id];return m&&m.el&&m.el.readyState>=1})()", timeout=20000)
    # ---- 1. waveforms: the clip, the music, a sound effect
    await E("async()=>{const b=await (await fetch('/media/music.mp3')).blob();loadSlot('edMusic',new File([b],'music.mp3',{type:'audio/mpeg'}));S.ed.sfx=[{id:'s1',n:'pop',t:1,vol:100}];S.ed.tab='clip';renderView()}")
    await pg.wait_for_function("document.querySelector('#tlin .blk.v .wf141')&&document.querySelector('#tlin .trk[data-trk=\"a\"] .blk.a .wf141')&&document.querySelector('#tlin .blk[data-edxsel=\"sx:s1\"] .wf141')", timeout=20000)
    bars = await E(BARS, "#tlin .blk.v")
    quiet = max([h for x, h in bars if .05 < x < .17] or [0]); loud = min([h for x, h in bars if .23 < x < .37] or [0])
    out["waveform"] = {"n": len(bars), "quiet": quiet, "loud": loud}
    chk("waveforms: the clip's sound on its block — tall where the tone plays, flat where it's silent; the music and the sound effect have theirs", len(bars) > 20 and loud > 8 and quiet < 2, out["waveform"])
    # ---- 2. snapping: a text dragged near the playhead lands on it; a clip's end trimmed near it too; magnet off → no snap
    await E("()=>{ED.t=2;S.ed.texts=[{id:'tx1',text:'HELLO',start:.5,end:1.5,pos:'center',style:'clean',anim:'none',size:6}];S.ed.tab='text';renderView()}")
    async def drag(sel, frac, dx):
        r = await E("(s)=>{const e=document.querySelector(s);e.scrollIntoView({block:'center',inline:'nearest'});const b=e.getBoundingClientRect();return[b.x,b.y,b.width,b.height]}", sel)
        x, y = r[0] + r[2] * frac, r[1] + r[3] / 2
        await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x + dx * .5, y, steps=4); await pg.mouse.move(x + dx, y, steps=4)
        mid = await E("()=>{const l=document.querySelector('#tlin .snap141'),t=document.querySelector('[data-textl=\"tx1\"]');return l?[Math.round(l.getBoundingClientRect().x),t?Math.round(t.getBoundingClientRect().x):null]:null}")
        await pg.mouse.up(); await pg.wait_for_timeout(250); return mid
    z = await E("()=>S.ed.zoom")
    line = await drag('[data-textl="tx1"]', .5, (1.95 - .5) * z)
    t1 = await E("()=>{const t=S.ed.texts[0];return[t.start,t.end]}")
    out["snap_text"] = {"t": t1, "line": line, "z": z}
    chk("snapping: a text dragged to 1.95 s lands on the playhead at 2 s (its length kept), a line shows where while dragging, at the text's snapped edge", t1 == [2, 3] and line is not None and abs(line[0] - line[1]) <= 2, out["snap_text"])
    chk("…the line goes when you let go", await E("()=>!document.querySelector('#tlin .snap141')"))
    await E("()=>{ED.t=3;S.ed.tab='clip';renderView()}")
    await drag('#tlin .blk.v[data-clip]', .995, (3.04 - 5) * z)
    o1 = await E("()=>S.ed.clips[0].out")
    out["snap_trim"] = o1
    chk("…a clip's end trimmed to 3.04 s snaps to the playhead at 3 s", abs(o1 - 3) < .011, o1)
    await E("()=>{S.ed.clips[0].out=5;S.ed.texts[0].start=.5;S.ed.texts[0].end=1.5;ED.t=2;S.ed.tab='text';renderView()}")
    await pg.click('[data-act="snap141"]'); await pg.wait_for_timeout(150)
    off = await E("()=>S.ed.snap141"); await drag('[data-textl="tx1"]', .5, (1.95 - .5) * z)
    t2 = await E("()=>S.ed.texts[0].start")
    chk("…the magnet in the toolbar turns snapping off (the text stays at 1.95 s)", off is False and abs(t2 - 1.95) < .03, [off, t2])
    await pg.click('[data-act="snap141"]'); chk("…and on again", await E("()=>S.ed.snap141!==false"))
    # ---- 3. keyframes: opacity (a fade from black) and volume (the export's sound and the preview)
    await E("()=>{S.ed.texts=[];S.ed.tab='motion';ED.t=.5;renderView()}")
    ui = await E("()=>({o:!!document.querySelector('[data-edx=\"mo.o\"]'),vk:!!document.querySelector('[data-edx=\"mo.vk\"]')})")
    await E("()=>{const s=document.querySelector('[data-edx=\"mo.vk\"]');s.value=40;s.dispatchEvent(new Event('input',{bubbles:true}))}")
    k1 = await E("()=>S.ed.clips[0].mo&&S.ed.clips[0].mo.kf.map(k=>k.vk)")
    chk("keyframes: Motion & zoom has Opacity and Volume; moving Volume keys it at the playhead", ui["o"] and ui["vk"] and k1 == [40], [ui, k1])
    mx = await E("""async()=>{const c=S.ed.clips[0];c.in=0;c.out=5;c.vol=100;S.ed.clipSound=true;M.edMusic=null;S.ed.sfx=[];S.ed.clean140=false;
      const rms=(b,t0,t1)=>{const a=b.getChannelData(0),i0=Math.round(t0*b.sampleRate),i1=Math.round(t1*b.sampleRate);let e=0;for(let i=i0;i<i1;i++)e+=a[i]*a[i];return Math.sqrt(e/(i1-i0))};
      c.mo={kf:[],ease:'linear'};const a=await mix139(5);c.mo={kf:[{t:0,s:1,x:0,y:0,r:0,vk:100},{t:1,s:1,x:0,y:0,r:0,vk:0}],ease:'linear'};const b=await mix139(5);
      ED.t=.5;edTick(performance.now());const vol=M['c_'+c.id].el.volume;return{off:[rms(a,1.2,1.8),rms(a,3.1,3.4)],on:[rms(b,1.2,1.8),rms(b,3.1,3.4)],vol}}""")
    out["volume"] = mx
    chk("…volume keys in the export: the sound fades to silence by 1 s and stays there; the preview plays it at half at 0.5 s", mx["off"][0] > .02 and mx["on"][0] < .002 and mx["on"][1] < .002 and abs(mx["vol"] - .5) < .03, mx)
    await E("async()=>{S.ed.clips=[];await edUseJob(S.jobs.find(j=>j.id==='j_red'),{stay:true,quiet:true,t:1});const c=S.ed.clips[0];c.out=3;S.ed.sel=c.id;c.mo={kf:[{t:0,s:1,x:0,y:0,r:0,o:0},{t:2,s:1,x:0,y:0,r:0,o:100}],ease:'linear'}}")
    await pg.wait_for_function("(()=>{const m=M['c_'+S.ed.clips[0].id];return m&&m.el&&m.el.complete&&m.el.naturalWidth>0})()", timeout=10000)
    op = [await E(PIX, [t, .5, .5]) for t in (.1, 1.0, 2.5)]
    out["opacity"] = op
    chk("…opacity keys: the clip fades in from black (dark at 0.1 s, half at 1 s, full red at 2.5 s)", op[0][0] < 40 and 100 < op[1][0] < 160 and near(op[2], (255, 0, 0)), op)
    # ---- 4. layers: oval + soft edge
    await E("""async()=>{const c=S.ed.clips[0];c.mo=null;S.ed.clips=[];await edUseJob(S.jobs.find(j=>j.id==='j_blk'),{stay:true,quiet:true,t:1});S.ed.clips[0].out=3;
      const b=await (await fetch('/media/white.png')).blob(),id='L1';loadSlot('ly_'+id,new File([b],'white.png',{type:'image/png'}));S.ed.layers=[{id,name:'white',start:0,end:3,x:.5,y:.5,sc:40,shape:'none'}];S.ed.selLayer=id;S.ed.tab='layers';renderView()}""")
    await pg.wait_for_function("(()=>{const m=M.ly_L1,c=M['c_'+S.ed.clips[0].id];return m&&m.el&&m.el.complete&&m.el.naturalWidth>0&&c&&c.el&&c.el.complete&&c.el.naturalWidth>0})()", timeout=10000)
    lp = await E("()=>{const W=document.getElementById('wk').width,H=document.getElementById('wk').height,dw=W*.4;return{cx:.5,cy:.5,corner:[.5-dw*.48/W,.5-dw*.48/H],edge:[.5-dw*.43/W,.5]}}")
    async def lay(shape, fe):
        await E("(a)=>{const L=S.ed.layers[0];L.shape=a[0];L.feather=a[1]}", [shape, fe])
        return {k: await E(PIX, [1, *v]) for k, v in (("center", [.5, .5]), ("corner", lp["corner"]), ("edge", lp["edge"]))}
    hard, oval, soft = await lay("none", 0), await lay("oval", 0), await lay("oval", 60)
    ui2 = await E("()=>({oval:!!document.querySelector('[data-act=\"edx-ly-shape\"][data-v=\"oval\"]'),soft:!!document.querySelector('[data-edx=\"ly.feather\"]')})")
    out["layer"] = {"hard": hard, "oval": oval, "soft": soft, "ui": ui2}
    chk("layers: Oval and Soft edge in the layer's settings", ui2["oval"] and ui2["soft"], ui2)
    chk("…full: white to the corner; oval: the corner cut away, the middle white; soft oval: the edge fades (between black and white)", near(hard["corner"], (255, 255, 255)) and near(oval["corner"], (0, 0, 0)) and near(oval["center"], (255, 255, 255)) and near(soft["center"], (255, 255, 255)) and near(oval["edge"], (255, 255, 255)) and 20 < soft["edge"][0] < 235, out["layer"])
    # ---- 5. fonts and shapes
    f = await E("()=>({n:FONTS.length,ar:FONTS.filter(f=>f[1]==='ar').length,has:['Readex Pro','Alexandria','Raleway','Bangers'].every(n=>FONTS.some(f=>f[0]===n))})")
    chk("fonts: over 100, including 36+ Arabic (Readex Pro, Alexandria …) and Latin (Raleway, Bangers …)", f["n"] >= 100 and f["ar"] >= 36 and f["has"], f)
    await E("()=>{S.ed.layers=[];S.ed.tab='info';renderView()}")
    nsh = await E("()=>document.querySelectorAll('[data-act=\"sh141-add\"]').length")
    await pg.click('[data-act="sh141-add"][data-v="star"]'); await pg.wait_for_timeout(150)
    sh = await E("()=>{const it=(S.ed.infos||[]).find(x=>x.type==='sh141');return it&&{sh:it.sh,ctl:document.querySelectorAll('[data-sh141]').length,label:document.querySelector('#tlin .blk.ix')?.textContent}}")
    await E("()=>{const it=S.ed.infos.find(x=>x.type==='sh141');it.anim='none';it.start=0;it.end=3}")
    c_star = await E(PIX, [1, .5, .5])
    draws = {}
    for k in ("rect", "circle", "triangle", "star", "arrow", "line", "bubble", "heart"):
        await E("(k)=>{const it=S.ed.infos.find(x=>x.type==='sh141');it.sh=k;it.lw=k==='line'?4:0;it.t1=k==='bubble'?'Hi!':''}", k)
        draws[k] = await E(PIX, [1, .5, .5])
    await E("()=>{const it=S.ed.infos.find(x=>x.type==='sh141');it.sh='rect';it.fill='none';it.lw=6;it.t1=''}")
    hollow = await E(PIX, [1, .5, .5])
    await E("()=>{const it=S.ed.infos.find(x=>x.type==='sh141');delete it.fill;it.op=50}")
    half = await E(PIX, [1, .5, .5])
    out["shapes"] = {"n": nsh, "item": sh, "star": c_star, "draws": draws, "hollow": hollow, "half": half}
    acc = (207, 225, 62)
    chk("shapes: 8 in the Infographics tab; a star added, with its settings (fill, outline, width, rotation, opacity …), named Shape on the timeline", nsh == 8 and sh and sh["sh"] == "star" and sh["ctl"] >= 5 and sh["label"] == "Shape", sh)
    chk("…each shape drawn in its colour over the picture's middle; unfilled shows the picture through; 50% opacity halves it", near(c_star, acc) and all(near(draws[k], acc) for k in draws) and near(hollow, (0, 0, 0)) and near(half, (104, 113, 31), 30), out["shapes"])
    chk("editor (desktop): no errors", not errs, errs)
    await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E(SETUP); await pg.wait_for_timeout(800)
    r = []
    for t in ("info", "motion", "layers", "clip"):
        await E("(t)=>{S.ed.tab=t;if(t==='info'&&!(S.ed.infos||[]).length)shAdd141('bubble');renderView()}", t); await pg.wait_for_timeout(200)
        r.append(await E("()=>({tab:S.ed.tab,over:document.documentElement.scrollWidth-innerWidth,snap:!!document.querySelector('[data-act=\"snap141\"]')})"))
    out["phone"] = r
    chk("phone: shapes, keyframes, layers — no sideways scroll; the magnet is in the toolbar", all(x["over"] <= 1 and x["snap"] for x in r), r)
    chk("phone: no errors", not errs, errs)
    await b.close()

async def main():
    async with async_playwright() as p:
        for f in (editor, phone):
            try: await f(p)
            except Exception as e: fails.append(f.__name__ + " crashed: " + repr(e)[:500])
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict({k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "LLM_"))}, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/health", timeout=2); break
        except Exception: time.sleep(.2)
    asyncio.run(main())
finally: srv.kill()
print(json.dumps({"fails": fails, "out": {k: json.dumps(v, ensure_ascii=False, default=str)[:1400] for k, v in out.items()}, "dir": D}, ensure_ascii=False, indent=1))
