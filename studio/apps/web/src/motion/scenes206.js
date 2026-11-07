// (v247) The classic editor's v206 motion scenes — the 20 named effects, the picture showcases and the motions of the owner's
// reference videos (a kinetic promo, RAW vs EDITED, a vlog kit, an app burst) — brought to the studio as they were drawn there
// (our own code, moved over with the few helpers it uses). A scene draws round the middle of the frame: o = {W, H, U, lt, len, ac, it}.
// Pictures: it.pics holds the studio's picture asset ids; the host says how to get a loaded picture for one (setPicSource).
/* eslint-disable */
let LANG = "en", PICS = (id) => null, VER = 0;
export const setLang206 = (l) => { LANG = l === "ar" ? "ar" : "en"; };
export const setPicSource206 = (fn) => { PICS = fn; };
export const bumpPics206 = () => { VER++; };
export const picsVersion206 = () => VER;
const L = (en, ar) => (LANG === "ar" ? ar : en);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ezo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3), isRtl = (s) => /[֐-ࣿ]/.test(s || "");
const backOut131 = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const hsh = (i, s) => { const x = Math.sin(i * 127.1 + (s || 0) * 311.7) * 43758.5453; return x - Math.floor(x); };
function infoFont(w, px) { return w + " " + Math.round(px) + "px 'Inter','Cairo','IBM Plex Sans Arabic','Noto Sans Arabic',system-ui,sans-serif"; }
function fitF(ctx, txt, w, px, maxW) { txt = String(txt || ""); if (!txt) return px; ctx.font = infoFont(w, px); const m = ctx.measureText(txt).width; return m <= maxW ? px : Math.max(px * 0.1, (px * maxW) / m * 0.98); }
const rgb150 = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); const n = m ? parseInt(m[1], 16) : 0x7cff4f; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba150 = (h, a) => { const c = rgb150(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; };
const dark150 = (h, k) => { const c = rgb150(h); return "rgb(" + c.map((v) => Math.round(v * k)).join(",") + ")"; };
const rn150 = (i, s) => hsh(i + 1, s || 0);
function neon150(ctx,pts,p,ac,w){if(p<=0||pts.length<2)return;const d=[0];for(let i=1;i<pts.length;i++)d.push(d[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const L=d[d.length-1]*clamp(p,0,1);ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);let hx=pts[0][0],hy=pts[0][1];
  for(let i=1;i<pts.length;i++){if(d[i]<=L){ctx.lineTo(pts[i][0],pts[i][1]);hx=pts[i][0];hy=pts[i][1]}else{const f=(L-d[i-1])/Math.max(1e-6,d[i]-d[i-1]);hx=pts[i-1][0]+(pts[i][0]-pts[i-1][0])*f;hy=pts[i-1][1]+(pts[i][1]-pts[i-1][1])*f;ctx.lineTo(hx,hy);break}}
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.shadowColor=ac;ctx.shadowBlur=w*6;ctx.strokeStyle=rgba150(ac,.35);ctx.lineWidth=w*3;ctx.stroke();ctx.shadowBlur=w*3;ctx.strokeStyle=ac;ctx.lineWidth=w;ctx.stroke();
  ctx.shadowBlur=0;ctx.strokeStyle="rgba(255,255,255,.85)";ctx.lineWidth=w*.35;ctx.stroke();if(p<1){ctx.shadowColor=ac;ctx.shadowBlur=w*8;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(hx,hy,w*1.4,0,7);ctx.fill()}ctx.restore()}
function rr150(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function txt150(ctx,s,x,y,w,px,col,maxW,al,glow){if(!s)return 0;const F=fitF(ctx,s,w,px,maxW);ctx.font=infoFont(w,F);ctx.textAlign=al||"center";ctx.textBaseline="middle";ctx.direction=isRtl(s)?"rtl":"ltr";
  if(glow){ctx.shadowColor=glow;ctx.shadowBlur=F*.5}ctx.fillStyle=col;ctx.fillText(s,x,y);ctx.shadowBlur=0;return ctx.measureText(s).width}
function split162(ctx,s,w,px,maxW){s=String(s||"");const ws=s.split(/\s+/).filter(Boolean),F1=fitF(ctx,s,w,px,maxW);if(ws.length<2||F1>=px*.7||(ws.length<3&&F1>=px*.45))return{l:[s],F:F1,dy:0};
  let k=1,bd=1e9;ctx.font=infoFont(w,px);for(let i=1;i<ws.length;i++){const d=Math.abs(ctx.measureText(ws.slice(0,i).join(" ")).width-ctx.measureText(ws.slice(i).join(" ")).width);if(d<bd){bd=d;k=i}}
  const a=ws.slice(0,k).join(" "),b=ws.slice(k).join(" "),F=Math.min(fitF(ctx,a,w,px,maxW),fitF(ctx,b,w,px,maxW));return{l:[a,b],F,dy:F*1.18}}
function lines162(ctx,s,x,y,w,px,col,maxW,al,glow,mid){const T=split162(ctx,s,w,px,maxW);if(!T.l[0])return{w:0,dy:0};const y0=mid?y-T.dy/2:y;
  return{w:Math.max(...T.l.map((t,i)=>txt150(ctx,t,x,y0+i*T.dy,w,T.F,col,maxW,al,glow))),dy:T.dy}}
function bg150(ctx,W,H,ac,t){ctx.save();const g=ctx.createRadialGradient(W/2,H*.42,0,W/2,H*.42,Math.hypot(W,H)*.62);g.addColorStop(0,dark150(ac,.2));g.addColorStop(.5,"#06100a");g.addColorStop(1,"#010302");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);const U=Math.min(W,H);for(let i=0;i<28;i++){const x=(rn150(i,1)*W+t*U*.012*(rn150(i,2)-.5)*4+W)%W,y=(rn150(i,3)*H-t*U*.01*(.4+rn150(i,4))+H*9)%H,a=.05+.12*Math.abs(Math.sin(t*.8+i));
    ctx.fillStyle=rgba150(ac,a.toFixed(3));ctx.beginPath();ctx.arc(x,y,U*.0025*(1+rn150(i,5)*1.5),0,7);ctx.fill()}ctx.restore()}
const spring164=x=>{x=clamp(x,0,1);return x>=1?1:1-Math.exp(-6.2*x)*Math.cos(10.4*x)};   // (a spring: past the mark by ~12 %, settled by the end)
function hue164(hex,deg){const[r,g,b]=rgb150(hex).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;
  if(d){s=d/(1-Math.abs(2*l-1));h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60}h=((h+deg)%360+360)%360;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
  const[R,G,B]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return"#"+[R,G,B].map(v=>Math.round((v+m)*255).toString(16).padStart(2,"0")).join("")}
const CV = {}; const cv164 = (k, w, h) => { let c = CV[k]; if (!c) { c = CV[k] = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : document.createElement("canvas"); } if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; };
const img206 = (id) => { const im = PICS(id); return im && (im.naturalWidth || im.width) ? im : null; };

const list206=(it,d)=>{const a=(Array.isArray(it.items)?it.items:String(it.items||"").split(/\s*\|\s*/)).map(x=>String(x).trim()).filter(Boolean).slice(0,12);return a.length?a:(d||[])};
const nPics206=it=>(it.pics||[]).filter(Boolean).length;
function pic206(ctx,it,i,x,y,w,h,r){const ps=(it.pics||[]).filter(Boolean),u=ps.length?ps[i%ps.length]:null,im=u&&img206(u);ctx.save();if(r)rr150(ctx,x,y,w,h,r);else{ctx.beginPath();ctx.rect(x,y,w,h)}ctx.clip();
  if(im){const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height,s=Math.max(w/iw,h/ih),dw=iw*s,dh=ih*s;ctx.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
  else{const hu=(i*47+190)%360,g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,"hsl("+hu+" 65% 62%)");g.addColorStop(1,"hsl("+((hu+40)%360)+" 60% 34%)");ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    const m=Math.min(w,h);ctx.fillStyle="rgba(255,255,255,.8)";ctx.beginPath();ctx.arc(x+w*.32,y+h*.32,m*.09,0,7);ctx.fill();ctx.fillStyle="rgba(255,255,255,.5)";ctx.beginPath();ctx.moveTo(x+w*.1,y+h*.88);ctx.lineTo(x+w*.42,y+h*.5);ctx.lineTo(x+w*.6,y+h*.7);ctx.lineTo(x+w*.74,y+h*.56);ctx.lineTo(x+w*.92,y+h*.88);ctx.closePath();ctx.fill()}
  ctx.restore()}
function card206(ctx,it,i,x,y,w,h,r,U){ctx.save();ctx.shadowColor="rgba(0,0,0,.45)";ctx.shadowBlur=(U||w)*.06;ctx.shadowOffsetY=(U||w)*.015;rr150(ctx,x,y,w,h,r);ctx.fillStyle="#fff";ctx.fill();ctx.restore();pic206(ctx,it,i,x+w*.035,y+w*.035,w*.93,h-w*.07,r*.7)}
function pill206(ctx,s,x,y,px,bg,fg,al){ctx.save();ctx.font=infoFont(800,px);const w=ctx.measureText(s).width+px*1.3,h=px*1.7,x0=al==="left"?x:al==="right"?x-w:x-w/2;rr150(ctx,x0,y-h/2,w,h,h/2);ctx.fillStyle=bg;ctx.fill();txt150(ctx,s,x0+w/2,y,800,px,fg||"#fff",w*2);ctx.restore();return w}
const T206=(ctx,s,x,y,px,col,maxW,wt,al,glow)=>txt150(ctx,s,x,y,wt||800,px,col,maxW,al,glow);
const ph206=(lt,a,d)=>ezo(clamp((lt-a)/(d||.5),0,1));
const hu206=(ac,i)=>hue164(ac,(i*57)%360);
const SC206_={
  // ---- the 20 effects
  orbit(ctx,o){const{W,U,lt,ac,it}=o,P=nPics206(it),words=list206(it),n=P||(!words.length?8:Math.max(words.length,5)),e=ezo(clamp(lt/.9,0,1)),R=Math.min(W*.42,U*.62)*e,cw=U*.19,ch=U*.25;
    const els=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2+lt*.55;els.push({i,a,z:Math.sin(a)})}els.sort((p,q)=>p.z-q.z);let done=false;
    const title=()=>{if(it.t1){ctx.save();ctx.globalAlpha*=ph206(lt,.3);lines162(ctx,it.t1,0,0,800,U*.1,"#fff",W*.46,"center",ac,true);ctx.restore()}done=true};
    els.forEach(E=>{if(!done&&E.z>=0)title();const s=.6+.4*(E.z+1)/2;ctx.save();ctx.globalAlpha*=.4+.6*(E.z+1)/2;ctx.translate(Math.cos(E.a)*R,Math.sin(E.a)*R*.3);ctx.scale(s,s);
      if(P||!words.length)card206(ctx,it,E.i,-cw/2,-ch/2,cw,ch,U*.02,U);else pill206(ctx,words[E.i%words.length],0,0,U*.05,dark150(ac,.35));ctx.restore()});if(!done)title();return{w:W*.9,h:U*.7}},
  chat(ctx,o){const{W,H,U,lt,len,ac,it}=o,m=list206(it,[L("Did you see it?","شفته؟"),L("Wait… what?","لحظة… ماذا؟"),L("This changes everything","هذا يغيّر كل شيء"),L("Send it to me!","أرسله لي!")]),px=U*.046,bh=px*2.3,gp=px*.7,gap=.42;
    const sh=m.map((s,i)=>({s,i,t:lt-.2-i*gap})).filter(b=>b.t>0);ctx.save();
    sh.forEach((b,k)=>{const y=H*.3-(sh.length-1-k)*(bh+gp);if(y<-H*.6)return;const left=b.i%2===0,s=backOut131(clamp(b.t/.3,0,1));ctx.font=infoFont(600,px);const tw=Math.min(W*.66,ctx.measureText(b.s).width+px*1.6),x0=left?-W*.36:W*.36-tw;
      ctx.save();ctx.translate(left?x0:x0+tw,y);ctx.scale(s,s);ctx.translate(left?-x0:-(x0+tw),-y);rr150(ctx,x0,y-bh/2,tw,bh,bh*.42);ctx.fillStyle=left?"#fff":ac;ctx.shadowColor="rgba(0,0,0,.3)";ctx.shadowBlur=U*.02;ctx.fill();ctx.shadowBlur=0;
      T206(ctx,b.s,x0+tw/2,y,px,left?"#111":dark150(ac,.15),tw-px*.6,600);ctx.restore()});
    const tk=it.t1?clamp((lt-len*.68)/.3,0,1):0;if(tk>0){ctx.fillStyle="rgba(0,0,0,"+(.6*tk).toFixed(3)+")";ctx.fillRect(-W/2,-H/2,W,H);const s=1.4-.4*ezo(tk);ctx.save();ctx.scale(s,s);ctx.globalAlpha*=tk;lines162(ctx,it.t1,0,0,900,U*.13,"#fff",W*.8,"center",ac,true);ctx.restore()}
    ctx.restore();return{w:W*.8,h:H*.8}},
  frameEscape(ctx,o){const{H,U,lt,len,it}=o,fh=Math.min(H*.72,U*1.02),fw=fh*.78,x0=-fw/2,y0=-fh/2,e=ezo(clamp(lt/.6,0,1)),p=ezo(clamp((lt-len*.3)/.7,0,1));
    ctx.save();ctx.globalAlpha*=e;ctx.shadowColor="rgba(0,0,0,.5)";ctx.shadowBlur=U*.05;ctx.fillStyle="#fff";ctx.fillRect(x0-U*.025,y0-U*.025,fw+U*.05,fh+U*.05);ctx.shadowBlur=0;pic206(ctx,it,0,x0,y0,fw,fh,0);
    if(p>0){const s=1+.32*p;ctx.save();ctx.translate(0,-p*fh*.14);ctx.scale(s,s);ctx.shadowColor="rgba(0,0,0,.55)";ctx.shadowBlur=U*.05;ctx.beginPath();ctx.ellipse(0,-fh*.04,fw*.3,fh*.36,0,0,7);ctx.fillStyle="rgba(0,0,0,.2)";ctx.fill();ctx.shadowBlur=0;
      ctx.beginPath();ctx.ellipse(0,-fh*.04,fw*.3,fh*.36,0,0,7);ctx.clip();pic206(ctx,it,0,x0,y0,fw,fh,0);ctx.restore()}
    if(it.t1)T206(ctx,it.t1,0,y0+fh+U*.09,U*.065,"#fff",fw*1.3);ctx.restore();return{w:fw*1.2,h:fh*1.25}},
  snapZoom(ctx,o){const{W,H,U,lt,len,ac,it}=o,w=list206(it).length?list206(it):String((it.t1||"")+" "+(it.t2||"")).split(/\s+/).filter(Boolean),n=Math.max(1,w.length),seg=len/n,i=Math.min(n-1,Math.floor(lt/seg)),q=lt-i*seg,k=clamp(q/.14,0,1);
    const bgc=[ac,"#ffffff","#0b0b0b"][i%3],fg=i%3===2?ac:"#0b0b0b";ctx.save();ctx.fillStyle=bgc;ctx.fillRect(-W/2,-H/2,W,H);
    if(k<1){ctx.strokeStyle=i%3===2?"rgba(255,255,255,.35)":"rgba(0,0,0,.25)";ctx.lineWidth=U*.006;for(let j=0;j<18;j++){const a=j/18*Math.PI*2,r0=U*(.25+.5*k),r1=r0+U*.4*(1-k);ctx.beginPath();ctx.moveTo(Math.cos(a)*r0,Math.sin(a)*r0);ctx.lineTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.stroke()}}
    const s=1+2.2*(1-ezo(k)),sk=(1-k)*U*.01;ctx.translate(Math.sin(lt*90)*sk,Math.cos(lt*70)*sk);ctx.scale(s,s);lines162(ctx,w[i]||"",0,0,900,U*.2,fg,W*.86,"center",null,true);ctx.restore();
    if(k<.5){ctx.fillStyle="rgba(255,255,255,"+((.5-k)*1.2).toFixed(3)+")";ctx.fillRect(-W/2,-H/2,W,H)}return{w:W,h:H}},
  checklistPop(ctx,o){const{W,U,lt,ac,it}=o,m=list206(it,[L("Plan","خطّط"),L("Shoot","صوّر"),L("Edit","حرّر"),L("Post","انشر")]),n=m.length,rh=U*.13,bs=U*.075,rtl=isRtl(m.join(""));
    if(it.t1)T206(ctx,it.t1,0,-(n/2)*rh-U*.06,U*.075,"#fff",W*.8,900,"center",ac);
    m.forEach((s,i)=>{const t=lt-.25-i*.35;if(t<=0)return;const y=(i-(n-1)/2)*rh,sp=backOut131(clamp(t/.3,0,1)),bx=rtl?W*.22:-W*.3;ctx.save();ctx.translate(bx,y);ctx.rotate((1-sp)*.6);ctx.scale(sp,sp);
      rr150(ctx,-bs/2,-bs/2,bs,bs,bs*.28);ctx.fillStyle=hu206(ac,i);ctx.fill();const tp=clamp((t-.2)/.25,0,1);if(tp>0){ctx.strokeStyle="#0b0b0b";ctx.lineWidth=bs*.16;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();
        const pts=[[-bs*.24,0],[-bs*.05,bs*.2],[bs*.28,-bs*.2]];ctx.moveTo(...pts[0]);if(tp<.4)ctx.lineTo(pts[0][0]+(pts[1][0]-pts[0][0])*tp/.4,pts[0][1]+(pts[1][1]-pts[0][1])*tp/.4);else{ctx.lineTo(...pts[1]);const f=(tp-.4)/.6;ctx.lineTo(pts[1][0]+(pts[2][0]-pts[1][0])*f,pts[1][1]+(pts[2][1]-pts[1][1])*f)}ctx.stroke()}ctx.restore();
      ctx.save();ctx.globalAlpha*=clamp(t/.3,0,1);T206(ctx,s,bx+(rtl?-1:1)*bs*.9,y,U*.06,"#fff",W*.5,800,rtl?"right":"left");ctx.restore()});return{w:W*.7,h:n*rh+U*.1}},
  headlineStorm(ctx,o){const{W,H,U,lt,len,ac,it}=o,m=list206(it,[L("BREAKING","عاجل"),L("Everyone is talking","الكل يتحدث"),L("The new way to create","الطريقة الجديدة للإبداع"),L("Sold out in hours","نفد خلال ساعات"),L("You have to see this","يجب أن ترى هذا")]),N=Math.max(5,Math.min(8,m.length+2));
    for(let i=0;i<N;i++){const t=lt-i*.16;if(t<=0)continue;const e=ezo(clamp(t/.35,0,1)),d=i%4,y=-H*.36+i*(H*.72/(N-1)),r=(rn150(i,7)-.5)*.14,sw=W*(.5+.35*rn150(i,3)),sh=U*.085,dx=d===0?-W:d===1?W:0,dy=d===2?-H:d===3?H:0;
      ctx.save();ctx.translate(dx*(1-e)+(rn150(i,9)-.5)*W*.2,y+dy*(1-e));ctx.rotate(r);const bg=["#fff","#0b0b0b",ac,"#ff3b3b"][i%4],fg=i%4===1||i%4===3?"#fff":"#0b0b0b";
      ctx.shadowColor="rgba(0,0,0,.4)";ctx.shadowBlur=U*.02;ctx.fillStyle=bg;ctx.fillRect(-sw/2,-sh/2,sw,sh);ctx.shadowBlur=0;T206(ctx,m[i%m.length].toUpperCase(),0,0,sh*.5,fg,sw*.92,900);ctx.restore()}
    const k=it.t1?clamp((lt-len*.62)/.25,0,1):0;if(k>0){const s=1.6-.6*backOut131(k);ctx.save();ctx.scale(s,s);ctx.globalAlpha*=k;ctx.font=infoFont(900,U*.13);const tw=Math.min(W*.86,ctx.measureText(it.t1).width+U*.12);ctx.fillStyle=ac;ctx.fillRect(-tw/2,-U*.1,tw,U*.2);
      T206(ctx,it.t1,0,0,U*.13,"#0b0b0b",tw-U*.06,900);ctx.restore()}return{w:W,h:H}},
  zoomPortal(ctx,o){const{W,H,U,lt,len,ac,it}=o,p=ezo(clamp((lt-.3)/Math.max(.5,len*.6),0,1)),z=1+.06*lt/len;ctx.save();ctx.scale(z,z);pic206(ctx,it,0,-W/2,-H/2,W,H,0);ctx.restore();
    if(it.t1&&p<.5){ctx.save();ctx.globalAlpha*=1-p*2;lines162(ctx,it.t1,0,-H*.3,900,U*.1,"#fff",W*.86,"center","rgba(0,0,0,.6)",true);ctx.restore()}
    const r=p*Math.hypot(W,H)*.62;if(r>1){ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.clip();const s=1.7-.7*p;ctx.scale(s,s);pic206(ctx,it,1,-W/2,-H/2,W,H,0);ctx.restore();
      ctx.save();ctx.shadowColor=ac;ctx.shadowBlur=U*.06;ctx.strokeStyle=ac;ctx.lineWidth=U*.012;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.stroke();ctx.restore()}
    if(it.t2&&p>.7){ctx.save();ctx.globalAlpha*=(p-.7)/.3;lines162(ctx,it.t2,0,H*.3,900,U*.09,"#fff",W*.86,"center","rgba(0,0,0,.6)",true);ctx.restore()}return{w:W,h:H}},
  growthCurve(ctx,o){const{W,H,U,lt,len,ac,it}=o,w=Math.min(W*.74,U*1.15),h=Math.min(H*.5,U*.62),x0=-w/2,y0=h/2,p=ezo(clamp(lt/Math.max(.6,len*.72),0,1)),val=+it.val||250;
    ctx.save();ctx.strokeStyle="rgba(255,255,255,.18)";ctx.lineWidth=U*.002;for(let i=0;i<=4;i++){const y=y0-h*i/4;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+w,y);ctx.stroke()}ctx.restore();
    const pts=[];for(let i=0;i<=48;i++){const x=i/48,y=(Math.exp(3*x)-1)/(Math.exp(3)-1)+.035*Math.sin(i*1.3)*(1-x);pts.push([x0+x*w,y0-clamp(y,0,1)*h])}
    ctx.save();ctx.globalAlpha*=.25*p;ctx.beginPath();ctx.moveTo(x0,y0);pts.slice(0,Math.max(1,Math.round(48*p))+1).forEach(q=>ctx.lineTo(q[0],q[1]));ctx.lineTo(x0+w*p,y0);ctx.closePath();const g=ctx.createLinearGradient(0,y0-h,0,y0);g.addColorStop(0,ac);g.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g;ctx.fill();ctx.restore();
    neon150(ctx,pts,p,ac,U*.008);const v=Math.round(val*p);T206(ctx,(it.t2||"+")+v.toLocaleString("en-US")+(it.t2?"":"%"),x0,y0-h-U*.07,U*.1,"#fff",w,900,"left",ac);if(it.t1)T206(ctx,it.t1,x0,y0-h-U*.165,U*.045,"rgba(255,255,255,.8)",w,600,"left");return{w:w*1.1,h:h*1.6}},
  studioReveal(ctx,o){const{W,H,U,lt,len,ac,it}=o,p=ezo(clamp(lt/Math.max(.6,len*.55),0,1)),q=ph206(lt,len*.35,.7);ctx.save();ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(-W/2,-H/2,W,H);
    [-1,1].forEach(sd=>{const a=sd*(.55-.45*p),ox=sd*W*.45,oy=-H*.55;ctx.save();ctx.translate(ox,oy);ctx.rotate(a-sd*.3);const g=ctx.createLinearGradient(0,0,0,H*1.1);g.addColorStop(0,"rgba(255,255,240,.55)");g.addColorStop(1,"rgba(255,255,240,0)");ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-U*.03,0);ctx.lineTo(U*.03,0);ctx.lineTo(U*.3,H*1.1);ctx.lineTo(-U*.3,H*1.1);ctx.closePath();ctx.fill();ctx.restore()});
    const py=H*.22,g2=ctx.createRadialGradient(0,py,0,0,py,U*.5);g2.addColorStop(0,rgba150(ac,.35*p));g2.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g2;ctx.fillRect(-W/2,-H/2,W,H);
    ctx.fillStyle="#1b1b1f";ctx.beginPath();ctx.ellipse(0,py,U*.3,U*.06,0,0,7);ctx.fill();ctx.fillStyle="#2a2a30";ctx.fillRect(-U*.3,py,U*.6,U*.08);ctx.beginPath();ctx.ellipse(0,py+U*.08,U*.3,U*.06,0,0,Math.PI);ctx.fill();
    ctx.globalAlpha*=q;const rise=(1-q)*U*.12;if(nPics206(it)){const ch=U*.48,cw=ch*.8;card206(ctx,it,0,-cw/2,py-ch-U*.02+rise,cw,ch,U*.02,U)}else lines162(ctx,it.t1||"nooi",0,py-U*.2+rise,900,U*.14,"#fff",W*.8,"center",ac,true);
    if(it.t2)T206(ctx,it.t2,0,py+U*.2,U*.05,"rgba(255,255,255,.85)",W*.8,600);ctx.restore();return{w:W,h:H}},
  broll(ctx,o){const{W,H,U,lt,ac,it}=o,cap=list206(it),n=Math.max(1,Math.min(3,nPics206(it)||3)),pos=[[-.25,-.12,-.07],[.22,-.2,.06],[.02,.18,-.03]],cw=U*.36,ch=cw*.72;
    for(let i=0;i<n;i++){const t=lt-i*.3;if(t<=0)continue;const e=ezo(clamp(t/.6,0,1)),[px,py,r]=pos[i],dr=Math.sin(lt*.7+i)*U*.008;ctx.save();ctx.globalAlpha*=e;ctx.translate(px*W+dr,py*H+(1-e)*H*.4+dr);ctx.rotate(r*(1.6-.6*e));card206(ctx,it,i,-cw/2,-ch/2,cw,ch,U*.025,U);
      if(cap[i])pill206(ctx,cap[i],0,ch/2+U*.035,U*.035,dark150(ac,.25));ctx.restore()}return{w:W*.9,h:H*.8}},
  paperCut(ctx,o){const{W,H,U,lt,ac,it}=o;for(let i=0;i<4;i++){const e=ezo(clamp((lt-i*.18)/.7,0,1)),y=H*(.02+i*.12)+(1-e)*H*.6,c=hue164(ac,i*24-30);ctx.save();ctx.shadowColor="rgba(0,0,0,.35)";ctx.shadowBlur=U*.02;ctx.shadowOffsetY=-U*.008;ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(-W/2-10,H/2+10);
      for(let k=0;k<=8;k++){const x=-W/2+W*k/8;ctx.lineTo(x,y+Math.sin(k*1.4+i*2+lt*.6)*U*.04)}ctx.lineTo(W/2+10,H/2+10);ctx.closePath();ctx.fill();ctx.restore()}
    if(it.t1){const k=backOut131(clamp((lt-.5)/.6,0,1));ctx.save();ctx.translate(0,-H*.18-(1-k)*H*.6);ctx.rotate(-.04);ctx.font=infoFont(900,U*.1);const tw=Math.min(W*.86,ctx.measureText(it.t1).width+U*.14);ctx.shadowColor="rgba(0,0,0,.35)";ctx.shadowBlur=U*.02;ctx.shadowOffsetY=U*.01;
      ctx.fillStyle="#fffaf0";ctx.fillRect(-tw/2,-U*.085,tw,U*.17);ctx.shadowBlur=0;T206(ctx,it.t1,0,0,U*.1,"#1d1d1d",tw-U*.06,900);ctx.restore()}
    for(let i=0;i<40;i++){ctx.fillStyle="rgba(255,255,255,.06)";ctx.fillRect((rn150(i,1)-.5)*W,(rn150(i,2)-.5)*H,U*.004,U*.004)}return{w:W,h:H}},
  dollyZoom(ctx,o){const{W,H,U,lt,len,ac,it}=o,p=ezo(clamp(lt/len,0,1)),s=1+.7*p;ctx.save();ctx.scale(s,s);pic206(ctx,it,0,-W/2,-H/2,W,H,0);ctx.restore();
    ctx.save();ctx.strokeStyle="rgba(255,255,255,"+(.25*p).toFixed(3)+")";ctx.lineWidth=U*.004;for(let j=0;j<28;j++){const a=j/28*Math.PI*2,r0=U*.34,r1=r0+U*.8*p;ctx.beginPath();ctx.moveTo(Math.cos(a)*r0,Math.sin(a)*r0);ctx.lineTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.stroke()}ctx.restore();
    const rx=U*.26,ry=U*.32;ctx.save();ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,7);ctx.clip();pic206(ctx,it,0,-W/2,-H/2,W,H,0);ctx.restore();ctx.save();ctx.strokeStyle=rgba150(ac,.7);ctx.lineWidth=U*.006;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,7);ctx.stroke();ctx.restore();
    if(it.t1)lines162(ctx,it.t1,0,H*.38,900,U*.08,"#fff",W*.86,"center","rgba(0,0,0,.7)",true);return{w:W,h:H}},
  magazine(ctx,o){const{W,H,U,lt,ac,it}=o,ch=Math.min(H*.9,U*1.25),cw=ch*.76,e=ezo(clamp(lt/.7,0,1)),x0=-cw/2,y0=-ch/2;ctx.save();ctx.rotate((1-e)*-.06);ctx.scale(.86+.14*e,.86+.14*e);ctx.globalAlpha*=e;
    ctx.shadowColor="rgba(0,0,0,.55)";ctx.shadowBlur=U*.06;ctx.fillStyle="#fff";ctx.fillRect(x0,y0,cw,ch);ctx.shadowBlur=0;pic206(ctx,it,0,x0,y0,cw,ch,0);const g=ctx.createLinearGradient(0,y0,0,y0+ch);g.addColorStop(0,"rgba(0,0,0,.35)");g.addColorStop(.4,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.55)");ctx.fillStyle=g;ctx.fillRect(x0,y0,cw,ch);
    T206(ctx,(it.t1||"NOOI").toUpperCase(),0,y0+ch*.1,ch*.12,"#fff",cw*.94,900,"center",ac);if(it.t2)T206(ctx,it.t2,0,y0+ch*.19,ch*.028,"rgba(255,255,255,.9)",cw*.9,600);
    const cl=list206(it,[L("The new wave of creators","موجة المبدعين الجديدة"),L("10 ideas to try now","10 أفكار جرّبها الآن"),L("Inside the studio","داخل الاستوديو")]),rtl=isRtl(cl.join(""));
    cl.forEach((s,i)=>{const t=lt-.5-i*.22;if(t<=0)return;const k=ezo(clamp(t/.4,0,1)),y=y0+ch*(.58+i*.1),x=rtl?x0+cw*.94+(1-k)*cw*.3:x0+cw*.06-(1-k)*cw*.3;ctx.save();ctx.globalAlpha*=k;ctx.fillStyle=ac;ctx.fillRect(rtl?x+cw*.01:x-cw*.03,y-ch*.025,cw*.012,ch*.05);T206(ctx,s,x,y,ch*.034,"#fff",cw*.8,800,rtl?"right":"left");ctx.restore()});
    for(let i=0;i<22;i++){const bw=(rn150(i,4)>.5?2:1)*cw*.004;ctx.fillStyle="#000";ctx.fillRect(x0+cw*.72+i*cw*.009,y0+ch*.9,bw,ch*.06)}ctx.restore();return{w:cw,h:ch}},
  liquidGlass(ctx,o){const{W,H,U,lt,ac,it}=o;const blobs=[[ac,-.25,-.15],[hue164(ac,90),.25,.1],[hue164(ac,210),-.05,.25]];const drawB=(dx,a)=>blobs.forEach(([c,bx,by],i)=>{const x=bx*W+Math.sin(lt*.6+i*2)*W*.12+dx,y=by*H+Math.cos(lt*.5+i)*H*.1,r=U*.38,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba150(c,a));g.addColorStop(1,rgba150(c,0));ctx.fillStyle=g;ctx.fillRect(-W/2,-H/2,W,H)});
    drawB(0,.9);const cw=Math.min(W*.8,U*1.15),ch=U*.5,e=ezo(clamp(lt/.6,0,1)),x0=-cw/2,y0=-ch/2+(1-e)*U*.15;ctx.save();ctx.globalAlpha*=e;rr150(ctx,x0,y0,cw,ch,U*.06);ctx.save();ctx.clip();ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(x0,y0,cw,ch);ctx.translate(0,0);ctx.scale(1.08,1.08);drawB(U*.05,.45);
    const hg=ctx.createLinearGradient(0,y0,0,y0+ch);hg.addColorStop(0,"rgba(255,255,255,.35)");hg.addColorStop(.3,"rgba(255,255,255,.05)");hg.addColorStop(1,"rgba(255,255,255,.12)");ctx.fillStyle=hg;ctx.fillRect(x0-50,y0-50,cw+100,ch+100);ctx.restore();
    rr150(ctx,x0,y0,cw,ch,U*.06);ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=U*.004;ctx.stroke();lines162(ctx,it.t1||"",0,y0+ch*(it.t2?.4:.5),900,U*.09,"#fff",cw*.86,"center",null,true);if(it.t2)T206(ctx,it.t2,0,y0+ch*.72,U*.045,"rgba(255,255,255,.88)",cw*.86,600);ctx.restore();return{w:cw,h:ch}},
  zoomThrough(ctx,o){const{W,H,U,lt,len,ac,it}=o,w=list206(it).length?list206(it):[it.t1||L("Zoom","تقريب"),it.t2||L("Through","عبر")].filter(Boolean),n=w.length,seg=len/n,i=Math.min(n-1,Math.floor(lt/seg)),q=clamp((lt-i*seg)/seg,0,1);
    let s=1,a=1;if(q<.25)s=.35+.65*ezo(q/.25);if(q>.68&&i<n-1){const f=(q-.68)/.32;s=1+40*f*f*f;a=1-f*f}ctx.save();ctx.globalAlpha*=a;ctx.scale(s,s);lines162(ctx,w[i],0,0,900,U*.18,i%2?ac:"#fff",W*.86,"center",null,true);ctx.restore();return{w:W*.8,h:U*.4}},
  greenScreen(ctx,o){const{W,H,U,lt,len,ac,it}=o,xd=W/2-W*ezo(clamp((lt-.4)/Math.max(.6,len*.6),0,1)),rx=U*.24,ry=U*.33;
    ctx.save();ctx.beginPath();ctx.rect(-W/2,-H/2,xd+W/2,H);ctx.clip();ctx.fillStyle="#1fc24f";ctx.fillRect(-W/2,-H/2,W,H);ctx.save();ctx.beginPath();ctx.ellipse(0,H*.05,rx,ry,0,0,7);ctx.clip();pic206(ctx,it,0,-W/2,-H/2,W,H,0);ctx.restore();ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(xd,-H/2,W/2-xd,H);ctx.clip();pic206(ctx,it,0,-W/2,-H/2,W,H,0);ctx.fillStyle="rgba(40,0,0,.45)";ctx.fillRect(-W/2,-H/2,W,H);lines162(ctx,(it.t1||L("EDITED","معدّل")).toUpperCase(),0,-H*.05,900,U*.26,"#e11d2e",W*.96,"center",null,true);
    ctx.save();ctx.beginPath();ctx.ellipse(0,H*.05,rx,ry,0,0,7);ctx.clip();pic206(ctx,it,0,-W/2,-H/2,W,H,0);ctx.restore();const fg=ctx.createLinearGradient(0,H*.1,0,H/2);fg.addColorStop(0,"rgba(255,255,255,0)");fg.addColorStop(1,"rgba(255,255,255,.3)");ctx.fillStyle=fg;ctx.fillRect(-W/2,-H/2,W,H);ctx.restore();
    ctx.save();ctx.fillStyle="#fff";ctx.fillRect(xd-U*.003,-H/2,U*.006,H);ctx.beginPath();ctx.arc(xd,0,U*.03,0,7);ctx.fill();ctx.restore();pill206(ctx,"RAW",-W*.42,-H*.42,U*.035,"rgba(0,0,0,.65)","#fff","left");pill206(ctx,L("EDITED","معدّل"),W*.42,-H*.42,U*.035,ac,"#0b0b0b","right");
    if(it.t2)T206(ctx,it.t2,0,H*.43,U*.04,"#fff",W*.8,700,"center","rgba(0,0,0,.6)");return{w:W,h:H}},
  frameBreak(ctx,o){const{W,H,U,lt,len,ac,it}=o,fh=Math.min(H*.7,U),fw=fh*.8,x0=-fw/2,y0=-fh/2,q=clamp((lt-len*.38)/Math.max(.5,len*.5),0,1);
    if(q>.05&&it.t1){ctx.save();ctx.globalAlpha*=ezo((q-.05)/.4);const s=.7+.3*ezo(q);ctx.scale(s,s);lines162(ctx,it.t1,0,0,900,U*.14,"#fff",W*.86,"center",ac,true);ctx.restore()}
    if(q<=0){ctx.save();ctx.globalAlpha*=ezo(clamp(lt/.5,0,1));ctx.fillStyle="#fff";ctx.fillRect(x0-U*.02,y0-U*.02,fw+U*.04,fh+U*.04);pic206(ctx,it,0,x0,y0,fw,fh,0);ctx.restore();return{w:fw,h:fh}}
    const C=4,R=3;for(let r=0;r<R;r++)for(let c=0;c<C;c++)for(let k=0;k<2;k++){const id=(r*C+c)*2+k,ax=x0+fw*c/C,ay=y0+fh*r/R,bw=fw/C,bh=fh/R,tri=k?[[ax,ay],[ax+bw,ay],[ax+bw,ay+bh]]:[[ax,ay],[ax+bw,ay+bh],[ax,ay+bh]],cx=(tri[0][0]+tri[1][0]+tri[2][0])/3,cy=(tri[0][1]+tri[1][1]+tri[2][1])/3,
      d=Math.hypot(cx,cy)||1,sp=U*(.6+rn150(id,3)*.8)*q,dx=cx/d*sp,dy=cy/d*sp+U*.6*q*q,rot=(rn150(id,5)-.5)*3*q;ctx.save();ctx.globalAlpha*=1-q;ctx.translate(cx+dx,cy+dy);ctx.rotate(rot);ctx.translate(-cx,-cy);ctx.beginPath();ctx.moveTo(...tri[0]);ctx.lineTo(...tri[1]);ctx.lineTo(...tri[2]);ctx.closePath();ctx.clip();
      ctx.fillStyle="#fff";ctx.fillRect(x0-U*.02,y0-U*.02,fw+U*.04,fh+U*.04);pic206(ctx,it,0,x0,y0,fw,fh,0);ctx.restore()}return{w:fw,h:fh}},
  digitalZoom(ctx,o){const{W,H,U,lt,len,ac,it}=o,seg=len/3,i=Math.min(2,Math.floor(lt/seg)),k=ezo(clamp((lt-i*seg)/.25,0,1)),zs=[1,2,4],z=zs[Math.max(0,i-1)]+(zs[i]-zs[Math.max(0,i-1)])*(i?k:1),tx=W*.12,ty=-H*.06,pix=Math.max(1,Math.round(14*(1-k))*(i?1:0));
    const sw=Math.max(8,Math.round(W/Math.max(1,pix))),sh=Math.max(8,Math.round(H/Math.max(1,pix))),cv=cv164("dz206",sw,sh),x=cv.getContext("2d");x.setTransform(sw/W,0,0,sh/H,sw/2,sh/2);x.translate(tx,ty);x.scale(z,z);x.translate(-tx,-ty);pic206(x,it,0,-W/2,-H/2,W,H,0);
    ctx.save();ctx.imageSmoothingEnabled=pix<=1;ctx.drawImage(cv,-W/2,-H/2,W,H);ctx.restore();ctx.save();ctx.strokeStyle="rgba(255,255,255,.9)";ctx.lineWidth=U*.004;const b=U*.18,l=U*.05;[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.moveTo(sx*b,sy*b-sy*l);ctx.lineTo(sx*b,sy*b);ctx.lineTo(sx*b-sx*l,sy*b);ctx.stroke()});
    ctx.beginPath();ctx.moveTo(-U*.02,0);ctx.lineTo(U*.02,0);ctx.moveTo(0,-U*.02);ctx.lineTo(0,U*.02);ctx.stroke();T206(ctx,"ZOOM "+z.toFixed(1)+"x",-W*.42,-H*.42,U*.035,"#fff",W*.5,700,"left");if(Math.floor(lt*2)%2===0){ctx.fillStyle="#ff3b3b";ctx.beginPath();ctx.arc(W*.4,-H*.42,U*.014,0,7);ctx.fill()}
    T206(ctx,"REC",W*.37,-H*.42,U*.03,"#fff",W*.2,700,"right");const sl=((lt*.6)%1)*H-H/2;ctx.fillStyle=rgba150(ac,.12);ctx.fillRect(-W/2,sl,W,U*.01);ctx.restore();if(it.t1)lines162(ctx,it.t1,0,H*.38,900,U*.07,"#fff",W*.86,"center","rgba(0,0,0,.7)",true);return{w:W,h:H}},
  phoneMockup(ctx,o){const{W,H,U,lt,ac,it}=o,rtl=isRtl((it.t1||"")+(it.t2||"")),side=it.t1?(rtl?1:-1):0,a=(1-spring164(clamp(lt/1.1,0,1)))*-.7+.07*Math.sin(lt*.8),pw=Math.min(U*.42,H*.4),ph=pw*2.05,px=side*W*.2;
    ctx.save();ctx.translate(px,0);ctx.save();const sh=ctx.createRadialGradient(0,ph*.56,0,0,ph*.56,pw*.9);sh.addColorStop(0,"rgba(0,0,0,.5)");sh.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=sh;ctx.scale(1,.18);ctx.fillRect(-pw,ph*.56/.18-pw*.9,pw*2,pw*1.8);ctx.restore();
    ctx.transform(Math.cos(a),Math.sin(a)*.22,0,1,0,0);rr150(ctx,-pw/2,-ph/2,pw,ph,pw*.16);ctx.fillStyle="#0b0b0f";ctx.fill();ctx.strokeStyle="#3a3a44";ctx.lineWidth=U*.006;ctx.stroke();pic206(ctx,it,0,-pw/2+pw*.05,-ph/2+pw*.05,pw*.9,ph-pw*.1,pw*.12);
    rr150(ctx,-pw*.14,-ph/2+pw*.08,pw*.28,pw*.07,pw*.035);ctx.fillStyle="#000";ctx.fill();const gl=ctx.createLinearGradient(-pw/2,-ph/2,pw/2,ph/2);gl.addColorStop(0,"rgba(255,255,255,.18)");gl.addColorStop(.4,"rgba(255,255,255,0)");ctx.fillStyle=gl;rr150(ctx,-pw/2,-ph/2,pw,ph,pw*.16);ctx.fill();ctx.restore();
    if(it.t1){const k=ph206(lt,.5,.6),tx=-side*W*.06+(side?0:0);ctx.save();ctx.globalAlpha*=k;const ax=side?(-side*W*.08):0;lines162(ctx,it.t1,ax+(1-k)*-side*U*.1,-U*.04,900,U*.085,"#fff",W*.42,side?(rtl?"right":"left"):"center",ac);if(it.t2)T206(ctx,it.t2,ax,U*.08,U*.042,"rgba(255,255,255,.85)",W*.42,600,side?(rtl?"right":"left"):"center");ctx.restore()}return{w:W*.9,h:ph*1.1}},
  checklist(ctx,o){const{W,U,lt,ac,it}=o,m=list206(it,[L("Idea","الفكرة"),L("Script","النص"),L("Shoot","التصوير"),L("Edit","التحرير"),L("Publish","النشر")]),n=m.length,rh=U*.1,cw=Math.min(W*.72,U*.95),ch=U*.2+n*rh,x0=-cw/2,y0=-ch/2,rtl=isRtl(m.join("")+(it.t1||"")),e=ezo(clamp(lt/.5,0,1));
    ctx.save();ctx.globalAlpha*=e;ctx.translate(0,(1-e)*U*.1);ctx.shadowColor="rgba(0,0,0,.45)";ctx.shadowBlur=U*.05;rr150(ctx,x0,y0,cw,ch,U*.03);ctx.fillStyle="#fffdf6";ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle="rgba(60,90,200,.18)";ctx.lineWidth=U*.002;
    for(let i=0;i<n;i++){const y=y0+U*.16+i*rh+rh*.5;ctx.beginPath();ctx.moveTo(x0+cw*.04,y);ctx.lineTo(x0+cw*.96,y);ctx.stroke()}ctx.strokeStyle="rgba(220,40,40,.45)";ctx.beginPath();const mx=rtl?x0+cw*.88:x0+cw*.12;ctx.moveTo(mx,y0);ctx.lineTo(mx,y0+ch);ctx.stroke();
    T206(ctx,it.t1||L("Today","اليوم"),rtl?x0+cw*.84:x0+cw*.16,y0+U*.08,U*.06,"#1d1d1d",cw*.7,900,rtl?"right":"left");const tc=dark150(ac,.55);
    m.forEach((s,i)=>{const t=lt-.4-i*.4;if(t<=0)return;const y=y0+U*.16+i*rh+rh*.15,bx=rtl?x0+cw*.93:x0+cw*.07,k=clamp(t/.3,0,1);ctx.save();ctx.globalAlpha*=k;
      if(i===n-1&&t>.6){ctx.fillStyle="rgba(255,230,0,.45)";ctx.font=infoFont(700,U*.05);const tw=ctx.measureText(s).width;ctx.fillRect(rtl?x0+cw*.84-tw:x0+cw*.16,y-U*.03,tw,U*.06)}
      T206(ctx,s,rtl?x0+cw*.84:x0+cw*.16,y,U*.05,"#262626",cw*.62,700,rtl?"right":"left");ctx.strokeStyle=tc;ctx.lineWidth=U*.008;ctx.lineCap="round";const tp=clamp((t-.15)/.25,0,1);ctx.beginPath();ctx.moveTo(bx-U*.02,y);ctx.lineTo(bx-U*.005,y+U*.017*Math.min(1,tp*2));if(tp>.5)ctx.lineTo(bx-U*.005+U*.03*(tp-.5)*2,y+U*.017-U*.04*(tp-.5)*2);ctx.stroke();ctx.restore()});ctx.restore();return{w:cw,h:ch}},
  // ---- showcases of up to 12 pictures
  totem(ctx,o){const{W,H,U,lt,it}=o,cw=Math.min(W*.26,U*.34),ch=cw*1.3,g=cw*.12;ctx.save();ctx.rotate(-.1);for(let c=0;c<3;c++){const dir=c%2?1:-1,off=((lt*U*.09*dir)%(ch+g)+(ch+g))%(ch+g),x=(c-1)*(cw+g);
      for(let r=-3;r<=3;r++){const y=r*(ch+g)+off-(ch+g)*.5,e=ph206(lt,.1*(c*2+r+3)*.25,.6);ctx.save();ctx.globalAlpha*=e;card206(ctx,it,((c*4+r+12)%12),x-cw/2,y-ch/2,cw,ch,U*.02,U);ctx.restore()}}ctx.restore();return{w:W,h:H}},
  spread(ctx,o){const{W,H,U,lt,it}=o,ch=Math.min(H*.27,U*.36),cw=ch*1.35,g=cw*.1;ctx.save();ctx.rotate(-.06);for(let r=0;r<3;r++){const dir=r%2?1:-1,span=cw+g,off=((lt*U*.1*dir)%span+span)%span,y=(r-1)*(ch+g);
      for(let c=-4;c<=4;c++){const x=c*span+off-span*.5,e=ph206(lt,(r*.15+(c+4)*.04),.5);ctx.save();ctx.globalAlpha*=e;ctx.translate(0,(1-e)*U*.2);card206(ctx,it,((r*5+c+20)%12),x-cw/2,y-ch/2,cw,ch,U*.02,U);ctx.restore()}}ctx.restore();return{w:W,h:H}},
  iso(ctx,o){const{W,H,U,lt,it}=o,cs=U*.22,g=cs*.18;ctx.save();ctx.translate(0,-U*.05);ctx.transform(.86,.5,-.86,.5,0,0);for(let r=0;r<3;r++)for(let c=0;c<4;c++){const i=r*4+c,t=lt-.08*i,e=ezo(clamp(t/.55,0,1)),x=(c-1.5)*(cs+g),y=(r-1)*(cs+g),lift=(1-e)*U*.9+Math.sin(lt*1.2+i)*U*.012;
      ctx.save();ctx.globalAlpha*=e;ctx.fillStyle="rgba(0,0,0,.3)";ctx.fillRect(x-cs/2+U*.02,y-cs/2+U*.02,cs,cs);ctx.translate(-lift*.5,-lift*.5);card206(ctx,it,i,x-cs/2,y-cs/2,cs,cs,U*.015,U);ctx.restore()}ctx.restore();return{w:W,h:H}},
  wheel(ctx,o){const{W,H,U,lt,it}=o,N=10,R=Math.min(W*.55,U*.7),cy=R*.62,cw=U*.2,ch=cw*1.3,e=ezo(clamp(lt/.8,0,1));const els=[];for(let i=0;i<N;i++){const a=-Math.PI/2+(i/N)*Math.PI*2+lt*.35;els.push({i,a,z:Math.sin(a+Math.PI/2)})}
    els.sort((p,q)=>q.z-p.z).reverse();els.forEach(E=>{const x=Math.cos(E.a)*R*e,y=cy+Math.sin(E.a)*R*e;
      ctx.save();ctx.translate(x,y);ctx.rotate(E.a+Math.PI/2);const s=.85+.4*Math.max(0,-Math.sin(E.a));ctx.scale(s,s);card206(ctx,it,E.i,-cw/2,-ch/2,cw,ch,U*.02,U);ctx.restore()});if(it.t1)lines162(ctx,it.t1,0,-H*.36,900,U*.08,"#fff",W*.86,"center",o.ac,true);return{w:W,h:H}},
  deck(ctx,o){const{W,H,U,lt,len,it}=o,N=8,cw=U*.26,ch=cw*1.32;for(let i=N-1;i>=0;i--){const t=lt-.35-i*Math.max(.2,(len*.6)/N),k=ezo(clamp(t/.5,0,1)),a=(i-(N-1)/2)*.17,R=U*.9,x=Math.sin(a)*R*k,y=(R-Math.cos(a)*R)*k+U*.18-H*.02*(1-k)+i*(1-k)*-U*.006,rot=a*k+(1-k)*(i*.02-.07);
      ctx.save();ctx.translate(x,y-U*.05);ctx.rotate(rot);card206(ctx,it,i,-cw/2,-ch/2,cw,ch,U*.022,U);ctx.restore()}if(it.t1)lines162(ctx,it.t1,0,-H*.38,900,U*.08,"#fff",W*.86,"center",o.ac,true);return{w:W,h:H}},
  // ---- the reference motions
  promo(ctx,o){const{W,H,U,lt,len,ac,it}=o;ctx.save();for(let i=0;i<4;i++){const x=Math.sin(lt*.5+i*1.7)*W*.35,y=Math.cos(lt*.4+i*2.3)*H*.35,r=U*(.28+.08*Math.sin(lt+i));const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba150(ac,.9));g.addColorStop(1,rgba150(ac,0));ctx.fillStyle=g;ctx.fillRect(-W/2,-H/2,W,H)}ctx.restore();
    const txt=it.t1||L("A cat surfing a giant wave","قطة تركب موجة عملاقة"),bw=Math.min(W*.84,U*1.15),bh=U*.13,by=-H*.12,typ=clamp((lt-.4)/Math.max(.8,len*.35),0,1),nch=Math.round(txt.length*typ),shown=txt.slice(0,nch),rtl=isRtl(txt),e=ezo(clamp(lt/.45,0,1));
    if(it.t2){ctx.save();ctx.globalAlpha*=e;T206(ctx,it.t2,0,by-bh*1.05,U*.055,"#0b0b0b",bw,900);ctx.restore()}
    ctx.save();ctx.globalAlpha*=e;ctx.translate(0,(1-e)*U*.1);ctx.shadowColor="rgba(0,0,0,.25)";ctx.shadowBlur=U*.04;rr150(ctx,-bw/2,by-bh/2,bw,bh,bh/2);ctx.fillStyle="#fff";ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle="#efefef";ctx.beginPath();ctx.arc(-bw/2+bh*.55,by,bh*.32,0,7);ctx.fill();T206(ctx,"+",-bw/2+bh*.55,by,bh*.4,"#444",bh,700);const go=lt>.4+Math.max(.8,len*.35)+.55&&lt<.4+Math.max(.8,len*.35)+.8;
    ctx.save();ctx.translate(bw/2-bh*.55,by);if(go)ctx.scale(.86,.86);ctx.fillStyle=ac;ctx.beginPath();ctx.arc(0,0,bh*.34,0,7);ctx.fill();ctx.strokeStyle="#0b0b0b";ctx.lineWidth=bh*.07;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(0,bh*.14);ctx.lineTo(0,-bh*.14);ctx.moveTo(-bh*.11,-bh*.03);ctx.lineTo(0,-bh*.14);ctx.lineTo(bh*.11,-bh*.03);ctx.stroke();ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(-bw/2+bh*1.05,by-bh/2,bw-bh*2.1,bh);ctx.clip();const tx=rtl?bw/2-bh*1.1:-bw/2+bh*1.1,tw=T206(ctx,shown||" ",tx,by,bh*.32,"#111",bw*3,500,rtl?"right":"left");if(typ<1||Math.floor(lt*2.4)%2===0){ctx.fillStyle="#111";ctx.fillRect(rtl?tx-tw-U*.006:tx+tw+U*.004,by-bh*.2,U*.004,bh*.4)}ctx.restore();ctx.restore();
    const tEnd=.4+Math.max(.8,len*.35),mk=clamp((lt-tEnd)/.55,0,1);if(mk>0&&mk<1.01&&lt<tEnd+1.2){const mx=W*.3+(bw/2-bh*.55-W*.3)*ezo(mk),my=H*.3+(by-H*.3)*ezo(mk);ctx.save();ctx.translate(mx+U*.01,my+U*.01);ctx.fillStyle="#fff";ctx.strokeStyle="#0b0b0b";ctx.lineWidth=U*.004;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,U*.06);ctx.lineTo(U*.015,U*.045);ctx.lineTo(U*.028,U*.07);ctx.lineTo(U*.037,U*.066);ctx.lineTo(U*.025,U*.042);ctx.lineTo(U*.045,U*.042);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
    const cs=Math.min(W*.2,U*.24);for(let i=0;i<4;i++){const t=lt-tEnd-.8-i*.12;if(t<=0)continue;const k=backOut131(clamp(t/.35,0,1)),x=(i-1.5)*(cs*1.08),y=by+bh+cs*.75;ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.rotate((i-1.5)*.05);card206(ctx,it,i,-cs/2,-cs*.6,cs,cs*1.2,U*.02,U);ctx.restore()}return{w:W,h:H}},
  vlog(ctx,o){const{W,H,U,lt,len,ac,it}=o,h=it.t2||"@nooi",e=ph206(lt,.1,.5);ctx.save();ctx.globalAlpha*=e*.92;const ax=-W*.43,ay=-H*.42;ctx.save();ctx.beginPath();ctx.arc(ax+U*.03,ay,U*.03,0,7);ctx.clip();pic206(ctx,it,0,ax,ay-U*.03,U*.06,U*.06,0);ctx.restore();
    T206(ctx,h,ax+U*.075,ay,U*.035,"#fff",W*.5,800,"left","rgba(0,0,0,.6)");ctx.restore();const sub=String(it.t1||L("The best coffee in town","أفضل قهوة في المدينة")).split(/\s+/),k=Math.max(1,Math.round(sub.length*clamp((lt-.3)/Math.max(.6,len*.5),0,1))),s=sub.slice(0,k).join(" ");
    const endK=clamp((lt-len*.7)/.4,0,1);if(endK<1){ctx.save();ctx.globalAlpha*=1-endK;ctx.font=infoFont(800,U*.05);const tw=Math.min(W*.86,ctx.measureText(sub.join(" ")).width+U*.08);rr150(ctx,-tw/2,H*.33-U*.045,tw,U*.09,U*.02);ctx.fillStyle="rgba(0,0,0,.6)";ctx.fill();T206(ctx,s,0,H*.33,U*.05,"#fff",tw-U*.04,800);ctx.restore()}
    if(endK>0){ctx.save();ctx.globalAlpha*=endK;ctx.fillStyle="rgba(0,0,0,.72)";ctx.fillRect(-W/2,-H/2,W,H);const r=U*.13,sk=backOut131(endK);ctx.save();ctx.scale(sk,sk);ctx.save();ctx.beginPath();ctx.arc(0,-U*.1,r,0,7);ctx.clip();pic206(ctx,it,0,-r,-U*.1-r,r*2,r*2,0);ctx.restore();
      ctx.strokeStyle=ac;ctx.lineWidth=U*.008;ctx.beginPath();ctx.arc(0,-U*.1,r+U*.01,0,7);ctx.stroke();T206(ctx,h,0,U*.1,U*.055,"#fff",W*.8,800);pill206(ctx,L("Follow","تابِع"),0,U*.21,U*.045,ac,"#0b0b0b");ctx.restore();ctx.restore()}return{w:W,h:H}},
  appburst(ctx,o){const{W,H,U,lt,len,ac,it}=o,N=10,cs=U*.11,R=Math.min(W*.4,U*.48),labels=list206(it);for(let i=0;i<N;i++){const t=lt-.1-i*.05,k=clamp(t/.7,0,1);if(k<=0)continue;const a=i/N*Math.PI*2-Math.PI/2+(1-ezo(k))*2.4,r=R*(k<.6?ezo(k/.6)*1.15:1.15-.15*ezo((k-.6)/.4)),x=Math.cos(a)*r,y=Math.sin(a)*r*.82;
      ctx.save();ctx.translate(x,y);ctx.rotate((1-ezo(k))*3);ctx.shadowColor="rgba(0,0,0,.4)";ctx.shadowBlur=U*.02;rr150(ctx,-cs/2,-cs/2,cs,cs,cs*.24);const g=ctx.createLinearGradient(-cs/2,-cs/2,cs/2,cs/2);g.addColorStop(0,hue164(ac,i*36));g.addColorStop(1,dark150(hue164(ac,i*36+20),.75));ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;
      T206(ctx,(labels[i]||"ABCDEFGHIJ"[i])[0].toUpperCase(),0,0,cs*.46,"#fff",cs,900);ctx.restore()}
    const lk=clamp((lt-.9)/.5,0,1);if(lk>0){const s=backOut131(lk);ctx.save();ctx.scale(s,s);ctx.save();ctx.shadowColor=ac;ctx.shadowBlur=U*.06;ctx.fillStyle=ac;ctx.beginPath();ctx.arc(0,0,U*.13,0,7);ctx.fill();ctx.restore();T206(ctx,(it.t1||"nooi").slice(0,8),0,0,U*.07,"#0b0b0b",U*.24,900);ctx.restore()}
    if(it.t2&&lt>1.3)T206(ctx,it.t2,0,R*.98+U*.08,U*.05,"#fff",W*.86,700);return{w:W*.9,h:H*.9}}};

export const SC206 = SC206_;
/** draw one scene (the frame's middle is (0,0) inside); ac: the accent colour; it: {t1, t2, items, val, pics} */
export function drawScene206(ctx, id, W, H, lt, len, ac, it, bg) {
  const f = SC206_[id]; if (!f) return false; ctx.save();
  if (bg) bg150(ctx, W, H, ac, lt);
  ctx.translate(W / 2, H / 2); f(ctx, { W, H, U: Math.min(W, H), lt, len, ac, it }); ctx.restore(); return true;
}
