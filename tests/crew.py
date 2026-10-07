import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
MOCK = r"""
window.__calls={};window.__proofRuns=0;
const W={title:"رسالة من الماضي",logline:"حارس منارة عجوز يجد رسالة في زجاجة كتبها بنفسه قبل أربعين عاماً.",genre:"drama",synopsis:"في ليلة عاصفة يجد سالم زجاجة على الصخور، وفيها رسالة بخط يده من شبابه تذكّره بحلم نسيه.",
 characters:[{name:"سالم",role:"البطل",description:"حارس منارة في السبعين، لحية بيضاء ومعطف أصفر"},{name:"سالم الشاب",role:"الذكرى",description:"سالم في العشرين، شعر أسود وقميص أبيض"}],
 scenes:[{id:"S1",heading:"العاصفة",summary:"سالم يصعد درج المنارة في ليلة عاصفة ويشعل الضوء",duration:8,dialogue:[{speaker:"narrator",line:"كل ليلة، يعود سالم إلى المكان الوحيد الذي لم ينسه."}]},
  {id:"S2",heading:"الزجاجة",summary:"على الصخور يلمع شيء، سالم يلتقط زجاجة فيها ورقة قديمة",duration:10,dialogue:[{speaker:"سالم",line:"من أين جئتِ؟"}]},
  {id:"S3",heading:"الرسالة",summary:"يقرأ الرسالة فيرى نفسه شاباً يكتبها على الشاطئ",duration:12,dialogue:[{speaker:"سالم الشاب",line:"إن وجدت هذه الرسالة، فلا تنسَ حلمك."}]}]};
function mock(stage,prompt){window.__calls[stage]=(window.__calls[stage]||0)+1;const n=window.__calls[stage];
 if(stage==="WRITER")return W;
 if(stage==="CASTING")return{characters:[{name:"سالم",look:"رجل في السبعين، لحية بيضاء كثيفة، وجه لوّحته الشمس، عينان رماديتان",outfit:"معطف مطر أصفر وكنزة صوف",age:"72",gender:"male",voice:{dialect:"najdi",tone:"deep"}},{name:"سالم الشاب",look:"شاب في العشرين، شعر أسود قصير، ملامح سالم نفسها",outfit:"قميص أبيض",age:20,gender:"male",voice:{dialect:"najdi",tone:"warm"}}]};
 if(stage==="DIRECTOR"){const bad=n===1;return{vision:"دراما هادئة عن الذاكرة والحنين",pacing:"بطيء ثم يتسارع",shots:[{id:"S1-1",scene_id:"S1",shot:"Wide",camera:"crane up",action:"المنارة وسط العاصفة والأمواج تضرب الصخور",duration:"5",transition:"fade",emotion:"رهبة"},{id:"S1-2",scene_id:"S1",shot:"cu",camera:"static",action:"يد سالم تشعل المصباح",duration:4,transition:"cut",emotion:"إصرار"},{id:"S2-1",scene_id:bad?"S9":"S2",shot:"ms",camera:"dollyIn",action:"سالم ينحني ويلتقط الزجاجة",duration:5,transition:"cut",emotion:"فضول"},{id:"S3-1",scene_id:"S3",shot:"ecu",camera:"zoomIn",action:"الورقة القديمة بخط اليد",duration:6,transition:"match",emotion:"دهشة"},{id:"S3-2",scene_id:"S3",shot:"ws",camera:"orbit",action:"سالم الشاب على الشاطئ يكتب الرسالة",duration:6,transition:"dip",emotion:"حنين"}]}}
 if(stage==="CINE"){if(n===1)throw new Error("network error");const D=["S1-1","S1-2","S2-1","S3-1","S3-2"];return{look:{lighting:"ضوء المنارة الذهبي وسط زرقة العاصفة",lens:"35mm أنامورفيك",grade:"أزرق بارد مع ذهبي دافئ"},shots:D.map(id=>({id,prompt:"لقطة سينمائية "+id+": سالم (رجل في السبعين بلحية بيضاء ومعطف أصفر) في منارة وسط عاصفة، إضاءة ذهبية، عدسة 35mm",lens:"35mm",lighting:"ذهبي"}))}}
 if(stage==="SOUND")return{music:{genre:"أوركسترا هادئة",mood:"حنين",bpm:"72"},shots:["S1-1","S1-2","S2-1","S3-1","S3-2"].map(id=>({id,sfx:"رياح وأمواج",voice_line:id==="S2-1"?"من أين جئتِ؟":"",speaker:id==="S2-1"?"سالم":""}))};
 if(stage==="EDITOR")return{sequence:[["S1-1",5],["S1-2",4],["S2-1",5],["S3-1",6],["S3-2",6]].map(([id,d])=>({id,transition:"cut",duration:d})),total_duration:26,notes:"إيقاع يتصاعد"};
 if(stage==="PRODUCER")return{models:["S1-1","S1-2","S2-1","S3-1","S3-2"].map(id=>({id,model:id==="S3-2"?"hunyuan":"wan22",reason:"مناسب"})),credits_estimate:10,within_budget:true,risks:[]};
 if(stage==="PROOF"){window.__proofRuns++;return window.__proofRuns===1?{score:72,approved:false,issues:[{severity:"error",stage:"cine",problem:"وصف S3-2 لا يذكر سالم الشاب بل سالم العجوز",fix:"استخدم مظهر سالم الشاب في S3-2"}],send_back_to:"cine"}:{score:94,approved:true,issues:[{severity:"note",stage:"sound",problem:"يمكن إضافة صوت نوارس",fix:"اختياري"}],send_back_to:""}}
}
getSample=async()=>({json:async(prompt)=>{const m=String(prompt).match(/^FILM CREW · (\w+)/);return mock(m[1],prompt)}});
"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2,color_scheme="dark");pg=await ctx.new_page();errs=[]
        pg.on("pageerror",lambda e: errs.append(str(e)[:200]))
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{S.user={name:'G',method:'google'};S.lang='ar';S.myPlan='studio';S.credits=5000;S.view='crew';renderAll()}");await pg.wait_for_timeout(300)
        r={"bots":await pg.evaluate("BOTS.map(b=>b.name[1]+' · '+b.role[1]+(b.added?' (جديد)':''))"),"mascots":await pg.evaluate("document.querySelectorAll('.crewline svg.bot').length"),"smilMorph":await pg.evaluate("document.querySelectorAll('.crewline svg.bot animate[attributeName=d]').length")}
        # 1) offline run
        await pg.evaluate("()=>{S.crew.brief.idea='حارس منارة عجوز يجد رسالة في زجاجة من نفسه عندما كان شاباً';S.crew.brief.seconds=30}")
        await pg.evaluate("runCrew()");await pg.wait_for_function("!CREW.busy",timeout=30000)
        r["offline"]=await pg.evaluate("(()=>{const R=S.crew.run;return {status:R.status,score:R.score,modes:BOTS.map(b=>b.id+':'+(R.stages[b.id].mode||R.stages[b.id].status)),shots:(R.out.director||{shots:[]}).shots.length,errors:(R.audit||[]).filter(a=>a.severity==='error').length}})()")
        # 2) AI run with deliberate mistakes
        await pg.evaluate(MOCK)
        await pg.evaluate("runCrew()");await pg.wait_for_function("!CREW.busy",timeout=30000);await pg.wait_for_timeout(200)
        r["ai"]=await pg.evaluate("""(()=>{const R=S.crew.run;return {status:R.status,approved:R.approved,score:R.score,loops:R.loops,calls:window.__calls,attempts:Object.fromEntries(BOTS.map(b=>[b.id,R.stages[b.id].attempts+'×'+R.stages[b.id].mode])),
          directorFixed:R.out.director.shots.find(s=>s.id==='S2-1').scene_id,normalized:{shot:R.out.director.shots[0].shot,camera:R.out.director.shots[0].camera,duration:R.out.director.shots[0].duration,age:R.out.casting.characters[0].age,bpm:R.out.sound.music.bpm},
          sentBack:R.log.filter(l=>l.kind==='back').map(l=>l.msg),handoffs:R.log.filter(l=>l.kind==='hand').length,auditErrors:(R.audit||[]).filter(a=>a.severity==='error').length,credits:R.out.producer.credits_estimate}})()""")
        await pg.evaluate("window.scrollTo(0,0)");await pg.screenshot(path="/tmp/crew1.png")
        await pg.evaluate("(()=>{const e=document.querySelector('.crewstat');const y=e.getBoundingClientRect().top+window.scrollY-70;window.scrollTo(0,y);const m=document.querySelector('#main');if(m.scrollHeight>m.clientHeight)m.scrollTop+=e.getBoundingClientRect().top-70})()");await pg.wait_for_timeout(400);await pg.screenshot(path="/tmp/crew2.png")
        # deliverables
        await pg.evaluate("document.querySelector('[data-act=\"crew-board\"]').click()");await pg.wait_for_timeout(300)
        r["board"]=await pg.evaluate("[S.view,S.board.frames.length,S.board.frames[0].shot,S.board.frames[0].camera,S.board.frames[2].dialogue]")
        await pg.evaluate("()=>{S.view='crew';renderAll();document.querySelector('[data-act=\"crew-story\"]').click()}");await pg.wait_for_timeout(300)
        r["story"]=await pg.evaluate("[S.view,S.story.title,S.story.chapters.length,S.story.chapters[1].narr]")
        n0=await pg.evaluate("S.jobs.length")
        await pg.evaluate("()=>{S.view='crew';renderAll();document.querySelector('[data-act=\"crew-render\"]').click();document.querySelector('[data-act=\"crew-audio\"]').click()}");await pg.wait_for_timeout(300)
        r["jobs"]=await pg.evaluate(f"S.jobs.slice({n0}).map(j=>j.kind+':'+(j.model||''))")
        # universal prompt mascot changes with the work
        m=[]
        for t in ["story","video","image","voice","character","hook","film"]:
            m.append(await pg.evaluate(f"()=>{{S.view='home';S.homeAdv=true;S.uni={{task:'{t}',model:'auto',prompt:'x'}};renderAll();const b=document.querySelector('.uni .unibot svg, .uni .crewstack');return '{t}→'+(document.querySelector('.uni .crewstack')?'crew':((document.querySelector('.uni .unitag')||{{}}).textContent||'').split(' ')[0])}}"))
        r["promptMascot"]=m
        # cancel mid-run
        await pg.evaluate("()=>{getSample=async()=>({json:()=>new Promise(res=>setTimeout(()=>res({}),5000))});S.view='crew';renderAll();runCrew()}");await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('[data-act=\"crew-cancel\"]').click()");await pg.wait_for_function("!CREW.busy",timeout=8000)
        r["cancel"]=await pg.evaluate("S.crew.run.status")
        print(json.dumps(r,ensure_ascii=False,indent=1),errs);await b.close()
asyncio.run(main())
