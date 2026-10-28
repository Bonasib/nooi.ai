# v162 "try Claude's MCP with nooi.ai — make me motion-graphics videos, and while making them find the mistakes and fix them with
# code". A real nooi server, an AI client on /mcp (as Claude would be) and the user's editor open in a browser:
#  · the agent starts from nothing (nooi_project_new — before, only the app could make a project, and only with a clip in it)
#  · nooi_preview_frame shows the frame exactly as the editor draws it (motion scenes, texts) when the project is open in nooi's
#    editor — the request rides on the editor's 4-second sync and comes back as a picture; without an open editor: what is on
#    screen, in words (before: an error for every motion scene)
#  · nooi_motion_scene_edit changes or removes a scene, live in the open editor (its toast says so — a motion ad used to say
#    nothing after "Your AI agent"); nooi_export has the open editor export the file and gives its address
#  · the export is sharp: "high" quality is a real bitrate held constant (it was ~0.2 Mbit/s for a 1080×1920 ad)
#  · a project opened from the account keeps its name (the next save renamed it "Edit · 1 clips · …")
#  · the planner with no text AI: every line of the brief becomes a scene in its order, lines split at a natural break, a second
#    number, lists "A, B and C" / "A و B و C" (not "واحد" cut in two), Arabic digits, the call to action on the end card
#  · the scenes on a tall (9:16) frame are drawn 1.33× bigger; a long title on two lines
# Run: python3 tests/v162.py
import asyncio, base64, hashlib, io, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8488; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v162-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "c" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 50000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
  "tokens": [{"id": "tk", "name": "Claude", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(D + "/data/db.json", "w"))
fails, out = [], {}; n = [0]
def ok(c, m):
    if not c: fails.append(m)
def mcp(method, params=None):
    n[0] += 1; req = urllib.request.Request(B + "/mcp", data=json.dumps({"jsonrpc": "2.0", "id": n[0], "method": method, **({"params": params} if params is not None else {})}).encode(), method="POST", headers={"content-type": "application/json", "authorization": "Bearer " + TOKEN})
    with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read() or b"{}")
def tool(name, args):
    r = mcp("tools/call", {"name": name, "arguments": args}).get("result", {}); txt = "\n".join(c["text"] for c in r.get("content", []) if c.get("type") == "text")
    img = next((c["data"] for c in r.get("content", []) if c.get("type") == "image"), None); return r, txt, img
def J(t):
    try: return json.loads(t)
    except Exception: return {}
BRIEF = "nooi.ai turns one sentence into a finished video. 8 AI agents plan, film and edit it for you. Kling 4.0, Veo 3.1 and Seedance in one studio. 120000 videos made. Start free at nooi.ai"

def planner():
    js = subprocess.run(["node", "--input-type=module", "-e", """import { plan150, split150 } from './public/editor150/plan.js';
      const k=(b)=>plan150(b).map(s=>({sc:s.sc,t1:s.t1,t2:s.t2,items:s.items,val:s.val}));
      console.log(JSON.stringify({en:k({brand:'nooi.ai',msg:%s,len:20}),
        ar:k({brand:'نوي',msg:'نوي يحوّل جملة واحدة إلى فيديو كامل. Kling 4.0 و Veo 3.1 و Seedance في استوديو واحد. ١٢٠٠٠٠ فيديو صُنع. ابدأ مجاناً على nooi.ai',len:20}),
        lingo:k({brand:'Lingo',msg:'Learn any skill in 5 minutes a day. Keep a 369 day streak and climb the league with friends. Talk to a tutor on a video call. Pick from: languages, math, music, chess. One app. Every skill.',len:30}).map(s=>s.sc),
        split:[split150('nooi.ai turns one sentence into a finished video'),split150('Your characters keep their face and voice'),split150('Fresh coffee')]}))""" % json.dumps(BRIEF)], cwd=ROOT, capture_output=True, text=True, timeout=30)
    o = J(js.stdout.strip().splitlines()[-1] if js.stdout.strip() else "{}"); out["plan"] = o
    en = o.get("en") or []; kinds = [s["sc"] for s in en]
    ok(kinds == ["logo", "trail", "words", "counter", "nodes", "counter", "end"], f"every line becomes a scene, in order {kinds}")
    ok(en and en[2]["t1"] == "nooi.ai turns one sentence" and en[2]["t2"] == "into a finished video", f"a line split at its natural break {en[2] if en else None}")
    ok([s.get("val") for s in en if s["sc"] == "counter"] == [8, 120000] and [s["t1"] for s in en if s["sc"] == "counter"] == ["AI agents", "videos made"], "two numbers, a version number in a name ('4.0') isn't one")
    ok(next((s["items"] for s in en if s["sc"] == "nodes"), None) == ["Kling 4.0", "Veo 3.1", "Seedance"], "'A, B and C in one studio' → three names")
    ok(en and en[-1]["t2"] == "Start free at nooi.ai" and not any(s["sc"] == "words" and "Start free" in (s["t1"] + s["t2"]) for s in en), "the call to action goes on the end card, once")
    ar = o.get("ar") or []
    ok(next((s["items"] for s in ar if s["sc"] == "nodes"), None) == ["Kling 4.0", "Veo 3.1", "Seedance"] and 120000 in [s.get("val") for s in ar] and ar[-1]["t2"] == "ابدأ مجاناً على nooi.ai", f"Arabic: 'A و B و C', ١٢٠٠٠٠, the end card {ar}")
    ok(o.get("lingo") == ["logo", "trail", "words", "phone", "counter", "board", "call", "nodes", "words", "end"], f"the v150 brief keeps its scenes {o.get('lingo')}")
    ok(o.get("split") == [["nooi.ai turns one sentence", "into a finished video"], ["Your characters keep", "their face and voice"], ["Fresh coffee", ""]], f"splits {o.get('split')}")

