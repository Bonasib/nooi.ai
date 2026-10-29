# v182 — Coming soon: nooi.ai for the team only. A real nooi server (and a stand-in mail server):
#  · the mode: open by default on this computer, "soon" by default on a real web address, NOOI_LAUNCH wins over Admin's switch
#  · Coming soon: a customer outside the team can only see who they are, write to support and delete their account — making,
#    their library and the AI connection (MCP) are refused (403, nothing charged); the owner and the team the owner added (with
#    their role) use everything; giving access lets the customer in at once, removing it closes the door again
#  · a new account is kept in Registrations and the owners (ADMIN_EMAILS) get an email at once; staff with admins.manage see how
#    many registered since they last looked; only admins.manage can switch the mode
#  · the page (phone in English, computer in Arabic): a visitor sees the Coming soon page (the features, the nine agents, Register,
#    Team sign in) and nothing of the site behind it; Register opens sign-in with a note; a registered customer sees "You're
#    registered", the page asks the server nothing else and shows no notes; access given → the site opens with a welcome;
#    Admin → Admins & permissions: Site access switch (opening asks twice), Registrations with a role and Give access, a count on Admin
# Run: python3 tests/v182.py
import asyncio, email, email.policy, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, MP, SP = 8584, 8585, 8586; B = f"http://localhost:{PORT}"; M = f"http://localhost:{MP}"
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)

