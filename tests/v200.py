# v200 — Explore worth opening every day. A real nooi server with three shared posts (two videos, a picture; one in the creator
# program, one by another local account through the dev header):
#  · server: comments (post, list, a second account's comment, delete by the author, the policy block, the count call), the creators list
#  · page (desktop + phone, EN + AR): the carousel of six feature cards with dots, the five tool doors, the creators row, the
#    "Recreate with one tap" header, the search that filters the masonry as you type, the comment count on a card
#  · the viewer: a card tap opens one post per screen (as many slides as posts), title + "by", the engine line, the prompt one tap away,
#    heart → likes 1 (and back), the comments sheet → a sent comment raises the count on the slide and the card, share copies a
#    #xp= link, "Recreate · ✦ cost" closes the viewer and lands on Home with the prompt in the box, Escape closes, the deep link opens it
#  · nothing wider than the phone screen; no page errors
# Run: python3 tests/v200.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8658; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v200-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120)
FF("-f", "lavfi", "-i", "testsrc2=s=540x960:rate=24:duration=2", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "300k", "-an", D + "/media/a.webm")
FF("-f", "lavfi", "-i", "color=c=0x335577:s=800x600", "-frames:v", "1", D + "/media/b.png")
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", AGENTS_AUTO_LEARN="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(80):
    try: urllib.request.urlopen(B + "/v1/config", timeout=1); break
    except Exception: time.sleep(0.5)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:500]))
def req(p, body=None, method=None, who=None):
    h = {"Content-Type": "application/json"}; h.update({"X-Dev-User": who} if who else {})
    r = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try: res = urllib.request.urlopen(r, timeout=15); return res.getcode(), json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
# ---- posts
c, p1 = req("/v1/explore", {"url": "/media/a.webm", "kind": "video", "prompt": "A falcon takes off over the desert at sunrise, slow motion", "title": "Desert falcon", "cat": "films", "agree": True, "program": True, "model": "wan22", "aspect": "9:16"})
c2, p2 = req("/v1/explore", {"url": "/media/b.png", "kind": "image", "prompt": "Perfume bottle on wet black glass, studio light", "title": "Perfume on glass", "cat": "ecommerce", "agree": True, "model": "flux"})
c3, p3 = req("/v1/explore", {"url": "/media/a.webm", "kind": "video", "prompt": "Night market in Osaka, neon in puddles", "title": "Osaka night", "cat": "films", "agree": True}, who="maya")
chk("three posts shared", c == 200 and c2 == 200 and c3 == 200 and p1.get("program") and p1.get("creator"), [c, c2, c3, p1])
# ---- comments on the server
c, r = req(f"/v1/explore/{p1['id']}/comments", {"text": "Love the light on the wings"}); chk("comment posted", c == 200 and r.get("count") == 1 and r["item"]["mine"], [c, r])
c, r = req(f"/v1/explore/{p1['id']}/comments", {"text": "Which engine made this?"}, who="maya"); chk("another account comments", c == 200 and r.get("count") == 2 and r["item"]["name"] == "maya", [c, r])
c, r = req(f"/v1/explore/{p1['id']}/comments"); chk("comments listed (public, mine marked for the owner)", c == 200 and len(r.get("items", [])) == 2 and r["items"][0]["mine"] is True and r["items"][1]["mine"] is False, r)
c, r = req(f"/v1/explore/{p1['id']}/comments", {"text": "x"}); chk("one letter refused", c == 400, [c, r])
c, r = req(f"/v1/explore/{p1['id']}/comments", {"text": "buy followers here, click my link, free cocaine deal"}); chk("policy block or accepted (moderation decides), never 500", c in (200, 422), [c, r])
cid = req(f"/v1/explore/{p1['id']}/comments")[1]["items"][1]["id"]
c, r = req(f"/v1/explore/{p1['id']}/comments/{cid}", method="DELETE", who="noor"); chk("a stranger can't delete", c == 403, [c, r])
c, r = req(f"/v1/explore/{p1['id']}/comments/{cid}", method="DELETE", who="maya"); chk("the author deletes", c == 200, [c, r])
n0 = req(f"/v1/explore/{p1['id']}/comments")[1]["items"]
c, r = req("/v1/explore/comments-count"); chk("count call", c == 200 and r.get("counts", {}).get(p1["id"]) == len(n0), [c, r, len(n0)])
c, r = req("/v1/explore/creators"); chk("creators list: the program member, no account ids", c == 200 and len(r.get("items", [])) == 1 and r["items"][0]["pid"] == p1["creator"] and "uid" not in r["items"][0], r)
c, r = req("/v1/explore/nope/comments"); chk("unknown post → 404", c == 404, c)
COUNT0 = len(n0)

