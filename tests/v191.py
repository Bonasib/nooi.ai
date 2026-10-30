# v191 — the owner's screenshots of Admin → Payments: a giant warning sign, "Test key saved" on PayPal and Airwallex with no keys,
# long loose forms; "arrange it with icons and check the missing options against the official sources". A real nooi server and a
# stand-in PayPal (PAYPAL_API: token + verify-webhook-signature):
#  · nothing saved → no provider is "in test mode" (even with PAYPAL_MODE=sandbox, AIRWALLEX_ENV=demo on the server)
#  · PayPal keys → test (sandbox) until Live is chosen; Airwallex keys → test (demo); the Webhook ID / webhook secret flags
#  · Stripe signing secret: a right Stripe-Signature → taken; wrong, too old → 401; two v1 values (secret rotation) → taken
#  · Airwallex webhook secret: x-timestamp + x-signature right → taken; wrong → 401
#  · PayPal Webhook ID: PayPal says SUCCESS → taken (the webhook ID and the event sent to it); FAILURE → 401
#  · Tap (nothing to save) → taken; the last notice taken / refused per provider (customers can't read it)
#  · the page, light theme (phone in English, computer in Arabic): two groups, five rows with their marks, Moyasar open with its steps,
#    no icon bigger than 40 px, no test warning on a provider with no keys, PayPal's Sandbox/Live choice, what is typed survives a redraw
# Run: python3 tests/v191.py
import asyncio, hashlib, hmac, json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8645; PPORT = 8646; B = f"http://localhost:{PORT}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

PP = []   # what the stand-in PayPal was asked to verify
class Pay(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, d): b = json.dumps(d).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); raw = self.rfile.read(n)
        if self.path == "/v1/oauth2/token": return self._send(200, {"access_token": "A21-test"})
        if self.path == "/v1/notifications/verify-webhook-signature":
            d = json.loads(raw or b"{}"); PP.append(d)
            return self._send(200, {"verification_status": "SUCCESS" if d.get("transmission_sig") == "good" and d.get("webhook_id") == "WH-191" else "FAILURE"})
        self._send(404, {})
pay = ThreadingHTTPServer(("127.0.0.1", PPORT), Pay); threading.Thread(target=pay.serve_forever, daemon=True).start()

D = tempfile.mkdtemp(prefix="nooi-v191-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "s" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 50, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": 1},
    "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 100000}]}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_", "MINIMAX_", "MOYASAR_", "PAYMENT_", "STRIPE_", "TAP_", "PAYPAL_", "AIRWALLEX_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="y" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false",
                       PAYPAL_MODE="sandbox", AIRWALLEX_ENV="demo", PAYPAL_API=f"http://localhost:{PPORT}", PAY_CHECK_FIRST_MS="600000"),
                       stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
def api(p, body=None, method=None, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=60).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def hook(prov, raw, headers):
    rq = urllib.request.Request(B + "/v1/billing/webhook/" + prov, data=raw, headers={"Content-Type": "application/json", **headers}, method="POST")
    try: return urllib.request.urlopen(rq, timeout=60).status
    except urllib.error.HTTPError as e: return e.code
pays = lambda: api("/v1/admin/settings")[1].get("payments", {})
hm = lambda key, s: hmac.new(key.encode(), s.encode(), hashlib.sha256).hexdigest()

