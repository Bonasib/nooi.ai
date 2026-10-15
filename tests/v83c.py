# v83 (3): connections have rules and the world can change mid-task.
#  · Connections (API tokens, MCP): read-only connections only look (MCP and the API); a daily credit limit, checked with the
#    real price, refuses before anything is charged; posts a connection schedules wait for the owner's approval (the scheduler
#    never sends them) and only the owner approves, from the app — never a connection; rules change from the app only;
#    a deleted connection stops at once, while the job it started still finishes and is charged once.
#  · Mid-task changes (the idea from OpenART): the price changes between two recipe steps (the next step pays the new
#    price, the first keeps its own), the plan ends between steps (the next step is refused, nothing charged), the credits
#    run out between steps (stops, nothing below zero), a picture is deleted while a video is being made (a clear failure,
#    free, and the next one is accepted).
import asyncio, hashlib, json, os, subprocess, tempfile, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8161, 8162
D = tempfile.mkdtemp(prefix="nooi-v83c-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
T = {k: "nooi_" + k * 32 for k in ("f", "r", "c", "n", "p", "e", "m", "t", "k")}   # full · read-only · capped · no approval · price · plan ends · money · text · recipe
H = lambda t: hashlib.sha256(t.encode()).hexdigest()
def tk(t, **rules): return {"id": "id" + t[5], "name": "conn " + t[5], "hash": H(t), "last4": t[-4:], "created": 1, **rules}
U = lambda credits, toks, **kw: {"plan": "studio", "planUntil": 4102444800000, "credits": credits, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": toks, **kw}
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": U(3000, [tk(T["f"]), tk(T["r"], access="read"), tk(T["c"], dailyCap=30), tk(T["n"], approvePosts=False)]),
  "price": U(3000, [tk(T["p"])]), "planend": U(3000, [tk(T["e"])], plan="pro", planUntil=int(time.time() * 1000) + 6000), "money": U(0, [tk(T["m"])]),
  "texty": U(3000, [tk(T["t"], dailyCap=2)]), "rcp": U(3000, [tk(T["k"], dailyCap=20)])}}, open(D + "/data/db.json", "w"))
