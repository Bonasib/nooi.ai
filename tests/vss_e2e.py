# Video intelligence (v73 — the NVIDIA VSS workflows inside nooi), end to end on a fresh server with its own data + media,
# a mocked vision text AI (Anthropic Messages format) and a mocked NVIDIA VSS REST server. ffmpeg makes a 40 s test video.
# Phone + desktop: upload → analyse (contact sheet per part → captions → summary, key moments, timeline, alerts) → seek
# → ask with timestamps → clip to the editor → search by meaning → check an alert → live alerts on a video.
# Then the connector: Admin saves a VSS server URL → summaries and Q&A run on it (/v1/summarize, /v1/chat/completions) and
# the provider test probes /v1/ready.
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, LPORT, VPORT = 8082, 8081, 8079
D = tempfile.mkdtemp(prefix="nooi-vss-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
FF = os.environ.get("FFMPEG_PATH", "ffmpeg"); VID = D + "/clip.webm"
subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=40", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "400k", VID], check=True)
MOCK = r"""
const http=require('http');const st={calls:0,images:0,vss:[],nv:[]};
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const j=b?JSON.parse(b):{};s.setHeader('content-type','application/json');
 if(q.url==='/stats')return s.end(JSON.stringify(st));
 const nv=q.url.startsWith('/nv/');
 if(nv&&q.url.includes('/vlm/')){st.nv.push({vlm:true,auth:q.headers.authorization,model:j.model||null,img:JSON.stringify(j).includes('image_url')});return s.end(JSON.stringify({choices:[{message:{role:'assistant',content:'A red car on a street. Yes, a person has fallen.'}}]}))}
 if(q.url==='/v1/messages'||q.url==='/nv/chat/completions'){st.calls++;const c=j.messages[0].content,imgs=Array.isArray(c)?c.filter(x=>x.type==='image'||x.type==='image_url').length:0;st.images+=imgs;const t=Array.isArray(c)?c.find(x=>x.type==='text').text:c;let o;
  if(nv)st.nv.push({auth:q.headers.authorization,model:j.model,rb:j.reasoning_budget||0,img:imgs>0,len:imgs?c.find(x=>x.type==='image_url').image_url.url.length:0});
  const m=/from (\d\d):(\d\d) to/.exec(t);
  if(m){const sec=+m[1]*60+ +m[2];o={caption:sec>=20?'A red car drives along the street and turns left.':'An empty street with colour bars and a timer.',objects:sec>=20?['red car','street']:['street'],tags:sec>=20?['car','traffic']:['street'],events:[{name:'Person falls',present:sec>=30,confidence:sec>=30?.9:.1,detail:sec>=30?'a person falls near the car':''}]}}
  else if(/Aggregate them/.test(t))o={title:'Street camera',summary:'An empty street, then a red car arrives and someone falls.',highlights:[{t:20,text:'Red car arrives'},{t:30,text:'Person falls'}],timeline:[{s:0,e:20,text:'Empty street'},{s:20,e:40,text:'Red car and a fall'}],alerts:[{t:30,event:'Person falls',detail:'near the car'}],report:'## Overview\nStreet camera.'};
  else if(/^Video summary:/.test(t))o={answer:'The red car arrives at 00:20.',moments:[{t:20,why:'car arrives'}]};
  else if(/^Search query:/.test(t)){const lines=t.split('\n').filter(l=>/^\d+\. /.test(l));o={matches:lines.map(l=>({i:+l.split('.')[0],score:/red car/.test(l)?.9:.1,why:'red car'}))}}
  else if(/Alert to verify/.test(t))o={verdict:imgs?'confirmed':'unsure',confidence:.8,reason:'A person is on the ground.',seen:'street'};
  else o={};
  return s.end(JSON.stringify(nv?{choices:[{message:{role:'assistant',content:(j.reasoning_budget?'<think>Looking at the {frames} first…</think>':'')+JSON.stringify(o)}}]}:{content:[{type:'text',text:JSON.stringify(o)}]}))}
 if(q.url==='/v1/ready')return s.end('{}');
 if(q.url==='/v1/summarize'){st.vss.push(j);return s.end(JSON.stringify({id:'r1',video_id:'vid-123',object:'summarization.completion',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'VSS summary: a red car.'}}]}))}
 if(q.url==='/v1/chat/completions'){st.vss.push(j);return s.end(JSON.stringify({id:'c1',choices:[{index:0,message:{role:'assistant',content:'VSS answer for '+j.id}}]}))}
 s.statusCode=404;s.end('{}')})}).listen(+process.argv[2]);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
async def wait_for(E, js, sec=30):
    for _ in range(sec * 4):
        if await E(js): return True
        await asyncio.sleep(.25)
    return False

async def run(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"; r = {}
    b = await p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
    ctx = await b.new_context(viewport={"width": w, "height": 860}, is_mobile=mob, has_touch=mob, permissions=["camera"])
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); E = pg.evaluate
    await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;go('vss');renderAll()}" % ("ar" if mob else "en"))
    ok(await wait_for(E, "()=>VSSD.loaded&&!!document.querySelector('[data-act=vss-run]')", 10), f"{tag}: page loads")
    r["nav"] = await E("()=>ALLNAV.some(x=>x[0]==='vss')"); ok(r["nav"], f"{tag}: in the menu")
    await pg.set_input_files("input[data-vssup]", VID); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('[data-act=vss-ev]').click()"); await E("()=>document.querySelector('[data-act=vss-chunk][data-v=\"10\"]').click()")
    n0 = await E("()=>VSSD.items.length")
    await E("()=>document.querySelector('[data-act=vss-run]').click()")
    ok(await wait_for(E, f"()=>{{const r=vssSel();return VSSD.items.length>{n0}&&r&&r.status!=='running'}}", 60), f"{tag}: analysis finished")
    r["rec"] = await E("()=>{const r=vssSel();return r&&[r.status,r.chunks.length,r.summary&&r.summary.title,(r.summary&&r.summary.alerts||[]).length,r.chunks.filter(c=>c.events.some(e=>e.present)).length,r.error]}")
    ok(r["rec"] and r["rec"][0] == "complete" and r["rec"][1] == 4 and r["rec"][2] == "Street camera" and r["rec"][3] == 1 and r["rec"][4] == 1, f"{tag}: analysis {r['rec']}")
    if not (r["rec"] and r["rec"][0] == "complete"): await b.close(); return r
    await pg.wait_for_timeout(600)
    r["ui"] = await E("()=>[document.querySelectorAll('.vssres .vsst').length,document.querySelectorAll('.vssalert').length,!!document.querySelector('#vssv')]")
    ok(r["ui"][0] >= 3 and r["ui"][1] == 1 and r["ui"][2], f"{tag}: result view {r['ui']}")
    await E("()=>new Promise(res=>{const v=document.querySelector('#vssv');if(v.readyState>=1)res();else v.addEventListener('loadedmetadata',res,{once:true});setTimeout(res,4000)})")
    await E("()=>document.querySelector('.vssmom [data-act=vss-seek][data-t=\"30\"]').click()"); await pg.wait_for_timeout(700)
    r["seek"] = await E("()=>Math.round(document.querySelector('#vssv').currentTime)"); ok(r["seek"] >= 29, f"{tag}: key moment seeks the video ({r['seek']})")
    await E("()=>{document.querySelector('#vssq').value='When does the car arrive?';document.querySelector('[data-act=vss-ask]').click()}")
    ok(await wait_for(E, "()=>document.querySelectorAll('.vsschat .va').length>=1", 20), f"{tag}: answer shown")
    r["ans"] = await E("()=>{const a=document.querySelector('.vsschat .va');return [a.textContent.includes('00:20'),!!a.querySelector('[data-act=vss-seek]')]}"); ok(all(r["ans"]), f"{tag}: answer with timestamp {r['ans']}")
    # search
    await E("()=>document.querySelector('[data-act=vss-tab][data-v=search]').click()"); await pg.wait_for_timeout(300)
    await E("()=>{document.querySelector('#vsssq').value='red car turning';document.querySelector('[data-act=vss-search]').click()}")
    ok(await wait_for(E, "()=>S.vss.results&&document.querySelectorAll('.vsshit').length>0", 20), f"{tag}: search results")
    r["search"] = await E("()=>S.vss.results.map(h=>h.s)"); ok(r["search"] and min(r["search"]) >= 20, f"{tag}: search finds the red car parts {r['search']}")
    # alert check
    await E("()=>{S.vss.tab='alerts';S.vss.vsrc=VSSD.items[0].id;S.vss.vAlert='person falls';S.vss.vS=28;S.vss.vE=36;renderView()}"); await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('[data-act=vss-verify]').click()")
    ok(await wait_for(E, "()=>!!document.querySelector('#vssverdict .vverd')", 20), f"{tag}: verdict shown")
    r["verdict"] = await E("()=>VSSD.verdict&&VSSD.verdict.verdict"); ok(r["verdict"] == "confirmed", f"{tag}: verdict {r['verdict']}")
    # live alerts on a video, then on the (fake) camera
    await E("()=>{S.vss.wEvents='person falls';S.vss.wInt=5;document.querySelector('[data-act=vss-vid]').click()}")
    ok(await wait_for(E, "()=>VSSD.log.length>0", 15), f"{tag}: live check ran on a video")
    r["live"] = await E("()=>VSSD.log[0]&&VSSD.log[0].v"); ok(r["live"] == "confirmed", f"{tag}: live verdict {r['live']}")
    await E("()=>document.querySelector('[data-act=vss-stop]').click()"); await E("()=>{VSSD.log=[];document.querySelector('[data-act=vss-cam]').click()}")
    ok(await wait_for(E, "()=>VSSD.log.length>0", 15), f"{tag}: live check ran on the camera")
    await E("()=>go('home')"); await pg.wait_for_timeout(300); r["stopped"] = await E("()=>!VSSD.watch"); ok(r["stopped"], f"{tag}: leaving the page stops watching")
    # a moment to the editor
    await E("()=>{S.vss.tab='sum';go('vss')}"); await pg.wait_for_timeout(500)
    await E("()=>document.querySelector('.vssalert [data-act=vss-clip]').click()")
    ok(await wait_for(E, "()=>S.view==='edit'", 10), f"{tag}: clip sent to the editor")
    r["clip"] = await E("()=>{const c=S.ed.clips[S.ed.clips.length-1];return c&&[c.in,c.out]}"); ok(r["clip"] == [28, 36], f"{tag}: clip range {r['clip']}")
    ok(not errs, f"{tag}: page errors {errs}")
    await b.close(); return r

async def main():
    out = {}
    async with async_playwright() as p:
        for w in (390, 1280): out[w] = await run(p, w)
    return out

if __name__ == "__main__":
    mk = subprocess.Popen(["node", D + "/mock.js", str(LPORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(os.environ, PORT=str(PORT), SECRET_KEY="s" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", LLM_API_KEY="mock", LLM_BASE_URL=f"http://localhost:{LPORT}", LLM_MODEL="mock-vision"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        out = asyncio.run(main())
        st = json.loads(urllib.request.urlopen(f"http://localhost:{LPORT}/stats").read())
        ok(st["images"] >= 8, f"vision calls carried pictures ({st['images']})")
        # the NVIDIA VSS server connector
        api("/v1/admin/providers/vss", {"baseUrl": f"http://localhost:{LPORT}", "apiKey": "tok"}, "PUT")
        cfg = api("/v1/config"); ok(cfg.get("providers", {}).get("vss") is True, "config shows the VSS server")
        t = api("/v1/admin/providers/vss/test", {}); ok(t.get("state") == "online", f"VSS probe {t}")
        rec = api("/v1/vss", {"src": "/media/" + os.listdir(D + "/media")[0], "title": "remote", "events": "Person falls", "chunk": 10})
        for _ in range(40):
            rec = api("/v1/vss/" + rec["id"])
            if rec["status"] != "running": break
            time.sleep(.25)
        ok(rec["status"] == "complete" and rec["by"] == "vss" and "VSS summary" in rec["summary"]["summary"], f"VSS summarize {rec.get('status')} {rec.get('error')}")
        a = api(f"/v1/vss/{rec['id']}/ask", {"q": "what happens?"}); ok(a["answer"] == "VSS answer for vid-123", f"VSS chat {a}")
        st = json.loads(urllib.request.urlopen(f"http://localhost:{LPORT}/stats").read()); sm = [x for x in st["vss"] if "url" in x]
        ok(sm and sm[0]["enable_qa"] is True and sm[0]["events"] == ["Person falls"] and sm[0]["url"].startswith("http"), f"VSS request {sm[:1]}")
        # NVIDIA hosted models as the vision + text AI (no Claude/Qwen): a second server, OpenAI-compatible URL, then a VLM model URL
        D2 = tempfile.mkdtemp(prefix="nooi-vssnv-"); os.makedirs(D2 + "/data"); os.makedirs(D2 + "/media"); os.symlink(ROOT + "/public", D2 + "/public"); shutil.copy(VID, D2 + "/media/clip.webm")
        json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "jobs": {}, "ledger": []}}}, open(D2 + "/data/db.json", "w"))
        env2 = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_"))}
        srv2 = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D2, env=dict(env2, PORT="8078", SECRET_KEY="n" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL="http://localhost:8078", NVIDIA_API_KEY="nvapi-test", NVIDIA_BASE_URL=f"http://localhost:{LPORT}/nv"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            P0 = PORT; PORT = 8078
            for _ in range(80):
                try: urllib.request.urlopen("http://localhost:8078/v1/config", timeout=1); break
                except Exception: time.sleep(.25)
            lst = api("/v1/vss"); ok(lst["ai"] and lst["nvidia"], f"NVIDIA counts as the vision AI {lst.get('ai')} {lst.get('nvidia')}")
            def analyse(title):
                rec = api("/v1/vss", {"src": "/media/clip.webm", "title": title, "events": "Person falls", "chunk": 10})
                for _ in range(120):
                    rec = api("/v1/vss/" + rec["id"])
                    if rec["status"] != "running": break
                    time.sleep(.25)
                return rec
            rec = analyse("nv")
            ok(rec["status"] == "complete" and rec["by"] == "nooi" and rec["summary"]["title"] == "Street camera" and len(rec["chunks"]) == 4, f"NVIDIA analysis {rec.get('status')} {rec.get('error')}")
            a = api(f"/v1/vss/{rec['id']}/ask", {"q": "When does the car arrive?"}); ok("00:20" in a["answer"], f"NVIDIA answer {a}")
            v = api("/v1/vss/verify", {"src": "/media/clip.webm", "s": 30, "e": 36, "alert": "person falls"}); ok(v["verdict"] == "confirmed", f"NVIDIA verify {v}")
            st = json.loads(urllib.request.urlopen(f"http://localhost:{LPORT}/stats").read()); nvs = st["nv"]
            ok(nvs and all(x["auth"] == "Bearer nvapi-test" for x in nvs), "NVIDIA key sent as Bearer")
            ok(all(x["model"] == "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning" and x["rb"] for x in nvs if x["img"] and not x.get("vlm")) and any(x["img"] for x in nvs), "pictures: Nemotron Omni with a reasoning budget")
            ok(all(x["model"] == "nvidia/nemotron-3-super-120b-a12b" and not x["rb"] for x in nvs if not x["img"] and not x.get("vlm")) and any(not x["img"] for x in nvs), "text: Nemotron 3 Super")
            ok(all(x.get("len", 0) < 180000 for x in nvs if x["img"]), "pictures under NVIDIA's inline limit")
            # a single-model VLM URL (e.g. PaliGemma): plain-text answers still give captions, a summary and a verdict
            api("/v1/admin/providers/nvidia", {"baseUrl": f"http://localhost:{LPORT}/nv/vlm/google/paligemma"}, "PUT")
            rec = analyse("vlm")
            ok(rec["status"] == "complete" and rec["chunks"] and "red car" in rec["chunks"][0]["caption"] and rec["summary"]["summary"], f"VLM-only analysis {rec.get('status')} {rec.get('error')}")
            v = api("/v1/vss/verify", {"src": "/media/clip.webm", "s": 30, "e": 36, "alert": "person falls"}); ok(v["verdict"] in ("confirmed", "unsure"), f"VLM verify {v}")
            st = json.loads(urllib.request.urlopen(f"http://localhost:{LPORT}/stats").read()); ok(any(x.get("vlm") and x["img"] and x["model"] is None for x in st["nv"]), "VLM URL called without a model id, with the picture")
            PORT = P0
        finally:
            srv2.terminate(); shutil.rmtree(D2, ignore_errors=True)
        print(json.dumps({"fails": fails, "results": out}, ensure_ascii=False, default=str))
    finally:
        srv.terminate(); mk.terminate(); shutil.rmtree(D, ignore_errors=True)
