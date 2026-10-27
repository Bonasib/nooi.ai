# v143: the editor in the CapCut / DonkeyCut layout. Computer: the add tools on a rail with their panel (Media library, Audio, Text,
# Stickers, Effects, Transitions, Captions, Filters, AI with the assistant) · the player (guides, full screen, the prompt bar) · the
# details of what is selected (a clip → Edit · Motion · Tracking; a text, a sound … → its settings; nothing → the project) · the
# timeline across the bottom, all in the window. Phone (v151: the studio — the whole screen, no site header, menu or footer): the
# player, the play row with undo/redo, the timeline, the settings in a panel with ✓, and a tool bar at the foot — the add tools, or the selected clip's own tools. EN + AR, no element id twice,
# nothing covered, no sideways scroll, no page errors. Run: python3 tests/v143.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8394
D = tempfile.mkdtemp(prefix="nooi-v143-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", M + "a.webm")
FF("-f", "lavfi", "-i", "sine=frequency=220:duration=8", "-c:a", "libmp3lame", M + "m.mp3")
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Beach',title:'Beach at sunset',created:now,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'},
   {id:'vb',kind:'video',status:'complete',prompt:'City',title:'City at night',created:now-9,progress:1,pal:PALS[1],seed:9,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];
 await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true,t:1});await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true,t:1});
 S.ed.texts=[{id:'t1',text:l==='ar'?'مرحبا':'HELLO',start:0,end:3,pos:'center',style:'clean',anim:'none',size:6}];S.ed.sfx=[{id:'s1',n:'pop',t:1,vol:100}];
 const b=await (await fetch('/media/m.mp3')).blob();loadSlot('edMusic',new File([b],'m.mp3',{type:'audio/mpeg'}));S.ed.tab='media';S.ed.sel=S.ed.clips[0].id;edSetPick('clip',S.ed.clips[0].id);go('edit');renderAll()}"""
RAIL = ["media", "audio", "text", "stickers", "effects", "trans", "captions", "filters", "ai"]
FIRST = {"media": "media", "audio": "audio", "text": "text", "stickers": "info", "effects": "vfx", "trans": "trans143", "captions": "words", "filters": "color", "ai": "chat143"}
SCAN = r"""()=>{const vis=e=>{const r=e.getBoundingClientRect();if(r.width<4||r.height<4)return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.05};
 const fixed=[...document.querySelectorAll('*')].filter(e=>{const p=getComputedStyle(e).position;return(p==='fixed'||p==='sticky')&&vis(e)}).map(e=>e.getBoundingClientRect());
 let top=0,bot=innerHeight;for(const r of fixed){if(r.top<=innerHeight*0.5&&r.bottom>top&&r.bottom<innerHeight*0.7&&r.width>innerWidth*0.5)top=Math.max(top,r.bottom);if(r.bottom>=innerHeight*0.6&&r.top>innerHeight*0.4&&r.width>innerWidth*0.5)bot=Math.min(bot,r.top)}
 const boxes=e=>{let p=e.parentElement;const o=[];while(p&&p!==document.body){const s=getComputedStyle(p);if(/(auto|scroll|hidden)/.test(s.overflowY+s.overflowX)&&(p.scrollHeight>p.clientHeight+2||p.scrollWidth>p.clientWidth+2))o.push(p.getBoundingClientRect());p=p.parentElement}return o};   // (v151: every box it scrolls in — the studio's panel body too)
 const name=e=>(e.getAttribute('aria-label')||e.textContent||e.value||e.dataset.act||e.tagName).trim().replace(/\s+/g,' ').slice(0,30)+' ['+(e.dataset.act||e.dataset.set||e.className||'').toString().slice(0,24)+']';
 const bad=[];for(const e of document.querySelectorAll('#main button,#main input:not([type=hidden]),#main select,#main textarea,#main label.btn')){if(!vis(e)||e.closest('.e-bar'))continue;const r=e.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
   if(cy<top+2||cy>bot-2||cx<0||cx>innerWidth)continue;if(boxes(e).some(b=>cy<b.top+2||cy>b.bottom-2||cx<b.left+2||cx>b.right-2))continue;
   const t=document.elementFromPoint(cx,cy);if(t&&!e.contains(t)&&!t.contains(e)&&!(t.closest('label')&&t.closest('label').contains(e))&&!(e.closest('label')&&e.closest('label').contains(t)))bad.push(name(e)+' under '+((t.closest('[class]')||t).className.toString().slice(0,30)||t.tagName))}
 const ids={};document.querySelectorAll('#main [id]').forEach(e=>{ids[e.id]=(ids[e.id]||0)+1});
 return {bad,over:document.documentElement.scrollWidth-innerWidth,dup:Object.keys(ids).filter(k=>ids[k]>1)}}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))

