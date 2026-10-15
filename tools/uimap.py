# The map of every button: opens each page of the app (demo mode, no server), lists every control with its label and what it
# does, and writes docs/UI_MAP.md. Run it after changing pages:  python3 tools/uimap.py   (Playwright + Chromium)
# What a control does comes from the page itself: data-go = opens a page, data-set/data-val = an option, data-act = an action
# (named below when it is a common one), inputs = what you type. Option groups are folded into one line.
import asyncio, collections, json, pathlib, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / "public" / "index.html").as_uri()
OUT = ROOT / "docs" / "UI_MAP.md"
GRAB = """()=>{const out=[];const seen=new Set();
 document.querySelectorAll('#main button,#main [data-act],#main [data-set],#main [data-go],#main a[href],#main input,#main select,#main textarea,#main [role=button]').forEach(el=>{
  if(seen.has(el))return;seen.add(el);const r=el.getBoundingClientRect();if(!(r.width>0&&r.height>0)||getComputedStyle(el).visibility==='hidden')return;
  const d=el.dataset||{};const lab=el.labels&&el.labels[0]?el.labels[0].innerText:'';
  out.push({tag:el.tagName.toLowerCase(),type:el.type||'',act:d.act||'',set:d.set||'',val:(d.val||d.v||'').slice(0,40),go:d.go||'',href:el.tagName==='A'?(el.getAttribute('href')||'').slice(0,80):'',
   text:(el.innerText||el.value||'').replace(/\\s+/g,' ').trim().slice(0,60),title:(el.title||el.getAttribute('aria-label')||'').replace(/\\s+/g,' ').slice(0,80),ph:(el.placeholder||lab||'').replace(/\\s+/g,' ').slice(0,70)})});
 return {h1:((document.querySelector('#main h1')||{}).innerText||'').trim(),controls:out}}"""
# common actions in plain words (the rest are shown by their name)
ACTS = {"legal": "opens Terms / Privacy", "dictate": "types what you say (microphone)", "use-tpl": "starts from this template", "remix": "makes your own version of this",
        "pick-voice": "chooses this voice", "hear-voice": "plays a sample of this voice", "buy": "buys this pack / plan", "copy": "copies to the clipboard",
        "nw-go": "creates the world from your words / picture (or changes it)", "nw-ex": "fills the box with an example", "nw-photo": "saves a photo of the view",
        "nw-video": "records a 12 s tour video", "nw-use": "sends the world to Create video", "nw-real": "makes a real photo of the view with the picture AI",
        "nw-save": "saves the world (up to 12)", "nw-glb": "downloads the world as a .glb", "nw-new": "starts a new world", "nw-open": "opens a saved world",
        "nw-del": "deletes a saved world", "nw-realistic": "upgrades to a photoreal world (World Labs / 360° sky + AI 3D objects)", "nw-pic": "adds a picture of a place",
        "nw-jump": "jumps", "nw-grab": "picks up / throws what is in front of you", "nw-mode": "walk · fly · orbit · tour", "nw-full": "full screen",
        "cal-new": "adds a post on this day", "hk-copy": "copies the hook", "hk-to": "uses the hook in a new video", "hk-toed": "puts the hook in the editor",
        "xp-open": "opens the post", "xp-recreate": "makes one like it", "gfr-open": "redeems a gift code", "hf-send": "creates from the prompt", "hf-tab": "chooses what to make",
        "nw-opt": "sets the time of day, the weather or the look (Fast · free / Realistic)", "hf-ratio": "chooses the format (16:9, 9:16, 1:1…)",
        "home-adv": "opens the full studio with every option", "to-continue": "continues the last chapter story", "admin-login": "admin sign-in",
        "ed-addtext": "adds a text layer", "char-3dbody": "makes a full 3D character (AI)", "sk-3d": "turns the drawing into 3D", "ui-set": "changes an interface setting",
        "real87": "makes this character real (one photoreal face from its description or photo)", "real87-all": "makes every character without a face real",
        "del88": "deletes this video / picture (asks first)", "del88c": "deletes this character (asks first)", "del88-yes": "confirms deleting the result", "del88c-yes": "confirms deleting the character",
        "ugc-char": "chooses who presents the product", "ugc-av87": "chooses a ready presenter (a real photo)", "av87-make": "owner: makes the missing presenters' photos once",
        "ch87-open": "opens your characters to put one in the prompt (@name)", "ch87-put": "puts this character in the prompt", "b87-make": "makes this character's 3D body (it walks in your worlds)",
        "nw87-better": "shows the AI's more detailed version of the world", "nw87-cast": "owner: makes the world's real-looking people once", "nw87-3d": "makes this character 3D so it walks into the world"}
