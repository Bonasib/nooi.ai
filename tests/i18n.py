import asyncio, json, re, collections
from playwright.async_api import async_playwright
import os, pathlib
PAGE=os.environ.get("NOOI_URL") or pathlib.Path(__file__).resolve().parent.parent.joinpath("public/index.html").as_uri()
ALLOW=re.compile(r"^(nooi|ai|nooi\.ai|WAN|LTX|FLUX|SDXL|UGC|SRT|VTT|MCP|API|PNG|SVG|GLB|OBJ|FBX|PLY|USDZ|PDF|CSV|JSON|AI|TikTok|Instagram|YouTube|Facebook|LinkedIn|Snapchat|X|Reels|Shorts|Stories|Kling|Seedance|Qwen|Claude|ChatGPT|Blender|Unity|Cursor|Hunyuan|HunyuanVideo|Wan|DashScope|Stripe|PayPal|Airwallex|Moyasar|Tap|mada|Apple|Pay|Visa|Mastercard|STC|Google|Firebase|Resend|SendGrid|Cloudflare|Hostinger|VPS|HD|4K|1080p|480p|cr|SAR|USD|RIFE|STAR|ESRGAN|BVH|IBM|Plex|Geist|Sans|Serif|Mono|Cairo|Inter|DM|Noto|Kufi|Arabic|Latin|Aa|The|quick|fox|A4|Letter|Post|WIDE|TEXT|wide|Pro|Studio|Creator|Free|mp4|webm|ID|UI|OK|DOT|Sora|Veo|LUT|RGB|HEX|x|s|px|m|IPA|VAT|CR|IBAN|ZATCA|FAQ|3D|2D|SAM|K|B|M|Hz|dB|fps|FPS|Ghanem|G|Keeper|Last|Lighthouse|Demo|clip|Vazirmatn)$",re.I)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await (await b.new_context(viewport={"width":1440,"height":900})).new_page()
        await pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("file:") else r.continue_())
        await pg.goto(PAGE);await pg.wait_for_timeout(400)
        views=await pg.evaluate("Object.keys(VIEWS)")
        found=collections.defaultdict(set)
        for v in views:
            txt=await pg.evaluate("""(v)=>{S.user={name:'G',method:'google'};S.lang='ar';S.uiDialect='';S.view=v;renderAll();const out=[];const w=document.createTreeWalker(document.querySelector('#main'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.textContent.trim();if(t&&!n.parentElement.closest('script,style,code,pre,[dir=ltr] .mono,.fn,.fs,.cchip b,.usage .mono,input,textarea,select,.thumb,.tc,.kbd,.mono')&&/[A-Za-z]{3,}/.test(t)&&!/[\\u0600-\\u06FF]/.test(t))out.push(t.slice(0,90))}return [...new Set(out)]}""",v)
            for t in txt:
                words=[w for w in re.findall(r"[A-Za-z][A-Za-z\.\-]+",t) if not ALLOW.match(w)]
                if words: found[v].add(t)
        tot=sum(len(x) for x in found.values())
        print("views:",len(views),"untranslated snippets:",tot)
        for v,s in found.items(): print(v,"→",list(s)[:12])
        await b.close()
asyncio.run(main())
