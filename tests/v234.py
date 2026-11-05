# v234 — moving video backgrounds and separating a person (keying, cut-out).
#  · a green screen: "Green screen key" finds the screen's colour by itself; the screen turns see-through in the preview (the red
#    subject stays); strength / soft edge / spill controls
#  · a new background under the person, one undo step: a moving scene (16, each tile plays), a drawn picture, your own video
#    (repeated to cover the clip, its sound off); on V1 the background takes the clip's place and the person moves up onto a
#    layer attached to it; picking another replaces it; "Remove the background" puts the person back on V1
#  · the light on the person matched to the background (warmth, brightness, tint)
#  · no screen (a blue sky is not one): "Cut out the person" on this device — also by itself when a background is picked first (MediaPipe, served from /studio/vendor) — a cut-out video (its mask below
#    the picture), its sound kept on the original (detached); a picture becomes a PNG with real transparency
#  · the clip settings' "Background & cut-out" section; a phone in Arabic
# Run: python3 tests/v234.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8743; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v234-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
VP9 = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-pix_fmt", "yuv420p"]
# a green screen (studio green) with a red subject that moves a little, and a tone
FF("-f", "lavfi", "-i", "color=c=0x00b140:s=640x360:d=3:r=30,drawbox=x='250+20*sin(t*2)':y=110:w=140:h=180:c=0xe02020:t=fill", "-f", "lavfi", "-i", "sine=f=440:d=3", *VP9, "-c:a", "libopus", "-shortest", D + "/gs.webm")
FF("-f", "lavfi", "-i", "color=c=0xff00ff:s=640x360:d=1:r=30", *VP9, D + "/magenta.webm")
POSE = D + "/pose.jpg"
try: urllib.request.urlretrieve("https://storage.googleapis.com/mediapipe-assets/pose.jpg", POSE)
except Exception: POSE = None
if POSE:
    FF("-loop", "1", "-i", POSE, "-f", "lavfi", "-i", "sine=f=330:d=2", "-t", "2", "-vf", "scale=640:-2,fps=30", *VP9, "-c:a", "libopus", "-shortest", D + "/pose.webm")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
P = "window.__studio.editor.project"
PIX = "(xy)=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),d=new Uint8Array(4);g.readPixels(Math.round(c.width*xy[0]),Math.round(c.height*(1-xy[1])),1,1,g.RGBA,g.UNSIGNED_BYTE,d);return Array.from(d.slice(0,3))}"
LAY = "()=>{const p=" + P + ";return p.tracks.filter(t=>t.kind!=='audio').map(t=>t.clips.map(c=>({id:c.id,type:c.type,s:+c.start.toFixed(2),d:+c.dur.toFixed(2),bd:c.backdrop||null,tpl:c.motion?c.motion.tpl:null,a:c.asset?p.assets[c.asset].name:null,muted:c.muted,anchor:c.anchor?c.anchor.clip:null})))}"
PERSON = "()=>{const p=" + P + ";return p.tracks.flatMap(t=>t.clips).find(c=>c.type==='media'&&!c.backdrop&&p.assets[c.asset].kind!=='audio')}"

async def fresh(pg, files):
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(500)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', [D + "/" + f for f in files])
    await pg.wait_for_function("Object.values(" + P + ".assets).filter(a=>a.duration>0&&a.w).length===" + str(len(files)), timeout=40000)
    await pg.evaluate("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets)[0];s.actions.addAsset(a);const c=s.editor.project.tracks.flatMap(t=>t.clips)[0];s.editor.select([c.id])}")
    await pg.wait_for_timeout(400)
async def show(pg, t):
    await pg.evaluate(f"()=>window.__studio.player.seek({t})"); await pg.wait_for_timeout(900)
async def open_panel(pg):
    await pg.click('[data-testid="insp-video"]'); await pg.wait_for_timeout(150)
    await pg.locator('[data-testid="bk-open"]').scroll_into_view_if_needed(); await pg.click('[data-testid="bk-open"]'); await pg.wait_for_selector('[data-testid="bk-panel"]')

