# v216 — the editor in the owner's arrangement (the ten boards), pro edit tools, track headers, ⌘K commands, faster.
#  · computer / iPad landscape: the editor is its own workspace — the site bar and hub tabs step aside; the top bar has the logo,
#    the project name, Autosaved, undo · redo, the zoom %, ⌘K search, the nine agents, the format and Export
#  · the rail is the boards' seven: Media · Audio · Text · Captions · Effects · Color · AI (stickers in Text, transitions in Effects)
#  · track headers V1 · TXT · A1 Music line up with their lanes; lock stops picking, M / S drive the mixer's buses, hide keeps
#    the text out of the picture
#  · edit tools: Roll moves a cut, Slip moves the content, Slide moves a clip between its neighbours, Rate stretch changes the
#    speed, Ripple trims (and with All tracks the titles after it move too); V B N Y U R pick them; ⌘K runs commands and opens panels
#  · faster: an editor redraw no longer redraws the hidden site bar
#  · a phone keeps its own editor (no workspace bar, no headers)
# Run: python3 tests/v216.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8689; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v216-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", "-c:a", "libopus", "-shortest", D + "/media/a.webm")
FF("-f", "lavfi", "-i", "color=c=0x22aa55:s=640x360:d=4:r=30", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "200k", D + "/media/b.webm")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Beach',title:'Beach',created:now,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'},{id:'vb',kind:'video',status:'complete',prompt:'Green',title:'Green',created:now-9,progress:1,pal:PALS[1],seed:9,dur:4,aspect:'16:9',resultUrl:'/media/b.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});go('edit');renderAll()}"""
TAB = "(t)=>{const E=S.ed;E.tab=t;const T=TABS143.find(x=>x[4].includes(t));if(T)E.lt143=T[0];E.pclosed143=null;renderView()}"


async def run(p, lang, w, h, mob):
    tag = f"{lang} {w}"; b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await E(SETUP, lang); await pg.wait_for_function("S.ed.clips.length===1&&document.querySelector('#wk')&&M['c_'+S.ed.clips[0].id]&&srcReady(M['c_'+S.ed.clips[0].id])", timeout=25000)
    await E("async()=>{await edUseJob(S.jobs.find(j=>j.id==='vb'),{stay:true,quiet:true});S.ed.texts=[{id:'t1',text:'A Wilder Tomorrow',start:7,end:9,pos:'bottom',style:'caption',size:7,anim:'pop'}];persist();renderView()}")
    await pg.wait_for_function("S.ed.clips.length===2&&M['c_'+S.ed.clips[1].id]&&srcReady(M['c_'+S.ed.clips[1].id])", timeout=25000); await pg.wait_for_timeout(500)
    if w < 700:
        r = await E("()=>({ws:document.body.classList.contains('ws216'),heads:document.querySelectorAll('.tlh216').length,top:!!document.querySelector('.ws216g')})")
        chk(f"{tag}: a phone keeps its own editor (no workspace bar, no track headers)", not r["ws"] and r["heads"] == 0 and not r["top"], r)
        chk(f"{tag}: no page errors", not errs, errs); await b.close(); return
    r = await E("""()=>{const v=s=>{const e=document.querySelector(s);return!!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0};
      return{ws:document.body.classList.contains('ws216'),site:v('#main>.topm'),hub:v('.ed143 .hubtabs'),logo:v('.ws216logo .nbrand'),name:v('.e-name'),saved:v('.ws216sv'),undo:v('.ws216g [data-act=ed-undo]'),zoom:(document.querySelector('.ws216z b')||{}).textContent,
        k:v('.ws216k'),crew:document.querySelectorAll('.ws216crew i').length,exp:v('.e-top .edout'),fmt:v('.e-top .fmtbtn'),
        rail:[...document.querySelectorAll('.e-rail [data-act=lt143]')].map(b=>b.textContent.trim()),over:document.documentElement.scrollWidth-innerWidth}}""")
    chk(f"{tag}: the editor is its own workspace (site bar and hub tabs aside)", r["ws"] and not r["site"] and not r["hub"], r)
    chk(f"{tag}: the top bar: logo, name, Autosaved, undo, zoom %, ⌘K, nine agents, format, Export", r["logo"] and r["name"] and r["undo"] and r["zoom"] == "100%" and r["k"] and r["crew"] == 9 and r["exp"] and r["fmt"] and r["over"] <= 1, r)
    chk(f"{tag}: the rail is the boards' seven", r["rail"] == ["Media", "Audio", "Text", "Captions", "Effects", "Color", "AI"], r)
    r = await E("()=>{const T=k=>TABS143.find(t=>t[0]===k)[4];return{text:T('text'),fx:T('effects')}}")
    chk(f"{tag}: stickers and logo live in Text, transitions in Effects", "info" in r["text"] and "logo" in r["text"] and "trans143" in r["fx"], r)
    # ---- track headers
    r = await E("""()=>[...document.querySelectorAll('.h216')].map(h=>{const k=h.dataset.k,lane=[...document.querySelectorAll('.tlin>.trk')].find(t=>laneOf216(t)===k),a=h.getBoundingClientRect(),b=lane.getBoundingClientRect();return[h.querySelector('.h216n').textContent,Math.round(a.top+a.height/2-(b.top+b.height/2))]})""")
    chk(f"{tag}: headers V1 · TXT · A1 Music line up with their lanes", [x[0] for x in r][:3] == ["V1", "TXT", "A1 Music"] and all(abs(x[1]) <= 3 for x in r), r)
    await pg.click('.h216[data-k="v"] [data-act="h216-mute"]'); await pg.wait_for_timeout(150)
    await pg.click('.h216[data-k="a"] [data-act="h216-solo"]'); await pg.wait_for_timeout(150)
    r = await E("()=>({mute:mixOf150().mute,solo:S.ed.solo216,bus:bus150('clips')})")
    chk(f"{tag}: M mutes the clip sound, S on Music solos it (the mixer's own buses)", r["mute"].get("clips") and r["mute"].get("voice") and r["mute"].get("sfx") and not r["mute"].get("music") and r["solo"] == "music" and r["bus"] == 0, r)
    await pg.click('.h216[data-k="a"] [data-act="h216-solo"]'); await pg.wait_for_timeout(150)
    r = await E("()=>({mute:mixOf150().mute,solo:S.ed.solo216})")
    chk(f"{tag}: S again gives the mix back as it was (clips still muted)", r["mute"].get("clips") and not r["mute"].get("voice") and not r["solo"], r)
    await pg.click('.h216[data-k="v"] [data-act="h216-mute"]'); await pg.wait_for_timeout(100)
    await pg.click('.h216[data-k="t"] [data-act="h216-hide"]'); await pg.wait_for_timeout(150)
    r = await E("()=>{let n=0;const px=new Proxy({},{get:()=>{n++;return()=>{}}});drawTextLayer(px,S.ed.texts[0],1920,1080,8);return{hide:S.ed.hide216.t,touched:n}}")
    chk(f"{tag}: hide keeps the text out of the picture", r["hide"] and r["touched"] == 0, r)
    await pg.click('.h216[data-k="t"] [data-act="h216-hide"]'); await pg.wait_for_timeout(100)
    await pg.click('.h216[data-k="v"] [data-act="h216-lock"]'); await pg.wait_for_timeout(150)
    await E("()=>{S.ed.sel=null;edSetPick(null);renderView()}"); await pg.wait_for_timeout(100)
    await pg.click('.tlin .blk.v[data-clip]'); await pg.wait_for_timeout(200)
    r = await E("()=>({sel:S.ed.sel,lock:S.ed.lock216.v})")
    chk(f"{tag}: a locked track can't be picked", r["lock"] and not r["sel"], r)
    await pg.click('.h216[data-k="v"] [data-act="h216-lock"]'); await pg.wait_for_timeout(100)
    # ---- edit tools (trim first so the cut has handles on both sides)
    await E("()=>{const[a,c]=S.ed.clips;a.out=5;c.in=1;S.ed.zoom=40;persist();renderView()}"); await pg.wait_for_timeout(200)
    async def drag(sel, frm, dx):
        bx = await pg.locator(sel).first.bounding_box(); x = bx["x"] + (6 if frm == "L" else bx["width"] - 6 if frm == "R" else bx["width"] / 2); y = bx["y"] + bx["height"] / 2
        await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x + dx / 2, y, steps=3); await pg.mouse.move(x + dx, y, steps=3); await pg.mouse.up(); await pg.wait_for_timeout(250)
    st = lambda: E("()=>S.ed.clips.map(c=>[+c.in.toFixed(2),+c.out.toFixed(2),+(c.speed||1).toFixed(3)])")
    await pg.keyboard.press("n"); await pg.wait_for_timeout(150)
    chk(f"{tag}: N picks Roll", await E("S.ed.tool216") == "roll")
    v1 = '.tlin .blk.v[data-clip]'
    await drag(f'{v1}:nth-of-type(2)', "L", 20)
    r = await st(); chk(f"{tag}: Roll moves the cut: the first clip ends later, the second starts later, same length", r[0][1] == 5.5 and r[1][0] == 1.5 and abs((r[0][1] - r[0][0]) + (r[1][1] - r[1][0]) - 8) < 0.02, r)
    await pg.keyboard.press("y"); await pg.wait_for_timeout(150)
    await drag(f'{v1}:nth-of-type(2)', "B", 20)
    r = await st(); chk(f"{tag}: Slip moves the content, not the clip (in and out move together, same length)", r[1][0] == 1.0 and r[1][1] == 3.5, r)
    await E("()=>{const c=S.ed.clips[0],d=Object.assign({},c,{id:'cx',in:1,out:4});S.ed.clips.push(d);M['c_cx']=M['c_'+c.id];persist();renderView()}"); await pg.wait_for_timeout(300)
    await pg.keyboard.press("u"); await pg.wait_for_timeout(150)
    b0 = await st(); await drag(f'{v1}:nth-of-type(2)', "B", -20)
    r = await st(); chk(f"{tag}: Slide moves the middle clip: the one before ends earlier, the one after starts earlier", r[0][1] == b0[0][1] - 0.5 and r[2][0] == b0[2][0] - 0.5 and r[1][:2] == b0[1][:2], [b0, r])
    await pg.keyboard.press("r"); await pg.wait_for_timeout(150)
    d0 = await E("clipDur(S.ed.clips[1])"); await drag(f'{v1}:nth-of-type(2)', "R", 40)
    r = await E("({sp:S.ed.clips[1].speed,d:clipDur(S.ed.clips[1]),inout:[S.ed.clips[1].in,S.ed.clips[1].out]})")
    chk(f"{tag}: Rate stretch makes the clip 1 s longer by slowing it (same content)", abs(r["d"] - (d0 + 1)) < 0.05 and r["sp"] < 1, [d0, r])
    await E("()=>{S.ed.rippleAll216=true;S.ed.texts[0].start=12;S.ed.texts[0].end=13;persist();renderView()}"); await pg.keyboard.press("b"); await pg.wait_for_timeout(150)
    t0 = await E("S.ed.texts[0].start"); await drag(f'{v1}:nth-of-type(1)', "R", -20)
    r = await E("({out:S.ed.clips[0].out,t:S.ed.texts[0].start})")
    chk(f"{tag}: Ripple trims the clip and, with All tracks, the title after it moves with it", abs(r["out"] - (b0[0][1] - 1.0)) < 0.02 and abs(r["t"] - (t0 - 0.5)) < 0.02, [b0[0], t0, r])
    await pg.keyboard.press("v"); await pg.wait_for_timeout(100)
    # ---- ⌘K
    await pg.keyboard.press("Control+k"); await pg.wait_for_timeout(250); await pg.fill("#palq", "slip"); await pg.wait_for_timeout(150); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(250)
    r1 = await E("S.ed.tool216")
    await pg.keyboard.press("Control+k"); await pg.wait_for_timeout(250); await pg.fill("#palq", "Captions"); await pg.wait_for_timeout(150)
    first = await E("(document.querySelector('#pallist .palrow .ps')||{}).textContent||''")
    await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
    r = await E("({tab:S.ed.tab,lt:S.ed.lt143})")
    chk(f"{tag}: ⌘K finds editor tools and panels and runs them", r1 == "slip" and r["tab"] == "words" and r["lt"] == "captions" and "Panel" in first, [r1, first, r])
    await E("()=>{S.ed.tool216='select';persist();renderView()}")
    # ---- faster
    r = await E("()=>{const t=[];for(let i=0;i<9;i++){const a=performance.now();renderView();t.push(performance.now()-a)}t.sort((a,b)=>a-b);let n=0;const o=document.getElementById('bottomnav');return{med:+t[4].toFixed(1)}}")
    out[tag + " redraw ms"] = r["med"]
    chk(f"{tag}: an editor redraw skips the hidden site bar (median under 50 ms here, it was ~59)", r["med"] < 50, r)
    chk(f"{tag}: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        await run(p, "en", 1440, 900, False)
        await run(p, "en", 1180, 820, True)
        await run(p, "ar", 390, 844, True)
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:5000])
print("v216 OK" if not fails else "v216 FAIL")
sys.exit(1 if fails else 0)
