# v125 — Delete my account, with a real nooi server (and a real browser for the page):
#  · a wrong confirmation is refused (English and Arabic reason); a connection (API token) can't delete the account
#  · "حذف" deletes: the account record, its files (results, an upload, a voice), its Explore post and its like on someone
#    else's post, its support ticket; a job still waiting is cancelled and the account isn't made again by the server's own
#    loops; a file another customer also uses stays; invoices stay; the owner's list names the engine voice to remove there
#  · the page: Account & plan → Sign-in & data ends with "Delete my account"; the button opens only after typing حذف; after
#    it, the device forgets the saved state, and the page says it was deleted (Arabic phone)
#  · the privacy and cookie texts say what is true: no analytics or ad cookies, how to delete the account
# Run: python3 tests/v125.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8345
D = tempfile.mkdtemp(prefix="nooi-v125-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
for n in ("mine.png", "shared.png", "voice.mp3", "other.png"): open(D + "/media/" + n, "wb").write(b"x" * 64)
now = int(time.time() * 1000)
db = {"users": {
  "local": {"plan": "studio", "credits": 777, "ledger": [], "posts": {"p1": {"id": "p1", "status": "scheduled"}}, "accounts": {"x": {"token": "secret"}}, "profile": {"name": "Rana", "email": "rana@example.com"},
    "jobs": {"j1": {"id": "j1", "owner": "local", "kind": "image", "status": "done", "url": "/media/mine.png", "created": now},
             "j2": {"id": "j2", "owner": "local", "kind": "image", "status": "done", "url": "/media/shared.png", "created": now},
             "j3": {"id": "j3", "owner": "local", "kind": "video", "status": "queued", "created": now, "prov": "kie@x", "payload": {"kind": "video", "prompt": "a fox"}},
             "j4": {"id": "j4", "owner": "local", "kind": "voiceclone", "status": "done", "url": "/media/voice.mp3", "voiceId": "vc_123", "created": now}},
    "invoices": ["NOOI-2026-000001"]},
  "other": {"plan": "free", "credits": 5, "ledger": [], "posts": {}, "accounts": {}, "jobs": {"o1": {"id": "o1", "kind": "image", "status": "done", "url": "/media/shared.png", "created": now}, "o2": {"id": "o2", "kind": "image", "status": "done", "url": "/media/other.png", "created": now}}}},
  "explore": [{"id": "e1", "uid": "local", "url": "/media/mine.png", "kind": "image", "created": now, "likedBy": []}, {"id": "e2", "uid": "other", "url": "/media/other.png", "kind": "image", "created": now, "likedBy": ["local", "zed"]}],
  "tickets": [{"id": "t1", "uid": "local", "email": "rana@example.com", "subject": "help", "messages": []}, {"id": "t2", "uid": "other", "subject": "x", "messages": []}],
  "invoices": {"NOOI-2026-000001": {"no": "NOOI-2026-000001", "uid": "local", "total": 100, "buyer": {"name": "Rana", "email": "rana@example.com"}}}}
json.dump(db, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(path, body=None, token=None, method=None):
    h = {"content-type": "application/json"}
    if token: h["authorization"] = "Bearer " + token
    r = urllib.request.Request(f"http://localhost:{PORT}{path}", data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try:
        with urllib.request.urlopen(r, timeout=20) as x: return x.status, json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
def disk(): return json.load(open(D + "/data/db.json"))

async def page_flow(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('ar');document.getElementById('modalRoot').innerHTML='';go('account');renderAll();persist()}")
    await pg.wait_for_timeout(900)
    r = await E("""()=>{const V=document.querySelector('#main>.view'),k=[...V.children],d=V.querySelector(':scope>#del125'),bar=[...V.querySelectorAll('.secbar122 button')].map(x=>x.textContent);
      const dataStart=k.findIndex(c=>c.matches('.sec122t')&&k.indexOf(c)>=0&&c===[...V.querySelectorAll('.sec122t')].pop());
      return {has:!!d,last:!!d&&k.indexOf(d)>dataStart&&dataStart>=0,dis:d?d.querySelector('[data-act="del125"]').disabled:null,title:d?d.querySelector('h2').textContent.trim():'',bar,wide:document.documentElement.scrollWidth-innerWidth}}""")
    out["panel"] = r
    ok(r["has"] and r["last"] and r["dis"] and r["title"] == "حذف حسابي" and r["wide"] <= 1, f"Account & plan → Sign-in & data ends with Delete my account, its button closed {r}")
    await pg.fill("#del125i", "DELET"); d1 = await E("()=>document.querySelector('[data-act=\"del125\"]').disabled")
    await pg.fill("#del125i", "حذف"); d2 = await E("()=>document.querySelector('[data-act=\"del125\"]').disabled")
    ok(d1 and not d2, f"the button opens only after typing حذف {[d1, d2]}")
    had = await E("()=>!!localStorage.getItem(LSKEY)")
    await pg.click('[data-act="del125"]'); await pg.wait_for_timeout(2500)
    after = await E("()=>({url:location.search,toast:(document.querySelector('#toast .tm')||{}).textContent||'',ls:localStorage.getItem('dotai-studio-v2')})")
    out["after page"] = {"had": had, **{k: (v[:80] if isinstance(v, str) else v) for k, v in after.items()}}
    ok(had and "حُذف حسابك" in after["toast"] and after["url"] == "", f"after it, the page says the account was deleted, in Arabic {after['toast']!r} {after['url']!r}")
    ok(not after["ls"] or '"user":null' in after["ls"] or '"user":{' not in after["ls"], "the device forgot the saved state")
    ok(not errs, f"no page errors {errs[:3]}"); await ctx.close()

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL="http://localhost:9", MIRROR_MEDIA="false", FREE_PERIOD="false", RECOVER_MS="999999"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        # an upload, noted on the account
        req = urllib.request.Request(f"http://localhost:{PORT}/v1/uploads", data=b"--B\r\nContent-Disposition: form-data; name=\"file\"; filename=\"u.png\"\r\nContent-Type: image/png\r\n\r\nPNGDATA\r\n--B--\r\n", headers={"content-type": "multipart/form-data; boundary=B"}, method="POST")
        up = json.loads(urllib.request.urlopen(req, timeout=10).read()); upname = up["url"].split("/media/")[-1]
        ok(os.path.exists(D + "/media/" + upname), "an upload is on the server")
        # a connection (API token) can't delete the account
        st, tk = api("/v1/tokens", {"name": "zap"}); tok = tk.get("token") or tk.get("t") or ""
        st2, r2 = api("/v1/me/delete", {"confirm": "DELETE"}, token=tok) if tok else (0, {})
        ok(st2 == 403 and r2.get("errorAr"), f"a connection can't delete the account {st} {st2} {r2}")
        # a wrong confirmation
        st3, r3 = api("/v1/me/delete", {"confirm": "yes"})
        ok(st3 == 400 and "DELETE" in r3.get("error", "") and r3.get("errorAr") == "اكتب حذف للتأكيد.", f"a wrong confirmation is refused, with its reason in Arabic {st3} {r3}")
        # the real one
        st4, r4 = api("/v1/me/delete", {"confirm": "حذف"}); out["deleted"] = r4
        ok(st4 == 200 and r4.get("ok") and r4.get("files", 0) >= 3 and r4.get("explore") == 1 and r4.get("tickets") == 1 and r4.get("voices") == 1, f"حذف deletes the account {st4} {r4}")
        time.sleep(3.5); d = disk()   # (no request in between: the server's own loops must not make the account again)
        ok("local" not in d["users"], f"the account isn't made again by the server's loops {list(d['users'])}")
        files = {n: os.path.exists(D + "/media/" + n) for n in ("mine.png", "voice.mp3", upname, "shared.png", "other.png")}; out["files"] = files
        ok(not files["mine.png"] and not files["voice.mp3"] and not files[upname] and files["shared.png"] and files["other.png"], f"its files are gone; files another customer uses stay {files}")
        ok([x["id"] for x in d["explore"]] == ["e2"] and d["explore"][0]["likedBy"] == ["zed"], f"its Explore post and its like are gone {d['explore']}")
        ok([t["id"] for t in d["tickets"]] == ["t2"], f"its support ticket is gone {d['tickets']}")
        ok("NOOI-2026-000001" in d.get("invoices", {}), "invoices stay (tax law)")
        dl = (d.get("deletions125") or [{}])[0]; out["owner list"] = dl
        ok(dl.get("engineVoices") == ["vc_123"] and "rana" not in json.dumps(dl).lower(), f"the owner's list names the engine voice to remove, with no name or email {dl}")
        ok("other" in d["users"] and len(d["users"]["other"]["jobs"]) == 2, "the other customer is untouched")
        # the policies say what is true
        html = open(ROOT + "/public/index.html", encoding="utf8").read()
        ok("We don't use analytics, advertising or tracking cookies" in html and "Analytics cookies are used only if you agree" not in html and "Delete my account), your account" in html, "the cookie and privacy texts say what is true")
        async with async_playwright() as p:
            b = await p.chromium.launch(); await page_flow(b); await b.close()
    finally: srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
