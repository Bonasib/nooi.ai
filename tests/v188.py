# v188 — the disk stayed full after the update, and MiniMax felt slow. A real nooi server and the real deploy/space.sh in a sandbox:
#  · deploy/space.sh --json writes what fills the disk (the biggest folders, single big files, space held by programs, old backup
#    archives); --auto clears when Admin asked ("Free space now" leaves a file it picks up) — the old full backup archives go (the
#    newest kept), the report says what was cleared; without the request and under 90 % it changes nothing
#  · deploy/update.sh clears the old archives before it unpacks when the disk is nearly full, and installs the 5-minute timer
#  · GET /v1/admin/space188 gives the report and the disk now; POST …/free leaves the request (customers can't)
#  · the site's own temporary files older than 6 hours are cleared, nothing else in the temporary folder
#  · a full disk while a finished video is saved: one download only (no three tries), no half-written file, a clear reason
#  · the page (phone in English, computer in Arabic): Admin's "Server disk" card and the red line open "What fills the disk" (the bar,
#    the folders with what they are, the big file, "Free space now" → asked); a MiniMax video being made says how long MiniMax takes
#    (3–6 minutes at 1080P) and its bar follows that time; the settings sheet says 1080P on MiniMax takes longer
# Run: python3 tests/v188.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8640; B = f"http://localhost:{PORT}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v188-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "r" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 50, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": 1},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
# a small disk tree: a big folder, a 320 MB file, and the backups with three old full archives
R, BK = D + "/root", D + "/bk"; os.makedirs(R + "/var/lib/docker"); os.makedirs(R + "/opt/nooi/media"); os.makedirs(BK)
subprocess.run(["dd", "if=/dev/zero", "of=" + R + "/var/lib/docker/layer.bin", "bs=1M", "count=320", "status=none"], check=True)
for i in range(3):
    f = f"{BK}/nooi-2026-10-0{i + 1}-031000.tgz"; open(f, "w").write("x" * 1000); t = time.time() - (3 - i) * 86400; os.utime(f, (t, t))
open(BK + "/nooi-data-2026-10-28-031000.tgz", "w").write("data")
SP = ROOT + "/deploy/space.sh"
def space(mode): return subprocess.run(["bash", SP, mode], env=dict(os.environ, APP=D, BK=BK, SPACE_ROOT=R, TMPDIR=D), capture_output=True, text=True, timeout=300)

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_", "MINIMAX_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", DISK_WARN_PCT="1"),
                       stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
def api(p, body=None, method=None, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=60).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}

