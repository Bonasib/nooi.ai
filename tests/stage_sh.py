# deploy/stage.sh, dry-run: a preview copy of a new package beside the live site (port 8090 behind https :8443) on a COPY
# of the live data — the live files, data and settings are never changed; "promote" puts the same package live; "stop" removes it.
# Root-only tools (systemctl, nginx, sudo, npm, ufw…) are stand-ins that record what they were asked to do.
import json, os, shutil, stat, subprocess, sys, tempfile, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = tempfile.mkdtemp(prefix="nooi-stage-"); APP, STG, ETC, BIN, LOG = T + "/opt/nooi", T + "/opt/nooi-stage", T + "/etc", T + "/bin", T + "/calls.log"
fails = []
def ok(c, m):
    if not c: fails.append(m)
for d in (APP + "/data", APP + "/media", ETC + "/nginx/sites-available", ETC + "/nginx/sites-enabled", ETC + "/systemd/system", ETC + "/letsencrypt/live/nooi.test", BIN): os.makedirs(d, exist_ok=True)
open(APP + "/.env", "w").write("PORT=8080\nPUBLIC_BASE_URL=https://nooi.test\nSECRET_KEY=" + "s" * 40 + "\n")
open(APP + "/data/db.json", "w").write('{"users":{"u1":{"credits":100}}}'); open(APP + "/media/a.png", "w").write("png")
open(APP + "/server.js", "w").write("// live v80\n"); open(ETC + "/letsencrypt/live/nooi.test/fullchain.pem", "w").write("c"); open(ETC + "/letsencrypt/live/nooi.test/privkey.pem", "w").write("k")
PKG = T + "/nooi-update.zip"
with zipfile.ZipFile(PKG, "w") as z: z.writestr("server.js", "// v81\n"); z.writestr("public/index.html", "<html></html>"); z.writestr("deploy/stage.sh", "#")
SHIMS = {
    "id": 'echo 0',
    "systemctl": 'echo "systemctl $*" >> "$CALLS"',
    "nginx": 'echo "nginx $*" >> "$CALLS"',
    "npm": 'echo "npm $* @ $(pwd)" >> "$CALLS"',
    "curl": 'echo "curl $*" >> "$CALLS"',
    "ufw": 'echo "ufw $*" >> "$CALLS"',
    "journalctl": 'echo "journalctl $*" >> "$CALLS"',
    "chown": 'echo "chown $*" >> "$CALLS"',
    "nooi-update": 'echo "nooi-update $*" >> "$CALLS"',
    "sudo": 'while [ "$1" != "bash" ]; do shift; done; exec "$@"',
    # rsync -a [--delete] [--exclude X]… SRC/ DST/  (enough of rsync for the script)
    "rsync": '''python3 - "$@" <<'PY'
import sys, os, shutil
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
PY''',
}
for k, v in SHIMS.items():
    p = BIN + "/" + k; open(p, "w").write("#!/usr/bin/env bash\n" + v + "\n"); os.chmod(p, os.stat(p).st_mode | stat.S_IEXEC)
env = dict(os.environ, PATH=BIN + ":" + os.environ["PATH"], CALLS=LOG, APP=APP, STG=STG, ETC=ETC)
def run(*a):
    r = subprocess.run(["bash", ROOT + "/deploy/stage.sh", *a], env=env, capture_output=True, text=True, timeout=120); return r.returncode, r.stdout + r.stderr
calls = lambda: open(LOG).read() if os.path.exists(LOG) else ""
envof = lambda f: dict(l.split("=", 1) for l in open(f).read().splitlines() if "=" in l)

