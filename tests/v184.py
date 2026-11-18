# v184 — Admin → AI providers: every AI on its own row with its icon; a tap opens its settings and keys below it; saving takes
# effect at once on the server and in the site. A real nooi server with stand-in Seedance and ElevenLabs APIs:
#  · the list: groups (all-in-one · video · pictures · voices · text · 3D · dubbing · other), each row its logo or icon, name, what it
#    does and its state; all closed at first; the old grid of key cards gone; the AI engine's quick start inside its row; NVIDIA's
#    engine check inside the NVIDIA row; MiniMax, ElevenLabs, Google and Midjourney have rows; a search finds a row by name
#  · a row opens in place (the others stay closed); a wrong Seedance key typed there → Save & test → "Problem" (the key refused);
#    the right one → "Connected", the row stays open, the site's settings read again; then a video on Seedance is made with that
#    key at once (no restart); ElevenLabs the same way
#  · phone in English, computer in Arabic (the groups, the labels and the states in Arabic); nothing wider than the screen
# Run: python3 tests/v184.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8598, 8599; B = f"http://localhost:{PORT}"; M = f"http://localhost:{MP}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v184-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "1", "-c:v", "libvpx-vp9", "-b:v", "200k", D + "/vid.webm"], check=True)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={sd:[],el:[]};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x'),J=(code,d)=>{s.statusCode=code;s.setHeader('content-type','application/json');s.end(JSON.stringify(d))};
 if(u.pathname==='/stats')return J(200,st);
 if(u.pathname==='/vid.webm'){s.setHeader('content-type','video/webm');return s.end(fs.readFileSync(path.join(DIR,'vid.webm')))}
 // stand-in Seedance (ModelArk): the key must be sd-good
 if(u.pathname.startsWith('/contents/generations/tasks')){const auth=q.headers.authorization||'';st.sd.push({m:q.method,p:u.pathname,auth});
   if(auth!=='Bearer sd-good')return J(401,{error:{message:'The API key is invalid'}});
   if(q.method==='POST')return J(200,{id:'cgt-1'});
   if(u.pathname.endsWith('/cgt-1'))return J(200,{id:'cgt-1',status:'succeeded',content:{video_url:'http://localhost:'+P+'/vid.webm'}});
   return J(200,{items:[]})}
 // stand-in ElevenLabs: the key must be el-good
 if(u.pathname==='/v1/models'){const k=q.headers['xi-api-key']||'';st.el.push(k);return k==='el-good'?J(200,[{model_id:'eleven_multilingual_v2'}]):J(401,{detail:{status:'invalid_api_key'}})}
 J(404,{})})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
mk = subprocess.Popen(["node", D + "/mock.js", str(MP), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_", "MINIMAX_", "SEEDANCE_", "KLING_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false", MIRROR_MEDIA="false", NV_AUTOCHECK="false"),
  stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))

def api(p, body=None, method=None):
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json"}, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=60).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def stats(): return json.loads(urllib.request.urlopen(M + "/stats", timeout=10).read())

