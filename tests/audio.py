import asyncio, json
from playwright.async_api import async_playwright
import os, pathlib, subprocess, sys
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
HERE=pathlib.Path(__file__).resolve().parent
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2,color_scheme="dark");pg=await ctx.new_page();errs=[]
        pg.on("pageerror",lambda e: errs.append(str(e)[:200]))
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{S.user={name:'G',method:'google'};S.lang='ar';S.view='voice';S.alab.mode='denoise';S.alab.hum='50';S.alab.strength=70;renderAll()}");await pg.wait_for_timeout(300)
        await (await pg.query_selector('#alab input[data-alup]')).set_input_files(str(HERE/'noisy.wav'));await pg.wait_for_timeout(800)
        await pg.click('#alab [data-act="al-run"]');await pg.wait_for_timeout(2500)
        r=await pg.evaluate("""(()=>{const sr=AL.sr,x=AL.mono,y=AL.out;const rms=(a,s,e)=>{let q=0;for(let i=Math.floor(s*sr);i<Math.floor(e*sr);i++)q+=a[i]*a[i];return Math.sqrt(q/((e-s)*sr))};const db=v=>20*Math.log10(v+1e-12);
          const nb=rms(x,.1,.9),na=rms(y,.1,.9),vb=rms(x,1.2,2.8),va=rms(y,1.2,2.8);
          return {noiseBefore_dB:+db(nb).toFixed(1),noiseAfter_dB:+db(na).toFixed(1),voiceToNoise_before_dB:+(db(vb)-db(nb)).toFixed(1),voiceToNoise_after_dB:+(db(va)-db(na)).toFixed(1),sameLength:x.length===y.length}})()""")
        await pg.evaluate("document.querySelector('#alab').scrollIntoView({block:'start'});document.querySelector('#main').scrollTop-=60");await pg.wait_for_timeout(400);await pg.screenshot(path="/tmp/alab.png")
        def pitch(expr): return f"""(()=>{{const sr=AL.sr,a={expr};const N=8192,s=Math.floor(1.2*sr);const re=new Float64Array(N),im=new Float64Array(N);for(let i=0;i<N;i++)re[i]=(a[s+i]||0)*(.5-.5*Math.cos(2*Math.PI*i/N));fft(re,im,false);let best=0,bb=0;for(let b=Math.floor(60*N/sr);b<Math.floor(400*N/sr);b++){{const m=Math.hypot(re[b],im[b]);if(m>best){{best=m;bb=b}}}}return +(bb*sr/N).toFixed(1)}})()"""
        base=await pg.evaluate(pitch("AL.mono"))
        out={}
        for fx in ["deep","high","child","monster","hall"]:
            await pg.evaluate(f"()=>{{S.alab.mode='voice';S.alab.fx='{fx}';S.alab.ai='';S.alab.amount=100}}")
            await pg.evaluate("alRun()");await pg.wait_for_timeout(2500)
            out[fx]={"pitchHz":await pg.evaluate(pitch("AL.out")),"sameLength":await pg.evaluate("AL.out.length===AL.mono.length")}
        await pg.evaluate("()=>{renderView()}");await pg.wait_for_timeout(200)
        # send to the editor, then AI conversion job
        await pg.evaluate("document.querySelector('#alab [data-act=\"al-apply\"]').click()");await pg.wait_for_timeout(600)
        applied=await pg.evaluate("[S.view,!!M.edVoice,M.edVoice&&M.edVoice.name]")
        await pg.evaluate("()=>{S.view='voice';S.alab.ai=VOICE_PRESETS[1].id;renderAll()}");await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('#alab [data-act=\"al-ai-run\"]').click()");await pg.wait_for_timeout(300)
        aijob=await pg.evaluate("(()=>{const j=S.jobs.filter(x=>x.kind==='voiceconvert').pop();return j?{cost:j.cost,target:j.meta.target}:null})()")
        # editor quick clean button
        await pg.evaluate("()=>{S.view='edit';S.ed.tab='audio';renderAll()}");await pg.wait_for_timeout(300)
        quick=await pg.evaluate("[...document.querySelectorAll('[data-act=\"al-quick\"],[data-act=\"al-open\"]')].map(b=>b.dataset.act+':'+b.dataset.k)")
        print(json.dumps({"denoise":r,"basePitchHz":base,"voiceChanger":out,"sentToEditor":applied,"aiConversion":aijob,"editorButtons":quick},ensure_ascii=False,indent=1),errs);await b.close()
asyncio.run(main())
