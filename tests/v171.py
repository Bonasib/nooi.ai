# v171 — the editor's timeline by touch, one agent at a time in a speech bubble, the engines inside the nooi Auto chip, the
# editor's prompt as a wand. A real nooi server and the page in Playwright (a phone with real touches through the browser's
# DevTools protocol, and a computer with a mouse):
#  · timeline, by touch: a tap on an item does nothing (nothing picked, no menu, no panel); a long press in its middle picks it
#    and opens its settings (no menu); a long press on its edge, then a slide, makes it shorter or longer (the timeline doesn't
#    scroll); a quick slide from an edge doesn't trim; an edge held and let go opens the settings; a picked item's handle still
#    trims at once
#  · timeline, by mouse: a click still picks, a right click still opens the menu
#  · the editor's prompt bar is a wand in the row under the picture: hidden until tapped, then over the timeline (the timeline
#    doesn't move), the words focused; a tap elsewhere or Esc folds it; words left in it show a dot; in the assistant's chat it
#    stays open in its place
#  · Home box: no "Engine" chip and no row of engine icons — the nooi Auto chip has a small arrow and opens the list (nooi Auto
#    first); a picked engine shows on the chip; nooi Auto again brings the agents back. The Video page: no engine row, the word
#    "Engine" gone from its chip (still read out)
#  · Home → Agents: one agent at a time in a speech bubble (9 in the plan, one shown), the next one a few seconds later, its face
#    lit in the row below; a tap on an agent in the row lets that one speak (also one not in the plan); English and Arabic
# Run: python3 tests/v171.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8520; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v171-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=3", "-c:v", "libvpx-vp9", "-b:v", "1M", "-deadline", "realtime", "-cpu-used", "8", D + "/media/clip.webm"], check=True, timeout=120)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

SETUP = """async(lang)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=lang;S.user={name:'T',method:'google'};AU.showAuth=false;
  S.jobs.push({id:'lj1',kind:'video',status:'complete',progress:1,resultUrl:'/media/clip.webm',title:'Clip',prompt:'x',created:Date.now(),dur:3,aspect:'16:9',art:'scene',seed:1,pal:PALS[0]});
  S.ed.clips=['c1','c2','c3'].map(id=>({id,src:{k:'job',job:'lj1'},in:0,out:3,speed:1}));S.ed.texts=[{id:'t1',text:'Why choose us',start:3.5,end:6,pos:'bottom',style:'caption',size:7}];
  S.ed.sel=null;ED.t=8;S.view='edit';renderView();await new Promise(r=>setTimeout(r,1500))}"""
# (back to nothing picked, the playhead far from the items touched, the timeline at its start)
RESET = """async()=>{const E=S.ed;E.clips.forEach(c=>{c.in=0;c.out=3});E.texts[0].start=3.5;E.texts[0].end=6;MS146.mod=null;E.msMode146=false;edSetPick(null);E.sel=null;E.selText=null;E.ms146=[];
  E.tab='media';E.lt143='media';E.pclosed143='media';ED.t=6.7;if(typeof cmClose131==='function')cmClose131();renderView();const w=document.querySelector('.tlwrap');if(w){w.scrollLeft=0;w.scrollTop=0}
  await new Promise(r=>setTimeout(r,700))}"""
GEO = """(sel)=>{const b=document.querySelector('#tlin '+sel);if(!b)return null;b.scrollIntoView({block:'nearest',inline:'nearest'});const r=b.getBoundingClientRect();
  return {l:r.left,r:r.right,y:r.top+r.height/2,w:r.width,z:S.ed.zoom,ph:document.querySelector('#tlin').getBoundingClientRect().left+40+ED.t*S.ed.zoom}}"""
STATE = """()=>{const E=S.ed,w=document.querySelector('.tlwrap'),m=document.querySelector('#main');return {sel:E.sel,pick:E.pick?E.pick.k+':'+E.pick.id:null,tab:E.tab,closed:E.pclosed143,
  menu:!!CM131.el,c1:[E.clips[0].in,E.clips[0].out],c2:[E.clips[1].in,E.clips[1].out],t1:[E.texts[0].start,E.texts[0].end],wrap:w?Math.round(w.scrollLeft):0,main:m?Math.round(m.scrollTop):0,t:+ED.t.toFixed(2)}}"""

