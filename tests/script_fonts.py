"""Overlap / clipping check with the REAL web fonts and real-script text.

The other layout tests block the network, so they only ever measure the fallback fonts and
English/Arabic strings. Live, other languages are AI-translated and rendered in Noto/Plex
fonts whose metrics (tall Thai/Tamil/Ethiopic glyphs, stacked diacritics, wider CJK) differ.

This test loads Google Fonts, switches the UI language, replaces every visible text node in
the page with a sample in that language's script, at a typical translation length for it
(EXPANSION: CJK shorter, Latin/Cyrillic about 30 % longer), waits for the fonts, then reports:
  overlap  - two text boxes covering each other (same rule as tests/overlap.py)
  clipped  - text cut off by its own box or an ancestor with overflow:hidden
  fallback - characters rendered in a font the page did not ask for (missing web font)
Usage: python3 tests/script_fonts.py [lang ...]     (exit 1 if anything is found)
"""
import asyncio, json, os, pathlib, sys, urllib.request
from playwright.async_api import async_playwright

PAGE = os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()

SAMPLES = {
    "ar": "إنشاء فيديو احترافي بالذكاء الاصطناعي",
    "fa": "ساخت ویدیوی حرفه‌ای با هوش مصنوعی",
    "ckb": "دروستکردنی ڤیدیۆی پیشەیی بە زیرەکی",
    "ur": "مصنوعی ذہانت سے پیشہ ورانہ ویڈیو بنائیں",
    "hi": "कृत्रिम बुद्धिमत्ता से पेशेवर वीडियो बनाएँ",
    "th": "สร้างวิดีโอระดับมืออาชีพด้วยปัญญาประดิษฐ์",
    "ta": "செயற்கை நுண்ணறிவு மூலம் வீடியோ உருவாக்கு",
    "ja": "人工知能でプロ品質の動画を作成する",
    "zh": "使用人工智能制作专业视频",
    "ko": "인공지능으로 전문가급 동영상 만들기",
    "am": "በሰው ሰራሽ አስተውሎት ሙያዊ ቪዲዮ ይፍጠሩ",
    "ti": "ብሰብ ዝተሰርሐ ኣእምሮ ቪድዮ ፍጠር",
    "ber": "ⵙⴽⵔ ⴰⴼⵉⴷⵢⵓ ⵙ ⵜⵉⵖⴰⵔⴰ ⵜⴰⵎⴻⵙⵍⴰⵢⵜ",
    "ru": "Создайте профессиональное видео с ИИ",
    "yo": "Ṣẹ̀dá fídíò ọ̀jọ̀gbọ́n pẹ̀lú ọgbọ́n àtọwọ́dá",
    "fr": "Créez une vidéo professionnelle avec l'IA",
}
RTL = {"ar", "fa", "ckb", "ur"}
# Typical length of a translation relative to the English source, in characters. CJK needs far fewer
# (each character is about twice as wide), Latin and Cyrillic languages run longer.
EXPANSION = {"ja": 0.6, "zh": 0.5, "ko": 0.7, "ar": 1.1, "fa": 1.1, "ckb": 1.2, "ur": 1.1, "th": 1.1,
             "hi": 1.2, "ta": 1.4, "am": 1.0, "ti": 1.0, "ber": 1.2}
FONT_HOSTS = ("https://fonts.googleapis.com", "https://fonts.gstatic.com")
_font_cache = {}

async def route(r):
    url = r.request.url
    if url.startswith("file:"):
        return await r.continue_()
    if not url.startswith(FONT_HOSTS):
        return await r.abort()
    # Fetch fonts from Python rather than the browser: works behind proxies whose CA the
    # headless browser profile does not trust. The UA header makes Google serve woff2.
    if url not in _font_cache:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"})
        with await asyncio.to_thread(urllib.request.urlopen, req, timeout=30) as resp:
            _font_cache[url] = (resp.status, resp.headers.get("Content-Type", ""), resp.read())
    status, ctype, body = _font_cache[url]
    await r.fulfill(status=status, body=body, headers={"Content-Type": ctype, "Access-Control-Allow-Origin": "*"})

