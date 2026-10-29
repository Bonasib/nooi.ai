# v138: what the server check-up showed — the AI engine account out of credits (402 "Credits insufficient"), a voice the engine
# failed on its own side ("Internal Error, Please try again later. (500)"), and "EACCES: permission denied, stat
# /opt/nooi/public/v1/posts" while an update was copying the new version. A real nooi server and a stand-in engine that can run
# out of credits and fail a voice; the update, preview and check-up scripts with stand-ins for the root-only tools; the staff line
# on the page. Run: python3 tests/v138.py
import asyncio, json, os, re, shutil, stat, subprocess, sys, tempfile, time, urllib.request, hashlib, zipfile
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8384, 8385
D = tempfile.mkdtemp(prefix="nooi-v138-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.makedirs(D + "/eng"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOK = "nooi_" + "s" * 32
stu = {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
       "tokens": [{"id": "tks", "name": "t", "hash": hashlib.sha256(TOK.encode()).hexdigest(), "last4": TOK[-4:], "created": 1, "dailyCap": 10000000}]}
json.dump({"users": {"local": {"plan": "studio", "planUntil": 4102444800000, "credits": 90000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}, "stu": stu}}, open(D + "/data/db.json", "w"))
MOCK = r'''
import json, sys, urllib.parse, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "bad": {}, "credits": 5, "ttsFail": 0, "tts": 0}; LOCK = threading.Lock(); EXT = {}
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/stats": return self.send(st)
        if u.path == "/set": st.update({k: int(v[0]) for k, v in q.items()}); return self.send(st)
        if u.path.endswith("credit"): return self.send({"error": "not found"}, 404) if st.get("creditNo") else self.send({"code": 200, "msg": "success", "data": st["credits"]})
        if u.path.startswith("/f/"):
            b = open(DIR + "/" + u.path[3:], "rb").read(); self.send_response(200); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        tid = (q.get("taskId") or [""])[0]
        if tid in st["bad"]: return self.send({"code": 200, "data": {"state": "fail", "failMsg": st["bad"][tid], "failCode": "500"}})
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/f/{tid}{EXT.get(tid, '.mp4')}"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": st["credits"]})
        if st["credits"] <= 0: return self.send({"code": 402, "msg": "Credits insufficient : Your current balance isn\u2019t enough to run this request. Please top up to continue."})
        with LOCK: tid = "t%d" % (len(st["reqs"]) + 1); st["reqs"].append({"path": u.path, "model": j.get("model"), "tid": tid})
        m = str(j.get("model") or ""); inp = j.get("input") or {}; out = DIR + "/" + tid
        if m.startswith("elevenlabs/text-to-speech"):
            st["tts"] += 1
            if st["ttsFail"] > 0: st["ttsFail"] -= 1; st["bad"][tid] = "Internal Error, Please try again later."
            d = max(1.0, len(str(inp.get("text") or "")) * 0.055); FF("-f", "lavfi", "-i", f"sine=frequency=190:duration={d:.2f}", out + ".mp3"); EXT[tid] = ".mp3"
        else:
            FF("-f", "lavfi", "-i", "color=c=0x3a6ea5:s=320x180:d=5", "-f", "lavfi", "-i", "sine=frequency=300:duration=5", "-shortest", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", out + ".mp4"); EXT[tid] = ".mp4"
        return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
def api(p, body=None, tok=TOK):
    h = {"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})}
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
eng = lambda p: json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}{p}").read())
def waitjob(jid, sec=120, tok=TOK):
    t0 = time.time(); r = {}
    while time.time() - t0 < sec:
        r = api("/v1/jobs/" + jid, tok=tok)
        if r.get("status") in ("done", "failed"): break
        time.sleep(.3)
    return r
wallet = lambda: api("/v1/billing").get("credits")
QUOTA = "The AI engine can't take new work right now — the site's team has been told. Your credits were refunded; please try again a little later."

def unit():
    js = r'''
import("./lib/engine134.js").then(async (m) => {
  const msgs = { quota: "Kie AI 402: Credits insufficient : Your current balance isn’t enough to run this request. Please top up to continue.", hiccup: "Internal Error, Please try again later. (500)",
    busy: "The engine is busy", net: "fetch failed", key: "Kie AI 401: invalid key", input: "Kie AI 422: prompt is required", slow: "voice took too long", refused: "engine error", unsafe: "The content is sensitive (500)" };
  const pass = Object.fromEntries(Object.entries(msgs).map(([k, v]) => [k, m.passing138(new Error(v))]));
  const nc = Object.fromEntries(Object.entries(msgs).map(([k, v]) => [k, m.NO_CREDITS138.test(v)]));
  let n = 0; const ok = await m.again138(async () => { n++; if (n < 3) throw new Error(msgs.hiccup); return "made"; });
  let n2 = 0, e2 = ""; try { await m.again138(async () => { n2++; throw new Error(msgs.quota); }); } catch (e) { e2 = e.message; }
  let n3 = 0; try { await m.again138(async () => { n3++; throw new Error(msgs.hiccup); }); } catch {}
  console.log(JSON.stringify({ pass, nc, ok, n, n2, e2: !!e2, n3 })); process.exit(0); });'''
    r = subprocess.run(["node", "--input-type=module", "-e", js], cwd=ROOT, capture_output=True, text=True, timeout=60, env=dict(os.environ, AGAIN138_MS="40"))
    try: U = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: fails.append("unit ran " + (r.stdout + r.stderr)[-600:]); return
    out["unit"] = U; p = U["pass"]
    chk("engine steps: the engine's own hiccup, busy, a dropped connection are asked again; out of credits, a refused key, a wrong request, too long, a refusal, an unsafe picture are not",
        p["hiccup"] and p["busy"] and p["net"] and not any(p[k] for k in ("quota", "key", "input", "slow", "refused", "unsafe")), p)
    chk("…'Credits insufficient' (the check-up's words) is read as out of credits, nothing else is", U["nc"]["quota"] and not any(v for k, v in U["nc"].items() if k != "quota"), U["nc"])
    chk("…asked again until made (3 tries), out of credits once, at most 3 tries", U["ok"] == "made" and U["n"] == 3 and U["n2"] == 1 and U["e2"] and U["n3"] == 3, U)

def server_side():
    base = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "A quiet harbour at dawn", "dur": 5, "aspect": "16:9"})
    b = waitjob(base.get("id", "x")); chk("a video to give a voice to", b.get("status") == "done", b)
    # 1. the voice: the engine fails it once on its own side → asked again → made
    eng("/set?ttsFail=1"); t0 = eng("/stats")["tts"]; w0 = wallet()
    s = api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"sound134": {"job": base.get("id"), "scope": "all", "who": "narrator", "say": "The harbour wakes up slowly.", "want": {"voice": True, "sfx": False, "amb": False}}}})
    r = waitjob(s.get("id", "x")); t1 = eng("/stats")["tts"]
    out["voice"] = {"status": r.get("status"), "tts": t1 - t0, "err": r.get("error")}
    chk("Voices & sound: a voice the engine failed once ('Internal Error, Please try again later') is asked again and the video is made", r.get("status") == "done" and t1 - t0 == 2, out["voice"])
    # 2. it keeps failing → 3 tries, then the job fails and nothing is charged
    eng("/set?ttsFail=9"); t0 = eng("/stats")["tts"]; w0 = wallet()
    s = api("/v1/jobs", {"kind": "video", "prompt": "", "meta": {"sound134": {"job": base.get("id"), "scope": "all", "who": "narrator", "say": "Boats leave the harbour.", "want": {"voice": True, "sfx": False, "amb": False}}}})
    r = waitjob(s.get("id", "x")); t1 = eng("/stats")["tts"]; eng("/set?ttsFail=0")
    chk("…an engine that keeps failing: 3 tries, then the job fails and the credits come back", r.get("status") == "failed" and t1 - t0 == 3 and wallet() == w0, {"st": r.get("status"), "tries": t1 - t0, "w": [w0, wallet()]})
    # 3. the engine account runs out of credits
    eng("/set?credits=0"); w0 = wallet()
    v = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "Gulls over the water", "dur": 5, "aspect": "16:9"}); r = waitjob(v.get("id", "x"))
    out["quota"] = {k: r.get(k) for k in ("status", "error", "errorType")}
    chk("out of credits: the job fails with the calm sentence, the credits come back", r.get("status") == "failed" and r.get("error") == QUOTA and r.get("errorType") == "quota" and wallet() == w0, [out["quota"], w0, wallet()])
    chk("…the customer's job never names the engine's company", "kie" not in json.dumps(r).lower(), r)
    me, mine = api("/v1/me", tok=None), api("/v1/me")
    a = (me.get("alerts138") or {}).get("engine") or {}
    chk("…staff see it at once (how many, since when); a customer doesn't", a.get("type") == "quota" and a.get("count") == 1 and a.get("since") and "alerts138" not in mine and "kie" not in json.dumps(me).lower(), [me.get("alerts138"), list(mine)])
    chk("…the engine's status turns Offline right away (no wait for the 15-minute check)", (api("/v1/status").get("providers") or {}).get("engine") == "down", api("/v1/status"))
    api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "Rain on the deck", "dur": 5, "aspect": "16:9"}); time.sleep(1.5)
    chk("…each failed job adds to the count", ((api("/v1/me", tok=None).get("alerts138") or {}).get("engine") or {}).get("count") == 2, api("/v1/me", tok=None).get("alerts138"))
    t = api("/v1/admin/providers/engine/test", {}, tok=None)
    chk("…the connection test with an empty balance says out of credits (not 'online · 0 credits left'), and the line stays", t.get("state") == "down" and t.get("type") == "quota" and (api("/v1/me", tok=None).get("alerts138") or {}).get("engine"), t)
    # 4. topped up → the test clears it
    eng("/set?credits=50"); t = api("/v1/admin/providers/engine/test", {}, tok=None)
    chk("topped up: the connection test passes and the staff line goes", t.get("state") == "online" and api("/v1/me", tok=None).get("alerts138") == {}, [t, api("/v1/me", tok=None).get("alerts138")])
    # 4b. (v169) the check-up's case: refused, then topped up — "Test all" (the same check the site makes every 15 minutes) takes the
    #     line away too and says the balance (it had left the line on for hours)
    eng("/set?credits=0"); v = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "Gulls at dusk", "dur": 5, "aspect": "16:9"}); waitjob(v.get("id", "x"))
    had = bool((api("/v1/me", tok=None).get("alerts138") or {}).get("engine"))
    eng("/set?credits=50"); t = api("/v1/admin/providers-test", {}, tok=None); k = t.get("engine") or t.get("kie") or {}
    chk("topped up: Test all / the 15-minute check clears the line and shows the balance", had and k.get("state") == "online" and "50 credits left" in (k.get("note") or "") and api("/v1/me", tok=None).get("alerts138") == {}, [had, k, api("/v1/me", tok=None).get("alerts138")])
    # …a balance that can't be read (its address answers 404): the check says why and the line stays (a top-up can't be seen)
    eng("/set?credits=0"); v = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "Gulls at dawn", "dur": 5, "aspect": "16:9"}); waitjob(v.get("id", "x"))
    eng("/set?credits=50&creditNo=1"); t = api("/v1/admin/providers-test", {}, tok=None); k = t.get("engine") or t.get("kie") or {}
    chk("…a balance it can't read: 'balance not read (HTTP 404)', the line stays", "balance not read (HTTP 404)" in (k.get("note") or "") and (api("/v1/me", tok=None).get("alerts138") or {}).get("engine"), [k, api("/v1/me", tok=None).get("alerts138")])
    eng("/set?creditNo=0"); api("/v1/admin/providers/engine/test", {}, tok=None)
    # 5. again out of credits, then a job made → it clears itself
    eng("/set?credits=0"); v = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "Ropes on the pier", "dur": 5, "aspect": "16:9"}); waitjob(v.get("id", "x"))
    had = bool((api("/v1/me", tok=None).get("alerts138") or {}).get("engine"))
    eng("/set?credits=50"); v = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "Sun on the pier", "dur": 5, "aspect": "16:9"}); r = waitjob(v.get("id", "x"))
    chk("…a job made on the engine again clears the line by itself", had and r.get("status") == "done" and api("/v1/me", tok=None).get("alerts138") == {}, [had, r.get("status"), api("/v1/me", tok=None).get("alerts138")])
    # 6. a film of several parts while the engine has no credits: the film says why (not "part 1 couldn't be made… or a shorter video"),
    #    in Arabic too; the film itself isn't counted again (its parts were)
    eng("/set?credits=0"); c0 = ((api("/v1/me", tok=None).get("alerts138") or {}).get("engine") or {}).get("count") or 0; w0 = wallet()
    f = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "A boat leaves the harbour and sails out to sea", "dur": 20, "aspect": "16:9"}); r = waitjob(f.get("id", "x"), 180)
    c1 = ((api("/v1/me", tok=None).get("alerts138") or {}).get("engine") or {}).get("count") or 0
    out["film"] = {k: r.get(k) for k in ("status", "error", "errorAr", "errorType", "partsTotal")}; out["film"]["counted"] = c1 - c0
    chk("a film while the engine has no credits: it says the engine can't take work (EN + AR), nothing charged; only its parts are counted",
        r.get("status") == "failed" and r.get("error") == QUOTA and "محرّك الذكاء" in (r.get("errorAr") or "") and r.get("errorType") == "quota" and wallet() == w0 and 1 <= c1 - c0 <= (r.get("partsTotal") or 9), out["film"])
    eng("/set?credits=50"); api("/v1/admin/providers/engine/test", {}, tok=None)
    # leave one for the page
    eng("/set?credits=0"); v = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "Fog on the pier", "dur": 5, "aspect": "16:9"}); waitjob(v.get("id", "x"))

# ---- the update, the preview and the check-up, with stand-ins for the root-only tools
RSYNC = r'''python3 - "$@" <<'PY'
import sys, os, shutil, stat
a = sys.argv[1:]; ex = set(); pos = []; dele = False; i = 0
while i < len(a):
    if a[i] == "--exclude": ex.add(a[i + 1]); i += 2; continue
    if a[i] == "--delete": dele = True
    elif not a[i].startswith("-"): pos.append(a[i])
    i += 1
src, dst = pos[0].rstrip("/"), pos[1].rstrip("/"); os.makedirs(dst, exist_ok=True)
if dele:
    for n in os.listdir(dst):
        if n in ex: continue
        p = os.path.join(dst, n); shutil.rmtree(p) if os.path.isdir(p) and not os.path.islink(p) else os.remove(p)
for n in os.listdir(src):
    if n in ex: continue
    s, d = os.path.join(src, n), os.path.join(dst, n)
    shutil.copytree(s, d, dirs_exist_ok=True) if os.path.isdir(s) else shutil.copy2(s, d)
os.chmod(dst, stat.S_IMODE(os.stat(src).st_mode))   # like rsync -a SRC/ DST/: the folder takes the source folder's permissions
PY'''
def shims(BIN, extra={}):
    os.makedirs(BIN, exist_ok=True)
    base = {"id": "echo 0", "systemctl": 'echo "systemctl $*" >> "$CALLS"', "nginx": 'echo "nginx $*" >> "$CALLS"', "npm": 'echo "npm $* @ $(pwd)" >> "$CALLS"',
            "curl": 'echo "curl $*" >> "$CALLS"', "ufw": 'echo "ufw $*" >> "$CALLS"', "journalctl": 'echo "journalctl $*" >> "$CALLS"', "chown": 'echo "chown $*" >> "$CALLS"',
            "nooi-update": 'echo "nooi-update $*" >> "$CALLS"', "nooi-backup": 'echo "nooi-backup" >> "$CALLS"', "sleep": "exit 0", "sudo": 'while [ "$1" != "bash" ]; do shift; done; exec "$@"', "rsync": RSYNC, **extra}
    for k, v in base.items():
        p = BIN + "/" + k; open(p, "w").write("#!/usr/bin/env bash\n" + v + "\n"); os.chmod(p, 0o755)
def deploy_side():
    T = tempfile.mkdtemp(prefix="nooi-v138d-"); APP, BIN, LOG = T + "/opt/nooi", T + "/bin", T + "/calls.log"
    os.makedirs(APP + "/data"); os.makedirs(APP + "/media"); os.makedirs(APP + "/public"); open(APP + "/.env", "w").write("PORT=8080\nPUBLIC_BASE_URL=https://nooi.test\n")
    open(APP + "/server.js", "w").write("// live\n"); open(APP + "/data/db.json", "w").write("{}"); os.chmod(APP, 0o755)
    shims(BIN); open(BIN + "/nooi-update", "w").write("#!/usr/bin/env bash\n# the old one\n")
    PKG = T + "/nooi-update.zip"
    with zipfile.ZipFile(PKG, "w") as z:
        z.writestr("server.js", "// new\n"); z.writestr("public/index.html", "<html></html>")
        z.write(ROOT + "/deploy/update.sh", "deploy/update.sh"); z.write(ROOT + "/deploy/backup.sh", "deploy/backup.sh")
    env = dict(os.environ, PATH=BIN + ":" + os.environ["PATH"], CALLS=LOG, APP=APP, BINDIR=BIN, PREV=T + "/opt/nooi-prev", DEST=T + "/backups")   # (v186: the package's own backup runs — into DEST)
    r = subprocess.run(["bash", ROOT + "/deploy/update.sh", PKG], env=env, capture_output=True, text=True, timeout=120)
    mode = stat.S_IMODE(os.stat(APP).st_mode); inst = open(BIN + "/nooi-update").read()
    out["update"] = {"rc": r.returncode, "mode": oct(mode), "tail": (r.stdout + r.stderr)[-300:]}
    chk("update: the site's folder stays open to the site while the new version is copied (755, not mktemp's 700 → no more EACCES)", r.returncode == 0 and "Updated" in r.stdout and mode == 0o755 and open(APP + "/server.js").read() == "// new\n", out["update"])
    chk("update: the new package's backup ran first (v186: data + settings in a small archive, no media inside)", any(n.startswith("nooi-data-") for n in (os.listdir(T + "/backups") if os.path.isdir(T + "/backups") else [])), (r.stdout + r.stderr)[-300:])
    chk("update: this version's update and backup commands are installed for next time", inst == open(ROOT + "/deploy/update.sh").read() and os.access(BIN + "/nooi-update", os.X_OK) and open(BIN + "/nooi-backup").read() == open(ROOT + "/deploy/backup.sh").read(), inst[:120])
    # the preview: its folder open too; promote uses the update steps of the version being put live
    T2 = tempfile.mkdtemp(prefix="nooi-v138s-"); APP2, STG, ETC, BIN2, LOG2 = T2 + "/opt/nooi", T2 + "/opt/nooi-stage", T2 + "/etc", T2 + "/bin", T2 + "/calls.log"
    for d in (APP2 + "/data", APP2 + "/media", ETC + "/nginx/sites-available", ETC + "/nginx/sites-enabled", ETC + "/systemd/system", ETC + "/letsencrypt/live/nooi.test"): os.makedirs(d, exist_ok=True)
    open(APP2 + "/.env", "w").write("PORT=8080\nPUBLIC_BASE_URL=https://nooi.test\n"); open(APP2 + "/data/db.json", "w").write("{}"); open(APP2 + "/server.js", "w").write("// live\n")
    for f in ("fullchain.pem", "privkey.pem"): open(ETC + "/letsencrypt/live/nooi.test/" + f, "w").write("x")
    shims(BIN2); PKG2 = T2 + "/nooi-update.zip"
    with zipfile.ZipFile(PKG2, "w") as z: z.writestr("server.js", "// new\n"); z.writestr("deploy/update.sh", 'echo "package-update $*" >> "$CALLS"\n')
    env2 = dict(os.environ, PATH=BIN2 + ":" + os.environ["PATH"], CALLS=LOG2, APP=APP2, STG=STG, ETC=ETC)
    r = subprocess.run(["bash", ROOT + "/deploy/stage.sh", PKG2], env=env2, capture_output=True, text=True, timeout=120)
    smode = stat.S_IMODE(os.stat(STG).st_mode) if os.path.exists(STG) else 0
    r2 = subprocess.run(["bash", ROOT + "/deploy/stage.sh", "promote"], env=env2, capture_output=True, text=True, timeout=120); calls = open(LOG2).read() if os.path.exists(LOG2) else ""
    chk("preview: its folder is open too (755); promote uses the update steps of the version being put live, then removes the preview",
        r.returncode == 0 and smode == 0o755 and r2.returncode == 0 and f"package-update {STG}.zip" in calls and "nooi-update" not in calls and not os.path.exists(STG), [r.returncode, oct(smode), r2.returncode, calls[-400:], (r.stdout + r.stderr)[-300:]])
    # the check-up: what needs the owner, in plain words
    T3 = tempfile.mkdtemp(prefix="nooi-v138c-"); APP3, BIN3 = T3 + "/opt/nooi", T3 + "/bin"; os.makedirs(APP3 + "/data"); os.makedirs(APP3 + "/media")
    open(APP3 + "/.env", "w").write("PORT=8080\n"); now = int(time.time() * 1000)
    json.dump({"users": {}, "settings": {"status": {"kie": {"state": "down", "type": "quota", "note": "Out of credits — top up the engine account", "checked": now - 120000}},
               "alerts138": {"kie": {"type": "quota", "since": now - 1800000, "last": now - 60000, "count": 4}}}}, open(APP3 + "/data/db.json", "w"))
    JL = "\\n".join(["job a · video · kie@kling-3.0/video failed: Kie AI 402: Credits insufficient : Your current balance isn\u2019t enough to run this request. Please top up to continue."] * 3 +
                    ["job b · video · kie@minimax-h3/text-to-video failed: The previous part failed"] * 2 + ["Error: EACCES: permission denied, stat '/opt/nooi/public/v1/posts'",
                     "job c · video · nooi@sound134 failed: Internal Error, Please try again later. (500)"])
    shims(BIN3, {"journalctl": f'printf "{JL}\\n"', "systemctl": "exit 0", "curl": "printf 000", "ffmpeg": "exit 0"})
    r = subprocess.run(["bash", ROOT + "/deploy/doctor.sh"], env=dict(os.environ, PATH=BIN3 + ":" + os.environ["PATH"], APP=APP3), capture_output=True, text=True, timeout=120)
    t = r.stdout; need = t[t.find("== What needs you"):]; out["doctor"] = need[:1400]
    chk("check-up: says the engine account is out of credits (how many refusals), that customers weren't charged, the film parts that stopped, and what to do",
        "out of credits — it refused 3 request(s)" in need and "customers were not charged" in need and "2 film part(s) stopped" in need and "Top up the engine account" in need and "Test all" in need, need[:900])
    chk("check-up: EACCES explained (an update moment, nothing to do from v138); the engine's own failures counted; the site's own mark read", "1 time(s) the site couldn't open its own folder" in need and "Nothing to do" in need
        and "failed on its own side 1 time(s)" in need and "out of credits since 30 min ago · 4 job(s) failed" in need and "Out of credits — top up the engine account" in need and t.rstrip().endswith("Done — nothing was changed."), need[:900])
    shims(BIN3, {"journalctl": "exit 0", "systemctl": "exit 0", "curl": "printf 000", "ffmpeg": "exit 0"}); open(APP3 + "/data/db.json", "w").write('{"users":{}}')
    r = subprocess.run(["bash", ROOT + "/deploy/doctor.sh"], env=dict(os.environ, PATH=BIN3 + ":" + os.environ["PATH"], APP=APP3), capture_output=True, text=True, timeout=120)
    chk("check-up: when all is well it says so", "✓ Nothing above needs you." in r.stdout, r.stdout[-500:])

async def page_side(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.myPlan='studio';S.credits=99999;try{sessionStorage.removeItem('al138')}catch(_){}}")
    await E("()=>alerts138()"); await pg.wait_for_function("!!AL138", timeout=10000)
    toast = await E("()=>(document.getElementById('toast')||{}).textContent||''")
    await E("()=>{go('admin');renderAll()}"); await pg.wait_for_function("!!document.querySelector('.al138')", timeout=10000)
    a = await E("()=>{const l=document.querySelector('.al138'),r=l.getBoundingClientRect();return{t:l.textContent,w:r.width,vw:innerWidth,role:l.getAttribute('role')}}")
    await E("()=>{S.lang='ar';renderAll()}"); ar = await E("()=>({line:(document.querySelector('.al138')||{}).textContent||'',job:errText81({error:\"" + QUOTA.replace("'", "\\'") + "\",errorType:'quota'})})")
    out["page"] = {"toast": toast, "line": a, "ar": ar, "errs": errs}
    chk("page: staff get a short note once and a red line at the top of Admin — how many jobs failed, since when, customers not charged, what to do", "out of credits" in toast and "out of credits" in a["t"] and re.search(r"\d+ jobs? failed since \d\d:\d\d", a["t"]) and "not charged" in a["t"] and "Test all" in a["t"] and a["role"] == "alert" and a["w"] <= a["vw"], out["page"])
    chk("page: in Arabic too; the customer's failed job reads the calm sentence in their language; the engine's company never named", "نفد رصيد حساب محرّك الذكاء" in ar["line"] and "لا يستطيع محرّك الذكاء" in ar["job"] and "kie" not in (a["t"] + ar["line"] + toast).lower(), ar)
    chk("page: no errors", not errs, errs)
    await b.close()

async def main():
    async with async_playwright() as p: await page_side(p)

mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D + "/eng"])
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC", "NVIDIA", "GOOGLE", "ELEVEN", "KIE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", RECOVER_MS="1500",
    ENGINE134_POLL_MS="300", AGAIN138_MS="300", KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="true", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/health", timeout=2); urllib.request.urlopen(f"http://localhost:{KPORT}/stats", timeout=2); break
        except Exception: time.sleep(.2)
    for f in (unit, server_side, deploy_side):
        try: f()
        except Exception as e: fails.append(f.__name__ + " crashed: " + repr(e)[:300])
    asyncio.run(main())
finally: srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": {k: json.dumps(v, ensure_ascii=False)[:1400] for k, v in out.items()}, "dir": D}, ensure_ascii=False, indent=1))
