# v106 the character's face — its avatar. A real nooi server and a stand-in text AI that really finds the face (the red square)
# in the pictures it is sent:
#  · a character made from a front / side / back sheet: the face of the front view is found (a small face is looked at again,
#    closer) and cut out as a square around the head → the character's avatar, "Taken from the photo"
#  · the avatar is used wherever the character is shown small (the list, the @ sheet, the Characters chip, pickers)
#  · a face photo of the client's own → the avatar; "Use the face from the photo" goes back to the face found in the photo
#  · "Make it real" works from the face
#  · a new photo → its face is found again
#  · no text AI: nothing breaks, the avatar stays the photo
#  · Arabic on a phone: the field is there, nothing wider than the screen
# Run: python3 tests/v106.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, LPORT = 8305, 8306
D = tempfile.mkdtemp(prefix="nooi-v106-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
RED, GREY = (215, 30, 30), (150, 150, 150)
# a front / side / back sheet: only the front view (left) has a face (the red square), small in the picture
im = Image.new("RGB", (900, 600), "white"); g = ImageDraw.Draw(im)
for x in (80, 380, 680): g.rectangle([x, 150, x + 140, 580], fill=GREY); g.ellipse([x + 35, 50, x + 105, 130], fill=GREY)
g.rectangle([120, 60, 180, 120], fill=RED); im.save(D + "/sheet.png")
im = Image.new("RGB", (600, 800), (90, 90, 90)); ImageDraw.Draw(im).rectangle([200, 150, 400, 350], fill=RED); im.save(D + "/photo2.png")   # a big face
Image.new("RGB", (400, 500), (30, 60, 210)).save(D + "/face.png")                                                                 # the client's own face photo
MOCK = r'''
import base64, io, json, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image
st = {"face": [], "describe": 0}
def red_box(data):
    im = Image.open(io.BytesIO(base64.b64decode(data))).convert("RGB"); w, h = im.size; px = im.load(); xs = []; ys = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if r > 160 and g < 100 and b < 100: xs.append(x); ys.append(y)
    return (w, h), ([min(xs) / w, min(ys) / h, (max(xs) + 2) / w, (max(ys) + 2) / h] if len(xs) > 3 else None)
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self): self.send(st)
    def do_POST(self):
        j = json.loads(self.rfile.read(int(self.headers.get("content-length") or 0)) or b"{}"); c = (j.get("messages") or [{}])[0].get("content")
        parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
        text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text"); imgs = [p for p in parts if p.get("type") == "image"]
        if "Find the face" in text and imgs:
            size, box = red_box(imgs[0]["source"]["data"]); st["face"].append({"size": size, "found": bool(box)}); o = {"face": box}
        elif "Describe the main person" in text: st["describe"] += 1; o = {"name": "Sami", "gender": "male", "age": 30, "look": "short dark hair", "outfit": "grey t-shirt, jeans", "persona": "calm"}
        else: o = {}
        self.send({"content": [{"type": "text", "text": json.dumps(o)}]})
ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{LPORT}/stats").read())
SETUP = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;go('chars');renderAll()}"
# the colour in the middle of the character's face picture, and how much of it is the face (red)
PIX = """async()=>{const c=S.chars[S.charSel];if(!c||!c.facePic)return null;const i=new Image();await new Promise(r=>{i.onload=r;i.src=c.facePic});const k=document.createElement('canvas');k.width=k.height=64;
  const g=k.getContext('2d');g.drawImage(i,0,0,64,64);const d=g.getImageData(0,0,64,64).data,m=(32*64+32)*4;let red=0;for(let p=0;p<d.length;p+=4)if(d[p]>150&&d[p+1]<100&&d[p+2]<100)red++;
  return{mid:[d[m],d[m+1],d[m+2]],red:Math.round(red/4096*100)/100,own:!!c.faceOwn}}"""
isred = lambda p: p and p["mid"][0] > 150 and p["mid"][1] < 100 and p["mid"][2] < 100
isblue = lambda p: p and p["mid"][2] > 150 and p["mid"][0] < 100
async def wait_js(E, js, sec=30):
    for _ in range(int(sec * 4)):
        try:
            v = await E(js)
            if v: return v
        except Exception: pass
        await asyncio.sleep(.25)
    return None

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1280, "height": 900}); pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        async def jobs(route):
            if route.request.method != "POST": return await route.continue_()
            await route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "rj1"}))
        await pg.route("**/v1/jobs", jobs)
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await E(SETUP % "en"); await pg.wait_for_timeout(400)
        out["ai"] = await wait_js(E, "()=>ai106()", 10)
        ok(out["ai"], "the page sees the text AI")
        # 1) a character from a front / side / back sheet → the front view's face, found with a closer look, is its avatar
        await pg.set_input_files("input[data-chphoto=new]", D + "/sheet.png")
        await wait_js(E, "()=>{const c=S.chars[S.charSel];return c&&c.facePic&&!F106.busy.has(c.id)}", 40); await pg.wait_for_timeout(400)
        px = await E(PIX); st = stats(); note = await E("()=>(document.querySelector('.face106 small')||{}).textContent||''")
        out["sheet"] = [px, st["face"], note, await E("()=>!!document.querySelector('.av106 img')")]
        ok(isred(px) and .3 <= px["red"] <= .7 and not px["own"], f"the sheet: the face is cut out as a square around the head {px}")
        ok(len(st["face"]) == 2 and st["face"][1]["size"] == [640, 640] and all(x["found"] for x in st["face"]), f"a small face is looked at again, closer {st['face']}")
        ok("Taken from the photo" in note and out["sheet"][3], f"the face field shows the avatar, taken from the photo {out['sheet'][2:]}")
        # 2) the avatar wherever the character is shown small
        r = await E("""()=>{const c=S.chars[S.charSel],f=c.facePic;sheet87('x');const inSheet=[...document.querySelectorAll('.chpick87 img')].some(i=>i.getAttribute('src')===f);
          return[avatar106(c)===f,thumb('cp:'+c.id,{ar:'1/1'}).includes(f),inSheet,chip87('x').includes(f),!thumb('cp:'+c.id,{}).includes(f)]}""")
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
        out["avatar"] = r; ok(r == [True, True, True, True, True], f"the avatar in the list, the @ sheet and the Characters chip (the big picture stays the photo) {r}")
        # 3) the client's own face photo → the avatar; back to the face from the photo
        await pg.set_input_files("input[data-chface=cur]", D + "/face.png")
        await wait_js(E, "()=>{const c=S.chars[S.charSel];return c&&c.faceOwn&&!F106.busy.has(c.id)}", 30); await pg.wait_for_timeout(300)
        px = await E(PIX); note = await E("()=>(document.querySelector('.face106 small')||{}).textContent||''"); back = await E("()=>!!document.querySelector('[data-act=face106-clear]')")
        out["own"] = [px, note, back]
        ok(isblue(px) and px["own"] and "Your face photo" in note and back, f"the client's face photo is the avatar {out['own']}")
        await pg.click("[data-act=face106-clear]")
        await wait_js(E, "()=>{const c=S.chars[S.charSel];return c&&!c.faceOwn&&c.facePic&&!F106.busy.has(c.id)}", 40); await pg.wait_for_timeout(300)
        px = await E(PIX); out["back"] = px
        ok(isred(px) and not px["own"], f"'Use the face from the photo': the face found in the photo again {px}")
        # 4) "Make it real" works from the face
        r = await E("async()=>{const c=S.chars[S.charSel];const j=await makeReal87(c,true);return j&&{meta:j.meta,kind:j.kind}}")
        out["real"] = r; ok(r and r["kind"] == "look" and r["meta"].get("face106") == 1 and r["meta"].get("real87") == 1, f"Make it real works from the face {r}")
        # 5) a new photo of the character → its face is found again (a big face: one look)
        n0 = len(stats()["face"]); f0 = await E("()=>S.chars[S.charSel].fp106")
        await pg.set_input_files("input[data-chphoto=cur]", D + "/photo2.png")
        await wait_js(E, f"()=>{{const c=S.chars[S.charSel];return c&&c.fp106&&c.fp106!=={json.dumps(f0)}&&c.facePic&&!F106.busy.has(c.id)}}", 40); await pg.wait_for_timeout(300)
        px = await E(PIX); st = stats(); out["newphoto"] = [px, st["face"][n0:]]
        ok(isred(px) and .3 <= px["red"] <= .7 and len(st["face"]) - n0 == 1, f"a new photo: its face is found again (one look for a big face) {out['newphoto']}")
        # 6) no text AI: a new character keeps the photo as its avatar, nothing breaks
        await E("()=>{API.cfg.providers.llm=false}"); n = await E("()=>S.chars.length")
        await pg.set_input_files("input[data-chphoto=new]", D + "/sheet.png"); await wait_js(E, f"()=>S.chars.length>{n}", 10); await pg.wait_for_timeout(2600)
        r = await E("()=>{const c=S.chars[S.charSel];return{face:!!c.facePic,av:!!avatar106(c),field:!!document.querySelector('.face106')}}")
        out["noai"] = r; ok(r == {"face": False, "av": True, "field": True}, f"no text AI: the avatar stays the photo, the field is there {r}")
        ok(not errs, f"desktop page errors {errs}")
        await ctx.close()
        # 7) Arabic on a phone
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2); pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
        await pg.route("**/v1/jobs", jobs)
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await E(SETUP % "ar"); await pg.wait_for_timeout(400)
        await pg.set_input_files("input[data-chphoto=new]", D + "/photo2.png")
        await wait_js(E, "()=>{const c=S.chars[S.charSel];return c&&c.facePic&&!F106.busy.has(c.id)}", 40); await pg.wait_for_timeout(400)
        r = await E("""()=>{const f=document.querySelector('.face106'),b=f&&f.getBoundingClientRect();return{label:(f&&f.querySelector('b')||{}).textContent,in:!!b&&b.left>=-1&&b.right<=innerWidth+1,
          over:document.documentElement.scrollWidth>innerWidth+1,img:!!document.querySelector('.av106 img')}}""")
        out["phone"] = r; ok(r["label"] == "الوجه (اختياري)" and r["in"] and not r["over"] and r["img"], f"Arabic phone: the face field fits {r}")
        await pg.screenshot(path=D + "/phone.png", full_page=False)
        ok(not errs, f"phone page errors {errs}")
        await b.close()

mk = subprocess.Popen([sys.executable, D + "/mock.py", str(LPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    LLM_API_KEY="mock", LLM_BASE_URL=f"http://localhost:{LPORT}", LLM_MODEL="mock-vision", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(80):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
        except Exception: time.sleep(.25)
    asyncio.run(main())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1))
sys.exit(0)