def server_part():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    # 1. the report
    r = space("--json"); rep = json.load(open(D + "/data/space188.json")); out["json"] = {k: rep.get(k) for k in ("disk", "oldArchives")}
    ok(r.returncode == 0 and rep["oldArchives"] == 2 and any(x["path"].endswith("/var/lib/docker") and x["gb"] >= 0.3 for x in rep["top"]) and any(x["path"].endswith("layer.bin") for x in rep["files"]) and "pct" in rep["disk"],
       f"--json should list the big folder, the big file and the old archives: {rep}")
    # 2. without a request and under 90 %: --auto changes nothing
    space("--auto"); ok(len([f for f in os.listdir(BK) if f.startswith("nooi-2")]) == 3, "--auto under 90 % with no request should clear nothing")
    # 3. the endpoints: the report, the request; a customer can't
    c, g = api("/v1/admin/space188"); out["get"] = {"report": bool(g.get("report")), "now": g.get("now"), "requested": g.get("requested")}
    ok(c == 200 and g.get("report", {}).get("oldArchives") == 2 and isinstance((g.get("now") or {}).get("pct"), int) and g.get("requested") is False, f"GET space188: {out['get']}")
    ok(api("/v1/admin/space188", tok=TOKEN)[0] == 403 and api("/v1/admin/space188/free", {}, tok=TOKEN)[0] == 403, "a customer can't read or clear the disk")
    c, p = api("/v1/admin/space188/free", {}); ok(c == 200 and p.get("requested") is True and os.path.exists(D + "/data/space188.free"), f"Free space now should leave the request: {c} {p.get('requested')}")
    # 4. the timer picks the request up: the old archives go (the newest kept, the data archive kept), the report says so
    r = space("--auto"); rep = json.load(open(D + "/data/space188.json")); left = sorted(os.listdir(BK)); out["after"] = {"left": left, "cleared": rep.get("cleared")}
    ok(left == ["nooi-2026-10-03-031000.tgz", "nooi-data-2026-10-28-031000.tgz"] and not os.path.exists(D + "/data/space188.free") and "old backup archives: 2" in (rep.get("cleared") or {}).get("what", "") and rep["oldArchives"] == 0,
       f"--auto should clear the old archives on request and say so: {out['after']} {r.stderr[-300:]}")
    ok(api("/v1/admin/space188")[1].get("requested") is False, "the request is gone once done")
    # 5. update.sh: the clearing before unpacking and the timer
    u = open(ROOT + "/deploy/update.sh").read()
    ok(u.index("nooi-2[0-9][0-9][0-9]-*.tgz") < u.index('unzip -q "$ZIP"') and "nooi-space" in u and "CROND" in u and "space.sh --auto" in u, "update.sh: clear before unpacking, install the timer")
    ok(subprocess.run(["bash", "-n", ROOT + "/deploy/update.sh"]).returncode == 0 and subprocess.run(["bash", "-n", SP]).returncode == 0, "the scripts parse")
    # 6. the site's old temporary files (its own names only)
    T = D + "/tmpdir"; os.makedirs(T + "/nooi-slow-abc")
    for n in ("nooi-x.wav", "abcdefghijklmnop.jpg", "other-app.txt", "nooi-new.mp3"): open(f"{T}/{n}", "w").write("x")
    old = time.time() - 7 * 3600
    for n in ("nooi-x.wav", "abcdefghijklmnop.jpg", "other-app.txt", "nooi-slow-abc"): os.utime(f"{T}/{n}", (old, old))
    js = subprocess.run(["node", "--input-type=module", "-e", f"import {{ sweepTmp188 }} from '{ROOT}/lib/space188.js'; console.log(JSON.stringify(sweepTmp188(6*3600e3, '{T}')));"], cwd=D, capture_output=True, text=True, timeout=60)
    left = sorted(os.listdir(T)); out["sweep"] = [js.stdout.strip()[-80:], left]
    ok(left == ["nooi-new.mp3", "other-app.txt"], f"only the site's own old temporary files go: {left} {js.stderr[-300:]}")
    # 7. a full disk while a finished video is saved: one download, no half file, a clear reason
    script = f"""
import http from 'http'; import fs from 'fs'; import path from 'path';
let hits = 0; const srv = http.createServer((q, s) => {{ hits++; s.setHeader('content-type', 'video/mp4'); s.end(Buffer.alloc(200000)); }}).listen(0);
await new Promise((r) => srv.on('listening', r));
const real = fs.writeFileSync; fs.writeFileSync = function (f, ...a) {{ if (String(f).includes('/media/')) {{ real.call(fs, f, Buffer.alloc(10)); const e = new Error('ENOSPC: no space left on device, write'); e.code = 'ENOSPC'; throw e; }} return real.call(fs, f, ...a); }};
const {{ download, MEDIA_DIR }} = await import('{ROOT}/lib/media.js');
let err = null; try {{ await download('http://localhost:' + srv.address().port + '/v.mp4'); }} catch (e) {{ err = e; }}
console.log(JSON.stringify({{ hits, diskFull: !!(err && err.diskFull), msg: err && err.message, files: fs.readdirSync(MEDIA_DIR).length }})); srv.close(); process.exit(0);
"""
    js = subprocess.run(["node", "--input-type=module", "-e", script], cwd=D, capture_output=True, text=True, timeout=120)
    try: r = json.loads(js.stdout.strip().splitlines()[-1])
    except Exception: r = {"err": js.stderr[-400:]}
    out["enospc"] = r
    ok(r.get("hits") == 1 and r.get("diskFull") and "disk is full" in (r.get("msg") or "") and r.get("files") == 0, f"a full disk: one download, no half file, a clear reason: {r}")

