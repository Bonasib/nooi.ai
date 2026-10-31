# v192 — the owner on a phone: "in full screen a swipe down does nothing and a tap stops the video — I want the play button and the
# other buttons to show"; "weak design, consistency, templates, official icons and errors in the dashboard". A real nooi server:
#  · full screen from a result card opens our player in the viewer at the same moment; a finger tap shows / hides the buttons and the
#    video keeps playing; the round button pauses; a swipe down closes it
#  · no blue tap flash
#  · Admin: one line of tabs (same height, short names "Team & roles", "Finance"), the active one in view; the same heading on every tab;
#    the out-of-credits line points to AI providers with a button that goes there
#  · Admin shows what is saved: a key saved elsewhere shows after a tab change or when the page comes back; a save during a read isn't lost
#  · Payments: "On without keys" (and the line saying customers don't see it), a Publishable key refused on save, a pk_ key saved
#    earlier = "Wrong key" (Moyasar's step 1 says so), the Stripe and PayPal logos
# Run: python3 tests/v192.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8648; B = f"http://localhost:{PORT}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v192-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=24:duration=12", "-c:v", "libvpx-vp9", "-b:v", "200k", "-y", D + "/media/t192.webm"], check=True, timeout=120)   # (v208: 12 s — the full-screen checks run past 6 s since full screen moved into the More sheet)
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
SK = "b" * 40
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_", "MINIMAX_", "MOYASAR_", "PAYMENT_", "STRIPE_", "TAP_", "PAYPAL_", "AIRWALLEX_"))}
# a Publishable key saved before this version (the server refuses it now) and Tap switched on without keys
seed = subprocess.run(["node", "--input-type=module", "-e", f"""process.env.SECRET_KEY='{SK}';const s=await import('{ROOT}/lib/settings.js');const st=await import('{ROOT}/lib/store.js');
s.saveCfg('payments','moyasar',{{secretKey:'pk_live_seed192'}});s.S().payments.tap={{enabled:true}};s.S().payments.moyasar.enabled=true;st.save();st.saveNow();process.exit(0)"""], cwd=D, env=dict(env, SECRET_KEY=SK), capture_output=True, text=True, timeout=60)
ok(seed.returncode == 0, "seed: " + seed.stderr[-300:])
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY=SK, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL="https://nooi.test", FREE_PERIOD="false", NV_AUTOCHECK="false", PAY_CHECK_FIRST_MS="600000"),
                       stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
def api(p, body=None, method=None):
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json"}, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=60).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}

def server_part():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    p = api("/v1/admin/settings")[1]["payments"]; out["p0"] = {k: [v["enabled"], v["configured"], v.get("keyOk")] for k, v in p.items()}
    ok(p["moyasar"]["keyOk"] is False and p["tap"]["enabled"] and not p["tap"]["configured"] and p["stripe"]["keyOk"] is True, f"server flags: {out['p0']}")
    c, r = api("/v1/admin/payments/stripe", {"secretKey": "pk_test_abc"}, method="PUT"); ok(c == 400 and "Publishable" in r.get("error", "") and "pk_" in r.get("errorAr", ""), f"a pk_ key is refused: {c} {r}")
    ok(api("/v1/admin/settings")[1]["payments"]["stripe"]["configured"] is False, "nothing saved after the refusal")
    s = api("/v1/admin/pay190/moyasar")[1]["key"]; ok(s["done"] is False and s["wrong"] is True, f"Moyasar step 1 with a pk_ key: {s}")

