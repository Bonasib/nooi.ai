# v189 — "how do I make sure payments are safe" (Moyasar). A real nooi server and a stand-in Moyasar (MOYASAR_API):
#  · replay: a customer pays order A, opens order B of the same price and comes back with A's paid invoice (?id=) → B stays unpaid;
#    a forged webhook that names A's invoice for B → B stays unpaid (the server only checks the invoice it made for the order)
#  · an invoice whose metadata names another order → refused; one provider payment pays one order only (paid189)
#  · the webhook: with a secret token saved in Admin, a wrong token → 401 and nothing done; the right token + only the invoice id
#    (no reference) → the order is found and credited
#  · a paid checkout whose customer never came back and whose webhook never arrived → credited by the server's own check
#    (not the ones older than 2 days); a refund (webhook payment_refunded) → the credits taken back with a line in the history
#  · Admin's settings say whether a webhook secret is saved and whether the key is a test key — never the keys; customers can't save keys
#  · the page (phone in English, computer in Arabic): Admin → Payments, the Moyasar card has the secret token field, the full webhook
#    address to copy, "Webhook secret saved" and the test-key warning
# Run: python3 tests/v189.py
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, tempfile, threading, time, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8641; MPORT = 8642; B = f"http://localhost:{PORT}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

# ---- the stand-in Moyasar: invoices kept here, their state changed by the test
INV, AUTH = {}, []
class Moy(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, d): b = json.dumps(d).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        AUTH.append(self.headers.get("Authorization", "")); n = int(self.headers.get("Content-Length") or 0); d = json.loads(self.rfile.read(n) or b"{}")
        i = "inv_%d" % (len(INV) + 1); INV[i] = {"id": i, "status": "initiated", "amount": d["amount"], "currency": d["currency"], "metadata": d.get("metadata") or {}, "payments": []}
        self._send(201, {**INV[i], "url": f"http://localhost:{MPORT}/pay/{i}"})
    def do_GET(self):
        AUTH.append(self.headers.get("Authorization", "")); i = self.path.rsplit("/", 1)[-1]
        self._send(200, INV[i]) if i in INV else self._send(404, {"type": "not_found"})
moy = ThreadingHTTPServer(("127.0.0.1", MPORT), Moy); threading.Thread(target=moy.serve_forever, daemon=True).start()
def paid(i, ref=None):
    INV[i]["status"] = "paid"; INV[i]["payments"] = [{"id": "pay_" + i, "status": "paid", "amount": INV[i]["amount"]}]
    if ref is not None: INV[i]["metadata"] = {"ref": ref}

D = tempfile.mkdtemp(prefix="nooi-v189-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "p" * 32; NOW = int(time.time() * 1000)
# orders made before this run: one paid but never came back (5 minutes ago), one too old (3 days), two sharing one invoice
pend = lambda ref, inv, age: {"ref": ref, "item": "cr800", "amount": 12345, "currency": "SAR", "status": "pending", "created": NOW - age, "providerId": inv, "provider": "moyasar"}
for i, r in (("inv_seed", "seed189"), ("inv_old", "old189")): INV[i] = {"id": i, "status": "paid", "amount": 12345, "currency": "SAR", "metadata": {"ref": r}, "payments": []}
INV["inv_dup"] = {"id": "inv_dup", "status": "paid", "amount": 12345, "currency": "SAR", "metadata": {}, "payments": []}
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
    "payments": {"seed189": pend("seed189", "inv_seed", 5 * 60e3), "old189": pend("old189", "inv_old", 72 * 3600e3), "dupA": pend("dupA", "inv_dup", 10e3), "dupB": pend("dupB", "inv_dup", 10e3)}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 50, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": 1},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_", "MINIMAX_", "MOYASAR_", "PAYMENT_", "STRIPE_", "TAP_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="w" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false",
                       PAYMENT_PROVIDER="moyasar", MOYASAR_SECRET_KEY="sk_test_v189", MOYASAR_API=f"http://localhost:{MPORT}", PAY_CHECK_FIRST_MS="4000"),
                       stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
