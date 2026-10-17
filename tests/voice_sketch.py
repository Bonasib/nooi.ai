# v78d: natural voice & dialogue + Live AI sketch, on a fresh server with a mocked text AI, mocked ElevenLabs, a mocked
# fal.ai and a mocked custom realtime endpoint. A second, non-staff account (API token) checks every credit.
# API: voices/feelings/price · a 2-speaker script → one steady voice each (the picked voice is used), lines rewritten for
#      the ear with feelings, one mixed file · Live AI frames on fal.ai and on a custom endpoint, 1 credit per N frames
#      charged on the server, a failed frame refunded, out of credits → 402, bad frames refused.
# UI (desktop English + phone Arabic, fake camera): Voice page shows the dialogue tool first → speakers from the script →
#      voice + feeling → the mixed dialogue in the library and the editor · the editor's AI voice-over speaks naturally at
#      the playhead · Sketch (v91): drawing never calls the paid model or makes pictures by itself; one AI button makes
#      1–10 versions of the same drawing, each in a different look. (The live-AI modes, camera, recording and keep-frame
#      left the Sketch page in v91; the realtime endpoint is still checked through the API above.)
import asyncio, hashlib, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, LPORT = 8070, 8071
D = tempfile.mkdtemp(prefix="nooi-vsk-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = os.environ.get("FFMPEG_PATH", "ffmpeg")
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=300:sample_rate=44100:duration=1.2", "-c:a", "libmp3lame", "-b:a", "64k", D + "/tone.mp3"], check=True)
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x2a7fff:s=64x64", "-frames:v", "1", D + "/frame.png"], check=True)
TOKEN = "nooi_" + "t" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "u2": {"plan": "pro", "credits": 3, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": [{"id": "tk1", "name": "test", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1}]}}}, open(D + "/data/db.json", "w"))
MOCK = r"""
const http=require('http'),fs=require('fs');const P=+process.argv[2],D=process.argv[3];const st={llm:0,ear:[],tts:[],fal:[],rt:[]};const PNG='data:image/png;base64,'+fs.readFileSync(D+'/frame.png').toString('base64');
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const J=(o,c)=>{s.statusCode=c||200;s.setHeader('content-type','application/json');s.end(JSON.stringify(o))};const u=q.url.split('?')[0];
 if(u==='/stats')return J(st);
 if(u==='/v1/messages'){st.llm++;const j=JSON.parse(b),c=j.messages[0].content,t=Array.isArray(c)?c.find(x=>x.type==='text').text:c;
  if(/Rewrite these lines so they sound like a real person speaking/.test(t)){const L=JSON.parse(/LINES: (\[[\s\S]*?\])\nReturn/.exec(t)[1]);st.ear.push({n:L.length,lang:(/speaking (\w+)/.exec(t)||[])[1],dialect:(/speaking \w+ \(([^)]*)\)/.exec(t)||[])[1]||null,tags:/audio tag/.test(t)});
   return J({content:[{type:'text',text:JSON.stringify({lines:L.map(x=>({i:x.i,text:'~'+x.text,emotion:x.i===0?'excited':'warm'}))})}]})}
  return J({content:[{type:'text',text:'{}'}]})}
 if(/^\/el\/v1\/text-to-speech\//.test(u)){const j=JSON.parse(b);st.tts.push({voice:decodeURIComponent(u.split('/').pop()),text:j.text,model:j.model_id,style:j.voice_settings&&j.voice_settings.style});s.setHeader('content-type','audio/mpeg');return s.end(fs.readFileSync(D+'/tone.mp3'))}
 if(u.startsWith('/fal/')){const j=JSON.parse(b);st.fal.push({model:u.slice(5),auth:q.headers.authorization,prompt:j.prompt,strength:j.strength,img:String(j.image_url||'').slice(0,22),sync:j.sync_mode});if(/FAIL/.test(j.prompt))return J({detail:'boom'},500);return J({images:[{url:PNG}]})}
 if(u==='/rt'){const j=JSON.parse(b);st.rt.push({auth:q.headers.authorization,prompt:j.prompt,img:String(j.image||'').slice(0,22)});return J({image:PNG})}
 J({error:'nf '+u},404)})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None, tok=None):
    h = {"content-type": "application/json"}
    if tok: h["authorization"] = "Bearer " + tok
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e: return {"_status": e.code, **json.loads(e.read() or b"{}")}
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{LPORT}/stats").read())
M = f"http://localhost:{LPORT}"
def setbal(n):   # the test client's balance, exactly
    b = api("/v1/billing", tok=TOKEN)["credits"]
    if n != b: api("/v1/admin/users/u2", {"creditsDelta": n - b}, "PATCH")
PNG = "data:image/png;base64," + __import__("base64").b64encode(open(D + "/frame.png", "rb").read()).decode()

def api_checks():
    g = api("/v1/voice/natural"); ok(g.get("ready") and len(g.get("voices", [])) == 20 and "whisper" in g.get("delivery", []) and g.get("per900", 0) >= 1, f"voices & feelings {str(g)[:300]}")
    r = api("/v1/voice/natural", {"lines": [{"text": "Did you see the sunrise?", "speaker": 0, "gender": "female"}, {"text": "Every single day.", "speaker": 1, "gender": "male"}, {"text": "It never gets old.", "speaker": 0}], "lang": "en", "dialect": "British", "voices": {"1": "nPczCjzI2devNBz1zQrb"}, "tags": True})
    st = stats(); tts = st["tts"][-3:]
    ok(r.get("url", "").find("/media/") >= 0 and r.get("dur", 0) > 2 and len(r.get("lines", [])) == 3 and r["lines"][0]["emotion"] == "excited", f"dialogue made {r}")
    ok(len(tts) == 3 and tts[0]["voice"] == tts[2]["voice"] and tts[1]["voice"] == "nPczCjzI2devNBz1zQrb" and tts[0]["voice"] != tts[1]["voice"] and all(t["text"].startswith("~") for t in tts) and tts[0]["model"] == "eleven_v3", f"one steady voice per speaker, the picked one used, rewritten lines {tts}")
    ok(st["ear"] and st["ear"][-1]["n"] == 3 and st["ear"][-1]["dialect"] == "British" and st["ear"][-1]["tags"], f"written for the ear {st['ear'][-1:]}")
    ok(api("/v1/voice/natural", {"lines": []}).get("_status") == 400, "empty script refused")
    # live AI sketch on fal.ai, as a client with 3 credits (2 frames per credit)
    c = api("/v1/realtime/sketch", tok=TOKEN); ok(c.get("ready") and c.get("engine") == "fal" and c.get("framesPerCredit") == 2 and not c.get("staff"), f"sketch engine {c}")
    seq = []
    for i in range(6):
        x = api("/v1/realtime/sketch", {"image": PNG, "prompt": "a red car", "style": "realistic", "target": "vehicle", "strength": .7}, tok=TOKEN); seq.append((x.get("charged"), x.get("credits"), x.get("frames"), x.get("_status"))); time.sleep(.3)
    ok(seq == [(1, 2, 1, None), (0, 2, 2, None), (1, 1, 3, None), (0, 1, 4, None), (1, 0, 5, None), (0, 0, 6, None)], f"1 credit per 2 frames {seq}")
    x = api("/v1/realtime/sketch", {"image": PNG, "prompt": "a red car"}, tok=TOKEN); ok(x.get("_status") == 402, f"out of credits → 402 {x}")
    fal = stats()["fal"]; ok(len(fal) == 6 and fal[0]["model"] == "fal-ai/fast-lightning-sdxl/image-to-image" and fal[0]["auth"] == "Key fal-test" and "a red car" in fal[0]["prompt"] and "photorealistic" in fal[0]["prompt"] and fal[0]["img"].startswith("data:image/png") and fal[0]["sync"] is True and fal[0]["strength"] == .7, f"fal call {fal[:1]}")
    # a failed frame gives its credit back
    time.sleep(.3); api("/v1/admin/users/u2", {"creditsDelta": 2}, "PATCH")
    b0 = api("/v1/billing", tok=TOKEN)["credits"]; time.sleep(.3)
    f = api("/v1/realtime/sketch", {"image": PNG, "prompt": "FAIL please"}, tok=TOKEN); b1 = api("/v1/billing", tok=TOKEN)
    ok(f.get("_status") == 502 and b1["credits"] == b0 and any("Refund · live AI sketch" in l["reason"] for l in b1["ledger"]), f"failed frame refunded {f} {b0}→{b1['credits']}")
    ok(api("/v1/realtime/sketch", {"image": "http://evil.example/x.png"}, tok=TOKEN).get("_status") == 400, "frames must be inline pictures")
    # a custom realtime endpoint takes over when the admin connects one
    s = api("/v1/admin/providers/realtime", {"baseUrl": M + "/rt", "apiKey": "rt-key"}, "PUT"); time.sleep(.3)
    x = api("/v1/realtime/sketch", {"image": PNG, "prompt": "a falcon", "style": "anime", "target": "animal"})
    rt = stats()["rt"]; ok(s.get("ok") and x.get("image", "").startswith("data:image/png") and rt and rt[-1]["auth"] == "Bearer rt-key" and "anime" in rt[-1]["prompt"], f"custom realtime endpoint {x.get('_status')} {rt[-1:]}")
    ok(api("/v1/config").get("providers", {}).get("realtime") is True, "config says live AI is ready")
    out["api"] = {"frames": seq}

async def ui(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"; r = {}
    b = await p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]); ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); E = pg.evaluate
    async def wait_for(js, sec=30):
        for _ in range(sec * 4):
            if await E(js): return True
            await asyncio.sleep(.25)
        return False
    lang = "ar" if mob else "en"
    await E("()=>{window.__t=[];const t0=toast;toast=function(m,o){window.__t.push(String(m));return t0.apply(this,arguments)};S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;S.nd=null;go('voice');renderAll()}" % lang)
    ok(await wait_for("()=>!!document.querySelector('#ndlg')&&ND.info&&ND.info.voices.length===20", 15), f"{tag}: dialogue tool on the Voice page")
    r["first"] = await E("()=>{const v=document.querySelector('.view'),p=document.querySelector('#ndlg'),lede=v.querySelector('.lede');return lede&&lede.nextElementSibling===p}")
    ok(r["first"], f"{tag}: the dialogue tool comes right after the intro")
    script = "سارة: (بحماس) هل رأيت شروق الشمس؟\nعمر: كل يوم… (يضحك)\nوهكذا بدأت الحكاية." if mob else "Sara: (excited) Did you see the sunrise?\nOmar: Every single day… (laughs)\nAnd that was how it all began."
    await pg.click("#ndtext"); await pg.keyboard.insert_text(script); await pg.wait_for_timeout(600)
    r["spk"] = await E("()=>[...document.querySelectorAll('#ndspk .ndrow b')].map(b=>b.textContent)")
    ok(len(r["spk"]) == 3, f"{tag}: speakers from the script {r['spk']}")
    await E("()=>{const s=document.querySelector('#ndspk select');s.value=ND.info.voices.find(v=>v.name==='Matilda').id;s.dispatchEvent(new Event('change',{bubbles:true}))}")
    await pg.click("[data-act=nd-emo][data-v=warm]")
    r["parse"] = await E("()=>{const P=ndParse(S.nd.text,true);return [P.names,P.lines.map(l=>[l.speaker,l.emotion||'',l.text])]}")
    ok(r["parse"][1][0][1] == "excited" and "[" in r["parse"][1][1][2] and r["parse"][1][2][0] == 2, f"{tag}: feelings and stage directions parsed {r['parse']}")
    n0 = len(stats()["tts"])
    await pg.click("[data-act=nd-go]")
    ok(await wait_for("()=>S.jobs.some(j=>j.meta&&j.meta.natural)&&!ND.busy", 40), f"{tag}: dialogue made " + str(await E("()=>window.__t.slice(-2)")))
    tts = stats()["tts"][n0:]; r["tts"] = [t["voice"] for t in tts]
    ok(len(tts) == 3 and tts[0]["voice"] == "XrExE9yKIg1WjnnlVkGX" and tts[2]["voice"] != tts[0]["voice"] and tts[1]["voice"] not in (tts[0]["voice"], tts[2]["voice"]), f"{tag}: Matilda for Sara, other voices for the rest {r['tts']}")
    r["res"] = await E("()=>[document.querySelectorAll('.ndres audio').length,!!document.querySelector('[data-act=nd-ed]')]")
    ok(r["res"][0] >= 1 and r["res"][1], f"{tag}: result with a player {r['res']}")
    await E("()=>{PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.clips.push({id:uid(),src:{k:'demo',kind:'scene',seed:11},in:0,out:8,speed:1,trans:'cut',vol:100});go('voice');renderAll()}")
    await pg.wait_for_timeout(300); await pg.click("[data-act=nd-ed]")
    ok(await wait_for("()=>S.view==='edit'&&S.ed.sfx.length===1", 15), f"{tag}: dialogue in the editor " + str(await E("()=>[S.view,S.ed.sfx.length,window.__t.slice(-2)]")))
    # the editor's AI voice-over speaks naturally, at the playhead
    await E("()=>{ED.playing=false;ED.t=2;S.ed.tab='audio';renderView();edVoSheet()}"); await pg.wait_for_timeout(200)
    r["vosheet"] = await E("()=>[!!document.querySelector('#edvonat'),document.querySelector('#edvonat')&&document.querySelector('#edvonat').checked,document.querySelectorAll('[data-act=edvo-emo]').length]")
    ok(r["vosheet"] == [True, True, 9], f"{tag}: natural delivery in the voice-over sheet {r['vosheet']}")
    await E("()=>{document.querySelector('[data-act=edvo-pick][data-v=girl]').click();document.querySelector('[data-act=edvo-emo][data-v=excited]').click();document.querySelector('#edvot').value='%s'}" % ("أهلاً بكم في متجرنا الجديد" if mob else "Welcome to our new store"))
    n1 = len(stats()["tts"]); await pg.click("[data-act=edvo-go]")
    ok(await wait_for("()=>S.ed.sfx.length===2", 30), f"{tag}: natural voice-over placed " + str(await E("()=>[S.ed.sfx.length,window.__t.slice(-2)]")))
    r["vo"] = await E("()=>{const x=S.ed.sfx[S.ed.sfx.length-1];return [x.t,S.jobs.filter(j=>j.meta&&j.meta.natural).length]}")
    ok(abs(r["vo"][0] - 2) < .01 and r["vo"][1] == 2 and len(stats()["tts"]) == n1 + 1, f"{tag}: at the playhead, natural job {r['vo']}")
    # ---- the Sketch page (v91): only the drawing, what it is and one AI button — drawing never calls the paid live model and
    # never makes pictures by itself (the live-AI modes, camera, recording and keep-frame left the page); 4 versions in 4 looks
    await E("()=>{API.token=async()=>'%s';S.sketch.ai='live';S.sketch.prompt='a red car';S.sketch.n91=4;go('sketch');renderAll()}" % TOKEN); await pg.wait_for_timeout(600)
    ok(await E("()=>!document.querySelector('.lskbar,[data-act^=lsk-]')&&S.sketch.ai==='off'&&!!document.querySelector('[data-act=sk91-go]')"), f"{tag}: no live-AI controls; one AI button")
    rt0 = len(stats()["rt"]); n2 = await E("()=>S.jobs.length")
    for i in range(4):
        await E("i=>{SK.strokes=[{tool:'pen',color:'#111',size:6,pts:[[.2,.5,.6],[.5,.3+i*.05,.6],[.8,.5,.6]]}];skRedraw();SK.dirty=true}", i); await pg.wait_for_timeout(400)
    await pg.wait_for_timeout(1200)
    ok(len(stats()["rt"]) == rt0 and await E("()=>S.jobs.length") == n2, f"{tag}: drawing never calls the paid model or makes pictures")
    setbal(200); await E("async()=>{try{await syncServer()}catch(e){}}"); await pg.wait_for_timeout(300)
    await pg.click("[data-act=sk91-go]")
    ok(await wait_for("()=>S.jobs.filter(j=>j.meta&&j.meta.sk91).length===4", 15), f"{tag}: four versions sent " + str(await E("()=>window.__t.slice(-2)")))
    r["looks4"] = await E("()=>{const js=S.jobs.filter(j=>j.meta&&j.meta.sk91);return [new Set(js.map(j=>j.meta.style)).size,new Set(js.map(j=>j.batch)).size,SK.strokes.length]}")
    ok(r["looks4"] == [4, 1, 1], f"{tag}: four different looks of the same drawing, the drawing kept {r['looks4']}")
    r["overflow"] = await E("()=>[document.documentElement.scrollWidth,innerWidth]"); ok(r["overflow"][0] <= r["overflow"][1], f"{tag}: no sideways scroll {r['overflow']}")
    await E("()=>{go('voice');renderAll()}"); await pg.wait_for_timeout(300)
    r["vovf"] = await E("()=>[document.documentElement.scrollWidth,innerWidth]"); ok(r["vovf"][0] <= r["vovf"][1], f"{tag}: Voice page fits {r['vovf']}")
    ok(not errs, f"{tag}: page errors {errs}")
    await b.close(); return r

async def main():
    async with async_playwright() as p:
        for w in (1280, 390): out[w] = await ui(p, w)

if __name__ == "__main__":
    mk = subprocess.Popen(["node", D + "/mock.js", str(LPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "CAMB_", "NV_LOCALIZE", "WAN_", "KIE_", "FAL_", "REALTIME_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="a" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", MIRROR_MEDIA="false", FREE_PERIOD="false",
        LLM_API_KEY="mock", LLM_BASE_URL=M, LLM_MODEL="mock-text", ELEVENLABS_API_KEY="el-test", ELEVENLABS_BASE_URL=M + "/el", FAL_KEY="fal-test", FAL_BASE_URL=M + "/fal", REALTIME_FRAMES_PER_CREDIT="2"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        api_checks()
        asyncio.run(main())
    except Exception:
        import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
    finally:
        srv.terminate(); mk.terminate()
        try: err = srv.stderr.read().decode()[-1500:]
        except Exception: err = ""
    print(json.dumps({"fails": fails, "out": out, "serverLog": err if fails else ""}, ensure_ascii=False, default=str, indent=1))
    sys.exit(1 if fails else 0)
