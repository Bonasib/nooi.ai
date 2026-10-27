# v153: what was still missing from OpenMontage (ideas only) and cinetic after v152 — in the editor:
#  - style kits (Effects → Style kits): 8 tiles drawn from the clip itself in each kit's colour and frame; one tap sets the cuts,
#    the filter or colour, the frame, how titles move and a sound pass; undo brings everything back (the frame too);
#  - two title motions (letter roll, typing with a cursor) and three cuts (shutter, split open, whip blur) really drawn;
#  - the sound pass: keys under typed titles, a riser before the big cut;
#  - a clip split at its scene changes on the device (a real 3-scene video → three clips at 3 s and 6 s, each playing; undo);
#  - the review's new checks: a slideshow-like edit, too many words, a text under a phone app's buttons, a stock phrase (its
#    "Rewrite it" opens that text), fixed in rounds;
#  - an AI agent's style kit and scene split arrive live; the export has the kit's frame and filter.
# Phone in English and Arabic (nothing covered, no page errors), computer with an export.
# Run: python3 tests/v153.py
import asyncio, base64, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8444; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v153-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "jobs": {}}}}, open(D + "/data/db.json", "w"))
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=8", "-f", "lavfi", "-i", "sine=frequency=330:duration=8", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", D + "/media/a.webm")
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=3", "-f", "lavfi", "-i", "smptebars=size=640x360:rate=25:duration=3", "-f", "lavfi", "-t", "3", "-i", "mandelbrot=size=640x360:rate=25",
   "-filter_complex", "[0][1][2]concat=n=3:v=1:a=0", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "800k", D + "/media/scenes.webm")
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.cloud149=false;
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.format='youtube';
 const wait=n=>new Promise(r=>{const t=setInterval(()=>{if(S.ed.clips.length===n){clearInterval(t);r()}},50)});
 const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'beach.webm',{type:'video/webm'})]);await wait(1);
 const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');x.fillStyle='#0a28f0';x.fillRect(0,0,640,360);const pb=await new Promise(r=>c.toBlob(r,'image/png'));
 edAddFiles([new File([pb],'blue.png',{type:'image/png'})]);await wait(2);
 const sc=await (await fetch('/media/scenes.webm')).blob();edAddFiles([new File([sc],'scenes.webm',{type:'video/webm'})]);await wait(3);
 S.ed.texts=[{id:'t1',text:l==='ar'?'مرحبا بكم في المتجر':'HELLO THERE FRIENDS',start:0,end:3,pos:'center',style:'clean',anim:'none',size:6}];S.ed.sfx=[{id:'s1',n:'pop',t:1,vol:100}];
 S.ed.tab='media';edSetPick(null);go('edit');renderAll()}"""
READY = "S.ed.clips.length===3&&document.querySelector('.ed143 #wk')&&S.ed.clips.every(c=>srcReady(clipMedia(c)))"
SCAN = open(os.path.join(ROOT, "tests/v143.py")).read().split('SCAN = r"""')[1].split('"""')[0]
PIX = """async([t,pts])=>{ED.playing=false;ED.t=t;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,200));for(let i=0;i<2;i++)await new Promise(r=>requestAnimationFrame(r));
 const cv=document.getElementById('wk'),W=cv.width,H=cv.height,s=document.createElement('canvas');s.width=W;s.height=H;const x=s.getContext('2d');x.drawImage(cv,0,0);
 return pts.map(([px,py])=>{const d=x.getImageData(Math.max(0,Math.round(px*W)-2),Math.max(0,Math.round(py*H)-2),5,5).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}const n=d.length/4;return [Math.round(r/n),Math.round(g/n),Math.round(b/n)]})}"""
red = lambda p: p[0] > 140 and p[1] < 110 and p[2] < 110
blue = lambda p: p[2] > 150 and p[0] < 90 and p[1] < 110
black = lambda p: max(p) < 35
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))

async def open_page(b, w, h, lang, mob):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await pg.evaluate(SETUP, lang); await pg.wait_for_function(READY, timeout=25000); await pg.wait_for_timeout(500)
    return ctx, pg, errs
OPEN = lambda lt, tab, clip=None: "()=>{" + (f"edSetPick('clip',S.ed.clips[{clip}].id);S.ed.sel=S.ed.clips[{clip}].id;" if clip is not None else "") + f"S.ed.lt143='{lt}';S.ed.tab='{tab}';S.ed.pclosed143=null;renderView()" + "}"
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
STATES = [("kits", OPEN("effects", "kit153")), ("clip edit", "()=>{edSetPick('clip',S.ed.clips[2].id);S.ed.sel=S.ed.clips[2].id;S.ed.tab='clip';S.ed.pclosed143=null;renderView()}"),
          ("text", "()=>{edSetPick('text','t1');S.ed.selText='t1';S.ed.lt143='text';S.ed.tab='text';S.ed.pclosed143=null;renderView()}"), ("transitions", OPEN("trans", "trans143", 0)), ("review", OPEN("ai", "rv152"))]

async def phone(b, lang):
    tag = f"phone {lang}"; ctx, pg, errs = await open_page(b, 390, 844, lang, True); E = pg.evaluate; ar = lang == "ar"
    # ---- 1. style kits
    await E(OPEN("effects", "kit153")); await pg.wait_for_timeout(900)
    k = await E("""()=>{const bs=[...document.querySelectorAll('#main [data-act="kit153"]')];const sig=b=>{const c=b.querySelector('canvas.kt153');if(!c)return '';const d=c.getContext('2d').getImageData(0,0,96,60).data;let h=0;for(let i=0;i<d.length;i+=4)h=(h*31+(d[i]>>3)*1024+(d[i+1]>>3)*32+(d[i+2]>>3))%1000000007;return h};
      return {n:bs.length,drawn:bs.filter(b=>b.querySelector('canvas.kt153[data-done]')).length,uniq:new Set(bs.map(sig)).size,tips:bs.filter(b=>b.title).length,names:bs.map(b=>b.querySelector('.lb').textContent),tab:N143.kit153}}""")
    out[tag + "_kits"] = k
    chk(f"{tag}: Effects → Style kits — 8 kits, each tile the clip itself in that kit's look, each different, what each does", k["n"] == 8 and k["drawn"] == 8 and k["uniq"] == 8 and k["tips"] == 8 and (("ليل النيون" in k["names"]) if ar else ("Neon night" in k["names"] and "Cinematic" in k["names"])), k)
    p0 = await E(PIX, [1.0, [[.04, .5]]])
    a = await E("""async()=>{document.querySelector('#main [data-act="kit153"][data-v="neon"]').click();await new Promise(r=>setTimeout(r,700));const E=S.ed,c=E.clips;
      return {trans:c.map(x=>x.trans),f:c.map(x=>x.f152||''),fr:E.fr152,anim:E.texts[0].anim,sp:E.sfx.filter(x=>x.sp152).map(x=>x.n),own:E.sfx.some(x=>x.id==='s1'),kit:E.kit153,on:document.querySelector('#main [data-act="kit153"][aria-pressed="true"]')?.dataset.v}}""")
    p1 = await E(PIX, [1.0, [[.04, .5], [.5, .015]]]); out[tag + "_kit"] = {"a": a, "p0": p0, "p1": p1}
    chk(f"{tag}: one tap on Neon night — iris cuts, a night duotone on every clip, a pink neon frame, glitch titles, crisp sounds (yours kept)", a["trans"][:2] == ["iris", "iris"] and a["f"] == ["duo_night"] * 3 and a["fr"] == {"id": "neon", "col": "#ff4fa3"} and a["anim"] == "t152_slice" and "whoosh" in a["sp"] and a["own"] and a["kit"] == a["on"] == "neon", a)
    chk(f"{tag}: …and the preview shows it: the red bar turned toward navy (the kit's duotone at 70 %)", red(p0[0]) and p1[0][0] < 160 and p1[0][2] > p0[0][2] + 50, out[tag + "_kit"])
    u = await E("""async()=>{histGo(-1);await new Promise(r=>setTimeout(r,300));const E=S.ed;return {trans:E.clips.map(x=>x.trans),f:E.clips.map(x=>x.f152||''),fr:E.fr152||null,anim:E.texts[0].anim,sp:E.sfx.filter(x=>x.sp152).length,kit:E.kit153||null}}""")
    chk(f"{tag}: undo brings it all back (the frame too)", u["trans"][0] == "cut" and u["f"] == ["", "", ""] and (u["fr"] is None or u["fr"].get("id") in (None, "none")) and u["anim"] == "none" and u["sp"] == 0 and u["kit"] is None, u)
    # ---- 2. letter roll, typing cursor; shutter, split, whip blur
    await E("()=>{edSetPick('text','t1');S.ed.selText='t1';S.ed.lt143='text';S.ed.tab='text';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(300)
    tm = await E("""()=>{const ids=[...document.querySelectorAll('#main .tm152 [data-act="tm152"]')].map(b=>b.dataset.v);const tx=Object.assign({},S.ed.texts[0],{size:9}),cv=document.createElement('canvas');cv.width=640;cv.height=360;const x=cv.getContext('2d');
      const shot=(anim,t)=>{x.clearRect(0,0,640,360);x.fillStyle='#000';x.fillRect(0,0,640,360);drawTextLayer(x,Object.assign({},tx,{anim}),640,360,t);const d=x.getImageData(0,0,640,360).data;let s=0,h=0;for(let i=0;i<d.length;i+=16){s+=d[i];h=(h*31+d[i])%1000003}return {s,h}};
      const P=shot('none',2.5),r0=shot('t152_roll',.2),r1=shot('t152_roll',2.5),c0=shot('t152_cursor',.35),c1=shot('t152_cursor',1.9);return {ids,roll:[r0.h!==P.h,r1.h===P.h,Math.round(r0.s/P.s*100)],cur:[Math.round(c0.s/P.s*100),Math.round(c1.s/P.s*100)]}}""")
    out[tag + "_titles"] = tm
    chk(f"{tag}: 8 title motions — letter roll rises letter by letter and ends on the plain text; typing shows part of it with a cursor, then all of it", tm["ids"][-2:] == ["roll", "cursor"] and len(tm["ids"]) == 8 and tm["roll"][0] and tm["roll"][1] and tm["roll"][2] < 90 and tm["cur"][0] < 70 and tm["cur"][1] >= 95, tm)
    await E(OPEN("trans", "trans143", 0)); await pg.wait_for_timeout(300)
    tt = await E("()=>['shutter','split','whipblur'].map(v=>{const b=document.querySelector('#main [data-set=\"edclip.trans\"][data-val=\"'+v+'\"]');return b?[!!b.querySelector('svg'),!!b.title]:null})")
    chk(f"{tag}: Transitions — shutter, split open and whip blur tiles with icons and what each does", all(x == [True, True] for x in tt), tt)
    T0 = await E("()=>clipDur(S.ed.clips[0])"); cuts = {}
    for tr, t, pts in (("shutter", -.75, [[.04, .06], [.04, .5]]), ("shutter", -.25, [[.5, .06], [.5, .5]]), ("split", -.5, [[.5, .5], [.04, .5]]), ("whipblur", -.5, [[.8, .5], [.12, .5]])):
        await E(f"()=>{{const c=S.ed.clips[0];c.trans='{tr}';c.trd=1;renderView()}}"); cuts[tr + str(t)] = await E(PIX, [T0 + t, pts])
    out[tag + "_cuts"] = cuts
    chk(f"{tag}: shutter — black blades close over this clip, then open on the next", black(cuts["shutter-0.75"][0]) and red(cuts["shutter-0.75"][1]) and black(cuts["shutter-0.25"][0]) and blue(cuts["shutter-0.25"][1]), cuts)
    chk(f"{tag}: split open — the next clip in the gap, this one pushed apart; whip blur — the next clip sweeping in", blue(cuts["split-0.5"][0]) and not blue(cuts["split-0.5"][1]) and cuts["whipblur-0.5"][0][2] > cuts["whipblur-0.5"][0][0] + 40, cuts)
    await E("()=>{S.ed.clips[0].trans='cut';renderView()}")
    # ---- 3. split at scene changes
    await E("()=>{edSetPick('clip',S.ed.clips[2].id);S.ed.sel=S.ed.clips[2].id;S.ed.tab='clip';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(300)
    btn = await E("()=>{const b=document.querySelector('#main [data-act=\"sc153\"]');return b?b.textContent:null}")
    await E("()=>document.querySelector('#main [data-act=\"sc153\"]').click()")
    await pg.wait_for_function("S.ed.clips.length===5||(typeof ST153!=='undefined'&&ST153.busy==null&&S.ed.clips.length===3&&document.querySelector('.toast'))", timeout=60000); await pg.wait_for_timeout(600)
    sc = await E("()=>({parts:S.ed.clips.slice(2).map(c=>[+c.in.toFixed(2),+c.out.toFixed(2)]),media:S.ed.clips.slice(2).map(c=>!!clipMedia(c)&&srcReady(clipMedia(c)))})")
    out[tag + "_scenes"] = {"btn": btn, **sc}
    chk(f"{tag}: Split at scene changes — the 9 s clip of three shots becomes three clips at 3 s and 6 s, each playing", btn and len(sc["parts"]) == 3 and abs(sc["parts"][0][1] - 3) < .15 and abs(sc["parts"][1][1] - 6) < .15 and sc["parts"][2][1] == 9 and all(sc["media"]), out[tag + "_scenes"])
    un = await E("async()=>{histGo(-1);await new Promise(r=>setTimeout(r,300));return S.ed.clips.map(c=>[c.in,c.out])}")
    chk(f"{tag}: undo puts the clip back in one piece", len(un) == 3 and un[2] == [0, 9], un)
    await E("async()=>{histGo(1);await new Promise(r=>setTimeout(r,300))}")
    # ---- 4. the sound pass: keys under typed titles, a riser before the big cut
    sp = await E("""async()=>{S.ed.texts[0].anim='t152_cursor';const m=await mod152();return m.soundPass152(S.ed,'crisp').map(x=>x.n)}""")
    chk(f"{tag}: the crisp sound pass — keys under the typed title, a riser before the big cut", "typing" in sp and "riser" in sp, sp)
    # ---- 5. the review's new checks (a vertical edit of equal still clips, a long line, a line under the app's buttons, a stock phrase)
    rv = await E("""async()=>{const E=S.ed;E.format='reels';E.clips[0].out=3;E.clips.forEach(c=>{c.mo=null});const ln=S.lang==='ar'?'نقلة نوعية في عالم القهوة مع مطحنة جديدة تجعل كل صباح أسهل وأجمل وأسرع من أي وقت مضى يا أصدقاء':'Unlock the next level of coffee with our new grinder that makes every single morning feel easy';
      E.texts=[{id:'w1',text:ln,start:0,end:9,pos:'center',style:'clean',anim:'none',size:6},{id:'w2',text:S.lang==='ar'?'تسوّق الآن':'Shop now',start:10,end:12,x:.5,y:.92,pos:'center',style:'clean',anim:'none',size:6}];E.tab='rv152';E.lt143='ai';E.pclosed143=null;renderView();
      document.querySelector('#main [data-act="rv152-go"]').click();for(let i=0;i<40&&!document.querySelector('#main .rv152i');i++)await new Promise(r=>setTimeout(r,50));return ST152.rv.issues.map(x=>x.id)}""")
    out[tag + "_review"] = rv
    chk(f"{tag}: the review finds a slideshow, too many words, a line under the app's buttons and a stock phrase", all(x in rv for x in ["slideshow", "wordy:w1", "safe:w2", "cliche:w1"]), rv)
    rw = await E("""async()=>{document.querySelector('#main .rv152i [data-act="rv152-fix"][data-v="cliche:w1"]').click();await new Promise(r=>setTimeout(r,300));const r={tab:S.ed.tab,sel:S.ed.selText};
      S.ed.tab='rv152';S.ed.lt143='ai';renderView();document.querySelector('#main [data-act="rv152-all"]').click();await new Promise(r=>setTimeout(r,1500));const E=S.ed;
      return Object.assign(r,{left:ST152.rv.issues.map(x=>x.id),n:E.texts.length,w2:E.texts.find(x=>x.id==='w2').y,half:(()=>{const w=E.texts.find(x=>x.id==='w1');return E.texts.some(x=>x.id!=='w1'&&Math.abs(x.start-w.end)<.01&&x.text&&!/^(Follow|تابعنا)/.test(x.text))})(),mo:E.clips.filter(c=>c.mo&&c.mo.kf&&c.mo.kf.length===2).length,clips:E.clips.length})}""")
    out[tag + "_fix"] = rw
    chk(f"{tag}: “Rewrite it” opens that text; Fix all moves every still clip, splits the long line, moves the button line up", rw["tab"] == "text" and rw["sel"] == "w1" and rw["half"] and rw["w2"] <= .72 and rw["mo"] == rw["clips"] and not any(x.startswith(("slideshow", "wordy", "safe")) for x in rw["left"]), rw)
    # ---- 6. an agent's kit and scene split arrive live
    ag = await E("""async()=>{const m=await mod152();const id=S.ed.clips[0].id;op148({op:'kit_set',args:{kit:'retro',sfx:[{id:'q1',n:'whoosh',t:2,vol:60,sp152:'crisp'}]}});const r1={fr:S.ed.fr152.id,look:S.ed.clips[0].cg.look,kit:S.ed.kit153,q1:S.ed.sfx.some(x=>x.id==='q1')};
      const n0=S.ed.clips.length;op148({op:'clip_split',args:{id,cuts:[{t:1.5,id:'zz9'}]}});const z=S.ed.clips.find(c=>c.id==='zz9');return Object.assign(r1,{split:S.ed.clips.length-n0,z:z&&[z.in,z.out],m:!!(z&&clipMedia(z))})}""")
    chk(f"{tag}: an AI agent's style kit and scene split arrive in the open editor", ag["fr"] == "film" and ag["look"] == "vintage" and ag["kit"] == "retro" and ag["q1"] and ag["split"] == 1 and ag["z"] == [1.5, 3] and ag["m"], ag)
    await scan(pg, tag, STATES)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await ctx.close()

async def desktop(b):
    ctx, pg, errs = await open_page(b, 1440, 900, "en", False); E = pg.evaluate
    r = await E("""async()=>{S.ed.lt143='effects';S.ed.tab='kit153';renderView();await new Promise(r=>setTimeout(r,400));return {n:document.querySelectorAll('#main .e-assets [data-act="kit153"]').length,sub:[...document.querySelectorAll('#main .e-assets .e-sub [role=tab]')].map(b=>b.dataset.v)}}""")
    chk("computer: Style kits in the left panel's Effects tabs", r["n"] == 8 and "kit153" in r["sub"], r)
    # the export has the kit: 2 s of the pattern in a night duotone, a pink neon frame, a split-open cut to the blue picture
    await E("""async()=>{const c=S.ed.clips[0];c.out=2;document.querySelector('#main [data-act="kit153"][data-v="neon"]').click();await new Promise(r=>setTimeout(r,500));S.ed.clips[0].trans='split';S.ed.clips[0].trd=1;S.ed.clips.splice(2,1);S.ed.texts=[];S.ed.sfx=[];renderView()}""")
    ex = await E("""async()=>{const T=edTotal();const r=await edRender139(T);if(!r)return null;const b=new Uint8Array(await r.blob.arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return {mime:r.mime,data:btoa(s),T}}""")
    if ex:
        fx = D + "/v153." + ("mp4" if "mp4" in ex["mime"] else "webm"); open(fx, "wb").write(base64.b64decode(ex["data"]))
        def at(t):
            px = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", fx, "-frames:v", "1", "-vf", "scale=200:112", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
            P = lambda x, y: list(px[(y * 200 + x) * 3:(y * 200 + x) * 3 + 3]) if len(px) >= 200 * 112 * 3 else [0, 0, 0]
            return {"edge": max((P(100, y) for y in range(2, 7)), key=lambda p: p[0] - p[1]), "left": P(10, 56), "mid": P(100, 56)}
        a, c = at(0.6), at(1.55); out["export"] = {"0.6": a, "1.55": c, "T": ex["T"]}
        chk("export: the kit's pink neon frame and night duotone at 0.6 s", a["edge"][0] > 150 and a["edge"][0] > a["edge"][1] + 40 and a["left"][0] < 160 and a["left"][2] > 60, out["export"])
        chk("export: at 1.55 s the split has opened — the blue picture in the middle", c["mid"][2] > 120 and c["mid"][2] > c["mid"][0] + 40, out["export"])
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
