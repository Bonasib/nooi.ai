# v89 in a real browser with a real nooi server (no AI keys). Desktop (English) and Arabic phone:
#  · icons never show a number: loaders are the stars only (thumbnails, the big preview, the home box results), a count shows
#    that many stars (takes, pictures) with the number in the label, ratio shapes carry no text, the strongest models in the
#    home box's list get a star (no 1 · 2 · 3), a busy crew member shows the star (no count) — on every page, no page errors
#  · the home box's model list has every model the Video / Image pages offer, each with its logo (Seedance 2.0 Mini …)
#  · a failed job: no play / pause on nothing, the caption is the client's words (never "… = the person in reference picture"),
#    a dropped connection says so in plain words (also on jobs saved before, which kept the browser's "Failed to fetch")
#  · a video's length sits top left (the × to delete top right — mirrored in Arabic); a poster frame is set only when it loads
#  · a job the server no longer has (deleted on another device) stops being followed and says so — no "Try again" toast
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8198
D = tempfile.mkdtemp(prefix="nooi-v89-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=24:duration=4", "-pix_fmt", "yuv420p", "-c:v", "libvpx-vp9", "-b:v", "300k", D + "/media/clip.webm"], check=True)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SET = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'Sara',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}"

STARS = """async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),out={};
  // no icon anywhere shows a number
  out.numIcons=[];for(const v of Object.keys(VIEWS)){try{go(v);renderAll();await wait(90)}catch(e){continue}
    document.querySelectorAll('#main .tile .gl,#main .gl').forEach(e=>{if(e.offsetParent&&/\\d/.test(e.textContent))out.numIcons.push(v+':'+e.textContent.trim().slice(0,8))})}
  go('video');renderAll();await wait(300);
  out.takes=[...document.querySelectorAll('[data-set="draft.variations"]')].map(b=>[b.querySelectorAll('.gl .gstars path').length,b.querySelector('.lb').textContent.trim()]);
  const fc=[...document.querySelectorAll('#main .pk84c')].find(c=>/16:9|9:16|1:1|4:5|21:9/.test(c.textContent));if(fc){fc.click();await wait(350)}
  out.ratio=[...document.querySelectorAll('#modalRoot .pk84o')].slice(0,3).map(b=>[(b.querySelector('.pk84oi')||b.querySelector('span')||{textContent:'?'}).textContent.trim(),b.textContent.replace(/\s+/g,' ').trim().slice(0,20)]);
  document.querySelector('#modalRoot [data-act="close-sheet"]')?.click();document.getElementById('modalRoot').innerHTML='';await wait(150);
  go('image');renderAll();await wait(300);out.count=[...document.querySelectorAll('[data-set="img.count"]')].map(b=>b.querySelectorAll('.gl .gstars path').length);
  // loaders: the stars only
  S.jobs=S.jobs.filter(j=>!/^j.89/.test(j.id));
  S.jobs.push({id:'jr89',kind:'video',status:'rendering',progress:.42,aspect:'16:9',dur:5,title:'R',prompt:'a boat at dawn',model:'kling',created:Date.now()});
  S.jobs.push({id:'jq89',kind:'video',status:'queued',progress:0,aspect:'9:16',dur:5,title:'Q',prompt:'a train',model:'kling',created:Date.now()-1000});
  S.lastVideo='jr89';go('video');ST98().lb='video';renderAll();   // (v98: a result opens large from the gallery)
  await wait(500);
  const sv=document.querySelector('#main .sveil81');out.stage=sv?[sv.innerText.trim(),sv.querySelectorAll('.star79').length,!!document.querySelector('#main .stage .ctl [data-act="toggle-play"]')]:null;
  out.pipe=[...document.querySelectorAll('#pipe>div')].map(d=>d.textContent).join('|');
  out.veils=[...document.querySelectorAll('#main .thumb .veil')].map(v=>[v.innerText.trim(),v.querySelectorAll('.star79').length]);
  out.crew=[...document.querySelectorAll('#main .botstrip .sjobs')].filter(e=>e.firstChild).map(e=>[e.textContent.trim(),!!e.querySelector('svg.nstars')]);
  go('home');S.hf.tab='video';S.hf.out=['jr89'];renderAll();await wait(400);const ph=document.querySelector('.hfrph');out.home=ph?[ph.innerText.trim(),!!ph.querySelector('svg.nstars')]:null;
  // the home box's list: every model, each with its logo, a star (not a number) on the strongest
  document.querySelector('[data-act="hf-model"]').click();await wait(400);
  const rows=[...document.querySelectorAll('#modalRoot .hfmodel')];out.sheet={n:rows.length,want:1+Object.keys(MODELS).filter(k=>k!=='auto').length,noLogo:rows.filter(r=>!r.querySelector('img')).map(r=>r.dataset.v),
    marks:rows.filter(r=>r.querySelector('.mrk')).map(r=>[r.dataset.v,r.querySelector('.mrk').textContent.trim(),!!r.querySelector('.mrk svg')]),mini:rows.some(r=>r.dataset.v==='seedance2mini'&&r.querySelector('img'))};
  document.querySelector('#modalRoot [data-act="close-sheet"]')?.click();await wait(150);
  S.hf.tab='image';renderAll();await wait(200);document.querySelector('[data-act="hf-model"]').click();await wait(400);
  const ir=[...document.querySelectorAll('#modalRoot .hfmodel')];out.isheet={n:ir.length,want:1+Object.keys(IMG_MODELS).filter(k=>k!=='auto').length};document.querySelector('#modalRoot [data-act="close-sheet"]')?.click();
  S.jobs=S.jobs.filter(j=>!/^j.89/.test(j.id));S.hf.out=[];S.hf.tab='video';
  return out}"""

