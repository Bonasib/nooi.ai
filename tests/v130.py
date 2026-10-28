# v130 "I need # to pick the picture + I need to add pictures, not only a frame". A real nooi server, a stand-in engine that
# records every request, a stand-in text AI and the page:
#  · "+" in the Video prompt bar adds pictures to use (several at once, up to 6), a first frame or an end frame; each picture gets
#    a name (image1… / صورة1…) that can be changed in place, and adding one switches the engine to Seedance
#  · typing "#" lists the pictures (arrows + Enter, or a tap) and puts the name in the words; the names are tinted in the words
#    (a copy under the box that keeps its place); a picture the words use is marked; renaming renames it in the words
#  · Generate sends every picture as a reference to Seedance (reference_image_urls, no first-frame field) and each #name becomes
#    @Image1, @Image2…; Arabic names survive the English step (#ref1… go to the translator); the box empties, the pictures stay
#  · another engine is refused before anything is charged (with the reason in Arabic); more than 6 is refused; a long video by the
#    agents uses Seedance in every part; a video made elsewhere doesn't take the Video page's pictures
#  · on a phone and in Arabic the bar keeps to the screen
# Run: python3 tests/v130.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request, hashlib
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, KPORT = 8354, 8355
D = tempfile.mkdtemp(prefix="nooi-v130-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
TOKEN = "nooi_" + "r" * 32
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "cust": {"plan": "studio", "planUntil": 4102444800000, "credits": 3000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {},
           "tokens": [{"id": "tk", "name": "t", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1, "dailyCap": 1000000}]}}}, open(D + "/data/db.json", "w"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xd02020:s=640x360:r=10:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", D + "/res.mp4"], check=True)
for n, col in (("girl", (230, 180, 160)), ("can", (40, 120, 220)), ("shop", (90, 160, 90)), ("frame", (200, 200, 60))):
    im = Image.new("RGB", (512, 512), col); ImageDraw.Draw(im).ellipse([120, 120, 390, 390], fill=(255, 255, 255)); im.save(f"{D}/{n}.png"); im.save(f"{D}/media/{n}.png")
MOCK = r'''
import json, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
P, DIR = int(sys.argv[1]), sys.argv[2]; st = {"reqs": [], "tr": []}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/stats": return self.send(st)
        if u.path == "/res.mp4":
            b = open(DIR + "/res.mp4", "rb").read(); self.send_response(200); self.send_header("content-type", "video/mp4"); self.send_header("content-length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        return self.send({"code": 200, "data": {"state": "success", "resultJson": json.dumps({"resultUrls": [f"http://localhost:{P}/res.mp4"]})}})
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); j = json.loads(self.rfile.read(n) or b"{}"); u = urllib.parse.urlparse(self.path)
        if u.path.endswith("credit"): return self.send({"code": 200, "data": 5})
        if u.path == "/v1/messages":
            c = (j.get("messages") or [{}])[0].get("content"); parts = c if isinstance(c, list) else [{"type": "text", "text": str(c or "")}]
            text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text")
            if "into natural English" in text:   # a stand-in translator: keeps the #ref names it was given, nothing else
                st["tr"].append(text[-300:]); refs = [w for w in ("#ref1", "#ref2", "#ref3") if w in text]
                return self.send({"content": [{"type": "text", "text": "A girl " + (refs[0] if refs else "") + " drinks a cold can " + (refs[1] if len(refs) > 1 else "") + " in a shop."}]})
            return self.send({"content": [{"type": "text", "text": "{}"}]})
        st["reqs"].append({"path": u.path, "body": j}); return self.send({"code": 200, "data": {"taskId": "t%d" % len(st["reqs"])}})
ThreadingHTTPServer(("127.0.0.1", P), H).serve_forever()
'''
open(D + "/mock.py", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, tok=None):
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return {"_status": e.code, **json.loads(e.read() or b"{}")}
        except Exception: return {"_status": e.code}
stats = lambda: json.loads(urllib.request.urlopen(f"http://localhost:{KPORT}/stats").read())
tasks = lambda: [r["body"] for r in stats()["reqs"] if r["path"].endswith("createTask")]
def wait(fn, sec=40):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return None
wallet = lambda: api("/v1/billing", tok=TOKEN).get("credits")

# ---- the helpers on their own
node = subprocess.run(["node", "--input-type=module", "-e", """
import { refsOf130, tagWords130, seedanceRefs130, checkRefs130, asciiTags130 } from '@ROOT@/lib/refs130.js';
import { kieInput } from '@ROOT@/providers/kie.js';
process.env.PUBLIC_BASE_URL = 'https://n.example';
const meta = { refs130: [{ slot: 'vRef1', tag: 'girl' }, { slot: 'vRef2', tag: 'can' }, { slot: 'vRef3', tag: 'shop' }] }, inputs = { vRef1: '/media/g.png', vRef2: '/media/c.png', vRef3: '/media/s.png' };
const r = {};
r.words = tagWords130('#girl drinks the #can, #GIRL smiles. #hashtag #cans', refsOf130({ meta, inputs }), (i) => '@Image' + (i + 1));
const sd = kieInput('bytedance/seedance-2', { kind: 'video', model: 'seedance20', prompt: '#girl drinks the cold #can', dur: 8, aspect: '9:16', inputs: { ...inputs, vStart: '/media/f.png' }, meta });
r.sd = sd;
r.k = kieInput('kling-3.0/video', { kind: 'video', model: 'kling40', prompt: '#girl drinks the cold #can', dur: 5, aspect: '16:9', inputs, meta });
r.plain = kieInput('bytedance/seedance-2', { kind: 'video', model: 'seedance20', prompt: 'a cat', dur: 5, aspect: '16:9', inputs: { vStart: '/media/f.png' }, meta: {} });
r.swap = kieInput('bytedance/seedance-2', { kind: 'video', model: 'mcswap', prompt: '', dur: 5, inputs: { mcMove: '/media/m.mp4', mcChar: '/media/c.png', ...inputs }, meta: { ...meta, swap93: true } });
r.none = seedanceRefs130('', refsOf130({ meta, inputs }));
const refuse = (b) => { try { checkRefs130(b); return { ok: true, meta: b.meta }; } catch (e) { return { code: e.code, msg: e.message, ar: e.errorAr }; } };
r.kling = refuse({ kind: 'video', model: 'kling30', inputs, meta: { ...meta } });
r.seven = refuse({ kind: 'video', model: 'seedance20', inputs, meta: { refs130: [...Array(7)].map((_, i) => ({ slot: 'vRef' + ((i % 3) + 1), tag: 't' + i })) } });
r.parts = refuse({ kind: 'video', model: 'auto', inputs, meta: { ...meta, parts: 3, partModels: ['veo31', 'seedance25', 'kling30'] } });
r.image = refuse({ kind: 'image', model: 'nano', inputs, meta: { ...meta } });
const b = { kind: 'video', model: 'seedance20', prompt: 'فتاة #صورة1 تشرب #صورة2 الباردة', inputs, meta: { refs130: [{ slot: 'vRef1', tag: 'صورة1' }, { slot: 'vRef2', tag: 'صورة2' }] } };
asciiTags130(b); r.ascii = { prompt: b.prompt, title: b.title, meta: b.meta };
console.log(JSON.stringify(r));
""".replace("@ROOT@", ROOT)], cwd=D, capture_output=True, text=True, env=dict(os.environ, SECRET_KEY="v" * 40))
try: H = json.loads(node.stdout.strip().splitlines()[-1])
except Exception: H = {}; fails.append("helpers ran " + node.stderr[-600:])
out["helpers"] = H
if H:
    ok(H["words"] == "@Image1 drinks the @Image2, @Image1 smiles. #hashtag #cans", f"each #name of a picture becomes its @ImageN, any case; other # words stay {H['words']}")
    sd = H["sd"]
    ok(sd.get("reference_image_urls") == ["https://n.example/media/g.png", "https://n.example/media/c.png", "https://n.example/media/s.png", "https://n.example/media/f.png"] and "first_frame_url" not in sd and "last_frame_url" not in sd
       and sd["prompt"].startswith("@Image1 drinks the cold @Image2") and "Also use @Image3 as reference." in sd["prompt"] and "The video opens exactly on @Image4." in sd["prompt"]
       and sd.get("aspect_ratio") == "9:16" and sd.get("duration") == 8 and sd.get("web_search") is False, f"Seedance: every picture as a reference, the first frame as one more (no first-frame field), @ImageN in the words {sd}")
    ok(H["k"].get("image_urls") == ["https://n.example/media/g.png"] and "#" not in H["k"].get("prompt", "") and "girl drinks the cold can" in H["k"].get("prompt", ""), f"another engine (by an Admin model id): starts from the first picture, the names read as words {H['k']}")
    ok(H["plain"].get("first_frame_url") == "https://n.example/media/f.png" and "reference_image_urls" not in H["plain"], f"a plain Seedance video with a first frame is as before {H['plain']}")
    ok("@Video1" in H["swap"].get("prompt", "") and len(H["swap"].get("reference_image_urls") or []) == 1, f"Replace the person doesn't take the Video page's pictures {H['swap'].get('reference_image_urls')}")
    ok(H["none"]["prompt"].startswith("A video with @Image1, @Image2, @Image3, moving naturally.") and "exactly the visual style of these pictures" in H["none"]["prompt"], f"pictures and no words: the engine is still told what to do, in the pictures' own style {H['none']['prompt'][:200]}")
    ok(H["kling"].get("code") == 400 and "Seedance" in H["kling"].get("msg", "") and "Seedance" in (H["kling"].get("ar") or "") and "لم يُخصم" in (H["kling"].get("ar") or ""), f"another engine is refused with the reason, in Arabic too {H['kling']}")
    ok(H["seven"].get("code") == 400 and "6" in H["seven"].get("msg", ""), f"more than 6 pictures refused {H['seven']}")
    ok(H["parts"].get("ok") and H["parts"]["meta"]["partModels"] == ["seedance20", "seedance25", "seedance20"], f"a long video by the agents: every part on Seedance {H['parts']}")
    ok(H["image"].get("ok") and "refs130" not in H["image"]["meta"], f"a picture job just drops them {H['image']}")
    a = H["ascii"]
    ok(a["prompt"] == "فتاة #ref1 تشرب #ref2 الباردة" and a["title"] == "فتاة #صورة1 تشرب #صورة2 الباردة" and [x["tag"] for x in a["meta"]["refs130"]] == ["ref1", "ref2"] and a["meta"]["refs130"][0]["name"] == "صورة1",
       f"Arabic names → #ref1… before the English step; the title keeps the customer's words {a}")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- the server: a customer's video with two pictures, in Arabic
        n0 = len(tasks()); w0 = wallet()
        up = lambda n: "/media/" + n + ".png"
        r = api("/v1/jobs", {"kind": "video", "model": "seedance20", "prompt": "فتاة #صورة1 تشرب علبة #صورة2 باردة في متجر", "dur": 5, "aspect": "9:16", "cid": "v130-a",
                             "inputs": {"vRef1": up("girl"), "vRef2": up("can")}, "meta": {"refs130": [{"slot": "vRef1", "tag": "صورة1"}, {"slot": "vRef2", "tag": "صورة2"}]}}, tok=TOKEN)
        t = wait(lambda: len(tasks()) > n0 and tasks()[-1])
        inp = (t or {}).get("input", {}); out["server"] = {"job": {k: r.get(k) for k in ("id", "status", "cost", "_status", "error")}, "model": (t or {}).get("model"), "input": inp, "tr": stats()["tr"][-1:]}
        ok(r.get("id") and (t or {}).get("model") == "bytedance/seedance-2" and len(inp.get("reference_image_urls") or []) == 2 and str((inp.get("reference_image_urls") or [""])[0]).endswith("/media/girl.png")
           and "@Image1" in inp.get("prompt", "") and "@Image2" in inp.get("prompt", "") and "#" not in inp.get("prompt", "").split("\n")[0] and "first_frame_url" not in inp, f"the server: both pictures to Seedance, the names as @Image1 / @Image2 {out['server']}")
        ok(any("#ref1" in x and "#ref2" in x and "صورة1" not in x for x in stats()["tr"]), f"the translator got #ref1 / #ref2, not the Arabic names {stats()['tr'][-1:]}")
        j = wait(lambda: (lambda d: d if d.get("title") else None)(api("/v1/jobs/" + r.get("id", "x"), tok=TOKEN)), 10) or {}
        ok("#صورة1" in str(j.get("title", "")), f"the library keeps the customer's own words {j.get('title')}")
        n1 = len(tasks()); w1 = wallet()
        r2 = api("/v1/jobs", {"kind": "video", "model": "kling30", "prompt": "#image1 walks", "dur": 5, "cid": "v130-b", "inputs": {"vRef1": up("girl")}, "meta": {"refs130": [{"slot": "vRef1", "tag": "image1"}]}}, tok=TOKEN)
        ok(r2.get("_status") == 400 and "Seedance" in r2.get("error", "") and r2.get("errorAr") and len(tasks()) == n1 and wallet() == w1, f"another engine refused, nothing sent, nothing charged {r2} {w1} {wallet()}")

        # ---- the page on a computer
        ctx = await b.new_context(viewport={"width": 1280, "height": 860}); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;Object.assign(S.draft,{model:'kling30',dur:5,variations:1,prompt:'',refs130:[]});S.draft.startJob=null;delete M.vStart;delete M.vEnd;go('video')}")
        await pg.wait_for_timeout(700)
        await pg.click("#main .cz98 .add98"); await pg.wait_for_timeout(200)
        m = await E("()=>{const a=document.getElementById('am130'),r=a&&a.getBoundingClientRect();return{shown:!!a&&!a.hidden,items:a?[...a.querySelectorAll('.am130i b')].map(x=>x.textContent):[],inputs:a?[...a.querySelectorAll('input')].map(i=>i.dataset.kf||(i.hasAttribute('data-ref130')?'ref':'')+(i.multiple?'*':'')):[],top:r&&r.top,exp:document.querySelector('#main .cz98 .add98').getAttribute('aria-expanded')}}")
        out["menu"] = m
        ok(m["shown"] and m["items"] == ["Pictures to use", "First frame", "End frame"] and m["inputs"] == ["ref*", "vStart", "vEnd"] and m["exp"] == "true" and m["top"] > 0, f"'+' opens: pictures to use (several), first frame, end frame {m}")
        await pg.set_input_files("#am130 input[data-ref130]", [D + "/girl.png", D + "/can.png"]); await pg.wait_for_timeout(900)
        s = await E("()=>({names:[...document.querySelectorAll('#main .rf130 [data-ref130n]')].map(i=>i.value),model:S.draft.model,menu:!document.getElementById('am130')||document.getElementById('am130').hidden,imgs:[...document.querySelectorAll('#main .rf130 .rf130p img')].filter(i=>i.naturalWidth>0).length,refs:S.draft.refs130.length})")
        out["added"] = s
        ok(s["names"] == ["image1", "image2"] and s["model"] == "seedance20" and s["menu"] and s["imgs"] == 2 and s["refs"] == 2, f"two pictures added with names, the engine switched to Seedance 2.0, the menu closed {s}")
        await pg.click("#dprompt"); await pg.keyboard.type("Create UGC video where #"); await pg.wait_for_timeout(150)
        h = await E("()=>{const x=document.getElementById('hp130');return x?{opts:[...x.querySelectorAll('[role=option] b')].map(b=>b.textContent),sel:x.querySelector('[aria-selected=true] b')?.textContent,ad:document.getElementById('dprompt').getAttribute('aria-activedescendant')}:null}")
        out["hash"] = h
        ok(h and h["opts"] == ["#image1", "#image2"] and h["sel"] == "#image1" and h["ad"] == "hp130-0", f"'#' lists the pictures {h}")
        await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(100)
        await pg.keyboard.type("enjoys the frozen #im"); await pg.wait_for_timeout(120)
        h2 = await E("()=>[...document.querySelectorAll('#hp130 [role=option] b')].map(b=>b.textContent)")
        await pg.click("#hp130 [data-hp130='0']"); await pg.wait_for_timeout(120)
        await pg.keyboard.type("in a shop"); await pg.wait_for_timeout(150)
        v = await E("()=>({v:document.getElementById('dprompt').value,d:S.draft.prompt,open:!!document.getElementById('hp130'),used:[...document.querySelectorAll('#main .rf130i.used [data-ref130n]')].map(i=>i.value)})")
        out["typed"] = v
        ok(v["v"] == "Create UGC video where #image2 enjoys the frozen #image1 in a shop" and v["d"] == v["v"] and not v["open"] and v["used"] == ["image1", "image2"] and h2 == ["#image1", "#image2"],
           f"arrows + Enter and a tap put the names in the words; both pictures marked as used {v} {h2}")
        mr = await E("""()=>{const ta=document.getElementById('dprompt'),mr=document.querySelector('#main .cz98>.mr130'),a=ta.getBoundingClientRect(),b=mr&&mr.getBoundingClientRect(),mk=mr?[...mr.querySelectorAll('mark.tg130')]:[];
          const tr=document.createRange();tr.setStart(ta.firstChild||ta,0);
          return{n:mk.length,txt:mk.map(x=>x.textContent),same:!!b&&Math.abs(a.left-b.left)<1&&Math.abs(a.top-b.top)<1&&Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<1,
            inside:mk.every(x=>{const r=x.getBoundingClientRect();return r.left>=a.left-1&&r.right<=a.right+1&&r.top>=a.top-1&&r.bottom<=a.bottom+1}),under:getComputedStyle(mr).zIndex<getComputedStyle(ta).zIndex,font:getComputedStyle(mr).fontSize===getComputedStyle(ta).fontSize}}""")
        out["mirror"] = mr; await pg.screenshot(path=D + "/desk.png")
        ok(mr["n"] == 2 and mr["txt"] == ["#image2", "#image1"] and mr["same"] and mr["inside"] and mr["under"] and mr["font"], f"the names are tinted in the words, under the box, in place {mr}")
        # where the tint falls: the same place as the letters (measured on a copy laid out like the box)
        al = await E("""()=>{const ta=document.getElementById('dprompt'),mk=document.querySelector('#main .cz98>.mr130 mark.tg130');const d=document.createElement('div'),cs=getComputedStyle(ta);
          ['fontFamily','fontSize','fontWeight','letterSpacing','lineHeight','paddingTop','paddingRight','paddingBottom','paddingLeft','whiteSpace','overflowWrap','wordBreak','direction','boxSizing','borderTopWidth','borderLeftWidth','borderRightWidth','borderBottomWidth'].forEach(k=>d.style[k]=cs[k]);
          const a=ta.getBoundingClientRect();Object.assign(d.style,{position:'fixed',left:a.left+'px',top:a.top+'px',width:a.width+'px',borderStyle:'solid',borderColor:'transparent',visibility:'hidden'});
          const v=ta.value,i=v.indexOf('#image2');d.innerHTML='';d.append(v.slice(0,i));const s=document.createElement('span');s.textContent='#image2';d.append(s,v.slice(i+7));document.body.append(d);
          const r1=s.getBoundingClientRect(),r2=mk.getBoundingClientRect();d.remove();return{dx:Math.abs(r1.left-r2.left),dy:Math.abs(r1.top-r2.top),dw:Math.abs(r1.width-r2.width)}}""")
        out["align"] = al
        ok(al["dx"] < 1.5 and al["dy"] < 1.5 and al["dw"] < 1.5, f"the tint sits on the name's letters {al}")
        # rename image1 → girl: the words follow
        await pg.fill("#main .rf130 [data-ref130n='vRef1']", "girl"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(150)
        rn = await E("()=>({v:document.getElementById('dprompt').value,d:S.draft.prompt,tags:S.draft.refs130.map(r=>r.tag),marks:[...document.querySelectorAll('#main .mr130 mark')].map(x=>x.textContent)})")
        out["rename"] = rn
        ok(rn["v"] == "Create UGC video where #image2 enjoys the frozen #girl in a shop" and rn["d"] == rn["v"] and rn["tags"] == ["girl", "image2"] and rn["marks"] == ["#image2", "#girl"], f"renaming renames it in the words {rn}")
        await pg.fill("#main .rf130 [data-ref130n='vRef2']", "girl"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(150)
        dup = await E("()=>({tag:S.draft.refs130[1].tag,val:document.querySelector(\"#main .rf130 [data-ref130n='vRef2']\").value})")
        ok(dup == {"tag": "image2", "val": "image2"}, f"two pictures can't share a name {dup}")
        # Generate → Seedance with both pictures and the names as @Image1 / @Image2
        n2 = len(tasks())
        await pg.click("#main .cz98 [data-act='gen-video']")
        t2 = wait(lambda: len(tasks()) > n2 and tasks()[-1])
        i2 = (t2 or {}).get("input", {}); await pg.wait_for_timeout(400)
        after = await E("()=>({v:document.getElementById('dprompt').value,strip:[...document.querySelectorAll('#main .rf130 [data-ref130n]')].map(i=>i.value),job:(S.jobs.filter(j=>j.kind==='video').pop()||{}).meta?.refs130})")
        out["gen"] = {"model": (t2 or {}).get("model"), "input": i2, "after": after}
        ok((t2 or {}).get("model") == "bytedance/seedance-2" and len(i2.get("reference_image_urls") or []) == 2 and i2.get("prompt", "").startswith("Create UGC video where @Image2 enjoys the frozen @Image1 in a shop")
           and "first_frame_url" not in i2, f"Generate: Seedance gets both pictures and the words with @Image2 / @Image1 {out['gen']}")
        ok(after["v"] == "" and after["strip"] == ["girl", "image2"] and after["job"] == [{"slot": "vRef1", "tag": "girl"}, {"slot": "vRef2", "tag": "image2"}], f"the box is empty for the next idea, the pictures stay {after}")
        # another engine: Generate says so and makes nothing
        n3 = len(tasks())
        await E("()=>{S.draft.model='kling30';S.draft.prompt='#girl waves';renderView()}"); await pg.wait_for_timeout(1300)   # (a second Generate within 1.2 s is a double tap)
        jobs0 = await E("()=>{window.__t=[];toast=(o=>function(m){__t.push(String(m));return o.apply(this,arguments)})(toast);return S.jobs.length}")
        await pg.click("#main .cz98 [data-act='gen-video']"); await pg.wait_for_timeout(500)
        no = await E("()=>({jobs:S.jobs.length,toast:__t.join(' | ').slice(0,300)})")
        ok(no["jobs"] == jobs0 and len(tasks()) == n3 and "Seedance" in no["toast"], f"another engine: Generate says so and makes nothing {no}")
        # a video made elsewhere (a story, an ad…) doesn't take the Video page's pictures
        n4 = len(tasks())
        await E("()=>{S.draft.model='seedance20';addJob({kind:'video',prompt:'a lighthouse at night',model:'seedance20',dur:5,aspect:'16:9',cost:1,meta:{}})}")
        t4 = wait(lambda: len(tasks()) > n4 and tasks()[-1]); i4 = (t4 or {}).get("input", {})
        ok(t4 and "reference_image_urls" not in i4 and "@Image" not in i4.get("prompt", ""), f"a video made elsewhere doesn't take the pictures {i4}")
        # remove one; "#" with no pictures offers to add one, and its name goes in the words
        await pg.click("#main .rf130 [data-k='vRef2']"); await pg.wait_for_timeout(300)
        rm = await E("()=>({names:[...document.querySelectorAll('#main .rf130 [data-ref130n]')].map(i=>i.value),refs:S.draft.refs130.map(r=>r.tag),M:!!M.vRef2})")
        ok(rm == {"names": ["girl"], "refs": ["girl"], "M": False}, f"× removes a picture {rm}")
        await pg.click("#main .rf130 [data-k='vRef1']"); await pg.wait_for_timeout(300)
        await E("()=>{S.draft.prompt='';renderView()}"); await pg.wait_for_timeout(200)
        await pg.click("#dprompt"); await pg.keyboard.type("A shop #"); await pg.wait_for_timeout(150)
        e0 = await E("()=>({add:!!document.querySelector('#hp130 .hp130a input[data-hash130]'),strip:!!document.querySelector('#main .rf130')})")
        await pg.set_input_files("#hp130 input[data-hash130]", D + "/shop.png"); await pg.wait_for_timeout(700)
        e1 = await E("()=>({v:document.getElementById('dprompt').value,names:[...document.querySelectorAll('#main .rf130 [data-ref130n]')].map(i=>i.value)})")
        out["hashAdd"] = [e0, e1]
        ok(e0 == {"add": True, "strip": True} and e1["v"] == "A shop #image1 " and e1["names"] == ["image1"], f"'#' with no pictures: add one, its name goes in the words {out['hashAdd']}")
        # the frames show in the strip too
        await pg.click("#main .cz98 .add98"); await pg.set_input_files("#am130 input[data-kf='vStart']", D + "/frame.png"); await pg.wait_for_timeout(700)
        fr = await E("()=>({labels:[...document.querySelectorAll('#main .rf130 .rf130f figcaption')].map(x=>x.textContent),M:!!M.vStart,len:document.querySelector('[data-o93=length] .o93v')?.textContent})")
        ok(fr["labels"] == ["First frame"] and fr["M"] and "frames" in (fr["len"] or ""), f"a first frame from '+' shows in the strip {fr}")
        ok(not errs, f"no page errors on a computer {errs[:3]}")
        await ctx.close()

        # ---- a phone, in Arabic
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
        await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
        await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='ar';S.user={name:'T',method:'google'};AU.showAuth=false;Object.assign(S.draft,{model:'auto',dur:5,variations:1,prompt:'',refs130:[]});S.draft.startJob=null;delete M.vStart;delete M.vEnd;REF130.forEach(s=>delete M[s]);go('video');renderAll()}")
        await pg.wait_for_timeout(700)
        await pg.tap("#main .cz98 .add98"); await pg.wait_for_timeout(200)
        mm = await E("()=>{const a=document.getElementById('am130').getBoundingClientRect();return{l:a.left,r:a.right,t:a.top,w:innerWidth}}")
        ok(mm["l"] >= -1 and mm["r"] <= mm["w"] + 1 and mm["t"] >= 0, f"the menu keeps to a phone's screen {mm}")
        await pg.set_input_files("#am130 input[data-ref130]", [D + "/girl.png", D + "/can.png", D + "/shop.png"]); await pg.wait_for_timeout(900)
        await pg.tap("#dprompt"); await pg.keyboard.type("فتاة "); await pg.keyboard.type("#"); await pg.wait_for_timeout(150)
        await pg.tap("#hp130 [data-hp130='0']"); await pg.wait_for_timeout(120); await pg.keyboard.type("تشرب علبة #صورة2 باردة"); await pg.wait_for_timeout(200)
        ph = await E("""()=>{const ta=document.getElementById('dprompt'),a=ta.getBoundingClientRect(),st=document.querySelector('#main .rf130').getBoundingClientRect(),mk=[...document.querySelectorAll('#main .mr130 mark')];
          return{names:[...document.querySelectorAll('#main .rf130 [data-ref130n]')].map(i=>i.value),v:ta.value,model:S.draft.model,dir:document.documentElement.dir,marks:mk.map(m=>m.textContent),
            inside:mk.every(m=>{const r=m.getBoundingClientRect();return r.left>=a.left-1&&r.right<=a.right+1}),wide:document.documentElement.scrollWidth-innerWidth,strip:[st.left,st.right],above:st.bottom<=a.top+1}}""")
        out["phone"] = ph
        ok(ph["names"] == ["صورة1", "صورة2", "صورة3"] and ph["v"] == "فتاة #صورة1 تشرب علبة #صورة2 باردة" and ph["model"] == "auto" and ph["dir"] == "rtl" and ph["marks"] == ["#صورة1", "#صورة2"] and ph["inside"] and ph["wide"] <= 1
           and ph["strip"][0] >= -1 and ph["strip"][1] <= 391 and ph["above"], f"a phone in Arabic: Arabic names, nooi Auto kept (it takes pictures), the names tinted, the strip above the words, nothing off the screen {ph}")
        await pg.screenshot(path=D + "/phone.png")
        ok(not errs, f"no page errors on a phone {errs[:3]}")
        await ctx.close(); await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "LOCAL_LLM", "GEMMA_", "FREE_PERIOD", "NOOI_STAGE", "SWAP_ENGINE"))}
mk = subprocess.Popen([sys.executable, D + "/mock.py", str(KPORT), D], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
    KIE_API_KEY="kk", KIE_BASE_URL=f"http://localhost:{KPORT}", LLM_BASE_URL=f"http://localhost:{KPORT}", LLM_API_KEY="llm", LLM_MODEL="mock", MIRROR_MEDIA="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    wait(lambda: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2), 25)
    asyncio.run(main())
except Exception as e: fails.append("run: " + repr(e)[:400])
finally: srv.kill(); mk.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1)[:9000])
