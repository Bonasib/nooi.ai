# v204 — the owner's logo, the credits pill, public profiles with permissions, Explore actions + stories, Community.
#  Server: a profile per creator (by public id or @handle, never the account id); the owner of a profile sets download / reuse / share and
#  the server enforces them for everyone else (prompt blanked, "use" refused, download refused); stories live 24 h (10 at a time), seen marks;
#  views count once per person a day; Community shelves hold approved posts only; staff approve, pick for nooi rewards (credited once), auto.
#  Page: the logo SVG in the header and the home mark, the lime credits pill with black stars, the profile page (stats, permissions, posts),
#  the edit sheet (three switches), the stories row and viewer, the Explore slide (follow, profile, story, private prompt), Community shelves.
# Run: python3 tests/v204.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8667; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v204-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=360x640:rate=24:duration=3", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "300k", "-an", D + "/media/a.webm"], check=True, timeout=120)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=512x512", "-frames:v", "1", D + "/media/b.png"], check=True, timeout=60)
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "jobs": {}, "ledger": []}}}, open(D + "/data/db.json", "w"))
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "OPENAI_", "KIE_", "FAL_", "GOOGLE_", "DASHSCOPE_", "FIREBASE_", "MINIMAX_", "NOOI_", "FREE_PERIOD"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="f" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, FREE_PERIOD="false", NV_AUTOCHECK="false", AGENTS_AUTO_LEARN="false"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:500]))
def req(p, body=None, method=None, who=None, raw=False):
    h = {"Content-Type": "application/json"}; h.update({"X-Dev-User": who} if who else {})
    r = urllib.request.Request(B + p, data=None if body is None else json.dumps(body).encode(), headers=h, method=method or ("POST" if body is not None else "GET"))
    try:
        with urllib.request.urlopen(r, timeout=15) as x: d = x.read(); return x.status, (d if raw else json.loads(d or b"{}")), dict(x.headers)
    except urllib.error.HTTPError as e: d = e.read(); return e.code, (d if raw else json.loads(d or b"{}")), {}
def credits(who):   # the ledger: how many nooi rewards credits the account received
    c, r, _ = req("/v1/billing", who=who); return sum(x.get("delta", 0) for x in r.get("ledger", []) if "nooi rewards" in str(x.get("reason", "")))

