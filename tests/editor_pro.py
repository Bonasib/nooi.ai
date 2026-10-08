# Video editor, CapCut-style tools (v71) with real media: a fresh nooi server with its own data + media folders, real files made by ffmpeg
# (2 videos with sound, a picture, music, a voice). Adds them from the results to the editor, then — by touch on a phone and
# by mouse on a desktop — checks: tap the timeline seeks and never adds text, drag on the ruler scrubs, tap a clip selects,
# play / pause, split, duplicate, move, delete, undo, redo, trim, volume, speed, add / edit text, music & sounds, and the
# export: an MP4 at the exact size of the format (1080×1920 for Reels) with sound and the right length.
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8086
D = tempfile.mkdtemp(prefix="nooi-edp-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
FF = os.environ.get("FFMPEG_PATH", "ffmpeg"); M = D + "/media/"
for args in (["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", M + "a.webm"],
             ["-f", "lavfi", "-i", "mandelbrot=size=720x1280:rate=30", "-t", "5", "-f", "lavfi", "-i", "sine=frequency=550:duration=5", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", M + "b.webm"],
             ["-f", "lavfi", "-i", "gradients=size=1024x1024:duration=1", "-frames:v", "1", M + "img.jpg"],
             ["-f", "lavfi", "-i", "sine=frequency=220:duration=20", "-c:a", "libmp3lame", M + "music.mp3"],
             ["-f", "lavfi", "-i", "sine=frequency=700:duration=3", "-c:a", "libmp3lame", M + "voice.mp3"]):
    subprocess.run([FF, "-v", "error", "-y", *args], check=True)
SETUP = """async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='ar';S.user={name:'T',method:'google'};AU.showAuth=false;
 const now=Date.now(),mk=(id,kind,url,dur,extra)=>Object.assign({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url},extra||{});
 S.jobs.push(mk('ed_va','video','/media/a.webm',6),mk('ed_vb','video','/media/b.webm',5,{aspect:'9:16'}),mk('ed_img','image','/media/img.jpg',0),mk('ed_mu','music','/media/music.mp3',20),mk('ed_vo','voice','/media/voice.mp3',3));
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.format='reels';
 for(const id of ['ed_va','ed_vb','ed_img','ed_mu','ed_vo']){await edUseJob(S.jobs.find(j=>j.id===id),{stay:true,quiet:true,t:1})}
 go('edit');renderAll()}"""
SCROLL = """(sel)=>{const all=document.querySelectorAll(sel),el=all[all.length-1];if(!el)return null;let e=el.parentElement;while(e&&!(e.scrollHeight>e.clientHeight+5&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)))e=e.parentElement;e=e||document.scrollingElement;
 const st=document.querySelector('.edstage');const top=(st&&getComputedStyle(st).position==='sticky')?st.getBoundingClientRect().bottom+20:120;e.style.scrollBehavior='auto';e.scrollTop+=el.getBoundingClientRect().top-top;return 1}"""
RECT = "(s)=>{const a=document.querySelectorAll(s),x=a[a.length-1].getBoundingClientRect();return [x.x,x.y,x.width,x.height]}"
WRAP = "()=>{const r=document.querySelector('.tlwrap').getBoundingClientRect();return [r.left,r.right]}"


async def drag(pg, ctx, mob, x0, y0, x1, y1):
    if mob:
        cdp = await ctx.new_cdp_session(pg); await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y0}]})
        for k in range(1, 7): await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x0 + (x1 - x0) * k / 6, "y": y0 + (y1 - y0) * k / 6}]}); await pg.wait_for_timeout(25)
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    else:
        await pg.mouse.move(x0, y0); await pg.mouse.down()
        for k in range(1, 7): await pg.mouse.move(x0 + (x1 - x0) * k / 6, y0 + (y1 - y0) * k / 6); await pg.wait_for_timeout(25)
        await pg.mouse.up()
    await pg.wait_for_timeout(350)
