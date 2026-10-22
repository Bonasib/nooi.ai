# v122 in a real browser with a real nooi server (computer, Arabic phone) — everything in its place:
#  · Video from pictures is in Video (after UGC ads), in Video's colour; Edit keeps Video editor · Visual effects · Enhance ·
#    Video intelligence; All tools lists it under Video
#  · Home's tools: one card per tool in the header's order, no two with the same name, Motion Control · Voice & audio ·
#    Schedule & publish among them
#  · Account & plan: Plan · Top-up & usage (v123: not "Credits", the name of the page beside it) · Brand · Preferences ·
#    Sign-in & data, in that order, with the bar of its parts under the
#    title (English, Arabic); a tap goes to the part and marks it; the moved blocks still work
#  · Voice & audio: the voice-over first, then the voice library, your voices, design · lip sync · music, the audio lab last;
#    its bar names its own headings
#  · the bar stays in view while scrolling; nothing wider than the screen
# Run: python3 tests/v122.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8336
D = tempfile.mkdtemp(prefix="nooi-v122-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SC = "const sc=()=>{const m=document.getElementById('main');return m.scrollHeight>m.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(m).overflowY)?m:document.scrollingElement};"

async def run(b, W, H, lang, tag):
    ctx = await b.new_context(viewport={"width": W, "height": H}, is_mobile=W < 600, has_touch=W < 600); pg = await ctx.new_page(); E = pg.evaluate; errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}", lang)
    out[tag] = {}
    # the places of the tools
    t = await E("""()=>{const tabs=v=>{go(v);renderAll();return [...document.querySelectorAll('#main>.view>.hubtabs [data-go]')].map(b=>b.dataset.go)};
      const r={video:tabs('video'),edit:tabs('edit'),slide:tabs('slideshow'),sec:(go('slideshow'),renderAll(),document.body.dataset.sec90),secVideo:(go('video'),renderAll(),document.body.dataset.sec90)};
      go('apps');renderAll();r.apps=Object.fromEntries([...document.querySelectorAll('#main .apps90s')].map(s=>[s.dataset.sec90,[...s.querySelectorAll('[data-go]')].map(x=>x.dataset.go)]));
      go('home');renderAll();const cards=[...document.querySelectorAll('#main .toolgrid [data-go]')];r.home=cards.map(c=>c.dataset.go);r.names=cards.map(c=>(c.querySelector('b')||c).textContent.trim());return r}""")
    out[tag]["places"] = t
    ok(t["video"] == ["video", "motion", "ugcads", "slideshow", "story", "board"] and t["slide"] == t["video"], f"{tag}: Video from pictures is in Video, after UGC ads {t['video']} {t['slide']}")
    ok(t["edit"] == ["edit", "fx", "finish", "vss"], f"{tag}: Edit keeps what works on a video you have {t['edit']}")
    ok(t["sec"] == t["secVideo"] and "slideshow" in t["apps"].get(t["secVideo"], []) and not any("slideshow" in v for k, v in t["apps"].items() if k != t["secVideo"]), f"{tag}: in Video's colour, listed under Video on All tools {t['sec']} {t['apps']}")
    ok(t["home"] == ["image", "sketch", "video", "motion", "ugcads", "voice", "chars", "world", "edit", "calendar"] and len(set(t["names"])) == len(t["names"]), f"{tag}: Home's tools — one card per tool in the header's order, no two names alike {t['home']} {t['names']}")
    # Account & plan: five parts in order, the bar under the title
    a = await E("""()=>{go('account');renderAll();const V=document.querySelector('#main>.view'),k=[...V.children],ix=s=>k.findIndex(c=>c.matches(s)||!!c.querySelector(s)),bar=V.querySelector('.secbar122');
      return {bar:bar?[...bar.querySelectorAll('button')].map(b=>b.textContent):[],afterTitle:!!bar&&k.indexOf(bar)<ix('[data-act="signout"]'),
        order:[ix('[data-act="signout"]'),ix('[data-set="currency"]'),ix('#coupon'),ix('#brandkit'),ix('[data-act="view-landing"]'),ix('[data-act="ui-set"]'),ix('[data-set="routing.mode"]'),ix('[data-act="lai-toggle"]'),ix('[data-act="export-json"]'),ix('#devpanel')],
        panels:V.querySelectorAll('.panel.set').length}}""")
    out[tag]["account"] = a
    want = {"en": ["Plan", "Top-up & usage", "Brand", "Preferences", "Sign-in & data"], "ar": ["الباقة", "الشحن والاستهلاك", "العلامة", "التفضيلات", "الدخول والبيانات"]}[lang]
    ok(a["bar"] == want and a["afterTitle"], f"{tag}: Account & plan has the bar of its parts under the title {a['bar']}")
    ok(all(x >= 0 for x in a["order"]) and a["order"] == sorted(a["order"]) and a["panels"] >= 10, f"{tag}: Account & plan in order — Plan · Top-up & usage · Brand · Preferences · Sign-in & data, nothing lost {a['order']} {a['panels']}")
    # a tap goes to the part and marks it; the bar stays in view
    await pg.click('#main .secbar122 [data-sec122="3"]'); await pg.wait_for_timeout(1200)
    g = await E("""()=>{const p=document.querySelector('#main [data-act="ui-set"]').closest('.panel'),bar=document.querySelector('#main .secbar122'),r=p.getBoundingClientRect(),br=bar.getBoundingClientRect();
      return {top:Math.round(r.top),barTop:Math.round(br.top),barBottom:Math.round(br.bottom),cur:(bar.querySelector('[aria-current="true"]')||{}).dataset?.sec122,wide:document.documentElement.scrollWidth-innerWidth}}""")
    out[tag]["go"] = g
    ok(g["top"] >= g["barBottom"] - 2 and g["top"] < 260 and g["cur"] == "3" and 40 <= g["barTop"] <= 90 and g["wide"] <= 1, f"{tag}: a tap goes to Preferences, marks it, and the bar stays in view under the top bar {g}")
    # the moved blocks still work: the currency switch
    cur0 = await E("()=>S.currency||S.cur||null")
    await E(SC + "sc().scrollTop=0"); await pg.wait_for_timeout(200)
    btn = await E("""()=>{const b=[...document.querySelectorAll('#main [data-set="currency"]')].find(x=>x.getAttribute('aria-pressed')!=='true'&&!x.classList.contains('on'));return b?b.dataset.val:null}""")
    if btn:
        await pg.click(f'#main [data-set="currency"][data-val="{btn}"]'); await pg.wait_for_timeout(300)
        sel = await E("""(v)=>{const b=document.querySelector('#main [data-set="currency"][data-val="'+v+'"]');return b&&(b.getAttribute('aria-pressed')==='true'||b.classList.contains('on')||b.getAttribute('aria-selected')==='true')}""", btn)
        ok(sel, f"{tag}: a moved block still works (currency switch to {btn})")
    # Voice & audio: the voice-over first, the audio lab last, its bar names its own headings
    v = await E("""()=>{go('voice');renderAll();const V=document.querySelector('#main>.view'),k=[...V.children],ix=s=>k.findIndex(c=>c.matches(s)||!!c.querySelector(s)),bar=V.querySelector('.secbar122'),lib=V.querySelector(':scope>.voices');
      return {order:[ix('#ndlg'),k.indexOf(lib),ix('[data-act="vc-open"]'),ix('.two'),ix('#alab')],bar:bar?[...bar.querySelectorAll('button')].map(b=>b.textContent):[],
        heads:[...V.querySelectorAll('h2')].filter(h=>h.offsetParent).map(h=>h.textContent.trim())}}""")
    out[tag]["voice"] = v
    ok(all(x >= 0 for x in v["order"]) and v["order"] == sorted(v["order"]), f"{tag}: Voice & audio — voice-over, the library, your voices, design · lip sync · music, the audio lab last {v['order']}")
    ok(len(v["bar"]) >= 5 and all(x in v["heads"] for x in v["bar"]), f"{tag}: its bar names its own headings {v['bar']}")
    ok(not errs, f"{tag}: no page errors {errs[:3]}"); await ctx.close()

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL="http://localhost:9", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            b = await p.chromium.launch(); await run(b, 1440, 900, "en", "computer"); await run(b, 390, 844, "ar", "ar phone"); await b.close()
    finally: srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
