# v187 — the prompt box in one row, videos in their real shape, a Download menu, what each engine makes, slow motion from the words.
# A real nooi server with a stand-in AI engine (it keeps every request it gets) and a stand-in MiniMax:
#  · /v1/config: each video engine's resolutions and sound (caps187 and registry[id].res / .audio)
#  · the format, the resolution and the sound reach the engine: Seedance 2.0 9:16 1080p with sound, Kling 2.6 1:1 with sound,
#    Kling 3.0 1080P → pro / 4K → 4K, Wan 3.0 1080P; MiniMax Hailuo 6 s asked for 1080P → 1080P, 10 s → 768P; a silent engine
#    (HappyHorse) asked for sound → a silent job (no "spoken in…" line in its words), a talking Seedance job keeps it
#  · slow motion from the words: "slow motion" → 0.5× (+2), "بحركة بطيئة جداً" → 0.25× (+4), the words taken out of what the
#    engine gets, the video really slowed (1 s → 2 s); the job saying "off" → nothing added
#  · Bitrate "Standard" → a smaller H.264 file made here
#  · the Download menu's links: MP4 (as it is, or made from a WebM), MP3 only with a sound track (409 without), PNG of the first /
#    last / a chosen frame — always "Content-Disposition: attachment"; a changed link → 403
#  · the page (phone in English, computer in Arabic): one row [+][engine][⚙][Generate · cost] under the words, the + menu, the
#    settings sheet (format, how many, quality, length, sound, bitrate) with the price live, Sound off and greyed for MiniMax with
#    the reason, on for Seedance; no slow-motion buttons; the price grows with the words "slow motion"; Generate sends 2 videos with
#    sound at 1080p; a square video's card is square (contain, nothing cut); Download opens the menu and gives the files
# Run: python3 tests/v187.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP = 8620, 8621; B = f"http://localhost:{PORT}"; M = f"http://localhost:{MP}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v187-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "q" * 32; now = int(time.time() * 1000)
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": now},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "1", "-c:v", "libvpx-vp9", "-b:v", "3M", D + "/vid.webm")                     # what the engine makes
FF("-f", "lavfi", "-i", "testsrc2=size=768x768:rate=24", "-t", "1.5", "-c:v", "libvpx-vp9", "-b:v", "300k", D + "/media/sq.webm")           # a square video, no sound
FF("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "1.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/media/snd.mp4")
FF("-f", "lavfi", "-i", "testsrc2=size=320x240", "-frames:v", "1", D + "/media/pic.png")
MOCK = r"""
const http=require('http'),fs=require('fs'),path=require('path');const P=+process.argv[2],DIR=process.argv[3];const st={mm:[],kie:[]};const task={};let n=0;
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x'),J=(code,d)=>{s.statusCode=code;s.setHeader('content-type','application/json');s.end(JSON.stringify(d))};
 if(u.pathname==='/stats')return J(200,st);
 if(u.pathname==='/vid.webm'){s.setHeader('content-type','video/webm');return s.end(fs.readFileSync(path.join(DIR,'vid.webm')))}
 let body={};try{body=JSON.parse(b||'{}')}catch{}
 if(/^\/v1\/(get_voice|video_generation|query\/video_generation|files\/retrieve)$/.test(u.pathname)){const key=(q.headers.authorization||'').replace('Bearer ','');
   if(u.pathname==='/v1/video_generation')st.mm.push(Object.assign({},body,{first_frame_image:undefined}));
   if(key!=='mm-good-key')return J(200,{base_resp:{status_code:1004,status_msg:'login fail'}});
   if(u.pathname==='/v1/get_voice')return J(200,{system_voice:[{voice_id:'Wise_Woman',voice_name:'Wise Woman'}],base_resp:{status_code:0,status_msg:'success'}});
   if(u.pathname==='/v1/video_generation')return J(200,{task_id:'mmv'+(++n),base_resp:{status_code:0,status_msg:'success'}});
   if(u.pathname==='/v1/query/video_generation')return J(200,{status:'Success',file_id:'f1',base_resp:{status_code:0,status_msg:'success'}});
   return J(200,{file:{file_id:'f1',download_url:'http://localhost:'+P+'/vid.webm'},base_resp:{status_code:0,status_msg:'success'}})}
 if(q.method==='POST'&&/^\/api\/v1\//.test(u.pathname)){st.kie.push({path:u.pathname,model:body.model,input:body.input||body});const id='t'+(++n);return J(200,{code:200,msg:'success',data:{taskId:id}})}
 if(/record-?[iI]nfo/.test(u.pathname)){const url='http://localhost:'+P+'/vid.webm';return J(200,{code:200,msg:'success',data:{state:'success',successFlag:1,response:{resultUrls:[url]},resultJson:JSON.stringify({resultUrls:[url]})}})}
 if(/chat\/credit/.test(u.pathname))return J(200,{code:200,msg:'success',data:1000});
 J(404,{})})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
mk = subprocess.Popen(["node", D + "/mock.js", str(MP), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_", "MINIMAX_", "TTS_", "MUSIC_", "MIRROR_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false",
  KIE_API_KEY="kk", KIE_BASE_URL=M, NV_AUTOCHECK="false", LONG_FAST="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))

def api(p, body=None, method=None, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=60).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def raw(p):
    try:
        r = urllib.request.urlopen(B + p, timeout=120); return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read()
def stats(): return json.loads(urllib.request.urlopen(M + "/stats", timeout=10).read())
def wait_job(jid, tok=None, secs=120):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        c, j = api("/v1/jobs/" + jid, tok=tok)
        if j.get("status") in ("done", "failed"): return j
        time.sleep(0.4)
    return j
def make(body, tok=TOKEN):
    c, j = api("/v1/jobs", dict({"kind": "video", "dur": 5, "aspect": "16:9"}, **body), tok=tok)
    if c != 200 or not j.get("id"): fails.append(f"job not made {body} {c} {j}"); return {}
    return wait_job(j["id"], tok)
def kie_for(word): return [x for x in stats()["kie"] if word in json.dumps(x, ensure_ascii=False)]
def probe(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name:format=duration", "-of", "json", f], capture_output=True, text=True)
    try: return json.loads(r.stdout or "{}")
    except Exception: return {}
def media_file(url): return D + "/media/" + os.path.basename(str(url or "").split("?")[0])
PICK = lambda j: {k: j.get(k) for k in ("status", "url", "error", "cost", "sent")}
SPEECH = "Everything said aloud is in"

def server_part():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    cfg = api("/v1/config")[1]; caps, reg = cfg.get("caps187") or {}, cfg.get("registry") or {}
    out["caps"] = {k: caps.get(k) for k in ("hailuo", "kling40", "seedance20", "veo")}
    ok(caps.get("hailuo", {}).get("audio") is False and caps.get("kling40", {}).get("audio") == "always" and caps.get("seedance20", {}).get("audio") is True
       and "1080P" in caps.get("seedance20", {}).get("res", []) and caps.get("veo", {}).get("res") == ["720P"], f"config should carry each engine's resolutions and sound: {out['caps']}")
    ok(reg.get("hailuo", {}).get("audio") is False and "1080P" in reg.get("kling30", {}).get("res", []), f"the registry should carry them too: {reg.get('hailuo')} {reg.get('kling30')}")
    ok(api("/v1/admin/providers/minimax", {"apiKey": "mm-good-key", "baseUrl": M}, method="PUT")[0] == 200, "saving the MiniMax key failed")
    # 1. the format, the resolution and the sound reach the engine
    j = make({"model": "seedance20", "aspect": "9:16", "prompt": 'A woman on a balcony says "صباح الخير يا جميل", v187 one', "meta": {"res": "1080P", "audio": True}}, tok=None)
    i = (kie_for("v187 one") or [{}])[-1].get("input", {}); out["seedance"] = {k: i.get(k) for k in ("resolution", "generate_audio", "aspect_ratio")}
    ok(j.get("status") == "done" and i.get("resolution") == "1080p" and i.get("generate_audio") is True and i.get("aspect_ratio") == "9:16" and SPEECH in (i.get("prompt") or ""),
       f"Seedance should get 1080p, sound, 9:16 and the spoken-language line: {out['seedance']} {PICK(j)}")
    j = make({"model": "happyhorse", "prompt": 'A man in a garden says "مرحبا يا صديقي", v187 two', "meta": {"audio": True, "res": "1080P"}}, tok=None)
    i = (kie_for("v187 two") or [{}])[-1].get("input", {}); out["happyhorse"] = i
    ok(j.get("status") == "done" and SPEECH not in (i.get("prompt") or "") and "audio" not in i, f"a silent engine's job is silent (no spoken-language line, no sound asked): {i}")
    j = make({"model": "kling26", "aspect": "1:1", "prompt": "A red kite over the dunes, v187 three", "meta": {"audio": True, "res": "720P"}}, tok=None)
    i = (kie_for("v187 three") or [{}])[-1].get("input", {}); out["kling26"] = {k: i.get(k) for k in ("sound", "aspect_ratio")}
    ok(i.get("sound") is True and i.get("aspect_ratio") == "1:1", f"Kling 2.6 should get sound and 1:1: {out['kling26']}")
    for res, mode, w in (("1080P", "pro", "v187 four"), ("4K", "4K", "v187 five")):
        make({"model": "kling30", "prompt": "A lighthouse in a storm, " + w, "meta": {"res": res}}, tok=None)
        i = (kie_for(w) or [{}])[-1].get("input", {}); out["kling30-" + res] = i.get("mode")
        ok(i.get("mode") == mode, f"Kling 3.0 asked for {res} should be sent mode {mode}: {i.get('mode')}")
    make({"model": "wan30", "prompt": "A tram in the rain, v187 six", "meta": {"res": "1080P"}}, tok=None)
    i = (kie_for("v187 six") or [{}])[-1].get("input", {}); out["wan30"] = i.get("resolution")
    ok(i.get("resolution") == "1080P", f"Wan 3.0 should get 1080P: {i.get('resolution')}")
    for dur, want, w in ((6, "1080P", "v187 seven"), (10, "768P", "v187 eight")):
        j = make({"model": "hailuo", "dur": dur, "prompt": "Waves on black rocks, " + w, "meta": {"res": "1080P", "audio": True}}, tok=None)
        b = ([x for x in stats()["mm"] if w in (x.get("prompt") or "")] or [{}])[-1]; out["hailuo-%d" % dur] = {k: b.get(k) for k in ("resolution", "duration")}
        ok(j.get("status") == "done" and b.get("resolution") == want and b.get("duration") == dur, f"MiniMax Hailuo {dur} s asked for 1080P → {want}: {out['hailuo-%d' % dur]} {PICK(j)}")
    # 2. slow motion from the words (priced, the words taken out, the video slowed here)
    plain = make({"model": "seedance20", "prompt": "A falcon dives over the sea, v187 nine"})
    slow = make({"model": "seedance20", "prompt": "A falcon dives over the sea in slow motion, v187 ten"})
    i = (kie_for("v187 ten") or [{}])[-1].get("input", {}); d = probe(media_file(slow.get("url"))).get("format", {}).get("duration")
    out["slow"] = {"plain": plain.get("cost"), "slow": slow.get("cost"), "prompt": (i.get("prompt") or "")[:200], "dur": d, "url": slow.get("url")}
    ok(slow.get("status") == "done" and (slow.get("cost") or 0) - (plain.get("cost") or 0) == 2, f"'slow motion' should add the 0.5× extra (+2): {out['slow']}")
    ok("sea in slow motion" not in (i.get("prompt") or "") and " in ," not in (i.get("prompt") or "") and "real-time speed" in (i.get("prompt") or ""), f"the engine gets real-time action, not the words: {i.get('prompt')}")
    ok(d and 1.7 < float(d) < 2.4, f"the video should be slowed to about 2 s: {d}")
    slow_ar = make({"model": "seedance20", "prompt": "صقر يغوص فوق البحر بحركة بطيئة جداً، v187 eleven"})
    i = (kie_for("v187 eleven") or [{}])[-1].get("input", {}); out["slow_ar"] = {"cost": slow_ar.get("cost"), "prompt": (i.get("prompt") or "")[:160]}
    ok((slow_ar.get("cost") or 0) - (plain.get("cost") or 0) == 4 and "بطيئة" not in (i.get("prompt") or ""), f"'بحركة بطيئة جداً' → 0.25× (+4), the words out: {out['slow_ar']}")
    off = make({"model": "seedance20", "prompt": "A falcon dives over the sea in slow motion, v187 twelve", "meta": {"slow163": "off"}})
    i = (kie_for("v187 twelve") or [{}])[-1].get("input", {})
    ok(off.get("cost") == plain.get("cost") and "sea in slow motion" in (i.get("prompt") or "") and "real-time speed" not in (i.get("prompt") or ""), f"a job that says 'off' stays as it is: {off.get('cost')} {i.get('prompt')}")
    # 3. Bitrate "Standard" → a smaller H.264 file
    std = make({"model": "seedance20", "prompt": "A city at night, v187 thirteen", "meta": {"bitrate187": "standard"}}, tok=None)
    p = probe(media_file(std.get("url"))); out["std"] = {"url": std.get("url"), "codec": [s.get("codec_name") for s in p.get("streams", [])]}
    ok(std.get("status") == "done" and str(std.get("url") or "").endswith("-std.mp4") and "h264" in out["std"]["codec"], f"Standard bitrate should give a smaller H.264 file: {out['std']}")
    # 4. the Download menu's links
    c, info = api("/v1/media/info187?u=/media/snd.mp4"); c2, info2 = api("/v1/media/info187?u=/media/sq.webm")
    ok(info.get("video") and info.get("audio") and info2.get("video") and not info2.get("audio"), f"info should tell sound / no sound: {info} {info2}")
    def link(u, as_, t=None):
        c, r = api("/v1/media/dl187", {"u": u, "as": as_, **({"t": t} if t is not None else {}), "name": "رحلة الصقر"}); return c, r.get("href")
    res = {}
    for key, (u, as_, t, sig, ext) in {"mp4": ("/media/snd.mp4", "mp4", None, b"ftyp", ".mp4"), "webm→mp4": ("/media/sq.webm", "mp4", None, b"ftyp", ".mp4"),
                                         "mp3": ("/media/snd.mp4", "mp3", None, None, ".mp3"), "png-first": ("/media/snd.mp4", "png", "first", b"\x89PNG", "-first.png"),
                                         "png-last": ("/media/snd.mp4", "png", "last", b"\x89PNG", "-last.png"), "png-0.7": ("/media/sq.webm", "png", 0.7, b"\x89PNG", "-frame.png")}.items():
        c, href = link(u, as_, t); st, h, body = raw(href or "/x"); cd = h.get("Content-Disposition", "")
        res[key] = [c, st, cd[:90], len(body)]
        good = c == 200 and st == 200 and cd.startswith("attachment;") and ("filename*=UTF-8''" in cd) and cd.split("''")[-1].endswith(ext.replace(".", "%2E") if False else ext) and len(body) > 200
        good = good and ((sig in body[:16]) if sig else (body[:3] == b"ID3" or body[:1] == b"\xff"))
        ok(good, f"download {key} should come as an attachment {ext}: {res[key]} {body[:16]!r}")
        if key == "webm→mp4":
            open(D + "/conv.mp4", "wb").write(body); ok("h264" in [s.get("codec_name") for s in probe(D + "/conv.mp4").get("streams", [])], "a WebM should be made into an H.264 MP4")
    out["dl"] = res
    c, _ = link("/media/sq.webm", "mp3"); ok(c == 409, f"MP3 of a video without sound should be refused: {c}")
    c, href = link("/media/snd.mp4", "mp4"); st, _, _ = raw(href.replace("as=mp4", "as=mp3")); ok(st == 403, f"a changed link should be refused: {st}")
    c, _ = link("/media/../data/db.json", "file"); ok(c == 404, f"only files of the media folder: {c}")

async def page_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"; R = {}
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone, accept_downloads=True)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg&&API.cfg.caps187", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=S.user||{{name:'Owner',method:'email',contact:'owner@nooi.ai'}};Object.assign(S.hf,{{tab:'video',vModel:'hailuo',bots:false,prompt:'',batch:1,sound:false,br:'high',dur:5,aspect:'16:9'}});delete S.hf.res187;persist();go('home')}}")
        await pg.wait_for_selector(".hfbox .hf187row", timeout=20000)
        # the one row under the words
        v = await E("""()=>{const box=document.querySelector('.hfbox'),row=box.querySelector('.hf187row'),q=box.querySelector('#hfq'),b=box.getBoundingClientRect();
          return {acts:[...row.children].map(x=>x.dataset.act||x.className),below:q&&(q.compareDocumentPosition(row)&Node.DOCUMENT_POSITION_FOLLOWING)>0,
            inside:[...row.children].every(x=>{const r=x.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.height>0}),fit:row.scrollWidth<=row.clientWidth+1,
            go:row.querySelector('.hf187go').innerText.replace(/\\s+/g,' ').trim(),old:box.querySelectorAll('.hfbar,.hfmrow:not(.hf187row)').length,
            slowBtns:document.querySelectorAll('#main .sl163,#main [data-act^="sl163"],#main [data-act="hf136-slow"]').length,
            name:(row.querySelector('[data-act="hf-model"] b')||{}).scrollWidth<=((row.querySelector('[data-act="hf-model"] b')||{}).clientWidth||0)+1}}""")
        R["row"] = v
        ok(v["acts"] in (["hf187-add", "hf-model", "hf187-set", "hf-send"], ["hf187-add", "hf-model", "hf187-set", "an205-open", "hf-send"]) and v["below"] and v["inside"] and v["fit"] and v["old"] == 0, f"{tag}: one row [+][engine][⚙][Generate] under the words: {v}")
        ok(("إنشاء" if ar else "Generate") in v["go"] and any(ch.isdigit() for ch in v["go"]), f"{tag}: the button should say Generate and the price: {v['go']}")
        ok(v["slowBtns"] == 0, f"{tag}: no slow-motion buttons: {v['slowBtns']}")
        ok(v["name"], f"{tag}: the engine's name should fit in its chip")
        # + opens what can be added
        await pg.click('[data-act="hf187-add"]'); await pg.wait_for_timeout(200)
        m = await E("()=>{const m=document.getElementById('hf187add');return {open:!m.hidden,n:m.children.length,exp:document.querySelector('[data-act=\"hf187-add\"]').getAttribute('aria-expanded')}}")
        await pg.click('[data-act="hf187-add"]'); await pg.wait_for_timeout(200)
        m["closed"] = await E("()=>document.getElementById('hf187add').hidden"); R["add"] = m
        ok(m["open"] and m["n"] >= 3 and m["exp"] == "true" and m["closed"], f"{tag}: + should open and close what can be added: {m}")
        # the settings sheet — MiniMax: Sound off, greyed, with the reason
        async def sheet():
            await pg.click('[data-act="hf187-set"]'); await pg.wait_for_selector("#modalRoot .sh187", timeout=10000)
            return await E("""()=>{const s=document.querySelector('#modalRoot .sh187'),sw=s.querySelector('[data-act="hf187-snd"]'),W=innerWidth;
              return {names:[...s.querySelectorAll('.n187 b')].map(b=>b.textContent),snd:{dis:sw.disabled,on:sw.getAttribute('aria-checked'),hint:(sw.closest('.r187').querySelector('.h187')||{}).textContent||''},
                q:[...s.querySelectorAll('[data-act="hf187-res"]')].map(b=>b.dataset.v+(b.getAttribute('aria-checked')==='true'?'*':'')),cost:+(document.getElementById('c187')||{}).textContent,
                slow:(s.querySelector('.slow187')||{}).textContent||'',wide:[...s.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>W+1||b.left<-1)}).length}}""")
        s = await sheet(); R["sheet-hailuo"] = s
        names = ["الأبعاد", "العدد", "الجودة", "المدة", "الصوت", "معدل البت"] if ar else ["Aspect ratio", "Batch size", "Quality", "Duration", "Sound", "Bitrate"]
        ok(s["names"][:6] == names and not s["wide"], f"{tag}: the sheet should have format, how many, quality, length, sound, bitrate: {s['names']} wide {s['wide']}")
        ok(s["snd"]["dis"] and s["snd"]["on"] == "false" and (("صامتة" in s["snd"]["hint"]) if ar else ("silent" in s["snd"]["hint"])), f"{tag}: MiniMax → Sound off and greyed with the reason: {s['snd']}")
        ok(s["q"] == ["768P", "1080P*"], f"{tag}: MiniMax's qualities, 1080P chosen: {s['q']}")
        await E("()=>closeSheet()")
        # Seedance 2.0: Sound can be turned on; the price follows how many and the length
        await E("()=>{S.hf.vModel='seedance20';persist();renderView()}"); s = await sheet(); R["sheet-seedance"] = s
        ok(not s["snd"]["dis"] and s["q"] == ["480P", "720P", "1080P*", "4K"], f"{tag}: Seedance → Sound can be on, 1080P chosen: {s}")
        await pg.click('#modalRoot [data-act="hf187-snd"]'); await pg.wait_for_timeout(250)
        on = await E("()=>[document.querySelector('#modalRoot [data-act=\"hf187-snd\"]').getAttribute('aria-checked'),S.hf.sound]")
        ok(on == ["true", True], f"{tag}: Sound should turn on: {on}")
        c1 = await E("()=>+document.getElementById('c187').textContent")
        await pg.click('#modalRoot [data-act="hf187-n"][data-v="2"]'); await pg.wait_for_timeout(250)
        c2 = await E("()=>+document.getElementById('c187').textContent")
        await E("()=>{const r=document.querySelector('#modalRoot [data-hf187dur]');r.value='10';r.dispatchEvent(new Event('input',{bubbles:true}))}"); await pg.wait_for_timeout(150)
        c3 = await E("()=>[+document.getElementById('c187').textContent,(document.querySelector('.hfbox .hf187go .hfcost')||{}).textContent]")
        R["cost"] = [c1, c2, c3]
        ok(c1 > 0 and c2 == 2 * c1 and c3[0] > c2 and str(c3[0]) in (c3[1] or ""), f"{tag}: the price should follow how many and the length, in the sheet and on the button: {R['cost']}")
        await E("()=>{const r=document.querySelector('#modalRoot [data-hf187dur]');r.dispatchEvent(new Event('change',{bubbles:true}))}"); await pg.wait_for_timeout(200)
        await pg.click('#modalRoot [data-act="hf187-ok"]'); await pg.wait_for_timeout(250)
        ok(await E("()=>!document.querySelector('#modalRoot .sh187')"), f"{tag}: Apply should close the sheet")
        # slow motion from the words: the price grows, the sheet says so
        words = "صقر يغوص فوق البحر" if ar else "A falcon dives over the sea"
        slow = "بحركة بطيئة" if ar else "in slow motion"
        await pg.fill("#hfq", words + " " + tag); await pg.wait_for_timeout(150); p0 = await E("()=>hfCost()")
        await pg.fill("#hfq", words + " " + slow + " " + tag); await pg.wait_for_timeout(150); p1 = await E("()=>[hfCost(),document.querySelector('.hfbox .hf187go .hfcost').textContent]")
        R["slow"] = [p0, p1]; ok(p1[0] - p0 == 2 * 2 and str(p1[0]) in p1[1], f"{tag}: 'slow motion' adds 0.5×'s +2 for each of the 2 videos: {R['slow']}")
        s = await sheet(); ok(("0.5" in s["slow"]) and ("+2" in s["slow"]), f"{tag}: the sheet should say slow motion is on from the words: {s['slow']}")
        await E("()=>closeSheet()")
        # Generate: 2 videos, with sound, 1080p, 10 s, the slow words out of what the engine gets
        k0 = len(stats()["kie"])
        await pg.click('.hfbox [data-act="hf-send"]')
        for _ in range(80):
            sent = [x for x in stats()["kie"][k0:] if tag in json.dumps(x, ensure_ascii=False)]
            if len(sent) >= 2: break
            await pg.wait_for_timeout(250)
        R["sent"] = [{k: x["input"].get(k) for k in ("resolution", "generate_audio", "duration", "aspect_ratio")} for x in sent]
        ok(len(sent) == 2 and all(x["input"].get("resolution") == "1080p" and x["input"].get("generate_audio") is True and x["input"].get("duration") == 10 for x in sent),
           f"{tag}: Generate should send 2 videos, 1080p, with sound, 10 s: {R['sent']}")
        ok(all(slow not in (x["input"].get("prompt") or "") and "real-time speed" in (x["input"].get("prompt") or "") for x in sent), f"{tag}: the slow words should not reach the engine: {[x['input'].get('prompt', '')[:120] for x in sent]}")
        # a square video's card: square, contained, nothing cut
        await E("()=>{S.jobs.unshift({id:'sq187',kind:'video',status:'complete',url:'/media/sq.webm',resultUrl:'/media/sq.webm',prompt:'A square test',title:'A square test',model:'hailuo',created:Date.now(),progress:1,aspect:'16:9',dur:5});S.hf.out=['sq187'];persist();renderView()}")
        await pg.wait_for_function("(()=>{const v=document.querySelector('.hfrc .hfrm video[src*=\"sq.webm\"]');return v&&v.videoWidth>0})()", timeout=20000); await pg.wait_for_timeout(300)
        cd = await E("""()=>{const v=document.querySelector('.hfrc .hfrm video[src*="sq.webm"]'),m=v.closest('.hfrm'),b=m.getBoundingClientRect(),cs=getComputedStyle(v);
          return {ar:getComputedStyle(m).getPropertyValue('--ar').trim(),ratio:+(b.width/b.height).toFixed(3),fit:cs.objectFit,bg:getComputedStyle(m).backgroundColor}}""")
        R["card"] = cd; ok(cd["ar"] == "768/768" and abs(cd["ratio"] - 1) < 0.02 and cd["fit"] == "contain" and cd["bg"] in ("rgb(11, 11, 12)",), f"{tag}: the square video's card should be square and contained: {cd}")
        # Download → the menu → files
        btn = '.hfrc:has(video[src*="sq.webm"]) [data-act="dl187"]'
        await pg.click(btn); await pg.wait_for_selector("#modalRoot .dl187i", timeout=10000); await pg.wait_for_timeout(800)
        items = await E("()=>[...document.querySelectorAll('#modalRoot .dl187i')].map(b=>b.dataset.as+':'+(b.dataset.t||'')+':'+b.disabled)"); R["dl"] = items
        ok(len(items) == 5 and items[0] == "mp4::false" and items[1] == "mp3::true" and items[3] == "png:first:false" and items[4] == "png:last:false", f"{tag}: the menu: MP4, MP3 (greyed — no sound), PNG this / first / last: {items}")
        async with pg.expect_download(timeout=30000) as dl: await pg.click('#modalRoot .dl187i[data-as="mp4"]')
        f1 = (await dl.value).suggested_filename
        await pg.click(btn); await pg.wait_for_selector("#modalRoot .dl187i", timeout=10000)
        async with pg.expect_download(timeout=30000) as dl: await pg.click('#modalRoot .dl187i[data-as="png"][data-t="last"]')
        f2 = (await dl.value).suggested_filename; R["files"] = [f1, f2]
        ok(f1.endswith(".mp4") and f2.endswith("-last.png"), f"{tag}: the files should come as .mp4 and -last.png: {R['files']}")
        await pg.screenshot(path=D + f"/{tag}.png")
        ok(not errs, f"{tag}: page errors {errs[:3]}")
    finally:
        out[tag] = R; await br.close()

async def pages():
    async with async_playwright() as p:
        await page_part(p, True, "en")
        await page_part(p, False, "ar")

try:
    server_part()
    asyncio.run(pages())
finally:
    srv.terminate(); srv.wait(); mk.terminate(); mk.wait()
print(json.dumps(out, ensure_ascii=False, indent=1)[:6000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + "/server.log").read()[-2500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v187 OK")