async def page_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=S.user||{{name:'Owner',method:'email',contact:'owner@nooi.ai'}};persist();S.admTab='models';go('admin')}}")
        await pg.wait_for_function("document.querySelectorAll('.aip184 .aiprow').length>20", timeout=20000); await pg.wait_for_timeout(500)
        L = await E("""()=>{const rows=[...document.querySelectorAll('.aip184 .aiprow')],W=innerWidth;return {n:rows.length,keys:rows.map(r=>r.dataset.k),groups:[...document.querySelectorAll('.aip184 .aipgh')].map(g=>g.textContent),
          icons:rows.every(r=>r.querySelector('.aiplogo img,.aiplogo svg')),pills:rows.every(r=>r.querySelector('.aippill')),closed:rows.every(r=>r.querySelector('.aipbody').hidden&&r.querySelector('.aiphead').getAttribute('aria-expanded')==='false'),
          oldGrid:!!document.querySelector('.intgrid [data-pv]'),quick:!!document.querySelector('.aiprow[data-k="engine"] .engquick')&&document.querySelectorAll('.engquick').length===1,
          nv:!!(document.getElementById('nvchk176')&&document.getElementById('nvchk176').closest('.aiprow[data-k="nvidia"]')&&document.getElementById('nvchk176').closest('.provc').querySelector('[data-pv="nvidia"]')),
          wide:document.documentElement.scrollWidth>W+1||rows.some(r=>{const b=r.getBoundingClientRect();return b.right>W+1||b.left<-1})}}""")
        out[tag + "-list"] = {k: L[k] for k in ("n", "groups", "icons", "pills", "closed", "oldGrid", "quick", "nv", "wide")}
        ok(L["n"] >= 25 and all(k in L["keys"] for k in ("engine", "minimax", "nvidia", "seedance", "kling", "elevenlabs", "google", "midjourney", "claude", "email")), f"{tag}: every AI should have a row: {L['keys']}")
        want = ["محركات شاملة", "الفيديو", "الصور", "الأصوات والصوت", "الذكاء النصي"] if ar else ["All-in-one engines", "Video", "Pictures", "Voices & sound", "Text AI"]
        ok(L["groups"][:5] == want, f"{tag}: the groups in order: {L['groups']}")
        ok(L["icons"] and L["pills"] and L["closed"] and not L["oldGrid"] and L["quick"] and L["nv"] and not L["wide"], f"{tag}: the list: {out[tag + '-list']}")
        # search
        await pg.fill("#aip184q", "kling"); vis = await E("()=>[...document.querySelectorAll('.aip184 .aiprow')].filter(r=>r.style.display!=='none').map(r=>r.dataset.k)")
        txt = await E("()=>[...document.querySelectorAll('.aip184 .aiprow')].filter(r=>r.style.display!=='none').every(r=>r.dataset.q.includes('kling'))")
        ok("kling" in vis and len(vis) <= 3 and txt and "seedance" not in vis, f"{tag}: the search should find Kling (and the AI engine that runs it): {vis}"); await pg.fill("#aip184q", ""); await E("()=>{AIP184.q='';aipFilter184()}")
        # Seedance: open in place, a wrong key → Problem, the right one → Connected
        await pg.click('.aiprow[data-k="seedance"] .aiphead')
        o = await E("()=>({open:!document.querySelector('#aipb-seedance').hidden,others:[...document.querySelectorAll('.aiprow')].filter(r=>r.dataset.k!=='seedance'&&!r.querySelector('.aipbody').hidden).length})")
        ok(o["open"] and o["others"] == 0, f"{tag}: Seedance should open alone: {o}")
        lab = await E("()=>[...document.querySelectorAll('#aipb-seedance .lbl')].map(l=>l.textContent)")
        ok(("مفتاح API" in " ".join(lab)) if ar else ("API key" in " ".join(lab)), f"{tag}: the field names: {lab}")
        async def save(key):
            await pg.fill('#aipb-seedance [data-fl="apiKey"]', key); await pg.fill('#aipb-seedance [data-fl="baseUrl"]', M)
            await pg.click('#aipb-seedance [data-act="aip184-save"]')
            await pg.wait_for_function("!AIP184.busy.seedance&&!!document.querySelector('.aiprow[data-k=\"seedance\"] .aippill')&&!document.querySelector('.aiprow[data-k=\"seedance\"] .aippill.s-off')&&!document.querySelector('.aiprow[data-k=\"seedance\"] .aippill.s-saved')", timeout=20000)
            return await E("()=>{const r=document.querySelector('.aiprow[data-k=\"seedance\"]');return {pill:r.querySelector('.aippill').className.replace('aippill ',''),text:r.querySelector('.aippill').textContent,note:(document.getElementById('aipst-seedance')||{}).textContent||'',open:!r.querySelector('.aipbody').hidden,key:r.querySelector('[data-fl=\"apiKey\"]').value}}")
        bad = await save("sd-bad"); out[tag + "-bad"] = bad
        ok(bad["pill"] == "s-bad" and bad["open"] and bad["key"] == "", f"{tag}: a wrong key → Problem, the row stays open, the key not left on the page: {bad}")
        good = await save("sd-good"); out[tag + "-good"] = good
        ok(good["pill"] == "s-ok" and (good["text"] == "متصل" if ar else good["text"] == "Connected") and good["note"].startswith("✓") and good["open"], f"{tag}: the right key → Connected: {good}")
        live = await E("()=>!!(A().providers&&A().providers.seedance&&A().providers.seedance.configured)&&!!document.querySelector('#aipb-seedance [data-act=\"aip184-test\"]')")
        ok(live, f"{tag}: the page should know Seedance is set (and offer Test)")
        if not ar:
            # the key works on the server at once: a Seedance video is made with it
            c0 = len([x for x in stats()["sd"] if x["m"] == "POST"])
            code, j = api("/v1/jobs", {"kind": "video", "model": "seedance", "prompt": "a paper boat on a calm lake, v184", "dur": 5, "aspect": "16:9"})
            ok(code == 200, f"the Seedance job was refused: {code} {j}"); t0 = time.time()
            while time.time() - t0 < 40:
                c2, j = api("/v1/jobs/" + j.get("id", ""));
                if j.get("status") in ("done", "failed"): break
                time.sleep(0.5)
            posts = [x for x in stats()["sd"] if x["m"] == "POST"]
            out["job"] = {"status": j.get("status"), "posts": len(posts) - c0, "auth": posts[-1]["auth"] if posts else None}
            ok(j.get("status") == "done" and len(posts) - c0 == 1 and posts[-1]["auth"] == "Bearer sd-good", f"the video should be made on Seedance with the new key at once: {out['job']} {j.get('error')}")
            # ElevenLabs, a row that was .env-only before
            await pg.click('.aiprow[data-k="elevenlabs"] .aiphead')
            await pg.fill('#aipb-elevenlabs [data-fl="apiKey"]', "el-good"); await pg.fill('#aipb-elevenlabs [data-fl="baseUrl"]', M)
            await pg.click('#aipb-elevenlabs [data-act="aip184-save"]')
            await pg.wait_for_function("!AIP184.busy.elevenlabs&&!!document.querySelector('.aiprow[data-k=\"elevenlabs\"] .aippill.s-ok')", timeout=20000)
            ok("el-good" in stats()["el"], "ElevenLabs should be tested with the saved key")
        await pg.screenshot(path=D + f"/{tag}.png")
        # close again
        await pg.click('.aiprow[data-k="seedance"] .aiphead'); ok(await E("()=>document.querySelector('#aipb-seedance').hidden"), f"{tag}: a second tap closes the row")
        ok(not errs, f"{tag}: page errors {errs[:3]}")
    finally:
        await br.close()

async def pages():
    async with async_playwright() as p:
        await page_part(p, True, "en")
        await page_part(p, False, "ar")

try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    asyncio.run(pages())
finally:
    srv.terminate(); srv.wait(); mk.terminate(); mk.wait()
print(json.dumps(out, ensure_ascii=False, indent=1)[:3500])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + "/server.log").read()[-1500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v184 OK")
