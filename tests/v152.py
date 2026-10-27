# v152: what the owner asked us to take from OpenMontage (ideas only), cinetic and Cutia — in the editor:
#  - frames for the whole video (12 tiles with icons; polaroid, card, phone, old TV, film strip, neon, viewfinder, vintage, comic,
#    border, double line), a colour for some; drawn under the words; each its own picture;
#  - creative filters on the graphics card (duotones, colour pop, halftone, posterize, sketch, thermal, night vision): tiles that
#    show the clip through each, the picture really changes, an amount slider;
#  - 15 more cuts (wipes and slides in four directions, iris, bands, dot, horizon rise, polarity flip, zoom out, pixel dissolve)
#    really drawn between this clip and the next; 8 more camera moves (the clip's Motion keeps its opacity/volume keyframes);
#  - 6 title motions (scramble, mask rise, blur rise, one-word slam, slice glitch, tracking in) that end on the plain text;
#  - 12 more sounds made on the device, and the sound pass (calm · crisp · minimal) on the film's own moments, replaced when run
#    again, the user's own sounds kept, removable;
#  - the editor's agents: expert roles in the assistant (a director, story, design, editing, sound) with their own examples, and
#    the Review — a critic's read with the moment, how much it matters and one-tap fixes, "fix all" in rounds;
#  - an AI agent's review fix, sound pass and look seen live; the export has the frame, the filter and the cut.
# Phone in English and Arabic (nothing covered, no page errors), computer with an export.
# Run: python3 tests/v152.py
import asyncio, base64, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8442; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v152-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "jobs": {}}}}, open(D + "/data/db.json", "w"))
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=8", "-f", "lavfi", "-i", "sine=frequency=330:duration=8", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", D + "/media/a.webm")
# the first clip (the test pattern: a red bar on the left) and a blue picture after it, so a cut shows which clip is where
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.cloud149=false;
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.format='youtube';
 const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'beach.webm',{type:'video/webm'})]);
 await new Promise(r=>{const t=setInterval(()=>{if(S.ed.clips.length===1){clearInterval(t);r()}},50)});
 const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');x.fillStyle='#0a28f0';x.fillRect(0,0,640,360);const pb=await new Promise(r=>c.toBlob(r,'image/png'));
 edAddFiles([new File([pb],'blue.png',{type:'image/png'})]);
 S.ed.texts=[{id:'t1',text:l==='ar'?'مرحبا بكم':'HELLO',start:0,end:3,pos:'center',style:'clean',anim:'none',size:6}];S.ed.sfx=[{id:'s1',n:'pop',t:1,vol:100}];
 S.ed.tab='media';edSetPick(null);go('edit');renderAll()}"""
READY = "S.ed.clips.length===2&&document.querySelector('.ed143 #wk')&&S.ed.clips.every(c=>srcReady(clipMedia(c)))"
SCAN = open(os.path.join(ROOT, "tests/v143.py")).read().split('SCAN = r"""')[1].split('"""')[0]
# the preview at a moment: the average colour of small patches at (x, y) given as parts of the width and height
PIX = """async([t,pts])=>{ED.playing=false;ED.t=t;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,200));for(let i=0;i<2;i++)await new Promise(r=>requestAnimationFrame(r));
 const cv=document.getElementById('wk'),W=cv.width,H=cv.height,s=document.createElement('canvas');s.width=W;s.height=H;const x=s.getContext('2d');x.drawImage(cv,0,0);
 return pts.map(([px,py])=>{const d=x.getImageData(Math.max(0,Math.round(px*W)-2),Math.max(0,Math.round(py*H)-2),5,5).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}const n=d.length/4;return [Math.round(r/n),Math.round(g/n),Math.round(b/n)]})}"""
GRABF = """async(t)=>{ED.playing=false;ED.t=t;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,200));for(let i=0;i<2;i++)await new Promise(r=>requestAnimationFrame(r));
 const cv=document.getElementById('wk'),s=document.createElement('canvas');s.width=270;s.height=152;const x=s.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(cv,0,0,270,152);return [...x.getImageData(0,0,270,152).data]}"""   # (thin lines stay)
GRAB = """async(t)=>{ED.playing=false;ED.t=t;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,200));for(let i=0;i<2;i++)await new Promise(r=>requestAnimationFrame(r));
 const cv=document.getElementById('wk'),s=document.createElement('canvas');s.width=64;s.height=36;s.getContext('2d').drawImage(cv,0,0,64,36);return [...s.getContext('2d').getImageData(0,0,64,36).data]}"""
def diff(a, b): return sum(abs(a[i] - b[i]) for i in range(0, len(a)) if i % 4 != 3) / (len(a) / 4) / 3
red = lambda p: p[0] > 140 and p[1] < 110 and p[2] < 110
blue = lambda p: p[2] > 150 and p[0] < 90 and p[1] < 110
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))

async def open_page(b, w, h, lang, mob):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await pg.evaluate(SETUP, lang); await pg.wait_for_function(READY, timeout=20000); await pg.wait_for_timeout(500)
    return ctx, pg, errs
OPEN = lambda lt, tab, clip=False: "()=>{" + ("edSetPick('clip',S.ed.clips[0].id);S.ed.sel=S.ed.clips[0].id;" if clip else "") + f"S.ed.lt143='{lt}';S.ed.tab='{tab}';S.ed.pclosed143=null;renderView()" + "}"
async def scan(pg, tag, states):
    found = {}
    for name, js in states:
        await pg.evaluate(js); await pg.evaluate("()=>document.querySelectorAll('.toast').forEach(t=>t.remove())"); await pg.wait_for_timeout(300)
        H, HB = await pg.evaluate("()=>{const b=document.querySelector('.ed143 .e-sheet .e-body');return [document.getElementById('main').scrollHeight,b?b.scrollHeight:0]}"); bad, over, dup = [], 0, []
        for y in range(0, H, 450):
            for yb in range(0, max(1, HB), 260):
                await pg.evaluate("([y,yb])=>{document.getElementById('main').scrollTop=y;const b=document.querySelector('.ed143 .e-sheet .e-body');if(b)b.scrollTop=yb}", [y, yb]); await pg.wait_for_timeout(50)
                r = await pg.evaluate(SCAN); over = max(over, r["over"]); dup = r["dup"]; bad += [x for x in r["bad"] if x not in bad]
        if bad or over > 1 or dup: found[name] = {"bad": bad[:6], "over": over, "dup": dup}
    chk(f"{tag}: the new panels — nothing covered, no sideways scroll, no element id twice", not found, found)
STATES = [("frames", OPEN("effects", "fr152")), ("filters", OPEN("filters", "color", True)), ("motion", "()=>{edSetPick('clip',S.ed.clips[0].id);S.ed.tab='motion';S.ed.pclosed143=null;renderView()}"),
          ("text", "()=>{edSetPick('text','t1');S.ed.selText='t1';S.ed.lt143='text';S.ed.tab='text';S.ed.pclosed143=null;renderView()}"), ("sounds", OPEN("audio", "sfx")),
          ("transitions", OPEN("trans", "trans143", True)), ("review", OPEN("ai", "rv152")), ("assistant", OPEN("ai", "chat143"))]

async def phone(b, lang):
    tag = f"phone {lang}"; ctx, pg, errs = await open_page(b, 390, 844, lang, True); E = pg.evaluate; ar = lang == "ar"
    T0 = await E("()=>clipDur(S.ed.clips[0])")
    # ---- 1. frames
    await E(OPEN("effects", "fr152")); await pg.wait_for_timeout(300)
    f = await E("""()=>{const bs=[...document.querySelectorAll('#main .ed143 [data-act="fr152"]')];return {n:bs.length,ic:bs.filter(b=>b.querySelector('.ic151 svg')).length,uniq:new Set(bs.map(b=>b.querySelector('.ic151').innerHTML)).size,
      names:bs.map(b=>b.querySelector('.lb').textContent),on:bs.filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.v),tab:(N143.fr152||[])[0]}}""")
    out[tag + "_frames"] = f
    chk(f"{tag}: Effects → Frames — 12 frame tiles, each its own drawn icon and name; none chosen at first", f["n"] == 12 and f["ic"] == 12 and f["uniq"] == 12 and f["on"] == ["none"] and (("نيون" in f["names"]) if ar else ("Neon" in f["names"] and "Polaroid" in f["names"])), f)
    base = await E(GRABF, 1.0); pics = {}
    for fid in ["polaroid", "card", "phone", "tv", "film", "neon", "finder", "vintage", "comic", "border", "double"]:
        await E(f"()=>document.querySelector('#main [data-act=\"fr152\"][data-v=\"{fid}\"]').click()"); await pg.wait_for_timeout(120); pics[fid] = await E(GRABF, 1.0)
    dd = {k: round(diff(v, base), 1) for k, v in pics.items()}; ks = list(pics); pair = min(round(diff(pics[a], pics[c]), 1) for i, a in enumerate(ks) for c in ks[i + 1:])
    out[tag + "_frame_diff"] = {"vs_none": dd, "closest_pair": pair}
    chk(f"{tag}: every frame changes the picture, each its own way", all(v > .5 for v in dd.values()) and pair > .3, out[tag + "_frame_diff"])
    sw = await E("""async()=>{document.querySelector('#main [data-act="fr152"][data-v="border"]').click();await new Promise(r=>setTimeout(r,150));const n=document.querySelectorAll('#main .fr152c .sw152').length;document.querySelector('#main .fr152c [data-v="#ff4fa3"]').click();await new Promise(r=>setTimeout(r,150));return {n,fr:S.ed.fr152}}""")
    px = await E(PIX, [1.0, [[.5, .012], [.5, .5]]]); out[tag + "_border"] = {"sw": sw, "px": px}
    chk(f"{tag}: the border in the colour picked (6 swatches) — the edge pink, the middle still the video", sw["n"] == 6 and sw["fr"] == {"id": "border", "col": "#ff4fa3"} and abs(px[0][0] - 255) < 20 and abs(px[0][1] - 79) < 25 and abs(px[0][2] - 163) < 25 and not (px[1][0] > 230 and px[1][1] < 100), out[tag + "_border"])
    # drawn under the words: when the frame is drawn, no text of this picture is drawn yet; after it, the text is
    od = await E("""async()=>{const of=frame152;let at=[];frame152=function(){at.push((ED.hit||[]).filter(x=>x.k==='text').length);return of.apply(this,arguments)};ED.playing=false;ED.t=1;
      for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));frame152=of;return {at,after:(ED.hit||[]).filter(x=>x.k==='text').length}}""")
    chk(f"{tag}: the frame is drawn under the words (the title stays on top)", od["at"] and all(x == 0 for x in od["at"]) and od["after"] >= 1, od)
    await E("()=>{document.querySelector('#main [data-act=\"fr152\"][data-v=\"none\"]').click()}"); await pg.wait_for_timeout(150)
    # ---- 2. creative filters
    await E(OPEN("filters", "color", True)); await pg.wait_for_timeout(900)
    fl = await E("""()=>{const bs=[...document.querySelectorAll('#main .ed143 [data-act="f152"]')];const lit=b=>{const c=b.querySelector('canvas.lk152');if(!c)return 0;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return s/(d.length/4)/3};
      const sig=b=>{const c=b.querySelector('canvas.lk152');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let r=0,g=0,bl=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];bl+=d[i+2]}return [r,g,bl].map(x=>Math.round(x/(d.length/4)/4)).join()};
      return {n:bs.length,lit:bs.filter(b=>lit(b)>8).length,uniq:new Set(bs.map(sig)).size,tips:bs.filter(b=>b.dataset.v==='none'||b.title).length}}""")
    out[tag + "_filters"] = fl
    chk(f"{tag}: Filters — 14 creative filter tiles (none + 13), each showing the clip through it, each different, what each does", fl["n"] == 14 and fl["lit"] == 14 and fl["uniq"] >= 13 and fl["tips"] == 14, fl)
    p0 = await E(PIX, [1.0, [[.04, .5], [.2, .5]]])
    await E("()=>document.querySelector('#main [data-act=\"f152\"][data-v=\"duo_night\"]').click()"); await pg.wait_for_timeout(200)
    p1 = await E(PIX, [1.0, [[.04, .5]]])
    sl = await E("()=>{const i=document.querySelector('#main input[data-edx=\"f152a\"]');if(!i)return null;i.value=0;i.dispatchEvent(new Event('input',{bubbles:true}));return S.ed.clips[0].f152a}")
    p2 = await E(PIX, [1.0, [[.04, .5]]])
    await E("()=>{const i=document.querySelector('#main input[data-edx=\"f152a\"]');i.value=100;i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#main [data-act=\"f152\"][data-v=\"pop_red\"]').click()}"); await pg.wait_for_timeout(200)
    p3 = await E(PIX, [1.0, [[.04, .5], [.2, .5]]]); out[tag + "_filter_px"] = {"none": p0, "night": p1, "amount0": p2, "slider": sl, "pop_red": p3}
    chk(f"{tag}: a night duotone turns the red bar navy/cyan; the amount at 0 gives the red back", red(p0[0]) and p1[0][2] > p1[0][0] + 20 and sl == 0 and red(p2[0]), out[tag + "_filter_px"])
    chk(f"{tag}: colour pop red keeps the reds and greys the rest", red(p3[0]) and abs(p3[1][0] - p3[1][1]) < 30 and abs(p3[1][1] - p3[1][2]) < 30 and not (abs(p0[1][0] - p0[1][1]) < 30 and abs(p0[1][1] - p0[1][2]) < 30), out[tag + "_filter_px"])
    await E("()=>document.querySelector('#main [data-act=\"f152\"][data-v=\"none\"]').click()"); await pg.wait_for_timeout(150)
    # ---- 3. the new cuts, drawn between the test pattern and the blue picture
    await E(OPEN("trans", "trans143", True)); await pg.wait_for_timeout(300)
    tt = await E("""()=>{const ids=['wipe_l','wipe_r','wipe_u','wipe_d','slide_l','slide_r','slide_u','slide_d','iris','bands','dot','rise','flip','zoomout','dissolve'];const bs=ids.map(v=>document.querySelector('#main [data-set="edclip.trans"][data-val="'+v+'"]'));
      return {n:bs.filter(Boolean).length,ic:bs.filter(b=>b&&b.querySelector('svg')).length,tip:bs.filter(b=>b&&b.title).length}}""")
    chk(f"{tag}: Transitions — 15 more tiles with their own icons and what each does", tt["n"] == 15 and tt["ic"] == 15 and tt["tip"] == 15, tt)
    cuts = {}
    for tr, t, pts in (("iris", -.5, [[.5, .5], [.04, .5]]), ("wipe_l", -.5, [[.92, .5], [.04, .5]]), ("slide_r", -.5, [[.1, .5], [.53, .5]]), ("dot", -.75, [[.03, .05], [.5, .5]])):
        await E(f"()=>{{const c=S.ed.clips[0];c.trans='{tr}';c.trd=1;renderView()}}")
        cuts[tr] = await E(PIX, [T0 + t, pts])
    dv = await E("""async(T0)=>{const c=S.ed.clips[0];c.trans='dissolve';c.trd=1;ED.playing=false;ED.t=T0-.5;for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,200));await new Promise(r=>requestAnimationFrame(r));
      const cv=document.getElementById('wk'),x=cv.getContext('2d');let bl=0,n=0;for(let i=1;i<10;i++)for(let j=1;j<10;j++){const d=x.getImageData(Math.round(cv.width*i/10),Math.round(cv.height*j/10),1,1).data;n++;if(d[2]>150&&d[0]<90)bl++}return bl/n}""", T0)
    cuts["dissolve"] = dv; out[tag + "_cuts"] = cuts
    chk(f"{tag}: iris — the blue clip in a circle in the middle, the first clip outside it", blue(cuts["iris"][0]) and red(cuts["iris"][1]), cuts["iris"])
    chk(f"{tag}: wipe left — the next clip on the right half, this one still on the left", blue(cuts["wipe_l"][0]) and red(cuts["wipe_l"][1]), cuts["wipe_l"])
    chk(f"{tag}: slide right — both move: the next clip comes in on the left, this one's red edge pushed to the middle", blue(cuts["slide_r"][0]) and red(cuts["slide_r"][1]), cuts["slide_r"])
    chk(f"{tag}: collapse to a dot — black corners while the picture shrinks", all(x < 40 for x in cuts["dot"][0]) and max(cuts["dot"][1]) > 60, cuts["dot"])
    chk(f"{tag}: pixel dissolve — about half the blocks are the next clip halfway", .2 < dv < .8, dv)
    await E("()=>{S.ed.clips[0].trans='cut';renderView()}")
    # ---- 4. camera moves
    await E("()=>{edSetPick('clip',S.ed.clips[0].id);S.ed.tab='motion';S.ed.pclosed143=null;ED.t=1;renderView()}"); await pg.wait_for_timeout(400)
    cm = await E("""async()=>{const ids=['breathe','pullback','pushroll','kick','drift','crane','handheld','whipin'];const all=[...document.querySelectorAll('#main [data-act="edx-zoom"]')].map(b=>b.dataset.v);
      const ic=ids.filter(v=>{const b=document.querySelector('#main [data-act="edx-zoom"][data-v="'+v+'"]');return b&&b.querySelector('svg')}).length;
      const kfTxt=document.querySelector('#main .ed143').textContent.includes(L('Opacity and volume are keyframed','الشفافية'))||!!document.querySelector('#main [data-edx="mo.op"],#main [data-edx^="op"]');
      document.querySelector('#main [data-act="edx-zoom"][data-v="pullback"]').click();await new Promise(r=>setTimeout(r,150));const mo=JSON.parse(JSON.stringify(S.ed.clips[0].mo));
      document.querySelector('#main [data-act="edx-zoom"][data-v="handheld"]').click();await new Promise(r=>setTimeout(r,150));const hh=S.ed.clips[0].mo.kf.length;
      return {n:ids.filter(v=>all.includes(v)).length,before:all.indexOf('whipin')<all.indexOf('reset'),ic,kfTxt,pull:[mo.kf[0].s,mo.ease,mo.anim],hh}}""")
    out[tag + "_camera"] = cm
    chk(f"{tag}: Motion — 8 more camera moves with icons before Reset; pull-back starts close and eases out; handheld shakes in many steps", cm["n"] == 8 and cm["before"] and cm["ic"] == 8 and cm["pull"] == [1.6, "out", True] and cm["hh"] >= 10, cm)
    chk(f"{tag}: the clip's Motion keeps its opacity and volume keyframes (v141)", cm["kfTxt"], cm)
    await E("()=>{S.ed.clips[0].mo=null;renderView()}")
    # ---- 5. title motions: drawn on their own and ending on the plain text
    await E("()=>{edSetPick('text','t1');S.ed.selText='t1';S.ed.lt143='text';S.ed.tab='text';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(300)
    tm = await E("""async()=>{const bs=[...document.querySelectorAll('#main .tm152 [data-act="tm152"]')],after=!!document.querySelector('#main .tiles.ac131+.lbl+.tiles.tm152, #main .tiles.ac131 ~ .tiles.tm152');
      bs.find(b=>b.dataset.v==='scramble').click();await new Promise(r=>setTimeout(r,150));const an=S.ed.texts[0].anim;
      const tx=Object.assign({},S.ed.texts[0],{text:'NOOI MAKES IT MOVE',size:9}),cv=document.createElement('canvas');cv.width=640;cv.height=360;const x=cv.getContext('2d');
      const shot=(anim,t)=>{x.clearRect(0,0,640,360);x.fillStyle='#000';x.fillRect(0,0,640,360);drawTextLayer(x,Object.assign({},tx,{anim}),640,360,t);const d=x.getImageData(0,0,640,360).data;let s=0,h=0;for(let i=0;i<d.length;i+=16){s+=d[i];h=(h*31+d[i])%1000003}return {s,h}};
      const plain=shot('none',2),res={};for(const m of ['scramble','maskrise','blurrise','slam','slice','tracking']){const a=shot('t152_'+m,.15),z=shot('t152_'+m,2);res[m]=[a.h!==plain.h,z.h===plain.h,Math.round(a.s/Math.max(1,plain.s)*100)]}
      return {n:bs.length,ic:bs.filter(b=>b.querySelector('svg')).length,after,an,res}}""")
    out[tag + "_titles"] = tm
    chk(f"{tag}: Text → 8 title motions (6 + v153's 2) with icons, after the Animate.css ones; tapping one sets it", tm["n"] == 8 and tm["ic"] == 8 and tm["after"] and tm["an"] == "t152_scramble", tm)
    chk(f"{tag}: each title motion draws its own picture at the start and ends on the plain text", all(v[0] and v[1] for v in tm["res"].values()), tm["res"])
    await E("()=>{S.ed.texts[0].anim='none';renderView()}")
    # ---- 6. sounds and the sound pass
    await E(OPEN("audio", "sfx")); await pg.wait_for_timeout(300)
    sd = await E("""async()=>{const ids=['tick','tock','pluck','bell','thump','snap','key','swell','subdrop','sparkle','zip','paper'],r={};for(const n of ids){const b=await edxSynth(n==='pluck'?'pluck:3':n);const d=b.getChannelData(0);let s=0,p=0;for(let i=0;i<d.length;i++){s+=d[i]*d[i];p=Math.max(p,Math.abs(d[i]))}r[n]=[+b.duration.toFixed(2),+Math.sqrt(s/d.length).toFixed(4),+p.toFixed(2)]}
      return {n:document.querySelectorAll('#main [data-act="edx-sfx-add"]').length,r,name:edxSfxName({n:'pluck:3'}),pass:document.querySelectorAll('#main .sp152 [data-act="sp152"]').length}}""")
    out[tag + "_sounds"] = sd
    chk(f"{tag}: 30 sounds; the 12 new ones made on the device, each heard (not silent, not clipping); a tuned pluck is called Pluck", sd["n"] == 30 and all(v[1] > .004 and v[2] <= 1.05 and v[0] > .05 for v in sd["r"].values()) and sd["name"] == ("نقرة وتر" if ar else "Pluck") and sd["pass"] == 3, sd)
    sp = await E("""async()=>{const T0=clipDur(S.ed.clips[0]);document.querySelector('#main [data-act="sp152"][data-v="crisp"]').click();await new Promise(r=>setTimeout(r,900));const a=S.ed.sfx.map(x=>[x.n,x.t,x.sp152||'']);
      document.querySelector('#main [data-act="sp152"][data-v="calm"]').click();await new Promise(r=>setTimeout(r,900));const b=S.ed.sfx.map(x=>[x.n,x.t,x.sp152||'']);const rm=!!document.querySelector('#main [data-act="sp152-clear"]');
      document.querySelector('#main [data-act="sp152-clear"]').click();await new Promise(r=>setTimeout(r,200));return {T0,a,b,rm,c:S.ed.sfx.map(x=>x.n)}}""")
    out[tag + "_pass"] = sp
    T0 = sp["T0"]
    chk(f"{tag}: the crisp pass — a whoosh just before the cut, a tick as the title appears; the user's pop kept", ["whoosh", round(T0 - .28, 2), "crisp"] in sp["a"] and ["tick", 0, "crisp"] in sp["a"] and ["pop", 1, ""] in sp["a"], sp)
    chk(f"{tag}: the calm pass replaces it (an air swell at the cut, a pluck on the title); remove takes only the pass's sounds", not any(x[2] == "crisp" for x in sp["b"]) and any(x[0] == "swell" for x in sp["b"]) and any(x[0] == "pluck:0" for x in sp["b"]) and sp["rm"] and sp["c"] == ["pop"], sp)
    # ---- 7. the review
    await E(OPEN("ai", "rv152")); await pg.wait_for_timeout(300)
    rv = await E("""async()=>{const roles=[...document.querySelectorAll('#main .rl152g [data-act="rl152"]')].map(b=>b.dataset.v);document.querySelector('#main [data-act="rv152-go"]').click();
      for(let i=0;i<40&&!document.querySelector('#main .rv152i');i++)await new Promise(r=>setTimeout(r,50));const items=[...document.querySelectorAll('#main .rv152i')];
      return {roles,ids:ST152.rv.issues.map(x=>x.id),score:ST152.rv.score,ship:ST152.rv.ship,ring:(document.querySelector('#main .rv152s')||{}).textContent,n:items.length,sev:items.map(b=>b.dataset.sev),
        words:items.map(b=>b.querySelector('p').textContent),seek:items.filter(b=>b.querySelector('[data-act="rv152-seek"]')).length,fix:items.filter(b=>b.querySelector('[data-act="rv152-fix"]')).length,all:!!document.querySelector('#main [data-act="rv152-all"]')}}""")
    out[tag + "_review"] = rv
    chk(f"{tag}: AI → Review — five experts; the review finds no last line, the still 8 s clip, no music — each with its moment, its weight and a fix", rv["roles"] == ["director", "story", "design", "editing", "audio"] and set(rv["ids"]) >= {"end", "no_music"} and any(x.startswith("long_hold:") for x in rv["ids"]) and rv["n"] == len(rv["ids"]) and rv["seek"] == rv["n"] and rv["fix"] == rv["n"] and rv["all"] and rv["ring"] == str(rv["score"]), rv)
    chk(f"{tag}: the review speaks the page's language", all((any("؀" <= ch <= "ۿ" for ch in w) if ar else not any("؀" <= ch <= "ۿ" for ch in w)) for w in rv["words"]), rv["words"])
    fx = await E("""async()=>{const b=document.querySelector('#main [data-act="rv152-seek"]');const t=+b.dataset.v;b.click();await new Promise(r=>setTimeout(r,100));const at=ED.t;
      document.querySelector('#main .rv152i [data-act="rv152-fix"][data-v="end"]').click();await new Promise(r=>setTimeout(r,500));const end=S.ed.texts.find(x=>x.start>=edTotal()-3);const s1=ST152.rv.score;
      document.querySelector('#main .rv152i [data-act="rv152-fix"][data-v^="long_hold:"]').click();await new Promise(r=>setTimeout(r,500));
      return {t,at,end:end&&[end.text,end.start],s1,s2:ST152.rv.score,left:ST152.rv.issues.map(x=>x.id),mo:!!(S.ed.clips[0].mo&&S.ed.clips[0].mo.kf.length===2)}}""")
    out[tag + "_fix"] = fx
    chk(f"{tag}: the moment button moves the playhead; a fix adds the last line, another the slow zoom — only music is left", abs(fx["at"] - fx["t"]) < .02 and fx["end"] and fx["end"][0] == ("تابعنا للمزيد" if ar else "Follow for more") and fx["s2"] > fx["s1"] and fx["mo"] and fx["left"] == ["no_music"], fx)
    ds = await E("""async()=>{S.ed.texts.push({id:'t9',text:'one two three four five six seven eight nine',start:4,end:4.4,pos:'top',style:'clean',anim:'none',size:6},{id:'t10',text:'short line here now',start:6,end:6.3,pos:'top',style:'clean',anim:'none',size:6});
      document.querySelector('#main [data-act="rl152"][data-v="design"]').click();await new Promise(r=>setTimeout(r,500));const items=[...document.querySelectorAll('#main .rv152i [data-act="rv152-fix"]')].map(b=>b.dataset.v);
      document.querySelector('#main [data-act="rv152-all"]').click();await new Promise(r=>setTimeout(r,1200));const t9=S.ed.texts.find(x=>x.id==='t9'),t10=S.ed.texts.find(x=>x.id==='t10');
      const res={role:S.ed.role152,items,after:ST152.rv.issues.filter(x=>x.lens==='design').map(x=>x.id),t9:[t9.end],t10:[t10.end,t10.pos]};histGo(-1);const u9=S.ed.texts.find(x=>x.id==='t9'),u10=S.ed.texts.find(x=>x.id==='t10');res.undo=[u9.end,u10.pos];return res}""")
    out[tag + "_design"] = ds
    chk(f"{tag}: the design expert sees only its own: two lines too fast to read", ds["role"] == "design" and ds["items"] == ["text_fast:t9", "text_fast:t10"], ds)
    chk(f"{tag}: Fix all works in rounds — time to read both, then the second (now on top of the first) moved down; one undo step", ds["after"] == [] and ds["t9"][0] > 7 and ds["t10"][1] == "bottom" and ds["undo"] == [4.4, "top"], ds)
    # ---- 8. the assistant's experts
    await E(OPEN("ai", "chat143")); await pg.wait_for_timeout(300)
    asx = await E("""async()=>{const ch=[...document.querySelectorAll('#main .rl152a [data-act="rl152"]')];const on=ch.filter(b=>b.getAttribute('aria-checked')==='true').map(b=>b.dataset.v);
      document.querySelector('#main .rl152a [data-v="audio"]').click();await new Promise(r=>setTimeout(r,500));const ex=[...document.querySelectorAll('#main .rx152 [data-act="edcmd-ex"]')].map(b=>b.dataset.v);
      document.querySelector('#main [data-act="rv152-open"]').click();await new Promise(r=>setTimeout(r,600));return {n:ch.length,on,ex,tab:S.ed.tab,items:document.querySelectorAll('#main .rv152i').length,all:ST152.rv.issues.every(x=>x.lens==='audio')}}""")
    out[tag + "_assistant"] = asx
    chk(f"{tag}: the assistant — five expert chips (design chosen), the sound expert's own examples; Review as … opens the review with its findings", asx["n"] == 5 and asx["on"] == ["design"] and len(asx["ex"]) == 2 and asx["tab"] == "rv152" and asx["items"] >= 1, asx)
    # ---- 9. an AI agent's changes, seen live
    ag = await E("""async()=>{op148({op:'style_set',args:{frame:'tv',transition:'iris'}});op148({op:'sound_pass',args:{preset:'calm',sfx:[{id:'zz1',n:'bell',t:2,vol:70,sp152:'calm'}]}});
      op148({op:'review_fix',args:{fixes:[{op:'text_add',args:{id:'ag1',text:'From the agent',start:0,end:2}}]}});return {fr:S.ed.fr152.id,tr:S.ed.clips[0].trans,bell:S.ed.sfx.some(x=>x.id==='zz1'),tx:S.ed.texts.some(x=>x.id==='ag1')}}""")
    chk(f"{tag}: an AI agent's look, sound pass and review fix arrive in the open editor", ag == {"fr": "tv", "tr": "iris", "bell": True, "tx": True}, ag)
    await E("()=>{S.ed.fr152={id:'none'};renderView()}")
    await scan(pg, tag, STATES)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await ctx.close()

async def desktop(b):
    ctx, pg, errs = await open_page(b, 1440, 900, "en", False); E = pg.evaluate
    r = await E("""async()=>{S.ed.lt143='effects';S.ed.tab='fr152';renderView();await new Promise(r=>setTimeout(r,200));const inLeft=!!document.querySelector('#main .e-assets [data-act="fr152"]');
      S.ed.lt143='ai';S.ed.tab='rv152';renderView();await new Promise(r=>setTimeout(r,200));return {inLeft,rv:!!document.querySelector('#main .e-assets [data-act="rv152-go"]'),sub:[...document.querySelectorAll('#main .e-assets .e-sub [role=tab]')].map(b=>b.dataset.v)}}""")
    chk("computer: Frames and Review in the left panel's tabs", r["inLeft"] and r["rv"] and "rv152" in r["sub"], r)
    # the export has the frame, the filter and the cut: 2 s of the pattern (night duotone) → iris → the blue picture, a pink border
    await E("()=>{const c=S.ed.clips[0];c.out=2;c.trans='iris';c.trd=1;c.f152='duo_night';c.f152a=100;S.ed.fr152={id:'border',col:'#ff4fa3'};S.ed.texts=[];S.ed.sfx=[];renderView()}")
    ex = await E("""async()=>{const T=edTotal();const r=await edRender139(T);if(!r)return null;const b=new Uint8Array(await r.blob.arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return {mime:r.mime,data:btoa(s),T}}""")
    if ex:
        fx = D + "/v152." + ("mp4" if "mp4" in ex["mime"] else "webm"); open(fx, "wb").write(base64.b64decode(ex["data"]))
        def at(t):
            px = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", fx, "-frames:v", "1", "-vf", "scale=100:56", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
            P = lambda x, y: list(px[(y * 100 + x) * 3:(y * 100 + x) * 3 + 3]) if len(px) >= 100 * 56 * 3 else [0, 0, 0]
            return {"edge": P(50, 0), "left": P(4, 28), "mid": P(50, 28)}
        a, c = at(0.6), at(1.55); out["export"] = {"0.6": a, "1.55": c, "T": ex["T"]}
        chk("export: the pink border, the night duotone (the red bar navy/cyan) at 0.6 s", a["edge"][0] > 200 and a["edge"][1] < 150 and a["left"][2] > a["left"][0] + 20, out["export"])
        chk("export: at 1.55 s the iris is half open — the blue picture in the middle, the first clip at the edge", c["mid"][2] > 150 and c["mid"][0] < 100 and not (c["left"][2] > 150 and c["left"][0] < 100), out["export"])
    else: chk("export ran (frame by frame)", False, ex)
    chk("computer: no page errors", not errs, errs[:3]); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        await phone(b, "en"); await phone(b, "ar"); await desktop(b)
        await b.close()
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(os.environ, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(.25)
    t0 = time.time(); asyncio.run(main()); out["seconds"] = round(time.time() - t0)
finally: srv.kill()
print(json.dumps(out, ensure_ascii=False, default=str)[:6000])
print("\n".join("FAIL " + f for f in fails) or "all checks passed")
print("PASS" if not fails else f"FAILED {len(fails)}")
