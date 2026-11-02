# v218 — the owner: "there is no fonts + I want to see the effects before I select it + lots of spaces and gaps + large icons".
#  · a picked text's panel (computer / iPad) starts with its words, then Font: the words drawn in nine fonts of their own script
#    (Arabic words → Arabic fonts), a tap sets it (undo brings it back), All fonts opens the full list; the add-text tiles the
#    left panel already shows are not repeated on the right (when the left shows something else they move to the end)
#  · effects: every Weather & light tile shows the picture with that effect; pointing at one plays it on the preview with a
#    "Preview" tag — nothing is added until it is tapped; leaving clears it
#  · tighter: the logo ≤ 24 px tall, the top bar ≤ 56 px, rail icons 16 px, icon boxes 26 px, platform tiles three a row and short
# Run: python3 tests/v218.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8693; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v218-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "600k", D + "/media/a.webm")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Beach',title:'Beach',created:now,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.format=FORMATS.find(f=>f[2]>f[3])[0];await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});
 S.ed.texts=[{id:'t1',text:'Guilin',start:0,end:3,pos:'center',style:'caption',size:7,anim:'none'},{id:'t2',text:'مرحبا',start:3,end:5,pos:'top',style:'caption',size:7,anim:'none'}];go('edit');renderAll()}"""
PICK = "(id)=>{S.ed.lt143='text';S.ed.tab='text';S.ed.pclosed143=null;S.ed.selText=id;edSetPick('text',id);renderView()}"
PIX = "()=>{const c=document.getElementById('wk'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i+=97)s+=d[i]+d[i+1]+d[i+2];return s}"

async def run(p):
    tag = "en 1440"; b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await E(SETUP, "en"); await pg.wait_for_function("S.ed.clips.length===1&&document.querySelector('#wk')&&M['c_'+S.ed.clips[0].id]&&srcReady(M['c_'+S.ed.clips[0].id])", timeout=25000); await pg.wait_for_timeout(500)
    # ---- 1. fonts first
    await E(PICK, "t1"); await pg.wait_for_timeout(300)
    r = await E("""()=>{const b=document.querySelector('.e-details .e-body[data-tab="text"]'),k=[...b.children].slice(0,6).map(e=>e.className||e.tagName);
      return{k,fonts:[...b.querySelectorAll('.qf218b')].map(x=>x.dataset.v),smp:(b.querySelector('.qf218b b')||{}).textContent,all:!!b.querySelector('.qf218all[data-act="f-open"]'),
        dup:!!b.querySelector('.ts144g,[data-act="ed-addtext"]'),left:!!document.querySelector('.e-assets .ts144g'),top:Math.round(b.querySelector('.qf218').getBoundingClientRect().top),vh:innerHeight}}""")
    chk(f"{tag}: a picked text starts with its words, then Font with nine samples of its own words and All fonts", r["k"][:4] == ["lbl", "INPUT", "lbl", "qf218w"] and len(r["fonts"]) == 9 and r["fonts"][0] == "Montserrat" and r["smp"] == "Guilin" and r["all"] and r["top"] < r["vh"] * .4, r)
    chk(f"{tag}: the add-text tiles are not repeated on the right while the left shows them", not r["dup"] and r["left"], r)
    await pg.click('.qf218b[data-v="Anton"]'); await pg.wait_for_timeout(300)
    r = await E("()=>({f:S.ed.texts[0].font,on:(document.querySelector('.qf218b[aria-pressed=\"true\"]')||{}).dataset?.v})")
    u = await E("async()=>{histGo(-1);await new Promise(r=>setTimeout(r,200));return S.ed.texts[0].font||''}")
    chk(f"{tag}: a tap sets the font (shown pressed); undo brings the old one back", r["f"] == "Anton" and r["on"] == "Anton" and u == "", [r, u])
    await E(PICK, "t2"); await pg.wait_for_timeout(300)
    r = await E("()=>[...document.querySelectorAll('.e-details .qf218b')].map(x=>x.dataset.v)")
    chk(f"{tag}: Arabic words get Arabic fonts", r[:2] == ["Cairo", "Tajawal"], r)
    await E("()=>{S.ed.lt143='media';S.ed.tab='media';S.ed.selText='t1';edSetPick('text','t1');renderView()}"); await pg.wait_for_timeout(300)
    r = await E("""()=>{const b=document.querySelector('.e-details .e-body'),inp=b&&b.querySelector('input[data-bind="edtext.text"]'),add=b&&b.querySelector('[data-act="ed-addtext"]');return{tab:b&&b.dataset.tab,order:!!(inp&&add&&(inp.compareDocumentPosition(add)&4))}}""")
    chk(f"{tag}: when the left shows something else, the add-text part moves to the end of the text panel", r["order"], r)
    # ---- 2. effects before they are added
    await E("()=>{edSetPick(null);S.ed.selText=null;S.ed.lt143='effects';S.ed.tab='vfx';S.ed.pclosed143=null;ED.t=1;ED.playing=false;renderView()}"); await pg.wait_for_timeout(700)
    r = await E("""()=>{const t=[...document.querySelectorAll('.e-assets [data-act="edv-add"]')],c=t.map(x=>x.querySelector('canvas.pv218i')),sig=cv=>{if(!cv)return 0;const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let s=0;for(let i=0;i<d.length;i+=13)s+=d[i]*3+d[i+1]*5+d[i+2]*7;return s};
      const by={};t.forEach((x,i)=>by[x.dataset.v]=sig(c[i]));return{n:t.length,with:c.filter(Boolean).length,snow:by.snow,fog:by.fog,rain:by.rain,blank:c.filter(x=>x&&!sig(x)).length}}""")
    chk(f"{tag}: every effect tile shows the picture with that effect (snow and fog differ)", r["n"] >= 10 and r["with"] == r["n"] and r["blank"] == 0 and r["snow"] != r["fog"], r)
    n0 = await E("()=>(S.ed.vfx||[]).length"); p0 = await E(PIX)
    box = await E("()=>{const e=document.querySelector('.e-assets [data-act=\"edv-add\"][data-v=\"snow\"]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]}")
    await pg.mouse.move(box[0], box[1]); await pg.wait_for_timeout(400); p1 = await E(PIX)
    r = await E("()=>({k:PV218.kind,tag:(document.querySelector('.e-player .pv218b')||{}).textContent||'',n:(S.ed.vfx||[]).length})")
    chk(f"{tag}: pointing at Snow plays it on the preview with a Preview tag — nothing added", r["k"] == "snow" and "Preview" in r["tag"] and "Snow" in r["tag"] and r["n"] == n0 and p1 != p0, [r, p0, p1])
    await pg.mouse.move(700, 880); await pg.wait_for_timeout(300)
    r = await E("()=>({k:PV218.kind,tag:!!document.querySelector('.e-player .pv218b'),n:(S.ed.vfx||[]).length})")
    chk(f"{tag}: moving away clears the preview", r["k"] is None and not r["tag"] and r["n"] == n0, r)
    await pg.mouse.click(box[0], box[1]); await pg.wait_for_timeout(400)
    r = await E("()=>({n:(S.ed.vfx||[]).length,k:(S.ed.vfx||[]).slice(-1)[0]?.kind})")
    chk(f"{tag}: a tap still adds it", r["n"] == n0 + 1 and r["k"] == "snow", r)
    # ---- 3. tighter
    await E("()=>{edSetPick(null);S.ed.selText=null;S.ed.lt143='effects';S.ed.tab='vfx';renderView()}"); await pg.wait_for_timeout(300)
    r = await E("""()=>{const h=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().height):-1},w=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().width):-1};
      return{logo:h('.ws216logo svg'),top:h('.ed143>.e-top'),rail:h('.e-rail button svg'),ftiles:getComputedStyle(document.querySelector('.e-details .ftiles')).gridTemplateColumns.split(' ').length,ftile:h('.e-details .ftile'),over:document.documentElement.scrollWidth-innerWidth}}""")
    chk(f"{tag}: tighter — a small logo and top bar, 16 px rail icons, platform tiles three a row and short", 0 < r["logo"] <= 24 and r["top"] <= 56 and r["rail"] == 16 and r["ftiles"] == 3 and 0 < r["ftile"] <= 96 and r["over"] <= 1, r)
    await E("()=>{S.ed.lt143='effects';S.ed.tab='vfx';renderView()}"); await pg.wait_for_timeout(500)
    await pg.screenshot(path=os.environ.get("SHOT218", D + "/fx.png"))
    await E(PICK, "t1"); await pg.wait_for_timeout(400); await pg.screenshot(path=os.environ.get("SHOT218T", D + "/text.png"))
    chk(f"{tag}: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        try: await run(p)
        except Exception as e: fails.append("crashed: " + repr(e)[:500])
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:4000])
print("v218 OK" if not fails else "v218 FAIL")
sys.exit(1 if fails else 0)
