# v145: the clip's settings rebuilt clean + new clip tools. The selected clip's details are their own panels (Edit · Speed ·
# Animation · Audio · Motion · Background · Tracking), none cut out of the old page. New: crop (aspect, zoom, position), rotate 90°,
# the canvas behind a clip (fill · fit · blur · colour · picture), animations in and out, audio fades, voice changer (preview and
# export; a pitch shift that really moves the pitch), reverse (made on the server, free — the reversed file plays the part
# backwards, and Reverse again gives the clip back), replace (a file or one of yours, length and effects kept), extract audio.
# Computer and phone, EN + AR, an export with the new tools, no element id twice, nothing covered, no page errors.
# Run: python3 tests/v145.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8402
D = tempfile.mkdtemp(prefix="nooi-v145-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", M + "a.webm")
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "500k", "-an", M + "mute.webm")
FF("-f", "lavfi", "-i", "color=c=0xff00ff:s=320x180", "-frames:v", "1", M + "bg.png")
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Beach',title:'Beach at sunset',created:now,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'},
   {id:'vb',kind:'video',status:'complete',prompt:'City',title:'City at night',created:now-9,progress:1,pal:PALS[1],seed:9,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.texts=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];M.edMusic=null;
 await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});
 const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'talk.webm',{type:'video/webm'})]);
 S.ed.tab='clip';S.ed.sel=S.ed.clips[0].id;edSetPick('clip',S.ed.clips[0].id);go('edit');renderAll()}"""
READY = "S.ed.clips.length===3&&document.querySelector('.ed143 #wk')&&S.ed.clips.every(c=>{const m=clipMedia(c);return m&&srcReady(m)})"
SCAN = open(os.path.join(ROOT, "tests", "v144.py")).read().split('SCAN = r"""', 1)[1].split('"""', 1)[0]
PIX = """async([t,x,y,w,h])=>{ED.playing=false;ED.t=t;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,250));
 /* the clip under the playhead may still be seeking (a replaced file): wait for its frame, up to 2 s */
 for(let i=0;i<40;i++){const st=edStarts(),k=S.ed.clips.findIndex((c,j)=>t>=st[j]&&t<st[j]+clipDur(c)),m=k>=0&&M['c_'+S.ed.clips[k].id];if(!m||!m.el||m.type!=='video'||(m.el.readyState>=2&&!m.el.seeking))break;await new Promise(r=>setTimeout(r,50))}
 for(let i=0;i<2;i++)await new Promise(r=>requestAnimationFrame(r));
 const cv=document.getElementById('wk'),c=cv.getContext('2d'),d=c.getImageData(Math.round(cv.width*x),Math.round(cv.height*y),Math.max(1,Math.round(cv.width*w)),Math.max(1,Math.round(cv.height*h))).data;let r=0,g=0,b=0,n=d.length/4;
 for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}return [Math.round(r/n),Math.round(g/n),Math.round(b/n)]}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
near = lambda a, b, d=40: all(abs(x - y) <= d for x, y in zip(a, b))
def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], capture_output=True, text=True).stdout or "{}")
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), {}); return {"w": v.get("width"), "h": v.get("height"), "dur": float(j.get("format", {}).get("duration", 0) or 0), "audio": any(s.get("codec_type") == "audio" for s in j.get("streams", []))}
def frame(f, t, out_png):
    FF("-ss", str(t), "-i", f, "-frames:v", "1", "-vf", "scale=64:36", out_png); return open(out_png, "rb").read()
def gray(f, t):
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", f, "-frames:v", "1", "-vf", "scale=32:18,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    return list(r)
def diff(a, b): return sum(abs(x - y) for x, y in zip(a, b)) / max(1, min(len(a), len(b)))

async def open_page(b, w, h, lang, mob):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob, accept_downloads=True); pg = await ctx.new_page(); errs = []
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

