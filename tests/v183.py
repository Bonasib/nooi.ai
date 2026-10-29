# v183 — MiniMax with the owner's own key (pay as you go): voices, pictures and music. A real nooi server with a stand-in MiniMax
# (and a stand-in AI engine for what MiniMax doesn't do):
#  · Admin's MiniMax card: the key saved there; the free check reads MiniMax's own code (HTTP 200 + base_resp) — a wrong key is
#    "refused", the right one "works · N voices"; three switches (voices · pictures · music), all on once the key is there
#  · a voice job speaks with MiniMax Speech (speech-2.8-hd): Arabic words → language Arabic and an Arabic woman's voice from the
#    list; English for a man → English and a man's voice; the feeling sent; the AI engine is never asked; voices off → the AI engine
#  · MiniMax Image-01 (picked by hand): the format and the character's photo (a full address) reach MiniMax, the picture is kept
#    here, about 1 credit; pictures off → refused at once, nothing charged
#  · music: MiniMax music-2.6, instrumental without words; the song is kept here
#  · the MiniMax balance used up (1008) → the job fails, the credits come back, staff see MiniMax out of credits
#  · the page (phone in English, computer in Arabic): MiniMax's own row in Admin → AI providers (v184; v183b: a box under the
#    tabs — not a card far down the page), a tap opens it: a wrong key typed there → refused, the right one → "works · 5 voices", the key never left on the page; the switches,
#    the region and the models; MiniMax Image-01 in the picture engines only while Pictures is on; nothing wider than the screen
# Run: python3 tests/v183.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8588, 8589; B = f"http://localhost:{PORT}"; M = f"http://localhost:{MP}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v183-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "m" * 32; now = int(time.time() * 1000)
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": now},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "libmp3lame", "-b:a", "64k", D + "/tone.mp3"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360", "-frames:v", "1", D + "/pic.jpeg"], check=True)
shutil.copy(D + "/pic.jpeg", D + "/media/saba.jpeg")   # (the character's photo, uploaded before)
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={mm:[],kie:[],bal:true};let n=0;
const MP3=fs.readFileSync(path.join(DIR,'tone.mp3'));
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x'),J=(code,d)=>{s.statusCode=code;s.setHeader('content-type','application/json');s.end(JSON.stringify(d))};
 if(u.pathname==='/stats')return J(200,st);
 if(u.pathname==='/bal'){st.bal=u.searchParams.get('to')==='1';return J(200,{})}
 if(u.pathname==='/img.jpeg'){s.setHeader('content-type','image/jpeg');return s.end(fs.readFileSync(path.join(DIR,'pic.jpeg')))}
 if(u.pathname==='/tone.mp3'){s.setHeader('content-type','audio/mpeg');return s.end(MP3)}
 let body={};try{body=JSON.parse(b||'{}')}catch{}
 // the stand-in MiniMax: HTTP 200 and its own code in base_resp
 if(/^\/v1\/(get_voice|t2a_v2|image_generation|music_generation)$/.test(u.pathname)){const key=(q.headers.authorization||'').replace('Bearer ','');st.mm.push({p:u.pathname,key,body});
   if(key!=='mm-good-key')return J(200,{base_resp:{status_code:1004,status_msg:'login fail: Please carry the API secret key'}});
   if(!st.bal&&u.pathname!=='/v1/get_voice')return J(200,{base_resp:{status_code:1008,status_msg:'insufficient balance'}});
   if(u.pathname==='/v1/get_voice')return J(200,{system_voice:[{voice_id:'Arabic_CalmWoman',voice_name:'Calm Woman'},{voice_id:'Arabic_FriendlyGuy',voice_name:'Friendly Guy'},{voice_id:'English_Graceful_Lady',voice_name:'Graceful Lady'},{voice_id:'Deep_Voice_Man',voice_name:'Deep Voice Man'},{voice_id:'Wise_Woman',voice_name:'Wise Woman'}],base_resp:{status_code:0,status_msg:'success'}});
   if(u.pathname==='/v1/t2a_v2')return J(200,{data:{audio:MP3.toString('hex'),status:2},extra_info:{audio_length:1000},base_resp:{status_code:0,status_msg:'success'}});
   if(u.pathname==='/v1/image_generation')return J(200,{data:{image_urls:['http://localhost:'+P+'/img.jpeg']},base_resp:{status_code:0,status_msg:'success'}});
   return J(200,{data:{audio:MP3.toString('hex'),status:2},base_resp:{status_code:0,status_msg:'success'}})}
 // the stand-in AI engine (Kie-style)
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){const id='t'+(++n);st.kie.push({model:body.model,input:body.input||null});return J(200,{code:200,msg:'success',data:{taskId:id}})}
 if(/record-?[iI]nfo/.test(u.pathname)){const url='http://localhost:'+P+'/tone.mp3';return J(200,{code:200,msg:'success',data:{state:'success',successFlag:1,response:{resultUrls:[url]},resultJson:JSON.stringify({resultUrls:[url]})}})}
 if(/chat\/credit/.test(u.pathname))return J(200,{code:200,msg:'success',data:1000});
 J(404,{})})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
