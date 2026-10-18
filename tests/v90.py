# v90 in a real browser with a real nooi server (no AI keys) — one look on every page, phone and computer, English and Arabic,
# light and dark:
#  · three corner roundings (8 · 12 · 16 px; pills and circles aside), title sizes 22 · 16 · 14 (page titles 27 on a
#    computer; the home headline aside),
#    icon sizes 14 · 16 · 20 (the little flying sparkles aside) — on every page
#  · every tool page has its tool's icon beside the title, in its section's colour; the page carries its section's colour
#    (Video violet, Image amber, Audio fuchsia, Characters blue, 3D emerald, Edit cyan, Publish rose, the rest nooi green);
#    each colour is clearly visible on its tinted square in light and in dark (contrast 3:1 or more)
#  · Home and All tools use one card: its icon is in the tool's section colour (no colour per tool)
#  · one option tile: a 32 px neutral square with a 20 px icon, on every page
#  · the open tab is always fully in view on a phone, in English and Arabic
#  · the menu: All tools after Explore, Audio after Video; Audio = Voice & audio + Subtitles & dubbing; Edit has 4 tabs (v122)
#  · All tools: every tool once, each card opens its page (titled with the card's name); the filter box finds tools and says
#    when nothing matches; Home has "All tools" beside its Tools title
#  · the AI agents are never called bots (any page, the home box, titles and labels); they appear in one order everywhere —
#    the order the work runs (writer → character designer → director → cinematographer → sound → editor → producer → QA);
#    nooi Studio's agent cards say who does what (name, role, one job line each — the hover cards say the same; v93: no second list)
# Run: python3 tests/v90.py
import asyncio, json, os, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8196
D = tempfile.mkdtemp(prefix="nooi-v90-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}}}}, open(D + "/data/db.json", "w"))
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
SET = "(a)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'Sara',method:'google'};AU.showAuth=false;S.theme=a[1];applyTheme();setUILang(a[0]);document.getElementById('modalRoot').innerHTML='';renderAll()}"

# measures every page: off-scale roundings, title sizes, icon sizes, the header chip and the open tab
PAGES = r"""async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),vis=e=>{const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return false;const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'};
  const cl=e=>e.tagName.toLowerCase()+'.'+((e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)+'').split(' ').slice(0,2).join('.');
  const res={radii:{},titles:{},icons:{},chip:[],tabs:[],sec:{},errs:[]};
  const H1=innerWidth<=820?22:27;
  for(const v of Object.keys(VIEWS)){if(v==='admin')continue;try{document.getElementById('modalRoot').innerHTML='';go(v);renderAll();scrollTo(0,0);await wait(140)}catch(e){res.errs.push(v+': '+e.message);continue}
    for(const a of document.getAnimations()){try{if(a.effect&&a.effect.getTiming().iterations!==Infinity)a.finish()}catch(e){}}
    const m=document.querySelector('#main');
    for(const e of m.querySelectorAll('*')){const r=e.getBoundingClientRect();if(r.width<40||r.height<30||!vis(e))continue;const c=getComputedStyle(e);
      if(!((c.borderTopWidth!=='0px'&&c.borderTopStyle!=='none')||c.backgroundColor!=='rgba(0, 0, 0, 0)'))continue;const rad=parseFloat(c.borderTopLeftRadius);
      if(![0,8,12,16].includes(rad)&&rad<17)(res.radii[rad+' '+cl(e)]=res.radii[rad+' '+cl(e)]||[]).push(v)}
    for(const h of m.querySelectorAll('h1,h2,h3')){if(!vis(h))continue;const fs=parseFloat(getComputedStyle(h).fontSize),want={H1,H2:16,H3:14}[h.tagName];
      if(fs!==want&&!(v==='home'&&h.tagName==='H1'))(res.titles[h.tagName+' '+fs]=res.titles[h.tagName+' '+fs]||[]).push(v)}
    // the icon's own size (an icon that breathes or pops is measured at rest)
    for(const s of m.querySelectorAll('svg')){const r=s.getBoundingClientRect();if(r.width<2||r.width>34||!vis(s))continue;if(s.closest('.thumb,.tplcov,.frame,canvas,svg.bot,.bot,.sfly,.hfmark'))continue;
      const w=Math.round(parseFloat(getComputedStyle(s).width));if(w>30)continue;if(![14,16,20].includes(w))(res.icons[w+' '+cl(s.parentElement)]=res.icons[w+' '+cl(s.parentElement)]||[]).push(v)}
    const t=tool82(v);if(v!=='home'&&t){const h=m.querySelector('h1'),c=h&&h.querySelector('.tchip90');
      const want=getComputedStyle(document.body).getPropertyValue('--c-'+sec90(v)).trim();
      const probe=document.createElement('i');probe.style.color=want;document.body.appendChild(probe);const wantRGB=getComputedStyle(probe).color;probe.remove();
      if(!c||!c.querySelector('svg')||getComputedStyle(c).color!==wantRGB||h.textContent.trim()!==name82(v))res.chip.push([v,!!c,c&&getComputedStyle(c).color,wantRGB,h&&h.textContent.trim()]);
      res.sec[v]=document.body.dataset.sec90}
    const tb=m.querySelector('.hubtabs');if(tb){const a=tb.querySelector('[aria-selected="true"]'),R=tb.getBoundingClientRect(),A=a&&a.getBoundingClientRect();
      if(!a||A.left<R.left-1||A.right>R.right+1)res.tabs.push([v,a&&a.dataset.go,A&&[Math.round(A.left),Math.round(A.right)],[Math.round(R.left),Math.round(R.right)]])}}
  return res}"""

# colours: each section's icon on its tinted square is clearly visible (3:1) in this theme; light and dark differ
COLOURS = r"""()=>{const lum=c=>{const[r,g,b]=c.match(/[\d.]+/g).slice(0,3).map(x=>{x=+x/255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
  const rgb=v=>{const i=document.createElement('i');i.style.color=v;document.body.appendChild(i);const c=getComputedStyle(i).color;i.remove();return c.match(/[\d.]+/g).slice(0,3).map(Number)};
  const panel=rgb(getComputedStyle(document.body).getPropertyValue('--panel').trim()||'#fff');const out={};
  for(const s of ['brand','image','video','audio','chars','world','edit','publish']){const c=rgb('var(--c-'+s+')');
    const tint=c.map((x,i)=>Math.round(x*.15+panel[i]*.85));const L1=lum('rgb('+c.join(',')+')'),L2=lum('rgb('+tint.join(',')+')');
    out[s]={rgb:c.join(','),contrast:Math.round(((Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05))*100)/100}}return out}"""

# the cards, the tiles, the menu, the Audio and Edit tabs, All tools
CARDS = r"""async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),res={};
  const want=s=>{const i=document.createElement('i');i.style.color='var(--c-'+s+')';document.body.appendChild(i);const c=getComputedStyle(i).color;i.remove();return c};
  go('home');renderAll();await wait(250);
  res.homeCards=[...document.querySelectorAll('#main .tool[data-go]')].map(b=>{const ico=b.querySelector('.ico');return [b.dataset.go,getComputedStyle(ico).color===want(sec90(b.dataset.go))]});
  res.homeAll=!!document.querySelector('#main .spread.sec [data-go="apps"]');
  go('video');renderAll();ST93().open='type';renderView();await wait(250);   // v93: the option tiles live in nooi Studio's box sections
  res.tiles=[...new Set([...document.querySelectorAll('#main .tile:not(.brand) .gl')].filter(g=>g.querySelector(':scope>svg')&&g.offsetParent).map(g=>{const r=g.getBoundingClientRect(),s=g.querySelector('svg').getBoundingClientRect();return Math.round(r.width)+'/'+Math.round(s.width)}))];
  ST93().open=null;res.side=[...document.querySelectorAll('#side .nav[data-go]')].map(b=>b.dataset.go);
  go('audio');renderAll();await wait(250);res.audio=[S.view,[...document.querySelectorAll('#main .hubtabs [data-go]')].map(b=>b.dataset.go),document.body.dataset.sec90,
    [...document.querySelectorAll('#side .nav[aria-current="page"]')].map(b=>b.dataset.go)];
  go('subs');renderAll();await wait(200);res.subs=[document.body.dataset.sec90,[...document.querySelectorAll('#main .hubtabs [aria-selected="true"]')].map(b=>b.dataset.go)];
  go('edit');renderAll();await wait(250);res.edit=[...document.querySelectorAll('#main .hubtabs [data-go]')].map(b=>b.dataset.go);
  go('apps');renderAll();await wait(250);const cards=[...document.querySelectorAll('#main .apps90s .tool[data-go]')];
  res.apps={n:cards.length,unique:new Set(cards.map(b=>b.dataset.go)).size,secs:[...document.querySelectorAll('#main .apps90s')].map(s=>s.dataset.sec90),
    colours:cards.filter(b=>getComputedStyle(b.querySelector('.ico')).color!==want(sec90(b.dataset.go))).map(b=>b.dataset.go)};
  const opened=[];for(const b of cards){const go2=b.dataset.go,title=b.querySelector('b').textContent.trim();go('apps');renderAll();await wait(60);
    document.querySelector('#main .apps90s .tool[data-go="'+go2+'"]').click();await wait(140);const h=document.querySelector('#main h1');
    if(!h||h.textContent.trim()!==title)opened.push([go2,title,h&&h.textContent.trim(),S.view])}
  res.opened=opened;
  go('apps');renderAll();await wait(200);const f=document.querySelector('#main [data-apps90]');
  const type=async q=>{f.value=q;f.dispatchEvent(new Event('input',{bubbles:true}));await wait(80);return [[...document.querySelectorAll('#main .apps90s .tool')].filter(b=>!b.hidden&&b.offsetParent).map(b=>b.dataset.go),!document.querySelector('#main .apps90none').hidden]};
  res.find=await type(document.documentElement.lang==='ar'?'الصوت':'voice');res.none=await type('zzqq');res.back=(await type(''))[0].length;
  res.overflow=document.documentElement.scrollWidth>innerWidth+1;
  return res}"""

# the AI agents: never called bots, one order everywhere, one name · role · job each
AGENTS = r"""async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),res={},ORD=ORDER90,inOrder=a=>a.every((x,i)=>!i||ORD.indexOf(a[i-1])<ORD.indexOf(x));
  const words=root=>{const t=(root.innerText||'')+' '+[...root.querySelectorAll('[title],[aria-label],[placeholder]')].map(e=>(e.getAttribute('title')||'')+' '+(e.getAttribute('aria-label')||'')+' '+(e.getAttribute('placeholder')||'')).join(' ');return (t.match(/\bbots?\b|(?<!رو)بوت(?!ي)/gi)||[])};
  res.bots=[];for(const v of Object.keys(VIEWS)){if(v==='admin')continue;go(v);renderAll();await wait(90);const w=words(document.querySelector('#main'));if(w.length)res.bots.push(v+': '+w.join(','))}
  S.hf.tab='video';go('home');renderAll();await wait(300);const hw=words(document.querySelector('#main'));if(hw.length)res.bots.push('home box: '+hw.join(','));
  res.strip=[...document.querySelectorAll('#main .hfbots .sbot')].map(e=>e.dataset.bot);res.plan=[...document.querySelectorAll('#main .hfstplan li[data-bot]')].map(e=>e.dataset.bot);
  res.planWho=[...document.querySelectorAll('#main .hfstplan li[data-bot]')].map(e=>e.dataset.bot+':'+/prompt|وصف/i.test(e.textContent)).filter(x=>x.endsWith(':true')).map(x=>x.split(':')[0]);
  go('crew');renderAll();await wait(300);res.line=[...document.querySelectorAll('#main .crewline .botcard')].map(c=>BOTS.find(b=>c.querySelector('b').textContent===L(b.name[0],b.name[1])).id);
  // v93: the separate "who does what" list was a copy of the cards — each card now carries name, role and its job line
  res.roles=[...document.querySelectorAll('#main .crewline .botcard[data-bot]')].map(c=>{const b=BOT(c.dataset.bot);return [c.dataset.bot,c.querySelector('b').textContent===L(b.name[0],b.name[1])&&c.querySelector('.small').textContent===L(b.role[0],b.role[1])&&c.getAttribute('title')===L(b.job[0],b.job[1])]});
  res.dupList=!!document.querySelector('#main .roles90');
  res.jobs=new Set(BOTS.map(b=>b.job[0])).size;res.info=BOTS.filter(b=>CREW_INFO[b.id][2]!==b.job[0]||CREW_INFO[b.id][3]!==b.job[1]).map(b=>b.id);
  res.note=[...document.querySelectorAll('#main p')].map(p=>p.textContent).filter(t=>/Daqiq|دقيق يراجع/.test(t)).length;
  res.inOrder={strip:inOrder(res.strip),plan:inOrder(res.plan),line:inOrder(res.line),roles:inOrder(res.roles.map(r=>r[0])),bots:inOrder(BOTS.map(b=>b.id))};
  return res}"""

async def run(b, lang, w, theme):
    tag = f"{lang} {w} {theme}"
    ctx = await b.new_context(viewport={"width": w, "height": 844 if w < 500 else 900}, device_scale_factor=1)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500)
    await pg.evaluate(SET, [lang, theme]); await pg.wait_for_timeout(400)
    r = await pg.evaluate(PAGES); out[tag] = {k: (v if k != "sec" else len(v)) for k, v in r.items()}
    ok(not r["radii"], f"{tag}: corner roundings 8 · 12 · 16 only {r['radii']}")
    ok(not r["titles"], f"{tag}: titles 22 · 16 · 14 only {r['titles']}")
    ok(not r["icons"], f"{tag}: icons 14 · 16 · 20 only {r['icons']}")
    ok(not r["chip"], f"{tag}: every tool page shows its icon in its section colour beside its name {r['chip'][:4]}")
    ok(not r["tabs"], f"{tag}: the open tab is fully in view {r['tabs'][:4]}")
    ok(not r["errs"], f"{tag}: every page draws {r['errs']}")
    S = r["sec"]; ok(S.get("video") == "video" and S.get("cinema") in (None, "video") and S.get("image") == "image" and S.get("voice") == "audio" and S.get("subs") == "audio" and S.get("chars") == "chars"
                     and S.get("world") == "world" and S.get("edit") == "edit" and S.get("plan") == "publish" and S.get("library") == "brand" and S.get("apps") == "brand", f"{tag}: each page carries its section's colour {S}")
    if w == 390 and lang == "en":
        c = await pg.evaluate(COLOURS); out[tag]["colours"] = c
        ok(all(x["contrast"] >= 3 for x in c.values()), f"{tag}: every section colour is clearly visible on its tinted square {c}")
    k = await pg.evaluate(CARDS); out[tag]["cards"] = {x: k[x] for x in ("homeAll", "tiles", "side", "audio", "subs", "edit", "apps", "find", "none", "back", "overflow")}
    ok(len(k["homeCards"]) >= 6 and all(x[1] for x in k["homeCards"]), f"{tag}: Home's tool cards are in their section's colour {k['homeCards']}")
    ok(k["homeAll"], f"{tag}: Home has All tools beside its Tools title")
    ok(k["tiles"] == ["32/20"], f"{tag}: one option tile (32 px square, 20 px icon) {k['tiles']}")
    if w > 500: ok(k["side"] == ["home", "explore", "apps", "image", "video", "audio", "chars", "world", "edit", "calendar", "library", "account", "admin"], f"{tag}: the menu {k['side']}")
    ok(k["audio"][0] == "voice" and k["audio"][1] == ["voice", "subs"] and k["audio"][2] == "audio" and (w < 500 or k["audio"][3] == ["audio"]), f"{tag}: Audio = Voice & audio + Subtitles & dubbing {k['audio']}")
    ok(k["subs"] == ["audio", ["subs"]], f"{tag}: Subtitles & dubbing is in Audio {k['subs']}")
    ok(k["edit"] == ["edit", "fx", "finish", "vss"], f"{tag}: Edit has four tabs (v122: Video from pictures makes a video — it is in Video) {k['edit']}")
    a = k["apps"]; ok(a["n"] >= 23 and a["n"] == a["unique"] and not a["colours"], f"{tag}: All tools lists every tool once, in its colour {a}")
    ok(a["secs"] == ["brand", "image", "video", "audio", "chars", "world", "edit", "publish"], f"{tag}: All tools is grouped by section {a['secs']}")
    ok(not k["opened"], f"{tag}: every card on All tools opens its page {k['opened'][:4]}")
    ok("voice" in k["find"][0] and len(k["find"][0]) <= 4 and not k["find"][1], f"{tag}: the filter finds a tool {k['find']}")
    ok(k["none"] == [[], True] and k["back"] == a["n"], f"{tag}: the filter says when nothing matches, and clearing it shows every tool {k['none']} {k['back']}")
    ok(not k["overflow"], f"{tag}: All tools fits the screen")
    g = await pg.evaluate(AGENTS); out[tag]["agents"] = {x: g[x] for x in ("bots", "strip", "plan", "planWho", "jobs", "info", "note", "inOrder")}
    ok(not g["bots"], f"{tag}: the agents are never called bots {g['bots'][:4]}")
    ok(all(g["inOrder"].values()) and len(g["strip"]) == 9 and len(g["line"]) == 9, f"{tag}: one order everywhere (story → characters → shots → light → voices → sound → cut → models → check) {g['inOrder']} {g['strip']}")
    ok(len(g["roles"]) == 9 and all(r[1] for r in g["roles"]) and not g["dupList"], f"{tag}: nooi Studio's cards say who does what — name, role, job — for all nine, with no second list {g['roles']}")
    ok(g["jobs"] == 9 and not g["info"], f"{tag}: one job line per agent (hover cards say the same) {g['info']}")
    ok(g["planWho"] == ["cine"], f"{tag}: in the home box's plan the Cinematographer writes the prompts, as its role says {g['planWho']}")
    ok(g["note"] == 0, f"{tag}: the QA agent is called by its name (Iris), not an old one")
    ok(not errs, f"{tag}: page errors {errs[:3]}")
    await ctx.close()

async def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "GOOGLE_", "KIE_", "FIREBASE_", "DASHSCOPE_"))}
    env.update(PORT=str(PORT), SECRET_KEY="v" * 40, PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false", FREE_PERIOD="false", FIREBASE_PROJECT_ID="")
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=2); break
            except Exception: time.sleep(.25)
        async with async_playwright() as p:
            b = await p.chromium.launch(args=["--no-sandbox"])
            for lang, w, theme in (("en", 390, "light"), ("en", 1280, "dark"), ("ar", 390, "dark"), ("en", 390, "dark")):
                await run(b, lang, w, theme)
            await b.close()
    finally: srv.kill()
    print(json.dumps(out, ensure_ascii=False)[:3000])
    print("\n".join("✗ " + f for f in fails) or "✓ v90: one look on every page")
    raise SystemExit(1 if fails else 0)

asyncio.run(main())
