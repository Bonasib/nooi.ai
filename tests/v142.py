# v142: the new video editor page — one page in one piece. Eight tool groups on a rail (left on a computer, a fixed bar at the bottom
# of a phone), the preview with its player and the AI prompt bar, the timeline under the preview, the chosen tool's settings beside
# it. Checks: the groups and their order, every group shows its settings and the prompt bar, Media lists the clips, a tap on a
# timeline item opens its settings, drawing the page again never moves it (a right-click menu stays open), the phone order
# (preview, player, prompt, timeline, settings) with the preview pinned, a slim title row, no sideways scroll and nothing covered,
# in English and Arabic. Run: python3 tests/v142.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8394
D = tempfile.mkdtemp(prefix="nooi-v142-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", M + "a.webm")
FF("-f", "lavfi", "-i", "sine=frequency=220:duration=8", "-c:a", "libmp3lame", M + "m.mp3")
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Beach',title:'Beach at sunset',created:now,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];
 await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true,t:1});await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true,t:1});
 S.ed.texts=[{id:'t1',text:l==='ar'?'مرحبا':'HELLO',start:0,end:3,pos:'center',style:'clean',anim:'none',size:6}];S.ed.sfx=[{id:'s1',n:'pop',t:1,vol:100}];
 const b=await (await fetch('/media/m.mp3')).blob();loadSlot('edMusic',new File([b],'m.mp3',{type:'audio/mpeg'}));S.ed.tab='clip';S.ed.sel=S.ed.clips[0].id;go('edit');renderAll()}"""
GROUPS = ["media", "ai", "edit", "text", "audio", "color", "fx", "export"]
# controls covered by something else (a fixed bar, the pinned preview, another control); a control scrolled out of its own scrolling
# box is not covered, it is one scroll away
SCAN = r"""()=>{const vis=e=>{const r=e.getBoundingClientRect();if(r.width<4||r.height<4)return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.05};
 const fixed=[...document.querySelectorAll('*')].filter(e=>{const p=getComputedStyle(e).position;return(p==='fixed'||p==='sticky')&&vis(e)}).map(e=>e.getBoundingClientRect());
 let top=0,bot=innerHeight;for(const r of fixed){if(r.top<=innerHeight*0.5&&r.bottom>top&&r.bottom<innerHeight*0.7&&r.width>innerWidth*0.5)top=Math.max(top,r.bottom);if(r.bottom>=innerHeight*0.6&&r.top>innerHeight*0.4&&r.width>innerWidth*0.5)bot=Math.min(bot,r.top)}
 const box=e=>{let p=e.parentElement;while(p&&p!==document.body){const s=getComputedStyle(p);if(/(auto|scroll|hidden)/.test(s.overflowY+s.overflowX)&&(p.scrollHeight>p.clientHeight+2||p.scrollWidth>p.clientWidth+2))return p.getBoundingClientRect();p=p.parentElement}return null};
 const name=e=>(e.getAttribute('aria-label')||e.textContent||e.value||e.dataset.act||e.tagName).trim().replace(/\s+/g,' ').slice(0,30)+' ['+(e.dataset.act||e.dataset.set||e.className||'').toString().slice(0,24)+']';
 const bad=[];for(const e of document.querySelectorAll('#main button,#main input:not([type=hidden]),#main select,#main textarea,#main label.btn')){if(!vis(e))continue;const r=e.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
   if(cy<top+2||cy>bot-2||cx<0||cx>innerWidth)continue;const b=box(e);if(b&&(cy<b.top+2||cy>b.bottom-2||cx<b.left+2||cx>b.right-2))continue;
   const t=document.elementFromPoint(cx,cy);if(t&&!e.contains(t)&&!t.contains(e)&&!(t.closest('label')&&t.closest('label').contains(e))&&!(e.closest('label')&&e.closest('label').contains(t)))bad.push(name(e)+' under '+((t.closest('[class]')||t).className.toString().slice(0,30)||t.tagName))}
 return {bad,over:document.documentElement.scrollWidth-innerWidth}}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))

async def open_page(b, w, h, lang, mob):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await pg.evaluate(SETUP, lang); await pg.wait_for_function("S.ed.clips.length===2&&document.querySelector('.ne142 #wk')", timeout=20000); await pg.wait_for_timeout(600)
    return ctx, pg, errs

