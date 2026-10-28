# v123 in a real browser with a real nooi server (Arabic phone, computer) — what the A–Z check found:
#  · phones: a tool's pinned main button sits just above the bottom menu — no strip of the page showing between them
#    (it stood ~100 px higher: the menu's room was counted twice)
#  · the agents are nine everywhere: Home's nooi Studio button and the Film crew text say 9, never 8
#  · Account & plan: the bar of its parts has no name of a page beside it ("Top-up & usage", not "Credits")
#  · This device (Account): the graphics chip by its name, not the browser's driver line
# Run: python3 tests/v123.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8340
D = tempfile.mkdtemp(prefix="nooi-v123-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)

async def run(b, W, H, lang, tag):
    ctx = await b.new_context(viewport={"width": W, "height": H}, is_mobile=W < 600, has_touch=W < 600); pg = await ctx.new_page(); E = pg.evaluate; errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
    await E("(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';renderAll()}", lang)
    out[tag] = {}
    if W < 600:
        for v in ["motion", "ugcads", "slideshow", "vss"]:
            g = await E("""(v)=>{go(v);renderAll();document.getElementById('main').scrollTop=0;const b=document.querySelector('#main .go118 .btn'),n=document.getElementById('bottomnav');
              return b?{bot:Math.round(b.getBoundingClientRect().bottom),nav:Math.round(n.getBoundingClientRect().top)}:null}""", v)
            out[tag][v] = g
            ok(g and 0 <= g["nav"] - g["bot"] <= 20, f"{tag} {v}: the pinned button sits just above the bottom menu {g}")
    # nine agents
    t = await E("""()=>{S.hf.tab='video';go('home');renderAll();const b=document.querySelector('#main .hfmi.eng171');go('crew');renderAll();
      return {title:b?b.title:'',all:document.getElementById('main').outerHTML.match(/(\\b8 AI agents|Eight AI agents|8 وكلاء|ثمانية وكلاء)/g)||[],desc:TOOLDESC.crew[S.lang==='ar'?1:0]}}""")
    out[tag]["agents"] = t
    ok(("9 AI agents" in t["title"] or "9 وكلاء" in t["title"]) and not t["all"] and ("Nine" in t["desc"] or "تسعة" in t["desc"]), f"{tag}: nine agents everywhere {t}")
    # Account: the bar's names are not the names of the pages beside it
    a = await E("""()=>{go('account');renderAll();const V=document.querySelector('#main>.view');const bar=[...V.querySelectorAll('.secbar122 button')].map(b=>b.textContent.trim()),tabs=[...V.querySelectorAll('.hubtabs [data-go]')].map(b=>b.textContent.trim());
      return {bar,tabs,same:bar.filter(x=>tabs.includes(x))}}""")
    out[tag]["account"] = a
    ok(len(a["bar"]) == 5 and not a["same"], f"{tag}: Account's parts have no name of a page beside them {a}")
    # This device: the chip's name
    d = await E("""()=>{const g=s=>gpuName123(s);return {m1:g('ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)'),rtx:g('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'),
      intel:g('ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)'),adreno:g('ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)'),soft:g('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'),
      shown:(()=>{const k=[...document.querySelectorAll('#devpanel .devkv span')];return k[1]?k[1].textContent:''})()}}""")
    out[tag]["gpu"] = d
    ok(d["m1"] == "Apple M1" and d["rtx"] == "NVIDIA GeForce RTX 3060" and d["intel"] == "Intel UHD Graphics 620" and d["adreno"] == "Adreno 740" and "ANGLE" not in d["soft"] and d["shown"] and "ANGLE" not in d["shown"],
       f"{tag}: the graphics chip by its name {d}")
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
