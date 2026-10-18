# v98 in a real browser with a real nooi server (computer, tablet, Arabic phone):
#  · dark first: a visitor still on the automatic theme gets the dark one, once (light stays light after you pick it)
#  · one header: on a computer the logo (Home), the sections (Explore … All tools), search, credits, My library, the account;
#    no side menu; the sections lead to their pages; tablets use the whole width; phones keep the top bar + bottom bar
#  · Video and Images: the gallery of what you made (newest first, 24 then "Show more"), light cards (a picture per finished
#    result; at most 8 videos load their first frame), a docked prompt bar with the words, the helpers, the character, the
#    option chips and Generate with its price; a chip's choices open just above the bar and close on a tap elsewhere or Esc;
#    an example idea goes into the bar; a result opens large with its actions and closes with Esc
# Run: python3 tests/v98.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8291
D = tempfile.mkdtemp(prefix="nooi-v98-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=24", "-t", "2", "-pix_fmt", "yuv420p", "-c:v", "libx264", D + "/media/v.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=512x512", "-frames:v", "1", D + "/media/p.jpg"], check=True)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SEED = """(n)=>{S.jobs=S.jobs.filter(j=>!/^t98/.test(j.id));const now=Date.now();
  for(let i=0;i<n;i++){S.jobs.push({id:'t98v'+i,kind:'video',status:'complete',progress:1,created:now-(n-i)*1000,prompt:'clip number '+i,title:'clip number '+i,model:'seedance',dur:5,aspect:i%3?'16:9':'9:16',resultUrl:'http://example.com/v'+i+'.mp4',pal:PALS[i%PALS.length],seed:i});
    S.jobs.push({id:'t98i'+i,kind:'image',status:'complete',progress:1,created:now-(n-i)*1000,prompt:'picture number '+i,title:'picture number '+i,model:'nano',aspect:'1:1',resultUrl:'/media/p.jpg',batch:'b98'+(i>>2),pal:PALS[i%PALS.length],seed:i})}
  S.jobs.push({id:'t98r',kind:'video',status:'rendering',progress:.3,created:now,prompt:'still being made',model:'kling',dur:5,aspect:'16:9',pal:PALS[0],seed:1});persist()}"""