async def session():
    names = [t["name"] for t in mcp("tools/list").get("result", {}).get("tools", [])]
    ok(all(x in names for x in ["nooi_project_new", "nooi_export", "nooi_motion_scene_edit", "nooi_preview_frame"]), "the agent's new tools are listed")
    _, txt, _ = tool("nooi_project_new", {"name": "Promo for nooi", "format": "reels"}); pid = J(txt).get("project_id"); out["new"] = txt[:300]
    ok(pid and J(txt).get("size") == "1080x1920", f"a new empty project {txt[:200]}")
    r, txt, _ = tool("nooi_motion_ad", {"project_id": pid, "brand": "nooi.ai", "brief": BRIEF, "seconds": 12, "colour": "#7CFF4F"}); tl = J(txt).get("timeline") or {}
    sc = tl.get("motion_scenes") or []; out["scenes"] = sc
    ok(len(sc) >= 6 and any(s.get("number") == 120000 for s in sc) and any(s.get("items") == ["Kling 4.0", "Veo 3.1", "Seedance"] for s in sc), f"the motion ad; the timeline says what each scene shows {sc}")
    words = next(s for s in sc if s["kind"] == "words"); mid = (words["start"] + words["end"]) / 2
    r, txt, img = tool("nooi_preview_frame", {"project_id": pid, "time": mid}); j = J(txt)
    ok(not r.get("isError") and img is None and (j.get("on_screen") or {}).get("motion_scenes", [{}])[0].get("title") == words["title"] and "Open this project" in j.get("note", ""), f"no editor open: what's on screen, in words {txt[:300]}")
    r, txt, _ = tool("nooi_export", {"project_id": pid}); ok(r.get("isError") and "No editor has this project open" in txt, f"export with no editor open says what to do {txt[:200]}")
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1280, "height": 900})).new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=20000)
        await pg.evaluate("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false}")
        await pg.evaluate("(id)=>open139(id)", pid); await pg.wait_for_function("S.view==='edit'&&document.getElementById('wk')", timeout=20000); await pg.wait_for_timeout(5000)
        # the frame as the editor draws it
        t0 = time.time(); r, txt, img = await asyncio.to_thread(tool, "nooi_preview_frame", {"project_id": pid, "time": mid}); took = round(time.time() - t0, 1)
        out["frame"] = {"took": took, "txt": txt[:200]}
        if img:
            f = D + "/f.jpg"; open(f, "wb").write(base64.b64decode(img))
            px = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", "scale=108:192", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True).stdout
            wh = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip(); out["frame"].update(size=wh, lit=round(sum(px) / max(1, len(px)), 1), hi=sum(1 for x in px if x > 170))
            ok(J(txt).get("drawn_by") == "nooi's editor" and wh == "405,720" and out["frame"]["hi"] >= 20 and took < 15, f"the frame drawn by the open editor, with the scene's bright words {out['frame']}")
        else: ok(False, f"no picture from the open editor {txt[:300]}")
        # the agent changes a scene: live in the editor, its toast says so
        r, txt, _ = await asyncio.to_thread(tool, "nooi_motion_scene_edit", {"project_id": pid, "scene_id": words["scene_id"], "title": "One sentence.", "subtitle": "A finished video."})
        ok(not r.get("isError") and any(s.get("title") == "One sentence." for s in (J(txt).get("timeline") or {}).get("motion_scenes", [])), f"the scene changed on the server {txt[:200]}")
        await pg.wait_for_function("(S.ed.infos||[]).some(x=>x.t1==='One sentence.')", timeout=15000)
        live = await pg.evaluate("()=>({chat:(S.ed.chat143||[]).map(x=>x.t).slice(-2),say:opSay148({op:'motion_add',args:{infos:[1,2,3]}}),title:S.ed.title})")
        out["live"] = live
        ok(any("changed a motion scene" in x for x in live["chat"]) and live["say"] == "built a motion ad", f"live in the open editor; the toasts say what the agent did {live}")
        ok(live["title"] == "Promo for nooi", f"the project keeps its name in the editor {live['title']}")
        r, txt, _ = await asyncio.to_thread(tool, "nooi_motion_scene_edit", {"project_id": pid, "scene_id": "nope"}); ok(r.get("isError") and "nooi_timeline_read" in txt, "an unknown scene says where to find them")
        # the scenes on a tall frame: 1.33× bigger than on a square one (the same scene)
        sz = await pg.evaluate("""()=>{const it={id:'z1',type:'mg150',sc:'logo',start:0,end:3,t1:'Hi',t2:'',x:.5,y:.5,k:1,anim:'none',bg:'dark',accent:'#7CFF4F'},c=document.createElement('canvas').getContext('2d');
          const h=(W,H)=>{ED.hit=[];mgDraw150(c,W,H,2,it);const r=ED.hit.find(x=>x.id==='z1');return r.h};return {tall:h(1080,1920),square:h(1080,1080),wide:h(1920,1080)}}""")
        ok(abs(sz["tall"] / sz["square"] - 1.33) < 0.03 and abs(sz["wide"] / sz["square"] - 1) < 0.01, f"tall frames draw the scenes bigger {sz}")
        two = await pg.evaluate("()=>{const c=document.createElement('canvas').getContext('2d');return [split162(c,'nooi.ai turns one sentence',800,160,500).l.length,split162(c,'Hi there',800,160,500).l.length]}")
        ok(two == [2, 1], f"a long title on two lines, a short one on one {two}")
        # the export, through the agent
        r, txt, _ = await asyncio.to_thread(tool, "nooi_export", {"project_id": pid}); rid = J(txt).get("render_id"); st = {}
        for _ in range(100):
            if not rid: break
            await asyncio.sleep(3); r, txt, _ = await asyncio.to_thread(tool, "nooi_export", {"project_id": pid, "render_id": rid}); st = J(txt)
            if st.get("state") in ("done", "failed"): break
        out["export"] = st
        if st.get("url"):
            f = D + "/v." + st["url"].rsplit(".", 1)[-1]; urllib.request.urlretrieve(st["url"], f)
            pr = J(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", f], capture_output=True, text=True).stdout)
            v = next((s for s in pr.get("streams", []) if s.get("codec_type") == "video"), {}); fm = pr.get("format", {}); out["file"] = [v.get("width"), v.get("height"), fm.get("duration"), fm.get("bit_rate")]
            ok(v.get("width") == 1080 and v.get("height") == 1920 and abs(float(fm.get("duration", 0)) - 12) < 0.5 and int(fm.get("bit_rate", 0)) > 1_000_000, f"the exported file: 1080×1920, 12 s, a real bitrate (was ~0.2 Mbit/s) {out['file']}")
        else: ok(False, f"the export finished with a file {st}")
        await pg.wait_for_timeout(5500)   # (the editor's own save goes up with the project's name)
        ok(not errs, f"page errors {errs}"); await b.close()
    lst = J(tool("nooi_editor_projects", {})[1]).get("projects", [])
    ok(any(p_["project_id"] == pid and p_["name"] == "Promo for nooi" for p_ in lst), f"the project's name after the editor saved it {lst}")

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "ELEVENLABS_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    for _ in range(120):
        try: urllib.request.urlopen(B + "/v1/config", timeout=2); break
        except Exception: time.sleep(.25)
    planner(); mcp("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}}); asyncio.run(session())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1, default=str)[:9000])
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