async def open_page(b, w, h, lang, mob):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await pg.evaluate(SETUP, lang); await pg.wait_for_function("S.ed.clips.length===2&&document.querySelector('.ed143 #wk')", timeout=20000); await pg.wait_for_timeout(600)
    return ctx, pg, errs

async def scan(pg, tag, states):
    found = {}
    for name, js in states:
        await pg.evaluate(js); await pg.wait_for_timeout(250)
        H, HB = await pg.evaluate("()=>{const b=document.querySelector('.ed143 .e-sheet .e-body');return [document.getElementById('main').scrollHeight,b?b.scrollHeight:0]}"); bad, over, dup = [], 0, []
        for y in range(0, H, 450):
          for yb in range(0, max(1, HB), 260):   # (v151: the studio page never scrolls — its panel does)
            await pg.evaluate("([y,yb])=>{document.getElementById('main').scrollTop=y;const b=document.querySelector('.ed143 .e-sheet .e-body');if(b)b.scrollTop=yb}", [y, yb]); await pg.wait_for_timeout(60)
            r = await pg.evaluate(SCAN); over = max(over, r["over"]); dup = r["dup"]
            bad += [x for x in r["bad"] if x not in bad]
        await pg.evaluate("()=>{document.getElementById('main').scrollTop=0}")
        if bad or over > 1 or dup: found[name] = {"bad": bad[:6], "over": over, "dup": dup}
    out[tag + "_scan"] = found
    chk(f"{tag}: nothing covered, no sideways scroll, no element id twice", not found, found)

