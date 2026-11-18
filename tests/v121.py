# v121 in a real browser with a real nooi server (computer, Arabic phone, "reduce motion"):
#  · titles: page titles stay v90's sizes, weight 600, a tighter spacing in English (none in Arabic); the Home headline larger
#  · a highlighted word: the Home headline's last word (create · تصنع) — its text unchanged; the light and the marker line play
#    when Home opens and never again on a redraw
#  · word effects: a page's title words fade in one after another when it opens (its text unchanged); a redraw later shows it still; the Home,
#    Video and Images prompt boxes type example ideas where the hint is after 4 s — the box stays empty, its own hint kept (Home's
#    rotates by itself),
#    and clicking into it stops them; with "reduce motion" none of it runs
# Run: python3 tests/v121.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8334
D = tempfile.mkdtemp(prefix="nooi-v121-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
HERO = """()=>{const h=document.querySelector('#main .hfhero h1'),w=h&&h.querySelector('.hl121');return h?{text:h.textContent,word:w&&w.textContent,size:parseFloat(getComputedStyle(h).fontSize),weight:getComputedStyle(h).fontWeight,
  words:h.querySelectorAll('.w121').length,go:!!(w&&w.classList.contains('go121')),anim:w?getComputedStyle(w).animationName:'',line:w?getComputedStyle(w,'::after').scale:''}:null}"""
TW = """(id)=>{const t=document.getElementById(id),b=document.querySelector('.tw121');const r=t&&t.getBoundingClientRect(),q=b&&b.getBoundingClientRect();
  return {val:t?t.value:null,ph:t?t.placeholder:null,text:b?b.textContent:'',on:!!(t&&t.classList.contains('tw121on')),inside:!!(r&&q&&q.left>=r.left-1&&q.right<=r.right+1&&q.top>=r.top-1&&q.top<r.bottom),dir:b?getComputedStyle(b).direction:''}}"""

async def start(b, W, H, lang, reduce=False):
    ctx = await b.new_context(viewport={"width": W, "height": H}, is_mobile=W < 600, has_touch=W < 600, reduced_motion="reduce" if reduce else "no-preference")
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await pg.evaluate("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';go('apps');renderAll()}", lang)
    await pg.wait_for_timeout(900); return ctx, pg, errs

async def run(b, W, H, lang, tag):
    ctx, pg, errs = await start(b, W, H, lang); E = pg.evaluate; out[tag] = {}
    ex = await E("(l)=>({agent:EX121.agent.map(x=>l==='ar'?x[1]:x[0]),video:EX98.video.map(x=>l==='ar'?x[1]:x[0])})", lang)
    # Home opens: the headline's words fade in, its last word highlighted, its text unchanged
    await E("()=>{go('home');renderAll()}"); await pg.wait_for_timeout(60); h0 = await E(HERO)
    await pg.wait_for_timeout(2400); h1 = await E(HERO)
    await E("()=>renderView()"); await pg.wait_for_timeout(80); h2 = await E(HERO)
    out[tag]["hero"] = [h0, h1, h2]; want = {"en": ("What do you want to create?", "create"), "ar": ("ماذا تريد أن تصنع؟", "تصنع")}[lang]
    ok(h0 and h0["text"] == want[0] and h0["word"] == want[1] and h0["words"] >= 4 and h0["go"], f"{tag}: Home opens — the headline's words fade in, its last word highlighted, its text unchanged {h0}")
    ok(h1 and h1["line"] in ("1", "1 1", "none"), f"{tag}: the marker line is drawn under the word {h1 and h1['line']}")
    ok(h2 and h2["word"] == want[1] and not h2["go"] and h2["anim"] == "none" and h2["words"] == 0, f"{tag}: a redraw shows the headline still — nothing plays again {h2}")
    ok(h2 and h2["weight"] == "600" and h2["size"] >= (34 if W < 600 else 48), f"{tag}: the Home headline is a display title {h2}")
    # the prompt box: the usual hint first, then example ideas typed where it is; the box stays empty
    await E("()=>{go('apps');renderAll()}"); await pg.wait_for_timeout(300); await E("()=>{go('home');renderAll()}"); await pg.wait_for_timeout(1500)
    t0 = await E(TW, "hfq"); await pg.wait_for_timeout(5200); t1 = await E(TW, "hfq")
    out[tag]["home typing"] = [t0, t1]; out[tag]["ex"] = ex
    ok(not t0["on"] and not t0["text"], f"{tag}: the box's own hint shows first {t0}")
    ok(t1["on"] and t1["text"] and any(x.startswith(t1["text"]) for x in ex["video"]) and t1["val"] == "" and bool(t1["ph"]) and t1["inside"] and t1["dir"] == ("rtl" if lang == "ar" else "ltr"),
       f"{tag}: then example ideas are typed where the hint is — the box stays empty, its own hint kept {t1}")
    await pg.click("#hfq"); await pg.wait_for_timeout(200); t2 = await E(TW, "hfq")
    ok(not t2["on"] and not t2["text"], f"{tag}: clicking into the box stops them {t2}")
    await pg.keyboard.type("a fox"); await pg.wait_for_timeout(300); await E("()=>document.activeElement.blur()"); await pg.wait_for_timeout(4800); t3 = await E(TW, "hfq")
    ok(not t3["on"] and t3["val"] == "a fox", f"{tag}: with words in the box, nothing is typed over them {t3}")
    await E("()=>{const t=document.getElementById('hfq');t.value='';t.dispatchEvent(new Event('input',{bubbles:true}));S.hf.prompt='';persist()}")
    # Video: its own examples
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(6200); tv = await E(TW, "dprompt"); out[tag]["video typing"] = tv
    ok(tv["on"] and tv["text"] and any(x.startswith(tv["text"]) for x in ex["video"]) and tv["val"] == "", f"{tag}: Video types its own example ideas {tv}")
    # a page title: its words fade in when it opens, its text and size unchanged
    await E("()=>{go('motion');renderAll()}"); await pg.wait_for_timeout(60)
    ti = await E("""()=>{const h=document.querySelector('#main>.view h1');const c=getComputedStyle(h);return {text:h.textContent.trim(),words:h.querySelectorAll('.w121').length,icon:!!h.querySelector('.tchip90'),size:parseFloat(c.fontSize),weight:c.fontWeight,ls:c.letterSpacing}}""")
    out[tag]["title"] = ti
    ok(ti["words"] >= 2 and ti["icon"] and ti["size"] == (22 if W < 600 else 27) and ti["weight"] == "600", f"{tag}: a page's title words fade in when it opens; its icon, size (v90) and weight {ti}")
    ok((ti["ls"] in ("normal", "0px")) if lang == "ar" else ti["ls"].startswith("-"), f"{tag}: tighter spacing in English only (Arabic letters stay joined) {ti['ls']}")
    ok(not errs, f"{tag}: no page errors {errs[:3]}"); await ctx.close()

async def reduced(b):
    tag = "reduce motion"; ctx, pg, errs = await start(b, 1440, 900, "en", True); E = pg.evaluate
    await E("()=>{go('home');renderAll()}"); await pg.wait_for_timeout(60); h = await E(HERO)
    await pg.wait_for_timeout(6000); t = await E(TW, "hfq"); out[tag] = {"hero": h, "typing": t}
    ok(h and h["word"] == "create" and h["words"] == 0 and not h["go"] and h["line"] in ("1", "1 1", "none"), f"{tag}: the word is highlighted and underlined, nothing moves {h}")
    ok(not t["on"] and not t["text"] and t["ph"], f"{tag}: the box keeps its own hint — nothing is typed {t}")
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
            b = await p.chromium.launch(); await run(b, 1440, 900, "en", "computer"); await run(b, 390, 844, "ar", "ar phone"); await reduced(b); await b.close()
    finally: srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
