# v139: the editor exports frame by frame — every frame drawn exactly as the preview with the video decoded for that moment, the
# sound mixed separately (a 2× clip keeps its pitch), the server makes the MP4; a browser without WebCodecs still records.
# Also the check-up: the engine's balance read in any shape, the time of the last refusal. Run: python3 tests/v139.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request, struct
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8386
D = tempfile.mkdtemp(prefix="nooi-v139-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOK = "nooi_" + "p" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}, "stu": {"plan": "studio", "credits": 100, "jobs": {}, "ledger": [],
           "tokens": [{"id": "tkp", "name": "t", "hash": __import__("hashlib").sha256(TOK.encode()).hexdigest(), "last4": TOK[-4:], "created": 1, "dailyCap": 10000000}]}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
COLS = ["0xff0000", "0x00ff00", "0x0000ff", "0xffff00", "0xff00ff", "0x00ffff"]   # a.webm: one colour per second
FF(*sum([["-f", "lavfi", "-i", f"color=c={c}:s=640x360:r=30:d=1"] for c in COLS], []), "-f", "lavfi", "-i", "sine=frequency=330:duration=6",
   "-filter_complex", "".join(f"[{i}:v]" for i in range(6)) + "concat=n=6:v=1:a=0[v]", "-map", "[v]", "-map", "6:a", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-g", "60", "-b:v", "800k", "-c:a", "libopus", "-t", "6", M + "a.webm")
FF("-f", "lavfi", "-i", "color=c=0xffffff:s=640x360:r=30:d=5", "-f", "lavfi", "-i", "sine=frequency=550:duration=5", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "500k", "-c:a", "libopus", "-shortest", M + "b.webm")
FF("-f", "lavfi", "-i", "sine=frequency=220:duration=20", "-c:a", "libmp3lame", M + "music.mp3")
SETUP = """async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
 const now=Date.now(),mk=(id,kind,url,dur,extra)=>Object.assign({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url},extra||{});
 S.jobs.push(mk('ed_va','video','/media/a.webm',6),mk('ed_vb','video','/media/b.webm',5),mk('ed_mu','music','/media/music.mp3',20));
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.format='reels';S.ed.fit='fill';
 for(const id of ['ed_va','ed_vb']){await edUseJob(S.jobs.find(j=>j.id===id),{stay:true,quiet:true,t:1})}
 go('edit');renderAll()}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height:format=duration", "-of", "json", f], capture_output=True, text=True).stdout or "{}")
    v = [s for s in j.get("streams", []) if s["codec_type"] == "video"]; a = [s for s in j.get("streams", []) if s["codec_type"] == "audio"]
    return {"w": v[0]["width"] if v else 0, "h": v[0]["height"] if v else 0, "vc": v[0]["codec_name"] if v else "", "audio": bool(a), "dur": round(float((j.get("format") or {}).get("duration") or 0), 2)}
def pixel(f, t):   # the colour in the middle of the frame at t
    b = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", f, "-frames:v", "1", "-vf", "crop=8:8:(iw-8)/2:(ih-8)/2,scale=1:1,format=rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
    return tuple(b[:3]) if len(b) >= 3 else None
def freq(f, a, b):   # the main frequency between a and b (zero crossings of a single tone)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(a), "-t", str(b - a), "-i", f, "-ac", "1", "-ar", "48000", "-f", "s16le", "-"], capture_output=True).stdout
    s = struct.unpack("<%dh" % (len(raw) // 2), raw); z = sum(1 for i in range(1, len(s)) if (s[i - 1] < 0) != (s[i] < 0))
    return round(z / 2 / max(.001, len(s) / 48000)), (sum(x * x for x in s) / max(1, len(s))) ** .5
near = lambda c, want: c is not None and all(abs(c[i] - want[i]) < 60 for i in range(3))
RGB = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255), (0, 255, 255)]

async def page_side(p):
    b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E(SETUP); await pg.wait_for_function("S.ed.clips.length===2&&S.ed.clips.every(c=>{const m=M['c_'+c.id];return m&&m.el&&m.el.readyState>=1})", timeout=20000)
    # clip 2 at 2× (its 550 Hz tone must stay 550 Hz), a title at the top, no music; MP4 for Reels
    await E("()=>{const c=S.ed.clips;c[0].in=0;c[0].out=6;c[0].vol=100;c[1].in=0;c[1].out=5;c[1].speed=2;c[1].vol=100;c[0].trans='cut';S.ed.clipSound=true;S.ed.texts=[{id:'t1',text:'TITLE',start:0,end:8.5,pos:'top',style:'clean',anim:'none',size:5}];S.ed.musicVol=0;M.edMusic=null;S.ed.fmtOut='mp4';S.ed.tab='export';S.ed.rcheck=false;renderView()}")
    lede = await E("()=>document.body.innerText.includes('draws every frame exactly')")
    chk("the export tab says how it works now", lede)
    t0 = time.time()
    async with pg.expect_download(timeout=240000) as dl: await E("()=>{edExport()}")
    d = await dl.value; f = D + "/exp_" + d.suggested_filename; await d.save_as(f); took = round(time.time() - t0, 1)
    st = await E("()=>R139.stats"); pr = probe(f); total = await E("()=>edTotal()")
    out["export"] = {"stats": st, "file": pr, "name": d.suggested_filename, "took": took, "total": total}
    chk("export: drawn frame by frame (not recorded), every frame, none missing", st and st.get("path") == "frames" and st.get("frames") == round(total * st.get("fps", 30)) and st.get("misses", 9) <= 2 and not st.get("fallbacks") and st.get("w") == 1080 and st.get("h") == 1920, out["export"])
    chk("…the delivered MP4: 1080×1920 for Reels, with sound, the timeline's exact length", f.endswith(".mp4") and pr["w"] == 1080 and pr["h"] == 1920 and pr["audio"] and abs(pr["dur"] - total) <= 0.15, out["export"])
    cols = [pixel(f, k + .5) for k in range(6)]; edge = [pixel(f, 2.95), pixel(f, 3.05)]
    out["colours"] = {"mid": cols, "edge": edge, "after": pixel(f, 7.0)}
    chk("…every second shows the clip's own frame (the colour of that second)", all(near(cols[k], RGB[k]) for k in range(6)), cols)
    chk("…frame-exact at a change (2.95 s still blue, 3.05 s already yellow); the 2× clip after it", near(edge[0], RGB[2]) and near(edge[1], RGB[3]) and near(pixel(f, 7.0), (255, 255, 255)), out["colours"])
    f1, r1 = freq(f, 1.0, 4.0); f2, r2 = freq(f, 6.4, 8.2); out["sound"] = {"clip1": [f1, round(r1)], "clip2_2x": [f2, round(r2)]}
    chk("…the sound: clip 1 at 330 Hz; the 2× clip keeps its 550 Hz (not 1100)", abs(f1 - 330) < 25 and abs(f2 - 550) < 40 and r1 > 300 and r2 > 300, out["sound"])
    # the mix on its own: music under everything, a sound effect at 1 s
    mix = await E("""async()=>{M.edMusic=null;await edUseJob(S.jobs.find(j=>j.id==='ed_mu'),{stay:true,quiet:true,t:1});S.ed.musicVol=80;S.ed.clipSound=false;S.ed.sfx=[{id:'s1',n:'pop',t:1,vol:100}];
       const b=await mix139(edTotal());if(!b)return null;const d=b.getChannelData(0),rms=(a,z)=>{let s=0,n=0;for(let i=Math.floor(a*48000);i<Math.floor(z*48000);i++){s+=d[i]*d[i];n++}return Math.sqrt(s/Math.max(1,n))};
       return{len:+(b.length/48000).toFixed(2),music:rms(3,5),pop:rms(1,1.15),before:rms(.8,.95)}}""")
    out["mix"] = mix
    chk("the sound mix: music the whole length, the sound effect at its moment", mix and abs(mix["len"] - total) < .05 and mix["music"] > .05 and mix["pop"] > mix["before"] * 1.1, mix)
    # a browser without WebCodecs: the old recording still exports
    await E("()=>{S.ed.clips.splice(1,1);S.ed.sfx=[];S.ed.clipSound=true;M.edMusic=null;window.__VE=window.VideoEncoder;delete window.VideoEncoder;window.VideoEncoder=undefined;R139.stats=null;renderView()}")
    async with pg.expect_download(timeout=120000) as dl: await E("()=>{edExport()}")
    d2 = await dl.value; f2p = D + "/exp2_" + d2.suggested_filename; await d2.save_as(f2p); st2 = await E("()=>R139.stats"); pr2 = probe(f2p)
    await E("()=>{window.VideoEncoder=window.__VE}")
    out["fallback"] = {"stats": st2, "file": pr2}
    chk("no WebCodecs: the old recording still exports (and the tab keeps its old words)", st2 is None and pr2["w"] == 1080 and pr2["dur"] > 4, out["fallback"])
    chk("page: no errors", not errs, errs)
    await b.close()

def doctor_side():
    T = tempfile.mkdtemp(prefix="nooi-v139c-"); APP, BIN = T + "/opt/nooi", T + "/bin"; os.makedirs(APP + "/data"); os.makedirs(BIN)
    open(APP + "/.env", "w").write("PORT=8080\n"); now = time.time()
    json.dump({"users": {}, "settings": {"status": {"kie": {"state": "online", "note": "OK · 120 credits left", "checked": int(now * 1000) - 60000}}}}, open(APP + "/data/db.json", "w"))
    lines = [f"{now - 1800:.6f} h nooi[1]: job a failed: Kie AI 402: Credits insufficient : Your current balance isn't enough"] * 2
    open(T + "/j.txt", "w").write("\n".join(lines) + "\n"); open(T + "/jc.txt", "w").write("\n".join(l.split(": ", 1)[1] for l in lines) + "\n")
    for k, v in {"journalctl": f'case "$*" in *short-unix*) cat {T}/j.txt;; *) cat {T}/jc.txt;; esac', "systemctl": "exit 0", "curl": "printf 000", "ffmpeg": "exit 0"}.items():
        open(BIN + "/" + k, "w").write("#!/usr/bin/env bash\n" + v + "\n"); os.chmod(BIN + "/" + k, 0o755)
    r = subprocess.run(["bash", ROOT + "/deploy/doctor.sh"], env=dict(os.environ, PATH=BIN + ":" + os.environ["PATH"], APP=APP), capture_output=True, text=True, timeout=120)
    need = r.stdout[r.stdout.find("== What needs you"):]; out["doctor"] = need[:900]
    chk("check-up: the time of the last refusal, and 'already solved' when the engine answered normally after it", re.search(r"The last one was at \d\d:\d\d \(30 min ago\)", need) and "already solved" in need, need[:700])
    js = r'''import("./lib/health.js").then(m=>{console.log(JSON.stringify([5,"12.5",{credits:3},{balance:"0"},"x",null].map(m.credits139)));process.exit(0)})'''
    rr = subprocess.run(["node", "--input-type=module", "-e", js], cwd=ROOT, capture_output=True, text=True, timeout=60)
    got = json.loads((rr.stdout.strip().splitlines() or ["null"])[-1]); out["credits"] = got
    chk("the engine's balance read as a number, text or inside an object", got == [5, 12.5, 3, 0, None, None], got)

def api(path, body=None, method=None, tok=None):
    h = {"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})}
    req = urllib.request.Request(f"http://localhost:{PORT}{path}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def projects_api():
    doc = {"v": 1, "ed": {"clips": [{"id": "c1", "src": {"k": "job", "job": "x"}, "in": 0, "out": 4, "speed": 2}, {"id": "c2", "src": {"k": "upload"}, "in": 1, "out": 4, "speed": 1}], "texts": [], "format": "reels"}, "media": {}}
    r = api("/v1/projects/abc123x", {"name": "My edit", "doc": doc}, "PUT")
    chk("projects: saved on the server with its length, clips and format", r.get("id") == "abc123x" and r.get("dur") == 5 and r.get("clips") == 2 and r.get("format") == "reels", r)
    l = api("/v1/projects"); g = api("/v1/projects/abc123x")   # (newest first — the edit open in the browser above went to the account by itself too, v149)
    chk("…listed, and read back as it was", [p["id"] for p in l.get("projects", [])][:1] == ["abc123x"] and g.get("doc") == doc and g.get("name") == "My edit", [l, g.get("name")])
    bad = [api("/v1/projects/a!", {"doc": doc}, "PUT").get("_status"), api("/v1/projects/abc123y", {"doc": {"x": 1}}, "PUT").get("_status"),
           api("/v1/projects/abc123y", {"doc": {"ed": {"clips": [], "pad": "x" * (4 * 1024 * 1024 + 10)}}}, "PUT").get("_status")]
    chk("…a bad id, a document that isn't a project, a 4 MB+ one: refused", bad == [400, 400, 413], bad)
    other = [api("/v1/projects/abc123x", tok=TOK).get("_status"), len(api("/v1/projects", tok=TOK).get("projects", [1])), api("/v1/projects/abc123x", method="DELETE", tok=TOK).get("_status")]
    chk("…another account can't see, read or delete it", other == [404, 0, 403], other)
    api("/v1/projects/zzz999a", {"name": "tmp", "doc": doc}, "PUT"); d = api("/v1/projects/zzz999a", method="DELETE")
    chk("…deleted: gone from the list and its file", d.get("ok") and "zzz999a" not in [p["id"] for p in api("/v1/projects").get("projects", [])] and not any(f.startswith("zzz999a") for _, _, fs in os.walk(D + "/data/projects139") for f in fs), d)

async def projects_page(p):
    b = await p.chromium.launch(); errs = []
    async def device(w):
        ctx = await b.new_context(viewport={"width": w, "height": 900}); pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000); return pg
    pg = await device(1280); E = pg.evaluate
    await E(SETUP); await pg.wait_for_function("S.ed.clips.length===2", timeout=20000)
    # a clip that is only on this device (a file picked from the phone)
    await E("""async()=>{const b=await(await fetch('/media/b.webm')).blob();edAddFiles([new File([b],'my-clip.webm',{type:'video/webm'})]);S.ed.texts=[{id:'t1',text:'HELLO',start:0,end:2,pos:'top',style:'clean',anim:'none',size:5}];persist();renderView()}""")
    hdr = await E("()=>!!document.querySelector('[data-act=pj139]')")
    await E("()=>document.querySelector('[data-act=pj139]').click()"); await pg.wait_for_function("!!document.querySelector('[data-act=pj139-save]')", timeout=10000)
    t1 = await E("()=>document.getElementById('pj139').textContent")
    await E("()=>document.querySelector('[data-act=pj139-save]').click()"); await pg.wait_for_function("PJ139.list&&S.ed.srv139&&PJ139.list.some(p=>p.id===S.ed.srv139)&&!PJ139.busy", timeout=30000)
    s1 = await E("()=>({id:S.ed.srv139,local:PJ139.local,txt:document.getElementById('pj139').textContent,n:S.ed.clips.length})")
    out["save"] = {"hdr": hdr, "before": t1[:120], "after": s1}
    chk("projects page: a Projects button by Export; 'only on this device' before; saved with the device's file uploaded", hdr and "only on this device" in t1 and s1["id"] and s1["local"] == 0 and "on your account" in s1["txt"], out["save"])
    pid = s1["id"]; doc = api("/v1/projects/" + pid).get("doc") or {}
    up = [v for k, v in (doc.get("media") or {}).items() if k.startswith("c_")]
    chk("…the document: the clips, the text, the device's file as a /media address, made clips with their address", len(doc.get("ed", {}).get("clips", [])) == 3 and doc["ed"]["texts"][0]["text"] == "HELLO" and up and up[0]["url"].startswith("/media/")
        and all(c["src"].get("url139", "").startswith("/media/") for c in doc["ed"]["clips"] if c["src"]["k"] == "job") and "sel" not in doc["ed"], {"media": doc.get("media"), "clips": [c["src"] for c in doc.get("ed", {}).get("clips", [])]})
    # another device (nothing in its storage): Projects → Open
    pg2 = await device(390); E2 = pg2.evaluate
    await E2("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;go('edit');renderAll()}")
    await E2("()=>sheet139()"); await pg2.wait_for_function("!!document.querySelector('[data-act=pj139-open][data-id=\"" + pid + "\"]')", timeout=15000)
    await E2("()=>document.querySelector('[data-act=pj139-open][data-id=\"" + pid + "\"]').click()"); await pg2.wait_for_function("S.ed.clips.length===3", timeout=15000)
    await pg2.wait_for_function("S.ed.clips.every(c=>{const m=clipMedia(c)||M['c_'+c.id];return m&&m.el&&(m.el.readyState>=1||m.el.complete)})", timeout=20000)
    o2 = await E2("()=>({n:S.ed.clips.length,txt:S.ed.texts.map(t=>t.text),srv:S.ed.srv139,src:S.ed.clips.map(c=>{const m=clipMedia(c)||M['c_'+c.id];return m&&m.el&&(m.el.currentSrc||m.el.src||'').replace(location.origin,'')}),btn:getComputedStyle(document.querySelector('.pj139b span')).display})")
    out["open"] = o2
    chk("another device: Projects → Open brings back the clips (made ones and the uploaded one), the text, the project's link", o2["n"] == 3 and o2["txt"] == ["HELLO"] and o2["srv"] == pid and all(x and x.startswith("/media/") for x in o2["src"]), o2)
    chk("…on a phone the Projects button is an icon (no words beside it)", o2["btn"] == "none", o2)
    # it keeps itself up to date
    await E2("()=>{S.ed.texts[0].text='CHANGED';persist()}"); await pg2.wait_for_timeout(8000)
    t2 = [x["text"] for x in (api("/v1/projects/" + pid).get("doc") or {}).get("ed", {}).get("texts", [])]
    chk("…a change there is saved by itself a few seconds later", t2 == ["CHANGED"], t2)
    chk("projects page: no errors", not errs, errs)
    await b.close()

async def main():
    async with async_playwright() as p:
        await page_side(p)
        try: projects_api()
        except Exception as e: fails.append("projects api crashed: " + repr(e)[:300])
        try: await projects_page(p)
        except Exception as e: fails.append("projects page crashed: " + repr(e)[:400])
    pdir = D + "/data/projects139/" + __import__("hashlib").sha1(b"local").hexdigest()[:24]
    had = os.path.isdir(pdir); r = api("/v1/me/delete", {"confirm": "DELETE"})
    chk("deleting the account deletes its projects", had and not os.path.exists(pdir), [had, r])
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict({k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "LLM_"))}, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/health", timeout=2); break
        except Exception: time.sleep(.2)
    try: doctor_side()
    except Exception as e: fails.append("doctor crashed: " + repr(e)[:300])
    asyncio.run(main())
finally: srv.kill()
print(json.dumps({"fails": fails, "out": {k: json.dumps(v, ensure_ascii=False, default=str)[:1400] for k, v in out.items()}, "dir": D}, ensure_ascii=False, indent=1))