def server_part():
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    p = pays(); out["p0"] = {k: [v.get("test"), v.get("mode")] for k, v in p.items()}
    ok(all(v.get("test") is False and v.get("mode") is None and v.get("configured") is False for v in p.values()), f"nothing saved → nobody in test mode: {out['p0']}")
    # PayPal: keys → sandbox (test); Live chosen → live; the Webhook ID flag
    ok(api("/v1/admin/payments/paypal", {"clientId": "AYid191", "secret": "EOsec191"}, method="PUT")[0] == 200, "PayPal keys save")
    ok(pays()["paypal"]["mode"] == "test" and pays()["paypal"]["test"] is True and pays()["paypal"]["webhookSecret"] is False, f"PayPal sandbox: {pays()['paypal']}")
    api("/v1/admin/payments/paypal", {"mode": "live", "webhookId": "WH-191"}, method="PUT")
    ok(pays()["paypal"]["mode"] == "live" and pays()["paypal"]["webhookSecret"] is True, f"PayPal live + webhook ID: {pays()['paypal']}")
    # Airwallex: demo by default; the webhook secret
    api("/v1/admin/payments/airwallex", {"clientId": "cid191", "apiKey": "ak191", "webhookSecret": "aw_secret_191"}, method="PUT")
    ok(pays()["airwallex"]["mode"] == "test" and pays()["airwallex"]["webhookSecret"] is True, f"Airwallex demo + secret: {pays()['airwallex']}")
    # Stripe: the signing secret
    WS = "whsec_v191_" + "z" * 20
    api("/v1/admin/payments/stripe", {"secretKey": "sk_test_v191", "webhookSecret": WS}, method="PUT")
    ok(pays()["stripe"]["mode"] == "test" and pays()["stripe"]["webhookSecret"] is True, f"Stripe test + secret: {pays()['stripe']}")
    s = json.dumps(api("/v1/admin/settings")[1]); ok(WS not in s and "aw_secret_191" not in s and "WH-191" not in s and "EOsec191" not in s, "no secret comes back")
    raw = json.dumps({"id": "evt_1", "type": "checkout.session.completed", "data": {"object": {"id": "cs_none", "client_reference_id": "nope"}}}, separators=(", ", ": ")).encode()
    t = int(time.time())
    c1 = hook("stripe", raw, {"Stripe-Signature": f"t={t},v1={hm(WS, f'{t}.' + raw.decode())}"})
    c2 = hook("stripe", raw, {"Stripe-Signature": f"t={t},v1={hm('whsec_other', f'{t}.' + raw.decode())}"})
    c3 = hook("stripe", raw, {"Stripe-Signature": f"t={t - 900},v1={hm(WS, f'{t - 900}.' + raw.decode())}"})
    c5 = hook("stripe", raw, {})
    c4 = hook("stripe", raw, {"Stripe-Signature": f"t={t},v1={'0' * 64},v1={hm(WS, f'{t}.' + raw.decode())}"})
    out["stripe"] = [c1, c2, c3, c5, c4]
    ok(out["stripe"] == [200, 401, 401, 401, 200], f"Stripe signatures (right, wrong, old, none, rotated): {out['stripe']}")
    # Airwallex
    raw = json.dumps({"id": "evt_aw", "name": "payment_intent.succeeded", "data": {"object": {"id": "int_none", "merchant_order_id": "nope"}}}).encode(); ts = str(int(time.time() * 1000))
    a1 = hook("airwallex", raw, {"x-timestamp": ts, "x-signature": hm("aw_secret_191", ts + raw.decode())})
    a2 = hook("airwallex", raw, {"x-timestamp": ts, "x-signature": hm("aw_other", ts + raw.decode())})
    a3 = hook("airwallex", raw, {"x-timestamp": str(int(ts) - 900000), "x-signature": hm("aw_secret_191", str(int(ts) - 900000) + raw.decode())})
    out["airwallex"] = [a1, a2, a3]; ok(out["airwallex"] == [200, 401, 401], f"Airwallex signatures (right, wrong, old): {out['airwallex']}")
    # PayPal — PayPal itself says yes or no
    raw = json.dumps({"id": "WH-EVT", "event_type": "CHECKOUT.ORDER.APPROVED", "resource": {"id": "ORDER-NONE", "purchase_units": [{"custom_id": "nope"}]}}).encode()
    H = {"paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.paypal.com/cert", "paypal-transmission-id": "tid", "paypal-transmission-time": "2026-10-30T00:00:00Z"}
    p1 = hook("paypal", raw, {**H, "paypal-transmission-sig": "good"}); p2 = hook("paypal", raw, {**H, "paypal-transmission-sig": "bad"})
    out["paypal"] = [p1, p2, len(PP)]
    ok([p1, p2] == [200, 401] and PP and PP[0].get("webhook_id") == "WH-191" and PP[0].get("webhook_event", {}).get("event_type") == "CHECKOUT.ORDER.APPROVED" and PP[0].get("transmission_id") == "tid", f"PayPal verification: {out['paypal']} {PP[:1]}")
    # Tap — nothing to save, taken
    ok(hook("tap", json.dumps({"id": "chg_none", "status": "CAPTURED"}).encode(), {}) == 200, "Tap notice taken")
    # the last notices
    c, h = api("/v1/admin/pay191/hooks"); out["hooks"] = {k: [bool(v.get("ok")), bool(v.get("refused"))] for k, v in h.items()}
    ok(c == 200 and h["stripe"]["ok"]["checked"] and h["stripe"]["refused"] and h["paypal"]["ok"]["type"] == "CHECKOUT.ORDER.APPROVED" and h["tap"]["ok"]["checked"] is False, f"last notices: {h}")
    ok(api("/v1/admin/pay191/hooks", tok=TOKEN)[0] == 403, "customers can't read the notices")