SEL = "(k)=>{const c=S.ed.clips[k];S.ed.sel=c.id;edSetPick('clip',c.id);renderView()}"
async def desktop(b, lang):
    tag = f"desktop {lang}"; ctx, pg, errs = await open_page(b, 1280, 900, lang, False); E = pg.evaluate
    D_ = lambda s: E("()=>document.querySelector('.e-details " + s.replace("'", "\\'") + "').click()")
    async def tab(t): await E("(t)=>{document.querySelector('.e-details .e-sub [data-v=\"'+t+'\"]').click()}", t); await pg.wait_for_timeout(250)
    await E(SEL, 0)
    subs = await E("()=>[...document.querySelectorAll('.e-details .e-sub button')].map(b=>b.dataset.v)")
    chk(f"{tag}: a clip's details: Edit · Speed · Animation · Audio · Motion · Background · Tracking", subs == ["clip", "speed145", "anim145", "audio145", "motion", "bg144", "track"], subs)
    ed = await E("()=>({secs:[...document.querySelectorAll('.e-details .e145s')].map(s=>s.dataset.anc),old:/Precision edit|تحرير دقيق|Clip volume|صوت المقطع/.test(document.querySelector('.e-details').textContent),trans:document.querySelectorAll('.e-details [data-set=\"edclip.trans\"]').length,chip:!document.querySelector('.e-details .pk84c')&&!!document.querySelector('.e-details [data-set=\"edclip.trans\"] svg')})")   # (v151: the transitions are picture tiles, no chip)
    chk(f"{tag}: Edit: trim · crop & rotate · canvas · reverse & replace · extend · transition (its own panel, not the old page's)", ed["secs"] == ["trim", "crop", "canvas", "replace", "extend", "trans"] and not ed["old"] and ed["trans"] >= 33 and ed["chip"], ed)
    # ---- crop & rotate, the canvas behind
    await E("()=>{ED.t=2}"); base = await E(PIX, [2, .45, .45, .1, .1])
    await D_('[data-act="crop145"][data-v="9:16"]'); await pg.wait_for_timeout(200)
    await D_('[data-act="cv145"][data-v="color"]'); await pg.wait_for_timeout(200); await D_('[data-act="cv145c"][data-v="#ff5a5f"]'); await pg.wait_for_timeout(200)
    cr = await E("()=>({crop:S.ed.clips[0].crop,cv:S.ed.clips[0].cv145,z:!!document.querySelector('.e-details [data-crop145=\"z\"]')})")
    side = await E(PIX, [2, .03, .4, .04, .2]); mid = await E(PIX, [2, .46, .45, .08, .1])
    chk(f"{tag}: crop to 9:16 — the clip shows tall in the middle, the canvas colour at the sides", cr["crop"]["ar"] == "9:16" and cr["cv"]["mode"] == "color" and cr["z"] and near(side, [255, 90, 95], 25) and not near(mid, [255, 90, 95], 40), {"cr": cr, "side": side, "mid": mid})
    await E("()=>{const i=document.querySelector('.e-details [data-crop145=\"z\"]');i.value='2';i.dispatchEvent(new Event('input',{bubbles:true}))}"); await pg.wait_for_timeout(150)
    z2 = await E(PIX, [2, .38, .1, .24, .8]); await E("()=>{S.ed.clips[0].crop.z=1}"); z1 = await E(PIX, [2, .38, .1, .24, .8]); await E("()=>{S.ed.clips[0].crop.z=2}")
    chk(f"{tag}: zoom into the crop changes the picture", await E("()=>S.ed.clips[0].crop.z") == 2 and z2 != z1, [z2, z1])
    await D_('[data-act="crop145"][data-v="reset"]'); await pg.wait_for_timeout(150)
    await D_('[data-act="rot145"][data-v="90"]'); await pg.wait_for_timeout(200)
    r1 = await E("()=>S.ed.clips[0].rot"); sd = await E(PIX, [2, .03, .4, .04, .2])
    chk(f"{tag}: rotate 90° — the turned clip stands in the frame, the canvas at the sides", r1 == 90 and near(sd, [255, 90, 95], 25), [r1, sd])
    await D_('[data-act="cv145"][data-v="pic"]'); await pg.wait_for_timeout(200)
    await pg.set_input_files(".e-details input[data-cv145pic]", M + "bg.png"); await pg.wait_for_function("(()=>{const m=M['cvp_'+S.ed.clips[0].id];return m&&srcReady(m)})()", timeout=15000)
    pp = await E(PIX, [2, .03, .4, .04, .2]); chk(f"{tag}: the canvas can be a picture", near(pp, [255, 0, 255], 40), pp)
    await D_('[data-act="cv145"][data-v="fill"]'); await pg.wait_for_timeout(200); fl = await E(PIX, [2, .03, .4, .04, .2])
    chk(f"{tag}: Fill: no canvas showing", not near(fl, [255, 0, 255], 60) and not near(fl, [255, 90, 95], 40), fl)
    await D_('[data-act="rot145"][data-v="-90"]'); await D_('[data-act="cv145"][data-v="auto"]'); await pg.wait_for_timeout(200)
    chk(f"{tag}: back to the start: no turn, the project's canvas", await E("()=>({r:S.ed.clips[0].rot,cv:S.ed.clips[0].cv145||null})") == {"r": 0, "cv": None})
    # ---- reverse (on the server; the clip you added from this device goes up first)
    await E(SEL, 2); await pg.wait_for_timeout(200)
    await D_('[data-act="rev145"]'); await pg.wait_for_function("S.ed.clips[2].rev===true", timeout=90000); await pg.wait_for_timeout(300)
    rv = await E("()=>{const c=S.ed.clips[2],j=S.jobs.find(x=>x.id===c.src.job);return{src:c.src,in:c.in,out:c.out,url:j&&j.resultUrl,src0:c.src0&&c.src0.src,label:document.querySelector('.e-details [data-act=\"rev145\"]').textContent}}")
    rf = M + rv["url"].rsplit("/", 1)[-1] if rv.get("url") else ""
    pr = probe(rf) if rf else {}
    a_end, a_start, r_start = gray(M + "a.webm", 5.9), gray(M + "a.webm", .1), gray(rf, .05) if rf else []
    chk(f"{tag}: Reverse: a new file of the same length that starts where the clip ended", rf.endswith("-reversed.mp4") and abs(pr.get("dur", 0) - 6) < .35 and pr.get("audio") and rv["src0"] and diff(r_start, a_end) < diff(r_start, a_start) * .6, {"rv": rv, "pr": pr, "d_end": diff(r_start, a_end) if r_start else None, "d_start": diff(r_start, a_start) if r_start else None})
    await D_('[data-act="rev145"]'); await pg.wait_for_timeout(400)
    chk(f"{tag}: Reverse again gives the clip back", await E("()=>{const c=S.ed.clips[2],m=M['c_'+c.id];return !c.rev&&c.src.k==='upload'&&c.in===0&&Math.abs(c.out-6)<.05&&!!(m&&m.file)}"))
    # ---- replace
    await E("()=>{const c=S.ed.clips[1];c.trans='fade';c.cg={look:'teal'};c.vfx={glow:true}}"); await E(SEL, 1)
    await pg.set_input_files(".e-details input[data-rep145]", M + "mute.webm"); await pg.wait_for_timeout(1200)
    rp = await E("()=>{const c=S.ed.clips[1];return{src:c.src,out:c.out,trans:c.trans,look:(c.cg||{}).look,glow:(c.vfx||{}).glow,n:S.ed.clips.length}}")
    chk(f"{tag}: Replace with a file: the new file, its own shorter length, the transition, look and effects kept", rp["src"]["k"] == "upload" and abs(rp["out"] - 4) < .2 and rp["trans"] == "fade" and rp["look"] == "teal" and rp["glow"] and rp["n"] == 3, rp)
    await D_('[data-act="rep145-lib"]'); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('#modalRoot [data-act=\"rep145-pick\"][data-v=\"vb\"]').click()"); await pg.wait_for_timeout(400)
    chk(f"{tag}: Replace with one of yours", await E("()=>{const c=S.ed.clips[1];return c.src.k==='job'&&c.src.job==='vb'&&!document.querySelector('#modalRoot .sheet')}"))
    # ---- speed
    await E(SEL, 0); await tab("speed145")
    sp = await E("()=>({chips:document.querySelectorAll('.e-details [data-set=\"edclip.speed\"]').length,custom:!!document.querySelector('.e-details [data-bind=\"edclip.speed\"]'),slow:document.querySelectorAll('.e-details [data-act=\"edx-slow\"]').length,ramp:document.querySelectorAll('.e-details [data-act=\"edx-ramp\"]').length,smooth:document.querySelectorAll('.e-details [data-act=\"edx-smooth\"]').length})")
    await D_('[data-set="edclip.speed"][data-val="2"]'); await pg.wait_for_timeout(200)
    chk(f"{tag}: Speed: speeds, a custom speed, slow motion, speed ramp, smooth frames", sp == {"chips": 6, "custom": True, "slow": 5, "ramp": 4, "smooth": 3} and await E("()=>S.ed.clips[0].speed") == 2, sp)
    await E("()=>{S.ed.clips[0].speed=1;renderView()}")
    # ---- animations in & out
    await tab("anim145")
    an = await E("()=>({in:document.querySelectorAll('.e-details [data-act=\"an145\"][data-w=\"in\"]').length,out:document.querySelectorAll('.e-details [data-act=\"an145\"][data-w=\"out\"]').length})")
    await D_('[data-act="an145"][data-w="in"][data-v="slidel"]'); await pg.wait_for_timeout(200); await E("()=>{ED.playing=false}")
    await D_('[data-act="an145"][data-w="out"][data-v="fade"]'); await pg.wait_for_timeout(200); await E("()=>{ED.playing=false}")
    a1 = await E("()=>({ain:S.ed.clips[0].ain,aout:S.ed.clips[0].aout,d:!!document.querySelector('.e-details [data-an145d=\"in\"]')})")
    rt = await E(PIX, [.1, .9, .4, .08, .2]); rt2 = await E(PIX, [2, .9, .4, .08, .2]); fo = await E(PIX, [5.9, .3, .3, .4, .4]); fo0 = await E(PIX, [4.5, .3, .3, .4, .4])
    chk(f"{tag}: Animation: 21 ins and outs (12 + the 9 of v201); slide in from the left (the right side still empty at the start), fade out (darker at the end)", an == {"in": 21, "out": 21} and a1["ain"]["k"] == "slidel" and a1["aout"]["k"] == "fade" and a1["d"] and sum(rt) < 60 and sum(rt2) > 80 and sum(fo) < sum(fo0) * .6, {"an": an, "a1": a1, "rt": rt, "rt2": rt2, "fo": fo, "fo0": fo0})
    await E("()=>{delete S.ed.clips[0].ain;delete S.ed.clips[0].aout;renderView()}")
    # ---- audio: fades, voice changer, extract audio
    await tab("audio145")
    au = await E("()=>({vol:!!document.querySelector('.e-details [data-bind=\"edclip.vol\"]'),fi:!!document.querySelector('.e-details [data-bind=\"edclip.afi\"]'),fo:!!document.querySelector('.e-details [data-bind=\"edclip.afo\"]'),vc:document.querySelectorAll('.e-details [data-act=\"vc145\"]').length,xa:!!document.querySelector('.e-details [data-act=\"xa145\"]'),clean:!!document.querySelector('.e-details [data-act=\"clean140\"]')})")
    chk(f"{tag}: Audio: volume, fade in/out, 9 voices, extract audio, clean up", au == {"vol": True, "fi": True, "fo": True, "vc": 9, "xa": True, "clean": True}, au)
    await E("()=>{const i=document.querySelector('.e-details [data-bind=\"edclip.afi\"]');i.value='2';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))}"); await pg.wait_for_timeout(150)
    pv = await E("async()=>{ED.playing=false;ED.t=.5;await new Promise(r=>setTimeout(r,200));const a=M['c_'+S.ed.clips[0].id].el.volume;ED.t=4;await new Promise(r=>setTimeout(r,200));return[+a.toFixed(3),+M['c_'+S.ed.clips[0].id].el.volume.toFixed(3)]}")
    MIX = """async(o)=>{const E=S.ed,c=E.clips[0],keep=E.clips;E.clips=[c];c.in=0;c.out=6;c.vol=100;delete c.afi;delete c.afo;delete c.vc145;Object.assign(c,o);E.clipSound=true;E.clean140=false;M.edMusic=null;E.sfx=[];
      try{const b=await mix139(6),d=b.getChannelData(0),SR=b.sampleRate,R=(a,e)=>{let s=0,n=0;for(let i=Math.floor(a*SR);i<Math.floor(e*SR);i++){s+=d[i]*d[i];n++}return Math.sqrt(s/n)},Z=(a,e)=>{let z=0;for(let i=Math.floor(a*SR)+1;i<Math.floor(e*SR);i++)if((d[i-1]<0)!==(d[i]<0))z++;return z/2/(e-a)};
        return{r0:R(.1,.4),r1:R(3,4),hz:Z(3,5)}}finally{E.clips=keep;delete c.afi;delete c.afo;delete c.vc145}}"""
    m0 = await E(MIX, {}); mf = await E(MIX, {"afi": 2}); md = await E(MIX, {"vc145": "deep"}); mh = await E(MIX, {"vc145": "high"}); mr = await E(MIX, {"vc145": "robot"})
    out[tag + "_mix"] = {"plain": m0, "fade": mf, "deep": md, "high": mh, "robot": mr, "preview": pv}
    chk(f"{tag}: fade in — quiet at the start in the preview and the export, full later", pv[0] < .4 and pv[1] > .95 and mf["r0"] < m0["r0"] * .35 and abs(mf["r1"] - m0["r1"]) < m0["r1"] * .1, out[tag + "_mix"])
    chk(f"{tag}: voice changer in the export: deep is lower, high is higher (5 and 4 semitones), robot changes the sound", abs(md["hz"] / m0["hz"] - 2 ** (-5 / 12)) < .06 and abs(mh["hz"] / m0["hz"] - 2 ** (4 / 12)) < .07 and abs(mr["hz"] - m0["hz"]) > 20, out[tag + "_mix"])
    await D_('[data-act="vc145"][data-v="robot"]'); await pg.wait_for_timeout(500); await E("()=>{ED.playing=false}")
    chk(f"{tag}: the voice changer is kept with the clip", await E("()=>S.ed.clips[0].vc145") == "robot")
    await D_('[data-act="vc145"][data-v="none"]'); await pg.wait_for_timeout(150)
    await E(SEL, 2); await tab("audio145"); n0 = await E("()=>S.ed.sfx.length")
    await D_('[data-act="xa145"]'); await pg.wait_for_function("S.ed.sfx.length>%d" % n0, timeout=20000); await pg.wait_for_timeout(500)
    xa = await E("async()=>{const it=S.ed.sfx[S.ed.sfx.length-1],c=S.ed.clips[2],b=await edxBuffer(it);return{t:it.t,start:edStarts()[2],vol:c.vol,dur:b&&+b.duration.toFixed(2),len:+(c.out-c.in).toFixed(2),name:it.name}}")
    chk(f"{tag}: Extract audio: the clip's sound on its own track under it, the clip silent", abs(xa["t"] - xa["start"]) < .01 and xa["vol"] == 0 and abs((xa["dur"] or 0) - xa["len"]) < .15, xa)
    # ---- an export with the new tools (crop to 9:16 on a 16:9 project, a colour canvas, slide in, fade in, deep voice)
    await E("()=>{const c=S.ed.clips[0];S.ed.clips=[c];c.in=0;c.out=2;c.vol=100;c.crop={ar:'9:16',z:1,x:0,y:0};c.cv145={mode:'color',col:'#ff5a5f'};c.ain={k:'slidel',d:.5};c.afi=.5;c.vc145='deep';S.ed.sfx=[];S.ed.clipSound=true;S.ed.fmtOut='mp4';S.ed.tab='export';S.ed.rcheck=false;edSetPick(null);renderView()}")
    async with pg.expect_download(timeout=240000) as dl: await E("()=>{edExport()}")
    d = await dl.value; f = D + "/exp_" + d.suggested_filename; await d.save_as(f); pr = probe(f)
    px = subprocess.run(["ffmpeg", "-v", "error", "-ss", "1.5", "-i", f, "-frames:v", "1", "-vf", "crop=iw*0.04:ih*0.2:iw*0.02:ih*0.4,scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    st = await E("()=>R139.stats")
    chk(f"{tag}: the export: frame by frame, with sound, the crop and its canvas colour in the picture", st and st.get("path") == "frames" and pr["audio"] and abs(pr["dur"] - 2) < .2 and len(px) == 3 and near(list(px), [255, 90, 95], 35), {"st": st, "pr": pr, "px": list(px)})
    # ---- the new panels: nothing covered, no id twice
    await E("()=>{location.hash='';}")
    states = [(n, "()=>{const c=S.ed.clips[0];S.ed.sel=c.id;edSetPick('clip',c.id);S.ed.tab='%s';S.ed.dt143='%s';renderView()}" % (n, n)) for n in ("clip", "speed145", "anim145", "audio145")]
    await scan(pg, tag, states)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await ctx.close()

async def phone(b, lang):
    tag = f"phone {lang}"; ctx, pg, errs = await open_page(b, 390, 844, lang, True); E = pg.evaluate
    c = await E("()=>{const c=S.ed.clips[0];S.ed.sel=c.id;edSetPick('clip',c.id);S.ed.tab='clip';S.ed.pclosed143='clip';renderView();return[...document.querySelectorAll('.e-bar button')].map(b=>b.dataset.v||b.dataset.act)}")
    want = ["desel143", "clip", "ed-split", "ed-del", "speed145", "audio145", "anim145", "motion", "color", "trans143", "clip#crop", "90", "rev145", "edx-freeze", "fh", "ed-dup", "ed-move", "ed-move", "ed-extend91", "bg144", "clip#replace", "xa145", "track", "ai140", "cp146", "msm146", "snap141"]   # (v146: Copy, Select more)   # (v208: Delete beside Split)
    chk(f"{tag}: the clip's tools: … Speed, Volume, Animation … Crop, Rotate, Reverse … Background, Replace, Extract audio …", c == want, c)
    async def bar(sel): await E("(s)=>{const b=document.querySelector('.e-bar '+s);b.scrollIntoView({inline:'center'});b.click()}", sel); await pg.wait_for_timeout(500)
    await bar('[data-v="speed145"]'); s1 = await E("()=>({tab:S.ed.tab,sheet:!!document.querySelector('.e-sheet [data-act=\"edx-slow\"]')})")
    chk(f"{tag}: Speed opens the speed sheet", s1 == {"tab": "speed145", "sheet": True}, s1)
    await bar('[data-v="clip#crop"]'); s2 = await E("()=>{const s=document.querySelector('.e-sheet [data-anc=\"crop\"]'),st=document.querySelector('.edstage').getBoundingClientRect();if(!s)return null;const r=s.getBoundingClientRect();return{tab:S.ed.tab,top:Math.round(r.top),under:Math.round(st.bottom),vh:innerHeight}}")
    chk(f"{tag}: Crop opens Edit at the crop section, in view under the picture", s2 and s2["tab"] == "clip" and s2["under"] - 4 <= s2["top"] < s2["vh"] - 120, s2)
    await bar('[data-act="rot145"]'); chk(f"{tag}: Rotate turns the clip at once", await E("()=>S.ed.clips[0].rot") == 90)
    await E("()=>{S.ed.clips[0].rot=0;renderView()}")
    states = [(n, "()=>{const c=S.ed.clips[0];S.ed.sel=c.id;edSetPick('clip',c.id);S.ed.tab='%s';S.ed.pclosed143=null;renderView();showSheet143()}" % n) for n in ("clip", "speed145", "anim145", "audio145")]
    await scan(pg, tag, states)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        for f, lang in ((desktop, "en"), (desktop, "ar"), (phone, "en"), (phone, "ar")):
            try: await f(b, lang)
            except Exception as e: fails.append(f"{f.__name__} {lang} crashed: " + repr(e)[:500])
        await b.close()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/health", timeout=2); break
        except Exception: time.sleep(.2)
    asyncio.run(main())
finally: srv.kill()
print(json.dumps({"fails": fails, "out": {k: json.dumps(v, ensure_ascii=False, default=str)[:1400] for k, v in out.items()}, "dir": D}, ensure_ascii=False, indent=1))
sys.exit(1 if fails else 0)