FAILED = """async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),out={};
  S.jobs=S.jobs.filter(j=>!/^j.89/.test(j.id));const elsewhere=URL.createObjectURL(await (await fetch('/media/clip.webm')).blob())+'#elsewhere';
  S.jobs.push({id:'jv89a',kind:'video',status:'complete',resultUrl:location.origin+'/media/clip.webm',aspect:'9:16',dur:5,title:'A',prompt:'a red car',model:'kling',created:Date.now()-50000});
  S.jobs.push({id:'jv89b',kind:'video',status:'complete',resultUrl:elsewhere,aspect:'16:9',dur:8,title:'B',prompt:'a blue car',created:Date.now()-60000});
  S.jobs.push({id:'jf89',kind:'video',status:'failed',error:'Failed to fetch',aspect:'16:9',dur:5,title:'Elias walking',prompt:'Elias walking through the house\\nElias = the person in reference picture 1: the exact same face, hair, skin tone and build (the same real person).',model:'seedance2mini',created:Date.now()-2000});
  S.lastVideo='jf89';go('video');ST98().lb='video';renderAll();await wait(1500);
  const st=document.querySelector('#main .stage');out.failed={play:!!st.querySelector('.ctl [data-act="toggle-play"]'),cap:(st.querySelector('.cap')||{textContent:''}).textContent.trim(),msg:(document.querySelector('#main .pfail79 .m')||{}).textContent,net:NET88()};
  // the length top left, the × top right (mirrored in Arabic)
  const th=[...document.querySelectorAll('.strip .thumb,.gc98 .thumb')].find(t=>t.querySelector('.del88')&&t.querySelector('.t,.dur98'));
  if(th){const r=th.getBoundingClientRect(),t=th.querySelector('.t,.dur98').getBoundingClientRect(),x=th.querySelector('.del88').getBoundingClientRect();out.corner={t:[Math.round(t.left-r.left),Math.round(r.right-t.right)],x:[Math.round(x.left-r.left),Math.round(r.right-x.right)],rtl:document.dir==='rtl'||document.documentElement.dir==='rtl'}}
  await wait(800);ST98().lb='';renderAll();await wait(600);out.posters=[...document.querySelectorAll('.strip video')].map(v=>[/elsewhere/.test(v.getAttribute('src'))?'elsewhere':'ok',v.getAttribute('poster')||'',v.preload]).concat([...document.querySelectorAll('.gc98[data-v98] .tk98 .frame')].map(f=>f.tagName==='IMG'?['ok',f.getAttribute('src')||'','img']:[/elsewhere/.test(f.getAttribute('src'))?'elsewhere':'ok',f.getAttribute('poster')||'',f.preload]));   // (v98: the gallery: a poster picture, or the video's own first frame)
  // a job the server doesn't have: stops, says so, no toast
  const nT=document.querySelectorAll('.toast,.toasts>*').length;
  S.jobs.push({id:'jg89',kind:'video',status:'rendering',progress:.2,aspect:'16:9',dur:5,title:'G',prompt:'a train',model:'kling',created:Date.now(),remote:'gone-89'});persist();
  let j=null;for(let i=0;i<30;i++){await wait(300);j=S.jobs.find(x=>x.id==='jg89');if(j.status==='failed')break}
  await wait(400);out.gone={status:j.status,type:j.errorType,msg:errText81(j),toasts:[...document.querySelectorAll('#toasts .toast,.toast')].map(t=>t.textContent).filter(t=>/no longer/.test(t)).length};
  S.jobs=S.jobs.filter(x=>!/^j.89/.test(x.id));persist();
  return out}"""

