# v277 — nooi Studio gets the Filmora-16-class tools, drawn on the device (no server, no graphics card on the server):
#  · tracking: a box drawn on the preview is followed through the video; a picture set to follow it moves with it; "lock" keeps
#    the subject still (a one-subject stabiliser)
#  · 360°: an equirectangular video seen through a camera that looks left/right
#  · colour mask: one colour picked and changed alone (red → grey, blue stays)
#  · track matte: the clip on the track above becomes this clip's mask and isn't drawn itself
#  · motion blur: a fast-moving picture is smeared along its motion, a still one isn't
#  · batch export: two platforms in one go make two real videos
#  · the Inspector sections in English and Arabic; no page errors
# Run: python3 tests/v277.py
import asyncio, json, os, subprocess, sys, tempfile
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8777; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v277-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
VP9 = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "800k"]
# a white square crossing a dark frame: x = 40 + 120·t (its centre 70 + 120·t of 640), y centre 180
FF("-f", "lavfi", "-i", "color=c=0x202020:s=640x360:d=3:r=30", "-f", "lavfi", "-i", "color=c=white:s=60x60:d=3:r=30", "-filter_complex", "[0][1]overlay=x='40+t*120':y=150:shortest=1", *VP9, D + "/move.webm")
# a 360° picture: four quarters red | green | blue | yellow
FF("-f", "lavfi", "-i", "color=c=red:s=256x512:d=2:r=30", "-f", "lavfi", "-i", "color=c=0x00c000:s=256x512:d=2:r=30", "-f", "lavfi", "-i", "color=c=blue:s=256x512:d=2:r=30", "-f", "lavfi", "-i", "color=c=yellow:s=256x512:d=2:r=30",
   "-filter_complex", "[0][1][2][3]hstack=inputs=4", *VP9, D + "/pano.webm")
FF("-f", "lavfi", "-i", "color=c=red:s=320x360", "-f", "lavfi", "-i", "color=c=blue:s=320x360", "-filter_complex", "[0][1]hstack", "-frames:v", "1", D + "/rb.png")
FF("-f", "lavfi", "-i", "color=c=red:s=64x64", "-frames:v", "1", D + "/red.png")
FF("-f", "lavfi", "-i", "color=c=white:s=200x120", "-frames:v", "1", D + "/white.png")
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    print(("ok   " if ok else "FAIL ") + name + ("" if ok or info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]), flush=True)
    if not ok: fails.append(name)
P = "window.__studio.editor.project"
PIX = "(xy)=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),d=new Uint8Array(4);g.readPixels(Math.round((c.width-1)*xy[0]),Math.round((c.height-1)*(1-xy[1])),1,1,g.RGBA,g.UNSIGNED_BYTE,d);return Array.from(d.slice(0,3))}"
ROW = "(y)=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),w=c.width,d=new Uint8Array(w*4);g.readPixels(0,Math.round((c.height-1)*(1-y)),w,1,g.RGBA,g.UNSIGNED_BYTE,d);const o=[];for(let i=0;i<w;i++)o.push(d[i*4]);return o}"
red = lambda c: c[0] > 170 and c[1] < 90 and c[2] < 90

async def fresh(pg, files):
    E = pg.evaluate
    await E("()=>{const e=window.__studio.editor;e.run('clear',p=>{for(const t of p.tracks)t.clips=[];p.transitions=[];p.assets={}});e.select([])}")
    await pg.set_input_files('[data-testid="file-input"]', [D + "/" + f for f in files])
    await pg.wait_for_function("(n)=>Object.keys(" + P + ".assets).length===n", arg=len(files), timeout=30000); await pg.wait_for_timeout(300)
    return await E("()=>Object.values(" + P + ".assets).map(a=>({id:a.id,name:a.name,kind:a.kind,w:a.w,h:a.h}))")

async def show(pg, t):
    await pg.evaluate("(t)=>window.__studio.player.seek(t)", t); await pg.wait_for_timeout(900)

