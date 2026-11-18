# v174 — notifications on phones come down from the top, across the screen. In a real browser (file://, no server), phone in
# English and Arabic, and a computer:
#  · phone: a notification sits at the top (under the notch area), 8 px from each side, over the top bar and over an open sheet;
#    it slides down when it appears; the text, the × and an action button fit; it goes away by itself, with its ×, and with a
#    swipe up; while hidden it doesn't catch taps on the top bar
#  · computer: unchanged — at the bottom, in the middle, not across the screen
# Run: python3 tests/v174.py
import asyncio, json, os, pathlib, sys
from playwright.async_api import async_playwright
PAGE = pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
SET = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'G',method:'google'};S.myPlan='studio';AU.showAuth=false;S.lang=l;go('home');renderAll()}"
BOX = """()=>{const t=document.getElementById('toast'),r=t.getBoundingClientRect(),c=getComputedStyle(t),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  return {show:t.classList.contains('show'),top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(innerWidth-r.right),w:Math.round(r.width),h:Math.round(r.height),vw:innerWidth,vh:innerHeight,
    op:+c.opacity,onTop:!!(hit&&hit.closest('#toast')),x:!!t.querySelector('.tx81'),act:!!t.querySelector('.tact'),wide:document.documentElement.scrollWidth<=innerWidth+1}}"""

async def phone(p, lang):
    tag = f"phone {lang}"
    b = await p.chromium.launch(); c = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await c.new_page(); E = pg.evaluate
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
    await pg.goto(PAGE); await pg.wait_for_timeout(600); await E(SET, lang); await pg.wait_for_timeout(500); R = {}
    # while hidden it doesn't catch taps at the top
    hid = await E("()=>{const h=document.elementFromPoint(innerWidth/2,30);return {hit:h&&!h.closest('#toast'),show:document.getElementById('toast').classList.contains('show')}}")
    ok(hid["hit"] and not hid["show"], f"{tag}: a hidden notification doesn't catch taps on the top bar {hid}")
    msg = "تم حفظ المشروع — يمكنك فتحه من أي جهاز." if lang == "ar" else "Saved — you can open this project on any device."
    await E("(m)=>toast(m,{ms:6000})", msg); await pg.wait_for_timeout(60)
    early = await E("()=>{const t=document.getElementById('toast');return Math.round(parseFloat(getComputedStyle(t).translate.split(' ')[1]||'0'))}")
    await pg.wait_for_timeout(450); a = await E(BOX); R["shown"] = a; R["slide"] = early
    ok(a["show"] and a["top"] <= 24 and a["left"] == 8 and a["right"] == 8 and a["w"] >= a["vw"] - 17 and a["op"] > .95 and a["onTop"] and a["wide"], f"{tag}: at the top, across the screen, over the top bar {a}")
    ok(early < 0, f"{tag}: it slides down as it appears (translate {early} px a moment in)")
    # a long one with an action and the ×: still small enough, still at the top, over an open sheet
    await E("()=>{hfSheet('Test','<p>sheet</p>')}"); await pg.wait_for_timeout(300)
    long = ("تعذّر إنشاء صوت الأفاتار الآن — لم يُخصم شيء. حاول بعد دقيقة، أو أضف ملفاً صوتياً." if lang == "ar" else "The avatar's voice couldn't be made right now — nothing was charged. Try again in a minute, or add a voice file.")
    await E("(m)=>toast(m,{ms:8000,action:S.lang==='ar'?'حاول مجدداً':'Try again',onAction:()=>{}})", long); await pg.wait_for_timeout(450); l = await E(BOX); R["long"] = l
    ok(l["show"] and l["top"] <= 24 and l["h"] < 140 and l["x"] and l["act"] and l["onTop"] and l["w"] >= l["vw"] - 17, f"{tag}: a long one with Try again and × fits, above the open sheet {l}")
    await E("()=>closeSheet()")
    # swipe up puts it away
    await E("(m)=>toast(m,{ms:8000})", msg); await pg.wait_for_timeout(450); r = await E(BOX)
    cdp = await c.new_cdp_session(pg); x, y = r["vw"] / 2 - 60, r["top"] + r["h"] / 2
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
    for k in range(1, 7): await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y - 10 * k}]}); await pg.wait_for_timeout(16)
    mid = await E("()=>document.getElementById('toast').style.translate")
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(350)
    s = await E("()=>document.getElementById('toast').classList.contains('show')"); R["swipe"] = {"mid": mid, "after": s}
    ok("-" in (mid or "") and not s, f"{tag}: a swipe up follows the finger and puts it away {R['swipe']}")
    # a small downward drag or a tap doesn't
    await E("(m)=>toast(m,{ms:8000})", msg); await pg.wait_for_timeout(450)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]}); await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y + 20}]})
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(200)
    ok(await E("()=>document.getElementById('toast').classList.contains('show')"), f"{tag}: pulling down doesn't put it away")
    # its × and its timer still work
    await E("()=>document.querySelector('#toast .tx81').click()"); await pg.wait_for_timeout(250)
    ok(not await E("()=>document.getElementById('toast').classList.contains('show')"), f"{tag}: its × closes it")
    await E("(m)=>toast(m,{ms:900})", msg); await pg.wait_for_timeout(1300)
    ok(not await E("()=>document.getElementById('toast').classList.contains('show')"), f"{tag}: it goes away by itself")
    await pg.screenshot(path=os.environ.get("SHOT_DIR", "/tmp") + f"/v174_{lang}.png") if os.environ.get("SHOT_DIR") else None
    out[tag] = R; ok(not errs, f"{tag}: page errors {errs}"); await b.close()

async def desk(p):
    b = await p.chromium.launch(); c = await b.new_context(viewport={"width": 1280, "height": 900}); pg = await c.new_page(); E = pg.evaluate
    await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
    await pg.goto(PAGE); await pg.wait_for_timeout(600); await E(SET, "en"); await pg.wait_for_timeout(400)
    await E("()=>toast('Saved — you can open this project on any device.',{ms:6000})"); await pg.wait_for_timeout(450); d = await E(BOX); out["desk"] = d
    ok(d["show"] and d["bottom"] > d["vh"] - 200 and d["w"] < 600 and abs(d["left"] - d["right"]) <= 2, f"computer: unchanged — at the bottom, in the middle {d}")
    await b.close()

async def main():
    async with async_playwright() as p:
        for lang in ("en", "ar"):
            try: await phone(p, lang)
            except Exception as e: fails.append(f"phone {lang} crashed: {e!r}"[:300])
        try: await desk(p)
        except Exception as e: fails.append(f"desk crashed: {e!r}"[:300])
asyncio.run(main())
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1)[:5000])
print("v174 ok" if not fails else f"FAILED {len(fails)}"); sys.exit(1 if fails else 0)
