# v210 — ready to post · several sizes at once · the post's words (the editor's Export panel).
#  · Ready to post on the format picked: the length the app takes (cut to it), words and captions under the app's own buttons
#    (moved inside, captions lifted), a hook in the first 2 s (a title added), captions, loudness at -14 LUFS (measured, set),
#    bars around a clip of another shape (blurred background) — each check with its one-tap fix
#  · the app's zones per app in the guide over the preview (Shorts 3 zones, Stories 2)
#  · several sizes at once: this edit exported again in each size ticked, the format put back after
#  · the post's words from the edit's own words (hook + hashtags), counted per app (X 280 → over), copied
#  · the panel fits a 390 px phone in Arabic, no page errors
# Run: python3 tests/v210.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8676; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v210-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
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


async def run(p, lang, w, h):
    tag = f"{lang} {w}"; b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); mob = w < 700
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []; E = pg.evaluate
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await E(SETUP, lang); await pg.wait_for_function("S.ed.clips.length===1&&document.querySelector('#wk')&&M['c_'+S.ed.clips[0].id]&&srcReady(M['c_'+S.ed.clips[0].id])", timeout=25000); await pg.wait_for_timeout(500)
    await E("""()=>{const E=S.ed;E.format='shorts';E.texts=[{id:'t1',text:'Big summer sale',start:.5,end:4,pos:'bottom',style:'caption',size:9,anim:'pop'}];
      E.caps={on:true,words:[{s:.2,e:.6,w:'Hello'},{s:.6,e:1,w:'summer'},{s:1,e:1.5,w:'friends.'},{s:1.6,e:2,w:'Summer'},{s:2,e:2.5,w:'deals'},{s:2.5,e:3,w:'today'}],style:'pop',pos:'bottom',size:7,per:3};persist()}""")
    await E(TAB, "export"); await pg.wait_for_timeout(500)
    st = lambda: E("()=>Object.fromEntries([...document.querySelectorAll('#rd210 li')].map(li=>[li.dataset.k,li.className]))")
    r = await E("()=>({h:(document.querySelector('#rd210 .rd210h')||{}).textContent,n:document.querySelectorAll('#rd210 li').length,over:document.documentElement.scrollWidth-innerWidth,wide:[...document.querySelectorAll('.rd210 *,.mu210 *,.pw210 *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>innerWidth+1||r.left<-1)}).length})")
    chk(f"{tag}: Ready to post sits in the Export panel and fits", r["n"] >= 5 and (("Shorts" in (r["h"] or "")) if lang == "en" else ("شورتس" in (r["h"] or ""))) and r["over"] <= 1 and not r["wide"], r)
    # ---- words under the app's buttons → moved inside
    r = await st(); chk(f"{tag}: a big bottom text and the captions are under Shorts' buttons", r.get("zone") == "warn", r)
    await pg.click('#rd210 [data-act="rd210"][data-v="zone"]'); await pg.wait_for_timeout(300)
    r = await E("()=>({y:S.ed.texts[0].y,cy:S.ed.caps.y210,bad:inZone210().length})"); s2 = await st()
    chk(f"{tag}: Move inside lifts the text and the captions out of the zones", r["bad"] == 0 and r["y"] is not None and r["y"] < .74 and r["cy"] and r["cy"] < .76 and s2.get("zone") == "ok", [r, s2])
    if lang == "en":
        # ---- the guide shows the zones of the app picked
        r = await E("()=>{S.ed.guides143='short';renderView();const a=document.querySelectorAll('.gd143 rect.ko').length;S.ed.format='igstory';renderView();const b=document.querySelectorAll('.gd143 rect.ko').length;S.ed.format='shorts';S.ed.guides143='off';renderView();return{a,b}}")
        chk(f"{tag}: the guide draws each app's own zones (Shorts 3, Stories 2)", r["a"] == 3 and r["b"] == 2, r)
        # ---- too long → cut to the app's limit
        await E("()=>{MAX210.shorts=4;renderView()}"); await pg.wait_for_timeout(200); r = await st()
        chk(f"{tag}: longer than the app takes is flagged", r.get("len") == "warn", r)
        await pg.click('#rd210 [data-act="rd210"][data-v="len"]'); await pg.wait_for_timeout(300)
        r = await E("()=>({T:edTotal(),cls:document.querySelector('#rd210 li[data-k=len]').className})"); await E("()=>{MAX210.shorts=180;renderView()}")
        chk(f"{tag}: Cut to the limit cuts the edit to it", abs(r["T"] - 4) < .1 and r["cls"] == "ok", r)
        # ---- no hook → a hook title at the start
        await E("()=>{S.ed.texts=[];S.ed.caps.on=false;renderView()}"); await pg.wait_for_timeout(200); r = await st()
        chk(f"{tag}: nothing to read in the first 2 s is flagged, captions off too", r.get("hook") == "warn" and r.get("caps") == "todo", r)
        await pg.click('#rd210 [data-act="rd210"][data-v="hook"]'); await pg.wait_for_timeout(300)
        r = await E("()=>({t:S.ed.texts.map(x=>[x.text,x.start,x.end,x.y]),hook:hasHook210(),bad:inZone210().length})")
        chk(f"{tag}: Add a hook title puts a title at 0 s, clear of the app's buttons", r["hook"] and r["t"] and r["t"][0][1] == 0 and r["t"][0][2] >= 1 and r["bad"] == 0 and r["t"][0][0], r)
        await E("()=>{S.ed.caps.on=true;renderView()}")
        # ---- loudness: measure, then set to -14
        await pg.click('#rd210 [data-act="rd210"][data-v="measure"]'); await pg.wait_for_function("LD193.v!=null", timeout=20000); await pg.wait_for_timeout(300)
        r = await E("()=>({v:LD193.v,cls:document.querySelector('#rd210 li[data-k=loud]').className})")
        if r["cls"] == "warn":
            await pg.click('#rd210 [data-act="rd210"][data-v="norm"]'); await pg.wait_for_timeout(400)
            r = await E("()=>({v:LD193.v,cls:document.querySelector('#rd210 li[data-k=loud]').className,g:S.ed.gain193,m:mixOf150().master})")
        chk(f"{tag}: loudness measured and set near -14 LUFS", r["v"] is not None and r["cls"] == "ok", r)
        # ---- bars around a wide clip in a tall frame → blurred background
        await E("()=>{S.ed.fit='fit';renderView()}"); await pg.wait_for_timeout(200); r = await st()
        chk(f"{tag}: a wide clip with bars in a tall frame is flagged", r.get("fit") == "warn", [r, await E("()=>S.ed.clips.map(c=>{const m=M['c_'+c.id];return[c.id,S.ed.fit,!!m,m&&m.tagName,m&&(m.videoWidth||m.naturalWidth||m.width),m&&(m.videoHeight||m.naturalHeight||m.height)]})")])
        if r.get("fit") == "warn": await pg.click('#rd210 [data-act="rd210"][data-v="fit"]'); await pg.wait_for_timeout(200)
        r = await E("()=>({fit:S.ed.fit,has:!!document.querySelector('#rd210 li[data-k=fit]'),score:document.querySelector('.rd210s').textContent})")
        chk(f"{tag}: Blurred background fills the frame", r["fit"] == "blur" and not r["has"], r)
        # ---- the post's words
        await pg.click('[data-act="pw210-gen"]'); await pg.wait_for_timeout(250)
        r = await E("()=>({p:S.ed.post210,val:document.querySelector('textarea[data-pw210]').value,n:document.querySelector('.pw210n').textContent})")
        chk(f"{tag}: the post's words come from the edit's own words (hook + hashtags)", r["val"] and "#summer" in r["p"]["tags"] and r["p"]["p"] == "youtube" and "/ 100" in r["n"], r)
        await pg.click('[data-act="pw210-p"][data-v="x"]'); await pg.wait_for_timeout(200)
        await pg.fill("textarea[data-pw210]", "A" * 300); await pg.wait_for_timeout(150)
        r = await E("()=>({n:document.querySelector('.pw210n').textContent,over:document.querySelector('.pw210n').classList.contains('over'),t:S.ed.post210.text.length})")
        chk(f"{tag}: X counts the caption with its hashtags against 280", "/ 280" in r["n"] and r["over"] and r["t"] == 300, r)
        await pg.fill("textarea[data-pw210]", "Summer is here"); await pg.wait_for_timeout(100)
        await ctx.grant_permissions(["clipboard-read", "clipboard-write"])
        await pg.click('[data-act="pw210-copy"]'); await pg.wait_for_timeout(300)
        r = await E("async()=>{let c='';try{c=await navigator.clipboard.readText()}catch(e){c='ERR '+e}return{c,toast:[...document.querySelectorAll('.toast,[role=status]')].map(x=>x.textContent).join('|').slice(0,200)}}")
        chk(f"{tag}: Copy puts the caption and the hashtags on the clipboard", r["c"].startswith("Summer is here") and "#summer" in r["c"], r)
        # ---- several sizes at once
        await pg.click('[data-act="mu210"][data-v="igsq"]'); await pg.wait_for_timeout(200)
        r = await E("()=>({btn:document.querySelector('[data-act=\"mu210-go\"]').textContent,dis:document.querySelector('[data-act=\"mu210-go\"]').disabled,n0:S.jobs.filter(j=>j.kind==='export').length})")
        chk(f"{tag}: a size ticked → Export this + 1 more", "+ 1" in r["btn"] and not r["dis"], r)
        n0 = r["n0"]; await pg.click('[data-act="mu210-go"]')
        await pg.wait_for_function(f"S.jobs.filter(j=>j.kind==='export').length>={n0 + 2}&&!MU210.on", timeout=150000); await pg.wait_for_timeout(400)
        r = await E("()=>({t:S.jobs.filter(j=>j.kind==='export').slice(-2).map(j=>j.title+' '+(j.aspect||'')),f:S.ed.format})")
        chk(f"{tag}: this edit exported in both sizes, the format put back", any("Shorts" in x for x in r["t"]) and any("1:1" in x for x in r["t"]) and r["f"] == "shorts", r)
    else:
        r = await E("()=>({t:document.querySelector('#rd210').innerText,pw:(document.querySelector('#pw210 .lbl')||{}).textContent})")
        chk(f"{tag}: Ready to post and the post's words in Arabic", "جاهز للنشر" in r["t"] and "كلمات المنشور" in (r["pw"] or ""), r)
    chk(f"{tag}: no page errors", not errs, errs)
    await b.close()

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        await run(p, "en", 1280, 860)
        await run(p, "ar", 390, 844)
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
print("v210 OK" if not fails else "v210 FAIL")
sys.exit(1 if fails else 0)
