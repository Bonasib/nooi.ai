# v172 — a quieter engine list and a line that says what nooi Auto does. A real nooi server and the page in Playwright (phone and
# computer, English and Arabic):
#  · the Home box's engine list: no "Video engine" / "Picture engine" title (its name still read out), no "Strongest first —
#    sorted by credits per run" line, no stars on the logos — the order is the same (nooi Auto first, then by credits, highest
#    first) and the stars are still in the page, only hidden
#  · nooi Auto chosen → one line under the box's chips says what it does (video and picture each their own); an engine picked by
#    hand → no line
#  · the Video and Image pages' engine lists: no "Engine" heading; MiniMax Hailuo says what it is good at, not "Video engine"
#  · nothing wider than the screen
# Run: python3 tests/v172.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8525; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v172-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

LINE = """(t)=>{S.hf.tab=t;renderView();const p=document.querySelector('.hfbox .nai172'),r=p&&p.getBoundingClientRect(),row=document.querySelector('.hfbox .hfmrow');
  return p&&{t:p.dataset.t,txt:p.textContent.trim(),after:p.previousElementSibling===row,vis:r.width>100&&r.height>10&&getComputedStyle(p).display!=='none',w:document.documentElement.scrollWidth<=innerWidth+1}}"""
SHEET = """async()=>{document.querySelector('.hfmi.eng171').click();await new Promise(r=>setTimeout(r,350));const s=document.querySelector('#modalRoot .hfsheet'),num=b=>+((b.querySelector('.cr')||{}).textContent||'').replace(/\\D/g,'')||0;
  const rows=[...s.querySelectorAll('.hfmodel')],shown=e=>e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0;
  const r={label:s.getAttribute('aria-label'),title:shown(s.querySelector('h2')),line:shown(s.querySelector('.mrkh')),starsShown:[...s.querySelectorAll('.mrk')].filter(shown).length,starsKept:s.querySelectorAll('.mrk').length,
    first:rows[0]&&rows[0].dataset.v,sorted:rows.slice(1).every((b,i,a)=>i===0||num(a[i-1])>=num(b)),n:rows.length,text:s.innerText};closeSheet();return r}"""

async def run(p, phone, lang):
    tag = f"{'phone' if phone else 'desk'} {lang}"; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.hf.vModel='auto';S.hf.iModel='auto';S.hf.bots=false;go('home');renderAll()}", lang)
    await pg.wait_for_timeout(500); R = {}
    v = await E(LINE, "video"); R["video_line"] = v
    ok(v and v["t"] == "video" and v["vis"] and v["after"] and v["w"] and ("9 وكلاء" in v["txt"] if ar else (("9 AI agents" in v["txt"] or "9 agents" in v["txt"]) and v["txt"].startswith("nooi Auto:"))), f"{tag}: nooi Auto chosen — a line under the chips says what it does {v}")
    i = await E(LINE, "image"); R["image_line"] = i
    ok(i and i["t"] == "image" and i["vis"] and ("محرك صور" in i["txt"] if ar else "picture engine" in i["txt"]), f"{tag}: the picture tab has its own line {i}")
    await E("()=>{S.hf.tab='video';S.hf.vModel='kling30';renderView()}"); n = await E("()=>!!document.querySelector('.hfbox .nai172')")
    ok(not n, f"{tag}: an engine picked by hand → no line")
    await E("()=>{S.hf.vModel='auto';renderView()}")
    s = await E(SHEET); R["sheet"] = {k: v for k, v in s.items() if k != "text"}
    want = "محرك الفيديو" if ar else "Video engine"
    ok(not s["title"] and s["label"] == want and not s["line"] and s["starsShown"] == 0 and s["starsKept"] >= 1, f"{tag}: the list without its title, the 'strongest first' line or stars (still named for screen readers) {R['sheet']}")
    ok(s["first"] == "auto" and s["sorted"] and s["n"] > 10, f"{tag}: the same order — nooi Auto first, then by credits {R['sheet']}")
    gone = [w for w in (["الأقوى أولاً", "محرك الفيديو"] if ar else ["Strongest first", "credits per run", "Video engine"]) if w in s["text"]]
    ok(not gone, f"{tag}: none of those words on screen {gone}")
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(600)
    pv = await E("""()=>{const c=document.querySelector('#main .o93[data-o93="model"]');c&&c.click();const sec=document.getElementById('sec93-model'),l=sec&&sec.querySelector(':scope>.lbl');
      const h=[...(sec?sec.querySelectorAll('.models > *'):[])].find(e=>/Hailuo/.test(e.textContent)&&!/H3|Hailuo 3/.test(e.textContent));return {heading:l?getComputedStyle(l).display:null,hailuo:h&&h.innerText,w:document.documentElement.scrollWidth<=innerWidth+1}}""")
    R["video_page"] = pv
    ok(pv["heading"] == "none" and pv["hailuo"] and "Video engine" not in pv["hailuo"] and "محرك فيديو" not in pv["hailuo"] and pv["w"], f"{tag}: the Video page's list — no Engine heading, Hailuo says what it is good at {pv}")
    await E("()=>{go('image');renderAll()}"); await pg.wait_for_timeout(600)
    pi = await E("""()=>{const l=document.querySelector('#sec93-imodel .igrp.imod>.lbl');return {heading:l?getComputedStyle(l).display:null,w:document.documentElement.scrollWidth<=innerWidth+1}}""")
    R["image_page"] = pi; ok(pi["heading"] == "none" and pi["w"], f"{tag}: the Image page's list — no Engine heading {pi}")
    out[tag] = R; ok(not errs, f"{tag}: page errors {errs}"); await br.close()

async def main():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: await asyncio.sleep(.25)
    async with async_playwright() as p:
        for phone, lang in ((True, "en"), (True, "ar"), (False, "en")):
            try: await run(p, phone, lang)
            except Exception as e: fails.append(f"{'phone' if phone else 'desk'} {lang} crashed: {e!r}"[:400])
try: asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1)[:8000])
shutil.rmtree(D, ignore_errors=True)
print("v172 ok" if not fails else f"FAILED {len(fails)}"); sys.exit(1 if fails else 0)
