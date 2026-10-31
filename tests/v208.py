# v208 — the editor plays on a phone: never stuck on a loading video, scenes seen, one row under the video, a tap picks.
#  · a clip whose video stays loading: the clock waits 2.5 s at most, then runs on; "Loading the video…" shows on the preview
#  · a clip that loads normally plays as before (no waiting)
#  · a new motion scene puts the playhead where it can be seen (after its way in), not on its first, empty frame
#  · no history clock in the row under the video; a long press (or right click) on Undo opens the history; a short tap still undoes
#  · the row under the video and the tool bar at the foot fit a 390 and a 360 px phone; Delete sits beside Split
#  · a tap on a timeline item picks it (settings stay closed); a long press opens its settings
#  · a picture bigger than 1280 px is drawn from a smaller copy in the preview; the image menu is off on picture boxes
# Run: python3 tests/v208.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8673; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v208-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=s=640x360:d=8:r=30", "-c:v", "libvpx-vp9", "-b:v", "300k", D + "/media/clip.webm"], check=True, timeout=120)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x3366ff:s=2400x1600", "-frames:v", "1", D + "/media/big.png"], check=True, timeout=60)
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", AGENTS_AUTO_LEARN="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
SETUP = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';go('edit');S.ed.tab='clip';renderAll()}"
CLIP = """async()=>{S.jobs.push({id:'jclip',kind:'video',status:'complete',resultUrl:'/media/clip.webm',prompt:'Merged clips',created:Date.now()});
  S.ed.clips=[{id:'c1',src:{k:'job',job:'jclip'},in:0,out:8,speed:1,trans:'cut',vol:100}];S.ed.infos=[];S.ed.texts=[];edSetPick(null);renderView();await new Promise(r=>setTimeout(r,1500));return!!M['c_c1']}"""