mk = subprocess.Popen(["node", D + "/mock.js", str(MP), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_", "MINIMAX_", "TTS_", "MUSIC_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false",
  KIE_API_KEY="kk", KIE_BASE_URL=M, MIRROR_MEDIA="false", NV_AUTOCHECK="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))

def api(p, body=None, method=None, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=60).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def stats(): return json.loads(urllib.request.urlopen(M + "/stats", timeout=10).read())
def wait_job(jid, tok=None, secs=60):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        c, j = api("/v1/jobs/" + jid, tok=tok)
        if j.get("status") in ("done", "failed"): return j
        time.sleep(0.4)
    return j
def bal(): return api("/v1/billing", tok=TOKEN)[1].get("credits")
def mm_last(path): return [x for x in stats()["mm"] if x["p"] == path]
def local(url): return isinstance(url, str) and (url.startswith(B + "/media/") or url.startswith("/media/"))

def server_part():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    ok(api("/v1/config")[1].get("providers", {}).get("minimax183") == {"voice": False, "image": False, "music": False}, "no key → MiniMax used for nothing")
    # a wrong key → refused; the right key → works, with MiniMax's voices
    ok(api("/v1/admin/providers/minimax", {"apiKey": "mm-wrong", "baseUrl": M}, method="PUT")[0] == 200, "saving the key failed")
    c, r = api("/v1/admin/minimax183/check", {}); out["check_wrong"] = r
    ok(r.get("state") == "down" and r.get("type") == "auth", f"a wrong key should be refused: {r}")
    api("/v1/admin/providers/minimax", {"apiKey": "mm-good-key"}, method="PUT")
    c, r = api("/v1/admin/minimax183/check", {}); out["check_good"] = {k: r.get(k) for k in ("state", "note", "voices")}
    ok(r.get("state") == "online" and r.get("voices") == 5 and "5 voices" in r.get("note", ""), f"the right key should work with 5 voices: {r}")
    ok(all(x["key"] for x in stats()["mm"]) and all(x["p"] == "/v1/get_voice" for x in stats()["mm"]), "the check must only read the free voice list")
    ok(api("/v1/config")[1].get("providers", {}).get("minimax183") == {"voice": True, "image": True, "music": True}, "with the key, voices, pictures and music are on")
    ok(api("/v1/admin/minimax183", {"voice": False}, method="PUT", tok=TOKEN)[0] == 403, "a customer must not switch MiniMax")
    k0 = len(stats()["kie"])
    # voices: Arabic for a woman, English for a man
    b0 = bal()
    c, j = api("/v1/jobs", {"kind": "voice", "prompt": "أهلاً بكم في متجرنا الجديد، تفضلوا", "title": "v183 ar", "meta": {"dialect": "najdi", "gender": "female", "tone": "warm"}}, tok=TOKEN)
    ok(c == 200, f"voice job refused: {c} {j}"); j = wait_job(j.get("id", ""), TOKEN)
    t = (mm_last("/v1/t2a_v2") or [{}])[-1].get("body", {}); out["t2a_ar"] = {"model": t.get("model"), "lang": t.get("language_boost"), "voice": (t.get("voice_setting") or {}).get("voice_id"), "emotion": (t.get("voice_setting") or {}).get("emotion")}
    ok(j.get("status") == "done" and local(j.get("url")), f"the Arabic voice should be made and kept here: {j.get('status')} {j.get('url')} {j.get('error')}")
    ok(out["t2a_ar"] == {"model": "speech-2.8-hd", "lang": "Arabic", "voice": "Arabic_CalmWoman", "emotion": "happy"}, f"MiniMax should get Arabic, an Arabic woman's voice and the feeling: {out['t2a_ar']}")
    ok(bal() < b0, "the voice should be charged in credits")
    c, j = api("/v1/jobs", {"kind": "voice", "prompt": "Welcome to our new store, come on in.", "title": "v183 en", "meta": {"dialect": "enUS", "gender": "male"}}, tok=TOKEN); j = wait_job(j.get("id", ""), TOKEN)
    t = (mm_last("/v1/t2a_v2") or [{}])[-1].get("body", {}); out["t2a_en"] = {"lang": t.get("language_boost"), "voice": (t.get("voice_setting") or {}).get("voice_id")}
    ok(j.get("status") == "done" and out["t2a_en"] == {"lang": "English", "voice": "Deep_Voice_Man"}, f"English for a man: {out['t2a_en']} {j.get('error')}")
    ok(len(stats()["kie"]) == k0, "the AI engine must not be asked for MiniMax voices")
    # pictures: MiniMax Image-01 picked, with a character's photo
    b0 = bal()
    c, j = api("/v1/jobs", {"kind": "image", "model": "mmimage", "prompt": "a calm portrait of Saba in a garden, v183", "aspect": "16:9", "inputs": {"chRef": "/media/saba.jpeg"}}, tok=TOKEN)
    ok(c == 200, f"MiniMax picture refused: {c} {j}"); j = wait_job(j.get("id", ""), TOKEN)
    t = (mm_last("/v1/image_generation") or [{}])[-1].get("body", {}); out["img"] = {"model": t.get("model"), "ratio": t.get("aspect_ratio"), "n": t.get("n"), "ref": (t.get("subject_reference") or [{}])[0].get("image_file")}
    ok(j.get("status") == "done" and local(j.get("url")), f"the MiniMax picture should be kept here: {j.get('status')} {j.get('url')} {j.get('error')}")
    ok(out["img"] == {"model": "image-01", "ratio": "16:9", "n": 1, "ref": B + "/media/saba.jpeg"}, f"MiniMax should get image-01, 16:9 and the photo as a full address: {out['img']}")
    out["img_price"] = b0 - bal(); ok(1 <= out["img_price"] <= 2, f"a MiniMax picture should cost about 1 credit: {out['img_price']}")
    # music: instrumental without words
    c, j = api("/v1/jobs", {"kind": "music", "prompt": "calm oud for a travel film, v183", "dur": 30}, tok=TOKEN); j = wait_job(j.get("id", ""), TOKEN)
    t = (mm_last("/v1/music_generation") or [{}])[-1].get("body", {}); out["music"] = {"model": t.get("model"), "inst": t.get("is_instrumental"), "prompt": t.get("prompt")}
    ok(j.get("status") == "done" and local(j.get("url")) and out["music"]["model"] == "music-2.6" and out["music"]["inst"] is True and "oud" in (out["music"]["prompt"] or ""), f"MiniMax music: {out['music']} {j.get('status')} {j.get('error')}")
    ok(len(stats()["kie"]) == k0, "the AI engine must not be asked for MiniMax pictures or music")
    # the balance used up → fails, credits back, staff told
    urllib.request.urlopen(M + "/bal?to=0", timeout=5); b0 = bal()
    c, j = api("/v1/jobs", {"kind": "voice", "prompt": "One more line for the balance test.", "title": "v183 bal", "meta": {"dialect": "enUS", "gender": "female"}}, tok=TOKEN); j = wait_job(j.get("id", ""), TOKEN)
    ok(j.get("status") == "failed", f"an empty MiniMax balance should fail the job: {j.get('status')}")
    time.sleep(0.5); ok(bal() == b0, f"the credits should come back: {b0} → {bal()}")
    me = api("/v1/me")[1]; out["alerts"] = me.get("alerts138"); ok("minimax" in (me.get("alerts138") or {}), f"staff should see MiniMax out of credits: {me.get('alerts138')}")
    urllib.request.urlopen(M + "/bal?to=1", timeout=5)
    # voices off → the AI engine speaks again; pictures off → MiniMax Image refused at once, nothing charged
    ok(api("/v1/admin/minimax183", {"voice": False, "image": False}, method="PUT")[1].get("voice") is False, "switching voices off failed")
    n0 = len(mm_last("/v1/t2a_v2"))
    c, j = api("/v1/jobs", {"kind": "voice", "prompt": "Back on the other engine now.", "title": "v183 off", "meta": {"dialect": "enUS", "gender": "female"}}, tok=TOKEN); j = wait_job(j.get("id", ""), TOKEN)
    ok(len(mm_last("/v1/t2a_v2")) == n0 and len(stats()["kie"]) > k0, f"voices off → not MiniMax: {j.get('status')} {j.get('error')}")
    b0 = bal(); c, r = api("/v1/jobs", {"kind": "image", "model": "mmimage", "prompt": "a red door, v183 off", "aspect": "1:1"}, tok=TOKEN)
    ok(c >= 400 and bal() == b0, f"pictures off → refused at once, nothing charged: {c} {r}")
    ok(api("/v1/config")[1]["providers"]["minimax183"] == {"voice": False, "image": False, "music": True}, "config should follow the switches")
    api("/v1/admin/minimax183", {"voice": True, "image": True}, method="PUT")

async def page_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=S.user||{{name:'Owner',method:'email',contact:'owner@nooi.ai'}};persist();S.admTab='models';go('admin')}}")
        await pg.wait_for_function("!!document.querySelector('.aiprow[data-k=\"minimax\"]')", timeout=20000)
        # (v184) MiniMax is a row of its own in the AI providers list, among the all-in-one engines near the top; a tap opens it
        pos = await E("()=>{const r=document.querySelector('.aiprow[data-k=\"minimax\"]'),t=document.querySelector('.admtabs').getBoundingClientRect();return {grp:r.closest('.aipgrp').dataset.g,below:Math.round(r.getBoundingClientRect().top-t.bottom),logo:!!r.querySelector('.aiplogo img')}}")
        out[tag + "-pos"] = pos; ok(pos["grp"] == "all" and 0 <= pos["below"] < 900 and pos["logo"], f"{tag}: the MiniMax row should be near the top with its logo: {pos}")
        await pg.click('.aiprow[data-k="minimax"] .aiphead')
        await pg.wait_for_function("!!document.getElementById('mm183key')&&document.getElementById('mm183key').offsetParent!==null", timeout=20000)
        # the key typed in the box: a wrong one is refused, the right one works with MiniMax's voices
        async def save_key(k):
            await pg.fill("#mm183key", k); await pg.click('[data-act="mm183-save"]')
            await pg.wait_for_function("!MM183.checking&&!!document.getElementById('mm183st')&&!/…/.test(document.getElementById('mm183st').textContent)", timeout=20000)
            return await E("()=>document.getElementById('mm183st').textContent")
        st_bad = await save_key("mm-wrong-" + lang)
        ok(("رُفض" in st_bad or "رفضت" in st_bad) if ar else "refused" in st_bad, f"{tag}: a wrong key should be refused: {st_bad}")
        st_ok = await save_key("mm-good-key")
        ok(("المفتاح يعمل" in st_ok if ar else "Key works" in st_ok) and "5" in st_ok, f"{tag}: the right key should work with 5 voices: {st_ok}")
        ok(await E("()=>document.getElementById('mm183key').value===''&&document.getElementById('mm183key').type==='password'"), f"{tag}: the key must not stay on the page")
        v = await E("""()=>{const c=document.getElementById('mm183p'),W=innerWidth;return {text:c.innerText,sw:[...c.querySelectorAll('[data-act="mm183-use"]')].map(b=>b.dataset.k+':'+b.getAttribute('aria-checked')),
          region:[...c.querySelectorAll('[data-act="mm183-region"]')].map(b=>b.dataset.v+':'+b.getAttribute('aria-pressed')),models:[...c.querySelectorAll('[data-mm183]')].map(i=>i.dataset.mm183),
          wide:[...c.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>W+1||b.left<-1)}).length,st:document.getElementById('mm183st').textContent}}""")
        out[tag + "-card"] = {k: v[k] for k in ("sw", "region", "models", "wide", "st")}
        ok(v["sw"] == ["voice:true", "image:true", "music:true"] and v["region"] == ["intl:true", "cn:false"] and v["models"] == ["speechModel", "imageModel", "musicModel"] and not v["wide"], f"{tag}: the MiniMax box: {out[tag + '-card']}")
        await pg.screenshot(path=D + f"/{tag}-card.png")
        # MiniMax Image-01 among the picture engines; switched off → gone
        has = lambda: E("()=>{S.hf.tab='image';hfModelSheet();const t=(document.getElementById('modalRoot').innerText||'');document.getElementById('modalRoot').innerHTML='';return t.includes('MiniMax Image-01')}")
        ok(await has(), f"{tag}: MiniMax Image-01 should be in the picture engines")
        await E("()=>{S.admTab='models';go('admin')}"); await pg.wait_for_function("!!document.querySelector('[data-act=\"mm183-use\"][data-k=\"image\"]')", timeout=15000)
        await pg.click('[data-act="mm183-use"][data-k="image"]'); await pg.wait_for_function("API.cfg.providers.minimax183.image===false", timeout=15000)
        ok(not await has(), f"{tag}: with Pictures off, MiniMax Image-01 should leave the picture engines")
        await E("()=>{S.admTab='models';go('admin')}"); await pg.wait_for_function("!!document.querySelector('[data-act=\"mm183-use\"][data-k=\"image\"]')", timeout=15000)
        await pg.click('[data-act="mm183-use"][data-k="image"]'); await pg.wait_for_function("API.cfg.providers.minimax183.image===true", timeout=15000)
        ok(await has(), f"{tag}: Pictures on again → back in the list")
        ok(not errs, f"{tag}: page errors {errs[:3]}")
    finally:
        await br.close()

async def pages():
    async with async_playwright() as p:
        await page_part(p, True, "en")
        await page_part(p, False, "ar")

try:
    server_part()
    asyncio.run(pages())
finally:
    srv.terminate(); srv.wait(); mk.terminate(); mk.wait()
print(json.dumps(out, ensure_ascii=False, indent=1)[:4000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + "/server.log").read()[-1500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v183 OK")
