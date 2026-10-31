# v202 — the editor towards After Effects / Premiere / DaVinci, phase 5. A real nooi server, a grey picture clip, a white square layer,
# a blue full-frame layer, a left-black → right-white gradient picture:
#  · track mattes: the blue layer matted by the white square (alpha) shows blue only inside the square; inverted shows blue only
#    outside; a luma matte from the gradient shows blue on the right and the grey clip on the left
#  · loop + wiggle: a size keyframed 20 → 60 % over 0–2 s reads 30 % at 2.25 s with "Loop" and 50 % with "Back and forth"; a wiggle
#    of 10 on the X position moves the square off centre and differently at two moments
#  · transparent export: the page draws the frames with the clips hidden and the server returns a WebM whose pixels carry alpha
#    (yuva420p; the corner is fully transparent, the square's centre fully opaque)
#  · a part of the timeline: /v1/media/transcode?a=1&b=2 cuts a 3-second recording to about one second
#  · history: two named steps appear in the History sheet; tapping the first puts the layer's size back
# Run: python3 tests/v202.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8663; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v202-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120)
FF("-f", "lavfi", "-i", "color=c=0x808080:s=640x360", "-frames:v", "1", M + "grey.png")
FF("-f", "lavfi", "-i", "color=c=white:s=256x256", "-frames:v", "1", M + "white.png")
FF("-f", "lavfi", "-i", "color=c=0x0000ff:s=640x360", "-frames:v", "1", M + "blue.png")
FF("-f", "lavfi", "-i", "gradients=s=640x360:c0=black:c1=white:x0=0:y0=180:x1=639:y1=180:nb_colors=2", "-frames:v", "1", M + "grad.png")
FF("-f", "lavfi", "-i", "color=c=0xff0000:s=320x180:rate=24:duration=3", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "200k", "-c:a", "libopus", "-shortest", M + "three.webm")
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", AGENTS_AUTO_LEARN="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
near = lambda a, b, tol=40: all(abs(a[i] - b[i]) <= tol for i in range(3))
def probe(f):
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,pix_fmt,width,height:stream_tags=alpha_mode", "-of", "json", f], capture_output=True, text=True).stdout or "{}")
    v = [s for s in pr.get("streams", []) if s.get("codec_type") == "video"]; return {"dur": float(pr.get("format", {}).get("duration", 0) or 0), "pix": v and v[0].get("pix_fmt"), "w": v and v[0].get("width"), "h": v and v[0].get("height"), "alpha": v and (v[0].get("tags") or {}).get("alpha_mode")}
def rgba_at(f, x, y, w, h):
    # (the libvpx decoder reads the alpha plane; ffmpeg's own VP9 decoder ignores it — and a 1×1 crop is refused on 4:2:0, so rgba first)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", f, "-frames:v", "1", "-vf", f"format=rgba,crop=w=2:h=2:x={x}:y={y}", "-f", "rawvideo", "-"], capture_output=True, timeout=60).stdout
    return list(raw[:4])
SETUP = """async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
 const now=Date.now(),mk=(id,kind,url,dur)=>({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url});
 S.jobs.push(mk('j_grey','image','/media/grey.png'));
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.layers=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];S.ed.fit='contain';S.ed.zoom=60;
 await edUseJob(S.jobs.find(j=>j.id==='j_grey'),{stay:true,quiet:true,t:3});S.ed.clips[0].in=0;S.ed.clips[0].out=3;S.ed.sel=S.ed.clips[0].id;
 const ly=(id,url,sc)=>{const Ly={id,name:id,start:0,end:3,x:.5,y:.5,sc,rot:0,op:100,key:'none',anim:'none',shape:'none',blend:'source-over'};slotUrl139('ly_'+id,{url,type:'image',name:id});S.ed.layers.push(Ly);return Ly};
 ly('blue','/media/blue.png',100);ly('w1','/media/white.png',30);ly('grad','/media/grad.png',100);S.ed.selLayer='blue';
 window.__t=[];toast=(o=>function(m){window.__t.push(String(m));return o.apply(this,arguments)})(toast);go('edit');renderAll()}"""
