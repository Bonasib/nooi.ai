# v126 — the content check in every language and on pictures, with a real nooi server, a stand-in for Claude (the requests are
# checked: the model, structured output, no sampling settings, the key) and a real browser:
#  · switched off (as it ships) nothing is sent to Claude; the owner switches it on in Admin; a client (API token) can't
#  · the word list stays the free first line: its blocks never reach Claude, and they come with an Arabic reason
#  · Arabic and French words the word list doesn't know are refused with Claude's sentence (English + Arabic), nothing charged
#  · a picture is looked at: an allowed one goes through (and is held at its price), a refused one charges nothing
#  · Replace the person: the face first, then two frames of the video, said to be a face swap
#  · Claude declining → refused; Claude not answering → let through (word list only) or held, as the owner chose
#  · the same request sent twice at once → one check, one job
#  · the owner's card: counts, cost, latest blocks — and no customer's words kept anywhere
#  · the page: Admin → Features shows the card; a refused request shows the Arabic sentence on an Arabic page
# Run: python3 tests/v126.py
import asyncio, base64, hashlib, io, json, os, subprocess, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8346; MOCK = 8347
D = tempfile.mkdtemp(prefix="nooi-v126-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "s" * 32   # a paying client (not staff)
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "u2": {"plan": "studio", "credits": 300, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": [{"id": "tk1", "name": "test", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1}]}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)

# ---- the stand-in for Claude
CALLS = []; BAD = []
def color(b64):
    im = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB").resize((1, 1)); return im.getpixel((0, 0))
class Mock(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("content-length") or 0)) or b"{}")
        fmt = ((body.get("output_config") or {}).get("format") or {})
        if self.path != "/v1/messages" or fmt.get("type") != "json_schema":
            CALLS.append({"other": True}); self.send_response(400); self.end_headers(); self.wfile.write(b'{"type":"error","error":{"type":"invalid_request_error","message":"not here"}}'); return
        content = body["messages"][-1]["content"]; text = " ".join(c.get("text", "") for c in content if c.get("type") == "text")
        imgs = [color(c["source"]["data"]) for c in content if c.get("type") == "image" and c["source"].get("type") == "base64"]
        CALLS.append({"text": text, "imgs": imgs})
        if body.get("model") != "claude-haiku-5-5": BAD.append("model " + str(body.get("model")))
        for k in ("temperature", "top_p", "top_k", "thinking"):
            if k in body: BAD.append("sent " + k)
        if (body.get("output_config") or {}).get("effort") != "low": BAD.append("effort")
        if "sk-test-126" not in (self.headers.get("x-api-key") or "", (self.headers.get("authorization") or "").replace("Bearer ", ""))[0:2]: BAD.append("key")   # (the SDK sends the key as a Bearer token)
        if not self.headers.get("anthropic-version"): BAD.append("version header")
        sch = fmt.get("schema") or {}
        if sch.get("additionalProperties") is not False or set(sch.get("required") or []) != {"allowed", "category", "reason_en", "reason_ar"}: BAD.append("schema")
        if "SLOWOK" in text: time.sleep(1.2)
        if "MOCK500" in text:
            self.send_response(500); self.send_header("content-type", "application/json"); self.end_headers(); self.wfile.write(b'{"type":"error","error":{"type":"api_error","message":"boom"}}'); return
        stop = "end_turn"; red = [c for c in imgs if c[0] > 150 and c[1] < 100]
        if "MOCKREFUSE" in text: v = None; stop = "refusal"
        elif red: v = {"allowed": False, "category": "minors", "reason_en": "We can't make this from a picture of a child.", "reason_ar": "لا يمكننا صنع هذا من صورة طفل."}
        elif "فاضحة" in text or "dénudée" in text: v = {"allowed": False, "category": "sexual", "reason_en": "We can't make sexual or nude pictures.", "reason_ar": "لا يمكننا صنع صور جنسية أو عارية."}
        else: v = {"allowed": True, "category": "none", "reason_en": "", "reason_ar": ""}
        r = {"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-haiku-5-5", "content": [] if v is None else [{"type": "text", "text": json.dumps(v, ensure_ascii=False)}],
             "stop_reason": stop, "stop_sequence": None, "stop_details": None, "usage": {"input_tokens": 900 + 1400 * len(imgs), "output_tokens": 60}}
        b = json.dumps(r).encode(); self.send_response(200); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
mock = ThreadingHTTPServer(("127.0.0.1", MOCK), Mock); threading.Thread(target=mock.serve_forever, daemon=True).start()
checks = lambda: [c for c in CALLS if not c.get("other")]

