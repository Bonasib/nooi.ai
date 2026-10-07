# Pro tools: open every editor tab, the 3D studio, motion capture and the AI-providers admin page,
# click every control in them (on-device AI mocked), and report any page error. errors must be [].
import asyncio, json, os, subprocess, time, sys
from playwright.async_api import async_playwright

PORT = 8097
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOCK = """()=>{laiCall=async(msg,onp)=>{if(onp)onp({status:'running'});const t=msg.task;
 if(msg.op==='probe')return{device:'wasm',fp16:false,gpu:''};
 if(t==='sam-embed')return{w:640,h:360};
 if(t==='sam-decode'){const w=128,h=72,mk=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(Math.hypot((x-64)/25,(y-36)/22)<1)mk[y*w+x]=1;return{w,h,mask:mk,score:.9}}
 if(t==='depthraw'){const w=64,h=36,d=new Uint8Array(w*h).fill(128);return{w,h,data:d}}
 if(t==='pose')return{kp:Array.from({length:17},(_,i)=>({x:.4+(i%2)*.2,y:.15+i*.045,s:.9}))};
 if(t==='asr')return{text:'hello world',chunks:[{start:0,end:.5,text:'hello'},{start:.5,end:1,text:'world'}]};
 if(t==='bg'){return new Promise(r=>{const c=document.createElement('canvas');c.width=c.height=32;c.toBlob(b=>r({blob:b}),'image/png')})}
 throw new Error('unmocked '+t)};S.localAI=true}"""
SKIP = {"sc-gen", "sc-av", "sc-one", "sc-retry", "hf-send", "xp-dl", "ed-export", "ed-publish", "s3d-turntable", "eng-try", "edx-aishot", "logout", "signout", "adm-send", "adm-test"}

CLICK_JS = """async ([sel, cap, skip]) => { let n = 0;
  for (let i = 0; i < cap; i++) {
    const els = [...document.querySelectorAll(sel + ' button:not([disabled]),' + sel + ' [role=button],' + sel + ' input[type=checkbox]')]
      .filter(e => e.dataset.set !== 'ed.tab' && e.dataset.act !== 'adm-tab' && !skip.includes(e.dataset.act || '') && !e.dataset.go && e.offsetParent !== null);
    if (i >= els.length) break;
    els[i].click(); n++;
    if (typeof ED !== 'undefined') ED.playing = false;
    const mr = document.getElementById('modalRoot'); if (mr && mr.querySelector('.sheet')) mr.innerHTML = '';
    await new Promise(r => setTimeout(r, 25));
  } return n }"""

async def click_all(pg, scope, errs, label, cap=120):
    try:
        return await pg.evaluate(CLICK_JS, [scope, cap, sorted(SKIP)])
    except Exception as e:
        errs.append(label + ": " + str(e)[:160]); return 0