def api(p, body=None, method=None, tok=None, follow=True):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    class NoRedir(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a): return None
    op = urllib.request.build_opener(NoRedir)
    try: r = op.open(rq, timeout=60); t = r.read(); return 200, json.loads(t or b"{}")
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303): return e.code, {"loc": e.headers.get("Location", "")}
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
credits = lambda: api("/v1/billing")[1].get("credits")
def pay(ref): return api(f"/v1/billing/return?provider=moyasar&ref={ref}")[1].get("loc", "")
def state(ref): time.sleep(0.5); return json.load(open(D + "/data/db.json"))["users"]["local"]["payments"].get(ref, {})   # (the data file is written 0.2 s after a change)
def until(f, t=15):
    end = time.time() + t
    while time.time() < end:
        if f(): return True
        time.sleep(0.25)
    return False

def server_part():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    # 0. the server's own check a few seconds after start: the paid order that never came back is credited; the 3-day-old one isn't
    ok(until(lambda: state("seed189").get("status") == "paid", 20), f"the check should credit the paid order that never came back: {state('seed189')}")
    ok(state("old189").get("status") == "pending", "an order older than 2 days isn't checked")
    b0 = credits(); out["start"] = b0
    # 1. order A paid normally
    c, a = api("/v1/billing/checkout", {"item": "cr800", "currency": "SAR"}); invA = a.get("url", "").rsplit("/", 1)[-1]; refA = INV[invA]["metadata"]["ref"]
    ok(c == 200 and invA in INV and AUTH[-1] == "Basic " + base64.b64encode(b"sk_test_v189:").decode(), f"checkout → a Moyasar invoice with the secret key: {c} {a}")
    paid(invA); loc = pay(refA); ok("paid=1" in loc and credits() == b0 + 800, f"order A paid: {loc} {credits()} vs {b0 + 800}")
    # 2. replay: order B, same price, unpaid — coming back with A's paid invoice
    c, bb = api("/v1/billing/checkout", {"item": "cr800", "currency": "SAR"}); invB = bb.get("url", "").rsplit("/", 1)[-1]; refB = INV[invB]["metadata"]["ref"]
    loc = api(f"/v1/billing/return?provider=moyasar&ref={refB}&id={invA}")[1].get("loc", "")
    ok("paid=0" in loc and credits() == b0 + 800 and state(refB).get("status") == "pending", f"replay with A's invoice must not pay B: {loc} {credits()}")
    # 3. a forged webhook naming A's paid invoice for B
    c, w = api("/v1/billing/webhook/moyasar", {"type": "payment_paid", "data": {"id": "pay_" + invA, "invoice_id": invA, "status": "paid", "metadata": {"ref": refB}}})
    time.sleep(1); ok(c == 200 and credits() == b0 + 800 and state(refB).get("status") == "pending", f"a forged webhook must not pay B: {c} {credits()}")
    # 4. B's own invoice paid but saying it belongs to another order → refused; then right → paid
    paid(invB, ref=refA); pay(refB); ok(state(refB).get("status") == "pending" and credits() == b0 + 800, "an invoice of another order is refused")
    INV[invB]["metadata"] = {"ref": refB}; loc = pay(refB); ok("paid=1" in loc and credits() == b0 + 1600, f"B paid with its own invoice: {loc}")
    # 5. one payment, one order
    pay("dupA"); pay("dupB"); out["dup"] = [state("dupA").get("status"), state("dupB").get("status")]
    ok(out["dup"] == ["paid", "pending"] and credits() == b0 + 2400, f"one provider payment pays one order only: {out['dup']} {credits()}")
    # 6. Admin: no secret yet, a test key; save the secret; customers can't
    pm = api("/v1/admin/settings")[1].get("payments", {}).get("moyasar", {}); out["adm0"] = pm
    ok(pm.get("configured") and pm.get("test") is True and pm.get("webhookSecret") is False and "sk_test" not in json.dumps(pm), f"Admin: test key flagged, no secret yet, no key shown: {pm}")
    ok(api("/v1/admin/payments/moyasar", {"webhookSecret": "x" * 20}, method="PUT", tok=TOKEN)[0] == 403, "a customer can't save payment keys")
    SEC = "whsec_v189_" + "k" * 24
    ok(api("/v1/admin/payments/moyasar", {"webhookSecret": SEC}, method="PUT")[0] == 200 and api("/v1/admin/settings")[1]["payments"]["moyasar"].get("webhookSecret") is True, "the webhook secret saves")
    ok(SEC not in json.dumps(api("/v1/admin/settings")[1]), "the secret never comes back")
    # 7. the webhook with the secret: wrong → 401; right with only the invoice id → the order found and paid
    c, cc = api("/v1/billing/checkout", {"item": "cr800", "currency": "SAR"}); invC = cc.get("url", "").rsplit("/", 1)[-1]; refC = INV[invC]["metadata"]["ref"]; paid(invC)
    c1 = api("/v1/billing/webhook/moyasar", {"type": "payment_paid", "secret_token": "wrong" + SEC[5:], "data": {"id": "pay_" + invC, "invoice_id": invC, "status": "paid"}})[0]
    c2 = api("/v1/billing/webhook/moyasar", {"type": "payment_paid", "data": {"id": "pay_" + invC, "invoice_id": invC, "status": "paid"}})[0]
    time.sleep(0.8); ok(c1 == 401 and c2 == 401 and state(refC).get("status") == "pending", f"a wrong or missing secret → 401 and nothing done: {c1} {c2}")
    c3 = api("/v1/billing/webhook/moyasar", {"type": "payment_paid", "secret_token": SEC, "data": {"id": "pay_" + invC, "invoice_id": invC, "status": "paid"}})[0]
    ok(c3 == 200 and until(lambda: state(refC).get("status") == "paid") and credits() == b0 + 3200, f"the right secret + the invoice id → C paid: {c3} {state(refC).get('status')} {credits()}")
    # 8. a refund of A → the credits taken back, a line in the history; a second refund webhook changes nothing
    INV[invA]["status"] = "refunded"; INV[invA]["payments"][0]["status"] = "refunded"
    api("/v1/billing/webhook/moyasar", {"type": "payment_refunded", "secret_token": SEC, "data": {"id": "pay_" + invA, "invoice_id": invA, "status": "refunded"}})
    ok(until(lambda: credits() == b0 + 2400), f"a refund takes the 800 credits back: {credits()} vs {b0 + 2400}")
    api("/v1/billing/webhook/moyasar", {"type": "payment_refunded", "secret_token": SEC, "data": {"id": "pay_" + invA, "invoice_id": invA, "status": "refunded"}}); time.sleep(0.8)
    time.sleep(0.5); led = json.load(open(D + "/data/db.json"))["users"]["local"]["ledger"]; out["refundLine"] = [l["reason"] for l in led if "refunded" in l["reason"]]
    ok(credits() == b0 + 2400 and len(out["refundLine"]) == 1 and state(refA).get("refunded"), f"one refund line, once: {out['refundLine']}")
    out["credits"] = credits()