async def launch(p, phone, lang="en"):
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    return br, c, pg, errs

async def timeline_phone(p):
    br, c, pg, errs = await launch(p, True); E = pg.evaluate; R = {}
    await E(SETUP, "en"); cdp = await c.new_cdp_session(pg)
    async def touch(x, y, hold, dx=0, steps=10):
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]}); await pg.wait_for_timeout(hold)
        for k in range(1, steps + 1 if dx else 1): await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + dx * k / steps, "y": y}]}); await pg.wait_for_timeout(16)
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(450)
        return await E(STATE)
    async def geo(sel):
        await E(RESET); return await E(GEO, sel)
    # 1. a tap does nothing
    g = await geo('.blk[data-clip="c1"]'); s0 = await E(STATE); r = await touch((g["l"] + g["r"]) / 2, g["y"], 60); R["tap"] = r
    ok(g and abs(g["ph"] - (g["l"] + g["r"]) / 2) > 60, f"(the playhead is away from the clip) {g}")
    ok(not r["sel"] and not r["pick"] and not r["menu"] and r["tab"] == s0["tab"] and r["closed"] == s0["closed"], f"a tap on a clip does nothing {r}")
    g = await geo('.blk[data-textl="t1"]'); r = await touch((g["l"] + g["r"]) / 2, g["y"], 60); R["tap_text"] = r
    ok(not r["pick"] and not r["menu"] and r["tab"] == "media", f"a tap on a text does nothing {r}")
    # 2. a long press in the middle: the item's settings, no menu
    g = await geo('.blk[data-clip="c1"]'); r = await touch((g["l"] + g["r"]) / 2, g["y"], 750); R["long_clip"] = r
    sh = await E("()=>!!document.querySelector('.ed143 .e-sheet')")
    ok(r["sel"] == "c1" and r["pick"] == "clip:c1" and r["tab"] == "clip" and not r["closed"] and not r["menu"] and sh and r["c1"] == [0, 3], f"a long press on a clip opens its settings {r} sheet={sh}")
    g = await geo('.blk[data-textl="t1"]'); r = await touch((g["l"] + g["r"]) / 2, g["y"], 750); R["long_text"] = r
    ok(r["pick"] == "text:t1" and r["tab"] == "text" and not r["closed"] and not r["menu"] and r["t1"] == [3.5, 6], f"a long press on a text opens its settings {r}")
    # 3. a long press on an edge, then a slide: shorter / longer; the timeline doesn't scroll
    g = await geo('.blk[data-clip="c1"]'); s0 = await E(STATE); r = await touch(g["r"] - 5, g["y"], 520, -40); R["trim_clip"] = r
    ok(r["c1"][0] == 0 and 1.5 < r["c1"][1] < 2.95 and abs(r["c1"][1] - (3 - 40 / g["z"])) < .35 and r["wrap"] == s0["wrap"] and not r["menu"] and r["pick"] == "clip:c1", f"a long press on a clip's end, then a slide: shorter {r} z={g['z']}")
    g = await geo('.blk[data-textl="t1"]'); r = await touch(g["l"] + 5, g["y"], 520, 30); R["trim_text"] = r
    ok(r["t1"][1] == 6 and r["t1"][0] > 3.6 and abs(r["t1"][0] - (3.5 + 30 / g["z"])) < .35 and not r["menu"], f"a long press on a text's start, then a slide: it starts later {r}")
    # 4. a quick slide from an edge (no long press) doesn't trim
    g = await geo('.blk[data-clip="c2"]'); r = await touch(g["r"] - 5, g["y"], 30, -40); R["quick"] = r
    ok(r["c2"] == [0, 3] and not r["pick"], f"a quick slide from an edge doesn't trim {r}")
    # 5. an edge held and let go: the settings
    g = await geo('.blk[data-clip="c2"]'); r = await touch(g["l"] + 5, g["y"], 600); R["edge_still"] = r
    ok(r["pick"] == "clip:c2" and r["tab"] == "clip" and r["c2"] == [0, 3] and not r["menu"], f"an edge held and let go opens the settings {r}")
    # 6. a picked item's handle still trims at once
    await E(RESET); await E("()=>{edSetPick('text','t1');renderView()}"); await pg.wait_for_timeout(300); g = await E(GEO, '.blk[data-textl="t1"]')
    r = await touch(g["r"] - 4, g["y"], 30, 30); R["picked_handle"] = r
    ok(r["t1"][0] == 3.5 and r["t1"][1] > 6.1, f"a picked text's handle trims at once {r}")
    # 7. "Select more" still adds with a tap
    await E(RESET); await E("()=>{edSetPick('text','t1');S.ed.msMode146=true;renderView()}"); await pg.wait_for_timeout(300); g = await E(GEO, '.blk[data-clip="c2"]')
    r = await touch((g["l"] + g["r"]) / 2, g["y"], 60); ms = await E("()=>sel146()"); R["select_more"] = ms
    ok("clip:c2" in ms and "text:t1" in ms, f"Select more: a tap adds {ms}")
    await E("()=>{S.ed.msMode146=false}")
    # 8. the wand: the prompt bar folded into the row under the picture
    await E(RESET); w0 = await E("""()=>{const c=document.getElementById('cmd171'),w=document.querySelector('.ed143 .transport .wand171'),tl=document.querySelector('.ed143 .e-tl').getBoundingClientRect();
      return {wand:!!w,shown:c?getComputedStyle(c).display:null,tl:Math.round(tl.top),label:w&&w.getAttribute('aria-label')}}""")
    await E("()=>document.querySelector('.wand171').click()"); await pg.wait_for_timeout(350)
    w1 = await E("""()=>{const c=document.getElementById('cmd171'),r=c.getBoundingClientRect(),tr=document.querySelector('.ed143 .transport').getBoundingClientRect(),tl=document.querySelector('.ed143 .e-tl').getBoundingClientRect();
      return {shown:getComputedStyle(c).display,top:Math.round(r.top),h:Math.round(r.height),l:Math.round(r.left),r:Math.round(r.right),trb:Math.round(tr.bottom),tl:Math.round(tl.top),focus:document.activeElement&&document.activeElement.id,exp:document.querySelector('.wand171').getAttribute('aria-expanded'),vw:innerWidth}}""")
    R["wand"] = [w0, w1]
    ok(w0["wand"] and w0["shown"] == "none" and w0["label"] == "Edit with a prompt", f"the prompt bar is a wand under the picture {w0}")
    ok(w1["shown"] == "block" and w1["top"] >= w1["trb"] and w1["h"] > 40 and w1["l"] >= 0 and w1["r"] <= w1["vw"] and w1["tl"] == w0["tl"] and w1["focus"] == "edcmdq" and w1["exp"] == "true", f"a tap opens it over the timeline, the words ready {w1}")
    await pg.keyboard.type("add rain"); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
    w2 = await E("()=>({shown:getComputedStyle(document.getElementById('cmd171')).display,dot:!!document.querySelector('.wand171 .dot171'),v:S.edCmd})")
    ok(w2["shown"] == "none" and w2["dot"] and w2["v"] == "add rain", f"Esc folds it; the words wait (a dot on the wand) {w2}")
    await E("()=>document.querySelector('.wand171').click()"); await pg.wait_for_timeout(300)
    g = await E("()=>{const r=document.getElementById('wk').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}}"); await touch(g["x"], g["y"], 60)
    w3 = await E("()=>getComputedStyle(document.getElementById('cmd171')).display"); ok(w3 == "none", f"a tap elsewhere folds it {w3}")
    await E("()=>{S.ed.tab='chat143';S.ed.lt143='ai';S.ed.pclosed143=null;renderView()}"); await pg.wait_for_timeout(400)
    w4 = await E("()=>{const c=document.getElementById('cmd171');return c&&{cls:c.className,shown:getComputedStyle(c).display}}")
    ok(w4 and "inl" in w4["cls"] and w4["shown"] != "none", f"in the assistant's chat the bar stays in its place {w4}")
    out["timeline_phone"] = R; ok(not errs, f"phone page errors {errs}"); await br.close()