async def video_part(p):
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate; R_ = {}
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E("()=>{S.lang='en';S.user=S.user||{name:'Owner',method:'email',contact:'owner@nooi.ai'};S.jobs.unshift({id:'v192',remote:'',kind:'video',status:'complete',resultUrl:'/media/t192.webm',prompt:'A test card',model:'kling',created:Date.now(),aspect:'16:9',dur:6});S.hf.out=['v192'];S.hf.tab='video';persist();go('home')}")
        await pg.wait_for_selector('.hfrm video', timeout=15000)   # (v203: full screen is in the card's More sheet)
        R_["tap0"] = await E("()=>getComputedStyle(document.documentElement).webkitTapHighlightColor")
        ok(R_["tap0"] in ("rgba(0, 0, 0, 0)", "transparent"), f"no blue tap flash: {R_['tap0']}")
        # the card's video plays to ~2 s, then full screen
        await E("()=>{const v=document.querySelector('.hfrm video');v.muted=true;return v.play()}"); await pg.wait_for_function("document.querySelector('.hfrm video').currentTime>1.5", timeout=15000)
        await pg.tap('.hfrc [data-act="more203"]'); await pg.wait_for_selector('#modalRoot [data-act="full203"]', timeout=5000); await pg.tap('#modalRoot [data-act="full203"]'); await pg.wait_for_selector(".mv80.fs192 .vp87 video", timeout=10000)
        await pg.wait_for_function("(()=>{const v=document.querySelector('.mv80.fs192 video');return v&&v.readyState>=2&&v.currentTime>1.2})()", timeout=10000)
        st = await E("()=>{const v=document.querySelector('.mv80.fs192 video'),c=document.querySelector('.hfrm video');return {t:v.currentTime,card:c.paused,player:!!v.closest('.vp87')}}"); R_["fs"] = st
        ok(st["t"] > 1.2 and st["card"] and st["player"], f"full screen = our player from the same moment, the card stopped: {st}")
        await E("()=>{const v=document.querySelector('.mv80.fs192 video');v.muted=true;return v.play()}"); await pg.wait_for_timeout(3200)   # (the buttons hide while it plays)
        box = await pg.locator(".mv80.fs192 video").bounding_box()
        hid = await E("()=>document.querySelector('.mv80.fs192 .vp87').classList.contains('show')")
        await pg.touchscreen.tap(box["x"] + box["width"] * 0.3, box["y"] + box["height"] * 0.3); await pg.wait_for_timeout(250)
        a = await E("()=>{const w=document.querySelector('.mv80.fs192 .vp87'),v=w.querySelector('video');return {show:w.classList.contains('show'),paused:v.paused,big:getComputedStyle(w.querySelector('.vpbig')).opacity}}")
        await pg.touchscreen.tap(box["x"] + box["width"] * 0.3, box["y"] + box["height"] * 0.3); await pg.wait_for_timeout(250)
        b = await E("()=>{const w=document.querySelector('.mv80.fs192 .vp87'),v=w.querySelector('video');return {show:w.classList.contains('show'),paused:v.paused}}")
        R_["taps"] = [hid, a, b]
        ok(not hid and a["show"] and not a["paused"] and a["big"] == "1" and not b["show"] and not b["paused"], f"a tap shows the buttons, a second hides them, the video keeps playing: {R_['taps']}")
        await pg.touchscreen.tap(box["x"] + box["width"] * 0.3, box["y"] + box["height"] * 0.3); await pg.wait_for_timeout(200)
        await pg.tap(".mv80.fs192 .vpbig"); await pg.wait_for_timeout(200)
        ok(await E("()=>document.querySelector('.mv80.fs192 video').paused"), "the round button pauses")
        # swipe down closes the viewer
        await E("""()=>{const v=document.querySelector('.mv80.fs192 video'),r=v.getBoundingClientRect(),x=r.left+r.width/2;
          const T=(y)=>new Touch({identifier:1,target:v,clientX:x,clientY:y});v.dispatchEvent(new TouchEvent('touchstart',{touches:[T(r.top+20)],changedTouches:[T(r.top+20)],bubbles:true}));
          v.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[T(r.top+220)],bubbles:true}))}""")
        await pg.wait_for_timeout(300); R_["closed"] = await E("()=>!document.querySelector('.mv80')")
        ok(R_["closed"], "a swipe down closes the full-screen viewer")
        # on a computer a click on the picture still plays / pauses
        ok(not errs, f"video: page errors {errs[:3]}")
    finally:
        out["video"] = R_; await br.close()