async def page_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"; R_ = {}
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone, color_scheme="light")
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); E = pg.evaluate
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';S.theme='light';applyTheme();document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=S.user||{{name:'Owner',method:'email',contact:'owner@nooi.ai'}};S.admTab='payments';persist();go('admin')}}")
        await pg.wait_for_function("!!document.querySelector('.pay191 .p191row')&&((A().payments||{}).paypal||{}).configured", timeout=20000); await pg.wait_for_timeout(600)
        v = await E("""()=>{const s=document.querySelector('.pay191'),W=innerWidth,rows=[...s.querySelectorAll('.p191row')];return {
          groups:[...s.querySelectorAll('.p191gh')].map(x=>x.innerText.trim()),rows:rows.map(r=>[r.dataset.k,r.dataset.open,r.querySelector('.p191logo').innerText,r.querySelector('.p191pill').innerText.trim()]),
          big:[...document.querySelectorAll('.pay191 svg')].filter(x=>{const b=x.getBoundingClientRect();return b.width>40||b.height>40}).length,
          steps:!!s.querySelector('.p191row[data-k="moyasar"] .p191body:not([hidden]) .mset190'),tapWarn:!!s.querySelector('#p191b-tap .p191warn'),moyWarn:!!s.querySelector('#p191b-moyasar .p191warn'),
          wide:[...s.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>W+1||b.left<-1)}).length,sum:s.querySelector('.p191sum').innerText}}""")
        R_.update(v)
        ok(v["groups"] == (["السعودية والخليج", "حول العالم"] if ar else ["SAUDI ARABIA & THE GULF", "WORLDWIDE"]) and [r[0] for r in v["rows"]] == ["moyasar", "tap", "stripe", "paypal", "airwallex"], f"{tag}: two groups, five rows: {v['groups']} {v['rows']}")
        pills = {r[0]: r[3] for r in v["rows"]}
        want = {"moyasar": "غير مُعد", "tap": "غير مُعد", "stripe": "وضع تجريبي", "paypal": "حقيقي", "airwallex": "وضع تجريبي"} if ar else {"moyasar": "Not set", "tap": "Not set", "stripe": "Test mode", "paypal": "Live", "airwallex": "Test mode"}
        ok(pills == want and [r[2] for r in v["rows"]] == ["M", "T", "S", "P", "A"] and v["rows"][0][1] == "true", f"{tag}: marks and states: {pills}")
        ok(v["big"] == 0 and v["steps"] and not v["tapWarn"] and not v["moyWarn"] and not v["wide"], f"{tag}: no giant icon, Moyasar's steps inside, no test warning without keys, fits: {v}")
        # PayPal: open, Live chosen, Sandbox → the hidden value; the Webhook ID field; the address
        await pg.click('.p191row[data-k="paypal"] .p191head'); await pg.wait_for_selector('#p191b-paypal:not([hidden])', timeout=5000)
        m = await E("""()=>{const b=document.querySelector('#p191b-paypal');return {on:b.querySelector('.seg191 .on').dataset.v,hid:b.querySelector('input[type=hidden][data-fl=mode]').value,
          wid:!!b.querySelector('input[data-pp=paypal][data-fl=webhookId]'),wh:(b.querySelector('#wh189-paypal')||{}).textContent,txt:b.innerText.replace(/\\s+/g,' ')}}""")
        await pg.click('#p191b-paypal .seg191 [data-v="sandbox"]')
        m2 = await E("()=>{const b=document.querySelector('#p191b-paypal');return [b.querySelector('.seg191 .on').dataset.v,b.querySelector('input[type=hidden][data-fl=mode]').value]}")
        R_["paypal"] = {k: m[k] for k in ("on", "hid", "wid", "wh")}; R_["paypal2"] = m2
        ok(m["on"] == "live" and m["hid"] == "live" and m2 == ["sandbox", "sandbox"] and m["wid"] and m["wh"] == B + "/v1/billing/webhook/paypal" and ("معرّف الإشعارات محفوظ" in m["txt"] if ar else "Webhook ID saved" in m["txt"]), f"{tag}: PayPal mode choice, Webhook ID field, address: {R_['paypal']} {m2}")
        # what is typed survives a redraw
        await pg.click('.p191row[data-k="stripe"] .p191head'); await pg.fill('#p191b-stripe input[data-fl="secretKey"]', "sk_test_typed191")
        await E("()=>renderView()"); await pg.wait_for_timeout(300)
        kept = await E("()=>{const i=document.querySelector('#p191b-stripe input[data-fl=\"secretKey\"]');return i?i.value:null}")
        ok(kept == "sk_test_typed191", f"{tag}: the typed key survives a redraw: {kept}")
        await pg.evaluate("()=>{const i=document.querySelector('#p191b-stripe input[data-fl=\"secretKey\"]');i.value='';PAY191.typed={}}")
        n = await E("()=>document.querySelector('#p191n-stripe').innerText.replace(/\\s+/g,' ')"); R_["stripeNotes"] = n[:200]
        ok(("آخر إشعار" in n and "رُفض إشعار" not in n) if ar else ("Last notice" in n and "was refused" not in n), f"{tag}: Stripe's last notice: {n[:200]}")
        await pg.evaluate("()=>document.querySelector('.pay191').scrollIntoView()"); await pg.screenshot(path=D + f"/{tag}.png", full_page=False)
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
    srv.terminate(); srv.wait(); pay.shutdown()
print(json.dumps(out, ensure_ascii=False, indent=1)[:4000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + "/server.log").read()[-2000:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v191 OK")
