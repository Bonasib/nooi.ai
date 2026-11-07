# v249 — "anything written in the dashboard doesn't show on the VPS": a real nooi server and deploy/why.sh
#  · a value saved in Admin → AI providers is used at once (no restart) and why.sh shows it (where it came from: Admin or .env)
#  · a key's name typed in Seedance's Model id field is shown as IGNORED; "-" in a field clears it (it couldn't be cleared before);
#    the key stays; a real model id then shows; the Base URL as the server cleans it
#  · no key is ever printed
# Run: python3 tests/v249.py
import json, os, shutil, subprocess, sys, tempfile, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8768; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v249-"); os.makedirs(D + "/data"); os.makedirs(D + "/media")
for n in ("public", "node_modules", "lib", "providers"): os.symlink(ROOT + "/" + n, D + "/" + n)
shutil.copy(ROOT + "/package.json", D); json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "MINIMAX_", "ADMIN_EMAILS", "SEEDANCE_", "ELEVEN"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", ADMIN_EMAILS="boss@dev.local"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1500]))
def req(path, body=None, method=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Dev-User": "boss"}, method=method or ("POST" if body is not None else "GET"))
    try: return json.loads(urllib.request.urlopen(r, timeout=30).read())
    except urllib.error.HTTPError as e: return {"status": e.code, **json.loads(e.read() or b"{}")}
def why():
    time.sleep(3)   # (the server writes its data a moment after a change)
    out = subprocess.run(["bash", ROOT + "/deploy/why.sh"], env=dict(os.environ, APP=D, SECRET_KEY="f" * 40), capture_output=True, text=True, timeout=60).stdout
    return "\n".join(l for l in out.splitlines() if "ByteDance (Seedance):" in l)
def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    req("/v1/admin/providers/seedance", {"apiKey": "bd-secret-key-123", "model": "apikey-20261106235400-h99gb", "baseUrl": "https://ark.ap-southeast.bytepluses.com"}, "PUT")
    w1 = why()
    chk("why.sh shows what the server uses: the key from Admin (never the key), the key's name in Model id IGNORED, the cleaned address", "key yes (Admin)" in w1 and "IGNORED (apikey-20261106235400-h99gb" in w1 and "https://ark.ap-southeast.bytepluses.com/api/v3 (Admin)" in w1 and "bd-secret" not in w1, w1)
    req("/v1/admin/providers/seedance", {"model": "-"}, "PUT"); w2 = why()
    chk("\"-\" clears the Model id (the key stays)", "model (each Seedance model its own)" in w2 and "key yes (Admin)" in w2, w2)
    req("/v1/admin/providers/seedance", {"model": "dreamina-seedance-2-0-260128"}, "PUT"); w3 = why()
    chk("a real model id is used at once", "model dreamina-seedance-2-0-260128 (Admin)" in w3, w3)
    s = json.dumps(req("/v1/config")) + json.dumps(req("/v1/me"))
    chk("the site never gets the key back", "bd-secret-key-123" not in s, s[:300])
try: main()
except Exception as e: chk("crashed", False, repr(e)[:700])
finally: srv.terminate()
if fails: print("v249 FAIL\n - " + "\n - ".join(fails)); print(open(D + "/srv.log").read()[-2000:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True); print("v249 OK")