async def main():
    env = dict(os.environ, PORT=str(PORT), SECRET_KEY="t" * 32)
    srv = subprocess.Popen(["node", "server.js"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                import urllib.request; urllib.request.urlopen(f"http://localhost:{PORT}/", timeout=1); break
            except Exception: time.sleep(.25)
        out = {"clicks": 0, "errors": [], "checks": {}}
        async with async_playwright() as p:
            b = await p.chromium.launch()
            for w in (1440, 390):
                ctx = await b.new_context(viewport={"width": w, "height": 900}, is_mobile=w < 800, has_touch=w < 800)
                pg = await ctx.new_page(); errs = []
                pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)[:200]))
                await pg.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
                await pg.goto(f"http://localhost:{PORT}/"); await pg.wait_for_timeout(1200)
                E = pg.evaluate
                await E("()=>{S.langAsked=true;document.getElementById('langsug')?.remove();S.lang='en';S.user={name:'Test',method:'google'};AU.showAuth=false;renderAll()}")
                await E(MOCK)
                # editor: every tab, every control
                await E("()=>{go('edit');PJ.fresh('edit');document.querySelector('[data-act=ed-demo]').click();document.querySelector('[data-act=ed-demo]').click();S.ed.sel=S.ed.clips[0].id;S.ed.caps.words=edxSpread('one two three four',0.2,2.5);S.ed.caps.on=true;S.ed.sfx=[{id:'s1',n:'pop',t:1,vol:100}];S.ed.regions=[{id:'r1',kind:'blur',shape:'rect',box:{x:.5,y:.5,w:.2,h:.1},start:0,end:4,amt:10}];renderView()}")
                tabs = await E("()=>[...document.querySelectorAll('.tabs [data-set=\"ed.tab\"]')].map(b=>b.dataset.val)")
                out["checks"][f"{w}:tabs"] = len(tabs)
                if w < 800: tabs = [t for t in tabs if t in ("clip", "text", "motion", "color", "sfx", "words", "erase", "layers")]
                for t in tabs:
                    await E(f"()=>{{S.ed.tab='{t}';S.ed.sel=S.ed.clips[0]&&S.ed.clips[0].id;if(!S.ed.texts.length)document.querySelector('[data-act=ed-addtext]')?.click();S.ed.selText=S.ed.texts[0]&&S.ed.texts[0].id;S.ed.tab='{t}';ED.playing=false;renderView()}}")
                    await pg.wait_for_timeout(150)
                    out["clicks"] += await click_all(pg, ".edgrid>.panel:last-child", errs, f"{w}:edit:{t}", 60 if w > 800 else 35)
                    await E("()=>{ED.playing=false;if(!S.ed.clips.length)document.querySelector('[data-act=ed-demo]').click()}")
                # play through every clip with all effects on
                await E("()=>{const c=S.ed.clips[0];if(c){c.vfx={shake:1,pulse:1,rgb:1,glow:1,radial:1,pixel:1,mirror:1,strobe:1,invert:1,comic:1,vhs:1,leak:1};c.cg={look:'teal',exp:10,temp:30};c.trans='glitch';c.mo={kf:[{t:0,s:1,x:0,y:0,r:0},{t:1,s:1.5,x:.1,y:0,r:10}],ease:'smooth'}}S.ed.tab='clip';renderView();for(let t=0;t<edTotal();t+=.25){ED.t=t;edTick(performance.now())}}")
                # 3D studio
                await E("()=>go('studio3d')"); await pg.wait_for_timeout(300)
                await E("()=>{document.querySelector('[data-act=s3d-clear]')?.click();renderView();document.querySelector('[data-act=s3d-demo]')?.click()}"); await pg.wait_for_timeout(800)
                out["clicks"] += await click_all(pg, "#main", errs, f"{w}:studio3d", 60)
                await E("()=>{S.s3d.mode='body';S.s3d.points=[{x:.5,y:.45,pos:true}];s3dMask();renderView()}"); await pg.wait_for_timeout(300)
                await E("()=>s3dRunLocal()"); await pg.wait_for_timeout(1500)
                out["checks"][f"{w}:3d"] = await E("()=>{const j=S.jobs.filter(x=>x.kind==='3d').pop();return j?j.status:'none'}")
                # motion capture
                await E("()=>go('mocap')"); await pg.wait_for_timeout(300)
                out["clicks"] += await click_all(pg, "#main", errs, f"{w}:mocap", 40)
                # home create box (every tab) and Explore
                for t in ["agent", "video", "image", "audio", "avatar"]:
                    await E(f"()=>{{go('home');S.hf.tab='{t}';renderView()}}"); await pg.wait_for_timeout(120)
                    out["clicks"] += await click_all(pg, ".hfbox", errs, f"{w}:home:{t}", 14)
                    await E("()=>{const m=document.getElementById('modalRoot');if(m)m.innerHTML=''}")
                await E("()=>go('discover')"); await pg.wait_for_timeout(500)
                out["checks"][f"{w}:explore"] = await E("()=>document.querySelectorAll('.xpcard').length")
                out["clicks"] += await click_all(pg, "#main", errs, f"{w}:explore", 30)
                # admin AI providers
                await E("()=>{go('admin');S.admTab='models';renderView()}"); await pg.wait_for_timeout(1200)
                out["clicks"] += await click_all(pg, ".engquick", errs, f"{w}:engine", 10)
                out["checks"][f"{w}:engine"] = await E("()=>!!document.querySelector('.engquick')")
                out["errors"] += [f"{w}: " + e for e in errs]
                await ctx.close()
            await b.close()
        print(json.dumps(out, indent=1))
    finally:
        srv.terminate()

asyncio.run(main())