def does(c, titles):
    if c["go"]: return "opens **" + titles.get(c["go"], c["go"]) + "**"
    if c["act"]: return ACTS.get(c["act"], "action `" + c["act"] + "`")
    if c["href"]: return "link → " + c["href"]
    if c["tag"] in ("input", "textarea", "select"): return "field" + (" (" + c["type"] + ")" if c["type"] and c["type"] not in ("text", "textarea", "select-one") else "")
    return "—"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE); await pg.wait_for_timeout(800)
        meta = await pg.evaluate("""()=>({hubs:HUBS.map(h=>({id:h[0],en:h[2],tabs:h[4].map(t=>({id:t[0],en:t[1]}))})),
          desc:Object.fromEntries(Object.entries(TOOLDESC).map(([k,v])=>[k,v[0]])),names:Object.fromEntries(ALLNAV.map(x=>[x[0],x[2]||x[0]]))})""")
        titles = dict(meta["names"]); pages = {}
        for h in meta["hubs"]:
            for t in h["tabs"]:
                await pg.evaluate("(v)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang('en');S.view=v;document.getElementById('modalRoot').innerHTML='';renderAll()}", t["id"])
                await pg.wait_for_timeout(300); pages[t["id"]] = await pg.evaluate(GRAB); titles[t["id"]] = pages[t["id"]]["h1"] or t["en"]
        await b.close()
    L = ["# nooi — every button and what it does", "", "Made by `python3 tools/uimap.py` from the page itself (English, signed in, desktop). Each page lists its controls in screen order;",
         "option groups are folded into one line (“choose …”). Shared parts (top bar, menu, footer) are listed once. See docs/ROADMAP.md for why the site is laid out this way.", ""]
    total = 0
    for h in meta["hubs"]:
        L += ["## " + h["en"], ""]
        for t in h["tabs"]:
            P = pages.get(t["id"]) or {"controls": [], "h1": t["en"]}; cs = P["controls"]; total += len(cs)
            L += ["### " + (P["h1"] or t["en"]) + "  `" + t["id"] + "`", ""]
            if meta["desc"].get(t["id"]): L += ["_" + meta["desc"][t["id"]] + "_", ""]
            sets = collections.OrderedDict(); rows = []; seen = set()
            for c in cs:
                if c["act"] == "legal": continue
                lab = c["text"] or c["title"] or c["ph"] or "(no label)"
                if c["set"]:
                    sets.setdefault(c["set"], []);
                    if lab not in sets[c["set"]]: sets[c["set"]].append(lab)
                    if c["set"] not in seen: seen.add(c["set"]); rows.append(("SET", c["set"]))
                    continue
                key = (lab, c["act"], c["go"]);
                if key in seen: continue
                seen.add(key); rows.append((lab, does(c, titles)))
            if not rows: L += ["(nothing to press)", ""]; continue
            L += ["| control | what it does |", "|---|---|"]
            for lab, d in rows:
                if lab == "SET": L.append("| choose: " + " · ".join(x.replace("|", "/") for x in sets[d][:14]) + (" …" if len(sets[d]) > 14 else "") + " | sets `" + d + "` |")
                else: L.append("| " + lab.replace("|", "/") + " | " + d + " |")
            L.append("")
    L += ["", "_" + str(total) + " controls on " + str(sum(len(h["tabs"]) for h in meta["hubs"])) + " pages" + (" · page errors: " + "; ".join(errs[:3]) if errs else "") + "_"]
    OUT.write_text("\n".join(L) + "\n", encoding="utf-8"); print("wrote", OUT, "·", total, "controls", "· errors", len(errs))
asyncio.run(main())
