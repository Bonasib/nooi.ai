# v190 — "add them into the dashboard": the Moyasar setup steps in Admin → Payments, each checked by the server. A real nooi server
# and a stand-in Moyasar (MOYASAR_API) with its webhooks API (GET/POST /v1/webhooks, DELETE /v1/webhooks/:id) and an IP lookup:
#  · no key yet: step 1 not done, "Connect" refused with the reason; customers can't read or use any of it
#  · the test key saved → step 1 (test); "Connect webhook in Moyasar" → the old webhook to this same address removed (others kept),
#    a new one made with the secret key, our https address, the payment events and a new 48-character secret kept on the server only
#  · a notice with that secret → taken and shown as the last one; a wrong one → refused and shown with "connect again"
#  · a test payment through Moyasar → step 4 ticks itself (test); the invoice's callback POST to the return address → 200, a re-check
#  · the server's address for the IP whitelist (step 5), ticked by hand and back
#  · the live key → step 6 done and step 3 asks to connect again (live), then done; a key Moyasar refuses → a clear reason;
#    an event name Moyasar doesn't take → made for all events
#  · the page (phone in English, computer in Arabic): the checklist with ticks and "n / 6", find the address, tick it, untick it
# Run: python3 tests/v190.py
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, tempfile, threading, time, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8643; MPORT = 8644; B = f"http://localhost:{PORT}"; PUB = "https://nooi.test"
WH = PUB + "/v1/billing/webhook/moyasar"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

# ---- the stand-in Moyasar
INV, HOOKS, AUTH, FLAGS = {}, {"wh_old": {"id": "wh_old", "url": WH, "events": ["payment_paid"]}, "wh_other": {"id": "wh_other", "url": "https://other.example/hook", "events": []}}, [], {"bad": set(), "noevents": False}
class Moy(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, d): b = json.dumps(d).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def _auth(self):
        a = self.headers.get("Authorization", ""); AUTH.append(a)
        k = base64.b64decode(a[6:]).decode()[:-1] if a.startswith("Basic ") else ""
        return k if k and k not in FLAGS["bad"] else None
    def do_GET(self):
        if self.path == "/ip": return self._send(200, {"ip": "203.0.113.7"})
        if not self._auth(): return self._send(401, {"type": "authentication_error", "message": "Invalid authorization credentials"})
        if self.path == "/v1/webhooks": return self._send(200, {"webhooks": list(HOOKS.values()), "meta": {}})
        i = self.path.rsplit("/", 1)[-1]; self._send(200, INV[i]) if i in INV else self._send(404, {"type": "not_found"})
    def do_DELETE(self):
        if not self._auth(): return self._send(401, {})
        i = self.path.rsplit("/", 1)[-1]; HOOKS.pop(i, None); self._send(200, {})
    def do_POST(self):
        k = self._auth(); n = int(self.headers.get("Content-Length") or 0); d = json.loads(self.rfile.read(n) or b"{}")
        if not k: return self._send(401, {"type": "authentication_error", "message": "Invalid authorization credentials"})
        if self.path == "/v1/webhooks":
            if FLAGS["noevents"] and "events" in d: return self._send(400, {"type": "invalid_request_error", "message": "Validation Failed", "errors": {"events": ["is invalid"]}})
            i = "wh_%d" % (len(HOOKS) + 1); HOOKS[i] = {"id": i, "url": d.get("url"), "http_method": d.get("http_method"), "events": d.get("events"), "_secret": d.get("shared_secret"), "_key": k}
            return self._send(201, {k2: v for k2, v in HOOKS[i].items() if not k2.startswith("_")})
        i = "inv_%d" % (len(INV) + 1); INV[i] = {"id": i, "status": "initiated", "amount": d["amount"], "currency": d["currency"], "metadata": d.get("metadata") or {}, "back_url": d.get("back_url"), "payments": []}
        self._send(201, {**INV[i], "url": f"http://localhost:{MPORT}/pay/{i}"})
moy = ThreadingHTTPServer(("127.0.0.1", MPORT), Moy); threading.Thread(target=moy.serve_forever, daemon=True).start()
def mine(): return [h for h in HOOKS.values() if h["url"] == WH]

D = tempfile.mkdtemp(prefix="nooi-v190-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "q" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 50, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": 1},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_", "MINIMAX_", "MOYASAR_", "PAYMENT_", "STRIPE_", "TAP_", "IP_LOOKUP"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="x" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=PUB, FREE_PERIOD="false", NV_AUTOCHECK="false",
                       PAYMENT_PROVIDER="moyasar", MOYASAR_API=f"http://localhost:{MPORT}", IP_LOOKUP_URL=f"http://localhost:{MPORT}/ip", PAY_CHECK_FIRST_MS="600000"),
                       stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
def api(p, body=None, method=None, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    class NoRedir(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a): return None
    try: r = urllib.request.build_opener(NoRedir).open(rq, timeout=60); return 200, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303): return e.code, {"loc": e.headers.get("Location", "")}
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
setup = lambda: api("/v1/admin/pay190/moyasar")[1]
def until(f, t=10):
    end = time.time() + t
    while time.time() < end:
        if f(): return True
        time.sleep(0.25)
    return False

