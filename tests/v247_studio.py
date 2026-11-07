# v247 (studio) — the classic editor's video scenes (made after the owner's reference videos) and formal stickers
#  · Titles → Motion graphics → Video scenes: 28 scenes (the 20 named effects, 5 picture showcases, Kinetic promo, Vlog kit,
#    App burst), every tile drawn, each one draws in the preview, moves, and draws the same picture at the same moment
#  · a showcase's picture slots take your own pictures (numbered, in order) and the preview shows them
#  · Stickers → Formal: seals, stamps, verified, awards, ribbons, ornaments; the stamps in Arabic in Arabic; one added as a picture
# Run: python3 tests/v247_studio.py
import asyncio, json, os, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8767; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v247s-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, timeout=120, stdin=subprocess.DEVNULL)
FF("-f", "lavfi", "-i", "color=c=0xff2050:s=600x800", "-frames:v", "1", D + "/red.png"); FF("-f", "lavfi", "-i", "color=c=0x20c0ff:s=600x800", "-frames:v", "1", D + "/blue.png")
json.dump({"users": {}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_", "NOOI_", "FREE_PERIOD", "RENDER_", "MINIMAX_", "SEEDANCE_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
fails = []
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:1200]))
P = "window.__studio.editor.project"
G3 = ["3d-title", "3d-coin", "3d-box", "3d-phone", "3d-particles", "3d-fly", "3d-chart", "3d-globe"]
DR = ["dr-paper", "dr-ink", "dr-riso", "dr-sketch", "dr-math", "dr-iso", "dr-pixel"]
LIT = """()=>{const c=document.querySelector('[data-testid=preview]'),g=c.getContext('webgl2'),W=c.width,H=c.height,d=new Uint8Array(W*H*4);g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,d);
let n=0,h=0;for(let i=0;i<d.length;i+=64){const v=d[i]+d[i+1]+d[i+2];if(v>60)n++;h=(h*31+(v>>3))%1000003}return{n,h}}"""
TILE = "(i)=>{const c=document.querySelector('[data-testid=mg-'+i+'] canvas');if(!c)return -1;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let k=3;k<d.length;k+=16)if(d[k]>40)n++;return n}"