PIX = """(a)=>{ED.playing=false;ED.t=a[0];edTick(performance.now());edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d');return Array.from(x.getImageData(Math.round(c.width*a[1]),Math.round(c.height*a[2]),1,1).data).slice(0,3)}"""
BBOX = """(t)=>{ED.playing=false;ED.t=t;edTick(performance.now());edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d'),W=c.width,H=c.height,d=x.getImageData(0,0,W,H).data;let x0=W,x1=-1,y0=H,y1=-1;
 for(let y=0;y<H;y+=2)for(let X=0;X<W;X+=2){const i=(y*W+X)*4;if(d[i]>235&&d[i+1]>235&&d[i+2]>235){if(X<x0)x0=X;if(X>x1)x1=X;if(y<y0)y0=y;if(y>y1)y1=y}}return x1<0?null:{x0,x1,y0,y1,w:x1-x0,h:y1-y0,cx:(x0+x1)/2,W,H}}"""
GREY, BLUE, WHITE = [128, 128, 128], [0, 0, 255], [255, 255, 255]

async def main():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
        await E(SETUP); await pg.wait_for_function("()=>{const m=M['c_'+S.ed.clips[0].id];return m&&m.el&&m.el.complete&&['blue','w1','grad'].every(k=>M['ly_'+k]&&M['ly_'+k].el&&M['ly_'+k].el.complete&&M['ly_'+k].el.naturalWidth>0)}", timeout=20000)
        # ---- 1. track mattes (the grad layer is parked off the timeline until the luma part)
        await E("()=>{const g=S.ed.layers.find(x=>x.id==='grad');g.start=10;g.end=11}")
        p0 = await E(PIX, [0.5, 0.12, 0.5]); chk("before any matte the blue layer covers the frame (a point outside the white square)", near(p0, BLUE), p0)
        await E("()=>{S.ed.layers.find(x=>x.id==='blue').mt202={mode:'alpha',src:'w1',inv:false}}")
        c1, k1 = await E(PIX, [0.5, 0.5, 0.5]), await E(PIX, [0.5, 0.05, 0.05]); out["alpha"] = [c1, k1]
        chk("alpha matte: blue only inside the white square (centre blue, corner the grey clip)", near(c1, BLUE) and near(k1, GREY), out["alpha"])
        await E("()=>{S.ed.layers.find(x=>x.id==='blue').mt202.inv=true}")
        c2, k2 = await E(PIX, [0.5, 0.5, 0.5]), await E(PIX, [0.5, 0.05, 0.05]); out["inv"] = [c2, k2]
        chk("inverted: blue only outside the square", near(c2, GREY) and near(k2, BLUE), out["inv"])
        await E("()=>{const g=S.ed.layers.find(x=>x.id==='grad');g.start=0;g.end=3;S.ed.layers.find(x=>x.id==='blue').mt202={mode:'luma',src:'grad',inv:false};S.ed.layers.find(x=>x.id==='w1').start=10;S.ed.layers.find(x=>x.id==='w1').end=11}")
        l, r = await E(PIX, [0.5, 0.03, 0.5]), await E(PIX, [0.5, 0.97, 0.5]); out["luma"] = [l, r]
        chk("luma matte from a black→white gradient: the grey clip on the left, blue on the right; the matte itself is not drawn", near(l, GREY, 60) and near(r, BLUE, 60), out["luma"])
        # the Layers panel shows the matte controls for the selected layer
        await E("()=>{S.ed.tab='layers';S.ed.selLayer='blue';renderView()}"); await pg.wait_for_selector(".mt202 [data-mt202src]", timeout=10000)
        ui = await E("()=>({seg:[...document.querySelectorAll('.mt202 [data-act=\"mt202-mode\"]')].map(b=>b.dataset.v+':'+b.getAttribute('aria-pressed')),src:document.querySelector('.mt202 [data-mt202src]').value,opts:document.querySelectorAll('.mt202 [data-mt202src] option').length,inv:document.querySelector('.mt202 [data-mt202inv]').checked})")
        chk("panel: Off / Alpha / Luma with Luma pressed, the matte layer chosen, 'the layer above' + the other layers listed", ui["seg"] == ["none:false", "alpha:false", "luma:true"] and ui["src"] == "grad" and ui["opts"] == 3 and ui["inv"] is False, ui)
        await E("()=>{S.ed.layers.find(x=>x.id==='blue').mt202={mode:'none'};const w=S.ed.layers.find(x=>x.id==='w1');w.start=0;w.end=3;const g=S.ed.layers.find(x=>x.id==='grad');g.start=10;g.end=11;S.ed.layers=S.ed.layers.filter(x=>x.id!=='blue');renderView()}")
        # ---- 2. loop + wiggle
        await E("()=>{kfSet198('ly:w1|sc',0,20,'linear');kfSet198('ly:w1|sc',2,60,'linear');kfx202('ly:w1|sc').loop='cycle'}")
        b1 = await E(BBOX, 2.25); await E("()=>{kfx202('ly:w1|sc').loop='pingpong'}"); b2 = await E(BBOX, 2.25); await E("()=>{kfx202('ly:w1|sc').loop='none'}"); b3 = await E(BBOX, 2.25)
        out["loop"] = [b1 and round(b1["w"] / b1["W"], 2), b2 and round(b2["w"] / b2["W"], 2), b3 and round(b3["w"] / b3["W"], 2)]
        chk("loop: 20→60 % over 0–2 s reads 25 % at 2.25 s looping (0.25 s into the next pass), 55 % back and forth, 60 % with no loop", all(out["loop"]) and abs(out["loop"][0] - .25) < .03 and abs(out["loop"][1] - .55) < .03 and abs(out["loop"][2] - .60) < .03, out["loop"])
        await E("()=>{delete S.ed.kf198['ly:w1|sc'];S.ed.layers.find(x=>x.id==='w1').sc=30;kfSet198('ly:w1|x',0,.5,'linear');const x=kfx202('ly:w1|x');x.wa=10;x.wf=3}")
        w1, w2 = await E(BBOX, 0.4), await E(BBOX, 0.9); out["wig"] = [w1 and round((w1["cx"] - w1["W"] / 2) / w1["W"], 3), w2 and round((w2["cx"] - w2["W"] / 2) / w2["W"], 3)]
        chk("wiggle 10 on X: the square is off centre by up to 10 % and differently at two moments", all(v is not None for v in out["wig"]) and all(0 < abs(v) <= .105 for v in out["wig"]) and abs(out["wig"][0] - out["wig"][1]) > .005, out["wig"])
        await E("()=>{delete S.ed.kf198['ly:w1|x'];delete S.ed.kfx202['ly:w1|x'];S.ed.layers.find(x=>x.id==='w1').x=.5}")
        # the keyframe sheet carries the loop seg and the wiggle sliders
        await E("()=>{kfSet198('ly:w1|op',0,100,'linear');kfSheet198('ly:w1|op');return 1}"); await pg.wait_for_selector(".kfx202 [data-kfx202=\"wa\"]", timeout=8000)
        sh = await E("()=>({loop:document.querySelectorAll('.kfx202 [data-act=\"kfx202-loop\"]').length,wa:!!document.querySelector('.kfx202 [data-kfx202=\"wa\"]'),wf:!!document.querySelector('.kfx202 [data-kfx202=\"wf\"]')})")
        await pg.click('.kfx202 [data-act="kfx202-loop"][data-v="pingpong"]'); lp = await E("()=>S.ed.kfx202['ly:w1|op'].loop"); await E("()=>closeSheet()")
        chk("keyframe sheet: three loop choices, wiggle amount + speed; a tap sets 'Back and forth'", sh["loop"] == 3 and sh["wa"] and sh["wf"] and lp == "pingpong", [sh, lp])
        await E("()=>{delete S.ed.kf198['ly:w1|op'];delete S.ed.kfx202['ly:w1|op']}")
        # ---- 3. transparent export (the clips hidden, the white square kept) — 1 second at 12 fps keeps the test short
        await E("()=>{S.ed.clips[0].out=1;S.ed.layers.find(x=>x.id==='w1').end=1;S.ed.fps=12;AX202.quiet=true}")
        r = await E("async()=>{const r=await alphaExport202('webm');return r}"); out["alpha_r"] = r
        chk("transparent export: the server returns a WebM with alpha", bool(r) and r.get("alpha") is True and r.get("frames") == 12 and str(r.get("url", "")).endswith(".webm"), r)
        if r and r.get("url"):
            f = M + r["url"].split("/media/")[-1]; pr = probe(f); out["alpha_probe"] = pr
            corner, centre = rgba_at(f, 4, 4, pr["w"], pr["h"]), rgba_at(f, int(pr["w"] / 2), int(pr["h"] / 2), pr["w"], pr["h"]); out["alpha_px"] = [corner, centre]
            chk("the WebM carries alpha (alpha_mode=1), about one second; the corner is transparent and the square's centre is opaque white", pr["alpha"] == "1" and 0.8 <= pr["dur"] <= 1.3 and len(corner) == 4 and corner[3] < 20 and centre[3] > 235 and centre[0] > 220, [pr, corner, centre])
        # the preview is whole again after the export (clips drawn)
        back = await E(PIX, [0.5, 0.05, 0.05]); chk("after the export the clip draws again in the preview", near(back, GREY), back)
        # the export sheet lists the two transparent formats, the part fields and the frame button
        await E("()=>{edOutSheet();return 1}"); await pg.wait_for_selector(".ex202 [data-rng202on]", timeout=8000)
        xs = await E("()=>({fmts:[...document.querySelectorAll('.xfmts [data-act=\"xout-fmt\"]')].map(b=>b.dataset.v),rng:!!document.querySelector('.ex202 [data-rng202=\"a\"]')&&!!document.querySelector('.ex202 [data-rng202=\"b\"]'),clip:!!document.querySelector('[data-act=\"rng202-clip\"]'),still:!!document.querySelector('[data-act=\"still202\"]')})")
        await pg.click('[data-act="rng202-clip"]'); rg = await E("()=>S.ed.rng202"); await E("()=>closeSheet()")
        chk("export sheet: WebM transparent + ProRes 4444 transparent, from/to fields, 'This clip' fills the clip's span, the frame button", "webma" in xs["fmts"] and "mov4444" in xs["fmts"] and xs["rng"] and xs["clip"] and xs["still"] and rg["on"] and rg["a"] == 0 and abs(rg["b"] - 1) < .11, [xs, rg])
        # ---- 4. a part of the timeline on the server
        tok = await E("async()=>{const h=await authH();return JSON.stringify(h)}"); hdr = json.loads(tok); hdr["Content-Type"] = "video/webm"
        req = urllib.request.Request(B + "/v1/media/transcode?w=320&h=180&fmt=mp4&fps=24&a=1&b=2", data=open(M + "three.webm", "rb").read(), headers=hdr, method="POST")
        tr = json.loads(urllib.request.urlopen(req, timeout=120).read()); out["range"] = tr
        if tr.get("url"):
            pr2 = probe(M + tr["url"].split("/media/")[-1]); out["range_probe"] = pr2
            chk("a=1&b=2 on a 3 s recording gives about one second", 0.85 <= pr2["dur"] <= 1.2, pr2)
        else: chk("the part export answers with a file", False, tr)
        # ---- 5. history
        await E("()=>{S.ed.tab='layers';S.ed.selLayer='w1';renderView()}"); await pg.wait_for_selector('input[data-edx="ly.sc"]', timeout=8000)
        n0 = await E("()=>HIST.stack.length")
        await E("()=>{const i=document.querySelector('input[data-edx=\"ly.sc\"]');i.value=50;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));persist()}"); await pg.wait_for_timeout(250)
        await E("()=>{const i=document.querySelector('input[data-edx=\"ly.sc\"]');i.value=70;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));persist()}"); await pg.wait_for_timeout(250)
        sc1 = await E("()=>S.ed.layers.find(x=>x.id==='w1').sc"); n1 = await E("()=>HIST.stack.length")
        await E("()=>{histSheet202();return 1}"); await pg.wait_for_selector(".hist202r", timeout=8000)
        hs = await E("()=>({rows:document.querySelectorAll('.hist202r').length,on:document.querySelector('.hist202r.on')?.dataset.i,names:[...document.querySelectorAll('.hist202r span:nth-child(2)')].map(s=>s.textContent).slice(0,3),btn:!!document.querySelector('#edundo')&&!document.querySelector('[data-act=\"hist202\"]')})")
        await pg.click('.hist202r[data-i="' + str(n1 - 2) + '"]'); await pg.wait_for_timeout(300); sc2 = await E("()=>S.ed.layers.find(x=>x.id==='w1').sc"); out["hist"] = [n0, n1, sc1, sc2, hs]
        chk("history: two slider steps are two named rows (the current one marked), a tap on the earlier one puts the size back to 50 %, the history opens from a long press on Undo (v208: no clock button in the row)", sc1 == 70 and n1 >= n0 + 2 and hs["rows"] == n1 and hs["on"] == str(n1 - 1) and hs["btn"] and any("Size" in n for n in hs["names"]) and sc2 == 50, out["hist"])
        chk("page: no errors", not errs, errs[:3]); await ctx.close(); await b.close()
try: asyncio.run(main())
finally:
    srv.terminate()
    try: srv.wait(timeout=5)
    except Exception: srv.kill()
    if os.environ.get("KEEP_LOG"): subprocess.run(["cp", D + "/server.log", os.environ["KEEP_LOG"]])
    subprocess.run(["rm", "-rf", D])
print(json.dumps({"out": out, "fails": fails}, ensure_ascii=False, default=str)[:3000]); sys.exit(1 if fails else 0)
