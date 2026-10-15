# v87 in a real browser with a real nooi server (no AI keys; the engines' answers are played by the page's own request hook,
# 3D people are test models made by tests/human_glb.py). Desktop (English) and Arabic phone:
#  · characters are real: a face picture or an empty frame with "Make it real" — no drawn people; making one real sends a
#    photoreal look job (no captions, no drawings)
#  · UGC ads: ready presenters are photos (no letters); the owner can make the missing ones; the chosen presenter's face goes with
#    every step (face → photo with the product → video from that photo, Kling 3.0 Turbo); a presenter without a face gets one first
#  · "@" in any prompt (home, Video, Image, 3D World): the list, the chip, the face on the job; a video starts from a picture of
#    that person; a prompt without @ is left alone
#  · one video player: play/pause, seek with the time, sound, full screen; the viewer covers the page, the page's video stops;
#    results are compact on a phone; no percentage numbers anywhere
#  · the 3D World opens empty, words make it come alive (reveal), real-looking people walk to what the words say, run, wave;
#    your character sits on the bench; "New world" is empty again; "Auto" time is daytime; nothing sideways; no page errors
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8189
sys.path.insert(0, ROOT + "/tests"); import human_glb
D = tempfile.mkdtemp(prefix="nooi-v87-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=24:duration=6", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libvpx-vp9", "-b:v", "300k", "-c:a", "libopus", D + "/media/clip.webm"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=640x640:rate=1", "-frames:v", "1", D + "/media/face.png"], check=True)
human_glb.glb(D + "/media/person.glb"); human_glb.glb(D + "/media/person-turned.glb", turn=1); human_glb.glb(D + "/media/person-zup.glb", zup=True)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SET = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'Sara',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}"
async def until(pg, js, sec=40, arg=None):
    for _ in range(sec * 4):
        try:
            if await (pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)): return True
        except Exception: pass
        await asyncio.sleep(.25)
    return False
# the page's requests to /v1/jobs are answered here (what was sent is kept), and jobs finish when the test says so
HOOK = """()=>{if(window.T87)return;const T=window.T87={sent:[],state:{},n:0};const real=API.req.bind(API);
  API.req=async(p,o)=>{if(p==='/v1/jobs'&&o&&o.json){const id='r'+(++T.n);T.sent.push({id,kind:o.json.kind,inputs:Object.keys(o.json.inputs||{}),inp:o.json.inputs||{},prompt:String(o.json.prompt||''),model:o.json.model,meta:o.json.meta||{}});T.state[id]={status:'rendering'};return {id,cost:1}}
    const m=/^\\/v1\\/jobs\\/(r\\d+)$/.exec(p);if(m)return T.state[m[1]]||{status:'rendering'};return real(p,o)};
  T.done=(id,u)=>{T.state[id]={status:'done',url:u||'/media/face.png'}}}"""
CHARS = """()=>{S.chars=S.chars.filter(c=>!/^c87/.test(c.id));
  S.chars.push(normChar({id:'c87a',name:'Faisal',age:31,gender:'male',look:'short beard',voice:{dialect:'najdi',gender:'male',age:'adult',tone:'warm'},looks:[1,2,3,4],lookSeed:null,locked:true,face:'/media/face.png'}));
  S.chars.push(normChar({id:'c87b',name:'Noura K',age:28,gender:'female',look:'long dark hair',voice:{dialect:'najdi',gender:'female',age:'adult',tone:'warm'},looks:[1,2,3,4],lookSeed:null,locked:true}));
  S.chars.push(normChar({id:'c87c',name:'Omar Z',age:40,gender:'male',look:'',voice:{dialect:'najdi',gender:'male',age:'adult',tone:'warm'},looks:[1,2,3,4],lookSeed:null,locked:true}));persist()}"""
LAST = "()=>window.T87.sent.length"