async def desktop(b, lang):
    tag = f"desktop {lang}"; ctx, pg, errs = await open_page(b, 1280, 900, lang, False); E = pg.evaluate
    # ---- 1. the layout
    r = await E("""()=>{const q=s=>document.querySelector(s),R=s=>{const e=q(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]};
      return {one:['#wk','.tlwrap','.edbar','#edcmdq','.e-rail','.e-assets','.e-details','.fmtbtn','.edout','.e-name'].map(s=>document.querySelectorAll('#main '+s).length),rail:[...document.querySelectorAll('.e-rail button')].map(b=>b.dataset.v),
        R:{rail:R('.e-rail'),assets:R('.e-assets'),player:R('.e-player'),details:R('.e-details'),tl:R('.e-tl'),app:R('.e-app')},vh:innerHeight,dir:document.documentElement.dir,title:(q('#main h1')||{}).textContent,
        old:document.querySelectorAll('#main .edgrid,#main .cat140,#main .edtools72,#main .ne142').length,det:q('.e-details .e-body').dataset.tab,dsub:[...document.querySelectorAll('.e-details .e-sub button')].map(b=>b.dataset.v)}}""")
    out[tag + "_page"] = r
    chk(f"{tag}: one preview, timeline, tool row, prompt bar, rail, add panel, details, format, export, project name", r["one"] == [1] * 10, r["one"])
    chk(f"{tag}: the nine add tools in order", r["rail"] == RAIL, r["rail"])
    chk(f"{tag}: none of the old layouts left", r["old"] == 0, r["old"])
    x = r["R"]; rtl = r["dir"] == "rtl"
    order = (x["rail"][0] >= x["assets"][2] - 2 and x["assets"][0] >= x["player"][2] - 2 and x["player"][0] >= x["details"][2] - 2) if rtl else (x["rail"][2] <= x["assets"][0] + 2 and x["assets"][2] <= x["player"][0] + 2 and x["player"][2] <= x["details"][0] + 2)
    chk(f"{tag}: rail · add panel · player · details, the timeline across the bottom", order and x["tl"][1] >= x["player"][3] - 2 and abs((x["tl"][0] if not rtl else x["tl"][2]) - (x["assets"][0] if not rtl else x["assets"][2])) <= 2, x)
    chk(f"{tag}: the editor fits the window (no page scroll to reach the timeline)", x["app"][3] <= r["vh"] + 1, [x["app"], r["vh"]])
    chk(f"{tag}: the page title", r["title"] and r["title"].strip() in ("Video editor", "محرر الفيديو"), r["title"])
    chk(f"{tag}: the selected clip's details: Edit · Speed · Animation · Audio · Motion · Background · Tracking", r["det"] == "clip" and r["dsub"] == ["clip", "speed145", "anim145", "audio145", "motion", "bg144", "track"], [r["det"], r["dsub"]])   # (v145)
    # ---- 2. every add tool: its panels, the clip's details stay
    res = {}
    for v in RAIL:
        await E("(v)=>document.querySelector('.e-rail [data-v=\"'+v+'\"]').click()", v); await pg.wait_for_timeout(150)
        res[v] = await E("""()=>({tab:S.ed.tab,pressed:document.querySelector('.e-rail [aria-pressed="true"]')?.dataset.v,left:document.querySelector('.e-assets .e-body')?.dataset.tab,kids:document.querySelector('.e-assets .e-body')?.children.length,det:document.querySelector('.e-details .e-body')?.dataset.tab,prompt:!!document.querySelector('#edcmdq')})""")
    out[tag + "_tools"] = res
    bad = {v: z for v, z in res.items() if z["tab"] != FIRST[v] or z["pressed"] != v or z["left"] != FIRST[v] or not z["kids"] or z["det"] != "clip" or not z["prompt"]}
    chk(f"{tag}: each add tool opens its first panel; the clip's details and the prompt bar stay", not bad, bad)
    # ---- 3. details follow the selection
    await E("()=>{edSetPick('text','t1');S.ed.selText='t1';S.ed.tab='text';renderView()}"); await pg.wait_for_timeout(200)
    await E("()=>document.querySelector('.e-rail [data-v=\"text\"]').click()"); await pg.wait_for_timeout(150)
    t = await E("()=>({det:document.querySelector('.e-details .e-body')?.dataset.tab,edit:!!document.querySelector('.e-details [data-bind=\"edtext.text\"]'),add:!!document.querySelector('.e-assets [data-act=\"ed-addtext\"]'),head:document.querySelector('.e-details .e-pt')?.textContent})")
    await E("()=>{edSetPick('sfx','s1');S.ed.tab='sfx';renderView()}"); await pg.wait_for_timeout(200)
    sx = await E("()=>document.querySelector('.e-details .e-body')?.dataset.tab")
    await E("()=>document.querySelector('.e-details [data-act=\"desel143\"]').click()"); await pg.wait_for_timeout(200)
    pr = await E("()=>({det:document.querySelector('.e-details .e-body')?.dataset.tab,head:document.querySelector('.e-details .e-pt')?.textContent,pick:S.ed.pick})")
    out[tag + "_select"] = [t, sx, pr]
    chk(f"{tag}: a selected text → its settings on the right; the Text tool adds another on the left", t["det"] == "text" and t["edit"] and t["add"], t)
    chk(f"{tag}: a selected sound → its settings; × → the project", sx == "sfx" and pr["det"] == "export" and pr["pick"] is None, [sx, pr])
    # ---- 4. media library, transitions, assistant, guides, project name
    await E("()=>{S.ed.lt143='media';S.ed.tab='media';edSetPick('clip',S.ed.clips[0].id);renderView()}"); await pg.wait_for_timeout(250)
    n0 = await E("()=>S.ed.clips.length"); tiles = await E("()=>document.querySelectorAll('.e-assets [data-act=\"lib143\"]').length")
    await E("()=>document.querySelector('.e-assets [data-act=\"lib143\"][data-v=\"vb\"]').click()"); await pg.wait_for_function(f"S.ed.clips.length==={n0 + 1}", timeout=8000)
    chk(f"{tag}: your videos in the Media panel; one tap adds one to the timeline", tiles == 2 and await E("()=>S.ed.clips.some(c=>c.src&&c.src.job==='vb')"), tiles)
    await E("()=>{edSetPick('clip',S.ed.clips[0].id);document.querySelector('.e-rail [data-v=\"trans\"]').click()}"); await pg.wait_for_timeout(200)
    tr = await E("()=>{const t=[...document.querySelectorAll('.e-assets [data-set=\"edclip.trans\"]')];const f=t.find(b=>b.dataset.val==='fade');if(f)f.click();return{n:t.length,set:S.ed.clips[0].trans}}")
    await pg.wait_for_timeout(150); tr["set"] = await E("()=>S.ed.clips[0].trans")
    chk(f"{tag}: Transitions: the tiles for the selected clip; one tap sets it", tr["n"] >= 7 and tr["set"] == "fade", tr)
    await E("()=>document.querySelector('.e-rail [data-v=\"ai\"]').click()"); await pg.wait_for_timeout(150)
    await E("()=>edGo91(S.lang==='ar'?'حركة بطيئة':'slow motion')"); await pg.wait_for_timeout(500)
    ch = await E("()=>({log:(S.ed.chat143||[]).map(m=>[!!m.me,m.t.slice(0,40)]),shown:document.querySelectorAll('.e-assets .e-msg').length,speed:edSelClip().speed})")
    chk(f"{tag}: the assistant keeps the talk — what you asked, what it did", len(ch["log"]) >= 2 and ch["log"][-2][0] and not ch["log"][-1][0] and ch["shown"] >= 2 and ch["speed"] == 0.5, ch)
    await E("()=>document.querySelector('[data-act=\"guides143\"]').click()"); await pg.wait_for_timeout(250)
    gd = await E("()=>{const g=document.querySelector('.gd143'),c=document.getElementById('wk');if(!g)return null;const a=g.getBoundingClientRect(),b=c.getBoundingClientRect();return{mode:S.ed.guides143,d:[a.left-b.left,a.top-b.top,a.width-b.width,a.height-b.height].map(Math.round)}}")
    chk(f"{tag}: guides over the picture (thirds first)", gd and gd["mode"] == "thirds" and all(abs(v) <= 1 for v in gd["d"]), gd)
    await pg.fill(".e-name", "Summer trip"); await pg.wait_for_timeout(100)
    chk(f"{tag}: the project's name", await E("()=>S.ed.title") == "Summer trip")
    # ---- 5. drawing the page again never moves it; a right-click menu stays open
    await E("()=>{edSetPick('clip',S.ed.clips[0].id);S.ed.tab='clip';renderView()}"); await pg.wait_for_timeout(200)
    st = await E("""async()=>{const w=document.querySelector('.tlwrap');const blk=document.querySelector('#tlin .blk[data-clip]');blk.scrollIntoView({block:'nearest'});await new Promise(r=>setTimeout(r,150));const m=document.getElementById('main'),a=[m.scrollTop,w.scrollTop],h=[];
      for(let i=0;i<4;i++){renderView();h.push([m.scrollTop,document.querySelector('.tlwrap').scrollTop]);await new Promise(r=>requestAnimationFrame(r))}return {a,h}}""")
    chk(f"{tag}: drawing the editor again never moves the page", all(abs(z[0] - st["a"][0]) <= 1 for z in st["h"]), st)
    bb = await pg.locator("#tlin .blk[data-clip]").first.bounding_box()
    await pg.mouse.click(bb["x"] + 20, bb["y"] + bb["height"] / 2, button="right"); await pg.wait_for_timeout(400)
    chk(f"{tag}: right-click on a clip opens its menu and it stays", await E("()=>{const m=document.querySelector('.cm131');return m?m.querySelectorAll('.cm131i').length:0}") >= 6)
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(100)
    # ---- 6. nothing covered, no id twice
    states = [(v, f"()=>{{edSetPick('clip',S.ed.clips[0].id);document.querySelector('.e-rail [data-v=\"{v}\"]').click()}}") for v in RAIL]
    states += [("text selected", "()=>{edSetPick('text','t1');S.ed.selText='t1';S.ed.tab='text';renderView()}"), ("project", "()=>{edSetPick(null);S.ed.tab='export';renderView()}")]
    await scan(pg, tag, states)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await ctx.close()