async def run(p, lang, vw, vh):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": vw, "height": vh}, accept_downloads=True, locale="ar" if lang == "ar" else "en-US")
    pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.add_init_script("try{localStorage.setItem('nooi-studio-ui',JSON.stringify({lang:'" + lang + "'}))}catch(e){}")
    await pg.add_init_script("window.__toasts=[];new MutationObserver(()=>{for(const t of document.querySelectorAll('.toast'))if(!window.__toasts.includes(t.textContent))window.__toasts.push(t.textContent)}).observe(document,{subtree:true,childList:true})")
    await pg.goto(B + "/studio/"); await pg.wait_for_function("window.__studio&&window.__studio.player", timeout=30000)
    if lang == "ar":
        A = await fresh(pg, ["move.webm"]); await E("(id)=>{const a=" + P + ".assets[id];const c=window.__studio.actions.addAsset(a,0);window.__studio.editor.select([c.id])}", A[0]["id"])
        await pg.wait_for_timeout(500)
        secs = await E("()=>[...document.querySelectorAll('.inspector .isech b')].map(b=>b.textContent)")
        chk("Arabic: the new sections are named in Arabic", all(x in secs for x in ["التتبّع", "ضبابية الحركة", "قناع المسار (Track Matte)", "فيديو 360°"]), secs)
        chk("Arabic: no page errors", not errs, errs[:3]); await b.close(); return

    # ---- tracking: draw a box around the square at 0 s, follow, then a red picture follows it; lock keeps it still
    A = await fresh(pg, ["move.webm", "red.png"]); mv = next(a for a in A if a["name"].startswith("move")); rd = next(a for a in A if a["name"].startswith("red"))
    await E("(id)=>{const a=" + P + ".assets[id];const c=window.__studio.actions.addAsset(a,0);window.__studio.editor.select([c.id])}", mv["id"])
    await show(pg, 0); await pg.click('[data-testid="sec-track277"]') if not await E("()=>!!document.querySelector('[data-testid=track-pick]')") else None
    await pg.click('[data-testid="track-pick"]'); await pg.wait_for_timeout(200)
    bb = await (await pg.query_selector('[data-testid="pick277"]')).bounding_box()
    # the square at 0 s: x 40..100, y 150..210 of 640×360 (the project is 16:9 so the picture fills the preview)
    x0, y0 = bb["x"] + bb["width"] * 36 / 640, bb["y"] + bb["height"] * 146 / 360; x1, y1 = bb["x"] + bb["width"] * 104 / 640, bb["y"] + bb["height"] * 214 / 360
    await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=4); await pg.mouse.move(x1, y1, steps=4); await pg.mouse.up()
    try: await pg.wait_for_function("()=>{const c=" + P + ".tracks.flatMap(t=>t.clips).find(c=>c.track);return c&&c.track.pts.length>20}", timeout=90000)
    except Exception:
        print("DEBUG", await E("()=>({ui:window.__studio.ui.get().pick,tr:window.__studio.ui.get().tracking,toasts:window.__toasts,tracks:"+P+".tracks.flatMap(t=>t.clips).map(c=>c.track)})"), errs); raise
    tr = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).find(c=>c.track).track")
    last = tr["pts"][-1]; exp = (70 + 120 * last[0]) / 640
    chk("tracking follows the square to the end (within 2 % of the picture)", abs(last[1] - exp) < 0.02 and abs(last[2] - 0.5) < 0.03, [last, exp, len(tr["pts"])])
    chk("the Inspector says it was tracked", await E("()=>!!document.querySelector('[data-testid=track-done]')"))
    tid = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).find(c=>c.track).id")
    v2 = await E("()=>{const t=" + P + ".tracks.filter(t=>t.kind==='video');return t.length>1?t[0].id:null}")
    if not v2: v2 = await E("()=>window.__studio.editor.run('t',p=>window.__studio.core.addTrack(p,'video').id)")
    rid = await E("([id,tr])=>{const c=window.__studio.actions.addAsset(" + P + ".assets[id],0,tr);return c.id}", [rd["id"], v2])
    await E("([id,tid])=>window.__studio.editor.run('f',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id){c.dur=3;c.transform.scale=0.12;c.transform.x=(70/640)-0.5;c.transform.y=0;c.follow={clip:tid}}})", [rid, tid])
    await E("()=>window.__studio.editor.select([])")
    await show(pg, 0.1); a0 = await E(PIX, [70 / 640 + 120 * 0.1 / 640, 0.5])
    await show(pg, 2.0); at = await E(PIX, [(70 + 240) / 640, 0.5]); away = await E(PIX, [70 / 640, 0.5])
    chk("a picture set to follow the tracked square moves with it", red(a0) and red(at) and not red(away), [a0, at, away])
    await E("([rid,tid])=>window.__studio.editor.run('l',p=>{for(const t of p.tracks)for(const c of t.clips){if(c.id===rid)c.follow=null;if(c.id===tid)c.track.lock=1}})", [rid, tid])
    await E("(rid)=>window.__studio.editor.run('h',p=>{for(const t of p.tracks)t.clips=t.clips.filter(c=>c.id!==rid)})", rid)
    await show(pg, 2.0); still = await E(PIX, [70 / 640, 0.5]); gone = await E(PIX, [(70 + 240) / 640, 0.5])
    chk("lock keeps the tracked square where it was in the first frame", min(still) > 170 and max(gone) < 120, [still, gone])

    # ---- 360°: looking 45° right shows blue, 45° left shows green
    A = await fresh(pg, ["pano.webm"]); await E("(id)=>{const c=window.__studio.actions.addAsset(" + P + ".assets[id],0);window.__studio.editor.select([c.id])}", A[0]["id"])
    await pg.wait_for_timeout(400)
    if not await E("()=>!!document.querySelector('[data-testid=pano-on]')"): await pg.click('[data-testid="sec-pano277"]')
    await pg.click('[data-testid="pano-on"]'); await pg.wait_for_timeout(300)
    await E("()=>window.__studio.editor.run('y',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.pano){c.pano.yaw=45;c.pano.fov=40}})"); await show(pg, 0.5); right = await E(PIX, [0.5, 0.5])
    await E("()=>window.__studio.editor.run('y',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.pano)c.pano.yaw=-45})"); await show(pg, 0.5); left = await E(PIX, [0.5, 0.5])
    await E("()=>window.__studio.editor.run('y',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.pano)c.pano.yaw=-135})"); await show(pg, 0.5); back = await E(PIX, [0.5, 0.5])
    chk("360°: the camera looks right (blue), left (green) and behind (red), filling the frame", right[2] > 180 and right[0] < 80 and left[1] > 150 and left[2] < 80 and red(back), [right, left, back])

    # ---- colour mask: red becomes grey, blue stays
    A = await fresh(pg, ["rb.png"]); await E("(id)=>{const c=window.__studio.actions.addAsset(" + P + ".assets[id],0);window.__studio.editor.select([c.id])}", A[0]["id"])
    await show(pg, 0.3); r0, b0 = await E(PIX, [0.25, 0.5]), await E(PIX, [0.75, 0.5])
    await pg.click('[data-testid="insp-color"]'); await pg.wait_for_timeout(300)
    if not await E("()=>!!document.querySelector('[data-testid=cm-pick]')"): await pg.click('[data-testid="sec-cmask277"]')
    await pg.click('[data-testid="cm-pick"]'); await pg.wait_for_timeout(200)
    bb = await (await pg.query_selector('[data-testid="pick277"]')).bounding_box(); await pg.mouse.click(bb["x"] + bb["width"] * 0.25, bb["y"] + bb["height"] * 0.5)
    await pg.wait_for_timeout(300); cm = await E("()=>" + P + ".tracks.flatMap(t=>t.clips)[0].cmask")
    await E("()=>window.__studio.editor.run('s',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.cmask)c.cmask.sat=-1})"); await show(pg, 0.3)
    r1, b1 = await E(PIX, [0.25, 0.5]), await E(PIX, [0.75, 0.5])
    chk("colour mask: the picked red turns grey, the blue half stays blue", cm and cm["on"] and abs(cm["hue"]) < 0.02 and max(r1) - min(r1) < 30 and b1[2] > 200 and abs(b1[2] - b0[2]) < 10, [cm, r0, r1, b0, b1])

    # ---- track matte: a white box on the track above shows the picture only inside it, and isn't drawn itself
    A = await fresh(pg, ["rb.png", "white.png"]); rb = next(a for a in A if a["name"].startswith("rb")); wh = next(a for a in A if a["name"].startswith("white"))
    vids = await E("()=>" + P + ".tracks.filter(t=>t.kind==='video').map(t=>t.id)")
    base = await E("([id,tr])=>window.__studio.actions.addAsset(" + P + ".assets[id],0,tr).id", [rb["id"], vids[-1]])
    mat = await E("([id,tr])=>window.__studio.actions.addAsset(" + P + ".assets[id],0,tr).id", [wh["id"], vids[-2]])
    await E("([m,b])=>window.__studio.editor.run('m',p=>{for(const t of p.tracks)for(const c of t.clips){if(c.id===m){c.transform.scale=0.3;c.transform.x=-0.25}if(c.id===b){c.matte={mode:'alpha',invert:false}}}})", [mat, base])
    await E("()=>window.__studio.editor.select([])"); await show(pg, 0.3)
    inside, outside, white_gone = await E(PIX, [0.25, 0.5]), await E(PIX, [0.75, 0.5]), await E(PIX, [0.25, 0.5])
    chk("track matte: the picture shows only inside the clip above (red there), black outside; the matte itself isn't drawn", red(inside) and max(outside) < 30 and not (white_gone[0] > 230 and white_gone[1] > 230), [inside, outside])
    await E("(b)=>window.__studio.editor.run('i',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===b)c.matte.invert=true})", base); await show(pg, 0.3)
    inv_in, inv_out = await E(PIX, [0.25, 0.5]), await E(PIX, [0.75, 0.5])
    chk("track matte inverted: hidden inside, shown outside (blue)", max(inv_in) < 30 and inv_out[2] > 200, [inv_in, inv_out])

    # ---- motion blur: a red square moving fast across the frame is smeared; with no blur its edge is sharp
    A = await fresh(pg, ["red.png"]); sq = await E("(id)=>window.__studio.actions.addAsset(" + P + ".assets[id],0).id", A[0]["id"])
    await E("(id)=>window.__studio.editor.run('k',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id){c.dur=2;c.transform.scale=0.2;c.keyframes.x=[{t:0,v:-0.4,ease:'linear'},{t:1,v:0.4,ease:'linear'}]}})", sq)
    await E("()=>window.__studio.editor.select([])"); await show(pg, 0.5)
    def soft(row):
        return sum(1 for v in row if 40 < v < 200)
    sharp = soft(await E(ROW, 0.5))
    await E("(id)=>window.__studio.editor.run('b',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id)c.mblur=1})", sq); await show(pg, 0.5)
    blur = soft(await E(ROW, 0.5))
    await E("(id)=>window.__studio.editor.run('b',p=>{for(const t of p.tracks)for(const c of t.clips)if(c.id===id)c.keyframes.x=[]})", sq); await show(pg, 0.5)
    still = soft(await E(ROW, 0.5))
    chk("motion blur smears a moving picture along its motion, and leaves a still one sharp", blur > sharp + 15 and still <= sharp + 2, [sharp, blur, still])

    # ---- batch export: two platforms → two real videos
    A = await fresh(pg, ["move.webm"]); await E("(id)=>{const c=window.__studio.actions.addAsset(" + P + ".assets[id],0);window.__studio.editor.run('d',p=>{for(const t of p.tracks)for(const c2 of t.clips)c2.dur=1})}", A[0]["id"])
    await E("()=>window.__studio.ui.set({exportOpen:true})"); await pg.wait_for_selector('[data-testid="batch"]', timeout=10000)
    ids = await E("()=>[...document.querySelectorAll('[data-testid^=batch-]')].map(b=>b.dataset.testid).filter(x=>!['batch-go','batch-file'].includes(x))")
    await pg.click('[data-testid="' + ids[0] + '"]'); await pg.click('[data-testid="' + ids[1] + '"]'); await pg.click('[data-testid="batch-go"]')
    await pg.wait_for_function("()=>document.querySelectorAll('[data-testid=batch-file]').length===2", timeout=240000)
    sizes = await E("()=>Promise.all([...document.querySelectorAll('[data-testid=batch-file]')].map(a=>fetch(a.href).then(r=>r.blob()).then(b=>[a.download,b.size,b.type])))")
    chk("batch export makes one real video per platform picked", len(sizes) == 2 and all(s[1] > 5000 and s[2].startswith("video/") for s in sizes) and sizes[0][0] != sizes[1][0], [ids[:2], sizes])
    chk("no page errors", not errs, errs[:3]); await b.close()

async def main():
    try:
        for _ in range(60):
            try:
                import urllib.request; urllib.request.urlopen(B + "/v1/health", timeout=2); break
            except Exception: await asyncio.sleep(0.5)
        async with async_playwright() as p:
            await run(p, "en", 1440, 900); await run(p, "ar", 1440, 900)
    finally: srv.kill()
    print("v277", "PASS" if not fails else "FAIL", fails)
    sys.exit(1 if fails else 0)
asyncio.run(main())