async def page_run(p, W, lang):
    mob = W < 600; tag = f"{lang} {W}"; r = {}
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
    ctx = await b.new_context(viewport={"width": W, "height": 844 if mob else 900}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:240]))
    # two ready-made presenters exist (the rest are not made yet); the owner's "make them" call is answered here
    async def avatars(route): await route.fulfill(status=200, content_type="application/json", body=json.dumps({"items": [{"id": "av-faisal", "name": ["Faisal", "فيصل"], "gender": "male", "who": "a Saudi man in a white thobe", "url": "/media/face.png"}, {"id": "av-noura", "name": ["Noura", "نورة"], "gender": "female", "who": "a Saudi woman in an abaya", "url": "/media/face.png"}], "total": 15, "making": 0}))
    made = []
    async def showcase(route):
        made.append(route.request.post_data); await route.fulfill(status=200, content_type="application/json", body=json.dumps({"items": []}))
    await pg.route("**/v1/avatars", avatars); await pg.route("**/v1/admin/showcase", showcase)
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await pg.evaluate(SET, lang)
    E = pg.evaluate; await E(HOOK); await E(CHARS)
    # ---- characters: real faces only
    await E("()=>{S.charSel=S.chars.findIndex(c=>c.id==='c87a');go('chars')}"); await pg.wait_for_timeout(600)
    r["chars"] = await E("()=>({face:!!document.querySelector('.cpv87 img'),drawn:document.querySelectorAll('#main canvas[data-ref^=\"cp:\"],#main canvas[data-ref^=\"cb:\"],#main canvas[data-ref^=\"look:\"]').length,list:[...document.querySelectorAll('.charrow .thumb')].map(t=>t.className.includes('face87')).every(Boolean)})")
    ok(r["chars"]["face"] and r["chars"]["drawn"] == 0 and r["chars"]["list"], f"{tag}: characters show a real face or an empty frame — no drawn people {r['chars']}")
    await E("()=>{S.charSel=S.chars.findIndex(c=>c.id==='c87b');renderView()}"); await pg.wait_for_timeout(300)
    ok(await E("()=>!!document.querySelector('[data-act=real87]')&&!!document.querySelector('[data-act=real87-all]')"), f"{tag}: a character without a face offers \"Make it real\" (and all at once)")
    n0 = await E(LAST); await E("()=>document.querySelector('[data-act=real87]').click()")
    ok(await until(pg, "(n)=>window.T87.sent.length>n", 15, n0), f"{tag}: Make it real sent a job")
    j = await E("()=>window.T87.sent.at(-1)")
    ok(j["kind"] == "look" and j["meta"].get("real87") and "Photorealistic" in j["prompt"] and "No text" in j["prompt"], f"{tag}: a real look: photoreal, never a caption or a drawing {j['kind']} {j['prompt'][-160:]}")
    await E("(id)=>window.T87.done(id,'/media/face.png')", j["id"])
    ok(await until(pg, "()=>!!charById('c87b').face", 15), f"{tag}: the finished look became the character's face")
    # looks of a character with a face are made FROM that face (the quick picture engine keeps the face); the button shows 4 × its price
    await E("()=>{S.charSel=S.chars.findIndex(c=>c.id==='c87a');renderView()}"); await pg.wait_for_timeout(300)
    r["lkPrice"] = await E("()=>[document.querySelector('[data-act=gen-looks]').textContent.replace(/\\s+/g,' ').trim(),4*lookCost87(),LOOK87()]")
    ok(str(r["lkPrice"][1]) in r["lkPrice"][0], f"{tag}: the looks button shows what 4 looks from the face cost {r['lkPrice']}")
    n0 = await E(LAST); await E("()=>document.querySelector('[data-act=gen-looks]').click()")
    ok(await until(pg, "(n)=>window.T87.sent.length>=n+4", 15, n0), f"{tag}: 4 looks sent")
    lk = await E("(n)=>window.T87.sent.slice(n)", n0)
    ok(len(lk) == 4 and all(x["kind"] == "look" and x["inp"].get("chRef") == "/media/face.png" and x["model"] == r["lkPrice"][2] for x in lk), f"{tag}: the 4 looks are made from the character's own face {[(x['kind'], x['model'], x['inp']) for x in lk]}")
    # with no face yet, the 4 looks are candidate real faces (the face engine, no reference): the first that finishes becomes the face
    await E("()=>{S.chars.push(normChar({id:'c87d',name:'Sami',age:35,gender:'male',look:'curly hair',voice:{dialect:'najdi',gender:'male',age:'adult',tone:'warm'},looks:[1,2,3,4],lookSeed:null,locked:true}));S.charSel=S.chars.findIndex(c=>c.id==='c87d');renderView()}"); await pg.wait_for_timeout(300)
    n0 = await E(LAST); await E("()=>document.querySelector('[data-act=gen-looks]').click()")
    ok(await until(pg, "(n)=>window.T87.sent.length>=n+4", 15, n0), f"{tag}: 4 candidate looks sent")
    lk = await E("(n)=>window.T87.sent.slice(n)", n0); fm = await E("()=>FACE87()")
    ok(len(lk) == 4 and all(x["kind"] == "look" and not x["inp"].get("chRef") and x["model"] == fm for x in lk), f"{tag}: no face yet → 4 candidate real faces {[(x['kind'], x['model'], x['inp']) for x in lk]}")
    await E("(id)=>window.T87.done(id,'/media/face.png')", lk[1]["id"])
    ok(await until(pg, "()=>!!face87(charById('c87d'))", 15), f"{tag}: the first candidate that finishes is the face")
    await E("()=>{S.chars=S.chars.filter(c=>c.id!=='c87d');S.charSel=0;persist()}")
    ok(await E("()=>{S.charSel=S.chars.findIndex(c=>c.id==='c87c');renderView();return [...document.querySelectorAll('.cpv87 svg')].every(s=>s.getBoundingClientRect().width<=44||s.parentElement.classList.contains('face-ph87'))}"), f"{tag}: only the face placeholder is big (the button's icons stay small)")
    # ---- UGC ads: presenters with photos, the face on every step
    await E("()=>{go('ugcads')}"); await pg.wait_for_timeout(900)
    r["pres"] = await E("()=>({tiles:document.querySelectorAll('.pres87 .pt87').length,letters:[...document.querySelectorAll('.pres87 .ph b, .avc80 b')].length,ready:document.querySelectorAll('.pres87 [data-act=ugc-av87]').length,owner:!!document.querySelector('[data-act=av87-make]')})")
    ok(r["pres"]["letters"] == 0 and r["pres"]["ready"] == 2, f"{tag}: ready presenters are photos, no letters {r['pres']}")
    ok(r["pres"]["owner"], f"{tag}: the owner can make the presenters that are missing {r['pres']}")
    await E("()=>document.querySelector('[data-act=av87-make]').click()"); await pg.wait_for_timeout(800)
    ok(made and '"avatars"' in (made[0] or ""), f"{tag}: Make the presenters' photos asks the server for them {made[:1]}")
    await E("()=>{const b=document.querySelector('.pres87 [data-act=ugc-av87][data-v=av-noura]');b&&b.click()}"); await pg.wait_for_timeout(300)
    r["avpick"] = await E("()=>{const c=charById(S.draft.charId);return c?[c.id,c.face,c.av87]:null}")
    ok(r["avpick"] and r["avpick"][1] == "/media/face.png", f"{tag}: picking a ready presenter gives the ad that person's photo {r['avpick']}")
    n0 = await E(LAST)
    await E("()=>{S.draft.ugc.mode='presenter';S.draft.ugc.name='Desert perfume';S.draft.charId='c87a';delete M.ugcP;ugcMake79()}")
    ok(await until(pg, "(n)=>window.T87.sent.length>n", 15, n0), f"{tag}: the ad started")
    u1 = await E("()=>window.T87.sent.at(-1)")
    ok(u1["kind"] == "image" and u1["inp"].get("iRef") == "/media/face.png" and "reference picture" in u1["prompt"], f"{tag}: step 1 is a photo of THAT presenter (their face as the reference) {u1['kind']} {u1['inputs']}")
    await E("(id)=>window.T87.done(id,'/media/face.png')", u1["id"])
    ok(await until(pg, "(n)=>window.T87.sent.length>n+1", 20, n0), f"{tag}: step 2 started")
    u2 = await E("()=>window.T87.sent.at(-1)")
    ok(u2["kind"] == "video" and "vStart" in u2["inputs"] and u2["model"] == "kling30t", f"{tag}: step 2: the video starts from that photo, on the faster Kling 3.0 Turbo {u2['kind']} {u2['inputs']} {u2['model']}")
    n1 = await E(LAST); await E("()=>{S.draft.charId='c87c';ugcMake79()}")
    ok(await until(pg, "(n)=>window.T87.sent.length>n", 15, n1), f"{tag}: a presenter without a face: started")
    u3 = await E("()=>window.T87.sent.at(-1)"); ok(u3["kind"] == "look" and u3["meta"].get("real87"), f"{tag}: a presenter without a face gets a real face first {u3['kind']}")
    await E("(id)=>window.T87.done(id,'/media/face.png')", u3["id"])
    ok(await until(pg, "(n)=>window.T87.sent.length>n+1&&window.T87.sent.at(-1).kind==='image'", 20, n1), f"{tag}: … then the photo with that new face")
    # ---- "@" in prompts
    for v, ta in (("home", "hfq"), ("video", "dprompt"), ("image", "iprompt")):
        await E("(v)=>{if(v==='home'){S.hf.tab='video'}go(v)}", v); await pg.wait_for_timeout(500)
        r["at_" + v] = await E("""async(id)=>{const t=document.getElementById(id);if(!t)return 'no box';const chip=!!document.querySelector('.ch87b[data-for="'+id+'"]');t.focus();t.value='a film where @Fa';t.setSelectionRange(t.value.length,t.value.length);t.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,200));
          const list=[...document.querySelectorAll('.at87 button b')].map(x=>x.textContent);t.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await new Promise(r=>setTimeout(r,150));return {chip,list,after:t.value}}""", ta)
        # the home box has the Characters chip; Video and Images have their own character list (no second chip pushing the layout)
        a = r["at_" + v]; ok(isinstance(a, dict) and a["chip"] == (v == "home") and a["list"] == ["Faisal"] and a["after"].strip().endswith("@Faisal"), f"{tag}: {v}: the @ list puts the character in (chip only in the home box) {a}")
    await E("()=>go('video')"); await pg.wait_for_timeout(400); n2 = await E(LAST)
    await E("()=>{S.draft.prompt='@Faisal walks into a sunny café';const t=document.getElementById('dprompt');if(t)t.value=S.draft.prompt;makeVideo()}")
    ok(await until(pg, "(n)=>window.T87.sent.length>n", 15, n2), f"{tag}: @video started")
    v1 = await E("()=>window.T87.sent.at(-1)")
    ok(v1["kind"] == "image" and v1["meta"].get("frame87") and v1["inp"].get("iRef") == "/media/face.png" and "@Faisal" not in v1["prompt"], f"{tag}: a video with @Faisal starts with a picture of Faisal (his face) {v1['kind']} {v1['inputs']}")
    await E("(id)=>window.T87.done(id,'/media/face.png')", v1["id"])
    ok(await until(pg, "(n)=>window.T87.sent.length>n+1", 20, n2), f"{tag}: … then the video")
    v2 = await E("()=>window.T87.sent.at(-1)"); ok(v2["kind"] == "video" and "vStart" in v2["inputs"], f"{tag}: the video starts from that picture {v2['inputs']}")
    n3 = await E(LAST); await E("()=>{go('image');makeImages('@Faisal smiling on a rooftop')}")
    ok(await until(pg, "(n)=>window.T87.sent.length>n", 15, n3), f"{tag}: @picture started")
    i1 = await E("()=>window.T87.sent.at(-1)"); ok(i1["kind"] == "image" and i1["inp"].get("iRef") == "/media/face.png", f"{tag}: a picture with @Faisal carries his face {i1['inputs']}")
    n4 = await E(LAST); await E("()=>makeImages('a red apple on a table')")
    ok(await until(pg, "(n)=>window.T87.sent.length>n", 15, n4), f"{tag}: plain picture started")
    i2 = await E("()=>window.T87.sent.at(-1)"); ok(not i2["inputs"] and not i2["meta"].get("chars87"), f"{tag}: a prompt without @ is left alone {i2['inputs']}")
    # the page's own character list ("@ Faisal") carries the face too — a picture with it, a video through a picture of the scene
    n5 = await E(LAST); await E("()=>{S.img.charId='c87a';makeImages('a portrait on a rooftop at sunset')}")
    ok(await until(pg, "(n)=>window.T87.sent.length>n", 15, n5), f"{tag}: picture with a picked character started")
    i3 = await E("()=>window.T87.sent.at(-1)"); ok(i3["kind"] == "image" and i3["inp"].get("iRef") == "/media/face.png" and "Faisal" in i3["prompt"], f"{tag}: the picked character's face goes with the picture {i3['inputs']}")
    await E("()=>{S.img.charId=''}")
    n6 = await E(LAST); await E("()=>{go('video');S.draft.prompt='a man walks along the beach at dawn';S.draft.charId='c87a';const t=document.getElementById('dprompt');if(t)t.value=S.draft.prompt;makeVideo()}")
    ok(await until(pg, "(n)=>window.T87.sent.length>n", 15, n6), f"{tag}: video with a picked character started")
    v3 = await E("()=>window.T87.sent.at(-1)"); ok(v3["kind"] == "image" and v3["meta"].get("frame87") and v3["inp"].get("iRef") == "/media/face.png", f"{tag}: a video with a picked character first gets a picture of the scene with that face {v3['kind']} {v3['inputs']}")
    await E("(id)=>window.T87.done(id,'/media/face.png')", v3["id"])
    ok(await until(pg, "(n)=>window.T87.sent.length>n+1&&window.T87.sent.at(-1).kind==='video'", 20, n6), f"{tag}: … then the video from it")
    v4 = await E("()=>window.T87.sent.at(-1)"); ok("vStart" in v4["inputs"], f"{tag}: the video starts from that picture {v4['inputs']}")
    await E("()=>{S.draft.charId=''}")
    # ---- the player, the viewer, compact results, no percentages
    await E("""()=>{S.jobs=S.jobs.filter(j=>!/^jv/.test(j.id));S.jobs.push({id:'jv1',kind:'video',status:'complete',resultUrl:'/media/clip.webm',aspect:'9:16',dur:6,title:'Desert perfume',meta:{type:'ugc',ugc:{}},created:Date.now()});
      S.jobs.push({id:'jv2',kind:'video',status:'rendering',progress:.42,aspect:'9:16',dur:6,title:'Second ad',meta:{type:'ugc',ugc:{}},created:Date.now(),remote:'x'});S.ugc79.last='jv1';go('ugcads')}"""); await pg.wait_for_timeout(1000)
    r["player"] = await E("""async()=>{const w=document.querySelector('.stage .vp87'),v=w&&w.querySelector('video');if(!v)return null;const parts=['.vpbig','.vpp','.vps','.vpt','.vpd','.vpm','.vpf'].every(s=>!!w.querySelector(s));
      v.muted=true;await v.play().catch(()=>{});await new Promise(r=>setTimeout(r,1300));const t=w.querySelector('.vpt').textContent,d=w.querySelector('.vpd').textContent;const sk=w.querySelector('.vps');sk.value=500;sk.dispatchEvent(new Event('input',{bubbles:true}));sk.dispatchEvent(new Event('change',{bubbles:true}));
      const st=document.querySelector('.stage.st87').getBoundingClientRect();return {parts,native:v.hasAttribute('controls'),playing:!v.paused,t,d,seek:Math.round(v.currentTime*10)/10,w:Math.round(st.width),h:Math.round(st.height),vw:innerWidth,vh:innerHeight}}""")
    pl = r["player"]; ok(pl and pl["parts"] and not pl["native"] and pl["playing"] and pl["d"] == "0:06" and 2.5 <= pl["seek"] <= 3.5, f"{tag}: one player: play/pause, the time, seek, sound, full screen {pl}")
    if mob: ok(pl and pl["w"] <= pl["vw"] * 0.62 and pl["h"] <= pl["vh"] * 0.56, f"{tag}: the result is compact on a phone {pl}")
    # a page redraw (a job starting or finishing somewhere) doesn't stop or restart the video being watched
    r["redraw"] = await E("""async()=>{const v=document.querySelector('.stage .vp87 video');if(!v)return null;v.muted=true;await v.play().catch(()=>{});await new Promise(r=>setTimeout(r,400));const t0=v.currentTime;
      statusChanged();renderView();await new Promise(r=>setTimeout(r,700));const now=document.querySelector('.stage .vp87 video');return {same:now===v,connected:v.isConnected,playing:!v.paused,moved:Math.round((v.currentTime-t0)*10)/10,players:document.querySelectorAll('.stage .vp87').length}}""")
    rd = r["redraw"]; ok(rd and rd["same"] and rd["connected"] and rd["playing"] and rd["moved"] > 0 and rd["players"] == 1, f"{tag}: a page redraw doesn't stop the video you're watching {rd}")
    r["viewer"] = await E("""async()=>{const v=document.querySelector('.stage .vp87 video');viewMedia80('/media/clip.webm','video');await new Promise(r=>setTimeout(r,900));const d=document.querySelector('.mv80'),vw=d&&d.querySelector('.vp87.mvp video');
      if(vw){await vw.play().catch(()=>{});await new Promise(r=>setTimeout(r,500))}const pv=document.querySelector('.app .stage .vp87 video')||v;
      const o={viewer:!!vw,pagePaused:pv.paused,pageHidden:getComputedStyle(pv).visibility,bg:getComputedStyle(d).backgroundColor,viewerPlaying:vw&&!vw.paused};
      pv.play().catch(()=>{});await new Promise(r=>setTimeout(r,400));o.behind=pv.paused;d.querySelector('[data-mv=close]').click();await new Promise(r=>setTimeout(r,300));o.closed=!document.querySelector('.mv80');
      pv.muted=false;await pv.play().catch(()=>{});const q=document.querySelector('.ugc79 video:not(.mvm)');o.oneAtATime=!pv.paused;return o}""")
    vv = r["viewer"]; ok(vv["viewer"] and vv["pagePaused"] and vv["pageHidden"] == "hidden" and vv["bg"] == "rgb(0, 0, 0)" and vv["viewerPlaying"] and vv["behind"] and vv["closed"] and vv["oneAtATime"], f"{tag}: the viewer covers the page, nothing plays behind it, and the page plays again after {vv}")
    r["pct"] = await E("()=>[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&/\\d\\s?%/.test(e.textContent)&&e.offsetParent).map(e=>(e.className||e.tagName)+':'+e.textContent.trim()).slice(0,5)")
    ok(not r["pct"], f"{tag}: no percentage numbers {r['pct']}")
    # ---- the 3D World: empty, then alive with real-looking people
    await E("()=>{S.world.plan=null;if(typeof NW!=='undefined'){NW.session87=null}go('world')}")
    ok(await until(pg, "()=>S.view==='world'&&typeof NW!=='undefined'&&!!NW.E&&!!NW.empty87&&!NW.W", 60), f"{tag}: the 3D World opens empty")
    r["empty"] = await E("()=>getComputedStyle(document.querySelector('.nw-stage'),'::after').content")
    ok(("comes to life" in r["empty"]) if lang == "en" else ("حيّاً" in r["empty"]), f"{tag}: the empty stage says what to do {r['empty']}")
    await E("""()=>{NW87.cast={items:[{id:'man-thobe',gender:'male',age:34,url:'/media/person.glb'},{id:'woman-casual',gender:'female',age:28,url:'/media/person-turned.glb'},{id:'boy',gender:'male',age:9,url:'/media/person-zup.glb'}],total:8,making:0};NW87.castAt=Date.now()}""")
    say = "A park with a red car, a man walks to the car, a woman waves and two boys run" if lang == "en" else "حديقة فيها سيارة حمراء، رجل يمشي إلى السيارة وامرأة تلوح وولدان يركضان"
    await E("(t)=>{const a=document.getElementById('nwprompt');a.value=t;a.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-act=nw-go]').click()}", say)
    t0 = time.time(); ok(await until(pg, "()=>!!NW.W&&!NW.busy", 60), f"{tag}: words → a world"); r["buildSec"] = round(time.time() - t0, 1)
    ok(await until(pg, "()=>NW.W.people.count>=4&&NW.W.revealed", 30), f"{tag}: the world came to life with its people " + json.dumps(await E("()=>[NW.W.people.count,NW.W.revealed,(NW.W.plan.people||[]).map(e=>e.act+':'+(e.target||''))]")))
    r["time"] = await E("()=>NW.W.plan.time"); ok(6 < r["time"] < 18, f"{tag}: Auto time is daytime ({r['time']})")
    r["moves"] = await E("""async()=>{const P=NW.W.people.list,man=P.find(p=>p.st.act==='walk'),run=P.filter(p=>p.st.act==='run'),d0=man&&man.tgt?Math.hypot(man.x-man.tgt.x,man.z-man.tgt.z):0,r0=run.map(p=>[p.x,p.z]);
      await new Promise(r=>setTimeout(r,3000));return {acts:P.map(p=>p.st.act).sort().join(','),closer:man&&man.tgt?Math.round((d0-Math.hypot(man.x-man.tgt.x,man.z-man.tgt.z))*10)/10:null,ran:run.map((p,i)=>Math.round(Math.hypot(p.x-r0[i][0],p.z-r0[i][1])))}}""")
    m = r["moves"]; ok(m["acts"] == "run,run,walk,wave" and (m["closer"] or 0) > 1 and all(x > 2 for x in m["ran"]), f"{tag}: they do what the words say (walk to the car, run, wave) {m}")
    if not mob:
        r["fit"] = await E("""async()=>{const {loadHuman}=await import('/world/human.js');const o={};for(const f of ['person','person-turned','person-zup']){const J=(await loadHuman(NW.E.T,'/media/'+f+'.glb')).J;o[f]=J.l_toe[2]>J.l_foot[2]&&J.head[1]>J.chest[1]&&J.l_thigh[0]>0&&!J.armsDown.l}return o}""")
        ok(all(r["fit"].values()), f"{tag}: the skeleton fits a model however it was saved (turned round, Z up) {r['fit']}")
    # your character sits on the bench; New world is empty again
    await E("()=>{charById('c87a').body3d='/media/person.glb';document.querySelector('[data-act=nw-new]').click()}"); await pg.wait_for_timeout(700)
    ok(await E("()=>!!NW.empty87&&!NW.W"), f"{tag}: New world goes back to the empty stage")
    say2 = "@Faisal sits on the bench in a quiet park" if lang == "en" else "@Faisal يجلس على المقعد في حديقة هادئة"
    await E("(t)=>{const a=document.getElementById('nwprompt');a.value=t;a.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-act=nw-go]').click()}", say2)
    ok(await until(pg, "()=>!!NW.W&&!NW.busy&&NW.W.people.list.some(p=>p.entry.char==='c87a')", 60), f"{tag}: your character walks into the world")
    ok(await until(pg, "()=>{const me=NW.W.people.list.find(p=>p.entry.char==='c87a');return me&&me.seat&&me.st.act==='sit'&&me.st.doing&&me.tx==null}", 25), f"{tag}: … and sits on the bench " + json.dumps(await E("()=>{const me=NW.W.people.list.find(p=>p.entry.char==='c87a');return me?[me.st.act,!!me.seat,me.st.doing,me.tx]:null}")))
    r["wide"] = []
    for v in ("world", "ugcads", "chars"):
        await E("(v)=>go(v)", v); await pg.wait_for_timeout(700); r["wide"].append(await E("()=>document.documentElement.scrollWidth-innerWidth"))
    ok(max(r["wide"]) <= 1, f"{tag}: nothing sideways {r['wide']}")
    if mob: await pg.screenshot(path=os.path.join(tempfile.gettempdir(), "v87_phone.png"))
    ok(not errs, f"{tag}: page errors {errs[:4]}")
    await b.close(); return r

async def main():
    async with async_playwright() as p:
        for W, lang in ((1280, "en"), (390, "ar")): out[f"{W}/{lang}"] = await page_run(p, W, lang)

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "LOCAL_LLM", "GEMMA_", "GOOGLE_", "WORLDLABS_", "WORLD_", "KIE_", "TRIPO_", "MESHY_", "BLOCKADE_", "DASHSCOPE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false", MIRROR_MEDIA="false"),
    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
try:
    for _ in range(80):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
        except Exception: time.sleep(.5)
    try: asyncio.run(main())
    except Exception as e: fails.append("browser checks stopped: " + str(e)[:400])
finally:
    srv.terminate()
    try: out["serverLog"] = srv.stderr.read().decode()[-600:]
    except Exception: pass
print(json.dumps({"fails": fails, **out}, ensure_ascii=False, indent=1))
