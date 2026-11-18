# v124 in a real browser with a real nooi server (Arabic phone, computer) — the page's side of many customers at once:
#  · a server message reads in the reader's language: "High demand right now…" on an Arabic page that opened in English is
#    Arabic; a sentence in the other script keeps its own direction (dir="auto")
#  · a job waiting its turn says so on its card: "أنت في الطابور وأمامك 12 · يبدأ خلال نحو 10 ث" / "you're next"
#  · an open page asks about all its jobs in ONE request (/v1/jobs/live?ids=a,b,c), a job that one doesn't know is asked about
#    by itself (as before, so it is still found gone); while the tab is hidden it waits 15 s, and asks at once when it is back
#  · Admin → Speed: the engine's line (waiting, sent, "too many") and the field for its limit
# Run: python3 tests/v124.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8343
D = tempfile.mkdtemp(prefix="nooi-v124-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
RATE = "High demand right now — we retried automatically. Please try again in a minute."

async def run(b, W, H, lang, tag):
    ctx = await b.new_context(viewport={"width": W, "height": H}, is_mobile=W < 600, has_touch=W < 600); pg = await ctx.new_page(); E = pg.evaluate; errs = []; reqs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200])); pg.on("request", lambda r: reqs.append(r.url.split(f":{PORT}")[-1]) if "/v1/jobs" in r.url else None)
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}", lang)
    out[tag] = {}
    # the server's message in the reader's language (the page opened in English first)
    m = await E("(e)=>({txt:errText81({error:e}),rate:ERR_MSG.rate})", RATE); out[tag]["msg"] = m
    want = "ضغط عالٍ" if lang == "ar" else "High demand"
    ok(m["txt"].startswith(want) and m["rate"].startswith(want), f"{tag}: the server's message reads in the reader's language {m}")
    # cards: a job in line, and a failed one
    c = await E("""()=>{const now=Date.now();S.hf.tab='image';S.hf.out=['v124a','v124b','v124c'];
      S.jobs=S.jobs.filter(j=>!/^v124/.test(j.id)).concat([{id:'v124a',kind:'image',status:'queued',stage:'line',line124:{ahead:12,sec:10},prompt:'a red apple',created:now,model:'nano'},
        {id:'v124b',kind:'image',status:'queued',stage:'line',line124:{ahead:0,sec:2},prompt:'a pear',created:now,model:'nano'},
        {id:'v124c',kind:'image',status:'failed',error:'Kie AI 422: content blocked',prompt:'x',created:now,model:'nano'}]);go('home');renderAll();
      const t=id=>{const x=[...document.querySelectorAll('#main .hfrc')].find(a=>a.innerHTML.includes(id==='v124a'?'a red apple':id==='v124b'?'a pear':'>x<'));return x};
      const a=t('v124a'),bb=t('v124b'),f=t('v124c');return {a:a&&(a.querySelector('.ln124')||{}).textContent,b:bb&&(bb.querySelector('.ln124')||{}).textContent,fdir:f&&(f.querySelector('.hfrph.bad p')||{}).getAttribute?.('dir'),
        inside:a?(()=>{const r=a.querySelector('.hfrph').getBoundingClientRect(),q=a.querySelector('.ln124').getBoundingClientRect();return q.left>=r.left-1&&q.right<=r.right+1&&q.bottom<=r.bottom+1})():false}}""")
    out[tag]["cards"] = c
    w12 = "أمامك 12" if lang == "ar" else "12 ahead of you"; nxt = "أنت التالي" if lang == "ar" else "You're next"
    ok(c["a"] and w12 in c["a"] and c["b"] and nxt in c["b"] and c["inside"], f"{tag}: a job waiting its turn says where it is, inside its card {c}")
    ok(c["fdir"] == "auto", f"{tag}: a failed card's sentence keeps its own direction {c['fdir']}")
    # one request for all the page's jobs; one it doesn't know → asked by itself (and found gone)
    await E("()=>{S.hf.out=[];const now=Date.now();S.jobs=S.jobs.filter(j=>!/^v124/.test(j.id)).concat(['q1','q2','q3'].map(x=>({id:'v124'+x,remote:'zz'+x,kind:'image',status:'rendering',created:now,prompt:x,model:'nano'})));renderAll()}")
    reqs.clear(); await pg.wait_for_timeout(4500)
    live = [r for r in reqs if r.startswith("/v1/jobs/live")]; single = [r for r in reqs if r.startswith("/v1/jobs/zz")]
    out[tag]["requests"] = reqs[:8]
    ok(live and all(x in live[0] for x in ("zzq1", "zzq2", "zzq3")), f"{tag}: one request asks about all the page's jobs {reqs[:6]}")
    ok(len(single) >= 3, f"{tag}: a job that one doesn't know is asked about by itself, as before {reqs[:8]}")
    # a hidden tab waits; back in view it asks at once
    await E("()=>{S.jobs=S.jobs.filter(j=>!/^v124/.test(j.id)).concat([{id:'v124h',remote:'zzh',kind:'image',status:'rendering',created:Date.now(),prompt:'h',model:'nano'}]);Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})}")
    await pg.wait_for_timeout(300); reqs.clear(); await pg.wait_for_timeout(5000); hidden = [r for r in reqs if "zzh" in r]
    await E("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))}"); await pg.wait_for_timeout(600); back = [r for r in reqs if "zzh" in r]
    out[tag]["hidden"] = [hidden, back]
    ok(not hidden and back, f"{tag}: a hidden tab doesn't ask every few seconds; back in view it asks at once {hidden} {back}")
    await E("()=>{S.jobs=S.jobs.filter(j=>!/^v124/.test(j.id));persist()}")
    # Admin → Speed: the line and the limit
    if W >= 600:
        a = await E("""async()=>{S.view='admin';S.admTab='overview';SP109.d=null;renderAll();for(let i=0;i<40&&!SP109.d;i++)await new Promise(r=>setTimeout(r,100));renderAll();
          const r=document.querySelector('#main .ln124a');return {row:r?r.textContent:'',input:(document.getElementById('pace124')||{}).value||null}}""")
        out[tag]["admin"] = a
        ok("20 every 10" in a["row"] and a["input"] == "20/10" and "waiting now" in a["row"], f"{tag}: Admin → Speed shows the engine's line and its limit {a}")
    ok(not errs, f"{tag}: no page errors {errs[:3]}"); await ctx.close()

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        KIE_API_KEY="kk", KIE_BASE_URL="http://localhost:9", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            b = await p.chromium.launch(); await run(b, 390, 844, "ar", "ar phone"); await run(b, 1440, 900, "en", "computer"); await b.close()
    finally: srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