SC = ["orbit", "chat", "frameEscape", "snapZoom", "checklistPop", "headlineStorm", "zoomPortal", "growthCurve", "studioReveal", "broll", "paperCut", "dollyZoom", "magazine", "liquidGlass", "zoomThrough", "greenScreen", "frameBreak", "digitalZoom", "phoneMockup", "checklist", "totem", "spread", "iso", "wheel", "deck", "promo", "vlog", "appburst"]
IDS = ["sc-" + x for x in SC]
async def studio(p):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page(); errs = []; E = pg.evaluate; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/studio/?new=1"); await pg.wait_for_function("window.__studio&&document.querySelector('[data-testid=preview]')", timeout=20000); await pg.wait_for_timeout(600)
    await pg.click('[data-testid="rail-media"]'); await pg.set_input_files('[data-testid="file-input"]', [D + "/red.png", D + "/blue.png"])
    await pg.wait_for_function("Object.values(" + P + ".assets).filter(a=>a.kind==='image'&&a.thumb).length===2", timeout=30000)
    await pg.click('[data-testid="rail-titles"]'); await pg.click('.panel .subtabs button:has-text("Motion graphics")'); await pg.wait_for_selector('[data-testid="motion-gallery"]')
    await pg.click('[data-testid="mgg-scenes"]'); await pg.wait_for_timeout(300)
    n = await E("()=>[...document.querySelectorAll('.mgal .mgt')].map(t=>t.dataset.testid)")
    for i in IDS: await pg.locator(f'[data-testid="mg-{i}"]').scroll_into_view_if_needed()
    await pg.wait_for_timeout(1500); blank = [[i, v] for i in IDS if (v := await E(TILE, i)) < 30]
    await pg.locator('[data-testid="mg-sc-orbit"]').scroll_into_view_if_needed(); await pg.screenshot(path=D + "/scenes.png")
    chk("Video scenes: the 28 scenes of the reference videos, every tile drawn", sorted(n) == sorted("mg-" + i for i in IDS) and not blank, [n, blank])
    bad = []
    for i in IDS:
        await E("(i)=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).filter(c=>c.type==='text').map(c=>c.id));s.actions.del();s.player.seek(0);s.actions.addMotion(i,0)}", i)
        dur = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).find(c=>c.type==='text').dur")
        await E("(t)=>window.__studio.player.seek(t)", dur * 0.3); await pg.wait_for_timeout(250); a = await E(LIT)
        await E("(t)=>window.__studio.player.seek(t)", dur * 0.7); await pg.wait_for_timeout(250); c = await E(LIT)
        await E("(t)=>window.__studio.player.seek(t)", dur * 0.3); await pg.wait_for_timeout(250); a2 = await E(LIT)
        if c["n"] < 40 or a["h"] == c["h"] or a["h"] != a2["h"]: bad.append([i, a, c, a2])
    chk("each scene draws in the preview, moves, and draws the same picture at the same moment", not bad, bad)
    # ---- a showcase with your pictures
    await E("()=>{const s=window.__studio;s.editor.select(s.editor.project.tracks.flatMap(t=>t.clips).filter(c=>c.type==='text').map(c=>c.id));s.actions.del();s.actions.addMotion('sc-totem',0);const c=s.editor.project.tracks.flatMap(t=>t.clips).find(c=>c.type==='text');s.editor.select([c.id]);s.player.seek(2.5)}")
    await pg.wait_for_timeout(500); before = await E(LIT)
    await pg.wait_for_selector('[data-testid="mgp-pics"]', timeout=10000)
    ids = await E("()=>Object.values(" + P + ".assets).filter(a=>a.kind==='image').map(a=>a.id)")
    for i in ids: await pg.click(f'[data-testid="mgp-pic-{i}"]'); await pg.wait_for_timeout(200)
    nums = await E("()=>[...document.querySelectorAll('[data-testid^=mgp-pic-] b')].map(b=>b.textContent)")
    await pg.wait_for_timeout(1200); after = await E(LIT)
    pics = await E("()=>" + P + ".tracks.flatMap(t=>t.clips).find(c=>c.type==='text').motion.props.pics")
    await pg.locator('[data-testid="preview"]').screenshot(path=D + "/totem.png")
    chk("a showcase takes your pictures (numbered in order) and the preview shows them", pics == ids and nums == ["1", "2"] and before["h"] != after["h"], [pics, ids, nums, before, after])
    # ---- formal stickers
    await pg.click('[data-testid="rail-stickers"]'); await pg.wait_for_timeout(400)
    f = await E("()=>[...document.querySelectorAll('[data-testid^=stk-f-]')].map(b=>b.dataset.testid)")
    await pg.locator('[data-testid="stk-f-seal"]').scroll_into_view_if_needed(); await pg.screenshot(path=D + "/formal.png")
    en = await E("()=>document.querySelector('[data-testid=stk-f-approved] img').src")
    na = await E("()=>Object.keys(" + P + ".assets).length"); await pg.click('[data-testid="stk-f-seal"]'); await pg.wait_for_function("Object.keys(" + P + ".assets).length>" + str(na), timeout=15000)
    await pg.click('[data-testid="lang"]'); await pg.wait_for_timeout(400); ar = await E("()=>document.querySelector('[data-testid=stk-f-approved] img').src")
    await pg.screenshot(path=D + "/formal-ar.png")
    chk("Formal stickers: 24, first in the panel; a seal added as a picture; the stamps drawn in Arabic in Arabic", len(f) == 24 and "APPROVED" in urllib.request.unquote(en) and "%D9%85%D8%B9%D8%AA%D9%85%D8%AF" in ar.upper(), [len(f), f[:4]])
    chk("studio: no page errors", not errs, errs); await b.close()

async def main():
    for _ in range(60):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.5)
    async with async_playwright() as p:
        try: await studio(p)
        except Exception as e: chk("studio crashed", False, repr(e)[:700])

try: asyncio.run(main())
finally: srv.terminate()
if fails: print("v247 studio FAIL\n - " + "\n - ".join(fails)); print("shots:", D); sys.exit(1)
if os.environ.get("KEEP"): print("shots:", D)
else: subprocess.run(["rm", "-rf", D])
print("v247 studio OK")