async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("()=>typeof S!=='undefined'&&typeof renderAll==='function'&&API.mode==='server'", timeout=25000)
        await E(SETUP, "en"); await pg.wait_for_timeout(600); await E(CLIP)
        # 1. playback with a normal clip, then with one that never finishes loading
        n = await E("async()=>{ED.t=0;ED.playing=true;ED.last=0;await new Promise(r=>setTimeout(r,2500));ED.playing=false;return +ED.t.toFixed(2)}")
        st = await E("""async()=>{const m=M['c_c1'];Object.defineProperty(m.el,'readyState',{configurable:true,get(){return 2}});ED.t=0;ED.playing=true;ED.last=0;
          await new Promise(r=>setTimeout(r,1500));const early=+ED.t.toFixed(2);await new Promise(r=>setTimeout(r,2500));const late=+ED.t.toFixed(2),buf=ED.buffering;
          const w=document.getElementById('wk'),d=w.getContext('2d').getImageData(Math.round(w.width*.04),Math.round(Math.min(w.width,w.height)*.06),Math.round(w.width*.25),Math.round(Math.min(w.width,w.height)*.05)).data;
          let white=0;for(let i=0;i<d.length;i+=4)if(d[i]>235&&d[i+1]>235&&d[i+2]>235)white++;ED.playing=false;delete m.el.readyState;return{early,late,buf,white}}""")
        out["play"] = {"normal": n, "stuck": st}
        chk("a clip that loads normally plays as before", n > 1.8, n)
        chk("a clip still loading: the clock waits (≈0 at 1.5 s), then runs on after 2.5 s, with a Loading tag on the preview", st["early"] < .2 and st["late"] > .6 and st["buf"] and st["white"] > 20, st)
        # 2. a new scene shows itself
        sc = await E("()=>{ED.t=0;const it=mgAdd150('words');return{start:it.start,end:it.end,t:ED.t}}")
        chk("a new scene: the playhead goes just after its way in, not to its first frame", sc["t"] > sc["start"] + .5 and sc["t"] < sc["end"], sc)
        # 3. the row under the video, the tool bar at the foot
        for W in (390, 360):
            await pg.set_viewport_size({"width": W, "height": 844}); await pg.wait_for_timeout(400)
            await E("()=>{const it=S.ed.infos[0];edSetPick('info',it.id);S.ed.pclosed143=S.ed.tab;renderView()}"); await pg.wait_for_timeout(300)
            ly = await E("""()=>{const tr=document.querySelector('.ed143 .transport'),last=[...tr.children].pop().getBoundingClientRect(),bar=document.querySelector('.ed143 .e-bar.ctx'),acts=bar?[...bar.querySelectorAll('[data-act]')].map(b=>b.dataset.act):[];
              return{clock:!!document.querySelector('.hist202b,[data-act="hist202"]'),fit:tr.scrollWidth<=tr.clientWidth+1&&last.right<=innerWidth,bar:bar?bar.scrollWidth<=bar.clientWidth+1:null,acts,
                tc:(()=>{const t=document.getElementById('tc');return t.scrollWidth<=t.clientWidth+1})()}}""")
            out["row%d" % W] = ly; i = ly["acts"].index("ed-split") if "ed-split" in ly["acts"] else -9
            chk(f"{W} px: no clock in the row; the row and the bar at the foot fit; Delete right after Split; the time whole", not ly["clock"] and ly["fit"] and ly["bar"] and ly["tc"] and i >= 0 and ly["acts"][i + 1] == "ed-del", ly)
        await pg.set_viewport_size({"width": 390, "height": 844}); await pg.wait_for_timeout(300)
        # 4. Undo: a short tap undoes, a long press opens the history
        await E("()=>{edSetPick(null);S.ed.pclosed143=S.ed.tab;renderView()}"); await pg.wait_for_timeout(300)
        h0 = await E("()=>HIST.i")
        await pg.tap("#edundo"); await pg.wait_for_timeout(400)
        h1 = await E("()=>({i:HIST.i,sheet:!!document.querySelector('#modalRoot .hist202l')})")
        await pg.dispatch_event("#edundo", "pointerdown", {"pointerType": "touch", "isPrimary": True}); await pg.wait_for_timeout(800); await pg.dispatch_event("#edundo", "pointerup", {"pointerType": "touch", "isPrimary": True})
        h2 = await E("()=>({sheet:!!document.querySelector('#modalRoot .hist202l'),rows:document.querySelectorAll('#modalRoot .hist202r').length})")
        out["undo"] = [h0, h1, h2]
        chk("Undo: a short tap undoes (no sheet); a long press opens the history", h1["i"] == h0 - 1 and not h1["sheet"] and h2["sheet"] and h2["rows"] >= 1, out["undo"])
        await E("()=>{document.getElementById('modalRoot').innerHTML=''}")
        # 5. a tap on a timeline item picks it, its settings stay closed; a long press opens them
        await E(CLIP); await E("()=>{edSetPick(null);S.ed.pclosed143=S.ed.tab;renderView()}"); await pg.wait_for_timeout(400)
        await pg.tap('#tlin .blk[data-clip="c1"]', position={"x": 60, "y": 10}); await pg.wait_for_timeout(400)
        tp = await E("()=>{const p=edPick(),s=document.querySelector('.ed143 .e-sheet');return{pick:p&&[p.k,p.id],shut:S.ed.pclosed143===S.ed.tab,sheet:!!s&&getComputedStyle(s).display!=='none'&&s.getBoundingClientRect().height>40,bar:!!document.querySelector('.ed143 .e-bar.ctx [data-act=\"ed-del\"]')}}")
        out["tap"] = tp
        chk("a tap on a clip picks it (the bar acts on it), its settings stay closed", tp["pick"] == ["clip", "c1"] and tp["shut"] and tp["bar"], tp)
        # 6. big pictures from a smaller copy; no image menu on boxes
        bg = await E("""async()=>{img206('/media/big.png');await IMG206['/media/big.png'].p;const a=img206('/media/big.png');R139.on=true;const b=img206('/media/big.png');R139.on=false;
          const d=document.createElement('div');d.className='pk206p';d.innerHTML='<img src="/media/big.png">';document.body.appendChild(d);const ev=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});d.firstChild.dispatchEvent(ev);d.remove();
          return{prev:[a.width||a.naturalWidth,a.height||a.naturalHeight],exp:b.naturalWidth,menu:!ev.defaultPrevented}}""")
        out["big"] = bg
        chk("a 2400 px picture: the preview draws a 1280 px copy, the export the original; no image menu on a box", max(bg["prev"]) == 1280 and bg["exp"] == 2400 and not bg["menu"], bg)
        # 7. Arabic: the tag in Arabic
        await E(SETUP, "ar"); await pg.wait_for_timeout(300)
        ar = await E("()=>L('Loading the video…','جارٍ تحميل الفيديو…')")
        chk("Arabic: the loading tag", ar == "جارٍ تحميل الفيديو…", ar)
        chk("page: no errors", not errs, errs[:3]); await b.close()
try: asyncio.run(main())
finally:
    srv.terminate()
    try: srv.wait(timeout=5)
    except Exception: srv.kill()
    subprocess.run(["rm", "-rf", D])
print(json.dumps({"out": out, "fails": fails}, ensure_ascii=False, default=str)[:3500]); sys.exit(1 if fails else 0)
