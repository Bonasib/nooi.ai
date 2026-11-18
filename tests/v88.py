# v88 in a real browser with a real nooi server (no AI keys). Desktop (English) and Arabic phone:
#  · creating works on phones: a big gallery photo is read at once, made a 2048 px JPEG and uploaded in the background (the job
#    reuses that upload); a dropped connection on a new job is tried again; a plain message instead of "Failed to fetch"
#  · prompt boxes are clean: no microphone, no resize grip, the site's own instructions never show in a box, the box is empty
#    after a start (Video, Images)
#  · the parts marked for removal are gone: "Powered by NVIDIA AI", Motion Control 2.6 (3.0 with its logo), the UGC name / price /
#    "what makes it special" fields (one line about the product); the Images page's Generate bar stays in place
#  · pictures everywhere: engine lists show their logos, character lists show faces (an empty frame when there is none),
#    videos on the server get a clear poster frame
#  · × on videos, pictures and characters, always with a confirmation
#  · a photo sent from the home box with "a 3D world I can walk in" builds a walkable World from the photo (not a picture);
#    an indoor photo gets an open floor; words + a photo: the words' world with the photo around you
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8199
sys.path.insert(0, ROOT + "/tests"); import human_glb
D = tempfile.mkdtemp(prefix="nooi-v88-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=24:duration=6", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libvpx-vp9", "-b:v", "300k", "-c:a", "libopus", D + "/media/clip.webm"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=640x640:rate=1", "-frames:v", "1", D + "/media/face.png"], check=True)
human_glb.glb(D + "/media/person.glb")
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SET = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'Sara',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}"