async def desktop(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await fresh(pg, ["gs.webm"])
    await pg.click('[data-testid="insp-video"]'); await pg.wait_for_timeout(200)
    secs = await E("()=>[...document.querySelectorAll('.inspector .isec')].map(s=>s.dataset.sec)")
    chk("the clip settings have a Background & cut-out section (before Effects)", "bk" in secs and secs.index("bk") == secs.index("fx") - 1, secs)
    await show(pg, 1.0); before = await E(PIX, [0.06, 0.1])
    await pg.locator('[data-testid="bk-key"]').scroll_into_view_if_needed(); await pg.click('[data-testid="bk-key"]'); await pg.wait_for_selector('[data-testid="bk-keyctl"]', timeout=15000)
    k = await E("()=>{const c=(" + PERSON + ")();return c.effects.find(e=>e.type==='key')}")
    await show(pg, 1.0); corner = await E(PIX, [0.06, 0.1]); mid = await E(PIX, [0.5, 0.5])
    g = int(k["params"]["color"][3:5], 16) if k else 0
    chk("Green screen key: the screen's colour found by itself (green), the screen see-through (the black behind shows), the red subject stays", k and g > 140 and before[1] > 120 and max(corner) < 40 and mid[0] > 180 and mid[1] < 90, [k, before, corner, mid])
    st = await E("()=>document.querySelector('[data-testid=bk-state]').dataset.state")
    chk("…the section says the key is on and shows its controls (colour, strength, soft edge, spill)", st == "key" and await E("()=>['bk-color','bk-sim','bk-soft','bk-spill'].every(id=>document.querySelector('[data-testid='+id+']'))"), st)
    # ---- a moving background (sky): on V1 the background takes the clip's place, the person moves up attached to it
    await open_panel(pg)
    await pg.locator('[data-testid="bk-mb-clouds"]').scroll_into_view_if_needed(); await pg.wait_for_timeout(300)
    tiles = await E("()=>[...document.querySelectorAll('[data-testid=bk-moving] canvas')].map(c=>c.toDataURL().length)")
    await pg.wait_for_timeout(500); tiles2 = await E("()=>[...document.querySelectorAll('[data-testid=bk-moving] canvas')].map(c=>c.toDataURL().length)")
    chk("27 moving scenes (16 + 11 studio sets since v235), each tile drawn; the ones on screen play", len(tiles) == 27 and all(x > 2000 for x in tiles) and sum(1 for a, c in zip(tiles, tiles2) if a != c) >= 4, [tiles, tiles2])
    n0 = await E("()=>window.__studio.editor.past.length"); col0 = await E("()=>(" + PERSON + ")().color")
    await pg.click('[data-testid="bk-mb-clouds"]'); await pg.wait_for_function("document.querySelector('[data-testid=bk-mb-clouds]').getAttribute('aria-pressed')==='true'", timeout=20000)
    lay = await E(LAY); person = await E(PERSON); n1 = await E("()=>window.__studio.editor.past.length")
    v1 = lay[-1]; up = lay[-2] if len(lay) > 1 else []
    chk("a moving scene on V1: it takes the clip's place (0–3 s), the person moves up onto a layer attached to it — one undo step",
        len(v1) == 1 and v1[0]["tpl"] == "mb-clouds" and v1[0]["s"] == 0 and abs(v1[0]["d"] - person["dur"]) < 0.01 and len(up) == 1 and up[0]["id"] == person["id"] and up[0]["anchor"] == v1[0]["id"] and n1 - n0 == 1, [lay, n0, n1])
    await show(pg, 1.0); sky = await E(PIX, [0.06, 0.1]); mid = await E(PIX, [0.5, 0.5])
    chk("…the preview: sky where the screen was, the red subject in front", sky[2] > 150 and sky[2] > sky[0] and mid[0] > 150 and mid[1] < 110, [sky, mid])
    chk("…the light on the person matched to the sky (cooler: warmth down)", person["light"] and person["light"][0] < 0 and person["color"]["temperature"] < col0["temperature"], [person.get("light"), person["color"]])
    # ---- another pick replaces it; a drawn picture; your own video (repeated, sound off)
    await pg.click('.bk .ns-seg button:has-text("Pictures")'); await pg.click('[data-testid="bkp-beach"]')
    await pg.wait_for_function("(" + LAY + ")().slice(-1)[0][0]&&(" + LAY + ")().slice(-1)[0][0].type==='media'", timeout=20000); lay = await E(LAY)
    chk("a picture replaces the scene in the same place (still one background)", len(lay[-1]) == 1 and lay[-1][0]["bd"] == person["id"] and lay[-1][0]["a"] == "Beach" and sum(1 for t in lay for c in t if c["bd"]) == 1, lay)
    await pg.click('.bk .ns-seg button:has-text("Your own")'); await pg.set_input_files('[data-testid="bk-file"]', D + "/magenta.webm")
    await pg.wait_for_function("(" + LAY + ")().slice(-1)[0].length===3", timeout=30000); lay = await E(LAY)
    chk("your own 1 s video covers the 3 s clip: repeated three times, its sound off", [(c["s"], c["a"], c["muted"]) for c in lay[-1]] == [(0, "magenta", True), (1, "magenta", True), (2, "magenta", True)] and abs(sum(c["d"] for c in lay[-1]) - person["dur"]) < 0.02, lay[-1])
    await show(pg, 2.5); mg = await E(PIX, [0.06, 0.1]); chk("…the preview shows it behind the person", mg[0] > 180 and mg[2] > 180 and mg[1] < 90, mg)
    await E("()=>window.__studio.actions.undo()"); await pg.wait_for_timeout(300); lay = await E(LAY)
    chk("Undo takes it back to the picture in one step", len(lay[-1]) == 1 and lay[-1][0]["a"] == "Beach", lay)
    await pg.click('[data-testid="bk-remove"]'); await pg.wait_for_timeout(300); lay = await E(LAY); person = await E(PERSON)
    chk("Remove the background: the person goes back onto V1, the extra track goes, the light change is taken back", len(lay) == len([t for t in lay]) and lay[-1][0]["id"] == person["id"] and not any(c["bd"] for t in lay for c in t) and not person.get("light") and abs(person["color"]["temperature"] - col0["temperature"]) < 0.011, [lay, person["color"]])
    chk("desktop: no page errors", not errs, errs); await b.close()

async def cutout(p):
    if not POSE: out["cutout"] = "skipped (no test picture could be downloaded)"; return
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    # a beach photo (blue sky, no screen): picking a background first cuts the person out by itself — the sky is not keyed
    await fresh(pg, ["pose.webm"]); await open_panel(pg)
    await pg.locator('[data-testid="bk-mb-sunset"]').scroll_into_view_if_needed(); t0 = time.time(); await pg.click('[data-testid="bk-mb-sunset"]')
    await pg.wait_for_selector('[data-testid="bk-busy"]', timeout=20000)
    await pg.wait_for_function("document.querySelector('[data-testid=bk-state]')&&document.querySelector('[data-testid=bk-state]').dataset.state==='cut'", timeout=240000); out["cutSeconds"] = round(time.time() - t0, 1)
    info = await E("()=>{const p=" + P + ",c=(" + "()=>{const p=" + P + ";return p.tracks.flatMap(t=>t.clips).find(c=>c.type==='media'&&p.assets[c.asset].kind==='video')}" + ")(),a=p.assets[c.asset];return{alpha:a.alpha,w:a.w,h:a.h,dur:a.duration,hasAudio:a.hasAudio,muted:c.muted,thumb:!!a.thumb,strip:!!a.strip,sound:p.tracks.filter(t=>t.kind==='audio').flatMap(t=>t.clips).map(x=>({link:x.link===c.id,asset:p.assets[x.asset].name}))}}")
    keyed = await E("()=>!!(" + PERSON + ")().effects.find(e=>e.type==='key')")
    chk("no screen (a blue sky): the person is cut out, not keyed", not keyed, keyed)
    chk("Cut out the person (on this device): a cut-out video (mask below the picture), its own picture and filmstrip; the sound stays on the original, detached",
        info["alpha"] == "stacked" and info["w"] == 640 and info["h"] in (426, 428) and abs(info["dur"] - 2) < 0.15 and info["muted"] and info["thumb"] and info["strip"] and info["sound"] == [{"link": True, "asset": "pose"}], info)
    await pg.click('.bk .ns-seg button:has-text("Your own")'); await pg.set_input_files('[data-testid="bk-file"]', D + "/magenta.webm")
    await pg.wait_for_function("(" + LAY + ")().slice(-1)[0].length===2", timeout=30000)
    await show(pg, 0.8); sky = await E(PIX, [0.15, 0.15]); body = await E(PIX, [0.5, 0.42]); legs = await E(PIX, [0.4, 0.7])
    chk("…the preview: the new background where the sky was, the person stays in front", sky[0] > 160 and sky[2] > 160 and sky[1] < 120 and not (body[0] > 160 and body[2] > 160) and not (legs[0] > 160 and legs[2] > 160), [sky, body, legs])
    # a picture: a PNG with real transparency
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', POSE)
    await pg.wait_for_function("Object.values(" + P + ".assets).some(a=>a.kind==='image'&&a.w)", timeout=20000)
    await E("()=>{const s=window.__studio,a=Object.values(s.editor.project.assets).find(a=>a.kind==='image');s.actions.addAsset(a);const c=s.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.asset===a.id);s.editor.select([c.id])}")
    await pg.wait_for_timeout(300); await pg.click('[data-testid="insp-video"]'); await pg.wait_for_timeout(150); await pg.locator('[data-testid="bk-cut"]').scroll_into_view_if_needed(); await pg.click('[data-testid="bk-cut"]')
    await pg.wait_for_function("document.querySelector('[data-testid=bk-state]').dataset.state==='cut'", timeout=60000)
    png = await E("""async()=>{const p=window.__studio.editor.project,a=Object.values(p.assets).find(a=>a.alpha==='own');const r=await fetch(await (async()=>{const k=a.src.slice(6);return new Promise(ok=>{const q=indexedDB.open('nooi-studio');q.onsuccess=()=>{try{const t=q.result.transaction(q.result.objectStoreNames[0]).objectStore(q.result.objectStoreNames[0]).get(k);t.onsuccess=()=>ok(URL.createObjectURL(t.result))}catch(e){ok(null)}};q.onerror=()=>ok(null)})})());
      const bm=await createImageBitmap(await r.blob()),c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext('2d');x.drawImage(bm,0,0);const at=(u,v)=>x.getImageData(Math.round(u*bm.width),Math.round(v*bm.height),1,1).data[3];return{mime:a.mime,sky:at(0.1,0.1),body:at(0.5,0.62),w:bm.width}}""")
    chk("Cut out a picture: a PNG with real transparency (the sky clear, the person solid)", png and png["mime"] == "image/png" and png["sky"] < 30 and png["body"] > 220, png)
    chk("cut-out: no page errors", not errs, errs); await b.close()

async def phone(p):
    b = await p.chromium.launch(); ctx = await b.new_context(**p.devices["iPhone 13"]); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await fresh(pg, ["gs.webm"])
    if await E("()=>!!document.querySelector('[data-testid=sheet-close]')"): await pg.click('[data-testid="sheet-close"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(300)
    await E("()=>window.__studio.editor.select([])"); await pg.wait_for_timeout(300)   # (a picked clip shows the phone's clip tools in the bottom bar)
    await pg.locator('[data-testid="rail-stock"]').scroll_into_view_if_needed(); await pg.click('[data-testid="rail-stock"]'); await pg.wait_for_timeout(300)
    await pg.click('.panel .subtabs button:has-text("الخلفية")'); await pg.wait_for_selector('[data-testid="bk-panel"]')
    await E("()=>{const s=window.__studio,c=s.editor.project.tracks.flatMap(t=>t.clips)[0];s.editor.select([c.id])}"); await pg.wait_for_timeout(400)
    v = await E("()=>({step:document.querySelector('.bk .ns-lbl').textContent,cut:document.querySelector('[data-testid=bk-cut]').textContent,tiles:document.querySelectorAll('[data-testid=bk-moving] .bgt').length,over:document.documentElement.scrollWidth-innerWidth,first:document.querySelector('[data-testid=bk-moving] .bgt span:last-child').textContent})")
    chk("phone (Arabic): the Background panel in Arabic, its moving scenes, nothing wider than the screen", "افصل الشخص" in v["step"] and v["cut"] == "اعزل الشخص" and v["tiles"] == 27 and v["first"] == "الشفق القطبي" and v["over"] <= 0, v)
    await pg.locator('[data-testid="bk-mb-aurora"]').scroll_into_view_if_needed(); await pg.click('[data-testid="bk-mb-aurora"]'); await pg.wait_for_function("document.querySelector('[data-testid=bk-mb-aurora]').getAttribute('aria-pressed')==='true'", timeout=20000)
    nm = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).find(c=>c.backdrop).name")
    chk("phone: a moving scene placed (the green screen keyed by itself first), named in Arabic", nm == "الشفق القطبي" and await E("()=>!!(" + PERSON + ")().effects.find(e=>e.type==='key')"), nm)
    chk("phone: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    r = urllib.request.urlopen(B + "/studio/vendor/mediapipe-0.10.21/vision_wasm_internal.wasm"); h = dict(r.headers)
    chk("the person finder is served by our own server (wasm type, cached for good)", h.get("Content-Type") == "application/wasm" and "immutable" in h.get("Cache-Control", ""), h)
    async with async_playwright() as p:
        for f in (desktop, cutout, phone):
            try: await f(p)
            except Exception as e: chk(f.__name__ + " crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps(out, ensure_ascii=False)[:900])
if fails: print("v234 FAIL\n - " + "\n - ".join(fails)); sys.exit(1)
print("v234 OK")