for i in (1, 2): subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x{i*60:02x}5070:s=640x640", "-frames:v", "1", f"{D}/media/q{i}.png"], check=True)
MOCK = r"""
const http=require('http');const P=+process.argv[2];const st={tasks:[]};let n=0;const T={},born={};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const u=new URL(q.url,'http://x');const send=d=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({code:200,msg:'success',data:d}))};
 if(u.pathname==='/stats'){s.setHeader('content-type','application/json');return s.end(JSON.stringify(st))}
 if(u.pathname.startsWith('/out.')){s.setHeader('content-type','image/png');return s.end(Buffer.alloc(64))}
 if(u.pathname==='/api/v1/chat/credit')return send(500);
 if(u.pathname.endsWith('/chat/completions')){s.setHeader('content-type','application/json');return s.end(JSON.stringify({choices:[{message:{content:'{"ok":true}'}}]}))}
 if(u.pathname==='/api/v1/jobs/createTask'){const j=JSON.parse(b||'{}'),id='t'+(++n);T[id]=j;born[id]=Date.now();st.tasks.push(j);return send({taskId:id})}
 if(u.pathname==='/api/v1/jobs/recordInfo'){const id=u.searchParams.get('taskId'),j=T[id]||{},p=JSON.stringify(j);const m=/SLOW(\d+)/.exec(p);
  if(m&&Date.now()-born[id]<+m[1]*1000)return send({state:'generating'});
  return send({state:'success',resultJson:JSON.stringify({resultUrls:['http://localhost:'+P+'/out.png']})})}
 s.statusCode=404;s.end('{}')})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None, token=None):
    h = {"content-type": "application/json"}
    if token: h["authorization"] = "Bearer " + token
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            t = r.read(); return json.loads(t) if t else {"_status": r.status}
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
n_rpc = [0]
def mcp(token, name, args=None):
    n_rpc[0] += 1; r = api("/mcp", {"jsonrpc": "2.0", "id": n_rpc[0], "method": "tools/call", "params": {"name": name, "arguments": args or {}}}, token=token)
    res = r.get("result") or {}; txt = (res.get("content") or [{}])[0].get("text", "") if res else json.dumps(r)
    try: data = json.loads(txt)
    except Exception: data = {"text": txt}
    return {"error": bool(res.get("isError")) or "_status" in r, "data": data, "status": r.get("_status"), "raw": txt}
def credits(t): return api("/v1/billing", token=t).get("credits")
def wait_job(jid, token, secs=40):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        j = api("/v1/jobs/" + jid, token=token)
        if j.get("status") in ("done", "failed"): return j
        time.sleep(.4)
    return j
def wait_next(jid, token, secs=20):
    t0 = time.time(); j = {}
    while time.time() - t0 < secs:
        j = api("/v1/jobs/" + jid, token=token)
        if j.get("next") or j.get("chainError") or j.get("status") == "failed": return j
        time.sleep(.4)
    return j

SETUP = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'Sara',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}"
async def browser():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, lang in ((390, "en"), (1280, "ar")):
            mob = w < 600; pg = await (await b.new_context(viewport={"width": w, "height": 860}, is_mobile=mob, has_touch=mob)).new_page()
            errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); await pg.evaluate(SETUP, lang)
            go = "(v)=>{document.getElementById('modalRoot').innerHTML='';go(v);renderAll();scrollTo(0,0)}"
            await pg.evaluate(go, "calendar"); await pg.wait_for_timeout(1500); await pg.evaluate(go, "calendar"); await pg.wait_for_timeout(400)
            cal = await pg.evaluate("()=>document.querySelectorAll('#main .pend83 .pi83').length")
            await pg.evaluate(go, "integrations"); await pg.wait_for_timeout(1500); await pg.evaluate(go, "integrations"); await pg.wait_for_timeout(600)
            st = await pg.evaluate("""()=>({rows:document.querySelectorAll('#main .tk83').length,pend:document.querySelectorAll('#main .pend83 .pi83').length,
              cap:!!document.querySelector('#main [data-tok83=dailyCap]'),wide:document.documentElement.scrollWidth-innerWidth,
              out:[...document.querySelectorAll('#main .tk83 select,#main .tk83 input,#main .pi83 button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<-1||r.right>innerWidth+1)}).length})""")
            ok(cal >= 1 and st["rows"] >= 1 and st["pend"] >= 1 and st["cap"] and st["wide"] <= 1 and not st["out"] and not errs, f"{lang} {w}: the page shows connections with their rules and the waiting posts {cal} {st} {errs[:2]}")
            if lang == "en":
                await pg.fill("#main [data-tok83=dailyCap]", "150"); await pg.dispatch_event("#main [data-tok83=dailyCap]", "change"); await pg.wait_for_timeout(900)
                caps = [t.get("dailyCap") for t in api("/v1/tokens").get("tokens", []) if t.get("name") == "ChatGPT"]
                ok(caps == [150], f"the daily limit changes from the page {caps}")
            else:
                await pg.click('#main [data-act="pend83"][data-op="approve"]'); await pg.wait_for_timeout(900)
                stc = [p.get("status") for p in api("/v1/posts").get("posts", []) if p.get("clientId") == "c1"]
                left = await pg.evaluate("()=>document.querySelectorAll('#main .pend83 .pi83').length")
                ok(stc == ["scheduled"] and left == 0, f"Approve from the page schedules the post {stc} left {left}")
        await b.close()

def main():
    mk = subprocess.Popen(["node", D + "/mock.js", str(KPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "LOCAL_LLM", "PIPER"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", MIRROR_MEDIA="false", FREE_PERIOD="false", LOCAL_LLM_URL=f"http://localhost:{KPORT}/v1", LOCAL_LLM_MODEL="gemma"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(60):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.5)
        P = api("/v1/config")["prices"]
        # ---- a read-only connection only looks
        c0 = credits(T["f"])
        r1 = mcp(T["r"], "nooi_generate_image", {"prompt": "a lantern"}); r2 = mcp(T["r"], "nooi_schedule_post", {"caption": "hi", "platforms": ["tiktok"]})
        r3 = mcp(T["r"], "nooi_credits"); r4 = api("/v1/jobs", {"kind": "image", "model": "zimage", "prompt": "a lantern"}, token=T["r"]); r5 = api("/v1/jobs", token=T["r"])
        ok(r1["error"] and "read-only" in r1["raw"] and r2["error"] and not r3["error"] and r3["data"].get("credits") == c0 and r4.get("_status") == 403 and "jobs" in r5, f"read-only connection: looks, never makes or posts {r1['raw'][:80]} · {r4}")
        # ---- the daily limit holds, checked with the real price, refused before anything is charged
        price = P["image"]["dotimg"]; made = 0; refused = None
        for i in range(12):
            r = mcp(T["c"], "nooi_generate_image", {"prompt": f"a small poster number {i}"})
            if r["error"]: refused = r; break
            made += 1
        c1 = credits(T["c"]); out["cap"] = {"price": price, "made": made}
        ok(made == 30 // price and refused and "daily limit (30 credits)" in refused["raw"] and c1 == c0 - made * price, f"daily limit: {made} made at {price} each, then refused, nothing more charged {refused and refused['raw'][:100]} {c0}→{c1}")
        tl = {t["id"]: t for t in api("/v1/tokens", token=T["f"]).get("tokens", [])}
        ok(tl.get("idc", {}).get("spentToday") == made * price and tl.get("idc", {}).get("dailyCap") == 30, f"the connection shows what it spent today {tl.get('idc')}")
        # ---- once the limit is used up the connection can only look (any tool, not only jobs)
        sl = api("/v1/render/slideshow", {"pictures": [{"url": "/media/q1.png"}, {"url": "/media/q2.png"}]}, token=T["c"]); lk = api("/v1/jobs", token=T["c"])
        ok(sl.get("_status") == 402 and "daily limit" in str(sl.get("error")) and "jobs" in lk, f"a used-up connection can only look {sl} {str(lk)[:60]}")
        # ---- charges outside jobs count too (AI text here)
        t0 = credits(T["t"]); tx = [api("/v1/llm/json", {"prompt": "say ok", "tier": "default", "task": "test"}, token=T["t"]) for _ in range(3)]
        sp = {t["id"]: t for t in api("/v1/tokens", token=T["t"]).get("tokens", [])}.get("idt", {}).get("spentToday")
        ok(tx[0].get("ok") and tx[1].get("ok") and tx[2].get("_status") == 402 and credits(T["t"]) == t0 - 2 and sp == 2, f"AI text counts toward the daily limit {tx} spent {sp} {t0}→{credits(T['t'])}")
        # ---- a recipe a connection started stays under its rules (the next step counts against its limit)
        k0 = credits(T["k"]); rk = api("/v1/jobs", {"kind": "image", "model": "zimage", "prompt": "a card", "aspect": "9:16", "meta": {"chain": [{"kind": "video", "model": "seedance2mini", "prompt": "move", "dur": 5}]}}, token=T["k"])
        ak = wait_next(rk.get("id", "x"), T["k"], 30)
        ok(rk.get("id") and not ak.get("next") and "daily limit" in str(ak.get("chainError")) and k0 - credits(T["k"]) == rk.get("cost"), f"a connection's recipe can't pass its daily limit {ak.get('chainError')} {k0}→{credits(T['k'])} {rk.get('cost')} {rk.get('error')}")
        # ---- posts from a connection wait for the owner; only the owner approves, from the app
        lt = api("/v1/tokens", {"name": "assistant"}).get("token")                  # the owner (app session) makes a connection
        p1 = mcp(lt, "nooi_schedule_post", {"caption": "Our new video is out", "platforms": ["tiktok"], "media_url": "https://x/v.mp4", "at": "2020-01-01T00:00:00Z"})
        pid = p1["data"].get("post_id"); time.sleep(1.5)
        posts = {p["id"]: p for p in api("/v1/posts").get("posts", [])}
        ok(p1["data"].get("status") == "awaiting approval" and posts.get(pid, {}).get("status") == "awaiting" and posts[pid].get("caption") == "Our new video is out", f"a connection's post waits (even when its time has passed) {p1['data']} {posts.get(pid)}")
        a1 = api(f"/v1/posts/{pid}/approve", {}, token=lt); a2 = api(f"/v1/posts/{pid}/approve", {})
        ok(a1.get("_status") == 403 and a2.get("status") == "scheduled", f"a connection can't approve; the owner can {a1} {a2}")
        p2 = mcp(lt, "nooi_schedule_post", {"caption": "spam", "platforms": ["x"]}); rj = api(f"/v1/posts/{p2['data'].get('post_id')}/reject", {})
        ok(rj.get("status") == "removed" and p2["data"].get("post_id") not in {p["id"] for p in api("/v1/posts").get("posts", [])}, f"the owner removes a post {rj}")
        rp = api("/v1/posts", {"id": "c1", "caption": "via the API", "platforms": ["x"], "publishNow": True}, token=lt)
        ok(rp.get("status") == "awaiting", f"the API's 'publish now' from a connection also waits {rp}")
        p3 = mcp(T["n"], "nooi_schedule_post", {"caption": "auto", "platforms": ["x"], "at": "2030-01-01T00:00:00Z"})
        ok(p3["data"].get("status") == "scheduled", f"a connection set to post without asking schedules directly {p3['data']}")
        # ---- rules change from the app only
        tid = next(t["id"] for t in api("/v1/tokens").get("tokens", []) if t["name"] == "assistant")
        ok(api(f"/v1/tokens/{tid}", {"dailyCap": 99999}, "PUT", token=lt).get("_status") == 403, "a connection can't change its own rules")
        u1 = api(f"/v1/tokens/{tid}", {"access": "read"}, "PUT")
        ok(u1.get("token", {}).get("access") == "read" and mcp(lt, "nooi_generate_image", {"prompt": "x"})["error"], f"the owner makes it read-only and it stops making {u1}")
        api(f"/v1/tokens/{tid}", {"access": "full"}, "PUT")
        # ---- a deleted connection stops at once; the job it started still finishes, charged once
        j = mcp(lt, "nooi_generate_image", {"prompt": "SLOW3 a falcon"}); jid = j["data"].get("job_id")
        api(f"/v1/tokens/{tid}", method="DELETE"); r = mcp(lt, "nooi_credits")
        jd = wait_job(jid or "x", None, 30); led = [x for x in api("/v1/billing").get("ledger", []) if x.get("ref") == jid]
        ok(r["status"] == 401 and jd.get("status") == "done" and len(led) <= 1 and tid not in {t["id"] for t in api("/v1/tokens").get("tokens", [])}, f"deleted connection: refused at once, its job still finishes (the owner pays nothing extra) {r['status']} {jd.get('status')} {len(led)}")
        # ---- mid-task: the price changes between two recipe steps
        c0 = credits(T["p"]); base = P["video"]["seedance2mini"]
        r = api("/v1/jobs", {"kind": "image", "model": "zimage", "prompt": "SLOW4 a poster", "aspect": "9:16", "meta": {"chain": [{"kind": "video", "model": "seedance2mini", "prompt": "move", "dur": 5}]}}, token=T["p"])
        time.sleep(.6); cur = api("/v1/admin/pricing").get("factor", 1.25); api("/v1/admin/pricing", {"factor": cur * 2, "costs": {}}, "PUT")
        a = wait_next(r.get("id", "x"), T["p"], 30); b = wait_job(a.get("next") or "x", T["p"]); api("/v1/admin/pricing", {"factor": cur, "costs": {}}, "PUT")
        spent = c0 - credits(T["p"]); out["price"] = {"first": r.get("cost"), "second": b.get("cost"), "base": base}
        ok(b.get("status") == "done" and b.get("cost", 0) > base and spent == r.get("cost", 0) + b.get("cost", 0), f"price change mid-recipe: the next step pays the new price, the first keeps its own {out['price']} spent {spent}")
        # ---- mid-task: the plan ends between steps (Kling 3.0 Turbo is a Pro model)
        c0 = credits(T["e"]); left = (json.load(open(D + "/data/db.json"))["users"]["planend"]["planUntil"] / 1000) - time.time()
        r = api("/v1/jobs", {"kind": "image", "model": "zimage", "prompt": f"SLOW{max(2, int(left) + 2)} a portrait", "aspect": "9:16", "meta": {"chain": [{"kind": "video", "model": "kling30t", "prompt": "turn and smile", "dur": 5}]}}, token=T["e"])
        a = wait_next(r.get("id", "x"), T["e"], 40); spent = c0 - credits(T["e"])
        ok(r.get("id") and "plan" in str(a.get("chainError")) and not a.get("next") and spent == r.get("cost"), f"plan ends mid-recipe: the next step is refused, nothing charged for it {a.get('chainError')} spent {spent} vs {r.get('cost')} {r.get('error')}")
        # ---- mid-task: the credits run out between steps (they were spent on something else meanwhile)
        api("/v1/admin/users/money", {"creditsDelta": P["image"]["zimage"] + base + 2}, "PATCH")
        c0 = credits(T["m"])
        r = api("/v1/jobs", {"kind": "image", "model": "zimage", "prompt": "SLOW3 a card", "aspect": "1:1", "meta": {"chain": [{"kind": "video", "model": "seedance2mini", "prompt": "move", "dur": 5}]}}, token=T["m"])
        time.sleep(.5); other = api("/v1/jobs", {"kind": "image", "model": "zimage", "prompt": "another card"}, token=T["m"])
        a = wait_next(r.get("id", "x"), T["m"], 30); c1 = credits(T["m"])
        ok(c0 is not None and r.get("id") and other.get("id") and a.get("chainError") and not a.get("next") and c1 is not None and c1 >= 0 and c0 - c1 == r.get("cost", 0) + other.get("cost", 0), f"credits run out mid-recipe: stops, never below zero {c0}→{c1} {a.get('chainError')} {r.get('error')} {other.get('error')}")
        # ---- mid-task: a picture is deleted while the video from pictures is made
        sv = api("/v1/render/slideshow", {"pictures": [{"url": "/media/q1.png"}, {"url": "/media/q2.png"}], "secs": 2, "transition": "fade"}, token=T["f"])
        try: os.remove(D + "/media/q2.png")
        except FileNotFoundError: pass
        sj = wait_job(sv.get("id", "x"), T["f"], 60)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x406080:s=640x640", "-frames:v", "1", f"{D}/media/q2.png"], check=True)
        again = api("/v1/render/slideshow", {"pictures": [{"url": "/media/q1.png"}, {"url": "/media/q2.png"}], "secs": 2}, token=T["f"])
        ok(sj.get("status") in ("done", "failed") and (sj.get("status") == "done" or "try other pictures" in str(sj.get("error"))) and again.get("id"), f"a picture deleted mid-video: done or a clear failure, and the next one is accepted {sj.get('status')} {sj.get('error')} {again}")
        # ---- the page: connections with their rules, posts waiting for approval (phone English, computer Arabic)
        api("/v1/tokens", {"name": "ChatGPT"}); asyncio.run(browser())
    finally:
        srv.terminate(); mk.terminate()
        try: out["serverLog"] = srv.stderr.read().decode()[-1500:]
        except Exception: pass

main()
print(json.dumps({"fails": fails, **out}, ensure_ascii=False, indent=1, default=str))
