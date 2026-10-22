# v130 "check the drawing code and the drawing page for the sketch" — Sketch to life with a real nooi server, a stand-in engine
# and a stand-in vision AI, on a computer and on a phone (real touch input):
#  · a marker / brush line is even along its whole length (it was a row of darker beads where its pieces overlapped) — while
#    you draw and after; the eraser cuts it clean
#  · a cancelled touch ends the line (moving the pointer afterwards draws nothing); a second finger while you draw neither
#    replaces nor adds to the line
#  · on a computer the paper and its tools fit the screen; the paper is redrawn sharp when the window changes size; lines
#    land where the pointer was
#  · Preview with AI: the drawing is read when nothing was typed (the field fills), four versions are sent with the drawing,
#    the first picture lands on the paper, on a phone the paper comes into view; undo / redo / clear, a reload keeps the drawing
# Run: python3 tests/v130s.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from PIL import Image
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8356, 8357
D = tempfile.mkdtemp(prefix="nooi-v130s-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
Image.new("RGB", (1024, 1024), (40, 120, 200)).save(D + "/res.png")
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "vision": 0}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.png":
            b = open(DIR + "/res.png", "rb").read(); self.send_response(200); self.send_header("content-type", "image/png"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/res.png"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/v1/messages":
            st["vision"] += 1
            return self.send({"content": [{"type": "text", "text": json.dumps({"subject": "a house with a tree", "objects": ["house", "tree"], "target": "environment", "label": "a house with a tree"})}]})
        st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "data": {"taskId": "t%d" % len(st["reqs"])}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
stats = lambda: json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
# the alpha along a row / a column of the paper (fractions of its size)
ROW = """([y,x0,x1])=>{const c=document.getElementById('skcv'),d=c.getContext('2d').getImageData(Math.round(x0*c.width),Math.round(y*c.height),Math.round((x1-x0)*c.width),1).data,a=[];for(let i=3;i<d.length;i+=4)a.push(d[i]);return a}"""
PIX = """([x,y])=>{const c=document.getElementById('skcv');return c.getContext('2d').getImageData(Math.round(x*c.width),Math.round(y*c.height),1,1).data[3]}"""
async def mouse_line(pg, pts, up=True):
    b = await pg.locator("#skcv").bounding_box(); xy = [(b["x"] + b["width"] * x, b["y"] + b["height"] * y) for x, y in pts]
    await pg.mouse.move(*xy[0]); await pg.mouse.down()
    for p in xy[1:]: await pg.mouse.move(*p, steps=10)
    if up: await pg.mouse.up()
    await pg.wait_for_timeout(120)
CDP = {}
async def touch(pg, steps):   # steps: [(type, [(id, x, y)…])] in paper fractions
    b = await pg.locator("#skcv").bounding_box()
    if pg not in CDP: CDP[pg] = await pg.context.new_cdp_session(pg)   # (one session: a touch started in one goes on in the next call)
    for t, pts in steps:
        await CDP[pg].send("Input.dispatchTouchEvent", {"type": t, "touchPoints": [{"x": b["x"] + b["width"] * x, "y": b["y"] + b["height"] * y, "id": i} for i, x, y in pts]})
    await pg.wait_for_timeout(150)
def tline(i, a, z, n=12): return [("touchMove", [(i, a[0] + (z[0] - a[0]) * k / n, a[1] + (z[1] - a[1]) * k / n)]) for k in range(1, n + 1)]
async def open_sketch(pg, lang):
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    await pg.evaluate("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;SK.strokes=[];SK.redo=[];Object.assign(S.sketch,{tool:'pen',color:'#1b1b1b',size:6,prompt:'',n91:1,pic94:null,k94:0,v94:'draw',pend94:null,live95:false});go('sketch');renderAll()}", lang)
    await pg.wait_for_timeout(800)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- a computer
        ctx = await b.new_context(viewport={"width": 1280, "height": 860}); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
        await open_sketch(pg, "en")
        fit = await E("""()=>{const c=document.getElementById('skcv').getBoundingClientRect(),t=[...document.querySelectorAll('#main .sk91bar .tile,#main .skc,#main input[data-bind="sketch.size"]')].map(x=>x.getBoundingClientRect());
          return{paper:Math.round(c.width),top:Math.round(c.top),bottom:Math.round(Math.max(...t.map(r=>r.bottom))),vh:innerHeight,square:Math.abs(c.width-c.height)<1}}""")
        out["fit"] = fit
        ok(fit["paper"] >= 320 and fit["bottom"] <= fit["vh"] and fit["square"], f"a computer: the paper and every tool fit the screen {fit}")
        # where a line lands
        await mouse_line(pg, [(.2, .2), (.8, .2)])
        land = await E("""()=>{const c=document.getElementById('skcv'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let y0=1e9,y1=-1,x0=1e9,x1=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>128){y0=Math.min(y0,y);y1=Math.max(y1,y);x0=Math.min(x0,x);x1=Math.max(x1,x)}
          return{y:+((y0+y1)/2/c.height).toFixed(3),x0:+(x0/c.width).toFixed(3),x1:+(x1/c.width).toFixed(3)}}""")
        ok(abs(land["y"] - .2) < .01 and abs(land["x0"] - .2) < .02 and abs(land["x1"] - .8) < .02, f"the line lands where the pointer was {land}")
        # a marker line, while drawing and after: even along its length
        await pg.click("[data-act='sk-tool'][data-v='marker']"); await pg.click("[data-act='sk-color'][data-v='#e53935']")
        await mouse_line(pg, [(.15, .5), (.85, .5)], up=False); await pg.wait_for_timeout(100)
        live = await E(ROW, [.5, .25, .75]); await pg.mouse.up(); await pg.wait_for_timeout(150)
        done = await E(ROW, [.5, .25, .75])
        out["marker"] = {"live": [min(live), max(live)], "done": [min(done), max(done)]}
        ok(max(live) - min(live) <= 3 and max(done) - min(done) <= 3 and 120 <= min(done) <= 160, f"a marker line is even along its length, while drawing and after (no beads) {out['marker']}")
        await pg.click("[data-act='sk-tool'][data-v='brush']"); await mouse_line(pg, [(.15, .65), (.85, .65)])
        br = await E(ROW, [.65, .25, .75]); out["brush"] = [min(br), max(br)]
        ok(max(br) - min(br) <= 3 and min(br) >= 200, f"a brush line too {out['brush']}")
        # the eraser cuts the marker line clean
        await pg.click("[data-act='sk-tool'][data-v='eraser']"); await pg.fill("input[data-bind='sketch.size']", "14"); await pg.dispatch_event("input[data-bind='sketch.size']", "input"); await pg.wait_for_timeout(100)
        await mouse_line(pg, [(.5, .42), (.5, .58)])
        cut = await E(ROW, [.5, .44, .56]); z = [i for i, v in enumerate(cut) if v == 0]
        out["cut"] = {"zeros": len(z), "max": max(cut), "run": (z[-1] - z[0] + 1) if z else 0}
        ok(len(z) >= 8 and z[-1] - z[0] + 1 == len(z) and max(cut) <= 145, f"the eraser cuts it clean: one gap, nothing left inside, nothing darker at its edges {out['cut']}")
        # undo / redo / clear (a second tap)
        n0 = await E("()=>SK.strokes.length")
        await pg.click("[data-act='sk-undo']"); u = await E(PIX, [.5, .5]); await pg.click("[data-act='sk-redo']"); r = await E(PIX, [.5, .5])
        ok(n0 == 4 and u > 100 and r == 0 and await E("()=>SK.strokes.length") == 4, f"undo brings the cut part back, redo cuts it again {n0} {u} {r}")
        # the window changes size: the paper is redrawn sharp, the drawing in place
        await pg.set_viewport_size({"width": 1000, "height": 760}); await pg.wait_for_timeout(500)
        rs = await E("()=>{const c=document.getElementById('skcv');return{w:c.width,css:Math.round(c.getBoundingClientRect().width)}}"); rs["pix"] = await E(PIX, [.5, .2])
        ok(abs(rs["w"] - rs["css"]) <= 1 and rs["pix"] > 128, f"a smaller window: the paper redrawn at its new size, the drawing in place {rs}")
        await pg.set_viewport_size({"width": 1280, "height": 860}); await pg.wait_for_timeout(400)
        ok(not errs, f"no page errors on a computer {errs[:3]}")
        await ctx.close()

        # ---- a phone, real touch, in Arabic
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
        await open_sketch(pg, "ar")
        await touch(pg, [("touchStart", [(1, .2, .3)])] + tline(1, (.2, .3), (.8, .3)) + [("touchEnd", [])])
        t1 = await E("()=>({n:SK.strokes.length,cur:!!SK.cur})")
        ok(t1 == {"n": 1, "cur": False}, f"a finger draws a line {t1}")
        # a cancelled touch ends the line; moving the mouse afterwards draws nothing
        await touch(pg, [("touchStart", [(2, .2, .5)])] + tline(2, (.2, .5), (.5, .5), 6) + [("touchCancel", [])])
        c1 = await E("()=>({n:SK.strokes.length,cur:!!SK.cur,pts:SK.strokes[SK.strokes.length-1].pts.length})")
        bb = await pg.locator("#skcv").bounding_box(); await pg.mouse.move(bb["x"] + 300, bb["y"] + 10); await pg.mouse.move(bb["x"] + 20, bb["y"] + 300, steps=8); await pg.wait_for_timeout(120)
        c2 = await E("()=>({n:SK.strokes.length,cur:!!SK.cur,pts:SK.strokes[SK.strokes.length-1].pts.length})")
        out["cancel"] = [c1, c2]
        ok(c1["n"] == 2 and not c1["cur"] and c1["pts"] >= 4 and c2 == c1, f"a cancelled touch ends the line where it was; moving afterwards draws nothing {out['cancel']}")
        # a second finger while drawing: the line stays one line, from the first finger only
        # (the second finger is sent as pointer events: the DevTools touch command lifts the first finger when a second one comes)
        await touch(pg, [("touchStart", [(3, .2, .8)])] + tline(3, (.2, .8), (.4, .8), 5))
        await E("""()=>{const cv=document.getElementById('skcv'),r=cv.getBoundingClientRect(),ev=(t,x,y)=>cv.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:99,pointerType:'touch',isPrimary:false,clientX:r.left+r.width*x,clientY:r.top+r.height*y,buttons:t==='pointerup'?0:1}));
          ev('pointerdown',.7,.1);ev('pointermove',.75,.15);ev('pointermove',.8,.2);ev('pointerup',.8,.2)}""")
        await touch(pg, tline(3, (.4, .8), (.6, .8), 4) + [("touchEnd", [])])
        f2 = await E("()=>{const s=SK.strokes[SK.strokes.length-1];return{n:SK.strokes.length,ys:[Math.min(...s.pts.map(p=>p[1])),Math.max(...s.pts.map(p=>p[1]))].map(v=>+v.toFixed(3)),x1:+Math.max(...s.pts.map(p=>p[0])).toFixed(3),cur:!!SK.cur}}")
        out["second"] = f2
        ok(f2["n"] == 3 and f2["ys"][0] > .78 and f2["ys"][1] < .82 and f2["x1"] >= .58 and not f2["cur"], f"a second finger neither replaces the line nor adds to it {f2}")
        # Preview with AI: the drawing read (the field fills), four versions with the drawing, the first lands on the paper in view
        n0 = len(stats()["reqs"])
        await pg.tap("[data-act='sk91-n'][data-v='4']"); await pg.wait_for_timeout(200)
        await pg.locator("[data-act='sk91-go']").scroll_into_view_if_needed(); await pg.tap("[data-act='sk91-go']")
        for _ in range(40):
            await pg.wait_for_timeout(250)
            if await E("()=>!!document.querySelector('#main .skpic94')"): break
        await pg.wait_for_timeout(900)
        new = [x["body"] for x in stats()["reqs"][n0:] if x["path"].endswith("createTask")]
        pv = await E("()=>{const p=document.querySelector('#main .skpaper').getBoundingClientRect();return{what:S.sketch.prompt,field:(document.getElementById('skwhat91')||{}).value,pic:!!document.querySelector('#main .skpic94'),inview:p.top>=0&&p.bottom<=innerHeight+1}}")
        out["preview"] = {**pv, "tasks": len(new), "pics": [len((x.get("input") or {}).get("image_input") or (x.get("input") or {}).get("image_urls") or []) for x in new], "subject": ["a house with a tree" in (x.get("input") or {}).get("prompt", "") for x in new], "vision": stats()["vision"]}
        ok(len(new) == 4 and all(n == 1 for n in out["preview"]["pics"]) and all(out["preview"]["subject"]) and pv["pic"] and pv["inview"] and "house" in (pv["what"] or "") and "house" in (pv["field"] or ""),
           f"Preview with AI: the drawing read, four versions with the drawing, the first picture on the paper and the paper in view {out['preview']}")
        await pg.screenshot(path=D + "/phone.png")
        # a mark on the picture, then a reload keeps everything
        await touch(pg, [("touchStart", [(5, .3, .3)])] + tline(5, (.3, .3), (.4, .4), 5) + [("touchEnd", [])])
        mk = await E("()=>skMarks94()")
        await E("()=>persist()"); await pg.wait_for_timeout(700); await pg.reload(); await pg.wait_for_timeout(1800)
        await E("()=>{S.user={name:'T',method:'google'};go('sketch');renderAll()}"); await pg.wait_for_timeout(900)
        rl = await E("()=>({n:SK.strokes.length,pic:!!document.querySelector('#main .skpic94'),marks:skMarks94()})")
        ok(mk == 1 and rl == {"n": 4, "pic": True, "marks": 1}, f"a mark on the picture; a reload keeps the drawing, the picture and the mark {mk} {rl}")
        wide = await E("()=>document.documentElement.scrollWidth-innerWidth"); ok(wide <= 1, f"nothing off a phone's screen {wide}")
        ok(not errs, f"no page errors on a phone {errs[:3]}")
        await ctx.close(); await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "VISION_", "VSS_"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock-vision", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
        except Exception: time.sleep(.25)
    asyncio.run(main())
except Exception as e: fails.append("run: " + repr(e)[:400])
finally: srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1)[:6000])
