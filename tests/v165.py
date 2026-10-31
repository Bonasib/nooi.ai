# v165 "The permanent eyes are permanent and strange — an engine that works with the lip engine, so the facial expressions are
# realistic, with realistic voice acting like ElevenLabs, in harmony with the whole site."
# Before: a talking avatar from a photo went to the face engine with an empty direction (or the voice file's name) and a flat
# voice. Now the performance engine (lib/face165.js) reads the words line by line. A real nooi server, a stand-in AI engine
# (it records what each engine is sent and really makes the voices and the videos) and a stand-in text AI (the acting director):
#  · the face engine is told to blink, move the eyes (never a fixed stare) and show each line's feeling at its time — read by
#    the text AI, else from the words themselves (English and Arabic)
#  · the voice acts the same lines: ElevenLabs v3 on the engine with audio tags where a feeling is clear; refused → the same
#    voice on Multilingual v2 with the plan's delivery, and v3 isn't asked again for a while
#  · a voice file: no voice is made, the face still gets the living direction (never the file's name)
#  · the face engine fails → the next one (InfiniteTalk, a short direction) with the same voice — not made twice
#  · a face video (lips only) gets the acted voice; every talking video's prompt asks for living eyes
#  · the page: an "Acting" chip in the Home avatar box and the Voice page's lip-sync panel; the choice rides with the job
# Run: python3 tests/v165.py
import asyncio, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8493, 8494; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v165-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/eng"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "f" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "uploads": ["face.png", "voice.mp3", "face.mp4"],
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 10000000}]}}}, open(D + "/data/db.json", "w"))
ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120)
ff("-f", "lavfi", "-i", "color=c=0xc89070:s=512x512", "-frames:v", "1", D + "/media/face.png")
ff("-f", "lavfi", "-i", "sine=frequency=200:duration=3", D + "/media/voice.mp3")
ff("-f", "lavfi", "-i", "testsrc2=size=480x270:rate=24:duration=3", "-f", "lavfi", "-i", "sine=frequency=220:duration=3", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", D + "/media/face.mp4")
MOCK = r'''
import json, sys, re, urllib.parse, urllib.request, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": 0, "bad": [], "mode": {}}; LOCK = threading.Lock(); EXT = {}
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
def fetch(u, out): open(out, "wb").write(urllib.request.urlopen(u, timeout=30).read()); return out
def make(tid, model, inp):
    out = DIR + "/" + tid
    if model.startswith("elevenlabs/"):   # a voice as long as its words
        t = (inp.get("dialogue") or [{}])[0].get("text") if inp.get("dialogue") else inp.get("text"); d = max(1.0, len(str(t or "")) * 0.05)
        FF("-f", "lavfi", "-i", f"sine=frequency=190:duration={d:.2f}", "-af", "tremolo=f=5:d=0.7", out + ".mp3"); return ".mp3"
    if model.startswith(("kling/ai-avatar", "infinitalk/")):   # the face, talking for as long as the voice
        if model.startswith("kling/") and st["mode"].get("failAvatar"): raise Exception("face engine down")
        i = fetch(inp["image_url"], out + "-in.png"); a = fetch(inp["audio_url"], out + "-in.mp3")
        FF("-loop", "1", "-i", i, "-i", a, "-shortest", "-vf", "scale=256:256,format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", out + ".mp4"); return ".mp4"
    if model.startswith("volcengine/"):
        v = fetch(inp["video_url"], out + "-in.mp4"); a = fetch(inp["audio_url"], out + "-in.mp3")
        FF("-i", v, "-i", a, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-shortest", out + ".mp4"); return ".mp4"
    raise Exception("unknown model " + model)
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/stats": return self.send(st)
        if u.path.startswith("/f/"):
            b = open(DIR + "/" + u.path[3:], "rb").read(); self.send_response(200); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        tid = (q.get("taskId") or [""])[0]
        if tid in st["bad"]: return self.send({"code": 200, "data": {"state": "fail", "failMsg": "engine error"}})
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/f/{tid}{EXT.get(tid, '.mp4')}"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path == "/mode": st["mode"].update(j); return self.send({"ok": True})
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 500})
        if u.path == "/v1/messages":   # the text AI: the acting director (only for the lines it knows), nothing for anything else
            c = (j.get("messages") or [{}])[0].get("content"); text = c if isinstance(c, str) else " ".join(x.get("text", "") for x in c if isinstance(x, dict))
            if "acting director" in text and "We built this" in text:
                st["llm"] += 1; m = re.search(r"LINES: (\[.*?\])\n", text, re.S); lines = json.loads(m.group(1)) if m else []
                feel = [("warm", False), ("serious", False), ("funny", True)]
                return self.send({"content": [{"type": "text", "text": json.dumps({"lines": [{"i": x["i"], "emotion": feel[k % 3][0], "cue": feel[k % 3][1]} for k, x in enumerate(lines)]})}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        with LOCK: tid = "t%d" % (len(st["reqs"]) + 1); st["reqs"].append({"path": u.path, "body": j, "tid": tid})
        model = j.get("model", "")
        if model == "elevenlabs/text-to-dialogue-v3" and st["mode"].get("refuseV3"): return self.send({"code": 422, "msg": "model not supported"})
        try: EXT[tid] = make(tid, model, j.get("input") or {})
        except Exception: st["bad"].append(tid); EXT[tid] = ".mp4"
        return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, port=PORT, tok=TOKEN):
    req = urllib.request.Request(f"http://localhost:{port}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
      headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
stats = lambda: api("/stats", port=KPORT, tok=None)
mode = lambda **k: api("/mode", k, port=KPORT, tok=None)
def wait(fn, sec=60):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
done = lambda jid: wait(lambda: (lambda j: j if j.get("status") in ("done", "failed") else None)(api("/v1/jobs/" + jid)), 180) or {}
def avatar(prompt, **inp):
    n = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "lipsync", "prompt": prompt, "inputs": {"lsV": "/media/face.png", **inp}, "meta": {}})
    d = done(j.get("id", "")); reqs = stats()["reqs"][n:]
    return j, d, reqs
models = lambda reqs: [r["body"].get("model") for r in reqs]
face_of = lambda reqs, m="kling/ai-avatar-standard": next(((r["body"].get("input") or {}) for r in reqs if r["body"].get("model") == m), {})
LIVE = "never a frozen, fixed stare"

def server_checks():
    # 1. words with clear feelings (the text AI says nothing about them → read from the words): the face is directed, the voice acts
    j, d, reqs = avatar("Hi everyone, welcome back! Did you know most people never try this? Haha, I did not either. Unfortunately, it ended badly… But here is the secret: start small.")
    v3 = next(((r["body"].get("input") or {}) for r in reqs if r["body"].get("model") == "elevenlabs/text-to-dialogue-v3"), {}); f = face_of(reqs)
    out["rules"] = {"status": d.get("status"), "error": d.get("error"), "models": models(reqs), "voice": v3, "face": f.get("prompt", "")[-700:], "sent": (d.get("sent") or {}).get("prompt", "")[:120]}
    ok(d.get("status") == "done", f"the avatar is made {out['rules']['status']} {out['rules']['error']}")
    t = (v3.get("dialogue") or [{}])[0].get("text", "")
    ok("[curious] Did you know" in t and "[laughs] Haha" in t and "[sighs] Unfortunately" in t and v3.get("stability") == 0.5 and re.match(r"^[A-Za-z0-9]{18,}$", str((v3.get("dialogue") or [{}])[0].get("voice", ""))), f"the voice acts it: v3 with audio tags on the feeling lines, the avatar's voice id {v3}")
    p = f.get("prompt", "")
    ok(LIVE in p and "blinks every 2–5 seconds" in p and re.search(r"1\) 0–[\d.]+ s, warm: .*2\) [\d.]+–[\d.]+ s, curious: .*3\) .*funny: .*4\) .*sad: .*5\) .*whisper:", p), f"the face: living eyes, then each line's feeling at its time {p[-600:]}")
    ok(f.get("audio_url", "").endswith(".mp3") and f.get("image_url"), f"the face engine gets the acted voice and the photo {f}")
    ok(LIVE in out["rules"]["sent"] or "fully alive" in out["rules"]["sent"], f"'What the AI receives' shows the direction {out['rules']['sent']}")
    # 2. the text AI as acting director (lines whose words show no feeling): its feelings on the face and the tag in the voice
    n0 = stats()["llm"]; j, d, reqs = avatar("We built this for you. It took two years. Nobody believed us.")
    v3 = next(((r["body"].get("input") or {}) for r in reqs if r["body"].get("model") == "elevenlabs/text-to-dialogue-v3"), {}); p = face_of(reqs).get("prompt", "")
    out["ai"] = {"llm": stats()["llm"] - n0, "voice": (v3.get("dialogue") or [{}])[0].get("text"), "face": p[-400:]}
    ok(stats()["llm"] > n0 and re.search(r"1\) .*warm: .*2\) .*serious: .*3\) .*funny:", p) and out["ai"]["voice"] == "We built this for you. It took two years. [laughs] Nobody believed us.", f"the acting director's feelings reach the face and the voice {out['ai']}")
    # 3. a voice file: no voice is made, the face is still alive (never the file's name)
    j, d, reqs = avatar("voice.mp3", lsA="/media/voice.mp3"); f = face_of(reqs)
    out["file"] = {"models": models(reqs), "prompt": f.get("prompt", "")[-260:], "status": d.get("status")}
    ok(models(reqs) == ["kling/ai-avatar-standard"] and LIVE in f.get("prompt", "") and "voice.mp3" not in f.get("prompt", "") and "follow the feeling of the voice" in f.get("prompt", "") and d.get("status") == "done", f"a voice file: the living face, no voice made {out['file']}")
    # 4. the face engine fails → InfiniteTalk with a short direction and the same voice (made once)
    mode(failAvatar=True); j, d, reqs = avatar("Good morning! Today we open the new shop. Thank you for waiting.")
    mode(failAvatar=False); ms = models(reqs); f2 = face_of(reqs, "infinitalk/from-audio"); f1 = face_of(reqs)
    out["fallback"] = {"models": ms, "status": d.get("status"), "short": f2.get("prompt", ""), "same": f1.get("audio_url") == f2.get("audio_url")}
    ok(ms.count("elevenlabs/text-to-dialogue-v3") == 1 and "infinitalk/from-audio" in ms and out["fallback"]["same"] and d.get("status") == "done", f"the next face engine, the same voice (made once) {out['fallback']}")
    ok("never a fixed stare" in f2.get("prompt", "") and "Expressions in order: warm smile" in f2.get("prompt", "") and len(f2.get("prompt", "")) < 700, f"InfiniteTalk's short direction {f2.get('prompt')}")
    # 5. a face video (lips only): the acted voice, the video's own eyes (no direction sent)
    n = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "lipsync", "prompt": "Wow, this is amazing! Can you believe it?", "inputs": {"lsV": "/media/face.mp4"}, "meta": {}}); d = done(j.get("id", "")); reqs = stats()["reqs"][n:]
    volc = face_of(reqs, "volcengine/video-to-video-lip-sync"); out["video"] = {"models": models(reqs), "volc": volc, "status": d.get("status")}
    ok(models(reqs)[0] == "elevenlabs/text-to-dialogue-v3" and volc.get("mode") == "basic" and "prompt" not in volc and d.get("status") == "done", f"a face video: the acted voice, lips only {out['video']}")
    # 6. v3 refused by the engine → the same voice on Multilingual v2 (the words without tags, the plan's delivery); not asked again
    mode(refuseV3=True); j, d, reqs = avatar("Hello friends! We are so happy to see you.")
    v2 = next(((r["body"].get("input") or {}) for r in reqs if r["body"].get("model") == "elevenlabs/text-to-speech-multilingual-v2"), {})
    out["refused"] = {"models": models(reqs), "v2": v2, "status": d.get("status")}
    ok(models(reqs)[:3] == ["elevenlabs/text-to-dialogue-v3", "elevenlabs/text-to-speech-multilingual-v2", "kling/ai-avatar-standard"] and v2.get("text") == "Hello friends! We are so happy to see you." and v2.get("stability") == 0.46 and d.get("status") == "done",
       f"v3 refused → v2 with the warm delivery, no tags {out['refused']}")
    j, d, reqs = avatar("See you tomorrow, same place.")
    ok("elevenlabs/text-to-dialogue-v3" not in models(reqs) and d.get("status") == "done", f"…and v3 isn't asked again for a while {models(reqs)}")
    mode(refuseV3=False)
    # 7. Arabic, read from the words; every talking video asks for living eyes
    js = subprocess.run(["node", "--input-type=module", "-e", """import { plan165 } from './lib/face165.js'; import { withSpeech } from './lib/speech160.js';
      const p=await plan165('مرحباً بكم جميعاً! هل تعلم أن معظم الناس لا يجربون هذا؟ ههههه وأنا كذلك. للأسف انتهى الأمر بشكل سيئ… لكن السر بيني وبينك: ابدأ صغيراً.',{ai:false});
      console.log(JSON.stringify({emo:p.beats.map(b=>b.emo),voice:p.voiceText,dur:p.dur,talk:withSpeech('A man smiles and says: "أهلاً بكم في متجرنا"','')}))"""], cwd=ROOT, capture_output=True, text=True, timeout=30)
    try: o = json.loads(js.stdout)
    except Exception: o = {}; fails.append("pure: " + js.stderr[-300:])
    out["arabic"] = o
    ok(o.get("emo") == ["warm", "curious", "funny", "sad", "whisper"] and "[curious] هل تعلم" in o.get("voice", "") and "[laughs] ههههه" in o.get("voice", "") and 10 < o.get("dur", 0) < 16, f"Arabic: each line's feeling from its words {o}")
    ok("natural blinking and living eyes (never a fixed stare)" in o.get("talk", "") and "Arabic" in o.get("talk", ""), f"a talking video asks for living eyes {o.get('talk')}")

async def page_checks():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        async def page(vw=1280, vh=900, lang="en"):
            pg = await (await b.new_context(viewport={"width": vw, "height": vh})).new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
            await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
            await pg.evaluate("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false}", lang); return pg
        pg = await page()
        r = await pg.evaluate("""async()=>{const R={};S.view='home';S.hf.tab='avatar';S.hf.act165='auto';renderView();await new Promise(r=>setTimeout(r,500));
          const chip=document.querySelector('.hfbox [data-act="act165h"]');R.chip=chip&&chip.innerText.trim();chip.click();await new Promise(r=>setTimeout(r,300));
          R.tiles=[...document.querySelectorAll('.hfsheet .act165 .tile')].map(x=>x.dataset.v);R.note=/Living face: natural blinks/.test((document.querySelector('.hfsheet')||{}).innerText||'');
          document.querySelector('.hfsheet [data-v="funny"]').click();await new Promise(r=>setTimeout(r,300));R.after=[S.hf.act165,document.querySelector('[data-act="act165h"]').innerText.trim(),!!document.querySelector('.hfsheet')];
          const ad=addJob,sp=spend;let got=null;spend=()=>false;addJob=function(j){const r=ad.apply(this,arguments);got=j.meta||{};return r};
          try{addJob({kind:'lipsync',prompt:'Hello there',cost:12});R.meta=got;got=null;addJob({kind:'lipsync',prompt:'Hi',cost:12,meta:{tone:'calm'}});R.kept=got;S.hf.act165='auto';got=null;addJob({kind:'lipsync',prompt:'Hi',cost:12});R.auto=got}finally{addJob=ad;spend=sp}
          S.hf.act165='sad';S.view='voice';renderView();await new Promise(r=>setTimeout(r,500));const t=document.querySelector('.act165');R.voice=t?[...t.querySelectorAll('.tile')].filter(x=>x.getAttribute('aria-checked')==='true').map(x=>x.dataset.v):null;
          t.querySelector('[data-v="whisper"]').click();await new Promise(r=>setTimeout(r,300));R.voice2=S.hf.act165;S.hf.act165='auto';return R}""")
        out["page"] = r
        ok(r["chip"] == "Acting" and r["tiles"] == ["auto", "warm", "excited", "serious", "calm", "funny", "sad", "whisper"] and r["note"], f"the Home avatar box: an Acting chip and its sheet {r}")
        ok(r["after"] == ["funny", "Funny", False], f"a pick closes the sheet and the chip says it {r['after']}")
        ok((r["meta"] or {}).get("tone") == "funny" and (r["kept"] or {}).get("tone") == "calm" and not (r["auto"] or {}).get("tone"), f"the choice rides with the job (a tone already set stays; Auto sends none) {r}")
        ok(r["voice"] == ["sad"] and r["voice2"] == "whisper", f"the Voice page's lip-sync panel has the same choice {r['voice']} {r['voice2']}")
        pg2 = await page(390, 844, "ar")
        r = await pg2.evaluate("""async()=>{S.view='home';S.hf.tab='avatar';renderView();await new Promise(r=>setTimeout(r,400));document.querySelector('[data-act="act165h"]').click();await new Promise(r=>setTimeout(r,300));
          const s=document.querySelector('.hfsheet');const tiles=[...s.querySelectorAll('.tile')].map(x=>x.getBoundingClientRect());return {h:(s.querySelector('h2')||{}).textContent,n:tiles.length,inside:tiles.every(t=>t.left>=0&&t.right<=innerWidth+1),overflow:document.documentElement.scrollWidth>innerWidth+1}}""")
        ok(r["h"] == "الأداء" and r["n"] == 8 and r["inside"] and not r["overflow"], f"phone, Arabic: the sheet fits {r}")
        ok(not errs, f"page errors {errs}")
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
mock = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D + "/eng"], stdout=subprocess.DEVNULL, stderr=open(D + "/mock.log", "w"))
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", MIRROR_MEDIA="true",
  KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", FREE_PERIOD="false", AI_LABEL="false"),
  stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    ok(wait(lambda: api("/v1/config"), 40), "server up"); ok(wait(lambda: stats(), 20), "engine stand-in up")
    server_checks(); asyncio.run(page_checks())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-1500:])
finally:
    srv.kill(); mock.kill()
    log = open(D + "/server.log").read()[-2000:]; shutil.rmtree(D, ignore_errors=True)
print(json.dumps(out, ensure_ascii=False, indent=1)[:7000])
if fails:
    print("server log:", log); print("FAILED:"); [print(" ✗", f) for f in fails]; sys.exit(1)
print("v165 ok")
