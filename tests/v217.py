# v217 — the editor's own library: what you upload waits there first (videos, pictures, sounds); you tap or drag what you want onto
# the timeline (the owner: "the videos should be in the library not in the timeline, then I select and drag").
#  · Upload (several at once, sounds too) and files dropped on the editor go to "Uploads" in the Media panel — the timeline is untouched
#  · each item has a small picture (made on this device) and its length; a sound shows a note
#  · a tap on + puts a video/picture at the end; a drag puts it where it is dropped (before the clip under the pointer);
#    a sound dragged to 2 s sits on the sound lane at 2 s
#  · × removes it from the library (the timeline keeps what it has); the library survives a reload (files kept on this device)
#  · an Arabic phone: the same library in the Media sheet, a tap adds; nothing sideways
# Run: python3 tests/v217.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8691; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v217-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-c:a", "libopus", "-shortest", D + "/media/a.webm")
FF("-f", "lavfi", "-i", "color=c=0x2266cc:s=640x360:d=4:r=30", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "200k", D + "/media/beach.webm")
FF("-f", "lavfi", "-i", "color=c=0xdd8822:s=800x600", "-frames:v", "1", D + "/media/photo.png")
FF("-f", "lavfi", "-i", "sine=frequency=520:duration=3", D + "/media/voice.wav")
open(D + "/media/notes.txt", "w").write("not media")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Made',title:'Made',created:now,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});go('edit');S.ed.lt143='media';S.ed.tab='media';S.ed.pclosed143=null;renderAll()}"""
TL = "(t)=>{const w=document.querySelector('.tlwrap');w.scrollLeft=Math.max(0,40+t*S.ed.zoom-w.clientWidth/2);const R=document.getElementById('tlin').getBoundingClientRect(),b=document.querySelector('#tlin .blk.v').getBoundingClientRect();return [R.left+40+t*S.ed.zoom,b.top+b.height/2]}"
STATE = "()=>({clips:S.ed.clips.length,names:S.ed.clips.map(c=>c.src&&c.src.name||c.src&&c.src.job||''),bin:(S.ed.bin217||[]).map(x=>[x.ty,x.name,x.dur,!!x.poster]),tiles:document.querySelectorAll('.e-assets [data-act=\"bin217\"], .e-sheet [data-act=\"bin217\"]').length,sfx:(S.ed.sfx||[]).filter(x=>x.n==='file').map(x=>[x.name,x.t])})"

async def tile(pg, sel):
    return await pg.evaluate("(s)=>{const e=document.querySelector(s);if(!e)return null;e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}", sel)
async def mdrag(pg, sel, t):
    a = await tile(pg, sel)
    if not a: return False
    await pg.wait_for_timeout(80); a = await tile(pg, sel); b = await pg.evaluate(TL, t)
    await pg.mouse.move(*a); await pg.mouse.down()
    for i in range(1, 13): await pg.mouse.move(a[0] + (b[0] - a[0]) * i / 12, a[1] + (b[1] - a[1]) * i / 12); await pg.wait_for_timeout(15)
    await pg.mouse.up(); await pg.wait_for_timeout(600); return True
async def wait_bin(pg, n):
    try: await pg.wait_for_function(f"(S.ed.bin217||[]).length==={n}&&S.ed.bin217.every(x=>x.ty==='a'?x.dur>0:x.poster)", timeout=15000)
    except Exception: pass

