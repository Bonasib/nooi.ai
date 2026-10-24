# v84: one picker for every field. The same field (format, camera, lens, camera move, light, style, look, effects,
# weather & light, transition, text effect) is chosen the same way on every page: a chip that shows the choice opens one
# sheet of icon tiles, each saying what it does (the idea of a prompt bar with chips; our own drawings and words).
# Checks: no page still shows the old buttons for these fields; each page has its chips in one bar; the sheet sets the same
# state the page used before (video, image, Cinema Studio, Video from pictures, the editor, the home prompt bar); the lens
# sheet holds lens type + focal length + aperture with what each one does and stays open until Done; every tile has an
# icon, a name and a description (English and Arabic), no emoji; one sheet per field (the same 9:16 tile everywhere);
# Arabic phones: chips and sheets fit, two tiles per row, Done in view.
import asyncio, json, os, re, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8181
PUB = os.environ.get("NOOI_PUBLIC", ROOT + "/public")
D = tempfile.mkdtemp(prefix="nooi-v84-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(PUB, D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "gradients=size=640x640:duration=1", "-frames:v", "1", D + "/media/img.jpg"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=24:duration=4", "-c:v", "libvpx", "-b:v", "300k", D + "/media/a.webm"], check=True)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SETUP = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'Sara',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}"
GO = "(v)=>{document.getElementById('modalRoot').innerHTML='';go(v);renderAll()}"
EDIT = """async(tab)=>{if(!S.jobs.find(j=>j.id==='ed_va')){const now=Date.now(),mk=(id,kind,url,dur)=>({id,kind,status:'complete',prompt:id,title:id,created:now,progress:1,pal:PALS[0],seed:7,dur,aspect:'16:9',resultUrl:url});
  S.jobs.push(mk('ed_va','video','/media/a.webm',4),mk('ed_img','image','/media/img.jpg',0));PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];
  for(const id of ['ed_va','ed_img'])await edUseJob(S.jobs.find(j=>j.id===id),{stay:true,quiet:true,t:1})}
 document.getElementById('modalRoot').innerHTML='';go('edit');renderAll();await new Promise(r=>setTimeout(r,300));S.ed.sel=S.ed.clips[tab==='clip'?0:1].id;S.ed.tab=tab;renderView()}"""   # (v145: a transition is shown for a clip with a next one)
# the old buttons of each field (they stay on the page, hidden, so every handler works as before)
SEL = {"format": '[data-set="draft.aspect"],[data-set="img.aspect"],[data-set="story.aspect"],[data-set="cin.aspect"],[data-set="crew.brief.aspect"],[data-set="rec83.aspect"],[data-set="ss83.aspect"],[data-act="drw-ar"],[data-act="ugc-fmt"]',
  "camera": '[data-set="cin.cam"]', "lens": '[data-set="cin.lens"],[data-set="cin.focal"],[data-set="cin.ap"]',
  "move": '[data-set="draft.camera"],[data-set="chapter.camera"],[data-set="cin.move"],[data-set="ss83.motion"]', "light": '[data-set="cin.light"]',
  "style": '[data-set="draft.style"],[data-set="img.style"],[data-set="story.style"],[data-set="char.art"],[data-set="drw.style"],[data-set="sketch.style"]',
  "look": '[data-set="tools.grade.preset"],[data-act="edx-look"]', "effects": '[data-toggle^="tools.edit.fx."],[data-act="edx-vfx"]',
  "overlay": '[data-act="edv-add"]', "transition": '[data-set="ss83.tr"],[data-set="edclip.trans"]', "textfx": '[data-act="edx-tfx"]'}
