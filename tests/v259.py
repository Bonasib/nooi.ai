# v259 — character sheets used in every shot (after ViMax's character portraits). A real nooi server and a browser (the requests
# the page sends are read):
#  · "Character sheet" on a character with a face is drawn from that face (front, side and back views — since v87/v159)
#  · then the character used with @ in a picture: the face AND the sheet go as reference pictures, the words say which is which
#  · a sheet drawn from words alone (a character with no face) is the older sheet and is never used as a reference
# Run: python3 tests/v259.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8785; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v259-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D); json.dump({"users": {}}, open(D + "/data/db.json", "w"))
for f in ("face.png", "sheet.png"): subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x806040:s=320x320", "-frames:v", "1", D + "/media/" + f], check=True, timeout=60)
env = {k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "MINIMAX_", "SEEDANCE_", "NVIDIA_", "ANTHROPIC_", "OPENAI_", "FIREBASE_", "FREE_PERIOD", "ADMIN_EMAILS", "LLM_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", KIE_API_KEY="kk", KIE_BASE_URL="http://127.0.0.1:9"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1500]))
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); posts = []
        pg.on("request", lambda r: posts.append(json.loads(r.post_data or "{}")) if r.method == "POST" and r.url.endswith("/v1/jobs") else None)
        await pg.goto(B + "/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.credits=9000;const c=S.chars[0];c.name='Layla';c.face='/media/face.png';S.charSel=0;go('chars');renderAll()}"); await pg.wait_for_timeout(600)
        n0 = len(posts); await pg.click('[data-act="gen-sheet"]'); await pg.wait_for_timeout(1500)
        sh = posts[n0] if len(posts) > n0 else {}
        chk("Character sheet on a character with a face is drawn from the face: front, side and back", sh.get("kind") == "sheet" and (sh.get("inputs") or {}).get("chRef", "").endswith("/media/face.png") and "Front, side and back views" in sh.get("prompt", "") and (sh.get("meta") or {}).get("face87"), {"post": sh})
        # the sheet is made → the character in a picture: face + sheet
        await E("()=>{const j=S.jobs.filter(x=>x.kind==='sheet'&&x.meta&&x.meta.face87).pop();j.status='complete';j.resultUrl='/media/sheet.png';S.img.prompt='@Layla buys spices in the old souk';go('image');renderAll()}"); await pg.wait_for_timeout(500)
        n1 = len(posts); await E("()=>{const b=document.querySelector('#main [data-act=\"gen-image\"]')||document.querySelector('#main [data-act^=\"gen\"]');b.click()}"); await pg.wait_for_timeout(1500)
        im = next((x for x in posts[n1:] if x.get("kind") == "image"), {})
        inp = im.get("inputs") or {}
        chk("the character used with @: the face and the sheet are reference pictures, and the words say which is which", inp.get("iRef", "").endswith("/media/face.png") and inp.get("iRef2", "").endswith("/media/sheet.png") and "Layla = the person in reference picture 1" in im.get("prompt", "") and "Layla's character sheet" in im.get("prompt", "") and "reference picture 2" in im.get("prompt", ""), {"post": im})
        # no face → the older sheet, never a reference
        await E("()=>{const c=JSON.parse(JSON.stringify(S.chars[0]));c.id='k9omar';c.name='Omar';c.face='';c.photo='';S.chars.push(c);S.charSel=S.chars.length-1;go('chars');renderAll()}"); await pg.wait_for_timeout(500)
        n2 = len(posts); await pg.click('[data-act="gen-sheet"]'); await pg.wait_for_timeout(1200)
        old = posts[n2] if len(posts) > n2 else {}
        await E("()=>{S.jobs.push({id:'oldsh',kind:'sheet',status:'complete',resultUrl:'/media/sheet.png',meta:{char:'k9omar'},prompt:'Omar sheet',created:Date.now()})}")
        used = await E("()=>sheet259(S.chars.find(c=>c.id==='k9omar'))")
        chk("a sheet drawn from words alone (no face) is never used as a reference", used == "", {"post": old, "used": used})
        chk("no page errors", not errs, errs); await b.close()
try: asyncio.run(main())
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v259 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-1500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v259 OK")