# creating on a phone: big photo, retry, plain errors · clean boxes · the removed parts · logos in the engine list
CREATE = """async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),out={};
  go('image');renderAll();await wait(400);
  out.mics=document.querySelectorAll('.micbtn').length;const ta=document.getElementById('iprompt');out.resize=ta&&getComputedStyle(ta).resize;
  const gen=document.querySelector('.ipage [data-act="gen-images"]'),bar=gen&&gen.closest('.dock98'),br=bar&&bar.getBoundingClientRect();out.genPos=bar&&br.bottom<=innerHeight+1&&br.top>=0?'static':gen&&getComputedStyle(gen.parentElement).position;   // (v98: the button lives in the prompt bar, docked in view)
  S.img.prompt="Turn this rough hand-drawn sketch into a high-end 3D animated film still. Subject: منزل. Use the sketch only as the layout";renderView();await wait(100);
  out.cleaned=[S.img.prompt,document.getElementById('iprompt').value];
  out.route=[wantsWorld88("اريد عالم ثلاثي الابعاد من هذه الصورة اتجول فيه","agent",1),wantsWorld88("اصنع عالم من هذه الصورة","agent",1),wantsWorld88("ضع المنتج في عالم الفضاء","agent",1),wantsWorld88("a world from this photo","agent",1),wantsWorld88("put my perfume in a world of flowers","agent",1),wantsWorld88("a 3d world I can walk in","image",0),wantsWorld88("a world from this photo","agent",0)];
  out.words=[words88("Faisal walks in the souq\\nFaisal = the person in reference picture 1: the exact same face."),words88("a man runs Keep these people exactly as they appear in the first frame."),words88("UGC style ad for my perfume"),words88("Full-body photo of a woman in red"),words88("UGC-style vertical ad: a girl holds the serum")];
  const c=document.createElement('canvas');c.width=4000;c.height=3000;const x=c.getContext('2d');x.fillStyle='#3a7';x.fillRect(0,0,4000,3000);for(let i=0;i<4000;i+=7){x.fillStyle='hsl('+(i%360)+',60%,50%)';x.fillRect(i,(i*7)%3000,40,40)}
  const big=await new Promise(r=>c.toBlob(r,'image/png'));const f=new File([big],'IMG_2024.png',{type:'image/png'});out.bigKB=Math.round(f.size/1e3);
  let ups=0;const oreq=API.req;API.req=async function(p,o){if(p==='/v1/uploads')ups++;return oreq.apply(this,arguments)};
  loadSlot('iRef',f);for(let i=0;i<40&&!ups;i++)await wait(150);await wait(800);const m=M.iRef;out.prepared=m&&m.file!==f?[m.file.type,Math.round(m.file.size/1e3)]:null;
  if(m){const bm=await createImageBitmap(m.file);out.dims=[bm.width,bm.height];const u1=await API.upload(m.file,'x');const u2=await API.upload(m.file,'x');out.sameUpload=!!(u1&&u1.url)&&u1.url===u2.url;out.uploads=ups}
  let calls=0,drop=1;const of=window.fetch;window.fetch=async function(u,o){if(String(u)==='/v1/jobs'&&o&&o.method==='POST'){calls++;if(drop>0){drop--;throw new TypeError('Failed to fetch')}}return of.apply(this,arguments)};
  try{await API.req('/v1/jobs',{json:{kind:'image',prompt:'a red apple',model:'dotimg',aspect:'1:1'}})}catch(e){}out.retryCalls=calls;
  window.fetch=async function(u,o){if(String(u)==='/v1/jobs')throw new TypeError('Failed to fetch');return of.apply(this,arguments)};
  try{await API.req('/v1/jobs',{json:{kind:'image',prompt:'x',model:'dotimg'}})}catch(e){out.plainError=e.message}window.fetch=of;API.req=oreq;out.netText=NET88();
  delete M.iRef;
  out.nvBadge=nvBadge();out.nvText=/Powered by NVIDIA|مدعوم من NVIDIA/i.test(document.body.innerText);
  go('motion');renderAll();await wait(300);out.mc=[...document.querySelectorAll('[data-set="mc83.model"]')].map(b=>b.dataset.val);out.mcModel=mcModel93(Object.assign({},MC83(),{mode:'moves'}));out.mc26=/2\\.6/.test(document.querySelector('#main').innerText);out.kie=/\\bKie\\b/i.test(document.body.innerText);
  S.draft.ugc.name='Rose serum';S.draft.ugc.price='99 SAR';S.draft.ugc.desc='';go('ugcads');renderAll();await wait(300);
  out.ugc={name:!!document.querySelector('[data-bind="draft.ugc.name"]'),price:!!document.querySelector('[data-bind="draft.ugc.price"]'),about:!!document.querySelector('#ugcabout88'),desc:S.draft.ugc.desc,n:S.draft.ugc.name,p:S.draft.ugc.price};
  const sb=document.querySelector('select#ugcmodel ~ .selbtn')||[...document.querySelectorAll('.selbtn')].find(b=>b._sel&&b._sel.id==='ugcmodel');out.engineBtnPic=!!(sb&&sb.querySelector('.sp88 img'));
  if(sb){sb.click();await wait(250);const o=[...document.querySelectorAll('#selRoot .selopt')];out.engineSheet=[o.filter(x=>x.querySelector('.sp88 img')).length,o.length];closeSel()}
  return out}"""