def server_part1():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    s = setup(); out["s0"] = {k: s[k]["done"] for k in s}
    ok(s["key"]["done"] is False and s["https"]["done"] is True and s["webhook"]["done"] is False and s["live"]["done"] is False, f"no key yet: {out['s0']}")
    c, r = api("/v1/admin/pay190/moyasar/webhook", {}); ok(c == 400 and "secret key first" in r.get("error", "") and r.get("errorAr"), f"Connect before the key: {c} {r}")
    for p, b in (("/v1/admin/pay190/moyasar", None), ("/v1/admin/pay190/moyasar/webhook", {}), ("/v1/admin/pay190/moyasar/ip", {}), ("/v1/admin/pay190/moyasar/mark", {"step": "ip", "done": True})):
        ok(api(p, b, tok=TOKEN)[0] == 403, f"a customer can't use {p}")
    # the test key
    ok(api("/v1/admin/payments/moyasar", {"secretKey": "sk_test_v190"}, method="PUT")[0] == 200, "the key saves")
    s = setup(); ok(s["key"] == {"done": True, "mode": "test"}, f"step 1 test: {s['key']}")
    # connect: the old one to our address goes, the other stays, a new one with our address, events and a new secret
    c, r = api("/v1/admin/pay190/moyasar/webhook", {}); out["connect"] = {k: r.get(k) for k in ("connected", "removed", "mode", "events")}
    h = mine(); out["hooks"] = [{k: v for k, v in x.items() if k != "_secret"} for x in HOOKS.values()]
    ok(c == 200 and r.get("removed") == 1 and "wh_old" not in HOOKS and "wh_other" in HOOKS and len(h) == 1, f"connect: old removed, other kept, one new: {out}")
    ok(h and h[0]["http_method"] == "post" and h[0]["_key"] == "sk_test_v190" and set(h[0]["events"]) >= {"payment_paid", "payment_failed", "payment_refunded", "payment_voided"} and re.fullmatch(r"[0-9a-f]{48}", h[0]["_secret"] or ""), f"the new webhook: {out['hooks']}")
    SEC = h[0]["_secret"] if h else ""
    ok(SEC and SEC not in json.dumps(r) and SEC not in json.dumps(api("/v1/admin/settings")[1]) and SEC not in json.dumps(setup()), "the secret never comes back")
    s = setup(); ok(s["webhook"]["done"] and s["webhook"]["connected"] and s["webhook"]["mode"] == "test" and s["webhook"]["url"] == WH, f"step 3 done: {s['webhook']}")
    # notices: wrong then right → no refusal shown; right then wrong → refusal shown
    ok(api("/v1/billing/webhook/moyasar", {"type": "payment_failed", "secret_token": "0" * 48, "data": {"id": "pay_x"}})[0] == 401, "a wrong secret is refused")
    ok(api("/v1/billing/webhook/moyasar", {"type": "payment_failed", "secret_token": SEC, "data": {"id": "pay_x"}})[0] == 200, "the right secret is taken")
    s = setup(); ok((s["test"]["lastHook"] or {}).get("type") == "payment_failed" and s["test"]["refused"] is None, f"the last notice shown, no refusal after it: {s['test']}")
    # a test payment → step 4; the invoice carries back_url; the callback POST → 200
    c, a = api("/v1/billing/checkout", {"item": "cr800", "currency": "SAR"}); inv = a.get("url", "").rsplit("/", 1)[-1]; ref = INV[inv]["metadata"]["ref"]
    ok(INV[inv].get("back_url") == PUB + "/#account", f"the invoice has a way back: {INV[inv].get('back_url')}")
    ok(setup()["test"]["done"] is False, "step 4 waits for a payment")
    INV[inv]["status"] = "paid"
    c, r = api(f"/v1/billing/return?provider=moyasar&ref={ref}", {"id": inv, "status": "paid"}); ok(c == 200 and r.get("received"), f"the invoice callback POST: {c} {r}")
    ok(until(lambda: setup()["test"]["testPaid"] == 1), f"step 4 ticks itself after a test payment: {setup()['test']}")
    ok(setup()["test"]["done"] is True, "step 4 done")
    ok(api("/v1/billing/webhook/moyasar", {"type": "payment_paid", "secret_token": "1" * 48})[0] == 401, "wrong again")
    s = setup(); ok(s["test"]["refused"] and s["test"]["refused"]["at"] > s["test"]["lastHook"]["at"], f"a refusal after the last notice is shown: {s['test']}")
    ok(s["ip"]["done"] is False and s["live"]["done"] is False, "steps 5 and 6 not done yet")

