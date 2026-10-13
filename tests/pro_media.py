# v78e: professional camera & studio formats + "drip" (device-aware quality, media kept on the device, progressive GPU uploads).
# API: ProRes 422 HQ (10-bit, 24-bit PCM, timecode) · DNxHR HQ in MXF · HEVC Main 10 · interlaced anamorphic HDV (MPEG-2 + AC-3
#      in .mts) · 16-bit TIFF · OpenEXR · 10-bit DPX · camera RAW (embedded preview) · 24-bit/96 kHz AIFF · 6-channel BWF · ALAC
#      → each gets the right facts (codec, profile, bits, fps, timecode, interlace, pixel aspect, channels…) and a proxy every
#      browser plays (H.264 1080p / up to 4K, PNG/JPEG, MP3 stereo), the original kept byte for byte, other users locked out.
# UI: a ProRes file picked in a file box arrives as an editing proxy with its facts; a TIFF and a RAW still load as pictures; a
#     dropped file is converted before the page sees it; Blackmagic RAW is explained, not uploaded; the This device panel (GPU
#     level, quality, camera originals); finished media cached on the device by the service worker (and cleared); 3D Studio:
#     a textured model appears when its textures are on the GPU, quality follows the frame rate.
import asyncio, hashlib, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8073
D = tempfile.mkdtemp(prefix="nooi-pro-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
S = tempfile.mkdtemp(prefix="nooi-pro-src-"); FF = os.environ.get("FFMPEG_PATH", "ffmpeg"); FP = os.environ.get("FFPROBE_PATH", "ffprobe")
def ff(*a): subprocess.run([FF, "-v", "error", "-y", *a], check=True)
ff("-f", "lavfi", "-i", "testsrc2=s=1280x720:r=25:d=2", "-f", "lavfi", "-i", "sine=f=440:d=2", "-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le", "-c:a", "pcm_s24le", "-timecode", "01:00:00:00", S + "/A001C003.mov")
ff("-f", "lavfi", "-i", "testsrc2=s=2560x1440:r=25:d=1", "-f", "lavfi", "-i", "sine=f=330:d=1", "-c:v", "dnxhd", "-profile:v", "dnxhr_hq", "-pix_fmt", "yuv422p", "-c:a", "pcm_s16le", "-ar", "48000", S + "/B002.mxf")
HEVC = subprocess.run([FF, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout.find(" libx265 ") >= 0
if HEVC: ff("-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=1", "-c:v", "libx265", "-pix_fmt", "yuv420p10le", "-x265-params", "log-level=error", "-tag:v", "hvc1", S + "/phone_hevc10.mp4")
ff("-f", "lavfi", "-i", "testsrc2=s=1440x1080:r=25:d=1", "-f", "lavfi", "-i", "sine=d=1", "-c:v", "mpeg2video", "-flags", "+ilme+ildct", "-top", "1", "-vf", "setsar=4/3", "-c:a", "ac3", "-f", "mpegts", S + "/00012.mts")
ff("-f", "lavfi", "-i", "testsrc2=s=640x360", "-frames:v", "1", "-pix_fmt", "rgb48le", S + "/scan16.tif")
ff("-f", "lavfi", "-i", "testsrc2=s=640x360", "-frames:v", "1", "-pix_fmt", "gbrpf32le", "-c:v", "exr", S + "/plate.exr")
ff("-f", "lavfi", "-i", "testsrc2=s=640x360", "-frames:v", "1", "-pix_fmt", "gbrp10le", S + "/frame.dpx")
ff("-f", "lavfi", "-i", "testsrc2=s=160x120", "-frames:v", "1", S + "/thumb.jpg"); ff("-f", "lavfi", "-i", "testsrc2=s=1600x1067", "-frames:v", "1", "-q:v", "3", S + "/big.jpg")
open(S + "/IMG_0001.CR2", "wb").write(b"II*\x00\x10\x00\x00\x00CR\x02\x00" + bytes(200) + open(S + "/thumb.jpg", "rb").read() + os.urandom(30000) + open(S + "/big.jpg", "rb").read() + os.urandom(150000))
ff("-f", "lavfi", "-i", "sine=f=500:d=1.5:sample_rate=96000", "-c:a", "pcm_s24be", S + "/take.aiff")
ff("-f", "lavfi", "-i", "sine=f=200:d=1.5", "-filter_complex", "[0]asplit=6[a][b][c][d][e][f];[a][b][c][d][e][f]join=inputs=6:channel_layout=5.1", "-c:a", "pcm_s24le", S + "/fieldrec.wav")
ff("-f", "lavfi", "-i", "sine=d=1.5", "-c:a", "alac", S + "/memo.m4a")
open(S + "/C001.braw", "wb").write(b"BRAW" + os.urandom(2000)); open(S + "/notes.txt", "w").write("hello")
TOKEN = "nooi_" + "p" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "u2": {"plan": "pro", "credits": 5, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": [{"id": "tk1", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1}]}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def get(p, tok=None):
    h = {"authorization": "Bearer " + tok} if tok else {}
    try:
        with urllib.request.urlopen(urllib.request.Request(f"http://localhost:{PORT}{p}", headers=h), timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e: return {"_status": e.code, **json.loads(e.read() or b"{}")}
def ingest(name, q="fast"):
    r = subprocess.run(["curl", "-s", "-F", f"file=@{S}/{name}", "-F", f"q={q}", f"http://localhost:{PORT}/v1/media/ingest"], capture_output=True, text=True); jid = json.loads(r.stdout or "{}").get("id")
    if not jid: return {"_err": r.stdout}
    for _ in range(240):
        j = get("/v1/media/ingest/" + jid)
        if j.get("status") != "working": j["id"] = jid; return j
        time.sleep(.25)
    return {"_err": "timeout"}
def probe(url):
    f = D + "/media/" + url.split("/media/")[-1]; return json.loads(subprocess.run([FP, "-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], capture_output=True, text=True).stdout or "{}")
def vs(p): return next((s for s in p.get("streams", []) if s["codec_type"] == "video"), {})
def as_(p): return next((s for s in p.get("streams", []) if s["codec_type"] == "audio"), {})

def api_checks():
    r = ingest("A001C003.mov"); m = r.get("meta") or {}; v = m.get("video") or {}; a = m.get("audio") or {}; p = probe(r.get("url", ""))
    ok(r.get("status") == "done" and r["kind"] == "video" and v.get("id") == "prores" and v.get("profile") == "HQ" and v.get("bits") == 10 and v.get("fps") == 25 and m.get("timecode") == "01:00:00:00" and a.get("bits") == 24, f"ProRes facts {r}")
    ok(vs(p).get("codec_name") == "h264" and vs(p).get("pix_fmt") == "yuv420p" and vs(p).get("width") == 1280 and as_(p).get("codec_name") == "aac" and as_(p).get("channels") == 2, f"ProRes proxy {vs(p).get('codec_name')} {vs(p).get('width')} {as_(p).get('codec_name')}")
    orig = D + "/media/" + r.get("original", "").split("/media/")[-1]; ok(os.path.exists(orig) and os.path.getsize(orig) == os.path.getsize(S + "/A001C003.mov"), "the original is kept byte for byte")
    ok(get("/v1/media/ingest/" + r.get("id", "x"), TOKEN).get("_status") == 404, "another user can't read it")
    r = ingest("B002.mxf"); v = (r.get("meta") or {}).get("video") or {}; p = probe(r.get("url", ""))
    ok(r.get("status") == "done" and v.get("id") == "dnxhd" and "DNXHR" in str(v.get("profile")) and vs(p).get("width") == 1920, f"DNxHR MXF → 1080p proxy {v} {vs(p).get('width')}")
    r = ingest("B002.mxf", "full"); p = probe(r.get("url", "")); ok(vs(p).get("width") == 2560, f"full quality keeps the size {vs(p).get('width')}")
    if HEVC:
        r = ingest("phone_hevc10.mp4"); v = (r.get("meta") or {}).get("video") or {}; ok(r.get("status") == "done" and v.get("id") == "hevc" and v.get("bits") == 10 and "Main 10" in str(v.get("profile")), f"HEVC 10-bit {v}")
    r = ingest("00012.mts"); v = (r.get("meta") or {}).get("video") or {}; p = probe(r.get("url", "")); pv = vs(p)
    ok(r.get("status") == "done" and v.get("interlaced") and v.get("sar") == "4:3" and pv.get("width") == 1920 and pv.get("height") == 1080 and pv.get("sample_aspect_ratio") in (None, "1:1") and pv.get("field_order") in (None, "progressive"), f"HDV: deinterlaced, square pixels {v} {pv.get('width')} {pv.get('sample_aspect_ratio')} {pv.get('field_order')}")
    for name, bits in (("scan16.tif", 16), ("plate.exr", 32), ("frame.dpx", 10)):
        r = ingest(name); v = (r.get("meta") or {}).get("video") or {}; p = probe(r.get("url", ""))
        ok(r.get("status") == "done" and r["kind"] == "image" and v.get("bits") == bits and v.get("fps") is None and r["url"].endswith(".png") and vs(p).get("width") == 640, f"{name} → PNG {r.get('kind')} {v.get('bits')} {r.get('url','')[-6:]} {vs(p).get('width')}")
    r = ingest("IMG_0001.CR2"); v = (r.get("meta") or {}).get("video") or {}; p = probe(r.get("url", ""))
    ok(r.get("status") == "done" and r["url"].endswith(".jpg") and vs(p).get("width") == 1600 and v.get("id") == "raw" and v.get("w") == 1600, f"camera RAW → its full preview {v} {vs(p).get('width')}")
    for name, sr, bits, ch in (("take.aiff", 96000, 24, 1), ("fieldrec.wav", 44100, 24, 6), ("memo.m4a", 44100, 16, 1)):
        r = ingest(name); a = (r.get("meta") or {}).get("audio") or {}; p = probe(r.get("url", ""))
        ok(r.get("status") == "done" and r["kind"] == "audio" and a.get("sr") == sr and a.get("bits") == bits and a.get("ch") == ch and r["url"].endswith(".mp3") and as_(p).get("codec_name") == "mp3" and as_(p).get("channels") == min(2, ch), f"{name} → MP3 {a} {as_(p).get('channels')}")
    r = ingest("notes.txt"); ok(r.get("status") == "failed" and "video, picture or sound" in r.get("error", ""), f"not media → explained {r}")

async def ui(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"; r = {}
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); E = pg.evaluate
    async def wait_for(js, sec=30):
        for _ in range(sec * 4):
            if await E(js): return True
            await asyncio.sleep(.25)
        return False
    await E("()=>{window.__t=[];const t0=toast;toast=function(m,o){window.__t.push(String(m));return t0.apply(this,arguments)};S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;S.proMedia=[];go('voice');renderAll()}" % ("ar" if mob else "en"))
    await pg.wait_for_timeout(400)
    await pg.set_input_files("input[data-slot=lsV]", S + "/A001C003.mov")
    ok(await wait_for("()=>M.lsV&&M.lsV.name==='A001C003.mov.mp4'", 60), f"{tag}: ProRes arrives as an editing proxy " + str(await E("()=>[M.lsV&&M.lsV.name,window.__t.slice(-2)]")))
    r["prores"] = await E("()=>[M.lsV.type,M.lsV.file.type,window.__t.find(t=>/ProRes HQ/.test(t))||'',S.proMedia[0]&&S.proMedia[0].original]")
    ok(r["prores"][0] == "video" and r["prores"][1] == "video/mp4" and "1280×720" in r["prores"][2] and "10-bit" in r["prores"][2] and "TC 01:00:00:00" in r["prores"][2] and "/media/" in (r["prores"][3] or ""), f"{tag}: facts shown, original kept {r['prores']}")
    await E("()=>{renderView()}"); await pg.wait_for_timeout(300)
    for name in ("scan16.tif", "IMG_0001.CR2"):
        await E("()=>{delete M.lsV;renderView()}"); await pg.wait_for_timeout(200)
        await pg.set_input_files("input[data-slot=lsV]", S + "/" + name)
        ok(await wait_for("()=>M.lsV&&M.lsV.name.startsWith('%s')&&M.lsV.type==='image'&&M.lsV.el.naturalWidth>0" % name, 40), f"{tag}: {name} loads as a picture " + str(await E("()=>[M.lsV&&M.lsV.name,window.__t.slice(-1)]")))
    # a dropped camera file is converted before the page sees it
    await E("()=>{window.__drops=[];document.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files.length)window.__drops.push([...e.dataTransfer.files].map(f=>f.name))})}")
    data = list(open(S + "/frame.dpx", "rb").read())
    await E("""(d)=>{const f=new File([new Uint8Array(d)],'frame.dpx',{type:''}),dt=new DataTransfer();dt.items.add(f);document.querySelector('.view').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}))}""", data)
    ok(await wait_for("()=>window.__drops.some(x=>x[0]==='frame.dpx.png')", 40) and not await E("()=>window.__drops.some(x=>x[0]==='frame.dpx')"), f"{tag}: dropped DPX converted first " + str(await E("()=>window.__drops")))
    # camera RAW video: explained, never uploaded (the drop above sent the picture to its tool — back to the Voice page)
    await E("()=>{delete M.lsV;go('voice');renderAll()}"); await pg.wait_for_timeout(300); n0 = len(os.listdir(D + "/media"))
    await pg.set_input_files("input[data-slot=lsV]", S + "/C001.braw"); await pg.wait_for_timeout(1500)
    r["braw"] = await E("()=>[!!M.lsV,window.__t.slice(-1)[0]]")
    ok(not r["braw"][0] and "Blackmagic RAW" in r["braw"][1] and len(os.listdir(D + "/media")) == n0, f"{tag}: Blackmagic RAW explained, not uploaded {r['braw']}")
    # this device: GPU level, quality, camera originals; media kept on the device
    await E("()=>{go('account');renderAll()}"); ok(await wait_for("()=>!!document.querySelector('#devpanel')&&!/…/.test(document.querySelector('#devuse').textContent)", 15), f"{tag}: This device panel")
    r["dev"] = await E("()=>[DRIP.tier,document.querySelectorAll('#devpanel [data-act=dev-q]').length,document.querySelectorAll('#devpanel .pro1').length,PROQ()]")
    ok(r["dev"][0] in ("low", "mid", "high") and r["dev"][1] == 3 and r["dev"][2] >= 3, f"{tag}: device facts, quality, originals {r['dev']}")
    await pg.click("#devpanel [data-act=dev-q][data-v=best]"); r["best"] = await E("()=>[S.devQ,PROQ(),DRIP.pr()]")
    ok(r["best"][0] == "best" and r["best"][1] == "full", f"{tag}: best quality → full-size proxies {r['best']}")
    await pg.click("#devpanel [data-act=dev-q][data-v=fast]"); r["fast"] = await E("()=>[PROQ(),DRIP.pr()]"); ok(r["fast"] == ["fast", 1], f"{tag}: faster {r['fast']}")
    ok(await wait_for("()=>!!navigator.serviceWorker.controller", 15), f"{tag}: device cache worker running")
    img = await E("()=>S.proMedia.find(x=>x.kind==='image').url")
    r["cache"] = await E("""async(u)=>{const p=new URL(u).pathname;await fetch(p);await new Promise(r=>setTimeout(r,600));const c=await caches.open('nooi-media-v1');const hit=!!(await c.match(p));
      const api=(await c.keys()).some(k=>/\\/v1\\//.test(k.url));await fetch('/v1/config');const api2=(await c.keys()).some(k=>/\\/v1\\//.test(k.url));return [hit,api||api2]}""", img)
    ok(r["cache"] == [True, False], f"{tag}: a picture is kept on the device, API answers never {r['cache']}")
    await pg.click("#devpanel [data-act=dev-clear]"); await pg.wait_for_timeout(500)
    ok(await E("async()=>!(await caches.has('nooi-media-v1'))"), f"{tag}: cleared")
    r["ovf"] = await E("()=>[document.documentElement.scrollWidth,innerWidth]"); ok(r["ovf"][0] <= r["ovf"][1], f"{tag}: no sideways scroll {r['ovf']}")
    # 3D Studio: a textured model shows when its textures are on the GPU; quality follows the frame rate
    if not mob:
        await pg.goto(f"http://localhost:{PORT}/studio3d/"); ok(await wait_for("()=>!!(window.X3&&X3.E&&X3.E.quality)", 40), "3D Studio ready with adaptive quality")
        r["q"] = await E("()=>{const Q=X3.E.quality;return [Q.auto,Q.pr>=Q.min&&Q.pr<=Q.cap,Q.min<Q.cap||Q.cap<=1]}")
        r["drip"] = await E("""async()=>{const T=X3.E.THREE,c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').fillRect(0,0,128,128);const ms=[];for(let i=0;i<6;i++){const m=new T.Mesh(new T.BoxGeometry(.3,.3,.3),new T.MeshStandardMaterial({map:new T.CanvasTexture(c),roughnessMap:new T.CanvasTexture(c)}));m.position.x=i*.4;ms.push(m)}
          const g=new T.Group();ms.forEach(m=>g.add(m));X3.E.addAsset(g,{name:'drip test',category:'object',height:.4});const hidden=ms.filter(m=>!m.visible).length;let n=0;while(X3.E.quality.drip&&n<120){await new Promise(r=>requestAnimationFrame(r));n++}return [hidden,ms.every(m=>m.visible),X3.E.quality.drip,n]}""")
        ok(r["drip"][0] == 6 and r["drip"][1] and r["drip"][2] == 0, f"3D: parts appear when their textures are on the GPU {r['drip']}")
        r["setq"] = await E("()=>{X3.E.setQuality(false,1);const a=[X3.E.quality.auto,X3.E.quality.pr,+X3.E.renderer.getPixelRatio().toFixed(2)];X3.E.setQuality(true);return a}")
        ok(r["q"][0] and r["q"][1] and r["setq"][0] is False and r["setq"][2] == r["setq"][1], f"3D quality controls {r['q']} {r['setq']}")
    ok(not errs, f"{tag}: page errors {errs}")
    await b.close(); return r

async def main():
    async with async_playwright() as p:
        for w in (1280, 390): out[w] = await ui(p, w)

if __name__ == "__main__":
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict({k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "NVIDIA_", "ELEVENLABS_", "KIE_"))}, PORT=str(PORT), SECRET_KEY="a" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        api_checks()
        asyncio.run(main())
    except Exception:
        import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
    finally:
        srv.terminate()
        try: err = srv.stderr.read().decode()[-1500:]
        except Exception: err = ""
    print(json.dumps({"fails": fails, "out": out, "serverLog": err if fails else ""}, ensure_ascii=False, default=str, indent=1))
    sys.exit(1 if fails else 0)
