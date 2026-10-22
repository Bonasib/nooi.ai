# v127 — what the AI makes says so, with a real nooi server, a stand-in for the AI engine serving real pictures and videos, the
# official C2PA reader (c2pa-rs as WebAssembly) and a real browser:
#  · a picture made from words carries content credentials: "created", trainedAlgorithmicMedia, by nooi.ai — valid for nooi's
#    reader and for the official one (only "unknown signer", nooi's own certificate); no visible mark unless asked
#  · a picture made from the customer's picture: compositeWithTrainedAlgorithmicMedia (JPEG); a video: MP4 credentials, still plays
#  · the customer switches the "Made with AI" mark on: it is in the corner of the next picture, under the credentials
#  · Replace the person: the mark is always there (the customer's switch off), and the credentials say composite
#  · an editor export (MP4) carries credentials too
#  · the owner: switch credentials off (the next picture has none) and on; add their own certificate (a bad one is refused, in
#    Arabic too); back to nooi's own
#  · the page: Account → Preferences shows the AI label switch; Admin → Features shows the AI labels card
# Run: python3 tests/v127.py
import asyncio, io, json, os, subprocess, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8348; KPORT = 8349; KEY = "kie_v127"
D = tempfile.mkdtemp(prefix="nooi-v127-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
BLUE = (40, 90, 200)
F = D + "/fix"; os.makedirs(F)
Image.new("RGB", (640, 480), BLUE).save(F + "/out.png"); Image.new("RGB", (640, 480), (200, 120, 40)).save(F + "/out.jpg", quality=92)
ff = lambda *a: subprocess.run(["ffmpeg", "-y", "-v", "error", *a], check=True)
ff("-f", "lavfi", "-i", "color=c=0x30c040:s=640x360:d=4:r=25", "-f", "lavfi", "-i", "sine=f=440:d=4", "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", F + "/out.mp4")
ff("-f", "lavfi", "-i", "color=c=0xd04040:s=480x640:d=6:r=25", "-f", "lavfi", "-i", "sine=f=330:d=6", "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", F + "/move.mp4")
ff("-f", "lavfi", "-i", "color=c=0x2060a0:s=640x360:d=2:r=25", "-c:v", "libvpx", "-b:v", "1M", F + "/rec.webm")
Image.new("RGB", (512, 640), (180, 150, 120)).save(F + "/face.png")

# ---- the stand-in for the AI engine
tasks = {}; n = [0]
class Kie(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, d): b = json.dumps({"code": 200, "msg": "success", "data": d}).encode(); self.send_response(200); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path.startswith("/files/"):
            f = F + "/" + os.path.basename(u.path); b = open(f, "rb").read(); self.send_response(200); self.send_header("content-type", {"png": "image/png", "jpg": "image/jpeg"}.get(f.rsplit(".", 1)[-1], "video/mp4")); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b); return
        if u.path == "/api/v1/chat/credit": return self.send(777)
        t = tasks.get((q.get("taskId") or [""])[0])
        if not t: return self.send(None)
        t["polls"] += 1
        if t["polls"] < 2: return self.send({"state": "generating"})
        body = t["body"] or {}; model = str(body.get("model", "")); prompt = json.dumps(body.get("input", {}))
        f = "out.jpg" if "JPEG" in prompt else "out.png" if not any(k in model for k in ("video", "seedance", "kling", "wan/", "swap", "omni", "motion")) else "out.mp4"
        self.send({"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://127.0.0.1:{KPORT}/files/{f}"]})})
    def do_POST(self):
        b = self.rfile.read(int(self.headers.get("content-length") or 0)); body = json.loads(b or b"{}")
        if self.headers.get("authorization") != "Bearer " + KEY: return self.send(None)
        n[0] += 1; tid = "t%d" % n[0]; tasks[tid] = {"body": body, "polls": 0}; self.send({"taskId": tid})
import urllib.parse
kie = ThreadingHTTPServer(("127.0.0.1", KPORT), Kie); threading.Thread(target=kie.serve_forever, daemon=True).start()

def api(path, body=None, method=None, raw=None, ctype=None):
    h = {"content-type": ctype or "application/json"}
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r = urllib.request.Request(f"http://localhost:{PORT}{path}", data=data, headers=h, method=method or ("POST" if data is not None else "GET"))
    try:
        with urllib.request.urlopen(r, timeout=120) as x: return x.status, json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