def server_part2():
    # the live key: step 6 done, step 3 asks again; connect again → live
    ok(api("/v1/admin/payments/moyasar", {"secretKey": "sk_live_v190"}, method="PUT")[0] == 200, "the live key saves")
    s = setup(); ok(s["live"]["done"] and s["key"]["mode"] == "live" and s["webhook"]["done"] is False and s["webhook"]["mode"] == "test", f"live: step 3 asks again: {s['webhook']}")
    c, r = api("/v1/admin/pay190/moyasar/webhook", {}); h = mine()
    ok(c == 200 and r.get("mode") == "live" and r.get("removed") == 1 and len(h) == 1 and h[0]["_key"] == "sk_live_v190", f"connect again for live: {c} {r} {len(h)}")
    ok(setup()["webhook"]["done"] and setup()["webhook"]["mode"] == "live", "step 3 done for live")
    # an event list Moyasar doesn't take → all events
    FLAGS["noevents"] = True; c, r = api("/v1/admin/pay190/moyasar/webhook", {}); FLAGS["noevents"] = False; h = mine()
    ok(c == 200 and r.get("events") == "all" and len(h) == 1 and h[0]["events"] is None, f"events refused → all events: {c} {r}")
    # a key Moyasar refuses
    FLAGS["bad"].add("sk_live_v190"); c, r = api("/v1/admin/pay190/moyasar/webhook", {}); FLAGS["bad"].discard("sk_live_v190")
    ok(c == 400 and "didn't accept the secret key" in r.get("error", "") and "API Keys" in r.get("errorAr", ""), f"a refused key: {c} {r}")
    out["final"] = {k: v["done"] for k, v in setup().items()}
    ok(all(out["final"].values()), f"all six done at the end: {out['final']}")

async def page_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"; R_ = {}
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate
    async def look():
        return await E("""()=>{const b=document.querySelector('.mset190'),W=innerWidth;if(!b||!b.querySelector('.m190l'))return null;return {open:b.open,count:b.querySelector('.m190p').innerText,
          done:[...b.querySelectorAll('.m190l>li')].map(l=>l.classList.contains('done190')),text:b.innerText.replace(/\\s+/g,' '),ip:(b.querySelector('#ip190')||{}).textContent||'',
          btns:[...b.querySelectorAll('[data-act^="m190-"]')].map(x=>x.dataset.act+':'+x.innerText.trim()),wide:[...b.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>W+1||r.left<-1)}).length}}""")
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=S.user||{{name:'Owner',method:'email',contact:'owner@nooi.ai'}};S.admTab='payments';persist();go('admin')}}")
        await pg.wait_for_function("!!document.querySelector('.mset190 .m190l')", timeout=20000); await pg.wait_for_timeout(500)
        v = await look(); R_["start"] = {k: v[k] for k in ("count", "done", "ip", "wide", "open")}; R_["btns"] = v["btns"]
        want = [True, True, True, True, ar, False]   # (the phone run ticks step 5; the computer run starts with it ticked)
        ok(v["open"] and v["done"] == want and v["count"] == f"{sum(want)} / 6" and not v["wide"], f"{tag}: the checklist: {R_}")
        t = v["text"]
        ok(("ميسّر — الإعداد خطوة بخطوة" in t and "IP Whitelist" in t and "متصل في حسابك على ميسّر" in t and "اتصل مجدداً" in t) if ar else ("Moyasar — set up step by step" in t and "Connected in your Moyasar account (test)" in t and "Settings → IP Whitelist" in t and "Connect again" in t), f"{tag}: the words: {t[:400]}")
        ok("sk_test_v190" not in await E("()=>document.documentElement.outerHTML+JSON.stringify(A())"), f"{tag}: no key on the page")
        if not ar:
            await pg.click('.mset190 [data-act="m190-ip"]'); await pg.wait_for_function("!!document.querySelector('.mset190 #ip190')", timeout=10000)
            await pg.click('.mset190 [data-act="m190-ipdone"]'); await pg.wait_for_function("document.querySelectorAll('.mset190 .m190l>li')[4].classList.contains('done190')", timeout=10000)
            v = await look(); R_["after"] = {k: v[k] for k in ("count", "done", "ip")}
            ok(v["ip"] == "203.0.113.7" and v["count"] == "5 / 6" and v["done"][4], f"{tag}: find the address, tick it: {R_['after']}")
        else:
            await pg.click('.mset190 [data-act="m190-ipdone"]'); await pg.wait_for_function("!document.querySelectorAll('.mset190 .m190l>li')[4].classList.contains('done190')", timeout=10000)
            v = await look(); R_["after"] = {k: v[k] for k in ("count", "done", "ip")}
            ok(v["count"] == "4 / 6" and not v["done"][4] and v["ip"] == "203.0.113.7", f"{tag}: untick: {R_['after']}")
            await pg.click('.mset190 [data-act="m190-ipdone"]'); await pg.wait_for_function("document.querySelectorAll('.mset190 .m190l>li')[4].classList.contains('done190')", timeout=10000)
        await pg.screenshot(path=D + f"/{tag}.png", full_page=False)
        ok(not errs, f"{tag}: page errors {errs[:3]}")
    finally:
        out[tag] = R_; await br.close()

async def pages():
    async with async_playwright() as p:
        await page_part(p, True, "en")
        await page_part(p, False, "ar")

try:
    server_part1()
    asyncio.run(pages())
    server_part2()
finally:
    srv.terminate(); srv.wait(); moy.shutdown()
print(json.dumps(out, ensure_ascii=False, indent=1)[:4000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + "/server.log").read()[-2000:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v190 OK")