SETUP = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';S.xpType='all';S.xpCat='all';renderAll()}"
async def page_checks(pg, tag, lang, phone):
    global COUNT0
    await pg.evaluate(SETUP, lang); await pg.evaluate("()=>{go('discover');renderAll()}")
    await pg.wait_for_function("()=>document.querySelectorAll('.xpgrid .xpcard').length>=3&&document.querySelector('#xpcr200 .xpcr200b')", timeout=20000); await pg.wait_for_timeout(400)
    st = await pg.evaluate("""()=>({cards:document.querySelectorAll('.xph200c').length,dots:document.querySelectorAll('.xph200d i').length,tools:document.querySelectorAll('.xpt200b').length,
      creators:document.querySelectorAll('.xpcr200b').length,head:(document.querySelector('.xps200k')||{}).textContent||'',search:!!document.getElementById('xpq200'),posts:document.querySelectorAll('.xpgrid .xpcard').length,
      cm:(document.querySelector('.xpgrid .xpcm200')||{}).textContent||'',create:!!document.querySelector('.view [data-go="home"].primary'),
      wide:[...document.querySelectorAll('.view *')].filter(e=>!e.closest('.xph200s')&&e.getBoundingClientRect().right>innerWidth+1).map(e=>e.className).slice(0,5)})""")
    out[tag] = st
    chk(tag + ": six feature cards + dots, five tool doors, a creator, the header, the search, three posts, a comment count on the card, nothing wider than the screen",
        st["cards"] == 6 and st["dots"] == 6 and st["tools"] == 5 and st["creators"] == 1 and st["head"] and st["search"] and st["posts"] == 3 and st["cm"].strip().endswith(str(COUNT0)) and not st["create"] and not st["wide"], st)
    # search filters as you type
    await pg.fill("#xpq200", "osaka"); await pg.wait_for_timeout(150)
    n = await pg.evaluate("()=>document.querySelectorAll('.xpgrid .xpcard').length"); chk(tag + ": search 'osaka' → one card", n == 1, n)
    await pg.fill("#xpq200", "zzzz"); await pg.wait_for_timeout(150)
    none = await pg.evaluate("()=>document.querySelectorAll('.xpgrid .xpcard').length===0&&!!document.querySelector('.xpgrid .mute')"); chk(tag + ": no match → a calm line", none)
    await pg.fill("#xpq200", ""); await pg.wait_for_timeout(150)
    # the viewer
    await pg.evaluate("(id)=>document.querySelector('.xpgrid .xpcard[data-id=\"'+id+'\"]').click()", p1["id"]); await pg.wait_for_timeout(700)
    v = await pg.evaluate("""(id)=>{const f=document.getElementById('xpf200');if(!f)return null;const s=f.querySelector('.xpf200s[data-id="'+id+'"]');const r=s.getBoundingClientRect();
      return{slides:f.querySelectorAll('.xpf200s').length,title:s.querySelector('h3').textContent,by:s.querySelector('.xpf200l small').textContent,eng:s.querySelector('.xpf200e span').textContent,
      promptHidden:s.querySelector('.xpf200q').hidden,rec:s.querySelector('.xpf200rec').textContent,likes:s.querySelector('[data-act="xpf-like"] b').textContent,cm:s.querySelector('[data-act="xpf-comments"] b').textContent,
      onScreen:(()=>{const sc=f.querySelector('.xpf200sc');return sc.children[Math.round(sc.scrollTop/sc.clientHeight)]===s})(),credits:(f.querySelector('.xpf200cr')||{}).textContent||'',
      col:[...s.querySelectorAll('.xpf200r button')].every(b=>{const q=b.getBoundingClientRect();return q.right<=innerWidth+1&&q.width>0}),player:!!document.querySelector('#modalRoot .hfsheet')}}""", p1["id"])
    chk(tag + ": the viewer — three slides, the tapped one on screen, title/by/engine, prompt hidden, Recreate with a cost, counts, the column fits, no old sheet",
        v and v["slides"] == 3 and v["onScreen"] and v["title"] == "Desert falcon" and "Creator" in v["by"] and "WAN" in v["eng"].upper() and v["promptHidden"] and any(ch.isdigit() for ch in v["rec"]) and v["likes"] == "0" and v["cm"] == str(COUNT0) and any(ch.isdigit() for ch in v["credits"]) and v["col"] and not v["player"], v)
    await pg.click('#xpf200 .xpf200s[data-id="%s"] [data-act="xpf-prompt"]' % p1["id"]); await pg.wait_for_timeout(150)
    pr = await pg.evaluate("(id)=>{const s=document.querySelector('#xpf200 .xpf200s[data-id=\"'+id+'\"]');return !s.querySelector('.xpf200q').hidden&&s.querySelector('.xpf200q').textContent.includes('falcon')}", p1["id"]); chk(tag + ": the prompt shows on tap", pr)
    await pg.click('#xpf200 .xpf200s[data-id="%s"] [data-act="xpf-like"]' % p1["id"]); await pg.wait_for_timeout(600)
    lk = await pg.evaluate("(id)=>{const s=document.querySelector('#xpf200 .xpf200s[data-id=\"'+id+'\"]');return[s.querySelector('[data-act=\"xpf-like\"] b').textContent,s.querySelector('[data-act=\"xpf-like\"]').classList.contains('on'),!s.querySelector('.xpf200q').hidden]}", p1["id"])
    chk(tag + ": heart → 1, lit, the open prompt stays open", lk == ["1", True, True], lk)
    await pg.click('#xpf200 .xpf200s[data-id="%s"] [data-act="xpf-like"]' % p1["id"]); await pg.wait_for_timeout(600)
    lk2 = await pg.evaluate("(id)=>document.querySelector('#xpf200 .xpf200s[data-id=\"'+id+'\"] [data-act=\"xpf-like\"] b').textContent", p1["id"]); chk(tag + ": heart again → 0", lk2 == "0", lk2)
    # comments sheet
    await pg.click('#xpf200 .xpf200s[data-id="%s"] [data-act="xpf-comments"]' % p1["id"]); await pg.wait_for_selector("#xpct200", timeout=8000)
    listed = await pg.evaluate("()=>document.querySelectorAll('#xpcl200 .xpc200').length"); chk(tag + ": the sheet lists the comments", listed == COUNT0, listed)
    await pg.fill("#xpct200", "Gorgeous dawn light " + tag); await pg.click('[data-act="xpf-csend"]'); await pg.wait_for_timeout(900)
    after = await pg.evaluate("(id)=>({sheet:document.querySelectorAll('#xpcl200 .xpc200').length,slide:document.querySelector('#xpf200 .xpf200s[data-id=\"'+id+'\"] [data-act=\"xpf-comments\"] b').textContent,card:(document.querySelector('.xpgrid .xpcard[data-id=\"'+id+'\"] .xpcm200')||{}).textContent||''})", p1["id"])
    chk(tag + ": a sent comment is listed and raises the count on the slide and on the card", after["sheet"] == COUNT0 + 1 and after["slide"] == str(COUNT0 + 1) and after["card"].strip().endswith(str(COUNT0 + 1)), after)
    COUNT0 += 1; await pg.evaluate("()=>closeSheet()")
    # share copies a deep link
    await pg.evaluate("()=>{window.__cp=null;navigator.clipboard.writeText=t=>{window.__cp=t;return Promise.resolve()};delete navigator.share}")
    await pg.click('#xpf200 .xpf200s[data-id="%s"] [data-act="xpf-share"]' % p1["id"]); await pg.wait_for_timeout(300)
    cp = await pg.evaluate("()=>window.__cp"); chk(tag + ": share copies a #xp= link", cp and cp.endswith("#xp=" + p1["id"]), cp)
    # Escape closes; deep link opens
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
    chk(tag + ": Escape closes the viewer", await pg.evaluate("()=>!document.getElementById('xpf200')&&!document.documentElement.classList.contains('xpf200open')"))
    await pg.evaluate("(id)=>{location.hash='#xp='+id}", p3["id"]); await pg.wait_for_function("()=>document.querySelector('#xpf200 .xpf200s')", timeout=8000); await pg.wait_for_timeout(400)
    dl = await pg.evaluate("(id)=>{const f=document.getElementById('xpf200'),sc=f.querySelector('.xpf200sc'),i=Math.round(sc.scrollTop/sc.clientHeight);return sc.children[i]&&sc.children[i].dataset.id===id}", p3["id"]); chk(tag + ": the deep link opens on that post", dl)
    # Recreate → Home with the prompt
    await pg.click('#xpf200 .xpf200s[data-id="%s"] [data-act="xpf-recreate"]' % p3["id"]); await pg.wait_for_timeout(700)
    rc = await pg.evaluate("()=>({view:S.view,prompt:S.hf.prompt,viewer:!!document.getElementById('xpf200'),hash:location.hash})")
    chk(tag + ": Recreate closes the viewer and lands on Home with the prompt", rc["view"] == "home" and "Osaka" in rc["prompt"] and not rc["viewer"] and not rc["hash"], rc)
    # the carousel dots follow a swipe
    await pg.evaluate("()=>{go('discover');renderAll()}"); await pg.wait_for_timeout(500)
    await pg.evaluate("()=>{XP200.touched=Date.now();const s=document.getElementById('xph200s');s.scrollLeft=(document.documentElement.dir==='rtl'?-1:1)*(s.children[0].offsetWidth+12)}"); await pg.wait_for_timeout(300)
    dots = await pg.evaluate("()=>[...document.querySelectorAll('.xph200d i')].findIndex(d=>d.classList.contains('on'))"); chk(tag + ": the dots follow the carousel", dots == 1, dots)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        for (w, h, phone, lang) in [(1280, 900, False, "en"), (390, 844, True, "ar"), (390, 844, True, "en")]:
            ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=phone, has_touch=phone, permissions=["clipboard-read", "clipboard-write"]); pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
            await pg.goto(B + "/"); await pg.wait_for_function("()=>typeof S!=='undefined'&&typeof renderAll==='function'", timeout=25000); await pg.wait_for_timeout(500)
            try: await page_checks(pg, f"{lang}:{w}", lang, phone)
            except Exception as e: fails.append(f"{lang}:{w} browser checks stopped: {str(e)[:300]}")
            chk(f"{lang}:{w}: no page errors", not errs, errs[:3]); await ctx.close()
        await b.close()
try: asyncio.run(main())
finally:
    srv.terminate()
    try: srv.wait(timeout=5)
    except Exception: srv.kill()
    subprocess.run(["rm", "-rf", D])
print(json.dumps(out, ensure_ascii=False)[:1200]); print("fails", json.dumps(fails, ensure_ascii=False)); sys.exit(1 if fails else 0)