async def page_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"; R_ = {}
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=S.user||{{name:'Owner',method:'email',contact:'owner@nooi.ai'}};S.admTab='overview';persist();go('admin')}}")
        await pg.wait_for_function("!!document.querySelector('.dsk188 [data-act=\"sp188\"]')", timeout=20000)
        await pg.wait_for_function("!!document.querySelector('.dk186 [data-act=\"sp188\"]')", timeout=20000)   # (the red line: DISK_WARN_PCT=1 here)
        await pg.click('.dsk188 [data-act="sp188"]'); await pg.wait_for_function("!!document.querySelector('#modalRoot .sh188 .sp188l')", timeout=15000)
        v = await E("""()=>{const s=document.querySelector('#modalRoot .sh188'),W=innerWidth;return {bar:!!s.querySelector('.spbar188 i'),rows:[...s.querySelectorAll('.sp188l li')].map(l=>l.innerText.replace(/\\s+/g,' ')),
          btn:s.querySelector('[data-act="sp188-free"]').innerText,cleared:!!s.querySelector('.ok188'),wide:[...s.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>W+1||b.left<-1)}).length}}""")
        R_["sheet"] = {k: v[k] for k in ("bar", "btn", "cleared", "wide")}; R_["rows"] = v["rows"][:4]
        dock = next((x for x in v["rows"] if "/var/lib/docker" in x), "")
        ok(v["bar"] and dock and (("ليس من nooi" in dock) if ar else ("not nooi" in dock)) and any("layer.bin" in x for x in v["rows"]) and v["cleared"] and not v["wide"], f"{tag}: the sheet shows the bar, the folders with what they are, the big file, the last clearing: {R_}")
        ok(("حرّر المساحة الآن" in v["btn"]) if ar else ("Free space now" in v["btn"]), f"{tag}: Free space now button: {v['btn']}")
        await pg.click('#modalRoot [data-act="sp188-free"]'); await pg.wait_for_timeout(600)
        st = await E("()=>{const b=document.querySelector('#modalRoot [data-act=\"sp188-free\"]');return [b.disabled,b.innerText]}"); R_["asked"] = st
        ok(st[0] and (("طُلب" in st[1]) if ar else ("Asked" in st[1])) and os.path.exists(D + "/data/space188.free"), f"{tag}: Free space now → asked: {st}")
        os.remove(D + "/data/space188.free"); await E("()=>closeSheet()")
        # MiniMax: the time it takes, on the card and in the settings sheet; the bar follows it
        await E("()=>{S.jobs.unshift({id:'mm188',remote:'',kind:'video',status:'rendering',prompt:'Waves on black rocks',model:'hailuo',created:Date.now()-60000,progress:0,aspect:'16:9',dur:6,meta:{res:'1080P'}});S.hf.out=['mm188'];S.hf.tab='video';S.hf.vModel='hailuo';persist();go('home')}")
        await pg.wait_for_selector(".hfrc .mm188", timeout=15000)
        m = await E("()=>({note:document.querySelector('.hfrc .mm188').innerText,sec:sec188(S.jobs.find(j=>j.id==='mm188')),sec768:sec188({model:'hailuo',meta:{res:'768P'}})})"); R_["mm"] = m
        ok(("3–6" in m["note"]) and m["sec"] == 240 and m["sec768"] == 150, f"{tag}: MiniMax's time on the card and its bar: {m}")
        await pg.click('.hfbox [data-act="hf187-set"]'); await pg.wait_for_selector("#modalRoot .sh187 .h188", timeout=10000)
        h = await E("()=>document.querySelector('#modalRoot .sh187 .h188').innerText"); R_["hint"] = h
        ok(("768P" in h) and ("3–6" in h), f"{tag}: the settings sheet says 1080P on MiniMax takes longer: {h}")
        await pg.screenshot(path=D + f"/{tag}.png")
        ok(not errs, f"{tag}: page errors {errs[:3]}")
    finally:
        out[tag] = R_; await br.close()

async def pages():
    async with async_playwright() as p:
        await page_part(p, True, "en")
        await page_part(p, False, "ar")

try:
    server_part()
    asyncio.run(pages())
finally:
    srv.terminate(); srv.wait()
print(json.dumps(out, ensure_ascii=False, indent=1)[:5000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + "/server.log").read()[-2000:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v188 OK")