D = tempfile.mkdtemp(prefix="nooi-v182-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN, TOKEN2 = "nooi_" + "c" * 32, "nooi_" + "n" * 32; now = int(time.time() * 1000)
tk = lambda t, i: [{"id": i, "name": "t", "hash": hashlib.sha256(t.encode()).hexdigest(), "last4": t[-4:], "created": 1, "dailyCap": 100000}]
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": now - 3600e3, "email": "sara@example.com", "emailVerified": True, "country": "SA"}, "tokens": tk(TOKEN, "tk")},
  "omar": {"plan": "free", "credits": 100, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "profile": {"created": now - 7200e3, "email": "omar@example.com", "emailVerified": True}},
  "newbie": {"plan": "free", "credits": 0, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": tk(TOKEN2, "tn")}}}, open(D + "/data/db.json", "w"))
MOCK = r"""
const http=require('http'),net=require('net');const P=+process.argv[2],SPORT=+process.argv[3];const st={mail:[]};
http.createServer((q,s)=>{s.setHeader('content-type','application/json');s.end(JSON.stringify(st))}).listen(P);
// a stand-in mail server (SMTP): every message is kept
net.createServer(c=>{let buf='',data=false,cur={to:[]};const w=x=>c.write(x+'\r\n');w('220 mock');
 c.on('data',d=>{buf+=d.toString('utf8');let i;
  while(true){if(data){const e=buf.indexOf('\r\n.\r\n');if(e<0)return;cur.data=buf.slice(0,e);buf=buf.slice(e+5);data=false;st.mail.push(cur);cur={to:[]};w('250 queued');continue}
   if((i=buf.indexOf('\r\n'))<0)return;const line=buf.slice(0,i);buf=buf.slice(i+2);const u=line.toUpperCase();
   if(u.startsWith('EHLO'))w('250-mock\r\n250-AUTH PLAIN LOGIN\r\n250 OK');else if(u.startsWith('HELO'))w('250 mock');
   else if(u.startsWith('AUTH PLAIN'))w('235 ok');else if(u.startsWith('AUTH LOGIN')){w('334 VXNlcm5hbWU6');cur.login=1}
   else if(cur.login===1){cur.login=2;w('334 UGFzc3dvcmQ6')}else if(cur.login===2){delete cur.login;w('235 ok')}
   else if(u.startsWith('MAIL FROM'))w('250 ok');else if(u.startsWith('RCPT TO')){cur.to.push(line.replace(/^RCPT TO:\s*/i,'').replace(/[<>]/g,''));w('250 ok')}
   else if(u==='DATA'){data=true;w('354 go')}else if(u==='QUIT'){w('221 bye');c.end()}else if(u==='RSET'){cur={to:[]};w('250 ok')}else w('250 ok')}})}).listen(SPORT);
"""
open(D + "/mock.js", "w").write(MOCK)
mk = subprocess.Popen(["node", D + "/mock.js", str(MP), str(SP)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_", "EMAIL_", "SMTP_", "ADMIN_EMAILS"))}
BASE = dict(env, SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false", MIRROR_MEDIA="false", NV_AUTOCHECK="false")
def start(port, cwd, **kw):
    return subprocess.Popen(["node", ROOT + "/server.js"], cwd=cwd, env=dict(BASE, PORT=str(port), **kw), stdout=subprocess.DEVNULL, stderr=open(cwd + f"/server{port}.log", "w"))
srv = start(PORT, D, PUBLIC_BASE_URL=B, ADMIN_EMAILS="boss@nooi.ai", EMAIL_PROVIDER="smtp", SMTP_HOST="localhost", SMTP_PORT=str(SP), SMTP_USER="mock", SMTP_PASS="mock")

def api(p, body=None, method=None, tok=None, base=B):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    rq = urllib.request.Request(base + p, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try: return 200, json.loads(urllib.request.urlopen(rq, timeout=60).read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def mails(): return json.loads(urllib.request.urlopen(M + "/", timeout=10).read())["mail"]
def up(base):
    for _ in range(80):
        try: urllib.request.urlopen(base + "/v1/health", timeout=2); return True
        except Exception: time.sleep(0.25)
    return False
def mcp(tok):
    try: return urllib.request.urlopen(urllib.request.Request(B + "/mcp?token=" + tok, data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}).encode(), headers={"content-type": "application/json"}), timeout=20).status
    except urllib.error.HTTPError as e: return e.code

def server_part():
    ok(up(B), "the server didn't start")
    # this computer (localhost) → open by default; the customer uses everything
    c, cfg = api("/v1/config"); ok(cfg.get("launch182") == "open", f"localhost should be open by default: {cfg.get('launch182')}")
    ok(api("/v1/jobs", tok=TOKEN)[0] == 200, "open: the customer's library should answer")
    ok(api("/v1/admin/launch", {"mode": "soon"}, method="PUT", tok=TOKEN)[0] == 403, "a customer must not switch the mode")
    c, r = api("/v1/admin/launch", {"mode": "soon"}, method="PUT"); ok(c == 200 and r.get("mode") == "soon", f"the owner switches to Coming soon: {c} {r}")
    ok(api("/v1/config")[1].get("launch182") == "soon", "config should say soon")
    ok(any("Coming soon" in a.get("what", "") for a in api("/v1/admin/audit")[1].get("audit", [])), "the switch should be in the audit log")
    # Coming soon: the customer outside the team
    c, me = api("/v1/me", tok=TOKEN); ok(c == 200 and me.get("role") is None and me.get("uid") == "cust", f"/v1/me must answer the waiting customer: {c} {me}")
    c, r = api("/v1/jobs", tok=TOKEN); ok(c == 403 and r.get("soon182") and "coming soon" in r.get("error", "").lower() and r.get("errorAr"), f"the library must be refused with the Coming soon words: {c} {r}")
    cr0 = api("/v1/me", tok=TOKEN)[1]
    c, r = api("/v1/jobs", {"kind": "image", "prompt": "a red fox in the snow, v182", "model": "auto"}, tok=TOKEN); ok(c == 403 and r.get("soon182"), f"making must be refused: {c} {r}")
    ok(api("/v1/support/tickets", tok=TOKEN)[0] == 200, "support must stay open to the waiting customer")
    ok(mcp(TOKEN) == 403, "the AI connection (MCP) must be refused too")
    out["mcp_soon"] = mcp(TOKEN)
    # the owner still uses everything
    ok(api("/v1/jobs")[0] == 200, "the owner must use the site in Coming soon")
    # a new account → Registrations + an email to the owners
    m0 = len(mails()); c, r = api("/v1/me", tok=TOKEN2); ok(c == 200 and r.get("uid") == "newbie", f"a new account should be answered: {c} {r}")
    t0 = time.time(); ms = []
    while time.time() - t0 < 15:
        ms = mails()[m0:]
        if ms: break
        time.sleep(0.3)
    msg = lambda m: email.message_from_string(m.get("data", ""), policy=email.policy.default)
    out["mail"] = [{"to": m["to"], "subject": str(msg(m)["subject"])} for m in ms]
    body = (msg(ms[0]).get_body(preferencelist=("plain",)).get_content() if ms else "")
    ok(len(ms) == 1 and ms[0]["to"] == ["boss@nooi.ai"] and "new registration" in out["mail"][0]["subject"] and "newbie" in out["mail"][0]["subject"], f"the owner should get one email about the new account: {out['mail']}")
    ok("Give access" in body and "?view=admin" in body and "التسجيلات" in body, f"the email should say how to give access: {body[:400]}")
    api("/v1/me", tok=TOKEN2); time.sleep(1); ok(len(mails()) == m0 + 1, "the same account must not be told twice")
    c, me = api("/v1/me"); ok((me.get("launch182") or {}).get("fresh") == 1, f"the owner should see 1 new registration: {me.get('launch182')}")
    c, L = api("/v1/admin/launch"); regs = {r["uid"]: r for r in L.get("regs", [])}; out["regs"] = sorted(regs)
    ok(L.get("mode") == "soon" and L.get("env") is None and set(regs) >= {"cust", "omar", "newbie"} and "local" not in regs, f"Registrations should list the waiting accounts: {out['regs']}")
    ok(regs.get("newbie", {}).get("fresh") and not regs.get("cust", {}).get("fresh"), "only the new account is new")
    ok(regs.get("cust", {}).get("email") == "sara@example.com" and regs.get("newbie", {}).get("email") == "", "emails as confirmed")
    # give access (viewer) → the customer is in at once; a viewer can't switch the mode
    ok(api("/v1/admin/team", {"email": "sara@example.com", "role": "viewer"})[0] == 200, "give access failed")
    ok(api("/v1/jobs", tok=TOKEN)[0] == 200, "with access the customer must be in at once")
    ok(api("/v1/admin/launch", {"mode": "open"}, method="PUT", tok=TOKEN)[0] == 403, "a viewer must not switch the mode")
    c, L = api("/v1/admin/launch"); ok("cust" not in {r["uid"] for r in L.get("regs", [])}, "a team member is no longer waiting")
    ok(api("/v1/admin/launch/seen", {})[0] == 200 and (api("/v1/me")[1].get("launch182") or {}).get("fresh") == 0, "seen → no new registrations")
    # remove the access → the door closes again; credits untouched
    ok(api("/v1/admin/team/sara@example.com", method="DELETE")[0] == 200, "remove failed")
    ok(api("/v1/jobs", tok=TOKEN)[0] == 403, "without access the customer is refused again")
    # (credits: the customer's own number, through support's page isn't needed — the store keeps them)

def env_part():
    # a real web address → Coming soon by default; NOOI_LAUNCH=open wins and Admin can't change it
    D2 = tempfile.mkdtemp(prefix="nooi-v182b-"); os.makedirs(D2 + "/data"); os.makedirs(D2 + "/media"); os.symlink(ROOT + "/public", D2 + "/public"); os.symlink(ROOT + "/node_modules", D2 + "/node_modules")
    json.dump({"users": {"local": {"plan": "studio", "credits": 10, "ledger": [], "jobs": {}}}}, open(D2 + "/data/db.json", "w"))
    for kw, want in ((dict(PUBLIC_BASE_URL="https://nooi.example"), "soon"), (dict(PUBLIC_BASE_URL="https://nooi.example", NOOI_LAUNCH="open"), "open")):
        P2 = PORT + 10; s2 = start(P2, D2, **kw); B2 = f"http://localhost:{P2}"
        try:
            ok(up(B2), "the second server didn't start")
            got = api("/v1/config", base=B2)[1].get("launch182"); ok(got == want, f"{kw}: mode {got}, expected {want}")
            if "NOOI_LAUNCH" in kw:
                c, r = api("/v1/admin/launch", {"mode": "soon"}, method="PUT", base=B2); ok(c == 409 and "NOOI_LAUNCH" in r.get("error", "") and r.get("errorAr"), f"the server setting must win: {c} {r}")
                c, L = api("/v1/admin/launch", base=B2); ok(L.get("env") == "open", f"Admin should say the server decides: {L.get('env')}")
        finally:
            s2.terminate(); s2.wait()
    shutil.rmtree(D2, ignore_errors=True)

async def page_part(p, phone, lang):
    tag = ("phone" if phone else "desk") + "-" + lang; ar = lang == "ar"
    br = await p.chromium.launch(); c = await br.new_context(viewport={"width": 390, "height": 844} if phone else {"width": 1280, "height": 900}, has_touch=phone, is_mobile=phone)
    pg = await c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); reqs = []; pg.on("request", lambda r: reqs.append(r.url))
    E = pg.evaluate
    try:
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'&&API.cfg", timeout=20000)
        await E(f"()=>{{S.lang='{lang}';document.documentElement.lang='{lang}';document.documentElement.dir='{'rtl' if ar else 'ltr'}';S.user=null;API.token=async()=>null;persist();renderAll()}}")
        await pg.wait_for_function("!!document.getElementById('soon182')", timeout=10000); await pg.wait_for_timeout(400)
        v = await E("""()=>{const o=document.getElementById('soon182'),r=o.getBoundingClientRect(),W=innerWidth;const wide=[...o.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>W+1||b.left<-1)}).map(e=>e.className||e.tagName).slice(0,5);
          return {state:soonState182(),text:o.innerText,cards:o.querySelectorAll('.s182card').length,agents:o.querySelectorAll('.s182agents span svg').length,reg:!!o.querySelector('[data-act="soon182-reg"]'),team:!!o.querySelector('[data-act="soon182-in"]'),
            cover:r.top<=0&&r.left<=0&&r.width>=W&&r.height>=innerHeight-1,app:getComputedStyle(document.getElementById('app')).visibility,sw:o.scrollWidth,cw:o.clientWidth,wide,top:document.elementFromPoint(W/2,innerHeight/2).closest('#soon182')?1:0}}""")
        out[tag + "-visitor"] = {k: v[k] for k in ("state", "cards", "agents", "app", "sw", "cw", "wide")}
        ok(v["state"] == "visitor" and v["cover"] and v["top"] and v["app"] == "hidden", f"{tag}: the Coming soon page should cover the site: {out[tag + '-visitor']}")
        words = ["قادمون قريباً", "ترقّبوا", "محرر فيديو مجاني", "مدّ أي لقطة", "ترجمة ودبلجة", "الرسم الحي", "تسعة وكلاء"] if ar else ["Coming soon", "Stay tuned", "Free AI video editor", "Extend any shot", "Translate & dub", "Live AI sketch", "Nine AI agents"]
        ok(all(w in v["text"] for w in words), f"{tag}: the features should be on the page: {[w for w in words if w not in v['text']]}")
        ok(v["cards"] == 9 and v["agents"] == 9 and v["reg"] and v["team"], f"{tag}: 9 feature cards, the nine agents, Register and Team sign in: {v['cards']} {v['agents']}")
        ok(v["sw"] <= v["cw"] and not v["wide"], f"{tag}: nothing wider than the screen: {v['sw']}>{v['cw']} {v['wide']}")
        ok(not any(w in v["text"] for w in ("Kie", "fal.ai", "8 agents", "eight agents", "ثمانية")), f"{tag}: no provider names, nine agents")
        ok(await E("()=>!document.querySelector('#main .lpdemo')"), f"{tag}: the landing page isn't drawn behind")
        await pg.screenshot(path=D + f"/{tag}-visitor.png")
        # Register → sign-in with the note; Back → the Coming soon page again
        await pg.click('[data-act="soon182-reg"]'); await pg.wait_for_timeout(300)
        a = await E("()=>({state:soonState182(),cover:!!document.getElementById('soon182'),note:(document.querySelector('.s182auth')||{}).textContent||''})")
        ok(a["state"] == "off" and not a["cover"] and ("القائمة" in a["note"] if ar else "on the list" in a["note"]), f"{tag}: Register should open sign-in with the note: {a}")
        await E("()=>{const b=document.querySelector('[data-act=\"to-landing\"]');b&&b.click()}"); await pg.wait_for_timeout(300)
        ok(await E("()=>soonState182()==='visitor'&&!!document.getElementById('soon182')"), f"{tag}: Back should show the Coming soon page again")
        # the waiting customer: "You're registered"; nothing else asked of the server; no notes
        await E(f"()=>{{API.token=async()=>'{TOKEN}';S.user={{name:'Sara',method:'email',contact:'sara@example.com'}};ME.uid182=null;persist();renderAll()}}")
        await pg.wait_for_function("soonState182()==='wait'", timeout=15000); await pg.wait_for_timeout(300)
        mark = len(reqs)
        await E("()=>{try{renderAll();loadMe();syncServer&&syncServer()}catch(e){}}"); await pg.wait_for_timeout(2500)
        asked = sorted({u.split(B)[1].split("?")[0] for u in reqs[mark:] if u.startswith(B + "/v1/")})
        out[tag + "-asked"] = asked
        ok(all(x in ("/v1/me",) or x.startswith(("/v1/support", "/v1/ui-t/")) for x in asked), f"{tag}: a waiting customer's page asked the server for more: {asked}")
        w = await E("()=>{const o=document.getElementById('soon182');toast('a note v182');return {text:o.innerText,out:!!o.querySelector('[data-act=\"signout\"]'),reg:!!o.querySelector('[data-act=\"soon182-reg\"]'),toast:(document.getElementById('toast').textContent||'')}}")
        ok(("أنت مسجّل" in w["text"] if ar else "You're registered" in w["text"]) and "sara@example.com" in w["text"] and w["out"] and not w["reg"], f"{tag}: the registered state: {w['text'][:300]}")
        ok("a note v182" not in w["toast"], f"{tag}: notes must stay quiet under the Coming soon page")
        await pg.screenshot(path=D + f"/{tag}-wait.png")
        # access given → the site opens with a welcome
        ok(api("/v1/admin/team", {"email": "sara@example.com", "role": "viewer"})[0] == 200, "give access failed")
        await E("()=>{SOON182.lastMe=0}")
        await pg.wait_for_function("soonState182()==='off'", timeout=15000); await pg.wait_for_timeout(400)
        g = await E("()=>({cover:!!document.getElementById('soon182'),app:getComputedStyle(document.getElementById('app')).visibility,toast:document.getElementById('toast').textContent||''})")
        ok(not g["cover"] and g["app"] == "visible" and ("أهلاً بك" in g["toast"] if ar else "welcome to nooi" in g["toast"]), f"{tag}: access given should open the site with a welcome: {g}")
        api("/v1/admin/team/sara@example.com", method="DELETE")
        # the owner: Admin → Admins & permissions
        await E("()=>{API.token=async()=>null;ME.uid182=null;S.user={name:'Owner',method:'email',contact:'owner@nooi.ai'};SOON182.told=false;try{sessionStorage.removeItem('l182told')}catch(e){};persist();renderAll()}")
        await pg.wait_for_function("soonState182()==='off'&&ME.role==='owner'", timeout=15000)
        await E("()=>{S.admTab='team';L182.d=null;L182.seen=false;go('admin')}")
        await pg.wait_for_function("!!document.querySelector('.l182row')", timeout=15000); await pg.wait_for_timeout(300)
        ad = await E("""()=>{const c=document.querySelector('.l182');return {text:c.innerText,sw:c.querySelector('[data-act="l182-mode"]').getAttribute('aria-checked'),rows:[...c.querySelectorAll('.l182row')].map(r=>r.innerText.split('\\n')[0]),give:[...c.querySelectorAll('[data-act="l182-give"]')].map(b=>b.dataset.email),
           wide:[...c.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>innerWidth+1||b.left<-1)}).length}}""")
        out[tag + "-admin"] = {k: ad[k] for k in ("sw", "rows", "give", "wide")}
        ok(ad["sw"] == "true" and ("قادمون قريباً — للفريق فقط" in ad["text"] if ar else "Coming soon — the team only" in ad["text"]), f"{tag}: Site access should show Coming soon on: {ad['sw']}")
        ok("sara@example.com" in ad["give"] and "omar@example.com" in ad["give"] and not ad["wide"], f"{tag}: Registrations with Give access: {out[tag + '-admin']}")
        # give access to Omar as Support from the list
        await E("()=>{document.querySelector('[data-l182role=\"omar\"]').value='support'}")
        await pg.click('[data-act="l182-give"][data-email="omar@example.com"]')
        await pg.wait_for_function("!document.querySelector('[data-act=\"l182-give\"][data-email=\"omar@example.com\"]')", timeout=15000)
        team = api("/v1/admin/team")[1].get("team", [])
        ok(any(t.get("email") == "omar@example.com" and t.get("role") == "support" for t in team), f"{tag}: Omar should be in the team as Support: {team}")
        api("/v1/admin/team/omar@example.com", method="DELETE")
        # opening the site asks twice; then Coming soon again
        await pg.click('[data-act="l182-mode"]'); await pg.wait_for_timeout(300)
        ok(api("/v1/config")[1].get("launch182") == "soon", f"{tag}: one tap must not open the site")
        await pg.click('[data-act="l182-mode"]'); await pg.wait_for_function("API.cfg.launch182==='open'", timeout=15000)
        ok(api("/v1/config")[1].get("launch182") == "open", f"{tag}: the second tap opens the site")
        await pg.wait_for_function("document.querySelector('[data-act=\"l182-mode\"]').getAttribute('aria-checked')==='false'", timeout=15000)
        await pg.click('[data-act="l182-mode"]'); await pg.wait_for_function("API.cfg.launch182==='soon'", timeout=15000)
        ok(api("/v1/config")[1].get("launch182") == "soon", f"{tag}: back to Coming soon")
        await pg.screenshot(path=D + f"/{tag}-admin.png")
        ok(not errs, f"{tag}: page errors {errs[:3]}")
    finally:
        await br.close()

async def pages():
    async with async_playwright() as p:
        await page_part(p, True, "en")
        await page_part(p, False, "ar")

try:
    server_part()
    env_part()
    # the page tests run in Coming soon with Sara and Omar waiting (one new since the owner last looked)
    api("/v1/admin/launch", {"mode": "soon"}, method="PUT")
    asyncio.run(pages())
finally:
    srv.terminate(); srv.wait(); mk.terminate(); mk.wait()
print(json.dumps(out, ensure_ascii=False, indent=1)[:4000])
if fails:
    print("FAIL:"); [print(" -", f) for f in fails]
    print("server log:", open(D + f"/server{PORT}.log").read()[-1500:]); sys.exit(1)
shutil.rmtree(D, ignore_errors=True)
print("v182 OK")
