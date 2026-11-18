# v158 "make the list run across, not down, when choosing in the prompt box". The page on a phone:
#  · Home box, "@": the characters come as one row of chips (face + name) as wide as the box and short — not a tall list; on
#    screen; a sideways swipe moves along the row and neither picks nor closes it; a tap puts the character in; ↓ moves the choice
#    and keeps it in view; the same in Arabic (right to left)
#  · Video page, "#": the pictures come as one row of chips too
# Run: python3 tests/v158.py
import asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8477; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v158-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
for i, c in enumerate(["0xc08060", "0x6080c0", "0x60c080"]):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c={c}:s=128x128", "-frames:v", "1", f"{D}/media/f{i}.png"], check=True)
fails, out = [], {}
def ok(c, m):
    if not c: fails.append(m)
def wait(fn, sec=30):
    for _ in range(int(sec * 4)):
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
async def touch(cdp, pts, ms=16):
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": pts[0][0], "y": pts[0][1]}]})
    for x, y in pts[1:]:
        await asyncio.sleep(ms / 1000); await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y}]})
    await asyncio.sleep(ms / 1000); await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
NAMES = ["Rami", "Lina", "Omar Al Farsi", "Sara", "Yousef", "Noura", "Khalid", "Maya"]
ROW = """()=>{const el=AT87.el;if(!el)return null;const r=el.getBoundingClientRect(),bs=[...el.querySelectorAll('button')].map(b=>b.getBoundingClientRect()),ta=AT87.ta.getBoundingClientRect();
  return {n:bs.length,flex:getComputedStyle(el).flexDirection,h:r.height,w:r.width,taw:ta.width,top:r.top,bottom:r.bottom,ih:innerHeight,left:r.left,right:r.right,iw:innerWidth,
    sameRow:bs.every(b=>Math.abs(b.top-bs[0].top)<2),across:bs.slice(1).every((b,i)=>Math.abs(b.left-bs[i].left)>20),over:el.scrollWidth>el.clientWidth,sl:el.scrollLeft}}"""

async def run_lang(b, lang):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); cdp = await ctx.new_cdp_session(pg)
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    async def E(js, arg=None): return await asyncio.wait_for(pg.evaluate(js, arg), 60)
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("""([l,names])=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;
      S.chars=names.map((n,i)=>({id:'c'+i,name:n,photo:'/media/f'+(i%3)+'.png'}));S.hf.tab='video';go('home');renderAll()}""", [lang, NAMES]); await pg.wait_for_timeout(500)
    tag = "en" if lang == "en" else "ar"
    await E("()=>{const q=$('#hfq');q.focus();q.value='@';q.setSelectionRange(1,1);q.dispatchEvent(new Event('input',{bubbles:true}))}"); await pg.wait_for_timeout(250)
    r = await E(ROW); out[tag + "_row"] = r
    ok(r and r["n"] == len(NAMES) and r["flex"] == "row" and r["sameRow"] and r["across"], f"{tag}: @ shows the characters across in one row {r}")
    fc = await E("()=>{const ps=[...AT87.el.querySelectorAll('.ph')].map(p=>p.getBoundingClientRect()),bs=[...AT87.el.querySelectorAll('button')].map(b=>b.getBoundingClientRect());return ps.every((p,i)=>p.width>=30&&p.left>=bs[i].left-1&&p.right<=bs[i].right+1)}")
    ok(fc, f"{tag}: each chip shows its own face inside it")
    ok(r and r["h"] < 80 and abs(r["w"] - min(max(r["taw"], 260), r["iw"] - 16)) < 3 and r["top"] >= 0 and r["bottom"] <= r["ih"] and r["left"] >= 0 and r["right"] <= r["iw"], f"{tag}: short, as wide as the box, on screen {r}")
    if r and r["over"]:
        y = (r["top"] + r["bottom"]) / 2; x0, x1 = (r["right"] - 30, r["left"] + 30) if lang == "en" else (r["left"] + 30, r["right"] - 30)
        await touch(cdp, [(x0 + (x1 - x0) * i / 10, y + (i % 2)) for i in range(11)]); await pg.wait_for_timeout(400)
        r2 = await E(ROW); v = await E("()=>$('#hfq').value")
        ok(r2 and abs(r2["sl"] - r["sl"]) > 20 and v == "@", f"{tag}: a sideways swipe moves along the row, doesn't pick, doesn't close {r2 and r2['sl']} {v!r}")
    await E("()=>{const q=$('#hfq');q.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));q.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))}"); await pg.wait_for_timeout(150)
    s = await E("()=>{const el=AT87.el,on=el&&el.querySelector('[aria-selected=\"true\"]');if(!on)return null;const a=on.getBoundingClientRect(),b=el.getBoundingClientRect();return {i:+on.dataset.i,seen:a.left>=b.left-1&&a.right<=b.right+1}}")
    ok(s and s["i"] == 2 and s["seen"], f"{tag}: ↓ moves the choice along the row and keeps it in view {s}")
    bt = await E("()=>{const b=AT87.el.querySelector('[data-i=\"3\"]');const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
    await touch(cdp, [(bt[0], bt[1])]); await pg.wait_for_timeout(300)
    v = await E("()=>$('#hfq').value"); ok(v.startswith("@Sara"), f"{tag}: a tap puts the character in {v!r}")
    # the Video page: # pictures across
    await E("()=>{go('video');renderAll()}"); await pg.wait_for_timeout(700)
    await pg.set_input_files("#main input[type=file][data-ref130]", [D + "/media/f0.png", D + "/media/f1.png", D + "/media/f2.png"]); await pg.wait_for_timeout(800)
    await E("()=>{const t=$('#dprompt');t.focus();t.value='#';t.setSelectionRange(1,1);t.dispatchEvent(new Event('input',{bubbles:true}))}"); await pg.wait_for_timeout(300)
    h = await E("""()=>{const b=document.getElementById('hp130');if(!b)return null;const os=[...b.querySelectorAll('.hp130o')].map(o=>o.getBoundingClientRect());
      return {n:os.length,flex:getComputedStyle(b).flexDirection,sameRow:os.every(o=>Math.abs(o.top-os[0].top)<2),h:b.getBoundingClientRect().height}}""")
    out[tag + "_hash"] = h; ok(h and h["n"] == 3 and h["flex"] == "row" and h["sameRow"] and h["h"] < 80, f"{tag}: # on the Video page shows the pictures across {h}")
    ok(not errs, f"{tag}: page errors {errs}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "ar"): await run_lang(b, lang)
        await b.close()

env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "FREE_PERIOD", "NOOI_STAGE"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"),
    stdout=subprocess.DEVNULL, stderr=open(D + "/server.log", "w"))
try:
    wait(lambda: urllib.request.urlopen(B + "/v1/config", timeout=2), 30); asyncio.run(main())
except Exception:
    import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
finally:
    srv.kill()
print(json.dumps({"fails": fails, "out": out, "dir": D}, ensure_ascii=False, indent=1, default=str)[:5000])
if not fails: shutil.rmtree(D, ignore_errors=True)
sys.exit(1 if fails else 0)
