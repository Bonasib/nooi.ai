# v128 — six more interface languages (Indonesian, Vietnamese, Polish, Ukrainian, Bengali, Urdu), with a real nooi server and a
# real browser:
#  · each is in the language list with its own name, Urdu reads right to left; the shipped translations load at once (the landing,
#    the menu, the sign-in — "Start free" is in the language) and keep their numbers; each file is marked for a native speaker's review
#  · the script's web font is the page's font and the fallback inside --sans (Bengali: Noto Sans Bengali; Urdu: Vazirmatn)
#  · the visitor's time zone suggests the language (Jakarta → Indonesian, Karachi → Urdu …)
#  · the server translates the rest of the interface for them (they're on its list); the FAQ and the landing say 32 languages
#  · Vietnamese, Polish, Ukrainian and Bengali are also there for subtitles, dubbing and voice
# Run: python3 tests/v128.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8350
D = tempfile.mkdtemp(prefix="nooi-v128-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 50, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
NEW = {"id": ("Bahasa Indonesia", "Masuk", "ltr"), "vi": ("Tiếng Việt", "Đăng nhập", "ltr"), "pl": ("Polski", "Zaloguj się", "ltr"),
       "uk": ("Українська", "Увійти", "ltr"), "bn": ("বাংলা", "সাইন ইন", "ltr"), "ur": ("اردو", "سائن ان", "rtl")}

async def main():
    # the files
    chk = subprocess.run(["node", ROOT + "/i18n/build.mjs", "--check"], capture_output=True, text=True)
    ok(chk.returncode == 0, f"every shipped translation is complete and up to date {chk.stdout[-400:]}")
    for l in NEW:
        txt = open(f"{ROOT}/i18n/{l}.txt", encoding="utf8").read(); js = json.load(open(f"{ROOT}/public/i18n/{l}.json", encoding="utf8"))
        ok(txt.startswith("# review:") and len(js) == 379 and js.get("Sign in") == NEW[l][1], f"{l}: 379 strings, marked for a native speaker's review, 'Sign in' = {js.get('Sign in')!r}")
        ok("32" in js.get("Subtitles and dubbing in 35 languages with regional dialects — Saudi, Egyptian, Kuwaiti, Tunisian, British, Australian, Scottish and many more. The interface itself comes in 32 languages.", ""), f"{l}: the FAQ says 32 interface languages")
    srvl = subprocess.run(["node", "--input-type=module", "-e", f"import {{ uiLang }} from '{ROOT}/lib/uit.js'; console.log(JSON.stringify({list(NEW)}.map(uiLang)))"], cwd=D, capture_output=True, text=True, env=dict(os.environ, SECRET_KEY="v" * 40))
    ok(srvl.stdout.strip() == json.dumps(list(NEW)).replace(" ", ""), f"the server translates the rest of the interface for them {srvl.stdout.strip()} {srvl.stderr[-200:]}")
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "KIE_", "FAL_", "GOOGLE_", "FIREBASE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            b = await p.chromium.launch()
            # each language on a phone: the list, the direction, the shipped words, the font
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
            await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
            base = await E("()=>({n:UI_LANGS.length,stat:[...document.querySelectorAll('.lpn')].map(x=>x.textContent),dub:['vi','pl','uk','bn','id','ur'].filter(c=>LANGS.some(x=>x[0]===c)),subs:['id','vi','pl','uk','bn','ur'].filter(c=>LP_SUBS.some(x=>x[0]===c))})")
            out["base"] = base
            ok(base["n"] == 32 and len(base["dub"]) == 6 and len(base["subs"]) == 6, f"32 interface languages; the six are there for subtitles & dubbing and on the landing's line {base}")
            for l, (name, signin, d) in NEW.items():
                r = await E("""async([l])=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user=null;AU.showAuth=false;setUILang(l);document.getElementById('modalRoot').innerHTML='';
                  for(let i=0;i<40&&!(UI_T[l]&&UI_T[l]['Sign in']);i++)await new Promise(r=>setTimeout(r,100));renderAll();await new Promise(r=>setTimeout(r,300));
                  const u=UI_LANGS.find(x=>x[0]===l),css=document.getElementById('uifontcss').textContent;
                  return {name:u&&u[1],dir:document.documentElement.dir,lang:document.documentElement.lang,t:(UI_T[l]||{})['Sign in'],page:document.body.innerText.includes((UI_T[l]||{})['Start free']||'@@')&&!document.body.innerText.includes('Start free'),
                    sans:getComputedStyle(document.documentElement).getPropertyValue('--sans'),font:(css.match(new RegExp('html\\\\[lang="'+l+'"\\\\] body[^{]*\\\\{font-family:([^,;]+)'))||[])[1]||'',wide:document.documentElement.scrollWidth-innerWidth}}""", [l])
                out[l] = {k: (v[:60] if isinstance(v, str) else v) for k, v in r.items()}
                ok(r["name"] == name and r["dir"] == d and r["lang"] == l and r["t"] == signin and r["page"] and r["wide"] <= 1, f"{l}: listed as {name}, {d}, its shipped words on the page at once {out[l]}")
            ok("Noto Sans Bengali" in out["bn"]["sans"] and "Noto Sans Bengali" in out["bn"]["font"] and "Vazirmatn" in out["ur"]["sans"] and "Vazirmatn" in out["ur"]["font"], f"the script's web font is the page's font and inside --sans {out['bn']['font']} {out['ur']['font']}")
            ok(not errs, f"no page errors {errs[:3]}"); await ctx.close()
            # the visitor's time zone suggests the language
            for tz, want in (("Asia/Jakarta", "id"), ("Asia/Karachi", "ur"), ("Europe/Warsaw", "pl"), ("Europe/Kyiv", "uk"), ("Asia/Dhaka", "bn"), ("Asia/Ho_Chi_Minh", "vi")):
                c2 = await b.new_context(timezone_id=tz, locale="en-US"); p2 = await c2.new_page(); await p2.goto(f"http://localhost:{PORT}/"); await p2.wait_for_timeout(700)
                got = await p2.evaluate("()=>nooiDetectLang()"); await c2.close()
                ok(got == want, f"the time zone {tz} suggests {want} (got {got})")
            await b.close()
    finally: srv.kill()
    print(json.dumps({"fails": fails, "out": out}, ensure_ascii=False, indent=1))
asyncio.run(main())
