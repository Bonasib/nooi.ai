# v224 — nooi Studio, Step 2 of the owner's spec: project data and the timeline engine — and the studio in the site's header.
#  · the magnetic main track: a clip on V2 is attached to the V1 clip under it (a mark on the clip, "Main" on V1); a plain Delete
#    on V1 closes the gap and the attached clip moves with its picture; the switch turns it off (and back on)
#  · File → Save as .nooi: the spec's shape (frames, isPrimarySpine, parentAnchorClipId + anchorOffsetFrames)
#  · File → Save as .nooipack: a real ZIP (project.nooi + every media file + waveforms); opened again it brings the project back
#    with its media on this device (the picture draws)
#  · the site: "Studio" next to Explore in the computer header (where Edit was) opens /studio/; a phone's top bar has a Studio
#    button; the landing page links to it; no page errors
# Run: python3 tests/v224.py
import asyncio, io, json, os, subprocess, sys, tempfile, zipfile
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8725; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v224-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
for n, src in (("a", "testsrc2"), ("b", "smptebars"), ("c", "rgbtestsrc")):
    FF("-f", "lavfi", "-i", f"{src}=size=640x360:rate=30:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "400k", D + f"/{n}.webm")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
P = "window.__studio.editor.project"
CLIPS = "()=>" + P + ".tracks.flatMap(t=>t.clips.map(c=>({tr:t.name,name:c.name,start:+c.start.toFixed(2),anc:c.anchor?c.anchor.clip:null})))"

async def studio(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', [D + "/a.webm", D + "/b.webm", D + "/c.webm"])
    await pg.wait_for_function("Object.values(" + P + ".assets).filter(a=>a.duration>2).length===3", timeout=20000)
    # a and b on V1, c as B-roll on V2 over b (1 s in)
    await E("""()=>{const s=window.__studio,p=s.editor.project,A=Object.values(p.assets),by=n=>A.find(a=>a.name===n);const V1=p.tracks.find(t=>t.name==='V1').id,V2=p.tracks.find(t=>t.name==='V2').id;
      s.actions.addAsset(by('a'),0,V1);s.actions.addAsset(by('b'),3,V1);s.actions.addAsset(by('c'),4,V2)}""")
    await pg.wait_for_timeout(400); cl = await E(CLIPS); bid = [c for c in cl if c["name"] == "b"]
    ui = await E("()=>({anc:document.querySelectorAll('.clip .anc').length,spine:document.querySelector('[data-testid=spine]')?.closest('.thead')?.textContent.slice(0,6),mag:document.querySelector('[data-testid=magnetic]').getAttribute('aria-pressed')})")
    c = [x for x in cl if x["name"] == "c"][0]
    chk("the B-roll on V2 is attached to the V1 clip under it (a mark on it, Main on V1, the switch on)", bool(bid) and c["anc"] and c["start"] == 4 and ui["anc"] == 1 and "V1" in (ui["spine"] or "") and ui["mag"] == "true", {"cl": cl, "ui": ui})
    # a plain Delete on V1: the gap closes, the B-roll moves with its picture
    await E("()=>{const e=window.__studio.editor;e.select([" + P + ".tracks.find(t=>t.name==='V1').clips[0].id])}"); await pg.click('[data-testid="delete"]'); await pg.wait_for_timeout(300)
    cl2 = await E(CLIPS); v1 = [x for x in cl2 if x["tr"] == "V1"]; c2 = [x for x in cl2 if x["name"] == "c"][0]
    chk("Delete on the magnetic V1 closes the gap and the attached B-roll moves with it", len(v1) == 1 and v1[0]["start"] == 0 and c2["start"] == 1, cl2)
    await pg.click('[data-testid="undo"]'); await pg.wait_for_timeout(200)
    await pg.click('[data-testid="magnetic"]'); off = await E("()=>({m:" + P + ".magnetic,anc:document.querySelectorAll('.clip .anc').length})")
    await pg.click('[data-testid="magnetic"]'); on = await E("()=>({m:" + P + ".magnetic,anc:document.querySelectorAll('.clip .anc').length})")
    chk("the magnetic switch turns it off and on again", off == {"m": False, "anc": 0} and on == {"m": True, "anc": 1}, [off, on])
    # .nooi
    await pg.click('[data-testid="file-menu"]')
    async with pg.expect_download() as dl: await pg.click('[data-testid="file-save"]')
    d = await dl.value; path = D + "/" + d.suggested_filename; await d.save_as(path); doc = json.load(open(path))
    tr = doc["timeline"]["tracks"]; sp = [t for t in tr if t["isPrimarySpine"]]; br = [c for t in tr for c in t["clips"] if c.get("parentAnchorClipId")]
    chk(".nooi: the spec's shape — frames, V1 as the primary spine, the anchor", doc["nooiVersion"] == "1.0.0" and doc["settings"]["frameRate"]["num"] == 30 and len(sp) == 1 and sp[0]["name"] == "V1" and len(sp[0]["clips"]) == 2
        and len(br) == 1 and br[0]["anchorOffsetFrames"] == 30 and br[0]["timelineStartFrame"] == 120, {"sp": [t["name"] for t in sp], "br": br[:1]})
    # .nooipack
    await pg.click('[data-testid="file-menu"]')
    async with pg.expect_download(timeout=30000) as dl: await pg.click('[data-testid="file-pack"]')
    d = await dl.value; pk = D + "/" + d.suggested_filename; await d.save_as(pk)
    z = zipfile.ZipFile(pk); names = z.namelist(); bad = z.testzip(); inner = json.loads(z.read("project.nooi"))
    media = [n for n in names if n.startswith("media/")]; sizes = [z.getinfo(n).file_size for n in media]
    chk(".nooipack: a real ZIP with project.nooi and every media file, byte for byte (CRCs check)", d.suggested_filename.endswith(".nooipack") and bad is None and len(media) == 3 and sorted(z.read(n) for n in media) == sorted(open(D + f"/{x}.webm", "rb").read() for x in "abc") and all(r.get("packPath") for r in inner["mediaBin"]), {"names": names, "bad": bad, "fn": d.suggested_filename, "sizes": sizes, "pp": [r.get("packPath") for r in inner["mediaBin"]]})
    # open it as a new project: the media lands on this device and draws
    await E("()=>{const e=window.__studio.editor;e.load(Object.assign(JSON.parse(JSON.stringify(e.project)),{tracks:e.project.tracks.map(t=>({...t,clips:[]})),assets:{},name:'Empty'}))}")
    await pg.click('[data-testid="file-menu"]'); await pg.set_input_files('[data-testid="nooi-input"]', pk)
    await pg.wait_for_function(P + ".tracks.some(t=>t.clips.length)&&Object.keys(" + P + ".assets).length===3", timeout=20000); await pg.wait_for_timeout(1500)
    r = await E("()=>({srcs:Object.values(" + P + ".assets).map(a=>a.src.slice(0,9)),clips:" + P + ".tracks.flatMap(t=>t.clips).length,anc:" + P + ".tracks.flatMap(t=>t.clips).filter(c=>c.anchor).length})")
    await E("()=>window.__studio.player.seek(1)"); await pg.wait_for_timeout(1200)
    px = await E("()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),d=new Uint8Array(4);g.readPixels(Math.round(c.width*0.3),Math.round(c.height*0.5),1,1,g.RGBA,g.UNSIGNED_BYTE,d);return Array.from(d.slice(0,3))}")
    chk("opening the .nooipack brings the project back with its media on this device, and the picture draws", r["srcs"] == ["local:pk_"] * 3 and r["clips"] == 3 and r["anc"] == 1 and sum(px) > 60, {"r": r, "px": px})
    chk("studio: no page errors", not errs, errs); await b.close()

SIGNIN = "()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;document.getElementById('modalRoot').innerHTML='';window.__studio219=true;go('home');renderAll()}"
async def site(p):
    b = await p.chromium.launch(); errs = []
    # computer
    pg = await b.new_page(viewport={"width": 1440, "height": 900}); pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(B + "/"); await pg.wait_for_timeout(1500)
    land = await E("()=>{const a=document.querySelector('.lplinks .st224l');return a?{href:a.getAttribute('href'),t:a.textContent,first:a===a.parentElement.firstElementChild}:null}")
    chk("the landing page links to the Studio", land and land["href"] == "/studio/" and land["t"] == "Studio", land)   # (v242 put Team first on the new home page)
    await pg.wait_for_function("typeof S!=='undefined'&&typeof go==='function'", timeout=20000); await E(SIGNIN); await pg.wait_for_timeout(800)
    # (v253: the sections live in the side menu — the editor is Edit › Video editor, marked New)
    await pg.click('#sb253 [data-sb253="edit"]'); await pg.wait_for_timeout(200)
    nav = await E("()=>[...document.querySelectorAll('#sb253 .sbg253.open .sbi253')].map(b=>(b.querySelector('.new253')?'*':'')+b.dataset.go)")
    chk("the computer's side menu: Edit opens with the Video editor first, marked New", nav[:1] == ["*edit"], nav)
    await pg.click('#sb253 .sbg253.open [data-go="edit"]'); await pg.wait_for_url("**/studio/**", timeout=15000)
    chk("the Video editor in the menu opens nooi Studio", "/studio/" in pg.url, pg.url)
    # phone
    ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(B + "/"); await pg.wait_for_function("typeof S!=='undefined'&&typeof go==='function'", timeout=20000); await E(SIGNIN); await pg.wait_for_timeout(800)
    m = await E("()=>{const x=document.querySelector('#main>.topm .st224m');if(!x)return null;const r=x.getBoundingClientRect(),row=x.parentElement.getBoundingClientRect();return{vis:getComputedStyle(x).display!=='none'&&r.width>0,inside:r.left>=0&&r.right<=innerWidth,t:x.getAttribute('aria-label'),fits:row.right<=innerWidth+1,over:document.documentElement.scrollWidth-innerWidth}}")
    chk("a phone's top bar has a Studio button, inside the screen", m and m["vis"] and m["inside"] and m["t"] == "nooi Studio" and m["fits"] and m["over"] <= 1, m)
    await pg.click('#main>.topm .st224m'); await pg.wait_for_url("**/studio/**", timeout=15000)
    chk("site: no page errors", not errs, errs); await b.close()

async def main():
    import urllib.request, time
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        for f in (studio, site):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:600])

try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps(out, ensure_ascii=False)[:600])
if fails: print("v224 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v224 OK")
