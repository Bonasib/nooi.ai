# v196 — the editor towards After Effects / Premiere / DaVinci, phase 3 (docs/EDITOR_PRO_ROADMAP.md gaps 13–15). A real nooi server,
# three "angles" of one moment (red / blue / green clips whose clicks are 0.8 s late and 0.5 s early), a 1080p clip, a grey picture,
# a white square:
#  · multicam: the two other angles are lined up by their sound (offsets within 50 ms, the late one trimmed, the early one shifted),
#    leave the clips track and become full-frame layers; cuts choose which angle shows (red → blue → green by time); the switch
#    sheet has a tile per angle and a tap adds a cut; undo puts the clips back
#  · proxies: a 540 px copy is made on the server; the preview reads it (960 px wide element), an export reads the original (1920)
#  · 3D camera: a dolly keyframe makes the layer grow; the aperture blurs a layer off the focus plane; a red light tints its near
#    side; it casts a shadow away from the light; a tilt narrows it
#  · team review: a review link lets a second account open the project but not save; a comment from it shows as a pin on the frame
#    and in the Team sheet; an email invite with the edit role lets a third account save; versions save and restore; leaving works
# Run: python3 tests/v196.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error, uuid
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8656; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v196-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=180)
CLICKS = "(between(T,1,1.15)+between(T,2.2,2.35)+between(T,3.1,3.4))"
def angle(name, colour, shift):
    expr = "sin(2*PI*1000*t)*0.8*" + CLICKS.replace("T", "(t-(%s))" % shift)
    FF("-f", "lavfi", "-i", f"color=c={colour}:s=640x360:rate=30:duration=6", "-f", "lavfi", "-i", f"aevalsrc=exprs='{expr}':s=48000:d=6",
       "-map", "0:v", "-map", "1:a", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "400k", "-c:a", "libopus", "-b:a", "96k", "-shortest", M + name)