async def timeline_mouse(p):
    br, c, pg, errs = await launch(p, False); E = pg.evaluate
    await E(SETUP, "en"); await E(RESET); g = await E(GEO, '.blk[data-clip="c2"]')
    await pg.mouse.click((g["l"] + g["r"]) / 2, g["y"]); await pg.wait_for_timeout(300); r = await E(STATE)
    ok(r["sel"] == "c2" and r["pick"] == "clip:c2", f"a click still picks a clip {r}")
    await E(RESET); g = await E(GEO, '.blk[data-textl="t1"]'); await pg.mouse.click((g["l"] + g["r"]) / 2, g["y"], button="right"); await pg.wait_for_timeout(300)
    m = await E("()=>CM131.el?[...CM131.el.querySelectorAll('.cm131i')].length:0"); ok(m >= 3, f"a right click still opens the menu ({m} lines)")
    await E("()=>cmClose131()")
    d = await E("""()=>{const c=document.getElementById('cmd171'),w=document.querySelector('.ed143 .transport .wand171');return {wand:!!w,shown:c&&getComputedStyle(c).display}}""")
    ok(d["wand"] and d["shown"] == "none", f"on a computer too the prompt is a wand {d}")
    ok(not errs, f"desktop page errors {errs}"); await br.close()

async def home(p, lang):
    br, c, pg, errs = await launch(p, True); E = pg.evaluate; ar = lang == "ar"; R = {}
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.hf.tab='video';S.hf.vModel='auto';S.hf.bots=true;go('home');renderAll()}", lang)
    await pg.wait_for_timeout(700)
    ch = await E("""()=>{const r=document.querySelector('.hfmrow');return {acts:[...r.querySelectorAll('button')].map(b=>b.dataset.act),eng:(()=>{const b=r.querySelector('.eng171');return b&&{act:b.dataset.act,txt:b.textContent.trim(),chev:b.lastElementChild&&b.lastElementChild.tagName.toLowerCase(),img:(b.querySelector('img')||{}).src||''}})(),
      rows:document.querySelectorAll('.ms163').length,pick:!!r.querySelector('.hfmi.pick'),auto:logoFor('auto')}}""")
    R["chips"] = {k: v for k, v in ch.items() if k != "auto"}
    nooi = "nooi تلقائي" if ar else "nooi Auto"
    ok(ch["eng"] and ch["eng"]["act"] == "hf-model" and ch["eng"]["txt"] == nooi and ch["eng"]["chev"] == "svg" and ch["eng"]["img"] == ch["auto"], f"{lang}: the nooi Auto chip with a small arrow {R['chips']}")
    ok(not ch["pick"] and ch["acts"].count("hf-model") == 1 and ch["rows"] == 0, f"{lang}: no Engine chip and no row of engine icons {R['chips']}")
    await E("()=>document.querySelector('.hfmi.eng171').click()"); await pg.wait_for_timeout(400)
    sh = await E("()=>[...document.querySelectorAll('.hfmodel')].map(b=>[b.dataset.v,b.getAttribute('aria-pressed')])"); R["sheet"] = sh[:4]
    ok(sh and sh[0] == ["auto", "true"] and len(sh) > 6, f"{lang}: the chip opens the list, nooi Auto first {sh[:4]}")
    await E("()=>document.querySelector('.hfmodel[data-v=\"kling30\"]').click()"); await pg.wait_for_timeout(400)
    k = await E("()=>{const b=document.querySelector('.hfmi.eng171');return {m:S.hf.vModel,txt:b.textContent.trim(),img:(b.querySelector('img')||{}).src||'',want:logoFor('kling30'),rows:document.querySelectorAll('.ms163').length}}")
    ok(k["m"] == "kling30" and k["txt"] == "Kling 3.0" and k["img"] == k["want"] and k["rows"] == 0, f"{lang}: the picked engine shows on the chip {k['m']} {k['txt']}")
    await E("()=>{S.hf.bots=false;renderView();document.querySelector('.hfmi.eng171').click()}"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('.hfmodel[data-v=\"auto\"]').click()"); await pg.wait_for_timeout(400)
    a = await E("()=>({m:S.hf.vModel,bots:S.hf.bots,txt:document.querySelector('.hfmi.eng171').textContent.trim()})")
    ok(a["m"] == "auto" and a["bots"] is True and a["txt"] == nooi, f"{lang}: nooi Auto from the list brings the agents back {a}")
    # the agents: one at a time in a bubble
    # (v173: picking from the list lets the producer speak about it for a while — the turns below start after that)
    await E("()=>{const r=document.querySelector('.hfstplan');r&&r.scrollIntoView({block:'center'});AG171.hold=0}"); await pg.wait_for_timeout(1300)
    ONE = """()=>{const P=document.querySelector('.hfstplan.bots'),li=[...document.querySelectorAll('.hfstplan .hbls>li.hbl')],on=li.filter(x=>x.classList.contains('on171')),pr=P.getBoundingClientRect();
      const vis=li.filter(x=>getComputedStyle(x).visibility!=='hidden'&&+getComputedStyle(x).opacity>.5),b=on[0]&&on[0].querySelector('.hbt').getBoundingClientRect();
      return {one:P.classList.contains('one171'),n:li.length,on:on.map(x=>x.dataset.bot),vis:vis.map(x=>x.dataset.bot),spk:[...document.querySelectorAll('.hfbots .sbot.spk171')].map(x=>x.dataset.bot),
        inside:!!b&&b.left>=pr.left-1&&b.right<=pr.right+1&&b.width>120,carousel:getComputedStyle(document.querySelector('.hfstplan .hbls')).display==='none'&&!!document.querySelector('.agc201'),txt:on[0]?on[0].querySelector('.hbt>span').textContent.trim():''}}"""
    o1 = await E(ONE); R["agent1"] = o1
    ok(o1["one"] and o1["n"] == 9 and len(o1["on"]) == 1 and o1["vis"] == o1["on"] and o1["spk"] == o1["on"] and (o1["inside"] or o1.get("carousel")) and len(o1["txt"]) > 10, f"{lang}: one agent of the 9 speaks, lit in the row below (or the v201 agents carousel takes the line's place) {o1}")
    await pg.wait_for_timeout(4600); o2 = await E(ONE); R["agent2"] = o2["on"]
    ok(len(o2["on"]) == 1 and o2["on"] != o1["on"] and o2["spk"] == o2["on"], f"{lang}: a few seconds later the next one {o1['on']}→{o2['on']}")
    await E("()=>document.querySelector('.hfbots .sbot[data-bot=\"proof\"]').click()"); await pg.wait_for_timeout(300); o3 = await E(ONE); an = await E("()=>!!document.querySelector('.hfstplan li.on171.anim171')")
    ok(o3["on"] == ["proof"] and an, f"{lang}: a tap on an agent in the row lets it speak {o3['on']} anim={an}")
    await E("()=>{S.hf.tab='image';renderView()}"); await pg.wait_for_timeout(500)
    await E("()=>{const s=document.querySelector('.hfbots .sbot[data-bot=\"writer\"]');s&&s.click()}"); await pg.wait_for_timeout(300)
    o4 = await E("()=>{const on=document.querySelector('.hfstplan li.on171');return on&&{bot:on.dataset.bot,x:on.classList.contains('x171'),txt:on.textContent.trim().slice(0,80)}}"); R["agent_extra"] = o4
    ok(o4 and o4["bot"] == "writer" and o4["x"] and len(o4["txt"]) > 10, f"{lang}: an agent not in the plan still says what it does {o4}")
    await pg.screenshot(path=D + f"/home_{lang}.png")
    # the Video page: no engine row; the chip without the word Engine
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(700)
    v = await E("""()=>{const c=document.querySelector('#main .o93[data-o93="model"]');return c&&{rows:document.querySelectorAll('.ms163').length,word:getComputedStyle(c.querySelector('.o93t')).display,label:c.getAttribute('aria-label'),val:c.querySelector('.o93v').textContent.trim()}}""")
    R["video_page"] = v
    ok(v and v["rows"] == 0 and v["word"] == "none" and (v["label"] or "").endswith(v["val"]) and ("المحرك" if ar else "Engine") in (v["label"] or ""), f"{lang}: the Video page's chip without the word Engine, no row {v}")
    out["home_" + lang] = R; ok(not errs, f"{lang} home page errors {errs}"); await br.close()

async def main():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: await asyncio.sleep(.25)
    async with async_playwright() as p:
        for name, f in (("timeline phone", lambda: timeline_phone(p)), ("timeline mouse", lambda: timeline_mouse(p)), ("home en", lambda: home(p, "en")), ("home ar", lambda: home(p, "ar"))):
            try: await f()
            except Exception as e: fails.append(f"{name} crashed: {e!r}"[:400])
try: asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1)[:12000])
shutil.rmtree(D, ignore_errors=True)
print("v171 ok" if not fails else f"FAILED {len(fails)}"); sys.exit(1 if fails else 0)
