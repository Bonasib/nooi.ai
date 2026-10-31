# v205 — animation styles in the prompt box, with a real nooi server and a stand-in engine that records every request:
#  · the box (Video and Image) has an "Animation style" button; it opens a sheet of 19 drawn tiles (From your words + 18 looks);
#    a tap picks the look, the button then shows its drawing; Settings has the same row; English and Arabic
#  · the picked look reaches the engine as plain words (Pixel art on a video, Claymation on a picture); "From your words" adds none
#  · the agents' brief carries the look (the plan request)
#  · the Video and Images pages list the same looks in their Style picker, with the same drawings
# Run: python3 tests/v205.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8668, 8669; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v205-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
def ff(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120)
ff("-f", "lavfi", "-i", "color=c=0x3060a0:s=512x512", "-frames:v", "1", D + "/pic.png")
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/vid.mp4")
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={reqs:[]};let n=0;const T={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');s.setHeader('connection','close');
 const send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(/^\/(pic\.png|vid\.mp4)$/.test(u.pathname)){s.setHeader('content-type',u.pathname.endsWith('png')?'image/png':'video/mp4');return s.end(fs.readFileSync(path.join(DIR,u.pathname)))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){let j={};try{j=JSON.parse(b||'{}')}catch{}st.reqs.push({path:u.pathname,body:j});const id='t'+(++n);T[id]=j;return send({taskId:id})}
 if(/record-?[iI]nfo/.test(u.pathname)){const j=T[u.searchParams.get('taskId')]||{},js=JSON.stringify(j).slice(0,300);const url='http://localhost:'+P+'/'+(/video|seedance|kling|wan|veo|hailuo/.test(js)?'vid.mp4':'pic.png');
   return send({state:'success',successFlag:1,response:{resultUrls:[url]},resultJson:JSON.stringify({resultUrls:[url]})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", NV_AUTOCHECK="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats", timeout=5).read())
def prompt_of(r): return (r["body"].get("input") or {}).get("prompt") or r["body"].get("prompt") or ""
async def wait_req(n0, sec=40):
    for _ in range(sec * 4):
        r = [x for x in stats()["reqs"][n0:] if prompt_of(x)]
        if r: return r
        await asyncio.sleep(.25)
    return []
SETUP = """(a)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(a[0]);S.theme=a[1];applyTheme();
  S.hf.tab='video';S.hf.vModel='seedance';S.hf.iModel='nano';S.hf.bots=false;S.hf.an205='';S.hf.sb=false;S.hf.dur=5;S.hf.batch=1;S.hf.n=1;go('home');renderAll();document.getElementById('modalRoot').innerHTML=''}"""
async def main():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("()=>typeof S!=='undefined'&&typeof renderAll==='function'&&API.mode==='server'", timeout=25000)
        for lang, theme in (("en", "light"), ("ar", "dark")):
            tag = lang
            await E(SETUP, [lang, theme]); await pg.wait_for_selector(".hfbox .an205b", timeout=8000)
            bt = await E("()=>{const b=document.querySelector('.hfbox .an205b');return{label:b.getAttribute('aria-label'),pal:!!b.querySelector('.an205p'),row:!!b.closest('.hf187row')}}")
            chk(f"{tag}: the box has the Animation style button in its row (a palette until a look is picked)", bt["pal"] and bt["row"] and ("Animation style" in bt["label"] or "الأنيميشن" in bt["label"]), bt)
            await pg.click(".hfbox .an205b"); await pg.wait_for_selector(".sh205 .an205t", timeout=5000)
            sh = await E("""()=>{const t=[...document.querySelectorAll('.sh205 .an205t')];return{n:t.length,vals:t.map(x=>x.dataset.v),art:t.every(x=>x.querySelector('svg')&&x.querySelector('svg').childElementCount>1),
              named:t.every(x=>x.querySelector('b').textContent.trim().length>1&&x.querySelector('small').textContent.trim().length>3),first:t[0].getAttribute('aria-pressed'),wide:document.documentElement.scrollWidth<=innerWidth+1,
              cols:getComputedStyle(document.querySelector('.an205g')).gridTemplateColumns.split(' ').length}}""")
            chk(f"{tag}: the sheet shows 19 drawn tiles (From your words + 18 looks), each with a name and a line, three to a row", sh["n"] == 19 and sh["art"] and sh["named"] and sh["first"] == "true" and sh["cols"] == 3 and sh["wide"], sh)
            await pg.click('.sh205 .an205t[data-v="an205pixel"]'); await pg.wait_for_timeout(500)
            st = await E("()=>({k:S.hf.an205,open:!!document.querySelector('.sh205'),on:document.querySelector('.hfbox .an205b').classList.contains('on'),art:!!document.querySelector('.hfbox .an205b svg rect[shape-rendering], .hfbox .an205b svg g[shape-rendering]')})")
            chk(f"{tag}: a tap picks Pixel art, closes the sheet and the button shows its drawing", st["k"] == "an205pixel" and not st["open"] and st["on"] and st["art"], st)
            await E("()=>set187()"); await pg.wait_for_selector(".sh187 .r205", timeout=5000)
            r = await E("()=>document.querySelector('.sh187 .r205').innerText")
            chk(f"{tag}: Settings has the Animation style row naming the pick", ("Pixel art" in r or "بكسل" in r), r)
            await E("()=>{document.getElementById('modalRoot').innerHTML=''}")
        # the words reach the engine — a video in Pixel art
        await E(SETUP, ["en", "light"]); await E("()=>{S.hf.an205='an205pixel';renderView()}"); await pg.wait_for_selector(".hfbox #hfq", timeout=5000)
        n0 = len(stats()["reqs"]); await pg.fill("#hfq", "A cat jumps over a fence"); await pg.click(".hfbox .hf187go"); r = await wait_req(n0)
        pv = prompt_of(r[0]) if r else ""; out["video"] = pv[:400]
        chk("video: the engine is told Pixel art (and the words stay first)", "Pixel-art animation" in pv and pv.startswith("A cat jumps over a fence"), pv[:400])
        jm = await E("()=>{const j=S.jobs.filter(j=>j.kind==='video').slice(-1)[0];return j&&j.meta?{anim:j.meta.anim205,style:j.meta.style,ch:j.meta.styleChosen136,title:j.title||''}:null}")
        chk("video: the job keeps the look as the customer's own pick", jm and jm["anim"] == "an205pixel" and jm["style"] == "an205pixel" and jm["ch"] is True, jm)
        # a picture in Claymation
        await E(SETUP, ["en", "light"]); await E("()=>{S.hf.tab='image';S.hf.an205='clay';renderView()}"); await pg.wait_for_selector(".hfbox #hfq", timeout=5000)
        n0 = len(stats()["reqs"]); await pg.fill("#hfq", "A fox reading a book"); await pg.click(".hfbox .hf187go"); r = await wait_req(n0)
        pi = prompt_of(r[0]) if r else ""; out["image"] = pi[:400]
        chk("picture: the engine is told Claymation", "Claymation" in pi and "fox" in pi, pi[:400])
        # From your words: nothing added
        await E(SETUP, ["en", "light"]); await E("()=>{S.hf.an205='';renderView()}"); await pg.wait_for_selector(".hfbox #hfq", timeout=5000)
        n0 = len(stats()["reqs"]); await pg.fill("#hfq", "A quiet lake at dawn"); await pg.click(".hfbox .hf187go"); r = await wait_req(n0)
        pn = prompt_of(r[0]) if r else ""; out["none"] = pn[:300]
        chk("From your words: no animation style added", pn.startswith("A quiet lake at dawn") and not any(w in pn for w in ("Pixel-art", "Claymation", "anime style", "3D animated")), pn[:300])
        # the agents' brief carries the look
        seen = {}
        async def plan(route):
            try: seen["body"] = json.loads(route.request.post_data or "{}")
            except Exception: seen["body"] = {}
            await route.fulfill(status=500, content_type="application/json", body='{"error":"x"}')
        await pg.route("**/v1/agents/plan", plan)
        await E("()=>{S.hf.an205='an205neon';HF205.on=true;return API.req('/v1/agents/plan',{json:{prompt:'A city at night',task:'video'}}).catch(()=>0).finally(()=>{HF205.on=false})}")
        await pg.wait_for_timeout(500); bp = (seen.get("body") or {}).get("prompt", "")
        chk("agents: the plan request carries the picked look", "A city at night" in bp and "Neon line-art" in bp, bp)
        await pg.unroute("**/v1/agents/plan")
        # the Video and Images pages list the same looks, with the same drawings
        pages = await E("""()=>({v:AN205.every(r=>VSTYLES.some(x=>x[0]===r[0])),i:AN205.every(r=>IMG_STYLES.some(x=>x[0]===r[0])),art:AN205.every(r=>typeof ART86.style[r[0]]==='function'&&/<svg/.test(ART86.style[r[0]]())),
          desc:AN205.every(r=>PKV84.style[r[0]]&&PKV84.style[r[0]][2])})""")
        chk("Video and Images pages: the 18 looks are Style choices with drawings and lines", all(pages.values()), pages)
        await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(800)
        await E("()=>{const c=[...document.querySelectorAll('.pk84c,[data-pk84]')].find(c=>/Style|الأسلوب/.test(c.textContent));c&&c.click()}"); await pg.wait_for_timeout(800)
        vp = await E("()=>{const s=document.querySelector('#modalRoot .pk84s');return s?{n:s.querySelectorAll('.pk86o').length,pix:/Pixel art/.test(s.textContent)}:null}")
        chk("Video page: the Style picker shows the new looks with drawings", vp and vp["pix"] and vp["n"] >= 20, vp)
        chk("page: no errors", not errs, errs[:3]); await b.close()
try: asyncio.run(main())
finally:
    for x in (srv, mk):
        x.terminate()
        try: x.wait(timeout=5)
        except Exception: x.kill()
    subprocess.run(["rm", "-rf", D])
print(json.dumps({"out": out, "fails": fails}, ensure_ascii=False, default=str)[:3000]); sys.exit(1 if fails else 0)