async def desktop(p):
    tag = "en 1440"; b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await E(SETUP, "en"); await pg.wait_for_function("S.ed.clips.length===1&&document.querySelector('#wk')", timeout=25000); await pg.wait_for_timeout(500)
    r = await E("()=>{const i=document.querySelector('.e-assets input[data-addclip][multiple]');return{accept:i&&i.accept,empty:!!document.querySelector('.e-assets .bn217e'),hint:(document.querySelector('.e-assets .e-hint')||{}).textContent}}")
    chk(f"{tag}: Upload takes sounds too; the empty library says what it is for", r["accept"] and "audio/*" in r["accept"] and r["empty"] and "Uploads" in (r["hint"] or ""), r)
    # ---- upload three (a video, a picture, a sound) + one that isn't media
    await pg.set_input_files('.e-assets input[data-addclip][multiple]', [D + "/media/beach.webm", D + "/media/photo.png", D + "/media/voice.wav"]); await wait_bin(pg, 3); await pg.wait_for_timeout(300)
    s = await E(STATE)
    chk(f"{tag}: uploads wait in the library — the timeline is untouched", s["clips"] == 1 and len(s["bin"]) == 3 and s["tiles"] == 3, s)
    kinds = {x[1]: x for x in s["bin"]}
    chk(f"{tag}: each upload has its picture and length (the sound its length)", kinds.get("beach", [0, 0, 0, 0])[3] and abs(kinds["beach"][2] - 4) < .3 and kinds.get("photo", [0, 0, 0, 0])[3] and kinds.get("voice", [0, 0, 0, 0])[0] == "a" and abs(kinds["voice"][2] - 3) < .2, s)
    # ---- a tap on + adds the picture at the end
    await pg.click('.e-assets [data-act="bin217"][aria-label*="photo"]'); await pg.wait_for_timeout(600); s = await E(STATE)
    chk(f"{tag}: a tap puts the picture at the end of the timeline", s["clips"] == 2 and s["names"][-1].startswith("photo") and len(s["bin"]) == 3, s)
    # ---- a drag puts the video at the start (dropped on the first half of the first clip)
    ok = await mdrag(pg, '.e-assets [data-act="bin217"][aria-label*="beach"]', .4); s = await E(STATE)
    chk(f"{tag}: a drag puts the video where it is dropped (first)", ok and s["clips"] == 3 and s["names"][0].startswith("beach"), s)
    # ---- the sound dragged to 2 s sits on the sound lane at 2 s
    ok = await mdrag(pg, '.e-assets [data-act="bin217"][data-ty="a"]', 2); await pg.wait_for_timeout(400); s = await E(STATE)
    lane = await E("()=>document.querySelectorAll('#tlin .blk.sx').length")
    chk(f"{tag}: the sound dragged to 2 s is on the timeline at 2 s", ok and len(s["sfx"]) == 1 and s["sfx"][0][0] == "voice" and abs(s["sfx"][0][1] - 2) < .35 and lane >= 1, [s, lane])
    # ---- files dropped on the editor go to the library too (a text file is refused)
    r = await E("""async()=>{const f=async(u,n,t)=>new File([await (await fetch(u)).blob()],n,{type:t});const n0=S.ed.clips.length;
      routeFiles([await f('/media/a.webm','drop.webm','video/webm')]);await new Promise(r=>setTimeout(r,1500));const n1=S.ed.bin217.length;
      routeFiles([await f('/media/notes.txt','notes.txt','text/plain')]);await new Promise(r=>setTimeout(r,300));return{clips:[n0,S.ed.clips.length],bin:[n1,S.ed.bin217.length],first:S.ed.bin217[0].name}}""")
    chk(f"{tag}: a file dropped on the editor goes to the library, not the timeline", r["clips"][0] == r["clips"][1] and r["bin"][0] == 4 and r["first"] == "drop", r)
    # ---- × removes it from the library only
    await E("()=>{const t=document.querySelector('.e-assets .bn217 [data-act=\"bin217-del\"]');t.click()}"); await pg.wait_for_timeout(400); s = await E(STATE)
    chk(f"{tag}: × removes it from the library; the timeline keeps its clips", len(s["bin"]) == 3 and s["clips"] == 3 and "drop" not in [x[1] for x in s["bin"]], s)
    r = await E("async()=>{const k=Object.keys(BIN217.mem);return (await IDB.get('bn217_'+S.ed.bin217[0].id))!==null}")
    chk(f"{tag}: the library's files are kept on this device", r)
    over = await E("()=>document.documentElement.scrollWidth-innerWidth")
    await pg.screenshot(path=os.environ.get("SHOT217", D + "/desk.png"))
    # ---- after a reload the library is still there and still works
    await pg.wait_for_timeout(1500); await pg.reload(); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;document.getElementById('modalRoot').innerHTML='';go('edit');S.ed.lt143='media';S.ed.tab='media';S.ed.pclosed143=null;renderAll()}"); await pg.wait_for_timeout(800)
    s0 = await E(STATE); await E("()=>document.querySelector('.e-assets [data-act=\"bin217\"][aria-label*=\"beach\"]').click()"); await pg.wait_for_timeout(800); s1 = await E(STATE)
    chk(f"{tag}: after a reload the library is there and a tap still adds from it", len(s0["bin"]) == 3 and s0["tiles"] == 3 and s1["clips"] == s0["clips"] + 1 and s1["names"][-1].startswith("beach"), [s0, s1])
    chk(f"{tag}: nothing sideways", over <= 1, over)
    chk(f"{tag}: no page errors", not errs, errs); await b.close()

async def phone(p):
    tag = "ar 390"; b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await E(SETUP, "ar"); await pg.wait_for_function("S.ed.clips.length===1", timeout=25000); await pg.wait_for_timeout(600)
    await pg.set_input_files('input[data-addclip][multiple]', [D + "/media/beach.webm", D + "/media/voice.wav"]); await wait_bin(pg, 2); await pg.wait_for_timeout(400)
    s = await E(STATE)
    chk(f"{tag}: uploads wait in the library on a phone too", s["clips"] == 1 and len(s["bin"]) == 2 and s["tiles"] == 2, s)
    lab = await E("()=>[...document.querySelectorAll('.lbl')].map(x=>x.textContent).find(t=>t.includes('ملفاتك المرفوعة'))||''")
    chk(f"{tag}: the library is named in Arabic", "ملفاتك المرفوعة" in lab, lab)
    await E("()=>document.querySelector('[data-act=\"bin217\"][data-ty=\"v\"]').click()"); await pg.wait_for_timeout(800); s = await E(STATE)
    chk(f"{tag}: a tap adds the video", s["clips"] == 2, s)
    over = await E("()=>document.documentElement.scrollWidth-innerWidth")
    chk(f"{tag}: nothing sideways", over <= 1, over)
    chk(f"{tag}: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        for f in (desktop, phone):
            try: await f(p)
            except Exception as e: fails.append(f"{f.__name__} crashed: " + repr(e)[:500])
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:4000])
print("v217 OK" if not fails else "v217 FAIL")
sys.exit(1 if fails else 0)
