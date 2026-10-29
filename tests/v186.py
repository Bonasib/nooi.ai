# v186 — the server's disk filled up: every update (and every night) packed ALL the media into a new backup archive, kept 14 days.
#  · deploy/backup.sh (in a sandbox): archives from before are cleared down to the newest; data + .env go into a small archive; the
#    media is kept once, as hard links (the same files — no extra space); a file deleted on the site moves to media-deleted/<day>;
#    restoring brings the missing media back; nothing is written when the disk is nearly full (the message says so)
#  · deploy/space.sh (report only): the disk, nooi's folders, the old archives and the biggest folders — nothing changed
#  · Admin: owners and admins get disk186 from GET /v1/me when the disk is past DISK_WARN_PCT (a customer never), and a red line
#    at the top of Admin with the one command that clears space (phone in English, computer in Arabic; nothing wider than the screen)
# Run: python3 tests/v186.py
import asyncio, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8602; B = f"http://localhost:{PORT}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v186-")
# ---- 1. the backup script in a sandbox
app, bk = D + "/app", D + "/bk"; os.makedirs(app + "/data"); os.makedirs(app + "/media"); os.makedirs(bk)
open(app + "/data/db.json", "w").write('{"users":{}}'); open(app + "/.env", "w").write("SECRET_KEY=x\n")
open(app + "/media/a.mp4", "wb").write(os.urandom(300000)); open(app + "/media/b.jpeg", "wb").write(os.urandom(200000))
for i, d in enumerate(["2026-10-20-0310", "2026-10-22-1200", "2026-10-25-0310", "2026-10-28-1544"]):
    f = f"{bk}/nooi-{d}.tgz"; open(f, "wb").write(os.urandom(100000)); t = time.mktime(time.strptime(d[:10], "%Y-%m-%d")); os.utime(f, (t, t))
run = lambda *a, **k: subprocess.run(["bash", *a], capture_output=True, text=True, timeout=120, env=dict(os.environ, APP=app, DEST=bk, BK=bk, **k))
has_rsync = shutil.which("rsync") is not None
r = run(ROOT + "/deploy/backup.sh"); out["backup1"] = (r.stdout + r.stderr)[-400:]
names = sorted(os.listdir(bk))
ok(r.returncode == 0, f"backup.sh failed: {r.stdout} {r.stderr}")
ok([n for n in names if n.startswith("nooi-2")] == ["nooi-2026-10-28-1544.tgz"], f"old full archives → only the newest kept: {names}")
data = [n for n in names if n.startswith("nooi-data-")]; ok(len(data) == 1, f"one small data archive: {names}")
if data:
    lst = subprocess.run(["tar", "-tzf", bk + "/" + data[0]], capture_output=True, text=True).stdout.split()
    ok("data/db.json" in lst and ".env" in lst and not any(x.startswith("media") for x in lst), f"the data archive holds data and .env, no media: {lst}")
if has_rsync:
    ok(os.stat(app + "/media/a.mp4").st_ino == os.stat(bk + "/media/a.mp4").st_ino, "the media copy should be a hard link (no extra space)")
    os.remove(app + "/media/b.jpeg"); open(app + "/media/c.png", "wb").write(os.urandom(1000))
    r = run(ROOT + "/deploy/backup.sh"); kept = [os.path.relpath(os.path.join(p, f), bk) for p, _, fs in os.walk(bk + "/media-deleted") for f in fs]
    out["deleted_kept"] = kept; ok(r.returncode == 0 and any(k.endswith("b.jpeg") for k in kept) and os.path.exists(bk + "/media/c.png"), f"a deleted file is kept aside, a new one copied: {kept}")
    # restoring (the script's own steps without systemctl): a media file lost on the site comes back from the copy
    os.remove(app + "/media/a.mp4"); newest = sorted(n for n in os.listdir(bk) if n.startswith("nooi-data-"))[-1]
    subprocess.run(["tar", "-xzf", bk + "/" + newest, "-C", app], check=True); subprocess.run(["rsync", "-a", "--ignore-existing", bk + "/media/", app + "/media/"], check=True)
    ok(os.path.exists(app + "/media/a.mp4") and not os.path.exists(app + "/media/b.jpeg"), "restore brings the missing media back (and doesn't add deleted ones)")
