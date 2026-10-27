# v140: the editor, combined — the tools in eight groups; every AI tool in one place (a clip you uploaded goes onto your account once,
# so the AI tools work on it); film LUTs (built in or a .cube) and colour by colour on the graphics card, in the preview and the export;
# clean up voices (preview + export, with less background noise); subtitle files in and out. Run: python3 tests/v140.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8390
D = tempfile.mkdtemp(prefix="nooi-v140-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
# rb.png: red on the left, blue on the right · v.webm: a tone in two bursts over a steady hiss (a voice over a noisy room)
FF("-f", "lavfi", "-i", "color=c=0xff0000:s=320x360", "-f", "lavfi", "-i", "color=c=0x0000ff:s=320x360", "-filter_complex", "[0:v][1:v]hstack", "-frames:v", "1", M + "rb.png")
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=5", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=5",
   "-f", "lavfi", "-i", "anoisesrc=color=white:amplitude=0.04:sample_rate=48000:duration=5",
   "-filter_complex", "[1:a]volume='if(between(t,1,2)+between(t,3,3.5),0.5,0)':eval=frame[t];[t][2:a]amix=inputs=2:duration=first,volume=2[a]",
   "-map", "0:v", "-map", "[a]", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-c:a", "libopus", "-b:a", "128k", M + "v.webm")
SETUP = """async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
 const now=Date.now();S.jobs.push({id:'ed_rb',kind:'image',status:'complete',prompt:'rb',title:'rb',created:now,progress:1,pal:PALS[0],seed:7,aspect:'16:9',resultUrl:'/media/rb.png'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];S.ed.fit='contain';
 await edUseJob(S.jobs.find(j=>j.id==='ed_rb'),{stay:true,quiet:true,t:1});S.ed.clips[0].out=1.5;S.ed.sel=S.ed.clips[0].id;
 window.__t=[];toast=(o=>function(m){window.__t.push(String(m));return o.apply(this,arguments)})(toast);go('edit');renderAll()}"""
# the two halves of the preview (or of a frame), after the editor draws the moment t
PIX = """(t)=>{ED.playing=false;ED.t=t;edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d'),W=c.width,H=c.height,
 at=(fx)=>Array.from(x.getImageData(Math.round(W*fx),Math.round(H*.5),1,1).data).slice(0,3);return{l:at(.3),r:at(.7)}}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
def api(path, body=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{path}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
near = lambda c, w, d=40: c is not None and all(abs(c[i] - w[i]) < d for i in range(3))
grey = lambda c: max(c) - min(c) < 30

async def editor(p):
    b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1280, "height": 900})
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    ups = []; pg.on("request", lambda r: ups.append(r.url) if "/v1/uploads" in r.url else None)
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E(SETUP); await pg.wait_for_function("S.ed.clips.length===1&&(()=>{const m=M['c_'+S.ed.clips[0].id];return m&&m.el&&m.el.complete&&m.el.naturalWidth>0})()", timeout=20000)
    # ---- 1. the layout (v143: CapCut / DonkeyCut — the add tools on a rail, the selected clip's details on the right)
    g = await E("""()=>{edSetPick('clip',S.ed.clips[0].id);S.ed.tab='clip';renderView();const sub=s=>[...document.querySelectorAll(s+' .e-sub button')].map(b=>b.dataset.v);
      return{cats:[...document.querySelectorAll('.e-rail button')].map(b=>b.dataset.v),det:sub('.e-details'),dtab:document.querySelector('.e-details .e-body')?.dataset.tab,pressed:document.querySelector('.e-details .e-sub [aria-pressed="true"]')?.dataset.v}}""")
    out["groups"] = g
    chk("the add tools on the rail (Media · Audio · Text · Stickers · Effects · Transitions · Captions · Filters · AI) and the clip's details (Edit · Speed · Animation · Audio · Motion · Background · Tracking)", g["cats"] == ["media", "audio", "text", "stickers", "effects", "trans", "captions", "filters", "ai"] and g["det"] == ["clip", "speed145", "anim145", "audio145", "motion", "bg144", "track"] and g["dtab"] == "clip" and g["pressed"] == "clip", g)
    seq = []
    for v in ("filters", "audio", "ai", "effects"):
        await pg.click(f'.e-rail [data-v="{v}"]'); await pg.wait_for_timeout(80)
        seq.append(await E("()=>[S.ed.tab,[...document.querySelectorAll('.e-assets .e-sub button')].map(b=>b.dataset.v),document.querySelector('.e-details .e-body')?.dataset.tab]"))
    out["groups_seq"] = seq
    # (v150: AI has Motion ad after the Assistant; Audio has the Mixer last)
    chk("…a tool opens its first panel (Filters → Filters & color, Audio → Music & voice, AI → Assistant) and the clip's details stay", seq[0][0] == "color" and seq[0][1] == ["color", "look"] and seq[1][0] == "audio" and seq[2][0] == "chat143" and seq[2][1] == ["chat143", "rv152", "ad150", "ai140", "ai", "3d"] and all(x[2] == "clip" for x in seq), seq)
    await pg.click('.e-assets .e-sub [data-v="layers"]'); await pg.click('.e-rail [data-v="text"]'); await pg.click('.e-rail [data-v="effects"]')
    chk("…and comes back to the panel you were on in it (Overlays)", await E("()=>S.ed.tab") == "layers")
    # ---- 2. pro colour on the graphics card
    await E("()=>{S.ed.tab='color';renderView()}")
    base = await E(PIX, .5)
    await E("()=>{S.ed.clips[0].cg={lut:'b:mono',lutAmt:100}}"); mono = await E(PIX, .5)
    await E("()=>{S.ed.clips[0].cg.lutAmt=0}"); zero = await E(PIX, .5)
    await E("()=>{S.ed.clips[0].cg={hsl:{red:[0,-100,0]}}}"); hred = await E(PIX, .5)
    await E("()=>{S.ed.clips[0].cg={hsl:{blue:[30,0,0]}}}"); hblue = await E(PIX, .5)
    out["colour"] = {"base": base, "mono": mono, "amt0": zero, "red-100": hred, "blue+30": hblue, "gl": await E("()=>!GL140.no")}
    chk("colour: the picture as it is without a look (red left, blue right)", near(base["l"], (255, 0, 0)) and near(base["r"], (0, 0, 255)), out["colour"])
    chk("…the Rich mono LUT turns both halves grey; at strength 0 nothing changes", grey(mono["l"]) and grey(mono["r"]) and near(zero["l"], base["l"], 8) and near(zero["r"], base["r"], 8), out["colour"])
    chk("…colour by colour: red saturation −100 greys the red only; blue hue +30° moves blue towards purple", grey(hred["l"]) and near(hred["r"], (0, 0, 255)) and hblue["r"][0] > 60 and near(hblue["l"], (255, 0, 0)), out["colour"])
    # the colour tab: tiles, a .cube of your own (an inverting LUT), a 1D LUT refused
    await E("()=>{S.ed.clips[0].cg={};renderView()}")
    ui = await E("()=>({luts:document.querySelectorAll('[data-act=\"lut140\"]').length,bands:document.querySelectorAll('[data-act=\"hsl140-band\"]').length,sw:[...document.querySelectorAll('.lut140 .gl i')].slice(1,3).map(i=>i.style.background)})")
    chk("…the colour tab: None + 10 film LUTs as tiles with their colours, 8 colour dots", ui["luts"] == 11 and ui["bands"] == 8 and all("gradient" in s for s in ui["sw"]), ui)
    open(D + "/inv.cube", "w").write('TITLE "Invert"\nLUT_3D_SIZE 2\n' + "".join(f"{1-r} {1-g} {1-bb}\n" for bb in (0, 1) for g in (0, 1) for r in (0, 1)))
    open(D + "/one.cube", "w").write("LUT_1D_SIZE 2\n0 0 0\n1 1 1\n")
    await pg.set_input_files('[data-lut140]', D + "/inv.cube"); await pg.wait_for_function("S.ed.clips[0].cg.lut&&S.ed.clips[0].cg.lut.startsWith('u:')", timeout=5000)
    inv = await E(PIX, .5); lut = await E("()=>{const id=S.ed.clips[0].cg.lut,u=S.ed.luts140[id];return{id,name:u.name,n:u.n,len:u.d.length,tile:!!document.querySelector('[data-act=\"lut140\"][data-v=\"'+id+'\"][aria-pressed=\"true\"]')}}")
    out["cube"] = {"pix": inv, "lut": lut}
    chk("…your own .cube: kept in the edit, picked, and the picture inverted (red → cyan, blue → yellow)", near(inv["l"], (0, 255, 255)) and near(inv["r"], (255, 255, 0)) and lut["name"] == "Invert" and lut["n"] == 2 and lut["tile"], out["cube"])
    n0 = await E("()=>__t.length"); await pg.set_input_files('[data-lut140]', D + "/one.cube"); await pg.wait_for_timeout(300)
    chk("…a 1D LUT is refused with a plain reason", any("3D LUT" in t for t in await E("(n)=>__t.slice(n)", n0)), await E("(n)=>__t.slice(n)", n0))
    doc = await E("async()=>{const d=(await doc139(false)).doc.ed;return{luts:Object.keys(d.luts140||{}),cg:d.clips[0].cg,last:'last140' in d,band:'band140' in d}}")
    chk("…the LUT goes with the project (on your account too); the open group and colour dot don't", len(doc["luts"]) == 1 and doc["cg"].get("lut") == doc["luts"][0] and not doc["last"] and not doc["band"], doc)
    # the export draws the same look (the inverting LUT on a 1.5 s picture clip)
    ex = await E("""async()=>{const r=await edRender139(edTotal());if(!r)return null;const v=document.createElement('video');v.muted=true;v.src=URL.createObjectURL(r.blob);
      await new Promise((ok,no)=>{v.onloadeddata=ok;v.onerror=()=>no(new Error('decode'));setTimeout(()=>no(new Error('timeout')),15000)});v.currentTime=.7;await new Promise(ok=>{v.onseeked=ok;setTimeout(ok,4000)});
      const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const x=c.getContext('2d');x.drawImage(v,0,0);const at=fx=>Array.from(x.getImageData(Math.round(c.width*fx),Math.round(c.height*.5),1,1).data).slice(0,3);
      return{mime:r.mime,l:at(.3),r:at(.7),w:c.width}}""")
    out["export"] = ex
    chk("…and the exported video has the same look (red → cyan, blue → yellow)", ex and near(ex["l"], (0, 255, 255), 60) and near(ex["r"], (255, 255, 0), 60), ex)
    await E("()=>{S.ed.tab='color';renderView()}"); await pg.click('[data-act="lut140-del"]')
    chk("…Remove this LUT takes it off the clip and out of the edit", await E("()=>!S.ed.clips[0].cg.lut&&!Object.keys(S.ed.luts140||{}).length"))
    # ---- 3. AI tools on a clip you uploaded
    await E("async()=>{const b=await (await fetch('/media/v.webm')).blob();edAddFiles([new File([b],'mine.webm',{type:'video/webm'})]);S.ed.tab='ai140';renderView()}")
    await pg.wait_for_function("(()=>{const c=S.ed.clips[1],m=c&&M['c_'+c.id];return m&&m.el&&m.el.readyState>=1})()", timeout=15000)
    await E("()=>{S.ed.sel=S.ed.clips[1].id;S.ed.tab='ai140';renderView()}")
    ai = await E("""()=>{const cards=[...document.querySelectorAll('.ai140c')];return{n:cards.length,titles:cards.map(c=>c.querySelector('b').textContent),prices:cards.map(c=>c.querySelector('.ai140p').textContent.trim()),
      ids:['edaisfx','edaimu','edtrl','edtrtx'].filter(i=>document.getElementById(i)),text:document.querySelector('.edxpanel').innerText}}""")
    out["ai"] = {k: v for k, v in ai.items() if k != "text"}
    want = ["Extend this shot", "Edit with words", "Replace things", "AI voice-over", "Voices & sound for this clip", "Sound effect from words", "Music for this video", "Clean up voices", "Auto captions", "Translate captions & text", "Dub into another language", "Lip-sync"]
    chk("AI tools: every AI feature in one place — extend, edit with words, replace, voice-over, voices & sound, sound effects, music, clean voices, captions, translate, dub, lip-sync", all(w in ai["titles"] for w in want) and len(ai["ids"]) == 4, out["ai"])
    chk("…each shows its price first (a number, Free, or Priced first); no engine names", all(p for p in ai["prices"]) and ai["prices"][0].isdigit() and "kie" not in ai["text"].lower(), out["ai"])
    await pg.click('[data-act="ai140"][data-v="words"]'); await pg.wait_for_function("!!document.querySelector('#modalRoot .ew135')", timeout=15000)
    j1 = await E("()=>{const c=S.ed.clips[1],j=S.jobs.find(x=>x.id===c.srv140);return j&&{remote:j.remote,kind:j.kind,status:j.status,url:j.resultUrl,clip:j.meta&&j.meta.clip140,title:document.querySelector('#modalRoot h2,#modalRoot h3')?.textContent}}")
    await E("()=>{document.getElementById('modalRoot').innerHTML=''}")
    await pg.click('[data-act="ai140"][data-v="replace"]'); await pg.wait_for_timeout(800)
    j2 = await E("()=>({n:S.jobs.filter(x=>x.meta&&x.meta.clip140).length,sheet:document.getElementById('modalRoot').innerText.slice(0,80)})"); await E("()=>{document.getElementById('modalRoot').innerHTML=''}")
    out["clip140"] = {"job": j1, "again": j2, "uploads": len(ups)}
    chk("…an uploaded clip goes onto your account once (one upload), becomes one of your videos, and Edit with words opens on it", j1 and j1["remote"] and j1["kind"] == "video" and j1["status"] == "complete" and j1["url"].startswith("/media/") and j1["clip"] and len(ups) == 1, out["clip140"])
    chk("…the next tool (Replace things) uses the same one — no second upload", j2["n"] == 1 and len(ups) == 1 and "Replace" in j2["sheet"], out["clip140"])
    st1, r1 = api("/v1/clips140", {"url": "/media/v.webm"}); st2, r2 = api("/v1/clips140", {"url": "/media/../data/db.json"}); st3, r3 = api("/v1/clips140", {"url": j1["url"]})
    chk("…the server takes only a file you uploaded (not another file, not a path out of the media folder); the same file gives the same video", st1 == 400 and st2 == 400 and st3 == 200 and r3.get("id") == j1["remote"], [st1, st2, st3, r3])
    await pg.click('[data-act="ai140"][data-v="dub"]'); await pg.wait_for_timeout(300)
    dub = await E("()=>({view:S.view,tab:S.subs.tab,src:S.subs.src,job:S.ed.clips[1].srv140})")
    chk("…Dub opens the dubbing page on this clip", dub["view"] == "subs" and dub["tab"] == "dub" and dub["src"].get("job") == dub["job"], dub)
    await E("()=>{go('edit');S.ed.sel=S.ed.clips[1].id;S.ed.tab='ai140';renderView()}"); await pg.click('[data-act="ai140"][data-v="lips"]'); await pg.wait_for_timeout(300)
    lips = await E("()=>{const m=M['c_'+S.ed.clips[1].id];return{view:S.view,ls:!!M.lsV&&M.lsV.type,own:!!M.lsV&&M.lsV.url!==m.url,blob:!!M.lsV&&String(M.lsV.url).startsWith('blob:')}}")
    chk("…Lip-sync opens the lip-sync page with this clip (its own copy of the file)", lips["view"] == "voice" and lips["ls"] == "video" and lips["own"] and lips["blob"], lips)
    await E("()=>{go('edit');S.ed.sel=S.ed.clips[1].id;S.ed.tab='ai140';renderView()}"); await pg.click('[data-act="ai140"][data-v="caps"]'); await pg.wait_for_timeout(200)
    chk("…Auto captions opens the captions tab", await E("()=>S.ed.tab") == "words")
    await E("()=>{S.ed.tab='ai140';renderView()}"); await pg.click('[data-act="edai-vo"]'); await pg.wait_for_timeout(200)
    chk("…AI voice-over opens its sheet", await E("()=>!!document.getElementById('edvot')")); await E("()=>{document.getElementById('modalRoot').innerHTML=''}")
    # ---- 4. clean up voices
    dn = await E("""()=>{const SR=48000,n=SR*4,x=new Float32Array(n);let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647*2-1};
      for(let i=0;i<n;i++){const t=i/SR;x[i]=.03*rnd()+((t>=1&&t<2)||(t>=3&&t<3.5)?.5*Math.sin(2*Math.PI*440*t):0)}
      const y=denoise140([x])[0],rms=(a,t0,t1)=>{let e=0;const i0=Math.round(t0*SR),i1=Math.round(t1*SR);for(let i=i0;i<i1;i++)e+=a[i]*a[i];return Math.sqrt(e/(i1-i0))};
      return{noise:[rms(x,.2,.8),rms(y,.2,.8)],tone:[rms(x,1.2,1.8),rms(y,1.2,1.8)],len:y.length===n}}""")
    out["denoise"] = dn; db = lambda a, b: 20 * __import__("math").log10(max(1e-9, b) / max(1e-9, a))
    chk("clean voices: background noise lowered by 10 dB or more where nobody speaks, the voice kept (within 2 dB)", dn["len"] and db(*dn["noise"]) <= -10 and abs(db(*dn["tone"])) <= 2, out["denoise"])
    mx = await E("""async()=>{const E=S.ed;E.clips=[E.clips[1]];E.clips[0].in=0;E.clips[0].out=5;E.clips[0].vol=100;E.clipSound=true;M.edMusic=null;M.edVoice=null;E.sfx=[];E.layers=[];
      const rms=(b,t0,t1)=>{const a=b.getChannelData(0),i0=Math.round(t0*b.sampleRate),i1=Math.round(t1*b.sampleRate);let e=0;for(let i=i0;i<i1;i++)e+=a[i]*a[i];return Math.sqrt(e/(i1-i0))};
      E.clean140=false;const a=await mix139(5);E.clean140=true;const b=await mix139(5);E.clean140=false;return{off:[rms(a,.2,.8),rms(a,1.2,1.8)],on:[rms(b,.2,.8),rms(b,1.2,1.8)]}}""")
    out["mix"] = mx
    chk("…the export's sound: much less hiss in the quiet part, the voice as loud or a little louder", db(mx["off"][0], mx["on"][0]) <= -8 and -2 <= db(mx["off"][1], mx["on"][1]) <= 6, out["mix"])
    await E("()=>{S.ed.tab='audio';renderView()}")
    sw = await E("()=>!!document.querySelector('.clean140 input[data-act=\"clean140\"]')")
    await pg.click('.clean140 label'); await pg.wait_for_timeout(100)
    await E("()=>{ED.playing=true}"); await pg.mouse.click(5, 5); await pg.wait_for_timeout(600)
    live = await E("()=>({on:S.ed.clean140,ctx:audioCtx&&audioCtx.state,routed:VC140.on.has(M['c_'+S.ed.clips[0].id].el)})")
    await pg.click('.clean140 label'); await pg.wait_for_timeout(400)
    live2 = await E("()=>({on:S.ed.clean140,routed:VC140.on.has(M['c_'+S.ed.clips[0].id].el)})"); await E("()=>{ED.playing=false}")
    out["live"] = [sw, live, live2]
    chk("…the switch in the Audio tab: the clip's sound goes through the clean-up while on, and back when off", sw and live["on"] and live["ctx"] == "running" and live["routed"] and not live2["on"] and not live2["routed"], out["live"])
    # ---- 5. subtitle files
    await E("()=>{S.ed.caps.words=edxSpread('hello world this is a test',0.2,3.2).concat(edxSpread('second line here',4,5.5));S.ed.tab='words';renderView();window.__sv=[];saveFile=async(n,d)=>{window.__sv.push([n,await d.text()])}}")
    await pg.click('[data-act="srt140"][data-v="srt"]'); await pg.click('[data-act="srt140"][data-v="vtt"]'); await pg.wait_for_timeout(200)
    sv = await E("()=>__sv")
    out["srt_out"] = sv
    chk("subtitles: Save .srt — numbered cues with hh:mm:ss,mmm times", len(sv) == 2 and sv[0][0].endswith(".srt") and sv[0][1].startswith("1\n00:00:00,200 --> 00:00:03,200\nhello world this is a test\n") and "\n2\n00:00:04,000 --> 00:00:05,500\nsecond line here" in sv[0][1], sv)
    chk("…Save .vtt — WEBVTT with hh:mm:ss.mmm times", len(sv) == 2 and sv[1][1].startswith("WEBVTT\n\n00:00:00.200 --> 00:00:03.200\nhello world"), sv)
    open(D + "/in.srt", "w").write("﻿1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>Good morning</i> everyone\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nسلام عليكم\r\n")
    open(D + "/in.vtt", "w").write("WEBVTT\n\n00:01.500 --> 00:03.000 align:start\nshort form time\n\nNOTE a note\n\n00:00:04.000 --> 00:00:05.000\nlast one\n")
    await pg.set_input_files('[data-srt140]', D + "/in.srt"); await pg.wait_for_timeout(200)
    a1 = await E("()=>({w:S.ed.caps.words.map(x=>x.w),s:S.ed.caps.words[0].s,e:S.ed.caps.words[2].e,s2:S.ed.caps.words[3].s,on:S.ed.caps.on})")
    await pg.set_input_files('[data-srt140]', D + "/in.vtt"); await pg.wait_for_timeout(200)
    a2 = await E("()=>({w:S.ed.caps.words.map(x=>x.w),s:S.ed.caps.words[0].s,e:S.ed.caps.words.at(-1).e})")
    out["srt_in"] = [a1, a2]
    chk("…Import .srt: the words, at the file's times, tags gone, Arabic kept, captions on", a1["w"] == ["Good", "morning", "everyone", "سلام", "عليكم"] and a1["s"] == 1 and abs(a1["e"] - 2.5) < .01 and a1["s2"] == 3 and a1["on"], a1)
    chk("…Import .vtt (short times, settings, notes)", a2["w"] == ["short", "form", "time", "last", "one"] and a2["s"] == 1.5 and abs(a2["e"] - 5) < .01, a2)
    chk("editor (desktop): no errors", not errs, errs)
    await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E(SETUP); await pg.wait_for_timeout(800)
    await E("()=>{edSetPick(null);S.ed.tab='media';renderView()}"); await pg.wait_for_timeout(200)
    r = []
    for v in ("ai", "media", "filters", "text", "audio", "effects", "captions", "trans", "stickers"):
        await E(f"()=>{{const b=document.querySelector('.e-bar [data-act=\"lt143\"][data-v=\"{v}\"]');b.scrollIntoView({{inline:'center',block:'nearest'}});b.click()}}"); await pg.wait_for_timeout(120)
        r.append(await E("()=>{const c=document.querySelector('.e-bar'),cr=c.getBoundingClientRect();return{tab:S.ed.tab,sticky:getComputedStyle(c).position,foot:Math.abs(cr.bottom-innerHeight)<=1,over:document.documentElement.scrollWidth-innerWidth,h:Math.round(cr.height),sheet:!!document.querySelector('.e-sheet .e-body')}}"))
    out["phone"] = r
    chk("phone (v143): every add tool opens from the bar at the foot, its settings in the sheet, no sideways page scroll", [x["tab"] for x in r][:3] == ["chat143", "media", "color"] and all(x["foot"] and x["over"] <= 1 and x["h"] < 70 and x["sheet"] for x in r), r)   # (v151: the studio — the bar is the foot of the screen, not fixed over a page)
    await E("()=>{S.ed.tab='ai140';renderView()}"); await pg.wait_for_timeout(300)
    # (v151: the studio — the page never scrolls; the panel scrolls inside itself, the bar is the foot of the screen, no site menu)
    pin = await E("""()=>{const m=document.getElementById('main'),b=document.querySelector('.e-sheet .e-body'),q=s=>{const r=document.querySelector(s).getBoundingClientRect();return[Math.round(r.top),Math.round(r.bottom)]};const a=q('.e-bar');m.scrollTop=m.scrollHeight;b.scrollTop=b.scrollHeight;
      const last=[...document.querySelectorAll('.edxpanel .ai140c')].pop().getBoundingClientRect();return{before:a,cat:q('.e-bar'),nav:getComputedStyle(document.querySelector('.bottomnav')).display,stage:q('.edstage'),last:Math.round(last.bottom),vh:innerHeight,ms:m.scrollTop}}""")
    out["phone_pin"] = pin
    chk("phone: the tool bar is the foot of the screen, scrolled or not (no site menu under it); the preview stays at the top", pin["before"] == pin["cat"] and abs(pin["cat"][1] - pin["vh"]) <= 1 and pin["nav"] == "none" and pin["stage"][0] <= 120 and pin["ms"] == 0, pin)   # (under the top bar, and the one-line notice when another device changed the project)
    chk("…and the last tool can be scrolled up above that bar", pin["last"] <= pin["cat"][0], pin)
    await E("()=>{document.getElementById('main').scrollTop=0}")
    w = await E("()=>{const p=document.querySelector('.edxpanel');return[...p.querySelectorAll('.ai140c')].every(c=>c.getBoundingClientRect().right<=innerWidth+1)}")
    chk("phone: the AI tools cards fit the screen", w)
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