# v91: the Sketch page is only the drawing, what it is and one AI button (no style or format pickers; Draw a scene opens it)
# v93: Cinema Studio is part of nooi Studio — camera, lens, focal length, aperture and light are sections of its one box (checked below)
PAGES = [("video", ["style", "format", "move"]), ("image", ["style", "format"]), ("story", ["format", "style", "move"]),
  ("crew", ["format"]), ("recipes", ["format"]), ("slideshow", ["format", "move", "transition"]), ("ugcads", ["format"]),
  ("chars", ["style"]), ("grade", ["look"]), ("edit:color", ["look", "effects"]), ("edit:vfx", ["overlay"]), ("edit:look", ["effects"]), ("edit:clip", ["transition"])]
STATE = """(sel)=>{const vis=[...document.querySelectorAll(sel)].filter(b=>b.offsetParent!==null&&!b.closest('#modalRoot'));
  const chips=[...document.querySelectorAll('#main .pk84c')].map(c=>({f:c.dataset.pk84,v:c.querySelector('.pk84v').textContent,pop:c.getAttribute('aria-haspopup'),al:c.getAttribute('aria-label'),row:c.parentElement.className}));
  return {vis:vis.length,chips}}"""
SHEET = """async(f)=>{const c=document.querySelector('#main .pk84c[data-pk84="'+f+'"]');if(!c)return null;c.click();await new Promise(r=>setTimeout(r,250));
  const s=document.querySelector('#modalRoot .pk84s');if(!s)return {open:false};const emo=/[\\u2600-\\u27bf]|[\\ud83c-\\udbff][\\udc00-\\udfff]/;
  const tiles=[...s.querySelectorAll('.pk84o')].map(b=>({v:b.dataset.val||b.dataset.v||(b.dataset.toggle||'').split('.').pop(),name:(b.querySelector('b')||{}).textContent||'',desc:(b.querySelector('small')||{}).textContent||'',
    icon:!!b.querySelector('.pk84oi>*,.pk86art>svg'),emoji:emo.test(b.textContent),on:b.getAttribute('aria-pressed')==='true'}));
  return {open:true,title:(s.querySelector('h2')||{}).textContent,heads:[...s.querySelectorAll('.pk84h')].map(h=>h.textContent),done:!!s.querySelector('.pk84done'),tiles}}"""