async def phone(b, lang):
    tag = f"phone {lang}"; ctx, pg, errs = await open_page(b, 390, 844, lang, True); E = pg.evaluate
    await E("()=>{edSetPick(null);S.ed.tab='media';renderView()}"); await pg.wait_for_timeout(300)
    r = await E("""()=>{const q=s=>document.querySelector(s),R=s=>{const e=q(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]};
      const bar=q('.e-bar'),bn=q('#bottomnav');return {pos:getComputedStyle(bar).position,bar:R('.e-bar'),bn:bn&&getComputedStyle(bn).display!=='none'?R('#bottomnav'):null,vh:innerHeight,ctx:bar.classList.contains('ctx'),
        tools:[...bar.querySelectorAll('button')].map(b=>b.dataset.v||b.dataset.act),edbar:document.querySelectorAll('#main .edbar').length,undo:!!q('.transport [data-act="ed-undo"]')&&!!q('.transport [data-act="ed-redo"]'),
        order:['.edstage','.transport','.e-cmd','.e-tl','.e-sheet'].map(s=>{const e=q('#main '+s);return e?Math.round(e.getBoundingClientRect().top+document.getElementById('main').scrollTop):-1}),
        sticky:getComputedStyle(q('.edstage')).position,top:R('.e-top'),title:(q('#main h1')||{}).textContent,sw:document.documentElement.scrollWidth,
        cmd:getComputedStyle(q('.e-cmd')).display,msc:[document.getElementById('main').scrollHeight,document.getElementById('main').clientHeight],studio:document.documentElement.classList.contains('studio151'),
        head:!!q('#main>.topm')&&getComputedStyle(q('#main>.topm')).display!=='none',foot:[...document.querySelectorAll('#main .appfoot')].some(f=>getComputedStyle(f).display!=='none')}}""")
    out[tag + "_page"] = r
    foot = r["bn"][1] if r["bn"] else r["vh"]
    chk(f"{tag}: the studio fills the screen — no site header, menu bar or footer; the tool bar is the foot of the screen", r["studio"] and r["bn"] is None and not r["head"] and not r["foot"] and abs(r["bar"][3] - r["vh"]) <= 2 and not r["ctx"], r)   # (v151: was fixed above the site's bar)
    chk(f"{tag}: the add tools, the project and the magnet on the bar", r["tools"] == RAIL + ["export", "mk146-add", "seq148-menu", "snap141"], r["tools"])   # (v148: Timelines)
    chk(f"{tag}: CapCut's play row: no separate tool row, undo and redo beside play", r["edbar"] == 0 and r["undo"], [r["edbar"], r["undo"]])
    o5 = [x for i, x in enumerate(r["order"]) if i != 2]
    chk(f"{tag}: preview, play row, timeline, settings — in that order; the page never scrolls (the preview stays); the prompt bar rests while a panel is open", o5 == sorted(o5) and min(o5) >= 0 and r["cmd"] == "none" and r["msc"][0] <= r["msc"][1] + 1, [r["order"], r["cmd"], r["msc"]])   # (v151: the studio)
    await E("()=>{S.ed.pclosed143=S.ed.tab;renderView()}"); await pg.wait_for_timeout(200)
    o2 = await E("()=>['.edstage','.transport','.e-cmd','.e-tl'].map(s=>{const e=document.querySelector('#main '+s);return e&&getComputedStyle(e).display!=='none'?Math.round(e.getBoundingClientRect().top):-1})")
    chk(f"{tag}: with the panel closed: preview, play row, prompt bar, timeline", o2 == sorted(o2) and min(o2) >= 0, o2)
    await E("()=>{S.ed.pclosed143=null;S.ed.tab='media';renderView()}"); await pg.wait_for_timeout(200)
    chk(f"{tag}: a slim header with the page title; no sideways scroll", r["title"].strip() in ("Video editor", "محرر الفيديو") and r["top"][3] - r["top"][1] <= 96 and r["sw"] <= 390, [r["top"], r["sw"]])
    # a tap on a clip: the clip's own tools
    await E("()=>document.querySelector('#tlin .blk[data-clip]').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(700); bb = await pg.locator("#tlin .blk[data-clip]").first.bounding_box()   # (in the middle: the tool bar at the foot covers the bottom · v149: after the pinned preview has finished resizing)
    await pg.touchscreen.tap(bb["x"] + 30, bb["y"] + bb["height"] / 2); await pg.wait_for_timeout(500)
    c = await E("()=>({ctx:document.querySelector('.e-bar').classList.contains('ctx'),tools:[...document.querySelectorAll('.e-bar button')].map(b=>b.dataset.v||b.dataset.act),sheet:!!document.querySelector('.e-sheet'),kind:kind143()})")
    out[tag + "_ctx"] = c
    want = ["desel143", "clip", "ed-split", "speed145", "audio145", "anim145", "motion", "color", "trans143", "clip#crop", "90", "rev145", "edx-freeze", "fh", "ed-dup", "ed-move", "ed-move", "ed-extend91", "bg144", "clip#replace", "xa145", "track", "ai140", "cp146", "msm146", "ed-del", "snap141"]   # (v146: Copy, Select more · v144: Background · v145: Speed/Volume/Animation tabs, Crop, Rotate, Reverse, Replace, Extract audio)
    chk(f"{tag}: a tap on a clip shows its own tools at the foot (Split, Speed, Volume, Motion, Filters, Transition, Freeze, Mirror, Duplicate, Earlier, Later, Extend, Background, Tracking, AI, Delete)", c["ctx"] and c["kind"] == "clip" and c["tools"] == want and not c["sheet"], c)
    await E("()=>{const b=document.querySelector('.e-bar [data-v=\"speed145\"]');b.scrollIntoView({inline:'center'});b.click()}"); await pg.wait_for_timeout(600)
    sp = await E("()=>{const s=document.querySelector('.e-sheet'),st=document.querySelector('.edstage').getBoundingClientRect(),l=[...s.querySelectorAll('.lbl')].find(x=>/speed|السرعة/i.test(x.textContent));return{tab:S.ed.tab,lbl:l?Math.round(l.getBoundingClientRect().top):null,under:Math.round(st.bottom),bar:Math.round(document.querySelector('.e-bar').getBoundingClientRect().top)}}")
    chk(f"{tag}: Speed opens the clip's Speed settings, under the preview", sp["tab"] == "speed145" and sp["lbl"] is not None and sp["under"] <= sp["lbl"] < sp["bar"] - 40, sp)
    fh0 = await E("()=>!!(edSelClip().mo&&edSelClip().mo.fh)"); n0 = await E("()=>S.ed.clips.length")
    await E("()=>{const b=document.querySelector('.e-bar [data-act=\"edx-flip\"]');b.scrollIntoView({inline:'center'});b.click()}"); await pg.wait_for_timeout(200)
    await E("()=>{const b=document.querySelector('.e-bar [data-act=\"ed-dup\"]');b.scrollIntoView({inline:'center'});b.click()}"); await pg.wait_for_timeout(200)
    a = await E("()=>({fh:!!(S.ed.clips[0].mo&&S.ed.clips[0].mo.fh),n:S.ed.clips.length})")
    chk(f"{tag}: Mirror and Duplicate work from the bar", a["fh"] != fh0 and a["n"] == n0 + 1, [fh0, n0, a])
    await E("()=>document.querySelector('.e-bar [data-act=\"desel143\"]').click()"); await pg.wait_for_timeout(200)
    chk(f"{tag}: ‹ goes back to the add tools", not await E("()=>document.querySelector('.e-bar').classList.contains('ctx')"))
    # a tap on a text opens its settings; ✓ closes; another tool opens again
    await E("()=>document.querySelector('#tlin .blk[data-textl=\"t1\"]').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(150); bb = await pg.locator('#tlin .blk[data-textl="t1"]').bounding_box()
    await pg.touchscreen.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); await pg.wait_for_timeout(600)
    tx = await E("()=>({tab:S.ed.tab,edit:!!document.querySelector('.e-sheet [data-bind=\"edtext.text\"]')})")
    chk(f"{tag}: a tap on a text opens its settings", tx["tab"] == "text" and tx["edit"], tx)
    await E("()=>document.querySelector('.e-sheet [data-act=\"pclose143\"]').click()"); await pg.wait_for_timeout(200)
    closed = await E("()=>!document.querySelector('.e-sheet')")
    await E("()=>{edSetPick(null);S.ed.selText=null;renderView();document.querySelector('.e-bar [data-act=\"lt143\"][data-v=\"filters\"]').click()}"); await pg.wait_for_timeout(300)
    chk(f"{tag}: ✓ closes the settings, another tool opens them again", closed and await E("()=>!!document.querySelector('.e-sheet .e-body[data-tab=\"color\"]')"), closed)
    states = [(v, f"()=>{{edSetPick(null);S.ed.selText=null;const b=document.querySelector('.e-bar [data-act=\"lt143\"][data-v=\"{v}\"]');b.click()}}") for v in RAIL]
    states += [("clip tools", "()=>{edSetPick('clip',S.ed.clips[0].id);S.ed.tab='motion';renderView()}")]
    await scan(pg, tag, states)
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
