# v132 "making a video with any engine, Extend, and the longest videos (1–2 minutes) with the agents and the engines — clip after
# clip in the same place, with continuity". A real nooi server, a stand-in engine (records every request; one part fails once; a
# marked video always fails) and a stand-in text AI (the agents' plan; a vision check that finds one part drifted), then the page:
#  · server: 60 s and 2 min become connected parts (the engine's own shot length), planned by the agents (bible + one shot per part),
#    each part from the last frame of the one before, the first frame on part 1 and the end frame on the last only; a part that
#    fails is made again; a part that left the film is re-made with the differences named; ONE joined video with sound, labelled,
#    charged once; the parts don't count as running jobs; plans: Pro 1 min, Studio 2 min; a film whose part can't be made fails
#    with the part's number (Arabic too) and nothing charged; a long video interrupted while planning is picked up after a restart
#  · Extend: from the last frame, the same or another engine, one longer video; someone else's or an outside video refused; the
#    Finish page's Extend works from the client's own video
#  · page: nooi Studio's Engine and Length chips first; lengths 5 s … 2 min (locked past the plan); the long-video note; a long
#    video made from the page shows planning / part n of N / joining and the agents' plan; Extend… opens +5/+10/+15 with the
#    price and makes one longer video; Extend in a made video's long-press menu; the home box goes to 2 minutes with any engine;
#    the 9 agents' film as one continuous video; a phone in Arabic
# Run: python3 tests/v132.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request, hashlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8372, 8373
D = tempfile.mkdtemp(prefix="nooi-v132-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOK = {"s": "nooi_" + "s" * 32, "p": "nooi_" + "p" * 32}
def acct(plan, credits, tok):
    return {"plan": plan, "planUntil": 4102444800000, "credits": credits, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
            "tokens": [{"id": "tk" + plan, "name": "t", "hash": hashlib.sha256(tok.encode()).hexdigest(), "last4": tok[-4:], "created": 1, "dailyCap": 10000000}]}
now = int(time.time() * 1000)
# a long video the last run left while its agents were planning (picked up at start)
left = {"id": "longleft", "owner": "stu", "kind": "video", "cap": "video", "prov": "kie@bytedance/seedance-2", "status": "rendering", "stage": "plan", "progress": 0, "created": now - 60000, "cost": 0, "children": [],
        "title": "A boat leaves the harbour", "payload": {"kind": "video", "model": "seedance20", "prompt": "A boat leaves the harbour at dawn", "dur": 30, "aspect": "16:9", "meta": {"parts": 2, "long132": 1}}}
st = acct("studio", 60000, TOK["s"]); st["jobs"]["longleft"] = left
json.dump({"users": {"local": {"plan": "studio", "planUntil": 4102444800000, "credits": 60000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}, "stu": st, "pro": acct("pro", 20000, TOK["p"])}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=24:d=5", "-f", "lavfi", "-i", "sine=frequency=300:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", D + "/res.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x2050a0:s=640x360:r=24:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/mute.mp4"], check=True)
MOCK = r'''
import json, sys, urllib.parse, re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "llm": [], "bad": [], "failOnce": 1, "checks": 0}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/stats": return self.send(st)
        if u.path in ("/res.mp4", "/mute.mp4"):
            b = open(DIR + u.path, "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        tid = (q.get("taskId") or [""])[0]
        if tid in st["bad"]: return self.send({"code": 200, "data": {"state": "fail", "failMsg": "internal error"}})
        r = next((x for x in st["reqs"] if x["tid"] == tid), None); mute = r and "SILENT" in str((r["body"].get("input") or {}).get("prompt", ""))
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/" + ("mute.mp4" if mute else "res.mp4")]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text"); st["llm"].append(text[:300])
            m = re.search(r"in (\d+) connected shots", text)
            if m:
                k = int(m.group(1)); idea = (re.search(r'Idea: "(.*?)"', text) or [None, ""])[1]
                return self.send({"content": [{"type": "text", "text": json.dumps({"title": "Lantern market", "bible": "Lina, 25, black hair in a bun, red scarf, blue coat; a night market with paper lanterns; warm orange light; 35mm film look (" + idea[:24] + ").",
                    "shots": ["Lina walks on through the lantern market, shot %d, the camera tracking beside her (%s)." % (i + 1, idea[:60]) for i in range(k)]})}]})
            if "Image 1 is the reference of a scene" in text:
                mine = "girl walks" in text.lower(); st["checks"] += 1; st["mine"] = st.get("mine", 0) + (1 if mine else 0); same = not (mine and st["mine"] == 2)
                return self.send({"content": [{"type": "text", "text": json.dumps({"score": 90 if same else 30, "same": same, "differences": [] if same else ["the market became a beach"]})}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        tid = "t%d" % (len(st["reqs"]) + 1); p = str((j.get("input") or {}).get("prompt", ""))
        if ("(part 3 of" in p and "lantern" in p.lower() and st["failOnce"] > 0) or "FAILALWAYS" in p:
            if "FAILALWAYS" not in p: st["failOnce"] -= 1
            st["bad"].append(tid)
        st["reqs"].append({"path": u.path, "body": j, "tid": tid}); return self.send({"code": 200, "data": {"taskId": tid}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False)[:500]))
def api(p, body=None, tok="s"):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", "authorization": "Bearer " + TOK[tok]})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
stats = lambda: json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
def waitjob(jid, sec=120, tok="s"):
    t0 = time.time(); r = {}; seen = set()
    while time.time() - t0 < sec:
        r = api("/v1/jobs/" + jid, tok=tok); seen.add((r.get("stage"), r.get("partsDone"), r.get("partsTotal")))
        if r.get("status") in ("done", "failed"): break
        time.sleep(.4)
    r["_seen"] = sorted(str(x) for x in seen); return r
def probe(url):
    f = D + "/media/" + url.split("/media/")[-1]
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", f], capture_output=True, text=True).stdout or "{}")
    return {"dur": round(float((j.get("format") or {}).get("duration") or 0), 1), "kinds": [s["codec_type"] for s in j.get("streams", [])]}
inp = lambda x: x["body"].get("input") or {}
wallet = lambda tok="s": api("/v1/billing", tok=tok).get("credits")

def server_side():
    # helpers on their own: how many parts, the offline plan, the words of a part
    node = subprocess.run(["node", "--input-type=module", "-e", """
import { partsFor132, offlinePlan132, partPrompt132, partMax132 } from '@ROOT@/lib/long132.js';
const o = { a: partsFor132({ kind: 'video', model: 'seedance20', dur: 60 }), b: partsFor132({ kind: 'video', model: 'veo31f', dur: 120 }), c: partsFor132({ kind: 'video', model: 'kling', dur: 10 }),
  d: partsFor132({ kind: 'video', model: 'mcswap', dur: 60 }), e: partsFor132({ kind: 'video', model: 'wan30', dur: 300 }), f: partMax132('wan30') };
const p = offlinePlan132('A fox runs', 3); o.plan = [p.shots.length, p.by, /Opening/.test(p.shots[0]), /Final/.test(p.shots[2])];
const b = { prompt: 'idea', meta: { shots: ['one', 'two'], bible: 'Lina in red' } }; o.w0 = partPrompt132(b, 0, 2); o.w1 = partPrompt132(b, 1, 2);
console.log(JSON.stringify(o));""".replace("@ROOT@", ROOT)], cwd=D, capture_output=True, text=True)
    try: h = json.loads(node.stdout)
    except Exception: h = {"err": node.stderr[-400:]}
    out["helpers"] = h
    chk("parts: 60 s on Seedance 2.0 = 4, 2 min on Veo = 15, 10 s on Kling = one shot, never a swap, 5 min asked = the 2-minute most (8 on WAN 3.0)", h.get("a") == 4 and h.get("b") == 15 and h.get("c") == 0 and h.get("d") == 0 and h.get("e") == 8 and h.get("f") == 15, h)
    chk("offline plan: an opening, the middle, an end", h.get("plan") == [3, "offline", True, True], h)
    chk("a part's words: its shot + the bible, and (after the first) it continues from the last frame", h.get("w0", "").startswith("one") and "Continuity: Lina in red" in h.get("w0", "") and "previous shot's last frame" in h.get("w1", "") and "previous" not in h.get("w0", ""), h)

    # a 1-minute video on Seedance 2.0 with a first and an end frame
    w0 = wallet(); n0 = len(stats()["reqs"])
    j = api("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "A girl walks through a lantern market at night and buys a red lantern", "dur": 60, "aspect": "16:9",
                         "inputs": {"vStart": "/media/first.png", "vEnd": "/media/end.png"}})
    chk("1 minute: made at once (no 402)", bool(j.get("id")), j)
    if j.get("id"):
        r = waitjob(j["id"], 150); sent = [x for x in stats()["reqs"][n0:] if x["path"].endswith("createTask") and "girl walks" in inp(x).get("prompt", "").lower()]
        out["long60"] = {k: r.get(k) for k in ("status", "error", "partsTotal", "longDur", "cost", "_seen")}; out["long60"]["plan"] = r.get("plan132")
        chk("1 minute: done, 4 parts", r.get("status") == "done" and r.get("partsTotal") == 4, out["long60"])
        chk("1 minute: the agents planned it (one shot per part)", (r.get("plan132") or {}).get("by") == "agents" and len((r.get("plan132") or {}).get("shots") or []) == 4, r.get("plan132"))
        firsts = [inp(x).get("first_frame_url") for x in sent]; lasts = [inp(x).get("last_frame_url") for x in sent]
        out["long60"]["frames"] = [[bool(a), bool(b)] for a, b in zip(firsts, lasts)]
        chk("1 minute: part 1 from the first frame, every later part from the last frame of the part before, the end frame on the last part only",
            firsts[0] and firsts[0].endswith("/media/first.png") and all(f and not f.endswith("/first.png") for f in firsts[1:]) and lasts[-1] and all(not l for l in lasts[:-1]), out["long60"]["frames"])
        words = [inp(x).get("prompt", "") for x in sent]
        chk("1 minute: each part's words = its shot + the bible; later parts continue from the last frame", all("Lina walks on" in w and "Continuity: Lina, 25" in w for w in words) and all("previous shot's last frame" in w for w in words[1:]), [w[:160] for w in words])
        chk("1 minute: the part that failed was made again", len(stats()["bad"]) >= 1 and len(sent) >= 5, {"sent": len(sent), "bad": stats()["bad"]})
        chk("1 minute: the part that left the film was re-made with the differences named", any("the market became a beach" in w for w in words), [w[-200:] for w in words])
        f = probe(r["url"]) if r.get("url") else {}
        out["long60"]["file"] = f
        chk("1 minute: ONE video with its sound (the parts joined, the repeated frame dropped)", f.get("kinds") == ["video", "audio"] and 19 <= f.get("dur", 0) <= 20.5 and "-long" in (r.get("url") or "") and len(r.get("segments") or []) == 4, {"f": f, "url": r.get("url")})
        chk("1 minute: charged once, the page's price", r.get("cost") and wallet() == w0 - r["cost"], [w0, wallet(), r.get("cost")])
        chk("1 minute: the stages shown (part n of 4, joining)", any("'join'" in s for s in r["_seen"]) and any(", 4)" in s for s in r["_seen"]), r["_seen"])

    # 2 minutes on WAN 3.0 (8 parts of 15 s), a Pro account at 1 minute, 90 s refused for Pro
    n0 = len(stats()["reqs"]); j = api("/v1/jobs", {"kind": "video", "model": "wan30", "prompt": "SILENT A drone glides along a coastline at sunset", "dur": 120, "aspect": "16:9"})
    r = waitjob(j["id"], 200) if j.get("id") else j; sent = [x for x in stats()["reqs"][n0:] if x["path"].endswith("createTask")]
    f = probe(r["url"]) if r.get("url") else {}
    out["long120"] = {"status": r.get("status"), "parts": r.get("partsTotal"), "models": sorted(set(x["body"].get("model") for x in sent)), "durs": sorted(set(inp(x).get("duration") for x in sent)), "file": f}
    chk("2 minutes on WAN 3.0: 8 parts of 15 s, one video (a silent engine video stays silent)", r.get("status") == "done" and r.get("partsTotal") == 8 and out["long120"]["models"] == ["wan/3-0-video"] and out["long120"]["durs"] == [15] and f.get("kinds") == ["video"], out["long120"])
    p60 = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "SILENT A cat naps in a sunbeam", "dur": 60, "aspect": "9:16"}, tok="p")
    p90 = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "A cat naps", "dur": 90}, tok="p")
    chk("Pro: 1 minute allowed, 90 s refused (upgrade)", bool(p60.get("id")) and p90.get("_status") == 402, [p60.get("_status"), p90])
    # the parts are one job: Pro (4 at once) can start other videos while its 1-minute video is being made
    more = [api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": f"SILENT A bird number {i}", "dur": 5, "aspect": "1:1"}, tok="p") for i in range(3)]
    chk("Pro: the long video's parts don't use up the running-jobs limit", all(m.get("id") for m in more), [m.get("_status") or m.get("error") for m in more])
    if p60.get("id"): r = waitjob(p60["id"], 120, tok="p"); chk("Pro: the 1-minute video is done", r.get("status") == "done" and r.get("partsTotal") == 4, {k: r.get(k) for k in ("status", "error", "partsTotal")})
    # a film whose part can't be made: fails with the part's number, nothing charged
    w0 = wallet(); j = api("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "FAILALWAYS A storm over the sea", "dur": 30})
    r = waitjob(j["id"], 120) if j.get("id") else j
    out["failfilm"] = {k: r.get(k) for k in ("status", "error", "errorAr")}
    chk("a part that can't be made: the film fails with that part's number (Arabic too), nothing charged", r.get("status") == "failed" and "Part 1 of 2" in (r.get("error") or "") and "الجزء 1 من 2" in (r.get("errorAr") or "") and wallet() == w0, [out["failfilm"], w0, wallet()])
    # the long video a restart left while planning
    r = waitjob("longleft", 90)
    chk("a long video interrupted while planning is planned again and made after a restart", r.get("status") == "done" and r.get("partsTotal") == 2 and "-long" in (r.get("url") or ""), {k: r.get(k) for k in ("status", "error", "partsTotal", "url")})

    # Extend: a finished video goes on from its last frame on another engine, one longer video
    base = next((k for k in api("/v1/jobs").get("jobs", []) if k.get("status") == "done" and k.get("kind") == "video" and not k.get("partsTotal") and k.get("url")), None)
    if not base:
        b = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "A red fox runs through snowy pines", "dur": 5}); base = waitjob(b["id"], 60)
    bd = probe(base["url"])["dur"]; n0 = len(stats()["reqs"])
    j = api("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "the fox stops and looks back", "dur": 10, "meta": {"extend132": base["id"]}})
    r = waitjob(j["id"], 90) if j.get("id") else j; sent = [x for x in stats()["reqs"][n0:] if x["path"].endswith("createTask")]
    f = probe(r["url"]) if r.get("url") else {}
    out["extend"] = {"status": r.get("status"), "ext": r.get("ext132"), "extendOf": r.get("extendOf"), "file": f, "base": bd, "sent": [(x["body"].get("model"), bool(inp(x).get("first_frame_url")), inp(x).get("prompt", "")[:140]) for x in sent]}
    chk("Extend: from the last frame, the words continue the shot", len(sent) == 1 and sent[0]["body"].get("model") == "bytedance/seedance-2" and out["extend"]["sent"][0][1] and "Continue this exact shot for 10 more seconds: the fox stops and looks back" in inp(sent[0]).get("prompt", ""), out["extend"])
    chk("Extend: one longer video (the video before + the new seconds)", r.get("status") == "done" and (r.get("ext132") or {}).get("joined") and abs(f.get("dur", 0) - (bd + 5 - 1 / 24)) < 0.6 and r.get("extendOf") == base["id"], out["extend"])
    bad = api("/v1/jobs", {"kind": "video", "model": "kling30", "dur": 5, "meta": {"extend132": "someone-elses"}}, tok="p")
    out2 = api("/v1/jobs", {"kind": "finish", "meta": {"tool": "extend", "opt": {"len": "5"}}, "source": "http://evil.example/v.mp4"})
    chk("Extend refuses a video that isn't yours or isn't on the server (Arabic too)", bad.get("_status") == 400 and out2.get("_status") == 400 and bad.get("errorAr"), [bad, out2])
    n0 = len(stats()["reqs"]); t = api("/v1/jobs", {"kind": "finish", "meta": {"tool": "extend", "opt": {"len": "5"}}, "source": base["url"]})
    r = waitjob(t["id"], 90) if t.get("id") else t; sent = [x for x in stats()["reqs"][n0:] if x["path"].endswith("createTask")]
    chk("the Finish page's Extend: from your own video's last frame, with words, one longer video", r.get("status") == "done" and (r.get("ext132") or {}).get("joined") and sent and inp(sent[0]).get("prompt", "").startswith("Continue this exact shot") and (inp(sent[0]).get("first_frame_url") or inp(sent[0]).get("image_urls")), {"r": {k: r.get(k) for k in ("status", "error", "ext132")}, "sent": [inp(x).get("prompt", "")[:100] for x in sent]})

async def page(b):
    ctx = await b.new_context(viewport={"width": 1366, "height": 900}); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.myPlan='studio';Object.assign(S.draft,{model:'seedance20',dur:8,prompt:''});go('video');renderAll()}"); await pg.wait_for_timeout(700)
    o = await E("""()=>{const row=document.querySelector('#main .opt93'),g=document.querySelector('#main [data-act="gen-video"]').getBoundingClientRect(),ch=[...row.querySelectorAll('.o93')].map(c=>c.dataset.o93),
      m=row.querySelector('[data-o93="model"]').getBoundingClientRect(),l=row.querySelector('[data-o93="length"]').getBoundingClientRect();return{first:ch.slice(0,2),seen:m.right<=g.left&&l.right<=g.left&&m.left>=0}}""")
    out["chips"] = o; chk("nooi Studio: Engine and Length are the first chips, in view (not under Generate)", o["first"] == ["model", "length"] and o["seen"], o)
    await pg.locator('#main .o93[data-o93="length"]').click(); await pg.wait_for_timeout(300)
    L = await E("()=>({chips:[...document.querySelectorAll('#main .len132 .chip')].map(b=>[b.textContent.trim(),b.disabled]),max:+(document.querySelector('#main [data-bind=\"draft.dur\"]')||{}).max,note:!document.querySelector('#main .ln132')||document.querySelector('#main .ln132').hidden})")
    out["len"] = L; chk("Length: 5 s … 2:00, the slider to 2 minutes on Studio, no long note at 8 s", [c[0] for c in L["chips"]] == ["5 s", "10 s", "15 s", "30 s", "1:00", "1:30", "2:00"] and not any(c[1] for c in L["chips"]) and L["max"] == 120 and L["note"], L)
    await pg.locator('#main .len132 [data-v="60"]').click(); await pg.wait_for_timeout(300)
    n = await E("()=>({dur:S.draft.dur,note:(document.querySelector('#main .ln132')||{}).textContent||'',cost:(document.querySelector('#main [data-act=\"gen-video\"] .cost')||{}).textContent,want:vcost('seedance20',60),chip:(document.querySelector('#main .o93[data-o93=\"length\"] .o93v')||{}).textContent})")
    out["len60"] = n; chk("1:00 picked: 4 connected parts explained, the price on Generate", n["dur"] == 60 and "4 connected parts" in n["note"] and str(n["want"]) in (n["cost"] or "") and "60" in (n["chip"] or ""), n)
    await E("()=>{S.myPlan='pro';renderView()}"); await pg.wait_for_timeout(250)
    await E("()=>{const c=document.querySelector('#main .o93[data-o93=\"length\"]');if(c&&c.getAttribute('aria-expanded')!=='true')c.click()}"); await pg.wait_for_timeout(250)
    lk = await E("()=>[...document.querySelectorAll('#main .len132 .chip')].filter(b=>b.disabled).map(b=>b.dataset.v)")
    chk("Pro: 1:30 and 2:00 locked", lk == ["90", "120"], lk)
    await E("()=>{S.myPlan='studio';renderView()}"); await pg.wait_for_timeout(250)
    # make a 30 s video from the page and watch it
    n0 = len(stats()["reqs"])
    await E("()=>{S.draft.dur=30;S.draft.prompt='A girl walks through a lantern market at night';renderView()}"); await pg.wait_for_timeout(300)
    await pg.locator('#main [data-act="gen-video"]').click(); await pg.wait_for_timeout(800)
    lines = set()
    for _ in range(160):
        s = await E("()=>{const j=S.jobs.find(x=>x.id===S.lastVideo);const c=j&&document.querySelector('.gc98[data-open98=\"'+j.id+'\"] .lp132');return j&&{st:j.status,line:c?c.textContent:'',dur:j.dur}}")
        if s and s["line"]: lines.add(s["line"][:40])
        if s and s["st"] in ("complete", "failed"): break
        await pg.wait_for_timeout(400)
    out["pageLong"] = {"end": s, "lines": sorted(lines)}
    chk("a 30 s video from nooi Studio: made, the card said what was happening", s and s["st"] == "complete" and s["dur"] == 30 and any("Part" in l or "planning" in l or "Joining" in l for l in lines), out["pageLong"])
    await pg.wait_for_timeout(2500); await E("()=>renderView()")
    await E("()=>{const c=document.querySelector('.gc98[data-open98=\"'+S.lastVideo+'\"]');c&&c.click()}"); await pg.wait_for_timeout(700)
    pl = await E("()=>{const d=document.querySelector('.lb98 .pl132');return d&&{sum:d.querySelector('summary').textContent,n:d.querySelectorAll('li').length}}")
    chk("the opened long video shows what the agents planned", pl and pl["n"] == 2 and "2 connected parts" in pl["sum"], pl)
    # Extend from the opened video
    await pg.locator('.lb98 [data-act="extend-job"]').first.click(); await pg.wait_for_timeout(400)
    ex = await E("()=>({opts:[...document.querySelectorAll('#modalRoot [data-act=\"ext132-n\"]')].map(b=>b.textContent.trim()),cost:(document.getElementById('ext132c')||{}).textContent})")
    await pg.locator('#modalRoot [data-act="ext132-n"][data-v="10"]').click(); await pg.wait_for_timeout(150)
    ex["cost10"] = await E("()=>[(document.getElementById('ext132c')||{}).textContent,String(vcost(S.ext132.m,10))]")
    await pg.locator("#ext132w").fill("she lifts the lantern and smiles"); n0 = len(stats()["reqs"])
    await pg.locator('#modalRoot [data-act="ext132-go"]').click(); await pg.wait_for_timeout(800)
    for _ in range(120):
        s = await E("()=>{const j=S.jobs.find(x=>x.id===S.lastVideo);return j&&{st:j.status,ext:j.ext132||null,meta:j.meta,title:j.title}}")
        if s and s["st"] in ("complete", "failed"): break
        await pg.wait_for_timeout(400)
    sent = [x for x in stats()["reqs"][n0:] if x["path"].endswith("createTask")]
    out["pageExtend"] = {"sheet": ex, "end": s, "sent": [inp(x).get("prompt", "")[:120] for x in sent]}
    chk("Extend…: +5 / +10 / +15 s with the price; it continues the video and comes back as one longer video", ex["opts"] == ["+5 s", "+10 s", "+15 s"] and ex["cost10"][0] == ex["cost10"][1] and s and s["st"] == "complete" and (s["ext"] or {}).get("joined")
        and sent and "she lifts the lantern and smiles" in inp(sent[0]).get("prompt", ""), out["pageExtend"])
    # Extend in a made video's right-click menu
    await E("()=>{document.querySelectorAll('.lb98').forEach(x=>x.remove());const st=ST98&&ST98();if(st)st.lb='';renderView()}"); await pg.wait_for_timeout(400)
    card = pg.locator('.gc98[data-open98]').first; cb = await card.bounding_box()
    await pg.mouse.click(cb["x"] + cb["width"] / 2, cb["y"] + cb["height"] / 3, button="right"); await pg.wait_for_timeout(300)
    it = await E("()=>[...document.querySelectorAll('.cm131 .cm131i')].map(x=>x.textContent.trim())")
    chk("a made video's menu has Extend…", "Extend…" in it, it)
    if "Extend…" in it:
        await pg.locator(".cm131 .cm131i", has_text="Extend…").click(); await pg.wait_for_timeout(300)
        chk("…which opens the Extend sheet", await E("()=>!!document.querySelector('#modalRoot [data-act=\"ext132-go\"]')"))
        await E("()=>{$('#modalRoot').innerHTML=''}")
    # the home box: 2 minutes with a chosen engine
    await E("()=>{go('home');S.hf=S.hf||{};S.hf.tab='video';S.hf.vModel='kling30';S.hf.dur=60;renderAll()}"); await pg.wait_for_timeout(500)
    hb = await E("()=>{hfDurSheet();const r=document.getElementById('hfdr'),n=document.getElementById('hfdn');return{max:+r.max,cap:+n.max,note:(document.getElementById('hfdnote')||{}).textContent,ok:hfDurOK(120)}}")
    chk("home box: up to 2 minutes with any engine, the parts explained", hb["max"] == 120 and hb["cap"] == 120 and "4 connected parts" in hb["note"] and hb["ok"], hb)
    await E("()=>{$('#modalRoot').innerHTML=''}")
    # the 9 agents' film as one continuous video
    n0 = len(stats()["reqs"])
    fm = await E("""()=>{S.crew=S.crew||{};S.crew.run={id:'r132',brief:{aspect:'16:9'},out:{writer:{title:'The lantern'},casting:{characters:[{name:'Lina',look:'25, black hair in a bun',outfit:'red scarf, blue coat'}]},
      director:{shots:[{id:'s1',action:'Lina enters the market',duration:6},{id:'s2',action:'She picks a lantern',duration:6},{id:'s3',action:'She walks away into the night',duration:6}]},
      cine:{shots:[{id:'s1',prompt:'Wide shot: Lina enters the lantern market'},{id:'s2',prompt:'Close-up: she picks a red lantern'},{id:'s3',prompt:'Tracking shot: she walks into the night'}]},producer:{models:[{id:'s1',model:'seedance20'},{id:'s2',model:'seedance20'},{id:'s3',model:'kling30'}]}}};
      crewFilm132(S.crew.run);const j=S.jobs.find(x=>x.id===S.lastVideo);return j&&{dur:j.dur,parts:j.meta.parts,models:j.meta.partModels,bible:j.meta.bible,title:j.title}}""")
    for _ in range(150):
        s = await E("()=>{const j=S.jobs.find(x=>x.id===S.lastVideo);return j&&j.status}")
        if s in ("complete", "failed"): break
        await pg.wait_for_timeout(400)
    sent = [x for x in stats()["reqs"][n0:] if x["path"].endswith("createTask")]
    out["crew"] = {"job": fm, "status": s, "sent": [(x["body"].get("model"), inp(x).get("prompt", "")[:90]) for x in sent]}
    chk("the 9 agents' film: one continuous video — their shots in order, each part's engine, the cast as the bible", fm and fm["parts"] == 3 and fm["dur"] == 18 and "Lina" in (fm["bible"] or "") and s == "complete" and len(sent) == 3
        and "Wide shot: Lina enters" in inp(sent[0]).get("prompt", "") and "Close-up" in inp(sent[1]).get("prompt", "") and sent[2]["body"].get("model") == "kling-3.0/video" and all("Continuity:" in inp(x).get("prompt", "") for x in sent), out["crew"])
    tile = await E("()=>{let h='';try{h=VIEWS.crew?VIEWS.crew():''}catch(e){h=''}return[h.includes('data-act=\"crew-render\"'),h.includes('data-act=\"crew-film132\"')]}")
    chk("the crew page offers One continuous film beside Render all shots", tile[0] == tile[1], tile)
    chk("computer: no page errors", not errs, errs[:3]); await ctx.close()

async def phone(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); E = pg.evaluate
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='ar';S.user={name:'T',method:'google'};AU.showAuth=false;S.myPlan='studio';Object.assign(S.draft,{model:'kling30',dur:90,prompt:''});go('video');renderAll()}"); await pg.wait_for_timeout(700)
    await E("()=>{const c=document.querySelector('#main .o93[data-o93=\"length\"]');c&&c.click()}"); await pg.wait_for_timeout(300)
    a = await E("()=>{const n=document.querySelector('#main .ln132'),cs=[...document.querySelectorAll('#main .len132 .chip')],W=document.documentElement.clientWidth;return{note:n&&!n.hidden?n.textContent:'',chips:cs.map(c=>c.textContent.trim()),inside:cs.every(c=>{const r=c.getBoundingClientRect();return r.left>=0&&r.right<=W+1}),dir:document.documentElement.dir}}")
    out["phoneAr"] = a
    chk("phone in Arabic: the long-video note in Arabic, the length chips on the screen", "أجزاء متصلة" in a["note"] and "6" in a["note"] and a["inside"] and a["dir"] == "rtl" and "1:30" in a["chips"], a)
    j = await E("()=>{const j=S.jobs.find(x=>x.status==='complete'&&x.kind==='video'&&x.remote);if(!j)return null;extSheet132(j);return{t:(document.querySelector('#modalRoot h2,#modalRoot .sheet h3,#modalRoot [class*=title]')||{}).textContent||'',btn:(document.querySelector('#modalRoot [data-act=\"ext132-go\"]')||{}).textContent||''}}")
    chk("phone in Arabic: the Extend sheet in Arabic", j is None or ("مدّ" in (j["btn"] or "")), j)
    await pg.screenshot(path=D + "/phone.png")
    chk("phone: no page errors", not errs, errs[:3]); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for f in (page, phone):
            try: await f(b)
            except Exception as e: fails.append(f.__name__ + " crashed: " + str(e)[:300])
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "SWAP_ENGINE", "WAN_"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", RECOVER_MS="1500", PART_AGAIN_MS="400",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", MIRROR_MEDIA="true", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
        except Exception: time.sleep(.25)
    for img in ("first.png", "end.png"): subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x806040:s=640x360", "-frames:v", "1", D + "/media/" + img], check=True)
    try: server_side()
    except Exception as e: fails.append("server crashed: " + repr(e)[:300])
    asyncio.run(main())
finally: srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1)[:12000])