# faces in character lists · poster frames · × with a confirmation · empty boxes after a start
PICS = """async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),out={};
  S.chars=S.chars.filter(c=>!/^c88/.test(c.id));S.chars.push(normChar({id:'c88a',name:'Huda',age:29,gender:'female',look:'long black hair',looks:[1,2,3,4],voice:{dialect:'najdi',gender:'female',age:'adult',tone:'warm'},face:'/media/face.png'}));
  S.chars.push(normChar({id:'c88b',name:'Omar',age:40,gender:'male',look:'grey beard',looks:[1,2,3,4],voice:{dialect:'najdi',gender:'male',age:'adult',tone:'warm'}}));persist();
  go('video');S.draft.charId='c88a';renderAll();await wait(400);const sb=[...document.querySelectorAll('.selbtn')].find(b=>b._sel&&b._sel.dataset.bind==='draft.charId');
  out.charBtn=sb?!!sb.querySelector('.sp88 img'):null;
  if(sb){sb.click();await wait(250);out.charSheet=[...document.querySelectorAll('#selRoot .selopt')].map(o=>(o.querySelector('.sp88 img')?'face':o.querySelector('.sp88 .sil87')?'empty':o.querySelector('.sp88.none')?'none':'?')+':'+o.textContent.trim());closeSel()}
  S.draft.charId='';
  S.jobs=S.jobs.filter(j=>!/^jv88/.test(j.id));S.jobs.push({id:'jv88a',kind:'video',status:'complete',resultUrl:'/media/clip.webm',aspect:'9:16',dur:6,title:'Test clip',prompt:'a red car',created:Date.now()-50000});
  S.jobs.push({id:'jv88b',kind:'video',status:'complete',resultUrl:'/media/clip.webm',aspect:'9:16',dur:6,title:'Older clip',prompt:'a blue car',created:Date.now()-90000});
  S.lastVideo='jv88a';renderAll();await wait(900);const vids=[...document.querySelectorAll('#main video')].filter(v=>/clip\\.webm/.test(v.currentSrc||v.src||v.querySelector('source')?.src||'')),cards=[...document.querySelectorAll('#main .gc98[data-v98*="clip.webm"]')];   // (v98: a finished video in the gallery is its poster picture)
  out.posters=[vids.filter(v=>/\\/v1\\/poster\\/clip\\.webm/.test(v.getAttribute('poster')||'')).length+cards.filter(c=>c.querySelector('img[src*="/v1/poster/clip.webm"]')).length,vids.length+cards.length];
  const pr=await fetch('/v1/poster/clip.webm');out.posterResp=[pr.status,pr.headers.get('content-type'),(await pr.arrayBuffer()).byteLength>1000];
  const del=document.querySelector('.del88[data-id="jv88b"]');out.delBtn=!!del;
  if(del){del.click();await wait(250);const y=document.querySelector('#modalRoot [data-act="del88-yes"]');out.confirm=!!y&&!!document.querySelector('#modalRoot [data-act="close-sheet"]');out.stillThere=S.jobs.some(j=>j.id==='jv88b');y&&y.click();await wait(300)}
  out.deleted=!S.jobs.some(j=>j.id==='jv88b');out.kept=S.jobs.some(j=>j.id==='jv88a');
  S.jobs.push({id:'ji88',kind:'image',status:'complete',resultUrl:'/media/face.png',aspect:'1:1',prompt:'a face',created:Date.now()-20000});go('image');renderAll();await wait(400);
  const di=document.querySelector('.del88[data-id="ji88"]');out.imgDel=!!di;if(di){di.click();await wait(250);document.querySelector('#modalRoot [data-act="close-sheet"]')?.click();await wait(200);out.cancelKeeps=S.jobs.some(j=>j.id==='ji88')}
  go('chars');renderAll();await wait(300);out.charDel=[document.querySelectorAll('.crw88 .del88.c').length,document.querySelectorAll('.crw88').length];const cd=[...document.querySelectorAll('.crw88')].find(r=>r.textContent.includes('Omar'));
  if(cd){cd.querySelector('.del88.c').click();await wait(250);const y=document.querySelector('#modalRoot [data-act="del88c-yes"]');out.charConfirm=!!y;y&&y.click();await wait(300)}out.omarGone=!charById('c88b');out.hudaKept=!!charById('c88a');
  go('video');S.draft.prompt='a slow dolly shot of a lighthouse';S.draft.variations=1;renderAll();await wait(200);const n=S.jobs.length;makeVideo();await wait(500);out.videoCleared=[S.jobs.length>n,S.draft.prompt];
  go('image');S.img.prompt='a lemon tree';S.img.count=1;renderAll();await wait(200);const n2=S.jobs.length;makeImages();await wait(500);out.imageCleared=[S.jobs.length>n2,S.img.prompt];
  return out}"""