async def main():
    for _ in range(60):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
        except Exception: time.sleep(.5)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for W, lang in ((1280, "en"), (390, "ar")):
            mob = W < 600; pg = await (await b.new_context(viewport={"width": W, "height": 880}, is_mobile=mob, has_touch=mob)).new_page()
            errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
            await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await pg.evaluate(SETUP, lang)
            nodesc = {}; oneSheet = {}
            for page, fields in PAGES:
                if page.startswith("edit:"): await pg.evaluate(EDIT, page[5:])
                else: await pg.evaluate(GO, page)
                await pg.wait_for_timeout(250)
                for f in fields:
                    if page.startswith("edit:") and not mob and f != "transition":
                        # v144: on a computer the editor's add panel shows its tiles (they drag onto the timeline); no chip there
                        t = await pg.evaluate("(s)=>({vis:[...document.querySelectorAll('.ed143 .e-assets '+s.split(',').join(',.ed143 .e-assets '))].filter(b=>b.offsetParent!==null).length,chip:!!document.querySelector('.ed143 .e-assets .pk84c')})", SEL[f])
                        ok(t["vis"] >= 2 and not t["chip"], f"{lang} {page}: the {f} tiles show in the editor's add panel {t}"); continue
                    st = await pg.evaluate(STATE, SEL[f]); ch = [c for c in st["chips"] if c["f"] == f]
                    ok(st["vis"] == 0, f"{lang} {page}: the old {f} buttons are still showing ({st['vis']})")
                    ok(len(ch) == 1 and ch[0]["pop"] == "dialog" and ch[0]["v"].strip() and "pk84row" in ch[0]["row"], f"{lang} {page}: one {f} chip in the bar {ch}")
                    sh = await pg.evaluate(SHEET, f)
                    if not sh or not sh.get("open"): ok(False, f"{lang} {page}: the {f} sheet doesn't open"); continue
                    t = sh["tiles"]
                    ok(len(t) >= 2 and all(x["icon"] and x["name"].strip() for x in t) and not any(x["emoji"] for x in t), f"{lang} {page} {f}: every tile has an icon and a name, no emoji {[x['v'] for x in t if not x['icon'] or not x['name'].strip() or x['emoji']]}")
                    ok(f == "overlay" or sum(x["on"] for x in t) >= (0 if f in ("effects",) else 1), f"{lang} {page} {f}: the current choice is marked")
                    miss = [x["v"] for x in t if not x["desc"].strip()]
                    if miss: nodesc[f"{page}:{f}"] = miss
                    if lang == "ar": ok(all(re.search("[؀-ۿ]", x["desc"]) for x in t if x["desc"]), f"{page} {f}: the descriptions are in Arabic")
                    if f == "format": oneSheet[page] = next((x["name"] + "|" + x["desc"] for x in t if x["v"] == "9:16"), None)
                    if f == "lens":
                        ok(len(sh["heads"]) == 3 and sh["done"] and len(t) == 14, f"{lang} cinema: the lens sheet holds lens type, focal length and aperture {sh['heads']} {len(t)}")
                        if mob:
                            g = await pg.evaluate("()=>{const t=[...document.querySelectorAll('#modalRoot .pk84o')];const xs=new Set(t.slice(0,4).map(b=>Math.round(b.getBoundingClientRect().left)));const d=document.querySelector('#modalRoot .pk84done button').getBoundingClientRect();return {cols:xs.size,done:d.bottom<=innerHeight+1&&d.top>=0,wide:document.documentElement.scrollWidth-innerWidth}}")
                            ok(g["cols"] == 2 and g["done"] and g["wide"] <= 1, f"ar phone: the lens sheet has two tiles per row and Done in view {g}")
                    await pg.evaluate("()=>{document.getElementById('modalRoot').innerHTML=''}")
                if mob:
                    fit = await pg.evaluate("()=>({wide:document.documentElement.scrollWidth-innerWidth,out:[...document.querySelectorAll('#main .pk84c')].filter(c=>{if(c.closest('.cz98b .opt93'))return false;const r=c.getBoundingClientRect();return r.width&&(r.left<-1||r.right>innerWidth+1)}).length})")   # (v98: the prompt bar's chip row scrolls sideways; the page itself must not)
                    ok(fit["wide"] <= 1 and not fit["out"], f"ar phone {page}: the chips fit {fit}")
            ok(not nodesc, f"{lang}: tiles without a description {nodesc}")
            vals = {v for v in oneSheet.values()}
            ok(len(vals) == 1 and None not in vals, f"{lang}: the 9:16 tile is the same on every page {oneSheet}")
            out[lang] = {"pages": len(PAGES), "formatPages": len(oneSheet)}
            ok(not errs, f"{lang}: page errors {errs[:3]}")
            if lang != "en": continue
            # ---- picking from the sheet sets the same state as before
            async def pick(f, sel, wait=350):
                await pg.evaluate("(f)=>document.querySelector('#main .pk84c[data-pk84=\"'+f+'\"]').click()", f); await pg.wait_for_timeout(200)
                await pg.click("#modalRoot .pk84o" + sel); await pg.wait_for_timeout(wait)
            await pg.evaluate(GO, "video"); await pick("format", '[data-val="9:16"]')
            r = await pg.evaluate("()=>({a:S.draft.aspect,open:!!document.querySelector('#modalRoot .pk84s'),chip:document.querySelector('.pk84c[data-pk84=format] .pk84v').textContent})")
            ok(r == {"a": "9:16", "open": False, "chip": "9:16"}, f"video: the format sheet sets the format and closes {r}")
            await pg.evaluate(GO, "cinema"); await pg.wait_for_timeout(200)
            for sec, v in (("c_lens", "anamorphic"), ("c_focal", "85"), ("c_ap", "1.4")):
                await pg.click(f'[data-o93="{sec}"]'); await pg.wait_for_timeout(150); await pg.click(f'.box93 [data-set="draft.cine93.{sec[2:]}"][data-val="{v}"]'); await pg.wait_for_timeout(250)
            r = await pg.evaluate("()=>({view:S.view,c:{...S.draft.cine93},chips:['c_lens','c_focal','c_ap'].map(k=>(document.querySelector('[data-o93='+k+'] .o93v')||{}).textContent),p:cineWords93()})")
            ok(r["view"] == "video" and r["c"].get("lens") == "anamorphic" and str(r["c"].get("focal")) == "85" and str(r["c"].get("ap")) == "1.4" and r["chips"][0] == "Anamorphic" and "85" in r["chips"][1] and "1.4" in r["chips"][2], f"nooi Studio: the box sets lens, focal length and aperture, each chip shows its choice {r}")
            ok("anamorphic" in r["p"].lower() and "85mm" in r["p"] and "f/1.4" in r["p"], f"nooi Studio: the words the engine receives follow the lens choices {r['p']}")
            await pg.evaluate(GO, "image"); await pick("style", '[data-val="anime"]')
            ok(await pg.evaluate("()=>S.img.style") == "anime", "image: the style sheet sets the style")
            await pg.evaluate(GO, "slideshow"); await pick("transition", '[data-val="slide"]'); await pick("move", '[data-val="pan"]')
            ok(await pg.evaluate("()=>[S.ss83.tr,S.ss83.motion]") == ["slide", "pan"], "Video from pictures: the transition and motion sheets set them")
            # (v144: on a computer the editor's add panel shows these tiles — a tap uses them, a drag puts them on the timeline)
            await pg.evaluate(EDIT, "color"); await pg.click('.e-assets [data-act="edx-vfx"][data-v="glow"]'); await pg.wait_for_timeout(300); await pg.click('.e-assets [data-act="edx-vfx"][data-v="rgb"]'); await pg.wait_for_timeout(300)
            r = await pg.evaluate("()=>{const c=S.ed.clips.find(x=>x.id===S.ed.sel);return {vfx:c&&c.vfx,on:[...document.querySelectorAll('.e-assets [data-act=\"edx-vfx\"][aria-pressed=\"true\"]')].map(b=>b.dataset.v).sort()}}")
            ok(r["vfx"] and r["vfx"].get("glow") and r["vfx"].get("rgb") and r["on"] == ["glow", "rgb"], f"editor: effects are several at once, each tile shows it is on {r}")
            await pg.evaluate(EDIT, "clip"); await pick("transition", '[data-val="fade"]')
            ok(await pg.evaluate("()=>S.ed.clips.find(x=>x.id===S.ed.sel).trans") == "fade", "editor: the clip's transition is set from the sheet")
            await pg.evaluate(EDIT, "vfx"); n0 = await pg.evaluate("()=>(S.ed.vfx||[]).length"); await pg.click('.e-assets [data-act="edv-add"][data-v="rain"]'); await pg.wait_for_timeout(350)
            ok(await pg.evaluate("()=>(S.ed.vfx||[]).length") == n0 + 1, "editor: a weather & light tile adds the effect")
            await pg.evaluate(GO, "home"); await pg.evaluate("()=>hfRatioSheet()"); await pg.wait_for_timeout(200)
            h = await pg.evaluate("()=>({tiles:document.querySelectorAll('#modalRoot .pk84o').length,desc:[...document.querySelectorAll('#modalRoot .pk84o small')].filter(s=>s.textContent.trim()).length})")
            await pg.click('#modalRoot .pk84o[data-v="9:16"]'); await pg.wait_for_timeout(250)
            ok(h["tiles"] == 6 and h["desc"] == 6 and await pg.evaluate("()=>S.hf.aspect") == "9:16", f"home: the prompt bar's format sheet uses the same tiles {h}")
        await b.close()
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict({k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "LOCAL_LLM", "PIPER"))},
    PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try: asyncio.run(main())
finally: srv.terminate()
print(json.dumps({"fails": fails, **out}, ensure_ascii=False, indent=1))
