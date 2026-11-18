# v164 "the motion graphics don't rise to the one I sent — the editor is weak; have you looked at what the big companies do?"
# Motion engine 2 (the way After Effects / Jitter / Cavalry draw it): every motion scene under a camera with a depth shadow,
# a matched transition at each cut (zoom-through, whip, flash), real motion blur in the export (sub-frames over a 180° shutter),
# spring text letter by letter (word by word in Arabic), sparks when things land, a glint, 3D tilt for the phone and cards,
# a richer moving background and a palette from the brand's colour. A real nooi server and the editor in Playwright.
# Run: python3 tests/v164.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8498; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v164-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
JS = r"""async()=>{const R={};S.view="edit";renderView();await new Promise(r=>setTimeout(r,500));
  const m=await mod150();const sc=m.plan150({brand:"nooi.ai",msg:"nooi.ai turns one sentence into a finished video. 8 AI agents plan, film and edit it. 120000 videos made. Start free at nooi.ai",len:16,lang:"en"});
  build150(sc,{brand:"nooi.ai",col:"#7CFF4F"});await new Promise(r=>setTimeout(r,300));const its=S.ed.infos.filter(x=>x.type==="mg150").sort((a,b)=>a.start-b.start);
  R.scenes=its.map(x=>[x.sc,x.start,x.end]);
  // the spring passes its mark and settles
  R.spring=[spring164(.3),spring164(.6),spring164(1)];
  // the same kind of transition on both sides of every cut
  R.cuts=[];for(let i=1;i<its.length;i++){const a=its[i-1],b=its[i],ka=CUT164[Math.abs(Math.round(a.end*100))%3],kb=CUT164[Math.abs(Math.round(b.start*100))%3];R.cuts.push([ka,kb])}
  const ta=trans164(its[1],.05,its[1].end-its[1].start),tz=trans164(its[1],.6,its[1].end-its[1].start);R.inMid=[ta,tz];
  // the palette: the brand's colour on the logo and the end card, neighbours in between
  R.acc=its.map(x=>[x.sc,sceneAc164(x)]);
  // draw on a small canvas: a still moment and a moving one, with and without the export's motion blur
  const W=270,H=480,cv=document.createElement("canvas");cv.width=W;cv.height=H;const cx=cv.getContext("2d");
  const pix=(t,exp)=>{cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,W,H);R139.on=!!exp;try{const it=its.find(x=>t>=x.start&&t<=x.end);mgDraw150(cx,W,H,t,it)}finally{R139.on=false}return cx.getImageData(0,0,W,H).data};
  const diff=(a,b)=>{let s=0;for(let i=0;i<a.length;i+=4)s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);return s/(a.length/4)/3};
  const cut=its[2].start,pre=cut-.08;R.blurMoving=diff(pix(pre,false),pix(pre,true));const lg=its.slice().sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0],hold=lg.start+Math.min(1.7,(lg.end-lg.start)-.6);R.hold=[lg.sc,hold];R.blurStill=diff(pix(hold,false),pix(hold,true));
  R.bgLit=(()=>{cx.clearRect(0,0,W,H);bg150(cx,W,H,"#7CFF4F",2);const d=cx.getImageData(0,0,W,H).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return s/(d.length/4)})();
  // Arabic words stay joined: the spring text, once in, is the same picture as the words drawn at once
  const ar="حوّل جملة إلى فيديو",F=34;const a1=(()=>{cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,W,H);cx.fillStyle="#000";cx.fillRect(0,0,W,H);kin164(cx,ar,W/2,H/2,F,800,"#fff",9,"#7CFF4F",null);return cx.getImageData(0,0,W,H).data})();
  const a2=(()=>{cx.clearRect(0,0,W,H);cx.fillStyle="#000";cx.fillRect(0,0,W,H);cx.font=infoFont(800,F);cx.textAlign="center";cx.textBaseline="middle";cx.direction="rtl";cx.fillStyle="#fff";cx.fillText(ar,W/2,H/2);return cx.getImageData(0,0,W,H).data})();
  R.arabic=diff(a1,a2);
  // Latin letters come in one after another
  const l1=(()=>{cx.clearRect(0,0,W,H);kin164(cx,"Start today",W/2,H/2,F,800,"#fff",.12,"#7CFF4F",null);let n=0;const d=cx.getImageData(0,0,W/2,H).data,e=cx.getImageData(W/2,0,W/2,H).data,c=x=>{let k=0;for(let i=3;i<x.length;i+=4)if(x[i]>40)k++;return k};return[c(d),c(e)]})();R.letters=l1;
  // every scene draws (the phone and the cards in 3D) without an error
  R.errs=[];for(const s of Object.keys(SC150)){try{const it={id:"x"+s,type:"mg150",sc:s,start:0,end:3,accent:"#1CB0F6",t1:"Hello",t2:"World",items:"A:3 | B:2 | You:1",val:"42",bg:"dark",x:.5,y:.5,k:1,anim:"in"};mgDraw150(cx,W,H,1.2,it);R139.on=true;mgDraw150(cx,W,H,1.2,it)}catch(e){R.errs.push(s+": "+e.message)}finally{R139.on=false}}
  return R}"""
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
async def main():
    for _ in range(160):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: await asyncio.sleep(.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1280, "height": 900})).new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
        await pg.evaluate("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false}")
        r = await pg.evaluate(JS); out.update(r); out["page_errors"] = errs; await b.close()
