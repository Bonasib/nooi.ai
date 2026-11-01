# v215 — subject first, picture → 3D model, and the 3D World viewport in the owner's designs.
#  · plan.js: no place named → a clean studio stage with just the subject (never a field of weeds); "Fish aquarium 3meter*3meter"
#    (EN/AR/cm) → an aquarium of that size with fish swimming INSIDE it; a thing the reader can't build → a named glass stand-in;
#    places that are named still win (a desert oasis stays an oasis; a garage stays the garage room)
#  · the world: the aquarium on the stage, its fish given the tank's water as their box and staying in it as they swim
#  · Realistic: a stage pays for no panorama; each main thing is drawn first by the image engine (role ref3d) and the 3D engine
#    makes the model from that picture (role model) — no 3D job straight from words, no panorama job
#  · the page: computer — stage left (Walk · Fly · Orbit named, lens + frame chip, the empty stage), Build your world right
#    (count, Add image, Characters, Time, Weather, Look, Create), Start with an idea cards (drawn), Camera presets drawn from the
#    world (tap → the camera frames it); phone (Arabic) — Scene · Camera · Characters tabs, no page wider than the screen
# Run: python3 tests/v215.py
import asyncio, json, os, struct, subprocess, sys, tempfile, time, urllib.request, zlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8687; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v215-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
def png(w, h):
    raw = b"".join(b"\x00" + bytes([200, 120, 60]) * w for _ in range(h)); ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
open(D + "/media/ref.png", "wb").write(png(32, 32))
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))

NODE = """
import { localPlan, cleanPlan } from "%s/public/world/plan.js";
const o = {}, q = (k, s) => { const p = localPlan(s); o[k] = { place: p.place, room: p.room || "", obj: p.objects.map(x => [x.type, x.dims || null, x.name || ""]), life: p.life.map(l => [l.type, l.count]), spawn: p.spawn.at, missed: p.missed || [], dress: p.dress }; };
q("aq", "Fish aquarium 3meter*3meter space"); q("aqar", "\\u062d\\u0648\\u0636 \\u0633\\u0645\\u0643 \\u0663 \\u0645\\u062a\\u0631 \\u0641\\u064a \\u0663 \\u0645\\u062a\\u0631"); q("cm", "a fish tank 120cm x 50cm x 60cm");
q("fish", "some fish"); q("dragon", "a flying dragon"); q("car", "a red sports car"); q("oasis", "a desert oasis at sunset with palm trees"); q("garage", "garage with old car");
o.clean = cleanPlan({ objects: [{ type: "aquarium", dims: [3, 1.8, 3] }, { type: "aquarium", dims: [1, "x", 2] }], life: [{ type: "fish", count: 5, box: { x: 0, z: 0, hx: 1, hz: 1, y0: 0.5, y1: 1.5 } }] });
o.clean = { dims: o.clean.objects.map(x => x.dims || null), box: !!o.clean.life[0].box };
console.log(JSON.stringify(o));
""" % ROOT
r = subprocess.run(["node", "--input-type=module", "-e", NODE], capture_output=True, text=True, timeout=60)
try: P = json.loads(r.stdout.strip().splitlines()[-1])
except Exception: P = {}; chk("node plan checks ran", False, (r.stdout[-300:], r.stderr[-300:]))
if P:
    out["plan"] = P
    a = P["aq"]; chk("Fish aquarium 3meter*3meter → a 3 × 3 m aquarium on a stage, nothing else", a["place"] == "stage" and a["obj"] == [["aquarium", [3, 1.8, 3], ""]] and a["missed"] == [], a)
    chk("its fish swim in it (20 of them), the camera a few metres away", a["life"] == [["fish", 20]] and 4 < a["spawn"][1] < 9, a)
    chk("Arabic: حوض سمك ٣ متر في ٣ متر → the same aquarium", P["aqar"]["obj"] == [["aquarium", [3, 1.8, 3], ""]] and P["aqar"]["missed"] == [], P["aqar"])
    chk("centimetres: 120 × 50 × 60 cm → 1.2 m wide, 0.6 high, 0.5 deep", P["cm"]["obj"] == [["aquarium", [1.2, 0.6, 0.5], ""]], P["cm"])
    chk("fish with no water named live in a tank", P["fish"]["obj"][0][0] == "aquarium" and P["fish"]["life"][0][0] == "fish", P["fish"])
    chk("a thing the reader can't build is a named stand-in on the stage", P["dragon"]["place"] == "stage" and P["dragon"]["obj"] == [["subject", None, "flying dragon"]], P["dragon"])
    chk("a car alone stands on the stage — no meadow, no plants", P["car"]["place"] == "stage" and P["car"]["obj"][0][0] == "car", P["car"])
    chk("a named place still wins (a desert oasis stays an oasis)", P["oasis"]["place"] == "oasis", P["oasis"])
    chk("the garage stays the garage room", P["garage"]["place"] == "room" and P["garage"]["room"] == "garage", P["garage"])
    chk("cleanPlan keeps good dims and tank boxes, drops bad ones", P["clean"] == {"dims": [[3, 1.8, 3], None], "box": True}, P["clean"])