# a photo → a World you walk in
WORLD = """async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),out={};const until=async(f,ms)=>{const t=Date.now();while(Date.now()-t<ms){try{if(f())return true}catch(e){}await wait(250)}return false};
  const c=document.createElement('canvas');c.width=1200;c.height=800;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,0,400);g.addColorStop(0,'#5aa0e6');g.addColorStop(1,'#a8d0f0');x.fillStyle=g;x.fillRect(0,0,1200,400);
  x.fillStyle='#4f9a3a';x.fillRect(0,400,1200,400);x.fillStyle='#b33';x.fillRect(520,430,160,50);x.fillStyle='#2e6b2a';for(let i=0;i<9;i++){x.beginPath();x.arc(80+i*130,380,60,0,7);x.fill()}
  const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));const f=new File([b],'park.jpg',{type:'image/jpeg'});
  go('home');S.hf.tab='agent';renderAll();await wait(300);loadSlot('hfRef',f);await wait(800);
  const q=document.getElementById('hfq');q.value='اريد عالم ثلاثي الابعاد من هذه الصورة اتجول فيه';S.hf.prompt=q.value;
  const nj=S.jobs.length;hfSend();
  out.toWorld=await until(()=>S.view==='world',8000);
  out.built=await until(()=>typeof NW!=='undefined'&&NW.W&&!NW.busy&&NW.W.plan&&NW.W.plan.photo88,90000);
  out.plan=typeof NW!=='undefined'&&NW.W?{place:NW.W.plan.place,ground:NW.W.plan.terrain&&NW.W.plan.terrain.ground,color:NW.W.plan.terrain&&NW.W.plan.terrain.color,photo:!!NW.W.plan.photo88}:null;
  out.noPictureJob=S.jobs.length===nj;out.boxEmpty=S.hf.prompt==='';
  const c2=document.createElement('canvas');c2.width=900;c2.height=600;const y=c2.getContext('2d');y.fillStyle='#6b4a32';y.fillRect(0,0,900,600);y.fillStyle='#c9a77a';y.fillRect(0,380,900,220);y.fillStyle='#ead9b8';y.fillRect(300,120,300,200);
  S.world.pic=c2.toDataURL('image/jpeg',.9);const ta=document.getElementById('nwprompt');if(ta)ta.value='';nwGo();
  await until(()=>NW.W&&!NW.busy&&NW.W.plan.fromPicture&&NW.W.plan.terrain&&NW.W.plan.terrain.ground==='floor',90000);await until(()=>NW.W.plan.photo88,15000);
  out.indoor={place:NW.W.plan.place,ground:NW.W.plan.terrain&&NW.W.plan.terrain.ground,photo:!!NW.W.plan.photo88};
  S.world.pic=c.toDataURL('image/jpeg',.9);const ta2=document.getElementById('nwprompt');ta2.value='a quiet park with a fountain';ta2.dispatchEvent(new Event('input',{bubbles:true}));nwGo();
  await until(()=>NW.W&&!NW.busy&&/fountain|park/i.test(NW.W.plan.prompt||NW.W.plan.title||''),90000);await until(()=>NW.W.plan.photo88,15000);
  out.withWords={place:NW.W.plan.place,photo:!!NW.W.plan.photo88,fountain:NW.W.plan.objects.some(o=>/fountain/.test(o.type))};
  out.wide=document.documentElement.scrollWidth-innerWidth;
  return out}"""