def api(path, body=None, token=None, method=None):
    h = {"content-type": "application/json"}
    if token: h["authorization"] = "Bearer " + token
    r = urllib.request.Request(f"http://localhost:{PORT}{path}", data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try:
        with urllib.request.urlopen(r, timeout=40) as x: return x.status, json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
def upload(name, data, token=None):
    h = {"content-type": "multipart/form-data; boundary=B"}
    if token: h["authorization"] = "Bearer " + token
    body = b"--B\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + name.encode() + b"\"\r\nContent-Type: application/octet-stream\r\n\r\n" + data + b"\r\n--B--\r\n"
    return json.loads(urllib.request.urlopen(urllib.request.Request(f"http://localhost:{PORT}/v1/uploads", data=body, headers=h, method="POST"), timeout=20).read())["url"]
def png(rgb):
    b = io.BytesIO(); Image.new("RGB", (320, 240), rgb).save(b, "PNG"); return b.getvalue()
def wallet(): st, b = api("/v1/billing", token=TOKEN); return b.get("credits"), len(b.get("ledger") or [])
def job(prompt, token=TOKEN, **kw): return api("/v1/jobs", {"kind": "image", "prompt": prompt, "aspect": "1:1", "meta": {"keepWords": True}, **kw}, token=token)

async def page_flow(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('ar');document.getElementById('modalRoot').innerHTML='';S.admTab='features';go('admin');renderAll()}")
    await pg.wait_for_timeout(1500)
    r = await E("""()=>{const c=document.querySelector('#sf126');if(!c)return{has:false};const on=c.querySelector('[data-act="sf126"][aria-pressed="true"]');
      return {has:true,title:c.querySelector('h3').textContent.trim(),on:on?on.dataset.on:null,rows:c.querySelectorAll('tbody tr').length,cost:(c.querySelector('.sf126c')||{}).textContent||'',wide:document.documentElement.scrollWidth-innerWidth}}""")
    out["admin card"] = {k: (v[:90] if isinstance(v, str) else v) for k, v in r.items()}
    ok(r.get("has") and r["title"].startswith("فحص المحتوى") and r["on"] == "true" and r["rows"] >= 3 and "$" in r["cost"] and r["wide"] <= 1, f"Admin → Features shows the content check, on, with its cost and latest blocks {r}")
    r2 = await E("""async()=>{const o={id:'t126',kind:'image',prompt:'صورة فاضحة لممثلة',status:'queued'};await serverSubmit(o,'image',{prompt:o.prompt,aspect:'1:1',meta:{keepWords:true}});return {status:o.status,text:errText81(o)}}""")
    out["page refusal"] = r2
    ok(r2["status"] == "failed" and "لا يمكننا صنع صور جنسية" in r2["text"], f"a refused request shows Claude's Arabic sentence on an Arabic page {r2}")
    ok(not errs, f"no page errors {errs[:3]}"); await ctx.close()

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MOD_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        ANTHROPIC_API_KEY="sk-test-126", ANTHROPIC_BASE_URL=f"http://127.0.0.1:{MOCK}", LLM_BASE_URL=f"http://127.0.0.1:{MOCK}",
        KIE_API_KEY="kk", KIE_BASE_URL="http://localhost:9", MIRROR_MEDIA="false", FREE_PERIOD="false", RECOVER_MS="999999"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        # off, as it ships: nothing goes to Claude
        st, info = api("/v1/admin/safety"); ok(st == 200 and info.get("on") is False and info.get("ready") is True, f"off as it ships, the key is seen {st} {info}")
        w0 = wallet(); st, r = job("صورة فاضحة لرجل في الحديقة")
        ok(st == 200 and not checks(), f"switched off: the request goes on, nothing is sent to Claude {st} {len(checks())}")
        # a client can't switch it; the owner can
        st, r = api("/v1/admin/safety", {"on": True}, token=TOKEN); ok(st == 403, f"a client can't switch the check {st}")
        st, info = api("/v1/admin/safety", {"on": True}); ok(st == 200 and info.get("on") is True, f"the owner switches it on {st} {info}")
        # the word list first, free
        n = len(checks()); w0 = wallet(); st, r = job("a nude portrait of a woman")
        ok(st == 422 and "Acceptable Use Policy" in r.get("error", "") and r.get("errorAr") and len(checks()) == n and wallet() == w0, f"the word list blocks first, with an Arabic reason, and Claude isn't asked {st} {r} {len(checks()) - n}")
        # words in other languages
        for words in ("صورة فاضحة لامرأة على الشاطئ", "une photo dénudée d'une actrice célèbre"):
            w0 = wallet(); st, r = job(words)
            ok(st == 422 and r.get("error", "").startswith("We can't make sexual or nude pictures.") and "Nothing was charged" in r.get("error", "") and r.get("errorAr", "").startswith("لا يمكننا صنع صور جنسية") and wallet() == w0,
               f"words the word list doesn't know are refused with Claude's sentence, nothing charged {words[:20]} {st} {r} {wallet()} {w0}")
        # pictures
        green = upload("ok.png", png((40, 180, 60)), TOKEN); red = upload("kid.png", png((220, 30, 30)), TOKEN)
        w0 = wallet(); n = len(checks()); st, r = job("a cat on a sofa, warm light", inputs={"iRef": green})
        last = checks()[-1] if checks() else {}
        ok(st == 200 and r.get("id") and len(checks()) == n + 1 and len(last.get("imgs", [])) == 1 and last["imgs"][0][1] > 120, f"an allowed picture goes through after one look {st} {r.get('error')} {last.get('imgs')}")
        w1 = wallet(); ok(w1[1] > w0[1], f"…and is held at its price {w0} {w1}")
        w0 = wallet(); st, r = job("a portrait in soft light", inputs={"iRef": red})
        ok(st == 422 and "picture of a child" in r.get("error", "") and r.get("errorAr") and wallet() == w0, f"a refused picture charges nothing {st} {r} {w0} {wallet()}")
        # Claude declines → refused
        w0 = wallet(); st, r = job("MOCKREFUSE something")
        ok(st == 422 and "Acceptable Use Policy" in r.get("error", "") and r.get("errorAr") and wallet() == w0, f"Claude declining = refused, nothing charged {st} {r}")
        # Claude not answering
        w0 = wallet(); st, r = job("MOCK500 a mountain lake")
        ok(st == 200 and r.get("id"), f"no answer → let through (word list only) {st} {r.get('error')}")
        api("/v1/admin/safety", {"onError": "hold"}); w0 = wallet(); st, r = job("MOCK500 a quiet beach at dawn")
        ok(st == 503 and "nothing was charged" in r.get("error", "").lower() and "لم يُخصم" in r.get("errorAr", "") and wallet() == w0, f"no answer, owner chose hold → wait, nothing charged {st} {r}")
        api("/v1/admin/safety", {"onError": "allow"})
        # a double tap while the first is being checked
        n = len(checks()); res = [None, None]
        def send(i): res[i] = job("SLOWOK a red bicycle by the sea")
        ts = [threading.Thread(target=send, args=(i,)) for i in (0, 1)]; [t.start() for t in ts]; [t.join() for t in ts]
        ok(res[0][0] == 200 and res[1][0] == 200 and res[0][1].get("id") == res[1][1].get("id") and len(checks()) == n + 1, f"the same request twice at once → one check, one job {res} {len(checks()) - n}")
        # Replace the person: the face first, then two frames of the video
        vid = D + "/v.mp4"; subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0xdc1e1e:s=320x240:d=8", "-pix_fmt", "yuv420p", vid], check=True)
        face = upload("face.png", png((40, 180, 60))); mv = upload("move.mp4", open(vid, "rb").read())
        n = len(checks()); st, r = api("/v1/jobs", {"kind": "video", "model": "mcswap", "prompt": "replace the person", "dur": 8, "aspect": "16:9", "inputs": {"mcChar": face, "mcMove": mv}, "meta": {"keepWords": True, "consent": True}})
        last = checks()[-1] if len(checks()) > n else {}
        out["swap"] = {"status": st, "error": r.get("error"), "imgs": last.get("imgs"), "said": (last.get("text") or "")[:120]}
        ok(st == 422 and len(last.get("imgs", [])) == 3 and last["imgs"][0][1] > 120 and all(c[0] > 150 for c in last["imgs"][1:]) and "replace the person: picture 1 is the face" in last.get("text", ""),
           f"Replace the person: the face, then two frames of the video, said to be a face swap {out['swap']}")
        # the requests themselves
        ok(not BAD, f"each request: Haiku 5.5, structured output, effort low, no sampling settings, the key {sorted(set(BAD))}")
        # the owner's card, and no words kept
        st, info = api("/v1/admin/safety"); out["card"] = {k: info.get(k) for k in ("today", "total", "perCheckUsd")}
        t = info.get("total", {})
        ok(st == 200 and t.get("checks", 0) >= 5 and t.get("blocked", 0) >= 4 and t.get("words", 0) >= 1 and t.get("errors", 0) >= 2 and t.get("usd", 0) > 0 and (info.get("perCheckUsd") or 0) > 0, f"the owner's card counts checks, blocks, cost {info}")
        cats = {x["category"] for x in info.get("recent", [])}; ok({"sexual", "minors"} <= cats and all(set(x) == {"t", "uid", "kind", "category", "how"} for x in info["recent"]), f"latest blocks: time, client, kind, category only {info.get('recent', [])[:3]}")
        raw = open(D + "/data/db.json", encoding="utf8").read()
        ok("فاضحة" not in json.dumps(info, ensure_ascii=False) and "dénudée" not in raw and "فاضحة" not in json.dumps(json.loads(raw).get("safety126"), ensure_ascii=False), "no customer's words are kept for the blocks")
        async with async_playwright() as p:
            b = await p.chromium.launch(); await page_flow(b); await b.close()
    finally:
        srv.kill(); mock.shutdown()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