lw = open(ROOT + "/lib/world.js", encoding="utf-8").read()
chk("the AI plans get the same rules (stage, aquarium dims, subject)", 'use place "stage"' in lw and '"aquarium"' in lw and '"subject"' in lw)

async def page(p, lang, w, h):
    b = await p.chromium.launch(); mob = w < 700
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
    await pg.evaluate("(l)=>{S.langAsked=true;S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';S.world.prompt='';S.world.tab215='scene';go('world');renderAll()}", lang)
    await pg.wait_for_function("document.querySelector('#nwstage .nw215empty')", timeout=20000); await pg.wait_for_timeout(600)
    return b, pg, errs

async def main():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        # ---- computer
        b, pg, errs = await page(p, "en", 1440, 900); E = pg.evaluate
        r = await E("""()=>{const st=document.getElementById('nwstage').getBoundingClientRect(),bar=document.querySelector('.nw-bar').getBoundingClientRect(),q=s=>document.querySelector(s);
          return{side:bar.left>st.right-1,title:(q('.nw215bh h2')||{}).textContent,count:(q('.nw215cnt')||{}).textContent,add:!!q('.nw215dz'),chars:!!q('.nw215chars'),
            modes:[...document.querySelectorAll('.nw215seg .nw215l')].map(x=>x.textContent),lens:!!q('.nw215lens'),empty:getComputedStyle(q('.nw215empty')).display,
            cards:document.querySelectorAll('.nw215card svg path').length>20?document.querySelectorAll('.nw215card').length:0,over:document.documentElement.scrollWidth-innerWidth,
            order:['.nw215bh','#nwprompt','.nw-add','.nw215chars','.nw-opts','.nw-go'].map(s=>Math.round(q(s).getBoundingClientRect().top))}}""")
        chk("computer: Build your world on the right of the stage, in the designed order", r["side"] and r["title"] == "Build your world" and r["count"] == "0/600" and r["add"] and r["chars"] and r["order"] == sorted(r["order"]), r)
        chk("computer: Walk · Fly · Orbit named on the stage, the lens chip, the empty stage", r["modes"] == ["Walk", "Fly", "Orbit"] and r["lens"] and r["empty"] == "flex", r)
        chk("computer: four drawn idea cards, nothing wider than the screen", r["cards"] == 4 and r["over"] <= 1, r)
        await pg.click('[data-act="nw215-more"]'); await pg.wait_for_timeout(200)
        chk("View more shows all six ideas", await E("document.querySelectorAll('.nw215card').length") == 6)
        await E("()=>{S.world.prompt='';nwRefresh()}")
        await E("async()=>{const M=await nwMods();await nwBuild(M.localPlan('Fish aquarium 3meter*3meter space'))}"); await pg.wait_for_timeout(800)
        r = await E("""()=>{const W=NW.W,tk=(W.info||[]).find(x=>x.type==='aquarium'),f=W.plan.life.find(l=>l.type==='fish');return{place:W.stats().place,tank:!!tk,dims:tk&&tk.md.tank,box:f&&f.box,life:W.stats().life,
          trees:(W.info||[]).filter(x=>['tree','pine','palm','bush','flowers','grass'].includes(x.type)).length,plants:W.plantTypes().length}}""")
        chk("the aquarium stands on the stage, alone — no trees, no plants", r["place"] == "stage" and r["tank"] and r["trees"] == 0 and r["plants"] == 0, r)
        chk("the fish get the tank's water as their box", r["box"] and r["life"] >= 10 and abs(r["box"]["hx"] - 1.28) < 0.05, r)
        r = await E("""async()=>{const sc=NW.W.scene,box=NW.W.plan.life.find(l=>l.type==='fish').box;await new Promise(q=>setTimeout(q,1200));const bad=[];
          sc.traverse(o=>{if(o.isInstancedMesh&&o.parent&&o.count>=10&&o.count<=30&&!o.userData.type){const m=new o.matrixWorld.constructor(),v=o.position.clone();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);v.setFromMatrixPosition(m);
            if(Math.abs(v.x-box.x)>box.hx+.35||Math.abs(v.z-box.z)>box.hz+.35||v.y<box.y0-.4||v.y>box.y1+.4)bad.push([+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(2)])}}});return{bad:bad.slice(0,4),n:bad.length}}""")
        chk("every fish stays inside the tank as it swims", r["n"] == 0, r)
        await pg.wait_for_function("NW.thumbs215&&Object.keys(NW.thumbs215.u).length===5", timeout=30000); await pg.wait_for_timeout(300)
        r = await E("()=>({th:[...document.querySelectorAll('.nw215shot img')].length,lbl:[...document.querySelectorAll('.nw215shot b')].map(x=>x.textContent)})")
        chk("Camera presets: five, each a picture drawn from the world", r["th"] == 5 and r["lbl"] == ["Wide", "Close up", "Top view", "Side view", "Cinematic"], r)
        await pg.click('[data-act="nw215-shot"][data-k="top"]'); await pg.wait_for_timeout(500)
        r = await E("()=>({mode:NW.W.player.mode,y:NW.W.player.camera.position.y,on:document.querySelector('[data-act=nw215-shot][data-k=top]').getAttribute('aria-pressed')})")
        chk("tapping Top view frames the tank from above", r["mode"] == "orbit" and r["y"] > 4 and r["on"] == "true", r)
        r = await E("""()=>{const c=NW.W.player.camera,f0=c.fov;document.querySelector('[data-act=nw215-lenscyc]').click();document.querySelector('[data-act=nw215-lenscyc]').click();const f1=c.fov,lab=document.querySelector('.nw215lens b').textContent;
          document.querySelector('.nw215lens [data-act=nw215-aspect]').click();return{f0,f1,lab,asp:document.getElementById('nwstage').style.aspectRatio,chip:document.querySelector('.nw215lens [data-act=nw215-aspect]').textContent}}""")
        chk("the lens chip changes the lens (18mm), the frame chip the frame (4:5)", r["lab"] == "18mm" and abs(r["f1"] - r["f0"]) > 0.5 and r["asp"].replace(" ", "") == "4/5" and r["chip"] == "4:5", r)
        await E("()=>{S.world.lens215=0;S.world.aspect215='16:9';applyCam215()}")
        # ---- Realistic: the picture first, then the model from it; no panorama on a stage
        r = await E("""async()=>{NW.caps={ai:false,vision:false,worldlabs:false,objects3d:true,images:true,pano:true,cost:{plan:1}};const calls=[],o=addJob;
          addJob=(j)=>{calls.push(j);return Object.assign({id:'c'+calls.length},j)};try{await nwRealistic(null)}finally{addJob=o}
          const cost=nwRealCost(),one=nwObjCost(),img=nwPanoCost(),left=[],c2=[];addJob=(j)=>{c2.push(j);return{id:'m1'}};
          try{await nwRef3d215({resultUrl:'/media/ref.png',status:'complete'},Object.assign({seed:NW.W.plan.seed},calls[0].meta.nw),left)}finally{addJob=o}
          return{kinds:calls.map(j=>j.kind+':'+(j.meta&&j.meta.nw&&j.meta.nw.role)),prompt:calls[0]&&calls[0].prompt,cost,one,img,then:c2.map(j=>j.kind+':'+j.meta.nw.role+':'+j.meta.mode),left}}""")
        chk("Realistic on a stage: one picture job for the tank (role ref3d), no panorama, no straight 3D job", r["kinds"] == ["image:ref3d"] and "3 m wide" in (r["prompt"] or "") and "white background" in (r["prompt"] or ""), r)
        chk("the picture becomes the 3D model (role model), and the world waits for it", r["then"] == ["3d:model:objects"] and r["left"] == ["m1"], r)
        chk("the price: the picture + the model, no panorama", r["cost"] == r["one"] + r["img"], r)
        chk("computer: no page errors", not errs, errs); await b.close()
        # ---- phone, Arabic: the Director
        b, pg, errs = await page(p, "ar", 390, 844); E = pg.evaluate
        r = await E("()=>({tabs:[...document.querySelectorAll('.nw215tabs [role=tab]')].map(x=>x.textContent.trim()),vis:getComputedStyle(document.querySelector('.nw215tabs')).display,lbl:getComputedStyle(document.querySelector('.nw215l')).display})")
        chk("phone: Scene · Camera · Characters tabs over the stage, modes as icons", r["tabs"] == ["المشهد", "الكاميرا", "الشخصيات"] and r["vis"] == "flex" and r["lbl"] == "none", r)
        await E("async()=>{const M=await nwMods();await nwBuild(M.localPlan('حوض سمك ٣ متر في ٣ متر'))}"); await pg.wait_for_timeout(600)
        await pg.click('[data-act="nw215-tab"][data-v="camera"]'); await pg.wait_for_function("NW.thumbs215&&Object.keys(NW.thumbs215.u).length===5", timeout=30000); await pg.wait_for_timeout(300)
        r = await E("()=>({bar:getComputedStyle(document.querySelector('.nw-bar')).display,cam:getComputedStyle(document.querySelector('.nw215cam')).display,th:document.querySelectorAll('.nw215shot img').length,over:document.documentElement.scrollWidth-innerWidth})")
        chk("phone: the Camera tab shows the presets (drawn) instead of the words", r["bar"] == "none" and r["cam"] != "none" and r["th"] == 5 and r["over"] <= 1, r)
        await pg.click('[data-act="nw215-tab"][data-v="chars"]'); await pg.wait_for_timeout(300)
        r = await E("()=>({ch:document.querySelector('.nw215chars').getClientRects().length,ta:document.getElementById('nwprompt').getClientRects().length,add:!!document.querySelector('.nw215chars .nw215add')})")
        chk("phone: the Characters tab shows your characters to put in (the words wait in Scene)", r["ch"] > 0 and r["ta"] == 0 and r["add"], r)
        chk("phone: no page errors", not errs, errs); await b.close()
try:
    asyncio.run(main())
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:5000])
print("v215 OK" if not fails else "v215 FAIL")
sys.exit(1 if fails else 0)