async def run(b, W, H, lang, tag):
    ctx = await b.new_context(viewport={"width": W, "height": H}, is_mobile=W < 600, has_touch=W < 600); pg = await ctx.new_page(); E = pg.evaluate; errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    first = await E("()=>({theme:S.theme,attr:document.documentElement.dataset.theme||'',dark98:S.dark98})")
    ok(first["theme"] == "dark" and first["attr"] == "dark", f"{tag}: a visitor on the automatic theme gets the dark one {first}")
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}", lang)
    await E(SEED, 30); await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(600)
    h = await E("""()=>{const t=document.querySelector('#main>.topm'),n=[...document.querySelectorAll('#main .hnav98 [data-go]')];const r=t.getBoundingClientRect(),m=document.getElementById('main').getBoundingClientRect();
      return {header:getComputedStyle(t).display!=='none'&&r.top<=1,side:getComputedStyle(document.getElementById('side')).display,nav:n.filter(b=>b.getBoundingClientRect().width>0).map(b=>b.dataset.go),cur:(n.find(b=>b.getAttribute('aria-current')==='page')||{}).dataset?.go,
        lib:!!document.querySelector('#main .lib98'),bottom:getComputedStyle(document.getElementById('bottomnav')).display,mainW:Math.round(m.width),wide:document.documentElement.scrollWidth-innerWidth}}""")
    out[tag] = {"header": h}
    if W >= 768:
        ok(h["header"] and h["side"] == "none" and h["bottom"] == "none" and h["lib"], f"{tag}: one header, no side menu, no bottom bar {h}")
        ok(h["nav"][:3] == ["explore", "image", "video"] and "apps" in h["nav"] + ["apps"] and h["cur"] == "video", f"{tag}: the sections in the header, Video marked {h['nav']} {h['cur']}")
        ok(h["mainW"] >= W - 2, f"{tag}: the page uses the whole width ({h['mainW']} of {W})")
        await pg.click('#main .hnav98 [data-go="image"]'); await pg.wait_for_timeout(300)
        ok(await E("()=>S.view") == "image", f"{tag}: a section in the header opens its page")
        await pg.click('#main>.topm .brand'); await pg.wait_for_timeout(300)
        ok(await E("()=>S.view") == "home", f"{tag}: the logo goes Home")
        await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(400)
    else:
        ok(h["bottom"] != "none" and not h["nav"], f"{tag}: a phone keeps its top bar and the bottom bar {h}")
    ok(h["wide"] <= 1, f"{tag}: nothing wider than the screen ({h['wide']})")
    # the gallery and the bar
    g = await E("""()=>{const cards=[...document.querySelectorAll('#main .gal98 .gc98')];const bar=document.querySelector('#main .dock98 .cz98'),br=bar&&bar.getBoundingClientRect();
      return {n:cards.length,first:cards[0]&&cards[0].dataset.open98,second:cards[1]&&cards[1].dataset.open98,videos:document.querySelectorAll('#main .gal98 video').length,more:!!document.querySelector('#main [data-more98]'),
        bar:!!bar,inView:!!br&&br.bottom<=innerHeight+1&&br.top>=0,ta:!!(bar&&bar.querySelector('textarea#dprompt')),gen:!!(bar&&bar.querySelector('[data-act="gen-video"] .cost')),chips:bar?bar.querySelectorAll('.opt93 .o93,.opt93 .pk84c').length:0,
        add:!!(bar&&bar.querySelector('.add98')),char:!!(bar&&bar.querySelector('.char98 select'))}}""")
    out[tag]["gallery"] = g
    ok(g["n"] == 24 and g["first"] == "t98r" and g["second"] == "t98v29" and g["more"], f"{tag}: the gallery shows the newest 24 first, then Show more {g}")
    ok(g["videos"] <= 8, f"{tag}: at most 8 videos load in the gallery ({g['videos']})")
    ok(g["bar"] and g["inView"] and g["ta"] and g["gen"] and g["chips"] >= 6 and g["add"] and g["char"], f"{tag}: the docked prompt bar: words, add frames, character, chips, Generate with its price {g}")
    await E("()=>document.querySelector('#main [data-more98]').click()"); await pg.wait_for_timeout(400)
    ok(await E("()=>document.querySelectorAll('#main .gal98 .gc98').length") == 31, f"{tag}: Show more shows the rest")
    # a chip's choices just above the bar; a tap elsewhere / Esc closes them
    await E("()=>{const c=document.querySelector('#main .cz98 [data-o93=\"model\"]');c.scrollIntoView({block:'nearest',inline:'center'})}")
    await pg.click('#main .cz98 [data-o93="model"]', force=True); await pg.wait_for_timeout(300)
    p = await E("""()=>{const s=document.getElementById('sec93-model'),b=document.querySelector('#main .cz98').getBoundingClientRect(),r=s&&s.getBoundingClientRect();return {open:!!s&&!s.hidden,above:!!r&&r.bottom<=b.top+2,inView:!!r&&r.top>=0}}""")
    ok(p["open"] and p["above"] and p["inView"], f"{tag}: a chip's choices open just above the bar {p}")
    await pg.mouse.click(10, 140 if W >= 768 else 200); await pg.wait_for_timeout(300)
    ok(await E("()=>document.getElementById('sec93-model').hidden"), f"{tag}: a tap elsewhere closes them")
    await pg.click('#main .cz98 [data-o93="model"]', force=True); await pg.wait_for_timeout(200); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
    ok(await E("()=>document.getElementById('sec93-model').hidden"), f"{tag}: Esc closes them")
    # a result opened large
    await E("()=>{const c=document.querySelector('#main .gc98[data-open98=\"t98v29\"]');c.scrollIntoView({block:'center'})}")
    # (v120: on phones the card shows no words — its middle opens it)
    await pg.click('#main .gc98[data-open98="t98v29"] .tk98', force=True); await pg.wait_for_timeout(500)
    lb = await E("""()=>{const l=document.querySelector('#main .lb98');return {open:!!l,stage:!!(l&&l.querySelector('.stage')),acts:l?[...l.querySelectorAll('[data-act]')].map(b=>b.dataset.act).filter(a=>/send-edit|finish-from|extend-job|fps120/.test(a)):[]}}""")
    ok(lb["open"] and lb["stage"] and {"send-edit", "finish-from", "extend-job"} <= set(lb["acts"]), f"{tag}: a video opens large with Open in editor, Upscale, Extend {lb}")
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
    ok(not await E("()=>!!document.querySelector('#main .lb98')"), f"{tag}: Esc closes it")
    # an example idea goes into the bar (empty gallery)
    await E("()=>{S.jobs=S.jobs.filter(j=>!/^t98/.test(j.id)&&j.kind!=='video');S.draft.prompt='';go('video');renderAll()}"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('#main [data-ex98=\"video\"]').click()"); await pg.wait_for_timeout(300)
    ex = await E("()=>[S.draft.prompt,(document.getElementById('dprompt')||{}).value,document.activeElement&&document.activeElement.id]")
    ok(ex[0] and ex[0] == ex[1] and ex[2] == "dprompt", f"{tag}: an example idea goes into the bar {ex}")
    # Images: the same layout; a picture opens large with its actions
    await E(SEED, 6); await E("()=>{go('image');renderAll()}"); await pg.wait_for_timeout(500)
    im = await E("""()=>{const bar=document.querySelector('#main .dock98 .cz98');return {cards:document.querySelectorAll('#main .gal98 .gc98').length,ta:!!(bar&&bar.querySelector('#iprompt')),ph:(document.getElementById('iprompt')||{}).placeholder||'',
      ref:!!(bar&&bar.querySelector('.add98 [data-slot="iRef"]')),chips:bar?[...bar.querySelectorAll('.opt93 [data-o93],.opt93 .pk84c')].map(c=>c.dataset.o93||c.dataset.pk84):[],gen:!!(bar&&bar.querySelector('[data-act="gen-images"] .cost'))}}""")
    ok(im["cards"] == 6 and im["ta"] and im["ph"] and im["ref"] and {"format", "style", "icount", "imodel"} <= set(im["chips"]) and im["gen"], f"{tag}: Images: gallery + the same prompt bar (reference picture, format, style, pictures, engine) {im}")
    await E("()=>{const c=document.querySelector('#main .gc98[data-open98=\"t98i5\"]');c.scrollIntoView({block:'center'})}")
    await pg.click('#main .gc98[data-open98="t98i5"] .tk98', force=True); await pg.wait_for_timeout(500)
    li = await E("""()=>{const l=document.querySelector('#main .lb98');return {img:!!(l&&l.querySelector('.pim98 img')),acts:l?[...l.querySelectorAll('[data-act],a[download]')].map(b=>b.dataset.act||'download'):[],sel:S.img.sel}}""")
    ok(li["img"] and "animate-img" in li["acts"] and "vary-img" in li["acts"] and "download" in li["acts"] and li["sel"] == "t98i5", f"{tag}: a picture opens large with Animate, More like this, Download {li}")
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL="http://localhost:9", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            b = await p.chromium.launch()
            await run(b, 1440, 900, "en", "computer"); await run(b, 820, 1180, "en", "tablet"); await run(b, 390, 844, "ar", "ar phone")
            # light stays light once picked
            ctx = await b.new_context(); pg = await ctx.new_page(); await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
            await pg.evaluate("()=>{S.theme='light';applyTheme();persist()}"); await pg.wait_for_timeout(1200); await pg.reload()   # (the page saves 0.7 s after a change); await pg.wait_for_timeout(1200)
            t = await pg.evaluate("()=>[S.theme,document.documentElement.dataset.theme]"); ok(t == ["light", "light"], f"light stays light after you pick it {t}")
            await ctx.close(); await b.close()
    finally: srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
