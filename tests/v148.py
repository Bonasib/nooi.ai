# v148: in the editor — (1) an AI agent's changes (made over MCP with the user's connection) show up live in the editor that has
# the project open, a save keeps both sides' work, nothing is applied twice; (2) several timelines in one project: copy, empty,
# switch, rename, delete, each keeping its own clips and size, saved to the account and opened again with every file; (3) the
# cut-out of Remove background mended with a brush on the preview (Remove → background shows there, Keep → the picture comes
# back), the strokes in the picture's own positions (a turned clip too), undo. Computer (EN) and phone (AR, touch).
# The on-device AI is a stand-in (a round cut-out in the middle). Run: python3 tests/v148.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8414; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v148-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
now = int(time.time() * 1000)
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "jobs": {
    "jb": {"id": "jb", "kind": "video", "status": "done", "progress": 1, "url": B + "/media/b.webm", "title": "Agent clip", "created": now, "dur": 4, "payload": {"prompt": "x"}}}}}}, open(D + "/data/db.json", "w"))
M = D + "/media/"; FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-an", M + "a.webm")
FF("-f", "lavfi", "-i", "color=c=0x2060ff:s=640x360:d=4:r=30", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "300k", "-an", M + "b.webm")
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.localAI=true;const now=Date.now();
 S.jobs.push({id:'va',kind:'video',status:'complete',prompt:'Beach',title:'Beach at sunset',created:now,progress:1,pal:PALS[0],seed:7,dur:6,aspect:'16:9',resultUrl:'/media/a.webm'});
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.texts=[];S.ed.format='youtube';
 await edUseJob(S.jobs.find(j=>j.id==='va'),{stay:true,quiet:true});
 const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'talk.webm',{type:'video/webm'})]);
 {const c=document.createElement('canvas');c.width=64;c.height=36;const x=c.getContext('2d');x.fillStyle='#fff';x.beginPath();x.arc(32,18,9,0,7);x.fill();window.CUT=await new Promise(r=>c.toBlob(r,'image/png'))}
 laiCall=async()=>({blob:CUT});
 S.ed.tab='media';S.ed.sel=S.ed.clips[0].id;edSetPick('clip',S.ed.clips[0].id);go('edit');renderAll()}"""
READY = "S.ed.clips.length===2&&document.querySelector('.ed143 #wk')&&S.ed.clips.every(c=>{const m=clipMedia(c);return m&&srcReady(m)})"
SCAN = r"""()=>{const vis=e=>{const r=e.getBoundingClientRect();if(r.width<4||r.height<4)return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.05};
 const fixed=[...document.querySelectorAll('*')].filter(e=>{const p=getComputedStyle(e).position;return(p==='fixed'||p==='sticky')&&vis(e)}).map(e=>e.getBoundingClientRect());
 let top=0,bot=innerHeight;for(const r of fixed){if(r.top<=innerHeight*0.5&&r.bottom>top&&r.bottom<innerHeight*0.7&&r.width>innerWidth*0.5)top=Math.max(top,r.bottom);if(r.bottom>=innerHeight*0.6&&r.top>innerHeight*0.4&&r.width>innerWidth*0.5)bot=Math.min(bot,r.top)}
 const box=e=>{let p=e.parentElement;while(p&&p!==document.body){const s=getComputedStyle(p);if(/(auto|scroll|hidden)/.test(s.overflowY+s.overflowX)&&(p.scrollHeight>p.clientHeight+2||p.scrollWidth>p.clientWidth+2))return p.getBoundingClientRect();p=p.parentElement}return null};
 const name=e=>(e.getAttribute('aria-label')||e.textContent||e.value||e.dataset.act||e.tagName).trim().replace(/\s+/g,' ').slice(0,30)+' ['+(e.dataset.act||e.className||'').toString().slice(0,24)+']';
 const bad=[];for(const e of document.querySelectorAll('#main button,#main input:not([type=hidden]),#main select,#main label.btn')){if(!vis(e)||e.closest('.e-bar'))continue;const r=e.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
   if(cy<top+2||cy>bot-2||cx<0||cx>innerWidth)continue;const b=box(e);if(b&&(cy<b.top+2||cy>b.bottom-2||cx<b.left+2||cx>b.right-2))continue;
   const t=document.elementFromPoint(cx,cy);if(t&&!e.contains(t)&&!t.contains(e)&&!(t.closest('label')&&t.closest('label').contains(e))&&!(e.closest('label')&&e.closest('label').contains(t)))bad.push(name(e)+' under '+((t.closest('[class]')||t).className.toString().slice(0,30)||t.tagName))}
 const ids={};document.querySelectorAll('#main [id]').forEach(e=>{ids[e.id]=(ids[e.id]||0)+1});
 return {bad,over:document.documentElement.scrollWidth-innerWidth,dup:Object.keys(ids).filter(k=>ids[k]>1)}}"""
PIX = """async([t,x,y,w,h])=>{ED.playing=false;if(t!=null)ED.t=t;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,250));
 const cv=document.getElementById('wk'),c=cv.getContext('2d'),d=c.getImageData(Math.round(cv.width*x),Math.round(cv.height*y),Math.max(1,Math.round(cv.width*w)),Math.max(1,Math.round(cv.height*h))).data;let r=0,g=0,b=0,n=d.length/4;
 for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}return [Math.round(r/n),Math.round(g/n),Math.round(b/n)]}"""
PV = "([x,y])=>{const r=document.getElementById('wk').getBoundingClientRect();return [r.left+r.width*x,r.top+r.height*y]}"
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
green = lambda c: c[1] > 150 and c[0] < 60 and c[2] < 100
def rpc(tk, name, args):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": args}}).encode()
    r = json.loads(urllib.request.urlopen(urllib.request.Request(f"{B}/mcp?token={tk}", data=body, headers={"content-type": "application/json"}), timeout=20).read())
    res = r.get("result") or {}; t = next((c["text"] for c in res.get("content", []) if c.get("type") == "text"), "")
    try: return json.loads(t), bool(res.get("isError"))
    except Exception: return t, bool(res.get("isError"))
def get(p): return json.loads(urllib.request.urlopen(B + p, timeout=10).read())

async def open_page(b, w, h, lang, mob, setup=True):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    if setup: await pg.evaluate(SETUP, lang); await pg.wait_for_function(READY, timeout=20000); await pg.wait_for_timeout(400)
    return ctx, pg, errs
async def scan(pg, tag, states):
    found = {}
    for name, js in states:
        await pg.evaluate(js); await pg.evaluate("()=>document.querySelectorAll('.toast').forEach(t=>t.remove())"); await pg.wait_for_timeout(250)
        H = await pg.evaluate("()=>document.getElementById('main').scrollHeight"); bad, over, dup = [], 0, []
        for y in range(0, H, 450):
            await pg.evaluate("(y)=>{document.getElementById('main').scrollTop=y}", y); await pg.wait_for_timeout(60)
            r = await pg.evaluate(SCAN); over = max(over, r["over"]); dup = r["dup"]; bad += [x for x in r["bad"] if x not in bad]
        await pg.evaluate("()=>{document.getElementById('main').scrollTop=0}")
        if bad or over > 1 or dup: found[name] = {"bad": bad[:6], "over": over, "dup": dup}
    chk(f"{tag}: nothing covered, no sideways scroll, no element id twice", not found, found)
async def paint(pg, pts, touch=False):
    xy = [await pg.evaluate(PV, p) for p in pts]
    if not touch:
        await pg.mouse.move(*xy[0]); await pg.mouse.down()
        for a in xy[1:]: await pg.mouse.move(*a, steps=6)
        await pg.mouse.up(); await pg.mouse.move(2, 2)
    else:
        await pg.evaluate("""async(xy)=>{const e=document.getElementById('wk'),P=(t,x,y,tg)=>(tg||e).dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,composed:true,pointerId:9,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:t==='pointerup'?0:1}));
          P('pointerdown',xy[0][0],xy[0][1]);for(const a of xy.slice(1)){for(let i=1;i<=6;i++){P('pointermove',a[0],a[1],window);await new Promise(r=>setTimeout(r,16))}}P('pointerup',xy[xy.length-1][0],xy[xy.length-1][1],window)}""", xy)
    await pg.wait_for_timeout(350)

async def desktop(b):
    ctx, pg, errs = await open_page(b, 1440, 900, "en", False); E = pg.evaluate
    # ---- 1. the agent edits the project open here
    await E("()=>save139(false)"); await pg.wait_for_function("!!S.ed.srv139&&S.ed.opN148===0", timeout=15000)
    pid = await E("()=>S.ed.srv139"); tk = (await E("async()=>(await API.req('/v1/tokens',{method:'POST',json:{name:'Claude'}})).token"))
    chk("a connection for the agent", (tk or "").startswith("nooi_"), tk)
    r1, e1 = rpc(tk, "nooi_text_add", {"project_id": pid, "text": "From the agent", "start": 0.5, "end": 2.5, "position": "top"})
    r2, e2 = rpc(tk, "nooi_clip_add", {"project_id": pid, "asset_id": "jb", "trim_end": 2})
    chk("the agent's tools answer", not e1 and not e2, [r1, r2])
    try: await pg.wait_for_function("S.ed.clips.length===3&&S.ed.texts.some(t=>t.text==='From the agent')&&S.ed.opN148===2", timeout=12000)
    except Exception: pass
    st = await E("()=>({n:S.ed.clips.length,t:S.ed.texts.map(t=>t.text),op:S.ed.opN148,chat:(S.ed.chat143||[]).map(m=>m.t).slice(-1)[0]||'',last:S.ed.clips[2]&&S.ed.clips[2].src.name,tl:document.querySelectorAll('#tlin .blk.v').length})")
    chk("the agent's text and clip show up in the open editor by themselves (timeline too)", st["n"] == 3 and "From the agent" in st["t"] and st["op"] == 2 and st["tl"] == 3, st)
    chk("the assistant thread says what the agent did", "Your AI agent" in st["chat"] and "From the agent" in st["chat"], st["chat"])
    try: await pg.wait_for_function("(()=>{const c=S.ed.clips[2],m=c&&M['c_'+c.id];return m&&srcReady(m)})()", timeout=10000); ok = True
    except Exception: ok = False
    chk("the agent's clip plays here (its file from the account)", ok)
    # a change made here is kept, the agent's work too, nothing twice
    await E("()=>{S.ed.clips[0].vol=40;persist()}"); await E("()=>save139(false)")
    d = get(f"/v1/projects/{pid}")["doc"]["ed"]
    chk("a save from here keeps both (the volume changed here + the agent's clip and text, once each)", len(d["clips"]) == 3 and d["clips"][0]["vol"] == 40 and [t["text"] for t in d["texts"]].count("From the agent") == 1, {"n": len(d["clips"]), "t": d["texts"]})
    # an agent change while this editor hasn't asked yet, then a save from here: on the account at once, here once
    await E("()=>{AG148.next=Date.now()+600000}")
    rpc(tk, "nooi_marker_add", {"project_id": pid, "time": 1.5, "name": "Drop"})
    await E("()=>{S.ed.clips[1].vol=70;persist()}"); await E("()=>save139(false)")
    d = get(f"/v1/projects/{pid}")["doc"]["ed"]
    chk("a save made before this editor saw the agent's marker keeps the marker", len(d.get("marks146") or []) == 1 and d["clips"][1]["vol"] == 70, d.get("marks146"))
    await E("()=>{AG148.next=0}")
    try: await pg.wait_for_function("(S.ed.marks146||[]).length===1&&S.ed.opN148===3", timeout=12000)
    except Exception: pass
    mk = await E("()=>({n:(S.ed.marks146||[]).length,name:(S.ed.marks146||[])[0]&&S.ed.marks146[0].n,op:S.ed.opN148})")
    chk("…and it shows up here once", mk["n"] == 1 and mk["name"] == "Drop" and mk["op"] == 3, mk)
    u = await E("async()=>{histGo(-1);await new Promise(r=>setTimeout(r,200));return (S.ed.marks146||[]).length}")
    chk("the agent's change can be undone like any other", u == 0, u)
    await E("()=>histGo(1)")
    # the Integrations page and the assistant's hint
    await E("()=>{S.ed.tab='chat143';renderView()}"); hint = await E("()=>{const e=document.querySelector('.ag148');return e?e.textContent:''}")
    chk("the assistant panel says agents can edit this project (link to Integrations)", "Integrations" in hint and bool(await E("()=>!!document.querySelector('.ag148 [data-go=\"integrations\"]')")), hint)
    await E("()=>go('integrations')"); await pg.wait_for_timeout(300)
    it = await E("()=>document.getElementById('main').textContent")
    chk("Integrations lists the editor tools", all(n in it for n in ["nooi_timeline_read", "nooi_clip_add", "nooi_preview_frame"]) and "In the video editor" in it)
    await E("()=>{go('edit');S.ed.tab='media';renderView()}"); await pg.wait_for_timeout(300)

    # ---- 2. several timelines (one button at the end of the tool row: the open one's name, a menu with the rest)
    MENU = "()=>[...document.querySelectorAll('.cm131 .cm131i')].map(b=>b.textContent.trim())"
    async def menu():
        await pg.click('.edbar [data-act="seq148-menu"]'); await pg.wait_for_selector(".cm131"); return await E(MENU)
    async def pick(rx):
        await E("(rx)=>{[...document.querySelectorAll('.cm131 .cm131i')].find(b=>new RegExp(rx).test(b.textContent)).click()}", rx); await pg.wait_for_timeout(400)
    btn = await E("()=>{const b=document.querySelector('.ed143 .e-tl .edbar .seq148b');if(!b)return null;const r=b.getBoundingClientRect(),w=document.querySelector('.edbar').getBoundingClientRect();return{t:b.textContent.trim(),inside:r.right<=w.right+1&&r.left>=w.left-1,row:!document.querySelector('.e-tl > .seq148')}}")
    chk("the Timelines button at the end of the tool row, whole (no row of its own on a computer)", btn and btn["t"] == "Timeline 1" and btn["inside"] and btn["row"], btn)
    ids0 = await E("()=>S.ed.clips.map(c=>c.id)")
    items = await menu()
    chk("its menu: the open one ticked, new empty, a copy, rename (no delete with only one)", items == ["Timeline 1 · open now", "New empty timeline", "Copy of “Timeline 1”", "Rename “Timeline 1”"], items)
    await pick("^Copy of")
    s2 = await E("()=>({list:S.ed.seq148.list.map(x=>x.name),cur:S.ed.seq148.list.findIndex(x=>x.id===S.ed.seq148.cur),ids:S.ed.clips.map(c=>c.id),n:S.ed.clips.length,t:S.ed.texts.length,mk:(S.ed.marks146||[]).length,hist:HIST.stack.length,btn:document.querySelector('.seq148b').textContent.trim()})")
    chk("a copy of the timeline opens (its own ids, same clips, texts and markers, fresh undo; the button shows its name and 2)", s2["list"] == ["Timeline 1", "Timeline 1 · copy"] and s2["cur"] == 1 and s2["n"] == 3 and s2["t"] == 1 and s2["mk"] == 1 and not set(s2["ids"]) & set(ids0) and s2["hist"] == 1 and s2["btn"] == "Timeline 1 · copy2", s2)
    try: await pg.wait_for_function("S.ed.clips.every(c=>{const m=clipMedia(c);return m&&srcReady(m)})", timeout=10000); ok = True
    except Exception: ok = False
    chk("the copy's clips play (their files copied)", ok)
    await E("()=>{S.ed.clips.splice(0,1);S.ed.format='reels';persist();renderView()}")
    await menu(); await pick("^Open “Timeline 1”")
    s3 = await E("()=>({n:S.ed.clips.length,f:S.ed.format,ids:S.ed.clips.map(c=>c.id),t:ED.t,other:S.ed.seq148.list[1].data.clips.length,of:S.ed.seq148.list[1].data.format})")
    chk("switching back: the first timeline as it was (3 clips, 16:9), the copy keeps its own (2 clips, 9:16)", s3["n"] == 3 and s3["f"] == "youtube" and s3["ids"] == ids0 and s3["t"] == 0 and s3["other"] == 2 and s3["of"] == "reels", s3)
    # rename in place
    await menu(); await pick("^Rename"); await pg.wait_for_selector("[data-seq148n]")
    foc = await E("()=>document.activeElement&&document.activeElement.dataset.seq148n!=null")
    await pg.keyboard.press("Control+A"); await pg.keyboard.type("Main cut"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
    nm = await E("()=>S.ed.seq148.list.map(x=>x.name)")
    chk("rename in place (focused, Enter keeps it)", foc and nm[0] == "Main cut", [foc, nm])
    # an empty one, then deleted (with a question)
    await menu(); await pick("^New empty")
    s4 = await E("()=>({list:S.ed.seq148.list.map(x=>x.name),n:S.ed.clips.length,t:S.ed.texts.length,f:S.ed.format})")
    chk("an empty timeline (nothing on it, the same size)", s4["list"] == ["Main cut", "Timeline 3", "Timeline 1 · copy"] and s4["n"] == 0 and s4["t"] == 0 and s4["f"] == "youtube", s4)
    items = await menu(); await E("()=>cmClose131()")
    chk("with three: the other two to open, and Delete", items[:3] == ["Open “Main cut”", "Timeline 3 · open now", "Open “Timeline 1 · copy”"] and items[-1] == "Delete “Timeline 3”", items)
    await scan(pg, "desktop timelines", [("three timelines", "()=>{renderView()}")])
    await E("()=>cmClose131()")
    await menu(); await pick("^Delete"); conf = await E(MENU); await pick("^Delete")
    s5 = await E("()=>({list:S.ed.seq148.list.map(x=>x.name),cur:S.ed.seq148.list.find(x=>x.id===S.ed.seq148.cur).name,n:S.ed.clips.length})")
    chk("delete asks first, then the next timeline opens", len(conf) == 2 and s5["list"] == ["Main cut", "Timeline 1 · copy"] and s5["cur"] == "Timeline 1 · copy" and s5["n"] == 2, [conf, s5])
    # saved to the account, opened on another device: both timelines with their files
    await E("()=>save139(false)"); d = get(f"/v1/projects/{pid}")["doc"]
    keys = set(d["media"].keys()); other = d["ed"]["seq148"]["list"][0]["data"]["clips"]
    chk("the account has both timelines and every clip file of both", len(d["ed"]["seq148"]["list"]) == 2 and all(("c_" + c["id"] in keys) or c["src"]["k"] == "job" for c in other + d["ed"]["clips"]) and all(c["src"].get("url139") for c in other if c["src"]["k"] == "job"), sorted(keys))
    ctx2, p2, e2s = await open_page(b, 1280, 860, "en", False, setup=False)
    await p2.evaluate("""async(id)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;S.jobs=[];PJ.fresh('edit');await open139(id)}""", pid)
    await p2.wait_for_function("S.view==='edit'&&S.ed.seq148&&S.ed.seq148.list.length===2", timeout=15000)
    await p2.evaluate("()=>seqGo148(S.ed.seq148.list.find(x=>x.id!==S.ed.seq148.cur).id)"); await p2.wait_for_timeout(400)
    try: await p2.wait_for_function("S.ed.clips.length===3&&S.ed.clips.every(c=>{const m=clipMedia(c);return m&&srcReady(m)})", timeout=15000); ok = True
    except Exception: ok = False
    o2 = await p2.evaluate("()=>({n:S.ed.clips.length,cur:S.ed.seq148.list.find(x=>x.id===S.ed.seq148.cur).name,op:S.ed.opN148})")
    chk("another device opens it: switch to the other timeline and all its clips play", ok and o2["cur"] == "Main cut" and o2["op"] == 3, o2)
    chk("no page errors (second device)", not e2s, e2s); await ctx2.close()
    # the page opened again on this device: the other timeline's own uploaded file is still here
    await pg.reload(); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await E("""async()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.user={name:'T',method:'google'};AU.showAuth=false;S.localAI=true;
      {const c=document.createElement('canvas');c.width=64;c.height=36;const x=c.getContext('2d');x.fillStyle='#fff';x.beginPath();x.arc(32,18,9,0,7);x.fill();window.CUT=await new Promise(r=>c.toBlob(r,'image/png'))}
      laiCall=async()=>({blob:CUT});go('edit');renderAll()}""")
    await pg.wait_for_selector(".seq148b"); await pg.click('.edbar [data-act="seq148-menu"]'); await pg.wait_for_selector(".cm131")
    await E("()=>{[...document.querySelectorAll('.cm131 .cm131i')].find(b=>/^Open/.test(b.textContent.trim())).click()}"); await pg.wait_for_timeout(500)
    try: await pg.wait_for_function("S.ed.clips.length===3&&S.ed.clips.filter(c=>c.src.k==='upload').every(c=>M['c_'+c.id]&&srcReady(M['c_'+c.id]))", timeout=15000); ok = True
    except Exception: ok = False
    chk("after a reload the other timeline's uploaded clip is still on this device", ok, await E("()=>S.ed.clips.map(c=>[c.src.k,!!M['c_'+c.id]])"))

    # ---- 3. the brush on the cut-out
    await E("""async()=>{const c=S.ed.clips.find(x=>x.src.k==='upload');S.ed.sel=c.id;edSetPick('clip',c.id);S.ed.tab='bg144';ED.t=edStarts()[S.ed.clips.indexOf(c)]+1;await bgRun144(c,true);c.bg144.mode='color';c.bg144.col='#00b140';persist();renderView()}""")
    await pg.wait_for_function("(()=>{const c=S.ed.clips.find(x=>x.id===S.ed.sel);return c&&bgReady144(c)})()", timeout=15000)
    t0 = await E("()=>ED.t")
    a0 = await E(PIX, [t0, .47, .47, .06, .06]); c0 = await E(PIX, [t0, .08, .08, .06, .06])
    chk("the cut-out: the picture in the middle, green around", not green(a0) and green(c0), [a0, c0])
    ui = await E("()=>{const b=document.querySelector('.br148');return b?[...b.querySelectorAll('[data-act=\"br148\"]')].map(x=>x.textContent.trim()):null}")
    chk("the background panel has the brush (Off · Keep · Remove)", ui == ["Off", "Keep", "Remove"], ui)
    await pg.click('.br148 [data-act="br148"][data-v="cut"]'); await pg.wait_for_timeout(200)
    await paint(pg, [[.42, .5], [.58, .5]])
    a1 = await E(PIX, [None, .49, .48, .02, .04])
    chk("Remove: where it was painted the background shows", green(a1), a1)
    await pg.click('.br148 [data-act="br148"][data-v="keep"]'); await pg.wait_for_timeout(200)
    await paint(pg, [[.08, .1], [.14, .1]])
    c1 = await E(PIX, [None, .1, .09, .02, .02])
    chk("Keep: where it was painted the picture comes back", not green(c1), c1)
    bs = await E("()=>{const c=S.ed.clips.find(x=>x.id===S.ed.sel);return c.bg144.brush148.map(s=>({m:s.m,n:s.p.length,x:s.p[0][0],y:s.p[0][1]}))}")
    chk("the strokes are kept on the clip in the picture's own places", len(bs) == 2 and bs[0]["m"] == "cut" and bs[1]["m"] == "keep" and abs(bs[0]["x"] - .42) < .03 and abs(bs[0]["y"] - .5) < .03 and abs(bs[1]["y"] - .1) < .03 and bs[0]["n"] >= 2, bs)
    pl = await E("()=>ED.playing"); chk("painting on the preview doesn't start the video", pl is False)
    await scan(pg, "desktop brush", [("brush on", "()=>{renderView()}")])
    await pg.keyboard.press("Control+z"); await pg.wait_for_timeout(300)
    n = await E("()=>S.ed.clips.find(x=>x.id===S.ed.sel).bg144.brush148.length"); chk("undo takes the last stroke away", n == 1, n)
    # a turned clip: the brush lands on the place under the pointer
    await E("()=>{const c=S.ed.clips.find(x=>x.id===S.ed.sel);c.bg144.brush148=[];c.rot=90;S.ed.fit='fit';persist();renderView()}")
    await pg.click('.br148 [data-act="br148"][data-v="cut"]'); await pg.wait_for_timeout(300)
    await paint(pg, [[.5, .3]])
    p0 = await E("()=>S.ed.clips.find(x=>x.id===S.ed.sel).bg144.brush148[0].p[0]")
    chk("on a clip turned 90°, the top of the preview is the left of the picture", abs(p0[0] - .3) < .03 and abs(p0[1] - .5) < .03, p0)
    # off: the preview works as before
    await pg.click('.br148 [data-act="br148"][data-v=""]'); pv = await E("()=>pvTools()"); chk("brush off: the preview's own tools are back", pv is True)
    await E("()=>{S.ed.tab='clip';renderView()}")
    chk("no page errors (computer)", not errs, errs); out["desktop"] = {"agent": st, "timelines": s5}
    await ctx.close()

async def phone(b):
    ctx, pg, errs = await open_page(b, 390, 844, "ar", True); E = pg.evaluate
    await E("()=>{MS146.mod=null;edSetPick(null);S.ed.sel=null;renderView()}"); await pg.wait_for_timeout(200)
    row = await E("()=>({row:!!document.querySelector('.ed143 .e-tl > .seq148'),bar:[...document.querySelectorAll('.ed143 .e-bar [data-act=\"seq148-menu\"]')].map(b=>b.textContent.trim())})")
    chk("phone (AR): one timeline — no row; Timelines in the tool bar", not row["row"] and row["bar"] == ["الخطوط الزمنية"], row)
    await E("()=>seqNew148(seqQ148(true).cur)"); await pg.wait_for_timeout(300)
    r2 = await E("()=>{const b=document.querySelector('.ed143 .e-tl > .seq148 .seq148b');return b?b.textContent.trim():null}")
    chk("phone: with two, the open one's name over the timeline", r2 == "الخط الزمني 1 · نسخة2", r2)
    await pg.tap('.ed143 .e-bar [data-act="seq148-menu"]'); await pg.wait_for_timeout(250)
    mi = await E("()=>{const d=document.querySelector('.cm131');return d?{sheet:d.classList.contains('sheet'),items:[...d.querySelectorAll('.cm131i')].map(b=>b.textContent.trim())}:null}")
    chk("phone: Timelines opens its menu as a sheet (open, new, copy, rename, delete)", mi and mi["sheet"] and len(mi["items"]) == 6 and mi["items"][0].startswith("افتح") and mi["items"][-1].startswith("احذف"), mi)
    await E("()=>cmClose131()")
    await scan(pg, "phone timelines", [("two timelines", "()=>{renderView()}")])
    # the brush with a finger
    await E("""async()=>{const c=S.ed.clips.find(x=>x.src.k==='upload');S.ed.sel=c.id;edSetPick('clip',c.id);S.ed.tab='bg144';ED.t=edStarts()[S.ed.clips.indexOf(c)]+1;await bgRun144(c,true);c.bg144.mode='color';c.bg144.col='#00b140';S.ed.bgBrush148='cut';persist();renderView()}""")
    await pg.wait_for_function("(()=>{const c=S.ed.clips.find(x=>x.id===S.ed.sel);return c&&bgReady144(c)})()", timeout=15000)
    await E("()=>{const w=document.getElementById('wk');w.scrollIntoView({block:'center'})}"); await pg.wait_for_timeout(300)
    await paint(pg, [[.4, .5], [.6, .5]], touch=True)
    a1 = await E(PIX, [None, .49, .48, .02, .04]); n = await E("()=>(S.ed.clips.find(x=>x.id===S.ed.sel).bg144.brush148||[]).length")
    chk("phone: a finger paints the cut-out (Remove) — no long-press menu", green(a1) and n == 1 and not await E("()=>!!document.querySelector('.cm131')"), [a1, n])
    await scan(pg, "phone brush", [("brush panel", "()=>{renderView()}")])
    chk("no page errors (phone)", not errs, errs)
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        try:
            await desktop(b); await phone(b)
        finally: await b.close()

env = dict(os.environ); srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    asyncio.run(main())
except Exception as e: fails.append("crashed: " + repr(e)[:400])
finally: srv.kill()
print(json.dumps(out, ensure_ascii=False)[:1500])
print("FAIL " + str(len(fails)) if fails else "PASS"); [print(" ✗", f) for f in fails]
sys.exit(1 if fails else 0)
