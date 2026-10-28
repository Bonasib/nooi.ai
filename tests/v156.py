# v156 "the agents are still stuck · any button goes back to the first option · the sheet can't be pulled down · the seconds
# slider can't follow a fast finger · effects don't work with their settings · I can't pick from the characters or the pictures ·
# publishing is the publisher's responsibility · the email under the policies". A real nooi server and the page on a phone:
#  · server: a job stuck "being made" (nothing to check) fails after its time with the reason; a long film is given longer
#  · page: a status check that hangs is given up (the next checks go on, the finished job shows); a below-zero "thinking" count
#    doesn't keep Quill working; a job followed for far too long stops being "being made"
#  · a tap keeps your place: the nooi Studio engine list and the editor's tool row stay where they were scrolled
#  · sheets pull down to close (not a small pull, not while their list is scrolled); the editor's panel by its top bar
#  · the length slider: no scrolling on it (touch-action none), the sheet keeps its height while it moves, a fast drag moves it
#  · the selected effect's settings come first; "Starts here" / "Ends here" set it at the playhead
#  · the box: Characters first in the row and inside it; Picture opens a sheet (phone, your characters, your pictures) and a
#    picked picture becomes a # picture; the @ list stays open when the page scrolls, a swipe in it is no pick, a tap is
#  · the email under the policies with the Publishing policy; the policy opens; sharing to Explore needs the publisher's yes
# Run: python3 tests/v156.py
import asyncio, base64, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8467; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v156-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
now = int(time.time() * 1000)
J = lambda i, **k: {"id": i, "owner": "local", "kind": "video", "status": "rendering", "created": now - 10 * 60e3, "prov": "kie", "cap": "video", "progress": .2, "payload": {"kind": "video", "prompt": "x", "model": "kling30", "dur": 5, "meta": {}}, **k}
jobs = {"SW1": J("SW1"), "SW2": J("SW2", payload={"kind": "video", "prompt": "x", "model": "kling30", "dur": 60, "meta": {"long132": 1}}),
        "R1": J("R1", status="done", url="/media/a.mp4", progress=1, created=now - 60e3),
        "SW3": J("SW3", created=now - 5 * 3600e3, live158=now)}   # (v158: made active again just now — a film's missing part made again)
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": jobs}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x406080:size=1280x720:rate=30:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "800k", D + "/media/a.webm"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xd02020:s=320x180:r=10:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/media/a.mp4"], check=True)
for n, c in (("p.png", "0x30a050"), ("face.png", "0xc08060")):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c={c}:s=256x256", "-frames:v", "1", D + "/media/" + n], check=True)
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None):
    req = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
def wait(fn, sec=30):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None

def server_checks():
    a = wait(lambda: (lambda j: j if j.get("status") == "failed" else None)(api("/v1/jobs/SW1")), 20) or api("/v1/jobs/SW1")
    ok(a.get("status") == "failed" and "took far too long" in str(a.get("error")) and "أطول" in str(a.get("errorAr")), f"a job stuck past its time fails with the reason {a}")
    b = api("/v1/jobs/SW2"); ok(b.get("status") == "rendering", f"a long film is given longer {b.get('status')}")
    c = api("/v1/jobs/SW3"); ok(c.get("status") == "rendering", f"a job made active again is timed from then, not from when it was first made {c.get('status')}")
    r = api("/v1/explore", {"url": "/media/p.png", "kind": "image", "prompt": "a green square"})
    ok(r.get("_status") == 400 and "responsib" in str(r.get("error")) and "مسؤوليتك" in str(r.get("errorAr")), f"sharing to Explore without the publisher's yes is refused {r}")

async def touch(cdp, pts, ms=16):
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": pts[0][0], "y": pts[0][1]}]})
    for x, y in pts[1:]:
        await asyncio.sleep(ms / 1000); await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y}]})
    await asyncio.sleep(ms / 1000); await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
line = lambda x0, y0, x1, y1, n=10: [(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n) for i in range(n + 1)]
SETUP = """()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;
  S.chars=[{id:'c1',name:'Rami',photo:'/media/face.png',facePic:'/media/face.png'}];S.jobs.push({id:'IM1',kind:'image',status:'complete',resultUrl:'/media/p.png',created:Date.now(),title:'green',prompt:'green',art:'scene'});
  S.hf.tab='video';go('home');renderAll()}"""