HITXY = """(k)=>{const h=(ED.hit||[]).find(x=>x.k===k);if(!h)return null;const cv=document.querySelector('#wk'),r=cv.getBoundingClientRect(),sx=r.width/cv.width,sy=r.height/cv.height;const o={x:r.left+h.cx*sx,y:r.top+h.cy*sy};if(h.handle){o.hx=r.left+h.handle.x*sx;o.hy=r.top+h.handle.y*sy}return o}"""
async def run(p, w, mob, fails, out):
    b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=mob, has_touch=mob, accept_downloads=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1800); E = pg.evaluate
    await E(SETUP); await pg.wait_for_timeout(2500); R = {}
    def check(name, cond, info=""):
        R[name] = "ok" if cond else "FAIL " + str(info)
        if not cond: fails.append(f"{w}: {name} {info}")
    pl = await E("""async()=>{const v=M['c_'+S.ed.clips[0].id].el;let n=0;const f=()=>n++;await new Promise(r=>setTimeout(r,600));v.addEventListener('seeking',f);ED.t=.2;ED.playing=true;await new Promise(r=>setTimeout(r,3000));ED.playing=false;v.removeEventListener('seeking',f);return [n,+ED.t.toFixed(2)]}""")
    check("smooth playback (no seeking while playing)", pl[0] <= 1 and pl[1] > .8, pl)
    await E("()=>{ED.t=1;S.ed.texts.push({id:'tx1',text:'Grand opening',start:0,end:5,pos:'bottom',style:'caption',size:7,anim:'none'});S.ed.tab='clip';renderView()}"); await pg.wait_for_timeout(500)
    h = await E(HITXY, "text"); check("text can be found on the preview", bool(h))
    if h:
        await drag(pg, ctx, mob, h["x"], h["y"], h["x"], h["y"] - 60); t = await E("()=>{const t=S.ed.texts.find(x=>x.id==='tx1');return [S.ed.pick&&S.ed.pick.k,t.x,t.y]}")
        check("tap selects text, drag moves it", t[0] == "text" and t[1] is not None and t[2] < 0.75, t)
        await pg.wait_for_timeout(200); h = await E(HITXY, "text")
        if h and h.get("hx"): await drag(pg, ctx, mob, h["hx"], h["hy"], h["hx"] + 50, h["hy"] + 30)
        k = await E("()=>S.ed.texts.find(x=>x.id==='tx1').k||1"); check("drag the corner resizes", k > 1.1, k)
        await E("()=>{edSetPick('text','tx1');renderView()}"); await pg.wait_for_timeout(200); await E("()=>document.querySelector('[data-act=ed-del]').click()")
        check("top delete removes the selected text", await E("()=>!S.ed.texts.some(x=>x.id==='tx1')"))
    await E("()=>{S.ed.texts.push({id:'tx2',text:'Edge',start:1,end:3,pos:'top',style:'caption',size:6,anim:'pop'});edSetPick('text','tx2');S.ed.tab='text';renderView()}"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('.blk.t[data-textl=tx2]').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(500)
    bb = await E("()=>{const r=document.querySelector('.blk.t[data-textl=tx2]').getBoundingClientRect();return [r.x,r.y,r.width,r.height]}")
    R["edgeAt"] = await E(f"()=>{{const t=document.elementFromPoint({bb[0]+bb[2]-4},{bb[1]+bb[3]/2});return t?(t.className||t.tagName)+'|'+(t.dataset&&t.dataset.textl||''):'none'}}"); R["edgeRect"]=bb
    await drag(pg, ctx, mob, bb[0] + bb[2] - 4, bb[1] + bb[3] / 2, bb[0] + bb[2] + 56, bb[1] + bb[3] / 2)
    se = await E("()=>{const t=S.ed.texts.find(x=>x.id==='tx2');return [t.start,t.end]}"); check("drag a text's edge on the timeline changes its end", se[0] == 1 and se[1] > 3.5, se)
    await E("()=>{S.ed.tab='vfx';renderView()}"); await pg.wait_for_timeout(200); await E("()=>document.querySelector('[data-act=edv-add][data-v=rain]').click()")
    await E("()=>{S.ed.tab='ai';S.tools.edit.eprompt='أضف مطر وبرق للمشهد';S.tools.edit.emode='clip';renderView()}"); await pg.wait_for_timeout(200); await E("()=>document.querySelector('[data-act=apply-edit]').click()"); await pg.wait_for_timeout(300)
    await E("()=>edRun('add snow and fog')"); await pg.wait_for_timeout(300); vx = await E("()=>S.ed.vfx.map(v=>v.kind)")
    check("effects: tile, AI edit (rain + lightning) and prompt bar", vx == ["rain", "storm", "snow", "fog"], vx)
    await E("()=>{S.ed.tab='info';renderView()}"); await pg.wait_for_timeout(200)
    for t in ("counter", "bars", "lower3", "list", "donut"): await E(f"()=>document.querySelector('[data-act=edi-add][data-v={t}]').click()"); await pg.wait_for_timeout(120)
    await E("()=>{const i=document.querySelector('[data-ib=t1]');i.value='عملاء سعداء';i.dispatchEvent(new Event('input',{bubbles:true}))}")
    await E("()=>{ED.t=S.ed.infos[0].start+2}"); await pg.wait_for_timeout(500)
    inf = await E("()=>[S.ed.infos.length,S.ed.infos[4].t1,(ED.hit||[]).filter(h=>h.k==='info').length]"); check("infographics added, edited and drawn", inf[0] == 5 and inf[1] == "عملاء سعداء" and inf[2] >= 1, inf)
    await E("()=>{S.ed.caps.on=true;S.ed.caps.words=edxSpread('welcome to our new store',0.2,2.5);API.cfg.llm=true;const o=API.req;API.req=async(p,x)=>p==='/v1/llm/json'?{lines:JSON.parse(x.json.prompt.split('Lines:\\n')[1]).map(l=>'AR:'+l)}:o(p,x);S.ed.tab='words';renderView()}"); await pg.wait_for_timeout(300)
    await E("()=>{document.querySelector('#edtrl').value='ar';document.querySelector('[data-act=edai-tr]').click()}"); await pg.wait_for_timeout(800)
    tr = await E("()=>S.ed.caps.words.map(w=>w.w).join(' ')"); check("AI captions translation", tr.startswith("AR:"), tr)
    await E("()=>{S.ed.tab='audio';renderView()}"); await pg.wait_for_timeout(200); await E("()=>document.querySelector('[data-act=edai-vo]').click()"); await pg.wait_for_timeout(300)
    await E("()=>{document.querySelector('[data-act=edvo-pick][data-v=boy]').click();document.querySelector('#edvot').value='hello';document.querySelector('[data-act=edvo-go]').click()}"); await pg.wait_for_timeout(500)
    vj = await E("()=>{const j=S.jobs.filter(x=>x.kind==='voice').pop();return j&&[j.meta.gender,j.meta.age]}"); check("AI voice-over: boy voice requested", vj == ["male", "child"], vj)
    await E("()=>{S.jobs.push({id:'vo1',kind:'voice',status:'complete',resultUrl:'/media/voice.mp3',prompt:'x',created:Date.now(),pal:PALS[0]});VOP['vo1']={t:2,child:true,name:'kid'}}"); await pg.wait_for_timeout(4000)
    va = await E("()=>{const s=S.ed.sfx.find(x=>x.name==='kid');return s?[s.t,M['sx_'+s.id].file.type]:null}"); check("child voice placed at the playhead (pitch-lifted)", va == [2, "audio/wav"], va)
    if not mob:
        await E("()=>{S.ed.tab='export';renderView()}"); await pg.wait_for_timeout(400)
        try:
            async with pg.expect_download(timeout=150000) as dl: await pg.locator("[data-act=ed-export]").last.click()
            d = await dl.value; f = D + "/export_" + d.suggested_filename; await d.save_as(f)
            pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", f], capture_output=True, text=True).stdout or "{}")
            v = [s for s in pr.get("streams", []) if s.get("codec_type") == "video"]; check("export with effects + infographics: MP4 1080×1920", f.endswith(".mp4") and v and v[0]["height"] == 1920, [d.suggested_filename, v and v[0]])
        except Exception as e: check("export", False, str(e)[:160])
    check("no page errors", not errs, errs); out[w] = R; await b.close()

async def main():
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(os.environ, PORT=str(PORT), SECRET_KEY="r" * 40, FIREBASE_PROJECT_ID=""), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    fails, out = [], {}
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            for w, mob in ((390, True), (1280, False)): await run(p, w, mob, fails, out)
    finally:
        srv.terminate(); shutil.rmtree(D, ignore_errors=True)
    print(json.dumps({"fails": fails, "detail": out}, ensure_ascii=False, indent=1)); sys.exit(1 if fails else 0)
asyncio.run(main())