angle("angleA.webm", "0xff0000", "0"); angle("angleB.webm", "0x0000ff", "0.8"); angle("angleC.webm", "0x00ff00", "-0.5")
FF("-f", "lavfi", "-i", "testsrc2=s=1920x1080:rate=24:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "1500k", "-an", M + "heavy.webm")
FF("-f", "lavfi", "-i", "color=c=0x808080:s=640x360", "-frames:v", "1", M + "grey.png")
FF("-f", "lavfi", "-i", "color=c=white:s=256x256", "-frames:v", "1", M + "white.png")
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="e" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", AGENTS_AUTO_LEARN="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
near = lambda a, b, tol=30: all(abs(a[i] - b[i]) <= tol for i in range(3))
def api(path, body=None, method=None, user=None):
    data = None if body is None else json.dumps(body).encode(); h = {"Content-Type": "application/json"}
    if user: h["X-Dev-User"] = user
    req = urllib.request.Request(B + path, data=data, method=method or ("POST" if body is not None else "GET"), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def upload(path):
    bnd = uuid.uuid4().hex; data = open(path, "rb").read()
    body = (f"--{bnd}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{os.path.basename(path)}\"\r\nContent-Type: video/webm\r\n\r\n").encode() + data + f"\r\n--{bnd}--\r\n".encode()
    req = urllib.request.Request(B + "/v1/uploads", data=body, method="POST", headers={"Content-Type": f"multipart/form-data; boundary={bnd}"})
    with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())["url"]
SETUP = """async(heavy)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
 const now=Date.now(),mk=(id,kind,url,dur)=>({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url});
 S.jobs.push(mk('j_a','video','/media/angleA.webm',6),mk('j_b','video','/media/angleB.webm',6),mk('j_c','video','/media/angleC.webm',6),mk('j_heavy','video',heavy,3),mk('j_grey','image','/media/grey.png'),mk('j_white','image','/media/white.png'));
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.layers=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];S.ed.fit='contain';S.ed.zoom=60;
 for(const id of ['j_a','j_b','j_c'])await edUseJob(S.jobs.find(j=>j.id===id),{stay:true,quiet:true,t:1});S.ed.clips.forEach(c=>{c.in=0;c.out=6;c.speed=1});S.ed.sel=S.ed.clips[0].id;
 window.__t=[];toast=(o=>function(m){window.__t.push(String(m));return o.apply(this,arguments)})(toast);go('edit');renderAll()}"""
READY = "()=>S.ed.clips.length===3&&S.ed.clips.every(c=>{const m=M['c_'+c.id];return m&&m.el&&m.el.readyState>=2})"
PIX = """(a)=>{ED.playing=false;ED.t=a[0];edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d');return Array.from(x.getImageData(Math.round(c.width*a[1]),Math.round(c.height*a[2]),1,1).data).slice(0,3)}"""
BBOX = """(t)=>{ED.playing=false;ED.t=t;edTick(performance.now());edTick(performance.now());const c=document.getElementById('wk'),x=c.getContext('2d'),W=c.width,H=c.height,d=x.getImageData(0,0,W,H).data;let x0=W,x1=-1,y0=H,y1=-1;
 for(let y=0;y<H;y+=2)for(let X=0;X<W;X+=2){const i=(y*W+X)*4;if(d[i]>235&&d[i+1]>235&&d[i+2]>235){if(X<x0)x0=X;if(X>x1)x1=X;if(y<y0)y0=y;if(y>y1)y1=y}}return x1<0?null:{x0,x1,y0,y1,w:x1-x0,h:y1-y0,W,H}}"""
PX = "(a)=>{const c=document.getElementById('wk'),x=c.getContext('2d');return Array.from(x.getImageData(a[0],a[1],1,1).data).slice(0,3)}"

async def main():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    heavy = upload(M + "heavy.webm"); out["heavy"] = heavy
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
        await E(SETUP, heavy); await pg.wait_for_function(READY, timeout=30000)
        # ---- 13a. multicam
        ids = await E("()=>S.ed.clips.map(c=>c.id)")
        mc = await E("async(a)=>{const r=await mcMake196(a[0],[a[1],a[2]]);return r?{angles:r.angles.map(x=>({name:x.name,ly:x.ly})),layers:S.ed.layers.map(L=>({id:L.id,start:L.start,end:L.end,in196:L.in196,off:L.off196,score:L.score196,mc:L.mc196})),clips:S.ed.clips.length,cuts:r.cuts}:null}", ids)
        out["mc"] = mc
        chk("multicam: two angles lined up by sound — the late one (B, +0.8 s) trimmed by 0.8 s from a start of 0, the early one (C, −0.5 s) starting at 0.5 s; both now full-frame layers, one clip left on the track",
            bool(mc) and len(mc["layers"]) == 2 and abs(mc["layers"][0]["off"] - 0.8) < .05 and abs(mc["layers"][0]["in196"] - 0.8) < .05 and mc["layers"][0]["start"] < .02 and abs(mc["layers"][1]["off"] + 0.5) < .05 and abs(mc["layers"][1]["start"] - 0.5) < .05 and mc["layers"][1]["in196"] == 0 and mc["clips"] == 1, mc)
        if mc:
            await pg.wait_for_function("()=>S.ed.layers.every(L=>{const m=M['ly_'+L.id];return m&&m.el&&m.el.readyState>=2})", timeout=20000)
            await E("()=>{S.ed.mc196.cuts=[{t:0,a:0},{t:2,a:1},{t:4,a:2}];persist()}")
            c1 = await E(PIX, [1, .5, .5]); await pg.wait_for_timeout(250); c3 = await E(PIX, [3, .5, .5]); await pg.wait_for_timeout(250); c3 = await E(PIX, [3, .5, .5]); c5 = await E(PIX, [5, .5, .5]); await pg.wait_for_timeout(250); c5 = await E(PIX, [5, .5, .5])
            out["cuts"] = [c1, c3, c5]; chk("cuts choose the angle: red at 1 s (main), blue at 3 s, green at 5 s", near(c1, [255, 0, 0]) and near(c3, [0, 0, 255]) and near(c5, [0, 255, 0]), out["cuts"])
            await E("()=>mcSheet196()"); await pg.wait_for_selector("#mc196tiles", timeout=5000); await pg.wait_for_timeout(300)
            sh = await E("()=>({tiles:document.querySelectorAll('#mc196tiles .mc196a').length,cuts:document.querySelectorAll('#mc196cuts .mc196c').length,on:[...document.querySelectorAll('#mc196tiles .mc196a')].findIndex(b=>b.getAttribute('aria-pressed')==='true')})")
            await E("()=>{ED.t=5.5;document.querySelectorAll('#mc196tiles .mc196a')[1].click()}"); await pg.wait_for_timeout(200)
            cut = await E("()=>({a:mcCutAt196(5.6),n:S.ed.mc196.cuts.length,rows:document.querySelectorAll('#mc196cuts .mc196c').length})"); out["sheet"] = [sh, cut]
            chk("the switch sheet: a tile per angle (3), the cut list (3), the active tile marked; a tap on angle 2 at 5.5 s adds a cut to it", sh["tiles"] == 3 and sh["cuts"] == 3 and sh["on"] == 2 and cut["a"] == 1 and cut["n"] == 4 and cut["rows"] == 4, out["sheet"])
            await E("()=>{document.querySelector('[data-act=mc196-off]').click()}"); await pg.wait_for_timeout(300)
            undo = await E("()=>({clips:S.ed.clips.length,layers:S.ed.layers.length,mc:!!S.ed.mc196,sheet:!!document.getElementById('mc196tiles')})"); out["undo"] = undo
            chk("undo multicam: the angle clips are back on the track, the layers gone, the sheet closed", undo["clips"] == 3 and undo["layers"] == 0 and not undo["mc"] and not undo["sheet"], undo)
        # ---- 13b. proxies
        await E("async()=>{S.ed.clips=[];S.ed.layers=[];await edUseJob(S.jobs.find(j=>j.id==='j_heavy'),{stay:true,quiet:true,t:1});S.ed.clips[0].in=0;S.ed.clips[0].out=3;S.ed.sel=S.ed.clips[0].id;renderView()}")
        await pg.wait_for_function("()=>S.ed.clips.length===1&&(()=>{const m=M['c_'+S.ed.clips[0].id];return m&&m.el&&m.el.readyState>=2&&m.el.videoWidth===1920})()", timeout=30000)
        await E("()=>pxMake196()")
        try: await pg.wait_for_function("()=>Object.keys((S.ed.px196||{}).map||{}).length===1", timeout=240000); made = True
        except Exception: made = False
        out["px"] = await E("()=>({st:PX196.st,map:S.ed.px196&&S.ed.px196.map,on:S.ed.px196&&S.ed.px196.on})")
        chk("a proxy is made on the server for the 1080p clip (status done, a -px196.webm address) and proxies switch on", made and out["px"]["on"] and all("-px196.webm" in v for v in out["px"]["map"].values()), out["px"])
        if made:
            await E(PIX, [1, .5, .5]); await pg.wait_for_function("()=>{const m=M['c_'+S.ed.clips[0].id];return m&&m.px196&&m.el.readyState>=2}", timeout=30000)
            pv = await E("()=>{const m=M['c_'+S.ed.clips[0].id];return {px:!!m.px196,w:m.el.videoWidth,url:m.url,src:m.el.currentSrc.replace(location.origin,'')}}"); out["pv"] = pv
            chk("the preview reads the proxy (960 px wide element) while the clip keeps its original address", pv["px"] and pv["w"] == 960 and "-px196" in pv["src"] and "-px196" not in (pv["url"] or ""), pv)
            ex = await E("()=>{R139.on=true;R139.mine=true;try{edTick(performance.now())}finally{R139.on=false;R139.mine=false}const m=M['c_'+S.ed.clips[0].id];const r={px:!!m.px196,w:m.el.videoWidth};edTick(performance.now());r.back=!!M['c_'+S.ed.clips[0].id].px196;return r}"); out["ex"] = ex
            chk("an export frame reads the original (1920 px) and the preview goes back to the proxy after it", not ex["px"] and ex["w"] == 1920 and ex["back"], ex)
            off = await E("()=>{S.ed.px196.on=false;edTick(performance.now());return !!M['c_'+S.ed.clips[0].id].px196}"); chk("proxies off → the original is back", off is False, off)
        # ---- 14. 3D camera, depth of field, lights, shadows, tilt
        await E("async()=>{S.ed.clips=[];S.ed.layers=[];S.ed.px196={on:false,map:{}};await edUseJob(S.jobs.find(j=>j.id==='j_grey'),{stay:true,quiet:true,t:3});S.ed.clips[0].in=0;S.ed.clips[0].out=3;S.ed.sel=S.ed.clips[0].id;"
                "const Ly={id:'w1',name:'w',start:0,end:3,x:.5,y:.5,sc:30,rot:0,op:100,key:'none',anim:'none',shape:'none',blend:'source-over'};slotUrl139('ly_w1',{url:'/media/white.png',type:'image',name:'w'});S.ed.layers.push(Ly);S.ed.selLayer='w1';S.ed.cam196={on:false,x:0,y:0,z:0,fl:50,focus:0,ap:16,rx:0,ry:0,amb:100,kf:[]};S.ed.lights196=[];renderView()}")
        await pg.wait_for_function("()=>{const m=M['c_'+S.ed.clips[0].id],l=M['ly_w1'];return m&&m.el&&m.el.complete&&l&&l.el&&l.el.complete&&l.el.naturalWidth>0}", timeout=15000)
        b0 = await E(BBOX, 0.2); out["b0"] = b0
        chk("the white layer draws sharp at 30 % of the width with the camera off", bool(b0) and abs(b0["w"] - b0["W"] * .3) < b0["W"] * .02, b0)
        await E("()=>{S.ed.cam196.on=true;S.ed.cam196.kf=[{id:'a',t:0,z:0,ez:'linear'},{id:'b',t:2,z:40,ez:'linear'}]}")
        b1 = await E(BBOX, 1.0); b2 = await E(BBOX, 2.0); out["dolly"] = [b1, b2]
        chk("a dolly keyframe (z 0 → +40 over 2 s, the camera moving forward) makes the layer bigger half-way and bigger again at the end", bool(b1) and bool(b2) and b1["w"] > b0["w"] * 1.1 and b2["w"] > b1["w"] * 1.1, out["dolly"])
        await E("()=>{S.ed.cam196.kf=[];S.ed.cam196.ap=1.4;S.ed.cam196.focus=120}")
        bd = await E(BBOX, 0.2); sharp_out = await E(PX, [b0["x1"] + 10, (b0["y0"] + b0["y1"]) // 2]); soft_in = await E(PX, [b0["x1"] - 10, (b0["y0"] + b0["y1"]) // 2]); out["dof"] = [bd, sharp_out, soft_in]
        chk("depth of field: at f/1.4 with the focus plane 120 units away the layer's edge softens — a pixel 10 px outside the sharp edge is brighter than the grey, one 10 px inside is no longer pure white", bool(bd) and sharp_out[0] > 150 and soft_in[0] < 245, out["dof"])
        await E("()=>{S.ed.cam196.ap=16;S.ed.cam196.focus=0;S.ed.cam196.on=false;S.ed.lights196=[{id:'l',x:.2,y:.5,z:-40,col:'#ff0000',int:150,r:120,on:true}]}")
        bl = await E(BBOX, 0.2); left = await E(PX, [b0["x0"] + 10, (b0["y0"] + b0["y1"]) // 2]); right = await E(PX, [b0["x1"] - 10, (b0["y0"] + b0["y1"]) // 2]); out["light"] = [left, right]
        chk("a red light at the left tints the layer's near side red (R well above G) more than its far side", left[0] - left[1] > 40 and (left[0] - left[1]) > (right[0] - right[1]) + 10, out["light"])
        await E("()=>{S.ed.layers[0].shd196=true}"); await E(BBOX, 0.2); shadow = await E(PX, [b0["x1"] + 14, (b0["y0"] + b0["y1"]) // 2]); noshadow = await E(PX, [b0["x0"] - 14, (b0["y0"] + b0["y1"]) // 2]); out["shadow"] = [shadow, noshadow]
        chk("the layer casts a shadow away from the light (darker than the grey to its right, not to its left)", shadow[0] < 112 and noshadow[0] > 118, out["shadow"])
        await E("()=>{S.ed.layers[0].shd196=false;S.ed.lights196=[];S.ed.layers[0].ry196=40}"); bt = await E(BBOX, 0.2); out["tilt"] = bt
        chk("a 40° tilt narrows the layer to about cos 40° of its width", bool(bt) and abs(bt["w"] / b0["w"] - .766) < .08, out["tilt"])
        await E("()=>{S.ed.layers[0].ry196=0;S.ed.tab='layers';renderView()}"); await pg.wait_for_timeout(200)
        ui = await E("()=>({cam:!!document.querySelector('[data-act=cam196]'),mc:!!document.querySelector('[data-act=mc196]'),depth:!!document.querySelector('[data-edx=\"ly.z196\"]'),shd:!!document.querySelector('[data-act=ly196-shd]')})")
        await E("()=>document.querySelector('[data-act=cam196]').click()"); await pg.wait_for_timeout(250)
        cam = await E("()=>({sliders:document.querySelectorAll('[data-cam196]').length,presets:document.querySelectorAll('[data-act=cam196-preset]').length,add:!!document.querySelector('[data-act=cam196-ladd]')})")
        await E("()=>document.querySelector('[data-act=cam196-preset][data-v=dolly]').click()"); await pg.wait_for_timeout(250)
        pre = await E("()=>({on:S.ed.cam196.on,kf:S.ed.cam196.kf.length,z:S.ed.cam196.kf.map(k=>k.z)})"); await E("()=>document.querySelector('[data-act=cam196-ladd]').click()"); await pg.wait_for_timeout(200)
        lt = await E("()=>({n:S.ed.lights196.length,rows:document.querySelectorAll('.lt196').length})"); out["ui"] = [ui, cam, pre, lt]
        chk("the layers panel has the camera and multicam buttons and the layer's depth / tilt / shadow controls; the camera sheet has sliders, presets and lights; the Dolly preset sets two keyframes; a light is added", ui["cam"] and ui["mc"] and ui["depth"] and ui["shd"] and cam["sliders"] >= 9 and cam["presets"] == 5 and cam["add"] and pre["on"] and pre["kf"] == 2 and pre["z"] == [0, 35] and lt["n"] == 1 and lt["rows"] == 1, out["ui"])
        await E("()=>{closeSheet();S.ed.cam196={on:false,x:0,y:0,z:0,fl:50,focus:0,ap:16,rx:0,ry:0,amb:100,kf:[]};S.ed.lights196=[]}")
        # ---- 15. team review
        pid = await E("async()=>{S.ed.title='Team test';await save139(false);return S.ed.srv139}"); out["pid"] = pid
        chk("the project saves to the account", bool(pid), pid)
        if pid:
            s, link = api(f"/v1/projects/{pid}/share196/link", {"role": "review"}); tok = (link.get("link") or {}).get("token")
            s2, joined = api("/v1/projects196/join", {"token": tok}, user="bob"); out["join"] = [s, s2, joined]
            chk("a review link: a second account joins with it and gets the review role", s == 200 and bool(tok) and s2 == 200 and joined.get("id") == pid and joined.get("role") == "review", out["join"])
            s3, lst = api("/v1/projects", user="bob"); row = next((p for p in lst.get("projects", []) if p["id"] == pid), None)
            s4, doc = api(f"/v1/projects/{pid}", user="bob"); s5, put = api(f"/v1/projects/{pid}", {"name": "x", "doc": doc.get("doc")}, method="PUT", user="bob"); out["bob"] = [s3, row, s4, s5, put]
            chk("the reviewer lists the shared project (shared196.role review), opens it, and is refused a save (403)", s3 == 200 and row and row.get("shared196", {}).get("role") == "review" and s4 == 200 and (doc.get("shared196") or {}).get("role") == "review" and s5 == 403, out["bob"])
            s6, cm = api(f"/v1/projects/{pid}/comments196", {"text": "Fix the title here", "t": 1.2, "x": .3, "y": .4, "name": "Bob"}, user="bob"); s7, own = api(f"/v1/projects/{pid}/comments196")
            out["comment"] = [s6, cm.get("comment"), s7, len(own.get("comments", []))]
            chk("the reviewer comments on a frame; the owner sees it", s6 == 200 and s7 == 200 and len(own.get("comments", [])) == 1 and own["comments"][0]["byName"] == "Bob" and abs(own["comments"][0]["t"] - 1.2) < .01, out["comment"])
            s8, inv = api(f"/v1/projects/{pid}/share196", {"email": "carol@dev.local", "role": "edit"}); s9, cl = api("/v1/projects", user="carol"); crow = next((p for p in cl.get("projects", []) if p["id"] == pid), None)
            s10, cdoc = api(f"/v1/projects/{pid}", user="carol"); d2 = cdoc.get("doc") or {}; d2.setdefault("ed", {})["zoom"] = 99
            s11, cput = api(f"/v1/projects/{pid}", {"name": "Team test", "doc": d2}, method="PUT", user="carol"); s12, sv = api(f"/v1/projects/{pid}/share196"); out["carol"] = [s8, inv.get("invites"), s9, crow and crow.get("shared196"), s11, cput.get("shared196"), sv.get("members")]
            chk("an email invite with the edit role is claimed at the third account's first project listing; it can save; the owner's share view lists it as a member", s8 == 200 and len(inv.get("invites", [])) == 1 and s9 == 200 and crow and crow["shared196"]["role"] == "edit" and s11 == 200 and any(m.get("email") == "carol@dev.local" and m.get("role") == "edit" for m in sv.get("members", [])), out["carol"])
            s13, v1 = api(f"/v1/projects/{pid}/versions196", {"name": "first"}); s14, bad = api(f"/v1/projects/{pid}/versions196", {"name": "nope"}, user="bob")
            s15, cur = api(f"/v1/projects/{pid}"); d3 = cur.get("doc"); d3["ed"]["zoom"] = 42; api(f"/v1/projects/{pid}", {"name": "Team test", "doc": d3}, method="PUT")
            s16, rs = api(f"/v1/projects/{pid}/versions196/1/restore", {}); s17, after = api(f"/v1/projects/{pid}"); out["versions"] = [s13, v1.get("version"), s14, s16, (after.get("doc") or {}).get("ed", {}).get("zoom")]
            chk("versions: the owner saves one (the reviewer may not), changes the project, restores the version — the change is undone", s13 == 200 and (v1.get("version") or {}).get("n") == 1 and s14 == 403 and s16 == 200 and (after.get("doc") or {}).get("ed", {}).get("zoom") == 99, out["versions"])
            # the page: the Team button, the sheet, the pin on the frame, a comment placed from the picture
            await E("async(id)=>{await open139(id);renderView()}", pid); await pg.wait_for_function("()=>TEAM196.pid===S.ed.srv139&&TEAM196.role==='owner'&&TEAM196.comments.length===1", timeout=15000)
            btn = await E("()=>({btn:!!document.querySelector('[data-act=tm196]'),badge:(document.querySelector('.tm196b .n')||{}).textContent})")
            pin = await E(PIX, [1.2, .3, .4]); far = await E(PIX, [2.5, .3, .4]); out["pin"] = [btn, pin, far]
            chk("the Team button shows one open comment; its pin draws on the frame at 1.2 s (lime) and not at 2.5 s", btn["btn"] and btn["badge"] == "1" and near(pin, [207, 225, 62], 40) and near(far, [128, 128, 128], 30), out["pin"])
            await E("()=>document.querySelector('[data-act=tm196]').click()"); await pg.wait_for_function("()=>document.querySelectorAll('#tm196 .tm196c').length===1&&document.querySelectorAll('[data-act=tm196-tab]').length===3", timeout=10000)
            sheet = await E("()=>({tabs:document.querySelectorAll('[data-act=tm196-tab]').length,rows:document.querySelectorAll('#tm196 .tm196c').length,text:document.querySelector('#tm196 .tm196x div').textContent})")
            await E("()=>document.querySelector('[data-act=tm196-tab][data-v=share]').click()"); await pg.wait_for_timeout(200)
            share = await E("()=>({members:document.querySelectorAll('#tm196 .tm196c').length,link:!!document.getElementById('tm196url')})")
            await E("()=>document.querySelector('[data-act=tm196-tab][data-v=versions]').click()"); await pg.wait_for_timeout(200)
            vers = await E("()=>({rows:document.querySelectorAll('#tm196 .tm196c').length,restore:document.querySelectorAll('[data-act=tm196-vrestore]').length})"); out["sheet196"] = [sheet, share, vers]
            chk("the Team sheet: three tabs for the owner; the comment row with its words; the share tab lists the two members (link + invite) and the link; the versions tab lists the version with Restore", sheet["tabs"] == 3 and sheet["rows"] == 1 and "Fix the title" in sheet["text"] and share["members"] == 2 and share["link"] and vers["rows"] == 1 and vers["restore"] == 1, out["sheet196"])
            await E("()=>document.querySelector('[data-act=tm196-tab][data-v=comments]').click()"); await pg.wait_for_timeout(150); await E("()=>document.querySelector('[data-act=tm196-add]').click()"); await pg.wait_for_timeout(300)
            ov = await E("()=>{const o=document.getElementById('ov196');if(!o)return null;const r=o.getBoundingClientRect();return {x:r.x+r.width*.6,y:r.y+r.height*.5,place:TEAM196.place}}"); out["ov"] = ov
            if ov:
                await pg.mouse.click(ov["x"], ov["y"]); await pg.wait_for_selector("#cmf196 textarea", timeout=5000); await pg.fill("#cmf196 textarea", "Move the logo up"); await E("()=>document.querySelector('[data-act=tm196-send]').click()")
                await pg.wait_for_function("()=>TEAM196.comments.length===2&&!document.getElementById('cmf196')", timeout=10000)
            s18, own2 = api(f"/v1/projects/{pid}/comments196"); mine = [c for c in own2.get("comments", []) if c["text"] == "Move the logo up"]; out["placed"] = [ov, len(own2.get("comments", [])), mine and (mine[0]["x"], mine[0]["y"], mine[0]["byName"])]
            chk("a comment placed from the picture: the overlay takes the tap at 60 % / 50 %, the box sends the words, the owner's name is on it", bool(ov) and ov["place"] and len(mine) == 1 and abs(mine[0]["x"] - .6) < .03 and abs(mine[0]["y"] - .5) < .03 and mine[0]["byName"] == "T", out["placed"])
            s19, left = api(f"/v1/projects/{pid}", method="DELETE", user="bob"); s20, lst2 = api("/v1/projects", user="bob"); out["leave"] = [s19, left, [p["id"] for p in lst2.get("projects", [])]]
            chk("the reviewer leaves the share; the project is no longer in their list, and the owner still has it", s19 == 200 and left.get("left") and pid not in [p["id"] for p in lst2.get("projects", [])] and api(f"/v1/projects/{pid}")[0] == 200, out["leave"])
        out["errors"] = errs; chk("no page errors", not errs, errs)
        await b.close()
    print(json.dumps({"fails": fails, **{k: v for k, v in out.items() if k in ("mc", "px", "pv", "ex", "dolly", "dof", "light", "shadow", "tilt", "join", "versions", "pin", "placed", "errors")}}, ensure_ascii=False, default=str, indent=1)[:9000])
try: asyncio.run(main())
finally:
    srv.terminate()
    try: srv.wait(timeout=5)
    except Exception: srv.kill()
    import shutil; shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