def upload(path):
    name = os.path.basename(path); body = b"--B\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + name.encode() + b"\"\r\nContent-Type: application/octet-stream\r\n\r\n" + open(path, "rb").read() + b"\r\n--B--\r\n"
    return json.loads(urllib.request.urlopen(urllib.request.Request(f"http://localhost:{PORT}/v1/uploads", data=body, headers={"content-type": "multipart/form-data; boundary=B"}, method="POST"), timeout=30).read())["url"]
def run_job(body, wait=120):
    st, r = api("/v1/jobs", body)
    if st != 200: return {"status": "refused", "error": r.get("error"), "code": st}
    t0 = time.time()
    while time.time() - t0 < wait:
        st, j = api("/v1/jobs/" + r["id"])
        if j.get("status") in ("done", "failed"): return j
        time.sleep(1)
    return j
def local(url): return D + "/media/" + url.split("/media/")[-1].split("?")[0]
def read(*files):
    p = subprocess.run(["node", ROOT + "/tests/c2pa_read.mjs", *files], cwd=D, env=dict(os.environ, SECRET_KEY="v" * 40), capture_output=True, text=True, timeout=120)
    return [json.loads(l) for l in p.stdout.splitlines() if l.startswith("{")] or [{"err": p.stderr[-400:]}]
def creds_ok(r, src):
    no, of = r.get("nooi") or {}, r.get("official") or {}
    acts = (no.get("actions") or []); oacts = of.get("actions") or []
    return (no.get("valid") is True and no.get("generator") == "nooi.ai" and any(a.get("action") == "c2pa.created" and a.get("digitalSourceType", "").endswith("/" + src) for a in acts)
            and of.get("state") == "Valid" and set(of.get("failures") or []) <= {"signingCredential.untrusted"} and any(a.get("digitalSourceType", "").endswith("/" + src) for a in oacts))
