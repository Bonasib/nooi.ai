# v207 — motion scenes on a phone: fast, one after another, with your own pictures and videos.
#  · on a phone the preview draws at 540 on the long side (Auto) and skips soft shadows inside the scenes; a size picked by hand stays
#  · while the preview plays, the page still answers at once (frames get a gap when they are costly)
#  · a new scene goes after the scenes already there; an empty timeline gets a background clip; "Line them up" fixes overlaps
#  · the chosen scene's settings come first, with a "Pictures & videos" box; several files at once (pictures and a video)
#  · the time under the preview isn't covered by the buttons
#  · a video in a box: the preview shows its frame for the moment, and the exported file has the right frame at each time
# Run: python3 tests/v207.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8672; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v207-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
for n, c in (("red", "0xff0000"), ("blue", "0x0000ff")):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c={c}:s=480x640", "-frames:v", "1", D + f"/media/{n}.png"], check=True, timeout=60)
# a 2 s video: red for the first second, blue for the second (VP9, so the test browser can decode it)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=320x320:d=1:r=30", "-f", "lavfi", "-i", "color=c=blue:s=320x320:d=1:r=30",
                "-filter_complex", "[0:v][1:v]concat=n=2:v=1[v]", "-map", "[v]", "-c:v", "libvpx-vp9", "-b:v", "400k", "-pix_fmt", "yuv420p", D + "/media/rb.webm"], check=True, timeout=120)
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", AGENTS_AUTO_LEARN="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
def pixel(f, t, fx, fy):
    png = D + "/fr.png"; subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", f, "-frames:v", "1", png], check=True, timeout=60)
    from PIL import Image
    im = Image.open(png).convert("RGB"); w, h = im.size; return im.getpixel((int(w * fx), int(h * fy)))