live_env, live_db = open(APP + "/.env").read(), open(APP + "/data/db.json").read()
rc, out = run(PKG)
ok(rc == 0 and "Preview ready: https://nooi.test:8443" in out, f"start: ready message {rc} {out[-600:]}")
ok(open(STG + "/server.js").read() == "// v81\n" and open(APP + "/server.js").read() == "// live v80\n", "start: the new code in the preview, the live code untouched")
ok(open(STG + "/data/db.json").read() == live_db and os.path.islink(STG + "/media") and os.readlink(STG + "/media") == APP + "/media", "start: a copy of the live data, the media folder shared")
e = envof(STG + "/.env")
ok(e.get("PORT") == "8090" and e.get("NOOI_STAGE") == "1" and e.get("PUBLIC_BASE_URL") == "https://nooi.test" and e.get("SECRET_KEY") == "s" * 40, f"start: preview settings {e}")
ok(open(APP + "/.env").read() == live_env, "start: the live settings untouched")
u = open(ETC + "/systemd/system/nooi-stage.service").read()
ok(f"WorkingDirectory={STG}" in u and "ExecStart=/usr/bin/node server.js" in u and f"ReadWritePaths={STG}/data {APP}/media" in u, f"start: the preview service {u}")
n = open(ETC + "/nginx/sites-available/nooi-stage").read()
ok("listen 8443 ssl" in n and "proxy_pass http://127.0.0.1:8090" in n and f"{ETC}/letsencrypt/live/nooi.test/fullchain.pem" in n and "noindex" in n, f"start: https :8443 → the preview {n}")
ok(os.path.islink(ETC + "/nginx/sites-enabled/nooi-stage"), "start: the preview address is on")
c = calls()
ok("systemctl restart nooi-stage" in c and "systemctl restart nooi\n" not in c and "nginx -t" in c and "systemctl reload nginx" in c and f"npm install --omit=dev --no-audit --no-fund @ {STG}" in c and "ufw allow 8443/tcp" in c, f"start: services {c}")
ok(os.path.exists(STG + ".zip"), "start: the package is kept for promote")
# refresh with the same command: the data copy is fresh again
open(STG + "/data/db.json", "w").write('{"users":{}}'); rc, out = run(PKG)
ok(rc == 0 and open(STG + "/data/db.json").read() == live_db, "refresh: a fresh copy of the live data")
# promote = the normal update with the previewed package
open(LOG, "w").close(); rc, out = run("promote")
ok(rc == 0 and f"nooi-update {STG}.zip" in calls(), f"promote: the same package goes live {rc} {out} {calls()}")
# v110: promote also removes the preview (left running, it did the live site's work again on the same server)
ok(not os.path.exists(STG) and not os.path.exists(ETC + "/systemd/system/nooi-stage.service") and "systemctl disable --now nooi-stage" in calls() and calls().index("nooi-update") < calls().index("disable --now nooi-stage") and "preview was removed" in out, f"promote: the preview removed after {out} {calls()}")
ok(open(APP + "/data/db.json").read() == live_db and os.path.exists(APP + "/media/a.png"), "promote: the live data untouched")
rc, out = run(PKG); ok(rc == 0, f"start again after promote {out[-300:]}")
# stop: everything of the preview removed, nothing of the live site
open(LOG, "w").close(); rc, out = run("stop")
ok(rc == 0 and not os.path.exists(STG) and not os.path.exists(ETC + "/nginx/sites-available/nooi-stage") and not os.path.lexists(ETC + "/nginx/sites-enabled/nooi-stage") and not os.path.exists(ETC + "/systemd/system/nooi-stage.service"), f"stop: the preview removed {out}")
ok(open(APP + "/server.js").read() == "// live v80\n" and open(APP + "/.env").read() == live_env and open(APP + "/data/db.json").read() == live_db and os.path.exists(APP + "/media/a.png"), "stop: the live site untouched")
ok("systemctl disable --now nooi-stage" in calls() and "systemctl restart nooi\n" not in calls(), f"stop: only the preview service {calls()}")
# a missing package is refused
rc, out = run(T + "/nope.zip"); ok(rc != 0 and "not found" in out, f"bad package refused {out}")
shutil.rmtree(T, ignore_errors=True)
print(json.dumps({"fails": fails}, indent=1)); sys.exit(1 if fails else 0)