EDIT = """async()=>{S.cloud149=false;PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.format='tiktok';S.ed.vfx=[];const v=await (await fetch('/media/a.webm')).blob();
  edAddFiles([new File([v],'a.webm',{type:'video/webm'})]);S.ed.tab='media';edSetPick(null);go('edit');renderAll()}"""

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 412, "height": 915}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); cdp = await ctx.new_cdp_session(pg)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        async def E(js, arg=None):
            if os.environ.get('V156_DEBUG'): print('  eval', js[:70].replace(chr(10),' '), flush=True)
            return await asyncio.wait_for(pg.evaluate(js, arg), 60)
        await pg.route("**/v1/jobs/HANG1", lambda route: None)   # (never answers)
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000); await E(SETUP); await pg.wait_for_timeout(600)

        print('step 1.', flush=True)
        # 1. the agents: a hung check is given up, the next checks go on
        await E("()=>{T156.get=900;S.jobs.push({id:'H1',remote:'HANG1',kind:'video',status:'rendering',progress:.1,created:Date.now(),title:'h',prompt:'h',dur:5,aspect:'16:9',art:'scene',meta:{}})}")
        await pg.wait_for_timeout(3500)
        await E("()=>{S.jobs.push({id:'R1p',remote:'R1',kind:'video',status:'rendering',progress:.1,created:Date.now(),title:'r',prompt:'r',dur:5,aspect:'16:9',art:'scene',meta:{}})}")
        done = None
        for _ in range(40):
            done = await E("()=>{const j=S.jobs.find(x=>x.id==='R1p');return j&&j.status}")
            if done == "complete": break
            await asyncio.sleep(.25)
        ok(done == "complete", f"a hung status check doesn't stop the others — the finished job shows {done}")
        t = await E("async()=>{T156.get=300;const t0=Date.now();try{await API.req('/v1/jobs/HANG1');return 'answered'}catch(e){return [!!e.timeout156,Date.now()-t0]}}")
        ok(isinstance(t, list) and t[0] and t[1] < 3000, f"a hung request is given up {t}")
        bb = await E("()=>{AI_BUSY=-1;const s=busyBots();return [AI_BUSY,!!s.writer]}")
        ok(bb == [0, False], f"a below-zero thinking count doesn't keep Quill working {bb}")
        st = await E("""()=>{const n=Date.now(),mk=(id,o)=>Object.assign({id,kind:'video',status:'rendering',progress:.1,title:id,prompt:id,dur:5,aspect:'16:9',art:'scene',meta:{}},o);
          S.jobs.push(mk('O1',{remote:'zz1',created:n-7*3600e3}),mk('O2',{created:n-31*60e3}),mk('O3',{created:n-31*60e3}),mk('O4',{remote:'zz4',created:n-2*3600e3}));SEND155.add('O3');
          stale156();SEND155.delete('O3');const g=id=>{const j=S.jobs.find(x=>x.id===id);return j.status+'/'+(j.errorType||'')};return [g('O1'),g('O2'),g('O3'),g('O4')]}""")
        ok(st == ["failed/stale", "failed/stale", "rendering/", "rendering/"], f"jobs followed far too long stop being made; one being sent and a 2-hour one go on {st}")
        await E("()=>{S.jobs=S.jobs.filter(x=>!['H1','R1p','O1','O2','O3','O4'].includes(x.id));persist();T156.get=25000}")

        print('step 2.', flush=True)
        # 2. a tap keeps your place: the nooi Studio engine list
        await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(900)
        r = await E("""async()=>{const b=document.querySelector('[data-o93="model"]');if(!b)return {none:'chip'};b.click();await new Promise(x=>setTimeout(x,500));const sec=document.getElementById('sec93-model');if(!sec||sec.hidden)return {none:'sec'};
          const sc=[sec,...sec.querySelectorAll('*')].find(x=>x.scrollHeight>x.clientHeight+30&&/auto|scroll/.test(getComputedStyle(x).overflowY));if(!sc)return {none:'scroll'};sc.scrollTop=sc.scrollHeight;await new Promise(x=>setTimeout(x,200));
          const top0=sc.scrollTop,sr=sc.getBoundingClientRect(),t=[...sec.querySelectorAll('button')].filter(x=>{const q=x.getBoundingClientRect();return q.top>sr.top+sr.height*.45&&q.bottom<sr.bottom&&q.width>20&&!/add|upload|close|new|remove/i.test(x.textContent+(x.dataset.act||''))}).pop();
          if(!t)return {none:'button'};t.click();await new Promise(x=>setTimeout(x,600));const s2=document.getElementById('sec93-model');const c2=s2&&[s2,...s2.querySelectorAll('*')].find(x=>x.scrollHeight>x.clientHeight+30&&/auto|scroll/.test(getComputedStyle(x).overflowY));
          return {top0,after:c2?c2.scrollTop:null}}""")
        out["engines"] = r; ok(r.get("top0", 0) > 50 and (r.get("after") or 0) >= r["top0"] * .8, f"the engine list stays where it was scrolled after a pick {r}")

        print('step 3.', flush=True)
        # 3. the editor: the tool row keeps its place, the panel pulls down, the effect's settings first
        await E(EDIT); await pg.wait_for_function("S.ed.clips.length===1&&document.querySelector('.ed143 #wk')", timeout=20000); await pg.wait_for_timeout(700)
        r = await E("""async()=>{const bar=document.querySelector('.ed143.mob .e-bar');if(!bar)return {none:1};bar.scrollLeft=bar.scrollWidth;await new Promise(x=>setTimeout(x,150));const x0=bar.scrollLeft;
          const bs=[...bar.querySelectorAll('[data-act="lt143"]')],last=bs[bs.length-1];last.click();await new Promise(x=>setTimeout(x,500));const b2=document.querySelector('.ed143.mob .e-bar'),on=b2.querySelector('[data-v="'+last.dataset.v+'"]');
          const a=on.getBoundingClientRect(),c=b2.getBoundingClientRect();return {x0,after:b2.scrollLeft,seen:a.left>=c.left-1&&a.right<=c.right+1,pressed:on.getAttribute('aria-pressed')}}""")
        out["ebar"] = r; ok(r.get("x0", 0) > 20 and abs(r.get("after", 0)) > 20 and r.get("seen") and r.get("pressed") == "true", f"the editor's tool row keeps its place and shows the tapped tool {r}")
        ph = await E("()=>{const h=document.querySelector('.ed143 .e-sheet .e-ph');if(!h)return null;const r=h.getBoundingClientRect();return [r.left+r.width*.3,r.top+r.height/2]}")
        if ph:
            await touch(cdp, line(ph[0], ph[1], ph[0], ph[1] + 260, 12)); await pg.wait_for_timeout(600)
            g = await E("()=>[!!document.querySelector('.ed143 .e-sheet'),S.ed.pclosed143]")
            ok(not g[0] and g[1], f"the editor's panel pulls down to close {g}")
        else: ok(False, "the editor's panel has a top bar")
        await E("()=>{S.ed.vfx=[{id:'v1',kind:'snow',start:0,end:6,amt:60}];edSetPick('vfx','v1');S.ed.tab='vfx';S.ed.pclosed143=null;ED.t=2;ED.playing=false;renderView()}"); await pg.wait_for_timeout(500)
        r = await E("""()=>{const s=document.querySelector('.ed143 .edsel.sel156'),g=document.querySelector('.ed143 .vfxgrid');if(!s||!g)return {none:[!!s,!!g]};
          return {first:s.parentElement.firstElementChild===s,above:s.getBoundingClientRect().top<g.getBoundingClientRect().top,label:s.textContent.includes('Selected effect'),btn:!!s.querySelector('[data-act="edv156"]')}}""")
        ok(r.get("first") and r.get("above") and r.get("label") and r.get("btn"), f"the selected effect's settings come first {r}")
        await E("()=>document.querySelector('[data-act=\"edv156\"][data-v=\"start\"]').click()"); await pg.wait_for_timeout(300)
        await E("()=>{ED.t=4.5;document.querySelector('[data-act=\"edv156\"][data-v=\"end\"]').click()}"); await pg.wait_for_timeout(300)
        v = await E("()=>[S.ed.vfx[0].start,S.ed.vfx[0].end]"); ok(v == [2, 4.5], f"Starts here / Ends here set the effect at the playhead {v}")
        a0 = await E("()=>{const r=document.querySelector('[data-vfxamt]');r.value=90;r.dispatchEvent(new Event('input',{bubbles:true}));return S.ed.vfx[0].amt}"); ok(a0 == 90, f"its strength still works {a0}")

        print('step 4.', flush=True)
        # 4. sheets pull down; the length slider
        await E("()=>{S.ed.vfx=[];go('home');renderAll()}"); await pg.wait_for_timeout(600)
        await E("()=>hfDurSheet()"); await pg.wait_for_timeout(500)
        ta = await E("()=>getComputedStyle(document.getElementById('hfdr')).touchAction"); ok(ta == "none", f"the length slider takes the whole touch {ta}")
        hr = await E("()=>{const r=document.getElementById('hfdr').getBoundingClientRect();return [r.left,r.top,r.width,r.height,S.hf.dur]}")
        y = hr[1] + hr[3] / 2; await touch(cdp, [(hr[0] + 12, y), (hr[0] + hr[2] * .3, y + 6), (hr[0] + hr[2] * .55, y + 14), (hr[0] + hr[2] * .8, y + 20)], 8); await pg.wait_for_timeout(300)
        r = await E("()=>{const s=document.querySelector('#modalRoot .sheet'),r=document.getElementById('hfdr').getBoundingClientRect();return [S.hf.dur,!!(s&&s.style.height),r.top]}")
        out["slider"] = [hr, r]; ok(r[0] > hr[4] and r[1] and abs(r[2] - hr[1]) < 3, f"a fast drag moves the slider; the sheet keeps its height; the slider stays put {hr} {r}")
        hd = await E("()=>{const h=document.querySelector('#modalRoot .sheet h2').getBoundingClientRect();return [h.left+20,h.top+h.height/2]}")
        await touch(cdp, line(hd[0], hd[1], hd[0], hd[1] + 30, 4)); await pg.wait_for_timeout(400)
        g = await E("()=>{const s=document.querySelector('#modalRoot .sheet');return s?[1,s.style.transform]:[0]}"); ok(g[0] == 1 and not g[1], f"a small pull doesn't close the sheet {g}")
        await touch(cdp, line(hd[0], hd[1], hd[0], hd[1] + 240, 12)); await pg.wait_for_timeout(500)
        ok(not await E("()=>$('#modalRoot').innerHTML.trim()"), "a sheet pulled down closes")
        await E("()=>hfSheet('Long','<div style=\"height:2400px\">tall</div>')"); await pg.wait_for_timeout(400)
        await E("()=>{document.querySelector('#modalRoot .sheet').scrollTop=300}")
        await touch(cdp, line(200, 600, 200, 840, 10)); await pg.wait_for_timeout(500)
        ok(await E("()=>!!document.querySelector('#modalRoot .sheet')"), "a pull down on a scrolled sheet scrolls it, doesn't close it"); await E("()=>closeSheet()")

        print('step 5.', flush=True)
        # 5. the box: Characters first and seen, Picture from your pictures, the @ list
        await E("()=>{S.hf.tab='video';go('home');renderAll()}"); await pg.wait_for_timeout(500)
        r = await E("""()=>{const row=document.querySelector('.hft136');if(!row)return {none:1};const c=row.querySelector('.ch87b');if(!c)return {nochip:1};const a=c.getBoundingClientRect(),b=row.getBoundingClientRect();
          const kids=[...row.children].filter(x=>getComputedStyle(x).display!=='none').sort((x,y)=>x.getBoundingClientRect().left-y.getBoundingClientRect().left);
          return {first:kids[0]===c,inside:a.left>=b.left-1&&a.right<=b.right+1,face:!!c.querySelector('img'),pic:!!row.querySelector('[data-act="pic156"]')}}""")
        ok(r.get("first") and r.get("inside") and r.get("face") and r.get("pic"), f"Characters is first in the row and fully seen; Picture is a button {r}")
        await E("()=>document.querySelector('[data-act=\"pic156\"]').click()"); await pg.wait_for_timeout(400)
        r = await E("()=>({up:!!document.querySelector('#modalRoot .pkup156 input[data-ref130][data-hf136]'),tiles:[...document.querySelectorAll('#modalRoot .pk156')].map(x=>x.dataset.job||('c:'+x.dataset.char))})")
        ok(r["up"] and "IM1" in r["tiles"] and "c:c1" in r["tiles"], f"Picture: from the phone, your characters, your pictures {r}")
        await E("()=>document.querySelector('#modalRoot .pk156[data-job=\"IM1\"]').click()")
        n = None
        for _ in range(20):
            await asyncio.sleep(.25); n = await E("()=>[refs130().length,!!$('#modalRoot').innerHTML.trim(),document.querySelectorAll('.hft136 .t136.pic').length]")
            if n[0] >= 1 and not n[1]: break
        ok(n and n[0] == 1 and not n[1] and n[2] == 1, f"a picked picture becomes a # picture in the box {n}")
        await E("()=>{const q=$('#hfq');q.focus();q.value='@';q.setSelectionRange(1,1);q.dispatchEvent(new Event('input',{bubbles:true}))}"); await pg.wait_for_timeout(200)
        ok(await E("()=>!!AT87.el"), "@ opens the characters list")
        await E("()=>{const m=document.getElementById('main');m.scrollTop+=40;window.scrollBy(0,40)}"); await pg.wait_for_timeout(250)
        r = await E("()=>{const el=AT87.el;if(!el)return null;const r=el.getBoundingClientRect();return [r.top,r.bottom,innerHeight]}")
        ok(r and r[0] >= 0 and r[1] <= r[2], f"the @ list stays open and on screen when the page scrolls {r}")
        bt = await E("()=>{const b=AT87.el&&AT87.el.querySelector('button');if(!b)return null;const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
        if bt:
            await touch(cdp, line(bt[0], bt[1], bt[0], bt[1] + 30, 4)); await pg.wait_for_timeout(250)
            ok(await E("()=>$('#hfq').value") == "@", "a swipe in the @ list is no pick")
            if not await E("()=>!!AT87.el"): await E("()=>{const q=$('#hfq');q.focus();q.setSelectionRange(1,1);q.dispatchEvent(new Event('input',{bubbles:true}))}"); await pg.wait_for_timeout(200)
            bt = await E("()=>{const b=AT87.el&&AT87.el.querySelector('button');if(!b)return null;const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
            await touch(cdp, [(bt[0], bt[1])]); await pg.wait_for_timeout(300)
            v = await E("()=>$('#hfq').value"); ok("@Rami" in v, f"a tap in the @ list puts the character in {v!r}")
        else: ok(False, "the @ list has the character")

        print('step 6.', flush=True)
        # 6. the email under the policies; the publishing policy; sharing needs the publisher's yes
        await E("()=>{const q=$('#hfq');if(q)q.value='';S.hf.prompt='';go('home');renderAll()}"); await pg.wait_for_timeout(500)
        r = await E("""()=>{const f=document.querySelector('.foot120');if(!f)return {none:1};const bot=f.querySelector('.f120bot'),a=[...bot.querySelectorAll('a')];const i=x=>a.findIndex(y=>x(y));
          return {brandMail:!!f.querySelector('.f120brand a[href^="mailto:"]'),priv:i(y=>y.dataset.doc==='privacy'),pub:i(y=>y.dataset.doc==='publish'),mail:i(y=>/^mailto:/.test(y.getAttribute('href')||''))}}""")
        ok(not r.get("brandMail") and 0 <= r.get("priv", -1) < r.get("pub", -1) < r.get("mail", -1), f"the email sits under the policies, after the Publishing policy {r}")
        await E("()=>document.querySelector('.f120bot [data-doc=\"publish\"]').click()"); await pg.wait_for_timeout(500)
        t = await E("()=>document.body.innerText"); ok("Publishing & Content Policy" in t and "your own responsibility" in t, "the Publishing policy opens")
        await E("()=>{S.lang='ar';renderAll()}"); await pg.wait_for_timeout(300); t = await E("()=>document.body.innerText"); ok("سياسة النشر والمحتوى" in t and "مسؤوليتك" in t, "… and in Arabic")
        await E("()=>{S.lang='en';$('#modalRoot').innerHTML='';go('library');renderAll()}"); await pg.wait_for_timeout(400)
        await E("()=>xpShareSheet(S.jobs.find(x=>x.id==='IM1'))"); await pg.wait_for_timeout(300)
        ok(await E("()=>!!document.getElementById('xpagree156')"), "the share sheet asks the publisher to confirm")
        await E("()=>document.querySelector('[data-act=\"xps-go\"]').click()"); await pg.wait_for_timeout(600)
        ok(not (api("/v1/explore").get("items") or []), "not shared without the publisher's yes")
        await E("()=>{document.getElementById('xpagree156').checked=true;document.querySelector('[data-act=\"xps-go\"]').click()}")
        it = wait(lambda: api("/v1/explore").get("items"), 10) or []
        ok(len(it) == 1 and it[0].get("url") == "/media/p.png", f"shared once the publisher confirms {it}")
        # (the server writes its data file a moment after a change — read it once it is there)
        ag = wait(lambda: [x.get("agreed156") for x in (json.load(open(D + "/data/db.json")).get("explore") or [])], 10) or []
        ok(ag and ag[0], f"the server keeps when the publisher agreed {ag}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false",
    SWEEP_MS="1000", STUCK_MS="120000", RECOVER_MS="600000"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(B + "/v1/config", timeout=2), 30)
    server_checks(); print('server ok', flush=True); asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1, default=str)[:6000])
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