async def admin_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"; R_ = {}
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone, color_scheme="light")
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';S.theme='light';applyTheme();document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=S.user||{{name:'Owner',method:'email',contact:'owner@nooi.ai'}};S.admTab='team';persist();go('admin')}}")
        await pg.wait_for_function("!!ADM.data&&!!document.querySelector('.admh192')", timeout=20000); await pg.wait_for_timeout(3000)
        await E("()=>{AL138={since:Date.now()-3600e3,last:Date.now(),count:7,type:'quota'};renderView()}")
        v = await E("""()=>{const bar=document.querySelector('.admtabs'),bs=[...bar.querySelectorAll('[data-act=adm-tab]')],act=bar.querySelector('[aria-pressed=true]'),br=bar.getBoundingClientRect(),ar=act.getBoundingClientRect(),W=innerWidth;
          return {hs:[...new Set(bs.map(b=>Math.round(b.getBoundingClientRect().height)))],tops:[...new Set(bs.map(b=>Math.round(b.getBoundingClientRect().top)))].length,labels:bs.map(b=>b.innerText.trim()),
            inView:ar.left>=br.left-1&&ar.right<=br.right+1,head:(document.querySelector('.admh192 h2')||{}).innerText,al:(document.querySelector('.al138')||{}).innerText||'',
            wide:[...document.querySelectorAll('.view > *')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>W+1||b.left<-1)}).length}}""")
        R_.update({k: v[k] for k in ("hs", "tops", "inView", "head", "wide")}); R_["labels"] = v["labels"]
        ok(len(v["hs"]) == 1 and v["tops"] == 1 and v["inView"] and not v["wide"], f"{tag}: one line of tabs, same height, the active one in view: {R_}")
        ok((("الفريق والصلاحيات" in v["labels"] and "المالية" in v["labels"]) if ar else ("Team & roles" in v["labels"] and "Finance" in v["labels"])), f"{tag}: short tab names: {v['labels']}")
        ok(v["head"] and (("الفريق والصلاحيات" in v["head"]) if ar else ("Team & roles" in v["head"])), f"{tag}: the tab's heading: {v['head']}")
        ok(("مزودو الذكاء" in v["al"]) if ar else ("open AI providers" in v["al"] and "Models →" not in v["al"]), f"{tag}: the out-of-credits line: {v['al'][:200]}")
        await pg.click(".al138 [data-go192]"); await pg.wait_for_function("S.admTab==='models'&&!!document.querySelector('.aip184')", timeout=10000)
        # Payments: the flags, the logos
        await E("()=>{S.admTab='payments';renderView()}"); await pg.wait_for_selector(".pay191 .p191row .mset190 .m190l", timeout=15000)
        pv = await E("""()=>{const s=document.querySelector('.pay191'),pill=k=>s.querySelector('.p191row[data-k="'+k+'"] .p191pill').innerText.trim();
          return {moy:pill('moyasar'),tap:pill('tap'),stripeSvg:!!s.querySelector('.p191row[data-k=stripe] .p191logo svg'),paypalSvg:!!s.querySelector('.p191row[data-k=paypal] .p191logo svg'),
            moyM:s.querySelector('.p191row[data-k=moyasar] .p191logo').innerText,top:(s.querySelector('.p191top2')||{}).innerText||'',sum:s.querySelector('.p191sum').innerText,
            step1:(s.querySelector('.mset190 .m190l li')||{}).innerText||'',moyNote:(document.getElementById('p191n-moyasar')||{}).innerText||''}}""")
        R_["pay"] = pv
        ok(pv["moy"] == ("مفتاح خاطئ" if ar else "Wrong key") and pv["stripeSvg"] and pv["paypalSvg"] and pv["moyM"] == "M" and ("pk_" in pv["moyNote"]) and ("sk_test_" in pv["step1"]), f"{tag}: Moyasar's wrong key, the logos, step 1: {pv}")
        if ar: ok(not errs, f"{tag}: page errors {errs[:3]}"); await pg.screenshot(path=D + f"/{tag}.png"); return
        ok(pv["tap"] == "On without keys" and pv["top"] and pv["sum"].replace(" ", "").startswith("0on·0live"), f"{tag}: Tap on without keys, the line above, nothing counted on (a pk_ key isn't): {pv}")
        # what is saved elsewhere shows: a tab change refreshes (stale), the page coming back refreshes
        api("/v1/admin/payments/airwallex", {"clientId": "cid" + tag, "apiKey": "ak192"}, method="PUT")
        before = await E("()=>!!(A().payments.airwallex||{}).configured")
        await E("()=>{ADM.at=Date.now()-60000}"); await pg.click('.admtabs [data-v="overview"]')
        await pg.wait_for_function("!!(A().payments.airwallex||{}).configured", timeout=10000)
        api("/v1/admin/payments/paypal", {"clientId": "pp" + tag, "secret": "s192"}, method="PUT")
        await E("()=>{ADM.at=Date.now()-60000;document.dispatchEvent(new Event('visibilitychange'))}")
        await pg.wait_for_function("!!(A().payments.paypal||{}).configured", timeout=10000)
        # a save that lands while a read is in flight is not lost
        await E("()=>{window.__p=admLoad();}"); api("/v1/admin/payments/tap", {"secretKey": "sk_test_tap" + tag}, method="PUT"); await E("()=>admLoad()")
        await pg.wait_for_function("!ADM.loading&&!!(A().payments.tap||{}).configured", timeout=10000)
        R_["fresh"] = [before, True]
        ok(before is False, f"{tag}: the key saved elsewhere wasn't there before the refresh")
        await pg.screenshot(path=D + f"/{tag}.png")
        ok(not errs, f"{tag}: page errors {errs[:3]}")
    finally:
        out[tag] = R_; await br.close()

async def pages():
    async with async_playwright() as p:
        await video_part(p)
        await admin_part(p, True, "en")
        await admin_part(p, False, "ar")

try:
    server_part()
    asyncio.run(pages())
finally:
    srv.terminate(); srv.wait()
print(json.dumps(out, ensure_ascii=False, indent=1)[:4000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + "/server.log").read()[-2000:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v192 OK")