JS_FILL = r"""([lang,sample,view,grow])=>{S.user={name:'G',method:'google'};S.myPlan='studio';S.view=view;if(S.lang!==lang)setUILang(lang);else renderAll();$('#modalRoot').innerHTML='';
 const w=[...sample.split(' ')];let k=0;
 const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>{
   const p=n.parentElement;if(!p||!n.textContent.trim())return 2;
   if(p.closest('script,style,svg,canvas,code,pre,kbd,.mono,[translate=no],[dir=ltr] .tl,.tlwrap,.brand,.nbrand,.av,.crpill,.kbd,.gl .tx,.selbtn .sv'))return 2;
   if(/^[\d\s.,:%/$+\-×·|•→←]+$/.test(n.textContent))return 2;return 1}});
 const nodes=[];while(walk.nextNode())nodes.push(walk.currentNode);
 for(const n of nodes){const len=Math.max(1,Math.round(n.textContent.trim().length*grow));let out='';
   while(out.length<len){out+=(out?' ':'')+w[k++%w.length]}
   n.textContent=n.textContent.replace(n.textContent.trim(),out)}
 return nodes.length}"""

JS_MEASURE = r"""()=>{
 const vis=e=>{let r=e.getBoundingClientRect();if(r.width<2||r.height<2)return null;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.opacity==='0')return null;let p=e.parentElement,L=r.left,T=r.top,R=r.right,B=r.bottom;while(p&&p!==document.body){const c=getComputedStyle(p);if(c.overflow!=='visible'||c.overflowX!=='visible'||c.overflowY!=='visible'){const q=p.getBoundingClientRect();L=Math.max(L,q.left);T=Math.max(T,q.top);R=Math.min(R,q.right);B=Math.min(B,q.bottom)}p=p.parentElement}if(R-L<2||B-T<2)return null;return{left:L,top:T,right:R,bottom:B,width:R-L,height:B-T}};
 const closedIn=e=>{const d=e.closest('details');return d&&!d.open&&!e.closest('summary')};
 const skip='svg,canvas,.tlwrap,.tl,.boardcanvas,.bcanvas,.board,.wview,.frames,.botstrip,.crewline,.cchips,.tplcats,.hbar,.strip,.lpticker,[aria-hidden=true],.veil';
 const leaves=[...document.querySelectorAll('#main *, header *, nav *')].filter(e=>!e.closest(skip)&&!closedIn(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>({e,r:vis(e)})).filter(x=>x.r).slice(0,1200);
 const lab=e=>(e.className&&typeof e.className==='string'&&e.className.trim()?'.'+e.className.trim().split(/\s+/)[0]:e.tagName.toLowerCase())+(e.parentElement&&e.parentElement.className&&typeof e.parentElement.className==='string'?'<'+e.parentElement.className.trim().split(/\s+/)[0]:'');
 const bar=e=>{for(let p=e;p&&p!==document.body;p=p.parentElement){const ps=getComputedStyle(p).position;if(ps==='fixed'||ps==='sticky')return p}return null};
 const overlap=[];
 for(let i=0;i<leaves.length;i++)for(let j=i+1;j<leaves.length;j++){const a=leaves[i],b=leaves[j];if(a.e.contains(b.e)||b.e.contains(a.e))continue;
  const inl=x=>getComputedStyle(x).display.startsWith('inline');if(a.e.parentElement===b.e.parentElement&&inl(a.e)&&inl(b.e))continue;
  if(bar(a.e)!==bar(b.e))continue; // content scrolling under a fixed/sticky bar is by design
  const x=Math.max(0,Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)),y=Math.max(0,Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top));
  const ar=x*y,sm=Math.min(a.r.width*a.r.height,b.r.width*b.r.height);if(ar>sm*.25&&ar>30)overlap.push(lab(a.e)+' ⟷ '+lab(b.e))}
 const clipped=[];
 for(const {e} of leaves){const cs=getComputedStyle(e);
  // the element's own box cuts its text (fixed height / nowrap / line-height too small for the glyphs)
  const hid=v=>v==='hidden'||v==='clip';if(e.matches('textarea,input,select'))continue;
  const own=((hid(cs.overflowY)&&e.scrollHeight>e.clientHeight+2)||(hid(cs.overflowX)&&e.scrollWidth>e.clientWidth+2));
  const rg=document.createRange();rg.selectNodeContents(e);const tr=rg.getBoundingClientRect(),r=e.getBoundingClientRect();
  // ink extends past an ancestor that clips it
  let anc=null,p=e.parentElement;while(p&&p!==document.body){const c=getComputedStyle(p);if(hid(c.overflowY)||hid(c.overflowX)){const q=p.getBoundingClientRect();if((hid(c.overflowY)&&(tr.top<q.top-2||tr.bottom>q.bottom+2))||(hid(c.overflowX)&&(tr.left<q.left-2||tr.right>q.right+2))){anc=p;break}}p=p.parentElement}
  if(own||anc)clipped.push(lab(e)+(anc?' in '+lab(anc):'')+(own?' (own box)':''))}
 return {overlap:[...new Set(overlap)].slice(0,10),clipped:[...new Set(clipped)].slice(0,10)}}"""