async def page_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"; R_ = {}
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=S.user||{{name:'Owner',method:'email',contact:'owner@nooi.ai'}};S.admTab='payments';persist();go('admin')}}")
        await pg.wait_for_function("!!document.querySelector('#wh189-moyasar')&&((A().payments||{}).moyasar||{}).configured", timeout=20000); await pg.wait_for_timeout(400)   # (Admin's settings loaded)
        v = await E("""()=>{const box=document.querySelector('#wh189-moyasar').closest('.provc'),W=innerWidth;return {wh:document.querySelector('#wh189-moyasar').textContent,
          secret:!!box.querySelector('input[data-pp="moyasar"][data-fl="webhookSecret"][type="password"]'),text:box.innerText.replace(/\\s+/g,' '),
          copy:!!box.querySelector('[data-act="copy"][data-t="wh189-moyasar"]'),wide:[...box.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>W+1||b.left<-1)}).length}}""")
        R_.update({k: v[k] for k in ("wh", "secret", "copy", "wide")}); R_["text"] = v["text"][:300]
        ok(v["wh"] == B + "/v1/billing/webhook/moyasar" and v["secret"] and v["copy"] and not v["wide"], f"{tag}: Moyasar card — secret field, full webhook address with Copy, fits: {R_}")
        t = v["text"]
        ok((("سرّ الإشعارات محفوظ" in t and "مفتاح تجريبي محفوظ" in t and "Webhooks" in t) if ar else ("Webhook secret saved" in t and "Test key saved" in t and "Settings → Webhooks" in t)), f"{tag}: secret saved + test-key warning + where to paste: {t}")
        ok("sk_test" not in await E("()=>document.body.innerHTML"), f"{tag}: the key is never on the page")
        await pg.screenshot(path=D + f"/{tag}.png", full_page=False)
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
    srv.terminate(); srv.wait(); moy.shutdown()
print(json.dumps(out, ensure_ascii=False, indent=1)[:4000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + "/server.log").read()[-2000:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v189 OK")