def server():
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=1); break
        except Exception: time.sleep(.25)
    c, p1, _ = req("/v1/explore", {"url": "/media/a.webm", "kind": "video", "prompt": "A falcon over the desert at sunrise", "title": "Desert falcon", "cat": "films", "agree": True})
    c2, p2, _ = req("/v1/explore", {"url": "/media/b.png", "kind": "image", "prompt": "Perfume bottle on wet glass", "title": "Perfume", "cat": "ecommerce", "agree": True}, who="maya")
    chk("two posts shared, each with a public id", c == 200 and c2 == 200 and p1.get("creator") and p2.get("creator") and p1["creator"] != p2["creator"], [c, c2, p1, p2])
    out["ids"] = [p1.get("id"), p2.get("id")]
    # profiles
    c, me, _ = req("/v1/profile204/me", who="maya"); chk("own profile: a handle made from the name, all three permissions on", c == 200 and len(me.get("handle", "")) >= 3 and me.get("perm") == {"download": True, "reuse": True, "share": True}, me)
    c, r, _ = req("/v1/profile204/me", {"handle": "Bad Handle!"}, method="PUT", who="maya"); chk("a bad handle is refused (400, both languages)", c == 400 and r.get("errorAr"), [c, r])
    c, r, _ = req("/v1/profile204/me", {"name": "Maya", "handle": "@Maya.Art", "bio": "Motion & light", "perm": {"download": False, "reuse": False, "share": False}}, method="PUT", who="maya")
    chk("profile saved: handle lower-cased without @, bio, permissions off", c == 200 and r.get("handle") == "maya.art" and r.get("bio") == "Motion & light" and r.get("perm") == {"download": False, "reuse": False, "share": False}, [c, r])
    c, r, _ = req("/v1/profile204/me", {"handle": "maya.art"}, method="PUT", who="noor"); chk("a taken handle is refused (409)", c == 409, [c, r])
    c, r, _ = req("/v1/profile204/me", {"avatar": "https://evil.example/x.png"}, method="PUT", who="maya"); chk("an outside picture is refused as the avatar", c == 400, [c, r])
    c, pr, _ = req("/v1/profile204/maya.art", who="noor")
    chk("profile by @handle: name, counts, permissions, posts; no account id anywhere", c == 200 and pr.get("name") == "Maya" and pr.get("counts", {}).get("posts") == 1 and pr.get("perm", {}).get("download") is False and not pr.get("me") and "dev_maya" not in json.dumps(pr), [c, pr])
    c, pr2, _ = req("/v1/profile204/" + p2["creator"], who="noor"); chk("the same profile by public id", c == 200 and pr2.get("handle") == "maya.art", [c, pr2.get("handle")])
    c, r, _ = req("/v1/profile204/dev_maya", who="noor"); chk("an account id finds nothing (404)", c == 404, c)
    # permissions enforced for others
    it = pr["items"][0]; chk("others: prompt blanked, can't download, reuse or share", it.get("prompt") == "" and it.get("canDownload") is False and it.get("canReuse") is False and it.get("canShare") is False, it)
    c, r, _ = req(f"/v1/explore/{p2['id']}/use", {}, who="noor"); chk("'Use this prompt' refused when the prompt is private (403)", c == 403 and "private" in r.get("error", ""), [c, r])
    c, r, _ = req(f"/v1/explore/{p2['id']}/download", who="noor", raw=True); chk("download refused for others (403)", c == 403, c)
    c, r, h = req(f"/v1/explore/{p2['id']}/download", who="maya", raw=True); chk("the creator downloads her own post (named file)", c == 200 and len(r) > 1000 and "maya.art" in h.get("Content-Disposition", ""), [c, len(r), h.get("Content-Disposition")])
    c, own, _ = req("/v1/profile204/maya.art", who="maya"); chk("the creator still sees her own prompt", own["items"][0].get("prompt", "").startswith("Perfume") and own.get("me") is True, own["items"][0])
    c, feed, _ = req("/v1/explore"); f2 = [x for x in feed["items"] if x["id"] == p2["id"]][0]
    chk("the public feed carries @handle and blanks the private prompt", f2.get("handle") == "maya.art" and f2.get("prompt") == "" and f2.get("canShare") is False, f2)
    req("/v1/profile204/me", {"perm": {"download": True, "reuse": True, "share": True}}, method="PUT", who="maya")
    c, r, _ = req(f"/v1/explore/{p2['id']}/use", {}, who="noor"); chk("permissions back on: use works", c == 200, [c, r])
    c, r, h = req(f"/v1/explore/{p2['id']}/download", who="noor", raw=True); chk("permissions back on: others download", c == 200 and len(r) > 1000, c)
    # follow (any creator, not only program members)
    c, r, _ = req(f"/v1/creators/{p2['creator']}/follow", {}, who="noor"); c3, pr3, _ = req("/v1/profile204/maya.art", who="noor")
    chk("follow from the profile counts", c == 200 and pr3.get("following") is True and pr3["counts"]["followers"] == 1, [c, r, pr3.get("counts")])
    # views: once per person a day
    for w in ("noor", "noor", "sami"): req(f"/v1/explore/{p2['id']}/view", {}, who=w)
    c, r, _ = req(f"/v1/explore/{p2['id']}/view", {}, who="noor"); chk("views: two people, four calls → 2", r.get("views") == 2, r)
    # stories
    c, s1, _ = req("/v1/stories", {"url": "/media/b.png", "caption": "New look"}, who="maya"); chk("a story added", c == 200 and s1.get("kind") == "image" and s1["until"] - s1["t"] == 864e5, [c, s1])
    c, s2, _ = req("/v1/stories", {"post": p2["id"]}, who="maya"); chk("a post put on the story", c == 200, [c, s2])
    c, r, _ = req("/v1/stories", {"post": p2["id"]}, who="noor"); chk("someone else's post can't go on your story", c == 400, [c, r])
    c, r, _ = req("/v1/stories", {"url": "https://evil.example/x.png"}, who="maya"); chk("an outside link can't go on a story", c == 400, [c, r])
    c, lst, _ = req("/v1/stories", who="noor"); m = [u for u in lst.get("items", []) if u["handle"] == "maya.art"]
    chk("the story row: Maya with two items, followed first, not seen", c == 200 and m and len(m[0]["items"]) == 2 and m[0]["followed"] and not m[0]["seen"], lst)
    for s in (s1, s2): req(f"/v1/stories/{s['id']}/seen", {}, who="noor")
    c, lst, _ = req("/v1/stories", who="noor"); chk("seen after both are watched", [u for u in lst["items"] if u["handle"] == "maya.art"][0]["seen"] is True, lst)
    c, r, _ = req(f"/v1/stories/{s1['id']}", method="DELETE", who="noor"); chk("someone else can't delete a story", c == 404, c)
    c, r, _ = req(f"/v1/stories/{s1['id']}", method="DELETE", who="maya"); chk("the creator deletes her story", c == 200, c)
    for i in range(9): req("/v1/stories", {"url": "/media/b.png"}, who="sami")
    c, r, _ = req("/v1/stories", {"url": "/media/b.png"}, who="sami"); c2_, r2, _ = req("/v1/stories", {"url": "/media/b.png"}, who="sami")
    chk("ten stories at a time, the eleventh waits (429)", c == 200 and c2_ == 429 and r2.get("errorAr"), [c, c2_, r2])
    # Community
    c, cm, _ = req("/v1/community204", who="noor"); chk("Community: nothing approved yet, no waiting list for customers", c == 200 and not any(cm["shelves"].values()) and cm["waiting"] == [] and not cm["staff"], cm)
    c, r, _ = req(f"/v1/explore/{p2['id']}/approve204", {}, who="noor"); chk("customers can't approve (403)", c == 403, c)
    c, cm, _ = req("/v1/community204"); chk("staff see both posts waiting", cm.get("staff") and len(cm.get("waiting", [])) == 2, cm)
    c, r, _ = req(f"/v1/explore/{p2['id']}/approve204", {}); c, cm, _ = req("/v1/community204", who="noor")
    chk("approved: in Most reused, Most viewed (and not the unapproved one)", [x["id"] for x in cm["shelves"]["reuse"]] == [p2["id"]] and [x["id"] for x in cm["shelves"]["viewed"]] == [p2["id"]] and cm["shelves"]["liked"] == [], cm["shelves"])
    before = credits("maya"); c, r, _ = req(f"/v1/explore/{p2['id']}/pick204", {}); req(f"/v1/explore/{p2['id']}/pick204", {}); c, r, _ = req(f"/v1/explore/{p2['id']}/pick204", {})
    chk("nooi rewards pick: the creator credited 100 once, even when picked again", c == 200 and r.get("pick") is True and credits("maya") == before + 100, [before, credits("maya"), r.get("pick")])
    c, cm, _ = req("/v1/community204", who="noor"); chk("the pick is on the nooi rewards shelf", [x["id"] for x in cm["shelves"]["picks"]] == [p2["id"]], cm["shelves"]["picks"])
    c, r, _ = req("/v1/community204", {"auto": True}, method="PUT", who="noor"); chk("customers can't switch auto-approve (403)", c == 403, c)
    req(f"/v1/explore/{p1['id']}/like", {}, who="noor"); c, r, _ = req("/v1/community204", {"auto": True}, method="PUT"); c, cm, _ = req("/v1/community204", who="noor")
    chk("auto-approve on: the other post joins Most liked", r.get("auto") is True and p1["id"] in [x["id"] for x in cm["shelves"]["liked"]], cm["shelves"]["liked"])
    req("/v1/community204", {"auto": False}, method="PUT")