try: asyncio.run(main())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-1200:])
finally:
    srv.kill(); shutil.rmtree(D, ignore_errors=True)
if not fails:
    ok(len(out.get("scenes", [])) >= 4, f"an ad was built {out.get('scenes')}")
    s = out.get("spring", [0, 0, 0]); ok(s[0] > 1.02 and abs(s[2] - 1) < 1e-9, f"the spring passes its mark and settles {s}")
    ok(out.get("cuts") and all(a == b for a, b in out["cuts"]), f"the same transition on both sides of each cut {out.get('cuts')}")
    i0, i1 = (out.get("inMid") or [{}, {}])
    ok(i1.get("a") == 1 and i1.get("s") == 1 and i1.get("dx") == 0 and i1.get("fl") == 0 and (i0.get("a", 1) < 1 or i0.get("s", 1) != 1 or i0.get("dx", 0) != 0 or i0.get("fl", 0) > 0), f"a scene moves only at its cuts {out.get('inMid')}")
    ac = dict((k, v) for k, v in out.get("acc", [])); cols = [v for k, v in out.get("acc", []) if k not in ("logo", "end", "trail")]
    ok(ac.get("logo", "#7CFF4F").lower() == "#7cff4f" and ac.get("end", "#7CFF4F").lower() == "#7cff4f" and len(set(cols)) >= min(2, len(cols)), f"brand colour on the logo and end, a palette between {out.get('acc')}")
    ok(out.get("blurMoving", 0) > 1.0 and out.get("blurStill", 99) < .05, f"motion blur where it moves, none where it holds (one picture, no extra work) {out.get('blurMoving')} {out.get('blurStill')} {out.get('hold')}")
    ok(out.get("bgLit", 0) > 6, f"the background has light in it {out.get('bgLit')}")
    ok(out.get("arabic", 99) < 1.5, f"Arabic words stay joined (spring text = the words drawn at once) {out.get('arabic')}")
    l = out.get("letters", [0, 1]); ok(l[0] > 0 and l[1] < l[0] * .5, f"Latin letters come in one after another (the left half first) {l}")
    ok(not out.get("errs"), f"every scene draws {out.get('errs')}")
    ok(not out.get("page_errors"), f"page errors {out.get('page_errors')}")
print(json.dumps({k: out.get(k) for k in ("scenes", "spring", "cuts", "acc", "blurMoving", "blurStill", "bgLit", "arabic", "letters", "errs")}, ensure_ascii=False)[:3000])
if fails: print("FAILED:"); [print(" ✗", f) for f in fails]; sys.exit(1)
print("v164 ok")