async def scan_all(pg, tag):
    # every group, top to bottom of the page
    found = {}
    for g in GROUPS:
        await pg.evaluate("(g)=>{const b=document.querySelector('.ne-rail [data-v=\"'+g+'\"]');b&&b.click();ED.playing=false;document.getElementById('main').scrollTop=0}", g); await pg.wait_for_timeout(250)
        H = await pg.evaluate("()=>document.getElementById('main').scrollHeight"); bad, over = [], 0
        for y in range(0, H, 450):
            await pg.evaluate("(y)=>{document.getElementById('main').scrollTop=y}", y); await pg.wait_for_timeout(70)
            r = await pg.evaluate(SCAN); over = max(over, r["over"])
            bad += [x for x in r["bad"] if x not in bad]
        if bad or over > 1: found[g] = {"bad": bad[:6], "over": over}
    out[tag + "_scan"] = found
    chk(f"{tag}: nothing covered, no sideways scroll, in every group", not found, found)

async def desktop(b, lang):
    tag = f"desktop {lang}"; ctx, pg, errs = await open_page(b, 1280, 900, lang, False); E = pg.evaluate
    # ---- 1. one page in one piece
    r = await E("""()=>{const q=s=>document.querySelector(s),R=s=>{const e=q(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]};
      return {one:['#wk','.tlwrap','.edbar','#edcmdq','.ne-rail','.ne-side','.fmtbtn','.edout'].map(s=>document.querySelectorAll('#main '+s).length),groups:[...document.querySelectorAll('.ne-rail [data-act="cat142"]')].map(b=>b.dataset.v),
        rail:R('.ne-rail'),side:R('.ne-side'),stage:R('.ne-stage'),tl:R('.ne-tl'),title:(q('#main h1')||{}).textContent,old:document.querySelectorAll('#main .edgrid,#main .cat140,#main .edtools72').length,dir:document.documentElement.dir}}""")
    out[tag + "_page"] = r
    chk(f"{tag}: one preview, one timeline, one tool row, one prompt bar, one rail, one settings box, format and export", r["one"] == [1] * 8, r["one"])
    chk(f"{tag}: the eight groups in order", r["groups"] == GROUPS, r["groups"])
    chk(f"{tag}: none of the old page's layout is left", r["old"] == 0, r["old"])
    rail, side, stage, tl = r["rail"], r["side"], r["stage"], r["tl"]
    rtl = r["dir"] == "rtl"
    order = (rail[0] > side[2] - 2 and side[0] > stage[2] - 2) if rtl else (rail[2] <= side[0] + 2 and side[2] <= stage[0] + 2)
    chk(f"{tag}: rail, settings, then the preview with the timeline under it", order and stage[3] <= tl[1] + 2 and abs(stage[0] - tl[0]) <= 2 and abs(stage[2] - tl[2]) <= 2, r)
    chk(f"{tag}: the page title", r["title"] and r["title"].strip() in ("Video editor", "محرر الفيديو"), r["title"])
    # ---- 2. every group: its settings, the prompt bar, the sub-tabs of that group only
    res = {}
    for g in GROUPS:
        await E("(g)=>document.querySelector('.ne-rail [data-v=\"'+g+'\"]').click()", g); await pg.wait_for_timeout(200)
        res[g] = await E("""()=>({tab:S.ed.tab,pressed:(document.querySelector('.ne-rail [aria-pressed="true"]')||{}).dataset?.v,panel:(document.querySelector('.ne-panel')||{}).dataset?.tab,
          kids:(document.querySelector('.ne-panel')||{children:[]}).children.length,prompt:!!document.querySelector('.ne-cmd #edcmdq')&&document.querySelector('#edcmdq').getBoundingClientRect().width>100,
          subs:[...document.querySelectorAll('.ne-sub [data-set="ed.tab"]')].filter(b=>b.getBoundingClientRect().width>1).map(b=>b.dataset.val)})""")
    out[tag + "_groups"] = res
    G = {"media": ["media"], "ai": ["ai140", "ai"], "edit": ["clip", "motion", "track"], "text": ["text", "words", "info", "logo"], "audio": ["audio", "sfx"], "color": ["color", "look"], "fx": ["vfx", "erase", "layers", "3d"], "export": ["export"]}
    bad = {g: x for g, x in res.items() if x["pressed"] != g or x["panel"] != x["tab"] or x["tab"] not in G[g] or not x["kids"] or not x["prompt"] or any(s not in G[g] for s in x["subs"])}
    chk(f"{tag}: each group opens its own settings, its own sub-tabs only, the prompt bar on every group", not bad, bad)
    # back to a group → the tool used last in it
    await E("()=>{document.querySelector('.ne-rail [data-v=\"edit\"]').click()}"); await pg.wait_for_timeout(150)
    await E("()=>{document.querySelector('.ne-sub [data-val=\"motion\"]').click()}"); await pg.wait_for_timeout(150)
    await E("()=>{document.querySelector('.ne-rail [data-v=\"text\"]').click()}"); await pg.wait_for_timeout(150)
    await E("()=>{document.querySelector('.ne-rail [data-v=\"edit\"]').click()}"); await pg.wait_for_timeout(150)
    chk(f"{tag}: back to a group opens the tool used last in it", await E("S.ed.tab") == "motion", await E("S.ed.tab"))
    # ---- 3. Media lists the clips; a clip opens its settings
    await E("()=>document.querySelector('.ne-rail [data-v=\"media\"]').click()"); await pg.wait_for_timeout(200)
    m = await E("()=>({rows:[...document.querySelectorAll('.ne-panel [data-act=\"clip142\"]')].map(b=>b.dataset.v),clips:S.ed.clips.map(c=>c.id),add:!!document.querySelector('.ne-panel .addbar,.ne-panel [data-act=\"ed-add\"],.ne-panel input[type=file]')})")
    chk(f"{tag}: Media lists every clip and can add more", m["rows"] == m["clips"] and m["add"], m)
    await E("()=>document.querySelectorAll('.ne-panel [data-act=\"clip142\"]')[1].click()"); await pg.wait_for_timeout(200)
    r = await E("()=>({tab:S.ed.tab,sel:S.ed.sel,want:S.ed.clips[1].id})")
    chk(f"{tag}: a clip in Media opens its settings", r["tab"] == "clip" and r["sel"] == r["want"], r)
    # ---- 4. a tap on a timeline item opens its settings
    await E("()=>{document.querySelector('.ne-rail [data-v=\"color\"]').click()}"); await pg.wait_for_timeout(150)
    await pg.locator('#tlin .blk[data-textl="t1"], #tlin .blk[data-edxsel="t:t1"]').first.scroll_into_view_if_needed()
    await pg.locator('#tlin .blk[data-textl="t1"], #tlin .blk[data-edxsel="t:t1"]').first.click(); await pg.wait_for_timeout(250)
    r = await E("()=>({tab:S.ed.tab,pick:S.ed.pick})")
    chk(f"{tag}: a tap on a text on the timeline opens the text settings", r["tab"] == "text", r)
    # ---- 5. drawing the page again never moves it; a right-click menu stays open
    await E("()=>{S.ed.tab='clip';renderView()}"); await pg.wait_for_timeout(200)
    r = await E("""async()=>{const m=document.getElementById('main');const blk=document.querySelector('#tlin .blk[data-clip]');blk.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,200));
      const a=m.scrollTop,h=[];for(let i=0;i<4;i++){renderView();h.push(m.scrollTop);await new Promise(r=>requestAnimationFrame(r))}await new Promise(r=>setTimeout(r,250));return {a,h,end:m.scrollTop,max:m.scrollHeight-m.clientHeight}}""")
    out[tag + "_still"] = r
    chk(f"{tag}: drawing the editor again never moves the page", r["a"] > 0 and all(abs(x - r["a"]) <= 1 for x in r["h"]) and abs(r["end"] - r["a"]) <= 1, r)
    bb = await pg.locator("#tlin .blk[data-clip]").first.bounding_box()
    await pg.mouse.click(bb["x"] + 20, bb["y"] + bb["height"] / 2, button="right"); await pg.wait_for_timeout(400)
    r = await E("()=>{const m=document.querySelector('.cm131');return m?m.querySelectorAll('.cm131i').length:0}")
    chk(f"{tag}: right-click on a clip opens its menu and it stays", r >= 6, r)
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(100)
    # ---- 6. nothing covered, in every group
    await scan_all(pg, tag)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await ctx.close()

