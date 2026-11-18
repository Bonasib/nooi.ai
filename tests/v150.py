# v150: an ad like the owner's example, made in the editor — the AI builds it from a short brief (no text AI here: the page's own
# plan) as animated motion scenes on a timeline of its own (the user's edit stays in its own), with the ad's background clip and
# whooshes at the cuts; each scene draws its own picture and changes when its words or kind change; scenes by hand from tiles;
# "over the video" keeps the video; the scenes moved onto the music's beat; an AI agent's motion ad shows up live · the mixer:
# faders for clips, music, voice-over, sound effects and the master in the preview and in the exported sound, mute, meters that
# move while it plays · the phone: the Motion ad panel, the mixer and the motion tiles fit, Arabic too.
# Run: python3 tests/v150.py
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT = 8438; B = f"http://localhost:{PORT}"
D = tempfile.mkdtemp(prefix="nooi-v150-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
json.dump({"users": {"local": {"plan": "studio", "credits": 5000, "ledger": [], "jobs": {}}}}, open(D + "/data/db.json", "w"))
FF = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
FF("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=8", "-f", "lavfi", "-i", "sine=frequency=330:duration=8", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "1M", "-c:a", "libopus", "-shortest", D + "/media/a.webm")
FF("-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-c:a", "libopus", D + "/media/m.webm")
BRIEF = "Learn any skill in 5 minutes a day. Keep a 369 day streak and climb the league with friends. Talk to a tutor on a video call. Pick from: languages, math, music, chess. One app. Every skill."
SETUP = """async(l)=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang=l;S.user={name:'T',method:'google'};AU.showAuth=false;S.cloud149=false;
 PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.infos=[];S.ed.vfx=[];S.ed.texts=[];S.ed.format='reels';
 const v=await (await fetch('/media/a.webm')).blob();edAddFiles([new File([v],'beach.webm',{type:'video/webm'})]);S.ed.tab='media';go('edit');renderAll()}"""
READY = "S.ed.clips.length===1&&document.querySelector('.ed143 #wk')&&srcReady(clipMedia(S.ed.clips[0]))"
SCAN = open(os.path.join(ROOT, "tests/v148.py")).read().split('SCAN = r"""')[1].split('"""')[0]
GRAB = """async(t)=>{ED.playing=false;ED.t=t;for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));await new Promise(r=>setTimeout(r,180));for(let i=0;i<2;i++)await new Promise(r=>requestAnimationFrame(r));
 const cv=document.getElementById('wk'),s=document.createElement('canvas');s.width=54;s.height=96;s.getContext('2d').drawImage(cv,0,0,54,96);return [...s.getContext('2d').getImageData(0,0,54,96).data]}"""
fails, out = [], {}
def chk(name, ok, info=None):
    if not ok: fails.append(name + ("" if info is None else " · " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
def diff(a, b): return sum(abs(a[i] - b[i]) for i in range(0, len(a)) if i % 4 != 3) / (len(a) / 4) / 3
def bright(a): return sum(a[i] for i in range(0, len(a)) if i % 4 != 3) / (len(a) / 4) / 3

async def open_page(b, w, h, lang, mob):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mob, has_touch=mob); pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(B + "/"); await pg.wait_for_function("typeof API!=='undefined'&&API.mode==='server'", timeout=15000)
    await pg.evaluate(SETUP, lang); await pg.wait_for_function(READY, timeout=20000); await pg.wait_for_timeout(400)
    return ctx, pg, errs
async def scan(pg, tag, states):
    found = {}
    for name, js in states:
        await pg.evaluate(js); await pg.evaluate("()=>document.querySelectorAll('.toast').forEach(t=>t.remove())"); await pg.wait_for_timeout(300)
        H = await pg.evaluate("()=>document.getElementById('main').scrollHeight"); bad, over, dup = [], 0, []
        for y in range(0, H, 450):
            await pg.evaluate("(y)=>{document.getElementById('main').scrollTop=y}", y); await pg.wait_for_timeout(60)
            r = await pg.evaluate(SCAN); over = max(over, r["over"]); dup = r["dup"]; bad += [x for x in r["bad"] if x not in bad]
        await pg.evaluate("()=>{document.getElementById('main').scrollTop=0}")
        if bad or over > 1 or dup: found[name] = {"bad": bad[:6], "over": over, "dup": dup}
    chk(f"{tag}: nothing covered, no sideways scroll, no element id twice", not found, found)

async def desktop(b):
    ctx, pg, errs = await open_page(b, 1440, 900, "en", False); E = pg.evaluate
    # ---- 1. the Motion ad panel in AI; the ad built from the brief
    await E("()=>{S.ed.tab='ad150';S.ed.lt143='ai';renderView()}"); await pg.wait_for_timeout(250)
    p = await E("()=>({b:!!document.querySelector('[data-ad150=\"brand\"]'),m:!!document.querySelector('[data-ad150=\"msg\"]'),go:!!document.querySelector('[data-act=\"ad150-go\"]'),free:(document.querySelector('[data-act=\"ad150-go\"]').parentElement.textContent||'').includes('Free'),cols:document.querySelectorAll('[data-act=\"ad150-col\"]').length,lens:document.querySelectorAll('[data-act=\"ad150-len\"]').length})")
    chk("AI → Motion ad: brand, what it says, colour, length and Build (free)", p["b"] and p["m"] and p["go"] and p["free"] and p["cols"] == 8 and p["lens"] == 5, p)
    await pg.fill('[data-ad150="brand"]', "Lingo"); await pg.fill('[data-ad150="msg"]', BRIEF)
    await pg.click('[data-act="ad150-col"][data-v="#1CB0F6"]'); await pg.click('[data-act="ad150-len"][data-v="30"]')
    await pg.click('[data-act="ad150-go"]')
    await pg.wait_for_function("(S.ed.infos||[]).filter(x=>x.type==='mg150').length>5", timeout=15000); await pg.wait_for_timeout(500)
    r = await E("""()=>{const q=S.ed.seq148,sc=S.ed.infos.filter(x=>x.type==='mg150');return {tls:q?q.list.map(x=>x.name):[],cur:q?q.list.find(x=>x.id===q.cur).name:'',other:q?q.list.filter(x=>x.id!==q.cur).map(x=>x.data&&x.data.clips.length):[],
      clips:S.ed.clips.map(c=>[c.src.k,c.src.kind,c.src.ac,c.out]),sc:sc.map(x=>[x.sc,x.start,x.end]),tot:edTotal(),col:[...new Set(sc.map(x=>x.accent))],wh:S.ed.sfx.filter(x=>x.n==='whoosh').length,lib:S.ad150.brand}}""")
    out["ad"] = r
    chk("the ad goes on a timeline of its own (“Ad · Lingo”); the edit with the beach clip stays in its own", r["cur"] == "Ad · Lingo" and len(r["tls"]) == 2 and r["other"] == [1], r)
    chk("…its background clip (no file) as long as the ad, 30 s, in the colour picked; the scenes back to back in that colour", r["clips"] == [["demo", "mg150", "#1CB0F6", 30]] and abs(r["tot"] - 30) < .05 and r["col"] == ["#1CB0F6"] and all(abs(r["sc"][i][1] - r["sc"][i - 1][2]) < .01 for i in range(1, len(r["sc"]))), r)
    kinds = [x[0] for x in r["sc"]]
    chk("…the scenes the brief speaks of: logo first, light, words, the app screen, the 369 streak, the league, the call, the four skills, the closing words, the end card", kinds == ["logo", "trail", "words", "phone", "counter", "board", "call", "nodes", "words", "end"] and r["wh"] == len(kinds) - 1, kinds)
    # each scene draws its own picture (not one look for all)
    pics = []
    for s in r["sc"]: pics.append(await E(GRAB, s[1] + (s[2] - s[1]) * .7))
    lit = [round(bright(x), 1) for x in pics]; dd = [round(diff(pics[i], pics[i - 1]), 1) for i in range(1, len(pics))]
    out["pics"] = {"lit": lit, "diff": dd}
    chk("every scene draws a picture of its own on the dark background (bright enough, each different from the one before)", all(x > 4 for x in lit) and all(x > 1.2 for x in dd), out["pics"])
    # the exported video has the scenes (drawn frame by frame like the preview): the logo in the ad's colour at 1.5 s
    ex = await E("""async()=>{const r=await edRender139(4);if(!r)return null;const b=new Uint8Array(await r.blob.arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return {mime:r.mime,data:btoa(s)}}""")
    if ex:
        import base64; fx = D + "/ad." + ("mp4" if "mp4" in ex["mime"] else "webm"); open(fx, "wb").write(base64.b64decode(ex["data"]))
        px = subprocess.run(["ffmpeg", "-v", "error", "-ss", "1.5", "-i", fx, "-frames:v", "1", "-vf", "scale=27:48", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        rgb = [sum(px[i::3]) / max(1, len(px) // 3) for i in range(3)]; out["export"] = [round(x, 1) for x in rgb]
        chk("the exported video has the motion scenes: at 1.5 s the logo glows in the ad's blue on the dark background", len(px) > 0 and rgb[2] > rgb[0] + 4 and 8 < sum(rgb) / 3 < 120, out["export"])
    else: chk("the export ran (frame by frame)", False, ex)
    # ---- 2. a scene changed: its words and its kind
    sid = await E("()=>S.ed.infos.find(x=>x.sc==='counter').id")
    a0 = await E(GRAB, r["sc"][4][1] + 2)
    await E("(id)=>{edSetPick('info',id);S.ed.tab='info';S.ed.lt143='stickers';renderView()}", sid); await pg.wait_for_timeout(250)
    f = await E("()=>({sc:document.querySelectorAll('[data-act=\"mg150-sc\"]').length,num:!!document.querySelector('[data-ib=\"val\"]'),bg:document.querySelectorAll('[data-act=\"mg150-bg\"]').length,icons:document.querySelectorAll('[data-act=\"ic131-set\"]').length})")
    chk("a scene picked: its kind (9), the number, its background and its icon can be changed", f["sc"] == 9 and f["num"] and f["bg"] == 2 and f["icons"] > 30, f)
    await pg.fill('[data-ib="val"]', "1200"); await pg.wait_for_timeout(500)
    a1 = await E(GRAB, r["sc"][4][1] + 2)
    chk("…a new number draws a new picture", await E("(id)=>S.ed.infos.find(x=>x.id===id).val", sid) == "1200" and diff(a0, a1) > .8, round(diff(a0, a1), 2))
    await pg.click('[data-act="mg150-sc"][data-v="board"]'); await pg.wait_for_timeout(300)
    a2 = await E(GRAB, r["sc"][4][1] + 2)
    chk("…another kind (leaderboard) draws it as that", await E("(id)=>S.ed.infos.find(x=>x.id===id).sc", sid) == "board" and diff(a1, a2) > 1.5, round(diff(a1, a2), 2))
    # ---- 3. the Motion ad panel lists the scenes; the beat
    await E("()=>{edSetPick(null);S.ed.tab='ad150';S.ed.lt143='ai';renderView()}"); await pg.wait_for_timeout(200)
    li = await E("()=>({n:document.querySelectorAll('[data-act=\"ad150-pick\"]').length,beat:document.querySelector('[data-act=\"ad150-beat\"]').disabled})")
    chk("the panel lists the ad's scenes; “Fit to the beat” waits for music", li["n"] == 10 and li["beat"] is True, li)
    await E("""async()=>{const v=await (await fetch('/media/m.webm')).blob();loadSlot('edMusic',new File([v],'m.webm',{type:'audio/webm'}));S.ed.beats146={on:true,t:Array.from({length:12},(_,i)=>+(i*.5).toFixed(2)),bpm:120,dur:6,name:'m'};renderView()}""")
    await pg.wait_for_timeout(600); await pg.click('[data-act="ad150-beat"]'); await pg.wait_for_timeout(400)
    bt = await E("()=>S.ed.infos.filter(x=>x.type==='mg150').sort((a,b)=>a.start-b.start).map(x=>[x.start,x.end])")
    on = all(abs(e * 2 - round(e * 2)) < .02 for s, e in bt[:-1])
    chk("“Fit to the beat”: every cut on a beat of the music (0.5 s here), the scenes still back to back", on and all(abs(bt[i][0] - bt[i - 1][1]) < .01 for i in range(1, len(bt))), bt)
    wh = await E("()=>{const ed=S.ed.infos.filter(x=>x.type==='mg150').map(x=>x.start);return S.ed.sfx.filter(x=>x.n==='whoosh').every(w=>ed.some(s=>Math.abs(s-.18-w.t)<.02))}")
    chk("…the whooshes moved with the cuts", wh, None)
    # ---- 4. a scene by hand, over the video
    await E("()=>{const q=S.ed.seq148;seqGo148(q.list[0].id);renderView()}"); await pg.wait_for_timeout(400)
    await pg.wait_for_function(READY, timeout=15000)
    await E("()=>{S.ed.tab='info';S.ed.lt143='stickers';edSetPick(null);renderView()}"); await pg.wait_for_timeout(300)
    tl = await E("()=>[...document.querySelectorAll('.mg150t')].map(x=>x.dataset.v)")
    chk("Graphics & stickers: nine motion scenes to tap or drag", len(tl) == 9 and tl[0] == "mg150:logo", tl)
    base = await E(GRAB, 1.5)
    await E("()=>{ED.t=0.5}"); await pg.click('.mg150t[data-v="mg150:counter"]'); await pg.wait_for_timeout(300)
    it = await E("()=>{const x=S.ed.infos.find(i=>i.type==='mg150');return x&&{sc:x.sc,s:x.start,e:x.end,bg:x.bg,v:x.val}}")
    chk("a tap adds the scene at the playhead (3 s, its own background)", it and it["sc"] == "counter" and it["s"] == .5 and it["e"] == 3.5 and it["bg"] == "dark", it)
    dk = await E(GRAB, 1.5)
    await pg.click('[data-act="mg150-bg"][data-v="none"]'); await pg.wait_for_timeout(300)
    ov = await E(GRAB, 1.5)
    out["over"] = {"dark": round(diff(base, dk), 1), "over": round(diff(base, ov), 1)}
    chk("“Over the video” keeps the video under the scene (its own background hid it)", diff(base, dk) > 25 and diff(base, ov) < diff(base, dk) * .5, out["over"])
    # ---- 5. an AI agent's motion ad, live
    n0 = await E("()=>S.ed.infos.length")
    ok = await E("()=>op148({op:'motion_add',args:{bg:{id:'bgA',out:6,ac:'#FFC800'},infos:[{id:'mA',type:'mg150',sc:'words',start:8,end:11,x:.5,y:.5,k:1,anim:'in',bg:'dark',accent:'#FFC800',t1:'Hello',t2:'from Claude',items:''},{id:'mB',type:'mg150',sc:'nodes',start:11,end:14,x:.5,y:.5,k:1,anim:'in',bg:'dark',accent:'#FFC800',items:'Languages | Music'}],sfx:[{id:'wA',n:'whoosh',t:10.8,vol:55}]}})")
    ok2 = await E("()=>op148({op:'motion_add',args:{infos:[{id:'mA',type:'mg150',sc:'words',start:8,end:11}]}})")
    ag = await E("()=>({n:S.ed.infos.length,clips:S.ed.clips.length,bg:S.ed.clips[1]&&S.ed.clips[1].src.kind,ics:(S.ed.infos.find(x=>x.id==='mB')||{}).ics})")
    chk("an AI agent's motion ad shows up live (its background clip, scenes, sound); the same one twice changes nothing", ok and not ok2 and ag["n"] == n0 + 2 and ag["clips"] == 2 and ag["bg"] == "mg150", ag)
    # ---- 6. the mixer
    await E("()=>{S.ed.tab='mix150';S.ed.lt143='audio';renderView()}"); await pg.wait_for_timeout(300)
    mx = await E("()=>[...document.querySelectorAll('.mx150r')].map(r=>[r.dataset.k,r.querySelector('input').value,!!r.querySelector('.mx150m i'),!!r.querySelector('[data-act=\"mx150-mute\"]')])")
    chk("Audio → Mixer: clips, music, voice-over, sound effects and the master — a fader, a meter and mute each", [x[0] for x in mx] == ["clips", "music", "voice", "sfx", "master"] and all(x[2] and x[3] for x in mx) and mx[0][1] == "100" and mx[1][1] == "80", mx)
    async def setf(k, v): await E("([k,v])=>{const i=document.querySelector('[data-mx150=\"'+k+'\"]');i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}))}", [k, v])
    await setf("clips", 50); await setf("master", 80); await setf("music", 60)
    v = await E("""async()=>{ED.t=1;ED.playing=true;await new Promise(r=>setTimeout(r,700));const c=S.ed.clips[0],m=M['c_'+c.id];const r={clip:+m.el.volume.toFixed(3),music:+M.edMusic.el.volume.toFixed(3),bus:EDX.bus?+EDX.bus.gain.value.toFixed(3):null};ED.playing=false;return r}""")
    chk("the preview follows the faders: clips 50 % × master 80 % = 0.4, music 60 % × 80 % = 0.48", abs(v["clip"] - .4) < .02 and abs(v["music"] - .48) < .02, v)
    await E("()=>{edxBus();document.querySelector('[data-act=\"mx150-mute\"][data-v=\"sfx\"]').click()}"); await pg.wait_for_timeout(200)
    v2 = await E("async()=>{ED.t=1;ED.playing=true;await new Promise(r=>setTimeout(r,400));const g=EDX.bus.gain.value;ED.playing=false;return {g,pressed:document.querySelector('[data-act=\"mx150-mute\"][data-v=\"sfx\"]').getAttribute('aria-pressed')}}")
    chk("mute: the sound effects go silent", v2["g"] == 0 and v2["pressed"] == "true", v2)
    # the export's sound: the same faders (clips at 50 % × 80 % ≈ 0.4 of the loudness), the user's settings back after
    lv = await E("""async()=>{S.ed.clips=S.ed.clips.slice(0,1);S.ed.infos=[];S.ed.sfx=[];const rms=b=>{const d=b.getChannelData(0);let s=0,n=0;for(let i=0;i<d.length;i+=7){s+=d[i]*d[i];n++}return Math.sqrt(s/n)};
      const keep=JSON.stringify(S.ed.mix150);S.ed.mix150={clips:100,sfx:100,master:100,mute:{music:true}};const a=await mix139(4);S.ed.mix150=JSON.parse(keep);S.ed.mix150.mute={music:true};const b=await mix139(4);
      return {a:rms(a),b:rms(b),vol:S.ed.clips[0].vol,mv:S.ed.musicVol}}""")
    out["mix"] = lv
    chk("the exported sound follows the mixer too (clips 50 % × master 80 % → 0.4 of the level), and nothing is changed after", .3 < lv["b"] / max(1e-9, lv["a"]) < .5 and lv["vol"] == 100 and lv["mv"] == 60, lv)
    # meters move while it plays
    await E("()=>{S.ed.mix150={clips:100,sfx:100,master:100,mute:{}};renderView()}"); await pg.wait_for_timeout(300)
    mt = await E("""async()=>{ED.t=.5;ED.playing=true;let mx=0;for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));const w=parseFloat(document.querySelector('.mx150r[data-k="clips"] .mx150m i').style.width)||0;if(w>mx)mx=w}ED.playing=false;return mx}""")
    chk("the clips' meter moves while the video plays", mt > 30, mt)
    await E("()=>document.querySelector('[data-act=\"mx150-reset\"]').click()"); await pg.wait_for_timeout(200)
    rs = await E("()=>({m:S.ed.mix150,mv:S.ed.musicVol,vv:S.ed.voiceVol})")
    chk("Reset the mix: every fader back", rs["m"]["clips"] == 100 and rs["m"]["master"] == 100 and not any(rs["m"]["mute"].values()) and rs["mv"] == 80 and rs["vv"] == 100, rs)
    await scan(pg, "desktop", [("motion ad", "()=>{S.ed.tab='ad150';S.ed.lt143='ai';renderView()}"), ("mixer", "()=>{S.ed.tab='mix150';S.ed.lt143='audio';renderView()}"),
                               ("motion tiles", "()=>{S.ed.tab='info';S.ed.lt143='stickers';edSetPick(null);renderView()}")])
    chk("no page errors (computer)", not errs, errs); await ctx.close()

async def phone(b):
    ctx, pg, errs = await open_page(b, 390, 844, "ar", True); E = pg.evaluate
    await E("()=>{S.ad150={brand:'لينغو',msg:'تعلّم أي مهارة في خمس دقائق يومياً. حافظ على سلسلة 369 يوماً. اختر: اللغات، الرياضيات، الموسيقى. تطبيق واحد. كل المهارات.',col:'#7CFF4F',len:20};S.ed.tab='ad150';S.ed.lt143='ai';renderView()}")
    await pg.wait_for_timeout(300)
    await E("()=>document.querySelector('[data-act=\"ad150-go\"]').scrollIntoView({block:'center'})"); await pg.tap('[data-act="ad150-go"]')
    await pg.wait_for_function("(S.ed.infos||[]).filter(x=>x.type==='mg150').length>4", timeout=15000); await pg.wait_for_timeout(500)
    r = await E("()=>({cur:S.ed.seq148&&S.ed.seq148.list.find(x=>x.id===S.ed.seq148.cur).name,sc:S.ed.infos.map(x=>x.sc),t1:S.ed.infos.map(x=>x.t1).filter(Boolean)})")
    chk("phone (Arabic): the ad from an Arabic brief, in Arabic, on its own timeline", (r["cur"] or "").startswith("إعلان") and r["sc"][0] == "logo" and r["sc"][-1] == "end" and "counter" in r["sc"] and any("ل" in x for x in r["t1"]), r)
    pic = await E(GRAB, 1.5)
    chk("phone: the scene is drawn", bright(pic) > 4, round(bright(pic), 1))
    await scan(pg, "phone ar", [("motion ad", "()=>{edSetPick(null);S.ed.tab='ad150';S.ed.lt143='ai';S.ed.pclosed143=null;renderView()}"), ("mixer", "()=>{S.ed.tab='mix150';S.ed.lt143='audio';S.ed.pclosed143=null;renderView()}"),
                                ("motion tiles", "()=>{S.ed.tab='info';S.ed.lt143='stickers';S.ed.pclosed143=null;renderView()}"),
                                ("a scene picked", "()=>{const x=S.ed.infos.find(i=>i.sc==='counter');edSetPick('info',x.id);S.ed.tab='info';S.ed.pclosed143=null;renderView()}")])
    chk("no page errors (phone)", not errs, errs); await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        try:
            await desktop(b); await phone(b)
        finally: await b.close()
env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "KIE_", "GOOGLE_", "LOCAL_LLM", "GEMMA_"))}
srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="v" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=B, AGENTS_AUTO_LEARN="false", FREE_PERIOD="false"), stdout=open(D + "/srv.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(80):
        try: urllib.request.urlopen(B + "/v1/health", timeout=2); break
        except Exception: time.sleep(0.25)
    asyncio.run(main())
except Exception as e: fails.append("crashed: " + repr(e)[:400])
finally: srv.kill()
print(json.dumps(out, ensure_ascii=False, default=str)[:1500])
print("FAIL " + str(len(fails)) if fails else "PASS"); [print(" ✗", f) for f in fails]
sys.exit(1 if fails else 0)