def corner(png_path):
    im = Image.open(png_path).convert("RGB"); w, h = im.size; bw = max(110, round(min(w, h * 1.4) * 0.2 / 2) * 2); bh = round(bw * 230 / 760); pad = max(8, round(min(w, h) * 0.025))
    x = w - pad - bw + max(2, round(bw * 0.04)); y = h - pad - bh // 2
    return im.getpixel((x, y)), im.getpixel((w // 3, h // 3))
def frame(video, at=1.0):
    p = video + ".f.png"; ff("-ss", str(at), "-i", video, "-frames:v", "1", p); return p
dark = lambda c, base: sum(c) < sum(base) * 0.6

async def page_flow(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('ar');document.getElementById('modalRoot').innerHTML='';go('account');renderAll()}")
    await pg.wait_for_timeout(1500)
    r = await E("""async()=>{const p=document.querySelector('#aim127');if(!p)return{has:false};const sw=p.querySelector('[data-act="aim127"]');
      const bar=[...document.querySelectorAll('.secbar122 button')].map(b=>b.textContent.trim());return {has:true,title:p.querySelector('h2').textContent.trim(),on:sw&&sw.getAttribute('aria-checked'),img:(await fetch(p.querySelector('img').src)).status,bar,wide:document.documentElement.scrollWidth-innerWidth}}""")
    out["account"] = r
    ok(r.get("has") and r["title"] == "علامة الذكاء الاصطناعي" and r["on"] == "false" and r["img"] == 200 and r["wide"] <= 1, f"Account → Preferences shows the AI label switch (off), with the mark's picture {r}")
    await E("()=>document.querySelector('[data-act=\"aim127\"]').click()"); await pg.wait_for_timeout(1200)
    st, m = api("/v1/me/aimark"); ok(m.get("on") is True, f"the switch turns the mark on, on the server {m}")
    api("/v1/me/aimark", {"on": False})
    await E("()=>{S.admTab='features';go('admin');renderAll()}"); await pg.wait_for_timeout(1500)
    r2 = await E("""()=>{const c=document.querySelector('#lb127');if(!c)return{has:false};const on=c.querySelector('[data-act="lb127"][aria-pressed="true"]');return {has:true,title:c.querySelector('h3').textContent.trim(),on:on?on.dataset.on:null,signer:(c.querySelector('.lb127s')||{}).textContent||''}}""")
    out["admin"] = r2
    ok(r2.get("has") and r2["title"] == "علامات الذكاء الاصطناعي" and r2["on"] == "true" and "nooi" in r2["signer"], f"Admin → Features shows the AI labels card {r2}")
    ok(not errs, f"no page errors {errs[:3]}"); await ctx.close()

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "C2PA"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY=KEY, KIE_BASE_URL=f"http://127.0.0.1:{KPORT}", FREE_PERIOD="false", RECOVER_MS="999999"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        # a picture from words
        j = run_job({"kind": "image", "model": "nano", "prompt": "a red apple on a table", "aspect": "1:1"})
        ok(j.get("status") == "done", f"a picture is made {j.get('status')} {j.get('error')}")
        if j.get("status") == "done":
            f1 = local(j["url"]); r = read(f1)[0]; out["picture"] = r
            ok(creds_ok(r, "trainedAlgorithmicMedia"), f"a picture from words carries valid credentials: created by AI, nooi.ai (official reader too) {r}")
            c, base = corner(f1); ok(c == BLUE or not dark(c, BLUE), f"no visible mark unless asked {c}")
        # from the customer's picture (JPEG)
        ref = upload(F + "/face.png")
        j = run_job({"kind": "image", "model": "flux", "prompt": "make it warmer JPEG", "aspect": "1:1", "inputs": {"iRef": ref}})
        if j.get("status") == "done":
            r = read(local(j["url"]))[0]; out["from a picture"] = r
            ok(j["url"].endswith(".jpg") and creds_ok(r, "compositeWithTrainedAlgorithmicMedia"), f"a picture from the customer's picture: composite with AI (JPEG) {j['url'][-12:]} {r}")
        else: ok(False, f"a picture from a picture is made {j}")
        # a video
        j = run_job({"kind": "video", "model": "seedance20", "prompt": "a boat at sea", "dur": 5, "aspect": "16:9"})
        if j.get("status") == "done":
            fv = local(j["url"]); r = read(fv)[0]; out["video"] = r
            d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", fv], capture_output=True, text=True).stdout.strip()
            ok(creds_ok(r, "trainedAlgorithmicMedia") and abs(float(d or 0) - 4) < 0.3, f"a video carries valid MP4 credentials and still plays ({d} s) {r}")
        else: ok(False, f"a video is made {j}")
        # the customer's own mark
        api("/v1/me/aimark", {"on": True})
        j = run_job({"kind": "image", "model": "nano", "prompt": "a green pear", "aspect": "1:1"})
        if j.get("status") == "done":
            f2 = local(j["url"]); c, base = corner(f2); r = read(f2)[0]
            ok(dark(c, base) and base == BLUE and creds_ok(r, "trainedAlgorithmicMedia"), f"with the switch on, the mark is in the corner, under valid credentials {c} {base} {r.get('official', {}).get('state')}")
        else: ok(False, f"a marked picture is made {j}")
        api("/v1/me/aimark", {"on": False})
        # Replace the person: always marked
        face = upload(F + "/face.png"); mv = upload(F + "/move.mp4")
        j = run_job({"kind": "video", "model": "mcswap", "prompt": "", "dur": 6, "aspect": "9:16", "inputs": {"mcChar": face, "mcMove": mv}, "meta": {"consent": True}}, wait=240)
        out["swap"] = {k: j.get(k) for k in ("status", "error", "url")}
        if j.get("status") == "done":
            fs_ = local(j["url"]); fr = frame(fs_); c, base = corner(fr); r = read(fs_)[0]
            ok(dark(c, base) and creds_ok(r, "compositeWithTrainedAlgorithmicMedia"), f"Replace the person: the mark is always there (switch off) and the credentials say composite {c} {base} {r}")
        else: ok(False, f"a face swap is made {out['swap']}")
        # an editor export
        st, ex = api("/v1/media/transcode?fmt=mp4&w=640&h=360&fps=25", raw=open(F + "/rec.webm", "rb").read(), ctype="video/webm")
        if st == 200:
            r = read(local(ex["url"]))[0]; out["export"] = {"credentials": ex.get("credentials"), **r}
            ok(ex.get("credentials") is True and creds_ok(r, "compositeWithTrainedAlgorithmicMedia"), f"an editor export (MP4) carries credentials {ex} {r}")
        else: ok(False, f"an export is made {st} {ex}")
        # the owner: off and on
        st, info = api("/v1/admin/labels"); ok(st == 200 and info.get("ready") and info.get("own") and info.get("credentials"), f"the owner sees the signer (nooi's own) {info}")
        api("/v1/admin/labels", {"credentials": False})
        j = run_job({"kind": "image", "model": "nano", "prompt": "a yellow lemon", "aspect": "1:1"})
        if j.get("status") == "done": r = read(local(j["url"]))[0]; ok(not r.get("nooi"), f"credentials off → the next picture has none {r}")
        api("/v1/admin/labels", {"credentials": True})
        # the owner's own certificate
        st, bad = api("/v1/admin/labels", {"cert": "nonsense", "key": "nonsense"}); ok(st == 400 and bad.get("errorAr"), f"a bad certificate is refused, in Arabic too {st} {bad}")
        pem = subprocess.run(["node", "--input-type=module", "-e", """import "reflect-metadata"; import * as x509 from "@peculiar/x509"; import crypto from "crypto"; x509.cryptoProvider.set(crypto.webcrypto);
const A={name:"ECDSA",namedCurve:"P-256",hash:"SHA-256"},s=crypto.webcrypto.subtle,rk=await s.generateKey(A,true,["sign","verify"]),ek=await s.generateKey(A,true,["sign","verify"]);
const root=await x509.X509CertificateGenerator.createSelfSigned({serialNumber:"0a",name:"CN=Test Trusted CA",notBefore:new Date(Date.now()-864e5),notAfter:new Date(Date.now()+864e7),signingAlgorithm:A,keys:rk,extensions:[new x509.BasicConstraintsExtension(true,0,true),new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign,true),await x509.SubjectKeyIdentifierExtension.create(rk.publicKey)]});
const ee=await x509.X509CertificateGenerator.create({serialNumber:"0b",subject:"CN=Studio Owner Test, O=Owner",issuer:root.subject,notBefore:new Date(Date.now()-864e5),notAfter:new Date(Date.now()+864e7),signingAlgorithm:A,publicKey:ek.publicKey,signingKey:rk.privateKey,extensions:[new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature,true),new x509.ExtendedKeyUsageExtension(["1.3.6.1.5.5.7.3.4"]),await x509.SubjectKeyIdentifierExtension.create(ek.publicKey),await x509.AuthorityKeyIdentifierExtension.create(root)]});
const k=Buffer.from(await s.exportKey("pkcs8",ek.privateKey)).toString("base64").match(/.{1,64}/g).join("\\n");
const weak=await x509.X509CertificateGenerator.create({serialNumber:"0c",subject:"CN=Weak",issuer:root.subject,notBefore:new Date(Date.now()-864e5),notAfter:new Date(Date.now()+864e7),signingAlgorithm:A,publicKey:ek.publicKey,signingKey:rk.privateKey,extensions:[new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature,true)]});
console.log(JSON.stringify({weakCert:weak.toString("pem")+"\\n"+root.toString("pem"),cert:ee.toString("pem")+"\\n"+root.toString("pem"),key:"-----BEGIN PRIVATE KEY-----\\n"+k+"\\n-----END PRIVATE KEY-----"}))"""], cwd=ROOT, capture_output=True, text=True, timeout=60)
        own = json.loads(pem.stdout or "{}")
        weak = json.loads(pem.stdout or "{}"); st, w = api("/v1/admin/labels", {"cert": weak.get("weakCert", ""), "key": weak.get("key", "")})
        ok(st == 400 and "signingCredential" in w.get("error", ""), f"a certificate that doesn't follow the C2PA profile is refused {st} {w}")
        st, info = api("/v1/admin/labels", own); ok(st == 200 and info.get("own") is False and "Studio Owner Test" in (info.get("signer") or ""), f"the owner's own certificate signs from now on {st} {info}")
        j = run_job({"kind": "image", "model": "nano", "prompt": "a blue plum", "aspect": "1:1"})
        if j.get("status") == "done": r = read(local(j["url"]))[0]; out["owner cert"] = r.get("official"); ok(creds_ok(r, "trainedAlgorithmicMedia") and "Owner" in str((r.get("official") or {}).get("issuer")), f"…and the next picture is signed by it {r}")
        st, info = api("/v1/admin/labels", {"reset": True}); ok(st == 200 and info.get("own") is True, f"back to nooi's own {info}")
        async with async_playwright() as p:
            b = await p.chromium.launch(); await page_flow(b); await b.close()
    finally:
        srv.kill(); kie.shutdown()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1, default=str)[:6000])
asyncio.run(main())