async def phone(b, lang):
    tag = f"phone {lang}"; ctx, pg, errs = await open_page(b, 390, 844, lang, True); E = pg.evaluate
    r = await E("""()=>{const q=s=>document.querySelector(s),R=s=>{const e=q(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]};
      const rail=q('.ne-rail'),bn=q('#bottomnav'),btn=[...rail.querySelectorAll('[data-act="cat142"]')].map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.left),Math.round(r.right),Math.round(r.width)]});
      return {pos:getComputedStyle(rail).position,rail:R('.ne-rail'),bn:bn&&getComputedStyle(bn).display!=='none'?R('#bottomnav'):null,btn,vh:innerHeight,
        order:['.edstage','.transport','.ne-cmd','.ne-tl','.ne-side'].map(s=>{const e=q('#main '+s);return e?Math.round(e.getBoundingClientRect().top+document.getElementById('main').scrollTop):-1}),
        sticky:getComputedStyle(q('.edstage')).position,top:R('.ne-top'),title:(q('#main h1')||{}).textContent,h1:q('#main h1')?getComputedStyle(q('#main h1')).display:'none',sw:document.documentElement.scrollWidth}}""")
    out[tag + "_page"] = r
    chk(f"{tag}: the tool groups are a bar fixed at the bottom, just above the site's bar", r["pos"] == "fixed" and r["rail"][3] <= (r["bn"][1] if r["bn"] else r["vh"]) + 1 and r["rail"][3] >= (r["bn"][1] if r["bn"] else r["vh"]) - 2, r)
    chk(f"{tag}: all eight groups fit on the bar", len(r["btn"]) == 8 and all(x[0] >= -1 and x[1] <= 391 and x[2] >= 40 for x in r["btn"]), r["btn"])
    chk(f"{tag}: preview, player, prompt bar, timeline, settings — in that order; the preview pinned", r["order"] == sorted(r["order"]) and min(r["order"]) >= 0 and r["sticky"] == "sticky", r["order"])
    chk(f"{tag}: a slim header with the page title", r["h1"] != "none" and r["title"].strip() in ("Video editor", "محرر الفيديو") and r["top"][3] - r["top"][1] <= 84, [r["top"], r["title"]])
    chk(f"{tag}: no sideways scroll", r["sw"] <= 390, r["sw"])
    # a group's settings come into view under the pinned preview
    res = {}
    for g in ("text", "color", "audio"):
        await E("()=>{document.getElementById('main').scrollTop=0}"); await pg.wait_for_timeout(100)
        await pg.locator(f'.ne-rail [data-v="{g}"]').tap(); await pg.wait_for_timeout(500)
        res[g] = await E("()=>{const s=document.querySelector('.ne-side').getBoundingClientRect(),st=document.querySelector('.edstage').getBoundingClientRect(),r=document.querySelector('.ne-rail').getBoundingClientRect();return [Math.round(s.top),Math.round(st.bottom),Math.round(r.top),S.ed.tab]}")
    out[tag + "_tap"] = res
    chk(f"{tag}: tapping a group shows its settings under the preview", all(v[0] >= v[1] - 2 and v[0] < v[2] - 40 for v in res.values()), res)
    await scan_all(pg, tag)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        for f, lang in ((desktop, "en"), (desktop, "ar"), (phone, "en"), (phone, "ar")):
            try: await f(b, lang)
            except Exception as e: fails.append(f"{f.__name__} {lang} crashed: " + repr(e)[:500])
        await b.close()
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict({k: v for k, v in os.environ.items() if not k.startswith(("KIE_", "LLM_"))}, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/health", timeout=2); break
        except Exception: time.sleep(.2)
    asyncio.run(main())
finally: srv.kill()
print(json.dumps({"fails": fails, "out": {k: json.dumps(v, ensure_ascii=False, default=str)[:1400] for k, v in out.items()}, "dir": D}, ensure_ascii=False, indent=1))
