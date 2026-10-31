# v206 — motion graphics in the editor: the 20 named effects, showcases of up to 12 pictures, the reference motions, recipes.
#  · the Info tab shows them in groups, each tile drawn by the scene itself; five one-tap recipes
#  · every new scene draws without an error at the start, middle and end, and moves (its frames differ over time)
#  · a tap on a tile adds the scene with its own length and fields (a list, a second line, a number, picture slots)
#  · a picture slot takes a picture; a recipe lays its scenes on a timeline of its own
#  · the export waits for the scenes' pictures: the exported file shows the slot's picture (red) inside the green screen
# Run: python3 tests/v206.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8670; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v206-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
for n, c in (("red", "0xff0000"), ("blue", "0x0000ff")):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c={c}:s=480x640", "-frames:v", "1", D + f"/media/{n}.png"], check=True, timeout=60)
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", AGENTS_AUTO_LEARN="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
def pixel(f, t, fx, fy):
    png = D + "/fr.png"; subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", f, "-frames:v", "1", png], check=True, timeout=60)
    from PIL import Image
    im = Image.open(png).convert("RGB"); w, h = im.size; return im.getpixel((int(w * fx), int(h * fy)))
SETUP = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';go('edit');S.ed.tab='info';renderAll()}"
async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("()=>typeof S!=='undefined'&&typeof renderAll==='function'&&API.mode==='server'", timeout=25000)
        # 1. every new scene draws and moves
        dr = await E("""()=>{const keys=ALL206.map(x=>x[0]),c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d'),bad=[],still=[];
          const sig=()=>{const d=x.getImageData(0,0,320,180).data;let s=0;for(let i=0;i<d.length;i+=97)s=(s*31+d[i])>>>0;return s};
          keys.forEach(k=>{const d=DEF206()[k]||{},len=d.dur||4,sg=[];[.25,.55,.9].forEach(f=>{const it=Object.assign({id:'t'+k,type:'mg150',sc:k,t1:'',t2:'',items:'',val:'',pics:[]},d);x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,320,180);
            try{x.translate(160,90);SC164[k](x,{W:320,H:180,U:180,lt:len*f,len,ac:'#c1ff72',it})}catch(e){bad.push(k+': '+e.message)}sg.push(sig())});if(sg[0]===sg[1]&&sg[1]===sg[2])still.push(k)});
          return{n:keys.length,fx:MG206.fx.length,names:MG206.fx.map(x=>x[1]),bad,still}}""")
        out["draw"] = dr
        want = ["Orbit", "Chat Takeover", "Frame Escape", "Snap Zoom", "Checklist Pop", "Headline Storm", "Zoom Portal", "Growth Curve", "Studio Reveal", "B-roll Overlay", "Paper Cutout", "Dolly Zoom", "Magazine Cover", "Liquid Glass", "Zoom Through Cut", "Green Screen", "Frame Break", "Digital Zoom", "Phone Mockup", "Checklist"]
        chk("the 20 effects the owner named, in the same order", dr["names"] == want, dr["names"])
        chk("all 28 new scenes draw without an error at the start, middle and end", dr["n"] == 28 and not dr["bad"], dr["bad"])
        chk("…and every one moves (its frames differ over time)", not dr["still"], dr["still"])
        for lang in ("en", "ar"):
            await E(SETUP, lang); await pg.wait_for_selector("canvas.mg206c", timeout=8000); await pg.wait_for_timeout(600)
            ui = await E("""()=>({tiles:document.querySelectorAll('canvas.mg206c').length,painted:document.querySelectorAll('canvas.mg206c[data-p]').length,groups:document.querySelectorAll('.mg206h').length,
              recs:[...document.querySelectorAll('[data-act="mg206-rec"]')].map(b=>b.textContent.trim()),classic:document.querySelectorAll('.mg150i').length,wide:document.documentElement.scrollWidth<=innerWidth+1})""")
            out[lang] = ui
            chk(f"{lang}: the Info tab — 29 drawn tiles in groups (effects, showcases, reference motions), five recipes, the classic scenes kept", ui["tiles"] == 29 and ui["painted"] == 29 and ui["groups"] >= 4 and len(ui["recs"]) == 5 and ui["classic"] >= 9 and ui["wide"], ui)
        # 2. a tap adds the scene with its own length and fields
        await E(SETUP, "en"); await pg.wait_for_selector('[data-v="mg150:chat"]', timeout=8000)
        await pg.click('.mg206g [data-v="mg150:chat"]'); await pg.wait_for_timeout(500)
        a = await E("()=>{const it=edItem(edPick());return it?{sc:it.sc,len:+(it.end-it.start).toFixed(2),items:!!document.querySelector('input[data-ib=\"items\"]'),lab:[...document.querySelectorAll('label.lbl')].map(l=>l.textContent).join('|')}:null}")
        chk("Chat Takeover added: 5 s, with its Messages list", a and a["sc"] == "chat" and a["len"] == 5 and a["items"] and "Messages" in a["lab"], a)
        await E("()=>{mgAdd150('growthCurve')}"); await pg.wait_for_timeout(300)
        g = await E("()=>({val:!!document.querySelector('input[data-ib=\"val\"]'),t2:!!document.querySelector('input[data-ib=\"t2\"]')})")
        chk("Growth Curve: a Number and the text before it", g["val"] and g["t2"], g)
        await E("()=>{mgAdd150('totem')}"); await pg.wait_for_timeout(300)
        n12 = await E("()=>document.querySelectorAll('.pk206b').length"); chk("Totem Wall: 12 picture slots", n12 == 12, n12)
        await E("()=>{mgAdd150('frameEscape')}"); await pg.wait_for_timeout(300)
        await pg.click('.pk206b[data-i="0"]'); await pg.wait_for_selector('#modalRoot input[data-mg206up]', state="attached", timeout=5000)
        await E("()=>setPic206(0,'/media/red.png')"); await pg.wait_for_timeout(500)
        sp = await E("()=>{const it=edItem(edPick());return{pics:it.pics,img:!!document.querySelector('.pk206b[data-i=\"0\"] img'),count:(document.querySelector('.pk206')||{}).previousElementSibling?.textContent||''}}")
        chk("a picture slot takes a picture (shown in the slot)", sp["pics"] == ["/media/red.png"] and sp["img"], sp)
        # 3. a recipe on a timeline of its own
        await E("()=>rec206('rawedit')"); await pg.wait_for_timeout(600)
        rc = await E("()=>({sc:S.ed.infos.filter(x=>x.type==='mg150').map(x=>x.sc),bg:(S.ed.infos.find(x=>x.sc==='greenScreen')||{}).bg,clips:S.ed.clips.length,total:edTotal()})")
        chk("Raw vs Edited: Green Screen → Frame Break → Vlog on its own timeline", rc["sc"] == ["greenScreen", "frameBreak", "vlog"] and rc["bg"] == "none" and rc["clips"] == 1, rc)
        # 4. the export has the slot's picture
        await E("()=>{const it=S.ed.infos.find(x=>x.sc==='greenScreen');it.pics=['/media/red.png'];delete IMG206['/media/red.png'];S.ed.infos=S.ed.infos.filter(x=>x.sc==='greenScreen');S.ed.clips[0].out=2;it.start=0;it.end=2;S.ed.fmtOut='webm';S.ed.format='landscape';persist();renderView()}")
        async with pg.expect_download(timeout=240000) as dl: await E("()=>{edExport()}")
        d = await dl.value; f = D + "/exp_" + d.suggested_filename; await d.save_as(f)
        mid, side = pixel(f, .2, .5, .55), pixel(f, .2, .1, .5); out["export"] = {"mid": mid, "side": side, "name": d.suggested_filename}
        chk("the exported file: the slot's picture (red) inside the green screen", mid[0] > 180 and mid[1] < 90 and mid[2] < 90 and side[1] > 150 and side[0] < 120, out["export"])
        chk("page: no errors", not errs, errs[:3]); await b.close()
try: asyncio.run(main())
finally:
    srv.terminate()
    try: srv.wait(timeout=5)
    except Exception: srv.kill()
    subprocess.run(["rm", "-rf", D])
print(json.dumps({"out": out, "fails": fails}, ensure_ascii=False, default=str)[:3000]); sys.exit(1 if fails else 0)
