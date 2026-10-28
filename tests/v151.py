# v151: the studio — the phone editor like the big apps (CapCut, LumaFusion, Filmora, Premiere Rush). On a phone or tablet the
# editor is the whole screen (no site header, menu bar or footer; a slim top bar with back, the name, size, projects and Export;
# the page itself never scrolls), a tool opens a panel in the lower half (the timeline a strip above it, the prompt bar resting),
# every choice a picture tile with its own icon (30 sounds since v152, weather & light, graphics, motion presets) and the looks drawn from the
# clip itself — no drop-down chips in the editor; the timeline with a coloured icon per lane (the lane's letter kept for screen
# readers), the clip's picture along the video lane, slim sound lanes, a ruler that stays at the top; a panel and the timeline keep
# their place when the editor is drawn again; words never cut in two on the choice buttons; back leaves the editor and the site's
# bars come back. Fixed: the clock never runs past the end; a clip made without sound is not "a sound that couldn't be read"
# (MP4 and WebM files looked at); a second Add of the same sound at the same moment adds nothing; mixed Arabic/English lines keep
# their own direction. Computer: the site as before, the same tiles. English + Arabic, tablet, nothing covered, no page errors.
# Run: python3 tests/v151.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8441; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v151-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "jobs": {}}}}, open(D + "/data/db.json", "w"))
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=8", "-f", "lavfi", "-i", "sine=frequency=330:duration=8", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", D + "/media/a.webm")
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "500k", "-an", D + "/media/silent.webm")   # (an AI engine's clip: no sound track)
FF("-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25:duration=2", "-c:v", "mpeg4", "-an", D + "/media/silent.mp4")
FF("-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25:duration=2", "-f", "lavfi", "-i", "sine=frequency=500:duration=2", "-c:v", "mpeg4", "-c:a", "aac", "-shortest", D + "/media/sound.mp4")
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.cloud149=false;
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.format='youtube';
 const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'beach.webm',{type:'video/webm'})]);
 S.ed.texts=[{id:'t1',text:l==='ar'?'مرحبا nooi':'HELLO',start:0,end:3,pos:'center',style:'clean',anim:'none',size:6}];S.ed.sfx=[{id:'s1',n:'pop',t:1,vol:100}];
 S.ed.tab='media';edSetPick(null);go('edit');renderAll()}"""
READY = "S.ed.clips.length===1&&document.querySelector('.ed143 #wk')&&srcReady(clipMedia(S.ed.clips[0]))"
SCAN = open(os.path.join(ROOT, "tests/v143.py")).read().split('SCAN = r"""')[1].split('"""')[0]
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))

async def open_page(b, w, h, lang, mob):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await pg.evaluate(SETUP, lang); await pg.wait_for_function(READY, timeout=20000); await pg.wait_for_timeout(500)
    return ctx, pg, errs
async def scan(pg, tag, states):
    found = {}
    for name, js in states:
        await pg.evaluate(js); await pg.evaluate("()=>document.querySelectorAll('.toast').forEach(t=>t.remove())"); await pg.wait_for_timeout(300)
        H, HB = await pg.evaluate("()=>{const b=document.querySelector('.ed143 .e-sheet .e-body');return [document.getElementById('main').scrollHeight,b?b.scrollHeight:0]}"); bad, over, dup = [], 0, []
        for y in range(0, H, 450):
            for yb in range(0, max(1, HB), 260):
                await pg.evaluate("([y,yb])=>{document.getElementById('main').scrollTop=y;const b=document.querySelector('.ed143 .e-sheet .e-body');if(b)b.scrollTop=yb}", [y, yb]); await pg.wait_for_timeout(50)
                r = await pg.evaluate(SCAN); over = max(over, r["over"]); dup = r["dup"]; bad += [x for x in r["bad"] if x not in bad]
        if bad or over > 1 or dup: found[name] = {"bad": bad[:6], "over": over, "dup": dup}
    chk(f"{tag}: nothing covered, no sideways scroll, no element id twice", not found, found)
# a word cut in two: one of its letters on another line than the rest
CUT = """()=>{const bad=[];document.querySelectorAll('#main .ed143 .seg button').forEach(b=>{const r0=b.getBoundingClientRect();if(!r0.width)return;const w=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){const re=/\\S+/g;let m;while((m=re.exec(n.data))){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);const tops=new Set([...r.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top)));if(tops.size>1)bad.push(m[0])}}});return bad}"""
STATES = lambda: [(v, f"()=>{{edSetPick(null);S.ed.selText=null;S.ed.lt143='{v}';const T=TABS143.find(x=>x[0]==='{v}');S.ed.tab=T[4][0];S.ed.pclosed143=null;renderView()}}") for v in ["media", "audio", "text", "stickers", "effects", "trans", "captions", "filters", "ai"]] + \
    [("sounds", "()=>{S.ed.lt143='audio';S.ed.tab='sfx';S.ed.pclosed143=null;renderView()}"), ("project", "()=>{edSetPick(null);S.ed.tab='export';S.ed.pclosed143=null;renderView()}"),
     ("clip", "()=>{edSetPick('clip',S.ed.clips[0].id);S.ed.tab='clip';S.ed.pclosed143=null;renderView()}"), ("closed", "()=>{edSetPick(null);S.ed.pclosed143=S.ed.tab;renderView()}")]

async def phone(b, lang):
    tag = f"phone {lang}"; ctx, pg, errs = await open_page(b, 390, 844, lang, True); E = pg.evaluate
    # ---- 1. the whole screen
    await E("()=>{edSetPick(null);S.ed.pclosed143=S.ed.tab;renderView()}"); await pg.wait_for_timeout(300)
    r = await E("""()=>{const q=s=>document.querySelector(s),R=s=>{const e=q(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]},m=q('#main'),shown=e=>!!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
      return {studio:document.documentElement.classList.contains('studio151'),head:shown(q('#main>.topm')),nav:shown(q('#bottomnav')),foot:[...document.querySelectorAll('#main .appfoot')].some(shown),tabs:shown(q('#main .hubtabs')),
        view:R('.view.ed143'),vh:innerHeight,scroll:[m.scrollHeight,m.clientHeight],bar:R('.e-bar'),top:R('.e-top'),back:(q('.e-top .e-home151')||{dataset:{}}).dataset.go||null,h1:(q('#main h1')||{}).textContent||'',
        stage:R('.edstage'),tl:R('.e-tl'),cmd:!shown(q('.e-cmd'))&&!!q('.transport .wand171'),bg:getComputedStyle(q('.view.ed143')).backgroundColor}}""")
    out[tag + "_shell"] = r
    chk(f"{tag}: the editor is the whole screen — no site header, menu bar, footer or section tabs", r["studio"] and not r["head"] and not r["nav"] and not r["foot"] and not r["tabs"] and r["view"][1] == 0 and abs(r["view"][3] - r["vh"]) <= 1, r)
    chk(f"{tag}: the page never scrolls; the tool bar is the foot of the screen; a slim top bar with back (to the site)", r["scroll"][0] <= r["scroll"][1] + 1 and abs(r["bar"][3] - r["vh"]) <= 1 and r["top"][1] == 0 and r["top"][3] <= 60 and r["back"] == "home" and r["h1"].strip() in ("Video editor", "محرر الفيديو"), r)
    chk(f"{tag}: top bar, player, timeline, tools — top to bottom, filling the screen (v171: the prompt bar is a wand in the play row)", r["top"][3] <= r["stage"][1] + 1 and r["stage"][3] < r["tl"][1] and r["tl"][3] <= r["bar"][1] + 1 and r["cmd"] and r["bar"][1] - r["tl"][3] < 4, r)
    chk(f"{tag}: the studio is dark", sum(int(x) for x in r["bg"].replace("rgb(", "").replace(")", "").split(",")[:3]) < 90, r["bg"])
    # ---- 2. a tool opens its panel in the lower half
    await E("()=>{const b=document.querySelector('.e-bar [data-act=\"lt143\"][data-v=\"audio\"]');b.click()}"); await pg.wait_for_timeout(300)
    await E("()=>{S.ed.tab='sfx';renderView();showSheet143()}"); await pg.wait_for_timeout(300)
    s = await E("""()=>{const q=s=>document.querySelector(s),R=s=>{const e=q(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.top),Math.round(r.bottom)]};
      return {sheet:R('.e-sheet'),tl:R('.e-tl'),stage:R('.edstage'),bar:R('.e-bar'),vh:innerHeight,cmd:getComputedStyle(q('.e-cmd')).display,cls:q('.view.ed143').className,body:(()=>{const b=q('.e-sheet .e-body');return[b.scrollHeight,b.clientHeight,getComputedStyle(b).overflowY]})()}}""")
    out[tag + "_sheet"] = s
    chk(f"{tag}: a tool's panel takes the lower half — the player stays, the timeline a strip above it, the prompt bar rests", s["sheet"] and s["sheet"][0] < s["vh"] * .62 and s["sheet"][1] <= s["bar"][0] + 1 and s["tl"][1] <= s["sheet"][0] + 1 and s["tl"][1] - s["tl"][0] >= 60 and s["stage"][0] < s["tl"][0] and s["cmd"] == "none" and "sh151" in s["cls"] and s["body"][2] == "auto", s)
    # ---- 3. the tiles: every sound its own icon; no drop-down chips anywhere in the editor
    t = await E("""()=>{const bs=[...document.querySelectorAll('.e-sheet [data-act="edx-sfx-add"]')];return {n:bs.length,uniq:new Set(bs.map(b=>(b.querySelector('.ic151')||{innerHTML:''}).innerHTML)).size,ic:bs.filter(b=>b.querySelector('.ic151 svg')).length,chips:document.querySelectorAll('#main .ed143 .pk84c').length}}""")
    chk(f"{tag}: 30 sounds (v152: 12 more), each with its own drawn icon", t["n"] == 30 and t["ic"] == 30 and t["uniq"] == 30, t)
    # (a sheet that is scrolled stays where it is when the editor is drawn again)
    k = await E("()=>{const b=document.querySelector('.e-sheet .e-body');b.scrollTop=90;renderView();const c=document.querySelector('.e-sheet .e-body');return [c.scrollTop,c===b]}")
    chk(f"{tag}: the panel keeps its place when the editor is drawn again", abs(k[0] - 90) <= 2 and not k[1], k)
    for st, q, n0 in (("()=>{S.ed.lt143='effects';S.ed.tab='vfx';renderView()}", '[data-act="edv-add"]', 14), ("()=>{S.ed.lt143='stickers';S.ed.tab='info';renderView()}", '[data-act="edi-add"]:not([data-v^="mg150:"])', 12),
                      ("()=>{S.ed.lt143='ai';S.ed.tab='ai140';renderView();S.ed.tab='info';renderView()}", '[data-act="mg-pre"]', 6)):
        await E(st); await pg.wait_for_timeout(250)
        g = await E("""(q)=>{const bs=[...document.querySelectorAll('#main .ed143 '+q)];return {n:bs.length,ic:bs.filter(b=>b.querySelector('.ic151 svg')).length,emoji:bs.filter(b=>/[\\u2600-\\u27bf]|[\\ud83c-\\udbff]/.test(b.textContent)).map(b=>b.textContent.trim().slice(0,12)),names:bs.filter(b=>b.textContent.trim().length>2).length}}""", q)
        out[tag + "_tiles_" + q[:16]] = g
        chk(f"{tag}: {q} — picture tiles with an icon and a name each, no emoji", g["n"] >= n0 and g["ic"] == g["n"] and not g["emoji"] and g["names"] == g["n"], g)
    await E("()=>{S.ed.lt143='filters';S.ed.tab='color';edSetPick('clip',S.ed.clips[0].id);S.ed.sel=S.ed.clips[0].id;S.ed.tab='color';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(500)
    lk = await E("""()=>{const bs=[...document.querySelectorAll('#main .ed143 [data-act="edx-look"]')];const px=b=>{const c=b.querySelector('canvas.lk151');if(!c)return -1;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return s/(d.length/4)/3};
      const tl=bs.find(b=>b.dataset.v==='teal');return {n:bs.length,pics:bs.filter(b=>px(b)>10).length,f:tl?getComputedStyle(tl.querySelector('canvas')).filter:'',tint:!!(tl&&tl.querySelector('.lkt151')),tip:tl?tl.title:'',chips:document.querySelectorAll('#main .ed143 .pk84c').length}}""")
    out[tag + "_looks"] = lk
    chk(f"{tag}: the looks are tiles showing the clip itself in each look (filter and tint), what each does on it; no chips", lk["n"] >= 11 and lk["pics"] == lk["n"] and "contrast" in lk["f"] and lk["tint"] and lk["tip"] and lk["chips"] == 0, lk)
    # ---- 4. the timeline
    await E("()=>{edSetPick(null);S.ed.pclosed143=S.ed.tab;renderView()}"); await pg.wait_for_function("document.querySelector('#tlin .blk.v.th151')", timeout=8000)
    tl = await E("""()=>{const t=[...document.querySelectorAll('#tlin .tn[data-ln151]')];const sx=document.querySelector('#tlin .blk.sx').closest('.trk'),v=document.querySelector('#tlin .blk.v');
      return {lanes:t.map(x=>x.dataset.ln151+':'+x.textContent),icons:t.filter(x=>x.querySelector('svg')).length,col:[...new Set(t.map(x=>getComputedStyle(x).color))].length,sx:Math.round(sx.getBoundingClientRect().height),
        th:getComputedStyle(v).backgroundImage.includes('data:image/jpeg'),ruler:getComputedStyle(document.querySelector('.tlwrap .ruler')).position}}""")
    out[tag + "_tl"] = tl
    chk(f"{tag}: every lane a coloured icon (its letter kept for screen readers)", tl["icons"] == len(tl["lanes"]) >= 4 and "clip:V" in tl["lanes"] and "sfx:FX" in tl["lanes"] and "text:T" in tl["lanes"] and tl["col"] >= 4, tl)
    chk(f"{tag}: the clip's own picture along the video lane; slim sound lanes; the ruler stays at the top", tl["th"] and tl["sx"] <= 26 and tl["ruler"] == "sticky", tl)
    # ---- 5. fixes
    ck = await E("""async()=>{const T=edTotal();ED.playing=false;ED.t=T+5;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));return {t:ED.t,T,tc:document.getElementById('tc').textContent}}""")
    chk(f"{tag}: the clock never runs past the end", abs(ck["t"] - ck["T"]) < .01 and ck["tc"].split("/")[0].strip() == ck["tc"].split("/")[1].strip(), ck)
    await E("()=>{S.ed.lt143='audio';S.ed.tab='sfx';S.ed.pclosed143=null;ED.t=2;renderView()}"); await pg.wait_for_timeout(250)
    await pg.locator('.e-sheet [data-act="edx-sfx-add"][data-v="impact"]').tap(); await pg.wait_for_timeout(300)
    d = await E("""async()=>{const n0=S.ed.sfx.length;document.querySelector('[data-act="sx149-add"]').click();await new Promise(r=>setTimeout(r,150));const n1=S.ed.sfx.length;
      SX149.pick='impact';renderView();document.querySelector('[data-act="sx149-add"]').click();await new Promise(r=>setTimeout(r,150));const n2=S.ed.sfx.length;
      const b=document.querySelector('.e-sheet [data-act="edx-sfx-add"][data-v="ding"]');b.click();b.click();await new Promise(r=>setTimeout(r,300));
      return {n0,n1,n2,n3:S.ed.sfx.length,imp:S.ed.sfx.filter(x=>x.n==='impact').length,ding:S.ed.sfx.filter(x=>x.n==='ding').length,shown:!!document.querySelector('#tlin .blk.sx')}}""")
    chk(f"{tag}: Add puts the sound in at once; the same sound at the same moment again adds nothing", d["n1"] == d["n0"] + 1 and d["n2"] == d["n1"] and d["imp"] == 1 and d["ding"] == 1 and d["shown"], d)
    await E("()=>{S.ed.lt143='captions';S.ed.tab='words';S.ed.caps.words=[{s:0,e:1,w:'مرحبا'},{s:1,e:2,w:'nooi'}];S.ed.caps.on=true;S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(250)
    bd = await E("()=>[...document.querySelectorAll('#main .ed143 textarea')].map(t=>getComputedStyle(t).unicodeBidi)")
    chk(f"{tag}: mixed Arabic and English lines keep their own direction", bd and all(x == "plaintext" for x in bd), bd)
    # ---- 6. words never cut in two; nothing covered; then back to the site
    cut = []
    for name, js in STATES():
        await E(js); await pg.wait_for_timeout(150); cut += [x for x in await E(CUT) if x not in cut]
    chk(f"{tag}: no word on a choice button is cut in two", not cut, cut[:8])
    await scan(pg, tag, STATES())
    if lang == "ar":
        fl = await E("()=>getComputedStyle(document.querySelector('.e-home151 svg')).transform")
        chk(f"{tag}: back points the right way", fl not in ("none", ""), fl)
    await E("()=>{edSetPick(null);renderView()}"); await pg.wait_for_timeout(150)
    await pg.locator(".e-top .e-home151").tap(); await pg.wait_for_timeout(500)
    bk = await E("()=>({v:S.view,studio:document.documentElement.classList.contains('studio151'),nav:getComputedStyle(document.getElementById('bottomnav')).display})")
    chk(f"{tag}: back leaves the editor — the site's bars come back", bk["v"] == "home" and not bk["studio"] and bk["nav"] != "none", bk)
    chk(f"{tag}: no page errors", not errs, errs[:3]); await ctx.close()

async def tablet(b):
    ctx, pg, errs = await open_page(b, 820, 1180, "en", True); E = pg.evaluate
    await E("()=>{S.ed.lt143='audio';S.ed.tab='sfx';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(300)
    r = await E("()=>({studio:document.documentElement.classList.contains('studio151'),tabs:[...document.querySelectorAll('#main .hubtabs')].some(t=>getComputedStyle(t).display!=='none'),vh:innerHeight,bar:Math.round(document.querySelector('.e-bar').getBoundingClientRect().bottom),sc:[document.getElementById('main').scrollHeight,document.getElementById('main').clientHeight]})")
    chk("tablet: the studio too — the whole screen, no section tabs, the tools at the foot", r["studio"] and not r["tabs"] and abs(r["bar"] - r["vh"]) <= 1 and r["sc"][0] <= r["sc"][1] + 1, r)
    await scan(pg, "tablet", STATES()[:4])
    chk("tablet: no page errors", not errs, errs[:3]); await ctx.close()

async def desktop(b):
    ctx, pg, errs = await open_page(b, 1280, 860, "en", False); E = pg.evaluate
    await E("()=>{S.ed.lt143='filters';S.ed.tab='color';S.ed.sel=S.ed.clips[0].id;edSetPick('clip',S.ed.clips[0].id);renderView()}"); await pg.wait_for_timeout(400)
    r = await E("""()=>({studio:document.documentElement.classList.contains('studio151'),head:getComputedStyle(document.querySelector('#main>.topm')).display,looks:document.querySelectorAll('.ed143 [data-act="edx-look"] canvas.lk151').length,
      chips:document.querySelectorAll('#main .ed143 .pk84c').length,lanes:document.querySelectorAll('#tlin .tn[data-ln151] svg').length,back:!!document.querySelector('.e-home151')})""")
    chk("computer: the site as before (its header, no studio frame); the same picture tiles and lane icons; no chips", not r["studio"] and r["head"] != "none" and r["looks"] >= 11 and r["chips"] == 0 and r["lanes"] >= 3 and not r["back"], r)
    await E("()=>{edSetPick(null);S.ed.lt143='audio';S.ed.tab='sfx';renderView()}"); await pg.wait_for_timeout(250)
    n = await E("()=>document.querySelectorAll('.e-assets [data-act=\"edx-sfx-add\"] .ic151 svg').length")
    chk("computer: the sound tiles with their own icons", n == 30, n)
    await scan(pg, "computer", [("sounds", "()=>{S.ed.lt143='audio';S.ed.tab='sfx';renderView()}"), ("effects", "()=>{S.ed.lt143='effects';S.ed.tab='vfx';renderView()}"), ("filters", "()=>{S.ed.lt143='filters';S.ed.tab='color';renderView()}")])
    # ---- a clip with no sound: not "couldn't be read"
    s = await E("""async()=>{const f=async(u,n)=>new File([await (await fetch(u)).blob()],n,{type:n.endsWith('.mp4')?'video/mp4':'video/webm'});const r={};
      for(const n of ['silent.webm','silent.mp4','sound.mp4','a.webm'])r[n]=noSound151(await (await f('/media/'+n,n)).arrayBuffer());
      edAddFiles([await f('/media/silent.webm','silent.webm')]);for(let i=0;i<80&&!(S.ed.clips.length===2&&srcReady(clipMedia(S.ed.clips[1])));i++)await new Promise(r=>setTimeout(r,100));r.n=S.ed.clips.length;
      let err='';try{await edxTimelineAudio()}catch(e){err=String(e.message||e)}r.miss=EDX.miss149;r.sil=S.ed.clips.filter(c=>SIL151.has(c.id)).length;r.err=err;
      const keep=S.ed.clips.slice();S.ed.clips=[keep[1]];err='';try{await edxTimelineAudio()}catch(e){err=String(e.message||e)}r.only=err;S.ed.clips=keep;return r}""")
    out["silent"] = s
    chk("a file with no sound track is known as one (WebM and MP4), one with sound is not", s["silent.webm"] and s["silent.mp4"] and not s["sound.mp4"] and not s["a.webm"], s)
    chk("a silent clip among the clips is not 'a sound that couldn't be read'; only silent clips → 'the clips have no sound'", s["n"] == 2 and s["miss"] == [] and s["sil"] == 1 and not s["err"] and "no sound" in s["only"], s)
    chk("computer: no page errors", not errs, errs[:3]); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        for f, a in ((phone, ("en",)), (phone, ("ar",)), (tablet, ()), (desktop, ())):
            try: await f(b, *a)
            except Exception as e: fails.append(f"{f.__name__} {a} crashed: " + repr(e)[:500])
        await b.close()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "KIE_", "GOOGLE_", "LOCAL_LLM", "GEMMA_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    asyncio.run(main())
except Exception as e: fails.append("crashed: " + repr(e)[:400])
finally: srv.kill()
print(json.dumps(out, ensure_ascii=False, default=str)[:1500])
print("FAIL " + str(len(fails)) if fails else "PASS"); [print(" ✗", f) for f in fails]
sys.exit(1 if fails else 0)