SETUP = "(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;setUILang(l);S.theme=l==='ar'?'dark':'light';applyTheme();go('home');renderAll();document.getElementById('modalRoot').innerHTML=''}"
async def page():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); E = pg.evaluate
        await pg.goto(B + "/"); await pg.wait_for_function("()=>typeof S!=='undefined'&&typeof renderAll==='function'", timeout=25000)
        for lang in ("en", "ar"):
            await E(SETUP, lang); await pg.wait_for_timeout(700)
            br = await E("""()=>{const m=document.querySelector('.hfmark204'),c=document.querySelector('.crbtn2'),cs=c&&getComputedStyle(c),p=c&&c.querySelector('svg path');
              return{home:!!m&&/brand\\/nooi-logo\\.svg$/.test(m.getAttribute('src'))&&m.naturalWidth>0,top:!!document.querySelector('.brand .nmark, .brand svg'),
                pill:cs?cs.backgroundImage:'',ink:cs?cs.color:'',star:p?getComputedStyle(p).fill:'',stars:c?c.querySelectorAll('svg path').length:0,num:c?getComputedStyle(c.querySelector('.crn')).fontWeight:''}}""")
            chk(f"{lang}: the owner's logo on the home page and in the header", br["home"] and br["top"], br)
            chk(f"{lang}: credits pill — lime gradient, black number (bold), two black stars", "linear-gradient" in br["pill"] and br["ink"] == "rgb(11, 11, 11)" and br["star"] == "rgb(11, 11, 11)" and br["stars"] == 2 and int(br["num"] or 0) >= 700, br)
            # Explore: stories row + the slide actions
            await E("()=>{go('discover');renderAll()}"); await pg.wait_for_selector("#st204row .st204b", timeout=10000); await pg.wait_for_timeout(1200)
            row = await E("()=>[...document.querySelectorAll('#st204row .st204b')].map(b=>b.dataset.act+':'+b.innerText.trim())")
            chk(f"{lang}: stories row — Your story first, then @maya.art", len(row) >= 2 and row[0].startswith("st204-") and any("maya.art" in r for r in row[1:]), row)
            await E("()=>{const b=[...document.querySelectorAll('#st204row .st204b')].find(b=>/maya/.test(b.innerText));b.click()}"); await pg.wait_for_selector("#st204", timeout=5000); await pg.wait_for_timeout(500)
            sv = await E("()=>{const v=document.getElementById('st204');return{bars:v.querySelectorAll('.st204bar,.st204bars>*').length,who:v.innerText.includes('maya.art'),media:!!v.querySelector('img,video')}}")
            chk(f"{lang}: story viewer — progress bars, @handle, the picture", sv["who"] and sv["media"] and sv["bars"] >= 1, sv)
            await E("()=>st204Close()")
            await E("()=>{const x=(XP.items||[]).find(x=>x.handle==='maya.art');xpFull200(x.id)}"); await pg.wait_for_timeout(1000)
            sl = await E("""()=>{const r=document.querySelector('.xpf200, #xpf200, [class*=xpf]')||document.body;const acts=[...r.querySelectorAll('[data-act]')].map(b=>b.dataset.act);
              return{acts,by:r.innerText.includes('@maya.art')}}""")
            chk(f"{lang}: the Explore slide — like, comment, follow, profile, story, @handle", all(a in sl["acts"] for a in ("xpf204-follow",)) and any(a.startswith("xpf-like") or a == "xpf-like" for a in sl["acts"]) and any("comment" in a for a in sl["acts"]) and any("prof" in a for a in sl["acts"]) and any("st204" in a or "story" in a for a in sl["acts"]) and sl["by"], sl)
            await E("()=>xpClose200()")
            # profile
            await E("()=>prof204Open('maya.art')"); await pg.wait_for_selector(".prof204 .pf204btns", timeout=8000); await pg.wait_for_timeout(600)
            pf = await E("()=>{const v=document.querySelector('.prof204');return{t:v.innerText,acts:[...v.querySelectorAll('[data-act]')].map(b=>b.dataset.act),posts:v.querySelectorAll('[data-act=\"pf204-post\"]').length,wide:document.documentElement.scrollWidth<=innerWidth+1}}")
            chk(f"{lang}: Maya's profile — name, @handle, bio, Follow + Story, one post, fits the screen", "Maya" in pf["t"] and "@maya.art" in pf["t"] and "Motion & light" in pf["t"] and pf["posts"] == 1 and pf["wide"] and "pf204-edit" not in pf["acts"], pf)
            await E("()=>prof204Open('me')"); await pg.wait_for_selector(".prof204 [data-act='pf204-edit']", timeout=8000); await pg.wait_for_timeout(400)
            await pg.click(".prof204 .pf204btns [data-act='pf204-edit']"); await pg.wait_for_selector("#pfe204h", timeout=5000); await pg.wait_for_timeout(300)
            ed = await E("""()=>{const s=[...document.querySelectorAll('[data-pf204perm]')];return{n:s.length,keys:s.map(i=>i.dataset.pf204perm),w:s.map(i=>Math.round(i.getBoundingClientRect().width)),
              labels:s.map(i=>i.closest('label').querySelector('b').getBoundingClientRect().width>40)}}""")
            chk(f"{lang}: edit sheet — three switches (download, reuse, share) drawn as switches with their words", ed["n"] == 3 and ed["keys"] == ["download", "reuse", "share"] and all(40 <= w <= 52 for w in ed["w"]) and all(ed["labels"]), ed)
            await E("()=>{document.getElementById('modalRoot').innerHTML=''}")
            # Community
            await E("()=>{go('community204');renderAll()}"); await pg.wait_for_selector(".cm204", timeout=8000); await pg.wait_for_timeout(1500)
            cm = await E("()=>{const v=document.querySelector('.cm204');return{t:v.innerText,cards:v.querySelectorAll('[data-act^=\"cm204\"],.cm204c,button[data-id]').length,nav:!!document.querySelector('[data-go=\"community204\"]')}}")
            chk(f"{lang}: Community page — shelves with posts, a tab next to Explore", cm["cards"] >= 1 and cm["nav"] and ("nooi" in cm["t"]), {k: (v[:300] if isinstance(v, str) else v) for k, v in cm.items()})
        chk("page: no errors", not errs, errs[:3]); await b.close()

try:
    server(); asyncio.run(page())
finally:
    srv.terminate()
    try: srv.wait(timeout=5)
    except Exception: srv.kill()
    subprocess.run(["rm", "-rf", D])
print(json.dumps({"out": out, "fails": fails}, ensure_ascii=False, default=str)[:3000]); sys.exit(1 if fails else 0)