async def main(langs):
    out, totals = {}, {"overlap": 0, "clipped": 0, "fallback": 0}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for dev, vp, mob in [("phone-390", {"width": 390, "height": 844}, True), ("desktop-1440", {"width": 1440, "height": 900}, False)]:
            ctx = await b.new_context(viewport=vp, is_mobile=mob, has_touch=mob)
            pg = await ctx.new_page()
            # local file + Google Fonts only; everything else (APIs, CDNs, analytics) is blocked
            await pg.route("**/*", route)
            await pg.goto(PAGE); await pg.wait_for_timeout(500)
            views = await pg.evaluate("Object.keys(VIEWS)")
            cdp = await ctx.new_cdp_session(pg); await cdp.send("DOM.enable"); await cdp.send("CSS.enable")
            for lang in langs:
                missing = set()
                for v in views:
                    try:
                        await pg.evaluate(JS_FILL, [lang, SAMPLES[lang], v, EXPANSION.get(lang, 1.3)])
                        await pg.evaluate("document.fonts.ready.then(()=>1)"); await pg.wait_for_timeout(120)
                        res = await pg.evaluate(JS_MEASURE)
                    except Exception as e:
                        res = {"overlap": [], "clipped": [], "error": str(e)[:120]}
                    if v == views[0] or v in ("home", "account"):
                        # which fonts actually render the sample text (CDP reports the used font per node)
                        doc = await cdp.send("DOM.getDocument", {"depth": 1})
                        q = await cdp.send("DOM.querySelector", {"nodeId": doc["root"]["nodeId"], "selector": "#main h1, #main h2, #main h3, #main button, #main p"})
                        if q.get("nodeId"):
                            fonts = await cdp.send("CSS.getPlatformFontsForNode", {"nodeId": q["nodeId"]})
                            for f in fonts["fonts"]:
                                if not f["isCustomFont"]: missing.add(f["familyName"])
                    if res["overlap"] or res["clipped"] or res.get("error"):
                        out[f"{dev}:{lang}:{v}"] = res
                        totals["overlap"] += bool(res["overlap"]); totals["clipped"] += bool(res["clipped"])
                if missing:
                    out[f"{dev}:{lang}:fonts"] = {"systemFallback": sorted(missing)}; totals["fallback"] += 1
            await ctx.close()
        await b.close()
    print(json.dumps({"totals": totals, "detail": out}, ensure_ascii=False, indent=1))
    return 1 if any(totals.values()) else 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:] or list(SAMPLES))))
