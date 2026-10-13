# v78a — render review & AI corrections, the editor's "Export video" button, brand names in RTL. A fresh nooi server + a mocked
# NVIDIA vision model (the AI reviewer answers like a real one would). Checks, on a phone (Arabic) and a desktop:
#  · API: /v1/vision/review (3D views → front_on_back; video frames → text_cut_off), /v1/vision/locate, 1 credit each,
#    /v1/media/probe and /v1/media/transcode for ProRes 422 HQ / DNxHR HQ / H.265 10-bit / WAV / GIF
#  · "nooi Studio 2.0": the number stays after the words in Arabic
#  · editor: "Export video" button → sheet (formats, fps, checks) → ProRes .mov delivered and probed → the render check finds text
#    that can't fit → "Fix & export again" → passes; with the AI review on, the AI's finding is listed
#  · 3D Studio: the reviewer passes a good car, catches a copied-front back and a floating car and fixes both; the AI review
#    reports front_on_back and the studio repaints a real back
import asyncio, base64, json, os, shutil, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MPORT = 8087, 8086
D = tempfile.mkdtemp(prefix="nooi-rr-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
FF = os.environ.get("FFMPEG_PATH", "ffmpeg")
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x8aa6b4:size=800x600", "-vf", "drawbox=x=200:y=300:w=400:h=150:color=0x9a1d1d@1:t=fill,drawbox=x=270:y=215:w=260:h=90:color=0x7a1818@1:t=fill,drawbox=x=290:y=228:w=220:h=62:color=0x1d2630@1:t=fill,drawbox=x=230:y=430:w=70:h=60:color=black@1:t=fill,drawbox=x=500:y=430:w=70:h=60:color=black@1:t=fill", "-frames:v", "1", D + "/media/car.png"], check=True)
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000", "-t", "2", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", D + "/clip.webm"], check=True)
MOCK = r"""
const http=require('http'),P=+process.argv[2];const seen=[];
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x'),J=(d,c)=>{s.statusCode=c||200;s.setHeader('content-type','application/json');s.end(JSON.stringify(d))};
 if(u.pathname==='/seen')return J(seen);
 if(u.pathname==='/nv/v1/models')return J({data:[]});
 if(u.pathname==='/nv/v1/chat/completions'){const body=JSON.parse(b||'{}'),m=body.messages[body.messages.length-1],c=Array.isArray(m.content)?m.content.map(x=>x.text||'').join(' '):String(m.content),img=Array.isArray(m.content)&&m.content.some(x=>x.type==='image_url');seen.push({img,len:c.length});
  let out={ok:true};
  if(/three labelled views/.test(c))out={ok:false,issues:[{code:'front_on_back',view:'rear',note:'Grille and headlights appear on the back'}],summary:"The car's front is copied onto its back"};
  else if(/contact sheet of frames in time order/.test(c))out={ok:false,issues:[{code:'text_cut_off',view:'00:01',note:'The title runs off the edge'}],summary:'Text is cut off'};
  else if(/^Find the|Find the /.test(c))out={found:true,box:[0.2,0.3,0.8,0.7]};
  return J({choices:[{message:{role:'assistant',content:JSON.stringify(out)}}]})}
 J({detail:'not found'},404)})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=data, method=method or ("POST" if data is not None else "GET"), headers={"content-type": ctype})
    with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
async def wait_for(E, js, sec=20):
    for _ in range(sec * 4):
        try:
            if await E(js): return True
        except Exception: pass
        await asyncio.sleep(.25)
    return False
HOOKS = """()=>{const B=[.25,.36,.75,.82];window.__X3_TEST_MASK=async(img,pts)=>{const w=img.width,h=img.height,a=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h;if(u>B[0]&&u<B[2]&&v>B[1]&&v<B[3]&&!(v<0.5&&(u<0.3375||u>0.6625)))a[y*w+x]=255}return{alpha:a,w,h}};
 window.__X3_TEST_DEPTH=async(cv)=>{const w=160,h=Math.max(16,Math.round(160*cv.height/cv.width)),d=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-w/2)/(w*0.45),dy=(y-h*0.62)/(h*0.6);d[y*w+x]=1+Math.max(0,1-dx*dx-dy*dy)*3+(y>h*0.45?1.2:0)}return{depth:d,w,h,ms:1}};return true}"""

async def run(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"; lang = "ar" if mob else "en"; r = {}
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
    ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=mob, has_touch=mob, accept_downloads=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.credits=500;go('home');renderAll()}", lang); await pg.wait_for_timeout(500)
    # brand name order in the bots card (video tab)
    await E("()=>document.querySelector('[data-act=hf-tab][data-v=video]')?.click()"); await pg.wait_for_timeout(400)
    r["brand"] = await E("()=>{const n=document.querySelector('.nst');if(!n)return null;const w=n.querySelector('.nstw').getBoundingClientRect(),e=n.querySelector('em').getBoundingClientRect();return [Math.round(w.right),Math.round(e.left),getComputedStyle(n).direction]}")
    ok(r["brand"] and r["brand"][1] >= r["brand"][0] - 1, f"{tag}: 'nooi Studio 2.0' keeps 2.0 after the words {r['brand']}")
    # editor → Export video
    await E("()=>{go('edit');PJ.fresh('edit');S.ed.clips.push({id:uid(),src:{k:'demo',kind:'scene',seed:11},in:0,out:3,speed:1,trans:'cut',vol:100});S.ed.texts=[{id:uid(),text:'Supercalifragilisticexpialidocious-extraordinarily',start:0,end:3,pos:'bottom',style:'caption',size:9,anim:'pop'}];S.ed.rcheckAI=true;renderAll()}"); await pg.wait_for_timeout(700)
    ok(await E("()=>!!document.querySelector('[data-act=ed-out]')&&document.querySelector('[data-act=ed-out]').getBoundingClientRect().top<400"), f"{tag}: Export video button at the top of the editor")
    await E("()=>document.querySelector('[data-act=ed-out]').click()"); await pg.wait_for_timeout(300)
    r["fmts"] = await E("()=>[...document.querySelectorAll('[data-act=xout-fmt]')].map(b=>b.dataset.v+(b.disabled?'-off':''))"); ok(r["fmts"] == ["mp4", "prores", "dnxhr", "hevc", "webm", "gif", "wav"], f"{tag}: export formats {r['fmts']}")
    fmt = "mp4" if mob else "prores"
    await E(f"()=>document.querySelector('[data-act=xout-fmt][data-v={fmt}]').click()"); await pg.wait_for_timeout(200)
    async with pg.expect_download(timeout=120000) as dl:
        await E("()=>document.querySelector('[data-act=xout-go]').click()")
    d = await dl.value; r["file"] = d.suggested_filename; ok(r["file"].endswith(".mov" if fmt == "prores" else ".mp4"), f"{tag}: delivered {r['file']}")
    ok(await wait_for(E, "()=>!!S.ed.rc", 60), f"{tag}: render check ran")
    r["rc"] = await E("()=>S.ed.rc.checks.map(c=>c.id+':'+c.lvl)"); ok("text:bad" in r["rc"] and "duration:ok" in r["rc"] and "black:ok" in r["rc"], f"{tag}: render check {r['rc']}")
    ok(any(x.startswith("file:ok") for x in r["rc"]), f"{tag}: delivered file probed {r['rc']}")
    ok(any(x.startswith("ai_text_cut_off") for x in r["rc"]), f"{tag}: AI review finding listed {r['rc']}")
    ok(await E("()=>!!document.querySelector('[data-act=rc-fix][data-again]')"), f"{tag}: Fix & export again offered")
    s0 = await E("()=>S.ed.texts[0].size")
    at0 = await E("()=>S.ed.rc.at")
    async with pg.expect_download(timeout=120000) as dl2:
        await E("()=>{S.ed.rcheckAI=false;document.querySelector('[data-act=rc-fix][data-again]').click()}")
    await dl2.value; ok(await wait_for(E, f"()=>S.ed.rc&&S.ed.rc.at>{at0}", 60), f"{tag}: re-checked after the fix")
    r["rc2"] = await E("()=>[S.ed.texts[0].size,S.ed.rc.checks.filter(c=>c.lvl!=='ok').map(c=>c.id)]"); ok(r["rc2"][0] < s0 and "text" not in r["rc2"][1], f"{tag}: text made to fit in one go {s0} → {r['rc2']}")
    # 3D Studio: the reviewer
    await E("()=>go('studio3d')"); fr = None
    for _ in range(80):
        fr = next((f for f in pg.frames if "/studio3d/" in f.url), None)
        try:
            if fr and await fr.evaluate("()=>!!window.X3&&!!X3.S.cfg&&X3.S.cfg.nooi"): break
        except Exception: pass
        await asyncio.sleep(.25)
    ok(fr is not None, f"{tag}: 3D Studio frame")
    if fr:
        await fr.evaluate(HOOKS); await fr.evaluate("async()=>{const b=await (await fetch('/media/car.png')).blob();await X3.setPhoto(b,'car.png');document.getElementById('label').value='car';X3.S.label='car';document.getElementById('cat').value='suv';document.getElementById('cat').dispatchEvent(new Event('change'))}")
        await fr.evaluate("()=>X3.make3D()")
        r["rv"] = await fr.evaluate("()=>{const a=X3.E.assets[0];return [a.review.checks.filter(c=>c.ok).length,a.review.checks.length,a.review.checks.filter(c=>!c.ok).map(c=>c.id)]}")
        ok(r["rv"][0] == r["rv"][1] and r["rv"][1] >= 7, f"{tag}: a good car passes the review {r['rv']}")
        r["broken"] = await fr.evaluate("""()=>{const a=X3.E.assets[0],f=a.object.getObjectByName('front'),re=a.object.getObjectByName('rear');re.material.map=f.material.map;re.material.needsUpdate=true;a.object.position.y+=0.5;
          const before=X3.review(a,{auto:false}).filter(c=>!c.ok).map(c=>c.id),after=X3.review(a).filter(c=>!c.ok).map(c=>c.id);return [before,after,a.review.fixed.map(x=>x[0])]}""")
        ok("rear" in r["broken"][0] and "ground" in r["broken"][0] and not r["broken"][1], f"{tag}: copied-front back + floating caught and fixed {r['broken']}")
        n0 = await E("()=>S.credits")
        r["ai3d"] = await fr.evaluate("async()=>{const x=await X3.aiReview();return [x.issues.map(i=>i.code),x.fixed.map(f=>f[0])]}")
        ok(r["ai3d"][0] == ["front_on_back"] and any("real back" in f for f in r["ai3d"][1]), f"{tag}: AI review → repainted the back {r['ai3d']}")
        ok(await wait_for(E, f"()=>S.credits<{n0}", 5), f"{tag}: the AI review used a credit")
    ok(not errs, f"{tag}: page errors {errs[:4]}")
    await b.close(); return r

async def main():
    out = {}
    async with async_playwright() as p:
        for w in (390, 1280): out[w] = await run(p, w)
    return out

if __name__ == "__main__":
    mk = subprocess.Popen(["node", D + "/mock.js", str(MPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "KIE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="r" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", NVIDIA_API_KEY="nvapi-test", NVIDIA_BASE_URL=f"http://localhost:{MPORT}/nv/v1"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        api("/v1/admin/providers/nvidia", {"use": "text:on vision:on image:off edit:off 3d:off video:off"}, "PUT")
        img = "data:image/jpeg;base64," + base64.b64encode(open(D + "/media/car.png", "rb").read()).decode()
        c0 = api("/v1/billing").get("credits")
        rv = api("/v1/vision/review", {"image": img, "subject": "car", "category": "suv"}); ok(rv["issues"] and rv["issues"][0]["code"] == "front_on_back" and not rv["ok"], f"3D review {rv}")
        vv = api("/v1/vision/review", {"image": img, "mode": "video", "brief": "car ad"}); ok(vv["issues"] and vv["issues"][0]["code"] == "text_cut_off", f"video review {vv}")
        lc = api("/v1/vision/locate", {"image": img, "label": "car"}); ok(lc["found"] and lc["box"] == [0.2, 0.3, 0.8, 0.7], f"locate {lc}")
        c1 = api("/v1/billing").get("credits"); ok(c0 is None or c1 == c0 - 3, f"1 credit per AI review / locate ({c0} → {c1})")
        seen = json.loads(urllib.request.urlopen(f"http://localhost:{MPORT}/seen").read()); ok(len(seen) >= 3 and all(x["img"] for x in seen[:3]), f"the pictures went to the vision model {seen[:3]}")
        raw = open(D + "/clip.webm", "rb").read(); probes = {}
        for f, codec in (("prores", "prores"), ("dnxhr", "dnxhd"), ("hevc", "hevc"), ("wav", None), ("gif", "gif")):
            t = api(f"/v1/media/transcode?w=640&h=360&fmt={f}&fps=25", raw=raw, ctype="video/webm"); pr = api("/v1/media/probe", {"url": t["url"]}); probes[f] = [pr.get("video") and pr["video"]["codec"], pr.get("audio") and pr["audio"]["codec"]]
            ok((codec is None and pr["audio"] and pr["audio"]["codec"].startswith("pcm") and not pr["video"]) or (codec and pr["video"] and pr["video"]["codec"] == codec), f"{f} delivered as {probes[f]}")
        out = asyncio.run(main())
        print(json.dumps({"fails": fails, "probes": probes, "results": out}, ensure_ascii=False, default=str))
    finally:
        srv.terminate(); mk.terminate(); shutil.rmtree(D, ignore_errors=True)