async def page_run(p, W, lang, world):
    mob = W < 600; tag = f"{lang} {W}"
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
    ctx = await b.new_context(viewport={"width": W, "height": 844 if mob else 900}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:240]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await pg.evaluate(SET, lang)
    r = {"create": await pg.evaluate(CREATE)}; c = r["create"]
    ok(c["mics"] == 0 and c["resize"] == "none", f"{tag}: no microphone, no resize grip in prompt boxes {c['mics']} {c['resize']}")
    ok(c["genPos"] == "static", f"{tag}: the Images page's Generate bar stays in place ({c['genPos']})")
    ok(c["cleaned"][0] == "منزل" and c["cleaned"][1] == "منزل", f"{tag}: the site's own instructions never show in the box, only the user's words {c['cleaned']}")
    ok(c["route"] == [True, True, False, True, False, True, False], f"{tag}: the World only when asked for (walk / 3D, or a world from this photo) — a product put in \"a world of …\" stays a picture {c['route']}")
    ok(c["words"] == ["Faisal walks in the souq", "a man runs", "UGC style ad for my perfume", "Full-body photo of a woman in red", ""], f"{tag}: the site's added lines are cut off, the client's own words (even ones that start like the site's) stay {c['words']}")
    ok(c["prepared"] and c["prepared"][0] == "image/jpeg" and max(c.get("dims") or [0]) == 2048 and c["prepared"][1] < c["bigKB"], f"{tag}: a big photo is read at once and made a 2048 px JPEG {c['bigKB']} KB → {c['prepared']} {c.get('dims')}")
    ok(c.get("sameUpload") and c.get("uploads") == 1, f"{tag}: uploaded in the background once, the job reuses it ({c.get('uploads')} uploads)")
    ok(c["retryCalls"] == 2, f"{tag}: a dropped connection on a new job is tried again ({c['retryCalls']} calls)")
    ok(c.get("plainError") == c["netText"] and "Failed to fetch" not in (c.get("plainError") or ""), f"{tag}: a plain message instead of \"Failed to fetch\": {c.get('plainError')}")
    ok(c["nvBadge"] == "" and not c["nvText"], f"{tag}: no \"Powered by NVIDIA AI\"")
    # (since v93 the page has no engine list: "My character does the moves" uses 3.0, "Replace the person" its own engine)
    ok(c["mc"] == [] and c["mcModel"] == "mc30" and not c["mc26"] and not c["kie"], f"{tag}: Motion Control 2.6 is gone — the moves use 3.0, no engine list {c['mc']} {c['mcModel']}")
    u = c["ugc"]
    ok(not u["name"] and not u["price"] and u["about"] and u["n"] == "" and u["p"] == "" and "Rose serum" in u["desc"], f"{tag}: UGC: name / price / special fields gone, one line about the product (the old name kept in it) {u}")
    ok(c["engineBtnPic"] and c.get("engineSheet") and c["engineSheet"][0] == c["engineSheet"][1] and c["engineSheet"][1] > 3, f"{tag}: the engine list shows each engine's logo {c.get('engineSheet')}")
    r["pics"] = await pg.evaluate(PICS); s = r["pics"]
    cs = s.get("charSheet") or []
    ok(s["charBtn"] and any(x.startswith("face:") and "Huda" in x for x in cs) and any(x.startswith("empty:") and "Omar" in x for x in cs) and not any(x.startswith("?") for x in cs), f"{tag}: character lists show faces (an empty frame when there is none) {cs[:5]}")
    ok(s["posters"][1] >= 1 and s["posters"][0] == s["posters"][1] and s["posterResp"][0] == 200 and "jpeg" in (s["posterResp"][1] or "") and s["posterResp"][2], f"{tag}: every video on the server shows a clear poster frame {s['posters']} {s['posterResp']}")
    ok(s["delBtn"] and s.get("confirm") and s.get("stillThere") and s["deleted"] and s["kept"], f"{tag}: × on a video asks first, then deletes only that one {s}")
    ok(s["imgDel"] and s.get("cancelKeeps"), f"{tag}: × on a picture; Cancel keeps it")
    ok(s["charDel"][0] == s["charDel"][1] and s["charDel"][0] >= 2 and s.get("charConfirm") and s["omarGone"] and s["hudaKept"], f"{tag}: × beside each character, with a confirmation {s['charDel']}")
    ok(s["videoCleared"][0] and s["videoCleared"][1] == "" and s["imageCleared"][0] and s["imageCleared"][1] == "", f"{tag}: the box is empty after a start {s['videoCleared']} {s['imageCleared']}")
    if world:
        r["world"] = await pg.evaluate(WORLD); w = r["world"]
        ok(w["toWorld"] and w["built"] and w["plan"] and w["plan"]["photo"] and w["noPictureJob"] and w["boxEmpty"], f"{tag}: a photo + \"a 3D world I can walk in\" builds a World from the photo, not a picture {w}")
        ok(w["plan"] and w["plan"]["place"] == "park" and w["plan"]["ground"] != "floor", f"{tag}: the park photo gives a park {w['plan']}")
        ok(w["indoor"]["ground"] == "floor" and w["indoor"]["photo"], f"{tag}: an indoor photo gets an open floor {w['indoor']}")
        ok(w["withWords"]["photo"] and w["withWords"]["fountain"], f"{tag}: words + a photo: the words' world with the photo around you {w['withWords']}")
        ok(w["wide"] <= 1, f"{tag}: nothing sideways ({w['wide']})")
    ok(not errs, f"{tag}: page errors {errs[:4]}")
    await b.close(); return r

async def main():
    async with async_playwright() as p:
        for W, lang, world in ((1280, "en", False), (390, "ar", True)): out[f"{W}/{lang}"] = await page_run(p, W, lang, world)

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