SETUP = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';go('edit');S.ed.tab='info';renderAll()}"
async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("()=>typeof S!=='undefined'&&typeof renderAll==='function'&&API.mode==='server'", timeout=25000)
        await E(SETUP, "en"); await pg.wait_for_timeout(600)
        # 1. an empty timeline: a scene gets a background clip so it plays
        e0 = await E("()=>{S.ed.clips=[];S.ed.infos=[];ED.t=0;const it=mgAdd150('checklist');return{clips:S.ed.clips.length,demo:S.ed.clips[0]&&S.ed.clips[0].src.k,total:edTotal(),end:it.end}}")
        chk("an empty timeline: the scene gets a background clip long enough to play it", e0["clips"] == 1 and e0["demo"] == "demo" and e0["total"] >= e0["end"] - .01, e0)
        # 2. one scene after another
        await E("()=>rec206('promo')"); await pg.wait_for_timeout(700)
        pl = await E("""()=>{const before=edTotal();['spread','checklist','headlineStorm'].forEach(sc=>{ED.t=0;mgAdd150(sc)});
          const l=S.ed.infos.filter(x=>x.type==='mg150').map(x=>[x.sc,x.start,x.end]);return{l,over:over207(),before,total:edTotal()}}""")
        out["place"] = pl
        last = pl["l"][-1]
        chk("new scenes go after the scenes already there (none on top of another), the background grows to hold them", pl["over"] == 0 and pl["total"] >= last[2] - .01 and pl["total"] > pl["before"], pl)
        ov = await E("()=>{const l=S.ed.infos.filter(x=>x.type==='mg150');l[5].start=1;l[5].end=5;l[6].start=2;l[6].end=6;edSetPick(null);S.ed.tab='info';renderView();return{over:over207(),bar:!!document.querySelector('.ov207 [data-act=\"mg207-line\"]')}}")
        chk("a project with scenes on top of each other says so, with Line them up", ov["over"] >= 2 and ov["bar"], ov)
        await pg.click('.ov207 [data-act="mg207-line"]'); await pg.wait_for_timeout(400)
        ln = await E("()=>({over:over207(),bar:!!document.querySelector('.ov207'),total:edTotal(),end:Math.max(...S.ed.infos.filter(x=>x.type==='mg150').map(x=>x.end))})")
        chk("Line them up: one after another, all inside the video", ln["over"] == 0 and not ln["bar"] and ln["total"] >= ln["end"] - .01, ln)
        # 3. speed on a phone
        sp = await E("""async()=>{delete S.ed.pq198;PF207.lv=null;ED.t=9;renderView();await new Promise(r=>setTimeout(r,300));edTick(performance.now());const w=document.getElementById('wk'),auto=[w.width,w.height];
          S.ed.pq198=1;edTick(performance.now());const full=[w.width,w.height];delete S.ed.pq198;edTick(performance.now());
          const c=cv164('fg',w.width,w.height).getContext('2d');c.shadowBlur=9;const it=S.ed.infos.find(x=>x.sc==='spread');draw164(w.getContext('2d'),w.width,w.height,it.start+1,it,'all');c.shadowBlur=9;
          return{auto,full,blur:c.shadowBlur,lite:light164()}}""")
        out["speed"] = sp
        chk("a phone on Auto draws the preview at 540 on the long side; Full (picked by hand) is 1080", max(sp["auto"]) == 540 and max(sp["full"]) == 1080, sp)
        chk("a phone's preview leaves out soft shadows inside the scenes", sp["lite"] and sp["blur"] == 0, sp)
        rs = await E("""async()=>{ED.t=8.6;ED.playing=true;const lat=[];for(let i=0;i<8;i++){const a=performance.now();await new Promise(r=>setTimeout(r,0));lat.push(performance.now()-a);await new Promise(r=>setTimeout(r,120))}
          let n=0;const o=edTick;edTick=function(){n++;return o.apply(this,arguments)};await new Promise(r=>setTimeout(r,1500));edTick=o;ED.playing=false;return{lat:Math.round(Math.max(...lat)),frames:n,ema:Math.round(PF207.ema)}}""")
        out["play"] = rs
        chk("while it plays, the page answers at once and the preview keeps moving", rs["lat"] < 250 and rs["frames"] >= 10, rs)
        tc = await E("""()=>{const tc=document.getElementById('tc'),r=tc.getBoundingClientRect(),nx=tc.nextElementSibling,n=nx&&nx.getBoundingClientRect();
          let hit=document.elementFromPoint(r.left+r.width*.75,r.top+r.height/2);return{w:r.width,sw:tc.scrollWidth,cw:tc.clientWidth,gap:n?Math.round(n.left-r.right):9,own:hit===tc||tc.contains(hit)}}""")
        chk("the time under the preview is whole and nothing covers it", tc["sw"] <= tc["cw"] + 1 and tc["gap"] >= 0 and tc["own"], tc)
        # 4. the chosen scene's settings first, with Pictures & videos
        await E("()=>{const it=S.ed.infos.find(x=>x.sc==='spread');edSetPick('info',it.id);S.ed.tab='info';renderView()}"); await pg.wait_for_timeout(500)
        st = await E("""()=>{const pv=document.querySelector('.pv207'),g=document.querySelector('.mg206h'),sc=document.querySelector('.sc207'),t1=document.querySelector('input[data-ib="t1"]');
          return{pv:!!pv,first:!!(pv&&g&&pv.getBoundingClientRect().top<g.getBoundingClientRect().top),head:sc&&sc.textContent,before:!!(pv&&t1&&pv.getBoundingClientRect().top<t1.getBoundingClientRect().top),
            slots:document.querySelectorAll('.pv207 .pk206b').length,add:!!document.querySelector('[data-act="pv207-add"]'),inView:pv&&pv.getBoundingClientRect().top<innerHeight}}""")
        out["sheet"] = st
        chk("the chosen scene's settings come first: its name, then Pictures & videos (12 boxes, an Add button), in view", st["pv"] and st["first"] and st["before"] and "Spread Rows" in (st["head"] or "") and st["slots"] == 12 and st["add"] and st["inView"], st)
        await pg.click('[data-act="pv207-add"]'); await pg.wait_for_selector('#modalRoot input[data-mg206up]', state="attached", timeout=5000)
        inp = await E("()=>{const i=document.querySelector('#modalRoot input[data-mg206up]');return{multi:i.multiple,acc:i.accept}}")
        chk("Add pictures or videos: several files at once, pictures and videos", inp["multi"] and "video" in inp["acc"] and "image" in inp["acc"], inp)
        await pg.set_input_files('#modalRoot input[data-mg206up]', [D + "/media/red.png", D + "/media/blue.png", D + "/media/rb.webm"])
        await pg.wait_for_function("()=>{const it=edItem(edPick());return it&&(it.pics||[]).filter(Boolean).length>=3}", timeout=20000); await pg.wait_for_timeout(500)
        up = await E("()=>{const it=edItem(edPick());return{pics:it.pics,vid:isVid207(it.pics[2]),cells:[...document.querySelectorAll('.pv207 .pk206b')].slice(0,3).map(b=>b.querySelector('video')?'v':b.querySelector('img')?'i':'-'),count:document.querySelector('.pv207h small').textContent}}")
        out["upload"] = up
        chk("three files in one go fill boxes 1–3 in order; the video shows as a video", len([x for x in up["pics"] if x]) == 3 and up["vid"] and up["cells"] == ["i", "i", "v"] and up["count"] == "3/12", up)
        # a result of yours (a video) from the sheet
        await E("()=>{S.jobs.push({id:'jv207',kind:'video',status:'complete',resultUrl:'/media/rb.webm?r=1',prompt:'x',created:Date.now()})}")
        await pg.click('[data-act="pv207-add"]'); await pg.wait_for_selector('#modalRoot [data-act="pv207-use"][data-vid]', timeout=5000)
        await pg.click('#modalRoot [data-act="pv207-use"][data-vid]'); await pg.wait_for_timeout(400)
        rr = await E("()=>{const it=edItem(edPick());return{p:it.pics[3],on:!!document.querySelector('#modalRoot .pk206p.on .pv207n')}}")
        chk("a video from your results goes in the next empty box (marked with its number)", rr["p"] == "/media/rb.webm?r=1" and rr["on"], rr)
        await pg.click('#modalRoot .pk206p.on'); await pg.wait_for_timeout(300)
        r2 = await E("()=>{const it=edItem(edPick());return it.pics[3]||''}")
        chk("…and a second tap takes it out again", r2 == "", r2)
        await E("()=>{document.getElementById('modalRoot').innerHTML=''}")
        # 5. the video inside a scene: the preview's frame for the moment, the export's frame for each time
        await E("()=>{S.ed.pq198=1;rec206('rawedit')}"); await pg.wait_for_timeout(600)
        await E("()=>{S.ed.infos=S.ed.infos.filter(x=>x.sc==='greenScreen');const it=S.ed.infos[0];it.pics=['/media/rb.webm'];it.start=0;it.end=2;S.ed.clips[0].out=2;edSetPick('info',it.id);renderView()}")
        pv = await E("""async()=>{const it=S.ed.infos[0],m=vm207('/media/rb.webm');await m.p;const w=document.getElementById('wk'),px=t=>new Promise(res=>{ED.playing=false;ED.t=t;const go=n=>{const v=m.el;
            if(n>0&&(v.seeking||Math.abs(v.currentTime-t)>.05||v.readyState<2)){edTick(performance.now());return setTimeout(()=>go(n-1),80)}edTick(performance.now());const d=w.getContext('2d').getImageData(Math.round(w.width*.5),Math.round(w.height*.55),1,1).data;res([d[0],d[1],d[2]])};edTick(performance.now());setTimeout(()=>go(40),80)});
          return{a:await px(.3),b:await px(1.5)}}""")
        out["preview"] = pv
        chk("the preview shows the video's own frame for the moment (red at 0.3 s, blue at 1.5 s)", pv["a"][0] > 150 and pv["a"][2] < 100 and pv["b"][2] > 150 and pv["b"][0] < 100, pv)
        await E("()=>{S.ed.fmtOut='webm';S.ed.format='landscape';persist();renderView()}")
        async with pg.expect_download(timeout=240000) as dl: await E("()=>{edExport()}")
        d = await dl.value; f = D + "/exp_" + d.suggested_filename; await d.save_as(f)
        a, bb = pixel(f, .3, .5, .55), pixel(f, 1.5, .5, .55); out["export"] = {"a": a, "b": bb, "stats": await E("()=>R139.stats&&{mode:R139.stats.mode,miss:R139.stats.miss}")}
        chk("the exported file has the video's frame for each time (red at 0.3 s, blue at 1.5 s)", a[0] > 150 and a[2] < 100 and bb[2] > 150 and bb[0] < 100, out["export"])
        # 6. Arabic
        await E(SETUP, "ar"); await pg.wait_for_timeout(300)
        await E("()=>{rec206('promo');const it=S.ed.infos.find(x=>x.sc==='spread');edSetPick('info',it.id);S.ed.tab='info';renderView()}"); await pg.wait_for_timeout(500)
        ar = await E("()=>({h:(document.querySelector('.pv207h b')||{}).textContent,add:(document.querySelector('[data-act=\"pv207-add\"]')||{}).textContent,more:(document.querySelector('[data-act=\"sc207-more\"]')||{}).textContent,dir:document.documentElement.dir,wide:document.documentElement.scrollWidth<=innerWidth+1})")
        chk("Arabic: the box and its buttons in Arabic, right to left, nothing wider than the screen", ar["h"] == "الصور والفيديوهات" and "أضف" in (ar["add"] or "") and "مشهد آخر" in (ar["more"] or "") and ar["dir"] == "rtl" and ar["wide"], ar)
        chk("page: no errors", not errs, errs[:3]); await b.close()
try: asyncio.run(main())
finally:
    srv.terminate()
    try: srv.wait(timeout=5)
    except Exception: srv.kill()
    subprocess.run(["rm", "-rf", D])
print(json.dumps({"out": out, "fails": fails}, ensure_ascii=False, default=str)[:3500]); sys.exit(1 if fails else 0)
