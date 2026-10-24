# v146: the timeline, written again in one piece. Same marks as before (the lanes, labels, waveforms and tools the old page put
# there in pieces), and new: several items selected at once (Shift/Ctrl/⌘ click, or "Select more" on a phone), groups that are
# picked and moved together, copy & paste (Ctrl/⌘ C · X · V, the buttons and the menus), markers on the ruler (M, [ and ], drag,
# a name, undo) and beat marks found in the music on the device — edges snap to markers, beats and clip edges.
# Computer and phone, EN + AR, nothing covered, no element id twice, no page errors.
# Run: python3 tests/v146.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8404
D = tempfile.mkdtemp(prefix="nooi-v146-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", M + "a.webm")
# music with a beat: a short click every half second (120 a minute), the first at 0.1 s, under a quiet hum
FF("-f", "lavfi", "-i", "aevalsrc='0.05*sin(2*PI*110*t)+0.9*sin(2*PI*1500*t)*exp(-60*mod(t-0.1+10,0.5))*gte(mod(t-0.1+10,0.5),0)*lt(mod(t-0.1+10,0.5),0.12)':s=44100:d=12", "-c:a", "pcm_s16le", M + "beat.wav")
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Beach',title:'Beach at sunset',created:now,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];M.edMusic=null;S.ed.marks146=[];S.ed.groups146=[];S.ed.ms146=[];S.ed.beats146=null;
 try{localStorage.removeItem('nooi.cb146')}catch(e){}CB146=null;
 await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});
 const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'talk.webm',{type:'video/webm'})]);
 S.ed.texts=[{id:'t1',text:'ONE',start:1,end:2.5,pos:'bottom',style:'caption',size:7,anim:'pop'},{id:'t2',text:'TWO',start:3,end:4,pos:'top',style:'caption',size:7,anim:'pop'}];
 S.ed.infos=[{id:'i1',type:'lower',t1:'NAME',t2:'',start:5,end:7,x:.5,y:.8,accent:'#CFE13E'}];S.ed.vfx=[{id:'v1',kind:'rain',start:8,end:10,amt:60}];
 const w=await (await fetch('/media/beat.wav')).blob();loadSlot('edMusic',new File([w],'beat.wav',{type:'audio/wav'}));
 S.ed.zoom=40;S.ed.snap141=false;S.ed.tab='media';edSetPick(null);go('edit');renderAll()}"""
READY = "S.ed.clips.length===3&&document.querySelector('.ed143 #wk')&&M.edMusic&&S.ed.clips.every(c=>{const m=clipMedia(c);return m&&srcReady(m)})"
SCAN = open(os.path.join(ROOT, "tests", "v144.py")).read().split('SCAN = r"""', 1)[1].split('"""', 1)[0]
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))

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

ST = "()=>({ms:(S.ed.ms146||[]).slice().sort(),g:(S.ed.groups146||[]).map(g=>g.keys.slice().sort()),pk:S.ed.pick&&S.ed.pick.k+':'+S.ed.pick.id,dom:[...document.querySelectorAll('#tlin .blk.ms146')].length,gb:document.querySelectorAll('#tlin .gpb146').length})"
async def drag(pg, sel, dx, steps=8, dy=0):
    r = await pg.evaluate("(s)=>{const b=document.querySelector(s).getBoundingClientRect();return[b.left+b.width/2,b.top+b.height/2]}", sel)
    await pg.mouse.move(r[0], r[1]); await pg.mouse.down(); await pg.mouse.move(r[0] + dx, r[1] + dy, steps=steps); await pg.mouse.up(); await pg.wait_for_timeout(300)
async def scrollto(pg, sel):
    await pg.evaluate("(s)=>{const b=document.querySelector(s),w=b.closest('.tlwrap');w.scrollLeft=Math.max(0,b.offsetLeft-60);b.scrollIntoView({block:'nearest'})}", sel); await pg.wait_for_timeout(120)

async def desktop(b, lang):
    tag = f"desktop {lang}"; ctx, pg, errs = await open_page(b, 1280, 900, lang, False); E = pg.evaluate; ar = lang == "ar"
    # ---- the same timeline as before: lanes, labels, playhead, tools
    tl = await E("()=>({tn:[...document.querySelectorAll('#tlin .trk .tn')].map(x=>x.textContent).filter(Boolean),v:document.querySelectorAll('#tlin .blk.v[data-clip]').length,t:document.querySelectorAll('#tlin [data-trk=\"t\"] .blk.t[data-textl]').length,a:!!document.querySelector('#tlin [data-trk=\"a\"] .blk.a'),ix:(document.querySelector('#tlin .blk.ix[data-ix=\"i1\"]')||{}).textContent,vx:!!document.querySelector('#tlin .blk.vx[data-vx=\"v1\"]'),ph:!!document.querySelector('#tlin #ph.ph'),ruler:document.querySelectorAll('#tlin .ruler span').length,bar:[...document.querySelectorAll('.e-tl .edbar .tb')].map(x=>x.dataset.act)})")
    chk(f"{tag}: the timeline has its lanes (V · T · ♪ · VX · IN), labels, ruler and playhead", tl["tn"][:3] == ["V", "T", "♪"] and "VX" in tl["tn"] and "IN" in tl["tn"] and tl["v"] == 3 and tl["t"] == 2 and tl["a"] and tl["ix"] == "NAME" and tl["vx"] and tl["ph"] and tl["ruler"] >= 15, tl)
    chk(f"{tag}: the tool row: undo · redo · earlier · split · duplicate · extend · later · delete · copy · paste · marker · select more · snap", tl["bar"] == ["ed-undo", "ed-redo", "ed-move", "ed-split", "ed-dup", "ed-extend91", "ed-move", "ed-del", "cp146", "pa146", "mk146-add", "msm146", "snap141"], tl["bar"])
    sn = await E("()=>{const p=snapPts141(null),st=edStarts();return{c1:p.some(x=>Math.abs(x-st[1])<1e-6),c2:p.some(x=>Math.abs(x-st[2])<1e-6)}}")
    chk(f"{tag}: edges snap to clip edges too (they were left out before)", sn["c1"] and sn["c2"], sn)
    # ---- several selected: click, then Shift + click
    await scrollto(pg, '[data-textl="t1"]'); await pg.click('#tlin [data-textl="t1"]'); await pg.wait_for_timeout(200)
    await pg.click('#tlin [data-textl="t2"]', modifiers=["Shift"]); await pg.wait_for_timeout(200)
    await scrollto(pg, '[data-ix="i1"]'); await pg.click('#tlin [data-ix="i1"]', modifiers=["Shift"]); await pg.wait_for_timeout(300)
    s = await E(ST); bar = await E("()=>({n:(document.querySelector('.edbar .msn146')||{}).textContent||'',acts:[...document.querySelectorAll('.edbar .tb')].map(x=>x.dataset.act)})")
    chk(f"{tag}: Shift + click selects several (three highlighted, the tool row says how many)", s["ms"] == ["info:i1", "text:t1", "text:t2"] and s["dom"] == 3 and ("3" in bar["n"]) and {"gp146", "ms146-del", "ms146-clr", "cp146"} <= set(bar["acts"]) and "ed-split" not in bar["acts"], {"s": s, "bar": bar})
    await pg.click('#tlin [data-ix="i1"]', modifiers=["Shift"]); await pg.wait_for_timeout(250)
    s = await E(ST); chk(f"{tag}: Shift + click again takes one out", s["ms"] == ["text:t1", "text:t2"], s)
    await pg.click('#tlin [data-ix="i1"]', modifiers=["Shift"]); await pg.wait_for_timeout(250)
    # ---- dragging one moves them all
    before = await E("()=>[S.ed.texts[0].start,S.ed.texts[1].start,S.ed.infos[0].start]")
    await scrollto(pg, '[data-textl="t1"]'); await drag(pg, '#tlin [data-textl="t1"]', 80)
    after = await E("()=>[S.ed.texts[0].start,S.ed.texts[1].start,S.ed.infos[0].start]"); s = await E(ST)
    chk(f"{tag}: dragging one of the selection moves all of them by the same time (2 s)", all(abs((a - b_) - 2) < .15 for a, b_ in zip(after, before)) and len(s["ms"]) == 3, {"before": before, "after": after, "s": s})
    # ---- a group: picked together
    await E("()=>document.querySelector('.edbar [data-act=\"gp146\"]').click()"); await pg.wait_for_timeout(250)
    await E("()=>document.querySelector('.edbar [data-act=\"ms146-clr\"]').click()"); await pg.wait_for_timeout(200)
    await E("()=>{edSetPick(null);renderView()}"); await pg.wait_for_timeout(150)
    await scrollto(pg, '[data-textl="t2"]'); await pg.click('#tlin [data-textl="t2"]'); await pg.wait_for_timeout(300); s = await E(ST)
    chk(f"{tag}: Group — a plain click on one picks the whole group (each shows the group mark)", len(s["g"]) == 1 and s["ms"] == ["info:i1", "text:t1", "text:t2"] and s["gb"] == 3, s)
    # ---- copy & paste at the playhead (the copy of a group is a group of its own)
    await E("()=>{ED.t=12}"); await pg.keyboard.press("Control+c"); await pg.wait_for_timeout(200)
    await pg.keyboard.press("Control+v"); await pg.wait_for_timeout(400)
    ps = await E("()=>({n:[S.ed.texts.length,S.ed.infos.length],st:S.ed.texts.slice(2).map(t=>t.start).concat(S.ed.infos.slice(1).map(t=>t.start)),g:S.ed.groups146.length,ms:(S.ed.ms146||[]).length,cb:CB146.items.length})")
    chk(f"{tag}: Ctrl/⌘ C then V pastes the three at the playhead, as a new group, selected", ps["n"] == [4, 2] and abs(min(ps["st"]) - 12) < .05 and ps["g"] == 2 and ps["ms"] == 3 and ps["cb"] == 3, ps)
    await pg.keyboard.press("Delete"); await pg.wait_for_timeout(300)
    dl = await E("()=>({n:[S.ed.texts.length,S.ed.infos.length],g:S.ed.groups146.length,ms:(S.ed.ms146||[]).length})")
    chk(f"{tag}: Delete removes the whole selection (and its group)", dl == {"n": [2, 1], "g": 1, "ms": 0}, dl)
    await pg.keyboard.press("Control+z"); await pg.wait_for_timeout(300); un = await E("()=>[S.ed.texts.length,S.ed.infos.length,S.ed.groups146.length]")
    chk(f"{tag}: undo brings the deleted selection and its group back", un == [4, 2, 2], un)
    await E("()=>{const g=S.ed.groups146[1];S.ed.texts=S.ed.texts.slice(0,2);S.ed.infos=S.ed.infos.slice(0,1);tidy146();edSetPick(null);persist();renderView()}")
    await scrollto(pg, '[data-textl="t2"]'); await pg.click('#tlin [data-textl="t2"]'); await pg.wait_for_timeout(200)
    await pg.keyboard.press("Control+Shift+g"); await pg.wait_for_timeout(250); s = await E(ST)
    chk(f"{tag}: Ctrl/⌘ Shift G ungroups", s["g"] == [] and s["gb"] == 0, s)
    # ---- a clip copied and pasted goes in after the clip under the playhead, with its file
    await E("()=>{edSetPick(null);renderView()}"); await scrollto(pg, '#tlin .blk.v[data-clip]')
    await pg.click('#tlin .blk.v[data-clip]'); await pg.wait_for_timeout(200)
    await pg.keyboard.press("Control+c"); await E("()=>{ED.t=edStarts()[2]+1}"); await pg.keyboard.press("Control+v"); await pg.wait_for_timeout(500)
    cp = await E("()=>{const c=S.ed.clips;return{n:c.length,src:c[3]&&c[3].src.k,ready:!!(c[3]&&clipMedia(c[3])&&srcReady(clipMedia(c[3]))),last:S.ed.pick&&S.ed.pick.id===c[3].id}}")
    chk(f"{tag}: a copied clip is pasted after the clip under the playhead, ready to play", cp["n"] == 4 and cp["ready"] and cp["last"], cp)
    await E("()=>{S.ed.clips.splice(3,1);edSetPick(null);persist();renderView()}")
    # ---- markers: M at the playhead, ] / [ to jump, a name, drag to move, Delete, undo
    await E("()=>{ED.t=3;document.activeElement&&document.activeElement.blur()}"); await pg.keyboard.press("m"); await pg.wait_for_timeout(250)
    await E("()=>{ED.t=6.5}"); await pg.keyboard.press("m"); await pg.wait_for_timeout(250)
    mk = await E("()=>({t:S.ed.marks146.map(m=>m.t),dom:document.querySelectorAll('#tlin .ruler .mk146').length,line:document.querySelectorAll('#tlin .mkl146').length,inp:!!document.querySelector('.edbar [data-mk146n]'),sel:S.ed.selMk146===S.ed.marks146[1].id})")
    chk(f"{tag}: M adds a marker at the playhead (a flag on the ruler, a line down the tracks, its name in the tool row)", mk["t"] == [3, 6.5] and mk["dom"] == 2 and mk["line"] == 2 and mk["inp"] and mk["sel"], mk)
    await pg.fill('.edbar [data-mk146n]', "Drop" if not ar else "الذروة"); await pg.wait_for_timeout(150)
    nm = await E("()=>S.ed.marks146[1].n"); chk(f"{tag}: a marker takes a name", nm == ("Drop" if not ar else "الذروة"), nm)
    await E("()=>{ED.t=0;document.activeElement&&document.activeElement.blur()}"); await pg.keyboard.press("]"); await pg.wait_for_timeout(150); j1 = await E("()=>ED.t")
    await pg.keyboard.press("]"); await pg.wait_for_timeout(150); j2 = await E("()=>ED.t"); await pg.keyboard.press("["); await pg.wait_for_timeout(150); j3 = await E("()=>ED.t")
    chk(f"{tag}: ] and [ jump to the next and previous marker", [j1, j2, j3] == [3, 6.5, 3], [j1, j2, j3])
    await scrollto(pg, '#tlin .mk146'); await drag(pg, '#tlin .mk146', 40, steps=6, dy=0); mv = await E("()=>S.ed.marks146.map(m=>m.t)")
    chk(f"{tag}: dragging a marker moves it (3 s → 4 s)", abs(mv[0] - 4) < .1, mv)
    await E("()=>{edSetPick(null);S.ed.selMk146=S.ed.marks146[0].id;renderView();document.activeElement&&document.activeElement.blur()}"); await pg.keyboard.press("Delete"); await pg.wait_for_timeout(200)
    md = await E("()=>S.ed.marks146.length"); await pg.keyboard.press("Control+z"); await pg.wait_for_timeout(250); mu = await E("()=>S.ed.marks146.length")
    chk(f"{tag}: Delete removes the selected marker; undo brings it back", md == 1 and mu == 2, [md, mu])
    # ---- beat marks from the music (on this device, free)
    await scrollto(pg, '#tlin [data-trk="a"] .blk.a'); await pg.click('#tlin [data-trk="a"] .blk.a'); await pg.wait_for_timeout(400)
    has = await E("()=>!!document.querySelector('.e-details [data-act=\"bt146\"]')"); chk(f"{tag}: the music's details offer Beat marks", has)
    await E("()=>document.querySelector('.e-details [data-act=\"bt146\"]').click()"); await pg.wait_for_function("S.ed.beats146&&S.ed.beats146.t.length>5", timeout=15000); await pg.wait_for_timeout(300)
    bt = await E("()=>{const b=S.ed.beats146,t=b.t,d=t.slice(1).map((x,i)=>x-t[i]);return{bpm:b.bpm,first:t[0],gaps:[Math.min(...d),Math.max(...d)],n:t.length,dom:document.querySelectorAll('#tlin .ruler .bt146').length,pressed:(document.querySelector('.e-details [data-act=\"bt146\"]')||{}).getAttribute?.('aria-pressed'),snap:snapPts141(null).filter(p=>Math.abs(((p-0.1)%0.5+0.5)%0.5)<.03||Math.abs(((p-0.1)%0.5+0.5)%0.5-0.5)<.03).length}}")
    chk(f"{tag}: beat marks — 120 a minute, one each half second on the clicks, on the ruler, edges snap to them", 118 <= bt["bpm"] <= 122 and abs(bt["first"] - .1) < .03 and .47 <= bt["gaps"][0] and bt["gaps"][1] <= .53 and bt["n"] >= 20 and bt["dom"] >= 20 and bt["pressed"] == "true" and bt["snap"] >= 20, bt)
    # a text's edge dropped near a beat sticks to it
    await E("()=>{S.ed.snap141=true;edSetPick(null);renderView()}"); await scrollto(pg, '[data-textl="t1"]')
    t1 = await E("()=>S.ed.texts[0].start"); tgt = round((int((t1 - .1) / .5) + 1) * .5 + .1, 2)
    await drag(pg, '#tlin [data-textl="t1"]', (tgt - t1) * 40 + 3, steps=10)
    t1b = await E("()=>S.ed.texts[0].start"); chk(f"{tag}: a text dragged near a beat snaps onto it", abs(t1b - tgt) < .011, {"from": t1, "target": tgt, "got": t1b})
    # ---- the menu (right click) on a selection of several
    await E("()=>{edSetPick('text','t1');S.ed.ms146=['text:t1','text:t2'];renderView()}"); await pg.wait_for_timeout(200)
    await scrollto(pg, '[data-textl="t2"]'); await pg.click('#tlin [data-textl="t2"]', button="right"); await pg.wait_for_timeout(300)
    menu = await E("()=>[...document.querySelectorAll('.cm131 .cm131i span')].map(x=>x.textContent)")
    chk(f"{tag}: the menu of a selection works on all of it (copy · group · delete 2)", len(menu) == 4 and any("2" in x for x in menu[:1]) and any("2" in x for x in menu[3:]), menu)
    await E("()=>{cmClose131()}")
    # ---- nothing covered, nothing twice
    await scan(pg, tag, [("several selected", "()=>{edSetPick('text','t1');S.ed.ms146=['text:t1','text:t2','info:i1'];renderView()}"),
                         ("a marker selected", "()=>{edSetPick(null);S.ed.ms146=[];S.ed.selMk146=S.ed.marks146[0].id;renderView()}"),
                         ("beats and markers, nothing selected", "()=>{edSetPick(null);S.ed.selMk146=null;renderView()}")])
    chk(f"{tag}: no page errors", not errs, errs); await ctx.close()

async def phone(b, lang):
    tag = f"phone {lang}"; ctx, pg, errs = await open_page(b, 390, 844, lang, True); E = pg.evaluate
    bar = lambda: E("()=>[...document.querySelectorAll('.ed143 .e-bar>button,.ed143 .e-bar>label')].map(x=>x.dataset.act||x.className)")
    await scrollto(pg, '[data-textl="t1"]'); await pg.tap('#tlin [data-textl="t1"]'); await pg.wait_for_timeout(400)
    b1 = await bar(); chk(f"{tag}: a text's tools at the foot include Copy and Select more", "cp146" in b1 and "msm146" in b1, b1)
    await E("()=>{S.ed.pclosed143=S.ed.tab;renderView()}"); await pg.wait_for_timeout(200)
    await pg.tap('.ed143 .e-bar [data-act="msm146"]'); await pg.wait_for_timeout(300)
    await scrollto(pg, '[data-textl="t2"]'); await pg.tap('#tlin [data-textl="t2"]'); await pg.wait_for_timeout(400)
    s = await E(ST); b2 = await bar(); sheet = await E("()=>!!document.querySelector('.ed143 .e-sheet')")
    chk(f"{tag}: Select more, then a tap adds to the selection (the bar shows the selection's tools, no settings sheet)", s["ms"] == ["text:t1", "text:t2"] and {"gp146", "cp146", "ms146-del"} <= set(b2) and not sheet, {"s": s, "bar": b2, "sheet": sheet})
    await pg.tap('.ed143 .e-bar [data-act="gp146"]'); await pg.wait_for_timeout(300); s = await E(ST)
    chk(f"{tag}: Group from the bar", len(s["g"]) == 1, s)
    await pg.tap('.ed143 .e-bar [data-act="cp146"]'); await pg.wait_for_timeout(200)
    await pg.tap('.ed143 .e-bar [data-act="ms146-clr"]'); await pg.wait_for_timeout(300)
    await E("()=>{edSetPick(null);S.ed.aux143=null;S.ed.tab='media';S.ed.pclosed143='media';renderView()}"); await pg.wait_for_timeout(250)
    b3 = await bar(); chk(f"{tag}: with nothing selected the bar has Marker and Paste", "mk146-add" in b3 and "pa146" in b3, b3)
    await E("()=>{ED.t=2}"); await pg.tap('.ed143 .e-bar [data-act="mk146-add"]'); await pg.wait_for_timeout(300)
    b4 = await bar(); mk = await E("()=>({n:S.ed.marks146.length,inp:!!document.querySelector('.ed143 .e-bar [data-mk146n]')})")
    chk(f"{tag}: Marker adds one at the playhead; the bar then shows its name, previous · next · delete", mk["n"] == 1 and mk["inp"] and {"mk146-go", "mk146-del"} <= set(b4), {"mk": mk, "bar": b4})
    await pg.tap('.ed143 .e-bar [data-act="mk146-x"]'); await pg.wait_for_timeout(200)
    await E("()=>{ED.t=9}"); await pg.tap('.ed143 .e-bar [data-act="pa146"]'); await pg.wait_for_timeout(400)
    pa = await E("()=>({n:S.ed.texts.length,g:S.ed.groups146.length,st:S.ed.texts.slice(2).map(t=>t.start)})")
    chk(f"{tag}: Paste puts the copied group at the playhead", pa["n"] == 4 and pa["g"] == 2 and abs(min(pa["st"]) - 9) < .05, pa)
    # a long press on a text: Copy and Select more are in its menu
    await E("()=>{edSetPick(null);S.ed.ms146=[];S.ed.groups146=[];renderView()}"); await scrollto(pg, '[data-textl="t1"]')
    r = await E("()=>{const b=document.querySelector('#tlin [data-textl=\"t1\"]').getBoundingClientRect();return[b.left+b.width/2,b.top+b.height/2]}")
    cdp = await ctx.new_cdp_session(pg)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": r[0], "y": r[1]}]}); await pg.wait_for_timeout(800)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(300)
    menu = await E("()=>[...document.querySelectorAll('.cm131 .cm131i')].map(x=>x.textContent)")
    chk(f"{tag}: a long press on a text offers Copy and Select more", any(("Copy" in x or "نسخ" in x) for x in menu) and any(("Select more" in x or "تحديد المزيد" in x) for x in menu), menu)
    await E("()=>cmClose131()")
    # the music selected: Beat marks in its bar
    await E("()=>{edSetPick(null);S.ed.aux143='music';S.ed.tab='audio';S.ed.pclosed143='audio';renderView()}"); await pg.wait_for_timeout(250); b5 = await bar()
    chk(f"{tag}: the music's bar has Beat marks", "bt146" in b5, b5)
    await scan(pg, tag, [("several selected", "()=>{S.ed.aux143=null;edSetPick('text','t1');S.ed.ms146=['text:t1','text:t2'];renderView()}"),
                         ("a marker selected", "()=>{edSetPick(null);S.ed.ms146=[];S.ed.selMk146=S.ed.marks146[0].id;S.ed.pclosed143=S.ed.tab;renderView()}"),
                         ("nothing selected", "()=>{edSetPick(null);S.ed.selMk146=null;renderView()}")])
    chk(f"{tag}: no page errors", not errs, errs); await ctx.close()

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
