# v203 — result cards in the owner's order (phone, light and dark, English and Arabic). Four finished videos, one made on two engines:
#  · two columns; each card in order: media (play, sound, length) → title → engine logos → Edit → Approve · Download · ⋮
#  · the logos are the official marks of the engines that made it, icon only (no name text on the card; the name is the label)
#  · the play and sound buttons sit bottom-left and the length bottom-right in both languages; full screen lives in ⋮
#  · ⋮ opens Make it again · Full screen · Remove; the group heading says "Videos 4 results"; the Claude & ChatGPT pill steps aside
#  · Approve and Edit still work (the result is approved / the editor opens with the clip)
# Run: python3 tests/v203.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8665; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v203-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=640x360:rate=24:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "300k", "-an", D + "/media/w.webm"], check=True, timeout=120)
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", AGENTS_AUTO_LEARN="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:500]))
SETUP = """(a)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(a[0]);S.theme=a[1];applyTheme();
  S.jobs=S.jobs.filter(j=>!/^v203/.test(j.id));const now=Date.now();
  for(let i=0;i<4;i++)S.jobs.push({id:'v203_'+i,kind:'video',status:'complete',prompt:'A walk through the field '+i,title:'Clip '+i,created:now-i,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/w.webm',model:i==3?'kling30':'hailuo',meta:i==2?{partModels:['hailuo','kling30']}:{}});
  S.hf.out=S.jobs.filter(j=>/^v203/.test(j.id)).map(j=>j.id);S.hf.selMode=false;go('home');renderAll();document.getElementById('modalRoot').innerHTML=''}"""
PROBE = """()=>{const cards=[...document.querySelectorAll('.hfrc.c203')],c=cards[0],box=c.querySelector('.hfrm').getBoundingClientRect(),R=s=>{const e=c.querySelector(s);return e?e.getBoundingClientRect():null};
  const order=[...c.querySelectorAll('.hfrm,.t203,.eng203,.ed203,.act203')].map(e=>e.className.split(' ')[0]);
  const p=R('.hfvp'),m=R('.hfvm'),d=R('.dur203'),f=c.querySelector('.hfvf');
  return{n:cards.length,cols:getComputedStyle(document.querySelector('.hfres .hfrgrid')).gridTemplateColumns.split(' ').length,order,
    acts:[...c.querySelectorAll('.act203>*')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.dataset.act),
    play:!!p&&p.left-box.left<box.width*.25&&box.bottom-p.bottom<box.height*.3,sound:!!m&&m.left>p.left&&m.left-box.left<box.width*.5,
    dur:!!d&&box.right-d.right<box.width*.2&&box.bottom-d.bottom<box.height*.3,durT:c.querySelector('.dur203')?.textContent,full:!!f&&getComputedStyle(f).display==='none',
    logos:cards.map(x=>[...x.querySelectorAll('.eng203 i')].map(i=>i.getAttribute('aria-label'))),logoImgs:cards.every(x=>[...x.querySelectorAll('.eng203 img')].every(i=>/^data:image\\/svg/.test(i.src)&&i.naturalWidth>0)),
    nameText:cards.some(x=>/Hailuo|Kling/.test(x.querySelector('.hfrb').innerText)),head:document.querySelector('.hfres h3.hfgh').textContent.trim(),
    pill:(()=>{const p=document.querySelector('.hfpill');return p?getComputedStyle(p).display:'none'})(),wide:document.documentElement.scrollWidth<=innerWidth+1,okBg:getComputedStyle(c.querySelector('.ok203')).backgroundColor}}"""

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("()=>typeof S!=='undefined'&&typeof renderAll==='function'", timeout=25000)
        for lang, theme in (("en", "light"), ("ar", "dark")):
            tag = lang + "/" + theme
            await E(SETUP, [lang, theme]); await pg.wait_for_selector(".hfrc.c203", timeout=10000); await pg.wait_for_timeout(1200)
            r = await E(PROBE); out[tag] = r
            chk(f"{tag}: four cards in two columns, each in the order media → title → logos → Edit → actions", r["n"] == 4 and r["cols"] == 2 and r["order"] == ["hfrm", "t203", "eng203", "ed203", "act203"], r)
            chk(f"{tag}: the actions row is Approve · Download · ⋮ (lime Approve)", r["acts"] == ["hfr-ok", "dl187", "more203"] and r["okBg"] == "rgb(217, 244, 59)", [r["acts"], r["okBg"]])
            chk(f"{tag}: play bottom-left, sound beside it, the length bottom-right (0:06); full screen not on the face", r["play"] and r["sound"] and r["dur"] and r["durT"] == "0:06" and r["full"], r)
            chk(f"{tag}: logos of the engines that made each one (both for the two-engine video), icon only, official SVG marks", r["logos"] == [["MiniMax Hailuo"], ["MiniMax Hailuo"], ["MiniMax Hailuo", "Kling 3.0"], ["Kling 3.0"]] and r["logoImgs"] and not r["nameText"], [r["logos"], r["logoImgs"], r["nameText"]])
            want = "Videos 4 results" if lang == "en" else "فيديوهات 4 نتائج"
            chk(f"{tag}: heading '{want}', the Claude & ChatGPT pill hidden, nothing wider than the screen", " ".join(r["head"].split()) == want and r["pill"] == "none" and r["wide"], [r["head"], r["pill"], r["wide"]])
        # ⋮ menu
        await pg.click('.hfrc.c203 [data-act="more203"]'); await pg.wait_for_selector(".more203", timeout=5000)
        mo = await E("()=>[...document.querySelectorAll('.more203 [data-act]')].map(b=>b.dataset.act)"); chk("⋮ opens Make it again · Full screen · Remove", mo == ["hfr-again", "full203", "hfr-x"], mo)
        await E("()=>closeSheet()")
        # Approve and Edit still work
        await pg.click('.hfrc.c203[data-j203="v203_0"] [data-act="hfr-ok"]'); await pg.wait_for_timeout(500)
        ap = await E("()=>({approved:!!S.jobs.find(j=>j.id==='v203_0').approved,view:S.view})"); chk("Approve approves the result", ap["approved"], ap)
        await E("()=>{go('home');renderAll();document.getElementById('modalRoot').innerHTML=''}"); await pg.wait_for_selector('.hfrc.c203[data-j203="v203_1"]', timeout=8000)
        await pg.click('.hfrc.c203[data-j203="v203_1"] [data-act="hfe-ed"]'); await pg.wait_for_timeout(1200)
        ed = await E("()=>({view:S.view,clips:(S.ed.clips||[]).filter(c=>c.src&&c.src.job==='v203_1').length})"); chk("Edit opens the editor with the clip", ed["view"] == "edit" and ed["clips"] >= 1, ed)
        chk("page: no errors", not errs, errs[:3]); await b.close()
try: asyncio.run(main())
finally:
    srv.terminate()
    try: srv.wait(timeout=5)
    except Exception: srv.kill()
    subprocess.run(["rm", "-rf", D])
print(json.dumps({"out": out, "fails": fails}, ensure_ascii=False, default=str)[:3000]); sys.exit(1 if fails else 0)