else:
    out["rsync"] = "not installed here — the media copy is checked on a server with rsync"
r = subprocess.run(["bash", "-n", ROOT + "/deploy/restore.sh"], capture_output=True, text=True); ok(r.returncode == 0, f"restore.sh: {r.stderr}")
ok(subprocess.run(["grep", "-q", "rsync -a --ignore-existing", ROOT + "/deploy/restore.sh"]).returncode == 0, "restore.sh should bring media back from the copy")
for f in ("update.sh", "doctor.sh", "space.sh", "backup.sh"):
    r = subprocess.run(["bash", "-n", ROOT + "/deploy/" + f], capture_output=True, text=True); ok(r.returncode == 0, f"{f}: {r.stderr}")
ok('"$NEW/deploy/backup.sh"' in open(ROOT + "/deploy/update.sh").read(), "update.sh should use the new package's backup")
# ---- 2. the space report changes nothing
for i in range(3):
    f = f"{bk}/nooi-2026-09-0{i+1}-0310.tgz"; open(f, "wb").write(os.urandom(1000)); os.utime(f, (1, 1))
before = sorted(os.listdir(bk)); r = run(ROOT + "/deploy/space.sh"); out["space"] = r.stdout[-600:]
ok(r.returncode == 0 and "== The disk" in r.stdout and "Nothing was changed" in r.stdout and "from before v186" in r.stdout and sorted(os.listdir(bk)) == before, f"space.sh reports only: {r.stdout[-500:]} {r.stderr[-200:]}")

# ---- 3. the warning in Admin
S2 = D + "/srv"; os.makedirs(S2 + "/data"); os.makedirs(S2 + "/media"); os.symlink(ROOT + "/public", S2 + "/public"); os.symlink(ROOT + "/node_modules", S2 + "/node_modules")
TOKEN = "nooi_" + "d" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 50, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": 1},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000}]}}}, open(S2 + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "FREE_PERIOD", "NOOI_", "MINIMAX_", "DISK_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=S2, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", DISK_WARN_PCT="1"),
  stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
def api(p, tok=None):
    h = {"Authorization": "Bearer " + tok} if tok else {}
    try: return 200, json.loads(urllib.request.urlopen(urllib.request.Request(B + p, headers=h), timeout=20).read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, {}

async def page_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=S.user||{{name:'Owner',method:'email',contact:'owner@nooi.ai'}};persist();go('admin')}}")
        await E("()=>disk186()"); await pg.wait_for_function("!!document.querySelector('.dk186')", timeout=20000)
        v = await E("()=>{const e=document.querySelector('.dk186'),W=innerWidth,b=e.getBoundingClientRect();return {text:e.innerText,before:!!(e.nextElementSibling&&e.nextElementSibling.classList.contains('admtabs')),wide:b.right>W+1||b.left<-1||[...e.querySelectorAll('*')].some(x=>{const r=x.getBoundingClientRect();return r.width&&(r.right>W+1||r.left<-1)})}}")
        out[tag] = {k: v[k] for k in ("before", "wide")}
        ok(("قرص الخادم ممتلئ" in v["text"]) if ar else ("The server's disk is" in v["text"]), f"{tag}: the red line should say how full the disk is: {v['text'][:120]}")
        ok("bash /opt/nooi/deploy/space.sh --free" in v["text"] and v["before"] and not v["wide"], f"{tag}: the command, above the tabs, nothing wider than the screen: {out[tag]}")
        await pg.screenshot(path=D + f"/{tag}.png")
        ok(not errs, f"{tag}: page errors {errs[:3]}")
    finally:
        await br.close()

async def pages():
    async with async_playwright() as p:
        await page_part(p, True, "en")
        await page_part(p, False, "ar")
try:
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    me = api("/v1/me")[1]; out["owner_disk"] = me.get("disk186")
    d = me.get("disk186") or {}; ok(isinstance(d.get("pct"), int) and d.get("freeGb") is not None and d.get("totalGb"), f"the owner should get the disk state: {me.get('disk186')}")
    ok("disk186" not in api("/v1/me", TOKEN)[1], "a customer must never get the disk state")
    asyncio.run(pages())
finally:
    srv.terminate(); srv.wait()
print(json.dumps(out, ensure_ascii=False, indent=1)[:3000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + "/server.log").read()[-1500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v186 OK")