async def page_run(p, W, lang):
    mob = W < 600; tag = f"{lang} {W}"
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport={"width": W, "height": 844 if mob else 900}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:240]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await pg.evaluate(SET, lang)
    r = {"stars": await pg.evaluate(STARS)}; s = r["stars"]
    ok(not s["numIcons"], f"{tag}: no icon shows a number {s['numIcons'][:6]}")
    ok([x[0] for x in s["takes"]] == [1, 2, 3, 4] and all(x[1].startswith(str(i + 1) + " ") for i, x in enumerate(s["takes"])), f"{tag}: takes are 1–4 stars, the number in the label {s['takes']}")
    ok(s["count"] == [1, 2, 4, 8], f"{tag}: pictures per prompt are 1/2/4/8 stars {s['count']}")
    ok(s["ratio"] and all(not any(ch.isdigit() for ch in x[0]) and ":" in x[1] for x in s["ratio"]), f"{tag}: in the format sheet a ratio is a shape, its numbers in the label {s['ratio']}")
    ok(s["stage"] and s["stage"][0] == "" and s["stage"][1] == 1 and not s["stage"][2], f"{tag}: the preview while it's made is the stars only, no play button {s['stage']}")
    ok("%" not in s["pipe"] and not any(ch.isdigit() for ch in s["pipe"]), f"{tag}: the steps under the preview have no numbers {s['pipe']}")
    ok(s["veils"] and all(v[0] == "" and v[1] == 1 for v in s["veils"]), f"{tag}: thumbnails being made show the stars only {s['veils']}")
    ok(s["crew"] and all(c[0] == "" and c[1] for c in s["crew"]), f"{tag}: a busy crew member shows the star, not a count {s['crew']}")
    ok(s["home"] and s["home"][0] == "" and s["home"][1], f"{tag}: the home box's result being made is the stars only {s['home']}")
    sh = s["sheet"]
    ok(sh["n"] == sh["want"] and not sh["noLogo"] and sh["mini"], f"{tag}: the home box's video list has every model with its logo, Seedance 2.0 Mini too ({sh['n']}/{sh['want']}, no logo: {sh['noLogo']})")
    ok(len(sh["marks"]) == 3 and all(m[1] == "" and m[2] for m in sh["marks"]), f"{tag}: the strongest three get a star, no rank numbers {sh['marks']}")
    ok(s["isheet"]["n"] == s["isheet"]["want"], f"{tag}: the home box's picture list has every picture model {s['isheet']}")
    r["failed"] = await pg.evaluate(FAILED); f = r["failed"]
    ok(not f["failed"]["play"] and f["failed"]["cap"] == "Elias walking through the house", f"{tag}: a failed preview has no play button and shows the client's words {f['failed']}")
    ok(f["failed"]["msg"] == f["failed"]["net"], f"{tag}: an old \"Failed to fetch\" says it in plain words: {f['failed']['msg']}")
    c = f.get("corner")
    ok(c and (c["t"][1] <= 10 if c["rtl"] else c["t"][0] <= 10) and (c["x"][0] <= 10 if c["rtl"] else c["x"][1] <= 10), f"{tag}: the length is top left, the × top right (mirrored in Arabic) {c}")
    ok(any(x[0] == "ok" and x[1].startswith("/v1/poster/") for x in f["posters"]) and any(x[0] == "elsewhere" for x in f["posters"]) and all(x[1] == "" and x[2] != "none" for x in f["posters"] if x[0] == "elsewhere"), f"{tag}: a poster only when its frame loads; a video without one keeps its own first frame {f['posters']}")
    g = f["gone"]
    ok(g["status"] == "failed" and g["type"] == "gone" and ("no longer" in g["msg"] or "لم تعد في حسابك" in g["msg"]) and g["toasts"] == 0,   # (v124: in the reader's language)
        f"{tag}: a job the server no longer has stops, says so, no toast {g}")
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
